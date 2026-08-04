import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Card, Chip, Empty, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { diasComTempo, estatisticas, historicoSessoes } from '@/features/treino/api';
import { dataAmigavel, duracaoDe } from '@/shared/utils/sessao';
import { duracao, volume } from '@/shared/utils/format';

/**
 * Treino.
 *
 * ── O que esta tela responde, nesta ordem ────────────────────────────────
 *
 *  1. O que eu treino hoje?
 *  2. Em que dia cai cada treino?
 *  3. Quais são os meus treinos?
 *
 * A versão anterior respondia na ordem inversa: seis cartões de navegação
 * ocupavam a tela inteira e os treinos — o motivo de a aba existir — ficavam
 * abaixo da dobra. Cada recurso novo virava mais um cartão, porque não havia
 * regra de onde as coisas moram.
 *
 * A regra agora é: **a aba mostra o conteúdo dela; o resto é uma lista no fim.**
 * Lista compacta em vez de grade de cartões não é gosto — cartão grande diz
 * "isto é importante", e seis coisas importantes ao mesmo tempo é o mesmo que
 * nenhuma.
 */

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Destinos secundários. Cada um aparece em UM lugar do app — aqui. */
const MAIS = [
  {
    rota: '/programa',
    icone: 'analytics-outline',
    titulo: 'Objetivo e volume',
    sub: 'Para que serve este treino e se o volume por músculo fecha',
  },
  {
    rota: '/cardio',
    icone: 'pulse-outline',
    titulo: 'Cardio',
    sub: 'Zona 2, HIIT e como encaixar sem atrapalhar a força',
  },
  {
    rota: '/mobilidade',
    icone: 'body-outline',
    titulo: 'Mobilidade',
    sub: 'Aquecimento e alongamento com vídeo',
  },
  {
    rota: '/diagnostico-treino',
    icone: 'medkit-outline',
    titulo: 'O que travou',
    sub: 'Exercícios parados e cópia dos seus dados',
  },
  {
    rota: '/exercicios',
    icone: 'search-outline',
    titulo: 'Buscar exercício',
    sub: 'Catálogo com execução em vídeo',
  },
  {
    rota: '/refazer-treino',
    icone: 'sparkles-outline',
    titulo: 'Refazer meu treino',
    sub: 'Seis perguntas e o app monta tudo de novo — nada é apagado',
  },
  {
    rota: '/agenda',
    icone: 'calendar-outline',
    titulo: 'Agenda da semana',
    sub: 'Trocar o dia de cada treino',
  },
] as const;

export default function Treino() {
  const router = useRouter();
  const [aba, setAba] = useState<'treinos' | 'historico'>('treinos');

  const { dados, recarregar } = useDados(async () => {
    const [dias, hist, stats] = await Promise.all([
      diasComTempo(),
      historicoSessoes(30),
      estatisticas(),
    ]);
    return { dias, hist, stats };
  }, []);

  const hoje = new Date().getDay();
  const dias = dados?.dias ?? [];
  const doDia = dias.find((d) => d.dia_semana === hoje) ?? null;

  return (
    <Screen
      titulo="Treino"
      subtitulo={
        dados
          ? `${dias.length} treino${dias.length === 1 ? '' : 's'} · ${dados.stats.treinos} sessões · ${volume(dados.stats.volume)}`
          : undefined
      }
      onRefresh={recarregar}
    >
      <View style={s.abas}>
        <Chip label="Meus treinos" ativo={aba === 'treinos'} onPress={() => setAba('treinos')} />
        <Chip label="Histórico" ativo={aba === 'historico'} onPress={() => setAba('historico')} />
      </View>

      {aba === 'treinos' ? (
        <>
          {/* ── A semana ─────────────────────────────────────────────────
              Vem antes da lista porque responde o que a lista não responde:
              em que dia cada treino cai, e o que é hoje. */}
          {dias.length > 0 && (
            <Animated.View entering={FadeInDown.duration(280)}>
              <Txt v="label" style={{ marginBottom: spacing.sm }}>
                Sua semana
              </Txt>
              <Card padding={spacing.md}>
                <View style={s.semana}>
                  {LETRAS.map((letra, i) => {
                    const d = dias.find((x) => x.dia_semana === i);
                    const ehHoje = i === hoje;
                    return (
                      <Press
                        key={i}
                        onPress={() => d && router.push(`/dia/${d.id}`)}
                        style={s.colDia}
                        scale={d ? 0.94 : 1}
                      >
                        <Txt
                          v="small"
                          size={10}
                          cor={ehHoje ? colors.primary : colors.textFaint}
                          bold={ehHoje}
                        >
                          {letra}
                        </Txt>
                        <View
                          style={[
                            s.marcaDia,
                            { backgroundColor: d ? (d.cor ?? colors.primary) : colors.surfaceAlt },
                            ehHoje && s.marcaHoje,
                          ]}
                        >
                          <Txt v="small" size={12} bold cor={d ? '#0A0B0F' : colors.textFaint}>
                            {d ? letraDoTreino(d.nome) : '·'}
                          </Txt>
                        </View>
                      </Press>
                    );
                  })}
                </View>
                <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
                  {doDia
                    ? `Hoje é ${NOMES[hoje]}: ${doDia.nome}.`
                    : `Hoje é ${NOMES[hoje]} — descanso. É dormindo e descansando que o músculo do treino anterior é construído.`}
                </Txt>
              </Card>
            </Animated.View>
          )}

          {/* ── Os treinos ──────────────────────────────────────────────── */}
          {dias.length ? (
            <>
              <Txt v="label" style={{ marginTop: spacing.lg }}>
                Meus treinos
              </Txt>
              {dias.map((d, i) => (
                <Animated.View key={d.id} entering={FadeInDown.delay(i * 40).duration(280)}>
                  <Card
                    faixa={d.cor ?? colors.primary}
                    onPress={() => router.push(`/dia/${d.id}`)}
                    padding={spacing.md}
                    destaque={d.dia_semana === hoje}
                  >
                    <View style={s.entre}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.linhaBadge}>
                          <View
                            style={[
                              s.badgeDia,
                              d.dia_semana === hoje && { backgroundColor: colors.primary },
                            ]}
                          >
                            <Txt
                              v="small"
                              size={10}
                              bold
                              cor={d.dia_semana === hoje ? '#1A0800' : colors.textDim}
                            >
                              {d.dia_semana === null ? 'SEM DIA' : CURTO[d.dia_semana]}
                            </Txt>
                          </View>
                          {d.dia_semana === hoje && (
                            <Txt v="small" size={10} bold cor={colors.primary}>
                              HOJE
                            </Txt>
                          )}
                        </View>

                        <Txt v="h3">{d.nome}</Txt>

                        <Txt v="small" size={11} cor={colors.textFaint}>
                          {d.qtd_exercicios} exercício{d.qtd_exercicios === 1 ? '' : 's'} · ~
                          {d.minutos} min
                          {d.minutosCardio > 0 ? ` + ${d.minutosCardio} min de cardio` : ''}
                          {d.ultima_vez ? ` · ${dataAmigavel(d.ultima_vez)}` : ' · nunca treinado'}
                        </Txt>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </>
          ) : (
            <Empty
              icone="barbell-outline"
              titulo="Nenhum treino montado"
              texto="Refaça o questionário no Perfil: o app monta a divisão, os exercícios e o dia de cada sessão de uma vez."
            />
          )}

          {/* ── Mais ─────────────────────────────────────────────────────
              Lista, não grade de cartões: isto é navegação secundária e
              precisa parecer secundária. */}
          <Txt v="label" style={{ marginTop: spacing.xl }}>
            Mais
          </Txt>
          <Card padding={0}>
            {MAIS.map((m, i) => (
              <Press
                key={m.rota}
                onPress={() => router.push(m.rota as never)}
                style={[s.linhaMais, i > 0 && s.comBorda]}
              >
                <Ionicons name={m.icone as never} size={20} color={colors.textDim} />
                <View style={{ flex: 1 }}>
                  <Txt v="body" size={14}>
                    {m.titulo}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {m.sub}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Press>
            ))}
          </Card>
        </>
      ) : dados?.hist.length ? (
        dados.hist.map((h, i) => (
          <Animated.View key={h.id} entering={FadeInDown.delay(i * 35).duration(260)}>
            <Card padding={spacing.md}>
              <View style={s.entre}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="body" size={14}>
                    {h.nome}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
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
    </Screen>
  );
}

/** "A — Superior" vira "A". Sem letra, cai na inicial do nome. */
function letraDoTreino(nome: string): string {
  const m = nome.match(/^([A-F])\s*[—-]/);
  return m ? m[1] : (nome.trim()[0]?.toUpperCase() ?? '?');
}

const s = StyleSheet.create({
  abas: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  semana: { flexDirection: 'row', gap: 6 },
  colDia: { flex: 1, alignItems: 'center', gap: 6 },
  marcaDia: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaHoje: { borderWidth: 2, borderColor: colors.text },

  linhaBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeDia: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.surfaceHigh,
  },

  linhaMais: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  comBorda: { borderTopWidth: 1, borderTopColor: colors.border },

  prTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
