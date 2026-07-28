/**
 * Injeta as tags de PWA no HTML gerado pelo `expo export`.
 *
 * Por que um pós-processamento e não `app/+html.tsx`: aquele arquivo só é
 * usado quando o Expo Router exporta em modo `static` (um HTML por rota).
 * A Forja exporta como `single` (SPA) porque tem rotas dinâmicas — e nesse
 * modo o Expo usa um template fixo e ignora o +html.tsx por completo.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const INDEX = join(DIST, 'index.html');

if (!existsSync(INDEX)) {
  console.error('dist/index.html não existe — rode `npx expo export --platform web` antes.');
  process.exit(1);
}

/**
 * Identidade desta build: o hash do bundle de entrada.
 *
 * Já existe, já muda a cada mudança de código e não muda quando nada mudou —
 * exatamente o que uma versão precisa ser. Inventar um contador ou usar a data
 * daria versão nova em build idêntica e reload à toa.
 */
const htmlBruto = readFileSync(INDEX, 'utf8');
const BUILD = (htmlBruto.match(/entry-([a-f0-9]{8,})\.js/) || [, 'dev'])[1].slice(0, 12);

/**
 * Grava a versão e carimba o service worker.
 *
 * O `sw.js` era um arquivo estático que NUNCA mudava de conteúdo — e o
 * navegador só reinstala o service worker quando os bytes dele mudam. Com
 * `VERSAO` fixa em 'forja-v1', o `activate` também nunca apagava cache antigo.
 * O service worker publicado no primeiro deploy continuava valendo meses
 * depois, com o cache do primeiro deploy junto.
 *
 * Carimbar o hash da build resolve os dois de uma vez: o arquivo muda, o
 * navegador reinstala, e o `activate` limpa tudo que não é desta versão.
 */
function carimbarVersao() {
  writeFileSync(join(DIST, 'versao.json'), JSON.stringify({ build: BUILD }) + '\n');

  const sw = join(DIST, 'sw.js');
  if (existsSync(sw)) {
    const src = readFileSync(sw, 'utf8').replace(
      /const VERSAO = '[^']*'/,
      `const VERSAO = 'forja-${BUILD}'`
    );
    writeFileSync(sw, src);
  } else {
    console.warn('PWA: dist/sw.js não existe — o cache antigo não será limpo.');
  }
}
carimbarVersao();

const TAGS = `
    <meta name="description" content="Treino, nutrição e progressão de carga. Funciona offline." />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0A0B0F" />
    <!-- O iOS ignora o manifest para instalação: precisa destas meta tags. -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Forja" />
    <link rel="apple-touch-icon" href="/icones/apple-touch-icon.png" />
    <link rel="icon" href="/icones/icone-192.png" />
    <style>
      html, body { background-color: #0A0B0F; overscroll-behavior: none; }
      body {
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
      }
      input, textarea { -webkit-user-select: text; user-select: text; }
    </style>
    <script>
      /*
       * Registro do service worker.
       *
       * Não dá para pendurar só no evento 'load': numa SPA algum recurso fica
       * pendente e o load nunca dispara, deixando o app sem cache offline —
       * exatamente o que ele precisa ter na academia. Daí as três tentativas,
       * que são idempotentes.
       */
      if ('serviceWorker' in navigator) {
        var registrarSW = function () {
          navigator.serviceWorker.register('/sw.js').then(function (reg) {
            // Procura versão nova toda vez que o app volta do segundo plano.
            // No iPhone instalado na tela de início, abrir o app quase nunca é
            // uma navegação: o iOS restaura a página como estava, com o
            // JavaScript velho ainda na memória.
            reg.update().catch(function () {});
          }).catch(function (e) {
            console.warn('service worker não registrou:', e);
          });
        };
        if (document.readyState === 'complete') registrarSW();
        else window.addEventListener('load', registrarSW);
        setTimeout(registrarSW, 2500);
      }

      /*
       * Recarrega quando existe versão nova no servidor.
       *
       * ── O problema que isto resolve ────────────────────────────────────
       *
       * O usuário apagou os dados, refez o cadastro do zero e recebeu o MESMO
       * treino de antes — porque apagar dados não recarrega o app, e no iPhone
       * instalado na tela de início o iOS restaura a página em vez de navegar.
       * O código novo estava publicado havia horas e nunca tinha sido baixado.
       *
       * Comparar a versão do servidor com a que está rodando é a única checagem
       * que funciona nesse cenário: não depende de o service worker atualizar,
       * nem de o iOS decidir refazer a navegação.
       */
      (function () {
        var ATUAL = '__BUILD__';
        var JA = 'forja.recarregou.' + ATUAL;
        function conferir() {
          if (document.visibilityState === 'hidden') return;
          fetch('/versao.json', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (v) {
              if (!v || !v.build || v.build === ATUAL) return;
              // Trava de uma volta só: se recarregar e a versão continuar
              // diferente (CDN servindo cópia velha), não entra em laço.
              try {
                if (sessionStorage.getItem(JA)) return;
                sessionStorage.setItem(JA, '1');
              } catch (e) {}
              location.reload();
            })
            .catch(function () {});
        }
        document.addEventListener('visibilitychange', conferir);
        window.addEventListener('focus', conferir);
        setTimeout(conferir, 1500);
      })();
    </script>
`.replace('__BUILD__', BUILD);

let html = htmlBruto;

if (html.includes('rel="manifest"')) {
  console.log(`PWA: tags já presentes (build ${BUILD}).`);
  process.exit(0);
}

// viewport-fit=cover libera a área do notch; sem user-scalable o duplo toque
// não dá zoom acidental no meio da série.
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
);

html = html.replace(/<title>.*?<\/title>/i, '<title>Forja</title>');
if (!/<title>/i.test(html)) html = html.replace('</head>', '  <title>Forja</title>\n</head>');

html = html.replace('</head>', `${TAGS}  </head>`);

writeFileSync(INDEX, html);

const check = ['rel="manifest"', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'sw.js'];
const faltando = check.filter((c) => !html.includes(c));
console.log(
  faltando.length ? `PWA: FALTOU ${faltando.join(', ')}` : `PWA: index.html preparado (build ${BUILD}).`
);
process.exit(faltando.length ? 1 : 0);
