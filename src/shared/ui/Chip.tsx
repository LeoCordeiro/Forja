import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';

interface Props {
  label: string;
  ativo?: boolean;
  onPress?: () => void;
  cor?: string;
  icone?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
}

export function Chip({ label, ativo, onPress, cor = colors.primary, icone, emoji }: Props) {
  const conteudo = (
    <>
      {emoji ? <Txt size={13}>{emoji}</Txt> : null}
      {icone ? (
        <Ionicons name={icone} size={14} color={ativo ? cor : colors.textDim} />
      ) : null}
      <Txt v="small" cor={ativo ? cor : colors.textDim} bold={ativo}>
        {label}
      </Txt>
    </>
  );

  const estilo = [
    s.chip,
    ativo && { backgroundColor: `${cor}22`, borderColor: cor },
  ];

  if (!onPress) return <View style={estilo}>{conteudo}</View>;

  return (
    <Press onPress={onPress} haptic="selecao" scale={0.94} style={estilo}>
      {conteudo}
    </Press>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
