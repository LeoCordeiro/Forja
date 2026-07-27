/**
 * Utilidades de YouTube compartilhadas pelos scripts.
 *
 * O ponto central aqui é `ehVertical`. O YouTube não expõe "isto é um Short"
 * em lugar nenhum que dê para consultar de fora: a busca não marca, o filtro
 * `sp` da URL é de duração e não de tipo, e `youtube.com/shorts/<id>` responde
 * 303 para /watch mesmo quando o vídeo É um Short.
 *
 * O que funciona é olhar o pixel. A miniatura `frame0.jpg` sai na proporção
 * real do vídeo — 270x480 num Short, 480x268 num vídeo comum. Ler o cabeçalho
 * do JPEG (uns 2 KB) responde a pergunta sem API, sem chave e sem heurística.
 */

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Lê largura e altura do cabeçalho do JPEG sem decodificar a imagem. */
function dimensoesJpeg(b) {
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marca = b[i + 1];
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC)
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

export async function proporcao(videoId) {
  try {
    const r = await fetch(`https://i.ytimg.com/vi/${videoId}/frame0.jpg`, {
      headers: { 'user-agent': UA },
    });
    if (!r.ok) return null;
    const d = dimensoesJpeg(Buffer.from(await r.arrayBuffer()));
    return d ? d.largura / d.altura : null;
  } catch {
    return null;
  }
}

/** Vertical de verdade: 9:16 dá 0,56. Vídeo comum dá 1,78. */
export async function ehVertical(videoId) {
  const p = await proporcao(videoId);
  return p !== null && p < 0.9;
}

/** oEmbed responde 200 só para vídeo público E embutível. */
export async function embutivel(videoId) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { 'user-agent': UA } }
    );
    return r.ok;
  } catch {
    return false;
  }
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));
