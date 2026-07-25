import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';
import { buzz } from '../utils/haptics';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  /** Botões de ajuste rápido: na academia se soma anilha, não se digita número. */
  incrementos?: number[];
  decimal?: boolean;
  rotulo?: string;
}

/**
 * Teclado numérico próprio.
 *
 * O teclado nativo é ruim aqui por três motivos: cobre metade da tela, tem
 * teclas pequenas demais para dedo suado, e não oferece "+2,5" — que é como
 * de fato se pensa carga na academia (uma anilha a mais de cada lado).
 */
export function NumberPad({
  valor,
  onChange,
  onConfirmar,
  incrementos = [2.5, 5, 10],
  decimal = true,
  rotulo,
}: Props) {
  /**
   * Primeira tecla substitui o valor herdado, em vez de concatenar.
   *
   * Sem isso, tocar num campo que mostra 80 para trocar por 85 produzia 8085.
   * Os botões de ajuste continuam operando sobre o valor atual — é o
   * comportamento de calculadora, que é o que a mão espera.
   */
  const [virgem, setVirgem] = useState(true);

  function digitar(d: string) {
    const base = virgem ? '' : valor;
    setVirgem(false);
    if (d === ',' && (!decimal || base.includes(','))) return;
    if (base === '0' && d !== ',') return onChange(d);
    if (base.length >= 6) return;
    onChange(base + d);
  }

  function apagar() {
    setVirgem(false);
    onChange(valor.length <= 1 ? '' : valor.slice(0, -1));
  }

  function ajustar(delta: number) {
    // Ajuste parte sempre do valor em tela — é somar/tirar anilha do que já está lá.
    setVirgem(false);
    const atual = parseFloat(valor.replace(',', '.')) || 0;
    const novo = Math.max(0, Math.round((atual + delta) * 100) / 100);
    buzz.leve();
    onChange(String(novo).replace('.', ','));
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      style={s.box}
    >
      {rotulo ? (
        <Txt v="label" center style={{ marginBottom: spacing.sm }}>
          {rotulo}
        </Txt>
      ) : null}

      <View style={s.rapidos}>
        {incrementos.map((inc) => (
          <Press key={`m${inc}`} onPress={() => ajustar(-inc)} haptic={false} style={s.rapido}>
            <Txt v="small" cor={colors.textDim} bold>
              −{String(inc).replace('.', ',')}
            </Txt>
          </Press>
        ))}
        {incrementos.map((inc) => (
          <Press key={`p${inc}`} onPress={() => ajustar(inc)} haptic={false} style={s.rapido}>
            <Txt v="small" cor={colors.primary} bold>
              +{String(inc).replace('.', ',')}
            </Txt>
          </Press>
        ))}
      </View>

      <View style={s.grid}>
        {teclas.map((t) => (
          <Tecla key={t} label={t} onPress={() => digitar(t)} />
        ))}
        <Tecla label={decimal ? ',' : ''} onPress={() => decimal && digitar(',')} />
        <Tecla label="0" onPress={() => digitar('0')} />
        <Tecla icone="backspace-outline" onPress={apagar} onLongPress={() => onChange('')} />
      </View>

      <Press onPress={onConfirmar} haptic="medio" style={s.confirmar}>
        <Ionicons name="checkmark" size={22} color="#1A0800" />
        <Txt v="h3" cor="#1A0800">
          Confirmar
        </Txt>
      </Press>
    </Animated.View>
  );
}

function Tecla({
  label,
  icone,
  onPress,
  onLongPress,
}: {
  label?: string;
  icone?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Press onPress={onPress} onLongPress={onLongPress} haptic="selecao" scale={0.9} style={s.tecla}>
      {icone ? (
        <Ionicons name={icone} size={22} color={colors.textDim} />
      ) : (
        <Txt v="h2" size={24}>
          {label}
        </Txt>
      )}
    </Press>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rapidos: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  rapido: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tecla: {
    // 3 colunas com 2 vãos de 8px entre elas.
    width: '31.8%',
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmar: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
