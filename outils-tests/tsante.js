/* Test v20.36 · « Santé des Moi » (admin) : bouton dans Réglages › Relevés automatiques ; une ligne par joueur, jamais un montant.
   Lancer depuis la racine, serveur local ouvert (python3 -m http.server 8771). Fausses données uniquement. */
const { chromium } = require("playwright");
const SANTE = { ok: true, rouge: 1, message: "🔴 1 joueur(s) à regarder (photo attendue le 24/11)", joueurs: [
  { nom: "Théo", texte: "✅ dernière photo le 24/11 · ✅ relevé de fin de mois prêt (lu par le Versus)", rouge: false },
  { nom: "Devlin", texte: "🔴 dernière photo le 20/11 (attendue le 24/11 : jour férié ? sinon les photos ne tournent plus) · ✅ relevé de fin de mois prêt", rouge: true },
  { nom: "Kévin", texte: "⏸️ dernière photo le 31/10 (photos pas encore lancées, normal) · ✅ relevé de fin de mois prêt (lu par le Versus)", rouge: false }] };
const versus = sess => ({ ok: true, version: 84, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: [{ nom: "Théo", rows: [] }, { nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, heure: 19, personnes: ["Théo", "Devlin"] }, lignes: {}, premierMillion: null,
  session: sess, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [], envois = [];
    p.on("pageerror", e => err.push(e.message));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); envois.push(c.action);
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "santeMoi" ? SANTE : versus({ role: "admin" })) }); });
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(3000);
    await p.evaluate(() => { document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()); ouvrirReglages("regl-liaison"); });
    await p.waitForTimeout(500);
    const vu = await p.evaluate(() => { const x = document.querySelector("#liaison-sante"); return !!x && x.offsetParent !== null; });
    if (vu) { await p.evaluate(() => document.querySelector("#liaison-sante").click()); await p.waitForTimeout(800); }
    const r = await p.evaluate(() => ({ t: document.querySelector("#liaison-res").innerText, rouges: document.querySelectorAll("#liaison-res .sante.rouge").length,
      deb: [...document.querySelectorAll("#liaison-res *")].some(x => x.getBoundingClientRect().right > innerWidth + 1) }));
    await p.locator("#regl-liaison").screenshot({ path: "/tmp/sante-" + (sombre ? "sombre" : "clair") + ".png" });
    const tag = sombre ? " (sombre)" : " (clair)";
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(vu, "admin : le bouton « 🩺 Santé des Moi » est visible" + tag);
    ok(envois.includes("santeMoi") && /joueur\(s\) à regarder/.test(r.t) && /Théo[\s\S]*24\/11[\s\S]*Devlin[\s\S]*Kévin/.test(r.t) && r.rouges === 1, "une ligne par joueur, Devlin en rouge" + tag);
    ok(!/\d[\d\s ]*€/.test(r.t) && !r.deb, "aucun montant, rien ne déborde à 390 px" + tag);
    await ctx.close();
  }
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage();
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(versus({ role: "perso", nom: "Devlin" })) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(3000);
    await p.evaluate(() => ouvrirReglages()); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector("#regl-liaison").hidden), "joueur (pas admin) : la rubrique et le bouton restent cachés");
    await ctx.close(); }
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
