/* Test v20.24 · « simple joueur, sans admin » : que voit-on des règles 2027 selon la date ?
   v20.96 · la fenêtre « Nouvelles règles » est un paquet de cartes à glisser : une phrase de 10 mots au plus par carte, titre de 2 à 4 mots,
   navigation au doigt (toucher, glisser) et au clavier (flèches), bouton retour du téléphone qui ferme, rien qui déborde à 390 px, « 📖 Toutes les règles » ouvre les tuiles.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tannonce.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, CAPT = process.env.CAPTURES || "";   // v20.58 : PORT=… pour un autre port ; CAPTURES=dossier pour les captures 390 px (clair et sombre) des deux annonces
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
function fausses(etapes, cinq) {   // relevés inventés de janvier à novembre 2026
  const rows = i => { const l = []; for (let m = 1; m <= 11; m++) { const v = 10000 + 300 * m + 50 * i * m; l.push([202600 + m, "2026-" + String(m).padStart(2, "0") + "-28", [v, v * 0.6, v * 0.4, 0, 0, 0, 0, 0], Array(25).fill(0).map((_, j) => j === 1 ? v : 0)]); } return l; };
  return { ok: true, genere: "2026-11-24T10:00:00", majTexte: "Dernier relevé : novembre 2026", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.concat(cinq ? ["Nicolas"] : []).map((n, i) => ({ nom: n, rows: rows(i) })),
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: Array.from({ length: 11 }, (_, m) => [202601 + m, 0.01, 0.012, 0.005]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 5, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: etapes || {},
    liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
    session: { role: "perso", nom: "Kévin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
}
// mots des règles annoncées le 1er janvier : jamais avant
const CACHES = [/archer elfe/i, /forêt endormie/i, /12 circuits dévoilés/i, /rattrapage/i, /éclipse/i, /côté obscur/i, /bonus d'équipe/i, /🤝/, /La série/i, /🔥 Série/, /Finale/, /Rassemblement des héros/i, /Les niveaux/i, /🎴/];
// règles à jouer en janvier : visibles dès le 20 décembre
const JOUER = [/Défi du mois/, /Pronostic/i, /Rival/, /pièges/i];
// v20.58 : la promesse du 20/12 (sans rien dévoiler), jamais avant le 20/12, jamais dans l'annonce du 1/1
const PROMESSE = [/Et ce n'est que le début/i, /Un mini-jeu par univers/, /Trophées en 4 vitrines/, /Objets d'écurie/, /Rendez-vous le 1er janvier/];   // v20.96 : la dernière carte, 3 icônes
// v20.58 : la révélation du 1/1 cite les règles 2027 à jour
const PREMIER = [/Le Côté obscur/, /marque double\s*🛟 2 points au moins/, /Juin[\s\S]{0,60}Bataille spatiale[\s\S]{0,20}🌑 Le Côté obscur : Le dernier du classement marque double \(2 points au moins\)/i, /Avr[\s\S]{0,60}🏹 L'œil de l'archer elfe : Battre le S&P 500 rapporte 2 points au lieu d'un/i, /Mai[\s·.]*🌿 Pandora[\s·]*La forêt endormie : Carte 🚀 Turbo interdite/i,
  /Janv[\s\S]{0,60}🪱 Le Chevaucheur des sables/i, /Déc[\s\S]{0,60}🦸 Le Rassemblement des héros/i, /Couloirs mouvants : À moins de 0,2 point d'écart \(ex\. 3,1 % et 3,2 %\)/, /Le thé du Chapelier/, /Le chant des Sirènes/];
// textes faux ou périmés : jamais, à aucune date
const PERIMES = [/aller et retour/i, /graines sacrées/i, /Chaleur/, /atout du circuit|atouts? des circuits|bouchon/i];   // atout du circuit supprimé le 26/11 (Théo)
// v20.59 : « Le Podium en bref » ne cite une règle 2027 qu'une fois révélée
const TUTO_AVANT_20 = /défi|pronostic|pole|rival|chevaucheur/i, TUTO_AVANT_1 = /côté obscur|série|rassemblement/i, TUTO_JAMAIS_JANV = /finale|régularité/i;
const ADMIN = [/admin/i, /Aperçu/, /Circuits 2027/, /Voir décembre/, /Tout afficher/];
// « 🎁 Prochainement » (noms et mois des règles pas encore annoncées) : visible des joueurs dès le 1/1 (v17.15 ; déjà le cas en v20.95, en majuscules),
// jamais avant (pendant la chauffe, rien sur ce qui arrive). v20.97 l'a replié dans le Stand : son titre n'est plus en majuscules, d'où la règle par date.
const PROCHAINEMENT = /Prochainement/i;
const CAS = [
  { d: "2026-12-19T12:00:00", jouer: false, caches: true },
  { d: "2026-12-20T09:00:00", jouer: true, caches: true },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true },
  { d: "2027-01-01T10:00:00", jouer: true, caches: false },
  { d: "2027-01-01T10:00:00", jouer: true, caches: false, neuf: true, tout: true },   // v20.96 : un joueur qui n'a rien ouvert le 20/12 : tout le paquet (10 règles + 12 circuits + fin)
  { d: "2027-01-02T10:00:00", jouer: true, caches: false, cinq: true },   // 5 pilotes : barème 6 · 4 · 2 · 1 · 0
  // dates réglées à janvier par l'admin (ou ramenées à janvier par le serveur) : toujours annoncées le 1/1 seulement
  { d: "2026-12-20T09:00:00", jouer: true, caches: true, neuf: true, etapes: { pioche: 202701, monaco: 202701, equipe: 202701, serie: 202701 } },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true, etapes: { pioche: 202701, monaco: 202701, equipe: 202701, serie: 202701 } }
];
/* v20.96 · le paquet de cartes : phrase, titre, débordement, doigt, clavier ; captures CAPTURES=… (3 cartes et la dernière, clair et sombre) */
const motsDe = t => String(t).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
async function etat(p) { return p.evaluate(() => { const o = document.querySelector(".nvs"); return o ? o.dataset.carte + "|" + o.querySelector(".nvs-n").textContent : "fermé"; }); }
async function cartes(p, c) {
  const ko = [], ids = await p.evaluate(() => [...document.querySelectorAll(".nvs-carte")].map(x => x.dataset.nvsCarte)), n = ids.length, tag = c.d.slice(0, 10);
  // textes courts
  const txt = await p.evaluate(() => [...document.querySelectorAll(".nvs-carte")].map(x => ({ id: x.dataset.nvsCarte, t: (x.querySelector(".nvs-t") || {}).textContent || "", ph: (x.querySelector(".nvs-ph") || {}).textContent || "", g: (x.querySelector(".nvs-gain") || {}).textContent || "" })));
  txt.forEach(x => { if (motsDe(x.ph) > 10 || !x.ph) ko.push("carte " + x.id + " : phrase de " + motsDe(x.ph) + " mots (10 au plus) « " + x.ph + " »");
    if (x.id !== "fin" && (motsDe(x.t) < 2 || motsDe(x.t) > 4)) ko.push("carte " + x.id + " : titre de " + motsDe(x.t) + " mots « " + x.t + " »"); });
  if (process.env.VOIR) txt.forEach(x => console.log("   · " + x.id + " | " + x.t + " | " + x.ph + " | " + x.g));
  if (ids[n - 1] !== "fin") ko.push("la dernière carte n'est pas la carte de fin");
  // clavier
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150); const e1 = await etat(p);
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(150); const e0 = await etat(p);
  if (e1 !== ids[1] + "|2" || e0 !== ids[0] + "|1") ko.push("clavier : flèches → " + e1 + " puis ← " + e0);
  // doigt : toucher à droite, toucher à gauche, glisser vers la gauche puis vers la droite
  const r = await p.evaluate(() => { const b = document.querySelector(".nvs-c").getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const my = r.y + r.h * 0.42;
  await p.mouse.click(r.x + r.w * 0.85, my); await p.waitForTimeout(150); const t1 = await etat(p);
  await p.mouse.click(r.x + r.w * 0.12, my); await p.waitForTimeout(150); const t0 = await etat(p);
  const glisser = async (de, a) => { await p.mouse.move(de, my); await p.mouse.down(); await p.mouse.move((de + a) / 2, my + 4); await p.mouse.move(a, my + 6); await p.mouse.up(); await p.waitForTimeout(150); };
  await glisser(r.x + r.w * 0.8, r.x + r.w * 0.2); const g1 = await etat(p);
  await glisser(r.x + r.w * 0.2, r.x + r.w * 0.8); const g0 = await etat(p);
  if (t1 !== ids[1] + "|2" || t0 !== ids[0] + "|1" || g1 !== ids[1] + "|2" || g0 !== ids[0] + "|1") ko.push("doigt : toucher " + t1 + " / " + t0 + ", glisser " + g1 + " / " + g0);
  // chaque carte : rien ne déborde à 390 px ; captures
  const capt = CAPT && !c.etapes && !c.tout && (tag === "2026-12-20" || tag === "2027-01-01");
  const aCapturer = tag === "2026-12-20" ? ["prono", "pole", "rival", "fin"] : ["pioche", "monaco", "circuits", "fin"];
  for (let k = 0; k < n; k++) {
    if (k) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(420); }
    const d = await p.evaluate(() => { const o = document.querySelector(".nvs-c"), b = o.getBoundingClientRect(), vis = document.querySelector(".nvs-carte:not([hidden])"), l = [];
      if (b.left < 0 || b.right > innerWidth + .5 || b.top < 0 || b.bottom > innerHeight + .5) l.push("fenêtre hors écran");
      if (document.documentElement.scrollWidth > innerWidth) l.push("défilement horizontal");
      vis.querySelectorAll("*").forEach(x => { const q = x.getBoundingClientRect(); if (q.width && (q.left < b.left - 8 || q.right > b.right + 8 || q.top < b.top - 1 || q.bottom > b.bottom + 1)) l.push((x.className || x.tagName) + " déborde"); if (x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== "visible") l.push((x.className || x.tagName) + " coupé"); });
      return l; });
    if (d.length) ko.push("carte " + ids[k] + " à 390 px : " + [...new Set(d)].join(", "));
    if (capt && aCapturer.includes(ids[k])) for (const sch of ["light", "dark"]) {
      await p.emulateMedia({ colorScheme: sch }); await p.waitForTimeout(250);
      await p.screenshot({ path: CAPT + "/" + (tag === "2026-12-20" ? "20dec" : "1jan") + "-" + String(k + 1).padStart(2, "0") + "-" + ids[k] + "-" + (sch === "light" ? "clair" : "sombre") + ".png" });
    }
  }
  if (await etat(p) !== "fin|" + n) ko.push("après " + n + " cartes, on n'est pas sur la carte de fin : " + await etat(p));
  await p.emulateMedia({ colorScheme: "light" });
  return ko;
}
/** le bouton retour du téléphone ferme la fenêtre ; « 📖 Toutes les règles » ouvre les règles en tuiles */
async function retourEtRegles(p, c) {
  const ko = [];
  await p.evaluate(() => history.back()); await p.waitForTimeout(600);
  if (await p.$(".nvs")) ko.push("bouton retour : la fenêtre ne se ferme pas");
  if (c.d.startsWith("2026-12-20")) {
    const r = await p.evaluate(async () => { document.querySelectorAll(".tuto, .revel").forEach(x => x.remove());
      ouvrirNouveautes(etapesJeu().filter(e => annonceEtape(e) === 20261220 && regleVisible(e.id)));
      const o = document.querySelector(".nvs"); if (!o) return "pas rouverte"; const n = o.querySelectorAll(".nvs-carte").length;
      for (let k = 1; k < n; k++) document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const b = o.querySelector('.nvs-carte:not([hidden]) [data-nv="regles"]'); if (!b) return "pas de bouton sur la dernière carte"; b.click();
      await new Promise(r => setTimeout(r, 200)); const g = document.querySelector(".regles.rgt"), ok = !!g && !document.querySelector(".nvs") && !!g.querySelector(".rgt-som:not([hidden])");
      if (g) g.remove(); document.documentElement.classList.remove("fige"); return ok ? "ok" : "les règles en tuiles ne s'ouvrent pas"; });
    if (r !== "ok") ko.push("📖 Toutes les règles : " + r);
  }
  return ko;
}
(async () => {
  const b = await chromium.launch(); let nok = 0;
  // un seul téléphone pour toutes les dates : comme un vrai joueur qui revient jour après jour
  let ctx = null;
  for (const c of CAS) {
    if (!ctx || c.neuf) { if (ctx) await ctx.close(); ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }); }
    const p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date(c.d));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(c.etapes, c.cinq)) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
    await p.waitForTimeout(2500);
    const kc = await p.$(".nvs") ? await cartes(p, c) : [];
    // tout le texte du paquet : chaque carte, et le détail de chaque mois des 12 circuits (bulle de la tuile)
    const pop = await p.evaluate(() => { const t = document.querySelector(".tuto"); if (!t) return ""; t.querySelectorAll(".nvs-carte").forEach(x => { x.hidden = false; });
      const s = t.innerText + "\n@@MOIS@@\n" + [...t.querySelectorAll(".nvs-m")].map(m => m.title).join("\n"); t.querySelectorAll(".nvs-carte").forEach((x, j) => { x.hidden = j !== 0; }); return s; });
    if (pop) kc.push(...await retourEtRegles(p, c));
    await p.evaluate(() => { document.querySelectorAll(".tuto").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); });
    const textes = await p.evaluate(async () => {
      const out = [document.body.innerText];
      for (const y of [2026, 2027]) { try { choisirSaison(y); ETAT.podium = "stand"; garder(); allerA("trophees"); rendreTrophees(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); out.push(document.body.innerText); }
      try { ouvrirTuto(); const t = document.querySelector(".tuto"); out.push("@@TUTO@@" + t.innerText + "@@FIN@@"); t.remove(); } catch (e) { out.push("@@TUTO@@ERREUR tuto " + e.message + "@@FIN@@"); }
      try { ouvrirRegles(); document.querySelectorAll(".regles .rgt-f").forEach(f => { f.hidden = false; }); document.querySelectorAll(".regles details").forEach(d => { d.open = true; }); out.push(document.querySelector(".regles").innerText); document.querySelector(".regles").remove(); } catch (e) { out.push("ERREUR règles " + e.message); }
      return out.join("\n");
    });
    const tout = pop + "\n" + textes, ko = kc.slice();
    if (err.length) ko.push("erreurs JS : " + err.join(" | "));
    if (c.caches) CACHES.forEach(r => { const m = tout.match(r); if (m) ko.push("visible trop tôt : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.caches) { const m = tout.match(PROCHAINEMENT); if (m) ko.push("« Prochainement » visible avant le 1/1 : …" + tout.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ")); }
    ADMIN.forEach(r => { const m = tout.match(r); if (m) ko.push("trace d'admin : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.jouer) JOUER.forEach(r => { if (!r.test(tout)) ko.push("absent alors qu'attendu : " + r); });
    else JOUER.slice(0, 3).forEach(r => { if (r.test(tout)) ko.push("visible trop tôt : " + r); });
    if (c.d.startsWith("2026-12-20") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 20/12");
    if (c.d.startsWith("2026-12-20") && !/pronostic/i.test(pop)) ko.push("le 20/12, la fenêtre ne présente pas le pronostic");
    if (c.d.startsWith("2027-01-01") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 1/1");
    if (c.tout && (!/pronostic/i.test(pop) || !/rattrapage/i.test(pop) || !/12 circuits dévoilés/i.test(pop))) ko.push("le 1/1 sans avoir vu le 20/12 : le paquet devrait tout contenir");
    if (c.d.startsWith("2027-01-01") && !c.tout && (/pronostic|défi du mois|rival/i.test(pop.split(/12 circuits dévoilés/i)[0]) || !/rattrapage/i.test(pop))) ko.push("le 1/1, la fenêtre devrait montrer seulement les règles restantes");
    const tuto = (tout.match(/@@TUTO@@([\s\S]*?)@@FIN@@/) || [, "(pas de guide)"])[1];
    if (/ERREUR|pas de guide/.test(tuto)) ko.push("guide « Le Podium en bref » : " + tuto);
    const bar = c.cinq ? "6 · 4 · 2 · 1 · 0" : "6 · 4 · 2 · 0";
    if (!tuto.includes(bar + " points")) ko.push("guide : barème attendu « " + bar + " »");
    if (c.cinq && tuto.includes("6 · 4 · 2 · 0")) ko.push("guide : ancien barème à 4 alors qu'il y a 5 pilotes");
    if (!c.jouer) { const m = tuto.match(TUTO_AVANT_20); if (m) ko.push("guide : « " + m[0] + " » cité avant le 20/12"); }
    if (c.caches) { const m = tuto.match(TUTO_AVANT_1); if (m) ko.push("guide : « " + m[0] + " » cité avant le 1/1"); }
    { const m = tuto.match(TUTO_JAMAIS_JANV); if (m) ko.push("guide : « " + m[0] + " » cité avant son annonce (novembre 2027)"); }
    if (c.jouer && !/Chevaucheur des sables/.test(tuto)) ko.push("guide : le Chevaucheur (janvier) manque dès le 20/12");
    if (!c.caches && !/Côté obscur[^.]*2 points au moins/.test(tuto)) ko.push("guide : le Côté obscur (2 points au moins) manque le 1/1");
    if (process.env.VOIR) console.log("  guide : " + tuto.replace(/\s+/g, " "));
    if (c.d.startsWith("2026-12-20") && !c.etapes && !/Et ce n'est que le début…\s*Rendez-vous le 1er janvier\s*Compris 🏁\s*📖 Toutes les règles\s*@@MOIS@@/i.test(pop)) ko.push("le 20/12, la dernière carte « Et ce n'est que le début » manque");
    if (c.d.startsWith("2026-12-20") && !c.etapes) PROMESSE.forEach(r => { if (!r.test(pop)) ko.push("le 20/12, la promesse manque : " + r); });
    if (!c.jouer || c.d.startsWith("2027")) PROMESSE.forEach(r => { if (r.test(tout)) ko.push("promesse du 20/12 visible hors de son annonce : " + r); });
    if (c.d.startsWith("2027-01-01")) PREMIER.forEach(r => { if (!r.test(pop)) ko.push("le 1/1, la révélation ne cite pas : " + r); });
    if (c.d.startsWith("2027-01-01") && ((pop.split("@@MOIS@@")[1] || "").match(/🌿/g) || []).length !== 1) ko.push("le 1/1, 🌿 doit apparaître une seule fois dans le détail des mois (mai)");
    if (c.d.startsWith("2027-01-01") && /Finale|éclipse/i.test(pop)) ko.push("le 1/1, la révélation parle de la Finale (annoncée en novembre) ou garde l'ancien nom « éclipse »");
    PERIMES.forEach(r => { const m = tout.match(r); if (m) ko.push("texte périmé : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.d.startsWith("2027-01-02") && pop) ko.push("le 2/1, la fenêtre revient alors que tout a été vu");
    if (process.env.VOIR && pop) console.log(pop);
    console.log((ko.length ? "NON " : "OUI ") + c.d.slice(0, 10) + (c.etapes ? " (dates réglées)" : "") + (pop ? "  · fenêtre : " + pop.replace(/\s+/g, " ").slice(0, 140) : ""));
    ko.forEach(k => console.log("     ✗ " + k)); nok += ko.length;
    await p.close();
  }
  await b.close(); process.exit(nok ? 1 : 0);
})();
