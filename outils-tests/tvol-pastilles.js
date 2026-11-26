/* Test (26/11/2026, Théo, v20.96) · TOUTES les pastilles de volatilité de Moi › Aujourd'hui suivent la PÉRIODE CHOISIE
   (Jour · 5 j · 1 M · 6 M · YTD · 1 an · Tout) : chaque ligne, le total, les cases Marchés, le détail d'une ligne et « un marché seul ».
   Bug de départ : seules la pastille du total et Stats › Risque suivaient la période (v20.88) ; les lignes et les marchés restaient sur 1 an.
   Séries inventées, valeurs recalculées ICI À LA MAIN (écart type « échantillon » des variations quotidiennes × √252, bornes écrites en dur) :
   - portefeuille : ±2 % en alternance jusqu'au 31/12/2025, ±1,5 % jusqu'au 22/05/2026, ±1 % jusqu'au 23/10/2026, puis ±0,5 % ;
   - marché S&P 500 (et la ligne ESE, sans cours propre, qui l'emprunte « ≈ ») : ±2,5 % jusqu'au 22/05/2026, ±1,2 % jusqu'au 23/10/2026, puis ±0,5 % ;
   - marché Nasdaq-100 : ±1,8 % partout (calme sur aucune période, la couleur ne change pas : c'est attendu) ;
   - ligne LQQ (cours de la ligne) : ±4 % jusqu'au 23/10/2026 puis ±0,6 %, passée dans le VRAI Volatilite.js du serveur
     (app_scripts/portefeuille-epargne/commun) qui fournit 1 an et chaque période ; les chiffres du serveur sont aussi comparés au calcul à la main.
   5 j : « vol. — » partout (5 variations, il en faut 15), jamais un chiffre inventé. 390 px, clair et sombre, 0 erreur JS.
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tvol-pastilles.js
   (PORT=…, APP_SCRIPTS=/chemin/vers/app_scripts, CAPTURES=dossier des captures) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts"), PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const iso = t => new Date(t).toISOString().slice(0, 10), num = d => +d.replace(/-/g, "");
function seances(debut, fin) { const out = []; for (let t = Date.parse(debut + "T00:00:00Z"); iso(t) <= fin; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) out.push(iso(t)); } return out; }

/* ---------- séries inventées ---------- */
const JOURS = seances("2025-06-02", "2026-11-24");   // dernier relevé et dernière clôture : mardi 24/11/2026
const serie = (v0, amp) => { const o = []; let v = v0; JOURS.forEach((d, i) => { if (i) v *= 1 + (i % 2 ? 1 : -1) * amp(d); o.push(v); }); return o; };
const ip = serie(100, d => d <= "2025-12-31" ? 0.02 : d <= "2026-05-22" ? 0.015 : d <= "2026-10-23" ? 0.01 : 0.005);
const isp = serie(1000, () => 0.009);
const SP = serie(4000, d => d <= "2026-05-22" ? 0.025 : d <= "2026-10-23" ? 0.012 : 0.005);
const NQ = serie(400, () => 0.018);
const LQQ = serie(50, d => d <= "2026-10-23" ? 0.04 : 0.006);
/* à la main : la période part du dernier relevé ≤ la date de début (24/10 = samedi → 23/10 ; 24/05 = dimanche → 22/05) */
const DEBUTS = { "1m": "2026-10-23", "6m": "2026-05-22", ytd: "2025-12-31", "1a": "2025-11-24", tout: "2025-06-02" };
function volMain(s, debut) { const i0 = JOURS.indexOf(debut), r = [];
  for (let i = i0 + 1; i < JOURS.length; i++) r.push(s[i] / s[i - 1] - 1);
  const m = r.reduce((a, x) => a + x, 0) / r.length; return { v: Math.sqrt(r.reduce((a, x) => a + (x - m) * (x - m), 0) / (r.length - 1)) * Math.sqrt(252), n: r.length }; }
/* « Tout » d'une LIGNE = depuis son achat (comme son %) : LQQ achetée le 15/09/2025, ESE le 02/02/2026, PUST le 04/05/2026 (lundis, des séances) */
const ACHAT = { LQQ: "2025-09-15", ESE: "2026-02-02", PUST: "2026-05-04" };
const ATT = {};
for (const k of Object.keys(DEBUTS)) ATT[k] = { tot: volMain(ip, DEBUTS[k]), sp: volMain(SP, DEBUTS[k]), nq: volMain(NQ, DEBUTS[k]), lqq: volMain(LQQ, DEBUTS[k]), ese: volMain(SP, DEBUTS[k]), pust: volMain(NQ, DEBUTS[k]) };
ATT.tout.lqq = volMain(LQQ, ACHAT.LQQ); ATT.tout.ese = volMain(SP, ACHAT.ESE); ATT.tout.pust = volMain(NQ, ACHAT.PUST);
ATT.jour = ATT["1a"];
const feu = v => v < .15 ? "🟢" : v <= .30 ? "🟠" : "🔴";
const att0 = v => feu(v) + " vol. " + Math.round(v * 100) + " %", att0m = v => feu(v) + " vol. ≈" + Math.round(v * 100) + " %";

/* ---------- le VRAI serveur (Volatilite.js) sur la série LQQ ---------- */
const sctx = { console: { log() {} }, Date, Math, JSON, Number, String, Array, Object, texte_: v => v === null || v === undefined ? "" : String(v).trim(),
  Utilities: { formatDate: d => d.toISOString().slice(0, 10) } };
vm.createContext(sctx); vm.runInContext(fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "Volatilite.js"), "utf8"), sctx);
const volLQQ = sctx.volAnnuelle_(JOURS.map((d, i) => [d, LQQ[i]]), [ACHAT.LQQ]);
/* PUST : fichier d'AVANT le 26/11 (volatilité 1 an seulement, pas les périodes) → hors 1 an, le marché équivalent Nasdaq-100 (≈), et le détail le dit */
const PUST1A = { v: 0.2863, n: 252, deb: "2025-11-24", fin: "2026-11-24", an: true };

/* ---------- fausses données ---------- */
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA"], personnes: [{ nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: { jour: [{ nom: "S&P 500", pct: 0.001, heure: "24/11 17:35" }, { nom: "Nasdaq-100", pct: 0.002, heure: "24/11 17:35" }], series: [{ nom: "S&P 500", v: [1, 1] }, { nom: "Nasdaq-100", v: [1, 1] }],
    semaines: ["2026-11-13", "2026-11-20"], quot: { d: JOURS.map(num), s: [{ nom: "S&P 500", v: SP }, { nom: "Nasdaq-100", v: NQ }] } },
  objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const L = (code, nom, valeur) => ({ code, nom, valeur, cours: 10, qte: valeur / 10, pru: 9, pv: valeur * 0.1, pvPct: 0.11, pct: 0.004, jour: valeur * 0.004, poids: 0.5 });
const moi = { ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 4000, apports: 3600, gain: 400, epargne: 0, jour: 16, jourPct: 0.004, latente: 400, latentePct: 0.11 },
  indices: [], enveloppes: [{ nom: "Total", type: "total", valeur: 4000 }], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  groupes: [{ env: "PEA", total: { valeur: 4000, jour: 16, pct: 0.004, pv: 400, pvPct: 0.11 }, lignes: [L("LQQ", "Nasdaq ×2", 2000), L("ESE", "S&P 500", 1000), L("PUST", "Nasdaq-100", 500), L("ZZZ", "Sans cours", 500)] }],
  perfLignes: { "PEA|LQQ": { ticker: "EPA:LQQ", seanceDu: "2026-11-25", seance: 0.004 }, "PEA|ESE": { seanceDu: "2026-11-25", seance: 0.004 }, "PEA|PUST": { ticker: "EPA:PUST", seanceDu: "2026-11-25", seance: 0.004 }, "PEA|ZZZ": { seanceDu: "2026-11-25", seance: 0.004 } },
  vol: { le: "2026-11-24", ver: 2, t: { "EPA:LQQ": volLQQ, "EPA:PUST": PUST1A } },
  historique: { cols: ["d", "v", "a", "ip", "isp", "inq", "pea", "cto", "av", "cr"], rows: JOURS.map((d, i) => [num(d), 4000, 3600, ip[i], isp[i], null, ip[i], null, null, null]) },
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], signal: null,
  ref: { enveloppes: [], actifs: [], journal: [], detenu: ["LQQ", "ESE", "PUST", "ZZZ"].map(code => Object.assign({ env: "PEA", code, qte: 10 }, ACHAT[code] ? { achat: ACHAT[code] } : {})) } };

async function ouvrir(b, sombre) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : versus) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x");
    localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  return { ctx, p, err };
}
const lire = p => p.evaluate(() => {
  const n = s => s ? s.replace(/\s/g, " ").trim() : null, el = q => document.querySelector(q), vo = q => { const e = el(q); return e ? { t: n(e.textContent), title: e.title } : null; };
  return { tot: vo(".nv-tot .nv-vo"), lqq: vo('.m-l[data-code="LQQ"] .nv-vo'), ese: vo('.m-l[data-code="ESE"] .nv-vo'), pust: vo('.m-l[data-code="PUST"] .nv-vo'), zzz: vo('.m-l[data-code="ZZZ"] .nv-vo'),
    sp: vo('.m-mk-chips [data-mk-cache="S&P 500"] .nv-vo'), nq: vo('.m-mk-chips [data-mk-cache="Nasdaq-100"] .nv-vo'),
    aide: n((el(".nv-vo-aide") || {}).textContent), base: n((el(".m-mk-base") || {}).textContent),
    deb: [...document.querySelectorAll("#v-moi *")].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.right > innerWidth + 1; }).length, largeur: document.documentElement.scrollWidth };
});
const PERS = ["jour", "5j", "1m", "6m", "ytd", "1a", "tout"];
const SUR = { jour: "sur 1 an", "1a": "sur 1 an", "5j": "sur 5 séances", "1m": "sur 1 mois", "6m": "sur 6 mois", ytd: "depuis janvier", tout: "depuis le début" };
const fr = d => d.split("-").reverse().join("/"), SURL = (k, code) => k === "tout" ? "depuis l'achat (" + fr(ACHAT[code]) + ")" : SUR[k];   // lignes : « Tout » = depuis l'achat
async function choisir(p, k) {
  await p.evaluate(k => { const c = document.querySelector('.m-per-flot [data-per="' + k + '"]'); if (c) c.click(); }, k); await p.waitForTimeout(400);
  await p.evaluate(() => { const h = document.querySelector(".m-enve:not(.ouvert) .nv-h"); if (h) h.click(); }); await p.waitForTimeout(150);
}

(async () => {
  console.log("   à la main : " + Object.keys(DEBUTS).map(k => k + " total " + (ATT[k].tot.v * 100).toFixed(2) + " · S&P " + (ATT[k].sp.v * 100).toFixed(2) + " · Nasdaq " + (ATT[k].nq.v * 100).toFixed(2) + " · LQQ " + (ATT[k].lqq.v * 100).toFixed(2) + " %").join(" | "));
  /* 0. le serveur donne, pour la ligne, exactement le calcul à la main (1 an et chaque période) */
  ok(volLQQ && Math.abs(volLQQ.v - ATT["1a"].lqq.v) < 1e-4 && volLQQ.p && ["1m", "6m", "ytd", "tout"].every(k => { const y = k === "tout" ? volLQQ.p.achat && volLQQ.p.achat[ACHAT.LQQ] : volLQQ.p[k];
    return y && Math.abs(y.v - ATT[k].lqq.v) < 1e-4 && y.n === ATT[k].lqq.n && y.deb === (k === "tout" ? ACHAT.LQQ : DEBUTS[k]); }) && !volLQQ.p.tout,
    "serveur (Volatilite.js) : LQQ 1 an " + (volLQQ.v * 100).toFixed(2) + " %, 1 M " + (volLQQ.p["1m"].v * 100).toFixed(2) + " %, 6 M " + (volLQQ.p["6m"].v * 100).toFixed(2) + " %, YTD " + (volLQQ.p.ytd.v * 100).toFixed(2) + " %, depuis l'achat du 15/09/2025 " + (volLQQ.p.achat[ACHAT.LQQ].v * 100).toFixed(2) + " % = à la main, mêmes débuts de période");
  const { chromium } = require("playwright"), b = await chromium.launch();
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await ouvrir(b, sombre), vu = {};
    for (const k of PERS) {
      await choisir(p, k); const r = await lire(p); vu[k] = r;
      if (k === "5j") {
        const tous = [r.tot, r.lqq, r.ese, r.pust, r.sp, r.nq];
        ok(tous.every(x => x && /vol\. —$/.test(x.t) && /5 séances : trop court pour un chiffre fiable/.test(x.title)) && /trop courte pour un chiffre fiable/.test(r.aide || "") && /— trop court/.test(r.base || ""),
          "5 j : total, LQQ, ESE, S&P 500, Nasdaq-100 = « vol. — » (trop court, dit au toucher, sous les lignes et sous les marchés)" + tag);
      } else {
        const a = ATT[k];
        ok(r.tot && r.tot.t.endsWith(att0(a.tot.v)) && r.tot.title.includes("Volatilité " + SUR[k]), k + " : total « " + (r.tot && r.tot.t) + " » = à la main " + (a.tot.v * 100).toFixed(2) + " % · « " + (r.tot && r.tot.title) + " »" + tag);
        ok(r.lqq && r.lqq.t === att0(a.lqq.v) && r.lqq.title.startsWith("Volatilité " + SURL(k, "LQQ")), k + " : ligne LQQ « " + (r.lqq && r.lqq.t) + " » = à la main " + (a.lqq.v * 100).toFixed(2) + " % · « " + (r.lqq && r.lqq.title) + " »" + tag);
        ok(r.ese && r.ese.t === att0m(a.ese.v) && r.ese.title.startsWith("Volatilité " + SURL(k, "ESE")) && /≈ S&P 500/.test(r.ese.title), k + " : ligne ESE (≈ S&P 500) « " + (r.ese && r.ese.t) + " » = à la main " + (a.ese.v * 100).toFixed(2) + " % · « " + (r.ese && r.ese.title) + " »" + tag);
        const pAtt = k === "1a" || k === "jour" ? att0(PUST1A.v) : att0m(a.pust.v);
        ok(r.pust && r.pust.t === pAtt && r.pust.title.startsWith("Volatilité " + SURL(k, "PUST")), k + " : ligne PUST (fichier sans périodes" + (k === "1a" || k === "jour" ? ", son 1 an" : " → ≈ Nasdaq-100") + ") « " + (r.pust && r.pust.t) + " » attendu « " + pAtt + " » · « " + (r.pust && r.pust.title) + " »" + tag);
        ok(r.sp && r.sp.t === att0(a.sp.v) && r.sp.title.startsWith("Volatilité " + SUR[k]) && r.nq && r.nq.t === att0(a.nq.v), k + " : Marchés S&P 500 « " + (r.sp && r.sp.t) + " », Nasdaq-100 « " + (r.nq && r.nq.t) + " » = à la main (" + (a.sp.v * 100).toFixed(2) + " %, " + (a.nq.v * 100).toFixed(2) + " %)" + tag);
        ok((r.aide || "").startsWith("Vol. = volatilité " + SUR[k]) && (r.base || "").includes("Vol. = volatilité " + SUR[k]) && /indicatif/.test(r.aide || "") === (a.tot.n < 60 || a.lqq.n < 60), k + " : aides « " + (r.aide || "").slice(0, 48) + "… » et sous les Marchés « " + SUR[k] + " »" + tag);
      }
      ok(!r.zzz, k + " : ligne sans cours ni marché équivalent : pas de pastille" + tag);
      ok(r.deb === 0 && r.largeur <= 390, k + " : rien ne déborde à 390 px" + tag);
      if (k === "1m" || k === "tout" || k === "5j") { await p.evaluate(() => { const e = document.querySelector(".m-envs"); window.scrollBy(0, e.getBoundingClientRect().top - 60); }); await p.waitForTimeout(200);
        await p.screenshot({ path: path.join(CAP, "apres-lignes-" + k + "-" + (sombre ? "sombre" : "clair") + ".png") });
        const mk = p.locator(".m-mk"); await mk.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await mk.screenshot({ path: path.join(CAP, "apres-marches-" + k + "-" + (sombre ? "sombre" : "clair") + ".png") }); }
    }
    /* chaque endroit change quand les données le justifient */
    const diff = (f, a, c) => f(vu[a]) && f(vu[c]) && f(vu[a]).t !== f(vu[c]).t;
    for (const [nom, f] of [["total", r => r.tot], ["ligne LQQ", r => r.lqq], ["ligne ESE", r => r.ese], ["Marchés S&P 500", r => r.sp]])
      ok(diff(f, "1m", "tout") && diff(f, "1m", "jour") && diff(f, "5j", "1m"), nom + " : la pastille change entre 1 M, Tout, Jour et 5 j (« " + ["1m", "tout", "jour", "5j"].map(k => f(vu[k]) && f(vu[k]).t).join(" » / « ") + " »)" + tag);
    ok(PERS.filter(k => k !== "5j").every(k => vu[k].nq.t.startsWith("🟠")), "Marchés Nasdaq-100 (témoin, ±1,8 % partout) : reste 🟠 sur toutes les périodes, rien d'inventé (« " + PERS.map(k => vu[k].nq.t).join(" » / « ") + " »)" + tag);
    ok(feu(ATT["1m"].lqq.v) !== feu(ATT["1a"].lqq.v) && vu["1m"].lqq.t.startsWith(feu(ATT["1m"].lqq.v)) && vu.jour.lqq.t.startsWith(feu(ATT["1a"].lqq.v)), "ligne LQQ : la COULEUR change (1 M " + feu(ATT["1m"].lqq.v) + ", 1 an " + feu(ATT["1a"].lqq.v) + ")" + tag);
    ok(feu(ATT["1m"].sp.v) !== feu(ATT.tout.sp.v) && vu["1m"].sp.t.startsWith(feu(ATT["1m"].sp.v)) && vu.tout.sp.t.startsWith(feu(ATT.tout.sp.v)), "Marchés S&P 500 : la COULEUR change (1 M " + feu(ATT["1m"].sp.v) + ", Tout " + feu(ATT.tout.sp.v) + ")" + tag);
    ok(vu["1m"].tot.t.startsWith("🟢") && vu.jour.tot.t.startsWith("🟠"), "total : la COULEUR change (1 M 🟢, Jour = 1 an 🟠)" + tag);

    /* détail d'une ligne (toucher) sur 6 mois ; un marché seul (toucher long) sur 6 mois */
    await choisir(p, "6m");
    await p.evaluate(() => { const l = document.querySelector('.m-l[data-code="LQQ"]'); if (l) l.click(); }); await p.waitForTimeout(250);
    const det = await p.evaluate(() => { const d = document.querySelector(".m-ligne-det"); return d ? d.textContent.replace(/\s/g, " ") : ""; });
    await p.evaluate(() => { const l = document.querySelector('.m-l[data-code="LQQ"]'); if (l) l.click(); const m = document.querySelector('.m-l[data-code="PUST"]'); if (m) m.click(); }); await p.waitForTimeout(250);
    const detP = await p.evaluate(() => { const d = document.querySelector('.m-l[data-code="PUST"] .m-ligne-det'); return d ? d.textContent.replace(/\s/g, " ") : ""; });
    ok(/estimée d'après le marché « Nasdaq-100 » \(ton fichier n'a pas encore la volatilité de cette période\)/.test(detP) && !/pas encore de cours de la ligne/.test(detP), "détail PUST sur 6 M (fichier sans périodes) : « ton fichier n'a pas encore la volatilité de cette période », pas « pas encore de cours »" + tag);
    await p.evaluate(() => { const m = document.querySelector('.m-l[data-code="PUST"]'); if (m) m.click(); const l = document.querySelector('.m-l[data-code="LQQ"]'); if (l) l.click(); }); await p.waitForTimeout(250);
    const v6 = (ATT["6m"].lqq.v * 100).toFixed(1).replace(".", ",");
    ok(det.includes("Volatilité 6 mois" + feu(ATT["6m"].lqq.v) + " " + v6 + " %") && det.includes("Volatilité sur 6 mois : ") && det.includes(ATT["6m"].lqq.n + " séances"), "détail LQQ sur 6 M : « Volatilité 6 mois " + v6 + " % », d'après " + ATT["6m"].lqq.n + " séances" + tag);
    if (!sombre) { const d = p.locator(".m-ligne-det"); await d.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await p.screenshot({ path: path.join(CAP, "apres-detail-6m-clair.png") }); }
    await p.evaluate(() => { const c = document.querySelector('.m-mk-chips [data-mk-cache="S&P 500"]'); c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await p.waitForTimeout(700);
    await p.evaluate(() => { const c = document.querySelector('.m-mk-chips [data-mk-cache="S&P 500"]'); c.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }); await p.waitForTimeout(250);
    const seul = await p.evaluate(() => { const v = document.querySelector(".m-mk-res .nv-vo"), a = document.querySelector(".m-mk-vo"); return { t: v ? v.textContent.replace(/\s/g, " ").trim() : null, aide: a ? a.textContent.replace(/\s/g, " ") : "" }; });
    ok(seul.t === att0(ATT["6m"].sp.v) && seul.aide.startsWith("Vol. = volatilité sur 6 mois (la période choisie)") && seul.aide.includes(ATT["6m"].sp.n + " séances"), "un marché seul (S&P 500) sur 6 M : « " + seul.t + " », aide « " + seul.aide.slice(0, 50) + "… »" + tag);
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? ko.length + " NON" : "tout OUI"); process.exit(ko.length ? 1 : 0);
})();
