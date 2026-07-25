/**
 * Service worker da Forja.
 *
 * Objetivo único: o app abrir e funcionar na academia sem internet. Os dados
 * já vivem no dispositivo (SQLite/OPFS) — o que falta cachear é o próprio app
 * e as imagens de exercício.
 */

const VERSAO = 'forja-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icones/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(VERSAO);
      // allSettled em vez de addAll: com addAll, UMA url que falhe rejeita o
      // install inteiro e o app fica sem cache offline nenhum — que é
      // justamente o que ele mais precisa ter.
      const r = await Promise.allSettled(APP_SHELL.map((u) => cache.add(u)));
      const falhas = r.filter((x) => x.status === 'rejected').length;
      if (falhas) console.warn(`[sw] ${falhas} item(ns) do shell não entraram no cache`);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Imagens de exercício vêm do GitHub: cacheia na primeira vez que aparecem,
  // para o exercício continuar ilustrado quando faltar sinal na academia.
  if (url.hostname === 'raw.githubusercontent.com') {
    e.respondWith(
      caches.open(`${VERSAO}-img`).then(async (cache) => {
        const salvo = await cache.match(req);
        if (salvo) return salvo;
        try {
          const resp = await fetch(req);
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação: tenta a rede (pega versão nova) e cai no cache se offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put('/index.html', copia));
          return resp;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Assets versionados por hash: cache primeiro, sem revalidar.
  e.respondWith(
    caches.match(req).then(
      (salvo) =>
        salvo ||
        fetch(req).then((resp) => {
          if (resp.ok && (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/'))) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
    )
  );
});
