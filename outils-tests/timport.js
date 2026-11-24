/* Test serveur V74 · audit B2, B8, C3 : relevé automatique de fin de mois.
   Charge le VRAI script du Versus (app_scripts/versus/API.js) et le VRAI script commun des fichiers perso
   (app_scripts/portefeuille-epargne/commun/LiaisonVersus.js) dans un faux Google Sheet en mémoire.
   Aucune vraie donnée : tous les chiffres sont inventés. Lancer : node outils-tests/timport.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts");
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };

/* ---------- faux Google Apps Script ---------- */
function feuille(nom, lignes) {
  const d = lignes.map(l => l.slice());
  const cell = (r, c) => { while (d.length < r) d.push([]); const L = d[r - 1]; while (L.length < c) L.push(""); return L; };
  return { nom, d, getName: () => nom, getDataRange: () => ({ getValues: () => d.map(l => l.slice()) }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { cell(r + i, c + j); return d[r + i - 1][c + j - 1]; })),
      setValues: v => v.forEach((l, i) => l.forEach((x, j) => { cell(r + i, c + j); d[r + i - 1][c + j - 1] = x; })) }),
    appendRow: l => d.push(l.slice()) };
}
function classeur(feuilles) { const f = {}; feuilles.forEach(x => f[x.nom] = x); return { getSheetByName: n => f[n] || null, getSheets: () => Object.values(f), getSpreadsheetTimeZone: () => "Europe/Paris" }; }
function gas(actif, fichiers) {
  const props = {}, mails = [], triggers = [];
  const pad = n => String(n).padStart(2, "0");
  const fmt = (d, tz, f) => f.replace("yyyy", d.getFullYear()).replace("MM", pad(d.getMonth() + 1)).replace("dd", pad(d.getDate())).replace("HH", pad(d.getHours())).replace("H", d.getHours()).replace("mm", pad(d.getMinutes())).replace("ss", pad(d.getSeconds()));
  const ctx = {
    console: { log: () => {} }, Date, JSON, Math, Number, String, Array, Object, isFinite, isNaN, RegExp, Error,
    SpreadsheetApp: { getActive: () => actif, openById: id => { if (!fichiers[id]) throw new Error("illisible"); return fichiers[id]; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    Utilities: { formatDate: fmt, sleep: () => {} },
    MailApp: { sendEmail: o => mails.push(o) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: h => { const t = { getHandlerFunction: () => h }; const b = { timeBased: () => b, after: () => b, everyDays: () => b, atHour: () => b, create: () => { triggers.push(t); return t; } }; return b; } }
  };
  vm.createContext(ctx);
  return { ctx, props, mails, triggers };
}
/* onglet « Data X » du Versus : A = date du mois, B:I = versé/valeur PEA, AV, CTO, crypto */
function data(nom, mois) {   // mois : [[aaaamm, [8 valeurs]]]
  const l = Array.from({ length: 6 }, () => []);
  mois.forEach(([k, v]) => l.push([new Date(Math.floor(k / 100), k % 100 - 1, 28, 12)].concat(v)));
  return feuille("Data " + nom, l);
}
const vide = () => ["", "", "", "", "", "", "", ""];
/* fichier « Portefeuille & Épargne » inventé */
function fichierPerso(peaStatut, peaValeur, avStatut, avValeur) {
  return classeur([
    feuille("Paramètres", [["Enveloppe", "Établissement", "Catégorie", "Régime fiscal", "Date d'ouverture", "Statut", "Périmètre"],
      ["PEA", "", "Bourse", "PEA", "", peaStatut, "Portefeuille"], ["Assurance-vie", "", "AV", "AV", "", avStatut, "Portefeuille"]]),
    feuille("Positions", [["Positions"], ["Enveloppe", "Périmètre", "Espèces (€)", "Valeur des titres (€)", "Valeur totale (€)"],
      ["PEA", "Portefeuille", 0, 0, peaValeur], ["Assurance-vie", "Portefeuille", 0, 0, avValeur]]),
    feuille("Ordres", [["Date", "Enveloppe", "Type", "Actif", "Quantité", "Montant (€)"]]),
    feuille("Aujourd'hui", [["Valeur du portefeuille", "Patrimoine financier"], ["", 2000000]])
  ]);
}

const API = fs.readFileSync(path.join(RACINE, "versus", "API.js"), "utf8");
const MAINTENANT = new Date(2026, 10, 30, 19, 30);   // 30/11/2026 (dernier jour ouvré) à 19 h 30
function versus(datas, fichiers) {
  const actif = classeur(datas.concat([feuille("Bugs", [["#"]]), feuille("Journal app", [["Date"]])]));
  const g = gas(actif, fichiers);
  vm.runInContext(API.replace(/^const VS_PATRIMOINES = \[[\s\S]*?\];/m, "const VS_PATRIMOINES = [{ personne: 'Théo', id: 'F_THEO' }, { personne: 'Clément', id: 'F_CLEMENT' }];"), g.ctx);
  vm.runInContext("Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(" + MAINTENANT.getTime() + "); } static now() { return " + MAINTENANT.getTime() + "; } };", g.ctx);
  vm.runInContext("vsNoterJournal_ = function () {}; vsLignesJournal_ = function () { return []; };", g.ctx);
  const D = vm.runInContext("Date", g.ctx);   // dates du faux Sheet créées dans le monde du script (sinon « instanceof Date » échoue)
  datas.forEach(f => f.d.forEach(l => { if (l[0] instanceof global.Date) l[0] = new D(l[0].getTime()); }));
  return Object.assign(g, { actif, run: code => vm.runInContext(code, g.ctx) });
}
const essai = f => { try { return { r: f() }; } catch (e) { return { err: e }; } };

/* ---------- B2 : lecture d'un fichier (Versus) ---------- */
{
  const V = versus([data("Théo", [[202611, vide()]])], {});
  const lire = (fp) => essai(() => V.run("vsLirePatrimoine_")({ personne: "Théo", id: "x" }));
  V.ctx.SpreadsheetApp.openById = () => fichierPerso("Ouvert", "—", "À ouvrir", "");
  let x = lire(); ok(x.err && x.err.code === "cours", "B2 · PEA ouvert affiché « — » : lecture refusée (plus de 0 €)");
  V.ctx.SpreadsheetApp.openById = () => fichierPerso("Ouvert", "", "À ouvrir", "");
  x = lire(); ok(x.err && x.err.code === "cours", "B2 · PEA ouvert à case vide : lecture refusée");
  V.ctx.SpreadsheetApp.openById = () => fichierPerso("Ouvert", 1234.5, "À ouvrir", "");
  x = lire(); ok(!x.err && x.r.valeurs[1] === 1234.5 && x.r.valeurs[3] === 0, "B2 · PEA lisible + assurance-vie pas encore ouverte (vide) : lu normalement");
  V.ctx.SpreadsheetApp.openById = () => fichierPerso("Clôturé", "—", "Ouvert", 800);
  x = lire(); ok(!x.err && x.r.valeurs[1] === 0 && x.r.valeurs[3] === 800, "B2 · PEA clôturé sans valeur : compté 0 € (normal)");
}
/* ---------- B2 : contrôle ±25 % à l'écriture ---------- */
{
  const avant = [0, 1000, 0, 500, "", "", "", ""];
  const cas = [
    ["PEA tombé à 0 € (cours manquant)", [0, 0, 0, 510, "", "", "", ""], false],
    ["PEA à +30 % sur le mois", [0, 1300, 0, 510, "", "", "", ""], false],
    ["PEA à −30 % sur le mois", [0, 700, 0, 510, "", "", "", ""], false],
    ["mois normal (+5 %, +2 %)", [0, 1050, 0, 510, "", "", "", ""], true],
    ["gros versement (+1000 €, valeur 2050)", [1000, 2050, 0, 510, "", "", "", ""], true],
    ["PEA vidé par un retrait", [-1000, 0, 0, 510, "", "", "", ""], true]];
  for (const [t, vals, attendu] of cas) {
    const V = versus([data("Théo", [[202610, avant], [202611, vide()]])], {});
    const x = essai(() => V.run("vsAppliquerImport_")("Théo", { cle: 202611, valeurs: vals.slice(), detail: [] }));
    const ecrit = V.actif.getSheetByName("Data Théo").d[7].slice(1, 9);
    if (attendu) ok(!x.err && ecrit[1] === vals[1], "B2 · " + t + " : écrit");
    else ok(x.err && x.err.code === "anomalie" && ecrit.every(v => v === ""), "B2 · " + t + " : arrêté, rien d'écrit");
    if (!attendu) ok(x.err && !/\d{3,}\s?€/.test(x.err.message), "V73 · message sans montant : « " + (x.err ? x.err.message : "") + " »");
  }
  const V = versus([data("Nicolas", [[202611, vide()]])], {});
  const x = essai(() => V.run("vsAppliquerImport_")("Nicolas", { cle: 202611, valeurs: [1000, 1000, "", "", "", "", "", ""], detail: [] }));
  ok(!x.err, "B2 · premier mois (rien le mois d'avant) : écrit sans contrôle");
}
/* ---------- B2 : relevé ENVOYÉ par un fichier (script figé) avec un PEA à 0 € ---------- */
{
  const V = versus([data("Devlin", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]])], {});
  const x = essai(() => V.run("vsRecevoirImport_")({ personne: "Devlin", mois: 202611, valeurs: [0, 0, 0, 0, "", "", "", ""] }));
  ok(x.err && x.err.code === "anomalie", "B2 · fichier figé qui envoie un PEA à 0 € : refusé par le serveur");
  ok(V.mails.length === 1 && /Devlin/.test(V.mails[0].body) && V.actif.getSheetByName("Bugs").d.length === 2, "B2 · Théo prévenu (mail + onglet Bugs)");
}
/* ---------- B2 : un joueur qui envoie lui-même, mais dont le fichier lu par le Versus est suspect ---------- */
{
  const V = versus([data("Théo", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]]), data("Clément", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]])],
    { F_THEO: fichierPerso("Ouvert", 1040, "À ouvrir", ""), F_CLEMENT: fichierPerso("Ouvert", "—", "À ouvrir", "") });
  V.props["PUSH_Clément"] = "1";
  const r = V.run("vsImporterTous_")(); if (process.env.DBG) console.log(JSON.stringify(r));
  ok(r.echecs.length === 1 && /Clément/.test(r.echecs[0]), "B2 · « — » chez un joueur qui envoie aussi lui-même : signalé, plus avalé en silence");
  ok(V.actif.getSheetByName("Data Théo").d[7][2] === 1040, "B2 · les autres joueurs sont importés normalement");
}
/* ---------- B8 : contrôle d'arrivée des relevés ---------- */
{
  const V = versus([data("Théo", [[202611, [0, 1040, 0, 0, "", "", "", ""]]]), data("Clément", [[202611, vide()]]), data("Kévin", [[202611, vide()]]), data("Devlin", [[202611, vide()]])], {});
  V.props["PUSH_Devlin"] = "1";
  V.run("vsImportFinDeMois")();
  ok(V.triggers.some(t => t.getHandlerFunction() === "vsVerifierReleves"), "B8 · l'import de 19 h programme le contrôle d'arrivée (90 min plus tard)");
  V.mails.length = 0;
  const m = V.run("vsVerifierReleves")();
  ok(JSON.stringify(m.slice().sort()) === JSON.stringify(["Clément", "Devlin"]), "B8 · relevés automatiques manquants repérés : " + JSON.stringify(m) + " (Kévin, saisi à la main, n'est pas réclamé)");
  ok(V.mails.length === 1 && /Clément/.test(V.mails[0].body) && /Devlin/.test(V.mails[0].body) && !/\d{3,}\s?€/.test(V.mails[0].body), "B8 · un seul mail à Théo, sans aucun montant");
  ok(!V.triggers.some(t => t.getHandlerFunction() === "vsVerifierReleves"), "B8 · le contrôle se désinstalle après usage");
}
/* ---------- C3 : premier million annoncé par un fichier ---------- */
{
  const corps = n => ({ personne: n, mois: 202611, valeurs: [0, 1000, 0, 0, "", "", "", ""], millionnaire: true });
  let V = versus([data("Kévin", [[202611, vide()]])], {});   // Kévin : fichier non relu par le Versus
  essai(() => V.run("vsRecevoirImport_")(corps("Kévin")));
  ok(!V.props.PREMIER_MILLION && V.props.MILLION_A_VERIFIER_Kévin && V.mails.some(m => /à vérifier/.test(m.subject)), "C3 · fichier illisible : pas de badge sur parole, Théo prévenu");
  const n = V.mails.length; essai(() => V.run("vsRecevoirImport_")(corps("Kévin")));
  ok(V.mails.length === n, "C3 · le mail « à vérifier » n'est envoyé qu'une fois");
  V = versus([data("Théo", [[202611, vide()]])], { F_THEO: fichierPerso("Ouvert", 1000, "À ouvrir", "") });
  essai(() => V.run("vsRecevoirImport_")(corps("Théo")));
  ok(!!V.props.PREMIER_MILLION, "C3 · fichier relu et vérifié ≥ 1 M€ : badge posé");
  V = versus([data("Théo", [[202611, vide()]])], { F_THEO: (() => { const f = fichierPerso("Ouvert", 1000, "À ouvrir", ""); f.getSheetByName("Aujourd'hui").d[1][1] = 900000; return f; })() });
  essai(() => V.run("vsRecevoirImport_")(corps("Théo")));
  ok(!V.props.PREMIER_MILLION, "C3 · fichier relu sous 1 M€ : pas de badge");
}
/* ---------- B2 côté fichier perso (script commun) ---------- */
{
  const L = fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "LiaisonVersus.js"), "utf8");
  const lire = fp => { const g = gas(fp, {}); vm.runInContext(L + "\nfunction erreur_(c, m) { const e = new Error(m); e.code = c; return e; }", g.ctx);
    vm.runInContext("Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(" + MAINTENANT.getTime() + "); } };", g.ctx);
    return essai(() => vm.runInContext("lirePourVersus_()", g.ctx)); };
  let x = lire(fichierPerso("Ouvert", "—", "À ouvrir", ""));
  ok(x.err && x.err.code === "cours", "B2 · fichier perso : PEA ouvert à « — » n'est plus envoyé à 0 €");
  x = lire(fichierPerso("Ouvert", 1234.5, "À ouvrir", ""));
  ok(!x.err || x.err.code !== "cours", "B2 · fichier perso : PEA lisible, pas d'erreur de cours" + (x.err ? " (autre arrêt du faux classeur : " + x.err.message + ")" : ""));
}
process.exit(ko.length ? 1 : 0);
