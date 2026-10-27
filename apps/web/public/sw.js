// Khmio's service worker (2026-10-22 seller review): what makes the installed
// app open without the browser's error page when there's no internet. Pages
// always come from the network first, so sellers never see old orders; only
// when the network fails does a page fall back to the saved offline screen.
// Saved: that screen and the stylesheets it needs — no API answers, no shop data.
const CACHE = "khmio-offline-v2";
const OFFLINE_PAGES = { km: "/km/offline", en: "/en/offline" };

/** The offline screens, and every stylesheet they link to (their addresses change with each release, so they're read from the page). */
async function saveOfflineScreens() {
  const cache = await caches.open(CACHE);
  for (const path of Object.values(OFFLINE_PAGES)) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) continue;
    const html = await response.clone().text();
    await cache.put(path, response);
    const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));
    await Promise.all(styles.map((href) => cache.add(href).catch(() => undefined)));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(saveOfflineScreens());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const locale = new URL(request.url).pathname.startsWith("/en") ? "en" : "km";
        return (await caches.match(OFFLINE_PAGES[locale])) ?? Response.error();
      }),
    );
    return;
  }
  // The offline screen's saved stylesheets, only when the network can't answer.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && request.destination === "style") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
  }
});
