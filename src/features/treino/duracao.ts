import type { RoutineExerciseFull } from '@/db/types';
import { ehComposto, ehPesado } from './classificacao';
import { cadenciaDe, TEMPO_POR_REP_PADRAO, tempoPorRepSeg } from './execucao';

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

/**
 * Segundos por repetição — **e agora vindos da cadência prescrita**.
 *
 * O número cravado aqui era 3, e ele estava certo para a cadência canônica
 * (2 s descendo + 1 s subindo). O problema é que G3 passou a PRESCREVER cadência
 * por exercício: um stiff, cujo pico de tensão está na posição alongada, ganha
 * 1 s de pausa no fundo e custa 4 s por repetição. Com o 3 cravado, o app diria
 * "2-1-1" na tela do exercício e cobraria 3 s na conta da sessão — duas
 * definições do mesmo segundo, que é como o crossover chegou a ser composto numa
 * função e abertura em outra.
 *
 * `SEG_POR_REP` fica como o valor da cadência PADRÃO (o mesmo 3 de sempre), para
 * quem estima sem ter o exercício na mão; quem tem o exercício usa `segPorRepDe`.
 */
const SEG_POR_REP = TEMPO_POR_REP_PADRAO;

/** Segundos por repetição DESTE exercício, pela cadência que ele prescreve. */
const segPorRepDe = (e: {
  nome: string;
  grupo_primario: string;
  equipamento: string | null;
  tipo_carga: string;
}) => tempoPorRepSeg(cadenciaDe(e.nome, e.grupo_primario, e.equipamento, e.tipo_carga));

/** Trocar de exercício: achar, ajustar, montar. */
const SEG_TROCA = 90;
/** Aquecimento geral no começo da sessão. */
const SEG_AQUECIMENTO = 240;
/** Execução de uma aproximação: ~6 repetições leves em cadência controlada. */
const SEG_APROXIMACAO_EXEC = 6 * SEG_POR_REP;
/**
 * Descanso DEPOIS de uma aproximação — 60 s, não o descanso do exercício.
 *
 * Ribeiro et al. (PMC7558980) descansam 1 minuto entre as séries de
 * aquecimento e só então 3 minutos antes da série valendo. Herdar o descanso
 * do trabalho fazia duas aproximações num supino custarem 6 minutos parados,
 * sozinhas.
 */
export const SEG_DESCANSO_APROXIMACAO = 60;

export interface EstimativaTreino {
  totalSeg: number;
  execucaoSeg: number;
  descansoSeg: number;
  transicaoSeg: number;
  /** Quanto do treino é tempo parado. Costuma passar de 60% e surpreende. */
  pctDescanso: number;
}

/**
 * Estima a duração da MUSCULAÇÃO. Cardio não entra.
 *
 * O tempo que a pessoa informa no questionário é o que ela tem para levantar
 * peso — foi assim que ela entendeu a pergunta. Somar 20 min de esteira nesse
 * orçamento faz o app cortar exercício de força para caber o cardio, que é o
 * contrário da prioridade de quem quer hipertrofia. Pior: o corte acontecia em
 * silêncio, e a pessoa via um treino curto sem entender por quê.
 *
 * O cardio continua prescrito e continua aparecendo na sessão — só não disputa
 * o mesmo orçamento. Ele é o que vem DEPOIS do treino, não parte dele.
 */
export function estimarDuracao(exs: RoutineExerciseFull[]): EstimativaTreino {
  let execucao = 0;
  let descanso = 0;

  const forca = exs.filter((e) => e.grupo_primario !== 'cardio');

  for (const e of forca) {
    const reps = ((e.reps_min ?? 8) + (e.reps_max ?? 12)) / 2;
    const porSerie = e.tipo_carga === 'tempo' ? reps : reps * segPorRepDe(e);
    execucao += e.series_alvo * porSerie;
    // O descanso da última série não conta: você já foi para o próximo.
    descanso += Math.max(0, e.series_alvo - 1) * e.descanso_seg;

    // ── As séries de aproximação também gastam o relógio ──────────────────
    //
    // Elas não contam VOLUME (e é por isso que ficam fora de `set_logs` de
    // verdade), mas contam MINUTO: duas aproximações num supino são duas
    // séries e dois descansos. Ficarem de fora daqui era a reincidência de
    // A10 — o app declarando 55 min para uma sessão de 61.
    const aq = e.aquecimento_series ?? 0;
    if (aq > 0) {
      execucao += aq * SEG_APROXIMACAO_EXEC;
      descanso += aq * SEG_DESCANSO_APROXIMACAO;
    }
  }

  const transicao = SEG_AQUECIMENTO + forca.length * SEG_TROCA;
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
        e.series_alvo * reps * segPorRepDe(e) +
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
