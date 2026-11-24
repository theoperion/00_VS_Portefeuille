/* Test · la carte Artema n'apparaît que si le fichier a vraiment un support Artema.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tartema.js
   Aucune vraie donnée : les serveurs Google sont interceptés et renvoient des chiffres inventés.
   Cas 1 « sans Artema » (Devlin, Kévin : réglage artema coupé, le serveur envoie des valeurs vides) : rien d'Artema nulle part.
   Cas 2 « Artema à 0 » (support présent mais vide) : rien non plus.
   Cas 3 « avec Artema » (Théo avant la photo de départ : valeurs vides, support présent) : la carte reste là (témoin). */
const { chromium } = require("playwright");
const VIDE = { initial: null, actuel: null, date: null, histo: [] };   // ce que le serveur envoie quand Artema est coupé (Reglages.js : artema false)
function moi(supports, suivi) {
  return { ok: true, version: 13, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
    synthese: { valeur: 5000, apports: 4500, gain: 500, gainPct: 0.11, epargne: 3000 },
    indices: [], enveloppes: [{ nom: "PEA", type: "env", valeur: 3000, gain: 300, gainPct: 0.1, twr: 0.1 }, { nom: "Assurance-vie", type: "env", valeur: 2000, gain: 200, gainPct: 0.1, twr: 0.1 }],
    groupes: [], fiscalite: [], epargne: [{ nom: "Livret A", solde: 3000, taux: 0.017 }, { nom: "Total épargne", solde: 3000 }],
    supports, histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
    parametres: { rappels: [{ nom: "Artema : niveau initial de l'indice", derniere: "non saisi", prochaine: "2026-11-01", statut: "⚠ À faire" }, { nom: "Artema : niveau actuel de l'indice", derniere: "jamais", prochaine: "2026-11-10", statut: "⚠ À faire" }], taux: { livretA: 0.017, ldds: 0.017, lep: 0.025 }, fondsEuros: {}, artema: suivi === undefined ? VIDE : Object.assign({ suivi }, VIDE), appart: null },
    prets: null, alertes: [], perfLignes: null, historique: null, ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
}
const SUP = {
  sans: [{ nom: "Fonds euros", investi: 1000, valeur: 1010 }, { nom: "Amundi MSCI World", investi: 900, valeur: 990 }, { nom: "Total AV", investi: 1900, valeur: 2000 }],
  zero: [{ nom: "Fonds euros", investi: 1000, valeur: 1010 }, { nom: "Artema Décembre 2026", investi: 0, valeur: 0 }, { nom: "Total AV", investi: 1000, valeur: 1010 }],
  avec: [{ nom: "Fonds euros", investi: 1000, valeur: 1010 }, { nom: "Artema Décembre 2026", investi: 1000, valeur: 1000 }, { nom: "Total AV", investi: 2000, valeur: 2010 }]
};
const versus = { ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }, { nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };

async function regarder(b, cas) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json",
    body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(SUP[cas.replace(/-.*/, "")], cas === "avec-coupe" ? false : cas === "avec-suivi" ? true : undefined) : versus) }));
  await p.addInitScript(() => {
    localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.tuto1", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test");
    localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" }));
  });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const vu = [];
  for (const o of ["jour", "patrimoine", "stats", "missions"]) {
    const b2 = p.locator('#v-moi [data-m-ong="' + o + '"]').first();
    if (await b2.count()) { await b2.click().catch(() => {}); await p.waitForTimeout(600); }
    // tout déplier pour lire aussi le contenu des rubriques fermées
    await p.evaluate(() => document.querySelectorAll("#v-moi details").forEach(d => { d.open = true; }));
    vu.push(await p.evaluate(() => document.querySelector("#v-moi").innerText));
  }
  const etat = await p.evaluate(() => ({ onglet: !!document.querySelector('#v-moi [data-m-aller="artema"]') }));
  await ctx.close();
  return { texte: vu.join("\n"), err, etat };
}
(async () => {
  const b = await chromium.launch(), r = {};
  for (const c of ["sans", "zero", "avec", "avec-coupe", "avec-suivi"]) r[c] = await regarder(b, c);
  await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const c of ["sans", "zero", "avec"]) ok(!r[c].err.length, "0 erreur JS (" + c + ") " + JSON.stringify(r[c].err));
  ok(/Ma bourse|Patrimoine|Aujourd/.test(r.sans.texte), "l'onglet Moi s'affiche bien avec les fausses données");
  ok(!/artema/i.test(r.sans.texte) && !r.sans.etat.onglet, "sans Artema (Devlin, Kévin) : aucune carte ni mention d'Artema");
  ok(!/Suivi du produit structuré|Artema : (niveau|rendez-vous|fin)|Point Artema/i.test(r.zero.texte) && !r.zero.etat.onglet, "support Artema à 0 € : pas de carte ni de rappel Artema (seule la ligne du support, venue du fichier, reste listée)");
  ok(/artema/i.test(r.avec.texte), "témoin : avec un vrai support Artema (valeurs pas encore saisies), la carte est bien là");
  ok(!/Suivi du produit structuré|Artema : (niveau|rendez-vous|fin)|Point Artema/i.test(r["avec-coupe"].texte) && !r["avec-coupe"].etat.onglet, "serveur « artema.suivi = faux » : carte cachée même si un support s'appelle Artema");
  ok(/Suivi du produit structuré/i.test(r["avec-suivi"].texte), "serveur « artema.suivi = vrai » : carte affichée");
  process.exit(ko.length ? 1 : 0);
})();
