/* Test v20.59 · L'accessoire du mois sur les têtes dessinées (Théo, 25/11).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tavatars.js   (PORT=… pour un autre port, CAPTURES=… pour le dossier des captures)
   Aucune vraie donnée : le serveur Google est intercepté (chiffres inventés).
   Vérifie : le bon accessoire chaque mois (dès le 1er, pas la veille), aucun accessoire d'univers 2027 avant le 1/1/2027 (seulement le bonnet
   de Noël en décembre 2026, rien avant), même si un joueur force l'aperçu ; l'aperçu admin seulement avec apercuAutorise() ; le calendrier
   des accessoires = celui des circuits (piste.js) ; chaque accessoire laisse les yeux et la bouche visibles ; pas d'accessoire dans l'éditeur
   de portrait ; un costume de carte (skin) passe devant ; le leader (et les co-leaders à égalité) en or, jamais pendant la chauffe ;
   un scintillement à la première vue de l'accessoire d'un nouveau mois (une fois, rien si « réduire les animations ») ; 0 erreur JS ; captures 390 px clair et sombre, planche des 13 et course. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "avatars");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const CLES_2027 = ["dunes", "chateau", "terrier", "anneau", "pandora", "etoiles", "ratatouille", "envers", "odyssee", "chocolat", "titans", "multivers"];
/** les 13 accessoires, par leur nom exact (pas « t-acc-* », qui attraperait aussi t-acc-or et t-acc-neuf) */
const SEL = ["noel"].concat(CLES_2027).map(k => ".t-acc-" + k).join(", ");
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
/** R2 : performances de décembre 2026 et janvier 2027 par pilote (pour le leader de la saison) ; sans R2, relevés jusqu'à novembre seulement */
function donnees(session, R2) {
  const personnes = NOMS.map((n, i) => ({ nom: n, rows: n === "Nicolas" ? [] : [ligne(202610, 1000 + i, 0.01), ligne(202611, 1010 + i * 3, 0.01 + i / 200)].concat(R2 ? [ligne(202612, 1020 + i * 3, R2[n][0]), ligne(202701, 1040 + i * 3, R2[n][1])] : []) }));
  return { ok: true, version: 87, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes,
    marche: { indices: ["S&P 500"], mois: [[202610, 0.004, 0.005], [202611, 0.004, 0.005]].concat(R2 ? [[202612, 0.004, 0.005], [202701, 0.004, 0.005]] : []), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function ouvrir(b, quand, o) {
  o = o || {};
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(quand));
  const data = donnees(o.session || { role: "perso", nom: "Clément" }, o.R2);
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : data) }); });
  await p.addInitScript(f => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.saison1", "1");
    localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.deJanvier", "1"); localStorage.setItem("versus.feteChauffe", "202612"); localStorage.setItem("versus.aideVisite", "1");
    if (f.adminOn) sessionStorage.setItem("versus.adminOn", "1"); if (f.force) sessionStorage.setItem("versus.apercuAcc", f.force); if (f.vj) localStorage.setItem("versus.vueJoueur", f.vj); }, { adminOn: !!o.adminOn, force: o.force || "", vj: o.vj || "" });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .ere-voile").forEach(x => x.remove()));
  return { p, ctx, err };
}
/** les accessoires présents dans la page (classes t-acc-*) + ceux qu'on peut obtenir par la fonction elle-même */
const vus = p => p.evaluate(async SEL => {
  const s = new Set(), cles = SEL.split(", ").map(x => x.slice(7)), lire = () => document.querySelectorAll(SEL).forEach(g => cles.forEach(k => { if (g.classList.contains("t-acc-" + k)) s.add(k); }));
  lire(); for (const v of ["trophees", "classement"]) { try { montrerVue(v); } catch (e) { } await new Promise(r => setTimeout(r, 500)); lire(); }
  return { dom: [...s], fn: accessoireDuMois() };
}, SEL);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); }, errs = [];
  // 1. Le calendrier, mois par mois (simple joueur), la veille et le 1er
  const A = await ouvrir(b, "2026-11-25T10:00:00");
  const cal = await A.p.evaluate(() => {
    const r = { cle: [], piste: MOIS_ACCESSOIRE.map((k, i) => k === (Piste.TRACES[CAL_GP[i]] || {}).peint), dessins: Object.keys(ACCESSOIRES_TETE) };
    const dates = ["2026-11-30T23:30:00", "2026-12-01T00:10:00", "2026-12-31T23:50:00", "2027-01-01T00:05:00"];
    for (let m = 1; m <= 12; m++) { const d = new Date(2027, m - 1, 1, 0, 5), v = new Date(2027, m - 1, 1, 0, 5 - 10); dates.push(d.toISOString(), v.toISOString()); }
    dates.push(new Date(2028, 2, 15).toISOString());
    dates.forEach(q => r.cle.push([q, accessoireDuMois(q)])); return r;
  });
  errs.push(...A.err);
  ok(cal.piste.every(Boolean), "les 12 accessoires suivent le calendrier des circuits (piste.js) " + JSON.stringify(cal.piste));
  ok(CLES_2027.concat("noel").every(k => cal.dessins.includes(k)), "13 dessins : 12 univers + bonnet de Noël");
  const att = (q, k) => { const x = cal.cle.find(z => z[0] === q || new Date(z[0]).getTime() === new Date(q).getTime()); return x && x[1] === k; };
  ok(att("2026-11-30T23:30:00", null), "30/11/2026 au soir : aucun accessoire");
  ok(att("2026-12-01T00:10:00", "noel") && att("2026-12-31T23:50:00", "noel"), "décembre 2026 : le bonnet de Noël, du 1er au 31 au soir");
  ok(att("2027-01-01T00:05:00", "dunes"), "1/1/2027 : le chèche de Dune");
  for (let m = 1; m <= 12; m++) {
    const d = new Date(2027, m - 1, 1, 0, 5), v = new Date(2027, m - 1, 1, 0, -5), avant = m === 1 ? "noel" : CLES_2027[m - 2];
    ok(att(d.toISOString(), CLES_2027[m - 1]) && att(v.toISOString(), avant), "mois " + m + " 2027 : " + CLES_2027[m - 1] + " dès le 1er, " + avant + " la veille au soir");
  }
  ok(att(new Date(2028, 2, 15).toISOString(), "terrier"), "2028 : le calendrier continue (mars = Merveilles)");
  // 2. Ce qu'un joueur voit vraiment, aux dates clés, même en forçant l'aperçu
  for (const [q, attendu] of [["2026-11-25T10:00:00", []], ["2026-12-03T10:00:00", ["noel"]], ["2026-12-20T10:00:00", ["noel"]], ["2026-12-31T22:00:00", ["noel"]], ["2027-01-01T10:00:00", ["dunes"]], ["2027-02-01T10:00:00", ["chateau"]]]) {
    const J = await ouvrir(b, q, { force: "titans", adminOn: true }), v = await vus(J.p); errs.push(...J.err); await J.ctx.close();
    const sans2027 = q < "2027" ? !v.dom.some(k => CLES_2027.includes(k)) : true;
    ok(sans2027 && JSON.stringify(v.dom.sort()) === JSON.stringify(attendu) && (v.fn || null) === (attendu[0] || null), q.slice(0, 10) + " · joueur (aperçu forcé) : " + (attendu[0] || "aucun accessoire") + (q < "2027" ? ", rien de 2027" : "") + " " + JSON.stringify(v));
  }
  // 3. Aperçu admin : seulement serveur « admin » ET mode admin allumé
  const Ad = await ouvrir(b, "2026-11-25T10:00:00", { session: { role: "admin" }, adminOn: true, force: "titans" }), vA = await vus(Ad.p);
  ok(vA.dom.includes("titans") && vA.fn === "titans", "admin, mode admin allumé : l'aperçu « porter » met l'accessoire choisi " + JSON.stringify(vA));
  await Ad.p.evaluate(() => { try { sessionStorage.removeItem("versus.apercuAcc"); } catch (e) { } apercuAccessoires(); }); await Ad.p.waitForTimeout(600);
  const pl = await Ad.p.evaluate(SEL => ({ l: document.querySelectorAll(".acc-gal .acc-l").length, t: document.querySelectorAll(".acc-gal :is(" + SEL + ")").length }), SEL);
  ok(pl.l === 13 && pl.t >= 13 * 5, "la planche admin montre les 13 accessoires sur toutes les têtes " + JSON.stringify(pl));
  await Ad.p.screenshot({ path: DOSSIER + "/planche-clair.png" });
  await Ad.p.evaluate(() => { const s = document.querySelector(".acc-pl"); if (s) s.scrollTop = 99999; }); await Ad.p.waitForTimeout(200); await Ad.p.screenshot({ path: DOSSIER + "/planche-clair-bas.png" });
  // planche en grand pour bien regarder (les 13 × les 5 têtes, en 96 px et en 24 px), sur fond clair et sombre
  const grand = await Ad.p.evaluate(() => {
    const L = ["noel"].concat(MOIS_ACCESSOIRE), d = document.createElement("div"); d.id = "planche-grande";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#F4F1EA;overflow:auto;padding:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px";
    d.innerHTML = L.map(k => '<div style="background:#fff;border-radius:10px;padding:6px;font:600 11px sans-serif;color:#222"><div>' + k + '</div><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">' +
      ["Théo", "Devlin"].map(n => '<span style="display:inline-block;width:78px;height:78px">' + avatar(n, Object.assign({}, equipDe(n), { pilote: "tete", acc: k, vignette: true })) + "</span>").join("") +
      ["Kévin", "Clément", "Nicolas"].map(n => '<span style="display:inline-block;width:24px;height:24px">' + avatar(n, Object.assign({}, equipDe(n), { pilote: "tete", acc: k, vignette: true })) + "</span>").join("") + "</div></div>").join("");
    d.querySelectorAll(".av").forEach(a => { a.style.width = "100%"; a.style.height = "100%"; });
    document.body.appendChild(d); return L.length;
  });
  await Ad.p.setViewportSize({ width: 390, height: 1400 }); await Ad.p.waitForTimeout(300);
  await Ad.p.screenshot({ path: DOSSIER + "/planche-grande.png" });
  // planche 24 px (la taille des pastilles de course), sur fond clair et sombre
  await Ad.p.evaluate(() => { document.getElementById("planche-grande").remove(); const L = ["noel"].concat(MOIS_ACCESSOIRE), d = document.createElement("div"); d.id = "planche-24";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;padding:8px;font:600 11px sans-serif";
    d.innerHTML = [["#F4F1EA", "#222"], ["#15171c", "#eee"]].map(([bg, fg]) => '<div style="background:' + bg + ';color:' + fg + ';padding:8px;border-radius:10px;margin-bottom:8px">' + L.map(k => '<div style="display:flex;align-items:center;gap:6px;height:30px"><span style="width:74px">' + k + "</span>" +
      ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"].map(n => '<span style="display:inline-block;width:24px;height:24px">' + avatar(n, Object.assign({}, equipDe(n), { pilote: "tete", acc: k, vignette: true })) + "</span>").join("") +
      '<span style="display:inline-block;width:24px;height:24px;margin-left:8px">' + avatar("Théo", Object.assign({}, equipDe("Théo"), { pilote: "tete", acc: k, dore: k !== "noel", vignette: true })) + "</span></div>").join("") + "</div>").join("");
    d.querySelectorAll(".av").forEach(a => { a.style.width = "100%"; a.style.height = "100%"; }); document.body.appendChild(d); });
  await Ad.p.setViewportSize({ width: 390, height: 900 }); await Ad.p.waitForTimeout(300); await Ad.p.screenshot({ path: DOSSIER + "/planche-24px-clair-sombre.png" });
  // 4. Le visage reste visible : yeux et bouche identiques avec et sans accessoire (rendu en image)
  const visage = await Ad.p.evaluate(async () => {
    const rendu = async svg => { const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace('<svg class="tete', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" class="tete'));
      await img.decode(); const c = document.createElement("canvas"); c.width = c.height = 400; const x = c.getContext("2d"); x.drawImage(img, 0, 0, 400, 400); return x; };
    const zones = [[15.8, 16.2, 2.0, 1.4], [22.2, 16.2, 2.0, 1.4], [17.6, 22.3, 4.8, 1.2]].map(z => z.map(v => Math.round(v * 10)));   // œil gauche, œil droit, bouche (repère 40 → 400 px)
    const r = {};
    for (const n of ["Théo", "Devlin", "Kévin"]) {
      const eq = Object.assign({}, equipDe(n), { pilote: "tete", vignette: true }), x0 = await rendu(svgTete(n, Object.assign({}, eq, { acc: "" }), true));
      for (const k of ["noel"].concat(MOIS_ACCESSOIRE)) {
        const x1 = await rendu(svgTete(n, Object.assign({}, eq, { acc: k }), true)); let diff = 0, tot = 0;
        zones.forEach(([zx, zy, w, h]) => { const a = x0.getImageData(zx, zy, w, h).data, b2 = x1.getImageData(zx, zy, w, h).data; for (let i = 0; i < a.length; i += 4) { tot++; if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 30) diff++; } });
        r[k] = Math.max(r[k] || 0, diff / tot);
      }
    }
    return r;
  });
  ok(Object.values(visage).every(v => v < 0.02), "chaque accessoire laisse les yeux et la bouche visibles (part de pixels changés) " + JSON.stringify(Object.fromEntries(Object.entries(visage).map(([k, v]) => [k, +v.toFixed(3)]))));
  // 5. Éditeur de portrait sans accessoire ; un costume de carte passe devant ; validité des dessins
  const div = await Ad.p.evaluate(() => {
    const e = equipDe("Théo"), xml = s => !new DOMParser().parseFromString(s.replace('<svg class="tete', '<svg xmlns="http://www.w3.org/2000/svg" class="tete'), "image/svg+xml").querySelector("parsererror");
    return { edit: !/t-acc-(noel|dunes|chateau|terrier|anneau|pandora|etoiles|ratatouille|envers|odyssee|chocolat|titans|multivers)\b/.test(htmlPilote("Théo", Object.assign({}, e))), skin: !/t-acc-(noel|dunes|chateau|terrier|anneau|pandora|etoiles|ratatouille|envers|odyssee|chocolat|titans|multivers)\b/.test(avatar("Théo", Object.assign({}, e, { skin: "chateau", acc: "dunes" }))),
      valides: ["noel"].concat(MOIS_ACCESSOIRE).every(k => xml(svgTete("Théo", Object.assign({}, e, { acc: k }), true)) && xml(svgTete("Nicolas", Object.assign({}, e, { acc: k }), true))) };
  });
  ok(div.edit, "éditeur de portrait (Mon portrait) : pas d'accessoire, on voit bien ses cheveux");
  ok(div.skin, "un costume de carte (skin du circuit, accessoire mérité) passe devant l'accessoire du mois");
  ok(div.valides, "les 13 dessins sont des SVG valides");
  errs.push(...Ad.err); await Ad.ctx.close();
  // « Vue joueur » de l'admin (simulation) après « Porter » : l'accessoire réel du jour, pas celui porté en aperçu
  const VJ = await ouvrir(b, "2026-12-10T10:00:00", { session: { role: "admin" }, adminOn: true, force: "titans", vj: "Théo" }), vV = await vus(VJ.p);
  ok(!vV.dom.includes("titans") && vV.fn === "noel" && vV.dom.every(k => k === "noel"), "Vue joueur de l'admin après « Porter » (titans) : l'accessoire réel du jour (bonnet de Noël) " + JSON.stringify(vV)); errs.push(...VJ.err); await VJ.ctx.close();
  const Off = await ouvrir(b, "2026-11-25T10:00:00", { session: { role: "admin" }, adminOn: false, force: "titans" }), vO = await vus(Off.p);
  ok(!vO.dom.length && vO.fn === null, "admin, mode admin éteint : pas d'aperçu (comme un joueur) " + JSON.stringify(vO)); errs.push(...Off.err); await Off.ctx.close();
  // 6. Lisible à 390 px, clair et sombre : classement et course (pastilles) en janvier et décembre
  for (const [q, nom] of [["2026-12-05T10:00:00", "decembre"], ["2027-01-10T10:00:00", "janvier"], ["2027-07-10T10:00:00", "juillet"]]) for (const sombre of [false, true]) {
    const P = await ouvrir(b, q, { sombre });
    await P.p.evaluate(async () => { try { montrerVue("classement"); } catch (e) { } await new Promise(r => setTimeout(r, 400)); });
    await P.p.screenshot({ path: DOSSIER + "/classement-" + nom + (sombre ? "-sombre" : "-clair") + ".png" });
    const lis = await P.p.evaluate(SEL => { const a = [...document.querySelectorAll(".av-tete")].filter(x => x.getBoundingClientRect().width > 0); return { n: a.length, acc: a.filter(x => x.querySelector(SEL)).length, min: Math.min(...a.map(x => x.getBoundingClientRect().width)) }; }, SEL);
    ok(lis.n > 0 && lis.acc === lis.n, nom + (sombre ? " sombre" : " clair") + " · classement : chaque tête porte l'accessoire " + JSON.stringify(lis));
    await P.p.evaluate(async () => { ETAT.podium = "gp"; ETAT.gp2d = "1"; GP_ETAPE = null; garder(); montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 1800)); document.querySelectorAll(".revel, .ba, .ere-voile, .regles").forEach(x => x.remove());
      const s = document.querySelector("#gp-piste") || document.querySelector(".gp-l"); if (s) s.scrollIntoView({ block: "start" }); });
    await P.p.waitForTimeout(1500); await P.p.screenshot({ path: DOSSIER + "/course-" + nom + (sombre ? "-sombre" : "-clair") + ".png" });
    const c = await P.p.evaluate(SEL => { const cle = x => { const g = x.querySelector(SEL); return g ? SEL.split(", ").map(z => z.slice(7)).find(k => g.classList.contains("t-acc-" + k)) : null; };
      return { liste: [...document.querySelectorAll(".gp-l .av-tete, .gp-suivi .av-tete, .gp-t3 .av-tete, .gpp-tour .av-tete")].map(cle), carte: [...document.querySelectorAll(".p2-portrait .av-tete")].map(cle) }; }, SEL);
    ok(c.liste.length && c.liste.every(Boolean), nom + (sombre ? " sombre" : " clair") + " · page Course : les têtes portent l'accessoire (" + c.liste.length + ")");
    ok(c.carte.every(k => k === c.liste[0]), nom + (sombre ? " sombre" : " clair") + " · un seul dessin par univers : la carte (" + c.carte.length + " portraits) et la liste portent le même accessoire " + JSON.stringify(c));
    errs.push(...P.err); await P.ctx.close();
  }
  // 7. v20.59 · le LEADER porte l'accessoire en or (co-leaders à égalité aussi), jamais pendant le tour de chauffe
  const etatOr = p => p.evaluate(async () => { try { montrerVue("classement"); } catch (e) { } await new Promise(r => setTimeout(r, 500));
    const or = new Set(), autres = new Set();
    document.querySelectorAll(".av-tete").forEach(a => { const g = a.querySelector(".t-tete"), n = (a.closest("[data-nom]") || {}).dataset; if (!g || !n || !n.nom) return; (g.classList.contains("t-acc-or") ? or : autres).add(n.nom); });
    return { leaders: leadersSaison(), or: [...or].sort(), autres: [...autres].sort(), eclat: !!document.querySelector(".acc-or-eclat") }; });
  const R1 = { "Théo": [0.01, 0.03], "Kévin": [0.02, 0.01], "Clément": [0.015, -0.01], "Devlin": [0.005, 0.005] };
  const L1 = await ouvrir(b, "2027-02-10T10:00:00", { R2: R1 }), o1 = await etatOr(L1.p); errs.push(...L1.err);
  ok(o1.leaders.length === 1 && JSON.stringify(o1.or) === JSON.stringify(o1.leaders) && !o1.autres.includes(o1.leaders[0]) && o1.eclat, "février 2027 · le leader (" + o1.leaders + ") porte l'accessoire doré, les autres non " + JSON.stringify(o1));
  await L1.p.evaluate(() => { const l = document.querySelector(".pos [data-nom], .pos"); if (l) l.scrollIntoView({ block: "center" }); }); await L1.p.screenshot({ path: DOSSIER + "/leader-dore-clair.png" });
  await L1.ctx.close();
  const R3 = { "Théo": [0.02, 0.02], "Kévin": [0.02, 0.02], "Clément": [0.01, -0.01], "Devlin": [0.005, 0.005] };
  const L2 = await ouvrir(b, "2027-02-10T10:00:00", { R2: R3, sombre: true }), o2 = await etatOr(L2.p); errs.push(...L2.err);
  ok(o2.leaders.length === 2 && JSON.stringify(o2.or) === JSON.stringify(o2.leaders.slice().sort()), "égalité de points : les 2 co-leaders sont dorés " + JSON.stringify(o2));
  await L2.p.screenshot({ path: DOSSIER + "/leader-dore-coleaders-sombre.png" });
  // gros plan : les 12 accessoires dorés
  await L2.p.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#15171c;padding:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px";
    d.innerHTML = MOIS_ACCESSOIRE.map(k => '<span style="display:block;aspect-ratio:1">' + avatar("Théo", Object.assign({}, equipDe("Théo"), { pilote: "tete", acc: k, dore: true, vignette: true })) + "</span>").join("");
    d.querySelectorAll(".av").forEach(a => { a.style.width = "100%"; a.style.height = "100%"; }); document.body.appendChild(d); });
  await L2.p.waitForTimeout(300); await L2.p.screenshot({ path: DOSSIER + "/leader-dore-12.png" }); await L2.ctx.close();
  const Dc = await ouvrir(b, "2026-12-20T10:00:00"), o3 = await etatOr(Dc.p); errs.push(...Dc.err);
  ok(!o3.leaders.length && !o3.or.length && !o3.eclat, "décembre 2026 (tour de chauffe) : personne en or, bonnet normal " + JSON.stringify(o3)); await Dc.ctx.close();
  // 8. v20.59 · le SCINTILLEMENT du nouveau mois : une fois, puis plus ; rien si « réduire les animations »
  const ctxS = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const nbNeuf = p => p.evaluate(async () => { try { montrerVue("classement"); } catch (e) { } await new Promise(r => setTimeout(r, 300)); return document.querySelectorAll(".t-acc-neuf .acc-scint, .t-acc-neuf").length; });
  const S1 = await ouvrir(b, "2027-02-10T10:00:00", { ctx: ctxS }), n1 = await nbNeuf(S1.p); await S1.p.screenshot({ path: DOSSIER + "/scintillement.png" }); errs.push(...S1.err); await S1.p.close();
  const S2 = await ouvrir(b, "2027-02-12T10:00:00", { ctx: ctxS }), n2 = await nbNeuf(S2.p); errs.push(...S2.err); await S2.p.close();
  const S3 = await ouvrir(b, "2027-03-01T10:00:00", { ctx: ctxS }), n3 = await nbNeuf(S3.p); errs.push(...S3.err); await ctxS.close();
  ok(n1 > 0 && n2 === 0 && n3 > 0, "scintillement : à la 1re vue de février (" + n1 + "), plus à la 2e (" + n2 + "), de nouveau au 1er mars (" + n3 + ")");
  const SR = await ouvrir(b, "2027-02-10T10:00:00", { reduit: true }), nr = await nbNeuf(SR.p); errs.push(...SR.err); await SR.ctx.close();
  ok(nr === 0, "« réduire les animations » : aucun scintillement (" + nr + ")");
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 5)));
  console.log("captures : " + DOSSIER);
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
