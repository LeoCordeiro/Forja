import { Platform, TextStyle } from 'react-native';

/**
 * Design system da Forja.
 *
 * Premissa: isto é usado de pé, na academia, com a mão suada, entre uma série
 * e outra — não sentado numa mesa. Todas as decisões abaixo derivam disso:
 * fundo escuro (luz forte e retina cansada), contraste alto, número gigante
 * que se lê de relance, e alvo de toque que o polegar acerta sem mirar.
 *
 * Cores, espaçamento, raio e alvos de toque moram em `tokens.ts` — que é puro
 * e por isso pode ser lido pelo teste em Node. O que precisa de `react-native`
 * (tipografia, sombra, motion) fica aqui.
 */
export {
  colors,
  spacing,
  radius,
  HIT,
  HIT_MIN,
  ALVO_TOQUE,
  FILL,
} from './tokens';

import { colors } from './tokens';

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
});

export const type = {
  /** Número de destaque: peso na série, calorias do dia, nível. */
  display: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: colors.text,
  } as TextStyle,
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
  } as TextStyle,
  h2: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  } as TextStyle,
  h3: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.text,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: colors.text,
  } as TextStyle,
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textDim,
  } as TextStyle,
  /** Rótulo de seção. Caixa alta + tracking largo cria hierarquia sem peso. */
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textFaint,
  } as TextStyle,
  /** Números em tabela/grid: tabular impede a coluna de "dançar" ao digitar. */
  numeric: {
    fontFamily: mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    color: colors.text,
  } as TextStyle,
} as const;

/** Sombra só onde precisa comunicar elevação real (sheet, card ativo, FAB). */
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 6 },
    default: { boxShadow: '0 6px 20px rgba(0,0,0,0.45)' },
  }),
  glow: (color: string) =>
    Platform.select({
      ios: {
        shadowColor: color,
        shadowOpacity: 0.55,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 10 },
      default: { boxShadow: `0 0 24px ${color}66` },
    }),
} as const;

/**
 * Durações de animação. Curto o suficiente pra não atrasar o usuário no meio
 * do treino; longo o suficiente pra o olho acompanhar de onde a coisa veio.
 */
export const motion = {
  fast: 140,
  base: 240,
  slow: 420,
  celebrate: 900,
  /** Mola padrão: firme, sem overshoot borrachudo. */
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 130, mass: 1 },
  springPop: { damping: 12, stiffness: 300, mass: 0.7 },
} as const;
