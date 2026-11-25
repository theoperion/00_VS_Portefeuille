/* Test (25/11/2026) · RECETTE WAOUH (brume, rayons du soleil, sols par zones, voiles transparents), d'abord sur Dune (silverstone, janvier 2027).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/twaouh.js   (PORT=… pour un autre port)
   Vérifie : 1. (sans navigateur) rien de la recette (voiles, ombres, rayons) à moins de 15 m de la cachette du trésor de janvier ; les autres circuits
   n'ont aucune couche transparente ; mode léger = moitié moins de rayons ; 2. (navigateur) Dune : recette allumée (brume, sols, rayons) ;
   tempête de sable et orage : pas de rayons, la tempête reste visible ; « réduire les animations » : recette toujours là ; les 14 autres circuits : aucune recette ;
   0 erreur JS. Fausses données uniquement (aucune donnée de joueur). */
const fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 8771, ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const src = fs.readFileSync(path.join(__dirname, "..", "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, construire, ambiance };\n  window.Piste = {");
global.window = {}; eval(src);
const { echantillonner, zones, TRACES, construire, ambiance } = window.__P;
const TRESOR = [436, .4, 475];   // versus/Tresors.js (serveur) : le krys de janvier, dans la mâchoire du squelette de ver
const scene = (id, leger) => { window.VERSUS_LEGER = leger; const def = TRACES[id], T = echantillonner(def); return construire(def, T, ambiance(def, "soleil", ""), zones(T)); };
function prochesTresor(g) {   // distance du trésor à chaque triangle (échantillonné finement)
  let m = 1e9; const d = g.d; for (let i = 0; i < d.length; i += 21) { const P = [0, 7, 14].map(k => [d[i + k], d[i + k + 1], d[i + k + 2]]);
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8 - a; b++) { const u = a / 8, v = b / 8, w = 1 - u - v, q = [0, 1, 2].map(j => P[0][j] * u + P[1][j] * v + P[2][j] * w); m = Math.min(m, Math.hypot(q[0] - TRESOR[0], q[1] - TRESOR[1], q[2] - TRESOR[2])); } }
  return m; }
const S = scene("silverstone", false), SL = scene("silverstone", true);
const dm = Math.min(prochesTresor(S.voile), prochesTresor(S.lueur), prochesTresor(S.rayons));
ok(dm >= 15, "trésor de janvier : rien de la recette à moins de 15 m de la cachette (plus proche : " + Math.round(dm) + " m)");
ok(S.rayons.n > 0 && S.voile.n > 0, "Dune : rayons du soleil (" + S.rayons.n / 3 + " triangles) et voiles transparents (" + S.voile.n / 3 + " triangles : ombres de contact, sable arraché aux crêtes)");
ok(SL.rayons.n > 0 && SL.rayons.n <= S.rayons.n * .6, "mode léger : moitié moins de rayons (" + S.rayons.n / 3 + " → " + SL.rayons.n / 3 + " triangles)");
const autres = Object.keys(TRACES).filter(id => id !== "silverstone"), avecCouche = autres.filter(id => { const s = scene(id, false); return s.voile.n + s.lueur.n + s.rayons.n > 0; });
ok(!avecCouche.length, "les " + autres.length + " autres circuits : aucune couche transparente ajoutée " + JSON.stringify(avecCouche));
(async () => {
  const { chromium } = require("playwright");
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const essai = async (reduit, f) => { const ctx = await b.newContext({ viewport: { width: 390, height: 300 }, reducedMotion: reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message)); await p.setContent('<div id="b" style="width:390px;height:300px;position:relative"></div>'); await p.addScriptTag({ url: "http://localhost:" + PORT + "/piste.js" });
    const r = await p.evaluate(f); await ctx.close(); return { r, err }; };
  const monter = (circuit, meteo, ambiance) => { const b = document.getElementById("b"); if (window.__a) window.__a.detruire(); b.innerHTML = "";
    return window.__a = Piste.monter(b, { circuit, meteo, ambiance, camera: "helico", effets: true, voitures: [{ nom: "A", couleur: "#4C9AFF" }], pts: { A: 1 } }); };
  const F = "const monter = " + monter.toString() + ";";
  const a = await essai(false, new Function("return (async () => {" + F + "const o = {}; o.soleil = monter('silverstone', 'soleil').waouh(); await new Promise(r => setTimeout(r, 600));" +
    "o.orage = monter('silverstone', 'orage'); o.orageW = o.orage.waouh(); o.orageM = o.orage.meteo(); o.pluie = monter('silverstone', 'pluie').waouh(); o.nuit = monter('silverstone', 'soleil', 'monaco').waouh();" +
    "o.autres = Object.keys(Piste.TRACES).filter(id => id !== 'silverstone').map(id => [id, monter(id, 'soleil').waouh()]).filter(x => x[1]).map(x => x[0]); o.orage = null; return o; })()"));
  const r = a.r;
  ok(r.soleil && r.soleil.brume && r.soleil.sol && r.soleil.rayons && r.soleil.voile, "Dune au soleil : brume, sols par zones, rayons du soleil et voiles allumés " + JSON.stringify(r.soleil));
  ok(r.orageW && !r.orageW.rayons && r.orageW.brume && r.orageM === "sable", "Dune sous l'orage : tempête de sable toujours visible (" + r.orageM + "), brume épaissie, pas de rayons");
  ok(r.pluie && !r.pluie.rayons, "Dune « pluie » (tempête de sable) : pas de rayons");
  ok(r.nuit && !r.nuit.rayons, "Dune avec le filtre de nuit du joueur : pas de rayons");
  ok(!r.autres.length, "les 14 autres circuits : aucune recette (rendu d'avant) " + JSON.stringify(r.autres));
  const c = await essai(true, new Function("return (async () => {" + F + "return monter('silverstone', 'soleil').waouh(); })()"));
  ok(c.r && c.r.brume && c.r.sol, "« réduire les animations » : la recette reste (rayons fixes, sans respiration)");
  ok(!a.err.length && !c.err.length, "0 erreur JS " + JSON.stringify(a.err.concat(c.err)));
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
