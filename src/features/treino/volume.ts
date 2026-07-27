import { all } from '@/db/client';

/**
 * Auditoria de volume semanal — a resposta para "este treino traz resultado?".
 *
 * Base: **Position Stand do ACSM de 2026** (primeira atualização em 17 anos,
 * síntese de 137 revisões sistemáticas, mais de 30 mil participantes). O que
 * ele coloca como determinante de hipertrofia:
 *
 * · **Volume semanal por grupo muscular é o motor principal** — cerca de
 *   10 séries por semana como piso, com dose-resposta acima disso.
 * · Todo grupo muscular treinado **pelo menos 2× por semana**.
 * · Carga de leve a pesada dá **hipertrofia parecida** quando o esforço é
 *   suficiente. Carga pesada segue melhor para força máxima.
 * · **Falha não é necessária**: parar a 1–3 repetições da falha dá o mesmo
 *   resultado com menos fadiga.
 * · Máquina ou peso livre **não é determinante** — o Position Stand cita isso
 *   explicitamente entre o que não precisa ser prescrito.
 *
 * A contagem fracionada (série indireta vale 0,5) não é escolha estética: a
 * meta-regressão de dose-resposta publicada na Sports Medicine em 2026
 * (67 estudos, 2.058 participantes) testou os três métodos de contagem e o
 * fracionado foi o que teve evidência mais forte.
 */

/** Piso de séries semanais por grupo. Abaixo disso o estímulo fica curto. */
export const ALVO_SERIES = 10;
/** Acima disso o retorno por série cai e a recuperação começa a cobrar. */
export const TETO_UTIL = 20;
/** Frequência mínima por grupo na semana. */
export const FREQ_MINIMA = 2;

export interface VolumeGrupo {
  grupo: string;
  /** Séries diretas + metade das indiretas. */
  series: number;
  seriesDiretas: number;
  /** Em quantos dias distintos da semana o grupo aparece. */
  frequencia: number;
  situacao: 'baixo' | 'ok' | 'alto';
}

export interface AuditoriaVolume {
  grupos: VolumeGrupo[];
  totalSeries: number;
  diasPorSemana: number;
  /** Problemas em texto — o que o usuário precisa ler, não o dado cru. */
  alertas: string[];
  /** true quando nenhum grupo treinado está abaixo do piso. */
  suficiente: boolean;
}

/** Grupos pequenos que quase nunca precisam de trabalho direto. */
const ACESSORIOS = new Set(['antebraco', 'trapezio', 'panturrilha', 'abdomen']);

const NOME: Record<string, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombro: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quadriceps: 'Quadríceps',
  posterior: 'Posteriores',
  gluteo: 'Glúteos',
  panturrilha: 'Panturrilha',
  abdomen: 'Abdômen',
  antebraco: 'Antebraço',
  trapezio: 'Trapézio',
};

export const nomeDoGrupo = (g: string) => NOME[g] ?? g;

export async function auditarVolume(routineId: number): Promise<AuditoriaVolume> {
  const linhas = await all<{
    dia_id: number;
    series_alvo: number;
    grupo_primario: string;
    grupos_secundarios: string;
  }>(
    `SELECT rd.id AS dia_id, re.series_alvo, e.grupo_primario, e.grupos_secundarios
       FROM routine_days rd
       JOIN routine_exercises re ON re.routine_day_id = rd.id
       JOIN exercises e ON e.id = re.exercise_id
      WHERE rd.routine_id = ?`,
    [routineId]
  );

  const diretas = new Map<string, number>();
  const indiretas = new Map<string, number>();
  const dias = new Map<string, Set<number>>();

  for (const l of linhas) {
    if (l.grupo_primario === 'cardio') continue;

    diretas.set(l.grupo_primario, (diretas.get(l.grupo_primario) ?? 0) + l.series_alvo);
    if (!dias.has(l.grupo_primario)) dias.set(l.grupo_primario, new Set());
    dias.get(l.grupo_primario)!.add(l.dia_id);

    for (const sec of l.grupos_secundarios.split(',').map((s) => s.trim()).filter(Boolean)) {
      indiretas.set(sec, (indiretas.get(sec) ?? 0) + l.series_alvo);
      if (!dias.has(sec)) dias.set(sec, new Set());
      dias.get(sec)!.add(l.dia_id);
    }
  }

  const chaves = new Set([...diretas.keys(), ...indiretas.keys()]);
  const grupos: VolumeGrupo[] = [...chaves]
    .map((grupo) => {
      const d = diretas.get(grupo) ?? 0;
      const series = Math.round((d + (indiretas.get(grupo) ?? 0) * 0.5) * 10) / 10;
      return {
        grupo,
        series,
        seriesDiretas: d,
        frequencia: dias.get(grupo)?.size ?? 0,
        situacao: (series < ALVO_SERIES ? 'baixo' : series > TETO_UTIL ? 'alto' : 'ok') as VolumeGrupo['situacao'],
      };
    })
    .sort((a, b) => b.series - a.series);

  // ── alertas ─────────────────────────────────────────────────────────────
  const alertas: string[] = [];

  // Só cobra piso de grupo grande: ninguém precisa de 10 séries de antebraço.
  const curtos = grupos.filter((x) => x.situacao === 'baixo' && !ACESSORIOS.has(x.grupo) && x.seriesDiretas > 0);
  if (curtos.length) {
    alertas.push(
      `Abaixo de ${ALVO_SERIES} séries por semana: ${curtos
        .map((x) => `${nomeDoGrupo(x.grupo)} (${x.series})`)
        .join(', ')}. É o piso onde a hipertrofia começa a responder de verdade.`
    );
  }

  const raros = grupos.filter(
    (x) => x.frequencia < FREQ_MINIMA && !ACESSORIOS.has(x.grupo) && x.seriesDiretas > 0
  );
  if (raros.length) {
    alertas.push(
      `Treinado só 1× por semana: ${raros.map((x) => nomeDoGrupo(x.grupo)).join(', ')}. ` +
        `Dividir o mesmo volume em 2 dias distribui melhor a recuperação.`
    );
  }

  const excesso = grupos.filter((x) => x.situacao === 'alto');
  if (excesso.length) {
    alertas.push(
      `Acima de ${TETO_UTIL} séries: ${excesso.map((x) => nomeDoGrupo(x.grupo)).join(', ')}. ` +
        `Não é perigoso, mas cada série a mais rende cada vez menos e cobra recuperação.`
    );
  }

  const totalSeries = linhas.reduce((a, l) => a + (l.grupo_primario === 'cardio' ? 0 : l.series_alvo), 0);

  return {
    grupos,
    totalSeries,
    diasPorSemana: new Set(linhas.map((l) => l.dia_id)).size,
    alertas,
    suficiente: curtos.length === 0,
  };
}
