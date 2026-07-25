import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/theme';
import { Txt } from './Txt';

interface Props {
  mediaUrl: string | null;
  altura?: number;
  /** Pausa a alternância — usado quando o card está fora de foco. */
  parado?: boolean;
  raio?: number;
}

/**
 * Demonstração do exercício.
 *
 * A base de imagens dá dois frames por exercício: início e fim do movimento.
 * Alternar entre eles com crossfade produz a demonstração do gesto sem vídeo,
 * sem GIF e sem hospedar um byte sequer.
 */
export function ExerciseDemo({ mediaUrl, altura = 200, parado, raio = radius.lg }: Props) {
  const [frame, setFrame] = useState(0);
  const [erro, setErro] = useState(false);
  const op = useSharedValue(1);

  useEffect(() => {
    if (!mediaUrl || parado || erro) return;
    const t = setInterval(() => {
      op.value = withTiming(0, { duration: 220 }, () => {
        op.value = withTiming(1, { duration: 220 });
      });
      // Troca no meio do fade, quando a opacidade está no fundo.
      setTimeout(() => setFrame((f) => (f === 0 ? 1 : 0)), 220);
    }, 1400);
    return () => clearInterval(t);
  }, [mediaUrl, parado, erro, op]);

  const anim = useAnimatedStyle(() => ({ opacity: op.value }));

  if (!mediaUrl || erro) {
    return (
      <View style={[s.fallback, { height: altura, borderRadius: raio }]}>
        <Ionicons name="barbell-outline" size={34} color={colors.textFaint} />
        <Txt v="small" cor={colors.textFaint}>
          Sem demonstração
        </Txt>
      </View>
    );
  }

  return (
    <View style={[s.box, { height: altura, borderRadius: raio }]}>
      <Animated.View style={[StyleSheet.absoluteFill, anim]}>
        <Image
          source={{ uri: `${mediaUrl}/${frame}.jpg` }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={0}
          onError={() => setErro(true)}
        />
      </Animated.View>
      <View style={s.badge}>
        <Txt v="small" cor={colors.textDim} size={11}>
          {frame === 0 ? 'Início' : 'Execução'}
        </Txt>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  fallback: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(10,11,15,0.82)',
  },
});
