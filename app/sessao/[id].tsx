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
import { ALVO_TOQUE, colors, HIT, HIT_MIN, radius, spacing } from '@/theme';
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
  exerciciosDaSessao,
  faseDaSessao,
  finalizarSessao,
  getSessao,
  registrarSerie,
  seriesDaSessao,
  notasDoDia,
  salvarNota,
  adicionarDorNoPerfil,
  dorRepetida,
  substituirExercicio,
  substitutosDisponiveis,
  ultimaExecucao,
  type SerieAnterior,
} from '@/features/treino/api';
import { modularSeries, type FaseEfetiva } from '@/features/treino/fase';
import {
  avaliarProgressao,
  pesoDeVolta,
  type Progressao,
} from '@/features/treino/progressao';
import { MOTIVOS_TROCA } from '@/features/treino/classificacao';
import type { RecusaTroca } from '@/features/treino/substituicao';
import { aquecimento, type SerieAquecimento } from '@/features/treino/anilhas';
import { SEG_DESCANSO_APROXIMACAO } from '@/features/treino/duracao';
import { hidratarSeries, inserirAproximacoes, type LinhaDeSerie } from '@/features/treino/series';
import {
  campoDepoisDeConfirmar,
  pisoDeLinhas,
  precisaTeclado,
  prePreencher,
  removerSerie,
  valorHerdado,
  type ContextoHeranca,
} from '@/features/treino/registro';
import {
  ABRE_O_GRUPO,
  descansoCorreto,
  LABEL_PAPEL,
  papeisDaRotina,
  porqueDescanso,
  rirNaFase,
  textoRir,
  type Papel,
  type PapelDaLinha,
} from '@/features/treino/papel';
import { PORQUE_PAPEL, porqueEsteExercicio } from '@/features/treino/porque';
import { execucaoDe, PORQUE_CADENCIA, resumoDeExecucao } from '@/features/treino/execucao';
import { tecnicasDaSessao } from '@/features/treino/tecnicas';
import {
  avisarFimDoDescanso,
  lerDescanso,
  manterAcordado,
  pedirPermissaoAviso,
  restantes,
  salvarDescanso,
  type DescansoAtivo,
} from '@/features/treino/descanso';
import {
  agendarFimDoDescanso,
  cancelarAlarmeDescanso,
  pedirPermissao as pedirPermissaoSistema,
} from '@/features/notificacoes/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { checkin } from '@/features/liga/api';
import type { Exercise, PersonalRecord, RoutineExerciseFull } from '@/db/types';
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

/**
 * A linha de série da tela — definida em `series.ts`, com as operações que
 * mexem nela. O tipo mora lá porque as operações moram lá: enquanto elas
 * viviam dentro deste componente, `serie_index` colidia sem ninguém ver.
 *
 * A marca de aquecimento vai para o banco como `set_logs.tipo = 'aquecimento'`,
 * que todas as queries de volume, PR e histórico já excluem.
 */
type Serie = LinhaDeSerie;

type Foco = { exId: number; serie: number; campo: 'peso' | 'reps' } | null;

/**
 * Diâmetro DESENHADO da bolinha da trilha, o traço que liga uma na outra, e o
 * passo do scroll.
 *
 * O círculo continua com 30 (a densidade da trilha é proposital: com 10
 * exercícios ela precisa caber na largura), mas a área clicável é
 * `ALVO_TOQUE.bola` — 44×52. O passo do scroll é a área, não o círculo: era
 * `BOLA + traço` e virou `alvo + traço`, senão a trilha centraliza no lugar
 * errado depois do salto.
 */
const BOLA = 30;
const TRACO = 16;

/**
 * Largura da coluna do número da série.
 *
 * Não está em `ALVO_TOQUE` de propósito: desde esta fase ela não é alvo de
 * toque nenhum, é só rótulo. Os 22 pt que sobraram da caixa de 44 que o
 * toggle de aquecimento tentava ter foram para a coluna "Anterior".
 */
const COL_NUMERO = 22;
const PASSO = ALVO_TOQUE.bola.largura + TRACO;

/**
 * O que o contexto da sessão empresta para a herança de carga.
 *
 * Uma função só, consumida pelo pré-preenchimento (na abertura), pelo campo
 * que se toca (`abrirCampo`) e pela troca de exercício. Enquanto a regra
 * estava escrita em dois lugares, o caminho automático herdava diferente do
 * caminho manual — e era o automático que estava errado.
 */
function contextoDe(
  ex: RoutineExerciseFull,
  fase: FaseEfetiva | null,
  sug: Progressao | null
): ContextoHeranca {
  const pesoReps = ex.tipo_carga === 'peso_reps';
  return {
    porTempo: ex.tipo_carga === 'tempo',
    readaptacao:
      pesoReps && fase?.fase === 'readaptacao' && fase.cargaPct != null && fase.retomadaEmMs != null
        ? { cargaPct: fase.cargaPct, retomadaEmMs: fase.retomadaEmMs }
        : null,
    pesoSugerido: pesoReps && sug?.acao === 'subir' ? sug.pesoSugerido : null,
  };
}

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
  /** Fase do plano desta sessão (deload, readaptação…) — modula alvo e herança. */
  const [fase, setFase] = useState<FaseEfetiva | null>(null);
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
  /**
   * O que ficou de fora da lista de troca, e por quê.
   *
   * A lista passou a ser filtrada por dor e por local: sem dizer o motivo, uma
   * lista curta (ou vazia) no meio do treino parece o app quebrado. "O militar
   * não está aqui porque você marcou dor no ombro" é a diferença entre confiar
   * na lista e sair procurando exercício na mão.
   */
  const [recusados, setRecusados] = useState<RecusaTroca[]>([]);
  /** `null` até a lista chegar — é o que distingue "carregando" de "não tem". */
  const [buscandoTroca, setBuscandoTroca] = useState(false);
  const [motivoTroca, setMotivoTroca] = useState('ocupado');
  /**
   * "Você já trocou este por dor 2×. Quer marcar no perfil?"
   *
   * O motivo `dor` era gravado e nunca lido. Agora ele volta como pergunta —
   * uma vez, com o número de vezes na frase, e só quando a região ainda não
   * está no perfil.
   */
  const [sugestaoDor, setSugestaoDor] = useState<{
    regiao: string;
    label: string;
    vezes: number;
    exercicio: string;
  } | null>(null);
  const [detalhe, setDetalhe] = useState<RoutineExerciseFull | null>(null);
  /** "Banco no furo 3", "pino 7" — o que se perde ao voltar de férias. */
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [editandoNota, setEditandoNota] = useState<RoutineExerciseFull | null>(null);
  const [textoNota, setTextoNota] = useState('');
  /**
   * Gravação que falhou, com o gesto para repetir. Sem isto a série ficava
   * verde na tela e fora do banco — a perda só aparecia no dia seguinte.
   */
  // `retry` opcional: o mesmo banner serve para erro que dá para repetir e para
  // recusa que precisa ser EXPLICADA. Recusar em silêncio (só uma vibração) é
  // como o app ensina que o toque não funciona.
  const [falha, setFalha] = useState<{ mensagem: string; retry?: () => void } | null>(null);
  /**
   * A linha cujo menu está aberto — os dois gestos secundários da série.
   *
   * ── A tensão que esta fase teve que resolver ────────────────────────────
   *
   * G2 pôs o toggle de aquecimento NO NÚMERO da série, com `hitSlop` para
   * chegar a 44 pt. Duas coisas quebraram isso: (1) `hitSlop` é ignorado pelo
   * `Pressable` do react-native-web, e o PWA é o app real — medido, o alvo
   * tinha 24×18; (2) a linha tem 326 pt úteis a 390 de tela, e o check
   * precisava crescer de 34 para 52. Não cabiam os dois.
   *
   * A conta que decidiu: concluir série acontece ~20×/treino; marcar
   * aquecimento e remover linha, 0-2×/treino. Então o check fica com o alvo
   * primário (52 pt, borda direita, onde o polegar está) e os dois gestos
   * raros saem para o toque longo em QUALQUER ponto da linha — que não custa
   * largura nenhuma, funciona no web (`onLongPress` é implementado, ao
   * contrário de `hitSlop`) e ainda ganha o que não tinha: rótulo escrito e
   * espaço para EXPLICAR quando a ação é recusada.
   *
   * Saldo medido por treino de 20 séries: −80 toques no gesto principal,
   * +2 no secundário.
   */
  const [menuLinha, setMenuLinha] = useState<{ exId: number; idx: number } | null>(null);
  /** Cancelar com série registrada pede dois toques; o timer desarma o 1º. */
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const timerCancelar = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Já alarmou este descanso? Sem isso o alarme repete a cada segundo. */
  const alarmado = useRef<number | null>(null);

  /**
   * Espelhos do estado para os handlers assíncronos e para o retry do banner:
   * a closure de um retry pode ser de vários renders atrás, e decidir por um
   * snapshot velho é o que duplicava série. Quem grava lê SEMPRE daqui.
   */
  /**
   * O papel de cada linha — a MESMA função que a tela do dia usa.
   *
   * Antes o executor deduzia com `eh_composto ? 'principal' : 'isolador'` e a
   * tela do dia com `papeisDaSessao`: numa rotina anterior à v16 o supino
   * inclinado saía "Complementar · RIR 1-2" no plano e "Principal · RIR 2-3"
   * aqui — o executor mandando treinar mais longe da falha do que o plano
   * prescreve, na mesma linha do mesmo treino.
   */
  const papeis = useMemo(
    () =>
      papeisDaRotina(
        exercicios.map((e) => ({
          id: e.id,
          nome: e.nome,
          grupo: e.grupo_primario,
          equipamento: e.equipamento,
          tipoCarga: e.tipo_carga,
          papel: e.papel,
        }))
      ),
    [exercicios]
  );

  /**
   * A técnica de intensidade de cada linha — B7, e a fase decide.
   *
   * O mapa é por ID de linha, não por posição: `addExercicioNoDia` insere com
   * `MAX(ordem)+1`, ou seja depois do cardio, e indexar por posição daria a
   * técnica ao exercício errado a partir do primeiro acréscimo manual — o mesmo
   * motivo pelo qual `papeisDaRotina` devolve por id.
   *
   * `fase` entra como dependência de propósito: na readaptação e no deload o
   * mapa é vazio, e é ele que some da tela quando a semana vira.
   */
  const tecnicas = useMemo(() => {
    const linhas = exercicios.map((e) => ({
      id: e.id,
      nome: e.nome,
      grupo: e.grupo_primario,
      equipamento: e.equipamento,
      tipoCarga: e.tipo_carga,
      papel: papeis.get(e.id)?.papel ?? null,
    }));
    const mapa = tecnicasDaSessao(linhas, fase?.fase ?? null);
    const porId = new Map<number, ReturnType<typeof tecnicasDaSessao> extends Map<infer _K, infer V> ? V : never>();
    for (const [linha, t] of mapa) porId.set(linha.id, t);
    return porId;
  }, [exercicios, papeis, fase]);

  const tecnicaDe = useCallback(
    (ex: { id: number } | null) => (ex ? (tecnicas.get(ex.id) ?? null) : null),
    [tecnicas]
  );

  const seriesRef = useRef(series);
  seriesRef.current = series;
  // O mesmo espelho para o histórico: `criarAproximacoes` precisa da carga da
  // última sessão sem virar dependência de callback.
  const anterioresRef = useRef(anteriores);
  anterioresRef.current = anteriores;
  const exerciciosRef = useRef(exercicios);
  exerciciosRef.current = exercicios;

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
      void pedirPermissaoSistema();
      const sessao = await getSessao(sessionId);
      if (!sessao) return router.back();
      setNome(sessao.nome);
      setInicio(sessao.iniciado_em);

      // Pela sessão, não pelo dia: as trocas de exercício desta sessão vêm
      // aplicadas por cima do template — inclusive ao retomar treino pausado.
      const lista = sessao.routine_day_id ? await exerciciosDaSessao(sessionId) : [];
      setExercicios(lista);

      // A fase (deload, readaptação…) entra ANTES de montar o estado: é ela
      // que decide quantas séries a semana pede. Nada é gravado — sessão
      // antiga ou sem plano ativo resolve para null e abre como sempre abriu.
      // Falha aqui não pode derrubar o load: sem fase, o treino abre como
      // sempre abriu — perder a modulação é barato, perder a sessão não.
      const faseSessao = await faseDaSessao(sessionId).catch(() => null);
      setFase(faseSessao);

      // Recupera o que já foi registrado — o app pode ter sido fechado no meio.
      const jaFeitas = await seriesDaSessao(sessionId);
      const estado: Record<number, Serie[]> = {};
      const hist: Record<number, SerieAnterior[]> = {};

      for (const ex of lista) {
        const doEx = jaFeitas.filter((s) => s.exercise_id === ex.exercise_id);
        // Alvo modulado pela fase; série já gravada nunca some do estado. A
        // cobertura é pelo MAIOR serie_index, não pela contagem: com índices
        // esparsos (série 3 gravada, 1 desmarcada) e a fase mudando entre
        // aberturas, contar esconderia série que continua no banco.
        const total = Math.max(
          modularSeries(ex.series_alvo, faseSessao),
          doEx.length ? Math.max(...doEx.map((x) => x.serie_index)) + 1 : 0
        );
        // A hidratação mora em `series.ts` e é a MESMA função que o teste
        // exercita — enquanto ela vivia aqui dentro, a única forma de conferir
        // que nada colide ou some era gravar série no app e recarregar a
        // página na mão.
        hist[ex.id] = await ultimaExecucao(ex.exercise_id, sessionId);
        // A carga da última vez entra NO ESTADO aqui, não como placeholder:
        // é o que faz o check gravar em 1 toque em vez de abrir o teclado.
        // A sugestão de progressão é calculada agora porque a herança precisa
        // dela — o número herdado tem que ser o mesmo que o selo promete.
        const sug = avaliarProgressao(
          hist[ex.id],
          ex.reps_min ?? 8,
          ex.reps_max ?? 12,
          ex.grupo_primario,
          ex.tipo_carga,
          faseSessao
        );
        estado[ex.id] = prePreencher(
          hidratarSeries(doEx, modularSeries(ex.series_alvo, faseSessao)),
          hist[ex.id],
          contextoDe(ex, faseSessao, sug)
        );
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
    void cancelarAlarmeDescanso(); // seguiu antes: o alarme não pode tocar depois
  }, []);

  /** Some sozinho depois de 5 min de atraso: a essa altura virou intervalo. */
  useEffect(() => {
    if (descanso !== null && descanso <= -300) encerrarDescanso();
  }, [descanso, encerrarDescanso]);

  // Sair da tela não pode deixar o silêncio tocando para sempre.
  useEffect(() => () => manterAcordado(false), []);

  // Aquecimento fora da conta, igual ao que o banco faz: é a mesma régua de
  // `finalizarSessao`, `historicoSessoes` e `estatisticas`. Mostrar "6 séries"
  // e gravar 4 seria a tela discordando do histórico dela mesma.
  const totalSeries = useMemo(
    () =>
      Object.values(series).reduce(
        (a, arr) => a + arr.filter((x) => x.concluida && !x.aquecimento).length,
        0
      ),
    [series]
  );
  const volumeAtual = useMemo(
    () =>
      Object.values(series).reduce(
        (a, arr) =>
          a +
          arr
            // Mesma exclusão do `recalcularVolume` do banco: aquecimento nunca
            // é volume. Sem isto o número da tela subia e o do histórico não.
            .filter((x) => x.concluida && !x.aquecimento)
            .reduce(
              (b, x) =>
                b + (parseFloat(x.peso.replace(',', '.')) || 0) * (parseInt(x.reps, 10) || 0),
              0
            ),
        0
      ),
    [series]
  );

  /**
   * Progressão dupla por exercício, só com o que a tela já carregou: bateu o
   * topo da faixa em todas as séries da última sessão → sugerir subida.
   * É sugestão de apresentação — nada grava, nada bloqueia, e digitar outro
   * valor por cima é sempre possível.
   */
  const sugestoes = useMemo(() => {
    const out: Record<number, Progressao | null> = {};
    for (const ex of exercicios) {
      out[ex.id] = avaliarProgressao(
        anteriores[ex.id] ?? [],
        ex.reps_min ?? 8,
        ex.reps_max ?? 12,
        ex.grupo_primario,
        ex.tipo_carga,
        fase
      );
    }
    return out;
  }, [exercicios, anteriores, fase]);

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

      // Rede de segurança: com o pré-preenchimento da abertura o campo quase
      // nunca chega vazio aqui. Quase — exercício trocado no meio da sessão e
      // linha criada à mão chegam. A regra de herança é a MESMA função, para
      // não voltar a existir duas.
      if (!valor) {
        const hist = anteriores[exId] ?? [];
        const ex = exerciciosRef.current.find((e) => e.id === exId);
        if (ex) {
          valor = valorHerdado(
            campo,
            hist[serie] ?? hist[hist.length - 1],
            contextoDe(ex, fase, sugestoes[exId] ?? null)
          );
        }
      }
      setBuffer(valor);
      setFoco({ exId, serie, campo });
      buzz.selecao();
    },
    [series, anteriores, sugestoes, fase]
  );

  function aplicarBuffer() {
    if (!foco) return;
    setSeries((prev) => {
      const arr = [...(prev[foco.exId] ?? [])];
      // `herdado: false` porque o dedo passou por aqui: o valor deixa de ser
      // referência da semana passada e vira dado de hoje, inclusive na cor.
      arr[foco.serie] = { ...arr[foco.serie], [foco.campo]: buffer, herdado: false };
      return { ...prev, [foco.exId]: arr };
    });
  }

  /** Série já gravada: a correção precisa descer para o banco, não só para a tela. */
  async function persistirCorrecao(exId: number, idx: number, campo: 'peso' | 'reps', novo: string) {
    const s = seriesRef.current[exId]?.[idx];
    if (!s?.salvaId) return;
    const ex = exerciciosRef.current.find((e) => e.id === exId);
    if (!ex) return;

    const pesoStr = campo === 'peso' ? novo : s.peso;
    const repsStr = campo === 'reps' ? novo : s.reps;

    try {
      const prs = await atualizarSerie({
        setLogId: s.salvaId,
        sessionId,
        exerciseId: ex.exercise_id,
        pesoKg: parseFloat(pesoStr.replace(',', '.')) || null,
        reps: parseInt(repsStr, 10) || null,
      });
      setFalha(null);
      if (prs.length > 0) mostrarPR(ex.nome, prs[0]);
    } catch {
      // A tela já mostra o valor novo; o banco ficou com o antigo. Sem aviso,
      // a divergência só apareceria no histórico.
      buzz.erro();
      setFalha({
        mensagem: 'A correção não foi salva',
        retry: () => void persistirCorrecao(exId, idx, campo, novo),
      });
    }
  }

  function confirmarCampo() {
    if (!foco) return;
    aplicarBuffer();
    void persistirCorrecao(foco.exId, foco.serie, foco.campo, buffer);

    // Para onde ir depois: `campoDepoisDeConfirmar` só manda para as
    // repetições quando elas estão vazias de verdade. O pulo incondicional
    // custava dois toques por série (confirmar um campo que a herança já
    // tinha preenchido) e era metade da diferença entre 5 e 3.
    const linha = { ...(series[foco.exId]?.[foco.serie] ?? { peso: '', reps: '', concluida: false }), [foco.campo]: buffer };
    const prox = campoDepoisDeConfirmar(foco.campo, linha);
    if (prox) {
      setFoco({ ...foco, campo: prox });
      setBuffer(linha[prox]);
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
  /**
   * Liga e desliga a marca de aquecimento de uma série (F8).
   *
   * Série JÁ GRAVADA não muda de tipo aqui de propósito: mudar o tipo depois do
   * insert exigiria refazer volume e recordes derivados, e é o mesmo caminho que
   * já transformou uma correção de digitação em recorde permanente. Para
   * corrigir, desmarque a série (o que apaga a linha e recalcula), marque como
   * aquecimento e registre de novo.
   */
  function marcarAquecimento(exId: number, idx: number) {
    const s = seriesRef.current[exId]?.[idx];
    if (!s) return;
    if (s.salvaId) {
      buzz.aviso();
      setFalha({
        mensagem: 'Série já gravada. Desmarque, marque como aquecimento e registre de novo.',
      });
      return;
    }
    buzz.leve();
    setSeries((p) => {
      const arr = [...(p[exId] ?? [])];
      arr[idx] = { ...arr[idx], aquecimento: !arr[idx].aquecimento };
      return { ...p, [exId]: arr };
    });
  }

  /**
   * Tira uma linha de série da tela (U7).
   *
   * A decisão de PODER remover mora em `registro.ts`, com as três recusas
   * escritas; aqui só sobra o efeito. O piso é o que a reabertura devolveria:
   * remover abaixo dele deixaria a linha voltar no próximo carregamento, e
   * "o mesmo treino com dois estados dependendo de reabrir" é justamente o
   * segundo defeito que U7 descreve — consertar só o primeiro seria trocar um
   * pelo outro.
   *
   * De propósito não navega sozinho ao fechar o exercício: auto-avanço depois
   * de uma ação destrutiva parece erro, não progresso. A bolinha fica verde e
   * o "Próximo" fica em destaque, que é o mesmo que acontece ao concluir a
   * última série pelo caminho normal.
   */
  function removerLinha(exId: number, idx: number) {
    const ex = exerciciosRef.current.find((e) => e.id === exId);
    if (!ex) return;
    const linhas = seriesRef.current[exId] ?? [];
    const r = removerSerie(linhas, idx, pisoDeLinhas(linhas, modularSeries(ex.series_alvo, fase)));
    if (r.recusa) {
      buzz.aviso();
      setFalha({ mensagem: r.recusa });
      return;
    }
    setFalha(null);
    buzz.ok();
    setSeries((p) => ({ ...p, [exId]: r.linhas! }));
  }

// eslint-disable-next-line
/**
 * De onde sai a carga de referência da aproximação.
 *
 * O histórico é a primeira fonte. Sem ele — e a PRIMEIRA sessão de cada
 * exercício é justamente a primeira semana de volta de pausa — vale o peso que
 * a pessoa já digitou na primeira série valendo. Antes disso não há o que
 * aproximar, e aí o card nem aparece em vez de aparecer prometendo.
 */
function degrausDe(
  ex: RoutineExerciseFull,
  linhas: Serie[],
  anteriores: SerieAnterior[]
): SerieAquecimento[] {
  const doHistorico = anteriores.find((a) => a?.peso_kg)?.peso_kg ?? 0;
  const digitado = linhas.find((l) => !l.aquecimento && l.peso)?.peso ?? '';
  const alvo = doHistorico || parseFloat(digitado.replace(',', '.')) || 0;
  return aquecimento(alvo, ex.equipamento, ex.tipo_carga, ex.reps_max ?? 10);
}

  /**
   * Cria as duas séries de aproximação do principal, já com a carga calculada.
   *
   * A carga alvo é a última série valendo daquele exercício — é o número que a
   * pessoa vai puxar hoje. Sem histórico não há o que aproximar, e a ação nem
   * aparece na tela.
   */
  function criarAproximacoes(ex: RoutineExerciseFull) {
    // ── Nunca inserir antes de série já gravada ───────────────────────────
    //
    // `serie_index` é a POSIÇÃO no array — é assim que a sessão se reconstrói
    // ao reabrir (`doEx.find(s => s.serie_index === i)`). Um prepend depois de
    // a série 1 estar gravada empurra tudo e faz o aquecimento nascer com
    // `serie_index = 0`, colidindo com a linha que já existe: na reabertura só
    // a primeira volta, o aquecimento some da tela e fica em `set_logs` sem
    // `salvaId` — sem como desmarcar nem corrigir, que é a regra 5 do
    // AGENTS.md quebrada. PWA recarregando no meio do treino é rotina.
    const jaGravou = (seriesRef.current[ex.id] ?? []).some((x) => x.salvaId);
    if (jaGravou) {
      buzz.aviso();
      setFalha({
        mensagem: 'Aproximação é antes da primeira série valendo. Este exercício já começou.',
      });
      return;
    }

    const passos = degrausDe(ex, seriesRef.current[ex.id] ?? [], anterioresRef.current[ex.id] ?? []);
    const r = inserirAproximacoes(seriesRef.current[ex.id] ?? [], passos);
    if (r.recusa) {
      buzz.aviso();
      setFalha({ mensagem: r.recusa });
      return;
    }
    buzz.ok();
    setSeries((p) => ({ ...p, [ex.id]: r.linhas! }));
  }

  async function concluirSerie(exId: number, idx: number) {
    // Resolvidos na hora, pelos espelhos: `ex` e `s` de uma closure velha é
    // exatamente o que o retry do banner não pode usar para decidir.
    const ex = exerciciosRef.current.find((e) => e.id === exId);
    const s = seriesRef.current[exId]?.[idx];
    if (!ex || !s) return;

    if (s.concluida) {
      // Verde otimista com o registro ainda em voo: não há o que desmarcar
      // no banco — o toque é ignorado até o id chegar.
      if (!s.salvaId) return;
      // Desmarcar precisa apagar o registro, não só mudar a tela: senão
      // marcar → desmarcar → marcar grava a mesma série duas vezes e o volume
      // (e os recordes derivados dele) passam a contar em dobro.
      try {
        await desfazerSerie(s.salvaId, sessionId);
      } catch {
        // Nada mudou ainda — nem no banco, nem na tela. Só avisa e oferece
        // repetir.
        buzz.erro();
        setFalha({
          mensagem: 'Não consegui desmarcar a série',
          retry: () => void concluirSerie(exId, idx),
        });
        return;
      }
      setFalha(null);
      setSeries((p) => {
        const arr = [...(p[exId] ?? [])];
        arr[idx] = { ...arr[idx], concluida: false, salvaId: undefined };
        return { ...p, [exId]: arr };
      });
      buzz.leve();
      return;
    }

    // Já existe linha no banco para esta série: registrar de novo duplicaria
    // (retry atrasado ou toque repetido).
    if (s.salvaId) return;


    const pesoN = parseFloat(s.peso.replace(',', '.')) || null;
    const repsN = parseInt(s.reps, 10) || null;
    const porTempo = ex.tipo_carga === 'tempo';

    // MESMA função que o teste de contagem de toques dirige. Com a carga
    // herdada no estado, ela devolve null no caminho comum — e é isso que faz
    // o gesto custar 1 toque em vez de 5.
    const falta = precisaTeclado(s, porTempo);
    if (falta) {
      // Falta dado: em vez de erro, abre o campo que está faltando.
      abrirCampo(exId, idx, falta);
      buzz.aviso();
      return;
    }

    setSeries((p) => {
      const arr = [...(p[exId] ?? [])];
      // Gravou: o número deixa de ser referência da semana passada.
      arr[idx] = { ...arr[idx], concluida: true, herdado: false };
      return { ...p, [exId]: arr };
    });
    buzz.ok();
    setFoco(null);

    let gravada: { setId: number; prs: PersonalRecord[] };
    try {
      gravada = await registrarSerie({
        sessionId,
        exerciseId: ex.exercise_id,
        ordemExercicio: ex.ordem,
        serieIndex: idx,
        pesoKg: pesoN,
        reps: repsN,
        duracaoSeg: porTempo ? repsN : null,
        tipo: s.aquecimento ? 'aquecimento' : 'normal',
      });
    } catch {
      // Desfaz o verde otimista: série marcada sem linha no banco é perda
      // silenciosa — e sem desmarcar, o retry duplicaria o registro.
      setSeries((p) => {
        const arr = [...(p[exId] ?? [])];
        arr[idx] = { ...arr[idx], concluida: false };
        return { ...p, [exId]: arr };
      });
      buzz.erro();
      setFalha({
        mensagem: 'A série não gravou',
        retry: () => void concluirSerie(exId, idx),
      });
      return;
    }

    setFalha(null);
    // O id gravado é o que permite corrigir ou desmarcar esta série depois.
    setSeries((p) => {
      const arr = [...(p[exId] ?? [])];
      arr[idx] = { ...arr[idx], salvaId: gravada.setId };
      return { ...p, [exId]: arr };
    });

    // Projeção local só para o descanso e o auto-avanço — o estado de
    // verdade já foi atualizado pontualmente acima.
    const arrNova = [...(seriesRef.current[exId] ?? [])];
    arrNova[idx] = { ...arrNova[idx], concluida: true };
    const feitasAgora = arrNova.filter((x) => x.concluida).length;
    const projetado = { ...seriesRef.current, [exId]: arrNova };
    const iAtual = exerciciosRef.current.findIndex((e) => e.id === exId);
    const iProximo = proximoPendente(iAtual, projetado);

    // Descanso DEPOIS de uma aproximação é 60 s fixos, não o do exercício:
    // herdar 180 s fazia duas aproximações num supino custarem 6 minutos
    // parados, sozinhas. Ribeiro et al. (PMC7558980) usam 1 min entre as
    // séries de aquecimento e 3 min só antes da valendo.
    const descansoDaSerie = s.aquecimento ? SEG_DESCANSO_APROXIMACAO : ex.descanso_seg;
    if (descansoDaSerie > 0) {
      const novo: DescansoAtivo = {
        fim: Date.now() + descansoDaSerie * 1000,
        exercicio: ex.nome,
        serieFeita: feitasAgora,
        serieTotal: arrNova.length,
        // Saber o que vem depois vale mais durante três minutos de descanso do
        // que depois deles, quando já dá para ver na tela.
        proximo:
          iProximo >= 0 && iProximo !== iAtual
            ? exerciciosRef.current[iProximo].nome
            : undefined,
      };
      setDescansoAtivo(novo);
      salvarDescanso(novo);
      manterAcordado(true);
      // Alarme do sistema: toca com a tela apagada e o celular no bolso, que
      // é o cenário real de quem descansa 3 minutos entre séries pesadas.
      void agendarFimDoDescanso(descansoDaSerie, novo.proximo);
    }

    if (gravada.prs.length > 0) mostrarPR(ex.nome, gravada.prs[0]);

    // Exercício fechado: leva para o próximo que ainda falta. A pausa é para
    // dar tempo de ver a bolinha ficar verde — sem ela a tela "pula" sozinha
    // e a sensação é de erro, não de progresso.
    if (feitasAgora >= arrNova.length && iProximo >= 0 && iProximo !== iAtual) {
      setTimeout(() => irPara(iProximo), 850);
    }
  }

  function proximoPendente(depoisDe: number, mapa: Record<number, Serie[]>) {
    // Pelo espelho, pelo mesmo motivo de `concluirSerie`: um retry chega aqui
    // com a closure de outro render.
    const lista = exerciciosRef.current;
    for (let k = depoisDe + 1; k < lista.length; k++) {
      if (!completoDe(mapa[lista[k].id])) return k;
    }
    for (let k = 0; k < depoisDe; k++) {
      if (!completoDe(mapa[lista[k].id])) return k;
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
      //
      // Não-fatal de propósito: a partir daqui o treino JÁ está no banco.
      // Falha em check-in ou medalha não pode virar "treino não salvo" — e o
      // retry disso re-finalizaria a sessão.
      let novas: Awaited<ReturnType<typeof avaliarConquistas>> = [];
      try {
        await checkin('treino', {
          duracaoMin: Math.round(decorrido / 60),
          volumeKg: volumeAtual,
        });
        novas = await avaliarConquistas();
      } catch {
        /* o treino está salvo; a home segue normalmente */
      }
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
    } catch {
      // Sem o catch a falha era muda: o sheet ficava aberto com cara de
      // travado e o treino inteiro parecia perdido. Fechar o sheet antes do
      // banner — ele é um Modal, e o banner ficaria escondido atrás.
      setConfirmandoFim(false);
      buzz.erro();
      setFalha({
        mensagem: 'Não consegui salvar o treino',
        retry: () => void encerrar(sensacao),
      });
    } finally {
      setSalvando(false);
    }
  }

  async function abrirTroca(ex: RoutineExerciseFull) {
    setDetalhe(null);
    setTrocando(ex);
    setSubstitutos([]);
    setRecusados([]);
    setBuscandoTroca(true);
    try {
      const r = await substitutosDisponiveis(ex.exercise_id);
      setSubstitutos(r.lista);
      setRecusados(r.recusados);
    } finally {
      setBuscandoTroca(false);
    }
  }

  async function confirmarTroca(novoId: number) {
    if (!trocando) return;
    const saiuDaqui = trocando.exercise_id;
    try {
      // `trocando.exercise_id` é o efetivo na tela (pós-overlay): numa cadeia
      // de trocas, o log registra de onde a pessoa saiu de verdade.
      await substituirExercicio(trocando.id, novoId, sessionId, motivoTroca, trocando.exercise_id);
    } catch {
      buzz.erro();
      setFalha({
        mensagem: 'A troca não gravou',
        retry: () => void confirmarTroca(novoId),
      });
      return;
    }
    setTrocando(null);
    buzz.ok();

    // Recarrega a lista e o histórico do exercício novo — o placeholder cinza
    // precisa mostrar a última vez que ELE foi feito, não o que foi trocado.
    const lista = await exerciciosDaSessao(sessionId);
    setExercicios(lista);
    const alvo = lista.find((e) => e.id === trocando.id);
    if (alvo) {
      const hist = await ultimaExecucao(alvo.exercise_id, sessionId);
      setAnteriores((p) => ({ ...p, [alvo.id]: hist }));
      // A carga herdada é do exercício NOVO. Sem isto, as linhas ficariam com
      // o peso do exercício que acabou de sair — e o check gravaria em 1
      // toque a carga errada, que é pior do que os 5 toques de antes.
      const sug = avaliarProgressao(
        hist,
        alvo.reps_min ?? 8,
        alvo.reps_max ?? 12,
        alvo.grupo_primario,
        alvo.tipo_carga,
        fase
      );
      setSeries((p) => ({
        ...p,
        [alvo.id]: prePreencher(
          // Linha herdada do exercício anterior volta a ficar vazia; o que foi
          // gravado ou digitado à mão `prePreencher` já preserva sozinho.
          (p[alvo.id] ?? []).map((l) => (l.herdado ? { ...l, peso: '', reps: '', herdado: false } : l)),
          hist,
          contextoDe(alvo, fase, sug)
        ),
      }));
    }

    // ── O motivo `dor` passa a ser LIDO ──────────────────────────────────
    //
    // Não bloqueia nada e não regenera plano: pergunta. E só depois da troca
    // estar gravada — perguntar antes seria condicionar a troca à resposta,
    // que é o oposto de "resolve o treino de hoje".
    if (motivoTroca === 'dor') {
      try {
        setSugestaoDor(await dorRepetida(saiuDaqui));
      } catch {
        /* a troca já valeu; a sugestão é um extra e não pode derrubá-la */
      }
    }
  }

  async function abandonar() {
    encerrarDescanso();
    try {
      await cancelarSessao(sessionId);
    } catch {
      // Sheet fechado antes do banner — ele é um Modal e cobriria o aviso.
      setSaindo(false);
      buzz.erro();
      setFalha({
        mensagem: 'Não consegui cancelar o treino',
        retry: () => void abandonar(),
      });
      return;
    }
    router.replace('/');
  }

  /** Desarma o cancelar em dois toques — chamado sempre que o sheet fecha. */
  const desarmarCancelar = useCallback(() => {
    if (timerCancelar.current) {
      clearTimeout(timerCancelar.current);
      timerCancelar.current = null;
    }
    setConfirmandoCancelar(false);
  }, []);

  useEffect(
    () => () => {
      if (timerCancelar.current) clearTimeout(timerCancelar.current);
    },
    []
  );

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
          {/* Duração, séries e volume: informação que se confere de relance
              entre séries, não decoração. Em textFaint dava 3,3:1. */}
          <Txt v="small" cor={colors.textDim}>
            {duracao(decorrido)} · {totalSeries} séries · {volume(volumeAtual)}
          </Txt>
          {/* A fase que a Home prometeu, agora onde ela vale: na sessão. */}
          {fase ? (
            <Txt v="small" size={11} cor={colors.info} numberOfLines={1}>
              {fase.titulo}
              {fase.rirTexto ? ` · ${fase.rirTexto}` : ''}
            </Txt>
          ) : null}
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
            fase={fase}
            sugestao={sugestoes[ex.id] ?? null}
            foco={foco}
            compacto={!!foco}
            // Teclado aberto: folga suficiente para a linha em edição subir
            // acima dele. Descansando: espaço para a barra flutuante, que
            // senão cobre os botões de navegação.
            paddingBottom={
              foco ? 360 : Math.max(insets.bottom, spacing.md) + (descanso !== null ? 76 : 8)
            }
            onEditar={abrirCampo}
            onConcluir={(idx) => concluirSerie(ex.id, idx)}
            onAddSerie={() =>
              setSeries((p) => ({
                ...p,
                [ex.id]: [...(p[ex.id] ?? []), { peso: '', reps: '', concluida: false }],
              }))
            }
            papel={papeis.get(ex.id) ?? null}
            onMenu={(idx) => {
              buzz.selecao();
              setMenuLinha({ exId: ex.id, idx });
            }}
            onAproximacoes={() => criarAproximacoes(ex)}
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
            // O cronômetro segue no visor: a barra fica escondida atrás do
            // teclado, e é exatamente durante o descanso que se prepara a
            // carga da próxima série.
            descanso={descansoAtivo ? descanso : null}
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

      {/* ── Falha de gravação: flutua como a barra de descanso, mas em tom de
          perigo. Oferece repetir na hora — série sumindo em silêncio custa o
          histórico, que é o produto. ── */}
      {falha ? (
        <Animated.View
          entering={SlideInDown.duration(240)}
          style={[
            s.falha,
            {
              // Acima do teclado quando ele está aberto (mesma folga que a
              // página reserva); senão, acima da barra de descanso se houver.
              bottom: foco
                ? 360
                : Math.max(insets.bottom, spacing.md) + (descanso !== null ? 76 : 0),
            },
          ]}
        >
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Txt v="small" cor={colors.danger} bold style={{ flex: 1 }}>
            {falha.mensagem}
          </Txt>
          {falha.retry ? (
            <Press
              onPress={() => {
                const tentar = falha.retry!;
                setFalha(null);
                tentar();
              }}
              style={s.tentarDeNovo}
              haptic="leve"
            >
              <Txt v="small" cor={colors.danger} bold>
                Tentar de novo
              </Txt>
            </Press>
          ) : null}
          <Press onPress={() => setFalha(null)} style={s.fecharFalha} scale={0.9}>
            <Ionicons name="close" size={17} color={colors.textDim} />
          </Press>
        </Animated.View>
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
              {/* Por que este exercício está aqui. O papel já é a resposta
                  estrutural — isto só a escreve como se fala. */}
              {papeis.get(detalhe.id) ? (
                <View style={[s.explicaDescanso, { backgroundColor: colors.warnSoft }]}>
                  <Ionicons name="podium-outline" size={16} color={colors.warn} />
                  <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
                    <Txt v="small" bold cor={colors.warn}>
                      {LABEL_PAPEL[papeis.get(detalhe.id)!.papel]}
                      {papeis.get(detalhe.id)!.ancora && papeis.get(detalhe.id)!.papel !== 'principal'
                        ? ` · ${ABRE_O_GRUPO}`
                        : ''}
                      .{' '}
                    </Txt>
                    {PORQUE_PAPEL[papeis.get(detalhe.id)!.papel]}
                    {'\n\n'}
                    {porqueEsteExercicio(
                      {
                        nome: detalhe.nome,
                        grupo: detalhe.grupo_primario,
                        equipamento: detalhe.equipamento,
                      },
                      exercicios.map((o) => ({
                        nome: o.nome,
                        grupo: o.grupo_primario,
                        equipamento: o.equipamento,
                      }))
                    )}
                  </Txt>
                </View>
              ) : null}

              {/* ── A camada de TEMPO (G3), na hora de fazer a série ── */}
              <View style={s.explicaDescanso}>
                <Ionicons name="speedometer-outline" size={16} color={colors.info} />
                <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
                  <Txt v="small" bold cor={colors.info}>
                    {resumoDeExecucao(
                      execucaoDe(
                        detalhe.nome,
                        detalhe.grupo_primario,
                        detalhe.equipamento,
                        detalhe.tipo_carga
                      ),
                      ((detalhe.reps_min ?? 8) + (detalhe.reps_max ?? 12)) / 2
                    )}
                    .{' '}
                  </Txt>
                  {
                    execucaoDe(
                      detalhe.nome,
                      detalhe.grupo_primario,
                      detalhe.equipamento,
                      detalhe.tipo_carga
                    ).amplitude
                  }
                  {'\n\n'}
                  {PORQUE_CADENCIA}
                </Txt>
              </View>

              {/* Erro derivado da mecânica — sempre presente, sempre um erro. */}
              <View style={[s.explicaDescanso, { backgroundColor: colors.warnSoft }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warn} />
                <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
                  <Txt v="small" bold cor={colors.warn}>
                    Erro mais comum.{' '}
                  </Txt>
                  {
                    execucaoDe(
                      detalhe.nome,
                      detalhe.grupo_primario,
                      detalhe.equipamento,
                      detalhe.tipo_carga
                    ).erroComum
                  }
                </Txt>
              </View>

              {/* ── B7: técnica de intensidade, se a fase e o papel permitirem ──
                  A regra dura mora em `tecnicasDaSessao`: só isolador ou
                  finalizador, só na última série, no máximo 2 por sessão, e
                  ZERO na readaptação e no deload. A tela não decide nada — ela
                  só mostra o que a regra devolveu, com a evidência junto. */}
              {tecnicaDe(detalhe) ? (
                <View style={[s.explicaDescanso, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="flash-outline" size={16} color={colors.success} />
                  <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
                    <Txt v="small" bold cor={colors.success}>
                      {tecnicaDe(detalhe)!.nome} — só na última série.{' '}
                    </Txt>
                    {tecnicaDe(detalhe)!.comoFazer}
                    {'\n\n'}
                    <Txt v="small" bold>
                      O que isso rende:{' '}
                    </Txt>
                    {tecnicaDe(detalhe)!.oQueGanha}
                    {'\n'}
                    {tecnicaDe(detalhe)!.evidencia}
                  </Txt>
                </View>
              ) : null}

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

      {/* ── Menu da linha: os dois gestos raros da série ── */}
      <Sheet
        aberto={!!menuLinha}
        onFechar={() => setMenuLinha(null)}
        titulo={(() => {
          if (!menuLinha) return '';
          const arr = series[menuLinha.exId] ?? [];
          const linha = arr[menuLinha.idx];
          if (!linha) return 'Série';
          return linha.aquecimento
            ? 'Série de aquecimento'
            : `Série ${arr.slice(0, menuLinha.idx + 1).filter((x) => !x.aquecimento).length}`;
        })()}
        altura={0.46}
      >
        {menuLinha ? (
          <View style={{ gap: spacing.lg }}>
            <Txt v="small" cor={colors.textDim}>
              {series[menuLinha.exId]?.[menuLinha.idx]?.salvaId
                ? 'Esta série já está no banco. Para mudar o valor, toque no campo; para tirá-la do histórico, desmarque no check.'
                : 'Aquecimento não conta volume, recorde nem XP — só serve para chegar na carga. Remover tira a linha desta sessão.'}
            </Txt>

            <Button
              titulo={
                series[menuLinha.exId]?.[menuLinha.idx]?.aquecimento
                  ? 'Voltar a contar como série'
                  : 'Marcar como aquecimento'
              }
              icone="flame-outline"
              variante="secundario"
              full
              tam="lg"
              onPress={() => {
                marcarAquecimento(menuLinha.exId, menuLinha.idx);
                setMenuLinha(null);
              }}
            />

            <Button
              titulo="Remover série"
              icone="trash-outline"
              variante="perigo"
              full
              tam="lg"
              onPress={() => {
                removerLinha(menuLinha.exId, menuLinha.idx);
                setMenuLinha(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* ── Sair: pausar ou cancelar ── */}
      <Sheet
        aberto={saindo}
        onFechar={() => {
          setSaindo(false);
          desarmarCancelar();
        }}
        titulo="Sair do treino"
        altura={0.62}
      >
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
              desarmarCancelar();
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
              desarmarCancelar();
              setConfirmandoFim(true);
            }}
          />

          <View style={{ gap: spacing.sm }}>
            <Txt v="small" cor={colors.textDim}>
              {totalSeries > 0
                ? `Cancelar apaga as ${totalSeries} série${totalSeries > 1 ? 's' : ''} deste treino. ` +
                  'Recordes que saíram daqui também somem. Não dá para desfazer.'
                : 'Nenhuma série registrada — cancelar não perde nada.'}
            </Txt>
            <Button
              titulo={
                confirmandoCancelar
                  ? `Toque de novo para apagar ${totalSeries} série${totalSeries > 1 ? 's' : ''}`
                  : 'Cancelar treino'
              }
              icone="trash-outline"
              variante="perigo"
              full
              carregando={salvando}
              onPress={() => {
                // Com série registrada, um toque só não apaga: o primeiro arma
                // e mostra o tamanho da perda; sem o segundo em 3 s, desarma.
                if (totalSeries > 0 && !confirmandoCancelar) {
                  setConfirmandoCancelar(true);
                  buzz.aviso();
                  timerCancelar.current = setTimeout(() => setConfirmandoCancelar(false), 3000);
                  return;
                }
                desarmarCancelar();
                void abandonar();
              }}
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
        rolavel
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
            {buscandoTroca ? (
              <Txt v="small" cor={colors.textFaint}>
                Buscando alternativas…
              </Txt>
            ) : substitutos.length === 0 ? (
              // Lista vazia de verdade. Antes a tela dizia "Buscando
              // alternativas…" para sempre — e agora que o filtro de dor e de
              // local pode esvaziar a lista, fingir carregamento seria mentir
              // exatamente onde a pessoa precisa entender.
              <Txt v="small" cor={colors.warn}>
                Não sobrou alternativa segura aqui: tudo que treina o mesmo músculo neste local
                entra em alguma dor que você marcou. Melhor pular do que forçar.
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
                        {/* Descanso do PAPEL da vaga, não de um papel deduzido
                            do nome com reps fixo em 10: quem troca continua na
                            mesma posição da sessão, e é ela que decide. Era o
                            número do card discordando do que a troca grava. */}
                        {sub.equipamento ?? 'livre'} · descanso{' '}
                        {descansoCorreto(
                          sub.nome,
                          trocando?.reps_max ?? 10,
                          sub.grupo_primario,
                          papeis.get(trocando?.id ?? -1)?.papel,
                          sub.equipamento,
                          sub.tipo_carga
                        )}
                        s
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </Card>
              ))
            )}

            {/* ── O que ficou de fora por causa de dor ──────────────────
                Só as recusas por DOR: as de equipamento a pessoa já sabe (é a
                academia dela). Sem esta linha, a proteção parece um app com
                menos opções que os outros. */}
            {recusados.some((r) => r.tipo === 'dor') ? (
              <View style={s.recusaDor}>
                <Ionicons name="medkit-outline" size={15} color={colors.warn} />
                <Txt v="small" size={11} cor={colors.textDim} style={{ flex: 1 }}>
                  Fora da lista por causa das dores do seu perfil:{' '}
                  {recusados
                    .filter((r) => r.tipo === 'dor')
                    .slice(0, 3)
                    .map((r) => r.nome)
                    .join(', ')}
                  .
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </Sheet>

      {/* ── Trocou por dor de novo ────────────────────────────────────────
          O motivo `dor` era gravado e nunca lido. Agora ele vira uma pergunta,
          depois da troca já gravada — e só quando a região ainda não está no
          perfil, senão vira ruído a cada troca. */}
      <Sheet
        aberto={!!sugestaoDor}
        onFechar={() => setSugestaoDor(null)}
        titulo="Isso já aconteceu antes"
        altura={0.5}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt v="small" cor={colors.textDim}>
            Você já trocou <Txt v="small" bold>{sugestaoDor?.exercicio}</Txt> por dor{' '}
            {sugestaoDor?.vezes}×. Quer marcar{' '}
            <Txt v="small" bold>{sugestaoDor?.label.toLowerCase()}</Txt> nas suas dores? A partir
            daí o app para de sugerir os movimentos que carregam essa região — no plano e aqui na
            troca.
          </Txt>
          <Txt v="small" size={11} cor={colors.textFaint}>
            Isso não muda o treino de hoje e não apaga nada. Dor que persiste fora do treino é
            assunto de fisioterapeuta — o app troca exercício, não diagnostica.
          </Txt>
          <Button
            titulo={`Marcar dor no ${sugestaoDor?.label.toLowerCase() ?? ''}`}
            full
            tam="lg"
            onPress={async () => {
              const r = sugestaoDor;
              setSugestaoDor(null);
              if (!r) return;
              try {
                await adicionarDorNoPerfil(r.regiao);
                buzz.ok();
              } catch {
                buzz.erro();
                setFalha({ mensagem: 'Não consegui salvar no perfil' });
              }
            }}
          />
          <Button titulo="Agora não" variante="fantasma" full onPress={() => setSugestaoDor(null)} />
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
              <Press onPress={() => onIr(i)} scale={0.88} haptic="selecao" style={s.bolaAlvo}>
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
                      cor={ativo ? colors.primary : colors.textDim}
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
        <Txt v="small" size={11} cor={colors.textDim}>
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
  fase,
  sugestao,
  foco,
  compacto,
  paddingBottom,
  onEditar,
  onConcluir,
  onAddSerie,
  papel,
  onMenu,
  onAproximacoes,
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
  fase: FaseEfetiva | null;
  sugestao: Progressao | null;
  foco: Foco;
  compacto: boolean;
  paddingBottom: number;
  onEditar: (exId: number, serie: number, campo: 'peso' | 'reps') => void;
  onConcluir: (idx: number) => void;
  onAddSerie: () => void;
  /** Resolvido no pai, pela mesma função da tela do dia. */
  papel: PapelDaLinha | null;
  onMenu: (idx: number) => void;
  onAproximacoes: () => void;
  onTrocar: () => void;
  onDetalhe: () => void;
  onProximo: () => void;
  onAnterior: () => void;
}) {
  const feitas = series.filter((x) => x.concluida).length;
  const completo = feitas === series.length && series.length > 0;
  const porTempo = ex.tipo_carga === 'tempo';
  const temAquecimento = series.some((x) => x.aquecimento);
  const jaGravou = series.some((x) => x.salvaId);
  /**
   * Os degraus REAIS, com a carga da última vez e o arredondamento do aparelho.
   *
   * A tela deixou de prometer "2 aproximações" para depois não conseguir criar
   * nenhuma: o botão só aparece quando existe degrau, e o texto diz o peso que
   * vai entrar. Barra fixa não chega aqui (`tipo_carga` não é `peso_reps`), e
   * exercício sem histórico de carga também não — não há o que aproximar.
   */
  const passosAprox =
    ex.aquecimento_series > 0 && !temAquecimento && !jaGravou
      ? aquecimento(anteriores.find((a) => a?.peso_kg)?.peso_kg ?? 0, ex.equipamento, ex.tipo_carga)
      : [];

  /**
   * O RIR desta linha do plano, ajustado pela fase.
   *
   * A coluna nasce na v16; rotina anterior vem com NULL e cai na dedução por
   * papel do próprio exercício. Assim o plano velho abre com um RIR coerente em
   * vez de abrir sem nenhum — que é o estado que A6 achou.
   */
  const rirDoExercicio = (() => {
    if (porTempo || !papel) return '';
    const doPlano: [number, number] | null =
      ex.rir_min != null && ex.rir_max != null ? [ex.rir_min, ex.rir_max] : null;
    // Readaptação e deload afrouxam o alvo: o tendão não acompanha a
    // velocidade com que o músculo recupera carga depois de uma pausa.
    const naFase = (f: 'readaptacao' | 'deload' | null) =>
      rirNaFase(papel.papel, ex.nome, ex.grupo_primario, ex.equipamento, f, ex.tipo_carga);
    const ajustado =
      fase && (fase.fase === 'readaptacao' || fase.fase === 'deload')
        ? naFase(fase.fase)
        : doPlano ?? naFase(null);
    return textoRir(ajustado);
  })();

  // O alvo que a semana pede — não o do template. Semana leve com "3 × 8-12"
  // no card convida a fazer 3; o número mostrado precisa ser o modulado.
  const alvoModulado = modularSeries(ex.series_alvo, fase);

  // Selo de progressão: um empurrão visual, nunca uma trava. Na readaptação
  // ele vira a volta leve — sugerir subida em semana de proteção é lesão.
  const selo = (() => {
    if (ex.tipo_carga !== 'peso_reps') return null;
    if (fase?.fase === 'readaptacao' && fase.cargaPct != null && fase.retomadaEmMs != null) {
      // Referência PRÉ-pausa apenas: execução pós-retomada já é a carga
      // reduzida, e o percentual sobre ela comporia queda geométrica. Sem
      // série de antes da pausa, o selo simplesmente não aparece.
      const maior = Math.max(
        0,
        ...anteriores
          .filter((a) => a.registrado_em < fase.retomadaEmMs!)
          .map((a) => a.peso_kg ?? 0)
      );
      if (maior <= 0) return null;
      return {
        icone: 'leaf-outline' as const,
        cor: colors.info,
        fundo: colors.infoSoft,
        texto: `Volta leve: ${fmtPeso(pesoDeVolta(maior, fase.cargaPct))} kg`,
      };
    }
    if (sugestao?.acao === 'subir') {
      return {
        icone: 'trending-up' as const,
        cor: colors.success,
        fundo: colors.successSoft,
        texto: `Hora de subir: ${fmtPeso(sugestao.pesoSugerido)} kg`,
      };
    }
    if (sugestao?.acao === 'segurar') {
      return {
        icone: 'hand-left-outline' as const,
        cor: colors.info,
        fundo: colors.infoSoft,
        texto: 'Segure a carga · feche a faixa',
      };
    }
    return null;
  })();

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

              <Txt v="small" cor={colors.textDim} size={11}>
                {posicao + 1} de {total} · {nomeGrupo(ex.grupo_primario)}
              </Txt>

              <View style={s.metaLinha}>
                <View style={s.tag}>
                  <Ionicons name="repeat" size={10} color={colors.textDim} />
                  <Txt v="small" size={10} cor={colors.textDim} bold>
                    {alvoModulado} × {ex.reps_min}-{ex.reps_max}
                    {alvoModulado < ex.series_alvo && fase
                      ? ` · ${fase.titulo.toLowerCase()}`
                      : ''}
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
                {/* RIR do EXERCÍCIO, não da semana.
                    O chip de fase no cabeçalho diz o RIR do bloco; este diz o
                    do papel — e são diferentes de propósito: manter 2-3 no
                    principal custa quase nada em força, enquanto apertar no
                    isolador é onde o ganho de tamanho está. Sem ele, "3 × 8-12"
                    não prescreve esforço nenhum. */}
                {rirDoExercicio ? (
                  <View style={[s.tag, { backgroundColor: colors.warnSoft }]}>
                    <Ionicons name="flame-outline" size={10} color={colors.warn} />
                    <Txt v="small" size={10} cor={colors.warn} bold>
                      {rirDoExercicio}
                    </Txt>
                  </View>
                ) : null}
                {selo ? (
                  <View style={[s.tag, { backgroundColor: selo.fundo }]}>
                    <Ionicons name={selo.icone} size={10} color={selo.cor} />
                    <Txt v="small" size={10} cor={selo.cor} bold>
                      {selo.texto}
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
          {passosAprox.length ? (
            <Press onPress={onAproximacoes} style={s.aproximacao} haptic="leve">
              <Ionicons name="trending-up" size={14} color={colors.warn} />
              <Txt v="small" size={11} cor={colors.textDim} style={{ flex: 1 }}>
                {passosAprox.length === 1 ? 'Aproximação' : `${passosAprox.length} aproximações`}{' '}
                antes da 1ª valendo: {passosAprox.map((d) => `${fmtPeso(d.peso)} kg × ${d.reps}`).join(' e ')}.
                Não contam volume nem recorde.
              </Txt>
              <Txt v="small" size={11} cor={colors.warn} bold>
                Criar
              </Txt>
            </Press>
          ) : null}

          {/* Cabeçalho na largura EXATA das colunas da linha — e em textDim,
              não no textFaint do `v="label"`: 11 px em 3,0:1 é o mesmo
              problema da coluna Anterior, um tamanho abaixo. */}
          <View style={s.thead}>
            <Txt v="label" cor={colors.textDim} style={{ width: COL_NUMERO }}>
              #
            </Txt>
            <Txt v="label" cor={colors.textDim} style={{ flex: 1 }}>
              Anterior
            </Txt>
            <Txt
              v="label"
              cor={colors.textDim}
              style={{ width: ALVO_TOQUE.campoPeso.largura, textAlign: 'center' }}
            >
              {porTempo ? 'Seg' : 'Kg'}
            </Txt>
            <Txt
              v="label"
              cor={colors.textDim}
              style={{ width: ALVO_TOQUE.campoReps.largura, textAlign: 'center' }}
            >
              {porTempo ? '—' : 'Reps'}
            </Txt>
            <View style={{ width: ALVO_TOQUE.check.largura }} />
          </View>

          {series.map((serie, i) => (
            <LinhaSerie
              key={i}
              onMedir={(y) => {
                yLinha.current[i] = y;
              }}
              serie={serie}
              anterior={anteriores[i]}
              focoPeso={foco?.exId === ex.id && foco.serie === i && foco.campo === 'peso'}
              focoReps={foco?.exId === ex.id && foco.serie === i && foco.campo === 'reps'}
              onEditarPeso={() => onEditar(ex.id, i, 'peso')}
              onEditarReps={() => onEditar(ex.id, i, 'reps')}
              onConcluir={() => onConcluir(i)}
              onMenu={() => onMenu(i)}
              numeroValendo={series.slice(0, i + 1).filter((x) => !x.aquecimento).length}
            />
          ))}

          <Press onPress={onAddSerie} style={s.addSerie} haptic="leve">
            <Ionicons name="add" size={16} color={colors.textDim} />
            <Txt v="small" cor={colors.textDim}>
              Adicionar série
            </Txt>
          </Press>

          {/* O toque longo não se descobre sozinho. Uma linha, na cor de
              referência, onde o erro acontece: quem tocou "Adicionar série"
              por engano lê o desfazer logo abaixo do botão que causou. */}
          <Txt v="small" size={11} cor={colors.textDim} center>
            Toque e segure uma série para marcar aquecimento ou remover
          </Txt>
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
  serie,
  anterior,
  focoPeso,
  focoReps,
  onEditarPeso,
  onEditarReps,
  onConcluir,
  onMenu,
  numeroValendo,
  onMedir,
}: {
  serie: Serie;
  anterior?: SerieAnterior;
  focoPeso: boolean;
  focoReps: boolean;
  onEditarPeso: () => void;
  onEditarReps: () => void;
  onConcluir: () => void;
  /** Toque longo em qualquer ponto da linha: aquecimento e remover. */
  onMenu: () => void;
  /** Numeração que ignora aquecimento: a 1ª valendo é a 1, não a 3. */
  numeroValendo: number;
  onMedir: (y: number) => void;
}) {
  /**
   * Tom do número.
   *
   * Três estados, não dois: digitado hoje (`text`, claro), herdado da última
   * sessão (`textDim` — legível, mas visivelmente emprestado) e ausente
   * (`textDim` também, porque é só um travessão). O meio-termo é o que
   * permite pré-preencher sem a tela mentir que o número é de hoje.
   */
  const tom = serie.herdado ? colors.textDim : colors.text;

  return (
    // A linha INTEIRA é o alvo do toque longo — inclusive a coluna "Anterior",
    // que não tem filho clicável. Sem `scale`, senão a linha encolhe a cada
    // toque num campo; sem haptic, porque quem vibra é a ação.
    <Press
      onLongPress={onMenu}
      scale={1}
      haptic={false}
      style={[
        s.linha,
        serie.concluida && { backgroundColor: colors.successSoft },
        serie.aquecimento && { backgroundColor: colors.warnSoft },
      ]}
      onLayout={(e) => onMedir(e.nativeEvent.layout.y)}
    >
      {/* O número deixou de ser botão: o toggle de aquecimento foi para o
          menu do toque longo, e a largura que ele ocupava virou coluna
          "Anterior" legível. Ver o comentário de `menuLinha`. */}
      <View style={s.numero}>
        {serie.aquecimento ? (
          <Ionicons name="flame" size={14} color={colors.warn} />
        ) : (
          <Txt v="small" cor={colors.textDim}>
            {numeroValendo}
          </Txt>
        )}
      </View>

      {/* `textDim` e 13 px: é a coluna que decide quanto vai na barra, lida
          agachado na frente do aparelho. Em `textFaint`/12 dava 3,00:1 sobre
          o fundo da tabela — abaixo de AA. Medido em `testar:gerador`,
          seção 25, sobre a cor COMPOSTA das três cores de linha. */}
      <Txt v="small" cor={colors.textDim} style={{ flex: 1 }}>
        {anterior?.peso_kg
          ? `${fmtPeso(anterior.peso_kg)} × ${anterior.reps}`
          : anterior?.reps
            ? `${anterior.reps}`
            : '—'}
      </Txt>

      <Press
        onPress={onEditarPeso}
        onLongPress={onMenu}
        haptic={false}
        style={[s.campo, focoPeso && s.campoFoco]}
      >
        <Txt v="h3" center cor={serie.peso ? tom : colors.textDim} style={{ width: '100%' }}>
          {serie.peso || '—'}
        </Txt>
      </Press>

      <Press
        onPress={onEditarReps}
        onLongPress={onMenu}
        haptic={false}
        style={[s.campo, s.campoReps, focoReps && s.campoFoco]}
      >
        <Txt v="h3" center cor={serie.reps ? tom : colors.textDim} style={{ width: '100%' }}>
          {serie.reps || '—'}
        </Txt>
      </Press>

      <Press onPress={onConcluir} onLongPress={onMenu} haptic={false} scale={0.85} style={s.check}>
        <View style={[s.checkBox, serie.concluida && s.checkOn]}>
          <Ionicons name="checkmark" size={22} color={serie.concluida ? '#00251A' : colors.textDim} />
        </View>
      </Press>
    </Press>
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
          <Txt v="small" size={11} cor={colors.textDim}>
            {Math.abs(Math.round(segundos / 60))} min além do intervalo
          </Txt>
        ) : !acabou ? (
          <Txt v="small" size={11} cor={colors.textDim} numberOfLines={1}>
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
    width: ALVO_TOQUE.botaoCompacto.largura,
    height: ALVO_TOQUE.botaoCompacto.altura,
    borderRadius: ALVO_TOQUE.botaoCompacto.altura / 2,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFim: {
    paddingHorizontal: spacing.lg,
    height: ALVO_TOQUE.botaoCompacto.altura,
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
  trilha: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  traco: { width: TRACO, height: 2, backgroundColor: colors.border },
  /* O círculo continua com 30; quem cresceu foi a caixa em volta dele. Pular
     para o exercício errado no meio do treino é o custo de errar aqui. */
  bolaAlvo: {
    width: ALVO_TOQUE.bola.largura,
    height: ALVO_TOQUE.bola.altura,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    minHeight: ALVO_TOQUE.botaoCompacto.altura,
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
    minHeight: ALVO_TOQUE.botaoCompacto.altura,
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
    height: ALVO_TOQUE.botaoCompacto.altura,
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
    width: ALVO_TOQUE.botaoCompacto.largura,
    height: ALVO_TOQUE.botaoCompacto.altura,
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
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  numero: { width: COL_NUMERO, alignItems: 'flex-start' },
  campo: {
    width: ALVO_TOQUE.campoPeso.largura,
    height: ALVO_TOQUE.campoPeso.altura,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  campoReps: { width: ALVO_TOQUE.campoReps.largura },
  campoFoco: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  /* O gesto de ~20x por treino. Caixa de verdade (52x52) em vez de hitSlop —
     no react-native-web o Pressable descarta essa prop, e o PWA é o app real. */
  check: {
    width: ALVO_TOQUE.check.largura,
    height: ALVO_TOQUE.check.altura,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBox: {
    width: ALVO_TOQUE.check.largura - 6,
    height: ALVO_TOQUE.check.altura - 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  addSerie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: ALVO_TOQUE.botaoLinha.altura,
    marginTop: 2,
  },
  aproximacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: ALVO_TOQUE.botaoLinha.altura,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.warnSoft,
  },

  // Navegação
  navLinha: { flexDirection: 'row', gap: spacing.sm, marginTop: 'auto' },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // Media 43 pt com paddingVertical: um a menos que o minimo. Altura fixa
    // resolve sem depender do tamanho da fonte do sistema.
    height: HIT,
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
    // O "Pular" cresceu de 30 para 44: a barra compensa no padding para não
    // roubar altura da página, que já reserva 76 pt para ela.
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#2A1206',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pular: {
    paddingHorizontal: spacing.md,
    minWidth: ALVO_TOQUE.botaoCompacto.largura,
    height: ALVO_TOQUE.botaoCompacto.altura,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },

  // Falha de gravação — mesmo formato da barra de descanso, em tom de perigo.
  falha: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  tentarDeNovo: {
    paddingHorizontal: spacing.md,
    height: ALVO_TOQUE.botaoCompacto.altura,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
  },
  fecharFalha: {
    width: ALVO_TOQUE.botaoCompacto.largura,
    height: ALVO_TOQUE.botaoCompacto.altura,
    borderRadius: ALVO_TOQUE.botaoCompacto.altura / 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  recusaDor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.warnSoft,
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
