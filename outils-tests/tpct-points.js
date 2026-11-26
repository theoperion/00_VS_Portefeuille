/* Test V89 (25/11/2026) · « Passer aux relevés en % ne change AUCUN point » : la fausse saison 2027 de tpoints-fige.js
   (5 pilotes, rendements INVENTÉS), mais à partir de décembre 2026 les relevés des 4 autres pilotes n'ont PLUS AUCUN euro :
   seulement { % du mois, compte non vide, signe du versement } rangés comme dans l'onglet « Relevés % ». Le VRAI serveur
   (versus/RelevesPct.js : vsSurcouchePct_, puis vsMasquerMontants_ de versus/API.js) recompose les données envoyées à l'appli.
   Le championnat doit avoir EXACTEMENT la même empreinte que tpoints-fige.js (celle d'avant la refonte des badges).
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tpct-points.js
   (APP_SCRIPTS=/chemin/vers/app_scripts si le dépôt serveur n'est pas à côté) */
const { chromium } = require("playwright"), crypto = require("crypto"), fs = require("fs"), vm = require("vm"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts");
const src = fs.readFileSync(path.join(__dirname, "tpoints-fige.js"), "utf8"), base = vm.createContext({ console, Math, JSON, Array, Object, String, Number });
vm.runInContext(src.slice(src.indexOf("const EMPREINTE"), src.indexOf("(async () =>")).replace(/^const /gm, "var "), base);
const EMPREINTE = base.EMPREINTE, donnees = base.donnees;
const V = vm.createContext({ console: { log() {} }, Date, JSON, Math, Number, String, Array, Object, isFinite, isNaN, RegExp, Error });
vm.runInContext(fs.readFileSync(path.join(RACINE, "versus", "API.js"), "utf8") + "\n" + fs.readFileSync(path.join(RACINE, "versus", "RelevesPct.js"), "utf8"), V);
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (d === undefined ? "" : "  →  " + JSON.stringify(d))); };

/** Les données du serveur après le passage aux % : Data des autres VIDE à partir de décembre 2026, relevés en % à part */
function donneesPct() {
  const o = donnees(), pct = {};
  o.personnes.forEach(p => {
    if (p.nom === "Théo") return;
    pct[p.nom] = {};
    p.rows.forEach(r => {
      if (r[0] < 202612) return;
      const c = r[3], signe = x => x > 0.5 ? 1 : x < -0.5 ? -1 : 0, un = { r: typeof c[3] === "number" ? c[3] : null, actif: r[2][1] > 0, verse: signe(c[0]), pv: null };
      pct[p.nom][r[0]] = { pct: { pea: un, av: { r: null, actif: false, verse: 0, pv: null }, pf: Object.assign({}, un) } };
      r[2] = Array(8).fill(null); r[3] = Array(25).fill(null);   // plus aucun euro dans Data
    });
  });
  const avant = JSON.stringify(o.personnes.filter(p => p.nom !== "Théo").map(p => p.rows.filter(r => r[0] >= 202612).map(r => r[2].concat(r[3]))));
  vm.runInContext("vsSurcouchePct_", V)(o.personnes, pct, "Théo");
  return { o: vm.runInContext("vsMasquerMontants_", V)(o, "Théo"), avant, pct };
}
async function championnat(fabrique) {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2028-01-20T10:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 0 }) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(fabrique()) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  const res = await p.evaluate(() => { MEMO_SAISON = { d: null, m: {} }; const c = championnat(2027);
    return { complete: c.complete, classement: c.classement, tot: Object.fromEntries(Object.entries(c.tot).map(([n, t]) => [n, { pts: t.pts, v: t.v, pod: t.pod, bonus: t.bonus, n: t.n }])),
      mois: c.mois.map(m => ({ k: m.k, places: m.places, cumul: m.cumul, l: m.l.map(x => [x.nom, x.rg, x.p, x.base, x.bonus, x.carte ? x.carte.id + ":" + x.carte.gain : "", x.prono ? x.prono.pts : "", x.defi || 0, x.serie || 0, x.rival || "", x.regul === undefined ? "" : x.regul]) })) }; });
  const vus = await p.evaluate(() => ({ prive: D.personnes.filter(x => x.prive).map(x => x.nom), pctLu: D.personnes.filter(x => x.pct).map(x => x.nom) }));
  await b.close();
  return { res, err, vus, emp: crypto.createHash("sha256").update(JSON.stringify(res)).digest("hex") };
}
(async () => {
  const { avant } = donneesPct();
  ok(JSON.parse(avant).every(p => p.every(l => l.every(v => v === null))), "Données de départ : plus aucun euro des autres pilotes à partir de décembre 2026 (seulement leurs %)");
  const c = await championnat(() => donneesPct().o);
  console.log("Classement final (relevés en %) : " + c.res.classement.map(n => n + " " + c.res.tot[n].pts + " pts").join(" · "));
  ok(!c.err.length, "0 erreur JS", c.err.slice(0, 3));
  ok(c.emp === EMPREINTE, "Championnat 2027 identique au centime (même empreinte que tpoints-fige)", c.emp);
  ok(JSON.stringify(c.vus.prive.sort()) === JSON.stringify(["Clément", "Devlin", "Kévin", "Nicolas"]), "Les 4 autres pilotes : montants privés (seulement des %)", c.vus.prive);
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
