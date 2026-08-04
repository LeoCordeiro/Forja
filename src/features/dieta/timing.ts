import type { TipoRefeicao } from '@/db/types';

/**
 * Timing das refeições em função do horário de treino.
 *
 * Quem treina 6h da manhã não tem "pré-treino" separado: o café da manhã É o
 * pré-treino, e precisa ser diferente de um café comum — rápido de digerir,
 * carboidrato acessível, pouca gordura e pouca fibra (que atrasam o esvaziamento
 * gástrico e viram desconforto na primeira série).
 *
 * A janela anabólica de 30 minutos é mito: o que importa é o total de proteína
 * do dia e não deixar buracos grandes demais entre as refeições. Mas treinar em
 * jejum absoluto às 6h, sem nada, custa desempenho de verdade — e desempenho é
 * o que gera o estímulo.
 */

export type HorarioTreino = 'jejum' | 'manha' | 'almoco' | 'tarde' | 'noite';

export const LABEL_HORARIO: Record<HorarioTreino, string> = {
  jejum: 'Bem cedo, quase em jejum',
  manha: 'De manhã, depois de comer algo',
  almoco: 'No horário do almoço',
  tarde: 'Fim da tarde',
  noite: 'À noite',
};

export const DESC_HORARIO: Record<HorarioTreino, string> = {
  jejum: 'Entre 5h e 7h, sem tempo para uma refeição completa antes',
  manha: 'Entre 7h e 10h, com café da manhã antes',
  almoco: 'Entre 11h e 14h',
  tarde: 'Entre 16h e 19h',
  noite: 'Depois das 19h',
};

export interface RefeicaoPlanejada {
  tipo: TipoRefeicao;
  hora: string;
  papel: 'pre_treino' | 'pos_treino' | 'normal' | 'ceia';
  fatiaKcal: number;
  orientacao: string;
}

function hhmm(h: number, m = 0): string {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Monta o plano de refeições do dia.
 *
 * O que muda conforme o horário do treino não é só o relógio: a refeição que
 * cai antes do treino ganha orientação própria (carbo rápido, pouca gordura),
 * e a de depois concentra proteína.
 */
export function planoDoDia(
  horarioTreino: HorarioTreino,
  refeicoesPorDia: number,
  acorda = '06:30'
): RefeicaoPlanejada[] {
  const horaAcorda = parseInt(acorda.split(':')[0], 10);

  if (horarioTreino === 'jejum') {
    // Treino logo ao acordar: a refeição pré é pequena e rápida, e o café de
    // verdade vira o pós-treino.
    return [
      {
        tipo: 'cafe',
        hora: hhmm(horaAcorda - 0.5),
        papel: 'pre_treino',
        fatiaKcal: 0.1,
        orientacao:
          'Pré-treino leve, 20 a 30 min antes: banana com um pouco de aveia, ou pão com mel. Carboidrato de fácil digestão, pouca gordura e pouca fibra.',
      },
      {
        tipo: 'lanche_manha',
        hora: hhmm(horaAcorda + 2),
        papel: 'pos_treino',
        fatiaKcal: 0.27,
        orientacao:
          'Esta é a sua refeição forte do dia: proteína alta e carboidrato para repor. Ovos com tapioca, ou shake com aveia e fruta.',
      },
      { tipo: 'almoco', hora: '12:30', papel: 'normal', fatiaKcal: 0.28, orientacao: 'Refeição completa: proteína, carboidrato e vegetais.' },
      { tipo: 'lanche_tarde', hora: '16:00', papel: 'normal', fatiaKcal: 0.13, orientacao: 'Lanche com proteína — iogurte, ovo ou sanduíche.' },
      { tipo: 'jantar', hora: '19:30', papel: 'normal', fatiaKcal: 0.22, orientacao: 'Semelhante ao almoço, com menos carboidrato se você dorme cedo.' },
    ];
  }

  if (horarioTreino === 'manha') {
    return [
      {
        tipo: 'cafe',
        hora: hhmm(horaAcorda + 0.5),
        papel: 'pre_treino',
        fatiaKcal: 0.25,
        orientacao:
          'Este café da manhã É o seu pré-treino. Coma 60 a 90 min antes de treinar: carboidrato + proteína, pouca gordura. Panqueca de aveia com banana funciona bem.',
      },
      {
        tipo: 'lanche_manha',
        hora: hhmm(horaAcorda + 3.5),
        papel: 'pos_treino',
        fatiaKcal: 0.15,
        orientacao: 'Pós-treino: proteína em primeiro lugar. Shake, iogurte grego ou ovos.',
      },
      { tipo: 'almoco', hora: '12:30', papel: 'normal', fatiaKcal: 0.28, orientacao: 'Refeição completa.' },
      { tipo: 'lanche_tarde', hora: '16:00', papel: 'normal', fatiaKcal: 0.12, orientacao: 'Lanche com proteína.' },
      { tipo: 'jantar', hora: '19:30', papel: 'normal', fatiaKcal: 0.2, orientacao: 'Refeição completa.' },
    ];
  }

  if (horarioTreino === 'almoco') {
    return [
      { tipo: 'cafe', hora: hhmm(horaAcorda + 0.5), papel: 'normal', fatiaKcal: 0.22, orientacao: 'Café da manhã completo.' },
      {
        tipo: 'lanche_manha',
        hora: '10:00',
        papel: 'pre_treino',
        fatiaKcal: 0.12,
        orientacao: 'Pré-treino: carboidrato de fácil digestão 60 min antes. Fruta com aveia, ou pão.',
      },
      {
        tipo: 'almoco',
        hora: '13:30',
        papel: 'pos_treino',
        fatiaKcal: 0.3,
        orientacao: 'Pós-treino e principal refeição do dia. Proteína alta e carboidrato.',
      },
      { tipo: 'lanche_tarde', hora: '16:30', papel: 'normal', fatiaKcal: 0.14, orientacao: 'Lanche com proteína.' },
      { tipo: 'jantar', hora: '19:30', papel: 'normal', fatiaKcal: 0.22, orientacao: 'Refeição completa.' },
    ];
  }

  if (horarioTreino === 'tarde') {
    return [
      { tipo: 'cafe', hora: hhmm(horaAcorda + 0.5), papel: 'normal', fatiaKcal: 0.22, orientacao: 'Café da manhã completo.' },
      { tipo: 'lanche_manha', hora: '10:00', papel: 'normal', fatiaKcal: 0.1, orientacao: 'Lanche leve.' },
      { tipo: 'almoco', hora: '12:30', papel: 'normal', fatiaKcal: 0.26, orientacao: 'Refeição completa.' },
      {
        tipo: 'lanche_tarde',
        hora: '16:00',
        papel: 'pre_treino',
        fatiaKcal: 0.14,
        orientacao: 'Pré-treino: 60 a 90 min antes. Carboidrato + proteína, pouca gordura.',
      },
      {
        tipo: 'jantar',
        hora: '20:00',
        papel: 'pos_treino',
        fatiaKcal: 0.28,
        orientacao: 'Pós-treino: proteína alta e carboidrato para repor o glicogênio.',
      },
    ];
  }

  // Noite.
  //
  // Sem `slice`, e é correção: `noite.slice(0, Math.max(3, refeicoesPorDia))`
  // cortava do FIM de uma lista em ordem cronológica — e o fim é o jantar, que
  // no treino da noite é o `pos_treino`. Com 4 refeições as fatias somavam 0,72
  // do dia e não havia pós-treino; com 3, somavam 0,58 e o pré-treino sumia
  // junto. Quem treina à noite ficava sem as duas refeições que este arquivo
  // existe para posicionar. Os outros quatro ramos já ignoram
  // `refeicoes_por_dia` — quantas refeições cabem no dia é escolha de rotina,
  // e apagar o pós-treino não é a forma de respeitá-la.
  const noite: RefeicaoPlanejada[] = [
    { tipo: 'cafe', hora: hhmm(horaAcorda + 0.5), papel: 'normal', fatiaKcal: 0.22, orientacao: 'Café da manhã completo.' },
    { tipo: 'lanche_manha', hora: '10:00', papel: 'normal', fatiaKcal: 0.1, orientacao: 'Lanche leve.' },
    { tipo: 'almoco', hora: '12:30', papel: 'normal', fatiaKcal: 0.26, orientacao: 'Refeição completa.' },
    {
      tipo: 'lanche_tarde',
      hora: '17:30',
      papel: 'pre_treino',
      fatiaKcal: 0.14,
      orientacao: 'Pré-treino: 60 a 90 min antes. Carboidrato de fácil digestão.',
    },
    {
      tipo: 'jantar',
      hora: '21:00',
      papel: 'pos_treino',
      fatiaKcal: 0.28,
      orientacao:
        'Pós-treino. Comer bem depois de treinar à noite não engorda mais — o total do dia é o que conta.',
    },
  ];
  return noite;
}

/** Tags de receita adequadas ao papel da refeição. */
export function tagsParaPapel(papel: RefeicaoPlanejada['papel']): string[] {
  if (papel === 'pre_treino') return ['rapido', 'fruta', 'cafe'];
  if (papel === 'pos_treino') return ['whey', 'frango', 'ovo', 'pos-treino'];
  return [];
}

export const ORIENTACAO_PRE_TREINO = {
  titulo: 'O que comer antes de treinar',
  regras: [
    'Carboidrato de digestão fácil é o principal: banana, pão, tapioca, aveia.',
    'Pouca gordura e pouca fibra — atrasam o esvaziamento do estômago e dão desconforto.',
    'Proteína em quantidade moderada. Muita proteína antes também pesa.',
    'Entre 60 e 90 minutos antes, se for refeição completa. Se for 20 minutos antes, só carboidrato leve.',
  ],
  jejum:
    'Treinar em jejum não queima mais gordura no fim do dia — o balanço calórico é que decide. Mas costuma custar desempenho, e desempenho é o que gera o estímulo. Se treinar muito cedo, uma banana 20 minutos antes já muda o treino.',
};

export const ORIENTACAO_POS_TREINO = {
  titulo: 'O que comer depois de treinar',
  regras: [
    'Proteína é a prioridade: 30 a 40 g na refeição seguinte.',
    'Carboidrato reposto ao longo do dia, não necessariamente na primeira hora.',
    'A "janela de 30 minutos" é mito. O que importa é o total diário de proteína.',
    'Se você treina em jejum, aí sim comer logo depois faz diferença real.',
  ],
};
