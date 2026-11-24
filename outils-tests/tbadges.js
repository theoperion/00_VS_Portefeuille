/* Test (refonte des badges, Théo 24/11) · l'onglet Trophées en 3 vitrines : 🏆 Mes trophées (+ Gant de l'infini), 🔍 Les secrets (doré / argenté),
   ⚔️ Les titres (🚩 Drapeau de tête, 🔥 Flamme, 🔍 Flair : rien qui ressemble au 👑 du Premier millionnaire) ; plus de tableau « Défis » ; cérémonie dorée de la Coupe pour le premier trouveur ; aperçu sans détenteurs avant le 1/1/2027.
   Fausses données uniquement (serveur Google intercepté) ; serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tbadges.js
   Saison inventée au 15/03/2027 (janvier et février joués) :
   - janvier : Kévin +6 % (1er), Théo +2 %, Clément +1 %, Devlin +0,5 %, Nicolas −3 % (dernier)
   - février : Nicolas +7 % (1er, avec un 🎲 Pari gagné contre Kévin, leader au départ du mois), Clément +5,5 %, Théo +1 %, Kévin 0 %, Devlin −2 % (dernier)
   → « Décollage » (+5 % en un mois) : Kévin doré (figé par le serveur), Nicolas et Clément argentés ; Nicolas a 4 pierres du Gant ;
     la Flamme reste à Kévin (série commencée en janvier, il garde à égalité) ; le Flair à Clément (trésors). */
const { chromium } = require("playwright"), fs = require("fs");
const DOSSIER = process.env.CAPTURES || "/tmp/claude-0/-home-user/6d9f1796-e607-5fc4-8119-363a157f01a8/scratchpad/badges";
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const R = { 202701: [0.02, 0.06, 0.01, 0.005, -0.03], 202702: [0.01, 0, 0.055, -0.02, 0.07] };
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i) {
  const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010;
  if (R[202701]) [202701, 202702].forEach(k => { v = Math.round(v * (1 + R[k][i]) + 50); rows.push(ligne(k, v, R[k][i])); });
  return { nom, rows };
}
function donnees(session, chauffe) {
  const P = chauffe ? NOMS.map((nom, i) => ({ nom, rows: [ligne(202611, 1000, 0.01)] })) : NOMS.map(personne);
  return { ok: true, version: 85, genere: "2027-03-15T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes: P,
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005], [202701, 0.008], [202702, 0.015]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: chauffe ? {} : { decollage: { nom: "Kévin", mois: 202701 } },
    cartes: chauffe ? {} : { 2027: { Nicolas: { 202702: { c: "pari", cible: "Kévin" } } } }, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
const TRESORS = { ok: true, total: 2, trouves: ["silverstone", "djeddah"], tresors: [
  { circuit: "silverstone", chercheurs: [{ nom: "Clément", j: 20270104 }, { nom: "Théo", j: 20270106 }, { nom: "Kévin", j: 20270110 }] },
  { circuit: "djeddah", chercheurs: [{ nom: "Théo", j: 20270203 }, { nom: "Clément", j: 20270205 }] },
  { circuit: "melbourne", enigme: "Énigme inventée pour le test", chercheurs: [] }] };
async function page(b, quand, session, sombre, chauffe) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify(chauffe ? { ok: true, tresors: [], trouves: [], total: 0 } : TRESORS) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(donnees(session, chauffe)) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.saison1", "1"); });
  await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1500);
  await p.evaluate(async () => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait").forEach(x => x.remove()); ETAT.podium = "defis"; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 900)); });
  return { ctx, p, err };
}
const deborde = () => [...document.querySelectorAll("#v-trophees *")].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(x => x.className || x.tagName).slice(0, 5);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", { ctx, p, err } = await page(b, "2027-03-15T10:00:00", { role: "perso", nom: "Théo" }, sombre);
    const r = await p.evaluate(() => { const v = document.querySelector("#v-trophees"), t = v.innerText;
      const sec = [...v.querySelectorAll(".sec-t")], dec = v.querySelector('.sec-t[data-secret="decollage"]');
      const cour = id => { const c = v.querySelector('.cour[data-cour="' + id + '"] .cour-q b'); return c ? c.textContent : null; };
      return { vit: ["#vit-trophees", "#vit-secrets", "#vit-titres"].every(s => v.querySelector(s)), t, defis: !!v.querySelector(".defis-m, .tr-bloc") || /Chasseur d'indice|Six de rang|Métronome/.test(t) || /\bDéfis\b/.test(t),
        nSec: sec.length, nCache: v.querySelectorAll(".sec-t.cache .sil").length, decTxt: dec ? dec.innerText : "", decOuvert: dec && dec.classList.contains("ouvert"),
        gantNico: (() => { const s = [...v.querySelectorAll(".gant-autres .nmp")].find(x => /Nicolas/.test(x.textContent)); return s ? s.textContent.replace(/\s+/g, " ").trim() : ""; })(),
        gantCalc: etatGant(2027).Nicolas.n, leader: championnat(2027).classement[0], drapeau: cour("drapeau"), flamme: cour("flamme"), flair: cour("flair"),
        orphelins: Object.keys(ITEMS).flatMap(sl => Object.keys(ITEMS[sl]).filter(id => BASE_ECURIE[sl] !== id && !Object.keys(origineItem(sl, id)).length).map(id => sl + "." + id)),
        univ4: ["singapour", "interlagos", "bahrein", "melbourne"].map(u => [u, TROPHEES_MONDES.filter(t => t.univers === u).flatMap(t => t.gain).concat(SECRETS_SAISON.filter(x => x.univers === u).flatMap(x => x.bonus ? [x.bonus] : [])).map(g => g.join("."))]),
        tropheesN: v.querySelectorAll(".tm").length, titres: (() => { const s = v.querySelector("#vit-titres"); return s ? { txt: s.textContent, svg: s.querySelectorAll(".cour-i .titre-svg").length, nav: (v.querySelector(".vit-nav") || {}).textContent || "" } : null; })(), euro: /€/.test(t) }; });
    const deb = await p.evaluate(`(${deborde})()`);
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(r.vit, "les 3 vitrines s'affichent au 15/03/2027 (🏆 Mes trophées, 🔍 Les secrets, ⚔️ Les titres)" + tag);
    ok(!r.defis, "plus de tableau « Défis » (ni les 16 anciens défis)" + tag);
    ok(r.nSec === 12 && r.nCache >= 6 && r.nCache < 12, "12 secrets visibles, cachés (silhouette) tant que personne ne les a (" + r.nCache + " cachés)" + tag);
    ok(r.decOuvert && /🥇\s*Kévin/.test(r.decTxt) && /🥈\s*Nicolas, Clément/.test(r.decTxt), "« Décollage » réussi par 3 pilotes : 1 doré (Kévin) + 2 argentés (Nicolas, Clément) " + JSON.stringify(r.decTxt) + tag);
    ok(r.gantCalc === 4 && /Nicolas 4\s*\/6/.test(r.gantNico), "le Gant de Nicolas (construit pour 4 pierres) montre 4 / 6 " + JSON.stringify(r.gantNico) + tag);
    ok(r.drapeau === r.leader && r.flamme === "Kévin" && r.flair === "Clément", "le Drapeau de tête au leader (" + r.leader + "), la Flamme à Kévin, le Flair à Clément " + JSON.stringify([r.drapeau, r.flamme, r.flair]) + tag);
    ok(r.titres && /⚔️ Les titres/.test(r.titres.txt) && /ils se volent/.test(r.titres.txt) && /Drapeau de tête/.test(r.titres.txt) && r.titres.svg === 3 && !/👑|couronne/i.test(r.titres.txt + r.titres.nav), "vitrine « ⚔️ Les titres » : 3 emblèmes dessinés (🚩 🔥 🔍), aucun 👑 ni « couronne » (réservés au Premier millionnaire)" + tag);
    ok(!r.orphelins.length, "chaque objet de l'écurie se gagne quelque part (trophée, secret, Gant, million, vote, ticket d'or ou réserve 2028) " + JSON.stringify(r.orphelins) + tag);
    { const U = Object.fromEntries(r.univ4), A = { singapour: ["livree.chocolat", "klaxon.ouvriers"], interlagos: ["casque.eclaireur", "trainee.cables"], bahrein: ["casque.toque", "plaque.ratatouille"], melbourne: ["livree.carte", "fond.chat"] };
      ok(Object.keys(A).every(u => A[u].every(g => U[u].includes(g))), "les 8 nouveaux objets récompensent leur univers (Chocolaterie, Mur des titans, Petit Chef, Merveilles) " + JSON.stringify(U) + tag); }
    ok(r.tropheesN === 12, "12 trophées des mondes" + tag);
    ok(!r.euro, "aucun montant « € » dans l'onglet" + tag);
    ok(!deb.length, "390 px : rien ne déborde " + JSON.stringify(deb) + tag);
    await p.screenshot({ path: DOSSIER + "/trophees-" + (sombre ? "sombre" : "clair") + ".png", fullPage: true });
    if (!sombre) {
      await p.locator(".gant").screenshot({ path: DOSSIER + "/gant.png" });
      // un secret ouvert : son histoire, en % seulement
      const s = await p.evaluate(async () => { ouvrirSecret("decollage"); await new Promise(r => setTimeout(r, 1200)); const o = document.querySelector(".sec-ov"); return o ? o.innerText : ""; });
      await p.locator(".sec-ov .rv-c").screenshot({ path: DOSSIER + "/secret-ouvert.png" });
      ok(/Décollage · janvier 2027 · \+6,0\s%\s*sur le mois/.test(s) && /Nicolas[\s\S]*février 2027 · \+7,0\s%/.test(s) && !/€/.test(s), "le secret raconte son histoire (date + %, jamais un montant) " + JSON.stringify(s.slice(0, 160)));
      await p.evaluate(() => document.querySelectorAll(".sec-ov").forEach(x => x.remove()));
      const c = await p.evaluate(async () => { const h = ouvrirSecret("hattrick"); await new Promise(r => setTimeout(r, 300)); const o = document.querySelector(".sec-ov"), t = o ? o.innerText : ""; document.querySelectorAll(".sec-ov").forEach(x => x.remove()); return t; });
      ok(/Secret caché/i.test(c) && /Indice/i.test(c) && !/Hat-trick/.test(c), "un secret que personne n'a : caché, seulement un indice");
      // la cérémonie dorée de la Coupe : premier à trouver le trésor
      const g = await p.evaluate(async () => { TRESORS = Object.assign({}, TRESORS, { coupe: COUPE_EX }); revelerEclat({ circuit: "melbourne", matiere: "MATIERE-TEST", couleur: "#E7A1C4", symbole: "✶", texte: "Texte inventé pour le test." }, 1); await new Promise(r => setTimeout(r, 1400)); const o = document.querySelector(".cb-or"); return o ? o.innerText : ""; });
      await p.screenshot({ path: DOSSIER + "/coupe-ceremonie-doree.png" });
      ok(/Premier à trouver le trésor/i.test(g) && /Gravé à ton nom/i.test(g) && /Théo/i.test(g), "Coupe : le 1er trouveur a la cérémonie dorée plein écran, son nom gravé");
      const s2 = await p.evaluate(async () => { document.querySelectorAll(".cb-or").forEach(x => x.remove()); revelerEclat({ circuit: "melbourne", matiere: "MATIERE-TEST", couleur: "#E7A1C4", texte: "Texte." }, 2); await new Promise(r => setTimeout(r, 300)); return { or: !!document.querySelector(".cb-or"), simple: !!document.querySelector(".cb-rev") }; });
      ok(!s2.or && s2.simple, "Coupe : les suivants gardent la révélation simple");
    }
    await ctx.close();
  }
  { // Nicolas voit ses 4 pierres allumées
    const { ctx, p, err } = await page(b, "2027-03-15T10:00:00", { role: "perso", nom: "Nicolas" }, false);
    const n = await p.evaluate(() => ({ on: document.querySelectorAll(".gant .pierres li.on").length, svg: document.querySelectorAll(".gant-svg .pierre.on").length }));
    ok(!err.length && n.on === 4 && n.svg === 4, "Nicolas voit 4 pierres allumées sur son Gant " + JSON.stringify(n));
    await ctx.close();
  }
  for (const QD of ["2026-12-03T10:00:00", "2026-12-15T10:00:00", "2026-12-20T10:00:00", "2026-12-31T22:00:00"]) { // avant le 1/1/2027 : rien des nouvelles vitrines pour un joueur, même en forçant (révélations du 20/12 et du 1/1)
    const { ctx, p, err } = await page(b, QD, { role: "perso", nom: "Clément" }, false, true);
    const a = await p.evaluate(() => { const v = document.querySelector("#v-trophees"), t = v.innerText;
      return { onglet: !!v.querySelector('[data-pod="defis"]'), att: /Voici ce qui t'attend/.test(t), vit: !!v.querySelector("#vit-secrets") && !!v.querySelector(".gant"),
        detenteurs: v.querySelectorAll(".sec-t.ouvert, .cour-q b, .gant-autres, .tm .rt-dots").length, cache: v.querySelectorAll(".sec-t.cache").length, univ: v.querySelectorAll(".univ:not(.cache)").length, ecurie: !!v.querySelector('[data-pod="ecurie"]') }; });
    await p.screenshot({ path: DOSSIER + "/apercu-15-12-2026.png", fullPage: true });
    ok(!err.length && !a.onglet && !a.vit && !a.detenteurs && !a.ecurie && !/secret|Gant de l'infini|titre|drapeau/i.test(await p.evaluate(() => document.querySelector("#v-trophees").innerText)), QD.slice(0, 10) + " : le joueur n'a ni onglet Trophées ni Écurie, rien des vitrines ne fuit avant janvier (règle de Théo) " + JSON.stringify(a));
    await ctx.close();
  }
  await b.close();
  process.exit(ko.length ? 1 : 0);
})();
