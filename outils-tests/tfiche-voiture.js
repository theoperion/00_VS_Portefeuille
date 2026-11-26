/* Test (Théo, 26/11) · la vitrine d'un pilote (vue « fiche », bouton « 🏆 Vitrines » ou toucher un nom) :
   - ordre des blocs : pastilles des pilotes, en-tête (avatar, nom, numéro), vitrine (en saison), SA F1, puis « 📈 Ses chiffres » tout en bas ;
   - UNE SEULE voiture 3D à l'écran ; changer de pilote change la voiture ; quitter la vitrine coupe la 3D ;
   - toujours en 3D à l'ouverture (même si l'Écurie est réglée en 2D) ; « ✏️ 2D » arrête complètement la 3D, pour la vitrine ouverte seulement ;
     au changement de pilote et à la réouverture, retour en 3D ; la mémoire de l'Écurie (versus.ecuVue) n'est ni lue ni écrite ;
   - mode léger ou appareil sans 3D : la voiture en 2D, sans bouton ;
   - « Ses chiffres » replié par défaut, un toucher le déplie (la performance apparaît) ;
   - pilote sans écurie enregistrée : voiture de série + « Pas encore personnalisée » ;
   - rien de secret : un objet de 2027 enregistré ne se voit pas avant le 1/1 (décembre 2026 : voiture de série) ;
   - « Voir son garage › » ouvre son garage dans le Podium ;
   - ma vitrine ET celle d'un autre ; on dit « Vitrine » partout (plus « Fiche ») ; fluide (processeur ×4) ;
     0 erreur JS ; 390 px en clair et en sombre, sans débordement ; 4 captures.
   Fausses données uniquement (serveur Google intercepté). Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tfiche-voiture.js
   (PORT=… pour un autre port, API_VERSUS=/chemin/vers/API.js si app_scripts n'est pas à côté de ce dépôt, CAPTURES=… pour le dossier des captures) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "fiche-voiture");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const API = fs.readFileSync(process.env.API_VERSUS || __dirname + "/../../app_scripts/versus/API.js", "utf8");
const masquer = eval("(" + API.match(/function vsMasquerMontants_\(o, nomMoi\) \{[\s\S]*?\n\}\n/)[0].replace("function vsMasquerMontants_", "function") + ")");
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function pilote(nom, base, jusqua) {
  const KS = []; for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k <= jusqua) KS.push(k); }
  const st = [{ v: 0, cum: 0 }, { v: 0, cum: 0 }], rows = [];
  KS.forEach((k, i) => { const sai = [], calc = [];
    const env = [0, 1].map(e => { const prev = st[e].v; const verse = i === 0 ? base * (e ? .4 : .6) : (rnd() < .6 ? Math.round((.01 + rnd() * .02) * base) : 0);
      const val = Math.round((prev + verse) * (1 + (rnd() - .45) * .08) * 100) / 100, gain = val - prev - verse, den = prev + verse / 2;
      st[e].cum += verse; st[e].v = val; return { verse, val, gain, r: den > 0 ? gain / den : null, cum: st[e].cum, prev }; });
    env.forEach(x => sai.push(x.verse, x.val)); sai.push(null, null, null, null);
    const T = { verse: env[0].verse + env[1].verse, val: env[0].val + env[1].val, prev: env[0].prev + env[1].prev, cum: env[0].cum + env[1].cum };
    T.gain = T.val - T.prev - T.verse; T.r = T.prev + T.verse / 2 > 0 ? T.gain / (T.prev + T.verse / 2) : null;
    [T, env[0], env[1]].forEach(x => calc.push(x.verse, x.val, x.gain, x.r, x.cum)); for (let j = 0; j < 10; j++) calc.push(0);
    rows.push([k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", sai, calc]); });
  return { nom, rows };
}
// Nicolas n'a rien enregistré (voiture de série) ; Kévin a enregistré un objet de 2027 (livrée « Chrome » d'un monde) : invisible avant le 1/1
const ECURIES = { "Théo": { equip: { livree: "rouge", numero: 7 } }, "Kévin": { equip: { livree: "chrome", numero: 44 } }, "Clément": { equip: { numero: 3 } }, "Devlin": { equip: { numero: 16 } } };
function donnees(moi, jusqua) {
  seed = 7;
  const KS = []; for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k <= jusqua) KS.push(k); }
  const d = { ok: true, version: 91, genere: "2027-01-01T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map(n => pilote(n, n === moi ? 5e6 : 20000 + 90000 * rnd(), jusqua)),
    marche: { indices: ["S&P 500"], mois: KS.map(k => [k, .004]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECURIES, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
  const m = masquer(d, moi); m.session = { role: "perso", nom: moi }; return m;
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  const rep = donnees(o.moi, o.jusqua);
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : rep) }); });
  await p.addInitScript(leger => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.ecurieTeaser", "1"); localStorage.setItem("versus.ecuBandeau", "1");
    localStorage.setItem("versus.ecuVue", "2d");   // l'Écurie est réglée en 2D : la vitrine doit quand même s'ouvrir en 3D
    window.VERSUS_LEGER = leger;   // la machine de test (sans carte graphique) passerait sinon en mode léger tout seul
    ["2026", "2027"].forEach(y => { localStorage.setItem("versus.gpVu." + y, y + "12"); localStorage.setItem("versus.baVu." + y, y + "12"); }); }, !!o.leger);
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => {
    document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov, .nvs, .af3d").forEach(x => x.remove());
    // compteur des voitures 3D vivantes (chaque Piste.vitrine montée, moins celles arrêtées)
    window.__vivantes = new Set(); const v0 = Piste.vitrine;
    Piste.vitrine = function () { const i = v0.apply(this, arguments); const s0 = i.stop; i.stop = () => { window.__vivantes.delete(i); return s0(); }; window.__vivantes.add(i); return i; };
  });
  return { ctx, p, err };
}
const w = (p, t) => p.waitForTimeout(t);
/** état de la vitrine affichée */
const ETATV = () => {
  const v = document.querySelector("#v-fiche"), vis = el => !!el && el.checkVisibility();
  const blocs = [...v.children].map(e => e.classList.contains("chips") ? "pastilles" : e.classList.contains("f-tete") ? "entete" : e.classList.contains("vitrine") ? "vitrine" : e.classList.contains("f-voit") ? "voiture" : e.classList.contains("f-chiffres") ? "chiffres" : e.classList.contains("ere-fiche") ? "sacre" : e.classList.contains("fiche-retour") ? "retour" : "?" + e.className);
  const canv = [...document.querySelectorAll("canvas.v3d")].filter(vis), ch = v.querySelector("details.f-chiffres"), bt = v.querySelector("[data-fiche-vue]");
  return { vue: vueActive(), fiche: ETAT.fiche, blocs, vivantes: window.__vivantes.size, canvas: canv.length, fiche3d: V3D.fiche ? V3D.fiche.equipe() : null,
    svg: !!v.querySelector("#fiche-3d svg, #fiche-3d .voiture"), bouton: bt ? bt.textContent.trim() : null, serie: !!v.querySelector(".f-voit-serie") && /Pas encore personnalisée/.test(v.querySelector(".f-voit").textContent),
    chiffres: ch ? { open: ch.open, titre: ch.querySelector("summary").textContent, hero: !!ch.querySelector(".hero") && ch.querySelector(".hero").checkVisibility() } : null, ecuVue: localStorage.getItem("versus.ecuVue"),
    deborde: document.documentElement.scrollWidth > innerWidth + 1 || [...v.querySelectorAll("*")].some(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !x.closest(".scroll-x"); }) };
};
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const FEV = { quand: "2027-02-10T10:00:00", jusqua: 202701 }, DEC = { quand: "2026-12-10T10:00:00", jusqua: 202611 };

  // 1. en saison, vu par Kévin : ma vitrine puis celle des autres
  { const { ctx, p, err } = await page(b, Object.assign({ moi: "Kévin" }, FEV));
    await p.evaluate(() => document.querySelector("#vers-fiches") && document.querySelector("#vers-fiches").click()); await w(p, 900);   // le bouton « 🏆 Vitrines » du Classement
    let e = await p.evaluate(ETATV);
    ok(e.vue === "fiche" && e.fiche === "Kévin", "« 🏆 Vitrines » ouvre MA vitrine " + JSON.stringify([e.vue, e.fiche]));
    ok(JSON.stringify(e.blocs) === JSON.stringify(["pastilles", "entete", "vitrine", "voiture", "chiffres"]), "ordre des blocs : pastilles, en-tête, vitrine, sa F1, Ses chiffres " + JSON.stringify(e.blocs));
    ok(e.vivantes === 1 && e.canvas === 1 && e.fiche3d && e.fiche3d.nom === "Kévin", "ma vitrine : UNE voiture 3D, la mienne " + JSON.stringify([e.vivantes, e.canvas, e.fiche3d && e.fiche3d.nom]));
    ok(e.ecuVue === "2d" && e.bouton === "✏️ 2D", "ouverte en 3D même si l'Écurie est en 2D, bouton « ✏️ 2D » " + JSON.stringify([e.ecuVue, e.bouton]));
    ok(e.chiffres && !e.chiffres.open && !e.chiffres.hero && /Tes chiffres/.test(e.chiffres.titre), "« 📈 Tes chiffres » replié par défaut sur ma vitrine " + JSON.stringify(e.chiffres));
    await p.click("#v-fiche details.f-chiffres > summary"); await w(p, 400); e = await p.evaluate(ETATV);
    ok(e.chiffres.open && e.chiffres.hero, "un toucher déplie « Tes chiffres » : la performance apparaît " + JSON.stringify(e.chiffres));
    // passer à Devlin avec les pastilles
    await p.click('#v-fiche .chips [data-fiche="Devlin"]'); await w(p, 700); e = await p.evaluate(ETATV);
    ok(e.fiche === "Devlin" && e.vivantes === 1 && e.canvas === 1 && e.fiche3d && e.fiche3d.nom === "Devlin" && e.fiche3d.numero === 16, "pastille Devlin : la voiture change (Devlin, n° 16), toujours une seule 3D " + JSON.stringify([e.vivantes, e.canvas, e.fiche3d]));
    ok(/Ses chiffres/.test(e.chiffres.titre) && !e.serie, "vitrine d'un autre : « 📈 Ses chiffres », écurie enregistrée (pas « de série ») " + JSON.stringify([e.chiffres.titre, e.serie]));
    // ✏️ 2D : la 3D s'arrête complètement, pour cette vitrine seulement
    await p.click("#v-fiche [data-fiche-vue]"); await w(p, 400); e = await p.evaluate(ETATV);
    ok(e.vivantes === 0 && e.canvas === 0 && !e.fiche3d && e.svg && e.bouton === "🧊 3D", "« ✏️ 2D » : plus aucune 3D, le dessin 2D, bouton « 🧊 3D » " + JSON.stringify([e.vivantes, e.canvas, e.svg, e.bouton]));
    ok(e.ecuVue === "2d", "la mémoire de l'Écurie n'est pas touchée " + e.ecuVue);
    await p.click("#v-fiche [data-fiche-vue]"); await w(p, 500); e = await p.evaluate(ETATV);
    ok(e.vivantes === 1 && e.canvas === 1 && e.bouton === "✏️ 2D", "« 🧊 3D » : la 3D revient (une seule) " + JSON.stringify([e.vivantes, e.canvas, e.bouton]));
    await p.click("#v-fiche [data-fiche-vue]"); await w(p, 300);
    await p.click('#v-fiche .chips [data-fiche="Nicolas"]'); await w(p, 700); e = await p.evaluate(ETATV);
    ok(e.vivantes === 1 && e.canvas === 1 && e.fiche3d && e.fiche3d.nom === "Nicolas", "en 2D puis changement de pilote : retour en 3D " + JSON.stringify([e.vivantes, e.fiche3d && e.fiche3d.nom]));
    ok(e.serie && e.fiche3d.livree === "couleur", "Nicolas n'a rien enregistré : voiture de série + « Pas encore personnalisée » " + JSON.stringify([e.serie, e.fiche3d.livree]));
    // quitter la vitrine : la 3D s'arrête
    await p.evaluate(() => allerA("classement")); await w(p, 500); e = await p.evaluate(ETATV);
    ok(e.vivantes === 0 && e.canvas === 0 && !e.fiche3d, "on quitte la vitrine : la 3D est coupée " + JSON.stringify([e.vivantes, e.canvas]));
    // réouverture après un passage en 2D : 3D
    await p.evaluate(() => ouvrirFicheDe("Devlin")); await w(p, 500); await p.click("#v-fiche [data-fiche-vue]"); await w(p, 300);
    await p.evaluate(() => allerA("mois")); await w(p, 400); await p.evaluate(() => ouvrirFicheDe("Devlin")); await w(p, 700); e = await p.evaluate(ETATV);
    ok(e.vivantes === 1 && e.bouton === "✏️ 2D" && e.chiffres && !e.chiffres.open, "réouverture : de nouveau en 3D, « Ses chiffres » replié " + JSON.stringify([e.vivantes, e.bouton, e.chiffres && e.chiffres.open]));
    // Voir son garage ›
    await p.click("#v-fiche [data-fiche-garage]"); await w(p, 900);
    const g = await p.evaluate(() => ({ vue: vueActive(), voir: ECU_VOIR, garage: !!document.querySelector("#garage"), fiche3d: !!V3D.fiche }));
    ok(g.vue === "trophees" && g.voir === "Devlin" && g.garage && !g.fiche3d, "« Voir son garage › » ouvre le garage de Devlin (et la 3D de la vitrine est arrêtée) " + JSON.stringify(g));
    const nb = await p.evaluate(() => window.__vivantes.size); ok(nb <= 1, "dans le Podium, toujours une seule voiture 3D " + nb);
    // Théo, 26/11 : on dit « Vitrine » partout (plus « Fiche ») pour ouvrir la vitrine d'un pilote
    const mots = await p.evaluate(async () => { const w = t => new Promise(r => setTimeout(r, t)), fiche = [];
      const scan = ou => { const v = document.querySelector('.view:not([hidden])'); const t = v.innerText + " " + [...v.querySelectorAll("[aria-label],[title]")].map(e => (e.getAttribute("aria-label") || "") + " " + (e.getAttribute("title") || "")).join(" ");
        (t.match(/\bFiches?\b|\bsa fiche\b|📂/g) || []).forEach(m => fiche.push(ou + " : " + m)); };
      const gar = (document.querySelector("#garage .gar-fiche") || {}).textContent || "", gr = [...document.querySelectorAll(".grille-dep .gr-f")].map(b => b.textContent.trim() + "|" + b.getAttribute("aria-label"));
      scan("écurie"); ETAT.podium = "gp"; ECU_VOIR = null; garder(); rendreTrophees(); await w(600); scan("course");
      allerA("classement"); await w(500); scan("classement"); const bt = (document.querySelector("#vers-fiches") || {}).textContent || "", aide = (document.querySelector("#v-classement .tour-aide") || {}).textContent || "";
      return { gar, gr, bt, aide, fiche }; });
    ok(/^🏆 Vitrine de Devlin/.test(mots.gar) && mots.gr.length === 5 && mots.gr.every(x => /^🏆Vitrine\|Vitrine de /.test(x)), "Podium : « 🏆 Vitrine de Devlin » dans son garage, « 🏆 Vitrine » sur la grille " + JSON.stringify([mots.gar, mots.gr[0]]));
    ok(mots.bt === "🏆 Vitrines" && /ouvrir sa vitrine/.test(mots.aide), "Classement : bouton « 🏆 Vitrines », aide « Touche un pilote pour ouvrir sa vitrine » " + JSON.stringify([mots.bt, mots.aide]));
    ok(!mots.fiche.length, "plus aucun « Fiche » visible (Classement, Course, Écurie) " + mots.fiche.slice(0, 4).join(" ; "));
    // la plaque et les badges de l'en-tête s'expliquent au toucher, sans débordement à 390 px
    await p.evaluate(() => ouvrirFicheDe("Kévin")); await w(p, 600); e = await p.evaluate(ETATV);
    ok(!e.deborde, "rien ne déborde à 390 px (clair)");
    ok(!err.length, "0 erreur JS (saison) " + err.slice(0, 3).join(" | "));
    await ctx.close(); }

  // 2. mode léger, puis appareil sans 3D : la voiture en 2D, sans bouton
  { const { ctx, p, err } = await page(b, Object.assign({ moi: "Théo", leger: true }, FEV));
    await p.evaluate(() => ouvrirFicheDe("Clément")); await w(p, 600); let e = await p.evaluate(ETATV);
    ok(e.vivantes === 0 && e.canvas === 0 && e.svg && e.bouton === null, "mode léger : la voiture en 2D, sans 3D ni bouton " + JSON.stringify([e.vivantes, e.svg, e.bouton]));
    await p.evaluate(() => { window.VERSUS_LEGER = false; Piste.supporte = () => false; ouvrirFicheDe("Théo"); }); await w(p, 600); e = await p.evaluate(ETATV);
    ok(e.vivantes === 0 && e.canvas === 0 && e.svg && e.bouton === null, "appareil sans 3D : la voiture en 2D, sans bouton " + JSON.stringify([e.vivantes, e.svg, e.bouton]));
    ok(!err.length, "0 erreur JS (2D) " + err.slice(0, 3).join(" | "));
    await ctx.close(); }

  // 3. décembre 2026 (tour de chauffe) : rien de 2027, la vitrine marche sans trophées
  { const { ctx, p, err } = await page(b, Object.assign({ moi: "Théo" }, DEC));
    await p.evaluate(() => ouvrirFicheDe("Kévin")); await w(p, 700); const e = await p.evaluate(ETATV);
    ok(JSON.stringify(e.blocs) === JSON.stringify(["pastilles", "entete", "voiture", "chiffres"]), "décembre : en-tête, sa F1, Ses chiffres (pas de vitrine de trophées) " + JSON.stringify(e.blocs));
    ok(e.vivantes === 1 && e.fiche3d && e.fiche3d.livree === "couleur" && e.fiche3d.numero === 44, "décembre : la livrée 2027 enregistrée par Kévin ne se voit pas (série), son numéro oui " + JSON.stringify(e.fiche3d));
    const t = await p.evaluate(() => document.querySelector("#v-fiche").innerText); ok(!/Chrome/i.test(t), "décembre : aucun nom d'objet de 2027 dans la vitrine");
    ok(!err.length, "0 erreur JS (décembre) " + err.slice(0, 3).join(" | "));
    await ctx.close(); }

  // 4. fluidité (comme tperf : processeur ralenti ×4) : du toucher d'une pastille à l'image affichée, médiane de 5 essais, en 3D et en mode léger
  for (const leger of [false, true]) {
    const { ctx, p, err } = await page(b, Object.assign({ moi: "Kévin", leger }, FEV));
    await p.evaluate(() => ouvrirFicheDe("Kévin")); await w(p, 800);
    const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: +(process.env.CPU || 4) }); await w(p, 500);
    const t = [];
    for (let i = 0; i < 5; i++) for (const n of ["Devlin", "Clément"]) t.push(await p.evaluate(n => new Promise(res => { const t0 = performance.now(); document.querySelector('#v-fiche .chips [data-fiche="' + n + '"]').click();
      requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => res(performance.now() - t0); c.port2.postMessage(0); }); }), n));
    t.sort((x, y) => x - y); const med = t[Math.floor(t.length / 2)], nb = await p.evaluate(() => window.__vivantes.size);
    ok(med < 250 && nb === (leger ? 0 : 1), "fluide (" + (leger ? "léger, 2D" : "3D") + ", processeur ×4) : changer de pilote s'affiche en " + Math.round(med) + " ms (médiane, < 250 ms), " + nb + " voiture 3D");
    ok(!err.length, "0 erreur JS (fluidité) " + err.slice(0, 3).join(" | "));
    await ctx.close();
  }

  // 5. captures 390 px, clair et sombre : ma vitrine et celle d'un autre (vu par Kévin)
  for (const sombre of [false, true]) {
    const s = sombre ? "sombre" : "clair", { ctx, p, err } = await page(b, Object.assign({ moi: "Kévin", sombre }, FEV));
    for (const [n, f] of [["Kévin", "ma-vitrine"], ["Devlin", "vitrine-autre"]]) {
      await p.evaluate(nn => ouvrirFicheDe(nn), n); await w(p, 900);
      await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .nvs").forEach(x => x.remove()));
      const e = await p.evaluate(ETATV); ok(!e.deborde && e.vivantes === 1, f + " (" + s + ") : rien ne déborde à 390 px, une seule 3D");
      if (n !== "Kévin") { await p.click("#v-fiche details.f-chiffres > summary"); await w(p, 500); }   // ma vitrine : « Tes chiffres » replié ; l'autre : « Ses chiffres » déplié
      const h = await p.evaluate(() => document.documentElement.scrollHeight); await p.setViewportSize({ width: 390, height: h }); await w(p, 700);   // toute la vitrine d'un coup (la barre du bas reste en bas)
      await p.screenshot({ path: DOSSIER + "/" + f + "-" + s + ".png" }); await p.setViewportSize({ width: 390, height: 844 }); await w(p, 300);
    }
    ok(!err.length, "0 erreur JS (captures " + s + ") " + err.slice(0, 3).join(" | "));
    await ctx.close();
  }
  await b.close(); console.log(ko.length ? ko.length + " NON" : "Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
