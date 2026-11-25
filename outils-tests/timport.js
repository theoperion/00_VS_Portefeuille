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
    getRange: (r, c, nr = 1, nc = 1) => { const rg = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { cell(r + i, c + j); return d[r + i - 1][c + j - 1]; })),
      setValues: v => { v.forEach((l, i) => l.forEach((x, j) => { cell(r + i, c + j); d[r + i - 1][c + j - 1] = x; })); return rg; },
      setValue: x => { cell(r, c); d[r - 1][c - 1] = x; return rg; }, getValue: () => { cell(r, c); return d[r - 1][c - 1]; }, setFontWeight: () => rg }; return rg; },
    appendRow: l => d.push(l.slice()), getLastRow: () => d.length, deleteRow: r => d.splice(r - 1, 1), setFrozenRows: () => {}, hideSheet: () => {} };
}
function classeur(feuilles) { const f = {}; feuilles.forEach(x => f[x.nom] = x); return { getSheetByName: n => f[n] || null, getSheets: () => Object.values(f), getSpreadsheetTimeZone: () => "Europe/Paris", insertSheet: n => (f[n] = feuille(n, [])) }; }
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
    feuille("Ordres", [["Date", "Enveloppe", "Type", "Actif", "Quantité", "Montant (€)"], [new Date(2026, 0, 5, 12), "PEA", "Apport", "", "", 1000]]),   // déjà dans la photo d'octobre
    feuille("Aujourd'hui", [["Valeur du portefeuille", "Patrimoine financier"], ["", 2000000]]),
    // V89 : photo du soir du relevé d'octobre (PEA 1 000 €) ; celle du 30/11 n'est pas encore prise → valeur de maintenant (Positions)
    feuille("Historique", [["Date", "PEA", "CTO", "AV", "Crypto", "Valeur portefeuille (€)", "Flux PEA (€)", "Flux CTO (€)", "Flux AV (€)", "Flux crypto (€)"],
      [new Date(2026, 9, 30, 18), 1000, 0, 0, 0, 1000, 1000, 0, 0, 0]])
  ]);
}

const API = fs.readFileSync(path.join(RACINE, "versus", "API.js"), "utf8") + "\n" + fs.readFileSync(path.join(RACINE, "versus", "RelevesPct.js"), "utf8");   // V89 : relevés en %
const MAINTENANT = new Date(2026, 10, 30, 19, 30);   // 30/11/2026 (dernier jour ouvré) à 19 h 30
function versus(datas, fichiers) {
  const actif = classeur(datas.concat([feuille("Bugs", [["#"]]), feuille("Journal app", [["Date"]])]));
  const g = gas(actif, fichiers);
  vm.runInContext(API.replace(/^const VS_PATRIMOINES = \[[\s\S]*?\];/m, "const VS_PATRIMOINES = [{ personne: 'Théo', id: 'F_THEO' }, { personne: 'Clément', id: 'F_CLEMENT' }];"), g.ctx);
  vm.runInContext("Date = class extends Date { static [Symbol.hasInstance](x) { return Object.prototype.toString.call(x) === '[object Date]'; } constructor(...a) { if (a.length) super(...a); else super(" + MAINTENANT.getTime() + "); } static now() { return " + MAINTENANT.getTime() + "; } };", g.ctx);
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
  x = lire(); ok(!x.err && x.r.valeurs[1] === 1234.5 && (x.r.valeurs[3] === 0 || x.r.valeurs[3] === ""), "B2 · PEA lisible + assurance-vie pas encore ouverte (vide) : lu normalement");
  ok(!x.err && Math.abs(x.r.pct.pea.r - 0.2345) < 1e-4 && !x.r.pct.av.actif, "V89 · le même relevé en % (PEA +23,45 % depuis la photo d'octobre, AV vide)");
  const xc = essai(() => V.run("vsLirePatrimoine_")({ personne: "Clément", id: "x" }));
  ok(!xc.err && xc.r.valeurs === null && xc.r.pct.pea.actif, "V89 · fichier d'un autre pilote lu par le Versus : % seulement, aucun montant renvoyé");
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
  const V = versus([data("Théo", [[202611, vide()]])], {});
  const x = essai(() => V.run("vsAppliquerImport_")("Théo", { cle: 202611, valeurs: [1000, 1000, "", "", "", "", "", ""], detail: [] }));
  ok(!x.err, "B2 · premier mois (rien le mois d'avant) : écrit sans contrôle");
  const V2 = versus([data("Nicolas", [[202611, vide()]])], {});
  const x2 = essai(() => V2.run("vsAppliquerImport_")("Nicolas", { cle: 202611, valeurs: [1000, 1000, "", "", "", "", "", ""], detail: [] }));
  ok(x2.err && V2.actif.getSheetByName("Data Nicolas").d[6].slice(1, 9).every(v => v === ""), "V89 · des euros d'un autre pilote que Théo : refusés, rien d'écrit dans Data");
}
/* ---------- B2 : relevé ENVOYÉ par un fichier (script figé) avec un PEA à 0 € ---------- */
{
  const V = versus([data("Devlin", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]])], {});
  const x = essai(() => V.run("vsRecevoirImport_")({ personne: "Devlin", mois: 202611, valeurs: [0, 0, 0, 0, "", "", "", ""] }));
  ok(x.err && x.err.code === "anomalie", "B2 · fichier figé qui envoie un PEA à 0 € : refusé par le serveur");
  ok(V.mails.length === 1 && /Devlin/.test(V.mails[0].body) && V.actif.getSheetByName("Bugs").d.length === 2, "B2 · Théo prévenu (mail + onglet Bugs)");
  ok(V.actif.getSheetByName("Data Devlin").d[7].slice(1, 9).every(v => v === ""), "V89 · ancien script (euros) : rien n'est écrit en euros dans Data Devlin");
  const V2 = versus([data("Devlin", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]])], {});
  const x2 = essai(() => V2.run("vsRecevoirImport_")({ personne: "Devlin", mois: 202611, valeurs: [100, 1150, 0, 0, "", "", "", ""] }));
  const rp = V2.actif.getSheetByName("Relevés %"), lp = rp && rp.d[1], j = lp ? JSON.parse(lp[3]) : null;
  ok(!x2.err && j && Math.abs(j.pea.r - 50 / 1050) < 1e-6 && j.pea.verse === 1 && V2.actif.getSheetByName("Data Devlin").d[7].slice(1, 9).every(v => v === "") && !/1150|1000/.test(lp[3]),
    "V89 · ancien script : converti en % tout de suite (+4,76 %), rangé dans « Relevés % », aucun euro gardé", j);
}
/* ---------- B2 : un joueur qui envoie lui-même, mais dont le fichier lu par le Versus est suspect ---------- */
{
  const V = versus([data("Théo", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]]), data("Clément", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]])],
    { F_THEO: fichierPerso("Ouvert", 1040, "À ouvrir", ""), F_CLEMENT: fichierPerso("Ouvert", "—", "À ouvrir", "") });
  V.props["PUSH_Clément"] = "1";
  const r = V.run("vsImporterTous_")(); if (process.env.DBG) console.log(JSON.stringify(r));
  ok(r.echecs.length === 1 && /Clément/.test(r.echecs[0]), "B2 · « — » chez un joueur qui envoie aussi lui-même : signalé, plus avalé en silence");
  ok(V.actif.getSheetByName("Data Théo").d[7][2] === 1040, "B2 · les autres joueurs sont importés normalement");
  ok(V.actif.getSheetByName("Data Clément").d[7].slice(1, 9).every(v => v === ""), "V89 · rien en euros dans Data Clément");
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
  const L = fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "Code.js"), "utf8") + "\n" + fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "LiaisonVersus.js"), "utf8");   // V14 : le relevé lit l'Historique (outils de Code.js)
  const lire = fp => { const g = gas(fp, {}); vm.runInContext(L + "\nfunction erreur_(c, m) { const e = new Error(m); e.code = c; return e; }", g.ctx);
    vm.runInContext("Date = class extends Date { static [Symbol.hasInstance](x) { return Object.prototype.toString.call(x) === '[object Date]'; } constructor(...a) { if (a.length) super(...a); else super(" + MAINTENANT.getTime() + "); } };", g.ctx);
    return essai(() => vm.runInContext("lirePourVersus_()", g.ctx)); };
  let x = lire(fichierPerso("Ouvert", "—", "À ouvrir", ""));
  ok(x.err && x.err.code === "cours", "B2 · fichier perso : PEA ouvert à « — » n'est plus envoyé à 0 €");
  x = lire(fichierPerso("Ouvert", 1234.5, "À ouvrir", ""));
  ok(!x.err || x.err.code !== "cours", "B2 · fichier perso : PEA lisible, pas d'erreur de cours" + (x.err ? " (autre arrêt du faux classeur : " + x.err.message + ")" : ""));
  ok(!x.err && Math.abs(x.r.pct.pea.r - 0.2345) < 1e-4 && x.r.pct.pea.actif && !x.r.pct.av.actif, "V14 · fichier perso : son % du mois (+23,45 %) calculé par lui-même", x.err ? x.err.message : x.r.pct.pea);
}
/* ---------- V89 · relecture moi-code-donnees : objectifs, ancienne appli, saisie en %, corrections de Théo ---------- */
{
  const objectifs = () => feuille("Objectifs", [["Personne", "Objectif"], ["Théo", 1000000], ["Clément", 500000]]);
  const V = versus([data("Théo", [[202610, [0, 1000, 0, 0, "", "", "", ""]], [202611, vide()]]), data("Clément", [[202610, [0, 2000, 0, 0, "", "", "", ""]], [202611, vide()]]), objectifs()], {});
  V.props.CLE_ACCES = "admin-x"; V.props.CODES_PERSO = JSON.stringify({ "Clément": "CODE-C" });
  V.run("vsNoterJournal_ = function (pe, k, a, par, av, ap) { (this.JRN = this.JRN || []).push({ ligne: this.JRN.length + 2, t: new Date(), personne: pe, cle: k, action: a, par: par, avant: av.slice(), apres: ap.slice(), statut: '', pct: null }); }; vsLignesJournal_ = function () { return (this.JRN || []).slice(); }; vsFeuilleJournal_ = function () { return { getRange: () => ({ getValue: () => 'x', setValue: () => ({ setFontWeight() {} }) }), appendRow: l => { (this.JRN = this.JRN || []).push({ ligne: this.JRN.length + 2, t: new Date(), personne: l[1], cle: l[2], action: l[3], par: l[4], avant: [], apres: [], statut: '', pct: JSON.parse(l[8]) }); } }; };");
  V.ctx.SpreadsheetApp.flush = () => {};
  V.ctx.ContentService = { createTextOutput: t => ({ setMimeType() { return this; }, getContent: () => t }), MimeType: { JSON: "json" } };
  const envoi = c => JSON.parse(V.run("doPost")({ postData: { contents: JSON.stringify(c) } }).getContent());
  let r = envoi({ cle: "CODE-C", action: "objectif", personne: "Clément", objectif: 600000 });
  ok(!r.ok && /Objectifs|objectif/i.test(r.message) && V.actif.getSheetByName("Objectifs").d[2][1] === 500000, "V89 (a) · Clément envoie son objectif en euros : refusé, onglet Objectifs inchangé (rien n'est vidé)");
  ok(JSON.stringify(V.run("vsLireObjectifs_")(V.actif, "Europe/Paris").map(o => o.personne)) === '["Théo"]', "V89 (a) · seule la ligne de Théo est relue dans Objectifs");
  r = envoi({ cle: "CODE-C", action: "releve", personne: "Clément", mois: 202611, valeurs: [0, 2100, "", "", "", "", "", ""] });
  ok(!r.ok && /mets l'appli à jour/.test(r.message) && V.actif.getSheetByName("Data Clément").d[7].slice(1, 9).every(v => v === ""), "V89 (b) · ancienne appli : relevé en euros de Clément refusé « mets l'appli à jour », Data intact");
  const P = (r1) => ({ pea: { r: r1, actif: true, verse: 0, pv: null }, av: { r: null, actif: false, verse: 0, pv: null }, pf: { r: r1, actif: true, verse: 0, pv: null } });
  r = envoi({ cle: "CODE-C", action: "relevePct", personne: "Clément", mois: 202611, pct: P(0.03) });
  const lirePct = () => V.run("vsLirePct_")()["Clément"] || {};
  ok(r.ok && lirePct()[202611].source === "saisie" && lirePct()[202611].pct.pea.r === 0.03, "V89 (c) · saisie à la main en % : enregistrée (étiquette « saisie »), rien dans Data", r.message);
  r = envoi({ cle: "CODE-C", action: "relevePct", personne: "Clément", mois: 202611, pct: P(0.4) });
  ok(!r.ok && r.erreur === "avertissement", "V89 (c) · +40 % sur le mois : avertissement (« enregistrer quand même »)");
  r = envoi({ cle: "CODE-C", action: "importPct", personne: "Clément", mois: 202611, jour: "2026-11-30", pct: P(0.0312) });
  ok(r.ok && lirePct()[202611].source === "fichier" && lirePct()[202611].pct.pea.r === 0.0312, "V89 (c) · le fichier envoie son % jour par jour : il passe devant la saisie à la main", lirePct()[202611]);
  r = envoi({ cle: "CODE-C", action: "relevePct", personne: "Clément", mois: 202611, pct: P(0.05) });
  ok(r.ok && r.ignore && lirePct()[202611].pct.pea.r === 0.0312, "V89 (c) · une saisie à la main ne remplace plus le % du fichier", r.message);
  const jr = V.ctx.JRN.filter(x => x.personne === "Clément" && x.action === "Import auto").pop();
  r = envoi({ cle: "CODE-C", action: "annuler", ligne: jr.ligne });
  ok(r.ok && lirePct()[202611].source === "saisie" && lirePct()[202611].pct.pea.r === 0.03, "V89 (c) · annulation de l'import : retour à l'état d'avant AVEC son étiquette (« saisie »)", lirePct()[202611]);
  V.ctx.Date.now = () => new Date(2026, 11, 20).getTime();
  r = envoi({ cle: "CODE-C", action: "relevePct", personne: "Clément", mois: 202611, pct: P(0.02) });
  ok(!r.ok && r.erreur === "fige", "V89 (c) · plus de 7 jours après la première saisie : figé", r.message);
  V.ctx.Date.now = () => MAINTENANT.getTime();
  // (d) Théo : % de Moi posé par l'import, puis correction à la main en euros, puis annulation
  V.run("vsEcrirePct_")("Théo", 202611, "2026-11-30", P(0.011), "versus");
  r = envoi({ cle: "admin-x", action: "releve", personne: "Théo", mois: 202611, valeurs: [0, 1050, "", "", "", "", "", ""] });
  ok(r.ok && !(V.run("vsLirePct_")()["Théo"] || {})[202611] && V.actif.getSheetByName("Data Théo").d[7][2] === 1050, "V89 (d) · Théo corrige à la main : le % du mois devient celui de sa correction (plus celui de l'import)");
  const js = V.ctx.JRN.filter(x => x.personne === "Théo" && x.action === "Saisie").pop();
  V.run("vsFeuilleJournal_ = (f => () => { const o = f(); o.getRange = () => ({ getValue: () => 'x', setValue: () => ({ setFontWeight() {} }) }); return o; })(vsFeuilleJournal_)");
  r = envoi({ cle: "admin-x", action: "annuler", ligne: js.ligne });
  ok(r.ok && V.actif.getSheetByName("Data Théo").d[7].slice(1, 9).every(v => v === "" || v === null) && !(V.run("vsLirePct_")()["Théo"] || {})[202611], "V89 (d) · Théo annule sa saisie : le mois redevient VIDE (ni euros ni % d'import)", r.message);
}
/* ---------- V89 · premier millionnaire constaté sur un fichier lu par le Versus (qui n'envoie rien lui-même) ---------- */
{
  const fc = fichierPerso("Ouvert", 1100000, "À ouvrir", ""); fc.getSheetByName("Historique").d[1][1] = 1050000; fc.getSheetByName("Historique").d[1][5] = 1050000; fc.getSheetByName("Historique").d[1][6] = 1050000; fc.getSheetByName("Ordres").d[1][5] = 1050000;
  const V = versus([data("Théo", [[202611, vide()]]), data("Clément", [[202610, vide()], [202611, vide()]])], { F_THEO: fichierPerso("Ouvert", 1000, "À ouvrir", ""), F_CLEMENT: fc });
  V.run("vsImporterTous_")();
  const pm = V.props.PREMIER_MILLION ? JSON.parse(V.props.PREMIER_MILLION) : null;
  ok(pm && pm.nom === "Clément" && !/\d{4,}/.test(JSON.stringify(pm).replace(/\d{4}-\d\d-\d\d/, "")), "V89 · Clément (fichier lu, rien envoyé) : badge du premier million posé, aucun montant gardé", pm);
}
process.exit(ko.length ? 1 : 0);
