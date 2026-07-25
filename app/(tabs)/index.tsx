import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Anel, Barra, Button, Card, Empty, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo } from '@/features/perfil/api';
import { listarDias, prsRecentes, sessaoAberta } from '@/features/treino/api';
import { macrosDoDia } from '@/features/dieta/api';
import { getStats, progressoNivel } from '@/features/gamificacao/api';
import { kcal, num, pct, peso, volume } from '@/shared/utils/format';
import { dataAmigavel, hoje } from '@/shared/utils/date';

export default function Home() {
  const router = useRouter();

  const { dados, carregando, recarregar } = useDados(async () => {
    const [r, dias, macros, stats, prs, aberta] = await Promise.all([
      resumo(),
      listarDias(),
      macrosDoDia(),
      getStats(),
      prsRecentes(3),
      sessaoAberta(),
    ]);
    return { r, dias, macros, stats, prs, aberta };
  }, []);

  if (carregando || !dados?.r) {
    return (
      <Screen titulo="Carregando…">
        <View />
      </Screen>
    );
  }

  const { r, dias, macros, stats, prs, aberta } = dados;
  const nivel = progressoNivel(stats.xp_total);
  const primeiroNome = r.perfil.nome.split(' ')[0];

  // Sugere o dia menos recente da rotina — o que está "devendo" há mais tempo.
  const sugerido = [...dias].sort(
    (a, b) => (a.ultima_vez ?? 0) - (b.ultima_vez ?? 0)
  )[0];

  return (
    <Screen
      titulo={`${saudacao()}, ${primeiroNome}`}
      subtitulo={dataAmigavel(hoje())}
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.push('/conquistas')} style={s.streakBtn} scale={0.92}>
          <Txt size={15}>🔥</Txt>
          <Txt v="h3">{stats.streak_atual}</Txt>
        </Press>
      }
    >
      {/* Sessão em andamento tem prioridade sobre tudo na tela. */}
      {aberta ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card destaque onPress={() => router.push(`/sessao/${aberta.id}`)}>
            <View style={s.entre}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="label" cor={colors.primary}>
                  Treino em andamento
                </Txt>
                <Txt v="h2">{aberta.nome}</Txt>
              </View>
              <Ionicons name="play-circle" size={40} color={colors.primary} />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Nível ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)}>
        <Card>
          <View style={s.entre}>
            <View style={s.nivelBadge}>
              <Txt v="label" cor={colors.xp} size={9}>
                Nível
              </Txt>
              <Txt v="h1" cor={colors.xp}>
                {nivel.nivel}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={s.entre}>
                <Txt v="small">{num(nivel.xpAtual)} XP</Txt>
                <Txt v="small" cor={colors.textFaint}>
                  faltam {num(nivel.faltam)}
                </Txt>
              </View>
              <Barra valor={nivel.fracao} cor={colors.xp} />
              <Txt v="small" cor={colors.textFaint} size={11}>
                {stats.maior_streak > 0
                  ? `Maior sequência: ${stats.maior_streak} dias`
                  : 'Treine hoje para começar sua sequência'}
              </Txt>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Treino de hoje ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Treino de hoje</Txt>
        {sugerido ? (
          <Card faixa={sugerido.cor ?? colors.primary}>
            <Txt v="h2">{sugerido.nome}</Txt>
            <View style={s.linhaInfo}>
              <Info icone="list" texto={`${sugerido.qtd_exercicios} exercícios`} />
              <Info
                icone="time-outline"
                texto={
                  sugerido.ultima_vez
                    ? `Última vez: ${dataAmigavel(isoDeTs(sugerido.ultima_vez))}`
                    : 'Nunca treinado'
                }
              />
            </View>
            <Button
              titulo={aberta ? 'Ver treino em andamento' : 'Iniciar treino'}
              icone="flame"
              full
              style={{ marginTop: spacing.sm }}
              onPress={() =>
                aberta ? router.push(`/sessao/${aberta.id}`) : router.push(`/dia/${sugerido.id}`)
              }
            />
          </Card>
        ) : (
          <Empty
            icone="barbell-outline"
            titulo="Nenhuma rotina ainda"
            texto="Crie sua primeira divisão de treino para começar."
            acao={{ titulo: 'Criar rotina', onPress: () => router.push('/treino') }}
          />
        )}
      </Animated.View>

      {/* ── Nutrição do dia ── */}
      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
        <View style={s.entre}>
          <Txt v="label">Nutrição de hoje</Txt>
          <Press onPress={() => router.push('/dieta')} haptic="leve">
            <Txt v="small" cor={colors.primary} bold>
              Ver tudo
            </Txt>
          </Press>
        </View>
        <Card>
          <View style={s.nutri}>
            <Anel
              valor={pct(macros.kcal, r.meta.kcal)}
              tamanho={104}
              centro={kcal(macros.kcal)}
              legenda="kcal"
              cor={macros.kcal > r.meta.kcal * 1.05 ? colors.danger : colors.primary}
            />
            <View style={{ flex: 1, gap: spacing.md }}>
              <LinhaMacro
                label="Proteína"
                atual={macros.proteina_g}
                meta={r.meta.proteina_g}
                cor={colors.protein}
              />
              <LinhaMacro
                label="Carboidrato"
                atual={macros.carbo_g}
                meta={r.meta.carbo_g}
                cor={colors.carb}
              />
              <LinhaMacro
                label="Gordura"
                atual={macros.gordura_g}
                meta={r.meta.gordura_g}
                cor={colors.fat}
              />
            </View>
          </View>
          <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
            Meta de {num(r.meta.kcal)} kcal · faltam{' '}
            {num(Math.max(0, r.meta.kcal - macros.kcal))} kcal
          </Txt>
        </Card>
      </Animated.View>

      {/* ── Recordes recentes ── */}
      {prs.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Recordes recentes</Txt>
          {prs.map((p) => (
            <Card key={p.id} padding={spacing.md} onPress={() => router.push(`/exercicio/${p.exercise_id}`)}>
              <View style={s.entre}>
                <View style={s.prIcone}>
                  <Ionicons name="trophy" size={16} color={colors.warn} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{p.exercicio}</Txt>
                  <Txt v="small">
                    {p.tipo === 'e1rm' ? '1RM estimado' : 'Carga máxima'} · {dataAmigavel(isoDeTs(p.atingido_em))}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt v="h3" cor={colors.warn}>
                    {peso(p.valor)} kg
                  </Txt>
                  {p.valor_anterior ? (
                    <Txt v="small" cor={colors.success} size={11}>
                      +{peso(p.valor - p.valor_anterior)}
                    </Txt>
                  ) : null}
                </View>
              </View>
            </Card>
          ))}
        </Animated.View>
      ) : null}

      {/* ── Atalhos ── */}
      <Animated.View entering={FadeInDown.delay(300).duration(300)} style={s.atalhos}>
        <Atalho
          icone="add-circle-outline"
          label="Registrar peso"
          onPress={() => router.push('/evolucao')}
        />
        <Atalho
          icone="cart-outline"
          label="Lista de compras"
          onPress={() => router.push('/compras')}
        />
        <Atalho
          icone="trophy-outline"
          label="Medalhas"
          onPress={() => router.push('/conquistas')}
        />
      </Animated.View>
    </Screen>
  );
}

function LinhaMacro({
  label,
  atual,
  meta,
  cor,
}: {
  label: string;
  atual: number;
  meta: number;
  cor: string;
}) {
  return (
    <View style={{ gap: 5 }}>
      <View style={s.entre}>
        <Txt v="small" cor={colors.textDim} size={12}>
          {label}
        </Txt>
        <Txt v="small" size={12}>
          {num(atual)} / {num(meta)} g
        </Txt>
      </View>
      <Barra valor={pct(atual, meta)} cor={cor} altura={6} excedeu={atual > meta * 1.1} />
    </View>
  );
}

function Info({ icone, texto }: { icone: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View style={s.info}>
      <Ionicons name={icone} size={13} color={colors.textFaint} />
      <Txt v="small" cor={colors.textFaint} size={12}>
        {texto}
      </Txt>
    </View>
  );
}

function Atalho({
  icone,
  label,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={s.atalho} scale={0.94}>
      <Ionicons name={icone} size={22} color={colors.textDim} />
      <Txt v="small" size={11} center>
        {label}
      </Txt>
    </Press>
  );
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function isoDeTs(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  streakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nivelBadge: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.xpSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaInfo: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nutri: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  prIcone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.warnSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhos: { flexDirection: 'row', gap: spacing.sm },
  atalho: {
    flex: 1,
    gap: 6,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
});
