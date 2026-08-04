import { padraoDe, perfilDeResistencia } from './classificacao';
import { REGIOES_DOR } from '@/features/perfil/diagnostico';

/**
 * O que sai do treino quando alguma coisa dói — e por quê.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────
 *
 * A contraindicação era uma lista de NOMES por região, e o critério que a
 * escreveu foi o implemento, não o padrão de movimento. Ler a lista não
 * denunciava nada; contar, sim:
 *
 * · **lombar** evitava `Stiff` e mantinha `Levantamento terra romeno` e
 *   `Bom dia com barra` — o mesmo hinge com barra, três nomes.
 * · **joelho** evitava `Afundo com barra` e mantinha `Afundo com halteres`,
 *   `Agachamento búlgaro` e `Afundo caminhando` — a mesma flexão profunda
 *   unilateral, com a carga em outro lugar da mão.
 * · **ombro** evitava a `Elevação lateral` — abdução neutra, 12-20
 *   repetições, RIR 2, o exercício mais benigno do grupo — e mantinha a
 *   `Remada alta`, que é abdução com rotação interna, e o `Mergulho`, que é
 *   ombro em extensão profunda com o peso do corpo.
 *
 * O último não é hipótese: em G2, tirar a elevação lateral abriu a vaga do
 * padrão de ombro e a remada alta entrou no lugar dela — como composto de
 * barra, com a prescrição pesada. Medido em 23 perfis com dor no ombro. A
 * correção de então foi acrescentar `Remada alta` à lista, que é o remendo;
 * esta é a correção.
 *
 * ── Como a regra passou a funcionar ──────────────────────────────────────
 *
 * O exercício não é comparado com uma lista: ele é descrito por CARGAS
 * MECÂNICAS (o que ele cobra de cada articulação), derivadas dos mesmos
 * atributos que o resto do projeto já usa — `padraoDe`, `perfilDeResistencia`
 * e o tipo de carga. Cada região dolorida declara quais cargas contraindica.
 * Exercício novo no catálogo entra na regra sozinho, sem ninguém lembrar de
 * atualizar cinco listas.
 *
 * ── O que a regra NÃO decide ─────────────────────────────────────────────
 *
 * Ela não sabe se dói. Dor persistente é assunto de fisioterapeuta e o app
 * diz isso na tela de diagnóstico. O que ela faz é não OFERECER o movimento
 * que a pessoa marcou como doloroso — no plano e, o que faltava, na troca
 * durante a sessão.
 *
 * Nenhuma fonte foi aberta nesta sessão: as associações abaixo (overhead e
 * abdução com rotação interna com dor subacromial, hinge carregado com dor
 * lombar, flexão profunda de joelho com dor femoropatelar) são **prática
 * comum, sem citação** — igual estava escrito na auditoria que pediu a
 * correção. O que muda aqui é a COERÊNCIA da aplicação, não a evidência.
 */

export type CargaMecanica =
  /** Empurrar acima da linha do olho, com o úmero em flexão/abdução alta. */
  | 'overhead'
  /** Abdução com rotação interna do ombro — a remada alta e o que se parecer com ela. */
  | 'abducao_rotacao_interna'
  /** Ombro em extensão profunda sustentando o peso do corpo (mergulho). */
  | 'ombro_extensao_profunda'
  /** Mão travada numa barra empurrando: embaixo o ombro não tem para onde ir. */
  | 'mao_travada_empurrando'
  /** Carga axial sobre a coluna, em pé. */
  | 'axial_em_pe'
  /** Flexão de quadril sob carga externa livre — o hinge com barra ou halter. */
  | 'hinge_carregado'
  /** Tronco inclinado sem apoio, segurando barra. */
  | 'tronco_inclinado_livre'
  /** Flexão profunda de joelho unilateral (afundo, búlgaro, subida). */
  | 'joelho_profundo_unilateral'
  /**
   * Agachamento em que a AMPLITUDE é ditada pelo implemento, não escolhida.
   *
   * Substitui `joelho_profundo_carregado`, que perguntava "tem carga?" — e
   * assim removia todo agachamento com peso, inclusive smith e goblet, e
   * deixava passar o agachamento SEM PESO, a 4 × 8-15 com RIR 0-2, para uma
   * pessoa de 88 kg em academia completa. Era o pior tipo de defeito: a
   * exceção do peso corporal deixava passar exatamente o inútil.
   */
  | 'joelho_amplitude_nao_escolhida'
  /** Punho em extensão sustentando o corpo (flexão de braço). */
  | 'punho_em_extensao'
  /** Punho travado numa barra reta, sem liberdade de pronação. */
  | 'punho_travado_em_barra'
  /** Cotovelo carregado na posição alongada (testa, francês, scott). */
  | 'cotovelo_alongado_carregado';

export interface ExercicioParaDor {
  nome: string;
  grupo_primario: string;
  equipamento?: string | null;
  tipo_carga?: string | null;
}

/**
 * O que este exercício cobra, mecanicamente.
 *
 * A dedução é por atributo, com o nome entrando só onde ele é a informação —
 * "mergulho" e "supino" são categorias de movimento no catálogo deste
 * repositório, escritas por nós, do mesmo jeito e pelo mesmo motivo que
 * `padraoDe` deduz padrão pelo nome ("grosseira de propósito").
 */
export function cargasDe(ex: ExercicioParaDor): CargaMecanica[] {
  const { nome, grupo_primario: grupo } = ex;
  const n = nome.toLowerCase();
  const padrao = padraoDe(nome, grupo);
  const perfil = perfilDeResistencia(nome, ex.equipamento);
  // `const ajustavel = cargaDe(ex.tipo_carga) === 'ajustavel'` SAIU daqui.
  //
  // Era o único uso de `cargaDe` neste arquivo e ele sustentava a pergunta
  // errada — "tem carga?" — na regra do joelho. Deixar a variável viva depois de
  // trocar o critério é como a próxima pessoa reintroduz o defeito: ela acha um
  // atributo pronto com nome plausível e o usa.
  const out = new Set<CargaMecanica>();

  // ── Ombro ────────────────────────────────────────────────────────────
  if (grupo === 'ombro' && padrao === 'desenvolvimento') out.add('overhead');
  // `padraoDe` responde 'alta' para remada alta tanto como ombro quanto como
  // trapézio. Perguntar pelo grupo do PRÓPRIO exercício é o que impede
  // `Encolhimento` de cair no balde de desenvolvimento (o default do ramo de
  // ombro), que seria o erro descrito em `padroesQueCobre`.
  if ((grupo === 'ombro' || grupo === 'trapezio') && padrao === 'alta')
    out.add('abducao_rotacao_interna');
  // Mergulho é mergulho em qualquer grupo: `Mergulho no paralelo` é peito e
  // `Mergulho entre bancos` é tríceps, e o ombro embaixo é o mesmo nos dois.
  if (/mergulho/.test(n)) out.add('ombro_extensao_profunda');
  // Empurrar horizontal/inclinado com a mão presa a uma barra. Halter, cabo e
  // máquina ficam de fora de propósito: neles a trajetória é escolhida pelo
  // ombro, que é justamente o que falta na barra.
  const empurraNaHorizontal =
    grupo === 'peito' ? padrao === 'horizontal' || padrao === 'inclinado' : /supino/.test(n);
  if (perfil === 'barra' && empurraNaHorizontal) out.add('mao_travada_empurrando');

  // ── Coluna ───────────────────────────────────────────────────────────
  if (perfil === 'barra' && /agachamento|afundo|subida|b[úu]lgaro/.test(n)) out.add('axial_em_pe');
  if (
    (perfil === 'barra' || perfil === 'halter') &&
    (padrao === 'quadril' || padrao === 'hinge' || padrao === 'lombar' || /terra|stiff|romeno|bom dia/.test(n))
  )
    out.add('hinge_carregado');
  if (perfil === 'barra' && grupo === 'costas' && padrao === 'horizontal')
    out.add('tronco_inclinado_livre');

  // ── Joelho ───────────────────────────────────────────────────────────
  if (padrao === 'unilateral' || padrao === 'unilateral_em_pe') out.add('joelho_profundo_unilateral');
  // ── O critério é CONTROLE DE AMPLITUDE, não presença de carga ──────────
  //
  // Este arquivo já sabia disso: é a razão escrita pela qual o leg press fica
  // ("o apoio do pé é escolhido, e é por isso que ele fica: dá para fugir da
  // amplitude que dói"). O atributo é que estava errado — ele perguntava
  // `ajustavel`, ou seja "tem carga?".
  //
  // O que sobra bloqueado é o agachamento em pé com a barra no tronco e sem
  // guia: ali a profundidade é comprometida pelo implemento (não dá para
  // abandonar a repetição no meio sem gaiola ou observador) e o joelho viaja
  // até onde a barra mandar. Smith (barra guiada, pés à frente, trava em
  // qualquer altura), goblet (peso à frente, dá para largar), halteres, prensa
  // e peso corporal ficam — em todos eles a pessoa escolhe onde parar.
  //
  // A revisão de 79 estudos sobre extensores do joelho na dor femoropatelar
  // classifica a evidência como INCERTA: ela não sustenta proibir carga.
  // Sustenta controlar amplitude, que é o que esta linha passou a fazer.
  // https://pmc.ncbi.nlm.nih.gov/articles/PMC12377044/
  const barraNoTronco = perfil === 'barra' && !/smith/i.test(nome);
  if (grupo === 'quadriceps' && padrao === 'agachamento' && barraNoTronco)
    out.add('joelho_amplitude_nao_escolhida');

  // ── Punho e cotovelo ─────────────────────────────────────────────────
  // Peso do corpo com a mão espalmada no chão. A nórdica também é "flexão" e
  // não carrega punho nenhum — o joelho é que segura.
  if (/flex[ãa]o/.test(n) && perfil === 'corporal' && !/n[óo]rdica/.test(n))
    out.add('punho_em_extensao');
  if (perfil === 'barra' && ['biceps', 'triceps', 'antebraco'].includes(grupo))
    out.add('punho_travado_em_barra');
  if ((grupo === 'triceps' && padrao === 'acima') || (grupo === 'biceps' && padrao === 'apoiada'))
    out.add('cotovelo_alongado_carregado');

  return [...out];
}

/**
 * O que cada região dolorida contraindica.
 *
 * ── A inversão que isto desfaz, no ombro ─────────────────────────────────
 *
 * Sai o que empurra acima da cabeça, o que abduz com rotação interna e o que
 * pendura o ombro em extensão. FICA a abdução neutra com carga leve — a
 * elevação lateral, 12-20 repetições e RIR 2 pela tabela de papel. A regra
 * antiga fazia exatamente o contrário nos dois lados.
 */
export const CARGAS_POR_DOR: Record<string, CargaMecanica[]> = {
  ombro: ['overhead', 'abducao_rotacao_interna', 'ombro_extensao_profunda', 'mao_travada_empurrando'],
  lombar: ['axial_em_pe', 'hinge_carregado', 'tronco_inclinado_livre'],
  joelho: ['joelho_profundo_unilateral', 'joelho_amplitude_nao_escolhida'],
  punho: ['punho_em_extensao', 'punho_travado_em_barra'],
  // Mergulho entra duas vezes, e não é engano: ele é ombro em extensão E
  // extensão de cotovelo com o corpo inteiro pendurado no tríceps.
  cotovelo: ['cotovelo_alongado_carregado', 'ombro_extensao_profunda'],
};

/**
 * Reforços nominais — o que a regra ainda não sabe derivar, com o motivo.
 *
 * ── Por que existe uma lista de nomes num arquivo que existe para matar
 *    listas de nomes ──────────────────────────────────────────────────────
 *
 * Porque a alternativa era pior. `Hack machine` e `Leg press` são o mesmo
 * padrão (`prensa`), o mesmo equipamento e a mesma estabilização: nenhum
 * atributo do projeto os distingue hoje. Derivar a regra e deixar os dois
 * passarem DESBLOQUEARIA o hack para quem tem dor no joelho — um exercício
 * que a versão em produção já protege. Trocar uma incoerência por uma
 * regressão de segurança não é correção.
 *
 * A diferença entre os dois é o que o reforço escreve: no hack o encosto
 * trava o quadril e o joelho viaja à frente na descida; no leg press o apoio
 * do pé é escolhido e a mesma pessoa consegue fugir da amplitude que dói.
 * Quando o catálogo tiver o atributo (amplitude de joelho, ou posição do pé),
 * esta entrada some — e o invariante do harness cobra o motivo por escrito
 * justamente para que ninguém acrescente nome aqui sem essa conta.
 */
export const REFORCOS: Record<string, Record<string, string>> = {
  joelho: {
    'Hack machine':
      'O encosto trava o quadril e o joelho viaja à frente na descida. No leg press o apoio do ' +
      'pé é escolhido, e é por isso que ele fica: dá para fugir da amplitude que dói.',
  },
};

/** Texto curto do porquê, para a tela poder explicar a recusa. */
const COMO_SE_FALA: Record<CargaMecanica, string> = {
  overhead: 'empurra acima da cabeça',
  abducao_rotacao_interna: 'abre o braço com o ombro girado para dentro',
  ombro_extensao_profunda: 'joga o ombro para trás sustentando o corpo',
  mao_travada_empurrando: 'prende a mão na barra e o ombro não tem para onde escapar',
  axial_em_pe: 'põe carga em cima da coluna, em pé',
  hinge_carregado: 'dobra o quadril com peso livre na mão',
  tronco_inclinado_livre: 'sustenta o tronco inclinado com a barra na mão',
  joelho_profundo_unilateral: 'dobra muito um joelho de cada vez',
  joelho_amplitude_nao_escolhida: 'agacha com a barra nas costas, onde a profundidade não é sua escolha',
  punho_em_extensao: 'apoia o corpo no punho dobrado para trás',
  punho_travado_em_barra: 'trava o punho numa barra reta',
  cotovelo_alongado_carregado: 'carrega o cotovelo na posição mais alongada',
};

const LABEL_REGIAO: Record<string, string> = Object.fromEntries(
  REGIOES_DOR.map((r) => [r.chave, r.label.toLowerCase()])
);

export interface BloqueioPorDor {
  regiao: string;
  /** `null` quando o bloqueio veio de reforço nominal, não de carga derivada. */
  carga: CargaMecanica | null;
  motivo: string;
}

/**
 * Este exercício está contraindicado para alguma das dores marcadas?
 *
 * Devolve o PRIMEIRO bloqueio encontrado, com o motivo escrito — a tela
 * precisa poder dizer por que a opção sumiu. Recusa sem explicação é como o
 * app perde a confiança de quem está com pressa no meio do treino.
 */
export function bloqueadoPorDor(ex: ExercicioParaDor, dores: string[]): BloqueioPorDor | null {
  if (!dores?.length) return null;
  const cargas = new Set(cargasDe(ex));
  for (const regiao of dores) {
    const reforco = REFORCOS[regiao]?.[ex.nome];
    if (reforco) return { regiao, carga: null, motivo: reforco };
    const achou = (CARGAS_POR_DOR[regiao] ?? []).find((c) => cargas.has(c));
    if (achou)
      return {
        regiao,
        carga: achou,
        motivo: `Você marcou dor no ${LABEL_REGIAO[regiao] ?? regiao}, e este ${COMO_SE_FALA[achou]}.`,
      };
  }
  return null;
}

/**
 * Os nomes que saem do catálogo por causa de dor.
 *
 * O gerador filtra por nome porque é assim que ele já filtra local e força
 * relativa; a regra continua sendo a função acima, aplicada ao catálogo
 * inteiro uma vez por plano.
 */
export function evitarPorDor(dores: string[], catalogo: ExercicioParaDor[]): Set<string> {
  const fora = new Set<string>();
  if (!dores?.length) return fora;
  for (const e of catalogo) if (bloqueadoPorDor(e, dores)) fora.add(e.nome);
  return fora;
}

/**
 * A região de dor que este exercício sugere — quando ele já foi trocado por
 * dor mais de uma vez.
 *
 * ── O que isto liga ──────────────────────────────────────────────────────
 *
 * `MOTIVOS_TROCA` tem "Senti dor ou desconforto" desde sempre, o app grava em
 * `substituicoes.motivo` e nenhuma linha do repositório lia essa coluna. A
 * pessoa avisava o app duas, três vezes, e o plano da semana seguinte vinha
 * igual — com o mesmo exercício na mesma posição.
 *
 * Uma vez só não sugere nada de propósito: aparelho errado, dia ruim e
 * aquecimento curto também produzem uma troca por dor, e transformar isso em
 * "você tem dor no ombro" é o app concluindo demais a partir de um toque.
 */
const REGIAO_PROVAVEL: Record<string, string[]> = {
  ombro: ['ombro'],
  peito: ['ombro', 'punho'],
  costas: ['lombar', 'ombro'],
  triceps: ['cotovelo', 'ombro', 'punho'],
  biceps: ['cotovelo', 'punho'],
  antebraco: ['punho', 'cotovelo'],
  quadriceps: ['joelho', 'lombar'],
  posterior: ['lombar', 'joelho'],
  gluteo: ['lombar', 'joelho'],
  trapezio: ['ombro'],
  // Panturrilha, abdômen e cardio não têm região plausível única. Devolver
  // `null` é a resposta certa: melhor não sugerir que sugerir errado.
  panturrilha: [],
  abdomen: [],
  cardio: [],
};

export function regiaoSugeridaPara(
  ex: ExercicioParaDor | null | undefined,
  vezes: number,
  doresAtuais: string[]
): string | null {
  if (!ex || vezes < 2) return null;
  const jaTem = new Set(doresAtuais ?? []);
  const candidatas = (REGIAO_PROVAVEL[ex.grupo_primario] ?? []).filter((r) => !jaTem.has(r));
  if (!candidatas.length) return null;
  // Primeiro, a região que de fato contraindicaria este exercício: se a regra
  // já sabe que aquele movimento cobra do ombro, a sugestão não é palpite.
  const bloqueia = candidatas.find((r) => !!bloqueadoPorDor(ex, [r]));
  // Sem bloqueio, a região mais provável do grupo. Dói no leg press e o leg
  // press não é contraindicado para joelho nenhum — o joelho continua sendo a
  // pergunta certa a fazer.
  return bloqueia ?? candidatas[0];
}
