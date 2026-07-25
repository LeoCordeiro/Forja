import * as SQLite from 'expo-sqlite';
import { DDL, SCHEMA_VERSION } from './schema';
import { seedIfEmpty } from './seed';

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

    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const atual = row?.user_version ?? 0;
    if (atual < SCHEMA_VERSION) {
      // Migrações futuras entram aqui, em degraus de versão.
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }

    await seedIfEmpty(db);
    dbRef = db;
    return db;
  })();

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

export async function tx(fn: (db: SQLite.SQLiteDatabase) => Promise<void>) {
  const db = await getDb();
  await db.withTransactionAsync(async () => fn(db));
}

/** Só para desenvolvimento: zera tudo e reconstrói do seed. */
export async function resetDb() {
  const db = await getDb();
  const tabelas = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );
  await db.execAsync('PRAGMA foreign_keys = OFF');
  for (const t of tabelas) await db.execAsync(`DROP TABLE IF EXISTS "${t.name}"`);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync(DDL);
  await seedIfEmpty(db);
}
