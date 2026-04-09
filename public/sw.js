/* Minha Maya — Service Worker v1 */
const CACHE = 'maya-shell-v1';

// App shell: arquivos críticos que ficam em cache
const SHELL = [
  '/',
  '/login',
  '/index.html',
  '/manifest.json',
];

// ── Instala: pré-cache do shell ──────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── Ativa: limpa caches antigos ──────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first para API / Supabase, cache-first para assets ────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Passa direto para rede: Supabase, Google APIs, fontes externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('flagcdn.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Navegação (HTML) → network-first, fallback para cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos → cache-first, atualiza em background
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => null);

      return cached || network;
    })
  );
});
