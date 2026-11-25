/* Test (v20.62) · plein écran de la course : toujours un ▶ utile (Théo, 25/11). Avant le 1/12/2026 « ▶ Course de démo » (lance la démo), ensuite « ▶ Rejouer » ;
   ⏭ seulement pendant une course. 390 px. Fausses données (serveur intercepté) ; node outils-tests/tplein.js (PORT=…). */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie-dec");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
/** écuries INVENTÉES : Kévin a déjà enregistré des objets de 2027 (ils ne doivent pas apparaître en décembre) */
const ECURIES = { "Kévin": { equip: { livree: "ver", casque: "anneau", finition: "feuilledor", trainee: "sabre", numero: 44 } }, "Clément": { equip: { casque: "damier", fond: "damier", pilote: "casque", numero: 3 } } };
const donnees = session => ({ ok: true, version: 91, genere: "2026-12-02T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECURIES, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function page(b, o) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" });
  const p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "ecurie" ? { ok: true } : c.action === "tickets" ? { ok: true } : donnees(o.session)) }); });
  if (!o.ctx) await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  return { ctx, p, err };
}
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const boutons = p => p.evaluate(() => [...document.querySelectorAll(".gpp-bar .gpp-b")].filter(x => getComputedStyle(x).display !== "none").map(x => x.textContent.trim()));
  for (const [q, sombre] of [["2026-11-26T10:00:00", false], ["2026-11-26T10:00:00", true], ["2027-03-15T10:00:00", false]]) {
    const { ctx, p, err } = await page(b, { quand: q, sombre, session: { role: "perso", nom: "Kévin" } });
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"), d = donnees({ role: "perso", nom: "Kévin" });
      if (q < "2026-12") d.personnes.forEach(x => x.rows = x.rows.slice(0, 1)); else { d.personnes.forEach((x, i) => x.rows.push([202701, "2027-01-28", [0, 1020, 0, 0, null, null, null, null], [50, 1020, 0, .01 + i / 100, 0].concat(Array(20).fill(0))])); d.marche.mois.push([202701, .004]); }
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" || c.action === "avent" ? { ok: true, tresors: [] } : d) }); });
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(2500);
    const tag = " " + q.slice(0, 10) + (sombre ? " (sombre)" : " (clair)");
    const av = await p.evaluate(async () => { document.querySelectorAll(".revel,.regles,.tuto,.ba,.ecu-rev").forEach(x => x.remove()); ETAT.podium = "gp"; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 2000));
      if (GP_INST && GP_INST.api.enCours()) { const x = document.getElementById("gp-fin"); if (x) x.click(); await new Promise(r => setTimeout(r, 600)); }
      ouvrirPleinGP(saisonCourante()); await new Promise(r => setTimeout(r, 1200)); const pl = document.querySelector(".gpp-play"), r = pl.getBoundingClientRect();
      return { deb: r.right > innerWidth + 1 || r.left < 0 || document.documentElement.scrollWidth > innerWidth + 1 }; });
    const l1 = await boutons(p);
    await p.screenshot({ path: (process.env.CAPTURES || "/tmp") + "/plein-" + q.slice(0, 10) + (sombre ? "-sombre" : "") + ".png" });
    if (q < "2026-12") ok(l1.includes("▶ Course de démo") && !l1.includes("⏭") && !av.deb, "avant le 1/12 : en plein écran, « ▶ Course de démo » (pas de ⏭ inutile), lisible à 390 px" + tag + " " + JSON.stringify(l1));
    else ok(l1.includes("▶ Rejouer") && !l1.includes("⏭") && !l1.some(x => /démo/.test(x)) && !av.deb, "après le 1/12 : « ▶ Rejouer » (la vraie course), plus de démo" + tag + " " + JSON.stringify(l1));
    await p.evaluate(() => document.querySelector(".gpp-play").click()); await p.waitForTimeout(1500);
    const l2 = await boutons(p), demo = await p.evaluate(() => !!(GP_DEMO && (GP_DEMO.enCours || GP_DEMO.lance || GP_DEMO.fini)));
    ok(l2.some(x => /Pause/.test(x)) && l2.includes("⏭") && !l2.some(x => /^▶ (Rejouer|Course)/.test(x)) && (q < "2026-12" ? demo : !demo) && !err.length, "▶ lance " + (q < "2026-12" ? "la démo" : "la course") + " : ⏸ et ⏭ pendant la course" + tag + " " + JSON.stringify(l2) + " " + JSON.stringify(err.slice(0, 2)));
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
