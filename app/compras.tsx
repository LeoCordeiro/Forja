import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Button, Card, Empty, Press, Screen, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  CATEGORIAS_COMPRA,
  alternarComprado,
  gerarListaCompras,
  listaAtual,
  planoAtivo,
} from '@/features/dieta/api';
import { dataCurta } from '@/shared/utils/date';
import { num, pct } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

export default function Compras() {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { dados, recarregar } = useDados(async () => {
    const [lista, plano] = await Promise.all([listaAtual(), planoAtivo()]);
    return { lista, plano };
  }, []);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      await gerarListaCompras(7);
      buzz.ok();
      await recarregar();
    } catch (e) {
      setErro(
        'Monte um cardápio na aba Dieta antes de gerar a lista — ela é compilada a partir dele.'
      );
    } finally {
      setGerando(false);
    }
  }

  const lista = dados?.lista;
  const comprados = lista?.itens.filter((i) => i.comprado).length ?? 0;
  const total = lista?.itens.length ?? 0;

  // Agrupa por corredor do mercado — é a ordem em que se anda na loja.
  const porCategoria = new Map<string, typeof lista extends null ? never : NonNullable<typeof lista>['itens']>();
  for (const item of lista?.itens ?? []) {
    const cat = item.categoria ?? 'mercearia';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(item);
  }

  return (
    <Screen
      titulo="Lista de compras"
      subtitulo={
        lista ? `${dataCurta(lista.periodo_inicio)} a ${dataCurta(lista.periodo_fim)}` : undefined
      }
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Press>
      }
    >
      {lista && total > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(280)}>
            <Card>
              <View style={s.entre}>
                <Txt v="h2">
                  {comprados}
                  <Txt v="body" cor={colors.textDim}>
                    {' '}
                    de {total} itens
                  </Txt>
                </Txt>
                {comprados === total ? (
                  <Txt v="small" cor={colors.success} bold>
                    Compra completa
                  </Txt>
                ) : null}
              </View>
              <Barra
                valor={pct(comprados, total)}
                cor={comprados === total ? colors.success : colors.primary}
              />
            </Card>
          </Animated.View>

          {[...porCategoria.entries()].map(([cat, itens], gi) => {
            const info = CATEGORIAS_COMPRA[cat] ?? { label: cat, emoji: '🛒' };
            return (
              <Animated.View
                key={cat}
                entering={FadeInDown.delay(gi * 60).duration(280)}
                style={{ gap: spacing.md }}
              >
                <View style={s.catHead}>
                  <Txt size={16}>{info.emoji}</Txt>
                  <Txt v="label">{info.label}</Txt>
                  <Txt v="small" cor={colors.textFaint}>
                    {itens.filter((i) => i.comprado).length}/{itens.length}
                  </Txt>
                </View>
                <Card padding={0}>
                  {itens.map((item, i) => (
                    <Animated.View key={item.id} layout={LinearTransition.duration(220)}>
                      <Press
                        onPress={async () => {
                          await alternarComprado(item.id);
                          buzz.leve();
                          recarregar();
                        }}
                        haptic={false}
                        scale={0.99}
                        style={[
                          s.item,
                          i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                        ]}
                      >
                        <View style={[s.check, !!item.comprado && s.checkOn]}>
                          {item.comprado ? (
                            <Ionicons name="checkmark" size={15} color="#00251A" />
                          ) : null}
                        </View>
                        <Txt
                          v="body"
                          style={[
                            { flex: 1 },
                            !!item.comprado && {
                              textDecorationLine: 'line-through' as const,
                              color: colors.textFaint,
                            },
                          ]}
                        >
                          {item.nome}
                        </Txt>
                        <Txt v="h3" cor={item.comprado ? colors.textFaint : colors.textDim}>
                          {num(item.quantidade_total, item.unidade === 'kg' ? 2 : 0)}{' '}
                          {item.unidade}
                        </Txt>
                      </Press>
                    </Animated.View>
                  ))}
                </Card>
              </Animated.View>
            );
          })}

          <Button
            titulo="Gerar lista nova"
            icone="refresh"
            variante="secundario"
            full
            carregando={gerando}
            onPress={gerar}
          />
        </>
      ) : (
        <Empty
          icone="cart-outline"
          titulo="Nenhuma lista gerada"
          texto={
            erro ??
            'A lista é compilada dos ingredientes do seu cardápio da semana, somados e agrupados por corredor do mercado.'
          }
          acao={{
            titulo: dados?.plano ? 'Gerar lista da semana' : 'Ir montar o cardápio',
            onPress: dados?.plano ? gerar : () => router.push('/dieta'),
          }}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
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
