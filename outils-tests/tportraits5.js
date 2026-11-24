// Contrôle des places à portrait des cartes peintes (5 joueurs depuis l'arrivée de Nicolas).
// node outils-tests/tportraits5.js   (depuis la racine du dépôt, sans navigateur)
// Pour chaque carte peinte utilisée par un circuit et qui a des places à portrait :
//   5 entrées, k = 0..4 tous distincts, chaque cercle dans le cadre (0..W, 0..H), aucun chevauchement (distance ≥ r1 + r2 − 2).
// Sort en code 1 si un contrôle échoue.
const fs = require("fs"), path = require("path");
const racine = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(racine, "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, PEINTS };\n  window.Piste = {");
global.window = { matchMedia: () => ({ matches: true }) }; eval(src);
const { echantillonner, zones, TRACES, PEINTS } = window.__P;
let echecs = 0, cartes = 0;
const vus = new Set();
for (const id of Object.keys(TRACES)) {
  const def = TRACES[id]; if (!def.peint || !PEINTS[def.peint] || vus.has(def.peint)) continue; vus.add(def.peint);
  const T = echantillonner(def), C = PEINTS[def.peint].peindre(T, zones(T), def), P = C.portraits;
  if (!P) { console.log(`—   ${def.peint.padEnd(11)} pas de place à portrait`); continue; }
  cartes++;
  const pb = [];
  if (P.length !== 5) pb.push(`${P.length} places au lieu de 5`);
  const ks = P.map(p => p.k).sort((a, b) => a - b).join(",");
  if (ks !== "0,1,2,3,4") pb.push(`k = ${ks} (attendu 0,1,2,3,4)`);
  P.forEach(p => {
    if (![p.x, p.y, p.r].every(Number.isFinite) || p.r <= 0) pb.push(`k ${p.k} : position invalide`);
    else if (p.x - p.r < 0 || p.y - p.r < 0 || p.x + p.r > C.W || p.y + p.r > C.H) pb.push(`k ${p.k} hors cadre (${p.x}, ${p.y}, r ${p.r})`);
  });
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < a.r + b.r - 2) pb.push(`k ${a.k} et k ${b.k} se chevauchent (distance ${d.toFixed(1)} < ${(a.r + b.r - 2).toFixed(1)})`);
  }
  if (pb.length) { echecs++; console.log(`NON ${def.peint.padEnd(11)} ${pb.join(" ; ")}`); }
  else console.log(`OUI ${def.peint.padEnd(11)} 5 places, k 0..4, dans le cadre, sans chevauchement (r ${[...new Set(P.map(p => p.r))].join("/")})`);
}
console.log(`\n${cartes} cartes à portraits contrôlées, ${echecs} en échec.`);
process.exit(echecs || !cartes ? 1 : 0);
