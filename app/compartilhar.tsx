import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Empty, Input, Press, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { listarDias } from '@/features/treino/api';
import {
  exportarRotina,
  importarRotina,
  tamanhoLegivel,
  type ResultadoImport,
} from '@/features/compartilhar/api';
import { getPerfil } from '@/features/perfil/api';
import { buzz } from '@/shared/utils/haptics';

/**
 * Compartilhar treino.
 *
 * Sem servidor não há convite: o que há é um código que carrega a rotina
 * inteira. Cada pessoa instala o app no próprio celular e cola o código —
 * os dados de cada um ficam no aparelho de cada um.
 */
export default function Compartilhar() {
  const router = useRouter();
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [codigoColado, setCodigoColado] = useState('');
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [importando, setImportando] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const [dias, perfil] = await Promise.all([listarDias(), getPerfil()]);
    // Agrupa os dias por rotina — é a rotina inteira que se compartilha.
    const rotinas = new Map<number, { id: number; nome: string; dias: number }>();
    for (const d of dias) {
      const atual = rotinas.get(d.routine_id);
      rotinas.set(d.routine_id, {
        id: d.routine_id,
        nome: d.rotina,
        dias: (atual?.dias ?? 0) + 1,
      });
    }
    return { rotinas: [...rotinas.values()], perfil };
  }, []);

  async function gerar(routineId: number) {
    const cod = await exportarRotina(routineId, dados?.perfil?.nome);
    setCodigoGerado(cod);
    buzz.ok();
  }

  async function enviar() {
    if (!codigoGerado) return;
    const mensagem = `Treino da Forja — cole este código no app:\n\n${codigoGerado}`;
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator & {
        share?: (d: { text: string }) => Promise<void>;
      };
      if (nav.share) await nav.share({ text: mensagem }).catch(() => {});
      else await nav.clipboard?.writeText(mensagem);
      buzz.ok();
      return;
    }
    await Share.share({ message: mensagem });
  }

  async function importar() {
    setImportando(true);
    try {
      const r = await importarRotina(codigoColado);
      setResultado(r);
      if (r.ok) {
        buzz.ok();
        setCodigoColado('');
        recarregar();
      } else {
        buzz.erro();
      }
    } finally {
      setImportando(false);
    }
  }

  return (
    <Tela
      titulo="Compartilhar treino"
      subtitulo="Envie sua rotina para quem quiser"
    >
      <Card>
        <Txt v="label">Como funciona</Txt>
        <Txt v="small">
          A Forja não tem servidor — seus dados ficam só no seu aparelho. Para treinar junto com
          alguém, você gera um código com a rotina inteira e manda por WhatsApp. A pessoa instala o
          app dela e cola o código.
        </Txt>
      </Card>

      {/* ── Enviar ── */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Enviar uma rotina</Txt>
        {dados?.rotinas.length ? (
          dados.rotinas.map((r) => (
            <Card key={r.id} onPress={() => gerar(r.id)} padding={spacing.md}>
              <View style={s.entre}>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{r.nome}</Txt>
                  <Txt v="small" cor={colors.textFaint}>
                    {r.dias} {r.dias === 1 ? 'dia' : 'dias'} de treino
                  </Txt>
                </View>
                <Ionicons name="share-outline" size={19} color={colors.primary} />
              </View>
            </Card>
          ))
        ) : (
          <Empty icone="barbell-outline" titulo="Nenhuma rotina para enviar" />
        )}

        {codigoGerado ? (
          <Animated.View entering={FadeIn.duration(240)} style={{ gap: spacing.md }}>
            <Card destaque>
              <Txt v="label" cor={colors.primary}>
                Código gerado · {tamanhoLegivel(codigoGerado)}
              </Txt>
              <View style={s.codigo}>
                <Txt v="small" size={11} numberOfLines={4} style={{ fontFamily: 'monospace' }}>
                  {codigoGerado}
                </Txt>
              </View>
              <Button
                titulo={Platform.OS === 'web' ? 'Copiar / compartilhar' : 'Enviar'}
                icone="share-social-outline"
                full
                onPress={enviar}
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* ── Receber ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ gap: spacing.md }}>
        <Txt v="label">Receber uma rotina</Txt>
        <Input
          placeholder="Cole aqui o código que você recebeu"
          value={codigoColado}
          onChangeText={setCodigoColado}
          multiline
          numberOfLines={4}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <Button
          titulo="Importar rotina"
          icone="download-outline"
          variante="secundario"
          full
          desabilitado={codigoColado.trim().length < 20}
          carregando={importando}
          onPress={importar}
        />

        {resultado ? (
          <Animated.View entering={FadeIn.duration(240)}>
            <Card
              style={{
                borderColor: resultado.ok ? colors.success : colors.danger,
              }}
            >
              <View style={s.entre}>
                <Ionicons
                  name={resultado.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={resultado.ok ? colors.success : colors.danger}
                />
                <Txt v="h3" style={{ flex: 1 }}>
                  {resultado.ok ? 'Rotina importada' : 'Não deu certo'}
                </Txt>
              </View>
              {resultado.ok ? (
                <>
                  <Txt v="small">
                    {resultado.rotina} · {resultado.dias} dias · {resultado.exercicios} exercícios
                  </Txt>
                  {resultado.ignorados?.length ? (
                    <Txt v="small" cor={colors.warn} style={{ marginTop: 4 }}>
                      {resultado.ignorados.length} exercício(s) não existem no seu catálogo e foram
                      pulados: {resultado.ignorados.slice(0, 3).join(', ')}
                      {resultado.ignorados.length > 3 ? '…' : ''}
                    </Txt>
                  ) : null}
                  <Button
                    titulo="Ver na aba Treino"
                    variante="fantasma"
                    full
                    style={{ marginTop: spacing.sm }}
                    onPress={() => router.push('/treino')}
                  />
                </>
              ) : (
                <Txt v="small" cor={colors.danger}>
                  {resultado.erro}
                </Txt>
              )}
            </Card>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Card>
        <Txt v="label">Para treinar em família ou com amigos</Txt>
        <Txt v="small">
          Cada pessoa instala o app no próprio celular pelo mesmo link e faz o próprio onboarding —
          peso, altura e objetivo de cada um. Depois é só você mandar a rotina por código. Os
          treinos, medidas e a dieta de cada um ficam separados, no aparelho de cada um.
        </Txt>
      </Card>
    </Tela>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codigo: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
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
