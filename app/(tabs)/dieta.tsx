import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import {
  Anel,
  Barra,
  Button,
  Card,
  Chip,
  Empty,
  Input,
  Press,
  Screen,
  Sheet,
  Txt,
} from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  cardapioDoDia,
  gerarCardapioSemanal,
  listarAlimentos,
  macrosDoDia,
  planoAtivo,
  refeicoesDoDia,
  registrarAlimento,
  registrarReceita,
  removerItem,
  listarReceitas,
  type ReceitaComMacros,
} from '@/features/dieta/api';
import { resumo } from '@/features/perfil/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import type { Food, TipoRefeicao } from '@/db/types';
import { kcal, nomeRefeicao, num, pct, ORDEM_REFEICOES } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

export default function Dieta() {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState<TipoRefeicao | null>(null);
  const [gerando, setGerando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const diaSemana = new Date().getDay();
    const [r, macros, refeicoes, cardapio, plano] = await Promise.all([
      resumo(),
      macrosDoDia(),
      refeicoesDoDia(),
      cardapioDoDia(diaSemana),
      planoAtivo(),
    ]);
    return { r, macros, refeicoes, cardapio, plano };
  }, []);

  async function gerar() {
    setGerando(true);
    try {
      await gerarCardapioSemanal();
      buzz.ok();
      await recarregar();
    } finally {
      setGerando(false);
    }
  }

  if (!dados?.r) return <Screen titulo="Carregando…">{null}</Screen>;
  const { r, macros, refeicoes, cardapio, plano } = dados;
  const restante = Math.max(0, r.meta.kcal - macros.kcal);

  return (
    <Screen
      titulo="Dieta"
      subtitulo={`Meta de ${num(r.meta.kcal)} kcal por dia`}
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.push('/compras')} style={s.iconeBtn} scale={0.92}>
          <Ionicons name="cart-outline" size={19} color={colors.textDim} />
        </Press>
      }
    >
      {/* ── Resumo ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card>
          <View style={s.resumo}>
            <Anel
              valor={pct(macros.kcal, r.meta.kcal)}
              tamanho={120}
              centro={kcal(macros.kcal)}
              legenda={`de ${num(r.meta.kcal)}`}
              cor={macros.kcal > r.meta.kcal * 1.05 ? colors.danger : colors.primary}
            />
            <View style={{ flex: 1, gap: spacing.md }}>
              <MacroBarra
                label="Proteína"
                atual={macros.proteina_g}
                meta={r.meta.proteina_g}
                cor={colors.protein}
              />
              <MacroBarra
                label="Carboidrato"
                atual={macros.carbo_g}
                meta={r.meta.carbo_g}
                cor={colors.carb}
              />
              <MacroBarra
                label="Gordura"
                atual={macros.gordura_g}
                meta={r.meta.gordura_g}
                cor={colors.fat}
              />
            </View>
          </View>
          <View style={s.faixaRestante}>
            <Ionicons
              name={restante > 0 ? 'flame-outline' : 'checkmark-circle'}
              size={15}
              color={restante > 0 ? colors.textDim : colors.success}
            />
            <Txt v="small" cor={restante > 0 ? colors.textDim : colors.success}>
              {restante > 0
                ? `Faltam ${num(restante)} kcal para bater a meta`
                : 'Meta de calorias atingida'}
            </Txt>
          </View>
        </Card>

        {/* ── Quando um freio da meta mordeu ─────────────────────────────
            Piso calórico, teto de mobilização de gordura e carboidrato
            espremido. É a tela onde a meta é vivida todo dia, e era ela que
            mostrava "1.326 kcal" sem nenhuma sinalização de que o número tinha
            sido limitado (ou de que não fecha). */}
        {r.avisosMeta.map((a) => (
          <Card key={a} faixa={colors.warn} padding={spacing.md} style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warn} />
              <Txt v="small" size={12} cor={colors.textDim} style={{ flex: 1 }}>
                {a}
              </Txt>
            </View>
          </Card>
        ))}
      </Animated.View>

      {/* ── Cardápio do dia ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <View style={s.entre}>
          <Txt v="label">Cardápio de hoje</Txt>
          {plano ? (
            <Press onPress={gerar} haptic="leve">
              <Txt v="small" cor={colors.primary} bold>
                Regerar
              </Txt>
            </Press>
          ) : null}
        </View>

        {cardapio.length ? (
          cardapio.map((item) => (
            <Card
              key={item.id}
              padding={spacing.md}
              onPress={() => item.recipe_id && router.push(`/receita/${item.recipe_id}`)}
            >
              <View style={s.entre}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="label" cor={colors.primary} size={10}>
                    {nomeRefeicao(item.tipo)}
                  </Txt>
                  <Txt v="h3">{item.nome}</Txt>
                  <Txt v="small" cor={colors.textFaint} size={12}>
                    {kcal(item.kcal)} kcal · P {num(item.proteina_g)} · C {num(item.carbo_g)} · G{' '}
                    {num(item.gordura_g)}
                  </Txt>
                </View>
                <Press
                  onPress={async () => {
                    if (!item.recipe_id) return;
                    const receitas = await listarReceitas();
                    const rec = receitas.find((x) => x.id === item.recipe_id);
                    if (rec) {
                      await registrarReceita(item.tipo, rec, item.quantidade);
                      await avaliarConquistas();
                      buzz.ok();
                      recarregar();
                    }
                  }}
                  style={s.btnComi}
                  scale={0.92}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                </Press>
              </View>
            </Card>
          ))
        ) : (
          <Empty
            icone="restaurant-outline"
            titulo="Sem cardápio montado"
            texto="Gere um cardápio de 7 dias ajustado à sua meta calórica, com receitas e lista de compras."
            acao={{ titulo: gerando ? 'Gerando…' : 'Gerar cardápio da semana', onPress: gerar }}
          />
        )}
      </Animated.View>

      {/* ── O que comi hoje ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">O que eu comi</Txt>
        {ORDEM_REFEICOES.map((tipo) => {
          const ref = refeicoes.find((x) => x.tipo === tipo);
          if (!ref && tipo !== 'cafe' && tipo !== 'almoco' && tipo !== 'jantar') return null;
          return (
            <Card key={tipo} padding={spacing.md}>
              <View style={s.entre}>
                <Txt v="h3">{nomeRefeicao(tipo)}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  {ref ? (
                    <Txt v="small" cor={colors.primary} bold>
                      {kcal(ref.macros.kcal)} kcal
                    </Txt>
                  ) : null}
                  <Press onPress={() => setAdicionando(tipo)} style={s.btnComi} scale={0.92}>
                    <Ionicons name="add" size={19} color={colors.primary} />
                  </Press>
                </View>
              </View>

              {ref?.itens.map((it) => (
                <Animated.View key={it.id} exiting={FadeOut.duration(160)} style={s.itemLinha}>
                  <Txt v="small" style={{ flex: 1 }}>
                    {it.nome_snap}
                    <Txt v="small" cor={colors.textFaint}>
                      {'  '}
                      {num(it.quantidade)} {it.unidade}
                    </Txt>
                  </Txt>
                  <Txt v="small" cor={colors.textDim}>
                    {kcal(it.kcal_snap)}
                  </Txt>
                  <Press
                    onPress={async () => {
                      await removerItem(it.id);
                      buzz.leve();
                      recarregar();
                    }}
                    style={{ padding: 4 }}
                    scale={0.85}
                  >
                    <Ionicons name="close" size={15} color={colors.textFaint} />
                  </Press>
                </Animated.View>
              ))}

              {!ref ? (
                <Txt v="small" cor={colors.textFaint}>
                  Nada registrado
                </Txt>
              ) : null}
            </Card>
          );
        })}
      </Animated.View>

      <Button
        titulo="Ver receitas"
        icone="book-outline"
        variante="secundario"
        full
        onPress={() => router.push('/receitas')}
      />

      <SheetAdicionar
        tipo={adicionando}
        onFechar={() => setAdicionando(null)}
        onPronto={() => {
          setAdicionando(null);
          recarregar();
        }}
      />
    </Screen>
  );
}

function MacroBarra({
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
        <Txt v="small" size={12}>
          {label}
        </Txt>
        <Txt v="small" size={12} cor={colors.textDim}>
          {num(atual)}/{num(meta)} g
        </Txt>
      </View>
      <Barra valor={pct(atual, meta)} cor={cor} altura={6} excedeu={atual > meta * 1.15} />
    </View>
  );
}

/** Busca de alimento ou receita, com quantidade — usado ao registrar refeição. */
function SheetAdicionar({
  tipo,
  onFechar,
  onPronto,
}: {
  tipo: TipoRefeicao | null;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<'alimento' | 'receita'>('alimento');
  const [escolhido, setEscolhido] = useState<Food | ReceitaComMacros | null>(null);
  const [qtd, setQtd] = useState('100');

  const { dados } = useDados(
    async () =>
      modo === 'alimento'
        ? ((await listarAlimentos(busca)) as (Food | ReceitaComMacros)[])
        : ((await listarReceitas(busca)) as (Food | ReceitaComMacros)[]),
    [busca, modo],
    { aoFocar: false }
  );

  async function salvar() {
    if (!escolhido || !tipo) return;
    const q = parseFloat(qtd.replace(',', '.')) || 0;
    if (q <= 0) return;

    if (modo === 'alimento') await registrarAlimento(tipo, escolhido as Food, q);
    else await registrarReceita(tipo, escolhido as ReceitaComMacros, q);

    await avaliarConquistas();
    buzz.ok();
    setEscolhido(null);
    setBusca('');
    setQtd('100');
    onPronto();
  }

  return (
    <Sheet
      aberto={!!tipo}
      onFechar={onFechar}
      titulo={tipo ? nomeRefeicao(tipo) : ''}
      altura={0.88}
      // Rolável SÓ no passo de digitar a quantidade: o passo de busca traz a
      // própria FlatList, e uma ScrollView por fora criaria rolagem aninhada —
      // a lista pararia de responder ao arrasto.
      rolavel={!!escolhido}
    >
      {escolhido ? (
        <View style={{ gap: spacing.lg }}>
          <Card>
            <Txt v="h2">{escolhido.nome}</Txt>
            <Txt v="small">
              {kcal(escolhido.kcal)} kcal · P {num(escolhido.proteina_g)} g · C{' '}
              {num(escolhido.carbo_g)} g · G {num(escolhido.gordura_g)} g
              {modo === 'alimento' ? ' (por 100 g)' : ' (por porção)'}
            </Txt>
          </Card>

          <Input
            rotulo={modo === 'alimento' ? 'Quantidade em gramas' : 'Porções'}
            grande
            sufixo={modo === 'alimento' ? 'g' : 'porções'}
            value={qtd}
            onChangeText={setQtd}
            keyboardType="decimal-pad"
            autoFocus
          />

          {modo === 'alimento' && (escolhido as Food).medida_caseira ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {[1, 2, 3].map((n) => {
                const f = escolhido as Food;
                const g = (f.g_por_medida ?? 100) * n;
                return (
                  <Chip
                    key={n}
                    label={`${n}× ${f.medida_caseira} (${g} g)`}
                    onPress={() => setQtd(String(g))}
                    ativo={qtd === String(g)}
                  />
                );
              })}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              titulo="Voltar"
              variante="fantasma"
              onPress={() => setEscolhido(null)}
              style={{ flex: 1 }}
            />
            <Button titulo="Registrar" onPress={salvar} style={{ flex: 2 }} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.md, flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip
              label="Alimentos"
              ativo={modo === 'alimento'}
              onPress={() => setModo('alimento')}
            />
            <Chip label="Receitas" ativo={modo === 'receita'} onPress={() => setModo('receita')} />
          </View>

          <Input placeholder="Buscar…" value={busca} onChangeText={setBusca} autoCorrect={false} />

          <FlatList
            data={dados ?? []}
            keyExtractor={(i) => `${modo}-${i.id}`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing['3xl'] }}
            ListEmptyComponent={
              <Txt v="small" center style={{ paddingVertical: spacing['3xl'] }}>
                Nada encontrado
              </Txt>
            }
            renderItem={({ item }) => (
              <Press
                onPress={() => {
                  setEscolhido(item);
                  setQtd(modo === 'alimento' ? '100' : '1');
                }}
                style={s.itemBusca}
                scale={0.98}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt v="h3">{item.nome}</Txt>
                  <Txt v="small" cor={colors.textFaint} size={12}>
                    {kcal(item.kcal)} kcal · P {num(item.proteina_g)} · C {num(item.carbo_g)} · G{' '}
                    {num(item.gordura_g)}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Press>
            )}
          />
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  faixaRestante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  btnComi: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemBusca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
