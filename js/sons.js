/* ============================================================
   V16.43 · Sons et vibrations du Versus
   Tout est fabriqué par l'appli (Web Audio), aucun fichier son.
   Son COUPÉ par défaut (choix de Théo) : bouton 🔊 de la course, ou Réglages.
   Vibrations activées par défaut (Android ; l'iPhone ne sait pas faire vibrer une page web).
   ============================================================ */
const SONS = (() => {
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } };
  const actif = () => lire("versus.son", "0") === "1";
  const vibreOK = () => lire("versus.vibre", "1") !== "0";
  let ctx = null, maitre = null, bruitBuf = null, moteur = null;
  const timers = new Set();

  function audio() {
    if (!actif()) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); maitre = ctx.createGain(); maitre.gain.value = .55; maitre.connect(ctx.destination); }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function bruit() {
    if (bruitBuf) return bruitBuf;
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (bruitBuf = b);
  }
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
  function arreter() { timers.forEach(clearTimeout); timers.clear(); moteurStop(); }

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
    actif, vibreOK, arreter, vibrer, klaxon,
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
    arrivee(styleKlaxon, cEstMoi) {
      moteurStop(1.2); souffle(2.4, [700, 1100], .28, 0, .4); souffle(1.6, 2600, .1, .3, .2, "highpass");
      plus_tard(500, () => klaxon(styleKlaxon)); vibrer(cEstMoi ? [80, 60, 80, 60, 250] : 60);
    },
    /** les 5 feux de la bande-annonce (aux mêmes moments que l'image) */
    feuxBA(departMs, pasMs) { for (let q = 0; q < 5; q++) plus_tard(departMs + q * pasMs, () => { note(440, .16, "square", .12); vibrer(25); }); },
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
  // un bouton 🔊 qui apparaît dans la page se met tout seul à jour
  new MutationObserver(() => { document.querySelectorAll("[data-son]:not([data-son-ok])").forEach(b => { b.setAttribute("data-son-ok", ""); majBouton(b); }); majReglages(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") arreter(); });
  return API;
})();
