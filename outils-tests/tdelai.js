/* Test v20.31 · Délai de 7 jours (Théo, 24/11) : un relevé manquant bloque le mois 7 jours après le jour du relevé, puis le mois se joue sans lui.
   Lancer depuis la racine, serveur local ouvert (python3 -m http.server 8771). Fausses données uniquement. */
const { chromium } = require("playwright");
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [0, val, 0, r, 0].concat(Array(20).fill(0))];
const vide = k => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-29", [null, null, null, null, null, null, null, null], [0, 0, 0, null, 0].concat(Array(20).fill(0))];
const P = (nom, i, manque) => ({ nom, rows: [202610, 202611, 202612, 202701].map(k => manque && k === 202701 ? vide(k) : ligne(k, 1000 + i * 10 + k % 100, 0.01 * ((i + k) % 5) - 0.012 + i / 1000)) });
const data = { ok: true, version: 75, genere: "2027-02-10T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: [P("Théo", 0), P("Kévin", 1, true), P("Clément", 2), P("Devlin", 3)],
  marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: [202610, 202611, 202612, 202701].map(k => [k, 0.005, 0.006, 0.002]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
(async () => { const b = await chromium.launch(), R = {};
  for (const quand of ["2027-02-03T10:00:00", "2027-02-10T10:00:00"]) {
    const p = await (await b.newContext({ serviceWorkers: "block" })).newPage(), err = []; p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date(quand));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(data) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1500);
    R[quand] = await p.evaluate(() => { const c = championnat(2027), j = c.mois.find(m => m.k === 202701); const v = victoires(0); return { attente: c.attente && c.attente.k, jan: j ? j.l.map(z => [z.nom, z.base]) : null, serieKevin: v["Kévin"].serie, recordKevin: v["Kévin"].record }; }); R[quand].err = err;
    await p.close(); }
  await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); }, a = R["2027-02-03T10:00:00"], z = R["2027-02-10T10:00:00"];
  ok(!a.err.length && !z.err.length, "0 erreur JS");
  ok(a.attente === 202701 && !a.jan, "le 3/02 (5 jours après le relevé du 29/01), janvier attend encore Kévin : aucun point");
  ok(!z.attente && z.jan && z.jan.length === 3 && !z.jan.some(x => x[0] === "Kévin"), "le 10/02 (délai passé), janvier se joue sans Kévin : " + JSON.stringify(z.jan));
  ok(z.jan && z.jan.map(x => x[1]).join() === "6,4,2", "barème normal pour les présents (6·4·2), rien pour l'absent");
  ok(z.serieKevin === 0, "absent en janvier : sa série de victoires en cours est cassée (série " + z.serieKevin + ", record gardé " + z.recordKevin + ")");
  process.exit(ko.length ? 1 : 0); })();
