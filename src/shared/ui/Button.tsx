import { ActivityIndicator, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, HIT, shadow } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso';
type Tam = 'sm' | 'md' | 'lg';

interface Props {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  tam?: Tam;
  icone?: keyof typeof Ionicons.glyphMap;
  iconeDireita?: keyof typeof Ionicons.glyphMap;
  carregando?: boolean;
  desabilitado?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FUNDO: Record<Variante, string> = {
  primario: colors.primary,
  secundario: colors.surfaceHigh,
  fantasma: 'transparent',
  perigo: colors.dangerSoft,
  sucesso: colors.success,
};

const TEXTO: Record<Variante, string> = {
  primario: '#12060099',
  secundario: colors.text,
  fantasma: colors.textDim,
  perigo: colors.danger,
  sucesso: '#00281B',
};

const ALTURA: Record<Tam, number> = { sm: 40, md: HIT, lg: 60 };
const FONTE: Record<Tam, number> = { sm: 14, md: 16, lg: 17 };

export function Button({
  titulo,
  onPress,
  variante = 'primario',
  tam = 'md',
  icone,
  iconeDireita,
  carregando,
  desabilitado,
  full,
  style,
}: Props) {
  const inativo = desabilitado || carregando;
  // Texto sobre laranja/verde precisa ser escuro para passar contraste.
  const corTexto =
    variante === 'primario' ? '#1A0800' : variante === 'sucesso' ? '#00251A' : TEXTO[variante];

  return (
    <Press
      onPress={inativo ? undefined : onPress}
      haptic={variante === 'primario' || variante === 'sucesso' ? 'medio' : 'leve'}
      style={[
        s.base,
        {
          height: ALTURA[tam],
          backgroundColor: FUNDO[variante],
          opacity: inativo ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        variante === 'fantasma' && s.fantasma,
        variante === 'primario' && shadow.glow(colors.primary),
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={s.conteudo}>
          {icone && <Ionicons name={icone} size={FONTE[tam] + 3} color={corTexto} />}
          <Txt v="h3" cor={corTexto} size={FONTE[tam]}>
            {titulo}
          </Txt>
          {iconeDireita && (
            <Ionicons name={iconeDireita} size={FONTE[tam] + 3} color={corTexto} />
          )}
        </View>
      )}
    </Press>
  );
}

const s = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fantasma: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
