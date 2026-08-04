import type { Fase } from './periodizacao';
import { perfilDeResistencia } from './classificacao';
import { cargaDe, type Papel } from './papel';

/**
 * Técnicas de intensidade — B7, com as três ressalvas do relatório vivas no código.
 *
 * ── As regras duras, na ordem em que a auditoria as escreveu ─────────────
 *
 * 1. Só em **isolador** ou **finalizador**. Nunca em principal ou complementar.
 * 2. Só na **última série** do exercício.
 * 3. Máximo **2 aplicações por sessão**.
 * 4. **Zero durante a readaptação e o deload.**
 *
 * ── Por que este arquivo é quase todo "não" ──────────────────────────────
 *
 * Das oito técnicas da tabela B7, **uma** é prescrita. Não é timidez: é o que
 * sobra depois de aplicar a régua que o resto do projeto já usa — a de só cobrar
 * pelo que a evidência aberta sustenta.
 *
 * · **Drop set** entrega TEMPO. Sødal 2023 (6 estudos, n=142) não achou
 *   diferença de hipertrofia contra séries tradicionais (p = 0,392), com metade
 *   a um terço do tempo. Num app em que 9,9% das sessões já estouram o relógio,
 *   tempo é exatamente a moeda que falta — então ele entra, e o texto diz o que
 *   ele compra e o que não compra.
 * · **Falha momentânea** não entra como técnica porque ela já está prescrita em
 *   outro lugar com outro nome: o RIR do papel. Finalizador é RIR 0-1, que É
 *   "perto da falha". Um botão "ir à falha" ao lado de "RIR 0-1" seriam duas
 *   prescrições para a mesma decisão — e Refalo 2023 diz que a falha NÃO é
 *   superior à não-falha, então nem sequer seria um upgrade.
 * · **Myo-reps** não tem uma única fonte aberta e verificada. Fica declarada,
 *   nunca prescrita. Prescrever seria repetir o achado que já custou caro neste
 *   cofre: 10 de 11 citações de memória de modelo eram inventadas.
 * · **Pré-exaustão** é CONTRAINDICADA, não "não recomendada": Krzysztofik 2019
 *   mede redução do volume total no multiarticular seguinte sem vantagem de
 *   hipertrofia. Ela está aqui de propósito, marcada — tirar do catálogo faria a
 *   contraindicação sumir junto, e a próxima pessoa a implementaria achando que
 *   ninguém tinha pensado nisso.
 * · **BFR** e **excêntrico acentuado** exigem, respectivamente, conhecer a
 *   pressão de oclusão (40-80% AOP) e ter parceiro ou weight releaser. Não são
 *   prescritíveis por um app que não mede nem uma coisa nem outra.
 *
 * ── E cadência não mora aqui ─────────────────────────────────────────────
 *
 * Negativa lenta / tempo excêntrico é CADÊNCIA (`execucao.ts`), não técnica de
 * intensidade: Krzysztofik mede hipertrofia semelhante de 0,5 a 8 s. Ter as duas
 * ideias na mesma lista é o convite para o app vender ritmo como dificuldade.
 */

export interface Tecnica {
  id: string;
  nome: string;
  /** Instrução de execução, curta o bastante para caber no meio de um treino. */
  comoFazer: string;
  /** O que ela de fato entrega — e é aqui que a honestidade mora. */
  oQueGanha: string;
  /** O nível de evidência, com o número quando existe número. */
  evidencia: string;
  /** Onde NÃO usar. */
  ondeNao: string;
  /** O app prescreve sozinho? */
  prescrever: boolean;
  /** Contraindicada: nem prescrita, nem oferecida como opção. */
  contraindicada?: boolean;
  /** Sempre a última série — B7 regra 2. O campo existe para o teste cobrar. */
  serie: 'ultima';
}

export const TECNICAS: Tecnica[] = [
  {
    id: 'drop_set',
    nome: 'Drop set',
    comoFazer:
      'Chegue ao fim da última série, tire 20% a 30% da carga sem descansar e continue até não sair ' +
      'mais repetição limpa. Uma queda só.',
    oQueGanha:
      'Tempo. Você faz o mesmo estímulo em metade do tempo — não mais estímulo no mesmo tempo.',
    evidencia:
      'Sødal 2023 (meta-análise, 6 estudos, n=142): SEM diferença de hipertrofia contra séries ' +
      'tradicionais (p = 0,392), com metade a um terço do tempo total. O ganho medido é tempo.',
    ondeNao:
      'Composto pesado e qualquer exercício em que você precise controlar o corpo para não se ' +
      'machucar. E nunca como "estímulo extra" — ele não é.',
    prescrever: true,
    serie: 'ultima',
  },
  {
    id: 'falha',
    nome: 'Falha momentânea',
    comoFazer: 'Seguir até não completar mais uma repetição com a técnica inteira.',
    oQueGanha:
      'Nada que o RIR do papel já não decida. O finalizador do seu treino já está prescrito em ' +
      'RIR 0-1, que é a mesma instrução com um número no lugar de um rótulo.',
    evidencia:
      'Refalo 2023 (revisão sistemática, 15 estudos): falha momentânea NÃO é superior à não-falha. ' +
      'Quando usada, enviesar para exercício de baixa complexidade e baixa fadiga associada.',
    ondeNao: 'Composto pesado, principal, e qualquer série em que a barra passe por cima de você.',
    prescrever: false,
    serie: 'ultima',
  },
  {
    id: 'rest_pause',
    nome: 'Rest-pause',
    comoFazer:
      'Ao fim da última série, descanse 15 a 20 s e faça mais um punhado de repetições com a mesma ' +
      'carga. Duas rodadas no máximo.',
    oQueGanha: 'Tempo, pelo mesmo mecanismo do drop set — mas sem número medido para mostrar.',
    evidencia: 'Sem evidência aberta e verificada. É prática comum, e está dito como prática comum.',
    ondeNao: 'Principal e composto pesado.',
    prescrever: false,
    serie: 'ultima',
  },
  {
    id: 'myo_reps',
    nome: 'Myo-reps',
    comoFazer:
      'Série de ativação até perto da falha, depois miniséries de 3 a 5 repetições com 10 a 15 s ' +
      'entre elas.',
    oQueGanha: 'Não sabemos. E não sabemos é a resposta honesta.',
    evidencia:
      'NENHUMA fonte aberta e verificada. Aparece aqui declarada como prática comum, e por isso o ' +
      'app não a prescreve nem a sugere — só a descreve para quem já ouviu falar dela.',
    ondeNao: 'Em qualquer lugar em que você espere que o app garanta que funciona.',
    prescrever: false,
    serie: 'ultima',
  },
  {
    id: 'pre_exaustao',
    nome: 'Pré-exaustão',
    comoFazer: 'Isolador até perto da falha imediatamente antes do multiarticular do mesmo músculo.',
    oQueGanha:
      'Menos treino. Você chega ao exercício grande já cansado e levanta menos, sem receber nada ' +
      'em troca.',
    evidencia:
      'Krzysztofik 2019 (revisão sistemática): reduz o volume total no multiarticular seguinte, ' +
      'SEM vantagem de hipertrofia. É contraindicação explícita, não preferência.',
    ondeNao: 'Antes de qualquer multiarticular. Ou seja: em lugar nenhum deste app.',
    prescrever: false,
    contraindicada: true,
    serie: 'ultima',
  },
  {
    id: 'bfr',
    nome: 'Restrição de fluxo sanguíneo (BFR)',
    comoFazer: 'Faixa oclusiva no membro, 20-30% de 1RM, séries longas.',
    oQueGanha: 'Hipertrofia comparável à carga alta em MEMBROS, com carga baixa.',
    evidencia:
      'Exige conhecer a pressão de oclusão do próprio membro (40-80% AOP) para ser segura, e o app ' +
      'não mede isso. Não funciona em tronco.',
    ondeNao: 'Tronco. E sem medir a pressão de oclusão, em lugar nenhum.',
    prescrever: false,
    serie: 'ultima',
  },
  {
    id: 'excentrico_acentuado',
    nome: 'Excêntrico acentuado (AEL)',
    comoFazer: 'Carga extra só na descida, retirada para a subida.',
    oQueGanha: 'Hipertrofia igual à carga alta tradicional, com volume equalizado.',
    evidencia:
      'Igual, não melhor — e custa tempo de recarga a cada repetição. Exige parceiro ou weight ' +
      'releaser.',
    ondeNao: 'Treinando sozinho, e no retorno de uma pausa.',
    prescrever: false,
    serie: 'ultima',
  },
];

export const TECNICA_POR_ID: Record<string, Tecnica> = Object.fromEntries(
  TECNICAS.map((t) => [t.id, t])
);

/** Máximo de aplicações por sessão — B7 regra 3. */
export const MAX_TECNICAS_POR_SESSAO = 2;

interface LinhaDaSessao {
  nome: string;
  grupo: string;
  papel?: Papel | string | null;
  equipamento?: string | null;
  tipoCarga?: string | null;
}

/**
 * O drop set exige poder tirar carga em segundos.
 *
 * Pino de máquina e polia mudam com uma mão; halter exige um par mais leve ao
 * alcance, o que na prática existe. Barra com anilha não: soltar presilha e
 * tirar disco no meio de um drop set é um minuto, e aí a técnica perde a única
 * coisa que ela comprovadamente entrega. Peso corporal não tem carga a tirar.
 */
function daParaBaixarACargaRapido(nome: string, equipamento?: string | null): boolean {
  const perfil = perfilDeResistencia(nome, equipamento);
  return perfil === 'maquina' || perfil === 'cabo' || perfil === 'halter';
}

export interface OpcoesDeTecnica {
  /**
   * A sessão está apertada no relógio?
   *
   * É a única condição em que B7 recomenda drop set além do finalizador: "onde
   * faz sentido — finalizador, e QUANDO FALTA TEMPO". Sem aperto, uma aplicação
   * por sessão; com aperto, as duas que o teto permite.
   */
  apertadoNoTempo?: boolean;
}

/**
 * Que técnica cabe em cada exercício da sessão, nesta fase.
 *
 * Devolve mapa por ITEM (a mesma convenção de `papeisDaSessao`), vazio quando a
 * fase não permite nenhuma. Nunca devolve técnica para principal, complementar,
 * série por tempo ou excêntrico puro.
 *
 * ── Por que a readaptação e o deload zeram ───────────────────────────────
 *
 * Docking & Cook 2019: o turnover de colágeno em tendão maduro é da ordem de
 * 0,25% ao ano, e o tecido responde a um limiar de tração — ele não acompanha a
 * velocidade com que o músculo recupera carga depois de uma pausa. No retorno a
 * carga sobe rápido por recuperação neural, e é aí que a defasagem
 * músculo-tendão fica maior. Empilhar técnica em cima disso é apostar contra o
 * tecido mais lento do sistema.
 */
export function tecnicasDaSessao<T extends LinhaDaSessao>(
  exs: T[],
  fase: Fase | null,
  opcoes: OpcoesDeTecnica = {}
): Map<T, Tecnica> {
  const out = new Map<T, Tecnica>();
  // B7 regra 4 — e ela é a primeira porta de propósito: nenhuma das outras
  // regras deve poder "quase" abrir uma exceção aqui.
  if (fase === 'readaptacao' || fase === 'deload') return out;

  const drop = TECNICA_POR_ID.drop_set;
  if (!drop?.prescrever) return out;

  const teto = opcoes.apertadoNoTempo ? MAX_TECNICAS_POR_SESSAO : 1;

  // ── B7 lê "finalizador, E QUANDO FALTA TEMPO" — as duas metades ─────────
  //
  // A primeira versão aceitava qualquer isolador e prescrevia em 3.169 de 4.725
  // sessões da grade, sendo **2.338 em isolador comum** e só 831 no finalizador.
  // Isso é mais do que a tabela B7 autoriza: o único ganho medido do drop set é
  // TEMPO, então oferecê-lo onde o tempo não falta é vender um benefício que
  // aquela sessão não precisa — a mesma crítica que a auditoria faz ao app que
  // enche a sessão de série porque sobrou agenda.
  //
  // Sem aperto de tempo: só o finalizador, que é a posição que a tabela nomeia.
  // Com aperto: o teto de 2 abre para o isolador seguinte, de trás para frente —
  // Refalo 2023 manda enviesar a proximidade da falha para exercício de baixa
  // complexidade e baixa fadiga associada, e é isso que está no fim da sessão.
  const forca = exs.filter((e) => e.grupo !== 'cardio');
  for (let i = forca.length - 1; i >= 0 && out.size < teto; i--) {
    const e = forca[i];
    // B7 regra 1.
    if (e.papel !== 'isolador' && e.papel !== 'finalizador') continue;
    if (!opcoes.apertadoNoTempo && e.papel !== 'finalizador') continue;
    // Série por tempo não tem carga a baixar nem repetição a contar.
    if (e.tipoCarga === 'tempo' || cargaDe(e.tipoCarga) === 'fixa') continue;
    if (!daParaBaixarACargaRapido(e.nome, e.equipamento)) continue;
    out.set(e, drop);
  }
  return out;
}

/** Uma linha para a tela: "Drop set na última série — tira 20-30% e continua". */
export function resumoDaTecnica(t: Tecnica): string {
  return `${t.nome} só na última série. ${t.oQueGanha}`;
}
