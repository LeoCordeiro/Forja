/**
 * Calculadora de anilhas e séries de aquecimento.
 *
 * Duas contas que todo mundo faz de cabeça na academia e erra: quais anilhas
 * somam 82,5 kg, e com quanto começar antes da série valendo.
 *
 * ── Por que aquecimento importa aqui ─────────────────────────────────────
 *
 * Séries de aquecimento não contam como volume de treino — elas existem para
 * o sistema nervoso reconhecer o padrão e a articulação lubrificar antes da
 * carga que constrói. Feitas pesadas demais, viram volume disfarçado e roubam
 * repetição da série que importa. Feitas de menos, a primeira série valendo
 * sai abaixo do que você aguentaria.
 *
 * A regra usada aqui é a clássica de força: subir em degraus percentuais
 * reduzindo repetição, terminando bem antes da carga alvo.
 */

/** Anilhas comuns de academia no Brasil, em kg por lado. */
export const ANILHAS_PADRAO = [20, 15, 10, 5, 2.5, 1.25];

export const BARRAS = [
  { nome: 'Barra olímpica', peso: 20 },
  { nome: 'Barra W', peso: 10 },
  { nome: 'Barra curta', peso: 7 },
  { nome: 'Sem barra', peso: 0 },
];

export interface Carregamento {
  /** Anilhas de UM lado, da maior para a menor. */
  porLado: number[];
  /** Peso realmente montado — pode não bater com o alvo. */
  total: number;
  /** Diferença para o alvo. Zero quando fecha exato. */
  sobra: number;
  barra: number;
}

/**
 * Quais anilhas colocar de cada lado.
 *
 * Guloso do maior para o menor: é como a pessoa monta na prática, e com as
 * anilhas padrão sempre chega ao ótimo. Quando não fecha exato, devolve a
 * sobra em vez de mentir — 61,25 kg não existe com anilhas de 1,25.
 */
export function calcularAnilhas(
  alvoKg: number,
  barraKg = 20,
  disponiveis = ANILHAS_PADRAO
): Carregamento {
  const porLado: number[] = [];
  let restaPorLado = (alvoKg - barraKg) / 2;

  if (restaPorLado <= 0) {
    return { porLado: [], total: barraKg, sobra: alvoKg - barraKg, barra: barraKg };
  }

  for (const a of [...disponiveis].sort((x, y) => y - x)) {
    while (restaPorLado >= a - 0.001) {
      porLado.push(a);
      restaPorLado -= a;
    }
  }

  const total = barraKg + porLado.reduce((s, x) => s + x, 0) * 2;
  return {
    porLado,
    total: Math.round(total * 100) / 100,
    sobra: Math.round((alvoKg - total) * 100) / 100,
    barra: barraKg,
  };
}

/** "2×20 + 1×5 + 1×2,5" — como se fala em voz alta. */
export function resumoAnilhas(c: Carregamento): string {
  if (!c.porLado.length) return 'só a barra';
  const cont = new Map<number, number>();
  for (const a of c.porLado) cont.set(a, (cont.get(a) ?? 0) + 1);
  return [...cont.entries()]
    .map(([kg, n]) => `${n}×${String(kg).replace('.', ',')}`)
    .join(' + ');
}

// ── Aquecimento ───────────────────────────────────────────────────────────

export interface SerieAquecimento {
  peso: number;
  reps: number;
  nota: string;
}

/**
 * Degraus de aquecimento até a carga de trabalho.
 *
 * Só vale a pena para carga alta: aquecer para 20 kg de rosca é perder tempo.
 * Abaixo de 40 kg devolve um degrau só; abaixo de 20, nenhum.
 */
export function aquecimento(
  cargaTrabalho: number,
  barraKg = 20,
  ehComposto = true
): SerieAquecimento[] {
  if (cargaTrabalho < 20 || !ehComposto) return [];

  const arredonda = (v: number) => {
    const c = calcularAnilhas(v, barraKg);
    return c.total;
  };

  if (cargaTrabalho < 40) {
    return [
      { peso: barraKg, reps: 10, nota: 'Só a barra, movimento solto' },
      { peso: arredonda(cargaTrabalho * 0.7), reps: 5, nota: 'Um degrau e vai' },
    ];
  }

  return [
    { peso: barraKg, reps: 10, nota: 'Só a barra, amplitude completa' },
    { peso: arredonda(cargaTrabalho * 0.5), reps: 5, nota: 'Metade da carga, sem esforço' },
    { peso: arredonda(cargaTrabalho * 0.7), reps: 3, nota: 'Começa a pesar, ainda fácil' },
    { peso: arredonda(cargaTrabalho * 0.85), reps: 1, nota: 'Uma repetição só, para o corpo reconhecer' },
  ].filter((s, i, arr) => i === 0 || s.peso > arr[i - 1].peso);
}
