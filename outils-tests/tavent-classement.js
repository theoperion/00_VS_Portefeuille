/* Test (Avent 26/11) · 🏆 Calendrier de l'Avent : classement en direct de chaque jeu, course au roi de Noël, roi des jeux de Noël et ses objets.
   Fausses données uniquement (serveur Google intercepté, faux Avent.js qui classe comme le vrai).
   Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tavent-classement.js   (PORT=… pour un autre port, CAPTURES=… pour les captures)
   Vérifie : classement en direct visible par tous dès décembre (ton rang en avant, seulement des noms et des scores de jeu) ; rejouer le jeu d'un jour passé
   améliore le classement (tout de suite, puis confirmé par le serveur) ; « deja » = renvoyé la minute d'après ; la course au roi en haut du Classement
   (⭐ puis 🥈, ton rang, « N/16 jeux », détail jeu par jeu) ; figé le 25 (plus d'envoi, résultat final) ; le roi seul voit et porte ses objets
   (plaque, couronne de houx, livrée), rien avant le 25 ; vitrine 2027 : 🎅 et ⭐ ; 0 erreur JS ; 390 px clair et sombre, sans débordement. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "avent-classement");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = (session, ecurie) => ({ ok: true, version: 87, genere: "2026-12-05T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202610, 990, 0.01), ligne(202611, 1000, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ecurie || {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const CLEMENT = { role: "perso", nom: "Clément" }, KEVIN = { role: "perso", nom: "Kévin" };
const BAS = { memory: true, bonshommes: true, feux: true };
/** faux Avent.js : garde les meilleurs scores (avec l'ordre d'arrivée), classe comme le serveur, attribue le 25 */
function fauxAvent(o, c, nom) {
  const S = o.srv; S.envois.push(c); const fige = o.quand >= "2026-12-25";
  if (c.action === "aventCase") { const bon = c.jour === +o.quand.slice(8, 10) && o.quand < "2026-12-25";   // la case du jour seulement, comme le vrai serveur
    if (bon && !(o.ouvertes = o.ouvertes || []).includes(c.jour)) o.ouvertes.push(c.jour); return Object.assign(bon ? { accepte: true } : { accepte: false, raison: "manquee" }, etat()); }
  if (c.op === "score") {
    if (fige) return { ok: false, erreur: "fini", message: "figé" };
    if (S.manquee === c.jeu) return { ok: false, erreur: "manquee", message: "Cette case n'a pas été ouverte le jour même." };
    if (S.dejaUneFois) { S.dejaUneFois = false; return { ok: false, erreur: "deja", message: "dans une minute" }; }
    const m = S.best[c.jeu] = S.best[c.jeu] || {}, mieux = (a, b) => BAS[c.jeu] ? a < b : a > b;
    if (!(nom in m) || mieux(c.score, m[nom].s)) m[nom] = { s: c.score, i: S.n++ };
  }
  return etat();
  function etat() {
    const C = {}, t = {};
    Object.keys(S.best).forEach(jeu => { const m = S.best[jeu], mieux = (a, b) => BAS[jeu] ? a < b : a > b;
      C[jeu] = Object.keys(m).sort((a, b) => mieux(m[a].s, m[b].s) ? -1 : mieux(m[b].s, m[a].s) ? 1 : m[a].i - m[b].i).map(n => ({ nom: n, score: m[n].s }));
      C[jeu].forEach((x, k) => { const z = t[x.nom] = t[x.nom] || { nom: x.nom, or: 0, argent: 0, bronze: 0, jeux: 0 }; z.jeux++; if (k === 0) z.or++; else if (k === 1) z.argent++; else if (k === 2) z.bronze++; }); });
    const roi = Object.values(t).sort((a, b) => b.or - a.or || b.argent - a.argent);
    const mes = {}; Object.keys(S.best).forEach(jeu => { if (S.best[jeu][nom]) mes[jeu] = S.best[jeu][nom].s; });
    const r = { ok: true, ouvert: true, aujourdhui: +o.quand.slice(0, 10).replace(/-/g, ""), maintenant: Date.parse(o.quand), fige, cases: o.ouvertes || [], mes, classements: C, roi };
    if (o.quand >= "2026-12-24") r.records = Object.keys(C).map(jeu => ({ jeu, nom: C[jeu][0].nom, score: C[jeu][0].score, ex: [] }));
    if (fige) { const et = {}; roi.forEach(x => { if (x.or) et[x.nom] = x.or; }); r.gagnants = { roi: roi[0] && roi[0].or ? roi[0].nom : null, etoiles: et }; r.dores = []; r.doresFinal = true; }
    return r;
  }
}
/** le départ : Kévin mène les cadeaux (42) et le memory, Clément 2e aux cadeaux (30), Théo 3e, Devlin mène la pile */
function departSrv() {
  return { envois: [], n: 10, best: { cadeaux: { Kévin: { s: 42, i: 1 }, Clément: { s: 30, i: 2 }, Théo: { s: 12, i: 3 } }, memory: { Kévin: { s: 18.2, i: 4 }, Clément: { s: 25, i: 5 } }, pile: { Devlin: { s: 20, i: 6 } } } };
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  o.srv = o.srv || departSrv();
  const nom = o.session.nom || "Théo";
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "avent" || c.action === "aventCase") return r.fulfill({ contentType: "application/json", body: JSON.stringify(fauxAvent(o, c, nom)) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session, o.ecurie)) }); });
  await p.addInitScript(f => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.ecurieTeaser", "1");
    if (f.ouvertes) localStorage.setItem("versus.avent", JSON.stringify(f.ouvertes)); if (f.stock) Object.keys(f.stock).forEach(k => localStorage.setItem(k, f.stock[k])); }, { ouvertes: o.ouvertes, stock: o.stock });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));
  await p.evaluate(() => { try { allerA("trophees"); } catch (e) { } }); await p.waitForTimeout(300);   // Avent 26/11 : le calendrier vit dans l'onglet Podium
  return { ctx, p, err, o };
}
const deborde = () => [...document.querySelectorAll(".av-ov *, .av-case *, .av-entree, .av-roicarte, .av-roicarte *")].filter(e => !e.closest(".av-neige")).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className).slice(0, 5);
const attendre = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  // 1 · le 5/12, Clément : classement en direct de la case 2 (jeu d'un jour passé, ouverte le 2), puis il rejoue et passe devant
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", o = { quand: "2026-12-05T09:00:00", session: CLEMENT, sombre, ouvertes: [1, 2, 5] };
    const { ctx, p, err } = await page(b, o);
    await p.waitForTimeout(2600);   // la 1re lecture du serveur part 2,5 s après l'affichage
    if (!sombre) { const rc = await p.evaluate(async () => { allerA("classement"); await new Promise(z => setTimeout(z, 300)); const r = document.querySelector("#v-classement > .av-rappel"), e = document.querySelector("#v-classement > .av-entree, #v-classement > .av-roicarte");
        const t = r ? r.innerText : "", h = r ? r.getBoundingClientRect().height : 0; if (r) r.click(); await new Promise(z => setTimeout(z, 400)); return { t, h, e: !!e, vue: typeof vueActive === "function" ? vueActive() : "" }; });
      ok(rc.t && /dans Podium/.test(rc.t) && rc.h < 44 && !rc.e && rc.vue === "trophees", "Classement : une seule petite ligne de rappel (ni entrée ni carte), qui mène au Podium " + JSON.stringify(rc)); }
    const cr = await p.evaluate(() => { const c = document.querySelector("#v-trophees > .av-roicarte"), e = document.querySelector("#v-trophees > .av-entree");
      return c ? { t: c.innerText, apres: !!e && e.nextElementSibling === c, moi: (c.querySelector("li.moi") || {}).innerText || "", lignes: c.querySelectorAll(".avr-l li").length } : null; });
    ok(cr && cr.apres && cr.lignes === 5 && /Course au roi de Noël/i.test(cr.t) && /🥇\s*Kévin\s*⭐ 2/.test(cr.t) && /Clément \(toi\)\s*⭐ 0 · 2es : 2/.test(cr.t) && /Le roi : le plus de ⭐ \(1res places\), à égalité le plus de 2es places · seuls les jeux des cases ouvertes le jour même comptent/.test(cr.t) && /un cadeau le 24/.test(cr.t) && /livrée « Roi de Noël »/.test(cr.t) && /Ton rang : 3e sur 5 · 2 jeux sur 16 joués/.test(cr.t) && /16 jeux/.test(cr.t) && /couronne de houx/.test(cr.t) && /plaque dorée si 24\/24/.test(cr.t) && /Clément/.test(cr.moi),
      "Classement · la carte « Course au roi de Noël » sous l'entrée du calendrier : 5 pilotes (⭐ puis 🥈), ton rang, N/16 jeux, ce que gagne le roi et ce que gagne tout le monde " + JSON.stringify(cr) + tag);
    ok(!/€|%|2027|Hiver 2026|Flocons|skin|🥈 \d/.test(cr ? cr.t : ""), "la carte : aucun montant, aucun %, rien de 2027, le cadeau du 24 reste secret, pas de « skin », « 2es : » (pas de médaille 🥈 pour compter)" + tag);
    await p.screenshot({ path: DOSSIER + "/podium-course-roi" + (sombre ? "-sombre" : "") + ".png" });
    await p.click(".av-roicarte"); await p.waitForTimeout(400);
    const dt = await p.evaluate(() => { const d = document.querySelector(".av-roid"); return d ? { n: d.querySelectorAll(".avd-l li").length, t: d.innerText } : null; });
    ok(dt && dt.n === 4 && /Les cadeaux du traîneau[\s\S]*Kévin · 42 cadeaux/.test(dt.t) && /toi : 2e/.test(dt.t) && /case du 3 · ❄️ case manquée/.test(dt.t) && /13 jeux encore cachés/.test(dt.t) && !/biscuits|luge|Départ du traîneau/i.test(dt.t), "un toucher : qui mène chaque jeu, seulement ceux des cases passées (3 + « 13 jeux encore cachés »), ❄️ sur un jeu manqué, et ta place " + JSON.stringify(dt && dt.t.slice(0, 200)) + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : la carte et le détail ne débordent pas" + tag);
    await p.screenshot({ path: DOSSIER + "/detail-roi" + (sombre ? "-sombre" : "") + ".png" });
    await p.evaluate(() => document.querySelector(".av-roid [data-av-fermer]").click());
    // la case 2 (cadeaux), ouverte le 2, rejouée le 5
    await p.evaluate(() => { ouvrirAvent(); ouvrirCaseAvent(2); }); await p.waitForTimeout(700);
    const c1 = await p.evaluate(() => { const z = document.querySelector(".av-case .av-clas"), k = document.querySelector(".av-case .av-carte"); const jeu = document.querySelector(".av-case .av-jeu"), ser = document.querySelector(".av-case .av-serie");
      return z ? { t: z.innerText, moi: (z.querySelector("li.moi") || {}).innerText || "", sous: !!(jeu.compareDocumentPosition(z) & 4) && !!(z.compareDocumentPosition(ser) & 4), points: k.querySelectorAll(".av-serie i").length } : null; });
    ok(c1 && /Classement en direct/i.test(c1.t) && /Ton rang : 2e sur 3/.test(c1.t) && /🥇\s*Kévin/.test(c1.t) && /Clément \(toi\)/.test(c1.moi) && c1.sous && c1.points === 24,
      "case 2 : le classement en direct sous le jeu (et au-dessus des 24 points), 🥇 Kévin, « Ton rang : 2e sur 3 », ma ligne en avant " + JSON.stringify(c1) + tag);
    ok(!/€|%/.test(c1 ? c1.t : ""), "le classement : des noms et des scores de jeu, rien d'autre" + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : la case et son classement ne débordent pas" + tag);
    await p.evaluate(() => document.querySelector(".av-case .av-clas").scrollIntoView({ block: "center" })); await p.waitForTimeout(150);
    await p.screenshot({ path: DOSSIER + "/case-classement" + (sombre ? "-sombre" : "") + ".png" });
    if (!sombre) {
      const n0 = o.srv.envois.filter(c => c.op === "score").length;
      const r = await p.evaluate(async () => { document.querySelector(".av-case [data-avj='go']").click(); await new Promise(z => setTimeout(z, 100));
        const G = document.querySelector(".av-case").jeu.etat(); G.score = 50; G.finir(); const tout = document.querySelector(".av-case .av-clas").innerText;   // juste après la partie
        await new Promise(z => setTimeout(z, 900)); return { tout, apres: document.querySelector(".av-case .av-clas").innerText, voile: document.querySelector(".avj-voile").innerText, carte: document.querySelector("#v-trophees > .av-roicarte").textContent }; });
      const env = o.srv.envois.filter(c => c.op === "score").slice(n0);
      ok(/Ton rang : 1er sur 3/.test(r.tout) && /🥇\s*Clément/.test(r.tout), "rejouer le jeu d'un jour passé : 50 cadeaux → 1er tout de suite, avant même la réponse du serveur " + JSON.stringify(r.tout.slice(0, 160)));
      ok(env.length === 1 && env[0].jeu === "cadeaux" && env[0].score === 50 && Object.keys(env[0]).sort().join() === "action,cle,jeu,op,score" && /1er sur 3/.test(r.apres) && !/⏳/.test(r.apres) && /compte au classement/.test(r.voile),
        "le record part au serveur (jeu + score seulement), le serveur confirme : 1er, plus de ⏳ " + JSON.stringify(env));
      ok(/Clément[\s\S]*⭐ 1/.test(r.carte), "la course au roi se met à jour (Clément : ⭐ 1) " + JSON.stringify(r.carte.slice(0, 200)));
      // le serveur répond « deja » (un record écrit il y a moins d'une minute) : renvoyé la minute d'après, pas le lendemain
      o.srv.dejaUneFois = true;
      const dj = await p.evaluate(async () => { const R = recordsAvent(); R.cadeaux = 60; stock.set("versus.aventRecords", JSON.stringify(R)); mettreEnFileAvent("cadeaux", 60); await new Promise(z => setTimeout(z, 700)); return fileAvent().cadeaux || null; });
      const n1 = o.srv.envois.filter(c => c.op === "score").length;
      await p.evaluate(() => envoyerFileAvent()); await p.waitForTimeout(400);
      const n2 = o.srv.envois.filter(c => c.op === "score").length;
      await p.clock.setFixedTime(new Date(Date.parse(o.quand) + 62000)); await p.evaluate(() => envoyerFileAvent()); await p.waitForTimeout(700);
      const fin = await p.evaluate(() => fileAvent().cadeaux || null), n3 = o.srv.envois.filter(c => c.op === "score").length;
      // un record d'une case que le serveur n'a pas comptée (ouverte hors ligne, refusée au retour du réseau) : il disparaît aussi de l'appareil
      o.srv.manquee = "renne";
      const mq = await p.evaluate(async () => { const R = recordsAvent(); R.renne = 9; stock.set("versus.aventRecords", JSON.stringify(R)); stock.set("versus.avent", JSON.stringify(aventOuvertes().concat([3]))); const c3 = caseOuvrable(3); const avant = classementJeuAvent("renne").map(x => x.nom).join();
        mettreEnFileAvent("renne", 9); await new Promise(z => setTimeout(z, 800)); return { c3, avant, rec: recordsAvent().renne, file: fileAvent().renne || null, apres: classementJeuAvent("renne").map(x => x.nom).join(), c3apres: caseOuvrable(3) }; });
      ok(mq.c3 && !mq.c3apres && mq.avant === "Clément" && mq.rec === undefined && !mq.file && mq.apres === "", "record refusé « manquee » par le serveur : oublié sur l'appareil, plus 1er chez soi seulement, et sa case (notée ouverte sur l'appareil seulement) se referme aussitôt " + JSON.stringify(mq));
      ok(dj && dj.s === 60 && dj.apres > 0 && n2 === n1 && n3 === n2 + 1 && !fin, "« deja » : le record attend une minute (pas d'envoi en rafale), puis part tout seul " + JSON.stringify({ dj, n1, n2, n3, fin }));
    }
    ok(!err.length, "1 · 0 erreur JS " + JSON.stringify(err) + tag); await ctx.close();
  }
  // 2 · le 24/12 : la case 24 montre le roi « pour l'instant » ; rien n'est attribué avant le 25
  { const o = { quand: "2026-12-24T20:00:00", session: KEVIN, ouvertes: [1, 2, 7, 24] }, { ctx, p, err } = await page(b, o);
    await p.evaluate(() => { ouvrirAvent(); ouvrirCaseAvent(24); }); await p.waitForTimeout(1400);
    const r = await p.evaluate(() => ({ t: (document.querySelector(".av-case .av-records") || {}).innerText || "", d: ["plaque.roinoel26", "finition.houx", "livree.roinoel"].some(k => debloques("Kévin").has(k)), ids: idsSlot("plaque").includes("roinoel26") }));
    ok(/roi des jeux de Noël, pour l'instant : Kévin/.test(r.t) && /se fige ce soir à 23\sh\s59/.test(r.t) && /⭐ 2/.test(r.t) && !/🥇×|skin/.test(r.t) && /le plus de 1res places/.test(r.t) && !r.d && !r.ids, "24/12 au soir : case 24, Kévin roi « pour l'instant », tout se fige à 23 h 59 ; aucun objet du roi attribué avant le 25 " + JSON.stringify(r));
    await p.screenshot({ path: DOSSIER + "/case-24-provisoire.png" });
    ok(!err.length, "2 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 3 · le 25/12 : figé. Kévin (roi) a ses objets, Clément non ; plus aucun envoi ; résultat final partout
  for (const [qui, sombre] of [[KEVIN, false], [CLEMENT, true]]) {
    const o = { quand: "2026-12-25T10:00:00", session: qui, sombre, ouvertes: [1, 2, 7, 24] }, { ctx, p, err } = await page(b, o), roi = qui.nom === "Kévin", tag = " (" + qui.nom + (sombre ? ", sombre)" : ", clair)");
    await p.waitForTimeout(2200);
    const r = await p.evaluate(() => { const c = document.querySelector("#v-trophees > .av-roicarte"); return { carte: c ? c.innerText : "", fige: aventFige(), roi: aventRoiNoel(), et: aventEtoiles("Kévin"),
      d: ["plaque.roinoel26", "finition.houx", "livree.roinoel"].map(k => debloques("Kévin").has(k)), autre: ["plaque.roinoel26", "finition.houx", "livree.roinoel"].some(k => debloques("Clément").has(k)),
      ids: ["plaque", "finition", "livree"].map(s => idsSlot(s).filter(id => estGainRoi(s, id))).flat(), q: texteOrigineItem(moiVrai(), "plaque", "roinoel26").p }; });
    ok(r.fige && r.roi === "Kévin" && r.et === 2 && r.d.every(Boolean) && !r.autre && /Roi des jeux de Noël 2026 : K[ée]vin/i.test(r.carte) && /résultat final/.test(r.carte), "25/12 · figé : Kévin roi des jeux de Noël (⭐ ×2), ses 3 objets à lui seul ; la carte affiche le résultat final " + JSON.stringify(Object.assign({}, r, { carte: r.carte.slice(0, 120) })) + tag);
    ok(roi ? r.ids.sort().join() === "houx,roinoel,roinoel26" && /À toi pour toujours/.test(r.q) : !r.ids.length && /Réservé à Kévin/.test(r.q), (roi ? "écurie de Kévin : plaque, couronne de houx et livrée visibles, « ? » = « À toi pour toujours… »" : "écurie de Clément : aucun objet du roi visible ; « ? » = « Réservé à Kévin »") + " " + JSON.stringify(r.ids) + tag);
    const n0 = o.srv.envois.filter(c => c.op === "score").length;
    const j = await p.evaluate(async () => { ouvrirAvent(); ouvrirCaseAvent(2); await new Promise(z => setTimeout(z, 300)); document.querySelector(".av-case [data-avj='go']").click(); await new Promise(z => setTimeout(z, 100));
      const G = document.querySelector(".av-case").jeu.etat(); G.score = 99; G.finir(); await new Promise(z => setTimeout(z, 700));
      return { voile: document.querySelector(".avj-voile").innerText, clas: document.querySelector(".av-case .av-clas").innerText, rec: recordsAvent().cadeaux, file: fileAvent().cadeaux || null, entete: document.querySelector(".av-h").innerText }; });
    ok(/figé le 24 décembre à 23\sh\s59/.test(j.voile) && /figé le 24 décembre à 23\sh\s59/.test(j.clas) && !/minuit|skin/.test(j.voile + j.clas + j.entete) && /Classement final/i.test(j.clas) && j.rec !== 99 && !j.file && o.srv.envois.filter(c => c.op === "score").length === n0 && /Roi des jeux de Noël 2026 :\s*K[ée]vin/i.test(j.entete), "25/12 · rejouer reste possible pour le plaisir, mais rien ne part et rien ne change : « Classement final », le calendrier annonce le roi " + JSON.stringify(Object.assign({}, j, { clas: j.clas.slice(0, 80) })) + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : rien ne déborde le 25" + tag);
    await p.screenshot({ path: DOSSIER + "/case-figee-" + qui.nom.normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase() + (sombre ? "-sombre" : "") + ".png" });
    ok(!err.length, "3 · 0 erreur JS " + JSON.stringify(err) + tag); await ctx.close(); }
  // 4 · janvier 2027 : Kévin porte la couronne de houx partout (classement, course), sa livrée ; sa vitrine : 🎅 et ⭐ ×2
  { const o = { quand: "2027-01-05T10:00:00", session: KEVIN, ecurie: { Kévin: { equip: { finition: "houx", livree: "roinoel", plaque: "roinoel26" } } }, stock: { "versus.aventRoi": JSON.stringify({ roi: "Kévin", etoiles: { Kévin: 2, Clément: 1 } }), "versus.aventDores": JSON.stringify({ l: [], fin: true }) } };
    const { ctx, p, err } = await page(b, o);
    const r = await p.evaluate(() => { const e = equipDe("Kévin"), tete = avatar("Kévin"), course = avatarCourse("Kévin"), cl = avatarCourse("Clément"), v = vitrineFiche("Kévin"), vc = vitrineFiche("Clément");
      return { e: [e.finition, e.livree, e.plaque], tete: tete.includes("#F2C94C"), course: course.includes("#F2C94C") && course.includes("#E0213A"), cl: cl.includes("#F2C94C") && cl.includes("#E0213A"), v: /Roi de Noël 2026 · Légende du tour de chauffe/.test(v) && /×2/.test(v), vc: /×1/.test(vc) && !/Roi de Noël 2026/.test(vc), pl: plaqueDe("Kévin").includes("pl-roinoel26"), voiture: svgVoiture({ nom: "Kévin", e }).includes("F7CF55") }; });
    ok(r.e.join() === "houx,roinoel,roinoel26" && r.tete && r.course && !r.cl && r.pl && r.voiture, "2027 · Kévin porte la couronne de houx sur sa tête (classement et course), la livrée Roi de Noël (ruban d'or) et la plaque ; pas Clément " + JSON.stringify(r));
    ok(r.v && r.vc, "vitrines : Kévin « 🎅 Roi de Noël 2026 · Légende du tour de chauffe » et ⭐ ×2 ; Clément ⭐ ×1 seulement " + JSON.stringify([r.v, r.vc]));
    await p.evaluate(() => { try { ETAT.podium = "ecurie"; ECU_SLOT = "finition"; garder(); allerA("trophees"); rendreTrophees(); } catch (e) { } }); await p.waitForTimeout(1500);
    await p.screenshot({ path: DOSSIER + "/ecurie-roi-2027.png" });
    await p.evaluate(() => window.scrollBy(0, 560)); await p.waitForTimeout(400); await p.screenshot({ path: DOSSIER + "/ecurie-roi-2027-objets.png" });
    await p.emulateMedia({ colorScheme: "dark" }); await p.evaluate(() => { window.scrollTo(0, 0); const v = document.querySelector("[data-ecu-vue]"); if (v) v.click(); }); await p.waitForTimeout(900);
    await p.screenshot({ path: DOSSIER + "/ecurie-roi-2027-2d-sombre.png" });
    ok(!err.length, "4 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 5 · Avent 26/11 (robot joueur) : pas de « NaN », arrondi identique au serveur, accords, pas de jeu fantôme
  { const o = { quand: "2026-12-23T10:00:00", session: CLEMENT, ouvertes: Array.from({ length: 22 }, (_, i) => i + 1) };
    o.srv = departSrv(); o.srv.best.feux = { Clément: { s: 181, i: 7 } }; o.srv.best.memory.Clément = { s: 4.5, i: 8 };
    const { ctx, p, err } = await page(b, o); await p.waitForTimeout(2600);
    const jouer = async (n, score) => p.evaluate(async ([n, score]) => { document.querySelectorAll(".av-case").forEach(x => { if (x.jeu) x.jeu.stop(); x.remove(); }); ouvrirCaseAvent(n); await new Promise(z => setTimeout(z, 300));
      document.querySelector(".av-case [data-avj='go']").click(); await new Promise(z => setTimeout(z, 100)); const G = document.querySelector(".av-case").jeu.etat(); G.score = score; G.finir(); await new Promise(z => setTimeout(z, 700));
      return document.querySelector(".avj-voile").innerText.replace(/\n+/g, " "); }, [n, score]);
    const v1 = await p.evaluate(() => { const R = recordsAvent(); delete R.renne; stock.set("versus.aventRecords", JSON.stringify(R)); return true; }) && await jouer(3, 500);
    ok(!/NaN/.test(v1) && !/Ton record/.test(v1) && /hors des limites/.test(v1), "1er essai hors limites, sans record : ni « NaN » ni « Ton record » " + JSON.stringify(v1));
    const n0 = o.srv.envois.filter(c => c.op === "score").length;
    const v2 = await jouer(23, 180.8), v3 = await jouer(7, 4.46), n1 = o.srv.envois.filter(c => c.op === "score").length;
    const ar = await p.evaluate(() => [avArrondi("feux", 180.8), avArrondi("memory", 4.46), avArrondi("bonshommes", 5.27), avArrondi("cadeaux", 7.6), recordsAvent().feux, recordsAvent().memory]);
    ok(!/Nouveau record/.test(v2) && !/Nouveau record/.test(v3) && n1 === n0 && ar.join() === "181,4.5,5.3,8,181,4.5", "score arrondi comme le serveur avant de comparer : 180,8 → 181 et 4,46 → 4,5 ne sont pas de nouveaux records, rien n'est envoyé, le record local = celui du serveur " + JSON.stringify({ v2, v3, ar }));
    const v4 = await jouer(23, 170.4), env = o.srv.envois.filter(c => c.op === "score").slice(n1);
    ok(/Nouveau record/.test(v4) && env.length === 1 && env[0].score === 170 && (await p.evaluate(() => recordsAvent().feux)) === 170, "un vrai nouveau record part arrondi (170,4 → 170), identique sur l'appareil et au serveur " + JSON.stringify(env));
    const fm = await p.evaluate(() => [avFmt({ unite: "flèches" }, 1), avFmt({ unite: "flèches" }, 3), avFmt({ unite: "cadeaux" }, 1), avFmt({ unite: "trouvés" }, 0)]);
    ok(fm.join("|") === "1 flèche|3 flèches|1 cadeau|0 trouvé", "accord au singulier, lettres accentuées comprises (« 1 flèche ») " + JSON.stringify(fm));
    const fa = await p.evaluate(async () => { document.querySelectorAll(".av-case,.av-ov").forEach(x => { if (x.jeu) x.jeu.stop(); x.remove(); }); ouvrirAvent(); await new Promise(z => setTimeout(z, 300));
      document.querySelector('.av-c[data-av="23"]').click(); document.querySelector('.av-c[data-av="2"]').click(); await new Promise(z => setTimeout(z, 1500));
      const l = [...document.querySelectorAll(".av-case")].map(x => x.dataset.n);
      ouvrirCaseAvent(10); const G = document.querySelector(".av-case").jeu.etat(); ouvrirCaseAvent(14); const h0 = G.horloge; await new Promise(z => setTimeout(z, 500));
      return { l, arret: G.horloge === h0, n: document.querySelectorAll(".av-case").length }; });
    ok(fa.l.join() === "23" && fa.arret && fa.n === 1, "deux paquets touchés coup sur coup : une seule case s'ouvre ; une case remplacée arrête sa partie (pas de jeu fantôme) " + JSON.stringify(fa));
    ok(!err.length, "5 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 6 · Avent 26/11 (Théo) · ouverture automatique une fois par jour, sur le paquet du jour ; pastille 🎁 sur Classement et Podium tant que la case du jour attend
  { const T = { "versus.aventAutoTest": "1" };   // les robots de test ne l'ont que s'ils le demandent
    const etat = p => p.evaluate(() => ({ ov: !!document.querySelector(".av-ov"), jour: (document.querySelector(".av-ov .av-c.jour.av-auto") || {}).dataset ? +document.querySelector(".av-ov .av-c.jour.av-auto").dataset.av : 0,
      pas: [...document.querySelectorAll(".tabbar .onglet .pastille-av")].map(x => x.closest(".onglet").dataset.vue).join() }));
    const o = { quand: "2026-12-01T08:00:00", session: CLEMENT, stock: T }, { ctx, p, err } = await page(b, o); await p.waitForTimeout(600);
    const e1 = await etat(p);
    ok(e1.ov && e1.jour === 1 && e1.pas === "trophees", "1/12 · 1er lancement : le calendrier s'ouvre tout seul sur le paquet du jour ; 🎁 sur l'onglet Podium " + JSON.stringify(e1));
    await p.screenshot({ path: DOSSIER + "/auto-1dec.png" });
    const rt = await p.evaluate(async () => { const cache = document.body.classList.contains("av-page-cachee") && getComputedStyle(document.querySelector("main")).visibility === "hidden"; const a = fermerFenetreOuverte(); await new Promise(z => setTimeout(z, 50));
      return { a, ov: !!document.querySelector(".av-ov"), cache, apres: getComputedStyle(document.querySelector("main")).visibility }; });
    ok(rt.a && !rt.ov && rt.cache && rt.apres === "visible", "le bouton retour du téléphone ferme le calendrier ; la page dessous n'est pas dessinée tant qu'il est ouvert (fluidité), puis revient " + JSON.stringify(rt));
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove())); await p.waitForTimeout(500);
    const e2 = await etat(p); ok(!e2.ov && e2.pas === "trophees", "1/12 · 2e lancement le même jour : rien ne s'ouvre ; la pastille reste " + JSON.stringify(e2));
    const e2m = await p.evaluate(async () => { localStorage.removeItem("versus.aventAuto"); allerA("moi"); await new Promise(z => setTimeout(z, 400)); return { ov: !!document.querySelector(".av-ov"), vue: typeof vueActive === "function" ? vueActive() : null }; });
    ok(e2m.ov, "depuis l'onglet Moi aussi, le calendrier s'ouvre (première vue du jour) " + JSON.stringify(e2m));
    await p.evaluate(() => { document.querySelectorAll(".av-ov").forEach(x => x.remove()); });
    o.quand = "2026-12-02T08:00:00"; await p.clock.setFixedTime(new Date(o.quand)); await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove())); await p.waitForTimeout(500);
    const e3 = await etat(p); ok(e3.ov && e3.jour === 2, "le lendemain : il se rouvre, sur le paquet du 2 " + JSON.stringify(e3));
    await p.click('.av-ov .av-c.jour'); await p.waitForTimeout(1500);
    const e4 = await etat(p); ok(e4.pas === "", "case du jour ouverte : plus de pastille " + JSON.stringify(e4));
    await p.evaluate(() => { localStorage.removeItem("versus.aventAuto"); document.querySelectorAll(".av-case,.av-ov").forEach(x => { if (x.jeu) x.jeu.stop(); x.remove(); }); }); await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove())); await p.waitForTimeout(500);
    const e5 = await etat(p); ok(!e5.ov && e5.pas === "", "case du jour déjà ouverte : pas d'ouverture automatique (même un nouveau jour pour l'appareil) " + JSON.stringify(e5));
    ok(!err.length, "6 · 0 erreur JS " + JSON.stringify(err)); await ctx.close();
    for (const q of ["2026-11-30T10:00:00", "2026-12-25T10:00:00"]) { const o2 = { quand: q, session: CLEMENT, stock: T }, P = await page(b, o2); await P.p.waitForTimeout(600); const e = await etat(P.p);
      ok(!e.ov && e.pas === "", q.slice(0, 10) + " : ni ouverture automatique ni pastille " + JSON.stringify(e)); ok(!P.err.length, "0 erreur JS " + JSON.stringify(P.err)); await P.ctx.close(); }
    { const o3 = { quand: "2026-12-03T08:00:00", session: CLEMENT }, P = await page(b, o3); await P.p.waitForTimeout(600); const e = await etat(P.p);
      ok(!e.ov, "sans demande explicite, les robots de test n'ont pas l'ouverture automatique (les autres tests restent tranquilles) " + JSON.stringify(e)); await P.ctx.close(); } }
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
