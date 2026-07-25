import { all, first, run } from '@/db/client';
import type { AchievementFull, UserStats } from '@/db/types';
import { diasEntre, hoje } from '@/shared/utils/date';

/**
 * XP e níveis.
 *
 * Curva n^1.5: os primeiros níveis caem rápido (nível 5 em ~1 semana de uso
 * consistente) e depois desaceleram. Progressão rápida no começo é o que
 * segura a pessoa até o hábito se formar sozinho.
 */
export function xpParaNivel(nivel: number): number {
  if (nivel <= 1) return 0;
  return Math.round(100 * Math.pow(nivel - 1, 1.5));
}

export function nivelDeXp(xp: number): number {
  let n = 1;
  while (xpParaNivel(n + 1) <= xp && n < 200) n++;
  return n;
}

export interface ProgressoNivel {
  nivel: number;
  xpAtual: number;
  xpNivelAtual: number;
  xpProximoNivel: number;
  fracao: number;
  faltam: number;
}

export function progressoNivel(xp: number): ProgressoNivel {
  const nivel = nivelDeXp(xp);
  const base = xpParaNivel(nivel);
  const topo = xpParaNivel(nivel + 1);
  return {
    nivel,
    xpAtual: xp,
    xpNivelAtual: base,
    xpProximoNivel: topo,
    fracao: topo === base ? 1 : (xp - base) / (topo - base),
    faltam: Math.max(0, topo - xp),
  };
}

export async function getStats(): Promise<UserStats> {
  let s = await first<UserStats>('SELECT * FROM user_stats WHERE id = 1');
  if (!s) {
    await run('INSERT OR IGNORE INTO user_stats (id) VALUES (1)');
    s = await first<UserStats>('SELECT * FROM user_stats WHERE id = 1');
  }
  return s!;
}

/** Todo ganho de ponto passa por aqui — ledger primeiro, cache depois. */
export async function darPontos(
  pontos: number,
  origem: string,
  origemId?: number,
  descricao?: string
) {
  await run(
    `INSERT INTO point_events (pontos, origem, origem_id, descricao, criado_em)
     VALUES (?,?,?,?,?)`,
    [pontos, origem, origemId ?? null, descricao ?? null, Date.now()]
  );
  await sincronizarXp();
}

/** O total é sempre SUM do ledger — assim nunca dessincroniza de verdade. */
async function sincronizarXp() {
  const r = await first<{ t: number }>('SELECT COALESCE(SUM(pontos),0) AS t FROM point_events');
  const xp = r?.t ?? 0;
  await run('UPDATE user_stats SET xp_total = ?, nivel = ? WHERE id = 1', [xp, nivelDeXp(xp)]);
}

/**
 * Atualiza a sequência de dias.
 *
 * O "freeze" perdoa um dia perdido automaticamente. É a mecânica de retenção
 * mais eficaz que existe: sem ela, quem falha um dia sente que zerou tudo e
 * some de vez. Recupera 1 freeze a cada 14 dias de sequência.
 */
export async function registrarAtividade(): Promise<{ streak: number; usouFreeze: boolean }> {
  const s = await getStats();
  const h = hoje();

  if (s.ultima_atividade === h) return { streak: s.streak_atual, usouFreeze: false };

  let streak = 1;
  let usouFreeze = false;
  let freezes = s.freezes_disponiveis;

  if (s.ultima_atividade) {
    const gap = diasEntre(s.ultima_atividade, h);
    if (gap === 1) {
      streak = s.streak_atual + 1;
    } else if (gap === 2 && freezes > 0) {
      streak = s.streak_atual + 1;
      freezes -= 1;
      usouFreeze = true;
    }
  }

  if (streak > 0 && streak % 14 === 0 && freezes < 2) freezes += 1;

  const maior = Math.max(streak, s.maior_streak);
  await run(
    `UPDATE user_stats
       SET streak_atual = ?, maior_streak = ?, ultima_atividade = ?, freezes_disponiveis = ?
     WHERE id = 1`,
    [streak, maior, h, freezes]
  );

  if (streak > 1 && streak % 7 === 0) {
    await darPontos(streak * 2, 'streak', undefined, `${streak} dias seguidos`);
  }

  return { streak, usouFreeze };
}

export async function listarConquistas(): Promise<AchievementFull[]> {
  return all<AchievementFull>(
    `SELECT d.*, u.progresso, u.meta, u.desbloqueado_em, u.celebrado
       FROM achievement_defs d
       JOIN user_achievements u ON u.code = d.code
      ORDER BY
        u.desbloqueado_em IS NULL,
        CASE d.tier WHEN 'bronze' THEN 1 WHEN 'prata' THEN 2
                    WHEN 'ouro' THEN 3 ELSE 4 END,
        d.pontos`
  );
}

interface Metricas {
  treinos_total: number;
  prs_total: number;
  streak: number;
  volume_sessao: number;
  volume_total: number;
  dieta_dias: number;
  medidas_total: number;
  nivel: number;
  exercicios_distintos: number;
  horario_antes: number;
  horario_depois: number;
}

/** Coleta tudo que as medalhas podem querer medir, numa passada só. */
async function coletarMetricas(): Promise<Metricas> {
  const s = await getStats();

  const q = async (sql: string) => (await first<{ v: number }>(sql))?.v ?? 0;

  const treinos = await q(
    'SELECT COUNT(*) AS v FROM workout_sessions WHERE finalizado_em IS NOT NULL'
  );
  const prs = await q('SELECT COUNT(*) AS v FROM personal_records');
  const volMax = await q(
    'SELECT COALESCE(MAX(volume_total_kg),0) AS v FROM workout_sessions'
  );
  const volTotal = await q(
    'SELECT COALESCE(SUM(volume_total_kg),0) AS v FROM workout_sessions'
  );
  const medidas = await q('SELECT COUNT(*) AS v FROM body_metrics');
  const distintos = await q('SELECT COUNT(DISTINCT exercise_id) AS v FROM set_logs');

  // Dias em que o consumo ficou dentro de ±10% da meta vigente.
  const dietaDias = await q(`
    SELECT COUNT(*) AS v FROM (
      SELECT ml.data, SUM(mli.kcal_snap) AS kcal
        FROM meal_logs ml
        JOIN meal_log_items mli ON mli.meal_log_id = ml.id
       GROUP BY ml.data
    ) d
    WHERE d.kcal BETWEEN
      (SELECT kcal * 0.9 FROM nutrition_targets ORDER BY id DESC LIMIT 1) AND
      (SELECT kcal * 1.1 FROM nutrition_targets ORDER BY id DESC LIMIT 1)
  `);

  // strftime devolve texto; o CAST evita comparar '07' com 7 como string.
  const antes = await q(`
    SELECT COUNT(*) AS v FROM workout_sessions
     WHERE CAST(strftime('%H', iniciado_em/1000, 'unixepoch', 'localtime') AS INTEGER) < 7
  `);
  const depois = await q(`
    SELECT COUNT(*) AS v FROM workout_sessions
     WHERE CAST(strftime('%H', iniciado_em/1000, 'unixepoch', 'localtime') AS INTEGER) >= 22
  `);

  return {
    treinos_total: treinos,
    prs_total: prs,
    streak: s.streak_atual,
    volume_sessao: volMax,
    volume_total: volTotal,
    dieta_dias: dietaDias,
    medidas_total: medidas,
    nivel: s.nivel,
    exercicios_distintos: distintos,
    horario_antes: antes,
    horario_depois: depois,
  };
}

/**
 * Reavalia todas as medalhas e devolve as que acabaram de desbloquear.
 * Chamado depois de qualquer evento relevante (fim de treino, refeição, medida).
 */
export async function avaliarConquistas(): Promise<AchievementFull[]> {
  const m = await coletarMetricas();
  const lista = await listarConquistas();
  const novas: AchievementFull[] = [];

  for (const a of lista) {
    let criterio: { tipo: keyof Metricas; meta: number };
    try {
      criterio = JSON.parse(a.criterio);
    } catch {
      continue; // critério malformado não pode derrubar o app
    }

    const valor = m[criterio.tipo] ?? 0;
    // Medalhas de horário são "aconteceu ou não", não uma contagem crescente.
    const progresso =
      criterio.tipo === 'horario_antes' || criterio.tipo === 'horario_depois'
        ? Math.min(valor > 0 ? 1 : 0, 1)
        : Math.min(valor, criterio.meta);
    const metaEfetiva =
      criterio.tipo === 'horario_antes' || criterio.tipo === 'horario_depois' ? 1 : criterio.meta;

    const desbloqueou = !a.desbloqueado_em && progresso >= metaEfetiva;

    await run(
      `UPDATE user_achievements
          SET progresso = ?, meta = ?, desbloqueado_em = COALESCE(desbloqueado_em, ?)
        WHERE code = ?`,
      [progresso, metaEfetiva, desbloqueou ? Date.now() : null, a.code]
    );

    if (desbloqueou) {
      await darPontos(a.pontos, 'medalha', undefined, a.nome);
      novas.push({ ...a, progresso, meta: metaEfetiva, desbloqueado_em: Date.now() });
    }
  }

  return novas;
}

export async function marcarConquistaCelebrada(code: string) {
  await run('UPDATE user_achievements SET celebrado = 1 WHERE code = ?', [code]);
}

export async function historicoPontos(limite = 30) {
  return all<{ id: number; pontos: number; origem: string; descricao: string; criado_em: number }>(
    'SELECT * FROM point_events ORDER BY criado_em DESC LIMIT ?',
    [limite]
  );
}
