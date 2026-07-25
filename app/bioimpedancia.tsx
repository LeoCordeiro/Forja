import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Ajuda, Button, Card, Input, Press, Screen, Txt } from '@/shared/ui';
import { TituloComAjuda } from '@/shared/ui/Ajuda';
import { AJUDA } from '@/shared/ajudas';
import { useDados } from '@/shared/hooks/useDados';
import { recalcularMeta, resumo, salvarMedida, ultimaBioimpedancia } from '@/features/perfil/api';
import { avaliarConquistas } from '@/features/gamificacao/api';
import {
  avaliarRecomposicao,
  classificarGordura,
  classificarVisceral,
  composicao,
} from '@/features/perfil/recomposicao';
import { dataCurta, hoje } from '@/shared/utils/date';
import { num } from '@/shared/utils/format';
import { buzz } from '@/shared/utils/haptics';

/**
 * Registro de bioimpedância.
 *
 * Vale uma tela própria porque o exame entrega de uma vez o que a balança
 * nunca dá: gordura, visceral, músculo e o TMB medido — e é esse conjunto que
 * mostra se a recomposição está funcionando.
 */
export default function Bioimpedancia() {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [r, ultima] = await Promise.all([resumo(), ultimaBioimpedancia()]);
    return { r, ultima };
  }, []);

  const campos = [
    { k: 'peso_kg', label: 'Peso', sufixo: 'kg', ajuda: null },
    { k: 'gordura_pct', label: 'Gordura corporal', sufixo: '%', ajuda: AJUDA.gorduraCorporal },
    { k: 'gordura_visceral', label: 'Gordura visceral', sufixo: '', ajuda: AJUDA.gorduraVisceral },
    { k: 'musculo_pct', label: 'Músculo esquelético', sufixo: '%', ajuda: AJUDA.musculoEsqueletico },
    { k: 'tmb_kcal', label: 'Metabolismo basal', sufixo: 'kcal', ajuda: AJUDA.tmb },
    { k: 'idade_corporal', label: 'Idade corporal', sufixo: 'anos', ajuda: null },
    { k: 'agua_pct', label: 'Água corporal', sufixo: '%', ajuda: null },
  ];

  async function salvar() {
    setSalvando(true);
    try {
      const m: Record<string, number> = {};
      for (const c of campos) {
        const n = parseFloat((v[c.k] ?? '').replace(',', '.'));
        if (!Number.isNaN(n) && n > 0) m[c.k] = n;
      }
      if (Object.keys(m).length === 0) return;

      await salvarMedida({ ...m, origem: 'bioimpedancia' });
      // TMB medido muda o TDEE, que muda a meta inteira.
      await recalcularMeta();
      await avaliarConquistas();
      buzz.ok();
      setV({});
      recarregar();
    } finally {
      setSalvando(false);
    }
  }

  const ultima = dados?.ultima;
  const r = dados?.r;

  const comp =
    ultima?.peso_kg && ultima?.gordura_pct
      ? composicao(ultima.peso_kg, ultima.gordura_pct)
      : null;

  const apt =
    r && ultima
      ? avaliarRecomposicao({
          gorduraPct: ultima.gordura_pct,
          genero: r.perfil.genero,
          mesesParado: r.perfil.meses_parado ?? 0,
          experiencia: r.perfil.experiencia ?? 'iniciante',
        })
      : null;

  return (
    <Screen
      titulo="Bioimpedância"
      subtitulo="O exame que mostra o que a balança esconde"
      onRefresh={recarregar}
      acaoTopo={
        <Press onPress={() => router.back()} style={s.iconeBtn} scale={0.9}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Press>
      }
    >
      {/* ── Última medição ── */}
      {ultima ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
          <Txt v="label">Último exame · {dataCurta(ultima.medido_em)}</Txt>

          <View style={s.grid}>
            {ultima.gordura_pct !== null && r ? (
              <Metrica
                label="Gordura"
                valor={`${num(ultima.gordura_pct, 1)}%`}
                sub={classificarGordura(ultima.gordura_pct, r.idadeAnos, r.perfil.genero).texto}
                cor={classificarGordura(ultima.gordura_pct, r.idadeAnos, r.perfil.genero).cor}
                ajuda={AJUDA.gorduraCorporal}
              />
            ) : null}

            {ultima.gordura_visceral !== null ? (
              <Metrica
                label="Visceral"
                valor={num(ultima.gordura_visceral)}
                sub={classificarVisceral(ultima.gordura_visceral).texto}
                cor={classificarVisceral(ultima.gordura_visceral).cor}
                ajuda={AJUDA.gorduraVisceral}
              />
            ) : null}

            {comp ? (
              <>
                <Metrica
                  label="Massa magra"
                  valor={`${num(comp.magraKg, 1)} kg`}
                  sub="músculo, osso, água"
                  cor={colors.success}
                />
                <Metrica
                  label="Massa gorda"
                  valor={`${num(comp.gorduraKg, 1)} kg`}
                  sub="o alvo do déficit"
                  cor={colors.warn}
                />
              </>
            ) : null}

            {ultima.musculo_pct !== null ? (
              <Metrica
                label="Músculo"
                valor={`${num(ultima.musculo_pct, 1)}%`}
                sub="esquelético"
                ajuda={AJUDA.musculoEsqueletico}
              />
            ) : null}

            {ultima.tmb_kcal !== null ? (
              <Metrica
                label="Metabolismo"
                valor={num(ultima.tmb_kcal)}
                sub="kcal em repouso"
                cor={colors.primary}
                ajuda={AJUDA.tmb}
              />
            ) : null}
          </View>

          {ultima.gordura_visceral !== null ? (
            <View
              style={[
                s.aviso,
                { backgroundColor: `${classificarVisceral(ultima.gordura_visceral).cor}18` },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={17}
                color={classificarVisceral(ultima.gordura_visceral).cor}
              />
              <Txt v="small" cor={classificarVisceral(ultima.gordura_visceral).cor} style={{ flex: 1 }}>
                {classificarVisceral(ultima.gordura_visceral).risco}
              </Txt>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* ── Aptidão para recomposição ── */}
      {apt ? (
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <Card destaque={apt.apto}>
            <View style={s.entre}>
              <TituloComAjuda
                titulo={apt.apto ? 'Você pode recompor' : 'Recomposição seria lenta'}
                ajuda={AJUDA.recomposicao}
                variante="h3"
              />
            </View>
            <View style={{ gap: 6, marginTop: spacing.sm }}>
              {apt.motivos.map((m, i) => (
                <View key={i} style={s.motivo}>
                  <Ionicons
                    name={apt.apto ? 'checkmark-circle' : 'alert-circle'}
                    size={15}
                    color={apt.apto ? colors.success : colors.warn}
                  />
                  <Txt v="small" style={{ flex: 1 }}>
                    {m}
                  </Txt>
                </View>
              ))}
            </View>
            {apt.ressalva ? (
              <Txt v="small" cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
                {apt.ressalva}
              </Txt>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Novo registro ── */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ gap: spacing.lg }}>
        <TituloComAjuda titulo="Registrar novo exame" ajuda={AJUDA.gorduraCorporal} />
        <Txt v="small" cor={colors.textFaint}>
          Preencha só o que o seu exame trouxe. Fica salvo em {dataCurta(hoje())}.
        </Txt>

        {campos.map((c) => (
          <View key={c.k} style={{ gap: 6 }}>
            <View style={s.rotulo}>
              <Txt v="label">{c.label}</Txt>
              {c.ajuda ? <Ajuda conteudo={c.ajuda} /> : null}
            </View>
            <Input
              sufixo={c.sufixo}
              placeholder="—"
              keyboardType="decimal-pad"
              value={v[c.k] ?? ''}
              onChangeText={(t) => setV((p) => ({ ...p, [c.k]: t }))}
            />
          </View>
        ))}

        <Button titulo="Salvar exame" full tam="lg" onPress={salvar} carregando={salvando} />

        <Card>
          <Txt v="label">Onde fazer</Txt>
          <Txt v="small">
            Farmácias grandes costumam oferecer bioimpedância por preço baixo ou de graça, e
            academias médias têm balança própria. Faça sempre nas mesmas condições: mesmo horário,
            hidratado, sem ter treinado antes.
          </Txt>
        </Card>
      </Animated.View>
    </Screen>
  );
}

function Metrica({
  label,
  valor,
  sub,
  cor,
  ajuda,
}: {
  label: string;
  valor: string;
  sub: string;
  cor?: string;
  ajuda?: (typeof AJUDA)[string];
}) {
  return (
    <Card style={{ flex: 1, minWidth: '46%' }} padding={spacing.md}>
      <View style={s.rotulo}>
        <Txt v="label" size={10}>
          {label}
        </Txt>
        {ajuda ? <Ajuda conteudo={ajuda} tam={13} /> : null}
      </View>
      <Txt v="h1" size={24} cor={cor}>
        {valor}
      </Txt>
      <Txt v="small" size={11} cor={colors.textFaint}>
        {sub}
      </Txt>
    </Card>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  motivo: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  aviso: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  iconeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
