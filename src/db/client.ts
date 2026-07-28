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

    await seedIfEmpty(db);
    // Regras que dependem de listas em código (classificação de exercício e
    // descanso derivado dela). Idempotente, roda a cada abertura.
    await normalizar(db);
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
