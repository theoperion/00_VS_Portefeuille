const fs = require("fs"); const src = fs.readFileSync("piste.js", "utf8").replace("window.Piste = {", "window.__P = { cibles };\n  window.Piste = {");
global.window = {}; eval(src); const { cibles } = window.__P, L = 2000, ordre = process.argv[2] === "5" ? ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"] : ["Théo", "Kévin", "Clément", "Devlin"];   // v20.25 : « node outils-tests/tdep.js 5 » pour 5 voitures
let prev = null, ds = 0, dv = 0, minLat = 99;
for (let i = 0; i <= 400; i++) { const t = i / 400;
  const pts = { Théo: 10 + 6 * t, Kévin: 12 + 2 * t, Clément: 11 + 4 * t, Devlin: 11.5 + 3 * t }; if (ordre.length === 5) pts.Nicolas = 10.5 + 5 * t;   // tout le monde se double vers t = 0,5
  const c = cibles(pts, 25, L, ordre);
  if (prev) for (const n of ordre) { ds = Math.max(ds, Math.abs(c[n].s - prev[n].s)); dv = Math.max(dv, Math.abs(c[n].voie - prev[n].voie)); }
  for (const a of ordre) for (const b of ordre) if (a < b && Math.abs(c[a].s - c[b].s) < 9) minLat = Math.min(minLat, Math.abs(c[a].voie - c[b].voie));
  prev = c; }
console.log("plus grand saut de distance par pas :", ds.toFixed(2), "m · de voie :", dv.toFixed(3), "m · écart latéral mini quand < 9 m :", minLat.toFixed(2), "m");
