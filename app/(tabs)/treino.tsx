import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, Empty, Input, Press, Screen, Sheet, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  criarDia,
  criarRotina,
  estatisticas,
  historicoSessoes,
  listarDias,
} from '@/features/treino/api';
import { dataAmigavel, duracaoDe } from '@/shared/utils/sessao';
import { duracao, num, volume } from '@/shared/utils/format';

const CORES_DIA = [
  colors.primary,
  colors.info,
  colors.success,
  colors.xp,
  colors.warn,
  colors.danger,
];

export default function Treino() {
  const router = useRouter();
  const [aba, setAba] = useState<'rotinas' | 'historico'>('rotinas');
  const [criando, setCriando] = useState(false);
  const [nomeDia, setNomeDia] = useState('');
  const [corDia, setCorDia] = useState<string>(colors.primary);

  const { dados, recarregar } = useDados(async () => {
    const [dias, hist, stats] = await Promise.all([
      listarDias(),
      historicoSessoes(30),
      estatisticas(),
    ]);
    return { dias, hist, stats };
  }, []);

  async function salvarDia() {
    if (nomeDia.trim().length < 2) return;
    // Sem rotina ainda: cria uma "Minha rotina" para pendurar o dia.
    let routineId = dados?.dias[0]?.routine_id;
    if (!routineId) routineId = await criarRotina('Minha rotina');
    const id = await criarDia(routineId, nomeDia.trim(), corDia);
    setCriando(false);
    setNomeDia('');
    await recarregar();
    router.push(`/dia/${id}`);
  }

  return (
    <Screen
      titulo="Treino"
      subtitulo={
        dados
          ? `${dados.stats.treinos} treinos · ${volume(dados.stats.volume)} levantados`
          : undefined
      }
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.push('/exercicios')} style={s.iconeBtn} scale={0.92}>
          <Ionicons name="search" size={19} color={colors.textDim} />
        </Press>
      }
    >
      <View style={s.abas}>
        <Chip label="Minhas divisões" ativo={aba === 'rotinas'} onPress={() => setAba('rotinas')} />
        <Chip label="Histórico" ativo={aba === 'historico'} onPress={() => setAba('historico')} />
      </View>

      {aba === 'rotinas' ? (
        <>
          {/* A pergunta que a lista de dias não responde: para que serve tudo
              isto e por quanto tempo eu fico nele. */}
          <Card faixa={colors.primary} onPress={() => router.push('/programa')} padding={spacing.md}>
            <View style={s.entre}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="h3" size={15}>
                  Objetivo e plano do bloco
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  Para que serve este treino, quantas semanas dura e se o volume por músculo fecha
                </Txt>
              </View>
              <Ionicons name="analytics-outline" size={22} color={colors.primary} />
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Card
              onPress={() => router.push('/diagnostico')}
              padding={spacing.md}
              style={{ flex: 1 }}
            >
              <Ionicons name="clipboard-outline" size={22} color={colors.warn} />
              <Txt v="h3" size={14} style={{ marginTop: 6 }}>
                Ajustar o plano
              </Txt>
              <Txt v="small" size={10} cor={colors.textFaint}>
                O que mais te incomoda hoje
              </Txt>
            </Card>
            <Card onPress={() => router.push('/cardio')} padding={spacing.md} style={{ flex: 1 }}>
              <Ionicons name="pulse-outline" size={22} color={colors.info} />
              <Txt v="h3" size={14} style={{ marginTop: 6 }}>
                Cardio
              </Txt>
              <Txt v="small" size={10} cor={colors.textFaint}>
                Zona 2, HIIT e sprints
              </Txt>
            </Card>
          </View>

          {dados?.dias.length ? (
            dados.dias.map((d, i) => (
              <Animated.View key={d.id} entering={FadeInDown.delay(i * 45).duration(280)}>
                <Card faixa={d.cor ?? colors.primary} onPress={() => router.push(`/dia/${d.id}`)}>
                  <View style={s.entre}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt v="label" cor={colors.textFaint} size={10}>
                        {d.rotina}
                      </Txt>
                      <Txt v="h2">{d.nome}</Txt>
                      <Txt v="small">
                        {d.qtd_exercicios} exercício{d.qtd_exercicios === 1 ? '' : 's'}
                        {d.ultima_vez ? ` · ${dataAmigavel(d.ultima_vez)}` : ' · nunca treinado'}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                  </View>
                </Card>
              </Animated.View>
            ))
          ) : (
            <Empty
              icone="barbell-outline"
              titulo="Sem divisões de treino"
              texto="Crie um dia de treino (Peito e tríceps, Perna completa…) e monte a lista de exercícios."
            />
          )}

          <Button
            titulo="Criar dia de treino"
            icone="add"
            variante="secundario"
            full
            onPress={() => setCriando(true)}
          />
        </>
      ) : (
        <>
          {dados?.hist.length ? (
            dados.hist.map((h, i) => (
              <Animated.View key={h.id} entering={FadeInDown.delay(i * 35).duration(260)}>
                <Card padding={spacing.md}>
                  <View style={s.entre}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Txt v="h3">{h.nome}</Txt>
                      <Txt v="small">
                        {dataAmigavel(h.iniciado_em)} ·{' '}
                        {duracao(duracaoDe(h.iniciado_em, h.finalizado_em))} · {h.qtd_series} séries
                      </Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Txt v="h3" cor={colors.primary}>
                        {volume(h.volume_total_kg)}
                      </Txt>
                      {h.qtd_prs > 0 ? (
                        <View style={s.prTag}>
                          <Ionicons name="trophy" size={10} color={colors.warn} />
                          <Txt v="small" cor={colors.warn} size={10}>
                            {h.qtd_prs} PR
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Animated.View>
            ))
          ) : (
            <Empty
              icone="time-outline"
              titulo="Nenhum treino registrado"
              texto="Quando você concluir um treino, ele aparece aqui com volume, duração e recordes."
            />
          )}
        </>
      )}

      <Sheet aberto={criando} onFechar={() => setCriando(false)} titulo="Novo dia de treino" altura={0.6}>
        <View style={{ gap: spacing.lg }}>
          <Input
            rotulo="Nome"
            placeholder="A — Peito e tríceps"
            value={nomeDia}
            onChangeText={setNomeDia}
            autoFocus
            maxLength={40}
          />
          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Cor</Txt>
            <View style={s.cores}>
              {CORES_DIA.map((c) => (
                <Press
                  key={c}
                  onPress={() => setCorDia(c)}
                  haptic="selecao"
                  scale={0.88}
                  style={[
                    s.cor,
                    { backgroundColor: c },
                    corDia === c && { borderWidth: 3, borderColor: colors.text },
                  ]}
                />
              ))}
            </View>
          </View>
          <Button
            titulo="Criar e adicionar exercícios"
            full
            onPress={salvarDia}
            desabilitado={nomeDia.trim().length < 2}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  abas: { flexDirection: 'row', gap: spacing.sm },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
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
  prTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.warnSoft,
  },
  cores: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  cor: { width: 42, height: 42, borderRadius: 21 },
});
