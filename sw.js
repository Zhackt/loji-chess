/* LOJI_SW — Loji Chess service worker.
   Tugasnya: pas game pertama dibuka (internet nyala), simpan halaman +
   ikon ke HP. Sesudah itu game disajikan dari simpanan itu, jadi pintasan /
   aplikasi tetap kebuka walau data mati.
   File ini bekerja dari dua posisi: di root situs (scope = seluruh situs)
   atau di dalam folder assets/ (ia menghitung root dari posisinya sendiri).
   Naikkan nomor CACHE tiap rilis supaya simpanan lama diganti. */
var CACHE = "loji-chess-v31";
var SW_PATH = self.location.pathname || "/";
var SW_DIR = SW_PATH.slice(0, SW_PATH.lastIndexOf("/") + 1);
var IN_ASSETS = SW_DIR.slice(SW_DIR.length - 8) === "/assets/";
var ROOT = IN_ASSETS ? SW_DIR.slice(0, SW_DIR.length - 7) : SW_DIR;
var ASSETS = ROOT + "assets/";
var CORE = [
  ROOT,
  ROOT + "index.html",
  ASSETS + "manifest.webmanifest",
  ASSETS + "icon-192.png",
  ASSETS + "icon-512.png",
  ASSETS + "apple-touch-icon.png",
  ASSETS + "favicon-32.png",
  SW_DIR + "manifest.webmanifest",
  SW_DIR + "icon-192.png",
  SW_DIR + "icon-512.png",
  SW_DIR + "apple-touch-icon.png",
  SW_DIR + "favicon-32.png"
];

function precache(cache) {
  var seen = {};
  var jobs = [];
  CORE.forEach(function (u) {
    if (seen[u]) return;
    seen[u] = true;
    jobs.push(
      fetch(u).then(function (res) {
        if (res && res.ok) return cache.put(u, res);
      }).catch(function () { /* satu file gagal tidak menggagalkan sisanya */ })
    );
  });
  return Promise.all(jobs);
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(precache).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf("loji-chess-") === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    /* Halaman: cache dulu (langsung kebuka, offline pun bisa),
       jaringan jalan di belakang layar untuk menyegarkan simpanan. */
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(ROOT + "index.html", copy); });
          }
          return res;
        }).catch(function () { return null; });
        if (hit) return hit;
        return net.then(function (res) {
          if (res) return res;
          return caches.match(ROOT + "index.html", { ignoreSearch: true });
        });
      })
    );
    return;
  }

  /* Aset (ikon, manifest, dll.): cache dulu, jaringan kalau belum ada. */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
