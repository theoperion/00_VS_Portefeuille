/* Test v20.32 · zoom au doigt de la Visite 3D : pincer, lever un doigt, continuer avec l'autre → la caméra ne saute pas.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tzoom.js */
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 520, height: 400 } })).newPage(), err = []; p.on("pageerror", e => err.push(e.message));
  await p.setContent('<div id="b" style="width:500px;height:380px"></div>'); await p.addScriptTag({ url: "http://localhost:8771/piste.js" });
  const r = await p.evaluate(async () => { const api = Piste.monter(document.getElementById("b"), { circuit: Object.keys(Piste.TRACES)[0], mode: "3d", camera: "helico", voitures: [] });
    const cv = document.querySelector("#b canvas"), ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    await new Promise(r => setTimeout(r, 300)); const z0 = api.zoom();
    ev("pointerdown", 1, 200, 200); ev("pointerdown", 2, 300, 200); ev("pointermove", 2, 310, 200); ev("pointermove", 1, 100, 260); ev("pointermove", 2, 420, 140);   // pincer avec les deux doigts
    const zPince = api.zoom(), o1 = api.orbite ? api.orbite() : null; ev("pointerup", 2, 400, 200); ev("pointermove", 1, 105, 262);           // lever un doigt, bouger un peu l'autre
    const zApres = api.zoom(), o2 = api.orbite ? api.orbite() : null; ev("pointerup", 1, 105, 262);
    // v21.23 : un lâcher perdu (doigt fantôme) ne doit pas faire sauter le zoom au geste suivant
    const evp = (t, id, x, y, pr) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: pr }));
    evp("pointerdown", 11, 200, 200, true); evp("pointerdown", 12, 300, 200, false); evp("pointerup", 11, 200, 200, true);   // le lâcher du doigt 12 est perdu
    const zG = api.zoom(); evp("pointerdown", 13, 200, 200, true); evp("pointermove", 13, 205, 230, true); evp("pointermove", 13, 150, 300, true); const zG2 = api.zoom(); evp("pointerup", 13, 205, 230, true);
    return { type: api.type, z0, zPince, zApres, zG, zG2, sautOrbite: o1 === null ? 'n/a' : +(o2 - o1).toFixed(3) }; });
  await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  ok(!err.length && r.type === "3d", "0 erreur JS, carte en 3D " + JSON.stringify(err));
  ok(r.zPince < 0.9, "pincer zoome (zoom " + r.z0 + " → " + r.zPince.toFixed(2) + ")");
  ok(Math.abs(r.zApres - r.zPince) < 1e-9, "lever un doigt garde le zoom");
  ok(Math.abs(r.sautOrbite) < 0.1, "lever un doigt puis bouger un peu l'autre : pas de saut de caméra (rotation " + r.sautOrbite + " rad)");
  ok(Math.abs(r.zG2 - r.zG) < 1e-9, "v21.23 · doigt fantôme d'un geste précédent : le geste suivant ne fait plus sauter le zoom (" + r.zG.toFixed(2) + " → " + r.zG2.toFixed(2) + ")");
  process.exit(ko.length ? 1 : 0); })();
