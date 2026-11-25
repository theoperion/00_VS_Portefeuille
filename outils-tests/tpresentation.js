/* Test v20.62 (Théo) · 🎥 TOUR DE PRÉSENTATION avant les feux (remplace l'ancien « Survol guidé »).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tpresentation.js
   (PORT=… pour un autre port ; APP_SCRIPTS=/chemin/vers/app_scripts pour vérifier les cachettes du trésor, lues dans le dépôt PRIVÉ seulement :
   aucune position n'est écrite ici ni affichée, seulement l'écart en mètres).
   Vérifie : 1. (sans navigateur) chaque circuit a 3 à 6 repères ; 2. (si APP_SCRIPTS) le tour ne cadre jamais à moins de 30 m d'une cachette
   (point visé, caméra, repères ; 3D et 2D) ; 3. tour joué au 1er départ (durée raisonnable, la course part ensuite avec ses feux), sauté quand
   on rejoue, sauté en « réduire les animations », « Passer › » et un toucher sautent aux feux ; le bouton 🎥 le rejoue à la demande (menu ⋯ et
   plein écran), sans lancer de course ; « réduire les animations » + 🎥 = plans fixes et fondus ; 2D aussi ; plus aucun bouton « Survol » ;
   lisible à 390 px ; 0 erreur JS. Fausses données uniquement (serveur Google intercepté). */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), cp = require("child_process");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html", ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
// 1. la table des repères (sans navigateur)
const src = fs.readFileSync(path.join(__dirname, "..", "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { TRACES, PRESENTATION };\n  window.Piste = {");
global.window = {}; eval(src);
const { TRACES, PRESENTATION } = window.__P, ids = Object.keys(TRACES);
ok(ids.every(id => PRESENTATION[id] && PRESENTATION[id].length >= 3 && PRESENTATION[id].length <= 6), "les " + ids.length + " circuits ont 3 à 6 repères " + JSON.stringify(ids.filter(id => !(PRESENTATION[id] && PRESENTATION[id].length >= 3))));
// 2. les cachettes du trésor (dépôt privé, lecture seule)
let CACHES = null;
if (process.env.APP_SCRIPTS) {
  let t = ""; try { t = cp.execFileSync("git", ["-C", process.env.APP_SCRIPTS, "show", "origin/main:versus/Tresors.js"], { encoding: "utf8" }); } catch (e) { try { t = fs.readFileSync(path.join(process.env.APP_SCRIPTS, "versus", "Tresors.js"), "utf8"); } catch (e2) { t = ""; } }
  CACHES = {}; const re = /circuit:\s*'([a-z0-9]+)'[^}]*?p:\s*\[([^\]]+)\]/g; let m; while ((m = re.exec(t))) { const p = m[2].split(",").map(Number); (CACHES[m[1]] = CACHES[m[1]] || []).push([p[0], p[1], p[2]]); }
  ok(Object.keys(CACHES).length >= 10, "cachettes lues dans le dépôt privé (" + Object.keys(CACHES).length + " circuits ; positions non affichées)");
} else console.log("(APP_SCRIPTS non défini : vérification des cachettes sautée)");
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
function donnees() {
  const personnes = NOMS.map((n, i) => ({ nom: n, rows: n === "Nicolas" ? [] : [ligne(202610, 1000 + i, 0.01), ligne(202611, 1010 + i * 3, 0.004 * (i + 1))] }));
  return { ok: true, version: 87, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: ["S&P 500", "Nasdaq-100"], mois: [[202610, 0.004, 0.005], [202611, 0.004, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null,
    objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function ouvrir(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date("2026-11-25T12:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : donnees()) }); });
  await p.addInitScript(lent => { ["versus.tuto1", "versus.bullePortrait", "versus.deJanvier", "versus.aideVisite", "versus.aideVue.poursuite", "versus.aideVue.visite"].forEach(k => localStorage.setItem(k, "1"));
    localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.gpVu.2026", "0"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.feteChauffe", "202612");
    if (!lent) window.VERSUS_PRES_LENT = false; }, !!o.lent);   // 3D logicielle (lente) : le tour n'est pas coupé pour « téléphone qui rame »
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800);
  await p.evaluate(async d3 => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "gp"; ETAT.gp2d = d3 ? "0" : "1"; ETAT.gpVue3 = "poursuite"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees();
    await new Promise(r => setTimeout(r, 1200)); document.querySelectorAll(".revel, .ba, .ere-voile").forEach(x => x.remove()); }, !o.d2);
  return { p, ctx, err };
}
const etat = p => p.evaluate(() => ({ pres: !!GP_PRES, enPres: !!(GP_INST && GP_INST.api.presentationEnCours && GP_INST.api.presentationEnCours()), ov: !!document.querySelector("#gp-piste .gp-pres:not(.fin)"),
  demo: !!(GP_DEMO && GP_DEMO.enCours), cours: !!(GP_INST && GP_INST.api.enCours()), feux: GP_HORLOGE ? GP_HORLOGE.feux : null, type: GP_INST && GP_INST.api.type, fondu: !!document.querySelector("#gp-piste .p-fondu") }));
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), errs = [];
  // 2 bis. les cachettes : courbe du tour (3D) et centres de la 2D, à plus de 30 m
  if (CACHES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 300 } }), p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.setContent('<div id="b" style="width:390px;height:300px;position:relative"></div>'); await p.addScriptTag({ url: "http://localhost:" + PORT + "/piste.js" });
    const pb = [];
    for (const id of Object.keys(CACHES).filter(id => TRACES[id])) {
      const r = await p.evaluate(id => { const b = document.getElementById("b"); if (window.__a) window.__a.detruire(); b.innerHTML = ""; const noms = ["A", "B", "C", "D", "E"];
        const out = {}; [["poursuite", "grille"], ["helico", "vue"]].forEach(([cam, mode]) => { if (window.__a) window.__a.detruire(); b.innerHTML = "";
          window.__a = Piste.monter(b, { circuit: id, meteo: "beau", camera: cam, tour: 1, grille: noms, voitures: noms.map(n => ({ nom: n, couleur: "#fff" })), pts: { A: 0, B: 0, C: 0, D: 0, E: 0 }, focus: "A" });
          out[mode] = window.__a.planPresentation(mode); }); return out; }, id);
      // « cadrer » = le point visé (centre de l'image) près de la cachette alors que la caméra en est proche (< 200 m : plan rapproché) ;
      // et jamais la caméra elle-même à moins de 30 m de la cachette ; ni un repère à moins de 30 m. Les vues d'ensemble lointaines ne cadrent rien.
      let m = 1e9, quoi = ""; const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      for (const P of [r.grille, r.vue]) { if (!P) continue; P.points.forEach(q => CACHES[id].forEach(([x, y, z]) => { const k = [x, y, z], dc = d3(q.c, k), de = d3(q.e, k);
          if (d3(q.e, q.c) < 200 && dc < m) { m = dc; quoi = "point visé"; } if (de < m) { m = de; quoi = "caméra"; } }));
        P.reperes.forEach(rp => CACHES[id].forEach(([x, , z]) => { const d = Math.hypot(rp[0] - x, rp[1] - z); if (d < m) { m = d; quoi = "repère"; } })); }
      if (m < 30) pb.push(id + " " + Math.round(m) + " m (" + quoi + ")"); else console.log("   " + id + " : plus proche " + Math.round(m) + " m (" + quoi + ")");
    }
    ok(!pb.length, "trésor : le tour ne cadre jamais à moins de 30 m d'une cachette (point visé, caméra, repères) " + JSON.stringify(pb));
    await ctx.close();
  }
  // 3. 3D : 1er départ → tour complet, puis la course avec ses feux
  { const Z = await ouvrir(b); const sv = await Z.p.evaluate(() => ({ survol: !!document.querySelector("#gp-survol, [data-gpv-survol], .gp-survol-b"), tourp: document.querySelector("#gp-tourp") && document.querySelector("#gp-tourp").textContent }));
    ok(!sv.survol && /🎥 Tour de présentation/.test(sv.tourp || ""), "plus aucun bouton « Survol » ; « 🎥 Tour de présentation » dans le menu ⋯");
    if (await Z.p.evaluate(() => piste3D() && GP_INST && GP_INST.api.type === "3d")) {
      await Z.p.click("#gp-demo"); await Z.p.waitForFunction(() => GP_PRES, null, { timeout: 8000 }).catch(() => { });
      await Z.p.evaluate(() => { window.__t0 = performance.now(); window.__d = GP_PRES ? GP_PRES.duree : 0; }); await Z.p.waitForTimeout(800);
      const e1 = await etat(Z.p), lis = await Z.p.evaluate(() => { const o = document.querySelector("#gp-piste .gp-pres"), t = o && o.querySelector(".gp-pres-t").getBoundingClientRect(), x = o && o.querySelector(".gp-pres-x").getBoundingClientRect();
        if (!t || !x) return null; const dans = r => r.left >= 0 && r.right <= innerWidth + .5, sep = !(Math.min(t.right, x.right) > Math.max(t.left, x.left) && Math.min(t.bottom, x.bottom) > Math.max(t.top, x.top));
        return { dans: dans(t) && dans(x), sep, h: x.height, lab: o.querySelector(".gp-pres-x").getAttribute("aria-label") }; });
      await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 120); }); await Z.p.waitForTimeout(400);
      if (process.env.CAPTURES) await Z.p.screenshot({ path: path.join(process.env.CAPTURES, "presentation-390.png") });
      ok(e1.pres && e1.enPres && e1.ov && !e1.demo && e1.type === "3d", "3D, 1er départ (démo) : le tour de présentation se joue AVANT la course " + JSON.stringify(e1));
      ok(lis && lis.dans && lis.sep && lis.h >= 36 && /Passer/.test(lis.lab), "390 px : titre et « Passer › » lisibles, dans l'écran, sans se recouvrir (bouton " + (lis && Math.round(lis.h)) + " px, libellé accessible)");
      await Z.p.waitForFunction(() => !GP_PRES, null, { timeout: 30000 }).catch(() => { });
      const duree = await Z.p.evaluate(() => (performance.now() - window.__t0) / 1000), prevu = await Z.p.evaluate(() => window.__d / 1000); await Z.p.waitForTimeout(300); const e2 = await etat(Z.p);
      // la durée prévue (horloge du tour) ; la durée mesurée inclut la lenteur de la 3D logicielle du test (quelques images d'une seconde)
      ok(prevu >= 14 && prevu <= 20 && duree >= prevu - .5 && duree <= prevu + 10, "durée du tour raisonnable : " + prevu.toFixed(1) + " s prévues (15-20 s), jouées en entier (" + duree.toFixed(1) + " s mesurées en 3D logicielle)");
      ok(!e2.pres && !e2.ov && e2.demo && e2.cours && e2.feux === 3200, "à la fin du tour : la course part avec les feux " + JSON.stringify(e2));
      await Z.p.evaluate(() => document.getElementById("gp-fin").click()); await Z.p.waitForTimeout(500);
      // rejouer dans la même ouverture : pas de tour
      await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(1500); const e3 = await etat(Z.p);
      ok(!e3.pres && !e3.enPres && e3.demo, "rejouer dans la même ouverture : pas de tour, la course part tout de suite " + JSON.stringify(e3));
      await Z.p.evaluate(() => document.getElementById("gp-fin").click()); await Z.p.waitForTimeout(500);
      // 🎥 à la demande (menu ⋯) : le tour se rejoue, et rend la main sans lancer de course
      await Z.p.evaluate(() => { document.querySelector("details.gp-plus").open = true; }); await Z.p.click("#gp-tourp"); await Z.p.waitForTimeout(900); const e4 = await etat(Z.p);
      await Z.p.click("#gp-piste .gp-pres-x"); await Z.p.waitForTimeout(700); const e5 = await etat(Z.p);
      ok(e4.pres && e4.enPres && !e4.cours, "🎥 (menu ⋯) : le tour se rejoue à la demande " + JSON.stringify(e4));
      ok(!e5.pres && !e5.enPres && !e5.cours, "« Passer › » après 🎥 : la main revient à la vue, aucune course lancée " + JSON.stringify(e5));
      // plein écran : bouton 🎥 dans la barre
      await Z.p.click("#gp-plein-gros"); await Z.p.waitForTimeout(900);
      const pl = await Z.p.evaluate(() => { const x = document.querySelector(".gpp-tourp"); if (!x) return null; const r = x.getBoundingClientRect(); return { lab: x.getAttribute("aria-label"), w: r.width, vis: r.right <= innerWidth && r.left >= 0 }; });
      await Z.p.click(".gpp-tourp"); await Z.p.waitForTimeout(900); const e6 = await etat(Z.p);
      const cxy = await Z.p.evaluate(() => { const e = document.querySelector(".gp-plein .gp-pres").getBoundingClientRect(), x = e.left + e.width / 2, y = e.top + e.height * .6, t = document.elementFromPoint(x, y); return [x, y, t ? t.className : ""]; });
      await Z.p.mouse.click(cxy[0], cxy[1]); await Z.p.waitForTimeout(900); const e7 = Object.assign(await etat(Z.p), { touche: String(cxy[2]) });
      ok(pl && pl.lab === "Tour de présentation" && pl.w >= 36 && pl.vis && e6.enPres, "plein écran : bouton 🎥 (« Tour de présentation ») dans la barre, il lance le tour " + JSON.stringify(pl));
      ok(!e7.enPres && !e7.pres, "un toucher sur l'écran saute le tour " + JSON.stringify(e7));
    } else console.log("(3D indisponible : parties 3D sautées)");
    errs.push(...Z.err); await Z.ctx.close(); }
  // 4. nouvelle ouverture : « Passer › » saute aux feux
  { const Z = await ouvrir(b);
    if (await Z.p.evaluate(() => GP_INST && GP_INST.api.type === "3d")) { await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(1200); const a = await etat(Z.p);
      await Z.p.click("#gp-piste .gp-pres-x"); await Z.p.waitForTimeout(600); const c = await etat(Z.p);
      ok(a.enPres && !c.pres && !c.enPres && c.demo && c.feux === 3200, "nouvelle ouverture : tour rejoué ; « Passer › » saute directement aux feux " + JSON.stringify(c)); }
    errs.push(...Z.err); await Z.ctx.close(); }
  // 5. « réduire les animations » : pas de tour automatique ; 🎥 = plans fixes et fondus
  { const Z = await ouvrir(b, { reduit: true }); await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(1200); const a = await etat(Z.p);
    ok(!a.pres && !a.enPres, "réduire les animations : pas de tour de présentation, on va directement aux feux " + JSON.stringify(a));
    await Z.p.evaluate(() => { document.querySelector("details.gp-plus").open = true; }); await Z.p.click("#gp-tourp"); await Z.p.waitForTimeout(800); const c = await etat(Z.p);
    ok(c.enPres && c.fondu, "réduire les animations + 🎥 : plans fixes reliés par des fondus (aucun mouvement de caméra) " + JSON.stringify(c));
    await Z.p.evaluate(() => passerPresentation()); errs.push(...Z.err); await Z.ctx.close(); }
  // 6. 2D : version simple (zoom doux), un toucher la saute
  { const Z = await ouvrir(b, { d2: true }); await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(1500); const a = await etat(Z.p);
    const vb = await Z.p.evaluate(() => document.querySelector("#gp-piste svg.p2-svg").getAttribute("viewBox"));
    await Z.p.waitForTimeout(1500); const vb2 = await Z.p.evaluate(() => document.querySelector("#gp-piste svg.p2-svg").getAttribute("viewBox"));
    const r = await Z.p.evaluate(() => { const e = document.querySelector("#gp-piste .gp-pres").getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
    await Z.p.mouse.click(r[0], r[1]); await Z.p.waitForTimeout(600); const c = await etat(Z.p);
    ok(a.type === "2d" && a.enPres && vb !== vb2, "2D : le tour se joue (la carte zoome doucement) " + JSON.stringify(a));
    ok(!c.enPres && c.demo, "2D : un toucher saute aux feux, la course part " + JSON.stringify(c));
    errs.push(...Z.err); await Z.ctx.close(); }
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 4)));
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
