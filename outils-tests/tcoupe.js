/* Test v20.42-43 · « La Coupe brisée » : écran des 12 éclats, compteur cliquable, révélation à la trouvaille, aperçu admin inventé.
   Fausses données uniquement (le vrai contenu est privé, côté serveur) ; serveur local ouvert (python3 -m http.server 8771). */
const { chromium } = require("playwright"), fs = require("fs");
const CIRC = ["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza"];
// v20.43 : Coupe PERSONNELLE (vue de Théo) : janvier trouvé en 2e, février en 1er, mars manqué (2 autres l'ont), avril pas encore
const COUPE = { prologue: "PROLOGUE-FAUX", n: 2, eclats: CIRC.map((c, i) => i < 2 ? { circuit: c, mois: i + 1, etat: "trouve", rang: [2, 1][i], nb: [2, 1][i], premier: ["Kévin", "Théo"][i], matiere: "MATIERE-" + i, couleur: "#E8B04A", symbole: ["◇", "○"][i], texte: "TEXTE-FAUX-" + i }
  : i === 2 ? { circuit: c, mois: 3, etat: "manque", nb: 2, premier: "Clément" } : { circuit: c, mois: i + 1, etat: "avenir", nb: i === 3 ? 1 : 0, premier: i === 3 ? "Devlin" : null }) };
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
      const o = document.querySelector(".coupe-b"); return { n: c && c.n, txt: o ? o.innerText : "", ecl: o ? o.querySelectorAll(".cb-svg [data-ec]").length : 0, trouve: o ? o.querySelectorAll(".cb-ec.e-trouve").length : 0, manque: o ? o.querySelectorAll(".cb-ec.e-manque").length : 0,
        deb: o ? [...o.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > innerWidth + 1) : true }; });
    await p.locator(".coupe-b .rg-c").screenshot({ path: "/tmp/coupe-" + (sombre ? "sombre" : "clair") + ".png" });
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    ok(r.n === 2 && r.ecl === 12 && r.trouve === 2 && r.manque === 1, "la Coupe (personnelle) : 12 éclats, 2 trouvés par moi en couleur, 1 manqué, 9 à venir" + tag);
    ok(/PROLOGUE-FAUX/.test(r.txt) && /TEXTE-FAUX-0/.test(r.txt) && /trouvé en 2e/.test(r.txt) && /trouvé en premier 🥇/.test(r.txt) && /◇ ○/.test(r.txt) && /te manquera pour l'énigme\. 2 pilotes l'ont trouvé \(le 1er : Clément\)/.test(r.txt) && /1 pilote l'a trouvé \(le 1er : Devlin\)/.test(r.txt) && !r.deb, "mes textes et mes signes seulement, « trouvé en premier / en 2e », éclat manqué sans contenu, combien l'ont trouvé ; rien ne déborde à 390 px" + tag);
    // trouvaille : l'éclat se révèle et la Coupe passe à 4
    const v = await p.evaluate(async () => { document.querySelectorAll(".coupe-b").forEach(x => x.remove());
      const e = { circuit: "suzuka", matiere: "MATIERE-3", couleur: "#CFE3EE", symbole: "◎", texte: "TEXTE-REVELE" }; noterEclat(e, "Théo", 2); revelerEclat(e); await new Promise(r => setTimeout(r, 300));
      const o = document.querySelector(".cb-rev"), t = o ? o.innerText : ""; o.querySelector("[data-cb-voir]").click(); await new Promise(r => setTimeout(r, 300));
      return { t, n: coupeDonnees().n, liste: document.querySelector(".coupe-b") ? document.querySelector(".coupe-b").innerText : "" }; });
    ok(/Éclat de MATIERE-3/.test(v.t) && /TEXTE-REVELE/.test(v.t) && v.n === 3 && /TEXTE-REVELE/.test(v.liste) && /trouvé en 2e · 2 pilotes l'ont/.test(v.liste), "trouvaille : révélation de l'éclat, puis « Voir la Coupe » le montre (3/12, trouvé en 2e)" + tag);
    await ctx.close(); }
  { const { ctx, p, err } = await page(b, { role: "admin" }, "2026-11-25T10:00:00", false, true);
    const a = await p.evaluate(async () => { try { montrerVue("trophees"); } catch (e) { } await new Promise(r => setTimeout(r, 500)); const bt = document.querySelector("[data-bacoupe]"); if (bt) bt.click(); await new Promise(r => setTimeout(r, 300));
      const o = document.querySelector(".coupe-b"); return { bouton: !!bt, txt: o ? o.innerText : "" }; });
    ok(!err.length && a.bouton && /exemple inventé/i.test(a.txt), "admin : bouton « Aperçu · La Coupe brisée », exemple inventé"); await ctx.close(); }
  { const { ctx, p } = await page(b, { role: "perso", nom: "Théo" }, "2027-04-03T10:00:00", false, false);   // v20.44 : le bouton retour ferme la cérémonie dorée
    const f = await p.evaluate(async () => { TRESORS = null; TRESORS_T = 0; await chargerTresors(); ceremonieEclat({ circuit: "suzuka", matiere: "M", couleur: "#CFE3EE", symbole: "◎", texte: "T" }, coupeDonnees(), 3);
      const avant = !!document.querySelector(".cb-or"); fermerFenetreOuverte(); return { avant, apres: !!document.querySelector(".cb-or") }; });
    ok(f.avant && !f.apres, "le bouton retour ferme la cérémonie dorée du premier trouveur"); await ctx.close(); }
  { const { ctx, p } = await page(b, { role: "perso", nom: "Clément" }, "2026-12-15T10:00:00", false, false);   // pendant la chauffe : pas de mention du Flair (nouveauté de janvier)
    const t = await p.evaluate(() => { ceremonieEclat({ circuit: "abudhabi", matiere: "M", couleur: "#CFE3EE", texte: "T" }, null, -1); const o = document.querySelector(".cb-or"); return o ? o.innerText : ""; });
    ok(t && !/Flair|titre/i.test(t), "15/12/2026 : la cérémonie du premier trouveur ne parle pas encore du Flair"); await ctx.close(); }
  { const { ctx, p } = await page(b, { role: "perso", nom: "Clément" }, "2026-12-20T10:00:00", false, true);
    const j = await p.evaluate(() => { apercuCoupe(); return !!document.querySelector(".coupe-b"); }); ok(!j, "joueur : l'aperçu admin ne s'ouvre pas"); await ctx.close(); }
  await b.close();
  const src = ["js/4-grandprix.js", "js/3-podium.js"].map(f => fs.readFileSync(f, "utf8")).join("");
  ok(!/mithril|sève lumineuse|vitrail de lune|porcelaine de théière|sable doré|cristal rouge/i.test(src), "aucun texte secret de la Coupe dans le dépôt public");
  process.exit(ko.length ? 1 : 0);
})();
