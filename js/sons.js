/* ============================================================
   V16.43 · Sons et vibrations du Versus
   Tout est fabriqué par l'appli (Web Audio), aucun fichier son.
   Son COUPÉ par défaut (choix de Théo) : bouton 🔊 de la course, ou Réglages.
   Vibrations activées par défaut (Android ; l'iPhone ne sait pas faire vibrer une page web).
   ============================================================ */
const SONS = (() => {
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } };
  const actif = () => lire("versus.son", "1") === "1";   // v16.74 : son ACTIVÉ par défaut (Théo), coupable dans Réglages ou 🔊
  const vibreOK = () => lire("versus.vibre", "1") !== "0";
  let ctx = null, maitre = null, bruitBuf = null, moteur = null;
  const timers = new Set();

  function audio() {
    if (!actif()) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); maitre = sortie(ctx); }
      if (ctx.state === "suspended" && !(mus && mus.enPause)) ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  /** V16.75 · la sortie : volume général puis un compresseur (la musique et les bips ne saturent jamais) */
  function sortie(c) {
    const g = c.createGain(), k = c.createDynamicsCompressor(); g.gain.value = .55;
    k.threshold.value = -12; k.knee.value = 6; k.ratio.value = 4; k.attack.value = .004; k.release.value = .2;
    g.connect(k); k.connect(c.destination); return g;
  }
  function bruitDe(c) {
    if (c === ctx && bruitBuf) return bruitBuf;
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    if (c === ctx) bruitBuf = b; return b;
  }
  const bruit = () => bruitDe(ctx);
  /** une note : fréquence (ou [début, fin] pour une glissade), durée, forme, volume, décalage */
  function note(f, dur, type, vol, dt) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + (dt || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f[1]), t + dur); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .3, t + Math.min(.02, dur / 4)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    o.connect(g); g.connect(maitre); o.start(t); o.stop(t + dur + .05);
  }
  /** un souffle de bruit filtré : durée, fréquence du filtre (ou [début, fin]), volume, décalage, attaque */
  function souffle(dur, fq, vol, dt, att, type) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + (dt || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = bruit(); s.loop = true; fl.type = type || "bandpass"; fl.Q.value = 1.2;
    if (Array.isArray(fq)) { fl.frequency.setValueAtTime(fq[0], t); fl.frequency.exponentialRampToValueAtTime(fq[1], t + dur); } else fl.frequency.value = fq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .3, t + (att || .02)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(maitre); s.start(t); s.stop(t + dur + .05);
  }
  function vibrer(motif) { if (!vibreOK() || !navigator.vibrate) return; try { navigator.vibrate(motif); } catch (e) { /* rien */ } }
  function plus_tard(ms, fn) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function arreter() { timers.forEach(clearTimeout); timers.clear(); moteurStop(); musiqueStop(.3); }

  /* ---------- les moteurs : un grondement qui monte pendant la course ---------- */
  function moteurStop(fondu) {
    if (!moteur) return; const m = moteur; moteur = null;
    try { const t = m.c.currentTime; m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(m.g.gain.value, t); m.g.gain.linearRampToValueAtTime(0, t + (fondu || .4)); setTimeout(() => m.os.forEach(o => { try { o.stop(); } catch (e) { } }), (fondu || .4) * 1000 + 100); } catch (e) { /* rien */ }
  }
  function moteurs(duree) {
    moteurStop(.1); const c = audio(); if (!c) return;
    const t = c.currentTime, g = c.createGain(), fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 900; fl.connect(g); g.connect(maitre);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .8); g.gain.setValueAtTime(.16, t + duree * .52); g.gain.linearRampToValueAtTime(.22, t + duree * .6); g.gain.linearRampToValueAtTime(.2, t + duree);
    const os = [[55, "sawtooth"], [82.5, "sawtooth"], [110.6, "square"]].map(([f, ty], i) => { const o = c.createOscillator(); o.type = ty;
      o.frequency.setValueAtTime(f * .6, t); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 1.5); o.frequency.setValueAtTime(f * 1.25, t + duree * .52); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + duree * .62); o.frequency.exponentialRampToValueAtTime(f * 1.75, t + duree);
      const vg = c.createGain(); vg.gain.value = i === 2 ? .25 : .5; o.connect(vg); vg.connect(fl); o.start(t); return o; });
    // vibrato : le ronronnement
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 7; lg.gain.value = 4; lfo.connect(lg); os.forEach(o => lg.connect(o.frequency)); lfo.start(t); os.push(lfo);
    moteur = { c, g, os };
    plus_tard(duree * 1000, () => moteurStop(.8));
  }

  /* ==================== V16.75 · La musique de la bande-annonce et le jingle « VER-SUS ! » ====================
     Une recette par univers (clé « peint » du circuit) : tempo, tonique, instruments, un motif maison de 4 à 6 notes, des bruitages.
     Forme : la signature (2-3 s) sur le plan du circuit → la tension (motif plus bas + pulsation) sur la règle et le trésor
     → un temps de silence → les 5 bips des feux → le jingle de l'univers en accord sur « C'est parti ! ». Jamais en boucle, jamais pendant la course.
     Toutes les notes sont posées d'avance sur l'horloge audio ; pause = ctx.suspend(). Aucune note tirée d'une musique de film. */
  let mus = null, cleBA = null;
  function env(c, out, t, att, d, v, tenue) {   // enveloppe : montée, (tenue), extinction
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att);
    if (tenue) g.gain.setValueAtTime(v, t + Math.max(att, d - tenue)); g.gain.exponentialRampToValueAtTime(.0005, t + d); g.connect(out); return g;
  }
  function osc(c, g, t, f, type, d, N) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(g); o.start(t); o.stop(t + d + .05); N.push(o); return o; }
  function bruitF(c, g, t, d, fq, q, type, N) {
    const s = c.createBufferSource(), fl = c.createBiquadFilter(); s.buffer = bruitDe(c); s.loop = true; fl.type = type || "bandpass"; fl.Q.value = q || 1;
    if (Array.isArray(fq)) { fl.frequency.setValueAtTime(fq[0], t); fl.frequency.exponentialRampToValueAtTime(fq[1], t + d); } else fl.frequency.value = fq;
    s.connect(fl); fl.connect(g); s.start(t, Math.random() * 1.5); s.stop(t + d + .05); N.push(s);
  }
  const passeBas = (c, out, fq) => { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fq; f.connect(out); return f; };
  /* les instruments : (contexte, sortie, instant, fréquence, durée, volume, sources) ; rien de grave sous 200 Hz (inaudible au téléphone) */
  const INSTR = {
    celesta: (c, o, t, f, d, v, N) => { const D = Math.max(d, .7); osc(c, env(c, o, t, .003, D, v), t, f, "sine", D, N); osc(c, env(c, o, t, .002, .22, v * .3), t, f * 4, "sine", .22, N); },
    clochette: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .002, 1.2, v), t, f, "sine", 1.2, N); osc(c, env(c, o, t, .002, .5, v * .3), t, f * 2.76, "sine", .5, N); },
    boite: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .002, .9, v), t, f, "sine", .9, N); osc(c, env(c, o, t, .002, .16, v * .35), t, f * 3, "sine", .16, N); },
    clavecin: (c, o, t, f, d, v, N) => { const fl = passeBas(c, env(c, o, t, .002, .4, v), 5000); fl.frequency.setValueAtTime(5000, t); fl.frequency.exponentialRampToValueAtTime(1100, t + .3); osc(c, fl, t, f, "sawtooth", .4, N); },
    cloche: (c, o, t, f, d, v, N) => [[1, 1, 2.2], [1.19, .5, 1.6], [1.5, .35, 1.2], [2, .4, 1], [2.74, .2, .6]].forEach(([m, k, D]) => osc(c, env(c, o, t, .003, D, v * k), t, f * m, "sine", D, N)),
    flute: (c, o, t, f, d, v, N) => {
      const x = osc(c, env(c, o, t, .07, d + .15, v, d * .7), t, f, "triangle", d + .15, N), l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .009, t + .3); l.connect(lg); lg.connect(x.frequency); l.start(t); l.stop(t + d + .2); N.push(l);
      bruitF(c, env(c, o, t, .03, .22, v * .25), t, .22, f * 2, 2, "bandpass", N);   // le souffle de l'attaque
    },
    bourdon: (c, o, t, f, d, v, N) => { const fl = passeBas(c, env(c, o, t, .6, d, v, .6), 900); osc(c, fl, t, f, "sawtooth", d, N); osc(c, fl, t, f * 1.5, "sawtooth", d, N); },   // tonique + quinte
    bloc: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .001, .05, v), t, 1700, "sine", .05, N); osc(c, env(c, o, t, .001, .04, v * .5), t, 850, "triangle", .04, N); },
    grelots: (c, o, t, f, d, v, N) => { const n = Math.max(2, Math.round(d / .045)); for (let k = 0; k < n; k++) { const tk = t + k * .045 + Math.random() * .012; bruitF(c, env(c, o, tk, .002, .07, v * (1 - k / n * .6)), tk, .08, 7500, 1.5, "bandpass", N); } },
    dum: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, .002, .16, v), t, .16, 380, 2.5, "bandpass", N); osc(c, env(c, o, t, .002, .12, v * .5), t, 210, "sine", .12, N); },
    tek: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, .001, .06, v), t, .06, 2600, 1.5, "bandpass", N),
    vent: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .4, d, v, d * .3), t, d, [500, 1500], 3, "bandpass", N),
    ver: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, d * .7, d, v, d * .25), t, d, [180, 450], 1.2, "lowpass", N); osc(c, passeBas(c, env(c, o, t, d * .7, d, v * .5, d * .25), 500), t, 110, "sawtooth", d, N); },
    balai: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .45, d, v), t, d, [900, 5000], 4, "bandpass", N),
    tasse: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .001, .3, v), t, 3150, "sine", .3, N); osc(c, env(c, o, t, .001, .2, v * .6), t, 4420, "sine", .2, N); },
    choc: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, .003, .3, v), t, .3, 260, 1, "lowpass", N); const x = osc(c, env(c, o, t, .003, .3, v * .7), t, 150, "sine", .3, N); x.frequency.exponentialRampToValueAtTime(60, t + .3); },
    sable: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, .15, d, v), t, d, [3200, 1200], 1.5, "bandpass", N),
    souffle: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .3, d, v), t, d, 1200, 1.5, "bandpass", N)
  };
  /* le jingle « VER-SUS ! » : sol-do-mi, court-court-long. Seuls l'onde, l'octave, l'enveloppe et une couche de bruit changent selon l'univers */
  const JINGLE_NOTES = [392, 523.25, 659.25], JINGLE_RYTHME = [[0, .12], [.12, .12], [.24, .5]];
  const JINGLE_TIMBRE = {
    defaut: { ondes: [["sine", 1, 1], ["triangle", 1, .5]], att: .01, rel: .35 },
    garage: { ondes: [["sine", 1, 1], ["sine", 4, .22]], oct: 1, att: .003, rel: .7, pince: true, couche: ["grelots", 1, .1] },   // l'Atelier du Père Noël : célesta + grelots
    ratatouille: { ondes: [["sawtooth", 1, .6], ["square", 1.004, .4]], filtre: 2600, att: .03, rel: .3 },   // musette
    chateau: { ondes: [["square", 1, .8]], filtre: 3500, att: .002, rel: .45, pince: true },   // clavecin
    terrier: { ondes: [["triangle", 1, 1]], oct: 1, att: .002, rel: .4, pince: true, couche: ["tasse", .3, .06] },   // goûter : pizzicato + tasse
    anneau: { ondes: [["sawtooth", 1, 1]], filtre: 1400, att: .06, rel: .45 },   // cuivres
    pandora: { ondes: [["sine", 1, 1], ["sine", 2, .2]], att: .08, rel: .6, couche: ["souffle", 1.2, .05] },
    etoiles: { ondes: [["sawtooth", 1, 1], ["sawtooth", 1.003, .6]], filtre: 1800, att: .04, rel: .4 },   // cuivres filtrés
    dunes: { ondes: [["sawtooth", 1, 1]], oct: -1, filtre: 1500, att: .02, rel: .5, couche: ["sable", 1, .07] },
    envers: { ondes: [["square", 1, .6], ["square", 1.006, .6]], filtre: 2200, att: .01, rel: .5 },   // synthé
    multivers: { ondes: [["sine", 1, 1], ["sine", 2, .3]], att: .005, rel: .6, cascade: true },
    chocolat: { ondes: [["triangle", 1, 1]], oct: 1, att: .002, rel: .6, pince: true },   // boîte à musique
    titans: { ondes: [["sine", 1, 1], ["triangle", 2, .25]], oct: -1, att: .01, rel: .5, couche: ["choc", .3, .25] },
    odyssee: { ondes: [["triangle", 1, 1], ["sine", 2, .3]], att: .002, rel: .7, pince: true }   // lyre
  };
  function jingleSur(c, out, t, cle, mode, N) {
    const J = JINGLE_TIMBRE[cle] || JINGLE_TIMBRE.defaut, m = Math.pow(2, J.oct || 0), acc = mode === "accord";
    JINGLE_NOTES.forEach((f0, i) => {
      const dt = acc ? (J.cascade ? i * .06 : 0) : JINGLE_RYTHME[i][0], dn = acc ? 1 : JINGLE_RYTHME[i][1], tt = t + dt, d = dn + J.rel;
      const g = J.pince ? env(c, out, tt, J.att, d, .12) : env(c, out, tt, J.att, d, .12, J.rel), dest = J.filtre ? passeBas(c, g, J.filtre) : g;
      J.ondes.forEach(([ty, k, a]) => { const gg = c.createGain(); gg.gain.value = a; gg.connect(dest); osc(c, gg, tt, f0 * m * k, ty, d, N); });
    });
    if (J.couche) INSTR[J.couche[0]](c, out, t, 0, J.couche[1], J.couche[2], N);
  }
  /* les recettes. pas = ce que joue chaque temps de la mesure ; bruit = [instrument, temps, durée s, volume, demi-tons] ; motif = [demi-tons, temps] */
  const MUSIQUES = {
    garage: {   // L'Atelier du Père Noël : petite marche à deux temps, do majeur
      tempo: 120, tonique: 523.25, mel: "celesta", vMel: .5, motif: [[7, .5], [9, .5], [7, .5], [4, .5], [5, .5], [12, 1.5]],
      pas: [[["clochette", -12, .2], ["grelots", 0, .12, .12]], [["clochette", -5, .13], ["clochette", -8, .13], ["grelots", 0, .08, .1]]],
      bruit: [["grelots", 0, .9, .3]],
      tension: { sous: 2, puls: [["bloc", 0, .3, 1], ["grelots", 0, .16, 2, .12]], inst: "celesta", decal: [-12, -7], v: .45, retard: 1, accent: [["grelots", 0, .6, .25]] },
      fin: [["grelots", 0, 1.1, .28], ["clochette", .08, 1.2, .14, 24]] },
    chateau: {   // valse à trois temps, do mineur ; boîte à musique, clavecin, cloche, balai qui passe
      tempo: 180, tonique: 523.25, mel: "boite", vMel: .5, motif: [[0, 1], [3, 1], [7, 1], [8, 1.5], [7, .5], [11, 2]],
      pas: [[["clavecin", -12, .2]], [["clavecin", -5, .12], ["clavecin", -9, .12]], [["clavecin", -5, .12], ["clavecin", -9, .12]]],
      bruit: [["cloche", 0, 2.2, .16, -12], ["balai", 1.5, .8, .18]],
      tension: { sous: 1, puls: [["clavecin", -12, .24, 1], ["cloche", -12, .16, 3]], inst: "clavecin", decal: [-12, -9], v: .3, retard: 0, accent: [["balai", 0, .7, .22]] },
      fin: [["balai", 0, .8, .18], ["cloche", 0, 2, .14, -12]] },
    dunes: {   // 70 battements, mode phrygien sur do : bourdon, flûte, percussion de souffle, vent, le ver qui gronde
      tempo: 70, tonique: 523.25, mel: "flute", vMel: .4, motif: [[7, .5], [8, .5], [7, .5], [1, .5], [0, 1]],
      pas: [[["dum", 0, .35]]], fond: [["bourdon", -12, .1]],
      bruit: [["vent", 0, 3, .12]],
      tension: { sous: 2, puls: [["dum", 0, .5, 2], ["tek", 0, .28, 1]], inst: "flute", decal: [-5, -3], v: .34, retard: 1, accent: [["vent", 0, 1.5, .1]], monte: [["ver", 1.8, .3]] },
      fin: [["bourdon", 0, 1.4, .1, -12], ["dum", 0, .2, .6], ["ver", 0, 1.2, .22]] }
  };
  /* la partition : la liste des notes, en secondes depuis le début de la bande-annonce */
  function composer(R, o) {
    const b = 60 / R.tempo, E = [], P = o.plans.map(x => x / 1000), tF = o.tFeux / 1000, tO = o.tOut / 1000;
    const add = (t, i, st, d, v, fin) => E.push({ t: Math.round(t * 1000) / 1000, i, f: R.tonique * Math.pow(2, (st || 0) / 12), d, v, fin: !!fin });
    const finale = (tf, enDirect) => { add(tf, "jingle", 0, 1.3, 1, enDirect); (R.fin || []).forEach(([i, dt, d, v, st]) => add(tf + dt, i, st, d, v, enDirect)); };
    // 1 · la signature, sur le plan du circuit
    const s0 = .15, bord = Math.min(P[1] != null ? P[1] : tF - b, s0 + 3);
    let t = s0; R.motif.forEach(([st, d]) => { if (t < bord - .1) add(t, R.mel, st, Math.min(d * b, bord - t + .3), R.vMel); t += d * b; });
    const finSig = Math.min(t, bord);
    for (let k = 0; s0 + k * b < finSig - .05; k++) R.pas[k % R.pas.length].forEach(([i, st, v, d]) => add(s0 + k * b, i, st, d || b, v));
    (R.bruit || []).forEach(([i, dt, d, v, st]) => add(s0 + dt * b, i, st, d, v));
    if (o.reduit) { (R.fond || []).forEach(([i, st, v]) => add(s0, i, st, finSig + .2 - s0, v)); finale(finSig + .45, false); return E; }
    // 2 · la tension, sur la règle et le trésor ; un temps de silence avant les feux
    const T = R.tension, a = Math.max(finSig, P[1] != null ? P[1] : finSig), z = tF - b;
    (R.fond || []).forEach(([i, st, v]) => add(s0, i, st, Math.max(a, z) - s0, v));
    if (z - a > .3) {
      const sub = b / (T.sous || 1);
      for (let k = 0; a + k * sub < z - .02; k++) { const x = k * sub / (z - a); T.puls.forEach(([i, st, v, tous, d]) => { if (k % (tous || 1) === 0) add(a + k * sub, i, st, d || sub, v * (.45 + .55 * x)); }); }
      let tt = a + (T.retard || 0) * b; [].concat(T.decal).forEach(dc => R.motif.forEach(([st, d]) => { if (tt < z - .15) add(tt, T.inst, st + dc, Math.min(d * b, z - tt), T.v); tt += d * b; }));   // le motif plus bas, puis un cran plus haut : ça monte
      P.slice(1).forEach(p => (T.accent || []).forEach(([i, dt, d, v, st]) => add(p + dt, i, st, d, v)));
      (T.monte || []).forEach(([i, d, v]) => add(Math.max(a, z - d), i, 0, Math.min(d, z - a), v));
    }
    // 3 · le jingle de l'univers en accord, sur « C'est parti ! » (posé en direct par le dernier feu, pour coller à l'image)
    finale(tO, true);
    return E;
  }
  function poser(M, evs, t0) {
    evs.forEach(e => { if (e.i === "jingle") jingleSur(M.c, M.busJ, t0 + e.t, M.cle, "accord", M.N); else INSTR[e.i](M.c, M.bus, t0 + e.t, e.f, e.d, e.v, M.N); });
  }
  function buses(M, sortieM) { M.bus = M.c.createGain(); M.bus.gain.value = M.R.gain || .4; M.bus.connect(sortieM); M.busJ = M.c.createGain(); M.busJ.gain.value = 1; M.busJ.connect(sortieM); }
  function couper(M) { M.N.forEach(s => { try { s.stop(); } catch (e) { /* déjà fini */ } }); M.N = []; [M.bus, M.busJ].forEach(b => { try { b && b.disconnect(); } catch (e) { } }); }
  function musiqueStop(f) {
    if (!mus) return; const M = mus; mus = null; M.fini = true;
    try { if (M.enPause) { M.enPause = false; M.c.resume(); couper(M); return; }
      const t = M.c.currentTime; [M.bus, M.busJ].forEach(b => { b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + (f || .01)); });
      setTimeout(() => couper(M), (f || .01) * 1000 + 80); } catch (e) { couper(M); }
  }
  /** la musique d'une bande-annonce. o = { plans: [ms…], tFeux, tOut, reduit, depuis } ; renvoie une poignée (pause, reprendre, arreter) ou null */
  function musiqueBA(cle, o) {
    musiqueStop(.05); cleBA = cle; const R = MUSIQUES[cle], c = audio(); if (!R || !c) return null;
    const M = mus = { c, R, o, cle, N: [], fini: false, enPause: false, evs: composer(R, o) };
    M.programmer = depuis => { couper(M); buses(M, maitre); const s = (depuis || 0) / 1000;
      poser(M, M.evs.filter(e => !e.fin && e.t >= s - .005), c.currentTime + .03 - s); };
    M.finale = () => { const t0 = c.currentTime + .01 - o.tOut / 1000; poser(M, M.evs.filter(e => e.fin), t0); };
    M.programmer(o.depuis);
    return {
      pause() { if (M.fini || M.enPause) return; M.enPause = true; try { c.suspend(); } catch (e) { } },
      reprendre() { if (M.fini || !M.enPause) return; M.enPause = false; try { c.resume(); } catch (e) { } },
      arreter(f) { if (mus === M) musiqueStop(f == null ? .3 : f); },
      voix: () => M.evs.length
    };
  }
  /* le contexte audio est « suspendu » faute de geste (bande-annonce ouverte toute seule) : un toucher le réveille, et la musique repart d'où en est l'image */
  const bloque = () => !!ctx && ctx.state === "suspended" && !(mus && mus.enPause);
  function debloquer(depuisMs) { if (!ctx) return Promise.resolve(false); const M = mus; return ctx.resume().then(() => { if (M && mus === M && !M.fini) M.programmer(depuisMs); return true; }).catch(() => false); }
  /* outils d'écoute (tests) : la bande-annonce entière (feux compris) ou les 13 jingles, rendus hors ligne */
  function horsLigne(dur, fn) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new OC(1, Math.ceil(dur * 44100), 44100), m = sortie(c); fn(c, m);
    return c.startRendering().then(b => b.getChannelData(0));
  }
  function ecoute(cle, o) {
    const total = o.total / 1000;
    return horsLigne(total + .6, (c, m) => {
      const M = { c, R: MUSIQUES[cle], cle, N: [] }; buses(M, m); poser(M, composer(M.R, o), 0);
      const bip = (t, f, d, v) => osc(c, env(c, m, t, .02, d, v), t, f, "square", d, M.N);   // les bips des feux, comme note()
      if (!o.reduit) for (let q = 0; q < 5; q++) bip(o.tFeux / 1000 + q * .25, 440, .16, .12);
      [M.bus, M.busJ].forEach(b => { b.gain.setValueAtTime(b.gain.value, total); b.gain.linearRampToValueAtTime(0, total + .3); });   // la fermeture : fondu 0,3 s
    });
  }
  function ecouteJingles(cles) {
    return horsLigne(cles.length * 3.4 + .5, (c, m) => cles.forEach((k, i) => { const t = .3 + i * 3.4; jingleSur(c, m, t, k, "motif", []); jingleSur(c, m, t + 1.1, k, "accord", []); }));
  }

  /* ---------- les klaxons de l'écurie (le style du « klaxon » choisi) ---------- */
  const MEL = {
    confettis: [[523, .12], [659, .12], [784, .24]], damier: [[392, .15], [392, .15], [523, .35]], feu: [[784, .1], [988, .1], [1175, .3]],
    parade: [[392, .14], [523, .14], [659, .14], [784, .4]], billets: [[1319, .08], [1568, .08], [2093, .25]], fanfare: [[523, .16], [523, .1], [523, .1], [698, .45]],
    lingots: [[1319, .08], [1568, .08], [2093, .12], [2637, .3]], cibles: [[880, .1], [1760, .25]], fusees: [[[300, 1800], .5]]
  };
  function klaxon(style) {
    const c = audio(); if (!c) return;
    const m = MEL[style] || MEL.confettis; let dt = 0;
    m.forEach(([f, d]) => { note(f, d + .1, "square", .12, dt); note(Array.isArray(f) ? f : f * 1.5, d + .1, "triangle", .1, dt); dt += d; });
  }

  /* ---------- les événements de course (un par carte) ---------- */
  const EV = {
    pandora: () => { souffle(1.4, [300, 1800], .35, 0, .5); note([700, 1400], .5, "sawtooth", .08, .5); note([1400, 900], .4, "sawtooth", .07, 1); vibrer([60, 40, 120]); },
    ratatouille: () => { note([1800, 2600], .12, "sine", .12); note([2000, 3000], .1, "sine", .1, .16); souffle(1.2, 5000, .08, .2, .3, "highpass"); },
    anneau: () => { note([1568, 2093], .5, "sine", .2); note(2637, 1.2, "sine", .08, .1); },
    lave: () => { souffle(1.6, [300, 80], .5, 0, .05, "lowpass"); note([90, 40], 1.4, "sawtooth", .2); vibrer([80, 40, 160]); },
    bache: () => { souffle(.9, [400, 2400], .25, 0, .3); plus_tard(1800, () => { souffle(.6, [2400, 600], .3, 0, .02); klaxon("fanfare"); }); },
    escalier: () => { souffle(1.4, 140, .35, 0, .2, "lowpass"); note([70, 55], 1.4, "sawtooth", .08); },
    changement: () => { note([400, 1600], .35, "sine", .2); note([1600, 400], .35, "sine", .2, .4); },
    foret: () => { [0, .12, .2, .33, .45].forEach((d, i) => note([600 + i * 90, 1400 + i * 120], .12, "sine", .15, d)); },
    arene: () => { note([2200, 1800], .25, "sine", .12); note(1046, .4, "triangle", .14, .3); note(1318, .6, "triangle", .14, .5); },
    etoiles: () => { [0, .18, .36].forEach(d => note([1800, 300], .18, "sawtooth", .1, d)); souffle(1.2, [600, 3000], .2, .4, .3); },
    dunes: () => { souffle(2, [120, 60], .55, 0, .4, "lowpass"); note([60, 35], 2, "sawtooth", .18); vibrer([200, 80, 300]); },
    envers: () => { note([800, 100], 1.2, "sine", .2); souffle(1.2, [3000, 200], .15); plus_tard(1900, () => note([100, 800], .6, "sine", .15)); },
    multivers: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => note(f, .5, "sine", .08, i * .06)); souffle(1.4, 2600, .12, 0, .1, "highpass"); },
    chocolat: () => { [1568, 1760, 2093, 2349, 2637, 3136].forEach((f, i) => note(f, .25, "triangle", .08, i * .12)); },
    titans: () => { note([80, 40], .6, "sine", .5); souffle(.5, 200, .5, 0, .01, "lowpass"); plus_tard(450, () => { note([80, 40], .6, "sine", .5); souffle(.5, 200, .4, 0, .01, "lowpass"); }); vibrer([120, 330, 120]); },
    odyssee: () => { souffle(.35, 4000, .6, 0, .005, "highpass"); souffle(2.2, [400, 60], .6, .05, .02, "lowpass"); note([110, 40], 2, "sawtooth", .15, .05); vibrer([60, 30, 220]); }
  };

  const API = {
    actif, vibreOK, arreter, vibrer, klaxon, musiqueBA, bloque, debloquer, MUSIQUES, JINGLE_TIMBRE, _ecoute: ecoute, _ecouteJingles: ecouteJingles, _partition: composer,
    /** V16.75 · le jingle « VER-SUS ! » dans le timbre d'un univers : mode « motif » (3 notes enchaînées) ou « accord » (tenu ~1 s) */
    jingle(cle, mode) { const c = audio(); if (!c) return; try { jingleSur(c, maitre, c.currentTime + .02, cle, mode || "motif", []); } catch (e) { /* rien */ } },
    basculer(on) { ecrire("versus.son", on ? "1" : "0"); if (on) { audio(); note(880, .12, "sine", .15); note(1320, .2, "sine", .12, .1); } else arreter(); document.querySelectorAll("[data-son]").forEach(majBouton); majReglages(); },
    vibrations(on) { ecrire("versus.vibre", on ? "1" : "0"); if (on) vibrer(40); majReglages(); },
    /** les 5 feux puis le départ : feux en ms avant le départ (0 = départ tout de suite) */
    depart(avant) {
      const pas = avant > 0 ? Math.min(450, avant / 6) : 0, t0 = avant > 0 ? avant - pas * 5 : 0;
      if (avant > 0) for (let q = 0; q < 5; q++) plus_tard(t0 + q * pas, () => { note(440, .16, "square", .12); vibrer(30); });
      plus_tard(avant > 0 ? avant : 0, () => { note(880, .45, "square", .16); vibrer(120); });
    },
    course(duree, avant) { arreter(); if (!actif() && !vibreOK()) return; API.depart(avant || 0); plus_tard(avant || 0, () => moteurs(duree / 1000)); },
    /** l'arrivée : la foule, le klaxon du vainqueur ; une vibration de victoire si c'est toi */
    arrivee(styleKlaxon, cEstMoi, cle) {
      moteurStop(1.2); souffle(2.4, [700, 1100], .28, 0, .4); souffle(1.6, 2600, .1, .3, .2, "highpass");
      if (cle) { plus_tard(250, () => API.jingle(cle, "motif")); plus_tard(1300, () => klaxon(styleKlaxon)); }   // V16.75 : « VER-SUS ! » dans le timbre du mois, puis le klaxon du vainqueur
      else plus_tard(500, () => klaxon(styleKlaxon)); vibrer(cEstMoi ? [80, 60, 80, 60, 250] : 60);
    },
    /** les 5 feux de la bande-annonce (aux mêmes moments que l'image) */
    feuxBA(departMs, pasMs) { for (let q = 0; q < 5; q++) plus_tard(departMs + q * pasMs, () => { note(440, .16, "square", .12); vibrer(25); }); },
    /** un seul feu de la bande-annonce, déclenché par son horloge (suit la pause) : q = 0..4 feux rouges, 5 = extinction (bip grave et long) */
    feuBA(q) { if (q < 5) { note(440, .16, "square", .12); vibrer(25); return; }
      // V16.75 : « C'est parti ! » = le jingle de l'univers en accord (avec la fin de sa musique s'il en a une) à la place du bip
      const c = audio(); if (c) try { if (mus && !mus.fini) mus.finale(); else jingleSur(c, maitre, c.currentTime + .01, cleBA, "accord", []); } catch (e) { /* rien */ }
      vibrer(110); },
    ev(k) { try { if (EV[k]) EV[k](); } catch (e) { /* rien */ } },
    succes() { note(1046, .12, "sine", .12); note(1568, .25, "sine", .12, .1); vibrer(30); }
  };

  /* ---------- boutons : 🔊 de la course (data-son) et Réglages ---------- */
  function majBouton(b) { const on = actif(); b.textContent = on ? "🔊" : "🔇"; b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Couper le son" : "Activer le son"); }
  function majReglages() {
    document.querySelectorAll("[data-son-choix]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.sonChoix === "1") === actif())));
    document.querySelectorAll("[data-vibre-choix]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.vibreChoix === "1") === vibreOK())));
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-son], [data-son-choix], [data-vibre-choix]"); if (!b) return;
    if (b.hasAttribute("data-son")) API.basculer(!actif());
    else if (b.hasAttribute("data-son-choix")) API.basculer(b.dataset.sonChoix === "1");
    else API.vibrations(b.dataset.vibreChoix === "1");
  });
  /* v16.70 · « Tester » dans Réglages : joue un bip, vibre, et dit ce que le navigateur permet (pour comprendre un téléphone muet) */
  document.addEventListener("click", e => {
    if (!(e.target.closest && e.target.closest("#son-test"))) return;
    const etaitCoupe = !actif(); if (etaitCoupe) ecrire("versus.son", "1");
    const c = audio(); note(880, .15, "sine", .3); note(1320, .25, "sine", .25, .15);
    const vib = !!navigator.vibrate; let vibOk = false; try { vibOk = vib && navigator.vibrate([60, 60, 120]); } catch (er) { vibOk = false; }
    if (etaitCoupe) ecrire("versus.son", "0");
    const d = document.getElementById("son-diag"); if (!d) return;
    setTimeout(() => {
      const etat = !c ? "impossible (ce navigateur ne gère pas le son web)" : c.state === "running" ? "OK, un bip vient de partir" : "bloqué par le navigateur (" + c.state + ")";
      d.hidden = false;
      d.textContent = "Son : " + etat + ". Si tu n'entends rien : volume « multimédia » du téléphone, Bluetooth connecté ailleurs ? Vibration : " +
        (!vib ? "pas gérée par ce navigateur (c’est le cas sur iPhone et sur certaines versions de Firefox)." : vibOk ? "demandée au téléphone." : "refusée par le navigateur.") + (etaitCoupe ? " (Le son reste coupé dans l'appli : active-le au-dessus.)" : "");
    }, 400);
  });
  // un bouton 🔊 qui apparaît dans la page se met tout seul à jour
  new MutationObserver(() => { document.querySelectorAll("[data-son]:not([data-son-ok])").forEach(b => { b.setAttribute("data-son-ok", ""); majBouton(b); }); majReglages(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { timers.forEach(clearTimeout); timers.clear(); moteurStop(); } });   // V16.75 : la musique de la bande-annonce se met en pause avec elle (ctx.suspend), on ne la coupe pas
  return API;
})();
window.SONS = SONS;   // v16.69 : « const » ne crée pas window.SONS, et tous les « if (window.SONS) » de l'appli restaient faux (sons et vibrations muets depuis la v16.43)
