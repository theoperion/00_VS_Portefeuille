/* Test (v20.61) · L'Écurie ouvre le 1er décembre 2026 (décision de Théo, 25/11), avec une révélation « Ton écurie ouvre ses portes ».
   Fausses données uniquement (serveur Google intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tecurie-dec.js
   Vérifie : 30/11 = pas d'onglet Écurie, pas de révélation, voitures d'avant ; 1/12 = onglet Écurie, révélation une seule fois (un toucher ferme) ;
   en décembre, seulement les objets de départ, RIEN de 2027 (ni objet de monde, ni succès, ni univers, ni « Trophées ») ; Trophées cachés jusqu'au 1/1 ;
   un objet 2027 déjà enregistré retombe sur la série ; 0 erreur JS ; 390 px clair et sombre. Captures dans CAPTURES. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie-dec");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
/** écuries INVENTÉES : Kévin a déjà enregistré des objets de 2027 (ils ne doivent pas apparaître en décembre) */
const ECURIES = { "Kévin": { equip: { livree: "ver", casque: "anneau", finition: "feuilledor", trainee: "sabre", numero: 44 } }, "Clément": { equip: { casque: "damier", fond: "damier", pilote: "casque", numero: 3 } } };
const donnees = session => ({ ok: true, version: 91, genere: "2026-12-02T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECURIES, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function page(b, o) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" });
  const p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "ecurie" ? { ok: true } : c.action === "tickets" ? { ok: true } : donnees(o.session)) }); });
  if (!o.ctx) await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  return { ctx, p, err };
}
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const etat = p => p.evaluate(() => ({ ecurie: !!document.querySelector('#v-trophees [data-pod="ecurie"]'), defis: !!document.querySelector('#v-trophees [data-pod="defis"]'), teaser: !!document.querySelector(".ecu-rev"),
    ouverte: ecurieOuverte(), piste: Piste.ecurie ? Piste.ecurie("Kévin") : null }));
  const ouvrirPodium = p => p.evaluate(async () => { document.querySelectorAll(".ecu-rev, .revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "gp"; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 500)); });
  // 1. le 30 novembre : rien
  { const { ctx, p, err } = await page(b, { quand: "2026-11-30T21:00:00", session: { role: "perso", nom: "Kévin" } });
    await p.waitForTimeout(3500); const t = await p.evaluate(() => !!document.querySelector(".ecu-rev")); await ouvrirPodium(p); const a = await etat(p);
    ok(!t && !a.ecurie && !a.defis && !a.ouverte && !a.piste && !err.length, "30/11/2026 : ni onglet Écurie, ni révélation, voitures d'avant en course " + JSON.stringify(Object.assign({ t }, a, { piste: !!a.piste })));
    await ctx.close(); }
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    // 2. le 1er décembre : la révélation, une seule fois
    const { ctx, p, err } = await page(b, { quand: "2026-12-01T08:00:00", sombre, session: { role: "perso", nom: "Kévin" } });
    await p.waitForSelector(".ecu-rev", { timeout: 9000 }).catch(() => {});
    await p.waitForTimeout(500); await p.screenshot({ path: DOSSIER + "/teaser-ecurie-porte" + (sombre ? "-sombre" : "-clair") + ".png" });   // la porte du garage à mi-course
    const r = await p.evaluate(() => { const o = document.querySelector(".ecu-rev"); return o ? { t: o.innerText, voit: !!o.querySelector(".er-garage svg.voiture"), porte: !!o.querySelector(".er-porte") } : null; });
    ok(r && /Ton écurie ouvre ses portes/i.test(r.t) && /casque/.test(r.t) && /livrée/.test(r.t) && /traînée/.test(r.t) && /tout au long de 2027/.test(r.t) && r.voit && r.porte, "1/12/2026 : la révélation « Ton écurie ouvre ses portes » (porte du garage, voiture du pilote, 3 lignes)" + tag);
    const avoirs = await p.evaluate(() => { const o = document.querySelector(".ecu-rev"); if (!o) return []; const t = o.innerText; return Object.keys(ITEMS).flatMap(s => Object.keys(ITEMS[s]).filter(id => !estDepart(s, id) && t.includes(ITEMS[s][id]))).concat(CAL_GP.map(c => GPS[c].ville).filter(v => t.includes(v))).concat(/Trophée|Monde|Succès|Gant|Légende/.test(t) ? ["mot 2027"] : []); });
    ok(!avoirs.length, "la révélation ne dévoile rien de 2027 (aucun nom d'objet, d'univers, ni Trophées/Mondes/Succès/Gant) " + JSON.stringify(avoirs) + tag);
    await p.waitForTimeout(2600);
    await p.screenshot({ path: DOSSIER + "/teaser-ecurie" + (sombre ? "-sombre" : "-clair") + ".png" });
    const deb = await p.evaluate(() => { const c = document.querySelector(".ecu-rev .rv-c"); return c ? c.getBoundingClientRect().right > innerWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1 : true; });
    ok(!deb, "révélation lisible à 390 px, rien ne déborde" + tag);
    await p.mouse.click(195, 60); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => !!document.querySelector(".ecu-rev"))), "un toucher ferme la révélation" + tag);
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(3800);
    ok(!(await p.evaluate(() => !!document.querySelector(".ecu-rev"))), "vue une seule fois : rien au deuxième passage" + tag);
    // 3. l'Écurie de décembre : objets de départ seulement, rien de 2027
    await ouvrirPodium(p); const a = await etat(p);
    ok(a.ecurie && !a.defis && a.ouverte, "décembre : l'onglet Écurie est là, Trophées toujours caché" + tag + " " + JSON.stringify({ ecurie: a.ecurie, defis: a.defis }));
    const ec = await p.evaluate(async () => {
      ETAT.podium = "ecurie"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 900));
      const fuites = [], vus = [], slots = [...document.querySelectorAll("[data-ecu-slot]")].map(x => x.dataset.ecuSlot), dec = ITEMS;
      for (const s of slots) { ECU_SLOT = s; rendreTrophees(); await new Promise(r => setTimeout(r, 120));
        const v = document.querySelector("#v-trophees"), t = v.innerText;
        [...v.querySelectorAll("[data-item]")].forEach(x => { vus.push(x.dataset.slot + "." + x.dataset.item); if (!estDepart(x.dataset.slot, x.dataset.item)) fuites.push(x.dataset.slot + "." + x.dataset.item); });
        const permis = new Set(Object.keys(dec).flatMap(sl => Object.keys(dec[sl]).filter(id => estDepart(sl, id)).map(id => dec[sl][id])));   // noms des objets montrés (vignettes, onglets, grille)
        [...v.querySelectorAll(".it-n, .slot-tabs small, .gar-eq span, .grille-dep .plaque")].forEach(x => { const n = (x.lastChild && x.lastChild.textContent || x.textContent).trim(); if (n && !permis.has(n) && !/^#\d+$|^Tête$|^Casque$|^auto$/.test(n)) fuites.push("nom:" + n); });
        CAL_GP.forEach(c => { if (t.includes(GPS[c].ville) || t.includes(GPS[c].gp)) fuites.push("univers:" + c); });
        if (/Trophée|🗺️|Succès|Gant de l|Légende|réserve|2028/.test(t)) fuites.push("mot:" + s);
        [...v.querySelectorAll("[data-itq]")].forEach(q => { ECU_Q = q.dataset.itq; }); }
      // le « ? » d'un objet de départ
      ECU_SLOT = "casque"; ECU_Q = "casque.damier"; rendreTrophees(); await new Promise(r => setTimeout(r, 120)); const q = (document.querySelector("#it-d") || {}).innerText || "";
      return { slots, fuites, vus, q, badges: slots.includes("badges"), lbl: (document.querySelector(".sr-k") || {}).innerText };
    });
    ok(ec.vus.length >= 10 && !ec.fuites.length, "décembre : seulement les objets de départ dans l'Écurie, rien de 2027 (" + ec.vus.length + " objets : " + ec.vus.join(", ") + ") " + JSON.stringify(ec.fuites) + tag);
    ok(!ec.badges && /départ|série/i.test(ec.q), "décembre : pas d'onglet Badges ; le « ? » d'un objet de départ le dit " + JSON.stringify(ec.q) + tag);
    // v20.68 (Théo) : l'écurie de décembre n'est plus vide : au moins 4 choix par emplacement (sauf plaque et filtre), tous « départ », aucun lié à 2027,
    // chacun DESSINÉ (vignette, casque SVG, voiture 2D, F1 3D, pastille et traînée de la course) et différent de l'objet de série
    const dep = await p.evaluate(async () => {
      const r = { court: [], pas2027: [], nonDessine: [], q: [] }, nom = "Kévin", e0 = equipDe(nom);
      ["casque", "finition", "fond", "livree", "trainee", "klaxon"].forEach(s => { const l = idsSlot(s); if (l.length < 4) r.court.push(s + ":" + l.length); });
      const gains = [].concat(...SUCCES.map(x => [x.gain, x.bonus]), ...TROPHEES_MONDES.map(t => t.gain), GANT.gain, GAINS_MILLION, GAINS_TICKET, GAINS_SOUVENIR, gainsSecret(CHAMPION_EX)).filter(Boolean).map(g => g.join("."));
      const nouveaux = DEPART_ECURIE.slice(4);
      nouveaux.forEach(([s, id]) => { const o = origineItem(s, id); if (!o.depart || gains.includes(s + "." + id) || objetReserve(s, id) || (typeof MJ_OBJETS !== "undefined" && MJ_OBJETS[s + "." + id])) r.pas2027.push(s + "." + id);
        if (!/départ/i.test(texteOrigineItem(nom, s, id).t)) r.q.push(s + "." + id); });
      const base = s => BASE_ECURIE[s];
      const ph = e => Piste.photo(voitureEcurie(nom, e)), v2 = e => svgVoiture({ nom, e: Object.assign({}, e, { numero: 7 }) }).replace(/sv\d+/g, "");
      const vg = (s, id) => vignetteItem(s, id, nom, e0).replace(/sv\d+|kl[pts]\b/g, "");
      const vb = e => { const m = {}; ["casque", "finition", "livree", "trainee"].forEach(s => m[s] = e[s]); return m; };
      for (const [s, id] of nouveaux) {
        const e = Object.assign({}, e0, { [s]: id }), eB = Object.assign({}, e0, { [s]: base(s) }), manque = [];
        if (!vg(s, id) || vg(s, id) === vg(s, base(s))) manque.push("vignette");
        if (["casque", "finition", "livree", "trainee"].includes(s) && v2(e) === v2(eB)) manque.push("voiture 2D");
        if (["casque", "finition", "livree"].includes(s) && ph(e) === ph(eB)) manque.push("F1 3D");
        if (s === "klaxon" && !/<svg/.test(vg(s, id))) manque.push("dessin");
        if (manque.length) r.nonDessine.push(s + "." + id + " (" + manque.join(", ") + ")");
      }
      return r;
    });
    ok(!dep.court.length && !dep.pas2027.length && !dep.nonDessine.length && !dep.q.length, "décembre : au moins 4 choix par emplacement, tous « départ », rien de 2027, chaque nouvel objet dessiné (vignette, voiture 2D, F1 3D) et « ? » = départ " + JSON.stringify(dep) + tag);
    // Kévin a enregistré des objets 2027 : ils retombent sur la série partout (écurie, course)
    const kv = await p.evaluate(() => { const e = equipDe("Kévin"), pe = Piste.ecurie("Kévin"); return { e: [e.livree, e.casque, e.finition, e.trainee, e.numero], pe: pe && [pe.livree, pe.casqueModele, pe.finition, pe.trainee, pe.numero] }; });
    ok(JSON.stringify(kv.e) === JSON.stringify(["couleur", "uni", "aucune", "simple", 44]) && kv.pe && kv.pe[1] === "uni" && kv.pe[4] === 44, "un objet de 2027 déjà enregistré retombe sur la série (écurie et course), le numéro reste " + JSON.stringify(kv) + tag);
    // on équipe le casque Damier (départ) et on enregistre
    await p.evaluate(async () => { ECU_SLOT = "casque"; ECU_Q = null; rendreTrophees(); await new Promise(r => setTimeout(r, 150)); });
    await p.click('[data-slot="casque"][data-item="damier"]'); await p.waitForTimeout(500);
    await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/ecurie-decembre" + (sombre ? "-sombre" : "-clair") + ".png" });
    await p.screenshot({ path: DOSSIER + "/ecurie-decembre-page" + (sombre ? "-sombre" : "-clair") + ".png" });
    const deb2 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!deb2 && !err.length, "décembre : Écurie lisible à 390 px, 0 erreur JS" + tag + " " + JSON.stringify(err.slice(0, 3)));
    // v20.61 (règle de Théo) : EN COURSE chacun garde son visage (jamais le casque ni l'avatar de l'écurie) ; partout ailleurs, ce qu'il a choisi
    const vis = await p.evaluate(async () => {
      ETAT.podium = "gp"; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 2500));
      const c = document.querySelector("#v-trophees .s-corps"), course = { casque: c.querySelectorAll(".av svg.casque").length, damier: c.querySelectorAll(".av-damier").length, tetes: c.querySelectorAll(".av.av-tete").length };
      const pr = document.querySelector("#gp-piste"), piste = pr ? { casque: pr.querySelectorAll(".av svg.casque").length, damier: pr.querySelectorAll(".av-damier").length } : null;
      allerA("classement"); await new Promise(r => setTimeout(r, 600)); const k = document.querySelector("#v-classement") || document.body;
      const classement = { casque: k.querySelectorAll(".av svg.casque").length, damier: k.querySelectorAll(".av-damier").length };
      allerA("trophees"); ETAT.podium = "ecurie"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 300));
      return { course, piste, classement, aide: /En course, on garde ton visage/.test(document.querySelector("#v-trophees").innerText) };
    });
    ok(vis.course.tetes >= 5 && !vis.course.casque && !vis.course.damier && (!vis.piste || (!vis.piste.casque && !vis.piste.damier)) && vis.classement.casque >= 1 && vis.classement.damier >= 1 && vis.aide,
      "en course, Clément garde son visage (ni casque ni avatar Damier) ; au Classement, son casque et son avatar Damier ; l'aide de l'écurie le dit " + JSON.stringify(vis) + tag);
    // les règles de décembre parlent de l'écurie, sans rien de 2027
    const rg = await p.evaluate(async () => { ouvrirRegles(); await new Promise(r => setTimeout(r, 300)); const o = document.querySelector(".regles"), t = o ? o.innerText : ""; if (o) o.remove(); return t; });
    ok(/Écurie/.test(rg) && /1er décembre|1\s*er décembre/.test(rg) && !/Trophées|Succès|Gant de l'infini|Mondes/.test(rg), "règles de décembre : l'écurie ouverte depuis le 1er décembre, rien de 2027" + tag);
    await ctx.close();
  }
  // 3 bis. le souvenir du calendrier de l'Avent (plaque « Hiver 2026 », traînée « Flocons ») : choisissable dans l'écurie de décembre à partir du 24/12, pas avant ; toujours rien de 2027
  for (const [q, attendu] of [["2026-12-23T20:00:00", false], ["2026-12-24T09:00:00", true]]) {
    const { ctx, p, err } = await page(b, { quand: q, session: { role: "perso", nom: "Nicolas" } });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const ids = SLOTS.flatMap(([s]) => idsSlot(s).map(id => s + "." + id));
      return { pl: ids.includes("plaque.hiver26"), tr: ids.includes("trainee.flocons"), autres: ids.filter(k => { const [s, id] = k.split("."); return !estDepart(s, id) && !GAINS_SOUVENIR.some(g => g.join(".") === k); }) }; });
    ok(r.pl === attendu && r.tr === attendu && !r.autres.length && !err.length, q.slice(0, 10) + " : souvenir de l'Avent (Hiver 2026, Flocons) " + (attendu ? "choisissable" : "pas encore là") + ", aucun objet 2027 " + JSON.stringify(r));
    await ctx.close(); }
  // 3 ter. v20.62 (Théo) : plaque « Chercheur de Noël » déduite de la liste publique des chercheurs du trésor de décembre (Kévin 1er, Clément 2e, Nicolas rien)
  for (const [qui, att] of [["Kévin", "or"], ["Clément", "normale"], ["Nicolas", "rien"]]) {
    const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", session: { role: "perso", nom: qui } });
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, chercheurs: [{ nom: "Kévin", j: 20261205 }, { nom: "Clément", j: 20261207 }] }], trouves: [], total: 0 }) });
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "ecurie" || c.action === "avent" || c.action === "tickets" ? { ok: true } : donnees({ role: "perso", nom: qui })) }); });
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(800);
    const r = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); const m = moiVrai(), d = debloques(m), ids = idsSlot("plaque");
      const q = texteOrigineItem(m, "plaque", "chercheur"), qo = texteOrigineItem(m, "plaque", "chercheuror");
      TRESOR_APERCU = { sauve: {} }; const ap = debloques(m).has("plaque.chercheur"); TRESOR_APERCU = null;
      return { n: d.has("plaque.chercheur"), o: d.has("plaque.chercheuror"), vis: ids.filter(i => /chercheur/.test(i)), q: q.p, qo: qo.p, ap, rar: rareteItem("plaque", "chercheuror").lib }; });
    const bon = att === "or" ? r.n && r.o && r.vis.length === 2 && /le 5\/12/.test(r.q) && /premier|plus rapide/.test(r.qo) && r.rar === "Exclusif" : att === "normale" ? r.n && !r.o && r.vis.join() === "chercheur" && /le 7\/12/.test(r.q) : !r.n && !r.o && !r.vis.length;
    ok(bon && !r.ap && !err.length && !/cach|où|sous|derrière/i.test(r.q + r.qo), "Chercheur de Noël · " + qui + " : " + (att === "or" ? "1er → plaque dorée et normale" : att === "normale" ? "2e → plaque normale" : "pas trouvé → aucune plaque") + " ; l'aperçu admin ne donne rien ; rien sur la cachette " + JSON.stringify(r));
    if (att === "or") { await p.evaluate(async () => { document.querySelectorAll(".ecu-rev,.revel").forEach(x => x.remove()); ETAT.podium = "ecurie"; ECU_SLOT = "plaque"; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 900)); ceremonieChercheurNoel(1); await new Promise(r => setTimeout(r, 600)); });
      const t = await p.evaluate(() => (document.querySelector(".cn-rev") || {}).innerText || "");
      ok(/Tu gagnes la plaque Chercheur de Noël/.test(t) && /premier/.test(t), "cérémonie de décembre : « 🎁 Tu gagnes la plaque Chercheur de Noël » (dorée pour le premier)");
      await p.screenshot({ path: DOSSIER + "/chercheur-noel-ceremonie.png" });
      await p.evaluate(() => document.querySelectorAll(".cn-rev, .revel, .ecu-rev").forEach(x => x.remove())); await p.waitForTimeout(900);
      await p.locator(".items").first().screenshot({ path: DOSSIER + "/chercheur-noel-ecurie.png" }); }
    await ctx.close(); }
  // 4. animations réduites : révélation sans animation, voiture visible tout de suite
  { const { ctx, p, err } = await page(b, { quand: "2026-12-05T08:00:00", reduit: true, session: { role: "perso", nom: "Nicolas" } });
    await p.waitForSelector(".ecu-rev", { timeout: 9000 }).catch(() => {});
    const r = await p.evaluate(() => { const o = document.querySelector(".ecu-rev"), v = o && o.querySelector(".er-voit"); return o ? { op: getComputedStyle(v).opacity, porte: getComputedStyle(o.querySelector(".er-porte")).display } : null; });
    ok(r && +r.op === 1 && r.porte === "none" && !err.length, "animations réduites : la voiture est là tout de suite, pas de porte qui bouge " + JSON.stringify(r));
    await ctx.close(); }
  // 5. le 2 janvier 2027 : plus de révélation de décembre (place à la saison) ; l'écurie reste ouverte
  { const { ctx, p, err } = await page(b, { quand: "2027-01-02T10:00:00", session: { role: "perso", nom: "Devlin" } });
    await p.waitForTimeout(3800); const t = await p.evaluate(() => !!document.querySelector(".ecu-rev"));
    ok(!t && (await p.evaluate(() => ecurieOuverte() && !ecurieDepart())) && !err.length, "2/1/2027 : pas de révélation de décembre, l'écurie suit la saison (objets 2027 selon les règles)");
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
