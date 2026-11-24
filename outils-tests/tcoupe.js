/* Test v20.42 · « La Coupe brisée » : écran des 12 éclats, compteur cliquable, révélation à la trouvaille, aperçu admin inventé.
   Fausses données uniquement (le vrai contenu est privé, côté serveur) ; serveur local ouvert (python3 -m http.server 8771). */
const { chromium } = require("playwright"), fs = require("fs");
const CIRC = ["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza"];
const COUPE = { prologue: "PROLOGUE-FAUX", n: 3, eclats: CIRC.map((c, i) => i < 2 ? { circuit: c, mois: i + 1, etat: "trouve", par: "Kévin", matiere: "MATIERE-" + i, couleur: "#E8B04A", symbole: "◇", texte: "TEXTE-FAUX-" + i }
  : i === 2 ? { circuit: c, mois: 3, etat: "terne", matiere: "MATIERE-2", couleur: "#9DB4E8", symbole: "○", texte: "TEXTE-FAUX-2" } : { circuit: c, mois: i + 1, etat: "avenir" }) };
const versus = s => ({ ok: true, version: 84, genere: "2027-04-03T10:00:00", majTexte: "", enveloppes: ["PEA"], personnes: ["Théo", "Kévin", "Clément", "Devlin"].map(nom => ({ nom, rows: [] })),
  marche: { indices: ["S&P 500"], mois: [], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" }, marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
  ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {}, liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null,
  session: s, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
async function page(b, s, quand, sombre, admin) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 2, coupe: COUPE }) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(versus(s)) }); });
  await p.addInitScript(a => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); if (a) sessionStorage.setItem("versus.adminOn", "1"); }, admin);
  await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  return { ctx, p, err };
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) { const tag = sombre ? " (sombre)" : " (clair)";
    const { ctx, p, err } = await page(b, { role: "perso", nom: "Théo" }, "2027-04-03T10:00:00", sombre, false);
    const r = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); const c = coupeDonnees(); ouvrirCoupe(); await new Promise(r => setTimeout(r, 400));
      const o = document.querySelector(".coupe-b"); return { n: c && c.n, txt: o ? o.innerText : "", ecl: o ? o.querySelectorAll(".cb-svg [data-ec]").length : 0, trouve: o ? o.querySelectorAll(".cb-ec.e-trouve").length : 0, terne: o ? o.querySelectorAll(".cb-ec.e-terne").length : 0,
        deb: o ? [...o.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > innerWidth + 1) : true }; });
    await p.locator(".coupe-b .rg-c").screenshot({ path: "/tmp/coupe-" + (sombre ? "sombre" : "clair") + ".png" });
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(r.n === 3 && r.ecl === 12 && r.trouve === 2 && r.terne === 1, "la Coupe : 12 éclats, 2 trouvés en couleur, 1 terne, 9 à venir" + tag);
    ok(/PROLOGUE-FAUX/.test(r.txt) && /TEXTE-FAUX-0/.test(r.txt) && /rendu par Kévin/.test(r.txt) && /◇ ◇ ○/.test(r.txt) && !/TEXTE-FAUX-3/.test(r.txt) && !r.deb, "prologue, textes, « rendu par », signes réunis ; rien d'un éclat à venir ; rien ne déborde à 390 px" + tag);
    // trouvaille : l'éclat se révèle et la Coupe passe à 4
    const v = await p.evaluate(async () => { document.querySelectorAll(".coupe-b").forEach(x => x.remove());
      const e = { circuit: "suzuka", matiere: "MATIERE-3", couleur: "#CFE3EE", symbole: "◎", texte: "TEXTE-REVELE" }; noterEclat(e, "Théo"); revelerEclat(e); await new Promise(r => setTimeout(r, 300));
      const o = document.querySelector(".cb-rev"), t = o ? o.innerText : ""; o.querySelector("[data-cb-voir]").click(); await new Promise(r => setTimeout(r, 300));
      return { t, n: coupeDonnees().n, liste: document.querySelector(".coupe-b") ? document.querySelector(".coupe-b").innerText : "" }; });
    ok(/Éclat de MATIERE-3/.test(v.t) && /TEXTE-REVELE/.test(v.t) && v.n === 4 && /rendu par Théo/.test(v.liste), "trouvaille : révélation de l'éclat, puis « Voir la Coupe » le montre (4/12, rendu par Théo)" + tag);
    await ctx.close(); }
  { const { ctx, p, err } = await page(b, { role: "admin" }, "2026-11-25T10:00:00", false, true);
    const a = await p.evaluate(async () => { try { montrerVue("trophees"); } catch (e) { } await new Promise(r => setTimeout(r, 500)); const bt = document.querySelector("[data-bacoupe]"); if (bt) bt.click(); await new Promise(r => setTimeout(r, 300));
      const o = document.querySelector(".coupe-b"); return { bouton: !!bt, txt: o ? o.innerText : "" }; });
    ok(!err.length && a.bouton && /exemple inventé/i.test(a.txt), "admin : bouton « Aperçu · La Coupe brisée », exemple inventé"); await ctx.close(); }
  { const { ctx, p } = await page(b, { role: "perso", nom: "Clément" }, "2026-12-20T10:00:00", false, true);
    const j = await p.evaluate(() => { apercuCoupe(); return !!document.querySelector(".coupe-b"); }); ok(!j, "joueur : l'aperçu admin ne s'ouvre pas"); await ctx.close(); }
  await b.close();
  const src = ["js/4-grandprix.js", "js/3-podium.js"].map(f => fs.readFileSync(f, "utf8")).join("");
  ok(!/mithril|sève lumineuse|vitrail de lune|porcelaine de théière|sable doré|cristal rouge/i.test(src), "aucun texte secret de la Coupe dans le dépôt public");
  process.exit(ko.length ? 1 : 0);
})();
