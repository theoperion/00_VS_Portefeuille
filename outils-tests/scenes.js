const fs = require("fs"), src = fs.readFileSync("piste.js", "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, construire, ambiance };\n  window.Piste = {");
global.window = { VERSUS_LEGER: process.env.LEGER ? process.env.LEGER === "1" : undefined }; eval(src);
const { echantillonner, zones, TRACES, construire, ambiance } = window.__P;
for (const id of Object.keys(TRACES)) {
  const def = TRACES[id], T = echantillonner(def), A = ambiance(def, "soleil", ""), Z = zones(T), t0 = Date.now();
  const S = construire(def, T, A, Z), tris = g => g.d.length / 30 + (g.o ? g.o.d.length / 30 : 0);
  console.log(id.padEnd(11), "ms", String(Date.now() - t0).padStart(4), "tri sol", Math.round(tris(S.sol)), "piste", Math.round(tris(S.piste)), "lum", S.lum.length);
}
