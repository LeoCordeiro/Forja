/**
 * Mobilidade, alongamento e movimento livre.
 *
 * Duas coisas diferentes que costumam ser confundidas:
 *
 * - MOBILIDADE dinâmica, ANTES do treino: prepara a articulação para a
 *   amplitude que ela vai usar. Movimento, não posição parada.
 * - ALONGAMENTO estático, DEPOIS ou em sessão separada: ganha flexibilidade
 *   de longo prazo. Feito antes, reduz força temporariamente — por isso não
 *   entra no aquecimento.
 *
 * Amplitude também é treino: agachar fundo com controle constrói mais que
 * agachar meio caminho com o dobro do peso.
 */

export interface Movimento {
  nome: string;
  duracaoSeg: number;
  /** Repetições, para os dinâmicos que não se medem por tempo. */
  reps?: number;
  bilateral?: boolean;
  instrucao: string;
  erro?: string;
}

export interface RotinaMobilidade {
  chave: string;
  nome: string;
  emoji: string;
  quando: string;
  duracaoMin: number;
  tipo: 'dinamico' | 'estatico' | 'livre';
  descricao: string;
  movimentos: Movimento[];
}

export const ROTINAS: RotinaMobilidade[] = [
  {
    chave: 'aquecimento_geral',
    nome: 'Aquecimento antes do treino',
    emoji: '🔥',
    quando: 'Antes de qualquer treino de força',
    duracaoMin: 6,
    tipo: 'dinamico',
    descricao:
      'Movimento dinâmico para elevar a temperatura e preparar as articulações. Nada de alongamento parado aqui — antes do treino ele reduz força.',
    movimentos: [
      {
        nome: 'Rotação de ombros',
        duracaoSeg: 30,
        reps: 15,
        instrucao: 'Braços estendidos, círculos amplos para frente e depois para trás.',
      },
      {
        nome: 'Rotação de quadril',
        duracaoSeg: 30,
        reps: 10,
        bilateral: true,
        instrucao: 'Mãos na cintura, círculos com o quadril nos dois sentidos.',
      },
      {
        nome: 'Balanço de perna',
        duracaoSeg: 40,
        reps: 12,
        bilateral: true,
        instrucao: 'Apoie numa parede e balance a perna para frente e para trás, solta.',
        erro: 'Não force a amplitude no começo — ela aumenta a cada repetição.',
      },
      {
        nome: 'Agachamento com peso corporal',
        duracaoSeg: 45,
        reps: 15,
        instrucao: 'Agache o mais fundo que conseguir com controle, sem peso.',
      },
      {
        nome: 'Gato e camelo',
        duracaoSeg: 40,
        reps: 10,
        instrucao: 'De quatro, alterne arquear e arredondar a coluna, devagar.',
      },
      {
        nome: 'Rotação de tronco',
        duracaoSeg: 30,
        reps: 12,
        instrucao: 'Em pé, braços soltos, gire o tronco de um lado ao outro.',
      },
      {
        nome: 'Série de aproximação',
        duracaoSeg: 90,
        instrucao:
          'Duas séries leves do primeiro exercício do treino, com 40% e 60% da carga. É o aquecimento que mais importa.',
      },
    ],
  },
  {
    chave: 'alongamento_pos',
    nome: 'Alongamento pós-treino',
    emoji: '🧘',
    quando: 'Depois do treino, com o músculo aquecido',
    duracaoMin: 8,
    tipo: 'estatico',
    descricao:
      'Alongamento estático, segurando cada posição. Feito com o músculo aquecido, ganha amplitude com segurança.',
    movimentos: [
      {
        nome: 'Peitoral na parede',
        duracaoSeg: 30,
        bilateral: true,
        instrucao: 'Antebraço apoiado no batente, gire o tronco para o lado oposto.',
        erro: 'Sem forçar o ombro além do confortável.',
      },
      {
        nome: 'Dorsal suspenso',
        duracaoSeg: 30,
        instrucao: 'Segure numa barra ou apoio na altura da cintura e deixe o quadril cair para trás.',
      },
      {
        nome: 'Posterior de coxa sentado',
        duracaoSeg: 40,
        bilateral: true,
        instrucao: 'Sentado, uma perna estendida, incline o tronco à frente mantendo as costas retas.',
        erro: 'Arredondar a coluna alonga a lombar, não o posterior.',
      },
      {
        nome: 'Quadríceps em pé',
        duracaoSeg: 30,
        bilateral: true,
        instrucao: 'Puxe o calcanhar em direção ao glúteo, joelhos alinhados.',
      },
      {
        nome: 'Flexor do quadril (afundo)',
        duracaoSeg: 40,
        bilateral: true,
        instrucao: 'Joelho no chão, empurre o quadril à frente. Contraia o glúteo do lado de trás.',
        erro: 'É o alongamento que mais falta em quem passa o dia sentado.',
      },
      {
        nome: 'Panturrilha na parede',
        duracaoSeg: 30,
        bilateral: true,
        instrucao: 'Ponta do pé na parede, calcanhar no chão, aproxime o corpo.',
      },
      {
        nome: 'Coluna deitado',
        duracaoSeg: 40,
        bilateral: true,
        instrucao: 'Deitado, joelho cruzando para o lado oposto, ombros no chão.',
      },
    ],
  },
  {
    chave: 'mobilidade_ombro',
    nome: 'Mobilidade de ombro',
    emoji: '💪',
    quando: 'Antes de treino de superiores, ou em dia de descanso',
    duracaoMin: 5,
    tipo: 'dinamico',
    descricao:
      'Ombro travado limita supino e desenvolvimento, e é onde mais aparece lesão em quem treina há anos.',
    movimentos: [
      {
        nome: 'Passagem de bastão',
        duracaoSeg: 60,
        reps: 10,
        instrucao:
          'Bastão ou cabo de vassoura com pegada bem larga: leve de frente para trás por cima da cabeça, braços estendidos.',
        erro: 'Se dobrar o cotovelo, a pegada está estreita demais.',
      },
      {
        nome: 'Rotação externa com elástico',
        duracaoSeg: 60,
        reps: 15,
        bilateral: true,
        instrucao: 'Cotovelo colado ao corpo a 90°, gire o antebraço para fora contra o elástico.',
      },
      {
        nome: 'Deslize na parede',
        duracaoSeg: 45,
        reps: 12,
        instrucao: 'Costas e braços na parede, deslize os braços para cima sem descolar.',
      },
      {
        nome: 'Círculos de escápula',
        duracaoSeg: 40,
        reps: 12,
        instrucao: 'Só as escápulas: para cima, para trás, para baixo e para frente.',
      },
    ],
  },
  {
    chave: 'mobilidade_quadril',
    nome: 'Mobilidade de quadril',
    emoji: '🦵',
    quando: 'Antes de treino de perna',
    duracaoMin: 6,
    tipo: 'dinamico',
    descricao:
      'Quadril rígido é o motivo mais comum de não conseguir agachar fundo — e de compensar com a lombar.',
    movimentos: [
      {
        nome: 'Agachamento profundo segurado',
        duracaoSeg: 45,
        instrucao: 'Agache o máximo possível e fique lá, cotovelos empurrando os joelhos para fora.',
      },
      {
        nome: '90/90',
        duracaoSeg: 60,
        bilateral: true,
        instrucao: 'Sentado, as duas pernas a 90°, gire de um lado para o outro sem usar as mãos.',
      },
      {
        nome: 'Afundo com rotação',
        duracaoSeg: 50,
        reps: 8,
        bilateral: true,
        instrucao: 'Passo à frente em afundo e gire o tronco para o lado da perna da frente.',
      },
      {
        nome: 'Ponte de glúteo',
        duracaoSeg: 45,
        reps: 15,
        instrucao: 'Deitado, empurre o quadril para cima contraindo o glúteo 1 segundo no topo.',
      },
      {
        nome: 'Balanço de perna lateral',
        duracaoSeg: 40,
        reps: 12,
        bilateral: true,
        instrucao: 'Apoiado, balance a perna de um lado ao outro à frente do corpo.',
      },
    ],
  },
  {
    chave: 'coluna_escritorio',
    nome: 'Coluna de quem passa o dia sentado',
    emoji: '🪑',
    quando: 'Qualquer hora — de preferência no meio do expediente',
    duracaoMin: 6,
    tipo: 'estatico',
    descricao:
      'Oito horas sentado encurta flexor do quadril e trava a torácica. Isso aparece no agachamento e na postura.',
    movimentos: [
      { nome: 'Extensão torácica na cadeira', duracaoSeg: 40, instrucao: 'Mãos atrás da cabeça, arqueie a torácica sobre o encosto.' },
      { nome: 'Flexor do quadril (afundo)', duracaoSeg: 45, bilateral: true, instrucao: 'Joelho no chão, empurre o quadril à frente com o glúteo contraído.' },
      { nome: 'Alongamento de peitoral no batente', duracaoSeg: 35, bilateral: true, instrucao: 'Antebraço no batente, gire o tronco para longe.' },
      { nome: 'Pescoço lateral', duracaoSeg: 30, bilateral: true, instrucao: 'Incline a cabeça para o ombro, sem levantá-lo.' },
      { nome: 'Rotação de coluna sentado', duracaoSeg: 40, bilateral: true, instrucao: 'Sentado, gire o tronco e segure na lateral da cadeira.' },
    ],
  },
  {
    chave: 'movimento_livre',
    nome: 'Movimento livre',
    emoji: '🤸',
    quando: 'Dia de descanso, ou quando quiser se mexer sem treinar',
    duracaoMin: 10,
    tipo: 'livre',
    descricao:
      'Padrões básicos de movimento humano — agachar, engatinhar, girar, pendurar. Trabalha coordenação e controle, coisas que máquina de academia não treina.',
    movimentos: [
      { nome: 'Engatinhar de urso', duracaoSeg: 60, instrucao: 'Quatro apoios, joelhos a um palmo do chão. Ande para frente e para trás.' },
      { nome: 'Rolamento no chão', duracaoSeg: 60, instrucao: 'Deitado, role de um lado ao outro usando só o impulso do tronco.' },
      { nome: 'Pendurar na barra', duracaoSeg: 45, instrucao: 'Solto na barra, ombros relaxados. Descomprime a coluna e abre o ombro.' },
      { nome: 'Agachamento profundo com transferência', duracaoSeg: 60, instrucao: 'No agachamento fundo, transfira o peso de um pé ao outro.' },
      { nome: 'Macaquinho lateral', duracaoSeg: 50, instrucao: 'Mãos no chão, salte as pernas de um lado ao outro.' },
      { nome: 'Levantar do chão sem as mãos', duracaoSeg: 60, instrucao: 'Sentado no chão, levante sem usar as mãos. Boa medida de mobilidade geral.' },
    ],
  },
];

export function porChave(chave: string) {
  return ROTINAS.find((r) => r.chave === chave);
}

export function duracaoTotal(r: RotinaMobilidade): number {
  return r.movimentos.reduce((a, m) => a + m.duracaoSeg * (m.bilateral ? 2 : 1), 0);
}

export const PRINCIPIOS = [
  {
    titulo: 'Antes do treino: dinâmico',
    texto:
      'Movimento, não posição parada. Alongamento estático antes reduz força temporariamente — e força é o que gera o estímulo.',
  },
  {
    titulo: 'Depois do treino: estático',
    texto:
      'Com o músculo aquecido, segurar 30 a 45 segundos ganha amplitude com segurança.',
  },
  {
    titulo: 'Amplitude é treino',
    texto:
      'Agachar fundo com controle constrói mais que agachar meio caminho com o dobro do peso. Mobilidade destrava amplitude.',
  },
  {
    titulo: 'Frequência ganha de duração',
    texto:
      'Cinco minutos todo dia rendem mais que quarenta minutos uma vez por semana.',
  },
];
