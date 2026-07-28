import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Chip, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { lerTempoPorDia, resumo, salvarPerfil, salvarTempoPorDia } from '@/features/perfil/api';
import { REGIOES_DOR } from '@/features/perfil/diagnostico';
import { OPCOES_EQUIPAMENTO } from '@/features/treino/equipamento';
import { LOCAIS, type LocalTreino } from '@/features/treino/local';
import { divisaoDe, gerarEAplicar, gruposEnfatizados, type Plano } from '@/features/treino/gerador';
import { buzz } from '@/shared/utils/haptics';

/**
 * Refazer o treino sem apagar nada.
 *
 * ── Por que uma tela só para isto ────────────────────────────────────────
 *
 * Quem fez o cadastro antes de o gerador existir tem um perfil sem as respostas
 * que hoje decidem o treino: quais dias, onde treina, quanto tempo tem, o que
 * quer priorizar. Regenerar com esse perfil produz um plano montado em cima de
 * valores padrão — que é justamente o treino genérico que queríamos matar.
 *
 * A alternativa seria mandar apagar tudo e refazer o cadastro, e aí a pessoa
 * perde meses de histórico para responder seis perguntas. Aqui ela responde só
 * o que mudou, e séries, medidas, fotos e medalhas ficam onde estão.
 */

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TEMPOS = [
  { v: 50, l: '50 min' },
  { v: 60, l: '1 h' },
  { v: 75, l: '1h15' },
  { v: 90, l: '1h30' },
  { v: 120, l: '2 h' },
];

const FOCOS: { v: string | null; l: string }[] = [
  { v: null, l: 'Equilibrado' },
  { v: 'inferior', l: 'Inferiores' },
  { v: 'superior', l: 'Superiores' },
  { v: 'gluteo', l: 'Glúteo' },
  { v: 'quadriceps', l: 'Perna' },
  { v: 'peito', l: 'Peito' },
  { v: 'costas', l: 'Costas' },
  { v: 'ombro', l: 'Ombro' },
  { v: 'biceps', l: 'Braço' },
  { v: 'abdomen', l: 'Abdômen' },
];

export default function RefazerTreino() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [plano, setPlano] = useState<Plano | null>(null);

  const [dias, setDias] = useState<number[]>([1, 3, 5]);
  const [local, setLocal] = useState<LocalTreino>('academia');
  const [minutos, setMinutos] = useState(75);
  const [equipamento, setEquipamento] = useState('ambos');
  const [focos, setFocos] = useState<string[]>([]);
  const [dores, setDores] = useState<string[]>([]);

  // Carrega o que já está gravado uma única vez, para a tela abrir com as
  // respostas atuais em vez de pedir tudo de novo do zero.
  useDados(async () => {
    const r = await resumo();
    if (r && !pronto) {
      const p = r.perfil;
      const marcados = (p.dias_disponiveis ?? '')
        .split(',')
        .map((x) => parseInt(x, 10))
        .filter((n) => n >= 0 && n <= 6);
      if (marcados.length) setDias(marcados);
      if (p.local_treino) setLocal(p.local_treino as LocalTreino);
      if (p.preferencia_equipamento) setEquipamento(p.preferencia_equipamento);
      if (p.enfase) setFocos(p.enfase.split(',').filter(Boolean));
      if (p.dores) setDores(p.dores.split(',').filter(Boolean));
      const t = lerTempoPorDia(p.minutos_por_dia);
      setMinutos(t[1] ?? 75);
      setPronto(true);
    }
    return { r };
  }, []);

  async function gerar() {
    if (!dias.length) return;
    setGerando(true);
    try {
      const porDia = Array.from({ length: 7 }, (_, i) =>
        i === 0 || i === 6 ? Math.round(minutos * 1.2) : minutos
      );
      await salvarPerfil({
        ...(await resumo())!.perfil,
        dias_treino_semana: dias.length,
        dias_disponiveis: dias.join(','),
        local_treino: local,
        preferencia_equipamento: equipamento,
        enfase: focos.join(','),
        dores: dores.join(','),
      });
      await salvarTempoPorDia(porDia);

      const p = await gerarEAplicar({
        dias: dias.length,
        diasDisponiveis: dias,
        minutosPorDia: porDia,
        experiencia: (await resumo())!.perfil.experiencia,
        objetivo: (await resumo())!.perfil.objetivo,
        local,
        preferenciaEquipamento: equipamento,
        dores,
        focos,
      });
      setPlano(p);
      buzz.ok();
    } finally {
      setGerando(false);
    }
  }

  const nGrupos = gruposEnfatizados(focos).size;

  if (plano) {
    return (
      <Tela titulo="Treino refeito" subtitulo={plano.divisao}>
        <Animated.View entering={FadeInDown.duration(280)}>
          <Card faixa={colors.success}>
            <View style={s.linha}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Txt v="h3" style={{ flex: 1 }}>
                {plano.dias.length} treinos, já com dia marcado
              </Txt>
            </View>
            <Txt v="small" cor={colors.textFaint} style={{ marginTop: 6, lineHeight: 18 }}>
              {plano.porque}
            </Txt>
          </Card>
        </Animated.View>

        {plano.dias.map((d, i) => (
          <Animated.View key={d.nome} entering={FadeInDown.delay(60 + i * 40).duration(280)}>
            <Card faixa={d.cor} padding={spacing.md} style={{ marginTop: spacing.sm }}>
              <View style={s.entre}>
                <View style={{ flex: 1 }}>
                  <Txt v="small" size={10} cor={colors.textFaint} bold>
                    {d.diaSemana === null ? 'SEM DIA' : NOMES_DIA[d.diaSemana].toUpperCase()}
                  </Txt>
                  <Txt v="h3" size={15}>
                    {d.nome}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {d.exercicios.length} exercícios · ~{d.minutos} min
                  </Txt>
                </View>
              </View>
            </Card>
          </Animated.View>
        ))}

        {plano.avisos.length > 0 && (
          <Card faixa={colors.warn} style={{ marginTop: spacing.lg }}>
            <Txt v="label">O que o app ajustou</Txt>
            {plano.avisos.map((a) => (
              <Txt key={a} v="small" cor={colors.textFaint} style={{ marginTop: 6, lineHeight: 18 }}>
                {a}
              </Txt>
            ))}
          </Card>
        )}

        <Button
          titulo="Ver meus treinos"
          icone="barbell-outline"
          full
          tam="lg"
          style={{ marginTop: spacing.lg }}
          onPress={() => router.replace('/treino')}
        />
      </Tela>
    );
  }

  return (
    <Tela titulo="Refazer meu treino" subtitulo="Seis perguntas, nada é apagado">
      <Card faixa={colors.info} padding={spacing.md}>
        <Txt v="small" style={{ lineHeight: 19 }}>
          Séries, medidas, fotos e medalhas continuam onde estão. O que muda é o plano de treino:
          divisão, exercícios, séries e o dia da semana de cada sessão.
        </Txt>
      </Card>

      {/* ── Dias ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        Em quais dias você consegue treinar?
      </Txt>
      <View style={s.linhaChips}>
        {NOMES_DIA.map((d, i) => (
          <Press
            key={i}
            onPress={() => {
              buzz.leve();
              setDias((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort((a, b) => a - b)));
            }}
            style={[s.dia, dias.includes(i) && s.diaAtivo]}
          >
            <Txt v="small" bold cor={dias.includes(i) ? '#1A0800' : colors.textDim}>
              {d}
            </Txt>
          </Press>
        ))}
      </View>
      <Txt v="small" size={11} cor={colors.textFaint}>
        {dias.length ? `${divisaoDe(dias.length).nome} — ${divisaoDe(dias.length).porque}` : 'Marque pelo menos um dia.'}
      </Txt>

      {/* ── Local ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        Onde você treina?
      </Txt>
      <View style={{ gap: spacing.sm }}>
        {LOCAIS.map((l) => (
          <Card key={l.chave} onPress={() => setLocal(l.chave)} destaque={local === l.chave} padding={spacing.md}>
            <View style={s.entre}>
              <View style={{ flex: 1 }}>
                <Txt v="body" size={14}>
                  {l.emoji}  {l.label}
                </Txt>
                <Txt v="small" size={11} cor={colors.textFaint}>
                  {l.descricao}
                </Txt>
              </View>
              {local === l.chave && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </View>
          </Card>
        ))}
      </View>

      {/* ── Tempo ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        Quanto tempo por sessão?
      </Txt>
      <View style={s.linhaChips}>
        {TEMPOS.map((t) => (
          <Chip key={t.v} label={t.l} ativo={minutos === t.v} onPress={() => setMinutos(t.v)} />
        ))}
      </View>

      {/* ── Equipamento ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        Máquina ou peso livre?
      </Txt>
      <View style={s.linhaChips}>
        {OPCOES_EQUIPAMENTO.map((o) => (
          <Chip
            key={o.chave}
            label={o.label}
            ativo={equipamento === o.chave}
            onPress={() => setEquipamento(o.chave)}
          />
        ))}
      </View>

      {/* ── Foco ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        O que você quer priorizar?
      </Txt>
      <Txt v="small" size={11} cor={colors.textFaint} style={{ marginBottom: spacing.sm }}>
        Pode marcar mais de um. Até três.
      </Txt>
      <View style={s.linhaChips}>
        {FOCOS.map((f) => (
          <Chip
            key={f.l}
            label={f.l}
            ativo={f.v === null ? focos.length === 0 : focos.includes(f.v)}
            onPress={() => {
              buzz.leve();
              if (f.v === null) return setFocos([]);
              setFocos((v) =>
                v.includes(f.v!) ? v.filter((x) => x !== f.v) : v.length >= 3 ? v : [...v, f.v!]
              );
            }}
          />
        ))}
      </View>
      {focos.length > 0 && (
        <Txt v="small" size={11} cor={colors.textFaint}>
          {nGrupos} grupo{nGrupos > 1 ? 's' : ''} priorizado{nGrupos > 1 ? 's' : ''}: +
          {Math.max(1, Math.min(4, Math.round(16 / nGrupos)))} séries por semana em cada um, tiradas
          de quem não foi escolhido — nunca abaixo do mínimo em que o músculo ainda responde.
        </Txt>
      )}

      {/* ── Dores ── */}
      <Txt v="label" style={{ marginTop: spacing.lg }}>
        Sente dor em alguma dessas regiões?
      </Txt>
      <View style={s.linhaChips}>
        {REGIOES_DOR.map((r) => (
          <Chip
            key={r.chave}
            label={r.label}
            ativo={dores.includes(r.chave)}
            onPress={() =>
              setDores((v) => (v.includes(r.chave) ? v.filter((x) => x !== r.chave) : [...v, r.chave]))
            }
          />
        ))}
      </View>

      <Button
        titulo={gerando ? 'Montando…' : 'Montar meu treino'}
        icone="sparkles-outline"
        full
        tam="lg"
        carregando={gerando}
        desabilitado={!dias.length}
        style={{ marginTop: spacing.xl }}
        onPress={() => void gerar()}
      />
    </Tela>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linhaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  dia: {
    flex: 1,
    minWidth: 44,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
});
