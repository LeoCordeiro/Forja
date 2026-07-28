import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  agendaSemanal,
  definirDia,
  distribuirAutomaticamente,
  HORAS_MINIMAS,
  oQueFazerHoje,
  type DiaDaAgenda,
} from '@/features/treino/agenda';
import { nomeDoGrupo } from '@/features/treino/volume';
import { regerarTreino } from '@/features/treino/gerador';
import { buzz } from '@/shared/utils/haptics';

/**
 * Agenda da semana: cada dia com dono.
 *
 * A tela existe para tornar visível uma coisa que só aparece quando dá errado:
 * a distância entre duas sessões do mesmo grupo. Aqui um conflito fica na
 * cara antes de virar três semanas de peito em dias seguidos.
 */
export default function Agenda() {
  const [refazendo, setRefazendo] = useState(false);
  const [refeito, setRefeito] = useState<string | null>(null);

  const { dados, recarregar } = useDados(async () => {
    const [semana, hoje] = await Promise.all([agendaSemanal(), oQueFazerHoje()]);
    return { semana, hoje, conflitos: acharConflitos(semana) };
  }, []);

  if (!dados) return <Tela titulo="Agenda">{null}</Tela>;
  const { semana, hoje, conflitos } = dados;
  const hojeIdx = new Date().getDay();

  return (
    <Tela titulo="Agenda da semana" subtitulo="Cada dia com dono" onRefresh={recarregar}>
      {/* ── O que fazer hoje ── */}
      <Animated.View entering={FadeInDown.duration(280)}>
        <Card faixa={hoje.remanejado ? colors.warn : colors.primary}>
          <View style={s.entre}>
            <Txt v="label">Hoje</Txt>
            {hoje.remanejado ? (
              <Txt v="small" size={11} cor={colors.warn} bold>
                remanejado
              </Txt>
            ) : null}
          </View>
          <Txt v="h2" size={20} style={{ marginTop: 2 }}>
            {hoje.titulo}
          </Txt>
          <Txt v="small" style={{ marginTop: spacing.sm }}>
            {hoje.motivo}
          </Txt>

          {hoje.atrasados.length ? (
            <View style={s.atrasados}>
              <Ionicons name="time-outline" size={14} color={colors.textFaint} />
              <Txt v="small" size={11} cor={colors.textFaint} style={{ flex: 1 }}>
                Ainda devendo esta semana: {hoje.atrasados.join(', ')}
              </Txt>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      {/* ── Conflitos ── */}
      {conflitos.length ? (
        <Card faixa={colors.danger} padding={spacing.md}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Txt v="h3" size={14} cor={colors.danger}>
                Mesmo músculo perto demais
              </Txt>
              {conflitos.map((c) => (
                <Txt key={c} v="small" size={11} cor={colors.danger} style={{ marginTop: 2 }}>
                  {c}
                </Txt>
              ))}
              <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 6 }}>
                A síntese proteica fica elevada por 24 a 48 h depois da sessão. Treinar de novo
                dentro dessa janela não soma estímulo — soma fadiga.
              </Txt>
            </View>
          </View>
        </Card>
      ) : null}

      {/* ── A semana ── */}
      <View style={{ gap: spacing.sm }}>
        <Txt v="label">Toque para mudar o dia</Txt>
        {semana.map((d) => (
          <LinhaDia key={d.diaSemana} d={d} hoje={d.diaSemana === hojeIdx} onMudar={recarregar} />
        ))}
      </View>

      <Button
        titulo="Distribuir automaticamente"
        icone="shuffle"
        variante="secundario"
        full
        onPress={async () => {
          await distribuirAutomaticamente();
          buzz.ok();
          recarregar();
        }}
      />
      <Txt v="small" size={11} cor={colors.textFaint}>
        Espalha os treinos em vez de amontoar: com 3, segunda/quarta/sexta. É a distribuição que
        maximiza a distância entre sessões do mesmo grupo.
      </Txt>

      {/* ── Refazer o plano inteiro ──────────────────────────────────────
          Mexer num dia resolve um dia. Quando o que mudou foi a vida — mudou
          de academia, ganhou ou perdeu um dia livre, começou a doer o ombro —
          o certo é refazer, não remendar. */}
      <Card style={{ marginTop: spacing.xl }} faixa={colors.warn}>
        <Txt v="h3" size={15}>
          Refazer meu treino
        </Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 4, lineHeight: 17 }}>
          Monta tudo de novo com as suas respostas atuais: divisão, exercícios, séries, descanso e o
          dia da semana de cada sessão. O histórico do que você já treinou não é apagado.
        </Txt>

        {refeito ? (
          <View style={s.refeito}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Txt v="small" size={11} cor={colors.success} style={{ flex: 1 }}>
              {refeito}
            </Txt>
          </View>
        ) : null}

        <Button
          titulo="Refazer com minhas respostas"
          icone="sparkles-outline"
          full
          carregando={refazendo}
          style={{ marginTop: spacing.md }}
          onPress={async () => {
            setRefazendo(true);
            try {
              const plano = await regerarTreino();
              if (plano) {
                setRefeito(
                  `${plano.divisao} — ${plano.dias.length} treinos, ` +
                    `${plano.dias.reduce((a, d) => a + d.exercicios.length, 0)} exercícios, já com dia marcado.`
                );
                buzz.ok();
              } else {
                setRefeito('Não achei suas respostas. Refaça o questionário no Perfil.');
              }
              recarregar();
            } finally {
              setRefazendo(false);
            }
          }}
        />
      </Card>
    </Tela>
  );
}

function LinhaDia({
  d,
  hoje,
  onMudar,
}: {
  d: DiaDaAgenda;
  hoje: boolean;
  onMudar: () => void;
}) {
  const cor =
    d.tipo === 'treino'
      ? colors.primary
      : d.tipo === 'cardio'
        ? colors.info
        : d.tipo === 'mobilidade'
          ? colors.success
          : colors.textFaint;

  return (
    <Card padding={spacing.md} style={hoje ? { borderColor: colors.primary } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={[s.dia, hoje && { backgroundColor: colors.primarySoft }]}>
          <Txt v="h3" size={13} cor={hoje ? colors.primary : colors.textDim}>
            {d.letra}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="h3" size={15} cor={d.tipo === 'descanso' ? colors.textFaint : colors.text}>
            {d.rotuloTreino ??
              (d.tipo === 'descanso' ? 'Descanso' : d.tipo === 'cardio' ? 'Cardio' : 'Mobilidade')}
          </Txt>
          <Txt v="small" size={11} cor={colors.textFaint}>
            {d.nome}
            {d.grupos.length ? ` · ${d.grupos.map(nomeDoGrupo).join(', ')}` : ''}
          </Txt>
        </View>
        <View style={[s.ponto, { backgroundColor: cor }]} />
      </View>
    </Card>
  );
}

/**
 * Dois dias com o mesmo grupo a menos de 48 h de distância.
 *
 * Olha a semana em círculo: domingo e segunda são consecutivos, e é
 * exatamente aí que o conflito costuma passar despercebido.
 */
function acharConflitos(semana: DiaDaAgenda[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = semana[i];
    const b = semana[(i + 1) % 7];
    if (!a.grupos.length || !b.grupos.length) continue;
    const comuns = a.grupos.filter((g) => b.grupos.includes(g));
    if (comuns.length) {
      out.push(
        `${a.nome} e ${b.nome} treinam ${comuns.map(nomeDoGrupo).join(' e ')} — menos de ${HORAS_MINIMAS} h de intervalo.`
      );
    }
  }
  return out;
}

const s = StyleSheet.create({
  refeito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
  },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dia: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  atrasados: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
