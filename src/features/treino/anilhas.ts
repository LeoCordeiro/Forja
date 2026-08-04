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
 * As duas séries de aproximação do principal (F8).
 *
 * ── Por que duas, e por que 40% e 65% ────────────────────────────────────
 *
 * A versão anterior desta função devolvia quatro degraus (barra, 50%, 70%, 85%)
 * e nunca foi chamada por ninguém — ficou órfã no arquivo enquanto o gerador
 * entregava plano sem nenhuma série de aquecimento. Quatro degraus é protocolo
 * de dia de força máxima; num treino de hipertrofia eles custam quatro minutos
 * e uma parte do estímulo da primeira série valendo.
 *
 * Dois degraus é o que a escada do tempo livre (B2) prescreve e o que a própria
 * rotina de mobilidade do app já dizia em texto ("duas séries leves do primeiro
 * exercício, com 40% e 60% da carga") sem ninguém implementar. 65% em vez de
 * 60% porque é onde o segundo degrau ainda não fadiga e já ensaia a carga.
 *
 * ── Elas NÃO são volume ──────────────────────────────────────────────────
 *
 * Gravadas com `set_logs.tipo = 'aquecimento'`, que já é excluído de volume, PR
 * e histórico em todas as queries. Sem essa marcação, duas séries leves no
 * primeiro exercício virariam "Anterior: 32 kg" na sessão seguinte e poderiam
 * cravar recorde de volume — o aquecimento estragaria justamente a medida que o
 * principal existe para dar.
 */
export function aquecimento(
  cargaTrabalho: number,
  equipamento?: string | null,
  tipoCarga = 'peso_reps',
  repsAlvo = 10
): SerieAquecimento[] {
  // Sem carga ESCOLHÍVEL não existe aproximação. Barra fixa, mergulho e flexão
  // não têm 40% — o peso é o corpo. Prometer "+2 aproximações" ali e devolver
  // "34 kg" é inventar um número que não existe no aparelho.
  if (tipoCarga !== 'peso_reps') return [];
  // Abaixo de 20 kg o degrau não vale a viagem: a barra sozinha já pesa isso, e
  // aquecer para uma rosca de 12 kg tira repetição da série que conta.
  if (cargaTrabalho < 20) return [];

  // ── O arredondamento é do APARELHO, não da barra ───────────────────────
  //
  // Aplicar matemática de anilha a halter e máquina produzia número que não
  // existe: halter de 24 kg virava "7,5 e 15", máquina de 80 kg virava "30 e
  // 50". Halter sobe de 2 em 2 na maioria das academias; pino de máquina, de 5
  // em 5; só a barra é que se monta com anilha.
  const arredonda = (v: number) => {
    if (equipamento === 'barra') return calcularAnilhas(v, 20).total;
    if (equipamento === 'halter') return Math.max(2, Math.round(v / 2) * 2);
    return Math.max(5, Math.round(v / 5) * 5);
  };

  // Degrau só entra se for MAIS LEVE que a série valendo — com barra, 40% de
  // 30 kg arredonda para a barra nua (20 kg) e o "aquecimento" virava 67% da
  // carga; a 20 kg virava a própria carga de trabalho rotulada de aquecimento.
  const teto = cargaTrabalho * 0.9;
  // O segundo degrau acompanha a ZONA da série valendo. Ribeiro et al.
  // (PMC7558980) mostram que aquecer com poucas repetições e carga baixa não
  // basta: o degrau eficaz foi 80%. Para uma série de 5-8 (principal de barra
  // livre) 65% deixa um salto grande demais até a carga de trabalho; para
  // 8-12 ele já é o degrau certo e 80% começaria a custar repetição.
  const segundo = repsAlvo <= 8 ? 0.8 : 0.65;
  const passos = [
    { pct: 0.4, reps: 8, nota: 'solto, só para lubrificar' },
    { pct: segundo, reps: segundo >= 0.8 ? 3 : 5, nota: 'o corpo reconhece o movimento' },
  ]
    .map((d) => ({
      peso: arredonda(cargaTrabalho * d.pct),
      reps: d.reps,
      nota: `${Math.round(d.pct * 100)}% da carga — ${d.nota}`,
    }))
    .filter((d) => d.peso < teto);

  // Dois degraus no mesmo peso são um degrau: mantém o mais leve com as
  // repetições do mais pesado seria mentir sobre a intenção de cada um.
  return passos.filter((d, i, arr) => i === 0 || d.peso > arr[i - 1].peso);
}
