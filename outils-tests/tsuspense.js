/* Test v20.30 · Suspense : tant qu'un mois n'est pas complet, aucun de ses résultats ne se voit (ni %, ni meilleur/pire, ni places).
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tsuspense.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. Les rendements de novembre sont
   des valeurs « signature » (7,31 %, 6,42 %, 5,53 %, 4,64 %) qu'on cherche dans tout l'écran. */
const { chromium } = require("playwright");
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
const vide = k => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", [null, null, null, null, null, null, null, null], [0, 0, 0, null, 0].concat(Array(20).fill(0))];
const SIG = { "Théo": 0.0731, "Kévin": 0.0642, "Clément": 0.0553, "Devlin": 0.0464 };
function fausses(complet) {
  const P = (nom, i) => ({ nom, rows: [ligne(202609, 1000 + i, 0.011 + i / 1000), ligne(202610, 1010 + i, 0.012 + i / 1000),
    nom === "Devlin" && !complet ? vide(202611) : ligne(202611, 1100 + i, SIG[nom])] });
  return { ok: true, version: 75, genere: "2026-12-01T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(P),
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: [202609, 202610, 202611].map(k => [k, 0.005, 0.006, 0.002]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {},
    mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function parcourir(b, complet, quand) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date(quand || "2026-12-01T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(complet)) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.tuto1", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.waitForTimeout(2000);
  const textes = [];
  for (const v of ["classement", "mois", "fiche", "trophees"]) {
    await p.evaluate(v => { try { ETAT.fiche = "Théo"; montrerVue(v); } catch (e) { } }, v);
    await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelectorAll("details").forEach(d => { d.open = true; }));
    textes.push(v + " » " + await p.evaluate(() => document.body.innerText));
  }
  const etat = await p.evaluate(() => ({ attente: D.attenteMois, brut: D_BRUT && D_BRUT.personnes[0].rows[2][3][3], champ: (() => { const v = verdictMois(0); return v ? { k: v.k, complet: v.complet, du: v.du.length } : null; })() }));
  await ctx.close();
  return { texte: textes.join("\n"), err, etat };
}
(async () => {
  const b = await chromium.launch(), inc = await parcourir(b, false), comp = await parcourir(b, true), tard = await parcourir(b, false, "2026-12-09T10:00:00"); await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const sig = t => ["7,3 %", "6,4 %", "5,5 %", "4,6 %", "7,31", "6,42", "5,53", "4,64"].filter(s => t.includes(s));
  ok(!inc.err.length && !comp.err.length, "0 erreur JS " + JSON.stringify(inc.err.concat(comp.err)));
  ok(!sig(inc.texte).length, "mois incomplet (Devlin manque) : aucun % de novembre visible nulle part (classement, Mois, fiche, trophées) " + JSON.stringify(sig(inc.texte)));
  ok(!/meilleur mois pour|plus dur pour/.test(inc.texte), "mois incomplet : pas de « meilleur mois pour / plus dur pour »");
  ok(/il manque\s*Devlin|Devlin[^\n]*relevé à saisir/.test(inc.texte), "mois incomplet : on dit seulement qu'on attend Devlin");
  ok(inc.etat.attente && inc.etat.attente.k === 202611 && JSON.stringify(inc.etat.attente.manquent) === '["Devlin"]' && inc.etat.brut === 0.0731, "données : novembre voilé, copie brute intacte (saisie, journal, Moi)");
  ok(inc.etat.champ && inc.etat.champ.k === 202611 && !inc.etat.champ.complet && !inc.etat.champ.du, "verdict de novembre « en attente », sans aucun résultat (novembre ne compte pas au championnat : saison en janvier)");
  ok(sig(comp.texte).length >= 2, "témoin : mois complet, les % de novembre apparaissent " + JSON.stringify(sig(comp.texte)));
  ok(!comp.etat.attente, "témoin : mois complet, rien n'est voilé");
  ok(!tard.err.length && !tard.etat.attente && sig(tard.texte).length >= 2, "délai de 7 jours passé (9/12) : novembre se dévoile sans Devlin " + JSON.stringify(sig(tard.texte)));
  ok(/Pas de relevé pour\s*Devlin/.test(tard.texte) || tard.etat.champ && tard.etat.champ.complet, "délai passé : le verdict de novembre est rendu (Devlin noté sans relevé)");
  process.exit(ko.length ? 1 : 0);
})();
