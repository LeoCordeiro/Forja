import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Button, Card, Chip, Input, Press, Screen, Sheet, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo, salvarMeta, salvarPerfil } from '@/features/perfil/api';
import { estatisticas } from '@/features/treino/api';
import { getStats, progressoNivel } from '@/features/gamificacao/api';
import {
  DESC_ATIVIDADE,
  LABEL_ATIVIDADE,
  LABEL_OBJETIVO,
  classificacaoImc,
  macros,
  metaCalorica,
} from '@/features/perfil/calculos';
import type { NivelAtividade, Objetivo } from '@/db/types';
import { resetDb } from '@/db/client';
import { useApp } from '@/shared/estado';
import { classificarVisceral } from '@/features/perfil/recomposicao';
import { num, volume } from '@/shared/utils/format';
import { idade } from '@/shared/utils/date';
import { buzz } from '@/shared/utils/haptics';

export default function Perfil() {
  const router = useRouter();
  const setTemPerfil = useApp((s) => s.setTemPerfil);
  const [editando, setEditando] = useState(false);
  const [editandoMeta, setEditandoMeta] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, stats, gam] = await Promise.all([resumo(), estatisticas(), getStats()]);
    return { r, stats, gam };
  }, []);

  if (!dados?.r) return <Screen titulo="Carregando…">{null}</Screen>;
  const { r, stats, gam } = dados;
  const nivel = progressoNivel(gam.xp_total);

  function confirmarReset() {
    const acao = async () => {
      await resetDb();
      buzz.aviso();
      setTemPerfil(false);
      router.replace('/onboarding');
    };
    // Alert nativo não existe no preview web; lá a ação vai direto.
    if (Platform.OS === 'web') return void acao();
    Alert.alert(
      'Apagar todos os dados?',
      'Treinos, medidas, refeições e medalhas serão perdidos. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar tudo', style: 'destructive', onPress: acao },
      ]
    );
  }

  return (
    <Screen titulo="Perfil" subtitulo={r.perfil.nome} onRefresh={recarregar}>
      {/* ── Cartão de identidade ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card>
          <View style={s.topo}>
            <View style={s.avatar}>
              <Txt v="h1" cor={colors.primary}>
                {r.perfil.nome.charAt(0).toUpperCase()}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="h2">{r.perfil.nome}</Txt>
              <Txt v="small">
                {idade(r.perfil.data_nascimento)} anos · {num(r.perfil.altura_cm)} cm ·{' '}
                {num(r.pesoKg, 1)} kg
              </Txt>
              <View style={s.tagObjetivo}>
                <Ionicons name="flag" size={11} color={colors.primary} />
                <Txt v="small" cor={colors.primary} size={11} bold>
                  {LABEL_OBJETIVO[r.perfil.objetivo]}
                </Txt>
              </View>
            </View>
            <Press onPress={() => setEditando(true)} style={s.iconeBtn} scale={0.9}>
              <Ionicons name="create-outline" size={19} color={colors.textDim} />
            </Press>
          </View>

          <View style={s.nivelLinha}>
            <Txt v="small" cor={colors.xp} bold>
              Nível {nivel.nivel}
            </Txt>
            <Txt v="small" cor={colors.textFaint}>
              {num(nivel.xpAtual)} XP · faltam {num(nivel.faltam)}
            </Txt>
          </View>
          <Barra valor={nivel.fracao} cor={colors.xp} altura={6} />
        </Card>
      </Animated.View>

      {/* ── Números ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Seus números</Txt>
        <View style={s.grid}>
          <Metrica
            label="IMC"
            valor={num(r.imcValor, 1)}
            legenda={classificacaoImc(r.imcValor).texto}
            cor={classificacaoImc(r.imcValor).cor}
          />
          <Metrica
            label="Metabolismo basal"
            valor={num(r.tmbValor)}
            legenda={r.tmbMedido ? 'medido na bioimpedância' : 'estimado por fórmula'}
            cor={r.tmbMedido ? colors.success : undefined}
          />
          {r.gorduraPct !== null ? (
            <Metrica
              label="Gordura corporal"
              valor={`${num(r.gorduraPct, 1)}%`}
              legenda={r.massaMagraKg ? `${r.massaMagraKg} kg de massa magra` : 'da bioimpedância'}
              cor={colors.warn}
            />
          ) : null}
          {r.visceral !== null ? (
            <Metrica
              label="Gordura visceral"
              valor={num(r.visceral)}
              legenda={classificarVisceral(r.visceral).texto}
              cor={classificarVisceral(r.visceral).cor}
            />
          ) : null}
          <Metrica label="Gasto diário" valor={num(r.tdeeValor)} legenda="kcal com atividade" />
          <Metrica
            label="Meta diária"
            valor={num(r.meta.kcal)}
            legenda={`${LABEL_OBJETIVO[r.perfil.objetivo]}`}
            cor={colors.primary}
          />
        </View>
        <Card onPress={() => setEditandoMeta(true)}>
          <View style={s.entre}>
            <View style={{ flex: 1 }}>
              <Txt v="h3">Macros da meta</Txt>
              <Txt v="small">
                P {r.meta.proteina_g} g · C {r.meta.carbo_g} g · G {r.meta.gordura_g} g
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.textFaint} />
          </View>
        </Card>
      </Animated.View>

      {/* ── Estatísticas ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Números da jornada</Txt>
        <View style={s.grid}>
          <Metrica label="Treinos" valor={num(stats.treinos)} legenda="concluídos" />
          <Metrica label="Volume total" valor={volume(stats.volume)} legenda="levantados" />
          <Metrica label="Séries" valor={num(stats.series)} legenda="registradas" />
          <Metrica label="Recordes" valor={num(stats.prs)} legenda="quebrados" cor={colors.warn} />
        </View>
        <View style={s.grid}>
          <Metrica
            label="Sequência"
            valor={`${gam.streak_atual}`}
            legenda="dias seguidos"
            cor={colors.primary}
          />
          <Metrica label="Recorde de sequência" valor={`${gam.maior_streak}`} legenda="dias" />
        </View>
      </Animated.View>

      {/* ── Ações ── */}
      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.sm }}>
        <ItemMenu
          icone="analytics-outline"
          titulo="Bioimpedância e composição corporal"
          onPress={() => router.push('/bioimpedancia')}
        />
        <ItemMenu
          icone="nutrition-outline"
          titulo="O que você come"
          onPress={() => router.push('/preferencias')}
        />
        <ItemMenu
          icone="water-outline"
          titulo="Hidratação"
          onPress={() => router.push('/agua')}
        />
        <ItemMenu
          icone="share-social-outline"
          titulo="Compartilhar treino"
          onPress={() => router.push('/compartilhar')}
        />
        <ItemMenu
          icone="trophy-outline"
          titulo="Medalhas e conquistas"
          onPress={() => router.push('/conquistas')}
        />
        <ItemMenu
          icone="barbell-outline"
          titulo="Catálogo de exercícios"
          onPress={() => router.push('/exercicios')}
        />
        <ItemMenu
          icone="book-outline"
          titulo="Receitas"
          onPress={() => router.push('/receitas')}
        />
        <ItemMenu
          icone="cart-outline"
          titulo="Lista de compras"
          onPress={() => router.push('/compras')}
        />
      </Animated.View>

      <Card>
        <Txt v="label">Sobre</Txt>
        <Txt v="small">
          Forja guarda tudo apenas neste aparelho, num banco SQLite local. Sem conta, sem servidor,
          sem internet — funciona no modo avião dentro da academia.
        </Txt>
      </Card>

      <Press onPress={confirmarReset} style={s.reset} haptic="forte">
        <Ionicons name="warning-outline" size={15} color={colors.danger} />
        <Txt v="small" cor={colors.danger}>
          Apagar todos os dados e recomeçar
        </Txt>
      </Press>

      <SheetEditar
        aberto={editando}
        perfilAtual={r.perfil}
        onFechar={() => setEditando(false)}
        onSalvo={() => {
          setEditando(false);
          recarregar();
        }}
      />

      <SheetMeta
        aberto={editandoMeta}
        atual={r.meta}
        pesoKg={r.pesoKg}
        tdeeValor={r.tdeeValor}
        objetivo={r.perfil.objetivo}
        onFechar={() => setEditandoMeta(false)}
        onSalvo={() => {
          setEditandoMeta(false);
          recarregar();
        }}
      />
    </Screen>
  );
}

function Metrica({
  label,
  valor,
  legenda,
  cor,
}: {
  label: string;
  valor: string;
  legenda: string;
  cor?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: '46%' }} padding={spacing.md}>
      <Txt v="label" size={10}>
        {label}
      </Txt>
      <Txt v="h1" cor={cor} size={26}>
        {valor}
      </Txt>
      <Txt v="small" cor={colors.textFaint} size={11}>
        {legenda}
      </Txt>
    </Card>
  );
}

function ItemMenu({
  icone,
  titulo,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={s.menu} scale={0.98}>
      <Ionicons name={icone} size={19} color={colors.textDim} />
      <Txt v="body" style={{ flex: 1 }}>
        {titulo}
      </Txt>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Press>
  );
}

function SheetEditar({
  aberto,
  perfilAtual,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  perfilAtual: {
    nome: string;
    data_nascimento: string;
    genero: 'masculino' | 'feminino' | 'outro';
    altura_cm: number;
    nivel_atividade: NivelAtividade;
    objetivo: Objetivo;
    peso_meta_kg: number | null;
  };
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(perfilAtual.nome);
  const [altura, setAltura] = useState(String(perfilAtual.altura_cm));
  const [pesoMeta, setPesoMeta] = useState(
    perfilAtual.peso_meta_kg ? String(perfilAtual.peso_meta_kg) : ''
  );
  const [nivel, setNivel] = useState<NivelAtividade>(perfilAtual.nivel_atividade);
  const [objetivo, setObjetivo] = useState<Objetivo>(perfilAtual.objetivo);

  async function salvar() {
    await salvarPerfil({
      ...perfilAtual,
      nome: nome.trim() || perfilAtual.nome,
      altura_cm: parseFloat(altura.replace(',', '.')) || perfilAtual.altura_cm,
      peso_meta_kg: parseFloat(pesoMeta.replace(',', '.')) || null,
      nivel_atividade: nivel,
      objetivo,
      onboarding_completo: 1,
    });
    buzz.ok();
    onSalvo();
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Editar perfil" altura={0.9}>
      <View style={{ gap: spacing.xl }}>
        <Input rotulo="Nome" value={nome} onChangeText={setNome} maxLength={30} />
        <Input
          rotulo="Altura (cm)"
          value={altura}
          onChangeText={setAltura}
          keyboardType="decimal-pad"
        />
        <Input
          rotulo="Peso meta (kg) — opcional"
          placeholder="Aparece como linha no gráfico"
          value={pesoMeta}
          onChangeText={setPesoMeta}
          keyboardType="decimal-pad"
        />

        <View style={{ gap: spacing.sm }}>
          <Txt v="label">Nível de atividade</Txt>
          <View style={s.chips}>
            {(Object.keys(LABEL_ATIVIDADE) as NivelAtividade[]).map((n) => (
              <Chip
                key={n}
                label={LABEL_ATIVIDADE[n]}
                ativo={nivel === n}
                onPress={() => setNivel(n)}
              />
            ))}
          </View>
          <Txt v="small" cor={colors.textFaint}>
            {DESC_ATIVIDADE[nivel]}
          </Txt>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt v="label">Objetivo</Txt>
          <View style={s.chips}>
            {(Object.keys(LABEL_OBJETIVO) as Objetivo[]).map((o) => (
              <Chip
                key={o}
                label={LABEL_OBJETIVO[o]}
                ativo={objetivo === o}
                onPress={() => setObjetivo(o)}
              />
            ))}
          </View>
        </View>

        <Button titulo="Salvar" full tam="lg" onPress={salvar} />
      </View>
    </Sheet>
  );
}

function SheetMeta({
  aberto,
  atual,
  pesoKg,
  tdeeValor,
  objetivo,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  atual: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number };
  pesoKg: number;
  tdeeValor: number;
  objetivo: Objetivo;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [kcalV, setKcal] = useState(String(atual.kcal));
  const [prot, setProt] = useState(String(atual.proteina_g));
  const [carb, setCarb] = useState(String(atual.carbo_g));
  const [gord, setGord] = useState(String(atual.gordura_g));

  function recalcular() {
    const m = macros(metaCalorica(tdeeValor, objetivo), pesoKg, objetivo);
    setKcal(String(m.kcal));
    setProt(String(m.proteina_g));
    setCarb(String(m.carbo_g));
    setGord(String(m.gordura_g));
    buzz.leve();
  }

  async function salvar() {
    await salvarMeta(
      {
        kcal: parseInt(kcalV, 10) || atual.kcal,
        proteina_g: parseInt(prot, 10) || atual.proteina_g,
        carbo_g: parseInt(carb, 10) || atual.carbo_g,
        gordura_g: parseInt(gord, 10) || atual.gordura_g,
      },
      'manual'
    );
    buzz.ok();
    onSalvo();
  }

  const somaKcal =
    (parseInt(prot, 10) || 0) * 4 + (parseInt(carb, 10) || 0) * 4 + (parseInt(gord, 10) || 0) * 9;
  const diferenca = somaKcal - (parseInt(kcalV, 10) || 0);

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Ajustar meta" altura={0.88}>
      <View style={{ gap: spacing.lg }}>
        <Input rotulo="Calorias (kcal)" value={kcalV} onChangeText={setKcal} keyboardType="number-pad" />
        <Input rotulo="Proteína (g)" value={prot} onChangeText={setProt} keyboardType="number-pad" />
        <Input rotulo="Carboidrato (g)" value={carb} onChangeText={setCarb} keyboardType="number-pad" />
        <Input rotulo="Gordura (g)" value={gord} onChangeText={setGord} keyboardType="number-pad" />

        {/* Conferência: macro que não fecha com a caloria é erro silencioso. */}
        <View
          style={[
            s.conferencia,
            {
              backgroundColor:
                Math.abs(diferenca) <= 30 ? colors.successSoft : colors.warnSoft,
            },
          ]}
        >
          <Ionicons
            name={Math.abs(diferenca) <= 30 ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={Math.abs(diferenca) <= 30 ? colors.success : colors.warn}
          />
          <Txt v="small" cor={Math.abs(diferenca) <= 30 ? colors.success : colors.warn} style={{ flex: 1 }}>
            {Math.abs(diferenca) <= 30
              ? `Os macros somam ${num(somaKcal)} kcal — bate com a meta.`
              : `Os macros somam ${num(somaKcal)} kcal, ${diferenca > 0 ? 'acima' : 'abaixo'} da meta em ${num(Math.abs(diferenca))} kcal.`}
          </Txt>
        </View>

        <Button titulo="Recalcular automaticamente" variante="fantasma" full onPress={recalcular} />
        <Button titulo="Salvar meta" full tam="lg" onPress={salvar} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagObjetivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    marginTop: 2,
  },
  nivelLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
  },
  conferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
