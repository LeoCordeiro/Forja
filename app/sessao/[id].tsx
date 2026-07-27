import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import {
  Button,
  Card,
  Celebrar,
  Chip,
  Comemoracao,
  Input,
  MidiaExercicio,
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
  notasDoDia,
  salvarNota,
  substituirExercicio,
  substitutosDisponiveis,
  ultimaExecucao,
  type SerieAnterior,
} from '@/features/treino/api';
import { descansoCorreto, MOTIVOS_TROCA, porqueDescanso } from '@/features/treino/classificacao';
import {
  avisarFimDoDescanso,
  lerDescanso,
  manterAcordado,
  pedirPermissaoAviso,
  restantes,
  salvarDescanso,
  type DescansoAtivo,
} from '@/features/treino/descanso';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { checkin } from '@/features/liga/api';
import type { Exercise, RoutineExerciseFull } from '@/db/types';
import {
  cronometro,
  descansoLegivel,
  duracao,
  peso as fmtPeso,
  nomeGrupo,
  volume,
} from '@/shared/utils/format';
import { duracaoDe } from '@/shared/utils/sessao';
import { buzz } from '@/shared/utils/haptics';
import {
  alarmeAtraso,
  alarmeConclusao,
  alarmeFimDescanso,
  bipCurto,
  prepararAudio,
} from '@/shared/utils/alarme';

interface Serie {
  peso: string;
  reps: string;
  concluida: boolean;
  salvaId?: number;
}

type Foco = { exId: number; serie: number; campo: 'peso' | 'reps' } | null;

/** Diâmetro da bolinha da trilha + o traço que liga uma na outra. */
const BOLA = 30;
const PASSO = BOLA + 16;

export default function Execucao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useKeepAwake(); // tela apagando no meio do treino = treino abandonado

  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(Date.now());
  const [exercicios, setExercicios] = useState<RoutineExerciseFull[]>([]);
  const [anteriores, setAnteriores] = useState<Record<number, SerieAnterior[]>>({});
  const [series, setSeries] = useState<Record<number, Serie[]>>({});
  const [atual, setAtual] = useState(0);
  const [foco, setFoco] = useState<Foco>(null);
  const [buffer, setBuffer] = useState('');
  /**
   * Descanso guardado como INSTANTE DE TÉRMINO, não como segundos restantes.
   * O que aparece na tela é sempre uma subtração contra o relógio — por isso
   * continua certo depois de o navegador congelar a aba.
   */
  const [descansoAtivo, setDescansoAtivo] = useState<DescansoAtivo | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [comemorar, setComemorar] = useState<Comemoracao | null>(null);
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState<RoutineExerciseFull | null>(null);
  const [substitutos, setSubstitutos] = useState<Exercise[]>([]);
  const [motivoTroca, setMotivoTroca] = useState('ocupado');
  const [detalhe, setDetalhe] = useState<RoutineExerciseFull | null>(null);
  /** "Banco no furo 3", "pino 7" — o que se perde ao voltar de férias. */
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [editandoNota, setEditandoNota] = useState<RoutineExerciseFull | null>(null);
  const [textoNota, setTextoNota] = useState('');
  /** Já alarmou este descanso? Sem isso o alarme repete a cada segundo. */
  const alarmado = useRef<number | null>(null);

  const pager = useRef<ScrollView>(null);
  const trilha = useRef<ScrollView>(null);
  /**
   * Ignora o onScroll durante a animação de um salto programado — senão a
   * trilha volta pelas páginas intermediárias no caminho.
   *
   * É um prazo, não uma trava esperando o destino: uma versão anterior guardava
   * o índice alvo e só destravava ao chegar nele. Bastava o scroll ser
   * interrompido no meio para o destino nunca chegar, e aí a trilha ficava
   * presa num exercício e a página em outro.
   */
  const travadoAte = useRef(0);

  // ── carga inicial ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Navegador só libera áudio após gesto; o toque em "iniciar treino" já
      // aconteceu, então é aqui que o alarme do descanso fica destravado.
      prepararAudio();
      // Mesmo raciocínio para a notificação: pedir agora, com o gesto ainda
      // fresco. Pedir quando o descanso acaba seria tarde — o pop-up não
      // aparece com a aba escondida, que é justo quando ela faria falta.
      void pedirPermissaoAviso();
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
      setNotas(await notasDoDia(lista.map((e) => e.exercise_id)));

      // Retomar um treino interrompido abre onde ele parou, não no começo.
      // Posicionar aqui e não via `irPara`: naquele momento o callback ainda
      // enxerga a lista vazia e não sairia do lugar.
      const retomar = lista.findIndex((ex) => {
        const arr = estado[ex.id] ?? [];
        return arr.length === 0 || arr.some((x) => !x.concluida);
      });
      if (retomar > 0) {
        travadoAte.current = Date.now() + 900;
        setAtual(retomar);
        setTimeout(() => {
          pager.current?.scrollTo({ x: retomar * width, animated: false });
          trilha.current?.scrollTo({
            x: Math.max(0, retomar * PASSO - width / 2 + PASSO / 2),
            animated: false,
          });
        }, 80);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router]);

  /**
   * Relógio único da tela: cronômetro do treino e descanso saem daqui.
   *
   * Também reage a voltar para o app. O navegador congela o `setInterval` com a
   * aba escondida; `visibilitychange` força uma leitura na hora em que a tela
   * reaparece, para o número não ficar um instante desatualizado.
   */
  useEffect(() => {
    const tique = () => setAgora(Date.now());
    const t = setInterval(tique, 1000);
    const doc = (globalThis as unknown as { document?: Document }).document;
    doc?.addEventListener('visibilitychange', tique);
    return () => {
      clearInterval(t);
      doc?.removeEventListener('visibilitychange', tique);
    };
  }, []);

  const descanso = descansoAtivo ? restantes(descansoAtivo.fim) : null;

  /** Retoma um descanso que estava correndo quando o app foi fechado. */
  useEffect(() => {
    const guardado = lerDescanso();
    if (guardado) {
      setDescansoAtivo(guardado);
      if (restantes(guardado.fim) > 0) manterAcordado(true);
      else alarmado.current = guardado.fim; // já venceu: não alarmar atrasado
    }
  }, []);

  /**
   * Alarme.
   *
   * Dispara por travessia do zero, não por igualdade com zero: se a aba ficou
   * congelada e o contador pulou de 12 para -3, `=== 0` nunca aconteceria e o
   * aviso simplesmente não sairia.
   */
  useEffect(() => {
    if (!descansoAtivo || descanso === null) return;
    if (descanso > 0) {
      if (descanso <= 3) bipCurto();
      return;
    }
    if (alarmado.current === descansoAtivo.fim) return;
    alarmado.current = descansoAtivo.fim;
    alarmeFimDescanso();
    avisarFimDoDescanso(descansoAtivo.proximo);
    manterAcordado(false); // acabou: devolve a bateria
  }, [descanso, descansoAtivo]);

  /** Reforço em 1 e 3 minutos de atraso — depois disso, silêncio. */
  useEffect(() => {
    if (descanso === -60 || descanso === -180) alarmeAtraso();
  }, [descanso]);

  const encerrarDescanso = useCallback(() => {
    setDescansoAtivo(null);
    salvarDescanso(null);
    manterAcordado(false);
  }, []);

  /** Some sozinho depois de 5 min de atraso: a essa altura virou intervalo. */
  useEffect(() => {
    if (descanso !== null && descanso <= -300) encerrarDescanso();
  }, [descanso, encerrarDescanso]);

  // Sair da tela não pode deixar o silêncio tocando para sempre.
  useEffect(() => () => manterAcordado(false), []);

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

  // ── navegação lateral ───────────────────────────────────────────────────
  const irPara = useCallback(
    (i: number, animado = true) => {
      if (i < 0 || i >= exercicios.length) return;
      travadoAte.current = Date.now() + (animado ? 650 : 200);
      setAtual(i);
      pager.current?.scrollTo({ x: i * width, animated: animado });
      trilha.current?.scrollTo({
        x: Math.max(0, i * PASSO - width / 2 + PASSO / 2),
        animated: animado,
      });
    },
    [exercicios.length, width]
  );

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (Date.now() < travadoAte.current) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== atual && i >= 0 && i < exercicios.length) {
      setAtual(i);
      trilha.current?.scrollTo({
        x: Math.max(0, i * PASSO - width / 2 + PASSO / 2),
        animated: true,
      });
    }
  }

  const completoDe = useCallback((arr: Serie[] | undefined) => {
    return !!arr && arr.length > 0 && arr.every((x) => x.concluida);
  }, []);

  // ── edição de campo ─────────────────────────────────────────────────────
  const abrirCampo = useCallback(
    (exId: number, serie: number, campo: 'peso' | 'reps') => {
      const atualS = series[exId]?.[serie];
      if (!atualS) return;
      let valor = campo === 'peso' ? atualS.peso : atualS.reps;

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
      const atualS = series[foco.exId]?.[foco.serie];
      setFoco({ ...foco, campo: 'reps' });
      setBuffer(atualS?.reps ?? '');
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

    const arrNova = [...(series[ex.id] ?? [])];
    arrNova[idx] = { ...arrNova[idx], concluida: true };
    setSeries((p) => ({ ...p, [ex.id]: arrNova }));
    buzz.ok();
    setFoco(null);

    const prs = await registrarSerie({
      sessionId,
      exerciseId: ex.exercise_id,
      ordemExercicio: ex.ordem,
      serieIndex: idx,
      pesoKg: pesoN,
      reps: repsN,
      duracaoSeg: porTempo ? repsN : null,
    });

    const feitasAgora = arrNova.filter((x) => x.concluida).length;
    const projetado = { ...series, [ex.id]: arrNova };
    const iAtual = exercicios.findIndex((e) => e.id === ex.id);
    const iProximo = proximoPendente(iAtual, projetado);

    if (ex.descanso_seg > 0) {
      const novo: DescansoAtivo = {
        fim: Date.now() + ex.descanso_seg * 1000,
        exercicio: ex.nome,
        serieFeita: feitasAgora,
        serieTotal: arrNova.length,
        // Saber o que vem depois vale mais durante três minutos de descanso do
        // que depois deles, quando já dá para ver na tela.
        proximo: iProximo >= 0 && iProximo !== iAtual ? exercicios[iProximo].nome : undefined,
      };
      setDescansoAtivo(novo);
      salvarDescanso(novo);
      manterAcordado(true);
    }

    if (prs.length > 0) mostrarPR(ex.nome, prs[0]);

    // Guarda o id gravado para permitir corrigir esta série depois.
    const salvas = await seriesDaSessao(sessionId);
    const gravada = salvas.find((x) => x.exercise_id === ex.exercise_id && x.serie_index === idx);
    if (gravada) {
      setSeries((p) => {
        const arr = [...p[ex.id]];
        arr[idx] = { ...arr[idx], salvaId: gravada.id };
        return { ...p, [ex.id]: arr };
      });
    }

    // Exercício fechado: leva para o próximo que ainda falta. A pausa é para
    // dar tempo de ver a bolinha ficar verde — sem ela a tela "pula" sozinha
    // e a sensação é de erro, não de progresso.
    if (feitasAgora >= arrNova.length && iProximo >= 0 && iProximo !== iAtual) {
      setTimeout(() => irPara(iProximo), 850);
    }
  }

  function proximoPendente(depoisDe: number, mapa: Record<number, Serie[]>) {
    for (let k = depoisDe + 1; k < exercicios.length; k++) {
      if (!completoDe(mapa[exercicios[k].id])) return k;
    }
    for (let k = 0; k < depoisDe; k++) {
      if (!completoDe(mapa[exercicios[k].id])) return k;
    }
    return -1;
  }

  async function encerrar(sensacao: number) {
    setSalvando(true);
    encerrarDescanso(); // treino fechado não deixa silêncio tocando no bolso
    try {
      const r = await finalizarSessao(sessionId, sensacao);
      if (!r.valida) {
        router.replace('/');
        return;
      }
      alarmeConclusao();
      // Check-in da liga sai do treino concluído, não de um botão separado:
      // pedir para a pessoa marcar presença depois de já ter treinado é o tipo
      // de passo que ninguém faz duas semanas seguidas.
      await checkin('treino', {
        duracaoMin: Math.round(decorrido / 60),
        volumeKg: volumeAtual,
      });
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

  async function abrirTroca(ex: RoutineExerciseFull) {
    setDetalhe(null);
    setTrocando(ex);
    setSubstitutos([]);
    setSubstitutos(await substitutosDisponiveis(ex.exercise_id));
  }

  async function confirmarTroca(novoId: number) {
    if (!trocando) return;
    await substituirExercicio(trocando.id, novoId, sessionId, motivoTroca);
    setTrocando(null);
    buzz.ok();

    // Recarrega a lista e o histórico do exercício novo — o placeholder cinza
    // precisa mostrar a última vez que ELE foi feito, não o que foi trocado.
    const sessao = await getSessao(sessionId);
    if (sessao?.routine_day_id) {
      const lista = await exerciciosDoDia(sessao.routine_day_id);
      setExercicios(lista);
      const alvo = lista.find((e) => e.id === trocando.id);
      if (alvo) {
        const hist = await ultimaExecucao(alvo.exercise_id, sessionId);
        setAnteriores((p) => ({ ...p, [alvo.id]: hist }));
      }
    }
  }

  async function abandonar() {
    encerrarDescanso();
    await cancelarSessao(sessionId);
    router.replace('/');
  }

  const decorrido = duracaoDe(inicio, null);
  const concluidos = exercicios.filter((e) => completoDe(series[e.id])).length;

  return (
    <View style={s.root}>
      {/* ── Cabeçalho fixo ── */}
      <View style={[s.head, { paddingTop: insets.top + spacing.sm }]}>
        {/* Sair do treino é ambíguo: pausar para continuar depois, ou desistir?
            Voltar direto já perdeu treino por engano. Agora pergunta. */}
        <Press onPress={() => setSaindo(true)} style={s.iconeBtn} scale={0.9}>
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

      {/* ── Trilha de exercícios ── */}
      {exercicios.length > 0 ? (
        <Trilha
          ref={trilha}
          exercicios={exercicios}
          series={series}
          atual={atual}
          concluidos={concluidos}
          completoDe={completoDe}
          onIr={irPara}
        />
      ) : null}

      {/* ── Um exercício por tela ── */}
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={aoRolar}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {exercicios.map((ex, i) => (
          <PaginaExercicio
            key={ex.id}
            largura={width}
            ex={ex}
            ativo={i === atual}
            perto={Math.abs(i - atual) <= 1}
            nota={notas[ex.exercise_id] ?? ''}
            onNota={() => {
              setTextoNota(notas[ex.exercise_id] ?? '');
              setEditandoNota(ex);
            }}
            posicao={i}
            total={exercicios.length}
            series={series[ex.id] ?? []}
            anteriores={anteriores[ex.id] ?? []}
            foco={foco}
            compacto={!!foco}
            // Teclado aberto: folga suficiente para a linha em edição subir
            // acima dele. Descansando: espaço para a barra flutuante, que
            // senão cobre os botões de navegação.
            paddingBottom={
              foco ? 360 : Math.max(insets.bottom, spacing.md) + (descanso !== null ? 76 : 8)
            }
            onEditar={abrirCampo}
            onConcluir={(idx) => concluirSerie(ex, idx)}
            onAddSerie={() =>
              setSeries((p) => ({
                ...p,
                [ex.id]: [...(p[ex.id] ?? []), { peso: '', reps: '', concluida: false }],
              }))
            }
            onTrocar={() => abrirTroca(ex)}
            onDetalhe={() => setDetalhe(ex)}
            onProximo={() => irPara(i + 1)}
            onAnterior={() => irPara(i - 1)}
          />
        ))}

        {exercicios.length === 0 ? (
          <View style={{ width, padding: spacing.lg }}>
            <Card>
              <Txt v="h3">Este treino não tem exercícios</Txt>
              <Txt v="small">Volte e adicione exercícios ao dia antes de treinar.</Txt>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Descanso: flutua sobre a página para não empurrar o conteúdo ── */}
      {descansoAtivo && descanso !== null && !foco ? (
        <BarraDescanso
          segundos={descanso}
          acao={descansoAtivo}
          bottom={Math.max(insets.bottom, spacing.md)}
          onPular={encerrarDescanso}
        />
      ) : null}

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
            rotulo={
              (foco.campo === 'peso' ? 'Peso · série ' : 'Repetições · série ') + (foco.serie + 1)
            }
            unidade={foco.campo === "peso" ? "kg" : "reps"}
            anilhas={foco.campo === "peso"}
            contexto={(() => {
              const s0 = series[foco.exId]?.[foco.serie];
              const outro = foco.campo === 'peso' ? s0?.reps : s0?.peso;
              return {
                rotulo: foco.campo === 'peso' ? 'reps' : 'kg',
                valor: outro || '—',
              };
            })()}
          />
        </View>
      ) : null}

      {/* ── Detalhes do exercício ── */}
      <Sheet
        aberto={!!detalhe}
        onFechar={() => setDetalhe(null)}
        titulo={detalhe?.nome ?? ''}
        altura={0.85}
      >
        {detalhe ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.lg }}>
              <View style={s.explicaDescanso}>
                <Ionicons name="timer-outline" size={16} color={colors.info} />
                <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
                  {porqueDescanso(detalhe.nome, detalhe.descanso_seg)}
                </Txt>
              </View>

              {detalhe.instrucoes ? (
                <View style={{ gap: spacing.md }}>
                  <Txt v="label">Execução</Txt>
                  {detalhe.instrucoes.split('|').map((p, i) => (
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
                  ))}
                </View>
              ) : null}

              {detalhe.dica ? (
                <View style={s.dica}>
                  <Ionicons name="bulb" size={15} color={colors.warn} />
                  <Txt v="small" cor={colors.warn} style={{ flex: 1 }}>
                    {detalhe.dica}
                  </Txt>
                </View>
              ) : null}

              <Button
                titulo="Trocar exercício"
                variante="secundario"
                full
                onPress={() => abrirTroca(detalhe)}
              />
            </View>
          </ScrollView>
        ) : null}
      </Sheet>

      {/* ── Sair: pausar ou cancelar ── */}
      <Sheet aberto={saindo} onFechar={() => setSaindo(false)} titulo="Sair do treino" altura={0.62}>
        <View style={{ gap: spacing.lg }}>
          <View style={s.resumoFim}>
            <ItemResumo label="Duração" valor={duracao(decorrido)} />
            <ItemResumo label="Séries" valor={String(totalSeries)} />
            <ItemResumo label="Volume" valor={volume(volumeAtual)} />
          </View>

          <Button
            titulo="Pausar e continuar depois"
            icone="pause-circle-outline"
            variante="secundario"
            full
            tam="lg"
            onPress={() => {
              // O treino continua aberto: a home mostra "treino em andamento"
              // e o cronômetro segue contando do horário de início.
              setSaindo(false);
              encerrarDescanso();
              router.replace('/');
            }}
          />

          <Button
            titulo="Concluir agora"
            icone="checkmark-circle-outline"
            variante="sucesso"
            full
            onPress={() => {
              setSaindo(false);
              setConfirmandoFim(true);
            }}
          />

          <View style={{ gap: spacing.sm }}>
            <Txt v="small" cor={colors.textFaint}>
              {totalSeries > 0
                ? `Cancelar apaga as ${totalSeries} série${totalSeries > 1 ? 's' : ''} deste treino. ` +
                  'Recordes que saíram daqui também somem. Não dá para desfazer.'
                : 'Nenhuma série registrada — cancelar não perde nada.'}
            </Txt>
            <Button
              titulo="Cancelar treino"
              icone="trash-outline"
              variante="perigo"
              full
              carregando={salvando}
              onPress={abandonar}
            />
          </View>
        </View>
      </Sheet>

      {/* ── Nota de setup ── */}
      <Sheet
        aberto={!!editandoNota}
        onFechar={() => setEditandoNota(null)}
        titulo={editandoNota?.nome ?? ''}
        altura={0.62}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt v="small" cor={colors.textFaint}>
            Altura do banco, número do pino, largura da pegada. É o que o personal anota no papel —
            e o que some quando você volta de férias ou troca de academia.
          </Txt>
          <Input
            rotulo="Como você monta este exercício"
            value={textoNota}
            onChangeText={setTextoNota}
            placeholder="Banco no furo 3, pegada na marca de fora"
            multiline
          />
          <Button
            titulo="Salvar"
            full
            tam="lg"
            onPress={async () => {
              if (!editandoNota) return;
              await salvarNota(editandoNota.exercise_id, textoNota);
              setNotas((p) => ({ ...p, [editandoNota.exercise_id]: textoNota.trim() }));
              buzz.ok();
              setEditandoNota(null);
            }}
          />
        </View>
      </Sheet>

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
        </View>
      </Sheet>

      {/* ── Trocar exercício ── */}
      <Sheet
        aberto={!!trocando}
        onFechar={() => setTrocando(null)}
        titulo={`Trocar ${trocando?.nome ?? ''}`}
        altura={0.8}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt v="small" cor={colors.textFaint}>
            A troca vale só para o treino de hoje. Sua rotina continua como está.
          </Txt>

          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Por quê?</Txt>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {MOTIVOS_TROCA.map((m) => (
                <Chip
                  key={m.chave}
                  label={m.label}
                  emoji={m.emoji}
                  ativo={motivoTroca === m.chave}
                  onPress={() => setMotivoTroca(m.chave)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Trocar por</Txt>
            {substitutos.length === 0 ? (
              <Txt v="small" cor={colors.textFaint}>
                Buscando alternativas…
              </Txt>
            ) : (
              substitutos.map((sub) => (
                <Card key={sub.id} onPress={() => confirmarTroca(sub.id)} padding={spacing.md}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={s.subIcone}>
                      <Ionicons name="swap-horizontal" size={16} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3">{sub.nome}</Txt>
                      <Txt v="small" cor={colors.textFaint} size={11}>
                        {sub.equipamento ?? 'livre'} · descanso{' '}
                        {descansoCorreto(sub.nome, 10, sub.grupo_primario)}s
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </Card>
              ))
            )}
          </View>
        </View>
      </Sheet>

      <Celebrar item={comemorar} onFechar={() => setComemorar(null)} />
    </View>
  );
}

// ─────────────────────────── Trilha ───────────────────────────

/**
 * Linha do tempo do treino.
 *
 * Serve a duas perguntas que aparecem sozinhas no meio de uma série: quanto
 * falta, e o que vem depois. Cada bolinha é um exercício; verde é o que já
 * fechou. Tocar pula direto — útil quando o aparelho está ocupado e você faz
 * outro antes de voltar.
 */
const Trilha = ({
  ref,
  exercicios,
  series,
  atual,
  concluidos,
  completoDe,
  onIr,
}: {
  ref: React.RefObject<ScrollView | null>;
  exercicios: RoutineExerciseFull[];
  series: Record<number, Serie[]>;
  atual: number;
  concluidos: number;
  completoDe: (arr: Serie[] | undefined) => boolean;
  onIr: (i: number) => void;
}) => {
  return (
    <View style={s.trilhaBox}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.trilha}
      >
        {exercicios.map((ex, i) => {
          const arr = series[ex.id] ?? [];
          const feitas = arr.filter((x) => x.concluida).length;
          const pronto = completoDe(arr);
          const ativo = i === atual;

          return (
            <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 ? (
                <View
                  style={[
                    s.traco,
                    (pronto || completoDe(series[exercicios[i - 1].id])) && {
                      backgroundColor: colors.success,
                    },
                  ]}
                />
              ) : null}
              <Press onPress={() => onIr(i)} scale={0.88} haptic="selecao">
                <View
                  style={[
                    s.bola,
                    pronto && s.bolaPronta,
                    ativo && s.bolaAtiva,
                    ativo && pronto && { borderColor: colors.success },
                  ]}
                >
                  {pronto ? (
                    <Ionicons name="checkmark" size={16} color="#00251A" />
                  ) : (
                    <Txt
                      v="small"
                      size={11}
                      bold
                      cor={ativo ? colors.primary : colors.textFaint}
                    >
                      {feitas > 0 ? `${feitas}/${arr.length}` : i + 1}
                    </Txt>
                  )}
                </View>
              </Press>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.contagem}>
        <Txt v="small" size={11} cor={colors.textFaint}>
          {concluidos}/{exercicios.length}
        </Txt>
      </View>
    </View>
  );
};

// ─────────────────────────── Página do exercício ───────────────────────────

function PaginaExercicio({
  largura,
  ex,
  ativo,
  perto,
  nota,
  onNota,
  posicao,
  total,
  series,
  anteriores,
  foco,
  compacto,
  paddingBottom,
  onEditar,
  onConcluir,
  onAddSerie,
  onTrocar,
  onDetalhe,
  onProximo,
  onAnterior,
}: {
  largura: number;
  ex: RoutineExerciseFull;
  ativo: boolean;
  /** Página visível ou vizinha — só essas carregam mídia. */
  perto: boolean;
  nota: string;
  onNota: () => void;
  posicao: number;
  total: number;
  series: Serie[];
  anteriores: SerieAnterior[];
  foco: Foco;
  compacto: boolean;
  paddingBottom: number;
  onEditar: (exId: number, serie: number, campo: 'peso' | 'reps') => void;
  onConcluir: (idx: number) => void;
  onAddSerie: () => void;
  onTrocar: () => void;
  onDetalhe: () => void;
  onProximo: () => void;
  onAnterior: () => void;
}) {
  const feitas = series.filter((x) => x.concluida).length;
  const completo = feitas === series.length && series.length > 0;
  const porTempo = ex.tipo_carga === 'tempo';

  const rolagem = useRef<ScrollView>(null);
  const yTabela = useRef(0);
  const yLinha = useRef<number[]>([]);
  const editando = foco?.exId === ex.id ? foco.serie : null;

  /**
   * Traz a linha em edição para cima do teclado.
   *
   * O NumberPad come mais de metade da tela; a partir da terceira série a linha
   * que você acabou de tocar fica atrás dele — você digita às cegas.
   */
  useEffect(() => {
    if (editando === null) return;
    const y = yLinha.current[editando];
    if (y === undefined) return;
    const t = setTimeout(
      () => rolagem.current?.scrollTo({ y: Math.max(0, yTabela.current + y - 90), animated: true }),
      60
    );
    return () => clearTimeout(t);
  }, [editando]);

  return (
    <View style={{ width: largura }}>
      <ScrollView
        ref={rolagem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.pagina, { paddingBottom }]}
      >
        {/* Cabeçalho: vídeo em pé à esquerda, identificação à direita.
            O Short é 9:16 — numa faixa larga ele apareceria do tamanho de um
            selo, com tarja preta ocupando o resto. Em pé, ao lado do texto,
            usa o mesmo espaço e mostra o quadro inteiro. Some quando o teclado
            abre, para a tabela de séries não sair da tela. */}
        {!compacto ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={s.cabecalho}
          >
            <MidiaExercicio
              nome={ex.nome}
              mediaUrl={ex.media_url}
              largura={116}
              parado={!perto}
              // Oito páginas carregando miniatura ao mesmo tempo travava a
              // tela; só a página visível e as vizinhas montam a imagem.
              montar={perto}
            />

            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Txt v="h2" numberOfLines={3} size={19} style={{ flex: 1 }}>
                  {ex.nome}
                </Txt>
                <Press onPress={onDetalhe} style={s.iconeMini} scale={0.9}>
                  <Ionicons name="information-circle-outline" size={19} color={colors.textDim} />
                </Press>
              </View>

              <Txt v="small" cor={colors.textFaint} size={11}>
                {posicao + 1} de {total} · {nomeGrupo(ex.grupo_primario)}
              </Txt>

              <View style={s.metaLinha}>
                <View style={s.tag}>
                  <Ionicons name="repeat" size={10} color={colors.textDim} />
                  <Txt v="small" size={10} cor={colors.textDim} bold>
                    {ex.series_alvo} × {ex.reps_min}-{ex.reps_max}
                  </Txt>
                </View>
                {ex.descanso_seg > 0 ? (
                  <View style={[s.tag, { backgroundColor: colors.infoSoft }]}>
                    <Ionicons name="timer-outline" size={10} color={colors.info} />
                    <Txt v="small" size={10} cor={colors.info} bold>
                      {descansoLegivel(ex.descanso_seg)}
                    </Txt>
                  </View>
                ) : null}
              </View>

              <Press onPress={onNota} style={nota ? s.notaCheia : s.notaVazia} scale={0.97}>
                <Ionicons
                  name={nota ? 'bookmark' : 'bookmark-outline'}
                  size={13}
                  color={nota ? colors.warn : colors.textFaint}
                />
                <Txt
                  v="small"
                  size={11}
                  cor={nota ? colors.warn : colors.textFaint}
                  numberOfLines={2}
                  style={{ flex: 1 }}
                >
                  {nota || 'Anotar altura do banco, pino, pegada…'}
                </Txt>
              </Press>

              <Press onPress={onTrocar} style={s.trocar} scale={0.95}>
                <Ionicons name="swap-horizontal" size={15} color={colors.info} />
                <Txt v="small" size={12} cor={colors.info} bold>
                  Trocar
                </Txt>
              </Press>
            </View>
          </Animated.View>
        ) : null}

        {/* Séries */}
        <View
          style={[s.tabela, completo && s.tabelaPronta]}
          onLayout={(e) => {
            yTabela.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={s.thead}>
            <Txt v="label" style={{ width: 24 }}>
              #
            </Txt>
            <Txt v="label" style={{ flex: 1 }}>
              Anterior
            </Txt>
            <Txt v="label" style={{ width: 74, textAlign: 'center' }}>
              {porTempo ? 'Seg' : 'Kg'}
            </Txt>
            <Txt v="label" style={{ width: 58, textAlign: 'center' }}>
              {porTempo ? '—' : 'Reps'}
            </Txt>
            <View style={{ width: 36 }} />
          </View>

          {series.map((serie, i) => (
            <LinhaSerie
              key={i}
              idx={i}
              onMedir={(y) => {
                yLinha.current[i] = y;
              }}
              serie={serie}
              anterior={anteriores[i]}
              porTempo={porTempo}
              focoPeso={foco?.exId === ex.id && foco.serie === i && foco.campo === 'peso'}
              focoReps={foco?.exId === ex.id && foco.serie === i && foco.campo === 'reps'}
              onEditarPeso={() => onEditar(ex.id, i, 'peso')}
              onEditarReps={() => onEditar(ex.id, i, 'reps')}
              onConcluir={() => onConcluir(i)}
            />
          ))}

          <Press onPress={onAddSerie} style={s.addSerie} haptic="leve">
            <Ionicons name="add" size={15} color={colors.textFaint} />
            <Txt v="small" size={12} cor={colors.textFaint}>
              Adicionar série
            </Txt>
          </Press>
        </View>

        {/* Navegação explícita — deslizar funciona, mas nem todo mundo descobre */}
        {!compacto ? (
          <View style={s.navLinha}>
            <Press
              onPress={onAnterior}
              style={[s.navBtn, posicao === 0 && s.navOff]}
              disabled={posicao === 0}
              scale={0.94}
            >
              <Ionicons
                name="chevron-back"
                size={17}
                color={posicao === 0 ? colors.textFaint : colors.textDim}
              />
              <Txt v="small" size={12} cor={posicao === 0 ? colors.textFaint : colors.textDim}>
                Anterior
              </Txt>
            </Press>
            <Press
              onPress={onProximo}
              style={[
                s.navBtn,
                posicao >= total - 1 && s.navOff,
                completo && posicao < total - 1 && s.navPronto,
              ]}
              disabled={posicao >= total - 1}
              scale={0.94}
            >
              <Txt
                v="small"
                size={12}
                bold={completo}
                cor={
                  posicao >= total - 1
                    ? colors.textFaint
                    : completo
                      ? colors.success
                      : colors.textDim
                }
              >
                Próximo
              </Txt>
              <Ionicons
                name="chevron-forward"
                size={17}
                color={
                  posicao >= total - 1
                    ? colors.textFaint
                    : completo
                      ? colors.success
                      : colors.textDim
                }
              />
            </Press>
          </View>
        ) : null}
      </ScrollView>
    </View>
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
  onMedir,
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
  onMedir: (y: number) => void;
}) {
  return (
    <View
      style={[s.linha, serie.concluida && { backgroundColor: colors.successSoft }]}
      onLayout={(e) => onMedir(e.nativeEvent.layout.y)}
    >
      <Txt v="small" cor={colors.textFaint} style={{ width: 24 }}>
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
        <Txt v="h3" center cor={serie.peso ? colors.text : colors.textFaint} style={{ width: '100%' }}>
          {serie.peso || (anterior?.peso_kg ? fmtPeso(anterior.peso_kg) : '—')}
        </Txt>
      </Press>

      <Press
        onPress={onEditarReps}
        haptic={false}
        style={[s.campo, { width: 58 }, focoReps && s.campoFoco]}
      >
        <Txt v="h3" center cor={serie.reps ? colors.text : colors.textFaint} style={{ width: '100%' }}>
          {serie.reps || (anterior?.reps ? String(anterior.reps) : '—')}
        </Txt>
      </Press>

      <Press onPress={onConcluir} haptic={false} scale={0.85} style={s.check}>
        <View style={[s.checkBox, serie.concluida && s.checkOn]}>
          <Ionicons name="checkmark" size={17} color={serie.concluida ? '#00251A' : colors.textFaint} />
        </View>
      </Press>
    </View>
  );
}

// ─────────────────────────── Descanso ───────────────────────────

function BarraDescanso({
  segundos,
  acao,
  bottom,
  onPular,
}: {
  segundos: number;
  acao: DescansoAtivo;
  bottom: number;
  onPular: () => void;
}) {
  const pulso = useSharedValue(1);
  const acabou = segundos <= 0;

  useEffect(() => {
    if ((segundos <= 5 && segundos > 0) || segundos === 0) {
      pulso.value = withSequence(withTiming(1.06, { duration: 240 }), withSpring(1));
    }
  }, [segundos, pulso]);

  const st = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  // O que fazer quando o descanso acabar — evita o "e agora?" olhando a tela.
  const fechou = acao.serieFeita >= acao.serieTotal;
  const proximo = fechou
    ? acao.proximo
      ? `Agora: ${acao.proximo}`
      : 'Exercício concluído'
    : `Próxima série: ${acao.serieFeita + 1} de ${acao.serieTotal}`;

  const cor = acabou ? colors.success : colors.primary;

  return (
    <Animated.View
      entering={SlideInDown.duration(240)}
      style={[
        s.descanso,
        st,
        { bottom },
        acabou && { backgroundColor: '#0D2A22', borderColor: colors.success },
      ]}
    >
      <Ionicons name={acabou ? 'checkmark-circle' : 'timer-outline'} size={20} color={cor} />
      <View style={{ minWidth: 62 }}>
        <Txt v="h2" cor={cor}>
          {cronometro(segundos)}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="small" cor={cor} bold>
          {acabou ? proximo : 'Descanso'}
        </Txt>
        {acabou && segundos < -30 ? (
          <Txt v="small" size={11} cor={colors.textFaint}>
            {Math.abs(Math.round(segundos / 60))} min além do intervalo
          </Txt>
        ) : !acabou ? (
          <Txt v="small" size={11} cor={colors.textFaint} numberOfLines={1}>
            {fechou && acao.proximo
              ? `Fechou ${acao.exercicio}. Depois: ${acao.proximo}`
              : `${acao.exercicio} · ${acao.serieFeita}/${acao.serieTotal}`}
          </Txt>
        ) : null}
      </View>
      <Press onPress={onPular} style={s.pular} haptic="leve">
        <Txt v="small" cor={colors.textDim} bold>
          {acabou ? 'Ok' : 'Pular'}
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

  // Trilha
  trilhaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trilha: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  traco: { width: 16, height: 2, backgroundColor: colors.border },
  bola: {
    width: BOLA,
    height: BOLA,
    borderRadius: BOLA / 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolaPronta: { backgroundColor: colors.success, borderColor: colors.success },
  bolaAtiva: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  contagem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  // Página
  // flexGrow em vez de flex: a página ocupa a tela inteira quando cabe, e vira
  // rolagem vertical quando não cabe (celular baixo, exercício com 6 séries).
  pagina: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  cabecalho: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  metaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  notaVazia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  notaCheia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  trocar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },
  iconeMini: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Séries
  tabela: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabelaPronta: { borderColor: colors.success },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: 2,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  campo: {
    width: 74,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campoFoco: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: { width: 36, alignItems: 'flex-end' },
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
    gap: 5,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },

  // Navegação
  navLinha: { flexDirection: 'row', gap: spacing.sm, marginTop: 'auto' },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  navOff: { opacity: 0.4 },
  navPronto: { backgroundColor: colors.successSoft },

  // Descanso flutuante
  descanso: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#2A1206',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pular: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },

  pad: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  // Sheets
  explicaDescanso: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
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
  subIcone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
