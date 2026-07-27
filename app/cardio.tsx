import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Anel, Button, Card, Chip, Press, Tela, Txt } from '@/shared/ui';
import {
  duracaoTotal,
  PROTOCOLOS,
  REGRAS_CONVIVENCIA,
  sequencia,
  type Bloco,
  type ProtocoloCardio,
} from '@/features/cardio/protocolos';
import { cronometro } from '@/shared/utils/format';
import { alarmeConclusao, alarmeFimDescanso, bipCurto, prepararAudio } from '@/shared/utils/alarme';
import { manterAudioVivo } from '@/shared/utils/alarme';
import { buzz } from '@/shared/utils/haptics';
import { registrarSessao } from '@/features/mobilidade/api';

/**
 * Cardio com hora e lugar.
 *
 * Cardio solto no fim do treino não é programa: é o que sobrou. Aqui cada
 * protocolo diz quanto interfere na musculação e em que dia cabe — que é a
 * informação que decide se ele vai ser feito ou abandonado na terceira semana.
 */
export default function Cardio() {
  const [ativo, setAtivo] = useState<ProtocoloCardio | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'zona2' | 'hiit'>('todos');

  if (ativo) return <Execucao p={ativo} onSair={() => setAtivo(null)} />;

  const lista = PROTOCOLOS.filter((p) =>
    filtro === 'todos' ? true : filtro === 'zona2' ? p.interferencia <= 1 : p.interferencia >= 2
  );

  return (
    <Tela titulo="Cardio" subtitulo="Com hora marcada, não como sobra do treino">
      <Card faixa={colors.info}>
        <Txt v="label">Cardio atrapalha o ganho?</Txt>
        <Txt v="small" style={{ marginTop: 4 }}>
          Não de forma relevante. A maior revisão do tema, com 43 estudos, não achou prejuízo de
          força máxima nem de hipertrofia. O que cai mesmo é potência explosiva, cerca de 28% — e
          principalmente quando as duas coisas acontecem na mesma sessão.
        </Txt>
        <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
          O detalhe que decide: corrida atrapalha, bicicleta quase não. É o impacto da passada, não
          o cardio em si.
        </Txt>
      </Card>

      <View style={s.abas}>
        <Chip label="Todos" ativo={filtro === 'todos'} onPress={() => setFiltro('todos')} />
        <Chip label="Leve" ativo={filtro === 'zona2'} onPress={() => setFiltro('zona2')} />
        <Chip label="Intenso" ativo={filtro === 'hiit'} onPress={() => setFiltro('hiit')} />
      </View>

      {lista.map((p, i) => (
        <Animated.View key={p.chave} entering={FadeInDown.delay(i * 40).duration(280)}>
          <Card onPress={() => setAtivo(p)} faixa={corDaInterferencia(p.interferencia)}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Txt size={26}>{p.emoji}</Txt>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt v="h3">{p.nome}</Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {p.minutos} min · {p.preferir}
                </Txt>
                <Interferencia nivel={p.interferencia} />
              </View>
              <Ionicons name="play-circle" size={30} color={colors.primary} />
            </View>
            <Txt v="small" style={{ marginTop: spacing.sm }}>
              {p.descricao}
            </Txt>
            <View style={s.quando}>
              <Ionicons name="calendar-outline" size={13} color={colors.textFaint} />
              <Txt v="small" size={11} cor={colors.textFaint} style={{ flex: 1 }}>
                {p.quando}
              </Txt>
            </View>
          </Card>
        </Animated.View>
      ))}

      <View style={{ gap: spacing.sm }}>
        <Txt v="label">Como encaixar sem perder músculo</Txt>
        {REGRAS_CONVIVENCIA.map((r) => (
          <Card key={r.titulo} padding={spacing.md}>
            <Txt v="h3" size={14}>
              {r.titulo}
            </Txt>
            <Txt v="small" size={11} cor={colors.textFaint}>
              {r.texto}
            </Txt>
          </Card>
        ))}
      </View>
    </Tela>
  );
}

function corDaInterferencia(n: number) {
  return n === 0 ? colors.success : n === 1 ? colors.info : n === 2 ? colors.warn : colors.danger;
}

function Interferencia({ nivel }: { nivel: number }) {
  const rotulo = ['não atrapalha', 'quase não atrapalha', 'atrapalha um pouco', 'atrapalha'][nivel];
  return (
    <View style={s.selo}>
      <View style={s.pontos}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              s.ponto,
              i <= nivel && { backgroundColor: corDaInterferencia(nivel) },
            ]}
          />
        ))}
      </View>
      <Txt v="small" size={10} cor={corDaInterferencia(nivel)} bold>
        {rotulo}
      </Txt>
    </View>
  );
}

// ─────────────────────────── Execução ───────────────────────────

function Execucao({ p, onSair }: { p: ProtocoloCardio; onSair: () => void }) {
  useKeepAwake();
  const blocos = useRef<Bloco[]>(sequencia(p)).current;
  const [idx, setIdx] = useState(0);
  const [resta, setResta] = useState(blocos[0].duracao);
  const [rodando, setRodando] = useState(false);
  const [fim, setFim] = useState(false);

  const bloco = blocos[idx];
  const decorridoTotal =
    blocos.slice(0, idx).reduce((a, b) => a + b.duracao, 0) + (bloco.duracao - resta);
  const total = duracaoTotal(p);

  useEffect(() => {
    prepararAudio();
    manterAudioVivo(true);
    return () => manterAudioVivo(false);
  }, []);

  useEffect(() => {
    if (!rodando || fim) return;
    const t = setTimeout(() => {
      setResta((r) => {
        if (r > 1) {
          // Contagem nos últimos segundos: a troca de bloco não pode pegar
          // de surpresa quem está com o pé no pedal.
          if (r <= 4) bipCurto();
          return r - 1;
        }
        if (idx + 1 >= blocos.length) {
          alarmeConclusao();
          buzz.ok();
          setFim(true);
          void registrarSessao(`cardio:${p.chave}`, total);
          return 0;
        }
        alarmeFimDescanso();
        setIdx((i) => i + 1);
        return blocos[idx + 1].duracao;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [rodando, resta, idx, fim, blocos, p.chave, total]);

  if (fim) {
    return (
      <Tela titulo="Cardio concluído" scroll={false}>
        <View style={s.centro}>
          <Txt size={60}>✅</Txt>
          <Txt v="h1" center>
            {p.nome}
          </Txt>
          <Txt v="small" center cor={colors.textFaint}>
            {Math.round(total / 60)} minutos concluídos
          </Txt>
          <Button titulo="Voltar" full tam="lg" onPress={onSair} style={{ marginTop: spacing.xl }} />
        </View>
      </Tela>
    );
  }

  const forte = bloco.intensidade === 'forte';
  const cor = forte ? colors.danger : bloco.intensidade === 'moderado' ? colors.primary : colors.info;

  return (
    <Tela titulo={p.nome} subtitulo={`${idx + 1} de ${blocos.length}`} scroll={false}>
      <View style={s.centro}>
        <Anel
          valor={bloco.duracao > 0 ? 1 - resta / bloco.duracao : 0}
          tamanho={210}
          espessura={16}
          cor={rodando ? cor : colors.textFaint}
          centro={cronometro(resta)}
          legenda={bloco.rotulo}
        />

        {/* O aviso de intensidade é o que substitui o monitor cardíaco. */}
        <Animated.View entering={FadeIn.duration(200)} key={bloco.rotulo}>
          <View style={[s.faixaIntensidade, { backgroundColor: cor + '22', borderColor: cor }]}>
            <Ionicons name={forte ? 'flame' : 'leaf-outline'} size={18} color={cor} />
            <Txt v="h3" cor={cor} size={16}>
              {forte ? 'FORTE' : bloco.intensidade === 'moderado' ? 'RITMO' : 'LEVE'}
            </Txt>
          </View>
        </Animated.View>

        <Card padding={spacing.md}>
          <Txt v="small" center>
            {p.comoSaber}
          </Txt>
        </Card>

        <View style={{ width: '100%', gap: 4 }}>
          <View style={s.entre}>
            <Txt v="small" size={11} cor={colors.textFaint}>
              {cronometro(decorridoTotal)}
            </Txt>
            <Txt v="small" size={11} cor={colors.textFaint}>
              {cronometro(total)}
            </Txt>
          </View>
          <View style={s.trilhoTotal}>
            <View style={[s.preenchidoTotal, { width: `${(decorridoTotal / total) * 100}%` }]} />
          </View>
        </View>

        <View style={s.controles}>
          <Press
            onPress={() => {
              if (idx > 0) {
                setIdx(idx - 1);
                setResta(blocos[idx - 1].duracao);
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
              if (idx + 1 < blocos.length) {
                setIdx(idx + 1);
                setResta(blocos[idx + 1].duracao);
              }
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
  abas: { flexDirection: 'row', gap: spacing.sm },
  entre: { flexDirection: 'row', justifyContent: 'space-between' },
  quando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pontos: { flexDirection: 'row', gap: 3 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  faixaIntensidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  trilhoTotal: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  preenchidoTotal: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  controles: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  ctrlPrin: {
    width: 74,
    height: 74,
    borderRadius: 37,
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
