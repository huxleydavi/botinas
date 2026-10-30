/* Service worker do sistema Aristóteles Botinas
   Guarda o sistema e as bibliotecas no aparelho para abrir mesmo sem internet.
   Para publicar uma nova versão do sistema, troque o número em VERSAO. */
const VERSAO = 'aristoteles-v1';
const BIBLIOTECAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap'
];
const HOSTS_EXTERNOS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await Promise.all(['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(u => cache.add(u).catch(() => {})));
    await Promise.all(BIBLIOTECAS.map(async u => {
      try { await cache.put(u, await fetch(u, { mode: 'no-cors' })); } catch (e) { /* tenta de novo no uso */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // bibliotecas e fontes de fora: usa o que está guardado; se não houver, busca e guarda
  if (HOSTS_EXTERNOS.indexOf(url.hostname) >= 0) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      try {
        const resp = await fetch(req);
        if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
        return resp;
      } catch (e) { return guardado || Response.error(); }
    })());
    return;
  }

  // o próprio sistema: tenta a internet (para pegar atualizações) e, sem sinal, usa o que está guardado
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        const guardado = await cache.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        if (req.mode === 'navigate') { const raiz = await cache.match('./'); if (raiz) return raiz; }
        return Response.error();
      }
    })());
  }
});
