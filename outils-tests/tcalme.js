/* Test (25/11/2026) · RÈGLE COMMUNE « COURSE CALME » : pendant la course, le décor vivant ne recouvre JAMAIS une voiture, sur aucun circuit.
   Lancer depuis la racine, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tcalme.js   (PORT=…, N=… courses par circuit, IDS="miami monza")
   Mesure réutilisable, pour chaque circuit, en 2D et en 3D (caméra 🚁 poursuite derrière une voiture, et vue d'ensemble « tv ») :
   · 2D : à chaque image de la course, chaque forme visible du calque des événements (sauf les bulles de texte) est comparée aux pastilles des
     voitures (rectangles à l'écran) ; une image compte si une forme en recouvre une ;
   · 3D : la garde de piste.js (gardeVivant) compte, dans self.__VIV, les images où un objet vivant passe DEVANT une voiture à l'écran :
     « brut » (avant la garde) et « vu » (après : ce que l'on voit vraiment). SANS_GARDE=1 mesure sans la garde (comparaison « avant »).
   Vérifie : 0 image recouverte en 2D (hors arrivée) et en 3D (« vu »), 0 erreur JS. Fausses voitures uniquement (aucune donnée de joueur). */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, N = +(process.env.N || 3), SANS = !!process.env.SANS_GARDE;
const IDS = (process.env.IDS || "abudhabi bahrein djeddah melbourne suzuka miami montreal silverstone spa monza singapour interlagos lasvegas").split(/\s+/).filter(Boolean);
const MODES = (process.env.MODES || "2d poursuite tv").split(/\s+/);
const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const NOMS = ["A", "B", "C", "D", "E"], COUL = ["#4C9AFF", "#E5484D", "#F2B33D", "#3DDC97", "#B57BFF"];
async function course(b, id, mode, graine) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 300 } })).newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.setContent('<html><body style="margin:0;background:#000"><div id="b" style="width:390px;height:260px;position:relative"></div></body></html>');
  await p.addScriptTag({ url: "http://localhost:" + PORT + "/piste.js?" + Date.now() });
  const r = await p.evaluate(async ([id, mode, graine, NOMS, COUL, SANS]) => {
    const d3 = mode !== "2d", dur = d3 ? 15000 : 12000, b = document.getElementById("b");
    const api = Piste.monter(b, { circuit: id, meteo: "soleil", effets: true, mode: d3 ? "3d" : "2d", camera: d3 ? mode : "tv", tour: 25, focus: NOMS[graine % 5],
      voitures: NOMS.map((n, i) => ({ nom: n, couleur: COUL[i] })), pts: Object.fromEntries(NOMS.map((n, i) => [n, -i * .012])) });
    await new Promise(r => setTimeout(r, 1500));
    // un scénario de 2 tours, avec des dépassements (différent à chaque graine)
    const ph = NOMS.map((_, i) => (i * 1.7 + graine * 2.3) % 6.28), sc = w => Object.fromEntries(NOMS.map((n, i) => [n, 2.05 * w - i * .012 + .035 * Math.sin(w * 7 + ph[i]) * Math.sin(Math.PI * w)]));
    self.__VIV = SANS ? { sansGarde: true } : {}; const S = { img: 0, chev: 0, quoi: {} }; let fin = false;
    const pas = () => { if (fin) return; S.img++;
      if (!d3) { const ev = b.querySelector(".p2-ev"), voit = [...b.querySelectorAll(".p2-v > g")].map(g => g.getBoundingClientRect()).filter(q => q.width);
        if (ev) { let touche = null;
          for (const el of ev.querySelectorAll("path, circle, rect, ellipse, line, polygon, polyline, image, use")) {
            let op = 1, n = el, bul = false; while (n && n !== ev) { if (n.style && n.style.display === "none") { op = 0; break; } const a = n.getAttribute && n.getAttribute("opacity"); if (a !== null && a !== undefined) op *= +a; if (n.style && n.style.opacity !== "") op *= +n.style.opacity;
              if (n.tagName === "g" && n.querySelector && ((n.querySelector(":scope > text") && n.querySelector(':scope > rect[fill="#14161C"]')) || n.classList.contains("ev-net"))) bul = true;
              if (n.style && n.style.filter && /opacity\(([\d.]+)\)/.test(n.style.filter)) op *= +RegExp.$1; n = n.parentNode; }
            if (bul || op < .06) continue; const q = el.getBoundingClientRect(); if (!q.width || q.width > 2000) continue;
            if (voit.some(v => Math.min(q.right, v.right) - Math.max(q.left, v.left) > 1 && Math.min(q.bottom, v.bottom) - Math.max(q.top, v.top) > 1)) { let g = el; while (g.parentNode && g.parentNode !== ev) g = g.parentNode; touche = [...ev.children].indexOf(g) + ":" + (g.getAttribute("class") || "") + ":" + (el.getAttribute("class") || el.tagName); break; } }
          if (touche) { S.chev++; S.quoi[touche] = (S.quoi[touche] || 0) + 1; } } }
      requestAnimationFrame(pas); };
    let finie = false; api.jouerScenario(sc, dur, () => { finie = true; }); requestAnimationFrame(pas);
    await new Promise(r => setTimeout(r, dur * .975)); fin = true;   // on s'arrête juste avant l'arrivée (les grands effets y sont permis)
    const V = self.__VIV; api.detruire && api.detruire();
    if (d3) S.quoi = V.qui || {}; return { img: S.img, chev2d: S.chev, quoi: S.quoi, brut: V.brut || 0, vu: V.vu || 0 };
  }, [id, mode, graine, NOMS, COUL, SANS]);
  await p.context().close(); return Object.assign(r, { err });
}
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), errs = [];
  for (const id of IDS) for (const mode of MODES) {
    let img = 0, rec = 0, brut = 0; const quoi = {};
    const res = await Promise.all(Array.from({ length: N }, (_, g) => course(b, id, mode, g)));
    res.forEach(r => { img += r.img; rec += mode === "2d" ? r.chev2d : r.vu; brut += mode === "2d" ? r.chev2d : r.brut; Object.entries(r.quoi).forEach(([k, v]) => quoi[k] = (quoi[k] || 0) + v); errs.push(...r.err.map(e => id + " " + mode + " : " + e)); });
    ok(rec === 0, id.padEnd(11) + " " + mode.padEnd(9) + " " + N + " courses, " + img + " images : " + rec + " recouvrent une voiture" + (mode !== "2d" ? " (avant la garde : " + brut + ")" : "") + (Object.keys(quoi).length ? " " + JSON.stringify(quoi) : ""));
  }
  ok(!errs.length, "0 erreur JS " + JSON.stringify(errs.slice(0, 5)));
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
