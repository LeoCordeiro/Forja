import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, motion, radius, spacing } from '@/theme';
import { Button, Card, Chip, Input, Press, Txt } from '@/shared/ui';
import { salvarMedida, salvarMeta, salvarPerfil } from '@/features/perfil/api';
import {
  DESC_ATIVIDADE,
  LABEL_ATIVIDADE,
  LABEL_OBJETIVO,
  classificacaoImc,
  imc,
  macros,
  metaCalorica,
  tdee,
  tmb,
} from '@/features/perfil/calculos';
import type { Genero, NivelAtividade, Objetivo } from '@/db/types';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { num } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';
import { useApp } from '@/shared/estado';

const PASSOS = 6;

export default function Onboarding() {
  const router = useRouter();
  const setTemPerfil = useApp((s) => s.setTemPerfil);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [genero, setGenero] = useState<Genero>('masculino');
  const [nascimento, setNascimento] = useState('');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [nivel, setNivel] = useState<NivelAtividade>('moderado');
  const [objetivo, setObjetivo] = useState<Objetivo>('hipertrofia');

  const prog = useSharedValue(0);
  const barra = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));

  function ir(delta: number) {
    const novo = Math.max(0, Math.min(PASSOS - 1, passo + delta));
    setPasso(novo);
    prog.value = withSpring((novo + 1) / PASSOS, motion.springSoft);
    buzz.leve();
  }

  const pesoN = parseFloat(peso.replace(',', '.')) || 0;
  const alturaN = parseFloat(altura.replace(',', '.')) || 0;
  const idadeN = nascimento ? calcIdade(nascimento) : 0;

  const podeAvancar = [
    nome.trim().length >= 2,
    nascimento.length === 10 && idadeN >= 10 && idadeN < 100,
    alturaN >= 100 && alturaN <= 250 && pesoN >= 30 && pesoN <= 300,
    true,
    true,
    true,
  ][passo];

  const basal = pesoN && alturaN && idadeN ? tmb(pesoN, alturaN, idadeN, genero) : 0;
  const gasto = basal ? tdee(basal, nivel) : 0;
  const alvo = gasto ? metaCalorica(gasto, objetivo) : 0;
  const m = alvo ? macros(alvo, pesoN, objetivo) : null;

  async function concluir() {
    setSalvando(true);
    try {
      await salvarPerfil({
        nome: nome.trim(),
        data_nascimento: paraIso(nascimento),
        genero,
        altura_cm: alturaN,
        nivel_atividade: nivel,
        objetivo,
        peso_meta_kg: null,
        onboarding_completo: 1,
      });
      await salvarMedida({ peso_kg: pesoN });
      if (m) await salvarMeta(m);
      await avaliarConquistas();
      buzz.ok();
      // Avisa o gate antes de navegar, senão ele devolve para o passo 1.
      setTemPerfil(true);
      router.replace('/');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.lg }]}>
      <View style={s.trilho}>
        <Animated.View style={[s.progresso, barra]} />
      </View>

      <View style={s.topo}>
        {passo > 0 ? (
          <Press onPress={() => ir(-1)} style={s.voltar} scale={0.9}>
            <Ionicons name="chevron-back" size={22} color={colors.textDim} />
          </Press>
        ) : (
          <View style={s.voltar} />
        )}
        <Txt v="label">
          Passo {passo + 1} de {PASSOS}
        </Txt>
        <View style={s.voltar} />
      </View>

      <ScrollView
        contentContainerStyle={s.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {passo === 0 && (
          <Bloco key="p0" titulo="Bem-vindo à Forja" sub="Como você quer ser chamado?">
            <Input
              placeholder="Seu nome"
              value={nome}
              onChangeText={setNome}
              autoFocus
              maxLength={30}
              returnKeyType="next"
            />
            <Txt v="small" style={{ marginTop: spacing.md }}>
              Tudo fica salvo só no seu aparelho. Sem conta, sem nuvem, sem senha.
            </Txt>
          </Bloco>
        )}

        {passo === 1 && (
          <Bloco key="p1" titulo={`Prazer, ${nome.split(' ')[0]}`} sub="Preciso de dois dados básicos">
            <Txt v="label">Gênero</Txt>
            <View style={s.linha}>
              {(['masculino', 'feminino', 'outro'] as Genero[]).map((g) => (
                <Chip
                  key={g}
                  label={g === 'masculino' ? 'Masculino' : g === 'feminino' ? 'Feminino' : 'Outro'}
                  ativo={genero === g}
                  onPress={() => setGenero(g)}
                />
              ))}
            </View>
            <View style={{ height: spacing.lg }} />
            <Input
              rotulo="Data de nascimento"
              placeholder="DD/MM/AAAA"
              value={nascimento}
              onChangeText={(t) => setNascimento(mascaraData(t))}
              keyboardType="number-pad"
              maxLength={10}
              erro={
                nascimento.length === 10 && (idadeN < 10 || idadeN > 99)
                  ? 'Data inválida'
                  : undefined
              }
            />
            {idadeN > 0 && idadeN < 100 ? (
              <Txt v="small" cor={colors.primary}>
                {idadeN} anos
              </Txt>
            ) : null}
          </Bloco>
        )}

        {passo === 2 && (
          <Bloco key="p2" titulo="Suas medidas" sub="Base para todos os cálculos do app">
            <View style={s.duplo}>
              <View style={{ flex: 1 }}>
                <Input
                  rotulo="Altura"
                  grande
                  sufixo="cm"
                  placeholder="175"
                  value={altura}
                  onChangeText={setAltura}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  rotulo="Peso"
                  grande
                  sufixo="kg"
                  placeholder="75"
                  value={peso}
                  onChangeText={setPeso}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
            </View>

            {pesoN > 0 && alturaN > 0 ? (
              <Animated.View entering={FadeIn}>
                <Card style={{ marginTop: spacing.lg }}>
                  <View style={s.entre}>
                    <Txt v="small">Seu IMC</Txt>
                    <Txt v="h2" cor={classificacaoImc(imc(pesoN, alturaN)).cor}>
                      {num(imc(pesoN, alturaN), 1)}
                    </Txt>
                  </View>
                  <Txt v="small" cor={classificacaoImc(imc(pesoN, alturaN)).cor}>
                    {classificacaoImc(imc(pesoN, alturaN)).texto}
                  </Txt>
                </Card>
              </Animated.View>
            ) : null}
          </Bloco>
        )}

        {passo === 3 && (
          <Bloco key="p3" titulo="Seu dia a dia" sub="Quanto você se movimenta fora da academia?">
            <View style={{ gap: spacing.sm }}>
              {(Object.keys(LABEL_ATIVIDADE) as NivelAtividade[]).map((n) => (
                <Card key={n} onPress={() => setNivel(n)} destaque={nivel === n} padding={spacing.lg}>
                  <View style={s.entre}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="h3">{LABEL_ATIVIDADE[n]}</Txt>
                      <Txt v="small">{DESC_ATIVIDADE[n]}</Txt>
                    </View>
                    {nivel === n ? (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          </Bloco>
        )}

        {passo === 4 && (
          <Bloco key="p4" titulo="Seu objetivo" sub="Define a meta calórica e a divisão de macros">
            <View style={{ gap: spacing.sm }}>
              {(Object.keys(LABEL_OBJETIVO) as Objetivo[]).map((o) => (
                <Card
                  key={o}
                  onPress={() => setObjetivo(o)}
                  destaque={objetivo === o}
                  padding={spacing.lg}
                >
                  <View style={s.entre}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="h3">{LABEL_OBJETIVO[o]}</Txt>
                      <Txt v="small">
                        {o === 'hipertrofia'
                          ? 'Superávit de 15% sobre o gasto'
                          : o === 'emagrecimento'
                            ? 'Déficit de 15% sobre o gasto'
                            : 'Calorias iguais ao gasto'}
                      </Txt>
                    </View>
                    {objetivo === o ? (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          </Bloco>
        )}

        {passo === 5 && m && (
          <Bloco key="p5" titulo="Tudo pronto" sub="Seus números, calculados a partir do que você informou">
            <Card>
              <View style={s.entre}>
                <View>
                  <Txt v="label">Metabolismo basal</Txt>
                  <Txt v="small">Gasto do corpo em repouso</Txt>
                </View>
                <Txt v="h2">{num(basal)}</Txt>
              </View>
            </Card>
            <Card>
              <View style={s.entre}>
                <View>
                  <Txt v="label">Gasto diário total</Txt>
                  <Txt v="small">Incluindo sua atividade</Txt>
                </View>
                <Txt v="h2">{num(gasto)}</Txt>
              </View>
            </Card>
            <Card destaque>
              <Txt v="label" cor={colors.primary}>
                Sua meta diária
              </Txt>
              <Txt v="display" cor={colors.primary}>
                {num(m.kcal)}
                <Txt v="h3" cor={colors.primary}>
                  {' '}
                  kcal
                </Txt>
              </Txt>
              <View style={[s.linha, { marginTop: spacing.md }]}>
                <Macro cor={colors.protein} label="Proteína" valor={m.proteina_g} />
                <Macro cor={colors.carb} label="Carbo" valor={m.carbo_g} />
                <Macro cor={colors.fat} label="Gordura" valor={m.gordura_g} />
              </View>
            </Card>
            <Txt v="small" center style={{ marginTop: spacing.sm }}>
              Dá pra ajustar tudo depois no perfil.
            </Txt>
          </Bloco>
        )}
      </ScrollView>

      <View style={[s.rodape, { paddingBottom: insets.bottom + spacing.lg, width }]}>
        <Button
          titulo={passo === PASSOS - 1 ? 'Começar a treinar' : 'Continuar'}
          iconeDireita={passo === PASSOS - 1 ? 'flame' : 'arrow-forward'}
          onPress={passo === PASSOS - 1 ? concluir : () => ir(1)}
          desabilitado={!podeAvancar}
          carregando={salvando}
          tam="lg"
          full
        />
      </View>
    </View>
  );
}

function Bloco({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInRight.duration(260)}
      exiting={FadeOutLeft.duration(160)}
      style={{ gap: spacing.md }}
    >
      <Txt v="h1">{titulo}</Txt>
      <Txt v="body" cor={colors.textDim} style={{ marginBottom: spacing.md }}>
        {sub}
      </Txt>
      {children}
    </Animated.View>
  );
}

function Macro({ cor, label, valor }: { cor: string; label: string; valor: number }) {
  return (
    <View style={s.macro}>
      <View style={[s.pontoMacro, { backgroundColor: cor }]} />
      <Txt v="small" cor={colors.textDim} size={11}>
        {label}
      </Txt>
      <Txt v="h3">{valor} g</Txt>
    </View>
  );
}

// ── helpers de data no formato brasileiro ────────────────────────────────
function mascaraData(t: string) {
  const d = t.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function paraIso(br: string) {
  const [d, m, a] = br.split('/');
  return `${a}-${m}-${d}`;
}

function calcIdade(br: string) {
  const [d, m, a] = br.split('/').map(Number);
  if (!a || !m || !d) return 0;
  const nasc = new Date(a, m - 1, d);
  const hj = new Date();
  let anos = hj.getFullYear() - nasc.getFullYear();
  const dm = hj.getMonth() - nasc.getMonth();
  if (dm < 0 || (dm === 0 && hj.getDate() < nasc.getDate())) anos--;
  return anos;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  trilho: {
    height: 3,
    backgroundColor: colors.surfaceHigh,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progresso: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  voltar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
  linha: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  duplo: { flexDirection: 'row', gap: spacing.md },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  macro: { flex: 1, gap: 2 },
  pontoMacro: { width: 22, height: 3, borderRadius: 2, marginBottom: 4 },
  rodape: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
