/* Test (26/11/2026) · bandeau « 📋 Ton relevé de … » : après le relevé de fin de mois, chaque pilote voit SON % du mois (jamais celui d'un autre,
   jamais un montant), avec « ✏️ Corriger » (formulaire ouvert sur ce mois) et ✕ « C'est bon » (rangé pour ce mois sur cet appareil),
   jusqu'à la date limite donnée par etatReleve (7 jours après la première saisie, comme le serveur) ; plus rien une fois le relevé figé.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tverif-releve.js
   (PORT=… pour un autre port, CAPTURES=… pour le dossier des captures). Aucune vraie donnée : le serveur Google est intercepté.
   Les % de novembre sont des valeurs « signature » propres à chaque pilote : on vérifie qu'un pilote ne voit jamais celles des autres. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const CAP = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "verif-releve");
try { fs.mkdirSync(CAP, { recursive: true }); } catch (e) { /* déjà là */ }
/** une ligne : brut (PEA, AV) + colonnes calculées (Portefeuille, PEA, Assurance vie, CTO, Crypto × [versé, valeur, gain, rendement, cumul]) */
const ligne = (k, pf, pea, av) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", [0, 1000, 0, 500, null, null, null, null],
  [0, 1500, 0, pf, 0, 0, 1000, 0, pea, 0, 0, 500, 0, av, 0].concat(Array(10).fill(0))];
const vide = k => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", Array(8).fill(null), Array(25).fill(null)];
const NOV = { "Théo": [0.0123, 0.0111, 0.0147], "Kévin": [0.023, 0.018, 0.031], "Clément": [0.0642, 0.0531, 0.0789] };   // Kévin = l'exemple de Théo
const SIGNES = ["1,2 %", "1,1 %", "1,5 %", "6,4 %", "5,3 %", "7,9 %"];   // les % de Théo et Clément, que Kévin ne doit jamais voir
function donnees(session) {
  const P = nom => ({ nom, pct: nom !== "Théo", rows: [ligne(202610, 0.01, 0.01, 0.01), NOV[nom] ? ligne(202611, ...NOV[nom]) : vide(202611)] });
  return { ok: true, version: 88, genere: "2026-12-01T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(P),   // Devlin n'a pas de relevé de novembre : le mois est voilé (suspense) pour tout le monde
    marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.012]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    journal: [{ personne: "Théo", cle: 202611, action: "Import auto", statut: "", t: "2026-11-30T19:07:00", ligne: 2, par: "Portefeuille & Épargne" },
      { personne: "Kévin", cle: 202611, action: "Import auto", statut: "", t: "2026-11-30T19:07:00", ligne: 3, par: "Moi" },
      { personne: "Clément", cle: 202611, action: "Saisie", statut: "", t: "2026-11-30T21:15:00", ligne: 4, par: "Clément" }],
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {},
    mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function ouvrir(b, quand, session, o) {
  o = o || {};
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" });
  const p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : ["tickets", "avent", "ecurie"].includes(c.action) ? { ok: true, ouvert: false } : donnees(session)) }); });
  await p.addInitScript(([vue, apercu]) => {
    ["versus.cle", "versus.q3dAffichette", "versus.tuto1", "versus.bullePortrait", "versus.aideVisite", "versus.chauffe1", "versus.guideReleve.Kévin", "versus.guideReleve.Théo"].forEach(k => localStorage.setItem(k, k === "versus.cle" ? "x" : "1"));
    localStorage.setItem("versus.revele", "202712"); localStorage.setItem("versus.feteChauffe", "202612"); localStorage.setItem("versus.vue", vue);
    if (apercu) { sessionStorage.setItem("versus.adminOn", "1"); localStorage.setItem("versus.adminOn", "1"); localStorage.setItem("versus.vueJoueur", "Théo"); }
  }, [o.vue || "classement", !!o.apercu]);
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes && SOURCE === "api", null, { timeout: 15000 });
  await p.waitForTimeout(1800);
  await p.evaluate(() => document.querySelectorAll(".tuto, .revel, .bulle-portrait, .av-ov, .ba, .ere-voile").forEach(x => x.remove()));
  await p.waitForTimeout(200);
  return { p, ctx, err };
}
const lire = (p, vue) => p.evaluate(v => { const x = document.querySelector("#v-" + v + " > .bd-releve");
  if (!x || !x.getClientRects().length) return null;
  const r = x.getBoundingClientRect(), tout = [x, ...x.querySelectorAll("*")];
  const sib = x.nextElementSibling, s = sib && sib.getBoundingClientRect();
  return { t: x.innerText.replace(/\s+/g, " ").trim(), html: x.innerHTML, haut: r.bottom <= innerHeight - 120,   // visible à l'arrivée, sans défiler (au-dessus de la barre d'onglets)
   
    deb: tout.some(y => { const b = y.getBoundingClientRect(); return b.right > innerWidth + 0.5 || b.left < -0.5; }) || document.documentElement.scrollWidth > innerWidth,
    recouvre: !!s && s.height > 0 && s.top < r.bottom - 0.5, pos: getComputedStyle(x).position, anim: getComputedStyle(x).animationName,
    btn: [...x.querySelectorAll("button")].map(y => (y.getAttribute("aria-label") || y.textContent).trim()) }; }, vue);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
  const errs = [];
  const KEV = { role: "perso", nom: "Kévin" };
  // 1 · le 1/12 (tour de chauffe : le relevé de novembre 2026 compte pour le bandeau), en clair et en sombre
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const { p, ctx, err } = await ouvrir(b, "2026-12-01T10:00:00", KEV, { sombre });
    const x = await lire(p, "classement");
    ok(!!x && /Ton relevé de novembre : \+2,3\s%\s\(PEA \+1,8\s%, assurance vie \+3,1\s%\)/.test(x.t), "1/12 : bandeau sur l'accueil avec le bon % (+2,3 %, PEA +1,8 %, assurance vie +3,1 %)" + tag, x && x.t);
    ok(!!x && /Une erreur \? Tu peux le corriger jusqu'au 7 décembre à 19 h 07\./.test(x.t), "1/12 : la date limite est celle de l'appli (7 décembre à 19 h 07, 7 jours après l'import)" + tag, x && x.t);
    ok(!!x && x.btn.some(t => /Corriger/.test(t)) && x.btn.some(t => /C'est bon/.test(t)), "boutons « ✏️ Corriger » et ✕ « C'est bon »" + tag, x && x.btn);
    ok(!!x && !SIGNES.some(s => x.t.includes(s)), "jamais le % d'un autre joueur (Théo, Clément)" + tag, x && x.t);
    ok(!!x && !/€/.test(x.t + x.html), "aucun « € » dans le bandeau" + tag);
    ok(!!x && !x.deb && !x.recouvre && x.pos !== "fixed" && x.pos !== "absolute" && x.haut, "à 390 px : rien ne déborde, dans le flux en haut de la page (visible sans défiler), ne recouvre rien" + tag, x);
    await p.locator("#v-classement > .bd-releve").screenshot({ path: CAP + "/bandeau-releve-" + (sombre ? "sombre" : "clair") + ".png" });
    await p.screenshot({ path: CAP + "/accueil-" + (sombre ? "sombre" : "clair") + ".png" });
    // aussi sur le Podium
    await p.evaluate(() => allerA("trophees")); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll(".tuto, .revel, .bulle-portrait, .av-ov, .ba").forEach(x => x.remove()));
    const y = await lire(p, "trophees");
    ok(!!y && /Ton relevé de novembre : \+2,3/.test(y.t) && !y.deb && !y.recouvre, "le même bandeau en haut du Podium, sans débordement" + tag, y);
    errs.push(...err); await ctx.close();
  }
  // 2 · le 5/12 : toujours là, même date limite ; « Corriger » ouvre le formulaire sur novembre ; ✕ le range, même après rechargement
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const { p, err } = await ouvrir(b, "2026-12-05T18:00:00", KEV, { ctx });
    const x = await lire(p, "classement");
    ok(!!x && /\+2,3\s%/.test(x.t) && /jusqu'au 7 décembre à 19 h 07/.test(x.t), "5/12 : bandeau avec le bon % et la bonne date", x && x.t);
    await p.locator('#v-classement > .bd-releve [data-bdr="corriger"]').click(); await p.waitForTimeout(600);
    const f = await p.evaluate(() => ({ ouvert: !$("#saisie").hidden, mois: $("#r-mois") && $("#r-mois").value, nom: R && R.nom, ong: document.querySelector('[data-ong="nouveau"]').getAttribute("aria-pressed"), champ: !!$("#r-c0") }));
    ok(f.ouvert && f.mois === "202611" && f.nom === "Kévin" && f.ong === "true" && f.champ, "« Corriger » ouvre le formulaire du relevé sur novembre 2026, pour Kévin", f);
    await p.evaluate(() => { $("#saisie").hidden = true; });
    await p.locator('#v-classement > .bd-releve [data-bdr="ok"]').click(); await p.waitForTimeout(400);
    const apres = await p.evaluate(() => document.querySelectorAll(".bd-releve").length);
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes && SOURCE === "api", null, { timeout: 15000 }); await p.waitForTimeout(1500);
    const recharge = await p.evaluate(() => document.querySelectorAll(".bd-releve").length);
    await p.evaluate(() => allerA("trophees")); await p.waitForTimeout(800);
    const podium = await p.evaluate(() => document.querySelectorAll(".bd-releve").length);
    ok(apres === 0 && recharge === 0 && podium === 0, "après ✕ : plus de bandeau, ni après rechargement, ni sur le Podium", { apres, recharge, podium });
    errs.push(...err); await ctx.close(); }
  // 3 · le 8/12 : le relevé est figé → plus de bandeau
  { const { p, ctx, err } = await ouvrir(b, "2026-12-08T10:00:00", KEV);
    const n = await p.evaluate(() => ({ n: document.querySelectorAll(".bd-releve").length, etat: etatReleve("Kévin", 202611).etat }));
    ok(n.n === 0 && n.etat === "fige", "8/12 : relevé figé → plus de bandeau", n);
    errs.push(...err); await ctx.close(); }
  // 4 · Devlin n'a pas de relevé de novembre → pas de bandeau ; et le 30/11 avant l'import (17 h) → pas de bandeau pour Kévin non plus
  { const { p, ctx, err } = await ouvrir(b, "2026-12-01T10:00:00", { role: "perso", nom: "Devlin" });
    const n = await p.evaluate(() => document.querySelectorAll(".bd-releve").length);
    ok(n === 0, "sans relevé (Devlin) : pas de bandeau", n);
    errs.push(...err); await ctx.close(); }
  // 5 · admin (Théo) : seulement son propre %, jamais celui des autres ; en aperçu admin (vue joueur) : rien ; animations réduites : pas d'animation
  { const { p, ctx, err } = await ouvrir(b, "2026-12-01T10:00:00", { role: "admin" });
    const x = await lire(p, "classement");
    ok(!!x && /Ton relevé de novembre : \+1,2\s%\s\(PEA \+1,1\s%, assurance vie \+1,5\s%\)/.test(x.t) && !/2,3|1,8|3,1|6,4|5,3|7,9/.test(x.t), "admin : Théo voit seulement son propre % (+1,2 %), pas ceux de Kévin ni de Clément", x && x.t);
    errs.push(...err); await ctx.close(); }
  { const { p, ctx, err } = await ouvrir(b, "2026-12-01T10:00:00", { role: "admin" }, { apercu: true });
    const n = await p.evaluate(() => ({ n: document.querySelectorAll(".bd-releve").length, sim: simulation() }));
    ok(n.n === 0 && n.sim, "mode aperçu admin (vue joueur) : aucun bandeau", n);
    errs.push(...err); await ctx.close(); }
  { const { p, ctx, err } = await ouvrir(b, "2026-12-01T10:00:00", KEV, { reduit: true });
    const x = await lire(p, "classement");
    ok(!!x && x.anim === "none", "animations réduites : le bandeau apparaît sans animation", x && x.anim);
    errs.push(...err); await ctx.close(); }
  ok(!errs.length, "0 erreur JS sur toutes les pages", errs);
  await b.close();
  console.log("captures : " + CAP);
  console.log(ko.length ? ko.length + " NON" : "tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
