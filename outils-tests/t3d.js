const { chromium } = require('playwright');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["abudhabi","bahrein","djeddah","melbourne","suzuka","miami","montreal","silverstone","spa","monza","singapour","interlagos","lasvegas","monaco"];
const cam = process.env.CAM || "helico";
(async () => { const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 520, height: 340 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8771/index.html'); await p.waitForTimeout(800);
  await p.setContent('<html><body style="margin:0;background:#000"><div id="b" style="width:520px;height:340px;position:relative"></div><script src="http://localhost:8771/piste.js?' + Date.now() + '"></script></body></html>');
  await p.waitForFunction(() => window.Piste);
  for (const id of ids) {
    const info = await p.evaluate(([id, cam]) => { const b = document.getElementById('b'); b.innerHTML = ''; window.__api && window.__api.detruire && window.__api.detruire();
      const t0 = performance.now(); window.__api = Piste.monter(b, { circuit: id, meteo: "soleil", camera: cam, tour: 25, voitures: [{ nom: "A", couleur: "#4C9AFF" }, { nom: "B", couleur: "#E5484D" }], pts: { A: 30, B: 20 } });
      return { type: window.__api.type, ms: Math.round(performance.now() - t0) }; }, [id, cam]);
    if (process.env.ZOOM) { await p.mouse.move(260, 170); for (let k = 0; k < 8; k++) await p.mouse.wheel(0, -100); }
    await p.waitForTimeout(1800);
    await p.screenshot({ path: require('os').tmpdir() + '/c3d-' + id + '-' + cam + (process.env.ZOOM ? 'z' : '') + '.png' });
    console.log(id, JSON.stringify(info));
  }
  console.log("erreurs:", errs.slice(0, 5)); await b.close(); })();
