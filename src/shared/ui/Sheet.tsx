import { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, FILL, radius, spacing } from '@/theme';
import { useTeclado } from '../hooks/useTeclado';
import { Txt } from './Txt';
import { Press } from './Press';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: ReactNode;
  /** Fração da altura da tela. 0.9 para telas de conteúdo longo. */
  altura?: number;
  /**
   * O conteúdo rola dentro do sheet.
   *
   * Opt-in de propósito: alguns sheets já trazem a própria lista rolável
   * (`FlatList` no de registrar alimento), e uma `ScrollView` por fora criaria
   * rolagem aninhada. Quem tem `Input` e altura fixa precisa disto — encolher
   * o sheet para o teclado caber, sem rolagem, só esconderia o botão Salvar
   * em vez do campo.
   */
  rolavel?: boolean;
}

/**
 * Bottom sheet. Sobe de baixo porque a mão já está lá — abrir do centro
 * obrigaria o polegar a viajar a tela inteira.
 *
 * ── O teclado (U8) ───────────────────────────────────────────────────────
 *
 * O sheet era `Modal` + posição absoluta no bottom, sem reação nenhuma ao
 * teclado. O de "Nota de setup" tem altura 0,62 e um `Input` multiline: no
 * iPhone o teclado cobria a metade inferior — o campo E o "Salvar". Anotar
 * "banco no furo 3" no meio do treino virava digitar às cegas, e no PWA
 * standalone é pior que no Safari, porque não existe barra do navegador para
 * empurrar a página.
 *
 * A correção é a mesma que a Fase 4 usou no executor, e não um componente
 * novo: **medir o que o teclado cobre e devolver o espaço**. Lá, o NumberPad
 * fica ancorado com `paddingBottom: insets.bottom` e a linha em edição sobe
 * por `scrollTo`; aqui o sheet encolhe o `maxHeight` pela altura do teclado e
 * o rodapé sobe junto. `KeyboardAvoidingView` não serviria: no
 * `react-native-web` ele depende de eventos que o navegador não emite — a
 * mesma armadilha do `hitSlop`, que existia na tela e valia zero no PWA.
 */
export function Sheet({ aberto, onFechar, titulo, children, altura = 0.75, rolavel }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const teclado = useTeclado();

  // Com o teclado aberto, o espaço que existe é o da janela menos o que ele
  // cobre. Os 24 pt são a folga para o puxador não encostar no topo da tela.
  const maxAltura = teclado > 0
    ? Math.max(220, height - teclado - 24)
    : height * altura;

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
          {
            maxHeight: maxAltura,
            // O rodapé sobe para cima do teclado. Sem isto, encolher o sheet
            // deixaria o botão de salvar exatamente debaixo dele.
            paddingBottom: (teclado > 0 ? teclado : insets.bottom) + spacing.lg,
          },
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
        {rolavel ? (
          <ScrollView
            // O toque no botão dentro do sheet não pode ser engolido pelo
            // fechamento do teclado: `handled` faz o filho responder primeiro.
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
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
