import { Linking, Platform } from 'react-native';

/**
 * Vídeos de execução.
 *
 * Guardamos o TERMO DE BUSCA, não a URL de um vídeo específico. Três motivos:
 * link de vídeo quebra quando o canal apaga; não hospedamos nem redistribuímos
 * conteúdo de terceiros; e a busca sempre devolve o que está em alta, que
 * costuma ser melhor produzido que um link fixado há um ano.
 */

const CANAIS_BONS = [
  'Leandro Twin',
  'Renato Cariani',
  'Muscle in Minutes',
  'Jeff Nippard',
];

/** Busca no YouTube Shorts — formato curto, direto à execução. */
export function urlShorts(nomeExercicio: string): string {
  const q = encodeURIComponent(`${nomeExercicio} execução correta técnica`);
  return `https://www.youtube.com/results?search_query=${q}&sp=EgIYAQ%253D%253D`;
}

/** Busca comum, quando a pessoa quer explicação mais longa. */
export function urlYoutube(nomeExercicio: string): string {
  const q = encodeURIComponent(`${nomeExercicio} como fazer execução`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

/** Busca no Instagram por hashtag do exercício. */
export function urlInstagram(nomeExercicio: string): string {
  const tag = nomeExercicio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `https://www.instagram.com/explore/tags/${tag}/`;
}

export async function abrir(url: string) {
  if (Platform.OS === 'web') {
    // No PWA, nova aba — não queremos tirar a pessoa do treino em andamento.
    (globalThis as unknown as { open?: (u: string, t: string) => void }).open?.(url, '_blank');
    return;
  }
  const ok = await Linking.canOpenURL(url);
  if (ok) await Linking.openURL(url);
}

export const FONTES = {
  canais: CANAIS_BONS,
  aviso:
    'Os links abrem uma busca no YouTube ou Instagram. O app não hospeda vídeos — assim nada quebra quando um canal sai do ar.',
};

/**
 * Sinais de execução decente, para filtrar o que se vê nos vídeos.
 * Muito conteúdo viral prioriza engajamento sobre técnica.
 */
export const COMO_AVALIAR_VIDEO = [
  'Amplitude completa, sem "meio movimento" para colocar mais peso.',
  'Movimento controlado na descida — a fase excêntrica é onde mais se cresce.',
  'Sem impulso de tronco ou quadril para vencer a carga.',
  'Quem demonstra explica o porquê, não só repete o movimento.',
];
