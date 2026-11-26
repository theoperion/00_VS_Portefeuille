/* Mesure · 🎲 vitesse d'affichage des mini-jeux du mois (js/9-minijeux.js), côté joueur et aperçu admin.
   Fausses données uniquement (textes inventés de tmj-commun.js) ; le serveur Google est intercepté avec un DÉLAI réaliste
   d'Apps Script (DELAI ms, 2000 par défaut) et le processeur est ralenti ×4 (téléphone moyen).
   Serveur local : python3 -m http.server 8771 &  puis node outils-tests/tmj-vitesse.js (PORT=…, DELAI=…).
   Contrôles oui/non : la carte du jour s'affiche sans attendre le serveur quand l'appli a déjà vu l'état du jour (avant la réponse du classement),
   la page Course ouverte après le démarrage montre la carte tout de suite, l'aperçu admin réutilise ce qu'il a déjà chargé. */
const { chromium } = require("playwright");
const { ETAT, MJ_ETAT, compteur, fin, donnees: donneesJ } = require("./tmj-commun.js");
const PORT = process.env.PORT || 8771, DELAI = +(process.env.DELAI || 2000), CPU = +(process.env.CPU || 4);
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = session => ({ ok: true, version: 88, genere: "2027-01-12T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const APERCU = c => ({ ok: true, mois: c.mois, univers: "silverstone", type: "choix", contenu: { ico: "🏜️", titre: "Jeu d'essai", regle: ["Règle inventée."] }, recompense: {}, apercu: true, jour: c.jour, fin: 31,
  etat: ETAT({ jour: c.jour, fait: !!c.geste }), message: c.geste ? "Message inventé." : "", g: c.geste || undefined });

async function ouvrir(b, o) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), req = [], err = [];
  p.on("pageerror", e => err.push(e.message));
  const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await p.clock.setFixedTime(new Date(o.quand || "2027-01-05T10:00:00"));
  await p.route("https://script.google.com/**", async r => { const c = JSON.parse(r.request().postData() || "{}"), t0 = Date.now(); req.push({ q: c.action === "mj" ? "mj:" + c.op + (c.op === "apercu" ? ":" + c.mois + ":" + c.jour : "") : c.action });
    await new Promise(x => setTimeout(x, o.delai ? o.delai(c) : DELAI));
    const rep = o.rep && o.rep(c) ? o.rep(c) : o.jusqua && c.action === "data" ? donneesJ(o.session, o.jusqua) : c.action === "mj" ? (c.op === "apercu" ? APERCU(c) : MJ_ETAT(202701, ETAT({ fait: false }))) : c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(rep) }).catch(() => {}); });
  if (!o.ctx) await p.addInitScript(([adminOn, vue]) => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1"); for (let m = 1; m <= 12; m++) localStorage.setItem("versus.piegeMois." + (202700 + m), "1");   // affichette du 1er du mois (tpiege) déjà vue
   
    localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.gpVu.2027", "202712"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.chauffe1", "1");
    for (let m = 202701; m <= 202712; m++) { localStorage.setItem("versus.mjRev." + m, "1"); localStorage.setItem("versus.mjFin." + m, "1"); }
    localStorage.setItem("versus.etat", JSON.stringify({ podium: "gp", ouverture: vue })); if (adminOn) sessionStorage.setItem("versus.adminOn", "1"); }, [!!o.adminOn, o.vue || "trophees"]);
  // chronomètre : le moment où la carte du mini-jeu apparaît (depuis le début du chargement de la page)
  await p.addInitScript(() => { window.__mj = null; window.__t0 = performance.now(); const t = () => { if (!window.__mj && document.querySelector(".mj-carte:not(.mj-ap)")) { window.__mj = performance.now(); window.__mjSrc = typeof SOURCE !== "undefined" ? SOURCE : ""; } if (!window.__mj) requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await p.goto("http://localhost:" + PORT + "/index.html" + (o.hash || ""));
  return { ctx, p, req, err };
}
const attendre = (p, f, ms) => p.waitForFunction(f, null, { timeout: ms || 20000, polling: 20 }).then(() => true).catch(() => false);
const s = ms => (ms / 1000).toFixed(2) + " s";

(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur(), R = {};
  // 1. joueur, 1re ouverture du jour sur la page Course (appli déjà installée : copie du classement en mémoire, rien du mini-jeu)
  { const o0 = await ouvrir(b, { session: { role: "perso", nom: "Kévin" }, hash: "#trophees" });   // la veille : l'appli a déjà servi
    await attendre(o0.p, () => window.__mj); await o0.p.waitForTimeout(500); await o0.p.evaluate(() => localStorage.removeItem("versus.mjEtat")); await o0.p.close();   // rien du mini-jeu d'aujourd'hui en mémoire
    const { ctx, p, err } = await ouvrir(b, { ctx: o0.ctx, session: { role: "perso", nom: "Kévin" }, hash: "#trophees" });
    await attendre(p, () => window.__mj); await p.waitForTimeout(DELAI + 500); const t1 = await p.evaluate(() => window.__mj - window.__t0);
    // 2. la même personne rouvre l'appli plus tard dans la journée
    await p.close(); const o2 = await ouvrir(b, { ctx, session: { role: "perso", nom: "Kévin" }, hash: "#trophees" });
    await attendre(o2.p, () => window.__mj); const t2 = await o2.p.evaluate(() => window.__mj - window.__t0);
    R.premiere = t1; R.retour = t2;
    console.log("Joueur · 1re ouverture (page Course) : carte du mini-jeu à " + s(t1) + " ; réouverture le même jour : " + s(t2));
    const src = await o2.p.evaluate(() => window.__mjSrc);   // « cache » = l'appli n'avait encore reçu aucune réponse du serveur (le temps restant, c'est le dessin de la page Course)
    ok(!err.length && !o2.err.length && src === "cache", "réouverture le même jour : la carte s'affiche avant toute réponse du serveur (" + s(t2) + ", affichée avec la copie locale : " + src + ")");
    await ctx.close(); }
  // 3. joueur (appli déjà installée, premier passage du jour) qui ouvre l'appli sur le Classement puis touche Podium › Course une fois tout chargé
  { const o1 = await ouvrir(b, { session: { role: "perso", nom: "Kévin" }, hash: "#classement", vue: "classement" });
    await attendre(o1.p, () => typeof SOURCE !== "undefined" && SOURCE === "api"); await o1.p.evaluate(() => localStorage.removeItem("versus.mjEtat")); await o1.p.close();   // rien du mini-jeu d'aujourd'hui en mémoire
    const { ctx, p, req, err } = await ouvrir(b, { ctx: o1.ctx, session: { role: "perso", nom: "Kévin" }, hash: "#classement" });
    await attendre(p, () => typeof SOURCE !== "undefined" && SOURCE === "api"); await p.waitForTimeout(DELAI * 1.5 + 500);
    const t0 = await p.evaluate(() => { window.__mj = null; ETAT.podium = "gp"; GP_ETAPE = null; garder(); allerA("trophees"); const d = performance.now(); const t = () => { if (!window.__mj && document.querySelector(".mj-carte:not(.mj-ap)")) window.__mj = performance.now(); if (!window.__mj) requestAnimationFrame(t); }; t(); return d; });
    await attendre(p, () => window.__mj); const t = (await p.evaluate(() => window.__mj)) - t0; R.course = t;
    console.log("Joueur · toucher « Course » après le démarrage : carte à " + s(t) + " (demandes mj:etat : " + req.filter(x => x.q === "mj:etat").length + ")");
    ok(!err.length && t < 1500, "page Course ouverte après le démarrage : la carte est déjà prête (" + s(t) + ")");
    await ctx.close(); }
  // 4. aperçu admin : ouverture, « jour suivant », un autre mois, puis retour au premier mois (2,5 s de lecture entre deux touchers)
  { const { ctx, p, req, err } = await ouvrir(b, { session: { role: "admin", nom: "Théo" }, adminOn: true, hash: "#trophees", vue: "trophees", quand: "2026-11-25T10:00:00" });
    await attendre(p, () => typeof SOURCE !== "undefined" && SOURCE === "api"); await p.waitForTimeout(DELAI * 1.5 + 3000);   // l'admin regarde la page un instant avant d'ouvrir l'aperçu
    const chrono = async (action, cond) => { if (await p.$(".mj-apercu")) await p.waitForTimeout(2500); const t0 = await p.evaluate(action); await attendre(p, cond); return (await p.evaluate(() => performance.now())) - t0; };
    const pret = () => !!document.querySelector(".mj-apercu .mj-ap-carte .mj-carte") && !document.querySelector(".mj-apercu .mj-ap-attente");
    const a1 = await chrono(() => { apercuMJ(202701); return performance.now(); }, pret);
    const a2 = await chrono(() => { document.querySelector(".mj-apercu [data-mj-j]").click(); return performance.now(); }, () => /jour 2\b/.test((document.querySelector(".mj-apercu .mj-carte .mj-h small") || {}).textContent || "") && !document.querySelector(".mj-apercu .mj-ap-attente"));
    const a3 = await chrono(() => { document.querySelector('.mj-apercu [data-mj-m="202702"]').click(); return performance.now(); }, () => document.querySelector('.mj-apercu [data-mj-m="202702"][aria-pressed="true"]') && !!document.querySelector(".mj-apercu .mj-ap-carte .mj-carte") && !document.querySelector(".mj-apercu .mj-ap-attente"));
    const a4 = await chrono(() => { document.querySelector('.mj-apercu [data-mj-m="202701"]').click(); return performance.now(); }, () => document.querySelector('.mj-apercu [data-mj-m="202701"][aria-pressed="true"]') && !!document.querySelector(".mj-apercu .mj-ap-carte .mj-carte") && !document.querySelector(".mj-apercu .mj-ap-attente"));
    Object.assign(R, { a1, a2, a3, a4 });
    console.log("Admin · aperçu : ouverture " + s(a1) + " · jour suivant " + s(a2) + " · autre mois " + s(a3) + " · retour au 1er mois " + s(a4) + " (demandes : " + req.filter(x => /^mj:apercu/.test(x.q)).map(x => x.q.slice(10)).join(", ") + ")");
    ok(!err.length && a1 < DELAI && a2 < DELAI, "aperçu admin : ouverture et « jour suivant » sans attendre le serveur (préchargés) " + s(a1) + " / " + s(a2));
    ok(a4 < DELAI && req.filter(x => x.q === "mj:apercu:202701:1").length === 1, "aperçu admin : revenir sur un mois déjà vu ne redemande rien au serveur (" + s(a4) + ")");
    await ctx.close(); }
  // 5. relecture jeu-code-donnees (a) : carte affichée depuis la mémoire, geste fait en 0,3 s, puis une réponse « etat » partie AVANT le geste arrive (6 s) :
  //    elle est ignorée (la carte reste « fait », aucun bouton actif, la mémoire dit « fait »)
  { const o0 = await ouvrir(b, { session: { role: "perso", nom: "Kévin" }, hash: "#trophees" }); await attendre(o0.p, () => window.__mj); await o0.p.waitForTimeout(DELAI + 500); await o0.p.close();
    let fait = false;
    const { ctx, p, err } = await ouvrir(b, { ctx: o0.ctx, session: { role: "perso", nom: "Kévin" }, hash: "#trophees",
      delai: c => c.action === "mj" ? (c.op === "geste" ? 300 : 6000) : DELAI,
      rep: c => c.action === "mj" ? (c.op === "geste" ? (fait = true, { ok: true, message: "Message inventé du geste.", etat: ETAT({ fait: true }) }) : MJ_ETAT(202701, ETAT({ fait: false }))) : null });
    await attendre(p, () => window.__mj); await p.click(".mj-carte [data-mj-opt='a']"); await p.waitForTimeout(7500);
    const r = await p.evaluate(() => ({ fait: !!document.querySelector(".mj-carte:not(.mj-ap) .mj-fait"), actifs: [...document.querySelectorAll(".mj-carte:not(.mj-ap) [data-mj-opt]")].filter(x => !x.disabled).length,
      memoire: (JSON.parse(localStorage.getItem("versus.mjEtat") || "{}").rep || {}).courant.etat.fait, pastille: !!document.querySelector(".mj-pas") }));
    ok(!err.length && fait && r.fait && !r.actifs && r.memoire === true && !r.pastille, "réponse « etat » en retard (partie avant le geste) : ignorée, la carte reste faite, aucun bouton, mémoire « fait » " + JSON.stringify(r));
    await ctx.close(); }
  // 6. relecture jeu-code-donnees (b) : formulaire affiché depuis la mémoire, une réponse cochée, puis la page se redessine (classement, retour sur Course) : la coche reste
  { const GR = [{ id: "q1", titre: "Question inventée 1", question: "Qui ?", options: ["Théo", "Clément"].map(n => ({ id: n, lib: n })), requis: false }, { id: "q2", titre: "Question inventée 2", question: "Ton message :", options: [{ id: "3", lib: "« Message A inventé »" }, { id: "7", lib: "« Message B inventé »" }], requis: true }];
    const repF = c => c.action === "mj" ? MJ_ETAT(202702, ETAT({ jour: 5, groupes: GR, options: undefined, bouton: "Envoyer (inventé)" })) : null;
    const o0 = await ouvrir(b, { session: { role: "perso", nom: "Kévin" }, hash: "#trophees", quand: "2027-02-05T10:00:00", jusqua: 202701, rep: repF });
    await attendre(o0.p, () => window.__mj); await o0.p.waitForTimeout(DELAI + 500); await o0.p.close();
    const { ctx, p, err } = await ouvrir(b, { ctx: o0.ctx, session: { role: "perso", nom: "Kévin" }, hash: "#trophees", quand: "2027-02-05T10:00:00", jusqua: 202701, rep: repF });
    await attendre(p, () => window.__mj); const avantServeur = await p.evaluate(() => SOURCE === "cache");
    await p.click('.mj-carte [data-mj-g="q2"] [data-mj-v="7"]');
    await attendre(p, () => SOURCE === "api"); await p.waitForTimeout(DELAI + 1000);
    await p.evaluate(async () => { montrerVue("classement"); await new Promise(r => setTimeout(r, 400)); ETAT.podium = "gp"; GP_ETAPE = null; montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 800)); });
    const r = await p.evaluate(() => ({ cartes: document.querySelectorAll(".mj-carte:not(.mj-ap)").length, coche: !!document.querySelector('.mj-carte [data-mj-g="q2"] [data-mj-v="7"][aria-pressed="true"]'), envoi: !(document.querySelector(".mj-carte [data-mj-env]") || {}).disabled }));
    ok(!err.length && avantServeur && r.cartes === 1 && r.coche && r.envoi, "formulaire de la mémoire coché avant la réponse du serveur, puis classement et retour sur Course : la coche reste (une seule carte, bouton d'envoi actif) " + JSON.stringify(r));
    await ctx.close(); }
  await b.close(); fin(ko);
})();
