import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Empty, Press, Tela, Sheet, Txt } from '@/shared/ui';
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
  reordenarPorPrioridade,
  rotinaDoDia,
  sessaoAberta,
} from '@/features/treino/api';
import { modularSeries, resolverFase } from '@/features/treino/fase';
import type { RoutineExerciseFull } from '@/db/types';
import { nomeGrupo } from '@/shared/utils/format';
import { hoje, isoDe } from '@/shared/utils/date';
import { getPerfil } from '@/features/perfil/api';
import { RIR_POR_FASE, semanaAtual as semanaDoPlano } from '@/features/treino/periodizacao';
import { prioridadeDe } from '@/features/treino/classificacao';
import {
  ABRE_O_GRUPO,
  LABEL_PAPEL,
  papeisDaRotina,
  prescricaoDe,
  textoRir,
  type PapelDaLinha,
} from '@/features/treino/papel';
import { analisarOrdem } from '@/features/treino/ordem';
import { buzz } from '@/shared/utils/haptics';
import { Ajuda } from '@/shared/ui/Ajuda';
import { AJUDA } from '@/shared/ajudas';

/** O RIR da linha: o do plano quando existe, o do papel quando não. */
function rirDaLinha(ex: RoutineExerciseFull, papeis: Map<number, PapelDaLinha>): string {
  if (ex.tipo_carga === 'tempo' || ex.grupo_primario === 'cardio') return '';
  if (ex.rir_min != null && ex.rir_max != null) return textoRir([ex.rir_min, ex.rir_max]);
  const papel = papeis.get(ex.id)?.papel ?? 'isolador';
  return textoRir(
    prescricaoDe(papel, ex.nome, ex.grupo_primario, ex.equipamento, ex.tipo_carga).rir
  );
}

export default function DiaDeTreino() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const diaId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<RoutineExerciseFull | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [dia, exs, perfil, rotina] = await Promise.all([
      getDia(diaId),
      exerciciosDoDia(diaId),
      getPerfil(),
      rotinaDoDia(diaId),
    ]);
    return { dia, exs, perfil, rotina };
  }, [diaId]);

  // Semana do plano de retorno — gravada no check-in para a sessão retomada
  // dias depois não mudar de alvo no meio do caminho.
  const semanaPlano = dados?.perfil?.retomou_em
    ? semanaDoPlano(dados.perfil.retomou_em)
    : null;

  // A MESMA resolução do executor (retorno > bloco > nada): o que se vê aqui
  // antes de iniciar tem que bater com o que a sessão abre.
  const fase = dados?.perfil
    ? resolverFase({
        retomouEm: dados.perfil.retomou_em,
        mesesParado: dados.perfil.meses_parado ?? 0,
        rotinaCriadaEmIso: dados.rotina?.criado_em
          ? isoDe(new Date(dados.rotina.criado_em))
          : null,
        hojeIso: hoje(),
      })
    : null;

  async function comecar(energia?: number, local?: string) {
    if (!dados?.dia) return;
    setIniciando(true);
    try {
      // Se já existe treino aberto, retoma em vez de criar outro.
      const aberta = await sessaoAberta();
      const sid =
        aberta?.id ??
        (await iniciarSessao(diaId, dados.dia.nome, {
          energia,
          local,
          semanaPlano: semanaPlano ?? undefined,
        }));
      setFazendoCheckin(false);
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

  // Detecta ordem fora do ideal: prioridade que cai depois de outra maior.
  const desordenado = (() => {
    const p = (dados?.exs ?? []).map((e) => prioridadeDe(e.nome, e.grupo_primario));
    return p.some((v, i) => i > 0 && v < p[i - 1]);
  })();

  // Papel de cada linha, pela MESMA função que o executor usa — indexada por
  // id, não por posição.
  //
  // A versão anterior casava a lista de força (sem cardio) com a lista completa
  // por índice. Passava enquanto o cardio fosse o último; só que
  // `addExercicioNoDia` insere com `MAX(ordem)+1`, ou seja DEPOIS do cardio, e
  // aí um agachamento livre acrescentado à mão aparecia como Isolador com
  // RIR 0-2 — e todas as linhas seguintes deslocadas junto.
  const papeis = papeisDaRotina(
    (dados?.exs ?? []).map((e) => ({
      id: e.id,
      nome: e.nome,
      grupo: e.grupo_primario,
      equipamento: e.equipamento,
      tipoCarga: e.tipo_carga,
      papel: e.papel,
    }))
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tela
        titulo={dados?.dia?.nome ?? 'Treino'}
        subtitulo={dados?.dia ? `${dados.exs.length} exercícios` : undefined}
        onRefresh={recarregar}
        paddingBottom={160}
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
                      {/* Cardio é medido em minutos, não em repetições: "1 ×
                          1800-1800" é o número certo no formato errado, e era
                          isso que a tela mostrava. */}
                      {ex.grupo_primario === 'cardio' ? (
                        `${nomeGrupo(ex.grupo_primario)} · ${Math.round((ex.reps_max ?? 0) / 60)} min · Zona 2`
                      ) : (
                        <>
                          {/* Alvo modulado pela fase — o mesmo número que a sessão vai abrir. */}
                          {nomeGrupo(ex.grupo_primario)} · {modularSeries(ex.series_alvo, fase)} ×{' '}
                          {ex.reps_min}-{ex.reps_max} · {ex.descanso_seg}s
                          {rirDaLinha(ex, papeis) ? ` · ${rirDaLinha(ex, papeis)}` : ''}
                        </>
                      )}
                    </Txt>
                    {/* O papel é a resposta a "por que este exercício está aqui".
                        Sem ele, três séries de elevação lateral no fim do dia de
                        peito parecem sobra de algoritmo. Cardio não tem papel:
                        ele não disputa vaga com nenhum grupo muscular. */}
                    {ex.grupo_primario !== 'cardio' ? (
                      <Txt v="small" size={11} cor={colors.textDim}>
                        {LABEL_PAPEL[papeis.get(ex.id)?.papel ?? 'isolador']}
                        {/* Quem abre o grupo sem ser principal ganha o sufixo,
                            não o rótulo: "Isolador · abre o grupo" diz as duas
                            verdades, "Principal" dizia uma mentira. */}
                        {papeis.get(ex.id)?.ancora && papeis.get(ex.id)?.papel !== 'principal'
                          ? ` · ${ABRE_O_GRUPO}`
                          : ''}
                        {ex.aquecimento_series > 0 ? ` · +${ex.aquecimento_series} aproximações` : ''}
                      </Txt>
                    ) : null}
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
          <>
            <Button
              titulo="Adicionar exercício"
              icone="add"
              variante="secundario"
              full
              onPress={() => setAdicionando(true)}
            />

            {/* Ordem fora do ideal: avisa em vez de reordenar sozinho — pode
                haver motivo (aparelho, lesão) que o app não conhece. */}
            {desordenado ? (
              <Card faixa={colors.warn} padding={spacing.md}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="swap-vertical" size={18} color={colors.warn} />
                  <View style={{ flex: 1 }}>
                    <Txt v="h3" size={14} cor={colors.warn}>
                      A ordem pode render mais
                    </Txt>
                    <Txt v="small" size={11}>
                      Há isolador ou cardio antes de exercício composto. O que vem primeiro pega
                      você inteiro — e é o composto que mais constrói.
                    </Txt>
                  </View>
                </View>
                <Button
                  titulo="Reordenar pela ciência"
                  variante="fantasma"
                  tam="sm"
                  full
                  style={{ marginTop: spacing.sm }}
                  onPress={async () => {
                    await reordenarPorPrioridade(diaId);
                    buzz.ok();
                    recarregar();
                  }}
                />
              </Card>
            ) : null}

            {/* Análise deste dia, não regra genérica: a versão anterior falava
                de agachamento e terra num treino de costas e bíceps. */}
            <Card padding={spacing.md}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt v="label">Ordem deste treino</Txt>
                <Ajuda conteudo={AJUDA.ordemExercicios} />
              </View>
              {analisarOrdem(dados!.exs).map((o) => (
                <View key={o.titulo} style={s.regra}>
                  <Ionicons
                    name={o.tipo === 'atencao' ? 'alert-circle' : 'checkmark-circle'}
                    size={14}
                    color={o.tipo === 'atencao' ? colors.warn : colors.success}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt v="small" bold size={12}>
                      {o.titulo}
                    </Txt>
                    <Txt v="small" size={11} cor={colors.textFaint}>
                      {o.texto}
                    </Txt>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Press onPress={apagarDia} style={s.excluir} haptic="medio">
          <Ionicons name="trash-outline" size={15} color={colors.danger} />
          <Txt v="small" cor={colors.danger}>
            Excluir este dia de treino
          </Txt>
        </Press>
      </Tela>

      {!vazio ? (
        <View style={[s.rodape, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            titulo="Iniciar treino"
            icone="flame"
            tam="lg"
            full
            carregando={iniciando}
            onPress={() => setFazendoCheckin(true)}
          />
        </View>
      ) : null}

      {/* ── Check-in ── */}
      <Sheet
        aberto={fazendoCheckin}
        onFechar={() => setFazendoCheckin(false)}
        titulo="Como você chegou hoje?"
        altura={0.72}
      >
        <View style={{ gap: spacing.xl }}>
          {fase ? (
            <Card faixa={colors.info}>
              <Txt v="label" cor={colors.info}>
                Semana {fase.semana} · {fase.titulo}
              </Txt>
              <Txt v="small">{fase.descricao}</Txt>
              <Txt v="small" cor={colors.textFaint} style={{ marginTop: 4 }}>
                {RIR_POR_FASE[fase.fase].texto}
              </Txt>
            </Card>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Txt v="label">Nível de energia</Txt>
              <Ajuda conteudo={AJUDA.checkin} />
            </View>
            <View style={s.energias}>
              {[
                { n: 1, e: '🪫', t: 'Zerado' },
                { n: 2, e: '😴', t: 'Cansado' },
                { n: 3, e: '🙂', t: 'Normal' },
                { n: 4, e: '💪', t: 'Bem' },
                { n: 5, e: '⚡', t: 'Ótimo' },
              ].map((o) => (
                <Press
                  key={o.n}
                  onPress={() => comecar(o.n, 'academia')}
                  style={s.energia}
                  scale={0.9}
                  haptic="medio"
                >
                  <Txt size={26}>{o.e}</Txt>
                  <Txt v="small" size={10} cor={colors.textFaint}>
                    {o.t}
                  </Txt>
                </Press>
              ))}
            </View>
          </View>

          <Button
            titulo="Pular e começar"
            variante="fantasma"
            full
            onPress={() => comecar()}
            carregando={iniciando}
          />
        </View>
      </Sheet>

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
  regra: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 6 },
  energias: { flexDirection: 'row', gap: spacing.sm },
  energia: {
    flex: 1,
    gap: 3,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
});
