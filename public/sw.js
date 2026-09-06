const CACHE_NAME = "samrat-app-v1"
const PRECACHE = ["/", "/login", "/generate-bill", "/generate-bill/scan", "/offline.html", "/icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined))
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

function shouldBypass(request, url) {
  if (request.method !== "GET") return true
  if (url.origin !== self.location.origin) return true
  if (url.pathname.includes("hot-update") || url.pathname.includes("webpack-hmr")) return true
  if (url.pathname.startsWith("/api/")) return true
  return false
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2|woff|png|svg|ico|webp|jpg)$/i.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (shouldBypass(request, url)) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || Response.error()
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === "navigate") {
      return (
        (await caches.match("/generate-bill/scan")) ||
        (await caches.match("/offline.html")) ||
        new Response("Offline. Open this site once while online, then billing will work without network.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      )
    }
    return Response.error()
  }
}
