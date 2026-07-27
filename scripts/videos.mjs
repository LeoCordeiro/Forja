/**
 * Coleta de Shorts de execução.
 *
 * Três coisas descobertas testando, que definem todo o desenho deste script:
 *
 * 1. O YouTube não deixa buscar do navegador (sem CORS). Fora dele, deixa.
 * 2. A busca do site em HTML **não devolve Shorts** — devolve vídeo comum, na
 *    horizontal. E o parâmetro `sp=EgIYAQ` da URL não é "Shorts": é "menos de
 *    4 minutos". Foi isso que encheu a primeira versão de aula de 3 minutos.
 * 3. Quem devolve Shorts é a API interna com o cliente **MWEB** (YouTube
 *    mobile). Lá cada Short vem com `webPageType: WEB_PAGE_TYPE_SHORTS` e a
 *    miniatura já traz largura e altura reais — dá para exigir vertical sem
 *    baixar imagem nenhuma.
 *
 * Rodar de novo quando algum vídeo sair do ar:
 *   node scripts/videos.mjs            (só o que falta)
 *   node scripts/videos.mjs --tudo     (refaz todos)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { embutivel, espera } from './lib-yt.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(raiz, 'src/db/seed/videos.ts');
const refazerTudo = process.argv.includes('--tudo');

const MUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Faixa de duração útil.
 *
 * Teto: Short pode ir a 3 min, mas acima de ~110s não serve entre séries.
 * Piso: abaixo de 15s é clipe mudo — mostra o movimento e acaba, sem dizer
 * onde a pessoa erra. O pedido era breve E explicativo.
 */
const LIMITE_SEG = 110;
const MINIMO_SEG = 15;
const IDEAL = [25, 70];

// ── fontes de nomes ───────────────────────────────────────────────────────
function exerciciosDoSeed() {
  const src = readFileSync(join(raiz, 'src/db/seed/exercicios.ts'), 'utf8');
  const nomes = [];
  for (const l of src.split('\n')) {
    const m = l.match(/^\s*\['([^']+)','([a-z]+)'/);
    if (m) nomes.push(m[1]);
  }
  return nomes;
}

/** Movimentos de mobilidade e alongamento — mesma necessidade, outro arquivo. */
function movimentosDeMobilidade() {
  const src = readFileSync(join(raiz, 'src/features/mobilidade/rotinas.ts'), 'utf8');
  return [...src.matchAll(/^\s*nome: '([^']+)'/gm)].map((m) => m[1]);
}

// ── API interna ───────────────────────────────────────────────────────────
let ctx = null;
async function contexto() {
  if (ctx) return ctx;
  const html = await (
    await fetch('https://m.youtube.com/', {
      headers: { 'user-agent': MUA, cookie: 'CONSENT=YES+cb' },
    })
  ).text();
  ctx = {
    key: html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1],
    versao: html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)[1],
  };
  return ctx;
}

async function buscarShorts(termo, tentativa = 0) {
  const { key, versao } = await contexto();
  try {
    const r = await fetch(`https://m.youtube.com/youtubei/v1/search?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': MUA },
      body: JSON.stringify({
        context: { client: { clientName: 'MWEB', clientVersion: versao, hl: 'pt-BR', gl: 'BR' } },
        query: termo,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const dados = await r.json();

    const achados = [];
    const vistos = new Set();
    (function anda(no) {
      if (!no || typeof no !== 'object') return;
      if (Array.isArray(no)) return no.forEach(anda);

      const ehShort = no.commandMetadata?.webCommandMetadata?.webPageType === 'WEB_PAGE_TYPE_SHORTS';
      const id = no.reelWatchEndpoint?.videoId;
      if (ehShort && id && !vistos.has(id)) {
        vistos.add(id);
        const t = no.reelWatchEndpoint.thumbnail?.thumbnails?.[0];
        // Vertical de verdade. Alguns Shorts antigos foram enviados na
        // horizontal e ficam com tarja preta gorda no player — fora.
        if (t && t.height > t.width * 1.2) achados.push({ id, ordem: achados.length });
      }
      for (const v of Object.values(no)) anda(v);
    })(dados);

    return achados;
  } catch (e) {
    if (tentativa >= 3) throw e;
    ctx = null; // pode ter expirado
    await espera(4000 * 2 ** tentativa);
    return buscarShorts(termo, tentativa + 1);
  }
}

/**
 * Título + validação numa tacada.
 *
 * oEmbed responde 200 só para vídeo público E embutível — que é o teste que
 * importa, porque vídeo com embed bloqueado aparece normalmente na busca e só
 * falha dentro do app. E de quebra devolve o título, que é como se mede se o
 * vídeo é do exercício certo.
 */
async function titulo(id) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { headers: { 'user-agent': MUA } }
    );
    if (!r.ok) return null;
    return (await r.json()).title ?? null;
  } catch {
    return null;
  }
}

/** Duração exata, da página do vídeo. Só do escolhido — é caro. */
async function duracao(id) {
  try {
    const html = await (
      await fetch(`https://www.youtube.com/watch?v=${id}`, {
        headers: { 'user-agent': MUA, cookie: 'CONSENT=YES+cb' },
      })
    ).text();
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

// ── relevância ────────────────────────────────────────────────────────────
const IGNORAR = new Set([
  'com', 'de', 'do', 'da', 'na', 'no', 'em', 'para', 'a', 'o', 'e', 'os', 'as', 'um', 'uma',
]);

function normalizar(t) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function relevancia(nomeEx, tit) {
  const palavras = normalizar(nomeEx)
    .split(/\s+/)
    .filter((p) => p.length > 2 && !IGNORAR.has(p));
  const t = normalizar(tit);
  const acertos = palavras.filter((p) => t.includes(p)).length;
  return palavras.length ? acertos / palavras.length : 0;
}

const BOM = ['execu', 'tecnica', 'como fazer', 'erro', 'forma correta', 'certo', 'jeito'];
const RUIM = [
  'challenge', 'motivation', 'humor', 'meme', 'prank',
  'troca', 'manutenc', 'conserto', 'reparo', 'montagem', 'unboxing',
  'review', 'comprar', 'preco', 'barato', 'promocao',
];

function nota(nomeEx, tit, ordem) {
  const t = normalizar(tit);
  // Corte seco, não desconto: com penalidade de pontos, "Troca Cinta Carga
  // Freio Bicicleta Ergométrica" sobrevivia porque o nome do aparelho aparecia
  // duas vezes e a relevância pagava a multa sozinha.
  if (RUIM.some((b) => t.includes(normalizar(b)))) return -1;

  let n = relevancia(nomeEx, tit) * 100;
  if (BOM.some((b) => t.includes(normalizar(b)))) n += 18;
  n -= ordem * 2; // a ordem do YouTube já é um sinal
  return n;
}

/** Dentro da faixa ideal vale cheio; fora dela cai proporcional à distância. */
function bonusDuracao(seg) {
  const [lo, hi] = IDEAL;
  if (seg >= lo && seg <= hi) return 30;
  const fora = seg < lo ? (lo - seg) / (lo - MINIMO_SEG) : (seg - hi) / (LIMITE_SEG - hi);
  return 30 * (1 - Math.min(1, fora));
}

// ── persistência ──────────────────────────────────────────────────────────
function carregarExistente() {
  if (refazerTudo || !existsSync(SAIDA)) return {};
  const src = readFileSync(SAIDA, 'utf8');
  const mapa = {};
  for (const m of src.matchAll(/^\s*'([^']+)': \{ id: '([\w-]{11})', seg: (\d+) \}/gm)) {
    mapa[m[1]] = { id: m[2], seg: Number(m[3]) };
  }
  return mapa;
}

function salvar(mapa) {
  const linhas = Object.keys(mapa)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((k) => `  '${k}': { id: '${mapa[k].id}', seg: ${mapa[k].seg} },`)
    .join('\n');

  writeFileSync(
    SAIDA,
    `/**
 * Shorts de execução por exercício.
 *
 * GERADO POR \`node scripts/videos.mjs\`. Não editar à mão sem necessidade:
 * a próxima execução preserva o que já está aqui, então um ID corrigido
 * manualmente sobrevive.
 *
 * Todo item aqui passou por três testes na coleta:
 * · o YouTube o classifica como Short (\`WEB_PAGE_TYPE_SHORTS\`);
 * · a miniatura é vertical de verdade (altura > largura), porque tela de
 *   celular é vertical e vídeo deitado aparece do tamanho de um selo;
 * · o vídeo é público e permite ser embutido (oEmbed responde 200) — vídeo com
 *   embed bloqueado aparece na busca e só falha dentro do app.
 *
 * Exercício sem Short bom fica sem vídeo: o app cai na demonstração em imagens,
 * que serve melhor que o vídeo errado.
 */

export interface VideoExercicio {
  id: string;
  /** Duração em segundos — vira o selo na miniatura. */
  seg: number;
}

export const VIDEOS: Record<string, VideoExercicio> = {
${linhas}
};

/**
 * Miniatura vertical. \`frame0.jpg\` sai na proporção original do vídeo; o
 * \`hqdefault.jpg\` é sempre 480x360 e enfia tarja preta dos dois lados.
 */
export function thumb(videoId: string): string {
  return \`https://i.ytimg.com/vi/\${videoId}/frame0.jpg\`;
}

export function duracaoCurta(seg: number): string {
  return \`\${Math.floor(seg / 60)}:\${String(seg % 60).padStart(2, '0')}\`;
}
`,
    'utf8'
  );
}

// ── principal ─────────────────────────────────────────────────────────────
const alvos = [...exerciciosDoSeed(), ...movimentosDeMobilidade()];
const mapa = carregarExistente();
let novos = 0;
const falhas = [];

console.log(`${alvos.length} alvos · ${Object.keys(mapa).length} já mapeados`);

for (const nome of alvos) {
  if (mapa[nome]) continue;

  try {
    let escolhido = null;
    for (const q of [`${nome} execução`, `${nome} como fazer`, `${nome} técnica`]) {
      const candidatos = await buscarShorts(q);
      const comTitulo = [];
      for (const c of candidatos.slice(0, 6)) {
        const t = await titulo(c.id); // null = privado ou sem embed
        if (t) comTitulo.push({ ...c, titulo: t, n: nota(nome, t, c.ordem) });
      }

      // Mede a duração dos 4 melhores e só então escolhe. Pegar o primeiro que
      // couber no teto trazia clipe de 5 segundos: o título era ótimo, o vídeo
      // não explicava nada.
      const finalistas = [];
      for (const c of comTitulo.filter((x) => x.n > 55).sort((a, b) => b.n - a.n).slice(0, 4)) {
        const seg = await duracao(c.id);
        if (seg && seg >= MINIMO_SEG && seg <= LIMITE_SEG) {
          finalistas.push({ ...c, seg, total: c.n + bonusDuracao(seg) });
        }
      }
      escolhido = finalistas.sort((a, b) => b.total - a.total)[0] ?? null;
      if (escolhido) break;
      await espera(1400);
    }

    if (escolhido) {
      mapa[nome] = { id: escolhido.id, seg: escolhido.seg };
      novos++;
      const mmss = `${Math.floor(escolhido.seg / 60)}:${String(escolhido.seg % 60).padStart(2, '0')}`;
      console.log(`  ✓ ${nome} → ${escolhido.id} (${mmss})  "${escolhido.titulo.slice(0, 42)}"`);
      salvar(mapa); // grava a cada acerto: corte no meio não apaga o resto
    } else {
      falhas.push(nome);
      console.log(`  · ${nome} — nenhum Short relevante`);
    }
  } catch (e) {
    falhas.push(nome);
    console.log(`  ! ${nome} — ${e.message}`);
  }

  await espera(1200 + Math.floor(Math.random() * 600));
}

salvar(mapa);
console.log(
  `\n${Object.keys(mapa).length}/${alvos.length} mapeados (+${novos} agora)` +
    (falhas.length ? `\nsem vídeo: ${falhas.join(', ')}` : '')
);
