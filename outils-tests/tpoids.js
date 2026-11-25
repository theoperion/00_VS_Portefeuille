/* Test (v20.48) · Poids des décors 3D en MODE LÉGER (téléphone à 4 Go de mémoire ou moins, ex. Firefox Android).
   Sans navigateur : node outils-tests/tpoids.js
   Vérifie : en mode léger, Pandora et le Mur des titans restent sous 120 000 triangles de décor, tous les autres sous 140 000 ;
   le mode léger allège vraiment ces deux décors ; sur ordinateur (mode riche), rien ne change pour les autres. Au-delà d'un plafond : NON. */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, construire, ambiance };\n  window.Piste = {");
global.window = {}; eval(src);
const { echantillonner, zones, TRACES, construire, ambiance } = window.__P;
const tris = g => g.d.length / 30 + (g.o ? g.o.d.length / 30 : 0);
function mesure(id, leger) {
  window.VERSUS_LEGER = leger;
  const def = TRACES[id], T = echantillonner(def), t0 = Date.now(), S = construire(def, T, ambiance(def, "soleil", ""), zones(T));
  return { tri: Math.round(tris(S.sol)), ms: Date.now() - t0 };
}
const LEGERS = { miami: "Pandora", interlagos: "Mur des titans" }, PLAF_LEGER = 120000, PLAF = 140000;
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
for (const id of Object.keys(TRACES)) {
  const l = mesure(id, true), plaf = LEGERS[id] ? PLAF_LEGER : PLAF;
  ok(l.tri <= plaf, (LEGERS[id] || id) + " en mode léger : " + l.tri + " triangles (plafond " + plaf + "), construit en " + l.ms + " ms");
  if (LEGERS[id]) { const r = mesure(id, false); ok(r.tri > l.tri * 1.08, LEGERS[id] + " : le mode léger allège le décor (" + r.tri + " → " + l.tri + " triangles, " + Math.round((1 - l.tri / r.tri) * 100) + " % de moins)"); }
}
console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
