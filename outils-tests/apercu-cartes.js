// Aperçu des cartes peintes (fond + couche animée figée), une image PNG par carte, pour vérifier une retouche à l'œil.
// node outils-tests/apercu-cartes.js <dossier> [clé1 clé2 …]   (sans clé : toutes)
const fs = require("fs"), path = require("path"), { chromium } = require("playwright");
const racine = path.resolve(__dirname, ".."), dest = path.resolve(process.argv[2] || "/tmp/cartes"), veut = process.argv.slice(3); fs.mkdirSync(dest, { recursive: true });
const src = fs.readFileSync(path.join(racine, "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, PEINTS };\n  window.Piste = {");
global.window = { matchMedia: () => ({ matches: true }) }; eval(src);
const { echantillonner, zones, TRACES, PEINTS } = window.__P;
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1080, height: 720 } })).newPage(), vus = new Set();
  for (const id of Object.keys(TRACES)) {
    const def = TRACES[id]; if (!def.peint || !PEINTS[def.peint] || vus.has(def.peint) || (veut.length && !veut.includes(def.peint))) continue; vus.add(def.peint);
    const T = echantillonner(def), C = PEINTS[def.peint].peindre(T, zones(T), def), svg = path.join(dest, def.peint + ".svg");
    fs.writeFileSync(svg, C.fond.replace(/<\/svg>\s*$/, "") + (C.anim || "") + "</svg>"); await p.goto("file://" + svg); await p.waitForTimeout(200); await p.screenshot({ path: path.join(dest, def.peint + ".png") }); fs.unlinkSync(svg);
    console.log(def.peint);
  }
  await b.close();
})();
