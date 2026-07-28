import type { RoutineExerciseFull } from '@/db/types';
import { ehComposto, ehPesado } from './classificacao';

/**
 * Quanto tempo o treino de fato leva — e como fazê-lo caber no que você tem.
 *
 * ── Por que a conta importa ──────────────────────────────────────────────
 *
 * Um treino de 6 exercícios com 3 min de descanso nos compostos passa de
 * 90 minutos. Quem tem 1 hora não faz esse treino: faz os quatro primeiros
 * exercícios e vai embora. E o que fica de fora é sempre o final da sessão —
 * onde costumam estar os isoladores do grupo que a pessoa mais quer.
 *
 * Prescrever treino que não cabe no tempo da pessoa não é rigor, é ignorar o
 * único recurso que ela realmente não pode aumentar.
 *
 * ── De onde saem os segundos ─────────────────────────────────────────────
 *
 * Cada série tem três partes: executar, descansar e trocar de aparelho.
 *
 * · **Execução**: uma repetição controlada leva perto de 3 s (≈2 s na descida
 *   e 1 s na subida). É a cadência que a maioria dos estudos de hipertrofia
 *   usa, e a que sustenta amplitude completa.
 * · **Descanso**: já vem do exercício, e é o item mais pesado da conta —
 *   3 min entre 4 séries são 9 minutos parado num exercício só.
 * · **Troca**: achar o aparelho, ajustar banco, montar anilha. Uns 90 s, e
 *   mais quando a academia está cheia.
 *
 * ── Como cortar sem estragar ─────────────────────────────────────────────
 *
 * A ordem dos cortes não é arbitrária. Descanso curto em composto pesado
 * derruba carga e repetição nas séries seguintes — foi exatamente isso que já
 * corrigimos uma vez neste app. Isolador tolera intervalo curto porque a
 * demanda sistêmica é baixa.
 *
 * Então corta-se nesta ordem: tempo morto primeiro (série conjugada), depois
 * descanso de isolador, depois exercício acessório inteiro. Composto pesado e
 * seu descanso são os últimos a serem tocados — e, se possível, nunca.
 */

/** Segundos por repetição, cadência controlada. */
const SEG_POR_REP = 3;
/** Trocar de exercício: achar, ajustar, montar. */
const SEG_TROCA = 90;
/** Aquecimento geral no começo da sessão. */
const SEG_AQUECIMENTO = 240;

export interface EstimativaTreino {
  totalSeg: number;
  execucaoSeg: number;
  descansoSeg: number;
  transicaoSeg: number;
  /** Quanto do treino é tempo parado. Costuma passar de 60% e surpreende. */
  pctDescanso: number;
}

export function estimarDuracao(exs: RoutineExerciseFull[]): EstimativaTreino {
  let execucao = 0;
  let descanso = 0;

  for (const e of exs) {
    const reps = ((e.reps_min ?? 8) + (e.reps_max ?? 12)) / 2;
    const porSerie = e.tipo_carga === 'tempo' ? reps : reps * SEG_POR_REP;
    execucao += e.series_alvo * porSerie;
    // O descanso da última série não conta: você já foi para o próximo.
    descanso += Math.max(0, e.series_alvo - 1) * e.descanso_seg;
  }

  const transicao = SEG_AQUECIMENTO + exs.length * SEG_TROCA;
  const total = execucao + descanso + transicao;

  return {
    totalSeg: Math.round(total),
    execucaoSeg: Math.round(execucao),
    descansoSeg: Math.round(descanso),
    transicaoSeg: transicao,
    pctDescanso: total ? Math.round((descanso / total) * 100) : 0,
  };
}

export const emMinutos = (seg: number) => Math.round(seg / 60);

// ── Ajuste para caber ─────────────────────────────────────────────────────

export interface Ajuste {
  tipo: 'superserie' | 'descanso' | 'cortar' | 'ok' | 'impossivel';
  titulo: string;
  descricao: string;
  /** Segundos economizados. */
  economiaSeg: number;
  /** Exercícios afetados, por id de routine_exercise. */
  alvos: number[];
}

export interface PlanoDeTempo {
  estimado: number;
  disponivel: number;
  cabe: boolean;
  ajustes: Ajuste[];
  /** Duração depois de aplicar tudo. */
  finalSeg: number;
}

export function ajustarParaCaber(
  exs: RoutineExerciseFull[],
  minutosDisponiveis: number
): PlanoDeTempo {
  const est = estimarDuracao(exs);
  const disponivel = minutosDisponiveis * 60;

  if (est.totalSeg <= disponivel) {
    return {
      estimado: est.totalSeg,
      disponivel,
      cabe: true,
      finalSeg: est.totalSeg,
      ajustes: [
        {
          tipo: 'ok',
          titulo: 'Cabe no seu tempo',
          descricao: `${emMinutos(est.totalSeg)} min estimados, ${minutosDisponiveis} disponíveis. Sobra para o aquecimento render.`,
          economiaSeg: 0,
          alvos: [],
        },
      ],
    };
  }

  const ajustes: Ajuste[] = [];
  let falta = est.totalSeg - disponivel;

  // ── 1. Série conjugada entre isoladores ────────────────────────────────
  // Descansar do bíceps enquanto trabalha o tríceps não reduz estímulo de
  // nenhum dos dois: são músculos diferentes, com fadiga local independente.
  // É o corte que elimina tempo morto sem tirar nada do treino.
  const isoladores = exs.filter((e) => !ehComposto(e.nome) && e.grupo_primario !== 'cardio');
  if (isoladores.length >= 2 && falta > 0) {
    const pares = Math.floor(isoladores.length / 2);
    const economia = pares * isoladores[0].series_alvo * Math.min(90, isoladores[0].descanso_seg);
    ajustes.push({
      tipo: 'superserie',
      titulo: 'Conjugar isoladores',
      descricao:
        `Alternar ${isoladores.slice(0, pares * 2).map((e) => e.nome.split(' ')[0]).join(', ')} ` +
        `sem descanso entre eles. São músculos diferentes: um descansa enquanto o outro trabalha, ` +
        `e nenhum dos dois perde estímulo.`,
      economiaSeg: economia,
      alvos: isoladores.slice(0, pares * 2).map((e) => e.id),
    });
    falta -= economia;
  }

  // ── 2. Encurtar descanso de isolador ───────────────────────────────────
  if (falta > 0 && isoladores.length) {
    const alvo = isoladores.filter((e) => e.descanso_seg > 60);
    const economia = alvo.reduce(
      (a, e) => a + Math.max(0, e.series_alvo - 1) * (e.descanso_seg - 60),
      0
    );
    if (economia > 0) {
      ajustes.push({
        tipo: 'descanso',
        titulo: 'Descanso de 60 s nos isoladores',
        descricao:
          'Isolador aguenta intervalo curto — a demanda é local, não sistêmica. O descanso longo ' +
          'fica onde importa: nos compostos, onde encurtar custa carga e repetição.',
        economiaSeg: economia,
        alvos: alvo.map((e) => e.id),
      });
      falta -= economia;
    }
  }

  // ── 3. Cortar acessório ────────────────────────────────────────────────
  // Sempre de trás para frente e nunca composto pesado: o que abre a sessão é
  // o que mais constrói, e é onde o corpo está inteiro.
  if (falta > 0) {
    const cortaveis = [...exs]
      .reverse()
      .filter((e) => !ehPesado(e.nome) && e.grupo_primario !== 'cardio');

    const cortados: RoutineExerciseFull[] = [];
    let economizado = 0;
    for (const e of cortaveis) {
      if (economizado >= falta) break;
      const reps = ((e.reps_min ?? 8) + (e.reps_max ?? 12)) / 2;
      economizado +=
        e.series_alvo * reps * SEG_POR_REP +
        Math.max(0, e.series_alvo - 1) * e.descanso_seg +
        SEG_TROCA;
      cortados.push(e);
    }

    if (cortados.length) {
      ajustes.push({
        tipo: 'cortar',
        titulo: `Deixar ${cortados.length} exercício${cortados.length > 1 ? 's' : ''} para outro dia`,
        descricao:
          `${cortados.map((e) => e.nome).join(', ')}. São os últimos da sessão — os que você já ` +
          `faria cansado, e os primeiros a sumir quando o tempo aperta de qualquer forma. Melhor ` +
          `decidir isso antes do que descobrir no relógio.`,
        economiaSeg: economizado,
        alvos: cortados.map((e) => e.id),
      });
      falta -= economizado;
    }
  }

  const economiaTotal = ajustes.reduce((a, x) => a + x.economiaSeg, 0);
  const final = est.totalSeg - economiaTotal;

  if (falta > 0) {
    ajustes.push({
      tipo: 'impossivel',
      titulo: 'Ainda não cabe',
      descricao:
        `Mesmo cortando, sobram ${emMinutos(falta)} min. Com este tempo, o caminho é dividir o ` +
        `treino em mais dias da semana em vez de espremer tudo numa sessão.`,
      economiaSeg: 0,
      alvos: [],
    });
  }

  return {
    estimado: est.totalSeg,
    disponivel,
    cabe: false,
    ajustes,
    finalSeg: Math.max(disponivel, final),
  };
}

/**
 * Quantos exercícios cabem num tempo, para gerar rotina já no tamanho certo.
 *
 * Usa a média de um exercício típico: 3 séries de 10 com 2 min de descanso.
 */
export function exerciciosQueCabem(minutos: number): number {
  const porExercicio = 3 * 10 * SEG_POR_REP + 2 * 120 + SEG_TROCA;
  return Math.max(3, Math.floor((minutos * 60 - SEG_AQUECIMENTO) / porExercicio));
}

// ── Perfil de tempo por dia ───────────────────────────────────────────────

export interface TempoDisponivel {
  /** Minutos por dia da semana. Índice 0 = domingo. */
  porDia: number[];
}

export const PADROES_TEMPO = [
  {
    chave: 'almoco',
    label: 'Horário de almoço',
    emoji: '🍽️',
    desc: '1 hora cravada, sem folga para atraso',
    semana: 55,
    fimDeSemana: 75,
  },
  {
    chave: 'apertado',
    label: 'Encaixado na rotina',
    emoji: '⏱️',
    desc: '1h a 1h30, depende do dia',
    semana: 75,
    fimDeSemana: 90,
  },
  {
    chave: 'confortavel',
    label: 'Sem correria',
    emoji: '🧘',
    desc: '1h30 a 2h, dá para fazer tudo',
    semana: 100,
    fimDeSemana: 120,
  },
  {
    chave: 'personalizado',
    label: 'Eu defino cada dia',
    emoji: '📅',
    desc: 'Segunda a domingo, um por um',
    semana: 75,
    fimDeSemana: 90,
  },
];

export function tempoDoDia(t: TempoDisponivel, diaSemana: number): number {
  return t.porDia[diaSemana] ?? 60;
}
