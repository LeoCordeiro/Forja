import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Ajuda, Anel, Barras, Button, Card, Empty, Input, Press, Tela, Sheet, Txt } from '@/shared/ui';
import { TituloComAjuda } from '@/shared/ui/Ajuda';
import { AJUDA } from '@/shared/ajudas';
import { useDados } from '@/shared/hooks/useDados';
import {
  ATALHOS,
  desfazer,
  diasNaMeta,
  historico,
  metaDiaria,
  planoDeLembretes,
  registrar,
  registrosDoDia,
  statusHidratacao,
  totalDoDia,
} from '@/features/agua/api';
import { definirMetaAgua, resumo } from '@/features/perfil/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { dataCurta } from '@/shared/utils/date';
import { num, pct } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

export default function Agua() {
  const router = useRouter();
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTexto, setMetaTexto] = useState('');
  const [abrindoPersonalizado, setAbrindoPersonalizado] = useState(false);
  const [personalizado, setPersonalizado] = useState('');

  const { dados, recarregar } = useDados(async () => {
    const [r, consumido, regs, hist] = await Promise.all([
      resumo(),
      totalDoDia(),
      registrosDoDia(),
      historico(14),
    ]);
    const meta = r?.metaAguaMl ?? 2500;
    const streak = await diasNaMeta(meta);
    return { r, consumido, regs, hist, meta, streak };
  }, []);

  async function beber(ml: number) {
    await registrar(ml);
    buzz.medio();
    await avaliarConquistas();
    recarregar();
  }

  if (!dados?.r) return <Tela
      ajuda={AJUDA.agua} titulo="Carregando…">{null}</Tela>;
  const { r, consumido, regs, hist, meta, streak } = dados;
  const status = statusHidratacao(consumido, meta);
  const restante = Math.max(0, meta - consumido);
  const lembretes = planoDeLembretes(meta);

  return (
    <Tela
      titulo="Hidratação"
      subtitulo={`Meta de ${(meta / 1000).toFixed(1).replace('.', ',')} L por dia`}
      onRefresh={recarregar}
    >
      {/* ── Anel do dia ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card>
          <View style={s.topo}>
            <Anel
              valor={pct(consumido, meta)}
              tamanho={130}
              espessura={12}
              cor={colors.info}
              centro={`${(consumido / 1000).toFixed(1).replace('.', ',')}`}
              legenda="litros"
            />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View style={[s.pill, { backgroundColor: `${status.cor}22` }]}>
                <Txt v="small" cor={status.cor} bold>
                  {status.texto}
                </Txt>
              </View>
              <Txt v="h2">
                {restante > 0 ? `${num(restante)} ml` : 'Meta batida'}
              </Txt>
              <Txt v="small" cor={colors.textFaint}>
                {restante > 0 ? 'ainda hoje' : `${num(consumido)} ml no total`}
              </Txt>
              {streak > 0 ? (
                <View style={s.streak}>
                  <Txt size={13}>💧</Txt>
                  <Txt v="small" cor={colors.info} bold>
                    {streak} {streak === 1 ? 'dia' : 'dias'} na meta
                  </Txt>
                </View>
              ) : null}
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Atalhos ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Registrar</Txt>
        <View style={s.atalhos}>
          {ATALHOS.map((a) => (
            <Press key={a.ml} onPress={() => beber(a.ml)} style={s.copo} scale={0.92} haptic={false}>
              <Txt size={26}>{a.emoji}</Txt>
              <Txt v="h3" size={15}>
                {a.ml >= 1000 ? '1 L' : `${a.ml} ml`}
              </Txt>
              <Txt v="small" size={10} cor={colors.textFaint}>
                {a.label}
              </Txt>
            </Press>
          ))}

          {/* Garrafa de 750, copo do trabalho, o que for. Sem isto, quem bebe
              600 ml registra "500" e a conta do dia sai sempre errada. */}
          <Press
            onPress={() => {
              setPersonalizado('');
              setAbrindoPersonalizado(true);
            }}
            style={[s.copo, s.copoOutro]}
            scale={0.92}
            haptic={false}
          >
            <Ionicons name="create-outline" size={24} color={colors.info} />
            <Txt v="h3" size={15} cor={colors.info}>
              Outro
            </Txt>
            <Txt v="small" size={10} cor={colors.textFaint}>
              Medida sua
            </Txt>
          </Press>
        </View>
      </Animated.View>

      {/* ── Plano do dia ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <TituloComAjuda titulo="Plano do dia" ajuda={AJUDA.agua} />
        <Card padding={0}>
          {lembretes.map((l, i) => {
            const cumprido = consumido >= l.acumulado;
            return (
              <View
                key={l.hora}
                style={[s.linha, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={[s.horaBox, cumprido && { backgroundColor: colors.successSoft }]}>
                  <Txt v="small" size={11} cor={cumprido ? colors.success : colors.textDim} bold>
                    {l.hora}
                  </Txt>
                </View>
                <Txt v="body" style={{ flex: 1 }} cor={cumprido ? colors.textFaint : colors.text}>
                  Beber {l.ml} ml
                </Txt>
                {cumprido ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                ) : (
                  <Txt v="small" cor={colors.textFaint}>
                    até {num(l.acumulado)} ml
                  </Txt>
                )}
              </View>
            );
          })}
        </Card>
        <Txt v="small" cor={colors.textFaint}>
          A distribuição concentra mais água na primeira metade do dia — beber tudo à noite
          atrapalha o sono e não hidrata melhor.
        </Txt>
      </Animated.View>

      {/* ── Histórico ── */}
      {hist.length > 1 ? (
        <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Últimos dias</Txt>
          <Card>
            <Barras
              dados={hist.map((h) => ({ x: dataCurta(h.dia), y: Math.round(h.ml / 100) / 10 }))}
              cor={colors.info}
              sufixo="L"
            />
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Registros de hoje ── */}
      {regs.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Hoje</Txt>
          <Card padding={0}>
            {regs.map((g, i) => (
              <Animated.View key={g.id} exiting={FadeOut.duration(160)}>
                <View style={[s.linha, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Ionicons name="water-outline" size={17} color={colors.info} />
                  <Txt v="body" style={{ flex: 1 }}>
                    {g.ml} ml
                  </Txt>
                  <Txt v="small" cor={colors.textFaint}>
                    {new Date(g.registrado_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Txt>
                  <Press
                    onPress={async () => {
                      await desfazer(g.id);
                      buzz.leve();
                      recarregar();
                    }}
                    style={{ padding: 4 }}
                    scale={0.85}
                  >
                    <Ionicons name="close" size={15} color={colors.textFaint} />
                  </Press>
                </View>
              </Animated.View>
            ))}
          </Card>
        </Animated.View>
      ) : (
        <Empty
          icone="water-outline"
          titulo="Nada registrado hoje"
          texto="Toque num dos copos acima assim que beber. O registro leva um toque."
        />
      )}

      <Button
        titulo="Ajustar meta"
        icone="options-outline"
        variante="secundario"
        full
        onPress={() => {
          setMetaTexto(String(meta));
          setEditandoMeta(true);
        }}
      />

      <Sheet
        aberto={editandoMeta}
        onFechar={() => setEditandoMeta(false)}
        titulo="Meta de água"
        altura={0.7}
        rolavel
      >
        <View style={{ gap: spacing.lg }}>
          <Card>
            <Txt v="label">Sugestão para você</Txt>
            <Txt v="h2" cor={colors.info}>
              {num(metaDiaria(r.pesoKg, true))} ml
            </Txt>
            <Txt v="small">
              35 ml por kg ({num(r.pesoKg, 1)} kg) mais a reposição de uma hora de treino.
            </Txt>
          </Card>

          <Input
            rotulo="Meta diária (ml)"
            grande
            sufixo="ml"
            value={metaTexto}
            onChangeText={setMetaTexto}
            keyboardType="number-pad"
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {[2000, 2500, 3000, 3500, 4000].map((v) => (
              <Press
                key={v}
                onPress={() => setMetaTexto(String(v))}
                style={[s.sugestao, metaTexto === String(v) && s.sugestaoAtiva]}
                haptic="selecao"
              >
                <Txt v="small" cor={metaTexto === String(v) ? colors.info : colors.textDim} bold>
                  {(v / 1000).toFixed(1).replace('.', ',')} L
                </Txt>
              </Press>
            ))}
          </View>

          <Button
            titulo="Salvar meta"
            full
            tam="lg"
            onPress={async () => {
              const n = parseInt(metaTexto, 10);
              if (n > 500 && n < 8000) {
                await definirMetaAgua(n);
                buzz.ok();
                setEditandoMeta(false);
                recarregar();
              }
            }}
          />
        </View>
      </Sheet>

      {/* ── Quantidade personalizada ── */}
      <Sheet
        aberto={abrindoPersonalizado}
        onFechar={() => setAbrindoPersonalizado(false)}
        titulo="Quanto você bebeu?"
        altura={0.62}
        rolavel
      >
        <View style={{ gap: spacing.lg }}>
          <Input
            rotulo="Quantidade"
            grande
            sufixo="ml"
            value={personalizado}
            onChangeText={setPersonalizado}
            keyboardType="number-pad"
            placeholder="750"
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {[150, 250, 400, 600, 750, 1500].map((v) => (
              <Press
                key={v}
                onPress={() => setPersonalizado(String(v))}
                style={[s.sugestao, personalizado === String(v) && s.sugestaoAtiva]}
                haptic="selecao"
              >
                <Txt v="small" cor={personalizado === String(v) ? colors.info : colors.textDim} bold>
                  {v} ml
                </Txt>
              </Press>
            ))}
          </View>

          <Txt v="small" cor={colors.textFaint}>
            Vale para garrafa, squeeze, chá e café. Refrigerante e álcool não contam —
            o álcool desidrata, e é justamente essa a conta que interessa aqui.
          </Txt>

          <Button
            titulo="Registrar"
            icone="water-outline"
            full
            tam="lg"
            desabilitado={!(parseInt(personalizado, 10) > 0)}
            onPress={async () => {
              const n = parseInt(personalizado, 10);
              // Teto de 3 L num gole só: acima disso é erro de digitação, e um
              // registro errado some do histórico só se a pessoa perceber.
              if (n > 0 && n <= 3000) {
                setAbrindoPersonalizado(false);
                await beber(n);
              }
            }}
          />
        </View>
      </Sheet>
    </Tela>
  );
}

const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Cinco atalhos não cabem lado a lado num celular: quebra em duas fileiras.
  atalhos: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  copo: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    gap: 3,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  copoOutro: {
    borderStyle: 'dashed',
    borderColor: colors.info,
    backgroundColor: colors.infoSoft,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  horaBox: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
  },
  sugestao: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sugestaoAtiva: { borderColor: colors.info, backgroundColor: colors.infoSoft },
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
