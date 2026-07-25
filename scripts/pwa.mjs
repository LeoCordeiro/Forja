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
          navigator.serviceWorker.register('/sw.js').catch(function (e) {
            console.warn('service worker não registrou:', e);
          });
        };
        if (document.readyState === 'complete') registrarSW();
        else window.addEventListener('load', registrarSW);
        setTimeout(registrarSW, 2500);
      }
    </script>
`;

let html = readFileSync(INDEX, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('PWA: tags já presentes, nada a fazer.');
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
  faltando.length ? `PWA: FALTOU ${faltando.join(', ')}` : 'PWA: index.html preparado.'
);
process.exit(faltando.length ? 1 : 0);
