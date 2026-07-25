import { ReactNode } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '@/theme';
import { buzz } from '../utils/haptics';

const APressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  /** Opcional: um seletor de cor, por exemplo, é só o próprio retângulo. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Quanto encolhe ao pressionar. 1 = não encolhe. */
  scale?: number;
  haptic?: false | 'leve' | 'medio' | 'forte' | 'selecao';
}

/**
 * Base de tudo que é clicável.
 *
 * O encolhimento sutil no toque é o que faz a interface parecer física — sem
 * isso o app parece uma página web. Combinado com o haptic, dá a sensação de
 * que o botão "recebeu" o toque mesmo antes da tela mudar.
 */
export function Press({ children, style, scale = 0.96, haptic = 'leve', ...rest }: Props) {
  const s = useSharedValue(1);
  const op = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: op.value,
  }));

  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(scale, motion.springPop);
        op.value = withTiming(0.85, { duration: motion.fast });
        if (haptic) buzz[haptic]();
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.spring);
        op.value = withTiming(1, { duration: motion.base });
        rest.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
}
