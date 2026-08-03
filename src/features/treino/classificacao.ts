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
  // Era 'Crossover na polia baixa'. Nome de crucifixo, demonstração de supino
  // (`Cable_Chest_Press`) e classificação de composto — três identidades para o
  // mesmo item, com um `Crossover na polia` de verdade no catálogo ao lado. O
  // que a imagem mostra é um supino na polia, então foi o nome que cedeu: ele
  // continua composto (empurra com ombro e cotovelo), e o crossover volta a ser
  // só o crucifixo, isolador, com a prescrição de isolador.
  'Supino na polia',
  'Puxada assistida no graviton',
  'Barra fixa negativa',
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
    // Pulldown de braço estendido é EXTENSÃO DE OMBRO: o cotovelo não dobra, o
    // bíceps não entra. Caía em 'vertical' pelo regex do pulldown e ocupava a
    // vaga da puxada de verdade — dois movimentos diferentes contados como um.
    if (/braço estendido|braco estendido|pullover/.test(n)) return 'extensao_ombro';
    if (/puxada|barra fixa|pulldown/.test(n)) return 'vertical';
    if (/terra|hiperexten|bom dia/.test(n)) return 'lombar';
    return 'outro';
  }
  if (grupo === 'peito') {
    if (/crucifixo|voador|crossover/.test(n)) return 'abertura';
    if (/mergulho/.test(n)) return 'mergulho';
    // Toda flexão é a mesma flexão com o corpo em outra inclinação. Três delas
    // na sessão são o mesmo movimento três vezes, não três estímulos — e era
    // assim que 'reto' virava o balde onde caíam supino de máquina, de smith,
    // de barra e flexão, quatro exercícios que o algoritmo via como distintos.
    if (/flex[ãa]o/.test(n)) return 'horizontal';
    if (/inclinad/.test(n)) return 'inclinado';
    return 'horizontal';
  }
  if (grupo === 'ombro') {
    if (/lateral/.test(n)) return 'lateral';
    if (/invers|face pull|posterior/.test(n)) return 'posterior';
    if (/frontal/.test(n)) return 'frontal';
    if (/remada alta/.test(n)) return 'alta';
    return 'desenvolvimento';
  }
  if (grupo === 'quadriceps') {
    // Extensora é monoarticular: separá-la da prensa é o que impede leg press,
    // hack e extensora entrarem como se fossem três variações da mesma coisa.
    if (/extensora/.test(n)) return 'extensao_joelho';
    if (/afundo|búlgaro|bulgaro|subida|passada|caminhand/.test(n)) return 'unilateral';
    if (/leg press|hack/.test(n)) return 'prensa';
    if (/adutora/.test(n)) return 'aducao';
    return 'agachamento';
  }
  // Posterior e glúteo tinham DOIS padrões cada, contra cinco do quadríceps.
  // Com teto de 2 exercícios por padrão, isso dava teto efetivo de 4 exercícios
  // por sessão nesses grupos — e o volume que não cabia em exercício virava
  // série empilhada no que sobrou (8 séries de flexão nórdica num dia só). O
  // critério aqui é o mesmo dos outros grupos: o que muda o COMPRIMENTO em que
  // o músculo recebe carga é padrão diferente.
  if (grupo === 'posterior') {
    // Dentro da flexão de joelho o ângulo do QUADRIL decide o comprimento do
    // isquiotibial: sentado (quadril fletido) trabalha alongado, deitado
    // (quadril estendido) trabalha encurtado. São estímulos diferentes.
    if (/sentad|cadeira flexora/.test(n)) return 'joelho_sentado';
    if (/nórdica|nordica|ham raise/.test(n)) return 'joelho_excentrico';
    if (/flexora em p[ée]/.test(n)) return 'joelho_unilateral';
    if (/flexora/.test(n)) return 'joelho_deitado';
    if (/hiperexten/.test(n)) return 'lombar';
    return 'quadril';
  }
  if (grupo === 'gluteo') {
    if (/abdu|monster/.test(n)) return 'abducao';
    // Coice é extensão de quadril, não abdução: estava no balde errado desde o
    // começo, e o balde errado é o que faz dois movimentos diferentes disputarem
    // a mesma vaga.
    if (/coice/.test(n)) return 'extensao_unilateral';
    if (/pull through|bom dia|stiff|romeno/.test(n)) return 'hinge';
    if (/subida|afundo|b[úu]lgaro/.test(n)) return 'unilateral_em_pe';
    return 'ponte';
  }
  // Braço também tem padrão, e ignorar isso deixava cinco séries da MESMA rosca
  // seguidas. O que muda entre eles é onde o músculo fica mais alongado: banco
  // inclinado e scott trabalham posições diferentes do bíceps, e martelo e
  // inversa mudam a pegada.
  if (grupo === 'biceps') {
    if (/martelo|invers/.test(n)) return 'pegada';
    if (/scott|concentrada/.test(n)) return 'apoiada';
    if (/polia alta|inclinad/.test(n)) return 'alongada';
    return 'livre';
  }
  if (grupo === 'triceps') {
    if (/mergulho|supino fechado/.test(n)) return 'composto';
    if (/testa|franc/.test(n)) return 'acima';
    if (/coice|kickback/.test(n)) return 'coice';
    return 'polia';
  }
  // Panturrilha: joelho estendido carrega o gastrocnêmio, joelho fletido isola
  // o sóleo. Sem essa separação as sete panturrilhas do catálogo eram um padrão
  // só, e o preenchedor de tempo empilhava três delas na mesma sessão.
  if (grupo === 'panturrilha') {
    if (/sentad/.test(n)) return 'joelho_fletido';
    return 'joelho_estendido';
  }
  if (grupo === 'abdomen') {
    if (/lateral|twist|obl[íi]qu/.test(n)) return 'rotacao';
    if (/prancha/.test(n)) return 'antiextensao';
    if (/infra|eleva[çc][ãa]o de pernas|escalador/.test(n)) return 'infra';
    return 'supra';
  }
  if (grupo === 'trapezio') {
    if (/remada alta|puxada alta/.test(n)) return 'alta';
    return 'encolhimento';
  }
  return 'outro';
}

/**
 * Perfil de resistência — ONDE a carga é máxima ao longo da amplitude.
 *
 * ── Por que é uma pergunta diferente de "qual padrão de movimento" ────────
 *
 * Supino com barra e supino na polia são o mesmo padrão (empurrar horizontal) e
 * não são o mesmo estímulo: na barra a carga desaparece no topo e é máxima no
 * meio; no cabo ela é constante; na máquina a came decide. É isso — e só isso —
 * que justifica dois exercícios do MESMO padrão na mesma sessão.
 *
 * Sem essa distinção, "dois exercícios por padrão" vira licença para supino de
 * máquina e supino de smith juntos, que é a repetição que o teto deveria
 * impedir. Com ela, o segundo exercício de um padrão só entra quando traz uma
 * curva de resistência que o primeiro não tem.
 *
 * O equipamento do catálogo é a fonte quando existe; o nome é o plano B, para
 * quem chama a função sem a linha do banco na mão.
 */
export function perfilDeResistencia(nome: string, equipamento?: string | null): string {
  if (equipamento) return equipamento === 'livre' ? 'corporal' : equipamento;
  const n = nome.toLowerCase();
  if (/polia|cabo|crossover|corda|graviton/.test(n)) return 'cabo';
  if (/m[áa]quina|smith|voador|peck|leg press|hack|mesa |cadeira |extensora|flexora/.test(n))
    return 'maquina';
  if (/halter/.test(n)) return 'halter';
  if (/barra fixa|flex[ãa]o|mergulho|prancha|abdominal|ponte/.test(n)) return 'corporal';
  if (/barra/.test(n)) return 'barra';
  return 'corporal';
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

/**
 * Exercícios em que a carga é o próprio corpo — e a troca quando ela não cabe.
 *
 * ── Por que esta lista existe ────────────────────────────────────────────
 *
 * O resto do catálogo se ajusta pela anilha: quem não consegue supino com 60 kg
 * faz com 40. Estes não têm essa saída. Barra fixa com 88 kg de corpo é barra
 * fixa com 88 kg, e prescrever 4 séries de 5 a 8 para quem faz 3 no máximo não
 * é treino difícil: é treino que não acontece.
 *
 * Pior pela posição: como são compostos, entram no COMEÇO da sessão. O dia todo
 * passava a começar com uma falha.
 *
 * `minReps` é quantas repetições a pessoa precisa fazer para o exercício render
 * como estímulo, não para conseguir uma. Com 5 repetições dá para fazer uma
 * série; não dá para fazer quatro séries de cinco a oito, que é o que a
 * prescrição pede. O corte em 6 vem daí.
 *
 * `ponte` é diferente de `troca`: a troca resolve o treino de hoje, a ponte
 * constrói o exercício. Quem quer barra fixa não chega lá fazendo puxada
 * sentada — precisa sustentar o próprio peso com carga dosável.
 */
export const FORCA_RELATIVA: Record<
  string,
  { minReps: number; troca: string; ponte?: string }
> = {
  'Barra fixa': { minReps: 6, troca: 'Puxada frontal na polia', ponte: 'Puxada assistida no graviton' },
  'Barra fixa supinada': { minReps: 6, troca: 'Puxada supinada', ponte: 'Barra fixa negativa' },
  'Mergulho no paralelo': { minReps: 6, troca: 'Mergulho entre bancos' },
  'Flexão nórdica': { minReps: 8, troca: 'Mesa flexora' },
  'Remada invertida': { minReps: 8, troca: 'Remada baixa na polia' },
  'Flexão com pés elevados': { minReps: 8, troca: 'Flexão de braço' },
  'Flexão pique': { minReps: 8, troca: 'Desenvolvimento com halteres' },
};

/**
 * O que fazer com um exercício de força relativa, dadas as barras fixas da pessoa.
 *
 * Devolve `null` quando o exercício pode entrar como está. Usa a barra fixa como
 * triagem única de propósito: é a que mais gente esbarra, é a que todo treinador
 * pergunta, e pedir uma pergunta por movimento transformaria o questionário num
 * formulário que ninguém termina.
 *
 * -1 (não perguntado) deixa passar: melhor prescrever e a pessoa trocar na mão
 * do que esconder exercício de quem nunca foi perguntado.
 */
export function ajusteDeForcaRelativa(
  nome: string,
  barraFixaReps: number
): { troca: string; motivo: string } | null {
  const r = FORCA_RELATIVA[nome];
  // `!Number.isFinite` cobre undefined vindo de perfil antigo: sem resposta, o
  // exercício passa. A alternativa era o valor ausente parecer "zero barras" e
  // substituir tudo em quem nunca foi perguntado.
  if (!r || !Number.isFinite(barraFixaReps) || barraFixaReps < 0) return null;
  if (barraFixaReps >= r.minReps) return null;

  // Com alguma força já dá para usar a ponte, que continua exigindo sustentar o
  // corpo. Sem nenhuma, a ponte também falha e a troca é o caminho.
  const usarPonte = r.ponte && barraFixaReps >= 1;
  return {
    troca: usarPonte ? r.ponte! : r.troca,
    motivo: usarPonte
      ? `${nome} pede ao menos ${r.minReps} repetições limpas para render como série. ` +
        `Com ${barraFixaReps}, entrou ${r.ponte} no lugar — que continua exigindo sustentar seu ` +
        `peso, só com carga que dá para dosar. É o caminho para a barra fixa, não o desvio dela.`
      : `${nome} exige sustentar o próprio peso e ainda não cabe. Entrou ${r.troca} no lugar, ` +
        `que treina o mesmo músculo com carga que você escolhe.`,
  };
}
