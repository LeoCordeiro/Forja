import type { Profile } from '@/db/types';
import { descansoCorreto, ehComposto, ehPesado } from './classificacao';
import { equipamentosDe, limitacaoDoLocal } from './local';
import { REGIOES_DOR } from '@/features/perfil/diagnostico';
import { PADROES } from './padroes';
import { estimarDuracao, emMinutos } from './duracao';

/**
 * O banco entra tarde, de propósito.
 *
 * Importar `@/db/client` no topo arrasta `expo-sqlite` e, atrás dele, o React
 * Native inteiro — e aí este arquivo só roda dentro do app. Como ele é a
 * inteligência central do produto, a única forma de conferir uma regra passava
 * a ser abrir o app e olhar a tela, que é exatamente como um teto de séries
 * errado ficou meses cortando 40% do volume sem ninguém ver.
 *
 * Com o import tardio, o núcleo de prescrição roda no Node e
 * `scripts/testar-gerador.mjs` confere ordem, volume e cobertura de uma vez.
 */
const banco = () => import('@/db/client');

/**
 * Gerador de treino.
 *
 * ── Por que este arquivo existe ──────────────────────────────────────────
 *
 * Até ele, o app tinha um questionário completo e uma rotina de exemplo — e
 * nenhuma ligação entre os dois. Todo mundo recebia o mesmo Push/Pull/Legs de
 * três dias, com barra fixa e leg press, independente de treinar em casa, de
 * ter 45 minutos, de sentir dor no ombro ou de conseguir ir cinco vezes por
 * semana. Um plano que serve para todo mundo é um plano que não foi feito para
 * ninguém, e é assim que ele parece na tela.
 *
 * Aqui cada resposta muda alguma coisa concreta:
 *
 * | Resposta            | O que muda                                        |
 * |---------------------|---------------------------------------------------|
 * | Local de treino     | Quais exercícios sequer entram na lista           |
 * | Dias por semana     | A divisão inteira (full body, upper/lower, PPL)   |
 * | Quais dias          | Onde cada treino cai na semana                    |
 * | Minutos por dia     | Quantos exercícios cabem em cada sessão           |
 * | Experiência         | Volume semanal por músculo                        |
 * | Dores               | Exercícios removidos, com substituto no lugar     |
 * | Preferência         | Ordem entre máquina e peso livre                  |
 * | Ênfase              | Séries extras no grupo escolhido, dentro do teto  |
 * | Objetivo            | Se entra cardio no fim da sessão                  |
 *
 * ── A base científica das constantes ─────────────────────────────────────
 *
 * · **Volume é o que mais importa.** O Position Stand do ACSM de 2026 (137
 *   revisões sistemáticas) coloca o volume semanal por músculo como o principal
 *   determinante de hipertrofia, com piso perto de 10 séries por semana.
 * · **Frequência mínima 2×.** O mesmo documento pede cada grupo pelo menos duas
 *   vezes por semana — é por isso que 3 dias vira full body aqui, e não o
 *   clássico "um músculo por dia", que entrega 1× por semana.
 * · **Contagem fracionada.** Série que trabalha o músculo indiretamente conta
 *   meia. Rosca direta não é a única coisa que treina bíceps: toda remada
 *   também treina, e ignorar isso infla o volume real do braço.
 * · **Teto útil.** Acima de ~20 séries semanais o ganho extra não paga o custo
 *   de recuperação. A ênfase respeita esse teto.
 *
 * ── Por que GÊNERO não aparece em lugar nenhum deste arquivo ─────────────
 *
 * O questionário coleta gênero, e ele é usado — mas em `tmb()`, para gasto
 * energético, não aqui. Volume, faixa de repetição, descanso e divisão saem
 * idênticos para qualquer gênero, e isso é decisão, não esquecimento.
 *
 * Não é uma afirmação sobre biologia: é ausência de base para prescrever
 * diferente. O ganho RELATIVO de massa é equivalente entre sexos (Refalo et al.,
 * PeerJ 2025;13:e19042 — meta-análise bayesiana, 29 estudos, N=2.815: diferença
 * de 0,69%, HDI 95% −1,50 a 2,88, cruzando zero). O número de repetições
 * possível num dado %1RM também é praticamente igual na faixa que se usa em
 * treino de força (Nuzzo et al., Sports Medicine 2023;53:2547-2557, 269 estudos,
 * N=7.289). E não existe nenhuma meta-análise de frequência estratificada por
 * sexo.
 *
 * O que existe de real e ainda NÃO vira código: há sinal de que mulheres
 * recuperam mais rápido entre séries. Mas nenhum estudo mediu de quantos
 * segundos elas precisam — os que compararam usaram descanso FIXO para os dois
 * grupos. Encurtar descanso feminino por analogia seria inventar um número.
 *
 * Reverter esta decisão exige ensaio mostrando dose semanal ótima diferente por
 * sexo — não apenas diferença de ganho absoluto, que existe e reflete ponto de
 * partida, não capacidade de resposta.
 */

export type Grupo =
  | 'peito' | 'costas' | 'ombro' | 'biceps' | 'triceps' | 'quadriceps'
  | 'posterior' | 'gluteo' | 'panturrilha' | 'abdomen' | 'trapezio' | 'antebraco';

/** Grupos pequenos: recebem volume indireto de todo composto e pedem menos série direta. */
const PEQUENOS: Grupo[] = ['biceps', 'triceps', 'panturrilha', 'abdomen', 'trapezio', 'antebraco'];

/** Piso do ACSM 2026. Nenhum grupo fica abaixo disso. */
export const PISO_SEMANAL = 10;
/** Acima disso o retorno não paga a recuperação. */
export const TETO_SEMANAL = 20;
/**
 * Teto de séries do mesmo grupo numa sessão.
 *
 * ── Por que 10 e não 6 ───────────────────────────────────────────────────
 *
 * Existe um teto de verdade: empilhar série demais no mesmo músculo numa
 * sessão rende cada vez menos, e o caminho melhor é distribuir na semana.
 *
 * Só que o valor 6 estava DERRUBANDO o alvo semanal em silêncio. A conta é
 * direta: um avançado com ênfase pede 20 séries na semana; numa divisão de 4
 * dias o grupo aparece 2 vezes; 2 × 6 = 12. Ele recebia 12 e o app achava que
 * tinha entregado 20 — 40% do volume sumia sem nenhum aviso, e volume semanal é
 * justamente o principal determinante de hipertrofia segundo o Position Stand
 * do ACSM de 2026. O teto anulava o modelo inteiro que ele deveria proteger.
 *
 * A perda atingia todo mundo de intermediário para cima em qualquer divisão de
 * 4, 5 ou 6 dias.
 *
 * Com 10, todas as combinações de experiência e ênfase cabem: o pior caso
 * (20 séries, grupo 2× na semana) fecha exatamente em 2 × 10. E quando a
 * frequência do grupo é maior, o cálculo entrega menos por sessão sozinho —
 * distribuir continua sendo o comportamento padrão, não a exceção.
 */
const TETO_SERIES_SESSAO = 10;

const VOLUME_POR_EXPERIENCIA: Record<string, number> = {
  iniciante: 10,
  intermediario: 14,
  avancado: 18,
};

interface ModeloDia {
  nome: string;
  cor: string;
  /** Ordem importa: o primeiro grupo abre a sessão, com o composto mais pesado. */
  grupos: Grupo[];
}

const COR = {
  empurrar: '#FF5A1F',
  puxar: '#3B9EFF',
  perna: '#00D68F',
  corpo: '#A97BFF',
  ombro: '#FFB020',
};

/**
 * Divisões por dia disponível.
 *
 * Nenhuma delas deixa um grupo grande com menos de 2 aparições na semana — é o
 * critério que elimina de saída o "segunda peito, terça costas, quarta perna"
 * que a academia ensina e que entrega 1× por semana em cada músculo.
 */
const SPLITS: Record<number, ModeloDia[]> = {
  1: [{ nome: 'Corpo todo', cor: COR.corpo, grupos: ['quadriceps', 'peito', 'costas', 'ombro', 'abdomen'] }],
  2: [
    { nome: 'A — Corpo todo', cor: COR.corpo, grupos: ['quadriceps', 'peito', 'costas', 'ombro', 'abdomen'] },
    { nome: 'B — Corpo todo', cor: COR.perna, grupos: ['posterior', 'costas', 'peito', 'gluteo', 'triceps', 'biceps'] },
  ],
  3: [
    { nome: 'A — Corpo todo, foco empurrar', cor: COR.empurrar, grupos: ['peito', 'quadriceps', 'costas', 'ombro', 'triceps', 'abdomen'] },
    { nome: 'B — Corpo todo, foco puxar', cor: COR.puxar, grupos: ['costas', 'posterior', 'peito', 'biceps', 'gluteo', 'abdomen'] },
    { nome: 'C — Corpo todo, foco perna', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'costas', 'ombro', 'panturrilha'] },
  ],
  4: [
    { nome: 'A — Superior', cor: COR.empurrar, grupos: ['peito', 'costas', 'ombro', 'triceps', 'biceps'] },
    { nome: 'B — Inferior', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha', 'abdomen'] },
    { nome: 'C — Superior', cor: COR.puxar, grupos: ['costas', 'peito', 'ombro', 'biceps', 'triceps'] },
    { nome: 'D — Inferior', cor: COR.perna, grupos: ['posterior', 'quadriceps', 'gluteo', 'panturrilha', 'abdomen'] },
  ],
  5: [
    { nome: 'A — Superior', cor: COR.empurrar, grupos: ['peito', 'costas', 'ombro', 'triceps', 'biceps'] },
    { nome: 'B — Inferior', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha'] },
    { nome: 'C — Empurrar', cor: COR.empurrar, grupos: ['peito', 'ombro', 'triceps'] },
    { nome: 'D — Puxar', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
    { nome: 'E — Pernas', cor: COR.perna, grupos: ['posterior', 'quadriceps', 'gluteo', 'panturrilha', 'abdomen'] },
  ],
  6: [
    { nome: 'A — Empurrar', cor: COR.empurrar, grupos: ['peito', 'ombro', 'triceps'] },
    { nome: 'B — Puxar', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
    { nome: 'C — Pernas', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha'] },
    { nome: 'D — Empurrar', cor: COR.ombro, grupos: ['ombro', 'peito', 'triceps', 'abdomen'] },
    { nome: 'E — Puxar', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
    { nome: 'F — Pernas', cor: COR.perna, grupos: ['posterior', 'quadriceps', 'gluteo', 'panturrilha', 'abdomen'] },
  ],
};

/**
 * Divisões quando a pessoa escolheu priorizar uma REGIÃO do corpo.
 *
 * ── O buraco que isto fecha ──────────────────────────────────────────────
 *
 * `SPLITS` é indexado só por número de dias. A ênfase mudava séries e ordem,
 * mas nunca a estrutura da semana — então quem marcava "superiores" e treinava
 * 5 dias recebia o mesmo esqueleto de sempre, com DOIS dias de perna. O app
 * perguntava o foco e depois montava a semana como se não tivesse perguntado.
 *
 * Priorizar uma região é, antes de tudo, dar mais DIAS a ela. Nenhuma
 * quantidade de série extra num dia de perna transforma o programa em foco de
 * superior se metade da semana continua sendo perna.
 *
 * O agrupamento aqui é por sinergista — peito com tríceps, costas com bíceps —
 * e não por "empurrar/puxar" genérico. A diferença aparece no descanso: com
 * peito e tríceps no mesmo dia, o tríceps só volta a ser exigido no próximo dia
 * de peito. Espalhado, ele leva estímulo em dias seguidos sem ninguém pedir.
 *
 * Perna 1× por semana fica ABAIXO das 2× que o ACSM pede. É escolha legítima de
 * quem prioriza superior, e o plano avisa uma vez em vez de decidir sozinho.
 */
const SPLITS_FOCO: Record<'superior' | 'inferior', Record<number, ModeloDia[]>> = {
  superior: {
    4: [
      { nome: 'A — Peito e tríceps', cor: COR.empurrar, grupos: ['peito', 'triceps', 'ombro'] },
      { nome: 'B — Costas e bíceps', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
      { nome: 'C — Inferior completo', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha'] },
      { nome: 'D — Ombro e braços', cor: COR.ombro, grupos: ['ombro', 'triceps', 'biceps', 'abdomen'] },
    ],
    5: [
      { nome: 'A — Peito e tríceps', cor: COR.empurrar, grupos: ['peito', 'triceps', 'ombro'] },
      { nome: 'B — Costas e bíceps', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
      { nome: 'C — Inferior completo', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha'] },
      { nome: 'D — Peito e tríceps', cor: COR.empurrar, grupos: ['peito', 'triceps', 'ombro', 'abdomen'] },
      { nome: 'E — Costas e bíceps', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
    ],
    6: [
      { nome: 'A — Peito e tríceps', cor: COR.empurrar, grupos: ['peito', 'triceps'] },
      { nome: 'B — Costas e bíceps', cor: COR.puxar, grupos: ['costas', 'biceps'] },
      { nome: 'C — Ombro e braços', cor: COR.ombro, grupos: ['ombro', 'triceps', 'biceps', 'trapezio'] },
      { nome: 'D — Inferior completo', cor: COR.perna, grupos: ['quadriceps', 'posterior', 'gluteo', 'panturrilha'] },
      { nome: 'E — Peito e tríceps', cor: COR.empurrar, grupos: ['peito', 'triceps', 'ombro'] },
      { nome: 'F — Costas e bíceps', cor: COR.puxar, grupos: ['costas', 'biceps', 'abdomen'] },
    ],
  },
  inferior: {
    4: [
      { nome: 'A — Inferior, foco quadríceps', cor: COR.perna, grupos: ['quadriceps', 'gluteo', 'panturrilha'] },
      { nome: 'B — Superior', cor: COR.empurrar, grupos: ['peito', 'costas', 'ombro', 'triceps', 'biceps'] },
      { nome: 'C — Inferior, foco posterior e glúteo', cor: COR.perna, grupos: ['gluteo', 'posterior', 'panturrilha', 'abdomen'] },
      { nome: 'D — Superior', cor: COR.puxar, grupos: ['costas', 'peito', 'ombro', 'biceps', 'triceps'] },
    ],
    5: [
      // Os dois dias de superior são COMPLETOS, não empurrar/puxar. Com apenas
      // dois dias para o corpo inteiro de cima, dividir em empurrar e puxar
      // deixava peito, costas e ombro em 1× por semana cada — todos abaixo do
      // mínimo, e não só a região preterida como um todo. Repetindo o superior
      // inteiro nos dois dias, os grupos grandes voltam para 2×.
      { nome: 'A — Inferior, foco quadríceps', cor: COR.perna, grupos: ['quadriceps', 'gluteo', 'panturrilha'] },
      { nome: 'B — Superior', cor: COR.empurrar, grupos: ['peito', 'costas', 'ombro', 'triceps'] },
      { nome: 'C — Inferior, foco posterior', cor: COR.perna, grupos: ['posterior', 'gluteo', 'panturrilha'] },
      { nome: 'D — Superior', cor: COR.puxar, grupos: ['costas', 'peito', 'ombro', 'biceps'] },
      { nome: 'E — Inferior, foco glúteo', cor: COR.perna, grupos: ['gluteo', 'quadriceps', 'posterior', 'abdomen'] },
    ],
    6: [
      { nome: 'A — Inferior, foco quadríceps', cor: COR.perna, grupos: ['quadriceps', 'gluteo', 'panturrilha'] },
      { nome: 'B — Superior, empurrar', cor: COR.empurrar, grupos: ['peito', 'ombro', 'triceps'] },
      { nome: 'C — Inferior, foco posterior', cor: COR.perna, grupos: ['posterior', 'gluteo', 'panturrilha'] },
      { nome: 'D — Superior, puxar', cor: COR.puxar, grupos: ['costas', 'biceps', 'trapezio'] },
      { nome: 'E — Inferior, foco glúteo', cor: COR.perna, grupos: ['gluteo', 'quadriceps', 'posterior'] },
      { nome: 'F — Superior', cor: COR.ombro, grupos: ['ombro', 'peito', 'costas', 'abdomen'] },
    ],
  },
};

/**
 * Qual região a pessoa priorizou — se é que priorizou uma.
 *
 * Aceita tanto a região inteira ('superiores') quanto músculo solto: quem marca
 * glúteo e posterior está pedindo foco em inferiores mesmo sem dizer a palavra.
 * Empate não é foco: marcar peito E glúteo pede um programa equilibrado, e
 * inventar uma preferência ali seria adivinhar.
 */
export function regiaoDoFoco(focos: string[]): 'superior' | 'inferior' | null {
  const alvos = gruposEnfatizados(focos);
  if (!alvos.size) return null;
  const conta = (r: 'superior' | 'inferior') => REGIOES[r].filter((g) => alvos.has(g)).length;
  const sup = conta('superior');
  const inf = conta('inferior');
  if (sup === inf) return null;
  return sup > inf ? 'superior' : 'inferior';
}

/**
 * A divisão da semana, já considerando o foco.
 *
 * Até 3 dias não existe versão com foco: a exigência de 2× por grupo por semana
 * come toda a folga, e qualquer priorização deixaria algum grupo grande em 1×.
 * Aí corpo todo continua sendo a resposta certa, tenha foco ou não.
 */
function escolherSplit(dias: number, focos: string[]): ModeloDia[] {
  const d = Math.max(1, Math.min(6, dias));
  const regiao = regiaoDoFoco(focos);
  return (regiao && SPLITS_FOCO[regiao][d]) || SPLITS[d];
}

export function divisaoDe(dias: number): { nome: string; porque: string } {
  const d = Math.max(1, Math.min(6, dias));
  if (d <= 2)
    return {
      nome: 'Corpo todo',
      porque:
        `Com ${d} dia${d > 1 ? 's' : ''}, corpo todo em cada sessão é o máximo que dá. Peito e costas ` +
        `ficam 2× na semana; ombro, perna e posterior ficam 1×, e isso é o teto do que ${d} dia` +
        `${d > 1 ? 's permitem' : ' permite'} — não um erro do plano. Um terceiro dia muda esse quadro mais ` +
        `que qualquer outro ajuste.`,
    };
  if (d === 3)
    return {
      nome: 'Corpo todo, com foco diferente por dia',
      porque:
        'Três dias de corpo todo colocam todo grupo grande 2× ou 3× na semana. A alternativa ' +
        'clássica — um músculo por dia — daria 1×, abaixo do mínimo que o ACSM 2026 recomenda.',
    };
  if (d === 4)
    return {
      nome: 'Superior / Inferior',
      porque: 'Duas sessões de tronco e duas de perna: cada grupo 2× na semana, com 72 h de folga entre elas.',
    };
  if (d === 5)
    return {
      nome: 'Superior / Inferior + Empurrar / Puxar / Pernas',
      porque: 'Cinco dias permitem volume alto mantendo todo grupo 2× na semana.',
    };
  return {
    nome: 'Empurrar / Puxar / Pernas, 2× na semana',
    porque: 'Seis dias só rendem com sono e comida em dia — o volume é alto e a recuperação vira o gargalo.',
  };
}

// ── Entrada ───────────────────────────────────────────────────────────────

export interface PerfilDoTreino {
  dias: number;
  /** Índices de dia da semana escolhidos. Vazio = o app espalha sozinho. */
  diasDisponiveis: number[];
  /** Minutos por dia da semana, índice 0 = domingo. */
  minutosPorDia: number[];
  experiencia: string;
  objetivo: string;
  local: string;
  preferenciaEquipamento: string;
  /** Regiões com dor: os exercícios de risco saem da lista. */
  dores: string[];
  /**
   * O que a pessoa quer priorizar. Regiões ('inferior', 'superior') e músculos
   * podem ser combinados — o orçamento de séries é repartido entre eles.
   */
  focos: string[];
}

interface ExercicioCat {
  id: number;
  nome: string;
  grupo_primario: string;
  grupos_secundarios: string;
  equipamento: string | null;
  tipo_carga: string;
}

export interface DiaGerado {
  nome: string;
  cor: string;
  diaSemana: number | null;
  minutos: number;
  exercicios: {
    id: number;
    nome: string;
    grupo: string;
    /** Grupos que o exercício trabalha indiretamente. Cada série vale 0,5 neles. */
    secundarios: string[];
    series: number;
    repsMin: number;
    repsMax: number;
    descanso: number;
  }[];
}

export interface Plano {
  divisao: string;
  porque: string;
  dias: DiaGerado[];
  /** Séries semanais por grupo, com contagem fracionada. */
  volumeSemanal: Record<string, number>;
  avisos: string[];
}

// ── Volume ────────────────────────────────────────────────────────────────

/**
 * Ênfase por REGIÃO do corpo, não por músculo solto.
 *
 * ── Por que existe ───────────────────────────────────────────────────────
 *
 * O padrão é real e todo mundo que trabalha com academia conhece: mulher
 * costuma querer glúteo e perna, homem costuma querer peito, ombro e braço.
 *
 * Mas isso é **objetivo estético**, não fisiologia — e a diferença importa na
 * hora de escrever o código. Se o app deduzisse a ênfase do gênero, ele erraria
 * com a mulher que quer costas e com o homem que quer perna, e os dois existem.
 * O corpo responde ao estímulo do mesmo jeito nos dois casos; o que muda é onde
 * a pessoa quer o resultado. Então o app PERGUNTA em vez de deduzir.
 *
 * Ênfase de músculo único não resolvia: quem quer "inferiores" quer glúteo,
 * posterior, quadríceps e panturrilha juntos, não só um deles.
 */
export const REGIOES: Record<string, Grupo[]> = {
  inferior: ['gluteo', 'quadriceps', 'posterior', 'panturrilha'],
  superior: ['peito', 'costas', 'ombro', 'biceps', 'triceps'],
};

/**
 * Orçamento de séries semanais que a ênfase pode movimentar.
 *
 * ── Por que orçamento, e não bônus por foco ──────────────────────────────
 *
 * O foco é múltipla escolha, e aí aparece o problema óbvio: se cada foco
 * somasse 4 séries, marcar cinco focos somaria 20 séries na semana. O treino
 * não ficaria focado — ficaria só maior, e o corte por tempo desfaria tudo logo
 * depois, tirando exatamente os acessórios que a pessoa acabou de pedir.
 *
 * **Marcar tudo é não marcar nada.** Então o que existe é um orçamento fixo,
 * repartido entre os grupos escolhidos: um foco recebe o bônus inteiro, cinco
 * focos recebem um pedaço cada. É o mesmo dinheiro dividido de outro jeito, e
 * é isso que "prioridade" significa.
 *
 * O que sai daqui é tirado de quem não foi escolhido — nunca abaixo do piso em
 * que o músculo ainda responde, e nunca derrubando a frequência de 2× por
 * semana. Foco não é abandono.
 */
const ORCAMENTO_ENFASE = 16;
/** Nenhum grupo isolado ganha mais que isto, mesmo com um foco só. */
const BONUS_MAXIMO = 4;
/** Nenhum grupo preterido perde mais que isto. */
const DESCONTO_MAXIMO = 3;

/** Expande os focos escolhidos (regiões e músculos) na lista de grupos. */
export function gruposEnfatizados(focos: string[]): Set<string> {
  const out = new Set<string>();
  for (const f of focos) {
    const regiao = REGIOES[f];
    if (regiao) regiao.forEach((g) => out.add(g));
    else if (f) out.add(f);
  }
  return out;
}

/**
 * Quanto cada grupo enfatizado ganha e quanto cada preterido perde.
 *
 * O desconto acompanha o bônus: se pouca gente foi escolhida, cada escolhido
 * ganha muito e cada preterido cede pouco (são muitos dividindo a conta). Com
 * meio corpo escolhido, a troca fica próxima de um para um.
 */
function pesosDaEnfase(focos: string[]): { alvos: Set<string>; bonus: number; desconto: number } {
  const alvos = gruposEnfatizados(focos);
  if (!alvos.size) return { alvos, bonus: 0, desconto: 0 };

  const bonus = Math.max(1, Math.min(BONUS_MAXIMO, Math.round(ORCAMENTO_ENFASE / alvos.size)));

  const TODOS: Grupo[] = [
    'peito', 'costas', 'ombro', 'biceps', 'triceps',
    'quadriceps', 'posterior', 'gluteo', 'panturrilha',
  ];
  const preteridos = TODOS.filter((g) => !alvos.has(g)).length;

  // Priorizar o corpo inteiro é não priorizar nada, e isso precisa ser
  // literalmente verdade no código. Sem ninguém para ceder volume, dar bônus a
  // todo mundo não cria foco — só infla o programa: marcar "inferiores" E
  // "superiores" levava o total semanal de 108 para 126 séries, com o corte por
  // tempo desfazendo a diferença logo depois. Aqui a escolha simplesmente não
  // produz efeito, que é o resultado honesto.
  if (!preteridos) return { alvos: new Set<string>(), bonus: 0, desconto: 0 };

  const desconto = Math.max(
    1,
    Math.min(DESCONTO_MAXIMO, Math.round((bonus * alvos.size) / preteridos))
  );

  return { alvos, bonus, desconto };
}

/**
 * Põe na frente da sessão o que a pessoa marcou como foco.
 *
 * Até aqui a ênfase só mexia em VOLUME — o grupo priorizado ganhava série, mas
 * continuava na posição que o modelo do dia definiu. Quem marcava glúteo num
 * split de 4 dias fazia glúteo em terceiro, depois de quadríceps e posterior
 * terem gasto a perna inteira. Sobra série e falta força para executá-la, que é
 * o pior dos dois mundos: o volume aparece no papel e não vira estímulo.
 *
 * A ressalva é o grupo pequeno. Priorizar bíceps não pode significar rosca
 * antes de toda remada: o composto pesado é onde o próprio bíceps recebe a
 * maior parte do estímulo, e chegar nele com o braço pronto derruba a carga de
 * tudo que vem depois. Então grupo pequeno sobe, mas atrás do primeiro composto
 * grande do dia.
 */
function priorizarNoDia(grupos: Grupo[], alvos: Set<string>): Grupo[] {
  const enfatizados = grupos.filter((g) => alvos.has(g));
  const resto = grupos.filter((g) => !alvos.has(g));
  // Sem foco, ou com o dia inteiro em foco, a ordem do modelo já é a certa.
  if (!enfatizados.length || !resto.length) return grupos;

  const grandes = enfatizados.filter((g) => !PEQUENOS.includes(g));
  const pequenos = enfatizados.filter((g) => PEQUENOS.includes(g));
  if (grandes.length) return [...grandes, ...pequenos, ...resto];

  return [resto[0], ...pequenos, ...resto.slice(1)];
}

function alvoSemanal(grupo: Grupo, p: PerfilDoTreino): number {
  const base = VOLUME_POR_EXPERIENCIA[p.experiencia] ?? PISO_SEMANAL;
  // Grupo pequeno recebe volume indireto de todo composto: a série direta pesa
  // menos e o alvo direto é menor de propósito.
  const pequeno = PEQUENOS.includes(grupo);
  let alvo = pequeno ? Math.round(base * 0.6) : base;

  const { alvos, bonus, desconto } = pesosDaEnfase(p.focos);
  if (alvos.size) {
    // Abdômen fica de fora da conta de troca: quase todo mundo quer, ele quase
    // não cobra recuperação, e descontá-lo por não ter sido marcado só produz
    // reclamação sem ganho nenhum.
    if (alvos.has(grupo)) alvo += bonus;
    else if (grupo !== 'abdomen' && grupo !== 'trapezio' && grupo !== 'antebraco') {
      alvo = Math.max(pequeno ? 6 : PISO_SEMANAL, alvo - desconto);
    }
  }

  return Math.max(6, Math.min(TETO_SEMANAL, alvo));
}

/** Faixa de repetição pelo papel do exercício na sessão. */
function repsDe(nome: string, grupo: string, experiencia: string): [number, number] {
  if (grupo === 'panturrilha') return [12, 20];
  if (grupo === 'abdomen') return [12, 20];
  if (ehPesado(nome)) return experiencia === 'iniciante' ? [8, 12] : [5, 8];
  if (ehComposto(nome)) return [8, 12];
  return [10, 15];
}

// ── Seleção de exercícios ─────────────────────────────────────────────────

function evitarPorDor(dores: string[]): Set<string> {
  const fora = new Set<string>();
  for (const r of dores) {
    for (const nome of REGIOES_DOR.find((x) => x.chave === r)?.evitar ?? []) fora.add(nome);
  }
  return fora;
}

/**
 * Ordena os candidatos de um grupo.
 *
 * Composto primeiro sempre — é o que abre a sessão e o que mais constrói. A
 * preferência por máquina ou peso livre só desempata dentro do mesmo tipo:
 * Haugen 2023 (13 estudos, 1.016 pessoas) não achou diferença de hipertrofia
 * entre os dois (SMD −0,055; p = 0,75), então isso é gosto, e gosto é o que faz
 * alguém continuar aparecendo.
 */
function ordenar(cands: ExercicioCat[], preferencia: string): ExercicioCat[] {
  const peso = (e: ExercicioCat) => {
    if (preferencia === 'maquina') return e.equipamento === 'maquina' || e.equipamento === 'cabo' ? 0 : 1;
    if (preferencia === 'livre') return e.equipamento === 'barra' || e.equipamento === 'halter' || e.equipamento === 'livre' ? 0 : 1;
    return 0;
  };
  return [...cands].sort((a, b) => {
    const ca = ehPesado(a.nome) ? 0 : ehComposto(a.nome) ? 1 : 2;
    const cb = ehPesado(b.nome) ? 0 : ehComposto(b.nome) ? 1 : 2;
    if (ca !== cb) return ca - cb;
    return peso(a) - peso(b);
  });
}

/** Quantos exercícios distintos para um número de séries. */
/** Gira a lista n posições. Usado no rodízio de acessórios entre os dias. */
function rodar<T>(lista: T[], n: number): T[] {
  if (lista.length < 2) return lista;
  const k = n % lista.length;
  return [...lista.slice(k), ...lista.slice(0, k)];
}

function quantosExercicios(series: number): number {
  if (series <= 4) return 1;
  if (series <= 8) return 2;
  return 3;
}

// ── Montagem ──────────────────────────────────────────────────────────────

/**
 * O catálogo pode vir de fora.
 *
 * Isto existe só para teste: é a única dependência do gerador que precisa de
 * banco, e sem uma porta de entrada a inteligência central do app só poderia
 * ser verificada abrindo o app e olhando. `scripts/testar-gerador.mjs` entra
 * por aqui com o catálogo lido direto do seed e confere as regras que não dá
 * para ver no olho — ordem, volume por grupo e cobertura por local.
 */
export async function montarPlano(
  p: PerfilDoTreino,
  fonte?: { catalogo: ExercicioCat[]; cardio: ExercicioCat[] }
): Promise<Plano> {
  const catalogo =
    fonte?.catalogo ??
    (await (await banco()).all<ExercicioCat>(
      `SELECT id, nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga
         FROM exercises WHERE grupo_primario <> 'cardio'`
    ));
  const cardio =
    fonte?.cardio ??
    (await (await banco()).all<ExercicioCat>(
      `SELECT id, nome, grupo_primario, grupos_secundarios, equipamento, tipo_carga
         FROM exercises WHERE grupo_primario = 'cardio'`
    ));

  const equipamentos = new Set(equipamentosDe(p.local));
  const proibidos = evitarPorDor(p.dores);
  const avisos: string[] = [];

  const disponiveis = catalogo.filter(
    (e) => (!e.equipamento || equipamentos.has(e.equipamento)) && !proibidos.has(e.nome)
  );

  const modelo = escolherSplit(p.dias, p.focos);
  const aparicoes: Record<string, number> = {};
  for (const d of modelo) for (const g of d.grupos) aparicoes[g] = (aparicoes[g] ?? 0) + 1;

  // Priorizar uma região custa frequência na outra, e esse custo tem que estar
  // escrito. O ACSM pede 2× por semana em cada grupo; quem escolhe foco pesado
  // aceita ficar em 1× do outro lado. É escolha legítima — só não pode ser
  // surpresa em cima de quem esperava o padrão.
  const preterida = regiaoDoFoco(p.focos) === 'superior' ? 'inferior' : 'superior';
  if (regiaoDoFoco(p.focos)) {
    // Só grupo GRANDE conta aqui. Bíceps e tríceps em 1× direto não são um
    // problema de frequência: toda remada e todo supino da semana os treinam
    // junto, e avisar sobre eles transformava um alerta real ("sua perna caiu
    // para 1×") em ruído que aparecia em todo plano com foco.
    const umaVezSo = REGIOES[preterida]
      .filter((g) => !PEQUENOS.includes(g))
      .filter((g) => (aparicoes[g] ?? 0) === 1);
    if (umaVezSo.length >= 2) {
      avisos.push(
        `Seu foco é ${preterida === 'inferior' ? 'superiores' : 'inferiores'}, então ` +
          `${preterida === 'inferior' ? 'perna' : 'o superior'} entra 1× por semana. O padrão da ` +
          `literatura é 2× por grupo — em 1× o ganho fica menor, mas não é erro: é o preço de ` +
          `concentrar a semana no que você escolheu. Para voltar a 2×, tire o foco ou some um dia.`
      );
    }
  }

  const { alvos: emFoco } = pesosDaEnfase(p.focos);

  const dias: DiaGerado[] = [];
  const usadosNoDia = new Set<string>();
  /** Quantas vezes cada grupo já foi montado. Alimenta o rodízio entre dias. */
  const vezesDoGrupo: Record<string, number> = {};

  for (const md of modelo) {
    usadosNoDia.clear();
    const exercicios: DiaGerado['exercicios'] = [];

    for (const grupo of priorizarNoDia(md.grupos, emFoco)) {
      const alvo = alvoSemanal(grupo, p);
      // Arredonda para CIMA: com 10 séries semanais em 3 aparições, arredondar
      // para baixo dá 3 por sessão e entrega 9 — ficar um pouco acima do alvo
      // custa menos que ficar cronicamente abaixo dele.
      const naSessao = Math.max(2, Math.min(TETO_SERIES_SESSAO, Math.ceil(alvo / aparicoes[grupo])));

      const ordenados = ordenar(
        disponiveis.filter((e) => e.grupo_primario === grupo && !usadosNoDia.has(e.nome)),
        p.preferenciaEquipamento
      );

      // Rodízio a partir do SEGUNDO exercício.
      //
      // O primeiro fica fixo na semana inteira de propósito: é o composto
      // principal do grupo, e é comparando a carga dele semana a semana que se
      // enxerga progresso. Trocar tudo todo dia deixa o treino bonito e a
      // progressão invisível.
      //
      // Do segundo em diante, roda. Sem isso, quem tinha glúteo em três dias
      // recebia elevação pélvica e abdução nos três — com dez opções de glúteo
      // no catálogo, e justamente no grupo que ela escolheu priorizar.
      const vez = vezesDoGrupo[grupo] ?? 0;
      vezesDoGrupo[grupo] = vez + 1;
      const cands =
        ordenados.length > 2 && vez > 0
          ? [ordenados[0], ...rodar(ordenados.slice(1), vez)]
          : ordenados;

      if (!cands.length) {
        avisos.push(
          `Sem exercício de ${grupo} disponível para "${p.local}". Esse grupo ficou de fora — vale ` +
            `rever o local de treino ou acrescentar um exercício manualmente.`
        );
        continue;
      }

      // Nunca mais exercícios do que dá para dar 2 séries em cada: exercício de
      // série única é presença, não estímulo.
      const quantos = Math.max(
        1,
        Math.min(quantosExercicios(naSessao), cands.length, Math.floor(naSessao / 2))
      );
      // O RESTO é distribuído, não descartado. Antes: floor(7/2) = 3, vezes 2 =
      // 6 — uma série a menos por sessão, toda semana, três linhas abaixo do
      // comentário que promete arredondar para cima para não ficar abaixo do alvo.
      const base = Math.floor(naSessao / quantos);
      const resto = naSessao % quantos;

      for (let i = 0; i < quantos; i++) {
        const e = cands[i];
        const porExercicio = base + (i < resto ? 1 : 0);
        usadosNoDia.add(e.nome);
        const [rmin, rmax] = repsDe(e.nome, grupo, p.experiencia);
        exercicios.push({
          id: e.id,
          nome: e.nome,
          grupo,
          secundarios: e.grupos_secundarios.split(',').map((x) => x.trim()).filter(Boolean),
          series: porExercicio,
          repsMin: e.tipo_carga === 'tempo' ? 0 : rmin,
          repsMax: e.tipo_carga === 'tempo' ? 0 : rmax,
          descanso: descansoCorreto(e.nome, rmax, grupo),
        });
      }
    }

    // Cardio no fim, só quando o objetivo pede. Antes da musculação derrubaria
    // a força do treino inteiro; depois, não atrapalha a hipertrofia.
    if ((p.objetivo === 'emagrecimento' || p.objetivo === 'recomposicao') && cardio.length) {
      const c = cardio.find((x) => !x.equipamento || equipamentos.has(x.equipamento)) ?? cardio[0];
      // Duração de verdade, em segundos. Antes ia com 0 e a pessoa recebia
      // "Esteira" no fim do treino sem um único número — e o estimador de
      // duração da sessão também trabalhava com um bloco sem duração declarada.
      const minutosCardio = p.objetivo === 'emagrecimento' ? 30 : 20;
      exercicios.push({
        id: c.id,
        nome: c.nome,
        grupo: 'cardio',
        secundarios: [],
        series: 1,
        repsMin: minutosCardio * 60,
        repsMax: minutosCardio * 60,
        descanso: 0,
      });
    }

    dias.push({ nome: md.nome, cor: md.cor, diaSemana: null, minutos: 0, exercicios });
  }

  // ── Encaixar na semana e no tempo de cada dia ────────────────────────────
  distribuirNaSemana(dias, p, avisos);

  // A ORDEM aqui é o conserto. Aparar o excesso ANTES de cortar por tempo
  // resolve dois problemas de uma vez: o grupo que estava 13 séries acima do
  // alvo volta ao alvo, e os minutos que ele devolve são exatamente os que
  // evitam que o corte por tempo coma os acessórios do fim da sessão.
  aparExcesso(dias, p);
  avisarExcessoIndireto(dias, p, avisos);

  // Piso por grupo: 70% do alvo. Abaixo disso o estímulo daquele músculo deixa
  // de valer a pena, e é preferível a sessão passar um pouco do tempo.
  const volumeAtual = contarVolume(dias);
  const pisos: Record<string, number> = {};
  for (const g of Object.keys(volumeAtual)) pisos[g] = alvoSemanal(g as Grupo, p) * 0.7;

  for (const d of dias) {
    const minutos = d.diaSemana !== null ? (p.minutosPorDia[d.diaSemana] ?? 60) : 60;
    cortarParaCaber(d, minutos, avisos, volumeAtual, pisos, p.objetivo);
  }

  // Nesta ordem: primeiro junta o volume picado (menos exercícios, mais séries
  // em cada), depois usa o tempo que sobrou. Ao contrário, encheria de série um
  // exercício que ia sair de qualquer jeito.
  consolidar(dias);
  preencherTempo(dias, p, avisos);

  for (const d of dias) d.minutos = emMinutos(estimarDuracao(paraEstimativa(d)).totalSeg);

  const limite = limitacaoDoLocal(p.local);
  if (limite) avisos.push(limite);

  return {
    divisao: divisaoDe(p.dias).nome,
    porque: divisaoDe(p.dias).porque,
    dias,
    volumeSemanal: contarVolume(dias),
    avisos,
  };
}

/** Adapta o dia gerado ao formato que o estimador de duração espera. */
function paraEstimativa(d: DiaGerado) {
  return d.exercicios.map((e, i) => ({
    id: i,
    nome: e.nome,
    grupo_primario: e.grupo,
    series_alvo: e.series,
    reps_min: e.repsMin,
    reps_max: e.repsMax,
    descanso_seg: e.descanso,
    // Pelo GRUPO, não pelo valor de reps. Com o cardio ganhando duração real em
    // segundos, o teste antigo (`repsMin === 0`) passava a classificá-lo como
    // peso+reps e multiplicava 1200 s por 3 — uma sessão de 20 min virava 60.
    tipo_carga: e.grupo === 'cardio' ? 'tempo' : 'peso_reps',
  })) as never;
}

/**
 * Tira exercício até o treino caber no tempo daquele dia.
 *
 * Sempre de trás para frente e nunca o primeiro do dia: o que abre a sessão é o
 * composto pesado, que é onde está o corpo inteiro e o maior estímulo. Quem
 * corta pelo começo troca o treino pelo aquecimento.
 */
function cortarParaCaber(
  d: DiaGerado,
  minutos: number,
  avisos: string[],
  volumeAtual: Record<string, number>,
  pisos: Record<string, number>,
  objetivo: string
) {
  const limite = minutos * 60;
  let cortados = 0;
  const abaixoDoPiso: string[] = [];

  // ── O cardio sai PRIMEIRO quando o objetivo é músculo ────────────────────
  //
  // Antes ele era intocável por acidente: `contarVolume` ignora cardio, então o
  // teste de piso comparava -1 com 0, dava falso, e o laço pulava o cardio para
  // ir comer os acessórios de musculação. Com o cardio passando a declarar seus
  // 20 minutos de verdade, esse acidente virou estrago — numa sessão de 60 min
  // ele engolia um terço do orçamento e derrubava o peito de 14 para 9 séries.
  //
  // Em recomposição e hipertrofia quem carrega o resultado é o estímulo
  // resistido: se não cabe tudo, o cardio é o primeiro a sair, e ele pode ser
  // feito em outro horário sem prejuízo. Em emagrecimento puro a prioridade é a
  // do usuário, não a minha — ali o aeróbio fica e a musculação é que cede.
  const cardioCedeAntes = objetivo !== 'emagrecimento';
  if (cardioCedeAntes && estimarDuracao(paraEstimativa(d)).totalSeg > limite) {
    const i = d.exercicios.findIndex((e) => e.grupo === 'cardio');
    if (i >= 0) {
      d.exercicios.splice(i, 1);
      avisos.push(
        `${d.nome}: o cardio saiu da sessão para o treino de força caber em ${minutos} min. ` +
          `Ele rende igual feito em outro horário — o que não dá é perder série de musculação por ele.`
      );
    }
  }

  while (d.exercicios.length > 3 && estimarDuracao(paraEstimativa(d)).totalSeg > limite) {
    // Primeiro tenta tirar do grupo que ainda fica no alvo sem este exercício.
    // Cortar sempre do fim parece justo e não é: o fim da sessão é SEMPRE o
    // mesmo grupo, então bíceps e trapézio não perdiam volume de vez em quando
    // — perdiam toda semana, e a auditoria mostrava 3 séries num alvo de 8.
    let alvo = -1;
    for (let i = d.exercicios.length - 1; i > 0; i--) {
      const e = d.exercicios[i];
      if (ehPesado(e.nome)) continue;
      if ((volumeAtual[e.grupo] ?? 0) - e.series >= (pisos[e.grupo] ?? 0)) {
        alvo = i;
        break;
      }
    }

    // Nenhum candidato sobra sem derrubar algum grupo abaixo do piso: aí vale
    // mais tirar o último acessório do que estourar o tempo da pessoa, porque
    // treino que não cabe não é feito.
    if (alvo < 0) {
      for (let i = d.exercicios.length - 1; i > 0; i--) {
        if (!ehPesado(d.exercicios[i].nome)) {
          alvo = i;
          break;
        }
      }
    }
    if (alvo < 0) break;

    const removido = d.exercicios[alvo];
    const antes = volumeAtual[removido.grupo] ?? 0;
    const depois = antes - removido.series;
    volumeAtual[removido.grupo] = depois;

    // Aviso NOMINAL. "3 exercícios a menos para caber em 50 min" não diz à
    // pessoa que o peito dela caiu de 12 para 6 séries semanais — e é
    // exatamente essa informação que faz alguém decidir arrumar mais 10 min.
    const piso = pisos[removido.grupo] ?? 0;
    if (antes >= piso && depois < piso) {
      abaixoDoPiso.push(removido.grupo);
    }

    d.exercicios.splice(alvo, 1);
    cortados++;
  }

  if (cortados) {
    avisos.push(
      `${d.nome}: ${cortados} exercício${cortados > 1 ? 's' : ''} a menos para caber em ${minutos} min. ` +
        `Saíram os acessórios do fim — os compostos, que são o que constrói, ficaram todos.`
    );
  }

  if (abaixoDoPiso.length) {
    const nomes = [...new Set(abaixoDoPiso)].join(', ');
    avisos.push(
      `Para caber em ${minutos} min, ${nomes} ficou abaixo do mínimo semanal. ` +
        `Dez minutos a mais neste dia, ou um dia a mais na semana, resolvem — o volume semanal é o ` +
        `que mais decide o resultado, e é justamente ele que está sendo sacrificado aqui.`
    );
  }
}

/**
 * Volume semanal com contagem fracionada.
 *
 * Série que trabalha o grupo como secundário conta meia. Sem isso, remada não
 * conta nada para o bíceps e agachamento não conta nada para o glúteo — e o app
 * acredita que entregou o alvo quando na verdade entregou quase o dobro.
 *
 * É a MESMA conta que a tela de auditoria de volume faz. Antes elas divergiam:
 * o gerador somava só série direta e a auditoria somava direta + 0,5 × indireta,
 * então o gerador prescrevia 14 séries de glúteo achando que estava no alvo
 * enquanto a auditoria, corretamente, mostrava 27. Duas contas diferentes para a
 * mesma grandeza é como um app mente para si mesmo.
 */
function contarVolume(dias: DiaGerado[]): Record<string, number> {
  const out: Record<string, number> = {};
  const somar = (g: string, v: number) => {
    if (!g || g === 'cardio') return;
    out[g] = (out[g] ?? 0) + v;
  };
  for (const d of dias) {
    for (const e of d.exercicios) {
      if (e.grupo === 'cardio') continue;
      somar(e.grupo, e.series);
      for (const s of e.secundarios) somar(s, e.series * 0.5);
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}

/**
 * Devolve ao alvo o grupo que passou dele.
 *
 * Quem estoura o alvo não é o isolador que a gente escolheu — é o volume
 * indireto: agachamento e terra despejam meia série de glúteo e posterior cada,
 * e em duas sessões de perna isso vira mais de dez séries que ninguém pediu.
 * Séries que não foram prescritas custam recuperação e tempo iguais às que
 * foram.
 *
 * Tira uma série por vez do exercício DIRETO mais carregado do grupo, e nunca
 * abaixo de 2 séries — um exercício de série única não é estímulo, é presença.
 * Não mexe em volume indireto, porque ele é consequência de um composto que está
 * ali por outro motivo.
 */
function aparExcesso(dias: DiaGerado[], p: PerfilDoTreino) {
  // No grupo que a pessoa priorizou, o excesso é medido só pelo trabalho
  // DIRETO.
  //
  // A contagem fracionada é honesta para auditar, mas usá-la como teto do que
  // prescrever punia exatamente quem tinha sido escolhido: agachamento e stiff
  // despejam meia série de glúteo cada, o total estourava, e o aparador cortava
  // o trabalho direto até sobrar UM exercício de glúteo — num programa com foco
  // em glúteo, e com dez opções no catálogo.
  //
  // Volume indireto não substitui o direto. Agachamento carrega o glúteo com o
  // quadril fletido; elevação pélvica carrega no fim da extensão. São estímulos
  // em comprimentos musculares diferentes, e é por isso que quem quer glúteo faz
  // as duas coisas. Tratar um como se pagasse o outro é o erro que transforma
  // "priorizar" em "prescrever menos".
  const emFoco = pesosDaEnfase(p.focos).alvos;
  // Teto de voltas: só uma rede de segurança contra laço infinito — a saída de
  // verdade é `!cortou`, quando não sobra série direta para tirar.
  //
  // Era 60, e ficava curto exatamente no caso que mais precisa dele: cada volta
  // corta UMA série, e num avançado de 6 dias vários grupos estouram ao mesmo
  // tempo. O aparador chegava ao limite no meio do serviço e o plano saía com
  // 31 séries semanais de ombro — 70% acima do alvo, no grupo que mais se
  // lesiona. Como o laço termina sozinho, o número só precisa ser grande.
  for (let volta = 0; volta < 500; volta++) {
    const vol = contarVolume(dias);

    // Todos os grupos acima do alvo, do mais estourado para o menos. Percorrer
    // a lista inteira importa: quando o excesso do pior grupo vem só de volume
    // indireto não há série direta para tirar, e parar ali deixaria os outros
    // grupos estourados para sempre.
    const direto: Record<string, number> = {};
    for (const d of dias)
      for (const e of d.exercicios) direto[e.grupo] = (direto[e.grupo] ?? 0) + e.series;

    const estourados = Object.entries(vol)
      .map(([g, v]) => ({
        g,
        excesso: (emFoco.has(g) ? (direto[g] ?? 0) : v) - alvoSemanal(g as Grupo, p),
      }))
      .filter((x) => x.excesso >= 1)
      .sort((a, b) => b.excesso - a.excesso);

    if (!estourados.length) return;

    let cortou = false;
    for (const { g } of estourados) {
      let alvoEx: DiaGerado['exercicios'][number] | null = null;
      for (const d of dias) {
        for (const e of d.exercicios) {
          if (e.grupo !== g || e.series <= 2) continue;
          if (!alvoEx || e.series > alvoEx.series) alvoEx = e;
        }
      }
      if (alvoEx) {
        alvoEx.series -= 1;
        cortou = true;
        break;
      }
    }

    // Nenhum grupo estourado tem série direta para tirar: o excesso é todo
    // indireto e não há o que fazer sem mexer nos compostos.
    if (!cortou) return;
  }
}

/**
 * Junta o volume picado: menos exercícios, mais séries em cada.
 *
 * O aparador corta série direta até o piso de 2 por exercício, e o resultado
 * era uma sessão de OITO exercícios com duas séries cada. Isso é o pior formato
 * possível para o mesmo volume: duas séries mal aquecem o movimento, a primeira
 * quase sempre é reconhecimento de carga, e cada troca de aparelho custa 90 s
 * de nada. Três exercícios de peito com 2 séries rendem menos que dois com 3.
 *
 * Aqui o total de séries do grupo no dia não muda — muda em quantas peças ele
 * está dividido. Sai exercício do fim (o menos prioritário) e as séries dele
 * voltam para quem ficou, até cada um ter ao menos 3.
 */
function consolidar(dias: DiaGerado[]) {
  const MIN_SERIES = 3;
  for (const d of dias) {
    const grupos = [...new Set(d.exercicios.filter((e) => e.grupo !== 'cardio').map((e) => e.grupo))];
    for (const g of grupos) {
      const doGrupo = d.exercicios.filter((e) => e.grupo === g);
      const total = doGrupo.reduce((s, e) => s + e.series, 0);
      const cabem = Math.max(1, Math.min(doGrupo.length, Math.floor(total / MIN_SERIES)));
      if (cabem >= doGrupo.length) continue;

      // Os que ficam são os primeiros: a ordem já reflete prioridade.
      const ficam = doGrupo.slice(0, cabem);
      const saem = new Set(doGrupo.slice(cabem).map((e) => e.nome));
      d.exercicios = d.exercicios.filter((e) => !(e.grupo === g && saem.has(e.nome)));

      const base = Math.floor(total / ficam.length);
      const resto = total % ficam.length;
      ficam.forEach((e, i) => {
        e.series = Math.min(TETO_SERIES_SESSAO, base + (i < resto ? 1 : 0));
      });
    }
  }
}

/**
 * Usa o tempo que sobrou — sem estourar o que a recuperação aguenta.
 *
 * O tempo informado no questionário era só um TETO: o gerador cortava quando
 * passava e nunca reagia quando sobrava. Quem dizia ter 1h30 recebia sessões de
 * 44 minutos e 208 minutos ociosos na semana, sem uma linha explicando por quê.
 *
 * A ordem de uso não é "encher por encher". Série a mais só entra em grupo que
 * ainda está ABAIXO do alvo semanal — volume acima do teto custa recuperação e
 * não paga em hipertrofia, e seria trocar um erro por outro. Quando todo grupo
 * do dia já está no alvo, o tempo sobra mesmo, e aí o plano diz isso: o limite
 * passou a ser a recuperação, não a agenda.
 */
function preencherTempo(dias: DiaGerado[], p: PerfilDoTreino, avisos: string[]) {
  const FOLGA_ACEITAVEL = 8 * 60; // menos que isso não vale mexer
  let algumDiaSobrando = false;

  for (const d of dias) {
    const disponivel = (d.diaSemana !== null ? p.minutosPorDia[d.diaSemana] ?? 60 : 60) * 60;

    for (let volta = 0; volta < 40; volta++) {
      const usado = estimarDuracao(paraEstimativa(d)).totalSeg;
      if (disponivel - usado < FOLGA_ACEITAVEL) break;

      const volume = contarVolume(dias);
      // Candidato: exercício de grupo abaixo do alvo, o de menos séries
      // primeiro — subir de 2 para 3 vale mais que de 4 para 5.
      // Teto de 4 por exercício mesmo tendo tempo: a partir da quinta série o
      // mesmo movimento rende cada vez menos, e o resultado fica feio de um
      // jeito que denuncia o que aconteceu — seis séries de panturrilha em pé
      // não é programa, é sobra de tempo empilhada.
      const cand = d.exercicios
        .filter((e) => e.grupo !== 'cardio' && e.series < 4)
        .filter((e) => (volume[e.grupo] ?? 0) + 1 <= alvoSemanal(e.grupo as Grupo, p))
        .sort((a, b) => a.series - b.series)[0];

      if (!cand) {
        algumDiaSobrando = true;
        break;
      }
      cand.series += 1;
    }
  }

  if (!algumDiaSobrando) return;

  // Quantos dias o treino da semana realmente ocupa, no tempo que a pessoa tem.
  // É divisão simples e sai exata: o volume semanal não muda com o número de
  // dias (quem o limita é a recuperação), então espalhar em mais dias só torna
  // cada sessão mais curta. Dizer isso com o número dela na frente vale mais
  // que qualquer explicação genérica sobre volume.
  const totalSeg = dias.reduce((s, d) => s + estimarDuracao(paraEstimativa(d)).totalSeg, 0);
  const porDia = p.minutosPorDia[p.diasDisponiveis[0] ?? 1] ?? 60;
  const diasQueOcupa = Math.max(1, Math.ceil(totalSeg / 60 / porDia));
  const media = Math.round(totalSeg / 60 / dias.length);

  if (diasQueOcupa < dias.length) {
    avisos.push(
      `Seu treino soma ${Math.round(totalSeg / 60)} min de musculação na semana. Com ${porDia} min ` +
        `por dia isso cabe em ${diasQueOcupa} dia${diasQueOcupa > 1 ? 's' : ''} — você marcou ` +
        `${dias.length}, então cada sessão fica com ${media} min em média. O volume semanal é o ` +
        `MESMO nos dois casos: quem limita é a recuperação, não a agenda. Mais dias espalha melhor ` +
        `(cada músculo aparece mais vezes na semana); menos dias usa o tempo que você tem. ` +
        `As duas funcionam — escolha pela sua rotina, não porque a sessão parece curta.`
    );
  } else {
    avisos.push(
      'Sobra tempo em alguns dias, e isso é de propósito: todo grupo já está no volume semanal ' +
        'que a recuperação acompanha. Daqui em diante o que faz diferença é carga, não minuto — ' +
        'use a sobra para aquecer melhor, descansar o quanto o app pede e subir o peso.'
    );
  }
}

/** Nomes de grupo como se fala, para o aviso não sair em jargão de banco. */
const COMO_SE_FALA: Record<string, string> = {
  peito: 'peito', costas: 'costas', ombro: 'ombro', biceps: 'bíceps',
  triceps: 'tríceps', quadriceps: 'quadríceps', posterior: 'posterior de coxa',
  gluteo: 'glúteo', panturrilha: 'panturrilha', abdomen: 'abdômen',
  trapezio: 'trapézio', antebraco: 'antebraço',
};

/**
 * Diz quando um grupo passa muito do alvo por volume INDIRETO.
 *
 * O aparador tira série direta até o piso de 2 por exercício e para — de
 * propósito, porque o resto do excesso vem de composto que está ali por outro
 * motivo, e cortar supino para "consertar" o ombro seria destruir o peito.
 *
 * Só que aí o plano ficava calado sobre duas coisas ao mesmo tempo: o grupo
 * está bem acima do alvo, e o trabalho DIRETO dele saiu enxuto de propósito.
 * Um avançado em 6 dias termina com 12 séries diretas de ombro e 19 indiretas
 * vindas de todo supino, mergulho e encolhimento da semana. Sem explicação, as
 * três séries de desenvolvimento parecem erro do app — e a reação natural é
 * acrescentar ombro na mão, que é exatamente o caminho para a lesão mais comum
 * de quem treina.
 */
function avisarExcessoIndireto(dias: DiaGerado[], p: PerfilDoTreino, avisos: string[]) {
  const total = contarVolume(dias);
  const direto: Record<string, number> = {};
  for (const d of dias)
    for (const e of d.exercicios) direto[e.grupo] = (direto[e.grupo] ?? 0) + e.series;

  // Um aviso só, com a lista. Quatro parágrafos dizendo a mesma coisa sobre
  // quatro músculos diferentes viram texto que ninguém lê — e aí o aviso que
  // importa se perde no meio.
  const estourados: string[] = [];
  for (const [g, v] of Object.entries(total)) {
    if (g === 'abdomen' || g === 'cardio') continue;
    const alvo = alvoSemanal(g as Grupo, p);
    const indireto = v - (direto[g] ?? 0);
    // Só entra quando estourou de verdade E a causa é o volume indireto.
    if (v <= alvo * 1.3 || indireto < v / 2) continue;
    estourados.push(`${COMO_SE_FALA[g] ?? g} (${Math.round(v)}, sendo ${direto[g] ?? 0} diretas)`);
  }

  if (estourados.length) {
    avisos.push(
      `${estourados.join(', ')} — nesses grupos o total semanal passa do alvo por causa dos ` +
        `compostos, que os treinam junto. Por isso o trabalho DIRETO neles ficou enxuto: não é ` +
        `esquecimento, é a conta fechando. Acrescentar exercício por conta aí só custa recuperação.`
    );
  }
}

/** Distância circular entre dois dias da semana. Domingo encosta na segunda. */
const distDia = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
};

/**
 * Quais dias da semana ficam disponíveis para os treinos.
 *
 * Se a pessoa marcou dias, são os dela — e se marcou mais do que a divisão
 * precisa, ficam os mais espaçados entre si. Se não marcou nada, cai no padrão
 * clássico (3 dias = segunda, quarta, sexta), que já nasce espalhado e não
 * inventa treino no domingo para quem não pediu.
 */
function vagasDaSemana(p: PerfilDoTreino, quantos: number): number[] {
  const marcados = [...new Set(p.diasDisponiveis)].sort((a, b) => a - b);
  if (!marcados.length) return [...(PADROES[Math.min(6, quantos)] ?? [1, 3, 5])].slice(0, quantos);

  if (marcados.length >= quantos) {
    const passo = marcados.length / quantos;
    return Array.from({ length: quantos }, (_, i) => marcados[Math.floor(i * passo)]);
  }

  // Marcou menos dias do que a divisão pede: completa com o dia mais longe dos
  // já usados, para não colar duas sessões.
  const restantes = [0, 1, 2, 3, 4, 5, 6].filter((d) => !marcados.includes(d));
  const out = [...marcados];
  while (out.length < quantos && restantes.length) {
    let melhor = restantes[0];
    let melhorDist = -1;
    for (const c of restantes) {
      const dist = Math.min(...out.map((u) => distDia(u, c)));
      if (dist > melhorDist) {
        melhorDist = dist;
        melhor = c;
      }
    }
    out.push(melhor);
    restantes.splice(restantes.indexOf(melhor), 1);
  }
  return out;
}

/**
 * Grupos que contam para o intervalo de recuperação.
 *
 * Cardio fica de fora porque não disputa recuperação com musculação da mesma
 * forma — e porque, com objetivo de emagrecimento, TODO dia recebe cardio.
 * Deixá-lo na conta fazia todos os dias "compartilharem grupo" com todos, o
 * critério de distância perdia o sentido e o resultado foram dois treinos de
 * perna em dias seguidos. Abdômen sai pela mesma razão: aparece em quase toda
 * sessão e não é o que limita.
 */
const IGNORAR_NA_AGENDA = new Set(['cardio', 'abdomen']);

const gruposDoDia = (d: DiaGerado) => [
  ...new Set(d.exercicios.map((e) => e.grupo).filter((g) => !IGNORAR_NA_AGENDA.has(g))),
];

/**
 * Coloca cada treino num dia da semana.
 *
 * Atribuição **sequencial**, na ordem do modelo — e isso não é preguiça: as
 * divisões deste arquivo já são escritas alternando (Superior, Inferior,
 * Superior, Inferior; Empurrar, Puxar, Pernas…). Com vagas em ordem crescente,
 * seguir a sequência é o encaixe ótimo, e é previsível: o treino A é o primeiro
 * da semana, sempre.
 *
 * A versão anterior procurava a melhor vaga por distância e errava de dois
 * jeitos: ordenava as vagas depois de escolher (jogando fora o cálculo) e
 * contava cardio como grupo compartilhado. Busca sofisticada que produz perna
 * na quinta e perna na sexta perde para uma regra simples que acerta.
 *
 * O que sobra da conta de distância vira aviso, não silêncio: se a semana da
 * pessoa força dois dias colados, ela precisa saber.
 */
function distribuirNaSemana(dias: DiaGerado[], p: PerfilDoTreino, avisos: string[]) {
  const vagas = vagasDaSemana(p, dias.length);
  dias.forEach((d, i) => {
    d.diaSemana = vagas[i] ?? null;
  });

  for (let i = 0; i < dias.length; i++) {
    for (let j = i + 1; j < dias.length; j++) {
      const a = dias[i];
      const b = dias[j];
      if (a.diaSemana === null || b.diaSemana === null) continue;
      if (distDia(a.diaSemana, b.diaSemana) > 1) continue;

      const comuns = gruposDoDia(a).filter((g) => gruposDoDia(b).includes(g));
      if (!comuns.length) continue;

      avisos.push(
        `${a.nome} e ${b.nome} caíram em dias seguidos e treinam ${comuns.join(', ')}. ` +
          `A síntese proteica fica elevada por 24 a 48 h depois da sessão — treinar de novo dentro ` +
          `dessa janela soma fadiga, não estímulo. Se der, marque mais um dia livre na semana.`
      );
    }
  }

  // A ordem visual segue a semana: quem abre a lista é o primeiro treino a
  // acontecer, não a letra que saiu do modelo.
  dias.sort((a, b) => (a.diaSemana ?? 9) - (b.diaSemana ?? 9));
}

// ── Gravação ──────────────────────────────────────────────────────────────

/**
 * Substitui a rotina ativa pelo plano gerado.
 *
 * Substitui em vez de acrescentar: era isso que enchia o app de treinos soltos
 * — foi o que aconteceu com a Deise, que terminou o cadastro com a rotina de
 * exemplo E a rotina nova, sem saber qual das duas era a dela.
 */
export async function aplicarPlano(plano: Plano, nome = 'Meu treino'): Promise<number> {
  const db = await (await banco()).getDb();

  await (await banco()).run('UPDATE routines SET ativa = 0 WHERE ativa = 1');

  const r = await db.runAsync(
    `INSERT INTO routines (nome, descricao, ativa, criado_em, nivel, dias_semana)
     VALUES (?,?,1,?,?,?)`,
    [nome, plano.porque, Date.now(), 'iniciante', plano.dias.length]
  );
  const routineId = r.lastInsertRowId;

  for (let i = 0; i < plano.dias.length; i++) {
    const d = plano.dias[i];
    const dr = await db.runAsync(
      `INSERT INTO routine_days (routine_id, nome, cor, ordem, dia_semana, tipo)
       VALUES (?,?,?,?,?,?)`,
      [routineId, d.nome, d.cor, i, d.diaSemana, 'forca']
    );
    const dayId = dr.lastInsertRowId;

    for (let j = 0; j < d.exercicios.length; j++) {
      const e = d.exercicios[j];
      await db.runAsync(
        `INSERT INTO routine_exercises
           (routine_day_id, exercise_id, ordem, series_alvo, reps_min, reps_max, descanso_seg, eh_composto)
         VALUES (?,?,?,?,?,?,?,?)`,
        [dayId, e.id, j, e.series, e.repsMin || null, e.repsMax || null, e.descanso, ehComposto(e.nome) ? 1 : 0]
      );
    }
  }

  // Se algum dia ficou sem data — divisão maior que os dias marcados —, a
  // agenda resolve olhando os grupos musculares.
  if (plano.dias.some((d) => d.diaSemana === null)) await (await import('./agenda')).distribuirAutomaticamente();

  return routineId;
}

/** Gera e aplica em uma chamada. É o que o onboarding e o "refazer" usam. */
export async function gerarEAplicar(p: PerfilDoTreino, nome?: string): Promise<Plano> {
  const plano = await montarPlano(p);
  await aplicarPlano(plano, nome);
  return plano;
}

/**
 * Monta a entrada do gerador a partir do que já está gravado no perfil.
 *
 * Existe para que ninguém precise responder duas vezes: o questionário grava,
 * isto lê, e o treino sai de lá sem passo intermediário.
 */
export async function perfilDoTreino(): Promise<PerfilDoTreino | null> {
  const p = await (await banco()).first<Profile>('SELECT * FROM profile WHERE id = 1');
  if (!p) return null;

  const marcados = (p.dias_disponiveis ?? '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((n) => n >= 0 && n <= 6);

  return {
    dias: p.dias_treino_semana ?? 3,
    diasDisponiveis: marcados,
    minutosPorDia: (await import('@/features/perfil/api')).lerTempoPorDia(p.minutos_por_dia),
    experiencia: p.experiencia ?? 'iniciante',
    objetivo: p.objetivo ?? 'hipertrofia',
    local: p.local_treino ?? 'academia',
    preferenciaEquipamento: p.preferencia_equipamento ?? 'ambos',
    dores: (p.dores ?? '').split(',').filter(Boolean),
    focos: (p.enfase ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  };
}

/** Refaz o treino com as respostas atuais. Um botão, sem etapas. */
export async function regerarTreino(): Promise<Plano | null> {
  const p = await perfilDoTreino();
  if (!p) return null;
  return gerarEAplicar(p);
}
