import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '@/theme';
import { Txt } from '@/shared/ui';
import { getDb } from '@/db/client';
import { getPerfil } from '@/features/perfil/api';
import { useApp } from '@/shared/estado';

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const temPerfil = useApp((s) => s.temPerfil);
  const setTemPerfil = useApp((s) => s.setTemPerfil);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      try {
        await getDb(); // abre, aplica DDL e roda o seed na primeira vez
        const p = await getPerfil();
        setTemPerfil(!!p?.onboarding_completo);
      } catch (e) {
        setFalha(String(e));
      } finally {
        setPronto(true);
      }
    })();
  }, [setTemPerfil]);

  // Sem perfil, todo caminho leva ao onboarding — e vice-versa.
  useEffect(() => {
    if (!pronto || temPerfil === null) return;
    const noOnboarding = segments[0] === 'onboarding';
    if (!temPerfil && !noOnboarding) router.replace('/onboarding');
    if (temPerfil && noOnboarding) router.replace('/');
  }, [pronto, temPerfil, segments, router]);

  if (!pronto || falha || temPerfil === null) {
    return (
      <View style={s.carregando}>
        <StatusBar style="light" />
        {falha ? (
          <>
            <Txt v="h2" center>
              Não foi possível abrir o banco
            </Txt>
            <Txt v="small" center style={{ maxWidth: 320 }}>
              {falha}
            </Txt>
          </>
        ) : (
          <>
            <Txt v="display" cor={colors.primary}>
              FORJA
            </Txt>
            <ActivityIndicator color={colors.primary} />
          </>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="sessao/[id]" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  carregando: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
  },
});
