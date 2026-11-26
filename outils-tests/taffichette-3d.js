/* Test (v20.80, Théo 26/11) · l'affichette « 🎨 Nouveau : choisis l'affichage des décors 3D » (js/3-podium.js, affichette3D).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/taffichette-3d.js   (PORT=… pour un autre port, CAPTURES=… pour les captures)
   Fausses données uniquement (serveur Google intercepté) ; l'appareil est simulé (window.VERSUS_APPAREIL).
   Vérifie : elle s'ouvre seule, une fois, APRÈS une autre annonce d'ouverture (jamais par-dessus : ni une annonce, ni les Réglages ouverts) ; textes
   (les mots des Réglages : Auto, Complet, Léger ; ce que l'auto a choisi pour ce téléphone, avec sa raison) ; « Plus tard » la ferme et elle ne revient plus (même après
   rechargement) ; le bouton retour du téléphone la ferme ; « Choisir maintenant » ouvre Réglages › Affichage › Décors 3D (rubrique dépliée si elle était repliée),
   bloc visible à l'écran ; jamais pendant une course (course relancée à 7 s) ; rien si le choix est déjà fait à la main ;
   390 px sans débordement, clair et sombre ; 0 erreur JS. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "affichette-3d");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = () => ({ ok: true, version: 92, genere: "2026-11-26T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202610, 990, 0.01), ligne(202611, 1000, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Kévin" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const PETIT = { memoire: 3, coeurs: 8, gpu: "Mali-G52", texMax: 8192, tactileEtroit: true, reduit: false, eco: false };
const BON = { memoire: 8, coeurs: 8, gpu: "Adreno (TM) 740", texMax: 8192, tactileEtroit: true, reduit: false, eco: false };
async function contexte(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), err = [];
  await ctx.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "avent" ? { ok: true, ouvert: false } : donnees()) }); });
  await ctx.addInitScript(f => { window.VERSUS_APPAREIL = f.app; if (sessionStorage.getItem("t.init")) return; sessionStorage.setItem("t.init", "1");
    localStorage.setItem("versus.cle", "x"); ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.saison1", "versus.ecurieTeaser"].forEach(k => localStorage.setItem(k, "1"));
    Object.entries(f.ls || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }, { app: o.app, ls: o.ls });
  const p = await ctx.newPage(); p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.install({ time: new Date("2026-11-27T10:00:00+01:00") }); await p.clock.resume();
  return { ctx, p, err };
}
const ouvrir = async p => { await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); };
const aff = p => p.evaluate(() => { const x = document.querySelector(".af3d"); return x ? x.innerText : null; });
const deborde = () => [...document.querySelectorAll(".af3d *")].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className).slice(0, 5);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  // 1 · une annonce d'ouverture est là : l'affichette attend sa fermeture, puis vient seule, une fois ; « Plus tard » ; plus jamais après
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await contexte(b, { app: PETIT, sombre });
    await ouvrir(p);
    await p.evaluate(() => { const o = document.createElement("div"); o.className = "tuto fausse-annonce"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.innerHTML = '<div class="tuto-c"><h3>Une autre annonce</h3></div>'; document.body.appendChild(o); });
    await p.waitForTimeout(12000);
    ok(!(await aff(p)), "pendant une autre annonce d'ouverture (12 s) : pas d'affichette par-dessus" + tag);
    await p.evaluate(() => document.querySelector(".fausse-annonce").remove());
    await p.waitForSelector(".af3d", { timeout: 12000 }).catch(() => {});
    const t = await aff(p);
    ok(!!t && /🎨 Nouveau/i.test(t) && /Choisis tes décors 3D/i.test(t) && /Auto\s*l'appli choisit pour ton téléphone\s*Complet\s*tout le décor et les effets de lumière\s*Léger\s*décor allégé, plus fluide/.test(t),
      "l'annonce fermée : l'affichette vient seule, avec Auto / Complet / Léger dans les mots des Réglages " + JSON.stringify(t) + tag);
    ok(!!t && /l'auto a choisi : Léger/.test(t) && /peu puissant/.test(t), "elle dit ce que l'auto a choisi pour ce téléphone (3 Go : Léger, et pourquoi)" + tag);
    ok(!!t && /Choisir maintenant/.test(t) && /Plus tard/.test(t), "deux boutons : « Choisir maintenant » et « Plus tard »" + tag);
    ok(await p.evaluate(() => document.querySelectorAll(".af3d").length === 1 && !document.querySelector(".tuto:not(.af3d)")), "une seule fenêtre à l'écran" + tag);
    { const d = await p.evaluate(deborde); ok(!d.length, "390 px : rien ne déborde " + JSON.stringify(d) + tag); }
    await p.screenshot({ path: DOSSIER + "/affichette" + (sombre ? "-sombre" : "-clair") + ".png" });
    await p.click('[data-af3d="tard"]'); await p.waitForTimeout(300);
    ok(!(await aff(p)) && (await p.evaluate(() => localStorage.getItem("versus.q3dAffichette"))) === "1", "« Plus tard » la ferme, c'est retenu sur l'appareil" + tag);
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(12000);
    ok(!(await aff(p)), "rouverte : elle ne revient plus (une seule fois par appareil)" + tag);
    ok(!err.length, "0 erreur JS " + JSON.stringify(err) + tag);
    await ctx.close();
  }
  // 2 · « Choisir maintenant » : Réglages › Affichage › Décors 3D, à l'écran ; bon téléphone → l'auto dit Complet
  { const { ctx, p, err } = await contexte(b, { app: BON });
    await ouvrir(p); await p.waitForSelector(".af3d", { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => { const s = document.querySelector("[data-q3d]").closest("section.regl"); if (s) plierRegl(s, true); });   // la rubrique Affichage repliée
    const t = await aff(p); ok(!!t && /l'auto a choisi : Complet/.test(t), "bon téléphone : « l'auto a choisi : Complet » " + JSON.stringify(t));
    await p.click('[data-af3d="go"]'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const rg = document.getElementById("reglages"), c = document.querySelector("[data-q3d]").closest(".champ").getBoundingClientRect();
      return { ouvert: !rg.hidden, vu: c.top >= 0 && c.bottom <= innerHeight, info: document.getElementById("q3d-info").textContent, aff: !!document.querySelector(".af3d") }; });
    ok(r.ouvert && r.vu && !r.aff && /Sur ce téléphone : complet/.test(r.info), "« Choisir maintenant » : les Réglages s'ouvrent sur Décors 3D (rubrique Affichage repliée → dépliée, visible à l'écran) " + JSON.stringify(r));
    await p.screenshot({ path: DOSSIER + "/reglages-decors-3d.png" });
    ok(!err.length, "0 erreur JS " + JSON.stringify(err));
    await ctx.close(); }
  // 3 · les Réglages ouverts au démarrage : elle attend leur fermeture
  { const { ctx, p, err } = await contexte(b, { app: BON });
    await ouvrir(p); await p.evaluate(() => document.getElementById("btn-reglages").click()); await p.waitForTimeout(11000);
    ok(!(await aff(p)), "Réglages ouverts : pas d'affichette par-dessus");
    await p.evaluate(() => document.getElementById("fermer-reglages").click()); await p.waitForSelector(".af3d", { timeout: 12000 }).catch(() => {});
    ok(!!(await aff(p)), "Réglages fermés : elle vient ensuite");
    await p.evaluate(() => fermerFenetreOuverte()); ok(!(await aff(p)), "le bouton retour du téléphone la ferme");
    ok(!err.length, "0 erreur JS " + JSON.stringify(err));
    await ctx.close(); }
  // 3 bis · ouverte sur le Podium, course relancée à 7 s : pas d'affichette tant que la course roule, elle vient ensuite
  { const { ctx, p, err } = await contexte(b, { app: BON, ls: { "versus.etat": JSON.stringify({ ouverture: "trophees", podium: "gp" }) } });
    await ouvrir(p); await p.waitForTimeout(7000); await p.evaluate(() => lancerDemo());
    let pendant = 0, roule = 0, apres = false;
    for (let k = 0; k < 70 && !apres; k++) { await p.waitForTimeout(500);
      const e = await p.evaluate(() => ({ c: !!(GP_INST && GP_INST.api.enCours()), a: !!document.querySelector(".af3d") })); if (e.c) roule++; if (e.c && e.a) pendant++; if (!e.c && e.a) apres = true; }
    ok(roule >= 4 && !pendant && apres, "course relancée à 7 s : pas d'affichette tant que la course roule, elle vient une fois la course finie " + JSON.stringify({ roule, pendant, apres }));
    ok(!err.length, "0 erreur JS " + JSON.stringify(err));
    await ctx.close(); }
  // 4 · le choix est déjà fait à la main : rien
  { const { ctx, p, err } = await contexte(b, { app: BON, ls: { "versus.q3d": "leger" } });
    await ouvrir(p); await p.waitForTimeout(12000);
    ok(!(await aff(p)) && (await p.evaluate(() => localStorage.getItem("versus.q3dAffichette"))) === "1", "« Léger » déjà choisi dans les Réglages : pas d'affichette");
    ok(!err.length, "0 erreur JS " + JSON.stringify(err));
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
