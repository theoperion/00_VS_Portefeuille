/* Test v20.66 · « + » de Moi : la barre « Mouvement / Historique » est TOUJOURS visible en haut dès l'ouverture.
   Bug de Clément (25/11, Android) : les onglets n'apparaissaient qu'après « Importer un avis ». Cause : la feuille plein écran est une colonne
   flexible de la hauteur de l'écran ; quand l'étape « Quoi ? » dépassait cette hauteur (petit écran, gros texte du téléphone, carte des relevés…),
   le navigateur rétrécissait la barre (overflow: hidden → hauteur mini 0) jusqu'à 2 px au lieu de faire défiler la feuille.
   Profil type Clément (PEA, AV Linxea, AV Quintessa/Artema, fausses données), téléphones 360 à 412 px, appareil neuf (guide qui s'ouvre, fermé
   avec « C'est compris ») et appareil habitué, clair et sombre ; puis étape « Les chiffres » et Historique. 0 erreur JS.
   Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tonglets-saisie.js  (PORT=…, CAPTURES=dossier) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const moi = () => ({ ok: true, version: 14, genere: "2026-11-25T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [{ nom: "Versement Linxea", derniere: "2026-10-12", prochaine: "2026-11-12", statut: "⚠ En retard" }, { nom: "Relevé Quintessa (Artema)", derniere: "2026-10-15", prochaine: "2026-11-15", statut: "⚠ En retard" }] },
  prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "AV Linxea Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "AV Quintessa Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }],
    actifs: [{ code: "DCAM", nom: "Monde" }, { code: "ARTEMA", nom: "Artema" }], cours: {}, detenu: [{ env: "PEA Test", code: "DCAM", qte: 10, pru: 5 }, { env: "AV Quintessa Test", code: "ARTEMA", qte: 1, pru: 1000 }],
    journal: [{ ligne: 9, type: "Apport", enveloppe: "AV Linxea Test", date: "2026-10-12", montant: 200 }], raccourcis: [] } });
const versus = { ok: true, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Clément", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Clément" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
/* (« Importer un avis » la faisait réapparaître parce que le panneau d'import, seul à l'écran, tient dans la hauteur) */
/* la barre est-elle entière, à l'écran, et ses 2 boutons touchables (rien par-dessus) ? */
const barre = p => p.evaluate(() => {
  const s = document.querySelector("#m-seg"); if (!s) return { existe: false };
  const r = s.getBoundingClientRect(), bs = [...s.querySelectorAll("button")];
  const touchables = bs.every(b => { const q = b.getBoundingClientRect(), e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return q.height >= 30 && e && b.contains(e); });
  return { existe: true, cachee: s.hidden, haut: Math.round(r.top), hauteur: Math.round(r.height), dansEcran: r.top >= 0 && r.bottom <= innerHeight, touchables, textes: bs.map(b => b.innerText) };
});
const bonne = e => e.existe && !e.cachee && e.hauteur >= 36 && e.haut < 160 && e.dansEcran && e.touchables;
async function cas(b, w, h, neuf, theme) {
  const quoi = w + "×" + h + " · " + (neuf ? "appareil neuf" : "habitué") + " · " + theme;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: theme }), err = [];
  await ctx.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi() : versus) }));
  /* appareil neuf : rien sur le téléphone sauf l'adresse et la clé du fichier, saisies comme après le transfert */
  await ctx.addInitScript(neuf => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1"); localStorage.clear(); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" }));
    if (!neuf) { localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.guideOrdre.Clément", "1"); localStorage.setItem("versus.bullePortrait", "1"); } }, neuf);
  const p = await ctx.newPage(); p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.goto("http://localhost:" + PORT + "/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));   // tutoriel général de l'appli (pas celui de la saisie)
  await p.tap("#btn-saisie"); await p.waitForTimeout(700);
  const guide = await p.$(".tuto");
  ok(!!guide === neuf, quoi + " · guide « Saisir un ordre » " + (neuf ? "ouvert tout seul" : "pas rouvert"));
  if (guide) { await p.click(".tuto >> text=C'est compris"); await p.waitForTimeout(500); }
  let e = await barre(p);
  ok(bonne(e) && /Mouvement/.test(e.textes[0]) && /Historique/.test(e.textes[1]), quoi + " · « + » : barre Mouvement / Historique entière en haut, touchable", e);
  if (process.env.CAPTURES && w === 360 && neuf) await p.screenshot({ path: process.env.CAPTURES + "/onglets-" + w + "x" + h + "-" + theme + ".png" });
  ok(await p.evaluate(() => { const f = document.querySelector("#m-saisie .m-feuille"); return f.scrollHeight <= f.clientHeight || getComputedStyle(f).overflowY !== "visible"; }), quoi + " · ce qui dépasse se fait défiler dans la feuille");
  await p.click('#m-pane-ordre [data-type="Achat"]'); await p.waitForTimeout(300);
  e = await barre(p); ok(bonne(e) && /Les chiffres/.test(await p.evaluate(() => (document.querySelector("#m-pane-ordre .m-etapes .cur") || {}).innerText || "")), quoi + " · Achat › étape « Les chiffres » : barre toujours là", e);
  await p.evaluate(() => document.querySelector('[data-m-pane="journal"]').click());   // clic « de force » : avant la correction, la barre écrasée n'était plus touchable await p.waitForTimeout(300);
  e = await barre(p); ok(bonne(e) && await p.evaluate(() => !document.querySelector("#m-pane-journal").hidden), quoi + " · Historique : ouvert, barre toujours là", e);
  const larg = await p.evaluate(() => document.documentElement.scrollWidth); ok(larg <= w, quoi + " · rien ne déborde en largeur", larg);
  ok(!err.length, quoi + " · 0 erreur JS", err.slice(0, 3));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[360, 780], [412, 915], [360, 640], [360, 520]]) for (const neuf of [true, false]) await cas(b, w, h, neuf, "light");
  await cas(b, 360, 520, true, "dark"); await cas(b, 360, 640, false, "dark");
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
