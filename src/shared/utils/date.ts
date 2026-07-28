/** Datas em ISO (YYYY-MM-DD) no banco, sempre em horário local. */

export function hoje(): string {
  return isoDe(new Date());
}

export function isoDe(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Converte "2026-07-25" para Date local — `new Date(iso)` cairia em UTC. */
export function deIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function somarDias(iso: string, n: number): string {
  const d = deIso(iso);
  d.setDate(d.getDate() + n);
  return isoDe(d);
}

export function diasEntre(a: string, b: string): number {
  const ms = deIso(b).getTime() - deIso(a).getTime();
  return Math.round(ms / 86400000);
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export function diaSemana(iso: string, curto = false): string {
  const i = deIso(iso).getDay();
  return curto ? DIAS_CURTO[i] : DIAS[i];
}

export function diaSemanaDe(n: number, curto = false): string {
  return curto ? DIAS_CURTO[n] : DIAS[n];
}

/** "25 jul" — formato curto que cabe em card e eixo de gráfico. */
export function dataCurta(iso: string): string {
  const d = deIso(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "Hoje", "Ontem" ou "quinta, 25 jul" — o que a pessoa espera ler. */
export function dataAmigavel(iso: string): string {
  const dif = diasEntre(iso, hoje());
  if (dif === 0) return 'Hoje';
  if (dif === 1) return 'Ontem';
  if (dif === -1) return 'Amanhã';
  if (dif > 1 && dif < 7) return `${diasEntre(iso, hoje())} dias atrás`;
  return `${diaSemana(iso).toLowerCase()}, ${dataCurta(iso)}`;
}

export function idade(nascimento: string): number {
  const n = deIso(nascimento);
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a;
}

export function horaDe(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Últimos N dias em ISO, do mais antigo para o mais novo. */
export function ultimosDias(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(somarDias(hoje(), -i));
  return out;
}

/**
 * Semanas fechadas terminando na semana atual, sempre começando num domingo.
 *
 * O mapa de constância desenha uma linha por semana com sete colunas rotuladas
 * D S T Q Q S S. Alimentá-lo com "os últimos 28 dias" faz a primeira coluna cair
 * num dia qualquer — o desenho fica certo e a leitura, errada.
 */
export function semanasFechadas(semanas: number): string[] {
  const base = new Date(`${hoje()}T12:00:00`);
  const domingoDestaSemana = somarDias(hoje(), -base.getDay());
  const inicio = somarDias(domingoDestaSemana, -(semanas - 1) * 7);
  return Array.from({ length: semanas * 7 }, (_, i) => somarDias(inicio, i));
}
