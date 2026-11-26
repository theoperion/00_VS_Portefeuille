/* Test · décision de Théo (26/11/2026) : la CARTE BONUS du rattrapage se joue EN PLUS de la carte du mois (avant : à sa place).
   Règles gardées : piochée quand on finit dernier d'un mois, jouable dès le mois suivant, une fois par saison chacune, +4 au plus par carte,
   une seule carte bonus par mois (une bonus + la carte du mois), une carte de base ne se rejoue pas deux mois de suite.
   1. Points (saison 2027 inventée, 4 pilotes) : Théo dernier en janvier → pioche 🚨 Safety car ; en février il pose 🌧️ Pneus pluie + 🚨 Safety car :
      les deux comptent (chacune son gain, plafonnée à +4) ; rejouée en mars → sans effet (une fois par saison) ; une bonus jamais piochée → sans effet ;
      ancien format (la bonus rangée à la place de la carte du mois) → compte comme la carte bonus. Le serveur (PodiumCommun.js) donne les mêmes points.
   2. Serveur (versus/API.js, vsPoserCarte_ dans un bac à sable, Google simulé) : carte du mois et carte bonus rangées côte à côte (c et b),
      une seule bonus par mois, une bonus déjà jouée refusée, l'ancienne appli (sans « emplacement ») range quand même la bonus à part, vue publique masquée.
   3. Stand (fenêtre d'avril, Théo a 2 cartes bonus) : poser la carte du mois PUIS la carte bonus, textes « en plus », la 2e bonus grisée, reprendre la bonus seule.
   4. Révélation du 2 : la carte bonus s'annonce sous le nom ; détail des points et règles.
   Fausses données seulement ; https://script.google.com/** intercepté. Lancer depuis la racine du dépôt, serveur local ouvert :
   python3 -m http.server 8771 &  puis  node outils-tests/tbonus-en-plus.js   (PORT=… ; APP_SCRIPTS=… dossier du dépôt serveur) */
const { chromium } = require("playwright"), fs = require("fs"), vm = require("vm"), path = require("path");
const PORT = process.env.PORT || 8771, AS = process.env.APP_SCRIPTS || "/home/user/app_scripts", CAPT = process.env.CAPTURES || "";   // CAPTURES=dossier : captures du Stand et de la révélation (clair et sombre)
async function capture(p, nom) { if (!CAPT) return; for (const sc of ["light", "dark"]) { await p.emulateMedia({ colorScheme: sc }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(CAPT, nom + "-" + sc + ".png"), fullPage: false }); } await p.emulateMedia({ colorScheme: "light" }); }
const NOMS = ["Théo", "Kévin", "Devlin", "Clément"];
const IDX = ["S&P 500", "Nasdaq-100", "Or (non couvert)", "MSCI Monde", "Euro Stoxx 50", "Marchés émergents", "Semi-conducteurs"];
// S&P 500 du mois et rendements : Théo dernier en janvier (et en mars), premier en février (en baisse : les Pneus pluie marchent)
const SP = { 202701: 0, 202702: -0.02, 202703: 0 };
const R = {
  A: { 202701: { Théo: -0.03, Kévin: 0.03, Devlin: 0.02, Clément: 0.01 }, 202702: { Théo: -0.01, Kévin: -0.03, Devlin: -0.04, Clément: -0.05 }, 202703: { Théo: -0.03, Kévin: 0.03, Devlin: 0.02, Clément: 0.01 } },
  B: { 202701: { Théo: -0.03, Kévin: 0.03, Devlin: 0.02, Clément: 0.01 }, 202702: { Théo: -0.03, Kévin: 0.03, Devlin: 0.02, Clément: 0.01 } }   // Théo dernier deux fois : 2 cartes bonus
};
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
function donnees(jeu, cartes, nom) {
  const ks = [202610, 202611, 202612].concat(Object.keys(R[jeu]).map(Number));
  const personnes = NOMS.map((n, i) => { let val = 1000 + 100 * i; return { nom: n, rows: ks.map(k => { const r = k < 202701 ? 0.01 : R[jeu][k][n]; val = Math.round(val * (1 + r)); return ligne(k, val, r); }) }; });
  return { ok: true, version: 96, genere: "2027-04-10T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: IDX, mois: ks.map(k => [k].concat(IDX.map((x, j) => j === 0 && SP[k] !== undefined ? SP[k] : 0.10))), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: { 2027: cartes || {} }, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: nom || "Théo" }, monRappel: null, rappelsReleve: {},
    mesCartes: { 2027: (cartes || {})[nom || "Théo"] || {} }, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
// les variantes de cartes de la saison A (points)
const VAR = {
  aucune: {},
  base: { Théo: { 202702: { c: "pluie" } } },
  bonus: { Théo: { 202702: { b: "safety" } } },
  lesDeux: { Théo: { 202702: { c: "pluie", b: "safety" }, 202703: { b: "safety" } }, Kévin: { 202702: { c: "turbo", b: "undercut" } } },
  ancien: { Théo: { 202702: { c: "safety" } } }
};
const proj = c => ({ classement: c.classement, mois: c.mois.map(m => ({ k: m.k, l: m.l.map(x => ({ nom: x.nom, rg: x.rg, p: x.p, carte: x.carte ? x.carte.id + ":" + x.carte.gain + (x.carte.invalide ? ":x" : "") : "", carteB: x.carteB ? x.carteB.id + ":" + x.carteB.gain + (x.carteB.invalide ? ":x" : "") + (x.carteB.deja ? ":deja" : "") : "", pioche: (x.pioche || []).join() })) })) });
/** bac à sable du serveur : Google simulé (propriétés en mémoire, onglets Data des 4 pilotes, date fixe) */
function bacServeur(maintenant, fichiers) {
  const RD = Date, t0 = new RD(maintenant).getTime(), props = {};
  class FD extends RD { constructor(...a) { super(...(a.length ? a : [t0])); } static now() { return t0; } }
  const pad = n => String(n).padStart(2, "0");
  const ctx = { console, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp, Error, isFinite, isNaN, parseInt, parseFloat, Date: FD, Intl,
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({}, props), getProperty: k => props[k] === undefined ? null : props[k], setProperty: (k, v) => { props[k] = String(v); }, setProperties: o => Object.assign(props, o), deleteProperty: k => { delete props[k]; } }) },
    SpreadsheetApp: { getActive: () => ({ getSpreadsheetTimeZone: () => "Europe/Paris", getSheets: () => NOMS.map(n => ({ getName: () => "Data " + n })) }) },
    Utilities: { formatDate: (d, tz, f) => f.replace("yyyy", d.getFullYear()).replace("MM", pad(d.getMonth() + 1)).replace("dd", pad(d.getDate())) } };
  vm.createContext(ctx);
  fichiers.forEach(f => vm.runInContext(fs.readFileSync(path.join(AS, f), "utf8"), ctx, { filename: f }));
  return { ctx, props, poser: corps => { try { return Object.assign({ ok: true }, vm.runInContext("vsPoserCarte_(__c)", Object.assign(ctx, { __c: corps }))); } catch (e) { return { ok: false, message: e.message }; } } };
}
function calculServeur(d) {
  const s = bacServeur("2027-04-10T10:00:00", ["versus/PodiumCale.js", "versus/PodiumCommun.js"]);
  s.ctx.__D = d; return proj(vm.runInContext("D = __D; MEMO_SAISON = { d: null, m: {} }; championnat(2027)", s.ctx));
}
async function page(b, quand, route) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 0 }) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(route(c)) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.revele", "209912"); });
  await p.goto("http://localhost:" + PORT + "/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800);
  return { ctx, p, err };
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); }, errs = [];
  // ---------- 1. points
  const A = {};
  { const { ctx, p, err } = await page(b, "2027-04-10T10:00:00", () => donnees("A", {}));
    for (const v of Object.keys(VAR)) A[v] = await p.evaluate(([cartes, nom]) => { D.cartes = { 2027: cartes }; D.mesCartes = { 2027: cartes["Théo"] || {} }; MEMO_SAISON = { d: null, m: {} }; const c = championnat(2027), f = c.mois.find(m => m.k === 202702);
      return { c: JSON.parse(JSON.stringify(c.mois.map(m => ({ k: m.k, l: m.l.map(x => ({ nom: x.nom, rg: x.rg, p: x.p, carte: x.carte ? x.carte.id + ":" + x.carte.gain + (x.carte.invalide ? ":x" : "") : "", carteB: x.carteB ? x.carteB.id + ":" + x.carteB.gain + (x.carteB.invalide ? ":x" : "") + (x.carteB.deja ? ":deja" : "") : "", pioche: (x.pioche || []).join() })) })))),
        classement: c.classement, dec: decompte(f.l.find(x => x.nom === nom), f.spec) }; }, [VAR[v], "Théo"]);
    A.regles = await p.evaluate(() => ({ regles: htmlRegles(true), annonce: etape("pioche").resume, tuto: tutoDiapos()[0].p }));
    errs.push(...err); await ctx.close(); }
  const x = (v, k, n) => A[v].c.find(m => m.k === k).l.find(z => z.nom === n);
  ok(x("aucune", 202701, "Théo").rg === 4 && x("aucune", 202701, "Théo").pioche === "safety", "janvier : Théo finit dernier et pioche 🚨 Safety car (" + x("aucune", 202701, "Théo").pioche + ")");
  const p0 = x("aucune", 202702, "Théo").p, pB = x("base", 202702, "Théo").p, pS = x("bonus", 202702, "Théo").p, p2 = x("lesDeux", 202702, "Théo");
  ok(x("base", 202702, "Théo").carte === "pluie:2" && pB === p0 + 2, "février, carte du mois seule : 🌧️ Pneus pluie +2 (" + p0 + " → " + pB + ")");
  ok(x("bonus", 202702, "Théo").carteB === "safety:2" && pS === p0 + 2, "février, carte bonus seule : 🚨 Safety car +2 (" + p0 + " → " + pS + ")");
  ok(p2.carte === "pluie:2" && p2.carteB === "safety:2" && p2.p === p0 + 4, "février, les DEUX posées : Pneus pluie +2 ET Safety car +2 comptent toutes les deux (" + p0 + " → " + p2.p + ")");
  ok(/🌧️/.test(A.lesDeux.dec) && /🚨/.test(A.lesDeux.dec) && /\+ 2 🌧️/.test(A.lesDeux.dec) && /\+ 2 🚨/.test(A.lesDeux.dec), "détail des points : les deux cartes apparaissent (« " + A.lesDeux.dec + " »)");
  ok(x("lesDeux", 202703, "Théo").carteB === "safety:0:x:deja", "mars : la même carte bonus rejouée ne compte pas (une fois par saison) (" + x("lesDeux", 202703, "Théo").carteB + ")");
  ok(x("lesDeux", 202702, "Kévin").carteB === "undercut:0:x" && x("lesDeux", 202702, "Kévin").carte === "turbo:0", "Kévin n'a jamais pioché d'Undercut : sa carte bonus est sans effet, sa carte du mois compte normalement");
  ok(x("ancien", 202702, "Théo").carteB === "safety:2" && x("ancien", 202702, "Théo").carte === "" && x("ancien", 202702, "Théo").p === pS, "ancien format (la bonus à la place de la carte du mois) : compté comme la carte bonus (+2)");
  ok(x("aucune", 202703, "Théo").pioche === "undercut", "mars : Théo dernier, pioche une 2e carte bonus (✂️ Undercut)");
  ok(["aucune", "base", "bonus", "lesDeux", "ancien"].every(v => A[v].c.every(m => m.l.every(z => !z.carte || +z.carte.split(":")[1] <= 4) && m.l.every(z => !z.carteB || +z.carteB.split(":")[1] <= 4))), "plafond +4 par carte respecté partout");
  // serveur = appli (calcul)
  if (!fs.existsSync(path.join(AS, "versus/PodiumCommun.js"))) ok(false, "serveur : versus/PodiumCommun.js introuvable dans " + AS);
  else {
    const diff = Object.keys(VAR).filter(v => { const s = calculServeur(donnees("A", VAR[v])); return JSON.stringify(s.mois) !== JSON.stringify(A[v].c) || JSON.stringify(s.classement) !== JSON.stringify(A[v].classement); });
    ok(!diff.length, "serveur (PodiumCommun.js) = appli, au point près, sur les " + Object.keys(VAR).length + " variantes (carte du mois, bonus, les deux, ancien format)" + (diff.length ? " (écart : " + diff.join(", ") + ")" : ""));
  }
  // règles et annonces
  ok(/en plus de ta carte du mois/.test(A.regles.regles) && /une seule carte bonus par mois/.test(A.regles.regles), "📖 règles : « à jouer en plus de ta carte du mois », une seule carte bonus par mois");
  ok(/EN PLUS de ta carte du mois/.test(A.regles.annonce), "📣 annonce du rattrapage (1er janvier) : « " + A.regles.annonce + " »");
  ok(/ta carte bonus si tu en as une, à jouer en plus/.test(A.regles.tuto), "Podium en bref : « + ta carte bonus si tu en as une, à jouer en plus »");
  // ---------- 2. serveur : enregistrement des cartes posées (fenêtre d'avril ouverte le 25 mars)
  const S = bacServeur("2027-03-25T10:00:00", ["versus/API.js"]);
  S.props.CARTES_2027 = JSON.stringify({ Théo: { 202702: { b: "jaune" } }, Kévin: { 202704: { c: "undercut" } } });
  const lit = () => JSON.parse(S.props.CARTES_2027 || "{}");
  const r1 = S.poser({ personne: "Théo", mois: 202704, carte: "turbo", emplacement: "base" });
  const r2 = S.poser({ personne: "Théo", mois: 202704, carte: "safety", emplacement: "bonus" });
  const t2 = lit().Théo[202704];
  ok(r1.ok && r2.ok && t2.c === "turbo" && t2.b === "safety", "serveur : carte du mois (Turbo) ET carte bonus (Safety car) enregistrées le même mois " + JSON.stringify(t2));
  ok(/en plus de ta carte du mois/.test(r2.message), "serveur : message « " + r2.message + " »");
  const r3 = S.poser({ personne: "Théo", mois: 202704, carte: "undercut", emplacement: "bonus" }), t3 = lit().Théo[202704];
  ok(r3.ok && t3.c === "turbo" && t3.b === "undercut" && Object.keys(t3).filter(z => z === "b").length === 1, "serveur : une seule carte bonus par mois (la 2e remplace la 1re, la carte du mois reste) " + JSON.stringify(t3));
  const r4 = S.poser({ personne: "Théo", mois: 202704, carte: "jaune", emplacement: "bonus" });
  ok(!r4.ok && /déjà jouée/.test(r4.message), "serveur : une carte bonus déjà jouée (Drapeau jaune, février) est refusée : « " + r4.message + " »");
  const r5 = S.poser({ personne: "Théo", mois: 202704, carte: null, emplacement: "bonus" }), t5 = lit().Théo[202704];
  ok(r5.ok && t5.c === "turbo" && !t5.b, "serveur : reprendre la carte bonus garde la carte du mois " + JSON.stringify(t5));
  const r6 = S.poser({ personne: "Théo", mois: 202704, carte: "safety" }), t6 = lit().Théo[202704];
  ok(r6.ok && t6.c === "turbo" && t6.b === "safety", "serveur : une ancienne appli (sans « emplacement ») range quand même la carte bonus à part " + JSON.stringify(t6));
  const r7 = S.poser({ personne: "Kévin", mois: 202704, carte: "pluie" }), t7 = lit().Kévin[202704];
  ok(r7.ok && t7.c === "pluie" && t7.b === "undercut", "serveur : ancien format (bonus rangée à la place de la carte du mois) remis en ordre à la première écriture " + JSON.stringify(t7));
  const r8 = S.poser({ personne: "Théo", mois: 202704, carte: "pari", cible: "Kévin", emplacement: "base" });
  ok(r8.ok && lit().Théo[202704].c === "pari" && lit().Théo[202704].cible === "Kévin" && lit().Théo[202704].b === "safety", "serveur : changer la carte du mois (Pari contre Kévin) garde la carte bonus");
  S.props.CARTES_2027 = JSON.stringify(Object.assign(lit(), { Devlin: { 202704: { b: "arret" } } }));
  const pub = vm.runInContext("vsCartesPubliques_(vsLireCartes_())", S.ctx)["2027"];
  ok(JSON.stringify(pub.Théo[202704]) === '{"cache":true}' && !(202704 in (pub.Devlin || {})) && !/arret|safety|"b"/.test(JSON.stringify(Object.values(pub).map(z => z[202704]))), "serveur : vue publique avant le 2 : la carte du mois est un dos de carte, une carte bonus seule n'envoie RIEN (Devlin : " + JSON.stringify((pub.Devlin || {})[202704]) + ")");
  const r9 = S.poser({ personne: "Théo", mois: 202704, carte: "pari", cible: "Kévin" });
  S.props.CARTES_2027 = JSON.stringify({ Théo: { 202703: { c: "turbo" } } });
  const r10 = S.poser({ personne: "Théo", mois: 202704, carte: "turbo", emplacement: "base" });
  ok(r9.ok && !r10.ok && /se repose un mois/.test(r10.message), "serveur : une carte de base ne se rejoue toujours pas deux mois de suite (« " + r10.message + " »)");
  // ---------- 3. Stand : poser la carte du mois PUIS la carte bonus (le serveur simulé répond)
  const SB = bacServeur("2027-03-25T10:00:00", ["versus/API.js"]), envois = [];
  { const { ctx, p, err } = await page(b, "2027-03-25T10:00:00", c => { if (c.action === "carte") { envois.push(c); return SB.poser(c); }
      return donnees("B", JSON.parse(SB.props.CARTES_2027 || '{"Théo":{}}')); });
    const stand = async () => { await p.evaluate(() => { document.querySelectorAll('.tuto, .revel, .regles, [role="dialog"]').forEach(z => z.remove()); document.documentElement.classList.remove("fige"); choisirSaison(2027); ETAT.podium = "stand"; if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees"); }); await p.waitForTimeout(700); };
    const clic = async sel => { await p.evaluate(q => { document.querySelectorAll('.tuto, .revel, [role="dialog"]').forEach(z => z.remove()); document.querySelector(q).click(); }, sel); await p.waitForTimeout(250); };
    await stand();
    const t0 = await p.evaluate(() => ({ tuiles: [...document.querySelectorAll(".main-cartes [data-carte]")].map(z => z.dataset.carte + (z.disabled ? ":off" : "")), info: (document.querySelector("#v-trophees .info") || {}).textContent || "",
      check: (document.querySelector(".st-check") || {}).textContent || "", pioche: jeuDe("Théo", 2027).pioche.map(z => z.c).join() }));
    ok(t0.pioche === "safety,undercut" && t0.tuiles.includes("safety") && t0.tuiles.includes("undercut"), "Stand : Théo a ses 2 cartes bonus en main (" + t0.tuiles.join(" ") + ")");
    ok(/en plus de ta carte du mois/.test(t0.info) && /\+ ta carte bonus/.test(t0.check), "Stand : « + ta carte bonus » (« " + t0.check + " ») et l'aide « en plus de ta carte du mois »");
    await clic('[data-carte="turbo"]'); await clic("#c-poser"); await p.waitForTimeout(900);
    await clic('[data-carte="safety"]');
    const bouton = await p.textContent("#c-poser"), aide = await p.textContent(".c-action");
    await clic("#c-poser"); await p.waitForTimeout(900); await stand();
    const t1 = await p.evaluate(() => ({ tuiles: Object.fromEntries([...document.querySelectorAll(".main-cartes [data-carte]")].map(z => [z.dataset.carte, (z.disabled ? "off " : "") + ((z.querySelector("em") || {}).textContent || "")])),
      check: (document.querySelector(".st-check") || {}).textContent || "", action: (document.querySelector(".c-action") || {}).textContent || "", reprendreB: !!document.querySelector("#c-reprendre-b") }));
    if (CAPT) { await p.evaluate(() => { const e = document.querySelector(".st-check"); if (e) e.scrollIntoView({ block: "start" }); }); await capture(p, "bonus-stand-haut"); await p.evaluate(() => { const e = document.querySelector(".main-cartes"); if (e) e.scrollIntoView({ block: "start" }); }); await capture(p, "bonus-stand-cartes"); }
    const srv = JSON.parse(SB.props.CARTES_2027 || "{}").Théo[202704];
    ok(/Poser en plus/.test(bouton) && /en plus de ta carte du mois/.test(aide), "Stand : la carte bonus se pose « en plus » (bouton « " + bouton.trim() + " »)");
    ok(srv && srv.c === "turbo" && srv.b === "safety", "Stand → serveur : carte du mois ET carte bonus enregistrées pour avril " + JSON.stringify(srv));
    ok(envois.length === 2 && envois[0].emplacement === "base" && envois[1].emplacement === "bonus", "Stand : deux envois, « base » puis « bonus » " + JSON.stringify(envois.map(z => [z.carte, z.emplacement])));
    ok(/✓ Carte posée/.test(t1.check) && /✓ \+ carte bonus/.test(t1.check) && /posée/.test(t1.tuiles.turbo) && /posée/.test(t1.tuiles.safety), "Stand : « ✓ Carte posée » et « ✓ + carte bonus » (« " + t1.check + " »)");
    ok(/^off/.test(t1.tuiles.undercut) && /une bonus par mois/.test(t1.tuiles.undercut), "Stand : la 2e carte bonus (Undercut) est grisée : « " + t1.tuiles.undercut + " »");
    ok(t1.reprendreB && /Reprendre ma carte bonus/.test(t1.action), "Stand : « Reprendre ma carte bonus » proposé à part");
    await clic("#c-reprendre-b"); await p.waitForTimeout(900); await stand();
    const srv2 = JSON.parse(SB.props.CARTES_2027 || "{}").Théo[202704];
    ok(srv2 && srv2.c === "turbo" && !srv2.b && envois[2] && envois[2].emplacement === "bonus" && envois[2].carte === null, "Stand : reprendre la carte bonus garde la carte du mois " + JSON.stringify(srv2));
    errs.push(...err); await ctx.close(); }
  // ---------- 3 bis. pendant la fenêtre : une carte bonus seule ne se voit pas chez les autres, et ne compte pas dans « cartes posées »
  { const SC = bacServeur("2027-03-25T10:00:00", ["versus/API.js"]);
    SC.props.CARTES_2027 = JSON.stringify({ Théo: { 202704: { b: "safety" } }, Devlin: { 202704: { b: "undercut" } }, Clément: { 202704: { c: "undercut" } }, Kévin: { 202704: { c: "pluie" } } });
    const pubV = vm.runInContext("vsCartesPubliques_(vsLireCartes_())", SC.ctx);
    const vue = nom => Object.assign(donnees("B", {}, nom), { cartes: pubV, mesCartes: { 2027: JSON.parse(SC.props.CARTES_2027)[nom] || {} } });
    for (const nom of ["Théo", "Kévin"]) {
      const { ctx, p, err } = await page(b, "2027-03-25T10:00:00", () => vue(nom));
      const r = await p.evaluate(() => { document.querySelectorAll('.tuto, .revel, [role="dialog"]').forEach(z => z.remove()); choisirSaison(2027); ETAT.podium = "stand"; if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees");
        const t = document.createElement("div"); t.innerHTML = htmlPeloton(2027, 202704, moiPilote());
        return { compte: compteCartesTab(2027).replace(/<[^>]+>/g, "").trim(), pel: (t.querySelector(".st-pel-t") || {}).textContent || "", ok: [...t.querySelectorAll(".st-pel-p")].map(z => z.querySelector("small").textContent + (z.classList.contains("ok") ? ":ok" : ":-")),
          autres: ["Théo", "Devlin"].filter(n => n !== moiPilote()).map(n => JSON.stringify(carteDe(2027, n, 202704))) }; });
      if (nom === "Théo") ok(r.compte === "1/4" && /1\/4/.test(r.pel) && r.ok.includes("Théo:-") && r.ok.includes("Kévin:ok") && r.ok.includes("Devlin:-") && r.ok.includes("Clément:-"),
        "compteur pour soi : Théo n'a posé que sa carte bonus → « 1/4 » (seul Kévin a sa carte du mois ; l'ancienne bonus de Clément ne compte pas) " + JSON.stringify(r));
      else ok(r.autres.every(z => z === "null") && r.ok.includes("Théo:-") && r.ok.includes("Devlin:-") && r.compte === "1/4", "un autre joueur (Kévin) ne voit RIEN des cartes bonus posées seules (Théo, Devlin : « pas encore de carte ») " + JSON.stringify(r));
      errs.push(...err); await ctx.close();
    } }
  // ---------- 4. révélation du 2 avril
  { const { ctx, p, err } = await page(b, "2027-04-02T10:00:00", () => donnees("B", { Théo: { 202704: { c: "turbo", b: "safety" } }, Kévin: { 202704: { c: "pluie" } }, Devlin: { 202704: { b: "undercut" } } }));
    const rv = await p.evaluate(async () => { localStorage.setItem("versus.revele", "0"); document.querySelectorAll(".revel,.tuto,.regles").forEach(z => z.remove()); const r = revelationAVoir(); if (!r) return null; ouvrirRevelation(r); await new Promise(z => setTimeout(z, 300));
      await new Promise(z => setTimeout(z, 2600)); return [...document.querySelectorAll(".rv-p")].map(z => z.textContent.replace(/\s+/g, " ").trim()); });
    await capture(p, "bonus-revelation");
    ok(rv && rv.some(t => /Théo/.test(t) && /\+ 🚨 Safety car \(carte bonus\)/.test(t) && /Turbo/.test(t)), "révélation du 2 : la carte du mois se retourne, la carte bonus s'annonce sous le nom (" + JSON.stringify(rv) + ")");
    ok(rv && rv.some(t => /Devlin/.test(t) && /Undercut/.test(t)), "révélation : une carte bonus posée seule se retourne aussi");
    errs.push(...err); await ctx.close(); }
  await b.close();
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs));
  process.exit(ko.length ? 1 : 0);
})();
