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

export type LocalTreino = 'academia' | 'academia_basica' | 'casa_equipada' | 'casa_simples';

export interface OpcaoLocal {
  chave: LocalTreino;
  label: string;
  emoji: string;
  descricao: string;
  /** Valores da coluna `equipamento` do catálogo. */
  equipamentos: string[];
  /** O que muda na prática, dito antes de escolher. */
  efeito: string;
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

export function equipamentosDe(local: string): string[] {
  return (LOCAIS.find((l) => l.chave === local) ?? LOCAIS[0]).equipamentos;
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
  if (local === 'casa_equipada')
    return (
      'Com halteres dá para treinar tudo, mas perna chega ao limite antes: o corpo aguenta mais ' +
      'carga do que a mão consegue segurar. Compensamos com mais repetição e unilateral.'
    );
  return null;
}
