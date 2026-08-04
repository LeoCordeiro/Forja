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

/** Link direto de um vídeo já conhecido — usado pelo botão "abrir no YouTube". */
export function urlVideo(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
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
 *
 * ── Uma linha daqui contradizia o resto do app ───────────────────────────
 *
 * Ela dizia "movimento controlado na descida — **a fase excêntrica é onde mais
 * se cresce**", e ficava três centímetros acima do card de cadência, que diz o
 * contrário com a fonte na mão: Krzysztofik 2019 mede hipertrofia semelhante de
 * 0,5 s a 8 s de fase excêntrica. Não adianta o app dizer a verdade num card se
 * o card de cima repete o mito que ele existe para desfazer — e o de cima é o
 * que a pessoa lê primeiro.
 *
 * O critério de vídeo que sobra é o VERIFICÁVEL: descida controlada em vez de
 * peso caindo. Isso é sobre a carga ser sustentada, não sobre crescer mais.
 */
export const COMO_AVALIAR_VIDEO = [
  'Amplitude completa, sem "meio movimento" para colocar mais peso.',
  'Descida controlada, com o peso sendo sustentado — não largado. Não precisa ser lenta: precisa ' +
    'ser conduzida.',
  'Sem impulso de tronco ou quadril para vencer a carga.',
  'Quem demonstra explica o porquê, não só repete o movimento.',
];
