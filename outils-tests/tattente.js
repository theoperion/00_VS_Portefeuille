/* Test v20.37 · (1) Moi : fichier avec historique mais sans ligne → encadré « Tes lignes arrivent », pas de gros 0 € ; témoin avec lignes.
   (2) Mise à jour automatique : nouvelle version en ligne → l'appli se recharge seule une fois (pas en pleine saisie : bandeau).
   (3) Réglage Vibrations retiré. Fausses données uniquement ; serveur local ouvert (python3 -m http.server 8771). */
const { chromium } = require("playwright");
const versus = { ok: true, version: 84, genere: "2026-11-24T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: [{ nom: "Kévin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Kévin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const L = { code: "ESE", nom: "S&P 500", valeur: 1000, pct: 0.01, jour: 10, qte: 30, pru: 30 };
const ANO = { retard: "⚠ Relevé automatique en retard (dernier : 30/10) → Extensions › Apps Script › exécuter « snapshotQuotidien »", deux: "⚠ Relevé automatique en retard (dernier : 30/10) → exécuter « snapshotQuotidien »     ▸ 2 ordre(s) sans montant → dans Ordres, remplis la colonne" };
const moi = (avec, ano) => ({ ok: true, version: 13, genere: "2026-11-24T10:00:00", majTexte: "", versusLie: true, anomalies: ano || "", rappel: "", marches: "",
  synthese: { valeur: avec ? 1000 : 0, apports: avec ? 900 : 0, jour: avec ? 10 : null, jourPct: avec ? 0.01 : null, twr: 0.2, mwr: 0.1, epargne: 500 },
  indices: [], enveloppes: [{ nom: "PEA", type: "env", valeur: avec ? 1000 : 0 }], groupes: avec ? [{ env: "PEA", total: { valeur: 1000 }, lignes: [L] }] : [{ env: "PEA", total: { valeur: 0 }, lignes: [] }],
  fiscalite: [], epargne: [{ nom: "Livret A", solde: 500 }, { nom: "Total épargne", solde: 500 }], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [], taux: {}, fondsEuros: {}, artema: { suivi: false }, appart: null }, prets: null, alertes: [], perfLignes: null,
  historique: { cols: ["Date", "Valeur"], rows: [[20261030, 800, 700, 100, 100], [20261124, 800, 700, 101, 101]] }, ref: { enveloppes: [], actifs: [], journal: [] }, signal: null });
async function page(b, opts) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: opts.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(opts.avec, opts.ano) : versus) }));
  if (opts.nouvelle) await p.route(/version\.js\?t=/, r => r.fulfill({ contentType: "text/javascript", body: 'self.VERSUS_VERSION = { app: "99.0", date: "" };' }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi-jour" })); });
  return { ctx, p, err };
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    for (const avec of [false, true]) {
      const { ctx, p, err } = await page(b, { sombre, avec }); await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(3500);
      await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
      const r = await p.evaluate(() => ({ att: !!document.querySelector("#v-moi .m-attente"), flaps: !!document.querySelector("#v-moi .m-flaps"), env: /mes enveloppes/i.test(document.querySelector("#v-moi").innerText),
        deb: [...document.querySelectorAll("#v-moi .m-attente *")].some(x => x.getBoundingClientRect().right > innerWidth + 1) }));
      if (!avec) await p.locator("#v-moi .m-hero").first().screenshot({ path: "/tmp/attente-" + (sombre ? "sombre" : "clair") + ".png" }).catch(() => {});
      ok(!err.length, "0 erreur JS" + (avec ? " (avec lignes)" : " (sans ligne)") + tag + " " + JSON.stringify(err));
      if (!avec) ok(r.att && !r.flaps && r.env && !r.deb, "sans ligne : encadré « Tes lignes arrivent », pas de gros 0 €, enveloppes toujours là, rien ne déborde" + tag);
      else ok(!r.att && r.flaps, "témoin avec lignes : le gros chiffre normal, pas d'encadré" + tag);
      await ctx.close();
    }
  }
  for (const [avec, ano, attendu, texte] of [[false, "retard", "rien", "sans ligne : l'alerte « relevé en retard » est masquée"], [false, "deux", "autre", "sans ligne : les AUTRES anomalies restent visibles"], [true, "retard", "retard", "avec lignes : l'alerte « relevé en retard » revient toute seule"]]) {
    const { ctx, p, err } = await page(b, { avec, ano: ANO[ano] }); await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(3500);
    const n = await p.evaluate(() => { const d = document.createElement("div"); d.innerHTML = window.Moi.notifications(); return d.innerText; });
    const ret = /Relevé automatique en retard/.test(n), autre = /ordre\(s\) sans montant/.test(n), carte = /Anomalie dans tes saisies/.test(n);
    ok(!err.length && (attendu === "rien" ? !carte : attendu === "autre" ? carte && autre && !ret : carte && ret), texte);
    await ctx.close();
  }
  { const { ctx, p } = await page(b, { avec: true, nouvelle: true }); let charges = 0; p.on("load", () => charges++);
    await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(9000);
    ok(charges === 2, "nouvelle version en ligne : l'appli se recharge toute seule, une seule fois (" + charges + " chargements)");
    const v = await p.evaluate(() => { ouvrirReglages(); return { vib: !!document.querySelector("[data-vibre-choix]"), txt: document.querySelector("#reglages").innerText }; });
    ok(!v.vib && !/Vibration/i.test(v.txt) && /Tester le son/.test(v.txt), "Réglages : plus de choix « Vibrations », bouton « Tester le son »");
    await ctx.close(); }
  { const { ctx, p } = await page(b, { avec: true, nouvelle: true }); let charges = 0; p.on("load", () => charges++);
    await p.addInitScript(() => { try { sessionStorage.setItem("versus.majAuto", "x"); } catch (e) {} });
    await p.goto("http://localhost:8771/index.html"); await p.waitForTimeout(1500);
    await p.evaluate(() => ouvrirReglages()); await p.waitForTimeout(3000);
    const band = await p.evaluate(() => { const x = document.querySelector("#maj-band"); return x && !x.hidden ? x.innerText : ""; });
    ok(charges === 1 && /99\.0 disponible/.test(band), "en pleine saisie / réglages ouverts : pas de rechargement, le bandeau « Mettre à jour » s'affiche");
    await ctx.close(); }
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
