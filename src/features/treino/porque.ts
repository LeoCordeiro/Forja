import { padraoDe, perfilDeResistencia } from './classificacao';
import { picoDeTensao, type Papel } from './papel';

/**
 * "Por que este exercício está aqui" — **uma casa só para a pergunta**.
 *
 * ── O que já existia, e o que faltava ────────────────────────────────────
 *
 * O PAPEL responde a parte estrutural, e isso está no ar desde G2: a tela do dia
 * mostra "Isolador · abre o grupo" e o executor mostra a frase do papel. Só que
 * a frase do papel é a mesma para os dois isoladores de peito da mesma sessão —
 * ela explica a FUNÇÃO na sessão, não o que aquele exercício acrescenta que os
 * outros do dia não acrescentam. Quem lê duas vezes a mesma frase conclui,
 * corretamente, que um dos dois está sobrando.
 *
 * ── Derivado, e por quê ──────────────────────────────────────────────────
 *
 * Nada aqui é escrito exercício por exercício. O objetivo sai de três atributos
 * que o projeto já mantém e já usa para ESCOLHER o exercício:
 *
 * · `padraoDe` — o que o movimento faz (empurrar inclinado, abduzir, estender o
 *   cotovelo com o braço acima da cabeça).
 * · `perfilDeResistencia` — onde a carga aperta ao longo da amplitude. É por isso
 *   que dois exercícios do MESMO padrão podem coexistir: a barra some no topo, o
 *   cabo é constante, a came da máquina decide.
 * · `picoDeTensao` — em que comprimento o músculo recebe a carga.
 *
 * Ou seja: a resposta que o gerador dá para si mesmo ao montar o dia é a mesma
 * que chega ao usuário. Se um dia elas divergirem, é porque o gerador escolheu
 * por um motivo que não sabe explicar — e aí o problema é a escolha.
 *
 * ── E `PORQUE_PAPEL` mudou de casa ───────────────────────────────────────
 *
 * Ele morava em `papel.ts`. Deixá-lo lá e criar a camada específica aqui daria
 * DUAS casas para "por que este exercício está aqui" — e regra velha viva ao
 * lado da nova é a que a próxima pessoa acha primeiro. Foi assim que
 * `descansoSugerido` sobreviveu até A5 e que o crossover ficou composto numa
 * função e abertura em outra. `papel.ts` continua dono do PAPEL; esta pergunta é
 * de produto, e mora aqui inteira.
 */

export const PORQUE_PAPEL: Record<Papel, string> = {
  principal:
    'Abre o grupo e é a carga que o app compara semana a semana. Faça descansado, com técnica limpa.',
  complementar:
    'Mesmo grupo, padrão de movimento diferente do principal — cobre o que ele não cobre.',
  isolador: 'Um músculo só, na posição em que os compostos do dia não o carregam.',
  finalizador: 'Fecha a sessão. É onde dá para chegar perto da falha sem custo de coordenação.',
};

/**
 * O que cada PADRÃO de movimento faz — a chave é `grupo:padrão`, nunca o nome.
 *
 * `rotulo` é como se fala do movimento numa frase ("o empurrar inclinado do
 * dia"); `acao` é o que ele acrescenta. As chaves são exatamente as que
 * `padraoDe` devolve: quando alguém acrescentar um padrão lá, o `??` abaixo
 * ainda responde, e o teste de objetivo específico continua passando.
 */
const PADRAO: Record<string, { rotulo: string; acao: string }> = {
  'peito:horizontal': {
    rotulo: 'empurrar horizontal',
    acao: 'Empurrar na horizontal — o movimento em que o peito move mais carga e o que serve de régua de força',
  },
  'peito:inclinado': {
    rotulo: 'empurrar inclinado',
    acao: 'Empurrar inclinado, o único ângulo do dia que cobra a parte de cima do peito e as fibras claviculares',
  },
  'peito:abertura': {
    rotulo: 'abertura',
    acao: 'Abrir os braços sem dobrar o cotovelo: é o único jeito de carregar o peito sem o tríceps entrar na conta',
  },
  'peito:mergulho': {
    rotulo: 'mergulho',
    acao: 'Empurrar para baixo com o tronco inclinado, que traz a porção inferior do peito para dentro do treino',
  },
  'costas:vertical': {
    rotulo: 'puxar vertical',
    acao: 'Puxar de cima, que é o que treina o dorsal na direção em que ele encurta',
  },
  'costas:horizontal': {
    rotulo: 'remada',
    acao: 'Remar, que carrega a espessura das costas — a parte que puxada nenhuma alcança',
  },
  'costas:extensao_ombro': {
    rotulo: 'extensão de ombro',
    acao: 'Estender o ombro com o cotovelo travado, isolando o dorsal sem o bíceps roubar a série',
  },
  'costas:lombar': {
    rotulo: 'cadeia posterior',
    acao: 'Carregar a cadeia posterior inteira de pé, que é força de tronco e não largura de dorsal',
  },
  'ombro:desenvolvimento': {
    rotulo: 'desenvolvimento',
    acao: 'Empurrar acima da cabeça, que é onde o deltoide anterior move carga de verdade',
  },
  'ombro:lateral': {
    rotulo: 'abdução lateral',
    acao: 'Abrir o braço para o lado: é o único movimento que carrega o deltoide MEDIAL, o que dá largura vista de frente',
  },
  'ombro:posterior': {
    rotulo: 'ombro posterior',
    acao: 'Abrir para trás com rotação externa, que treina o deltoide posterior — o que todo dia de empurrar deixa de fora',
  },
  'ombro:frontal': {
    rotulo: 'elevação frontal',
    acao: 'Levantar o braço à frente, que carrega o deltoide anterior isolado do empurrão',
  },
  'ombro:alta': {
    rotulo: 'remada alta',
    acao: 'Puxar em direção ao queixo, misturando abdução com trapézio numa única linha de força',
  },
  'triceps:acima': {
    rotulo: 'extensão com o braço acima da cabeça',
    acao: 'Estender o cotovelo com o braço acima da cabeça — a única posição em que a cabeça longa do tríceps fica alongada',
  },
  'triceps:polia': {
    rotulo: 'extensão neutra',
    acao: 'Estender o cotovelo com o braço ao lado do corpo, no trecho em que o tríceps fecha a contração',
  },
  'triceps:coice': {
    rotulo: 'coice',
    acao: 'Estender o cotovelo com o ombro já para trás, carregando o tríceps no ponto mais encurtado',
  },
  'triceps:composto': {
    rotulo: 'empurrão',
    acao: 'Estender o cotovelo dentro de um empurrão, com o peito e o ombro dividindo a carga',
  },
  'biceps:livre': {
    rotulo: 'rosca em pé',
    acao: 'Flexionar o cotovelo com o braço ao lado do corpo, que é onde o bíceps carrega mais peso',
  },
  'biceps:alongada': {
    rotulo: 'rosca com o braço atrás',
    acao: 'Flexionar o cotovelo com o braço atrás da linha do tronco, onde o bíceps trabalha alongado',
  },
  'biceps:apoiada': {
    rotulo: 'rosca apoiada',
    acao: 'Flexionar com o braço apoiado à frente, que fecha o topo e impede roubar com o tronco',
  },
  'biceps:pegada': {
    rotulo: 'pegada neutra',
    acao: 'Flexionar com a pegada neutra ou pronada, que traz o braquial e o antebraço para dentro do treino',
  },
  'quadriceps:agachamento': {
    rotulo: 'agachamento',
    acao: 'Agachar, que carrega a coxa inteira e é a régua de força de perna do programa',
  },
  'quadriceps:prensa': {
    rotulo: 'prensa',
    acao: 'Empurrar com as costas apoiadas, que carrega o quadríceps sem cobrar a coluna',
  },
  'quadriceps:unilateral': {
    rotulo: 'unilateral',
    acao: 'Trabalhar uma perna de cada vez, que corrige diferença entre os lados e cobra equilíbrio',
  },
  'quadriceps:extensao_joelho': {
    rotulo: 'extensão de joelho',
    acao: 'Estender o joelho isolado, que fecha o topo do quadríceps sem quadril nenhum na conta',
  },
  'quadriceps:aducao': {
    rotulo: 'adução',
    acao: 'Fechar a perna contra resistência, treinando o adutor que todo agachamento usa e nenhum treina direto',
  },
  'posterior:quadril': {
    rotulo: 'flexão de quadril carregada',
    acao: 'Carregar o isquiotibial pelo QUADRIL, com o joelho quase estendido — o alongamento sob carga',
  },
  'posterior:joelho_sentado': {
    rotulo: 'flexora sentado',
    acao: 'Flexionar o joelho com o quadril dobrado, que é a posição em que o isquiotibial trabalha mais alongado',
  },
  'posterior:joelho_deitado': {
    rotulo: 'flexora deitado',
    acao: 'Flexionar o joelho com o quadril estendido, no trecho encurtado do isquiotibial',
  },
  'posterior:joelho_unilateral': {
    rotulo: 'flexora unilateral',
    acao: 'Flexionar o joelho de um lado por vez, expondo a diferença entre as pernas',
  },
  'posterior:joelho_excentrico': {
    rotulo: 'excêntrico de isquiotibial',
    acao: 'Frear a descida com o isquiotibial, que é o treino excêntrico específico dessa musculatura',
  },
  'posterior:lombar': {
    rotulo: 'extensão de tronco',
    acao: 'Estender o tronco contra a gravidade, que carrega a lombar e o glúteo junto',
  },
  'gluteo:hinge': {
    rotulo: 'dobradiça de quadril',
    acao: 'Dobrar o quadril com carga, que treina o glúteo na posição alongada',
  },
  'gluteo:ponte': {
    rotulo: 'extensão de quadril deitado',
    acao: 'Estender o quadril com as costas apoiadas, que põe a carga máxima no topo da contração do glúteo',
  },
  'gluteo:abducao': {
    rotulo: 'abdução de quadril',
    acao: 'Abrir a perna para o lado, que é o único movimento que treina o glúteo médio',
  },
  'gluteo:unilateral_em_pe': {
    rotulo: 'unilateral em pé',
    acao: 'Estender o quadril de pé, uma perna por vez, que é como o glúteo trabalha ao andar e subir',
  },
  'gluteo:extensao_unilateral': {
    rotulo: 'extensão unilateral',
    acao: 'Estender o quadril isolado de um lado, sem a coxa dividir a carga',
  },
  'panturrilha:joelho_estendido': {
    rotulo: 'panturrilha em pé',
    acao: 'Subir na ponta com o joelho estendido, que carrega o gastrocnêmio',
  },
  'panturrilha:joelho_fletido': {
    rotulo: 'panturrilha sentado',
    acao: 'Subir na ponta com o joelho dobrado, que tira o gastrocnêmio e isola o sóleo',
  },
  'abdomen:supra': {
    rotulo: 'flexão de tronco',
    acao: 'Encurtar a distância entre costela e quadril, que é o que o reto abdominal faz',
  },
  'abdomen:infra': {
    rotulo: 'elevação de pernas',
    acao: 'Levar o quadril em direção às costelas, que cobra a porção de baixo do abdômen',
  },
  'abdomen:rotacao': {
    rotulo: 'rotação',
    acao: 'Girar o tronco contra resistência, que é a função dos oblíquos',
  },
  'abdomen:antiextensao': {
    rotulo: 'anti-extensão',
    acao: 'Impedir a lombar de ceder, que é o que o abdômen faz o dia inteiro fora da academia',
  },
  'trapezio:encolhimento': {
    rotulo: 'encolhimento',
    acao: 'Subir o ombro em direção à orelha, que é a única linha de força do trapézio superior',
  },
  'trapezio:alta': {
    rotulo: 'puxada alta',
    acao: 'Puxar em diagonal para cima, misturando trapézio com deltoide',
  },
};

/** Onde a carga aperta ao longo da amplitude — o que justifica dois do mesmo padrão. */
const CURVA: Record<string, string> = {
  barra: 'na barra a carga é máxima no meio e alivia no topo',
  halter: 'com halteres cada lado carrega sozinho e a amplitude é maior que na barra',
  maquina: 'na máquina a came segura a carga onde o peso livre alivia',
  cabo: 'no cabo a tensão é constante do começo ao fim, sem ponto de descanso',
  corporal: 'com o peso do corpo a carga muda com o ângulo, não com a anilha',
};

const PICO: Record<string, string> = {
  alongado: 'alongada',
  encurtado: 'encurtada',
  meio: 'no meio da amplitude',
};

const COMO_SE_FALA: Record<string, string> = {
  peito: 'o peito',
  costas: 'as costas',
  ombro: 'o ombro',
  biceps: 'o bíceps',
  triceps: 'o tríceps',
  quadriceps: 'o quadríceps',
  posterior: 'o posterior de coxa',
  gluteo: 'o glúteo',
  panturrilha: 'a panturrilha',
  abdomen: 'o abdômen',
  trapezio: 'o trapézio',
  antebraco: 'o antebraço',
};

export interface ItemDoDia {
  nome: string;
  grupo: string;
  equipamento?: string | null;
  papel?: Papel | string | null;
}

const doPadrao = (nome: string, grupo: string) =>
  PADRAO[`${grupo}:${padraoDe(nome, grupo)}`] ?? {
    rotulo: padraoDe(nome, grupo).replace(/_/g, ' '),
    acao: `Trabalhar ${COMO_SE_FALA[grupo] ?? grupo} no padrão ${padraoDe(nome, grupo).replace(/_/g, ' ')}`,
  };

/**
 * O que ESTE exercício acrescenta ao dia — a resposta é sobre o dia, não sobre
 * o exercício.
 *
 * A frase tem duas metades e as duas são necessárias. A primeira é o que o
 * movimento faz (padrão). A segunda é o que ele acrescenta em relação ao resto
 * da sessão — e é ela que muda quando o dia muda, que é o motivo de a função
 * receber a sessão inteira em vez de só a linha.
 *
 * A unicidade dentro do grupo não é sorte: o gerador só aceita um segundo
 * exercício no mesmo padrão quando o PERFIL DE RESISTÊNCIA é outro
 * (`cabeNoPadrao`). Então `padrão + perfil` já distingue quaisquer dois
 * exercícios do mesmo grupo na mesma sessão, e é sobre esse par que a frase é
 * construída.
 */
export function porqueEsteExercicio(ex: ItemDoDia, doDia: ItemDoDia[]): string {
  if (ex.grupo === 'cardio') return '';

  const { acao, rotulo } = doPadrao(ex.nome, ex.grupo);
  const meuPadrao = padraoDe(ex.nome, ex.grupo);
  const meuPico = picoDeTensao(ex.nome, ex.grupo);
  const meuPerfil = perfilDeResistencia(ex.nome, ex.equipamento);

  const irmaos = doDia.filter(
    (o) => o.grupo === ex.grupo && o.nome !== ex.nome && o.grupo !== 'cardio'
  );
  const mesmoPadrao = irmaos.filter((o) => padraoDe(o.nome, ex.grupo) === meuPadrao);

  // Dois exercícios no mesmo padrão só coexistem por causa da curva de carga —
  // então é exatamente isso que a frase precisa dizer.
  if (mesmoPadrao.length) {
    const outro = mesmoPadrao[0];
    return (
      `${acao}. Divide o ${rotulo} do dia com ${outro.nome}, e a diferença é onde a carga aperta: ` +
      `${CURVA[meuPerfil] ?? CURVA.corporal}.`
    );
  }

  // Único do padrão. Se também for o único naquele comprimento muscular, é essa
  // a informação que vale — é o critério de A7 ("ao menos um monoarticular na
  // posição alongada") dito em português.
  const outroNoMesmoPico = irmaos.some((o) => picoDeTensao(o.nome, ex.grupo) === meuPico);
  const grupoFalado = COMO_SE_FALA[ex.grupo] ?? ex.grupo;

  if (!outroNoMesmoPico && meuPico !== 'meio' && irmaos.length) {
    return (
      `${acao}. É o único do dia que carrega ${grupoFalado} na posição ${PICO[meuPico]} — ` +
      `nenhum outro exercício da sessão chega nesse comprimento.`
    );
  }

  if (!irmaos.length) {
    return `${acao}. É o ${rotulo} do dia: sozinho, ele responde por ${grupoFalado} na sessão inteira.`;
  }

  return (
    `${acao}. É o único ${rotulo} do dia — os outros ${irmaos.length} exercício(s) de ` +
    `${grupoFalado} não fazem esse movimento.`
  );
}
