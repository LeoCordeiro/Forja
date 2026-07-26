import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Anel, Barra, Button, Card, Chip, Press, Sheet, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { aderencia, checklistDoDia, marcarManual, registrarSono, sonoRecente } from '@/features/rotina/api';
import { resumo } from '@/features/perfil/api';
import { planoDoDia, type HorarioTreino } from '@/features/dieta/timing';
import { getConfigDieta } from '@/features/dieta/preferencias';
import { nomeRefeicao, num, pct } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

/**
 * Rotina do dia.
 *
 * A tela de constância: tudo que sustenta resultado num lugar só. Os itens que
 * o app consegue verificar sozinho se marcam sozinhos — pedir marcação manual
 * do que o sistema já sabe é atrito, e atrito é o que faz largar.
 */
export default function Rotina() {
  const router = useRouter();
  const [registrandoSono, setRegistrandoSono] = useState(false);
  const [horasSono, setHorasSono] = useState(7);

  const { dados, recarregar } = useDados(async () => {
    const r = await resumo();
    const meta = r?.metaAguaMl ?? 2500;
    const [itens, ader, sono, cfg] = await Promise.all([
      checklistDoDia(undefined, meta),
      aderencia(7, meta),
      sonoRecente(7),
      getConfigDieta(),
    ]);
    return { r, itens, ader, sono, cfg };
  }, []);

  if (!dados?.r) return <Tela titulo="Carregando…">{null}</Tela>;
  const { r, itens, ader, sono, cfg } = dados;

  const feitos = itens.filter((i) => i.concluido).length;
  const horario = (r.perfil.horario_treino ?? 'manha') as HorarioTreino;
  const refeicoes = planoDoDia(horario, cfg.refeicoes_por_dia ?? 5, r.perfil.hora_acorda ?? '06:30');
  const mediaSono = sono.length ? sono.reduce((a, s) => a + s.horas, 0) / sono.length : 0;

  return (
    <Tela titulo="Rotina de hoje" subtitulo="O que sustenta o resultado" onRefresh={recarregar}>
      {/* ── Progresso do dia ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card>
          <View style={s.topo}>
            <Anel
              valor={pct(feitos, itens.length)}
              tamanho={104}
              cor={feitos === itens.length ? colors.success : colors.primary}
              centro={`${feitos}`}
              legenda={`de ${itens.length}`}
            />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Txt v="h3">
                {feitos === itens.length
                  ? 'Dia completo'
                  : feitos >= itens.length * 0.7
                    ? 'Quase lá'
                    : 'Dia em andamento'}
              </Txt>
              <View style={{ gap: 4 }}>
                <View style={s.entre}>
                  <Txt v="small" cor={colors.textDim}>
                    Constância (7 dias)
                  </Txt>
                  <Txt v="small" bold cor={ader >= 70 ? colors.success : colors.warn}>
                    {ader}%
                  </Txt>
                </View>
                <Barra valor={ader / 100} cor={ader >= 70 ? colors.success : colors.warn} altura={6} />
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Checklist ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.sm }}>
        <Txt v="label">Checklist</Txt>
        {itens.map((it) => (
          <Card key={it.chave} padding={spacing.md}>
            <View style={s.item}>
              <Press
                onPress={async () => {
                  if (it.automatico && it.chave !== 'sono') {
                    if (it.rota) router.push(it.rota as Parameters<typeof router.push>[0]);
                    return;
                  }
                  if (it.chave === 'sono') return setRegistrandoSono(true);
                  await marcarManual(it.chave);
                  buzz.leve();
                  recarregar();
                }}
                haptic={false}
                style={s.itemToque}
              >
                <View style={[s.check, it.concluido && s.checkOn]}>
                  {it.concluido ? <Ionicons name="checkmark" size={16} color="#00251A" /> : null}
                </View>
                <Txt size={19}>{it.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt
                    v="h3"
                    size={15}
                    cor={it.concluido ? colors.textFaint : colors.text}
                    style={it.concluido ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {it.titulo}
                  </Txt>
                  {it.detalhe ? (
                    <Txt v="small" size={11} cor={colors.textFaint}>
                      {it.detalhe}
                    </Txt>
                  ) : null}
                </View>
                {it.horario ? (
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {it.horario}
                  </Txt>
                ) : null}
                {it.rota ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
              </Press>
            </View>
          </Card>
        ))}
      </Animated.View>

      {/* ── Refeições por horário de treino ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Suas refeições de hoje</Txt>
        <Txt v="small" cor={colors.textFaint}>
          Os horários abaixo consideram que você treina {LABEL_CURTO[horario]}.
        </Txt>
        {refeicoes.map((ref) => (
          <Card
            key={ref.tipo}
            padding={spacing.md}
            faixa={
              ref.papel === 'pre_treino'
                ? colors.warn
                : ref.papel === 'pos_treino'
                  ? colors.success
                  : undefined
            }
          >
            <View style={s.entre}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt v="h3" size={15}>
                    {nomeRefeicao(ref.tipo)}
                  </Txt>
                  {ref.papel === 'pre_treino' ? (
                    <View style={[s.tag, { backgroundColor: colors.warnSoft }]}>
                      <Txt v="small" size={9} cor={colors.warn} bold>
                        PRÉ-TREINO
                      </Txt>
                    </View>
                  ) : ref.papel === 'pos_treino' ? (
                    <View style={[s.tag, { backgroundColor: colors.successSoft }]}>
                      <Txt v="small" size={9} cor={colors.success} bold>
                        PÓS-TREINO
                      </Txt>
                    </View>
                  ) : null}
                </View>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {ref.hora} · cerca de {num(Math.round(r.meta.kcal * ref.fatiaKcal))} kcal
                </Txt>
              </View>
            </View>
            {ref.papel !== 'normal' ? (
              <Txt v="small" style={{ marginTop: 6 }}>
                {ref.orientacao}
              </Txt>
            ) : null}
          </Card>
        ))}
      </Animated.View>

      {/* ── Sono ── */}
      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Sono</Txt>
        <Card onPress={() => setRegistrandoSono(true)}>
          <View style={s.entre}>
            <View style={{ flex: 1 }}>
              <Txt v="h2">
                {mediaSono > 0 ? `${mediaSono.toFixed(1).replace('.', ',')} h` : '—'}
                <Txt v="small" cor={colors.textDim}>
                  {' '}
                  média de 7 dias
                </Txt>
              </Txt>
              <Txt v="small" cor={colors.textFaint}>
                É durante o sono que o músculo cresce. Abaixo de 7 h, força e recuperação caem.
              </Txt>
            </View>
            <Ionicons name="add-circle" size={26} color={colors.primary} />
          </View>
        </Card>
      </Animated.View>

      <Button
        titulo="Sessão de mobilidade"
        icone="body-outline"
        variante="secundario"
        full
        onPress={() => router.push('/mobilidade')}
      />

      <Sheet
        aberto={registrandoSono}
        onFechar={() => setRegistrandoSono(false)}
        titulo="Quantas horas você dormiu?"
        altura={0.55}
      >
        <View style={{ gap: spacing.lg }}>
          <View style={s.horasGrid}>
            {[4, 5, 6, 7, 8, 9, 10].map((h) => (
              <Chip
                key={h}
                label={`${h} h`}
                ativo={horasSono === h}
                onPress={() => setHorasSono(h)}
              />
            ))}
          </View>
          <Txt v="small" cor={colors.textFaint}>
            Sete a nove horas é a faixa em que a recuperação acontece. Dormir menos derruba força,
            aumenta fome e atrapalha a perda de gordura.
          </Txt>
          <Button
            titulo="Registrar"
            full
            tam="lg"
            onPress={async () => {
              await registrarSono(horasSono);
              buzz.ok();
              setRegistrandoSono(false);
              recarregar();
            }}
          />
        </View>
      </Sheet>
    </Tela>
  );
}

const LABEL_CURTO: Record<HorarioTreino, string> = {
  jejum: 'bem cedo, quase em jejum',
  manha: 'de manhã',
  almoco: 'no horário do almoço',
  tarde: 'no fim da tarde',
  noite: 'à noite',
};

const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center' },
  itemToque: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full },
  horasGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
