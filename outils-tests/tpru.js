/* Test (préparé, 25/11) · « Vérifie ton prix de revient » (Théo, 25/11) : il avait saisi un achat de test et touché « Enregistrer » en attendant
   qu'on lui propose de vérifier le PRU : rien n'existait. Désormais :
   1. avant « Enregistrer » (étape « Relire » d'un achat) : le PRU de la ligne après cet achat (prix moyen pondéré, frais compris) et
      l'écart avec le PRU actuel du fichier ; nouvelle ligne : « nouvelle ligne » ; mode discret : aucun prix ;
   2. après l'enregistrement : rappel « À faire » + cloche « Vérifie le PRU de FDE sur ton compte en ligne : l'appli trouve … » ;
      ✅ Conforme le range ; ✏️ Corriger ouvre l'Historique sur cet ordre (surligné) ; supprimer l'ordre retire le rappel.
   Fausses données, serveur Google intercepté. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tpru.js  (PORT=…, CAPTURES=dossier) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const ACHAT = { date: "2026-06-01", enveloppe: "Linxea Test", type: "Achat", actif: "FDE", quantite: 2, montant: 123.45, frais: null };
function moi(enregistre) {
  const journal = [{ ligne: 50, date: "2026-11-20", enveloppe: "PEA Test", type: "Achat", actif: "DCAM", quantite: 10, montant: 55, frais: null, app: false }];
  if (enregistre) journal.push(Object.assign({ ligne: 40, app: true }, ACHAT));
  return { ok: true, version: 14, genere: "2026-11-25T10:00:00", majTexte: "", versusLie: false, anomalies: "", rappel: "", marches: "",
    synthese: { valeur: 2000, apports: 1800, gain: 200, gainPct: 0.1 }, indices: [], enveloppes: [{ nom: "Linxea Test", type: "env", valeur: 600, gain: 0, gainPct: 0, twr: 0 }],
    groupes: [], fiscalite: [], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
    parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
    ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }, { nom: "Linxea Test", regime: "AV", perimetre: "Portefeuille", statut: "Ouvert" }],
      types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }],
      actifs: [{ code: "DCAM", nom: "Monde" }, { code: "FDE", nom: "Fonds test" }, { code: "NEUF", nom: "Fonds neuf" }], cours: { DCAM: 5.5, FDE: 60, NEUF: 20 },
      detenu: [{ env: "PEA Test", code: "DCAM", qte: 300, pru: 5 }, { env: "Linxea Test", code: "FDE", qte: 10, pru: 50 }], journal, journalSuite: 0, raccourcis: [] } };
}
const versus = { ok: true, genere: "2026-11-25T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Devlin", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Devlin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
const PARTIEL = { type: "Achat", env: "Linxea Test", envChoisi: true, actif: "FDE", qte: "2", qteTape: true, montant: "123,45", frais: "0", date: "2026-06-01", dateChoisie: true, apport: false, auto: false };

async function jusquARelire(p, partiel) {
  await p.evaluate(x => Moi.saisir(x), partiel); await p.waitForTimeout(300); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));
  for (let n = 0; n < 4 && !(await p.$("#m-pru:not([hidden]), .m-etape-4")); n++) {
    for (const b of await p.$$("#m-alertes [data-conf]")) await b.click().catch(() => {});
    if (await p.$('[data-apport="0"]')) await p.click('[data-apport="0"]');
    await p.click("#f-envoyer"); await p.waitForTimeout(250);
  }
}

/* ---------- relecture moi-patrimoine (25/11) : cas où le calcul depuis la ligne d'aujourd'hui serait faux ---------- */
async function casDifficiles(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  const S = { journal: [], detenu: [{ env: "Linxea Test", code: "FDE", qte: 10, pru: 50 }], suite: 0, genere: "2026-11-25T10:00:00" };
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
  await p.route("https://script.google.com/**", r => {
    const c = JSON.parse(r.request().postData() || "{}"), estMoi = /FAUXMOI/.test(r.request().url());
    let corps = versus;
    if (estMoi && c.action === "ordre") corps = { ok: true, message: "Ordre enregistré." };
    else if (estMoi) { corps = moi(false); corps.genere = S.genere; corps.ref.journal = S.journal; corps.ref.detenu = S.detenu.concat([{ env: "PEA Test", code: "DCAM", qte: 300, pru: 5 }]);
      if (S.suite === null) delete corps.ref.journalSuite; else corps.ref.journalSuite = S.suite; }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(corps) });
  });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.guideOrdre", "1");
    localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
  await p.goto("http://localhost:" + PORT + "/index.html");
  await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const pru = () => p.evaluate(() => { const e = document.querySelector("#m-pru"); return e && !e.hidden ? e.innerText.replace(/\s+/g, " ") : ""; });
  const relire = async () => { await p.evaluate(() => { const s = document.getElementById("m-saisie"); if (s) s.hidden = true; Moi.rafraichir(true); }); await p.waitForTimeout(900); };
  /* coût de revient du fichier plutôt que quantité × PRU arrondi : (500,40 + 123,45) ÷ 12 = 51,9875 */
  S.detenu = [{ env: "Linxea Test", code: "FDE", qte: 10, pru: 50.04, cout: 500.37 }]; await relire();
  await jusquARelire(p, PARTIEL);
  let t = await pru(); ok(/51,985\s?€/.test(t), "coût de revient du fichier (500,37 €) utilisé, pas 10 × PRU arrondi (50,04) : 51,985 € et non 51,9875 €", t);
  /* (1) deux achats de la même ligne enchaînés avant relecture du fichier */
  await p.click("#f-envoyer"); await p.waitForTimeout(1200);   // le fichier « relu » ne contient pas encore l'achat (S.journal vide)
  await jusquARelire(p, Object.assign({}, PARTIEL, { qte: "1", montant: "70", date: "2026-11-24" }));
  t = await pru(); ok(/sera recalculé après relecture/.test(t) && !/\d+,\d{4}/.test(t), "2e achat de la même ligne avant relecture : pas de chiffre faux (« sera recalculé après relecture »)", t);
  S.journal = [Object.assign({ ligne: 40, app: true }, ACHAT)]; S.detenu = [{ env: "Linxea Test", code: "FDE", qte: 12, pru: 51.99, cout: 623.85 }]; await relire();
  await jusquARelire(p, Object.assign({}, PARTIEL, { qte: "1", montant: "70", date: "2026-11-24" }));
  t = await pru(); ok(/(623,85|51,99)/.test(t) || /PRU de FDE après cet achat : 53,3731/.test(t), "fichier relu : le calcul repart du fichier à jour ((623,85 + 70) ÷ 13 = 53,3731 €)", t);
  /* (2) achat daté avant une vente de la même ligne */
  S.journal = [Object.assign({ ligne: 40, app: true }, ACHAT), { ligne: 41, date: "2026-07-01", enveloppe: "Linxea Test", type: "Vente", actif: "FDE", quantite: 3, montant: 180, frais: null, app: false }]; await relire();
  await jusquARelire(p, Object.assign({}, PARTIEL, { qte: "1", montant: "55" }));
  t = await pru(); ok(/recalculé par ton fichier/.test(t) && !/\d+,\d{4}/.test(t), "achat du 01/06 avant une vente du 01/07 : pas de chiffre (« recalculé par ton fichier »)", t);
  for (const x of await p.$$("#m-alertes [data-conf]")) await x.click().catch(() => {});
  await p.click("#f-envoyer"); await p.waitForTimeout(400);
  S.genere = "2026-11-25T10:00:05"; S.detenu = [{ env: "Linxea Test", code: "FDE", qte: 9, pru: 52.5 }]; await relire(); await p.evaluate(() => Moi.rafraichir(false)); await p.waitForTimeout(300);
  const af = (await p.evaluate(() => Moi._pru().cloche)).join(" | ");
  ok(/PRU de FDE sur ton compte en ligne : l'appli trouve 52,50/.test(af), "rappel : le PRU du fichier relu (52,50 €), pas un chiffre calculé", af);
  /* journal trop court pour savoir (ancien fichier : 30 lignes, toutes après le 01/06) */
  S.suite = null; S.journal = Array.from({ length: 30 }, (_, k) => ({ ligne: 100 + k, date: "2026-11-" + String(1 + k % 28).padStart(2, "0"), enveloppe: "PEA Test", type: "Achat", actif: "DCAM", quantite: 1, montant: 5, frais: null, app: false }));
  S.detenu = [{ env: "Linxea Test", code: "FDE", qte: 10, pru: 50 }]; await relire();
  await jusquARelire(p, Object.assign({}, PARTIEL, { env: "PEA Test", actif: "DCAM", qte: "1", montant: "6" }));   // ligne sans ordre en attente : seul le journal trop court joue
  t = await pru(); ok(/recalculé par ton fichier/.test(t), "journal trop court pour voir le 01/06 : pas de chiffre", t);
  /* relecture moi-code-donnees : un rappel (date, quantité, montant) ne passe jamais d'un fichier à un autre */
  const cles = () => p.evaluate(() => Object.keys(localStorage).filter(k => /^versus\.moi\.verifPru\./.test(k)));
  const k0 = await cles();
  ok(k0.length === 1 && (await p.evaluate(() => Moi._pru().verifs.length)) === 1, "avant : 1 rappel PRU rangé pour ce fichier", k0);
  await p.evaluate(k => { const l = JSON.parse(localStorage.getItem(k)); l.push(Object.assign({}, l[0], { id: "pruautre", src: "https://script.google.com/macros/s/AUTRE/exec", code: "AUTRE" })); localStorage.setItem(k, JSON.stringify(l)); }, k0[0]);
  ok((await p.evaluate(() => Moi._pru().verifs.map(x => x.code))).join() === "FDE", "un rappel produit par un autre fichier n'est jamais montré");
  await p.evaluate(() => Moi.oublier()); await p.waitForTimeout(200);
  ok(!(await cles()).length, "« Oublier » : plus aucune clé versus.moi.verifPru.* dans le téléphone");
  await p.evaluate(() => { Moi.connecter("https://script.google.com/macros/s/FAUXMOI2/exec", "autre-cle"); Moi.rafraichir(true); }); await p.waitForTimeout(1200);
  const apres = await p.evaluate(() => ({ pru: Moi._pru(), texte: document.body.innerText }));
  ok(!apres.pru.verifs.length && !apres.pru.taches && !apres.pru.cloche.some(x => /PRU/.test(x)) && !/Vérifie le PRU/.test(apres.texte) && !(await cles()).length,
    "autre fichier branché : aucun rappel PRU, aucune date ni montant de l'ancien", apres.pru);
  ok(!err.length, "cas difficiles · 0 erreur JS", err.slice(0, 3));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme }), p = await ctx.newPage(), err = [], envois = [];
    let enregistre = false;
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date("2026-11-25T10:00:00"));
    await p.route("https://script.google.com/**", r => {
      const c = JSON.parse(r.request().postData() || "{}"), estMoi = /FAUXMOI/.test(r.request().url());
      if (estMoi && c.action && c.action !== "data") envois.push(c);
      if (estMoi && c.action === "ordre") enregistre = true;
      if (estMoi && c.action === "supprimer") enregistre = false;
      const corps = !estMoi ? versus : c.action === "ordre" ? { ok: true, message: "Ordre enregistré ligne 40." } : c.action === "supprimer" ? { ok: true, message: "Ordre supprimé." } : moi(enregistre);
      r.fulfill({ contentType: "application/json", body: JSON.stringify(corps) });
    });
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.moi.guideOrdre", "1");
      localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "cle-de-test"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi [data-m-ong]"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    /* 1. avant « Enregistrer » */
    await jusquARelire(p, PARTIEL);
    const t1 = await p.evaluate(() => { const e = document.querySelector("#m-pru"); return e && !e.hidden ? e.innerText.replace(/\s+/g, " ") : ""; });
    // (10 × 50 + 123,45) ÷ 12 = 51,9542 € ; écart +1,9542 €
    ok(/PRU de FDE après cet achat : 51,9542/.test(t1) && /fichier : 50,00/.test(t1) && /\+1,9542/.test(t1), theme + " · avant « Enregistrer » : PRU après l'achat 51,9542 € (fichier 50,00 €, écart +1,9542 €)", t1);
    ok(!!(await p.$("#f-envoyer")) && /Enregistrer/.test(await p.evaluate(() => document.querySelector("#f-envoyer").textContent)), theme + " · le PRU est affiché à l'étape où se trouve « Enregistrer »");
    const larg = await p.evaluate(() => document.documentElement.scrollWidth); ok(larg <= 390, theme + " · lisible à 390 px", larg);
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + "/pru-relire-" + theme + ".png" });
    if (theme === "light") {
      await p.evaluate(() => { ETAT.discret = "oui"; }); await jusquARelire(p, PARTIEL);
      const td = await p.evaluate(() => { const e = document.querySelector("#m-pru"); return e ? e.innerText : ""; });
      ok(/•••/.test(td) && !/51,95|50,00/.test(td), "mode discret : aucun prix affiché (•••)", td);
      await p.evaluate(() => { ETAT.discret = "non"; }); await jusquARelire(p, PARTIEL);
    }
    /* 2. enregistrer → rappel */
    await p.click("#f-envoyer"); await p.waitForTimeout(1500);
    ok(envois.filter(c => c.action === "ordre").length === 1, theme + " · l'ordre est envoyé une fois");
    await p.evaluate(() => { const s = document.getElementById("m-saisie"); if (s) s.hidden = true; }); await p.evaluate(() => Moi.rafraichir(false));
    await p.waitForTimeout(300);
    let af = await p.evaluate(() => (document.querySelector("#v-moi .m-afaire") || {}).innerText || "");
    ok(/Vérifie le PRU de FDE sur ton compte en ligne : l'appli trouve 51,9542/.test(af.replace(/\s+/g, " ")) && /Conforme/.test(af) && /Corriger/.test(af), theme + " · après l'enregistrement : rappel « Vérifie le PRU de FDE… 51,9542 € » avec ✅ Conforme / ✏️ Corriger", af.slice(0, 200));
    const cl = await p.evaluate(() => Moi._pru().cloche);
    ok(cl.some(x => /PRU de FDE/.test(x)), theme + " · la cloche signale la vérification", cl);
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + "/pru-rappel-" + theme + ".png", fullPage: true });
    /* ✏️ Corriger → Historique sur cet ordre */
    await p.click("[data-pru-corr]"); await p.waitForTimeout(500);
    const jr = await p.evaluate(() => { const c = document.querySelector("#m-pane-journal .jr.cible"); return { cible: c ? c.innerText.replace(/\s+/g, " ") : "", note: (document.querySelector(".m-jcible") || {}).innerText || "", vis: !document.getElementById("m-pane-journal").hidden }; });
    ok(jr.vis && /01\/06/.test(jr.cible) && /123,45/.test(jr.cible) && /surligné/.test(jr.note), theme + " · ✏️ Corriger : l'Historique s'ouvre, l'achat du 01/06 est surligné", jr);
    if (theme === "light") {
      // supprimer l'ordre depuis l'Historique retire le rappel
      await p.click("#j-cible [data-suppr]"); await p.waitForTimeout(150); await p.click("#j-cible [data-suppr]"); await p.waitForTimeout(1200);
      const reste = await p.evaluate(() => Moi._pru().taches);
      ok(envois.some(c => c.action === "supprimer" && c.ordre.montant === 123.45) && reste === 0, "ordre supprimé : le rappel de PRU disparaît aussi", reste);
    } else {
      await p.evaluate(() => { const s = document.getElementById("m-saisie"); if (s) s.hidden = true; }); await p.evaluate(() => Moi.rafraichir(false));
      await p.waitForTimeout(300);
      await p.click("[data-pru-ok]"); await p.waitForTimeout(300);
      af = await p.evaluate(() => (document.querySelector("#v-moi .m-afaire") || {}).innerText || "");
      ok(!/PRU de FDE/.test(af) && await p.evaluate(() => !Moi._pru().cloche.some(x => /PRU/.test(x))), "✅ Conforme : le rappel est rangé (À faire et cloche)", af.slice(0, 120));
    }
    /* nouvelle ligne (pas encore détenue) */
    if (theme === "light") {
      await jusquARelire(p, Object.assign({}, PARTIEL, { actif: "NEUF", qte: "5", montant: "100" }));
      const t3 = await p.evaluate(() => { const e = document.querySelector("#m-pru"); return e && !e.hidden ? e.innerText.replace(/\s+/g, " ") : ""; });
      ok(/PRU de NEUF après cet achat : 20,00/.test(t3) && /nouvelle ligne/.test(t3), "nouvelle ligne : PRU = montant ÷ quantité (20,00 €), « nouvelle ligne »", t3);
      await p.evaluate(() => Moi.saisir({ type: "Vente", env: "Linxea Test", actif: "FDE", qte: "1", montant: "60", date: "2026-11-24", auto: false })); await p.waitForTimeout(300);
      ok(!(await p.$("#m-pru:not([hidden])")), "vente : pas de calcul de PRU (une vente ne le change pas)");
    }
    ok(!err.length, theme + " · 0 erreur JS", err.slice(0, 3));
    await ctx.close();
  }
  await casDifficiles(b);
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
