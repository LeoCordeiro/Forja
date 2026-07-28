import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '@/theme';
import { Txt, Button } from '@/shared/ui';
import { getDb, resetDb } from '@/db/client';
import { getPerfil } from '@/features/perfil/api';
import { useApp } from '@/shared/estado';

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [reparando, setReparando] = useState(false);
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
        // `String(e)` já vem com "Error:" e a mensagem do SQLite traz outro
        // dentro — sem isto a tela abre com "Error: Error: Error code 1".
        setFalha(String(e).replace(/^(Error:\s*)+/, ''));
      } finally {
        setPronto(true);
      }
    })();
  }, [setTemPerfil]);

  /**
   * Última saída quando o banco não abre.
   *
   * Sem isto o app fica num beco: a tela de erro é a única coisa que aparece,
   * e o botão de apagar dados — que resolveria — está atrás dela, no perfil.
   * Só desinstalar o app salvaria, e no PWA nem isso é óbvio.
   */
  async function reconstruir() {
    setReparando(true);
    try {
      await resetDb();
      const p = await getPerfil();
      setTemPerfil(!!p?.onboarding_completo);
      setFalha(null);
    } catch (e) {
      setFalha(String(e));
    } finally {
      setReparando(false);
    }
  }

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
            <Txt v="small" center cor={colors.textDim} style={{ maxWidth: 320 }}>
              Reconstruir apaga treinos, medidas e fotos deste aparelho. Só use se o
              app não abrir de jeito nenhum.
            </Txt>
            <Button
              titulo="Reconstruir o app"
              full
              variante="perigo"
              icone="refresh"
              carregando={reparando}
              desabilitado={reparando}
              onPress={reconstruir}
            />
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
