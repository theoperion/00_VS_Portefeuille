/* Test v20.54 · garde-fou des doublons à l'import : un avis enregistré puis réimporté AVANT que le fichier soit relu → « Doublon ? » ;
   après avoir changé de fichier (Moi.connecter) ou l'avoir oublié (Moi.oublier), plus jamais d'alerte ni de montant de l'ancien fichier.
   Faux fichier Moi, faux avis (tout inventé), serveur intercepté. Lancer : python3 -m http.server 8771 &  puis  node outils-tests/tdoublon-import.js */
const { chromium } = require("playwright");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const AVIS = "COMPTE PEA N° 0\nDésignation : AMUNDI PEA MONDE (FR001400U5Q4)\nDate d'exécution : 20/11/2026 à 10:00:00\nSens : Achat\nQuantité : 10\nCours : 5,50 EUR\nMontant brut : 55,00 EUR\nCourtage : 0,99 EUR\nMontant net : 55,99 EUR";
const moi = () => ({ ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }, { nom: "Retrait", tresorerie: -1, quantite: 0, flux: 1 }],
    actifs: [{ code: "DCAM", nom: "Amundi PEA Monde", isin: "FR001400U5Q4" }, { code: "LQQ", nom: "Nasdaq x2" }], cours: { DCAM: 5.5, LQQ: 112.5 },
    detenu: [{ env: "PEA Test", code: "DCAM", qte: 1000, pru: 5 }, { env: "PEA Test", code: "LQQ", qte: 39, pru: 100.1234 }], journal: [], raccourcis: [] } });
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }, { nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [], ordres = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (/FAUXMOI/.test(r.request().url()) && c.action === "ordre") { ordres.push(c.ordres); return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, message: "Ordre enregistré." }) }); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi() : versus) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const importer = async () => { await p.evaluate(() => Moi.saisir()); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll(".tuto, .guide").forEach(x => x.remove()));
    await p.evaluate(() => document.querySelector("#f-imp").click()); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector("#f-imp-coller").click()); await p.waitForTimeout(150);
    await p.fill("#f-imp-txt", AVIS); await p.evaluate(() => document.querySelector("#f-imp-lire").click()); await p.waitForTimeout(400); };
  const texte = () => p.evaluate(() => document.body.innerText);
  await importer();
  for (let i = 0; i < 6 && !ordres.length; i++) { await p.evaluate(() => { const b = document.querySelector("#f-envoyer"); if (b && !b.disabled) b.click(); }); await p.waitForTimeout(400); }
  ok(ordres.length === 1, "L'achat de l'avis est enregistré une fois (faux fichier)", ordres.length);
  await p.waitForTimeout(500);
  await importer();
  let t = await texte();
  ok(/Doublon \?/.test(t) && /Déjà enregistré/.test(t), "Même avis réimporté avant que le fichier soit relu : « Déjà enregistré… Doublon ? »");
  await p.evaluate(() => { Moi.connecter("https://script.google.com/macros/s/FAUXMOI2/exec", "autre-cle"); Moi.rafraichir(true); }); await p.waitForTimeout(1500);
  await importer(); t = await texte();
  ok(!/Doublon \?|Déjà enregistré/.test(t), "Après avoir relié un AUTRE fichier : plus d'alerte de doublon de l'ancien fichier");
  // on revient au 1er fichier, on enregistre l'avis, puis « oublier » : la mémoire des doublons doit être vidée
  await p.evaluate(() => { Moi.connecter("https://script.google.com/macros/s/FAUXMOI/exec", "cle-de-test"); Moi.rafraichir(true); }); await p.waitForTimeout(1500);
  await importer(); const n0 = ordres.length;
  for (let i = 0; i < 6 && ordres.length === n0; i++) { await p.evaluate(() => { const b = document.querySelector("#f-envoyer"); if (b && !b.disabled) b.click(); }); await p.waitForTimeout(400); }
  await p.evaluate(() => { Moi.oublier(); Moi.connecter("https://script.google.com/macros/s/FAUXMOI/exec", "cle-de-test"); Moi.rafraichir(true); }); await p.waitForTimeout(1500);
  await importer(); t = await texte();
  ok(ordres.length === n0 + 1 && !/Doublon \?|Déjà enregistré/.test(t), "Après « oublier » : plus rien de l'ancien fichier en mémoire (ni alerte ni montant)");
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
