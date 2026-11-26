/* Test (26/11/2026, Théo) · la VOLATILITÉ DU PORTEFEUILLE suit la PÉRIODE CHOISIE (et celle du S&P 500 à côté, et le Sharpe).
   Stats › Risque : « Vol. 1 mois », « Vol. 3 mois », « Vol. 6 mois », « Vol. depuis janv. », « Vol. 1 an », « Vol. depuis le début » ;
   Aujourd'hui : la pastille du total suit 1 M, 6 M, YTD, 1 an, Tout (« Jour » = 1 an ; 5 j = pas assez de cours) ; les lignes restent sur 1 an.
   Série inventée connue : variations de ±2 % en alternance jusqu'au 31/12/2025, ±1,5 % jusqu'au 22/05/2026, ±1 % jusqu'au 23/10/2026,
   puis ±0,5 % ; S&P 500 : ±1,2 % puis ±0,8 % depuis le 24/08/2026. Chaque période donne une valeur différente, recalculée ici À LA MAIN
   (bornes de dates écrites en dur, écart type « échantillon » × √252) et comparée à l'écran.
   Aussi : « court : indicatif » sous 60 séances, fichier qui donne la volatilité 1 an (gardée pour 1 an seulement), historique court
   (fichier récemment transféré) et trop court (« pas assez de cours », 0 erreur), 390 px clair et sombre.
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tvol-periode.js
   (PORT=…, CAPTURES=dossier des captures) */
const path = require("path"), PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const iso = t => new Date(t).toISOString().slice(0, 10), num = d => +d.replace(/-/g, "");
function seances(debut, fin) { const out = []; for (let t = Date.parse(debut + "T00:00:00Z"); iso(t) <= fin; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) out.push(iso(t)); } return out; }

/* ---------- série inventée ---------- */
const JOURS = seances("2025-06-02", "2026-11-24");   // dernier relevé : mardi 24/11/2026
const ampMoi = d => d <= "2025-12-31" ? 0.02 : d <= "2026-05-22" ? 0.015 : d <= "2026-10-23" ? 0.01 : 0.005;
const ampSp = d => d <= "2026-08-24" ? 0.012 : 0.008;
const ip = [], isp = []; { let a = 100, b = 1000; JOURS.forEach((d, i) => { if (i) { a *= 1 + (i % 2 ? 1 : -1) * ampMoi(d); b *= 1 + (i % 3 ? 1 : -1) * ampSp(d); } ip.push(a); isp.push(b); }); }
/* à la main : la période commence au dernier relevé ≤ la date de début (comme la courbe de Stats), dates écrites en dur */
const DEBUTS = { "1m": "2026-10-23", "3m": "2026-08-24", "6m": "2026-05-22", ytd: "2025-12-31", tout: "2025-06-02" };   // 24/10 = samedi → vendredi 23/10 ; 24/05 = dimanche → 22/05
function volMain(serie, debut, fin) {   // variations du relevé « debut » au dernier
  const i0 = JOURS.indexOf(debut), r = [];
  for (let i = i0 + 1; i < JOURS.length; i++) if (!fin || JOURS[i - 1] >= fin) r.push(serie[i] / serie[i - 1] - 1);
  const m = r.reduce((a, x) => a + x, 0) / r.length, et = Math.sqrt(r.reduce((a, x) => a + (x - m) * (x - m), 0) / (r.length - 1)) * Math.sqrt(252);
  return { v: et, n: r.length, sh: (m * 252 - 0.03) / et };
}
const ATT = {};
Object.keys(DEBUTS).forEach(k => { ATT[k] = { moi: volMain(ip, DEBUTS[k]), sp: volMain(isp, DEBUTS[k]) }; });
ATT["1a"] = { moi: volMain(ip, JOURS[0], "2025-11-24"), sp: volMain(isp, JOURS[0], "2025-11-24") };   // 1 an : variations dont la veille est ≥ 24/11/2025 (inchangé)
const LIB = { "1m": "Vol. 1 mois", "3m": "Vol. 3 mois", "6m": "Vol. 6 mois", ytd: "Vol. depuis janv.", "1a": "Vol. 1 an", tout: "Vol. depuis le début" };
const fr1 = v => (Math.round(v * 1000) / 10).toFixed(1).replace(".", ",");

/* ---------- fausses données ---------- */
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA"], personnes: [{ nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null,
  objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const L = (code, nom, valeur) => ({ code, nom, valeur, cours: 10, qte: valeur / 10, pru: 9, pv: valeur * 0.1, pvPct: 0.11, pct: 0.004, jour: valeur * 0.004, poids: 0.5 });
function moiDe(v) {
  const n = v === "court" ? 30 : v === "trescourt" ? 10 : JOURS.length, j0 = JOURS.length - n;
  const m = { ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
    synthese: { valeur: 4000, apports: 3600, gain: 400, epargne: 0, jour: 16, jourPct: 0.004, latente: 400, latentePct: 0.11 },
    indices: [], enveloppes: [{ nom: "Total", type: "total", valeur: 4000 }], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
    groupes: [{ env: "PEA", total: { valeur: 4000, jour: 16, pct: 0.004, pv: 400, pvPct: 0.11 }, lignes: [L("LQQ", "Nasdaq ×2", 2000), L("ESE", "S&P 500", 2000)] }],
    perfLignes: { "PEA|LQQ": { ticker: "EPA:LQQ", seanceDu: "2026-11-25", seance: 0.004 }, "PEA|ESE": { ticker: "EPA:ESE", seanceDu: "2026-11-25", seance: 0.004 } },
    vol: { le: "2026-11-24", t: { "EPA:LQQ": { v: 0.3412, n: 252, deb: "2025-11-24", fin: "2026-11-24", an: true }, "EPA:ESE": { v: 0.1234, n: 252, deb: "2025-11-24", fin: "2026-11-24", an: true } } },
    historique: { cols: ["d", "v", "a", "ip", "isp", "inq", "pea", "cto", "av", "cr"], rows: JOURS.slice(j0).map((d, i) => [num(d), 4000, 3600, ip[j0 + i], isp[j0 + i], null, ip[j0 + i], null, null, null]) },
    cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
  if (v === "fichier") { m.enveloppes[0].vol = 0.2222; m.enveloppes[0].sharpe = 0.91; m.enveloppes.push({ nom: "S&P 500", type: "indice", vol: 0.1777, sharpe: 0.66 }); }
  return m;
}
async function ouvrir(b, sombre, variante, per) {
  const moi = moiDe(variante);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : versus) }));
  await p.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text();   // test seulement : expose la fonction commune (le fichier n'est pas modifié)
    r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { choixRisque, volPortefeuille };\n})();\n") }); });
  await p.addInitScript(per => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x");
    localStorage.setItem("versus.moi.pref", JSON.stringify({ per })); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); }, per || "6m");
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  return { ctx, p, err };
}
const lireStats = p => p.evaluate(() => {
  const t = lab => { const l = [...document.querySelectorAll("#v-moi .lab")].find(x => x.textContent.replace("?", "").trim() === lab || x.textContent.startsWith(lab)); const d = l && l.parentElement;
    return d ? { lab: l.textContent.replace("?", "").trim(), val: d.querySelector(".val").textContent.trim(), sub: d.querySelector(".sub").textContent.trim(), def: (d.querySelector(".m-def") || {}).textContent || "" } : null; };
  const vol = [...document.querySelectorAll("#v-moi .lab")].find(x => /^Vol\./.test(x.textContent)), sh = [...document.querySelectorAll("#v-moi .lab")].find(x => /^Sharpe/.test(x.textContent));
  const de = x => x && { lab: x.textContent.replace("?", "").trim(), val: x.parentElement.querySelector(".val").textContent.trim(), sub: x.parentElement.querySelector(".sub").textContent.trim(), def: (x.parentElement.querySelector(".m-def") || {}).textContent || "" };
  const deb = [...document.querySelectorAll("#v-moi *")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.right > innerWidth + 1; }).length;
  return { vol: de(vol), sh: de(sh), deb, largeur: document.documentElement.scrollWidth };
});
async function versStats(p) { await p.evaluate(() => { const o = document.querySelector('#v-moi [data-m-ong="stats"]'); if (o) o.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelectorAll("#v-moi details").forEach(d => { d.open = true; })); }
async function choisirStats(p, k) { await p.evaluate(k => { const c = document.querySelector('#v-moi [data-m-per="' + k + '"]'); if (c) c.click(); }, k); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll("#v-moi details").forEach(d => { d.open = true; })); }
const pctTxt = s => s && parseFloat(s.replace(/\s/g, "").replace(",", ".")) / 100;

(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  console.log("   à la main : " + Object.keys(LIB).map(k => k + " " + (ATT[k].moi.v * 100).toFixed(2) + " % (" + ATT[k].moi.n + " var.) / S&P " + (ATT[k].sp.v * 100).toFixed(2) + " %").join(" · "));
  const vals = Object.keys(LIB).map(k => ATT[k].moi.v);
  ok(new Set(vals.map(v => v.toFixed(4))).size === vals.length, "série inventée : chaque période a sa propre volatilité (à la main)");

  /* 1. Stats › Risque, chaque période */
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await ouvrir(b, sombre, "base", "6m");
    await versStats(p);
    for (const k of Object.keys(LIB)) {
      await choisirStats(p, k);
      const s = await lireStats(p), a = ATT[k], c = await p.evaluate(k => { const x = window.__T.choixRisque(null, k); return { v: x.moiVol, sp: x.spVol, sh: x.moiSh, spSh: x.spSh, n: x.n }; }, k);
      const court = a.moi.n < 60;
      ok(s.vol && s.vol.lab === LIB[k] && Math.abs(c.v - a.moi.v) < 1e-9 && Math.abs(c.sp - a.sp.v) < 1e-9 && c.n === a.moi.n && s.vol.val.replace(/\s/g, " ") === fr1(a.moi.v) + " %",
        k + " : « " + (s.vol && s.vol.lab) + " » " + (s.vol && s.vol.val) + " = à la main " + (a.moi.v * 100).toFixed(3) + " % (" + a.moi.n + " séances)" + tag);
      ok(s.vol && s.vol.sub.replace(/\s/g, " ").includes("S&P 500 : " + fr1(a.sp.v) + " %"), k + " : S&P 500 sur la même période « " + (s.vol && s.vol.sub) + " » (à la main " + (a.sp.v * 100).toFixed(2) + " %)" + tag);
      ok(s.vol && /court : indicatif/.test(s.vol.sub) === court && /court : indicatif/.test(s.sh.sub) === court, k + " : mention « court : indicatif » " + (court ? "présente (moins de 60 séances)" : "absente") + tag);
      ok(s.sh && s.sh.lab === "Sharpe " + LIB[k].slice(5) && Math.abs(c.sh - a.moi.sh) < 1e-9 && Math.abs(c.spSh - a.sp.sh) < 1e-9, k + " : « " + (s.sh && s.sh.lab) + " » " + (s.sh && s.sh.val) + " (à la main " + a.moi.sh.toFixed(2) + ", S&P " + a.sp.sh.toFixed(2) + ")" + tag);
      ok(s.deb === 0 && s.largeur <= 390, k + " : rien ne déborde à 390 px" + tag);
      if (k === "1m" || k === "1a") { const t = p.locator('[data-acc="m-risque"]'); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await t.screenshot({ path: path.join(CAP, "stats-risque-" + k + "-" + (sombre ? "sombre" : "clair") + ".png") }); }
      if (k === "1m" && !sombre) ok(/suit la période choisie/.test(s.vol.def) && /indicatif/.test(s.vol.def) && /lignes restent sur 1 an/.test(s.vol.def), "aide au toucher : suit la période, court = indicatif, lignes sur 1 an");
    }
    ok(!err.length, "Stats : 0 erreur JS" + tag + " " + JSON.stringify(err));
    await ctx.close();
  }

  /* 2. Aujourd'hui : pastille du total = même valeur que Stats pour la même période ; lignes sur 1 an */
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await ouvrir(b, sombre, "base");
    const lire = () => p.evaluate(() => { const t = document.querySelector(".nv-tot .nv-vo"), a = document.querySelector(".nv-vo-aide"), l = document.querySelector('.m-l[data-code="LQQ"] .nv-vo');
      return { tot: t ? t.textContent.trim() : null, title: t ? t.title : null, aide: a ? a.textContent : null, lqq: l ? l.textContent.trim() : null,
        deb: [...document.querySelectorAll(".m-envs *")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.right > innerWidth + 1; }).length }; });
    await p.evaluate(() => { const h = document.querySelector('.m-enve:not(.ouvert) .nv-h'); if (h) h.click(); }); await p.waitForTimeout(200);
    const j = await lire();
    ok(j.tot && j.tot.replace(/\s/g, " ").endsWith("vol. " + Math.round(ATT["1a"].moi.v * 100) + " %") && /Volatilité 1 an/.test(j.title) && /^Vol\. = volatilité sur 1 an/.test(j.aide), "« Jour » : total sur 1 an « " + j.tot + " »" + tag);
    for (const k of ["1m", "6m", "ytd", "1a", "tout", "5j"]) {
      await p.evaluate(k => { const c = document.querySelector('.m-per-flot [data-per="' + k + '"]'); if (c) c.click(); }, k); await p.waitForTimeout(400);
      await p.evaluate(() => { const h = document.querySelector('.m-enve:not(.ouvert) .nv-h'); if (h) h.click(); }); await p.waitForTimeout(150);
      const r = await lire();
      if (k === "5j") { ok(r.tot === null && /pas assez de cours sur 5 séances/.test(r.aide || "") && /🔴 vol\. 34/.test(r.lqq || ""), "5 j : pas de pastille sur le total, « pas assez de cours », lignes toujours sur 1 an" + tag); continue; }
      const a = ATT[k], att = "vol. " + Math.round(a.moi.v * 100) + " %";
      ok(r.tot && r.tot.replace(/\s/g, " ").endsWith(att) && /🔴 vol\. 34\s%/.test(r.lqq || ""), k + " : total « " + r.tot + " » = Stats (" + (a.moi.v * 100).toFixed(2) + " %), ligne LQQ toujours « " + r.lqq + " » (1 an)" + tag);
      if (k !== "1a") ok(/Lignes : toujours sur 1 an/.test(r.aide || "") && /Portefeuille : (sur|depuis)/.test(r.aide || "") && /court : indicatif/.test(r.aide || "") === (a.moi.n < 60), k + " : aide « " + (r.aide || "").split(". ").slice(-2).join(". ") + " »" + tag);
      ok(r.deb === 0, k + " : rien ne déborde à 390 px" + tag);
      if (k === "1m") { await p.evaluate(() => { const e = document.querySelector(".nv-tot"); window.scrollBy(0, e.getBoundingClientRect().top - 300); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(CAP, "aujourdhui-1m-" + (sombre ? "sombre" : "clair") + ".png") }); }
    }
    ok(!err.length, "Aujourd'hui : 0 erreur JS" + tag + " " + JSON.stringify(err));
    await ctx.close();
  }

  /* 3. le fichier donne la volatilité et le Sharpe 1 an : gardés pour 1 an seulement ; les autres périodes sont recalculées */
  { const { ctx, p, err } = await ouvrir(b, false, "fichier", "1a"); await versStats(p);
    const s1 = await lireStats(p); await choisirStats(p, "6m"); const s6 = await lireStats(p);
    ok(!err.length && /^22,2/.test(s1.vol.val) && /17,8/.test(s1.vol.sub) && s1.sh.val === "0,91" && s6.vol.val.replace(/\s/g, " ") === fr1(ATT["6m"].moi.v) + " %", "fichier : 1 an = la valeur du fichier (" + s1.vol.val + ", S&P « " + s1.vol.sub + " », Sharpe " + s1.sh.val + ") ; 6 mois recalculé (" + s6.vol.val + ")");
    await ctx.close(); }

  /* 4. historique court (30 séances, fichier récemment transféré) et trop court (10 séances) */
  { const { ctx, p, err } = await ouvrir(b, false, "court", "6m"); await versStats(p);
    const s6 = await lireStats(p); await choisirStats(p, "1m"); const s1 = await lireStats(p);
    ok(!err.length && s6.vol.lab === "Vol. 6 mois" && /^depuis le /.test(s6.vol.sub) && /court : indicatif/.test(s6.vol.sub) && pctTxt(s6.vol.val) > 0, "30 séances, 6 mois : calculé depuis le premier relevé, dit (« " + s6.vol.sub + " »)");
    ok(s1.vol.lab === "Vol. 1 mois" && !/^depuis/.test(s1.vol.sub) && /indicatif/.test(s1.vol.sub), "30 séances, 1 mois : période complète, indicatif (« " + s1.vol.sub + " »)");
    await ctx.close(); }
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await ouvrir(b, sombre, "trescourt", "1m");
    await p.evaluate(() => { const c = document.querySelector('.m-per-flot [data-per="1m"]'); if (c) c.click(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { const h = document.querySelector('.m-enve:not(.ouvert) .nv-h'); if (h) h.click(); }); await p.waitForTimeout(150);
    const h = await p.evaluate(() => ({ tot: (document.querySelector(".nv-tot .nv-vo") || {}).textContent || null, aide: (document.querySelector(".nv-vo-aide") || {}).textContent || "" }));
    await versStats(p); const s = await lireStats(p); await choisirStats(p, "tout"); const st = await lireStats(p); await choisirStats(p, "1a"); const sa = await lireStats(p);
    const t = p.locator('[data-acc="m-risque"]'); await t.scrollIntoViewIfNeeded(); await choisirStats(p, "1m"); await p.waitForTimeout(150); await p.locator('[data-acc="m-risque"]').screenshot({ path: path.join(CAP, "trop-court-" + (sombre ? "sombre" : "clair") + ".png") });
    ok(!err.length && s.vol.val === "—" && /pas assez de cours \(9 séances\)/.test(s.vol.sub) && s.sh.val === "—" && /pas assez de cours/.test(st.vol.sub) && sa.vol.val === "—", "10 séances : « — » et « " + s.vol.sub + " » (1 mois, depuis le début), 1 an « — », 0 erreur" + tag + " " + JSON.stringify(err));
    ok(h.tot === null && /pas assez de cours sur 1 mois/.test(h.aide), "10 séances, Aujourd'hui 1 M : pas de pastille sur le total, l'aide le dit" + tag);
    ok(s.deb === 0 && s.largeur <= 390, "10 séances : rien ne déborde à 390 px" + tag);
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? ko.length + " NON" : "tout OUI"); process.exit(ko.length ? 1 : 0);
})();
