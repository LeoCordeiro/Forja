import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Card, Empty, ExerciseDemo, Linha, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  alternarFavorito,
  evolucaoExercicio,
  getExercicio,
  prsDoExercicio,
} from '@/features/treino/api';
import { nomeGrupo, num, peso } from '@/shared/utils/format';
import { dataCurta } from '@/shared/utils/date';

const ROTULO_PR: Record<string, string> = {
  e1rm: '1RM estimado',
  carga_max: 'Carga máxima',
  volume_serie: 'Melhor série',
  reps_max: 'Mais repetições',
};

export default function DetalheExercicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exId = Number(id);
  const router = useRouter();

  const { dados, recarregar } = useDados(async () => {
    const [ex, prs, evo] = await Promise.all([
      getExercicio(exId),
      prsDoExercicio(exId),
      evolucaoExercicio(exId),
    ]);
    return { ex, prs, evo };
  }, [exId]);

  if (!dados?.ex) return <Screen titulo="Carregando…">{null}</Screen>;
  const { ex, prs, evo } = dados;

  const serie = evo.map((e) => ({ x: dataCurta(e.dia), y: Math.round(e.e1rm * 10) / 10 }));

  return (
    <Screen
      titulo={ex.nome}
      subtitulo={`${nomeGrupo(ex.grupo_primario)}${ex.equipamento ? ` · ${ex.equipamento}` : ''}`}
      onRefresh={recarregar}
      acaoTopo={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Press
            onPress={async () => {
              await alternarFavorito(exId);
              recarregar();
            }}
            style={s.iconeBtn}
            scale={0.9}
          >
            <Ionicons
              name={ex.favorito ? 'star' : 'star-outline'}
              size={19}
              color={ex.favorito ? colors.warn : colors.textDim}
            />
          </Press>
          <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
            <Ionicons name="close" size={20} color={colors.textDim} />
          </Press>
        </View>
      }
    >
      <Animated.View entering={FadeInDown.duration(300)}>
        <ExerciseDemo mediaUrl={ex.media_url} altura={230} />
      </Animated.View>

      {ex.instrucoes ? (
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Como executar</Txt>
          <Card>
            {ex.instrucoes.split('|').map((p, i) => (
              <View key={i} style={s.passo}>
                <View style={s.passoNum}>
                  <Txt v="small" cor={colors.primary} size={11} bold>
                    {i + 1}
                  </Txt>
                </View>
                <Txt v="body" style={{ flex: 1 }}>
                  {p}
                </Txt>
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {ex.dica ? (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={s.dica}>
            <Ionicons name="bulb" size={18} color={colors.warn} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="label" cor={colors.warn}>
                Erro mais comum
              </Txt>
              <Txt v="body" cor={colors.warn}>
                {ex.dica}
              </Txt>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Seus recordes</Txt>
        {prs.length ? (
          <View style={s.gridPR}>
            {prs.map((p) => (
              <Card key={p.id} style={{ flex: 1, minWidth: '46%' }} padding={spacing.md}>
                <Txt v="label" size={10}>
                  {ROTULO_PR[p.tipo] ?? p.tipo}
                </Txt>
                <Txt v="h2" cor={colors.warn}>
                  {peso(p.valor)}
                  <Txt v="small" cor={colors.textDim}>
                    {' '}
                    kg
                  </Txt>
                </Txt>
                {p.peso_kg && p.reps ? (
                  <Txt v="small" cor={colors.textFaint} size={11}>
                    {peso(p.peso_kg)} kg × {p.reps}
                  </Txt>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <Empty
            icone="trophy-outline"
            titulo="Sem recordes ainda"
            texto="Registre este exercício em um treino para começar a acompanhar sua progressão."
          />
        )}
      </Animated.View>

      {serie.length > 1 ? (
        <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Progressão de força (1RM estimado)</Txt>
          <Card>
            <Linha dados={serie} sufixo="kg" cor={colors.primary} />
          </Card>
          <Txt v="small" cor={colors.textFaint}>
            Estimativa por Epley: peso × (1 + reps ÷ 30). Sobe tanto ao aumentar carga quanto ao
            fazer mais repetições com o mesmo peso.
          </Txt>
        </Animated.View>
      ) : null}

      {evo.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(220).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Últimas sessões</Txt>
          {[...evo].reverse().slice(0, 8).map((e) => (
            <Card key={e.dia} padding={spacing.md}>
              <View style={s.entre}>
                <Txt v="body">{dataCurta(e.dia)}</Txt>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt v="h3">{num(e.volume)} kg</Txt>
                  <Txt v="small" cor={colors.textFaint} size={11}>
                    volume · 1RM {peso(e.e1rm)} kg
                  </Txt>
                </View>
              </View>
            </Card>
          ))}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  passo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 3 },
  passoNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dica: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: `${colors.warn}44`,
  },
  gridPR: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
