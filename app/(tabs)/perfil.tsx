import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Button, Card, Chip, Input, Press, Screen, Sheet, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  metaAutomatica,
  recalcularMeta,
  resumo,
  salvarMeta,
  salvarPerfil,
} from '@/features/perfil/api';
import { macrosParaMetaManual } from '@/features/perfil/meta';
import { estatisticas } from '@/features/treino/api';
import { getStats, progressoNivel } from '@/features/gamificacao/api';
import {
  DESC_ATIVIDADE,
  LABEL_ATIVIDADE,
  LABEL_OBJETIVO,
  classificacaoImc,
} from '@/features/perfil/calculos';
import type { NivelAtividade, Objetivo } from '@/db/types';
import { resetDb } from '@/db/client';
import { oQueSeraApagado, recomecarTreino } from '@/features/treino/api';
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
  const [recomecando, setRecomecando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [resetando, setResetando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, stats, gam, perder] = await Promise.all([
      resumo(),
      estatisticas(),
      getStats(),
      oQueSeraApagado(),
    ]);
    return { r, stats, gam, perder };
  }, []);

  if (!dados?.r) return <Screen titulo="Carregando…">{null}</Screen>;
  const { r, stats, gam, perder } = dados;
  const nivel = progressoNivel(gam.xp_total);

  /**
   * Confirmação da ação mais destrutiva do app, na folha do próprio app.
   *
   * Antes usava `Alert.alert` no nativo e, no web, PULAVA a confirmação: o
   * toque apagava tudo na hora. No PWA do iPhone — que é web — isso significava
   * perder meses de histórico sem uma única pergunta. Uma folha que funciona
   * igual nas três plataformas resolve os dois problemas de uma vez.
   */
  async function apagarTudo() {
    setResetando(true);
    try {
      await resetDb();
      buzz.aviso();
      setConfirmandoReset(false);
      setTemPerfil(false);
      router.replace('/onboarding');
    } finally {
      setResetando(false);
    }
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
        {/* ── Por que o metabolismo medido saiu de cena ──────────────────
            Um número que muda sozinho e não se explica é pior que o número
            velho: a bioimpedância continua no histórico, o que mudou é que ela
            parou de valer para a meta de hoje. Sem esta linha o usuário só
            veria o "medido na bioimpedância" virar "estimado por fórmula". */}
        {r.tmbMotivo ? (
          <Card faixa={colors.warn} padding={spacing.md}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Ionicons name="time-outline" size={16} color={colors.warn} />
              <Txt v="small" size={12} cor={colors.textDim} style={{ flex: 1 }}>
                {r.tmbMotivo}
              </Txt>
            </View>
          </Card>
        ) : null}

        <Card onPress={() => setEditandoMeta(true)}>
          <View style={s.entre}>
            <View style={{ flex: 1 }}>
              <Txt v="h3">Macros da meta</Txt>
              <Txt v="small">
                P {r.meta.proteina_g} g · C {r.meta.carbo_g} g · G {r.meta.gordura_g} g
              </Txt>
              {/* De onde a proteína saiu. Era o número mais consequente da
                  tela e o único sem origem escrita. */}
              <Txt v="small" size={11} cor={colors.textFaint}>
                Proteína: {r.baseCalculoMeta}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.textFaint} />
          </View>
        </Card>

        {/* ── Freios que morderam ────────────────────────────────────────
            Piso calórico, déficit acima do que a gordura entrega, carboidrato
            espremido. As três contas existiam no código e nenhuma chegava à
            tela — `deficitMaximoSeguro` estava escrito e nunca era chamado. */}
        {r.avisosMeta.map((a) => (
          <Card key={a} faixa={colors.warn} padding={spacing.md}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warn} />
              <Txt v="small" size={12} cor={colors.textDim} style={{ flex: 1 }}>
                {a}
              </Txt>
            </View>
          </Card>
        ))}
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

      {/* Recomeçar SÓ o treino: montar divisão é onde mais se experimenta, e
          em duas semanas há oito treinos e nenhum critério. Refazer isso não
          pode custar o histórico de peso e medidas. */}
      <Card faixa={colors.warn}>
        <Txt v="h3" size={15}>
          Recomeçar o treino
        </Txt>
        <Txt v="small" style={{ marginTop: 4 }}>
          Apaga rotinas, divisões e histórico de treino para você montar do zero. Peso, medidas,
          bioimpedância, água, dieta e medalhas continuam.
        </Txt>
        <View style={s.perder}>
          <Txt v="small" size={11} cor={colors.textFaint}>
            Serão apagados: {perder.dias} divisõe{perder.dias === 1 ? 'm' : 's'},{' '}
            {perder.sessoes} treino{perder.sessoes === 1 ? '' : 's'}, {perder.series} série
            {perder.series === 1 ? '' : 's'} e {perder.recordes} recorde
            {perder.recordes === 1 ? '' : 's'}.
          </Txt>
        </View>
        <Button
          titulo="Recomeçar o treino"
          icone="refresh"
          variante="secundario"
          full
          carregando={recomecando}
          style={{ marginTop: spacing.md }}
          onPress={() => setApagando(true)}
        />
      </Card>

      <Press onPress={() => setConfirmandoReset(true)} style={s.reset} haptic="forte">
        <Ionicons name="warning-outline" size={15} color={colors.danger} />
        <Txt v="small" cor={colors.danger}>
          Apagar todos os dados e recomeçar
        </Txt>
      </Press>

      <Sheet
        aberto={apagando}
        onFechar={() => setApagando(false)}
        titulo="Recomeçar o treino?"
        altura={0.55}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt v="small">
            Rotinas, divisões, sessões, séries e recordes serão apagados. Não dá para desfazer —
            se quiser guardar, baixe a cópia dos dados antes.
          </Txt>
          <Txt v="small" cor={colors.textFaint}>
            Continuam intactos: perfil, peso, medidas, bioimpedância, água, dieta e medalhas.
          </Txt>
          <Button
            titulo="Sim, recomeçar"
            variante="perigo"
            full
            tam="lg"
            carregando={recomecando}
            onPress={async () => {
              setRecomecando(true);
              try {
                await recomecarTreino();
                buzz.aviso();
                setApagando(false);
                recarregar();
                router.replace('/treino');
              } finally {
                setRecomecando(false);
              }
            }}
          />
          <Button titulo="Cancelar" variante="fantasma" full onPress={() => setApagando(false)} />
        </View>
      </Sheet>

      <Sheet
        aberto={confirmandoReset}
        onFechar={() => setConfirmandoReset(false)}
        titulo="Apagar todos os dados?"
        altura={0.6}
      >
        <View style={{ gap: spacing.lg }}>
          <Txt v="body">
            Treinos, séries, medidas, fotos de progresso, refeições, água e medalhas serão
            apagados. Não dá para desfazer.
          </Txt>
          <Txt v="small" cor={colors.textFaint}>
            Se quiser guardar antes, saia daqui e baixe a cópia dos seus dados em Treino → O que
            travou. Depois de apagar não existe de onde recuperar: nada disto está em servidor
            nenhum.
          </Txt>
          <Button
            titulo={resetando ? 'Apagando…' : 'Apagar tudo e recomeçar'}
            icone="trash-outline"
            full
            tam="lg"
            carregando={resetando}
            onPress={() => void apagarTudo()}
          />
          <Button
            titulo="Cancelar"
            variante="fantasma"
            full
            onPress={() => setConfirmandoReset(false)}
          />
        </View>
      </Sheet>

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
    // Objetivo, nível de atividade e altura mudam TDEE e macros. Sem
    // recalcular, a meta salva continua a do plano antigo e a aba Dieta
    // cobra as calorias erradas até a próxima pesagem.
    const alturaNova = parseFloat(altura.replace(',', '.')) || perfilAtual.altura_cm;
    const mudou =
      objetivo !== perfilAtual.objetivo ||
      nivel !== perfilAtual.nivel_atividade ||
      alturaNova !== perfilAtual.altura_cm;

    await salvarPerfil({
      ...perfilAtual,
      nome: nome.trim() || perfilAtual.nome,
      altura_cm: alturaNova,
      peso_meta_kg: parseFloat(pesoMeta.replace(',', '.')) || null,
      nivel_atividade: nivel,
      objetivo,
      onboarding_completo: 1,
    });
    if (mudou) await recalcularMeta();
    buzz.ok();
    onSalvo();
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Editar perfil" altura={0.9} rolavel>
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
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  atual: { kcal: number; proteina_g: number; carbo_g: number; gordura_g: number };
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [kcalV, setKcal] = useState(String(atual.kcal));
  const [prot, setProt] = useState(String(atual.proteina_g));
  const [carb, setCarb] = useState(String(atual.carbo_g));
  const [gord, setGord] = useState(String(atual.gordura_g));
  /**
   * A pessoa mexeu nos macros à mão?
   *
   * Enquanto NÃO mexeu, mudar a caloria refaz a divisão pela escada de
   * `macrosParaMetaManual` — a gordura cede até 20% das calorias antes de o
   * carboidrato apertar. Era esse o buraco: `definirMetaCalorica` tinha a
   * escada e **nenhum chamador** (grep confirmava), e o sheet gravava os quatro
   * campos crus. Baixar a meta para 1.500 mantinha 78 g de gordura e 346 g de
   * carbo — três números que não somam a caloria pedida.
   *
   * Depois de mexer num macro, o app para de recalcular: dali em diante quem
   * manda é a escolha da pessoa, e a incoerência (se houver) aparece na
   * conferência logo abaixo e nos avisos da meta salva.
   */
  const [macrosNaMao, setMacrosNaMao] = useState(false);
  /** Avisos da divisão atual — o que a escada teve que fazer para caber. */
  const [avisos, setAvisos] = useState<string[]>([]);

  // O sheet monta uma vez e fica montado: sem re-sincronizar na abertura, ele
  // mostra a meta de quando a tela nasceu — que uma troca de objetivo pode
  // ter acabado de recalcular.
  useEffect(() => {
    if (!aberto) return;
    setKcal(String(atual.kcal));
    setProt(String(atual.proteina_g));
    setCarb(String(atual.carbo_g));
    setGord(String(atual.gordura_g));
    setMacrosNaMao(false);
    setAvisos([]);
  }, [aberto, atual]);

  /** Caloria nova, macros intocados: a escada refaz a divisão na hora. */
  function mudarKcal(v: string) {
    setKcal(v);
    const n = parseInt(v, 10);
    if (macrosNaMao || !n || n < 400) return setAvisos([]);
    const r = macrosParaMetaManual(n, {
      kcal: n,
      proteina_g: parseInt(prot, 10) || atual.proteina_g,
      carbo_g: 0,
      gordura_g: 0,
    });
    setCarb(String(r.meta.carbo_g));
    setGord(String(r.meta.gordura_g));
    setAvisos(r.avisos);
  }

  // A conta mora em `metaAutomatica`, não aqui: refazer com macros() na tela
  // ignorava a massa magra e devolvia proteína sobre o peso total na
  // recomposição — o bug que o commit 774fd4c já tinha matado.
  async function recalcular() {
    const m = await metaAutomatica();
    if (!m) return;
    setKcal(String(m.kcal));
    setProt(String(m.proteina_g));
    setCarb(String(m.carbo_g));
    setGord(String(m.gordura_g));
    setMacrosNaMao(false);
    setAvisos(m.avisos);
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
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Ajustar meta" altura={0.88} rolavel>
      <View style={{ gap: spacing.lg }}>
        <Input rotulo="Calorias (kcal)" value={kcalV} onChangeText={mudarKcal} keyboardType="number-pad" />
        <Input
          rotulo="Proteína (g)"
          value={prot}
          onChangeText={(v) => { setMacrosNaMao(true); setProt(v); }}
          keyboardType="number-pad"
        />
        <Input
          rotulo="Carboidrato (g)"
          value={carb}
          onChangeText={(v) => { setMacrosNaMao(true); setCarb(v); }}
          keyboardType="number-pad"
        />
        <Input
          rotulo="Gordura (g)"
          value={gord}
          onChangeText={(v) => { setMacrosNaMao(true); setGord(v); }}
          keyboardType="number-pad"
        />

        {/* O que a escada teve que fazer para a caloria caber. Antes disso o
            app gravava `carbo 0 g` calado — a conta estourando registrada como
            se fosse prescrição. */}
        {avisos.map((a) => (
          <View key={a} style={[s.conferencia, { backgroundColor: colors.warnSoft }]}>
            <Ionicons name="alert-circle" size={16} color={colors.warn} />
            <Txt v="small" cor={colors.warn} style={{ flex: 1 }}>
              {a}
            </Txt>
          </View>
        ))}

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

        <Button
          titulo="Recalcular automaticamente"
          variante="fantasma"
          full
          onPress={() => void recalcular()}
        />
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
  perder: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
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
