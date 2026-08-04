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
import { salvarMedida, salvarMeta, salvarPerfil, salvarTempoPorDia } from '@/features/perfil/api';
import {
  DESC_ATIVIDADE,
  LABEL_ATIVIDADE,
  LABEL_OBJETIVO,
  classificacaoImc,
  imc,
  tdee,
  tmb,
} from '@/features/perfil/calculos';
import type { Experiencia, Genero, NivelAtividade, Objetivo } from '@/db/types';
import { DESC_OBJETIVO_V2, LABEL_OBJETIVO_V2 } from '@/features/perfil/recomposicao';
import { calcularMetaDetalhada } from '@/features/perfil/meta';
import { DESC_EXPERIENCIA, LABEL_EXPERIENCIA, planoRetorno } from '@/features/treino/periodizacao';
import { LOCAIS, type LocalTreino } from '@/features/treino/local';
import { divisaoDe, gerarEAplicar, gruposEnfatizados, type Plano } from '@/features/treino/gerador';
import { REGIOES_DOR } from '@/features/perfil/diagnostico';
import { OPCOES_EQUIPAMENTO } from '@/features/treino/equipamento';
import { metaDiaria as metaDiariaAgua } from '@/features/agua/api';
import { DESC_HORARIO, LABEL_HORARIO, type HorarioTreino } from '@/features/dieta/timing';
import { hoje as hojeIso } from '@/shared/utils/date';
import { Ajuda } from '@/shared/ui/Ajuda';
import { AJUDA } from '@/shared/ajudas';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { num } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';
import { useApp } from '@/shared/estado';

const PASSOS = 9;

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Quanto tempo por sessão.
 *
 * Pergunta direta, porque é o recurso que ninguém consegue aumentar — e o que
 * decide quantos exercícios cabem. Prescrever 8 exercícios para quem tem 50
 * minutos não é rigor: é garantir que os 3 últimos nunca sejam feitos.
 */
/** Faixas de barra fixa. Guarda o pior caso: quem marca "3 a 5" recebe 3. */
const BARRAS = [
  { v: 0, l: 'Nenhuma' },
  { v: 1, l: '1 ou 2' },
  { v: 3, l: '3 a 5' },
  { v: 6, l: '6 a 9' },
  { v: 10, l: '10 ou mais' },
];

const TEMPOS = [
  { v: 50, l: '50 min', d: 'Almoço, sem folga' },
  { v: 60, l: '1 h', d: 'Cravado' },
  { v: 75, l: '1h15', d: 'Dá para respirar' },
  { v: 90, l: '1h30', d: 'Confortável' },
  { v: 120, l: '2 h', d: 'Sem correria' },
];

/** Grupos que fazem sentido priorizar. A ênfase soma série, nunca tira de outro. */
/**
 * Ênfase: região primeiro, músculo depois.
 *
 * A pergunta é feita porque o padrão existe — mulher costuma querer glúteo e
 * perna, homem costuma querer peito e ombro — mas deduzir isso do gênero erraria
 * com a mulher que quer costas e com o homem que quer perna. O corpo responde
 * igual nos dois casos; o que muda é onde a pessoa quer o resultado. Então o app
 * pergunta em vez de assumir.
 */
const ENFASES: { v: string | null; l: string; d: string }[] = [
  { v: null, l: 'Equilibrado', d: 'Volume parelho no corpo todo' },
  { v: 'inferior', l: 'Inferiores', d: 'Glúteo, quadríceps, posterior e panturrilha' },
  { v: 'superior', l: 'Superiores', d: 'Peito, costas, ombro e braço' },
  { v: 'gluteo', l: 'Glúteo', d: 'Um grupo específico' },
  { v: 'quadriceps', l: 'Perna', d: 'Um grupo específico' },
  { v: 'peito', l: 'Peito', d: 'Um grupo específico' },
  { v: 'costas', l: 'Costas', d: 'Um grupo específico' },
  { v: 'ombro', l: 'Ombro', d: 'Um grupo específico' },
  { v: 'biceps', l: 'Braço', d: 'Um grupo específico' },
  { v: 'abdomen', l: 'Abdômen', d: 'Um grupo específico' },
];

/** Frase que traduz os focos escolhidos em quantas séries cada lado recebe. */
function resumoDoFoco(focos: string[]): string {
  const n = gruposEnfatizados(focos).size;
  const bonus = Math.max(1, Math.min(4, Math.round(16 / n)));
  const nomes = focos
    .map((f) => ENFASES.find((e) => e.v === f)?.l.replace('Só ', '').toLowerCase() ?? f)
    .join(', ');
  return `${n} grupo${n > 1 ? 's' : ''} priorizado${n > 1 ? 's' : ''} (${nomes}): +${bonus} série${bonus > 1 ? 's' : ''} por semana em cada um, tiradas de quem não foi escolhido — nunca abaixo do mínimo em que o músculo ainda responde.`;
}

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
  const [objetivo, setObjetivo] = useState<Objetivo>('recomposicao');
  const [experiencia, setExperiencia] = useState<Experiencia>('iniciante');
  const [mesesParado, setMesesParado] = useState(0);
  const [horarioTreino, setHorarioTreino] = useState<HorarioTreino>('manha');
  const [local, setLocal] = useState<LocalTreino>('academia');
  // Dias marcados são a fonte da verdade: a quantidade sai deles, e não o
  // contrário. Perguntar "quantos dias" e depois "quais dias" é o tipo de
  // pergunta em duas etapas que faz a pessoa responder a segunda no automático.
  const [diasMarcados, setDiasMarcados] = useState<number[]>([1, 3, 5]);
  const [minutos, setMinutos] = useState(75);
  const [equipamento, setEquipamento] = useState('ambos');
  const [dores, setDores] = useState<string[]>([]);
  const [focos, setFocos] = useState<string[]>([]);
  const [barras, setBarras] = useState(-1);
  const [plano, setPlano] = useState<Plano | null>(null);

  const diasSemana = diasMarcados.length || 3;

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
    diasMarcados.length >= 1,
    true,
    true,
    true,
  ][passo];

  const basal = pesoN && alturaN && idadeN ? tmb(pesoN, alturaN, idadeN, genero) : 0;
  const gasto = basal ? tdee(basal, nivel) : 0;
  // Um ponto de calculo so, tambem no onboarding: a previa que a pessoa ve
  // aqui tem que ser exatamente a meta que o app vai gravar. Refazer a conta na
  // tela foi como a proteina sobre o peso total voltou uma vez.
  const previa = gasto
    ? calcularMetaDetalhada({
        tdee: gasto,
        basal,
        pesoKg: pesoN,
        objetivo,
        gorduraPct: null,
        estimar: { alturaCm: alturaN, idade: idadeN, genero },
        genero,
      })
    : null;
  const m = previa?.meta ?? null;
  const alvo = m?.kcal ?? 0;

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
        experiencia,
        dias_treino_semana: diasSemana,
        meses_parado: mesesParado,
        // Âncora do plano de readaptação: a contagem de semanas parte daqui.
        retomou_em: hojeIso(),
        meta_agua_ml: metaDiariaAgua(pesoN, true),
        horario_treino: horarioTreino,
        // Quem treina em jejum acorda mais cedo; muda os horários das refeições.
        hora_acorda: horarioTreino === 'jejum' ? '05:30' : '06:30',
        local_treino: local,
        dias_disponiveis: diasMarcados.join(','),
        enfase: focos.join(','),
        barra_fixa_reps: barras,
        preferencia_equipamento: equipamento,
        dores: dores.join(','),
      });
      await salvarMedida({ peso_kg: pesoN });
      if (m) await salvarMeta(m);

      // O treino sai daqui pronto: divisão, exercícios, séries e dia da semana
      // de cada sessão. Terminar o questionário e cair num app que ainda pede
      // para você montar o treino é o mesmo que não ter perguntado nada.
      await salvarTempoPorDia(
        Array.from({ length: 7 }, (_, i) => (i === 0 || i === 6 ? Math.round(minutos * 1.2) : minutos))
      );
      const gerado = await gerarEAplicar({
        dias: diasMarcados.length,
        diasDisponiveis: diasMarcados,
        minutosPorDia: Array.from({ length: 7 }, (_, i) =>
          i === 0 || i === 6 ? Math.round(minutos * 1.2) : minutos
        ),
        experiencia,
        objetivo,
        local,
        preferenciaEquipamento: equipamento,
        barraFixaReps: barras,
        dores,
        focos,
      });
      setPlano(gerado);

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
              {(['recomposicao', 'hipertrofia', 'emagrecimento', 'manutencao'] as Objetivo[]).map(
                (o) => (
                  <Card
                    key={o}
                    onPress={() => setObjetivo(o)}
                    destaque={objetivo === o}
                    padding={spacing.lg}
                  >
                    <View style={s.entre}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Txt v="h3">{LABEL_OBJETIVO_V2[o]}</Txt>
                          {o === 'recomposicao' ? (
                            <View style={s.selo}>
                              <Txt v="small" size={9} cor={colors.primary} bold>
                                RECOMENDADO
                              </Txt>
                            </View>
                          ) : null}
                        </View>
                        <Txt v="small">{DESC_OBJETIVO_V2[o]}</Txt>
                      </View>
                      {objetivo === o ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      ) : null}
                    </View>
                  </Card>
                )
              )}
            </View>
            {objetivo === 'recomposicao' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Ajuda conteudo={AJUDA.recomposicao} tam={20} />
              </View>
            ) : null}
          </Bloco>
        )}

        {passo === 5 && (
          <Bloco
            key="p5b"
            titulo="Sua experiência"
            sub="Define o volume de treino e o plano de retorno"
          >
            <Txt v="label">Nível</Txt>
            <View style={{ gap: spacing.sm }}>
              {(['iniciante', 'intermediario', 'avancado'] as Experiencia[]).map((e) => (
                <Card key={e} onPress={() => setExperiencia(e)} destaque={experiencia === e} padding={spacing.lg}>
                  <View style={s.entre}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="h3">{LABEL_EXPERIENCIA[e]}</Txt>
                      <Txt v="small">{DESC_EXPERIENCIA[e]}</Txt>
                    </View>
                    {experiencia === e ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Em quais dias você consegue treinar?</Txt>
            <Txt v="small" cor={colors.textFaint} style={{ marginBottom: spacing.sm }}>
              Marque os dias de verdade, não os ideais. É com eles que o app monta a agenda — e
              cada treino vai ter dia com nome, não "3× por semana".
            </Txt>
            <View style={s.linha}>
              {NOMES_DIA.map((d, i) => (
                <Press
                  key={i}
                  onPress={() => {
                    buzz.leve();
                    setDiasMarcados((v) =>
                      v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort((a, b) => a - b)
                    );
                  }}
                  style={[s.diaSemana, diasMarcados.includes(i) && s.diaSemanaAtivo]}
                >
                  <Txt v="small" bold cor={diasMarcados.includes(i) ? '#1A0800' : colors.textDim}>
                    {d}
                  </Txt>
                </Press>
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              {diasMarcados.length
                ? `${divisaoDe(diasSemana).nome} — ${divisaoDe(diasSemana).porque}`
                : 'Marque pelo menos um dia.'}
            </Txt>

            <View style={{ height: spacing.lg }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Txt v="label">Quando você treina?</Txt>
              <Ajuda conteudo={AJUDA.preTreino} />
            </View>
            <View style={{ gap: spacing.sm }}>
              {(['jejum', 'manha', 'almoco', 'tarde', 'noite'] as HorarioTreino[]).map((h) => (
                <Card
                  key={h}
                  onPress={() => setHorarioTreino(h)}
                  destaque={horarioTreino === h}
                  padding={spacing.md}
                >
                  <View style={s.entre}>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3" size={15}>
                        {LABEL_HORARIO[h]}
                      </Txt>
                      <Txt v="small" size={11} cor={colors.textFaint}>
                        {DESC_HORARIO[h]}
                      </Txt>
                    </View>
                    {horarioTreino === h ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
            {horarioTreino === 'jejum' || horarioTreino === 'manha' ? (
              <Card style={{ marginTop: spacing.sm }} faixa={colors.warn}>
                <Txt v="small" cor={colors.warn} bold>
                  Seu café da manhã vira o pré-treino
                </Txt>
                <Txt v="small" style={{ marginTop: 4 }}>
                  {horarioTreino === 'jejum'
                    ? 'Treinando tão cedo, o app vai sugerir um pré-treino leve (banana, pão com mel) 20 min antes, e o café completo como pós-treino.'
                    : 'O app vai montar seu café da manhã como refeição pré-treino: carboidrato de digestão fácil, pouca gordura e pouca fibra.'}
                </Txt>
              </Card>
            ) : null}

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Há quanto tempo você está parado?</Txt>
            <View style={s.linha}>
              {[
                { v: 0, l: 'Treinando' },
                { v: 1, l: '1 mês' },
                { v: 2, l: '2 meses' },
                { v: 4, l: '3 a 6' },
                { v: 12, l: 'Mais de 6' },
              ].map((o) => (
                <Chip
                  key={o.v}
                  label={o.l}
                  ativo={mesesParado === o.v}
                  onPress={() => setMesesParado(o.v)}
                />
              ))}
            </View>
            {mesesParado > 0 ? (
              <Card style={{ marginTop: spacing.sm }}>
                <Txt v="small" cor={colors.info}>
                  {planoRetorno(mesesParado).resumo}
                </Txt>
                <Txt v="small" cor={colors.textFaint} style={{ marginTop: 4 }}>
                  A memória muscular faz você recuperar bem mais rápido do que levou para construir.
                  Voltar na carga de antes já na primeira semana é o erro que mais machuca.
                </Txt>
              </Card>
            ) : null}
          </Bloco>
        )}

        {passo === 6 && (
          <Bloco key="p6" titulo="Onde você treina" sub="É o que decide quais exercícios entram no seu plano">
            <View style={{ gap: spacing.sm }}>
              {LOCAIS.map((l) => (
                <Card key={l.chave} onPress={() => setLocal(l.chave)} destaque={local === l.chave} padding={spacing.md}>
                  <View style={s.entre}>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3" size={15}>
                        {l.emoji}  {l.label}
                      </Txt>
                      <Txt v="small" size={11} cor={colors.textFaint}>
                        {l.descricao}
                      </Txt>
                      {local === l.chave ? (
                        <Txt v="small" size={11} cor={colors.primary} style={{ marginTop: 4 }}>
                          {l.efeito}
                        </Txt>
                      ) : null}
                    </View>
                    {local === l.chave ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Quanto tempo você tem por sessão?</Txt>
            <View style={s.linha}>
              {TEMPOS.map((t) => (
                <Chip key={t.v} label={t.l} ativo={minutos === t.v} onPress={() => setMinutos(t.v)} />
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              {TEMPOS.find((t) => t.v === minutos)?.d}. O descanso entre séries é mais de 60% da
              sessão — por isso o app conta o tempo real antes de montar, e corta acessório em vez
              de encurtar o descanso do composto pesado.
            </Txt>

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Máquina ou peso livre?</Txt>
            <View style={s.linha}>
              {OPCOES_EQUIPAMENTO.map((o) => (
                <Chip
                  key={o.chave}
                  label={o.label}
                  ativo={equipamento === o.chave}
                  onPress={() => setEquipamento(o.chave)}
                />
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              Isto é preferência de verdade: 13 estudos com 1.016 pessoas não acharam diferença de
              hipertrofia entre os dois. Escolha o que faz você voltar na semana seguinte.
            </Txt>

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Quantas barras fixas você faz hoje?</Txt>
            <View style={s.linha}>
              {BARRAS.map((b) => (
                <Chip key={b.v} label={b.l} ativo={barras === b.v} onPress={() => setBarras(b.v)} />
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              Sem ajuda e sem impulso. Existe um punhado de exercícios em que a carga é o próprio
              corpo — barra fixa, mergulho no paralelo, flexão nórdica — e neles não dá para usar
              menos peso: ou você executa, ou não executa. Esta resposta decide se eles entram
              inteiros, entram assistidos, ou saem por enquanto.
            </Txt>
          </Bloco>
        )}

        {passo === 7 && (
          <Bloco key="p7" titulo="O que priorizar" sub="E o que evitar, para o treino não te machucar">
            <Txt v="label">O que você quer priorizar no treino?</Txt>
            <Txt v="small" cor={colors.textFaint} style={{ marginBottom: spacing.sm }}>
              Pode marcar mais de um. Até três.
            </Txt>
            <View style={s.linha}>
              {ENFASES.map((e) => (
                <Chip
                  key={e.l}
                  label={e.l}
                  ativo={e.v === null ? focos.length === 0 : focos.includes(e.v)}
                  onPress={() => {
                    buzz.leve();
                    if (e.v === null) return setFocos([]);
                    setFocos((v) =>
                      v.includes(e.v!)
                        ? v.filter((x) => x !== e.v)
                        : // Teto de 3: com meio corpo marcado, o orçamento de
                          // séries se dilui até a prioridade não significar nada.
                          v.length >= 3
                          ? v
                          : [...v, e.v!]
                    );
                  }}
                />
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              {focos.length === 0
                ? 'Volume parelho no corpo todo. Marque o que você quer priorizar — pode ser mais de um. O app pergunta em vez de deduzir do seu gênero: o corpo responde igual, o que muda é onde você quer o resultado.'
                : `${resumoDoFoco(focos)} Marcar mais dilui: o orçamento de séries é o mesmo, repartido entre o que você escolheu.${focos.length >= 3 ? ' Três é o limite — além disso prioridade deixa de significar prioridade.' : ''}`}
            </Txt>

            <View style={{ height: spacing.lg }} />
            <Txt v="label">Sente dor em alguma dessas regiões?</Txt>
            <View style={s.linha}>
              {REGIOES_DOR.map((r) => (
                <Chip
                  key={r.chave}
                  label={r.label}
                  ativo={dores.includes(r.chave)}
                  onPress={() =>
                    setDores((v) =>
                      v.includes(r.chave) ? v.filter((x) => x !== r.chave) : [...v, r.chave]
                    )
                  }
                />
              ))}
            </View>
            <Txt v="small" cor={colors.textFaint}>
              {dores.length
                ? `Os exercícios de risco para ${dores.length === 1 ? 'essa região' : 'essas regiões'} saem do plano e entra um equivalente que treina o mesmo músculo. Dor persistente é caso de fisioterapeuta — o app só evita piorar.`
                : 'Se não sente nada, deixe em branco. Não vamos tirar exercício por precaução.'}
            </Txt>
          </Bloco>
        )}

        {passo === 8 && m && (
          <Bloco key="p8" titulo="Tudo pronto" sub="Seus números, calculados a partir do que você informou">
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
  diaSemana: {
    flex: 1,
    minWidth: 44,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diaSemanaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
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
  selo: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
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
