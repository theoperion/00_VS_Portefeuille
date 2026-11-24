/* Test v20.39 · se promener dans la Visite 3D zoomée (tous les circuits : moteur commun piste.js).
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tnavig.js */
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 520, height: 400 } })).newPage(), err = []; p.on("pageerror", e => err.push(e.message));
  await p.setContent('<div id="b" style="width:500px;height:380px"></div>'); await p.addScriptTag({ url: "http://localhost:8771/piste.js" });
  const r = await p.evaluate(async () => { const pause = ms => new Promise(r => setTimeout(r, ms));
    const api = Piste.monter(document.getElementById("b"), { circuit: Object.keys(Piste.TRACES)[0], mode: "3d", camera: "helico", voitures: [] });
    const cv = document.querySelector("#b canvas"), joy = document.querySelector("#b .p3-joy"), ev = (el, t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
    await pause(300); const out = { joyLarge: joy && !joy.hidden };
    // vue d'ensemble : un doigt fait tourner (comme avant), la cible ne bouge pas
    let c0 = api.cible(), o0 = api.orbite(); ev(cv, "pointerdown", 1, 200, 200); ev(cv, "pointermove", 1, 260, 200); ev(cv, "pointerup", 1, 260, 200);
    out.largeTourne = Math.abs(api.orbite() - o0) > .2; out.largeFixe = Math.hypot(api.cible().x - c0.x, api.cible().z - c0.z) < 1e-6;
    // zoomer : la carte cesse de tourner seule, le joystick apparaît
    api.viser(null, .4); await pause(400); out.zoom = api.zoom(); out.joyVu = !joy.hidden; const oz = api.orbite(); await pause(500); out.figee = Math.abs(api.orbite() - oz) < 1e-6;
    // zoomé : un doigt déplace, ne tourne pas, ne dézoome pas
    c0 = api.cible(); const o1 = api.orbite(); ev(cv, "pointerdown", 1, 200, 200); ev(cv, "pointermove", 1, 260, 240); ev(cv, "pointerup", 1, 260, 240);
    out.unDoigtDeplace = Math.hypot(api.cible().x - c0.x, api.cible().z - c0.z) > .5; out.unDoigtSansRotation = Math.abs(api.orbite() - o1) < 1e-6; out.zoomGarde = Math.abs(api.zoom() - out.zoom) < 1e-6;
    // joystick tenu : la vue avance en continu
    c0 = api.cible(); const jr = joy.getBoundingClientRect(); ev(joy, "pointerdown", 9, jr.left + jr.width / 2, jr.top + 4); await pause(600);
    const c1 = api.cible(); await pause(400); const c2 = api.cible(); ev(joy, "pointerup", 9, jr.left + jr.width / 2, jr.top + 4); await pause(200); const c3 = api.cible(); await pause(300); const c4 = api.cible();
    out.joyAvance = Math.hypot(c1.x - c0.x, c1.z - c0.z) > .5 && Math.hypot(c2.x - c1.x, c2.z - c1.z) > .2; out.joyStop = Math.hypot(c4.x - c3.x, c4.z - c3.z) < 1e-6;
    // deux doigts qui tournent : la carte pivote
    const o2 = api.orbite(); ev(cv, "pointerdown", 1, 200, 200); ev(cv, "pointerdown", 2, 300, 200); ev(cv, "pointermove", 2, 301, 201); ev(cv, "pointermove", 2, 250, 287); ev(cv, "pointerup", 2, 250, 287); ev(cv, "pointerup", 1, 200, 200);
    out.deuxDoigtsPivote = Math.abs(api.orbite() - o2) > .5;
    // sens : un point du décor suit le doigt ; joystick vers le haut = avancer (le point descend vers soi)
    api.viser(null, .4); await pause(1500); const cc = api.cible(), P = [cc.x, 0, cc.z], a0 = api.projeter(P);
    ev(cv, "pointerdown", 1, 200, 200); ev(cv, "pointermove", 1, 260, 200); ev(cv, "pointerup", 1, 260, 200); await pause(1500); const a1 = api.projeter(P);
    ev(joy, "pointerdown", 9, jr.left + jr.width / 2, jr.top + 4); await pause(400); ev(joy, "pointerup", 9, 0, 0); await pause(1500); const a2 = api.projeter(P);
    out.suitDoigt = Math.abs((a1.x - a0.x) - 60) < 12 && Math.abs(a1.y - a0.y) < 6; out.avance = a2.y > a1.y + 20;
    api.detruire(); out.joyRetire = !document.querySelector("#b .p3-joy");
    return out; });
  await b.close();
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  ok(!err.length, "0 erreur JS " + JSON.stringify(err));
  ok(!r.joyLarge && r.largeTourne && r.largeFixe, "vue d'ensemble : pas de joystick, un doigt fait tourner comme avant");
  ok(r.joyVu && r.figee, "zoomé : le joystick apparaît, la carte ne tourne plus toute seule (zoom " + r.zoom + ")");
  ok(r.unDoigtDeplace && r.unDoigtSansRotation && r.zoomGarde, "zoomé : un doigt déplace la carte, sans tourner ni dézoomer");
  ok(r.joyAvance && r.joyStop, "joystick tenu : la vue avance en continu, s'arrête quand on lâche");
  ok(r.deuxDoigtsPivote, "deux doigts qui tournent : la carte pivote");
  ok(r.suitDoigt, "sens : le décor suit le doigt (60 px → 60 px)");
  ok(r.avance, "sens : joystick vers le haut = la vue avance");
  ok(r.joyRetire, "fermer la carte retire le joystick");
  process.exit(ko.length ? 1 : 0); })();
