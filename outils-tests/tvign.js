const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 760, height: 420 } })).newPage();
  await p.goto('http://localhost:8771/index.html'); await p.setContent('<html><body style="margin:0;background:#11141B;display:flex;flex-wrap:wrap;gap:6px;padding:6px"><script src="http://localhost:8771/piste.js?' + Date.now() + '"></script></body></html>');
  await p.waitForFunction(() => window.Piste);
  await p.evaluate(() => Object.keys(Piste.TRACES).forEach(id => { const d = document.createElement('div'); d.style.cssText = 'width:176px;height:120px;color:#9AA;font:11px sans-serif;stroke:#9B87FF'; d.innerHTML = Piste.vignette(id) + id; d.querySelector('svg').style.cssText = 'width:176px;height:105px'; document.body.appendChild(d); }));
  await p.screenshot({ path: require('os').tmpdir() + '/vignettes.png' }); await b.close(); })();
