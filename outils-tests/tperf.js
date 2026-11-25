/* Test v20.53 · FLUIDITÉ sur un téléphone moyen (plainte de Théo : petits lags d'un onglet à l'autre ; en arrivant sur le Podium,
   2-3 secondes d'écran noir avant la carte de Noël du tour de chauffe).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tperf.js   (PORT=… pour un autre port)
   Téléphone simulé : 390 px, processeur ralenti ×4 (CDP Emulation.setCPUThrottlingRate ; CPU=… pour changer), mode léger (VERSUS_LEGER),
   aucune vraie donnée (le serveur Google est intercepté, chiffres inventés). Au 25 novembre 2026 : le Podium montre la grille du tour de chauffe
   (Carte 2D de Noël). Chaque mesure est la médiane de plusieurs essais (la machine de test est partagée : les chiffres bougent un peu).
   Mesure et vérifie :
   1. la 1re visite du Podium (3 ouvertures de l'appli) et les retours : temps jusqu'à la 1re image peinte qui montre DÉJÀ la carte
      (image décodée posée à sa place) ; aucune image peinte sans elle ; captures de contrôle (la carte de Noël est claire : noir = luminosité < 60) ;
   2. le passage d'un onglet à l'autre (Classement, Mois, Podium ; 5 tours) : du toucher à l'image affichée ; onglet redessiné ou gardé ;
   3. au retour, la même piste est gardée (pas reconstruite) ; onglet caché = décor animé en pause, qui repart au retour ;
   4. la 3D ne se lance pas sur la Carte 2D (aucun contexte WebGL ouvert) ; 5. la course de démo part toujours ;
   6. le hors connexion garde piste.js, cartes.js et la carte cuite du mois (2e affichage instantané) ; 0 erreur JS ;
   7. SECRET : un simple joueur ne télécharge ni ne garde d'avance que la carte du circuit qu'il peut voir ce jour-là (25/11, 3/12, 20/12, 31/12),
      rien en mode « économie de données » ; 8. un onglet gardé n'est jamais périmé (nouvelles données, minuit, état changé, hors connexion,
      Podium quitté aussitôt).
   Seuils : onglet < 100 ms (médiane ; Podium < 200 ms : sa carte animée doit être repeinte) ; carte visible < 300 ms au retour, < 450 ms à la toute 1re visite (la page entière se construit) ; jamais de noir.
   MESURE=1 : affiche seulement les chiffres (pour comparer avec une version précédente). */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html", CPU = +(process.env.CPU || 4), MESURE = !!process.env.MESURE;
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
function donnees() {
  const R = { "Théo": 0.012, "Kévin": 0.03, "Clément": -0.01, "Devlin": 0.02 };
  const personnes = NOMS.map((n, i) => ({ nom: n, rows: [ligne(202609, 1000 + i, 0.005), ligne(202610, 1010 + i, 0.01), ligne(202611, Math.round((1010 + i) * (1 + R[n])), R[n])] }));
  return { ok: true, version: 87, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: ["S&P 500", "Nasdaq-100"], mois: [[202609, 0.004, 0.005], [202610, 0.004, 0.005], [202611, 0.006, 0.007]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
const med = l => { const s = l.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; }, f = x => Math.round(x);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((MESURE ? "· " : c ? "OUI " : "NON ") + t); };
  const data = donnees(), errs = [];
  // décodeur de captures (page à part, pas ralentie) : luminosité moyenne et part de pixels noirs
  const dec = await (await b.newContext()).newPage();
  const lum = png => dec.evaluate(async s => { const im = new Image(); im.src = "data:image/png;base64," + s; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let t = 0, n = 0, noir = 0; for (let i = 0; i < d.length; i += 16) { const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; t += l; n++; if (l < 30) noir++; } return { l: t / n, noir: noir / n }; }, png.toString("base64"));
  async function ouvrir() {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: true, isMobile: true }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date("2026-11-25T12:00:00"));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: "text/css", body: "" }));   // polices : déjà gardées sur le téléphone
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : data) }); });
    await p.addInitScript(() => { window.VERSUS_LEGER = true; ["versus.tuto1", "versus.bullePortrait", "versus.saison1", "versus.chauffe1", "versus.aideVisite", "versus.deJanvier"].forEach(k => localStorage.setItem(k, "1"));
      localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.vue", "classement");
      // compteur de contextes 3D : la 3D (ou son test) ne doit pas s'ouvrir sur la Carte 2D
      const gc = HTMLCanvasElement.prototype.getContext; window.__GL = 0; HTMLCanvasElement.prototype.getContext = function (t, o) { if (/webgl/.test(t)) window.__GL++; return gc.call(this, t, o); };
      window.__LT = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__LT.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true }); } catch (e) { } });
    await p.goto(URL + "#classement"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 20000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .ere-voile").forEach(x => x.remove()); ETAT.podium = "gp"; ETAT.gp2d = "1"; garder();
      window.__RV = rendreVue; rendreVue = function () { window.__R++; return window.__RV.apply(this, arguments); }; window.__R = 0; });
    const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU }); await p.waitForTimeout(800);
    return { ctx, p, cdp, err };
  }
  /** touche un onglet : temps jusqu'à l'image affichée après le toucher, onglet redessiné ou non, plus long blocage dans la seconde qui suit */
  // « image affichée » : la 1re image qui suit le toucher (requestAnimationFrame), puis une tâche « message » qui passe juste après son dessin
  const onglet = (p, v) => p.evaluate(v => new Promise(res => { const apres = fn => { const c = new MessageChannel(); c.port1.onmessage = fn; c.port2.postMessage(0); }; window.__LT.length = 0; window.__R = 0; const t0 = performance.now(); document.querySelector('.onglet[data-vue="' + v + '"]').click(); const t1 = performance.now();
    requestAnimationFrame(() => apres(() => { const t2 = performance.now(); setTimeout(() => { const lt = window.__LT.filter(e => e[0] >= t0 - 1); res({ redessin: window.__R, sync: t1 - t0, image: t2 - t0, bloque: lt.reduce((m, e) => Math.max(m, e[1]), 0) }); }, 1000); })); }), v);
  /** touche le Podium : 1re image peinte (double requestAnimationFrame) qui montre déjà la carte ; puis captures de contrôle pendant ~2 s */
  async function podium(o) {
    const { p, cdp } = o, t0 = Date.now();
    await p.evaluate(() => { window.__T0 = performance.now(); document.querySelector('.onglet[data-vue="trophees"]').click(); window.__T1 = performance.now();
      const prete = () => { const sc = document.getElementById("gp-scene"); if (!sc) return false;
        const u = [sc, ...sc.querySelectorAll(".gp-rendu")].map(e => e.style.backgroundImage).find(x => /cartes\/garage/.test(x || "")); if (!u) return false;
        const pr = Object.values(typeof PRECHARGE_CARTES !== "undefined" ? PRECHARGE_CARTES : {}).find(i => u.includes(i.src.split("/").pop())); return !!(pr && pr.complete && pr.naturalWidth); };
      // aplat noir sous la carte : Firefox le montre tant que l'image du dessin n'est pas décodée (l'écran noir de 2-3 s vu par Théo)
      const aplat = () => [...document.querySelectorAll("#gp-scene .p2-svg > rect")].some(r => /^#0+$|black/i.test(r.getAttribute("fill") || "") && r.getAttribute("fill-opacity") !== "0");
      const apres = fn => { const c = new MessageChannel(); c.port1.onmessage = fn; c.port2.postMessage(0); };
      // l'état du DOM au début de l'image (requestAnimationFrame) est celui qui est peint ; la tâche « message » passe juste après le dessin
      window.__VIS = null; window.__NBI = 0; window.__APLAT = false; const f = () => requestAnimationFrame(() => { window.__NBI++; const ok = prete(); if (aplat()) window.__APLAT = true; apres(() => { if (ok) window.__VIS = performance.now() - window.__T0; else if (performance.now() - window.__T0 < 4000) f(); }); });
      f(); [200, 500, 900, 1500].forEach(t => setTimeout(() => { if (aplat()) window.__APLAT = true; }, t)); });
    await p.waitForFunction(() => window.__VIS !== null || performance.now() - window.__T0 > 4000, null, { timeout: 15000 }).catch(() => null);
    const mes = [];
    // captures directes (CDP), sans attendre les polices ni la stabilité : exactement ce qui est à l'écran
    while (Date.now() - t0 < 2200) { const c = await p.evaluate(() => { const e = document.getElementById("gp-scene"); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 10 && b.bottom > 0 ? { x: b.left, y: Math.max(0, b.top), width: b.width, height: Math.min(b.bottom, innerHeight) - Math.max(0, b.top), scale: 1 } : null; });
      if (!c) { mes.push({ l: 0, noir: 1 }); continue; } const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: c }); mes.push(await lum(Buffer.from(data, "base64"))); }
    const r = await p.evaluate(() => ({ vis: window.__VIS === null ? 9999 : window.__VIS, nbi: window.__NBI, sync: window.__T1 - window.__T0, aplat: window.__APLAT }));
    const noir = r.nbi > 1 || r.aplat || mes.some(m => m.noir > .5 || m.l < 60);   // une image peinte sans la carte, ou une capture sombre
    return { visible: r.vis, sync: r.sync, noir, detail: "images sans carte " + Math.max(0, r.nbi - 1) + ", luminosités " + mes.map(m => f(m.l)).join("/") };
  }
  // 1. première visite du Podium, sur 3 ouvertures de l'appli ; la dernière sert aussi au tour des onglets
  const P1 = []; let O = null;
  for (let k = 0; k < 3; k++) { if (O) { errs.push(...O.err); await O.ctx.close(); } O = await ouvrir(); P1.push(await podium(O)); await O.p.waitForTimeout(1500); }
  const { p } = O, gl0 = await p.evaluate(() => window.__GL);
  const inst1 = await p.evaluate(() => { window.__INST = GP_INST && GP_INST.api; return { type: GP_INST && GP_INST.api.type }; });
  // 2. tour des onglets (5 passages)
  const T = { classement: [], mois: [], trophees: [] }, B = { classement: [], mois: [], trophees: [] }, R = { classement: 0, mois: 0, trophees: 0 };
  for (let k = 0; k < 5; k++) for (const v of ["classement", "mois", "trophees"]) { const r = await onglet(p, v); T[v].push(r.image); B[v].push(r.bloque); R[v] += r.redessin; if (process.env.DEBUG) console.log("  " + v + " " + JSON.stringify(r)); }
  // 3. retours sur le Podium (3 fois) : carte tout de suite, même piste, décor endormi pendant l'absence
  const P2 = []; let susp = true;
  for (let k = 0; k < 3; k++) { await onglet(p, k % 2 ? "mois" : "classement"); await p.waitForTimeout(300); susp = susp && await p.evaluate(() => !!(window.__INST && window.__INST.cachee && window.__INST.cachee())); P2.push(await podium(O)); await p.waitForTimeout(500); }
  const inst2 = await p.evaluate(() => ({ meme: !!(GP_INST && GP_INST.api === window.__INST), gl: window.__GL, reveille: !!(GP_INST && GP_INST.api.cachee && !GP_INST.api.cachee()) }));
  await O.cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  // 4. la course de démo part toujours après les allers-retours
  const demo = await p.evaluate(async () => { const d = document.querySelector("#gp-demo"); if (!d) return { bouton: false }; d.click(); await new Promise(r => setTimeout(r, 1800)); return { bouton: true, roule: !!(GP_INST && GP_INST.api.enCours()) }; });
  errs.push(...O.err); await O.ctx.close();
  // 5. hors connexion : après installation du service worker, piste.js, cartes.js et la carte cuite de Noël sont gardées
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }), p2 = await ctx2.newPage();
  await p2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: "text/css", body: "" }));
  await p2.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(data) }));
  await p2.addInitScript(() => { ["versus.tuto1", "versus.bullePortrait", "versus.saison1", "versus.chauffe1", "versus.aideVisite", "versus.deJanvier"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); });
  await p2.clock.setFixedTime(new Date("2026-11-25T12:00:00"));
  for (let k = 0; k < 2; k++) { await p2.goto(URL); await p2.evaluate(() => navigator.serviceWorker.ready).catch(() => null); await p2.waitForTimeout(3000); }   // 2e ouverture : l'appli passe par le service worker
  const sw = await p2.evaluate(async () => { const n = (await caches.keys()).filter(k => k.startsWith("versus-")); if (!n.length) return { ok: false }; const ks = [];
    for (const c of n) (await (await caches.open(c)).keys()).forEach(r => ks.push(new URL(r.url).pathname + new URL(r.url).search));
    const u = "img/cartes/garage.webp?v=" + self.CARTES_CUITES.garage; return { ok: true, piste: ks.some(k => k.endsWith("/piste.js")), cartesJs: ks.some(k => k.endsWith("/img/cartes/cartes.js")), carte: ks.some(k => k.endsWith(u)), cartes: ks.filter(k => k.includes(".webp")).length }; });
  await ctx2.close();
  // 6. SECRET : un simple joueur (Kévin) ne télécharge d'avance QUE la carte du circuit qu'il peut voir ce jour-là (service worker autorisé, 2 ouvertures)
  const SECRET = [];
  for (const [date, attendu] of [["2026-11-25T12:00:00", ["garage"]], ["2026-12-03T12:00:00", ["garage"]], ["2026-12-20T12:00:00", ["garage"]], ["2026-12-31T12:00:00", ["garage"]], ["2026-12-03T12:00:00", [], true]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), q = await ctx.newPage(), vu = new Set(), e3 = [], eco = date && attendu.length === 0;
    ctx.on("request", r => { const m = /cartes\/([\w-]+)\.webp/.exec(r.url()); if (m) vu.add(m[1]); }); q.on("pageerror", e => e3.push(e.message));
    await q.clock.setFixedTime(new Date(date));
    await q.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: "text/css", body: "" }));
    const dK = JSON.parse(JSON.stringify(data)); dK.session = { role: "perso", nom: "Kévin" };
    await q.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : dK) }); });
    await q.addInitScript(eco => { ["versus.tuto1", "versus.bullePortrait", "versus.saison1", "versus.chauffe1", "versus.aideVisite", "versus.deJanvier"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.vue", "classement");
      if (eco) Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true }); }, eco);
    for (let k = 0; k < 2; k++) { await q.goto(URL + "#classement"); await q.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 20000 }); await q.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => null); await q.waitForTimeout(4000); }
    const garde = await q.evaluate(async () => { const o = []; for (const k of await caches.keys()) (await (await caches.open(k)).keys()).forEach(r => { const m = /cartes\/([\w-]+)\.webp/.exec(r.url); if (m) o.push(m[1]); }); return o; }).catch(() => []);
    const tout = [...new Set([...vu, ...garde])].sort();
    SECRET.push({ ok: JSON.stringify(tout) === JSON.stringify(attendu.slice().sort()) && !e3.length, t: date.slice(0, 10) + (eco ? " (économie de données)" : "") + " : " + (tout.length ? tout.join(", ") : "aucune") + (e3.length ? " · erreurs " + e3.join(" / ") : "") });
    await ctx.close();
  }
  // 7. onglet gardé, mais jamais périmé : nouvelles données du serveur, minuit, mode discret, hors connexion, Podium quitté aussitôt
  const PERIME = []; {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), q = await ctx.newPage(), e4 = [];
    q.on("pageerror", e => e4.push(e.message)); await q.clock.setFixedTime(new Date("2026-11-30T23:58:00")); let DATA = JSON.parse(JSON.stringify(data));
    await q.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: "text/css", body: "" }));
    await q.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : DATA) }); });
    await q.addInitScript(() => { ["versus.tuto1", "versus.bullePortrait", "versus.saison1", "versus.chauffe1", "versus.aideVisite", "versus.deJanvier"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.vue", "classement"); });
    await q.goto(URL + "#classement"); await q.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 20000 }); await q.waitForTimeout(2500);
    await q.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .ere-voile").forEach(x => x.remove()); ETAT.podium = "gp"; garder(); window.__R = []; const f = rendreVue; rendreVue = function (v) { window.__R.push(v); return f.apply(this, arguments); }; });
    const tab = async v => { await q.evaluate(v => { window.__R = []; document.querySelector('.onglet[data-vue="' + v + '"]').click(); }, v); await q.waitForTimeout(600); return q.evaluate(() => window.__R.slice()); };
    const P = (c, t) => PERIME.push({ ok: c, t });
    await tab("mois"); await tab("classement"); await tab("mois"); let r = await tab("classement"); P(!r.length, "témoin : retour sans aucun changement → onglet gardé");
    await tab("mois"); DATA = JSON.parse(JSON.stringify(DATA)); DATA.genere = "2026-11-30T23:59:00"; DATA.personnes[1].rows[2][3][3] = 0.2; await q.evaluate(() => charger(true)); await q.waitForTimeout(1500);
    r = await tab("classement"); P(r.includes("classement"), "nouvelles données du serveur → redessiné");
    await tab("trophees"); await tab("mois"); await q.clock.setFixedTime(new Date("2026-12-01T00:00:30"));
    r = await tab("classement"); P(r.includes("classement"), "minuit passé → Classement redessiné"); r = await tab("trophees"); P(r.includes("trophees"), "minuit passé → Podium redessiné");
    await tab("mois"); await tab("classement"); await tab("mois"); await q.evaluate(() => { ETAT.discret = "oui"; }); r = await tab("classement"); P(r.includes("classement"), "état changé sans toucher (mode discret) → redessiné");
    await tab("mois"); await tab("classement"); await tab("mois"); await q.evaluate(() => window.dispatchEvent(new Event("offline"))); await q.waitForTimeout(300);
    r = await tab("classement"); P(r.includes("classement"), "passage hors connexion → redessiné");
    await q.evaluate(() => { document.querySelector('.onglet[data-vue="trophees"]').click(); document.querySelector('.onglet[data-vue="classement"]').click(); }); await q.waitForTimeout(1500);
    const st = await q.evaluate(() => ({ roule: !!(GP_INST && GP_INST.api.enCours() && !(GP_INST.api.cachee && GP_INST.api.cachee())), ba: !!document.querySelector(".ba") }));
    r = await tab("trophees"); P(!st.roule && !st.ba && r.includes("trophees") && await q.evaluate(() => !!(GP_INST && document.querySelector("#gp-scene .gp-rendu"))), "Podium touché puis quitté aussitôt : rien ne démarre en coulisses, il se redessine avec sa piste au retour");
    P(!e4.length, "0 erreur JS (onglets gardés) " + JSON.stringify(e4.slice(0, 2)));
    await ctx.close();
  }
  await b.close();
  console.log("Téléphone simulé : processeur ralenti ×" + CPU + ", 390 px, mode léger");
  const v1 = med(P1.map(x => x.visible)), v2 = med(P2.map(x => x.visible));
  ok(v1 < 450 && !P1.some(x => x.noir), "1re visite du Podium : carte de Noël visible en " + f(v1) + " ms (médiane de " + P1.map(x => f(x.visible)).join(", ") + " ; seuil 450) · " + (P1.some(x => x.noir) ? "NOIR VU (" + P1.map(x => x.detail).join(" | ") + ")" : "jamais de noir") + " · toucher traité en " + f(med(P1.map(x => x.sync))) + " ms");
  ok(v2 < 300 && !P2.some(x => x.noir), "retour sur le Podium : carte visible en " + f(v2) + " ms (médiane de " + P2.map(x => f(x.visible)).join(", ") + " ; seuil 300) · " + (P2.some(x => x.noir) ? "NOIR VU (" + P2.map(x => x.detail).join(" | ") + ")" : "jamais de noir") + " · toucher traité en " + f(med(P2.map(x => x.sync))) + " ms");
  // Podium : 200 ms (le grand dessin animé de la carte doit être repeint à chaque retour ; v20.52 : 200 à 270 ms sur cette même machine)
  ["classement", "mois", "trophees"].forEach(v => ok(med(T[v]) < (v === "trophees" ? 200 : 100), "onglet " + v + " : image affichée en " + f(med(T[v])) + " ms (médiane de " + T[v].map(f).join(", ") + " ; seuil " + (v === "trophees" ? 200 : 100) + ") · redessiné " + R[v] + "/5 · plus long blocage " + f(Math.max(...B[v])) + " ms"));
  ok(inst1.type === "2d" && gl0 === 0 && inst2.gl === 0, "Carte 2D : aucun contexte 3D ouvert (" + inst2.gl + ")");
  ok(inst2.meme, "retour sur le Podium : la même piste est gardée (pas reconstruite)");
  ok(susp && inst2.reveille, "onglet caché : le décor animé de la carte est en pause, il repart au retour");
  ok(demo.bouton && demo.roule, "la course de démo part toujours après les allers-retours");
  ok(sw.ok && sw.piste && sw.cartesJs && sw.carte, "hors connexion : piste.js, cartes.js et la carte cuite de Noël sont gardées " + JSON.stringify(sw));
  SECRET.forEach(x => ok(x.ok, "secret : cartes téléchargées ou gardées d'avance par un simple joueur le " + x.t));
  PERIME.forEach(x => ok(x.ok, "jamais périmé : " + x.t));
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 3)));
  if (!MESURE) console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(MESURE || !ko.length ? 0 : 1);
})();
