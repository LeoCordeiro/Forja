import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, HIT_MIN, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';
import { buzz } from '../utils/haptics';
import { calcularAnilhas, resumoAnilhas } from '@/features/treino/anilhas';
import { cronometro } from '../utils/format';

interface Props {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  /** Botões de ajuste rápido: na academia se soma anilha, não se digita número. */
  incrementos?: number[];
  decimal?: boolean;
  rotulo?: string;
  /** "kg", "reps" — aparece ao lado do número no visor. */
  unidade?: string;
  /** O outro campo da mesma série, para não perder o par de vista. */
  contexto?: { rotulo: string; valor: string };
  /** Mostra quais anilhas montar para o valor digitado. */
  anilhas?: boolean;
  /**
   * Segundos que faltam do descanso — negativo quando já passou.
   *
   * O teclado ocupa metade da tela e escondia a barra de descanso justamente
   * no momento em que ela mais orienta: durante o intervalo, preparando a
   * carga da próxima série. Aqui o contador não some, só encolhe.
   */
  descanso?: number | null;
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
  unidade,
  contexto,
  anilhas,
  descanso,
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
      {/* Visor.
          O teclado cobre a linha que está sendo editada — inevitável, ele ocupa
          metade da tela. Então o valor aparece aqui, grande, enquanto se digita.
          Sem isso a pessoa digita às cegas e só descobre o que escreveu depois
          de confirmar. Mostra também o outro campo da mesma série, para dar o
          contexto que a linha coberta daria. */}
      <View style={s.visor}>
        <View style={{ flex: 1 }}>
          <Txt v="label">{rotulo ?? 'Valor'}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Txt v="h1" size={38} cor={valor ? colors.text : colors.textFaint}>
              {valor || '0'}
            </Txt>
            {unidade ? (
              <Txt v="h3" cor={colors.textFaint}>
                {unidade}
              </Txt>
            ) : null}
            <Cursor />
          </View>
        </View>
        {contexto ? (
          <View style={s.contexto}>
            <Txt v="small" size={10} cor={colors.textDim}>
              {contexto.rotulo}
            </Txt>
            <Txt v="h3">{contexto.valor}</Txt>
          </View>
        ) : null}
        {/* Descanso correndo: o mesmo número da barra, na mesma cor, sem
            custar altura nenhuma no teclado. Verde quando acabou é o sinal de
            "pode ir" que a barra dá — quem está digitando precisa dele tanto
            quanto quem está olhando a tabela. */}
        {descanso !== null && descanso !== undefined ? (
          <View style={s.contexto}>
            <Txt v="small" size={10} cor={colors.textDim}>
              descanso
            </Txt>
            <Txt v="h3" cor={descanso <= 0 ? colors.success : colors.primary}>
              {cronometro(descanso)}
            </Txt>
          </View>
        ) : null}
      </View>

      {/* Quais anilhas montar. É a conta que todo mundo faz de cabeça entre
          uma série e outra — e erra, principalmente com 2,5 e 1,25. */}
      {anilhas && valor ? <LinhaAnilhas alvo={parseFloat(valor.replace(',', '.'))} /> : null}

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

/**
 * Anilhas por lado.
 *
 * Só aparece para carga que dá para montar numa barra. Halter e máquina não
 * têm anilha para calcular, e mostrar "não fecha" o tempo todo vira ruído —
 * então quando sobra muito, some.
 */
function LinhaAnilhas({ alvo }: { alvo: number }) {
  if (!Number.isFinite(alvo) || alvo < 20) return null;
  const c = calcularAnilhas(alvo, 20);
  if (Math.abs(c.sobra) > 2.5) return null;

  return (
    <View style={s.anilhas}>
      <Ionicons name="disc-outline" size={14} color={colors.textFaint} />
      <Txt v="small" size={11} cor={colors.textDim} style={{ flex: 1 }}>
        Por lado: <Txt v="small" size={11} cor={colors.text} bold>{resumoAnilhas(c)}</Txt>
        {c.sobra !== 0 ? `  (dá ${String(c.total).replace('.', ',')} kg)` : ''}
      </Txt>
    </View>
  );
}

/** Barrinha piscando: sem ela o visor parado parece um valor já confirmado. */
function Cursor() {
  const op = useSharedValue(1);
  useEffect(() => {
    op.value = withRepeat(withTiming(0, { duration: 620 }), -1, true);
  }, [op]);
  const st = useAnimatedStyle(() => ({ opacity: op.value }));
  return <Animated.View style={[s.cursor, st]} />;
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
  visor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  anilhas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  cursor: {
    width: 2,
    height: 30,
    backgroundColor: colors.primary,
    borderRadius: 1,
    marginLeft: 2,
  },
  contexto: {
    alignItems: 'flex-end',
    paddingLeft: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  rapidos: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  rapido: {
    flex: 1,
    // 44 e não 38: somar anilha é o segundo gesto mais usado do teclado, e o
    // dedo que erra aqui muda a carga para o lado errado.
    height: HIT_MIN,
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
