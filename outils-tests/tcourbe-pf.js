/* Test v20.65 · Moi › Aujourd'hui › Marchés : la courbe « Mon portefeuille » présente sur TOUTES les périodes (5 j, 1 M, 6 M, YTD, 1 an, Tout)
   avec un historique à trous comme celui de Clément : photos MENSUELLES (fin de mois, quelques jours isolés) jusqu'au 30/09/2026,
   puis QUOTIDIENNES depuis le 28/10/2026 ; enveloppes PEA + AV Linxea + AV Quintessa (Artema).
   Bug (v20.64) : 1 M, 6 M, 1 an : pas de photo à 6 jours au plus avant le début de la période → fenMoi renvoyait null, la courbe disparaissait.
   Attendu : la courbe part du premier point à l'intérieur de la période (base 100 sur lui).
   Fausses données uniquement (calendrier imité, valeurs inventées). Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tcourbe-pf.js  (PORT=…) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const iso = t => new Date(t).toISOString().slice(0, 10), num = d => +d.replace(/-/g, "");
/* calendrier de l'Historique imité (mensuel, puis quotidien) */
const MENS = ["2025-10-31", "2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-26", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31",
  "2026-08-06", "2026-08-07", "2026-08-14", "2026-08-31", "2026-09-30"];
const QUOT = []; for (let t = Date.parse("2026-10-28T00:00:00Z"); iso(t) <= "2026-11-25"; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) QUOT.push(iso(t)); }
const H = MENS.concat(QUOT);
const ip = H.map((d, i) => Math.round((100 + i * 0.7 + (i % 3) * 0.4) * 100) / 100);
/* marchés : clôtures quotidiennes inventées sur 18 mois */
const MK = []; for (let t = Date.parse("2025-06-02T00:00:00Z"); iso(t) <= "2026-11-25"; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) MK.push(iso(t)); }
const serie = (b, a) => MK.map((d, i) => Math.round(b * (1 + a * i) * 100) / 100);
const versus = { ok: true, genere: "2026-11-25T19:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Clément", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: { jour: [{ nom: "S&P 500", pct: 0.002, heure: "25/11 17:35" }, { nom: "Nasdaq-100", pct: 0.003, heure: "25/11 17:35" }],
    series: [{ nom: "S&P 500", v: [1, 1] }, { nom: "Nasdaq-100", v: [1, 1] }], semaines: ["2026-11-13", "2026-11-20"],
    quot: { d: MK.map(num), s: [{ nom: "S&P 500", v: serie(500, 0.0004) }, { nom: "Nasdaq-100", v: serie(400, 0.0006) }] } },
  objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Clément" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const L = (code, nom, valeur) => ({ code, nom, valeur, cours: 10, qte: valeur / 10, pru: 9, pv: valeur * 0.1, pvPct: 0.11, pct: 0.001, jour: valeur * 0.001, poids: 0.33 });
const moi = { ok: true, version: 14, genere: "2026-11-25T19:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 3000, apports: 2700, gain: 300, epargne: 0, jour: 3, jourPct: 0.001, latente: 300, latentePct: 0.11 },
  indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 1000 }, { nom: "AV Linxea Test", type: "env", valeur: 1000 }, { nom: "AV Quintessa Test", type: "env", valeur: 1000 }, { nom: "Total", type: "total", valeur: 3000 }],
  fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  groupes: [{ env: "PEA Test", total: { valeur: 1000, jour: 1, pct: 0.001, pv: 100, pvPct: 0.11 }, lignes: [L("DCAM", "Monde", 1000)] },
    { env: "AV Linxea Test", total: { valeur: 1000, jour: 1, pct: 0.001, pv: 100, pvPct: 0.11 }, lignes: [L("UC1", "UC Monde", 1000)] },
    { env: "AV Quintessa Test", total: { valeur: 1000, jour: 1, pct: 0.001, pv: 100, pvPct: 0.11 }, lignes: [L("ARTEMA", "Artema", 1000)] }],
  perfLignes: { "PEA Test|DCAM": { ticker: "EPA:DCAM", seanceDu: "2026-11-25" } },
  historique: { cols: ["d", "v", "a", "ip", "isp", "inq", "pea", "cto", "av", "cr"], rows: H.map((d, i) => [num(d), 3000, 2700, ip[i], null, null, ip[i], null, ip[i], null]) },
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: true }, appart: null }, prets: null, alertes: [], ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T20:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : versus) }));
  // pour le test seulement : la copie servie au navigateur expose fenMoi (le fichier n'est pas modifié)
  await p.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text(); r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { fenMoi };\n})();\n") }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  for (const per of ["5j", "1m", "6m", "ytd", "1a", "tout"]) {
    const f = await p.evaluate(k => window.__T.fenMoi(k), per);
    const d0 = f && f.d[0];
    ok(!!f && f.d.length > 1, per + " : série « Mon portefeuille » calculée (" + (f ? f.d.length + " points, départ " + d0 : "aucune") + ")", f);
    await p.evaluate(k => { const bt = document.querySelector('.m-per-flot [data-per="' + k + '"]'); if (bt) bt.click(); }, per);
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ chip: !!document.querySelector("[data-mk-moi]"), trait: !!document.querySelector("#m-mk-panneau svg path[style*='--ink']"), aria: (document.querySelector("#m-mk-panneau svg") || { getAttribute: () => "" }).getAttribute("aria-label") }));
    ok(r.chip && r.trait, per + " : pastille et trait blanc « Mon portefeuille » affichés dans Marchés", r);
  }
  const attendu = { "1m": 20261028, "6m": 20260531, "1a": 20251130 };   // premier point à l'intérieur de la période (pas de photo à ≤ 6 j avant son début)
  for (const k of Object.keys(attendu)) { const f = await p.evaluate(x => window.__T.fenMoi(x), k); ok(f && f.d[0] === attendu[k], k + " : la courbe part du premier point de la période (" + attendu[k] + ")", f && f.d[0]); }
  const fy = await p.evaluate(() => window.__T.fenMoi("ytd")); ok(fy && fy.d[0] === 20251231, "YTD : départ au 31/12 (photo présente), inchangé", fy && fy.d[0]);
  const f5 = await p.evaluate(() => window.__T.fenMoi("5j")); ok(f5 && f5.d.length === 6 && f5.d[0] === 20261118, "5 j : les 5 dernières séances + la clôture d'avant", f5 && f5.d);
  /* matin du 25/11 (photo du soir pas encore prise, bourse ouverte) : 5 j garde la courbe, dernier point = en direct */
  const p2 = await ctx.newPage(); p2.on("pageerror", e => err.push(e.message));
  await p2.clock.setFixedTime(new Date("2026-11-25T11:00:00"));
  const moi2 = Object.assign({}, moi, { historique: Object.assign({}, moi.historique, { rows: moi.historique.rows.filter(r => r[0] < 20261125) }) });
  await p2.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi2 : versus) }));
  await p2.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text(); r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { fenMoi };\n})();\n") }); });
  await p2.goto("http://localhost:" + PORT + "/index.html"); await p2.waitForTimeout(3500);
  for (const per of ["5j", "1m", "1a"]) { const f = await p2.evaluate(k => window.__T.fenMoi(k), per); ok(!!f && f.d.length > 1, "matin, photo du soir absente · " + per + " : courbe présente", f); }
  /* v21.14 · historique MENSUEL (fichier de Kévin) : dernier relevé le 30/10, rien après, bourse ouverte le 26/11 →
     pas de courbe « 5 j » sur 5 MOIS, et le point en direct ne recolle plus la seule variation du jour au relevé du 30/10 */
  const p3 = await ctx.newPage(); p3.on("pageerror", e => err.push(e.message));
  await p3.clock.setFixedTime(new Date("2026-11-26T11:00:00"));
  const mens = [[20250831, 100], [20250930, 102.94], [20260630, 125.0], [20260731, 123.79], [20260831, 121.66], [20260930, 125.89], [20261030, 122.39]];
  const moi3 = Object.assign({}, moi, { historique: Object.assign({}, moi.historique, { rows: mens.map(([d, v]) => [d, 3000, 2700, v, null, null, v, null, v, null]) }) });
  await p3.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi3 : versus) }));
  await p3.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text(); r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { fenMoi };\n})();\n") }); });
  await p3.goto("http://localhost:" + PORT + "/index.html"); await p3.waitForTimeout(3500);
  const m5 = await p3.evaluate(() => window.__T.fenMoi("5j")), mt = await p3.evaluate(() => window.__T.fenMoi("tout"));
  ok(!m5, "historique mensuel · 5 j : pas de courbe étalée sur 5 mois", m5 && m5.d);
  ok(mt && mt.d[mt.d.length - 1] === 20261030 && mt.v[mt.v.length - 1] === 122.39, "historique mensuel · Tout : finit au dernier relevé, sans point « en direct » collé dessus", mt && [mt.d.slice(-2), mt.v.slice(-2)]);
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
