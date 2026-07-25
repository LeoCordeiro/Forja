import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, HIT, type } from '@/theme';
import { Txt } from './Txt';

interface Props extends TextInputProps {
  rotulo?: string;
  sufixo?: string;
  erro?: string;
  /** Números grandes e centralizados — usado no onboarding e nas medidas. */
  grande?: boolean;
}

export function Input({ rotulo, sufixo, erro, grande, style, ...rest }: Props) {
  const [focado, setFocado] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      {rotulo ? <Txt v="label">{rotulo}</Txt> : null}
      <View
        style={[
          s.box,
          grande && s.boxGrande,
          focado && { borderColor: colors.primary },
          !!erro && { borderColor: colors.danger },
        ]}
      >
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocado(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          style={[
            grande ? s.inputGrande : s.input,
            style,
          ]}
        />
        {sufixo ? (
          <Txt v={grande ? 'h2' : 'body'} cor={colors.textDim}>
            {sufixo}
          </Txt>
        ) : null}
      </View>
      {erro ? (
        <Txt v="small" cor={colors.danger}>
          {erro}
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  boxGrande: {
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  inputGrande: {
    ...type.display,
    fontSize: 40,
    color: colors.text,
    textAlign: 'center',
    minWidth: 100,
    paddingVertical: 0,
  },
});
