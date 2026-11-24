/* Test v20.48 · La course EN DIRECT pendant le mois (Théo) + textes hors du dessin + ⏸ pause / ▶ reprise + 📷 mode photo + 📐 schéma.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tdirect.js   (PORT=… pour un autre port)
   Aucune vraie donnée : le serveur Google est intercepté (chiffres inventés). Les % de février de 3 pilotes sont des valeurs « signature »
   (7,31 %, 6,42 %, 5,53 %) : le mois est incomplet (Devlin manque), on vérifie qu'elles ne se voient nulle part et ne changent rien à la course.
   Vérifie : au 10 du mois, tour 1, ordre de la grille (classement d'avant le mois), plus loin si le S&P monte que s'il baisse, jamais de recul
   d'un jour à l'autre, ligne d'arrivée le dernier jour ; janvier 2027 = ordre du tour de chauffe, l'absent (Nicolas) derrière ; décembre (chauffe)
   = ordre de novembre ; après clôture, course complète en 2 tours ; pause / reprise (2D, 3D, plein écran) ; commentaires, bulles et tour
   dans le bandeau sous le dessin (jamais dessus) ; mode photo ; schéma ; 0 erreur JS ; captures 390 px clair et sombre. */
const { chromium } = require("playwright"), fs = require("fs");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || "/tmp/claude-0/-home-user/6d9f1796-e607-5fc4-8119-363a157f01a8/scratchpad/course";
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
const vide = k => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-27", [null, null, null, null, null, null, null, null], [0, 0, 0, null, 0].concat(Array(20).fill(0))];
const R = { "Théo": [0.012, -0.01, 0.02], "Kévin": [0.03, 0.025, -0.01], "Clément": [-0.01, 0.005, 0.015], "Devlin": [0.02, -0.02, 0.03] };   // nov, déc, janv
const SIG = { "Théo": 0.0731, "Kévin": 0.0642, "Clément": 0.0553 };
/** jusqua : dernier mois relevé (202611, 202612, 202701) ; sig : ajoute février « signature » (incomplet, Devlin manque) ; sp(j) : S&P du jour j du mois kSP */
function donnees(jusqua, o) {
  o = o || {};
  const personnes = NOMS.map((n, i) => {
    if (n === "Nicolas") return { nom: n, rows: jusqua >= 202612 ? [ligne(202612, 900, 0)].concat(jusqua >= 202701 ? [ligne(202701, 950, 0.01)] : []) : [] };   // ouvert en décembre : pas au classement de la chauffe
    const rows = [ligne(202610, 1000 + i, 0.01)]; let v = 1000 + i;
    [202611, 202612, 202701].forEach((k, j) => { if (k <= jusqua) { v = Math.round(v * (1 + R[n][j])); rows.push(ligne(k, v, R[n][j])); } });
    if (o.sig) rows.push(n === "Devlin" ? vide(202702) : ligne(202702, v + 70, SIG[n]));
    return { nom: n, rows };
  });
  const L = [], vals = [];
  if (o.kSP) { const y = Math.floor(o.kSP / 100), m = o.kSP % 100, N = new Date(y, m, 0).getDate(), prev = new Date(y, m - 1, 0);
    L.push(prev.getFullYear() * 10000 + (prev.getMonth() + 1) * 100 + prev.getDate()); vals.push(5000);
    for (let d = 1; d <= N; d++) { const w = new Date(y, m - 1, d).getDay(); if (w === 0 || w === 6) continue; L.push(o.kSP * 100 + d); vals.push(Math.round(5000 * (1 + o.sp(d)) * 100) / 100); } }
  return { ok: true, version: 87, genere: "2027-02-10T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: ["S&P 500", "Nasdaq-100"], mois: [202610, 202611, 202612, 202701].filter(k => k <= jusqua).map(k => [k, 0.004, 0.005]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: o.kSP ? { jour: [], semaines: [], series: [], quot: { d: L, s: [{ nom: "S&P 500", v: vals }, { nom: "Or", v: vals.map(() => 2000) }] } } : null,
    objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function ouvrir(b, quand, data, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : data) }); });
  await p.addInitScript(([vu, d2]) => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.saison1", "1");
    localStorage.setItem("versus.gpVu.2027", String(vu)); localStorage.setItem("versus.gpVu.2026", "202612"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.deJanvier", "1"); localStorage.setItem("versus.aideVisite", "1");
    localStorage.setItem("versus.feteChauffe", "202612"); }, [o.vu || 202712, o.d3 ? "0" : "1"]);
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1000);
  await p.evaluate(async d3 => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "gp"; ETAT.gp2d = d3 ? "0" : "1"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees();
    await new Promise(r => setTimeout(r, 1500)); document.querySelectorAll(".revel, .ba, .ere-voile").forEach(x => x.remove()); }, !!o.d3);
  return { p, ctx, err };
}
const etat = p => p.evaluate(() => { const ys = saisonCourante(), y = ys || 2027, et = etapesGP(y), i = GP_ETAPE !== null ? GP_ETAPE : etapeParDefaut(et, y), c = championnat(y), kGP = et[i].k || (c.chauffe ? CHAUFFE_K : y * 100 + 1);
  const dir = courseDirect(et, i, kGP), cur = GP_INST ? GP_INST.api.courant() : {}, ordre = Object.keys(cur).sort((a, b) => cur[b] - cur[a]);
  return { y, kGP, i, dir: dir ? { f: dir.dv.f, j: dir.dv.j, N: dir.dv.N, r: dir.dv.r, grille: dir.grille } : null, cur, ordre, max: Math.max(...Object.values(cur)), type: GP_INST && GP_INST.api.type, enCours: GP_INST && GP_INST.api.enCours(), scen: !!GP_SCEN }; });
/** textes hors du dessin : chaque texte visible (bandeau, commentaire, bulles, tour) ne recouvre pas la zone du dessin (.gp-scene) */
const horsDessin = p => p.evaluate(() => { const sc = document.querySelector("#gp-piste .gp-scene"); if (!sc) return { ok: false, pb: ["pas de scène"] }; const S = sc.getBoundingClientRect(), pb = [];
  document.querySelectorAll("#gp-piste :is(.gp-com, .gp-pops, .gp-pop, .gp-tour, .gp-st-info, .gp-st, .gp-zone, .gp-hud)").forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).display === "none") return;
    const ix = Math.min(r.right, S.right) - Math.max(r.left, S.left), iy = Math.min(r.bottom, S.bottom) - Math.max(r.top, S.top); if (ix > 1 && iy > 1) pb.push(e.className + " " + Math.round(iy) + "px"); });
  return { ok: !pb.length, pb, st: !!document.querySelector("#gp-piste .gp-st") }; });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); }, errs = [];
  const up = d => 0.0035 * d, down = d => -0.0035 * d;   // S&P : +3,5 % / −3,5 % au 10 du mois
  // 1. février 2027, au 10 : S&P en hausse / en baisse, avec les % « signature » de février (mois incomplet)
  const A = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { sig: true, kSP: 202702, sp: up }), { vu: 202701 }); await A.p.waitForTimeout(4200);
  const eA = await etat(A.p), hA = await horsDessin(A.p), txtA = await A.p.evaluate(() => { document.querySelectorAll("details").forEach(d => d.open = true); return document.body.innerText; });
  await A.p.screenshot({ path: DOSSIER + "/direct-2d-hausse.png", fullPage: false });
  await A.p.evaluate(() => { const s = document.querySelector(".gp-schema"); if (s) { s.open = true; s.scrollIntoView({ block: "center" }); } }); await A.p.waitForTimeout(300); await A.p.screenshot({ path: DOSSIER + "/schema-clair.png" });
  const grilleA = await A.p.evaluate(() => mancheGP(etapesGP(2027), etapesGP(2027).length - 1, 202702).grille), classJanv = await A.p.evaluate(() => { const c = championnat(2027), m = c.mois.find(x => x.k === 202701); return Object.keys(m.cumul).sort((a, b) => m.cumul[b] - m.cumul[a]); });
  errs.push(...A.err); await A.ctx.close();
  const B = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { sig: true, kSP: 202702, sp: down }), { vu: 202701 }); await B.p.waitForTimeout(4200);
  const eB = await etat(B.p), meteoB = await B.p.evaluate(() => meteoMois(202702).id); await B.p.screenshot({ path: DOSSIER + "/direct-2d-baisse.png" }); errs.push(...B.err); await B.ctx.close();
  const C0 = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701 }); await C0.p.waitForTimeout(4200); const eC = await etat(C0.p); errs.push(...C0.err); await C0.ctx.close();
  ok(eA.dir && eA.dir.j === 10 && eA.kGP === 202702, "février, le 10 : la manche de février se court en direct (jour " + (eA.dir && eA.dir.j) + "/" + (eA.dir && eA.dir.N) + ")");
  ok(eA.max < 1 && eA.max > 0.2, "tour 1 seulement : le premier est à " + eA.max.toFixed(3) + " tour (< 1)");
  ok(JSON.stringify(eA.ordre) === JSON.stringify(grilleA) && JSON.stringify(grilleA.filter(n => classJanv.includes(n))) === JSON.stringify(classJanv), "ordre des voitures = grille = classement d'avant le mois " + JSON.stringify(eA.ordre));
  const ecarts = eA.ordre.slice(1).map((n, k) => +(eA.cur[eA.ordre[k]] - eA.cur[n]).toFixed(4)); ok(ecarts.every(x => Math.abs(x - ecarts[0]) < 1e-6 && x > 0), "petits écarts fixes entre les voitures " + JSON.stringify(ecarts));
  ok(eA.max > eB.max + 0.05, "S&P en hausse : le peloton est plus loin (" + eA.max.toFixed(3) + ") qu'en baisse (" + eB.max.toFixed(3) + ") ; base du 10/28 = " + (10 / 28).toFixed(3));
  ok(meteoB === "pluie" || meteoB === "orage", "S&P en baisse : pluie sur le circuit (" + meteoB + ")");
  ok(JSON.stringify(eA.cur) === JSON.stringify(eC.cur), "les % des pilotes ne changent rien à la course en direct (positions identiques avec ou sans % de février)");
  const sig = ["7,3 %", "6,4 %", "5,5 %", "7,31", "6,42", "5,53"].filter(s => txtA.includes(s)); ok(!sig.length, "aucun % de pilote visible pendant le mois " + JSON.stringify(sig));
  ok(hA.ok && hA.st, "2D : tour, commentaires et bulles dans le bandeau sous le dessin, rien dessus " + JSON.stringify(hA.pb));
  // 2. jamais de recul d'un jour à l'autre (S&P qui monte puis s'effondre), ligne d'arrivée le dernier jour
  const yoyo = d => d < 12 ? 0.006 * d : 0.072 - 0.012 * (d - 12);
  const Y = await ouvrir(b, "2027-02-01T12:00:00", donnees(202701, { kSP: 202702, sp: yoyo }), { vu: 202701 }); const serie = [];
  for (let d = 1; d <= 28; d++) { await Y.p.clock.setFixedTime(new Date(2027, 1, d, 12)); serie.push(await Y.p.evaluate(() => directGP(202702).f)); }
  await Y.p.clock.setFixedTime(new Date(2027, 2, 3, 12)); const apres = await Y.p.evaluate(() => directGP(202702)); errs.push(...Y.err); await Y.ctx.close();
  ok(serie.every((f, k) => !k || f >= serie[k - 1] - 1e-12), "jamais de recul : avance non décroissante du 1er au 28 (S&P +7 % puis −12 %) " + serie.map(f => f.toFixed(2)).join(" "));
  ok(serie[27] === 1 && serie[26] < 1, "ligne d'arrivée le dernier jour (28/02 = 1 tour), pas avant");
  ok(apres.fini && apres.f === 1, "mois fini, résultats pas connus : le peloton attend sur la ligne");
  // 3. janvier 2027 : ordre du tour de chauffe, Nicolas (absent de la chauffe) derrière
  const J = await ouvrir(b, "2027-01-10T12:00:00", donnees(202612, { kSP: 202701, sp: up }), { vu: 0 }); await J.p.waitForTimeout(4200);
  const eJ = await etat(J.p), chauffe = await J.p.evaluate(() => championnat(2026).classement), txtJ = await J.p.evaluate(() => document.body.innerText);
  await J.p.screenshot({ path: DOSSIER + "/direct-janvier.png" }); errs.push(...J.err); await J.ctx.close();
  ok(eJ.dir && eJ.kGP === 202701 && JSON.stringify(eJ.ordre) === JSON.stringify(chauffe.concat(["Nicolas"])), "janvier 2027 : ordre du tour de chauffe " + JSON.stringify(chauffe) + " puis Nicolas (absent) → " + JSON.stringify(eJ.ordre));
  ok(/l'ordre du tour de chauffe de décembre/.test(txtJ), "janvier : la page le dit (« l'ordre du tour de chauffe de décembre »)");
  // 4. décembre 2026 (chauffe) : ordre de novembre, en direct
  const Dc = await ouvrir(b, "2026-12-10T12:00:00", donnees(202611, { kSP: 202612, sp: up }), { vu: 0 }); await Dc.p.waitForTimeout(4200);
  const eD = await etat(Dc.p), nov = await Dc.p.evaluate(() => rendementsDuMois(0, 202611).sort((a, b) => b.r - a.r).map(x => x.nom)); errs.push(...Dc.err);
  ok(eD.dir && eD.kGP === 202612 && JSON.stringify(eD.ordre.slice(0, nov.length)) === JSON.stringify(nov) && eD.max < 1 && eD.max > 0.2, "tour de chauffe (10/12) : en direct, ordre de novembre " + JSON.stringify(eD.ordre));
  await Dc.ctx.close();
  // 5. après clôture : la course complète (2 tours, scénario) ; ⏸ pause / ▶ reprise en 2D
  const K = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701 });
  await K.p.evaluate(() => { GP_ETAPE = 1; rendreTrophees(); }); await K.p.waitForTimeout(600);
  await K.p.click("#gp-rejouer"); await K.p.waitForTimeout(2500);
  const k0 = await etat(K.p), vuePause = await K.p.isVisible("#gp-pause");
  await K.p.click("#gp-pause"); await K.p.waitForTimeout(150); const p1 = await etat(K.p); await K.p.waitForTimeout(1500); const p2 = await etat(K.p);
  const lib = await K.p.evaluate(() => { const b = document.getElementById("gp-pause"); return b.textContent + "|" + b.getAttribute("aria-pressed"); });
  await K.p.screenshot({ path: DOSSIER + "/pause-2d.png" });
  await K.p.click("#gp-pause"); await K.p.waitForTimeout(1200); const p3 = await etat(K.p);
  const hK = await horsDessin(K.p);
  await K.p.evaluate(() => document.getElementById("gp-fin").click()); await K.p.waitForTimeout(500); const kf = await etat(K.p), vuePauseFin = await K.p.isVisible("#gp-pause");
  await K.p.waitForTimeout(400); await K.p.screenshot({ path: DOSSIER + "/arrivee-2d-bulles.png" }); const hK2 = await horsDessin(K.p);
  errs.push(...K.err); await K.ctx.close();
  ok(k0.scen && !k0.dir && k0.enCours, "manche de janvier (close) : la course complète en 2 tours se joue (scénario)");
  ok(vuePause, "bouton ⏸ Pause visible pendant la course");
  ok(JSON.stringify(p1.cur) === JSON.stringify(p2.cur) && /Reprendre\|true/.test(lib), "⏸ en pause : les voitures ne bougent plus (1,5 s), le bouton devient « ▶ Reprendre »");
  ok(p3.max > p2.max + 0.01, "▶ reprise : la course repart d'où elle était (" + p2.max.toFixed(3) + " → " + p3.max.toFixed(3) + ")");
  ok(kf.max >= 2 && kf.max < 2.5 && !kf.enCours && !vuePauseFin, "⏭ arrivée : le vainqueur a passé la ligne des 2 tours (" + kf.max.toFixed(3) + "), le bouton pause disparaît");
  ok(hK.ok && hK2.ok, "2D en course et à l'arrivée (bulles de points) : textes hors du dessin " + JSON.stringify(hK.pb.concat(hK2.pb)));
  // 6. 3D (si le navigateur a WebGL), plein écran, pause, sous-titres, mode photo, en sombre
  const T = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701, d3: true, sombre: true });
  const a3 = await T.p.evaluate(() => piste3D());
  if (a3) {
    await T.p.evaluate(() => { GP_ETAPE = 1; choisirVueGP("poursuite", 2027); rendreTrophees(); }); await T.p.waitForTimeout(900);
    await T.p.click("#gp-rejouer"); await T.p.waitForTimeout(6500); const e3 = await etat(T.p), h3 = await horsDessin(T.p);
    await T.p.screenshot({ path: DOSSIER + "/course-3d-sombre.png" });
    ok(e3.type === "3d" && h3.ok, "3D (Hélico) : sous-titres sous le dessin, rien dessus " + JSON.stringify(h3.pb));
    await T.p.click("#gp-plein-gros"); await T.p.waitForTimeout(900);
    const hp = await T.p.evaluate(() => { const sc = document.querySelector(".gp-plein .gp-scene").getBoundingClientRect(), st = document.querySelector(".gp-plein .gp-st").getBoundingClientRect(); return { recouvre: st.top < sc.bottom - 1, stH: Math.round(st.height), scB: Math.round(sc.bottom), stT: Math.round(st.top) }; });
    await T.p.screenshot({ path: DOSSIER + "/plein-3d-sous-titres.png" });
    const pz = await T.p.isVisible(".gpp-pause"); await T.p.click(".gpp-pause"); await T.p.waitForTimeout(120); const q1 = await etat(T.p); await T.p.waitForTimeout(1200); const q2 = await etat(T.p);
    await T.p.click(".gpp-pause"); await T.p.waitForTimeout(1200); const q3 = await etat(T.p);
    ok(!hp.recouvre && hp.stH >= 40, "plein écran : le bandeau de sous-titres est sous le dessin, il ne le recouvre pas " + JSON.stringify(hp));
    ok(pz && JSON.stringify(q1.cur) === JSON.stringify(q2.cur) && (q3.max > q2.max + 0.01 || !q3.enCours), "plein écran 3D : ⏸ fige la course, ▶ la reprend");
    await T.p.click(".gpp-photo"); await T.p.waitForTimeout(500);
    const ph = await T.p.evaluate(() => ({ photo: document.querySelector(".gp-plein").classList.contains("photo"), barre: getComputedStyle(document.querySelector(".gpp-bar")).display, st: getComputedStyle(document.querySelector(".gp-plein .gp-st")).display, sc: Math.round(document.querySelector(".gp-plein .gp-scene").getBoundingClientRect().height), h: innerHeight }));
    await T.p.waitForTimeout(2700); await T.p.screenshot({ path: DOSSIER + "/photo-3d.png" });
    await T.p.mouse.click(200, 300); await T.p.waitForTimeout(400);
    const ph2 = await T.p.evaluate(() => ({ photo: document.querySelector(".gp-plein").classList.contains("photo"), barre: getComputedStyle(document.querySelector(".gpp-bar")).display }));
    ok(ph.photo && ph.barre === "none" && ph.st === "none" && ph.sc >= ph.h - 2, "📷 mode photo : boutons et sous-titres cachés, le décor prend tout l'écran " + JSON.stringify(ph));
    ok(!ph2.photo && ph2.barre !== "none", "un toucher ramène l'interface");
  } else console.log("(3D indisponible dans ce navigateur : partie 3D sautée)");
  errs.push(...T.err); await T.ctx.close();
  // 7. plein écran 2D + photo ; schéma dans les règles ; sombre
  const F = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: down }), { vu: 202701, sombre: true, vp: { width: 844, height: 390 } });
  await F.p.click("#gp-plein-gros"); await F.p.waitForTimeout(800); await F.p.screenshot({ path: DOSSIER + "/plein-2d-direct-paysage.png" });
  const hf = await F.p.evaluate(() => { const sc = document.querySelector(".gp-plein .gp-scene").getBoundingClientRect(), st = document.querySelector(".gp-plein .gp-st").getBoundingClientRect(); return st.top >= sc.bottom - 1; });
  ok(hf, "plein écran 2D (paysage) : sous-titres sous le dessin");
  await F.p.click(".gpp-photo"); await F.p.waitForTimeout(2800); await F.p.screenshot({ path: DOSSIER + "/photo-2d.png" }); await F.p.keyboard.press("Escape"); await F.p.waitForTimeout(300);
  const fe = await F.p.evaluate(() => !!document.querySelector(".gp-plein") && !document.querySelector(".gp-plein.photo")); ok(fe, "Échap quitte le mode photo (le plein écran reste)");
  errs.push(...F.err); await F.ctx.close();
  const G = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701, sombre: true });
  await G.p.evaluate(() => { const s = document.querySelector(".gp-schema"); s.open = true; s.scrollIntoView({ block: "center" }); }); await G.p.waitForTimeout(300); await G.p.screenshot({ path: DOSSIER + "/schema-sombre.png" });
  const sch = await G.p.evaluate(() => document.querySelectorAll(".gp-schema-l li svg").length);
  await G.p.evaluate(() => ouvrirRegles("gp")); await G.p.waitForTimeout(600);
  const rg = await G.p.evaluate(() => { const l = document.querySelector(".regles .rg-schema"); if (!l) return 0; l.scrollIntoView({ block: "center" }); return l.querySelectorAll(".gp-schema-l li svg").length; }); await G.p.waitForTimeout(300);
  await G.p.screenshot({ path: DOSSIER + "/schema-regles-sombre.png" });
  const larg = await G.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok(sch === 4 && rg === 4, "schéma dessiné (4 étapes en SVG) sous la course et dans les règles (" + sch + ", " + rg + ")");
  ok(larg, "390 px : pas de défilement horizontal");
  errs.push(...G.err); await G.ctx.close();
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 5)));
  await b.close(); console.log("Captures : " + DOSSIER); process.exit(ko.length ? 1 : 0);
})();
