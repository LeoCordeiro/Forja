import type * as SQLite from 'expo-sqlite';
import { COMPOSTOS, COMPOSTOS_PESADOS, descansoCorreto } from '@/features/treino/classificacao';

/**
 * Normalização pós-migração.
 *
 * Roda toda abertura do banco e é idempotente. Serve para regras que dependem
 * de listas em código, e não de SQL — classificar exercícios e derivar o
 * descanso a partir dessa classificação.
 *
 * Existe porque descanso digitado à mão em cada rotina envelhece mal: o
 * catálogo tinha supino com 120 s e puxada com 90 s, abaixo do que a evidência
 * indica. Corrigir por regra conserta o que já está no aparelho de quem usa.
 */
export async function normalizar(db: SQLite.SQLiteDatabase) {
  await classificarExercicios(db);
  await corrigirDescansos(db);
}

async function classificarExercicios(db: SQLite.SQLiteDatabase) {
  const marcados = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM exercises WHERE eh_composto = 1'
  );
  if ((marcados?.n ?? 0) > 0) return; // já classificado

  for (const nome of COMPOSTOS) {
    await db.runAsync('UPDATE exercises SET eh_composto = 1 WHERE nome = ?', [nome]);
  }

  // Guarda o descanso ideal no próprio catálogo, para rotinas novas já nascerem
  // com o valor certo.
  const exs = await db.getAllAsync<{ id: number; nome: string; grupo_primario: string }>(
    'SELECT id, nome, grupo_primario FROM exercises'
  );
  for (const e of exs) {
    await db.runAsync('UPDATE exercises SET descanso_padrao = ? WHERE id = ?', [
      descansoCorreto(e.nome, 10, e.grupo_primario),
      e.id,
    ]);
  }
}

/**
 * Ajusta o descanso das rotinas já existentes.
 *
 * Só sobe, nunca desce: se a pessoa configurou 4 minutos de propósito, isso é
 * escolha dela. O que corrigimos é o valor curto demais herdado do catálogo.
 */
async function corrigirDescansos(db: SQLite.SQLiteDatabase) {
  const jaFeito = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = 'descansos_v3'`
  ).catch(() => null);
  if (jaFeito?.v) return;

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
  const flag = await db.getFirstAsync<{ v: string }>(
    `SELECT value AS v FROM app_flags WHERE key = 'descansos_v3'`
  );
  if (flag?.v) return;

  const linhas = await db.getAllAsync<{
    id: number;
    nome: string;
    grupo: string;
    reps_max: number | null;
    descanso_seg: number;
  }>(
    `SELECT re.id, e.nome, e.grupo_primario AS grupo, re.reps_max, re.descanso_seg
       FROM routine_exercises re
       JOIN exercises e ON e.id = re.exercise_id`
  );

  let ajustadas = 0;
  for (const l of linhas) {
    const ideal = descansoCorreto(l.nome, l.reps_max ?? 10, l.grupo);
    if (ideal > l.descanso_seg) {
      await db.runAsync('UPDATE routine_exercises SET descanso_seg = ? WHERE id = ?', [ideal, l.id]);
      ajustadas++;
    }
    // Marca composto na linha da rotina — a tela usa para explicar o descanso.
    await db.runAsync('UPDATE routine_exercises SET eh_composto = ? WHERE id = ?', [
      COMPOSTOS.includes(l.nome) ? 1 : 0,
      l.id,
    ]);
  }

  await db.runAsync(`INSERT OR REPLACE INTO app_flags (key, value) VALUES ('descansos_v3', ?)`, [
    String(ajustadas),
  ]);

  if (ajustadas > 0) {
    console.log(`[forja] descanso corrigido em ${ajustadas} exercício(s) das suas rotinas`);
  }
}

export { COMPOSTOS_PESADOS };
