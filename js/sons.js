/* ============================================================
   V16.43 · Sons et vibrations du Versus
   Tout est fabriqué par l'appli (Web Audio), aucun fichier son.
   Son ACTIVÉ par défaut ; v17.48 : petit bouton 🔊/🔇 sous la piste et en plein écran (« versus.son »), qui coupe TOUT (musique, bruitages, jingles).
   Vibrations activées par défaut (Android ; l'iPhone ne sait pas faire vibrer une page web).
   ============================================================ */
const SONS = (() => {
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } };
  const actif = () => lire("versus.son", "1") !== "0";   // v17.48 (Théo) : le petit bouton 🔊/🔇 revient (sous la piste et en plein écran), son ACTIVÉ par défaut, mémorisé sur l'appareil   // (v17.4 l'avait retiré)
  const vibreOK = () => false;   // v20.37 (Théo, 24/11) : vibrations retirées (elles ne marchaient pas), réglage supprimé
  ecrire("versus.son", "1");   // v17.52 (Théo) : à chaque ouverture de l'appli, le son est RÉACTIVÉ (couper ne vaut que pour la visite en cours)
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
  function note(f, dur, type, vol, dt, out) {   // lot 62 : out = une sortie à part (sinon la sortie générale)
    const c = audio(); if (!c) return;
    const t = c.currentTime + (dt || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f[1]), t + dur); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .3, t + Math.min(.02, dur / 4)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    o.connect(g); g.connect(out || maitre); o.start(t); o.stop(t + dur + .05);
  }
  /** un souffle de bruit filtré : durée, fréquence du filtre (ou [début, fin]), volume, décalage, attaque */
  function souffle(dur, fq, vol, dt, att, type, out) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + (dt || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = bruit(); s.loop = true; fl.type = type || "bandpass"; fl.Q.value = 1.2;
    if (Array.isArray(fq)) { fl.frequency.setValueAtTime(fq[0], t); fl.frequency.exponentialRampToValueAtTime(fq[1], t + dur); } else fl.frequency.value = fq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .3, t + (att || .02)); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out || maitre); s.start(t); s.stop(t + dur + .05);
  }
  function vibrer(motif) { if (!vibreOK() || !navigator.vibrate) return; try { navigator.vibrate(motif); } catch (e) { /* rien */ } }
  function plus_tard(ms, fn) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function arreter() { timers.forEach(clearTimeout); timers.clear(); moteurStop(); musiqueStop(.3); themeStop(.3); }

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
    souffle: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .3, d, v), t, d, 1200, 1.5, "bandpass", N),
    /* V16.81 · les instruments des 10 autres univers (x = avancée dans la tension, 0 → 1) */
    glock: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .001, 1, v), t, f, "sine", 1, N); osc(c, env(c, o, t, .001, .25, v * .25), t, f * 5.4, "sine", .25, N); },
    tictac: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .001, .035, v), t, f, "square", .035, N); bruitF(c, env(c, o, t, .001, .03, v * .6), t, .03, 5000, 1, "highpass", N); },
    chute: (c, o, t, f, d, v, N) => { const x = osc(c, env(c, o, t, .005, d, v, d * .3), t, f, "sine", d, N); x.frequency.exponentialRampToValueAtTime(f / 4, t + d); },   // la note qui tombe
    cor: (c, o, t, f, d, v, N) => { const g = env(c, o, t, .14, d + .25, v, d * .6), fl = passeBas(c, g, 700); fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(1100, t + .2); osc(c, fl, t, f, "sawtooth", d + .25, N); osc(c, fl, t, f * 1.003, "triangle", d + .25, N); },
    harpe: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .002, 1.3, v), t, f, "triangle", 1.3, N); osc(c, env(c, o, t, .002, .4, v * .3), t, f * 2, "sine", .4, N); },
    tambour: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, .003, .45, v), t, .45, 320, 1, "lowpass", N); bruitF(c, env(c, o, t, .001, .05, v * .5), t, .05, 1100, 1.5, "bandpass", N); const x = osc(c, env(c, o, t, .003, .35, v * .6), t, 230, "sine", .35, N); x.frequency.exponentialRampToValueAtTime(120, t + .35); },
    mailloche: (c, o, t, f, d, v, N) => { osc(c, env(c, o, t, .003, .55, v), t, f, "sine", .55, N); osc(c, env(c, o, t, .002, .09, v * .35), t, f * 4, "sine", .09, N); },   // marimba boisé
    ping: (c, o, t, f, d, v, N) => { const x = osc(c, env(c, o, t, .01, 1.2, v), t, f * .97, "sine", 1.2, N); x.frequency.exponentialRampToValueAtTime(f, t + .15); },   // ping bioluminescent
    cuivre: (c, o, t, f, d, v, N) => { const g = env(c, o, t, .05, d + .2, v, d * .6), fl = passeBas(c, g, 1200); fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(2200, t + .08); fl.frequency.linearRampToValueAtTime(1200, t + .4); osc(c, fl, t, f, "sawtooth", d + .2, N); osc(c, fl, t, f * 1.004, "sawtooth", d + .2, N); },
    timbale: (c, o, t, f, d, v, N) => { [[1, 1, .9], [1.5, .5, .6], [2, .3, .4]].forEach(([m, k, D]) => { const x = osc(c, env(c, o, t, .003, D, v * k), t, f * m * 1.03, "sine", D, N); x.frequency.exponentialRampToValueAtTime(f * m, t + .1); }); bruitF(c, env(c, o, t, .001, .08, v * .5), t, .08, 500, 1, "bandpass", N); },
    mecanique: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, d * .45, d * .5, v), t, d * .5, [500, 1300], 2, "bandpass", N); bruitF(c, env(c, o, t + d * .5, d * .1, d * .5, v * .8), t + d * .5, d * .5, [1100, 400], 2, "bandpass", N); },   // un souffle de machine, aller-retour
    accordeon: (c, o, t, f, d, v, N) => { const fl = passeBas(c, env(c, o, t, .03, d + .08, v, d * .7), 2500); osc(c, fl, t, f, "square", d + .08, N); osc(c, fl, t, f * 1.006, "square", d + .08, N); },   // 2 carrés désaccordés
    pizz: (c, o, t, f, d, v, N) => osc(c, passeBas(c, env(c, o, t, .002, .28, v), 2200), t, f, "triangle", .28, N),
    casserole: (c, o, t, f, d, v, N) => [[1840, 1, .9], [2530, .6, .7], [3910, .35, .5]].forEach(([fq, k, D]) => osc(c, env(c, o, t, .001, D, v * k), t, fq, "sine", D, N)),
    arp: (c, o, t, f, d, v, N, x) => { const fl = passeBas(c, env(c, o, t, .004, .3, v), 2800 - 2300 * (x || 0)); fl.Q.value = 4; osc(c, fl, t, f, "sawtooth", .3, N); osc(c, fl, t, f * 1.005, "square", .3, N); },   // synthé années 80 ; le filtre se ferme à la faille
    aspire: (c, o, t, f, d, v, N) => { const g = c.createGain(); g.gain.setValueAtTime(.0005, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(0, t + d + .02); g.connect(o); bruitF(c, g, t, d + .02, [800, 4000], 1, "bandpass", N); },   // un son à l'envers
    vague: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .5, d, v), t, d, [300, 1400], 1, "lowpass", N),
    sirene: (c, o, t, f, d, v, N) => { const x = osc(c, env(c, o, t, d * .3, d, v, d * .4), t, f, "sine", d, N); x.frequency.linearRampToValueAtTime(f * 1.5, t + d * .45); x.frequency.linearRampToValueAtTime(f * 1.33, t + d); },
    foudre: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, .002, .25, v), t, .25, 3500, .7, "highpass", N); bruitF(c, env(c, o, t + .05, .03, d, v * .9), t + .05, d, [900, 150], .8, "lowpass", N); },
    orgue: (c, o, t, f, d, v, N) => { const g = env(c, o, t, .01, Math.max(d, .15) * .9, v, .06); osc(c, g, t, f, "triangle", d, N); const h = c.createGain(); h.gain.value = .35; h.connect(g); osc(c, h, t, f * 2, "sine", d, N); },   // orgue de foire
    petille: (c, o, t, f, d, v, N) => { for (let k = 0, n = Math.round(d * 14); k < n; k++) { const tk = t + Math.random() * d; bruitF(c, env(c, o, tk, .001, .02, v * (.4 + Math.random() * .6)), tk, .025, 6000 + Math.random() * 3000, 3, "bandpass", N); } },
    montee: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, d * .9, d, v, d * .1), t, d, [300, 3500], 2, "bandpass", N),
    /* v20.53 · les instruments des musiques de course et des ambiances des 12 circuits 2027 */
    voix: (c, o, t, f, d, v, N) => {   // une voix de chœur : 2 dents de scie désaccordées, filtrées sur les formants du « a », vibrato qui arrive doucement
      const D = d + .35, g = env(c, o, t, Math.min(.3, d * .4), D, v, d * .6), m = c.createGain(); m.gain.value = 2.4;
      [[750, 5], [1150, 6]].forEach(([fq, q]) => { const b = c.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = fq; b.Q.value = q; m.connect(b); b.connect(g); });
      const corps = c.createGain(); corps.gain.value = .12; corps.connect(passeBas(c, g, 650)); m.connect(corps);
      const a = osc(c, m, t, f, "sawtooth", D, N), a2 = osc(c, m, t, f * 1.005, "sawtooth", D, N), l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .007, t + .5); l.connect(lg); lg.connect(a.frequency); lg.connect(a2.frequency); l.start(t); l.stop(t + D + .05); N.push(l);
    },
    cordes: (c, o, t, f, d, v, N) => { const D = d + .3, fl = passeBas(c, env(c, o, t, Math.min(.25, d * .5), D, v, d * .6), 1900); osc(c, fl, t, f, "sawtooth", D, N); osc(c, fl, t, f * 1.006, "sawtooth", D, N); },   // pupitre de cordes
    nappe: (c, o, t, f, d, v, N) => { const D = d + .8, g = env(c, o, t, Math.min(.9, d * .5), D, v, d * .4), h = c.createGain(); h.gain.value = .3; h.connect(g);   // nappe cosmique, lente
      osc(c, g, t, f, "triangle", D, N); osc(c, g, t, f * 1.008, "triangle", D, N); osc(c, h, t, f * 2.003, "sine", D, N); },
    synth: (c, o, t, f, d, v, N) => {   // le synthé solo des années 80 (carré + scie, filtre, vibrato)
      const D = d + .2, fl = passeBas(c, env(c, o, t, .04, D, v, d * .7), 1500), a = osc(c, fl, t, f, "square", D, N); osc(c, fl, t, f * 1.007, "sawtooth", D, N);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .006, t + .4); l.connect(lg); lg.connect(a.frequency); l.start(t); l.stop(t + D + .05); N.push(l);
    },
    shaker: (c, o, t, f, d, v, N) => bruitF(c, env(c, o, t, .004, .06, v), t, .06, 7000, 1, "highpass", N),
    caisse: (c, o, t, f, d, v, N) => { bruitF(c, env(c, o, t, .001, .2, v), t, .2, 2000, .7, "bandpass", N); const x = osc(c, env(c, o, t, .001, .12, v * .6), t, 240, "triangle", .12, N); x.frequency.exponentialRampToValueAtTime(190, t + .12); }   // caisse claire
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
  /* v17.48 · « Jingle Bells » (James Lord Pierpont, 1857 : domaine public ; c'est aussi « Vive le vent »), le refrain en do majeur.
     [demi-tons depuis do, durée en temps] ; A = mesures 1-4 (« Jingle bells, jingle bells… »), B = 5-8, C = 13-16. Le refrain = A B A C (64 temps). */
  const NOEL_A = [[4, 1], [4, 1], [4, 2], [4, 1], [4, 1], [4, 2], [4, 1], [7, 1], [0, 1.5], [2, .5], [4, 4]];
  const NOEL_B = [[5, 1], [5, 1], [5, 1.5], [5, .5], [5, 1], [4, 1], [4, 1], [4, .5], [4, .5], [4, 1], [2, 1], [2, 1], [4, 1], [2, 2], [7, 2]];
  const NOEL_C = [[5, 1], [5, 1], [5, 1], [5, 1], [5, 1], [4, 1], [4, 1], [4, .5], [4, .5], [7, 1], [7, 1], [5, 1], [2, 1], [0, 4]];
  /* les recettes. pas = ce que joue chaque temps de la mesure ; bruit = [instrument, temps, durée s, volume, demi-tons] ; motif = [demi-tons, temps] */
  const MUSIQUES = {
    garage: {   // v17.48 · L'Atelier du Père Noël : « Jingle Bells » (J. L. Pierpont, 1857, domaine public ; « Vive le vent » en France), arrangement maison célesta + grelots + pizzicati
      tempo: 192, tonique: 523.25, mel: "celesta", vMel: .42, motif: NOEL_A,
      pas: [[["pizz", -12, .2], ["grelots", 0, .08, .1]], [["pizz", -8, .1], ["pizz", -5, .1], ["grelots", 0, .12, .1]], [["pizz", -17, .18], ["grelots", 0, .08, .1]], [["pizz", -8, .1], ["pizz", -5, .1], ["grelots", 0, .12, .1]]],
      bruit: [["grelots", 0, .9, .26], ["cloche", 0, 2.2, .06]],
      tension: { sous: 2, motif: NOEL_B.concat(NOEL_C), puls: [["grelots", 0, .1, 1, .09], ["pizz", -12, .2, 4], ["pizz", -5, .12, 4, .3]], inst: "celesta", decal: [0], v: .36, retard: 0, accent: [["grelots", 0, .6, .22]] },
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
      fin: [["bourdon", 0, 1.4, .1, -12], ["dum", 0, .2, .6], ["ver", 0, 1.2, .22]] },
    /* V16.81 · les 10 autres univers. Tout est en do, pour finir sur l'accord du jingle (do majeur) ; motifs composés ici. pas : [instrument, demi-tons, volume, durée, décalage en temps] */
    terrier: {   // le goûter : valse bancale (le 3e temps boite) qui accélère, glockenspiel, tic-tac, une note qui tombe
      tempo: 168, tonique: 523.25, mel: "glock", vMel: .38, motif: [[12, 1], [11, .5], [12, .5], [7, 1], [4, 1.5], [5, .5]],
      pas: [[["pizz", -12, .26]], [["tictac", 24, .1]], [["tictac", 19, .1, 0, .18]]],
      bruit: [["chute", 4.5, .6, .14, 24]],
      tension: { sous: 1, accel: .45, puls: [["tictac", 24, .14, 1], ["pizz", -12, .26, 3]], inst: "glock", decal: [-12, -7], v: .32, retard: 1, accent: [["chute", 0, .6, .14, 24]] },
      fin: [["glock", 0, 1, .16, 24], ["tasse", .12, .3, .14]] },
    anneau: {   // dorien sur do : cor lointain, harpe, tambour au loin, montée pesante
      tempo: 84, tonique: 523.25, mel: "cor", vMel: .32, motif: [[-12, .5], [-10, .5], [-9, .5], [-2, .5], [-3, 1.5]],
      pas: [[["harpe", 0, .16], ["tambour", 0, .2]], [["harpe", 7, .12]], [["harpe", 3, .12], ["tambour", 0, .12]], [["harpe", 9, .12]]],
      tension: { sous: 1, puls: [["tambour", 0, .45, 1], ["harpe", -12, .14, 2]], inst: "cor", decal: [0, 3], v: .3, retard: 1, accent: [["tambour", 0, .3, .4]] },
      fin: [["tambour", 0, .5, .5], ["harpe", 0, 1.2, .15, 12], ["cor", 0, 1.2, .18, -12]] },
    pandora: {   // pentatonique majeure : mailloches boisées, flûte aérienne, pings qui s'allument ; accord final suspendu (ré ajouté)
      tempo: 96, tonique: 523.25, mel: "flute", vMel: .34, motif: [[9, .5], [7, .5], [12, .5], [14, .5], [16, 1]],
      pas: [[["mailloche", -12, .26]], [["mailloche", -5, .2]], [["mailloche", -3, .2]], [["mailloche", -8, .2]]],
      bruit: [["ping", .5, 1, .08, 24], ["ping", 2.5, 1, .07, 28], ["souffle", 0, 2.5, .05]],
      tension: { sous: 2, puls: [["mailloche", -12, .28, 2], ["mailloche", -3, .16, 4], ["ping", 26, .06, 3]], inst: "flute", decal: [-12, -10], v: .3, retard: 1, accent: [["souffle", 0, 1.2, .07], ["ping", 0, 1, .1, 26]] },
      fin: [["mailloche", 0, .6, .26, -12], ["ping", 0, 1.2, .1, 26], ["flute", 0, 1.1, .2, 2]] },
    etoiles: {   // le Côté obscur : do mineur, cuivres synthétiques graves en quintes, timbale, souffle de machine ; pulsation 3-3-2
      tempo: 100, tonique: 523.25, mel: "cuivre", vMel: .2, dbl: 7, motif: [[-12, 1], [-12, .5], [-9, .5], [-5, 1], [-4, 1]],
      pas: [[["timbale", -12, .3]], [["tek", 0, .14]], [["tek", 0, .12], ["timbale", -12, .18, 0, .5]], [["tek", 0, .14]]],
      bruit: [["mecanique", 0, 1.3, .1], ["mecanique", 2.5, 1.3, .08]],
      tension: { sous: 2, puls: [["timbale", -12, .36, 3], ["tek", 0, .2, 1]], inst: "cuivre", decal: [0, 1], v: .18, retard: 1, accent: [["mecanique", 0, 1.3, .1]] },
      fin: [["timbale", 0, 1, .45, -12], ["cuivre", 0, 1.2, .16, -12], ["cuivre", 0, 1.2, .13, -5]] },
    ratatouille: {   // musette à trois temps : accordéon (2 carrés désaccordés), pizzicati, casserole qui tinte
      tempo: 168, tonique: 523.25, mel: "accordeon", vMel: .2, motif: [[4, 1], [3, .5], [4, .5], [9, 1], [7, 1.5], [4, .5]],
      pas: [[["pizz", -12, .28]], [["accordeon", -5, .08, .25], ["accordeon", -8, .08, .25]], [["accordeon", -5, .08, .25], ["accordeon", -8, .08, .25]]],
      bruit: [["casserole", 0, .8, .1]],
      tension: { sous: 1, puls: [["pizz", -12, .26, 1], ["casserole", 0, .06, 3]], inst: "accordeon", decal: [-12, -10], v: .18, retard: 0, accent: [["casserole", 0, .8, .12]] },
      fin: [["casserole", 0, .9, .13], ["accordeon", 0, 1.1, .12, -12]] },
    envers: {   // arpège de synthé années 80 ; à la faille tout s'inverse : le motif descend, le filtre se ferme
      tempo: 112, tonique: 523.25, mel: "arp", vMel: .3, motif: [[0, .5], [7, .5], [12, .5], [15, .5], [14, 1]],
      pas: [[["arp", -12, .16, 0, 0], ["arp", -5, .12, 0, .5]], [["arp", -9, .16, 0, 0], ["arp", -5, .12, 0, .5]]],
      tension: { sous: 2, inverse: true, puls: [["arp", -12, .2, 1], ["arp", 3, .1, 2]], inst: "arp", decal: [2, 0], v: .28, retard: 1, accent: [["aspire", -.9, .9, .2]] },
      fin: [["arp", 0, .8, .18, -12], ["arp", .1, .8, .15, -5], ["arp", .2, .8, .13, 12]] },
    odyssee: {   // mixolydien sur do : lyre pincée, tambour et vagues, une sirène qui glisse, la foudre
      tempo: 92, tonique: 523.25, mel: "harpe", vMel: .34, motif: [[0, .5], [4, .5], [7, .5], [10, 1], [9, .5], [7, 1]],
      pas: [[["tambour", 0, .22]], [["harpe", -12, .1]], [["tambour", 0, .12]], [["harpe", -5, .1]]],
      bruit: [["vague", 0, 2.6, .14]],
      tension: { sous: 2, puls: [["tambour", 0, .36, 2], ["harpe", -12, .12, 1]], inst: "harpe", decal: [-12, -10], v: .3, retard: 1, accent: [["sirene", 0, 1.6, .1, 7], ["vague", 0, 2, .1]] },
      fin: [["foudre", 0, 1.2, .3], ["harpe", 0, 1.2, .15, 12]] },
    chocolat: {   // orgue de foire sautillant, boîte à musique, pétillement
      tempo: 132, tonique: 523.25, mel: "orgue", vMel: .26, motif: [[7, .5], [12, .25], [11, .25], [12, .5], [16, .5], [14, 1]],
      pas: [[["orgue", -12, .2, .2]], [["orgue", -5, .12, .2], ["orgue", -8, .12, .2]]],
      bruit: [["petille", 0, 2, .08], ["boite", 2, .9, .16, 24]],
      tension: { sous: 2, puls: [["orgue", -12, .2, 2, .2], ["bloc", 0, .16, 1]], inst: "boite", decal: [-5, -3], v: .34, retard: 1, accent: [["petille", 0, 1.2, .08]] },
      fin: [["petille", 0, 1.2, .1], ["boite", 0, 1, .2, 24]] },
    titans: {   // tambours de guerre, cuivres graves, choc sourd, montée
      tempo: 100, tonique: 523.25, mel: "cuivre", vMel: .22, motif: [[-12, 1], [-9, .5], [-7, .5], [-5, 1.5], [-4, .5]],
      pas: [[["tambour", 0, .5]], [["tambour", 0, .26]], [["tambour", 0, .44], ["tambour", 0, .26, 0, .5]], []],
      bruit: [["choc", 0, .3, .32]],
      tension: { sous: 2, puls: [["tambour", 0, .5, 1]], inst: "cuivre", decal: [0, 2], v: .2, retard: 1, accent: [["choc", 0, .3, .3]], monte: [["montee", 2, .14]] },
      fin: [["choc", 0, .3, .4], ["tambour", 0, .4, .55], ["cuivre", 0, 1.3, .17, -12], ["cuivre", 0, 1.3, .13, -5]] },
    multivers: {   // la Finale : épique ; dans la tension, le motif passe d'un univers à l'autre (cascade de timbres) ; l'accord final le plus large
      tempo: 120, tonique: 523.25, mel: "cuivre", vMel: .2, motif: [[0, .5], [7, .5], [12, .5], [11, .25], [12, .25], [16, 1.5]],
      pas: [[["timbale", -12, .3]], [["harpe", 7, .12]], [["timbale", -12, .18]], [["harpe", 12, .12]]],
      tension: { sous: 2, puls: [["timbale", -12, .38, 2], ["tek", 0, .18, 1]], inst: ["celesta", "clavecin", "flute", "harpe", "mailloche", "accordeon", "glock", "orgue", "boite", "cuivre"], decal: [-12, -7, -5], v: .26, retard: 1, monte: [["montee", 2, .14]] },
      fin: [["timbale", 0, 1, .45, -12], ["cuivre", 0, 1.4, .15, -12], ["cuivre", 0, 1.4, .12, -5], ["glock", 0, 1.2, .13, 24], ["celesta", .08, 1.2, .12, 28]] }
  };
  /* ==================== v20.53 · Les AIRS des 12 circuits 2027 (Théo : « fais la musique de chaque circuit en fonction du thème ») ====================
     Toutes les mélodies sont COMPOSÉES ICI (aucune note tirée d'un film, d'une série ou d'un jeu). Chaque air sert deux fois :
     la musique de la course (THEMES_COURSE, complète) et l'ambiance douce du plein écran (AMBIANCES, plus lente, sans basse ni batterie).
     Écriture : nt("demi-tons,temps …") ; « - » = un silence ; H = un accord par mesure (table ACC) ; m = temps par mesure. Tout est en do (tonique do 5). */
  const nt = s => s.trim().split(/\s+/).map(x => { const [a, b] = x.split(","); return [a === "-" ? null : +a, +b]; });
  /* les accords : [basse (jamais sous sol 3, 196 Hz), 3 notes de l'accord entre do 4 et do 5] */
  const ACC = { C: [-12, -12, -8, -5], Cm: [-12, -12, -9, -5], Csus: [-12, -12, -10, -5], Db: [-11, -11, -7, -4], Dm: [-10, -10, -7, -3], Eb: [-9, -9, -5, -2],
    E: [-8, -8, -4, -1], E7: [-8, -10, -8, -4], F: [-7, -7, -3, 0], Fm: [-7, -7, -4, 0], G: [-17, -10, -5, -1], G7: [-17, -7, -5, -1], Gm: [-17, -10, -5, -2],
    Ab: [-16, -12, -9, -4], Am: [-15, -12, -8, -3], A7: [-15, -11, -8, -5], Bb: [-14, -10, -7, -2] };
  const accords = s => s.trim().split(/\s+/).map(a => ACC[a]);
  /** joue une liste de notes à partir du temps t (dst = transposition) ; renvoie le temps de fin */
  function jouer(add, t, i, L, v, dst, x) { L.forEach(([st, d]) => { if (st !== null) add(t, i, st + (dst || 0), d, v, x); t += d; }); return t; }
  const AIRS = {
    dunes: { m: 4, H: "C C Db C C Fm Db C",   // Dune : mode oriental (phrygien dominant), flûte puis voix
      A: nt("7,1.5 8,.5 7,1 4,1  5,.5 4,.5 1,.5 4,.5 0,2  4,.5 5,.5 7,.5 8,.5 10,1 8,.5 7,.5  8,1 7,.75 5,.25 4,2"),
      B: nt("12,2 13,1 12,1  10,1 8,1 7,2  8,1.5 7,.5 5,.5 4,.5 5,1  4,1 1,1 0,2") },
    chateau: { m: 3, H: "C Am F G C E7 Am G7 F Fm C A7 Dm G7 C C",   // le Château : une valse
      A: nt("7,2 12,1  11,1 9,1 4,1  5,1.5 9,.5 12,1  11,3  7,2 12,1  11,1 8,1 4,1  9,1.5 12,.5 16,1  14,3"),
      B: nt("17,2 16,1  15,1 12,1 8,1  7,1.5 12,.5 16,1  13,1 9,1 7,1  14,2 17,1  11,1 14,1 7,1  12,3  -,3") },
    terrier: { m: 3, H: "C Ab C Ab F Db G G7 C E Am F Db C G7 C",   // les Merveilles : boîte à musique fantasque, la gamme par tons qui « tombe dans le terrier »
      A: nt("12,1 16,1 14,.5 12,.5  8,1.5 10,.5 12,1  7,1 12,1 16,.5 19,.5  20,2 15,1  17,1 16,.5 14,.5 12,1  13,1.5 10,.5 8,1  7,1 11,1 14,1  17,2 14,1"),
      B: nt("12,.5 14,.5 16,.5 18,.5 20,.5 22,.5  23,1.5 20,.5 16,1  21,1 16,1 12,1  17,1.5 16,.5 12,1  13,1 17,1 20,1  19,2 16,1  14,1 17,1 11,1  12,3") },
    anneau: { m: 4, H: "Cm Bb F Gm Cm Bb Ab G",   // l'Anneau : flûte irlandaise (mode dorien), puis cor et cordes épiques
      A: nt("7,.5 5,.25 7,.25 10,.5 7,.5 3,1 5,.5 7,.5  10,.5 12,.5 14,.5 12,.5 10,1 5,1  9,.5 7,.5 5,.5 9,.5 12,1.5 10,.5  7,.5 5,.5 2,.5 5,.5 7,2"),
      B: nt("0,1.5 3,.5 7,2  5,1 2,1 -2,2  3,1.5 5,.5 8,1 7,1  7,2 11,2") },
    pandora: { m: 4, H: "C Am F G C Am F Csus",   // Pandora : gamme pentatonique, flûte et chœur aérien
      A: nt("9,1 7,.5 4,.5 7,2  12,1 9,.5 7,.5 4,2  9,.5 12,.5 14,1 12,1 9,1  7,3 -,1"),
      B: nt("16,1 14,.5 12,.5 14,2  12,1 9,1 7,2  9,.5 12,.5 9,.5 7,.5 4,1 2,1  2,2 0,2") },
    etoiles: { m: 4, H: "C Am F G Ab Bb C C",   // les Étoiles : fanfare héroïque (cuivres), cadence lab-sib-do
      A: nt("0,.75 0,.25 4,1 7,1.5 9,.5  7,2 5,1 4,1  2,.75 2,.25 5,1 9,1.5 7,.5  11,3 -,1"),
      B: nt("12,.75 10,.25 8,1 15,2  14,.75 12,.25 10,1 17,2  16,1.5 14,.5 12,1 7,1  12,4") },
    ratatouille: { m: 3, H: "Am Am E7 E7 E7 E7 Am Am Dm Dm Am Am E7 E7 Am Am",   // le Petit Chef : valse musette (accordéon)
      A: nt("4,1 3,.5 4,.5 9,1  12,2 9,1  11,1 10,.5 11,.5 14,1  17,2 16,1  14,1 13,.5 14,.5 11,1  8,2 4,1  9,1 11,1 12,1  9,3"),
      B: nt("2,1 1,.5 2,.5 5,1  9,2 5,1  4,1 3,.5 4,.5 9,1  12,2 9,1  11,1 8,.5 11,.5 14,1  17,1 16,1 14,1  12,1 11,.5 12,.5 16,1  9,3") },
    envers: { m: 4, H: "Cm Ab Eb Bb Cm Ab Fm G",   // le Monde à l'envers : synthé rétro années 80, do mineur
      A: nt("7,2 8,1 7,1  8,1.5 7,.5 3,2  10,2 7,1 3,1  5,3 2,1"),
      B: nt("15,2 14,1 12,1  12,2 8,2  8,1.5 7,.5 5,1 8,1  7,2 11,2") },
    odyssee: { m: 4, H: "C Bb C F C Bb F C",   // l'Odyssée : lyre et aulos (mode mixolydien), la mer
      A: nt("7,1 10,.5 9,.5 7,1 4,1  5,1.5 2,.5 -2,2  0,.5 4,.5 7,.5 10,.5 12,1 10,1  9,2 5,2"),
      B: nt("16,1 14,.5 12,.5 10,1 12,1  14,2 10,2  12,1 9,.5 10,.5 9,1 5,1  7,2 4,1 0,1") },
    chocolat: { m: 4, H: "C Am Dm G7 Cm Ab Fm G7",   // la Chocolaterie : orgue de foire sautillant, puis un passage en mineur, plus mystérieux
      A: nt("7,.5 12,.5 11,.5 12,.5 16,1 12,1  9,.5 12,.5 16,.5 12,.5 9,2  14,.5 17,.5 16,.5 14,.5 12,.5 9,.5 5,1  7,.5 11,.5 14,.5 17,.5 19,2"),
      B: nt("12,.5 11,.5 10,.5 9,.5 8,1 7,1  8,.5 12,.5 15,.5 12,.5 8,2  17,.5 15,.5 12,.5 8,.5 5,1 8,1  7,1 11,1 14,1 -,1") },
    titans: { m: 4, H: "Cm Cm Ab Ab Fm Fm Db G",   // le Mur des titans : cuivres graves, chœur sombre, tambours
      A: nt("0,1.5 -1,.5 0,1 3,1  7,3 5,1  3,1.5 2,.5 0,1 -4,1  0,4"),
      B: nt("8,2 7,1 5,1  12,3 8,1  13,2 12,1 8,1  11,2 7,2") },
    multivers: { m: 4, H: "C Ab Eb Bb C Ab Bb C",   // le Multivers : la Finale, synthé cosmique épique (air maison : ni montée do-sol-do, ni mi qui glisse en mi bémol)
      A: nt("7,.5 4,.5 7,.5 12,.5 14,1.5 12,.5  15,1 12,1 8,2  10,.5 7,.5 3,.5 7,.5 10,1 15,1  14,3 -,1"),
      B: nt("12,.5 16,.5 19,1 16,.5 12,.5 7,1  8,1 12,1 15,2  14,1 17,1 14,.5 10,.5 5,1  12,4") }
  };

  /* ==================== v17.48 · Le thème de la COURSE (un par circuit, clé « peint ») ====================
     Joué en fond, volume bas, de « C'est parti » à l'arrivée (fondu avant le jingle et le klaxon), puis plus rien.
     Une recette = tempo, tonique, longueur de la boucle (en temps) et partition(add) qui pose une boucle : add(temps, instrument, demi-tons, durée en temps, volume).
     Posé petit à petit sur l'horloge audio (≈ 1 s d'avance), jamais au-delà de la fin de la course : aucune boucle infinie. */
  const THEMES_COURSE = {
    garage: {   // L'Atelier du Père Noël : « Jingle Bells » (1857), arrangement maison : célesta, grelots, pizzicati, cloche, glockenspiel
      tempo: 192, tonique: 523.25, longueur: 64, gain: .26,   // 16 mesures à 192 = une boucle de 20 s pile
      partition(add) {
        // la mélodie au célesta ; la 2e moitié doublée à l'octave par un glockenspiel discret
        let t = 0; NOEL_A.concat(NOEL_B, NOEL_A, NOEL_C).forEach(([st, d]) => { add(t, "celesta", st, d, .3); if (t >= 32) add(t, "glock", st + 12, d, .07); t += d; });
        // l'harmonie, une mesure par accord : [fondamentale, quinte] pour la basse pizzicato (temps 1 et 3), [2 notes] pour le contretemps (temps 2 et 4)
        const H = { C: [-12, -17, [-8, -5]], F: [-7, -12, [-3, 0]], D7: [-10, -15, [-6, 0]], G7: [-17, -10, [-7, -1]] };
        "C C C C F C D7 G7 C C C C F C G7 C".split(" ").forEach((a, m) => { const [r, q, cc] = H[a], b = m * 4;
          add(b, "pizz", r, 1, .2); add(b + 2, "pizz", q, 1, .16);
          [1, 3].forEach(k => cc.forEach(st => add(b + k, "pizz", st, 1, .075)));
          // les grelots du traîneau à chaque croche, plus forts sur 2 et 4
          for (let k = 0; k < 8; k++) add(b + k / 2, "grelots", 0, .3, k === 2 || k === 6 ? .085 : .04);
          // les sabots du cheval (mesures 5-8 et 13-16)
          if (m % 8 >= 4) [0, 2].forEach(k => add(b + k + .5, "bloc", 0, .2, .05));
        });
        // la cloche au début de chaque grande phrase, et un arpège de glockenspiel dans les notes tenues (mesures 4, 8, 12)
        [0, 32].forEach(b => add(b, "cloche", 0, 4, .045));
        [[12, [7, 12, 16, 19, 24]], [28, [11, 14, 17, 19, 23]], [44, [7, 12, 16, 19, 24]]].forEach(([b, l]) => l.forEach((st, k) => add(b + 1 + k * .5, "glock", st, .5, .06)));
        // mesure 16 : une petite cascade de clochettes qui relance la boucle
        [12, 14, 16, 17, 19, 21, 23, 24].forEach((st, k) => add(62 + k * .25, "clochette", st, .25, .03 + k * .004));
      } },
    /* v20.53 · les 12 circuits 2027 : une boucle de 15 à 24 s par circuit (airs composés ici, voir AIRS) */
    dunes: { tempo: 84, tonique: 523.25, longueur: 32, gain: 0.17,   // bourdon grave, oud pincé, darbouka (dum-tek), flûte puis voix, sable et vent
      partition(add) { const A = AIRS.dunes;
        add(0, "bourdon", -12, 33, .05);
        jouer(add, 0, "flute", A.A, .3); jouer(add, 16, "voix", A.B, .2); jouer(add, 16, "flute", A.B, .06, 12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          jouer(add, b, "pizz", nt("-12,.5 -11,.5 -8,.5 -11,.5 -12,.5 -5,.5 -7,.5 -8,.5"), .09);
          [[0, "dum", .3], [.5, "tek", .1], [1.5, "tek", .13], [2, "dum", .22], [3, "tek", .13], [3.5, "tek", .07]].forEach(([dt, i, v]) => add(b + dt, i, 0, .3, v));
          if (k >= 4) { add(b, "tambour", 0, 1, .1); c.slice(1).forEach(st => add(b, "voix", st, 4, .022)); }
          if (k % 4 === 0) add(b, "clochette", 24, 1, .035);
        });
        [0, 16].forEach(b => add(b, "sable", 0, 3, .05)); [8, 24].forEach(b => add(b, "vent", 0, 6, .05));
      } },
    chateau: { tempo: 176, tonique: 523.25, longueur: 48, gain: 0.302,   // valse : célesta, clavecin (basse et accords), glockenspiel magique, cloche du château
      partition(add) { const A = AIRS.chateau;
        jouer(add, 0, "celesta", A.A, .3); jouer(add, 24, "celesta", A.B, .3); jouer(add, 24, "glock", A.B, .05, 12);
        accords(A.H).forEach((c, k) => { const b = k * 3; add(b, "clavecin", c[0], 1, .15); [1, 2].forEach(j => [c[2], c[3]].forEach(st => add(b + j, "clavecin", st, 1, .055))); });
        [0, 24].forEach(b => add(b, "cloche", -12, 6, .04));
        [0, 4, 7, 12, 16, 19, 24].forEach((st, k) => add(45.4 + k * .37, "clochette", st, .4, .03 + k * .004));   // la baguette magique relance la boucle
      } },
    terrier: { tempo: 168, tonique: 523.25, longueur: 48, gain: 0.232,   // boîte à musique, pizzicati, tic-tac du lapin, la tasse du goûter, la note qui tombe
      partition(add) { const A = AIRS.terrier;
        jouer(add, 0, "boite", A.A, .32); jouer(add, 24, "boite", A.B, .3); jouer(add, 24, "celesta", A.B, .06, -12);
        accords(A.H).forEach((c, k) => { const b = k * 3; add(b, "pizz", c[0], 1, .18); [c[2], c[3]].forEach(st => add(b + 1, "pizz", st, 1, .05));
          add(b + 1, "tictac", 24, .1, .045); add(b + 2, "tictac", 19, .1, .04); });
        [9, 33].forEach(b => add(b + 1, "tasse", 0, .3, .05)); [22.5, 46.5].forEach(b => add(b, "chute", 24, 1.4, .07));
      } },
    anneau: { tempo: 100, tonique: 523.25, longueur: 32, gain: 0.186,   // flûte irlandaise et harpe, bodhran ; puis cor, cordes et timbales (l'épopée)
      partition(add) { const A = AIRS.anneau;
        jouer(add, 0, "flute", A.A, .22, 12); jouer(add, 16, "cor", A.B, .24, -12); jouer(add, 16, "flute", A.B, .07, 12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          if (k < 4) { [c[1], c[2], c[3], c[1] + 12, c[2] + 12, c[3], c[2], c[3]].forEach((st, j) => add(b + j * .5, "harpe", st, .5, j ? .07 : .1)); c.slice(1).forEach(st => add(b, "cordes", st, 4, .018)); }
          else { c.slice(1).forEach(st => add(b, "cordes", st, 4, .045)); add(b, "timbale", c[0], 1, .2); add(b + 2, "tambour", 0, 1, .12); add(b, "harpe", c[1] + 12, 1, .08); }
          [[0, .2], [.75, .07], [1, .12], [2, .17], [2.75, .07], [3, .12]].forEach(([dt, v]) => add(b + dt, "dum", 0, .3, v));
        });
        for (let k = 0; k < 8; k++) add(30 + k * .25, "timbale", -12, .25, .05 + k * .014);   // le roulement qui relance
      } },
    pandora: { tempo: 104, tonique: 523.25, longueur: 32, gain: 0.193,   // marimba en 3-3-2, percussions tribales, chœur aérien, flûte, lucioles (pings)
      partition(add) { const A = AIRS.pandora;
        jouer(add, 0, "flute", A.A, .28); jouer(add, 16, "flute", A.B, .28); jouer(add, 16, "voix", A.B, .05, -12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          [[0, c[1], .18], [.75, c[2], .12], [1.5, c[3], .13], [2.25, c[1] + 12, .11], [3, c[2] + 12, .12], [3.5, c[3], .1]].forEach(([dt, st, v]) => add(b + dt, "mailloche", st, .5, v));
          c.slice(1).forEach(st => add(b, "voix", st + 12, 4, .022));
          [[0, "tambour", .15], [1.5, "dum", .11], [2.5, "tambour", .1], [3, "dum", .1]].forEach(([dt, i, v]) => add(b + dt, i, 0, .4, v));
          for (let j = 0; j < 8; j++) add(b + j * .5, "shaker", 0, .2, j % 2 ? .04 : .022);
          if (k % 2) add(b + 2.5, "ping", 24 + (k % 4 === 1 ? 4 : 7), 1, .045);
        });
      } },
    etoiles: { tempo: 116, tonique: 523.25, longueur: 32, gain: 0.216,   // fanfare héroïque : trompettes doublées au cor, cordes en ostinato, timbales et caisse claire
      partition(add) { const A = AIRS.etoiles;
        jouer(add, 0, "cuivre", A.A.concat(A.B), .15); jouer(add, 0, "cor", A.A.concat(A.B), .08, -12);
        accords(A.H).forEach((c, k) => { const b = k * 4, r = c[0] + 12;
          [r, r, r + 7, r, r, r + 7, r + 12, r + 7].forEach((st, j) => add(b + j * .5, "cordes", st, .45, j % 2 ? .03 : .045));
          add(b, "timbale", c[0], 1, .22); add(b + 2, "timbale", c[0], 1, .14); add(b + 1, "caisse", 0, .2, .09); add(b + 3, "caisse", 0, .2, .09);
          if (k === 3 || k === 7) { add(b + 3.33, "caisse", 0, .2, .06); add(b + 3.67, "caisse", 0, .2, .075); }
          if (k === 4 || k === 5) c.slice(1).forEach(st => add(b, "cuivre", st, 3, .04));
        });
      } },
    ratatouille: { tempo: 184, tonique: 523.25, longueur: 48, gain: 0.18,   // valse musette : accordéon, basse pincée, « pom-pom » d'accordéon, la casserole qui tinte
      partition(add) { const A = AIRS.ratatouille;
        jouer(add, 0, "accordeon", A.A.concat(A.B), .15); jouer(add, 24, "celesta", A.B, .05, 12);
        accords(A.H).forEach((c, k) => { const b = k * 3; add(b, "pizz", c[0], 1, .2); [1, 2].forEach(j => [c[2], c[3]].forEach(st => add(b + j, "accordeon", st, .45, .035))); });
        [23.5, 47].forEach(b => add(b, "casserole", 0, .8, .055)); add(10, "tasse", 0, .3, .04);
      } },
    envers: { tempo: 100, tonique: 523.25, longueur: 32, gain: 0.232,   // synthés des années 80 : basse en octaves, séquenceur, nappe, boîte à rythmes ; le son « aspiré » relance la boucle
      partition(add) { const A = AIRS.envers;
        jouer(add, 0, "synth", A.A.concat(A.B), .12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          for (let j = 0; j < 8; j++) { const t = b + j * .5; add(t, "arp", c[0] + (j % 2 ? 12 : 0), .5, .08, .35 + .3 * Math.sin(t / 32 * 6.283)); }
          [c[3], c[1], c[2], c[1]].forEach((st, j) => [0, 1, 2, 3].forEach(q => add(b + q + j * .25, "arp", st + 12, .25, .028, .55)));
          c.slice(1).forEach(st => add(b, "nappe", st, 4, .028));
          add(b, "dum", 0, .3, .2); add(b + 2.5, "dum", 0, .3, .16); add(b + 1, "caisse", 0, .2, .1); add(b + 3, "caisse", 0, .2, .1);
          for (let j = 0; j < 8; j++) add(b + j * .5, "shaker", 0, .2, j % 2 ? .028 : .016);
        });
        add(30, "aspire", 0, 2, .07);
      } },
    odyssee: { tempo: 88, tonique: 523.25, longueur: 32, gain: 0.204,   // lyre en arpèges, aulos (flûte), tambour sur cadre, les vagues de la mer Égée
      partition(add) { const A = AIRS.odyssee;
        jouer(add, 0, "flute", A.A, .27); jouer(add, 16, "flute", A.B, .27); jouer(add, 16, "harpe", A.B, .08, -12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          [c[1], c[2], c[3], c[1] + 12, c[3] + 12, c[3], c[2], c[3]].forEach((st, j) => add(b + j * .5, "harpe", st, .5, j ? .075 : .1));
          add(b, "dum", 0, .3, .14); add(b + 1.5, "dum", 0, .3, .07); add(b + 2, "dum", 0, .3, .1); add(b + 3, "tek", 0, .2, .05);
          if (k % 2 === 0) add(b, "vague", 0, 6, .06);
        });
      } },
    chocolat: { tempo: 126, tonique: 523.25, longueur: 32, gain: 0.254,   // orgue de foire en « oum-pa », glockenspiel, bloc de bois, chocolat qui pétille
      partition(add) { const A = AIRS.chocolat;
        jouer(add, 0, "orgue", A.A.concat(A.B), .16); jouer(add, 0, "glock", A.A, .035, 12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          add(b, "orgue", c[0], .5, .13); add(b + 2, "orgue", c[0] + 7, .5, .11); [1, 3].forEach(j => [c[2], c[3]].forEach(st => add(b + j, "orgue", st, .4, .045)));
          if (k >= 4) [.5, 1.5, 2.5, 3.5].forEach(j => add(b + j, "bloc", 0, .1, .05));
        });
        add(0, "petille", 0, 4, .04); add(16, "petille", 0, 4, .04);
        [12, 16, 19, 24].forEach((st, k) => add(31 + k * .25, "boite", st, .25, .12));   // la petite cascade qui relance
      } },
    titans: { tempo: 84, tonique: 523.25, longueur: 32, gain: 0.237,   // tambours de guerre, chœur sombre, cuivres graves, cordes qui martèlent, le choc sourd du mur
      partition(add) { const A = AIRS.titans;
        jouer(add, 0, "cuivre", A.A, .17, -12); jouer(add, 16, "voix", A.B, .11); jouer(add, 16, "cor", A.B, .1, -12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          c.slice(1).forEach(st => add(b, "voix", st, 4, .03));
          for (let j = 0; j < 8; j++) add(b + j * .5, "cordes", c[0] + (j === 3 || j === 7 ? 1 : 0) + 12, .4, j % 4 ? .028 : .045);
          [[0, .3], [.75, .14], [1.5, .2], [2, .28], [3, .2], [3.5, .14]].forEach(([dt, v]) => add(b + dt, "tambour", 0, 1, v));
          if (k % 2 === 0) add(b, "choc", 0, 1, .18);
        });
        add(28, "montee", 0, 4, .05); add(28, "timbale", -12, 1, .18); add(30, "timbale", -12, 1, .2);
      } },
    multivers: { tempo: 124, tonique: 523.25, longueur: 32, gain: 0.224,   // la Finale : arpèges de synthé qui s'ouvrent, nappe cosmique, cuivres, timbales, montée finale
      partition(add) { const A = AIRS.multivers;
        jouer(add, 0, "cuivre", A.A.concat(A.B), .15); jouer(add, 16, "cor", A.B, .07, -12);
        accords(A.H).forEach((c, k) => { const b = k * 4;
          for (let j = 0; j < 16; j++) { const t = b + j * .25; add(t, "arp", [c[1], c[2], c[3], c[1] + 12][j % 4] + 12, .25, .03, .65 - .5 * Math.sin(t / 32 * 3.1416)); }
          c.slice(1).forEach(st => add(b, "nappe", st, 4, .028));
          add(b, "timbale", c[0], 1, .2); if (k >= 4) add(b + 2, "timbale", c[0], 1, .14); add(b + 1, "caisse", 0, .2, .08); add(b + 3, "caisse", 0, .2, .08);
          if (k % 4 === 0) add(b, "glock", c[3] + 24, 1, .05);
        });
        add(28, "montee", 0, 4, .045);
      } }
  };
  let theme = null, coursePlan = null;
  function partitionTheme(T) {
    if (T._evs) return T._evs; const E = [];
    T.partition((t, i, st, d, v, x) => E.push({ t, i, f: T.tonique * Math.pow(2, (st || 0) / 12), d, v, x }));   // v20.53 : x = réglage de l'instrument (filtre du synthé)
    return (T._evs = E.sort((a, b) => a.t - b.t));
  }
  function themeStop(f) {
    if (!theme) return; const M = theme; theme = null; clearInterval(M.iv);
    try { const t = M.c.currentTime; M.bus.gain.cancelScheduledValues(t); M.bus.gain.setValueAtTime(M.bus.gain.value, t); M.bus.gain.linearRampToValueAtTime(0, t + (f || .02)); } catch (e) { /* rien */ }
    setTimeout(() => { M.N.forEach(x => { try { x.stop(); } catch (e) { } }); M.N = []; try { M.bus.disconnect(); } catch (e) { } }, (f || .02) * 1000 + 120);
  }
  /** pose le thème de la course sur (c, sortie) de t0 à t0 + duree (s), en commençant « depuis » secondes dans la boucle ; avance = posé au fil de l'eau */
  function poserTheme(T, c, out, t0, duree, depuis, N, avance) {
    const b = 60 / T.tempo, L = T.longueur * b, evs = partitionTheme(T), fin = t0 + duree, M = { k: 0, j: 0 };
    const base = t0 - ((depuis || 0) % L);   // le début de la boucle en cours
    let i = evs.findIndex(e => base + e.t * b >= t0 - .001); if (i < 0) i = evs.length;
    M.pose = jusqua => {
      for (;;) {
        if (i >= evs.length) { i = 0; M.k++; }
        const e = evs[i], tt = base + M.k * L + e.t * b; if (tt > jusqua || tt >= fin - .05) return tt < fin - .05;
        try { INSTR[e.i](c, typeof out === "function" ? out(e) : out, tt, e.f, Math.min(e.d * b, fin - tt), e.v, N, e.x); } catch (er) { /* rien */ } i++;   // v17.59 : out peut choisir le bus selon l'instrument (ambiance)
      }
    };
    M.pose(avance == null ? fin : t0 + avance); return M;
  }
  /** le thème d'un circuit pendant la course : duree en s ; renvoie true s'il joue */
  function themeCourse(cle, duree, depuis) {
    themeStop(.05); const T = THEMES_COURSE[cle], c = audio(); if (!T || !c || duree < .4) return false;
    const bus = c.createGain(), t0 = c.currentTime + .03, fin = t0 + duree; bus.connect(maitre);
    bus.gain.setValueAtTime(0, t0); bus.gain.linearRampToValueAtTime(T.gain, t0 + (depuis ? .5 : .25));
    bus.gain.setValueAtTime(T.gain, Math.max(t0 + .5, fin - .5)); bus.gain.linearRampToValueAtTime(0, fin + .1);   // filet : il s'éteint seul à la fin prévue
    const M = theme = { c, bus, N: [], cle };
    const P = poserTheme(T, c, bus, t0, duree, depuis, M.N, 1.2);
    M.iv = setInterval(() => { if (theme !== M) return; if (!P.pose(c.currentTime + 1.2)) { clearInterval(M.iv); } }, 300);
    plus_tard((duree + .6) * 1000, () => { if (theme === M) themeStop(.05); });
    return true;
  }
  /* outil d'écoute (tests) : le thème rendu hors ligne, n secondes */
  function ecouteTheme(cle, n) { const T = THEMES_COURSE[cle]; return horsLigne(n, (c, m) => { const bus = c.createGain(); bus.gain.value = T.gain; bus.connect(m); poserTheme(T, c, bus, 0, n, 0, []); }); }

  /* ==================== v17.59 · L'AMBIANCE du plein écran (v20.53 : les 13 circuits, Noël et les 12 de 2027) ====================
     Dès l'entrée en plein écran et hors course (Carte au repos, Visite, Hélico, Survol) : une version douce du thème, célesta + grelots seulement
     (ni pizzicati ni basse), plus lente et plus basse que le thème de la course. Pendant la course (▶) : le thème complet ; à l'arrivée, après le
     jingle et le klaxon, l'ambiance revient en fondu. 4 parties enchaînées sans coupure (anti-lassitude) : la mélodie · les accords seuls ·
     la mélodie (2e refrain) · une respiration de grelots presque silencieuse ; après une pause, elle reprend à la partie suivante.
     Se tait en fondu : sortie du plein écran, 3 min sans toucher l'écran (reprend au toucher suivant), onglet caché, 🔇 ; jamais deux à la fois.
     Posée petit à petit sur l'horloge audio (≈ 1,2 s d'avance) par la même mécanique que le thème ; la liste des sons gardés est bornée. */
  const AMBIANCES = {
    garage: { tempo: 152, tonique: 523.25, gain: .14, longueur: 112, sections: [0, 32, 64, 96],
      partition(add) {
        // les accords, sans basse (rien sous do 4) : [3 notes] par mesure
        const H = { C: [-12, -8, -5], F: [-7, -3, 0], D7: [-10, -6, 0], G7: [-5, -1, 5] };
        const grelots = (b0, nb) => { for (let m = 0; m < nb; m++) [1, 3].forEach(k => add(b0 + m * 4 + k, "grelots", 0, .3, .045)); };
        const melodie = (b0, l, v) => { let t = b0; l.forEach(([st, d]) => { add(t, "celesta", st, d, v); t += d; }); };
        // 1 · la mélodie (refrain, 1re moitié) et une note d'accord douce par mesure
        melodie(0, NOEL_A.concat(NOEL_B), .24); grelots(0, 8);
        "C C C C F C D7 G7".split(" ").forEach((a, m) => add(m * 4, "celesta", H[a][1], 2, .06));
        // 2 · les accords seuls, en arpège montant ; un frisson de grelots par mesure
        "C C F C C F G7 C".split(" ").forEach((a, m) => { const b = 32 + m * 4; H[a].forEach((st, k) => add(b + k, "celesta", st, 1, .15 - k * .015)); add(b + 3, "celesta", H[a][0] + 12, 1, .08); add(b, "grelots", 0, .6, .035); });
        // 3 · la mélodie (2e moitié du refrain)
        melodie(64, NOEL_A.concat(NOEL_C), .22); grelots(64, 8);
        "C C C C F C G7 C".split(" ").forEach((a, m) => add(64 + m * 4, "celesta", H[a][1], 2, .06));
        // 4 · la respiration : deux longs frissons de grelots, deux notes isolées, puis presque rien
        add(96, "grelots", 0, 2, .05); add(100, "celesta", 7, 2, .08); add(104, "grelots", 0, 1.5, .04); add(108, "celesta", 12, 3, .055);
      } },
    /* v20.53 · les 12 circuits 2027, même forme que Noël (voir ambianceDe) */
    dunes: ambianceDe("dunes", { tempo: 64, gain: 0.096, lead: "flute", vL: .22, lead2: "voix", vL2: .14, arp: "pizz", vA: .11, vif: "clochette",
      tex: [["bourdon", -12, 17, .03, 16], ["vent", 0, 6, .045, 16, 8], ["clochette", 24, 1, .03, 16]] }),
    chateau: ambianceDe("chateau", { tempo: 132, gain: 0.154, lead: "celesta", vL: .22, lead2: "boite", vL2: .24, arp: "harpe", vA: .11, vif: "glock",
      tex: [["cloche", -12, 6, .028, 48], ["glock", 24, 1, .025, 24, 12]] }),
    terrier: ambianceDe("terrier", { tempo: 120, gain: 0.145, lead: "boite", vL: .24, lead2: "celesta", vL2: .2, arp: "harpe", vA: .1, vif: "tictac",
      tex: [["tictac", 24, .1, .022, 3, 1], ["tasse", 0, .3, .03, 24, 10]] }),
    anneau: ambianceDe("anneau", { tempo: 80, gain: 0.098, lead: "flute", vL: .2, dL: 12, lead2: "cor", vL2: .17, dL2: -12, arp: "harpe", vA: .11, vif: "clochette", tenue: ["cordes", .014],
      tex: [["vent", 0, 6, .035, 16, 4], ["clochette", 24, 1, .025, 16, 12]] }),
    pandora: ambianceDe("pandora", { tempo: 84, gain: 0.101, lead: "flute", vL: .22, lead2: "voix", vL2: .12, arp: "mailloche", vA: .13, vif: "ping", tenue: ["voix", .014, 12],
      tex: [["souffle", 0, 4, .035, 16], ["ping", 26, 1, .035, 8, 3]] }),
    etoiles: ambianceDe("etoiles", { tempo: 92, gain: 0.111, lead: "cor", vL: .18, lead2: "cordes", vL2: .07, arp: "glock", vA: .08, vif: "glock",
      tex: [["mecanique", 0, 2, .035, 32, 16]] }),
    ratatouille: ambianceDe("ratatouille", { tempo: 132, gain: 0.129, lead: "accordeon", vL: .1, lead2: "celesta", vL2: .2, dL2: 12, arp: "pizz", vA: .12, vif: "casserole",
      tex: [["casserole", 0, .8, .028, 24, 23]] }),
    envers: ambianceDe("envers", { tempo: 84, gain: 0.15, lead: "synth", vL: .09, lead2: "nappe", vL2: .06, dL2: 12, arp: "arp", vA: .07, vif: "arp", tenue: ["nappe", .016],
      tex: [["aspire", 0, 2, .045, 32, 30], ["vent", 0, 6, .025, 16, 8]] }),
    odyssee: ambianceDe("odyssee", { tempo: 72, gain: 0.145, lead: "harpe", vL: .22, lead2: "flute", vL2: .2, arp: "harpe", vA: .1, vif: "clochette",
      tex: [["vague", 0, 6, .05, 8], ["clochette", 19, 1, .025, 16, 6]] }),
    chocolat: ambianceDe("chocolat", { tempo: 100, gain: 0.15, lead: "boite", vL: .24, lead2: "orgue", vL2: .09, arp: "celesta", vA: .11, vif: "petille",
      tex: [["petille", 0, 3, .025, 16, 4]] }),
    titans: ambianceDe("titans", { tempo: 70, gain: 0.115, lead: "voix", vL: .12, lead2: "cor", vL2: .15, dL2: -12, arp: "cordes", vA: .05, vif: "tambour", tenue: ["voix", .016],
      tex: [["vent", 0, 6, .035, 16], ["tambour", 0, 1, .04, 4]] }),
    multivers: ambianceDe("multivers", { tempo: 96, gain: 0.131, lead: "glock", vL: .14, lead2: "cor", vL2: .15, dL2: -12, arp: "arp", vA: .06, vif: "glock", tenue: ["nappe", .018],
      tex: [["souffle", 0, 4, .025, 16, 8]] })
  };
  /** v20.53 · une ambiance du plein écran à partir de l'air du circuit, sur le modèle de Noël, en 4 parties enchaînées :
   *  la mélodie (lead) + une note d'accord douce par mesure · les accords seuls, en arpège · la mélodie (lead2) · une respiration presque silencieuse.
   *  Ni basse ni batterie ; o.tenue = [instrument, volume, transposition] : les accords tenus sous la mélodie ; o.tex = [instrument, demi-tons, durée, volume, tous les n temps, décalage] ;
   *  o.vif = l'instrument que la chasse au trésor fait ressortir (bonus chaud-froid). */
  function ambianceDe(cle, o) {
    const A = AIRS[cle], H = accords(A.H), m = A.m, n = H.length * m, M = A.A.concat(A.B), R = 4 * m, L = 3 * n + R;
    return { tempo: o.tempo, tonique: 523.25, gain: o.gain || .14, longueur: L, sections: [0, n, 2 * n, 3 * n], vif: o.vif,
      partition(add) {
        const doux = b0 => H.forEach((c, k) => { add(b0 + k * m, o.arp, c[2], Math.min(2, m), o.vA * .5); if (o.tenue) c.slice(1).forEach(st => add(b0 + k * m, o.tenue[0], st + (o.tenue[2] || 0), m, o.tenue[1])); });
        jouer(add, 0, o.lead, M, o.vL, o.dL); doux(0);
        H.forEach((c, k) => { const b = n + k * m; c.slice(1).forEach((st, j) => add(b + j, o.arp, st, 1, o.vA * (1 - j * .1))); if (m > 3) add(b + 3, o.arp, c[1] + 12, 1, o.vA * .55); });
        jouer(add, 2 * n, o.lead2, M, o.vL2, o.dL2); doux(2 * n);
        const n0 = M.find(x => x[0] !== null)[0];
        add(3 * n + m, o.lead, n0 + (o.dL || 0), 2, o.vL * .5); for (let j = 0; j < R; j++) { const c = H[Math.floor(j / m) % H.length]; add(3 * n + j, o.arp, c[1 + j % 3] + 12, 1.5, o.vA * (j % m ? .6 : .85)); }   // un arpège doux, une note par temps : jamais plus de 3 s de silence
        add(3 * n + 3 * m - (m > 3 ? 1 : 0), o.lead2, (o.dL2 || 0) + 12 * (o.dL2 < 0 ? 1 : 0), 3, o.vL2 * .4);   // la respiration ne laisse jamais plus de 3 s de silence
        (o.tex || []).forEach(([i, st, d, v, per, dec]) => { for (let t = dec || 0; t < L - .01; t += per) add(t, i, st, d, v); });
      } };
  }
  const AMB_CHALEUR = [1, 1.2, 1.4, 1.65];   // bonus chasse au trésor : les grelots un peu plus présents, au même palier que la jauge chaud-froid affichée (jamais plus fin, jamais avant)
  let amb = null;
  const AMB = { cle: null, calme: 180000, dernier: performance.now(), courseJusqua: 0, pos: {}, chaleur: -1, iv: null };
  const ambBloquee = () => !AMB.cle || !AMBIANCES[AMB.cle] || !actif() || document.visibilityState === "hidden" || performance.now() - AMB.dernier > AMB.calme ||
    performance.now() < AMB.courseJusqua || !!theme || !!moteur || !!(mus && !mus.fini) ||
    !!document.querySelector(".fc-voile, .ba, .ere-voile");   // une cérémonie (fête de la chauffe, bande-annonce, premier million) a son propre son : l'ambiance attend qu'elle se ferme
  function ambStop(f) {
    if (!amb) return; const M = amb; amb = null; clearInterval(M.iv);
    try { const T = AMBIANCES[M.cle], L = T.longueur * 60 / T.tempo, ici = ((M.c.currentTime - M.t0) + M.depuis) % L, b = 60 / T.tempo;   // la partie suivante, pour la reprise
      AMB.pos[M.cle] = (T.sections.map(s => s * b).find(s => s > ici + .05) || 0) % L; } catch (e) { /* rien */ }
    try { const t = M.c.currentTime; M.bus.gain.cancelScheduledValues(t); M.bus.gain.setValueAtTime(M.bus.gain.value, t); M.bus.gain.linearRampToValueAtTime(0, t + (f || .05)); } catch (e) { /* rien */ }
    setTimeout(() => { M.N.forEach(x => { try { x.stop(); } catch (e) { } }); M.N = []; try { M.bus.disconnect(); } catch (e) { } }, (f || .05) * 1000 + 150);
  }
  function ambDemarrer() {
    const T = AMBIANCES[AMB.cle], c = audio(); if (!T || !c) return;
    const bus = c.createGain(), busG = c.createGain(), t0 = c.currentTime + .05, depuis = AMB.pos[AMB.cle] || 0, monte = depuis ? 1.5 : 2.5;
    bus.gain.setValueAtTime(0, t0); bus.gain.linearRampToValueAtTime(T.gain, t0 + monte); bus.connect(maitre);
    busG.gain.value = AMB_CHALEUR[Math.max(0, AMB.chaleur)] || 1; busG.connect(bus);
    const M = amb = { c, bus, busG, N: [], cle: AMB.cle, t0, depuis };
    const P = poserTheme(T, c, e => e.i === (T.vif || "grelots") ? busG : bus, t0, Infinity, depuis, M.N, 1.2);
    M.iv = setInterval(() => { if (amb !== M) return; P.pose(c.currentTime + 1.2); if (M.N.length > 500) M.N.splice(0, M.N.length - 300); }, 300);   // les sons déjà joués sont oubliés : la liste reste bornée
  }
  /** démarre ou coupe l'ambiance selon l'état (appelée par la sentinelle, au toucher, et à chaque changement) */
  function ambVerifier(fondu) {
    const non = ambBloquee();
    if (non && amb) ambStop(fondu || (performance.now() - AMB.dernier > AMB.calme ? 3 : .4));
    else if (!non && !amb) ambDemarrer();
    else if (amb && amb.cle !== AMB.cle) { ambStop(.5); ambDemarrer(); }
  }
  /** le plein écran s'ouvre (clé « peint » du circuit) ou se ferme (null) */
  function ambiance(cle) {
    const k = cle && AMBIANCES[cle] ? cle : null;
    if (k === AMB.cle && (k ? AMB.iv : true)) return !!k;
    AMB.cle = k; AMB.dernier = performance.now();
    if (!k) { clearInterval(AMB.iv); AMB.iv = null; AMB.chaleur = -1; ambStop(1.2); return false; }
    if (!AMB.iv) AMB.iv = setInterval(() => ambVerifier(), 500);   // la sentinelle n'existe que pendant le plein écran d'un circuit à thème
    ambVerifier(); return true;
  }
  /** bonus chasse au trésor : n = palier de la jauge chaud-froid AFFICHÉE (0-3), -1 = pas de jauge à l'écran */
  function chaleur(n) {
    n = n == null || n < 0 ? -1 : Math.min(3, n | 0); if (n === AMB.chaleur) return; AMB.chaleur = n;
    if (!amb) return; try { const g = amb.busG.gain, t = amb.c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(AMB_CHALEUR[Math.max(0, n)], t + .6); } catch (e) { /* rien */ }
  }
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(ev => document.addEventListener(ev, () => { const dormait = performance.now() - AMB.dernier > AMB.calme; AMB.dernier = performance.now(); if (dormait && AMB.iv) ambVerifier(); }, { passive: true, capture: true }));
  /* outil d'écoute (tests) : l'ambiance rendue hors ligne, n secondes, les parties enchaînées */
  function ecouteAmbiance(cle, n) { const T = AMBIANCES[cle]; return horsLigne(n, (c, m) => { const bus = c.createGain(); bus.gain.value = T.gain; bus.connect(m); poserTheme(T, c, bus, 0, n, 0, []); }); }

  /* la partition : la liste des notes, en secondes depuis le début de la bande-annonce */
  function composer(R, o) {
    const b = 60 / R.tempo, E = [], P = o.plans.map(x => x / 1000), tF = o.tFeux / 1000, tO = o.tOut / 1000;
    const add = (t, i, st, d, v, fin, x) => { E.push({ t: Math.round(t * 1000) / 1000, i, f: R.tonique * Math.pow(2, (st || 0) / 12), d, v, fin: !!fin, x }); if (R.dbl && (i === R.mel || i === (R.tension || {}).inst) && v === (i === R.mel ? R.vMel : R.tension.v) && !fin) E.push(Object.assign({}, E[E.length - 1], { f: R.tonique * Math.pow(2, ((st || 0) + R.dbl) / 12), v: v * .7 })); };   // dbl : la mélodie doublée (quintes)
    const finale = (tf, enDirect) => { add(tf, "jingle", 0, 1.3, 1, enDirect); (R.fin || []).forEach(([i, dt, d, v, st]) => add(tf + dt, i, st, d, v, enDirect)); };
    // 1 · la signature, sur le plan du circuit
    const s0 = .15, bord = Math.min(P[1] != null ? P[1] : tF - b, s0 + 3);
    let t = s0; R.motif.forEach(([st, d]) => { if (t < bord - .1) add(t, R.mel, st, Math.min(d * b, bord - t + .3), R.vMel); t += d * b; });
    const finSig = Math.min(t, bord);
    for (let k = 0; s0 + k * b < finSig - .05; k++) R.pas[k % R.pas.length].forEach(([i, st, v, d, dt]) => add(s0 + (k + (dt || 0)) * b, i, st, d || b, v));
    (R.bruit || []).forEach(([i, dt, d, v, st]) => add(s0 + dt * b, i, st, d, v));
    if (o.reduit) { (R.fond || []).forEach(([i, st, v]) => add(s0, i, st, finSig + .2 - s0, v)); finale(finSig + .45, false); return E; }
    // 2 · la tension, sur la règle et le trésor ; un temps de silence avant les feux
    const T = R.tension, a = Math.max(finSig, P[1] != null ? P[1] : finSig), z = tF - b;
    (R.fond || []).forEach(([i, st, v]) => add(s0, i, st, Math.max(a, z) - s0, v));
    if (z - a > .3) {
      const sub = b / (T.sous || 1), av = tt => Math.max(0, Math.min(1, (tt - a) / (z - a))), pasDe = tt => T.accel ? 1 - T.accel * av(tt) : 1;   // accel : le tempo s'emballe
      for (let k = 0, tk = a; tk < z - .02; k++, tk += sub * pasDe(tk)) { const x = av(tk); T.puls.forEach(([i, st, v, tous, d]) => { if (k % (tous || 1) === 0) add(tk, i, st, d || sub, v * (.45 + .55 * x), false, x); }); }
      let tt = a + (T.retard || 0) * b, n = 0; [].concat(T.decal).forEach(dc => (T.motif || R.motif).forEach(([st, d]) => { const ins = [].concat(T.inst), i = ins[n++ % ins.length];   // une liste d'instruments = la cascade (Multivers)
        if (tt < z - .15) add(tt, i, (T.inverse ? -st : st) + dc, Math.min(d * b, z - tt), T.v, false, av(tt)); tt += d * b * pasDe(tt); }));   // le motif plus bas, puis un cran plus haut : ça monte ; inverse : il descend (Envers)
      P.slice(1).forEach(p => (T.accent || []).forEach(([i, dt, d, v, st]) => add(p + dt, i, st, d, v)));
      (T.monte || []).forEach(([i, d, v]) => add(Math.max(a, z - d), i, 0, Math.min(d, z - a), v));
    }
    // 3 · le jingle de l'univers en accord, sur « C'est parti ! » (posé en direct par le dernier feu, pour coller à l'image)
    finale(tO, true);
    return E;
  }
  function poser(M, evs, t0) {
    evs.forEach(e => { if (e.i === "jingle") jingleSur(M.c, M.busJ, t0 + e.t, M.cle, "accord", M.N); else INSTR[e.i](M.c, M.bus, Math.max(0, t0 + e.t), e.f, e.d, e.v, M.N, e.x); });
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
    lingots: [[1319, .08], [1568, .08], [2093, .12], [2637, .3]], cibles: [[880, .1], [1760, .25]], fusees: [[[300, 1800], .5]], trompette: [[523, .09], [523, .09], [523, .09], [784, .42]]
  };
  function klaxon(style) {
    const c = audio(); if (!c) return;
    if (style === "ouvriers") return fanfareOuvriers();
    // v20.68 · klaxons de départ : Pouet (trompe à poire, deux « pouet » qui glissent), Sifflet (deux coups de sifflet trillés), Trompette (« ta-ta-ta-taaa » de départ)
    if (style === "pouet") { note([360, 300], .16, "sawtooth", .12); note([180, 150], .16, "square", .07); note([470, 400], .3, "sawtooth", .12, .22); note([235, 200], .3, "square", .07, .22); return; }
    if (style === "sifflet") { [0, .24].forEach(t => { for (let k = 0; k < 6; k++) note(k % 2 ? 2650 : 2500, .03, "sine", .12, t + k * .03); }); note([2600, 2900], .45, "sine", .12, .52); return; }
    const m = MEL[style] || MEL.confettis; let dt = 0;
    m.forEach(([f, d]) => { note(f, d + .1, "square", .12, dt); note(Array.isArray(f) ? f : f * 1.5, d + .1, "triangle", .1, dt); dt += d; });
  }

  /** v20.46 · « Fanfare des petits ouvriers » (Chocolaterie) : une petite marche à nous, sautillante (tuba staccato, carillon qui répond, « pouet » final).
   *  Composée ici, aucune note d'une musique de film. */
  function fanfareOuvriers() {
    const tuba = [[196, 0], [262, .18], [196, .36], [262, .54], [220, .72], [247, .9], [262, 1.08]];
    tuba.forEach(([f, t]) => { note(f, .14, "sawtooth", .07, t); note(f / 2, .14, "triangle", .12, t); });
    [[1047, .2], [1319, .38], [1568, .56], [1319, .74], [1760, .92], [2093, 1.1]].forEach(([f, t]) => note(f, .22, "sine", .06, t));
    note([392, 523], .3, "square", .08, 1.3); note([523, 784], .35, "triangle", .1, 1.32);
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

  /* v16.93 · la bande-son d'un moment rare (8-eredor-demarrage.js) : un roulement qui monte, un tic à chaque palette du compteur,
     un silence, puis l'accord majeur, la cymbale, les pièces qui tintent et « VER-SUS ! » en majeur. Lancée par un toucher (le son se débloque) ;
     o = { ticks: [ms…], impact: ms, forcer } ; forcer = la personne a choisi d'activer le son pour CE moment alors qu'il est coupé dans les Réglages. */
  function sacre(o) {
    let c = null;
    try {
      if (!actif() && !o.forcer) return null;
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); maitre = sortie(ctx); }
      if (ctx.state === "suspended") ctx.resume();
      c = ctx;
    } catch (e) { return null; }
    let N = [], bus = null;
    const nouveauBus = () => { bus = c.createGain(); bus.gain.value = 1; bus.connect(maitre); };
    const tout = () => { N.forEach(x => { try { x.stop(); } catch (e) { /* déjà fini */ } }); N = []; try { bus.disconnect(); } catch (e) { } };
    const t0 = c.currentTime + .04, tI = t0 + o.impact / 1000;
    const leMillion = T => {   // l'impact, puis la fanfare
      INSTR.timbale(c, bus, T, 65.4, 0, .55, N); INSTR.choc(c, bus, T, 0, 0, .45, N);
      bruitF(c, env(c, bus, T, .002, 3.4, .32), T, 3.4, 6500, .7, "highpass", N);   // la cymbale
      bruitF(c, env(c, bus, T, .004, 1.6, .12), T, 1.6, 9500, 1.2, "bandpass", N);
      [261.63, 329.63, 392, 523.25].forEach((f, i) => { INSTR.cuivre(c, bus, T + i * .012, f, 2.6, .11, N); INSTR.cor(c, bus, T + .02, f / 2, 2.4, .05, N); });
      for (let k = 0; k < 18; k++) INSTR.clochette(c, bus, T + .55 + k * .09 + Math.random() * .05, 1900 + Math.random() * 1700, 0, .035 + Math.random() * .03, N);   // les pièces
      jingleSur(c, bus, T + 2.3, "multivers", "motif", N); jingleSur(c, bus, T + 3.15, "multivers", "accord", N);
      INSTR.timbale(c, bus, T + 3.15, 65.4, 0, .45, N); bruitF(c, env(c, bus, T + 3.15, .002, 2.6, .2), T + 3.15, 2.6, 7000, .7, "highpass", N);
      INSTR.cloche(c, bus, T + 3.2, 523.25, 0, .1, N); INSTR.glock(c, bus, T + 3.3, 2093, 0, .08, N); INSTR.glock(c, bus, T + 3.42, 2637, 0, .07, N);
    };
    try {
      nouveauBus();
      // le roulement : un seul bruit, haché par un oscillateur carré qui accélère, qui enfle puis se coupe net sur 999 999
      const fin = tI - 1.15, s = c.createBufferSource(), fl = c.createBiquadFilter(), hache = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      s.buffer = bruitDe(c); s.loop = true; fl.type = "bandpass"; fl.frequency.setValueAtTime(1600, t0); fl.frequency.linearRampToValueAtTime(2600, fin); fl.Q.value = .9;
      lfo.type = "square"; lfo.frequency.setValueAtTime(15, t0); lfo.frequency.linearRampToValueAtTime(27, fin); lg.gain.value = .5; hache.gain.value = .5;
      lfo.connect(lg); lg.connect(hache.gain); s.connect(fl); fl.connect(hache); hache.connect(g); g.connect(bus);
      g.gain.setValueAtTime(.0001, t0 + .15); g.gain.exponentialRampToValueAtTime(.34, fin - .05); g.gain.linearRampToValueAtTime(0, fin + .02);
      s.start(t0); lfo.start(t0); s.stop(fin + .1); lfo.stop(fin + .1); N.push(s, lfo);
      for (let t = .2; t < fin - t0 - .1; t += .5) INSTR.timbale(c, bus, t0 + t, 98, 0, .05 + .22 * t / (fin - t0), N);   // le grave qui pousse
      o.ticks.forEach((ms, i) => INSTR.tictac(c, bus, t0 + ms / 1000, 1900, 0, .08 + .06 * i / o.ticks.length, N));   // une palette = un tic
      leMillion(tI);
    } catch (e) { /* rien */ }
    return {
      /** « Passer » : on coupe tout et l'impact part maintenant */
      sauter() { try { tout(); nouveauBus(); leMillion(c.currentTime + .03); } catch (e) { /* rien */ } },
      arreter(f) { try { const t = c.currentTime, b = bus, M = N; b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + (f || .3)); N = []; setTimeout(() => { M.forEach(x => { try { x.stop(); } catch (e) { } }); try { b.disconnect(); } catch (e) { } }, (f || .3) * 1000 + 100); } catch (e) { /* rien */ } }
    };
  }

  const API = {
    sacre,
    actif, vibreOK, arreter, vibrer, klaxon, musiqueBA, bloque, debloquer, MUSIQUES, JINGLE_TIMBRE, _ecoute: ecoute, _ecouteJingles: ecouteJingles, _ecouteTheme: ecouteTheme, THEMES_COURSE, themeJoue: () => !!theme, _partition: composer,
    /** v17.59 · l'ambiance douce du plein écran (circuits à thème) ; chaleur = bonus chasse au trésor (palier de la jauge affichée) */
    AIRS, _instr: INSTR,
    ambiance, chaleur, AMBIANCES, ambianceJoue: () => !!amb, _ambN: () => amb ? amb.N.length : 0, _ambGrelots: () => amb ? amb.busG.gain.value : 0, _ecouteAmbiance: ecouteAmbiance, _amb: AMB,
    /** V16.75 · le jingle « VER-SUS ! » dans le timbre d'un univers : mode « motif » (3 notes enchaînées) ou « accord » (tenu ~1 s) */
    jingle(cle, mode) { const c = audio(); if (!c) return; try { jingleSur(c, maitre, c.currentTime + .02, cle, mode || "motif", []); } catch (e) { /* rien */ } },
    basculer(on) { ecrire("versus.son", on ? "1" : "0");
      if (on) { audio(); note(880, .12, "sine", .15); note(1320, .2, "sine", .12, .1);
        // v17.48 : rallumé en pleine course : le thème reprend là où en est la course (jusqu'à l'arrivée prévue)
        const P = coursePlan, now = performance.now(); if (P && now >= P.debut && now < P.debut + P.duree - 500) themeCourse(P.cle, (P.debut + P.duree - now) / 1000, (now - P.debut) / 1000);
      } else { arreter(); ambStop(.08); }   // coupé : thème, musique de la bande-annonce, moteurs et bips programmés s'arrêtent ; plus rien ne part tant que c'est coupé (audio() renvoie null)
      if (AMB.iv) ambVerifier();   // v17.59 : en plein écran, l'ambiance repart (ou se tait) aussitôt
      document.querySelectorAll("[data-son]").forEach(majBouton); majReglages(); },
    vibrations(on) { ecrire("versus.vibre", on ? "1" : "0"); if (on) vibrer(40); majReglages(); },
    /** les 5 feux puis le départ : feux en ms avant le départ (0 = départ tout de suite) */
    depart(avant) {
      const pas = avant > 0 ? Math.min(450, avant / 6) : 0, t0 = avant > 0 ? avant - pas * 5 : 0;
      if (avant > 0) for (let q = 0; q < 5; q++) plus_tard(t0 + q * pas, () => { note(440, .16, "square", .12); vibrer(30); });
      plus_tard(avant > 0 ? avant : 0, () => { note(880, .45, "square", .16); vibrer(120); });
    },
    /** la course : feux (avant, ms), moteurs ; v17.48 : cle = clé « peint » du circuit, son thème (THEMES_COURSE) joue de « C'est parti » à l'arrivée */
    course(duree, avant, cle) { AMB.courseJusqua = performance.now() + (avant || 0) + duree + 3000; ambStop(.4);   // v17.59 : l'ambiance s'efface avant les feux (filet : elle revient au plus tard 3 s après l'arrivée prévue)
      arreter(); coursePlan = cle && THEMES_COURSE[cle] ? { cle, debut: performance.now() + (avant || 0), duree } : null;
      if (!actif() && !vibreOK()) return; API.depart(avant || 0); plus_tard(avant || 0, () => { moteurs(duree / 1000); if (coursePlan) themeCourse(cle, duree / 1000 + .3, 0); }); },
    /** ⏸ course en pause : moteurs, thème et bips programmés se taisent (▶ reprendre relance course() pour le temps restant, sans feux) */
    pauseCourse() { arreter(); coursePlan = null; AMB.courseJusqua = performance.now() + 600000; },
    /** ▶ reprise d'une course sans son (le direct), ⏭ arrivée, ou fin : l'ambiance n'est plus retenue par la pause */
    repriseCourse() { AMB.courseJusqua = 0; if (AMB.iv) ambVerifier(); },
    /** l'ambiance est-elle retenue par une course (ou sa pause) en ce moment ? (lecture seule, pour les tests) */
    ambianceRetenue() { return performance.now() < AMB.courseJusqua; },
    /** l'arrivée : la foule, le klaxon du vainqueur ; une vibration de victoire si c'est toi */
    arrivee(styleKlaxon, cEstMoi, cle) {
      const th = !!theme; coursePlan = null; themeStop(.45);
      AMB.courseJusqua = performance.now() + (cle ? (th ? 1500 : 1300) : 500) + 1400;   // v17.59 : l'ambiance revient après le jingle et le klaxon   // v17.48 : le thème s'efface en fondu, avant le jingle et le klaxon
      moteurStop(1.2); souffle(2.4, [700, 1100], .28, 0, .4); souffle(1.6, 2600, .1, .3, .2, "highpass");
      if (cle) { plus_tard(th ? 450 : 250, () => API.jingle(cle, "motif")); plus_tard(th ? 1500 : 1300, () => klaxon(styleKlaxon)); }   // V16.75 : « VER-SUS ! » dans le timbre du mois, puis le klaxon du vainqueur
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
    succes() { note(1046, .12, "sine", .12); note(1568, .25, "sine", .12, .1); vibrer(30); },
    /** v20.61 · 🎄 calendrier de l'Avent : petits bruitages de Noël (grelots, porte, pop, raté, notes de la guirlande, fin de partie) ; rien si le son est coupé */
    noel(k, i) { try { if (!audio()) return;
      if (k === "grelots") { for (let q = 0; q < 7; q++) { note(2400 + (q % 3) * 260, .09, "triangle", .05, q * .055); note(3600 + (q % 2) * 300, .06, "sine", .03, q * .055 + .02); } }
      else if (k === "porte") { souffle(.35, [900, 300], .12, 0, .02, "bandpass"); note([660, 990], .18, "sine", .08, .25); note(1320, .35, "sine", .07, .4); }
      else if (k === "pop") note([700, 1300], .08, "sine", .1);
      else if (k === "ok") { note(988, .1, "triangle", .09); note(1319, .18, "triangle", .09, .08); }
      else if (k === "rate") note([300, 160], .22, "square", .06);
      else if (k === "ton") note([523.25, 659.25, 783.99, 1046.5][i % 4], .3, "triangle", .11);
      else if (k === "fin") [784, 988, 1175, 1568].forEach((f, q) => note(f, .22, "triangle", .08, q * .1));
      else if (k === "feu") note(440, .14, "square", .09);
      else if (k === "go") note(880, .3, "square", .11);
    } catch (e) { /* rien */ } },
    /* lot 62 · « Journées folles » de Moi (tout synthétisé, sur un bus à part que « Passer » coupe net) */
    /** l'incendie : grondement grave, souffle des flammes, crépitements ; fort = un coup sourd au début */
    folleFeu(dur, fort) {
      const c = folleBus(); vibrer(fort ? [90, 50, 90, 50, 320] : [60, 40, 60, 40, 160]); if (!c) return;
      if (fort) note([95, 38], 1.4, "sine", .5, 0, fBus);
      souffle(dur, [170, 85], .34, 0, .6, "lowpass", fBus); souffle(dur * .9, [420, 900], .12, .15, .8, "bandpass", fBus);
      for (let i = 0, n = fort ? 80 : 50; i < n; i++) souffle(.03 + Math.random() * .03, 2200 + Math.random() * 3800, .07 + Math.random() * .13, .2 + Math.random() * (dur - .6), .002, "highpass", fBus);
    },
    /** une fusée : sifflet de dtL à dtB (secondes), éclatement, petits crépitements ; une vibration brève à l'éclatement */
    fusee(dtL, dtB, grosse) {
      plus_tard(dtB * 1000, () => vibrer(grosse ? 40 : 18));
      const c = fBus ? audio() : folleBus(); if (!c) return;
      note([480 + Math.random() * 120, 1500 + Math.random() * 600], Math.max(.2, dtB - dtL), "sine", .035, dtL, fBus);
      souffle(.55, [1800, 220], grosse ? .5 : .36, dtB, .003, "lowpass", fBus); note([150, 48], .4, "sine", grosse ? .4 : .28, dtB, fBus);
      for (let i = 0; i < (grosse ? 16 : 9); i++) souffle(.025, 3000 + Math.random() * 4000, .05 + Math.random() * .07, dtB + .25 + Math.random() * .9, .002, "highpass", fBus);
    },
    /** l'aurore du bouquet final : un accord doux et lent (pas de jingle ni de musique de l'ère d'or) */
    aurore(dt, dur) { const c = fBus ? audio() : folleBus(); if (!c) return; [220, 277.2, 329.6, 440].forEach((f, i) => { note(f, dur, "sine", .05, dt + i * .15, fBus); note(f * 1.005, dur, "triangle", .018, dt + i * .15, fBus); }); },
    /** lot 62 c · l'Explosion (un coup sourd et un souffle) et la Pluie de bonbons (des « plop » joyeux, gamme pentatonique) */
    explosion() { const c = folleBus(); vibrer([140, 60, 90]); if (!c) return; note([130, 28], 1.3, "sine", .6, 0, fBus); souffle(1.1, [2600, 140], .6, 0, .003, "lowpass", fBus); souffle(.5, 5000, .2, .02, .002, "highpass", fBus); },
    bonbons(dur) { const c = fBus ? audio() : folleBus(); if (!c) return; const g = [523.3, 587.3, 659.3, 784, 880, 1046.5]; for (let i = 0; i < 18; i++) { const t = .1 + i * dur / 18 + Math.random() * .08; note([g[Math.floor(Math.random() * g.length)] * 1.5, g[0]], .14, "sine", .07, t, fBus); } [0, .4, .8].forEach(t => plus_tard(t * 1000 + 200, () => vibrer(15))); },
    /** lot 62 b · les événements rares : orage (krach), arcs électriques (crypto), arpège (sommet), cinq notes (série verte), berceuse (relâche) */
    evenement(k, dur, eclairs) {
      const c = folleBus(); (eclairs || []).forEach(e => plus_tard(e * 1000, () => vibrer(k === "krach" ? [70, 40, 140] : 25))); if (!c) return;
      if (k === "krach") { souffle(dur, 5200, .09, 0, .8, "highpass", fBus); souffle(dur, 1400, .06, 0, .8, "bandpass", fBus);
        eclairs.forEach(e => { souffle(.08, 3000, .3, e, .002, "highpass", fBus); souffle(1.8, [420, 55], .5, e + .12, .02, "lowpass", fBus); note([75, 32], 1.6, "sine", .4, e + .12, fBus); }); }
      else if (k === "crypto") eclairs.forEach((e, i) => { note([2200, 160], .2, "square", .05, e, fBus); note([1400 + i * 90, 300], .16, "sawtooth", .035, e + .02, fBus); souffle(.14, 4500, .12, e, .002, "highpass", fBus); });
      else if (k === "sommet") { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => { note(f, 1.4, "sine", .07, .3 + i * .28, fBus); note(f / 2, 1.6, "triangle", .03, .3 + i * .28, fBus); }); }
      else if (k === "serie") { [392, 440, 493.9, 587.3, 659.3].forEach((f, i) => note(f, .5, "triangle", .07, .3 + i * .32, fBus)); [523.3, 659.3, 784].forEach(f => note(f, 1.6, "sine", .05, 2, fBus)); }
      else if (k === "record") { [392, 493.9, 587.3, 784].forEach((f, i) => note(f, 1.2, "sine", .06, .25 + i * .22, fBus)); }   // lot 63 · sobres
      else if (k === "pirebaisse") { [440, 554.4, 659.3].forEach((f, i) => note(f, .9, "triangle", .05, .3 + i * .3, fBus)); }
      else if (k === "volhaut") { souffle(dur * .9, [300, 900], .08, .1, .8, "bandpass", fBus); souffle(dur * .7, [900, 350], .05, .9, .6, "bandpass", fBus); }
      else if (k === "volbas") { [261.6, 392].forEach(f => note(f, 2.6, "sine", .04, .2, fBus)); }
      else if (k === "plat") { [196, 293.7].forEach(f => note(f, 3, "sine", .04, .2, fBus)); [0.9, 2.2, 3.3].forEach(t => { note([1250, 520], .18, "sine", .06, t, fBus); }); }   // lot 62 c · Calme plat : une nappe douce, trois gouttes
      else if (k === "relache") { [[392, 0], [329.6, .5], [392, 1.1], [329.6, 1.6]].forEach(([f, t]) => note(f, .7, "triangle", .045, .3 + t, fBus)); }
    },
    folleStop() { if (!fBus || !ctx) return; const b = fBus; fBus = null; try { const t = ctx.currentTime; b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + .25); setTimeout(() => { try { b.disconnect(); } catch (e) { /* rien */ } }, 400); } catch (e) { /* rien */ } }
  };
  /** lot 62 : le bus des journées folles (un nouveau à chaque effet) */
  let fBus = null;
  function folleBus() { const c = audio(); if (!c) return null; try { if (fBus) fBus.disconnect(); } catch (e) { /* rien */ } fBus = c.createGain(); fBus.gain.value = 1; fBus.connect(maitre); return c; }

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
  /* v16.70 · « Tester » dans Réglages : joue un bip et dit ce que le navigateur permet (pour comprendre un téléphone muet) */
  document.addEventListener("click", e => {
    if (!(e.target.closest && e.target.closest("#son-test"))) return;
    const etaitCoupe = !actif(); if (etaitCoupe) ecrire("versus.son", "1");
    const c = audio(); note(880, .15, "sine", .3); note(1320, .25, "sine", .25, .15);
    if (etaitCoupe) ecrire("versus.son", "0");
    const d = document.getElementById("son-diag"); if (!d) return;
    setTimeout(() => {
      const etat = !c ? "impossible (ce navigateur ne gère pas le son web)" : c.state === "running" ? "OK, un bip vient de partir" : "bloqué par le navigateur (" + c.state + ")";
      d.hidden = false;
      d.textContent = "Son : " + etat + ". Si tu n'entends rien : volume « multimédia » du téléphone, Bluetooth connecté ailleurs ?" + (etaitCoupe ? " (Le son reste coupé dans l'appli : active-le au-dessus.)" : "");
    }, 400);
  });
  // un bouton 🔊 qui apparaît dans la page se met tout seul à jour
  new MutationObserver(() => { document.querySelectorAll("[data-son]:not([data-son-ok])").forEach(b => { b.setAttribute("data-son-ok", ""); majBouton(b); }); majReglages(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { timers.forEach(clearTimeout); timers.clear(); moteurStop(); themeStop(.1); ambStop(.1); coursePlan = null; } else if (AMB.iv) ambVerifier(); });   // v17.59 : l'ambiance se tait onglet caché, revient au retour   // V16.75 : la musique de la bande-annonce se met en pause avec elle (ctx.suspend), on ne la coupe pas
  return API;
})();
window.SONS = SONS;   // v16.69 : « const » ne crée pas window.SONS, et tous les « if (window.SONS) » de l'appli restaient faux (sons et vibrations muets depuis la v16.43)
