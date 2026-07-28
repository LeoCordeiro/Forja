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

const ULTIMA = Math.max(...MIGRACOES.map((m) => m.versao));

const adaptar = (db) => ({
  execAsync: async (sql) => void db.exec(sql),
  getFirstAsync: async (sql) => db.prepare(sql).get() ?? null,
  getAllAsync: async (sql) => db.prepare(sql).all(),
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

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo passou\n');
process.exit(falhas ? 1 : 0);
