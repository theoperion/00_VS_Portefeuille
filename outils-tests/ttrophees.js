/* Test (Trophées v2, Théo 25/11) · l'onglet Trophées en 4 sous-onglets : 🗺️ Mondes · 🏅 Succès · 🧤 Gant · 💎 Légendes (+ ⚔️ Titres et 🏆 Coupe à part, sans objet).
   Fausses données uniquement (serveur Google intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/ttrophees.js
   Saison INVENTÉE au 15/06/2027 (janvier à mai joués) :
   - « Décollage » (+5 % en un mois) : Kévin le premier (figé par le serveur), puis Nicolas et Clément → objet commun pour les 3, exclusif pour Kévin seul ;
   - 🧠 Stratège : Clément marque avec Turbo (janv.), Pneus pluie (févr.), Aspiration (avr.) et Pari (mai) → premier en mai 2027 ;
   - Gant : Clément a 4 pierres → 4 gemmes sur sa voiture en course 2D et 3D ; rien avant janvier.
   Mondes : sans moteur de mini-jeux, les 12 sont « à venir » ; avec un faux moteur (etatMiniJeu) on vérifie trophée pour tous, feuille d'or du meilleur et objets.
   Captures dans CAPTURES (sinon un dossier temporaire). */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "trophees");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const KS = [202701, 202702, 202703, 202704, 202705];
const R = { 202701: [0.02, 0.06, 0.01, 0.005, -0.03], 202702: [0.01, 0, 0.055, -0.02, 0.07], 202703: [0.03, -0.01, 0.02, 0.015, 0.0], 202704: [0.012, 0.004, 0.035, 0.02, -0.01], 202705: [-0.01, 0.02, 0.025, 0.03, 0.01] };
const IDX = { 202701: 0.008, 202702: -0.015, 202703: 0.01, 202704: 0.012, 202705: 0.005 };
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i) { const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010; KS.forEach(k => { v = Math.round(v * (1 + R[k][i]) + 50); rows.push(ligne(k, v, R[k][i])); }); return { nom, rows }; }
const CARTES = { 2027: { "Clément": { 202701: { c: "turbo" }, 202702: { c: "pluie" }, 202704: { c: "aspiration" }, 202705: { c: "pari", cible: "Théo" } }, "Nicolas": { 202702: { c: "pari", cible: "Kévin" } }, "Théo": { 202701: { c: "turbo" }, 202703: { c: "pari", cible: "Kévin" } } } };
function donnees(session, chauffe) {
  return { ok: true, version: 88, genere: "2027-06-15T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: chauffe ? NOMS.map((nom, i) => ({ nom, rows: [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)] })) : NOMS.map(personne),
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]].concat(chauffe ? [] : KS.map(k => [k, IDX[k]])), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: chauffe ? {} : { decollage: { nom: "Kévin", mois: 202701 } }, cartes: chauffe ? {} : CARTES, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    const rep = c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session, o.chauffe);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(rep) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.gpVu.2027", "202705"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()));
  return { ctx, p, err };
}
const ouvrir = (p, onglet) => p.evaluate(async onglet => { document.querySelectorAll(".revel").forEach(x => x.remove()); ETAT.podium = "defis"; VIT_ONGLET = onglet; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); }, onglet);
const deborde = () => [...document.querySelectorAll("#v-trophees *")].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(x => x.className && x.className.baseVal !== undefined ? x.className.baseVal : x.className || x.tagName).slice(0, 5);
const course = async (p, vue) => p.evaluate(async vue => {
  ETAT.podium = "gp"; ETAT.gp2d = vue === "2d" ? "1" : "0"; ETAT.gpVue3 = "poursuite"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees();
  await new Promise(r => setTimeout(r, 2500)); document.querySelectorAll(".revel, .ba").forEach(x => x.remove());
  const api = GP_INST && GP_INST.api; return api ? { type: api.type, eq: api.equipes ? api.equipes() : null } : null; }, vue);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await page(b, { quand: "2027-06-15T10:00:00", sombre, session: { role: "perso", nom: "Clément" } });
    // 1. les 4 sous-onglets (+ titres et Coupe à part)
    await ouvrir(p, "mondes");
    const nav = await p.evaluate(() => ({ tabs: [...document.querySelectorAll(".vit-tabs [data-vit]")].map(x => x.textContent.trim()), apart: (document.querySelector(".vit-apart") || {}).textContent || "" }));
    ok(nav.tabs.join("|") === "🗺️Mondes|🏅Succès|🧤Gant|💎Légendes" && /Titres/.test(nav.apart) && /Coupe brisée/.test(nav.apart), "4 sous-onglets (Mondes, Succès, Gant, Légendes) + Titres et Coupe brisée à part" + tag + " " + JSON.stringify(nav));
    // 2. Mondes : 12 cartes, à venir sans moteur, objets de l'univers, Ratatouille au Petit Chef
    const m = await p.evaluate(() => { const c = [...document.querySelectorAll("#vit-mondes .cc-m")];
      return { n: c.length, avenir: c.filter(x => x.classList.contains("a-venir")).length, obj: c.every(x => x.querySelector(".cc-art > svg.obj")), txt: document.querySelector("#vit-mondes").innerText,
        rata: TROPHEES_MONDES.find(t => t.gain.some(g => g.join(".") === "plaque.ratatouille")).univers, anciens: /pronostic|pole|verser|défis du mois/i.test(document.querySelector("#vit-mondes").innerText) }; });
    if (process.env.DBG) console.log(JSON.stringify({ n: m.n, av: m.avenir, obj: m.obj, t: m.txt.slice(0, 300) }));
    ok(m.n === 12 && m.avenir === 12 && m.obj && /mini-jeu de janvier/.test(m.txt) && /objets à gagner/.test(m.txt) && /Petit Chef/i.test(m.txt), "🗺️ 12 cartes de mondes (une par univers, son objet), « à venir » tant que le moteur des mini-jeux n'est pas là" + tag);
    ok(m.rata === "bahrein" && !m.anciens, "plaque Ratatouille au Petit Chef ; plus aucune ancienne condition (pronostic, pole, verser…)" + tag);
    let deb = await p.evaluate(`(${deborde})()`); ok(!deb.length, "Mondes : rien ne déborde à 390 px " + JSON.stringify(deb) + tag);
    await p.screenshot({ path: DOSSIER + "/mondes-" + (sombre ? "sombre" : "clair") + ".png", fullPage: true });
    // 2 bis. faux moteur des mini-jeux : trophée pour tous ceux qui réussissent, feuille d'or pour le meilleur, objets débloqués
    const mm = await p.evaluate(async () => {
      window.etatMiniJeu = (u, nom) => u === "silverstone" ? { gagne: ["Clément", "Théo"].includes(nom), pourTous: ["Clément", "Théo"], meilleur: { nom: "Clément", txt: "12 points" }, progression: null }
        : u === "djeddah" ? { gagne: nom === "Kévin", pourTous: ["Kévin"], meilleur: { nom: "Kévin", txt: "" }, progression: nom === "Clément" ? { p: 2, c: 3, txt: "2 / 3 sorts" } : null } : null;
      window.MINIJEUX_REV = 1; rendreTrophees(); await new Promise(r => setTimeout(r, 500));
      const cl = id => (document.querySelector('[data-monde="' + id + '"]') || { className: "" }).className;
      return { dune: cl("m-silverstone"), chateau: cl("m-djeddah"), anneau: (document.querySelector('[data-monde="m-djeddah"] .cc-anneau') ? 1 : 0), objC: debloques("Clément").has("livree.ver") && debloques("Clément").has("circuit.desert"), objT: debloques("Théo").has("livree.ver"), objK: debloques("Kévin").has("livree.ver"),
        lauriers: !!document.querySelector('[data-monde="m-silverstone"] .cc-laurier'), socle: !!document.querySelector('[data-monde="m-silverstone"] .cc-socle') };
    });
    ok(/exclusif/.test(mm.dune) && mm.lauriers && mm.socle && /autres/.test(mm.chateau) && mm.anneau && mm.objC && mm.objT && !mm.objK, "faux moteur : le meilleur du mois a la feuille d'or (lauriers, projecteur sur socle), chacun qui réussit gagne le trophée et ses objets, progression en anneau " + JSON.stringify(mm) + tag);
    if (!sombre) await p.locator("#vit-mondes .cc-grille").screenshot({ path: DOSSIER + "/mondes-avec-moteur-invente.png" });
    await p.evaluate(() => { delete window.etatMiniJeu; window.MINIJEUX_REV = 2; });
    // 3. Succès : 12 visibles, objectifs écrits, paliers de difficulté, commun pour tous / exclusif au premier, Stratège
    await ouvrir(p, "succes");
    const s = await p.evaluate(() => { const v = document.querySelector("#vit-succes"), c = [...v.querySelectorAll(".cc-s")], t = v.innerText;
      const pal = id => c.filter(x => x.classList.contains("p-" + id)).length;
      const fond = id => { const x = v.querySelector(".cc-s.p-" + id); return x ? getComputedStyle(x).backgroundImage + "|" + getComputedStyle(x).paddingTop : ""; };
      return { n: c.length, defs: SUCCES.every(x => t.toLowerCase().includes(x.nom.toLowerCase())) && /gagner un mois de championnat/i.test(t) && /chacune des 4 cartes de base/i.test(t), secret: /secret|indice\s*:|\?\?\?(?! 2028)/i.test(t.replace(/\?\?\? 2028/g, "")), r2028: /\?\?\? 2028/.test(t),
        paliers: [pal("bronze"), pal("argent"), pal("or"), pal("legende")], fonds: ["bronze", "argent", "or", "legende"].map(fond), dec: (v.querySelector('[data-succes="decollage"]') || {}).className, strat: (v.querySelector('[data-succes="stratege"]') || {}).className,
        chacun: ["Kévin", "Nicolas", "Clément", "Théo"].map(n => [n, debloques(n).has("klaxon.fusees"), debloques(n).has("trainee.halo")]),
        stratege: premiersExclusifs().stratege, sC: [debloques("Clément").has("plaque.carredas"), debloques("Clément").has("finition.diamant"), debloques("Théo").has("plaque.carredas")] }; });
    if (process.env.DBG) console.log(JSON.stringify(s).slice(0, 600));
    // relecture jeu-joueur (25/11) : les mots des succès, les compteurs en toutes lettres, « 1er » sur la ligne dorée d'un succès ouvert
    const mots = await p.evaluate(async () => { const v = document.querySelector("#vit-succes"), t = v.innerText, tab = ((v.querySelector(".ex-tab") || {}).innerText || "").replace(/\s+/g, " ");
      ouvrirSucces("decollage"); await new Promise(r => setTimeout(r, 300)); const o = document.querySelector(".sc-c"), or = o ? o.closest(".revel").querySelector("li.h-or") : null, r = { t, tab, or: or ? or.innerText : "" }; if (o) o.closest(".revel").remove(); return r; });
    ok(/Faire au moins 5 % de mieux que le S&P 500 sur un mois/.test(mots.t) && /Repasser au-dessus de son meilleur niveau après une chute de 10 %/.test(mots.t) && /\d+ réussis? · \d+ en premier/.test(mots.tab) && !/🏅|🥇/.test(mots.tab) && /1er/.test(mots.or),
      "Succès : « Coup de massue » et « Phénix » en mots simples, compteurs « 2 réussis · 1 en premier », « 1er » sur la ligne dorée " + JSON.stringify([/Faire au moins 5 %/.test(mots.t), /Repasser au-dessus/.test(mots.t), mots.tab.slice(0, 80), mots.or.slice(0, 40)]) + tag);
    ok(s.n === 12 && s.defs && !s.secret && s.r2028, "🏅 12 succès VISIBLES (objectif écrit, plus de secret muet) + case « ??? 2028 »" + tag);
    ok(s.paliers.join(",") === "2,4,4,2" && new Set(s.fonds).size === 4, "paliers de difficulté : 2 bronze, 4 argent, 4 or, 2 légendaires, chacun avec son cadre " + JSON.stringify(s.paliers) + tag);
    ok(JSON.stringify(s.chacun) === JSON.stringify([["Kévin", true, true], ["Nicolas", true, false], ["Clément", true, false], ["Théo", false, false]]) && /moi/.test(s.dec), "« Décollage » : l'objet commun pour chacun qui réussit (Kévin, Nicolas, Clément), l'exclusif pour le premier seulement (Kévin) " + JSON.stringify(s.chacun) + tag);
    ok(s.stratege && s.stratege.nom === "Clément" && s.stratege.k === 202705 && s.sC.join() === "true,true,false" && /premier/.test(s.strat), "🧠 Stratège : Clément le premier (4 cartes de base qui marquent, mai 2027), plaque « Carré d'as » + exclusif « Diamant » " + JSON.stringify(s.stratege && [s.stratege.nom, s.stratege.k]) + tag);
    deb = await p.evaluate(`(${deborde})()`); ok(!deb.length, "Succès : rien ne déborde à 390 px " + JSON.stringify(deb) + tag);
    await p.screenshot({ path: DOSSIER + "/succes-" + (sombre ? "sombre" : "clair") + ".png", fullPage: true });
    if (!sombre) {
      const f = await p.evaluate(async () => { ouvrirSucces("decollage"); await new Promise(r => setTimeout(r, 600)); const o = document.querySelector(".sc-ov"); return o ? o.innerText : ""; });
      await p.locator(".sc-ov .rv-c").screenshot({ path: DOSSIER + "/succes-ouvert.png" });
      ok(/Pour chacun qui réussit/.test(f) && /premier seulement/.test(f) && /Kévin/.test(f) && /Nicolas/.test(f) && !/€/.test(f), "un succès ouvert : objectif, objet pour chacun, exclusif du premier, qui l'a réussi (en %, jamais un montant)");
      await p.evaluate(() => document.querySelectorAll(".sc-ov").forEach(x => x.remove()));
    }
    // 4. Gant : direction C, agrandi, 0 → 6 pierres
    await ouvrir(p, "gant");
    const g = await p.evaluate(() => { const svg = document.querySelector("#vit-gant .gant-svg.gant-C"), w = svg ? svg.getBoundingClientRect().width : 0;
      const etats = [0, 1, 2, 3, 4, 5, 6].map(n => { const d = document.createElement("div"); d.innerHTML = svgGant(n, [0, 1, 2, 3, 4, 5].map(i => i < n)); return { flux: d.querySelectorAll(".gC-flux").length, orbite: d.querySelectorAll(".gC-orbite").length, svg: d.innerHTML.length }; });
      return { w, n: etatGant(2027)["Clément"].n, lit: (document.querySelector("#vit-gant .gant-n b") || {}).textContent, li: document.querySelectorAll("#vit-gant .pierres li.on").length, etats }; });
    ok(g.w >= 115 && g.w <= 130 && g.n === 4 && g.lit === "4" && g.li === 4, "🧤 Gant de cristal (direction C) agrandi à " + Math.round(g.w) + " px, 4 pierres allumées pour Clément" + tag);
    ok(g.etats.map(e => e.flux).join() === "0,0,1,2,3,4,5" && g.etats[6].orbite === 1 && g.etats.slice(0, 6).every(e => !e.orbite) && new Set(g.etats.map(e => e.svg)).size === 7, "Gant : 7 états distincts de 0 à 6 pierres (veines allumées, orbite des 6 lumières une fois complet)" + tag);
    deb = await p.evaluate(`(${deborde})()`); ok(!deb.length, "Gant : rien ne déborde à 390 px " + JSON.stringify(deb) + tag);
    await p.screenshot({ path: DOSSIER + "/gant-" + (sombre ? "sombre" : "clair") + ".png", fullPage: true });
    if (!sombre) await p.evaluate(async () => { const d = document.createElement("div"); d.id = "planche-gant"; d.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px;background:var(--bg)";
      d.innerHTML = [0, 1, 2, 3, 4, 5, 6].map(n => '<div style="display:grid;justify-items:center;font:600 12px var(--f-text);color:var(--ink)"><div style="width:84px">' + svgGant(n, [0, 1, 2, 3, 4, 5].map(i => i < n)) + "</div>" + n + " / 6</div>").join(""); document.querySelector("#v-trophees").prepend(d); await new Promise(r => setTimeout(r, 300)); })
      .then(() => p.locator("#planche-gant").screenshot({ path: DOSSIER + "/gant-0-a-6.png" }));
    // 5. Légendes : un seul gagnant ; le ticket d'or n'a qu'UNE place
    await ouvrir(p, "legendes");
    const l = await p.evaluate(() => { const v = document.querySelector("#vit-legendes"), t = v.innerText; return { n: v.querySelectorAll(".lg").length, t, cinq: /5 places|5 tickets|n° [2-5]/.test(t), ticket: !!v.querySelector("#vit-tickets") }; });
    if (process.env.DBG) console.log(JSON.stringify(l));
    ok(l.n === 4 && /Premier millionnaire/i.test(l.t) && /Premier champion/i.test(l.t) && /Coup de la saison/i.test(l.t) && /un seul ticket d'or/i.test(l.t) && !l.cinq && l.ticket, "💎 Légendes : Millionnaire, Champion, Coup de la saison, Ticket d'or (un seul gagnant, plus « 5 places »)" + tag);
    deb = await p.evaluate(`(${deborde})()`); ok(!deb.length, "Légendes : rien ne déborde à 390 px " + JSON.stringify(deb) + tag);
    await p.screenshot({ path: DOSSIER + "/legendes-" + (sombre ? "sombre" : "clair") + ".png", fullPage: true });
    // 5 bis. Titres, à part
    await ouvrir(p, "titres");
    const ti = await p.evaluate(() => ({ t: document.querySelector("#vit-titres").innerText, svg: document.querySelectorAll("#vit-titres .cour-i .titre-svg").length }));
    ok(/sans objet/.test(ti.t) && ti.svg === 3, "⚔️ Titres à part, sans objet (3 emblèmes)" + tag);
    if (!sombre) await p.screenshot({ path: DOSSIER + "/titres-clair.png", fullPage: true });
    // 6. Écurie : d'où vient cet objet
    const o = await p.evaluate(() => { const t = (q, s, i) => { const r = texteOrigineItem(q, s, i); return r.t + " | " + r.p; };
      return { commun: t("Nicolas", "klaxon", "fusees"), excl: t("Nicolas", "trainee", "halo"), monde: t("Clément", "plaque", "ratatouille"), gant: t("Clément", "livree", "chrome"), leg: t("Clément", "finition", "lauriers"), tk: t("Clément", "plaque", "ticketor"), r2028: t("Clément", "casque", "glace"),
        orphelins: Object.keys(ITEMS).flatMap(sl => Object.keys(ITEMS[sl]).filter(id => BASE_ECURIE[sl] !== id && !Object.keys(origineItem(sl, id)).length).map(id => sl + "." + id)),
        rar: [rareteItem("klaxon", "fusees").lib, rareteItem("trainee", "halo").lib, rareteItem("livree", "ver").lib, rareteItem("livree", "chrome").lib, rareteItem("finition", "lauriers").lib] }; });
    ok(/🏅 Succès/.test(o.commun) && /Chacun qui réussit/.test(o.commun) && /Exclusif/.test(o.excl) && /Kévin/.test(o.excl) && /🗺️ Monde/.test(o.monde) && /Petit Chef/.test(o.monde) && /Gant/.test(o.gant) && /Légende/.test(o.leg) && /Légende/.test(o.tk) && /seul ticket/.test(o.tk) && /2028/.test(o.r2028) && !o.orphelins.length && o.rar.join() === "Succès,Exclusif,Monde,Gant,Légende",
      "Écurie · « d'où vient cet objet » : Mondes, Succès commun, Succès exclusif, Gant, Légendes, 2028 ; aucun objet orphelin " + JSON.stringify(o.orphelins) + tag);
    // 7. les pierres du Gant sur la voiture, en course 2D et 3D
    const pr = await p.evaluate(() => Piste.pierres("Clément"));
    const c2 = await course(p, "2d"), g2 = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#gp-piste .p2-car")].map((x, i) => [i, x.querySelectorAll(".p2-gem").length])));
    const e2 = c2 && c2.eq ? Object.fromEntries(c2.eq.map(x => [x.nom, x.pierres])) : {};
    ok(pr && pr.filter(Boolean).length === 4 && e2["Clément"] === 4 && Object.values(g2).includes(4) && Object.values(g2).reduce((a, x) => a + x, 0) === Object.values(e2).reduce((a, x) => a + x, 0), "course 2D : les pierres allumées en petites gemmes sous la pastille (Clément : 4) " + JSON.stringify(e2) + tag);
    await p.locator("#gp-piste").screenshot({ path: DOSSIER + "/voiture-2d-pierres-" + (sombre ? "sombre" : "clair") + ".png" });
    const c3 = await course(p, "3d"), e3 = c3 && c3.eq ? Object.fromEntries(c3.eq.map(x => [x.nom, x.pierres])) : {};
    ok(c3 && c3.type === "3d" && e3["Clément"] === 4 && e3["Kévin"] === etatGantN(e2, "Kévin"), "course 3D : les pierres serties sur les pontons (Clément : 4) " + JSON.stringify(e3) + tag);
    if (c3 && c3.type === "3d") {
      await p.evaluate(async () => { const a = GP_INST.api; if (a.focus) a.focus("Clément"); if (a.camera) a.camera("poursuite"); await new Promise(r => setTimeout(r, 900)); });
      await p.locator("#gp-piste").screenshot({ path: DOSSIER + "/voiture-3d-pierres-" + (sombre ? "sombre" : "clair") + ".png" });
    }
    if (c3 && c3.type === "3d") {   // gros plan : la même F1 que la course, avec les pierres de Clément sur le ponton
      await p.evaluate(async () => { const d = document.createElement("div"); d.id = "gros-plan"; d.style.cssText = "position:fixed;left:0;top:0;width:390px;height:240px;z-index:99999;background:var(--bg)"; document.body.appendChild(d);
        window.__gp = Piste.vitrine(d, Object.assign(voitureEcurie("Clément", equipDe("Clément")), { pierres: Piste.pierres("Clément") }), { yaw: 1.75, ratio: .6, label: "gros plan" }); await new Promise(r => setTimeout(r, 1200)); });
      await p.locator("#gros-plan").screenshot({ path: DOSSIER + "/voiture-3d-gros-plan-" + (sombre ? "sombre" : "clair") + ".png" });
      await p.evaluate(() => { if (window.__gp && window.__gp.stop) window.__gp.stop(); document.getElementById("gros-plan").remove(); });
    }
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err.slice(0, 3)));
    await ctx.close();
  }
  // 8. « réduire les animations » : plus rien ne bouge (éclats, prisme, Gant)
  { const { ctx, p, err } = await page(b, { quand: "2027-06-15T10:00:00", reduit: true, session: { role: "perso", nom: "Kévin" } });
    await ouvrir(p, "succes");
    const a = await p.evaluate(() => { const x = document.querySelector(".cc-s.p-legende"), y = document.querySelector(".cc-s.premier .cc-art"); return [x ? getComputedStyle(x).animationName : "?", y ? getComputedStyle(y, "::after").animationName : "?"]; });
    await ouvrir(p, "gant");
    const gA = await p.evaluate(() => [...document.querySelectorAll("#vit-gant .gC-pulse, #vit-gant .gC-flux")].map(x => getComputedStyle(x).animationName).filter(n => n !== "none").length);
    ok(a.every(n => n === "none") && gA === 0 && !err.length, "réduire les animations : cartes et Gant immobiles " + JSON.stringify([a, gA]));
    await ctx.close(); }
  // 9. avant le 1/1/2027 : rien de visible pour un joueur (ni onglet Trophées, ni pierres sur la voiture)
  for (const QD of ["2026-12-15T10:00:00", "2026-12-31T22:00:00"]) {
    const { ctx, p, err } = await page(b, { quand: QD, chauffe: true, session: { role: "perso", nom: "Clément" } });
    const a = await p.evaluate(async () => { ETAT.podium = "defis"; VIT_ONGLET = "succes"; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 600)); const t = document.querySelector("#v-trophees").innerText;
      return { onglet: !!document.querySelector('[data-pod="defis"]'), vit: !!document.querySelector(".vit-tabs, #vit-succes, #vit-mondes, .gant"), mots: /Succès|Stratège|Légendes|Gant de l'infini|mini-jeu/i.test(t), pierres: Piste.pierres("Clément") }; });
    const c2 = await course(p, "2d"), gem = await p.evaluate(() => document.querySelectorAll("#gp-piste .p2-gem").length);
    ok(!err.length && !a.onglet && !a.vit && !a.mots && a.pierres === null && gem === 0, QD.slice(0, 10) + " : ni onglet Trophées, ni sous-onglets, ni pierres sur la voiture pour un joueur " + JSON.stringify(a));
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
/** pierres de Kévin vues en 2D (pour comparer avec la 3D) */
function etatGantN(e2, nom) { return e2[nom]; }
