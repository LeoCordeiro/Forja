import type { TipoCarga } from '@/db/types';
import type { SerieAnterior } from './api';
import type { FaseEfetiva } from './fase';

/**
 * Motor da progressão dupla.
 *
 * O método está declarado em `programa.ts` desde sempre — "bateu o topo da
 * faixa em todas as séries → sobe a carga" — mas nenhum código comparava a
 * última execução com a faixa. O caminho de menor atrito do executor era
 * herdar o peso anterior igual, ou seja: repetir a carga para sempre.
 *
 * Nada aqui grava nem bloqueia. É sugestão: o selo aparece, o campo vazio
 * herda o peso sugerido, e o usuário digita outro valor se quiser.
 */

/** +5 kg em perna, +2,5 kg no resto — os degraus que o programa já ensina. */
export function incrementoKg(grupoPrimario: string): number {
  return ['quadriceps', 'posterior', 'gluteo'].includes(grupoPrimario) ? 5 : 2.5;
}

/** Arredonda ao múltiplo de 0,5 kg — o menor passo de anilha que existe na prática. */
export function arredondar05(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** Carga de volta na readaptação: % da carga anterior, na anilha mais próxima. */
export function pesoDeVolta(pesoAnterior: number, cargaPct: number): number {
  return Math.max(0, arredondar05((pesoAnterior * cargaPct) / 100));
}

export type Progressao =
  | { acao: 'subir'; pesoSugerido: number; motivo: string }
  | { acao: 'segurar'; motivo: string };

/**
 * Compara a última execução com a faixa de repetições do plano.
 *
 * - Todas as séries no topo da faixa → subir: maior peso + incremento do grupo.
 * - Alguma série abaixo do fundo → segurar: fechar a faixa antes de subir.
 * - No meio do caminho → null: progresso normal, nada a dizer.
 *
 * Deload e readaptação devolvem null: semana de proteção não empurra carga
 * (a readaptação tem a própria sugestão — a volta leve — feita no executor).
 */
export function avaliarProgressao(
  anteriores: SerieAnterior[],
  repsMin: number,
  repsMax: number,
  grupo: string,
  tipoCarga: TipoCarga,
  fase: FaseEfetiva | null
): Progressao | null {
  if (tipoCarga !== 'peso_reps') return null;
  if (fase && (fase.fase === 'deload' || fase.fase === 'readaptacao')) return null;

  const validas = anteriores.filter(
    (s): s is SerieAnterior & { peso_kg: number; reps: number } =>
      s.peso_kg != null && s.reps != null
  );
  if (!validas.length) return null;

  if (validas.every((s) => s.reps >= repsMax)) {
    const maiorPeso = Math.max(...validas.map((s) => s.peso_kg));
    return {
      acao: 'subir',
      pesoSugerido: arredondar05(maiorPeso + incrementoKg(grupo)),
      motivo: `Topo da faixa (${repsMax}) em todas as séries da última sessão.`,
    };
  }

  if (validas.some((s) => s.reps < repsMin)) {
    return {
      acao: 'segurar',
      motivo: `Série abaixo do fundo da faixa (${repsMin}) na última sessão — consolide antes de subir.`,
    };
  }

  return null;
}
