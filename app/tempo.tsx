import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Button, Card, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  lerTempoPorDia,
  resumo,
  salvarLembretes,
  salvarTempoPorDia,
} from '@/features/perfil/api';
import { agendaSemanal } from '@/features/treino/agenda';
import { exerciciosDoDia } from '@/features/treino/api';
import { ajustarParaCaber, emMinutos, estimarDuracao, PADROES_TEMPO } from '@/features/treino/duracao';
import {
  listarAgendados,
  montarLembretes,
  pedirPermissao,
  reagendarLembretes,
  suportaAgendamento,
  temPermissao,
} from '@/features/notificacoes/api';
import { planoDeLembretes } from '@/features/agua/api';
import { buzz } from '@/shared/utils/haptics';

const NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const OPCOES = [40, 50, 60, 75, 90, 105, 120, 0];

/**
 * Tempo disponível e lembretes.
 *
 * Duas coisas que parecem administrativas e decidem se o treino acontece: se
 * ele cabe no seu dia, e se você lembra dele.
 */
export default function Tempo() {
  const [minutos, setMinutos] = useState<number[]>([90, 60, 60, 60, 60, 60, 90]);
  const [lembretes, setLembretes] = useState(false);
  const [medida, setMedida] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [agendados, setAgendados] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, semana] = await Promise.all([resumo(), agendaSemanal()]);

    // Estima cada dia de treino com os exercícios reais.
    const estimativas: Record<number, number> = {};
    for (const d of semana) {
      if (d.routineDayId) {
        const exs = await exerciciosDoDia(d.routineDayId);
        estimativas[d.diaSemana] = estimarDuracao(exs).totalSeg;
      }
    }
    return { r, semana, estimativas };
  }, []);

  useEffect(() => {
    if (!dados?.r) return;
    setMinutos(lerTempoPorDia(dados.r.perfil.minutos_por_dia));
    setLembretes(!!dados.r.perfil.lembretes_ativos);
    setMedida(dados.r.perfil.lembrete_medida !== 0);
    void temPermissao().then(setPermitido);
    void listarAgendados().then(setAgendados);
  }, [dados]);

  async function salvar() {
    if (!dados?.r) return;
    setSalvando(true);
    try {
      await salvarTempoPorDia(minutos);
      await salvarLembretes(lembretes, medida);

      if (lembretes) {
        const ok = permitido || (await pedirPermissao());
        setPermitido(ok);
        if (ok) {
          const agua = planoDeLembretes(dados.r.metaAguaMl).map((l) => l.hora);
          await reagendarLembretes(
            montarLembretes({
              horariosAgua: agua,
              diasDeTreino: dados.semana.filter((d) => d.tipo === 'treino').map((d) => d.diaSemana),
              horaTreino: dados.r.perfil.hora_treino,
              horaDormir: dados.r.perfil.hora_dorme,
              pesarSemanalmente: medida,
            })
          );
        }
      } else {
        await reagendarLembretes([]);
      }
      setAgendados(await listarAgendados());
      buzz.ok();
      recarregar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela titulo="Tempo e lembretes" subtitulo="O treino tem que caber no seu dia" paddingBottom={140}>
      {/* ── Perfis rápidos ── */}
      <Animated.View entering={FadeInDown.duration(280)} style={{ gap: spacing.sm }}>
        <Txt v="label">Quanto tempo você tem</Txt>
        {PADROES_TEMPO.filter((p) => p.chave !== 'personalizado').map((p) => (
          <Card
            key={p.chave}
            padding={spacing.md}
            onPress={() => {
              setMinutos([p.fimDeSemana, p.semana, p.semana, p.semana, p.semana, p.semana, p.fimDeSemana]);
              buzz.selecao();
            }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Txt size={22}>{p.emoji}</Txt>
              <View style={{ flex: 1 }}>
                <Txt v="h3" size={15}>
                  {p.label}
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {p.desc}
                </Txt>
              </View>
            </View>
          </Card>
        ))}
      </Animated.View>

      {/* ── Dia a dia ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: spacing.sm }}>
        <Txt v="label">Ajuste fino por dia</Txt>
        <Txt v="small" size={11} cor={colors.textFaint}>
          Sábado e domingo quase sempre são diferentes — e é onde cabe o treino que não coube na
          semana.
        </Txt>

        {minutos.map((m, i) => {
          const est = dados?.estimativas[i];
          const cabe = !est || !m || est <= m * 60;
          return (
            <Card key={i} padding={spacing.md}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Txt v="h3" size={13} cor={colors.textDim} style={{ width: 34 }}>
                  {NOMES[i]}
                </Txt>
                <View style={{ flex: 1, flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                  {OPCOES.map((o) => (
                    <Press
                      key={o}
                      onPress={() => {
                        const novo = [...minutos];
                        novo[i] = o;
                        setMinutos(novo);
                        buzz.selecao();
                      }}
                      style={[s.opcao, m === o && s.opcaoAtiva]}
                      haptic={false}
                    >
                      <Txt v="small" size={11} cor={m === o ? colors.primary : colors.textFaint} bold>
                        {o === 0 ? '—' : o}
                      </Txt>
                    </Press>
                  ))}
                </View>
              </View>

              {est ? (
                <View style={s.est}>
                  <Ionicons
                    name={cabe ? 'checkmark-circle' : 'alert-circle'}
                    size={13}
                    color={cabe ? colors.success : colors.warn}
                  />
                  <Txt v="small" size={11} cor={cabe ? colors.success : colors.warn}>
                    Treino deste dia leva ~{emMinutos(est)} min
                    {cabe ? '' : ` — não cabe em ${m}`}
                  </Txt>
                </View>
              ) : null}
            </Card>
          );
        })}
      </Animated.View>

      {/* ── O que fazer quando não cabe ── */}
      <AjustesDoDia minutos={minutos} />

      {/* ── Lembretes ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(280)}>
        <Card faixa={lembretes ? colors.info : colors.textFaint}>
          <Press
            onPress={() => {
              setLembretes((v) => !v);
              buzz.selecao();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <Ionicons
              name={lembretes ? 'notifications' : 'notifications-off-outline'}
              size={22}
              color={lembretes ? colors.info : colors.textFaint}
            />
            <View style={{ flex: 1 }}>
              <Txt v="h3" size={15}>
                Lembretes no celular
              </Txt>
              <Txt v="small" size={11} cor={colors.textFaint}>
                Água nos horários do plano, treino 45 min antes, sono meia hora antes
              </Txt>
            </View>
            <View style={[s.switch, lembretes && s.switchOn]}>
              <View style={[s.bolinha, lembretes && s.bolinhaOn]} />
            </View>
          </Press>

          {lembretes ? (
            <Press
              onPress={() => {
                setMedida((v) => !v);
                buzz.selecao();
              }}
              style={s.subItem}
            >
              <Ionicons
                name={medida ? 'checkbox' : 'square-outline'}
                size={18}
                color={medida ? colors.info : colors.textFaint}
              />
              <Txt v="small" size={12} style={{ flex: 1 }}>
                Medir cintura e peso toda segunda, 7h
              </Txt>
            </Press>
          ) : null}

          {/* A verdade sobre onde isso funciona. Agendar algo que nunca vai
              disparar é pior que não oferecer. */}
          <View style={s.aviso}>
            <Ionicons
              name={suportaAgendamento ? 'phone-portrait-outline' : 'globe-outline'}
              size={15}
              color={suportaAgendamento ? colors.success : colors.warn}
            />
            <Txt
              v="small"
              size={11}
              cor={suportaAgendamento ? colors.success : colors.warn}
              style={{ flex: 1 }}
            >
              {suportaAgendamento
                ? `Aplicativo instalado: os lembretes disparam com o app fechado. ${agendados > 0 ? `${agendados} agendados agora.` : ''}`
                : 'Você está no navegador. Aqui o alarme de descanso funciona com o app aberto, mas lembrete de horário não — o navegador não agenda nada. Para isso, use o aplicativo instalado.'}
            </Txt>
          </View>
        </Card>
      </Animated.View>

      <Button titulo="Salvar" full tam="lg" carregando={salvando} onPress={salvar} />
    </Tela>
  );
}

/** Mostra os cortes propostos para o dia mais apertado da semana. */
function AjustesDoDia({ minutos }: { minutos: number[] }) {
  const { dados } = useDados(async () => {
    const semana = await agendaSemanal();
    for (const d of semana) {
      if (!d.routineDayId) continue;
      const exs = await exerciciosDoDia(d.routineDayId);
      const limite = minutos[d.diaSemana];
      if (!limite) continue;
      const plano = ajustarParaCaber(exs, limite);
      if (!plano.cabe) return { dia: d, plano };
    }
    return null;
  }, [minutos.join(',')]);

  if (!dados) return null;
  const { dia, plano } = dados;

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card faixa={colors.warn}>
        <Txt v="label" cor={colors.warn}>
          {dia.rotuloTreino} não cabe em {Math.round(plano.disponivel / 60)} min
        </Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 2 }}>
          Estimado em {emMinutos(plano.estimado)} min. Como fazer caber, do corte que menos custa
          para o que mais custa:
        </Txt>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {plano.ajustes.map((a) => (
            <View key={a.titulo} style={s.ajuste}>
              <Ionicons
                name={
                  a.tipo === 'superserie'
                    ? 'git-merge-outline'
                    : a.tipo === 'descanso'
                      ? 'timer-outline'
                      : a.tipo === 'cortar'
                        ? 'cut-outline'
                        : 'alert-circle'
                }
                size={15}
                color={a.tipo === 'impossivel' ? colors.danger : colors.warn}
              />
              <View style={{ flex: 1 }}>
                <Txt v="small" size={12} bold>
                  {a.titulo}
                  {a.economiaSeg > 0 ? (
                    <Txt v="small" size={11} cor={colors.success}>
                      {'  '}−{emMinutos(a.economiaSeg)} min
                    </Txt>
                  ) : null}
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {a.descricao}
                </Txt>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: spacing.md, gap: 4 }}>
          <Barra
            valor={Math.min(1, plano.finalSeg / plano.disponivel)}
            cor={plano.finalSeg <= plano.disponivel ? colors.success : colors.danger}
          />
          <Txt v="small" size={11} cor={colors.textFaint}>
            Com os ajustes: ~{emMinutos(plano.finalSeg)} min
          </Txt>
        </View>
      </Card>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  opcao: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
  },
  opcaoAtiva: { backgroundColor: colors.primarySoft },
  est: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceHigh,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.info },
  bolinha: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textFaint },
  bolinhaOn: { backgroundColor: '#FFFFFF', alignSelf: 'flex-end' },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aviso: {
    flexDirection: 'row',
    gap: 6,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  ajuste: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
