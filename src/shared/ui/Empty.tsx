import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';
import { Button } from './Button';

interface Props {
  icone?: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto?: string;
  acao?: { titulo: string; onPress: () => void };
}

/** Estado vazio sempre diz o que fazer em seguida — nunca só "sem dados". */
export function Empty({ icone = 'sparkles-outline', titulo, texto, acao }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={s.box}>
      <View style={s.circ}>
        <Ionicons name={icone} size={30} color={colors.textFaint} />
      </View>
      <Txt v="h3" center>
        {titulo}
      </Txt>
      {texto ? (
        <Txt v="small" center style={{ maxWidth: 280 }}>
          {texto}
        </Txt>
      ) : null}
      {acao ? (
        <Button titulo={acao.titulo} onPress={acao.onPress} tam="sm" style={{ marginTop: 4 }} />
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  circ: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
