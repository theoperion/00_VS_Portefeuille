/* Test v20.47 · La course EN DIRECT pendant le mois (Théo) + textes hors du dessin + ⏸ pause / ▶ reprise + 📷 mode photo + 📐 schéma + 6 nouveaux circuits 3D + ambiance après pause.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tdirect.js   (PORT=… pour un autre port, CAPTURES=… pour le dossier des captures)
   Aucune vraie donnée : le serveur Google est intercepté (chiffres inventés). Les % de février de 3 pilotes sont des valeurs « signature »
   (7,31 %, 6,42 %, 5,53 %) : le mois est incomplet (Devlin manque), on vérifie qu'elles ne se voient nulle part et ne changent rien à la course.
   Vérifie : au 10 du mois, tour 1, ordre de la grille (classement d'avant le mois), plus loin si le S&P monte que s'il baisse, jamais de recul
   d'un jour à l'autre, ligne d'arrivée le dernier jour ; janvier 2027 = ordre du tour de chauffe, l'absent (Nicolas) derrière ; décembre (chauffe)
   = ordre de novembre ; après clôture, course complète en 2 tours ; pause / reprise (2D, 3D, plein écran) ; commentaires, bulles et tour
   dans le bandeau sous le dessin (jamais dessus) ; mode photo ; schéma seulement dans les règles (plus jamais sur la page Course, décembre compris) ; 0 erreur JS ; captures 390 px clair et sombre.
   v20.52 (Théo) : grille 2D alignée en quinconce (pastilles sans chevauchement, ordre de la grille) ; 🎬 course de démonstration seulement
   avant le 1er décembre (aucune requête d'écriture, aucun %, « manche vue » intacte, pause visible, dépassements, 2D, 3D et plein écran) ;
   26/11/2026 (Théo) : plus de météo du marché : que le S&P monte ou s'effondre, aucun pictogramme météo, aucune couche de pluie en 2D, les mêmes
   particules du décor en 3D (beau temps toujours), en 2D et en 3D, sans erreur ; « réduire les animations » : aucune particule. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "direct");   // captures hors du dépôt (CAPTURES=… pour un autre dossier)
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
  const req = []; await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c.action || (/action=(\w+)/.exec(r.request().url()) || [])[1] || "?");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : data) }); });
  await p.addInitScript(([vu, d2]) => { for (let m = 1; m <= 12; m++) localStorage.setItem("versus.piegeMois." + (202700 + m), "1");   // l'affichette du 1er du mois (tpiege) déjà vue
    localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.saison1", "1");
    localStorage.setItem("versus.gpVu.2027", String(vu)); localStorage.setItem("versus.gpVu.2026", "202612"); localStorage.setItem("versus.baVu.2027", "202712"); localStorage.setItem("versus.deJanvier", "1"); localStorage.setItem("versus.aideVisite", "1");
    localStorage.setItem("versus.feteChauffe", "202612"); }, [o.vu || 202712, o.d3 ? "0" : "1"]);
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1000);
  await p.evaluate(async d3 => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "gp"; ETAT.gp2d = d3 ? "0" : "1"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees();
    await new Promise(r => setTimeout(r, 1500)); document.querySelectorAll(".revel, .ba, .ere-voile").forEach(x => x.remove()); }, !!o.d3);
  return { p, ctx, err, req };
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
  // v20.62 (Théo) : « S&P 500 : +3,5 % depuis le 1er », le nom de l'indice et le chiffre séparés, le % en gras (vert si ça monte)
  const ixA = await A.p.evaluate(() => { const i = document.querySelector(".gp-st-info"), b = i && i.querySelector("b.ix-up"); return { t: i ? i.textContent : "", b: !!b, col: b ? getComputedStyle(b).color : "" }; });
  ok(/S&P 500\u00a0: \+[\d,]+\u00a0?%/.test(ixA.t.replace(/ %/, "\u00a0%")) && ixA.b && !/S&P 500 \d/.test(ixA.t), "bandeau du direct : « S&P 500 : +x % depuis le 1er », le % en gras et en vert " + JSON.stringify(ixA));
  const grilleA = await A.p.evaluate(() => mancheGP(etapesGP(2027), etapesGP(2027).length - 1, 202702).grille), classJanv = await A.p.evaluate(() => { const c = championnat(2027), m = c.mois.find(x => x.k === 202701); return Object.keys(m.cumul).sort((a, b) => m.cumul[b] - m.cumul[a]); });
  errs.push(...A.err); await A.ctx.close();
  const B = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { sig: true, kSP: 202702, sp: down }), { vu: 202701 }); await B.p.waitForTimeout(4200);
  const eB = await etat(B.p); await B.p.screenshot({ path: DOSSIER + "/direct-2d-baisse.png" }); errs.push(...B.err); await B.ctx.close();
  const C0 = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701 }); await C0.p.waitForTimeout(4200); const eC = await etat(C0.p); errs.push(...C0.err); await C0.ctx.close();
  ok(eA.dir && eA.dir.j === 10 && eA.kGP === 202702, "février, le 10 : la manche de février se court en direct (jour " + (eA.dir && eA.dir.j) + "/" + (eA.dir && eA.dir.N) + ")");
  ok(eA.max < 1 && eA.max > 0.2, "tour 1 seulement : le premier est à " + eA.max.toFixed(3) + " tour (< 1)");
  ok(JSON.stringify(eA.ordre) === JSON.stringify(grilleA) && JSON.stringify(grilleA.filter(n => classJanv.includes(n))) === JSON.stringify(classJanv), "ordre des voitures = grille = classement d'avant le mois " + JSON.stringify(eA.ordre));
  const ecarts = eA.ordre.slice(1).map((n, k) => +(eA.cur[eA.ordre[k]] - eA.cur[n]).toFixed(4)); ok(ecarts.every(x => Math.abs(x - ecarts[0]) < 1e-6 && x > 0), "petits écarts fixes entre les voitures " + JSON.stringify(ecarts));
  ok(eA.max > eB.max + 0.05, "S&P en hausse : le peloton est plus loin (" + eA.max.toFixed(3) + ") qu'en baisse (" + eB.max.toFixed(3) + ") ; base du 10/28 = " + (10 / 28).toFixed(3));
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
  const schD = await Dc.p.evaluate(() => ({ s: document.querySelectorAll(".gp-schema").length, t: /Comment avance la course/.test(document.body.textContent) }));
  ok(!schD.s && !schD.t, "26/11 (Théo) : en décembre aussi, plus de schéma « Comment avance la course » sur la page Course " + JSON.stringify(schD));
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
    // v20.58 : la course 3D dure ~20 s, mais en 3D logicielle (sans carte graphique) les captures et les clics prennent plusieurs secondes :
    // elle était souvent déjà arrivée ici, donc ⏸ caché à juste titre et clic bloqué 30 s. On la relance depuis le plein écran (↻) et on attend
    // qu'elle roule vraiment (feux passés) avant de vérifier ⏸ ; si ⏸ manque pendant la course, le contrôle est NON (sans attente bloquée).
    await T.p.evaluate(() => document.querySelector(".gp-plein .gpp-play").click()); await T.p.waitForFunction(() => GP_INST && GP_INST.api.enCours() && GP_HORLOGE && tempsCourse(GP_HORLOGE) > GP_HORLOGE.feux + 300, null, { timeout: 15000 });
    const pz = await T.p.isVisible(".gpp-pause"); let q1 = {}, q2 = { cur: 1 }, q3 = {};
    // v20.62 : clic direct (en 3D logicielle, une capture peut durer plus que la course : le clic « attendre que ce soit visible » restait bloqué 30 s)
    const clicPause = () => T.p.evaluate(() => { const x = document.querySelector(".gpp-pause"); if (x && !x.hidden) x.click(); });
    if (pz) { await clicPause(); await T.p.waitForTimeout(120); q1 = await etat(T.p); await T.p.waitForTimeout(1200); q2 = await etat(T.p);
      await clicPause(); await T.p.waitForTimeout(1200); q3 = await etat(T.p); }
    ok(!hp.recouvre && hp.stH >= 40, "plein écran : le bandeau de sous-titres est sous le dessin, il ne le recouvre pas " + JSON.stringify(hp));
    ok(pz && JSON.stringify(q1.cur) === JSON.stringify(q2.cur) && (q3.max > q2.max + 0.01 || !q3.enCours), "plein écran 3D : ⏸ fige la course, ▶ la reprend " + JSON.stringify({ pz, q1: q1.max, q2: q2.max, q3: q3.max, en3: q3.enCours }));
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
  const sch = await G.p.evaluate(() => document.querySelectorAll(".gp-schema-l li svg").length);
  await G.p.evaluate(() => ouvrirRegles("gp")); await G.p.waitForTimeout(600);
  const rg = await G.p.evaluate(() => { const l = document.querySelector(".regles .rg-schema"); if (!l) return 0; l.scrollIntoView({ block: "center" }); return l.querySelectorAll(".gp-schema-l li svg").length; }); await G.p.waitForTimeout(300);
  await G.p.screenshot({ path: DOSSIER + "/schema-regles-sombre.png" });
  const larg = await G.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok(sch === 0 && rg === 4, "v20.87 puis 26/11 (Théo) : plus de schéma sous la course, il est dans les règles (4 étapes en SVG) (" + sch + ", " + rg + ")");
  ok(larg, "390 px : pas de défilement horizontal");
  errs.push(...G.err); await G.ctx.close();
  // 8. S&P absent : le peloton avance avec les jours seulement (avance = jour / nombre de jours)
  const S0 = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701), { vu: 202701 }); await S0.p.waitForTimeout(3800);
  const s0 = await S0.p.evaluate(() => { const v = directGP(202702), i = document.querySelector("#gp-piste .gp-st-info"); return { f: v.f, r: v.r, j: v.j, N: v.N, info: i ? i.textContent : "" }; });
  errs.push(...S0.err); await S0.ctx.close();
  ok(s0.r === null && Math.abs(s0.f - 10 / 28) < 1e-9, "S&P absent : avance = jour/nb jours (" + s0.f.toFixed(4) + " = 10/28), sous-titre « " + s0.info + " »");
  // 9. ⏸ puis ⏭ en direct : le bouton pause disparaît ; l'ambiance n'est jamais retenue par le direct (sans son)
  const P0 = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701 });
  await P0.p.waitForFunction(() => GP_INST && !GP_INST.api.enCours(), null, { timeout: 8000 });
  await P0.p.click("#gp-rejouer"); await P0.p.waitForTimeout(400);
  const pd1 = await P0.p.evaluate(() => ({ vis: !document.getElementById("gp-pause").hidden, dir: !!courseDirect(etapesGP(2027), etapesGP(2027).length - 1, 202702) }));
  await P0.p.click("#gp-pause"); await P0.p.waitForTimeout(150);
  const pd2 = await P0.p.evaluate(() => ({ p: enPauseGP(), amb: SONS.ambianceRetenue(), txt: document.getElementById("gp-pause").textContent }));
  await P0.p.click("#gp-pause"); await P0.p.waitForTimeout(150);
  const pd3 = await P0.p.evaluate(() => ({ p: enPauseGP(), amb: SONS.ambianceRetenue(), txt: document.getElementById("gp-pause").textContent }));
  await P0.p.click("#gp-pause"); await P0.p.waitForTimeout(150);
  await P0.p.evaluate(() => document.getElementById("gp-fin").click()); await P0.p.waitForTimeout(300);
  const pd4 = await P0.p.evaluate(() => ({ vis: !document.getElementById("gp-pause").hidden, en: GP_INST.api.enCours(), amb: SONS.ambianceRetenue() }));
  errs.push(...P0.err); await P0.ctx.close();
  ok(pd1.vis && pd1.dir && pd2.p && /Reprendre/.test(pd2.txt) && /^⏸️ Pause$/.test(pd3.txt), "direct : ⏸ fige, « ▶ Reprendre », puis « ⏸️ Pause » (avec U+FE0F) " + JSON.stringify([pd2.txt, pd3.txt]));
  ok(!pd4.vis && !pd4.en, "direct : ⏸ puis ⏭ arrivée : la course s'arrête et le bouton pause disparaît");
  ok(!pd2.amb && !pd3.amb && !pd4.amb, "direct (sans son) : l'ambiance n'est jamais retenue, ni en pause, ni à la reprise, ni après ⏭");
  // 10. course avec son (manche close) : ⏸ retient l'ambiance, ▶ la libère à la fin de la course ; ⏸ puis ⏭ la libère aussi
  const Q = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: up }), { vu: 202701 });
  await Q.p.evaluate(() => { GP_ETAPE = 1; rendreTrophees(); }); await Q.p.waitForTimeout(600);
  await Q.p.click("#gp-rejouer"); await Q.p.waitForTimeout(1200);
  await Q.p.click("#gp-pause"); await Q.p.waitForTimeout(150); const qa = await Q.p.evaluate(() => SONS.ambianceRetenue());
  await Q.p.click("#gp-pause"); await Q.p.waitForFunction(() => !GP_INST.api.enCours(), null, { timeout: 20000 }); await Q.p.waitForTimeout(3500);
  const qb = await Q.p.evaluate(() => SONS.ambianceRetenue());
  await Q.p.click("#gp-rejouer"); await Q.p.waitForTimeout(1200); await Q.p.click("#gp-pause"); await Q.p.waitForTimeout(150);
  await Q.p.evaluate(() => document.getElementById("gp-fin").click()); await Q.p.waitForTimeout(3500);
  const qc = await Q.p.evaluate(() => ({ amb: SONS.ambianceRetenue(), vis: !document.getElementById("gp-pause").hidden }));
  errs.push(...Q.err); await Q.ctx.close();
  ok(qa && !qb, "course avec son : ⏸ retient l'ambiance, ▶ puis arrivée : elle n'est plus retenue (" + qa + " → " + qb + ")");
  ok(!qc.amb && !qc.vis, "course avec son : ⏸ puis ⏭ : l'ambiance n'est plus retenue, le bouton pause a disparu");
  // 11. les 6 nouveaux circuits en 3D : Visite et Hélico, avec 0, 1 et 5 voitures → 0 erreur
  const V3 = await b.newContext({ viewport: { width: 390, height: 300 }, serviceWorkers: "block" }), pv = await V3.newPage(), e3d = [];
  pv.on("pageerror", e => e3d.push(e.message)); pv.on("console", m => { if (m.type() === "error" || (m.type() === "warning" && /Piste/.test(m.text()))) e3d.push(m.text()); });
  await pv.goto(URL.replace("index.html", "version.js"));
  await pv.setContent('<html><body style="margin:0;background:#000"><div id="b" style="width:390px;height:300px;position:relative"></div><script src="' + URL.replace("index.html", "") + 'piste.js"></script></body></html>');
  await pv.waitForFunction(() => window.Piste);
  const a3v = await pv.evaluate(() => Piste.supporte()), C6 = ["suzuka", "melbourne", "montreal", "bahrein", "spa", "lasvegas"], res3 = [];
  if (a3v) for (const ci of C6) for (const n of [0, 1, 5]) {
    const r = await pv.evaluate(([ci, n]) => { const bx = document.getElementById("b"); if (window.__a && window.__a.detruire) window.__a.detruire(); bx.innerHTML = "";
      const NV = ["A", "B", "C", "D", "E"].slice(0, n), CL = ["#E5484D", "#3E8BFF", "#F2B33D", "#3DDC97", "#B4E33D"], de = {}, a = {};
      NV.forEach((x, k) => { de[x] = -k * .04; a[x] = .5 - k * .04; });
      const api = window.__a = Piste.monter(bx, { circuit: ci, meteo: "soleil", camera: "helico", tour: 1, voitures: NV.map((x, k) => ({ nom: x, couleur: CL[k] })), pts: de });
      api.camera("helico"); if (api.voitures) api.voitures(false); return api.type; }, [ci, n]);
    await pv.waitForTimeout(500);
    await pv.evaluate(n => { const api = window.__a; api.camera("poursuite"); if (api.voitures) api.voitures(true); if (n) { api.focus("A"); const de = {}, a = {}; ["A", "B", "C", "D", "E"].slice(0, n).forEach((x, k) => { de[x] = -k * .04; a[x] = .5 - k * .04; }); api.jouer(de, a, 900, null, false); } }, n);
    await pv.waitForTimeout(1100); res3.push(ci + "/" + n + ":" + r);
  }
  if (a3v) await pv.screenshot({ path: DOSSIER + "/3d-lasvegas-5.png" });
  await V3.close();
  if (a3v) ok(!e3d.length && res3.every(x => /:3d$/.test(x)) && res3.length === 18, "6 nouveaux circuits en 3D (Visite + Hélico, 0/1/5 voitures) : 0 erreur " + JSON.stringify(e3d.slice(0, 3)) + " " + res3.filter(x => !/:3d$/.test(x)).join(" "));
  else console.log("(3D indisponible : boucle des 6 circuits sautée)");
  // 12. v20.52 · avant le 1er décembre : grille 2D alignée, 🎬 course de démonstration (2D, 3D, plein écran), puis plus de démo dès le 1er
  const tags = p => p.evaluate(() => { const l = [...document.querySelectorAll("#gp-piste [data-gpt3]")].map(e => { const r = e.getBoundingClientRect(); return { n: e.dataset.gpt3, x: r.left, y: r.top, w: r.width, h: r.height, rg: e.querySelector(".gp-rg").textContent, op: getComputedStyle(e).opacity }; });
    const cars = [...document.querySelectorAll("#gp-piste .p2-car")].map((e, k) => { const r = e.getBoundingClientRect(); return { n: D.personnes[k].nom, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); return { l, cars, grille: GP_GRILLE }; });
  const chevauche = l => { const pb = []; l.forEach((a, i) => l.slice(i + 1).forEach(b => { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ix > 1 && iy > 1) pb.push(a.n + "/" + b.n); })); return pb; };
  for (const sombre of [false, true]) {
    const Z = await ouvrir(b, "2026-11-25T12:00:00", donnees(202611), { vu: 0, sombre }); await Z.p.waitForTimeout(800);
    const g = await tags(Z.p), pb = chevauche(g.l), ordreRg = g.grille ? g.grille.map(n => (g.l.find(t => t.n === n) || {}).rg).join("") : "";
    const cg = g.grille ? g.grille.map(n => g.cars.find(c => c.n === n)) : [], ecartMin = Math.min(...cg.slice(1).map((c, k) => Math.hypot(c.x - cg[k].x, c.y - cg[k].y)));
    const bt = await Z.p.evaluate(() => ({ demo: !!document.getElementById("gp-demo"), rejouer: !!document.getElementById("gp-rejouer"), pause: !document.getElementById("gp-pause").hidden }));
    await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 150); }); await Z.p.waitForTimeout(300);
    await Z.p.screenshot({ path: DOSSIER + "/grille-2d-" + (sombre ? "sombre" : "clair") + ".png" });
    ok(g.l.length === 5 && g.l.every(t => t.op !== "0") && !pb.length, "grille 2D (" + (sombre ? "sombre" : "clair") + ") : les 5 pastilles visibles, aucune ne recouvre une autre " + JSON.stringify(pb));
    ok(ordreRg === "12345" && ecartMin >= 15, "grille 2D : rangs des pastilles = ordre de la grille (" + ordreRg + "), voitures écartées d'au moins 15 px (" + Math.round(ecartMin) + " px)");
    ok(bt.demo && !bt.rejouer && !bt.pause, "avant le 1er décembre : « 🎬 Course de démonstration » à la place de « ↻ Rejouer », pas de ⏸ à l'arrêt");
    // la démo en 2D
    const avantVu = await Z.p.evaluate(() => localStorage.getItem("versus.gpVu.2026")), n0 = Z.req.length;
    await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(3500);
    const d1 = await Z.p.evaluate(() => ({ en: !!(GP_DEMO && GP_DEMO.enCours), cours: GP_INST.api.enCours(), pause: !document.getElementById("gp-pause").hidden, titre: document.querySelector(".gp-h .s-k").textContent, st: document.querySelector("#gp-piste .gp-st").textContent, ordre: Object.entries(GP_INST.api.courant()).sort((a, b) => b[1] - a[1]).map(x => x[0]) }));
    const txt = await Z.p.evaluate(() => document.querySelector("#vue-trophees, main, body").innerText);
    await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 150); }); await Z.p.waitForTimeout(200);
    await Z.p.screenshot({ path: DOSSIER + "/demo-2d-" + (sombre ? "sombre" : "clair") + ".png" });
    await Z.p.waitForFunction(() => GP_DEMO && GP_DEMO.fini, null, { timeout: 20000 }); await Z.p.waitForTimeout(300);
    const d2 = await Z.p.evaluate(() => ({ pause: !document.getElementById("gp-pause").hidden, com: document.querySelector("#gp-piste .gp-com").textContent, ordre: Object.entries(GP_INST.api.courant()).sort((a, b) => b[1] - a[1]).map(x => x[0]), max: Math.max(...Object.values(GP_INST.api.courant())), grille: mancheGP(etapesGP(2026), 0, 202612).grille }));
    const ecr = Z.req.slice(n0).filter(a => a !== "?" && !/^(lire|donnees|etat|tresors|tickets|jeu)$/.test(a)), apresVu = await Z.p.evaluate(() => localStorage.getItem("versus.gpVu.2026"));
    ok(d1.en && d1.cours && d1.pause && /Démo · rien ne compte/.test(d1.titre) && /Démo/.test(d1.st), "🎬 démo (2D) : la course roule, ⏸ visible, « Démo · rien ne compte » dans le titre et les sous-titres");
    ok(!/\d+[,.]?\d*\s?%/.test(txt), "démo : aucun % affiché sur la page");
    ok(!ecr.length && avantVu === apresVu, "démo : aucune requête d'écriture au serveur " + JSON.stringify(Z.req.slice(n0)) + ", « manche vue » inchangée (" + avantVu + ")");
    ok(!d2.pause && d2.max >= 2 && /gagne la course de démo/.test(d2.com) && d2.ordre.join() !== d2.grille.join(), "démo : 2 tours, arrivée, dépassements (" + d2.grille.join(">") + " → " + d2.ordre.join(">") + "), ⏸ disparu à l'arrivée");
    errs.push(...Z.err); await Z.ctx.close();
  }
  // démo en 3D (hélico) puis en plein écran ; ⏭ arrête la démo
  { const Z = await ouvrir(b, "2026-11-25T12:00:00", donnees(202611), { vu: 0, d3: true });
    if (await Z.p.evaluate(() => piste3D())) {
      await Z.p.evaluate(() => choisirVueGP("poursuite", 2026)); await Z.p.waitForTimeout(900);
      await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(6500);
      const d3 = await Z.p.evaluate(() => ({ type: GP_INST.api.type, en: GP_DEMO.enCours, pause: !document.getElementById("gp-pause").hidden }));
      await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 150); }); await Z.p.waitForTimeout(200);
      await Z.p.screenshot({ path: DOSSIER + "/demo-3d-clair.png" });
      await Z.p.evaluate(() => document.getElementById("gp-fin").click()); await Z.p.waitForTimeout(400);
      const d4 = await Z.p.evaluate(() => ({ fini: GP_DEMO.fini, cours: GP_INST.api.enCours(), pause: !document.getElementById("gp-pause").hidden }));
      ok(d3.type === "3d" && d3.en && d3.pause, "🎬 démo en 3D : la course roule, ⏸ visible");
      ok(d4.fini && !d4.cours && !d4.pause, "⏭ pendant la démo : arrivée tout de suite, ⏸ disparaît");
      await Z.p.click("#gp-plein-gros"); await Z.p.waitForTimeout(900);
      const pl = await Z.p.evaluate(() => document.querySelector(".gpp-play").textContent); await Z.p.click(".gpp-play"); await Z.p.waitForTimeout(2500);
      const d5 = await Z.p.evaluate(() => ({ en: GP_DEMO && GP_DEMO.enCours, pause: !document.querySelector(".gpp-pause").hidden, titre: document.querySelector(".gpp-t").textContent }));
      await Z.p.screenshot({ path: DOSSIER + "/demo-3d-plein.png" });
      ok(pl === "▶ Course de démo" && d5.en && d5.pause && /Démo/.test(d5.titre), "plein écran : « ▶ Course de démo » relance une démo, ⏸ visible, « Démo » dans le titre (v20.62) " + JSON.stringify({ pl, d5 }));
    } else console.log("(3D indisponible : démo 3D sautée)");
    errs.push(...Z.err); await Z.ctx.close(); }
  { const Z = await ouvrir(b, "2026-11-25T12:00:00", donnees(202611), { vu: 0, d3: true, sombre: true });
    if (await Z.p.evaluate(() => piste3D())) { await Z.p.evaluate(() => choisirVueGP("poursuite", 2026)); await Z.p.waitForTimeout(900); await Z.p.click("#gp-demo"); await Z.p.waitForTimeout(6500);
      await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 150); }); await Z.p.waitForTimeout(200); await Z.p.screenshot({ path: DOSSIER + "/demo-3d-sombre.png" }); }
    errs.push(...Z.err); await Z.ctx.close(); }
  for (const [q, att] of [["2026-11-30T23:30:00", true], ["2026-12-01T08:00:00", false], ["2026-12-10T12:00:00", false]]) {
    const Z = await ouvrir(b, q, donnees(202611, { kSP: 202612, sp: up }), { vu: 0 }); await Z.p.waitForTimeout(600);
    const r = await Z.p.evaluate(() => ({ demo: !!document.getElementById("gp-demo"), rj: !!document.getElementById("gp-rejouer") }));
    ok(r.demo === att && r.rj === !att, q.slice(0, 16) + " : bouton démo " + (att ? "présent" : "absent, ↻ Revoir à la place") + " " + JSON.stringify(r)); errs.push(...Z.err); await Z.ctx.close(); }
  // 13. 26/11/2026 (Théo) · plus de météo du marché : S&P en hausse, en baisse ou en chute (février, le Château ; Noël), en 2D et en 3D : rien ne change
  const PICTOS = /☀️|🌧️|⛈️|🌨️|❄️|🌪️|⛅|🌤️|Grand soleil|Pluie|Orage|Tempête|Nuageux|Beau temps/;
  const SANS = [["hausse", "2027-02-10T12:00:00", 202701, 202702, .002], ["baisse", "2027-02-10T12:00:00", 202701, 202702, -.001], ["chute", "2027-02-10T12:00:00", 202701, 202702, -.004], ["chute-noel", "2026-12-10T12:00:00", 202611, 202612, -.004]];
  const PART = {};
  for (const [nom, q, j, kS, pente] of SANS) for (const [d3, sombre] of [[false, false], [true, true]]) {
    const Z = await ouvrir(b, q, donnees(j, { kSP: kS, sp: d => pente * d }), { vu: j === 202611 ? 0 : j, d3, sombre }); await Z.p.waitForTimeout(400);
    if (d3 && !(await Z.p.evaluate(() => piste3D()))) { await Z.ctx.close(); continue; }
    if (d3) { await Z.p.evaluate(y => choisirVueGP("poursuite", y), +q.slice(0, 4)); await Z.p.waitForTimeout(400); await Z.p.evaluate(() => document.getElementById("gp-rejouer").click()); await Z.p.waitForTimeout(2600); }
    else await Z.p.waitForTimeout(1800);
    const m = await Z.p.evaluate(() => ({ type: GP_INST.api.type, part: GP_INST.api.particules ? GP_INST.api.particules() : null, couche: !!document.querySelector("#gp-piste canvas.p2-meteo"),
      titre: document.querySelector(".gp-h").textContent, st: (document.querySelector("#gp-piste .gp-st") || { textContent: "" }).textContent, fn: typeof meteoMois }));
    await Z.p.evaluate(() => { const e = document.getElementById("gp-piste"); scrollBy(0, e.getBoundingClientRect().top - 150); }); await Z.p.waitForTimeout(120);
    await Z.p.screenshot({ path: DOSSIER + "/sans-meteo-" + nom + "-" + (d3 ? "3d" : "2d") + "-" + (sombre ? "sombre" : "clair") + ".png" });
    if (d3) { const k = q.slice(0, 7); if (PART[k] === undefined) PART[k] = m.part; m.memePart = PART[k] === m.part; }
    ok(m.type === (d3 ? "3d" : "2d") && !m.couche && !PICTOS.test(m.titre + m.st) && m.fn === "undefined" && (!d3 || m.memePart) && Z.err.length === 0,
      "S&P en " + nom + " (" + m.type + ") : aucune météo (ni pictogramme, ni couche de pluie" + (d3 ? ", " + m.part + " particules du décor, comme par beau temps" : "") + "), 0 erreur");
    errs.push(...Z.err); await Z.ctx.close(); }
  // « réduire les animations » : aucune particule ni couche animée, la course se place directement
  { const Z = await ouvrir(b, "2027-02-10T12:00:00", donnees(202701, { kSP: 202702, sp: d => -.004 * d }), { vu: 202701, d3: true }); await Z.p.emulateMedia({ reducedMotion: "reduce" });
    await Z.p.evaluate(() => { if (GP_INST) { GP_INST.api.detruire(); GP_INST.boite.remove(); GP_INST = null; } rendreTrophees(); }); await Z.p.waitForTimeout(800);
    const r = await Z.p.evaluate(() => ({ cv: !!document.querySelector("#gp-piste canvas.p2-meteo"), part: GP_INST.api.particules ? GP_INST.api.particules() : 0 })); errs.push(...Z.err); await Z.ctx.close();
    ok(!r.cv && !r.part, "réduire les animations : aucune particule, aucune couche animée " + JSON.stringify(r)); }
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 5)));
  await b.close(); console.log("Captures : " + DOSSIER); process.exit(ko.length ? 1 : 0);
})();
