import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Chip, Input, Press, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { listarExercicios } from './api';
import { nomeGrupo } from '@/shared/utils/format';

const GRUPOS = [
  'todos',
  'peito',
  'costas',
  'ombro',
  'biceps',
  'triceps',
  'quadriceps',
  'posterior',
  'gluteo',
  'panturrilha',
  'abdomen',
  'cardio',
];

/**
 * Busca de exercício reutilizada em toda parte que precisa escolher um.
 * Filtro por grupo em chips horizontais porque é assim que se pensa treino —
 * "hoje é peito" vem antes do nome do exercício.
 */
export function SeletorExercicio({ onEscolher }: { onEscolher: (id: number) => void }) {
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('todos');

  const { dados } = useDados(
    () => listarExercicios({ grupo, busca }),
    [grupo, busca],
    { aoFocar: false }
  );

  return (
    <View style={{ gap: spacing.md, flex: 1 }}>
      <Input
        placeholder="Buscar exercício…"
        value={busca}
        onChangeText={setBusca}
        autoCorrect={false}
      />

      <FlatList
        horizontal
        data={GRUPOS}
        keyExtractor={(g) => g}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
        renderItem={({ item }) => (
          <Chip
            label={item === 'todos' ? 'Todos' : nomeGrupo(item)}
            ativo={grupo === item}
            onPress={() => setGrupo(item)}
          />
        )}
        style={{ flexGrow: 0 }}
      />

      <FlatList
        data={dados ?? []}
        keyExtractor={(e) => String(e.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Txt v="small" center style={{ paddingVertical: spacing['3xl'] }}>
            Nenhum exercício encontrado
          </Txt>
        }
        renderItem={({ item }) => (
          <Press onPress={() => onEscolher(item.id)} style={s.item} scale={0.98}>
            <View style={s.badge}>
              <Ionicons name="barbell-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt v="h3">{item.nome}</Txt>
              <Txt v="small" cor={colors.textFaint} size={12}>
                {nomeGrupo(item.grupo_primario)}
                {item.equipamento ? ` · ${item.equipamento}` : ''}
              </Txt>
            </View>
            <Ionicons name="add-circle" size={22} color={colors.primary} />
          </Press>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
