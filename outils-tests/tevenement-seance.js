/* Test (26/11/2026, Théo) · un événement de Moi (journée folle, krach, tempête crypto…) du jour D disparaît TOUJOURS le lendemain à 9 h (heure de Paris),
   week-end compris (la crypto tourne tout le temps), sans rattrapage.
   - événement du jeudi : visible jeudi 16 h et 22 h, et vendredi 8 h 59 ; disparu vendredi 9 h et 10 h ;
   - événement du vendredi : visible samedi 8 h 30, disparu samedi 9 h ; événement du samedi : disparu dimanche 9 h ;
   - la pastille d'Aujourd'hui suit la même règle ;
   - les objets secrets liés (Montagnes russes, Phénix…) restent calculés sur l'historique, quelle que soit la date. 0 erreur JS.
   Fausses données (serveurs Google interceptés). Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tevenement-seance.js  (PORT=…) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
/* historique inventé : séances de semaine d'août à mi-novembre ; +3 % le 06/10 puis −3 % le 08/10 (Montagnes russes), remontée de +3,5 % le 09/10 (Phénix) */
const iso = t => new Date(t).toISOString().slice(0, 10), num = d => +d.replace(/-/g, "");
const J = []; for (let t = Date.parse("2026-08-03T00:00:00Z"); iso(t) <= "2026-11-13"; t += 864e5) { const j = new Date(t).getUTCDay(); if (j > 0 && j < 6) J.push(iso(t)); }
const ip = []; { let v = 100; J.forEach((d, i) => { if (i) v *= d === "2026-10-06" ? 1.03 : d === "2026-10-08" ? 0.97 : d === "2026-10-09" ? 1.035 : i % 2 ? 1.004 : 0.998; ip.push(Math.round(v * 100) / 100); }); }
const moi = { ok: true, version: 14, genere: "2026-11-19T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 9000, gain: 1000, gainPct: 0.11 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, signal: null,
  historique: { cols: ["d", "v", "a", "ip"], rows: J.map((d, i) => [num(d), 10000, 9000, ip[i]]) },
  ref: { enveloppes: [], types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] } };
const versus = { ok: true, genere: "2026-11-19T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: [{ nom: "Test", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Test" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const ev = d => [{ k: "feu", d, p: -0.031, sens: -1, niv: 1, fort: false, folle: true }, { k: "krach", d, p: -0.035 }, { k: "crypto", d, p: -0.12 }];
let DIRECT = {};
(async () => {
  const b = await chromium.launch(), err = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", timezoneId: "Europe/Paris" });
  await ctx.addInitScript(() => { if (localStorage.getItem("versus.cle")) return; localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await ctx.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? Object.assign({}, moi, { synthese: Object.assign({}, moi.synthese, DIRECT) }) : versus) }));
  // fonctions privées de moi.js exposées pour le test seulement (la copie servie au navigateur ; le fichier n'est pas modifié)
  await ctx.route("**/moi.js*", async r => { const rep = await r.fetch(), t = await rep.text();
    r.fulfill({ response: rep, body: t.replace(/\}\)\(\);\s*$/, "window.__T = { evenementsListe, jourEv, etatObjets, seed: l => { stock.set(cleStock(\"evNes\"), JSON.stringify(l)); stock.set(cleStock(\"folles\"), JSON.stringify(l.filter(x => x.folle).map(x => x.d + \"-1\"))); stock.set(cleStock(\"evVus\"), JSON.stringify(l.map(x => x.k + \":\" + x.d))); MEMO_EV = { m: null, j: \"\", l: null }; } };\n})();\n") }); });
  const voir = async (heure, l) => {
    const p = await ctx.newPage(); p.on("pageerror", e => err.push(heure + " : " + e.message));
    await p.clock.setFixedTime(new Date(heure));
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => window.__T && window.Moi && document.querySelector("#v-moi .m-hero"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(500);
    const r = await p.evaluate(l => { window.__T.seed(l); window.Moi.rendre(); return { sc: window.__T.jourEv(), ev: window.__T.evenementsListe().map(x => x.k + ":" + x.d), pastilles: document.querySelectorAll("#v-moi .m-ev-b").length, route: (document.querySelector("#v-moi .m-ev-r") || {}).textContent || "",
      obj: ["emb.montagnes", "theme.phenix"].filter(k => window.__T.etatObjets().ok.has(k)) }; }, l);
    if (globalThis.AFF) { await p.waitForTimeout(1800); r.affiche = await p.evaluate(() => [...document.querySelectorAll(".m-folle")].map(e => e.textContent)); }
    await p.close(); return r;
  };
  const cas = [["2026-11-19T22:30:00+01:00", "2026-11-19", true, "Événement du jeudi : visible le jeudi après la clôture (22 h 30)"],
    ["2026-11-19T23:00:00+01:00", "2026-11-19", true, "Événement du jeudi : visible le jeudi à 23 h"],
    ["2026-11-20T08:59:00+01:00", "2026-11-19", true, "Événement du jeudi : encore visible le vendredi à 8 h 59"],
    ["2026-11-20T09:00:00+01:00", "2026-11-19", false, "Événement du jeudi : disparu le vendredi à 9 h"],
    ["2026-11-20T10:00:00+01:00", "2026-11-19", false, "Événement du jeudi : disparu le vendredi à 10 h"],
    ["2026-11-20T22:30:00+01:00", "2026-11-20", true, "Événement du vendredi : visible le vendredi après la clôture"],
    ["2026-11-21T08:30:00+01:00", "2026-11-20", true, "Événement du vendredi : visible le samedi à 8 h 30"],
    ["2026-11-21T09:00:00+01:00", "2026-11-20", false, "Événement du vendredi : disparu le samedi à 9 h (pas d'exception pour le week-end)"],
    ["2026-11-21T12:00:00+01:00", "2026-11-21", true, "Événement du samedi (crypto) : visible le samedi"],
    ["2026-11-22T09:00:00+01:00", "2026-11-21", false, "Événement du samedi : disparu le dimanche à 9 h"]];
  for (const [h, d, vis, t] of cas) {
    const r = await voir(h, ev(d));
    const tous = ["feu:" + d, "krach:" + d, "crypto:" + d].every(k => r.ev.includes(k));
    ok(vis ? tous && r.pastilles >= 1 : !r.ev.length && !r.pastilles, t + " (journée folle, krach, tempête crypto + pastille)", r);
  }
  const r = await voir("2026-11-24T10:00:00+01:00", ev("2026-11-20"));
  ok(r.obj.includes("emb.montagnes") && r.obj.includes("theme.phenix"), "Montagnes russes et Phénix : toujours gagnés d'après l'historique (séances d'octobre), sans lien avec la durée des événements", r.obj);
  /* v21.18 (Théo, 27/11) : si la séance retombe sous 2,8 %, ce n'est pas un feu d'artifice */
  const joie = (d, p) => [{ k: "joie", d, p, sens: 1, niv: 1, fort: false, folle: true }];
  let q = await voir("2026-11-13T20:00:00+01:00", joie("2026-11-13", 0.031));
  ok(!q.ev.some(x => x.startsWith("joie")), "Feu d'artifice né en direct (+3,1 %) mais séance finie sous 2,8 % dans l'historique : retiré", q);
  q = await voir("2026-10-09T20:00:00+02:00", joie("2026-10-09", 0.029));
  ok(q.ev.includes("joie:2026-10-09"), "Séance finie à +3,5 % : le feu d'artifice reste", q);
  DIRECT = { jourPct: 0.0163, jour: 576 };
  q = await voir("2026-11-27T13:42:00+01:00", joie("2026-11-27", 0.029));
  ok(!q.ev.some(x => x.startsWith("joie")) && !q.pastilles, "En direct : +2,9 % ce matin, +1,63 % maintenant → plus de feu d'artifice ni de pastille", q);
  ok(!q.route, "En direct à +1,63 % : pas de signe « en route »", q.route);
  DIRECT = { jourPct: 0.031, jour: 1000 };
  q = await voir("2026-11-27T15:00:00+01:00", []);
  ok(!q.ev.length && !q.pastilles && /En route vers un feu d'artifice/.test(q.route) && /\+3,10/.test(q.route), "v21.20 · séance en cours à +3,1 % : pas d'événement, seulement « En route vers un feu d'artifice · +3,10 % »", q);
  globalThis.AFF = 1; q = await voir("2026-11-27T15:00:00+01:00", []);
  ok(q.affiche && q.affiche.length === 1 && /En route vers un feu d'artifice/.test(q.affiche[0]) && /\+3,10/.test(q.affiche[0]) && /décidé à la clôture/.test(q.affiche[0]), "v21.21 · à l'ouverture pendant la séance : l'affichette s'ouvre avec « En route vers un feu d'artifice · +3,10 % · décidé à la clôture »", q.affiche);
  q = await voir("2026-11-27T15:30:00+01:00", []); globalThis.AFF = 0;
  ok(q.affiche && q.affiche.length === 0, "v21.21 · rouverte 30 min plus tard, même palier : l'affichette ne se rejoue pas (une fois par séance)", q.affiche);
  q = await voir("2026-11-27T15:00:00+01:00", joie("2026-11-27", 0.031));
  ok(!q.ev.length && !q.pastilles, "v21.20 · un feu d'artifice gardé de ce matin (ancienne version) est retiré tant que la séance n'est pas finie", q);
  q = await voir("2026-11-27T18:00:00+01:00", []);
  ok(q.ev.includes("joie:2026-11-27") && !q.route, "v21.20 · séance finie (18 h, portefeuille coté à Paris) à +3,1 % : le feu d'artifice naît", q);
  DIRECT = { jourPct: -0.032, jour: -1000 };
  q = await voir("2026-11-27T11:00:00+01:00", []);
  ok(!q.ev.length && /En route vers un incendie/.test(q.route), "v21.20 · séance en cours à −3,2 % : « En route vers un incendie », pas d'événement", q);
  DIRECT = {};
  q = await voir("2026-11-13T20:00:00+01:00", [{ k: "serie", d: "2026-11-13", p: 0.02 }]);
  ok(!q.ev.includes("serie:2026-11-13"), "Série verte gardée sur le téléphone mais plus vraie dans l'historique : retirée (tous les événements)", q);
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
