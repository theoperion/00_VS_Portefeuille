/* Test (25/11/2026) · VOLATILITÉ de chaque ligne et du portefeuille (tous les joueurs, dans leur propre Moi seulement).
   Écart type des variations quotidiennes sur 1 an glissant × √252 ; moins d'un an : depuis le premier cours (dit avec « * »).
   1. Serveur : le VRAI Volatilite.js (app_scripts/portefeuille-epargne/commun) sur des séries inventées, calculs vérifiés à la main ;
      symboles Yahoo ; mise à jour une fois par jour, faux Yahoo (aucun vrai téléchargement).
   2. Appli : même calcul que le serveur ; pastilles 🟢 / 🟠 / 🔴 à côté de chaque ligne et du total, phrase d'aide, détail d'une ligne,
      total = la même valeur que Stats › Risque, mode discret, 390 px clair et sombre, rien ne part vers le Versus.
   3. Marchés (Moi › Aujourd'hui) : la même pastille sur chaque case et dans « un marché seul » (toucher long), calculée sur les clôtures
      quotidiennes déjà reçues (S&P inventé vérifié à la main, « * » si moins d'un an, rien sans clôtures quotidiennes), mode discret, 390 px.
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tvolatilite.js
   (PORT=…, APP_SCRIPTS=/chemin/vers/app_scripts, CAPTURES=dossier des captures) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts"), PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const proche = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= (tol || 1e-4);

/* ---------- séries inventées ---------- */
const iso = t => new Date(t).toISOString().slice(0, 10);
function seance(debut, n) { const out = []; let t = Date.parse(debut + "T00:00:00Z"); while (out.length < n) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) out.push(iso(t)); t += 864e5; } return out; }
// A : 21 cours, 20 variations exactement +1 %, −1 %, +1 %… (10 de chaque) : moyenne 0, écart type « échantillon » = 0,01 × √(20/19),
//     × √252 → 0,01 × 1,025978 × 15,874508 = 0,16287 (16,3 %) ; moins d'un an de cours
const dA = seance("2026-10-26", 21), A = []; { let v = 100; dA.forEach((d, i) => { if (i) v *= i % 2 ? 1.01 : 0.99; A.push([d, v]); }); }
const VOL_A = 0.01 * Math.sqrt(20 / 19) * Math.sqrt(252);
// C : la même série avec un découpage d'ETF (cours ÷ 200 un jour, sans vraie variation) au milieu : même résultat
const C = A.map(([d, v], i) => [d, i >= 11 ? v / 200 : v]); C.splice(11, 0, [iso(Date.parse(dA[10] + "T00:00:00Z") + 3600e3 * 12), A[10][1] / 200]);   // le même jour, coupé en deux
// B : 2 ans : la 1re année très agitée (±10 %), la dernière calme (±1 %) : seule la dernière compte (~16 %, pas ~160 %)
const dB = seance("2024-11-25", 520), bB = String(+dB[519].slice(0, 4) - 1) + dB[519].slice(4), B = []; { let v = 100; dB.forEach((d, i) => { if (i) v *= (i % 2 ? 1 : -1) * (d > bB ? 0.01 : 0.10) + 1; B.push([d, v]); }); }

/* ---------- 1. serveur ---------- */
const props = {}, cache = {}, appels = [];
const ctx = { console: { log() {} }, Date, Math, JSON, Number, String, Array, Object, isFinite, encodeURIComponent,
  texte_: v => v === null || v === undefined ? "" : String(v).trim(),
  Utilities: { formatDate: (d, tz, f) => f === "yyyy-MM-dd" ? d.toISOString().slice(0, 10) : "" },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  UrlFetchApp: { fetch: url => { appels.push(url); const sym = decodeURIComponent(url.split("/chart/")[1].split("?")[0]);
    if (!/range=2y/.test(url)) return { getResponseCode: () => 400, getContentText: () => "" };   // 2 ans demandés (historique qui commence avant la borne d'un an)
    if (sym !== "LQQ.PA") return { getResponseCode: () => 404, getContentText: () => "" };
    const r = { timestamp: A.map(x => Date.parse(x[0] + "T15:30:00Z") / 1000), indicators: { quote: [{ close: A.map(x => x[1]) }] } };
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ chart: { result: [r] } }) }; } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "Volatilite.js"), "utf8"), ctx);
{
  const a = ctx.volAnnuelle_(A);
  ok(a && proche(a.v, 0.16287) && proche(a.v, VOL_A, 1e-4) && a.n === 20 && a.an === false && a.deb === dA[0], "série A (±1 % en alternance) : 16,29 % comme calculé à la main, 20 variations, « moins d'un an » " + JSON.stringify(a));
  const c = ctx.volAnnuelle_(C);
  ok(c && proche(c.v, a.v, 1e-4) && c.n === 20, "découpage d'ETF (cours ÷ 200) ignoré : même volatilité " + JSON.stringify(c));
  const b = ctx.volAnnuelle_(B), nB = B.filter(x => x[0] >= bB).length - 1;
  ok(b && b.an === true && b.v > 0.155 && b.v < 0.17 && b.n === nB, "série B (1re année ±10 %, dernière ±1 %) : seule l'année glissante compte (" + (b && (b.v * 100).toFixed(2)) + " %, " + (b && b.n) + " variations, année pleine)");
  // D : actif coté 7 j / 7 (crypto) : 400 jours calendaires, ±1 % en alternance → annualisé avec √365 (pas √252)
  const K = []; { let v = 100, t = Date.parse("2025-10-20T00:00:00Z"); for (let i = 0; i < 400; i++, t += 864e5) { if (i) v *= i % 2 ? 1.01 : 0.99; K.push([iso(t), v]); } }
  const kk = ctx.volAnnuelle_(K), nK = kk && kk.n, VOL_K = 0.01 * Math.sqrt(Math.ceil(nK / 2) * Math.floor(nK / 2) * 4 / nK / (nK - 1)) * Math.sqrt(365);
  ok(kk && kk.parAn === 365 && proche(kk.v, VOL_K) && kk.an === true, "crypto (7 j / 7) : annualisée avec √365 (" + (kk && (kk.v * 100).toFixed(2)) + " % ; avec √252 ce serait " + (kk && (kk.v / Math.sqrt(365) * Math.sqrt(252) * 100).toFixed(2)) + " %) ; bourse : √252 (" + ctx.volAnnuelle_(B).parAn + ")");
  ok(ctx.volAnnuelle_(A.slice(0, 15)) === null, "moins de 20 variations : pas de volatilité (rien d'inventé)");
  const S = { "EPA:LQQ": "LQQ.PA", "ETR:VWCE": "VWCE.DE", "LON:CNDX": "CNDX.L", "AMS:IWDA": "IWDA.AS", "NASDAQ:AAPL": "AAPL", "CURRENCY:BTCEUR": "BTC-EUR", "QQQ3": "QQQ3" };
  ok(Object.keys(S).every(k => ctx.symboleYahoo_(k) === S[k]), "symboles Yahoo : " + Object.keys(S).map(k => k + " → " + ctx.symboleYahoo_(k)).join(", "));
  const perf = { "PEA|LQQ": { ticker: "EPA:LQQ" }, "PEA|ESE": { ticker: "EPA:ESE" }, "CTO|LQQ2": { ticker: "EPA:LQQ" }, "AV|XX": { ticker: "" } };
  const o = ctx.lireVolatilites_(null, "Europe/Paris", perf), n1 = appels.length;
  ok(o && o.t["EPA:LQQ"] && proche(o.t["EPA:LQQ"].v, VOL_A) && o.t["EPA:ESE"] === null && n1 === 2 && props.VOL_LIGNES, "lecture : un téléchargement par ticker distinct (2), LQQ 16,29 %, ticker illisible = vide, rangé dans VOL_LIGNES (rien dans le Sheet)");
  ctx.lireVolatilites_(null, "Europe/Paris", perf);
  ok(appels.length === n1, "deuxième lecture du jour : aucun nouveau téléchargement");
}
{ // G : 3 tickers, faux Yahoo lent (8 s par cours) : le 1er passage s'arrête à 15 s ; 3 h plus tard, le ticker manquant passe EN PREMIER
  let horloge = Date.parse("2026-11-25T08:00:00Z"); const pr = {}, ca = {}, vus = [];
  class FauxDate extends Date { constructor(...a) { if (a.length) super(...a); else super(horloge); } static now() { return horloge; } }
  const c2 = Object.assign({}, ctx, { Date: FauxDate,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in pr ? pr[k] : null), setProperty: (k, v) => { pr[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => ca[k] && ca[k].fin > horloge ? ca[k].v : null, put: (k, v, s) => { ca[k] = { v, fin: horloge + s * 1000 }; } }) },
    UrlFetchApp: { fetch: url => { const sym = decodeURIComponent(url.split("/chart/")[1].split("?")[0]); vus.push(sym); horloge += 8000;
      const r = { timestamp: A.map(x => Date.parse(x[0] + "T15:30:00Z") / 1000), indicators: { quote: [{ close: A.map(x => x[1]) }] } };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ chart: { result: [r] } }) }; } } });
  vm.createContext(c2); vm.runInContext(fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "Volatilite.js"), "utf8"), c2);
  const perf3 = { "PEA|A": { ticker: "EPA:AAA" }, "PEA|B": { ticker: "EPA:BBB" }, "PEA|C": { ticker: "EPA:CCC" } };
  const o1 = c2.lireVolatilites_(null, "Europe/Paris", perf3), v1 = vus.slice();
  horloge += 3 * 3600e3 + 1000;
  const o2 = c2.lireVolatilites_(null, "Europe/Paris", perf3);
  ok(v1.length === 2 && !("EPA:CCC" in o1.t) && vus[2] === "CCC.PA" && o2.t["EPA:CCC"] && proche(o2.t["EPA:CCC"].v, VOL_A) && o2.t["EPA:AAA"] && o2.t["EPA:BBB"],
    "Yahoo lent : 1er passage AAA, BBB puis arrêt à 15 s ; 3 h plus tard CCC est lu en premier et rempli (" + vus.join(", ") + ")");
}

/* ---------- 2. appli ---------- */
const jours = seance("2025-10-01", 300), num = d => +d.replace(/-/g, "");
const ip = []; { let v = 100; jours.forEach((d, i) => { if (i) v *= i % 2 ? 1.005 : 0.995; ip.push(Math.round(v * 100) / 100); }); }
const monde = []; { let v = 500; jours.forEach((d, i) => { if (i) v *= i % 3 ? 1.012 : 0.977; monde.push(Math.round(v * 1e4) / 1e4); }); }
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: { jour: [{ nom: "MSCI Monde", pct: 0.001, heure: "" }], series: [{ nom: "MSCI Monde", v: [1, 1] }], semaines: ["2026-11-13", "2026-11-20"], quot: { d: jours.map(num), s: [{ nom: "MSCI Monde", v: monde }] } },
  objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const L = (code, nom, valeur) => ({ code, nom, valeur, cours: 10, qte: valeur / 10, pru: 9, pv: valeur * 0.1, pvPct: 0.11, pct: 0.004, jour: valeur * 0.004, poids: 0.25 });
const moiBase = { ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 4000, apports: 3600, gain: 400, epargne: 0, jour: 16, jourPct: 0.004, latente: 400, latentePct: 0.11 },
  indices: [], enveloppes: [{ nom: "Total", type: "total", valeur: 4000 }], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  groupes: [{ env: "PEA", total: { valeur: 4000, jour: 16, pct: 0.004, pv: 400, pvPct: 0.11 }, lignes: [L("LQQ", "Nasdaq ×2", 1000), L("ESE", "S&P 500", 1000), L("CW8", "MSCI World", 1000), L("XYZ", "Action sans cours", 1000)] }],
  perfLignes: { "PEA|LQQ": { ticker: "EPA:LQQ" }, "PEA|ESE": { ticker: "EPA:ESE" }, "PEA|CW8": { ticker: "EPA:CW8" }, "PEA|XYZ": { ticker: "" } },
  vol: { le: "2026-11-24", t: { "EPA:LQQ": { v: 0.3412, n: 252, deb: "2025-11-24", fin: "2026-11-24", an: true }, "EPA:ESE": { v: 0.1234, n: 120, deb: "2026-06-01", fin: "2026-11-24", an: false }, "EPA:CW8": null } },
  historique: { cols: ["d", "v", "a", "ip", "isp", "inq", "pea", "cto", "av", "cr"], rows: jours.map((d, i) => [num(d), 4000, 3600, ip[i], monde[i] / 5, null, ip[i], null, null, null]) },
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
/* variantes : base · sansVol (script pas encore redéployé) · simple (profil simple) · pfVol (le fichier donne la volatilité, pas le Sharpe du S&P)
   · sansIsp (ni volatilité du fichier, ni colonne S&P : Stats › Risque n'en a pas, le total non plus) */
function moiDe(v) {
  const m = JSON.parse(JSON.stringify(moiBase));
  if (v === "sansVol") delete m.vol;
  if (v === "simple") m.simple = true;
  if (v === "pfVol") { m.enveloppes[0].vol = 0.2222; m.historique.rows.forEach(r => { r[4] = null; }); }
  if (v === "sansIsp") { m.historique.cols.splice(4, 1); m.historique.rows.forEach(r => r.splice(4, 1)); }
  return m;
}
async function ecran(b, sombre, discret, variante) {
  const moi = moiDe(variante || "base");
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx2.newPage(), err = [], envois = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => { const u = r.request().url(), corps = r.request().postData() || "";
    if (!/FAUXMOI/.test(u)) envois.push(u + " " + corps);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(u) ? moi : versus) }); });
  // les fonctions de moi.js sont privées : pour le test seulement, la copie servie au navigateur les expose (le fichier n'est pas modifié)
  await p.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text();
    r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { volPoints, volPortefeuille, risqueAn, closMk, choixRisque, M: () => M };\n})();\n") }); });
  await p.addInitScript(d => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.moi.pref", JSON.stringify({ per: "1a" }));   // Stats › Risque sur 1 an (26/11 : la volatilité du portefeuille suit la période)
    localStorage.setItem("versus.etat", JSON.stringify(Object.assign({ ouverture: "moi" }, d ? { discret: "oui" } : {}))); }, discret);
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  await p.evaluate(() => { const h = document.querySelector('.m-enve:not(.ouvert) .nv-h'); if (h) h.click(); });
  await p.waitForTimeout(300);
  if (variante && variante !== "base") {   // variantes : pastilles, total et chiffre de Stats › Risque, rien d'autre
    const r = await p.evaluate(() => { const pil = c => { const el = document.querySelector('.m-l[data-code="' + c + '"] .nv-vo'); return el ? el.textContent.trim() : null; };
      const t = document.querySelector(".nv-tot .nv-vo"), x = window.__T && window.__T.choixRisque && window.__T.M().historique ? window.__T.choixRisque(null).moiVol : null;
      return { lqq: pil("LQQ"), ese: pil("ESE"), cw8: pil("CW8"), tot: t ? t.textContent.trim() : null, risque: x }; });
    await p.evaluate(() => { const o = document.querySelector('#v-moi [data-m-ong="stats"]'); if (o) o.click(); }); await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelectorAll("#v-moi details").forEach(d => { d.open = true; }));
    const st = await p.evaluate(() => { const l = [...document.querySelectorAll("#v-moi .lab")].find(x => /^Vol\. 1 an/.test(x.textContent)); const v = l && l.parentElement.querySelector(".val"); return v ? v.textContent.trim() : null; });
    await ctx2.close(); return Object.assign(r, { err, stats: st });
  }
  const r = await p.evaluate(([A, B]) => {
    const pil = code => { const el = document.querySelector('.m-l[data-code="' + code + '"] .nv-vo'); return el ? el.textContent.trim() : null; };
    const tot = document.querySelector(".nv-tot .nv-vo"), aide = document.querySelector(".nv-vo-aide");
    const { volPoints, volPortefeuille, risqueAn, closMk } = window.__T, M = window.__T.M();
    const vp = volPortefeuille(), k = M.historique.cols.indexOf("ip"), ra = risqueAn(M.historique.rows, k);
    const cw = closMk("MSCI Monde"), cwv = volPoints(cw.d.map((d, i) => ({ d, v: cw.v[i] })));
    const deb = [...document.querySelectorAll(".m-envs *")].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length;
    return { lqq: pil("LQQ"), ese: pil("ESE"), cw8: pil("CW8"), xyz: pil("XYZ"), tot: tot ? tot.textContent.trim() : null, aide: aide ? aide.textContent : null, deb, largeur: document.documentElement.scrollWidth,
      memeQueServeur: [volPoints(A.map(x => ({ d: +x[0].replace(/-/g, ""), v: x[1] }))), volPoints(B.map(x => ({ d: +x[0].replace(/-/g, ""), v: x[1] })))],
      vp: vp && vp.v, risque: ra && ra.vol, cwv: cwv && cwv.v, eurDansPastilles: [...document.querySelectorAll(".nv-vo")].some(e => /€/.test(e.textContent)) };
  }, [A, B]);
  // détail d'une ligne
  await p.evaluate(() => document.querySelector('.m-l[data-code="LQQ"]').click()); await p.waitForTimeout(200);
  r.detail = await p.evaluate(() => (document.querySelector('.m-l[data-code="LQQ"] .m-ligne-det') || {}).innerText || "");
  await p.evaluate(() => document.querySelector('.m-l[data-code="CW8"]').click()); await p.waitForTimeout(200);
  r.detailCW = await p.evaluate(() => (document.querySelector('.m-l[data-code="CW8"] .m-ligne-det') || {}).innerText || "");
  await p.evaluate(() => { document.querySelectorAll(".m-ligne-det").forEach(x => x.remove()); const e = document.querySelector(".m-envs"); window.scrollBy(0, e.getBoundingClientRect().top - 140); });
  await p.waitForTimeout(300);
  if (!discret) await p.screenshot({ path: path.join(CAP, "volatilite-" + (sombre ? "sombre" : "clair") + ".png") });
  await ctx2.close(); return Object.assign(r, { err, envois });
}
/* ---------- 3. Marchés (Moi › Aujourd'hui) : la même pastille de volatilité sur chaque case et dans « un marché seul » ----------
   S&P 500 : ±1 % en alternance sur 300 séances (calcul à la main ci-dessous) ; Nasdaq ×2 : seulement 40 séances de ±3 % (« * ») ;
   Or : pas de clôtures quotidiennes (seulement les semaines) → pas de pastille plutôt qu'un chiffre faux. */
const sp = []; { let v = 4000; jours.forEach((d, i) => { if (i) v *= i % 2 ? 1.01 : 0.99; sp.push(v); }); }
const nq = jours.map((d, i) => i < jours.length - 41 ? null : 0); { let v = 50; for (let i = jours.length - 41; i < jours.length; i++) { if (i > jours.length - 41) v *= (i % 2 ? 1.03 : 0.97); nq[i] = v; } }
// à la main : n variations dans l'année glissante, p de +1 % et q de −1 % ; écart type « échantillon » = 0,01 × √(4pq / (n(n−1))) ; × √252
const bSp = num(jours[jours.length - 1]) - 10000, iSp = jours.findIndex(d => num(d) >= bSp), nSp = jours.length - 1 - iSp;
let pSp = 0; for (let i = iSp + 1; i < jours.length; i++) if (i % 2) pSp++;
const VOL_SP = 0.01 * Math.sqrt(4 * pSp * (nSp - pSp) / (nSp * (nSp - 1))) * Math.sqrt(252);
const VOL_NQ = 0.03 * Math.sqrt(4 * 20 * 20 / (40 * 39)) * Math.sqrt(252);
function versusMk() {
  const v = JSON.parse(JSON.stringify(versus)), N = ["S&P 500", "MSCI Monde", "Nasdaq ×2", "Or"];
  v.marchesMoi = { jour: N.map((n, i) => ({ nom: n, pct: (i - 1) / 1000, heure: "" })), series: N.map(n => ({ nom: n, v: [1, 1] })), semaines: ["2026-11-13", "2026-11-20"],
    quot: { d: jours.map(num), s: [{ nom: "S&P 500", v: sp }, { nom: "MSCI Monde", v: monde }, { nom: "Nasdaq ×2", v: nq }] } };
  return v;
}
async function ecranMk(b, sombre, discret) {
  const vMk = versusMk(), moi = moiDe("base");
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx2.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : vMk) }));
  await p.addInitScript(d => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x");
    localStorage.setItem("versus.etat", JSON.stringify(Object.assign({ ouverture: "moi" }, d ? { discret: "oui" } : {}))); }, discret);
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  const r = await p.evaluate(() => {
    const tuile = n => { const c = document.querySelector('.m-mk-chips [data-mk-cache="' + n + '"]'), v = c && c.querySelector(".nv-vo"); return c ? { vo: v ? v.textContent.trim() : null, h: Math.round(c.getBoundingClientRect().height), cls: v ? v.className : "" } : "absente"; };
    const deb = [...document.querySelectorAll(".m-mk *")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.right > innerWidth + 1; }).length;
    const chips = [...document.querySelectorAll(".m-mk-chips .chip")], sansRecouvrement = chips.every(c => [...c.children].every(e => { const a = e.getBoundingClientRect(), z = c.getBoundingClientRect(); return a.right <= z.right + 1 && a.bottom <= z.bottom + 1; }));
    const vo = document.querySelector(".m-mk-chips .nv-vo"), cs = vo && getComputedStyle(vo), ci = vo && getComputedStyle(vo.querySelector("i"));
    return { sp: tuile("S&P 500"), monde: tuile("MSCI Monde"), nq: tuile("Nasdaq ×2"), or: tuile("Or"), deb, largeur: document.documentElement.scrollWidth, sansRecouvrement,
      base: (document.querySelector(".m-mk-base") || {}).textContent || "", taille: cs && cs.fontSize, carre: ci && ci.backgroundColor + "|" + ci.width,
      eur: [...document.querySelectorAll(".m-mk .nv-vo")].some(e => /€/.test(e.textContent)) };
  });
  const mk = p.locator(".m-mk"); await mk.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  if (!discret) await mk.screenshot({ path: path.join(CAP, "marches-vol-" + (sombre ? "sombre" : "clair") + ".png") });
  // toucher long sur S&P 500 → un marché seul
  const seul = async nom => {
    await p.evaluate(n => { const c = document.querySelector('.m-mk-chips [data-mk-cache="' + n + '"]'); c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }, nom);
    await p.waitForTimeout(700);
    await p.evaluate(n => { const c = document.querySelector('.m-mk-chips [data-mk-cache="' + n + '"]'); c.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }, nom);
    await p.waitForTimeout(200);
    return p.evaluate(() => { const res = document.querySelector(".m-mk-res"), v = res && res.querySelector(".nv-vo"), a = document.querySelector(".m-mk-vo");
      return { titre: res ? (res.querySelector("b") || {}).textContent : null, vo: v ? v.textContent.trim() : null, title: v ? v.title : null, aide: a ? a.textContent : null,
        deb: [...document.querySelectorAll(".m-mk *")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.right > innerWidth + 1; }).length }; });
  };
  r.seulSp = await seul("S&P 500");
  if (!discret) await mk.screenshot({ path: path.join(CAP, "marche-seul-vol-" + (sombre ? "sombre" : "clair") + ".png") });
  await p.evaluate(() => { const t = document.querySelector('.m-mk-res [data-mk="cmp"]'); if (t) t.click(); }); await p.waitForTimeout(200);
  r.seulNq = await seul("Nasdaq ×2");
  await p.evaluate(() => { const t = document.querySelector('.m-mk-res [data-mk="cmp"]'); if (t) t.click(); }); await p.waitForTimeout(200);
  r.seulOr = await seul("Or");
  await ctx2.close(); return Object.assign(r, { err });
}
(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  for (const sombre of [false, true]) {
    const r = await ecran(b, sombre, false), tag = sombre ? " (sombre)" : " (clair)";
    ok(!r.err.length, "0 erreur JS" + tag + " " + JSON.stringify(r.err));
    if (!sombre) {
      const [a, bb] = r.memeQueServeur;
      ok(a && proche(a.v, VOL_A, 1e-9) && a.an === false && bb && proche(bb.v, ctx.volAnnuelle_(B).v, 1e-4) && bb.an === true, "appli et serveur : même calcul (A " + (a && (a.v * 100).toFixed(2)) + " %, B " + (bb && (bb.v * 100).toFixed(2)) + " %)");
      ok(proche(r.vp, r.risque, 1e-12), "total = la même volatilité que Stats › Risque (" + (r.vp * 100).toFixed(2) + " %)");
      console.log("   pastilles : LQQ « " + r.lqq + " » · ESE « " + r.ese + " » · CW8 « " + r.cw8 + " » · total « " + r.tot + " »");
    }
    ok(/🔴/.test(r.lqq) && /vol\. 34\s%/.test(r.lqq) && /🟢/.test(r.ese) && /12\s%\*/.test(r.ese), "pastilles : LQQ 🔴 34 % (cours de la ligne), ESE 🟢 12 %* (moins d'un an)" + tag);
    const fv = r.cwv < .15 ? "🟢" : r.cwv <= .3 ? "🟠" : "🔴";
    ok(r.cw8 && r.cw8.includes(fv) && r.cw8.includes("≈" + Math.round(r.cwv * 100)) && r.xyz === null, "CW8 sans cours de la ligne : ≈ " + (r.cwv * 100).toFixed(1) + " % d'après le marché « MSCI Monde » ; ligne sans cours ni marché : pas de pastille" + tag);
    ok(r.tot && /🟢/.test(r.tot) && r.tot.replace(/\s/g, " ").endsWith("vol. " + Math.round(r.vp * 100) + " %"), "total du portefeuille : « " + r.tot + " »" + tag);
    ok(r.aide && /🟢 calme \(moins de 15 %\) · 🟠 15 à 30 % · 🔴 plus de 30 %/.test(r.aide) && /moins d'un an/.test(r.aide), "phrase d'aide courte avec le repère (et le sens de « * »)" + tag);
    ok(/Volatilité 1 an\s*🔴 34,1\s%/.test(r.detail) && /sur 1 an : très agité, d'après 252 séances du cours de EPA:LQQ/.test(r.detail) && /estimée d'après le marché « MSCI Monde »/.test(r.detailCW), "détail d'une ligne : chiffre, repère et d'où il vient" + tag);
    ok(r.deb === 0 && r.largeur <= 390, "rien ne déborde à 390 px" + tag);
    ok(!r.envois.some(x => /vol|volatil/i.test(x.split(" ").slice(1).join(" "))), "rien de la volatilité ne part vers le Versus" + tag + " (" + r.envois.length + " appels Versus)");
  }
  for (const sombre of [false, true]) {
    const r = await ecranMk(b, sombre, false), tag = sombre ? " (sombre)" : " (clair)", P = v => Math.round(v * 100) + " %", sp_ = x => x && x.replace(/\s/g, " ");
    if (!sombre) console.log("   Marchés : S&P « " + (r.sp.vo) + " » (à la main " + (VOL_SP * 100).toFixed(2) + " %, " + nSp + " variations) · Monde « " + r.monde.vo + " » · Nasdaq ×2 « " + r.nq.vo + " » (à la main " + (VOL_NQ * 100).toFixed(2) + " %) · Or « " + r.or.vo + " »");
    ok(!r.err.length, "Marchés : 0 erreur JS" + tag + " " + JSON.stringify(r.err));
    ok(sp_(r.sp.vo) === "🟠 vol. " + P(VOL_SP) && /agite/.test(r.sp.cls) && Math.abs(VOL_SP - 0.1589) < 0.002, "case S&P 500 : « 🟠 vol. " + P(VOL_SP) + " » = le calcul à la main (" + (VOL_SP * 100).toFixed(2) + " %)" + tag);
    ok(sp_(r.nq.vo) === "🔴 vol. " + P(VOL_NQ) + "*" && /fort/.test(r.nq.cls), "case Nasdaq ×2 (40 séances) : « 🔴 vol. " + P(VOL_NQ) + "* » (moins d'un an)" + tag);
    ok(r.monde.vo && /^(🟢|🟠|🔴) vol\. \d+\s%$/.test(r.monde.vo) && r.or.vo === null, "case MSCI Monde : pastille « " + r.monde.vo + " » ; Or sans clôtures quotidiennes : pas de pastille" + tag);
    ok(r.taille === "10.5px" && /rgba\(0, 0, 0, 0\)\|auto|transparent/.test(r.carre), "même style que la pastille des lignes (10,5 px), l'émoji n'hérite pas du carré de couleur de la case" + tag + " " + r.carre);
    ok(r.deb === 0 && r.largeur <= 390 && r.sansRecouvrement && r.sp.h <= 52, "390 px : rien ne déborde ni ne sort de sa case (case de " + r.sp.h + " px)" + tag);
    ok(/Vol\. = volatilité 1 an \(🟢 moins de 15 % · 🟠 15 à 30 % · 🔴 plus de 30 %\)/.test(r.base), "repère expliqué sous les courbes" + tag);
    ok(r.seulSp.titre === "S&P 500" && r.seulSp.vo === r.sp.vo && /Volatilité 1 an : agité/.test(r.seulSp.title) && /D'après \d+ séances de ce marché/.test(r.seulSp.aide || "") && r.seulSp.deb === 0, "toucher long S&P 500 : la même pastille « " + r.seulSp.vo + " » à côté du nom, + l'aide" + tag);
    ok(r.seulNq.vo === r.nq.vo && /moins d'un an de cours : depuis le/.test(r.seulNq.aide || "") && /depuis le/.test(r.seulNq.title || ""), "toucher long Nasdaq ×2 : « " + r.seulNq.vo + " » et le sens de « * »" + tag);
    ok(r.seulOr.titre && /^Or/.test(r.seulOr.titre) && r.seulOr.vo === null && r.seulOr.aide === null, "toucher long Or (seulement les semaines) : pas de pastille, rien d'inventé" + tag);
  }
  const dm = await ecranMk(b, false, true);
  ok(!dm.err.length && dm.sp.vo && dm.sp.vo.replace(/\s/g, " ") === "🟠 vol. " + Math.round(VOL_SP * 100) + " %" && !dm.eur && dm.seulSp.vo === dm.sp.vo, "Marchés en mode discret : la volatilité (un %) reste, aucun € " + JSON.stringify({ err: dm.err, sp: dm.sp, seul: dm.seulSp.vo }));
  const nv = await ecran(b, false, false, "sansVol");
  ok(!nv.err.length && nv.cw8 && /≈/.test(nv.cw8) && nv.lqq === null && nv.ese === null && nv.tot && /vol\./.test(nv.tot), "script pas encore redéployé (pas de « vol ») : 0 erreur, CW8 « ≈ » d'après le marché, pas de pastille LQQ / ESE, total présent " + JSON.stringify(nv));
  const si = await ecran(b, false, false, "simple");
  ok(!si.err.length && si.tot === null, "profil simple : 0 erreur, pas de pastille sur le total " + JSON.stringify(si.err));
  const pv = await ecran(b, false, false, "pfVol");
  ok(!pv.err.length && pv.tot && /vol\. 22\s%$/.test(pv.tot) && pv.stats && /^22,2\s%/.test(pv.stats) && pv.risque === 0.2222, "fichier qui donne la volatilité, sans Sharpe du S&P : total 22 % = Stats › Risque « " + pv.stats + " »");
  const si2 = await ecran(b, false, false, "sansIsp");
  ok(!si2.err.length && si2.tot === null && (si2.stats === null || /^—/.test(si2.stats)), "ni volatilité du fichier ni colonne S&P : Stats › Risque n'en a pas (« " + si2.stats + " »), le total non plus");
  const d = await ecran(b, false, true);
  ok(!d.err.length && /34\s%/.test(d.lqq) && !d.eurDansPastilles, "mode discret : les % restent, aucun € dans les pastilles");
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
