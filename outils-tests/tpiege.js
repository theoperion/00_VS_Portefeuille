/* Test v20.62 · 🗺️ l'affichette du 1er du mois (piège ou règle spéciale), avec la révélation du mini-jeu du mois.
   Une fois par mois et par joueur, jamais avant sa date, pas de doublon le 1/1 (la révélation des 12 circuits en tient lieu),
   jamais deux fenêtres l'une sur l'autre, ordre : nouvelles règles → affichette → mini-jeu. Règles : le mois en cours en évidence.
   Fausses données uniquement (tmj-commun.js, textes de mini-jeu inventés). Serveur local ouvert : python3 -m http.server 8771 &
   puis node outils-tests/tpiege.js (PORT=… pour un autre port, CAPTURES=… pour le dossier des captures). */
const { chromium, DOSSIER, ETAT, MJ_ETAT, page, compteur, fin } = require("./tmj-commun.js");
const VUES = {}; ["circuits", "pioche", "monaco", "pieges", "gpspeciaux", "prono", "pole", "defi", "rival", "regularite", "vote", "equipe", "serie", "finale"].forEach(id => { VUES["versus.nouveaute." + id] = "1"; });
const JOUEUR = { role: "perso", nom: "Clément" };
// suit chaque fenêtre ouverte (affichette, nouvelles règles, mini-jeu) et le nombre maximum ouvertes en même temps
const SUIVI = () => { window.FEN = []; window.FEN_MAX = 0; const scan = () => {
  const f = [...document.querySelectorAll(".tuto, .revel")]; window.FEN_MAX = Math.max(window.FEN_MAX, f.length);
  f.forEach(x => { if (!x.dataset.suivi) { x.dataset.suivi = "1"; window.FEN.push(x.querySelector(".pg-aff") ? "piege" : x.classList.contains("mj-rev") ? "mj" : /12 circuits sont dévoilés/.test(x.innerText) ? "nouveautes+circuits" : x.querySelector(".tuto-c") ? "tuto:" + x.innerText.slice(0, 30) : "autre"); } });
}; scan(); new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); };
const fen = p => p.evaluate(() => ({ l: window.FEN || [], max: window.FEN_MAX || 0, txt: (document.querySelector(".pg-aff") || {}).textContent || "" }));
async function ouvrir(b, quand, mois, jusqua, o) {
  const r = await page(b, Object.assign({ quand, session: JOUEUR, jusqua, piege: true, stock: VUES, mj: () => MJ_ETAT(mois, ETAT()) }, o || {}));
  await r.p.evaluate(SUIVI); await r.p.waitForTimeout(4500); return r;
}
const fermer = async (p, sel) => { await p.click(sel); await p.waitForTimeout(4500); };
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  // 1. avant la saison : rien, même en appelant la fonction
  { const { ctx, p, err } = await ouvrir(b, "2026-12-31T23:30:00", 202701, 202611, { mj: () => ({ ok: true, ouvert: false }) });
    const r = await p.evaluate(() => ({ voir: typeof piegeDuMoisAVoir === "function" ? piegeDuMoisAVoir() : "absente", cle: Object.keys(localStorage).filter(k => k.startsWith("versus.piegeMois")) }));
    const f = await fen(p);
    ok(!err.length && r.voir === null && !r.cle.length && !f.l.includes("piege"), "31/12/2026 23:30 : aucune affichette, rien de noté " + JSON.stringify([r, f.l, err])); await ctx.close(); }
  // 2. le 1/1 : la grande révélation (12 circuits) puis le mini-jeu ; pas d'affichette de janvier en double
  { const { ctx, p, err } = await ouvrir(b, "2027-01-01T10:00:00", 202701, 202612, { stock: {} });
    const a = await fen(p); ok(a.l[0] === "nouveautes+circuits", "1/1 : d'abord les nouvelles règles avec les 12 circuits " + JSON.stringify(a.l));
    await fermer(p, '[data-nv="ok"]');
    const f = await fen(p); ok(!err.length && !f.l.includes("piege") && f.l[f.l.length - 1] === "mj" && f.max === 1, "1/1 : puis le mini-jeu, sans affichette de janvier en double, une seule fenêtre à la fois " + JSON.stringify([f, err]));
    await ctx.close(); }
  // 3. les 1/2, 1/5, 1/6, 1/12 : l'affichette, puis le mini-jeu ; une seule fois
  const CAS = [
    { d: "2027-02-01T09:00:00", m: 202702, j: 202701, att: [/Ce mois-ci · février 2027/i, /🏰 Château aux sortilèges/, /Couloirs mouvants/, /3,1 % et 3,2 %/, /Piège du mois/i], capt: "piege-1fev" },
    { d: "2027-05-01T09:00:00", m: 202705, j: 202704, att: [/sur Pandora/, /La forêt endormie/, /Turbo interdite/, /Piège du mois/i], un: "🌿" },
    { d: "2027-06-01T09:00:00", m: 202706, j: 202705, att: [/Bataille spatiale/, /Le Côté obscur/, /2 points au moins/, /au moins 2/, /Règle spéciale du mois/i], capt: "piege-1juin" },
    { d: "2027-12-01T09:00:00", m: 202712, j: 202711, att: [/Le Multivers/, /Finale · le Rassemblement des héros/, /Règle spéciale du mois/i] }
  ];
  for (const c of CAS) {
    for (const sombre of c.capt ? [false, true] : [false]) {
      const { ctx, p, err } = await ouvrir(b, c.d, c.m, c.j, { sombre });
      const a = await fen(p), j = c.d.slice(0, 10);
      if (c.capt) await p.screenshot({ path: DOSSIER + "/" + c.capt + "-" + (sombre ? "sombre" : "clair") + ".png" });
      if (!sombre) {
        ok(a.l[0] === "piege" && a.l.length === 1 && c.att.every(r => r.test(a.txt)), j + " : l'affichette d'abord, seule, avec " + c.att.join(" ") + " " + JSON.stringify([a.l, a.txt.replace(/\s+/g, " ")]));
        if (c.un) ok(a.txt.split(c.un).length - 1 === 1, j + " : " + c.un + " une seule fois");
        if (c.m !== 202712) ok(!/Finale/.test(a.txt), j + " : pas de Finale");
        await fermer(p, '[data-pg="ok"]');
        const f = await fen(p); ok(!err.length && f.l.join(">") === "piege>mj" && f.max === 1, j + " : puis le mini-jeu, jamais deux fenêtres ensemble " + JSON.stringify([f.l, f.max, err]));
        // revenir le même mois : plus d'affichette
        const p2 = await ctx.newPage(); await p2.goto("http://localhost:" + (process.env.PORT || 8771) + "/index.html"); await p2.evaluate(SUIVI); await p2.waitForTimeout(5000);
        const g = await fen(p2); ok(!g.l.includes("piege"), j + " : rouvrir l'appli le même mois : plus d'affichette " + JSON.stringify(g.l));
        // les règles : le mois en cours en évidence
        if (c.m === 202702) {
          await p2.evaluate(() => { document.querySelectorAll(".tuto, .revel").forEach(x => x.remove()); ouvrirRegles(); });
          const r = await p2.evaluate(() => ({ haut: (document.querySelector(".regles .rg-actuel") || {}).innerText || "", ligne: (document.querySelector(".regles .rg-tab > div.actuel") || {}).innerText || "" }));
          ok(/Ce mois-ci · février 2027/i.test(r.haut) && /Couloirs mouvants/.test(r.haut) && /Château aux sortilèges/.test(r.ligne), "règles du 1/2 : le piège de février en haut et sa ligne en évidence " + JSON.stringify(r).replace(/\\n/g, " "));
          for (const sch of ["light", "dark"]) { await p2.emulateMedia({ colorScheme: sch }); await p2.waitForTimeout(300); await p2.screenshot({ path: DOSSIER + "/regles-1fev-" + (sch === "light" ? "clair" : "sombre") + ".png" }); }
        }
        if (c.m === 202706) {
          await p2.evaluate(() => { document.querySelectorAll(".tuto, .revel").forEach(x => x.remove()); ouvrirRegles(); });
          const r = await p2.evaluate(() => (document.querySelector(".regles .rg-actuel") || {}).innerText || "");
          ok(/Le Côté obscur/.test(r) && /au moins 2/.test(r), "règles du 1/6 : le Côté obscur en haut " + r.replace(/\s+/g, " "));
        }
      }
      await ctx.close();
    }
  }
  // 4. le 15/2, premier passage du mois : l'affichette de février quand même (une fois), jamais celle de mars
  { const { ctx, p, err } = await ouvrir(b, "2027-02-15T09:00:00", 202702, 202701, { revVu: true });
    const a = await fen(p); ok(!err.length && a.l[0] === "piege" && /Couloirs mouvants/.test(a.txt) && !/Chapelier/.test(a.txt), "15/2 sans être venu le 1er : l'affichette de février " + JSON.stringify(a.l)); await ctx.close(); }
  await b.close(); fin(ko);
})();
