/* Test (25/11/2026) · BILAN APRÈS COUP du signal levier (Théo seulement) : pour chaque « sors » passé d'un indicateur (tendance, agitation),
   « sortir vers le Nasdaq-100 ×1 » face à « rester en ×2 », jusqu'au signal de retour.
   1. Calcul : le VRAI SignalLevier.js (app_scripts/portefeuille-epargne/theo) sur des séries inventées, résultats vérifiés à la main.
   2. La règle ne bouge pas : mêmes positions, mêmes signaux, même arbitrage qu'avant le bilan (version de origin/main, tant qu'elle n'a pas le bilan).
   3. Écran : Moi › Aujourd'hui › Levier › « Bilan après coup », 390 px clair et sombre, 0 erreur JS, rien ne déborde ; absent sans signal (autres joueurs).
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tlevier-bilan.js
   (PORT=… pour un autre port, APP_SCRIPTS=/chemin/vers/app_scripts, CAPTURES=dossier des captures) */
const fs = require("fs"), vm = require("vm"), path = require("path"), { execSync } = require("child_process");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts"), PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const FICHIER = path.join(RACINE, "portefeuille-epargne", "theo", "SignalLevier.js");
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const proche = (a, b, tol) => a !== null && a !== undefined && Math.abs(a - b) <= (tol || 1e-9);

function charger(src) {
  const props = {};
  const ctx = { console: { log() {}, error() {} }, Date, Math, JSON, Number, String, Array, Object, isFinite, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    Utilities: { formatDate: () => "2026-11" } };
  vm.createContext(ctx); vm.runInContext(src + "\n;this.SL = SL;", ctx); ctx.props = props; return ctx;
}
const SRC = fs.readFileSync(FICHIER, "utf8"), G = charger(SRC);
const P0 = Object.assign({}, G.SL, { SPREAD: 0, TER_X2: 0, TER_X1: 0, DIV: 0, TAUX_SECOURS: 0, HISTO_DEPUIS: "2000-01-01" });
const oui = x => x.map(Boolean);

/* ---------- 1. calculs vérifiés à la main ---------- */
{ // 6 séances : la tendance dit « sors » à la 3e (100), retour à la 5e (99) ; l'agitation à la 4e (90), retour à la 6e (100). Sans frais.
  const ndx = { dates: ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-09"], close: [100, 100, 100, 90, 99, 100] };
  const S = { investi: oui([1, 1, 0, 0, 1, 1]), reduit: oui([0, 0, 0, 1, 1, 0]), expose: oui([1, 1, 0, 0, 1, 1]), override: oui([0, 0, 0, 0, 0, 0]) };
  const b = G.slBilan(ndx, S, null, P0), T = b.episodes.find(e => e.k === "T"), V = b.episodes.find(e => e.k === "V");
  // T : −10 % puis +10 % → ×2 : 0,8 × 1,2 = 0,96 (−4 %) ; ×1 : 0,9 × 1,1 = 0,99 (−1 %) ; sortir : 0,99 / 0,96 − 1 = +3,125 %
  ok(T && T.du === "2026-03-04" && T.au === "2026-03-06" && T.j === 2 && proche(T.rester, -0.04) && proche(T.sortir, -0.01) && proche(T.mieux, 0.03125), "tendance : rester ×2 −4 %, sortir ×1 −1 %, sortir aurait fait +3,125 % de mieux (à la main) " + JSON.stringify(T));
  // V : +10 % puis 100/99 → ×2 : 1,2 × (1 + 2/99) = 1,224242… ; ×1 : 1,1 × 100/99 = 1,111111… ; sortir : 1,111111 / 1,224242 − 1 = −9,2409 %
  ok(V && V.du === "2026-03-05" && V.au === "2026-03-09" && proche(V.rester, 1.2 * (1 + 2 / 99) - 1, 1e-12) && proche(V.sortir, 1.1 * 100 / 99 - 1, 1e-12) && proche(V.mieux, -0.092409, 1e-6), "agitation : rester ×2 +22,42 %, sortir ×1 +11,11 %, rester était mieux (−9,24 %) " + JSON.stringify(V));
  const I = b.indicateurs;
  ok(I.T.n === 1 && I.T.bons === 1 && I.T.mauvais === 0 && proche(I.T.moyen, 0.03125) && I.V.n === 1 && I.V.bons === 0 && I.V.mauvais === 1 && !I.T.enCours, "bilan par indicateur : tendance 1 bon (+3,1 % en moyenne), agitation 1 mauvais " + JSON.stringify(I));
}
{ // frais, coût d'emprunt et dividendes : vendredi 02/01 → lundi 05/01 (3 jours), +1 %, Fed 4 %, spread 0,4 %, frais 0,6 % (×2) / 0,3 % (×1), dividende 0,6 %/an (×2 : deux fois)
  const P = Object.assign({}, P0, { SPREAD: 0.4, TER_X2: 0.6, TER_X1: 0.3, DIV: 0.6 });
  const ndx = { dates: ["2026-01-01", "2026-01-02", "2026-01-05"], close: [100, 100, 101] };
  const S = { investi: oui([1, 0, 1]), reduit: oui([0, 0, 0]), expose: oui([1, 0, 1]), override: oui([0, 0, 0]) };
  const e = G.slBilan(ndx, S, { dates: ["2025-12-01"], valeurs: [4] }, P).episodes[0];
  const dv = 0.6 / 100 * 3 / 365;   // 0,0000493 : dividende sur 3 jours
  const x2 = 1 + 2 * (0.01 + dv) - (4.4 / 100 * 3 / 360 + 0.6 / 100 * 3 / 365), x1 = 1 + 0.01 + dv - 0.3 / 100 * 3 / 365;   // 1,0196826… et 1,0100247…
  ok(e && proche(e.rester, x2 - 1, 1e-12) && proche(e.sortir, x1 - 1, 1e-12) && proche(e.mieux, x1 / x2 - 1, 1e-12), "frais du LQQ + emprunt (Fed + spread, sur 3 jours calendaires) et dividendes comptés comme calculés à la main " + JSON.stringify(e));
}
{ // signal en cours, signal avant 2000 ignoré, vente évitée par le creux
  const ndx = { dates: ["1999-12-29", "1999-12-30", "2000-01-03", "2000-01-04", "2000-01-05"], close: [100, 95, 96, 97, 98] };
  const S = { investi: oui([1, 0, 1, 0, 0]), reduit: oui([0, 0, 0, 0, 0]), expose: oui([1, 0, 1, 1, 1]), override: oui([0, 0, 0, 1, 1]) };
  const b = G.slBilan(ndx, S, null, P0);
  ok(b.episodes.length === 1 && b.episodes[0].du === "2000-01-04" && b.episodes[0].au === null && b.episodes[0].evitee === true && b.indicateurs.T.n === 0 && b.indicateurs.T.enCours, "signal en cours : listé, pas compté ; signal de 1999 ignoré ; vente évitée par le creux signalée " + JSON.stringify(b.episodes));
}
{ // version courte pour l'appli : arrondis à 0,1 %, plus récents d'abord, toujours sous 9 Ko (limite d'une propriété)
  const ep = []; for (let i = 0; i < 400; i++) ep.push({ k: i % 2 ? "T" : "V", du: "20" + String(10 + i % 16) + "-01-" + String(10 + i % 18), au: "2026-01-01", j: 12, rester: -0.123456, sortir: -0.05, mieux: 0.0834, evitee: false });
  ep.sort((a, b) => a.du < b.du ? -1 : 1);
  const c = G.slBilanCompact_({ depuis: "2000-01-01", dernier: "2026-11-24", tauxFed: true, episodes: ep, indicateurs: { T: { n: 200, bons: 150, mauvais: 50, moyen: 0.0834, gainBons: 0.1, perteMauvais: -0.02, enCours: false }, V: { n: 200, bons: 1, mauvais: 199, moyen: -0.01, gainBons: 0.01, perteMauvais: -0.0101, enCours: true } } });
  const c2 = G.slBilanCompact_({ depuis: "2000-01-01", dernier: "2026-11-24", tauxFed: true, indicateurs: {},
    episodes: [{ k: "V", du: "2026-01-05", au: "2026-01-20", j: 15, rester: 0.01, sortir: 0.0104, mieux: 0.0004, evitee: false }, { k: "V", du: "2026-02-05", au: "2026-02-20", j: 15, rester: 0.01, sortir: 0.0096, mieux: -0.0004, evitee: false }] });
  ok(c2.ep[1][6] === 0 && c2.ep[1][8] === 1 && c2.ep[0][6] === 0 && c2.ep[0][8] === 0, "drapeau bon/mauvais sur la valeur exacte : +0,04 % → bon, −0,04 % → mauvais, même si les deux s'arrondissent à 0,0 % " + JSON.stringify(c2.ep));
  ok(JSON.stringify(c).length <= 8500 && c.ep.length >= 10 && c.nEp === 400 && c.ep[0][1] >= c.ep[c.ep.length - 1][1] && c.ep[0][4] === -12.3 && c.ind.T.moyen === 8.3, "version courte : " + JSON.stringify(c).length + " octets, " + c.ep.length + " signaux sur 400 gardés (plus récents d'abord), % à 0,1 près");
}
/* ---------- 2. la règle ne bouge pas ---------- */
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const dates = [], close = []; { let v = 250, t = Date.UTC(1985, 9, 1);
  while (t < Date.UTC(2026, 10, 24)) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) { const y = new Date(t).getUTCFullYear(), dur = (y >= 2000 && y <= 2002) || y === 2008 || y === 2020 || y === 2022;
    v *= 1 + (dur ? -0.001 : 0.0006) + (dur ? 0.03 : 0.012) * (rnd() * 2 - 1) * 1.7; dates.push(new Date(t).toISOString().slice(0, 10)); close.push(v); } t += 864e5; } }
const mois = []; for (let y = 1985; y <= 2026; y++) for (let m = 1; m <= 12; m++) mois.push(y + "-" + String(m).padStart(2, "0") + "-01");
const sahm = { dates: mois, valeurs: mois.map(s => /^(2001|2008|2009|2020)/.test(s) ? 0.6 : 0.1) }, prime = { dates: mois, valeurs: mois.map((s, i) => 80 + Math.sin(i / 20)) };
const dff = { dates: ["2025-11-20"], valeurs: [4.1] }, dffHisto = { dates: ["1985-01-01", "2009-01-01", "2022-06-01"], valeurs: [7, 0.2, 4] };
const res = G.slCalculer({ dates, close }, sahm, prime, dff, G.SL);
{
  let ref = null; try { ref = execSync("git -C " + JSON.stringify(RACINE) + " show origin/main:portefeuille-epargne/theo/SignalLevier.js", { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { ref = null; }
  if (ref && !/function slBilan\(/.test(ref)) {
    const A = charger(ref), ra = A.slCalculer({ dates, close }, sahm, prime, dff, A.SL), pick = r => JSON.stringify([r.etat, r.jauges, r.evenements, r.arbitrage, r.resume]);
    ok(pick(ra) === pick(res), "la règle est inchangée : même position, mêmes " + res.evenements.length + " signaux, même arbitrage qu'avant le bilan (origin/main)");
  } else console.log("(comparaison avec l'ancienne version sautée : origin/main a déjà le bilan)");
  // cohérence avec le journal : chaque « ×1 » du journal depuis 2000 ouvre un épisode « agitation », chaque VENTE / VENTE ÉVITÉE un épisode « tendance »
  const b = G.slBilan({ dates, close }, res.series, dffHisto, G.SL), ev = res.evenements.filter(e => e.date >= "2000-01-01");
  const nV = ev.filter(e => e.type === "×1").length, nT = ev.filter(e => e.type === "VENTE" || e.type === "VENTE ÉVITÉE").length;
  ok(b.episodes.filter(e => e.k === "V").length === nV && b.episodes.filter(e => e.k === "T").length === nT, "un épisode par signal « sors » du journal : " + nT + " tendance, " + nV + " agitation");
}
/* ---------- état complet pour l'appli (vraies fonctions du script) ---------- */
res.bilan = G.slBilan({ dates, close }, res.series, dffHisto, G.SL); res.majLe = "24/11/2026 23:15"; res.source = "Yahoo Finance";
G.slEnregistrerEtat_(res);
const SIGNAL = G.slEtatPourApp();
ok(SIGNAL.bilan && SIGNAL.bilan.ep.length > 0 && JSON.stringify(SIGNAL.bilan).length < 9000, "le bilan arrive dans l'état lu par l'appli (propriété à part, " + JSON.stringify(SIGNAL.bilan).length + " octets)");
{ const sauf = res.bilan; res.bilan = null; G.slEnregistrerEtat_(res); const e2 = G.slEtatPourApp(); res.bilan = sauf;
  ok(!("SL_BILAN" in G.props) && e2.bilan === null && e2.position, "bilan du jour raté : l'ancien est effacé (jamais présenté comme à jour), le signal reste"); }
// deux signaux à « 0,0 % » : l'un bon, l'autre mauvais (drapeau du serveur) ; le plus récent en tête
SIGNAL.bilan.ep.unshift(["V", "2026-11-02", "2026-11-12", 10, 1.0, 1.0, 0, 0, 0], ["V", "2026-11-13", "2026-11-20", 7, 1.0, 1.0, 0, 0, 1]);
SIGNAL.bilan.ep.sort((a, b) => a[1] < b[1] ? 1 : -1);

/* ---------- 3. écran ---------- */
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Théo" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const moi = signal => ({ ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "", synthese: { valeur: 1000, apports: 900, gain: 100, epargne: 0 },
  indices: [], enveloppes: [], groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], perfLignes: null, historique: null, ref: { enveloppes: [], actifs: [], journal: [] }, signal });
async function ecran(b, sombre, signal, capture) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(signal) : versus) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  const r = await p.evaluate(() => { const t = document.querySelector(".sig .sig-tete"); if (t) t.click();
    const d = document.querySelector('details.sg-rub[data-rub="bilan"]'); if (d) d.open = true;
    const tout = document.querySelector("#v-moi"), deb = [...document.querySelectorAll(".sg-bilan *")].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length;
    const li = d ? [...d.querySelectorAll(".bl-ep li")].slice(0, 2).map(x => x.className + " | " + x.querySelector(".bl-t").innerText) : [];
    return { li, bilan: !!d, texte: d ? d.innerText : "", deb, eur: d ? /€/.test(d.innerText) : false, largeur: document.documentElement.scrollWidth, signal: !!document.querySelector(".sig"), moi: !!tout }; });
  if (capture && r.bilan) { await p.evaluate(() => { const d = document.querySelector('details.sg-rub[data-rub="bilan"]'); window.scrollBy(0, d.getBoundingClientRect().top - 150); });
    await p.waitForTimeout(300); await p.screenshot({ path: path.join(CAP, "bilan-" + (sombre ? "sombre" : "clair") + ".png") }); }
  await ctx.close(); return Object.assign(r, { err });
}
(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  for (const sombre of [false, true]) {
    const r = await ecran(b, sombre, SIGNAL, true), tag = sombre ? " (sombre)" : " (clair)";
    ok(!r.err.length, "0 erreur JS" + tag + " " + JSON.stringify(r.err));
    ok(r.bilan && /Bilan après coup/i.test(r.texte) && /Tendance/.test(r.texte) && /Agitation/.test(r.texte) && /📉 Signal du \d\d\/\d\d\/\d\d \((tendance|agitation)\) : (sortir aurait fait [+−]\d+,\d %|rester était mieux \(−?\d+,\d %\))/.test(r.texte) && /\d+ signa(l fini|ux finis) · ✅ \d+ bons? · ❌ \d+ mauvais/.test(r.texte) && /En moyenne/.test(r.texte), "bilan affiché : phrases « Signal du … : sortir aurait fait … de mieux / rester était mieux », bons/mauvais et gain moyen par indicateur" + tag);
    ok(r.li.length === 2 && /^bon \| .*sortir aurait fait à peine mieux \(moins de 0,1 %\)$/.test(r.li[0]) && /^mauvais \| .*rester était à peine mieux \(moins de 0,1 %\)$/.test(r.li[1]) && !/rester était mieux \(\D?0,0/.test(r.texte) && /Calcul jusqu'à la séance du \d\d\/\d\d\/\d\d\./.test(r.texte), "couleur et texte suivent le drapeau du serveur (jamais « rester était mieux (0,0 %) » pour un bon signal) ; date du calcul affichée" + tag + " " + JSON.stringify(r.li) + " " + (r.texte.match(/Calcul jusqu[^.]*\./) || [""])[0]);
    ok(/indication/i.test(r.texte) && /jamais obligé/.test(r.texte) && !r.eur, "dit que c'est une indication (pas d'obligation), seulement des %, aucun €" + tag);
    ok(r.deb === 0 && r.largeur <= 390, "rien ne déborde à 390 px" + tag + " (" + r.deb + ", largeur " + r.largeur + ")");
    if (!sombre) console.log("   extrait : " + r.texte.split("\n").filter(l => /Signal du|En moyenne/.test(l)).slice(0, 3).join(" | "));
  }
  const sans = await ecran(b, false, null, false);
  ok(!sans.err.length && !sans.bilan && !sans.signal, "autre joueur (pas de signal levier dans son fichier) : ni signal, ni bilan");
  const vieux = Object.assign({}, SIGNAL); delete vieux.bilan;
  const v = await ecran(b, false, vieux, false);
  ok(!v.err.length && v.signal && !v.bilan, "script pas encore redéployé (signal sans bilan) : le signal s'affiche comme avant, sans bilan");
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
