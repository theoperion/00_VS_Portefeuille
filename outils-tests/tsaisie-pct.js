/* Test v20.53 (25/11/2026) · relevé saisi à la main EN % (P3) et avertissement « versement saisi après le relevé » (P1).
   Clément (code perso) ouvre « + › Relevé » : le formulaire lui demande ses montants, mais l'appli n'envoie au Versus QUE des %
   (action relevePct) ; Théo (admin) garde son formulaire en euros. Fausses données ; serveur Google intercepté.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tsaisie-pct.js
   (CAPTURES=dossier : enregistre le formulaire en clair et en sombre à 390 px) */
const { chromium } = require("playwright");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const ligne = (k, val) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", [0, val, 0, 0, null, null, null, null], [0, val, 0, 0.01, val].concat([0, val, 0, 0.01, val], Array(15).fill(0))];
function donnees(session) {
  const p = n => ({ nom: n, rows: [ligne(202609, 1000), ligne(202610, 1010), [202611, "2026-11-30", Array(8).fill(null), Array(25).fill(null)]] });
  return { ok: true, version: 88, genere: "2026-11-30T20:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: ["Théo", "Clément"].map(p), marche: { indices: ["S&P 500"], mois: [[202609, 0.01], [202610, 0.02]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function ouvrir(b, session, theme) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme || "light" }), p = await ctx.newPage(), err = [], envois = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-30T20:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "relevePct" || c.action === "releve") { envois.push(c); return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, message: "Relevé enregistré (en %, aucun montant)." }) }); }
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 0 }) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(donnees(session)) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.guideReleve.Clément", "1"); localStorage.setItem("versus.guideReleve.Théo", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1000);
  return { p, err, envois, fermer: () => ctx.close() };
}
(async () => {
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const x = await ouvrir(b, { role: "perso", nom: "Clément" }, theme), p = x.p;
    await p.evaluate(() => { ouvrirSaisie(); });
    await p.waitForSelector("#r-d0", { timeout: 5000 });
    ok(!(await p.$("#r-v0[placeholder='0']")) && !!(await p.$("#r-c1")), theme + " · Clément : formulaire en % (fin du mois dernier, versé, fin de ce mois)");
    await p.fill("#r-d0", "1000"); await p.fill("#r-v0", "100"); await p.fill("#r-c0", "1150");
    const info = await p.textContent("#r-info-0"), recap = await p.textContent("#r-recap");
    ok(/4,8\s?%/.test(info) && /4,8\s?%/.test(recap), theme + " · aperçu : PEA +4,8 % (versement compté à moitié : 50 / 1 050)", [info, recap]);
    const larg = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(larg <= 390, theme + " · lisible à 390 px (pas de défilement de côté)", larg);
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + "/saisie-pct-" + theme + ".png", fullPage: false });
    await p.click("#r-envoyer"); await p.waitForTimeout(800);
    const c = x.envois[0] || {}, txt = JSON.stringify(c);
    ok(c.action === "relevePct" && c.personne === "Clément" && c.mois === 202611 && Math.abs(c.pct.pea.r - 50 / 1050) < 1e-9 && c.pct.pea.verse === 1 && c.pct.av.actif === false, theme + " · envoi : action relevePct, % du mois, signe du versement", c.pct);
    ok(!("valeurs" in c) && !/1150|1000|"100"/.test(txt), theme + " · aucun montant envoyé au Versus", txt.slice(0, 160));
    ok(!x.err.length, theme + " · 0 erreur JS", x.err.slice(0, 3));
    await x.fermer();
  }
  { const x = await ouvrir(b, { role: "admin" }), p = x.p;
    await p.evaluate(() => { ouvrirSaisie(); }); await p.waitForSelector("#r-c0", { timeout: 5000 });
    ok(!(await p.$("#r-d0")) && !!(await p.$("#r-v0")), "Théo (admin) : formulaire en euros inchangé (ses montants restent dans son Versus)");
    // P1 : la date d'un versement avant le dernier relevé (30/11 19 h passé) → avertissement dans Moi
    await p.addScriptTag({ url: "http://localhost:8771/moi.js" }).catch(() => {}); await p.waitForFunction(() => window.Moi && typeof Moi.dernierReleveVersus === "function", null, { timeout: 8000 });
    const r = await p.evaluate(() => [Moi.dernierReleveVersus(new Date(2026, 10, 30, 20)), Moi.dernierReleveVersus(new Date(2026, 10, 30, 18)), Moi.dernierReleveVersus(new Date(2026, 11, 2, 9)), Moi.dernierReleveVersus(new Date(2027, 0, 1, 9))]);
    ok(JSON.stringify(r) === JSON.stringify(["2026-11-30", "2026-10-30", "2026-11-30", "2026-12-31"]), "P1 · dernier relevé Versus : 30/11 après 19 h, 30/10 avant ; 31/12 le 1er janvier", r);
    ok(!x.err.length, "admin · 0 erreur JS", x.err.slice(0, 3));
    await x.fermer(); }
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
