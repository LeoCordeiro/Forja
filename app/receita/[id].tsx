import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, Press, Tela, Sheet, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  getReceita,
  ingredientesDaReceita,
  passosDaReceita,
  registrarReceita,
} from '@/features/dieta/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import type { TipoRefeicao } from '@/db/types';
import { cronometro, kcal, nomeRefeicao, num, ORDEM_REFEICOES } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

export default function DetalheReceita() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recId = Number(id);
  const router = useRouter();

  const [feitos, setFeitos] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState<{ passo: number; resta: number } | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const { dados } = useDados(async () => {
    const [rec, ings, passos] = await Promise.all([
      getReceita(recId),
      ingredientesDaReceita(recId),
      passosDaReceita(recId),
    ]);
    return { rec, ings, passos };
  }, [recId]);

  // Timer do passo: conta e avisa no fim, sem sair da tela da receita.
  useEffect(() => {
    if (!timer) return;
    if (timer.resta <= 0) {
      buzz.forte();
      setTimer(null);
      return;
    }
    const t = setTimeout(() => setTimer((x) => (x ? { ...x, resta: x.resta - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  if (!dados?.rec) return <Tela titulo="Carregando…">{null}</Tela>;
  const { rec, ings, passos } = dados;

  function alternarPasso(i: number) {
    setFeitos((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
    buzz.leve();
  }

  return (
    <Tela
      titulo={rec.nome}
      subtitulo={`${rec.tempo_preparo_min} min · rende ${num(rec.rendimento_porcoes)} ${
        rec.rendimento_porcoes > 1 ? 'porções' : 'porção'
      }`}
    >
      {/* ── Macros por porção ── */}
      <Animated.View entering={FadeInDown.duration(280)}>
        <Card>
          <Txt v="label">Por porção</Txt>
          <View style={s.macros}>
            <BlocoMacro valor={kcal(rec.kcal)} label="kcal" cor={colors.primary} destaque />
            <BlocoMacro valor={`${num(rec.proteina_g)} g`} label="Proteína" cor={colors.protein} />
            <BlocoMacro valor={`${num(rec.carbo_g)} g`} label="Carbo" cor={colors.carb} />
            <BlocoMacro valor={`${num(rec.gordura_g)} g`} label="Gordura" cor={colors.fat} />
          </View>
        </Card>
      </Animated.View>

      {/* ── Ingredientes ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: spacing.md }}>
        <Txt v="label">Ingredientes</Txt>
        <Card>
          {ings.map((ing, i) => (
            <View
              key={ing.id}
              style={[s.ingrediente, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <View style={s.bolinha} />
              <Txt v="body" style={{ flex: 1 }}>
                {ing.nome}
                {ing.observacao ? (
                  <Txt v="small" cor={colors.textFaint}>
                    {' '}
                    ({ing.observacao})
                  </Txt>
                ) : null}
              </Txt>
              <Txt v="h3" cor={colors.textDim}>
                {num(ing.quantidade)} {ing.unidade}
              </Txt>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Preparo ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={{ gap: spacing.md }}>
        <View style={s.entre}>
          <Txt v="label">Modo de preparo</Txt>
          <Txt v="small" cor={colors.textFaint}>
            {feitos.size}/{passos.length}
          </Txt>
        </View>

        {passos.map((p, i) => {
          const feito = feitos.has(i);
          const rodando = timer?.passo === i;
          return (
            <Card
              key={p.id}
              padding={spacing.md}
              style={rodando ? { borderColor: colors.primary } : undefined}
            >
              <Press onPress={() => alternarPasso(i)} haptic={false} style={s.passo}>
                <View style={[s.passoNum, feito && s.passoFeito]}>
                  {feito ? (
                    <Ionicons name="checkmark" size={15} color="#00251A" />
                  ) : (
                    <Txt v="small" cor={colors.primary} bold>
                      {i + 1}
                    </Txt>
                  )}
                </View>
                <Txt
                  v="body"
                  style={{ flex: 1 }}
                  cor={feito ? colors.textFaint : colors.text}
                >
                  {p.texto}
                </Txt>
              </Press>

              {p.tempo_seg ? (
                <View style={s.timerLinha}>
                  {rodando ? (
                    <Animated.View entering={FadeIn} style={s.timerAtivo}>
                      <Ionicons name="timer" size={16} color={colors.primary} />
                      <Txt v="h3" cor={colors.primary}>
                        {cronometro(timer.resta)}
                      </Txt>
                      <Press onPress={() => setTimer(null)} haptic="leve" style={{ marginLeft: 'auto' }}>
                        <Txt v="small" cor={colors.textDim} bold>
                          Parar
                        </Txt>
                      </Press>
                    </Animated.View>
                  ) : (
                    <Chip
                      label={`Iniciar timer de ${Math.round(p.tempo_seg / 60) || 1} min`}
                      icone="timer-outline"
                      onPress={() => {
                        setTimer({ passo: i, resta: p.tempo_seg! });
                        buzz.medio();
                      }}
                    />
                  )}
                </View>
              ) : null}
            </Card>
          );
        })}
      </Animated.View>

      <Button
        titulo="Comi esta receita"
        icone="restaurant"
        full
        tam="lg"
        onPress={() => setRegistrando(true)}
      />

      <Sheet
        aberto={registrando}
        onFechar={() => setRegistrando(false)}
        titulo="Registrar em qual refeição?"
        altura={0.5}
      >
        <View style={{ gap: spacing.sm }}>
          {ORDEM_REFEICOES.map((t) => (
            <Card
              key={t}
              padding={spacing.lg}
              onPress={async () => {
                await registrarReceita(t as TipoRefeicao, rec, 1);
                await avaliarConquistas();
                buzz.ok();
                setRegistrando(false);
                router.back();
              }}
            >
              <View style={s.entre}>
                <Txt v="h3">{nomeRefeicao(t)}</Txt>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Card>
          ))}
        </View>
      </Sheet>
    </Tela>
  );
}

function BlocoMacro({
  valor,
  label,
  cor,
  destaque,
}: {
  valor: string;
  label: string;
  cor: string;
  destaque?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={[s.tracoMacro, { backgroundColor: cor }]} />
      <Txt v={destaque ? 'h2' : 'h3'} cor={destaque ? cor : colors.text}>
        {valor}
      </Txt>
      <Txt v="small" size={11} cor={colors.textFaint}>
        {label}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  macros: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  tracoMacro: { width: 20, height: 3, borderRadius: 2, marginBottom: 3 },
  ingrediente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  bolinha: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  passo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  passoNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoFeito: { backgroundColor: colors.success },
  timerLinha: { marginTop: spacing.md, marginLeft: 38 },
  timerAtivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
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
