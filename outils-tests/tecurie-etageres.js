/* Test (v20.84) · Écurie en étagères : toutes les catégories d'un coup, une rangée par catégorie qu'on fait défiler au doigt (Théo, 26/11).
   Fausses données uniquement (serveur Google intercepté). Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tecurie-etageres.js  (PORT=…, CAPTURES=…)
   Vérifie : toutes les catégories visibles l'une sous l'autre (plus d'onglets), chaque rangée défile en horizontal (scroll-snap) ; toucher un objet = essai sur la voiture,
   la ligne ne saute pas, la rangée garde sa position ; 🎨 couleurs sous la ligne de l'objet choisi, une seule ligne ouverte à la fois ; « ? » et objets 🔒 2027 (explication sans essai) ;
   ✨ Nouveau en tête et compteur sur la ligne ; « 🏎️ Équiper maintenant » amène sur la bonne ligne, l'objet visible et mis en évidence ; Pilote (tête/casque, éditeur), Numéro,
   Badges (pas en décembre) ; 🎲 / ↩️ / Enregistrer ; rien de 2027 avant le 1/1 ; photos des livrées prises une à une (aucune voiture 3D en plus du showroom) ;
   processeur ×4 (voiture en 2D, la 3D logicielle de la machine de test faussant la mesure) : un toucher sous 0,4 s, une rangée défile à 25 images/s au moins ; 0 erreur JS ; 390 px clair et sombre. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie-etageres");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const lignes = (n, i) => n === "Nicolas" ? [ligne(202612, 1000, 0)] : [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)];
const donnees = (session, ecurie) => ({ ok: true, version: 91, genere: "2026-12-02T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: lignes(n, i) })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ecurie || {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const TRESORS = { ok: true, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, chercheurs: [{ nom: "Kévin", j: 20261205 }, { nom: "Clément", j: 20261207 }] }], trouves: [], total: 0 };
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" });
  const p = await ctx.newPage(), err = [], envois = [], S = { ecurie: { "Kévin": { equip: { casque: "damier", numero: 44 } } } };
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "ecurie") { envois.push(c.equip); S.ecurie[c.personne] = { equip: c.equip }; return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, ecurie: S.ecurie }) }); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? TRESORS : c.action === "tickets" || c.action === "avent" ? { ok: true } : donnees({ role: "perso", nom: "Kévin" }, S.ecurie)) }); });
  await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.ecurieTeaser", "versus.q3dAffichette"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.evaluate(async () => { if (typeof chargerTresors === "function") { TRESORS = null; TRESORS_T = 0; try { await chargerTresors(); } catch (e) { } } });
  await p.waitForTimeout(1200);
  return { ctx, p, err, envois };
}
const nettoyer = "document.querySelectorAll('.ecu-rev, .revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov, .av-case, .ere-voile, .mj-rev, .cn-rev, .af3d').forEach(x => x.remove())";
const ouvrirEcurie = p => p.evaluate(async n => { eval(n); ETAT.podium = "ecurie"; ECU = null; ECU_SLOT = ""; ECU_Q = null; ECU_NOUV = null; garder(); allerA("trophees"); rendreTrophees(); scrollTo(0, 0); await new Promise(r => setTimeout(r, 700)); }, nettoyer);
const deborde = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", suf = sombre ? "-sombre" : "-clair";
    // 1. 2 janvier 2027 : toutes les catégories d'un coup
    { const { ctx, p, err, envois } = await page(b, { quand: "2027-01-02T10:00:00", sombre });
      await ouvrirEcurie(p);
      const a = await p.evaluate(() => { const secs = [...document.querySelectorAll("#v-trophees .eta")];
        return { lignes: secs.map(s => s.dataset.ecuSlot), attendu: rangsEcurie().map(x => x[0]), onglets: !!document.querySelector(".slot-tabs"), select: !!document.querySelector("#v-trophees .etageres select"),
          parRangee: SLOTS.map(([s]) => [s, document.querySelectorAll('.eta-l[data-eta-l="' + s + '"] .it').length, idsSlot(s).length]),
          defile: (() => { const l = document.querySelector('[data-eta-l="casque"]'), cs = getComputedStyle(l); return { sw: l.scrollWidth, cw: l.clientWidth, snap: cs.scrollSnapType, ox: cs.overflowX }; })(),
          sousVoiture: document.querySelector(".showroom").getBoundingClientRect().bottom <= document.querySelector(".etageres").getBoundingClientRect().top,
          voitures3D: document.querySelectorAll("#v-trophees canvas").length }; });
      ok(JSON.stringify(a.lignes) === JSON.stringify(a.attendu) && a.lignes.includes("badges") && a.lignes.length === 11 && !a.onglets && !a.select && a.sousVoiture && a.parRangee.every(x => x[1] === x[2] && x[1] > 0),
        "toutes les catégories l'une sous l'autre, sous la voiture, plus d'onglets ni de liste déroulante ; chaque rangée a tous ses objets " + JSON.stringify(a.lignes) + tag);
      ok(a.defile.sw > a.defile.cw + 50 && /x/.test(a.defile.snap) && a.defile.ox === "auto" && a.voitures3D <= 1, "une rangée défile en horizontal au doigt (scroll-snap), une seule voiture 3D (le showroom) " + JSON.stringify(a.defile) + " canvas=" + a.voitures3D + tag);
      await p.screenshot({ path: DOSSIER + "/etageres-haut" + suf + ".png" });
      // photos des livrées : prises une à une quand la rangée approche, jamais de voiture 3D vivante en plus
      await p.evaluate(() => document.querySelector('[data-eta-l="livree"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(2500);
      const ph = await p.evaluate(() => ({ att: document.querySelectorAll('[data-eta-l="livree"] .vg-attente').length, img: document.querySelectorAll('[data-eta-l="livree"] img[src^="data:"]').length, n: idsSlot("livree").filter(id => !(!debloques("Kévin").has("livree." + id) && objetCache("livree", id))).length, cv: document.querySelectorAll("#v-trophees canvas").length }));
      ok(!ph.att && ph.img === ph.n && ph.cv <= 1, "livrées : une photo par objet (prise en douceur), aucune voiture 3D en plus " + JSON.stringify(ph) + tag);
      await p.screenshot({ path: DOSSIER + "/etageres-livrees" + suf + ".png" });
      // 2. toucher = essai sur la voiture ; la ligne ne saute pas ; la rangée garde sa position
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="casque"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
      const t = await p.evaluate(async () => { const l = document.querySelector('[data-eta-l="casque"]'), ouv = debloques("Kévin");
        const cible = [...l.querySelectorAll(".it:not(.verrou)")].find(x => x.dataset.item !== ECU.e.casque && ouv.has("casque." + x.dataset.item));
        l.scrollLeft = Math.max(0, cible.closest(".it-w").offsetLeft - 60); await new Promise(r => setTimeout(r, 200));
        const x0 = l.scrollLeft, y0 = document.querySelector('.eta[data-ecu-slot="casque"]').getBoundingClientRect().top; cible.click(); await new Promise(r => setTimeout(r, 900));
        const l2 = document.querySelector('[data-eta-l="casque"]'), eq = V3D.inst && V3D.inst.equipe ? V3D.inst.equipe() : null;
        return { id: cible.dataset.item, porte: ECU.e.casque, on: (l2.querySelector(".it.on") || {}).dataset, voiture: eq && eq.casque, x0, x1: l2.scrollLeft, dy: document.querySelector('.eta[data-ecu-slot="casque"]').getBoundingClientRect().top - y0, garde: equipDe("Kévin").casque }; });
      ok(t.porte === t.id && t.on && t.on.item === t.id && t.voiture === t.id && t.garde === "damier", "toucher un casque : essayé tout de suite sur la voiture 3D, « Équipé » sur la vignette, rien d'enregistré " + JSON.stringify(t) + tag);
      ok(Math.abs(t.x1 - t.x0) <= 2 && Math.abs(t.dy) <= 2, "la rangée garde sa position et la ligne ne saute pas " + JSON.stringify({ x0: t.x0, x1: t.x1, dy: t.dy }) + tag);
      // 3. 🎨 sous la ligne de l'objet choisi ; une seule ligne ouverte
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="livree"]').scrollIntoView({ block: "center" }));
      await p.click('[data-slot="livree"][data-item="rayures"]'); await p.waitForTimeout(500);
      const c1 = await p.evaluate(() => ({ ou: [...document.querySelectorAll(".teintes")].map(x => x.closest(".eta").dataset.ecuSlot), tt: [...document.querySelectorAll('.eta[data-ecu-slot="livree"] .teintes [data-teinte]')].map(x => x.dataset.teinte) }));
      await p.click('.eta[data-ecu-slot="livree"] .teintes [data-teinte="or"]'); await p.waitForTimeout(600);
      const c2 = await p.evaluate(() => ({ t: ECU.e.teintes && ECU.e.teintes.livree, voiture: V3D.inst && V3D.inst.equipe && V3D.inst.equipe().livree, presse: (document.querySelector('.eta[data-ecu-slot="livree"] .teintes [aria-pressed="true"]') || {}).dataset }));
      await p.locator('.eta[data-ecu-slot="livree"]').screenshot({ path: DOSSIER + "/couleurs-sous-livree" + suf + ".png" });
      await p.click('[data-slot="klaxon"][data-item="pouet"]'); await p.waitForTimeout(500);
      const c3 = await p.evaluate(() => ({ teintes: document.querySelectorAll(".teintes").length, ouvertes: document.querySelectorAll(".eta-det").length, ou: (document.querySelector(".eta-det") || { closest: () => ({ dataset: {} }) }).closest(".eta").dataset.ecuSlot, klaxon: ECU.e.klaxon, couleurGardee: ECU.e.teintes && ECU.e.teintes.livree }));
      ok(c1.ou.join() === "livree" && c1.tt.join() === "blanc,noir,or" && c2.t === "or" && c2.voiture === "rayures" && c2.presse && c2.presse.teinte === "or" && !c3.teintes && c3.ouvertes === 1 && c3.ou === "klaxon" && c3.klaxon === "pouet" && c3.couleurGardee === "or",
        "🎨 Rayures : les couleurs s'ouvrent sous la ligne Livrée ; un objet d'une autre ligne la referme (une seule ligne ouverte), la couleur reste choisie " + JSON.stringify({ c1, c2, c3 }) + tag);
      // 4. objet 🔒 2027 : « ? » et toucher = explication sous sa ligne, sans essai
      const lk = await p.evaluate(async () => { const v = document.querySelector('[data-eta-l="casque"] .it.verrou'); if (!v) return null; const avant = ECU.e.casque; v.click(); await new Promise(r => setTimeout(r, 400));
        const d = document.querySelector("#it-d"); return { essai: ECU.e.casque !== avant, det: d ? d.innerText : "", ligne: d && d.closest(".eta").dataset.ecuSlot, q: !!document.querySelector('[data-eta-l="casque"] .it-w.it-bloque .it-q') }; });
      ok(lk && !lk.essai && /Comment l'obtenir/i.test(lk.det) && lk.ligne === "casque" && lk.q, "objet 🔒 à gagner en 2027 : « ? » présent, toucher = « Comment l'obtenir » sous sa ligne, sans essai " + JSON.stringify(lk) + tag);
      // 5. Pilote : tête / casque d'un toucher, éditeur sous la ligne
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="pilote"]').scrollIntoView({ block: "center" }));
      await p.click('[data-ecu-pmode="casque"]'); await p.waitForTimeout(300);
      const pm = await p.evaluate(() => ECU.e.pilote);
      await p.click('[data-ecu-ouvrir="pilote"]'); await p.waitForTimeout(300);
      const ed = await p.evaluate(() => { const tp = document.querySelector("#tp"); return { tp: !!tp, ligne: tp && tp.closest(".eta").dataset.ecuSlot, autres: document.querySelectorAll(".eta-det").length }; });
      await p.click('#tp [data-tp="coupe"][data-v="2"]'); await p.waitForTimeout(200);
      const ed2 = await p.evaluate(() => ({ pilote: ECU.e.pilote, tp: !!document.querySelector("#tp"), entete: document.querySelector('.eta[data-ecu-slot="pilote"] .eta-h small').textContent }));
      ok(pm === "casque" && ed.tp && ed.ligne === "pilote" && ed.autres === 1 && ed2.pilote === "tete" && ed2.tp && ed2.entete === "Tête", "Pilote : « Mon casque » d'un toucher, ✏️ ouvre l'éditeur de tête sous la ligne " + JSON.stringify({ pm, ed, ed2 }) + tag);
      // 6. Numéro, Badges
      const nb = await p.evaluate(async () => { const n = document.querySelector('.eta[data-ecu-slot="numero"] #ecu-num'); n.value = "12"; n.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 300));
        return { num: ECU.e.numero, entete: document.querySelector('.eta[data-ecu-slot="numero"] .eta-h small').textContent, badges: !!document.querySelector('.eta[data-ecu-slot="badges"] .bdg-choix') }; });
      ok(nb.num === 12 && nb.entete === "#12" && nb.badges, "Numéro (#12) et choix des badges dans leurs lignes " + JSON.stringify(nb) + tag);
      // 7. 🎲, ↩️, Enregistrer, bouton 2D/3D
      const hz = await p.evaluate(async () => { scrollTo(0, 0); const ouv = debloques("Kévin"), faux = []; for (let i = 0; i < 12; i++) { document.querySelector("#ecu-hasard").click(); await new Promise(r => setTimeout(r, 30)); SLOTS_HASARD.forEach(s => { if (!ouv.has(s + "." + ECU.e[s])) faux.push(s + "." + ECU.e[s]); }); }
        const retour = !!document.querySelector("#ecu-retour"); return { faux, retour, vue: !!document.querySelector("[data-ecu-vue]") }; });
      await p.click("#ecu-garder"); await p.waitForTimeout(700);
      ok(!hz.faux.length && hz.retour && hz.vue && envois.length === 1, "🎲 Au hasard (objets possédés), ↩️ Ma tenue enregistrée, bouton 2D/3D et Enregistrer toujours là " + JSON.stringify({ hz, envois: envois.length }) + tag);
      // 7 bis. 💾 en haut (Théo) : éteint quand tout est enregistré, allumé (« modifié ») après un essai ; bandeau collant en défilant ; rappel en quittant
      const g0 = await p.evaluate(async () => { scrollTo(0, 0); await new Promise(r => setTimeout(r, 300)); const h = document.querySelector(".showroom #ecu-garder-haut"); return { h: !!h, on: h && h.classList.contains("modifie"), txt: h && h.innerText }; });
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="casque"]').scrollIntoView({ block: "center" }));
      await p.click('[data-slot="casque"][data-item="carbone"]'); await p.waitForTimeout(400);
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
      const g1 = await p.evaluate(() => { const h = document.querySelector("#ecu-garder-haut"), r = h.getBoundingClientRect(), c = document.querySelector(".ecu-collant-b"); return { on: h.classList.contains("modifie"), pastille: /modifié/i.test(h.innerText), visible: r.top >= 0 && r.bottom < innerHeight, collant: getComputedStyle(c).visibility }; });
      await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/enregistrer-haut" + suf + ".png" });
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="trainee"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(600);
      const g2 = await p.evaluate(() => { const c = document.querySelector(".ecu-collant-b"), r = c.getBoundingClientRect(), t = document.querySelector(".top").getBoundingClientRect(); return { vis: getComputedStyle(c).visibility, op: getComputedStyle(c).opacity, haut: Math.round(r.top), sousEntete: r.top >= t.bottom - 2 && r.top < t.bottom + 12 }; });
      await p.screenshot({ path: DOSSIER + "/bandeau-collant" + suf + ".png" });
      ok(g0.h && !g0.on && g1.on && g1.pastille && g1.visible && g1.collant === "hidden" && g2.vis === "visible" && +g2.op > .9 && g2.sousEntete,
        "💾 en haut de la carte de la voiture : éteint, puis allumé « modifié » après un essai ; en défilant, bandeau collant sous l'en-tête " + JSON.stringify({ g0, g1, g2 }) + tag);
      await p.click('.onglet[data-vue="classement"]'); await p.waitForTimeout(400);
      const r1 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), txt: (document.querySelector(".ecu-rappel") || {}).innerText || "", vue: vueActive() }));
      await p.screenshot({ path: DOSSIER + "/rappel-quitter" + suf + ".png" });
      await p.mouse.click(195, 40); await p.waitForTimeout(300);
      const r2 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), vue: vueActive(), porte: ECU && ECU.e.casque }));
      await p.click('[data-pod="stand"]'); await p.waitForTimeout(300); await p.click('.ecu-rappel [data-rap="non"]'); await p.waitForTimeout(500);
      const r3 = await p.evaluate(() => ({ pod: ETAT.podium, rap: !!document.querySelector(".ecu-rappel"), porte: equipDe("Kévin").casque, n: 0 }));
      await p.evaluate(async () => { ETAT.podium = "ecurie"; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); document.querySelector('[data-slot="casque"][data-item="carbone"]').click(); await new Promise(r => setTimeout(r, 300)); });
      const av = envois.length; await p.click('.onglet[data-vue="classement"]'); await p.waitForTimeout(300); await p.click('.ecu-rappel [data-rap="oui"]'); await p.waitForTimeout(700);
      const r4 = await p.evaluate(() => ({ vue: vueActive(), porte: equipDe("Kévin").casque }));
      await p.evaluate(async () => { allerA("trophees"); ETAT.podium = "ecurie"; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); });
      await p.click('.onglet[data-vue="mois"]'); await p.waitForTimeout(300);
      const r5 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), vue: vueActive() }));
      ok(r1.rap && /pas enregistré ton écurie/i.test(r1.txt) && r1.vue === "trophees" && !r2.rap && r2.vue === "trophees" && r2.porte === "carbone" && r3.pod === "stand" && !r3.rap && r3.porte !== "carbone" &&
        envois.length === av + 1 && r4.vue === "classement" && r4.porte === "carbone" && !r5.rap && r5.vue === "mois",
        "quitter l'écurie sans enregistrer : rappel (à côté = on reste ; Annuler = tenue d'avant puis on part ; Enregistrer = envoyé puis on part) ; rien quand tout est enregistré " + JSON.stringify({ r1: r1.rap, r2, r3, r4, r5 }) + tag);
      ok(!(await deborde(p)) && !err.length, "2/1/2027 : 390 px sans débordement, 0 erreur JS " + JSON.stringify(err.slice(0, 3)) + tag);
      await ctx.close(); }
    // 8. décembre : ✨ Nouveau (trésor de Noël), « Équiper maintenant » arrive sur le bon objet ; rien de 2027
    { const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", sombre });
      await ouvrirEcurie(p);
      const nv = await p.evaluate(() => { const s = document.querySelector('.eta[data-ecu-slot="plaque"]'), its = [...s.querySelectorAll(".it")];
        return { pt: (s.querySelector(".eta-h .ecu-pt") || {}).textContent || "", ordre: its.slice(0, 2).map(x => x.dataset.item), nv: its.filter(x => x.querySelector(".it-nv")).length, autres: document.querySelectorAll('.eta:not([data-ecu-slot="plaque"]) .eta-h .ecu-pt').length }; });
      ok(/✨\s*2/.test(nv.pt) && nv.ordre.join() === "chercheuror,chercheur" && nv.nv === 2 && !nv.autres, "décembre : ligne Plaque « ✨ 2 », les 2 nouvelles plaques en tête avec « ✨ Nouveau » " + JSON.stringify(nv) + tag);
      await p.evaluate(() => document.querySelector('.eta[data-ecu-slot="plaque"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
      await p.locator('.eta[data-ecu-slot="plaque"]').screenshot({ path: DOSSIER + "/nouveau-plaque" + suf + ".png" });
      const dec = await p.evaluate(() => { const vus = [...document.querySelectorAll("#v-trophees [data-item]")].map(x => x.dataset.slot + "." + x.dataset.item), ouv = debloques("Kévin");
        return { n: vus.length, hors: vus.filter(k => { const [s, id] = k.split("."); return !estDepart(s, id) && !ouv.has(k); }), verrous: document.querySelectorAll("#v-trophees .it.verrou").length, badges: !!document.querySelector('.eta[data-ecu-slot="badges"]'), mots: /Gant de l|Légende|2028|🗺️/.test(document.querySelector(".etageres").innerText) }; });
      ok(dec.n >= 30 && !dec.hors.length && !dec.verrous && !dec.badges && !dec.mots, "décembre : rien de 2027 dans les étagères (ni objet bloqué, ni ligne Badges) " + JSON.stringify(dec) + tag);
      // Équiper maintenant depuis la cérémonie du Chercheur de Noël
      await p.evaluate(async () => { ETAT.podium = "gp"; ECU = null; garder(); allerA("classement"); await new Promise(r => setTimeout(r, 300)); ceremonieChercheurNoel(1); await new Promise(r => setTimeout(r, 500)); });
      await p.click(".cn-rev [data-equiper]"); await p.waitForTimeout(1300);
      const eq = await p.evaluate(() => { const w = document.querySelector('.it[data-slot="plaque"][data-item="chercheuror"]').closest(".it-w"), r = w.getBoundingClientRect(), l = w.closest(".eta-l").getBoundingClientRect();
        return { vue: vueActive(), porte: ECU.e.plaque, on: w.querySelector(".it").classList.contains("on"), cible: w.classList.contains("eta-cible"), dansEcran: r.top >= 0 && r.bottom <= innerHeight - 70, dansRangee: r.left >= l.left - 1 && r.right <= l.right + 1, garde: equipDe("Kévin").plaque, cer: !!document.querySelector(".cn-rev") }; });
      await p.screenshot({ path: DOSSIER + "/equiper-maintenant" + suf + ".png" });
      ok(eq.vue === "trophees" && eq.porte === "chercheuror" && eq.on && eq.cible && eq.dansEcran && eq.dansRangee && eq.garde === "aucune" && !eq.cer,
        "« 🏎️ Équiper maintenant » : la page descend jusqu'à la ligne Plaque, la plaque dorée visible dans sa rangée, essayée et mise en évidence (pas encore enregistrée) " + JSON.stringify(eq) + tag);
      // la plaque de l'avent, tout au bout d'une rangée : la rangée défile jusqu'à elle
      const loin = await p.evaluate(async () => { const s = "casque", l = idsSlot(s), id = l[l.length - 1]; scrollTo(0, 0); equiperMaintenant(s, id); await new Promise(r => setTimeout(r, 1300));
        const w = document.querySelector('.it[data-slot="' + s + '"][data-item="' + id + '"]').closest(".it-w"), r = w.getBoundingClientRect(), lr = w.closest(".eta-l").getBoundingClientRect();
        return { id, dansRangee: r.left >= lr.left - 1 && r.right <= lr.right + 1, dansEcran: r.top >= 0 && r.bottom <= innerHeight, cible: w.classList.contains("eta-cible") }; });
      ok(loin.dansRangee && loin.dansEcran && loin.cible, "« Équiper maintenant » vers le dernier objet d'une rangée : la rangée défile jusqu'à lui " + JSON.stringify(loin) + tag);
      ok(!(await deborde(p)) && !err.length, "décembre : 390 px sans débordement, 0 erreur JS " + JSON.stringify(err.slice(0, 3)) + tag);
      await ctx.close(); }
  }
  // 9. 31/12 à 23 h puis 1/1 : rien de 2027 avant l'heure
  for (const [q, att] of [["2026-12-31T23:30:00", false], ["2027-01-01T00:30:00", true]]) {
    const { ctx, p, err } = await page(b, { quand: q });
    await ouvrirEcurie(p);
    const r = await p.evaluate(() => ({ verrous: document.querySelectorAll("#v-trophees .it.verrou").length, badges: !!document.querySelector('.eta[data-ecu-slot="badges"]') }));
    ok((att ? r.verrous > 0 && r.badges : !r.verrous && !r.badges) && !err.length, q + " : " + (att ? "les objets 2027 à gagner apparaissent (🔒)" : "aucun objet 2027, pas de ligne Badges") + " " + JSON.stringify(r));
    await ctx.close(); }
  // 10. fluidité, processeur ×4 : toucher un objet, défiler une rangée
  { const { ctx, p, err } = await page(b, { quand: "2027-01-02T10:00:00" });
    await p.evaluate(() => stock.set("versus.ecuVue", "2d"));   // la voiture en 2D : on mesure l'écurie, pas le moteur 3D logiciel de la machine de test
    await ouvrirEcurie(p);
    const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const m = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms)), frame = () => new Promise(r => requestAnimationFrame(() => r()));
      const t0 = performance.now(); ECU = null; rendreTrophees(); await frame(); const ouvrir = performance.now() - t0;
      const touches = [];
      for (const s of ["casque", "fond", "trainee", "plaque", "finition"]) { const l = document.querySelector('[data-eta-l="' + s + '"]'), its = [...l.querySelectorAll(".it:not(.verrou)")]; const it = its[Math.min(2, its.length - 1)];
        it.scrollIntoView({ block: "center" }); await att(150); const a = performance.now(); it.click(); await frame(); touches.push(Math.round(performance.now() - a)); await att(300); }
      const l = document.querySelector('[data-eta-l="casque"]'); l.scrollIntoView({ block: "center" }); await att(200); l.scrollLeft = 0;
      const dts = []; let prev = performance.now(); const fin = prev + 1200;
      while (performance.now() < fin) { l.scrollLeft += 6; await frame(); const n = performance.now(); dts.push(n - prev); prev = n; }
      dts.sort((a, b) => a - b);
      return { ouvrir: Math.round(ouvrir), touches, med: Math.round(touches.slice().sort((a, b) => a - b)[2]), max: Math.max(...touches), images: dts.length, p95: Math.round(dts[Math.floor(dts.length * .95)]), lentes: dts.filter(x => x > 50).length }; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    ok(m.med < 400 && m.images >= 30 && m.p95 < 100 && !err.length, "processeur ×4 : un toucher redessine en " + m.med + " ms (médiane), une rangée défile à " + m.images + " images en 1,2 s (95 % sous " + m.p95 + " ms) " + JSON.stringify(m));
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
