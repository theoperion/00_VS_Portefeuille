/* Test v20.36 · « 📋 État des relevés » (admin, ex « Santé des Moi » + « Tester ») : bouton dans Réglages › Relevés automatiques ;
   une ligne par joueur avec ✅ / ⏳ / 🔴 en tête, la durée et « (gardé 5 min) » si le résultat vient du cache ; jamais un montant.
   Lancer depuis la racine, serveur local ouvert (python3 -m http.server 8771, ou PORT=…). Captures dans CAPTURES (défaut /tmp). Fausses données uniquement. */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || "/tmp";
const SANTE = { ok: true, rouge: 1, ms: 3240, message: "🔴 1 joueur(s) à regarder (photo attendue le 24/11)", joueurs: [
  { nom: "Théo", etat: "ok", enveloppes: ["PEA", "AV"], texte: "✅ dernière photo le 24/11 · ✅ relevé de fin de mois prêt (lu par le Versus : PEA, AV) · ✅ aucun euro dans Data Théo", rouge: false },
  { nom: "Devlin", etat: "rouge", enveloppes: ["PEA"], texte: "🔴 dernière photo le 20/11 (attendue le 24/11 : jour férié ? sinon les photos ne tournent plus) · ✅ relevé de fin de mois prêt (lu par le Versus : PEA)", rouge: true },
  { nom: "Clément", etat: "attente", enveloppes: [], texte: "⏳ son fichier doit envoyer lui-même son relevé · aucun envoi reçu depuis le 26/11 : on saura s'il marche au relevé de fin de mois (sinon saisie à la main)", rouge: false },
  { nom: "Kévin", etat: "ok", enveloppes: ["PEA", "AV"], texte: "⏸️ dernière photo le 31/10 (photos pas encore lancées, normal) · ✅ relevé de fin de mois prêt (lu par le Versus : PEA, AV)", rouge: false }] };
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
      const deja = envois.filter(a => a === "santeMoi").length > 1;   // 2e appui : le serveur répond depuis son cache
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "santeMoi" ? Object.assign({}, SANTE, deja ? { cache: true, ms: 40 } : {}) : versus({ role: "admin" })) }); });
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000);
    await p.evaluate(() => { document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()); ouvrirReglages("regl-liaison"); });
    await p.waitForTimeout(500);
    const bt = await p.evaluate(() => { const x = document.querySelector("#liaison-sante"); return { vu: !!x && x.offsetParent !== null, lib: x ? x.textContent.trim() : "",
      aide: x ? x.closest(".btn-row").nextElementSibling.textContent : "", ancien: !!document.querySelector("#liaison-test"),
      boutons: [...document.querySelectorAll("#regl-liaison button")].map(y => y.textContent.trim()) }; });
    const lire = () => p.evaluate(() => { const L = [...document.querySelectorAll("#liaison-res .sante")];
      return { t: document.querySelector("#liaison-res").innerText, n: L.length, ico: L.map(x => x.querySelector(".sante-ico").textContent), noms: L.map(x => x.querySelector("b").textContent),
        hauteurs: L.map(x => x.querySelector("b").getBoundingClientRect().top - x.querySelector(".sante-ico").getBoundingClientRect().top),
        rouges: document.querySelectorAll("#liaison-res .sante.rouge").length,
        deb: [...document.querySelectorAll("#liaison-res *")].some(x => x.getBoundingClientRect().right > innerWidth + 1) || document.documentElement.scrollWidth > innerWidth + 1 }; });
    if (bt.vu) { await p.evaluate(() => document.querySelector("#liaison-sante").click()); await p.waitForTimeout(800); }
    const r = await lire();
    const tag = sombre ? " (sombre)" : " (clair)";
    await p.locator("#regl-liaison").screenshot({ path: CAP + "/releves-" + (sombre ? "sombre" : "clair") + ".png" });
    if (bt.vu) { await p.evaluate(() => document.querySelector("#liaison-sante").click()); await p.waitForTimeout(800); }
    const r2 = await lire();
    if (sombre) await p.locator("#regl-liaison").screenshot({ path: CAP + "/releves-sombre-cache.png" });
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(bt.vu && bt.lib === "📋 État des relevés" && !bt.ancien && !bt.boutons.some(x => /Santé des Moi|^Tester$/.test(x)), "admin : un seul bouton « 📋 État des relevés » (plus de « Santé des Moi » ni de « Tester »)" + tag);
    ok(/relevé de fin de mois arrivera \(photos, relevé prêt, envoi reçu\)\. Rien n'affiche de montant\./.test(bt.aide), "phrase d'aide sous le bouton" + tag);
    ok(envois.includes("santeMoi") && !envois.includes("testerLiaison") && /joueur\(s\) à regarder/.test(r.t) && r.n === 4 && r.noms.join() === "Théo,Devlin,Clément,Kévin" && r.rouges === 1,
      "une ligne par joueur (4), Devlin en rouge, l'ancienne action testerLiaison n'est plus appelée" + tag);
    ok(r.ico.join("") === "✅🔴⏳✅" && r.hauteurs.every(h => Math.abs(h) < 6), "✅ / ⏳ / 🔴 en tête de chaque ligne, sur la même ligne que le nom" + tag);
    ok(/PEA, AV/.test(r.t) && /Durée : 3,2 s/.test(r.t) && !/gardé 5 min/.test(r.t), "enveloppes lues (en nom) et durée affichées, pas de « gardé » au 1er appui" + tag);
    ok(/gardé 5 min/.test(r2.t) && /Durée : moins d'1 s/.test(r2.t) && r2.n === 4, "2e appui (cache du serveur) : « (gardé 5 min) »" + tag);
    ok(!/\d[\d\s ]*€/.test(r.t + r2.t) && !r.deb && !r2.deb, "aucun montant, rien ne déborde à 390 px" + tag);
    await ctx.close();
  }
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage();
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(versus({ role: "perso", nom: "Devlin" })) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForTimeout(3000);
    await p.evaluate(() => ouvrirReglages()); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector("#regl-liaison").hidden), "joueur (pas admin) : la rubrique et le bouton restent cachés");
    await ctx.close(); }
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
