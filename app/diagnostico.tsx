import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, Input, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo } from '@/features/perfil/api';
import {
  DESISTENCIAS,
  INCOMODOS,
  ONDE_ACUMULA,
  planoPara,
  REGIOES_DOR,
  type ChaveIncomodo,
} from '@/features/perfil/diagnostico';
import { salvarDiagnostico } from '@/features/perfil/api';
import { buzz } from '@/shared/utils/haptics';

/**
 * Perguntas que mudam o treino.
 *
 * A regra que sustenta a tela: nenhuma pergunta entra sem alterar algo
 * concreto na prescrição. Por isso cada opção mostra, ali mesmo, o que ela
 * muda — e a última etapa mostra o plano montado antes de salvar.
 */
export default function Diagnostico() {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [incomodo, setIncomodo] = useState<ChaveIncomodo | null>(null);
  const [onde, setOnde] = useState<string | null>(null);
  const [desistencia, setDesistencia] = useState<string | null>(null);
  const [dores, setDores] = useState<string[]>([]);
  const [minutos, setMinutos] = useState(60);
  const [passos, setPassos] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { dados } = useDados(resumo, []);
  const peso = dados?.pesoKg ?? 80;

  const plano = planoPara(
    {
      incomodo,
      ondeAcumula: onde,
      desistencia,
      doresRegioes: dores,
      minutosPorSessao: minutos,
      passosHoje: passos ? parseInt(passos, 10) : null,
    },
    peso
  );

  const PASSOS = [
    'O que mais te incomoda',
    'Onde acumula gordura',
    'O que já te fez parar',
    'Dor ao treinar',
    'Tempo por sessão',
    'Seu plano',
  ];

  async function salvar() {
    setSalvando(true);
    try {
      await salvarDiagnostico({
        incomodo,
        onde_acumula: onde,
        desistencia,
        dores: dores.join(','),
        minutos_sessao: minutos,
        passos_alvo: plano.passosAlvo,
        cardio_sessoes: plano.cardioSessoes,
      });
      buzz.ok();
      router.replace('/programa');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela
      titulo="Montar o treino ideal"
      subtitulo={`${passo + 1} de ${PASSOS.length} · ${PASSOS[passo]}`}
      paddingBottom={140}
    >
      {/* ── 1. Incômodo ── */}
      {passo === 0 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.sm }}>
          <Txt v="small" cor={colors.textFaint}>
            Escolha o que mais te incomoda hoje. Cada resposta muda algo concreto no plano — não é
            só para constar.
          </Txt>
          {INCOMODOS.map((o) => (
            <Card
              key={o.chave}
              padding={spacing.md}
              destaque={incomodo === o.chave}
              onPress={() => {
                setIncomodo(o.chave);
                buzz.selecao();
              }}
            >
              <View style={s.linha}>
                <Txt size={22}>{o.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt v="h3" size={15}>
                    {o.label}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {o.efeito}
                  </Txt>
                </View>
                {incomodo === o.chave ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </View>
            </Card>
          ))}
        </Animated.View>
      ) : null}

      {/* ── 2. Onde acumula ── */}
      {passo === 1 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.md }}>
          <Card faixa={colors.warn}>
            <Txt v="label" cor={colors.warn}>
              Antes de responder
            </Txt>
            <Txt v="small" style={{ marginTop: 4 }}>
              Você não escolhe de onde a gordura sai. Meta-análise de 13 estudos com 1.158 pessoas:
              treinar um músculo não reduz a gordura em cima dele — o efeito é zero.
            </Txt>
            <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
              Esta pergunta serve para o app saber o que medir e o que te mostrar como progresso,
              não para prometer queima localizada.
            </Txt>
          </Card>

          <View style={{ gap: spacing.sm }}>
            {ONDE_ACUMULA.map((o) => (
              <Card
                key={o.chave}
                padding={spacing.md}
                destaque={onde === o.chave}
                onPress={() => {
                  setOnde(o.chave);
                  buzz.selecao();
                }}
              >
                <View style={s.linha}>
                  <Txt size={22}>{o.emoji}</Txt>
                  <Txt v="h3" size={15} style={{ flex: 1 }}>
                    {o.label}
                  </Txt>
                  {onde === o.chave ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* ── 3. Desistência ── */}
      {passo === 2 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.sm }}>
          <Txt v="small" cor={colors.textFaint}>
            O que fez você parar da última vez? É a informação mais útil desta tela: o motivo de
            parar costuma se repetir.
          </Txt>
          {DESISTENCIAS.map((o) => (
            <Card
              key={o.chave}
              padding={spacing.md}
              destaque={desistencia === o.chave}
              onPress={() => {
                setDesistencia(o.chave);
                buzz.selecao();
              }}
            >
              <View style={s.linha}>
                <Txt size={20}>{o.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt v="h3" size={15}>
                    {o.label}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {o.efeito}
                  </Txt>
                </View>
                {desistencia === o.chave ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </View>
            </Card>
          ))}
        </Animated.View>
      ) : null}

      {/* ── 4. Dor ── */}
      {passo === 3 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.md }}>
          <Txt v="small" cor={colors.textFaint}>
            Marque onde dói ao treinar. Os exercícios que carregam a região saem do plano e entram
            substitutos que treinam o mesmo músculo.
          </Txt>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {REGIOES_DOR.map((r) => (
              <Chip
                key={r.chave}
                label={r.label}
                ativo={dores.includes(r.chave)}
                onPress={() => {
                  buzz.selecao();
                  setDores((p) =>
                    p.includes(r.chave) ? p.filter((x) => x !== r.chave) : [...p, r.chave]
                  );
                }}
              />
            ))}
          </View>
          {dores.length > 0 ? (
            <Card faixa={colors.warn} padding={spacing.md}>
              <Txt v="small" size={11} cor={colors.warn}>
                {/* "por exemplo" não é modéstia: quem decide é a regra de
                    padrão + atributo em `contraindicacao.ts`, sobre o catálogo
                    inteiro. Listar quatro nomes como se fossem a lista fechada
                    foi exatamente o que deixou a `Remada alta` passar. */}
                Sai do treino tudo que carrega a região — por exemplo{' '}
                {plano.evitar.slice(0, 4).join(', ')}.
              </Txt>
              <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 6 }}>
                Dor que persiste fora do treino é assunto de fisioterapeuta. O app troca exercício,
                não diagnostica.
              </Txt>
            </Card>
          ) : null}
        </Animated.View>
      ) : null}

      {/* ── 5. Tempo e passos ── */}
      {passo === 4 ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Quanto tempo você tem por sessão</Txt>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {[30, 45, 60, 75, 90].map((m) => (
                <Chip
                  key={m}
                  label={`${m} min`}
                  ativo={minutos === m}
                  onPress={() => {
                    setMinutos(m);
                    buzz.selecao();
                  }}
                />
              ))}
            </View>
            <Txt v="small" size={11} cor={colors.textFaint}>
              {minutos <= 45
                ? 'Sessão curta: isoladores entram em série conjugada e o número de exercícios cai.'
                : 'Dá para o volume completo, com descanso cheio nos compostos.'}
            </Txt>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Quantos passos você dá por dia hoje</Txt>
            <Input
              value={passos}
              onChangeText={setPassos}
              keyboardType="number-pad"
              placeholder="6000"
              sufixo="passos"
              grande
            />
            <Txt v="small" size={11} cor={colors.textFaint}>
              Olhe no app de saúde do celular. Passos são a variável que mais aumenta gasto diário
              sem cobrar recuperação de treino — e por isso a mais subestimada.
            </Txt>
          </View>
        </Animated.View>
      ) : null}

      {/* ── 6. Plano ── */}
      {passo === 5 ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
          <Card faixa={colors.primary}>
            <Txt v="label">Seu plano</Txt>
            <Txt v="h2" size={19} style={{ marginTop: 2 }}>
              {plano.titulo}
            </Txt>

            <View style={s.realidade}>
              <Ionicons name="alert-circle" size={16} color={colors.warn} />
              <View style={{ flex: 1 }}>
                <Txt v="small" size={11} cor={colors.warn} bold>
                  A VERDADE PRIMEIRO
                </Txt>
                <Txt v="small" size={12} cor={colors.warn}>
                  {plano.realidade}
                </Txt>
              </View>
            </View>

            <Txt v="label" style={{ marginTop: spacing.lg }}>
              O que o app vai fazer
            </Txt>
            {plano.acoes.map((a) => (
              <View key={a} style={s.acao}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Txt v="small" size={12} style={{ flex: 1 }}>
                  {a}
                </Txt>
              </View>
            ))}

            <View style={s.numeros}>
              {plano.passosAlvo ? (
                <Numero label="Passos por dia" valor={plano.passosAlvo.toLocaleString('pt-BR')} />
              ) : null}
              <Numero label="Cardio por semana" valor={`${plano.cardioSessoes}×`} />
              <Numero label="Por sessão" valor={`${minutos} min`} />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Navegação ── */}
      <View style={s.nav}>
        {passo > 0 ? (
          <Button
            titulo="Voltar"
            variante="secundario"
            onPress={() => setPasso((p) => p - 1)}
            style={{ flex: 1 }}
          />
        ) : null}
        {passo < PASSOS.length - 1 ? (
          <Button
            titulo="Continuar"
            full={passo === 0}
            style={passo > 0 ? { flex: 2 } : undefined}
            desabilitado={passo === 0 && !incomodo}
            onPress={() => setPasso((p) => p + 1)}
          />
        ) : (
          <Button
            titulo="Aplicar ao meu treino"
            icone="checkmark"
            style={{ flex: 2 }}
            carregando={salvando}
            onPress={salvar}
          />
        )}
      </View>
    </Tela>
  );
}

function Numero({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="small" size={10} cor={colors.textFaint}>
        {label}
      </Txt>
      <Txt v="h2" size={19} cor={colors.primary}>
        {valor}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  realidade: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  acao: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: 6 },
  numeros: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nav: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
