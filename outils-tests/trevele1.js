/* Test « révélées le 1er » (Théo, 26/11) : cartes, pronostic, pole et rival se posent du 20 jusqu'au DERNIER JOUR du mois précédent
   inclus (23 h 59, heure de Paris, celle du serveur) et sont révélés le 1er du mois à 0 h, pour tout le monde (avant : jusqu'au 1er, révélés le 2).
   Deux parties :
   1. le serveur (versus/API.js, chargé sans Google : faux stockage, fausse horloge à l'heure de Paris) : pose acceptée le dernier jour à 23 h 59,
      refusée le 1er à 0 h avec un « Trop tard » juste, cartes / pronostics / rival cachés puis révélés, mois de 28, 29, 30, 31 jours, 31/12 → 1/1,
      décembre de chauffe (carte déjà posée en novembre : toujours valable) ;
   2. l'appli (téléphone à l'heure de Paris, Google intercepté : les fausses cartes sont filtrées par le VRAI code du serveur à la même heure) :
      fenêtre ouverte / fermée, Stand, révélation, textes, et appli = serveur à chaque minuit de novembre 2026 à mars 2028.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/trevele1.js
   (PORT=… pour un autre port ; API_VERSUS=… chemin de versus/API.js, sinon ../app_scripts/versus/API.js ou /home/user/app_scripts/versus/API.js).
   Aucune vraie donnée. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const API_F = process.env.API_VERSUS || [path.join(__dirname, "../../app_scripts/versus/API.js"), "/home/user/app_scripts/versus/API.js"].find(f => fs.existsSync(f));
let nok = 0;
const ok = (c, t) => { console.log((c ? "OUI " : "NON ") + t); if (!c) nok++; };

/* ---------- 1. le serveur, sans Google ---------- */
const TZ = "Europe/Paris";
let NOW = Date.parse("2026-11-25T12:00:00+01:00");
const VraiDate = Date;
class DateFigee extends VraiDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
const PROPS = {};
const partie = (d, tz) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
/** l'instant UTC (ms) où il est « aaaa-mm-jj hh:mm » à Paris */
const paris = (j, hm) => [1, 2].map(h => Date.parse(j + "T" + hm + ":00+0" + h + ":00")).find(t => { const q = partie(new VraiDate(t), TZ); return q.year + "-" + q.month + "-" + q.day === j && q.hour + ":" + q.minute === hm; });
const ctx = {
  console, JSON, Math, Number, String, Object, Array, Error, RegExp, isFinite, parseInt, parseFloat, Date: DateFigee,
  Utilities: { formatDate: (d, tz, f) => { const p = partie(d, tz); return f.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour).replace("mm", p.minute); }, computeDigest: () => [], DigestAlgorithm: {}, Charset: {} },
  SpreadsheetApp: { getActive: () => ({ getSpreadsheetTimeZone: () => TZ }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in PROPS ? PROPS[k] : null), setProperty: (k, v) => { PROPS[k] = String(v); }, setProperties: o => { Object.keys(o).forEach(k => { PROPS[k] = String(o[k]); }); }, deleteProperty: k => { delete PROPS[k]; }, getProperties: () => Object.assign({}, PROPS) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  MailApp: { sendEmail() {} }, ContentService: {}, HtmlService: {}, Session: { getEffectiveUser: () => ({ getEmail: () => "" }) }
};
vm.createContext(ctx);
let srvOk = true;
try { vm.runInContext(fs.readFileSync(API_F, "utf8"), ctx, { filename: "API.js" }); } catch (e) { srvOk = false; ok(false, "serveur : API.js ne se charge pas (" + e.message + ")"); }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
if (srvOk) {
  vm.runInContext("vsPersonnes_ = () => " + JSON.stringify(NOMS) + "; vsEtape_ = () => 202601;", ctx);   // pas de Sheet : la liste des pilotes, toutes les règles ouvertes
  const S = (f, ...a) => ctx[f](...a);
  const a = (iso, f) => { NOW = Date.parse(iso); return f(); };
  const essai = (iso, f) => a(iso, () => { try { f(); return null; } catch (e) { return e; } });
  ok(S("vsLimite_", 202612) === 20261201 && S("vsLimite_", 202701) === 20270101, "serveur : la limite (exclue) est le 1er du mois (vsLimite_ = aaaamm01)");
  // décembre de chauffe : carte posée le 25/11 (déjà là avant le changement), puis les autres
  const pose = (nom, k, carte, cible) => S("vsPoserCarte_", { personne: nom, mois: k, carte, cible });
  ok(!essai("2026-11-25T12:00:00+01:00", () => pose("Théo", 202612, "turbo")), "chauffe : carte de Théo posée le 25/11 (comme celles déjà posées pour décembre)");
  ok(!essai("2026-11-30T23:59:00+01:00", () => pose("Kévin", 202612, "pari", "Théo")), "chauffe : pose acceptée le 30/11 à 23 h 59 (dernier jour, heure de Paris)");
  ok(!essai("2026-11-30T20:00:00+01:00", () => pose("Clément", 202612, "pluie")), "chauffe : pose acceptée le 30/11 au soir");
  const tard = essai("2026-12-01T00:00:00+01:00", () => pose("Devlin", 202612, "turbo"));
  ok(tard && tard.code === "tard" || tard && /Trop tard/.test(tard.message), "chauffe : pose refusée le 1/12 à 0 h (« trop tard ») : " + (tard && tard.message));
  ok(tard && /se jouaient jusqu'au 30 novembre inclus\.$/.test(tard.message), "message serveur juste : « … jusqu'au 30 novembre inclus. »");
  const tardUTC = essai("2026-11-30T23:30:00Z", () => pose("Devlin", 202612, "turbo"));   // 0 h 30 à Paris : l'heure du serveur compte, pas celle du téléphone
  ok(!!tardUTC, "chauffe : 30/11 23 h 30 UTC = 1/12 0 h 30 à Paris : refusé (heure du serveur)");
  const pub = iso => a(iso, () => S("vsCartesPubliques_", S("vsLireCartes_")));
  const avant = pub("2026-11-30T23:59:00+01:00"), apres = pub("2026-12-01T00:00:00+01:00");
  ok(["Théo", "Kévin", "Clément"].every(n => avant["2026"][n]["202612"].cache === true && !avant["2026"][n]["202612"].c), "30/11 23 h 59 : toutes les cartes de décembre encore face cachée pour les autres");
  ok(apres["2026"]["Théo"]["202612"].c === "turbo" && apres["2026"]["Kévin"]["202612"].c === "pari" && apres["2026"]["Kévin"]["202612"].cible === "Théo" && apres["2026"]["Clément"]["202612"].c === "pluie", "1/12 0 h : toutes révélées, pour tout le monde (dont la carte du 25/11, toujours valable)");
  ok(!S("vsLireCartes_")["2026"]["Devlin"] || !S("vsLireCartes_")["2026"]["Devlin"]["202612"], "Devlin, en retard : pas de carte (tant pis, comme avant)");
  // les rappels : dernier jour = le 30/11, veille = le 29/11
  ok(S("vsMomentRappel_", 20261130, 202612) === "dernier" && S("vsMomentRappel_", 20261129, 202612) === "veille" && S("vsMomentRappel_", 20261201, 202612) === null, "rappels de la chauffe : « dernier jour » le 30/11, « veille » le 29/11, rien le 1/12");
  // mois de 28 / 29 / 30 / 31 jours, et 31/12 → 1/1
  const bornes = [[202703, "2027-02-28", "2027-03-01", "28 février"], [202803, "2028-02-29", "2028-03-01", "29 février"], [202705, "2027-04-30", "2027-05-01", "30 avril"],
    [202702, "2027-01-31", "2027-02-01", "31 janvier"], [202801, "2027-12-31", "2028-01-01", "31 décembre"], [202701, "2026-12-31", "2027-01-01", "31 décembre"]];
  bornes.forEach(([k, der, prem, txt]) => {
    const i1 = new VraiDate(paris(der, "23:59")).toISOString(), i2 = new VraiDate(paris(prem, "00:00")).toISOString();
    const e1 = essai(i1, () => S("vsFenetre_", k, "les cartes")), e2 = essai(i2, () => S("vsFenetre_", k, "les cartes"));
    ok(!e1 && e2 && new RegExp("jusqu'au " + txt + " inclus").test(e2.message), S("vsNomMois_", k) + " : ouvert le " + txt + " à 23 h 59, fermé le " + prem.slice(8) + "/" + prem.slice(5, 7) + " à 0 h (« " + (e2 && e2.message) + " »)");
    const r1 = a(i1, () => S("vsCarteRevelee_", k)), r2 = a(i2, () => S("vsCarteRevelee_", k));
    ok(!r1 && r2, S("vsNomMois_", k) + " : caché le " + txt + ", révélé le 1er à 0 h");
  });
  ok(!!essai("2027-02-19T23:59:00+01:00", () => S("vsFenetre_", 202703, "les cartes")) && !essai("2027-02-20T00:00:00+01:00", () => S("vsFenetre_", 202703, "les cartes")), "ouverture inchangée : le 20 du mois d'avant");
  // pronostic (avec pole) et rival : même fenêtre, même révélation
  ok(!essai("2027-02-28T23:59:00+01:00", () => S("vsPronostiquer_", { personne: "Kévin", mois: 202703, vainqueur: "Théo", indice: "h", pole: 1.5 })), "pronostic + pole de mars acceptés le 28/02 à 23 h 59");
  const ep = essai("2027-03-01T00:00:00+01:00", () => S("vsPronostiquer_", { personne: "Théo", mois: 202703, vainqueur: "Théo", indice: "b" }));
  ok(ep && /Trop tard : les pronostics de mars 2027 se jouaient jusqu'au 28 février inclus\./.test(ep.message), "pronostic refusé le 1/03 à 0 h : « " + (ep && ep.message) + " »");
  const pp = iso => a(iso, () => S("vsPronosPublics_", S("vsLireParSaison_", "PRONOS")));
  ok(pp("2027-02-28T23:59:00+01:00")["2027"]["Kévin"]["202703"].cache === true && pp("2027-03-01T00:00:00+01:00")["2027"]["Kévin"]["202703"].p === 1.5, "pronostic et pole : cachés le 28/02, révélés le 1/03 à 0 h");
  ok(!essai("2026-12-31T23:59:00+01:00", () => S("vsChoisirRival_", { personne: "Kévin", saison: 2027, rival: "Théo" })), "rival de la saison 2027 accepté le 31/12/2026 à 23 h 59");
  const er = essai("2027-01-01T00:00:00+01:00", () => S("vsChoisirRival_", { personne: "Théo", saison: 2027, rival: "Kévin" }));
  ok(er && /Trop tard : le choix du rival de janvier 2027 se jouait jusqu'au 31 décembre inclus\./.test(er.message), "rival refusé le 1/1/2027 à 0 h : « " + (er && er.message) + " »");
  const rp = iso => a(iso, () => S("vsRivauxPublics_", S("vsLireParSaison_", "RIVAUX")));
  ok(rp("2027-11-30T23:59:00+01:00")["2027"]["Kévin"].cache === true && rp("2027-12-01T00:00:00+01:00")["2027"]["Kévin"].r === "Théo", "rival : secret jusqu'au 30/11/2027, révélé le 1/12/2027 à 0 h (révélation de la Finale)");
  // vote du « coup de la saison » : du 1er au 31 décembre (Théo, 26/11 ; avant : du 2)
  const VOTE = [["2027-11-30", "23:59", false], ["2027-12-01", "00:00", true], ["2027-12-31", "23:59", true], ["2028-01-01", "00:00", false]];
  ok(VOTE.every(([j, h, att]) => a(new VraiDate(paris(j, h)).toISOString(), () => S("vsVoteOuvert_", 2027)) === att), "serveur : vote de 2027 fermé le 30/11 à 23 h 59, ouvert du 1/12 à 0 h au 31/12 à 23 h 59, fermé le 1/1");
  const ev = essai(new VraiDate(paris("2027-11-30", "23:59")).toISOString(), () => S("vsVoter_", { personne: "Kévin", saison: 2027, cible: "Théo" }));
  ok(ev && /est ouvert du 1er au 31 décembre\./.test(ev.message), "serveur : vote refusé le 30/11 : « " + (ev && ev.message) + " »");
  ok(S("vsSaisonAmelio_", 20271130) === 2027 && S("vsSaisonAmelio_", 20271201) === 2028, "améliorations : pour la Finale jusqu'au 30/11, la saison suivante dès le 1/12");
}

/* ---------- 2. l'appli, au téléphone (heure de Paris) ---------- */
const serveurA = iso => { NOW = Date.parse(iso); return { cartes: ctx.vsCartesPubliques_(ctx.vsLireCartes_()), mes: (ctx.vsLireCartes_()["2026"] || {})["Kévin"] || {} }; };
function fausses(iso) {
  const rows = i => { const l = []; for (let m = 1; m <= 11; m++) { const v = 10000 + 300 * m + 50 * i * m; l.push([202600 + m, "2026-" + String(m).padStart(2, "0") + "-28", [v, v * 0.6, v * 0.4, 0, 0, 0, 0, 0], Array(25).fill(0).map((_, j) => j === 1 ? v : 0)]); } return l; };
  const s = srvOk ? serveurA(iso) : { cartes: {}, mes: {} };
  return { ok: true, genere: "2026-11-24T10:00:00", majTexte: "Dernier relevé : novembre 2026", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map((n, i) => ({ nom: n, rows: rows(i) })),
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: Array.from({ length: 11 }, (_, m) => [202601 + m, 0.01, 0.012, 0.005]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 5, ecurie: {}, exclusifs: {}, cartes: s.cartes, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
    session: { role: "perso", nom: "Kévin" }, mesCartes: { 2026: s.mes }, mesDuels: {}, mesPronos: {}, monRival: {} };
}
const PERIMES = [/révélées? le 2\b/, /révélé le 2\b/, /du 20 au 1er/, /jusqu'au 1er décembre/, /Secret jusqu'au 2\b/, /secrètes jusqu'au 2\b/, /le 2\s*tout est révélé/, /D'ici le 1er janvier/, /20 déc\. → 1er janv/];
(async () => {
  const b = await chromium.launch();
  const ouvrir = async iso => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", timezoneId: TZ });
    const p = await c.newPage(), err = []; p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new VraiDate(iso));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(iso)) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi", "Kévin"); });
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
    await p.waitForTimeout(2000);
    return { c, p, err };
  };
  const stand = p => p.evaluate(async () => { document.querySelectorAll(".tuto, .revel, .regles").forEach(x => x.remove()); choisirSaison(2026); ETAT.podium = "stand"; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 500)); const e = document.querySelector(".st-etat"); return e ? e.innerText : ""; });
  // 30/11 23 h 59 : fenêtre ouverte, dernier jour, cartes des autres cachées
  { const { c, p, err } = await ouvrir("2026-11-30T23:59:00+01:00");
    const r = await p.evaluate(() => ({ k: moisCarteOuvert(), kp: kOuvertPour(2026), rev: circuitRevele(202612), autres: ["Théo", "Clément"].map(n => carteDe(2026, n, 202612)), moi: carteDe(2026, "Kévin", 202612), revel: !!revelationAVoir(), fin: finFenetre(202612) }));
    ok(r.k === 202612 && r.kp === 202612 && !r.rev, "appli 30/11 23 h 59 : fenêtre de décembre ouverte, rien de révélé " + JSON.stringify({ k: r.k, rev: r.rev }));
    ok(r.autres.every(x => x && x.cache && !x.c), "appli 30/11 23 h 59 : cartes de Théo et Clément face cachée");
    ok(r.moi && r.moi.c === "pari" && r.moi.cache, "appli 30/11 23 h 59 : Kévin voit sa propre carte (face cachée pour les autres)");
    ok(!r.revel && r.fin === "30 novembre", "appli 30/11 : pas de révélation, fin de fenêtre « 30 novembre »");
    const t = await stand(p);
    ok(/Fenêtre ouverte/i.test(t) && /dernier jour/i.test(t) && /Jusqu'au 30 novembre inclus/i.test(t) && /révélation, le 1er décembre/i.test(t), "Stand 30/11 : « Fenêtre ouverte · dernier jour · Jusqu'au 30 novembre inclus … le 1er décembre » : " + t.replace(/\s+/g, " ").slice(0, 220));
    ok(!err.length, "appli 30/11 : 0 erreur JS " + JSON.stringify(err)); await c.close(); }
  // 1/12 0 h : fermé, révélé pour tous, révélation affichée
  { const { c, p, err } = await ouvrir("2026-12-01T00:00:00+01:00");
    const r = await p.evaluate(() => ({ k: moisCarteOuvert(), rev: circuitRevele(202612), cartes: D.personnes.map(x => carteDe(2026, x.nom, 202612)), revel: document.querySelector(".revel") ? document.querySelector(".revel").innerText : "" }));
    ok(r.k === null && r.rev, "appli 1/12 0 h : plus de fenêtre, décembre révélé");
    ok(r.cartes[0] && r.cartes[0].c === "turbo" && r.cartes[1] && r.cartes[1].c === "pari" && !r.cartes[1].cache && r.cartes[2] && r.cartes[2].c === "pluie" && !r.cartes[3], "appli 1/12 : les cartes de tous révélées (Turbo, Pari → Théo, Pneus pluie ; Devlin rien)");
    ok(/Les cartes sont retournées/i.test(r.revel) && /Turbo/i.test(r.revel) && /Pari/i.test(r.revel), "appli 1/12 : la révélation « Les cartes sont retournées » s'ouvre le 1er");
    const t = await stand(p);
    ok(/Fenêtre fermée/i.test(t) && /se posaient jusqu'au 30 novembre/i.test(t) && /du 20 au 31 décembre/i.test(t), "Stand 1/12 : « Fenêtre fermée … jusqu'au 30 novembre … du 20 au 31 décembre » : " + t.replace(/\s+/g, " ").slice(0, 200));
    ok(!err.length, "appli 1/12 : 0 erreur JS " + JSON.stringify(err)); await c.close(); }
  // textes : règles, Podium en bref, Stand de janvier ; plus aucune trace de l'ancienne règle
  { const { c, p, err } = await ouvrir("2026-12-22T10:00:00+01:00");
    const t = await p.evaluate(async () => { const out = [document.body.innerText]; document.querySelectorAll(".tuto, .revel").forEach(x => x.remove());
      for (const y of [2026, 2027]) { try { choisirSaison(y); ETAT.podium = "stand"; garder(); allerA("trophees"); rendreTrophees(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); out.push(document.body.innerText); }
      try { ouvrirTuto(); const x = document.querySelector(".tuto"); out.push(x.innerText); x.remove(); } catch (e) { }
      try { ouvrirRegles(); out.push(document.querySelector(".regles").innerText); document.querySelector(".regles").remove(); } catch (e) { }
      return out.join("\n"); });
    const vus = PERIMES.filter(r => r.test(t));
    ok(!vus.length, "22/12 : plus aucun texte de l'ancienne règle (« révélées le 2 », « du 20 au 1er »…) " + vus.map(String).join(" "));
    ok(/du 20 au dernier jour du mois/.test(t) && /le 1er\s*tout est révélé/.test(t), "règles : « du 20 au dernier jour du mois → le 1er tout est révélé »");
    ok(/Jusqu'au 31 décembre inclus/.test(t) && /révélation, le 1er janvier/.test(t), "Stand de janvier (22/12) : « Jusqu'au 31 décembre inclus … le 1er janvier »");
    ok(!err.length, "appli 22/12 : 0 erreur JS " + JSON.stringify(err)); await c.close(); }
  // appli = serveur : à chaque minuit (veille 23 h 59 et 0 h) de novembre 2026 à mars 2028, même fenêtre et même révélation
  if (srvOk) {
    const { c, p, err } = await ouvrir("2026-11-25T12:00:00+01:00");
    const desaccords = []; let n = 0;
    for (let t = Date.parse("2026-11-22T12:00:00Z"); t < Date.parse("2028-03-05T12:00:00Z"); t += 864e5) {
      const p0 = partie(new VraiDate(t), TZ), minuit = paris(p0.year + "-" + p0.month + "-" + p0.day, "00:00");   // minuit à Paris (heure d'hiver ou d'été)
      for (const inst of [minuit - 60e3, minuit]) {
        await p.clock.setFixedTime(new VraiDate(inst));
        const app = await p.evaluate(() => { const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1, s = k % 100 === 12 ? k + 89 : k + 1, pr = k % 100 === 1 ? k - 89 : k - 1; return { o: moisCarteOuvert(), r: [pr, k, s].map(x => circuitRevele(x)), ks: [pr, k, s] }; });
        NOW = inst;
        const srvO = app.ks.filter(k => { try { ctx.vsFenetre_(k, "x"); return true; } catch (e) { return false; } });
        const srvR = app.ks.map(k => ctx.vsCarteRevelee_(k));
        const appO = app.o && !(app.o === 202612 && inst < Date.parse("2026-11-21T08:00:00Z")) ? [app.o] : [];
        n++;
        if (JSON.stringify(srvO) !== JSON.stringify(appO) || JSON.stringify(srvR) !== JSON.stringify(app.r)) desaccords.push(new VraiDate(inst).toISOString() + " appli " + JSON.stringify([appO, app.r]) + " serveur " + JSON.stringify([srvO, srvR]));
      }
    }
    const voteKo = [];
    for (const [j, h, att] of [["2027-11-30", "23:59", false], ["2027-12-01", "00:00", true], ["2027-12-31", "23:59", true], ["2028-01-01", "00:00", false]]) {
      await p.clock.setFixedTime(new VraiDate(paris(j, h))); NOW = paris(j, h);
      const v = await p.evaluate(() => voteOuvert(2027)); if (v !== att || ctx.vsVoteOuvert_(2027) !== att) voteKo.push(j + " " + h + " appli " + v + " serveur " + ctx.vsVoteOuvert_(2027)); }
    ok(!voteKo.length, "vote : appli = serveur, ouvert du 1er au 31 décembre " + voteKo.join(" | "));
    ok(!desaccords.length, "appli = serveur sur " + n + " instants (23 h 59 et 0 h, heure de Paris, nov. 2026 → mars 2028, février 28 et 29 jours) " + desaccords.slice(0, 3).join(" | "));
    ok(!err.length, "boucle : 0 erreur JS " + JSON.stringify(err)); await c.close();
  }
  await b.close();
  console.log(nok ? nok + " NON" : "Tout est OUI");
  process.exit(nok ? 1 : 0);
})();
