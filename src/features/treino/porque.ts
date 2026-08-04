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
 * outros do dia não acrescentam.
 *
 * ── Por que este arquivo foi reescrito (validação de tela do G3) ─────────
 *
 * A primeira versão montava as frases concatenando preposição, artigo e rótulo
 * como se português não tivesse gênero nem contração. Varrida exaustivamente,
 * ela produzia **457 frases distintas e 7 corretas — 1,5%**:
 *
 * | defeito | frases |
 * |---|---|
 * | `de` sem contrair (`de o peito`, `de as costas`) | 145 |
 * | `por` sem contrair (`por o peito`, `por as costas`) | 45 |
 * | `exercício(s)` literal na tela | 145 |
 * | gênero errado (`É o abertura`, `É o cadeia posterior`) | 235 |
 * | acima de 200 caracteres | 293 |
 *
 * A causa é estrutural e por isso a correção também é: **32 dos 45 rótulos são
 * femininos** e todos entravam depois de um "o" fixo; `COMO_SE_FALA` embutia o
 * artigo no meio da string, então nenhuma preposição tinha como contrair; e o
 * `(s)` era a marca de que ninguém tinha resolvido singular e plural.
 *
 * Agora todo substantivo declara `genero` e `plural`, `artigo` e `contrair` são
 * funções, e **nenhum template conta exercícios** — contar era o único motivo de
 * existir o `(s)`, e a contagem não acrescentava informação nenhuma.
 *
 * ── Derivado, e por quê ──────────────────────────────────────────────────
 *
 * Nada aqui é escrito exercício por exercício. O objetivo sai de `padraoDe`,
 * `perfilDeResistencia` e `picoDeTensao` — os mesmos atributos que o gerador usa
 * para ESCOLHER o exercício. Se um dia divergirem, é porque o gerador escolheu
 * por um motivo que não sabe explicar, e aí o problema é a escolha.
 */

export const PORQUE_PAPEL: Record<Papel, string> = {
  principal:
    'Abre o grupo e é a carga que o app compara semana a semana. Faça descansado, com técnica limpa.',
  complementar:
    'Mesmo grupo, padrão de movimento diferente do principal — cobre o que ele não cobre.',
  isolador: 'Um músculo só, na posição em que os compostos do dia não o carregam.',
  finalizador: 'Fecha a sessão. É onde dá para chegar perto da falha sem custo de coordenação.',
};

// ── Gramática, que aqui é regra de código e não detalhe de texto ──────────

export interface Substantivo {
  nome: string;
  genero: 'm' | 'f';
  /** `costas` é plural e nunca deixa de ser. */
  plural?: boolean;
}

export function artigo(s: Substantivo): string {
  if (s.plural) return s.genero === 'm' ? 'os' : 'as';
  return s.genero === 'm' ? 'o' : 'a';
}

/**
 * Preposição + artigo, contraídos — a função que faltava.
 *
 * Sem ela o app escrevia "responde por as costas" e "os outros exercícios de o
 * peito" em 190 frases. Contração em português é obrigatória, não estilo.
 */
const CONTRACAO: Record<string, Record<string, string>> = {
  de: { o: 'do', a: 'da', os: 'dos', as: 'das' },
  por: { o: 'pelo', a: 'pela', os: 'pelos', as: 'pelas' },
  em: { o: 'no', a: 'na', os: 'nos', as: 'nas' },
};

export function contrair(prep: 'de' | 'por' | 'em', s: Substantivo): string {
  return `${CONTRACAO[prep][artigo(s)]} ${s.nome}`;
}

/** "o peito" / "as costas" / "a panturrilha". */
export function comArtigo(s: Substantivo): string {
  return `${artigo(s)} ${s.nome}`;
}

/** "o único mergulho" / "a única abertura" — concorda com o RÓTULO. */
export function unicoDe(s: Substantivo): string {
  if (s.plural) return s.genero === 'm' ? `os únicos ${s.nome}` : `as únicas ${s.nome}`;
  return s.genero === 'm' ? `o único ${s.nome}` : `a única ${s.nome}`;
}

const GRUPOS: Record<string, Substantivo> = {
  peito: { nome: 'peito', genero: 'm' },
  costas: { nome: 'costas', genero: 'f', plural: true },
  ombro: { nome: 'ombro', genero: 'm' },
  biceps: { nome: 'bíceps', genero: 'm' },
  triceps: { nome: 'tríceps', genero: 'm' },
  quadriceps: { nome: 'quadríceps', genero: 'm' },
  posterior: { nome: 'posterior de coxa', genero: 'm' },
  gluteo: { nome: 'glúteo', genero: 'm' },
  panturrilha: { nome: 'panturrilha', genero: 'f' },
  abdomen: { nome: 'abdômen', genero: 'm' },
  trapezio: { nome: 'trapézio', genero: 'm' },
  antebraco: { nome: 'antebraço', genero: 'm' },
};

const grupoDe = (g: string): Substantivo => GRUPOS[g] ?? { nome: g, genero: 'm' };

/**
 * O que cada PADRÃO faz — chave `grupo:padrão`, nunca o nome do exercício.
 *
 * `rotulo` é como se fala do movimento numa frase, **com o gênero declarado**;
 * `acao` é o que ele acrescenta, em até uma linha. As ações encolheram de
 * propósito: 64% das frases passavam de 200 caracteres, e na tela do dia (coluna
 * de 202 px, 11 px) isso virava 6 a 9 linhas por card — 910 px só de objetivo.
 */
const PADRAO: Record<string, { rotulo: Substantivo; acao: string }> = {
  'peito:horizontal': {
    rotulo: { nome: 'empurrar horizontal', genero: 'm' },
    acao: 'Empurrar na horizontal, onde o peito move mais carga',
  },
  'peito:inclinado': {
    rotulo: { nome: 'empurrar inclinado', genero: 'm' },
    acao: 'Empurrar inclinado, que cobra a parte de cima do peito',
  },
  'peito:abertura': {
    rotulo: { nome: 'abertura', genero: 'f' },
    acao: 'Abrir os braços sem dobrar o cotovelo, sem o tríceps na conta',
  },
  'peito:mergulho': {
    rotulo: { nome: 'mergulho', genero: 'm' },
    acao: 'Empurrar para baixo, que traz a porção inferior do peito',
  },
  'costas:vertical': {
    rotulo: { nome: 'puxada vertical', genero: 'f' },
    acao: 'Puxar de cima, a direção em que o dorsal encurta',
  },
  'costas:horizontal': {
    rotulo: { nome: 'remada', genero: 'f' },
    acao: 'Remar, que carrega a espessura que a puxada não alcança',
  },
  'costas:extensao_ombro': {
    rotulo: { nome: 'extensão de ombro', genero: 'f' },
    acao: 'Estender o ombro com o cotovelo travado, sem o bíceps',
  },
  'costas:lombar': {
    rotulo: { nome: 'cadeia posterior', genero: 'f' },
    acao: 'Carregar a cadeia posterior de pé: força, não largura',
  },
  'ombro:desenvolvimento': {
    rotulo: { nome: 'desenvolvimento', genero: 'm' },
    acao: 'Empurrar acima da cabeça, onde o deltoide anterior carrega',
  },
  'ombro:lateral': {
    rotulo: { nome: 'abdução lateral', genero: 'f' },
    acao: 'Abrir o braço para o lado, que carrega o deltoide medial',
  },
  'ombro:posterior': {
    rotulo: { nome: 'abertura posterior', genero: 'f' },
    acao: 'Abrir para trás com rotação externa, o que o empurrão pula',
  },
  'ombro:frontal': {
    rotulo: { nome: 'elevação frontal', genero: 'f' },
    acao: 'Levantar o braço à frente, isolando o deltoide anterior',
  },
  'ombro:alta': {
    rotulo: { nome: 'remada alta', genero: 'f' },
    acao: 'Puxar em direção ao queixo, misturando abdução e trapézio',
  },
  'triceps:acima': {
    rotulo: { nome: 'extensão com o braço acima da cabeça', genero: 'f' },
    acao: 'Estender o cotovelo acima da cabeça, com a cabeça longa alongada',
  },
  'triceps:polia': {
    rotulo: { nome: 'extensão neutra', genero: 'f' },
    acao: 'Estender o cotovelo com o braço ao lado, fechando a contração',
  },
  'triceps:coice': {
    rotulo: { nome: 'coice', genero: 'm' },
    acao: 'Estender o cotovelo com o ombro para trás, no ponto encurtado',
  },
  'triceps:composto': {
    rotulo: { nome: 'empurrão', genero: 'm' },
    acao: 'Estender o cotovelo dentro de um empurrão, com peito e ombro',
  },
  'biceps:livre': {
    rotulo: { nome: 'rosca em pé', genero: 'f' },
    acao: 'Flexionar o cotovelo com o braço ao lado, onde carrega mais',
  },
  'biceps:alongada': {
    rotulo: { nome: 'rosca com o braço atrás', genero: 'f' },
    acao: 'Flexionar com o braço atrás do tronco, com o bíceps alongado',
  },
  'biceps:apoiada': {
    rotulo: { nome: 'rosca apoiada', genero: 'f' },
    acao: 'Flexionar com o braço apoiado, que impede roubar com o tronco',
  },
  'biceps:pegada': {
    rotulo: { nome: 'rosca de pegada neutra', genero: 'f' },
    acao: 'Flexionar com pegada neutra, trazendo o braquial',
  },
  'quadriceps:agachamento': {
    rotulo: { nome: 'agachamento', genero: 'm' },
    acao: 'Agachar, que carrega a coxa inteira e mede a força de perna',
  },
  'quadriceps:prensa': {
    rotulo: { nome: 'prensa', genero: 'f' },
    acao: 'Empurrar com as costas apoiadas, sem cobrar a coluna',
  },
  'quadriceps:unilateral': {
    rotulo: { nome: 'trabalho unilateral', genero: 'm' },
    acao: 'Uma perna de cada vez, que corrige diferença entre lados',
  },
  'quadriceps:extensao_joelho': {
    rotulo: { nome: 'extensão de joelho', genero: 'f' },
    acao: 'Estender o joelho isolado, sem o quadril na conta',
  },
  'quadriceps:aducao': {
    rotulo: { nome: 'adução', genero: 'f' },
    acao: 'Fechar a perna contra resistência, treinando o adutor direto',
  },
  'posterior:quadril': {
    rotulo: { nome: 'flexão de quadril carregada', genero: 'f' },
    acao: 'Carregar o isquiotibial pelo quadril, joelho quase estendido',
  },
  'posterior:joelho_sentado': {
    rotulo: { nome: 'flexora sentada', genero: 'f' },
    acao: 'Flexionar o joelho com o quadril dobrado, mais alongado',
  },
  'posterior:joelho_deitado': {
    rotulo: { nome: 'flexora deitada', genero: 'f' },
    acao: 'Flexionar o joelho com o quadril estendido, encurtado',
  },
  'posterior:joelho_unilateral': {
    rotulo: { nome: 'flexora unilateral', genero: 'f' },
    acao: 'Flexionar o joelho um lado por vez, expondo a diferença',
  },
  'posterior:joelho_excentrico': {
    rotulo: { nome: 'excêntrico de isquiotibial', genero: 'm' },
    acao: 'Frear a descida com o isquiotibial, o excêntrico dele',
  },
  'posterior:lombar': {
    rotulo: { nome: 'extensão de tronco', genero: 'f' },
    acao: 'Estender o tronco contra a gravidade: lombar e glúteo',
  },
  'gluteo:hinge': {
    rotulo: { nome: 'dobradiça de quadril', genero: 'f' },
    acao: 'Dobrar o quadril com carga, treinando o glúteo alongado',
  },
  'gluteo:ponte': {
    rotulo: { nome: 'extensão de quadril apoiada', genero: 'f' },
    acao: 'Estender o quadril apoiado, carga máxima na contração',
  },
  'gluteo:abducao': {
    rotulo: { nome: 'abdução de quadril', genero: 'f' },
    acao: 'Abrir a perna para o lado, o único movimento do glúteo médio',
  },
  'gluteo:unilateral_em_pe': {
    rotulo: { nome: 'extensão unilateral em pé', genero: 'f' },
    acao: 'Estender o quadril de pé, uma perna por vez',
  },
  'gluteo:extensao_unilateral': {
    rotulo: { nome: 'extensão unilateral', genero: 'f' },
    acao: 'Estender o quadril isolado, sem a coxa dividir a carga',
  },
  'panturrilha:joelho_estendido': {
    rotulo: { nome: 'panturrilha em pé', genero: 'f' },
    acao: 'Subir na ponta com o joelho estendido: gastrocnêmio',
  },
  'panturrilha:joelho_fletido': {
    rotulo: { nome: 'panturrilha sentada', genero: 'f' },
    acao: 'Subir na ponta com o joelho dobrado, que isola o sóleo',
  },
  'abdomen:supra': {
    rotulo: { nome: 'flexão de tronco', genero: 'f' },
    acao: 'Encurtar a distância entre costela e quadril',
  },
  'abdomen:infra': {
    rotulo: { nome: 'elevação de pernas', genero: 'f' },
    acao: 'Levar o quadril às costelas, cobrando a porção de baixo',
  },
  'abdomen:rotacao': {
    rotulo: { nome: 'rotação', genero: 'f' },
    acao: 'Girar o tronco contra resistência: função dos oblíquos',
  },
  'abdomen:antiextensao': {
    rotulo: { nome: 'anti-extensão', genero: 'f' },
    acao: 'Impedir a lombar de ceder, que é o abdômen fora da academia',
  },
  'trapezio:encolhimento': {
    rotulo: { nome: 'encolhimento', genero: 'm' },
    acao: 'Subir o ombro à orelha, linha de força do trapézio superior',
  },
  'trapezio:alta': {
    rotulo: { nome: 'puxada alta', genero: 'f' },
    acao: 'Puxar em diagonal para cima: trapézio e deltoide',
  },
};

/** Onde a carga aperta ao longo da amplitude — o que justifica dois do mesmo padrão. */
const CURVA: Record<string, string> = {
  barra: 'na barra a carga alivia no topo',
  halter: 'no halter cada lado carrega sozinho',
  maquina: 'na máquina a came segura onde o peso livre alivia',
  cabo: 'no cabo a tensão não some em ponto nenhum',
  corporal: 'no peso do corpo a carga muda com o ângulo',
};

export interface ItemDoDia {
  nome: string;
  grupo: string;
  equipamento?: string | null;
  papel?: Papel | string | null;
}

/**
 * O rótulo e a ação do padrão — com fallback que não vira frase quebrada.
 *
 * O fallback antigo produzia `"É o outro do dia"` no antebraço, porque
 * `padraoDe` devolve a string literal `'outro'` para grupo sem tabela de padrão
 * e o rótulo virava a palavra "outro". Agora o fallback nomeia o GRUPO, que é a
 * única informação verdadeira disponível ali.
 */
function doPadrao(nome: string, grupo: string): { rotulo: Substantivo; acao: string } {
  const achado = PADRAO[`${grupo}:${padraoDe(nome, grupo)}`];
  if (achado) return achado;
  const g = grupoDe(grupo);
  return {
    rotulo: { nome: `trabalho direto ${contrair('de', g)}`, genero: 'm' },
    acao: `Trabalho direto ${contrair('de', g)}`,
  };
}

/**
 * O que ESTE exercício acrescenta ao dia — a resposta é sobre o dia, não sobre
 * o exercício.
 *
 * Quatro saídas, e nenhuma delas conta exercícios. A contagem era o único motivo
 * de existir o `(s)` na tela, e ela não informava nada: "os outros 2 exercícios
 * de peito não fazem esse movimento" diz a mesma coisa que "é a única abertura
 * do dia", com 60 caracteres a mais e dois erros de português.
 *
 * A unicidade dentro do grupo não é sorte: o gerador só aceita um segundo
 * exercício no mesmo padrão quando o PERFIL DE RESISTÊNCIA é outro
 * (`cabeNoPadrao`). Então `padrão + perfil` já distingue quaisquer dois
 * exercícios do mesmo grupo na mesma sessão.
 */
export function porqueEsteExercicio(ex: ItemDoDia, doDia: ItemDoDia[]): string {
  if (ex.grupo === 'cardio') return '';

  const { acao, rotulo } = doPadrao(ex.nome, ex.grupo);
  const grupo = grupoDe(ex.grupo);
  const meuPadrao = padraoDe(ex.nome, ex.grupo);
  const meuPico = picoDeTensao(ex.nome, ex.grupo);
  const meuPerfil = perfilDeResistencia(ex.nome, ex.equipamento);

  const irmaos = doDia.filter(
    (o) => o.grupo === ex.grupo && o.nome !== ex.nome && o.grupo !== 'cardio'
  );
  const mesmoPadrao = irmaos.filter((o) => padraoDe(o.nome, ex.grupo) === meuPadrao);

  // Dois exercícios no mesmo padrão só coexistem por causa da curva de carga.
  // O nome do outro entra SEM artigo de propósito: decidir "do Supino" e "da
  // Remada" exigiria uma tabela de gênero para 117 nomes próprios, que é
  // exatamente o tipo de tabela que este arquivo existe para não ter.
  if (mesmoPadrao.length) {
    return `${acao}. Mesmo padrão de ${mesmoPadrao[0].nome}, com outra curva: ${CURVA[meuPerfil] ?? CURVA.corporal}.`;
  }

  // Único do padrão E único naquele comprimento muscular: é o critério de A7
  // ("ao menos um monoarticular na posição alongada") dito em português.
  const outroNoMesmoPico = irmaos.some((o) => picoDeTensao(o.nome, ex.grupo) === meuPico);
  if (irmaos.length && !outroNoMesmoPico && meuPico !== 'meio') {
    return `${acao}. É o único do dia que carrega ${comArtigo(grupo)} na posição ${meuPico === 'alongado' ? 'alongada' : 'encurtada'}.`;
  }

  if (!irmaos.length) {
    return `${acao}. Sozinho, responde ${contrair('por', grupo)} na sessão inteira.`;
  }

  return `${acao}. É ${unicoDe(rotulo)} do dia.`;
}
