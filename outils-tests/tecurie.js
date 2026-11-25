/* Test (v20.48) · L'Écurie en course : une seule voiture (le showroom = la F1 3D de la course), la personnalisation se voit en course 2D et 3D.
   Fausses données uniquement (serveur Google intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tecurie.js
   Vérifie : showroom = même modèle que la course ; livrée / casque / finition / traînée / numéro choisis → sur la voiture en course 2D et 3D ;
   joueur sans écurie = rendu d'avant ; tour de chauffe = rendu d'avant pour tous ; 0 erreur JS ; 390 px clair et sombre. Captures dans CAPTURES. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie");   // captures hors du dépôt (CAPTURES=… pour un autre dossier)
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const KS = [202701, 202702, 202703];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i, jusqua) {
  const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010;
  KS.filter(k => k <= jusqua).forEach(k => { const r = ((k + i) % 5 - 2) / 100; v = Math.round(v * (1 + r) + 50); rows.push(ligne(k, v, r)); });
  return { nom, rows };
}
/** écuries INVENTÉES (Nicolas n'a rien choisi : rendu d'avant) */
const ECURIES = {
  "Théo": { equip: { livree: "chocolat", casque: "toque", finition: "or", trainee: "cables", numero: 7 } },
  "Kévin": { equip: { livree: "carte", casque: "eclaireur", finition: "argent", trainee: "flammes", numero: 44 } },
  "Clément": { equip: { livree: "arcenciel", casque: "couronne", finition: "neon", trainee: "arcenciel", numero: 3 } },
  "Devlin": { equip: { livree: "or", casque: "phenix", finition: "soleil", trainee: "turbo", numero: 16 } }
};
function donnees(session, jusqua) {
  const chauffe = jusqua < 202701;
  return { ok: true, version: 87, genere: "2027-03-12T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map((n, i) => chauffe ? { nom: n, rows: [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)] } : personne(n, i, jusqua)),
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]].concat(KS.filter(k => k <= jusqua).map(k => [k, 0.004])), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECURIES, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DSF || 1), serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    const rep = c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "ecurie" ? { ok: true } : donnees(o.session, o.jusqua);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(rep) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.gpVu.2027", "202703"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1000);
  // objets débloqués pour le test (sinon equipDe retombe sur la base)
  await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove());
    const orig = debloques; window.debloques = nom => !saisonJouee() ? orig(nom) : new Set(SLOTS.flatMap(([s]) => Object.keys(ITEMS[s]).map(id => s + "." + id))); });
  return { ctx, p, err };
}
const course = async (p, vue) => p.evaluate(async vue => {
  ETAT.podium = "gp"; ETAT.gp2d = vue === "2d" ? "1" : "0"; ETAT.gpVue3 = "poursuite"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees();
  await new Promise(r => setTimeout(r, 2500)); document.querySelectorAll(".revel, .ba").forEach(x => x.remove());
  const api = GP_INST && GP_INST.api; return api ? { type: api.type, eq: api.equipes ? api.equipes() : null } : null; }, vue);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const { ctx, p, err } = await page(b, { quand: "2027-03-15T10:00:00", sombre, session: { role: "perso", nom: "Théo" }, jusqua: 202702 });
    // 1. showroom
    const sr = await p.evaluate(async () => { ETAT.podium = "ecurie"; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 1500));
      const cv = document.querySelector("#sr-3d canvas.v3d"); return { cv: !!cv, eq: V3D.inst && V3D.inst.equipe ? V3D.inst.equipe() : null, svg: !!document.querySelector("#sr-3d svg.voiture") }; });
    ok(sr.cv && !sr.svg && sr.eq && sr.eq.livree === "chocolat" && sr.eq.casque === "toque" && sr.eq.numero === 7, "showroom : la F1 3D de la course, avec livrée, casque, finition et numéro" + tag + " " + JSON.stringify(sr.eq));
    await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/showroom" + (sombre ? "-sombre" : "") + ".png" });
    // 1 bis. on quitte l'Écurie pour le Classement : le showroom 3D ne dessine plus rien en arrière-plan ; il repart au retour
    const fond = await p.evaluate(async () => {
      if (!window.__nbV3D) { window.__nbV3D = 0; const d = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function () { if (this.canvas && this.canvas.classList.contains("v3d")) window.__nbV3D++; return d.apply(this, arguments); }; }
      const attendre = ms => new Promise(r => setTimeout(r, ms));
      window.__nbV3D = 0; await attendre(1000); const ecurie = window.__nbV3D;
      allerA("classement"); await attendre(300); window.__nbV3D = 0; await attendre(1000); const cache = window.__nbV3D;
      allerA("trophees"); await attendre(600); window.__nbV3D = 0; await attendre(1000); const retour = window.__nbV3D;
      return { ecurie, cache, retour };
    });
    ok(fond.ecurie > 0 && fond.cache === 0 && fond.retour > 0, "showroom : 0 image dessinée pendant 1 s sur le Classement (il tourne sur l'Écurie et repart au retour)" + tag + " " + JSON.stringify(fond));
    if (!sombre) {
      // chaque casque sur la nouvelle forme (vignettes de l'Écurie)
      await p.evaluate(async () => { ECU_SLOT = "casque"; rendreTrophees(); await new Promise(r => setTimeout(r, 800)); });
      await p.locator(".items").first().screenshot({ path: DOSSIER + "/casques.png" });
      await p.evaluate(async () => { ECU_SLOT = "livree"; rendreTrophees(); await new Promise(r => setTimeout(r, 900)); });
      await p.locator(".items").first().screenshot({ path: DOSSIER + "/livrees.png" });
      // garage d'un autre pilote, en 3D aussi
      await p.evaluate(async () => { ECU_VOIR = "Kévin"; rendreTrophees(); await new Promise(r => setTimeout(r, 900)); });
      const gar = await p.evaluate(() => V3D.gar && V3D.gar.equipe ? V3D.gar.equipe() : null);
      ok(gar && gar.livree === "carte" && gar.casque === "eclaireur", "garage de Kévin : sa F1 3D (Carte à jouer, Éclaireur) " + JSON.stringify(gar));
      await p.locator("#garage .showroom").screenshot({ path: DOSSIER + "/garage-kevin.png" });
      await p.evaluate(() => { ECU_VOIR = null; ECU_SLOT = "pilote"; });
    }
    // 2. course 3D
    const c3 = await course(p, "3d");
    await p.waitForTimeout(800);
    await p.locator("#gp-piste").screenshot({ path: DOSSIER + "/course-3d" + (sombre ? "-sombre" : "") + ".png" });
    const e3 = c3 && c3.eq ? Object.fromEntries(c3.eq.map(x => [x.nom, x])) : {};
    ok(c3 && c3.type === "3d" && e3["Théo"] && e3["Théo"].livree === "chocolat" && e3["Théo"].casque === "toque" && e3["Théo"].numero === 7 && e3["Kévin"].livree === "carte" && e3["Clément"].trainee === "arcenciel", "course 3D : chaque voiture porte l'écurie de son pilote" + tag);
    ok(e3["Nicolas"] && !e3["Nicolas"].casque && !e3["Nicolas"].numero && (e3["Nicolas"].livree || "couleur") === "couleur", "course 3D : Nicolas (rien choisi) garde la voiture d'avant" + tag);
    ok(sr.eq && e3["Théo"] && sr.eq.n === e3["Théo"].n, "le showroom et la course dessinent le même modèle (" + (sr.eq && sr.eq.n) + " = " + (e3["Théo"] && e3["Théo"].n) + " sommets)" + tag);
    // la course jouée : on regarde les traînées en plein mouvement
    await p.evaluate(() => { const a = GP_INST.api, n = D.personnes.map(x => x.nom), de = {}, fin = {}; n.forEach((x, i) => { de[x] = 2 + i; fin[x] = 22 + i * 1.5; }); a.jouer(de, fin, 9000); });
    await p.waitForTimeout(2600);
    await p.locator("#gp-piste").screenshot({ path: DOSSIER + "/course-3d-roule" + (sombre ? "-sombre" : "") + ".png" });
    // 3. course 2D
    const c2 = await course(p, "2d");
    const m2 = await p.evaluate(() => [...document.querySelectorAll("#gp-piste .p2-car")].map(g => ({ cls: g.getAttribute("class"), casque: !!g.querySelector(".p2-casque svg, .p2-casque path"), anneau: g.querySelectorAll("circle").length })));
    ok(c2 && c2.type === "2d" && m2.some(x => /lv-chocolat/.test(x.cls) && x.casque) && m2.some(x => /lv-carte/.test(x.cls)) && m2.filter(x => /lv-/.test(x.cls)).length === 4, "course 2D : livrées et casques sur les pastilles" + tag + " " + JSON.stringify(m2.map(x => x.cls)));
    ok(m2.filter(x => !/lv-/.test(x.cls) && !x.casque).length === 1, "course 2D : Nicolas garde la pastille d'avant" + tag);
    await p.evaluate(() => { const a = GP_INST.api, n = D.personnes.map(x => x.nom), de = {}, fin = {}; n.forEach((x, i) => { de[x] = 2 + i; fin[x] = 22 + i * 1.5; }); a.jouer(de, fin, 3200); });
    await p.waitForTimeout(350);   // v20.48 : on regarde au démarrage ; en plein milieu, sur une machine lente, les voitures sautent de plus de 40 px par image et la traînée repart de zéro (normal)
    const tr = await p.evaluate(() => [...document.querySelectorAll("#gp-piste .p2-tr")].filter(x => (x.getAttribute("d") || "").length > 10).map(x => x.getAttribute("class")));
    ok(tr.some(x => /cables/.test(x)) && tr.some(x => /flammes/.test(x)) && tr.some(x => /arcenciel/.test(x)), "course 2D : les traînées suivent les voitures (câbles, flammes, arc-en-ciel)" + tag);
    await p.locator("#gp-piste").screenshot({ path: DOSSIER + "/course-2d" + (sombre ? "-sombre" : "") + ".png" });
    const deb = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!err.length && !deb, "0 erreur JS, rien ne déborde à 390 px" + tag + " " + JSON.stringify(err.slice(0, 3)));
    await ctx.close();
  }
  // 4. tour de chauffe (décembre 2026) : les voitures d'avant pour tout le monde, même avec une écurie enregistrée
  { const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", session: { role: "perso", nom: "Kévin" }, jusqua: 202612 });
    const c = await course(p, "2d"), e = c && c.eq ? c.eq : [];
    const m2 = await p.evaluate(() => [...document.querySelectorAll("#gp-piste .p2-car")].map(g => g.getAttribute("class") + (g.querySelector(".p2-casque") ? " casque" : "")));
    ok(e.length === 5 && e.every(x => !x.casque && !x.numero && !x.finition) && m2.every(x => !/lv-|casque/.test(x)) && !err.length, "tour de chauffe : aucune écurie visible en course (rendu d'avant) " + JSON.stringify(m2));
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
