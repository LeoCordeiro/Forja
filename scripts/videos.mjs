/**
 * Coleta de vídeos de execução (YouTube Shorts).
 *
 * Por que um script e não uma busca dentro do app: o YouTube não libera CORS,
 * então o navegador não consegue buscar. Aqui, fora do navegador, consegue.
 * O resultado vira `src/db/seed/videos.ts`, que o app lê sem rede nenhuma.
 *
 * Rodar de novo quando algum vídeo sair do ar:
 *   node scripts/videos.mjs            (só o que falta)
 *   node scripts/videos.mjs --tudo     (refaz todos)
 *
 * O `--tudo` é caro: são ~74 buscas. O padrão preserva o que já foi validado.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(raiz, 'src/db/seed/videos.ts');
const refazerTudo = process.argv.includes('--tudo');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Filtro "Shorts" da busca do YouTube. */
const SP_SHORTS = 'EgIYAQ%3D%3D';

// ── nomes dos exercícios, lidos direto do seed ────────────────────────────
function nomesDeExercicios() {
  const src = readFileSync(join(raiz, 'src/db/seed/exercicios.ts'), 'utf8');
  const nomes = [];
  for (const l of src.split('\n')) {
    const m = l.match(/^\s*\['([^']+)','([a-z]+)'/);
    if (m) nomes.push({ nome: m[1], grupo: m[2] });
  }
  return nomes;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com paciência.
 *
 * O YouTube corta a torneira depois de algumas dezenas de buscas seguidas — a
 * primeira versão deste script morreu em 11 de 74 exatamente assim. Recuo
 * exponencial resolve; o cookie CONSENT evita cair na tela de consentimento,
 * que devolve HTML sem resultado nenhum e parece "não achei nada".
 */
async function buscarHtml(url, tentativa = 0) {
  try {
    const r = await fetch(url, {
      headers: {
        'user-agent': UA,
        'accept-language': 'pt-BR,pt;q=0.9',
        cookie: 'CONSENT=YES+cb.20240101-00-p0.pt+FX+111',
      },
    });
    if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (tentativa >= 4) throw e;
    const recuo = 4000 * 2 ** tentativa + Math.floor(Math.random() * 1500);
    console.log(`    … ${e.message}, tentando de novo em ${Math.round(recuo / 1000)}s`);
    await espera(recuo);
    return buscarHtml(url, tentativa + 1);
  }
}

// ── busca ─────────────────────────────────────────────────────────────────
async function buscar(termo, sp = SP_SHORTS) {
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(termo)}` +
    (sp ? `&sp=${sp}` : '');
  const html = await buscarHtml(url);

  const i = html.indexOf('var ytInitialData = ');
  if (i < 0) return [];
  const inicio = i + 'var ytInitialData = '.length;
  const fim = html.indexOf(';</script>', inicio);
  let dados;
  try {
    dados = JSON.parse(html.slice(inicio, fim));
  } catch {
    return [];
  }

  // A resposta muda de formato com frequência; em vez de navegar por caminho
  // fixo, varre a árvore atrás de qualquer nó que tenha videoId + título.
  const achados = [];
  const vistos = new Set();
  (function anda(no) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach(anda);

    const id = no.videoId;
    if (typeof id === 'string' && id.length === 11 && !vistos.has(id)) {
      const titulo =
        no.title?.runs?.[0]?.text ??
        no.title?.simpleText ??
        no.headline?.simpleText ??
        no.overlayMetadata?.primaryText?.content ??
        null;
      if (titulo) {
        vistos.add(id);
        achados.push({ id, titulo });
      }
    }
    for (const v of Object.values(no)) anda(v);
  })(dados);

  return achados;
}

// ── relevância ────────────────────────────────────────────────────────────
const IGNORAR = new Set([
  'com','de','do','da','na','no','em','para','a','o','e','os','as','um','uma',
]);

function normalizar(t) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Quantas palavras significativas do nome do exercício aparecem no título.
 * Sem isso, "elevação lateral" traz vídeo de elevação de terreno.
 */
function relevancia(nomeEx, titulo) {
  const palavras = normalizar(nomeEx).split(/\s+/).filter((p) => p.length > 2 && !IGNORAR.has(p));
  const t = normalizar(titulo);
  const acertos = palavras.filter((p) => t.includes(p)).length;
  return palavras.length ? acertos / palavras.length : 0;
}

/** Título que promete técnica vale mais que título que promete resultado. */
const BOM = ['execu', 'tecnica', 'técnica', 'como fazer', 'erro', 'forma correta', 'certo'];
const RUIM = ['challenge', 'motivation', 'shorts virais', 'humor', 'meme', 'prank'];

function nota(nomeEx, titulo, posicao) {
  const t = normalizar(titulo);
  let n = relevancia(nomeEx, titulo) * 100;
  if (BOM.some((b) => t.includes(normalizar(b)))) n += 18;
  if (RUIM.some((b) => t.includes(normalizar(b)))) n -= 40;
  n -= posicao * 1.5; // empate desempata pela ordem do YouTube
  return n;
}

// ── validação ─────────────────────────────────────────────────────────────
/** oEmbed só responde 200 para vídeo público e embutível — é o teste que importa. */
async function embutivel(id) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { headers: { 'user-agent': UA } }
    );
    return r.ok;
  } catch {
    return false;
  }
}

// ── principal ─────────────────────────────────────────────────────────────
function carregarExistente() {
  if (refazerTudo || !existsSync(SAIDA)) return {};
  const src = readFileSync(SAIDA, 'utf8');
  const mapa = {};
  for (const m of src.matchAll(/^\s*'([^']+)':\s*'([\w-]{11})'/gm)) mapa[m[1]] = m[2];
  return mapa;
}

const exercicios = nomesDeExercicios();
const mapa = carregarExistente();
const jaTinha = Object.keys(mapa).length;
let novos = 0;
let falhas = [];

console.log(`${exercicios.length} exercícios · ${jaTinha} já mapeados`);

for (const { nome } of exercicios) {
  if (mapa[nome]) continue;

  try {
    // Shorts primeiro (formato certo: 40 segundos direto ao movimento). Se o
    // filtro não devolver nada aproveitável, tenta a busca comum — vídeo longo
    // resolve melhor que exercício sem vídeo nenhum.
    let escolhido = await melhorDe(nome, await buscar(`${nome} execução correta academia`));
    if (!escolhido) {
      await espera(1200);
      escolhido = await melhorDe(nome, await buscar(`${nome} como fazer execução`, ''));
    }

    if (escolhido) {
      mapa[nome] = escolhido.id;
      novos++;
      console.log(`  ✓ ${nome} → ${escolhido.id}  "${escolhido.titulo.slice(0, 52)}"`);
      salvar(mapa); // grava a cada acerto: rate limit no meio não apaga o resto
    } else {
      falhas.push(nome);
      console.log(`  · ${nome} — nada relevante`);
    }
  } catch (e) {
    falhas.push(nome);
    console.log(`  ! ${nome} — ${e.message}`);
  }

  await espera(1600 + Math.floor(Math.random() * 900));
}

async function melhorDe(nome, candidatos) {
  const ranqueados = candidatos
    .map((c, i) => ({ ...c, n: nota(nome, c.titulo, i) }))
    .filter((c) => c.n > 45)
    .sort((a, b) => b.n - a.n);

  for (const c of ranqueados.slice(0, 4)) {
    if (await embutivel(c.id)) return c;
  }
  return null;
}

function salvar(mapa) {
  const linhas = Object.keys(mapa)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((k) => `  '${k}': '${mapa[k]}',`)
    .join('\n');

  writeFileSync(
    SAIDA,
    `/**
 * Vídeos de execução por exercício — IDs do YouTube.
 *
 * GERADO POR \`node scripts/videos.mjs\`. Não editar à mão sem necessidade:
 * a próxima execução do script preserva o que já está aqui, então um ID
 * corrigido manualmente sobrevive.
 *
 * Todos foram validados via oEmbed no momento da coleta — quer dizer que o
 * vídeo era público E permitia ser embutido. Se algum sair do ar depois, o app
 * cai na demonstração em imagens e oferece a busca no YouTube.
 */

export const VIDEOS: Record<string, string> = {
${linhas}
};

/** Miniatura sem custo de player — carrega antes de decidir assistir. */
export function thumb(videoId: string): string {
  return \`https://i.ytimg.com/vi/\${videoId}/hqdefault.jpg\`;
}
`,
    'utf8'
  );
}

salvar(mapa);

console.log(
  `\n${Object.keys(mapa).length}/${exercicios.length} mapeados (+${novos} agora)` +
    (falhas.length ? `\nsem vídeo: ${falhas.join(', ')}` : '')
);
