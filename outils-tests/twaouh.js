/* Test (25/11/2026) · RECETTE WAOUH (brume, lumière propre, rayons, sols par zones, ombres de contact, décor lointain) sur 11 circuits ;
   Envers, Odyssée, Chocolaterie et Multivers sont en brouillon (WAOUH_BROUILLON, non appliqué : rendu d'avant, mot pour mot).
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/twaouh.js   (PORT=… pour un autre port)
   Trésors : APP_SCRIPTS=/chemin/vers/app_scripts node outils-tests/twaouh.js  lit versus/Tresors.js (dépôt PRIVÉ) pour vérifier les cachettes ;
   sans APP_SCRIPTS, cette vérification est sautée (aucune position de cachette n'est écrite dans ce dépôt public, ni affichée par ce test).
   Vérifie : 1. (sans navigateur) les 11 circuits ont leur ligne, chaque univers sa brume ; les brouillons aucune couche ajoutée ;
   budgets : couches transparentes ≤ 30 000 triangles (≤ 16 000 en mode léger), décor lointain ≤ 1 200 triangles ; mode léger = moitié moins de rayons ;
   le décor lointain va jusqu'à l'horizon (plus aucun bord du monde) ; trésors : rien de neuf à moins de 15 m d'une cachette, ou effacé au rendu dès que
   le trésor est là (tresorEvite) ; 2. (navigateur) chaque circuit : recette allumée, 0 erreur JS ; pluie : pas de rayons ; Dune : tempête et orage
   inchangés ; « réduire les animations » : la recette reste ; trésor du mois présent : la recette s'efface autour de lui. Fausses données uniquement. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const AVEC_N = ["silverstone", "djeddah", "abudhabi", "melbourne", "suzuka", "arene2028", "miami", "montreal", "bahrein", "interlagos", "monaco"];
const PORT = process.env.PORT || 8771, ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const src = fs.readFileSync(path.join(__dirname, "..", "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, construire, ambiance, WAOUH };\n  window.Piste = {");
global.window = {}; eval(src);
const { echantillonner, zones, TRACES, construire, ambiance, WAOUH } = window.__P;
const scene = (id, leger) => { window.VERSUS_LEGER = leger; const def = TRACES[id], T = echantillonner(def); return { S: construire(def, T, ambiance(def, "soleil", ""), zones(T)), T }; };
const AVEC = ["silverstone", "djeddah", "abudhabi", "melbourne", "suzuka", "arene2028", "miami", "montreal", "bahrein", "interlagos", "monaco"], ids = AVEC, recette = id => TRACES[id].waouh || WAOUH[TRACES[id].decor];
// 1. une ligne par circuit, une ambiance par univers
const sans = ids.filter(id => !recette(id));
ok(!sans.length, AVEC.length + " circuits ont leur recette (Envers, Odyssée, Chocolaterie, Multivers : brouillons non appliqués) " + JSON.stringify(sans));
const autres = Object.keys(TRACES).filter(id => AVEC.indexOf(id) < 0), avecCouche = autres.filter(id => { if (recette(id)) return true; const s = scene(id, false).S; return s.voile.n + s.lueur.n + s.rayons.n > 0; });
ok(!avecCouche.length, "les " + autres.length + " autres circuits : aucune recette, rendu d'avant " + JSON.stringify(avecCouche));
const decors = [...new Set(ids.map(id => TRACES[id].decor))], brumes = decors.map(d => WAOUH[d] && WAOUH[d].brume && WAOUH[d].brume.col);
ok(new Set(brumes).size === decors.length, "chaque univers a SA brume (" + decors.length + " couleurs différentes, pas la même partout)");
ok(decors.every(d => WAOUH[d].horizon && WAOUH[d].sol), "chaque univers a son décor lointain et ses sols par zones");
// 2. budgets, mode léger, horizon
const R = {}, L = {};
ids.forEach(id => { R[id] = scene(id, false); L[id] = scene(id, true); });
const tr = S => (S.voile.n + S.lueur.n + S.rayons.n) / 3;
ids.forEach(id => {
  const r = R[id].S, l = L[id].S, W = recette(id);
  ok(tr(r) <= 30000 && tr(l) <= 16000, id + " : couches transparentes " + tr(r) + " triangles (léger " + tr(l) + ")");
  if (W.rayons && r.rayons.n) ok(l.rayons.n <= r.rayons.n * .6, id + " : mode léger = moitié moins de rayons (" + r.rayons.n / 3 + " → " + l.rayons.n / 3 + ")");
  const T = R[id].T, ext = Math.max(T.rx, T.rz) * 3.2 + 600, d = r.sol.d; let rmax = 0;
  for (let i = 0; i < d.length; i += 10) { const q = Math.hypot(d[i] - T.cx, d[i + 2] - T.cz); if (q > rmax) rmax = q; }
  const H = W.horizon; W.horizon = null; const sh = scene(id, false).S.sol; W.horizon = H; const nh = (r.sol.d.length - sh.d.length) / 30;   // triangles du décor lointain seul
  ok(nh <= 1200 && rmax > ext + 1500, id + " : décor lointain jusqu'à " + Math.round(rmax) + " m (" + nh + " triangles)");
});
// 3. les trésors (dépôt privé, seulement si APP_SCRIPTS est défini)
function tresors() {
  const A = process.env.APP_SCRIPTS; if (!A) return null; let t = "";
  try { t = cp.execSync("git -C " + JSON.stringify(A) + " show origin/main:versus/Tresors.js", { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { t = fs.readFileSync(path.join(A, "versus", "Tresors.js"), "utf8"); }   // la version à jour du serveur d'abord (git fetch avant)
  const L = []; t.replace(/circuit: '(\w+)', type: '\w+', p: \[([^\]]+)\]/g, (m, c, p) => { L.push({ c, p: p.split(",").map(Number) }); return m; }); return L;
}
function proche(S, P) {   // distance de la cachette à chaque triangle des couches de la recette (échantillonné finement)
  let m = 1e9; [S.voile, S.lueur, S.rayons].forEach(g => { const d = g.d; for (let i = 0; i < d.length; i += 21) { const Q = [0, 7, 14].map(k => [d[i + k], d[i + k + 1], d[i + k + 2]]);
    if (Math.min(...Q.map(q => Math.hypot(q[0] - P[0], q[2] - P[2]))) > 900) continue;
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) { const u = a / 6, v = b / 6, w = 1 - u - v; m = Math.min(m, Math.hypot(Q[0][0] * u + Q[1][0] * v + Q[2][0] * w - P[0], Q[0][2] * u + Q[1][2] * v + Q[2][2] * w - P[2])); } } });
  return m; }
const TR = tresors(), MASQUE = /tresorEvite\(o\.circuit\)/.test(src) && /\[t\.p\[0\], t\.p\[2\], 16, 1\]/.test(src) && /FS_VOILE = .*smoothstep\(1\.,1\.4,length\(vEv\)\)/.test(src)
  && /\[\[0, false, [^\]]*\], \[1, true, 1\], \[2, true,/.test(src);   // le même masque (rayon 16 m) pour les 3 couches : ombres et voiles (0), flaques (1), rayons (2)   // le masque au rendu (rayon 16 m)
if (!TR) console.log("(APP_SCRIPTS non défini : vérification des cachettes sautée)");
else {
  ok(TR.length >= 8, "trésors lus dans le dépôt privé : " + TR.length);
  TR.forEach(t => { if (AVEC.indexOf(t.c) < 0) return; const m = proche(R[t.c].S, t.p);   // la position ne vient QUE du dépôt privé et n'est jamais affichée
    ok(m >= 15 || MASQUE, t.c + " : " + (m >= 15 ? "rien de la recette à moins de 15 m de la cachette" : "ombres, rayons ou voiles près de la cachette, effacés au rendu dans un rayon de 16 m dès que le trésor est là")); });
}
(async () => {
  const { chromium } = require("playwright");
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const essai = async (reduit, f, arg) => { const ctx = await b.newContext({ viewport: { width: 390, height: 300 }, reducedMotion: reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message)); await p.setContent('<div id="b" style="width:390px;height:300px;position:relative"></div>'); await p.addScriptTag({ url: "http://localhost:" + PORT + "/piste.js" });
    const r = await p.evaluate(f, arg); await ctx.close(); return { r, err }; };
  const monter = (circuit, meteo, ambiance) => { const b = document.getElementById("b"); if (window.__a) window.__a.detruire(); b.innerHTML = "";
    return window.__a = Piste.monter(b, { circuit, meteo, ambiance, camera: "helico", effets: true, voitures: [{ nom: "A", couleur: "#4C9AFF" }], pts: { A: 1 } }); };
  const F = "const monter = " + monter.toString() + ";", attendre = "await new Promise(r => setTimeout(r, 500));";
  const a = await essai(false, new Function("return (async () => {" + F + "const o = {}; o.soleil = monter('silverstone', 'soleil').waouh(); " + attendre +
    "o.orage = monter('silverstone', 'orage'); o.orageW = o.orage.waouh(); o.orageM = o.orage.meteo(); o.pluie = monter('silverstone', 'pluie').waouh(); o.nuit = monter('silverstone', 'soleil', 'monaco').waouh();" +
    "o.tous = {}; for (const id of Object.keys(Piste.TRACES)) { const x = monter(id, 'soleil'); " + attendre + " o.tous[id] = x.waouh(); }" +
    "o.pluieJour = monter('djeddah', 'pluie').waouh(); o.orage = null; return o; })()"));
  const r = a.r;
  ok(r.soleil && r.soleil.brume && r.soleil.sol && r.soleil.rayons && r.soleil.voile, "Dune au soleil : brume, sols par zones, rayons du soleil et voiles allumés " + JSON.stringify(r.soleil));
  ok(r.orageW && !r.orageW.rayons && r.orageW.brume && r.orageM === "sable", "Dune sous l'orage : tempête de sable toujours visible (" + r.orageM + "), brume épaissie, pas de rayons");
  ok(r.pluie && !r.pluie.rayons, "Dune « pluie » (tempête de sable) : pas de rayons");
  ok(r.nuit && !r.nuit.rayons, "Dune avec le filtre de nuit du joueur : pas de rayons");
  const AV = AVEC_N, eteints = AV.filter(id => !(r.tous[id] && r.tous[id].brume && r.tous[id].sol && r.tous[id].voile));
  ok(!eteints.length, AV.length + " circuits : recette allumée (brume, sols, ombres ou voiles) " + JSON.stringify(eteints));
  const sansR = Object.keys(r.tous).filter(id => AV.indexOf(id) < 0 && r.tous[id]);
  ok(!sansR.length, "les " + (Object.keys(r.tous).length - AV.length) + " circuits en brouillon : aucune recette au rendu " + JSON.stringify(sansR));
  ok(r.tous.djeddah.rayons && !r.tous.abudhabi.rayons, "rayons du soleil sur le Château (jour) ; pas sur l'Atelier (soir de fête)");
  ok(r.pluieJour && !r.pluieJour.rayons && r.pluieJour.brume, "Château sous la pluie : pas de rayons, la brume reste");
  const c = await essai(true, new Function("return (async () => {" + F + "return [monter('silverstone', 'soleil').waouh(), monter('abudhabi', 'soleil').waouh()]; })()"));
  ok(c.r.every(x => x && x.brume && x.sol), "« réduire les animations » : la recette reste (rayons fixes, paillettes fixes)");
  const e = await essai(false, new Function("return (async () => {" + F + "window.tresorDuCircuit = ci => ci === 'djeddah' ? { p: [0, 0, 0] } : null; const x = monter('djeddah', 'soleil'); " + attendre + " const a = x.waouh().evite;" +
    "window.tresorDuCircuit = () => null; const y = monter('djeddah', 'soleil'); " + attendre + " return [a, y.waouh().evite]; })()"));
  ok(e.r[0] === true && e.r[1] === false, "trésor du mois présent (exemple inventé) : ombres, rayons et nappes s'effacent autour de sa cachette ; sans trésor, rien d'effacé");
  ok(!a.err.length && !c.err.length && !e.err.length, "0 erreur JS " + JSON.stringify(a.err.concat(c.err, e.err)));
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
