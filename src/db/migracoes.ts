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

/** v2 → v3: rotina diária, timing de treino, praticidade e custo da dieta. */
export const V3 = `
-- Horário do treino: muda o timing das refeições. Quem treina 6h da manhã não
-- tem "pré-treino" separado — o café da manhã É o pré-treino.
ALTER TABLE profile ADD COLUMN horario_treino TEXT NOT NULL DEFAULT 'manha';
ALTER TABLE profile ADD COLUMN hora_acorda TEXT NOT NULL DEFAULT '06:30';
ALTER TABLE profile ADD COLUMN hora_dorme TEXT NOT NULL DEFAULT '23:00';
ALTER TABLE profile ADD COLUMN hora_treino TEXT;

-- Praticidade e custo definem quais receitas entram no cardápio.
ALTER TABLE diet_config ADD COLUMN praticidade TEXT NOT NULL DEFAULT 'equilibrado';
ALTER TABLE diet_config ADD COLUMN orcamento TEXT NOT NULL DEFAULT 'medio';
ALTER TABLE diet_config ADD COLUMN faz_marmita INTEGER NOT NULL DEFAULT 1;
ALTER TABLE diet_config ADD COLUMN dias_marmita INTEGER NOT NULL DEFAULT 5;

-- Custo por 100 g, em reais. Alimenta a estimativa da lista de compras.
ALTER TABLE foods ADD COLUMN custo_100g REAL;

-- Receita: marmitável e faixa de custo.
ALTER TABLE recipes ADD COLUMN marmitavel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN custo_nivel TEXT NOT NULL DEFAULT 'medio';
ALTER TABLE recipes ADD COLUMN rende_dias INTEGER;

-- Substituição feita durante o treino: registra o que foi trocado e por quê.
CREATE TABLE IF NOT EXISTS substituicoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER REFERENCES workout_sessions(id) ON DELETE CASCADE,
  de_exercise   INTEGER REFERENCES exercises(id),
  para_exercise INTEGER REFERENCES exercises(id),
  motivo        TEXT,
  criado_em     INTEGER NOT NULL
);

-- Checklist diário: a tela de constância.
CREATE TABLE IF NOT EXISTS rotina_itens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chave      TEXT    NOT NULL UNIQUE,
  titulo     TEXT    NOT NULL,
  emoji      TEXT    NOT NULL DEFAULT '✅',
  horario    TEXT,
  dias       TEXT    NOT NULL DEFAULT '0,1,2,3,4,5,6',
  ativo      INTEGER NOT NULL DEFAULT 1,
  automatico INTEGER NOT NULL DEFAULT 0,
  ordem      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rotina_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chave      TEXT NOT NULL,
  data       TEXT NOT NULL,
  concluido  INTEGER NOT NULL DEFAULT 1,
  registrado_em INTEGER NOT NULL,
  UNIQUE (chave, data)
);
CREATE INDEX IF NOT EXISTS ix_rotina_data ON rotina_log (data);

-- Sono: entra na rotina porque é onde a hipertrofia de fato acontece.
CREATE TABLE IF NOT EXISTS sono_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT NOT NULL UNIQUE,
  horas     REAL NOT NULL,
  qualidade INTEGER,
  criado_em INTEGER NOT NULL
);

-- Sessões de mobilidade e alongamento.
CREATE TABLE IF NOT EXISTS mobilidade_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  data        TEXT    NOT NULL,
  rotina      TEXT    NOT NULL,
  duracao_seg INTEGER NOT NULL,
  criado_em   INTEGER NOT NULL
);
`;

/**
 * Cada degrau: versão de destino e os comandos.
 * Falha em ALTER TABLE de coluna já existente é ignorada de propósito — deixa
 * a migração ser reaplicada sem quebrar bancos parcialmente migrados.
 */
/**
 * v3 → v4: preferência de equipamento.
 *
 * O Position Stand do ACSM de 2026 lista tipo de equipamento entre o que NÃO
 * precisa ser prescrito, e a meta-análise de Haugen (2023) não achou diferença
 * de hipertrofia entre máquina e peso livre (SMD −0,055; IC 95% −0,40 a 0,29;
 * p = 0,75). Ou seja: isto é preferência de verdade, não um lado certo e outro
 * errado — e preferência é o que faz alguém continuar aparecendo.
 */
const V4 = `
ALTER TABLE profile ADD COLUMN preferencia_equipamento TEXT NOT NULL DEFAULT 'ambos';
`;

export const MIGRACOES: { versao: number; sql: string }[] = [
  { versao: 2, sql: V2 },
  { versao: 3, sql: V3 },
  { versao: 4, sql: V4 },
];
