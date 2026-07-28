import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { Button, Card, Press, Sheet, Tela, Txt } from '@/shared/ui';
import { useDados } from '@/shared/hooks/useDados';
import { buzz } from '@/shared/utils/haptics';
import {
  ANGULOS,
  CONDICOES,
  INTERVALO_DIAS,
  apagarFoto,
  compararAngulo,
  escolherDaGaleria,
  espacoUsado,
  estadoDaCadencia,
  fotosDoAngulo,
  reduzir,
  salvarFoto,
  type Angulo,
  type Comparacao,
  type FotoProgresso,
} from '@/features/progresso/api';

/**
 * Foto de progresso.
 *
 * A tela existe porque o espelho não guarda memória. Quem se olha todo dia não
 * enxerga mudança de 4 semanas — enxerga o corpo de ontem. A foto é o único
 * jeito de comparar você com você.
 *
 * O que faz a comparação funcionar não é a câmera, é o alinhamento: a foto
 * anterior aparece por cima da câmera, translúcida, para você acertar
 * distância, altura e postura antes de disparar. Sem isso, duas fotos comparam
 * enquadramento, não corpo.
 */
export default function Progresso() {
  const router = useRouter();
  const [capturando, setCapturando] = useState<Angulo | null>(null);
  const [comparando, setComparando] = useState<Comparacao | null>(null);
  const [galeria, setGaleria] = useState<Angulo | null>(null);
  const [fotos, setFotos] = useState<FotoProgresso[]>([]);

  const { dados, recarregar } = useDados(async () => {
    const cadencia = await estadoDaCadencia();
    const ultimas: Record<string, FotoProgresso | null> = {};
    const totais: Record<string, number> = {};
    for (const a of ANGULOS) {
      const lista = await fotosDoAngulo(a.chave);
      ultimas[a.chave] = lista[0] ?? null;
      totais[a.chave] = lista.length;
    }
    const espaco = await espacoUsado();
    return { cadencia, ultimas, totais, espaco };
  }, []);

  async function abrirHistorico(a: Angulo) {
    setFotos(await fotosDoAngulo(a.chave));
    setGaleria(a);
  }

  async function abrirComparacao(chave: string) {
    const c = await compararAngulo(chave);
    if (c) setComparando(c);
  }

  if (!dados) return <Tela titulo="Foto de progresso"><View /></Tela>;

  const { cadencia, ultimas, totais, espaco } = dados;

  return (
    <Tela
      titulo="Foto de progresso"
      subtitulo="A medida que a balança não pega"
      ajuda={{
        titulo: 'Por que foto vale mais que a balança aqui',
        resumo:
          'Perder gordura e ganhar músculo ao mesmo tempo é justamente o caso em que a balança ' +
          'mente: você troca 3 kg de gordura por 3 kg de músculo, o corpo inteiro muda e o ' +
          'ponteiro não sai do lugar.',
        passos: [
          'Tire de manhã, em jejum, antes de beber água.',
          'Mesmo lugar, mesma luz, mesma roupa.',
          'Relaxado — nunca contraindo.',
          'Alinhe seu contorno com o da foto anterior antes de disparar.',
        ],
        porque:
          `A variação diária de água, glicogênio e intestino é maior que a mudança real de uma ` +
          `semana inteira. Por isso o intervalo é de ${INTERVALO_DIAS} dias: perda sustentável fica ` +
          `em 0,5 % a 1 % do peso por semana, e em 7 dias isso é invisível — some dentro da ` +
          `diferença de luz e postura entre as duas fotos.`,
        dica: 'Registre peso e cintura no mesmo dia da foto. Peso parado com cintura caindo é exatamente o que recomposição parece.',
      }}
    >
      {/* ── Cadência ────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card destaque={cadencia.naHora}>
          <View style={s.linha}>
            <Ionicons
              name={cadencia.naHora ? 'camera' : 'time-outline'}
              size={20}
              color={cadencia.naHora ? colors.primary : colors.textDim}
            />
            <Txt v="h3" style={{ flex: 1 }}>
              {cadencia.naHora ? 'Hora de registrar' : `Faltam ${cadencia.diasFaltando} dias`}
            </Txt>
          </View>
          <Txt v="body" cor={colors.textDim} style={{ marginTop: spacing.sm, lineHeight: 21 }}>
            {cadencia.mensagem}
          </Txt>
        </Card>
      </Animated.View>

      {/* ── Ângulos ─────────────────────────────────────────────────────── */}
      {ANGULOS.map((a, i) => {
        const ultima = ultimas[a.chave];
        const n = totais[a.chave];
        return (
          <Animated.View key={a.chave} entering={FadeInDown.delay(60 + i * 50).duration(300)}>
            <Card style={{ marginTop: spacing.md }}>
              <View style={s.topo}>
                {ultima ? (
                  <Press onPress={() => void abrirHistorico(a)}>
                    <Image source={{ uri: ultima.imagem }} style={s.miniatura} contentFit="cover" />
                  </Press>
                ) : (
                  <View style={[s.miniatura, s.vazia]}>
                    <Txt v="h2">{a.emoji}</Txt>
                  </View>
                )}

                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="h3">{a.titulo}</Txt>
                  <Txt v="small" cor={colors.textDim} style={{ lineHeight: 18 }}>
                    {a.mostra}
                  </Txt>
                  <Txt v="small" style={{ color: colors.textFaint, marginTop: 2 }}>
                    {n === 0
                      ? 'Nenhuma foto ainda'
                      : `${n} foto${n > 1 ? 's' : ''} · última em ${br(ultima!.data)}`}
                  </Txt>
                </View>
              </View>

              <View style={s.acoes}>
                <Button
                  titulo={n === 0 ? 'Primeira foto' : 'Nova foto'}
                  icone="camera-outline"
                  onPress={() => {
                    buzz.leve();
                    setCapturando(a);
                  }}
                  style={{ flex: 1 }}
                />
                {n >= 2 && (
                  <Button
                    titulo="Comparar"
                    variante="secundario"
                    icone="git-compare-outline"
                    onPress={() => void abrirComparacao(a.chave)}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </Card>
          </Animated.View>
        );
      })}

      {/* ── Condições ───────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(240).duration(300)}>
        <Card style={{ marginTop: spacing.lg }}>
          <Txt v="h3">O que faz a comparação valer</Txt>
          <Txt v="small" cor={colors.textDim} style={{ marginTop: 4, marginBottom: spacing.md, lineHeight: 18 }}>
            Duas fotos em luzes diferentes comparam luz, não corpo. Estas quatro coisas custam nada
            e decidem se o registro serve para alguma coisa daqui a três meses.
          </Txt>
          {CONDICOES.map((c) => (
            <View key={c.titulo} style={s.condicao}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Txt v="body" style={{ fontWeight: '600' }}>
                  {c.titulo}
                </Txt>
                <Txt v="small" cor={colors.textDim} style={{ lineHeight: 18 }}>
                  {c.detalhe}
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* ── Privacidade e espaço ────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(300).duration(300)}>
        <Card style={{ marginTop: spacing.md }}>
          <View style={s.linha}>
            <Ionicons name="lock-closed" size={16} color={colors.info} />
            <Txt v="body" style={{ fontWeight: '600' }}>
              As fotos não saem daqui
            </Txt>
          </View>
          <Txt v="small" cor={colors.textDim} style={{ marginTop: 6, lineHeight: 18 }}>
            Ficam no banco do app, dentro do aparelho. Não sobem para servidor nenhum, não vão para
            a liga e não entram no que é compartilhado. Só saem se você exportar o backup.
            {espaco.fotos > 0 && ` Hoje ocupam ${espaco.texto} em ${espaco.fotos} foto${espaco.fotos > 1 ? 's' : ''}.`}
          </Txt>
        </Card>
      </Animated.View>

      <Button
        titulo="Registrar peso e cintura"
        variante="secundario"
        icone="body-outline"
        onPress={() => router.push('/(tabs)/evolucao')}
        style={{ marginTop: spacing.md }}
      />
      <Txt v="small" style={{ color: colors.textFaint, marginTop: 6, lineHeight: 17 }}>
        A comparação fica muito melhor com número junto: peso parado e cintura caindo é exatamente
        o que recomposição parece — e é o resultado que a balança sozinha chamaria de fracasso.
      </Txt>

      {capturando && (
        <Captura
          angulo={capturando}
          onFechar={() => setCapturando(null)}
          onSalvo={() => {
            setCapturando(null);
            void recarregar();
          }}
        />
      )}

      <Sheet
        aberto={!!comparando}
        onFechar={() => setComparando(null)}
        titulo="Antes e depois"
        altura={0.88}
      >
        {comparando && <VistaComparacao c={comparando} />}
      </Sheet>

      <Sheet
        aberto={!!galeria}
        onFechar={() => setGaleria(null)}
        titulo={galeria ? `Histórico — ${galeria.titulo.toLowerCase()}` : ''}
        altura={0.85}
      >
        <View style={s.grade}>
          {fotos.map((f) => (
            <View key={f.id} style={s.itemGrade}>
              <Image source={{ uri: f.imagem }} style={s.fotoGrade} contentFit="cover" />
              <Txt v="small" cor={colors.textDim} style={{ marginTop: 4 }}>
                {br(f.data)}
              </Txt>
              <Press
                onPress={async () => {
                  await apagarFoto(f.id);
                  setFotos((v) => v.filter((x) => x.id !== f.id));
                  void recarregar();
                }}
                style={s.apagar}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </Press>
            </View>
          ))}
        </View>
      </Sheet>
    </Tela>
  );
}

// ── Captura com sobreposição da anterior ────────────────────────────────────

/**
 * Câmera com a foto anterior por cima.
 *
 * O temporizador não é enfeite: foto de corpo inteiro exige o celular apoiado,
 * e sem contagem regressiva a pessoa registra o braço esticado segurando o
 * aparelho — que muda a postura do ombro e do tronco justamente no ângulo que
 * a gente quer medir.
 */
function Captura({
  angulo,
  onFechar,
  onSalvo,
}: {
  angulo: Angulo;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { height } = useWindowDimensions();
  /**
   * A câmera é carregada sob demanda, não importada no topo.
   *
   * `expo-camera` é módulo NATIVO: numa versão do app instalada antes de ele
   * existir, um import estático quebra a tela inteira no momento em que a rota
   * abre. E é exatamente esse o cenário de uma atualização por OTA, que entrega
   * JavaScript novo para um binário antigo.
   *
   * Carregando aqui dentro, a falta do módulo vira o mesmo caminho de "sem
   * câmera" que já existe para computador sem webcam: a tela abre e oferece a
   * galeria. Degrada em vez de quebrar.
   */
  const cam = useRef<{ takePictureAsync: (o?: unknown) => Promise<{ uri?: string }> } | null>(null);
  const [modulo, setModulo] = useState<typeof import('expo-camera') | null>(null);
  const [permissao, setPermissao] = useState<boolean | null>(null);
  const [lado, setLado] = useState<'front' | 'back'>('front');
  const [anterior, setAnterior] = useState<FotoProgresso | null>(null);
  const [fantasma, setFantasma] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const [previa, setPrevia] = useState<{ uri: string; l: number; a: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /**
   * Câmera que não monta.
   *
   * Acontece de verdade e não é caso de borda: notebook sem webcam frontal, ou
   * navegador que rejeita o pedido de câmera "de selfie" porque o aparelho só
   * tem uma. Sem tratar, a tela fica preta e parece que o app travou.
   *
   * A primeira falha vira uma tentativa com a outra câmera; a segunda desiste e
   * oferece a galeria, que resolve o caso do computador.
   */
  const [semCamera, setSemCamera] = useState(false);
  const tentouVirar = useRef(false);

  useEffect(() => {
    void (async () => {
      const lista = await fotosDoAngulo(angulo.chave);
      setAnterior(lista[0] ?? null);
    })();
  }, [angulo.chave]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await import('expo-camera');
        setModulo(m);
        const atual = await m.Camera.getCameraPermissionsAsync();
        setPermissao(atual.granted);
      } catch {
        // Binário sem o módulo nativo: cai no caminho da galeria.
        setSemCamera(true);
      }
    })();
  }, []);

  async function pedirPermissao() {
    if (!modulo) return;
    try {
      const r = await modulo.Camera.requestCameraPermissionsAsync();
      setPermissao(r.granted);
    } catch {
      setSemCamera(true);
    }
  }

  // Contagem regressiva do temporizador.
  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => {
      const proximo = segundos - 1;
      setSegundos(proximo);
      if (proximo === 0) void disparar();
      else buzz.leve();
    }, 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  async function disparar() {
    try {
      const foto = await cam.current?.takePictureAsync({ quality: 1 });
      if (!foto?.uri) return setErro('A câmera não devolveu imagem.');
      const r = await reduzir(foto.uri);
      if (r) setPrevia({ uri: r.base64, l: r.largura, a: r.altura });
      else if (foto.uri.startsWith('data:')) setPrevia({ uri: foto.uri, l: 0, a: 0 });
      else setErro('Não consegui processar a imagem.');
      buzz.ok();
    } catch {
      setErro('Falha ao capturar.');
    }
  }

  async function daGaleria() {
    const uri = await escolherDaGaleria();
    if (!uri) return;
    const r = await reduzir(uri);
    if (r) setPrevia({ uri: r.base64, l: r.largura, a: r.altura });
    else setErro('Não consegui processar a imagem escolhida.');
  }

  async function confirmar() {
    if (!previa) return;
    setSalvando(true);
    await salvarFoto(angulo.chave, previa.uri, { largura: previa.l, altura: previa.a });
    buzz.ok();
    onSalvo();
  }

  function aoFalharCamera() {
    if (!tentouVirar.current) {
      tentouVirar.current = true;
      setLado((v: 'front' | 'back') => (v === 'front' ? 'back' : 'front'));
      return;
    }
    setSemCamera(true);
  }

  const semPermissao = permissao === false || semCamera || !modulo;

  return (
    <Modal visible animationType="slide" onRequestClose={onFechar}>
      <View style={s.camTela}>
        {/* Prévia do que foi capturado */}
        {previa ? (
          <>
            <Image source={{ uri: previa.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
            <View style={s.barraInferior}>
              <Button
                titulo="Refazer"
                variante="secundario"
                icone="refresh"
                onPress={() => setPrevia(null)}
                style={{ flex: 1 }}
              />
              <Button
                titulo={salvando ? 'Salvando…' : 'Usar esta'}
                icone="checkmark"
                onPress={() => void confirmar()}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : semPermissao ? (
          <View style={s.centro}>
            {/* Sem isso a tela de fallback não tem saída: o gesto de voltar do
                Android fecha, mas no navegador não existe gesto nenhum. */}
            <Press onPress={onFechar} style={[s.iconeCam, s.fecharSolto]}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Press>
            <Ionicons name="camera-outline" size={48} color={colors.textFaint} />
            <Txt v="h3" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {semCamera ? 'Sem câmera disponível aqui' : 'A câmera precisa de permissão'}
            </Txt>
            <Txt v="small" cor={colors.textDim} style={{ textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
              {semCamera
                ? 'Este aparelho não devolveu nenhuma câmera — costuma ser o caso no computador. Dá para escolher uma foto pronta e registrar do mesmo jeito.'
                : 'A imagem é processada e guardada no próprio aparelho. Se preferir não dar acesso, dá para escolher uma foto que já está na galeria.'}
            </Txt>
            {!semCamera && (
              <Button
                titulo="Permitir câmera"
                onPress={() => void pedirPermissao()}
                style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
              />
            )}
            <Button
              titulo="Escolher da galeria"
              variante="secundario"
              onPress={() => void daGaleria()}
              style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <>
            <modulo.CameraView
              ref={cam as never}
              style={StyleSheet.absoluteFill}
              facing={lado}
              mirror={false}
              onMountError={aoFalharCamera}
            />

            {/* Fantasma: a foto anterior, para alinhar antes de disparar. */}
            {anterior && fantasma && (
              <Image
                source={{ uri: anterior.imagem }}
                style={[StyleSheet.absoluteFill, { opacity: 0.38 }]}
                contentFit="cover"
              />
            )}

            {/* Guias de enquadramento: linha do topo da cabeça e dos pés. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[s.guia, { top: height * 0.14 }]} />
              <View style={[s.guia, { top: height * 0.86 }]} />
              <View style={[s.guiaVert, { left: '50%' }]} />
            </View>

            {segundos > 0 && (
              <Animated.View entering={FadeIn} style={s.contagem} pointerEvents="none">
                <Txt style={s.numeroContagem}>{segundos}</Txt>
              </Animated.View>
            )}

            <View style={s.topoCam}>
              <Press onPress={onFechar} style={s.iconeCam}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Press>
              <View style={s.dica}>
                <Txt v="small" style={{ color: colors.text }}>
                  {angulo.titulo} · {angulo.comoPosar}
                </Txt>
              </View>
            </View>

            <View style={s.barraInferior}>
              <Press
                onPress={() => setLado((v: 'front' | 'back') => (v === 'front' ? 'back' : 'front'))}
                style={s.iconeCam}
              >
                <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
              </Press>

              <Press onPress={() => setSegundos(10)} style={s.disparo}>
                <Ionicons name="camera" size={26} color="#000" />
              </Press>

              <Press onPress={() => void daGaleria()} style={s.iconeCam}>
                <Ionicons name="images-outline" size={22} color={colors.text} />
              </Press>
            </View>

            {anterior && (
              <Press onPress={() => setFantasma((v) => !v)} style={s.alternarFantasma}>
                <Ionicons
                  name={fantasma ? 'eye' : 'eye-off'}
                  size={15}
                  color={fantasma ? colors.primary : colors.textDim}
                />
                <Txt v="small" style={{ color: fantasma ? colors.primary : colors.textDim }}>
                  {fantasma ? 'Alinhando com a anterior' : 'Sobreposição desligada'}
                </Txt>
              </Press>
            )}

            <View style={s.avisoTemporizador} pointerEvents="none">
              <Txt v="small" style={{ color: colors.textDim, textAlign: 'center' }}>
                {anterior
                  ? 'Encaixe seu contorno no da foto anterior. 10 s depois de tocar em disparar.'
                  : 'Apoie o celular, toque em disparar e entre no quadro. Você tem 10 segundos.'}
              </Txt>
            </View>
          </>
        )}

        {erro && (
          <View style={s.erro}>
            <Txt v="small" style={{ color: colors.danger }}>
              {erro}
            </Txt>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Comparação lado a lado ──────────────────────────────────────────────────

function VistaComparacao({ c }: { c: Comparacao }) {
  return (
    <View>
      <View style={s.parFotos}>
        <View style={{ flex: 1 }}>
          <Image source={{ uri: c.antes.imagem }} style={s.fotoComparacao} contentFit="cover" />
          <Txt v="small" cor={colors.textDim} style={s.legenda}>
            {br(c.antes.data)}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Image source={{ uri: c.depois.imagem }} style={s.fotoComparacao} contentFit="cover" />
          <Txt v="small" style={[s.legenda, { color: colors.primary }]}>
            {br(c.depois.data)}
          </Txt>
        </View>
      </View>

      <View style={s.numeros}>
        <Numero titulo="Período" valor={`${c.semanas} sem`} cor={colors.textDim} />
        <Numero
          titulo="Peso"
          valor={c.deltaPeso === null ? '—' : `${sinal(c.deltaPeso)} kg`}
          cor={c.deltaPeso === null ? colors.textFaint : c.deltaPeso < 0 ? colors.success : colors.info}
        />
        <Numero
          titulo="Cintura"
          valor={c.deltaCintura === null ? '—' : `${sinal(c.deltaCintura)} cm`}
          cor={
            c.deltaCintura === null
              ? colors.textFaint
              : c.deltaCintura < 0
                ? colors.success
                : colors.warn
          }
        />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <Txt v="body" style={{ lineHeight: 22 }}>
          {c.leitura}
        </Txt>
      </Card>
    </View>
  );
}

function Numero({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  return (
    <View style={s.numero}>
      <Txt v="small" style={{ color: colors.textFaint }}>
        {titulo}
      </Txt>
      <Txt v="h3" style={{ color: cor, marginTop: 2 }}>
        {valor}
      </Txt>
    </View>
  );
}

// Vírgula decimal: é assim que o resto do app escreve número, e "−0.3" num
// aplicativo em português lê como erro de formatação.
const sinal = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(1).replace('.', ',')}`;
const br = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
};

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topo: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  miniatura: {
    width: 68,
    height: 91,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  vazia: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  acoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  condicao: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },

  // Câmera
  camTela: { flex: 1, backgroundColor: '#000' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  topoCam: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 52,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dica: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  iconeCam: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fecharSolto: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 52,
    left: spacing.md,
    backgroundColor: colors.surfaceHigh,
  },
  disparo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  barraInferior: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 24 : 44,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  guia: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  guiaVert: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  contagem: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  numeroContagem: {
    fontSize: 120,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
  alternarFantasma: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 108 : 128,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
  },
  avisoTemporizador: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 148 : 172,
    left: spacing.xl,
    right: spacing.xl,
  },
  erro: {
    position: 'absolute',
    top: '50%',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },

  // Comparação
  parFotos: { flexDirection: 'row', gap: spacing.sm },
  fotoComparacao: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  legenda: { textAlign: 'center', marginTop: 6 },
  numeros: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  numero: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },

  // Histórico
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemGrade: { width: '31%' },
  fotoGrade: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  apagar: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
