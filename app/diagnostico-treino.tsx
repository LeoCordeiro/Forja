import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { resumo } from '@/features/perfil/api';
import { detectarTravados, evoluindo, type Travado } from '@/features/treino/estagnacao';
import { rotinaAtiva } from '@/features/treino/api';
import { semanaDoBloco } from '@/features/treino/programa';
import { sonoRecente } from '@/features/rotina/api';
import { hoje } from '@/shared/utils/date';
import { peso as fmtPeso } from '@/shared/utils/format';
import {
  baixarBackup,
  diasDesdeBackup,
  gerarBackup,
  precisaBackup,
  resumirBackup,
} from '@/features/backup/api';
import { buzz } from '@/shared/utils/haptics';

/**
 * Diagnóstico do treino: o que travou, o que está subindo, e o backup.
 *
 * Junta três coisas que só fazem sentido lado a lado — o que não anda, o que
 * anda, e a garantia de que nada disso some.
 */
export default function DiagnosticoTreino() {
  const [baixando, setBaixando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, rotina, sono] = await Promise.all([resumo(), rotinaAtiva(), sonoRecente(14)]);
    const inicio = rotina?.criado_em
      ? new Date(rotina.criado_em).toISOString().slice(0, 10)
      : null;

    const horas = sono.map((x) => x.horas).filter((h: number) => h > 0);
    const media = horas.length ? horas.reduce((a: number, b: number) => a + b, 0) / horas.length : null;

    const travados = await detectarTravados({
      emDeficit: r?.perfil.objetivo === 'emagrecimento' || r?.perfil.objetivo === 'recomposicao',
      horasSonoMedia: media,
      semanaDoBloco: semanaDoBloco(inicio, hoje()),
      // Sem histórico detalhado de refeição, assume que está ok e não acusa
      // proteína à toa — culpar sem dado é pior que não falar.
      proteinaOk: true,
    });

    const sobe = await evoluindo(60);
    const bkp = await gerarBackup();
    return { travados, sobe, resumoBkp: resumirBackup(bkp), diasBkp: diasDesdeBackup() };
  }, []);

  return (
    <Tela titulo="Como vai o treino" subtitulo="O que travou, o que sobe e o backup" onRefresh={recarregar}>
      {/* ── Backup ── */}
      <Animated.View entering={FadeInDown.duration(280)}>
        <Card faixa={precisaBackup() ? colors.danger : colors.success}>
          <View style={s.entre}>
            <Txt v="label">Cópia dos seus dados</Txt>
            <Txt
              v="small"
              cor={precisaBackup() ? colors.danger : colors.success}
              bold
            >
              {dados?.diasBkp === null
                ? 'nunca feita'
                : `há ${dados?.diasBkp} dia${dados?.diasBkp === 1 ? '' : 's'}`}
            </Txt>
          </View>

          <Txt v="small" style={{ marginTop: 6 }}>
            Tudo fica só no seu aparelho — sem nuvem, sem conta, ninguém vê. O preço disso aparece
            no pior dia: <Txt v="small" bold>limpar os dados do navegador apaga tudo</Txt>, e não
            existe cópia em lugar nenhum.
          </Txt>
          <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
            No iPhone o risco é maior: o Safari descarta armazenamento de sites que ficam semanas
            sem abrir. Instalado na tela inicial resiste mais, mas não é imune.
          </Txt>

          {dados ? (
            <View style={s.numeros}>
              <Num label="Treinos" valor={dados.resumoBkp.treinos} />
              <Num label="Séries" valor={dados.resumoBkp.series} />
              <Num label="Medidas" valor={dados.resumoBkp.medidas} />
              <Num label="Recordes" valor={dados.resumoBkp.recordes} />
            </View>
          ) : null}

          <Button
            titulo="Baixar cópia agora"
            icone="download-outline"
            full
            tam="lg"
            carregando={baixando}
            style={{ marginTop: spacing.md }}
            onPress={async () => {
              setBaixando(true);
              try {
                const ok = await baixarBackup();
                if (ok) buzz.ok();
                recarregar();
              } finally {
                setBaixando(false);
              }
            }}
          />
          <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 6 }}>
            Um arquivo só. Guarde no Drive, no e-mail, onde for — e refaça uma vez por mês.
          </Txt>
        </Card>
      </Animated.View>

      {/* ── Travados ── */}
      {dados?.travados.length ? (
        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: spacing.sm }}>
          <Txt v="label">Parados há 3 sessões ou mais</Txt>
          {dados.travados.map((t) => (
            <CardTravado key={t.exerciseId} t={t} />
          ))}
        </Animated.View>
      ) : dados ? (
        <Card faixa={colors.success} padding={spacing.md}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Ionicons name="trending-up" size={22} color={colors.success} />
            <Txt v="small" style={{ flex: 1 }}>
              Nenhum exercício parado há 3 sessões. Sem histórico suficiente ainda, ou está tudo
              andando — nos dois casos, siga.
            </Txt>
          </View>
        </Card>
      ) : null}

      {/* ── Evoluindo ── */}
      {dados?.sobe.length ? (
        <Animated.View entering={FadeInDown.delay(120).duration(280)}>
          <Card faixa={colors.success}>
            <Txt v="label">O que está subindo</Txt>
            <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 2 }}>
              Só cobrança desanima. Estes ganharam carga nos últimos 60 dias.
            </Txt>
            {dados.sobe.map((e) => (
              <View key={e.nome} style={s.sobe}>
                <Ionicons name="arrow-up-circle" size={16} color={colors.success} />
                <Txt v="small" size={12} style={{ flex: 1 }}>
                  {e.nome}
                </Txt>
                <Txt v="h3" size={14} cor={colors.success}>
                  +{e.ganhoPct}%
                </Txt>
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}
    </Tela>
  );
}

function CardTravado({ t }: { t: Travado }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Card faixa={colors.warn} padding={spacing.md} onPress={() => setAberto((a) => !a)}>
      <View style={s.entre}>
        <View style={{ flex: 1 }}>
          <Txt v="h3" size={15}>
            {t.nome}
          </Txt>
          <Txt v="small" size={11} cor={colors.textFaint}>
            {fmtPeso(t.cargaAtual)} kg × {t.repsAtual} · {t.sessoes} sessões · {t.diasNoMesmoPeso}{' '}
            dias
          </Txt>
        </View>
        <Ionicons
          name={aberto ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textFaint}
        />
      </View>

      {aberto ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <View style={s.bloco}>
            <Txt v="small" size={10} cor={colors.textFaint} bold>
              CAUSA MAIS PROVÁVEL
            </Txt>
            <Txt v="small" size={12}>
              {t.causaProvavel}
            </Txt>
          </View>
          <View style={[s.bloco, { backgroundColor: colors.successSoft }]}>
            <Txt v="small" size={10} cor={colors.success} bold>
              O QUE FAZER
            </Txt>
            <Txt v="small" size={12} cor={colors.success}>
              {t.acao}
            </Txt>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Num({ label, valor }: { label: string; valor: number }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="small" size={10} cor={colors.textFaint}>
        {label}
      </Txt>
      <Txt v="h3" size={17}>
        {valor}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numeros: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bloco: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 2 },
  sobe: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
