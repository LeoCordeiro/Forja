import type * as SQLite from 'expo-sqlite';
import { EXERCICIOS, MEDIA_BASE } from './exercicios';
import { ALIMENTOS, RECEITAS, type SeedReceita } from './alimentos';
import { RECEITAS_FIT } from './receitas-fit';
import { CONQUISTAS, ROTINAS_PADRAO } from './conquistas';

/**
 * Popula o banco na primeira abertura. Idempotente: se já tem exercício
 * cadastrado, não faz nada. Tudo numa transação só — ou entra completo, ou
 * não entra nada.
 */
export async function seedIfEmpty(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
  if ((row?.n ?? 0) > 0) return;

  const agora = Date.now();

  await db.withTransactionAsync(async () => {
    // ── Exercícios ────────────────────────────────────────────────────────
    for (const [nome, grupo, sec, equip, carga, slug, instr, dica] of EXERCICIOS) {
      await db.runAsync(
        `INSERT INTO exercises
           (nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga,
            media_url, instrucoes, dica)
         VALUES (?,?,?,?,?,?,?,?)`,
        [nome, grupo, sec, equip, carga, slug ? `${MEDIA_BASE}/${slug}` : null, instr, dica]
      );
    }

    // ── Alimentos ─────────────────────────────────────────────────────────
    for (const [nome, cat, kcal, p, c, g, fib, medida, gPor] of ALIMENTOS) {
      await db.runAsync(
        `INSERT INTO foods
           (nome, fonte, kcal, proteina_g, carbo_g, gordura_g, fibra_g,
            categoria, medida_caseira, g_por_medida)
         VALUES (?,'taco',?,?,?,?,?,?,?,?)`,
        [nome, kcal, p, c, g, fib, cat, medida, gPor]
      );
    }

    // ── Receitas ──────────────────────────────────────────────────────────
    const foodIds = new Map<string, number>();
    const foods = await db.getAllAsync<{ id: number; nome: string }>(
      'SELECT id, nome FROM foods'
    );
    for (const f of foods) foodIds.set(f.nome, f.id);

    // As receitas fit entram junto com as básicas; as tags alimentam o filtro
    // por preferência alimentar no cardápio.
    const todasReceitas: (SeedReceita & { tags?: string[]; viral?: string })[] = [
      ...RECEITAS,
      ...RECEITAS_FIT,
    ];

    for (const r of todasReceitas) {
      const res = await db.runAsync(
        `INSERT INTO recipes (nome, rendimento_porcoes, tempo_preparo_min, dificuldade, tags, observacao)
         VALUES (?,?,?,?,?,?)`,
        [
          r.nome,
          r.porcoes,
          r.tempoMin,
          r.dificuldade,
          (r.tags ?? []).join(','),
          r.viral ?? null,
        ]
      );
      const rid = res.lastInsertRowId;

      for (const [alimento, qtd, un] of r.ingredientes) {
        const fid = foodIds.get(alimento);
        if (!fid) continue; // ingrediente sem alimento cadastrado: ignora, não quebra
        await db.runAsync(
          `INSERT INTO recipe_ingredients (recipe_id, food_id, quantidade, unidade)
           VALUES (?,?,?,?)`,
          [rid, fid, qtd, un]
        );
      }

      for (let i = 0; i < r.passos.length; i++) {
        const [texto, tempo] = r.passos[i];
        await db.runAsync(
          `INSERT INTO recipe_steps (recipe_id, ordem, texto, tempo_seg) VALUES (?,?,?,?)`,
          [rid, i, texto, tempo]
        );
      }
    }

    // ── Conquistas ────────────────────────────────────────────────────────
    for (const [code, nome, desc, icone, tier, pontos, criterio] of CONQUISTAS) {
      const crit = JSON.stringify(criterio);
      await db.runAsync(
        `INSERT INTO achievement_defs (code, nome, descricao, icone, tier, pontos, criterio)
         VALUES (?,?,?,?,?,?,?)`,
        [code, nome, desc, icone, tier, pontos, crit]
      );
      await db.runAsync(
        `INSERT INTO user_achievements (code, progresso, meta) VALUES (?,0,?)`,
        [code, (criterio as { meta: number }).meta]
      );
    }

    // ── Rotinas prontas ───────────────────────────────────────────────────
    const exIds = new Map<string, number>();
    const exs = await db.getAllAsync<{ id: number; nome: string }>(
      'SELECT id, nome FROM exercises'
    );
    for (const e of exs) exIds.set(e.nome, e.id);

    for (const rot of ROTINAS_PADRAO) {
      const rres = await db.runAsync(
        `INSERT INTO routines (nome, descricao, ativa, criado_em) VALUES (?,?,1,?)`,
        [rot.nome, rot.descricao, agora]
      );
      const routineId = rres.lastInsertRowId;

      for (let d = 0; d < rot.dias.length; d++) {
        const dia = rot.dias[d];
        const dres = await db.runAsync(
          `INSERT INTO routine_days (routine_id, nome, cor, ordem) VALUES (?,?,?,?)`,
          [routineId, dia.nome, dia.cor, d]
        );
        const dayId = dres.lastInsertRowId;

        for (let i = 0; i < dia.exercicios.length; i++) {
          const [nomeEx, series, rmin, rmax, descanso] = dia.exercicios[i] as [
            string,
            number,
            number,
            number,
            number,
          ];
          const eid = exIds.get(nomeEx);
          if (!eid) continue;
          await db.runAsync(
            `INSERT INTO routine_exercises
               (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg)
             VALUES (?,?,?,?,?,?,?)`,
            [dayId, eid, i, series, rmin || null, rmax || null, descanso]
          );
        }
      }
    }

    // ── Estado inicial de gamificação ─────────────────────────────────────
    await db.runAsync(
      `INSERT OR IGNORE INTO user_stats (id, xp_total, nivel) VALUES (1, 0, 1)`
    );
  });
}
