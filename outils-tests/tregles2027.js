/* Test · règles de points changées le 25/11/2026 par Théo (v20.52, saison 2027 seulement)
   1. 🌑 Côté obscur (juin) : le dernier du championnat avant juin marque ses points de place ×2, et AU MOINS 2
      (1er → 12, 2e → 8, 3e → 4, dernier du mois → 2 au lieu de 0) ; égalité au championnat : le départage habituel désigne un seul dernier.
   2. 💍 Avril : 🏹 « L'œil de l'archer elfe » : le 🎯 vaut +2 (avec 🚀 Turbo : +4) ; plus de cumul sur deux mois.
   3. 🌿 Mai : « La forêt endormie » (Turbo interdit, règle inchangée).
   4. 🚪 Février : Couloirs mouvants, texte avec un exemple en % (règle inchangée : à moins de 0,2 point, même place).
   Plus : le serveur (versus/PodiumCommun.js d'app_scripts) donne exactement les mêmes points que l'appli.
   Fausses données seulement (4 pilotes inventés, rendements fixes). Lancer depuis la racine du dépôt, serveur local ouvert :
   python3 -m http.server 8771 &  puis  node outils-tests/tregles2027.js   (PORT=… pour un autre port ; APP_SCRIPTS=… dossier du dépôt serveur) */
const { chromium } = require("playwright"), fs = require("fs"), vm = require("vm"), path = require("path");
const PORT = process.env.PORT || 8771, AS = process.env.APP_SCRIPTS || "/home/user/app_scripts";
const NOMS = ["Théo", "Kévin", "Devlin", "Clément"];
const IDX = ["S&P 500", "Nasdaq-100", "Or (non couvert)", "MSCI Monde", "Euro Stoxx 50", "Marchés émergents", "Semi-conducteurs"];
const KS = [202610, 202611, 202612, 202701, 202702, 202703, 202704, 202705, 202706];
const SP = { 202701: 0, 202704: 0 };   // S&P 500 du mois (0 en janvier et avril : le 🎯 se joue ; +10 % ailleurs : personne ne le bat)
// rendements de janvier à mai : Théo devant, Kévin, Devlin, Clément dernier du championnat
const BASE = { Théo: 0.03, Kévin: 0.01, Devlin: -0.02, Clément: -0.03 };
const SCENES = {
  premier: { juin: { Clément: 0.05 } },                 // le dernier du championnat gagne juin : 6 × 2 = 12
  deuxieme: { juin: { Clément: 0.02 } },                // 2e : 4 × 2 = 8
  troisieme: { juin: { Clément: 0.00 } },               // 3e : 2 × 2 = 4
  dernier: { juin: { Clément: -0.05 } },                // dernier du mois : 0 × 2 = 0 → 2
  egalClement: { egal: true, fevD: -0.010, fevC: -0.011, juin: { Clément: -0.05 } },   // Devlin et Clément à égalité de points et de victoires : Clément a la moins bonne perf cumulée → c'est lui
  egalDevlin: { egal: true, fevD: -0.011, fevC: -0.010, juin: { Clément: -0.05 } }     // l'inverse : Devlin est le dernier
};
function rend(sc, nom, k) {
  if (k < 202701) return 0.01;
  if (k === 202706) return (sc.juin && sc.juin[nom] !== undefined) ? sc.juin[nom] : { Théo: 0.03, Kévin: 0.01, Devlin: -0.01, Clément: -0.05 }[nom];
  if (sc.egal && (nom === "Devlin" || nom === "Clément")) return k === 202702 ? (nom === "Devlin" ? sc.fevD : sc.fevC) : -0.02;
  return BASE[nom];
}
const ligne = (k, val, r, verse) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [verse, val, 0, r, 0].concat(Array(20).fill(0))];
function donnees(sc) {
  const personnes = NOMS.map((nom, i) => { let val = 1000 + 100 * i; return { nom, rows: KS.map(k => { const r = rend(sc, nom, k); val = Math.round(val * (1 + r)); return ligne(k, val, r, 0); }) }; });
  const cartes = { 2027: { Théo: { 202701: { c: "turbo" }, 202704: { c: "turbo" } }, Kévin: { 202705: { c: "turbo" } } } };
  return { ok: true, version: 88, genere: "2027-07-20T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: IDX, mois: KS.map(k => [k].concat(IDX.map((n, j) => j === 0 && SP[k] !== undefined ? SP[k] : 0.10))), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {},
    mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
const MAINTENANT = "2027-07-20T10:00:00";
const proj = c => ({ classement: c.classement, mois: c.mois.map(m => ({ k: m.k, places: m.places, l: m.l.map(x => ({ nom: x.nom, rg: x.rg, p: x.p, base: x.base, mult: x.mult, plancher: x.plancher || 0, bonus: x.bonus, carte: x.carte ? x.carte.id + ":" + x.carte.gain + (x.carte.invalide ? ":interdite" : "") : "" })) })) });
/** le même calcul, côté serveur : PodiumCale.js + PodiumCommun.js d'app_scripts, dans un bac à sable Node */
function serveur(sc) {
  const RD = Date, t0 = new RD(MAINTENANT).getTime();
  class FD extends RD { constructor(...a) { super(...(a.length ? a : [t0])); } static now() { return t0; } }
  const ctx = { console, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, isFinite, isNaN, parseInt, parseFloat, Date: FD, Intl };
  vm.createContext(ctx);
  ["versus/PodiumCale.js", "versus/PodiumCommun.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(AS, f), "utf8"), ctx, { filename: f }));
  ctx.__D = donnees(sc);
  return vm.runInContext("D = __D; MEMO_SAISON = { d: null, m: {} }; championnat(2027)", ctx);
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const R = {}, err = [];
  let textes = null;
  for (const nom of Object.keys(SCENES)) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage();
    p.on("pageerror", e => err.push(nom + " : " + e.message));
    await p.clock.setFixedTime(new Date(MAINTENANT));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 0 }) });
      r.fulfill({ contentType: "application/json", body: JSON.stringify(donnees(SCENES[nom])) }); });
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800);
    R[nom] = await p.evaluate(() => { MEMO_SAISON = { d: null, m: {} }; const c = championnat(2027), j = c.mois.find(m => m.k === 202706);
      return { c: { classement: c.classement, mois: c.mois.map(m => ({ k: m.k, places: m.places, l: m.l.map(x => ({ nom: x.nom, rg: x.rg, p: x.p, base: x.base, mult: x.mult, plancher: x.plancher || 0, bonus: x.bonus, carte: x.carte ? x.carte.id + ":" + x.carte.gain + (x.carte.invalide ? ":interdite" : "") : "" })) })) },
        dec: j ? Object.fromEntries(j.l.map(x => [x.nom, decompte(x, j.spec)])) : {} }; });
    if (!textes) textes = await p.evaluate(() => ({ avril: PIEGES.suzuka, mai: PIEGES.miami, fev: PIEGES.djeddah, juin: moisSpecial(2027, 202706), pgAvril: (piegeMois(2027, 202704) || {}).id,
      eclipse: etape("monaco").resume, turbo: carteDef("turbo").def, regles: htmlRegles(true) }));
    await ctx.close();
  }
  await b.close();
  ok(!err.length, "0 erreur JS " + JSON.stringify(err));
  const mois = (nom, k) => R[nom].c.mois.find(m => m.k === k), x = (nom, k, n) => (mois(nom, k) || { l: [] }).l.find(z => z.nom === n) || {};
  // ---- Côté obscur
  const avantJuin = n => { const pl = mois(n, 202705).places; return Object.keys(pl).filter(z => pl[z] === Math.max(...Object.values(pl))); };
  ok(avantJuin("premier").join() === "Clément", "fin mai : Clément est le dernier du championnat (" + JSON.stringify(mois("premier", 202705).places) + ")");
  const cl = n => x(n, 202706, "Clément");
  ok(cl("premier").rg === 1 && cl("premier").p === 12 && cl("premier").mult === 2, "🌑 dernier du championnat qui gagne juin : 6 × 2 = 12 (" + cl("premier").p + ")");
  ok(cl("deuxieme").rg === 2 && cl("deuxieme").p === 8, "🌑 dernier du championnat 2e en juin : 4 × 2 = 8 (" + cl("deuxieme").p + ")");
  ok(cl("troisieme").rg === 3 && cl("troisieme").p === 4 && !cl("troisieme").plancher, "🌑 3e en juin : 2 × 2 = 4, pas de plancher (" + cl("troisieme").p + ")");
  ok(cl("dernier").rg === 4 && cl("dernier").base === 0 && cl("dernier").plancher === 2 && cl("dernier").p === 2, "🌑 dernier du championnat ET dernier de juin : 2 points au lieu de 0 (" + cl("dernier").p + ")");
  ok(R.dernier.dec["Clément"] === "0×2 → 2 de place = 2 pts", "🌑 le décompte l'explique : « " + R.dernier.dec["Clément"] + " »");
  ok(["premier", "deuxieme", "troisieme", "dernier"].every(n => mois(n, 202706).l.filter(z => z.mult === 2).length === 1), "🌑 un seul pilote doublé en juin (les autres : points normaux)");
  ok(["Théo", "Kévin", "Devlin"].every(n => { const z = x("dernier", 202706, n); return z.mult === 1 && !z.plancher && z.base === [6, 4, 2][z.rg - 1]; }), "🌑 les autres pilotes de juin gardent leurs points de place normaux (6, 4, 2 ; sans ×2 ni plancher)");
  // ---- égalité au championnat avant juin
  const f1 = mois("egalClement", 202702).l, fD = f1.find(z => z.nom === "Devlin"), fC = f1.find(z => z.nom === "Clément");
  ok(fD.rg === fC.rg && fD.p === fC.p, "🚪 février : Devlin −1,0 % et Clément −1,1 % (0,1 point d'écart) partagent la même place et les mêmes points (" + fD.rg + "e, " + fD.p + " pts)");
  const cu = n => mois(n, 202705).places;
  ok(avantJuin("egalClement").join() === "Clément" && x("egalClement", 202706, "Clément").mult === 2 && x("egalClement", 202706, "Devlin").mult === 1 && x("egalClement", 202706, "Clément").p === 2,
    "🌑 égalité de points et de victoires : la moins bonne perf cumulée (Clément) est le dernier, et lui seul est doublé (" + JSON.stringify(cu("egalClement")) + ")");
  ok(avantJuin("egalDevlin").join() === "Devlin" && x("egalDevlin", 202706, "Devlin").mult === 2 && x("egalDevlin", 202706, "Clément").mult === 1 && x("egalDevlin", 202706, "Devlin").p === 4 && x("egalDevlin", 202706, "Clément").p === 0,
    "🌑 égalité inversée : Devlin est le dernier, doublé (3e : 2 × 2 = 4) ; Clément, dernier du mois, reste à 0");
  // ---- avril
  const av = mois("premier", 202704);
  ok(textes.pgAvril === "mille", "💍 avril 2027 : le piège est « L'œil de l'archer elfe » (id mille)");
  ok(x("premier", 202704, "Kévin").bonus === 2 && x("premier", 202704, "Kévin").p === 4 + 2, "🏹 avril sans Turbo : Kévin bat le S&P 500 → 🎯 +2 (4 de place + 2 = " + x("premier", 202704, "Kévin").p + ")");
  ok(x("premier", 202704, "Théo").bonus === 2 && x("premier", 202704, "Théo").carte === "turbo:2" && x("premier", 202704, "Théo").p === 6 + 4, "🏹 avril avec Turbo : 🎯 +2 et Turbo +2 = +4 (6 + 4 = " + x("premier", 202704, "Théo").p + ")");
  ok(x("premier", 202701, "Théo").bonus === 1 && x("premier", 202701, "Théo").carte === "turbo:2", "🎯 hors avril, inchangé : janvier, 🎯 +1 et Turbo +2 = +3");
  ok(av.l.find(z => z.nom === "Devlin").bonus === 0, "🏹 avril : sous le S&P 500, pas de 🎯 (Devlin 0)");
  ok(av.l.map(z => z.nom).join() === "Théo,Kévin,Devlin,Clément" && av.l.every((z, i) => z.rg === i + 1), "💍 avril : les places se jouent sur avril seul (plus de cumul avec mars)");
  ok(/2 points au lieu de 1/.test(textes.avril.txt) && /\+4/.test(textes.avril.txt) && textes.avril.nom === "L'œil de l'archer elfe", "🏹 texte : « " + textes.avril.ico + " " + textes.avril.nom + " : " + textes.avril.txt + " »");
  ok(/\+4/.test(textes.turbo), "🚀 la carte Turbo dit +4 les mois où le 🎯 vaut 2 : « " + textes.turbo + " »");
  // ---- mai
  ok(textes.mai.nom === "La forêt endormie" && textes.mai.id === "chaleur" && /Turbo interdit/.test(textes.mai.txt), "🌿 mai : « " + textes.mai.nom + " », " + textes.mai.txt);
  ok(x("premier", 202705, "Kévin").carte === "turbo:0:interdite", "🌿 mai : le Turbo de Kévin reste interdit (sans effet)");
  // ---- février
  ok(textes.fev.txt === "À moins de 0,2 point d'écart avec le pilote juste devant toi (ex. 3,1 % et 3,2 %), vous partagez la même place et les mêmes points.", "🚪 février, texte : « " + textes.fev.txt + " »");
  // ---- juin (textes) et règles de l'appli
  ok(/au moins 2/.test(textes.juin.txt) && /4 × 2 = 8/.test(textes.juin.txt) && /au moins 2/.test(textes.eclipse), "🌑 textes du Côté obscur (mois spécial et annonce de l'éclipse) : « " + textes.juin.txt + " »");
  const rg = textes.regles;
  ok(/L'œil de l'archer elfe/.test(rg) && /La forêt endormie/.test(rg) && /3,1 % et 3,2 %/.test(rg) && /2 points de place au moins/.test(rg), "📖 les règles de l'appli montrent les nouveaux textes");
  ok(!/aller et retour/i.test(rg) && !/graines sacrées/i.test(rg) && !/deux mois cumulés/.test(rg), "📖 plus aucune trace d'« Un aller et retour » ni des « graines sacrées » dans les règles");
  // ---- serveur = appli
  if (!fs.existsSync(path.join(AS, "versus/PodiumCommun.js"))) ok(false, "serveur : versus/PodiumCommun.js introuvable dans " + AS + " (APP_SCRIPTS=…)");
  else {
    const diff = Object.keys(SCENES).filter(n => JSON.stringify(proj(serveur(SCENES[n]))) !== JSON.stringify(R[n].c));
    ok(!diff.length, "serveur (" + AS + "/versus/PodiumCommun.js) = appli, au point près, sur les " + Object.keys(SCENES).length + " scènes" + (diff.length ? " (écart : " + diff.join(", ") + ")" : ""));
  }
  process.exit(ko.length ? 1 : 0);
})();
