/**
 * O plano do bloco: quanto tempo nesta rotina, o que muda a cada semana e
 * quando trocar.
 *
 * A pergunta "vou ficar com esse treino 1 mês, 2, quantos?" não tinha resposta
 * no app — e sem ela não existe progressão, existe repetição.
 *
 * ── Base ────────────────────────────────────────────────────────────────
 *
 * **Bloco de 8 semanas com os mesmos exercícios.** Trocar exercício toda
 * semana destrói o único sinal que diz se você está progredindo: a carga do
 * mesmo movimento subindo. Baz-Valle (2019) comparou seleção fixa contra
 * rotação aleatória em treinados por 8 semanas — hipertrofia e força iguais,
 * só a motivação foi maior no rotativo. A revisão de Kassiano (2022, 8 estudos)
 * conclui na mesma linha: variação estratégica ajuda, variação excessiva ou
 * aleatória atrapalha.
 *
 * **Progressão dupla.** Bateu o topo da faixa de repetições em todas as séries
 * → sobe a carga na próxima sessão e volta ao fundo da faixa. É o método que
 * transforma "ir na academia" em sobrecarga progressiva mensurável.
 *
 * **Semana 8 é leve, não parada.** Coleman (2024, PeerJ, 50 participantes)
 * testou uma semana inteira sem treinar no meio de um programa de 9 semanas:
 * piorou força de membro inferior e não trouxe nada para hipertrofia. Reduzir
 * volume mantendo a carga preserva o estímulo e ainda dissipa a fadiga.
 *
 * **Trocar exercício, não o programa.** Quando a carga de UM exercício não sai
 * do lugar em 3 sessões seguidas, o problema é aquele exercício — não a
 * rotina inteira.
 */

import type { Fase } from './periodizacao';

export interface SemanaDoBloco {
  semana: number;
  titulo: string;
  volumePct: number;
  rir: string;
  o_que_fazer: string;
}

export const SEMANAS_DO_BLOCO = 8;

export const BLOCO: SemanaDoBloco[] = [
  {
    semana: 1,
    titulo: 'Calibrar',
    volumePct: 100,
    rir: '3',
    o_que_fazer:
      'Descobrir a carga de cada exercício. Termine cada série com umas 3 repetições ainda no tanque — é o número de referência para as próximas 7 semanas.',
  },
  {
    semana: 2,
    titulo: 'Somar repetição',
    volumePct: 100,
    rir: '2 a 3',
    o_que_fazer: 'Mesma carga da semana 1, buscando 1 ou 2 repetições a mais em cada série.',
  },
  {
    semana: 3,
    titulo: 'Primeira subida de carga',
    volumePct: 100,
    rir: '2',
    o_que_fazer:
      'Onde bateu o topo da faixa em todas as séries, sobe: +2,5 kg em exercício de tronco, +5 kg em perna. As repetições caem, e tudo bem.',
  },
  {
    semana: 4,
    titulo: 'Consolidar',
    volumePct: 100,
    rir: '2',
    o_que_fazer: 'Repetir a carga nova até ela ficar confortável. É aqui que o corpo aceita o salto.',
  },
  {
    semana: 5,
    titulo: 'Segunda subida',
    volumePct: 110,
    rir: '1 a 2',
    o_que_fazer:
      'Sobe carga de novo onde deu, e entra uma série a mais nos dois exercícios principais do dia.',
  },
  {
    semana: 6,
    titulo: 'Apertar',
    volumePct: 110,
    rir: '1',
    o_que_fazer:
      'Semana mais dura do bloco. Chegar a 1 repetição da falha nas últimas séries — sem passar dela.',
  },
  {
    semana: 7,
    titulo: 'Pico',
    volumePct: 110,
    rir: '1',
    o_que_fazer: 'Maior carga do bloco nos compostos. É a semana que vira o número do seu recorde.',
  },
  {
    semana: 8,
    titulo: 'Aliviar',
    volumePct: 55,
    rir: '4',
    o_que_fazer:
      'Metade das séries, mesma carga. Não é folga: manter o peso é o que segura a força enquanto a fadiga sai.',
  },
];

/**
 * Que FASE é a semana do bloco — uma definição só (M3-texto).
 *
 * A regra vivia dentro de `resolverFase`, e a tela do programa não a tinha:
 * ela imprimia o campo `rir` cru da semana ("parar a 3 da falha") ao lado de
 * linhas que dizem RIR 1-2 e RIR 0-2. Mesmo defeito do chip do executor, outra
 * tela. Com a fase nomeada aqui, as duas leem a direção do mesmo lugar.
 */
export function faseDaSemanaDoBloco(s: SemanaDoBloco, semana: number): Fase {
  return s.volumePct < 100 ? 'deload' : semana >= 5 ? 'intensificacao' : 'acumulo';
}

export function semanaDoBloco(inicioIso: string | null, hojeIso: string): number {
  if (!inicioIso) return 1;
  const d = (Date.parse(hojeIso) - Date.parse(inicioIso)) / 86400000;
  if (Number.isNaN(d) || d < 0) return 1;
  return Math.min(SEMANAS_DO_BLOCO, Math.floor(d / 7) + 1);
}

export function faseAtual(semana: number): SemanaDoBloco {
  return BLOCO[Math.min(SEMANAS_DO_BLOCO, Math.max(1, semana)) - 1];
}

/** Quantos dias faltam para o bloco fechar. Negativo = já passou da hora. */
export function diasRestantes(inicioIso: string | null, hojeIso: string): number {
  if (!inicioIso) return SEMANAS_DO_BLOCO * 7;
  const fim = Date.parse(inicioIso) + SEMANAS_DO_BLOCO * 7 * 86400000;
  return Math.round((fim - Date.parse(hojeIso)) / 86400000);
}

// ── Objetivo declarado ────────────────────────────────────────────────────

export interface ObjetivoTreino {
  titulo: string;
  porque: string;
  /** Como saber, sem espelho, se está funcionando. */
  comoMedir: string[];
  /** O que NÃO é objetivo deste bloco — evita cobrar o que ele não entrega. */
  naoEsperar: string;
}

export function objetivoDoBloco(
  objetivo: string,
  pesoKg: number,
  gorduraPct: number | null
): ObjetivoTreino {
  if (objetivo === 'recomposicao') {
    const alvoGordura = gorduraPct ? Math.max(15, Math.round(gorduraPct - 4)) : null;
    return {
      titulo: 'Recomposição: ganhar músculo enquanto perde gordura',
      porque:
        'Você reúne as três condições em que a recomposição de fato acontece: gordura corporal acima de 20%, ' +
        'retorno depois de uma pausa (memória muscular) e proteína alta. Nessas condições dá para as duas coisas ' +
        'andarem juntas — fora delas, quase nunca dá.',
      comoMedir: [
        'Carga subindo nos compostos com o mesmo número de repetições — é o sinal de que o músculo está respondendo',
        'Peso na balança quase parado enquanto a cintura diminui: é exatamente isso que recomposição parece',
        `Gordura corporal caindo${alvoGordura ? ` na direção de ${alvoGordura}%` : ''} na próxima bioimpedância`,
        'Foto de frente e de lado a cada 4 semanas, mesma luz e mesma hora',
      ],
      naoEsperar:
        'Peso despencando na balança. Se cair rápido, você está perdendo músculo junto — e músculo perdido em ' +
        'déficit é o que faz o peso voltar depois.',
    };
  }

  if (objetivo === 'perder_gordura') {
    return {
      titulo: 'Perder gordura mantendo a massa que você já tem',
      porque:
        'Em déficit calórico o treino de força não serve para queimar caloria — serve para dizer ao corpo que o ' +
        'músculo é necessário. Sem ele, boa parte do peso perdido sai de massa magra.',
      comoMedir: [
        'Carga se mantendo nos compostos mesmo comendo menos — isso é vitória em déficit',
        `Peso caindo de 0,5% a 1% por semana (${(pesoKg * 0.005).toFixed(1)} a ${(pesoKg * 0.01).toFixed(1)} kg)`,
        'Medida de cintura caindo mais rápido que a do braço e da coxa',
      ],
      naoEsperar: 'Recordes de força. Em déficit, manter carga já é progresso.',
    };
  }

  return {
    titulo: 'Ganhar massa muscular',
    porque:
      'Volume semanal suficiente por grupo muscular, com carga subindo ao longo das semanas e comida sobrando ' +
      'para construir. É a combinação que a literatura mostra como determinante — o resto é detalhe.',
    comoMedir: [
      'Carga ou repetição subindo semana a semana nos mesmos exercícios',
      `Peso subindo devagar: 0,25% a 0,5% por semana (${(pesoKg * 0.0025).toFixed(1)} a ${(pesoKg * 0.005).toFixed(1)} kg)`,
      'Medida de braço, peito e coxa a cada 4 semanas',
    ],
    naoEsperar:
      'Ganhar músculo sem ganhar nenhuma gordura. Uma parte vem junto — o que dá para controlar é a proporção.',
  };
}
