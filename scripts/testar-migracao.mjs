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

// ── 8. Backfill: a rotina PRÉ-v16 ganha papel, RIR e o descanso novo ───────
//
// UNIDADE: a LINHA da rotina, dentro do DIA — porque papel é propriedade da
// sessão e não do exercício. É o que faz este backfill diferente de um UPDATE
// por linha: o mesmo supino é principal num dia e complementar noutro, e ler a
// linha isolada dá a resposta errada a partir do SEGUNDO exercício do grupo.
//
// G2 deixou a rotina anterior à v16 com `papel` NULL e o descanso na regra
// velha, de propósito: com papel NULL, o fallback trata TODO multiarticular
// como principal, e aplicar a regra nova assim daria descanso errado, não só
// diferente. Leonardo autorizou reescrever o plano dele. A forma certa de fazer
// isso não é soltar o fallback — é PREENCHER o papel pelo contexto do dia e só
// então deixar a regra nova rodar sobre um dado que existe.
//
// E quem já está com o banco estragado? Todo mundo que abrir o app: este passo
// roda em `normalizar`, a cada abertura, e é idempotente (só escreve onde
// `papel IS NULL`). Ele NÃO toca `set_logs`, `personal_records`, `point_events`
// nem `workout_sessions` — o histórico, os recordes e o XP saem de lá, e este
// backfill escreve só em `routine_exercises`. É o teste abaixo que prova isso.
console.log('\n8. Backfill de papel e RIR em rotina pré-v16');
const preenche = new DatabaseSync(':memory:');
preenche.exec(DDL);
await aplicarMigracoes(adaptar(preenche));

// Catálogo real, para o papel sair dos atributos de verdade.
const insExs = preenche.prepare(
  `INSERT INTO exercises (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga)
   VALUES (?,?,?,?,?)`
);
for (const [nome, grupo, sec, equip, carga] of EXERCICIOS)
  insExs.run(nome, grupo, sec, equip, carga);
const idDe = (n) => preenche.prepare('SELECT id FROM exercises WHERE nome = ?').get(n).id;

preenche.prepare(`INSERT INTO routines (nome, ativa, criado_em) VALUES ('Meu treino',1,0)`).run();
preenche.prepare(`INSERT INTO routine_days (routine_id, nome, ordem) VALUES (1,'A — Peito e tríceps',0)`).run();
preenche.prepare(`INSERT INTO routine_days (routine_id, nome, ordem) VALUES (1,'B — Costas e bíceps',1)`).run();

// O dia A na ordem em que o app o mostra. Dois supinos no mesmo grupo é o caso
// que o fallback errava: o segundo NÃO é principal.
const insRe = preenche.prepare(
  `INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
   VALUES (?,?,?,?,?,?,?)`
);
const DIA_A = [
  ['Supino reto com barra', 4, 8, 12, 150],
  ['Supino inclinado com halteres', 3, 8, 12, 120],
  ['Crucifixo com halteres', 3, 10, 15, 90],
  ['Tríceps na polia com corda', 3, 10, 15, 60],
];
DIA_A.forEach(([n, s, rmin, rmax, desc], i) => insRe.run(1, idDe(n), i, s, rmin, rmax, desc));
insRe.run(2, idDe('Puxada frontal na polia'), 0, 4, 8, 12, 150);
// Cardio na rotina: papel não se aplica, e o backfill não pode inventar um.
insRe.run(2, idDe('Esteira'), 1, 1, 0, 0, 0);

// Histórico REAL apontando para a rotina — é ele que não pode ser tocado.
preenche.prepare(`INSERT INTO workout_sessions (nome, iniciado_em) VALUES ('A — Peito e tríceps', 0)`).run();
preenche
  .prepare(
    `INSERT INTO set_logs (session_id, exercise_id, serie_index, peso_kg, reps, registrado_em)
     VALUES (1,?,1,60,10,0)`
  )
  .run(idDe('Supino reto com barra'));
preenche
  .prepare(`INSERT INTO personal_records (exercise_id, tipo, valor, atingido_em) VALUES (?,'carga_max',60,0)`)
  .run(idDe('Supino reto com barra'));
preenche.prepare(`INSERT INTO point_events (pontos, origem, criado_em) VALUES (10,'treino',0)`).run();

const antesDoBackfill = preenche
  .prepare(`SELECT id, papel, rir_min, descanso_seg FROM routine_exercises ORDER BY id`)
  .all();
conferir(
  'antes: nenhuma linha tem papel',
  antesDoBackfill.every((l) => l.papel === null),
  antesDoBackfill.map((l) => l.papel).join(',')
);

await normalizar(adaptar(preenche));

const linhas = preenche
  .prepare(
    `SELECT re.id, re.papel, re.rir_min, re.rir_max, re.descanso_seg, e.nome, e.grupo_primario AS grupo
       FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
      ORDER BY re.routine_day_id, re.ordem`
  )
  .all();
const porNome = Object.fromEntries(linhas.map((l) => [l.nome, l]));

conferir(
  'toda linha de força ganhou papel',
  linhas.filter((l) => l.grupo !== 'cardio').every((l) => !!l.papel),
  linhas.map((l) => `${l.nome}=${l.papel}`).join(' | ')
);
conferir(
  'o cardio continua SEM papel — a pergunta não existe ali',
  porNome['Esteira'].papel === null,
  String(porNome['Esteira'].papel)
);
// A régua que separa backfill certo de UPDATE por linha: o SEGUNDO supino do
// mesmo grupo não pode sair como principal. Era o erro do fallback.
conferir(
  'o 1º do grupo é principal e o 2º é complementar',
  porNome['Supino reto com barra'].papel === 'principal' &&
    porNome['Supino inclinado com halteres'].papel === 'complementar',
  `${porNome['Supino reto com barra'].papel} / ${porNome['Supino inclinado com halteres'].papel}`
);
conferir(
  'monoarticular vira isolador, e o último de estabilização baixa, finalizador',
  porNome['Crucifixo com halteres'].papel === 'isolador' &&
    porNome['Tríceps na polia com corda'].papel === 'finalizador',
  `${porNome['Crucifixo com halteres'].papel} / ${porNome['Tríceps na polia com corda'].papel}`
);
conferir(
  'RIR preenchido em toda linha de força',
  linhas.filter((l) => l.grupo !== 'cardio').every((l) => l.rir_min !== null && l.rir_max !== null),
  linhas.map((l) => `${l.nome}=${l.rir_min}-${l.rir_max}`).join(' | ')
);
// E só AGORA a regra nova de descanso vale, sobre um papel que existe: o
// principal de barra livre sobe para 180 s, o complementar para 150 s.
conferir(
  'o principal de barra livre passou a 180 s',
  porNome['Supino reto com barra'].descanso_seg === 180,
  `${porNome['Supino reto com barra'].descanso_seg}s`
);
conferir(
  'o complementar passou a 150 s',
  porNome['Supino inclinado com halteres'].descanso_seg === 150,
  `${porNome['Supino inclinado com halteres'].descanso_seg}s`
);
conferir(
  'o descanso do cardio continua 0',
  porNome['Esteira'].descanso_seg === 0,
  `${porNome['Esteira'].descanso_seg}s`
);

// O que NÃO pode ter sido tocado.
const conta1 = (t) => preenche.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
conferir('set_logs intacto', conta1('set_logs') === 1);
conferir('personal_records intacto', conta1('personal_records') === 1);
conferir('point_events intacto', conta1('point_events') === 1);
conferir('workout_sessions intacto', conta1('workout_sessions') === 1);
const serie = preenche.prepare('SELECT peso_kg, reps FROM set_logs WHERE id = 1').get();
conferir('a série gravada continua 60 kg × 10', serie.peso_kg === 60 && serie.reps === 10,
  `${serie.peso_kg}×${serie.reps}`);
conferir('nenhuma linha de rotina foi criada nem apagada', conta1('routine_exercises') === 6);

// Idempotência: a segunda abertura não muda mais nada.
const antesDaSegunda = JSON.stringify(
  preenche.prepare('SELECT id, papel, rir_min, rir_max, descanso_seg FROM routine_exercises ORDER BY id').all()
);
await normalizar(adaptar(preenche));
const depoisDaSegunda = JSON.stringify(
  preenche.prepare('SELECT id, papel, rir_min, rir_max, descanso_seg FROM routine_exercises ORDER BY id').all()
);
conferir('rodar de novo não muda uma vírgula', antesDaSegunda === depoisDaSegunda);

// Papel escolhido À MÃO pelo usuário não é sobrescrito: o backfill preenche o
// que está vazio, não corrige o que alguém decidiu.
preenche.prepare(`UPDATE routine_exercises SET papel = 'isolador' WHERE id = 1`).run();
await normalizar(adaptar(preenche));
conferir(
  'papel já gravado é respeitado',
  preenche.prepare('SELECT papel FROM routine_exercises WHERE id = 1').get().papel === 'isolador'
);

// ── 8b. Rotina ARQUIVADA não é reescrita ──────────────────────────────────
//
// UNIDADE: a ROTINA. "Refazer meu treino" arquiva a anterior com `ativa = 0` e
// nenhuma tela volta a lê-la — a do dia, o executor e a auditoria de volume
// filtram por `r.ativa = 1`. Escrever papel, RIR e descanso ali é trabalho que
// ninguém vê, num banco que depois de alguns meses tem meia dúzia de planos
// velhos. O histórico daquelas rotinas mora em `set_logs`, que este passo não
// toca de qualquer jeito.
console.log('\n8b. Backfill ignora rotina arquivada');
preenche.prepare(`INSERT INTO routines (nome, ativa, criado_em) VALUES ('Treino velho',0,0)`).run();
const rotVelha = preenche.prepare(`SELECT id FROM routines WHERE nome = 'Treino velho'`).get().id;
preenche
  .prepare(`INSERT INTO routine_days (routine_id, nome, ordem) VALUES (?, 'A — antigo', 0)`)
  .run(rotVelha);
const diaVelho = preenche.prepare(`SELECT id FROM routine_days WHERE routine_id = ?`).get(rotVelha).id;
preenche
  .prepare(
    `INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
     VALUES (?,?,0,4,8,12,120)`
  )
  .run(diaVelho, idDe('Supino reto com barra'));
// E uma linha NOVA sem papel na rotina ativa, para provar que o filtro não
// desligou o backfill inteiro.
preenche
  .prepare(
    `INSERT INTO routine_exercises (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
     VALUES (2,?,2,3,10,15,90)`
  )
  .run(idDe('Rosca direta com barra'));

await normalizar(adaptar(preenche));

const velha = preenche
  .prepare(`SELECT papel, rir_min, descanso_seg FROM routine_exercises WHERE routine_day_id = ?`)
  .get(diaVelho);
conferir(
  'a linha da rotina arquivada continua intocada',
  velha.papel === null && velha.rir_min === null && velha.descanso_seg === 120,
  `papel=${velha.papel} rir=${velha.rir_min} ${velha.descanso_seg}s`
);
const novaAtiva = preenche
  .prepare(
    `SELECT papel, rir_min FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
      WHERE e.nome = 'Rosca direta com barra'`
  )
  .get();
conferir(
  'e a linha nova da rotina ATIVA ganhou papel',
  !!novaAtiva.papel && novaAtiva.rir_min !== null,
  `papel=${novaAtiva.papel} rir=${novaAtiva.rir_min}`
);

// ── 8c. A flag da rodada anterior não fica órfã ───────────────────────────
//
// UNIDADE: a FLAG. `descansos_v3` não controla mais nada desde que a rodada
// subiu para v4, e flag órfã com nome de flag viva manda a próxima pessoa
// procurar quem a lê. É barato de limpar e caro de manter.
console.log('\n8c. Flags de descanso');
const flags = preenche.prepare(`SELECT key FROM app_flags`).all().map((f) => f.key);
conferir('a marca da rodada atual existe', flags.includes('descansos_v4'), flags.join(', '));
conferir('e a antiga foi embora', !flags.includes('descansos_v3'), flags.join(', '));

// ── 8d. Catálogo novo não devolve o descanso que o usuário baixou ─────────
//
// UNIDADE: a LINHA da rotina, ao longo do TEMPO. `completarCatalogo` apagava a
// marca de descanso toda vez que o catálogo crescia, e `corrigirDescansos` só
// SOBE — então quem tinha baixado um intervalo de propósito o recebia de volta
// no valor da regra, sem pedir. O DELETE nem tinha função: exercício novo entra
// em `exercises`, não na rotina de ninguém.
console.log('\n8d. Descanso baixado à mão sobrevive ao catálogo crescer');
preenche.prepare(`UPDATE routine_exercises SET descanso_seg = 60 WHERE id = 1`).run();
preenche.prepare(`DELETE FROM exercises WHERE nome = 'Rosca martelo'`).run();
await normalizar(adaptar(preenche));
conferir(
  'o catálogo voltou a ficar completo',
  preenche.prepare('SELECT COUNT(*) AS n FROM exercises').get().n === EXERCICIOS.length,
  `${preenche.prepare('SELECT COUNT(*) AS n FROM exercises').get().n} de ${EXERCICIOS.length}`
);
conferir(
  'e o descanso escolhido à mão continua 60 s',
  preenche.prepare('SELECT descanso_seg FROM routine_exercises WHERE id = 1').get().descanso_seg === 60,
  `${preenche.prepare('SELECT descanso_seg FROM routine_exercises WHERE id = 1').get().descanso_seg}s`
);

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
