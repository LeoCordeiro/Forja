import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';
import { Sheet } from './Sheet';

export interface ConteudoAjuda {
  titulo: string;
  resumo: string;
  passos?: string[];
  dica?: string;
  porque?: string;
}

/**
 * Ponto de interrogação que abre uma explicação curta.
 *
 * Existe porque metade do que este app pede — medir cintura, escolher RIR,
 * entender gordura visceral — não é óbvio para quem está começando, e uma
 * medida feita errado gera um gráfico que mente por meses.
 */
export function Ajuda({ conteudo, tam = 16 }: { conteudo: ConteudoAjuda; tam?: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Press onPress={() => setAberto(true)} haptic="leve" scale={0.85} style={s.botao}>
        <Ionicons name="help-circle-outline" size={tam + 4} color={colors.textFaint} />
      </Press>

      <Sheet aberto={aberto} onFechar={() => setAberto(false)} titulo={conteudo.titulo} altura={0.8}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing['3xl'] }}>
          <Txt v="body">{conteudo.resumo}</Txt>

          {conteudo.passos?.length ? (
            <View style={{ gap: spacing.md }}>
              <Txt v="label">Passo a passo</Txt>
              {conteudo.passos.map((p, i) => (
                <View key={i} style={s.passo}>
                  <View style={s.num}>
                    <Txt v="small" size={11} cor={colors.primary} bold>
                      {i + 1}
                    </Txt>
                  </View>
                  <Txt v="body" style={{ flex: 1 }}>
                    {p}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}

          {conteudo.dica ? (
            <View style={s.dica}>
              <Ionicons name="bulb" size={16} color={colors.warn} />
              <Txt v="small" cor={colors.warn} style={{ flex: 1 }}>
                {conteudo.dica}
              </Txt>
            </View>
          ) : null}

          {conteudo.porque ? (
            <View style={s.porque}>
              <Txt v="label" cor={colors.info}>
                Por que isso importa
              </Txt>
              <Txt v="small" cor={colors.textDim}>
                {conteudo.porque}
              </Txt>
            </View>
          ) : null}
        </ScrollView>
      </Sheet>
    </>
  );
}

/** Linha de título com o ponto de interrogação ao lado. */
export function TituloComAjuda({
  titulo,
  ajuda,
  variante = 'label',
}: {
  titulo: string;
  ajuda: ConteudoAjuda;
  variante?: 'label' | 'h2' | 'h3';
}) {
  return (
    <View style={s.linha}>
      <Txt v={variante}>{titulo}</Txt>
      <Ajuda conteudo={ajuda} />
    </View>
  );
}

const s = StyleSheet.create({
  botao: { padding: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  passo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dica: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warnSoft,
  },
  porque: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.infoSoft,
  },
});
