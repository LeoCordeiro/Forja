/**
 * Preferência entre máquina e peso livre.
 *
 * Isto é preferência de verdade, não um lado certo e outro errado:
 *
 * · **Haugen (2023)**, revisão sistemática com meta-análise (13 estudos,
 *   1.016 participantes): hipertrofia igual entre as duas modalidades —
 *   SMD −0,055 (IC 95% −0,40 a 0,29; p = 0,75). Os autores fecham com
 *   "considere a preferência individual" e sugerem que a combinação pode
 *   render hipertrofia mais completa.
 * · **Position Stand do ACSM de 2026** coloca tipo de equipamento entre o que
 *   não precisa ser prescrito, e resume o princípio: o melhor programa é o que
 *   você mantém.
 *
 * O que MUDA de verdade é a especificidade da força: quem treina no peso livre
 * fica mais forte no teste de peso livre, quem treina na máquina fica mais
 * forte na máquina. Só isso.
 *
 * Por isso nenhuma opção é 100%. Agachamento livre não tem máquina equivalente
 * que treine a mesma coisa, e puxada alta não tem versão com halter que
 * substitua. A preferência inclina a seleção — não amputa o treino.
 */

export type PreferenciaEquipamento = 'livre' | 'maquina' | 'ambos';

export interface OpcaoEquipamento {
  chave: PreferenciaEquipamento;
  label: string;
  emoji: string;
  descricao: string;
  /** Fração de exercícios do tipo preferido, quando existe alternativa. */
  proporcao: number;
}

export const OPCOES_EQUIPAMENTO: OpcaoEquipamento[] = [
  {
    chave: 'livre',
    label: 'Mais peso livre',
    emoji: '🏋️',
    descricao:
      'Barra e halteres na maior parte. Exige mais técnica e equilíbrio, e a força que vem daí ' +
      'aparece melhor fora da academia.',
    proporcao: 0.75,
  },
  {
    chave: 'ambos',
    label: 'Misturar',
    emoji: '⚖️',
    descricao:
      'Composto pesado no peso livre, isolador na máquina. É o arranjo que a maioria dos programas ' +
      'usa — e a meta-análise sugere que a combinação cobre melhor o músculo inteiro.',
    proporcao: 0.5,
  },
  {
    chave: 'maquina',
    label: 'Mais máquina',
    emoji: '🎛️',
    descricao:
      'Máquina e polia na maior parte. Menos técnica para aprender, mais fácil chegar perto da ' +
      'falha sozinho com segurança. Cresce igual.',
    proporcao: 0.25,
  },
];

export const LABEL_EQUIPAMENTO: Record<PreferenciaEquipamento, string> = {
  livre: 'Mais peso livre',
  maquina: 'Mais máquina',
  ambos: 'Misturado',
};

/** Como o app classifica cada exercício do catálogo. */
export function tipoDeEquipamento(equipamento: string | null): 'livre' | 'maquina' | 'neutro' {
  if (!equipamento) return 'neutro';
  if (['barra', 'halter', 'livre', 'kettlebell'].includes(equipamento)) return 'livre';
  if (['maquina', 'cabo', 'polia', 'smith'].includes(equipamento)) return 'maquina';
  return 'neutro';
}

/**
 * Ordena candidatos de um mesmo grupo muscular pela preferência.
 *
 * Não filtra: reordena. Exercício sem equivalente do outro tipo continua
 * disponível — tirar agachamento de quem prefere máquina custaria mais do que
 * a preferência vale.
 */
export function ordenarPorPreferencia<T extends { equipamento: string | null }>(
  candidatos: T[],
  pref: PreferenciaEquipamento
): T[] {
  if (pref === 'ambos') return candidatos;
  const desejado = pref === 'livre' ? 'livre' : 'maquina';
  return [...candidatos].sort((a, b) => {
    const ta = tipoDeEquipamento(a.equipamento) === desejado ? 0 : 1;
    const tb = tipoDeEquipamento(b.equipamento) === desejado ? 0 : 1;
    return ta - tb;
  });
}

/**
 * O que a preferência NÃO muda. Aparece na tela junto da escolha, porque a
 * pergunta seguinte é sempre "então estou perdendo alguma coisa?".
 */
export const AVISO_EQUIPAMENTO =
  'Nenhuma das opções é 100%: agachamento não tem máquina que treine a mesma coisa, e puxada não ' +
  'tem versão com halter que substitua. A preferência inclina a escolha quando existe alternativa ' +
  'de verdade — e músculo cresce igual nos dois caminhos.';
