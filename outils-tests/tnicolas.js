/* Test v20.25 · 5e pilote et règle du « premier mois complet ».
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tnicolas.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. */
const { chromium } = require("playwright");
// une ligne de relevé : [clé, date, saisies (8), calculs (25)] ; calculs du portefeuille (env 0) : versé, valeur, gain, rendement, cumul
const ligne = (k, val, r, verse) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [verse || 0, val, 0, 0, 0, 0, 0, 0],
  [verse || 0, val, 0, r, 0].concat(Array(20).fill(0))];
function joueur(nom, i, debut) {
  const l = []; for (let k of [202609, 202610, 202611, 202612, 202701]) { if (k < debut) continue;
    const r = k === debut ? 0.30 : 0.01 * ((i + k) % 5) - 0.015;   // mois d'ouverture : +30 % (faux, pour voir s'il fausse le jeu)
    l.push(ligne(k, 1000 + 100 * i, r, k === debut ? 1000 : 0)); } return { nom, rows: l };
}
function fausses(avecNicolas) {
  const p = [joueur("Théo", 0, 202609), joueur("Kévin", 1, 202609), joueur("Clément", 2, 202609), joueur("Devlin", 3, 202609)];
  p[1].rows = p[1].rows.filter(l => l[0] !== 202612);   // Kévin oublie son relevé de décembre : il doit quand même jouer janvier
  if (avecNicolas) p.push(joueur("Nicolas", 4, 202612));   // PEA ouvert et alimenté en cours de décembre
  return { ok: true, genere: "2027-02-05T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes: p,
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: [202609, 202610, 202611, 202612, 202701].map(k => [k, 0.005, 0.006, 0.002]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Kévin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
}
async function mesurer(b, avecNicolas) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2027-02-05T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(avecNicolas)) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.tuto1", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const v = k => { const x = verdictMois(0, k); return x ? { du: x.du.map(z => z.nom), complet: x.complet, manquent: x.manquent || [] } : null; };
    const ch = championnat(2026), s1 = championnat(2027), jan = s1.mois.find(z => z.k === 202701);
    return { dec: v(202612), jan: v(202701), chauffe: ch.classement, chauffePts: Object.fromEntries(ch.classement.map(n => [n, ch.tot[n].pts])),
      janPts: jan ? Object.fromEntries(jan.l.map(z => [z.nom, z.base])) : null, couleur: couleur("Nicolas"), portrait: !!portraitsDe("Nicolas"),
      vicDec: (() => { const v = victoires(0, 202612, 202611); return v.Nicolas ? v.Nicolas.victoires : 0; })(), duelDec: (duel(0, "Nicolas", "Théo", 202611, 202612) || {}).n, bareme: baremeJ().join("·") };
  });
  await ctx.close(); return { m, err };
}
(async () => {
  const b = await chromium.launch(), sans = await mesurer(b, false), avec = await mesurer(b, true); await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  ok(!sans.err.length && !avec.err.length, "0 erreur JS " + JSON.stringify(sans.err.concat(avec.err)));
  ok(avec.m.dec && !avec.m.dec.du.includes("Nicolas") && !avec.m.dec.manquent.includes("Nicolas") && avec.m.dec.manquent.join() === "Kévin", "décembre (mois d'ouverture) : Nicolas ne compte pas et ne bloque pas le mois");
  ok(JSON.stringify(avec.m.chauffePts) === JSON.stringify(sans.m.chauffePts), "tour de chauffe : mêmes points pour les 4 autres qu'avant son arrivée");
  ok(avec.m.jan && avec.m.jan.complet && avec.m.jan.du.includes("Nicolas") && avec.m.jan.du.length === 5, "janvier (premier mois complet) : Nicolas entre au classement");
  ok(avec.m.janPts && Object.values(avec.m.janPts).sort((a, b) => b - a).join() === "6,4,2,1,0", "janvier à 5 : barème 6·4·2·1·0 " + JSON.stringify(avec.m.janPts));
  ok(avec.m.couleur === "var(--p4)" && avec.m.portrait, "couleur --p4 et portrait prêts");
  ok(avec.m.jan.du.includes("Kévin"), "relevé oublié en décembre : Kévin joue quand même janvier");
  ok(avec.m.vicDec === 0 && !avec.m.duelDec, "mois d'ouverture hors victoires et duels");
  ok(sans.m.bareme === "6·4·2·0", "barème affiché à 4 avant l'arrivée : " + sans.m.bareme);
  process.exit(ko.length ? 1 : 0);
})();
