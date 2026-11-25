/* Test v20.53 · Les musiques de course et les ambiances du plein écran des 12 circuits 2027 (js/sons.js).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tmusique.js   (PORT=… pour un autre port)
   Aucune vraie donnée : le serveur Google est intercepté (chiffres inventés). Vérifie, pour chaque clé 2027, course ET ambiance :
   1. rendu hors ligne : seulement des instruments qui existent, au plus 80 nœuds audio par seconde, au plus 50 sons simultanés,
      jamais plus de 3 s de silence, pas de saturation ;
   2. en direct : 0 son actif après fermeture du plein écran, ⏸ pause, 🔇 et onglet caché ; rien ne repart tant que le son est coupé ;
   3. chez un simple joueur : aucune clé 2027 jouée avant le 1er janvier 2027 (le secret des circuits est gardé jusque-là). */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const CLES = ["dunes", "chateau", "terrier", "anneau", "pandora", "etoiles", "ratatouille", "envers", "odyssee", "chocolat", "titans", "multivers"];
let nOui = 0, nNon = 0;
const ok = (c, m) => { if (c) nOui++; else nNon++; console.log((c ? "OUI " : "NON ") + m); };

async function rendus(b) {
  const p = await b.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: "{}" }));
  await p.goto(URL); await p.waitForFunction(() => window.SONS && SONS.AIRS, null, { timeout: 15000 });
  const res = await p.evaluate(async CLES => {
    const P = OfflineAudioContext.prototype; let cnt = null;
    ["createOscillator", "createBufferSource", "createGain", "createBiquadFilter"].forEach(n => { const o = P[n]; P[n] = function () { const x = o.apply(this, arguments);
      if (cnt) { cnt.tot++; if (n === "createOscillator" || n === "createBufferSource") { const st = x.start.bind(x), sp = x.stop.bind(x); let t0 = 0; x.start = (t, a) => { t0 = t || 0; return st(t, a); }; x.stop = t => { cnt.iv.push([t0, t]); return sp(t); }; } } return x; }; });
    const mesure = async (fn, cle, n) => {
      cnt = { tot: 0, iv: [] }; const d = await fn(cle, n), c = cnt; cnt = null;
      let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
      const ev = []; c.iv.forEach(([a, z]) => ev.push([a, 1], [z, -1])); ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]); let cur = 0, mx = 0; ev.forEach(e => { cur += e[1]; mx = Math.max(mx, cur); });
      let sil = 0, run = 0; const W = 4410; for (let i = 0; i + W <= d.length; i += W) { let s = 0; for (let j = i; j < i + W; j++) s += d[j] * d[j]; if (Math.sqrt(s / W) < .002) { run += .1; sil = Math.max(sil, run); } else run = 0; }
      return { noeuds: Math.round(c.tot / n), simult: mx, pic: +pk.toFixed(2), silence: +sil.toFixed(1) };
    };
    const out = {};
    for (const k of CLES) for (const [g, T, fn] of [["course", SONS.THEMES_COURSE[k], SONS._ecouteTheme], ["ambiance", SONS.AMBIANCES[k], SONS._ecouteAmbiance]]) {
      if (!T) { out[g + ":" + k] = null; continue; }
      const ins = new Set(); T.partition((t, i) => ins.add(i)); const L = T.longueur * 60 / T.tempo;
      out[g + ":" + k] = Object.assign({ manque: [...ins].filter(i => !SONS._instr[i]) }, await mesure(fn, k, Math.ceil(Math.min(L + 2, 110))));   // la boucle entière, plus le début de la suivante
    }
    return out;
  }, CLES);
  for (const [id, r] of Object.entries(res)) {
    if (!r) { ok(false, id + " : n'existe pas"); continue; }
    ok(!r.manque.length && r.noeuds <= 80 && r.simult <= 50 && r.silence <= 3 && r.pic < .99,
      id + " : instruments existants, " + r.noeuds + " nœuds/s (≤ 80), " + r.simult + " sons simultanés (≤ 50), silence max " + r.silence + " s (≤ 3), pic " + r.pic + (r.manque.length ? " MANQUE " + r.manque : ""));
  }
  ok(!err.length, "rendus : 0 erreur JS " + JSON.stringify(err)); await p.close();
}

async function fuites(b) {
  const ctx = await b.newContext(), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: "{}" }));
  await p.addInitScript(() => { window.__vivants = 0; window.__crees = 0; const P = AudioContext.prototype;
    ["createOscillator", "createBufferSource"].forEach(n => { const o = P[n]; P[n] = function () { const x = o.apply(this, arguments); window.__crees++; let parti = false; const st = x.start.bind(x);
      x.start = function () { if (!parti) { parti = true; window.__vivants++; x.addEventListener("ended", () => window.__vivants--); } return st.apply(null, arguments); }; return x; }; }); });
  await p.goto(URL); await p.waitForFunction(() => window.SONS && SONS.AIRS, null, { timeout: 15000 });
  const r = await p.evaluate(async C => {
    const z = ms => new Promise(r => setTimeout(r, ms)), out = {};
    for (const k of C) { SONS.ambiance(k); await z(250); }
    await z(2500); out.amb = { joue: SONS.ambianceJoue(), vivants: window.__vivants };
    SONS.ambiance(null); await z(3500); out.fermeture = { joue: SONS.ambianceJoue(), vivants: window.__vivants };
    for (const k of C) { SONS.course(4000, 0, k); await z(400); }
    await z(1000); out.course = { theme: SONS.themeJoue(), vivants: window.__vivants };
    SONS.pauseCourse(); await z(1500); out.pause = { theme: SONS.themeJoue(), vivants: window.__vivants };
    SONS.course(6000, 0, "anneau"); await z(1000); SONS.basculer(false); await z(1500); out.coupe = { theme: SONS.themeJoue(), vivants: window.__vivants };
    const c0 = window.__crees; SONS.ambiance("titans"); SONS.course(3000, 0, "titans"); await z(2000); out.coupeRien = { nouveaux: window.__crees - c0, theme: SONS.themeJoue(), amb: SONS.ambianceJoue() };
    SONS.ambiance(null); SONS.basculer(true); await z(400);
    SONS.ambiance("odyssee"); await z(3000); SONS.meteo("orage"); out.meteo = SONS._meteo(); SONS.meteo(null);
    return out;
  }, CLES);
  ok(r.amb.joue && r.amb.vivants > 0, "plein écran : l'ambiance joue (" + r.amb.vivants + " sons)");
  ok(!r.fermeture.joue && r.fermeture.vivants === 0, "fermeture du plein écran : 0 son actif (" + r.fermeture.vivants + ")");
  ok(r.course.theme && r.course.vivants > 0, "course : la musique du circuit joue");
  ok(!r.pause.theme && r.pause.vivants === 0, "⏸ pause : 0 son actif (" + r.pause.vivants + ")");
  ok(!r.coupe.theme && r.coupe.vivants === 0, "🔇 : 0 son actif (" + r.coupe.vivants + ")");
  ok(r.coupeRien.nouveaux === 0 && !r.coupeRien.theme && !r.coupeRien.amb, "🔇 : rien ne repart, ni course ni ambiance (" + r.coupeRien.nouveaux + " sons créés)");
  ok(r.meteo === "orage", "météo : l'orage est pris en compte en direct");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(2500);
  const cache = await p.evaluate(() => ({ joue: SONS.ambianceJoue(), vivants: window.__vivants }));
  ok(!cache.joue && cache.vivants === 0, "onglet caché : 0 son actif (" + cache.vivants + ")");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(2500); const retour = await p.evaluate(() => SONS.ambianceJoue());
  await p.evaluate(() => SONS.ambiance(null)); await p.waitForTimeout(3000); const fin = await p.evaluate(() => window.__vivants);
  ok(retour && fin === 0, "retour sur l'onglet : l'ambiance revient ; fermée ensuite : 0 son actif (" + fin + ")");
  ok(!err.length, "direct : 0 erreur JS " + JSON.stringify(err)); await ctx.close();
}

/* 3 · le simple joueur (Kévin) : quelles clés de musique sont demandées selon la date */
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
function donnees(jusqua) {
  const personnes = NOMS.map((n, i) => { const rows = [ligne(202610, 1000 + i, .01)]; [202611, 202612, 202701].forEach((k, j) => { if (k <= jusqua) rows.push(ligne(k, 1000 + i + 10 * (j + 1) * (i + 1), .01 * (i - 2))); }); return { nom: n, rows }; });
  return { ok: true, version: 87, genere: "2026-12-10T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"], personnes,
    marche: { indices: ["S&P 500", "Nasdaq-100"], mois: [202610, 202611, 202612, 202701].filter(k => k <= jusqua).map(k => [k, .004, .005]), resume: [], dateComparaison: null, tauxSansRisque: .03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Kévin" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function secret(b) {
  for (const [quand, jusqua] of [["2026-11-28T12:00:00", 202611], ["2026-12-03T12:00:00", 202611], ["2026-12-20T12:00:00", 202611], ["2026-12-31T22:00:00", 202612], ["2027-01-01T09:00:00", 202612]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(quand));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "tickets" ? { ok: true, ouvert: false } : donnees(jusqua)) }); });
    await p.addInitScript(() => { ["versus.cle:x", "versus.tuto1:1", "versus.exclVus:[]", "versus.bullePortrait:1", "versus.saison1:1", "versus.deJanvier:1", "versus.aideVisite:1", "versus.feteChauffe:202612"].forEach(s => { const i = s.indexOf(":"); localStorage.setItem(s.slice(0, i), s.slice(i + 1)); });
      window.__cles = []; const w = () => { if (!window.SONS) return setTimeout(w, 5); ["course", "ambiance", "jingle", "musiqueBA"].forEach(n => { const o = SONS[n]; if (o) SONS[n] = function () { window.__cles.push(n + ":" + arguments[n === "course" ? 2 : 0]); return o.apply(this, arguments); }; }); }; w(); });
    await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
    const cles = await p.evaluate(async () => {
      const dormir = ms => new Promise(r => setTimeout(r, ms));
      document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); ETAT.podium = "gp"; garder(); montrerVue("trophees"); rendreTrophees(); await dormir(1200);
      for (let j = 0; j < document.querySelectorAll(".gp-mois [data-gpe]").length; j++) { const bt = document.querySelectorAll(".gp-mois [data-gpe]")[j]; if (bt) { bt.click(); await dormir(400); } }
      const pl = document.querySelector("#gp-plein-gros, #gp-plein"); if (pl) { pl.click(); await dormir(900); }
      for (let j = 0; j < document.querySelectorAll(".gpp-mois [data-gpe]").length; j++) { const bt = document.querySelectorAll(".gpp-mois [data-gpe]")[j]; if (bt) { bt.click(); await dormir(500); } }
      const demo = [...document.querySelectorAll("button")].find(x => /démonstration/i.test(x.textContent)); if (demo) { demo.click(); await dormir(1500); }
      return [...new Set(window.__cles)];
    });
    const fuite = cles.filter(c => CLES.some(k => c.endsWith(":" + k)));
    if (new Date(quand) < new Date(2027, 0, 1)) ok(!fuite.length, quand.slice(0, 10) + " · simple joueur : aucune musique 2027 jouée " + JSON.stringify(cles));
    else console.log("info " + quand.slice(0, 10) + " · clés jouées " + JSON.stringify(cles));
    ok(!err.length, quand.slice(0, 10) + " · 0 erreur JS " + JSON.stringify(err)); await ctx.close();
  }
}

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try { await rendus(b); await fuites(b); await secret(b); } finally { await b.close(); }
  console.log("\n" + nOui + " OUI, " + nNon + " NON"); process.exit(nNon ? 1 : 0);
})();
