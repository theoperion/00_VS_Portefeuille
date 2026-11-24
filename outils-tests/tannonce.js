/* Test v20.24 · « simple joueur, sans admin » : que voit-on des règles 2027 selon la date ?
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tannonce.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. */
const { chromium } = require("playwright");
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
function fausses(etapes) {   // relevés inventés de janvier à novembre 2026
  const rows = i => { const l = []; for (let m = 1; m <= 11; m++) { const v = 10000 + 300 * m + 50 * i * m; l.push([202600 + m, "2026-" + String(m).padStart(2, "0") + "-28", [v, v * 0.6, v * 0.4, 0, 0, 0, 0, 0], Array(25).fill(0).map((_, j) => j === 1 ? v : 0)]); } return l; };
  return { ok: true, genere: "2026-11-24T10:00:00", majTexte: "Dernier relevé : novembre 2026", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map((n, i) => ({ nom: n, rows: rows(i) })),
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: Array.from({ length: 11 }, (_, m) => [202601 + m, 0.01, 0.012, 0.005]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 5, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: etapes || {},
    liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
    session: { role: "perso", nom: "Kévin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
}
// mots des règles annoncées le 1er janvier : jamais avant
const CACHES = [/rattrapage/i, /éclipse/i, /côté obscur/i, /bonus d'équipe/i, /🤝/, /La série/i, /🔥 Série/, /Finale/, /Rassemblement des héros/i, /Les niveaux/i, /🎴/];
// règles à jouer en janvier : visibles dès le 20 décembre
const JOUER = [/Défi du mois/, /Pronostic/i, /Rival/, /Atout du circuit/i, /pièges/i];
const ADMIN = [/admin/i, /Aperçu/, /Prochainement/, /Circuits 2027/, /Voir décembre/, /Tout afficher/];
const CAS = [
  { d: "2026-12-19T12:00:00", jouer: false, caches: true },
  { d: "2026-12-20T09:00:00", jouer: true, caches: true },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true },
  { d: "2027-01-01T10:00:00", jouer: true, caches: false },
  { d: "2027-01-02T10:00:00", jouer: true, caches: false },
  // dates réglées à janvier par l'admin (ou ramenées à janvier par le serveur) : toujours annoncées le 1/1 seulement
  { d: "2026-12-20T09:00:00", jouer: true, caches: true, neuf: true, etapes: { pioche: 202701, monaco: 202701, circuits: 202701, equipe: 202701, serie: 202701 } },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true, etapes: { pioche: 202701, monaco: 202701, circuits: 202701, equipe: 202701, serie: 202701 } }
];
(async () => {
  const b = await chromium.launch(); let nok = 0;
  // un seul téléphone pour toutes les dates : comme un vrai joueur qui revient jour après jour
  let ctx = null;
  for (const c of CAS) {
    if (!ctx || c.neuf) { if (ctx) await ctx.close(); ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }); }
    const p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date(c.d));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(c.etapes)) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:8771/index.html");
    await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
    await p.waitForTimeout(2500);
    const pop = await p.evaluate(() => { const t = document.querySelector(".tuto"); const s = t ? t.innerText : ""; if (t) t.remove(); return s; });
    const textes = await p.evaluate(async () => {
      const out = [document.body.innerText];
      for (const y of [2026, 2027]) { try { choisirSaison(y); ETAT.podium = "stand"; garder(); allerA("trophees"); rendreTrophees(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); out.push(document.body.innerText); }
      try { ouvrirRegles(); out.push(document.querySelector(".regles").innerText); document.querySelector(".regles").remove(); } catch (e) { out.push("ERREUR règles " + e.message); }
      return out.join("\n");
    });
    const tout = pop + "\n" + textes, ko = [];
    if (err.length) ko.push("erreurs JS : " + err.join(" | "));
    if (c.caches) CACHES.forEach(r => { const m = tout.match(r); if (m) ko.push("visible trop tôt : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    ADMIN.forEach(r => { const m = tout.match(r); if (m) ko.push("trace d'admin : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.jouer) JOUER.forEach(r => { if (!r.test(tout)) ko.push("absent alors qu'attendu : " + r); });
    else JOUER.slice(0, 3).forEach(r => { if (r.test(tout)) ko.push("visible trop tôt : " + r); });
    if (c.d.startsWith("2026-12-20") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 20/12");
    if (c.d.startsWith("2026-12-20") && !/pronostic/i.test(pop)) ko.push("le 20/12, la fenêtre ne présente pas le pronostic");
    if (c.d.startsWith("2027-01-01") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 1/1");
    if (c.d.startsWith("2027-01-01") && (/pronostic|défi du mois|rival/i.test(pop) || !/rattrapage/i.test(pop))) ko.push("le 1/1, la fenêtre devrait montrer seulement les règles restantes");
    if (c.d.startsWith("2027-01-02") && pop) ko.push("le 2/1, la fenêtre revient alors que tout a été vu");
    console.log((ko.length ? "NON " : "OUI ") + c.d.slice(0, 10) + (c.etapes ? " (dates réglées)" : "") + (pop ? "  · fenêtre : " + pop.replace(/\s+/g, " ").slice(0, 140) : ""));
    ko.forEach(k => console.log("     ✗ " + k)); nok += ko.length;
    await p.close();
  }
  await b.close(); process.exit(nok ? 1 : 0);
})();
