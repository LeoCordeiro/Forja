/**
 * Schema do banco local (SQLite).
 *
 * Regra que rege tudo: PLANO ≠ EXECUÇÃO.
 * `routine_exercises` é o que você planejou levantar; `set_logs` é o que você
 * realmente levantou. Se misturar os dois, editar a rotina apaga o histórico —
 * e o histórico é o produto.
 *
 * Nomes de coluna em snake_case para o schema sair daqui e entrar num Postgres
 * (Supabase) sem reescrita, quando for a hora de comercializar.
 */

export const SCHEMA_VERSION = 1;

export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────── PERFIL ───────────────────────────

CREATE TABLE IF NOT EXISTS profile (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),  -- single-user por ora
  nome                TEXT    NOT NULL,
  data_nascimento     TEXT    NOT NULL,                    -- YYYY-MM-DD
  genero              TEXT    NOT NULL,                    -- masculino|feminino|outro
  altura_cm           REAL    NOT NULL,
  nivel_atividade     TEXT    NOT NULL DEFAULT 'moderado',
  objetivo            TEXT    NOT NULL,                    -- hipertrofia|emagrecimento|manutencao
  peso_meta_kg        REAL,
  onboarding_completo INTEGER NOT NULL DEFAULT 0,
  criado_em           INTEGER NOT NULL
);

-- Peso NÃO fica em profile: é série temporal, senão a evolução se perde.
CREATE TABLE IF NOT EXISTS body_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  medido_em   TEXT    NOT NULL UNIQUE,   -- YYYY-MM-DD, 1 por dia (upsert limpo)
  peso_kg     REAL,
  gordura_pct REAL,
  cintura_cm  REAL,
  peito_cm    REAL,
  quadril_cm  REAL,
  braco_cm    REAL,
  coxa_cm     REAL,
  foto_uri    TEXT,
  criado_em   INTEGER NOT NULL
);

-- Metas versionadas: cutting vira bulking e a meta antiga continua valendo
-- para o histórico daquele período.
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  valid_from TEXT    NOT NULL,
  kcal       INTEGER NOT NULL,
  proteina_g INTEGER NOT NULL,
  carbo_g    INTEGER NOT NULL,
  gordura_g  INTEGER NOT NULL,
  origem     TEXT    NOT NULL DEFAULT 'auto'
);

-- ─────────────────────────── TREINO ───────────────────────────

CREATE TABLE IF NOT EXISTS exercises (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT    NOT NULL,
  grupo_primario     TEXT    NOT NULL,
  grupos_secundarios TEXT    NOT NULL DEFAULT '',  -- CSV
  equipamento        TEXT,
  -- Define COMO logar: prancha não tem reps, corrida não tem peso.
  tipo_carga         TEXT    NOT NULL DEFAULT 'peso_reps',
  media_url          TEXT,
  instrucoes         TEXT,                          -- passos separados por |
  dica               TEXT,
  is_custom          INTEGER NOT NULL DEFAULT 0,
  favorito           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_ex_grupo ON exercises (grupo_primario);

CREATE TABLE IF NOT EXISTS routines (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  descricao TEXT,
  ativa     INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_days (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  nome       TEXT    NOT NULL,          -- "A — Peito e Tríceps"
  cor        TEXT,
  ordem      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_rd_routine ON routine_days (routine_id, ordem);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id    INTEGER NOT NULL REFERENCES exercises(id),
  ordem          INTEGER NOT NULL DEFAULT 0,
  series_alvo    INTEGER NOT NULL DEFAULT 3,
  reps_min       INTEGER DEFAULT 8,
  reps_max       INTEGER DEFAULT 12,   -- faixa, não número fixo
  descanso_seg   INTEGER NOT NULL DEFAULT 90,
  superset_grupo INTEGER,              -- mesmo número = bi-set
  observacao     TEXT
);
CREATE INDEX IF NOT EXISTS ix_re_day ON routine_exercises (routine_day_id, ordem);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_day_id  INTEGER REFERENCES routine_days(id) ON DELETE SET NULL,
  nome            TEXT    NOT NULL,
  iniciado_em     INTEGER NOT NULL,
  finalizado_em   INTEGER,             -- NULL = em andamento
  volume_total_kg REAL    NOT NULL DEFAULT 0,
  sensacao        INTEGER,             -- 1..5
  notas           TEXT
);
CREATE INDEX IF NOT EXISTS ix_ws_data ON workout_sessions (iniciado_em DESC);

-- Tabela que mais cresce. O índice abaixo é o app inteiro.
CREATE TABLE IF NOT EXISTS set_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id     INTEGER NOT NULL REFERENCES exercises(id),
  ordem_exercicio INTEGER NOT NULL DEFAULT 0,
  serie_index     INTEGER NOT NULL,
  peso_kg         REAL,                -- SEMPRE kg no banco; lb só na tela
  reps            INTEGER,
  duracao_seg     INTEGER,
  distancia_m     REAL,
  rpe             REAL,
  tipo            TEXT    NOT NULL DEFAULT 'normal',  -- normal|aquecimento|drop|falha
  concluida       INTEGER NOT NULL DEFAULT 1,
  registrado_em   INTEGER NOT NULL
);
-- "Quanto levantei da última vez?" e a detecção de PR saem daqui.
CREATE INDEX IF NOT EXISTS ix_sl_hist ON set_logs (exercise_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS ix_sl_sess ON set_logs (session_id);

CREATE TABLE IF NOT EXISTS personal_records (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id    INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  tipo           TEXT    NOT NULL,    -- carga_max|reps_max|volume_serie|e1rm
  valor          REAL    NOT NULL,
  valor_anterior REAL,                -- alimenta o "+2,5 kg desde o último!"
  peso_kg        REAL,
  reps           INTEGER,
  set_log_id     INTEGER REFERENCES set_logs(id) ON DELETE CASCADE,
  session_id     INTEGER REFERENCES workout_sessions(id) ON DELETE CASCADE,
  atingido_em    INTEGER NOT NULL,
  celebrado      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_pr_ex ON personal_records (exercise_id, tipo, valor DESC);

-- ─────────────────────────── NUTRIÇÃO ───────────────────────────

CREATE TABLE IF NOT EXISTS foods (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL,
  marca         TEXT,
  fonte         TEXT NOT NULL DEFAULT 'taco',
  barcode       TEXT,
  porcao_base_g REAL NOT NULL DEFAULT 100,
  kcal          REAL NOT NULL,
  proteina_g    REAL NOT NULL,
  carbo_g       REAL NOT NULL,
  gordura_g     REAL NOT NULL,
  fibra_g       REAL,
  categoria     TEXT,                -- agrupa a lista de compras por corredor
  medida_caseira TEXT,               -- "1 colher de sopa"
  g_por_medida  REAL                 -- sem isto a lista de compras soma errado
);
CREATE INDEX IF NOT EXISTS ix_food_nome ON foods (nome);

CREATE TABLE IF NOT EXISTS recipes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT    NOT NULL,
  rendimento_porcoes REAL    NOT NULL DEFAULT 1,
  tempo_preparo_min  INTEGER,
  dificuldade        INTEGER DEFAULT 1,   -- 1..3
  foto_uri           TEXT,
  is_custom          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id    INTEGER NOT NULL REFERENCES foods(id),
  quantidade REAL    NOT NULL,
  unidade    TEXT    NOT NULL DEFAULT 'g',
  observacao TEXT
);
CREATE INDEX IF NOT EXISTS ix_ri_recipe ON recipe_ingredients (recipe_id);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ordem     INTEGER NOT NULL,
  texto     TEXT    NOT NULL,
  tempo_seg INTEGER                       -- vira timer dentro do passo
);
CREATE INDEX IF NOT EXISTS ix_rs_recipe ON recipe_steps (recipe_id, ordem);

CREATE TABLE IF NOT EXISTS diet_plans (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT    NOT NULL,
  ativo  INTEGER NOT NULL DEFAULT 1,
  inicio TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_meals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  diet_plan_id INTEGER NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL,      -- 0=domingo
  tipo         TEXT    NOT NULL,      -- cafe|lanche_manha|almoco|lanche_tarde|jantar|ceia
  horario      TEXT
);
CREATE INDEX IF NOT EXISTS ix_pm_plan ON plan_meals (diet_plan_id, dia_semana);

CREATE TABLE IF NOT EXISTS plan_meal_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_meal_id INTEGER NOT NULL REFERENCES plan_meals(id) ON DELETE CASCADE,
  recipe_id    INTEGER REFERENCES recipes(id),
  food_id      INTEGER REFERENCES foods(id),
  quantidade   REAL    NOT NULL,
  unidade      TEXT    NOT NULL DEFAULT 'g',
  CHECK ((recipe_id IS NULL) <> (food_id IS NULL))   -- exatamente um dos dois
);
CREATE INDEX IF NOT EXISTS ix_pmi_meal ON plan_meal_items (plan_meal_id);

CREATE TABLE IF NOT EXISTS meal_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL,     -- YYYY-MM-DD
  tipo          TEXT    NOT NULL,
  plan_meal_id  INTEGER REFERENCES plan_meals(id) ON DELETE SET NULL,
  registrado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ml_data ON meal_logs (data);

CREATE TABLE IF NOT EXISTS meal_log_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_log_id INTEGER NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
  food_id     INTEGER REFERENCES foods(id),
  recipe_id   INTEGER REFERENCES recipes(id),
  nome_snap   TEXT NOT NULL,
  quantidade  REAL NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'g',
  -- Snapshot: corrigir a tabela nutricional amanhã não pode reescrever o que
  -- você comeu ontem.
  kcal_snap   REAL NOT NULL,
  prot_snap   REAL NOT NULL,
  carb_snap   REAL NOT NULL,
  gord_snap   REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mli_log ON meal_log_items (meal_log_id);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  diet_plan_id   INTEGER REFERENCES diet_plans(id) ON DELETE SET NULL,
  periodo_inicio TEXT NOT NULL,
  periodo_fim    TEXT NOT NULL,
  gerada_em      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  lista_id         INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  food_id          INTEGER REFERENCES foods(id),
  nome             TEXT    NOT NULL,
  quantidade_total REAL    NOT NULL,
  unidade          TEXT    NOT NULL,
  categoria        TEXT,
  comprado         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_sli_lista ON shopping_list_items (lista_id);

-- ─────────────────────────── GAMIFICAÇÃO ───────────────────────────

-- Critério em JSON: dá pra criar medalha nova sem tocar em código de tela.
CREATE TABLE IF NOT EXISTS achievement_defs (
  code      TEXT PRIMARY KEY,
  nome      TEXT NOT NULL,
  descricao TEXT NOT NULL,
  icone     TEXT NOT NULL,
  tier      TEXT NOT NULL,          -- bronze|prata|ouro|diamante
  pontos    INTEGER NOT NULL DEFAULT 10,
  criterio  TEXT NOT NULL           -- {"tipo":"treinos_total","meta":50}
);

CREATE TABLE IF NOT EXISTS user_achievements (
  code            TEXT PRIMARY KEY REFERENCES achievement_defs(code) ON DELETE CASCADE,
  progresso       INTEGER NOT NULL DEFAULT 0,   -- "37/50" motiva mais que "0/1"
  meta            INTEGER NOT NULL,
  desbloqueado_em INTEGER,
  celebrado       INTEGER NOT NULL DEFAULT 0
);

-- Ledger append-only. Guardar só o saldo é como fica dessincronizado e sem
-- volta; assim o total é sempre SUM() e sempre recalculável.
CREATE TABLE IF NOT EXISTS point_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pontos    INTEGER NOT NULL,
  origem    TEXT    NOT NULL,   -- treino|pr|dieta|streak|medalha|medida
  origem_id INTEGER,
  descricao TEXT,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pe_data ON point_events (criado_em DESC);

CREATE TABLE IF NOT EXISTS user_stats (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  xp_total            INTEGER NOT NULL DEFAULT 0,
  nivel               INTEGER NOT NULL DEFAULT 1,
  streak_atual        INTEGER NOT NULL DEFAULT 0,
  maior_streak        INTEGER NOT NULL DEFAULT 0,
  ultima_atividade    TEXT,
  freezes_disponiveis INTEGER NOT NULL DEFAULT 2   -- perdoa 1 dia; retém muito
);
`;
