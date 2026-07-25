import { dataAmigavel as amigavelIso, isoDe } from './date';

/** Ponte entre os timestamps do banco (ms) e os helpers de data em ISO. */

export function isoDeTs(ts: number): string {
  return isoDe(new Date(ts));
}

export function dataAmigavel(ts: number): string {
  return amigavelIso(isoDeTs(ts));
}

/** Duração em segundos. Sessão ainda aberta conta até agora. */
export function duracaoDe(inicio: number, fim: number | null): number {
  return Math.max(0, ((fim ?? Date.now()) - inicio) / 1000);
}
