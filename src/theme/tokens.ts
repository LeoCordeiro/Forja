/**
 * Tokens PUROS do design system — sem `react-native`.
 *
 * Estão separados de `index.ts` por um motivo prático: `index.ts` importa
 * `Platform` e `TextStyle` do react-native (tipografia e sombra precisam),
 * e isso impede o harness (`npm run testar:gerador`, que roda em Node) de ler
 * uma cor ou um tamanho de alvo. Enquanto ficaram lá, a única forma de
 * conferir contraste ou alvo de toque era no olho — e foi assim que `HIT = 52`
 * ficou definido e ignorado na tela mais tocada do app.
 *
 * Regra: o que dá para medir em Node mora aqui. Quem consome continua
 * importando de `@/theme`.
 */

export const colors = {
  bg: '#0A0B0F',
  bgElevated: '#101219',
  surface: '#14161D',
  surfaceAlt: '#1C1F28',
  surfaceHigh: '#242835',
  border: '#262A35',
  borderStrong: '#39404F',

  text: '#F4F6FA',
  textDim: '#9AA1B4',
  textFaint: '#5C6373',

  /** Laranja incandescente — a identidade da marca. Ação primária, carga, PR. */
  primary: '#FF5A1F',
  primaryDim: '#B33C10',
  primarySoft: 'rgba(255, 90, 31, 0.14)',

  /** Verde — série concluída, meta batida, macro dentro do alvo. */
  success: '#00D68F',
  successSoft: 'rgba(0, 214, 143, 0.14)',

  /** Roxo — XP, nível, medalha. Separa "progresso de jogo" de "progresso real". */
  xp: '#A97BFF',
  xpSoft: 'rgba(169, 123, 255, 0.14)',

  info: '#3B9EFF',
  infoSoft: 'rgba(59, 158, 255, 0.14)',
  warn: '#FFB020',
  warnSoft: 'rgba(255, 176, 32, 0.14)',
  danger: '#FF4757',
  dangerSoft: 'rgba(255, 71, 87, 0.14)',

  /** Macronutrientes — cor fixa, o olho aprende e não precisa ler o rótulo. */
  protein: '#FF5A1F',
  carb: '#3B9EFF',
  fat: '#FFB020',
} as const;

/** Escala de 4. Nada de valores soltos no meio do código. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  full: 999,
} as const;

/** Altura mínima de qualquer coisa clicável. Abaixo disso o polegar erra. */
export const HIT = 52;

/**
 * O piso absoluto (Apple HIG, 44×44). Abaixo disso não é escolha de densidade,
 * é defeito — e é o número que o teste cobra.
 */
export const HIT_MIN = 44;

/**
 * Alvos de toque da linha de série — a área mais tocada do app inteiro.
 *
 * ── Por que não é hitSlop ─────────────────────────────────────────────────
 *
 * `hitSlop` só existe no `Touchable` legado do react-native-web; o `Pressable`
 * (que o `Press` do projeto embrulha) ignora a prop. Conferido em
 * `node_modules/react-native-web/dist`: `hitSlop` aparece em três arquivos, os
 * três de `Touchable`. Como o app real do Leonardo é o PWA, um alvo que só
 * "cresce" por hitSlop não cresceu — no aparelho ele continua do tamanho da
 * caixa. Por isso todo alvo aqui é caixa de verdade: largura e altura.
 *
 * ── Por que o check é o maior ─────────────────────────────────────────────
 *
 * Concluir série acontece ~20 vezes por treino; é o gesto que o app existe
 * para servir. Ele fica no alvo confortável (HIT) e na borda direita, onde o
 * polegar chega. Editar campo vem em segundo (mesma altura, largura menor).
 * O que acontece 0-2 vezes por treino (aquecimento, remover) não disputa
 * largura com esses dois: saiu para o toque longo da linha.
 */
export const ALVO_TOQUE = {
  /** Concluir/desmarcar série. */
  check: { largura: HIT, altura: HIT },
  /** Campo de carga. */
  campoPeso: { largura: 70, altura: HIT },
  /** Campo de repetições. */
  campoReps: { largura: 54, altura: HIT },
  /** Bolinha da trilha de exercícios (o círculo desenhado continua com 30). */
  bola: { largura: HIT_MIN, altura: HIT },
  /** "Pular" o descanso, ícones do cabeçalho, fechar aviso. */
  botaoCompacto: { largura: HIT_MIN, altura: HIT_MIN },
  /** "Adicionar série", "Remover série", "Concluir" o treino. */
  botaoLinha: { largura: HIT_MIN, altura: HIT },
} as const;

/** Preenche o pai. Substitui StyleSheet.absoluteFillObject, cujo tipo saiu do RN 0.86. */
export const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;
