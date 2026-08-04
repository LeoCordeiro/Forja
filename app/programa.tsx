import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Barra, Card, Empty, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo } from '@/features/perfil/api';
import { rotinaAtiva } from '@/features/treino/api';
import {
  ALVO_SERIES,
  auditarVolume,
  nomeDoGrupo,
  TETO_UTIL,
  type VolumeGrupo,
} from '@/features/treino/volume';
import {
  BLOCO,
  blocoVencido,
  diasRestantes,
  faseAtual,
  faseDaSemanaDoBloco,
  objetivoDoBloco,
  SEMANAS_DO_BLOCO,
  semanaDoBloco,
} from '@/features/treino/programa';
import { textoAjusteDaFase } from '@/features/treino/periodizacao';
import {
  AVISO_EQUIPAMENTO,
  OPCOES_EQUIPAMENTO,
  type PreferenciaEquipamento,
} from '@/features/treino/equipamento';
import { definirPreferenciaEquipamento } from '@/features/perfil/api';
import {
  mapaDeRecuperacao,
  ROTULO_ESTADO,
  sugerirFoco,
  type RecuperacaoGrupo,
} from '@/features/treino/recuperacao';
import { hoje } from '@/shared/utils/date';
import { buzz } from '@/shared/utils/haptics';

/**
 * "Este treino traz resultado?" — a tela que responde.
 *
 * Duas perguntas que o app não respondia: por que ESTA rotina serve para o meu
 * objetivo, e por quanto tempo eu fico nela. Sem as duas, treinar vira
 * repetição sem critério de sucesso.
 */
export default function Programa() {
  const [pref, setPref] = useState<PreferenciaEquipamento>('ambos');

  const { dados, recarregar } = useDados(async () => {
    const [r, rotina] = await Promise.all([resumo(), rotinaAtiva()]);
    const audit = rotina ? await auditarVolume(rotina.id) : null;
    const recup = await mapaDeRecuperacao();
    return { r, rotina, audit, recup, foco: sugerirFoco(recup) };
  }, []);

  useEffect(() => {
    const p = dados?.r?.perfil.preferencia_equipamento;
    if (p) setPref(p as PreferenciaEquipamento);
  }, [dados]);

  if (!dados?.r || !dados.rotina || !dados.audit) {
    return (
      <Tela titulo="Seu programa">
        <Empty
          icone="barbell-outline"
          titulo="Nenhuma rotina ativa"
          texto="Crie ou ative uma rotina para ver a auditoria do programa."
        />
      </Tela>
    );
  }

  const { r, rotina, audit } = dados;
  const objetivo = objetivoDoBloco(r.perfil.objetivo, r.pesoKg, r.gorduraPct ?? null);
  const inicio = rotina.criado_em ? new Date(rotina.criado_em).toISOString().slice(0, 10) : null;
  const semana = semanaDoBloco(inicio, hoje());
  const fase = faseAtual(semana);
  const vencido = blocoVencido(semana);
  const restam = diasRestantes(inicio, hoje());

  return (
    <Tela titulo="Seu programa" subtitulo={rotina.nome} onRefresh={recarregar}>
      {/* ── Objetivo ── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card faixa={colors.primary}>
          <Txt v="label">O que este treino busca</Txt>
          <Txt v="h2" size={19} style={{ marginTop: 2 }}>
            {objetivo.titulo}
          </Txt>
          <Txt v="small" style={{ marginTop: spacing.sm }}>
            {objetivo.porque}
          </Txt>

          <Txt v="label" style={{ marginTop: spacing.lg }}>
            Como saber que está funcionando
          </Txt>
          {objetivo.comoMedir.map((m) => (
            <View key={m} style={s.item}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Txt v="small" size={12} style={{ flex: 1 }}>
                {m}
              </Txt>
            </View>
          ))}

          <View style={s.naoEsperar}>
            <Ionicons name="information-circle" size={15} color={colors.warn} />
            <View style={{ flex: 1 }}>
              <Txt v="small" size={11} cor={colors.warn} bold>
                O QUE NÃO ESPERAR
              </Txt>
              <Txt v="small" size={12} cor={colors.warn}>
                {objetivo.naoEsperar}
              </Txt>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ── Onde você está no bloco ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)}>
        <Card>
          <View style={s.entre}>
            {/* ── Bloco vencido para de fingir semana 8 (M1) ────────────────
                `semanaDoBloco` grampeava em 8 e `resolverFase` não: a partir do
                dia 57 esta tela dizia para sempre "Semana 8 de 8 · Aliviar ·
                volume 55%" enquanto o executor — do lado certo — já não
                modulava nada. Uma tela mandava aliviar e a outra treinava
                normal, sobre o mesmo dia. Agora a semana é a de verdade e o
                estado "venceu" tem cara própria. */}
            <Txt v="label">
              {vencido ? `Semana ${semana} — bloco vencido` : `Semana ${semana} de ${SEMANAS_DO_BLOCO}`}
            </Txt>
            <Txt v="small" cor={restam > 0 ? colors.textDim : colors.warn} bold>
              {restam > 0 ? `faltam ${restam} dias` : 'bloco fechado'}
            </Txt>
          </View>
          <Barra valor={Math.min(1, semana / SEMANAS_DO_BLOCO)} cor={colors.primary} />

          <Txt v="h3" style={{ marginTop: spacing.md }}>
            {vencido ? 'Sem fase ativa' : fase.titulo}
          </Txt>
          <Txt v="small" style={{ marginTop: 2 }}>
            {vencido
              ? 'O bloco de 8 semanas terminou, então o treino roda sem modulação: volume e esforço ' +
                'cheios, como o plano prescreve em cada linha. Recomeçar o bloco devolve a progressão ' +
                'semana a semana.'
              : fase.o_que_fazer}
          </Txt>
          <View style={s.tags}>
            {!vencido ? <Tag icone="repeat" texto={`volume ${fase.volumePct}%`} /> : null}
            {/* ── Direção, não número (M3-texto) ────────────────────────────
                Era `parar a ${fase.rir} da falha`, e `fase.rir` é o campo cru
                da semana do bloco: "3" na semana 1, "4" na semana 8. Ao lado,
                cada linha do treino mostra o RIR do PAPEL dela — 1-2 no
                principal, 0-2 no isolador, 0-1 no finalizador. O card afirmava
                um número que nenhuma linha da tela seguinte confirmava.
                Não existe número certo aqui: o que a fase faz é afrouxar (ou
                não) o alvo de cada exercício. Nas semanas que não afrouxam
                nada, a tag some — repetir o alvo da linha no topo é ruído. */}
            {!vencido && textoAjusteDaFase(faseDaSemanaDoBloco(fase, semana)) ? (
              <Tag
                icone="flame-outline"
                texto={textoAjusteDaFase(faseDaSemanaDoBloco(fase, semana))}
              />
            ) : null}
          </View>

          {restam <= 0 ? (
            <View style={s.fim}>
              <Txt v="small" size={12} cor={colors.warn}>
                Bloco de {SEMANAS_DO_BLOCO} semanas cumprido. Hora de trocar os exercícios que
                pararam de evoluir — não a rotina inteira — e recomeçar da semana 1 com as cargas
                de agora.
              </Txt>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Auditoria de volume ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)}>
        <Card faixa={audit.suficiente ? colors.success : colors.warn}>
          <View style={s.entre}>
            <Txt v="label">Volume semanal por músculo</Txt>
            <Txt v="small" cor={audit.suficiente ? colors.success : colors.warn} bold>
              {audit.suficiente ? 'suficiente' : 'tem buraco'}
            </Txt>
          </View>
          <Txt v="small" size={11} cor={colors.textFaint} style={{ marginBottom: spacing.sm }}>
            Alvo de {ALVO_SERIES} séries por grupo por semana. Série de exercício em que o músculo
            só ajuda conta como meia.
          </Txt>

          {audit.grupos
            .filter((x) => x.series >= 1)
            .map((v) => (
              <LinhaVolume key={v.grupo} v={v} />
            ))}

          {audit.alertas.map((a) => (
            <View key={a} style={s.alerta}>
              <Ionicons name="alert-circle" size={15} color={colors.warn} />
              <Txt v="small" size={12} cor={colors.warn} style={{ flex: 1 }}>
                {a}
              </Txt>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Recuperação por músculo ── */}
      <Animated.View entering={FadeInDown.delay(140).duration(300)}>
        <Card>
          <Txt v="label">Recuperação por músculo</Txt>
          <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 2 }}>
            Estimativa a partir do seu histórico de séries — não é medição. Serve para não
            empilhar o mesmo grupo em dias seguidos sem perceber; o que o corpo diz continua
            valendo mais.
          </Txt>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {(dados.recup ?? [])
              .filter((m) => m.horasDesde !== null)
              .map((m) => (
                <View key={m.grupo} style={{ gap: 3 }}>
                  <View style={s.entre}>
                    <Txt v="small" size={12}>
                      {nomeDoGrupo(m.grupo)}
                      <Txt v="small" size={11} cor={colors.textFaint}>
                        {'  '}
                        {m.horasDesde! < 24
                          ? `há ${m.horasDesde}h`
                          : `há ${Math.round(m.horasDesde! / 24)}d`}
                      </Txt>
                    </Txt>
                    <Txt v="small" size={11} cor={corRecup(m.estado)} bold>
                      {ROTULO_ESTADO[m.estado]}
                    </Txt>
                  </View>
                  <Barra valor={m.pronto} cor={corRecup(m.estado)} />
                </View>
              ))}

            {(dados.recup ?? []).every((m) => m.horasDesde === null) ? (
              <Txt v="small" size={12} cor={colors.textFaint}>
                Sem treino registrado ainda. O mapa aparece depois da primeira sessão.
              </Txt>
            ) : null}
          </View>

          {dados.foco ? (
            <View style={s.sugestao}>
              <Ionicons name="bulb" size={15} color={colors.warn} />
              <Txt v="small" size={12} cor={colors.warn} style={{ flex: 1 }}>
                Mais descansado e há mais tempo sem estímulo: {nomeDoGrupo(dados.foco)}. Bom
                candidato para o treino de hoje.
              </Txt>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Preferência de equipamento ── */}
      <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ gap: spacing.sm }}>
        <Txt v="label">Máquina ou peso livre</Txt>
        {OPCOES_EQUIPAMENTO.map((o) => (
          <Card
            key={o.chave}
            padding={spacing.md}
            destaque={pref === o.chave}
            onPress={async () => {
              setPref(o.chave);
              await definirPreferenciaEquipamento(o.chave);
              buzz.ok();
            }}
          >
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Txt size={22}>{o.emoji}</Txt>
              <View style={{ flex: 1 }}>
                <Txt v="h3" size={15}>
                  {o.label}
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {o.descricao}
                </Txt>
              </View>
              {pref === o.chave ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : null}
            </View>
          </Card>
        ))}
        <Txt v="small" size={11} cor={colors.textFaint}>
          {AVISO_EQUIPAMENTO}
        </Txt>
      </Animated.View>

      {/* ── Bloco completo ── */}
      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ gap: spacing.sm }}>
        <Txt v="label">As {SEMANAS_DO_BLOCO} semanas</Txt>
        {BLOCO.map((b) => (
          <Card
            key={b.semana}
            padding={spacing.md}
            style={b.semana === semana ? { borderColor: colors.primary } : undefined}
          >
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={[s.numSemana, b.semana === semana && s.numSemanaAtiva]}>
                <Txt v="small" bold cor={b.semana === semana ? colors.primary : colors.textFaint}>
                  {b.semana}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3" size={14}>
                  {b.titulo}
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {b.o_que_fazer}
                </Txt>
              </View>
            </View>
          </Card>
        ))}
      </Animated.View>

      {/* ── De onde vêm os números ── */}
      <Card padding={spacing.md}>
        <Txt v="label">De onde vêm estes números</Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 4 }}>
          Position Stand do ACSM de 2026 — primeira atualização em 17 anos, síntese de 137 revisões
          sistemáticas: volume semanal por grupo é o motor da hipertrofia, com ~10 séries como
          piso, e todo grupo treinado pelo menos 2× por semana.
        </Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
          Meta-regressão de dose-resposta (Sports Medicine, 2026 — 67 estudos, 2.058 participantes):
          hipertrofia sobe com volume, com retorno decrescente; frequência quase não muda
          hipertrofia, mas muda força.
        </Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
          Semana 8 reduz volume em vez de parar porque Coleman (2024) testou uma semana inteira sem
          treinar no meio de um programa: piorou força de perna e não trouxe nada para hipertrofia.
        </Txt>
      </Card>
    </Tela>
  );
}

function corRecup(e: RecuperacaoGrupo['estado']) {
  return e === 'pronto'
    ? colors.success
    : e === 'quase'
      ? colors.info
      : e === 'cansado'
        ? colors.warn
        : colors.danger;
}

function LinhaVolume({ v }: { v: VolumeGrupo }) {
  const cor =
    v.situacao === 'baixo' ? colors.warn : v.situacao === 'alto' ? colors.info : colors.success;
  return (
    <View style={{ gap: 3, marginBottom: spacing.sm }}>
      <View style={s.entre}>
        <Txt v="small" size={12}>
          {nomeDoGrupo(v.grupo)}
          <Txt v="small" size={11} cor={colors.textFaint}>
            {'  '}
            {v.frequencia}× por semana
          </Txt>
        </Txt>
        <Txt v="small" size={12} cor={cor} bold>
          {String(v.series).replace('.', ',')} séries
        </Txt>
      </View>
      <Barra valor={Math.min(1, v.series / TETO_UTIL)} cor={cor} />
    </View>
  );
}

function Tag({ icone, texto }: { icone: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View style={s.tag}>
      <Ionicons name={icone} size={11} color={colors.textDim} />
      <Txt v="small" size={10} cor={colors.textDim} bold>
        {texto}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: 6 },
  naoEsperar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  alerta: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  tags: { flexDirection: 'row', gap: 6, marginTop: spacing.md, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
  },
  sugestao: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  fim: {
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  numSemana: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numSemanaAtiva: { backgroundColor: colors.primarySoft },
});
