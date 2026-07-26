import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@/theme';
import { Card, Input, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { listarReceitas } from '@/features/dieta/api';
import { kcal, num } from '@/shared/utils/format';

const DIFICULDADE = ['', 'Fácil', 'Médio', 'Difícil'];

export default function Receitas() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const { dados } = useDados(() => listarReceitas(busca), [busca]);

  return (
    <Tela
      titulo="Receitas"
      subtitulo="Passo a passo com timer em cada etapa"
    >
      <Input placeholder="Buscar receita…" value={busca} onChangeText={setBusca} />

      {(dados ?? []).map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(280)}>
          <Card onPress={() => router.push(`/receita/${r.id}`)}>
            <View style={s.entre}>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt v="h3">{r.nome}</Txt>
                <View style={s.tags}>
                  <Tag icone="time-outline" texto={`${r.tempo_preparo_min} min`} />
                  <Tag icone="flame-outline" texto={`${kcal(r.kcal)} kcal`} />
                  <Tag icone="speedometer-outline" texto={DIFICULDADE[r.dificuldade ?? 1]} />
                </View>
                <Txt v="small" cor={colors.textFaint} size={12}>
                  P {num(r.proteina_g)} g · C {num(r.carbo_g)} g · G {num(r.gordura_g)} g
                  {r.rendimento_porcoes > 1 ? ` · rende ${num(r.rendimento_porcoes)} porções` : ''}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </View>
          </Card>
        </Animated.View>
      ))}
    </Tela>
  );
}

function Tag({ icone, texto }: { icone: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View style={s.tag}>
      <Ionicons name={icone} size={12} color={colors.textDim} />
      <Txt v="small" size={11} cor={colors.textDim}>
        {texto}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  tags: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
