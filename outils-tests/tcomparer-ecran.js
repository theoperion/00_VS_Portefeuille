/* Test v20.54 · écran « 📋 Comparer avec mon relevé » (Moi › + › Importer un avis) : faux fichier Moi, fausse évaluation, serveur intercepté.
   0 erreur JS, ✓/⚠ affichés, « Corriger » ouvre la saisie pré-remplie, aucun envoi au fichier pendant la comparaison, lisible à 390 px clair/sombre.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tcomparer-ecran.js  (CAPTURES=dossier : captures) */
const { chromium } = require("playwright");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const EVAL = "EVALUATION DE PORTEFEUILLE - COMPTE PEA N° 0\nCumul de vos versements (**) 10 000,00 €\nAMUNDI PEA MONDE\nFR001400U5Q4 1 000 5,50 30/09/26 5 500,00 55,00 5,0000 500,00\nNASDAQ X2\nFR0010342592 40 112,50 30/09/26 4 500,00 45,00 100,1234 495,06\nTotal portefeuille au 30 septembre 2026 10 000,00";
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
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme }), p = await ctx.newPage(), err = [], envois = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); if (/FAUXMOI/.test(r.request().url()) && c.action && c.action !== "data") envois.push(c.action);
      r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi() : versus) }); });
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
      localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
    await p.goto("http://localhost:8771/index.html");
    await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    await p.evaluate(() => Moi.saisir()); await p.waitForTimeout(500); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));   // le petit tutoriel de la 1re saisie
    await p.click("#f-imp"); await p.waitForTimeout(200);
    await p.click("#f-cmp"); await p.waitForTimeout(200);
    await p.click("#f-cmp-coller"); await p.fill("#f-cmp-txt", EVAL); await p.click("#f-cmp-lire"); await p.waitForTimeout(300);
    const txt = await p.evaluate(() => (document.querySelector(".m-cmp") || {}).innerText || "");
    ok(/3 ✓ sur 4|✓ sur/.test(txt) && /⚠/.test(txt) && /LQQ/.test(txt), theme + " · résultats : ✓ et ⚠ (LQQ : 40 sur le relevé, 39 dans l'appli)", txt.slice(0, 200));
    ok(!(await p.$("#f-cmp-txt")), theme + " · le texte collé n'est plus à l'écran (rien n'est gardé)");
    const larg = await p.evaluate(() => document.documentElement.scrollWidth); ok(larg <= 390, theme + " · lisible à 390 px", larg);
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + "/comparer-" + theme + ".png" });
    if (theme === "light") {   // v20.54 : compte du relevé introuvable → on le demande (jamais un compte pris au hasard)
      await p.click("#f-cmp-autre"); await p.waitForTimeout(150); await p.click("#f-cmp-coller"); await p.fill("#f-cmp-txt", EVAL.replace("COMPTE PEA", "COMPTE")); await p.click("#f-cmp-lire"); await p.waitForTimeout(200);
      const t2 = await p.evaluate(() => document.querySelector(".m-cmp").innerText);
      ok(/Compte introuvable/.test(t2) && !!(await p.$("#f-cmp-env")) && !/✓/.test(t2), "Compte du relevé introuvable : « choisis-le », aucune comparaison sur un compte au hasard", t2.slice(0, 160));
      await p.selectOption("#f-cmp-env", "PEA Test"); await p.waitForTimeout(200);
      ok(/PEA Test/.test(await p.evaluate(() => document.querySelector(".m-cmp").innerText)), "Compte choisi : la comparaison se fait sur lui");
    }
    await p.click("[data-cmp-corr]"); await p.waitForTimeout(400);
    const f = await p.evaluate(() => ({ cmp: !!document.querySelector(".m-cmp"), qte: (document.querySelector("#f-qte") || {}).value }));
    ok(!f.cmp && f.qte === "1", theme + " · « Corriger » : la saisie s'ouvre avec 1 part (à relire)", f);
    ok(!envois.length, theme + " · rien envoyé au fichier", envois);
    ok(!err.length, theme + " · 0 erreur JS", err.slice(0, 3));
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
