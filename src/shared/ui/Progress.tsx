import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, FILL, motion, radius } from '@/theme';
import { Txt, Num } from './Txt';

const ACircle = Animated.createAnimatedComponent(Circle);

/** Barra horizontal que cresce com mola quando o valor muda. */
export function Barra({
  valor,
  cor = colors.primary,
  altura = 8,
  fundo = colors.surfaceHigh,
  /** Marca a meta quando o valor pode passar dela (calorias, por exemplo). */
  excedeu,
}: {
  valor: number;
  cor?: string;
  altura?: number;
  fundo?: string;
  excedeu?: boolean;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withSpring(Math.max(0, Math.min(1, valor)), motion.springSoft);
  }, [valor, p]);

  const anim = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={[s.trilho, { height: altura, backgroundColor: fundo }]}>
      <Animated.View
        style={[
          s.preench,
          anim,
          { backgroundColor: excedeu ? colors.danger : cor, height: altura },
        ]}
      />
    </View>
  );
}

/**
 * Anel de progresso. Usado no resumo de calorias do dia e no XP do nível —
 * um círculo comunica "quanto falta" mais rápido que qualquer número.
 */
export function Anel({
  valor,
  tamanho = 120,
  espessura = 10,
  cor = colors.primary,
  centro,
  legenda,
}: {
  valor: number;
  tamanho?: number;
  espessura?: number;
  cor?: string;
  centro?: string;
  legenda?: string;
}) {
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, valor)), { duration: motion.slow });
  }, [valor, p]);

  const props = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value),
  }));

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}>
        <Circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          stroke={colors.surfaceHigh}
          strokeWidth={espessura}
          fill="none"
        />
        <ACircle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          stroke={cor}
          strokeWidth={espessura}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          animatedProps={props}
          // Começa no topo, não à direita — é como o olho espera ler progresso.
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
        />
      </Svg>
      <View style={s.centroAnel}>
        {centro ? <Num size={tamanho * 0.24}>{centro}</Num> : null}
        {legenda ? (
          <Txt v="label" style={{ marginTop: 2 }}>
            {legenda}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  trilho: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  preench: { borderRadius: radius.full },
  centroAnel: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
