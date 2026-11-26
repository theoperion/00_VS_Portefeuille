/* Test v20.54 · rappel mensuel « Versement programmé Linxea » : faux fichier Moi (contrat Linxea, versements inventés), serveur intercepté.
   Le jour vient du dernier versement Linxea saisi ; le rappel est dû à partir de ce jour, disparaît dès qu'un versement est saisi,
   s'éteint après 2 mois sans versement ; « Faire » ouvre directement « Coller le texte » de l'import. 0 erreur JS.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tlinxea-rappel.js */
const { chromium } = require("playwright");
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const moi = () => ({ ok: true, version: 14, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "AV Linxea Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }, { nom: "Retrait", tresorerie: -1, quantite: 0, flux: 1 }],
    actifs: [{ code: "DCAM", nom: "Amundi PEA Monde", isin: "FR001400U5Q4" }, { code: "LQQ", nom: "Nasdaq x2" }], cours: { DCAM: 5.5, LQQ: 112.5 },
    detenu: [{ env: "PEA Test", code: "DCAM", qte: 1000, pru: 5 }], journal: (globalThis.JOURNAL || []), raccourcis: [] } });
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }, { nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-20T10:00:00"));
  globalThis.JOURNAL = [{ type: "Apport", enveloppe: "AV Linxea Test", date: "2026-10-12", montant: 200 }, { type: "Apport", enveloppe: "AV Linxea Test", date: "2026-09-12", montant: 200 }];
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi() : versus) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const M0 = moi(), J = j => Object.assign({}, M0, { ref: Object.assign({}, M0.ref, { journal: j }) });
  const du = (j, d) => p.evaluate(([m, d]) => Moi._lxProgDu(m, new Date(d)), [J(j), d]);
  const base = globalThis.JOURNAL;
  ok(await du(base, "2026-11-20T10:00") === "2026-11-12", "Dernier versement le 12 : rappel dû depuis le 12/11");
  ok(await du(base, "2026-11-10T10:00") === null, "Avant le 12 : pas encore dû");
  ok(await du(base.concat([{ type: "Apport", enveloppe: "AV Linxea Test", date: "2026-11-12", montant: 200 }]), "2026-11-20T10:00") === null, "Versement de novembre saisi : le rappel disparaît");
  ok(await du(base, "2027-01-20T10:00") === null, "Plus de 2 mois sans versement : le rappel s'éteint (plus de versement programmé)");
  ok(await du([], "2026-11-20T10:00") === null, "Aucun versement Linxea : pas de rappel");
  const avecFichier = Object.assign(J(base), { parametres: { rappels: [{ nom: "Versement programmé Linxea", derniere: "", prochaine: "2026-11-15", statut: "À venir" }] } });
  ok(await p.evaluate(([m]) => Moi._lxProgDu(m, new Date("2026-11-20T10:00")), [avecFichier]) === null, "Rappel réglé dans le fichier (ligne « Versement programmé Linxea ») : c'est lui qui compte (pas de doublon)");
  const txt = await p.evaluate(() => document.querySelector("#v-moi").innerText);
  ok(/Versement programmé Linxea/.test(txt), "Moi › À faire : « Versement programmé Linxea » affiché");
  await p.evaluate(() => { const b = [...document.querySelectorAll("[data-af-faire]")].find(x => x.dataset.afFaire === "lxProg"); if (b) b.click(); });
  await p.waitForTimeout(500);
  const z = await p.evaluate(() => ({ txt: !!document.querySelector("#f-imp-txt"), env: (document.querySelector("#f-env") || {}).value }));
  ok(z.txt, "« Faire » : la zone « Coller le texte » de l'import est ouverte", z);
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
