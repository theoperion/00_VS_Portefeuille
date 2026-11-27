/* Test (25/11/2026) · KRACH MONDIAL (et Tempête crypto) : le chiffre de l'événement = la variation du jour affichée dans Marchés.
   Bug de Théo (25/11, 14 h 41) : « Krach mondial · S&P 500 · Aujourd'hui · −3,1 % » alors que Marchés montrait S&P 500 −1,09 % (cours de 15 h 09).
   Cause : quand la clôture du jour n'est pas encore dans la série Google, closEv ajoutait la séance du Versus en prenant la clôture d'avant
   avec un .pop() qui la RETIRAIT de la série : la séance du jour était comparée à l'avant-veille (24/11 −2,03 % et 25/11 −1,09 % cumulés
   = −3,1 %). Deux causes voisines, reproduites aussi : une ligne Google « aujourd'hui » (cours en séance) non confirmée par le Versus, et un
   événement gardé sur le téléphone (evNes) jamais revu quand la séance change.
   Scénarios (aucune vraie donnée : serveurs Google interceptés, séries inventées) :
   1. matin (ligne Google « en séance » + Versus de la veille) puis après-midi (Versus −1,09 %) : jamais de krach, Marchés −1,09 %.
   2. vrai krach en direct −3,4 % (chiffre exact), puis −2,5 % (le krach disparaît), puis −3,6 % (il revient avec −3,6 %).
   3. krach d'hier (−3,2 % en direct le soir) : gardé le lendemain avant 9 h, avec le chiffre de la clôture Google (−3,25 %), disparu à 10 h (règle du 26/11).
   4. tempête crypto : Bitcoin −11 % puis −6 % (disparaît).
   Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tkrach.js   (PORT=…) */
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const proche = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= (tol || 1e-9);

/* ---------- séries inventées ---------- */
const iso = t => new Date(t).toISOString().slice(0, 10), num = d => +d.replace(/-/g, "");
function seances(debut, fin) { const out = []; for (let t = Date.parse(debut + "T00:00:00Z"); iso(t) <= fin; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) out.push(iso(t)); } return out; }
const J = seances("2026-08-03", "2026-11-25");   // ... 23/11 (lun.), 24/11 (mar.), 25/11 (mer.)
const H = J.filter(d => d <= "2026-11-24");
/* S&P 500 (ETF en €) : petites variations (±0,4 %) ; le 20/11 −2,6 % (forte baisse pour tous, réelle, pas un krach) */
function sp(jusque, extra) { const d = [], v = []; let x = 500; J.filter(k => k <= jusque).forEach((k, i) => { if (i) x *= k === "2026-11-20" ? 0.974 : i % 2 ? 1.004 : 0.997; d.push(num(k)); v.push(Math.round(x * 1e4) / 1e4); });
  if (extra) Object.keys(extra).forEach(k => { const i = d.indexOf(num(k)); const val = Math.round(v[d.indexOf(num(extra[k].base))] * (1 + extra[k].p) * 1e4) / 1e4; if (i >= 0) v[i] = val; else { d.push(num(k)); v.push(val); } });
  return { d, v }; }
function btc(jusque) { const d = [], v = []; let x = 80000; for (let t = Date.parse("2026-08-03T00:00:00Z"); iso(t) <= jusque; t += 864e5) { x *= 1 + (d.length % 2 ? 0.01 : -0.009); d.push(num(iso(t))); v.push(Math.round(x * 100) / 100); } return { d, v }; }
/** réponse du Versus : séries quotidiennes sur l'union des dates (null quand un marché n'a pas de cours ce jour-là), comme le serveur (API.js V63) */
function versusDe(s, b, jour) {
  const tous = [...new Set([...s.d, ...b.d])].sort((a, c) => a - c), col = x => tous.map(k => { const i = x.d.indexOf(k); return i < 0 ? null : x.v[i]; });
  return { ok: true, genere: "2026-11-25T08:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA"], personnes: [{ nom: "Devlin", rows: [] }],
    marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: { jour, series: [{ nom: "S&P 500", v: [1, 1] }, { nom: "Bitcoin", v: [1, 1] }], semaines: ["2026-11-13", "2026-11-20"],
      quot: { d: tous, s: [{ nom: "S&P 500", v: col(s) }, { nom: "Bitcoin", v: col(b) }] } },
    objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
    session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
}
const ip = []; { let v = 100; H.forEach((d, i) => { if (i) v *= i % 2 ? 1.003 : 0.998; ip.push(Math.round(v * 100) / 100); }); }   // portefeuille calme : aucune journée folle
const L = (code, nom, valeur) => ({ code, nom, valeur, cours: 10, qte: valeur / 10, pru: 9, pv: valeur * 0.1, pvPct: 0.11, pct: 0.001, jour: valeur * 0.001, poids: 0.5 });
const moi = { ok: true, version: 14, genere: "2026-11-25T08:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 2000, apports: 1800, gain: 200, epargne: 0, jour: 2, jourPct: 0.001, latente: 200, latentePct: 0.11 },
  indices: [], enveloppes: [{ nom: "Total", type: "total", valeur: 2000 }], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  groupes: [{ env: "CTO", total: { valeur: 2000, jour: 2, pct: 0.001, pv: 200, pvPct: 0.11 }, lignes: [L("ESE", "S&P 500", 1000), L("BTC", "Bitcoin", 1000)] }],
  perfLignes: { "CTO|ESE": { ticker: "EPA:ESE" }, "CTO|BTC": { ticker: "CURRENCY:BTCEUR" } },
  historique: { cols: ["d", "v", "a", "ip", "isp", "inq", "pea", "cto", "av", "cr"], rows: H.map((d, i) => [num(d), 2000, 1800, ip[i], null, null, null, ip[i], null, null]) },
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };

/** une ouverture de l'appli (même téléphone : le localStorage du contexte est gardé d'une ouverture à l'autre) */
async function ouvrir(ctx, heure, versus) {
  const p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date(heure));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi : versus) }));
  // les fonctions de moi.js sont privées : pour le test seulement, la copie servie au navigateur les expose (le fichier n'est pas modifié)
  await p.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text();
    r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { evenementsListe, closEv, varMk, marchesMoi, textesEv };\n})();\n") }); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => { const T = window.__T, l = T.evenementsListe(), mk = n => { const x = T.marchesMoi().jour.find(y => y.nom === n); return x ? T.varMk(x, null).v : null; };
    const pas = [...document.querySelectorAll(".m-ev-b")].map(b => b.getAttribute("title"));
    return { ev: l.filter(x => x.k === "krach" || x.k === "crypto").map(x => ({ k: x.k, d: x.d, p: x.p, big: T.textesEv(x).big, sub: T.textesEv(x).sub })), mkSP: mk("S&P 500"), mkBTC: mk("Bitcoin"), pastilles: pas, route: (document.querySelector(".m-ev-r") || {}).textContent || "",
      puce: (document.querySelector('[data-mk-cache="S&P 500"] b') || {}).textContent || null }; });
  await p.close(); return Object.assign(r, { err });
}
const J1 = (nom, pct, heure) => ({ nom, pct, heure });
const krach = r => r.ev.filter(x => x.k === "krach"), crypto = r => r.ev.filter(x => x.k === "crypto");
const f = r => JSON.stringify(r.ev);

(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  const nouveau = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await c.addInitScript(() => { if (sessionStorage.getItem("__init")) return; sessionStorage.setItem("__init", "1");
      if (localStorage.getItem("versus.cle")) return; localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x");
      localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); }); return c; };
  const bt = btc("2026-11-25"), BTC_J = J1("Bitcoin", 0.01, "25/11 09:00");

  /* 1 a. le bug de Théo tel quel : 24/11 −2,03 %, 25/11 −1,09 % en direct (15 h 09), clôture du 25/11 pas encore chez Google */
  { const c = await nouveau(), s = sp("2026-11-24", { "2026-11-24": { base: "2026-11-23", p: -0.0203 } });
    const r = await ouvrir(c, "2026-11-25T15:41:00", versusDe(s, bt, [J1("S&P 500", -0.0109, "25/11 15:09"), BTC_J]));
    ok(!r.err.length && /−1,09/.test(r.puce || "") && krach(r).length === 0 && !r.pastilles.some(t => /S&P 500/.test(t || "")),
      "1 a. veille −2,03 %, jour −1,09 % : Marchés « " + r.puce + " », aucun krach (avant : « −3,1 % », les deux séances cumulées) " + f(r));
    await c.close(); }

  /* 1 b. matin puis après-midi (ligne Google en séance + mémoire du téléphone) */
  { const c = await nouveau();
    const sp24 = sp("2026-11-24"), v24 = sp24.v[sp24.v.length - 1] / sp24.v[sp24.v.length - 2] - 1;
    // matin 9 h 20 : Google a déjà une ligne « 25/11 » (cours en séance, −3,1 % sous la clôture du 24/11) ; le Versus donne encore la séance du 24/11
    const matin = await ouvrir(c, "2026-11-25T09:20:00", versusDe(sp("2026-11-24", { "2026-11-25": { base: "2026-11-24", p: -0.031 } }), bt, [J1("S&P 500", v24, "24/11 17:35"), BTC_J]));
    ok(!matin.err.length, "1 b. matin : 0 erreur JS " + JSON.stringify(matin.err));
    ok(krach(matin).length === 0, "1 b. matin : pas de krach sur un cours en séance de Google non confirmé par le Versus (Marchés : séance du 24/11 " + (matin.mkSP * 100).toFixed(2) + " %) " + f(matin));
    // après-midi : Marchés S&P 500 −1,09 % (cours du 25/11 à 15 h 09) ; Google n'a plus la ligne du jour
    const am = await ouvrir(c, "2026-11-25T15:41:00", versusDe(sp24, bt, [J1("S&P 500", -0.0109, "25/11 15:09"), BTC_J]));
    ok(!am.err.length, "1 b. après-midi : 0 erreur JS " + JSON.stringify(am.err));
    ok(proche(am.mkSP, -0.0109) && /−1,09/.test(am.puce || ""), "1 b. après-midi : Marchés S&P 500 « " + am.puce + " »");
    ok(krach(am).length === 0 && !am.pastilles.some(t => /S&P 500/.test(t || "")), "1 b. après-midi : aucun « Krach mondial » (ni carte, ni pastille) alors que le jour est −1,09 % " + f(am) + " " + JSON.stringify(am.pastilles));
    // même après-midi, Google remet une ligne du jour (en séance, −3,1 %) : la variation du Versus fait foi
    const am2 = await ouvrir(c, "2026-11-25T15:45:00", versusDe(sp("2026-11-24", { "2026-11-25": { base: "2026-11-24", p: -0.031 } }), bt, [J1("S&P 500", -0.0109, "25/11 15:09"), BTC_J]));
    ok(krach(am2).length === 0, "1 b. après-midi, ligne Google du jour présente : toujours pas de krach " + f(am2));
    await c.close(); }

  /* 2. vrai krach suivi en direct */
  { const c = await nouveau(), sp24 = sp("2026-11-24");
    const a = await ouvrir(c, "2026-11-25T16:30:00", versusDe(sp24, bt, [J1("S&P 500", -0.034, "25/11 16:20"), BTC_J]));
    ok(!a.err.length && krach(a).length === 0 && !a.pastilles.some(t => /S&P 500/.test(t || "")) && /Krach possible · S&P 500 −3,40/.test(a.route),
      "2. v21.20 · séance en cours à −3,4 % : pas encore de krach, seulement « Krach possible · S&P 500 −3,40 % » " + JSON.stringify(a.route));
    const b2 = await ouvrir(c, "2026-11-25T17:40:00", versusDe(sp24, bt, [J1("S&P 500", -0.025, "25/11 17:35"), BTC_J]));
    ok(krach(b2).length === 0 && !/Krach/.test(b2.route), "2. la séance remonte à −2,5 % : ni krach ni « Krach possible » " + f(b2));
    const c3 = await ouvrir(c, "2026-11-25T22:30:00", versusDe(sp24, bt, [J1("S&P 500", -0.036, "25/11 22:05"), BTC_J]));
    const k = krach(c3)[0];
    ok(krach(c3).length === 1 && proche(k.p, -0.036, 1e-12) && /Aujourd'hui/.test(k.sub) && !/Krach/.test(c3.route), "2. séance finie (22 h 30) à −3,6 % : le krach naît avec −3,6 %, exactement la variation de Marchés " + f(c3));
    ok(c3.pastilles.some(t => /S&P 500 −3,6/.test(t || "")), "2. pastille « Krach mondial » avec −3,6 % " + JSON.stringify(c3.pastilles));
    await c.close(); }

  /* 3. krach d'hier gardé le lendemain */
  { const c = await nouveau();
    const soir = await ouvrir(c, "2026-11-24T22:30:00", versusDe(sp("2026-11-23"), btc("2026-11-24"), [J1("S&P 500", -0.032, "24/11 17:35"), J1("Bitcoin", 0.01, "24/11 22:00")]));
    ok(krach(soir).length === 1 && krach(soir)[0].d === "2026-11-24" && proche(krach(soir)[0].p, -0.032, 1e-12), "3. le 24/11 au soir : krach −3,2 % " + f(soir));
    const lend = await ouvrir(c, "2026-11-25T08:30:00+01:00", versusDe(sp("2026-11-24", { "2026-11-24": { base: "2026-11-23", p: -0.0325 } }), bt, [J1("S&P 500", -0.0325, "24/11 22:00"), BTC_J]));
    const k = krach(lend)[0];
    ok(!lend.err.length && krach(lend).length === 1 && k.d === "2026-11-24" && proche(k.p, -0.0325, 1e-6), "3. le lendemain à 8 h 30 : le krach du 24/11 reste, avec la clôture Google (−3,25 %) " + f(lend));
    const apres9 = await ouvrir(c, "2026-11-25T10:00:00+01:00", versusDe(sp("2026-11-24", { "2026-11-24": { base: "2026-11-23", p: -0.0325 } }), bt, [J1("S&P 500", -0.003, "25/11 09:55"), BTC_J]));
    ok(!apres9.err.length && krach(apres9).length === 0, "3. le lendemain à 10 h : le krach du 24/11 a disparu (Théo, 26/11 : un événement s'en va le lendemain à 9 h) " + f(apres9));
    await c.close(); }

  /* 4. tempête crypto */
  { const c = await nouveau(), sp24 = sp("2026-11-24"), SPJ = J1("S&P 500", -0.002, "25/11 11:00");
    const a = await ouvrir(c, "2026-11-25T11:00:00", versusDe(sp24, bt, [SPJ, J1("Bitcoin", -0.11, "25/11 10:58")]));
    ok(crypto(a).length === 1 && proche(crypto(a)[0].p, -0.11, 1e-12) && proche(a.mkBTC, -0.11), "4. Bitcoin −11 % : tempête crypto avec −11 % (comme Marchés) " + f(a));
    const b2 = await ouvrir(c, "2026-11-25T14:00:00", versusDe(sp24, bt, [SPJ, J1("Bitcoin", -0.06, "25/11 13:58")]));
    ok(crypto(b2).length === 0, "4. Bitcoin remonte à −6 % : la tempête disparaît " + f(b2));
    await c.close(); }

  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
