/**
 * Diagnóstico: o que te incomoda hoje.
 *
 * Regra que vale para o arquivo inteiro: **toda resposta muda algo concreto na
 * prescrição.** Pergunta que não altera nada é teatro — faz o app parecer
 * atencioso e entrega o mesmo treino genérico no fim.
 *
 * ── A verdade sobre gordura localizada ─────────────────────────────────
 *
 * Não dá para escolher de onde a gordura sai. Meta-análise de 13 estudos com
 * 1.158 participantes: treinar um músculo específico **não** reduz a gordura
 * em cima dele — o efeito agrupado é essencialmente zero, em qualquer idade,
 * sexo ou tipo de exercício. Abdominal não queima barriga.
 *
 * O que decide onde a gordura sai é genética e hormônio. O que decide QUANTA
 * sai é déficit calórico sustentado.
 *
 * Isso não é má notícia, e o app não pode fingir o contrário para agradar. A
 * notícia boa é outra e é específica: a gordura **visceral** — a profunda, que
 * empurra a barriga para fora — é a que mais responde a exercício e a déficit.
 * Ela some antes da subcutânea. Então "perder barriga" acontece; só não
 * acontece por causa de abdominal.
 */

export type ChaveIncomodo =
  | 'barriga'
  | 'massa_geral'
  | 'braco'
  | 'peito'
  | 'perna'
  | 'postura'
  | 'condicionamento'
  | 'dor';

export interface Incomodo {
  chave: ChaveIncomodo;
  label: string;
  emoji: string;
  /** O que a resposta faz de verdade no plano. Aparece na tela, sem promessa vaga. */
  efeito: string;
}

export const INCOMODOS: Incomodo[] = [
  {
    chave: 'barriga',
    label: 'Barriga',
    emoji: '🎯',
    efeito: 'Entra cardio programado, meta de passos e acompanhamento semanal de cintura.',
  },
  {
    chave: 'massa_geral',
    label: 'Falta de músculo no corpo todo',
    emoji: '💪',
    efeito: 'Volume distribuído em todos os grupos, com composto pesado abrindo cada dia.',
  },
  {
    chave: 'braco',
    label: 'Braço fino',
    emoji: '🦾',
    efeito: 'Séries extras de bíceps e tríceps, sem tirar volume das costas e do peito.',
  },
  {
    chave: 'peito',
    label: 'Peito',
    emoji: '🫁',
    efeito: 'Peito em 2 dias da semana, com ângulos diferentes em cada um.',
  },
  {
    chave: 'perna',
    label: 'Perna',
    emoji: '🦵',
    efeito: 'Um dia inteiro de perna, com agachamento e terra abrindo a sessão.',
  },
  {
    chave: 'postura',
    label: 'Postura / ombro caído',
    emoji: '🧍',
    efeito: 'Puxada horizontal e face pull em todo treino de tronco, mais mobilidade torácica.',
  },
  {
    chave: 'condicionamento',
    label: 'Cansaço no dia a dia',
    emoji: '🫀',
    efeito: 'Progressão de cardio zona 2 antes de qualquer HIIT, medindo pela frequência cardíaca.',
  },
  {
    chave: 'dor',
    label: 'Dor ao treinar',
    emoji: '🩹',
    efeito: 'Exercícios que carregam a região dolorida saem e entram substitutos.',
  },
];

// ── Onde acumula gordura ──────────────────────────────────────────────────

export const ONDE_ACUMULA = [
  { chave: 'abdome', label: 'Barriga e tronco', emoji: '🍺' },
  { chave: 'quadril', label: 'Quadril e coxa', emoji: '🍐' },
  { chave: 'espalhada', label: 'Espalhada', emoji: '🌫️' },
];

// ── O que já fez desistir ─────────────────────────────────────────────────

export const DESISTENCIAS = [
  {
    chave: 'tempo',
    label: 'Falta de tempo',
    emoji: '⏱️',
    efeito: 'Sessões mais curtas e densas: isoladores em série conjugada, menos exercícios.',
  },
  {
    chave: 'resultado',
    label: 'Não vi resultado',
    emoji: '📉',
    efeito: 'Medição a cada 2 semanas e alerta quando a carga para de subir.',
  },
  {
    chave: 'dor',
    label: 'Comecei a sentir dor',
    emoji: '🤕',
    efeito: 'Progressão de carga mais lenta e amplitude antes de peso.',
  },
  {
    chave: 'tedio',
    label: 'Enjoei do treino',
    emoji: '🥱',
    efeito: 'Troca de exercícios a cada bloco, mantendo o padrão de movimento.',
  },
  {
    chave: 'nao_sabia',
    label: 'Não sabia o que fazer',
    emoji: '❓',
    efeito: 'Vídeo em cada exercício e ordem já definida — é só seguir a tela.',
  },
  { chave: 'nunca', label: 'Nunca parei por isso', emoji: '✅', efeito: 'Nada muda.' },
];

// ── Dores por região ──────────────────────────────────────────────────────

/**
 * As regiões que o app pergunta — e o que ele faz com cada resposta.
 *
 * ── `exemplos` NÃO é a regra ─────────────────────────────────────────────
 *
 * Era. O campo se chamava `evitar`, o gerador filtrava por ele e o critério
 * que escreveu os nomes foi o implemento: lombar evitava `Stiff` e mantinha
 * `Levantamento terra romeno`; joelho evitava `Afundo com barra` e mantinha o
 * afundo com halteres; ombro evitava a `Elevação lateral` — 12-20 repetições,
 * RIR 2 — e mantinha a `Remada alta`, que é abdução com rotação interna feita
 * com barra pesada. Em G2 isso mordeu: tirar a elevação lateral abriu a vaga
 * do padrão e a remada alta entrou no lugar dela em 23 perfis.
 *
 * A regra agora sai de padrão de movimento + atributos, em
 * `src/features/treino/contraindicacao.ts`, e vale para o catálogo inteiro.
 * O que sobrou aqui são **exemplos para a tela** — os nomes conhecidos que a
 * pessoa reconhece ao ler "saem do treino". Renomeado de propósito: lista
 * antiga viva ao lado da regra nova não é neutra, é a que a próxima pessoa
 * acha primeiro.
 */
export const REGIOES_DOR = [
  {
    chave: 'ombro',
    label: 'Ombro',
    exemplos: ['Desenvolvimento militar', 'Remada alta', 'Mergulho no paralelo', 'Supino reto com barra'],
  },
  {
    chave: 'lombar',
    label: 'Lombar',
    exemplos: ['Levantamento terra', 'Agachamento livre', 'Stiff', 'Bom dia com barra'],
  },
  {
    chave: 'joelho',
    label: 'Joelho',
    exemplos: ['Agachamento livre', 'Afundo com halteres', 'Agachamento búlgaro', 'Hack machine'],
  },
  {
    chave: 'punho',
    label: 'Punho',
    exemplos: ['Rosca direta com barra', 'Supino fechado', 'Flexão de braço'],
  },
  {
    chave: 'cotovelo',
    label: 'Cotovelo',
    exemplos: ['Tríceps testa', 'Rosca scott', 'Mergulho no paralelo'],
  },
];

// ── Resposta do app ao diagnóstico ────────────────────────────────────────

export interface Diagnostico {
  incomodo: ChaveIncomodo | null;
  ondeAcumula: string | null;
  desistencia: string | null;
  doresRegioes: string[];
  minutosPorSessao: number;
  passosHoje: number | null;
}

export interface PlanoDoDiagnostico {
  titulo: string;
  /** A verdade que a pessoa precisa ouvir antes de qualquer promessa. */
  realidade: string;
  /** O que o app vai fazer, item a item. Nada vago. */
  acoes: string[];
  /**
   * Exemplos de exercícios que saem por causa de dor relatada.
   *
   * Exemplos, e não a lista fechada: quem decide é `contraindicacao.ts`, sobre
   * o catálogo inteiro. Esta tela roda no onboarding, antes de existir plano —
   * ela mostra o que a pessoa reconhece, não o resultado do filtro.
   */
  evitar: string[];
  /** Meta diária de passos, quando faz parte do plano. */
  passosAlvo: number | null;
  /** Quantas sessões de cardio por semana. */
  cardioSessoes: number;
}

export function planoPara(d: Diagnostico, pesoKg: number): PlanoDoDiagnostico {
  const evitar = [
    ...new Set(d.doresRegioes.flatMap((r) => REGIOES_DOR.find((x) => x.chave === r)?.exemplos ?? [])),
  ];

  if (d.incomodo === 'barriga') {
    // Passos: base de 8 mil, subindo se a pessoa já anda pouco. É a variável
    // que mais move gasto diário sem custar recuperação de treino.
    const base = d.passosHoje ?? 6000;
    const alvo = Math.min(12000, Math.max(8000, Math.round((base + 3000) / 500) * 500));

    return {
      titulo: 'Perder barriga sem perder músculo',
      realidade:
        'Abdominal não queima barriga. Meta-análise de 13 estudos com 1.158 pessoas: treinar um ' +
        'músculo não tira a gordura de cima dele — o efeito é zero. Onde a gordura sai é genética; ' +
        'quanto sai é déficit. A parte boa é específica: a gordura visceral, a profunda que empurra ' +
        'a barriga para fora, é justamente a que mais responde a exercício e déficit. Ela sai antes.',
      acoes: [
        `Meta de ${alvo.toLocaleString('pt-BR')} passos por dia — é o que mais aumenta gasto sem cobrar recuperação`,
        'Cintura medida toda semana, no mesmo dia e em jejum: é o número que responde primeiro',
        'Cardio programado, com bicicleta em vez de corrida nos dias de perna',
        'Musculação preservada: músculo é o que segura o gasto de repouso enquanto você come menos',
        'Abdômen treinado pela função e pela aparência — não como estratégia de queima',
      ],
      evitar,
      passosAlvo: alvo,
      cardioSessoes: 3,
    };
  }

  if (d.incomodo === 'condicionamento') {
    return {
      titulo: 'Condicionamento primeiro',
      realidade:
        'Cansaço no dia a dia é capacidade aeróbica, e ela responde rápido — semanas, não meses. ' +
        'Mas HIIT antes de ter base cobra caro em recuperação e atrapalha a musculação.',
      acoes: [
        'Zona 2 (dá para conversar) por 4 semanas antes de qualquer HIIT',
        'Bicicleta ou elíptico: interferem menos na perna que corrida',
        'Progressão por tempo, não por intensidade, até fechar 40 minutos contínuos',
      ],
      evitar,
      passosAlvo: 8000,
      cardioSessoes: 4,
    };
  }

  if (d.incomodo === 'dor') {
    return {
      titulo: 'Treinar sem piorar a dor',
      realidade:
        'Dor que aparece no exercício não se resolve com "pegar leve" — se resolve trocando o ' +
        'movimento que provoca por outro que treina o mesmo músculo sem a posição que dói. ' +
        'Dor persistente é assunto de fisioterapeuta, não de app.',
      acoes: [
        evitar.length
          ? `Sai do treino tudo que carrega a região — ${evitar.slice(0, 3).join(', ')} e o que se move igual`
          : 'Marque a região que dói para o app trocar os exercícios',
        'Amplitude completa com carga menor antes de voltar a subir peso',
        'Mobilidade da região dolorida em todo aquecimento',
      ],
      evitar,
      passosAlvo: null,
      cardioSessoes: 2,
    };
  }

  return {
    titulo: 'Construir músculo no corpo todo',
    realidade:
      'Músculo cresce com volume semanal suficiente e carga subindo ao longo das semanas. ' +
      'O resto — ordem, aparelho, horário — muda pouco.',
    acoes: [
      'Todo grupo muscular pelo menos 2× por semana',
      'Pelo menos 10 séries semanais por grupo, contando as indiretas pela metade',
      'Carga registrada em cada série: sem o número, não existe progressão',
      `Comer perto de ${Math.round(pesoKg * 2.2)} g de proteína por dia`,
    ],
    evitar,
    passosAlvo: null,
    cardioSessoes: 2,
  };
}
