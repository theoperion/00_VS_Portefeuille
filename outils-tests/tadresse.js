/* Test v20.34 · le Versus donne à Kévin la nouvelle adresse de son fichier Moi : l'appli s'y range toute seule (même clé).
   Lancer depuis la racine, serveur local ouvert (python3 -m http.server 8771). Fausses données uniquement. */
const { chromium } = require("playwright");
const NOUVELLE = "https://script.google.com/macros/s/NOUVEAUFICHIER/exec", ANCIENNE = "https://script.google.com/macros/s/ANCIENFICHIER/exec";
const versus = nom => ({ ok: true, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Kévin", rows: [] }, { nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: nom ? { role: "perso", nom } : { role: "admin" }, moiAdresse: nom === "Kévin" ? NOUVELLE : null, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} });
const complet = { ok: true, version: 13, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "", synthese: { valeur: 0, apports: 0, gain: 0, epargne: 1000 },
  indices: [], enveloppes: [], groupes: [], fiscalite: [], epargne: [{ nom: "Livret A", solde: 1000, taux: 0.017 }], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [],
  cibles: null, objectif: null, parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], perfLignes: null, historique: null, ref: { enveloppes: [], actifs: [], journal: [] }, signal: null };
const simple = { ok: true, profil: "simple", genere: "2026-11-24T10:00:00", comptes: [], soldes: [], reglages: { personne: "Kévin", appart: {}, pret: {} }, echeancier: [], joursModif: 7 };
async function essai(b, nom) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" })).newPage(), err = [], appels = [];
  p.on("pageerror", e => err.push(e.message));
  await p.route("https://script.google.com/**", r => { const u = r.request().url(); appels.push(u.includes("NOUVEAU") ? "nouveau" : u.includes("ANCIEN") ? "ancien" : "versus");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(u.includes("NOUVEAU") ? complet : u.includes("ANCIEN") ? simple : versus(nom)) }); });
  await p.addInitScript(a => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", a); localStorage.setItem("versus.moi.cle", "cle-kevin"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); }, ANCIENNE);
  await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => ({ api: localStorage.getItem("versus.moi.api"), cle: localStorage.getItem("versus.moi.cle") }));
  await p.close(); return { r, err, appels };
}
(async () => { const b = await chromium.launch(), k = await essai(b, "Kévin"), t = await essai(b, "Théo"); await b.close();
  const ko = [], ok = (c, x) => { if (!c) ko.push(x); console.log((c ? "OUI " : "NON ") + x); };
  ok(!k.err.length && !t.err.length, "0 erreur JS " + JSON.stringify(k.err.concat(t.err)));
  ok(k.r.api === NOUVELLE && k.r.cle === "cle-kevin", "Kévin : l'appli passe toute seule sur la nouvelle adresse, même clé");
  ok(k.appels.includes("nouveau"), "Kévin : Moi lit bien le nouveau fichier " + JSON.stringify([...new Set(k.appels)]));
  ok(t.r.api === ANCIENNE && !t.appels.includes("nouveau"), "un autre joueur : rien ne change");
  process.exit(ko.length ? 1 : 0); })();
