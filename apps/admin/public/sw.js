// Service worker for Taravee Admin (installable PWA).
// Strategy: NETWORK-FIRST for everything same-origin — always loads the latest
// build when online, falls back to cache only when offline. This avoids serving
// a stale app shell / old chunks after a deploy. Bump CACHE to force-refresh.
const CACHE = "taravee-admin-v3";
const OFFLINE_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return; // never cache API calls

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache successful, complete responses — never a 404/redirect/opaque
        // (caching a 404 chunk is what made stale navigations break).
        if (res.ok && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((r) => r || (request.mode === "navigate" ? caches.match("/") : Response.error())),
      ),
  );
});
