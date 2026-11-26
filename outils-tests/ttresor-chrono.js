/* Test v20.74 · chasse au trésor CHRONOMÉTRÉE (serveur V92) : le plus rapide gagne, pause possible, or attribué à la fin du mois.
   Faux serveur (aucune vraie énigme, aucune vraie cachette : position et textes INVENTÉS) ; aperçu admin pour les captures (cachette d'exemple).
   Vérifie : énigme lisible sans chrono ; « 🔍 Je lance ma recherche » (2 touchers, une requête) ; pas d'objet avant le départ ; chrono qui tourne ;
   ⏸️ pause → l'objet disparaît et la position est oubliée, chrono arrêté ; ▶️ reprise → caméra au départ du circuit, temps cumulé juste ;
   trouvaille « Trouvé en … · 🥇 le plus rapide pour l'instant » (éclat normal) ; dorée / Flair seulement quand le mois est fini (final) ;
   annonce du vainqueur le mois suivant ; ancien serveur = ancien fonctionnement ; règles ; Coupe ; 0 erreur JS.
   Lancer depuis la racine : python3 -m http.server 8913 & node outils-tests/ttresor-chrono.js   (captures : CAPTURES=dossier) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8913, CAP = process.env.CAPTURES || "/tmp";
const ENIGME = "ÉNIGME-INVENTÉE pour le test : rien à voir avec un vrai trésor.", P_FAUX = [11, 1, -7];
const fausses = (session, genere) => ({ ok: true, version: 92, genere, majTexte: "", enveloppes: ["PEA"], personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [], req = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.install({ time: new Date(o.quand) });
  const S = o.serveur || {};
  await p.route("https://script.google.com/**", async r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c);
    const now = ["tresors", "tresorDepart", "tresorArret", "tresorTrouve"].includes(c.action) ? await p.evaluate(() => Date.now()) : 0;   // l'heure de la PAGE (horloge simulée)
    const json = x => r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (["tresors", "tresorDepart", "tresorArret", "tresorTrouve"].includes(c.action)) return json(S[c.action] ? S[c.action](c, now) : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : { ok: false });
    if (["tickets", "mj", "avent"].includes(c.action)) return json({ ok: true });
    json(fausses(o.session, o.quand)); });
  await p.addInitScript(a => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.tresorAide", "1"); if (a) { localStorage.setItem("versus.apercuSaison", "1"); sessionStorage.setItem("versus.adminOn", "1"); } }, !!o.admin);
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  return { ctx, p, err, req };
}
const pageCourse = p => p.evaluate(async () => { montrerVue("trophees"); ETAT.podium = "gp"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); const pi = document.getElementById("gp-piste"); return pi ? pi.dataset.circuit : null; });
const lire = p => p.evaluate(() => ({ enig: ((document.querySelector(".gp-piste .gp-enigme") || {}).textContent || "").includes("ÉNIGME-INVENTÉE"), nl: document.querySelectorAll(".gp-lance").length, lancer: (b => b ? b.textContent + " " + (b.getAttribute("aria-label") || "") : "")(document.querySelector(".gp-piste .gp-lancer")) /* v20.96 : « 🔍 Lancer », nom complet « Je lance ma recherche » */, arret: !!document.querySelector(".gp-piste .gp-arret"), obj: !!document.querySelector(".gp-piste .gp-tresor"),
  chr: (document.querySelector(".gp-piste .gp-lance") || {}).textContent || "", p: TRESORS && TRESORS.l[0] && TRESORS.l[0].p }));
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };

  /* ---------- 1. Joueur, décembre 2026, faux serveur V92 : départ, pause, reprise, trouvaille ---------- */
  { const E = { lance: false, actif: false, depuis: null, cumul: 0, ch: [{ nom: "Clément", j: 20261202, s: 900 }] };
    const serveur = {
      tresors: (c, maint) => ({ ok: true, maintenant: maint, trouves: [], total: 0, tresors: [Object.assign({ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: E.actif ? ENIGME : "", enigmeCachee: !E.actif, indice2: null, chaudFroid: false, chrono: true, final: false,
        lance: E.lance, actif: E.actif, depuis: E.depuis, cumul: E.cumul, chercheurs: E.ch }, E.actif ? { p: P_FAUX } : {})] }),
      tresorDepart: (c, maint) => { if (!E.actif) Object.assign(E, { lance: true, actif: true, depuis: maint }); return { ok: true, actif: true, depuis: E.depuis, cumul: E.cumul, maintenant: maint, p: P_FAUX, enigme: ENIGME, indice2: null }; },   // V96 : l'énigme arrive avec le départ
      tresorArret: (c, maint) => { if (E.actif) { E.cumul += (maint - E.depuis) / 1000; Object.assign(E, { actif: false, depuis: null }); } return { ok: true, actif: false, cumul: E.cumul, maintenant: maint }; },
      tresorTrouve: (c, maint) => { if (!E.actif) return { ok: false, erreur: "pause", message: "En pause" }; const s = Math.round(E.cumul + (maint - E.depuis) / 1000); E.ch = [{ nom: "Kévin", j: 20261203, s }].concat(E.ch).sort((a, b) => a.s - b.s);
        return { ok: true, deja: false, trouves: ["abudhabi"], total: 1, rang: E.ch.findIndex(x => x.nom === "Kévin") + 1, temps: s, n: 2, final: false, chercheurs: E.ch, eclat: null }; } };
    const { ctx, p, err, req } = await page(b, { quand: "2026-12-03T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur });
    const ci = await pageCourse(p);
    await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {});
    const r1 = await lire(p), en = await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").textContent), appel = await p.evaluate(() => document.querySelector(".gp-piste .gp-tresor-appel").textContent);
    ok(ci === "abudhabi" && /Je lance ma recherche/.test(r1.lancer) && !r1.obj && !r1.arret && !en.includes("ÉNIGME-INVENTÉE") && /Prêt \?/.test(en) && !r1.p, "V96 · avant le départ : PAS d'énigme (« Prêt ? »), bouton 🔍, AUCUN objet, pas de position");
    ok(/Un trésor se cache ici · lance ta recherche en 3D/.test(appel) && /L'énigme apparaît au lancement : le chrono compte le temps de la comprendre et de trouver/.test(appel), "carte 2D : « Un trésor se cache ici · lance ta recherche en 3D » + « l'énigme apparaît au lancement »");
    ok(req.some(c => c.action === "tresors" && c.chrono === 1), "l'appli dit au serveur qu'elle sait lancer le chrono (chrono: 1)");
    const r2 = await p.evaluate(async () => { const bt = document.querySelector(".gp-piste .gp-lancer"); bt.click(); await new Promise(r => setTimeout(r, 200)); return { txt: bt.textContent, arme: bt.classList.contains("arme") }; });
    ok(r2.arme && /Sûr/.test(r2.txt) && !req.some(c => c.action === "tresorDepart"), "1er toucher : « Sûr ? » (rien n'est envoyé)");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-lancer").click()); await p.waitForFunction(() => !!document.querySelector(".gp-piste .gp-arret"), null, { timeout: 10000 }).catch(() => {});
    const r3 = await lire(p);
    ok(r3.enig, "V96 · au lancement : l'énigme s'affiche (reçue avec le départ)");
    ok(req.filter(c => c.action === "tresorDepart").length === 1 && r3.obj && r3.arret && JSON.stringify(r3.p) === JSON.stringify(P_FAUX), "2e toucher : UNE requête de départ, position reçue, l'objet existe, bouton ⏸️");
    await p.clock.fastForward(65000); await p.clock.runFor(1100);
    const c2 = await p.evaluate(() => document.querySelector(".gp-piste .gp-chr").textContent);
    ok(/^1 min [01]\d s$/.test(c2), "le chrono tourne (65 s plus tard : « " + c2 + " »)");
    // ⏸️ pause
    await p.evaluate(() => document.querySelector(".gp-piste .gp-arret").click()); await p.waitForFunction(() => !document.querySelector(".gp-piste .gp-arret"), null, { timeout: 10000 }).catch(() => {});
    const r4 = await lire(p);
    ok(!r4.enig, "V96 · en pause : l'énigme disparaît aussi");
    ok(req.some(c => c.action === "tresorArret") && !r4.obj && !r4.p && /Reprendre/.test(r4.lancer) && /1 min \d\d s/.test(r4.chr), "⏸️ pause : l'objet disparaît, la position est oubliée, chrono arrêté (« " + r4.chr.slice(0, 14) + " »)");
    await p.clock.fastForward(600000); await p.clock.runFor(1100);
    const r5 = await lire(p);
    ok(r5.chr === r4.chr && !r5.obj, "10 min de pause plus tard : le temps n'a pas bougé, toujours pas d'objet");
    const tr = await p.evaluate(async () => { const n = document.querySelectorAll(".gp-piste .gp-tresor").length; return n; });
    ok(tr === 0, "en pause, rien à toucher (l'objet n'existe pas dans la page)");
    // ▶️ reprise (un seul toucher)
    await p.evaluate(() => document.querySelector(".gp-piste .gp-lancer").click()); await p.waitForFunction(() => !!document.querySelector(".gp-piste .gp-arret"), null, { timeout: 10000 }).catch(() => {});
    const r6 = await lire(p);
    ok(r6.enig, "V96 · à la reprise : l'énigme revient");
    ok(req.filter(c => c.action === "tresorDepart").length === 2 && r6.obj && r6.arret && JSON.stringify(r6.p) === JSON.stringify(P_FAUX), "▶️ reprise (1 toucher) : la position revient, l'objet existe à nouveau");
    // pause automatique quand on quitte l'appli, puis retour : l'appli relit le serveur
    await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await p.waitForTimeout(600); const nArr = req.filter(c => c.action === "tresorArret").length;
    await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await p.waitForFunction(() => !!document.querySelector(".gp-piste .gp-lance.pause"), null, { timeout: 10000 }).catch(() => {});
    const auto = await lire(p);
    ok(nArr === 2 && !auto.obj && !auto.p && /Reprendre/.test(auto.lancer), "quitter l'appli : pause automatique envoyée ; au retour, l'appli relit le serveur (en pause, plus d'objet)");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-lancer").click()); await p.waitForFunction(() => !!document.querySelector(".gp-piste .gp-arret"), null, { timeout: 10000 }).catch(() => {});
    await p.clock.fastForward(689000); await p.clock.runFor(1100);
    const r7 = await p.evaluate(async () => { const t = TRESORS.l[0], b = document.querySelector(".gp-piste .gp-tresor"); await trouverTresor(t, b); await new Promise(r => setTimeout(r, 300)); return { toast: document.querySelector("#toast").textContent, ch: chercheursTxt(TRESORS.l[0]) }; });
    const jt = req.filter(c => c.action === "tresorTrouve").map(c => c.jeton)[0];
    ok(typeof jt === "number" && jt > 0, "la trouvaille envoie le jeton de la période en cours");
    ok(/Trouvé en 1[23] min \d\d s · (?:(?:sans indice|2e indice|jauge) · )?🥇 1er pour l'instant/.test(r7.toast), "trouvaille (65 s + 11 min 29 s ; avec les 10 min de pause, on dépasserait 22 min) : « " + r7.toast.replace("✕", "").trim().slice(0, 60) + " »");
    ok(/Classement : 🥇 Kévin ⏱️ 1[23] min \d\d s · 2\. Clément ⏱️ 15 min 00 s/.test(r7.ch), "classement provisoire avec les temps : " + r7.ch);
    for (let i = 0; i < 10 && !(await p.evaluate(() => !!document.querySelector(".cn-rev"))); i++) { await p.clock.runFor(500); await p.waitForTimeout(200); }
    const cer = await p.evaluate(() => { const o = document.querySelector(".cn-rev"); return o ? o.innerText : ""; });
    ok(/Trouvé en 1[23] min \d\d s/i.test(cer) && /1er pour l'instant/i.test(cer) && /31 décembre à minuit/i.test(cer), "cérémonie de Noël : « Trouvé en … · 🥇 le plus rapide pour l'instant », la dorée attribuée le 31/12 à minuit " + JSON.stringify(cer.slice(0, 160)));
    ok(!err.length, "joueur : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 2. L'or (plaque dorée, Flair) : au PLUS RAPIDE, et seulement à la fin du mois ---------- */
  { const { ctx, p, err } = await page(b, { quand: "2026-12-20T10:00:00", session: { role: "perso", nom: "Kévin" } });
    const r = await p.evaluate(() => {
      const poser = (ch, final) => { TRESORS = { l: [{ circuit: "abudhabi", saison: 2026, chrono: true, final, chercheurs: ch }], trouves: [], total: 0 }; };
      const ch1 = [{ nom: "Kévin", j: 20261203, s: 754 }, { nom: "Clément", j: 20261202, s: 900 }];
      poser(ch1, false); const pend = { k: debloques("Kévin").has("plaque.chercheuror"), kn: debloques("Kévin").has("plaque.chercheur"), q: texteOrigineItem("Kévin", "plaque", "chercheuror").p };
      poser(ch1, true); const fin = { k: debloques("Kévin").has("plaque.chercheuror"), c: debloques("Clément").has("plaque.chercheuror") };
      poser([{ nom: "Devlin", j: 20261215, s: 300 }].concat(ch1), true); const chg = { k: debloques("Kévin").has("plaque.chercheuror"), d: debloques("Devlin").has("plaque.chercheuror"), q: texteOrigineItem("Devlin", "plaque", "chercheuror").p };
      const fl = final => { TRESORS = { l: [{ circuit: "silverstone", saison: 2027, chrono: true, final, chercheurs: [{ nom: "Clément", j: 20270120, s: 400 }, { nom: "Kévin", j: 20270102, s: 5000 }] }], trouves: [], total: 0 }; const f = flairSaison(2027); return f && f.nom; };
      TRESORS = { l: [{ circuit: "abudhabi", saison: 2026, mois: 12, chrono: true, final: true, chercheurs: [{ nom: "Devlin", j: 20261210, s: 100 }] }], trouves: [], total: 0 }; const flDec = flairSaison(2027);
      return { pend, fin, chg, flP: fl(false), flF: fl(true), flDec };
    });
    ok(!r.pend.k && r.pend.kn && /pour l'instant : Kévin/.test(r.pend.q) && /31 décembre à minuit/.test(r.pend.q), "pendant le mois : plaque normale tout de suite, la dorée pas encore (« pour l'instant : Kévin »)");
    ok(r.fin.k && !r.fin.c, "mois fini : la dorée au plus rapide (Kévin), pas au premier arrivé (Clément)");
    ok(!r.chg.k && r.chg.d && /1er du classement \(5 min 00 s\)/.test(r.chg.q), "un temps plus petit trouvé plus tard dans le mois : la dorée revient à Devlin");
    ok(r.flDec === null, "le trésor de décembre 2026 ne compte jamais dans le Flair 2027");
    ok(r.flP === null && r.flF === "Clément", "🔍 Flair : rien pendant le mois, puis 3 points au plus rapide (Clément) une fois le mois fini");
    ok(!err.length, "0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 3. Annonce du vainqueur définitif, le mois suivant (une seule fois) ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const serveur = { tresors: () => ({ ok: true, maintenant: Date.now(), trouves: ["abudhabi"], total: 1, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: ENIGME, chrono: true, final: true, lance: true, actif: false, cumul: 492,
      vainqueur: { nom: "Clément", s: 492 }, chercheurs: [{ nom: "Clément", j: 20261204, s: 492 }, { nom: "Kévin", j: 20261203, s: 754 }] }] }) };
    const { ctx, p, err } = await page(b, { quand: "2027-01-02T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur, sombre });
    const a = await p.evaluate(async () => { const autre = !!document.querySelector(".revel, .regles, .tuto");   // une autre fenêtre (ex. ouverture de la saison) : l'annonce attend son tour
      document.querySelectorAll(".revel:not(.tv-rev), .regles, .tuto").forEach(x => x.remove()); await new Promise(r => setTimeout(r, 3000));
      if (!document.querySelector(".tv-rev")) { TRESORS = null; TRESORS_T = 0; await chargerTresors(); await new Promise(r => setTimeout(r, 900)); }
      const o = document.querySelector(".tv-rev"), t = o ? o.innerText : ""; return t + (autre ? " [attendait une autre fenêtre]" : ""); });
    ok(/Plaque dorée Chercheur de Noël/i.test(a) && /Clément en 8 min 12 s/i.test(a) && /résultat définitif/i.test(a), "2/1/2027 (" + tag + ") : annonce « 🎁 Plaque dorée Chercheur de Noël : Clément en 8 min 12 s »");
    await p.screenshot({ path: CAP + "/chrono-6-annonce-" + tag + ".png" });
    const deux = await p.evaluate(async () => { document.querySelectorAll(".tv-rev").forEach(x => x.remove()); annoncerVainqueurTresor(); return !!document.querySelector(".tv-rev"); });
    ok(!deux && !err.length, "l'annonce ne s'affiche qu'une fois ; 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 4. Ancien serveur (sans chrono) : l'ancien fonctionnement, sans bouton ---------- */
  { const serveur = { tresors: () => ({ ok: true, trouves: [], total: 0, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", p: P_FAUX, enigme: ENIGME, chercheurs: [{ nom: "Clément", j: 20261202 }] }] }) };
    const { ctx, p, err } = await page(b, { quand: "2026-12-03T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur });
    await pageCourse(p); await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {});
    const r = await p.evaluate(() => ({ lancer: !!document.querySelector(".gp-piste .gp-lancer"), obj: !!document.querySelector(".gp-piste .gp-tresor"), ch: chercheursTxt(TRESORS.l[0]), or: debloques("Clément").has("plaque.chercheuror") }));
    ok(!r.lancer && r.obj && /Trouvé par : 🥇 Clément \(2 déc/.test(r.ch) && r.or && !err.length, "serveur d'avant la V92 : pas de bouton, l'objet comme avant, classement par date, dorée au premier " + JSON.stringify(r));
    await ctx.close(); }

  /* ---------- 5. Règles et Coupe ---------- */
  { const { ctx, p, err } = await page(b, { quand: "2027-02-03T10:00:00", session: { role: "perso", nom: "Kévin" } });
    const r = await p.evaluate(async () => { ouvrirRegles("gp"); await new Promise(r => setTimeout(r, 300)); const li = document.querySelector("#rg-tresor"), t = li ? li.innerText : ""; document.querySelectorAll(".regles").forEach(x => x.remove());
      const c = JSON.parse(JSON.stringify(COUPE_EX)); c.exemple = false; Object.assign(c.eclats[0], { s: 754, rang: 2, final: false }); Object.assign(c.eclats[1], { s: 300, rang: 1, final: true }); Object.assign(c.eclats[2], { s: 540, rang: 4, final: true }); ouvrirCoupe(c); await new Promise(r => setTimeout(r, 300));
      const co = document.querySelector(".coupe-b").innerText, cl = i => { const x = document.querySelector('.coupe-b .cb-svg [data-ec="' + i + '"]'); return (x.getAttribute("class").match(/m-\w+/) || ["m-normal-absent"])[0]; }, m = [0, 1, 2].map(cl).join(); document.querySelectorAll(".coupe-b").forEach(x => x.remove()); return { t, co, m }; });
    ok(/Je lance ma recherche/.test(r.t) && /Mettre en pause/.test(r.t) && /quittes l'appli/.test(r.t) && /à chaque reprise, tu repars du départ/i.test(r.t) && /1er du classement gagne/i.test(r.t) && /minuit/.test(r.t) && /argent/.test(r.t) && /bronze/.test(r.t) && /11/.test(r.t) && /21/.test(r.t), "règles : bouton, pause, « à chaque reprise, tu repars du départ », le plus rapide gagne, attribution à minuit, indices du 11 et du 21");
    ok(/trouvé en 12 min 34 s · 2e · 🥈 éclat argent pour l'instant/.test(r.co) && /trouvé en 5 min 00 s · 🥇 1er · 🥇 éclat or(?! pour)/.test(r.co) && /trouvé en 9 min 00 s · 4e · éclat de fer/.test(r.co) && r.m === "m-argent,m-or,m-fer", "Coupe : éclat or / argent / bronze / fer / pierre selon le temps (« pour l'instant » pendant le mois), liseré de couleur sur la coupe " + r.m);
    ok(!err.length, "0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 5 bis. Règles de décembre (tour de chauffe) : rien de 2027 ---------- */
  for (const quand of ["2026-12-03T10:00:00", "2026-12-20T10:00:00", "2026-12-31T20:00:00"]) {
    const { ctx, p, err } = await page(b, { quand, session: { role: "perso", nom: "Kévin" } });
    const r = await p.evaluate(async () => { ouvrirRegles("gp"); await new Promise(r => setTimeout(r, 300)); document.querySelectorAll(".regles .rgt-f").forEach(f => { f.hidden = false; }); document.querySelectorAll(".regles details").forEach(d => { d.open = true; }); const o = document.querySelector(".regles"), li = document.querySelector("#rg-tresor"); return { tout: o ? o.innerText : "", li: li ? li.innerText : "" }; });
    ok(/plaque dorée Chercheur de Noël/.test(r.li) && /Mettre en pause/.test(r.li) && !/éclat|Flair/i.test(r.tout) && !err.length, quand.slice(0, 10) + " : règles d'un joueur : la plaque dorée au plus rapide, aucun mot « éclat » ni « Flair »");
    await ctx.close(); }

  /* ---------- 6. Aperçu admin (cachette d'EXEMPLE) : parcours complet + captures 390 px clair / sombre ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const { ctx, p, err, req } = await page(b, { quand: "2026-11-25T10:00:00", session: { role: "admin" }, admin: true, sombre });
    await p.evaluate(() => { montrerVue("trophees"); }); await p.waitForTimeout(600);
    await p.evaluate(() => ouvrirApercuTresor());
    await p.waitForFunction(() => TRESOR_APERCU && TRESOR_APERCU.pEx, null, { timeout: 20000 });
    await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
    const a = await p.evaluate(() => ({ obj: !!document.querySelector(".gp-piste .gp-tresor"), lancer: !!document.querySelector(".gp-piste .gp-lancer"), deb: document.documentElement.scrollWidth > innerWidth + 1, p: !!TRESOR_APERCU.F.p }));
    ok(a.lancer && !a.obj && !a.p && !a.deb, "aperçu (" + tag + ") : tout près de la cachette d'exemple mais pas lancé : bouton 🔍, AUCUN objet ; rien ne déborde à 390 px");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").classList.add("ouverte"));
    await p.locator("#gp-piste").screenshot({ path: CAP + "/chrono-1-bouton-" + tag + ".png" });
    await p.evaluate(() => { document.querySelector(".gp-piste .gp-lancer").click(); document.querySelector(".gp-piste .gp-lancer").click(); }); await p.waitForTimeout(600);
    const z0 = await p.evaluate(() => GP_INST.api.zoom());
    await p.clock.fastForward(400000); await p.evaluate(() => apPres()); await p.clock.runFor(1500); await p.waitForTimeout(500);
    const c = await p.evaluate(() => ({ chr: (document.querySelector(".gp-piste .gp-lance.on") || {}).textContent || "", op: (() => { const t = document.querySelector(".gp-piste .gp-tresor"); return t ? +getComputedStyle(t).opacity : -1; })() }));
    ok(z0 === 1 && /⏱️ 6 min 4\d s/.test(c.chr) && c.op > .5, "aperçu (" + tag + ") : au départ la caméra est à la vue d'ensemble ; le chrono tourne (« " + c.chr.slice(0, 14) + " ») ; l'objet d'exemple se montre tout près");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").classList.add("ouverte"));
    await p.locator("#gp-piste").screenshot({ path: CAP + "/chrono-2-chrono-" + tag + ".png" });
    const croise = () => p.evaluate(() => { const j = document.querySelector(".gp-piste .p3-joy"); if (!j || j.hidden || !j.getBoundingClientRect().width) return { vu: false };
      const a = j.getBoundingClientRect(), sur = [...document.querySelectorAll(".gp-lance button, .gp-btns button, .gp-vues2 button, .gpp-bar button, .gpp-h button, .gp-tresor-appel, .gp-jauge")].filter(x => { const r = x.getBoundingClientRect(); return r.width && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top; }).map(x => x.textContent.trim().slice(0, 20));
      return { vu: true, sur, haut: Math.round(a.top - document.querySelector("#gp-piste").getBoundingClientRect().top) }; });
    const j1 = await croise();
    ok(j1.vu && !j1.sur.length && j1.haut <= 14, "aperçu (" + tag + ") : joystick en haut à droite, ne couvre aucun bouton (pause, Carte/Visite/Plein écran) " + JSON.stringify(j1));
    await p.evaluate(() => ouvrirPleinGP(saisonCourante() || 2026)); await p.waitForTimeout(1500); await p.evaluate(() => apPres()); await p.waitForTimeout(1800);
    const j3 = await croise(); await p.screenshot({ path: CAP + "/chrono-2b-plein-ecran-" + tag + ".png" });
    ok(j3.vu && !j3.sur.length, "aperçu (" + tag + ") · plein écran : le joystick ne couvre aucun bouton (pause, barre du haut) " + JSON.stringify(j3));
    await p.evaluate(() => fermerPleinGP()); await p.waitForTimeout(1000); await p.evaluate(() => apPres()); await p.waitForTimeout(1600);
    // ⏸️ pause tout près de la cachette : l'objet disparaît
    await p.evaluate(() => document.querySelector(".gp-piste .gp-arret").click()); await p.clock.runFor(600); await p.waitForTimeout(300);
    const pz = await p.evaluate(() => ({ obj: !!document.querySelector(".gp-piste .gp-tresor"), p: !!TRESOR_APERCU.F.p, zoom: GP_INST.api.zoom(), t: (document.querySelector(".gp-piste .gp-lance.pause") || {}).textContent || "" }));
    ok(!pz.obj && !pz.p && /tu repars du départ/.test(pz.t), "aperçu (" + tag + ") : ⏸️ en pause tout près de la cachette : plus d'objet, plus de position ; « à chaque reprise, tu repars du départ »");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").classList.add("ouverte"));
    await p.locator("#gp-piste").screenshot({ path: CAP + "/chrono-3-pause-" + tag + ".png" });
    const j2 = await croise(); ok(!j2.vu || !j2.sur.length, "aperçu (" + tag + ") : en pause, le joystick ne couvre pas « ▶️ Reprendre » " + JSON.stringify(j2));
    await p.clock.fastForward(3600000);
    await p.evaluate(() => document.querySelector(".gp-piste .gp-lancer").click()); await p.clock.runFor(600); await p.waitForTimeout(300);
    const rz = await p.evaluate(() => ({ zoom: GP_INST.api.zoom(), obj: !!document.querySelector(".gp-piste .gp-tresor") }));
    ok(pz.zoom < .2 && rz.zoom === 1 && rz.obj, "aperçu (" + tag + ") : ▶️ reprise : la caméra repart de la vue d'ensemble (zoom " + pz.zoom.toFixed(2) + " → " + rz.zoom + "), l'objet revient (mais loin)");
    await p.clock.fastForward(354000); await p.evaluate(() => apPres()); await p.clock.runFor(1500); await p.waitForTimeout(400);
    await p.evaluate(async () => { const b = document.querySelector(".gp-piste .gp-tresor"); await trouverTresor(TRESOR_EL.t, b); });
    await p.clock.runFor(1500); await p.waitForTimeout(500);
    const e = await p.evaluate(() => { const o = document.querySelector(".cb-rev"), d = document.querySelector(".cb-or"); return { t: o ? o.innerText : "", or: !!d }; });
    ok(/Trouvé en 1[23] min \d\d s · (?:(?:sans indice|2e indice|jauge) · )?🥇 1er pour l'instant/i.test(e.t) && /à la fin du mois \(minuit, le soir du dernier jour\)/i.test(e.t) && /éclat or pour l'instant/i.test(e.t) && !e.or, "aperçu (" + tag + ") : trouvaille en 12 min 3x s (pause d'1 h non comptée) : éclat NORMAL tout de suite, « 🥇 le plus rapide pour l'instant », pas de cérémonie dorée " + JSON.stringify(e.t.slice(0, 200)));
    await p.screenshot({ path: CAP + "/chrono-4-trouvaille-" + tag + ".png" });
    await p.evaluate(() => { document.querySelectorAll(".cb-rev, .revel, .coupe-b").forEach(x => x.remove()); ceremonieChercheurNoel(1, 754); });
    await p.waitForTimeout(900); await p.screenshot({ path: CAP + "/chrono-5-ceremonie-noel-" + tag + ".png" });
    ok(!req.some(x => /^tresor(Depart|Arret|Trouve)$/.test(x.action)), "aperçu (" + tag + ") : rien n'est envoyé au serveur");
    ok(!err.length, "aperçu (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  await b.close(); console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
