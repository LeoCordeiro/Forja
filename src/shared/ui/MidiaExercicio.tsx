import { createElement, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Press } from './Press';
import { Sheet } from './Sheet';
import { ExerciseDemo } from './ExerciseDemo';
import { VIDEOS, duracaoCurta, thumb } from '@/db/seed/videos';
import { abrir, urlShorts, urlVideo } from '@/features/treino/video';

interface Props {
  nome: string;
  mediaUrl: string | null;
  /** Largura da capa em pé. A altura sai daqui, na proporção 3:4. */
  largura?: number;
  /** Fora da página atual: para de animar os frames. */
  parado?: boolean;
  /** false não baixa imagem nenhuma — páginas distantes do pager. */
  montar?: boolean;
}

/**
 * Mídia do exercício: vídeo do YouTube quando existe, demonstração em frames
 * quando não existe.
 *
 * O vídeo não toca embutido na página. Shorts são verticais — dentro de uma
 * faixa 16:9 o vídeo apareceria com um palmo de largura. Então a página mostra
 * a miniatura (que carrega sozinha, sem player) e o toque abre o player em
 * tamanho de verdade. De quebra, nada de rede acontece até você querer.
 */
export function MidiaExercicio({ nome, mediaUrl, largura = 116, parado, montar = true }: Props) {
  const [assistindo, setAssistindo] = useState(false);
  const [modo, setModo] = useState<'video' | 'demo'>('video');
  const [thumbQuebrou, setThumbQuebrou] = useState(false);

  const video = VIDEOS[nome];
  const temVideo = !!video && !thumbQuebrou;
  const altura = Math.round(largura * 1.34);

  // Trocar de exercício (troca de aparelho, ou o pager andando) precisa voltar
  // ao estado padrão — senão o próximo exercício herda "modo demo" sem motivo.
  useEffect(() => {
    setModo('video');
    setThumbQuebrou(false);
  }, [nome]);

  const caixa = { width: largura, height: altura };

  if (!temVideo || modo === 'demo') {
    return (
      <View style={{ width: largura, gap: 6 }}>
        <ExerciseDemo mediaUrl={mediaUrl} altura={altura} parado={parado || !montar} />
        {temVideo ? (
          <Press onPress={() => setModo('video')} style={s.acao} scale={0.96}>
            <Ionicons name="play-circle-outline" size={14} color={colors.textDim} />
            <Txt v="small" size={11} cor={colors.textDim}>
              Vídeo
            </Txt>
          </Press>
        ) : (
          <Press onPress={() => abrir(urlShorts(nome))} style={s.acao} scale={0.96}>
            <Ionicons name="logo-youtube" size={14} color="#FF0033" />
            <Txt v="small" size={11} cor={colors.textDim}>
              Buscar
            </Txt>
          </Press>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: largura, gap: 6 }}>
      <Press
        onPress={() => setAssistindo(true)}
        scale={0.97}
        haptic="medio"
        style={[s.capa, caixa]}
      >
        {montar ? (
          <Image
            source={{ uri: thumb(video.id) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            onError={() => setThumbQuebrou(true)}
          />
        ) : null}
        <View style={s.veu} />
        <View style={s.play}>
          <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
        <View style={s.selo}>
          <Ionicons name="logo-youtube" size={10} color="#FF0033" />
          {/* A duração na capa é o que decide se dá tempo antes da próxima série. */}
          <Txt v="small" size={9} cor="#FFFFFF" bold>
            {duracaoCurta(video.seg)}
          </Txt>
        </View>
      </Press>

      <Press onPress={() => setModo('demo')} style={s.acao} scale={0.96}>
        <Ionicons name="images-outline" size={14} color={colors.textDim} />
        <Txt v="small" size={11} cor={colors.textDim}>
          Fotos
        </Txt>
      </Press>

      <PlayerSheet
        aberto={assistindo}
        onFechar={() => setAssistindo(false)}
        videoId={video.id}
        nome={nome}
      />
    </View>
  );
}

/**
 * Versão compacta, para telas que já têm um elemento principal (o anel do
 * timer de mobilidade, por exemplo) e não têm espaço para uma capa inteira.
 * Some sozinha quando não há vídeo do movimento — nada de botão morto.
 */
export function VideoDoMovimento({ nome }: { nome: string }) {
  const [aberto, setAberto] = useState(false);
  const video = VIDEOS[nome];
  if (!video) return null;

  return (
    <>
      <Press onPress={() => setAberto(true)} style={s.mini} scale={0.97} haptic="medio">
        <View style={s.miniCapa}>
          <Image
            source={{ uri: thumb(video.id) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
          />
          <View style={s.miniPlay}>
            <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="h3" size={14}>
            Ver como faz
          </Txt>
          <Txt v="small" size={11} cor={colors.textFaint}>
            Short de {duracaoCurta(video.seg)}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Press>

      <PlayerSheet
        aberto={aberto}
        onFechar={() => setAberto(false)}
        videoId={video.id}
        nome={nome}
      />
    </>
  );
}

// ─────────────────────────── Player ───────────────────────────

function PlayerSheet({
  aberto,
  onFechar,
  videoId,
  nome,
}: {
  aberto: boolean;
  onFechar: () => void;
  videoId: string;
  nome: string;
}) {
  const { width, height } = useWindowDimensions();

  // 9:16 é o formato do Shorts. Limitado pela altura para não estourar a sheet
  // em celular baixo — nesse caso sobra tarja preta dos lados, e tudo bem.
  const larguraDisponivel = Math.min(width, 520) - spacing.lg * 2;
  const alturaMax = height * 0.62;
  const largura = Math.min(larguraDisponivel, alturaMax * (9 / 16));
  const alturaPlayer = largura * (16 / 9);

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={nome} altura={0.92}>
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <View style={[s.player, { width: largura, height: alturaPlayer }]}>
          {aberto ? <Embutido videoId={videoId} /> : null}
        </View>

        <Press onPress={() => abrir(urlVideo(videoId))} style={s.abrirFora} scale={0.96}>
          <Ionicons name="open-outline" size={16} color={colors.textDim} />
          <Txt v="small" cor={colors.textDim}>
            Abrir no YouTube
          </Txt>
        </Press>
      </View>
    </Sheet>
  );
}

/**
 * O player em si.
 *
 * Na web é um iframe de verdade — o React Native Web renderiza para DOM, então
 * `createElement('iframe')` funciona; em JSX o TypeScript brigaria com os tipos
 * do React Native. No celular não há WebView instalada (é uma dependência
 * nativa, e o app roda como PWA), então lá o toque manda para o app do YouTube.
 */
function Embutido({ videoId }: { videoId: string }) {
  const [erro, setErro] = useState(false);

  if (Platform.OS !== 'web') {
    return (
      <Press onPress={() => abrir(urlVideo(videoId))} style={s.nativo} scale={0.97}>
        <Ionicons name="logo-youtube" size={44} color="#FF0033" />
        <Txt v="small" cor={colors.textDim} center>
          Abrir no aplicativo do YouTube
        </Txt>
      </Press>
    );
  }

  if (erro) {
    return (
      <Press onPress={() => abrir(urlVideo(videoId))} style={s.nativo} scale={0.97}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.textFaint} />
        <Txt v="small" cor={colors.textDim} center>
          Este vídeo não permite ser reproduzido aqui.{'\n'}Toque para abrir no YouTube.
        </Txt>
      </Press>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
      {createElement('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
        style: { width: '100%', height: '100%', border: 0, display: 'block' },
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture',
        allowFullScreen: true,
        onError: () => setErro(true),
      })}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  capa: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veu: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,0,51,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selo: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,11,15,0.82)',
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniCapa: {
    width: 44,
    height: 58,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,0,51,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  player: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  nativo: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  abrirFora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});
