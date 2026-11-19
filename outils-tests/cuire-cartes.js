// V16.17 · « cuit » le fond de chaque carte peinte en image WebP (img/cartes/<clé>.webp) et écrit img/cartes/cartes.js.
// À relancer après toute retouche d'un peintre dans piste.js :  node outils-tests/cuire-cartes.js   (depuis la racine du dépôt)
// Le fond vectoriel (100 à 600 Ko, redessiné à chaque image) devient une image fixe ; la couche animée reste en SVG.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"), { chromium } = require("playwright");
const racine = path.resolve(__dirname, ".."), dest = path.join(racine, "img/cartes"); fs.mkdirSync(dest, { recursive: true });
const src = fs.readFileSync(path.join(racine, "piste.js"), "utf8").replace("window.Piste = {", "window.__P = { echantillonner, zones, TRACES, PEINTS };\n  window.Piste = {");
global.window = { matchMedia: () => ({ matches: true }) }; eval(src);
const { echantillonner, zones, TRACES, PEINTS } = window.__P;
const hache = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = (h * 33 ^ t.charCodeAt(i)) >>> 0; return h.toString(36); };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1620, height: 1080 } })).newPage(), liste = {}, vus = new Set();
  for (const id of Object.keys(TRACES)) {
    const def = TRACES[id]; if (!def.peint || !PEINTS[def.peint] || vus.has(def.peint)) continue; vus.add(def.peint);
    const T = echantillonner(def), C = PEINTS[def.peint].peindre(T, zones(T), def), svg = path.join(dest, "_tmp.svg"), png = path.join(dest, "_tmp.png");
    fs.writeFileSync(svg, C.fond.replace('width="1080" height="720"', 'width="1620" height="1080"'));
    await p.goto("file://" + svg); await p.waitForTimeout(150); await p.screenshot({ path: png });
    execFileSync("python3", ["-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2],'WEBP',quality=80,method=6)", png, path.join(dest, def.peint + ".webp")]);
    liste[def.peint] = hache(C.fond); console.log(def.peint.padEnd(11), Math.round(fs.statSync(path.join(dest, def.peint + ".webp")).size / 1024) + " Ko (vectoriel : " + Math.round(C.fond.length / 1024) + " Ko)");
  }
  ["_tmp.svg", "_tmp.png"].forEach(f => { try { fs.unlinkSync(path.join(dest, f)); } catch (e) { } });
  fs.writeFileSync(path.join(dest, "cartes.js"), "/* GÉNÉRÉ par outils-tests/cuire-cartes.js : fonds peints cuits en WebP (clé → empreinte du dessin). */\nself.CARTES_CUITES = " + JSON.stringify(liste) + ";\n");
  await b.close();
})();
