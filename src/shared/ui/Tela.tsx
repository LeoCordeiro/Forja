import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';
import { Ajuda, type ConteudoAjuda } from './Ajuda';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  ajuda?: ConteudoAjuda;
  onRefresh?: () => void;
  refreshing?: boolean;
  paddingBottom?: number;
  /** Ação extra no canto direito (favoritar, editar…). */
  acao?: ReactNode;
  scroll?: boolean;
}

/**
 * Tela interna com header fixo.
 *
 * Substitui o padrão antigo, em que o fechar ficava num X do canto superior
 * direito que rolava junto com o conteúdo: depois de descer a tela, voltar
 * exigia subir tudo de novo para achar o botão.
 *
 * Aqui o voltar fica à ESQUERDA (onde o polegar alcança e onde todo app do
 * sistema coloca), preso no topo, sempre visível. O título grande encolhe para
 * o header compacto conforme a rolagem, sem nunca esconder a saída.
 */
export function Tela({
  titulo,
  subtitulo,
  children,
  ajuda,
  onRefresh,
  refreshing,
  paddingBottom = 120,
  acao,
  scroll = true,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);

  const aoRolar = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  // O título só aparece no header depois que o título grande sai de vista.
  const tituloCompacto = useAnimatedStyle(() => ({
    opacity: withTiming(y.value > 46 ? 1 : 0, { duration: 140 }),
  }));

  const linhaHeader = useAnimatedStyle(() => ({
    opacity: withTiming(y.value > 8 ? 1 : 0, { duration: 140 }),
  }));

  function voltar() {
    // Rota aberta direto por URL (PWA) não tem histórico para voltar.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const header = (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      <Press onPress={voltar} style={s.voltar} scale={0.9} haptic="leve">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Press>

      <Animated.View style={[{ flex: 1 }, tituloCompacto]} pointerEvents="none">
        <Txt v="h3" numberOfLines={1}>
          {titulo}
        </Txt>
      </Animated.View>

      <View style={s.direita}>
        {ajuda ? <Ajuda conteudo={ajuda} tam={20} /> : null}
        {acao}
      </View>

      <Animated.View style={[s.linha, linhaHeader]} />
    </View>
  );

  const conteudo = (
    <>
      <View style={s.tituloGrande}>
        <Txt v="h1">{titulo}</Txt>
        {subtitulo ? (
          <Txt v="small" style={{ marginTop: 2 }}>
            {subtitulo}
          </Txt>
        ) : null}
      </View>
      {children}
    </>
  );

  if (!scroll) {
    return (
      <View style={s.root}>
        {header}
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>{conteudo}</View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {header}
      <Animated.ScrollView
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: paddingBottom + insets.bottom,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {conteudo}
      </Animated.ScrollView>
    </View>
  );
}

/** Botão de voltar solto, para telas que montam o próprio cabeçalho. */
export function BotaoVoltar({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Press
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={s.voltar}
      scale={0.9}
      haptic="leve"
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Press>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    zIndex: 10,
  },
  linha: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  voltar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  direita: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tituloGrande: { paddingTop: spacing.sm },
});
