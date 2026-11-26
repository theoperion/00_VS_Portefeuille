/* Test v20.35 · Marchés de l'onglet Moi : 14 marchés (Semi-conducteurs et Semis ×3 compris), 6 en vue + « + 8 autres ».
   Lancer depuis la racine, serveur local ouvert (python3 -m http.server 8771). Fausses données uniquement. */
const { chromium } = require("playwright");
const NOMS = ["S&P 500", "MSCI Monde", "Nasdaq-100", "Nasdaq ×2", "Euro Stoxx 50", "Stoxx 600", "Émergents", "Or", "Or couvert €", "Nasdaq ×3", "Bitcoin", "Ethereum", "Semi-conducteurs", "Semis ×3"];
const marchesMoi = { jour: NOMS.map((n, i) => ({ nom: n, pct: (i - 6) / 1000, heure: "24/11 17:35" })), series: NOMS.map(n => ({ nom: n, v: [100, 101, 102] })), semaines: ["2026-11-06", "2026-11-13", "2026-11-20"] };
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Théo" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const moi = { ok: true, version: 13, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "", synthese: { valeur: 1000, apports: 900, gain: 100, epargne: 0 },
  indices: [], enveloppes: [], groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], perfLignes: null, historique: null, ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : versus) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
    await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(3500);
    await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
    const avant = await p.evaluate(() => ({ chips: [...document.querySelectorAll(".m-mk-chips [data-mk-cache]")].map(x => x.textContent), plus: (document.querySelector("[data-mk-plus]") || {}).textContent || null }));
    const lieu = p.locator(".m-mk-chips"); if (await lieu.count()) { await lieu.scrollIntoViewIfNeeded(); await lieu.screenshot({ path: "/tmp/mk-" + (sombre ? "sombre" : "clair") + ".png" }); }
    if (avant.plus) { await p.evaluate(() => document.querySelector("[data-mk-plus]").click()); await p.waitForTimeout(500); }
    const apres = await p.evaluate(() => ({ n: document.querySelectorAll(".m-mk-chips [data-mk-cache]").length, plus: (document.querySelector("[data-mk-plus]") || {}).textContent || null, deb: [...document.querySelectorAll(".m-mk-chips *")].some(x => x.getBoundingClientRect().right > innerWidth + 1) }));
    const tag = sombre ? " (sombre)" : " (clair)";
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(avant.chips.length >= 6 && avant.chips.length <= 7 && /Semi-conducteurs/.test(avant.chips.join("|")) && new RegExp("\\+ " + (14 - avant.chips.length) + " autres").test(avant.plus || ""), "6 marchés en vue (+ celui choisi), dont Semi-conducteurs, puis « + N autres »" + tag + " " + JSON.stringify(avant));
    ok(apres.n === 14 && /Moins/.test(apres.plus || "") && !apres.deb, "« + N autres » montre les 14 (Semis ×3 compris), rien ne déborde à 390 px" + tag);
    await ctx.close();
  }
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
