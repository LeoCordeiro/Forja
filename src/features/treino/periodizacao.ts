/**
 * Periodização e prescrição de treino baseada em evidência.
 *
 * As três decisões que mais mudam resultado, em ordem:
 *   1. VOLUME — séries semanais por grupo muscular
 *   2. PROXIMIDADE DA FALHA — RIR/RPE
 *   3. DESCANSO — tempo entre séries
 *
 * Carga e escolha de exercício importam bem menos do que a internet sugere,
 * desde que as três acima estejam certas.
 */

export type Fase = 'readaptacao' | 'acumulo' | 'intensificacao' | 'deload';
export type Experiencia = 'iniciante' | 'intermediario' | 'avancado';

/**
 * Volume semanal por grupo muscular.
 *
 * A meta-regressão de 2025 (67 estudos, 2.058 pessoas) mostra ganho contínuo
 * com mais volume, porém com retorno decrescente claro. Abaixo de 10 séries o
 * resultado é nitidamente pior; entre 12 e 20 fica o melhor custo-benefício.
 * Acima disso, cada série adicional rende pouco e cobra recuperação.
 */
export const VOLUME_SEMANAL: Record<Experiencia, { min: number; alvo: number; max: number }> = {
  iniciante: { min: 8, alvo: 12, max: 16 },
  intermediario: { min: 12, alvo: 16, max: 20 },
  avancado: { min: 14, alvo: 20, max: 26 },
};

/**
 * Descanso entre séries, em segundos.
 *
 * Schoenfeld 2016 comparou 1 min contra 3 min por 8 semanas: o grupo de 3
 * minutos ganhou mais força E mais músculo. A meta-análise bayesiana de 2024
 * confirmou vantagem para intervalos acima de 60 s.
 *
 * O mecanismo não é misterioso: com mais descanso você repete mais
 * repetições com mais carga nas séries seguintes, e é esse volume acumulado
 * que produz o resultado. Descanso curto economiza tempo e custa estímulo.
 */
export const DESCANSO = {
  compostoPesado: 180, // agachamento, terra, supino em série pesada
  composto: 150,
  isolador: 90,
  isoladorLeve: 60,
  cardioIntervalado: 60,
} as const;

export function descansoSugerido(
  ehComposto: boolean,
  repsAlvo: number,
  fase: Fase = 'acumulo'
): number {
  if (fase === 'readaptacao') return ehComposto ? 120 : 75;
  if (ehComposto) return repsAlvo <= 6 ? DESCANSO.compostoPesado : DESCANSO.composto;
  return repsAlvo >= 15 ? DESCANSO.isoladorLeve : DESCANSO.isolador;
}

/**
 * RIR alvo (repetições em reserva) por fase.
 *
 * Treinar até a falha em toda série não rende mais hipertrofia e atrasa a
 * recuperação. Parar com 1–3 repetições na reserva entrega praticamente o
 * mesmo estímulo com muito menos desgaste.
 */
export const RIR_POR_FASE: Record<Fase, { min: number; max: number; texto: string }> = {
  readaptacao: {
    min: 3,
    max: 4,
    texto: 'Deixe 3 a 4 repetições na reserva. A meta destas semanas é o tendão e a técnica voltarem, não o recorde.',
  },
  acumulo: {
    min: 2,
    max: 3,
    texto: 'Deixe 2 a 3 repetições na reserva. Dá para acumular volume sem destruir a recuperação.',
  },
  intensificacao: {
    min: 0,
    max: 2,
    texto: 'Chegue a 0 a 2 repetições da falha nas últimas séries. É aqui que se busca recorde.',
  },
  deload: {
    min: 4,
    max: 5,
    texto: 'Semana leve. Metade do volume, longe da falha. O ganho acontece na recuperação.',
  },
};

export interface PlanoRetorno {
  semanas: { semana: number; fase: Fase; volumePct: number; cargaPct: number; nota: string }[];
  resumo: string;
}

/**
 * Plano de retorno após pausa.
 *
 * A memória muscular é real e mecanicamente explicada: os mionúcleos ganhos em
 * treinos anteriores permanecem na fibra mesmo quando ela encolhe. Por isso
 * recuperar é muito mais rápido que construir do zero — cerca de 5 semanas
 * para voltar ao nível anterior após ~10 semanas parado.
 *
 * O erro clássico de quem volta é retomar na carga de antes já na primeira
 * semana. O músculo até aguenta; tendão e articulação, que se adaptam mais
 * devagar, não — e a lesão custa mais semanas que a cautela.
 */
export function planoRetorno(mesesParado: number): PlanoRetorno {
  if (mesesParado < 1) {
    return {
      semanas: [{ semana: 1, fase: 'acumulo', volumePct: 100, cargaPct: 100, nota: 'Sem pausa relevante. Siga o plano normal.' }],
      resumo: 'Sem necessidade de readaptação.',
    };
  }

  const semanasReadapt = mesesParado <= 1 ? 2 : mesesParado <= 3 ? 3 : 4;
  const semanas: PlanoRetorno['semanas'] = [];

  for (let s = 1; s <= semanasReadapt; s++) {
    const prog = s / semanasReadapt;
    semanas.push({
      semana: s,
      fase: 'readaptacao',
      volumePct: Math.round(50 + prog * 30),
      cargaPct: Math.round(60 + prog * 20),
      nota:
        s === 1
          ? 'Comece leve de propósito. Vai parecer fácil demais — é para parecer. A dor muscular dos primeiros treinos vem sozinha.'
          : `Suba um pouco a carga. Ainda longe da falha.`,
    });
  }

  for (let s = 1; s <= 4; s++) {
    semanas.push({
      semana: semanasReadapt + s,
      fase: 'acumulo',
      volumePct: Math.round(90 + s * 2.5),
      cargaPct: Math.round(85 + s * 3.75),
      nota: s === 1 ? 'Carga e volume normais. Agora sim buscar progressão semana a semana.' : 'Adicione carga ou repetição sobre a semana anterior.',
    });
  }

  semanas.push({
    semana: semanasReadapt + 5,
    fase: 'deload',
    volumePct: 50,
    cargaPct: 85,
    nota: 'Semana leve para recuperar. Sem ela a fadiga acumula e a progressão trava.',
  });

  return {
    semanas,
    resumo: `${semanasReadapt} semanas de readaptação, 4 de progressão e 1 leve. Depois de ~${semanasReadapt + 5} semanas você deve estar na carga de antes — ou acima.`,
  };
}

/** Em que semana do plano a pessoa está, contando da data de retomada. */
export function semanaAtual(retomouEm: string | null): number {
  if (!retomouEm) return 1;
  const [y, m, d] = retomouEm.split('-').map(Number);
  const inicio = new Date(y, m - 1, d).getTime();
  const dias = Math.floor((Date.now() - inicio) / 86400000);
  return Math.max(1, Math.floor(dias / 7) + 1);
}

export function faseDaSemana(plano: PlanoRetorno, semana: number) {
  return plano.semanas[Math.min(semana, plano.semanas.length) - 1] ?? plano.semanas[plano.semanas.length - 1];
}

/**
 * Cardio junto com musculação.
 *
 * O "efeito interferência" existe, mas é bem menor do que se dizia: a
 * meta-análise de 2022 (43 estudos) não achou prejuízo relevante em hipertrofia
 * ou força máxima. O que sofre de verdade é potência explosiva.
 *
 * As regras que importam na prática: separar as sessões por algumas horas,
 * preferir bicicleta a corrida (menos dano muscular excêntrico) e não exagerar
 * na frequência.
 */
export const CARDIO = {
  regras: [
    'Faça o cardio DEPOIS da musculação, ou separado por pelo menos 3 horas.',
    'Bicicleta e elíptico interferem menos que corrida — menos impacto excêntrico na perna.',
    'Zona 2 (consegue conversar) por 25–40 min é o que mais rende para gordura e coração.',
    'Nunca faça cardio pesado de perna no dia anterior ao treino de perna.',
  ],
  porObjetivo: {
    recomposicao: { sessoes: 3, minutos: 30, tipo: 'Zona 2 (bicicleta, elíptico ou caminhada inclinada)' },
    emagrecimento: { sessoes: 4, minutos: 35, tipo: 'Zona 2, com 1 sessão de HIIT curto se houver disposição' },
    hipertrofia: { sessoes: 2, minutos: 20, tipo: 'Zona 2 leve, só para saúde cardiovascular' },
    manutencao: { sessoes: 3, minutos: 25, tipo: 'Zona 2' },
  } as Record<string, { sessoes: number; minutos: number; tipo: string }>,
};

/** Frequência cardíaca alvo por zona (fórmula de Tanaka, mais precisa que 220−idade). */
export function zonasFC(idade: number) {
  const fcMax = Math.round(208 - 0.7 * idade);
  const z = (a: number, b: number) => `${Math.round(fcMax * a)}–${Math.round(fcMax * b)} bpm`;
  return {
    fcMax,
    zona2: z(0.6, 0.7),
    zona3: z(0.7, 0.8),
    zona4: z(0.8, 0.9),
  };
}

/**
 * Divisão de treino recomendada pela disponibilidade semanal.
 *
 * Frequência de 2× por semana por grupo muscular bate 1× para hipertrofia,
 * porque distribui melhor o volume. Por isso full body em 2–3 dias e
 * upper/lower em 4 — e não o clássico "um músculo por dia".
 */
export function divisaoRecomendada(dias: number): { nome: string; motivo: string } {
  if (dias <= 2)
    return {
      nome: 'Full body',
      motivo: 'Com 2 dias, treinar o corpo todo em cada sessão atinge cada músculo 2× na semana.',
    };
  if (dias === 3)
    return {
      nome: 'Full body ou Push/Pull/Legs',
      motivo: 'Full body 3× rende mais para iniciante; PPL funciona bem se você prefere sessões mais curtas.',
    };
  if (dias === 4)
    return {
      nome: 'Upper / Lower',
      motivo: 'Duas vezes superiores e duas inferiores: a melhor relação entre frequência e recuperação.',
    };
  if (dias === 5)
    return {
      nome: 'Upper / Lower / Push / Pull / Legs',
      motivo: 'Permite volume alto mantendo cada grupo 2× na semana.',
    };
  return {
    nome: 'Push / Pull / Legs 2×',
    motivo: 'Seis dias só valem a pena com boa recuperação: sono, comida e consistência.',
  };
}

export const LABEL_EXPERIENCIA: Record<Experiencia, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const DESC_EXPERIENCIA: Record<Experiencia, string> = {
  iniciante: 'Menos de 1 ano treinando, ou voltando depois de muito tempo',
  intermediario: '1 a 3 anos de treino consistente',
  avancado: 'Mais de 3 anos treinando sério',
};

export const LABEL_FASE: Record<Fase, string> = {
  readaptacao: 'Readaptação',
  acumulo: 'Acúmulo',
  intensificacao: 'Intensificação',
  deload: 'Semana leve',
};
