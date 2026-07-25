/** Formatação pt-BR. Vírgula decimal em tudo — nada de "12.5 kg" na tela. */

export function num(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Peso: mostra decimal só quando existe (60 kg, mas 62,5 kg). */
export function peso(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '—';
  return num(kg, Number.isInteger(kg) ? 0 : 1);
}

/** Volume em kg vira tonelada quando passa de 1000 — cabe na tela e lê melhor. */
export function volume(kg: number): string {
  if (kg >= 1000) return `${num(kg / 1000, 1)} t`;
  return `${num(kg)} kg`;
}

export function kcal(v: number): string {
  return num(Math.round(v));
}

/** 3725 → "1h 02" ; 154 → "2:34" ; 45 → "45s" */
export function duracao(seg: number): string {
  if (seg < 60) return `${Math.round(seg)}s`;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Cronômetro de descanso: sempre m:ss, para o número não mudar de largura. */
export function cronometro(seg: number): string {
  const m = Math.floor(Math.abs(seg) / 60);
  const s = Math.floor(Math.abs(seg) % 60);
  return `${seg < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(1, parte / total));
}

/** "supino reto" → "Supino reto" (capitalização de frase, não Title Case) */
export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const GRUPOS: Record<string, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombro: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quadriceps: 'Quadríceps',
  posterior: 'Posterior',
  gluteo: 'Glúteos',
  panturrilha: 'Panturrilha',
  abdomen: 'Abdômen',
  antebraco: 'Antebraço',
  trapezio: 'Trapézio',
  cardio: 'Cardio',
};

export function nomeGrupo(g: string): string {
  return GRUPOS[g] ?? capitalizar(g);
}

const REFEICOES: Record<string, string> = {
  cafe: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

export function nomeRefeicao(t: string): string {
  return REFEICOES[t] ?? capitalizar(t);
}

export const ORDEM_REFEICOES = [
  'cafe',
  'lanche_manha',
  'almoco',
  'lanche_tarde',
  'jantar',
  'ceia',
] as const;
