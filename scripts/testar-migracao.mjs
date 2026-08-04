/**
 * Reproduz, contra um SQLite de verdade, o estado em que o iPhone travou.
 *
 *   Error code 1: table foods has no column named custo_100g
 *
 * O caminho até ali: o "apagar dados" antigo dropava as tabelas e reaplicava o
 * DDL, mas `user_version` é pragma do BANCO e sobrevive ao DROP TABLE. O banco
 * voltava ao esquema base ainda jurando estar na v13, nenhuma migração rodava
 * de novo e o seed tentava gravar numa coluna criada na v3.
 *
 *   npx tsx scripts/testar-migracao.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { DDL } from '../src/db/schema.ts';
import { MIGRACOES } from '../src/db/migracoes.ts';
import { aplicarMigracoes, marcaConfere } from '../src/db/migrar.ts';
import { normalizar } from '../src/db/normalizar.ts';
import { EXERCICIOS } from '../src/db/seed/exercicios.ts';

const ULTIMA = Math.max(...MIGRACOES.map((m) => m.versao));

const adaptar = (db) => ({
  execAsync: async (sql) => void db.exec(sql),
  getFirstAsync: async (sql, ps = []) => db.prepare(sql).get(...ps) ?? null,
  getAllAsync: async (sql, ps = []) => db.prepare(sql).all(...ps),
  runAsync: async (sql, ps = []) => db.prepare(sql).run(...ps),
});

const versao = (db) => db.prepare('PRAGMA user_version').get().user_version;
const colunas = (db, t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);

let falhas = 0;
function conferir(nome, ok, detalhe = '') {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
}

/** O INSERT exato do seed que estourava no aparelho do usuário. */
function inserirAlimento(db) {
  db.prepare(
    `INSERT INTO foods
       (nome, fonte, kcal, proteina_g, carbo_g, gordura_g, fibra_g,
        categoria, medida_caseira, g_por_medida, custo_100g)
     VALUES (?,'taco',?,?,?,?,?,?,?,?,?)`
  ).run('Frango', 165, 31, 0, 3.6, 0, 'proteina', '1 filé', 120, 2.5);
}

// ── 1. Banco novo ──────────────────────────────────────────────────────────
console.log('\n1. Banco novo');
const novo = new DatabaseSync(':memory:');
novo.exec(DDL);
await aplicarMigracoes(adaptar(novo));

conferir('chega na última versão', versao(novo) === ULTIMA, `user_version=${versao(novo)}`);
conferir('foods.custo_100g existe', colunas(novo, 'foods').includes('custo_100g'));
conferir('workout_sessions.manual existe', colunas(novo, 'workout_sessions').includes('manual'));
conferir('fotos_progresso existe', colunas(novo, 'fotos_progresso').length > 0);
conferir('profile.local_treino existe', colunas(novo, 'profile').includes('local_treino'));
conferir(
  'substituicoes.routine_exercise_id existe',
  colunas(novo, 'substituicoes').includes('routine_exercise_id')
);

// ── 2. Abrir de novo não deve refazer nada ─────────────────────────────────
console.log('\n2. Reabertura de banco saudável');
conferir('a marca confere', await marcaConfere(adaptar(novo), ULTIMA));
await aplicarMigracoes(adaptar(novo));
conferir('continua na última versão', versao(novo) === ULTIMA, `user_version=${versao(novo)}`);

// ── 3. O estado do iPhone ──────────────────────────────────────────────────
console.log('\n3. Banco estragado pelo reset antigo (o caso do iPhone)');
const quebrado = new DatabaseSync(':memory:');
quebrado.exec(DDL);
await aplicarMigracoes(adaptar(quebrado));

// O reset antigo, passo a passo: dropa tudo, reaplica o DDL, NÃO zera a marca.
quebrado.exec('PRAGMA foreign_keys = OFF');
for (const t of quebrado
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  .all()) {
  quebrado.exec(`DROP TABLE IF EXISTS "${t.name}"`);
}
quebrado.exec('PRAGMA foreign_keys = ON');
quebrado.exec(DDL);

conferir(
  'reproduziu o estrago: diz v13 e não tem a coluna',
  versao(quebrado) === ULTIMA && !colunas(quebrado, 'foods').includes('custo_100g')
);

let erroAntes = null;
try {
  inserirAlimento(quebrado);
} catch (e) {
  erroAntes = String(e);
}
conferir(
  'o seed estoura com a mensagem do print',
  /no column named custo_100g/.test(erroAntes ?? ''),
  erroAntes?.split('\n')[0]
);

conferir('a marca é detectada como mentirosa', !(await marcaConfere(adaptar(quebrado), ULTIMA)));

await aplicarMigracoes(adaptar(quebrado));

conferir('curou: foods.custo_100g voltou', colunas(quebrado, 'foods').includes('custo_100g'));
conferir(
  'curou: workout_sessions.manual voltou',
  colunas(quebrado, 'workout_sessions').includes('manual')
);
conferir('curou: fotos_progresso voltou', colunas(quebrado, 'fotos_progresso').length > 0);
conferir(
  'curou: substituicoes.routine_exercise_id voltou',
  colunas(quebrado, 'substituicoes').includes('routine_exercise_id')
);
conferir('voltou à última versão', versao(quebrado) === ULTIMA, `user_version=${versao(quebrado)}`);

let erroDepois = null;
try {
  inserirAlimento(quebrado);
} catch (e) {
  erroDepois = String(e);
}
conferir('o seed agora passa', erroDepois === null, erroDepois ?? '');

// ── 4. Só a tabela sumida também é estrago ─────────────────────────────────
console.log('\n4. Tabela criada por migração some sozinha');
const semTabela = new DatabaseSync(':memory:');
semTabela.exec(DDL);
await aplicarMigracoes(adaptar(semTabela));
semTabela.exec('DROP TABLE fotos_progresso');
conferir('detecta tabela faltando', !(await marcaConfere(adaptar(semTabela), ULTIMA)));
await aplicarMigracoes(adaptar(semTabela));
conferir('recriou a tabela', colunas(semTabela, 'fotos_progresso').length > 0);

// ── 5. Exercício novo chega em banco que já existe ─────────────────────────
//
// `seedIfEmpty` só roda em banco vazio, então todo exercício acrescentado
// depois do primeiro uso ficaria invisível para quem já tem o app instalado —
// ou seja, para todo mundo que usa. É `normalizar` que fecha esse buraco.
console.log('\n5. Catálogo cresce em banco já usado');
const antigo = new DatabaseSync(':memory:');
antigo.exec(DDL);
await aplicarMigracoes(adaptar(antigo));

// Simula o aparelho de quem instalou antes: só os 74 primeiros exercícios.
const inserir = antigo.prepare(
  `INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga)
   VALUES (?,?,?,?,?)`
);
for (const [nome, grupo, sec, equip, carga] of EXERCICIOS.slice(0, 74))
  inserir.run(nome, grupo, sec, equip, carga);

const conta = () => antigo.prepare('SELECT COUNT(*) AS n FROM exercises').get().n;
conferir('parte de um catálogo antigo', conta() === 74, `${conta()} exercícios`);

await normalizar(adaptar(antigo));
conferir('completou até o catálogo atual', conta() === EXERCICIOS.length,
  `${conta()} de ${EXERCICIOS.length}`);

const nomes = antigo.prepare('SELECT nome FROM exercises').all().map((e) => e.nome);
conferir('sem duplicata', new Set(nomes).size === nomes.length,
  `${nomes.length - new Set(nomes).size} repetido(s)`);
conferir('trouxe os de perna sem equipamento',
  ['Ponte de glúteo', 'Agachamento livre sem peso', 'Flexão nórdica'].every((n) => nomes.includes(n)));

// Cardio fica de fora: não tem descanso entre séries para definir.
const semDescanso = antigo
  .prepare(
    `SELECT nome FROM exercises
      WHERE grupo_primario <> 'cardio'
        AND (descanso_padrao IS NULL OR descanso_padrao = 0)`
  )
  .all();
conferir('exercício novo nasceu com descanso definido', semDescanso.length === 0,
  semDescanso.map((e) => e.nome).join(', '));

await normalizar(adaptar(antigo));
conferir('rodar de novo não duplica nada', conta() === EXERCICIOS.length, `${conta()}`);

// ── 6. Exercício renomeado: e quem já está com o banco montado? ────────────
//
// "Crossover na polia baixa" tinha nome de crucifixo e demonstração de supino.
// Corrigir só o seed não conserta banco nenhum: `completarCatalogo` casa por
// NOME, então o nome novo entraria como linha nova e a errada ficaria do lado,
// com todo o histórico preso nela.
//
// A correção renomeia PELO ID. Este teste existe para provar as duas metades
// disso: o nome/imagem/texto mudam e `set_logs`, `personal_records` e
// `routine_exercises` continuam apontando para a mesma linha.
console.log('\n6. Exercício renomeado sem perder histórico');
const comHistorico = new DatabaseSync(':memory:');
comHistorico.exec(DDL);
await aplicarMigracoes(adaptar(comHistorico));

comHistorico
  .prepare(
    `INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga, media_url)
     VALUES ('Crossover na polia baixa','peito','ombro','cabo','peso_reps','.../Cable_Chest_Press')`
  )
  .run();
const exId = comHistorico.prepare(`SELECT id FROM exercises WHERE nome LIKE 'Crossover na polia baixa'`).get().id;

comHistorico.prepare(`INSERT INTO routines (nome, ativa, criado_em) VALUES ('Meu treino',1,0)`).run();
comHistorico.prepare(`INSERT INTO routine_days (routine_id, nome, ordem) VALUES (1,'A',0)`).run();
comHistorico
  .prepare(
    `INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, descanso_seg)
     VALUES (1,?,0,3,150)`
  )
  .run(exId);
comHistorico
  .prepare(`INSERT INTO workout_sessions (nome, iniciado_em) VALUES ('A — Peito e tríceps', 0)`)
  .run();
comHistorico
  .prepare(
    `INSERT INTO set_logs (session_id, exercise_id, serie_index, peso_kg, reps, registrado_em)
     VALUES (1,?,1,40,10,0)`
  )
  .run(exId);
comHistorico
  .prepare(
    `INSERT INTO personal_records (exercise_id, tipo, valor, atingido_em) VALUES (?,'carga_max',40,0)`
  )
  .run(exId);

await normalizar(adaptar(comHistorico));

const renomeado = comHistorico.prepare('SELECT * FROM exercises WHERE id = ?').get(exId);
conferir('o nome errado sumiu do catálogo',
  !comHistorico.prepare(`SELECT id FROM exercises WHERE nome = 'Crossover na polia baixa'`).get());
conferir('virou "Supino na polia" NA MESMA LINHA', renomeado.nome === 'Supino na polia',
  `id ${exId} → ${renomeado.nome}`);
conferir('a demonstração continua sendo a do supino na polia',
  (renomeado.media_url ?? '').includes('Cable_Chest_Press'));
conferir('o secundário virou tríceps (é um empurrão, não um crucifixo)',
  (renomeado.grupos_secundarios ?? '').includes('triceps'), renomeado.grupos_secundarios);

const histIntacto = (t) =>
  comHistorico.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE exercise_id = ?`).get(exId).n;
conferir('set_logs preservado', histIntacto('set_logs') === 1, `${histIntacto('set_logs')} série(s)`);
conferir('personal_records preservado', histIntacto('personal_records') === 1);
conferir('routine_exercises preservado', histIntacto('routine_exercises') === 1);
conferir('o catálogo não ganhou linha duplicada',
  comHistorico.prepare(`SELECT COUNT(*) AS n FROM exercises WHERE nome = 'Supino na polia'`).get().n === 1);

// Idempotente: a segunda abertura do banco não pode mexer em mais nada.
await normalizar(adaptar(comHistorico));
conferir('rodar de novo é inofensivo',
  comHistorico.prepare(`SELECT COUNT(*) AS n FROM exercises WHERE nome = 'Supino na polia'`).get().n === 1 &&
    histIntacto('set_logs') === 1);

// ── 7. v15 → v16: papel, RIR e aquecimento em banco JÁ USADO ───────────────
//
// A pergunta que toda migração desta base tem que responder é "e quem já está
// com o banco preenchido?". Aqui ela é literal: uma rotina criada antes da v16
// não tem papel nem RIR, e o histórico dela é o produto. O teste reproduz o
// banco preV16 de verdade — tabela sem as colunas novas, `user_version = 15` —
// e cobra as duas metades: as colunas passam a existir, e NADA do que já estava
// lá muda de valor.
console.log('\n7. v15 → v16 em banco já usado');
const preV16 = new DatabaseSync(':memory:');
preV16.exec(DDL);
await aplicarMigracoes(adaptar(preV16));

// Volta a tabela ao formato da v15 e remarca a versão — é o estado de quem
// instalou o app antes desta fase.
preV16.exec(`
  DROP TABLE routine_exercises;
  CREATE TABLE routine_exercises (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_day_id INTEGER NOT NULL,
    exercise_id    INTEGER NOT NULL,
    ordem          INTEGER NOT NULL DEFAULT 0,
    series_alvo    INTEGER NOT NULL DEFAULT 3,
    reps_min       INTEGER DEFAULT 8,
    reps_max       INTEGER DEFAULT 12,
    descanso_seg   INTEGER NOT NULL DEFAULT 90,
    superset_grupo INTEGER,
    observacao     TEXT,
    rpe_alvo       REAL,
    eh_composto    INTEGER NOT NULL DEFAULT 0
  );
  PRAGMA user_version = 15;
`);
preV16
  .prepare(
    `INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
     VALUES (1, 1, 0, 4, 8, 12, 150)`
  )
  .run();

conferir(
  'antes: a rotina não tem papel nem RIR',
  !colunas(preV16, 'routine_exercises').includes('papel'),
  colunas(preV16, 'routine_exercises').join(',')
);
// A marca precisa CONFERIR aqui: senão o teste passa pelo caminho da auto-cura
// (que refaz tudo do zero) e nunca exercita o degrau v15 → v16 de verdade.
conferir('a v15 é reconhecida como legítima', await marcaConfere(adaptar(preV16), 15));

await aplicarMigracoes(adaptar(preV16));

const colsDepois = colunas(preV16, 'routine_exercises');
for (const c of ['papel', 'rir_min', 'rir_max', 'aquecimento_series'])
  conferir(`routine_exercises.${c} existe`, colsDepois.includes(c));
conferir('chega na v16', versao(preV16) === ULTIMA, `user_version=${versao(preV16)}`);

const linhaVelha = preV16.prepare('SELECT * FROM routine_exercises WHERE id = 1').get();
conferir(
  'a linha antiga não foi reescrita',
  linhaVelha.series_alvo === 4 && linhaVelha.reps_min === 8 && linhaVelha.descanso_seg === 150,
  `${linhaVelha.series_alvo}×${linhaVelha.reps_min}-${linhaVelha.reps_max} @ ${linhaVelha.descanso_seg}s`
);
conferir(
  'papel e RIR nascem NULL, aquecimento em 0 — que é o que a rotina antiga É',
  linhaVelha.papel === null && linhaVelha.rir_min === null && linhaVelha.aquecimento_series === 0,
  `papel=${linhaVelha.papel} rir=${linhaVelha.rir_min} aq=${linhaVelha.aquecimento_series}`
);

await aplicarMigracoes(adaptar(preV16));
conferir(
  'aplicar de novo não duplica coluna nem apaga a linha',
  versao(preV16) === ULTIMA &&
    preV16.prepare('SELECT COUNT(*) AS n FROM routine_exercises').get().n === 1
);

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
