import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Barras, Button, Card, Chip, Empty, Input, Linha, Press, Screen, Sheet, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  contarMedidas,
  historicoMedidas,
  recalcularMeta,
  resumo,
  salvarMedida,
} from '@/features/perfil/api';
import { estatisticas, treinosPorDia, volumePorGrupo } from '@/features/treino/api';
import { historicoCalorias } from '@/features/dieta/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import { classificacaoImc } from '@/features/perfil/calculos';
import { dataCurta, diaSemanaDe, hoje, semanasFechadas } from '@/shared/utils/date';
import { kcal, nomeGrupo, num, peso as fmtPeso, volume } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';
import { estadoDaCadencia } from '@/features/progresso/api';

type Metrica = 'peso' | 'cintura' | 'braco' | 'coxa' | 'peito';

const METRICAS: { chave: Metrica; label: string; campo: string; sufixo: string }[] = [
  { chave: 'peso', label: 'Peso', campo: 'peso_kg', sufixo: 'kg' },
  { chave: 'cintura', label: 'Cintura', campo: 'cintura_cm', sufixo: 'cm' },
  { chave: 'braco', label: 'Braço', campo: 'braco_cm', sufixo: 'cm' },
  { chave: 'peito', label: 'Peito', campo: 'peito_cm', sufixo: 'cm' },
  { chave: 'coxa', label: 'Coxa', campo: 'coxa_cm', sufixo: 'cm' },
];

export default function Evolucao() {
  const router = useRouter();
  const [metrica, setMetrica] = useState<Metrica>('peso');
  const [registrando, setRegistrando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, medidas, stats, porGrupo, porDia, cal, qtdMedidas, fotos] = await Promise.all([
      resumo(),
      historicoMedidas(90),
      estatisticas(),
      volumePorGrupo(30),
      treinosPorDia(28),
      historicoCalorias(14),
      contarMedidas(),
      estadoDaCadencia(),
    ]);
    return { r, medidas, stats, porGrupo, porDia, cal, qtdMedidas, fotos };
  }, []);

  if (!dados?.r) return <Screen titulo="Carregando…">{null}</Screen>;
  const { r, medidas, stats, porGrupo, porDia, cal } = dados;

  const conf = METRICAS.find((m) => m.chave === metrica)!;
  const serie = medidas
    .map((m) => ({ x: dataCurta(m.medido_em), y: (m as never as Record<string, number>)[conf.campo] }))
    .filter((p) => p.y != null);

  // Últimas 4 semanas de volume, para ver tendência de carga total.
  const semanas = agruparSemanas(porDia);
  const maxGrupo = Math.max(...porGrupo.map((g) => g.volume), 1);

  // Quatro semanas fechadas: a coluna 1 é sempre domingo, como diz o cabeçalho.
  const dias28 = semanasFechadas(4);
  const mapaDias = new Map(porDia.map((d) => [d.dia, d]));

  return (
    <Screen
      titulo="Evolução"
      subtitulo={`${stats.treinos} treinos · ${volume(stats.volume)} · ${stats.prs} recordes`}
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => setRegistrando(true)} style={s.btnAdd} scale={0.92}>
          <Ionicons name="add" size={20} color="#1A0800" />
        </Press>
      }
    >
      {/* ── Foto de progresso ──
          Fica antes do gráfico de propósito: em recomposição o peso pode ficar
          parado por meses enquanto o corpo muda, e quem só olha o número
          desiste antes de ver o resultado que já estava acontecendo. */}
      <Animated.View entering={FadeInDown.duration(280)} style={{ marginBottom: spacing.lg }}>
        <Card
          onPress={() => router.push('/progresso')}
          faixa={dados.fotos.naHora ? colors.primary : colors.border}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons
              name="camera"
              size={22}
              color={dados.fotos.naHora ? colors.primary : colors.textDim}
            />
            <View style={{ flex: 1 }}>
              <Txt v="body" bold>
                {dados.fotos.naHora ? 'Hora da foto de progresso' : 'Foto de progresso'}
              </Txt>
              <Txt v="small" cor={colors.textFaint} style={{ marginTop: 2, lineHeight: 17 }}>
                {dados.fotos.temFoto
                  ? dados.fotos.mensagem
                  : 'A medida que a balança não pega. Em recomposição, o peso mente e a foto não.'}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Card>
      </Animated.View>

      {/* ── Corpo ── */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Composição corporal</Txt>
        <View style={s.chips}>
          {METRICAS.map((m) => (
            <Chip
              key={m.chave}
              label={m.label}
              ativo={metrica === m.chave}
              onPress={() => setMetrica(m.chave)}
            />
          ))}
        </View>
        <Card>
          {serie.length ? (
            <Linha
              dados={serie}
              sufixo={conf.sufixo}
              cor={colors.primary}
              meta={metrica === 'peso' ? (r.perfil.peso_meta_kg ?? undefined) : undefined}
            />
          ) : (
            <Empty
              icone="body-outline"
              titulo={`Sem registro de ${conf.label.toLowerCase()}`}
              texto="Registre a medida para começar a acompanhar a evolução."
              acao={{ titulo: 'Registrar agora', onPress: () => setRegistrando(true) }}
            />
          )}
        </Card>

        {metrica === 'peso' ? (
          <Card>
            <View style={s.entre}>
              <View>
                <Txt v="label">IMC atual</Txt>
                <Txt v="small" cor={classificacaoImc(r.imcValor).cor}>
                  {classificacaoImc(r.imcValor).texto}
                </Txt>
              </View>
              <Txt v="h1" cor={classificacaoImc(r.imcValor).cor}>
                {num(r.imcValor, 1)}
              </Txt>
            </View>
          </Card>
        ) : null}
      </Animated.View>

      {/* ── Constância ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Constância — últimas 4 semanas</Txt>
        <Card>
          {/* Uma linha por semana, sempre 7 colunas.
              A versão anterior punha as 28 células numa única lista com quebra
              automática e largura fixa de 30 px: em tela larga cabiam 18 numa
              linha, e nenhuma coluna caía embaixo da letra do dia. Um mapa de
              calor semanal que não alinha com o dia da semana não informa nada. */}
          <View style={s.heatLinha}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <Txt key={i} v="small" size={10} cor={colors.textFaint} center style={{ flex: 1 }}>
                {d}
              </Txt>
            ))}
          </View>
          {[0, 1, 2, 3].map((semana) => (
            <View key={semana} style={s.heatLinha}>
              {dias28.slice(semana * 7, semana * 7 + 7).map((dia) => {
                const info = mapaDias.get(dia);
                const intensidade = info ? Math.min(1, info.volume / 6000) : 0;
                return (
                  <View
                    key={dia}
                    style={[
                      s.heatCel,
                      {
                        backgroundColor: info
                          ? `rgba(255, 90, 31, ${0.3 + intensidade * 0.7})`
                          : colors.surfaceHigh,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
          <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
            {porDia.length} treinos em 28 dias · quanto mais forte a cor, maior o volume
          </Txt>
        </Card>
      </Animated.View>

      {/* ── Volume por semana ── */}
      {semanas.length > 1 ? (
        <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Volume por semana</Txt>
          <Card>
            <Barras dados={semanas} cor={colors.info} sufixo="kg" />
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Volume por grupo ── */}
      {porGrupo.length ? (
        <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Volume por grupo — últimos 30 dias</Txt>
          <Card>
            <View style={{ gap: spacing.lg }}>
              {porGrupo.map((g) => (
                <View key={g.grupo} style={{ gap: 5 }}>
                  <View style={s.entre}>
                    <Txt v="small">{nomeGrupo(g.grupo)}</Txt>
                    <Txt v="small" cor={colors.textDim}>
                      {volume(g.volume)} · {g.series} séries
                    </Txt>
                  </View>
                  <Barra valor={g.volume / maxGrupo} cor={colors.primary} altura={6} />
                </View>
              ))}
            </View>
          </Card>
          <Txt v="small" cor={colors.textFaint}>
            Grupo com barra curta é o que está ficando para trás na sua rotina.
          </Txt>
        </Animated.View>
      ) : null}

      {/* ── Calorias ── */}
      {cal.length > 1 ? (
        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Calorias — últimos 14 dias</Txt>
          <Card>
            <Linha
              dados={cal.map((c) => ({ x: dataCurta(c.dia), y: Math.round(c.kcal) }))}
              sufixo="kcal"
              cor={colors.success}
              meta={r.meta.kcal}
              casas={0}
            />
            <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
              A linha tracejada é sua meta de {kcal(r.meta.kcal)} kcal.
            </Txt>
          </Card>
        </Animated.View>
      ) : null}

      <SheetMedidas
        aberto={registrando}
        onFechar={() => setRegistrando(false)}
        onSalvo={() => {
          setRegistrando(false);
          recarregar();
        }}
      />
    </Screen>
  );
}

function SheetMedidas({
  aberto,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const campos = [
    { k: 'peso_kg', label: 'Peso', sufixo: 'kg' },
    { k: 'gordura_pct', label: 'Gordura corporal', sufixo: '%' },
    { k: 'cintura_cm', label: 'Cintura', sufixo: 'cm' },
    { k: 'peito_cm', label: 'Peito', sufixo: 'cm' },
    { k: 'braco_cm', label: 'Braço', sufixo: 'cm' },
    { k: 'coxa_cm', label: 'Coxa', sufixo: 'cm' },
  ];

  async function salvar() {
    setSalvando(true);
    try {
      const dados: Record<string, number | undefined> = {};
      for (const c of campos) {
        const n = parseFloat((v[c.k] ?? '').replace(',', '.'));
        if (!Number.isNaN(n) && n > 0) dados[c.k] = n;
      }
      if (Object.keys(dados).length === 0) return;

      await salvarMedida(dados);
      // Peso novo muda TMB e TDEE — a meta de macros tem que acompanhar.
      if (dados.peso_kg) await recalcularMeta();
      await avaliarConquistas();
      buzz.ok();
      setV({});
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Registrar medidas" altura={0.88}>
      <View style={{ gap: spacing.lg }}>
        <Txt v="small">
          Preencha só o que quiser acompanhar. O registro é de {dataCurta(hoje())} e sobrescreve
          outro do mesmo dia.
        </Txt>
        {campos.map((c) => (
          <Input
            key={c.k}
            rotulo={c.label}
            sufixo={c.sufixo}
            placeholder="—"
            keyboardType="decimal-pad"
            value={v[c.k] ?? ''}
            onChangeText={(t) => setV((p) => ({ ...p, [c.k]: t }))}
          />
        ))}
        <Button titulo="Salvar" full tam="lg" onPress={salvar} carregando={salvando} />
      </View>
    </Sheet>
  );
}

/** Agrupa treinos em blocos de 7 dias, do mais antigo ao mais recente. */
function agruparSemanas(dias: { dia: string; volume: number }[]) {
  if (dias.length === 0) return [];
  const out: { x: string; y: number }[] = [];
  const hojeMs = Date.now();
  for (let semana = 3; semana >= 0; semana--) {
    const fim = hojeMs - semana * 7 * 86400000;
    const inicio = fim - 7 * 86400000;
    const total = dias
      .filter((d) => {
        const t = new Date(`${d.dia}T12:00:00`).getTime();
        return t > inicio && t <= fim;
      })
      .reduce((a, d) => a + d.volume, 0);
    out.push({ x: semana === 0 ? 'Agora' : `-${semana}sem`, y: Math.round(total) });
  }
  return out;
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  btnAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatLinha: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  heatCel: { flex: 1, aspectRatio: 1, borderRadius: 6, maxWidth: 44 },
});
