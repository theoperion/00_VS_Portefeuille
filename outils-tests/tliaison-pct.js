/* Test serveur V89 / fichiers V14 (25/11/2026) · relevé du Versus EN % (P1, P2, P3).
   Charge les VRAIS scripts : portefeuille-epargne/commun (LiaisonVersus.js, Code.js, API.js) et versus (API.js, RelevesPct.js),
   sur un faux Historique INVENTÉ (aucune vraie donnée). Vérifie :
   - 3 cas calculés à la main : mois simple, versement en milieu de mois, versement daté avant le relevé mais saisi après ;
   - le fichier et le Versus font EXACTEMENT le même calcul (même code recopié) ;
   - le % envoyé est celui de Moi (indice de l'Historique lu par l'appli) ;
   - ce qui part au Versus ne contient AUCUN montant en euros ;
   - le Versus range des % (onglet « Relevés % »), jamais d'euros dans Data, et recompose une série qui redonne ces %.
   Lancer : node outils-tests/tliaison-pct.js   (APP_SCRIPTS=/chemin/vers/app_scripts si le dépôt serveur n'est pas à côté) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts");
const lis = (...p) => fs.readFileSync(path.join(RACINE, ...p), "utf8");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const pres = (a, b, e = 1e-9) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < e;
const pad = n => String(n).padStart(2, "0");
const fmt = (d, tz, f) => f.replace("yyyy", d.getFullYear()).replace("MM", pad(d.getMonth() + 1)).replace("dd", pad(d.getDate())).replace("HH", pad(d.getHours())).replace("H", d.getHours()).replace("mm", pad(d.getMinutes())).replace("ss", pad(d.getSeconds()));
const jourDe = d => fmt(d, "", "yyyy-MM-dd");

/* ---------- faux Historique : une ligne par soir de bourse ---------- */
const ENTETE = ["Date", "PEA", "CTO", "AV", "Crypto", "Valeur portefeuille (€)", "Flux PEA (€)", "Flux CTO (€)", "Flux AV (€)", "Flux crypto (€)", "Flux total (€)", "S&P", "Nasdaq", "Source",
  "Apports cumulés (€)", "Indice portefeuille (base 100)", "Indice PEA (base 100)", "Indice AV (base 100)"];
/** jours : [[aaaa-mm-jj, PEA, AV, fluxPEA, fluxAV]] ; indices : true = colonnes d'indice remplies comme le ferait le Sheet (sauf la dernière ligne : « pas encore calculée ») */
function histo(jours, indices, D) {
  D = D || Date;
  const H = [ENTETE.slice()]; let iP = 100, iA = 100, iT = 100, prec = null, cum = 0;
  jours.forEach(([j, p, a, fp, fa], n) => {
    if (prec) { if (prec[0] > 0) iP *= (p - fp) / prec[0]; if (prec[1] > 0) iA *= (a - fa) / prec[1]; if (prec[0] + prec[1] > 0) iT *= (p + a - fp - fa) / (prec[0] + prec[1]); }
    prec = [p, a]; cum += fp + fa;
    const der = n === jours.length - 1, ind = indices && !der;
    H.push([new D(+j.slice(0, 4), +j.slice(5, 7) - 1, +j.slice(8, 10), 18), p, 0, a, 0, p + a, fp, 0, fa, 0, fp + fa, 5000, 20000, "Snapshot", cum, ind ? iT : "", ind ? iP : "", ind ? iA : ""]);
  });
  return H;
}

/* ---------- les deux copies du calcul ---------- */
const ctxF = vm.createContext({ Date, JSON, Math, Number, String, Array, Object, isFinite, isNaN, RegExp, Error, Utilities: { formatDate: fmt }, SpreadsheetApp: { getActive: () => ({ getSpreadsheetTimeZone: () => "Europe/Paris" }) }, console: { log() {} } });
vm.runInContext(lis("portefeuille-epargne", "commun", "Code.js") + "\n" + lis("portefeuille-epargne", "commun", "API.js") + "\n" + lis("portefeuille-epargne", "commun", "LiaisonVersus.js")
  + "\nfunction reglages_() { return {}; }", ctxF);
const ctxV = vm.createContext({ Date, JSON, Math, Number, String, Array, Object, isFinite, isNaN, RegExp, Error, console: { log() {} }, Utilities: { formatDate: fmt } });
vm.runInContext(lis("versus", "API.js") + "\n" + lis("versus", "RelevesPct.js"), ctxV);
const fichier = (H, dep, j, live) => vm.runInContext("pctReleveVersus_", ctxF)(H, jourDe, dep, j, live);
const versus = (H, dep, j, live) => vm.runInContext("vsPctReleve_", ctxV)(H, jourDe, dep, j, live);
/** le % du mois tel que Moi l'affiche : indice de l'Historique lu par l'API de Moi (lireHistorique_), fin de mois / fin du mois d'avant */
function pctMoi(H, cle, k) {
  const h = vm.runInContext("lireHistorique_", ctxF)(H, "Europe/Paris"), ki = h.cols.indexOf(cle), fins = {};
  h.rows.forEach(r => { fins[Math.floor(r[0] / 100)] = r[ki]; });
  const kp = k % 100 === 1 ? k - 89 : k - 1; return fins[k] / fins[kp] - 1;
}

/* ---------- CAS 1 · mois simple : PEA 1 000 € → 1 050 €, AV 500 € → 490 €, aucun versement ---------- */
// à la main : PEA +5 %, AV −2 %, ensemble (1 050 + 490) / 1 500 − 1 = +2,6667 %
for (const ind of [false, true]) {
  const H = histo([["2026-10-30", 1000, 500, 0, 0], ["2026-11-10", 1020, 495, 0, 0], ["2026-11-30", 1050, 490, 0, 0]], ind);
  const f = fichier(H, "2026-10-30", "2026-11-30"), v = versus(H, "2026-10-30", "2026-11-30");
  ok(pres(f.pea.r, 0.05, 1e-6) && pres(f.av.r, -0.02, 1e-6) && pres(f.pf.r, 1540 / 1500 - 1, 1e-4), "Cas 1" + (ind ? " (indices du Sheet)" : "") + " · PEA +5 %, AV −2 %, ensemble +2,67 % (calcul à la main)", [f.pea.r, f.av.r, f.pf.r]);
  ok(JSON.stringify(f) === JSON.stringify(v), "Cas 1" + (ind ? " (indices du Sheet)" : "") + " · le fichier et le Versus trouvent exactement la même chose");
  ok(f.pea.verse === 0 && f.pea.actif && f.pea.pv === null, "Cas 1 · aucun versement, compte non vide, pas de % de gain (versé inconnu : premier relevé de l'Historique)", [f.pea.verse, f.pea.actif, f.pea.pv]);
}
/* ---------- CAS 2 · versement en milieu de mois ---------- */
// PEA 1 000 € fin octobre ; le 13/11 il vaut 1 100 € (+10 %) et on verse 1 000 € (valeur du soir 2 100 €) ; fin novembre 2 100 €.
// À la main, jour par jour : +10 % puis 0 % → +10 % sur le mois. L'ancien calcul du Versus (versement compté à moitié) donnait
// (2 100 − 1 000 − 1 000) / (1 000 + 500) = +6,67 % : c'est l'écart P2.
{
  const H = histo([["2026-10-30", 1000, 0, 0, 0], ["2026-11-12", 1100, 0, 0, 0], ["2026-11-13", 2100, 0, 1000, 0], ["2026-11-30", 2100, 0, 0, 0]], true);
  const f = fichier(H, "2026-10-30", "2026-11-30"), v = versus(H, "2026-10-30", "2026-11-30");
  ok(pres(f.pea.r, 0.10, 1e-6), "Cas 2 · versement de 1 000 € en milieu de mois : +10 % (jour par jour), pas +6,67 % (ancien calcul)", f.pea.r);
  ok(f.pea.verse === 1 && f.pea.verseEur === 1000, "Cas 2 · versement vu ce mois-ci (signe +1 ; les 1 000 € restent dans le fichier)", [f.pea.verse, f.pea.verseEur]);
  ok(JSON.stringify(f) === JSON.stringify(v), "Cas 2 · le fichier et le Versus trouvent la même chose");
  ok(pres(pctMoi(H, "pea", 202611), f.pea.r, 1e-12), "Cas 2 · le % envoyé est EXACTEMENT celui de Moi (PEA, novembre)", [pctMoi(H, "pea", 202611), f.pea.r]);
  ok(pres(pctMoi(H, "ip", 202611), f.pf.r, 1e-12), "Cas 2 · ensemble = « Tout » de Moi (pas de CTO ni de crypto)");
}
/* ---------- CAS 3 · versement daté AVANT le dernier relevé mais saisi APRÈS (P1) ---------- */
// Versement de 500 € daté du 28/10 mais saisi le 03/11 (après le relevé du 30/10). La photo du 03/11 le prend comme flux
// (fluxCumules_ − fluxDejaEnregistres_ de Code.js) : PEA 1 000 € fin octobre, 1 500 € le 03/11 (dont 500 versés), 1 530 € fin novembre.
// À la main : 0 % puis +2 % → +2 %. L'ancien calcul (versements DATÉS du mois) ne le voyait pas : (1 530 − 1 000) / 1 000 = +53 %, fausse performance.
{
  const H = histo([["2026-10-30", 1000, 0, 0, 0], ["2026-11-03", 1500, 0, 500, 0], ["2026-11-30", 1530, 0, 0, 0]], true);
  const f = fichier(H, "2026-10-30", "2026-11-30");
  ok(pres(f.pea.r, 0.02, 1e-6), "Cas 3 · versement saisi en retard : +2 % (plus de fausse performance de +53 %)", f.pea.r);
  ok(f.pea.verseEur === 500 && f.pea.verse === 1, "Cas 3 · il compte comme « versé du mois » de novembre (le relevé d'octobre est parti sans lui)", f.pea.verseEur);
  ok(pres(pctMoi(H, "pea", 202611), f.pea.r, 1e-12), "Cas 3 · même % que Moi");
}
/* ---------- photo du soir pas encore prise à 19 h : calculée maintenant (« live »), même règle ---------- */
{
  const H = histo([["2026-10-30", 1000, 0, 0, 0], ["2026-11-27", 1040, 0, 0, 0]], true);
  H[H.length - 1][16] = 104;   // la ligne du 27 est complète
  const f = fichier(H, "2026-10-30", "2026-11-30", { v: [1300, 0, 0, 0], f: [250, 0, 0, 0] });
  ok(f.live && pres(f.pea.r, 1050 / 1000 - 1, 1e-4) && f.pea.verseEur === 250, "Photo du 30/11 absente : valeur de maintenant, versement pas encore noté = flux → +5 %", [f.pea.r, f.pea.verseEur]);
  ok(JSON.stringify(f) === JSON.stringify(versus(H, "2026-10-30", "2026-11-30", { v: [1300, 0, 0, 0], f: [250, 0, 0, 0] })), "Photo absente · le Versus trouve la même chose");
}
/* ---------- indice du Sheet vide sur la ligne du soir : prolongé, et Moi aussi ---------- */
{
  const H = histo([["2026-10-30", 1000, 200, 0, 0], ["2026-11-16", 1010, 200, 0, 0], ["2026-11-30", 1111, 210, 0, 0]], true);
  ok(H[3][16] === "", "Le faux Sheet n'a pas encore calculé l'indice du 30/11 (cas de l'audit C4)");
  const f = fichier(H, "2026-10-30", "2026-11-30");
  ok(pres(f.pea.r, 0.111, 1e-4) && pres(pctMoi(H, "pea", 202611), f.pea.r, 1e-12) && pres(pctMoi(H, "av", 202611), f.av.r, 1e-12), "Indice vide : prolongé jour par jour, Moi affiche le même % (PEA, AV)", [f.pea.r, f.av.r]);
}
/* ---------- CTO à côté : « Portefeuille » du Versus = PEA + AV seulement ---------- */
{
  const H = histo([["2026-10-30", 1000, 1000, 0, 0], ["2026-11-30", 1100, 1000, 0, 0]], false);
  H.forEach((l, i) => { if (i) { l[2] = i === 1 ? 5000 : 2500; l[5] += l[2]; } });   // CTO −50 % : ne compte pas
  const f = fichier(H, "2026-10-30", "2026-11-30");
  ok(pres(f.pf.r, 0.05, 1e-6), "CTO à −50 % ignoré : Portefeuille du Versus (PEA + AV) = +5 %", f.pf.r);
}
/* ---------- P3 · ce qui part au Versus : aucun euro ---------- */
{
  const H = histo([["2026-10-30", 31000, 12000, 29000, 11500], ["2026-11-14", 32000, 12100, 400, 0], ["2026-11-30", 32800, 12150, 0, 0]], true);   // 1re photo : tous les versements passés
  const p = fichier(H, "2026-10-30", "2026-11-30"), envoi = vm.runInContext("pctPourEnvoi_", ctxF)(p);
  const cles = new Set(); JSON.stringify(envoi, (k, v) => { if (k) cles.add(k); return v; });
  ok([...cles].every(k => ["pea", "av", "pf", "r", "actif", "verse", "pv"].includes(k)), "P3 · seulement des %, des oui/non et des signes", [...cles]);
  const nombres = []; JSON.stringify(envoi, (k, v) => { if (typeof v === "number") nombres.push(v); return v; });
  ok(nombres.every(x => Math.abs(x) < 10) && !/31000|32800|12150|400/.test(JSON.stringify(envoi)), "P3 · aucun montant (tous les nombres sont des % ou −1/0/1)", envoi);
  // le vrai envoi : envoyerReleveVersus_ avec un faux appel réseau
  const vus = []; ctxF.appelerVersus_ = c => { vus.push(c); return { ok: true, message: "ok" }; };
  vm.runInContext("appelerVersus_ = this.appelerVersus_; lirePourVersus_ = () => ({ cle: 202611, jour: '2026-11-30', pct: this.P, financier: 1234567 }); PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'Clément' }) };", Object.assign(ctxF, { P: p }));
  vm.runInContext("envoyerReleveVersus_()", ctxF);
  const corps = vus[0] || {};
  ok(corps.action === "importPct" && corps.millionnaire === true && !("valeurs" in corps) && !/31000|32800|12150|1234567/.test(JSON.stringify(corps)), "P3 · envoi réel : action importPct, millionnaire oui/non, aucun montant (ni enveloppes, ni patrimoine)", Object.keys(corps));
}
/* ---------- Versus : la série recomposée redonne exactement les % reçus, sans aucun vrai montant ---------- */
{
  const ligne = (k, b) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", b, Array(25).fill(null)];
  const pers = [{ nom: "Clément", rows: [ligne(202610, [0, 30000, 0, 10000, null, null, null, null]), ligne(202611, Array(8).fill(null)), ligne(202612, Array(8).fill(null))] },
    { nom: "Théo", rows: [ligne(202611, [100, 5000, 0, 0, null, null, null, null])] }];
  pers[0].rows[0][3] = [0, 40000, 0, 0.01, 38000, 0, 30000, 0, 0.01, 29000, 0, 10000, 0, 0.01, 9000].concat(Array(10).fill(null));
  pers[1].rows[0][3] = [100, 5000, 30, 0.0061, 4800, 100, 5000, 30, 0.0061, 4800, 0, 0, 0, null, 0].concat(Array(10).fill(null));
  const rec = (r1, r2, r3, v) => ({ pea: { r: r1, actif: true, verse: v, pv: 0.12 }, av: { r: r2, actif: true, verse: 0, pv: 0.05 }, pf: { r: r3, actif: true, verse: v, pv: 0.1 } });
  const pct = { "Clément": { 202611: { pct: rec(0.031, -0.004, 0.0222, 1) }, 202612: { pct: rec(-0.012, 0.002, -0.0085, 0) } }, "Théo": { 202611: { pct: rec(0.0074, null, 0.0074, 1) } } };
  vm.runInContext("vsSurcouchePct_", ctxV)(pers, pct, "Théo");
  const c = pers[0], cn = c.rows[1], cd = c.rows[2];
  ok(c.pct === true && !pers[1].pct, "Clément est « en % », Théo (administrateur) garde ses montants");
  ok(cn[3][3] === 0.0222 && cn[3][8] === 0.031 && cn[3][13] === -0.004 && cd[3][3] === -0.0085, "Les % de Clément (ensemble, PEA, AV) sont repris tels quels", [cn[3][3], cn[3][8], cn[3][13]]);
  ok(cn[3][0] > 0 && cn[3][0] < 1 && cd[3][0] === 0, "Versement : seulement le signe (un centime à l'échelle), rien en novembre → rien en décembre", [cn[3][0], cd[3][0]]);
  ok(pres(cn[3][1], 40000 * 1.0222, 1e-6) && pres(cd[3][1], 40000 * 1.0222 * (1 - 0.0085), 1e-6) && cn[4] === "pct", "Série à l'échelle : valeur = mois d'avant × (1 + %), jamais un vrai montant");
  ok(pres(cn[3][1] / cn[3][4] - 1, 0.1, 1e-9), "% de gain sur ce qui a été versé : redonné exactement (10 %)");
  ok(pers[1].rows[0][3][3] === 0.0074 && pers[1].rows[0][3][1] === 5000, "Théo : son % du mois devient celui de Moi (+0,74 %), ses montants restent");
  // masquage pour l'appli : Clément ne voit pas non plus de faux montant à son nom
  const o = vm.runInContext("vsMasquerMontants_", ctxV)({ personnes: JSON.parse(JSON.stringify(pers)), journal: [] }, "Clément");
  ok(o.personnes[0].prive === true && pres(o.personnes[0].rows[2][3][1], 10000, 1e-6), "Pour Clément lui-même : série masquée (« montants privés »), seuls les % s'affichent");
}
console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
process.exit(ko.length ? 1 : 0);
