/* Test v21.06 · bandeau « cours qui ne se met plus à jour » sur Aujourd'hui (Moi).
   Le fichier envoie coursAlerte (code, nom, date, source ; jamais un montant) quand Boursorama ne répond plus depuis plus de 5 jours
   ou qu'un cours Google est figé / en erreur plus de 5 jours de bourse.
   - joueur (Clément) : « Le cours de … ne se met plus à jour automatiquement depuis le JJ/MM (cours de secours utilisé, or suivi via Google). Préviens Théo… » ;
   - Théo (admin) : ce qu'il faut faire (CoursBourso, cours manuel, ticker) ;
   - sans alerte : aucun bandeau ; rien ne déborde à 390 px, clair et sombre ; 0 erreur JS.
   Fausses données, script.google.com intercepté. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tcours-secours.js  (PORT=…) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771;
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const ALERTES = [{ code: "XAD1", nom: "Or couvert (AV)", depuis: "2026-11-20", source: "suiveur", suivi: "or" },
  { code: "PUST", nom: "Nasdaq-100 PEA", depuis: "2026-11-16", source: "google", motif: "fige", suivi: "" }];
const moi = alertes => ({ ok: true, version: 14, genere: "2026-11-26T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null, coursAlerte: alertes,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }], types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }],
    actifs: [{ code: "DCAM", nom: "Monde" }], cours: {}, detenu: [], journal: [], raccourcis: [] } });
const versus = session => ({ ok: true, genere: "2026-11-26T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Clément", rows: [] }, { nom: "Théo", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} });
(async () => {
  const b = await chromium.launch(), err = [];
  const ouvrir = async (session, alertes, schema) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: schema || "light" });
    await ctx.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi(alertes) : versus(session)) }));
    await ctx.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
      localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" })); });
    const p = await ctx.newPage(); p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => window.Moi && document.querySelector("#v-moi .m-onglets"), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
    const e = await p.evaluate(() => { const x = document.querySelector("#v-moi .m-secours"), r = x && x.getBoundingClientRect(), cs = x && getComputedStyle(x);
      return { txt: x ? x.innerText : "", n: x ? x.querySelectorAll("p").length : 0, deb: x ? r.left < 0 || r.right > innerWidth + 1 || x.scrollWidth > x.clientWidth + 1 : false,
        avantAfaire: !!x && !(x.compareDocumentPosition(document.querySelector("#v-moi .m-onglets")) & Node.DOCUMENT_POSITION_FOLLOWING), fond: cs ? cs.backgroundColor : "", encre: cs ? cs.color : "", pageDeb: document.documentElement.scrollWidth > innerWidth + 1 }; });
    return { p, ctx, e };
  };
  // 1. Joueur (Clément)
  let o = await ouvrir({ role: "perso", nom: "Clément" }, ALERTES), e = o.e;
  ok(e.n === 2, "Joueur : un bandeau avec une ligne par cours concerné (2)", e);
  ok(/Le cours de Or couvert \(AV\) ne se met plus à jour automatiquement depuis le 20\/11 \(cours de secours utilisé, or suivi via Google\)\. Préviens Théo pour qu'il regarde\./.test(e.txt), "Joueur : texte Boursorama « … depuis le 20/11 (cours de secours utilisé, or suivi via Google). Préviens Théo pour qu'il regarde. »", e.txt);
  ok(/Le cours de Nasdaq-100 PEA ne se met plus à jour depuis le 16\/11\. Préviens Théo/.test(e.txt), "Joueur : texte cours Google figé « … ne se met plus à jour depuis le 16/11. Préviens Théo »", e.txt);
  ok(!/CoursBourso|ticker/i.test(e.txt), "Joueur : pas de consigne technique", e.txt);
  ok(!/\d+[.,]\d+\s?€|€/.test(e.txt), "Aucun montant dans le bandeau", e.txt);
  ok(!e.deb && !e.pageDeb && e.avantAfaire, "Rien ne déborde à 390 px (clair), bandeau sous les onglets", e);
  await o.p.locator("#v-moi .m-secours").screenshot({ path: "/tmp/tcours-secours-joueur.png" }).catch(() => {}); await o.ctx.close();
  // 2. Théo (admin) : ce qu'il faut faire
  o = await ouvrir({ role: "admin" }, ALERTES); e = o.e;
  ok(/depuis le 20\/11 \(cours de secours utilisé, or suivi via Google\)\. Vérifie CoursBourso \(testerBourso/.test(e.txt) && /mets le cours manuel/.test(e.txt), "Théo : « Vérifie CoursBourso (testerBourso…) ou mets le cours manuel »", e.txt);
  ok(/Nasdaq-100 PEA ne se met plus à jour depuis le 16\/11\. Vérifie son ticker/.test(e.txt) && !/Préviens Théo/.test(e.txt), "Théo : cours Google figé → « Vérifie son ticker… », jamais « Préviens Théo »", e.txt);
  await o.ctx.close();
  // 3. Sombre
  o = await ouvrir({ role: "perso", nom: "Clément" }, ALERTES, "dark"); e = o.e;
  ok(e.n === 2 && !e.deb && !e.pageDeb && e.fond !== e.encre, "Sombre : bandeau lisible, rien ne déborde", e);
  await o.p.locator("#v-moi .m-secours").screenshot({ path: "/tmp/tcours-secours-sombre.png" }).catch(() => {}); await o.ctx.close();
  // 4. Sans alerte (ou ancien script sans coursAlerte) : rien
  o = await ouvrir({ role: "perso", nom: "Clément" }, []); ok(o.e.n === 0 && !o.e.txt, "Sans alerte : aucun bandeau", o.e); await o.ctx.close();
  o = await ouvrir({ role: "perso", nom: "Clément" }, undefined); ok(o.e.n === 0, "Ancien script (pas de coursAlerte) : aucun bandeau", o.e); await o.ctx.close();
  // 5. Dernier cours / cours manuel
  o = await ouvrir({ role: "perso", nom: "Clément" }, [{ code: "ALTAUX", nom: "Altaux", depuis: "2026-11-19", source: "manuel" }]);
  ok(/Altaux ne se met plus à jour automatiquement depuis le 19\/11 \(cours manuel utilisé\)/.test(o.e.txt), "Sans suiveur : « (cours manuel utilisé) »", o.e.txt); await o.ctx.close();
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
