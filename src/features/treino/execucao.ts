import { padraoDe, perfilDeResistencia } from './classificacao';
import { articulacoesDe, cargaDe, estabilizacaoDe, picoDeTensao } from './papel';

/**
 * A camada de TEMPO da execução: cadência, tempo sob tensão, amplitude e o erro
 * mais comum.
 *
 * ── O que faltava ────────────────────────────────────────────────────────
 *
 * O catálogo já tem `instrucoes` (a sequência do movimento) e `dica` (uma frase
 * solta por exercício). O que não existia em lugar nenhum era o tempo: quanto
 * dura a descida, se há pausa embaixo, quanto de amplitude. Sem isso, "3 × 8-12"
 * descreve quantas vezes, nunca como.
 *
 * ── A armadilha que este arquivo existe para não cair ────────────────────
 *
 * **Negativa lenta é CADÊNCIA, não técnica de intensidade.** Krzysztofik 2019
 * mede hipertrofia semelhante de 0,5 s a 8 s de fase excêntrica, com ~2 s sendo
 * o mais eficiente em tempo. Um app que venda "desça em 5 segundos para crescer
 * mais" está mentindo com a fonte na mão — e é a mentira mais fácil de escrever,
 * porque soa a rigor técnico. Por isso a cadência mora AQUI e não em
 * `tecnicas.ts`: são perguntas diferentes, e juntá-las é como o crossover virou
 * composto numa função e abertura em outra.
 *
 * ── Um segundo só, não dois ──────────────────────────────────────────────
 *
 * `duracao.ts` estimava o treino inteiro com `SEG_POR_REP = 3` cravado. Se a
 * cadência prescrita nascesse em outro arquivo, o app diria "2 s na descida,
 * 1 s de pausa" numa tela e cobraria 3 s por repetição na outra. A constante
 * passou a morar aqui e `duracao.ts` a consome — mesma lição de `ALVO_SERIES`
 * em G2.1 e do teto útil que era dois números para a mesma pergunta.
 *
 * ── Derivado, nunca digitado ─────────────────────────────────────────────
 *
 * Nada aqui é escrito exercício por exercício. Tudo sai de `padraoDe`,
 * `perfilDeResistencia`, `picoDeTensao`, `articulacoesDe` e do tipo de carga —
 * os atributos que o projeto já mantém. Uma tabela de 117 frases estaria errada
 * no dia em que alguém acrescentasse a 118ª, e é a `dica` do catálogo (que é
 * escrita à mão) que mostra o custo: metade das linhas não descreve erro nenhum,
 * apesar de a tela chamá-las de "erro mais comum".
 */

export interface Cadencia {
  /** Segundos na fase de descida (excêntrica). */
  excentrica: number;
  /** Segundos parado no ponto de maior alongamento. 0 = sem pausa. */
  pausa: number;
  /** Segundos na subida. É teto, não meta: a intenção é acelerar. */
  concentrica: number;
}

/**
 * A cadência canônica — 2 s de descida, sem pausa, 1 s de subida.
 *
 * São os 3 s por repetição que `duracao.ts` já usava para estimar o treino, e
 * são os ~2 s que Krzysztofik 2019 aponta como o mais eficiente em tempo dentro
 * de uma faixa (0,5 a 8 s) em que a hipertrofia é semelhante.
 */
export const CADENCIA_PADRAO: Cadencia = { excentrica: 2, pausa: 0, concentrica: 1 };

export function tempoPorRepSeg(c: Cadencia): number {
  return c.excentrica + c.pausa + c.concentrica;
}

/** Os 3 s por repetição que a estimativa de duração usa. Uma definição só. */
export const TEMPO_POR_REP_PADRAO = tempoPorRepSeg(CADENCIA_PADRAO);

/**
 * A frase que impede a próxima pessoa (ou o próximo agente) de vender cadência
 * como intensidade — e ela agora sabe de que exercício está falando.
 *
 * ── O que a validação de tela pegou ──────────────────────────────────────
 *
 * Ela era uma constante única, impressa embaixo de todo card. Na `Flexão
 * nórdica` a tela mostrava **4-0-1** e "a descida É o exercício aqui: quatro
 * segundos até o fim" e, três centímetros abaixo, a mesma tela dizia "o padrão
 * aqui é 2 s descendo... descer mais devagar não substitui carga nem repetição".
 * O app prescrevia 4 s e negava os 4 s na mesma dobra.
 *
 * A parte que vale para todo mundo (a faixa de 0,5 a 8 s) continua fixa, porque
 * é a evidência. A parte que fala do QUE FAZER passou a depender da cadência que
 * aquele exercício de fato recebeu.
 */
const EVIDENCIA_CADENCIA =
  'Cadência é ritmo, não dificuldade: de 0,5 s a 8 s de descida o músculo cresce praticamente ' +
  'igual, e o que muda é quanto tempo você passa na academia.';

export function porqueCadenciaDe(c: Cadencia): string {
  // Série por tempo não tem repetição, logo não tem cadência a explicar.
  if (!tempoPorRepSeg(c)) {
    return (
      'Esta série é medida em segundos, não em repetições — não há descida nem subida para ' +
      'cronometrar. O que conta é quanto tempo a posição se mantém sem ceder.'
    );
  }
  if (c.excentrica >= 4) {
    return (
      `${EVIDENCIA_CADENCIA} Este exercício é a exceção declarada: aqui a descida é o exercício ` +
      'inteiro, a subida é assistida, e os 4 s não são "mais intensidade" — são o protocolo do ' +
      'movimento.'
    );
  }
  return (
    `${EVIDENCIA_CADENCIA} Por isso o padrão é 2 s descendo e subida com intenção de acelerar: ` +
    'é o ritmo que mantém a técnica sem alongar a sessão. Descer mais devagar não substitui ' +
    'carga nem repetição.'
  );
}

/**
 * O texto genérico, para quem não tem um exercício na mão.
 *
 * Mantido exportado porque é a frase que resume a política do app, mas as telas
 * usam `porqueCadenciaDe` — foi a versão sem contexto que produziu a
 * contradição da nórdica.
 */
export const PORQUE_CADENCIA = porqueCadenciaDe(CADENCIA_PADRAO);

/** Excêntrico puro: a descida É o exercício, e a subida é assistida. */
const EXCENTRICOS = new Set(['Flexão nórdica', 'Barra fixa negativa']);

/**
 * A pausa de 1 s no fundo foi TESTADA, MEDIDA e REJEITADA. Fica escrito.
 *
 * A versão anterior deste arquivo dava 1 s de pausa a todo exercício com pico de
 * tensão na posição ALONGADA — 42 dos 117 do catálogo, subindo o custo de 3 para
 * 4 s por repetição. O raciocínio era bom: no stiff e na abertura o fundo é o
 * exercício inteiro, e quicar troca o estímulo por rebote.
 *
 * O que a medição mostrou, na grade de 1.350 perfis (4.725 sessões), porque
 * `estimarDuracao` passou a consumir esta mesma cadência:
 *
 * | | sem pausa | com pausa |
 * |---|---|---|
 * | séries de força no total | 92.994 | **91.810 (−1.184)** |
 * | exercícios no total | 29.212 | 28.897 (−315) |
 * | sessões estourando o tempo pedido | 1.416 | **1.486 (+70)** |
 * | minutos médios por sessão | 53,1 | 54,1 |
 *
 * Ou seja: a pausa custaria **1,3% do volume de força do app inteiro**, e
 * `Krzysztofik 2019` — a única fonte aberta sobre tempo de fase — não a
 * prescreve. Ela é **prática comum, sem citação**. Cobrar volume real por um
 * benefício não verificado é exatamente o que a auditoria pede para não fazer.
 *
 * E ela não era necessária para dizer a mesma coisa: "não quique no fundo" mora
 * em `amplitudeDe` e em `erroComumDe`, custa zero segundo e chega ao usuário
 * pelas mesmas telas. A instrução ficou; o preço saiu.
 */

export function cadenciaDe(
  nome: string,
  grupo: string,
  _equipamento?: string | null,
  tipoCarga?: string | null
): Cadencia {
  // Série por TEMPO (prancha, cardio) não tem repetição: cadência por repetição
  // ali seria campo preenchido para não ficar vazio.
  if (tipoCarga === 'tempo') return { excentrica: 0, pausa: 0, concentrica: 0 };
  // Excêntrico puro é o único desvio, e ele não é opinião: na nórdica a descida
  // É o exercício e a subida é assistida. A umbrella review do NHE descreve o
  // protocolo modal em 2-3 séries de 6-12 repetições controladas na descida.
  if (EXCENTRICOS.has(nome)) return { excentrica: 4, pausa: 0, concentrica: 1 };
  return { ...CADENCIA_PADRAO };
}

/** "2-0-1" — descida, pausa, subida. */
export function cadenciaTexto(c: Cadencia): string {
  if (!tempoPorRepSeg(c)) return 'por tempo';
  return `${c.excentrica}-${c.pausa}-${c.concentrica}`;
}

/** Tempo sob tensão de uma série, em segundos. */
export function tempoSobTensaoSeg(c: Cadencia, reps: number): number {
  return Math.round(tempoPorRepSeg(c) * reps);
}

// ── Amplitude ─────────────────────────────────────────────────────────────

/**
 * Amplitude, derivada do PICO DE TENSÃO.
 *
 * Onde a carga é máxima decide qual ponta da amplitude some primeiro quando a
 * carga sobe: em exercício de pico alongado corta-se o fundo; em pico
 * encurtado, o topo. Dizer "amplitude completa" nos dois casos é dizer a mesma
 * coisa sobre problemas opostos.
 */
const AMPLITUDE: Record<string, string> = {
  alongado:
    'Amplitude cheia, e o que decide é o fundo: desça até sentir o músculo esticar e só então volte. ' +
    'É lá que este exercício carrega — encurtar embaixo é trocar o estímulo por um trecho fácil.',
  meio:
    'Amplitude cheia nas duas pontas. A carga é maior no meio do caminho, que é justamente onde a ' +
    'repetição se perde quando você acelera para escapar do trecho difícil.',
  encurtado:
    'Amplitude cheia e feche o topo. Aqui a tensão máxima é na contração, então parar 20% antes do ' +
    'fim é deixar de fora exatamente a parte que o exercício existe para treinar.',
};

const AMPLITUDE_TEMPO =
  'Não há amplitude a percorrer: o que conta é manter a posição sem ceder. Quando a forma quebra, ' +
  'a série acabou — segurar mais tempo torto não conta.';

export function amplitudeDe(nome: string, grupo: string, tipoCarga?: string | null): string {
  if (tipoCarga === 'tempo') return AMPLITUDE_TEMPO;
  return AMPLITUDE[picoDeTensao(nome, grupo)] ?? AMPLITUDE.meio;
}

// ── O erro mais comum ─────────────────────────────────────────────────────

/**
 * O erro mais comum, derivado da CLASSE MECÂNICA do exercício.
 *
 * ── Por que não usar a `dica` do catálogo ────────────────────────────────
 *
 * A tela do exercício rotula `dica` como "Erro mais comum", e para boa parte das
 * linhas isso é falso: "Melhor exercício para peitoral superior. Não sacrifique
 * amplitude por carga" e "Amplitude maior que a barra — use isso a seu favor"
 * são recomendações, não erros. Rótulo que mente é pior que campo vazio, porque
 * ninguém desconfia dele.
 *
 * A `dica` continua no app — como dica, que é o que ela é. O erro sai daqui, é
 * sempre verdadeiro para a classe do movimento e existe para os 117 exercícios,
 * inclusive os que alguém acrescentar depois.
 *
 * A ordem dos testes é a ordem da consequência: o que arruína a série vem antes
 * do que só a deixa pior.
 */
const ERRO: Record<string, string> = {
  excentrico:
    'Descer rápido. Neste exercício a descida é o exercício — soltar o corpo até o chão em um segundo ' +
    'transforma quatro séries de estímulo em quatro quedas.',
  tempo:
    'Deixar o quadril cair e continuar contando. O cronômetro não sabe se a posição quebrou; a série ' +
    'termina quando a forma termina.',
  alongado_quique:
    'Quicar no fundo. É ali que este exercício carrega o músculo, e usar o rebote troca o estímulo pelo ' +
    'impulso — a carga sobe na planilha e desce no músculo.',
  encurtado_carga:
    'Peso demais para fechar o topo. Como a tensão máxima é na contração, carga que impede o último ' +
    'terço tira justamente a parte que importa.',
  cabo_volta:
    'Deixar a polia puxar o peso de volta. O cabo mantém tensão o tempo todo — é essa a vantagem dele, ' +
    'e ela some quando a fase de retorno vira queda livre.',
  maquina_ajuste:
    'Começar sem ajustar o aparelho. Na máquina a articulação tem que ficar alinhada com o pivô; ' +
    'dois furos errados mudam o músculo que trabalha.',
  // Tornozelo e abdômen não têm pivô a alinhar, e por isso não cabem no erro de
  // máquina — a `Panturrilha em pé` recebia "começar sem ajustar BANCO e eixo",
  // sobre um aparelho em que a pessoa fica de pé. Aqui a classe mecânica é
  // outra: amplitude curta, cortada nas duas pontas.
  tornozelo_amplitude:
    'Quicar embaixo e não fechar em cima. O tornozelo tem amplitude curta — cortar as duas pontas ' +
    'transforma a série num balanço com o peso indo e voltando sozinho.',
  abdomen_pescoco:
    'Puxar a cabeça com as mãos. O pescoço não move o tronco: quem encurta a distância entre ' +
    'costela e quadril é o abdômen, e é ele que precisa cansar.',
  mono_articulacao_solta:
    'Mover o que devia ficar parado. Em exercício de uma articulação só, ajudar com tronco ou ombro ' +
    'reparte a carga com músculos maiores e o alvo recebe menos do que a carga sugere.',
  multi_alta_posicao:
    'Perder a posição do tronco para levantar mais. Peso livre cobra estabilidade antes de cobrar força, ' +
    'e a repetição que sai com a coluna cedendo não é uma repetição a mais.',
  corporal_amplitude:
    'Trocar amplitude por repetição. Sem carga externa a única moeda é a amplitude — encurtar para chegar ' +
    'ao número combinado transforma progresso em contagem.',
};

export function erroComumDe(
  nome: string,
  grupo: string,
  equipamento?: string | null,
  tipoCarga?: string | null
): string {
  if (EXCENTRICOS.has(nome)) return ERRO.excentrico;
  if (tipoCarga === 'tempo') return ERRO.tempo;

  // Grupos cuja articulação não tem pivô a alinhar nem carga externa a segurar:
  // o erro deles é de AMPLITUDE, e cai antes do erro de implemento. Sem isto a
  // panturrilha em pé recebia o texto de ajuste de banco de uma máquina sentada.
  if (grupo === 'panturrilha') return ERRO.tornozelo_amplitude;
  if (grupo === 'abdomen') return ERRO.abdomen_pescoco;

  const pico = picoDeTensao(nome, grupo);
  const perfil = perfilDeResistencia(nome, equipamento);
  const mono = articulacoesDe(nome) === 'mono';
  const estab = estabilizacaoDe(nome, equipamento);

  // A ordem é a da consequência. Quicar no fundo e não fechar o topo arruínam a
  // série inteira; ajuste de banco e retorno solto a deixam pior.
  if (pico === 'alongado') return ERRO.alongado_quique;
  if (pico === 'encurtado') return ERRO.encurtado_carga;
  if (cargaDe(tipoCarga) === 'fixa') return ERRO.corporal_amplitude;
  if (perfil === 'cabo') return ERRO.cabo_volta;
  if (perfil === 'maquina') return ERRO.maquina_ajuste;
  if (mono) return ERRO.mono_articulacao_solta;
  if (estab === 'alta') return ERRO.multi_alta_posicao;
  return ERRO.mono_articulacao_solta;
}

// ── A resposta inteira ────────────────────────────────────────────────────

export interface Execucao {
  cadencia: Cadencia;
  /** "2-1-1", ou "por tempo" onde a repetição não existe. */
  cadenciaTexto: string;
  /** Uma linha explicando o ritmo — e por que mais devagar não é melhor. */
  porqueCadencia: string;
  amplitude: string;
  erroComum: string;
}

export function execucaoDe(
  nome: string,
  grupo: string,
  equipamento?: string | null,
  tipoCarga?: string | null
): Execucao {
  const cadencia = cadenciaDe(nome, grupo, equipamento, tipoCarga);
  return {
    cadencia,
    cadenciaTexto: cadenciaTexto(cadencia),
    // Três casos, e o terceiro é o que a validação de tela pegou: a prancha
    // recebia "Desça em 2 s, suba com intenção de acelerar" e, duas linhas
    // abaixo, "não há amplitude a percorrer". O card se contradizia sozinho.
    porqueCadencia: !tempoPorRepSeg(cadencia)
      ? 'Série medida em segundos: não há descida nem subida para cronometrar. O relógio conta o ' +
        'tempo em que a posição se mantém — quando a forma quebra, a série acabou.'
      : cadencia.excentrica >= 4
        ? 'Aqui a descida é o exercício inteiro: quatro segundos até o fim, e a volta você faz com ' +
          'ajuda. Não existe "quantas repetições sobraram" num movimento assim.'
        : 'Desça em 2 s, suba com intenção de acelerar. Este é o ritmo mais eficiente em tempo — não o ' +
          'mais fácil nem o mais difícil.',
    amplitude: amplitudeDe(nome, grupo, tipoCarga),
    erroComum: erroComumDe(nome, grupo, equipamento, tipoCarga),
  };
}

/** Frase curta para a linha do executor: "2-1-1 · ~44 s sob tensão". */
export function resumoDeExecucao(e: Execucao, reps: number): string {
  const total = tempoPorRepSeg(e.cadencia);
  if (!total) return 'série por tempo';
  return `${e.cadenciaTexto} · ~${tempoSobTensaoSeg(e.cadencia, reps)} s sob tensão`;
}
