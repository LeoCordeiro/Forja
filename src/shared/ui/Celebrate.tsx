import { useEffect, useMemo } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Button } from './Button';
import { buzz } from '../utils/haptics';

const CORES = [colors.primary, colors.success, colors.xp, colors.info, colors.warn];

/** Uma fita de confete: cai girando, com atraso e trajetória próprios. */
function Fita({ i, largura }: { i: number; largura: number }) {
  const y = useSharedValue(-40);
  const rot = useSharedValue(0);
  const op = useSharedValue(1);

  // Pseudoaleatório derivado do índice: mesma peça, sempre a mesma trajetória.
  const x = ((i * 61) % 100) / 100;
  const atraso = (i % 9) * 90;
  const dur = 1500 + ((i * 37) % 900);
  const cor = CORES[i % CORES.length];

  useEffect(() => {
    y.value = withDelay(atraso, withTiming(900, { duration: dur, easing: Easing.in(Easing.quad) }));
    rot.value = withDelay(atraso, withRepeat(withTiming(360, { duration: 700 }), -1, false));
    op.value = withDelay(atraso + dur - 400, withTiming(0, { duration: 400 }));
  }, [y, rot, op, atraso, dur]);

  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));

  return (
    <Animated.View
      style={[
        s.fita,
        st,
        { left: x * largura, backgroundColor: cor, height: 8 + (i % 3) * 4 },
      ]}
    />
  );
}

export function Confete({ ativo, qtd = 28 }: { ativo: boolean; qtd?: number }) {
  const { width } = useWindowDimensions();
  const fitas = useMemo(() => Array.from({ length: qtd }, (_, i) => i), [qtd]);
  if (!ativo) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {fitas.map((i) => (
        <Fita key={i} i={i} largura={width} />
      ))}
    </View>
  );
}

export interface Comemoracao {
  emoji: string;
  titulo: string;
  subtitulo: string;
  detalhe?: string;
  cor?: string;
}

/**
 * Modal de comemoração — PR batido ou medalha desbloqueada.
 *
 * Vale um modal cheio (e não um toast) porque é o momento de recompensa do
 * app inteiro. Se passar batido, a gamificação não funciona.
 */
export function Celebrar({
  item,
  onFechar,
}: {
  item: Comemoracao | null;
  onFechar: () => void;
}) {
  const pulso = useSharedValue(1);

  useEffect(() => {
    if (!item) return;
    buzz.ok();
    pulso.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [item, pulso]);

  const brilho = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  if (!item) return null;
  const cor = item.cor ?? colors.primary;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onFechar}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut} style={s.fundo}>
        <Confete ativo />
        <Animated.View entering={ZoomIn.springify().damping(14)} style={s.card}>
          <Animated.View style={[s.aura, brilho, { backgroundColor: `${cor}22` }]} />
          <Txt size={62} center>
            {item.emoji}
          </Txt>
          <Txt v="label" cor={cor} center>
            {item.subtitulo}
          </Txt>
          <Txt v="h1" center>
            {item.titulo}
          </Txt>
          {item.detalhe ? (
            <Txt v="body" cor={colors.textDim} center>
              {item.detalhe}
            </Txt>
          ) : null}
          <Button titulo="Continuar" onPress={onFechar} full style={{ marginTop: spacing.md }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgElevated,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing['2xl'],
    gap: spacing.sm,
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  aura: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  fita: {
    position: 'absolute',
    top: 0,
    width: 8,
    borderRadius: 2,
  },
});
