import { Text, TextProps, TextStyle } from 'react-native';
import { colors, type } from '@/theme';

type Variante = keyof typeof type;

interface Props extends TextProps {
  v?: Variante;
  cor?: string;
  center?: boolean;
  /** Tamanho explícito quando a variante serve, mas a escala não. */
  size?: number;
  bold?: boolean;
}

/**
 * Todo texto do app passa por aqui. Isso garante que nenhuma tela invente
 * tamanho ou cor fora do design system.
 */
export function Txt({ v = 'body', cor, center, size, bold, style, ...rest }: Props) {
  const base = type[v] as TextStyle;
  return (
    <Text
      {...rest}
      style={[
        base,
        cor ? { color: cor } : null,
        center ? { textAlign: 'center' } : null,
        size ? { fontSize: size, lineHeight: Math.round(size * 1.25) } : null,
        bold ? { fontWeight: '800' } : null,
        style,
      ]}
    />
  );
}

/** Número em fonte tabular — não "dança" quando o valor muda. */
export function Num({
  children,
  size = 20,
  cor = colors.text,
  style,
  ...rest
}: TextProps & { size?: number; cor?: string }) {
  return (
    <Text
      {...rest}
      style={[type.numeric, { fontSize: size, color: cor, lineHeight: size * 1.15 }, style]}
    >
      {children}
    </Text>
  );
}
