/* Outils communs aux tests des mini-jeux (tmj-*.js) : fausses données uniquement, serveur Google intercepté.
   SECRET : ce dépôt est public. Les textes des réponses « mj » ci-dessous sont INVENTÉS (« Jeu d'essai », « Option A »…) :
   jamais les vraies règles, qui vivent dans le dépôt privé (app_scripts/versus/MJ_*.js). */
const { chromium } = require("playwright"), fs = require("fs");
const PORT = process.env.PORT || 8771;
const DOSSIER = process.env.CAPTURES || "/tmp/claude-0/-home-user/6d9f1796-e607-5fc4-8119-363a157f01a8/scratchpad/minijeux";
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const KS = [202701, 202702, 202703, 202704, 202705, 202706, 202707, 202708, 202709, 202710, 202711];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i, jusqua) {
  const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010;
  KS.filter(k => k <= jusqua).forEach(k => { const r = ((k + i) % 5 - 2) / 100; v = Math.round(v * (1 + r) + 50); rows.push(ligne(k, v, r)); });
  return { nom, rows };
}
function donnees(session, jusqua) {
  const chauffe = jusqua < 202701;
  return { ok: true, version: 88, genere: "2027-01-12T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map((n, i) => chauffe ? { nom: n, rows: [ligne(202611, 1000, 0.01)] } : personne(n, i, jusqua)),
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]].concat(KS.filter(k => k <= jusqua).map(k => [k, 0.004])), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
/* ---- réponses « mj » inventées ---- */
const EMP = i => ("e" + i.toString(16)).padStart(4, "0").repeat(16);
const CONTENU = { ico: "🏜️", titre: "Jeu d'essai", but: "Ton but : un but inventé pour le test.", ensemble: "Ensemble : un objectif commun inventé pour le test.", accroche: "Accroche inventée pour le test.", regle: ["Règle inventée numéro un.", "Règle inventée numéro deux."], recompense: "Récompense inventée." };
const REC = { trophee: { ico: "🏜️", nom: "Trophée d'essai" }, titre: "Titre d'essai", objet: ["plaque", "epice"], pourTous: false };
const ETAT = o => Object.assign({ fait: false, jour: 5, ligne: ["Ligne du jour inventée : 3.", "Deuxième ligne inventée."], nuit: "Nuit inventée.",
  options: [{ id: "a", ico: "🅰️", lib: "Option A", sous: "effet inventé A" }, { id: "b", ico: "🅱️", lib: "Option B", sous: "effet inventé B" }],
  compteurs: [{ ico: "🏠", lib: "Compteur 1", val: 4 }, { ico: "🏜️", lib: "Compteur 2", val: 2 }, { ico: "🪱", lib: "Compteur 3", val: 0 }],
  commun: { ico: "🤝", lib: "Objectif commun inventé", val: 37, objectif: 120, reussi: false },
  tableau: NOMS.map((n, i) => ({ nom: n, val: 9 - i, txt: (9 - i) + " unités" })), scene: { a: 2, b: 4, c: true, d: true } }, o || {});
/* les mois inventés : univers et type de chaque mois construit (les textes restent inventés) */
const MOIS_T = { 202701: { univers: "silverstone", type: "choix", ico: "🏜️" }, 202702: { univers: "djeddah", type: "formulaire", ico: "🦉" }, 202703: { univers: "melbourne", type: "chasse", ico: "😸" },
  202704: { univers: "suzuka", type: "choix", ico: "💍" }, 202705: { univers: "miami", type: "choix", ico: "🌳" }, 202706: { univers: "montreal", type: "formulaire", ico: "⚔️" },
  202707: { univers: "bahrein", type: "choix", ico: "🍲" }, 202708: { univers: "spa", type: "formulaire", ico: "🔦" }, 202709: { univers: "lasvegas", type: "choix", ico: "⛵" },
  202711: { univers: "interlagos", type: "choix", ico: "🧱" }, 202712: { univers: "monza", type: "formulaire", ico: "🌀" } };
/** l'état du mois (action mj, op etat) : moisAuj = mois en cours ; courant = état du jour du joueur ou null ; finis = résultats */
function MJ_ETAT(moisAuj, etat, finis) {
  return { ok: true, ouvert: true, aujourdhui: moisAuj * 100 + 5,
    calendrier: Array.from({ length: 12 }, (_, i) => { const m = 202701 + i, T = MOIS_T[m], c = { mois: m }; if (T) Object.assign(c, { empreinte: EMP(i + 1), depuis: 20270101 });
      if (T && m <= moisAuj) Object.assign(c, { ouvert: true, id: "essai" + i, univers: T.univers, ico: T.ico, titre: "Jeu d'essai" }); const f = (finis || []).find(x => x.mois === m); if (f) { c.gagnants = f.gagnants; c.commun = !!(f.commun && f.commun.reussi); } return c; }),
    courant: MOIS_T[moisAuj] && etat ? { mois: moisAuj, id: "essai", univers: MOIS_T[moisAuj].univers, type: MOIS_T[moisAuj].type, contenu: Object.assign({}, CONTENU, { ico: MOIS_T[moisAuj].ico }), recompense: REC, etat } : null,
    finis: finis || [] };
}
const FINI = (mois, g, reussi) => ({ mois, id: "essai", univers: MOIS_T[mois].univers, type: MOIS_T[mois].type, contenu: Object.assign({}, CONTENU, { ico: MOIS_T[mois].ico }), recompense: REC, gagnants: g,
  commun: { reussi: !!reussi, val: reussi ? 130 : 80, objectif: 120, texte: reussi ? "Objectif commun inventé réussi." : "Objectif commun inventé manqué." }, tableau: NOMS.map((n, i) => ({ nom: n, val: g.includes(n) ? 30 : 10 - i, txt: "unités inventées" })), texte: "Résultat inventé.", revele: { graine: "ab".repeat(32) } });
const FINI_JANV = (g, reussi) => ({ mois: 202701, id: "essai", univers: "silverstone", type: "choix", contenu: CONTENU, recompense: REC, gagnants: g, commun: { reussi: !!reussi, val: 80, objectif: 120, texte: reussi ? "Objectif commun inventé réussi." : "Objectif commun inventé manqué." }, tableau: NOMS.map((n, i) => ({ nom: n, val: g.includes(n) ? 30 : 10 - i, txt: "unités inventées" })), texte: "Résultat inventé.", revele: { graine: "ab".repeat(32) } });
/** ouvre l'appli : quand, session, jusqua, mj (fonction (corps) → réponse), adminOn, sombre, reduit, revVu (révélations déjà vues) */
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [], req = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c.action === "mj" ? "mj:" + c.op : c.action);
    const rep = c.action === "mj" ? (o.mj ? o.mj(c) : { ok: true, ouvert: false }) : c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session, o.jusqua);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(rep) }); });
  await p.addInitScript(([adminOn, revVu]) => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.gpVu.2027", "202712"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.chauffe1", "1");
    if (revVu) for (let m = 202701; m <= 202712; m++) { localStorage.setItem("versus.mjRev." + m, "1"); localStorage.setItem("versus.mjFin." + m, "1"); } if (adminOn) sessionStorage.setItem("versus.adminOn", "1"); }, [!!o.adminOn, !!o.revVu]);
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1500);
  return { ctx, p, err, req };
}
/** va sur la page Course (onglet Podium › Course) en fermant ce qui gêne */
const allerCourse = p => p.evaluate(async () => { document.querySelectorAll(".revel:not(.mj-rev):not(.mj-cer), .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); if (saisonVisible()) { ETAT.podium = "gp"; GP_ETAPE = null; garder(); } montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 1500)); });
const allerVitrine = p => p.evaluate(async () => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "defis"; VIT_ONGLET = "mondes"; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 900)); });
const deborde = sel => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !x.closest(".cbo-rayons") && !x.classList.contains("cbo-rayons"); }).map(x => x.className.baseVal !== undefined ? x.tagName : x.className).slice(0, 5)`;
function compteur() { const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); }; return { ko, ok }; }
function fin(ko) { console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI."); process.exit(ko.length ? 1 : 0); }
module.exports = { chromium, DOSSIER, NOMS, CONTENU, REC, ETAT, MJ_ETAT, FINI_JANV, FINI, MOIS_T, EMP, page, allerCourse, allerVitrine, deborde, compteur, fin };
