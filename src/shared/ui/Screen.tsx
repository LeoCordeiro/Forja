import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';

interface Props {
  children: ReactNode;
  titulo?: string;
  subtitulo?: string;
  scroll?: boolean;
  /** Espaço extra no fim para o conteúdo não ficar sob a tab bar ou o CTA fixo. */
  paddingBottom?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  acaoTopo?: ReactNode;
}

export function Screen({
  children,
  titulo,
  subtitulo,
  scroll = true,
  paddingBottom = 120,
  onRefresh,
  refreshing,
  acaoTopo,
}: Props) {
  const insets = useSafeAreaInsets();

  const cabecalho = titulo ? (
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        <Txt v="h1">{titulo}</Txt>
        {subtitulo ? (
          <Txt v="small" style={{ marginTop: 2 }}>
            {subtitulo}
          </Txt>
        ) : null}
      </View>
      {acaoTopo}
    </View>
  ) : null;

  if (!scroll) {
    return (
      <View style={[s.root, { paddingTop: insets.top + spacing.sm }]}>
        {cabecalho}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: paddingBottom + insets.bottom,
        paddingHorizontal: spacing.lg,
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
      {cabecalho}
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
});
