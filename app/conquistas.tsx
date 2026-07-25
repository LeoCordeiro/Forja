import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Card, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  getStats,
  historicoPontos,
  listarConquistas,
  progressoNivel,
  xpParaNivel,
} from '@/features/gamificacao/api';
import { num, pct } from '@/shared/utils/format';
import { dataAmigavel } from '@/shared/utils/sessao';

const TIER = {
  bronze: { label: 'Bronze', cor: '#C9803C' },
  prata: { label: 'Prata', cor: '#A9B4C4' },
  ouro: { label: 'Ouro', cor: '#FFB020' },
  diamante: { label: 'Diamante', cor: '#63D8FF' },
} as const;

const ORIGEM: Record<string, { label: string; icone: keyof typeof Ionicons.glyphMap }> = {
  treino: { label: 'Treino concluído', icone: 'barbell' },
  pr: { label: 'Recorde pessoal', icone: 'trophy' },
  medalha: { label: 'Medalha', icone: 'ribbon' },
  streak: { label: 'Sequência', icone: 'flame' },
  dieta: { label: 'Dieta', icone: 'restaurant' },
};

export default function Conquistas() {
  const router = useRouter();

  const { dados, recarregar } = useDados(async () => {
    const [lista, stats, pontos] = await Promise.all([
      listarConquistas(),
      getStats(),
      historicoPontos(20),
    ]);
    return { lista, stats, pontos };
  }, []);

  if (!dados) return <Screen titulo="Carregando…">{null}</Screen>;
  const { lista, stats, pontos } = dados;
  const nivel = progressoNivel(stats.xp_total);
  const desbloqueadas = lista.filter((a) => a.desbloqueado_em);

  return (
    <Screen
      titulo="Conquistas"
      subtitulo={`${desbloqueadas.length} de ${lista.length} medalhas`}
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Press>
      }
    >
      {/* ── Nível ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card>
          <View style={s.nivelTopo}>
            <View style={s.selo}>
              <Txt v="label" cor={colors.xp} size={9}>
                Nível
              </Txt>
              <Txt v="display" cor={colors.xp} size={38}>
                {nivel.nivel}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Txt v="h2">{num(stats.xp_total)} XP</Txt>
              <Barra valor={nivel.fracao} cor={colors.xp} altura={8} />
              <Txt v="small" cor={colors.textFaint}>
                Faltam {num(nivel.faltam)} XP para o nível {nivel.nivel + 1} (
                {num(xpParaNivel(nivel.nivel + 1))} XP)
              </Txt>
            </View>
          </View>

          <View style={s.statsLinha}>
            <ItemStat emoji="🔥" valor={String(stats.streak_atual)} label="Sequência atual" />
            <ItemStat emoji="🏔️" valor={String(stats.maior_streak)} label="Maior sequência" />
            <ItemStat
              emoji="🧊"
              valor={String(stats.freezes_disponiveis)}
              label="Proteções"
            />
          </View>
          <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
            Proteção perdoa automaticamente um dia perdido, para você não zerar a sequência por um
            imprevisto. Você recupera uma a cada 14 dias seguidos.
          </Txt>
        </Card>
      </Animated.View>

      {/* ── Medalhas ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Medalhas</Txt>
        <View style={s.grid}>
          {lista.map((a, i) => {
            const tier = TIER[a.tier] ?? TIER.bronze;
            const aberta = !!a.desbloqueado_em;
            return (
              <Animated.View
                key={a.code}
                entering={FadeInDown.delay(80 + i * 25).duration(260)}
                style={s.celula}
              >
                <View
                  style={[
                    s.medalha,
                    aberta
                      ? { borderColor: tier.cor, backgroundColor: `${tier.cor}18` }
                      : { opacity: 0.55 },
                  ]}
                >
                  <Txt size={30} style={!aberta && s.bloqueada}>
                    {aberta ? a.icone : '🔒'}
                  </Txt>
                  <Txt v="h3" center size={13} numberOfLines={2}>
                    {a.nome}
                  </Txt>
                  <Txt v="small" center size={10} cor={colors.textFaint} numberOfLines={2}>
                    {a.descricao}
                  </Txt>

                  {aberta ? (
                    <View style={[s.tierTag, { backgroundColor: `${tier.cor}28` }]}>
                      <Txt v="small" size={9} cor={tier.cor} bold>
                        {tier.label} · +{a.pontos}
                      </Txt>
                    </View>
                  ) : (
                    <View style={{ width: '100%', gap: 3 }}>
                      <Barra valor={pct(a.progresso, a.meta)} cor={tier.cor} altura={4} />
                      <Txt v="small" center size={10} cor={colors.textFaint}>
                        {a.progresso}/{a.meta}
                      </Txt>
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      {/* ── Histórico de XP ── */}
      {pontos.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Últimos ganhos de XP</Txt>
          <Card padding={0}>
            {pontos.map((p, i) => {
              const info = ORIGEM[p.origem] ?? { label: p.origem, icone: 'star' as const };
              return (
                <View
                  key={p.id}
                  style={[s.evento, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <View style={s.eventoIcone}>
                    <Ionicons name={info.icone} size={15} color={colors.xp} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="body" size={14}>
                      {p.descricao || info.label}
                    </Txt>
                    <Txt v="small" cor={colors.textFaint} size={11}>
                      {info.label} · {dataAmigavel(p.criado_em)}
                    </Txt>
                  </View>
                  <Txt v="h3" cor={colors.xp}>
                    +{p.pontos}
                  </Txt>
                </View>
              );
            })}
          </Card>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

function ItemStat({ emoji, valor, label }: { emoji: string; valor: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt size={19}>{emoji}</Txt>
      <Txt v="h2">{valor}</Txt>
      <Txt v="small" size={10} center cor={colors.textFaint}>
        {label}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  nivelTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  selo: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    backgroundColor: colors.xpSoft,
    borderWidth: 1,
    borderColor: `${colors.xp}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLinha: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  celula: { width: '31.5%' },
  medalha: {
    flex: 1,
    minHeight: 148,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bloqueada: { opacity: 0.6 },
  tierTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  evento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eventoIcone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.xpSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
