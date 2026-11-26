/* Test v20.84 · trésor : CLASSEMENT EN DIRECT, ATTRIBUTION ANTICIPÉE (tous les pilotes ont trouvé, serveur V95), éclats fer / pierre, règles en images.
   Faux serveur : noms, temps, énigme et cachette INVENTÉS (rien d'un vrai trésor). Captures 390 px clair / sombre (CAPTURES=dossier).
   Vérifie : la liste « ⏱️ Classement du trésor » (rang, nom, temps, 🥇🥈🥉) visible aussi par qui cherche encore ; « 3 sur 5 ont trouvé » ;
   mise à jour en direct (60 s) sans casser la recherche ; 5/5 → définitif tout de suite + annonce ; 4/5 → provisoire ; règles de décembre sans
   « éclat » ni « Flair » ; règles de janvier (or, argent, bronze, fer, pierre ; Flair) ; aide de l'encadré ; Coupe ; aucune position dans les requêtes ; 0 erreur JS.
   Lancer depuis la racine : python3 -m http.server 8945 & PORT=8945 node outils-tests/ttresor-direct.js */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8945, CAP = process.env.CAPTURES || "/tmp";
const ENIGME = "ÉNIGME-INVENTÉE pour le test : rien à voir avec un vrai trésor.", P_FAUX = [11, 1, -7];
const PERS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const fausses = (session, genere) => ({ ok: true, version: 95, genere, majTexte: "", enveloppes: ["PEA"], personnes: PERS.map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [], req = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.install({ time: new Date(o.quand) });
  const S = o.serveur || {};
  await p.route("https://script.google.com/**", async r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c);
    const now = /^tresor/.test(c.action) ? await p.evaluate(() => Date.now()) : 0;
    const json = x => r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (/^tresor/.test(c.action)) return json(S[c.action] ? S[c.action](c, now) : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : { ok: false });
    if (["tickets", "mj", "avent"].includes(c.action)) return json({ ok: true });
    json(fausses(o.session, o.quand)); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.tresorAide", "1"); localStorage.setItem("versus.q3dAffichette", "1"); });   // l'affichette Décors 3D (une fenêtre de plus) bloquerait l'annonce : comportement voulu
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto").forEach(x => x.remove()));
  await p.addStyleTag({ content: ".bulle-portrait { display: none !important; }" });   // la bulle « Fais ton portrait » (sans rapport) cacherait l'encadré sur les captures
  return { ctx, p, err, req };
}
const pageCourse = p => p.evaluate(async () => { montrerVue("trophees"); ETAT.podium = "gp"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); const pi = document.getElementById("gp-piste"); return pi ? pi.dataset.circuit : null; });
const lignes = p => p.evaluate(() => [...document.querySelectorAll(".gp-piste .gp-enigme .tc-l li")].map(li => [...li.children].map(c => c.textContent.trim()).join(" ")));
const sansPos = req => req.every(c => !("p" in c) && !JSON.stringify(c).includes(JSON.stringify(P_FAUX)));
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };

  /* ---------- 1. Décembre : Kévin cherche encore, 3 sur 5 ont trouvé ; puis un 4e arrive (en direct) ; puis Kévin, dernier, trouve → décidé tout de suite ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const E = { lance: false, actif: false, depuis: null, cumul: 1500, final: false, fige: false, vq: null,
      ch: [{ nom: "Clément", j: 20261204, s: 492 }, { nom: "Devlin", j: 20261205, s: 754 }, { nom: "Théo", j: 20261206, s: 1200 }] };
    const tres = () => Object.assign({ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: E.actif ? ENIGME : "", enigmeCachee: !E.actif, indice2: null, chaudFroid: false, chrono: true, final: E.final, fige: E.fige, pilotes: 5,
      lance: E.lance, actif: E.actif, depuis: E.depuis, cumul: E.cumul, chercheurs: E.ch }, E.vq ? { vainqueur: E.vq } : {}, E.actif ? { p: P_FAUX } : {});
    const serveur = {
      tresors: (c, m) => ({ ok: true, maintenant: m, trouves: E.ch.some(x => x.nom === "Kévin") ? ["abudhabi"] : [], total: E.ch.some(x => x.nom === "Kévin") ? 1 : 0, tresors: [tres()] }),
      tresorDepart: (c, m) => { if (!E.actif) Object.assign(E, { lance: true, actif: true, depuis: m }); return { ok: true, actif: true, depuis: E.depuis, cumul: E.cumul, maintenant: m, p: P_FAUX, enigme: ENIGME, indice2: null }; },
      tresorArret: (c, m) => ({ ok: true, actif: false, cumul: E.cumul, maintenant: m }),
      tresorTrouve: (c, m) => { const s = Math.round(E.cumul + (m - E.depuis) / 1000); E.ch = E.ch.concat([{ nom: "Kévin", j: 20261210, s }]).sort((a, b) => a.s - b.s); Object.assign(E, { actif: false, final: true, fige: true, vq: { nom: E.ch[0].nom, s: E.ch[0].s } });
        return { ok: true, deja: false, trouves: ["abudhabi"], total: 1, rang: E.ch.findIndex(x => x.nom === "Kévin") + 1, temps: s, n: E.ch.length, final: true, fige: true, vainqueur: E.vq, pilotes: 5, chercheurs: E.ch, eclat: null }; } };
    const { ctx, p, err, req } = await page(b, { quand: "2026-12-10T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur, sombre });
    await pageCourse(p); await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {});
    const appel = await p.evaluate(() => (document.querySelector(".gp-piste .gp-tresor-appel") || {}).textContent || "");
    ok(/3 sur 5 ont trouvé · en tête : 8 min 12 s · sans indice/.test(appel), "décembre (" + tag + ") · carte 2D, Kévin cherche encore : « ⏱️ 3 sur 5 ont trouvé · en tête : 8 min 12 s · sans indice »");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-tresor-appel").click()); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait").forEach(x => x.remove()); document.querySelector(".gp-piste .gp-enigme").classList.add("ouverte"); }); await p.waitForTimeout(300);
    const l1 = await lignes(p), et1 = await p.evaluate(() => (document.querySelector(".gp-piste .tc-etat") || {}).textContent || "");
    ok(l1.join(" | ") === "🥇 Clément 8 min 12 s · sans indice | 🥈 Devlin 12 min 34 s · sans indice | 🥉 Théo 20 min 00 s · sans indice", "encadré ouvert : « ⏱️ Classement du trésor » trié par temps, médailles provisoires " + JSON.stringify(l1));
    ok(/^Moins d'aide d'abord, puis le temps\./.test(et1), "ligne fixe sous le classement : « Moins d'aide d'abord, puis le temps. »");
    ok(/Provisoire · 3 sur 5 ont trouvé · définitif dès que les 5 ont trouvé, sinon le 31 décembre à minuit/.test(et1), "« Provisoire · 3 sur 5 ont trouvé · définitif dès que les 5 ont trouvé, sinon le 31 décembre à minuit »");
    const dedans = await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme").getBoundingClientRect(), pi = document.getElementById("gp-piste").getBoundingClientRect(); return e.top >= pi.top - 1 && e.bottom <= pi.bottom + 1; });
    ok(dedans, "l'encadré ouvert (avec le classement) reste dans la piste : rien de coupé en haut (il défile si besoin)");
    ok(!/éclat|flair/i.test(await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").innerHTML)), "décembre : ni « éclat » ni « Flair » dans l'encadré");
    await p.evaluate(() => { document.querySelectorAll("#toast, .toast").forEach(x => x.style.display = "none"); document.getElementById("gp-piste").scrollIntoView({ block: "center" }); }); await p.waitForTimeout(200); await p.screenshot({ path: CAP + "/direct-1-cherche-" + tag + ".png" });
    // l'aide de l'encadré
    await p.evaluate(() => document.querySelector(".gp-piste .tc-aide").click()); await p.waitForTimeout(300);
    const aide = await p.evaluate(() => { const o = document.querySelector(".regles #rgt-tresor:not([hidden])") || document.querySelector(".tc-b"); const t = o ? o.textContent : ""; return t; });   // trésor compact, 26/11 : la tuile « Le trésor » des règles
    ok(/Je lance ma recherche/.test(aide) && /entraînement/.test(aide) && /ne compte pas encore pour 2027/.test(aide) && !/éclat|flair/i.test(aide), "❔ aide de l'encadré : les règles en images (décembre : « entraînement · ne compte pas encore pour 2027 », sans éclat ni Flair)");
    await p.screenshot({ path: CAP + "/direct-2-aide-decembre-" + tag + ".png" });
    await p.evaluate(() => { document.querySelectorAll(".tc-b, .regles").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); });
    // départ, puis un 4e pilote trouve pendant la recherche : la liste se met à jour, la recherche continue
    await p.evaluate(() => { const bt = document.querySelector(".gp-piste .gp-lancer"); bt.click(); bt.click(); }); await p.waitForFunction(() => !!document.querySelector(".gp-piste .gp-arret"), null, { timeout: 10000 }).catch(() => {});
    const obj0 = await p.evaluate(() => { const o = document.querySelector(".gp-piste .gp-tresor"); if (o) o.dataset.marque = "1"; return !!o; });
    E.ch = E.ch.concat([{ nom: "Nicolas", j: 20261210, s: 600 }]).sort((a, b) => a.s - b.s);
    await p.clock.fastForward(61000); await p.clock.runFor(1200); await p.waitForTimeout(600);
    const l2 = await lignes(p), meme = await p.evaluate(() => { const o = document.querySelector(".gp-piste .gp-tresor"); return !!(o && o.dataset.marque === "1") && !!document.querySelector(".gp-piste .gp-arret"); });
    ok(obj0 && l2.length === 4 && /^🥈 Nicolas 10 min 00 s · sans indice$/.test(l2[1]) && meme, "en direct (60 s) : Nicolas apparaît 2e, la recherche en cours n'est pas touchée (même objet, chrono qui tourne) " + JSON.stringify(l2));
    // Kévin, dernier des 5, trouve : décidé tout de suite, annonce
    await p.clock.fastForward(120000); await p.clock.runFor(1100);
    await p.evaluate(async () => { await trouverTresor(TRESOR_EL.t, document.querySelector(".gp-piste .gp-tresor")); });
    for (let i = 0; i < 12 && !(await p.evaluate(() => !!document.querySelector(".tv-rev"))); i++) { await p.evaluate(() => document.querySelectorAll(".cn-rev, .revel:not(.tv-rev)").forEach(x => x.remove())); await p.clock.runFor(800); await p.waitForTimeout(200); }
    const an = await p.evaluate(() => { const o = document.querySelector(".tv-rev"); return o ? o.innerText : ""; });
    ok(/résultat définitif/i.test(an) && /Clément en 8 min 12 s/i.test(an) && /Les 5 pilotes ont trouvé : c.est décidé tout de suite/i.test(an), "5 sur 5 : annonce tout de suite (« Les 5 pilotes ont trouvé : c'est décidé tout de suite ! ») " + JSON.stringify(an.slice(0, 120)));
    const fin = await p.evaluate(() => ({ or: debloques("Clément").has("plaque.chercheuror"), k: debloques("Kévin").has("plaque.chercheuror"), kn: debloques("Kévin").has("plaque.chercheur") }));
    ok(fin.or && !fin.k && fin.kn, "plaque dorée définitive pour Clément le 10 décembre ; Kévin a la plaque normale");
    await p.screenshot({ path: CAP + "/direct-3-annonce-5sur5-" + tag + ".png" });
    await p.evaluate(() => document.querySelectorAll(".tv-rev, .revel").forEach(x => x.remove())); await p.clock.runFor(1200); await p.waitForTimeout(300);
    await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme"); if (e) e.classList.add("ouverte"); }); await p.waitForTimeout(200);
    const l3 = await lignes(p), et3 = await p.evaluate(() => (document.querySelector(".gp-piste .tc-etat") || {}).textContent || ""), res = await p.evaluate(() => (document.querySelector(".gp-piste .gp-enigme.trouvee i") || {}).textContent || "");
    ok(l3.length === 5 && l3.some(x => /Kévin \(toi\)/.test(x)) && /Définitif : les 5 ont trouvé/.test(et3) && /^Trouvé en \d+ min \d\d s · sans indice · \d+e$/.test(res), "après sa trouvaille : son temps et sa place (« " + res + " »), les 5 au classement, « Définitif : les 5 ont trouvé »");
    await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .toast, .bulle-portrait").forEach(x => x.remove()));
    await p.evaluate(() => { document.querySelectorAll("#toast, .toast").forEach(x => x.style.display = "none"); document.getElementById("gp-piste").scrollIntoView({ block: "center" }); }); await p.waitForTimeout(200); await p.screenshot({ path: CAP + "/direct-4-trouve-" + tag + ".png" });
    ok(sansPos(req), "aucune position ni cachette dans ce que l'appli envoie");
    ok(!err.length, "décembre (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 2. 4 sur 5 : provisoire (pas d'annonce, pas de dorée) ---------- */
  { const serveur = { tresors: (c, m) => ({ ok: true, maintenant: m, trouves: ["abudhabi"], total: 1, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: ENIGME, chrono: true, final: false, fige: false, pilotes: 5, lance: true, actif: false, cumul: 300,
      chercheurs: [{ nom: "Kévin", j: 20261204, s: 300 }, { nom: "Clément", j: 20261204, s: 492 }, { nom: "Devlin", j: 20261205, s: 754 }, { nom: "Théo", j: 20261206, s: 1200 }] }] }) };
    const { ctx, p, err } = await page(b, { quand: "2026-12-20T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur });
    await pageCourse(p); await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(1500);
    const souv = await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme.trouvee .tc-souv"); return !!e && e.textContent.includes("ÉNIGME-INVENTÉE"); });
    ok(souv, "V96 · après la trouvaille : l'énigme reste lisible pour le trouveur (souvenir)");
    const r = await p.evaluate(() => ({ an: !!document.querySelector(".tv-rev"), or: debloques("Kévin").has("plaque.chercheuror"), et: (document.querySelector(".gp-piste .tc-etat") || {}).textContent || "", appel: (document.querySelector(".gp-piste .gp-tresor-appel.trouve") || {}).textContent || "" }));
    ok(!r.an && !r.or && /Provisoire · 4 sur 5/.test(r.et) && /Trouvé en 5 min 00 s · sans indice · 🥇 1er pour l'instant/.test(r.appel), "4 sur 5 : provisoire, pas d'annonce ni de dorée ; en 2D « ✅ Trouvé en 5 min 00 s · 🥇 le plus rapide pour l'instant · ⏱️ Classement du trésor »");
    await p.evaluate(() => document.querySelector(".gp-piste .gp-tresor-appel.trouve").click()); await p.waitForTimeout(300);
    const f = await p.evaluate(() => { const o = document.querySelector(".tc-b"); return o ? [...o.querySelectorAll(".tc-l li")].length + "|" + o.innerText : ""; });
    ok(/^4\|/.test(f) && /Classement du trésor/.test(f), "un toucher en 2D : la fenêtre du classement (4 lignes)");
    ok(!err.length, "4/5 : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 3. Règles en images : décembre (entraînement) et janvier (or · argent · bronze · fer · pierre ; Flair) ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    for (const [quand, nom] of [["2026-12-03T10:00:00", "decembre"], ["2027-01-05T10:00:00", "janvier"]]) {
      const { ctx, p, err } = await page(b, { quand, session: { role: "perso", nom: "Kévin" }, sombre });
      const r = await p.evaluate(async () => { ouvrirRegles("tresor"); await new Promise(r => setTimeout(r, 400));
        document.querySelectorAll(".regles details").forEach(d => { d.open = true; });   // v20.93 (règles en tuiles) : le détail de la fiche est replié ; on le déplie avant de lire
        const o = document.querySelector(".regles"), li = document.querySelector("#rgt-tresor") || document.querySelector("#rg-tresor");   // v20.97 : toute la tuile « Le trésor » (étapes dans la fiche courte, le reste dans le détail)
        return { tout: o ? o.innerText : "", li: li ? li.innerText : "", etapes: li ? li.querySelectorAll(".tr-etapes > li").length : 0, deb: document.documentElement.scrollWidth > innerWidth + 1 }; });
      if (nom === "decembre") ok(r.etapes === 4 && /entraînement/.test(r.li) && /ne compte pas encore pour 2027/.test(r.li) && /plaque dorée Chercheur de Noël/.test(r.li) && /Dès que les 5 pilotes ont trouvé/.test(r.li) && /Moins tu as d'aide, plus tu passes devant/.test(r.li) && /Dès le 21 : 3e palier \(jauge si personne n'a encore trouvé\)/.test(r.li) && /2e indice \(dès le 11\) et 🌡️ la jauge chaud-froid \(dès le 21\) : visibles pendant ta recherche/.test(r.li) && /L'énigme apparaît et le chrono démarre/.test(r.li) && !/éclat|Flair/i.test(r.tout) && !r.deb,
        "règles de décembre (" + tag + ") : 4 étapes, entraînement, plaque dorée, paliers (« moins tu as d'aide, plus tu passes devant »), « dès que les 5 », coincé ; AUCUN « éclat » ni « Flair »");
      else ok(r.etapes === 4 && /or/.test(r.li) && /argent/.test(r.li) && /bronze/.test(r.li) && /fer/.test(r.li) && /pierre/.test(r.li) && /Pas trouvé : rien/.test(r.li) && /Flair/.test(r.li) && /3, 2 et 1 points/.test(r.li) && /Dès que les 5 pilotes ont trouvé/.test(r.li) && !r.deb,
        "règles de janvier (" + tag + ") : or · argent · bronze · fer · pierre, pas trouvé = rien, Flair 3/2/1, « dès que les 5 »");
      await p.evaluate(() => { const li = document.querySelector("#rg-tresor"), c = document.querySelector(".rg-corps"); if (li && c) c.scrollTop += li.getBoundingClientRect().top - c.getBoundingClientRect().top - 8; }); await p.waitForTimeout(200);
      await p.screenshot({ path: CAP + "/direct-5-regles-" + nom + "-" + tag + ".png" });
      ok(!err.length, "règles " + nom + " (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
      await ctx.close(); } }

  /* ---------- 4. Janvier 2027 : classement avec pastilles fer / pierre, Coupe → classement ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const ch = [{ nom: "Clément", j: 20270104, s: 300 }, { nom: "Théo", j: 20270104, s: 420 }, { nom: "Devlin", j: 20270105, s: 610 }, { nom: "Kévin", j: 20270106, s: 900 }, { nom: "Nicolas", j: 20270122, s: 15 }];   // Nicolas : le plus rapide, mais avec la jauge (palier 3) : dernier
    const coupe = { prologue: "Prologue d'exemple.", n: 1, eclats: ["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza"].map((c, i) => i === 0
      ? { circuit: c, mois: 1, etat: "trouve", rang: 4, nb: 5, premier: "Clément", final: true, matiere: "matière d'exemple", couleur: "#888", symbole: "★", texte: "Texte d'exemple.", s: 900, medaille: "fer" } : { circuit: c, mois: i + 1, etat: "avenir", nb: 0, premier: null, final: false }) };
    const serveur = { tresors: (c, m) => ({ ok: true, maintenant: m, trouves: ["silverstone"], total: 1, coupe, tresors: [{ circuit: "silverstone", saison: 2027, mois: 1, type: "trefle", enigme: ENIGME, chrono: true, final: true, fige: true, pilotes: 5, lance: true, actif: false, cumul: 900, vainqueur: { nom: "Clément", s: 300 }, chercheurs: ch }] }) };
    const { ctx, p, err } = await page(b, { quand: "2027-01-08T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur, sombre });
    await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); }); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll(".tv-rev, .revel, .regles, .tuto").forEach(x => x.remove()); ouvrirCoupe(); }); await p.waitForTimeout(300);
    const co = await p.evaluate(() => ({ t: document.querySelector(".coupe-b").innerText, m: (document.querySelector('.coupe-b .cb-svg [data-ec="0"]').getAttribute("class").match(/m-\w+/) || [""])[0] }));
    ok(/4e · éclat de fer/.test(co.t) && co.m === "m-fer" && /Classement du trésor/.test(co.t), "Coupe (" + tag + ") : 4e = éclat de FER (liseré fer), bouton « ⏱️ Classement du trésor »");
    await p.evaluate(() => document.querySelector(".coupe-b [data-tcv]").click()); await p.waitForTimeout(300);
    const f = await p.evaluate(() => { const o = document.querySelector(".tc-b"); return { l: [...o.querySelectorAll(".tc-l li")].map(li => [...li.children].map(c => c.textContent.trim()).join(" ")), fer: !!o.querySelector(".tc-md.m-fer"), pierre: !!o.querySelector(".tc-md.m-pierre"), et: o.querySelector(".tc-etat").textContent }; });
    ok(f.l.length === 5 && f.fer && f.pierre && /Kévin \(toi\)/.test(f.l[3]) && /Clément 5 min 00 s · sans indice/.test(f.l[0]) && /Nicolas 15 s · jauge/.test(f.l[4]) && /Définitif : les 5 ont trouvé/.test(f.et), "fenêtre du classement : 🥇🥈🥉 puis pastilles fer (4e) et pierre (5e), palier affiché (Nicolas 15 s · jauge, 5e), « Définitif : les 5 ont trouvé » " + JSON.stringify(f.l));
    await p.screenshot({ path: CAP + "/direct-6-classement-janvier-" + tag + ".png" });
    ok(!err.length, "janvier (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 5. 🔍 Flair : carte du titre (définition courte) ; gardé pour toujours en fin de saison (plaque « Flair 2027 », dès le 1/1/2028) ---------- */
  const tresors2027 = () => ["silverstone", "djeddah", "melbourne"].map((c, i) => ({ circuit: c, saison: 2027, mois: i + 1, type: "trefle", enigme: ENIGME, chrono: true, final: true, fige: false, pilotes: 5, lance: false, actif: false, cumul: 0,
    chercheurs: [{ nom: "Devlin", j: 20270104 + i * 100, s: 300 }, { nom: "Clément", j: 20270105 + i * 100, s: 500 }, { nom: "Kévin", j: 20270106 + i * 100, s: 900 }] }));
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const serveur = { tresors: (c, m) => ({ ok: true, maintenant: m, trouves: [], total: 0, tresors: tresors2027() }) };
    const { ctx, p, err } = await page(b, { quand: "2027-04-10T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur, sombre });
    const r = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); document.querySelectorAll(".revel, .regles, .tuto, .tv-rev").forEach(x => x.remove());
      ETAT.podium = "defis"; VIT_ONGLET = "titres"; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 900));
      const c = document.querySelector('#vit-titres [data-cour="flair"]'), d = document.querySelector('#vit-titres [data-cour="drapeau"]'); if (c) c.scrollIntoView({ block: "center" });
      const sm = c && c.querySelector(".cour-t small"), lh = sm ? parseFloat(getComputedStyle(sm).lineHeight) : 1;
      return { def: sm ? sm.textContent : "", lignes: sm ? Math.round(sm.getBoundingClientRect().height / lh) : 99, h: c ? Math.round(c.getBoundingClientRect().height) : 0, hd: d ? Math.round(d.getBoundingClientRect().height) : 0, qui: c ? c.querySelector(".cour-q").textContent : "",
        avant: debloques("Devlin").has("plaque.flair2027"), deb: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(r.def.length <= 160 && r.lignes <= 5 && r.h <= r.hd * 1.6 && /3, 2, 1 points aux 3 premiers de chaque trésor/.test(r.def) && /À égalité/.test(r.def) && !r.deb, "carte du 🔍 Flair (" + tag + ") : définition courte (" + r.def.length + " car., " + r.lignes + " lignes ; hauteur " + r.h + " px contre " + r.hd + " px pour le Drapeau)");
    ok(/Devlin/.test(r.qui) && !r.avant, "en cours de saison : Devlin tient le titre (il bouge de mois en mois), pas encore de souvenir");
    await p.waitForTimeout(1500); await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, [role=dialog], .confettis, .confetti, #toast, .toast").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); const c = document.querySelector('#vit-titres [data-cour="flair"]'); if (c) c.scrollIntoView({ block: "center" }); });
    await p.waitForTimeout(300); await p.screenshot({ path: CAP + "/direct-7-flair-titre-" + tag + ".png" });
    ok(!err.length, "Flair (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }
  { const serveur = { tresors: (c, m) => ({ ok: true, maintenant: m, trouves: [], total: 0, tresors: tresors2027() }) };
    const { ctx, p, err } = await page(b, { quand: "2028-01-02T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur });
    const r = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors();
      return { d: debloques("Devlin").has("plaque.flair2027"), k: debloques("Kévin").has("plaque.flair2027"), c: debloques("Clément").has("plaque.flair2027"), txt: texteOrigineItem("Devlin", "plaque", "flair2027").p, rar: rareteItem("plaque", "flair2027").lib, vit: vitrineFiche("Devlin"), vitK: vitrineFiche("Kévin") }; });
    ok(r.d && !r.k && !r.c && /pour toujours/.test(r.txt) && r.rar === "Titre", "1/1/2028 : Devlin (Flair en fin de saison) GARDE la plaque « Flair 2027 » pour toujours ; personne d'autre");
    ok(/Flair 2027 · pour toujours/.test(r.vit) && !/Flair 2027/.test(r.vitK), "visible sur la fiche de Devlin (vitrine), pas sur celle de Kévin");
    ok(!err.length, "Flair 2028 : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 6. ⚔️ Les 3 titres : égalités (détenteur qui garde ; sinon départage) et souvenirs pour toujours au 1/1/2028 (championnat simulé, aucun point changé) ---------- */
  for (const quand of ["2027-06-10T10:00:00", "2028-01-02T10:00:00"]) {
    const { ctx, p, err } = await page(b, { quand, session: { role: "perso", nom: "Kévin" } });
    const r = await p.evaluate(() => {
      const ancien = championnat, out = {};
      const moisDe = (k, places, cumul, derniers) => ({ k, places, cumul, l: Object.keys(places).map(nom => ({ nom, dernier: derniers.includes(nom) })) });
      const avec = (mois, complete, f) => { championnat = y => y === 2027 ? { y, chauffe: false, mois, complete, classement: Object.keys(mois[mois.length - 1].places).sort((a, b) => mois[mois.length - 1].places[a] - mois[mois.length - 1].places[b]) } : ancien(y); MEMO_TITRES = { d: null, m: {} }; try { return f(); } finally { championnat = ancien; MEMO_TITRES = { d: null, m: {} }; } };
      const P = (o) => o;
      // 🚩 Drapeau : Kévin en tête en janvier ; en février Clément le rejoint à 5 points et passe devant au départage officiel → Kévin GARDE le Drapeau
      out.dr1 = avec([moisDe(202701, P({ Kévin: 1, Clément: 2, Devlin: 3 }), { Kévin: 3, Clément: 1, Devlin: 0 }, ["Devlin"]), moisDe(202702, P({ Clément: 1, Kévin: 2, Devlin: 3 }), { Kévin: 5, Clément: 5, Devlin: 1 }, ["Devlin"])], false, () => (etatTitres(2027).drapeau || {}).nom);
      // 🚩 première attribution à égalité (personne ne le tenait) : le 1er du départage officiel (Clément)
      out.dr2 = avec([moisDe(202701, P({ Clément: 1, Kévin: 2, Devlin: 3 }), { Kévin: 3, Clément: 3, Devlin: 0 }, ["Devlin"])], false, () => (etatTitres(2027).drapeau || {}).nom);
      // 🔥 Flamme : séries égales dès janvier (Kévin, Clément) : le mieux classé au général (Clément) ; en février, Kévin passe devant au général mais Clément GARDE la Flamme
      out.fl = avec([moisDe(202701, P({ Clément: 1, Kévin: 2, Devlin: 3 }), { Clément: 3, Kévin: 2, Devlin: 0 }, ["Devlin"]), moisDe(202702, P({ Kévin: 1, Clément: 2, Devlin: 3 }), { Kévin: 6, Clément: 5, Devlin: 0 }, ["Devlin"])], false,
        () => { const C = etatTitres(2027); return (C.flamme || {}).nom + "/" + (C.flamme || {}).val; });
      // 🔍 Flair : égalité sans détenteur parmi les ex æquo → le plus de 1res places, puis le temps total sur les trésors trouvés en commun
      const T = (c, m, ch) => ({ circuit: c, saison: 2027, mois: m, chrono: true, final: true, chercheurs: ch.map(([nom, s]) => ({ nom, j: 20270000 + m * 100 + 5, s })) });
      TRESORS = { l: [T("silverstone", 1, [["Kévin", 100], ["Clément", 200], ["Devlin", 300]]), T("djeddah", 2, [["Clément", 100], ["Devlin", 200], ["Kévin", 300]]), T("melbourne", 3, [["Devlin", 100], ["Kévin", 200], ["Théo", 300]])], trouves: [], total: 0 };
      out.flT = (flairSaison(2027) || {}).nom;   // Kévin 6 = Devlin 6, Clément (détenteur, 5) hors jeu ; 1 or chacun ; temps commun : Kévin 600 s, Devlin 600 s → … égalité → mieux classé
      TRESORS.l[2].chercheurs[0].s = 50; out.flT2 = (flairSaison(2027) || {}).nom;   // Devlin 550 s < Kévin 600 s → Devlin
      TRESORS = { l: [T("silverstone", 1, [["Kévin", 100], ["Clément", 200], ["Devlin", 300]]), T("djeddah", 2, [["Devlin", 100], ["Clément", 200], ["Théo", 300]])], trouves: [], total: 0 };
      out.flO = (flairSaison(2027) || {}).nom;   // Kévin 3, Clément 4, Devlin 4 : Clément 0 or, Devlin 1 or → Devlin
      // ⚔️ souvenirs pour toujours (saison complète)
      const m12 = [moisDe(202712, P({ Kévin: 1, Clément: 2, Devlin: 3 }), { Kévin: 40, Clément: 30, Devlin: 20 }, ["Devlin"])];
      out.garde = avec(m12, true, () => { const G = titresGardes(); return { G, k: ["drapeau2027", "flamme2027", "flair2027"].filter(id => debloques("Kévin").has("plaque." + id)), d: ["drapeau2027", "flamme2027", "flair2027"].filter(id => debloques("Devlin").has("plaque." + id)), vit: vitrineFiche("Kévin"),
        titres: (() => { VIT_ONGLET = "titres"; ETAT.podium = "defis"; montrerVue("trophees"); rendreTrophees(); const t = (document.querySelector(".titres-gardes") || {}).textContent || ""; return t; })(), o: texteOrigineItem("Kévin", "plaque", "drapeau2027").p }; });
      return out; });
    const an = quand.slice(0, 4);
    ok(r.dr1 === "Kévin" && r.dr2 === "Clément", an + " · 🚩 Drapeau : à égalité de points, Kévin (détenteur) le garde ; première attribution à égalité : Clément (départage du championnat) " + JSON.stringify([r.dr1, r.dr2]));
    ok(r.fl === "Clément/2", an + " · 🔥 Flamme : séries égales → le mieux classé (Clément) ; ensuite il la garde à égalité " + r.fl);
    ok(r.flO === "Devlin" && r.flT2 === "Devlin" && !!r.flT, an + " · 🔍 Flair : égalité → le plus de 1res places (Devlin) ; puis le meilleur temps total sur les trésors communs (Devlin) " + JSON.stringify([r.flO, r.flT, r.flT2]));
    if (an === "2027") ok(!Object.keys(r.garde.G).length && !r.garde.k.length, "2027 : aucun titre gardé pour toujours avant la fin de la saison");
    else ok(r.garde.G.drapeau === "Kévin" && r.garde.G.flamme === "Kévin" && r.garde.k.join() === "drapeau2027,flamme2027" + (r.garde.G.flair === "Kévin" ? ",flair2027" : "") && r.garde.d.join() === (r.garde.G.flair === "Devlin" ? "flair2027" : "") &&
      /Drapeau de tête 2027 · pour toujours/.test(r.garde.vit) && /Flamme 2027 · pour toujours/.test(r.garde.vit) && /Gardés pour toujours, saison 2027/.test(r.garde.titres) && /pour toujours/.test(r.garde.o),
      "1/1/2028 : Kévin garde 🚩 Drapeau 2027 et 🔥 Flamme 2027 pour toujours (plaques, fiche, Trophées › Titres) ; Flair 2027 à " + r.garde.G.flair + " " + JSON.stringify(r.garde.G));
    ok(!err.length, an + " · titres : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 6 bis. Petite vue (aperçu admin, cachette d'EXEMPLE) : l'encadré ouvert, avec le classement, ne passe pas sous le joystick ---------- */
  for (const sombre of [false, true]) { const tag = sombre ? "sombre" : "clair";
    const { ctx, p, err } = await page(b, { quand: "2026-11-25T10:00:00", session: { role: "admin" }, sombre });
    await p.evaluate(() => { sessionStorage.setItem("versus.adminOn", "1"); localStorage.setItem("versus.apercuSaison", "1"); }); await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto").forEach(x => x.remove()); montrerVue("trophees"); }); await p.waitForTimeout(600);
    await p.evaluate(() => ouvrirApercuTresor()); await p.waitForFunction(() => TRESOR_APERCU && TRESOR_APERCU.pEx, null, { timeout: 20000 }).catch(() => {});
    await p.evaluate(() => { TRESOR_APERCU.avecCh = true; apDonnees(); poserTresorDOM(document); document.querySelector(".gp-piste .gp-lancer").click(); document.querySelector(".gp-piste .gp-lancer").click(); }); await p.waitForTimeout(800);
    await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").classList.add("ouverte")); await p.waitForTimeout(300);
    const joy = await p.evaluate(() => { const j = document.querySelector(".gp-piste .p3-joy"), e = document.querySelector(".gp-piste .gp-enigme.ouverte"); if (!j || !e || j.hidden || !j.getBoundingClientRect().width) return { vu: false };
      const a = j.getBoundingClientRect(), r = e.getBoundingClientRect(); return { vu: true, croise: a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top, joyBas: Math.round(a.bottom), encHaut: Math.round(r.top), liste: !!e.querySelector(".tc-l li") }; });
    ok(joy.vu && joy.liste && !joy.croise, "petite vue (" + tag + ") : l'encadré ouvert, avec le classement, s'arrête sous le joystick " + JSON.stringify(joy));
    await p.evaluate(() => document.querySelectorAll("#toast, .toast, .bulle-portrait").forEach(x => x.style.display = "none"));
    await p.locator("#gp-piste").screenshot({ path: CAP + "/direct-8-joystick-" + tag + ".png" });
    ok(!err.length, "petite vue (" + tag + ") : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  /* ---------- 7. Relecture en direct : jamais hors de la page Course ; arrêtée quand tout est définitif ---------- */
  { const E = { final: false };
    const serveur = { tresors: (c, m) => ({ ok: true, maintenant: m, trouves: [], total: 0, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: ENIGME, chrono: true, final: E.final, fige: E.final, pilotes: 5, lance: false, actif: false, cumul: 0,
      chercheurs: [{ nom: "Clément", j: 20261204, s: 492 }] }] }) };
    const { ctx, p, err, req } = await page(b, { quand: "2026-12-10T10:00:00", session: { role: "perso", nom: "Kévin" }, serveur });
    await pageCourse(p); await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {});
    const n0 = req.filter(c => c.action === "tresors").length, lance = await p.evaluate(() => !!TRESOR_DIRECT);
    await p.clock.fastForward(61000); await p.clock.runFor(1200); await p.waitForTimeout(300);
    const n1 = req.filter(c => c.action === "tresors").length;
    ok(lance && n1 === n0 + 1, "page Course : une relecture par minute (" + (n1 - n0) + ")");
    await p.evaluate(() => montrerVue("classement")); await p.waitForTimeout(300);
    await p.clock.fastForward(60000); await p.clock.runFor(1200); await p.clock.fastForward(60000); await p.clock.runFor(1200); await p.waitForTimeout(300);
    const n2 = req.filter(c => c.action === "tresors").length, arr = await p.evaluate(() => !TRESOR_DIRECT);
    ok(n2 === n1 && arr, "sur la page Classement : 0 relecture en 2 min, boucle arrêtée (" + (n2 - n1) + ")");
    await pageCourse(p); await p.waitForTimeout(500); const rel = await p.evaluate(() => !!TRESOR_DIRECT);
    E.final = true; await p.clock.fastForward(61000); await p.clock.runFor(1200); await p.waitForTimeout(400);
    const fin = await p.evaluate(() => ({ stop: !TRESOR_DIRECT, f: TRESORS.l[0].final })), n3 = req.filter(c => c.action === "tresors").length;
    await p.clock.fastForward(180000); await p.clock.runFor(1200); await p.waitForTimeout(300);
    const n4 = req.filter(c => c.action === "tresors").length;
    ok(rel && fin.stop && fin.f && n4 === n3, "retour sur Course : la relecture reprend ; dès que tout est définitif, la boucle s'arrête (plus aucune relecture en 3 min)");
    ok(!err.length, "relecture : 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }

  await b.close(); console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
