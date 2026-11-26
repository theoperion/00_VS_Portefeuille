/* Versus : mode hors connexion.
   La coquille de l'appli (page, scripts, icônes) est gardée sur le téléphone pour s'ouvrir sans réseau.
   Réseau d'abord : en ligne, on prend toujours la dernière version ; hors ligne (ou réseau trop lent), la copie gardée.
   Les appels à l'API (script.google.com) ne passent jamais par ici : l'appli garde elle-même ses dernières données. */
importScripts("version.js");   // LE numéro de version (un seul endroit) : un changement là-bas met à jour le hors connexion
const VERSION = "versus-" + ((self.VERSUS_VERSION || {}).app || "0");
const JS = ["sons", "icones", "1-base", "2-jeu", "3-podium", "4-grandprix", "5-plateau", "6-voiture3d", "7-bilan", "8-eredor-demarrage", "9-minijeux", "10-avent", "11-regles"].map(n => "js/" + n + ".js");   // V14.2 : index.html découpé
const COQUILLE = ["./", "index.html", "css/versus.css", "version.js", "moteur.js", "moi.js", "img/cartes/cartes.js", "piste.js", ...JS, "manifest.webmanifest", "icon5-180.png", "icon5-192.png", "icon5-512.png", "icon5.svg"];
/* v20.53 · les cartes peintes cuites (img/cartes/*.webp) sont gardées dans un cache à part, qui survit aux mises à jour : chaque image porte
   l'empreinte de son dessin (?v=…), elle n'est retéléchargée que si le dessin change. Ne sont gardées D'AVANCE que les cartes que la page demande
   (les circuits que le joueur peut voir aujourd'hui : jamais un univers pas encore révélé) ; les autres, à leur premier affichage, comme avant. */
const CARTES = "versus-cartes", RX_CARTE = /\/img\/cartes\/[\w-]+\.webp$/;
try { importScripts("img/cartes/cartes.js"); } catch (e) { /* liste absente : aucun ménage des anciennes versions */ }
async function garderCartes(urls) {
  const c = await caches.open(CARTES), deja = new Set((await c.keys()).map(r => r.url));
  const voulues = (urls || []).map(u => { try { return new URL(u, self.location); } catch (e) { return null; } }).filter(u => u && u.origin === self.location.origin && RX_CARTE.test(u.pathname) && u.search).map(u => u.href);
  await Promise.all(voulues.filter(u => !deja.has(u)).map(u => c.add(u).catch(() => null)));
}
async function menageCartes() {   // anciennes versions d'un dessin (empreinte changée)
  const l = self.CARTES_CUITES; if (!l) return; const c = await caches.open(CARTES);
  await Promise.all((await c.keys()).filter(r => { const u = new URL(r.url), k = (u.pathname.match(/([\w-]+)\.webp$/) || [])[1]; return !l[k] || u.searchParams.get("v") !== l[k]; }).map(r => c.delete(r)));
}
self.addEventListener("message", e => { const d = e.data || {}; if (Array.isArray(d.cartes) && d.cartes.length <= 6) e.waitUntil(garderCartes(d.cartes).catch(() => null)); });
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(COQUILLE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
// 14.3.1 : ne nettoie que SES caches (versus-…) : les autres applis du même site (carnets) gardent leur hors connexion
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k.startsWith("versus-") && k !== VERSION && k !== CARTES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
  menageCartes().catch(() => null);
});
function delai(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("lent")), ms)); }
async function reseauDabord(e, ms) {
  const req = e.request;
  const frais = (req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" }))   // revalide auprès de GitHub
    .then(rep => { if (rep && rep.ok) { const copie = rep.clone(); return caches.open(VERSION).then(c => c.put(req, copie)).then(() => rep); } return rep; });
  e.waitUntil(frais.catch(() => null));   // réseau lent : la nouvelle version est gardée même si elle arrive après le délai
  const cache = await caches.open(VERSION);
  // v19.5 : une réponse ratée (404/500 pendant une mise en ligne de GitHub) ou trop lente ne casse plus l'appli :
  // on sert la copie gardée, même d'une version précédente, et à défaut on attend le réseau au lieu d'échouer
  const garde = async () => (await cache.match(req, { ignoreSearch: req.mode === "navigate" })) || (await caches.match(req, { ignoreSearch: req.mode === "navigate" }))
    || (req.mode === "navigate" ? (await cache.match("index.html")) || (await caches.match("index.html")) : null);
  try {
    const rep = await Promise.race([frais, delai(ms)]);
    if (rep && rep.ok) return rep;
    return (await garde()) || rep;
  } catch (err) {
    const c = await garde();
    if (c) return c;
    try { return await frais; } catch (e2) { throw err; }
  }
}
async function cacheDabord(req, nom) {
  const cache = await caches.open(nom || VERSION), c = await cache.match(req);
  if (c && nom === CARTES) return c;   // une carte cuite ne change jamais sous la même adresse : pas besoin de la redemander
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
  if (RX_CARTE.test(u.pathname) && u.search) { e.respondWith(cacheDabord(req, CARTES)); return; }   // v20.53 : carte cuite (empreinte dans l'adresse)
  if (req.mode === "navigate" || /\.(html|js|css)$/.test(u.pathname) || u.pathname.endsWith("/")) { e.respondWith(reseauDabord(e, 4000)); return; }
  e.respondWith(cacheDabord(req));
});
