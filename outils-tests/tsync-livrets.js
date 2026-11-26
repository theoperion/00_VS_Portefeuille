/* Test (26/11/2026) · Réglages › Mon fichier › « 🔗 Synchroniser mes livrets » (lien Budget → livrets de Théo, lancé tout de suite).
   Fausses données uniquement, serveur Google intercepté (rien ne part).
   Vérifie : bouton présent seulement si le fichier envoie lienLivrets: true (absent sinon) ; un toucher envoie l'action « syncLivrets »
   avec la clé ; « Synchronisation… » pendant l'attente (bouton bloqué : pas de double envoi) ; résultat affiché (« ✅ 1 ligne(s) ajoutée(s) »,
   « Déjà à jour ») ; Moi se relit (frais) seulement s'il y a eu des changements ; erreur affichée en clair ; 0 erreur JS ;
   rien ne déborde à 390 px, en clair et en sombre. v21.08 : « Derniers changements (48 h) » affichés en liste, une ligne par changement,
   le livret en gras en tête (libellé ambigu : « → Livret A »), lignes les unes sous les autres, rien qui se recouvre.
   Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tsync-livrets.js   (PORT=… pour un autre port) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };

function moi(avecLien) {
  const o = { ok: true, version: 14, genere: "2026-11-26T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
    synthese: { valeur: 2000, apports: 1800, gain: 200, gainPct: 0.1 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 1700, gain: 0, gainPct: 0, twr: 0 }],
    groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
    parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
    ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }], types: [{ nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }],
      actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] } };
  if (avecLien) o.lienLivrets = true;
  return o;
}
const versus = { ok: true, genere: "2026-11-26T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Théo" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
/* réponses successives du fichier à « syncLivrets » */
const LISTE = "\n\nDerniers changements (48 h) :\n✅ ajouté · LEP · Apport · 10,00 € · 26/11 (18:31)\n❌ retiré · Livret A · Retrait · 200,00 € · 25/11 (18:36)"
  + "\n✅ ajouté · Livret A · Apport · 25,00 € · 25/11 (18:36) · « Livret A / LEP » → Livret A";
const REPONSES = [
  { ok: true, ajoutes: 1, retires: 0, message: "✅ 1 ligne(s) ajoutée(s), ❌ 0 retirée(s)." + LISTE },
  { ok: true, ajoutes: 0, retires: 0, message: "Déjà à jour : rien à changer.\n\nDerniers changements (48 h) :\naucun." },
  { ok: false, erreur: "budget", ajoutes: 0, retires: 0, message: "Budget illisible (Accès refusé) : rien n'a changé." + LISTE }
];

async function ouvrir(b, theme, avecLien) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme }), p = await ctx.newPage(), err = [], envois = [], lectures = [];
  let n = 0;
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
  await p.route("https://script.google.com/**", async r => {
    const c = JSON.parse(r.request().postData() || "{}"), estMoi = /FAUXMOI/.test(r.request().url());
    let corps = estMoi ? moi(avecLien) : versus;
    if (estMoi && c.action === "data") lectures.push({ frais: !!c.frais, t: Date.now() });
    if (estMoi && c.action && c.action !== "data") envois.push(c);
    if (estMoi && c.action === "syncLivrets") { await new Promise(x => setTimeout(x, 900)); corps = REPONSES[Math.min(n++, REPONSES.length - 1)]; }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(corps) });
  });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelectorAll(".tuto").forEach(x => x.remove()); ouvrirReglages("regl-moi"); });
  await p.waitForTimeout(400);
  return { ctx, p, err, envois, lectures };
}
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && !e.closest("[hidden]"); }, sel);
const etat = p => p.evaluate(() => { const e = document.getElementById("moi-livrets-etat"); return (e.firstChild && e.firstChild.nodeType === 3 ? e.firstChild.textContent : e.textContent).trim(); });
const liste = p => p.evaluate(() => [...document.querySelectorAll("#moi-livrets-etat .sync-recents li")].map(li => {
  const r = li.getBoundingClientRect(), b = li.querySelector("b");
  return { t: li.textContent, gras: b ? b.textContent : null, poids: b ? getComputedStyle(b).fontWeight : null, haut: r.top, bas: r.bottom, gauche: r.left };
}));
const titreListe = p => p.evaluate(() => { const t = document.querySelector("#moi-livrets-etat .sync-titre"); return t ? t.textContent : null; });
const deborde = p => p.evaluate(() => {
  const l = document.documentElement.scrollWidth, sec = document.getElementById("regl-moi");
  const hors = [...sec.querySelectorAll("*")].filter(e => e.offsetParent !== null).map(e => e.getBoundingClientRect()).filter(r => r.right > 391 || r.left < -1).length;
  return { l, hors };
});

(async () => {
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const q = "Théo · " + theme, { ctx, p, err, envois, lectures } = await ouvrir(b, theme, true);
    ok(await visible(p, "#moi-sync-livrets"), q + " · fichier avec lienLivrets : le bouton « 🔗 Synchroniser mes livrets » est là");
    ok(/Livret A, LDDS et LEP saisis dans le Budget \(sinon c'est automatique toutes les heures\)/.test(await p.evaluate(() => document.getElementById("moi-livrets").innerText)), q + " · phrase d'aide affichée");
    // 1er toucher : attente puis « 1 ligne ajoutée », et Moi se relit (frais)
    const avant = lectures.length;
    await p.click("#moi-sync-livrets"); await p.waitForTimeout(250);
    ok(/Synchronisation…/.test(await etat(p)) && await p.evaluate(() => document.getElementById("moi-sync-livrets").disabled), q + " · pendant l'attente : « Synchronisation… », bouton bloqué", await etat(p));
    await p.click("#moi-sync-livrets", { force: true }).catch(() => {}); await p.waitForTimeout(1300);
    const sync = envois.filter(c => c.action === "syncLivrets");
    ok(sync.length === 1 && sync[0].cle === "cle-de-test" && Object.keys(sync[0]).sort().join() === "action,cle", q + " · un seul envoi « syncLivrets », avec la clé (double toucher ignoré)", envois);
    ok(/✅ 1 ligne\(s\) ajoutée\(s\)/.test(await etat(p)) && !(await p.evaluate(() => document.getElementById("moi-sync-livrets").disabled)), q + " · résultat affiché : « ✅ 1 ligne(s) ajoutée(s) », bouton de nouveau utilisable", await etat(p));
    ok(lectures.slice(avant).some(x => x.frais), q + " · des lignes ont changé : Moi relit le fichier (rafraîchi)", lectures.slice(avant));
    { const L = await liste(p);
      ok(await titreListe(p) === "Derniers changements (48 h)" && L.length === 3, q + " · « Derniers changements (48 h) » : une liste de 3 lignes", L);
      ok(L[0] && L[0].t === "✅ ajouté · LEP · Apport · 10,00 € · 26/11 (18:31)" && L[1].t === "❌ retiré · Livret A · Retrait · 200,00 € · 25/11 (18:36)", q + " · chaque ligne telle qu'envoyée par le fichier", L.map(x => x.t));
      ok(L.map(x => x.gras).join() === "LEP,Livret A,Livret A" && L.every(x => +x.poids >= 600), q + " · le livret est en gras en tête de chaque ligne", L.map(x => [x.gras, x.poids]));
      ok(/« Livret A \/ LEP » → Livret A$/.test(L[2].t), q + " · libellé ambigu : « → Livret A » sur la même ligne", L[2]);
      ok(L.every((x, i) => !i || x.haut >= L[i - 1].bas - 0.5) && L.every(x => Math.abs(x.gauche - L[0].gauche) < 1), q + " · une ligne sous l'autre, alignées, rien qui se recouvre", L.map(x => [x.haut, x.bas])); }
    const lar = await deborde(p); ok(lar.l <= 390 && lar.hors === 0, q + " · rien ne déborde à 390 px", lar);
    if (process.env.CAPTURES) await p.locator("#moi-livrets").screenshot({ path: process.env.CAPTURES + "/sync-livrets-" + theme + ".png" });
    // 2e toucher : « Déjà à jour », pas de relecture
    const avant2 = lectures.length;
    await p.click("#moi-sync-livrets"); await p.waitForTimeout(1400);
    ok(/Déjà à jour/.test(await etat(p)) && lectures.length === avant2, q + " · 2e toucher : « Déjà à jour », pas de relecture inutile", { etat: await etat(p), lectures: lectures.length - avant2 });
    { const L = await liste(p); ok(L.length === 1 && L[0].t === "Aucun changement ces 48 dernières heures." && L[0].gras === null, q + " · aucun changement en 48 h : dit en clair (l'ancienne liste est effacée)", L); }
    // 3e toucher : erreur en clair
    await p.click("#moi-sync-livrets"); await p.waitForTimeout(1400);
    ok(/^⚠️ Budget illisible \(Accès refusé\) : rien n'a changé\.$/.test(await etat(p)), q + " · erreur du fichier affichée en clair", await etat(p));
    ok((await liste(p)).length === 3, q + " · erreur : les derniers changements restent affichés sous le message");
    const lar2 = await deborde(p); ok(lar2.l <= 390 && lar2.hors === 0, q + " · message d'erreur : rien ne déborde à 390 px", lar2);
    ok(envois.filter(c => c.action === "syncLivrets").every(c => Object.keys(c).sort().join() === "action,cle"), q + " · rien d'autre n'est envoyé que l'action et la clé");
    ok(!err.length, q + " · 0 erreur JS", err.slice(0, 3));
    await ctx.close();
  }
  for (const theme of ["light", "dark"]) {
    const q = "Autre joueur · " + theme, { ctx, p, err, envois } = await ouvrir(b, theme, false);
    ok(!(await visible(p, "#moi-sync-livrets")) && await p.evaluate(() => document.getElementById("moi-livrets").hidden), q + " · fichier sans lienLivrets : pas de bouton");
    ok(await visible(p, "#moi-enregistrer"), q + " · le reste de « Mon fichier » est bien affiché (témoin)");
    const lar = await deborde(p); ok(lar.l <= 390 && lar.hors === 0, q + " · rien ne déborde à 390 px", lar);
    ok(!envois.some(c => c.action === "syncLivrets"), q + " · aucun envoi « syncLivrets »");
    ok(!err.length, q + " · 0 erreur JS", err.slice(0, 3));
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
