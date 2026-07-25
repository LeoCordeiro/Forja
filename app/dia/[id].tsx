import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Empty, Press, Screen, Sheet, Txt } from '@/shared/ui';
import { SeletorExercicio } from '@/features/treino/SeletorExercicio';
import { useDados } from '@/shared/hooks/useDados';
import {
  addExercicioNoDia,
  atualizarExercicioDoDia,
  excluirDia,
  exerciciosDoDia,
  getDia,
  iniciarSessao,
  removerExercicioDoDia,
  sessaoAberta,
} from '@/features/treino/api';
import type { RoutineExerciseFull } from '@/db/types';
import { nomeGrupo } from '@/shared/utils/format';

export default function DiaDeTreino() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diaId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<RoutineExerciseFull | null>(null);
  const [iniciando, setIniciando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [dia, exs] = await Promise.all([getDia(diaId), exerciciosDoDia(diaId)]);
    return { dia, exs };
  }, [diaId]);

  async function comecar() {
    if (!dados?.dia) return;
    setIniciando(true);
    try {
      // Se já existe treino aberto, retoma em vez de criar outro.
      const aberta = await sessaoAberta();
      const sid = aberta?.id ?? (await iniciarSessao(diaId, dados.dia.nome));
      router.replace(`/sessao/${sid}`);
    } finally {
      setIniciando(false);
    }
  }

  async function adicionar(exercicioId: number) {
    await addExercicioNoDia(diaId, exercicioId);
    setAdicionando(false);
    recarregar();
  }

  async function remover(reId: number) {
    await removerExercicioDoDia(reId);
    recarregar();
  }

  async function apagarDia() {
    await excluirDia(diaId);
    router.replace('/treino');
  }

  const vazio = !dados?.exs.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        titulo={dados?.dia?.nome ?? 'Treino'}
        subtitulo={dados?.dia ? `${dados.exs.length} exercícios` : undefined}
        onRefresh={recarregar}
        paddingBottom={160}
        acaoTopo={
          <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
            <Ionicons name="close" size={20} color={colors.textDim} />
          </Press>
        }
      >
        {vazio ? (
          <Empty
            icone="add-circle-outline"
            titulo="Nenhum exercício ainda"
            texto="Adicione os exercícios que compõem este dia de treino."
            acao={{ titulo: 'Adicionar exercício', onPress: () => setAdicionando(true) }}
          />
        ) : (
          dados!.exs.map((ex, i) => (
            <Animated.View
              key={ex.id}
              entering={FadeInDown.delay(i * 40).duration(260)}
              exiting={FadeOut.duration(180)}
            >
              <Card padding={spacing.md}>
                <View style={s.linha}>
                  <View style={s.ordem}>
                    <Txt v="small" cor={colors.textFaint} bold>
                      {i + 1}
                    </Txt>
                  </View>
                  <Press
                    onPress={() => router.push(`/exercicio/${ex.exercise_id}`)}
                    haptic="leve"
                    style={{ flex: 1, gap: 2 }}
                  >
                    <Txt v="h3">{ex.nome}</Txt>
                    <Txt v="small" cor={colors.textFaint}>
                      {nomeGrupo(ex.grupo_primario)} · {ex.series_alvo} × {ex.reps_min}-
                      {ex.reps_max} · {ex.descanso_seg}s
                    </Txt>
                  </Press>
                  <Press onPress={() => setEditando(ex)} style={s.acao} scale={0.9}>
                    <Ionicons name="options-outline" size={18} color={colors.textDim} />
                  </Press>
                  <Press onPress={() => remover(ex.id)} style={s.acao} scale={0.9} haptic="medio">
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Press>
                </View>
              </Card>
            </Animated.View>
          ))
        )}

        {!vazio ? (
          <Button
            titulo="Adicionar exercício"
            icone="add"
            variante="secundario"
            full
            onPress={() => setAdicionando(true)}
          />
        ) : null}

        <Press onPress={apagarDia} style={s.excluir} haptic="medio">
          <Ionicons name="trash-outline" size={15} color={colors.danger} />
          <Txt v="small" cor={colors.danger}>
            Excluir este dia de treino
          </Txt>
        </Press>
      </Screen>

      {!vazio ? (
        <View style={[s.rodape, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            titulo="Iniciar treino"
            icone="flame"
            tam="lg"
            full
            carregando={iniciando}
            onPress={comecar}
          />
        </View>
      ) : null}

      <Sheet
        aberto={adicionando}
        onFechar={() => setAdicionando(false)}
        titulo="Adicionar exercício"
        altura={0.88}
      >
        <SeletorExercicio onEscolher={adicionar} />
      </Sheet>

      <SheetConfig
        ex={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (cfg) => {
          if (!editando) return;
          await atualizarExercicioDoDia(editando.id, cfg);
          setEditando(null);
          recarregar();
        }}
      />
    </View>
  );
}

function SheetConfig({
  ex,
  onFechar,
  onSalvar,
}: {
  ex: RoutineExerciseFull | null;
  onFechar: () => void;
  onSalvar: (cfg: {
    series_alvo: number;
    reps_min: number;
    reps_max: number;
    descanso_seg: number;
  }) => void;
}) {
  const [series, setSeries] = useState(3);
  const [repsMin, setRepsMin] = useState(8);
  const [repsMax, setRepsMax] = useState(12);
  const [descanso, setDescanso] = useState(90);
  const [carregado, setCarregado] = useState<number | null>(null);

  // Sincroniza com o exercício aberto sem precisar de efeito.
  if (ex && carregado !== ex.id) {
    setCarregado(ex.id);
    setSeries(ex.series_alvo);
    setRepsMin(ex.reps_min ?? 8);
    setRepsMax(ex.reps_max ?? 12);
    setDescanso(ex.descanso_seg);
  }

  return (
    <Sheet aberto={!!ex} onFechar={onFechar} titulo={ex?.nome ?? ''} altura={0.72}>
      <View style={{ gap: spacing.xl }}>
        <Stepper label="Séries" valor={series} onChange={setSeries} min={1} max={12} />
        <Stepper label="Repetições mínimas" valor={repsMin} onChange={setRepsMin} min={1} max={50} />
        <Stepper label="Repetições máximas" valor={repsMax} onChange={setRepsMax} min={1} max={50} />
        <Stepper
          label="Descanso (segundos)"
          valor={descanso}
          onChange={setDescanso}
          min={15}
          max={300}
          passo={15}
        />
        <Button
          titulo="Salvar"
          full
          onPress={() =>
            onSalvar({
              series_alvo: series,
              reps_min: repsMin,
              reps_max: Math.max(repsMin, repsMax),
              descanso_seg: descanso,
            })
          }
        />
      </View>
    </Sheet>
  );
}

function Stepper({
  label,
  valor,
  onChange,
  min,
  max,
  passo = 1,
}: {
  label: string;
  valor: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  passo?: number;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt v="label">{label}</Txt>
      <View style={s.stepper}>
        <Press
          onPress={() => onChange(Math.max(min, valor - passo))}
          style={s.stepBtn}
          scale={0.88}
          haptic="selecao"
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </Press>
        <Txt v="h1" center style={{ flex: 1 }}>
          {valor}
        </Txt>
        <Press
          onPress={() => onChange(Math.min(max, valor + passo))}
          style={s.stepBtn}
          scale={0.88}
          haptic="selecao"
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Press>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ordem: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acao: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
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
  excluir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
  },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
