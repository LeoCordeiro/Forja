/**
 * Classificação dos exercícios e regras derivadas dela.
 *
 * Existe porque descanso, ordem no treino e substituição não deveriam ser
 * digitados um a um: são consequência do TIPO do exercício. Definir aqui uma
 * vez conserta o catálogo inteiro e toda rotina criada daqui em diante.
 */

/** Multiarticulares: movem duas ou mais articulações, exigem mais e cansam mais. */
export const COMPOSTOS = [
  'Supino reto com barra',
  'Supino inclinado com barra',
  'Supino reto com halteres',
  'Supino inclinado com halteres',
  'Supino fechado',
  'Flexão de braço',
  'Mergulho no paralelo',
  'Mergulho entre bancos',
  'Levantamento terra',
  'Levantamento terra romeno',
  'Stiff',
  'Barra fixa',
  'Barra fixa supinada',
  'Puxada frontal na polia',
  'Puxada supinada',
  'Remada curvada com barra',
  'Remada unilateral com halter',
  'Remada baixa na polia',
  'Remada cavalinho',
  'Desenvolvimento militar',
  'Desenvolvimento com halteres',
  'Desenvolvimento Arnold',
  'Remada alta',
  'Agachamento livre',
  'Agachamento frontal',
  'Leg press',
  'Hack machine',
  'Afundo com halteres',
  'Afundo com barra',
  'Elevação pélvica com barra',
  'Hip thrust com barra',
  'Agachamento ajoelhado com barra',
  'Pull through na polia',
  'Ponte de glúteo',
  'Elevação pélvica unilateral',
  'Subida no banco',
  'Stiff com halteres',
  'Bom dia com barra',
  'Flexão nórdica',
  'Glute ham raise na máquina',
  'Agachamento livre sem peso',
  'Agachamento na cadeira',
  'Afundo caminhando',
  'Agachamento búlgaro',
  'Agachamento goblet',
  'Agachamento com halteres',
  'Agachamento sumô com halter',
  'Subida no banco com halteres',
  'Afundo reverso com halteres',
  'Flexão inclinada',
  'Flexão com pés elevados',
  'Remada invertida',
  'Flexão pique',
  'Supino máquina',
  'Supino inclinado máquina',
  'Supino máquina no smith',
  'Desenvolvimento máquina',
  'Desenvolvimento na polia',
  'Remada máquina',
  'Remada alta na máquina',
  'Agachamento no smith',
  'Crossover na polia baixa',
];

/** Compostos pesados: os que mais cobram sistema nervoso e mais precisam de pausa. */
export const COMPOSTOS_PESADOS = [
  'Agachamento livre',
  'Agachamento frontal',
  'Levantamento terra',
  'Levantamento terra romeno',
  'Stiff',
  'Supino reto com barra',
  'Desenvolvimento militar',
  'Leg press',
  'Hack machine',
  'Barra fixa',
  'Hip thrust com barra',
  'Bom dia com barra',
  'Agachamento búlgaro',
  'Agachamento goblet',
  'Agachamento com halteres',
  'Stiff com halteres',
  'Supino máquina no smith',
  'Agachamento no smith',
  'Supino máquina',
];

export function ehComposto(nome: string): boolean {
  return COMPOSTOS.includes(nome);
}

export function ehPesado(nome: string): boolean {
  return COMPOSTOS_PESADOS.includes(nome);
}

/**
 * Descanso correto para o exercício, em segundos.
 *
 * Schoenfeld 2016: 3 minutos produziram mais força E mais músculo que 1 minuto
 * em 8 semanas. Com mais descanso você mantém carga e repetições nas séries
 * seguintes — e é esse volume acumulado que constrói.
 *
 * Isolador não precisa do mesmo tempo: fadiga menos o sistema inteiro e a
 * recuperação local é mais rápida.
 */
export function descansoCorreto(nome: string, repsAlvo = 10, grupo?: string): number {
  if (grupo === 'cardio') return 0;
  if (ehPesado(nome)) return repsAlvo <= 8 ? 180 : 150;
  if (ehComposto(nome)) return 150;
  return repsAlvo >= 15 ? 60 : 90;
}

/** Explicação curta do descanso, para a tela de execução. */
export function porqueDescanso(nome: string, segundos: number): string {
  if (segundos >= 180)
    return 'Composto pesado. Três minutos preservam carga e repetições nas próximas séries — é o que mais rende em hipertrofia.';
  if (segundos >= 150)
    return 'Exercício composto. Dois minutos e meio mantêm o desempenho ao longo das séries.';
  if (segundos >= 90) return 'Isolador. Um minuto e meio já recupera o suficiente.';
  return 'Série longa de isolador — a recuperação local é rápida.';
}

/**
 * Ordem correta dentro da sessão.
 *
 * O que vem primeiro recebe o melhor do seu sistema nervoso. Fazer isolador ou
 * cardio antes do composto sabota justamente o exercício que mais constrói.
 */
export const PRIORIDADE: Record<string, number> = {
  aquecimento: 0,
  composto_pesado: 1,
  composto: 2,
  isolador: 3,
  abdomen: 4,
  cardio: 5,
  alongamento: 6,
};

export function prioridadeDe(nome: string, grupo: string): number {
  if (grupo === 'cardio') return PRIORIDADE.cardio;
  if (grupo === 'abdomen') return PRIORIDADE.abdomen;
  if (ehPesado(nome)) return PRIORIDADE.composto_pesado;
  if (ehComposto(nome)) return PRIORIDADE.composto;
  return PRIORIDADE.isolador;
}

export const REGRAS_ORDEM = [
  {
    titulo: 'Composto pesado primeiro',
    texto:
      'Agachamento, terra, supino e desenvolvimento vêm no começo, quando você tem força e coordenação intactas.',
  },
  {
    titulo: 'Isolador depois',
    texto:
      'Rosca, elevação lateral e extensora entram no fim. Fazê-los antes cansa o músculo que você precisa inteiro no composto.',
  },
  {
    titulo: 'Abdômen perto do fim',
    texto:
      'O core estabiliza agachamento e terra. Se você o esgota antes, perde segurança nos compostos.',
  },
  {
    titulo: 'Cardio no fim — ou em outro horário',
    texto:
      'Cardio antes da musculação derruba a força do treino inteiro. Depois, ou separado por 3 horas, não atrapalha a hipertrofia.',
  },
  {
    titulo: 'Alongamento estático só no fim',
    texto:
      'Alongar estaticamente antes reduz força temporariamente. Antes do treino, mobilidade dinâmica; alongamento longo fica para o fim.',
  },
];

/**
 * Substituições equivalentes.
 *
 * Aparelho ocupado é o motivo nº 1 de treino furado. Ter o substituto pronto
 * evita tanto pular o exercício quanto improvisar algo que treina outra coisa.
 */
export const SUBSTITUICOES: Record<string, string[]> = {
  'Supino reto com barra': ['Supino reto com halteres', 'Voador (peck deck)', 'Flexão de braço'],
  'Supino inclinado com barra': ['Supino inclinado com halteres', 'Crossover na polia'],
  'Supino reto com halteres': ['Supino reto com barra', 'Voador (peck deck)', 'Flexão de braço'],
  'Supino inclinado com halteres': ['Supino inclinado com barra', 'Crossover na polia'],
  'Crucifixo com halteres': ['Voador (peck deck)', 'Crossover na polia'],
  'Crossover na polia': ['Voador (peck deck)', 'Crucifixo com halteres'],
  'Voador (peck deck)': ['Crucifixo com halteres', 'Crossover na polia'],
  'Mergulho no paralelo': ['Supino fechado', 'Mergulho entre bancos', 'Flexão de braço'],

  'Barra fixa': ['Puxada frontal na polia', 'Puxada supinada', 'Barra fixa supinada'],
  'Barra fixa supinada': ['Puxada supinada', 'Puxada frontal na polia'],
  'Puxada frontal na polia': ['Barra fixa', 'Puxada supinada'],
  'Remada curvada com barra': ['Remada cavalinho', 'Remada unilateral com halter', 'Remada baixa na polia'],
  'Remada baixa na polia': ['Remada curvada com barra', 'Remada unilateral com halter'],
  'Remada cavalinho': ['Remada curvada com barra', 'Remada baixa na polia'],
  'Levantamento terra': ['Levantamento terra romeno', 'Stiff', 'Hiperextensão lombar'],

  'Desenvolvimento militar': ['Desenvolvimento com halteres', 'Desenvolvimento Arnold'],
  'Desenvolvimento com halteres': ['Desenvolvimento militar', 'Desenvolvimento Arnold'],
  'Elevação lateral': ['Crucifixo inverso', 'Remada alta'],
  'Crucifixo inverso': ['Face pull', 'Elevação lateral'],
  'Face pull': ['Crucifixo inverso', 'Remada alta'],

  'Rosca direta com barra': ['Rosca alternada com halteres', 'Rosca scott', 'Rosca na polia alta'],
  'Rosca alternada com halteres': ['Rosca direta com barra', 'Rosca martelo'],
  'Rosca martelo': ['Rosca alternada com halteres', 'Rosca inversa'],
  'Rosca scott': ['Rosca direta com barra', 'Rosca concentrada'],

  'Tríceps testa': ['Tríceps francês', 'Tríceps na polia com barra'],
  'Tríceps na polia com corda': ['Tríceps na polia com barra', 'Tríceps testa'],
  'Tríceps na polia com barra': ['Tríceps na polia com corda', 'Tríceps testa'],
  'Tríceps francês': ['Tríceps testa', 'Tríceps na polia com corda'],
  'Supino fechado': ['Mergulho entre bancos', 'Tríceps testa'],

  'Agachamento livre': ['Leg press', 'Hack machine', 'Agachamento frontal'],
  'Agachamento frontal': ['Agachamento livre', 'Hack machine', 'Leg press'],
  'Leg press': ['Agachamento livre', 'Hack machine', 'Afundo com halteres'],
  'Hack machine': ['Leg press', 'Agachamento livre'],
  'Cadeira extensora': ['Leg press', 'Afundo com halteres'],
  'Afundo com halteres': ['Afundo com barra', 'Leg press'],

  Stiff: ['Levantamento terra romeno', 'Mesa flexora'],
  'Levantamento terra romeno': ['Stiff', 'Mesa flexora'],
  'Mesa flexora': ['Cadeira flexora', 'Levantamento terra romeno'],
  'Cadeira flexora': ['Mesa flexora', 'Stiff'],
  'Elevação pélvica com barra': ['Coice na polia', 'Abdução na máquina'],

  'Panturrilha em pé': ['Panturrilha sentado', 'Panturrilha no leg press'],
  'Panturrilha sentado': ['Panturrilha em pé', 'Panturrilha no leg press'],

  Prancha: ['Prancha lateral', 'Abdominal supra'],
  'Abdominal supra': ['Abdominal na polia', 'Abdominal infra'],
  'Elevação de pernas na barra': ['Abdominal infra', 'Abdominal supra'],

  Esteira: ['Bicicleta ergométrica', 'Elíptico', 'Remo ergômetro'],
  'Bicicleta ergométrica': ['Elíptico', 'Esteira', 'Remo ergômetro'],
  Elíptico: ['Bicicleta ergométrica', 'Esteira'],
};

/** Sugestões pelo mesmo grupo muscular, quando não há substituição mapeada. */
export function substitutosDe(nome: string): string[] {
  return SUBSTITUICOES[nome] ?? [];
}

export const MOTIVOS_TROCA = [
  { chave: 'ocupado', label: 'Aparelho ocupado', emoji: '⏳' },
  { chave: 'sem_equipamento', label: 'Academia não tem', emoji: '🚫' },
  { chave: 'dor', label: 'Senti dor ou desconforto', emoji: '🤕' },
  { chave: 'preferencia', label: 'Prefiro outro', emoji: '🔄' },
];

/**
 * Padrão de movimento, deduzido do nome.
 *
 * ── Por que isto existe ──────────────────────────────────────────────────
 *
 * O gerador escolhia exercício por ordem de catálogo. Num dia de costas com
 * espaço para quatro, saíam levantamento terra, barra fixa, barra fixa supinada
 * e puxada frontal — quatro puxadas verticais e nenhuma remada, com quatro
 * remadas paradas na lista logo abaixo. Volume alto e cobertura pobre: a parte
 * do dorsal que remada treina simplesmente não era treinada.
 *
 * A dedução por nome é grosseira de propósito. Os nomes são nossos, escritos
 * neste repositório, e não mudam sozinhos — uma coluna nova no catálogo seria
 * mais bonita e daria o mesmo resultado com 104 linhas a mais para manter.
 * Exercício que não casa com nada cai em 'outro', e 'outro' entra no rodízio
 * como qualquer outro padrão.
 */
export function padraoDe(nome: string, grupo: string): string {
  const n = nome.toLowerCase();
  if (grupo === 'costas') {
    if (/remada/.test(n)) return 'horizontal';
    if (/puxada|barra fixa|pulldown/.test(n)) return 'vertical';
    return 'extensao';
  }
  if (grupo === 'peito') {
    if (/crucifixo|voador|crossover/.test(n)) return 'abertura';
    if (/inclinad/.test(n)) return 'inclinado';
    return 'reto';
  }
  if (grupo === 'ombro') {
    if (/lateral/.test(n)) return 'lateral';
    if (/invers|face pull|posterior/.test(n)) return 'posterior';
    return 'desenvolvimento';
  }
  if (grupo === 'quadriceps') {
    if (/afundo|búlgaro|bulgaro|subida|passada|caminhand/.test(n)) return 'unilateral';
    if (/leg press|extensora|hack|cadeira/.test(n)) return 'maquina';
    return 'agachamento';
  }
  if (grupo === 'posterior') {
    if (/flexora|nórdica|nordica|ham raise/.test(n)) return 'joelho';
    return 'quadril';
  }
  if (grupo === 'gluteo') {
    if (/abdu|coice|monster/.test(n)) return 'abducao';
    return 'extensao';
  }
  // Braço também tem padrão, e ignorar isso deixava cinco séries da MESMA rosca
  // seguidas. O que muda entre eles é onde o músculo fica mais alongado: banco
  // inclinado e scott trabalham posições diferentes do bíceps, e martelo e
  // inversa mudam a pegada.
  if (grupo === 'biceps') {
    if (/martelo|invers/.test(n)) return 'pegada';
    if (/scott|concentrada|alta/.test(n)) return 'apoiada';
    return 'livre';
  }
  if (grupo === 'triceps') {
    if (/testa|franc/.test(n)) return 'acima';
    if (/mergulho|supino fechado/.test(n)) return 'composto';
    return 'polia';
  }
  return 'outro';
}

/**
 * Reordena para que padrões diferentes venham primeiro.
 *
 * Preserva a preferência dentro de cada padrão: o primeiro de cada grupo de
 * movimento é o que já estava melhor colocado. Só evita que os quatro primeiros
 * sejam a mesma coisa com outro nome.
 */
export function diversificar<T extends { nome: string }>(cands: T[], grupo: string): T[] {
  if (cands.length < 3) return cands;
  const porPadrao = new Map<string, T[]>();
  for (const c of cands) {
    const k = padraoDe(c.nome, grupo);
    if (!porPadrao.has(k)) porPadrao.set(k, []);
    porPadrao.get(k)!.push(c);
  }
  if (porPadrao.size < 2) return cands;

  const filas = [...porPadrao.values()];
  const saida: T[] = [];
  while (saida.length < cands.length) {
    for (const fila of filas) {
      const x = fila.shift();
      if (x) saida.push(x);
    }
  }
  return saida;
}
