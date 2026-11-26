/* Test v21.01 · Moi › Missions › Vestiaire : l'explication d'un objet (« ? » ou objet 🔒) s'ouvre dans une bulle JUSTE SOUS la rangée de l'objet
   (comme l'Écurie), plus dans l'encadré du bas.
   - dans chaque grille (Afficheur, Thème, Courbe, Fête, Emblème, Titre) : bulle sous la rangée, flèche à l'aplomb de l'objet, colonne de gauche et de droite ;
   - une seule bulle à la fois ; fermée avec ✕, en touchant ailleurs, avec le bouton retour ;
   - toucher un objet gagné l'équipe toujours ; 0 erreur JS ; rien ne déborde à 390 px, en clair et en sombre.
   Fausses données. Lancer depuis la racine : python3 -m http.server 8771 &  puis  node outils-tests/tvestiaire-bulle.js  (PORT=… CAPT=dossier) */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, CAPT = process.env.CAPT || "/tmp";
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const moi = () => ({ ok: true, version: 14, genere: "2026-11-20T10:00:00", majTexte: "", versusLie: true, anomalies: "", rappel: "", marches: "",
  synthese: { valeur: 10000, apports: 10000, gain: 0, gainPct: 0 }, indices: [], enveloppes: [{ nom: "PEA Test", type: "env", valeur: 10000, gain: 0, gainPct: 0, twr: 0 }],
  groupes: [], fiscalite: [{ nom: "PEA Test", apports: 10000 }], epargne: [], supports: [], histoAV: null, immo: [], versus: null, frais: [], moisParMois: [], cibles: null, objectif: null,
  parametres: { rappels: [] }, prets: null, alertes: [], perfLignes: null, historique: null, signal: null,
  ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }],
    types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }], actifs: [{ code: "DCAM", nom: "Monde" }], cours: {}, detenu: [],
    journal: [{ type: "Apport", enveloppe: "PEA Test", date: "2025-03-12", montant: 200 }, { type: "Achat", enveloppe: "PEA Test", date: "2025-03-13", montant: 200, actif: "DCAM", quantite: 4 }], raccourcis: [] } });
const versus = { ok: true, genere: "2026-11-20T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie"], personnes: [{ nom: "Test", rows: [] }],
  marche: { indices: [], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
  session: { role: "perso", nom: "Test" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
(async () => {
  const b = await chromium.launch(), err = [];
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: theme });
    await ctx.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(/FAUXMOI/.test(r.request().url()) ? moi() : versus) }));
    await ctx.addInitScript(th => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1"); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1");
      localStorage.setItem("versus.theme", th); localStorage.setItem("versus.moi.afficheurs", JSON.stringify(["laiton", "calc", "ticket"]));
      localStorage.setItem("versus.moi.api", "https://script.google.com/macros/s/FAUXMOI/exec"); localStorage.setItem("versus.moi.cle", "x"); localStorage.setItem("versus.etat", JSON.stringify({ ouverture: "moi" }));
      localStorage.setItem("versus.moi.pref", JSON.stringify({ onglet: "missions", vest: "aff" })); }, theme);
    const p = await ctx.newPage(); p.on("pageerror", e => err.push(theme + " : " + e.message));
    await p.clock.setFixedTime(new Date("2026-11-20T10:00:00"));
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => window.Moi && document.querySelector('#v-moi [data-m-ong="missions"]'), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600);
    await p.evaluate(() => document.querySelectorAll(".tuto, .bulle-portrait").forEach(x => x.remove()));
    await p.click('#v-moi [data-m-ong="missions"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { const d = document.querySelector('#v-moi details[data-acc="m-vest"]'); d.open = true; d.scrollIntoView(); });
    await p.waitForTimeout(300);
    const T = " (" + (theme === "light" ? "clair" : "sombre") + ")";
    ok(await p.evaluate(() => !document.querySelector("#v-moi .vs-d")), "Plus d'encadré d'explication en bas de la grille" + T);
    /* mesure de la bulle par rapport à l'objet touché */
    const mesure = sel => p.evaluate(sel => {
      const bu = [...document.querySelectorAll("#v-moi .vs-bulle")], q = document.querySelector(sel), t = q && q.closest(".vs-t");
      if (!bu.length || !t) return { n: bu.length };
      const B = bu[0].getBoundingClientRect(), A = t.getBoundingClientRect(), F = bu[0].querySelector(".eta-fl").getBoundingClientRect(), g = t.parentElement;
      const cases = [...g.querySelectorAll(":scope > .vs-t")], rangee = cases.filter(x => Math.abs(x.getBoundingClientRect().top - A.top) < 2), suivante = cases.find(x => x.getBoundingClientRect().top > A.top + 2);
      return { n: bu.length, sous: B.top >= A.bottom - 1 && B.top - A.bottom < 16, avantSuivante: !suivante || B.bottom <= suivante.getBoundingClientRect().top + 1,
        fleche: Math.abs((F.left + F.right) / 2 - (A.left + A.right) / 2) < 4, dedans: B.left >= 0 && B.right <= innerWidth, rangee: rangee.length,
        txt: bu[0].innerText.slice(0, 80), sel: t.classList.contains("vs-sel") };
    }, sel);
    const SORTES = [["aff", "Afficheur", 4], ["theme", "Thème", 4], ["courbe", "Courbe", 4], ["fete", "Fête", 4], ["emb", "Emblème", 4], ["titre", "Titre", 2]];
    for (const [s, nom, col] of SORTES) {
      await p.click('#v-moi [data-vt="' + s + '"]'); await p.waitForTimeout(250);
      const n = await p.locator("#v-moi .vs-g > .vs-t").count();
      const gauche = n > col ? col : 0, droite = n > col ? Math.min(n - 1, 2 * col - 1) : Math.min(n - 1, col - 1);   // 2e rangée (objets à gagner), sinon la 1re
      for (const [i, cote] of [[gauche, "gauche"], [droite, "droite"]]) {
        const sel = "#v-moi .vs-g > .vs-t:nth-child(" + (i + 1) + ") [data-vsq]";
        await p.click(sel); await p.waitForTimeout(250);
        const m = await mesure(sel);
        ok(m.n === 1 && m.sous && m.avantSuivante && m.fleche && m.dedans && m.sel, nom + " · colonne de " + cote + " : bulle juste sous la rangée, flèche sur l'objet, dans l'écran" + T, m);
        if (s === "emb" && cote === "gauche") await p.locator("#v-moi .vs-g").screenshot({ path: CAPT + "/vestiaire-bulle-" + (theme === "light" ? "clair" : "sombre") + ".png" }).catch(() => {});
      }
      const deb = await p.evaluate(() => [...document.querySelectorAll("#v-moi *")].filter(x => { const r = x.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(x => x.className).slice(0, 3));
      ok(!deb.length, nom + " : rien ne déborde à 390 px" + T, deb);
    }
    /* une seule bulle : en ouvrir une autre ferme la première */
    await p.click('#v-moi [data-vt="emb"]'); await p.waitForTimeout(250);
    await p.click("#v-moi .vs-g > .vs-t:nth-child(1) [data-vsq]"); await p.waitForTimeout(150);
    await p.click("#v-moi .vs-g > .vs-t:nth-child(6) [data-vsq]"); await p.waitForTimeout(150);
    let m = await mesure("#v-moi .vs-g > .vs-t:nth-child(6) [data-vsq]");
    ok(m.n === 1 && m.sous, "Une seule bulle à la fois (la 2e remplace la 1re)" + T, m);
    ok(await p.evaluate(() => document.querySelectorAll("#v-moi .vs-t.vs-sel").length) === 1, "Un seul objet marqué" + T);
    const objet = await p.evaluate(() => /Emblème/.test(document.querySelector("#v-moi .vs-bulle").innerText));
    ok(objet, "Le contenu reste le même (nom, sorte, d'où il vient)" + T, m.txt);
    /* ✕ */
    await p.click("#v-moi .vs-bulle .eta-bx"); await p.waitForTimeout(150);
    ok(await p.locator("#v-moi .vs-bulle").count() === 0 && await p.locator("#v-moi .vs-t.vs-sel").count() === 0, "Fermée avec ✕" + T);
    /* toucher ailleurs */
    await p.click("#v-moi .vs-g > .vs-t:nth-child(2) [data-vsq]"); await p.waitForTimeout(150);
    await p.click("#v-moi .vs-bulle p"); await p.waitForTimeout(150);
    ok(await p.locator("#v-moi .vs-bulle").count() === 1, "Toucher dans la bulle ne la ferme pas" + T);
    await p.click("#v-moi .vs-prof"); await p.waitForTimeout(150);
    ok(await p.locator("#v-moi .vs-bulle").count() === 0, "Fermée en touchant ailleurs" + T);
    /* toucher un objet 🔒 l'explique (bulle) */
    const verrou = await p.evaluate(() => { const c = [...document.querySelectorAll("#v-moi .vs-g > .vs-t")]; return c.findIndex(x => x.classList.contains("verrou")) + 1; });
    if (verrou > 0) { await p.click("#v-moi .vs-g > .vs-t:nth-child(" + verrou + ") [data-vs]"); await p.waitForTimeout(150);
      m = await mesure("#v-moi .vs-g > .vs-t:nth-child(" + verrou + ") [data-vs]"); ok(m.n === 1 && m.sous, "Toucher un objet 🔒 ouvre sa bulle dessous" + T, m); }
    /* bouton retour du téléphone (il faut un vrai geste avant : la garde de retour) */
    await p.click("#v-moi .vs-g > .vs-t:nth-child(3) [data-vsq]"); await p.waitForTimeout(200);
    ok(await p.locator("#v-moi .vs-bulle").count() === 1, "Bulle ouverte avant le retour" + T);
    await p.goBack(); await p.waitForTimeout(400);
    const apres = await p.evaluate(() => ({ bulle: document.querySelectorAll("#v-moi .vs-bulle").length, moi: !document.querySelector("#v-moi").hidden, vest: !!document.querySelector('#v-moi details[data-acc="m-vest"]') }));
    ok(apres.bulle === 0 && apres.moi && apres.vest, "Bouton retour : la bulle se ferme, on reste dans Missions" + T, apres);
    /* toucher un objet gagné l'équipe */
    await p.click('#v-moi [data-vt="aff"]'); await p.waitForTimeout(250);
    await p.click("#v-moi .vs-g > .vs-t:nth-child(1) [data-vsq]"); await p.waitForTimeout(150);
    await p.click('#v-moi [data-vs="aff.calc"]'); await p.waitForTimeout(300);
    const eq = await p.evaluate(() => ({ on: (document.querySelector('#v-moi [data-vs="aff.calc"]') || {}).closest?.(".vs-t")?.classList.contains("on"), pref: JSON.parse(localStorage.getItem("versus.moi.pref") || "{}").afficheur, bulle: document.querySelectorAll("#v-moi .vs-bulle").length }));
    ok(eq.on && eq.pref === "calc" && eq.bulle === 0, "Toucher un objet gagné l'équipe toujours (et ferme la bulle)" + T, eq);
    /* « Équiper » dans la bulle */
    await p.click("#v-moi .vs-g > .vs-t:nth-child(2) [data-vsq]"); await p.waitForTimeout(150);
    await p.click("#v-moi .vs-bulle [data-vs-eq]"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("versus.moi.pref") || "{}").afficheur) === "laiton", "« Équiper » dans la bulle marche" + T);
    await ctx.close();
  }
  ok(!err.length, "0 erreur JS", err.slice(0, 3));
  await b.close();
  console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
  process.exit(ko.length ? 1 : 0);
})();
