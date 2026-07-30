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



/**
 * v4 → v5.
 *
 * ATENÇÃO — a lição que gerou esta migração: **nunca acrescentar comando a uma
 * migração que já rodou.** Estes campos nasceram dentro do V4 depois que o V4
 * já tinha sido aplicado; como `user_version` já estava em 4, o degrau não roda
 * de novo e os comandos novos foram pulados em silêncio. O app só quebrou no
 * "no such table: passos_log", bem longe da causa.
 *
 * Comando novo = versão nova. Sempre.
 */
const V5 = `
-- Diagnóstico: o que incomoda, o que já fez parar, onde dói. Cada campo aqui
-- muda algo na prescrição — não existe pergunta guardada só para constar.
ALTER TABLE profile ADD COLUMN incomodo TEXT;
ALTER TABLE profile ADD COLUMN onde_acumula TEXT;
ALTER TABLE profile ADD COLUMN desistencia TEXT;
ALTER TABLE profile ADD COLUMN dores TEXT;
ALTER TABLE profile ADD COLUMN minutos_sessao INTEGER;
ALTER TABLE profile ADD COLUMN passos_alvo INTEGER;
ALTER TABLE profile ADD COLUMN cardio_sessoes INTEGER;

-- Passos do dia: a variável que mais move gasto diário sem cobrar recuperação.
CREATE TABLE IF NOT EXISTS passos_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT NOT NULL UNIQUE,
  passos    INTEGER NOT NULL,
  criado_em INTEGER NOT NULL
);

-- Check-in da liga. Grava aqui SEMPRE, sincroniza depois: sem sinal na
-- academia é o normal, e falhar em enviar não pode apagar o registro.
CREATE TABLE IF NOT EXISTS checkin_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL,
  tipo          TEXT    NOT NULL,
  pontos        INTEGER NOT NULL DEFAULT 0,
  duracao_min   INTEGER,
  volume_kg     REAL,
  sincronizado  INTEGER NOT NULL DEFAULT 0,
  criado_em     INTEGER NOT NULL,
  UNIQUE (data, tipo)
);
CREATE INDEX IF NOT EXISTS ix_checkin_data ON checkin_log (data DESC);
`;

/**
 * v5 → v6: notas de configuração do aparelho.
 *
 * "Banco no furo 3", "pino 7", "pegada na marca de fora". É o que o personal
 * anota no papel e o que se perde toda vez que a pessoa troca de academia ou
 * volta de férias — e sem isso a primeira série sai errada, ou pior, sai numa
 * altura que machuca.
 */
const V6 = `
CREATE TABLE IF NOT EXISTS notas_exercicio (
  exercise_id INTEGER PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
  nota        TEXT NOT NULL,
  atualizado_em INTEGER NOT NULL
);
`;

/**
 * v6 → v7: dia da semana de cada treino.
 *
 * "Treine 3x por semana" não é plano, é intenção — sem dia marcado a decisão
 * de treinar volta a ser tomada todo dia. Com dia marcado, o app também passa
 * a saber o que ficou pendente e consegue remanejar respeitando as ~48 h de
 * recuperação de cada grupo.
 */
const V7 = `
ALTER TABLE routine_days ADD COLUMN dia_semana INTEGER;
`;

/**
 * v7 → v8: tempo disponível por dia da semana e lembretes.
 *
 * Um número só ("60 min por sessão") não descreve a vida de ninguém: quem
 * treina no almoço tem 1 h cravada de segunda a sexta e 2 h no sábado. Sem
 * isso o app prescreve um treino que não cabe — e o que fica de fora é sempre
 * o final da sessão, onde estão os isoladores que a pessoa mais queria.
 */
const V8 = `
-- CSV de 7 números, domingo a sábado, em minutos.
ALTER TABLE profile ADD COLUMN minutos_por_dia TEXT;
ALTER TABLE profile ADD COLUMN lembretes_ativos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile ADD COLUMN lembrete_medida INTEGER NOT NULL DEFAULT 1;
`;

/**
 * v8 → v9: fotos de progresso.
 *
 * Para quem quer perder gordura E ganhar músculo ao mesmo tempo, a balança é o
 * pior instrumento possível: o peso pode ficar parado por meses enquanto a
 * cintura cai e o ombro cresce. Foto e fita métrica medem isso; a balança não.
 *
 * A imagem vai como data URI dentro do banco, não como caminho de arquivo. Um
 * caminho quebra sozinho — a pasta de cache do sistema é limpa quando o
 * armazenamento aperta, e é exatamente aí que a foto de 6 meses atrás some. O
 * que está no banco entra no backup e na restauração junto com o resto.
 *
 * Uma foto por ângulo por dia: refazer no mesmo dia substitui em vez de
 * empilhar quase-iguais.
 */
const V9 = `
CREATE TABLE IF NOT EXISTS fotos_progresso (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT    NOT NULL,             -- YYYY-MM-DD
  angulo    TEXT    NOT NULL,             -- frente|lado|costas
  imagem    TEXT    NOT NULL,             -- data URI JPEG em base64
  largura   INTEGER,
  altura    INTEGER,
  criado_em INTEGER NOT NULL,
  UNIQUE (data, angulo)
);
CREATE INDEX IF NOT EXISTS ix_fotos_data ON fotos_progresso (data DESC);
`;

/**
 * v9 → v10: conserto do degrau anterior.
 *
 * O V9 rodou quebrado em aparelho de teste: o executor dividia o SQL por ';' e
 * um ponto e vírgula dentro de um comentário partiu o CREATE TABLE ao meio. O
 * comando falhou, mas o `user_version` subiu para 9 do mesmo jeito — então a
 * tabela não existia e a migração nunca mais rodaria.
 *
 * O executor já foi corrigido (comentário sai antes da divisão). Este degrau
 * existe só para alcançar quem já subiu para a versão 9 sem a tabela: em banco
 * são, o IF NOT EXISTS não faz nada.
 *
 * A lição é a mesma que gerou o V5, por outro caminho: migração que falha em
 * silêncio é pior que migração que quebra na cara.
 */
const V10 = `
CREATE TABLE IF NOT EXISTS fotos_progresso (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT    NOT NULL,
  angulo    TEXT    NOT NULL,
  imagem    TEXT    NOT NULL,
  largura   INTEGER,
  altura    INTEGER,
  criado_em INTEGER NOT NULL,
  UNIQUE (data, angulo)
);
CREATE INDEX IF NOT EXISTS ix_fotos_data ON fotos_progresso (data DESC);
`;

/**
 * v10 → v11: o que faltava para o treino deixar de ser genérico.
 *
 * Até aqui a rotina era um modelo pronto igual para todo mundo — as respostas
 * do questionário ficavam guardadas sem mudar um exercício sequer. Estes três
 * campos são os que faltavam para gerar o treino de verdade:
 *
 * · **local_treino** decide o catálogo inteiro. Prescrever leg press para quem
 *   treina em casa com dois halteres não é treino, é lista de desejos.
 * · **dias_disponiveis** troca "3 vezes por semana" por segunda, quarta e
 *   sexta. Sem dia com nome, a decisão de treinar é retomada todo dia.
 * · **enfase** é o grupo que a pessoa quer priorizar. Não muda o volume mínimo
 *   de nenhum outro: acrescenta séries onde ela quer, dentro do teto útil.
 */
const V11 = `
ALTER TABLE profile ADD COLUMN local_treino TEXT NOT NULL DEFAULT 'academia';
ALTER TABLE profile ADD COLUMN dias_disponiveis TEXT;
ALTER TABLE profile ADD COLUMN enfase TEXT;
`;

/**
 * v11 → v12: uma rotina ativa por vez.
 *
 * O seed criava duas rotinas de exemplo, ambas marcadas como ativas — e a tela
 * de treino mostra os dias de TODA rotina ativa. O resultado era uma lista com
 * "A — Peito, Ombro e Tríceps" logo acima de "A — Corpo todo", de planos
 * diferentes, sem nada indicando que eram dois programas.
 *
 * Mantém a rotina com mais treinos registrados (é a que a pessoa está usando de
 * verdade) e desativa as outras. Nada é apagado: desativar preserva o histórico
 * e permite reativar pela tela de ajuste.
 */
const V12 = `
UPDATE routines SET ativa = 0
 WHERE ativa = 1
   AND id <> (
     SELECT r.id FROM routines r
      WHERE r.ativa = 1
      ORDER BY (
        SELECT COUNT(*) FROM workout_sessions ws
          JOIN routine_days rd ON rd.id = ws.routine_day_id
         WHERE rd.routine_id = r.id
      ) DESC, r.id ASC
      LIMIT 1
   );
`;

/**
 * v12 → v13: sessão marcada à mão.
 *
 * Nem todo treino passa pelo app. Academia sem sinal, celular sem bateria,
 * aula de spinning, jogo de futebol — e no dia seguinte o quadradinho da semana
 * está vazio contando uma história errada. Sem um jeito de marcar depois, a
 * constância que o app mostra é a constância de usar o app, não a de treinar.
 *
 * A sessão marcada à mão conta para frequência, sequência e check-in da liga,
 * mas fica de fora das estatísticas de volume e de recorde — ela não tem série
 * registrada, e misturar as duas coisas contaminaria justamente os números que
 * dependem de carga real.
 */
const V13 = `
ALTER TABLE workout_sessions ADD COLUMN manual INTEGER NOT NULL DEFAULT 0;
`;


/**
 * v13 → v14: quantas barras fixas a pessoa faz.
 *
 * ── Por que uma coluna só para isto ──────────────────────────────────────
 *
 * O app prescrevia barra fixa 4×5-8 para quem faz 3 repetições no máximo. Não é
 * treino difícil: é treino que não acontece. E como a barra fixa costuma ser o
 * primeiro exercício do dia de costas, a sessão inteira começava com uma falha —
 * a pessoa some do plano dela e conclui que o app não a conhece.
 *
 * Existe uma classe inteira de exercício com esse problema: barra fixa, mergulho
 * no paralelo, flexão nórdica, remada invertida. Neles a carga é o próprio
 * corpo, então não há como "usar menos peso" — ou você executa, ou não executa.
 * Todo o resto do catálogo se ajusta pela anilha; estes não.
 *
 * A barra fixa é a pergunta de triagem certa para o grupo de PUXAR porque é a
 * que mais gente esbarra e a que todo treinador pergunta. Guardar o número em
 * vez de um sim/não permite tratar "faço 3" diferente de "não faço nenhuma", que
 * são situações de treino diferentes: uma pede assistência, a outra pede
 * negativa.
 *
 * -1 significa "não perguntado" — diferente de 0, que é uma resposta.
 */
const V14 = `
ALTER TABLE profile ADD COLUMN barra_fixa_reps INTEGER NOT NULL DEFAULT -1;
`;

export const MIGRACOES: { versao: number; sql: string }[] = [
  { versao: 2, sql: V2 },
  { versao: 3, sql: V3 },
  { versao: 4, sql: V4 },
  { versao: 5, sql: V5 },
  { versao: 6, sql: V6 },
  { versao: 7, sql: V7 },
  { versao: 8, sql: V8 },
  { versao: 9, sql: V9 },
  { versao: 10, sql: V10 },
  { versao: 11, sql: V11 },
  { versao: 12, sql: V12 },
  { versao: 13, sql: V13 },
  { versao: 14, sql: V14 },
];
