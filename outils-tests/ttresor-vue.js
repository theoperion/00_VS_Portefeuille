/* Test v20.62 · chasse au trésor : l'objet n'apparaît que tout près (moins de 60 m), petit (9 à 16 px), et jamais à travers le décor.
   Aperçu admin uniquement (cachette d'exemple inventée, rien n'est envoyé ; les vraies cachettes sont privées, côté serveur).
   Fausses données ; serveur local ouvert (python3 -m http.server 8771). */
const { chromium } = require("playwright");
const fausses = session => ({ ok: true, version: 84, genere: "2026-12-01T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses({ role: "admin" })) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.apercuSaison", "1"); sessionStorage.setItem("versus.adminOn", "1"); });
  await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => { montrerVue("trophees"); }); await p.waitForTimeout(600);
  await p.evaluate(() => ouvrirApercuTresor());
  await p.waitForFunction(() => TRESOR_APERCU && TRESOR_APERCU.F.p, null, { timeout: 20000 });
  const etat = async () => p.evaluate(() => { const t = document.querySelector(".gp-piste .gp-tresor"), a = GP_INST.api; return { op: t ? +getComputedStyle(t).opacity : -1, w: t ? t.getBoundingClientRect().width : 0, zoom: a.zoom(), masque: a.masque(TRESOR_APERCU.F.p) }; });
  ok(await p.evaluate(() => typeof GP_INST.api.masque === "function"), "la 3D sait dire si le décor cache un point (masque)");
  await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
  const pres = await etat();
  ok(pres.op > .5 && pres.w >= 9 && pres.w <= 16 && !pres.masque, "🎯 tout près de la cachette d'exemple : l'objet se montre, petit (9 à 16 px) " + JSON.stringify(pres));
  await p.evaluate(() => GP_INST.api.viser([TRESOR_APERCU.F.p[0], TRESOR_APERCU.F.p[2]], .13, .55)); await p.waitForTimeout(1500);
  const loin = await etat();
  ok(loin.op === 0, "à 0,13 de zoom (plus de 60 m) : invisible (avant : visible jusqu'à 92 m) " + JSON.stringify(loin));
  // un point quelconque caché par le décor : l'objet y est placé, il ne se montre pas
  const cache = await p.evaluate(async () => { const a = GP_INST.api, F = TRESOR_APERCU.F, P0 = F.p.slice(); a.viser([P0[0], P0[2]], .06, .3); await new Promise(r => setTimeout(r, 900));
    for (const y of [.5, -1.5]) for (let dx = -60; dx <= 60; dx += 3) for (let dz = -60; dz <= 60; dz += 3) { const q = [P0[0] + dx, y, P0[2] + dz], e = a.projeter(q); if (!e || !e.vis || e.d > 50 || !a.masque(q)) continue;
      F.p = q; poserTresorDOM(document); await new Promise(r => setTimeout(r, 500)); const t = document.querySelector(".gp-piste .gp-tresor"), e2 = a.projeter(q); return { trouve: true, y, d: Math.round(e2.d), masque: a.masque(q), op: t ? +getComputedStyle(t).opacity : -1 }; }
    return { trouve: false }; });
  ok(cache.trouve && cache.masque && cache.d < 60 && cache.op === 0, "à moins de 60 m mais derrière le décor : l'objet reste invisible " + JSON.stringify(cache));
  ok(!err.length, "0 erreur JS " + JSON.stringify(err.slice(0, 3)));
  await b.close(); console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
