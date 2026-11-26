/* Test v20.65 · rappel « Versement Linxea » (rappel du fichier, profil type Clément) : choix « Aucun versement ce mois-ci ».
   - le choix range le rappel jusqu'au même jour le mois suivant (sa date habituelle), puis il revient ;
   - retour en arrière : « Annuler » dans le message, « Remettre le rappel » dans À faire, et effacé tout seul si un versement Linxea est saisi ce mois-ci ;
   - le rappel Artema (relevé) ne change pas : pas de ce choix, toujours affiché. 0 erreur JS.
   Fausses données. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tlinxea-aucun.js  (PORT=…) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const moi = journal => ({ ok: true, version: 14, genere: "2026-11-20T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [{ nom: "Versement Linxea", derniere: "2026-10-12", prochaine: "2026-11-12", statut: "⚠ En retard" },
    { nom: "Relevé Quintessa (Artema)", derniere: "2026-10-15", prochaine: "2026-11-15", statut: "⚠ En retard" }] },
  prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "AV Linxea Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "AV Quintessa Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }], actifs: [{ code: "DCAM", nom: "Monde" }], cours: {}, detenu: [], journal, raccourcis: [] } });
const versus = { ok: true, genere: "2026-11-20T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Clément", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Clément" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const J0 = [{ type: "Apport", enveloppe: "AV Linxea Test", date: "2026-10-12", montant: 200 }];
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), err = [];
  let journal = J0;
  await ctx.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(journal) : versus) }));
  await ctx.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1"); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  const ouvrir = async () => { const p = await ctx.newPage(); p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date("2026-11-20T10:00:00"));
    await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi .m-afaire"), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove())); return p; };
  const etat = p => p.evaluate(() => { const box = document.querySelector("#v-moi .m-afaire"), lignes = [...document.querySelectorAll("#v-moi .m-afaire .af-r")];
    return { lx: lignes.some(l => /Versement Linxea/i.test(l.innerText)), art: lignes.some(l => /Artema|Quintessa/.test(l.innerText)), bouton: lignes.filter(l => l.querySelector("[data-lx-sans]")).map(l => l.querySelector("b").textContent),
      remettre: !!document.querySelector("[data-lx-remettre]"), toast: (document.querySelector("#toast:not([hidden])") || {}).innerText || "", deb: box ? [...box.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > innerWidth + 1) : false }; });
  let p = await ouvrir(), e = await etat(p);
  ok(e.lx && e.art, "Au départ : rappel « Versement Linxea » et rappel Artema affichés", e);
  ok(e.bouton.length === 1 && /Linxea/.test(e.bouton[0]), "« Aucun versement ce mois-ci » seulement sur le rappel Linxea (pas sur Artema)", e);
  ok(!e.deb, "Rien ne déborde à 390 px", e);
  await p.locator("#v-moi .m-afaire").screenshot({ path: "/tmp/tlinxea-aucun.png" }).catch(() => {});
  await p.click("[data-lx-sans]"); await p.waitForTimeout(400); e = await etat(p);
  ok(!e.lx && e.art, "Après « Aucun versement ce mois-ci » : Linxea rangé, Artema toujours là", e);
  ok(/12\/12/.test(e.toast) && /Annuler/.test(e.toast), "Message « Rappel rangé jusqu'au 12/12 · Annuler »", e.toast);
  await p.click("#toast .tst-ann"); await p.waitForTimeout(400); e = await etat(p);
  ok(e.lx && e.bouton.length === 1, "« Annuler » : le rappel Linxea revient tout de suite", e);
  await p.click("[data-lx-sans]"); await p.waitForTimeout(400); e = await etat(p);
  ok(!e.lx && e.remettre, "Rangé : un lien « Remettre le rappel » reste dans À faire", e);
  await p.click("[data-lx-remettre]"); await p.waitForTimeout(400); e = await etat(p);
  ok(e.lx, "« Remettre le rappel » : il revient", e);
  await p.click("[data-lx-sans]"); await p.waitForTimeout(400);
  const fin = await p.evaluate(() => [Moi._lxSans("2026-12-11T10:00:00"), Moi._lxSans("2026-12-12T10:00:00")]);
  ok(!!fin[0] && fin[1] === null, "Rangé jusqu'au 11/12 inclus, de retour le 12/12 (sa date habituelle)", fin);
  ok(await p.evaluate(() => Moi._rangerLxSans("2026-01-31", "2026-01-20T10:00:00")) === "2026-02-28" && await p.evaluate(() => Moi._rangerLxSans("2026-12-12", "2026-12-20T10:00:00")) === "2027-01-12", "Mois courts et passage d'année : 31/01 → 28/02, décembre → janvier");
  await p.evaluate(() => Moi._rangerLxSans("2026-11-12", "2026-11-20T10:00:00"));
  await p.close(); p = await ouvrir(); e = await etat(p);
  ok(!e.lx && e.remettre && e.art, "Réouverture : toujours rangé (gardé sur le téléphone), Artema toujours là", e);
  journal = J0.concat([{ type: "Apport", enveloppe: "AV Linxea Test", date: "2026-11-21", montant: 200 }]);
  await p.close(); p = await ouvrir(); e = await etat(p);
  ok(!e.remettre && (await p.evaluate(() => Moi._lxSans())) === null, "Un versement Linxea saisi ce mois-ci : le choix « aucun versement » s'efface tout seul", e);
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
