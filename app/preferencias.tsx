import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  categoriasQueCome,
  getConfigDieta,
  salvarCategoriasQueCome,
  salvarConfigDieta,
} from '@/features/dieta/preferencias';
import { CATEGORIAS_PREFERENCIA, RESTRICOES } from '@/db/seed/receitas-fit';
import { ORCAMENTOS, PRATICIDADE } from '@/db/seed/marmitas';
import { buzz } from '@/shared/utils/haptics';

/**
 * O que você come.
 *
 * Vem antes de montar cardápio: sem isso o app sugere comida que a pessoa não
 * prepara, e a dieta morre no primeiro dia.
 */
export default function Preferencias() {
  const router = useRouter();
  const [come, setCome] = useState<string[]>([]);
  const [restricao, setRestricao] = useState('nenhuma');
  const [tempoMax, setTempoMax] = useState(45);
  const [refeicoes, setRefeicoes] = useState(5);
  const [praticidade, setPraticidade] = useState<string>('equilibrado');
  const [orcamento, setOrcamento] = useState<string>('medio');
  const [salvando, setSalvando] = useState(false);

  const { dados } = useDados(async () => {
    const [cats, cfg] = await Promise.all([categoriasQueCome(), getConfigDieta()]);
    return { cats, cfg };
  }, []);

  useEffect(() => {
    if (!dados) return;
    // Primeira vez: assume que come de tudo, é o caso mais comum.
    setCome(dados.cats.length ? dados.cats : CATEGORIAS_PREFERENCIA.map((c) => c.chave));
    setRestricao(dados.cfg.restricao);
    setTempoMax(dados.cfg.tempo_max_preparo);
    setRefeicoes(dados.cfg.refeicoes_por_dia);
    setPraticidade(dados.cfg.praticidade ?? 'equilibrado');
    setOrcamento(dados.cfg.orcamento ?? 'medio');
  }, [dados]);

  function alternar(chave: string) {
    buzz.selecao();
    setCome((p) => (p.includes(chave) ? p.filter((c) => c !== chave) : [...p, chave]));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarCategoriasQueCome(come);
      await salvarConfigDieta({
        restricao,
        tempo_max_preparo: tempoMax,
        refeicoes_por_dia: refeicoes,
        praticidade,
        orcamento,
      });
      buzz.ok();
      router.back();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela
      titulo="O que você come"
      subtitulo="O cardápio é montado a partir daqui"
    >
      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Alimentos que você come sem problema</Txt>
        <Txt v="small" cor={colors.textFaint}>
          Desmarque só o que você realmente não come. Quanto mais marcado, mais variado fica o
          cardápio.
        </Txt>

        <View style={{ gap: spacing.sm }}>
          {CATEGORIAS_PREFERENCIA.map((c) => {
            const ativo = come.includes(c.chave);
            return (
              <Card key={c.chave} onPress={() => alternar(c.chave)} destaque={ativo} padding={spacing.md}>
                <View style={s.linha}>
                  <Txt size={22}>{c.emoji}</Txt>
                  <Txt v="h3" style={{ flex: 1 }}>
                    {c.label}
                  </Txt>
                  <Ionicons
                    name={ativo ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={ativo ? colors.primary : colors.textFaint}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Restrição alimentar</Txt>
        <View style={s.chips}>
          {RESTRICOES.map((r) => (
            <Chip
              key={r.chave}
              label={r.label}
              ativo={restricao === r.chave}
              onPress={() => setRestricao(r.chave)}
            />
          ))}
        </View>
      </Animated.View>

      {/* ── Praticidade ── */}
      <Animated.View entering={FadeInDown.delay(90).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Como você quer cozinhar</Txt>
        <View style={{ gap: spacing.sm }}>
          {PRATICIDADE.map((p) => (
            <Card
              key={p.chave}
              onPress={() => {
                setPraticidade(p.chave);
                setTempoMax(p.tempoMax);
              }}
              destaque={praticidade === p.chave}
              padding={spacing.md}
            >
              <View style={s.linha}>
                <Txt size={22}>{p.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt v="h3" size={15}>
                    {p.label}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {p.desc}
                  </Txt>
                </View>
                {praticidade === p.chave ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      </Animated.View>

      {/* ── Orçamento ── */}
      <Animated.View entering={FadeInDown.delay(105).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Orçamento do mercado</Txt>
        <View style={{ gap: spacing.sm }}>
          {ORCAMENTOS.map((o) => (
            <Card
              key={o.chave}
              onPress={() => setOrcamento(o.chave)}
              destaque={orcamento === o.chave}
              padding={spacing.md}
            >
              <View style={s.linha}>
                <Txt size={22}>{o.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt v="h3" size={15}>
                    {o.label}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {o.desc}
                  </Txt>
                </View>
                {orcamento === o.chave ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
        <Txt v="small" cor={colors.textFaint}>
          A lista de compras mostra o custo estimado, e o cardápio prioriza receitas dentro da sua
          faixa. Proteína barata que funciona: ovo, frango e carne moída de acém.
        </Txt>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Tempo máximo de preparo</Txt>
        <View style={s.chips}>
          {[15, 30, 45, 60].map((t) => (
            <Chip
              key={t}
              label={`${t} min`}
              ativo={tempoMax === t}
              onPress={() => setTempoMax(t)}
            />
          ))}
        </View>
        <Txt v="small" cor={colors.textFaint}>
          Receita que passa disso não entra no cardápio. Seja honesto — dieta só funciona se você
          conseguir cumprir na terça-feira cansado.
        </Txt>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Refeições por dia</Txt>
        <View style={s.chips}>
          {[3, 4, 5, 6].map((n) => (
            <Chip key={n} label={`${n}`} ativo={refeicoes === n} onPress={() => setRefeicoes(n)} />
          ))}
        </View>
        <Txt v="small" cor={colors.textFaint}>
          O número de refeições não muda o resultado — o que importa é o total do dia. Escolha o que
          couber na sua rotina.
        </Txt>
      </Animated.View>

      <Button titulo="Salvar preferências" full tam="lg" onPress={salvar} carregando={salvando} />
    </Tela>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
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
