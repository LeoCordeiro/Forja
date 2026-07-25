/**
 * Migrações incrementais.
 *
 * O DDL base cria o banco do zero; aqui ficam as mudanças aplicadas a bancos
 * que já existem. Cada degrau roda uma vez só, controlado por `user_version`.
 *
 * Regra: nunca alterar um degrau já publicado — só acrescentar o próximo.
 */

/** SQL da v1 → v2: hidratação, bioimpedância completa, preferências e perfis. */
export const V2 = `
-- ── Metabolismo medido e metas próprias ───────────────────────────────────
-- Bioimpedância dá o TMB real, que costuma divergir bastante da estimativa
-- por fórmula. Quando existir, ele vale mais.
ALTER TABLE profile ADD COLUMN tmb_medido_kcal INTEGER;
ALTER TABLE profile ADD COLUMN usa_tmb_medido INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile ADD COLUMN meta_agua_ml INTEGER;
ALTER TABLE profile ADD COLUMN gordura_meta_pct REAL;

-- Experiência e disponibilidade definem volume e periodização do treino.
ALTER TABLE profile ADD COLUMN experiencia TEXT NOT NULL DEFAULT 'iniciante';
ALTER TABLE profile ADD COLUMN dias_treino_semana INTEGER NOT NULL DEFAULT 3;
-- Data em que voltou a treinar: base do plano de readaptação pós-pausa.
ALTER TABLE profile ADD COLUMN retomou_em TEXT;
ALTER TABLE profile ADD COLUMN meses_parado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile ADD COLUMN papel TEXT NOT NULL DEFAULT 'aluno';

-- ── Bioimpedância ─────────────────────────────────────────────────────────
ALTER TABLE body_metrics ADD COLUMN gordura_visceral REAL;
ALTER TABLE body_metrics ADD COLUMN musculo_pct REAL;
ALTER TABLE body_metrics ADD COLUMN idade_corporal INTEGER;
ALTER TABLE body_metrics ADD COLUMN tmb_kcal INTEGER;
ALTER TABLE body_metrics ADD COLUMN agua_pct REAL;
ALTER TABLE body_metrics ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual';

-- ── Hidratação ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL,          -- YYYY-MM-DD
  ml            INTEGER NOT NULL,
  registrado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_water_data ON water_logs (data);

-- ── Preferências alimentares ──────────────────────────────────────────────
-- Guarda o que a pessoa come de fato. Cardápio montado sem isso vira lista de
-- comida que ninguém prepara.
CREATE TABLE IF NOT EXISTS food_prefs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo      TEXT NOT NULL,      -- gosta|evita|alergia
  categoria TEXT,               -- proteina|carbo|hortifruti|laticinio|...
  termo     TEXT NOT NULL,      -- nome do alimento ou grupo
  UNIQUE (tipo, termo)
);

-- Restrições gerais do cardápio (vegetariano, sem lactose, tempo de preparo).
CREATE TABLE IF NOT EXISTS diet_config (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  restricao           TEXT NOT NULL DEFAULT 'nenhuma',
  tempo_max_preparo   INTEGER NOT NULL DEFAULT 45,
  refeicoes_por_dia   INTEGER NOT NULL DEFAULT 5,
  cozinha_de_verdade  INTEGER NOT NULL DEFAULT 1,
  atualizado_em       INTEGER NOT NULL
);

-- ── Treino: cardio, intensidade e check-in ────────────────────────────────
ALTER TABLE routine_days ADD COLUMN tipo TEXT NOT NULL DEFAULT 'forca';
ALTER TABLE routine_days ADD COLUMN foco TEXT;
ALTER TABLE routines ADD COLUMN nivel TEXT NOT NULL DEFAULT 'iniciante';
ALTER TABLE routines ADD COLUMN dias_semana INTEGER NOT NULL DEFAULT 3;

ALTER TABLE routine_exercises ADD COLUMN rpe_alvo REAL;
ALTER TABLE routine_exercises ADD COLUMN eh_composto INTEGER NOT NULL DEFAULT 0;

-- Check-in: onde treinou e como chegou. Vira contexto do histórico.
ALTER TABLE workout_sessions ADD COLUMN local TEXT;
ALTER TABLE workout_sessions ADD COLUMN energia_inicial INTEGER;
ALTER TABLE workout_sessions ADD COLUMN semana_plano INTEGER;

-- Vídeo de execução: guardamos o termo de busca, não o vídeo. Assim o link
-- nunca quebra por vídeo removido e não hospedamos conteúdo de terceiros.
ALTER TABLE exercises ADD COLUMN busca_video TEXT;
ALTER TABLE exercises ADD COLUMN eh_composto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exercises ADD COLUMN descanso_padrao INTEGER;

-- Tags da receita: alimenta o filtro por preferência alimentar.
ALTER TABLE recipes ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes ADD COLUMN observacao TEXT;

-- ── Perfis (família e amigos no mesmo aparelho) ───────────────────────────
CREATE TABLE IF NOT EXISTS perfis (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  emoji     TEXT    NOT NULL DEFAULT '💪',
  papel     TEXT    NOT NULL DEFAULT 'aluno',   -- aluno|personal
  ativo     INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);

-- ── Plano de treino periodizado ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plano_treino (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  fase           TEXT    NOT NULL,   -- readaptacao|acumulo|intensificacao|deload
  semana_atual   INTEGER NOT NULL DEFAULT 1,
  semanas_total  INTEGER NOT NULL,
  routine_id     INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  iniciado_em    TEXT    NOT NULL,
  ativo          INTEGER NOT NULL DEFAULT 1
);

-- ── Lembretes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lembretes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo     TEXT    NOT NULL,     -- agua|treino|medida|refeicao
  horario  TEXT    NOT NULL,     -- HH:MM
  ativo    INTEGER NOT NULL DEFAULT 1,
  dias     TEXT    NOT NULL DEFAULT '0,1,2,3,4,5,6'
);
`;

/**
 * Cada degrau: versão de destino e os comandos.
 * Falha em ALTER TABLE de coluna já existente é ignorada de propósito — deixa
 * a migração ser reaplicada sem quebrar bancos parcialmente migrados.
 */
export const MIGRACOES: { versao: number; sql: string }[] = [{ versao: 2, sql: V2 }];
