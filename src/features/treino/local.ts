/**
 * Onde a pessoa treina — e o que isso permite prescrever.
 *
 * É a pergunta que mais muda o treino e a que quase nenhum app faz. Um plano
 * com leg press e cabo cruzado é inútil para quem treina na sala de casa com
 * dois halteres, e a pessoa não conclui "o app errou": conclui que não
 * consegue treinar. Depois desiste.
 *
 * Aqui o local vira uma lista de equipamentos disponíveis, e o gerador só
 * escolhe exercício que existe nessa lista. O que não cabe simplesmente nunca
 * é oferecido.
 */

export type LocalTreino =
  | 'academia'
  | 'smart_fit'
  | 'academia_basica'
  | 'casa_equipada'
  | 'casa_simples';

export interface OpcaoLocal {
  chave: LocalTreino;
  label: string;
  emoji: string;
  descricao: string;
  /** Valores da coluna `equipamento` do catálogo. */
  equipamentos: string[];
  /** O que muda na prática, dito antes de escolher. */
  efeito: string;
  /**
   * Exercícios que a etiqueta de equipamento libera mas o local não tem.
   *
   * Academia de rede tem barra, halter, cabo e máquina — então filtrar por
   * equipamento não exclui nada. Só que aparelho de nicho não está lá: nenhuma
   * unidade tem banco de glute-ham raise ou hiperextensão inversa. Prescrever
   * isso manda a pessoa procurar por vinte minutos uma máquina que não existe,
   * e o efeito não é "faltou aparelho": é o treino perder credibilidade.
   */
  semEstes?: string[];
}

export const LOCAIS: OpcaoLocal[] = [
  {
    chave: 'academia',
    label: 'Academia completa',
    emoji: '🏋️',
    descricao: 'Máquinas, cabos, barras e halteres',
    equipamentos: ['barra', 'halter', 'cabo', 'maquina', 'livre'],
    efeito: 'Catálogo inteiro liberado — a escolha passa a ser sua preferência, não o que existe.',
  },
  {
    chave: 'smart_fit',
    label: 'Smart Fit ou rede parecida',
    emoji: '🟣',
    descricao: 'Máquinas, cabos, smith, halteres até 40 kg',
    equipamentos: ['barra', 'halter', 'cabo', 'maquina', 'livre'],
    efeito:
      'Praticamente o catálogo inteiro. Ficam de fora só os aparelhos de nicho que rede grande ' +
      'não costuma ter, e no lugar deles entra a versão equivalente em máquina ou cabo.',
    // Aparelho de nicho: existe em academia de musculação especializada, não em
    // rede. Barra fixa livre fica: quando não tem, toda unidade tem graviton.
    semEstes: [
      'Glute ham raise na máquina',
      'Hiperextensão inversa',
      'Burrinho',
      'Agachamento ajoelhado com barra',
      'Flexão nórdica',
      'Remada cavalinho',
      'Panturrilha no smith',
    ],
  },
  {
    chave: 'academia_basica',
    label: 'Academia simples',
    emoji: '🏚️',
    descricao: 'Barras, halteres e poucas máquinas',
    equipamentos: ['barra', 'halter', 'livre', 'maquina'],
    efeito: 'Peso livre no centro do treino. Cabo sai, porque academia de bairro raramente tem.',
  },
  {
    chave: 'casa_equipada',
    label: 'Em casa, com halteres',
    emoji: '🏠',
    descricao: 'Halteres, elásticos, banco improvisado',
    equipamentos: ['halter', 'livre'],
    efeito: 'Só halter e peso corporal. Menos variedade, mesma lógica de volume e progressão.',
  },
  {
    chave: 'casa_simples',
    label: 'Em casa, sem equipamento',
    emoji: '🤸',
    descricao: 'Só o peso do corpo',
    equipamentos: ['livre'],
    efeito:
      'Peso corporal. Funciona de verdade para quem está começando; a progressão passa a ser ' +
      'repetição e dificuldade do movimento, não carga na barra.',
  },
];

/** A chave existe de verdade? Quem precisa ser ESTRITO pergunta antes. */
export function localConhecido(local: string): boolean {
  return LOCAIS.some((l) => l.chave === local);
}

/**
 * Equipamentos do local — com fallback, mas **nunca mais em silêncio**.
 *
 * ── O que o silêncio custou ──────────────────────────────────────────────
 *
 * A grade de 1.350 perfis que sustenta os números de G1, G2 e G2.1 usava as
 * chaves `academia_rede`, `academia_simples` e `casa_halteres`. **Nenhuma das
 * três existe** — os nomes reais são `smart_fit`, `academia_basica` e
 * `casa_equipada`. Como o fallback era mudo, as três caíam em `LOCAIS[0]` e a
 * grade testava **academia 4× e casa_simples 1×** durante três fases inteiras:
 * nunca halteres-sem-máquina, nunca academia-sem-cabo. Invariante declarado
 * como 0 estava em 3 assim que as chaves certas entraram.
 *
 * O fallback FICA, e isso é decisão, não descuido: `local_treino` é
 * `NOT NULL DEFAULT 'academia'` desde a v11, mas um banco restaurado ou uma
 * linha escrita por versão futura pode trazer qualquer coisa — e travar a
 * abertura do app por causa de uma string de perfil seria trocar um plano
 * imperfeito por nenhum plano. O que muda é que ele grita: quem tiver console
 * aberto vê, e o harness é ESTRITO (`localConhecido`), que é onde o defeito
 * deveria ter sido pego.
 */
export function equipamentosDe(local: string): string[] {
  const achado = LOCAIS.find((l) => l.chave === local);
  if (!achado) {
    console.warn(
      `[forja] local de treino desconhecido: "${local}". Caindo em "${LOCAIS[0].chave}" — ` +
        `o plano vai sair como se fosse academia completa. Chaves válidas: ` +
        `${LOCAIS.map((l) => l.chave).join(', ')}.`
    );
  }
  return (achado ?? LOCAIS[0]).equipamentos;
}

/** Exercícios que este local não tem, apesar de a etiqueta de equipamento liberar. */
export function foraDoLocal(local: string): Set<string> {
  return new Set((LOCAIS.find((l) => l.chave === local)?.semEstes ?? []));
}

export function labelLocal(local: string): string {
  return (LOCAIS.find((l) => l.chave === local) ?? LOCAIS[0]).label;
}

/**
 * Aviso honesto quando o local limita o que dá para fazer.
 *
 * Melhor dizer antes do que a pessoa descobrir na terceira semana achando que
 * o treino está fraco.
 */
export function limitacaoDoLocal(local: string): string | null {
  if (local === 'casa_simples')
    return (
      'Sem carga externa, costas é o grupo que mais sofre — puxar exige alguma barra. Se der para ' +
      'arrumar uma barra de porta ou um elástico, é o acessório que mais muda este treino.'
    );
  if (local === 'smart_fit')
    return (
      'Alguns aparelhos de nicho ficaram fora porque rede grande raramente tem — flexão nórdica, ' +
      'hiperextensão inversa e afins. No lugar entrou a versão em máquina ou cabo, que existe em ' +
      'toda unidade. Se a sua tiver algum deles, dá para acrescentar na mão.'
    );
  if (local === 'casa_equipada')
    return (
      'Com halteres dá para treinar tudo, mas perna chega ao limite antes: o corpo aguenta mais ' +
      'carga do que a mão consegue segurar. Compensamos com mais repetição e unilateral.'
    );
  return null;
}
