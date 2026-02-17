/**
 * Modulo: frontend/public
 * Arquivo: sw.js
 * Funcao no sistema: service worker PWA (offline-first simples) com cache seguro e atualizavel.
 *
 * Observacoes importantes:
 * - Nao cachear respostas de API (`/api/*`), para nao mascarar dados reais.
 * - Navegacao (HTML) e "network-first" para evitar ficar preso em builds antigas.
 */
const CACHE_NAME = "cjm-patrimonio-v3";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const accept = event.request.headers.get("accept") || "";
  const isHtml = event.request.mode === "navigate" || accept.includes("text/html");

  // HTML: network-first (evita HTML velho preso no cache em deploys novos).
  if (isHtml) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", copy);
          return response;
        } catch (_error) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match("/");
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  const dest = event.request.destination || "";
  const isStaticAsset =
    dest === "script" ||
    dest === "style" ||
    dest === "image" ||
    dest === "font" ||
    url.pathname.startsWith("/assets/") ||
    CORE_ASSETS.includes(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, copy);
      return response;
    })(),
  );
});
