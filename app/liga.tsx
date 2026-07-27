import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Input, Press, Sheet, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import {
  checkin,
  checkinsDoDia,
  entrarNaLiga,
  criarLiga,
  getConfig,
  getEu,
  infoLiga,
  ligaAtiva,
  PONTOS,
  ranking,
  resumoSolo,
  sairDaLiga,
  salvarConfig,
  salvarEu,
  sincronizar,
  type LinhaRanking,
  type TipoCheckin,
} from '@/features/liga/api';
import { buzz } from '@/shared/utils/haptics';

const EMOJIS = ['💪', '🔥', '🐺', '🦍', '⚡', '🐉', '🥷', '🦁', '🚀', '🧊'];

/**
 * Liga: check-in, ranking e temporada.
 *
 * O ranking é por CHECK-IN, não por carga levantada. Ranking por peso premia
 * quem já é forte e desmotiva quem começou — o jeito mais rápido de matar uma
 * liga de amigos. Aparecer é o único comportamento que todo mundo controla.
 *
 * Funciona sem servidor: sem credencial, vira liga solo contra o próprio
 * histórico. Configurar o Supabase só acrescenta os amigos.
 */
export default function Liga() {
  const [config, setConfig] = useState(false);
  const [url, setUrl] = useState('');
  const [chave, setChave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [apelido, setApelido] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [criando, setCriando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const { dados, recarregar } = useDados(async () => {
    const solo = await resumoSolo();
    const hojeCheckins = await checkinsDoDia();
    const eu = getEu();
    let rank: LinhaRanking[] | null = null;
    let info = null;
    if (eu.ligaId) {
      await sincronizar();
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
      rank = await ranking(inicio.toISOString().slice(0, 10));
      info = await infoLiga();
    }
    return { solo, hojeCheckins, eu, rank, info };
  }, []);

  useEffect(() => {
    if (dados?.eu.apelido) setApelido(dados.eu.apelido);
    if (dados?.eu.emoji) setEmoji(dados.eu.emoji);
  }, [dados]);

  async function marcar(tipo: TipoCheckin) {
    const p = await checkin(tipo);
    buzz.ok();
    recarregar();
    return p;
  }

  const feitos = new Set((dados?.hojeCheckins ?? []).map((c) => c.tipo));
  const temServidor = ligaAtiva();
  const naLiga = !!dados?.eu.ligaId;

  return (
    <Tela titulo="Liga" subtitulo={dados?.info?.nome ?? 'Sequência, pontos e ranking'} onRefresh={recarregar}>
      {/* ── Check-in de hoje ── */}
      <Card faixa={colors.primary}>
        <Txt v="label">Check-in de hoje</Txt>
        <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: 2 }}>
          Pontua aparecer, não a carga. Ranking por peso premia quem já é forte e afasta quem
          começou.
        </Txt>
        <View style={s.tipos}>
          {(Object.keys(PONTOS) as TipoCheckin[]).map((t) => {
            const ok = feitos.has(t);
            return (
              <Press
                key={t}
                onPress={() => !ok && marcar(t)}
                style={[s.tipo, ok && s.tipoFeito]}
                scale={0.94}
                haptic="medio"
              >
                <Ionicons
                  name={ok ? 'checkmark-circle' : iconePara(t)}
                  size={22}
                  color={ok ? colors.success : colors.textDim}
                />
                <Txt v="h3" size={13} cor={ok ? colors.success : colors.text}>
                  {rotulo(t)}
                </Txt>
                <Txt v="small" size={10} cor={colors.textFaint}>
                  +{PONTOS[t]} pts
                </Txt>
              </Press>
            );
          })}
        </View>
      </Card>

      {/* ── Sequência e pontos ── */}
      {dados ? (
        <Animated.View entering={FadeInDown.duration(280)}>
          <Card>
            <View style={s.numeros}>
              <Numero label="Sequência" valor={`${dados.solo.sequencia}`} sufixo="dias" cor={colors.primary} />
              <Numero label="Semana" valor={`${dados.solo.pontosSemana}`} sufixo="pts" cor={colors.xp} />
              <Numero label="Recorde" valor={`${dados.solo.recordeSemana}`} sufixo="pts" cor={colors.warn} />
            </View>
            {dados.solo.recordeSemana > 0 && dados.solo.pontosSemana < dados.solo.recordeSemana ? (
              <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.md }}>
                Faltam {dados.solo.recordeSemana - dados.solo.pontosSemana} pontos para bater sua
                melhor semana.
              </Txt>
            ) : dados.solo.pontosSemana >= dados.solo.recordeSemana && dados.solo.pontosSemana > 0 ? (
              <Txt v="small" size={11} cor={colors.success} style={{ marginTop: spacing.md }}>
                Melhor semana da sua história. O adversário de quem treina sozinho é o próprio
                histórico.
              </Txt>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Ranking ── */}
      {naLiga && dados?.rank ? (
        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: spacing.sm }}>
          <View style={s.entre}>
            <Txt v="label">Ranking da semana</Txt>
            <Txt v="small" size={11} cor={colors.textFaint}>
              código {dados.eu.ligaId}
            </Txt>
          </View>
          {dados.rank.map((l, i) => (
            <Card key={l.membro_id} padding={spacing.md} destaque={l.souEu}>
              <View style={s.linha}>
                <View style={[s.pos, i === 0 && { backgroundColor: colors.warnSoft }]}>
                  <Txt v="h3" size={14} cor={i === 0 ? colors.warn : colors.textFaint}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt size={20}>{l.emoji}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt v="h3" size={15}>
                    {l.apelido}
                    {l.souEu ? ' (você)' : ''}
                  </Txt>
                  <Txt v="small" size={11} cor={colors.textFaint}>
                    {l.checkins} check-in{l.checkins === 1 ? '' : 's'}
                  </Txt>
                </View>
                <Txt v="h2" size={19} cor={l.souEu ? colors.primary : colors.textDim}>
                  {l.pontos}
                </Txt>
              </View>
            </Card>
          ))}
          <Button
            titulo="Sair da liga"
            variante="fantasma"
            tam="sm"
            full
            onPress={async () => {
              await sairDaLiga();
              recarregar();
            }}
          />
        </Animated.View>
      ) : null}

      {/* ── Entrar / criar ── */}
      {!naLiga ? (
        <Card faixa={temServidor ? colors.info : colors.textFaint}>
          <Txt v="h3">Competir com amigos</Txt>
          {temServidor ? (
            <>
              <Txt v="small" style={{ marginTop: 4 }}>
                Crie uma liga e mande o código, ou entre com o código de alguém.
              </Txt>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  titulo="Criar liga"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setCriando(true);
                    setEntrando(true);
                  }}
                />
                <Button
                  titulo="Entrar"
                  variante="secundario"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setCriando(false);
                    setEntrando(true);
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <Txt v="small" style={{ marginTop: 4 }}>
                Ranking entre pessoas precisa de um lugar onde os dados se encontrem. Sem isso, a
                liga funciona só contra o seu próprio histórico — que já está aí em cima.
              </Txt>
              <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
                Só apelido, check-in e pontos vão para o servidor. Peso, medidas, dieta e histórico
                de treino nunca saem do celular.
              </Txt>
              <Button
                titulo="Configurar servidor"
                variante="secundario"
                full
                style={{ marginTop: spacing.md }}
                onPress={() => {
                  const c = getConfig();
                  setUrl(c?.url ?? '');
                  setChave(c?.anonKey ?? '');
                  setConfig(true);
                }}
              />
            </>
          )}
        </Card>
      ) : null}

      {/* ── Sheet: entrar/criar ── */}
      <Sheet
        aberto={entrando}
        onFechar={() => setEntrando(false)}
        titulo={criando ? 'Criar liga' : 'Entrar numa liga'}
        altura={0.8}
      >
        <View style={{ gap: spacing.lg }}>
          <Input
            rotulo={criando ? 'Nome da liga' : 'Código da liga'}
            value={codigo}
            onChangeText={(t) => setCodigo(criando ? t : t.toUpperCase())}
            placeholder={criando ? 'Os brabos' : 'ABC123'}
            grande
          />
          <Input rotulo="Seu apelido" value={apelido} onChangeText={setApelido} placeholder="Leo" />
          <View style={{ gap: spacing.sm }}>
            <Txt v="label">Seu ícone</Txt>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {EMOJIS.map((e) => (
                <Press
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[s.emoji, emoji === e && s.emojiAtivo]}
                  haptic="selecao"
                >
                  <Txt size={22}>{e}</Txt>
                </Press>
              ))}
            </View>
          </View>
          <Button
            titulo={criando ? 'Criar e entrar' : 'Entrar'}
            full
            tam="lg"
            carregando={ocupado}
            desabilitado={!codigo.trim() || !apelido.trim()}
            onPress={async () => {
              setOcupado(true);
              try {
                salvarEu({ apelido: apelido.trim(), emoji });
                const ok = criando
                  ? !!(await criarLiga(codigo.trim(), 3))
                  : await entrarNaLiga(codigo.trim(), apelido.trim(), emoji);
                if (ok) {
                  buzz.ok();
                  setEntrando(false);
                  setCodigo('');
                  recarregar();
                }
              } finally {
                setOcupado(false);
              }
            }}
          />
        </View>
      </Sheet>

      {/* ── Sheet: configuração do servidor ── */}
      <Sheet
        aberto={config}
        onFechar={() => setConfig(false)}
        titulo="Servidor da liga"
        altura={0.9}
      >
        <View style={{ gap: spacing.lg }}>
          <Card padding={spacing.md}>
            <Txt v="small" size={12}>
              1. Crie um projeto grátis em supabase.com{'\n'}
              2. Abra o SQL Editor e cole o conteúdo de{' '}
              <Txt v="small" size={12} cor={colors.primary}>
                src/features/liga/schema.sql
              </Txt>
              {'\n'}
              3. Em Settings → API, copie a URL e a chave <Txt v="small" size={12} bold>anon public</Txt>
            </Txt>
            <Txt v="small" size={11} cor={colors.textFaint} style={{ marginTop: spacing.sm }}>
              A chave anon é pública por natureza — ela vai dentro de todo app cliente. Quem protege
              os dados é a política de acesso que o schema cria, não o segredo da chave.
            </Txt>
          </Card>

          <Input rotulo="URL do projeto" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" />
          <Input rotulo="Chave anon public" value={chave} onChangeText={setChave} placeholder="eyJhbGci..." />

          <Button
            titulo="Salvar"
            full
            tam="lg"
            desabilitado={!url.includes('supabase') || chave.length < 30}
            onPress={() => {
              salvarConfig(url, chave);
              buzz.ok();
              setConfig(false);
              recarregar();
            }}
          />
        </View>
      </Sheet>
    </Tela>
  );
}

function iconePara(t: TipoCheckin) {
  return t === 'treino' ? 'barbell-outline' : t === 'cardio' ? 'pulse-outline' : 'body-outline';
}
function rotulo(t: TipoCheckin) {
  return t === 'treino' ? 'Treino' : t === 'cardio' ? 'Cardio' : 'Mobilidade';
}

function Numero({
  label,
  valor,
  sufixo,
  cor,
}: {
  label: string;
  valor: string;
  sufixo: string;
  cor: string;
}) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt v="small" size={10} cor={colors.textFaint}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Txt v="h1" size={26} cor={cor}>
          {valor}
        </Txt>
        <Txt v="small" size={11} cor={colors.textFaint}>
          {sufixo}
        </Txt>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tipos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipo: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipoFeito: { backgroundColor: colors.successSoft, borderColor: colors.success },
  numeros: { flexDirection: 'row', gap: spacing.md },
  pos: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiAtivo: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
