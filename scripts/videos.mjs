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

/**
 * Filtro de duração "menos de 4 minutos" da busca do YouTube.
 *
 * Não é o filtro de Shorts — não existe um confiável na URL. Serve só para
 * reduzir a pilha; quem decide de verdade é o `LIMITE_SEG` abaixo, lido da
 * duração que vem em cada resultado.
 */
const SP_CURTOS = 'EgIYAQ%3D%3D';

/**
 * Teto de duração. Um Short de 40 segundos mostra o movimento e os dois erros
 * comuns; um vídeo de três minutos gasta o primeiro falando de canal e patrocínio.
 * Ninguém assiste isso entre duas séries.
 */
const LIMITE_SEG = 100;
const IDEAL_SEG = 60;

/**
 * Piso de duração. Abaixo disso é clipe solto: mostra o movimento e acaba,
 * sem dizer onde a pessoa erra. O pedido era breve E explicativo — nove
 * segundos não explicam nada.
 */
const MINIMO_SEG = 18;

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
/** "2:21" → 141. Retorna null para transmissão ao vivo, que não tem duração. */
function emSegundos(txt) {
  if (!txt) return null;
  const p = txt.split(':').map(Number);
  if (p.some(Number.isNaN)) return null;
  return p.reduce((a, n) => a * 60 + n, 0);
}

async function buscar(termo, sp = SP_CURTOS) {
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
        achados.push({ id, titulo, seg: emSegundos(no.lengthText?.simpleText) });
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
const RUIM = [
  'challenge', 'motivation', 'shorts virais', 'humor', 'meme', 'prank',
  // A busca por aparelho traz manutenção e venda antes de execução —
  // "Troca Cinta Carga Freio Bicicleta Ergométrica" passou por relevante.
  'troca', 'manutenc', 'conserto', 'reparo', 'montagem', 'unboxing',
  'review', 'comprar', 'preco', 'barato', 'promocao',
];

function nota(nomeEx, c, posicao) {
  const t = normalizar(c.titulo);
  let n = relevancia(nomeEx, c.titulo) * 100;
  if (BOM.some((b) => t.includes(normalizar(b)))) n += 18;

  // Corte seco, não desconto. Com penalidade de pontos, "Troca Cinta Carga
  // Freio Bicicleta Ergométrica" sobrevivia: o nome do aparelho aparece duas
  // vezes e a relevância pagava a multa sozinha.
  if (RUIM.some((b) => t.includes(normalizar(b)))) return -1;

  // Duração pesa quase tanto quanto o título: entre um vídeo perfeito de 2min
  // e um bom de 40s, o de 40s ganha — é o que dá para ver na academia.
  if (c.seg === null || c.seg > LIMITE_SEG || c.seg < MINIMO_SEG) return -1;
  n += c.seg <= IDEAL_SEG ? 25 : 25 * ((LIMITE_SEG - c.seg) / (LIMITE_SEG - IDEAL_SEG));

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
  for (const m of src.matchAll(/^\s*'([^']+)':\s*\{ id: '([\w-]{11})', seg: (\d+) \}/gm)) {
    mapa[m[1]] = { id: m[2], seg: Number(m[3]) };
  }
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
    // Três formas de perguntar a mesma coisa. Antes existia um plano B que
    // buscava sem filtro de duração e aceitava vídeo longo — era isso que
    // enfiava aula de três minutos no meio do treino. Agora, se nenhuma
    // variação achar algo curto, o exercício fica sem vídeo mesmo: o app cai
    // na demonstração em imagens, que é melhor que o vídeo errado.
    let escolhido = null;
    for (const q of [
      `${nome} execução correta`,
      `como fazer ${nome} shorts`,
      `${nome} técnica erros`,
    ]) {
      escolhido = await melhorDe(nome, await buscar(q));
      if (escolhido) break;
      await espera(1200);
    }

    if (escolhido) {
      mapa[nome] = { id: escolhido.id, seg: escolhido.seg };
      novos++;
      const mmss = `${Math.floor(escolhido.seg / 60)}:${String(escolhido.seg % 60).padStart(2, '0')}`;
      console.log(`  ✓ ${nome} → ${escolhido.id} (${mmss})  "${escolhido.titulo.slice(0, 46)}"`);
      salvar(mapa); // grava a cada acerto: rate limit no meio não apaga o resto
    } else {
      falhas.push(nome);
      console.log(`  · ${nome} — nada curto e relevante`);
    }
  } catch (e) {
    falhas.push(nome);
    console.log(`  ! ${nome} — ${e.message}`);
  }

  await espera(1600 + Math.floor(Math.random() * 900));
}

async function melhorDe(nome, candidatos) {
  const ranqueados = candidatos
    .map((c, i) => ({ ...c, n: nota(nome, c, i) }))
    .filter((c) => c.n > 60)
    .sort((a, b) => b.n - a.n);

  for (const c of ranqueados.slice(0, 4)) {
    if (await embutivel(c.id)) return c;
  }
  return null;
}

function salvar(mapa) {
  const linhas = Object.keys(mapa)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((k) => `  '${k}': { id: '${mapa[k].id}', seg: ${mapa[k].seg} },`)
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
 * Dois critérios foram aplicados na coleta e valem para tudo que está aqui:
 * o vídeo é público E permite ser embutido (validado via oEmbed), e dura no
 * máximo ${LIMITE_SEG} segundos. Exercício sem vídeo curto ficou sem vídeo — o app cai
 * na demonstração em imagens, que serve melhor que uma aula de três minutos
 * no meio de um descanso.
 */

export interface VideoExercicio {
  id: string;
  /** Duração em segundos — vira o selo na miniatura. */
  seg: number;
}

export const VIDEOS: Record<string, VideoExercicio> = {
${linhas}
};

/** Miniatura sem custo de player — carrega antes de decidir assistir. */
export function thumb(videoId: string): string {
  return \`https://i.ytimg.com/vi/\${videoId}/hqdefault.jpg\`;
}

export function duracaoCurta(seg: number): string {
  return \`\${Math.floor(seg / 60)}:\${String(seg % 60).padStart(2, '0')}\`;
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
