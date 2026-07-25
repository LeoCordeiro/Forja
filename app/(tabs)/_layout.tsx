import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors, motion, spacing } from '@/theme';
import { Txt } from '@/shared/ui';

const ABAS = [
  { name: 'index', titulo: 'Hoje', icone: 'home' },
  { name: 'treino', titulo: 'Treino', icone: 'barbell' },
  { name: 'dieta', titulo: 'Dieta', icone: 'restaurant' },
  { name: 'evolucao', titulo: 'Evolução', icone: 'trending-up' },
  { name: 'perfil', titulo: 'Perfil', icone: 'person' },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {ABAS.map((a) => (
        <Tabs.Screen
          key={a.name}
          name={a.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <ItemAba icone={a.icone} titulo={a.titulo} ativo={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

/**
 * Ícone da aba com transição própria.
 *
 * O ponto laranja acima do ícone ativo dá um alvo visual que se lê de canto de
 * olho — mais rápido que interpretar cor de ícone.
 */
function ItemAba({
  icone,
  titulo,
  ativo,
}: {
  icone: string;
  titulo: string;
  ativo: boolean;
}) {
  const v = useSharedValue(ativo ? 1 : 0);

  useEffect(() => {
    v.value = withSpring(ativo ? 1 : 0, motion.spring);
  }, [ativo, v]);

  const ponto = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.4 + v.value * 0.6 }],
  }));

  const icn = useAnimatedStyle(() => ({
    transform: [{ translateY: -v.value * 2 }],
  }));

  return (
    <View style={s.aba}>
      <Animated.View style={[s.ponto, ponto]} />
      <Animated.View style={icn}>
        <Ionicons
          name={(ativo ? icone : `${icone}-outline`) as never}
          size={23}
          color={ativo ? colors.primary : colors.textFaint}
        />
      </Animated.View>
      <Txt v="small" size={10} cor={ativo ? colors.primary : colors.textFaint} bold={ativo}>
        {titulo}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  aba: { alignItems: 'center', gap: 3, width: 70 },
  ponto: {
    position: 'absolute',
    top: -7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
