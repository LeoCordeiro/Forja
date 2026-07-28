import * as SQLite from 'expo-sqlite';
import { DDL, SCHEMA_VERSION } from './schema';
import { MIGRACOES } from './migracoes';
import { seedIfEmpty } from './seed';
import { normalizar } from './normalizar';

let dbRef: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre (uma vez) o banco, aplica o DDL e roda o seed inicial.
 * O DDL é todo `CREATE ... IF NOT EXISTS`, então reaplicar é inofensivo —
 * e `user_version` guarda o ponto para migrações futuras.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbRef) return Promise.resolve(dbRef);
  if (opening) return opening;

  opening = (async () => {
    const db = await SQLite.openDatabaseAsync('forja.db');
    await db.execAsync(DDL);

    await aplicarMigracoes(db);
    await seedIfEmpty(db);
    // Regras que dependem de listas em código (classificação de exercício e
    // descanso derivado dela). Idempotente, roda a cada abertura.
    await normalizar(db);
    dbRef = db;
    return db;
  })();

  return opening;
}

/**
 * Aplica os degraus pendentes de migração.
 *
 * Separado de `getDb` porque o reset de dados precisa exatamente disto: o DDL
 * cria só o esquema base, e tudo que nasceu em migração — água, passos,
 * check-in, fotos de progresso e dezenas de colunas do perfil — só existe se
 * este laço rodar.
 */
async function aplicarMigracoes(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const atual = row?.user_version ?? 0;

  for (const m of MIGRACOES) {
    if (m.versao <= atual) continue;
      // Comando a comando: um ALTER TABLE de coluna que já existe (banco criado
      // pelo DDL novo) não pode derrubar o resto da migração.
      // Comentários saem ANTES de dividir por ';'. Um ponto e vírgula dentro de
      // comentário — `data:image/jpeg;base64` foi o caso real — partia o comando
      // ao meio e derrubava a criação da tabela, enquanto o user_version subia
      // do mesmo jeito. Resultado: migração marcada como aplicada e tabela
      // inexistente, sem jeito de rodar de novo.
      const limpo = m.sql
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n');

      for (const cmd of limpo.split(';')) {
        const sql = cmd.trim();
        if (!sql) continue;
        try {
          await db.execAsync(sql);
        } catch (e) {
          const msg = String(e);
          if (!/duplicate column|already exists/i.test(msg)) {
            console.warn('[migração]', m.versao, sql.slice(0, 60), msg);
          }
        }
      }
    await db.execAsync(`PRAGMA user_version = ${m.versao}`);
  }

  if (atual < SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

export async function all<T>(sql: string, params: SQLite.SQLiteBindValue[] = []): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

export async function first<T>(
  sql: string,
  params: SQLite.SQLiteBindValue[] = []
): Promise<T | null> {
  const db = await getDb();
  return db.getFirstAsync<T>(sql, params);
}

/** Retorna o id inserido — usado em quase todo fluxo de criação. */
export async function run(
  sql: string,
  params: SQLite.SQLiteBindValue[] = []
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(sql, params);
  return res.lastInsertRowId;
}

export async function tx(fn: (db: SQLite.SQLiteDatabase) => Promise<void>) {
  const db = await getDb();
  await db.withTransactionAsync(async () => fn(db));
}

/**
 * Apaga tudo e reconstrói o banco do zero.
 *
 * ── O bug que isto conserta ──────────────────────────────────────────────
 *
 * A versão anterior dropava as tabelas, reaplicava o DDL e parava aí. Só que
 * `user_version` é pragma do BANCO, não da tabela: ele sobrevive ao DROP TABLE
 * e continuava marcando a última versão aplicada. Nenhuma migração rodava de
 * novo, e tudo que nasce em migração deixava de existir — água, passos,
 * check-in, notas de exercício, fotos de progresso, e as dezenas de colunas do
 * perfil, de `experiencia` a `local_treino`.
 *
 * O app não quebrava no clique. Quebrava no passo seguinte, quando o
 * questionário tentava gravar numa coluna que tinha sumido — e é por isso que
 * parecia "o botão não faz nada".
 *
 * Zerar `user_version` e rodar as migrações de novo é o que torna o reset um
 * reset de verdade.
 */
export async function resetDb() {
  const db = await getDb();
  const tabelas = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );
  await db.execAsync('PRAGMA foreign_keys = OFF');
  for (const t of tabelas) await db.execAsync(`DROP TABLE IF EXISTS "${t.name}"`);
  await db.execAsync('PRAGMA foreign_keys = ON');

  await db.execAsync(DDL);
  // Sem isto o banco nasce com o esquema da v1 se achando na última versão.
  await db.execAsync('PRAGMA user_version = 0');
  await aplicarMigracoes(db);

  await seedIfEmpty(db);
  await normalizar(db);
  limparArmazenamentoLocal();
}

/**
 * O que não está no SQLite também precisa sair.
 *
 * Data do último backup, prazo do descanso em andamento e credenciais da liga
 * ficam no armazenamento do navegador. Apagar só o banco deixava o app dizendo
 * "backup feito há 3 dias" num aparelho sem nenhum dado.
 */
function limparArmazenamentoLocal() {
  try {
    const armazem = (globalThis as { localStorage?: Storage }).localStorage;
    if (!armazem) return;
    const chaves: string[] = [];
    for (let i = 0; i < armazem.length; i++) {
      const k = armazem.key(i);
      if (k?.startsWith('forja.')) chaves.push(k);
    }
    for (const k of chaves) armazem.removeItem(k);
  } catch {
    /* sem localStorage (nativo): nada a limpar */
  }
}
