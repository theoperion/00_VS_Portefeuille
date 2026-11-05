/* Versus : mode hors connexion.
   La coquille de l'appli (page, scripts, icônes) est gardée sur le téléphone pour s'ouvrir sans réseau.
   Réseau d'abord : en ligne, on prend toujours la dernière version ; hors ligne (ou réseau trop lent), la copie gardée.
   Les appels à l'API (script.google.com) ne passent jamais par ici : l'appli garde elle-même ses dernières données. */
importScripts("version.js");   // LE numéro de version (un seul endroit) : un changement là-bas met à jour le hors connexion
const VERSION = "versus-" + ((self.VERSUS_VERSION || {}).app || "0");
const JS = ["1-base", "2-jeu", "3-podium", "4-grandprix", "5-plateau", "6-voiture3d", "7-bilan", "8-eredor-demarrage"].map(n => "js/" + n + ".js");   // V14.2 : index.html découpé
const COQUILLE = ["./", "index.html", "css/versus.css", "version.js", "moteur.js", "moi.js", "piste.js", ...JS, "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "icon.svg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(COQUILLE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function delai(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("lent")), ms)); }
async function reseauDabord(e, ms) {
  const req = e.request;
  const frais = (req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" }))   // revalide auprès de GitHub
    .then(rep => { if (rep && rep.ok) { const copie = rep.clone(); return caches.open(VERSION).then(c => c.put(req, copie)).then(() => rep); } return rep; });
  e.waitUntil(frais.catch(() => null));   // réseau lent : la nouvelle version est gardée même si elle arrive après le délai
  const cache = await caches.open(VERSION);
  try {
    return await Promise.race([frais, delai(ms)]);
  } catch (err) {
    const c = await cache.match(req, { ignoreSearch: req.mode === "navigate" }) || (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (c) return c;
    throw err;
  }
}
async function cacheDabord(req) {
  const cache = await caches.open(VERSION), c = await cache.match(req);
  const frais = fetch(req).then(rep => { if (rep && (rep.ok || rep.type === "opaque")) cache.put(req, rep.clone()); return rep; }).catch(() => null);
  return c || (await frais) || Response.error();
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.hostname.endsWith("google.com") || u.hostname.endsWith("googleusercontent.com")) return;   // API : jamais en cache ici
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") { e.respondWith(cacheDabord(req)); return; }
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith("version.js") && u.search) return;   // vérification de mise à jour : jamais gardée (sinon le cache gonfle)
  if (req.mode === "navigate" || /\.(html|js|css)$/.test(u.pathname) || u.pathname.endsWith("/")) { e.respondWith(reseauDabord(e, 4000)); return; }
  e.respondWith(cacheDabord(req));
});
