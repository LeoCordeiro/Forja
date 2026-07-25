import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Press } from './Press';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Borda colorida à esquerda — usada para categorizar (dia do treino, macro). */
  faixa?: string;
  padding?: number;
  destaque?: boolean;
}

export function Card({ children, onPress, style, faixa, padding, destaque }: Props) {
  const conteudo = (
    <View style={[s.inner, { padding: padding ?? spacing.lg }]}>{children}</View>
  );

  const estilo: StyleProp<ViewStyle> = [
    s.card,
    destaque && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    faixa ? { borderLeftWidth: 3, borderLeftColor: faixa } : null,
    style,
  ];

  if (onPress) {
    return (
      <Press onPress={onPress} scale={0.985} style={estilo}>
        {conteudo}
      </Press>
    );
  }
  return <View style={estilo}>{conteudo}</View>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inner: { gap: spacing.sm },
});
