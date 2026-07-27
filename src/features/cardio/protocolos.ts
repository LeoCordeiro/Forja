/**
 * Cardio: protocolos e as regras de convivência com a musculação.
 *
 * ── Cardio mata o ganho? Não, mas depende de como ────────────────────────
 *
 * Schumann (2022), a maior revisão do tema, com 43 estudos: treino concorrente
 * **não reduz** de forma relevante força máxima nem hipertrofia, em qualquer
 * idade, nível ou tipo de aeróbio.
 *
 * Onde a interferência aparece de verdade:
 *
 * · **Potência explosiva** cai cerca de 28% — e principalmente quando as duas
 *   coisas acontecem na MESMA sessão.
 * · **Corrida atrapalha mais que bicicleta ou remo.** A meta-análise separa:
 *   musculação + corrida mostra prejuízo em hipertrofia e força; com bicicleta
 *   o efeito é mínimo. É o dano excêntrico da passada.
 * · **Separar por 24 h** dá mais força que fazer junto. Quando as sessões ficam
 *   separadas por horas ou dias, a interferência cai para −0,10 — na prática,
 *   indistinguível de zero.
 * · **Volume alto** de aeróbio somado a treinar pesado com frequência aumenta
 *   o risco.
 *
 * ── HIIT é melhor que zona 2 para gordura? ───────────────────────────────
 *
 * Para gordura visceral, não: meta-análise de 11 ensaios randomizados não achou
 * modalidade superior. Outra, com 29 estudos, dá vantagem ao HIIT em
 * circunferência de cintura e VO2 pico. Ou seja: HIIT rende mais condicionamento
 * no mesmo tempo, zona 2 cobra menos recuperação. Os dois queimam.
 *
 * O que decide é quanto você aguenta manter — e HIIT em cima de musculação
 * pesada é a receita mais rápida de furar a semana inteira.
 */

export type TipoCardio = 'zona2' | 'hiit' | 'sit' | 'caminhada';

export interface Bloco {
  /** Segundos. */
  duracao: number;
  intensidade: 'forte' | 'leve' | 'moderado';
  rotulo: string;
}

export interface ProtocoloCardio {
  chave: string;
  nome: string;
  tipo: TipoCardio;
  emoji: string;
  /** Minutos totais, incluindo aquecimento e volta à calma. */
  minutos: number;
  descricao: string;
  /** Como saber que está na intensidade certa, sem monitor cardíaco. */
  comoSaber: string;
  /** Quanto atrapalha a musculação: 0 nada, 3 bastante. */
  interferencia: 0 | 1 | 2 | 3;
  quando: string;
  aquecimentoSeg: number;
  blocos: Bloco[];
  repeticoes: number;
  desaquecimentoSeg: number;
  /** Equipamento que menos interfere para este protocolo. */
  preferir: string;
}

export const PROTOCOLOS: ProtocoloCardio[] = [
  {
    chave: 'zona2_30',
    nome: 'Zona 2 · 30 min',
    tipo: 'zona2',
    emoji: '🚴',
    minutos: 34,
    descricao:
      'Ritmo contínuo em que dá para conversar em frases inteiras. É a base aeróbica: rende gordura ' +
      'e coração sem cobrar quase nada da recuperação.',
    comoSaber: 'Você consegue falar uma frase completa sem parar para respirar. Se só sai palavra solta, está forte demais.',
    interferencia: 0,
    quando: 'Qualquer dia, inclusive depois da musculação.',
    aquecimentoSeg: 180,
    blocos: [{ duracao: 1800, intensidade: 'moderado', rotulo: 'Zona 2 contínua' }],
    repeticoes: 1,
    desaquecimentoSeg: 60,
    preferir: 'Bicicleta, elíptico ou caminhada inclinada',
  },
  {
    chave: 'zona2_45',
    nome: 'Zona 2 · 45 min',
    tipo: 'zona2',
    emoji: '🚲',
    minutos: 49,
    descricao: 'Mesma coisa, mais longa. Para quando o objetivo é gasto calórico e a perna aguenta.',
    comoSaber: 'Mesma referência: frase inteira sem ofegar.',
    interferencia: 1,
    quando: 'De preferência em dia sem treino de perna.',
    aquecimentoSeg: 180,
    blocos: [{ duracao: 2700, intensidade: 'moderado', rotulo: 'Zona 2 contínua' }],
    repeticoes: 1,
    desaquecimentoSeg: 60,
    preferir: 'Bicicleta ou elíptico',
  },
  {
    chave: 'hiit_30_30',
    nome: 'HIIT 30/30',
    tipo: 'hiit',
    emoji: '⚡',
    minutos: 20,
    descricao:
      'Trinta segundos forte, trinta leves, doze vezes. O HIIT mais fácil de encaixar: entra em ' +
      '20 minutos e não exige aguentar 4 minutos duros seguidos.',
    comoSaber: 'No bloco forte você não consegue falar. No leve, você recupera o suficiente para começar o próximo.',
    interferencia: 2,
    quando: 'Dia sem treino de perna, ou pelo menos 6 h depois da musculação.',
    aquecimentoSeg: 300,
    blocos: [
      { duracao: 30, intensidade: 'forte', rotulo: 'Forte' },
      { duracao: 30, intensidade: 'leve', rotulo: 'Recupera' },
    ],
    repeticoes: 12,
    desaquecimentoSeg: 180,
    preferir: 'Bicicleta ergométrica',
  },
  {
    chave: 'hiit_4x4',
    nome: 'HIIT 4×4 norueguês',
    tipo: 'hiit',
    emoji: '🔥',
    minutos: 38,
    descricao:
      'Quatro minutos duros, três de recuperação, quatro vezes. É o protocolo mais estudado para ' +
      'VO2 máximo — e o mais desconfortável desta lista.',
    comoSaber: 'No 4º minuto do bloco forte você está contando os segundos. Se sobrou fôlego, faltou intensidade.',
    interferencia: 3,
    quando: 'Longe do treino de perna: 24 h antes ou depois, no mínimo.',
    aquecimentoSeg: 600,
    blocos: [
      { duracao: 240, intensidade: 'forte', rotulo: 'Forte' },
      { duracao: 180, intensidade: 'leve', rotulo: 'Recupera' },
    ],
    repeticoes: 4,
    desaquecimentoSeg: 300,
    preferir: 'Bicicleta, elíptico ou esteira inclinada',
  },
  {
    chave: 'sit_20',
    nome: 'Sprints 20s',
    tipo: 'sit',
    emoji: '💥',
    minutos: 17,
    descricao:
      'Vinte segundos no máximo absoluto, dois minutos leves, seis vezes. Curtíssimo e brutal — ' +
      'condicionamento no menor tempo possível.',
    comoSaber: 'Se você consegue repetir o mesmo esforço no 6º sprint sem queda, não estava no máximo.',
    interferencia: 3,
    quando: 'Nunca no dia anterior ao treino de perna.',
    aquecimentoSeg: 300,
    blocos: [
      { duracao: 20, intensidade: 'forte', rotulo: 'Máximo' },
      { duracao: 120, intensidade: 'leve', rotulo: 'Recupera' },
    ],
    repeticoes: 6,
    desaquecimentoSeg: 180,
    preferir: 'Bicicleta ergométrica (sem impacto)',
  },
  {
    chave: 'caminhada',
    nome: 'Caminhada inclinada',
    tipo: 'caminhada',
    emoji: '🚶',
    minutos: 40,
    descricao:
      'Esteira em inclinação, ritmo confortável. Gasto calórico decente com interferência praticamente ' +
      'nula — a opção certa quando a semana já está pesada.',
    comoSaber: 'Inclinação de 8 a 12%, velocidade em que você respira mais fundo mas conversa normal.',
    interferencia: 0,
    quando: 'Qualquer dia, inclusive logo depois de treinar.',
    aquecimentoSeg: 120,
    blocos: [{ duracao: 2280, intensidade: 'moderado', rotulo: 'Caminhada inclinada' }],
    repeticoes: 1,
    desaquecimentoSeg: 120,
    preferir: 'Esteira com inclinação',
  },
];

export function protocoloPor(chave: string): ProtocoloCardio | undefined {
  return PROTOCOLOS.find((p) => p.chave === chave);
}

/** Duração total real do protocolo, em segundos. */
export function duracaoTotal(p: ProtocoloCardio): number {
  const ciclo = p.blocos.reduce((a, b) => a + b.duracao, 0);
  return p.aquecimentoSeg + ciclo * p.repeticoes + p.desaquecimentoSeg;
}

/** Sequência linear de blocos, já expandida — é o que o timer executa. */
export function sequencia(p: ProtocoloCardio): Bloco[] {
  const out: Bloco[] = [{ duracao: p.aquecimentoSeg, intensidade: 'leve', rotulo: 'Aquecimento' }];
  for (let i = 0; i < p.repeticoes; i++) {
    for (const b of p.blocos) {
      out.push({
        ...b,
        rotulo: p.repeticoes > 1 ? `${b.rotulo} ${i + 1}/${p.repeticoes}` : b.rotulo,
      });
    }
  }
  out.push({ duracao: p.desaquecimentoSeg, intensidade: 'leve', rotulo: 'Volta à calma' });
  return out;
}

// ── Regras de convivência ─────────────────────────────────────────────────

export const REGRAS_CONVIVENCIA = [
  {
    titulo: 'Bicicleta em vez de corrida',
    texto:
      'A meta-análise separa por modalidade: musculação com corrida mostra prejuízo em força e ' +
      'hipertrofia; com bicicleta, o efeito é mínimo. O problema é o dano da passada, não o cardio.',
  },
  {
    titulo: 'Separar por 24 horas rende mais',
    texto:
      'Sessões separadas por um dia dão mais força que fazer as duas juntas. Separadas por horas ou ' +
      'dias, a interferência vira −0,10 — na prática, zero.',
  },
  {
    titulo: 'Se for junto, musculação primeiro',
    texto: 'Cardio antes derruba a carga do treino inteiro. Depois, o custo é bem menor.',
  },
  {
    titulo: 'HIIT longe do dia de perna',
    texto:
      'É onde a interferência de fato aparece. Zona 2 pode em qualquer dia; HIIT pede 24 h de ' +
      'distância do treino pesado de perna.',
  },
];

/**
 * Distribui as sessões de cardio na semana sabendo quais dias têm musculação.
 *
 * Não é enfeite: a regra de 24 h só serve se o app souber onde os treinos estão.
 */
export function planoSemanal(
  diasDeTreino: number[],
  sessoes: number,
  permitirHiit: boolean
): { dia: number; protocolo: string; motivo: string }[] {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const livres = [0, 1, 2, 3, 4, 5, 6].filter((d) => !diasDeTreino.includes(d));
  const plano: { dia: number; protocolo: string; motivo: string }[] = [];

  // HIIT primeiro, e só em dia livre — é onde ele custa menos.
  if (permitirHiit && livres.length > 0) {
    plano.push({
      dia: livres[0],
      protocolo: 'hiit_30_30',
      motivo: `${nomes[livres[0]]} não tem musculação — é onde o HIIT custa menos.`,
    });
  }

  // O resto vira zona 2, distribuída no que sobrou.
  const restantes = sessoes - plano.length;
  const candidatos = [...livres.slice(plano.length), ...diasDeTreino];
  for (let i = 0; i < restantes && i < candidatos.length; i++) {
    const dia = candidatos[i];
    const temTreino = diasDeTreino.includes(dia);
    plano.push({
      dia,
      protocolo: 'zona2_30',
      motivo: temTreino
        ? `${nomes[dia]} tem musculação — zona 2 depois do treino não atrapalha.`
        : `${nomes[dia]} está livre.`,
    });
  }

  return plano.sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7));
}
