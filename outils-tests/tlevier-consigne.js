/* Test (25/11/2026) · signal levier : la règle ne change pas (creux gardé), mais la carte et l'e-mail DISENT tout (Théo).
   1. Serveur : le VRAI SignalLevier.js (app_scripts/portefeuille-epargne/theo) sur une série inventée qui finit par une chute large :
      règle identique à origin/main ; e-mail UNE fois par changement d'état (⚠️ exception creux, 💶 cash, 📈 retour, fin du creux),
      jamais deux fois ; au premier calcul de la nouvelle version, l'état « vente évitée » déjà en cours est envoyé une fois.
   2. Écran : Moi › Aujourd'hui › Levier, 390 px clair et sombre, 0 erreur JS : en creux, titre « ⚠️ Tendance : CASH · le creux dit GARDER »,
      pourquoi, option sécurité, fin de l'exception (jamais « Rien à faire ») ; hors marché « 💶 PASSE EN CASH » puis « 💶 RESTE EN CASH » ;
      « Comprendre » explique le creux avec le test sur l'historique ; investi et calme : « ✓ Rien à faire » comme avant.
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tlevier-consigne.js
   (PORT=… pour un autre port, APP_SCRIPTS=/chemin/vers/app_scripts, CAPTURES=dossier des captures) */
const fs = require("fs"), vm = require("vm"), path = require("path"), { execSync } = require("child_process");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts"), PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const FICHIER = path.join(RACINE, "portefeuille-epargne", "theo", "SignalLevier.js");
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
function charger(src) {
  const props = {}, mails = [];
  const G = { console: { log() {}, error() {} }, Date, Math, JSON, Number, String, Array, Object, isFinite, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, Utilities: { formatDate: () => "2026-11" },
    MailApp: { sendEmail: o => mails.push(o) }, Session: { getEffectiveUser: () => ({ getEmail: () => "test@exemple.invalid" }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error("pas de Sheet"); } } };
  vm.createContext(G); vm.runInContext(src + "\n;this.SL = SL;", G); G.props = props; G.mails = mails; return G;
}
const G = charger(fs.readFileSync(FICHIER, "utf8")), props = G.props, mails = G.mails;
/* série inventée : 12 ans de hausse calme, puis −15 % en une séance (vente évitée par le creux), −2 % en 2 séances, puis un petit rebond (5 séances) */
const dates = [], close = []; { let v = 1000, t = Date.UTC(2014, 0, 2), seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (t < Date.UTC(2026, 10, 26)) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) { dates.push(new Date(t).toISOString().slice(0, 10)); close.push(v); } t += 864e5; }
  for (let i = 1; i < close.length; i++) { const r = close.length - i; v *= r > 8 ? 1 + 0.0005 + 0.006 * (rnd() * 2 - 1) : r === 8 ? 0.85 : r > 5 ? 0.99 : 1.01; close[i] = v; } }
const mois = []; for (let y = 2010; y <= 2026; y++) for (let m = 1; m <= 12; m++) mois.push(y + "-" + String(m).padStart(2, "0") + "-01");
const sahm = { dates: mois, valeurs: mois.map(() => 0.1) }, prime = { dates: mois, valeurs: mois.map(() => 80) }, dff = { dates: ["2025-11-20"], valeurs: [3.9] };
const n = dates.length, serie = k => ({ ndx: { dates: dates.slice(0, k), close: close.slice(0, k) }, sahm, prime, dff, dffHisto: null, source: "test", provisoire: false });
const res = G.slCalculer({ dates, close }, sahm, prime, dff, G.SL);

/* ---------- 1. serveur ---------- */
ok(G.SL.CREUX === true && /CREUX/.test(res.etat.position) && res.evenements.some(e => e.type === "VENTE ÉVITÉE"), "règle avec creux : la chute donne une VENTE ÉVITÉE, position " + res.etat.position);
{ let ref = null; try { ref = execSync("git -C " + JSON.stringify(RACINE) + " show origin/main:portefeuille-epargne/theo/SignalLevier.js", { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { ref = null; }
  if (ref) { const A = charger(ref), pick = r => JSON.stringify([r.etat, r.jauges, r.evenements, r.arbitrage]);
    ok(pick(A.slCalculer({ dates, close }, sahm, prime, dff, A.SL)) === pick(res), "calculs de la règle identiques à origin/main (position, signaux, arbitrage)"); }
  else console.log("(comparaison avec origin/main sautée : dépôt introuvable)"); }
// a · déploiement : ancien e-mail « vente évitée, rien à faire » déjà parti (état mémorisé en creux) → le nouvel e-mail part UNE fois
props.SL_ETAT = "{}"; props.SL_DERNIERE = JSON.stringify({ date: dates[n - 1], expose: true, reduit: res.etat.reduit, override: true, position: res.etat.position });
G.slTelecharger_ = () => serie(n); G.slEtatPourApp();
ok(props.SL_REGLE === G.SL.REGLE && mails.length === 1 && /^⚠️ Signal de vente · exception creux : on garde/.test(mails[0].subject), "nouvelle version : l'état « vente évitée » en cours est envoyé une fois (" + (mails[0] || {}).subject + ")");
ok(mails[0] && /règle : garder ton/.test(mails[0].htmlBody) && /Si tu préfères la sécurité : vendre le LQQ ×2 et le Nasdaq-100 ×1/.test(mails[0].htmlBody) && /acheter de l'or/.test(mails[0].htmlBody) && /repasse au-dessus de sa moyenne des 45 semaines/.test(mails[0].htmlBody) && !/Rien à faire/.test(mails[0].htmlBody), "l'e-mail donne les deux options (garder / sécurité), quand l'exception s'arrête, jamais « Rien à faire »");
G.slEtatPourApp(); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 1, "jamais deux fois le même e-mail (lectures et calculs suivants)");
// b · le soir de la vente évitée (dernier e-mail : en position normale)
const iV = res.evenements.filter(e => e.type === "VENTE ÉVITÉE").pop(), kV = dates.indexOf(iV.date) + 1;
props.SL_DERNIERE = JSON.stringify({ date: dates[kV - 2], expose: true, reduit: false, override: false, position: "EN POSITION ×2" });
G.slTelecharger_ = () => serie(kV); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 2 && /^⚠️ Signal de vente · exception creux : on garde/.test(mails[1].subject) && /VENTE ÉVITÉE/.test(mails[1].htmlBody), "le soir même de la vente évitée : UN e-mail ⚠️ avec le signal (" + (mails[1] || {}).subject + ")");
// c · vrai passage en cash (règle sans exception pour fabriquer l'état) puis retour investi
G.SL.CREUX = false; props.SL_DERNIERE = JSON.stringify({ date: dates[n - 2], expose: true, reduit: false, override: false, position: "EN POSITION ×2" });
G.slTelecharger_ = () => serie(n); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 3 && /^💶 PASSE EN CASH/.test(mails[2].subject) && /vends tout ton levier Nasdaq/.test(mails[2].htmlBody), "passage en cash : UN e-mail 💶 PASSE EN CASH (" + (mails[2] || {}).subject + ")");
const CASH = G.slEtatPourApp(); G.SL.CREUX = true;
props.SL_DERNIERE = JSON.stringify({ date: dates[n - 30], expose: false, reduit: false, override: false, position: "HORS MARCHÉ" });
G.slTelecharger_ = () => serie(n - 20); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 4 && /^📈 RETOUR INVESTI/.test(mails[3].subject), "retour investi : UN e-mail 📈 (" + (mails[3] || {}).subject + ")");
// d · fin du creux
props.SL_DERNIERE = JSON.stringify({ date: dates[n - 30], expose: true, reduit: false, override: true, position: "EN CREUX" });
G.slExecuter_(true);
ok(mails.length === 5 && /^✅ FIN DU CREUX/.test(mails[4].subject), "fin du creux : UN e-mail ✅ (" + (mails[4] || {}).subject + ")");
fs.writeFileSync(path.join(CAP, "mail-creux.html"), mails[0] ? mails[0].htmlBody : "");
// états pour l'écran
res.majLe = "25/11/2026 23:15"; res.source = "test"; res.bilan = null; G.slEnregistrerEtat_(res);
const CREUX = G.slEtatPourApp();
ok(CREUX.creux === true && CREUX.creuxActif === true && CASH.expose === false && CASH.joursDepuis <= 14, "états pour l'appli : en creux (" + CREUX.position + "), et hors marché depuis " + CASH.joursDepuis + " j");
const VIEUX = Object.assign({}, CASH, { joursDepuis: 40, transition: false });
const INVESTI = Object.assign({}, CREUX, { expose: true, reduit: false, creux: false, position: "EN POSITION ×2", positionCTO: "QQQ3 ×3", apport: 2, distance: 8, typeSeuil: "sortie (bande −5 %)", zoneTendance: false, zoneVol: false, transition: false, provisoire: null });

/* ---------- 2. écran ---------- */
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
  const ferme = await p.evaluate(() => { const c = document.querySelector(".sig"); if (!c) return null; const t = c.querySelector(".sg-consigne");
    return { tete: c.querySelector(".sig-tete").innerText, texte: c.innerText, lignesTitre: t ? (() => { const r = document.createRange(); r.selectNodeContents(t); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; })() : 0,
      deb: [...c.querySelectorAll("*")].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length }; });
  if (capture && ferme) { await p.evaluate(() => { const c = document.querySelector(".sig"); window.scrollBy(0, c.getBoundingClientRect().top - 60); }); await p.waitForTimeout(300);
    await (await p.$(".sig")).screenshot({ path: path.join(CAP, capture + "-" + (sombre ? "sombre" : "clair") + ".png") }); }
  const ouvert = await p.evaluate(() => { const t = document.querySelector(".sig .sig-tete"); if (!t) return ""; t.click(); const d = document.querySelector(".sig .sig-detail"); d.querySelectorAll("details").forEach(x => x.open = true); return d.innerText; });
  const largeur = await p.evaluate(() => document.documentElement.scrollWidth);
  await ctx.close(); return { ferme, ouvert, largeur, err };
}
(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const r = await ecran(b, sombre, CREUX, "carte-creux"), t = r.ferme ? r.ferme.texte : "";
    ok(!r.err.length, "0 erreur JS, en creux" + tag + " " + JSON.stringify(r.err));
    ok(/⚠️ Tendance : CASH · le creux dit GARDER/.test(t) && r.ferme.lignesTitre === 1 && !/Rien à faire/.test(t), "en creux : titre « ⚠️ Tendance : CASH · le creux dit GARDER » sur une ligne, jamais « Rien à faire »" + tag);
    ok(/Pourquoi on garde.*sous sa moyenne des 45 semaines.*sans bulle ni signe de récession.*racheter plus cher/s.test(t) && /Si tu préfères la sécurité : vendre le LQQ et le Nasdaq-100 ×1 au PEA \(cash\), le QQQ3 et le ×1 au CTO → or/.test(t) && /Fin de l'exception : quand le Nasdaq repasse au-dessus de sa moyenne des 45 semaines/.test(t), "pourquoi on garde, option sécurité (PEA et CTO), fin de l'exception" + tag);
    ok(/Exception « creux »/.test(r.ouvert) && /environ \+4,5 points par an/.test(r.ouvert) && /20 des 24 passages en cash/.test(r.ouvert), "« Comprendre » explique le creux avec le test sur l'historique" + tag);
    ok(r.ferme.deb === 0 && r.largeur <= 390, "rien ne déborde à 390 px" + tag + " (" + r.ferme.deb + ", " + r.largeur + ")");
    if (!sombre) console.log("   carte : " + t.replace(/\s+/g, " ").slice(0, 600));
    const c = await ecran(b, sombre, CASH, "carte-cash"), tc = c.ferme ? c.ferme.texte : "";
    ok(!c.err.length && /💶 PASSE EN CASH/.test(tc) && !/Rien à faire/.test(tc) && /PEA : vends tout ton levier Nasdaq/.test(tc) && /CTO : vends le QQQ3 et le Nasdaq-100 ×1, achète de l'or/.test(tc) && c.ferme.deb === 0, "hors marché : « 💶 PASSE EN CASH », quoi vendre au PEA et au CTO, rien ne déborde" + tag);
  }
  const v = await ecran(b, false, VIEUX, false);
  ok(!v.err.length && /💶 RESTE EN CASH/.test(v.ferme.texte) && !/Rien à faire/.test(v.ferme.texte) && /encore environ \+\d+,\d/.test(v.ferme.texte), "cash depuis 40 j : « 💶 RESTE EN CASH » et ce qu'il manque pour racheter");
  const i = await ecran(b, false, INVESTI, false);
  ok(!i.err.length && /Rien à faire/.test(i.ferme.tete) && !/💶|⚠️/.test(i.ferme.texte), "investi et calme : « ✓ Rien à faire » comme avant");
  const ancien = Object.assign({}, CREUX); delete ancien.creuxActif;
  const a = await ecran(b, false, ancien, false);
  ok(!a.err.length && /⚠️ Tendance : CASH/.test(a.ferme.texte), "script pas encore redéployé (sans creuxActif) : même carte");
  await b.close(); console.log(ko.length ? ko.length + " NON" : "tout OUI"); process.exit(ko.length ? 1 : 0);
})();
