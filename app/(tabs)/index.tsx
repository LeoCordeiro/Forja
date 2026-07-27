import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, shadow, spacing } from '@/theme';
import { resumoPassos, registrarPassos } from '@/features/passos/api';
import { resumoSolo } from '@/features/liga/api';
import { Anel, Barra, Button, Card, Empty, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo } from '@/features/perfil/api';
import { listarDias, prsRecentes, sessaoAberta } from '@/features/treino/api';
import { macrosDoDia } from '@/features/dieta/api';
import { getStats, progressoNivel } from '@/features/gamificacao/api';
import { kcal, num, pct, peso } from '@/shared/utils/format';
import { dataAmigavel, hoje } from '@/shared/utils/date';
import { resumoSemana } from '@/features/treino/frequencia';
import { registrar as registrarAgua, statusHidratacao, totalDoDia } from '@/features/agua/api';
import { faseDaSemana, LABEL_FASE, planoRetorno, semanaAtual as semanaDoPlano } from '@/features/treino/periodizacao';
import { Ajuda } from '@/shared/ui/Ajuda';
import { AJUDA } from '@/shared/ajudas';
import { buzz } from '@/shared/utils/haptics';

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
    const [semana, agua, passos, liga] = await Promise.all([
      resumoSemana(r?.perfil.dias_treino_semana ?? 3),
      totalDoDia(),
      resumoPassos(r?.perfil.passos_alvo ?? 8000, r?.pesoKg ?? 80),
      resumoSolo(),
    ]);
    return { r, dias, macros, stats, prs, aberta, semana, agua, passos, liga };
  }, []);

  if (carregando || !dados?.r) {
    return (
      <Screen titulo="Carregando…">
        <View />
      </Screen>
    );
  }

  const { r, dias, macros, stats, prs, aberta, semana, agua, passos, liga } = dados;
  const nivel = progressoNivel(stats.xp_total);
  const primeiroNome = r.perfil.nome.split(' ')[0];
  const statusAgua = statusHidratacao(agua, r.metaAguaMl);

  // Fase do plano de retorno — muda o que se espera do treino desta semana.
  const semanaPlano = r.perfil.retomou_em ? semanaDoPlano(r.perfil.retomou_em) : null;
  const plano = planoRetorno(r.perfil.meses_parado ?? 0);
  const fase = semanaPlano ? faseDaSemana(plano, semanaPlano) : null;

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

      {/* ── Semana ── */}
      <Animated.View entering={FadeInDown.delay(90).duration(300)}>
        <Card>
          <View style={s.entre}>
            <Txt v="label">Sua semana</Txt>
            <Txt v="small" cor={semana.feitos >= semana.meta ? colors.success : colors.textDim} bold>
              {semana.feitos} de {semana.meta}
            </Txt>
          </View>

          <View style={s.semana}>
            {semana.dias.map((d) => (
              <View key={d.data} style={s.diaCol}>
                <Txt v="small" size={10} cor={d.hoje ? colors.primary : colors.textFaint} bold={d.hoje}>
                  {d.letra}
                </Txt>
                {/* Dia sem treino fica vazio, não com "✕". O X lia como falta
                    cometida — e descansar segunda quando o plano é 3x/semana
                    não é falta nenhuma. */}
                <View
                  style={[
                    s.diaBox,
                    d.treinou && s.diaFeito,
                    d.hoje && !d.treinou && { borderColor: colors.primary, borderWidth: 2 },
                    d.futuro && { opacity: 0.35 },
                  ]}
                >
                  {d.treinou ? <Ionicons name="checkmark" size={17} color="#00251A" /> : null}
                </View>
              </View>
            ))}
          </View>

          <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
            {semana.mensagem}
          </Txt>

          {/* Sequência e pontos ficam colados na semana: é o mesmo assunto —
              apareceu ou não apareceu. Separar em telas afasta o número da
              decisão que ele deveria influenciar. */}
          <Press onPress={() => router.push('/liga')} style={s.ligaLinha} haptic="leve">
            <Ionicons name="flame" size={16} color={colors.primary} />
            <Txt v="small" size={12} style={{ flex: 1 }}>
              {liga.sequencia > 0
                ? `${liga.sequencia} dia${liga.sequencia > 1 ? 's seguidos' : ' seguido'} · ${liga.pontosSemana} pts`
                : 'Nenhum check-in ainda'}
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Press>
        </Card>
      </Animated.View>

      {/* ── Passos ── */}
      {/* Sempre visível, com alvo padrão: esconder até a pessoa fazer o
          diagnóstico enterra a métrica que mais move gasto diário. */}
      {true ? (
        <Animated.View entering={FadeInDown.delay(45).duration(300)}>
          <Card faixa={passos.hoje >= passos.alvo ? colors.success : colors.info}>
            <View style={s.entre}>
              <Txt v="label">Passos de hoje</Txt>
              <Txt
                v="small"
                cor={passos.hoje >= passos.alvo ? colors.success : colors.textDim}
                bold
              >
                {passos.hoje.toLocaleString('pt-BR')} / {passos.alvo.toLocaleString('pt-BR')}
              </Txt>
            </View>
            <Barra
              valor={passos.alvo ? passos.hoje / passos.alvo : 0}
              cor={passos.hoje >= passos.alvo ? colors.success : colors.info}
            />
            <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
              {passos.mensagem}
            </Txt>

            <View style={s.passosBotoes}>
              {[2000, 5000, 8000, 12000].map((v) => (
                <Press
                  key={v}
                  onPress={async () => {
                    await registrarPassos(v);
                    buzz.ok();
                    recarregar();
                  }}
                  style={s.passoBtn}
                  scale={0.94}
                >
                  <Txt v="small" size={12} cor={colors.textDim} bold>
                    {v / 1000}k
                  </Txt>
                </Press>
              ))}
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Fase do plano ── */}
      {fase && fase.fase !== 'acumulo' ? (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Card faixa={colors.info} padding={spacing.md}>
            <View style={s.entre}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="label" cor={colors.info}>
                  Semana {semanaPlano} · {LABEL_FASE[fase.fase]}
                </Txt>
                <Txt v="small">{fase.nota}</Txt>
              </View>
              <Ajuda conteudo={AJUDA.rir} />
            </View>
          </Card>
        </Animated.View>
      ) : null}

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

      {/* ── Água ── */}
      <Animated.View entering={FadeInDown.delay(210).duration(300)} style={{ gap: spacing.md }}>
        <View style={s.entre}>
          <Txt v="label">Hidratação</Txt>
          <Press onPress={() => router.push('/agua')} haptic="leve">
            <Txt v="small" cor={colors.info} bold>
              Ver tudo
            </Txt>
          </Press>
        </View>
        <Card>
          <View style={s.entre}>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={s.entre}>
                <Txt v="h2" cor={colors.info}>
                  {(agua / 1000).toFixed(1).replace('.', ',')} L
                  <Txt v="small" cor={colors.textDim}>
                    {' '}
                    de {(r.metaAguaMl / 1000).toFixed(1).replace('.', ',')}
                  </Txt>
                </Txt>
                <Txt v="small" cor={statusAgua.cor} bold>
                  {statusAgua.texto}
                </Txt>
              </View>
              <Barra valor={pct(agua, r.metaAguaMl)} cor={colors.info} altura={8} />
            </View>
          </View>

          <View style={s.copos}>
            {[200, 300, 500].map((ml) => (
              <Press
                key={ml}
                onPress={async () => {
                  await registrarAgua(ml);
                  buzz.medio();
                  recarregar();
                }}
                style={s.copoRapido}
                scale={0.92}
                haptic={false}
              >
                <Ionicons name="add" size={14} color={colors.info} />
                <Txt v="small" cor={colors.info} bold>
                  {ml} ml
                </Txt>
              </Press>
            ))}
          </View>
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
          icone="checkbox-outline"
          label="Rotina do dia"
          onPress={() => router.push('/rotina')}
        />
        <Atalho icone="body-outline" label="Mobilidade" onPress={() => router.push('/mobilidade')} />
        <Atalho icone="water-outline" label="Água" onPress={() => router.push('/agua')} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(320).duration(300)} style={s.atalhos}>
        <Atalho
          icone="analytics-outline"
          label="Bioimpedância"
          onPress={() => router.push('/bioimpedancia')}
        />
        <Atalho icone="cart-outline" label="Compras" onPress={() => router.push('/compras')} />
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
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  diaCol: { alignItems: 'center', gap: 5 },
  diaBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  passosBotoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  passoBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  diaFeito: {
    backgroundColor: colors.success,
    borderColor: colors.success,
    ...shadow.glow(colors.success),
  },
  copos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  copoRapido: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
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
