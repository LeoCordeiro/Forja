import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Anel, Button, Card, Press, Tela, Txt, VideoDoMovimento } from '@/shared/ui';
import { ROTINAS, duracaoTotal, PRINCIPIOS, type RotinaMobilidade } from '@/features/mobilidade/rotinas';
import { historicoMobilidade, registrarSessao } from '@/features/mobilidade/api';
import { useDados } from '@/shared/hooks/useDados';
import { VIDEOS } from '@/db/seed/videos';
import { duracao } from '@/shared/utils/format';
import { alarmeConclusao, bipCurto, prepararAudio } from '@/shared/utils/alarme';
import { buzz } from '@/shared/utils/haptics';

/**
 * Mobilidade e alongamento.
 *
 * A execução é guiada por timer porque alongamento sem cronômetro vira 8
 * segundos que a pessoa jura terem sido 30 — e abaixo de ~30 s por posição o
 * ganho de amplitude é pequeno.
 */
function Selo({
  icone,
  texto,
  cor = colors.textDim,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  texto: string;
  cor?: string;
}) {
  return (
    <View style={s.selo}>
      <Ionicons name={icone} size={11} color={cor} />
      <Txt v="small" size={10} cor={cor} bold>
        {texto}
      </Txt>
    </View>
  );
}

export default function Mobilidade() {
  const router = useRouter();
  const [ativa, setAtiva] = useState<RotinaMobilidade | null>(null);
  const { dados: hist, recarregar } = useDados(historicoMobilidade, []);

  if (ativa)
    return (
      <Execucao
        rotina={ativa}
        onSair={() => {
          setAtiva(null);
          recarregar();
        }}
      />
    );

  const feitas = hist?.porRotina ?? {};

  return (
    <Tela
      titulo="Mobilidade"
      subtitulo="Flexibilidade, amplitude e movimento livre"
      onRefresh={recarregar}
    >
      {/* ── Frequência da semana ── */}
      <Card faixa={colors.success}>
        <View style={s.linha}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="label">Esta semana</Txt>
            <Txt v="h1" size={30} cor={colors.success}>
              {hist?.diasNaSemana ?? 0}
              <Txt v="h3" cor={colors.textFaint}>
                {' '}
                de 7 dias
              </Txt>
            </Txt>
          </View>
          <Anel
            valor={(hist?.diasNaSemana ?? 0) / 7}
            tamanho={62}
            espessura={7}
            cor={colors.success}
            centro=""
          />
        </View>
        <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
          {hist?.ultima
            ? hist.ultima.diasAtras === 0
              ? 'Você já se moveu hoje. Mais uma rodada curta não atrapalha.'
              : hist.ultima.diasAtras === 1
                ? 'Última sessão foi ontem. Cinco minutos hoje mantêm o ganho.'
                : `Faz ${hist.ultima.diasAtras} dias. Amplitude perdida volta rápido — mas só se voltar.`
            : 'Nenhuma sessão ainda. Comece pelo aquecimento antes do próximo treino.'}
        </Txt>
      </Card>

      <Card>
        <Txt v="label">Por que isso importa</Txt>
        <Txt v="small">
          Amplitude é treino: agachar fundo com controle constrói mais que agachar meio caminho com
          o dobro do peso. E ombro ou quadril travados são onde mais aparece lesão em quem treina
          há anos.
        </Txt>
        <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
          Frequência ganha de duração: 5 minutos todo dia rendem mais que 40 minutos uma vez
          por semana.
        </Txt>
      </Card>

      {ROTINAS.map((r, i) => {
        const comVideo = r.movimentos.filter((m) => VIDEOS[m.nome]).length;
        const vezes = feitas[r.chave] ?? 0;
        return (
          <Animated.View key={r.chave} entering={FadeInDown.delay(i * 45).duration(280)}>
            <Card
              onPress={() => setAtiva(r)}
              faixa={
                r.tipo === 'dinamico'
                  ? colors.warn
                  : r.tipo === 'estatico'
                    ? colors.info
                    : colors.success
              }
            >
              <View style={s.linha}>
                <Txt size={26}>{r.emoji}</Txt>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="h3">{r.nome}</Txt>
                  <Txt v="small" cor={colors.textFaint}>
                    {r.quando}
                  </Txt>
                  <View style={s.selos}>
                    <Selo icone="list-outline" texto={`${r.movimentos.length} movimentos`} />
                    <Selo icone="time-outline" texto={`${Math.round(duracaoTotal(r) / 60)} min`} />
                    {comVideo > 0 ? (
                      <Selo icone="logo-youtube" texto={`${comVideo} com vídeo`} cor="#FF0033" />
                    ) : null}
                    {vezes > 0 ? (
                      <Selo icone="checkmark-circle" texto={`${vezes}×`} cor={colors.success} />
                    ) : null}
                  </View>
                </View>
                <Ionicons name="play-circle" size={30} color={colors.primary} />
              </View>
              <Txt v="small" style={{ marginTop: spacing.sm }}>
                {r.descricao}
              </Txt>
              {/* Saber o que vem antes de começar evita abrir só para desistir. */}
              <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 4 }}>
                {r.movimentos
                  .slice(0, 3)
                  .map((m) => m.nome)
                  .join(' · ')}
                {r.movimentos.length > 3 ? ` · +${r.movimentos.length - 3}` : ''}
              </Txt>
            </Card>
          </Animated.View>
        );
      })}

      <View style={{ gap: spacing.md }}>
        <Txt v="label">Princípios</Txt>
        {PRINCIPIOS.map((p) => (
          <Card key={p.titulo} padding={spacing.md}>
            <Txt v="h3" size={15}>
              {p.titulo}
            </Txt>
            <Txt v="small">{p.texto}</Txt>
          </Card>
        ))}
      </View>
    </Tela>
  );
}

/** Execução guiada: um movimento por vez, com contagem e avanço automático. */
function Execucao({ rotina, onSair }: { rotina: RotinaMobilidade; onSair: () => void }) {
  useKeepAwake();
  const [idx, setIdx] = useState(0);
  const [lado, setLado] = useState<0 | 1>(0);
  const [resta, setResta] = useState(rotina.movimentos[0].duracaoSeg);
  const [rodando, setRodando] = useState(false);
  const [feito, setFeito] = useState(false);
  const inicio = useRef(Date.now());

  const mov = rotina.movimentos[idx];
  const total = rotina.movimentos.reduce((a, m) => a + (m.bilateral ? 2 : 1), 0);
  const passoAtual = rotina.movimentos.slice(0, idx).reduce((a, m) => a + (m.bilateral ? 2 : 1), 0) + lado + 1;

  useEffect(() => {
    prepararAudio();
  }, []);

  useEffect(() => {
    if (!rodando || feito) return;

    if (resta <= 0) {
      // Bilateral: repete o mesmo movimento do outro lado antes de avançar.
      if (mov.bilateral && lado === 0) {
        buzz.medio();
        setLado(1);
        setResta(mov.duracaoSeg);
        return;
      }
      if (idx + 1 >= rotina.movimentos.length) {
        setRodando(false);
        setFeito(true);
        alarmeConclusao();
        void registrarSessao(rotina.chave, Math.round((Date.now() - inicio.current) / 1000));
        return;
      }
      buzz.medio();
      setLado(0);
      setIdx(idx + 1);
      setResta(rotina.movimentos[idx + 1].duracaoSeg);
      return;
    }

    if (resta <= 3) bipCurto();
    const t = setTimeout(() => setResta((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rodando, resta, idx, lado, mov, rotina, feito]);

  if (feito) {
    return (
      <Tela titulo="Concluído" subtitulo={rotina.nome}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Card destaque>
            <Txt size={44} center>
              ✅
            </Txt>
            <Txt v="h2" center>
              {rotina.nome}
            </Txt>
            <Txt v="small" center>
              {rotina.movimentos.length} movimentos ·{' '}
              {duracao(Math.round((Date.now() - inicio.current) / 1000))}
            </Txt>
          </Card>
        </Animated.View>
        <Button titulo="Voltar" full tam="lg" onPress={onSair} />
      </Tela>
    );
  }

  return (
    <Tela titulo={rotina.nome} subtitulo={`Movimento ${passoAtual} de ${total}`} scroll={false}>
      <View style={s.exec}>
        <Anel
          valor={mov.duracaoSeg > 0 ? 1 - resta / mov.duracaoSeg : 0}
          tamanho={190}
          espessura={14}
          cor={rodando ? colors.primary : colors.textFaint}
          centro={String(resta)}
          legenda="segundos"
        />

        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Txt v="h1" center size={24}>
            {mov.nome}
          </Txt>
          {mov.bilateral ? (
            <View style={s.ladoTag}>
              <Txt v="small" cor={colors.primary} bold>
                {lado === 0 ? 'Lado direito' : 'Lado esquerdo'}
              </Txt>
            </View>
          ) : null}
          {mov.reps ? (
            <Txt v="small" cor={colors.textDim}>
              cerca de {mov.reps} repetições
            </Txt>
          ) : null}
        </View>

        <Card>
          <Txt v="body" center>
            {mov.instrucao}
          </Txt>
          {mov.erro ? (
            <View style={s.erro}>
              <Ionicons name="alert-circle" size={15} color={colors.warn} />
              <Txt v="small" cor={colors.warn} style={{ flex: 1 }}>
                {mov.erro}
              </Txt>
            </View>
          ) : null}
        </Card>

        {/* Descrição em texto não resolve mobilidade: a diferença entre fazer
            certo e errado está no ângulo, e ângulo se vê, não se lê. */}
        <VideoDoMovimento nome={mov.nome} />

        <View style={s.controles}>
          <Press
            onPress={() => {
              if (idx > 0) {
                setIdx(idx - 1);
                setLado(0);
                setResta(rotina.movimentos[idx - 1].duracaoSeg);
              }
            }}
            style={s.ctrlSec}
            scale={0.92}
          >
            <Ionicons name="play-skip-back" size={20} color={colors.textDim} />
          </Press>

          <Press onPress={() => setRodando((r) => !r)} style={s.ctrlPrin} scale={0.94} haptic="medio">
            <Ionicons name={rodando ? 'pause' : 'play'} size={30} color="#1A0800" />
          </Press>

          <Press
            onPress={() => {
              setResta(0);
              if (!rodando) setRodando(true);
            }}
            style={s.ctrlSec}
            scale={0.92}
          >
            <Ionicons name="play-skip-forward" size={20} color={colors.textDim} />
          </Press>
        </View>

        <Press onPress={onSair} haptic="leve">
          <Txt v="small" cor={colors.textFaint}>
            Encerrar
          </Txt>
        </Press>
      </View>
    </Tela>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selos: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },
  exec: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingBottom: spacing['4xl'] },
  ladoTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  erro: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  controles: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  ctrlPrin: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlSec: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
