import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, FILL, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: ReactNode;
  /** Fração da altura da tela. 0.9 para telas de conteúdo longo. */
  altura?: number;
}

/**
 * Bottom sheet. Sobe de baixo porque a mão já está lá — abrir do centro
 * obrigaria o polegar a viajar a tela inteira.
 */
export function Sheet({ aberto, onFechar, titulo, children, altura = 0.75 }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={aberto} transparent animationType="none" onRequestClose={onFechar}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={s.fundo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(280).dampingRatio(0.85)}
        exiting={SlideOutDown.duration(200)}
        style={[
          s.sheet,
          { maxHeight: height * altura, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={s.puxador} />
        {titulo ? (
          <View style={s.head}>
            <Txt v="h2" style={{ flex: 1 }}>
              {titulo}
            </Txt>
            <Press onPress={onFechar} style={s.fechar} scale={0.9}>
              <Ionicons name="close" size={20} color={colors.textDim} />
            </Press>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: { ...FILL, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  puxador: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  fechar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
