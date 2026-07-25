import { all, first, run } from '@/db/client';
import { hoje, ultimosDias } from '@/shared/utils/date';

/**
 * Hidratação.
 *
 * Base: 35 ml por kg de peso corporal por dia (faixa de consenso: 30–35 ml/kg).
 * Em dia de treino soma-se a reposição do suor — 500 a 1000 ml por hora de
 * exercício, dependendo de intensidade e calor.
 *
 * Por que isso está num app de treino e não é detalhe: 2% de desidratação já
 * derruba força e resistência de forma mensurável, e a sede aparece DEPOIS
 * desse ponto. Quem espera ter sede já treinou pior.
 */

export const ML_POR_KG = 35;
export const ML_POR_HORA_TREINO = 700;

export function metaDiaria(pesoKg: number, treinaHoje: boolean, minutosTreino = 60): number {
  const base = pesoKg * ML_POR_KG;
  const extra = treinaHoje ? (minutosTreino / 60) * ML_POR_HORA_TREINO : 0;
  // Arredonda para 100 ml — precisão maior que isso é falsa.
  return Math.round((base + extra) / 100) * 100;
}

export async function registrar(ml: number, data = hoje()) {
  await run('INSERT INTO water_logs (data, ml, registrado_em) VALUES (?,?,?)', [
    data,
    ml,
    Date.now(),
  ]);
}

export async function totalDoDia(data = hoje()): Promise<number> {
  const r = await first<{ t: number }>(
    'SELECT COALESCE(SUM(ml),0) AS t FROM water_logs WHERE data = ?',
    [data]
  );
  return r?.t ?? 0;
}

export async function registrosDoDia(data = hoje()) {
  return all<{ id: number; ml: number; registrado_em: number }>(
    'SELECT id, ml, registrado_em FROM water_logs WHERE data = ? ORDER BY registrado_em DESC',
    [data]
  );
}

export async function desfazer(id: number) {
  await run('DELETE FROM water_logs WHERE id = ?', [id]);
}

export async function historico(dias = 14) {
  const desde = ultimosDias(dias)[0];
  const rows = await all<{ dia: string; ml: number }>(
    `SELECT data AS dia, SUM(ml) AS ml FROM water_logs
      WHERE data >= ? GROUP BY data ORDER BY data`,
    [desde]
  );
  return rows;
}

/** Dias seguidos batendo a meta — mesma mecânica de streak do treino. */
export async function diasNaMeta(metaMl: number, limite = 30): Promise<number> {
  const rows = await all<{ dia: string; ml: number }>(
    `SELECT data AS dia, SUM(ml) AS ml FROM water_logs
      GROUP BY data ORDER BY data DESC LIMIT ?`,
    [limite]
  );
  let n = 0;
  for (const r of rows) {
    if (r.ml >= metaMl) n++;
    else break;
  }
  return n;
}

/** Copos rápidos — os volumes que a pessoa realmente usa. */
export const ATALHOS = [
  { ml: 200, label: 'Copo', emoji: '🥛' },
  { ml: 300, label: 'Caneca', emoji: '☕' },
  { ml: 500, label: 'Garrafa', emoji: '🍶' },
  { ml: 1000, label: 'Litro', emoji: '💧' },
];

/**
 * Distribui a meta ao longo do dia acordado, para virar lembrete.
 * Concentra mais cedo de propósito: beber tudo à noite atrapalha o sono e não
 * hidrata melhor — o excesso simplesmente sai.
 */
export function planoDeLembretes(
  metaMl: number,
  acorda = 7,
  dorme = 22
): { hora: string; ml: number; acumulado: number }[] {
  const horas = dorme - acorda;
  const blocos = Math.min(8, Math.max(4, Math.round(horas / 2)));
  const out: { hora: string; ml: number; acumulado: number }[] = [];
  let acumulado = 0;

  for (let i = 0; i < blocos; i++) {
    // Peso decrescente: mais água na primeira metade do dia.
    const peso = 1.25 - (i / blocos) * 0.5;
    const somaPesos = Array.from({ length: blocos }, (_, k) => 1.25 - (k / blocos) * 0.5).reduce(
      (a, b) => a + b,
      0
    );
    const ml = Math.round((metaMl * (peso / somaPesos)) / 50) * 50;
    acumulado += ml;
    const h = Math.round(acorda + (i * horas) / blocos);
    out.push({ hora: `${String(h).padStart(2, '0')}:00`, ml, acumulado });
  }
  return out;
}

/** Mensagem de estado — o que a pessoa precisa saber ao olhar o card. */
export function statusHidratacao(consumido: number, meta: number, hora = new Date().getHours()) {
  const frac = meta > 0 ? consumido / meta : 0;
  // Quanto já deveria ter bebido a esta hora (janela de 7h às 22h).
  const esperado = Math.max(0, Math.min(1, (hora - 7) / 15));

  if (frac >= 1) return { texto: 'Meta batida', cor: '#00D68F', atrasado: false };
  if (frac >= esperado - 0.1)
    return { texto: 'No ritmo certo', cor: '#00D68F', atrasado: false };
  if (frac >= esperado - 0.25)
    return { texto: 'Um pouco atrás', cor: '#FFB020', atrasado: true };
  return { texto: 'Bem atrás do ritmo', cor: '#FF4757', atrasado: true };
}
