/* Test (préparé, 25/11) · Historique des ordres (Moi › + › Historique) : un ordre saisi dans l'appli avec une date ANCIENNE reste visible et supprimable.
   Bug de Théo (25/11) : un ordre de test daté du 01/06 n'apparaissait pas (le fichier n'envoyait que les 30 dernières lignes de l'onglet
   Ordres, et l'ordre est rangé à sa place chronologique, loin derrière) : impossible de le supprimer depuis l'appli.
   1. SERVEUR (vrai code de portefeuille-epargne/commun/API.js, faux Apps Script, faux onglet Ordres inventé) :
      journal = 30 dernières lignes + tous les ordres saisis dans l'appli encore supprimables ; « Voir plus anciens » par pages de 50 ;
      suppression de la ligne exacte (doublon parfait : c'est la ligne touchée qui part) ; ordre importé du fichier : refusé.
   2. APPLI (Playwright, serveur Google intercepté, fausses données) : l'ordre du 01/06 est là avec « Supprimer », la suppression envoie
      la ligne exacte ; « Voir plus anciens » ajoute les pages sans doublon, puis disparaît au début de l'onglet ; un ordre importé n'a pas
      « Supprimer » ; ancien serveur (sans « journalSuite ») : pas de bouton, rien ne casse ; 0 erreur JS, 390 px, clair et sombre.
   Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tjournal.js
   (PORT=…, APP_SCRIPTS=/chemin/vers/app_scripts si le dépôt n'est pas à côté de celui-ci) */
const fs = require("fs"), path = require("path"), vm = require("vm");
const PORT = process.env.PORT || 8771, RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };

/* ================= 1. SERVEUR ================= */
function serveur() {
  const API = fs.readFileSync(path.join(RACINE, "portefeuille-epargne", "commun", "API.js"), "utf8");
  const p2 = n => String(n).padStart(2, "0"), jour = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  /* onglet Ordres inventé : 80 ordres du 01/01 au 20/11 (rangés par date), dont un ordre de test saisi dans l'appli le 01/06,
     et un DOUBLON parfait (même jour, même montant) d'un ordre importé du fichier */
  const lignes = [];
  for (let k = 0; k < 80; k++) { const t = new Date(2026, 0, 1 + Math.floor(k * 4.0)); lignes.push([t, "PEA Test", "Achat", "DCAM", 10, 50 + k, ""]); }
  const test = [jour("2026-06-01"), "Linxea Spirit 2", "Achat", "FDE", 2, 123.45, ""];
  lignes.push(test, [jour("2026-03-03"), "PEA Test", "Apport", "", "", 777, ""], [jour("2026-03-03"), "PEA Test", "Apport", "", "", 777, ""]);
  lignes.sort((a, b) => a[0] - b[0]);
  const props = {}, fichier = { lignes, supprimees: [] };
  const feuille = {
    getLastRow: () => fichier.lignes.length + 1,
    getRange: (r, c, n, m) => ({ getValues: () => { const out = []; for (let i = 0; i < n; i++) out.push((fichier.lignes[r - 2 + i] || ["", "", "", "", "", "", ""]).slice(c - 1, c - 1 + m)); return out; } }),
    deleteRow: r => { fichier.supprimees.push(r); fichier.lignes.splice(r - 2, 1); }
  };
  const ss = {
    getSpreadsheetTimeZone: () => "Europe/Paris",
    getSheetByName: n => n === "Ordres" ? feuille : n === "Paramètres" ? { getDataRange: () => ({ getValues: () => [
      ["Enveloppe", "Régime fiscal", "Date d'ouverture", "Statut", "Périmètre", "Type d'ordre", "Signe trésorerie", "Signe quantité", "Flux externe", "Code", "Nom"],
      ["PEA Test", "PEA", "", "Ouvert", "Portefeuille", "Achat", -1, 1, 0, "DCAM", "Monde"],
      ["Linxea Spirit 2", "AV", "", "Ouvert", "Portefeuille", "Apport", 1, 0, 1, "FDE", "Fonds"]] }) }
      : { getDataRange: () => ({ getValues: () => [[""]] }) }
  };
  const ctx = vm.createContext({ console, JSON, Math, Date, Number, String, Set, Array, Object,
    SpreadsheetApp: { getActive: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { formatDate: (d, tz, f) => f === "dd/MM/yyyy" ? p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() : d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()),
      parseDate: s => jour(s) } });
  vm.runInContext(API, ctx, { filename: "API.js" });
  vm.runInContext("lireParcours_ = () => null; lireRaccourcis_ = () => []; noterSaisiePropre_ = () => {};", ctx);
  // l'ordre de test et UN des deux versements identiques ont été saisis dans l'appli il y a 2 jours (signatures mémorisées comme le fait memoriserSaisies_)
  props.saisies_app = JSON.stringify([{ s: "2026-06-01|Linxea Spirit 2|Achat|FDE|2|123.45|", t: Date.now() - 2 * 864e5 }, { s: "2026-03-03|PEA Test|Apport||" + "|777|", t: Date.now() - 2 * 864e5 }]);
  const ref = vm.runInContext("lireReferentiel_(SpreadsheetApp.getActive(), 'Europe/Paris', false)", ctx);
  const j = ref.journal, t = j.find(o => o.date === "2026-06-01");
  ok(j.filter(o => !o.app).length === 30, "Serveur · les 30 dernières lignes de l'onglet Ordres sont toujours envoyées", j.length);
  ok(t && t.app === true && t.type === "Achat" && t.montant === 123.45, "Serveur · l'ordre de test du 01/06 (saisi dans l'appli, loin des 30 dernières lignes) est AUSSI envoyé, marqué supprimable", t);
  ok(j.filter(o => o.date === "2026-03-03").length === 2 && j.every(o => o.date !== "2026-03-03" || o.app), "Serveur · doublon parfait d'un ordre saisi dans l'appli : les 2 lignes montrées (impossible de savoir laquelle vient de l'appli)");
  ok(typeof ref.journalSuite === "number" && ref.journalSuite > 2 && j.filter(o => !o.app).every(o => o.ligne >= ref.journalSuite), "Serveur · journalSuite = première ligne des 30 (« Voir plus anciens » repart de là)", ref.journalSuite);
  ok(j.every((o, i) => !i || j[i - 1].date >= o.date), "Serveur · journal trié du plus récent au plus ancien");
  // pages « Voir plus anciens »
  let suite = ref.journalSuite, vues = j.filter(o => !o.app).length, pages = 0, bonOrdre = true;
  while (suite > 0 && pages < 10) { const r = vm.runInContext("lireJournalAncien_(" + suite + ")", ctx); pages++; vues += r.journal.length;
    if (r.journal.some(o => o.ligne >= suite) || (r.suite && r.journal.length !== 50)) bonOrdre = false; suite = r.suite; }
  ok(bonOrdre && vues === fichier.lignes.length && pages === 2, "Serveur · « Voir plus anciens » : pages de 50, toujours plus anciennes, jusqu'au début de l'onglet (toutes les lignes vues une fois)", { vues, total: fichier.lignes.length, pages });
  ok(vm.runInContext("lireJournalAncien_(undefined)", ctx).journal.length === 0, "Serveur · « Voir plus anciens » sans repère : rien (pas tout l'onglet)");
  // suppressions
  const importe = j.find(o => !o.app);
  let refus = ""; try { vm.runInContext("supprimerOrdre_(" + JSON.stringify(importe) + ")", ctx); } catch (e) { refus = e.message; }
  ok(/Seuls les ordres saisis depuis l'application/.test(refus) && !fichier.supprimees.length, "Serveur · un ordre importé du fichier ne peut pas être supprimé depuis l'appli", refus);
  const v1 = j.filter(o => o.date === "2026-03-03").sort((a, b) => a.ligne - b.ligne)[0];   // la PREMIÈRE des 2 lignes identiques
  vm.runInContext("supprimerOrdre_(" + JSON.stringify(v1) + ")", ctx);
  ok(fichier.supprimees[0] === v1.ligne, "Serveur · doublon parfait : c'est la ligne touchée dans l'appli qui est supprimée (pas l'autre)", { touchee: v1.ligne, supprimee: fichier.supprimees[0] });
  const t2 = vm.runInContext("lireReferentiel_(SpreadsheetApp.getActive(), 'Europe/Paris', false)", ctx).journal.find(o => o.date === "2026-06-01");
  vm.runInContext("supprimerOrdre_(" + JSON.stringify(Object.assign({}, t2, { ligne: t2.ligne + 5 })) + ")", ctx);   // ligne qui a bougé : on retrouve l'ordre par sa signature
  ok(fichier.supprimees[1] === t2.ligne && !fichier.lignes.some(l => l[5] === 123.45), "Serveur · ligne qui a bougé entre-temps : l'ordre est retrouvé par son contenu (jamais une autre ligne)", fichier.supprimees);
  const avant = fichier.lignes.length;
  try { vm.runInContext("supprimerOrdre_(" + JSON.stringify(t2) + ")", ctx); } catch (e) { refus = e.message; }
  ok(fichier.lignes.length === avant, "Serveur · 2e suppression du même ordre : refusée, rien d'autre ne part");
}

/* ================= 2. APPLI ================= */
const ordre = (ligne, date, type, actif, q, m, app, env) => ({ ligne, date, enveloppe: env || "PEA Test", type, actif: actif || "", quantite: q === undefined ? null : q, montant: m, frais: null, app: !!app });
/* nouveau serveur : 30 dernières lignes + l'ordre de test du 01/06 ; ANCIEN serveur : 30 dernières lignes seulement (dont un ordre du 20/11 saisi dans l'appli) */
function journalFichier(sansTest, nouveau) {
  const j = [];
  for (let k = 0; k < 30; k++) { const d = new Date(Date.UTC(2026, 10, 20) - k * 2 * 864e5).toISOString().slice(0, 10); if (k || nouveau || !sansTest) j.push(ordre(120 - k, d, "Achat", "DCAM", 10, 500 + k, !k && !nouveau)); }
  if (!sansTest && nouveau) j.push(ordre(40, "2026-06-01", "Achat", "FDE", 2, 123.45, true, "Linxea Test"));
  return j;
}
const PAGES = { 91: { journal: [ordre(90, "2026-09-26", "Achat", "DCAM", 3, 333.33), ordre(40, "2026-06-01", "Achat", "FDE", 2, 123.45, true, "Linxea Test"), ordre(39, "2026-05-30", "Apport", "", undefined, 1000)], suite: 39 },
  39: { journal: [ordre(5, "2026-01-05", "Apport", "", undefined, 4321)], suite: 0 } };
function moi(nouveau, sansTest) {
  const ref = { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "Linxea Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }],
    actifs: [{ code: "DCAM", nom: "Monde" }, { code: "FDE", nom: "Fonds test" }], cours: { DCAM: 5.5, FDE: 60 },
    detenu: [{ env: "PEA Test", code: "DCAM", qte: 300, pru: 5 }, { env: "Linxea Test", code: "FDE", qte: 2, pru: 61.7 }], journal: journalFichier(sansTest, nouveau), raccourcis: [] };
  if (nouveau) ref.journalSuite = 91;
  return { ok: true, version: 14, genere: "2026-11-25T10:00:00", majTexte: "", versusLie: false, anomalies: "", rappel: "", marches: "",
    synthese: { valeur: 2000, apports: 1800, gain: 200, gainPct: 0.1 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 1700, gain: 0, gainPct: 0, twr: 0 }],
    groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
    parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null, ref };
}
const versus = { ok: true, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };

async function appli(b, theme, nouveau) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme }), p = await ctx.newPage(), err = [], envois = [];
  let supprime = false;
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => {
    const c = JSON.parse(r.request().postData() || "{}"), estMoi = /FAUXMOI/.test(r.request().url());
    if (estMoi && c.action && c.action !== "data") envois.push(c);
    let corps = estMoi ? moi(nouveau, supprime) : versus;
    if (estMoi && c.action === "journal") corps = nouveau ? Object.assign({ ok: true }, PAGES[c.avant] || { journal: [], suite: 0 }) : { ok: false, erreur: "format", message: "Action inconnue." };
    if (estMoi && c.action === "supprimer") { supprime = true; corps = { ok: true, message: "Ordre supprimé (ligne " + c.ordre.ligne + ")." }; }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(corps) });
  });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => Moi.saisir()); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));
  await p.click('[data-m-pane="journal"]'); await p.waitForTimeout(300);
  const lignes = () => p.evaluate(() => [...document.querySelectorAll("#m-pane-journal .jr")].map(x => ({ t: x.innerText.replace(/\s+/g, " "), suppr: !!x.querySelector("[data-suppr]") })));
  const quoi = (nouveau ? "nouveau serveur" : "ANCIEN serveur") + " · " + theme;
  let L = await lignes();
  const cible = nouveau ? /123,45/ : /500,00/;   // l'ordre saisi dans l'appli : celui du 01/06 (nouveau serveur) ou celui du 20/11 (ancien)
  const test = L.find(x => cible.test(x.t));
  ok(test && test.suppr && /saisi ici/i.test(test.t) && (!nouveau || /01\/06/.test(test.t)), quoi + " · " + (nouveau ? "l'ordre de test du 01/06 est dans l'Historique" : "l'ordre récent saisi ici est dans l'Historique") + ", avec « Supprimer »", test);
  ok(L.filter(x => !cible.test(x.t)).every(x => !x.suppr), quoi + " · les ordres importés du fichier n'ont pas « Supprimer »");
  if (!nouveau) ok(L.length === 30 && !L.some(x => /01\/06/.test(x.t)), quoi + " · comme avant : les 30 dernières lignes, rien de cassé (l'ordre du 01/06 attend la mise à jour du fichier)", L.length);
  ok(!!(await p.$("#j-plus")) === nouveau, quoi + " · « Voir plus anciens » " + (nouveau ? "proposé" : "absent (le fichier ne sait pas encore le faire)"));
  if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + "/journal-" + (nouveau ? "" : "ancien-") + theme + ".png", fullPage: true });
  if (nouveau) {
    await p.click("#j-plus"); await p.waitForTimeout(400);
    L = await lignes();
    ok(L.some(x => /26\/09/.test(x.t) && /333,33/.test(x.t) && !x.suppr) && L.filter(x => /123,45/.test(x.t)).length === 1 && L.length === 33,
      quoi + " · 1re page plus ancienne : le 26/09 apparaît (sans « Supprimer »), l'ordre du 01/06 n'est pas en double", L.length);
    ok(await p.evaluate(() => { const d = [...document.querySelectorAll("#m-pane-journal .jr .jd")].map(x => x.innerText.replace(/\s+/g, "")); const iso = d.map(s => s.slice(5) + s.slice(3, 5) + s.slice(0, 2)); return iso.every((x, i) => !i || iso[i - 1] >= x); }),
      quoi + " · tout reste trié du plus récent au plus ancien");
    ok(!!(await p.$("#j-plus")), quoi + " · il reste plus ancien : le bouton reste");
    await p.click("#j-plus"); await p.waitForTimeout(400);
    L = await lignes();
    ok(L.some(x => /05\/01/.test(x.t) && /4\s?321/.test(x.t)) && !(await p.$("#j-plus")), quoi + " · 2e page : jusqu'au 05/01, puis plus de bouton (début de l'onglet)");
    ok(envois.filter(c => c.action === "journal").map(c => c.avant).join() === "91,39", quoi + " · le fichier est interrogé à partir de la bonne ligne", envois.map(c => c.avant));
  }
  const larg = await p.evaluate(() => document.documentElement.scrollWidth); ok(larg <= 390, quoi + " · lisible à 390 px", larg);
  // suppression de l'ordre du 01/06
  await p.click("[data-suppr]"); await p.waitForTimeout(150);
  ok(/Confirmer la suppression/.test(await p.evaluate(() => document.querySelector("#m-pane-journal").innerText)), quoi + " · « Supprimer » demande une confirmation");
  await p.click("[data-suppr]"); await p.waitForTimeout(1200);
  const s = envois.filter(c => c.action === "supprimer");
  const attendu = nouveau ? { ligne: 40, date: "2026-06-01", montant: 123.45 } : { ligne: 120, date: "2026-11-20", montant: 500 };
  ok(s.length === 1 && Object.keys(attendu).every(k => s[0].ordre[k] === attendu[k]), quoi + " · un seul envoi « supprimer », avec la ligne exacte (" + attendu.ligne + ") et le bon ordre", s.map(c => c.ordre));
  L = await lignes();
  ok(!L.some(x => cible.test(x.t)) && L.length >= 29, quoi + " · l'ordre a disparu de l'Historique, le reste est là", L.length);
  ok(!err.length, quoi + " · 0 erreur JS", err.slice(0, 3));
  await ctx.close();
}

(async () => {
  try { serveur(); } catch (e) { ok(false, "Serveur · test lancé (" + e.message + ")"); }
  const { chromium } = require("playwright");
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) await appli(b, theme, true);
  await appli(b, "light", false);
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
