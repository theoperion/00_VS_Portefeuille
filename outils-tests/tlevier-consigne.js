/* Test (26/11/2026, Théo : « la carte et les mails se contredisent ») · signal levier, règle simplifiée par Théo le 26/11 : PLUS D'EXCEPTION
   CREUX (SL.CREUX = false) : plus de 5 % sous la ligne de tendance (45 semaines) = cash (or au CTO), rachat au-dessus ; agitation > 30 % = ×1,
   retour au levier sous 25 %. Carte, e-mails et onglet disent la même chose (une seule phrase, fabriquée par le script), 3 lignes en haut.
   1. Serveur : le VRAI SignalLevier.js (app_scripts/portefeuille-epargne/theo) sur une série inventée (hausse calme, agitation, puis chute large) :
      calculs identiques à origin/main réglé sans creux ; un e-mail UNE fois par changement d'état ; zones d'alerte : un e-mail par épisode.
   2. Écran : Moi › Aujourd'hui › Levier, 390 px clair et sombre, 0 erreur JS, dans chaque état : titre, ordres, pastille PEA, rien qui contredit.
   Aucune vraie donnée : serveurs Google interceptés. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tlevier-consigne.js
   (PORT=… pour un autre port, APP_SCRIPTS=/chemin/vers/app_scripts, CAPTURES=dossier des captures ; ETATS=dossier de <nom>.json : états
   pour l'écran à la place des états inventés, par exemple ceux calculés sur l'historique réel du Nasdaq) */
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
/* série inventée : 12 ans de hausse calme, puis 10 séances très agitées (alarme ×1), −15 % en une séance (vente : cash), −2 %, petit rebond */
const dates = [], close = []; { let v = 1000, t = Date.UTC(2014, 0, 2), seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (t < Date.UTC(2026, 10, 26)) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) { dates.push(new Date(t).toISOString().slice(0, 10)); close.push(v); } t += 864e5; }
  for (let i = 1; i < close.length; i++) { const r = close.length - i; v *= r > 18 ? 1 + 0.0005 + 0.006 * (rnd() * 2 - 1) : r > 8 ? (r % 2 ? 1.032 : 0.97) : r === 8 ? 0.85 : r > 5 ? 0.99 : 1.01; close[i] = v; } }
const mois = []; for (let y = 2010; y <= 2026; y++) for (let m = 1; m <= 12; m++) mois.push(y + "-" + String(m).padStart(2, "0") + "-01");
const sahm = { dates: mois, valeurs: mois.map(() => 0.1) }, prime = { dates: mois, valeurs: mois.map(() => 80) }, dff = { dates: ["2025-11-20"], valeurs: [3.9] };
const n = dates.length, serie = k => ({ ndx: { dates: dates.slice(0, k), close: close.slice(0, k) }, sahm, prime, dff, dffHisto: null, source: "test", provisoire: false });
const res = G.slCalculer({ dates, close }, sahm, prime, dff, G.SL);
const sansBalises = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
/* une phrase ne contredit jamais la position : alarme allumée → aucun « garde / vends / vendre ton LQQ » ; en cash → aucun « garde ton LQQ / ×1 » */
const contredit = (t, etat) => (t = String(t).replace(/vendre le (LQQ|QQQ3), acheter le Nasdaq-100 ×1|vends ton (LQQ ×2|QQQ3 ×3), achète le Nasdaq-100 ×1|Passe en ×1 · vends le LQQ/g, ""), etat.reduit) ? /(gard|vend)\w* (ton|le) (LQQ|QQQ3)(?! ni)/i.test(t) && !/achète le LQQ|rachète le LQQ|remet le levier/.test(t) ? "LQQ alors que l'alarme est allumée" : ""
  : !etat.expose ? (/garde ton (LQQ|Nasdaq|QQQ3)/i.test(t) ? "garder alors que la règle est en cash" : "") : "";

/* ---------- 1. serveur ---------- */
ok(G.SL.CREUX === false && res.etat.position === "HORS MARCHÉ" && res.evenements.some(e => e.type === "VENTE") && !res.evenements.some(e => /CREUX|ÉVITÉE|RELAIS|REFUS/.test(e.type)), "règle sans exception creux (Théo, 26/11) : agitation puis chute = VENTE, position " + res.etat.position);
{ let ref = null; try { ref = execSync("git -C " + JSON.stringify(RACINE) + " show origin/main:portefeuille-epargne/theo/SignalLevier.js", { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { ref = null; }
  if (ref) { const A = charger(ref), pick = r => JSON.stringify([r.etat, r.jauges, r.evenements, r.arbitrage, r.series]); A.SL.CREUX = false; A.SL.ARBITRAGE = false;   // Théo 26/11 : plus d'exception creux, plus de calcul d'espérance
    ok(pick(A.slCalculer({ dates, close }, sahm, prime, dff, A.SL)) === pick(res), "calculs identiques à origin/main réglé sans creux ni calcul d'espérance (position, signaux, jour par jour)"); }
  else console.log("(comparaison avec origin/main sautée : dépôt introuvable)"); }
// a · mise en ligne : l'état prévenu était « en creux ×1 » → UN e-mail « Passe en cash » avec les ordres exacts
const iV = res.evenements.filter(e => e.type === "VENTE").pop();
props.SL_ETAT = "{}"; props.SL_DERNIERE = JSON.stringify({ date: dates[n - 1], expose: true, reduit: true, override: true, position: "EN CREUX ×1" });
G.slTelecharger_ = () => serie(n); G.slEtatPourApp();
const m0 = mails[0] || {}, t0 = sansBalises(m0.htmlBody);
ok(props.SL_REGLE === G.SL.REGLE && mails.length === 1 && /^💶 Passe en cash · vends ton Nasdaq-100 ×1/.test(m0.subject), "nouvelle règle : UN e-mail « Passe en cash » (" + m0.subject + ")");
ok(/Versement du mois comme tes positions : PEA → cash · CTO → or/.test(t0) && /PEA : vends ton Nasdaq-100 ×1 et garde l'argent en cash/.test(t0) && /CTO : vends ton Nasdaq-100 ×1, achète de l'or/.test(t0) && !contredit(t0, { reduit: true, expose: false }), "ordres exacts : vends ton Nasdaq-100 ×1 au PEA (cash) et au CTO (or)");
ok(new RegExp("si ce n'est pas déjà fait depuis le " + iV.date.slice(8, 10) + "/" + iV.date.slice(5, 7)).test(t0) && new RegExp("Le " + iV.date.slice(8, 10) + "/" + iV.date.slice(5, 7) + ", le Nasdaq a clôturé plus de 5 % sous sa ligne de tendance").test(t0), "après le jour J : daté, « si ce n'est pas déjà fait depuis le … »");
ok(/JUSQU'À QUAND Rachat quand il repassera au-dessus de sa ligne de tendance : il doit remonter de \+\d+,\d % \(/.test(t0) && !/creux|150 séances/i.test(t0) && !/SMA|EMA/.test(t0), "jusqu'à quand : un seul chiffre d'écart ; plus aucun mot sur le creux, ni « SMA / EMA »");
G.slEtatPourApp(); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 1, "jamais deux fois le même e-mail (lectures et calculs suivants)");
// b · le soir même de la vente (dernier e-mail : en ×1)
const kV = dates.indexOf(iV.date) + 1;
props.SL_DERNIERE = JSON.stringify({ date: dates[kV - 2], expose: true, reduit: true, override: false, position: "EN POSITION ×1" });
G.slTelecharger_ = () => serie(kV); G.slExecuter_(true); G.slExecuter_(true);
const t1 = sansBalises((mails[1] || {}).htmlBody);
ok(mails.length === 2 && /^💶 Passe en cash · vends ton Nasdaq-100 ×1/.test(mails[1].subject) && /À faire à la prochaine ouverture de la bourse PEA/.test(t1) && !/déjà fait/.test(t1), "le soir de la vente : UN e-mail 💶 sans « déjà fait » (" + (mails[1] || {}).subject + ")");
const CASH = G.slEtatPourApp();
ok(CASH.quitte && CASH.quitte.pea === "Nasdaq-100 ×1" && CASH.quitte.cto === "Nasdaq-100 ×1" && CASH.message && /vends ton Nasdaq-100 ×1/.test(CASH.message.pea) && CASH.creuxActif === false, "état pour l'appli : ce que la règle détenait avant, et LA phrase du jour (" + JSON.stringify(CASH.message && CASH.message.pea) + ")");
// c · retour investi, passage en ×1, retour au levier
props.SL_DERNIERE = JSON.stringify({ date: dates[n - 40], expose: false, reduit: false, override: false, position: "HORS MARCHÉ" });
G.slTelecharger_ = () => serie(n - 30); G.slExecuter_(true); G.slExecuter_(true);
ok(mails.length === 3 && /^📈 Retour investi · achète le LQQ ×2/.test(mails[2].subject) && /avec le cash du PEA, achète le LQQ ×2/.test(mails[2].htmlBody) && /vends l'or, achète le QQQ3 ×3/.test(mails[2].htmlBody), "retour investi : UN e-mail 📈 avec les deux ordres (" + (mails[2] || {}).subject + ")");
props.SL_DERNIERE = JSON.stringify({ date: dates[n - 40], expose: true, reduit: true, override: false, position: "EN POSITION ×1" }); G.slExecuter_(true);
ok(mails.length === 4 && /^🔺 Retour au levier · rachète le LQQ/.test(mails[3].subject) && /vends ton Nasdaq-100 ×1, achète le LQQ ×2/.test(mails[3].htmlBody), "retour au levier : UN e-mail 🔺 (" + (mails[3] || {}).subject + ")");
props.SL_DERNIERE = JSON.stringify({ date: dates[n - 40], expose: true, reduit: false, override: false, position: "EN POSITION ×2" });
G.slTelecharger_ = () => serie(kV - 1); G.slExecuter_(true);
ok(mails.length === 5 && /^🔻 Passe en ×1 · vends le LQQ/.test(mails[4].subject) && /vends ton LQQ ×2, achète le Nasdaq-100 ×1/.test(mails[4].htmlBody), "passage en ×1 : UN e-mail 🔻 (" + (mails[4] || {}).subject + ")");
// d · zone d'alerte : au plus un e-mail par épisode (réarmé seulement en sortant nettement de la zone)
{ const e0 = mails.length; const etat = { date: "2026-01-01", expose: true, reduit: false, override: false, position: "EN POSITION ×2", zoneTendance: false, zoneVol: false };
  const res2 = G.slCalculer({ dates: dates.slice(0, n - 40), close: close.slice(0, n - 40) }, sahm, prime, dff, G.SL); res2.majLe = "x"; res2.source = "test";
  const jour = (d, dist) => { res2.etat = Object.assign({}, res2.etat, { date: d, expose: true, reduit: false, override: false, distance: dist, zoneTendance: dist >= 0 && dist <= 2, zoneVol: false }); res2.evenements = []; G.slNotifier_(res2); };
  props.SL_DERNIERE = JSON.stringify(etat);
  jour("2026-01-02", 1.5); jour("2026-01-05", 2.5); jour("2026-01-06", 1.8); jour("2026-01-07", 4.2); jour("2026-01-08", 1.9);
  ok(mails.length - e0 === 2, "zone d'alerte : 2 e-mails pour 2 épisodes (pas pour un simple aller-retour à 2,5 %), " + (mails.length - e0) + " envoyés"); }
const tout = mails.map(m => sansBalises(m.htmlBody) + " " + m.subject).join(" ");
ok(!/creux|Tendance : CASH|LQQ ×2 et le Nasdaq-100 ×1|LQQ et le Nasdaq-100 ×1|sécurité/i.test(tout) && !/SMA|EMA/.test(tout), "plus aucun mot sur le creux, ancienne formule ni « SMA / EMA » dans les e-mails");
fs.writeFileSync(path.join(CAP, "mail-cash.html"), m0.htmlBody || "");
// états pour l'écran
const base = Object.assign({}, CASH, { provisoire: null, zoneTendance: false, zoneVol: false, transition: false, ordre: "Aucun", ordreCTO: "Aucun", quitte: null, message: null });
const ETATS_INVENTES = {
  "cash-recent": CASH,
  "cash-ancien": Object.assign({}, CASH, { joursDepuis: 40, transition: false }),
  "investi-x2": Object.assign({}, base, { expose: true, reduit: false, position: "EN POSITION ×2", positionCTO: "QQQ3 ×3", apport: 2, distance: 8, vol20: 18 }),
  "investi-x1": Object.assign({}, base, { expose: true, reduit: true, position: "EN POSITION ×1", positionCTO: "NASDAQ-100 ×1", apport: 1, distance: 3, vol20: 33 }),
  "retour-investi": Object.assign({}, base, { expose: true, reduit: false, position: "EN POSITION ×2", positionCTO: "QQQ3 ×3", transition: true, ordre: "ACHAT à l'ouverture : acheter le LQQ", ordreCTO: "ACHAT à l'ouverture : vendre l'or, acheter le QQQ3", apport: 2, distance: 6, vol20: 20,
    message: { titre: "📈 Retour investi · achète le LQQ ×2", pea: "avec le cash du PEA, achète le LQQ ×2.", cto: "vends l'or, achète le QQQ3 ×3.", ordre: true } })
};
const ETATS = process.env.ETATS ? Object.fromEntries(fs.readdirSync(process.env.ETATS).filter(f => /\.json$/.test(f)).map(f => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(process.env.ETATS, f), "utf8"))])) : ETATS_INVENTES;

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
  await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(signal) : versus) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
  const ferme = await p.evaluate(() => { const c = document.querySelector(".sig"); if (!c) return null; const t = c.querySelector(".sg-consigne");
    c.querySelectorAll(".sg-pl").forEach(x => { const h = x.querySelector(".sg-ph"); if (h) h.hidden = false; });   // les phrases « Ta position » font partie de ce qu'on lit
    return { tete: c.querySelector(".sig-tete").innerText, badge: (c.querySelector(".sig-plie .sg-badge") || {}).innerText || "", texte: c.innerText, titre: t ? t.innerText : "", pea: (c.querySelector(".sg-pl .sig-pos") || {}).innerText || "",
      deb: [...c.querySelectorAll("*")].filter(x => x.getBoundingClientRect().right > innerWidth + 1).length }; });
  if (capture && ferme) await p.evaluate(() => { const c = document.querySelector(".sig");   // capture : en-tête et barre du bas fixes masqués (ils recouvraient la carte)
    [...document.querySelectorAll("body *")].forEach(x => { if (!c.contains(x) && !x.contains(c) && /fixed|sticky/.test(getComputedStyle(x).position)) x.style.visibility = "hidden"; }); });
  if (capture && ferme) { await p.evaluate(() => { const c = document.querySelector(".sig"); window.scrollBy(0, c.getBoundingClientRect().top - 60); }); await p.waitForTimeout(300);
    await (await p.$(".sig")).screenshot({ path: path.join(CAP, capture + "-" + (sombre ? "sombre" : "clair") + ".png") }); }
  const ouvert = await p.evaluate(() => { const t = document.querySelector(".sig .sig-tete"); if (!t) return ""; t.click(); const d = document.querySelector(".sig .sig-detail"); d.querySelectorAll("details").forEach(x => x.open = true); return d.innerText; });
  if (capture && ferme && process.env.OUVERT) { await p.waitForTimeout(300); await (await p.$(".sig")).screenshot({ path: path.join(CAP, capture + "-comprendre-" + (sombre ? "sombre" : "clair") + ".png") }); }
  const largeur = await p.evaluate(() => document.documentElement.scrollWidth);
  await ctx.close(); return { ferme, ouvert, largeur, err };
}
(async () => {
  const { chromium } = require("playwright"), b = await chromium.launch();
  for (const [nom, etat] of Object.entries(ETATS)) for (const sombre of [false, true]) {
    const tag = " · " + nom + (sombre ? " (sombre)" : " (clair)");
    const r = await ecran(b, sombre, etat, "carte-" + nom), t = r.ferme ? r.ferme.texte : "", D = !etat.expose ? "cash" : etat.reduit ? "Nasdaq-100 ×1" : "LQQ ×2";
    ok(!r.err.length && r.ferme, "0 erreur JS" + tag + " " + JSON.stringify(r.err));
    if (!r.ferme) continue;
    ok(r.ferme.badge === (!etat.expose ? "💶 Cash" : etat.reduit ? "×1" : "×2 / ×3"), "badge d'état dans l'en-tête (" + r.ferme.badge + ")" + tag);
    ok(r.ferme.pea === D, "pastille PEA = ce que la règle fait détenir (" + r.ferme.pea + ")" + tag);
    ok(!contredit(t, etat), "aucune phrase ne contredit la position" + tag + " " + contredit(t, etat));
    ok(!/creux|Tendance : CASH|LQQ et le Nasdaq-100 ×1|LQQ ×2 et Nasdaq-100 ×1|sécurité|exempt/i.test(t + r.ouvert.replace(/sécurités?/g, "")) && !/SMA|EMA 45/.test(t + r.ouvert), "plus un mot sur le creux, ni ancienne formule ni « SMA / EMA » (carte et Comprendre)" + tag);
    if (etat.expose && etat.creux && etat.reduit && !etat.transition && etat.creuxDepuis !== etat.depuis) ok(/Vends ton Nasdaq-100 ×1/.test(t) && /Signal de vente/.test(r.ferme.titre), "vente évitée en ×1 : « Vends ton Nasdaq-100 ×1 » (" + r.ferme.titre + ")" + tag);
    if (!etat.expose) ok(/💶/.test(r.ferme.titre) && /Pourquoi/.test(t) && /Jusqu'à quand/.test(t) && !/Rien à faire ·/.test(r.ferme.tete) && (!etat.quitte || etat.joursDepuis > 14 || new RegExp("vends ton " + etat.quitte.pea).test(t)), "hors marché : 💶, ce qu'il faut vendre, pourquoi, jusqu'à quand" + tag);
    if (etat.positionCTO) ok(new RegExp("^CTO").test(t.split("\n").find(l => /^CTO/.test(l)) || "") && (etat.expose || /\bOR\b/.test(t)), "la ligne CTO est toujours là" + (etat.expose ? "" : ", « OR » hors marché") + tag);
    if (!etat.expose) ok(/18,2/.test(r.ouvert) && /cash sur le PEA \(le PEA n'accepte pas l'or\), or sur le CTO/.test(r.ouvert) && /22,7/.test(r.ouvert) && /20 des 24/.test(r.ouvert), "« Comprendre » : résultat du test sur l'historique, nouvelle et ancienne règle" + tag);
    if (etat.expose && !etat.creux && !etat.transition) ok(/Rien à faire/.test(r.ferme.tete), "investi sans ordre : « ✓ Rien à faire » comme avant" + tag);
    ok(new RegExp("Versement.*comme tes positions : PEA → ", "i").source && new RegExp("Versement.*comme tes positions : PEA → " + D + (etat.positionCTO ? " · CTO → " + (!etat.expose ? "or" : etat.reduit ? "Nasdaq-100 ×1" : "QQQ3 ×3") : ""), "i").test(t.replace(/\n/g, " ")) && !/espérance|μ |σ /.test(t + r.ouvert), "versement du mois : comme tes positions, plus de calcul d'espérance" + tag);
    ok(r.ferme.deb === 0 && r.largeur <= 390, "rien ne déborde à 390 px" + tag + " (" + r.ferme.deb + ", " + r.largeur + ")");
    if (!sombre && process.env.TEXTE) fs.writeFileSync(path.join(CAP, "carte-" + nom + ".txt"), t + "\n\n=== Comprendre ===\n" + r.ouvert);
  }
  if (!process.env.ETATS) { const ancien = Object.assign({}, CASH); delete ancien.message; delete ancien.quitte;
    const a = await ecran(b, false, ancien, false);
    ok(!a.err.length && /💶/.test(a.ferme.titre), "script pas encore redéployé (sans message ni quitte) : même carte"); }
  /* replier / déplier le texte en touchant l'en-tête : mémorisé sur l'appareil, redéplié d'office quand la position change */
  { const [nom, etat] = Object.entries(ETATS).find(([k, x]) => !x.expose) || [];
    if (etat) for (const sombre of [false, true]) {
      const tag = " · " + nom + (sombre ? " (sombre)" : " (clair)");
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
      p.on("pageerror", e => err.push(e.message)); let sig = etat;
      await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
      await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(sig) : versus) }));
      await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
      const charge = async () => { await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000); await p.evaluate(() => { document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()); const c = document.querySelector(".sig");
        [...document.querySelectorAll("body *")].forEach(x => { if (c && !c.contains(x) && !x.contains(c) && /fixed|sticky/.test(getComputedStyle(x).position)) x.style.visibility = "hidden"; }); }); };
      const vu = () => p.evaluate(() => { const t = document.querySelector(".sig .sg-texte"); return { cache: t ? t.hidden : null, chev: (document.querySelector(".sig .chev-t") || {}).textContent, deb: document.documentElement.scrollWidth }; });
      const capt = async n => { if (!process.env.ETATS) return; await p.evaluate(() => { const c = document.querySelector(".sig"); window.scrollBy(0, c.getBoundingClientRect().top - 60); }); await p.waitForTimeout(250); await (await p.$(".sig")).screenshot({ path: path.join(CAP, "carte-" + nom + "-" + n + "-" + (sombre ? "sombre" : "clair") + ".png") }); };
      await charge(); const v0 = await vu(); await capt("depliee");
      await p.click(".sig .sig-plie"); const v1 = await vu(); await capt("repliee");
      await charge(); const v2 = await vu();
      sig = Object.assign({}, etat, { expose: true, reduit: false, depuis: "2026-11-26", transition: true, joursDepuis: 0, positionCTO: "QQQ3 ×3", message: { titre: "📈 Retour investi · achète le LQQ ×2", pea: "avec le cash du PEA, achète le LQQ ×2.", cto: "vends l'or, achète le QQQ3 ×3.", ordre: true }, quitte: null });
      await charge(); const v3 = await vu();
      ok(!err.length && v0.cache === false && v0.chev === "▾" && v1.cache === true && v1.chev === "▸" && v1.deb <= 390, "toucher l'en-tête replie le texte (▾ → ▸), rien ne déborde, 0 erreur JS" + tag);
      ok(v2.cache === true, "replié : choix gardé après rechargement" + tag);
      ok(v3.cache === false, "nouvelle position (nouvel ordre) : redéplié d'office" + tag);
      await ctx.close(); } }
  await b.close(); console.log(ko.length ? ko.length + " NON" : "tout OUI"); process.exit(ko.length ? 1 : 0);
})();
