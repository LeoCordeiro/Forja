import type { SeedReceita } from './alimentos';

/**
 * Receitas fit no formato que viralizou nas redes.
 *
 * O padrão que se repete nas que dão certo: poucos ingredientes, quase todos
 * de mercado comum, tempo curto e proteína alta. Receita que pede ingrediente
 * caro ou 40 minutos de preparo não sobrevive à terça-feira.
 *
 * Marcadas com as categorias de preferência para o cardápio poder filtrar por
 * quem come o quê.
 */

export interface ReceitaFit extends SeedReceita {
  tags: string[];
  viral?: string;
}

export const RECEITAS_FIT: ReceitaFit[] = [
  {
    nome: 'Frango cremoso de air fryer',
    porcoes: 2,
    tempoMin: 20,
    dificuldade: 1,
    tags: ['frango', 'laticinio', 'rapido', 'airfryer'],
    viral: 'O creme sai do próprio requeijão com o líquido do frango — não leva creme de leite.',
    ingredientes: [
      ['Peito de frango grelhado', 400, 'g'],
      ['Requeijão cremoso', 60, 'g'],
      ['Queijo mussarela', 40, 'g'],
      ['Tomate', 100, 'g'],
      ['Cebola', 60, 'g'],
      ['Alho', 6, 'g'],
      ['Sal', 3, 'g'],
    ],
    passos: [
      ['Corte o frango em cubos e tempere com sal e alho.', null],
      ['Air fryer a 200°C por 12 minutos, mexendo na metade do tempo.', 720],
      ['Tire, misture o requeijão ainda quente — ele derrete no calor do frango.', null],
      ['Cubra com mussarela e tomate, volte 3 minutos para gratinar.', 180],
    ],
  },
  {
    nome: 'Pão de queijo de frigideira',
    porcoes: 1,
    tempoMin: 8,
    dificuldade: 1,
    tags: ['laticinio', 'ovo', 'rapido', 'lanche'],
    viral: 'Versão em frigideira do pão de queijo — 3 ingredientes, sem forno.',
    ingredientes: [
      ['Ovo de galinha cozido', 100, 'g'],
      ['Goma de tapioca', 30, 'g'],
      ['Queijo minas frescal', 50, 'g'],
      ['Sal', 1, 'g'],
    ],
    passos: [
      ['Bata os ovos com a goma e o sal até ficar liso.', null],
      ['Misture o queijo picado em cubinhos.', null],
      ['Frigideira antiaderente em fogo médio-baixo, tampada, 3 minutos.', 180],
      ['Vire e faça mais 2 minutos. Vai inflar como pão de queijo.', 120],
    ],
  },
  {
    nome: 'Bowl de frango com batata doce',
    porcoes: 1,
    tempoMin: 25,
    dificuldade: 1,
    tags: ['frango', 'hortifruti', 'marmita', 'sem-lactose'],
    viral: 'A marmita padrão de quem treina: proteína, carbo e vegetal no mesmo pote.',
    ingredientes: [
      ['Peito de frango grelhado', 180, 'g'],
      ['Batata doce cozida', 200, 'g'],
      ['Brócolis cozido', 100, 'g'],
      ['Cenoura crua', 60, 'g'],
      ['Azeite de oliva extra virgem', 10, 'g'],
      ['Alho', 6, 'g'],
      ['Sal', 2, 'g'],
    ],
    passos: [
      ['Cozinhe a batata doce em cubos até ficar macia por fora e firme no centro.', 900],
      ['Grelhe o frango temperado com alho e sal.', 600],
      ['Cozinhe o brócolis no vapor por 4 minutos — tem que continuar verde vivo.', 240],
      ['Monte tudo no pote e regue com azeite na hora de comer.', null],
    ],
  },
  {
    nome: 'Panqueca proteica de banana',
    porcoes: 1,
    tempoMin: 10,
    dificuldade: 1,
    tags: ['fruta', 'ovo', 'whey', 'cafe', 'rapido'],
    viral: 'A panqueca de 3 ingredientes que aparece em todo perfil fitness.',
    ingredientes: [
      ['Banana prata', 100, 'g'],
      ['Ovo de galinha cozido', 100, 'g'],
      ['Aveia em flocos', 30, 'g'],
      ['Whey protein concentrado', 20, 'g'],
      ['Canela em pó', 2, 'g'],
    ],
    passos: [
      ['Amasse a banana bem e misture tudo até virar uma massa homogênea.', null],
      ['Descanse 3 minutos — a aveia hidrata e a panqueca para de quebrar.', 180],
      ['Fogo médio-baixo. Espere fazer bolhas na superfície antes de virar.', 180],
      ['Vire com cuidado e faça mais 2 minutos.', 120],
    ],
  },
  {
    nome: 'Escondidinho de frango com abóbora',
    porcoes: 3,
    tempoMin: 40,
    dificuldade: 2,
    tags: ['frango', 'hortifruti', 'marmita'],
    viral: 'Purê de abóbora no lugar da mandioca: metade das calorias, mesma cremosidade.',
    ingredientes: [
      ['Peito de frango grelhado', 500, 'g'],
      ['Batata doce cozida', 400, 'g'],
      ['Cebola', 80, 'g'],
      ['Alho', 9, 'g'],
      ['Tomate', 150, 'g'],
      ['Queijo mussarela', 60, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Sal', 3, 'g'],
    ],
    passos: [
      ['Cozinhe e amasse a batata doce com uma pitada de sal.', 1200],
      ['Refogue alho e cebola, junte o frango desfiado.', 300],
      ['Adicione o tomate picado e cozinhe até secar.', 420],
      ['Monte: frango embaixo, purê por cima, queijo no topo.', null],
      ['Forno a 200°C até gratinar.', 900],
    ],
  },
  {
    nome: 'Overnight oats de café',
    porcoes: 1,
    tempoMin: 5,
    dificuldade: 1,
    tags: ['laticinio', 'cafe', 'rapido', 'sem-cozinhar'],
    viral: 'Prepara à noite, come de manhã. Zero fogão.',
    ingredientes: [
      ['Aveia em flocos', 50, 'g'],
      ['Iogurte grego natural', 130, 'g'],
      ['Leite desnatado', 100, 'g'],
      ['Café coado sem açúcar', 50, 'g'],
      ['Whey protein concentrado', 20, 'g'],
      ['Semente de chia', 10, 'g'],
      ['Cacau em pó 100%', 5, 'g'],
    ],
    passos: [
      ['Misture tudo num pote com tampa.', null],
      ['Geladeira de um dia para o outro — no mínimo 6 horas.', null],
      ['Come gelado, direto do pote.', null],
    ],
  },
  {
    nome: 'Omelete de forno com legumes',
    porcoes: 2,
    tempoMin: 30,
    dificuldade: 1,
    tags: ['ovo', 'hortifruti', 'marmita', 'sem-lactose'],
    viral: 'Faz de uma vez, come a semana toda. Aguenta 4 dias na geladeira.',
    ingredientes: [
      ['Ovo de galinha cozido', 300, 'g'],
      ['Clara de ovo', 120, 'g'],
      ['Abobrinha cozida', 150, 'g'],
      ['Tomate', 100, 'g'],
      ['Cebola', 60, 'g'],
      ['Espinafre cozido', 80, 'g'],
      ['Azeite de oliva extra virgem', 10, 'g'],
      ['Sal', 3, 'g'],
    ],
    passos: [
      ['Pique todos os legumes bem pequenos.', null],
      ['Bata os ovos com as claras e o sal.', null],
      ['Misture os legumes crus na mistura de ovo.', null],
      ['Forma untada, forno a 180°C por 25 minutos.', 1500],
      ['Corte em quadrados e guarde em potes.', null],
    ],
  },
  {
    nome: 'Strogonoff de frango com iogurte',
    porcoes: 2,
    tempoMin: 25,
    dificuldade: 2,
    tags: ['frango', 'laticinio'],
    viral: 'Iogurte grego no lugar do creme de leite: mais proteína e menos gordura.',
    ingredientes: [
      ['Peito de frango grelhado', 400, 'g'],
      ['Iogurte grego natural', 130, 'g'],
      ['Requeijão cremoso', 30, 'g'],
      ['Cebola', 80, 'g'],
      ['Alho', 6, 'g'],
      ['Tomate', 80, 'g'],
      ['Azeite de oliva extra virgem', 10, 'g'],
      ['Sal', 2, 'g'],
    ],
    passos: [
      ['Corte o frango em cubos e sele em fogo alto.', 480],
      ['Refogue cebola e alho na mesma panela.', 240],
      ['Junte o tomate e cozinhe 3 minutos.', 180],
      ['DESLIGUE o fogo. Só então misture iogurte e requeijão — se ferver, talha.', null],
    ],
  },
  {
    nome: 'Wrap de frango com tapioca',
    porcoes: 1,
    tempoMin: 12,
    dificuldade: 1,
    tags: ['frango', 'hortifruti', 'rapido', 'sem-gluten'],
    viral: 'Tapioca fina vira wrap. Segura o recheio melhor que pão.',
    ingredientes: [
      ['Goma de tapioca', 50, 'g'],
      ['Peito de frango grelhado', 120, 'g'],
      ['Alface', 30, 'g'],
      ['Tomate', 50, 'g'],
      ['Cenoura crua', 40, 'g'],
      ['Requeijão cremoso', 20, 'g'],
    ],
    passos: [
      ['Peneire a goma na frigideira e espalhe bem fina.', null],
      ['Espere firmar sozinha, sem mexer.', 120],
      ['Vire, passe o requeijão e monte o recheio numa metade.', null],
      ['Enrole ainda quente — fria ela racha.', null],
    ],
  },
  {
    nome: 'Salada de atum com grão-de-bico',
    porcoes: 1,
    tempoMin: 8,
    dificuldade: 1,
    tags: ['peixe', 'hortifruti', 'rapido', 'sem-cozinhar', 'sem-lactose'],
    viral: 'Almoço de 8 minutos sem fogão, com 40 g de proteína.',
    ingredientes: [
      ['Atum em água (lata)', 120, 'g'],
      ['Tomate', 100, 'g'],
      ['Pepino', 80, 'g'],
      ['Cebola', 40, 'g'],
      ['Alface', 50, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Ovo de galinha cozido', 50, 'g'],
    ],
    passos: [
      ['Drene bem o atum — o líquido deixa tudo aguado.', null],
      ['Pique os legumes em cubos parecidos.', null],
      ['Misture, adicione o ovo em rodelas e regue com azeite.', null],
    ],
  },
  {
    nome: 'Shake pós-treino de banana e pasta de amendoim',
    porcoes: 1,
    tempoMin: 3,
    dificuldade: 1,
    tags: ['whey', 'fruta', 'rapido', 'pos-treino'],
    ingredientes: [
      ['Whey protein concentrado', 30, 'g'],
      ['Banana prata', 100, 'g'],
      ['Leite desnatado', 250, 'g'],
      ['Pasta de amendoim integral', 15, 'g'],
      ['Aveia em flocos', 25, 'g'],
    ],
    passos: [
      ['Líquido primeiro no liquidificador — evita empelotar o whey.', null],
      ['Banana, aveia, pasta de amendoim e o whey por último.', null],
      ['Bata 30 segundos e beba na sequência.', 30],
    ],
  },
  {
    nome: 'Carne moída com legumes na panela',
    porcoes: 3,
    tempoMin: 25,
    dificuldade: 1,
    tags: ['carne', 'hortifruti', 'marmita', 'sem-lactose'],
    viral: 'Uma panela só. Faz no domingo, come até quarta.',
    ingredientes: [
      ['Patinho moído', 500, 'g'],
      ['Abobrinha cozida', 200, 'g'],
      ['Cenoura crua', 150, 'g'],
      ['Pimentão verde', 100, 'g'],
      ['Cebola', 80, 'g'],
      ['Alho', 9, 'g'],
      ['Tomate', 150, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Sal', 4, 'g'],
    ],
    passos: [
      ['Doure a carne em fogo alto sem mexer muito — deixe criar crosta.', 480],
      ['Tire a carne, refogue alho e cebola na mesma panela.', 240],
      ['Junte os legumes picados e cozinhe 6 minutos.', 360],
      ['Devolva a carne, adicione o tomate e cozinhe mais 5 minutos.', 300],
    ],
  },
];

/**
 * Categorias de preferência alimentar do onboarding.
 * O cardápio filtra as receitas por estas tags.
 */
export const CATEGORIAS_PREFERENCIA = [
  { chave: 'frango', label: 'Frango', emoji: '🍗' },
  { chave: 'carne', label: 'Carne vermelha', emoji: '🥩' },
  { chave: 'peixe', label: 'Peixe e frutos do mar', emoji: '🐟' },
  { chave: 'ovo', label: 'Ovos', emoji: '🥚' },
  { chave: 'laticinio', label: 'Leite e derivados', emoji: '🧀' },
  { chave: 'hortifruti', label: 'Verduras e legumes', emoji: '🥦' },
  { chave: 'fruta', label: 'Frutas', emoji: '🍌' },
  { chave: 'whey', label: 'Whey e suplementos', emoji: '💊' },
] as const;

export const RESTRICOES = [
  { chave: 'nenhuma', label: 'Sem restrição' },
  { chave: 'sem-lactose', label: 'Sem lactose' },
  { chave: 'sem-gluten', label: 'Sem glúten' },
  { chave: 'vegetariano', label: 'Vegetariano' },
] as const;
