// charge piste.js et expose ses entrailles
const fs = require("fs"), src = fs.readFileSync(process.argv[2] || "piste.js", "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, DEMI, ECH };\n  window.Piste = {");
global.window = {}; global.document = {}; eval(src);
const { echantillonner, zones, TRACES, DEMI } = window.__P;
let ok = true;
for (const id of Object.keys(TRACES)) {
  const def = TRACES[id], T = echantillonner(def), Z = zones(T);
  // recoupements : points non voisins (le long de la piste) trop proches, sauf s'il y a un pont (écart de hauteur)
  let mini = 1e9, ou = null; const fen = Math.ceil(40 / T.ds);
  for (let i = 0; i < T.N; i += 2) for (let j = i + fen; j < T.N - (i < fen ? fen - i : 0); j += 2) {
    const d = Math.hypot(T.X[i] - T.X[j], T.Z[i] - T.Z[j]); if (Math.abs(T.Y[i] - T.Y[j]) > 5) continue; if (d < mini) { mini = d; ou = [i, j]; } }
  let kmax = 0; for (let i = 0; i < T.N; i++) kmax = Math.max(kmax, Math.abs(T.K[i]));
  let ymax = 0; for (let i = 0; i < T.N; i++) ymax = Math.max(ymax, T.Y[i]);
  const k0 = Math.abs(T.K[0]) + Math.abs(T.K[3]) + Math.abs(T.K[T.N - 3]);
  const bad = mini < 2 * DEMI + 14;
  if (bad) ok = false;
  console.log(id.padEnd(11), "L", Math.round(T.L), "écart min", Math.round(mini), bad ? "⚠ RECOUPE" : "", "rayon min", Math.round(1 / kmax), "haut", ymax.toFixed(0), "départ k", k0.toFixed(4), "atout", Math.round(Z.atout.s1 - Z.atout.s0));
}
process.exit(ok ? 0 : 1);
