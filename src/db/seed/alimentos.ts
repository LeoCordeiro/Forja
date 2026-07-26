/**
 * Tabela de alimentos — valores por 100 g, baseados na TACO (Unicamp) e em
 * rótulos de referência para os industrializados.
 *
 * `medida` + `gPorMedida` existem por um motivo prático: sem eles a lista de
 * compras tenta somar "2 colheres" com "300 g" e devolve lixo.
 */

/** [nome, categoria, kcal, prot, carb, gord, fibra, medida, gPorMedida] */
type F = [string, string, number, number, number, number, number, string | null, number | null];

export const ALIMENTOS: F[] = [
  // ── CARNES E OVOS ───────────────────────────────────────────────────────
  ['Peito de frango grelhado', 'acougue', 159, 32.0, 0, 2.5, 0, '1 filé médio', 120],
  ['Coxa de frango sem pele', 'acougue', 167, 26.9, 0, 5.8, 0, '1 unidade', 90],
  ['Patinho moído', 'acougue', 219, 35.9, 0, 7.3, 0, '1 porção', 100],
  ['Alcatra grelhada', 'acougue', 241, 31.9, 0, 11.8, 0, '1 bife médio', 100],
  ['Contrafilé grelhado', 'acougue', 278, 31.2, 0, 16.1, 0, '1 bife médio', 120],
  ['Carne moída (acém)', 'acougue', 212, 26.7, 0, 11.2, 0, '1 porção', 100],
  ['Lombo suíno assado', 'acougue', 210, 35.7, 0, 6.4, 0, '1 fatia', 80],
  ['Peito de peru defumado', 'frios', 95, 18.0, 2.0, 1.5, 0, '1 fatia', 15],
  ['Tilápia grelhada', 'acougue', 96, 20.1, 0, 1.7, 0, '1 filé', 130],
  ['Salmão grelhado', 'acougue', 243, 23.9, 0, 15.9, 0, '1 posta', 120],
  ['Atum em água (lata)', 'mercearia', 116, 25.5, 0, 1.0, 0, '1 lata drenada', 120],
  ['Sardinha em conserva', 'mercearia', 217, 24.0, 0, 13.0, 0, '1 lata', 125],
  ['Ovo de galinha cozido', 'mercearia', 146, 13.3, 0.6, 9.5, 0, '1 unidade', 50],
  ['Clara de ovo', 'mercearia', 43, 10.6, 0.7, 0, 0, '1 clara', 33],

  // ── CARBOIDRATOS ────────────────────────────────────────────────────────
  ['Arroz branco cozido', 'mercearia', 128, 2.5, 28.1, 0.2, 1.6, '4 colheres de sopa', 100],
  ['Arroz integral cozido', 'mercearia', 124, 2.6, 25.8, 1.0, 2.7, '4 colheres de sopa', 100],
  ['Feijão carioca cozido', 'mercearia', 76, 4.8, 13.6, 0.5, 8.5, '1 concha', 80],
  ['Feijão preto cozido', 'mercearia', 77, 4.5, 14.0, 0.5, 8.4, '1 concha', 80],
  ['Batata inglesa cozida', 'hortifruti', 52, 1.2, 11.9, 0, 1.3, '1 unidade média', 120],
  ['Batata doce cozida', 'hortifruti', 77, 0.6, 18.4, 0.1, 2.2, '1 unidade média', 130],
  ['Mandioca cozida', 'hortifruti', 125, 0.6, 30.1, 0.3, 1.6, '1 pedaço', 100],
  ['Macarrão cozido', 'mercearia', 111, 3.9, 23.2, 0.6, 1.6, '1 pegador', 110],
  ['Pão francês', 'padaria', 300, 8.0, 58.6, 3.1, 2.3, '1 unidade', 50],
  ['Pão integral de forma', 'padaria', 253, 9.4, 49.9, 3.7, 5.9, '1 fatia', 25],
  ['Aveia em flocos', 'mercearia', 394, 13.9, 66.6, 8.5, 9.1, '2 colheres de sopa', 30],
  ['Goma de tapioca', 'mercearia', 240, 0, 59.0, 0, 0, '1 tapioca média', 60],
  ['Cuscuz de milho cozido', 'mercearia', 113, 2.3, 25.3, 0.6, 1.9, '1 fatia', 90],
  ['Quinoa cozida', 'mercearia', 120, 4.4, 21.3, 1.9, 2.8, '4 colheres de sopa', 100],

  // ── LATICÍNIOS E SUPLEMENTOS ────────────────────────────────────────────
  ['Leite integral', 'laticinios', 61, 2.9, 4.7, 3.2, 0, '1 copo', 200],
  ['Leite desnatado', 'laticinios', 35, 3.4, 4.9, 0.2, 0, '1 copo', 200],
  ['Iogurte natural integral', 'laticinios', 61, 3.5, 4.7, 3.3, 0, '1 pote', 170],
  ['Iogurte grego natural', 'laticinios', 97, 9.0, 4.0, 5.0, 0, '1 pote', 130],
  ['Queijo minas frescal', 'laticinios', 264, 17.4, 3.2, 20.2, 0, '1 fatia', 30],
  ['Queijo mussarela', 'laticinios', 330, 25.1, 3.0, 24.5, 0, '1 fatia', 20],
  ['Queijo cottage', 'laticinios', 98, 11.0, 3.4, 4.3, 0, '2 colheres de sopa', 50],
  ['Requeijão cremoso', 'laticinios', 257, 9.6, 3.4, 22.5, 0, '1 colher de sopa', 20],
  ['Whey protein concentrado', 'suplementos', 400, 80.0, 8.0, 5.0, 0, '1 scoop', 30],
  ['Creatina monoidratada', 'suplementos', 0, 0, 0, 0, 0, '1 colher de chá', 5],

  // ── FRUTAS ──────────────────────────────────────────────────────────────
  ['Banana prata', 'hortifruti', 98, 1.3, 26.0, 0.1, 2.0, '1 unidade', 70],
  ['Maçã', 'hortifruti', 56, 0.3, 15.2, 0, 1.3, '1 unidade', 130],
  ['Mamão papaia', 'hortifruti', 40, 0.5, 10.4, 0.1, 1.8, '1/2 unidade', 150],
  ['Laranja pera', 'hortifruti', 37, 1.0, 8.9, 0.1, 0.8, '1 unidade', 180],
  ['Abacate', 'hortifruti', 96, 1.2, 6.0, 8.4, 6.3, '1/2 unidade', 100],
  ['Morango', 'hortifruti', 30, 0.9, 6.8, 0.3, 1.7, '1 xícara', 150],
  ['Melancia', 'hortifruti', 33, 0.9, 8.1, 0, 0.1, '1 fatia', 200],
  ['Uva', 'hortifruti', 53, 0.7, 13.6, 0.2, 0.9, '1 cacho pequeno', 100],
  ['Manga', 'hortifruti', 64, 0.4, 16.7, 0.2, 1.6, '1 unidade', 200],
  ['Abacaxi', 'hortifruti', 48, 0.9, 12.3, 0.1, 1.0, '1 fatia', 100],

  // ── LEGUMES E VERDURAS ──────────────────────────────────────────────────
  ['Brócolis cozido', 'hortifruti', 25, 2.1, 4.4, 0.5, 3.4, '1 xícara', 90],
  ['Alface', 'hortifruti', 15, 1.4, 2.4, 0.2, 2.0, '1 prato', 60],
  ['Tomate', 'hortifruti', 15, 1.1, 3.1, 0.2, 1.2, '1 unidade', 120],
  ['Cenoura crua', 'hortifruti', 34, 1.3, 7.7, 0.2, 3.2, '1 unidade', 80],
  ['Abobrinha cozida', 'hortifruti', 19, 1.1, 3.0, 0.2, 1.6, '1 xícara', 120],
  ['Couve refogada', 'hortifruti', 90, 1.7, 8.7, 5.6, 3.1, '1 porção', 60],
  ['Espinafre cozido', 'hortifruti', 23, 2.7, 2.7, 0.4, 2.1, '1 porção', 80],
  ['Pepino', 'hortifruti', 10, 0.9, 2.0, 0, 1.1, '1/2 unidade', 100],
  ['Beterraba cozida', 'hortifruti', 32, 1.3, 7.2, 0.1, 1.9, '1 unidade', 90],
  ['Cebola', 'hortifruti', 39, 1.7, 8.9, 0.1, 2.2, '1 unidade', 100],
  ['Pimentão verde', 'hortifruti', 21, 1.1, 4.9, 0.2, 2.6, '1 unidade', 90],
  ['Alho', 'hortifruti', 113, 7.0, 23.9, 0.2, 4.3, '1 dente', 3],

  // ── GORDURAS E OUTROS ───────────────────────────────────────────────────
  ['Azeite de oliva extra virgem', 'mercearia', 884, 0, 0, 100, 0, '1 colher de sopa', 13],
  ['Óleo de soja', 'mercearia', 884, 0, 0, 100, 0, '1 colher de sopa', 13],
  ['Castanha de caju', 'mercearia', 570, 18.5, 29.1, 46.3, 3.7, '1 punhado', 30],
  ['Castanha do Pará', 'mercearia', 643, 14.5, 15.1, 63.5, 7.9, '2 unidades', 10],
  ['Amendoim torrado', 'mercearia', 544, 27.2, 20.3, 43.9, 8.0, '1 punhado', 30],
  ['Pasta de amendoim integral', 'mercearia', 588, 25.0, 20.0, 50.0, 6.0, '1 colher de sopa', 20],
  ['Semente de chia', 'mercearia', 486, 16.5, 42.1, 30.7, 34.4, '1 colher de sopa', 12],
  ['Linhaça dourada', 'mercearia', 495, 14.1, 43.3, 32.3, 27.3, '1 colher de sopa', 10],
  ['Mel', 'mercearia', 309, 0.4, 84.0, 0, 0, '1 colher de sopa', 20],
  ['Açúcar refinado', 'mercearia', 387, 0, 99.5, 0, 0, '1 colher de sopa', 12],
  ['Chocolate 70% cacau', 'mercearia', 545, 7.8, 45.9, 38.0, 10.9, '1 quadradinho', 10],
  ['Café coado sem açúcar', 'mercearia', 2, 0.2, 0.3, 0, 0, '1 xícara', 150],
  ['Cacau em pó 100%', 'mercearia', 228, 19.6, 57.9, 13.7, 33.2, '1 colher de sopa', 10],
  ['Sal', 'mercearia', 0, 0, 0, 0, 0, '1 pitada', 1],
  ['Canela em pó', 'mercearia', 261, 3.9, 79.8, 3.2, 54.3, '1 colher de chá', 2],
  ['Repolho', 'hortifruti', 25, 1.3, 5.8, 0.1, 2.5, '1 xícara fatiada', 70],
];

/** Receitas com passo a passo — os ingredientes casam por nome com ALIMENTOS. */
export interface SeedReceita {
  nome: string;
  porcoes: number;
  tempoMin: number;
  dificuldade: 1 | 2 | 3;
  ingredientes: [string, number, string][]; // [alimento, quantidade, unidade]
  passos: [string, number | null][]; // [texto, tempo em segundos p/ timer]
}

export const RECEITAS: SeedReceita[] = [
  {
    nome: 'Frango grelhado com arroz integral e brócolis',
    porcoes: 1,
    tempoMin: 25,
    dificuldade: 1,
    ingredientes: [
      ['Peito de frango grelhado', 150, 'g'],
      ['Arroz integral cozido', 120, 'g'],
      ['Brócolis cozido', 100, 'g'],
      ['Azeite de oliva extra virgem', 8, 'g'],
      ['Alho', 6, 'g'],
      ['Sal', 1, 'g'],
    ],
    passos: [
      ['Tempere o frango com sal e alho amassado. Deixe pegar gosto.', 600],
      ['Aqueça a frigideira bem quente e grelhe o frango 5 min de cada lado, sem mexer.', 600],
      ['Cozinhe o brócolis no vapor até ficar verde vivo e ainda firme.', 300],
      ['Refogue o brócolis rapidamente no azeite com alho.', 120],
      ['Monte o prato com o arroz já pronto e sirva.', null],
    ],
  },
  {
    nome: 'Omelete de claras com queijo minas',
    porcoes: 1,
    tempoMin: 10,
    dificuldade: 1,
    ingredientes: [
      ['Clara de ovo', 120, 'g'],
      ['Ovo de galinha cozido', 50, 'g'],
      ['Queijo minas frescal', 30, 'g'],
      ['Tomate', 50, 'g'],
      ['Azeite de oliva extra virgem', 5, 'g'],
      ['Sal', 1, 'g'],
    ],
    passos: [
      ['Bata as claras com o ovo inteiro e uma pitada de sal.', null],
      ['Aqueça o azeite em fogo médio-baixo — fogo alto resseca a omelete.', 60],
      ['Despeje a mistura e espalhe o tomate picado por cima.', null],
      ['Quando firmar as bordas, adicione o queijo e dobre ao meio.', 180],
      ['Cozinhe mais 1 minuto e sirva.', 60],
    ],
  },
  {
    nome: 'Panqueca de aveia com banana',
    porcoes: 1,
    tempoMin: 12,
    dificuldade: 1,
    ingredientes: [
      ['Aveia em flocos', 40, 'g'],
      ['Banana prata', 70, 'g'],
      ['Ovo de galinha cozido', 100, 'g'],
      ['Canela em pó', 1, 'g'],
      ['Pasta de amendoim integral', 15, 'g'],
    ],
    passos: [
      ['Amasse a banana e misture com os ovos e a aveia até formar massa homogênea.', null],
      ['Deixe descansar 3 minutos para a aveia hidratar — isso evita que quebre.', 180],
      ['Aqueça a frigideira antiaderente em fogo médio.', 60],
      ['Despeje a massa e cozinhe até fazer bolhas na superfície.', 150],
      ['Vire com cuidado e cozinhe mais 2 minutos. Finalize com a pasta de amendoim.', 120],
    ],
  },
  {
    nome: 'Shake pós-treino',
    porcoes: 1,
    tempoMin: 3,
    dificuldade: 1,
    ingredientes: [
      ['Whey protein concentrado', 30, 'g'],
      ['Banana prata', 70, 'g'],
      ['Leite desnatado', 200, 'g'],
      ['Aveia em flocos', 20, 'g'],
    ],
    passos: [
      ['Coloque o leite primeiro no liquidificador — evita empelotar o whey.', null],
      ['Adicione banana, aveia e por último o whey.', null],
      ['Bata por 30 segundos e beba na sequência.', 30],
    ],
  },
  {
    nome: 'Escondidinho de carne com batata doce',
    porcoes: 3,
    tempoMin: 45,
    dificuldade: 2,
    ingredientes: [
      ['Carne moída (acém)', 400, 'g'],
      ['Batata doce cozida', 500, 'g'],
      ['Cebola', 80, 'g'],
      ['Alho', 9, 'g'],
      ['Tomate', 120, 'g'],
      ['Queijo mussarela', 60, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Sal', 3, 'g'],
    ],
    passos: [
      ['Cozinhe a batata doce até ficar bem macia e amasse formando um purê.', 1200],
      ['Refogue alho e cebola no azeite até dourar.', 240],
      ['Adicione a carne moída e cozinhe até secar toda a água.', 600],
      ['Junte o tomate picado, tempere e cozinhe mais 5 minutos.', 300],
      ['Monte em travessa: carne embaixo, purê por cima, queijo no topo.', null],
      ['Leve ao forno a 200°C até gratinar.', 900],
    ],
  },
  {
    nome: 'Salada de atum com grão e legumes',
    porcoes: 1,
    tempoMin: 8,
    dificuldade: 1,
    ingredientes: [
      ['Atum em água (lata)', 120, 'g'],
      ['Alface', 60, 'g'],
      ['Tomate', 100, 'g'],
      ['Pepino', 80, 'g'],
      ['Cenoura crua', 50, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Ovo de galinha cozido', 50, 'g'],
    ],
    passos: [
      ['Drene bem o atum — o líquido da lata deixa a salada aguada.', null],
      ['Pique todos os legumes em cubos parecidos para a garfada ficar uniforme.', null],
      ['Misture tudo, adicione o ovo cozido em rodelas.', null],
      ['Finalize com azeite na hora de servir, nunca antes.', null],
    ],
  },
  {
    nome: 'Tapioca de frango com requeijão',
    porcoes: 1,
    tempoMin: 10,
    dificuldade: 1,
    ingredientes: [
      ['Goma de tapioca', 60, 'g'],
      ['Peito de frango grelhado', 100, 'g'],
      ['Requeijão cremoso', 20, 'g'],
      ['Tomate', 40, 'g'],
    ],
    passos: [
      ['Peneire a goma na frigideira quente até cobrir o fundo por igual.', null],
      ['Espere firmar sozinha — não mexa, senão esfarela.', 120],
      ['Vire, recheie com o frango desfiado, requeijão e tomate.', null],
      ['Dobre ao meio e sirva ainda quente.', 60],
    ],
  },
  {
    nome: 'Overnight oats de morango',
    porcoes: 1,
    tempoMin: 5,
    dificuldade: 1,
    ingredientes: [
      ['Aveia em flocos', 50, 'g'],
      ['Iogurte grego natural', 130, 'g'],
      ['Leite desnatado', 100, 'g'],
      ['Morango', 80, 'g'],
      ['Semente de chia', 12, 'g'],
      ['Mel', 10, 'g'],
    ],
    passos: [
      ['Misture aveia, chia, iogurte e leite num pote com tampa.', null],
      ['Adicione o mel e mexa bem.', null],
      ['Tampe e deixe na geladeira de um dia para o outro.', null],
      ['Na hora de comer, adicione os morangos picados por cima.', null],
    ],
  },
  {
    nome: 'Strogonoff fit de frango',
    porcoes: 2,
    tempoMin: 30,
    dificuldade: 2,
    ingredientes: [
      ['Peito de frango grelhado', 400, 'g'],
      ['Iogurte natural integral', 170, 'g'],
      ['Cebola', 80, 'g'],
      ['Alho', 6, 'g'],
      ['Requeijão cremoso', 40, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Sal', 2, 'g'],
    ],
    passos: [
      ['Corte o frango em cubos e tempere com sal e alho.', null],
      ['Refogue a cebola no azeite até ficar transparente.', 240],
      ['Adicione o frango e sele até dourar por fora.', 480],
      ['Desligue o fogo antes de colocar o iogurte — se ferver, talha.', null],
      ['Misture iogurte e requeijão fora do fogo e sirva.', null],
    ],
  },
  {
    nome: 'Bife com batata doce e salada',
    porcoes: 1,
    tempoMin: 20,
    dificuldade: 1,
    ingredientes: [
      ['Alcatra grelhada', 150, 'g'],
      ['Batata doce cozida', 200, 'g'],
      ['Alface', 60, 'g'],
      ['Tomate', 100, 'g'],
      ['Azeite de oliva extra virgem', 13, 'g'],
      ['Sal', 2, 'g'],
    ],
    passos: [
      ['Tire o bife da geladeira 15 min antes — carne gelada não sela direito.', 900],
      ['Cozinhe a batata doce em cubos até ficar macia.', 900],
      ['Frigideira muito quente, sal só na hora. Sele 2 min de cada lado.', 240],
      ['Deixe a carne descansar 3 minutos antes de cortar.', 180],
      ['Monte com a salada temperada com azeite.', null],
    ],
  },
];
