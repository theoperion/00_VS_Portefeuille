/* Test trésor compact, 26/11 · chasse au trésor : un encadré COMPACT qui ne cache plus la course (Théo, 26/11).
   Paysage 844×390 et portrait 390×844, clair et sombre, petite vue et plein écran (vrai plein écran du navigateur).
   Vérifie : replié par défaut (« 🗝️ Trésor · 🔍 Lancer ») ; ne couvre ni le centre de la piste ni le joystick ; un toucher le déplie, un autre le replie ;
   « ❔ Comment ça marche » s'ouvre DANS l'élément en plein écran (la tuile « Le trésor » des règles) ; la barre admin (repliée, sur une ligne)
   ne couvre jamais le bouton de lancement ; pendant la recherche, l'énigme se lit en entier sans couvrir le centre ni le joystick ; 0 erreur JS.
   Aperçu admin uniquement (exemple inventé, rien n'est envoyé) ; fausses données, serveur Google intercepté.
   Captures : seulement l'encadré replié, ou déplié AVANT le lancement (jamais l'énigme).
   Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/ttresor-plein.js   (PORT=…, CAPTURES=dossier) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, CAP = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "tresor-plein");
try { fs.mkdirSync(CAP, { recursive: true }); } catch (e) { /* déjà là */ }
const fausses = session => ({ ok: true, version: 97, genere: "2026-12-03T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
/* mesures, dans la page : l'encadré, le joystick, le centre de la piste, la barre admin, le bouton de lancement */
const mesurer = p => p.evaluate(() => {
  const R = e => { if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } : null; };
  const croise = (a, b) => !!a && !!b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  const pi = document.getElementById("gp-piste"), cadre = R(document.querySelector(".gp-plein") || pi), en = document.querySelector(".gp-piste .gp-enigme");
  const E = R(en), J = R(document.querySelector(".gp-piste .p3-joy")), B = R(document.querySelector(".gp-piste .tap-band")), L = R(document.querySelector(".gp-piste .gp-lancer, .gp-piste .gp-arret"));
  const cx = cadre ? (cadre.l + cadre.r) / 2 : 0, cy = cadre ? (cadre.t + cadre.b) / 2 : 0, rd = r => r && { l: Math.round(r.l), t: Math.round(r.t), r: Math.round(r.r), b: Math.round(r.b) };
  return { E: rd(E), J: rd(J), B: rd(B), L: rd(L), centre: [Math.round(cx), Math.round(cy)], ouverte: !!(en && en.classList.contains("ouverte")),
    surCentre: !!E && E.l <= cx && E.r >= cx && E.t <= cy && E.b >= cy, surJoy: croise(E, J), bandeSurLancer: croise(B, L), bandeH: B ? Math.round(B.h) : 0,
    part: E && cadre ? Math.round(E.w * E.h / (cadre.w * cadre.h) * 100) : 0 };
});
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const [w, h, orient] of [[844, 390, "paysage"], [390, 844, "portrait"]]) for (const sombre of [false, true]) {
    const tag = orient + "-" + (sombre ? "sombre" : "clair");
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light", hasTouch: true }), p = await ctx.newPage(), err = [], req = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date("2026-12-03T10:00:00"));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c);
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : ["tickets", "mj", "avent"].includes(c.action) ? { ok: true } : fausses({ role: "admin" })) }); });
    await p.addInitScript(() => { ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.q3dAffichette", "versus.tresorAide"].forEach(k => localStorage.setItem(k, "1"));
      localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.apercuSaison", "1"); sessionStorage.setItem("versus.adminOn", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .ba").forEach(x => x.remove()); montrerVue("trophees"); }); await p.waitForTimeout(600);
    await p.evaluate(() => ouvrirApercuTresor()); await p.waitForFunction(() => TRESOR_APERCU && TRESOR_APERCU.pEx, null, { timeout: 20000 }).catch(() => {});
    await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
    const cacheToast = () => p.evaluate(() => (typeof BA_OUVERTE !== "undefined" && BA_OUVERTE && BA_OUVERTE.fermer(false), document).querySelectorAll("#toast, .toast, .bulle-portrait").forEach(x => x.style.display = "none"));

    /* ---- petite vue (la carte de la course dans la page) ---- */
    await cacheToast(); await p.evaluate(() => document.getElementById("gp-piste").scrollIntoView({ block: "center" })); await p.waitForTimeout(300);
    const m0 = await mesurer(p);
    ok(!m0.ouverte && m0.E && !m0.surCentre && !m0.surJoy, tag + " · petite vue : replié par défaut, ne couvre ni le centre de la piste ni le joystick " + JSON.stringify({ E: m0.E, J: m0.J, c: m0.centre, part: m0.part }));
    ok(!m0.bandeSurLancer, tag + " · petite vue : la barre admin ne couvre pas « 🔍 Lancer » " + JSON.stringify({ B: m0.B, L: m0.L }));
    await p.locator("#gp-piste").screenshot({ path: CAP + "/petite-" + tag + "-replie.png" });

    /* ---- plein écran ---- */
    await p.evaluate(() => ouvrirPleinGP(saisonCourante() || 2026)); await p.waitForTimeout(1500); await p.evaluate(() => apPres()); await p.waitForTimeout(1800);
    const fs1 = await p.evaluate(() => { const f = document.fullscreenElement || document.webkitFullscreenElement; return !!f && f.classList.contains("gp-plein"); });
    ok(fs1, tag + " · le plein écran du navigateur est bien sur la couche de la course");
    await cacheToast();
    const m1 = await mesurer(p), pill = await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme"); return e ? e.innerText.replace(/\s+/g, " ").trim() : ""; });
    ok(!m1.ouverte && /Trésor/.test(pill) && /Lancer/.test(pill) && !/chrono compte|or, argent/.test(pill), tag + " · plein écran : replié par défaut, « 🗝️ Trésor · 🔍 Lancer », sans le long paragraphe « " + pill.slice(0, 60) + " »");
    ok(m1.E && !m1.surCentre && !m1.surJoy && m1.J, tag + " · plein écran replié : ne couvre ni le centre de la piste ni le joystick " + JSON.stringify({ E: m1.E, J: m1.J, c: m1.centre, part: m1.part }));
    ok(!m1.bandeSurLancer && m1.B && m1.bandeH <= 40, tag + " · plein écran : barre admin repliée, sur une ligne, ne couvre pas « 🔍 Lancer » " + JSON.stringify({ B: m1.B, L: m1.L }));
    await p.screenshot({ path: CAP + "/plein-" + tag + "-replie.png" });
    // la barre admin dépliée : toujours une seule ligne, toujours loin du bouton de lancement
    const bd = await p.evaluate(() => { const t = document.querySelector(".gp-piste .tap-band [data-tapplie]"); if (t) t.click(); return !!t; }); await p.waitForTimeout(250);
    const m1b = await mesurer(p), btns = await p.evaluate(() => [...document.querySelectorAll(".gp-piste .tap-band button")].filter(x => x.getClientRects().length).length);
    ok(bd && btns >= 7 && m1b.bandeH <= 40 && !m1b.bandeSurLancer && !m1b.surJoy, tag + " · barre admin dépliée : tous ses boutons sur une ligne, sans couvrir « 🔍 Lancer » " + JSON.stringify({ B: m1b.B, L: m1b.L, n: btns }));
    await cacheToast(); await p.screenshot({ path: CAP + "/plein-" + tag + "-barre-admin.png" });
    await p.evaluate(() => { const t = document.querySelector(".gp-piste .tap-band [data-tapplie]"); if (t) t.click(); }); await p.waitForTimeout(200);
    // un toucher déplie (avant le lancement : explication courte, classement, « Comment ça marche »)
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").click()); await p.waitForTimeout(300);
    const m2 = await mesurer(p), dep = await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme"), v = s => { const x = e.querySelector(s); return !!x && !!x.getClientRects().length; }; return { aide: v(".tc-aide"), cl: v(".tc-cl"), txt: e.innerText }; });
    ok(m2.ouverte && dep.aide && dep.cl && !/or, argent, bronze/.test(dep.txt), tag + " · un toucher déplie : explication courte, classement, « ❔ Comment ça marche » (le détail est dans les règles)");
    await cacheToast(); await p.screenshot({ path: CAP + "/plein-" + tag + "-deplie.png" });
    // « ❔ Comment ça marche » : dans l'élément en plein écran
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme .tc-aide").click()); await p.waitForTimeout(500);
    const aide = await p.evaluate(() => { const f = document.fullscreenElement || document.webkitFullscreenElement, o = document.querySelector(".regles"); if (!o) return { o: false };
      const r = o.querySelector(".rg-c").getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 40, top = document.elementFromPoint(x, y);
      const fiche = o.querySelector("#rgt-tresor"); return { o: true, dedans: !!f && f.contains(o), vu: !!top && o.contains(top), tuile: !!fiche && !fiche.hidden, txt: (fiche || o).textContent }; });
    ok(aide.o && aide.dedans && aide.vu && aide.tuile && /Je lance ma recherche/.test(aide.txt), tag + " · « ❔ Comment ça marche » : la tuile « Le trésor » s'ouvre DANS le plein écran, visible au premier plan " + JSON.stringify({ o: aide.o, dedans: aide.dedans, vu: aide.vu, tuile: aide.tuile }));
    await cacheToast(); await p.screenshot({ path: CAP + "/plein-" + tag + "-comment.png" });
    await p.evaluate(() => { const x = document.querySelector(".regles #rg-x, .regles .rg-x"); if (x) x.click(); }); await p.waitForTimeout(300);
    const ferme = await p.evaluate(() => ({ r: !!document.querySelector(".regles"), plein: !!GP_PLEIN }));
    ok(!ferme.r && ferme.plein, tag + " · ✕ ferme les règles, on reste en plein écran");
    // un 2e toucher replie
    await p.evaluate(() => document.querySelector(".gp-piste .gp-enigme").click()); await p.waitForTimeout(250);
    ok(!(await mesurer(p)).ouverte, tag + " · un 2e toucher replie l'encadré");
    // pendant la recherche : l'énigme lisible en entier, sans couvrir le centre ni le joystick (PAS de capture : l'énigme ne se photographie pas)
    await p.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = ""; const bt = document.querySelector(".gp-piste .gp-lancer"); bt.click(); bt.click(); }); await p.waitForTimeout(800);
    const go = await p.evaluate(() => { const f = document.fullscreenElement, t = document.getElementById("toast"); return { dedans: !!f && !!t && f.contains(t), vu: !!t && !t.hidden && !!t.getClientRects().length, txt: t ? t.textContent : "" }; });
    ok(go.dedans && go.vu && /C'est parti/.test(go.txt), tag + " · le message « ⏱️ C'est parti ! » s'affiche DANS le plein écran " + JSON.stringify({ dedans: go.dedans, vu: go.vu, txt: go.txt.slice(0, 60) }));
    await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
    const m3 = await mesurer(p), lis = await p.evaluate(() => { const e = document.querySelector(".gp-piste .gp-enigme"), i = e && e.querySelector(".gp-txt i"); if (!i || !i.getClientRects().length) return { vu: false };
      return { vu: true, entier: getComputedStyle(i.parentNode).whiteSpace !== "nowrap" && e.scrollHeight <= e.clientHeight + 2 && i.textContent.length > 20, chr: !!e.querySelector(".gp-chr") }; });
    ok(lis.vu && lis.entier && lis.chr, tag + " · pendant la recherche : chrono + énigme lisible en entier (replié) " + JSON.stringify(lis));
    ok(m3.E && !m3.surCentre && !m3.surJoy, tag + " · pendant la recherche : l'encadré ne couvre ni le centre ni le joystick " + JSON.stringify({ E: m3.E, J: m3.J, c: m3.centre, part: m3.part }));
    // on sort : l'énigme n'existe plus en pause (règle conservée)
    await p.evaluate(() => document.querySelector(".gp-piste .gp-arret").click()); await p.waitForTimeout(500);
    const pz = await p.evaluate(() => ({ enig: !!document.querySelector(".gp-piste .gp-enigme .gp-txt i") && /Énigme d'exemple/.test(document.querySelector(".gp-piste .gp-enigme").textContent), rep: !!document.querySelector(".gp-piste .gp-lance.pause .gp-lancer") }));
    ok(pz.rep, tag + " · en pause : « ▶️ Reprendre » dans l'encadré replié");
    // reprise, trouvaille : « 🗝️ Trouvé en … » et la révélation de l'éclat, DANS le plein écran (pas de capture)
    await p.evaluate(() => document.querySelector(".gp-piste .gp-lancer").click()); await p.waitForTimeout(800); await p.evaluate(() => apPres()); await p.waitForTimeout(1500);
    const tv = await p.evaluate(async () => { const b = document.querySelector(".gp-piste .gp-tresor"); if (!b) return { obj: false }; await trouverTresor(TRESOR_EL.t, b); const f = document.fullscreenElement, t = document.getElementById("toast");
      return { obj: true, dedans: !!f && f.contains(t), vu: !t.hidden && !!t.getClientRects().length, txt: /Trouvé en/.test(t.textContent) }; });
    await p.waitForTimeout(1800);
    const rv = await p.evaluate(() => { const f = document.fullscreenElement, o = document.querySelector(".cb-rev, .revel"); return { o: !!o, dedans: !!f && !!o && f.contains(o) }; });
    ok(tv.obj && tv.dedans && tv.vu && tv.txt && rv.o && rv.dedans, tag + " · trouvaille : « 🗝️ Trouvé en … » et l'éclat s'affichent DANS le plein écran " + JSON.stringify({ tv, rv }));
    await p.evaluate(() => fermerPleinGP()); await p.waitForTimeout(800);
    const tb = await p.evaluate(() => { const t = document.getElementById("toast"); return !!t && t.parentNode === document.body; });
    ok(tb, tag + " · en sortant du plein écran, la zone des messages revient dans la page");
    await p.evaluate(() => document.querySelectorAll(".cb-rev, .revel").forEach(x => x.remove()));
    ok(!req.some(x => /^tresor(Depart|Arret|Trouve)$/.test(x.action)), tag + " · aperçu : rien n'est envoyé au serveur");
    ok(!err.length, tag + " · 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close();
  }
  /* ---- un joueur (pas admin), en vrai : pas de barre admin ; « Comment ça marche » depuis la fenêtre du classement aussi dans le plein écran ---- */
  { const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date("2026-12-03T10:00:00"));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, maintenant: Date.now(), trouves: [], total: 0, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, type: "trefle", enigme: "", enigmeCachee: true, chrono: true, final: false, lance: false, actif: false, cumul: 0, pilotes: 5, chercheurs: [{ nom: "Clément", j: 20261202, s: 900 }] }] }
        : ["tickets", "mj", "avent"].includes(c.action) ? { ok: true } : fausses({ role: "perso", nom: "Kévin" })) }); });
    await p.addInitScript(() => { ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.q3dAffichette", "versus.tresorAide"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); });
    await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1500);
    await p.evaluate(async () => { document.querySelectorAll(".revel, .regles, .tuto").forEach(x => x.remove()); montrerVue("trophees"); ETAT.podium = "gp"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 900)); });
    await p.waitForFunction(() => TRESORS && document.querySelector(".gp-piste .gp-enigme"), null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => ouvrirPleinGP(saisonCourante() || 2026)); await p.waitForTimeout(1500);
    const j = await p.evaluate(() => ({ band: !!document.querySelector(".tap-band"), en: !!document.querySelector(".gp-plein .gp-enigme") }));
    ok(j.en && !j.band, "joueur · plein écran : l'encadré est là, aucune barre admin");
    await p.evaluate(() => ouvrirClassementTresor("abudhabi")); await p.waitForTimeout(300);
    const c = await p.evaluate(() => { const f = document.fullscreenElement, o = document.querySelector(".tc-b"); return { o: !!o, dedans: !!f && !!o && f.contains(o) }; });
    await p.evaluate(() => document.querySelector(".tc-b .tc-aide").click()); await p.waitForTimeout(400);
    const a = await p.evaluate(() => { const f = document.fullscreenElement, o = document.querySelector(".regles"); return { o: !!o, dedans: !!f && !!o && f.contains(o) }; });
    ok(c.dedans && a.dedans, "joueur · plein écran : la fenêtre du classement et « Comment ça marche » s'ouvrent dans le plein écran " + JSON.stringify({ c, a }));
    await p.evaluate(() => fermerPleinGP()); await p.waitForTimeout(800);
    const apres = await p.evaluate(() => ({ r: !!document.querySelector("body > .regles"), fige: document.documentElement.classList.contains("fige") }));
    ok(apres.r && apres.fige, "joueur · on sort du plein écran avec les règles ouvertes : elles restent ouvertes dans la page " + JSON.stringify(apres));
    await p.evaluate(() => { const x = document.querySelector(".regles #rg-x"); if (x) x.click(); }); await p.waitForTimeout(200);
    ok(!(await p.evaluate(() => document.documentElement.classList.contains("fige"))), "joueur · ✕ : la page défile de nouveau");
    ok(!err.length, "joueur · 0 erreur JS " + JSON.stringify(err.slice(0, 3)));
    await ctx.close(); }
  await b.close(); console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
