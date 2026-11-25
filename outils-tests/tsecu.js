/* Test v20.40 · double sécurité des aperçus admin : un joueur (pas admin) ne voit jamais la barre admin ni un aperçu,
   aux dates clés 3/12, 20/12, 31/12, 1/1, même en forçant (réglages copiés d'un appareil admin, appels directs).
   Témoin : l'admin, mode admin allumé, les voit. Fausses données ; serveur local ouvert (python3 -m http.server 8771). */
const { chromium } = require("playwright");
const fausses = session => ({ ok: true, version: 84, genere: "2026-12-01T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function voir(b, session, quand, force) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(session)) }));
  await p.addInitScript(f => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1");
    if (f) { localStorage.setItem("versus.apercuSaison", "1"); sessionStorage.setItem("versus.adminOn", "1"); } }, force);
  await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => { try { montrerVue("trophees"); } catch (e) { } await new Promise(r => setTimeout(r, 600));
    const o = { barre: !!document.querySelector(".barre-admin"), saison: typeof apercuSaison === "function" && apercuSaison() };
    try { ouvrirCircuits2027(); } catch (e) { } await new Promise(r => setTimeout(r, 300)); o.circuits = !!document.querySelector(".circ-gal");
    document.querySelectorAll(".circ-gal").forEach(x => x.remove());
    try { apercuAccessoires(); } catch (e) { } await new Promise(r => setTimeout(r, 200)); o.accessoires = !!document.querySelector(".acc-gal"); document.querySelectorAll(".acc-gal").forEach(x => x.remove());   // v20.59 : planche des accessoires du mois
    try { apercuFeteChauffe(); } catch (e) { } try { ouvrirApercuTresor(); } catch (e) { } await new Promise(r => setTimeout(r, 300));
    o.tresor = typeof TRESOR_APERCU !== "undefined" && !!TRESOR_APERCU; o.texte = /aperçu admin|🛠️ Admin/.test(document.body.innerText); return o; });
  await ctx.close(); return Object.assign(r, { err });
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const q of ["2026-12-03T10:00:00", "2026-12-20T10:00:00", "2026-12-31T22:00:00", "2027-01-01T10:00:00"]) {
    const j = await voir(b, { role: "perso", nom: "Clément" }, q, true), d = q.slice(0, 10);
    ok(!j.err.length, d + " · 0 erreur JS " + JSON.stringify(j.err));
    ok(!j.barre && !j.saison && !j.circuits && !j.tresor && !j.texte && !j.accessoires, d + " · joueur, même en forçant : ni barre admin, ni saison simulée, ni Circuits 2027, ni aperçu du trésor, ni planche des accessoires " + JSON.stringify(j));
  }
  const a = await voir(b, { role: "admin" }, "2026-11-25T10:00:00", true);
  ok(!a.err.length && a.barre && a.circuits && a.accessoires, "témoin : l'admin, mode admin allumé, voit la barre, ouvre Circuits 2027 et la planche des accessoires " + JSON.stringify(a));
  const c = await voir(b, { role: "admin" }, "2026-11-25T10:00:00", false);
  ok(!c.barre && !c.circuits && !c.accessoires, "admin, mode admin éteint : rien (comme un joueur) " + JSON.stringify(c));
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
