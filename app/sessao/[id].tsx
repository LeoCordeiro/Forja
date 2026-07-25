import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, motion, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Celebrar,
  Comemoracao,
  ExerciseDemo,
  NumberPad,
  Press,
  Sheet,
  Txt,
} from '@/shared/ui';
import {
  atualizarSerie,
  cancelarSessao,
  desfazerSerie,
  exerciciosDoDia,
  finalizarSessao,
  getSessao,
  registrarSerie,
  seriesDaSessao,
  ultimaExecucao,
  type SerieAnterior,
} from '@/features/treino/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import type { RoutineExerciseFull } from '@/db/types';
import { cronometro, duracao, num, peso as fmtPeso, volume } from '@/shared/utils/format';
import { duracaoDe } from '@/shared/utils/sessao';
import { buzz } from '@/shared/utils/haptics';

interface Serie {
  peso: string;
  reps: string;
  concluida: boolean;
  salvaId?: number;
}

type Foco = { exId: number; serie: number; campo: 'peso' | 'reps' } | null;

export default function Execucao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useKeepAwake(); // tela apagando no meio do treino = treino abandonado

  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(Date.now());
  const [exercicios, setExercicios] = useState<RoutineExerciseFull[]>([]);
  const [anteriores, setAnteriores] = useState<Record<number, SerieAnterior[]>>({});
  const [series, setSeries] = useState<Record<number, Serie[]>>({});
  const [foco, setFoco] = useState<Foco>(null);
  const [buffer, setBuffer] = useState('');
  const [descanso, setDescanso] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [comemorar, setComemorar] = useState<Comemoracao | null>(null);
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const scroll = useRef<ScrollView>(null);

  // ── carga inicial ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const sessao = await getSessao(sessionId);
      if (!sessao) return router.back();
      setNome(sessao.nome);
      setInicio(sessao.iniciado_em);

      const lista = sessao.routine_day_id ? await exerciciosDoDia(sessao.routine_day_id) : [];
      setExercicios(lista);

      // Recupera o que já foi registrado — o app pode ter sido fechado no meio.
      const jaFeitas = await seriesDaSessao(sessionId);
      const estado: Record<number, Serie[]> = {};
      const hist: Record<number, SerieAnterior[]> = {};

      for (const ex of lista) {
        const doEx = jaFeitas.filter((s) => s.exercise_id === ex.exercise_id);
        const total = Math.max(ex.series_alvo, doEx.length);
        estado[ex.id] = Array.from({ length: total }, (_, i) => {
          const salva = doEx.find((s) => s.serie_index === i);
          return salva
            ? {
                peso: salva.peso_kg ? String(salva.peso_kg).replace('.', ',') : '',
                reps: salva.reps ? String(salva.reps) : '',
                concluida: true,
                salvaId: salva.id,
              }
            : { peso: '', reps: '', concluida: false };
        });
        hist[ex.id] = await ultimaExecucao(ex.exercise_id, sessionId);
      }
      setSeries(estado);
      setAnteriores(hist);
    })();
  }, [sessionId, router]);

  // ── relógio: cronômetro do treino e contagem do descanso ────────────────
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (descanso === null) return;
    if (descanso <= 0) {
      buzz.forte();
      setDescanso(null);
      return;
    }
    const t = setTimeout(() => setDescanso((d) => (d === null ? null : d - 1)), 1000);
    return () => clearTimeout(t);
  }, [descanso]);

  const totalSeries = useMemo(
    () => Object.values(series).reduce((a, arr) => a + arr.filter((x) => x.concluida).length, 0),
    [series]
  );
  const volumeAtual = useMemo(
    () =>
      Object.values(series).reduce(
        (a, arr) =>
          a +
          arr
            .filter((x) => x.concluida)
            .reduce(
              (b, x) =>
                b + (parseFloat(x.peso.replace(',', '.')) || 0) * (parseInt(x.reps, 10) || 0),
              0
            ),
        0
      ),
    [series]
  );

  // ── edição de campo ─────────────────────────────────────────────────────
  const abrirCampo = useCallback(
    (exId: number, serie: number, campo: 'peso' | 'reps') => {
      const atual = series[exId]?.[serie];
      if (!atual) return;
      let valor = campo === 'peso' ? atual.peso : atual.reps;

      // Campo vazio herda o da última sessão: é o gesto que faz a progressão
      // de carga acontecer sem digitar nada.
      if (!valor) {
        const ant = anteriores[exId]?.[serie] ?? anteriores[exId]?.[anteriores[exId].length - 1];
        if (ant) {
          valor =
            campo === 'peso'
              ? ant.peso_kg
                ? String(ant.peso_kg).replace('.', ',')
                : ''
              : ant.reps
                ? String(ant.reps)
                : '';
        }
      }
      setBuffer(valor);
      setFoco({ exId, serie, campo });
      buzz.selecao();
    },
    [series, anteriores]
  );

  function aplicarBuffer() {
    if (!foco) return;
    setSeries((prev) => {
      const arr = [...(prev[foco.exId] ?? [])];
      arr[foco.serie] = { ...arr[foco.serie], [foco.campo]: buffer };
      return { ...prev, [foco.exId]: arr };
    });
  }

  /** Série já gravada: a correção precisa descer para o banco, não só para a tela. */
  async function persistirCorrecao(exId: number, idx: number, campo: 'peso' | 'reps', novo: string) {
    const s = series[exId]?.[idx];
    if (!s?.salvaId) return;
    const ex = exercicios.find((e) => e.id === exId);
    if (!ex) return;

    const pesoStr = campo === 'peso' ? novo : s.peso;
    const repsStr = campo === 'reps' ? novo : s.reps;

    const prs = await atualizarSerie({
      setLogId: s.salvaId,
      sessionId,
      exerciseId: ex.exercise_id,
      pesoKg: parseFloat(pesoStr.replace(',', '.')) || null,
      reps: parseInt(repsStr, 10) || null,
    });

    if (prs.length > 0) mostrarPR(ex.nome, prs[0]);
  }

  function confirmarCampo() {
    if (!foco) return;
    aplicarBuffer();
    void persistirCorrecao(foco.exId, foco.serie, foco.campo, buffer);

    // Peso preenchido pula direto para reps — o fluxo natural de quem registra.
    if (foco.campo === 'peso') {
      const atual = series[foco.exId]?.[foco.serie];
      setFoco({ ...foco, campo: 'reps' });
      setBuffer(atual?.reps ?? '');
    } else {
      setFoco(null);
    }
  }

  function mostrarPR(nomeEx: string, pr: { tipo: string; valor: number; valor_anterior: number | null }) {
    setComemorar({
      emoji: '🏆',
      subtitulo: 'Recorde pessoal',
      titulo: nomeEx,
      detalhe:
        (pr.tipo === 'e1rm' ? `1RM estimado de ${fmtPeso(pr.valor)} kg` : `${fmtPeso(pr.valor)} kg`) +
        (pr.valor_anterior ? ` — antes era ${fmtPeso(pr.valor_anterior)} kg` : ''),
      cor: colors.warn,
    });
  }

  // ── concluir série ──────────────────────────────────────────────────────
  async function concluirSerie(ex: RoutineExerciseFull, idx: number) {
    const s = series[ex.id]?.[idx];
    if (!s) return;

    if (s.concluida) {
      // Desmarcar precisa apagar o registro, não só mudar a tela: senão
      // marcar → desmarcar → marcar grava a mesma série duas vezes e o volume
      // (e os recordes derivados dele) passam a contar em dobro.
      if (s.salvaId) await desfazerSerie(s.salvaId, sessionId);
      setSeries((p) => {
        const arr = [...p[ex.id]];
        arr[idx] = { ...arr[idx], concluida: false, salvaId: undefined };
        return { ...p, [ex.id]: arr };
      });
      buzz.leve();
      return;
    }

    const pesoN = parseFloat(s.peso.replace(',', '.')) || null;
    const repsN = parseInt(s.reps, 10) || null;
    const porTempo = ex.tipo_carga === 'tempo';

    if (!porTempo && (!pesoN || !repsN)) {
      // Falta dado: em vez de erro, abre o campo que está faltando.
      abrirCampo(ex.id, idx, !pesoN ? 'peso' : 'reps');
      buzz.aviso();
      return;
    }

    setSeries((p) => {
      const arr = [...p[ex.id]];
      arr[idx] = { ...arr[idx], concluida: true };
      return { ...p, [ex.id]: arr };
    });
    buzz.ok();

    const prs = await registrarSerie({
      sessionId,
      exerciseId: ex.exercise_id,
      ordemExercicio: ex.ordem,
      serieIndex: idx,
      pesoKg: pesoN,
      reps: repsN,
      duracaoSeg: porTempo ? repsN : null,
    });

    setDescanso(ex.descanso_seg);

    if (prs.length > 0) mostrarPR(ex.nome, prs[0]);

    // Guarda o id gravado para permitir corrigir esta série depois.
    const salvas = await seriesDaSessao(sessionId);
    const gravada = salvas.find(
      (x) => x.exercise_id === ex.exercise_id && x.serie_index === idx
    );
    if (gravada) {
      setSeries((p) => {
        const arr = [...p[ex.id]];
        arr[idx] = { ...arr[idx], salvaId: gravada.id };
        return { ...p, [ex.id]: arr };
      });
    }
  }

  async function encerrar(sensacao: number) {
    setSalvando(true);
    try {
      const r = await finalizarSessao(sessionId, sensacao);
      if (!r.valida) {
        router.replace('/');
        return;
      }
      const novas = await avaliarConquistas();
      setConfirmandoFim(false);
      if (novas.length > 0) {
        const m = novas[0];
        setComemorar({
          emoji: m.icone,
          subtitulo: 'Medalha desbloqueada',
          titulo: m.nome,
          detalhe: `${m.descricao} · +${m.pontos} XP`,
          cor: colors.xp,
        });
        // Deixa a comemoração na tela; a saída acontece ao fechar o modal.
        setTimeout(() => router.replace('/'), 3200);
      } else {
        router.replace('/');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function abandonar() {
    await cancelarSessao(sessionId);
    router.replace('/');
  }

  const decorrido = duracaoDe(inicio, null);

  return (
    <View style={s.root}>
      {/* ── Cabeçalho fixo ── */}
      <View style={[s.head, { paddingTop: insets.top + spacing.sm }]}>
        <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
          <Ionicons name="chevron-down" size={22} color={colors.textDim} />
        </Press>
        <View style={{ flex: 1 }}>
          <Txt v="h3" numberOfLines={1}>
            {nome}
          </Txt>
          <Txt v="small" cor={colors.textFaint}>
            {duracao(decorrido)} · {totalSeries} séries · {volume(volumeAtual)}
          </Txt>
        </View>
        <Press onPress={() => setConfirmandoFim(true)} style={s.btnFim} scale={0.94}>
          <Txt v="h3" cor="#1A0800" size={14}>
            Concluir
          </Txt>
        </Press>
      </View>

      {/* ── Descanso ── */}
      {descanso !== null ? <BarraDescanso segundos={descanso} onPular={() => setDescanso(null)} /> : null}

      <ScrollView
        ref={scroll}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: foco ? 420 : 140,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {exercicios.map((ex, i) => (
          <Animated.View key={ex.id} entering={FadeInDown.delay(i * 40).duration(280)}>
            <CardExercicio
              ex={ex}
              series={series[ex.id] ?? []}
              anteriores={anteriores[ex.id] ?? []}
              foco={foco}
              onEditar={abrirCampo}
              onConcluir={(idx) => concluirSerie(ex, idx)}
              onAddSerie={() =>
                setSeries((p) => ({
                  ...p,
                  [ex.id]: [...(p[ex.id] ?? []), { peso: '', reps: '', concluida: false }],
                }))
              }
            />
          </Animated.View>
        ))}

        {exercicios.length === 0 ? (
          <Card>
            <Txt v="h3">Este treino não tem exercícios</Txt>
            <Txt v="small">Volte e adicione exercícios ao dia antes de treinar.</Txt>
          </Card>
        ) : null}
      </ScrollView>

      {/* ── Teclado numérico ── */}
      {foco ? (
        <View style={[s.pad, { paddingBottom: insets.bottom }]}>
          <NumberPad
            // Remonta a cada campo: é o que zera o "primeira tecla substitui".
            key={`${foco.exId}-${foco.serie}-${foco.campo}`}
            valor={buffer}
            onChange={setBuffer}
            onConfirmar={confirmarCampo}
            decimal={foco.campo === 'peso'}
            incrementos={foco.campo === 'peso' ? [2.5, 5, 10] : [1, 2, 5]}
            rotulo={foco.campo === 'peso' ? 'Peso em kg' : 'Repetições'}
          />
        </View>
      ) : null}

      {/* ── Finalizar ── */}
      <Sheet
        aberto={confirmandoFim}
        onFechar={() => setConfirmandoFim(false)}
        titulo="Como foi o treino?"
        altura={0.55}
      >
        <View style={{ gap: spacing.lg }}>
          <View style={s.resumoFim}>
            <ItemResumo label="Duração" valor={duracao(decorrido)} />
            <ItemResumo label="Séries" valor={String(totalSeries)} />
            <ItemResumo label="Volume" valor={volume(volumeAtual)} />
          </View>
          <Txt v="label">Sensação</Txt>
          <View style={s.sensacoes}>
            {['😵', '😮‍💨', '🙂', '💪', '🔥'].map((e, i) => (
              <Press
                key={e}
                onPress={() => encerrar(i + 1)}
                style={s.sensacao}
                scale={0.88}
                haptic="medio"
              >
                <Txt size={26}>{e}</Txt>
              </Press>
            ))}
          </View>
          <Button
            titulo="Descartar treino"
            variante="perigo"
            full
            onPress={abandonar}
            carregando={salvando}
          />
        </View>
      </Sheet>

      <Celebrar item={comemorar} onFechar={() => setComemorar(null)} />
    </View>
  );
}

// ─────────────────────────── Card de exercício ───────────────────────────

function CardExercicio({
  ex,
  series,
  anteriores,
  foco,
  onEditar,
  onConcluir,
  onAddSerie,
}: {
  ex: RoutineExerciseFull;
  series: Serie[];
  anteriores: SerieAnterior[];
  foco: Foco;
  onEditar: (exId: number, serie: number, campo: 'peso' | 'reps') => void;
  onConcluir: (idx: number) => void;
  onAddSerie: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const feitas = series.filter((s) => s.concluida).length;
  const completo = feitas === series.length && series.length > 0;
  const porTempo = ex.tipo_carga === 'tempo';

  return (
    <Card style={completo ? { borderColor: colors.success } : undefined}>
      <Press onPress={() => setAberto((a) => !a)} haptic="leve" style={s.exHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="h3">{ex.nome}</Txt>
          <Txt v="small" cor={colors.textFaint}>
            {ex.series_alvo} × {ex.reps_min}-{ex.reps_max} · descanso {ex.descanso_seg}s
          </Txt>
        </View>
        <View style={[s.contador, completo && { backgroundColor: colors.successSoft }]}>
          <Txt v="small" cor={completo ? colors.success : colors.textDim} bold>
            {feitas}/{series.length}
          </Txt>
        </View>
        <Ionicons
          name={aberto ? 'chevron-up' : 'information-circle-outline'}
          size={19}
          color={colors.textFaint}
        />
      </Press>

      {aberto ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: spacing.md }}>
          <ExerciseDemo mediaUrl={ex.media_url} altura={190} />
          {ex.instrucoes
            ? ex.instrucoes.split('|').map((p, i) => (
                <View key={i} style={s.passo}>
                  <View style={s.passoNum}>
                    <Txt v="small" cor={colors.primary} size={11} bold>
                      {i + 1}
                    </Txt>
                  </View>
                  <Txt v="small" style={{ flex: 1 }}>
                    {p}
                  </Txt>
                </View>
              ))
            : null}
          {ex.dica ? (
            <View style={s.dica}>
              <Ionicons name="bulb" size={14} color={colors.warn} />
              <Txt v="small" cor={colors.warn} style={{ flex: 1 }}>
                {ex.dica}
              </Txt>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={s.tabela}>
        <View style={s.thead}>
          <Txt v="label" style={{ width: 28 }}>
            #
          </Txt>
          <Txt v="label" style={{ flex: 1 }}>
            Anterior
          </Txt>
          <Txt v="label" style={{ width: 74, textAlign: 'center' }}>
            {porTempo ? 'Seg' : 'Kg'}
          </Txt>
          <Txt v="label" style={{ width: 60, textAlign: 'center' }}>
            {porTempo ? '—' : 'Reps'}
          </Txt>
          <View style={{ width: 38 }} />
        </View>

        {series.map((serie, i) => {
          const ant = anteriores[i];
          return (
            <LinhaSerie
              key={i}
              idx={i}
              serie={serie}
              anterior={ant}
              porTempo={porTempo}
              focoPeso={foco?.exId === ex.id && foco.serie === i && foco.campo === 'peso'}
              focoReps={foco?.exId === ex.id && foco.serie === i && foco.campo === 'reps'}
              onEditarPeso={() => onEditar(ex.id, i, 'peso')}
              onEditarReps={() => onEditar(ex.id, i, 'reps')}
              onConcluir={() => onConcluir(i)}
            />
          );
        })}
      </View>

      <Press onPress={onAddSerie} style={s.addSerie} haptic="leve">
        <Ionicons name="add" size={16} color={colors.textDim} />
        <Txt v="small" cor={colors.textDim}>
          Adicionar série
        </Txt>
      </Press>
    </Card>
  );
}

function LinhaSerie({
  idx,
  serie,
  anterior,
  porTempo,
  focoPeso,
  focoReps,
  onEditarPeso,
  onEditarReps,
  onConcluir,
}: {
  idx: number;
  serie: Serie;
  anterior?: SerieAnterior;
  porTempo: boolean;
  focoPeso: boolean;
  focoReps: boolean;
  onEditarPeso: () => void;
  onEditarReps: () => void;
  onConcluir: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[s.linha, serie.concluida && { backgroundColor: colors.successSoft }]}
    >
      <Txt v="small" cor={colors.textFaint} style={{ width: 28 }}>
        {idx + 1}
      </Txt>

      <Txt v="small" cor={colors.textFaint} style={{ flex: 1 }} size={12}>
        {anterior?.peso_kg
          ? `${fmtPeso(anterior.peso_kg)} × ${anterior.reps}`
          : anterior?.reps
            ? `${anterior.reps}`
            : '—'}
      </Txt>

      <Press onPress={onEditarPeso} haptic={false} style={[s.campo, focoPeso && s.campoFoco]}>
        <Txt
          v="h3"
          center
          cor={serie.peso ? colors.text : colors.textFaint}
          style={{ width: '100%' }}
        >
          {serie.peso || (anterior?.peso_kg ? fmtPeso(anterior.peso_kg) : '—')}
        </Txt>
      </Press>

      <Press
        onPress={onEditarReps}
        haptic={false}
        style={[s.campo, { width: 60 }, focoReps && s.campoFoco]}
      >
        <Txt
          v="h3"
          center
          cor={serie.reps ? colors.text : colors.textFaint}
          style={{ width: '100%' }}
        >
          {serie.reps || (anterior?.reps ? String(anterior.reps) : '—')}
        </Txt>
      </Press>

      <Press onPress={onConcluir} haptic={false} scale={0.85} style={s.check}>
        <View style={[s.checkBox, serie.concluida && s.checkOn]}>
          <Ionicons
            name="checkmark"
            size={17}
            color={serie.concluida ? '#00251A' : colors.textFaint}
          />
        </View>
      </Press>
    </Animated.View>
  );
}

// ─────────────────────────── Descanso ───────────────────────────

function BarraDescanso({ segundos, onPular }: { segundos: number; onPular: () => void }) {
  const pulso = useSharedValue(1);

  useEffect(() => {
    // Últimos 5 segundos pulsam: avisa sem exigir que você olhe o número.
    if (segundos <= 5 && segundos > 0) {
      pulso.value = withSequence(withTiming(1.06, { duration: 240 }), withTiming(1, { duration: 240 }));
      buzz.leve();
    }
  }, [segundos, pulso]);

  const st = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  return (
    <Animated.View entering={SlideInUp.duration(240)} style={[s.descanso, st]}>
      <Ionicons name="timer-outline" size={18} color={colors.primary} />
      <Txt v="h2" cor={colors.primary}>
        {cronometro(segundos)}
      </Txt>
      <Txt v="small" style={{ flex: 1 }}>
        Descanso
      </Txt>
      <Press onPress={onPular} style={s.pular} haptic="leve">
        <Txt v="small" cor={colors.textDim} bold>
          Pular
        </Txt>
      </Press>
    </Animated.View>
  );
}

function ItemResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="label">{label}</Txt>
      <Txt v="h2">{valor}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFim: {
    paddingHorizontal: spacing.lg,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descanso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pular: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contador: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },
  tabela: { gap: 4, marginTop: spacing.sm },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: 4,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  campo: {
    width: 74,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campoFoco: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: { width: 38, alignItems: 'flex-end' },
  checkBox: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  addSerie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  passo: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  passoNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dica: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  pad: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  resumoFim: { flexDirection: 'row', gap: spacing.md },
  sensacoes: { flexDirection: 'row', gap: spacing.sm },
  sensacao: {
    flex: 1,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
