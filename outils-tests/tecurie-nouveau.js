/* Test (v20.70) · Écurie : ✨ objets gagnés mis en avant, 🏎️ « Équiper maintenant », 🔰 plaque « Recrue 2026 », 🎨 couleur au choix, 🎲 au hasard, 🔒 objets 2027 à gagner.
   Fausses données uniquement (serveur Google intercepté). Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tecurie-nouveau.js  (PORT=…, CAPTURES=…)
   Vérifie : objet gagné → pastille « ✨ Nouveau », en tête de l'emplacement, point sur l'onglet de l'emplacement et sur l'onglet Écurie du Podium ; pastille effacée après vue ;
   « Équiper maintenant » (cérémonie) ouvre le bon emplacement, objet présélectionné, rien d'enregistré ; Recrue 2026 au 1/1 pour un pilote de la chauffe, absente en décembre
   et pour qui n'a pas joué ; couleur des rayures gardée après rechargement (identifiant « rayuresor » envoyé au serveur), visible en 2D, 3D, course, vignette ;
   objets 2027 bloqués visibles au 2/1 (🔒, « ? » qui dit comment l'obtenir, toucher = explication sans essai), invisibles au 15/12 ; exclusif pris par un autre absent chez les autres ;
   « Au hasard » n'utilise que des objets possédés, « Ma tenue enregistrée » revient en arrière ; 0 erreur JS ; 390 px clair et sombre. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie-nouveau");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
/** Nicolas n'a PAS joué la chauffe (premier relevé en décembre : son mois ne compte pas) */
const lignes = (n, i) => n === "Nicolas" ? [ligne(202612, 1000, 0)] : [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)];
const donnees = (session, ecurie, exclusifs) => ({ ok: true, version: 91, genere: "2026-12-02T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: lignes(n, i) })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ecurie || {}, exclusifs: exclusifs || {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const TRESORS = { ok: true, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, chercheurs: [{ nom: "Kévin", j: 20261205 }, { nom: "Clément", j: 20261207 }] }], trouves: [], total: 0 };
async function page(b, o) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" });
  const p = await ctx.newPage(), err = [], envois = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  const S = o.serveur || { ecurie: {} };
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "ecurie") { envois.push(c.equip); S.ecurie[c.personne] = { equip: c.equip }; return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, ecurie: S.ecurie }) }); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? TRESORS : c.action === "tickets" || c.action === "avent" ? { ok: true } : donnees(o.session, S.ecurie, o.exclusifs)) }); });
  await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.ecurieTeaser", "versus.exclVus"].forEach(k => localStorage.setItem(k, k === "versus.exclVus" ? "[]" : "1")); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.evaluate(async () => { if (typeof chargerTresors === "function") { TRESORS = null; TRESORS_T = 0; try { await chargerTresors(); } catch (e) { } } });
  return { ctx, p, err, envois, S };
}
const ouvrirEcurie = (p, slot) => p.evaluate(async s => { document.querySelectorAll(".ecu-rev, .revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov, .av-case, .ere-voile, .mj-rev").forEach(x => x.remove());
  ETAT.podium = "gp"; ECU = null; ECU_NOUV = null; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 400));
  const t = { podiumPt: (document.querySelector('[data-pod="ecurie"] .ecu-nb') || {}).textContent || "" };
  ETAT.podium = "ecurie"; ECU_SLOT = s || "casque"; ECU_Q = null; ECU_NOUV = null; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 500)); return t; }, slot);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    // 1. décembre : Kévin a trouvé le trésor (plaques Chercheur de Noël, dorée) → ✨ Nouveau, en tête, points sur les onglets ; puis effacé après vue
    { const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", sombre, session: { role: "perso", nom: "Kévin" } });
      const t = await ouvrirEcurie(p, "casque");
      const a = await p.evaluate(() => ({ nv: nouveauxEcurie("Kévin"), tab: (document.querySelector('[data-ecu-slot="plaque"] .ecu-pt') || {}).textContent || "", tabCasque: !!document.querySelector('[data-ecu-slot="casque"] .ecu-pt') }));
      ok(t.podiumPt === "2" && a.nv.length === 2 && a.tab === "2" && !a.tabCasque, "décembre : 2 objets gagnés pas vus → compteur 2 sur l'onglet Écurie du Podium et sur l'onglet Plaque " + JSON.stringify(Object.assign(t, a)) + tag);
      await p.evaluate(async () => { ECU_SLOT = "plaque"; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); });
      const pl = await p.evaluate(() => { const it = [...document.querySelectorAll('.items .it')]; return { ordre: it.slice(0, 3).map(x => x.dataset.item), nv: it.filter(x => x.querySelector(".it-nv")).map(x => x.dataset.item), tab: !!document.querySelector('[data-ecu-slot="plaque"] .ecu-pt'), bloque: document.querySelectorAll(".items .it.verrou").length }; });
      ok(pl.ordre[0] === "chercheuror" && pl.ordre[1] === "chercheur" && pl.nv.length === 2 && !pl.tab && !pl.bloque, "Plaque : les nouveaux en tête (dorée d'abord), pastille « ✨ Nouveau », aucun objet 2027 bloqué en décembre " + JSON.stringify(pl) + tag);
      await p.locator(".items").first().screenshot({ path: DOSSIER + "/nouveau-plaque" + (sombre ? "-sombre" : "-clair") + ".png" });
      await p.evaluate(async () => { ECU_SLOT = "casque"; rendreTrophees(); await new Promise(r => setTimeout(r, 200)); ECU_SLOT = "plaque"; rendreTrophees(); await new Promise(r => setTimeout(r, 200)); });
      const apres = await p.evaluate(() => ({ nv: document.querySelectorAll(".items .it-nv").length, n: nouveauxEcurie("Kévin").length, premier: document.querySelector(".items .it").dataset.item }));
      await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); });
      const t2 = await ouvrirEcurie(p, "plaque");
      ok(!apres.nv && !apres.n && apres.premier === "chercheuror" && !t2.podiumPt, "pastille effacée après vue (même après rechargement), l'objet gagné reste en tête des gagnés " + JSON.stringify(Object.assign(apres, t2)) + tag);
      // 2. « Équiper maintenant » depuis la cérémonie du Chercheur de Noël
      await p.evaluate(async () => { ETAT.podium = "gp"; ECU = null; garder(); allerA("classement"); await new Promise(r => setTimeout(r, 300)); ceremonieChercheurNoel(1); await new Promise(r => setTimeout(r, 500)); });
      await p.screenshot({ path: DOSSIER + "/ceremonie-equiper" + (sombre ? "-sombre" : "-clair") + ".png" });
      await p.click(".cn-rev [data-equiper]"); await p.waitForTimeout(900);
      const eq = await p.evaluate(() => ({ vue: vueActive(), pod: ETAT.podium, slot: ECU_SLOT, porte: ECU && ECU.e.plaque, on: (document.querySelector(".items .it.on") || {}).dataset, cer: !!document.querySelector(".cn-rev"), garde: equipDe("Kévin").plaque, btn: !!document.querySelector("#ecu-garder") }));
      ok(eq.vue === "trophees" && eq.pod === "ecurie" && eq.slot === "plaque" && eq.porte === "chercheuror" && eq.on && eq.on.item === "chercheuror" && !eq.cer && eq.garde === "aucune" && eq.btn,
        "« 🏎️ Équiper maintenant » : la cérémonie se ferme, l'écurie s'ouvre sur Plaque, la plaque dorée essayée (pas encore enregistrée : « Enregistrer » reste là) " + JSON.stringify(eq) + tag);
      // 3. 🎨 couleur des Rayures (livrée) : or, enregistrée, gardée après rechargement
      await p.evaluate(async () => { ECU_SLOT = "livree"; ECU_Q = null; rendreTrophees(); await new Promise(r => setTimeout(r, 200)); });
      await p.click('[data-slot="livree"][data-item="rayures"]'); await p.waitForTimeout(400);
      const sel = await p.evaluate(() => [...document.querySelectorAll(".teintes [data-teinte]")].map(x => x.dataset.teinte));
      await p.click('.teintes [data-teinte="or"]'); await p.waitForTimeout(600);
      await p.locator(".items").first().screenshot({ path: DOSSIER + "/couleur-rayures" + (sombre ? "-sombre" : "-clair") + ".png" });
      await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/couleur-rayures-voiture" + (sombre ? "-sombre" : "-clair") + ".png" });
      ok(sel.join() === "blanc,noir,or", "sous les Rayures : 3 couleurs (blanc, noir, or) " + JSON.stringify(sel) + tag);
      await p.click("#ecu-garder"); await p.waitForTimeout(800);
      await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(600);
      const co = await p.evaluate(() => { const e = equipDe("Kévin"), v = voitureEcurie("Kévin", e), pe = Piste.ecurie("Kévin"), v2 = svgVoiture({ nom: "Kévin", e });
        const blanc = Object.assign({}, e, { teintes: {} });
        return { brut: D.ecurie["Kévin"].equip.livree, livree: e.livree, t: e.teintes, v: v.teintes, pe: pe && pe.teintes, d2: /#E9B949/.test(v2), d3: Piste.photo(v) !== Piste.photo(voitureEcurie("Kévin", blanc)), vg: /#E9B949/.test(vignetteItem("livree", "rayures", "Kévin", Object.assign({}, e))) || Piste.photo(voitureEcurie("Kévin", e)) !== null }; });
      ok(co.brut === "rayuresor" && co.livree === "rayures" && co.t && co.t.livree === "or" && co.v.livree === "#E9B949" && co.pe && co.pe.livree === "#E9B949" && co.d2 && co.d3 && co.vg,
        "couleur gardée après rechargement : envoyée « rayuresor » (format accepté par le serveur V91), relue « Rayures » + or ; visible voiture 2D, F1 3D, course, vignette " + JSON.stringify(co) + tag);
      // casque Rayé noir + liseré à ma couleur
      const cq = await p.evaluate(() => { const e = Object.assign({}, equipDe("Kévin"), { casque: "raye", finition: "lisblanc", teintes: { casque: "noir", finition: "pilote" } });
        const s = svgCasque("Kévin", e), s0 = svgCasque("Kévin", Object.assign({}, e, { teintes: {} })), pc = couleurReelle(couleur("Kévin"));
        return { noir: /stroke="#11151B" stroke-width="3.4"/.test(s), lis: s.includes('stroke="' + pc + '" stroke-width="1.4"'), diff: s !== s0, enc: [ecrireTeinte("casque", "raye", "noir"), ecrireTeinte("finition", "lisblanc", "pilote")], lu: lireTeinte("finition", "lisblancpilote") }; });
      ok(cq.noir && cq.lis && cq.diff && cq.enc.join() === "rayenoir,lisblancpilote" && cq.lu.join() === "lisblanc,pilote" && cq.enc.every(x => /^[a-z]{2,16}$/.test(x)), "casque Rayé en noir, liseré à la couleur du pilote ; identifiants de 2 à 16 lettres " + JSON.stringify(cq) + tag);
      // 4. 🎲 au hasard : seulement des objets possédés ; « Ma tenue enregistrée » revient
      const hz = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); const av = equipDe("Kévin"), ouv = debloques("Kévin"), faux = []; ECU = null; ECU_SLOT = "casque"; rendreTrophees(); await new Promise(r => setTimeout(r, 200));
        for (let i = 0; i < 25; i++) { document.querySelector("#ecu-hasard").click(); await new Promise(r => setTimeout(r, 30)); SLOTS_HASARD.forEach(s => { if (!ouv.has(s + "." + ECU.e[s])) faux.push(s + "." + ECU.e[s]); }); }
        const retour = !!document.querySelector("#ecu-retour"), envoye = D.ecurie["Kévin"].equip.livree; document.querySelector("#ecu-retour").click(); await new Promise(r => setTimeout(r, 200));
        return { faux, retour, envoye, a: normTenue(ECU.e), b: normTenue(av), revenu: JSON.stringify(normTenue(ECU.e)) === JSON.stringify(normTenue(av)), plus: !document.querySelector("#ecu-retour") }; });
      ok(!hz.faux.length && hz.retour && hz.envoye === "rayuresor" && hz.revenu && hz.plus, "🎲 Au hasard : 25 tirages, uniquement des objets possédés, rien d'enregistré ; « ↩️ Ma tenue enregistrée » revient " + JSON.stringify(hz) + tag);
      await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/hasard" + (sombre ? "-sombre" : "-clair") + ".png" });
      await p.screenshot({ path: DOSSIER + "/ecurie-page" + (sombre ? "-sombre" : "-clair") + ".png", fullPage: false });
      const deb = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      ok(!deb && !err.length, "décembre : 390 px sans débordement, 0 erreur JS " + JSON.stringify(err.slice(0, 3)) + tag);
      await ctx.close(); }
  }
  // 5. Recrue 2026 : absente le 31/12, présente le 1/1 pour Kévin (a joué la chauffe), jamais pour Nicolas (n'a pas joué) ; nouvelle ✨ au 1/1
  for (const [q, qui, att] of [["2026-12-31T20:00:00", "Kévin", false], ["2027-01-01T09:00:00", "Kévin", true], ["2027-01-02T09:00:00", "Nicolas", false]]) {
    const { ctx, p, err } = await page(b, { quand: q, session: { role: "perso", nom: qui } });
    const r = await p.evaluate(m => ({ a: debloques(m).has("plaque.recrue"), vis: idsSlot("plaque").includes("recrue"), nv: nouveauxEcurie(m).includes("plaque.recrue"), q: texteOrigineItem(m, "plaque", "recrue"), lib: rareteItem("plaque", "recrue").lib }), qui);
    const bon = att ? r.a && r.vis && r.nv && /Recrue 2026/.test(r.q.t) && /tour de chauffe/.test(r.q.p) && r.lib === "Souvenir" : !r.a && !r.vis;
    ok(bon && !err.length, q.slice(0, 10) + " · " + qui + " : Recrue 2026 " + (att ? "offerte (a joué la chauffe), ✨ nouvelle, « ? » = souvenir du tour de chauffe" : "absente") + " " + JSON.stringify(r));
    if (att) { await ouvrirEcurie(p, "plaque"); await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll(".ba, .revel, .tuto, .regles, .ere-voile, .mj-rev, .gp-plein").forEach(x => x.remove())); await p.locator(".items").first().screenshot({ path: DOSSIER + "/recrue-2026.png" }); }
    await ctx.close(); }
  // 6. 🔒 objets 2027 à gagner : visibles au 2/1 (cadenas, « ? » comment l'obtenir, toucher = explication sans essai), invisibles au 15/12 ; exclusif pris par Clément absent chez Kévin
  { const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", session: { role: "perso", nom: "Kévin" } });
    const r = await p.evaluate(() => SLOTS.flatMap(([s]) => idsSlot(s).filter(id => !debloques("Kévin").has(s + "." + id)).map(id => s + "." + id)));
    ok(!r.length && !err.length, "15/12 : aucun objet 2027 visible, même bloqué " + JSON.stringify(r)); await ctx.close(); }
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const { ctx, p, err } = await page(b, { quand: "2027-01-02T10:00:00", sombre, session: { role: "perso", nom: "Kévin" }, exclusifs: { premiersang: { nom: "Clément", noms: ["Clément"], mois: 202701 } } });
    await ouvrirEcurie(p, "casque");
    const r = await p.evaluate(async () => {
      const its = [...document.querySelectorAll(".items .it")], verrous = its.filter(x => x.classList.contains("verrou")), idx = its.findIndex(x => x.classList.contains("verrou"));
      const apresVerrou = its.slice(idx).some(x => !x.classList.contains("verrou"));
      const q = verrous.length ? verrous[0].closest(".it-w").querySelector(".it-q") : null, qStyle = q ? getComputedStyle(q) : null;
      const avant = ECU.e.casque; if (verrous[0]) verrous[0].click(); await new Promise(r => setTimeout(r, 200));
      const det = (document.querySelector("#it-d") || {}).innerText || "";
      // l'exclusif « Premier sang » (klaxon Damier) est à Clément : plus dans les bloqués de Kévin ; l'objet commun (plaque) reste à gagner
      const kl = idsSlot("klaxon"), pl = idsSlot("plaque"), clem = (() => { const m = moiVrai; return null; })();
      return { n: verrous.length, ordreOk: idx >= 0 && !apresVerrou, q: !!q && parseFloat(qStyle.width) >= 24, essai: ECU.e.casque === avant, det, damier: kl.includes("damier") ? "visible" : "absent", plaqueCommune: pl.includes("premiersang"), mjAvance: SLOTS.flatMap(([s]) => idsSlot(s).filter(id => origineItem(s, id).mj && MJ_OBJETS[s + "." + id] > 202701)) };
    });
    // le klaxon Damier est aussi un objet de départ ? on vérifie sur l'objet exclusif réel de Premier sang
    const ex = await p.evaluate(() => { const x = SUCCES.find(z => z.id === "premiersang"), [s, id] = x.bonus; return { k: s + "." + id, depart: estDepart(s, id), visKevin: idsSlot(s).includes(id), prisAutre: prisParAutre(s, id, "Kévin") }; });
    ok(r.n >= 3 && r.ordreOk && r.q && r.essai && /Comment l'obtenir/i.test(r.det) && (ex.depart || (!ex.visKevin && ex.prisAutre)) && r.plaqueCommune && !r.mjAvance.length && !err.length,
      "2/1/2027 : objets à gagner visibles en dernier (🔒, « ? » bien visible, toucher = « Comment l'obtenir » sans essai) ; exclusif pris par Clément absent chez Kévin ; aucun mini-jeu avant son mois " + JSON.stringify({ r, ex, err: err.slice(0, 3) }) + tag);
    await p.evaluate(() => document.querySelectorAll(".ba, .revel, .tuto, .regles, .ere-voile, .mj-rev").forEach(x => x.remove()));
    await p.locator(".items").first().screenshot({ path: DOSSIER + "/bloques-2027" + (sombre ? "-sombre" : "-clair") + ".png" });
    const hz = await p.evaluate(async () => { const ouv = debloques("Kévin"), faux = []; for (let i = 0; i < 30; i++) { document.querySelector("#ecu-hasard").click(); await new Promise(r => setTimeout(r, 20)); SLOTS_HASARD.forEach(s => { if (!ouv.has(s + "." + ECU.e[s])) faux.push(s + "." + ECU.e[s]); }); } return faux; });
    ok(!hz.length && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "2027 : « Au hasard » ignore les objets bloqués ; 390 px sans débordement " + JSON.stringify(hz) + tag);
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
