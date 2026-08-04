import type { Genero, NivelAtividade, Objetivo, Macros } from '@/db/types';

/**
 * Cálculos de composição corporal e gasto energético.
 *
 * Nada disto é gravado no banco: IMC, TMB e TDEE são funções de peso, altura,
 * idade e objetivo. Se a pessoa corrigir a altura, todo valor já armazenado
 * viraria mentira — então se calcula na hora, sempre.
 */

export const FATOR_ATIVIDADE: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  atleta: 1.9,
};

export const LABEL_ATIVIDADE: Record<NivelAtividade, string> = {
  sedentario: 'Sedentário',
  leve: 'Leve',
  moderado: 'Moderado',
  intenso: 'Intenso',
  atleta: 'Atleta',
};

export const DESC_ATIVIDADE: Record<NivelAtividade, string> = {
  sedentario: 'Trabalho parado, sem exercício',
  leve: 'Exercício leve 1 a 3 dias por semana',
  moderado: 'Exercício moderado 3 a 5 dias por semana',
  intenso: 'Exercício pesado 6 a 7 dias por semana',
  atleta: 'Treino 2× por dia ou trabalho braçal',
};

export const LABEL_OBJETIVO: Record<Objetivo, string> = {
  recomposicao: 'Ganhar massa e perder gordura',
  hipertrofia: 'Ganhar massa',
  emagrecimento: 'Perder gordura',
  manutencao: 'Manter o peso',
};

export function imc(pesoKg: number, alturaCm: number): number {
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

export function classificacaoImc(v: number): { texto: string; cor: string } {
  if (v < 18.5) return { texto: 'Abaixo do peso', cor: '#3B9EFF' };
  if (v < 25) return { texto: 'Peso normal', cor: '#00D68F' };
  if (v < 30) return { texto: 'Sobrepeso', cor: '#FFB020' };
  if (v < 35) return { texto: 'Obesidade grau 1', cor: '#FF7A1A' };
  if (v < 40) return { texto: 'Obesidade grau 2', cor: '#FF4757' };
  return { texto: 'Obesidade grau 3', cor: '#FF4757' };
}

/**
 * Taxa Metabólica Basal por Mifflin-St Jeor.
 * Escolhida em vez de Harris-Benedict porque erra menos na população atual —
 * a fórmula de Harris é de 1919 e superestima em pessoas com mais gordura.
 */
export function tmb(
  pesoKg: number,
  alturaCm: number,
  idadeAnos: number,
  genero: Genero
): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idadeAnos;
  if (genero === 'masculino') return base + 5;
  if (genero === 'feminino') return base - 161;
  // Sem uma das duas equações, a média é a estimativa mais honesta.
  return base - 78;
}

/** Gasto energético diário total = TMB × fator de atividade. */
export function tdee(taxaBasal: number, nivel: NivelAtividade): number {
  return taxaBasal * FATOR_ATIVIDADE[nivel];
}

/**
 * Meta calórica a partir do objetivo.
 *
 * Déficit e superávit ficam em 15% de propósito: agressivo o bastante para dar
 * resultado visível em semanas, moderado o bastante para não queimar massa
 * magra (déficit) nem virar só gordura (superávit).
 */
export function metaCalorica(gastoTotal: number, objetivo: Objetivo): number {
  if (objetivo === 'emagrecimento') return Math.round(gastoTotal * 0.85);
  if (objetivo === 'hipertrofia') return Math.round(gastoTotal * 1.15);
  // Recomposição usa déficit leve — o cálculo completo vive em recomposicao.ts,
  // porque a proteína lá sai da massa magra e não do peso total.
  if (objetivo === 'recomposicao') return Math.round(gastoTotal * 0.85);
  return Math.round(gastoTotal);
}

// ── `macros()` foi APAGADA daqui, e o motivo é a regra da própria Fase 5 ───
//
// Ela dividia as calorias com a proteína saindo do PESO TOTAL — inclusive o
// coeficiente de 2,2 g por kg de peso no emagrecimento, que é a linha que
// produz os 264 g/dia para 120 kg com 40% de gordura. Quando `meta.ts` virou a
// rota única, ela ficou sem chamador
// e continuou exportada e chamável: a Fase 5 renomeou `REGIOES_DOR.evitar`
// para `exemplos` justificando que "lista antiga viva ao lado da regra nova é
// a que a próxima pessoa acha primeiro", e não aplicou o critério ao próprio
// domínio. A conta inteira mora em `meta.ts`. A versão legada, que o harness
// usa para rodar contra commits antigos, mora no harness com o nome do que ela
// é (`macrosLegadoPorPesoTotal`).

/**
 * 1RM estimado pela fórmula de Epley.
 *
 * É o número que mais motiva no dia a dia: mesmo sem aumentar a carga, fazer
 * uma repetição a mais já move o e1RM — então quase todo treino bom mostra
 * progresso em algum lugar.
 */
export function e1rm(pesoKg: number, reps: number): number {
  if (reps <= 1) return pesoKg;
  return Math.round(pesoKg * (1 + reps / 30) * 100) / 100;
}

/** Peso ideal estimado (Devine) — só como referência visual, não como meta. */
export function pesoReferencia(alturaCm: number, genero: Genero): [number, number] {
  const base = genero === 'feminino' ? 45.5 : 50;
  const ideal = base + 0.91 * (alturaCm - 152.4);
  return [Math.round(ideal * 0.9), Math.round(ideal * 1.1)];
}
