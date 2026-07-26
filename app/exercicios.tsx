import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@/theme';
import { Press, Tela, Txt } from '@/shared/ui';
import { SeletorExercicio } from '@/features/treino/SeletorExercicio';

export default function Catalogo() {
  const router = useRouter();
  return (
    <Tela
      titulo="Exercícios"
      subtitulo="Toque para ver execução, histórico e recordes"
      scroll={false}
    >
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SeletorExercicio onEscolher={(id) => router.push(`/exercicio/${id}`)} />
      </View>
    </Tela>
  );
}
