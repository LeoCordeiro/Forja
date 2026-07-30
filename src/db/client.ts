import * as SQLite from 'expo-sqlite';
import { DDL } from './schema';
import { aplicarMigracoes } from './migrar';
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

  // Sem isto, uma falha na abertura vira permanente: `opening` fica sendo uma
  // promise rejeitada e TODA chamada seguinte recebe o mesmo erro, mesmo depois
  // do problema ter sido consertado. Zerar a referência permite tentar de novo.
  opening.catch(() => {
    opening = null;
  });

  return opening;
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

/**
 * Uma transação por vez: `withTransactionAsync` não se protege de chamadas
 * concorrentes — duas ao mesmo tempo viram BEGIN dentro de BEGIN (e a
 * variante exclusiva não existe no web). A fila serializa; o `then(exec,
 * exec)` roda a próxima mesmo quando a anterior rejeitou, senão a primeira
 * falha travaria toda gravação seguinte.
 */
let fila: Promise<unknown> = Promise.resolve();

export async function tx(fn: (db: SQLite.SQLiteDatabase) => Promise<void>) {
  const db = await getDb();
  const exec = () => db.withTransactionAsync(async () => fn(db));
  const p = fila.then(exec, exec);
  fila = p.catch(() => {});
  return p;
}

/**
 * Apaga tudo e reconstrói o banco do zero.
 *
 * O `PRAGMA user_version = 0` no meio não é enfeite: sem ele o banco nasce com
 * o esquema base se achando na última versão, nenhuma migração roda e tudo que
 * nasceu em migração deixa de existir. Ver `marcaConfere` para o estrago que
 * isso causou e como o app se cura sozinho.
 */
export async function resetDb() {
  // Não passa por `getDb`: o reset também é a saída de emergência de quando a
  // abertura falha, e aí `getDb` só devolveria o mesmo erro para sempre.
  const db = dbRef ?? (await SQLite.openDatabaseAsync('forja.db'));
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

  // O banco está bom de novo: quem chamou pode ser a tela de erro, e ela
  // precisa que a próxima chamada a `getDb` funcione sem recarregar o app.
  dbRef = db;
  opening = Promise.resolve(db);
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
