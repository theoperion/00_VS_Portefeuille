/* Test (26/11/2026, Théo) · UN SEUL RÉGLAGE DE QUALITÉ 3D pour tous les circuits (piste.js, « QUALITÉ 3D »).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tqualite.js   (PORT=… pour un autre port)
   Fausses données uniquement (serveur Google intercepté) ; l'appareil est simulé (window.VERSUS_APPAREIL), jamais lu sur un vrai téléphone.
   Vérifie :
   1. le niveau choisi selon l'appareil : bon téléphone → complet (recette waouh de Dune allumée) ; 4 Go, 4 cœurs,
      « réduire les animations », « économie de données », 3D sans carte graphique, petite carte graphique, téléphone qui a ramé il y a moins de 30 jours → léger
      (aucune recette) ; mémoire inconnue sur écran tactile (Firefox Android) : léger par prudence (INCONNU_COMPLET = false), complet si on passe la constante à true ; plus de 30 jours → complet ; le choix des Réglages (Complet / Léger) passe avant l'automatique ;
   2. décidé AVANT la 1re image : le niveau de la vue est celui du montage, et ne bouge plus ;
   3. bascule UNIQUE : images lentes en complet automatique → rien ne change sous les yeux (même recette, même niveau), la vue SUIVANTE est légère, c'est retenu ;
      ensuite jamais de remontée pendant la visite (images redevenues rapides, nouveaux montages) ; avec « Complet » choisi à la main, pas de bascule ;
   4. Noël : aucune recette dans les deux niveaux ;
   5. dans l'appli : Réglages › Décors 3D (Auto / Complet / Léger, textes sans jargon) ; choisir Léger reconstruit la piste du Podium en léger ; pendant une course,
      un choix des Réglages attend la prochaine ouverture de la vue Course ; après une bascule, ni le plein écran ni un simple redessin (rendreVue) ne reconstruisent
      la piste (même piste, même niveau) : seulement le retour sur l'onglet Course ; mémoire du téléphone bloquée : « choix non mémorisé » ; 0 erreur JS. */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html", ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const BON = { memoire: 8, coeurs: 8, gpu: "Adreno (TM) 740", texMax: 8192, tactileEtroit: true, reduit: false, eco: false };
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = () => ({ ok: true, version: 91, genere: "2026-11-26T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202611, 1000, 0.01 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Kévin" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), errs = [];
  /** une page avec piste.js seul ; app = appareil simulé, ls = mémoire du téléphone */
  async function page(app, ls, prudent) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 520 } }), p = await ctx.newPage();
    if (prudent) await p.route("**/piste.js", async r => { const t = await (await r.fetch()).text(); r.fulfill({ contentType: "application/javascript", body: t.replace("const INCONNU_COMPLET = false;", "const INCONNU_COMPLET = true;") }); });
    p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://localhost:" + PORT + "/version.js");   // une page du même site (mémoire du téléphone)
    await p.evaluate(([app, ls]) => { localStorage.clear(); Object.entries(ls || {}).forEach(([k, v]) => localStorage.setItem(k, v)); document.body.innerHTML = '<div id="b" style="width:390px;height:520px;position:relative"></div>'; window.VERSUS_APPAREIL = app; }, [app, ls]);
    await p.addScriptTag({ url: "http://localhost:" + PORT + "/piste.js" });
    return { ctx, p };
  }
  const monter = (p, circuit, cam) => p.evaluate(([c, cam]) => { const b = document.getElementById("b"); if (window.__a) window.__a.detruire(); b.innerHTML = "";
    window.__a = Piste.monter(b, { circuit: c, camera: cam || "helico", effets: true, sansVoitures: cam !== "poursuite", voitures: [{ nom: "A", couleur: "#4C9AFF" }], pts: { A: 1 } });
    return { q: __a.qualite(), w: __a.waouh(), glob: Piste.qualite.niveau() }; }, [circuit, cam]);
  // 1. le niveau selon l'appareil
  const CAS = [["bon téléphone (8 Go, 8 cœurs, Adreno)", BON, null, "complet"], ["4 Go de mémoire", Object.assign({}, BON, { memoire: 4 }), null, "leger"],
    ["4 cœurs", Object.assign({}, BON, { coeurs: 4 }), null, "leger"], ["mémoire inconnue, écran tactile étroit (Firefox Android : léger par prudence)", Object.assign({}, BON, { memoire: undefined }), null, "leger"],
    ["mémoire inconnue, ordinateur", Object.assign({}, BON, { memoire: undefined, tactileEtroit: false }), null, "complet"],
    ["« réduire les animations »", Object.assign({}, BON, { reduit: true }), null, "leger"], ["« économie de données »", Object.assign({}, BON, { eco: true }), null, "leger"],
    ["3D sans carte graphique (SwiftShader)", Object.assign({}, BON, { gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))" }), null, "leger"],
    ["petite carte graphique (textures 2048)", Object.assign({}, BON, { texMax: 2048 }), null, "leger"],
    ["a ramé il y a 3 jours", BON, { "versus.q3dLent": String(Date.now() - 3 * 864e5) }, "leger"], ["a ramé il y a 40 jours", BON, { "versus.q3dLent": String(Date.now() - 40 * 864e5) }, "complet"],
    ["Réglages « Léger » sur un bon téléphone", BON, { "versus.q3d": "leger" }, "leger"], ["Réglages « Complet » sur un téléphone de 3 Go", Object.assign({}, BON, { memoire: 3 }), { "versus.q3d": "complet" }, "complet"]];
  for (const [nom, app, ls, att] of CAS) { const { ctx, p } = await page(app, ls); const r = await monter(p, "silverstone");
    ok(r.q.niveau === att && (att === "complet" ? !!(r.w && r.w.brume && r.w.sol) : r.w === null), nom + " → " + r.q.niveau + (att === "complet" ? " (Dune : recette waouh allumée)" : " (Dune : aucune recette, comme Noël)"));
    await ctx.close(); }
  { const { ctx, p } = await page(Object.assign({}, BON, { memoire: undefined }), null, true); const r = await monter(p, "silverstone");
    ok(r.q.niveau === "complet" && !!r.w, "mémoire inconnue, écran tactile étroit, si on passe INCONNU_COMPLET à true → complet à l'essai"); await ctx.close(); }
  // 2 et 3. décidé avant la 1re image ; bascule unique, jamais sous les yeux, jamais vers le haut
  { const { ctx, p } = await page(BON); const r0 = await monter(p, "silverstone");
    // le téléphone rame : chaque image prend ~45 ms (survol en cours : la caméra bouge, les images sont mesurées)
    await p.evaluate(() => { const raf = window.requestAnimationFrame.bind(window); window.__lent = true; window.requestAnimationFrame = f => raf(t => { if (window.__lent) { const t0 = performance.now(); while (performance.now() - t0 < 45) { /* rame */ } } f(t); }); __a.survol(60000); });
    const vu = []; for (let k = 0; k < 120; k++) { await p.waitForTimeout(500); vu.push(await p.evaluate(() => ({ q: __a.qualite(), w: JSON.stringify(__a.waouh()) }))); if (vu[k].q.descente && k > 8) break; }
    const fin = vu[vu.length - 1], st = await p.evaluate(() => ({ lent: localStorage.getItem("versus.q3dLent"), glob: Piste.qualite.niveau() }));
    ok(r0.q.niveau === "complet" && vu.every(v => v.q.niveau === "complet" && v.w === JSON.stringify(r0.w)), "pendant la vue qui rame : toujours complet, la même recette à chaque instant (rien ne clignote, rien ne saute)");
    ok(fin.q.descente && st.glob === "leger" && !!st.lent, "images lentes (" + fin.q.ips + " images/s) : la VUE SUIVANTE sera légère, retenu sur le téléphone");
    const r1 = await monter(p, "silverstone");
    ok(r1.q.niveau === "leger" && r1.w === null, "vue suivante : légère dès la 1re image (Dune sans recette)");
    await p.evaluate(() => { window.__lent = false; }); await p.waitForTimeout(1500);
    const r2 = await monter(p, "djeddah"), r3 = await monter(p, "silverstone");
    ok(r2.q.niveau === "leger" && r3.q.niveau === "leger" && r3.glob === "leger", "images redevenues rapides, autres circuits : le niveau ne remonte jamais pendant la visite");
    await ctx.close(); }
  { const { ctx, p } = await page(Object.assign({}, BON, { memoire: 3 }), { "versus.q3d": "complet" }); await monter(p, "silverstone");
    await p.evaluate(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = f => raf(t => { const t0 = performance.now(); while (performance.now() - t0 < 45) { } f(t); }); __a.survol(60000); });
    await p.waitForTimeout(12000); const r = await p.evaluate(() => ({ q: __a.qualite(), glob: Piste.qualite.niveau(), lent: localStorage.getItem("versus.q3dLent") }));
    ok(!r.q.descente && r.glob === "complet" && !r.lent, "« Complet » choisi à la main : même si ça rame, pas de bascule (le choix de Théo est respecté)");
    await ctx.close(); }
  // 4. Noël : aucune recette, dans les deux niveaux
  for (const app of [BON, Object.assign({}, BON, { memoire: 2 })]) { const { ctx, p } = await page(app); const r = await monter(p, "abudhabi"), c = await monter(p, "abudhabi", "poursuite");
    ok(r.w === null && c.w === null, "Noël en " + r.q.niveau + " (Visite et course) : aucune recette waouh"); await ctx.close(); }
  // 5. dans l'appli : le réglage, et la reconstruction de la piste au prochain affichage
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage();
    p.on("pageerror", e => errs.push(e.message)); await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      r.fulfill({ contentType: "application/json", body: JSON.stringify(["tresors", "avent", "tickets", "ecurie"].includes(c.action) ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees()) }); });
    await p.addInitScript(app => { window.VERSUS_APPAREIL = app; if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
      ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.aideVisite", "versus.aideVue.visite", "versus.aideVue.poursuite"].forEach(k => localStorage.setItem(k, "1"));
      localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.gpVu.2026", "202612"); localStorage.setItem("versus.etat", JSON.stringify({ podium: "gp", gp2d: "0" })); }, BON);
    await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800);
    const course = () => p.evaluate(async () => { document.querySelectorAll(".revel,.regles,.tuto,.ba,.ecu-rev").forEach(x => x.remove()); ETAT.podium = "gp"; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees();
      await new Promise(r => setTimeout(r, 1200)); document.querySelectorAll(".revel,.ba,.ere-voile").forEach(x => x.remove()); choisirVueGP("visite", saisonCourante() || 2026); await new Promise(r => setTimeout(r, 1200));
      if (GP_INST && GP_INST.api.arreterSurvol) GP_INST.api.arreterSurvol();   // caméra immobile : la machine de test (sans carte graphique) ne doit pas « ramer » ici
      return { type: GP_INST && GP_INST.api.type, q: GP_INST && GP_INST.api.qualite ? GP_INST.api.qualite().niveau : null }; });
    const c1 = await course(); ok(c1.type === "3d" && c1.q === "complet", "Podium (bon téléphone) : la Visite 3D en complet " + JSON.stringify(c1));
    await p.evaluate(() => document.getElementById("btn-reglages").click()); await p.waitForTimeout(400);
    const rg = await p.evaluate(() => ({ puces: [...document.querySelectorAll("[data-q3d]")].map(x => x.textContent + (x.getAttribute("aria-pressed") === "true" ? "*" : "")), info: document.getElementById("q3d-info").textContent,
      note: document.querySelector("[data-q3d]").closest(".champ").querySelector("label").textContent }));
    await p.evaluate(() => { const e = document.querySelector("[data-q3d]"); const s = e.closest("section"); if (s && s.classList.contains("ferme")) s.querySelector("h4").click(); e.scrollIntoView({ block: "center" }); });
    await p.waitForTimeout(300); await p.screenshot({ path: (process.env.CAPTURES || "/tmp") + "/reglage-decors-3d.png" });
    const JARGON = /cœur|Go\b|carte graphique|mémoire|WebGL|texture/i;
    ok(rg.puces.join() === "Auto*,Complet,Léger" && /Sur ce téléphone : complet/.test(rg.info) && /Léger : décor allégé, plus fluide/.test(rg.note) && !JARGON.test(rg.info + rg.note),
      "Réglages › Décors 3D : Auto (coché), Complet, Léger, sans jargon ; « " + rg.info + " » ; « " + rg.note.trim() + " »");
    await p.evaluate(() => document.querySelector('[data-q3d="leger"]').click()); await p.waitForTimeout(1500);
    const c2 = await p.evaluate(() => ({ q: GP_INST.api.qualite().niveau, ls: localStorage.getItem("versus.q3d"), info: document.getElementById("q3d-info").textContent }));
    ok(c2.q === "leger" && c2.ls === "leger" && /Choisi à la main sur ce téléphone\. Touche Auto/.test(c2.info), "choisir « Léger » (rien en cours) : la piste du Podium est reconstruite en léger, sous la feuille des Réglages " + JSON.stringify(c2));
    await p.evaluate(() => { document.querySelector('[data-q3d="auto"]').click(); document.getElementById("fermer-reglages").click(); }); await p.waitForTimeout(1200);
    const c3 = await p.evaluate(() => GP_INST.api.qualite().niveau); ok(c3 === "complet", "revenir sur « Auto » : complet à nouveau sur ce bon téléphone (" + c3 + ")");
    // pendant une course : un choix des Réglages attend la prochaine ouverture de la vue Course
    await p.evaluate(() => { window.__api1 = GP_INST.api; GP_INST.api.jouer({ Théo: 0, Kévin: 0 }, { Théo: 25, Kévin: 24 }, 60000); document.getElementById("btn-reglages").click(); document.querySelector('[data-q3d="leger"]').click(); document.getElementById("fermer-reglages").click(); });
    await p.waitForTimeout(1200);
    const c4 = await p.evaluate(() => ({ meme: GP_INST.api === window.__api1, roule: GP_INST.api.enCours(), q: GP_INST.api.qualite().niveau }));
    ok(c4.meme && c4.roule && c4.q === "complet", "pendant une course, choisir « Léger » : la course continue sur la même piste " + JSON.stringify(c4));
    await p.evaluate(() => { GP_INST.api.placer({ Théo: 25, Kévin: 24 }); allerA("classement"); }); await p.waitForTimeout(500);
    const c5 = await course(); ok(c5.q === "leger", "course finie, retour sur l'onglet Course : la piste est en léger " + JSON.stringify(c5));
    await p.evaluate(() => { document.getElementById("btn-reglages").click(); document.querySelector('[data-q3d="auto"]').click(); document.getElementById("fermer-reglages").click(); allerA("classement"); }); await p.waitForTimeout(500);
    const c6 = await course(); ok(c6.q === "complet", "« Auto » à nouveau, retour sur Course : complet " + JSON.stringify(c6));
    // bascule : jamais reconstruite sur un simple redessin ni en plein écran, seulement au retour sur l'onglet Course
    await p.evaluate(() => { const raf = window.requestAnimationFrame.bind(window); window.__lent = true; window.requestAnimationFrame = f => raf(t => { if (window.__lent) { const t0 = performance.now(); while (performance.now() - t0 < 45) { } } f(t); }); GP_INST.api.survol(60000); window.__api0 = GP_INST.api; });
    await p.waitForFunction(() => GP_INST.api.qualite().descente, null, { timeout: 90000 }).catch(() => null);
    await p.evaluate(() => { window.__lent = false; GP_INST.api.arreterSurvol(); });
    const d0 = await p.evaluate(() => ({ meme: GP_INST.api === window.__api0, q: GP_INST.api.qualite() }));
    ok(d0.meme && d0.q.niveau === "complet" && d0.q.descente, "le téléphone a saccadé : la piste à l'écran reste la même (complet), la baisse est prévue " + JSON.stringify(d0.q));
    await p.evaluate(() => rendreVue(vueActive())); await p.waitForTimeout(800);
    const d1 = await p.evaluate(() => ({ meme: GP_INST.api === window.__api0, q: GP_INST.api.qualite().niveau }));
    ok(d1.meme && d1.q === "complet", "après la baisse, un simple redessin (rendreVue) : même piste, même niveau " + JSON.stringify(d1));
    await p.evaluate(() => ouvrirPleinGP(saisonCourante() || 2026)); await p.waitForTimeout(1200); await p.evaluate(() => rendreVue(vueActive())); await p.waitForTimeout(800);
    const d2 = await p.evaluate(() => ({ plein: !!GP_PLEIN, meme: GP_INST.api === window.__api0, q: GP_INST.api.qualite().niveau }));
    await p.evaluate(() => fermerPleinGP()); await p.waitForTimeout(800); await p.evaluate(() => rendreVue(vueActive())); await p.waitForTimeout(800);
    const d3 = await p.evaluate(() => ({ meme: GP_INST.api === window.__api0, q: GP_INST.api.qualite().niveau }));
    ok(d2.plein && d2.meme && d2.q === "complet" && d3.meme && d3.q === "complet", "plein écran ouvert puis fermé, redessins : toujours la même piste, même niveau " + JSON.stringify([d2, d3]));
    await p.evaluate(() => allerA("classement")); await p.waitForTimeout(600);
    const d4 = await course(); ok(d4.q === "leger", "retour sur l'onglet Course : la piste est reconstruite en léger " + JSON.stringify(d4));
    await ctx.close(); }
  // mémoire du téléphone bloquée : le choix vaut pour la visite, avec un petit message
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage();
    p.on("pageerror", e => errs.push(e.message));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(donnees()) }));
    await p.addInitScript(() => { localStorage.setItem("versus.q3dAffichette", "1");   // avant le blocage (l'affichette des décors 3D, déjà vue)
      const s0 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^versus\.q3d/.test(k)) throw new Error("bloqué"); return s0.call(this, k, v); };
      localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(600);
    const r = await p.evaluate(() => { document.getElementById("btn-reglages").click(); document.querySelector('[data-q3d="leger"]').click(); return { info: document.getElementById("q3d-info").textContent, choix: Piste.qualite.choix() }; });
    ok(/Choix non mémorisé sur ce téléphone/.test(r.info) && r.choix === "leger", "mémoire bloquée : « Léger » vaut pour cette visite, avec « choix non mémorisé sur ce téléphone » " + JSON.stringify(r)); await ctx.close(); }
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 3)));
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
