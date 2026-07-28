import type * as SQLite from 'expo-sqlite';
import { EXERCICIOS, MEDIA_BASE } from './exercicios';
import { ALIMENTOS, RECEITAS, type SeedReceita } from './alimentos';
import { RECEITAS_FIT } from './receitas-fit';
import { CUSTO_100G, MARMITAS } from './marmitas';
import { CONQUISTAS } from './conquistas';

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
            categoria, medida_caseira, g_por_medida, custo_100g)
         VALUES (?,'taco',?,?,?,?,?,?,?,?,?)`,
        [nome, kcal, p, c, g, fib, cat, medida, gPor, CUSTO_100G[nome] ?? null]
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
    const todasReceitas: (SeedReceita & {
      tags?: string[];
      viral?: string;
      marmitavel?: boolean;
      custoNivel?: string;
      rendeDias?: number;
    })[] = [...RECEITAS, ...RECEITAS_FIT, ...MARMITAS];

    for (const r of todasReceitas) {
      const res = await db.runAsync(
        `INSERT INTO recipes
           (nome, rendimento_porcoes, tempo_preparo_min, dificuldade, tags, observacao,
            marmitavel, custo_nivel, rende_dias)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          r.nome,
          r.porcoes,
          r.tempoMin,
          r.dificuldade,
          (r.tags ?? []).join(','),
          r.viral ?? null,
          r.marmitavel ? 1 : 0,
          r.custoNivel ?? 'medio',
          r.rendeDias ?? null,
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

    // ── Rotina ────────────────────────────────────────────────────────────
    // Não existe mais rotina de exemplo aqui, de propósito.
    //
    // O seed criava DUAS rotinas prontas, as duas com `ativa = 1`. A tela de
    // treino lista os dias de toda rotina ativa, então quem terminava o
    // cadastro via seis treinos misturados de dois planos diferentes e não
    // sabia qual era o dele. Foi exatamente o que aconteceu no cadastro da
    // Deise.
    //
    // Agora a rotina nasce do gerador no fim do questionário — uma só, ativa,
    // com os dias da semana já distribuídos.

    // ── Estado inicial de gamificação ─────────────────────────────────────
    await db.runAsync(
      `INSERT OR IGNORE INTO user_stats (id, xp_total, nivel) VALUES (1, 0, 1)`
    );
  });
}
