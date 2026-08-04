import { ehComposto, padraoDe, perfilDeResistencia } from './classificacao';

/**
 * O PAPEL de cada exercício na sessão — e tudo que sai dele.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────
 *
 * A auditoria da saída (A5, A6) achou o mesmo defeito em dois lugares: faixa de
 * repetição e descanso saíam de perguntas que não decidem nem uma coisa nem
 * outra. As repetições saíam da EXPERIÊNCIA — `experiencia === 'iniciante'`
 * apagava a zona 5-8 do programa inteiro — e o descanso saía das repetições, o
 * que tornava o degrau de 180 s literalmente inalcançável para quem marcou
 * iniciante (`rmax = 12 > 8` em todo composto pesado).
 *
 * O que decide as duas coisas é a função do exercício DENTRO da sessão. Um
 * supino que abre o treino e cuja carga alimenta o gráfico não é o mesmo
 * exercício que o mesmo supino feito em nono lugar; e uma elevação lateral não
 * vira pesada porque quem a faz treina há dez anos.
 *
 * ── Papel é derivado, nunca digitado (B3) ────────────────────────────────
 *
 * Uma lista nominal de "principais" seria mais rápida de escrever e estaria
 * errada no dia seguinte: o mesmo exercício muda de papel conforme o que mais
 * está na sessão. Então o papel sai de três atributos:
 *
 * | Atributo               | Valores                                          |
 * |------------------------|--------------------------------------------------|
 * | `articulacoes`         | multi / mono                                     |
 * | `demanda_estabilizacao`| alta (barra livre, peso corporal) / média (halter,|
 * |                        | smith) / baixa (máquina, cabo)                   |
 * | `pico_de_tensao`       | alongado / meio / encurtado                      |
 *
 * ── O que este arquivo NÃO faz ───────────────────────────────────────────
 *
 * Não escolhe exercício e não conta série. Recebe a sessão pronta e responde
 * "qual o papel de cada um" e "o que prescrever para esse papel". Quem monta a
 * sessão é o gerador; quem decide se ela cabe no tempo é `duracao.ts`.
 */

export type Papel = 'principal' | 'complementar' | 'isolador' | 'finalizador';
export const PAPEIS: Papel[] = ['principal', 'complementar', 'isolador', 'finalizador'];

/**
 * O quarto atributo, que B3 não tinha: a carga é ESCOLHÍVEL?
 *
 * ── A regressão que ele conserta ─────────────────────────────────────────
 *
 * B3 tem três atributos e nenhum deles distingue "supino com barra" de "flexão
 * de braço". Os dois são multiarticulares, os dois exigem estabilização alta —
 * então a flexão herdava `principal_alta` e saía **4 × 5-8, RIR 2-3, 180 s**.
 * Numa casa sem equipamento isso foi 40,6% das prescrições de peso corporal.
 *
 * O número é uma prescrição impossível: quem faz 22 agachamentos sem peso e
 * para em 8 está com RIR ≈ 14 — série sem estímulo nenhum — e o app ainda cobra
 * três minutos de descanso depois dela. Pré-G2 esses exercícios saíam 8-12 e
 * 150 s; a regra do papel os piorou, o que é regressão e não refinamento.
 *
 * O que decide a faixa de repetição não é quanto o movimento pede de
 * equilíbrio: é se dá para ESCOLHER a carga que põe a falha onde a faixa quer.
 * Sem carga ajustável, quem escolhe a zona é o peso do corpo.
 */
export type Carga = 'ajustavel' | 'fixa';

export function cargaDe(tipoCarga?: string | null): Carga {
  return tipoCarga === 'peso_reps' ? 'ajustavel' : 'fixa';
}

/**
 * Exercícios em que o esforço é EXCÊNTRICO puro — e por isso RIR não existe.
 *
 * Na nórdica a fase concêntrica é assistida (ou não existe): "quantas
 * repetições sobraram" não é uma pergunta respondível, e imprimir "RIR 0-2" ali
 * é inventar prescrição para caber num campo. A umbrella review do NHE
 * (PMC11311354) descreve o protocolo modal em 2-3 séries de 6-12 repetições —
 * faixa própria, longe tanto do principal quanto do isolador.
 */
const EXCENTRICOS = new Set(['Flexão nórdica', 'Barra fixa negativa']);
export type Articulacoes = 'multi' | 'mono';
export type Estabilizacao = 'alta' | 'media' | 'baixa';
export type PicoDeTensao = 'alongado' | 'meio' | 'encurtado';

/**
 * Exercícios que movem UMA articulação e mesmo assim cobram o corpo inteiro.
 *
 * ── Por que eles não simplesmente saíram de `COMPOSTOS` ──────────────────
 *
 * Hip thrust, elevação pélvica, ponte, pull through e flexão nórdica movem só o
 * quadril (ou só o joelho) e estavam listados como compostos — o achado 16 da
 * rodada de G1. Tirá-los da lista seria a correção óbvia e produziria um erro
 * maior: `COMPOSTOS` decide ORDEM e demanda sistêmica, e um hip thrust com
 * barra pesada não pode ser feito no fim da sessão porque a definição de
 * articulação diz que ele é simples. Num dia de glúteo ele viraria acessório e
 * o agachamento ajoelhado assumiria a âncora do grupo.
 *
 * Então `COMPOSTOS` continua sendo o que sempre foi de fato — **demanda
 * sistêmica**, quem abre a sessão — e `articulacoes` vira o atributo explícito
 * que B3 pede. Cada um responde a pergunta que sabe responder, e nenhum dos
 * dois finge ser o outro. O que muda de verdade para estes cinco é o que o
 * achado 16 pedia: eles deixam de ser "complementares" (que exige multi) e o
 * descanso deles passa a sair do papel, não da lista.
 */
const UNIARTICULARES = new Set([
  'Hip thrust com barra',
  'Elevação pélvica com barra',
  'Elevação pélvica unilateral',
  'Ponte de glúteo',
  'Pull through na polia',
  'Flexão nórdica',
]);

export function articulacoesDe(nome: string): Articulacoes {
  if (UNIARTICULARES.has(nome)) return 'mono';
  return ehComposto(nome) ? 'multi' : 'mono';
}

/**
 * Quanto o exercício cobra de estabilização — o que decide carga e descanso.
 *
 * Sai do equipamento, que é o dado do catálogo, e não do nome: a mesma "remada"
 * é outra coisa na barra, no cabo e na máquina. O nome só entra para o smith,
 * que o catálogo etiqueta como máquina e que na prática é peso livre num
 * trilho — carga alta, estabilização média.
 */
export function estabilizacaoDe(nome: string, equipamento?: string | null): Estabilizacao {
  if (/smith/i.test(nome)) return 'media';
  const perfil = perfilDeResistencia(nome, equipamento);
  if (perfil === 'barra' || perfil === 'corporal') return 'alta';
  if (perfil === 'halter') return 'media';
  return 'baixa';
}

/**
 * Onde, na amplitude, o músculo recebe mais carga.
 *
 * Só é usado para ESCOLHER — nunca para prescrever série. O consumidor é o piso
 * de A7: "peito e tríceps" precisa de uma extensão de cotovelo com a cabeça
 * longa alongada, e não de mais um movimento com o ombro em extensão. A
 * dedução é por padrão de movimento, não por exercício, porque é o padrão que
 * determina o comprimento em que a carga aparece.
 */
const PICO_POR_PADRAO: Record<string, PicoDeTensao> = {
  // Cotovelo acima da cabeça alonga a cabeça longa do tríceps; a polia neutra
  // trabalha no meio e o coice, encurtado.
  'triceps:acima': 'alongado',
  'triceps:polia': 'meio',
  'triceps:coice': 'encurtado',
  'triceps:composto': 'meio',
  'biceps:alongada': 'alongado',
  'biceps:apoiada': 'encurtado',
  'biceps:livre': 'meio',
  'biceps:pegada': 'meio',
  'peito:abertura': 'alongado',
  'peito:inclinado': 'alongado',
  'peito:mergulho': 'alongado',
  'peito:horizontal': 'meio',
  'ombro:lateral': 'encurtado',
  'ombro:posterior': 'encurtado',
  'ombro:desenvolvimento': 'meio',
  'ombro:frontal': 'meio',
  'costas:vertical': 'alongado',
  'costas:extensao_ombro': 'alongado',
  'costas:horizontal': 'meio',
  'posterior:quadril': 'alongado',
  'posterior:joelho_sentado': 'alongado',
  'posterior:joelho_excentrico': 'alongado',
  'posterior:joelho_deitado': 'meio',
  'quadriceps:agachamento': 'alongado',
  'quadriceps:prensa': 'alongado',
  'quadriceps:unilateral': 'alongado',
  'quadriceps:extensao_joelho': 'encurtado',
  'gluteo:hinge': 'alongado',
  'gluteo:unilateral_em_pe': 'alongado',
  'gluteo:ponte': 'encurtado',
  'gluteo:extensao_unilateral': 'encurtado',
  'gluteo:abducao': 'encurtado',
  'panturrilha:joelho_fletido': 'alongado',
};

export function picoDeTensao(nome: string, grupo: string): PicoDeTensao {
  return PICO_POR_PADRAO[`${grupo}:${padraoDe(nome, grupo)}`] ?? 'meio';
}

// ── Papel na sessão ───────────────────────────────────────────────────────

interface ItemDaSessao {
  nome: string;
  grupo: string;
  equipamento?: string | null;
  /** `peso_reps`, `peso_corporal`… Sem carga ajustável não existe principal. */
  tipoCarga?: string | null;
}

/**
 * O papel de cada exercício de uma sessão já montada e já ordenada.
 *
 * ── As regras duras de B3, e onde cada uma mora ──────────────────────────
 *
 * · **Exatamente 1 principal por grupo por sessão.** É o PRIMEIRO do bloco do
 *   grupo, e isso não é atalho: a ordem por papel já pôs ali quem tem a maior
 *   demanda sistêmica, e o gerador já trata o primeiro do grupo como âncora
 *   ("é comparando a carga dele que se enxerga progresso"). Definir o principal
 *   por outro critério criaria uma segunda definição de âncora, e duas
 *   definições da mesma coisa é como o app passa a mentir para si mesmo.
 * · **Complementar exige multi E padrão diferente do principal.** Um segundo
 *   multiarticular no mesmo padrão não acrescenta — é o supino de máquina
 *   seguido do supino de smith que a auditoria achou. Quando aparece assim
 *   mesmo, ele é tratado como complementar e não como isolador: prescrever
 *   10-15 repetições para um supino seria pior que o problema.
 * · **Máximo 1 finalizador por sessão**, mono + estabilização baixa, e só na
 *   ÚLTIMA posição. Refalo 2023: quando a falha for usada, que seja em
 *   exercício de baixa complexidade e baixa fadiga associada.
 */
export function papeisDaSessao<T extends ItemDaSessao>(exs: T[]): Map<T, Papel> {
  const out = new Map<T, Papel>();
  const forca = exs.filter((e) => e.grupo !== 'cardio');

  const ancoraDoGrupo = new Map<string, T>();
  for (const e of forca) if (!ancoraDoGrupo.has(e.grupo)) ancoraDoGrupo.set(e.grupo, e);

  for (const e of forca) {
    // ── Abrir o bloco não faz de ninguém "principal" ────────────────────
    //
    // Ser o primeiro do grupo é POSIÇÃO — é `ehAncora`, e é o que alimenta o
    // gráfico. `papel` é PRESCRIÇÃO. Enquanto as duas ideias moravam na mesma
    // palavra, 3.450 de 11.579 exercícios saíam rotulados "Principal" sendo
    // monoarticulares, e o executor imprimia "faça descansado, com técnica
    // limpa, é a carga que o app compara" ao lado de um tríceps testa de
    // 2 × 10-15. Em sessão de corpo todo, os SEIS exercícios eram "Principal".
    //
    // Nenhuma série muda com esta separação: `prescricaoDe` já cortava por
    // articulação e carga. O que muda é o que o usuário lê.
    const ehAncora = e === ancoraDoGrupo.get(e.grupo);
    const multi = articulacoesDe(e.nome) === 'multi';
    // Carga fixa também não é principal: numa casa sem equipamento a barra
    // fixa abre o bloco de costas e continua sendo o que é — um exercício em
    // que a zona não é escolhível. Ela é ÂNCORA, não principal.
    const ajustavel = e.tipoCarga === undefined || cargaDe(e.tipoCarga) === 'ajustavel';
    if (ehAncora && multi && ajustavel) {
      out.set(e, 'principal');
      continue;
    }
    if (multi) {
      out.set(e, 'complementar');
      continue;
    }
    out.set(e, 'isolador');
  }

  // Finalizador: só o último da sessão, e só se ele for mono de estabilização
  // baixa. Um isolador de halter no fim continua isolador — o que caracteriza o
  // finalizador é poder ir perto da falha sem custo de coordenação.
  const ultimo = forca[forca.length - 1];
  if (
    ultimo &&
    out.get(ultimo) === 'isolador' &&
    estabilizacaoDe(ultimo.nome, ultimo.equipamento) === 'baixa'
  ) {
    out.set(ultimo, 'finalizador');
  }

  return out;
}

/**
 * O papel de cada linha de uma rotina — **uma definição só, para todas as telas**.
 *
 * ── O buraco que isto fecha ──────────────────────────────────────────────
 *
 * A tela do dia deduzia o papel com `papeisDaSessao` e o executor deduzia com
 * `eh_composto ? 'principal' : 'isolador'`. Numa rotina anterior à v16 (papel
 * NULL) o mesmo supino inclinado saía **"Complementar · RIR 1-2" no plano e
 * "Principal · RIR 2-3" no executor** — o executor mandava treinar uma
 * repetição mais longe da falha do que o plano prescrevia, na mesma linha do
 * mesmo treino. Duas definições da mesma coisa é como o app começa a mentir
 * para si mesmo, e foi assim que o crossover virou composto numa função e
 * abertura em outra.
 *
 * Devolve mapa por **id da linha da rotina**, não por posição: `addExercicioNoDia`
 * insere com `MAX(ordem)+1`, ou seja DEPOIS do cardio, e qualquer indexação
 * posicional passaria a dar o papel errado a partir do primeiro exercício
 * acrescentado à mão.
 */
export interface PapelDaLinha {
  papel: Papel;
  /** Abre o bloco do grupo na sessão. Pergunta de posição, não de prescrição. */
  ancora: boolean;
}

export function papeisDaRotina<
  T extends {
    id: number;
    nome: string;
    grupo: string;
    equipamento?: string | null;
    papel?: string | null;
  },
>(exs: T[]): Map<number, PapelDaLinha> {
  const derivados = papeisDaSessao(exs);
  const ancoras = ancorasDaSessao(exs);
  const out = new Map<number, PapelDaLinha>();
  for (const e of exs) {
    if (e.grupo === 'cardio') continue;
    const gravado = PAPEIS.includes(e.papel as Papel) ? (e.papel as Papel) : null;
    out.set(e.id, {
      papel: gravado ?? derivados.get(e) ?? 'isolador',
      ancora: ancoras.has(e),
    });
  }
  return out;
}

/**
 * A prescrição derivada de um DIA inteiro — **cache invalidável, não verdade eterna**.
 *
 * ── O que isto conserta ──────────────────────────────────────────────────
 *
 * `preencherPapeis` passou a gravar `papel`/RIR em rotina antiga, e
 * `papeisDaRotina` prefere sempre o gravado. Sem esta função, o papel virava
 * o RETRATO da ordem do dia no instante do backfill — e a rotina pré-v16, que
 * antes se autocorrigia a cada render, passou a carregar um papel congelado.
 * Três consequências medidas pelo cross-review, todas na população que o
 * backfill existe para atender (rotina de ordem manual):
 *
 * · Remover a âncora do grupo deixava o grupo **sem principal para sempre** —
 *   o segundo supino continuava "complementar" sendo agora o primeiro.
 * · "Reordenar pela ciência" prendia papel, RIR e descanso na ordem ANTIGA:
 *   o supino reto voltava para a posição 1 ainda como complementar, RIR 1-2 e
 *   150 s, quando a nova ordem pede principal, RIR 2-3 e 180 s.
 * · Acrescentar exercício produzia **dois finalizadores gravados**, violando a
 *   regra dura escrita em `papeisDaSessao` ("máximo 1 por sessão, e só na
 *   última posição").
 *
 * ── Por que persistir e recalcular, em vez de voltar a derivar em runtime ──
 *
 * As duas saídas fechavam o buraco. A escolhida é esta porque o motivo do
 * backfill é o descanso: `corrigirDescansos` precisa do papel GRAVADO para
 * saber que aquele supino quer 180 s, e sem coluna ele volta ao fallback que
 * trata todo multiarticular como principal — o defeito que G2.1 existia para
 * matar. Então o gravado fica, e passa a ser o que sempre deveria ter sido:
 * um cache, invalidado por quem muda a composição do dia.
 *
 * Deriva do zero, ignorando o que está gravado: recalcular é isso. Quem quer a
 * leitura tolerante (gravado > derivado) continua usando `papeisDaRotina`.
 */
export interface LinhaPrescrita {
  papel: Papel;
  reps: [number, number];
  rir: [number, number] | null;
  descansoSeg: number;
}

export function prescricaoDaRotina<
  T extends {
    id: number;
    nome: string;
    grupo: string;
    equipamento?: string | null;
    tipoCarga?: string | null;
  },
>(exs: T[]): Map<number, LinhaPrescrita> {
  const papeis = papeisDaSessao(exs);
  const out = new Map<number, LinhaPrescrita>();
  for (const e of exs) {
    if (e.grupo === 'cardio') continue;
    const papel = papeis.get(e) ?? 'isolador';
    const pres = prescricaoDe(papel, e.nome, e.grupo, e.equipamento, e.tipoCarga);
    out.set(e.id, {
      papel,
      reps: pres.reps,
      // Série por TEMPO não tem repetição em reserva para contar — é o mesmo
      // corte que `aplicarPrescricao` faz no gerador.
      rir: e.tipoCarga === 'tempo' ? null : pres.rir,
      descansoSeg: descansoCorreto(e.nome, pres.reps[1], e.grupo, papel, e.equipamento, e.tipoCarga),
    });
  }
  return out;
}

// ── O que cada papel prescreve (B5 e B6) ──────────────────────────────────

export interface Prescricao {
  reps: [number, number];
  /**
   * RIR do bloco de acúmulo. `null` onde a pergunta não existe: no excêntrico
   * puro não há repetição "que sobrou" para contar.
   */
  rir: [number, number] | null;
  /** RIR das semanas 1-3 de readaptação. `null` = não usar o exercício ali. */
  rirReadaptacao: [number, number] | null;
  descansoSeg: number;
}

/**
 * Repetições, RIR e descanso por papel.
 *
 * ── Por que por papel e não por experiência (A6) ─────────────────────────
 *
 * Schoenfeld 2017 (21 estudos): hipertrofia semelhante numa faixa larga de
 * cargas, mas 1RM sobe mais com carga alta. Logo carga alta é o que o
 * PRINCIPAL existe para entregar, e o isolador pode ser leve sem custo de
 * hipertrofia. Nada disso muda porque a pessoa treina há seis meses ou seis
 * anos — o que a experiência decide é VOLUME semanal, e é lá que ela ficou.
 *
 * ── Por que o RIR também é por papel ─────────────────────────────────────
 *
 * Robinson 2024: hipertrofia melhora conforme as séries se aproximam da falha;
 * FORÇA é praticamente indiferente ao RIR (intervalo de credibilidade contendo
 * o nulo em todos os modelos de força). A consequência prática não é intuitiva:
 * manter RIR 2-3 no principal custa quase nada em força e economiza fadiga,
 * enquanto apertar o RIR no isolador é onde o ganho de tamanho está.
 * Refalo 2023: falha momentânea NÃO é superior à não-falha — por isso são
 * faixas, não pontos.
 *
 * ── Por que o descanso vem daqui e não das repetições (A5) ───────────────
 *
 * `descansoCorreto` consultava as repetições antes do papel, e como iniciante
 * recebia 8-12 em tudo, o ramo dos 180 s não era alcançável em NENHUM perfil
 * marcado como iniciante. Papel primeiro; repetição só desempata dentro do
 * isolador. Schoenfeld 2016 (RCT, n=21, 8 semanas): 3 min produziram mais força
 * e mais hipertrofia que 1 min.
 */
const PRESCRICAO: Record<string, Prescricao> = {
  // Carga FIXA: a zona não é escolhível, então a faixa acompanha o que o corpo
  // permite e o descanso acompanha a demanda, não a zona. Nunca 5-8: pedir
  // repetição baixa em exercício de carga fixa é pedir série que não acontece.
  corporal_multi: { reps: [8, 15], rir: [0, 2], rirReadaptacao: [2, 3], descansoSeg: 120 },
  corporal_mono: { reps: [10, 20], rir: [0, 2], rirReadaptacao: [2, 2], descansoSeg: 90 },
  // Excêntrico puro: faixa própria e RIR ausente de propósito (`null`), não
  // esquecido. O schema já aceita RIR nulo — é o mesmo caminho da prancha.
  excentrico: { reps: [5, 10], rir: null, rirReadaptacao: null, descansoSeg: 120 },
  // Principal de barra livre / peso corporal: é o exercício cuja carga alimenta
  // o gráfico, e é o único lugar do programa onde a zona pesada faz diferença.
  principal_alta: { reps: [5, 8], rir: [2, 3], rirReadaptacao: [3, 4], descansoSeg: 180 },
  principal_media: { reps: [6, 10], rir: [1, 2], rirReadaptacao: [3, 3], descansoSeg: 150 },
  complementar: { reps: [8, 12], rir: [1, 2], rirReadaptacao: [2, 3], descansoSeg: 150 },
  isolador: { reps: [10, 15], rir: [0, 2], rirReadaptacao: [2, 2], descansoSeg: 90 },
  finalizador: { reps: [12, 20], rir: [0, 1], rirReadaptacao: null, descansoSeg: 60 },
};

/**
 * Grupos em que a faixa não sai do papel — e por quê.
 *
 * Panturrilha e abdômen são o caso em que o papel diria "principal" (são o
 * único exercício do grupo na sessão) e a prescrição de principal estaria
 * errada: 5-8 repetições de panturrilha em pé não é treino pesado, é tendão de
 * Aquiles com carga que ninguém consegue estabilizar. Aqui a faixa é do GRUPO,
 * e isso é exceção declarada, não esquecimento.
 */
const POR_GRUPO: Record<string, Prescricao> = {
  panturrilha: { reps: [12, 20], rir: [0, 2], rirReadaptacao: [2, 2], descansoSeg: 60 },
  abdomen: { reps: [12, 20], rir: [0, 2], rirReadaptacao: [2, 2], descansoSeg: 60 },
};

/**
 * O que prescrever — e a ORDEM dos cortes, que é onde estava o defeito.
 *
 * A versão anterior cortava por contagem de articulações antes de olhar carga
 * ou estabilização, e por isso tratava hip thrust com barra (o exercício de
 * maior carga absoluta do glúteo) igual a cadeira abdutora: 10-15, RIR 0-2,
 * 90 s e zero aproximação. Contar articulações responde "é complementar?";
 * quem responde "quanto peso isso carrega?" é carga + estabilização.
 */
export function prescricaoDe(
  papel: Papel,
  nome: string,
  grupo: string,
  equipamento?: string | null,
  tipoCarga?: string | null
): Prescricao {
  if (EXCENTRICOS.has(nome)) return PRESCRICAO.excentrico;

  const doGrupo = POR_GRUPO[grupo];
  if (doGrupo) return doGrupo;

  // 1. Carga fixa nunca entra na zona pesada, seja qual for o papel.
  if (cargaDe(tipoCarga) === 'fixa') {
    return PRESCRICAO[articulacoesDe(nome) === 'multi' ? 'corporal_multi' : 'corporal_mono'];
  }

  if (papel !== 'principal') return PRESCRICAO[papel];

  const estab = estabilizacaoDe(nome, equipamento);
  const mono = articulacoesDe(nome) === 'mono';

  // 2. Principal monoarticular de GRUPO PEQUENO é isolador na prescrição: no
  //    dia de empurrar o ombro entra por abdução e o tríceps por extensão de
  //    cotovelo, e 6-10 repetições numa elevação lateral é prescrição de supino
  //    aplicada a um exercício que não a suporta.
  // 3. Mas grupo GRANDE com carga externa e estabilização média/alta é outra
  //    coisa: hip thrust, elevação pélvica com barra e stiff carregam mais que
  //    muito multiarticular, e a única razão de eles caírem em "isolador" era a
  //    contagem de articulações ter vindo antes da carga.
  if (mono && (PEQUENOS_PARA_PAPEL.has(grupo) || estab === 'baixa')) return PRESCRICAO.isolador;

  return PRESCRICAO[estab === 'alta' && !mono ? 'principal_alta' : 'principal_media'];
}

/** Grupos em que monoarticular é sempre acessório, por carga absoluta baixa. */
const PEQUENOS_PARA_PAPEL = new Set(['biceps', 'triceps', 'ombro', 'trapezio', 'antebraco']);

/**
 * Descanso correto, em segundos — **papel primeiro, repetição só desempata**.
 *
 * Chamado de dois lugares com necessidades diferentes: o gerador já sabe o
 * papel e passa; a normalização de rotina antiga e a troca de exercício em
 * sessão não sabem, e aí o papel é deduzido do próprio exercício, como se ele
 * fosse o principal do grupo dele. É a suposição certa para quem chega sem
 * contexto: errar para mais descanso num acessório custa minutos, errar para
 * menos num composto pesado custa carga e repetição nas séries seguintes.
 */
export function descansoCorreto(
  nome: string,
  repsAlvo = 10,
  grupo?: string,
  papel?: Papel,
  equipamento?: string | null,
  tipoCarga?: string | null
): number {
  if (grupo === 'cardio') return 0;

  const efetivo: Papel = papel ?? (articulacoesDe(nome) === 'multi' ? 'principal' : 'isolador');
  const base = prescricaoDe(efetivo, nome, grupo ?? '', equipamento, tipoCarga).descansoSeg;

  // O desempate por repetição vive DENTRO do isolador e em nenhum outro lugar.
  // O corte é acima de 15, não a partir de 15: a faixa canônica do isolador
  // termina em 15, e usar `>=` apagaria o degrau de 90 s do programa inteiro —
  // exatamente o tipo de tier inalcançável que A5 achou nos 180 s.
  if ((efetivo === 'isolador' || efetivo === 'finalizador') && repsAlvo > 15) return 60;
  return base;
}

// `descansoLegado` foi APAGADA daqui.
//
// Ela guardava a regra pré-G2 (descanso saindo de "é composto?" + repetições) e
// existia por um motivo legítimo: rotina anterior à v16 não tinha `papel`, e sem
// papel a regra nova trata todo multiarticular como principal — falso a partir
// do segundo exercício do grupo. Aplicar a regra nova assim daria descanso
// ERRADO, não só diferente.
//
// O que mudou é que a rotina antiga passou a TER papel: `preencherPapeis`, em
// `db/normalizar.ts`, deriva o papel pelo contexto do dia (a mesma
// `papeisDaRotina` que as telas usam) antes de o descanso ser recalculado. Com
// o dado presente, o fallback não tem mais o que resolver — e regra velha viva
// ao lado da nova não é neutra: é a que a próxima pessoa acha primeiro. Foi
// assim que `descansoSugerido` sobreviveu até A5.
//
// Decisão do Leonardo, 03/08: "não tem problema reescrever o plano do meu
// iPhone se for para melhorar".

/** Explicação curta do descanso, para a tela de execução. */
export function porqueDescanso(nome: string, segundos: number): string {
  if (segundos >= 180)
    return 'Principal de peso livre. Três minutos preservam carga e repetições nas próximas séries — é onde o programa mede progresso.';
  if (segundos >= 150)
    return 'Exercício pesado com apoio. Dois minutos e meio mantêm o desempenho ao longo das séries.';
  if (segundos >= 90) return 'Isolador. Um minuto e meio já recupera o suficiente.';
  return 'Série longa de isolador — a recuperação local é rápida.';
}

/**
 * O RIR que vale na fase em curso.
 *
 * O plano guarda o RIR de acúmulo, que é o estado normal do bloco. Nas semanas
 * de readaptação e no deload o alvo afrouxa — e o finalizador simplesmente não
 * é usado ali (B7: zero técnicas e zero proximidade de falha na volta).
 *
 * Docking & Cook 2019: o turnover de colágeno em tendão maduro é da ordem de
 * 0,25% ao ano e o tecido responde a um limiar de tração — ele não acompanha a
 * velocidade com que o músculo recupera carga depois de uma pausa. É essa
 * defasagem, e não a fadiga muscular, que justifica o RIR mais alto na volta.
 */
export function rirNaFase(
  papel: Papel,
  nome: string,
  grupo: string,
  equipamento: string | null | undefined,
  fase: 'readaptacao' | 'acumulo' | 'intensificacao' | 'deload' | null,
  tipoCarga?: string | null
): [number, number] | null {
  const p = prescricaoDe(papel, nome, grupo, equipamento, tipoCarga);
  // Sem RIR na prescrição (excêntrico puro), não existe RIR em fase nenhuma.
  if (!p.rir) return null;
  if (fase !== 'readaptacao' && fase !== 'deload') return p.rir;
  // Sem faixa de readaptação (finalizador), o exercício vira isolador comum na
  // volta: mesma série, longe da falha, em vez de sair do treino.
  return p.rirReadaptacao ?? PRESCRICAO.isolador.rirReadaptacao!;
}

/**
 * Quem ABRE o bloco de cada grupo — a âncora, que é pergunta de posição.
 *
 * Separada de `papel` de propósito (ver `papeisDaSessao`): a âncora existe
 * mesmo quando o exercício que abre o grupo é um isolador, porque alguém
 * sempre abre. É ela que a regra de comparabilidade usa ("é comparando a carga
 * dele que se enxerga progresso"), não o papel.
 */
export function ancorasDaSessao<T extends ItemDaSessao>(exs: T[]): Set<T> {
  const out = new Set<T>();
  const vistos = new Set<string>();
  for (const e of exs) {
    if (e.grupo === 'cardio' || vistos.has(e.grupo)) continue;
    vistos.add(e.grupo);
    out.add(e);
  }
  return out;
}

/** "RIR 2-3" / "RIR 2". */
export function textoRir(rir: [number, number] | null | undefined): string {
  if (!rir) return '';
  return rir[0] === rir[1] ? `RIR ${rir[0]}` : `RIR ${rir[0]}-${rir[1]}`;
}

/** Sufixo para quem abre o bloco sem ser principal — o caso de A9 e A7. */
export const ABRE_O_GRUPO = 'abre o grupo';

export const LABEL_PAPEL: Record<Papel, string> = {
  principal: 'Principal',
  complementar: 'Complementar',
  isolador: 'Isolador',
  finalizador: 'Finalizador',
};

// `PORQUE_PAPEL` MUDOU DE CASA — mora em `porque.ts`, junto com a camada
// específica ("o que ESTE exercício acrescenta que os outros do dia não
// acrescentam").
//
// Ele podia ter ficado aqui: é um texto por papel, e papel é assunto deste
// arquivo. O motivo de mover é o mesmo que apagou `descansoLegado` vinte linhas
// acima — duas casas para a mesma pergunta é como o app começa a se contradizer.
// "Por que este exercício está aqui" passou a ter DUAS respostas em G3 (a
// estrutural e a específica), e mantê-las em arquivos diferentes garantia que
// alguém escreveria a terceira sem ver as outras duas.

// ── Cobertura indireta (A9) ───────────────────────────────────────────────

/**
 * Quais padrões de um grupo já estão cobertos pelo que a sessão tem até aqui.
 *
 * ── O buraco que isto fecha ──────────────────────────────────────────────
 *
 * O dia "peito e tríceps" auditado terminava com 17,5 séries fracionadas de
 * deltoide — quase todas ANTERIORES — e o único trabalho direto de ombro era um
 * desenvolvimento militar na nona posição: composto pesado, com o mesmo
 * deltoide anterior que 19 séries de supino já tinham gasto, feito por último.
 * O deltoide medial recebia ZERO. O mesmo no tríceps: 15 séries fracionadas,
 * nenhuma extensão de cotovelo isolada.
 *
 * A regra de A9: quando o volume INDIRETO de um grupo na sessão passa de 60% do
 * alvo daquela sessão, o trabalho direto fica restrito aos padrões que o
 * indireto NÃO cobre. Não é "menos ombro" — é ombro onde ele ainda não foi
 * treinado.
 *
 * ── Por que a cobertura exige a relação de secundário ────────────────────
 *
 * `padraoDe` responde para qualquer grupo, inclusive um que o exercício não
 * treina — e o valor devolvido nesse caso é o default do grupo, não uma
 * informação. Um desenvolvimento militar consultado como se fosse peito devolve
 * 'horizontal' e bloquearia o supino do dia seguinte por um trabalho que ele
 * não faz. Por isso a cobertura só conta quando o grupo está declarado como
 * secundário no catálogo.
 */
/** Que padrões de `grupo` um exercício de outro grupo cobre ao treiná-lo junto. */
function padroesQueCobre(nome: string, grupo: string): string[] {
  const p = padraoDe(nome, grupo);
  // Empurrar treina o deltoide ANTERIOR, e ele é o mesmo músculo da elevação
  // frontal. Sem esta linha, "restrito aos padrões não cobertos" liberava
  // justamente a elevação frontal num dia com 19 séries de supino.
  if (grupo === 'ombro' && p === 'desenvolvimento') return [p, 'frontal'];
  // ── ATENÇÃO, achado medido e NÃO corrigido nesta fase ──────────────────
  //
  // O aviso do bloco acima ("o valor devolvido nesse caso é o default do grupo,
  // não uma informação") tem uma segunda vítima: `Agachamento livre sem peso` e
  // `Ponte de glúteo` listam `posterior` como secundário e caem no default
  // `quadril`, que é o hinge CARREGADO (stiff, romeno, bom dia). Nenhum dos
  // dois carrega o isquiotibial por flexão de quadril com carga externa, e
  // mesmo assim os dois "saturam" esse padrão no dia.
  //
  // Corrigir aqui (`return []` quando o nome não é um hinge de verdade) fecha o
  // caso — e move a composição de OUTROS dias em cascata: testado nesta rodada,
  // um perfil de 6 dias passou a receber desenvolvimento militar num dia de
  // empurrar, quebrando o invariante (b) de A9. Trocar um defeito de 1 perfil
  // por outro de 1 perfil, num pipeline que esta fase não veio auditar, é como
  // as correções de meio de pipeline se desfizeram nas fases anteriores.
  //
  // Fica registrado como candidato, com a conta pronta. Quem sofre disso hoje é
  // a troca da SEMANA, e ela ganhou um fallback declarado em `gerador.ts`.
  return [p];
}

export function padroesCobertos(
  grupo: string,
  jaNaSessao: { nome: string; grupo: string; secundarios: string[] }[]
): Set<string> {
  const out = new Set<string>();
  for (const e of jaNaSessao) {
    if (e.grupo === grupo) {
      out.add(padraoDe(e.nome, grupo));
      continue;
    }
    if (!e.secundarios.includes(grupo)) continue;
    for (const p of padroesQueCobre(e.nome, grupo)) out.add(p);
  }
  return out;
}

/**
 * Volume indireto (0,5 por série) que caiu em cada PADRÃO de um grupo.
 *
 * ── Por que por padrão, e não pelo total do grupo ────────────────────────
 *
 * A9 sugere o limiar em "60% do alvo do grupo na sessão". Medir assim deixa
 * passar exatamente o caso que a regra existe para pegar: num push de seis dias
 * o ombro tem alvo de sessão 9, recebe 4,5 fracionadas de supino e fica em 50% —
 * abaixo do limiar — mesmo com essas 4,5 caindo INTEIRAS no deltoide anterior,
 * que é o que o desenvolvimento também treinaria. O total do grupo esconde a
 * composição, e a composição é o achado: 17,5 fracionadas de ombro com o medial
 * em zero.
 *
 * Então o limiar é por padrão, e a régua é o teto de séries por padrão que o
 * projeto já usa (B4: 8 para grupo grande, 6 para pequeno). Metade dele já
 * entregue de graça significa que a segunda metade rende mais em outro lugar.
 */
export function indiretoPorPadrao(
  grupo: string,
  jaNaSessao: { nome: string; grupo: string; secundarios: string[]; series: number }[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of jaNaSessao) {
    if (e.grupo === grupo || !e.secundarios.includes(grupo)) continue;
    for (const p of padroesQueCobre(e.nome, grupo)) out.set(p, (out.get(p) ?? 0) + e.series * 0.5);
  }
  return out;
}
