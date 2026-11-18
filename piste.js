/* ============================================================
   Versus · Grand Prix : le circuit du mois
   - en 3D : WebGL pur, sans bibliothèque (décors low-poly, météo, caméras, replays)
   - en 2D : une carte SVG épurée, en secours ou par choix
   Ce fichier ne contient que le dessin. Le calendrier, les atouts et les points restent dans l'appli.
   Interface : Piste.monter(boite, options) → { placer, jouer, camera, focus, ecran, courant, redim, detruire }
   ============================================================ */
(function () {
  "use strict";
  const PI = Math.PI, TAU = 2 * PI;

  /* ---------- Tracés (360 × 240, y vers le bas, 3e valeur = relief) ---------- */
  function huit() {   // Suzuka : un huit ; le second passage au centre se fait sur un pont
    const P = [], n = 24;
    for (let i = 0; i < n; i++) {
      const t = -PI / 2 + i / n * TAU, c = Math.cos(t), s2 = Math.sin(2 * t);
      const x = 180 + (c > 0 ? 142 : 152) * c, y = 120 + 86 * s2 + (c < 0 ? 8 * Math.sin(3 * t) : 0);
      const pont = Math.exp(-Math.pow((((t - PI / 2) % TAU) + TAU) % TAU - PI, 2) / .3);   // autour du 2e passage au centre
      P.push([Math.round(x), Math.round(y), +(pont * 7).toFixed(1)]);
    }
    return P.slice(4).concat(P.slice(0, 4));   // départ sur une ligne droite, pas au croisement
  }
  /* V16.2 : chaque monde a ses propres formes de circuit (plus aucune copie d'un vrai tracé, sauf le huit) */
  /** cadre une forme dans le plan 360 × 240 */
  function cadrer(P, x0, x1, y0, y1) {
    x0 = x0 || 30; x1 = x1 || 330; y0 = y0 || 24; y1 = y1 || 216;
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9; P.forEach(p => { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); });
    const f = p => [x0 + (p[0] - a) / (b - a) * (x1 - x0), y0 + (p[1] - c) / (d - c) * (y1 - y0)];
    const Q = P.map(p => { const q = f(p); return [Math.round(q[0]), Math.round(q[1]), p[2] || 0]; }); Q.centre = f([0, 0]); return Q;
  }
  /** départ placé au milieu de la portion la plus droite */
  function depart(P) {
    const n = P.length, ang = i => { const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n]; let d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); return d > PI ? TAU - d : d; };
    const d = i => Math.hypot(P[(i + 1) % n][0] - P[i][0], P[(i + 1) % n][1] - P[i][1]);
    const sc = []; let best = 0, bm = 1e9; for (let i = 0; i < n; i++) { let s = ang(i), l = 0; for (let k = 1; k < n / 2 && l < 70; k++) { l += d((i + k - 1) % n); s += ang((i + k) % n) + ang((i - k + n) % n); } sc[i] = s; if (s < bm) { bm = s; best = i; } }
    let a0 = best, a1 = best; while (sc[(a0 - 1 + n) % n] < bm + .03 && a0 > best - n / 2) a0--; while (sc[(a1 + 1) % n] < bm + .03 && a1 < best + n / 2) a1++;
    best = (Math.round((a0 + a1) / 2) + n) % n;   // au milieu de la ligne droite, pas à sa sortie de virage
    const Q = P.slice(best).concat(P.slice(0, best)); Q.centre = P.centre; return Q;
  }
  /** boucle en étoile : r(θ) = 1 + Σ a·cos(kθ + φ) ; une telle boucle ne se recoupe jamais */
  function etoile(H, n, relief) {
    const P = []; for (let i = 0; i < n; i++) { const t = i / n * TAU; let r = 1; H.forEach(h => r += h[1] * Math.cos(h[0] * t + (h[2] || 0))); P.push([Math.cos(t) * r, Math.sin(t) * r, relief ? +relief(t).toFixed(1) : 0]); }
    return depart(cadrer(P));
  }
  /** polygone aux angles arrondis (c = longueur gardée de part et d'autre de chaque angle) */
  function polyg(S, c, relief) {
    const P = [], n = S.length;
    for (let i = 0; i < n; i++) { const a = S[i], b = S[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.min(c, L / 3) / L, m = Math.max(1, Math.round(L / 60));
      for (let j = 0; j <= m; j++) { const t = k + (1 - 2 * k) * j / m; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; P.push([Math.round(x), Math.round(y), relief ? +relief(x, y).toFixed(1) : 0]); } }
    P.centre = [180, 120]; return depart(P);
  }
  /** contour intérieur (lac, place centrale) : la forme resserrée vers son centre */
  const resserrer = (P, k) => P.filter((p, i) => i % 2 === 0).map(p => [P.centre[0] + (p[0] - P.centre[0]) * k, P.centre[1] + (p[1] - P.centre[1]) * k]);
  // Royaume enchanté : boucles souples et rondes ; Néon : angles droits, lignes de ville ; Terres sombres : formes tourmentées ; Dieux : relief
  const F_LAC = etoile([[2, .1, .4], [3, .07, 1.3]], 30);
  const F_DUNES = (() => { const H = [], B = [], dune = x => 2 + 2 * Math.sin(x / 34); for (let x = 40; x <= 320; x += 20) H.push([x, 62 + 24 * Math.sin((x - 40) / 280 * 3 * PI), dune(x)]); for (let x = 320; x >= 40; x -= 20) B.push([x, 182 + 24 * Math.sin((x - 40) / 280 * 3 * PI), dune(x + 50)]);
    const P = H.concat([[336, 122, 2]], B, [[24, 122, 2]]); P.centre = [180, 122]; return depart(P); })();
  const F_CHAMPI = (() => { const P = [[150, 218], [210, 218], [206, 150], [292, 146], [326, 122]]; for (let a = 0.05; a < PI - .02; a += PI / 9) P.push([180 + 150 * Math.cos(a), 122 - 100 * Math.sin(a)]); P.push([34, 122], [68, 146], [154, 150]); return polyg(P, 12); })();
  const TRACES = {
    abudhabi: { pts: polyg([[40, 204], [320, 204], [320, 40], [234, 40], [234, 126], [186, 126], [186, 40], [40, 40]], 16), decor: "garage", heure: "crepuscule", peint: "garage", reperes: [] },
    bahrein: { pts: etoile([[3, .14, .3], [5, .09, 1], [7, .05, 2.2]], 42), decor: "lucioles", heure: "crepuscule", amb: "lucioles", peint: "foret", reperes: [] },
    djeddah: { pts: polyg([[40, 210], [320, 210], [320, 70], [290, 70], [290, 32], [240, 32], [240, 70], [200, 70], [200, 32], [150, 32], [150, 70], [110, 70], [110, 32], [60, 32], [60, 70], [40, 70]], 12), decor: "chateau", heure: "nuit", peint: "chateau", reperes: [{ t: "chateau", y: 145 }] },
    melbourne: { pts: F_LAC, decor: "armoire", heure: "jour", amb: "neige", eau: [resserrer(F_LAC, .3)], peint: "armoire", reperes: [{ t: "armoire" }] },
    suzuka: { pts: huit(), decor: "basfonds", heure: "nuit", amb: "pluie", peint: "basfonds", reperes: [{ t: "cheminees" }] },
    miami: { pts: polyg([[40, 210], [320, 210], [320, 60], [270, 60], [270, 104], [220, 104], [220, 30], [160, 30], [160, 92], [110, 92], [110, 50], [40, 50]], 12), decor: "androides", heure: "nuit", amb: "neon", peint: "megapole", reperes: [{ t: "tourcentrale", y: 160 }] },
    montreal: { pts: polyg([[110, 30], [250, 30], [324, 120], [250, 210], [110, 210], [156, 120]], 18), decor: "arene", heure: "nuit", amb: "neon", reperes: [{ t: "holodome" }] },
    silverstone: { pts: etoile([[5, .17, .6]], 45), decor: "solstice", heure: "jour", peint: "solstice", reperes: [{ t: "mai" }] },
    spa: { pts: etoile([[1, .16, .5], [2, .17, 2.2], [4, .06, .8]], 36, t => 5 + 5 * Math.sin(2 * t + 1)), decor: "envers", heure: "nuit", amb: "envers", peint: "envers", reperes: [{ t: "faille" }] },
    monza: { pts: F_CHAMPI, decor: "survivants", heure: "crepuscule", amb: "spores", peint: "survivants", reperes: [{ t: "champignons", y: 95 }] },
    singapour: { pts: F_DUNES, decor: "dunes", heure: "crepuscule", amb: "desert", peint: "dunes", reperes: [{ t: "ver", y: 122 }] },
    interlagos: { pts: polyg([[40, 40], [320, 40], [334, 96], [292, 132], [304, 184], [250, 212], [200, 170], [150, 206], [90, 202], [56, 156], [30, 100]], 22, (x, y) => Math.max(0, 9 - (y - 40) / 18)), decor: "titans", heure: "crepuscule", amb: "cendres", peint: "titans", reperes: [{ t: "mur" }] },
    lasvegas: { pts: etoile([[3, .2, .5], [6, .03]], 39, t => 9 + 7 * Math.sin(t + .4)), decor: "olympe", heure: "jour", amb: "olympe", peint: "olympe", reperes: [{ t: "temple" }] },
    monaco: { pts: polyg([[60, 30], [300, 30], [300, 210], [212, 210], [212, 120], [148, 120], [148, 210], [60, 210]], 18), decor: "plateau", heure: "nuit", rue: true, damier: true, peint: "plateau", reperes: [{ t: "plateau" }] }
  };

  /* ---------- Couleurs et petits outils ---------- */
  function hex(h) { const n = parseInt(String(h).replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  const mel = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const fois = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  function alea(seed) { let s = (seed >>> 0) || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function hashTxt(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lisse = (a, b, k) => a + (b - a) * k;

  /* ---------- Matrices (colonne par colonne, comme WebGL) ---------- */
  function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); }
  function sous(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norme(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function point(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function regard(e, c) {
    const z = norme(sous(e, c)), x = norme(croix([0, 1, 0], z)), y = croix(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -point(x, e), -point(y, e), -point(z, e), 1]);
  }
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  /** position + cap (autour de y) + tangage (autour de z local) + échelle */
  function modele(x, y, z, cap, tang, ech) {
    const cy = Math.cos(cap), sy = Math.sin(cap), cz = Math.cos(tang || 0), sz = Math.sin(tang || 0), k = ech || 1;
    // Ry * Rz
    return new Float32Array([cy * cz * k, sz * k, -sy * cz * k, 0, -cy * sz * k, cz * k, sy * sz * k, 0, sy * k, 0, cy * k, 0, x, y, z, 1]);
  }
  function appliquer(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14], m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15]]; }

  /* ---------- Géométrie low-poly (faces planes, couleur par sommet, a = lumineux) ---------- */
  class Geo {
    constructor() { this.d = []; this.o = null; }
    /** surcouche : ce qui est peint SUR une autre surface (marquages, fenêtres…) ; dessinée avec un décalage de profondeur, elle ne scintille plus */
    ov() { return this.o || (this.o = new Geo()); }
    get n() { return this.d.length / 10; }
    tri(a, b, c, col, em, dir) {
      let n = norme(croix(sous(b, a), sous(c, a)));
      if (dir && point(n, dir) < 0) n = [-n[0], -n[1], -n[2]];
      const e = em || 0;
      this.d.push(a[0], a[1], a[2], n[0], n[1], n[2], col[0], col[1], col[2], e, b[0], b[1], b[2], n[0], n[1], n[2], col[0], col[1], col[2], e, c[0], c[1], c[2], n[0], n[1], n[2], col[0], col[1], col[2], e);
    }
    quad(a, b, c, d, col, em, dir) { this.tri(a, b, c, col, em, dir); this.tri(a, c, d, col, em, dir); }
    /** boîte de 8 coins (4 du bas puis 4 du haut, dans le même ordre) */
    bloc(C, col, em, cols) {
      const ctr = C.reduce((s, p) => [s[0] + p[0] / 8, s[1] + p[1] / 8, s[2] + p[2] / 8], [0, 0, 0]);
      const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      F.forEach((f, i) => { if (i === 0 && !(cols && cols.dessous)) return; const P = f.map(j => C[j]), m = P.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
        this.quad(P[0], P[1], P[2], P[3], cols && cols[i] || col, cols && cols.em && cols.em[i] !== undefined ? cols.em[i] : em, sous(m, ctr)); });
    }
    boite(x, y, z, sx, sy, sz, col, em, cap, cols) {
      const c = Math.cos(cap || 0), s = Math.sin(cap || 0), hx = sx / 2, hz = sz / 2;
      const p = (a, b, h) => [x + a * c + b * s, y + h, z - a * s + b * c];
      this.bloc([p(-hx, -hz, 0), p(hx, -hz, 0), p(hx, hz, 0), p(-hx, hz, 0), p(-hx, -hz, sy), p(hx, -hz, sy), p(hx, hz, sy), p(-hx, hz, sy)], col, em, cols);
    }
    cylindre(x, y, z, r, h, seg, col, em, r2) {   // vertical
      const rt = r2 === undefined ? r : r2;
      for (let i = 0; i < seg; i++) {
        const a = i / seg * TAU, b = (i + 1) / seg * TAU, m = (a + b) / 2;
        const A = [x + Math.cos(a) * r, y, z + Math.sin(a) * r], B = [x + Math.cos(b) * r, y, z + Math.sin(b) * r], A2 = [x + Math.cos(a) * rt, y + h, z + Math.sin(a) * rt], B2 = [x + Math.cos(b) * rt, y + h, z + Math.sin(b) * rt];
        if (rt > .001) this.quad(A, B, B2, A2, col, em, [Math.cos(m), 0, Math.sin(m)]); else this.tri(A, B, [x, y + h, z], col, em, [Math.cos(m), .4, Math.sin(m)]);
        if (rt > .001) this.tri([x, y + h, z], A2, B2, col, em, [0, 1, 0]);
      }
    }
    boule(x, y, z, r, col, em, aplati, fin) {
      const la = fin ? 4 : 3, lo = fin ? 7 : 6, k = aplati || 1;
      for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) {
        const t0 = i / la * PI, t1 = (i + 1) / la * PI, p0 = j / lo * TAU, p1 = (j + 1) / lo * TAU;
        const P = (t, p) => [x + Math.sin(t) * Math.cos(p) * r, y + Math.cos(t) * r * k, z + Math.sin(t) * Math.sin(p) * r];
        const a = P(t0, p0), b = P(t0, p1), c = P(t1, p1), d = P(t1, p0), m = P((t0 + t1) / 2, (p0 + p1) / 2), dir = sous(m, [x, y, z]);
        if (i === 0) this.tri(a, c, d, col, em, dir); else if (i === la - 1) this.tri(a, b, c, col, em, dir); else this.quad(a, b, c, d, col, em, dir);
      }
    }
    /** ajoute une autre géométrie, tournée (cap) et posée en x, y, z */
    poser(g, x, y, z, cap, ech, teinte) {
      copier(g.d, this.d, x, y, z, cap, ech, teinte);
      if (g.o && g.o.d.length) copier(g.o.d, this.ov().d, x, y, z, cap, ech, teinte);
    }
  }
  function copier(d, dst, x, y, z, cap, ech, teinte) {
      const c = Math.cos(cap || 0), s = Math.sin(cap || 0), k = ech || 1;
      for (let i = 0; i < d.length; i += 10) {
        const px = d[i] * k, pz = d[i + 2] * k, nx = d[i + 3], nz = d[i + 5];
        let r = d[i + 6], gg = d[i + 7], b = d[i + 8];
        if (teinte) { const t = teinte([r, gg, b]); r = t[0]; gg = t[1]; b = t[2]; }
        dst.push(x + px * c + pz * s, y + d[i + 1] * k, z - px * s + pz * c, nx * c + nz * s, d[i + 4], -nx * s + nz * c, r, gg, b, d[i + 9]);
      }
  }

  /* ---------- Échantillonnage du tracé (Catmull-Rom fermée, puis pas régulier) ---------- */
  const ECH = 2.4, DEMI = 7.5;   // 1 unité du plan = 2,4 m ; piste de 15 m
  function echantillonner(def) {
    const P = def.pts.map(p => [p[0] * ECH, (p[2] || 0) * 1.6, p[1] * ECH]), n = P.length, dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let j = 0; j < 24; j++) { const t = j / 24, t2 = t * t, t3 = t2 * t;
        dense.push([0, 1, 2].map(a => .5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); }
    }
    const cum = [0]; for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
    const L = cum[dense.length], N = Math.round(L / 3.2), X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i / N * L; while (cum[j + 1] < s) j++;
      const a = dense[j], b = dense[(j + 1) % dense.length], t = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      X[i] = a[0] + (b[0] - a[0]) * t; Y[i] = a[1] + (b[1] - a[1]) * t; Z[i] = a[2] + (b[2] - a[2]) * t;
    }
    const TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N, dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1; TX[i] = dx / l; TZ[i] = dz / l; }
    for (let i = 0; i < N; i++) { const a = (i - 3 + N) % N, b = (i + 3) % N; K[i] = (TX[a] * TZ[b] - TZ[a] * TX[b]) / (6 * L / N); }   // courbure signée
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (let i = 0; i < N; i++) { minx = Math.min(minx, X[i]); maxx = Math.max(maxx, X[i]); minz = Math.min(minz, Z[i]); maxz = Math.max(maxz, Z[i]); }
    const T = { X, Y, Z, TX, TZ, K, N, L, ds: L / N, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2, rx: (maxx - minx) / 2, rz: (maxz - minz) / 2 };
    T.R = Math.hypot(T.rx, T.rz);
    /** point de la piste à la distance s (avec décalage latéral) */
    T.a = (s, lat) => {
      const u = ((s % L) + L) % L / L * N, i = Math.floor(u) % N, k = (i + 1) % N, f = u - Math.floor(u);
      const tx = TX[i] + (TX[k] - TX[i]) * f, tz = TZ[i] + (TZ[k] - TZ[i]) * f, l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l, nz = tx / l, o = lat || 0;
      return { x: X[i] + (X[k] - X[i]) * f + nx * o, y: Y[i] + (Y[k] - Y[i]) * f, z: Z[i] + (Z[k] - Z[i]) * f + nz * o, tx: tx / l, tz: tz / l, pente: (Y[k] - Y[i]) / T.ds };
    };
    // grille de proximité, pour éloigner les décors de la piste
    const G = new Map(), cell = 24, cle = (gx, gz) => gx * 10007 + gz;
    for (let i = 0; i < N; i++) { const k = cle(Math.floor(X[i] / cell), Math.floor(Z[i] / cell)); if (!G.has(k)) G.set(k, []); G.get(k).push(i); }
    T.dist = (x, z, ymax) => {
      let m = 1e9; const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = G.get(cle(gx + a, gz + b)); if (l) for (const i of l) { if (ymax !== undefined && Y[i] > ymax) continue; const d = Math.hypot(X[i] - x, Z[i] - z); if (d < m) m = d; } }
      return m;
    };
    return T;
  }
  function dansPoly(x, z, poly) {
    let o = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) o = !o; }
    return o;
  }
  /** zone d'atout : la plus longue ligne droite ; zone de piège : le virage le plus serré */
  function zones(T) {
    const N = T.N, plat = i => Math.abs(T.K[i]) < .004;
    let best = { i: 0, n: 0 }, cur = 0;
    for (let k = 0; k < 2 * N; k++) { const i = k % N; if (plat(i)) { cur++; if (cur > best.n && cur <= N) best = { i: i - cur + 1, n: cur }; } else cur = 0; }
    let piege = 0, km = 0; for (let i = 0; i < N; i++) if (Math.abs(T.K[i]) > km) { km = Math.abs(T.K[i]); piege = i; }
    const a0 = (best.i + Math.floor(best.n * .3)) * T.ds, a1 = (best.i + Math.floor(best.n * .7)) * T.ds;
    return { atout: { s0: a0, s1: Math.max(a1, a0 + 40) }, piege: { s0: piege * T.ds - 22, s1: piege * T.ds + 22 } };
  }

  /* ---------- Ambiances : heure du jour, décor de la ville, météo, cosmétique du spectateur ---------- */
  const HEURES = {
    jour: { haut: "#2F74D0", horizon: "#B4DCF5", soleil: [.5, .62, .35], sCol: "#FFF1DA", sForce: 1.0, amb: .5, sol: "#7FA36A", nuit: 0, brume: .00045 },
    crepuscule: { haut: "#2E3170", horizon: "#F7A36E", soleil: [-.75, .2, .5], sCol: "#FFCFA6", sForce: .85, amb: .55, nuit: .35, brume: .00045 },
    nuit: { haut: "#03060F", horizon: "#1A2446", soleil: [.3, .55, -.6], sCol: "#9DB4FF", sForce: .32, amb: .42, nuit: 1, brume: .0007 }
  };
  const DECORS = {
    marina: { sol: "#C2B9A6", bord: "#9DB06A", piste: "#3A3E46", murs: ["#E9ECEF", "#2FB0C8"], eau: "#1E6A8A", obj: [["palmier", 40], ["immeuble", 14], ["yacht", 12, "eau"]] },
    desert: { sol: "#D3A867", bord: "#C08F50", piste: "#3B3B40", murs: ["#E9ECEF", "#D33A2C"], obj: [["dune", 70], ["rocher", 40], ["palmier", 10], ["projecteur", 18, "pres"]] },
    corniche: { sol: "#8F8A80", bord: "#6E6A64", piste: "#33363C", murs: ["#E9ECEF", "#1F9A55"], eau: "#0F3D5E", obj: [["palmier", 50], ["immeuble", 30], ["lampadaire", 0]] },
    parc: { sol: "#6E9E58", bord: "#83B26A", piste: "#3B3F47", murs: ["#E9ECEF", "#1F5FA8"], eau: "#3B88B5", obj: [["arbre", 140], ["gratteciel", 0]] },
    japon: { sol: "#6FA45A", bord: "#88B96F", piste: "#3B3F47", murs: ["#E9ECEF", "#C62828"], obj: [["cerisier", 70], ["pin", 70]] },
    miami: { sol: "#7DB46A", bord: "#9CCB7E", piste: "#3A3E46", murs: ["#FFFFFF", "#FF5FA2"], eau: "#2BB3C9", obj: [["palmier", 90], ["pastel", 26], ["yacht", 8, "eau"]] },
    ile: { sol: "#6E9C58", bord: "#86B36C", piste: "#3B3F47", murs: ["#E9ECEF", "#D3302F"], eau: "#2D6E94", obj: [["arbre", 120], ["pin", 30]] },
    campagne: { sol: "#6A9A4E", bord: "#86B26A", piste: "#3D4148", murs: ["#E9ECEF", "#1E3A8A"], obj: [["champ", 34], ["foin", 40], ["arbre", 50]] },
    foret: { sol: "#4E7E44", bord: "#6C9A5C", piste: "#3A3E45", murs: ["#E9ECEF", "#F2C230"], obj: [["pin", 260], ["colline", 10]] },
    monza: { sol: "#6E9E52", bord: "#86B26A", piste: "#3B3F47", murs: ["#E9ECEF", "#1F8F4E"], obj: [["arbre", 200]] },
    nuitville: { sol: "#2E3440", bord: "#3A414E", piste: "#2D3036", murs: ["#E9ECEF", "#D62D3A"], eau: "#0B2A44", obj: [["gratteciel", 60], ["lampadaire", 0]] },
    collines: { sol: "#6F9E4E", bord: "#8AB46A", piste: "#3B3F47", murs: ["#E9ECEF", "#F2C230"], obj: [["maison", 120], ["arbre", 60], ["colline", 8]] },
    vegas: { sol: "#4A4036", bord: "#5C5045", piste: "#2C2E33", murs: ["#E9ECEF", "#B03AFF"], obj: [["neon", 46], ["lampadaire", 0]] },
    monaco: { sol: "#C4B395", bord: "#9FAE7A", piste: "#34373D", murs: ["#E9ECEF", "#D3302F"], eau: "#1C6E9E", obj: [["villa", 70], ["palmier", 30], ["yacht", 16, "eau"]] },
    // V16.2 : un décor par circuit à thème
    garage: { sol: "#5B6068", bord: "#6A7078", piste: "#454A52", kerb: ["#F2C230", "#1A1B1F"], murs: ["#F2C230", "#1A1B1F"], obj: [["conteneur", 8], ["pneus", 10]] },
    lucioles: { sol: "#2A4A33", bord: "#3A5A3A", piste: "#7A5C3E", terre: true, murs: ["#5A4030", "#4A3426"], obj: [["pin", 200], ["arbre", 60], ["luciole", 70], ["champignon", 30]] },
    chateau: { sol: "#4F6B45", bord: "#62805A", piste: "#6A6F77", kerb: ["#8A8F97", "#4A4F57"], murs: ["#E9ECEF", "#7B4BD6"], obj: [["tour", 16], ["pin", 150], ["rocher", 20]] },
    armoire: { sol: "#4E7E44", bord: "#6C9A5C", piste: "#C9D6E2", kerb: ["#2F6FD0", "#FFFFFF"], murs: ["#E9ECEF", "#2F6FD0"], eau: "#BFD9EC", obj: [["pin", 240], ["lanterne", 12, "pres"]] },
    basfonds: { sol: "#2B2A2C", bord: "#3A3634", piste: "#1E2126", kerb: ["#7A3B2E", "#9A4E3A"], murs: ["#E9ECEF", "#B33A2E"], obj: [["usine", 46], ["lampadaire", 0]] },
    androides: { sol: "#14121F", bord: "#1E1A2E", piste: "#151925", kerb: ["#22D3EE", "#FF4FD8"], murs: ["#E9ECEF", "#22D3EE"], obj: [["tourholo", 44], ["gratteciel", 30], ["lampadaire", 0]] },
    arene: { sol: "#0D0820", bord: "#1C0B3A", piste: "#1A1C24", murs: ["#22D3EE", "#FF4FD8"], obj: [["cube", 110]] },
    solstice: { sol: "#79A858", bord: "#93C070", piste: "#C9B48A", terre: true, murs: ["#FFFFFF", "#F2B33A"], obj: [["fleurs", 70], ["maison", 50], ["arbre", 60], ["foin", 20]] },
    envers: { sol: "#2B2A2E", bord: "#3B3438", piste: "#2C2E33", kerb: ["#C8102E", "#2C2E33"], murs: ["#E9ECEF", "#C8102E"], obj: [["arbremort", 170], ["pin", 50]] },
    survivants: { sol: "#5D6B44", bord: "#6E7A52", piste: "#45473F", kerb: ["#6B8A42", "#45473F"], murs: ["#E9ECEF", "#9BC53D"], obj: [["ruine", 40], ["champignon", 90], ["arbre", 40]] },
    dunes: { sol: "#D3A867", bord: "#C08F50", piste: "#C9A06A", terre: true, murs: ["#E9ECEF", "#D9822B"], obj: [["dune", 90], ["rocher", 30], ["projecteur", 10, "pres"]] },
    titans: { sol: "#6E7458", bord: "#82886A", piste: "#8A7050", terre: true, murs: ["#E9ECEF", "#8C2F2F"], obj: [["maison", 50], ["rocher", 50], ["arbre", 40]] },
    olympe: { sol: "#B8B19E", bord: "#A49D8A", piste: "#E6DFCF", kerb: ["#F2B33A", "#FFFFFF"], murs: ["#FFFFFF", "#F2B33A"], obj: [["colonne", 50], ["montagne", 9], ["nuage", 26], ["rocher", 30], ["pin", 30]] },
    plateau: { sol: "#E9DFC8", bord: "#C9B98F", piste: "#2E2420", kerb: ["#E5484D", "#4C8DFF"], murs: ["#F2F4F7", "#E5484D"], obj: [["de", 22], ["pion", 40], ["lampadaire", 0]] }
  };
  /** objets qui gardent leurs couleurs propres (lumineux ou peints), même sous la neige ou le néon */
  const SANS_TEINTE = new Set(["yacht", "neon", "luciole", "cube", "tourholo", "lanterne", "fleurs", "de", "pion", "nuage"]);
  /** ambiance finale : heure de la ville, puis météo du marché, puis cosmétique du spectateur */
  /** ambiance finale : heure et thème du circuit (toujours), météo du marché, puis le filtre de course du joueur (une touche par-dessus, V16.5) */
  function ambiance(def, meteo, cosm) {
    const D = DECORS[def.decor] || DECORS.parc, th = def.amb || null;
    let h = Object.assign({}, HEURES[def.heure] || HEURES.jour);
    if (th === "desert") h = Object.assign({}, HEURES.crepuscule, { horizon: "#FFC98A", haut: "#5C86C9", sCol: "#FFD9A0", sForce: 1, amb: .58, brume: .00035, nuit: 0 });
    const A = { haut: hex(h.haut), horizon: hex(h.horizon), soleil: norme(h.soleil), sCol: fois(hex(h.sCol), h.sForce), amb: h.amb, nuit: h.nuit, brume: h.brume,
      sol: hex(D.sol), bord: hex(D.bord), piste: hex(D.piste), murs: D.murs.map(hex), eau: D.eau ? hex(D.eau) : null, pluie: 0, neige: 0, eclairs: 0, mouille: 0, synth: 0, hiver: 0 };
    const gris = hex("#7D8794");
    if (meteo === "nuages") { A.haut = mel(A.haut, gris, .45); A.horizon = mel(A.horizon, hex("#C9D0D8"), .45); A.sCol = fois(A.sCol, .7); A.brume *= 1.3; }
    if (meteo === "pluie" || meteo === "orage") {
      const k = meteo === "orage" ? .85 : .65;
      A.haut = mel(A.haut, hex(meteo === "orage" ? "#1C222D" : "#59636F"), k); A.horizon = mel(A.horizon, hex(meteo === "orage" ? "#3A4352" : "#8F99A5"), k);
      A.sCol = fois(A.sCol, meteo === "orage" ? .3 : .45); A.amb *= .9; A.pluie = meteo === "orage" ? 1.6 : 1; A.mouille = 1; A.brume *= 1.35; A.eclairs = meteo === "orage" ? 1 : 0;
    }
    // le thème du circuit (V16.2) : il ne disparaît jamais
    if (th === "neige") { A.hiver = 1; A.sol = hex("#E8EEF4"); A.bord = hex("#D5DFEA"); A.neige = A.pluie ? 0 : 1; A.horizon = mel(A.horizon, hex("#E6EDF5"), .5); A.haut = mel(A.haut, hex("#9FB5CC"), .4); }
    if (th === "lucioles") { A.haut = hex("#13244A"); A.horizon = hex("#4A7E7A"); A.nuit = .8; A.amb = .6; A.sCol = fois(A.sCol, .6); if (!A.pluie) { A.neige = 1; A.floc = [.85, 1, .35, .9]; A.flocV = 1.5; } }
    if (th === "envers") { A.haut = hex("#0B0610"); A.horizon = hex("#5A1424"); A.nuit = 1; A.eclairs = 1; A.sCol = hex("#9AA6C8"); A.sol = hex("#2A2730"); A.bord = hex("#35303A"); A.envers = 1; if (!A.pluie) { A.neige = 1; A.floc = [.75, .68, .7, .6]; A.flocV = 2.5; } }
    if (th === "spores") { A.horizon = mel(A.horizon, hex("#B7C27A"), .6); A.haut = mel(A.haut, hex("#33402C"), .4); if (!A.pluie) { A.neige = 1; A.floc = [.85, .92, .6, .6]; A.flocV = 2; } }
    if (th === "cendres") { A.horizon = mel(A.horizon, hex("#C98A5A"), .5); A.haut = mel(A.haut, hex("#4A4250"), .5); A.brume *= 1.4; if (!A.pluie) { A.neige = 1; A.floc = [.62, .6, .58, .7]; A.flocV = 3; } }
    if (th === "desert" && !A.pluie) { A.neige = 1; A.floc = [.95, .8, .55, .5]; A.flocV = 9; }
    if (th === "olympe") { A.haut = hex("#3E7BE0"); A.horizon = hex("#FFE2A0"); A.sCol = hex("#FFF1D0"); A.eclairs = 1; }
    if (th === "pluie" && !A.pluie) { A.pluie = 1; A.mouille = 1; A.haut = mel(A.haut, hex("#1C222D"), .5); A.brume *= 1.3; }
    if (th === "neon") { A.synth = 1; A.nuit = 1; A.haut = hex("#0B0220"); A.horizon = hex("#FF2E97"); A.sol = hex("#12062A"); A.bord = hex("#1C0B3A"); A.sCol = hex("#FF77C8"); A.soleil = norme([0, .12, -1]); A.amb = .45; A.murs = [hex("#22D3EE"), hex("#FF4FD8")]; }
    // le filtre de course du joueur : une touche de couleur et d'heure, sans effacer le thème
    if (cosm === "monaco") { A.haut = mel(A.haut, hex("#03060F"), .55); A.horizon = mel(A.horizon, hex("#1A2446"), .5); A.sCol = fois(A.sCol, .6); A.nuit = Math.max(A.nuit, .7); A.amb = Math.min(A.amb, .48); }
    if (cosm === "desert") { A.horizon = mel(A.horizon, hex("#FFB86B"), .45); A.haut = mel(A.haut, hex("#5C6FC9"), .25); A.sCol = mel(A.sCol, hex("#FFC98A"), .4); }
    if (cosm === "neige") { A.horizon = mel(A.horizon, hex("#E6EDF5"), .35); A.haut = mel(A.haut, hex("#9FB5CC"), .3); A.sCol = mel(A.sCol, hex("#DDE8F5"), .3); if (!A.neige && !A.pluie) { A.neige = 1; A.floc = [.92, .95, 1, .55]; A.flocV = 6; } }
    if (cosm === "neon") { A.horizon = mel(A.horizon, hex("#FF2E97"), .32); A.haut = mel(A.haut, hex("#2A0B5A"), .32); A.sCol = mel(A.sCol, hex("#FF77C8"), .35); if (!A.synth) A.murs = [A.murs[0], hex("#FF4FD8")]; }
    A.brouillard = mel(A.horizon, A.haut, .15);
    return A;
  }
  /** teinte des décors selon l'ambiance (hiver : enneigé ; synthwave : sombre) */
  function teinteur(A) {
    if (A.hiver) return c => mel(c, [.93, .95, .98], c[1] > c[0] && c[1] > c[2] ? .7 : .35);
    if (A.synth) return c => mel(c, [.06, .02, .14], .78);
    if (A.envers) return c => mel(c, [.14, .04, .07], .35);
    return null;
  }

  /* ---------- Objets de décor ---------- */
  const OBJ = {};
  function objet(type, r, A) {
    const g = new Geo(), v = (h, k) => fois(hex(h), k || 1);
    if (type === "arbre") { const h = 3 + r() * 3, col = mel(v("#2F6B3A"), v("#5E9A44"), r()); g.cylindre(0, 0, 0, .45, h, 5, v("#5B4030")); g.boule(0, h + 2.2, 0, 3 + r() * 1.5, col, 0, 1.1); }
    else if (type === "pin") { const h = 2 + r() * 2, col = mel(v("#1E4D33"), v("#2F6B45"), r()); g.cylindre(0, 0, 0, .4, h, 5, v("#4A3526")); g.cylindre(0, h, 0, 3.4, 6, 5, col, 0, 0); g.cylindre(0, h + 3.6, 0, 2.2, 5, 5, mel(col, [1, 1, 1], .06), 0, 0); }
    else if (type === "cerisier") { const h = 2.6 + r() * 1.5; g.cylindre(0, 0, 0, .4, h, 5, v("#5A3A34")); const col = mel(v("#F4A6C6"), v("#FFD3E4"), r()); g.boule(0, h + 2, 0, 3.2, col, 0, .8); g.boule(1.2, h + 2.8, .6, 2, mel(col, [1, 1, 1], .2)); }
    else if (type === "palmier") {
      const h = 7 + r() * 4, inc = (r() - .5) * .5; for (let i = 0; i < 3; i++) g.cylindre(inc * i * 1.6 / 3 * h / 4, i * h / 3, 0, .42 - i * .06, h / 3 + .1, 4, v("#8A6A48"));
      const tx = inc * 1.6 * h / 4, col = mel(v("#2E7D3A"), v("#4FA048"), r());
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r(); const e = [tx + Math.cos(a) * 4.2, h - 1.6, Math.sin(a) * 4.2], p = [tx + Math.cos(a + .35) * 1.3, h + .3, Math.sin(a + .35) * 1.3], q = [tx + Math.cos(a - .35) * 1.3, h + .3, Math.sin(a - .35) * 1.3]; g.tri([tx, h + .4, 0], p, e, col, 0, [0, 1, 0]); g.tri([tx, h + .4, 0], e, q, mel(col, [0, 0, 0], .15), 0, [0, 1, 0]); }
    }
    else if (type === "dune") { const w = 14 + r() * 18, h = 2 + r() * 3, c = mel(A.sol, [1, .9, .7], .15); const P = [[-w, 0, 0], [0, 0, -w * .5], [w, 0, 0], [0, 0, w * .5]], top = [r() * 3, h, 0]; for (let i = 0; i < 4; i++) g.tri(P[i], P[(i + 1) % 4], top, i % 2 ? c : mel(c, [0, 0, 0], .1), 0, [P[i][0] + P[(i + 1) % 4][0], 1, P[i][2] + P[(i + 1) % 4][2]]); }
    else if (type === "colline") { const w = 50 + r() * 40, h = 10 + r() * 14, c = mel(A.sol, [0, 0, 0], .12); const n = 7, P = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; P.push([Math.cos(a) * w * (.8 + r() * .3), 0, Math.sin(a) * w * .7 * (.8 + r() * .3)]); } const top = [0, h, 0]; for (let i = 0; i < n; i++) g.tri(P[i], P[(i + 1) % n], top, mel(c, [1, 1, 1], i % 2 * .06), 0, [P[i][0], w * .6, P[i][2]]); }
    else if (type === "rocher") { const s = 1.2 + r() * 2.4; g.boule(0, s * .4, 0, s, mel(v("#9A7650"), v("#B58D60"), r()), 0, .6); }
    else if (type === "immeuble" || type === "pastel" || type === "villa") {
      const pal = type === "pastel" ? ["#FFC7D9", "#B7F0E6", "#FFE6A8", "#C8D8FF", "#FFFFFF"] : type === "villa" ? ["#F2E2C4", "#F6D0B0", "#E9C9A0", "#FFF3DE", "#F0B9A0"] : ["#D9DDE3", "#BFC7D2", "#E8E2D6", "#AEB8C6"];
      const w = 7 + r() * 7, d = 7 + r() * 7, h = type === "villa" ? 5 + r() * 8 : 8 + r() * (type === "pastel" ? 10 : 22), col = hex(pal[Math.floor(r() * pal.length)]);
      g.boite(0, 0, 0, w, h, d, col); fenetres(g, w, h, d, A.nuit, r);
      g.boite(0, h, 0, w * .96, .5, d * .96, type === "villa" ? v("#B5523B") : mel(col, [0, 0, 0], .2));
    }
    else if (type === "gratteciel") { const w = 9 + r() * 10, h = 28 + r() * 60, col = mel(v("#3E4A5C"), v("#7C8CA3"), r()); g.boite(0, 0, 0, w, h, w, col); fenetres(g, w, h, w, Math.max(A.nuit, .25), r); if (r() > .5) g.cylindre(0, h, 0, .4, 8, 4, v("#C9D2DD"), A.nuit ? .9 : 0); }
    else if (type === "maison") { const pal = ["#F25C54", "#F7B267", "#4C9AFF", "#3DDC97", "#F4D35E", "#B57BFF", "#FFFFFF"]; const w = 4 + r() * 4, h = 3 + r() * 4; g.boite(0, 0, 0, w, h, w * .9, hex(pal[Math.floor(r() * pal.length)])); g.boite(0, h, 0, w, .4, w * .9, v("#7A6A5A")); fenetres(g, w, h, w * .9, A.nuit, r); }
    else if (type === "neon") { const pal = ["#FF4FD8", "#22D3EE", "#F7CF55", "#B03AFF", "#3DDC97", "#FF6A3D"]; const w = 10 + r() * 10, h = 18 + r() * 40, c = hex(pal[Math.floor(r() * pal.length)]); g.boite(0, 0, 0, w, h, w, v("#1A1426")); g.boite(0, h * .6, 0, w + .4, 1.2, w + .4, c, 1); g.boite(0, h - .6, 0, w + .4, .8, w + .4, c, 1); g.boite(0, h * .3, 0, w + .3, .6, w + .3, hex(pal[Math.floor(r() * pal.length)]), 1); fenetres(g, w, h, w, 1, r); }
    else if (type === "foin") { const c = v("#D9B45A"); for (let i = 0; i < 3; i++) g.cylindre(i * 2.6 - 2.6, 0, 0, 1.1, 1.6, 7, c); }
    else if (type === "champ") { const w = 40 + r() * 30, d = 30 + r() * 30, c = hex(["#C9B85A", "#8DB255", "#A9C46A", "#B9A04E"][Math.floor(r() * 4)]), o = g.ov(); o.quad([-w / 2, .04, -d / 2], [w / 2, .04, -d / 2], [w / 2, .04, d / 2], [-w / 2, .04, d / 2], c, 0, [0, 1, 0]); for (let i = 1; i < 6; i++) { const z = -d / 2 + i * d / 6; o.quad([-w / 2, .06, z - .3], [w / 2, .06, z - .3], [w / 2, .06, z + .3], [-w / 2, .06, z + .3], mel(c, [0, 0, 0], .15), 0, [0, 1, 0]); } }
    else if (type === "yacht") { const L = 10 + r() * 8; g.boite(0, 0, 0, L, 1.6, L * .3, v("#F4F6F8")); g.boite(-L * .1, 1.6, 0, L * .5, 1.4, L * .22, v("#E2E8EE")); g.boite(-L * .15, 3, 0, L * .25, 1, L * .16, v("#2B3A4A")); if (r() > .5) g.cylindre(L * .1, 1.6, 0, .15, 9, 4, v("#DDDDDD")); }
    else if (type === "projecteur") { g.cylindre(0, 0, 0, .5, 22, 5, v("#9AA3AE")); g.boite(0, 22, 0, 5, 2.4, 1.2, v("#C9D2DD"), 1); }
    else if (type === "lampadaire") { g.cylindre(0, 0, 0, .25, 9, 4, v("#7D8590")); g.boite(1, 9, 0, 2.4, .4, .8, v("#FFF1C2"), 1); }
    // ----- V16.2 : objets des mondes à thème -----
    else if (type === "tour") { const h = 12 + r() * 10, rr = 3 + r() * 1.5, pierre = mel(v("#8C8A86"), v("#A9A39A"), r()); g.cylindre(0, 0, 0, rr, h, 8, pierre); g.cylindre(0, h, 0, rr + .8, .8, 8, mel(pierre, [0, 0, 0], .15)); g.cylindre(0, h + .8, 0, rr + .9, h * .45, 8, v(["#3D4E9C", "#6B3B8C", "#2E6B5A"][Math.floor(r() * 3)]), 0, 0); g.ov().boite(0, h * .55, rr + .05, 1, 1.6, .2, v("#FFC86B"), A.nuit ? 1 : .1); }
    else if (type === "pneus") { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const hh = 3 + Math.floor(r() * 3), blanc = r() < .3; for (let k = 0; k < hh; k++) g.cylindre(i * 1.9 - n * .9, k * .55, 0, .9, .5, 6, k % 2 && blanc ? v("#E9ECEF") : v(k % 2 ? "#1A1C20" : "#262A30")); } }
    else if (type === "conteneur") { const pal = ["#D9472B", "#2F6FD0", "#F2B33A", "#2BB673", "#8C96A3"], n = r() < .4 ? 2 : 1; for (let k = 0; k < n; k++) g.boite(0, k * 5.2, 0, 12, 5.2, 5, hex(pal[Math.floor(r() * pal.length)]), 0, k * (r() - .5) * .6); }
    else if (type === "luciole") { for (let i = 0; i < 8; i++) { const t = .35 + r() * .2; g.boite((r() - .5) * 12, 1 + r() * 7, (r() - .5) * 12, t, t, t, mel(v("#D8FF5A"), v("#FFE27A"), r()), 1, r()); } }
    else if (type === "champignon") { const h = 1.5 + r() * 3, rc = 1.4 + r() * 2.4, cap = v(["#C2412D", "#D9822B", "#5FB3A1", "#9D6AD8"][Math.floor(r() * 4)]); g.cylindre(0, 0, 0, rc * .28, h, 6, v("#E9E2CF"), 0, rc * .22); g.boule(0, h, 0, rc, cap, A.nuit ? .3 : 0, .5);
      for (let i = 0; i < 2; i++) { const a = r() * TAU; g.ov().boule(Math.cos(a) * rc * .5, h + rc * .38, Math.sin(a) * rc * .5, rc * .13, v("#FFF6E0"), A.nuit ? .8 : 0, .5); } }
    else if (type === "usine") { const w = 14 + r() * 12, d = 10 + r() * 8, h = 7 + r() * 8, col = mel(v("#7A3B2E"), v("#9A5240"), r()); g.boite(0, 0, 0, w, h, d, col); g.boite(0, h, 0, w, 1.6, d * .5, mel(col, [0, 0, 0], .3)); g.cylindre(w * .3, h, d * .2, 1.1, 10 + r() * 8, 6, v("#5E3127"), 0, .9); fenetres(g, w, h, d, A.nuit, r); }
    else if (type === "tourholo") { const w = 6 + r() * 6, h = 40 + r() * 70, c = hex(["#22D3EE", "#FF4FD8", "#9B87FF", "#3DDC97"][Math.floor(r() * 4)]); g.boite(0, 0, 0, w, h, w, v("#1A1D2B"), 0, PI / 4); for (let y = 6; y < h; y += 7 + r() * 6) g.ov().boite(0, y, 0, w * 1.08, .5, w * 1.08, c, 1, PI / 4); g.cylindre(0, h, 0, .3, 10, 4, c, 1, .05); }
    else if (type === "cube") { const c = hex(["#22D3EE", "#FF4FD8", "#F7CF55", "#3DDC97", "#B03AFF"][Math.floor(r() * 5)]), s = 2 + r() * 5, y = r() < .5 ? 0 : 4 + r() * 18; g.boite(0, y, 0, s, s, s, mel(c, [0, 0, 0], .35), .55); g.ov().boite(0, y + s, 0, s * .7, .1, s * .7, c, 1); }
    else if (type === "fleurs") { const pal = ["#FF6FA8", "#FFD23F", "#FFFFFF", "#B57BFF", "#FF8A3D", "#6EC6FF"]; g.boite(0, 0, 0, 9, .25, 9, v("#4F8A3E")); for (let i = 0; i < 12; i++) g.boite((r() - .5) * 8, .25, (r() - .5) * 8, .7, .55, .7, hex(pal[Math.floor(r() * pal.length)]), 0, r()); }
    else if (type === "mai") { g.cylindre(0, 0, 0, .35, 12, 6, v("#F2E6CC")); g.boule(0, 12, 0, 1.4, v("#3F9A45"), 0, .6); const pal = ["#E5484D", "#F2B33A", "#4C8DFF", "#2BB673", "#FF6FA8", "#B57BFF"]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; branche(g, [0, 11.5, 0], [Math.cos(a) * 6, .3, Math.sin(a) * 6], .14, .08, hex(pal[i])); } }
    else if (type === "arbremort") { const h = 4 + r() * 4, col = mel(v("#2B2326"), v("#4A3C3A"), r()); g.cylindre(0, 0, 0, .45, h, 5, col, 0, .2); for (let i = 0; i < 4; i++) { const y = h * (.45 + r() * .5), a = r() * TAU, L = 1.5 + r() * 2.5; branche(g, [0, y, 0], [Math.cos(a) * L, y + 1 + r() * 2, Math.sin(a) * L], .2, .05, col); } }
    else if (type === "ruine") { const w = 8 + r() * 8, d = 8 + r() * 8, h = 6 + r() * 14, col = mel(v("#6E6A62"), v("#8A847A"), r()); g.boite(0, 0, 0, w, h, d * .25, col); g.boite(-w * .4, 0, 0, w * .2, h * (.4 + r() * .4), d, col); g.boite(w * .1, 0, d * .3, w * .5, 1.5, d * .3, mel(col, [0, 0, 0], .2)); fenetres(g, w, h, d * .25, 0, r); g.boule(w * .3, 0, -d * .3, 1.5 + r(), v("#5E5A52"), 0, .5); if (r() < .6) g.boule(0, h, 0, 2 + r() * 2, v("#4F7A3A"), 0, .6); }
    else if (type === "nuage") { const y = 45 + r() * 40; for (let i = 0; i < 4; i++) g.boule((i - 1.5) * 7 + (r() - .5) * 3, y + r() * 2, (r() - .5) * 6, 6 + r() * 4, v("#F6F2EA"), .3, .5); }
    else if (type === "colonne") { const h = r() < .4 ? 3 + r() * 4 : 9 + r() * 3, m = v("#EDE6D6"); g.boite(0, 0, 0, 3, .7, 3, m); g.cylindre(0, .7, 0, 1, h, 8, m, 0, .9); if (h > 8) g.boite(0, h + .7, 0, 3, .8, 3, m); else g.boule(2.4, .3, .6, 1, m, 0, .6); }
    else if (type === "montagne") { const R = 40 + r() * 40, h = 50 + r() * 50, c = mel(v("#7D7468"), v("#9A9184"), r()); g.cylindre(0, 0, 0, R, h, 7, c, 0, 0); g.cylindre(0, h * .62, 0, R * .4, h * .4, 7, v("#F4F2EE"), 0, 0); }
    else if (type === "de") { const s = 5 + r() * 5, rouge = r() < .35, o = g.ov(), p = s * .26; g.boite(0, 0, 0, s, s, s, rouge ? v("#C8283A") : v("#F4F1EA"));
      const n = 1 + Math.floor(r() * 6), P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, 1], [-1, 1], [1, -1]], 5: [[-1, -1], [1, 1], [-1, 1], [1, -1], [0, 0]], 6: [[-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0]] }[n];
      P.forEach(q => o.boite(q[0] * p, s, q[1] * p, s * .16, .05, s * .16, rouge ? v("#FFFFFF") : v("#1A1A22"))); }
    else if (type === "pion") { const c = hex(["#E5484D", "#4C8DFF", "#F2B33A", "#2BB673", "#B57BFF"][Math.floor(r() * 5)]), k = 1 + r() * 1.5; g.cylindre(0, 0, 0, 2 * k, .8 * k, 8, c); g.cylindre(0, .8 * k, 0, 1.5 * k, 4 * k, 8, c, 0, .5 * k); g.boule(0, 5.6 * k, 0, 1.3 * k, c, 0, 1, true); }
    else if (type === "lanterne") { g.cylindre(0, 0, 0, .18, 4.2, 5, v("#20242B")); g.boite(0, 4.2, 0, .9, 1.1, .9, v("#FFD58A"), 1); g.cylindre(0, 5.3, 0, .7, .6, 4, v("#20242B"), 0, 0); }
    return g;
  }
  function fenetres(g, w, h, d, nuit, r) {
    if (h < 6) return;
    const o = g.ov(), pas = h > 40 ? 6.4 : 3.6, etages = Math.floor((h - 2) / pas), jour = hex("#4E6A88"), lum = hex("#FFD27A");
    for (let e = 0; e < etages; e++) {
      const y = 1.4 + e * pas; if (y > h - 1.4) break;
      [[0, d / 2 + .12, w, 0], [0, -d / 2 - .12, w, PI], [w / 2 + .12, 0, d, PI / 2], [-w / 2 - .12, 0, d, -PI / 2]].forEach(([x, z, L, a]) => {
        const c = Math.cos(a), s = Math.sin(a), n = [Math.sin(a), 0, Math.cos(a)];
        const bande = (o0, o1, col, em) => { const p0 = [x + o0 * c, y, z - o0 * s], p1 = [x + o1 * c, y, z - o1 * s];
          o.quad(p0, p1, [p1[0], y + 1.5, p1[2]], [p0[0], y + 1.5, p0[2]], col, em, n); };
        if (!nuit) { bande(-L / 2 + .8, L / 2 - .8, jour, .1); return; }
        // de nuit : une ou deux portions allumées par étage, le reste dans le noir
        if (r() < .35) return;
        const a0 = -L / 2 + .8 + r() * L * .4, a1 = Math.min(L / 2 - .8, a0 + L * (.25 + r() * .45));
        if (a1 > a0 + .6) bande(a0, a1, mel(lum, [1, 1, 1], r() * .3), 1);
      });
    }
  }


  /** prisme à 4 faces d'un point à un autre (branches, rubans, dents) */
  function branche(g, a, b, r0, r1, col, em) {
    const d = norme(sous(b, a)), u = norme(croix(d, Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), w = croix(d, u);
    const C = (p, r, i) => { const t = i / 4 * TAU + PI / 4, c = Math.cos(t) * r, s = Math.sin(t) * r; return [p[0] + u[0] * c + w[0] * s, p[1] + u[1] * c + w[1] * s, p[2] + u[2] * c + w[2] * s]; };
    for (let i = 0; i < 4; i++) { const t = (i + .5) / 4 * TAU + PI / 4, n = [u[0] * Math.cos(t) + w[0] * Math.sin(t), u[1] * Math.cos(t) + w[1] * Math.sin(t), u[2] * Math.cos(t) + w[2] * Math.sin(t)];
      g.quad(C(a, r0, i), C(a, r0, i + 1), C(b, r1, i + 1), C(b, r1, i), col, em, n); }
  }
  /** tube à 8 faces le long d'une suite de points (ver des sables, arcs lumineux) */
  function tube(g, P, R, col, em, anneaux) {
    const n = 8, cadre = i => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], d = norme(sous(b, a)), u = norme(croix(d, Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0])); return [u, croix(d, u)]; };
    let prec = null;
    P.forEach((p, i) => { const [u, w] = cadre(i), r = typeof R === "function" ? R(i / (P.length - 1)) : R;
      const anneau = []; for (let k = 0; k <= n; k++) { const t = k / n * TAU; anneau.push([p[0] + (u[0] * Math.cos(t) + w[0] * Math.sin(t)) * r, p[1] + (u[1] * Math.cos(t) + w[1] * Math.sin(t)) * r, p[2] + (u[2] * Math.cos(t) + w[2] * Math.sin(t)) * r]); }
      if (prec) for (let k = 0; k < n; k++) { const m = sous(mel(anneau[k], anneau[k + 1], .5), p); g.quad(prec[k], prec[k + 1], anneau[k + 1], anneau[k], anneaux && i % 2 ? anneaux : col, em, m); }
      prec = anneau; });
  }
  /** un endroit libre, le plus près possible du point voulu, à au moins m de la piste et des stands */
  function libre(T, m, x, z, evite) {
    let best = null, bd = 1e12; const loinDe = (a, b) => { let q = 1e9; for (let i = 0; i < T.N; i += 3) q = Math.min(q, Math.hypot(T.X[i] - a, T.Z[i] - b)); return q; }; const pas = 14, X0 = T.cx - T.rx - 260, X1 = T.cx + T.rx + 260, Z0 = T.cz - T.rz - 260, Z1 = T.cz + T.rz + 260;
    for (let a = X0; a <= X1; a += pas) for (let b = Z0; b <= Z1; b += pas) { const d2 = (a - x) * (a - x) + (b - z) * (b - z); if (d2 >= bd) continue;
      if (loinDe(a, b) < m || (evite || []).some(e => Math.hypot(a - e[0], b - e[1]) < e[2] + m * .6)) continue; bd = d2; best = [a, b]; }
    return best || [x, z];
  }

  /* ---------- Repères : les monuments de chaque ville ---------- */
  function repere(G, R, T, A, teinte, evite, lum) {
    const v = h => hex(h), x = R.x !== undefined ? R.x * ECH : 0, z = R.y !== undefined ? R.y * ECH : 0;
    // ----- V16.2 : les monuments des mondes à thème (posés sur un endroit libre ; renvoient la place qu'ils occupent) -----
    const ici = (m, px, pz) => libre(T, m, px !== undefined ? px : R.x !== undefined ? x : T.cx, pz !== undefined ? pz : R.y !== undefined ? z : T.cz, evite);
    const nuit = A.nuit ? 1 : 0, feu = (g, fx, fy, fz, k) => { g.cylindre(fx, fy, fz, 1.2 * k, 1.2 * k, 6, v("#4A3A2E")); g.boule(fx, fy + 2 * k, fz, 1.3 * k, v("#FF8A2B"), 1, 1.3); g.boule(fx, fy + 3.4 * k, fz, .8 * k, v("#FFD27A"), 1, 1.4); };
    if (R.t === "chateau") { const [px, pz] = ici(92), g = new Geo(), pierre = v("#9C968C"), pierre2 = v("#857F76"), toit = v("#3D4E9C"), lumi = v("#FFC86B"), c = 30;
      [[-c, -c, c, -c], [c, -c, c, c], [c, c, -c, c], [-c, c, -c, -c]].forEach(([ax, az, bx, bz]) => { const L = Math.hypot(bx - ax, bz - az), cap = Math.atan2(-(bz - az), bx - ax);
        g.boite((ax + bx) / 2, 0, (az + bz) / 2, L, 10, 3, pierre, 0, cap); for (let k = 0; k < 10; k++) { const f = (k + .5) / 10; g.boite(ax + (bx - ax) * f, 10, az + (bz - az) * f, 2.4, 1.6, 3.4, pierre2, 0, cap); } });
      [[-c, -c], [c, -c], [c, c], [-c, c]].forEach(([a, b]) => { g.cylindre(a, 0, b, 5, 18, 8, pierre); g.cylindre(a, 18, b, 5.8, 13, 8, toit, 0, 0); g.ov().boite(a, 11, b + 5.05, 1.2, 2, .2, lumi, nuit || .1); });
      g.boite(0, 0, 0, 24, 26, 20, pierre); fenetres(g, 24, 26, 20, A.nuit, alea(11));
      g.cylindre(-9, 26, -7, 4, 14, 8, pierre); g.cylindre(-9, 40, -7, 4.8, 12, 8, toit, 0, 0); g.cylindre(9, 26, 7, 5, 22, 8, pierre); g.cylindre(9, 48, 7, 5.8, 16, 8, toit, 0, 0);
      g.boite(9, 64, 7, .3, 7, .3, v("#555A60")); g.boite(10.8, 68, 7, 3.4, 2, .1, v("#7B4BD6"), nuit * .6); g.ov().boite(0, 0, c + 1.6, 7, 7, .2, v("#3A2A1E"));
      g.boule(-9, 55, -7, 3, v("#C08BFF"), 1); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.boule(-9 + Math.cos(a) * 7, 55 + Math.sin(a * 2) * 2, -7 + Math.sin(a) * 7, .8, v("#E9D5FF"), 1); }
      lum.push([px - 11, 69, pz - 9, .75, .55, 1, 70]); G.poser(g, px, 0, pz, .2, 1.25, teinte); return [[px, pz, 60]]; }
    if (R.t === "mur") { const g = new Geo(), L = T.rx * 2 + 700, zz = T.cz - T.rz - 62, h = 58, ep = 14, pierre = v("#8F8676"), joint = v("#776F61");
      g.boite(0, 0, 0, L, h, ep, pierre); for (let xx = -L / 2; xx < L / 2; xx += 9) g.boite(xx + 4, h, 0, 5, 3.2, ep + .4, joint);
      for (let xx = -L / 2 + 30; xx < L / 2; xx += 60) { g.boite(xx, 0, ep / 2 + 3, 10, h * .8, 6, joint); g.ov().boite(xx, h * .55, ep / 2 + 6.1, 1.6, 2.4, .2, v("#FF9A3D"), 1); }
      for (let k = -2; k <= 2; k++) g.ov().boite(k * 36, 6, ep / 2 + .1, 30, .8, .2, mel(pierre, [0, 0, 0], .2));
      g.boite(0, 0, ep / 2 + .1, 26, 30, 1, v("#3B3128")); g.boite(0, 30, ep / 2 + .5, 32, 4, 2, joint);
      const r = alea(31); for (let i = 0; i < 26; i++) g.boule((r() - .5) * L * .8, 0, ep / 2 + 6 + r() * 30, 2 + r() * 4, mel(pierre, [0, 0, 0], r() * .25), 0, .6);
      G.poser(g, T.cx, 0, zz, 0, 1, teinte); const Zs = []; for (let xx = -L / 2; xx <= L / 2; xx += 50) Zs.push([T.cx + xx, zz + 20, 50]); return Zs; }
    if (R.t === "ver") { const [px, pz] = ici(70), g = new Geo(), peau = v("#8A6A4A"), cotes = v("#6E5238");
      const corps = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * PI; corps.push([-62 + 34 * (1 - Math.cos(a)), Math.sin(a) * 24 - 4, 0]); }
      tube(g, corps, t => 5.5 + Math.sin(t * PI) * 1.5, peau, 0, cotes);
      const tete = []; for (let i = 0; i <= 14; i++) { const t = i / 14; tete.push([22 + t * 14, -6 + Math.sin(t * PI * .55) * 46, Math.sin(t * PI) * 3]); }
      tube(g, tete, t => 8 - t * 1.2, peau, 0, cotes);
      const bout = tete[tete.length - 1], av = tete[tete.length - 2], d = norme(sous(bout, av)), u = norme(croix(d, [0, 0, 1])), w = croix(d, u);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, o = [Math.cos(a) * 6.4, Math.sin(a) * 6.4], base = [bout[0] + u[0] * o[0] + w[0] * o[1], bout[1] + u[1] * o[0] + w[1] * o[1], bout[2] + u[2] * o[0] + w[2] * o[1]];
        branche(g, base, [base[0] + d[0] * 3 - (base[0] - bout[0]) * .45, base[1] + d[1] * 3 - (base[1] - bout[1]) * .45, base[2] + d[2] * 3 - (base[2] - bout[2]) * .45], .7, .05, v("#F2E8D2")); }
      g.boule(bout[0], bout[1], bout[2], 5.6, v("#3A1414"), .25, .4);
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; g.boule(36 + Math.cos(a) * 12, 0, Math.sin(a) * 12, 3 + (i % 3), v("#C9995E"), 0, .45); g.boule(-62 + Math.cos(a) * 9, 0, Math.sin(a) * 9, 2 + (i % 2), v("#C9995E"), 0, .45); g.boule(6 + Math.cos(a) * 9, 0, Math.sin(a) * 9, 2 + (i % 2), v("#C9995E"), 0, .45); }
      G.poser(g, px, 0, pz, .5, 1); return [[px, pz, 80]]; }
    if (R.t === "temple") { const [px, pz] = ici(60), g = new Geo(), roc = v("#9A9184"), m = v("#F1EBDD"), or = v("#F2B33A");
      g.cylindre(0, 0, 0, 52, 14, 10, roc, 0, 34); const y0 = 14; [[46, 26], [42, 22], [38, 18]].forEach((s, i) => g.boite(0, y0 + i * 1.2, 0, s[0], 1.2, s[1], m));
      const yc = y0 + 3.6, hc = 12; for (let i = 0; i < 6; i++) [-7.5, 7.5].forEach(zc => g.cylindre(-15 + i * 6, yc, zc, 1.1, hc, 8, m)); [-1, 1].forEach(sx => g.cylindre(sx * 15, yc, 0, 1.1, hc, 8, m));
      const ye = yc + hc; g.boite(0, ye, 0, 38, 2.4, 18, m); const yf = ye + 2.4, P = (a, b, c) => [a, b, c];
      [-1, 1].forEach(sx => { g.tri(P(sx * 19, yf, -9), P(sx * 19, yf, 9), P(sx * 19, yf + 6, 0), m, 0, [sx, 0, 0]); });
      g.quad(P(-19, yf, 9), P(19, yf, 9), P(19, yf + 6, 0), P(-19, yf + 6, 0), mel(m, [0, 0, 0], .08), 0, [0, 1, 1]); g.quad(P(-19, yf, -9), P(-19, yf + 6, 0), P(19, yf + 6, 0), P(19, yf, -9), mel(m, [0, 0, 0], .08), 0, [0, 1, -1]);
      g.boule(0, yf + 7.5, 0, 1.6, or, 1); g.ov().boite(0, ye + .6, 9.05, 30, 1, .2, or, .6);
      [[-21, 11], [21, 11]].forEach(([a, b]) => { g.cylindre(a, y0, b, .5, 4, 5, v("#5A4A3A")); feu(g, a, y0 + 4, b, 1.2); lum.push([px + a, y0 + 7, pz + b, 1, .7, .35, 22]); });
      G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 70]]; }
    if (R.t === "armoire") { const [px, pz] = ici(66), g = new Geo(), bois = v("#6B4226"), bois2 = v("#7E5232");
      g.boite(0, 0, 0, 14, 22, 7, bois); g.boite(0, 22, 0, 15.4, 1.4, 8, bois2); g.boite(0, 0, 0, 15, 1, 7.6, bois2); g.ov().boite(0, 1, 3.55, 13, 20, .1, v("#FFE6A8"), 1);
      [[-7, 1], [7, -1]].forEach(([hx, sg]) => { const a = sg > 0 ? 1.75 : PI - 1.75, d = [Math.cos(a), Math.sin(a)]; g.boite(hx + d[0] * 3.4, 1, 3.5 + d[1] * 3.4, 6.8, 20, .5, bois2, 0, Math.atan2(-d[1], d[0])); });
      for (let i = 0; i < 9; i++) g.boule(-10 + i * 2.6, 0, 5 + (i % 3), 2.2, v("#F4F7FA"), 0, .35);
      const l = objet("lanterne", alea(3), A); g.poser(l, 12, 0, 8, 0, 1.4); lum.push([px + 18, 11, pz + 13, 1, .85, .55, 24]);
      G.poser(g, px, 0, pz, .5, 1.7); return [[px, pz, 62]]; }
    if (R.t === "cheminees") { const [px, pz] = ici(60), g = new Geo(), brique = v("#7A3B2E");
      g.boite(0, 0, 0, 60, 14, 28, brique); for (let i = 0; i < 6; i++) g.bloc([[-30 + i * 10, 14, -14], [-20 + i * 10, 14, -14], [-20 + i * 10, 14, 14], [-30 + i * 10, 14, 14], [-30 + i * 10, 20, -14], [-20 + i * 10, 14.2, -14], [-20 + i * 10, 14.2, 14], [-30 + i * 10, 20, 14]], v("#4A4A4E"));
      fenetres(g, 60, 14, 28, A.nuit, alea(4));
      for (let i = 0; i < 5; i++) { const cx = -24 + i * 12, h = 34 + (i % 2) * 10; g.cylindre(cx, 0, -20, 2.4, h, 8, v("#6A3328"), 0, 1.8); for (let k = 0; k < 4; k++) g.boule(cx + k * 2.5, h + 3 + k * 4, -20 - k, 2.6 + k * 1.1, v("#55585E"), .05, .7); }
      G.poser(g, px, 0, pz, .3, 1); return [[px, pz, 55]]; }
    if (R.t === "tourcentrale") { const [px, pz] = ici(40), g = new Geo(), cy = v("#22D3EE"), ro = v("#FF4FD8"); let y = 0;
      [[26, 50], [20, 46], [14, 40], [9, 30]].forEach(([w, h], i) => { g.boite(0, y, 0, w, h, w, v("#1A1D2B"), 0, i * .4); for (let k = 4; k < h; k += 6) g.ov().boite(0, y + k, 0, w * 1.04, .5, w * 1.04, i % 2 ? ro : cy, 1, i * .4); y += h; });
      g.cylindre(0, y, 0, .6, 30, 4, cy, 1, .1); for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, b = (k + 1) / 24 * TAU; branche(g, [Math.cos(a) * 30, 110, Math.sin(a) * 30], [Math.cos(b) * 30, 110, Math.sin(b) * 30], .5, .5, ro, 1); }
      lum.push([px, y + 30, pz, .4, .9, 1, 40]); G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 40]]; }
    if (R.t === "holodome") { const [px, pz] = ici(60), g = new Geo(), Rr = 46, c1 = v("#22D3EE"), c2 = v("#FF4FD8");
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, P = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * PI / 2; P.push([Math.cos(a) * Math.cos(t) * Rr, Math.sin(t) * Rr * .8, Math.sin(a) * Math.cos(t) * Rr]); } tube(g, P, .5, k % 2 ? c1 : c2, 1); }
      [.3, .7].forEach(h => { const t = h * PI / 2, P = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU; P.push([Math.cos(a) * Math.cos(t) * Rr, Math.sin(t) * Rr * .8, Math.sin(a) * Math.cos(t) * Rr]); } tube(g, P, .45, c1, 1); });
      for (let e = 0; e < 5; e++) { const s = 22 - e * 4.4; g.boite(0, e * 4, 0, s, 4, s, mel(c2, [0, 0, 0], .5), .4); g.ov().boite(0, e * 4 + 4, 0, s * .9, .1, s * .9, e % 2 ? c1 : c2, 1); }
      lum.push([px, 26, pz, 1, .3, .8, 50]); G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 56]]; }
    if (R.t === "mai") { const [px, pz] = ici(56), g = new Geo(), r = alea(21);
      g.poser(objet("mai", r, A), 0, 0, 0, 0, 4.2); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.poser(objet("fleurs", r, A), Math.cos(a) * 30, 0, Math.sin(a) * 30, 0, 1.7); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; branche(g, [34 + Math.cos(a) * 3, 0, Math.sin(a) * 3], [34, 5, 0], .5, .3, v("#6B4A30")); } feu(g, 34, 2, 0, 2); lum.push([px + 34, 8, pz, 1, .7, .35, 26]);
      G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 60]]; }
    if (R.t === "faille") { const [px, pz] = ici(90), g = new Geo(), r = alea(13), P = [];
      for (let i = 0; i <= 12; i++) P.push([(r() - .5) * 6, i * 4.5, (r() - .5) * 2]); tube(g, P, t => .6 + Math.sin(t * PI) * 2.6, v("#FF2B3D"), 1);
      tube(g, P.map(p => [p[0], p[1], p[2] - .2]), t => 1.2 + Math.sin(t * PI) * 4, v("#5A0A14"), .4);
      for (let i = 0; i < 16; i++) { const a = r() * TAU, d = 14 + r() * 26; g.boule(Math.cos(a) * d, 8 + r() * 40, Math.sin(a) * d, 1 + r() * 2.6, v("#3A3438"), 0, .8); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.poser(objet("arbremort", r, A), Math.cos(a) * 20, 0, Math.sin(a) * 20, a, 2.2); }
      lum.push([px, 50, pz, 1, .15, .2, 90]); G.poser(g, px, 0, pz, 0, 2); return [[px, pz, 80]]; }
    if (R.t === "champignons") { const [px, pz] = ici(56), g = new Geo(), r = alea(17);
      g.poser(objet("ruine", r, A), -14, 0, 4, .3, 1.8); g.poser(objet("ruine", r, A), 16, 0, -10, 1.2, 1.5);
      [[0, 0, 7], [-20, 14, 5], [18, 12, 6], [6, -20, 4.5], [-16, -16, 3.5]].forEach(([a, b, k]) => g.poser(objet("champignon", r, A), a, 0, b, r() * TAU, k));
      G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 50]]; }
    if (R.t === "garage") { const [px, pz] = ici(52), g = new Geo(), gris = v("#AEB4BC");
      g.boite(0, 0, 0, 70, 18, 34, gris); g.boite(0, 18, 0, 72, 1.2, 36, v("#5A6068"));
      for (let k = 0; k < 3; k++) { const ox = -23 + k * 23; g.ov().boite(ox, 0, 17.05, 16, 12, .2, k === 1 ? v("#FFE6A8") : v("#C9CED6"), k === 1 ? 1 : 0); if (k !== 1) for (let y = 1; y < 12; y += 1.5) g.ov().boite(ox, y, 17.15, 16, .3, .1, v("#8C939C")); }
      g.boite(0, 19.2, 0, 34, 2.4, 4, v("#F28C28"), .2); for (let k = 0; k < 9; k++) { if (k === 4) continue; const a = k / 9 * TAU; g.boite(17 + 6 + Math.cos(a) * 5, 19.2, Math.sin(a) * 5, 3, 2.4, 3, v("#F28C28"), .2, -a); }
      g.ov().boite(0, 14, 17.1, 40, 2.4, .2, v("#F28C28"), nuit);
      const r = alea(5); for (let i = 0; i < 4; i++) g.poser(objet("pneus", r, A), -30 + i * 6, 0, 24, 0, 1);
      G.poser(g, px, 0, pz, .1, 1, teinte); return [[px, pz, 50]]; }
    if (R.t === "feu") { const [px, pz] = ici(36), g = new Geo(), r = alea(23);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; branche(g, [Math.cos(a) * 4, 0, Math.sin(a) * 4], [0, 6, 0], .6, .3, v("#5A3F2A")); g.boite(Math.cos(a) * 12, 0, Math.sin(a) * 12, 5, 1.2, 1.4, v("#6B4A30"), 0, -a + PI / 2); }
      feu(g, 0, 2, 0, 3.4); for (let i = 0; i < 6; i++) g.poser(objet("luciole", r, A), (r() - .5) * 40, 0, (r() - .5) * 40, 0, 1.3);
      lum.push([px, 8, pz, 1, .7, .35, 30]); G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 34]]; }
    if (R.t === "plateau") { const [px, pz] = ici(50), g = new Geo(), r = alea(19);
      g.poser(objet("de", r, A), -10, 0, -6, .4, 2.4); g.poser(objet("de", r, A), 12, 0, 4, 1.1, 2.1);
      [[-26, 18], [24, -20], [0, 26]].forEach(([a, b]) => g.poser(objet("pion", r, A), a, 0, b, 0, 2.6));
      g.cylindre(30, 0, 22, 3, .6, 8, v("#C9A24A")); g.cylindre(30, .6, 22, 2.6, 6, 8, v("#F2E6CC"), .3, .3); g.cylindre(30, 6.6, 22, .3, 6, 8, v("#F2E6CC"), .3, 2.6); g.cylindre(30, 12.6, 22, 3, .6, 8, v("#C9A24A"));
      G.poser(g, px, 0, pz, 0, 1); return [[px, pz, 50]]; }
    if (R.t === "roue") { const g = new Geo(), r = 26, cx = 0, cy = r + 6; g.boite(-6, 0, 0, 1.4, cy, 1.4, v("#C9D2DD")); g.boite(6, 0, 0, 1.4, cy, 1.4, v("#C9D2DD"));
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, b = (i + 1) / 24 * TAU; const p = t => [cx + Math.cos(t) * r, cy + Math.sin(t) * r, 0]; const A1 = p(a), B1 = p(b);
        g.quad([A1[0], A1[1], -.4], [B1[0], B1[1], -.4], [B1[0], B1[1], .4], [A1[0], A1[1], .4], v("#E8ECF0"), A.nuit ? .8 : 0, [Math.cos(a), Math.sin(a), 0]);
        if (i % 3 === 0) { g.boite(A1[0], A1[1] - 1.5, 0, 2.2, 2.2, 2.2, hex(["#FF5A5F", "#4C9AFF", "#F7CF55", "#3DDC97"][i / 3 % 4]), A.nuit ? .7 : 0); g.quad([cx, cy, -.2], [A1[0], A1[1], -.2], [A1[0], A1[1], .2], [cx, cy, .2], v("#AEB7C2"), 0, [0, 0, 1]); } }
      G.poser(g, x, 0, z, .4, 1, teinte); return; }
    if (R.t === "skyline") { const r = alea(hashTxt("sky" + x + z)); for (let i = 0; i < 16; i++) { const g = objet(A.synth || A.nuit ? "gratteciel" : "gratteciel", r, A); G.poser(g, x + (r() - .5) * 420, 0, z + (r() - .5) * 90, 0, 1 + r() * .6, teinte); } return; }
    if (R.t === "sphere") { const g = new Geo(); g.boule(0, 30, 0, 30, A.synth ? v("#FF4FD8") : v("#F7CF55"), 1); G.poser(g, x, 0, z, 0, 1); return; }
    if (R.t === "mbs") { const g = new Geo(); for (let i = -1; i <= 1; i++) g.boite(i * 22, 0, 0, 12, 70, 16, v("#C9D2DD")); g.boite(0, 70, 0, 80, 3, 14, v("#E8ECF0"), A.nuit ? .3 : 0); fenetres(g, 60, 70, 16, A.nuit, alea(9)); G.poser(g, x, 0, z, 0, 1, teinte); return; }
    if (R.t === "fontaine") { const g = new Geo(); g.cylindre(0, 0, 0, 3, 120, 6, v("#E8F6FF"), .9, .2); G.poser(g, x, 0, z, 0, 1); return; }
    if (R.t === "biosphere") { const g = new Geo(); g.boule(0, 10, 0, 22, v("#C9D8E6"), A.nuit ? .3 : 0, .85); G.poser(g, x, 0, z, 0, 1, teinte); return; }
    if (R.t === "stade") { const g = new Geo(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, b = (i + 1) / 20 * TAU, r1 = 40, r2 = 56; const P = (t, r, h) => [Math.cos(t) * r, h, Math.sin(t) * r * .7]; g.quad(P(a, r1, 2), P(b, r1, 2), P(b, r2, 16), P(a, r2, 16), i % 2 ? v("#2A9D8F") : v("#E9C46A"), 0, [-Math.cos(a), 1, -Math.sin(a)]); g.quad(P(a, r2, 0), P(b, r2, 0), P(b, r2, 16), P(a, r2, 16), v("#F4F6F8"), 0, [Math.cos(a), 0, Math.sin(a)]); } g.quad([-40, .1, -28], [40, .1, -28], [40, .1, 28], [-40, .1, 28], v("#5DBB63"), 0, [0, 1, 0]); G.poser(g, x, 0, z, 0, 1, teinte); return; }
    if (R.t === "hangar") { const g = new Geo(); for (let i = 0; i < 3; i++) { g.boite(i * 26 - 26, 0, 0, 22, 9, 30, v("#9AA3AE")); for (let k = 0; k < 6; k++) { const a = k / 6 * PI, b = (k + 1) / 6 * PI; g.quad([i * 26 - 26 + Math.cos(a) * 11, 9 + Math.sin(a) * 5, -15], [i * 26 - 26 + Math.cos(b) * 11, 9 + Math.sin(b) * 5, -15], [i * 26 - 26 + Math.cos(b) * 11, 9 + Math.sin(b) * 5, 15], [i * 26 - 26 + Math.cos(a) * 11, 9 + Math.sin(a) * 5, 15], v("#B9C1CB"), 0, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0]); } } G.poser(g, x, 0, z, 0, 1, teinte); return; }
    if (R.t === "casino") { const g = new Geo(); g.boite(0, 0, 0, 34, 14, 20, v("#F2E6CC")); g.boite(-14, 14, 0, 5, 8, 5, v("#E6D3AE")); g.boite(14, 14, 0, 5, 8, 5, v("#E6D3AE")); g.boule(0, 14, 0, 6, v("#5E8C7A"), 0, .9); fenetres(g, 34, 14, 20, A.nuit, alea(3)); G.poser(g, x, 0, z, .3, 1, teinte); return; }
    if (R.t === "tunnel") {   // une galerie couverte sur une portion de la piste
      for (let s = R.s0 * T.L; s < R.s1 * T.L; s += 4) {
        const p = T.a(s, 0), q = T.a(s + 4, 0), nx = -p.tz, nz = p.tx, nqx = -q.tz, nqz = q.tx, w = DEMI + 3, h = 7;
        const pt = (P, ox, oz, s2, hh) => [P.x + ox * s2, P.y + hh, P.z + oz * s2];
        G.quad(pt(p, nx, nz, w, 0), pt(q, nqx, nqz, w, 0), pt(q, nqx, nqz, w, h), pt(p, nx, nz, w, h), v("#CDBF9F"), 0, [nx, 0, nz]);
        G.quad(pt(p, nx, nz, w, h), pt(q, nqx, nqz, w, h), pt(q, nqx, nqz, -w, h), pt(p, nx, nz, -w, h), v("#B5A887"), 0, [0, 1, 0]);
        G.quad(pt(p, nx, nz, -w, 0), pt(q, nqx, nqz, -w, 0), pt(q, nqx, nqz, -w, h * .5), pt(p, nx, nz, -w, h * .5), v("#CDBF9F"), 0, [-nx, 0, -nz]);
        if (Math.floor(s / 4) % 3 === 0) G.boite(p.x, p.y + h - .6, p.z, 1.2, .4, 6, v("#FFE7A8"), 1);
      }
      return;
    }
    if (R.t === "yas") {   // l'hôtel de Yas Marina, qui enjambe la piste
      const p = T.a(R.s * T.L, 0), cap = Math.atan2(-p.tz, p.tx), nx = -p.tz, nz = p.tx, g = new Geo();
      g.boite(0, 0, 0, 30, 16, 18, v("#E8ECF0")); fenetres(g, 30, 16, 18, 1, alea(5));
      G.poser(g, p.x + nx * 28, 0, p.z + nz * 28, cap, 1, teinte); G.poser(g, p.x - nx * 28, 0, p.z - nz * 28, cap, 1, teinte);
      const toit = new Geo(), cols = ["#4C9AFF", "#9B87FF", "#FF4FD8", "#22D3EE"];
      for (let i = -6; i < 6; i++) for (let k = -4; k < 4; k++) { const a = (i + .5) / 6 * .9, y = 22 + Math.cos(a * 1.4) * 5; toit.quad([i * 7, y, k * 6], [i * 7 + 7, 22 + Math.cos((i + 1.5) / 6 * .9 * 1.4) * 5, k * 6], [i * 7 + 7, 22 + Math.cos((i + 1.5) / 6 * .9 * 1.4) * 5, k * 6 + 6], [i * 7, y, k * 6 + 6], hex(cols[(i + k + 12) % 4]), .85, [0, 1, 0]); }
      G.poser(toit, p.x, 0, p.z, cap + PI / 2, 1);
    }
  }

  /* ============================================================
     V16.6 · Circuits peints : un plan commun à la carte 2D illustrée et au décor 3D
     Janvier · Forêt aux lucioles : arbre géant creux (tunnel), rivière et pont, bassin et cascade,
     vieux moulin, maisons-champignons, lanternes, lucioles, feux follets ; 4 clins d'œil cachés.
     Unité du plan : u = 1,25 × mètre (la carte fait 1080 × 720 u = 864 × 576 m).
     ============================================================ */
  const KU = 1.25;
  function planForet(T) {
    const P = []; for (let i = 0; i < T.N; i++) P.push([T.X[i] * KU, T.Z[i] * KU]);
    const N = P.length, W = 1080, H = 720;
    const dTrack = (x, y) => { let m = 1e9; for (let i = 0; i < N; i += 2) { const d = Math.hypot(P[i][0] - x, P[i][1] - y); if (d < m) m = d; } return m; };
    const nrm = i => { const a = P[(i - 2 + N) % N], b = P[(i + 2) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l, dx / l, dy / l]; };
    let cx = 0, cy = 0; P.forEach(p => { cx += p[0] / N; cy += p[1] / N; });
    const inside = (x, y) => { let o = false; for (let i = 0, j = N - 1; i < N; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) o = !o; } return o; };
    let iB = 0, iT = 0, bx = -1, ty = 1e9; P.forEach((p, i) => { if (Math.abs(p[1] - cy) < 60 && p[0] > bx) { bx = p[0]; iB = i; } if (Math.abs(p[0] - cx - 40) < 40 && p[1] < ty) { ty = p[1]; iT = i; } });
    const B = P[iB], TT = P[iT], nb = nrm(iB), bassin = [cx + 150, cy + 10];
    const riv = [[bassin[0] - 10, bassin[1]], [bassin[0] + 40, bassin[1] - 20], [(bassin[0] + B[0]) / 2 + 10, (bassin[1] + B[1]) / 2 + 25], [B[0] - nb[0] * 6, B[1] - nb[1] * 6], [B[0] + 40, B[1] + 10], [B[0] + 70, B[1] - 20], [W + 30, B[1] - 30]];
    const dRiv = (x, y) => { let m = 1e9; for (let k = 0; k < riv.length - 1; k++) for (let t = 0; t <= 1; t += .05) { const a = riv[k], b = riv[k + 1]; m = Math.min(m, Math.hypot(a[0] + (b[0] - a[0]) * t - x, a[1] + (b[1] - a[1]) * t - y)); } return m; };
    const MX = cx - 40, MY = cy + 10, r = alea(101), maisons = [];
    for (let k = 0; k < 400 && maisons.length < 7; k++) { const x = cx + (r() - .5) * 520, y = cy + (r() - .5) * 300; if (!inside(x, y) || dTrack(x, y) < 40 || dRiv(x, y) < 30 || Math.hypot(x - bassin[0], y - bassin[1]) < 90 || Math.hypot(x - MX, y - MY) < 85 || maisons.some(m => Math.hypot(m[0] - x, m[1] - y) < 70)) continue; maisons.push([x, y, 14 + r() * 8]); }
    let porte = [W * .8, H * .85]; for (let k = 0; k < 300; k++) { const x = W * (.6 + r() * .3), y = H * (.7 + r() * .22); if (!inside(x, y) && dTrack(x, y) > 50 && dRiv(x, y) > 40) { porte = [x, y]; break; } }
    return { P, N, W, H, cx, cy, iB, iT, B, TT, nb, nrm, bassin, riv, dTrack, dRiv, inside, MX, MY, maisons, souche: [MX - 110, MY + 70], coffre: [MX + 52, MY - 40], porte };
  }
  /** la carte 2D peinte : { fond (image fixe, dessinée une fois), anim (lucioles, feux follets, eau, ailes du moulin) } */
  function peindreForet(T, Z) {
    const L = planForet(T), { P, N, W, H, cx, cy, B, TT, bassin, riv, inside, dTrack, dRiv, nrm, MX, MY } = L, iT = L.iT;
    const r = alea(7), f = v => v.toFixed(1), anime = ANIM();
    const chemin = l => "M" + l.map(p => f(p[0]) + " " + f(p[1])).join("L");
    const lisseD = l => { let d = "M" + f(l[0][0]) + " " + f(l[0][1]); for (let i = 1; i < l.length - 1; i++) { const m = [(l[i][0] + l[i + 1][0]) / 2, (l[i][1] + l[i + 1][1]) / 2]; d += "Q" + f(l[i][0]) + " " + f(l[i][1]) + " " + f(m[0]) + " " + f(m[1]); } const z = l[l.length - 1]; return d + "L" + f(z[0]) + " " + f(z[1]); };
    const piste = "M" + P.map(p => f(p[0]) + " " + f(p[1])).join("L") + "Z", rivD = lisseD(riv), [nbx, nby, tbx, tby] = L.nb;
    const i0 = Math.floor(Z.piege.s0 / T.ds), i1 = Math.floor(Z.piege.s1 / T.ds), piege = []; for (let i = i0; i <= i1; i++) piege.push((i + N) % N);
    const s = [], a = [];
    s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>
 <radialGradient id="sol" cx="62%" cy="38%" r="80%"><stop offset="0" stop-color="#1F4A43"/><stop offset=".55" stop-color="#123430"/><stop offset="1" stop-color="#071613"/></radialGradient>
 <radialGradient id="clair" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3E7A55"/><stop offset="1" stop-color="#25503D" stop-opacity="0"/></radialGradient>
 <radialGradient id="cime" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#2F7A6E"/><stop offset=".55" stop-color="#174A48"/><stop offset="1" stop-color="#08201F"/></radialGradient>
 <radialGradient id="cime2" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#3F8C78"/><stop offset=".6" stop-color="#1E5650"/><stop offset="1" stop-color="#0B2A28"/></radialGradient>
 <radialGradient id="geant" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#6FB98A"/><stop offset=".5" stop-color="#2E7A5C"/><stop offset="1" stop-color="#0F3A30"/></radialGradient>
 <radialGradient id="halo" r="50%"><stop offset="0" stop-color="#FFE9A3" stop-opacity=".95"/><stop offset=".35" stop-color="#FFC45C" stop-opacity=".45"/><stop offset="1" stop-color="#FF9E3D" stop-opacity="0"/></radialGradient>
 <radialGradient id="luc" r="50%"><stop offset="0" stop-color="#F4FFB0"/><stop offset=".3" stop-color="#C8F25A" stop-opacity=".7"/><stop offset="1" stop-color="#9BE03A" stop-opacity="0"/></radialGradient>
 <radialGradient id="lune" cx="85%" cy="8%" r="60%"><stop offset="0" stop-color="#BFD9FF" stop-opacity=".28"/><stop offset="1" stop-color="#BFD9FF" stop-opacity="0"/></radialGradient>
 <radialGradient id="vign" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
 <linearGradient id="eau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CC8E8"/><stop offset="1" stop-color="#1F6C9A"/></linearGradient>
 <filter id="flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
 <filter id="flou8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
 <filter id="mousse"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .18  0 0 0 0 .42  0 0 0 0 .3  0 0 0 .5 0"/></filter>
</defs><rect width="${W}" height="${H}" fill="url(#sol)"/><rect width="${W}" height="${H}" filter="url(#mousse)" opacity=".7"/>
<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="330" ry="210" fill="url(#clair)" opacity=".8"/>`);
    // prairie de la clairière
    for (let k = 0; k < 900; k++) { const x = cx + (r() - .5) * 620, y = cy + (r() - .5) * 380; if (!inside(x, y) || dTrack(x, y) < 22) continue; s.push(`<path d="M${f(x)} ${f(y)}l-2 -5M${f(x)} ${f(y)}l0 -6M${f(x)} ${f(y)}l2 -5" stroke="${r() < .5 ? "#4F8F5C" : "#3C7A50"}" stroke-width="1.3" opacity=".8"/>`); }
    for (let k = 0; k < 120; k++) { const x = cx + (r() - .5) * 600, y = cy + (r() - .5) * 360; if (!inside(x, y) || dTrack(x, y) < 22) continue; const c = ["#B8F0FF", "#F7C6FF", "#FFF1A8"][k % 3]; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${c}" opacity=".18"/><circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="${c}"/>`); }
    for (let k = 0; k < 14; k++) { const x = cx + (r() - .5) * 560, y = cy + (r() - .5) * 320; if (!inside(x, y) || dTrack(x, y) < 30) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(5 + r() * 6)}" ry="${f(4 + r() * 4)}" fill="#5A6669" stroke="#2C3436" stroke-width="1.5"/>`); }
    // sentiers, rivière, bassin, cascade, nénuphars
    s.push(`<path d="${lisseD([[cx - 230, cy + 60], [cx - 100, cy + 20], [cx, cy + 40], [bassin[0] - 30, bassin[1] + 10]])}" fill="none" stroke="#6E5A3C" stroke-width="5" stroke-linecap="round" opacity=".55" stroke-dasharray="2 7"/>
<path d="${rivD}" fill="none" stroke="#0B2A33" stroke-width="30" stroke-linecap="round" opacity=".8"/><path d="${rivD}" fill="none" stroke="url(#eau)" stroke-width="20" stroke-linecap="round"/>
<ellipse cx="${f(bassin[0])}" cy="${f(bassin[1])}" rx="62" ry="44" fill="#0B2A33"/><ellipse cx="${f(bassin[0])}" cy="${f(bassin[1])}" rx="55" ry="38" fill="url(#eau)"/>
<ellipse cx="${f(bassin[0] - 12)}" cy="${f(bassin[1] - 8)}" rx="30" ry="16" fill="#E8FBFF" opacity=".25" filter="url(#flou)"/>`);
    a.push(`<path d="${rivD}" fill="none" stroke="#C9F1FF" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 18" opacity=".7">${anime ? '<animate attributeName="stroke-dashoffset" from="0" to="-48" dur="2.4s" repeatCount="indefinite"/>' : ""}</path>`);
    for (let k = 0; k < 9; k++) { const t = Math.PI * (1.05 + k * .1), x = bassin[0] + Math.cos(t) * 66, y = bassin[1] + Math.sin(t) * 48; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(9 + r() * 7)}" ry="${f(7 + r() * 5)}" fill="#4B5658" stroke="#2C3436" stroke-width="2"/><ellipse cx="${f(x - 2)}" cy="${f(y - 3)}" rx="4" ry="2.5" fill="#8E9BA0" opacity=".6"/>`); }
    s.push(`<path d="M${f(bassin[0] - 14)} ${f(bassin[1] - 50)} q14 -6 28 0 l-4 30 q-10 4 -20 0 z" fill="#BDEBFF" opacity=".85"/><ellipse cx="${f(bassin[0])}" cy="${f(bassin[1] - 18)}" rx="22" ry="8" fill="#fff" opacity=".55" filter="url(#flou)"/>`);
    a.push(`<path d="M${f(bassin[0] - 10)} ${f(bassin[1] - 46)} l2 26 M${f(bassin[0])} ${f(bassin[1] - 48)} l0 28 M${f(bassin[0] + 9)} ${f(bassin[1] - 46)} l-2 26" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4" opacity=".85">${anime ? '<animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".7s" repeatCount="indefinite"/>' : ""}</path>`);
    for (let k = 0; k < 6; k++) { const x = bassin[0] + (r() - .5) * 70, y = bassin[1] + (r() - .2) * 40; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="#3E8E5A"/><circle cx="${f(x)}" cy="${f(y)}" r="9" fill="url(#halo)" opacity=".6"/><circle cx="${f(x)}" cy="${f(y)}" r="1.8" fill="#FFE7F1"/>`); }
    // arbres
    const arbres = [];
    for (let k = 0; k < 4000 && arbres.length < 330; k++) {
      const x = r() * (W + 40) - 20, y = r() * (H + 40) - 20, R = 12 + r() * 20;
      if (dTrack(x, y) < R + 16 || dRiv(x, y) < R + 12 || Math.hypot(x - bassin[0], y - bassin[1]) < 80 + R) continue;
      if (inside(x, y) && Math.hypot((x - cx) / 300, (y - cy) / 190) < 1 && r() < .97) continue;
      if (Math.hypot(x - TT[0], y - TT[1]) < 95) continue;
      if (arbres.some(t => Math.hypot(t[0] - x, t[1] - y) < (t[2] + R) * .62)) continue;
      arbres.push([x, y, R]);
    }
    arbres.sort((p, q) => p[1] - q[1]);
    const ombres = [], cimes = [];
    arbres.forEach(([x, y, R]) => {
      ombres.push(`<ellipse cx="${f(x + R * .35)}" cy="${f(y + R * .4)}" rx="${f(R * 1.05)}" ry="${f(R * .9)}" fill="#020806" opacity=".55"/>`);
      const g = r() < .3 ? "cime2" : "cime", n = 4 + Math.floor(r() * 3); let c = "";
      for (let k = 0; k < n; k++) { const t = k / n * TAU + r(), d = R * .38; c += `<circle cx="${f(x + Math.cos(t) * d)}" cy="${f(y + Math.sin(t) * d)}" r="${f(R * (.55 + r() * .2))}" fill="url(#${g})"/>`; }
      c += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .6)}" fill="url(#${g})"/><path d="M${f(x - R * .7)} ${f(y - R * .25)} A${f(R * .8)} ${f(R * .8)} 0 0 1 ${f(x + R * .15)} ${f(y - R * .78)}" fill="none" stroke="#A8E6C2" stroke-width="1.6" opacity=".35"/>`;
      cimes.push(c);
    });
    // la piste : chemin de terre bordé de pierres
    s.push(ombres.join("") + `<path d="${piste}" fill="none" stroke="#050B09" stroke-width="40" stroke-linejoin="round" opacity=".5" filter="url(#flou)"/>
<path d="${piste}" fill="none" stroke="#3A3530" stroke-width="31" stroke-linejoin="round"/><path d="${piste}" fill="none" stroke="#6F6559" stroke-width="31" stroke-linejoin="round" stroke-dasharray="3 5" opacity=".9"/>
<path d="${piste}" fill="none" stroke="#7A5C3E" stroke-width="24" stroke-linejoin="round"/><path d="${piste}" fill="none" stroke="#8E6E4C" stroke-width="16" stroke-linejoin="round"/>
<path d="${piste}" fill="none" stroke="#5E4730" stroke-width="12" stroke-linejoin="round" opacity=".5"/><path d="${piste}" fill="none" stroke="#9C7C58" stroke-width="7" stroke-linejoin="round" opacity=".8"/>`);
    // pont de bois éclairé
    { const Lp = 46, w = 34; let pl = ""; for (let k = -5; k <= 5; k++) { const o = k * 4; pl += `<path d="M${f(B[0] + tbx * o - nbx * w / 2)} ${f(B[1] + tby * o - nby * w / 2)}L${f(B[0] + tbx * o + nbx * w / 2)} ${f(B[1] + tby * o + nby * w / 2)}" stroke="${k % 2 ? "#9A6B42" : "#86593A"}" stroke-width="3.6"/>`; }
      s.push(pl); [-1, 1].forEach(sd => { s.push(`<path d="M${f(B[0] - tbx * Lp / 2 + nbx * sd * 17)} ${f(B[1] - tby * Lp / 2 + nby * sd * 17)}L${f(B[0] + tbx * Lp / 2 + nbx * sd * 17)} ${f(B[1] + tby * Lp / 2 + nby * sd * 17)}" stroke="#4A3020" stroke-width="3.5" stroke-linecap="round"/>`);
        [-1, 1].forEach(e => s.push(`<circle cx="${f(B[0] + tbx * e * Lp / 2 + nbx * sd * 17)}" cy="${f(B[1] + tby * e * Lp / 2 + nby * sd * 17)}" r="12" fill="url(#halo)"/><circle cx="${f(B[0] + tbx * e * Lp / 2 + nbx * sd * 17)}" cy="${f(B[1] + tby * e * Lp / 2 + nby * sd * 17)}" r="2.6" fill="#FFF3C8"/>`)); }); }
    // lanternes le long de la piste
    for (let i = 0; i < N; i += 16) { const [nx, ny] = nrm(i), sd = (i / 16) % 2 ? 1 : -1, x = P[i][0] + nx * sd * 21, y = P[i][1] + ny * sd * 21; if (Math.hypot(x - TT[0], y - TT[1]) < 70 || Math.hypot(x - B[0], y - B[1]) < 30) continue;
      s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="url(#halo)" opacity=".85"/><circle cx="${f(x)}" cy="${f(y)}" r="2.8" fill="#2B1E14"/><circle cx="${f(x)}" cy="${f(y)}" r="1.7" fill="#FFF0BC"/>`); }
    // le piège « Feux follets » : flammes bleues qui dansent (animées)
    for (let k = 0; k < 16; k++) { const i = piege[Math.floor(r() * piege.length)], [nx, ny] = nrm(i), o = (r() - .5) * 30, x = P[i][0] + nx * o, y = P[i][1] + ny * o, d = (1 + r() * 1.6).toFixed(2);
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(7 + r() * 6)}" fill="url(#p2-follet)">${anime ? `<animate attributeName="opacity" values="1;.25;1" dur="${d}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 8)} ${f(-3 - r() * 5)};0 0" dur="${(+d * 1.7).toFixed(2)}s" repeatCount="indefinite"/>` : ""}</circle>`); }
    s.push(cimes.join(""));
    // l'arbre géant creux : la piste passe dans son tronc
    { const [nx, ny, tx, ty2] = nrm(iT), R = 74; let rac = "";
      for (let k = 0; k < 14; k++) { const t = k / 14 * TAU + .2, x1 = TT[0] + Math.cos(t) * 40, y1 = TT[1] + Math.sin(t) * 40, x2 = TT[0] + Math.cos(t + .25) * (R + 24 + r() * 20), y2 = TT[1] + Math.sin(t + .25) * (R + 24 + r() * 20);
        rac += `<path d="M${f(x1)} ${f(y1)}Q${f((x1 + x2) / 2 + (r() - .5) * 20)} ${f((y1 + y2) / 2 + (r() - .5) * 20)} ${f(x2)} ${f(y2)}" stroke="#4E3A2A" stroke-width="${f(6 + r() * 4)}" fill="none" stroke-linecap="round"/><path d="M${f(x1)} ${f(y1)}Q${f((x1 + x2) / 2)} ${f((y1 + y2) / 2)} ${f(x2)} ${f(y2)}" stroke="#9BF5D0" stroke-width="1.4" fill="none" opacity=".55" filter="url(#flou)"/>`; }
      s.push(rac + `<circle cx="${f(TT[0] + 18)}" cy="${f(TT[1] + 22)}" r="${R + 6}" fill="#020806" opacity=".6" filter="url(#flou8)"/>`);
      let c = ""; for (let k = 0; k < 9; k++) { const t = k / 9 * TAU, d = R * .45; c += `<circle cx="${f(TT[0] + Math.cos(t) * d)}" cy="${f(TT[1] + Math.sin(t) * d)}" r="${f(R * .6)}" fill="url(#geant)"/>`; }
      s.push(c + `<circle cx="${f(TT[0])}" cy="${f(TT[1])}" r="${f(R * .62)}" fill="url(#geant)"/>`);
      [-1, 1].forEach(sd => { const x = TT[0] + tx * sd * (R - 6), y = TT[1] + ty2 * sd * (R - 6), rot = f(Math.atan2(ny, nx) * 57.3); s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="18" ry="11" transform="rotate(${rot} ${f(x)} ${f(y)})" fill="#1A120C" stroke="#6B4E36" stroke-width="3"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="12" ry="6" transform="rotate(${rot} ${f(x)} ${f(y)})" fill="url(#halo)"/>`); });
      for (let k = 0; k < 26; k++) { const t = r() * TAU, d = r() * R; s.push(`<circle cx="${f(TT[0] + Math.cos(t) * d)}" cy="${f(TT[1] + Math.sin(t) * d)}" r="${f(3 + r() * 3)}" fill="url(#luc)"/>`); }
      const ox = TT[0] + R * .55, oy = TT[1] + R * .35;
      s.push(`<path d="M${f(ox - 26)} ${f(oy + 8)}Q${f(ox)} ${f(oy + 2)} ${f(ox + 26)} ${f(oy + 10)}" stroke="#4E3A2A" stroke-width="4" fill="none"/><ellipse cx="${f(ox)}" cy="${f(oy - 2)}" rx="9" ry="11" fill="#7A6450"/><ellipse cx="${f(ox)}" cy="${f(oy + 1)}" rx="6" ry="7" fill="#C9B396"/>
<path d="M${f(ox - 8)} ${f(oy - 11)}l3 5l3 -3z M${f(ox + 8)} ${f(oy - 11)}l-3 5l-3 -3z" fill="#7A6450"/><circle cx="${f(ox - 3.6)}" cy="${f(oy - 4)}" r="3.2" fill="#FFD84A"/><circle cx="${f(ox + 3.6)}" cy="${f(oy - 4)}" r="3.2" fill="#FFD84A"/><circle cx="${f(ox - 3.6)}" cy="${f(oy - 4)}" r="1.3" fill="#111"/><circle cx="${f(ox + 3.6)}" cy="${f(oy - 4)}" r="1.3" fill="#111"/><path d="M${f(ox - 1.5)} ${f(oy - 1)}l1.5 2.5l1.5 -2.5z" fill="#E09A3A"/>
<g transform="translate(${f(TT[0] - 30)} ${f(TT[1] + 40)})"><path d="M0 4c-6-8-16-2-8 6l8 7 8-7c8-8-2-14-8-6z" fill="none" stroke="#E9D9B8" stroke-width="1.2" opacity=".75"/><text x="0" y="8" text-anchor="middle" font-family="Georgia, serif" font-size="5.5" fill="#E9D9B8" opacity=".9">T·K·C·D</text></g>`); }
    // le vieux moulin (corps ici ; ailes animées dans la couche du dessus)
    s.push(`<circle cx="${f(MX + 8)}" cy="${f(MY + 10)}" r="36" fill="#020806" opacity=".55" filter="url(#flou)"/><circle cx="${f(MX)}" cy="${f(MY)}" r="70" fill="url(#halo)" opacity=".25"/><circle cx="${f(MX)}" cy="${f(MY)}" r="27" fill="#7E7466" stroke="#3E372F" stroke-width="3"/>`);
    for (let k = 0; k < 16; k++) { const t = k / 16 * TAU; s.push(`<path d="M${f(MX + Math.cos(t) * 18)} ${f(MY + Math.sin(t) * 18)}L${f(MX + Math.cos(t) * 27)} ${f(MY + Math.sin(t) * 27)}" stroke="#5E564B" stroke-width="1.2"/>`); }
    s.push(`<circle cx="${f(MX)}" cy="${f(MY)}" r="20" fill="#C9A35A"/><circle cx="${f(MX - 5)}" cy="${f(MY - 6)}" r="10" fill="#E2C27A" opacity=".6"/><circle cx="${f(MX + 26)}" cy="${f(MY + 14)}" r="14" fill="url(#halo)"/><circle cx="${f(MX + 26)}" cy="${f(MY + 14)}" r="2.4" fill="#FFF0BC"/>`);
    let ailes = ""; for (let k = 0; k < 4; k++) { const t = k * PI / 2 + .5, ca = Math.cos(t), sa = Math.sin(t), px = -sa, py = ca, Lw = 64;
      ailes += `<path d="M${f(MX)} ${f(MY)}L${f(MX + ca * Lw)} ${f(MY + sa * Lw)}" stroke="#4A3020" stroke-width="3.5" stroke-linecap="round"/><path d="M${f(MX + ca * 16)} ${f(MY + sa * 16)}L${f(MX + ca * Lw)} ${f(MY + sa * Lw)}L${f(MX + ca * Lw + px * 13)} ${f(MY + sa * Lw + py * 13)}L${f(MX + ca * 16 + px * 13)} ${f(MY + sa * 16 + py * 13)}Z" fill="#E9DFC6" fill-opacity=".88" stroke="#6B4E36" stroke-width="1.5"/>`;
      for (let q = 1; q < 5; q++) { const d = 16 + q * 9.6; ailes += `<path d="M${f(MX + ca * d)} ${f(MY + sa * d)}l${f(px * 13)} ${f(py * 13)}" stroke="#8E7556" stroke-width="1"/>`; } }
    a.push(`<g>${ailes}<circle cx="${f(MX)}" cy="${f(MY)}" r="5" fill="#3A2A1E"/>${anime ? `<animateTransform attributeName="transform" type="rotate" from="0 ${f(MX)} ${f(MY)}" to="360 ${f(MX)} ${f(MY)}" dur="24s" repeatCount="indefinite"/>` : ""}</g>`);
    // maisons-champignons
    L.maisons.forEach(([x, y, R], j) => { s.push(`<circle cx="${f(x + 4)}" cy="${f(y + 6)}" r="${f(R + 4)}" fill="#020806" opacity=".5" filter="url(#flou)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 1.9)}" fill="url(#halo)" opacity=".7"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${["#C2412D", "#D9632B", "#B03A5B", "#C2412D"][j % 4]}" stroke="#5A1B12" stroke-width="2"/><circle cx="${f(x - R * .3)}" cy="${f(y - R * .35)}" r="${f(R * .45)}" fill="#fff" opacity=".12"/>`);
      for (let k = 0; k < 6; k++) { const t = k / 6 * TAU + j, d = R * (.35 + (k % 2) * .3); s.push(`<circle cx="${f(x + Math.cos(t) * d)}" cy="${f(y + Math.sin(t) * d)}" r="${f(R * .13)}" fill="#FFF4E0"/>`); }
      s.push(`<rect x="${f(x + R * .55)}" y="${f(y - 3)}" width="7" height="6" rx="1" fill="#FFD27A"/><circle cx="${f(x + R * .55 + 3.5)}" cy="${f(y)}" r="9" fill="url(#halo)"/><path d="M${f(x + R)} ${f(y + 2)}Q${f(x + R + 14)} ${f(y + 10)} ${f(x + R + 30)} ${f(y + 6)}" stroke="#8E7556" stroke-width="2.4" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/>`); });
    // clins d'œil : partie de jeu sur une souche (4 pions aux couleurs des joueurs, cartes, dé), coffre du Versus, petite porte lumineuse
    { const [x, y] = L.souche; s.push(`<circle cx="${x + 3}" cy="${y + 4}" r="20" fill="#020806" opacity=".5" filter="url(#flou)"/><circle cx="${x}" cy="${y}" r="19" fill="#8A6A48" stroke="#4E3A2A" stroke-width="2"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#6E5236" stroke-width="1"/><rect x="${x - 10}" y="${y - 9}" width="20" height="14" rx="1.5" fill="#2E5E8C" stroke="#E9DFC6" stroke-width=".8"/><path d="M${x - 10} ${y - 2}h20M${x} ${y - 9}v14" stroke="#E9DFC6" stroke-width=".5"/>`);
      ["#4C9AFF", "#2BB6A3", "#FF6FA8", "#F2994A"].forEach((c, k) => s.push(`<circle cx="${x - 6 + k * 4}" cy="${y - 4 + (k % 2) * 5}" r="1.9" fill="${c}" stroke="#111" stroke-width=".4"/>`));
      [[-26, 6, 20], [-24, 12, -10], [-29, 15, 35]].forEach(([dx, dy, t]) => s.push(`<rect x="${x + dx}" y="${y + dy}" width="7" height="10" rx="1" fill="#F4ECD8" stroke="#7A5C3E" stroke-width=".6" transform="rotate(${t} ${x + dx + 3.5} ${y + dy + 5})"/>`));
      s.push(`<rect x="${x + 14}" y="${y + 10}" width="6" height="6" rx="1.2" fill="#fff" stroke="#333" stroke-width=".5" transform="rotate(15 ${x + 17} ${y + 13})"/>`); }
    { const [x, y] = L.coffre; s.push(`<circle cx="${x}" cy="${y}" r="16" fill="url(#halo)" opacity=".8"/><rect x="${x - 8}" y="${y - 5}" width="16" height="10" rx="1.5" fill="#7A4A26" stroke="#3A2414" stroke-width="1"/><rect x="${x - 8}" y="${y - 8}" width="16" height="4" rx="1.5" fill="#94602F" stroke="#3A2414" stroke-width="1"/><path d="M${x - 8} ${y - 2}h16" stroke="#E2B93B" stroke-width="1.4"/>`);
      for (let k = 0; k < 7; k++) s.push(`<circle cx="${f(x - 6 + r() * 12)}" cy="${f(y - 9 + r() * 4)}" r="1.6" fill="#F7CF55" stroke="#9A6716" stroke-width=".4"/>`); }
    { const [x, y] = L.porte; s.push(`<rect x="${f(x - 3)}" y="${f(y - 5)}" width="6" height="8" rx="3" fill="#FFE27A"/><circle cx="${f(x)}" cy="${f(y - 1)}" r="10" fill="url(#halo)"/>`); }
    // lanternes envolées, lucioles (fixes + une partie qui clignote)
    for (let k = 0; k < 9; k++) { const x = cx + (r() - .5) * 420, y = cy + (r() - .5) * 240; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="20" fill="url(#halo)" opacity=".7"/><rect x="${f(x - 3.5)}" y="${f(y - 4.5)}" width="7" height="9" rx="2" fill="#FFB347" stroke="#FFE6A8" stroke-width=".8"/>`); }
    for (let k = 0; k < 260; k++) { const x = r() * W, y = r() * H, t = 2 + r() * 5, o = (.4 + r() * .6).toFixed(2);
      if (k % 4 === 0) a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(t)}" fill="url(#p2-luc)" opacity="${o}">${anime ? `<animate attributeName="opacity" values="${o};.05;${o}" dur="${(1.5 + r() * 3).toFixed(2)}s" begin="${(r() * 3).toFixed(2)}s" repeatCount="indefinite"/>` : ""}</circle>`);
      else s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(t)}" fill="url(#luc)" opacity="${o}"/>`); }
    for (let k = 0; k < 40; k++) { const t = r() * TAU, d = 20 + r() * 40; s.push(`<circle cx="${f(P[0][0] + Math.cos(t) * d)}" cy="${f(P[0][1] + Math.sin(t) * d)}" r="${f(2 + r() * 3)}" fill="url(#luc)"/>`); }
    s.push(`<rect width="${W}" height="${H}" fill="#0A1E4A" opacity=".22" style="mix-blend-mode:multiply"/><rect width="${W}" height="${H}" fill="url(#lune)"/><rect width="${W}" height="${H}" fill="url(#vign)"/></svg>`);
    const defsAnim = `<defs><radialGradient id="p2-luc" r="50%"><stop offset="0" stop-color="#F4FFB0"/><stop offset=".3" stop-color="#C8F25A" stop-opacity=".7"/><stop offset="1" stop-color="#9BE03A" stop-opacity="0"/></radialGradient><radialGradient id="p2-follet" r="50%"><stop offset="0" stop-color="#E8FBFF"/><stop offset=".35" stop-color="#5FD4FF" stop-opacity=".75"/><stop offset="1" stop-color="#2A7BFF" stop-opacity="0"/></radialGradient></defs>`;
    return { fond: s.join(""), anim: defsAnim + a.join(""), W, H, couleur: "#071613" };
  }
  /** le décor 3D de janvier, aux mêmes endroits que la carte */
  function decorForet(ctx) {
    const { T, A, sol, eau, lum } = ctx, L = planForet(T), m = p => [p[0] / KU, p[1] / KU], v = h => hex(h), occupe = [];
    const r = alea(55);
    // bassin + cascade
    const [bx, bz] = m(L.bassin); { const n = 20; for (let k = 0; k < n; k++) { const a0 = k / n * TAU, a1 = (k + 1) / n * TAU; eau.tri([bx, .3, bz], [bx + Math.cos(a1) * 44, .3, bz + Math.sin(a1) * 31], [bx + Math.cos(a0) * 44, .3, bz + Math.sin(a0) * 31], A.eau || v("#2F7FA8"), A.nuit ? .15 : .05, [0, 1, 0]); } }
    for (let k = 0; k < 11; k++) { const a = PI * (1.02 + k * .1), x = bx + Math.cos(a) * 50, z = bz + Math.sin(a) * 36; const g = new Geo(); g.boule(0, 2, 0, 5 + r() * 4, mel(v("#55605F"), v("#6E7A78"), r()), 0, .8); sol.poser(g, x, 0, z, r() * TAU, 1); }
    { const g = new Geo(); g.boite(0, 0, 0, 22, 12, 8, v("#4E5856")); g.ov().boite(0, 1, 4.05, 9, 11, .2, v("#CFF3FF"), .7); for (let k = 0; k < 5; k++) g.boule((r() - .5) * 8, .8, 6 + r() * 3, 1.6 + r() * 1.4, v("#F2FBFF"), .5, .6); sol.poser(g, bx, 0, bz - 40, 0, 1); lum.push([bx, 8, bz - 34, .7, .9, 1, 18]); }
    occupe.push([bx, bz, 60]);
    // rivière (ruban d'eau) + pont sur la piste
    const R = L.riv.map(m), pts = [];
    for (let k = 0; k < R.length - 1; k++) for (let t = 0; t < 1; t += .1) pts.push([R[k][0] + (R[k + 1][0] - R[k][0]) * t, R[k][1] + (R[k + 1][1] - R[k][1]) * t]);
    for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], q = pts[k + 1]; if (T.dist(p[0], p[1]) < DEMI + 10 || T.dist(q[0], q[1]) < DEMI + 10) continue;
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 8, nz = dx / l * 8;
      eau.quad([p[0] + nx, .3, p[1] + nz], [q[0] + nx, .3, q[1] + nz], [q[0] - nx, .3, q[1] - nz], [p[0] - nx, .3, p[1] - nz], A.eau || v("#2F7FA8"), A.nuit ? .15 : .05, [0, 1, 0]); if (k % 3 === 0) occupe.push([p[0], p[1], 20]); }
    { const [x, z] = m(L.B), [nx, nz, tx, tz] = L.nb, g = new Geo(), cap = Math.atan2(-tz, tx);
      for (let k = -9; k <= 9; k++) g.boite(k * 2, .12, 0, 1.8, .12, DEMI * 2 + 6, k % 2 ? v("#9A6B42") : v("#86593A"));
      [-1, 1].forEach(sd => { g.boite(0, .6, sd * (DEMI + 3), 38, .5, .5, v("#4A3020")); for (let k = -2; k <= 2; k++) g.boite(k * 9, .6, sd * (DEMI + 3), .5, 2.4, .5, v("#4A3020")); [-1, 1].forEach(e => { g.boite(e * 19, 0, sd * (DEMI + 3), .6, 4, .6, v("#3A2414")); g.boite(e * 19, 4, sd * (DEMI + 3), 1, 1.2, 1, v("#FFD58A"), 1); }); });
      ctx.pistePose(g, x, z, cap); [-1, 1].forEach(sd => [-1, 1].forEach(e => lum.push([x + tx * e * 19 + nx * sd * (DEMI + 3), 4.6, z + tz * e * 19 + nz * sd * (DEMI + 3), 1, .85, .55, 12]))); }
    // l'arbre géant creux : deux murs de tronc de part et d'autre de la piste, une voûte, une immense cime, des racines lumineuses
    { const [x, z] = m(L.TT), [nx, nz, tx, tz] = L.nrm(L.iT), g = new Geo(), cap = Math.atan2(-tz, tx), ecorce = v("#5A4230"), ecorce2 = v("#4A3626");
      [-1, 1].forEach(sd => { for (let k = -5; k <= 5; k++) g.boite(k * 3.6, 0, sd * (DEMI + 3.5), 3.8, 16 - Math.abs(k) * .6, 4 + Math.abs(k) * .4, k % 2 ? ecorce : ecorce2); });
      for (let k = -5; k <= 5; k++) { const P0 = [k * 3.6, 15, -(DEMI + 3.5)], P1 = [k * 3.6, 21, 0], P2 = [k * 3.6, 15, DEMI + 3.5]; branche(g, P0, P1, 2.2, 2.2, ecorce); branche(g, P1, P2, 2.2, 2.2, ecorce); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; branche(g, [Math.cos(a) * 8, 18, Math.sin(a) * 8], [Math.cos(a) * 26, 34 + r() * 8, Math.sin(a) * 26], 3, 1.2, ecorce2); }
      [[0, 44, 0, 26], [-16, 40, 10, 18], [16, 41, -8, 19], [6, 50, 14, 16], [-8, 48, -14, 17]].forEach(([a, b, c, rr]) => g.boule(a, b, c, rr, mel(v("#2E7A5C"), v("#4FA07A"), r()), A.nuit ? .12 : 0, .75));
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + .2, a1 = [Math.cos(a) * 12, .2, Math.sin(a) * 12], a2 = [Math.cos(a + .25) * (34 + r() * 14), .2, Math.sin(a + .25) * (34 + r() * 14)];
        if (Math.abs(Math.sin(a)) < .35) continue; branche(g, a1, a2, 1.6, .5, ecorce2); branche(g, [a1[0], .9, a1[2]], [a2[0], .7, a2[2]], .25, .1, v("#9BF5D0"), 1); }
      for (let k = 0; k < 30; k++) { const a = r() * TAU, d = r() * 28; g.boite(Math.cos(a) * d, 30 + r() * 26, Math.sin(a) * d, .5, .5, .5, v("#D8FF5A"), 1); }
      g.boule(11, 23, DEMI + 5, 1.6, v("#7A6450"), 0, 1.2); g.boule(10.4, 23.8, DEMI + 6.3, .35, v("#FFD84A"), 1); g.boule(11.6, 23.8, DEMI + 6.3, .35, v("#FFD84A"), 1);
      ctx.pistePose(g, x, z, cap); for (let k = -1; k <= 1; k++) lum.push([x + tx * k * 14, 12, z + tz * k * 14, .6, 1, .7, 16]); occupe.push([x, z, 70]); }
    // le vieux moulin, avec ses ailes qui tournent
    { const x = L.MX / KU, z = L.MY / KU, g = new Geo(); g.cylindre(0, 0, 0, 8, 12, 10, v("#7E7466")); g.cylindre(0, 12, 0, 7, 8, 10, v("#8A6A48"), 0, 6); g.cylindre(0, 20, 0, 7.6, 7, 10, v("#C9A35A"), 0, 0);
      g.ov().boite(0, 0, 8.02, 3, 5, .2, v("#3A2A1E")); g.ov().boite(0, 8, 8.02, 1.6, 1.6, .2, v("#FFD27A"), 1); g.ov().boite(5.6, 13, 5.6, 1.4, 1.4, .2, v("#FFD27A"), 1, PI / 4); g.boite(0, 17.5, 7.4, 1.4, 1.4, 2, v("#4A3020"));
      sol.poser(g, x, 0, z, 0, 1); lum.push([x, 6, z + 10, 1, .85, .55, 14]);
      const ailes = new Geo(); for (let k = 0; k < 4; k++) { const a = k * PI / 2, c = Math.cos(a), s2 = Math.sin(a); branche(ailes, [0, 0, 0], [c * 16, s2 * 16, 0], .3, .25, v("#4A3020"));
        const q = (d, o) => [c * d - s2 * o, s2 * d + c * o, .2]; ailes.quad(q(4, 0), q(16, 0), q(16, 3.4), q(4, 3.4), v("#E9DFC6"), 0, [0, 0, 1]); ailes.quad(q(4, 0), q(4, 3.4), q(16, 3.4), q(16, 0), v("#D8CCB0"), 0, [0, 0, -1]); }
      ctx.rotors.push({ g: ailes, x, y: 17.5, z: z + 8.4, cap: 0, v: .5 }); occupe.push([x, z, 30]);
      // clins d'œil : souche avec une partie en cours (4 pions aux couleurs des joueurs), coffre du Versus
      const [sx, sz] = m(L.souche), st = new Geo(); st.cylindre(0, 0, 0, 2.2, 1, 9, v("#8A6A48")); st.boite(0, 1, 0, 2.4, .08, 1.7, v("#2E5E8C")); ["#4C9AFF", "#2BB6A3", "#FF6FA8", "#F2994A"].forEach((c, k) => { st.cylindre(-.8 + k * .5, 1.08, (k % 2) * .5 - .25, .16, .45, 6, v(c), .2, .06); st.boule(-.8 + k * .5, 1.6, (k % 2) * .5 - .25, .14, v(c), .2); });
      st.boite(1.7, 1, .9, .7, .04, .5, v("#F4ECD8"), 0, .4); st.boite(2.1, 1, 1.3, .7, .04, .5, v("#F4ECD8"), 0, -.3); st.boite(-1.6, 1, -1, .45, .45, .45, v("#FFFFFF"), 0, .3); sol.poser(st, sx, 0, sz, 0, 1.6); occupe.push([sx, sz, 8]);
      const [kx, kz] = m(L.coffre), ch = new Geo(); ch.boite(0, 0, 0, 2.4, 1.4, 1.5, v("#7A4A26")); ch.boite(0, 1.4, -.5, 2.4, 1.3, .3, v("#94602F"), 0, 0); for (let k = 0; k < 9; k++) ch.boule((r() - .5) * 1.8, 1.4 + r() * .3, (r() - .5) * 1, .22, v("#F7CF55"), .6);
      sol.poser(ch, kx, 0, kz, .5, 1.5); lum.push([kx, 2.5, kz, 1, .85, .4, 6]); occupe.push([kx, kz, 6]); }
    // maisons-champignons aux fenêtres allumées
    L.maisons.forEach(([px, pz, Rr], j) => { const x = px / KU, z = pz / KU, k = Rr / 14, g = new Geo(), cap = v(["#C2412D", "#D9632B", "#B03A5B", "#C2412D"][j % 4]);
      g.cylindre(0, 0, 0, 4 * k, 6 * k, 9, v("#EFE4CC"), 0, 3.4 * k); g.boule(0, 6 * k, 0, 8.5 * k, cap, A.nuit ? .12 : 0, .55);
      for (let q = 0; q < 6; q++) { const a = q / 6 * TAU + j; g.ov().boule(Math.cos(a) * 5 * k, 6 * k + 3.2 * k, Math.sin(a) * 5 * k, .9 * k, v("#FFF4E0"), .3, .5); }
      g.ov().boite(0, 0, 3.9 * k, 1.6 * k, 2.6 * k, .2, v("#5A3A22")); g.ov().boite(2.4 * k, 2.6 * k, 3.4 * k, 1.1 * k, 1.1 * k, .2, v("#FFD27A"), 1, .5); g.ov().boite(-2.4 * k, 2.6 * k, 3.4 * k, 1.1 * k, 1.1 * k, .2, v("#FFD27A"), 1, -.5);
      sol.poser(g, x, 0, z, r() * TAU, 1); lum.push([x, 4, z, 1, .8, .5, 10]); occupe.push([x, z, 14]); });
    // la clairière reste dégagée : herbes fleuries et lanternes qui flottent
    { const cx = L.cx / KU, cz = L.cy / KU; for (let k = 0; k < 60; k++) { const x = cx + (r() - .5) * 460, z = cz + (r() - .5) * 280; if (!L.inside(x * KU, z * KU) || T.dist(x, z) < 18 || occupe.some(o => Math.hypot(x - o[0], z - o[1]) < o[2])) continue; sol.poser(objet("fleurs", r, A), x, 0, z, r() * TAU, 1); }
      for (let k = 0; k < 10; k++) { const x = cx + (r() - .5) * 320, z = cz + (r() - .5) * 180, g = new Geo(); g.boite(0, 10 + r() * 16, 0, 1, 1.3, 1, v("#FFB347"), 1); sol.poser(g, x, 0, z, 0, 1); }
      for (let a = 0; a < TAU; a += .5) for (const kk of [.25, .5, .75]) occupe.push([cx + Math.cos(a) * 230 * kk, cz + Math.sin(a) * 140 * kk, 70 * kk + 20]); }
    // lanternes au bord du chemin, en alternance
    for (let i = 0; i < T.N; i += Math.round(26 / T.ds)) { const sd = Math.floor(i / Math.round(26 / T.ds)) % 2 ? 1 : -1, nx = -T.TZ[i], nz = T.TX[i], x = T.X[i] + nx * sd * (DEMI + 5), z = T.Z[i] + nz * sd * (DEMI + 5);
      if (Math.hypot(x - L.TT[0] / KU, z - L.TT[1] / KU) < 40 || Math.hypot(x - L.B[0] / KU, z - L.B[1] / KU) < 25) continue;
      sol.poser(objet("lanterne", r, A), x, 0, z, 0, 1); lum.push([x, 4.8, z, 1, .85, .55, 10]); }
    return occupe;
  }
  function peindreGarage(T) {
      const P = [], N = T.N, W = 1080, H = 720, anime = ANIM(), r = alea(11), a = [];
      for (let i = 0; i < N; i++) P.push([T.X[i] * KU, T.Z[i] * KU]);
  const f = v => (+v).toFixed(1), piste = "M" + P.map(p => f(p[0]) + " " + f(p[1])).join("L") + "Z";
  const dT = (x, y) => { let m = 1e9; for (let i = 0; i < N; i += 2) m = Math.min(m, Math.hypot(P[i][0] - x, P[i][1] - y)); return m; };
  const nrm = i => { const a = P[(i - 2 + N) % N], b = P[(i + 2) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l, dx / l, dy / l]; };
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>
  <pattern id="dalle" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#5B6068"/><path d="M60 0H0V60" fill="none" stroke="#4A4E55" stroke-width="1.5"/><circle cx="18" cy="40" r="1" fill="#6A7078"/></pattern>
  <pattern id="hach" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#F2C230"/><rect width="7" height="14" fill="#1A1B1F"/></pattern>
  <pattern id="tole" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#8E969F"/><rect width="4" height="8" fill="#7D858E"/></pattern>
  <radialGradient id="sodium" r="50%"><stop offset="0" stop-color="#FFD58A" stop-opacity=".55"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
  <radialGradient id="neon" r="50%"><stop offset="0" stop-color="#9FE8FF" stop-opacity=".6"/><stop offset="1" stop-color="#4FC3F7" stop-opacity="0"/></radialGradient>
  <radialGradient id="huile" r="50%"><stop offset="0" stop-color="#15171B" stop-opacity=".75"/><stop offset=".7" stop-color="#2A2D33" stop-opacity=".4"/><stop offset="1" stop-color="#2A2D33" stop-opacity="0"/></radialGradient>
  <radialGradient id="etin" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFE27A"/><stop offset="1" stop-color="#FF8A2B" stop-opacity="0"/></radialGradient>
  <radialGradient id="vign" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <linearGradient id="carro" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <filter id="flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter><filter id="flou8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .3  0 0 0 0 .32  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs><rect width="${W}" height="${H}" fill="url(#dalle)"/>`);
  // taches d'huile et traces de pneus
  for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * H; if (dT(x, y) < 25) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(8 + r() * 22)}" ry="${f(5 + r() * 14)}" fill="url(#huile)" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`); }
  for (let k = 0; k < 6; k++) { const x = 250 + r() * 500, y = 220 + r() * 300; if (x > 540 && x < 720 && y < 400) continue; s.push(`<path d="M${f(x)} ${f(y)}c40 -30 90 -10 120 30" fill="none" stroke="#2F3237" stroke-width="5" stroke-dasharray="2 3" opacity=".5"/><path d="M${f(x + 8)} ${f(y + 8)}c40 -30 90 -10 120 30" fill="none" stroke="#2F3237" stroke-width="5" stroke-dasharray="2 3" opacity=".5"/>`); }
  // marquages au sol : grand cercle d'emblème au centre, places de parking
  s.push(`<g opacity=".9"><circle cx="420" cy="380" r="95" fill="none" stroke="#F2C230" stroke-width="5" stroke-dasharray="18 10"/><circle cx="420" cy="380" r="70" fill="none" stroke="#F2C230" stroke-width="2"/>
  <g transform="translate(420 380) rotate(-35)" fill="#F2C230" opacity=".85"><rect x="-55" y="-7" width="85" height="14" rx="4"/><path d="M30 -20a24 24 0 1 1 0 40l0 -12a12 12 0 1 0 0 -16z"/></g>
  <text x="420" y="505" text-anchor="middle" font-family="Helvetica, Arial" font-weight="900" font-size="20" letter-spacing="6" fill="#F2C230" opacity=".8">GARAGE DES RÊVES</text></g>`);
  for (let k = 0; k < 6; k++) { const x = 560 + k * 52; s.push(`<path d="M${x} 420v80" stroke="#E9ECEF" stroke-width="3" opacity=".6"/>`); }
  // piste : béton lissé, bord hachuré jaune et noir aux virages
  s.push(`<path d="${piste}" fill="none" stroke="#1A1C20" stroke-width="40" stroke-linejoin="round" opacity=".55" filter="url(#flou)"/>
  <path d="${piste}" fill="none" stroke="url(#hach)" stroke-width="34" stroke-linejoin="round"/><path d="${piste}" fill="none" stroke="#3B3F46" stroke-width="27" stroke-linejoin="round"/>
  <path d="${piste}" fill="none" stroke="#454A52" stroke-width="20" stroke-linejoin="round"/><path d="${piste}" fill="none" stroke="#E9ECEF" stroke-width="1.6" stroke-dasharray="14 12" stroke-linejoin="round" opacity=".7"/>`);
  // ligne de départ
  { const p = P[0], [nx, ny, tx, ty] = nrm(0); let d = ""; for (let a = -3; a < 3; a++) for (let b = 0; b < 2; b++) { const ox = nx * a * 4.5 + tx * b * 4.5, oy = ny * a * 4.5 + ty * b * 4.5; d += `<path d="M${f(p[0] + ox)} ${f(p[1] + oy)}l${f(nx * 4.5)} ${f(ny * 4.5)}l${f(tx * 4.5)} ${f(ty * 4.5)}l${f(-nx * 4.5)} ${f(-ny * 4.5)}z" fill="${(a + b) % 2 ? "#111" : "#EEE"}"/>`; } s.push(d); }
  // murs de pneus aux virages
  const pneus = (x, y, n, ang) => { let o = ""; for (let k = 0; k < n; k++) { const px = x + Math.cos(ang) * k * 11, py = y + Math.sin(ang) * k * 11; o += `<circle cx="${f(px + 2)}" cy="${f(py + 3)}" r="6" fill="#000" opacity=".4"/><circle cx="${f(px)}" cy="${f(py)}" r="5.5" fill="#1B1D21" stroke="${k % 3 === 0 ? "#E9ECEF" : k % 3 === 1 ? "#D62D2D" : "#2B2E33"}" stroke-width="2.2"/><circle cx="${f(px)}" cy="${f(py)}" r="2" fill="#2B2E33"/>`; } return o; };
  s.push(pneus(990, 640, 6, -2.4) + pneus(995, 100, 6, 2.3) + pneus(88, 95, 6, .7) + pneus(85, 640, 6, -.7) + pneus(735, 400, 4, 2.4) + pneus(525, 400, 4, .7));
  // conteneurs empilés (dans l'encoche et en haut)
  const cont = (x, y, w, h, c, a) => `<g transform="rotate(${a || 0} ${x + w / 2} ${y + h / 2})"><rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" fill="#000" opacity=".35"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>${Array.from({ length: Math.floor(w / 6) }, (_, k) => `<path d="M${x + 3 + k * 6} ${y + 2}v${h - 4}" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`).join("")}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#carro)" opacity=".5"/></g>`;
  s.push(cont(590, 150, 90, 34, "#D9472B") + cont(588, 192, 90, 34, "#2F6FD0") + cont(594, 240, 86, 34, "#F2B33A", 3) + cont(592, 290, 88, 34, "#2BB673") + cont(300, 20, 110, 36, "#8C96A3") + cont(420, 18, 110, 36, "#D9472B", -2) + cont(760, 22, 100, 36, "#2F6FD0"));
  // station-service rétro (en bas à droite)
  s.push(`<g><rect x="790" y="655" width="150" height="48" rx="3" fill="#000" opacity=".35"/><rect x="784" y="648" width="150" height="48" rx="3" fill="#C8283A" stroke="#7A1420" stroke-width="2"/><rect x="784" y="648" width="150" height="10" fill="#F4F1EA"/>
  <text x="859" y="682" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="15" fill="#F4F1EA">Station du Rêve</text>
  <circle cx="800" cy="668" r="5" fill="#F7CF55"/><circle cx="918" cy="668" r="5" fill="#F7CF55"/><circle cx="859" cy="672" r="60" fill="url(#sodium)"/></g>`);
  // le pont roulant jaune au-dessus de la ligne droite du bas
  s.push(`<g><rect x="372" y="566" width="10" height="100" fill="#000" opacity=".35"/><rect x="452" y="566" width="10" height="100" fill="#000" opacity=".35"/>
  <rect x="366" y="560" width="12" height="104" fill="#F2C230" stroke="#9A6716" stroke-width="2"/><rect x="446" y="560" width="12" height="104" fill="#F2C230" stroke="#9A6716" stroke-width="2"/>
  <rect x="366" y="596" width="92" height="16" fill="url(#hach)" stroke="#1A1B1F" stroke-width="2"/><rect x="398" y="590" width="26" height="28" rx="3" fill="#3A3E45" stroke="#F2C230" stroke-width="2"/></g>`); a.push(`<g><path d="M411 618v14" stroke="#9AA3AE" stroke-width="2"/><path d="M405 632h12l-6 8z" fill="#9AA3AE"/>${anime ? '<animateTransform attributeName="transform" type="rotate" values="-6 411 618;6 411 618;-6 411 618" dur="3s" repeatCount="indefinite"/>' : ""}</g>`);
  // le hangar-atelier : la piste le traverse (côté gauche) ; toit découpé pour voir dedans
  { const x0 = 40, y0 = 240, w = 250, h = 230; s.push(`<rect x="${x0 + 8}" y="${y0 + 10}" width="${w}" height="${h}" fill="#000" opacity=".45" filter="url(#flou8)"/>
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#2E3238" stroke="#1B1D21" stroke-width="4"/>`);
    // sol intérieur, établis, voitures en construction, outils
    s.push(`<rect x="${x0 + 6}" y="${y0 + 6}" width="${w - 12}" height="${h - 12}" fill="#3C4148"/>`);
    for (let k = 0; k < 4; k++) s.push(`<rect x="${x0 + 8}" y="${y0 + 18 + k * 52}" width="26" height="40" fill="#C8283A" stroke="#7A1420"/><path d="M${x0 + 10} ${y0 + 28 + k * 52}h22M${x0 + 10} ${y0 + 38 + k * 52}h22M${x0 + 10} ${y0 + 48 + k * 52}h22" stroke="#5A0E16" stroke-width="1.5"/>`);
    const auto = (x, y, c, a, ouverte) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-26" y="-11" width="52" height="22" rx="3" fill="#000" opacity=".35" transform="translate(3 4)"/>
  <path d="M-25 -6h10l6 -4h18l6 4h10v12h-10l-6 4h-18l-6 -4h-10z" fill="${c}" stroke="#111" stroke-width="1"/><rect x="-30" y="-12" width="6" height="24" rx="1" fill="${c}"/><rect x="24" y="-10" width="5" height="20" rx="1" fill="${c}"/>
  ${[[-16, -13], [-16, 9], [14, -13], [14, 9]].map(([u, v]) => `<rect x="${u}" y="${v}" width="9" height="5" rx="1.5" fill="#15171B"/>`).join("")}${ouverte ? `<rect x="-14" y="-5" width="16" height="10" fill="#7D858E"/><circle cx="-6" cy="0" r="3" fill="#C9D2DD"/>` : `<ellipse cx="2" cy="0" rx="5" ry="3.5" fill="#15171B"/>`}<rect x="-25" y="-6" width="50" height="12" fill="url(#carro)"/></g>`;
    s.push(auto(205, y0 + 60, "#4C9AFF", 90, true) + auto(205, y0 + 165, "#FF6FA8", 90, false) + `<rect x="182" y="${y0 + 30}" width="46" height="62" fill="none" stroke="#F2C230" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    for (let k = 0; k < 4; k++) s.push(`<rect x="${194 + (k % 2) * 22}" y="${y0 + 32 + Math.floor(k / 2) * 55}" width="5" height="5" fill="#F2C230"/>`);
    // étincelles de soudure
    let et = ""; for (let k = 0; k < 14; k++) { const t = r() * 6.28, d = 6 + r() * 16; et += `<path d="M228 ${y0 + 118}l${f(Math.cos(t) * d)} ${f(Math.sin(t) * d)}" stroke="#FFD27A" stroke-width="1.2"/>`; }
    a.push(`<g opacity=".9">${et}<circle cx="228" cy="${y0 + 118}" r="16" fill="url(#p2-etin)"/>${anime ? '<animate attributeName="opacity" values="1;.1;.9;.2;1;0;0;0" dur="1.6s" repeatCount="indefinite"/>' : ""}</g>`);
    // piste à travers le hangar (repeinte par-dessus : dalle intérieure)
    s.push(`<path d="${"M" + P.filter(p => p[1] > y0 - 5 && p[1] < y0 + h + 5 && p[0] < 200).map(p => f(p[0]) + " " + f(p[1])).join("L")}" fill="none" stroke="#4A4F57" stroke-width="27"/><path d="${"M" + P.filter(p => p[1] > y0 - 5 && p[1] < y0 + h + 5 && p[0] < 200).map(p => f(p[0]) + " " + f(p[1])).join("L")}" fill="none" stroke="#F2C230" stroke-width="1.6" stroke-dasharray="14 12"/>`);
    // poutres de toit + verrière découpée
    for (let k = 0; k <= 5; k++) s.push(`<path d="M${x0} ${y0 + k * h / 5}h${w}" stroke="#8E969F" stroke-width="3" opacity=".55"/>`);
    for (let k = 0; k < 6; k++) { s.push(`<rect x="${x0 + 46 + k * 30}" y="${y0 + 8}" width="20" height="5" rx="2" fill="#E8F6FF"/>`); a.push(`<ellipse cx="${x0 + 56 + k * 30}" cy="${y0 + 40}" rx="24" ry="34" fill="url(#p2-neon)" opacity=".35">${anime && k === 3 ? '<animate attributeName="opacity" values=".35;.05;.35;.35;.1;.35" dur="3.2s" repeatCount="indefinite"/>' : ""}</ellipse>`); }
    s.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="#9AA3AE" stroke-width="5"/><rect x="${x0 + 70}" y="${y0 - 16}" width="110" height="16" fill="url(#tole)" stroke="#5A6068"/>
  <text x="${x0 + 125}" y="${y0 - 4}" text-anchor="middle" font-family="Helvetica, Arial" font-weight="900" font-size="11" letter-spacing="2" fill="#1A1B1F">ATELIER 01</text>`);
    [[118, y0], [118, y0 + h]].forEach(([x, y]) => s.push(`<rect x="${x - 18}" y="${y - 4}" width="36" height="8" fill="url(#hach)"/>`)); }
  // le bureau du chef d'équipe (toit découpé) : clins d'œil
  { const x0 = 760, y0 = 405, w = 150, h = 120; s.push(`<rect x="${x0 + 6}" y="${y0 + 8}" width="${w}" height="${h}" fill="#000" opacity=".4" filter="url(#flou)"/><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#6B5A48" stroke="#2E2620" stroke-width="4"/><rect x="${x0 + 5}" y="${y0 + 5}" width="${w - 10}" height="${h - 10}" fill="#8A7458"/>`);
    for (let k = 0; k < 8; k++) s.push(`<path d="M${x0 + 5} ${y0 + 5 + k * 14}h${w - 10}" stroke="#7A6450" stroke-width="1"/>`);
    // tableau en liège : relevés boursiers + photo des 4
    s.push(`<rect x="${x0 + 10}" y="${y0 + 10}" width="58" height="36" fill="#C49A63" stroke="#5A3A22" stroke-width="2"/><polyline points="${x0 + 14},${y0 + 38} ${x0 + 22},${y0 + 30} ${x0 + 30},${y0 + 33} ${x0 + 40},${y0 + 20} ${x0 + 48},${y0 + 24}" fill="none" stroke="#2BB673" stroke-width="1.6"/><rect x="${x0 + 13}" y="${y0 + 14}" width="16" height="11" fill="#F4F1EA" transform="rotate(-6 ${x0 + 21} ${y0 + 19})"/>
  <rect x="${x0 + 50}" y="${y0 + 13}" width="15" height="12" fill="#F4F1EA"/>${["#4C9AFF", "#2BB6A3", "#FF6FA8", "#F2994A"].map((c, k) => `<circle cx="${x0 + 52.5 + k * 3.3}" cy="${y0 + 19}" r="1.4" fill="${c}"/>`).join("")}<circle cx="${x0 + 57}" cy="${y0 + 13}" r="1.5" fill="#D62D2D"/>`);
    // tableau blanc : plan de stratégie
    s.push(`<rect x="${x0 + 78}" y="${y0 + 10}" width="62" height="34" fill="#F4F6F8" stroke="#9AA3AE" stroke-width="2"/><path d="M${x0 + 84} ${y0 + 36}q12 -18 26 -6t24 -12" fill="none" stroke="#2F6FD0" stroke-width="1.4"/><path d="M${x0 + 128} ${y0 + 16}l6 2-4 4" fill="none" stroke="#D62D2D" stroke-width="1.4"/><circle cx="${x0 + 92}" cy="${y0 + 20}" r="3" fill="none" stroke="#D62D2D" stroke-width="1.2"/><path d="M${x0 + 102} ${y0 + 16}l4 4M${x0 + 106} ${y0 + 16}l-4 4" stroke="#111" stroke-width="1.2"/>`);
    // table de cartes en pause
    s.push(`<circle cx="${x0 + 45}" cy="${y0 + 82}" r="20" fill="#2E6B4A" stroke="#4A3626" stroke-width="3"/>${[[-8, -6, 20], [4, -9, -15], [10, 4, 40], [-6, 6, -30]].map(([u, v, a]) => `<rect x="${x0 + 45 + u - 3}" y="${y0 + 82 + v - 4.5}" width="6" height="9" rx="1" fill="#F4ECD8" transform="rotate(${a} ${x0 + 45 + u} ${y0 + 82 + v})"/>`).join("")}<rect x="${x0 + 40}" y="${y0 + 75}" width="8" height="12" rx="1" fill="#2F6FD0" stroke="#F4ECD8" stroke-width=".6"/><circle cx="${x0 + 52}" cy="${y0 + 90}" r="2" fill="#F7CF55"/><circle cx="${x0 + 55}" cy="${y0 + 88}" r="2" fill="#F7CF55"/>
  ${[[-24, 0], [24, 0], [0, -24], [0, 24]].map(([u, v]) => `<circle cx="${x0 + 45 + u}" cy="${y0 + 82 + v}" r="5" fill="#3A2A1E"/>`).join("")}`);
    // vitrine avec le trophée vide (socle sans coupe)
    s.push(`<rect x="${x0 + 92}" y="${y0 + 60}" width="44" height="44" rx="3" fill="#BFE4F2" fill-opacity=".35" stroke="#E8F6FF" stroke-width="1.6"/><rect x="${x0 + 106}" y="${y0 + 82}" width="16" height="10" rx="1" fill="#1A1B1F"/><rect x="${x0 + 109}" y="${y0 + 84}" width="10" height="3" fill="#F7CF55"/><circle cx="${x0 + 114}" cy="${y0 + 74}" r="7" fill="none" stroke="#F7CF55" stroke-width="1" stroke-dasharray="2 2" opacity=".8"/><circle cx="${x0 + 114}" cy="${y0 + 80}" r="22" fill="url(#sodium)" opacity=".6"/>`);
    s.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="#2E2620" stroke-width="4"/><rect x="${x0 + 54}" y="${y0 + h - 3}" width="26" height="6" fill="#C9A35A"/>`); }
  // caisses à outils roulantes, piles de roues, pièces au sol dans la cour
  [[300, 260], [530, 520], [690, 530], [320, 520]].forEach(([x, y]) => s.push(`<rect x="${x + 3}" y="${y + 4}" width="22" height="14" fill="#000" opacity=".35"/><rect x="${x}" y="${y}" width="22" height="14" rx="2" fill="#C8283A" stroke="#5A0E16"/><path d="M${x + 2} ${y + 5}h18M${x + 2} ${y + 9}h18" stroke="#5A0E16"/>`));
  [[270, 330], [640, 470], [520, 250], [250, 545]].forEach(([x, y]) => { for (let k = 0; k < 3; k++) s.push(`<circle cx="${x + k * 3}" cy="${y - k * 3}" r="8" fill="#1B1D21" stroke="#2B2E33" stroke-width="2"/><circle cx="${x + k * 3}" cy="${y - k * 3}" r="4" fill="#9AA3AE"/>`); });
  // voitures en construction sur chandelles dans la cour
  const auto2 = (x, y, c, a) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-27" y="-12" width="54" height="24" fill="#000" opacity=".35" transform="translate(3 4)"/><path d="M-25 -6h10l6 -4h18l6 4h10v12h-10l-6 4h-18l-6 -4h-10z" fill="${c}" stroke="#111"/><rect x="-14" y="-5" width="16" height="10" fill="#7D858E"/><circle cx="-6" cy="0" r="3" fill="#C9D2DD"/><rect x="-25" y="-6" width="50" height="12" fill="url(#carro)"/>${[[-18, -14], [-18, 10], [14, -14], [14, 10]].map(([u, v]) => `<rect x="${u}" y="${v}" width="4" height="4" fill="#F2C230"/>`).join("")}</g>`;
  s.push(auto2(560, 470, "#2BB673", 0) + auto2(300, 420, "#F2994A", 20));
  // projecteurs aux coins (pools de lumière sodium)
  [[60, 60], [1020, 60], [1020, 690], [60, 690], [500, 140], [860, 330]].forEach(([x, y]) => s.push(`<circle cx="${x}" cy="${y}" r="150" fill="url(#sodium)" opacity=".55"/><circle cx="${x}" cy="${y}" r="5" fill="#2B2E33" stroke="#9AA3AE" stroke-width="2"/><rect x="${x - 6}" y="${y - 3}" width="12" height="6" fill="#FFF1C2"/>`));
  s.push(`<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".35"/><rect width="${W}" height="${H}" fill="#10183A" opacity=".18" style="mix-blend-mode:multiply"/><rect width="${W}" height="${H}" fill="url(#vign)"/>
  </svg>`);
      const defsAnim = '<defs><radialGradient id="p2-etin" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFE27A"/><stop offset="1" stop-color="#FF8A2B" stop-opacity="0"/></radialGradient><radialGradient id="p2-neon" r="50%"><stop offset="0" stop-color="#9FE8FF" stop-opacity=".6"/><stop offset="1" stop-color="#4FC3F7" stop-opacity="0"/></radialGradient></defs>';
      return { fond: s.join(""), anim: defsAnim + a.join(""), W, H, couleur: "#3A3E45" };
    }
  
  /** le décor 3D du Garage des rêves, aux mêmes endroits que la carte (positions de la carte en u, divisées par KU) */
  function decorGarage(ctx) {
    const { T, A, sol, lum } = ctx, v = h => hex(h), m = x => x / KU, r = alea(77), occupe = [], jaune = v("#F2C230"), noir = v("#1A1B1F");
    const boite = (g, x, y, z, w, h, d, c, em, cap) => g.boite(x, y, z, w, h, d, c, em, cap);
    // l'atelier 01 : la piste le traverse (ouvertures nord et sud), établis, voitures sur pont, néons, étincelles
    { const x0 = m(40), z0 = m(240), w = m(250), d = m(230), g = new Geo(), mur = v("#8E969F"), mur2 = v("#7D858E"), H = 14, px = m(118) - x0, ouv = 14;
      // murs (ouest, est, nord et sud avec une ouverture pour la piste)
      boite(g, .6, 0, d / 2, 1.2, H, d, mur); boite(g, w - .6, 0, d / 2, 1.2, H, d, mur);
      [0, d].forEach(z => { boite(g, (px - ouv) / 2, 0, z, px - ouv, H, 1.2, mur2); boite(g, (px + ouv + w) / 2, 0, z, w - px - ouv, H, 1.2, mur2); boite(g, px, H - 4, z, ouv * 2, 4, 1.2, mur2);
        [-1, 1].forEach(sd => boite(g, px + sd * (ouv - .6), 0, z, 1.2, H - 4, 1.4, jaune)); });
      g.ov().boite(w / 2 + 10, H - 3, -.7, 40, 2.4, .2, jaune, .3);
      // toit en poutres (on voit dedans) et rampes de néons
      for (let k = 0; k <= 6; k++) boite(g, w / 2, H, k * d / 6, w, 1, 1, v("#5A6068"));
      for (let k = 0; k < 5; k++) { boite(g, 40 + k * 30, H - 1.2, d / 2, 1, .4, d * .8, v("#E8F6FF"), 1); lum.push([x0 + 40 + k * 30, H - 2, z0 + d / 2, .7, .9, 1, 26]); }
      // servantes rouges le long du mur ouest
      for (let k = 0; k < 4; k++) { boite(g, 4, 0, 18 + k * 42, 5, 3.2, 12, v("#C8283A")); g.ov().boite(6.55, 1.6, 18 + k * 42, .1, .3, 11, v("#5A0E16")); }
      // deux voitures en construction sur un pont élévateur (la bleue capot ouvert), soudure
      const pont = new Geo(); boite(pont, 0, 0, 0, 12, .5, 4, v("#3A3E45")); [-1, 1].forEach(sd => boite(pont, 0, .5, sd * 1.6, 11, 1.4, .5, jaune)); 
      [[m(205) - x0, m(300) - z0, "#4C9AFF"], [m(205) - x0, m(405) - z0, "#FF6FA8"]].forEach(([x, z, c]) => { g.poser(pont, x, 0, z, PI / 2, 1); g.poser(voiture({ couleur: c }), x, 1.9, z, PI / 2, 1); });
      for (let k = 0; k < 14; k++) { const t = r() * TAU; branche(g, [m(228) - x0, 1.2, m(358) - z0], [m(228) - x0 + Math.cos(t) * 2.5, 1.2 + r() * 2.5, m(358) - z0 + Math.sin(t) * 2.5], .05, .02, v("#FFD27A"), 1); }
      lum.push([m(228), 1.6, m(358), 1, .75, .3, 10]);
      sol.poser(g, x0, 0, z0, 0, 1); occupe.push([x0 + w / 2, z0 + d / 2, Math.max(w, d) * .6]); }
    // le pont roulant jaune qui enjambe la ligne droite du bas
    { const g = new Geo(), x1 = m(372), x2 = m(452), z1 = m(566), z2 = m(660), hh = 12;
      [x1, x2].forEach(x => { boite(g, x, 0, z1, 1.4, hh, 1.4, jaune); boite(g, x, 0, z2, 1.4, hh, 1.4, jaune); boite(g, x, hh, (z1 + z2) / 2, 1.6, 1.4, z2 - z1 + 2, jaune); });
      for (let k = 0; k < 8; k++) boite(g, x1 + (x2 - x1) * (k + .5) / 8, hh + .2, m(604), (x2 - x1) / 8, 1.6, 2.2, k % 2 ? jaune : noir);
      boite(g, m(411), hh - 2.4, m(604), 3, 2.4, 3, v("#3A3E45")); boite(g, m(411), 5.2, m(604), .15, hh - 7.6, .15, v("#9AA3AE")); g.cylindre(m(411), 4.4, m(604), .6, .8, 6, v("#9AA3AE"), 0, .1);
      sol.poser(g, 0, 0, 0, 0, 1); }
    // murs de pneus aux virages
    const pneus = (x, y, n, ang) => { const g = new Geo(); for (let k = 0; k < n; k++) for (let e = 0; e < 3; e++) g.cylindre(m(x) + Math.cos(ang) * k * 1.8, e * .55, m(y) + Math.sin(ang) * k * 1.8, .85, .5, 8, e % 2 ? v(k % 3 === 0 ? "#E9ECEF" : k % 3 === 1 ? "#D62D2D" : "#2B2E33") : v("#1B1D21")); sol.poser(g, 0, 0, 0, 0, 1); };
    pneus(990, 640, 6, -2.4); pneus(995, 100, 6, 2.3); pneus(88, 95, 6, .7); pneus(85, 640, 6, -.7); pneus(735, 400, 4, 2.4); pneus(525, 400, 4, .7);
    // conteneurs empilés
    [[590, 150, 90, 34, "#D9472B", 0], [588, 192, 90, 34, "#2F6FD0", 0], [594, 240, 86, 34, "#F2B33A", 1], [592, 290, 88, 34, "#2BB673", 0], [300, 20, 110, 36, "#8C96A3", 0], [420, 18, 110, 36, "#D9472B", 1], [760, 22, 100, 36, "#2F6FD0", 0]].forEach(([x, y, w, h, c, etage], k) => {
      const g = new Geo(); for (let e = 0; e <= etage; e++) { boite(g, 0, e * 5.2, 0, m(w), 5.2, m(h) * .9, mel(v(c), [0, 0, 0], e * .15)); for (let q = 0; q < 8; q++) g.ov().boite(-m(w) / 2 + (q + .5) * m(w) / 8, e * 5.2 + .4, m(h) * .45 + .02, .25, 4.4, .1, mel(v(c), [0, 0, 0], .25)); }
      sol.poser(g, m(x + w / 2), 0, m(y + h / 2), 0, 1); occupe.push([m(x + w / 2), m(y + h / 2), m(w) * .6]); });
    // station-service rétro
    { const g = new Geo(), cx = m(859), cz = m(672); [[-24, -6], [24, -6], [-24, 6], [24, 6]].forEach(([a, b]) => boite(g, a, 0, b, .8, 5, .8, v("#E9ECEF"))); boite(g, 0, 5, 0, 60, 1.4, 18, v("#C8283A")); g.ov().boite(0, 5.2, 9.02, 58, .6, .1, v("#F4F1EA"), .6);
      [-10, 10].forEach(a => { boite(g, a, 0, 0, 2, 3, 1.4, v("#C8283A")); g.ov().boite(a, 2, .72, 1.2, .8, .1, v("#FFE6A8"), 1); });
      g.ov().boite(0, 4.4, 0, 50, .1, 14, v("#FFE6A8"), .5); sol.poser(g, cx, 0, cz, 0, 1); lum.push([cx, 4, cz, 1, .85, .55, 30]); occupe.push([cx, cz, 34]); }
    // le bureau du chef d'équipe : tableau en liège (photo des 4), tableau blanc, table de cartes, vitrine au trophée vide
    { const x0 = m(760), z0 = m(405), w = m(150), d = m(120), g = new Geo(), bois = v("#6B5A48"), Hm = 4;
      boite(g, .4, 0, d / 2, .8, Hm, d, bois); boite(g, w - .4, 0, d / 2, .8, Hm, d, bois); boite(g, w / 2, 0, .4, w, Hm, .8, bois); boite(g, (w - 26) / 4, 0, d - .4, (w - 26) / 2, Hm, .8, bois); boite(g, w - (w - 26) / 4, 0, d - .4, (w - 26) / 2, Hm, .8, bois);
      boite(g, w / 2, .02, d / 2, w - 1.6, .05, d - 1.6, v("#8A7458"));
      boite(g, 16, 1.2, 1.4, 22, 13, .3, v("#C49A63")); g.ov().boite(10, 9, 1.6, 6, 4, .1, v("#F4F1EA")); ["#4C9AFF", "#2BB6A3", "#FF6FA8", "#F2994A"].forEach((c, k) => g.ov().boite(18 + k * 1.3, 9, 1.62, .9, .9, .1, v(c), .3)); branche(g.ov(), [8, 3, 1.62], [24, 7, 1.62], .12, .12, v("#2BB673"), .4);
      boite(g, 44, 1.2, 1.4, 24, 12, .3, v("#F4F6F8"), .15); branche(g.ov(), [36, 4, 1.62], [50, 9, 1.62], .1, .1, v("#2F6FD0")); branche(g.ov(), [50, 9, 1.62], [54, 6, 1.62], .1, .1, v("#D62D2D"));
      g.cylindre(m(805) - x0, 0, m(487) - z0, 6, 2.6, 12, v("#2E6B4A")); for (let k = 0; k < 5; k++) boite(g, m(805) - x0 + (r() - .5) * 6, 2.62, m(487) - z0 + (r() - .5) * 6, 1, .04, 1.4, v("#F4ECD8"), 0, r() * PI);
      [[-8, 0], [8, 0], [0, -8], [0, 8]].forEach(([a, b]) => g.cylindre(m(805) - x0 + a, 0, m(487) - z0 + b, 1.4, 1.6, 8, v("#3A2A1E")));
      const vx = m(874) - x0, vz = m(487) - z0; boite(g, vx, 0, vz, 14, 1.2, 14, v("#1A1B1F")); boite(g, vx, 1.2, vz, 4, 2.4, 4, v("#F7CF55"), .5); boite(g, vx, 3.6, vz, 14, .3, 14, v("#BFE4F2"), .25); [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(([a, b]) => boite(g, vx + a, 0, vz + b, .3, 9, .3, v("#E8F6FF"), .3)); boite(g, vx, 9, vz, 14.3, .3, 14.3, v("#E8F6FF"), .3);
      sol.poser(g, x0, 0, z0, 0, 1); lum.push([x0 + vx, 6, z0 + vz, 1, .85, .5, 14]); lum.push([x0 + w / 2, 6, z0 + d / 2, 1, .85, .6, 30]); occupe.push([x0 + w / 2, z0 + d / 2, Math.max(w, d) * .62]); }
    // la cour : emblème peint au sol, voitures en construction sur chandelles, caisses à outils, piles de roues
    { const so = sol.ov(), cx = m(420), cz = m(380); for (let k = 0; k < 40; k++) { if (k % 3 === 2) continue; const a0 = k / 40 * TAU, a1 = (k + .8) / 40 * TAU; [[m(95), m(90)], [m(70), m(68)]].forEach(([R1, R2]) => so.quad([cx + Math.cos(a0) * R1, .05, cz + Math.sin(a0) * R1], [cx + Math.cos(a1) * R1, .05, cz + Math.sin(a1) * R1], [cx + Math.cos(a1) * R2, .05, cz + Math.sin(a1) * R2], [cx + Math.cos(a0) * R2, .05, cz + Math.sin(a0) * R2], jaune, .2, [0, 1, 0])); }
      [[560, 470, "#2BB673", 0], [300, 420, "#F2994A", -.35]].forEach(([x, y, c, a]) => { const g = new Geo(); [[-3, -1.6], [-3, 1.6], [3, -1.6], [3, 1.6]].forEach(([p, q]) => boite(g, p, 0, q, .5, 1.6, .5, jaune)); g.poser(voiture({ couleur: c }), 0, 1.6, 0, 0, 1); sol.poser(g, m(x), 0, m(y), a, 1); occupe.push([m(x), m(y), 10]); });
      [[300, 260], [530, 520], [690, 530], [320, 520]].forEach(([x, y]) => { const g = new Geo(); boite(g, 0, 0, 0, 3.5, 3, 2.2, v("#C8283A")); sol.poser(g, m(x), 0, m(y), r() * TAU, 1); });
      [[270, 330], [640, 470], [520, 250], [250, 545]].forEach(([x, y]) => { const g = new Geo(); for (let k = 0; k < 4; k++) g.cylindre(0, k * .55, 0, .85, .5, 8, v(k % 2 ? "#1B1D21" : "#2B2E33")); sol.poser(g, m(x), 0, m(y), 0, 1); });
      occupe.push([cx, cz, 70]); }
    // projecteurs de la cour
    [[60, 60], [1020, 60], [1020, 690], [60, 690], [500, 140], [860, 330]].forEach(([x, y]) => { sol.poser(objet("projecteur", r, A), m(x), 0, m(y), 0, 1); lum.push([m(x), 23, m(y), 1, .85, .55, 34]); });
    return occupe;
  }
  /* ============================================================
     V16.10 · Boîte à outils des cartes peintes (unité u = 1,25 m ; carte 1080 × 720 u)
     ============================================================ */
  function posRepere(def, T, R) {   // même place que le monument 3D (voir repere / libre)
    const rue = !!def.rue, ps = T.a(-30, -(DEMI + (rue ? 12 : 22))), pt2 = T.a(-20, DEMI + (rue ? 8 : 18));
    const M = { chateau: 92, ver: 70, temple: 60, armoire: 66, cheminees: 60, tourcentrale: 40, holodome: 60, mai: 56, faille: 90, champignons: 56, plateau: 50 }[R.t] || 50;
    const p = libre(T, M, R.x !== undefined ? R.x * ECH : T.cx, R.y !== undefined ? R.y * ECH : T.cz, [[ps.x, ps.z, 70], [pt2.x, pt2.z, 75]]);
    return [p[0] * KU, p[1] * KU];
  }
  function kit(T, def, graine, pre) {
    const P = [], N = T.N, W = 1080, H = 720, r = alea(graine), s = [], a = [], defs = [], occ = [], anime = ANIM(), f = v => (+v).toFixed(1);
    for (let i = 0; i < N; i++) P.push([T.X[i] * KU, T.Z[i] * KU]);
    const K = {
      P, N, W, H, r, s, a, f, occ, anime, pre,
      dT(x, y) { let m = 1e9; for (let i = 0; i < N; i += 2) { const d = Math.hypot(P[i][0] - x, P[i][1] - y); if (d < m) m = d; } return m; },
      nrm(i) { i = ((i % N) + N) % N; const p = P[(i - 2 + N) % N], q = P[(i + 2) % N], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l, dx / l, dy / l]; },
      inside(x, y) { let o = false; for (let i = 0, j = N - 1; i < N; j = i++) { const p = P[i], q = P[j]; if ((p[1] > y) !== (q[1] > y) && x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]) + p[0]) o = !o; } return o; },
      libre(x, y, R, marge) { return K.dT(x, y) > R + (marge === undefined ? 20 : marge) && !occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + R) && !(def.eau || []).some(poly => dansPoly(x / KU / ECH, y / KU / ECH, poly)); },
      prendre(x, y, R) { occ.push([x, y, R]); },
      piste: "M" + P.map(p => f(p[0]) + " " + f(p[1])).join("L") + "Z",
      cx: P.reduce((t, p) => t + p[0], 0) / N, cy: P.reduce((t, p) => t + p[1], 0) / N,
      rep(R) { return posRepere(def, T, R); },
      /** semis d'objets au hasard, loin de la piste et de ce qui est déjà posé */
      semis(n, R, essais, test, dessin) { let k = 0; for (let e = 0; e < essais && k < n; e++) { const x = r() * (W + 40) - 20, y = r() * (H + 40) - 20, rr = typeof R === "function" ? R() : R; if (!K.libre(x, y, rr) || (test && !test(x, y)) || (rr >= 20 && (x < rr + 10 || x > W - rr - 10 || y < rr + 10 || y > H - rr - 10))) continue; K.prendre(x, y, rr * .7); dessin(x, y, rr, k++); } return k; },
      /** halo lumineux (dégradé radial mis en cache par couleur) */
      halo(x, y, R, c, op, dest) { const id = pre + "h" + c.replace("#", ""); if (!defs.includes(id)) { defs.push(id); s.unshift(`<radialGradient id="${id}" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset=".35" stop-color="${c}" stop-opacity=".4"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`); } (dest || s).push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#${id})" opacity="${op === undefined ? 1 : op}"/>`); },
      ombre(x, y, rx, ry, op) { s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry || rx)}" fill="#000" opacity="${op || .45}" filter="url(#${pre}flou)"/>`); },
      /** cime d'arbre vue de dessus */
      arbre(x, y, R, c1, c2, c3) { K.ombre(x + R * .35, y + R * .4, R, R * .9, .5); const n = 4 + Math.floor(r() * 3), id = pre + "c" + (c1 + c2).replace(/#/g, ""); if (!defs.includes(id)) { defs.push(id); s.unshift(`<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>`); }
        for (let k = 0; k < n; k++) { const t = k / n * TAU + r(); s.push(`<circle cx="${f(x + Math.cos(t) * R * .38)}" cy="${f(y + Math.sin(t) * R * .38)}" r="${f(R * (.55 + r() * .2))}" fill="url(#${id})"/>`); } s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .6)}" fill="url(#${id})"/>`); },
      /** sapin vu de dessus (étoile) */
      sapin(x, y, R, c, neige) { K.ombre(x + R * .3, y + R * .35, R, R, .45); for (let e = 0; e < 3; e++) { const rr = R * (1 - e * .28), pts = []; for (let k = 0; k < 16; k++) { const t = k / 16 * TAU + e * .2, q = k % 2 ? rr * .55 : rr; pts.push(f(x + Math.cos(t) * q) + "," + f(y + Math.sin(t) * q)); } s.push(`<polygon points="${pts.join(" ")}" fill="${e === 2 && neige ? "#F4F8FC" : mixHex(c, neige ? "#FFFFFF" : "#000000", e * (neige ? .3 : .12))}"/>`); } },
      /** toit vu de dessus (bâtiment), tourné de ang degrés */
      toit(x, y, w, h, c, ang, faitage, chem) { s.push(`<g transform="rotate(${f(ang || 0)} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2 + 4)}" y="${f(y - h / 2 + 6)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".45"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${c}"/>` +
        (faitage !== false ? `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h / 2)}" fill="#fff" opacity=".12"/><path d="M${f(x - w / 2)} ${f(y)}h${f(w)}" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>` : `<rect x="${f(x - w / 2 + 3)}" y="${f(y - h / 2 + 3)}" width="${f(w - 6)}" height="${f(h - 6)}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>`) +
        (chem ? `<rect x="${f(x + w * .25)}" y="${f(y - h * .35)}" width="${f(Math.max(4, w * .1))}" height="${f(Math.max(4, w * .1))}" fill="#5A3A2E"/>` : "") + "</g>"); },
      /** la piste : liste de couches [couleur, largeur, extra] puis ligne centrale */
      route(couches) { couches.forEach(([c, l, x]) => s.push(`<path d="${K.piste}" fill="none" stroke="${c}" stroke-width="${l}" stroke-linejoin="round"${x || ""}/>`)); },
      depart() { const p = P[0], [nx, ny, tx, ty] = K.nrm(0); let d = ""; for (let i = -3; i < 3; i++) for (let j = 0; j < 2; j++) { const ox = nx * i * 4.5 + tx * j * 4.5, oy = ny * i * 4.5 + ty * j * 4.5; d += `<path d="M${f(p[0] + ox)} ${f(p[1] + oy)}l${f(nx * 4.5)} ${f(ny * 4.5)}l${f(tx * 4.5)} ${f(ty * 4.5)}l${f(-nx * 4.5)} ${f(-ny * 4.5)}z" fill="${(i + j) % 2 ? "#111" : "#EEE"}"/>`; } s.push(d); },
      /** eau (polygones du tracé, en unités du plan) */
      eaux(c1, c2) { (def.eau || []).forEach(poly => { const d = "M" + poly.map(q => f(q[0] * ECH * KU) + " " + f(q[1] * ECH * KU)).join("L") + "Z"; s.push(`<path d="${d}" fill="${c1}"/><path d="${d}" fill="none" stroke="${c2}" stroke-width="4" opacity=".6"/>`); }); },
      /** particules animées : 'scintille', 'monte', 'tombe', 'derive' */
      particules(n, c, taille, mode) { const id = pre + "p" + c.replace("#", ""); a.unshift(`<radialGradient id="${id}" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${c}" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
        for (let k = 0; k < n; k++) { const x = r() * W, y = r() * H, t = taille * (.6 + r() * .8), d = (2 + r() * 4).toFixed(2), b = (r() * 4).toFixed(2), o = (.4 + r() * .6).toFixed(2);
          const an = !anime ? "" : mode === "scintille" ? `<animate attributeName="opacity" values="${o};.05;${o}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>` : mode === "monte" ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 30)} -60" dur="${(+d * 2).toFixed(2)}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;${o};0" dur="${(+d * 2).toFixed(2)}s" begin="${b}s" repeatCount="indefinite"/>`
            : mode === "tombe" ? `<animateTransform attributeName="transform" type="translate" values="0 -40;${f((r() - .5) * 20)} 60" dur="${(+d * 1.5).toFixed(2)}s" begin="${b}s" repeatCount="indefinite"/>` : `<animateTransform attributeName="transform" type="translate" values="0 0;${f(20 + r() * 40)} ${f((r() - .5) * 16)};0 0" dur="${(+d * 3).toFixed(2)}s" begin="${b}s" repeatCount="indefinite"/>`;
          a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(t)}" fill="url(#${id})" opacity="${o}">${an}</circle>`); } },
      /** fin : textures, teinte, vignette */
      fin(fond, teinte, opTeinte) {
        const tete = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><filter id="${pre}flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter><filter id="${pre}flou8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter><radialGradient id="${pre}vign" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`;
        const grads = s.filter(x => x.startsWith("<radialGradient") || x.startsWith("<linearGradient") || x.startsWith("<pattern")), corps = s.filter(x => !(x.startsWith("<radialGradient") || x.startsWith("<linearGradient") || x.startsWith("<pattern")));
        const svg = tete + grads.join("") + "</defs>" + fond + corps.join("") + (teinte ? `<rect width="${W}" height="${H}" fill="${teinte}" opacity="${opTeinte || .2}" style="mix-blend-mode:multiply"/>` : "") + `<rect width="${W}" height="${H}" fill="url(#${pre}vign)"/></svg>`;
        const ag = a.filter(x => x.startsWith("<radialGradient")), ac = a.filter(x => !x.startsWith("<radialGradient"));
        return { fond: svg, anim: (ag.length ? "<defs>" + ag.join("") + "</defs>" : "") + ac.join(""), W, H, couleur: "#000" };
      }
    };
    return K;
  }
  function mixHex(c1, c2, t) { const a = hex(c1), b = hex(c2), m = [0, 1, 2].map(i => Math.round((a[i] + (b[i] - a[i]) * t) * 255)); return "#" + m.map(v => v.toString(16).padStart(2, "0")).join(""); }
  const COULEURS_J = ["#4C9AFF", "#2BB6A3", "#FF6FA8", "#F2994A"];   // les 4 pilotes, pour les clins d'œil
  /* ---------- Février · Château aux sortilèges (école de magie) — v16.12, plus de magie ---------- */
  function peindreChateau(T, Z, def) {
    const K = kit(T, def, 22, "ch-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "chateau", y: 145 });
    s.push(`<radialGradient id="ch-toit" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8A9AFF"/><stop offset=".6" stop-color="#3D4E9C"/><stop offset="1" stop-color="#1A2050"/></radialGradient>`);
    s.push(`<radialGradient id="ch-lac" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2A5A7A"/><stop offset="1" stop-color="#0E2436"/></radialGradient>`);
    s.push(`<pattern id="ch-pierre" width="10" height="7" patternUnits="userSpaceOnUse"><rect width="10" height="7" fill="#5E626A"/><rect x=".5" y=".5" width="9" height="6" fill="#70757E"/></pattern>`);
    s.push(`<pattern id="ch-ardoise" width="5" height="4" patternUnits="userSpaceOnUse"><rect width="5" height="4" fill="#3A4258"/><path d="M0 3.5h5" stroke="#262C3E" stroke-width=".7"/></pattern>`);
    // le lac enchanté (sous le château), ses barques à lanternes et un grand tentacule
    const lx = X, ly = Y + 150; s.push(`<ellipse cx="${f(lx)}" cy="${f(ly)}" rx="240" ry="80" fill="url(#ch-lac)"/><ellipse cx="${f(lx)}" cy="${f(ly)}" rx="240" ry="80" fill="none" stroke="#3A6A5A" stroke-width="6" opacity=".6"/>`);
    for (let k = 0; k < 8; k++) { const bx = lx - 160 + k * 44, by = ly + 30 + (k % 2) * 16; K.a.push(`<g><path d="M${f(bx - 7)} ${f(by)}q7 5 14 0" fill="#5A4030" stroke="#2E2014"/><circle cx="${f(bx)}" cy="${f(by - 2)}" r="1.6" fill="#FFE6A8"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(14 + r() * 10)} ${f(-6 - r() * 6)};0 0" dur="${(10 + r() * 6).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); K.halo(bx, by - 2, 10, "#FFD58A", .7); }
    K.a.push(`<path d="M${f(lx + 120)} ${f(ly + 10)}q14 -20 4 -36q-6 -8 2 -14" fill="none" stroke="#2E5A4A" stroke-width="5" stroke-linecap="round">${K.anime ? `<animateTransform attributeName="transform" type="rotate" values="-8 ${f(lx + 120)} ${f(ly + 10)};10 ${f(lx + 120)} ${f(ly + 10)};-8 ${f(lx + 120)} ${f(ly + 10)}" dur="5s" repeatCount="indefinite"/>` : ""}</path>`);
    K.prendre(lx, ly, 150);
    // le château : grand rempart, nombreuses tours aux toits coniques, cours, grande salle, tour d'astronomie, volière
    K.ombre(X + 14, Y + 18, 120, 82, .6);
    s.push(`<path d="M${f(X - 120)} ${f(Y + 50)}L${f(X - 110)} ${f(Y - 60)}L${f(X - 30)} ${f(Y - 82)}L${f(X + 70)} ${f(Y - 76)}L${f(X + 120)} ${f(Y - 20)}L${f(X + 110)} ${f(Y + 56)}L${f(X + 20)} ${f(Y + 74)}L${f(X - 60)} ${f(Y + 72)}Z" fill="url(#ch-pierre)" stroke="#2E3138" stroke-width="3"/>`);
    [[X - 70, Y - 20, 60, 46], [X + 40, Y + 20, 70, 40], [X - 30, Y + 40, 44, 26]].forEach(([x, y, w, h]) => { s.push(`<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${w}" height="${h}" fill="#4A6A4A" stroke="#2E3138"/>`); for (let k = 0; k < 4; k++) s.push(`<circle cx="${f(x - w / 2 + 6 + r() * (w - 12))}" cy="${f(y - h / 2 + 6 + r() * (h - 12))}" r="3" fill="#5E8A5A"/>`); });
    s.push(`<rect x="${f(X - 20)}" y="${f(Y - 60)}" width="90" height="34" fill="url(#ch-ardoise)" stroke="#1A1E2A" stroke-width="2"/>`); for (let k = 0; k < 8; k++) s.push(`<rect x="${f(X - 16 + k * 11)}" y="${f(Y - 64)}" width="5" height="4" fill="#FFC86B"/><rect x="${f(X - 16 + k * 11)}" y="${f(Y - 26)}" width="5" height="4" fill="#FFC86B"/>`);
    const tours = [[-110, -60, 14], [-30, -82, 12], [70, -76, 13], [120, -20, 15], [110, 56, 12], [20, 74, 11], [-60, 72, 12], [-120, 50, 13], [-5, -10, 20], [60, -40, 10], [-80, 20, 10], [80, 40, 9]];
    tours.forEach(([a2, b, R], k) => { const x = X + a2, y = Y + b; K.ombre(x + R * .4, y + R * .5, R + 2, R + 2, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R + 3}" fill="#5A5F68" stroke="#2E3138" stroke-width="1.5"/><circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="url(#ch-toit)"/>`); for (let q = 0; q < 6; q++) s.push(`<path d="M${f(x)} ${f(y)}L${f(x + Math.cos(q * 1.05) * R)} ${f(y + Math.sin(q * 1.05) * R)}" stroke="#1A2050" stroke-width=".8" opacity=".6"/>`); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#E9D5FF"/>`); if (k < 4) s.push(`<path d="M${f(x + R)} ${f(y - R)}l14 -5l-3 5l3 5z" fill="${COULEURS_J[k]}" stroke="#111" stroke-width=".6"/>`); });   // bannières aux couleurs des 4
    // la tour d'astronomie : orbe et anneaux de sortilège qui tournent
    const ox = X - 5, oy = Y - 10; K.halo(ox, oy, 110, "#B57BFF", .5, K.a);
    [34, 48].forEach((R, k) => K.a.push(`<circle cx="${f(ox)}" cy="${f(oy)}" r="${R}" fill="none" stroke="${k ? "#C9B8FF" : "#FFE6A8"}" stroke-width="1.5" stroke-dasharray="${k ? "2 6" : "8 4"}">${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="${k ? 360 : 0} ${f(ox)} ${f(oy)}" to="${k ? 0 : 360} ${f(ox)} ${f(oy)}" dur="${k ? 30 : 20}s" repeatCount="indefinite"/>` : ""}</circle>`));
    K.a.push(`<circle cx="${f(ox)}" cy="${f(oy)}" r="6" fill="#F2E6FF">${K.anime ? '<animate attributeName="r" values="5;9;5" dur="2.6s" repeatCount="indefinite"/>' : ""}</circle>`);
    // traînées de sortilèges entre les tours
    for (let k = 0; k < 5; k++) { const t1 = tours[Math.floor(r() * tours.length)], t2 = tours[Math.floor(r() * tours.length)]; if (t1 === t2) continue; const c2 = ["#7CF2FF", "#FFB3F5", "#B8FF8A", "#FFE27A", "#C9B8FF"][k]; K.a.push(`<path d="M${f(X + t1[0])} ${f(Y + t1[1])}Q${f(X + (t1[0] + t2[0]) / 2)} ${f(Y + Math.min(t1[1], t2[1]) - 60)} ${f(X + t2[0])} ${f(Y + t2[1])}" fill="none" stroke="${c2}" stroke-width="1.8" stroke-dasharray="6 300" opacity=".9">${K.anime ? `<animate attributeName="stroke-dashoffset" from="306" to="0" dur="${(2 + r() * 2).toFixed(1)}s" begin="${(r() * 3).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</path>`); }
    // bougies qui flottent au-dessus de la grande salle
    for (let k = 0; k < 18; k++) { const x = X - 15 + r() * 80, y = Y - 58 + r() * 30, d = (2 + r() * 2).toFixed(1); K.a.push(`<g><rect x="${f(x - .8)}" y="${f(y)}" width="1.6" height="4" fill="#F4ECD8"/><circle cx="${f(x)}" cy="${f(y - .8)}" r="1.4" fill="#FFD27A"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${d}s" repeatCount="indefinite"/>` : ""}</g>`); }
    // échiquier géant en pleine partie dans une cour (clin d'œil)
    const ex = X + 18, ey = Y + 8; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) s.push(`<rect x="${f(ex + i * 4)}" y="${f(ey + j * 4)}" width="4" height="4" fill="${(i + j) % 2 ? "#2B2B30" : "#D9D2C2"}"/>`);
    [[1, 2, "#F4F1EA"], [3, 4, "#F4F1EA"], [5, 1, "#1A1A22"], [6, 6, "#1A1A22"], [2, 5, "#1A1A22"], [4, 3, "#F4F1EA"]].forEach(([i, j, c2]) => s.push(`<circle cx="${f(ex + i * 4 + 2)}" cy="${f(ey + j * 4 + 2)}" r="1.6" fill="${c2}" stroke="#777" stroke-width=".3"/>`));
    K.prendre(X, Y, 140);
    // pont couvert vers le terrain de jeu aérien (3 grands anneaux de chaque côté) avec ses tribunes
    K.semis(1, 70, 3000, (x, y) => !K.inside(x, y) || K.dT(x, y) > 90, (x, y) => { s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="68" ry="38" fill="#3E6A3A" stroke="#E9DFC6" stroke-width="2"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="74" ry="44" fill="none" stroke="#8A3A3A" stroke-width="5" stroke-dasharray="10 4"/>`);
      [-1, 1].forEach(sd => [-10, 0, 10].forEach((o, q) => s.push(`<circle cx="${f(x + sd * 58)}" cy="${f(y + o)}" r="${q === 1 ? 5 : 3.6}" fill="none" stroke="#E2B93B" stroke-width="1.6"/>`)));
      COULEURS_J.forEach((c2, k) => K.a.push(`<g><path d="M${f(x - 30 + k * 18)} ${f(y - 10 + (k % 2) * 16)}l8 0" stroke="#8A6A48" stroke-width="2"/><circle cx="${f(x - 26 + k * 18)}" cy="${f(y - 12 + (k % 2) * 16)}" r="2.6" fill="${c2}"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 60)} ${f((r() - .5) * 30)};0 0" dur="${(4 + r() * 3).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`)); });
    // la cabane du garde-chasse et son carré de citrouilles géantes
    K.semis(1, 22, 3000, (x, y) => K.dT(x, y) > 40, (x, y) => { K.ombre(x + 4, y + 5, 12, 12, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="11" fill="#7A5A3A" stroke="#3A2414" stroke-width="2"/><circle cx="${f(x + 5)}" cy="${f(y - 5)}" r="2.5" fill="#5A3A22"/>`); K.halo(x - 3, y + 6, 14, "#FFB347", .6); for (let k = 0; k < 5; k++) s.push(`<circle cx="${f(x + 18 + (k % 3) * 9)}" cy="${f(y + 4 + Math.floor(k / 3) * 9)}" r="${f(3.5 + r() * 2)}" fill="#E8762A" stroke="#8A3A10"/>`); });
    // la forêt interdite : sapins serrés, yeux qui brillent, saule noueux
    K.semis(330, () => 9 + r() * 12, 7000, null, (x, y, R) => K.sapin(x, y, R, K.inside(x, y) ? "#1F4A34" : "#122A20"));
    for (let k = 0; k < 9; k++) { const x = r() * W, y = r() * H; if (K.inside(x, y) || K.dT(x, y) < 30) continue; K.a.push(`<g opacity="0"><circle cx="${f(x - 2)}" cy="${f(y)}" r="1.1" fill="#FFE27A"/><circle cx="${f(x + 2)}" cy="${f(y)}" r="1.1" fill="#FFE27A"/>${K.anime ? `<animate attributeName="opacity" values="0;0;1;1;0" dur="${(5 + r() * 5).toFixed(1)}s" begin="${(r() * 5).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    // cercles de runes au sol
    for (let k = 0; k < 4; k++) { const x = r() * W, y = r() * H; if (!K.libre(x, y, 20)) continue; K.a.push(`<g opacity=".7"><circle cx="${f(x)}" cy="${f(y)}" r="16" fill="none" stroke="#7CF2FF" stroke-width="1"/><circle cx="${f(x)}" cy="${f(y)}" r="11" fill="none" stroke="#7CF2FF" stroke-width=".6" stroke-dasharray="2 3"/>${[0, 1, 2, 3, 4].map(q => `<path d="M${f(x + Math.cos(q * 1.26) * 13)} ${f(y + Math.sin(q * 1.26) * 13)}l2 -3" stroke="#7CF2FF"/>`).join("")}${K.anime ? `<animate attributeName="opacity" values=".2;.9;.2" dur="${(3 + r() * 2).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    // la route pavée et ses lanternes
    K.route([["#05080A", 40, ` opacity=".55" filter="url(#ch-flou)"`], ["#3A3E46", 30], ["url(#ch-pierre)", 24]]);
    for (let i = 0; i < K.N; i += 18) { const [nx, ny] = K.nrm(i), sd = (i / 18) % 2 ? 1 : -1, x = K.P[i][0] + nx * sd * 20, y = K.P[i][1] + ny * sd * 20; K.halo(x, y, 16, "#FFB347", .8); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="1.8" fill="#FFF0BC"/>`); }
    K.depart();
    // hiboux et balais qui traversent le ciel
    for (let k = 0; k < 4; k++) { const y0 = 60 + r() * (H - 120), d = (12 + r() * 10).toFixed(1); K.a.push(`<g><path d="M0 ${f(y0)}l-6 -3l-6 3l6 -1z" fill="#C9B396"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="-20 0;${W + 40} ${f((r() - .5) * 120)}" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    K.particules(50, "#FFE6A8", 2.4, "monte"); K.particules(40, "#C9B8FF", 2, "scintille");
    return K.fin(`<rect width="${W}" height="${H}" fill="#18291F"/>`, "#141A44", .3);
  }
  /* ---------- Mars · Pays derrière l'armoire (royaume d'hiver) ---------- */
  function peindreArmoire(T, Z, def) {
    const K = kit(T, def, 31, "ar-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "armoire" });
    for (let k = 0; k < 60; k++) { const x = r() * W, y = r() * H; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(30 + r() * 60)}" ry="${f(14 + r() * 26)}" fill="${r() < .5 ? "#FFFFFF" : "#D5E2EF"}" opacity=".35"/>`); }
    K.eaux("#BFE1F2", "#FFFFFF");
    (def.eau || []).forEach(poly => { const P0 = poly.map(q => [q[0] * ECH * KU, q[1] * ECH * KU]), cx = P0.reduce((t, p) => t + p[0], 0) / P0.length, cy = P0.reduce((t, p) => t + p[1], 0) / P0.length;
      for (let k = 0; k < 7; k++) { const t = r() * TAU, L = 30 + r() * 60; s.push(`<path d="M${f(cx + Math.cos(t) * 10)} ${f(cy + Math.sin(t) * 10)}l${f(Math.cos(t) * L)} ${f(Math.sin(t) * L)}l${f(Math.cos(t + .5) * 12)} ${f(Math.sin(t + .5) * 12)}" stroke="#FFFFFF" stroke-width="1.2" fill="none" opacity=".8"/>`); }
      s.push(`<path d="M${f(cx - 70)} ${f(cy + 10)}c30 -40 70 40 110 0s60 -30 30 20" stroke="#9FC6DC" stroke-width="1.5" fill="none" opacity=".9"/><path d="M${f(cx - 60)} ${f(cy + 18)}c30 -40 70 40 110 0" stroke="#9FC6DC" stroke-width="1.5" fill="none" opacity=".7"/>`);
      // clin d'œil : une partie de jeu prise dans la glace
      s.push(`<rect x="${f(cx + 20)}" y="${f(cy - 30)}" width="22" height="16" fill="#2E5E8C" opacity=".55" transform="rotate(12 ${f(cx + 31)} ${f(cy - 22)})"/>`); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(cx + 25 + k * 4)}" cy="${f(cy - 23 + (k % 2) * 3)}" r="1.6" fill="${c2}" opacity=".8"/>`));
      K.prendre(cx, cy, 120); });
    // l'armoire ouverte, lumière chaude, réverbère et traces de pas
    K.ombre(X + 6, Y + 8, 28, 14, .5); s.push(`<rect x="${f(X - 22)}" y="${f(Y - 9)}" width="44" height="18" rx="2" fill="#6B4226" stroke="#3A2414" stroke-width="2"/><rect x="${f(X - 19)}" y="${f(Y - 6)}" width="38" height="12" fill="#FFE9B0"/>`);
    s.push(`<rect x="${f(X - 40)}" y="${f(Y + 6)}" width="20" height="4" fill="#7E5232" transform="rotate(35 ${f(X - 22)} ${f(Y + 8)})"/><rect x="${f(X + 20)}" y="${f(Y + 6)}" width="20" height="4" fill="#7E5232" transform="rotate(-35 ${f(X + 22)} ${f(Y + 8)})"/>`);
    K.halo(X, Y + 18, 70, "#FFD58A", .7); for (let k = 0; k < 9; k++) s.push(`<ellipse cx="${f(X + 6 + (k % 2) * 7)}" cy="${f(Y + 22 + k * 11)}" rx="2.2" ry="3.4" fill="#B9CCDD"/>`);
    const lx = X + 48, ly = Y - 18; K.halo(lx, ly, 45, "#FFE6A8", .8); s.push(`<circle cx="${f(lx)}" cy="${f(ly)}" r="4" fill="#20242B"/><circle cx="${f(lx)}" cy="${f(ly)}" r="2.2" fill="#FFF3C8"/>`); K.prendre(X, Y, 70);
    // bonhomme de neige à 4 écharpes (clin d'œil), traîneau
    K.semis(1, 12, 500, (x, y) => K.dT(x, y) > 60, (x, y) => { s.push(`<circle cx="${f(x + 3)}" cy="${f(y + 4)}" r="12" fill="#9FB2C6" opacity=".5"/><circle cx="${f(x)}" cy="${f(y)}" r="11" fill="#FFFFFF" stroke="#C9D8E6"/><circle cx="${f(x)}" cy="${f(y)}" r="6.5" fill="#F4F8FC" stroke="#C9D8E6"/>`); COULEURS_J.forEach((c2, k) => s.push(`<path d="M${f(x)} ${f(y)}l${f(Math.cos(k * 1.57 + .4) * 12)} ${f(Math.sin(k * 1.57 + .4) * 12)}" stroke="${c2}" stroke-width="2.4"/>`)); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#F2994A"/>`); });
    K.semis(1, 16, 500, (x, y) => K.dT(x, y) > 50, (x, y) => { s.push(`<g transform="rotate(${f(r() * 360)} ${f(x)} ${f(y)})"><rect x="${f(x - 14)}" y="${f(y - 6)}" width="28" height="12" rx="4" fill="#B03A2E"/><path d="M${f(x - 16)} ${f(y - 8)}h34M${f(x - 16)} ${f(y + 8)}h34" stroke="#C9A35A" stroke-width="2"/></g><path d="M${f(x + 16)} ${f(y)}c40 10 80 -10 120 4" stroke="#C9D8E6" stroke-width="5" stroke-dasharray="2 4" fill="none" opacity=".7"/>`); });
    // palais de glace au loin (cristaux)
    K.semis(1, 40, 800, (x, y) => !K.inside(x, y), (x, y) => { for (let k = 0; k < 7; k++) { const t = k / 7 * TAU, d = k ? 22 : 0; s.push(`<polygon points="${f(x + Math.cos(t) * d)},${f(y + Math.sin(t) * d - 14)} ${f(x + Math.cos(t) * d + 8)},${f(y + Math.sin(t) * d)} ${f(x + Math.cos(t) * d)},${f(y + Math.sin(t) * d + 14)} ${f(x + Math.cos(t) * d - 8)},${f(y + Math.sin(t) * d)}" fill="#CFEFFF" stroke="#FFFFFF" opacity=".9"/>`); } K.halo(x, y, 60, "#9FE8FF", .45); });
    K.semis(260, () => 9 + r() * 11, 5000, null, (x, y, R) => K.sapin(x, y, R, "#2F5A4A", true));
    K.route([["#7E92A6", 38, ` opacity=".4" filter="url(#ar-flou)"`], ["#E6EEF5", 30], ["#C7D4E0", 22], ["#AFC0D0", 3, ` transform="translate(3 3)" opacity=".7"`]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#9DB1C4" stroke-width="2" stroke-dasharray="1 0" transform="translate(-4 0)" opacity=".6"/><path d="${K.piste}" fill="none" stroke="#9DB1C4" stroke-width="2" transform="translate(4 0)" opacity=".6"/>`);
    K.depart(); for (let i = 0; i < K.N; i += 18) { const [nx, ny] = K.nrm(i), sd = (i / 18) % 2 ? 1 : -1; s.push(`<circle cx="${f(K.P[i][0] + nx * sd * 18)}" cy="${f(K.P[i][1] + ny * sd * 18)}" r="2.6" fill="${sd > 0 ? "#2F6FD0" : "#FFFFFF"}" stroke="#2F6FD0" stroke-width=".8"/>`); }
    K.particules(90, "#FFFFFF", 2.6, "tombe");
    return K.fin(`<rect width="${W}" height="${H}" fill="#EAF1F7"/>`, "#AFC6E0", .18);
  }
  /* ---------- Avril · Bas-fonds sous la pluie (gangs des années 1920) ---------- */
  function peindreBasfonds(T, Z, def) {
    const K = kit(T, def, 41, "bf-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "cheminees" });
    s.push(`<pattern id="bf-pave" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#2E2C2B"/><rect x=".6" y=".6" width="10.8" height="6.8" rx="1.5" fill="#3A3735"/></pattern>`);
    // canal avec péniches
    const cy0 = H * .5 + (r() - .5) * 60; s.push(`<path d="M-20 ${f(cy0)}C${f(W * .3)} ${f(cy0 - 60)} ${f(W * .6)} ${f(cy0 + 70)} ${W + 20} ${f(cy0 - 20)}" fill="none" stroke="#1B2A33" stroke-width="44"/><path d="M-20 ${f(cy0)}C${f(W * .3)} ${f(cy0 - 60)} ${f(W * .6)} ${f(cy0 + 70)} ${W + 20} ${f(cy0 - 20)}" fill="none" stroke="#2F4A58" stroke-width="34"/>`);
    // usine aux cheminées (monument 3D), fumée
    K.toit(X, Y, 130, 64, "#7A3B2E", 0, false); for (let k = 0; k < 5; k++) { const x = X - 48 + k * 24, y = Y - 50; s.push(`<circle cx="${f(x + 3)}" cy="${f(y + 4)}" r="8" fill="#000" opacity=".4"/><circle cx="${f(x)}" cy="${f(y)}" r="7" fill="#6A3328" stroke="#3A1A14" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="3.5" fill="#111"/>`); K.halo(x + 10, y - 18, 26, "#6E7178", .6); }
    for (let k = 0; k < 8; k++) s.push(`<rect x="${f(X - 58 + k * 15)}" y="${f(Y + 20)}" width="9" height="5" fill="#FFC86B" opacity=".9"/>`); K.prendre(X, Y, 90);
    // rangées de maisons de briques (toits d'ardoise et de tuiles), cheminées qui fument
    K.semis(140, () => 14 + r() * 10, 6000, null, (x, y, R) => { const ang = Math.round(r() * 3) * 90 + (r() - .5) * 8; K.toit(x, y, R * 2.2, R * 1.3, r() < .5 ? "#5A3A32" : r() < .5 ? "#3E434C" : "#6E3B2C", ang, true, true); if (r() < .35) { const id = "bf-f" + Math.floor(r() * 3); K.a.push(`<circle cx="${f(x + R * .5)}" cy="${f(y - R * .5)}" r="5" fill="#8A8D93" opacity=".35">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;14 -22" dur="${(3 + r() * 3).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".4;0" dur="${(3 + r() * 3).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</circle>`); } if (r() < .5) s.push(`<rect x="${f(x - 3)}" y="${f(y + R * .65)}" width="6" height="3" fill="#FFC86B"/>`); });
    // clins d'œil : ardoise des paris (4 pilotes, leurs cotes), table de cartes et 4 casquettes, voiture d'époque
    K.semis(1, 22, 800, null, (x, y) => { s.push(`<rect x="${f(x - 20)}" y="${f(y - 13)}" width="40" height="26" fill="#1E2420" stroke="#5A4030" stroke-width="3"/>`); ["T 2/1", "K 3/1", "C 5/1", "D 4/1"].forEach((t, k) => s.push(`<text x="${f(x - 16)}" y="${f(y - 4 + k * 5.5)}" font-family="Georgia, serif" font-size="5" fill="${COULEURS_J[k]}">${t}</text>`)); });
    K.semis(1, 18, 800, null, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="11" fill="#2E5A3A" stroke="#4A3626" stroke-width="2"/>`); for (let k = 0; k < 4; k++) { const t = k * 1.57; s.push(`<ellipse cx="${f(x + Math.cos(t) * 15)}" cy="${f(y + Math.sin(t) * 15)}" rx="5" ry="4" fill="${COULEURS_J[k]}" stroke="#222"/><rect x="${f(x + Math.cos(t) * 5 - 2)}" y="${f(y + Math.sin(t) * 5 - 3)}" width="4" height="6" fill="#F4ECD8"/>`); } });
    K.semis(1, 18, 800, null, (x, y) => s.push(`<g transform="rotate(${f(r() * 360)} ${f(x)} ${f(y)})"><rect x="${f(x - 16)}" y="${f(y - 7)}" width="32" height="14" rx="5" fill="#1A1A1E"/><rect x="${f(x - 6)}" y="${f(y - 6)}" width="12" height="12" rx="2" fill="#2C2C33"/><circle cx="${f(x + 14)}" cy="${f(y - 4)}" r="2" fill="#FFE6A8"/><circle cx="${f(x + 14)}" cy="${f(y + 4)}" r="2" fill="#FFE6A8"/></g>`));
    // pavés mouillés, piste en asphalte luisant, bordures de briques, becs de gaz, pont au croisement
    K.route([["#08090B", 40, ` opacity=".6" filter="url(#bf-flou)"`], ["#7A3B2E", 30], ["#9A4E3A", 30, ` stroke-dasharray="5 5"`], ["#1E2126", 23], ["#3A4250", 2, ` stroke-dasharray="20 30" opacity=".8"`]]);
    const haut = []; for (let i = 0; i < K.N; i++) if (T.Y[i] > 4) haut.push(K.P[i]); if (haut.length > 4) { const d = "M" + haut.map(p => f(p[0]) + " " + f(p[1])).join("L"); s.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="40" opacity=".35" filter="url(#bf-flou)"/><path d="${d}" fill="none" stroke="#5A5F68" stroke-width="32"/><path d="${d}" fill="none" stroke="#1E2126" stroke-width="24"/><path d="${d}" fill="none" stroke="#8E969F" stroke-width="27" stroke-dasharray="2 6" opacity=".7"/>`); }
    K.depart(); for (let i = 0; i < K.N; i += 20) { const [nx, ny] = K.nrm(i), sd = (i / 20) % 2 ? 1 : -1; K.halo(K.P[i][0] + nx * sd * 20, K.P[i][1] + ny * sd * 20, 22, "#FFB347", .7); }
    for (let k = 0; k < 30; k++) { const x = r() * W, y = r() * H; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(6 + r() * 14)}" ry="${f(3 + r() * 5)}" fill="#6E7F8F" opacity=".25"/>`); }
    for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H, d = (.5 + r() * .6).toFixed(2); K.a.push(`<path d="M${f(x)} ${f(y)}l-3 12" stroke="#AFC6DA" stroke-width="1" opacity=".5">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 -30;-6 40" dur="${d}s" begin="${(r()).toFixed(2)}s" repeatCount="indefinite"/>` : ""}</path>`); }
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#bf-pave)"/>`, "#1C2433", .3);
  }
  /* ---------- Mai · Mégapole des androïdes (ville néon) ---------- */
  function peindreMegapole(T, Z, def) {
    const K = kit(T, def, 51, "mg-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "tourcentrale", y: 160 }), neons = ["#22D3EE", "#FF4FD8", "#9B87FF", "#3DDC97", "#F7CF55"];
    for (let x = 0; x < W; x += 40) s.push(`<path d="M${x} 0V${H}" stroke="#1B1F33" stroke-width="10"/>`); for (let y = 0; y < H; y += 40) s.push(`<path d="M0 ${y}H${W}" stroke="#1B1F33" stroke-width="10"/>`);
    // la tour centrale : anneaux holographiques
    K.ombre(X + 14, Y + 18, 46, 46, .6); [44, 34, 24, 14].forEach((R, k) => s.push(`<rect x="${f(X - R)}" y="${f(Y - R)}" width="${f(2 * R)}" height="${f(2 * R)}" fill="${["#1A1D2B", "#22263A", "#2A2F48", "#33395A"][k]}" stroke="${neons[k]}" stroke-width="1.5" transform="rotate(${k * 12} ${f(X)} ${f(Y)})"/>`));
    K.halo(X, Y, 120, "#22D3EE", .35); K.a.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="70" fill="none" stroke="#FF4FD8" stroke-width="2.5" stroke-dasharray="14 10" opacity=".8">${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="0 ${f(X)} ${f(Y)}" to="360 ${f(X)} ${f(Y)}" dur="18s" repeatCount="indefinite"/>` : ""}</circle>`); K.prendre(X, Y, 80);
    // immeubles : toits sombres aux arêtes néon, climatiseurs, héliports, panneaux holographiques
    K.semis(150, () => 13 + r() * 16, 7000, null, (x, y, R) => { const c = neons[Math.floor(r() * neons.length)], w = R * 2, h = R * (1.2 + r() * .8);
      s.push(`<rect x="${f(x - w / 2 + 6)}" y="${f(y - h / 2 + 8)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".55"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="#1E2233" stroke="${c}" stroke-width="1.4" stroke-opacity=".8"/>`);
      if (r() < .2) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.min(w, h) * .3)}" fill="none" stroke="#F7CF55" stroke-width="1.5"/><text x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" font-size="8" font-weight="700" fill="#F7CF55" font-family="Helvetica">H</text>`);
      else for (let k = 0; k < 3; k++) s.push(`<rect x="${f(x - w / 2 + 3 + r() * (w - 10))}" y="${f(y - h / 2 + 3 + r() * (h - 10))}" width="5" height="4" fill="#3A3F55"/>`);
      if (r() < .25) { K.a.push(`<rect x="${f(x - w / 2 + 2)}" y="${f(y - 3)}" width="${f(w - 4)}" height="6" fill="${c}" opacity=".7">${K.anime ? `<animate attributeName="opacity" values=".8;.2;.8" dur="${(1.5 + r() * 2).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</rect>`); K.halo(x, y, R * 1.6, c, .25); } });
    // clins d'œil : panneau géant « VERSUS » avec la courbe des 4, 4 drones aux couleurs des pilotes, jardin sur un toit avec un jeu
    K.semis(1, 30, 1500, null, (x, y) => { s.push(`<rect x="${f(x - 30)}" y="${f(y - 14)}" width="60" height="28" fill="#0A0C16" stroke="#22D3EE" stroke-width="1.5"/><text x="${f(x - 26)}" y="${f(y - 4)}" font-family="Helvetica" font-weight="900" font-size="7" fill="#22D3EE">VERSUS</text>`); COULEURS_J.forEach((c2, k) => s.push(`<polyline points="${[0, 1, 2, 3, 4].map(i => f(x - 26 + i * 12) + "," + f(y + 10 - i * (1 + k * .6) - r() * 3)).join(" ")}" fill="none" stroke="${c2}" stroke-width="1.2"/>`)); K.halo(x, y, 50, "#22D3EE", .3); });
    COULEURS_J.forEach((c2, k) => { const x = 120 + r() * (W - 240), y = 80 + r() * (H - 160); K.a.push(`<g><circle cx="${f(x)}" cy="${f(y)}" r="4" fill="${c2}"/><circle cx="${f(x)}" cy="${f(y)}" r="9" fill="none" stroke="${c2}" stroke-opacity=".5"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 80)} ${f((r() - .5) * 60)};0 0" dur="${(8 + r() * 6).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); });
    K.semis(1, 22, 1500, null, (x, y) => { s.push(`<rect x="${f(x - 20)}" y="${f(y - 16)}" width="40" height="32" fill="#2B4A35" stroke="#3DDC97"/>`); for (let k = 0; k < 6; k++) s.push(`<circle cx="${f(x - 14 + (k % 3) * 14)}" cy="${f(y - 8 + Math.floor(k / 3) * 16)}" r="4" fill="#3E8E5A"/>`); s.push(`<rect x="${f(x - 5)}" y="${f(y - 4)}" width="10" height="8" fill="#2E5E8C"/>`); });
    // voies des voitures volantes
    for (let k = 0; k < 4; k++) { const y0 = 60 + r() * (H - 120); K.a.push(`<path d="M-20 ${f(y0)}C${f(W * .3)} ${f(y0 + (r() - .5) * 200)} ${f(W * .7)} ${f(y0 + (r() - .5) * 200)} ${W + 20} ${f(y0)}" fill="none" stroke="${neons[k]}" stroke-width="2" stroke-dasharray="8 30" opacity=".6">${K.anime ? '<animate attributeName="stroke-dashoffset" from="0" to="-76" dur="2s" repeatCount="indefinite"/>' : ""}</path>`); }
    K.route([["#000", 40, ` opacity=".6" filter="url(#mg-flou)"`], ["#22D3EE", 30, ` opacity=".25"`], ["#0E1018", 26], ["#151925", 20], ["#FF4FD8", 1.4, ` transform="translate(0 0)" opacity=".0"`]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#22D3EE" stroke-width="27" stroke-opacity=".9" stroke-dasharray="1 0" fill-opacity="0" style="stroke-width:1.4" transform="translate(0 0)"/>`);
    for (const sd of [1, -1]) { const d = "M" + K.P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 12) + " " + f(p[1] + ny * sd * 12); }).join("L") + "Z"; s.push(`<path d="${d}" fill="none" stroke="${sd > 0 ? "#22D3EE" : "#FF4FD8"}" stroke-width="2"/>`); K.a.push(`<path d="${d}" fill="none" stroke="${sd > 0 ? "#22D3EE" : "#FF4FD8"}" stroke-width="5" opacity=".25"/>`); }
    K.depart(); K.particules(40, "#22D3EE", 2, "scintille");
    return K.fin(`<rect width="${W}" height="${H}" fill="#0C0E18"/>`, "#2A0B5A", .18);
  }
  /* ---------- Juin · Plateau maudit (jeu de plateau géant dans la jungle) ---------- */
  function peindrePlateau(T, Z, def) {
    const K = kit(T, def, 61, "pl-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "plateau" });
    // le plateau de bois au centre, cases à damier rouges et prune, cadre doré
    s.push(`<rect x="40" y="30" width="${W - 80}" height="${H - 60}" rx="18" fill="#6B3E1F" stroke="#C9A24A" stroke-width="8"/><rect x="56" y="46" width="${W - 112}" height="${H - 92}" rx="10" fill="#E9DFC8"/>`);
    for (let i = 0; i < 26; i++) for (let j = 0; j < 17; j++) if ((i + j) % 2 === 0) s.push(`<rect x="${56 + i * 38}" y="${46 + j * 38}" width="38" height="38" fill="${(i * 7 + j * 3) % 5 === 0 ? "#C8283A" : "#3A2F4A"}" opacity=".85"/>`);
    s.push(`<rect x="56" y="46" width="${W - 112}" height="${H - 92}" rx="10" fill="none" stroke="#5A3A22" stroke-width="3"/>`);
    // la jungle déborde du bord du plateau
    for (let k = 0; k < 90; k++) { const t = r(), side = Math.floor(r() * 4), x = side === 0 ? t * W : side === 1 ? W - r() * 34 : side === 2 ? t * W : r() * 34, y = side === 0 ? r() * 34 : side === 1 ? t * H : side === 2 ? H - r() * 34 : t * H; K.arbre(x, y, 14 + r() * 16, "#5BA35A", "#2C6B3A", "#123A20"); }
    for (let k = 0; k < 14; k++) { const x = 60 + r() * (W - 120), y = 50 + r() * (H - 100); if (K.dT(x, y) < 20) continue; s.push(`<path d="M${f(x)} ${f(y)}q${f(20 + r() * 30)} ${f(10 + r() * 20)} ${f(40 + r() * 40)} ${f(-5 + r() * 30)}" stroke="#2E6B2A" stroke-width="3" fill="none" opacity=".8"/>`); }
    // pions, dés, cartes, sablier géants (le monument 3D)
    K.ombre(X + 8, Y + 10, 40, 30, .5); [[-22, -6, "#F4F1EA", 4], [10, 6, "#C8283A", 6]].forEach(([dx, dy, c2, n]) => { const x = X + dx, y = Y + dy; s.push(`<rect x="${f(x - 14)}" y="${f(y - 14)}" width="28" height="28" rx="5" fill="${c2}" stroke="#111" stroke-width="1.5" transform="rotate(${f(r() * 40)} ${f(x)} ${f(y)})"/>`); const pts = n === 4 ? [[-1, -1], [1, 1], [-1, 1], [1, -1]] : [[-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0]]; pts.forEach(([u, v]) => s.push(`<circle cx="${f(x + u * 7)}" cy="${f(y + v * 7)}" r="2.4" fill="${c2 === "#F4F1EA" ? "#1A1A22" : "#FFFFFF"}"/>`)); });
    [[-50, 30], [44, -36], [0, 50]].forEach(([dx, dy], k) => { const x = X + dx, y = Y + dy; K.ombre(x + 5, y + 6, 13, 13, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="${["#E5484D", "#4C8DFF", "#F2B33A"][k]}"/><circle cx="${f(x)}" cy="${f(y)}" r="7" fill="${["#FF7A7E", "#8AB4FF", "#FFD27A"][k]}"/>`); });
    s.push(`<g transform="translate(${f(X + 60)} ${f(Y + 30)})"><circle r="12" fill="#C9A24A"/><path d="M-7 -7L7 7M7 -7L-7 7" stroke="#F2E6CC" stroke-width="4"/><circle r="4" fill="#E9D3A0"/></g>`); K.prendre(X, Y, 85);
    // clins d'œil : 4 pions aux couleurs des pilotes sur la case départ, pioche « Pioche 2 », coffre
    const p0 = K.P[0], [nx, ny] = K.nrm(0); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(p0[0] + nx * 26 + k * 7)}" cy="${f(p0[1] + ny * 26)}" r="4" fill="${c2}" stroke="#111"/>`)); s.push(`<text x="${f(p0[0] + nx * 26 - 6)}" y="${f(p0[1] + ny * 26 + 14)}" font-family="Georgia" font-weight="700" font-size="8" fill="#5A3A22">DÉPART</text>`);
    K.semis(1, 16, 800, null, (x, y) => { for (let k = 0; k < 4; k++) s.push(`<rect x="${f(x - 9 + k * 2)}" y="${f(y - 12 - k * 2)}" width="18" height="26" rx="2" fill="#2E5E8C" stroke="#F4ECD8" stroke-width="1"/>`); s.push(`<text x="${f(x - 1)}" y="${f(y - 2)}" text-anchor="middle" font-family="Georgia" font-size="5.5" fill="#F4ECD8">Pioche 2</text>`); });
    K.semis(1, 14, 800, null, (x, y) => { s.push(`<rect x="${f(x - 12)}" y="${f(y - 8)}" width="24" height="16" rx="2" fill="#7A4A26" stroke="#3A2414"/><path d="M${f(x - 12)} ${f(y - 2)}h24" stroke="#E2B93B" stroke-width="2"/>`); K.halo(x, y, 24, "#F7CF55", .6); });
    // la piste : chemin de cases colorées
    K.route([["#000", 38, ` opacity=".4" filter="url(#pl-flou)"`], ["#2E2420", 30], ["#F2E6CC", 26]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#E5484D" stroke-width="22" stroke-dasharray="14 42"/><path d="${K.piste}" fill="none" stroke="#4C8DFF" stroke-width="22" stroke-dasharray="14 42" stroke-dashoffset="14"/><path d="${K.piste}" fill="none" stroke="#F2B33A" stroke-width="22" stroke-dasharray="14 42" stroke-dashoffset="28"/><path d="${K.piste}" fill="none" stroke="#2BB673" stroke-width="22" stroke-dasharray="14 42" stroke-dashoffset="42"/><path d="${K.piste}" fill="none" stroke="#2E2420" stroke-width="22" stroke-dasharray="1.5 12.5" opacity=".7"/>`);
    K.depart(); K.particules(30, "#B8F25A", 2.5, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="#1E3A20"/>`, "#2A1A3A", .22);
  }
  /* ---------- Juillet · Village du solstice (fête nordique de l'été) ---------- */
  function peindreSolstice(T, Z, def) {
    const K = kit(T, def, 71, "so-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "mai" });
    for (let k = 0; k < 9; k++) { const x = r() * W, y = r() * H, a2 = r() * 180, c2 = ["#F7D84A", "#B57BFF", "#FF8FB8", "#FFFFFF", "#6EC6FF"][k % 5]; s.push(`<g transform="rotate(${f(a2)} ${f(x)} ${f(y)})">${Array.from({ length: 7 }, (_, j) => `<rect x="${f(x - 90)}" y="${f(y - 40 + j * 12)}" width="180" height="7" rx="3" fill="${c2}" opacity=".55"/>`).join("")}</g>`); }
    // le mât fleuri (couronne et rubans qui tournent), table de banquet, feu de joie
    K.ombre(X + 6, Y + 8, 18, 18, .4); K.a.push(`<g>${["#E5484D", "#F2B33A", "#4C8DFF", "#2BB673", "#FF6FA8", "#B57BFF"].map((c2, k) => `<path d="M${f(X)} ${f(Y)}L${f(X + Math.cos(k * 1.047) * 42)} ${f(Y + Math.sin(k * 1.047) * 42)}" stroke="${c2}" stroke-width="3"/>`).join("")}${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="0 ${f(X)} ${f(Y)}" to="360 ${f(X)} ${f(Y)}" dur="20s" repeatCount="indefinite"/>` : ""}</g>`);
    s.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="12" fill="#3F9A45" stroke="#F2E6CC" stroke-width="3"/>`); for (let k = 0; k < 10; k++) s.push(`<circle cx="${f(X + Math.cos(k * .63) * 12)}" cy="${f(Y + Math.sin(k * .63) * 12)}" r="2.5" fill="${["#FFFFFF", "#F7D84A", "#FF8FB8"][k % 3]}"/>`);
    const tx = X + 80, ty = Y - 10; s.push(`<rect x="${f(tx - 50)}" y="${f(ty - 7)}" width="100" height="14" fill="#FFFFFF" stroke="#C9B8A0"/>`); for (let k = 0; k < 10; k++) s.push(`<circle cx="${f(tx - 45 + k * 10)}" cy="${f(ty)}" r="2.6" fill="${["#E5484D", "#F2B33A", "#2BB673", "#FF8FB8"][k % 4]}"/><circle cx="${f(tx - 45 + k * 10)}" cy="${f(ty + (k % 2 ? 12 : -12))}" r="4" fill="#C9A35A"/>`);
    K.halo(X - 70, Y + 30, 40, "#FF8A2B", .8); s.push(`<circle cx="${f(X - 70)}" cy="${f(Y + 30)}" r="8" fill="#5A3F2A"/>`); K.a.push(`<circle cx="${f(X - 70)}" cy="${f(Y + 30)}" r="6" fill="#FFD27A">${K.anime ? '<animate attributeName="r" values="5;8;5" dur=".8s" repeatCount="indefinite"/>' : ""}</circle>`); K.prendre(X + 20, Y, 110);
    // maisons de bois rouges aux toits verts, granges, moutons
    K.semis(40, () => 12 + r() * 8, 3000, null, (x, y, R) => { K.toit(x, y, R * 2, R * 1.4, r() < .7 ? "#B5372A" : "#E8C24A", Math.round(r() * 2) * 90, true, r() < .5); s.push(`<rect x="${f(x - R * .9)}" y="${f(y - R * .7)}" width="${f(R * 1.8)}" height="${f(R * .5)}" fill="#3F6B3A" opacity=".55"/>`); });
    K.semis(18, 4, 1500, null, (x, y) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="3" fill="#F4F1EA"/><circle cx="${f(x + 3.5)}" cy="${f(y)}" r="1.5" fill="#333"/>`));
    // clins d'œil : pique-nique avec un jeu de plateau et 4 tasses, partie de quilles en bois sur l'herbe, 4 couronnes de fleurs
    K.semis(1, 22, 800, null, (x, y) => { s.push(`<rect x="${f(x - 18)}" y="${f(y - 13)}" width="36" height="26" fill="#E5484D" opacity=".85"/>`); for (let i = 0; i < 6; i++) s.push(`<path d="M${f(x - 18 + i * 6)} ${f(y - 13)}v26M${f(x - 18)} ${f(y - 13 + i * 5)}h36" stroke="#FFFFFF" stroke-width="1" opacity=".6"/>`); s.push(`<rect x="${f(x - 8)}" y="${f(y - 6)}" width="16" height="12" fill="#2E5E8C"/>`); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(x + (k % 2 ? 14 : -14))}" cy="${f(y + (k < 2 ? -9 : 9))}" r="2.6" fill="${c2}"/>`)); });
    K.semis(1, 24, 800, null, (x, y) => { for (let k = 0; k < 5; k++) s.push(`<rect x="${f(x - 20 + k * 10)}" y="${f(y - 3)}" width="4" height="6" fill="#C9A35A"/>`); s.push(`<rect x="${f(x - 2)}" y="${f(y - 14)}" width="5" height="6" fill="#B5372A"/><rect x="${f(x - 2)}" y="${f(y + 10)}" width="4" height="6" fill="#C9A35A"/>`); });
    K.semis(4, 6, 800, null, (x, y, R, k) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="none" stroke="${COULEURS_J[k]}" stroke-width="2"/>`); for (let j = 0; j < 5; j++) s.push(`<circle cx="${f(x + Math.cos(j * 1.26) * 5)}" cy="${f(y + Math.sin(j * 1.26) * 5)}" r="1.4" fill="#FFFFFF"/>`); });
    K.semis(70, () => 11 + r() * 10, 3000, null, (x, y, R) => K.arbre(x, y, R, "#9ED36A", "#4F9A45", "#2A5A2A"));
    K.route([["#3C6A2A", 36, ` opacity=".4" filter="url(#so-flou)"`], ["#C9B48A", 28], ["#E2D2A8", 20], ["#D4C29A", 12, ` stroke-dasharray="3 6" opacity=".7"`]]);
    for (let i = 0; i < K.N; i += 6) { const [nx, ny] = K.nrm(i); [1, -1].forEach(sd => s.push(`<circle cx="${f(K.P[i][0] + nx * sd * 17)}" cy="${f(K.P[i][1] + ny * sd * 17)}" r="2.4" fill="${["#FF6FA8", "#F7D84A", "#FFFFFF", "#B57BFF"][i % 4]}"/>`)); }
    K.depart(); K.particules(50, "#FFC6E0", 2.8, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="#7FB55E"/>`, "#FFE9B0", .12);
  }
  /* ---------- Août · Monde à l'envers (petite ville des années 80) — v16.12, enrichi ---------- */
  function peindreEnvers(T, Z, def) {
    const K = kit(T, def, 82, "en-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "faille" });
    // la frontière : à gauche la ville normale au crépuscule, à droite le monde à l'envers qui la recouvre
    let bord = `M${f(W * .5)} -10`; for (let y = 0; y <= H + 20; y += 30) bord += `L${f(W * .5 + (r() - .5) * 70 + Math.sin(y / 60) * 40)} ${y}`; const envers = bord + `L${W + 10} ${H + 20}L${W + 10} -10Z`;
    s.push(`<clipPath id="en-clip"><path d="${envers}"/></clipPath>`);
    // ---- côté normal : pelouses, rues, maisons, guirlandes, école, salle d'arcade
    for (let k = 0; k < 6; k++) s.push(`<path d="M0 ${f(80 + k * 110)}H${f(W * .55)}" stroke="#3A3A3E" stroke-width="12" opacity=".8"/><path d="M0 ${f(80 + k * 110)}H${f(W * .55)}" stroke="#C9B85A" stroke-width="1" stroke-dasharray="6 8" opacity=".5"/>`);
    const maison = (x, y, R, c2, lum) => { K.toit(x, y, R * 2, R * 1.5, c2, Math.round(r()) * 90, true, true); s.push(`<rect x="${f(x - R * 1.2)}" y="${f(y + R)}" width="${f(R * 2.4)}" height="${f(R * .9)}" fill="#5A8A4A" opacity=".7"/>`); if (lum) K.halo(x, y + R * .9, R, "#FFD58A", .5); };
    K.semis(30, () => 11 + r() * 5, 4000, (x, y) => x < W * .45, (x, y, R) => maison(x, y, R, ["#7A8A9A", "#9A7A5A", "#6A7A5A", "#8A6A6A"][Math.floor(r() * 4)], r() < .6));
    // la maison aux guirlandes : ampoules de couleur qui clignotent
    K.semis(1, 22, 3000, (x, y) => x < W * .45, (x, y) => { maison(x, y, 18, "#6A5A4A", true); const n = 18; for (let k = 0; k < n; k++) { const t = k / n, px = x - 20 + 40 * t, c2 = ["#E5484D", "#2BB673", "#4C8DFF", "#F7D84A", "#FF8A3D"][k % 5]; K.a.push(`<circle cx="${f(px)}" cy="${f(y - 15 + Math.sin(t * 9) * 2)}" r="1.8" fill="${c2}">${K.anime ? `<animate attributeName="opacity" values="1;.15;1" dur="${(1 + r() * 2).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</circle>`); K.halo(px, y - 15, 5, c2, .6); } });
    K.semis(1, 34, 3000, (x, y) => x < W * .45, (x, y) => { K.toit(x, y, 70, 40, "#8A4A3A", 0, false); s.push(`<rect x="${f(x - 30)}" y="${f(y + 24)}" width="60" height="18" fill="#C9B88A"/><text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-family="Helvetica" font-weight="800" font-size="7" fill="#F4F1EA">LYCÉE</text>`); });
    K.semis(1, 18, 3000, (x, y) => x < W * .45, (x, y) => { K.toit(x, y, 40, 28, "#2E2E3A", 0, false); K.halo(x, y, 40, "#FF4FD8", .5); s.push(`<text x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" font-family="Helvetica" font-weight="900" font-size="8" fill="#22D3EE">ARCADE</text>`); });
    // clins d'œil côté normal : 4 vélos aux couleurs des pilotes, talkie-walkie, partie de jeu de rôle (dés à 20 faces, figurines) au sous-sol
    K.semis(1, 24, 2000, (x, y) => x < W * .45 && K.dT(x, y) < 70, (x, y) => COULEURS_J.forEach((c2, k) => { const bx = x + (k % 2) * 16 - 8, by = y + Math.floor(k / 2) * 12 - 6; s.push(`<g transform="rotate(${f(r() * 180)} ${f(bx)} ${f(by)})"><circle cx="${f(bx - 6)}" cy="${f(by)}" r="4" fill="none" stroke="#222" stroke-width="1.6"/><circle cx="${f(bx + 6)}" cy="${f(by)}" r="4" fill="none" stroke="#222" stroke-width="1.6"/><path d="M${f(bx - 6)} ${f(by)}l6 -4l6 4M${f(bx)} ${f(by - 4)}l0 -3" stroke="${c2}" stroke-width="2"/></g>`); }));
    K.semis(1, 20, 2000, (x, y) => x < W * .45, (x, y) => { s.push(`<rect x="${f(x - 18)}" y="${f(y - 12)}" width="36" height="24" fill="#3A2E2A" stroke="#1A1410"/><rect x="${f(x - 14)}" y="${f(y - 8)}" width="28" height="16" fill="#2E5A3A"/>`); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(x - 9 + k * 6)}" cy="${f(y - 2 + (k % 2) * 5)}" r="1.6" fill="${c2}"/>`)); s.push(`<polygon points="${f(x + 8)},${f(y - 6)} ${f(x + 12)},${f(y - 4)} ${f(x + 12)},${f(y)} ${f(x + 8)},${f(y + 2)} ${f(x + 4)},${f(y)} ${f(x + 4)},${f(y - 4)}" fill="#E5484D" stroke="#fff" stroke-width=".5"/>`); K.halo(x, y, 30, "#FFD58A", .5); });
    K.semis(140, () => 7 + r() * 8, 4000, (x, y) => x < W * .5, (x, y, R) => K.arbre(x, y, R, "#6A8A5A", "#3A5A3A", "#1F2E1F"));
    // ---- côté envers (découpé) : sol cendré, veines, lianes, arbres morts, ciel rouge, créatures
    const e = []; const sP = s.length;
    e.push(`<rect width="${W}" height="${H}" fill="#241418"/>`);
    for (let k = 0; k < 40; k++) { let x = W * .5 + r() * W * .5, y = r() * H, d = "M" + f(x) + " " + f(y); const t0 = r() * TAU; for (let j = 0; j < 7; j++) { x += Math.cos(t0 + (r() - .5)) * 34; y += Math.sin(t0 + (r() - .5)) * 34; d += "L" + f(x) + " " + f(y); } e.push(`<path d="${d}" fill="none" stroke="${r() < .5 ? "#7A1424" : "#4A2A2E"}" stroke-width="${f(1.5 + r() * 4)}" opacity=".85"/>`); }
    for (let k = 0; k < 14; k++) { const x = W * .5 + r() * W * .5, y = r() * H; e.push(`<path d="M${f(x)} ${f(y)}c${f(20 + r() * 30)} ${f(-20)} ${f(40)} ${f(20)} ${f(70 + r() * 40)} ${f((r() - .5) * 30)}" fill="none" stroke="#3A2A2C" stroke-width="5" opacity=".9"/>`); }
    for (let k = 0; k < 18; k++) { const x = W * .52 + r() * W * .45, y = r() * H, R = 11 + r() * 5; e.push(`<g opacity=".75"><rect x="${f(x - R)}" y="${f(y - R * .7)}" width="${f(R * 2)}" height="${f(R * 1.4)}" fill="#3A3238"/><path d="M${f(x - R)} ${f(y)}h${f(R * 2)}" stroke="#7A1424" stroke-width="2"/></g>`); }   // maisons en ruine, version envers
    e.push(`<radialGradient id="en-faille" r="50%"><stop offset="0" stop-color="#FF4B5C" stop-opacity=".8"/><stop offset="1" stop-color="#FF2B3D" stop-opacity="0"/></radialGradient>`);
    s.push(`<g clip-path="url(#en-clip)">` + e.filter(x => !x.startsWith("<radialGradient")).join("") + "</g>"); s.unshift(e.find(x => x.startsWith("<radialGradient")));
    s.push(`<path d="${bord}" fill="none" stroke="#C8102E" stroke-width="3" opacity=".7"/><path d="${bord}" fill="none" stroke="#FF6B7A" stroke-width="10" opacity=".2"/>`);
    K.semis(120, () => 8 + r() * 9, 4000, (x, y) => x > W * .55, (x, y, R) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .3)}" fill="#2E2226"/>`); for (let k = 0; k < 7; k++) { const t = k / 7 * TAU + r(), L = R * (.7 + r() * .5); s.push(`<path d="M${f(x)} ${f(y)}q${f(Math.cos(t + .4) * L * .6)} ${f(Math.sin(t + .4) * L * .6)} ${f(Math.cos(t) * L)} ${f(Math.sin(t) * L)}" stroke="#4A3A3C" stroke-width="2" fill="none"/>`); } });
    // la faille au monument 3D : déchirure rouge qui palpite
    s.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="110" fill="url(#en-faille)"/><path d="M${f(X - 8)} ${f(Y - 60)}l12 18l-10 14l14 16l-8 12l10 18l-12 14l-4 -26l-8 -14l8 -18l-10 -16z" fill="#1A0306" stroke="#FF4B5C" stroke-width="2.5"/>`);
    K.a.push(`<path d="M${f(X - 2)} ${f(Y - 50)}l8 16l-7 12l9 14l-6 12l7 16" fill="none" stroke="#FFB3BC" stroke-width="3">${K.anime ? '<animate attributeName="opacity" values="1;.3;1;.6;1" dur="2.2s" repeatCount="indefinite"/>' : ""}</path>`); K.prendre(X, Y, 90);
    // les créatures : silhouettes aux longs membres qui rôdent côté envers ; l'ombre géante dans le ciel rouge
    for (let k = 0; k < 4; k++) { const x = W * .6 + r() * W * .35, y = 80 + r() * (H - 160); K.a.push(`<g opacity=".85"><ellipse cx="${f(x)}" cy="${f(y)}" rx="5" ry="7" fill="#1A1014"/>${[-1, 1].map(sd => `<path d="M${f(x)} ${f(y)}l${f(sd * 10)} -6l${f(sd * 4)} 10M${f(x)} ${f(y + 4)}l${f(sd * 8)} 8" stroke="#1A1014" stroke-width="2" fill="none"/>`).join("")}${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 120)} ${f((r() - .5) * 80)};0 0" dur="${(14 + r() * 10).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    K.a.push(`<g opacity=".28"><ellipse cx="${f(W * .8)}" cy="${f(H * .2)}" rx="60" ry="40" fill="#1A0408"/>${[0, 1, 2, 3, 4, 5].map(q => `<path d="M${f(W * .8 - 40 + q * 16)} ${f(H * .2 + 20)}q${f((r() - .5) * 40)} 80 ${f((r() - .5) * 60)} 180" stroke="#1A0408" stroke-width="7" fill="none"/>`).join("")}${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;-40 20;0 0" dur="20s" repeatCount="indefinite"/>` : ""}</g>`);
    // le labo au grillage et son projecteur
    K.semis(1, 50, 2000, (x, y) => x > W * .6, (x, y) => { s.push(`<rect x="${f(x - 46)}" y="${f(y - 34)}" width="92" height="68" fill="none" stroke="#9AA3AE" stroke-width="1.5" stroke-dasharray="3 3"/>`); K.toit(x, y, 60, 40, "#6E747D", 0, false); s.push(`<text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-family="Helvetica" font-size="8" font-weight="700" fill="#2B2E33">LABO 4</text>`); K.a.push(`<path d="M${f(x + 30)} ${f(y - 20)}l120 -40l10 30z" fill="#FFF6D0" opacity=".12">${K.anime ? `<animateTransform attributeName="transform" type="rotate" values="-20 ${f(x + 30)} ${f(y - 20)};25 ${f(x + 30)} ${f(y - 20)};-20 ${f(x + 30)} ${f(y - 20)}" dur="7s" repeatCount="indefinite"/>` : ""}</path>`); });
    K.route([["#000", 38, ` opacity=".6" filter="url(#en-flou)"`], ["#3A3438", 28], ["#2C2E33", 22], ["#C9B85A", 1.2, ` stroke-dasharray="8 10" opacity=".6"`]]);
    for (let k = 0; k < 50; k++) { const i = Math.floor(r() * K.N); if (K.P[i][0] < W * .5) continue; const [nx, ny] = K.nrm(i), o = (r() - .5) * 18; s.push(`<path d="M${f(K.P[i][0] + nx * o)} ${f(K.P[i][1] + ny * o)}l${f((r() - .5) * 12)} ${f((r() - .5) * 12)}l${f((r() - .5) * 8)} ${f((r() - .5) * 8)}" stroke="#C8102E" stroke-width="1.2" opacity=".85"/>`); }
    K.depart();
    for (let k = 0; k < 60; k++) { const x = W * .5 + r() * W * .5, y = r() * H, d = (6 + r() * 6).toFixed(1); K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 1.6)}" fill="#D9C8CC" opacity=".6">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 20)} -50" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</circle>`); }
    return K.fin(`<rect width="${W}" height="${H}" fill="#3A4A3A"/>`, "#2A0A18", .22);
  }
  /* ---------- Septembre · Ville des survivants (monde post-apocalyptique) ---------- */
  function peindreSurvivants(T, Z, def) {
    const K = kit(T, def, 91, "sv-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "champignons", y: 95 });
    for (let x = 30; x < W; x += 120) s.push(`<path d="M${x} 0V${H}" stroke="#4A4A45" stroke-width="16" opacity=".5"/>`); for (let y = 40; y < H; y += 120) s.push(`<path d="M0 ${y}H${W}" stroke="#4A4A45" stroke-width="16" opacity=".5"/>`);
    for (let k = 0; k < 120; k++) { const x = r() * W, y = r() * H; s.push(`<path d="M${f(x)} ${f(y)}l${f((r() - .5) * 18)} ${f((r() - .5) * 18)}l${f((r() - .5) * 14)} ${f((r() - .5) * 14)}" stroke="#2A2C28" stroke-width="1.2" opacity=".6"/>`); }
    // champignons géants qui luisent (monument 3D) sur des ruines
    [[0, 0, 30], [-36, 22, 20], [34, 18, 24], [10, -34, 16], [-28, -24, 13]].forEach(([dx, dy, R], k) => { const x = X + dx, y = Y + dy, c2 = ["#C2412D", "#5FB3A1", "#D9822B", "#9D6AD8", "#5FB3A1"][k]; K.ombre(x + R * .3, y + R * .4, R, R, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="${c2}" stroke="#1A1A1A" stroke-opacity=".4" stroke-width="2"/>`); for (let j = 0; j < 5; j++) s.push(`<circle cx="${f(x + Math.cos(j * 1.3 + k) * R * .55)}" cy="${f(y + Math.sin(j * 1.3 + k) * R * .55)}" r="${f(R * .13)}" fill="#FFF6E0"/>`); K.halo(x, y, R * 2.2, c2, .35, K.a); }); K.prendre(X, Y, 80);
    // immeubles en ruine (toits percés, mousse), voitures rouillées couvertes de lierre, cerf
    K.semis(55, () => 14 + r() * 14, 4000, null, (x, y, R) => { const w = R * 2, h = R * 1.6; K.toit(x, y, w, h, "#6E6A62", Math.round(r()) * 90, false); s.push(`<polygon points="${f(x - w * .2)},${f(y - h * .1)} ${f(x + w * .15)},${f(y - h * .3)} ${f(x + w * .2)},${f(y + h * .2)} ${f(x - w * .1)},${f(y + h * .25)}" fill="#1E1E1C"/><circle cx="${f(x + w * .3)}" cy="${f(y - h * .3)}" r="${f(R * .4)}" fill="#4F7A3A" opacity=".8"/><circle cx="${f(x - w * .35)}" cy="${f(y + h * .3)}" r="${f(R * .3)}" fill="#5F8A42" opacity=".8"/>`); });
    K.semis(16, 10, 2000, null, (x, y) => s.push(`<g transform="rotate(${f(r() * 360)} ${f(x)} ${f(y)})"><rect x="${f(x - 12)}" y="${f(y - 6)}" width="24" height="12" rx="3" fill="#7A4A2E"/><rect x="${f(x - 6)}" y="${f(y - 5)}" width="10" height="10" fill="#3A2A20"/><circle cx="${f(x + 6)}" cy="${f(y + 2)}" r="4" fill="#4F7A3A" opacity=".85"/></g>`));
    K.semis(3, 5, 1000, null, (x, y) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="6" ry="3" fill="#8A6A48"/><circle cx="${f(x + 6)}" cy="${f(y - 2)}" r="2" fill="#8A6A48"/><path d="M${f(x + 7)} ${f(y - 4)}l2 -4M${f(x + 6)} ${f(y - 4)}l-2 -4" stroke="#5A4030"/>`));
    // le camp des survivants : tentes, feu, tour de guet, palissade ; clins d'œil : jeu sur une caisse (4 pions), guitare, tag T·K·C·D
    K.semis(1, 55, 2000, null, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="52" fill="none" stroke="#6B4A30" stroke-width="5" stroke-dasharray="4 2"/>`); [[-24, -18], [22, -20], [-22, 20]].forEach(([a2, b]) => s.push(`<polygon points="${f(x + a2 - 12)},${f(y + b + 8)} ${f(x + a2)},${f(y + b - 10)} ${f(x + a2 + 12)},${f(y + b + 8)}" fill="#6E7A52" stroke="#3A4230"/>`));
      K.halo(x, y, 36, "#FF8A2B", .8); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="#4A3626"/>`); K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#FFD27A">${K.anime ? '<animate attributeName="r" values="3;6;3" dur=".7s" repeatCount="indefinite"/>' : ""}</circle>`);
      s.push(`<rect x="${f(x + 18)}" y="${f(y + 10)}" width="14" height="10" fill="#8A6A48" stroke="#4A3626"/>`); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(x + 21 + k * 2.7)}" cy="${f(y + 15)}" r="1.4" fill="${c2}"/>`));
      s.push(`<path d="M${f(x - 10)} ${f(y + 22)}l14 6" stroke="#8A5A2E" stroke-width="3"/><ellipse cx="${f(x - 12)}" cy="${f(y + 21)}" rx="4" ry="3" fill="#8A5A2E"/>`); s.push(`<rect x="${f(x + 34)}" y="${f(y - 38)}" width="12" height="12" fill="#5A4030" stroke="#2E2014"/>`); K.prendre(x, y, 60); });
    K.semis(1, 20, 1500, (x, y) => K.dT(x, y) < 70, (x, y) => s.push(`<text x="${f(x)}" y="${f(y)}" font-family="Impact, Helvetica" font-size="13" fill="#E5484D" opacity=".75" transform="rotate(-8 ${f(x)} ${f(y)})">T·K·C·D</text>`));
    K.semis(140, () => 8 + r() * 10, 4000, null, (x, y, R) => K.arbre(x, y, R, "#7FA85A", "#3F6B32", "#1F3A1A"));
    K.route([["#000", 36, ` opacity=".5" filter="url(#sv-flou)"`], ["#55574F", 28], ["#45473F", 22]]);
    for (let k = 0; k < 60; k++) { const i = Math.floor(r() * K.N), [nx, ny] = K.nrm(i), o = (r() - .5) * 18; s.push(`<path d="M${f(K.P[i][0] + nx * o)} ${f(K.P[i][1] + ny * o)}l${f((r() - .5) * 12)} ${f((r() - .5) * 12)}" stroke="${r() < .5 ? "#6B8A42" : "#25261F"}" stroke-width="${r() < .5 ? 2.5 : 1}"/>`); }
    K.depart(); K.particules(60, "#D9E8A0", 2.4, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="#3A4232"/>`, "#3A3A1A", .2);
  }
  /* ---------- Octobre · Mer de dunes (désert, ver géant, épice) ---------- */
  function peindreDunes(T, Z, def) {
    const K = kit(T, def, 101, "du-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "ver", y: 122 });
    for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H, L = 80 + r() * 160, c2 = r() < .5 ? "#E8C48A" : "#B98A50"; s.push(`<path d="M${f(x)} ${f(y)}q${f(L / 2)} ${f(-14 - r() * 18)} ${f(L)} 0" fill="none" stroke="${c2}" stroke-width="${f(3 + r() * 5)}" opacity=".55"/><path d="M${f(x)} ${f(y + 4)}q${f(L / 2)} ${f(-10 - r() * 14)} ${f(L)} 0" fill="none" stroke="#9A6A38" stroke-width="2" opacity=".35"/>`); }
    // le ver qui sort du sable : gueule ronde, dents, gerbe de sable
    for (let k = 0; k < 18; k++) { const t = k / 18 * TAU; s.push(`<ellipse cx="${f(X + Math.cos(t) * 52)}" cy="${f(Y + Math.sin(t) * 46)}" rx="10" ry="6" fill="#D9AE70" transform="rotate(${f(t * 57.3)} ${f(X + Math.cos(t) * 52)} ${f(Y + Math.sin(t) * 46)})"/>`); }
    s.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="36" fill="#8A6A4A"/><circle cx="${f(X)}" cy="${f(Y)}" r="30" fill="#6E5238"/><circle cx="${f(X)}" cy="${f(Y)}" r="22" fill="#3A1414"/>`);
    for (let k = 0; k < 16; k++) { const t = k / 16 * TAU; s.push(`<path d="M${f(X + Math.cos(t) * 22)} ${f(Y + Math.sin(t) * 22)}L${f(X + Math.cos(t + .1) * 13)} ${f(Y + Math.sin(t + .1) * 13)}L${f(X + Math.cos(t + .2) * 22)} ${f(Y + Math.sin(t + .2) * 22)}z" fill="#F2E8D2"/>`); }
    K.a.push(`<circle cx="${f(X)}" cy="${f(Y)}" r="40" fill="none" stroke="#E8C48A" stroke-width="3" opacity=".6">${K.anime ? '<animate attributeName="r" values="40;70" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="2.4s" repeatCount="indefinite"/>' : ""}</circle>`); K.prendre(X, Y, 80);
    // la moissonneuse d'épice, l'avant-poste aux dômes, les rochers, l'oasis
    K.semis(1, 30, 1500, null, (x, y) => { K.ombre(x + 8, y + 10, 30, 18, .5); s.push(`<rect x="${f(x - 28)}" y="${f(y - 14)}" width="56" height="28" rx="4" fill="#8E7E62" stroke="#3A3226" stroke-width="2"/><rect x="${f(x - 28)}" y="${f(y + 10)}" width="56" height="6" fill="#3A3226"/><rect x="${f(x - 28)}" y="${f(y - 16)}" width="56" height="6" fill="#3A3226"/>`); K.halo(x + 34, y, 30, "#E8A050", .6); });
    K.semis(1, 50, 1500, null, (x, y) => { [[0, 0, 18], [-26, 10, 11], [24, 12, 12], [6, -24, 9]].forEach(([a2, b, R]) => { K.ombre(x + a2 + 4, y + b + 5, R, R, .45); s.push(`<circle cx="${f(x + a2)}" cy="${f(y + b)}" r="${R}" fill="#E9DCC4" stroke="#B99E78" stroke-width="1.5"/><circle cx="${f(x + a2 - R * .3)}" cy="${f(y + b - R * .3)}" r="${f(R * .4)}" fill="#FFFFFF" opacity=".35"/>`); }); s.push(`<path d="M${f(x + 38)} ${f(y - 20)}v-16M${f(x + 46)} ${f(y - 18)}v-14" stroke="#7A6450" stroke-width="2.5"/>`); });
    K.semis(1, 34, 1500, null, (x, y) => { s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="30" ry="20" fill="#2F8FA8"/>`); for (let k = 0; k < 7; k++) { const t = k / 7 * TAU; K.arbre(x + Math.cos(t) * 34, y + Math.sin(t) * 26, 8, "#7FB55E", "#3F7A3A", "#1F4A2A"); } });
    K.semis(25, () => 8 + r() * 16, 2000, null, (x, y, R) => { K.ombre(x + R * .3, y + R * .3, R, R * .8, .4); s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(R)}" ry="${f(R * .75)}" fill="#8A6A48" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`); });
    // clins d'œil : table de stratégie (plateau, cartes, 4 agents aux couleurs des pilotes), 4 traces de pas, tambour planté dans le sable
    K.semis(1, 22, 1500, null, (x, y) => { s.push(`<rect x="${f(x - 20)}" y="${f(y - 14)}" width="40" height="28" fill="#5A3A22" stroke="#2E1E12" stroke-width="2"/><rect x="${f(x - 16)}" y="${f(y - 10)}" width="32" height="20" fill="#C9A35A"/>`); COULEURS_J.forEach((c2, k) => s.push(`<rect x="${f(x - 12 + k * 7)}" y="${f(y - 3 + (k % 2) * 4)}" width="3" height="5" fill="${c2}"/>`)); [[-26, -6], [-25, 4]].forEach(([a2, b]) => s.push(`<rect x="${f(x + a2)}" y="${f(y + b)}" width="5" height="7" fill="#F4ECD8"/>`)); });
    COULEURS_J.forEach((c2, k) => { let x = 80 + r() * (W - 160), y = 80 + r() * (H - 160); const t = r() * TAU; for (let j = 0; j < 7; j++) { x += Math.cos(t) * 10; y += Math.sin(t) * 10; s.push(`<ellipse cx="${f(x + (j % 2) * 3)}" cy="${f(y)}" rx="1.6" ry="2.6" fill="${c2}" opacity=".55"/>`); } });
    K.semis(1, 8, 800, null, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#5A4A3A" stroke="#2E2014"/>`); K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="none" stroke="#7A5A3A" stroke-width="1.5">${K.anime ? '<animate attributeName="r" values="6;26" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.2s" repeatCount="indefinite"/>' : ""}</circle>`); });
    K.route([["#7A5530", 34, ` opacity=".45" filter="url(#du-flou)"`], ["#C9A06A", 26], ["#D9B47E", 20]]);
    for (let i = 0; i < K.N; i += 24) { const [nx, ny] = K.nrm(i), sd = (i / 24) % 2 ? 1 : -1; s.push(`<path d="M${f(K.P[i][0] + nx * sd * 17)} ${f(K.P[i][1] + ny * sd * 17)}l0 -9l7 3l-7 3" fill="#D9472B" stroke="#5A3A22" stroke-width="1"/>`); }
    K.depart(); K.particules(80, "#E8A050", 2.2, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="#D7AD72"/>`, "#C86A28", .15);
  }
  /* ---------- Novembre · Mur des titans (cité fortifiée) ---------- */
  function peindreTitans(T, Z, def) {
    const K = kit(T, def, 111, "ti-"), { s, r, f, W, H } = K, zm = (T.cz - T.rz - 62) * KU, ep = 26;
    // au-delà du mur : terres sauvages et empreintes de géants
    s.push(`<rect x="0" y="0" width="${W}" height="${f(zm - ep / 2)}" fill="#5A5A42"/>`); for (let k = 0; k < 8; k++) { const x = r() * W, y = r() * (zm - 40); s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="14" ry="26" fill="#3E3E2C" transform="rotate(${f((r() - .5) * 40)} ${f(x)} ${f(y)})"/>`); for (let j = 0; j < 4; j++) s.push(`<circle cx="${f(x - 9 + j * 6)}" cy="${f(y - 28)}" r="4" fill="#3E3E2C"/>`); }
    // le mur : pierre massive, créneaux, contreforts, portail, canons et torches
    K.ombre(W / 2, zm + 18, W, 14, .6); s.push(`<rect x="-10" y="${f(zm - ep / 2)}" width="${W + 20}" height="${ep}" fill="#8F8676" stroke="#5A5246" stroke-width="3"/>`);
    for (let x = 0; x < W; x += 14) s.push(`<rect x="${x}" y="${f(zm - ep / 2 - 2)}" width="8" height="6" fill="#776F61"/>`);
    for (let x = 40; x < W; x += 90) { s.push(`<rect x="${x - 10}" y="${f(zm + ep / 2)}" width="20" height="12" fill="#776F61"/><rect x="${x - 3}" y="${f(zm - 4)}" width="14" height="5" rx="2" fill="#2B2E33"/>`); K.halo(x, zm + ep / 2 + 10, 18, "#FF9A3D", .8); }
    const gx = W / 2; s.push(`<rect x="${f(gx - 22)}" y="${f(zm - ep / 2)}" width="44" height="${ep}" fill="#3B3128"/><path d="M${f(gx - 22)} ${f(zm)}h44" stroke="#5A4A3A" stroke-width="2"/>`); K.prendre(gx, zm, 30);
    // la ville : toits serrés, clocher, champs, terrain d'entraînement aux poteaux
    K.semis(130, () => 10 + r() * 8, 6000, (x, y) => y > zm + 40, (x, y, R) => K.toit(x, y, R * 2, R * 1.4, ["#8C3B2E", "#7A4A3A", "#A0563E", "#5A4A42"][Math.floor(r() * 4)], Math.round(r()) * 90 + (r() - .5) * 20, true, r() < .4));
    K.semis(1, 14, 1000, (x, y) => y > zm + 40, (x, y) => { s.push(`<rect x="${f(x - 10)}" y="${f(y - 10)}" width="20" height="20" fill="#6E6A62"/><polygon points="${f(x - 10)},${f(y - 10)} ${f(x + 10)},${f(y - 10)} ${f(x)},${f(y)}" fill="#4A4F57"/><polygon points="${f(x + 10)},${f(y + 10)} ${f(x - 10)},${f(y + 10)} ${f(x)},${f(y)}" fill="#3A3F47"/>`); });
    K.semis(8, 26, 2000, (x, y) => y > zm + 40, (x, y) => s.push(`<g transform="rotate(${f(r() * 40 - 20)} ${f(x)} ${f(y)})">${Array.from({ length: 6 }, (_, j) => `<rect x="${f(x - 26)}" y="${f(y - 18 + j * 6)}" width="52" height="4" fill="${j % 2 ? "#B9A04E" : "#8DB255"}"/>`).join("")}</g>`));
    K.semis(1, 30, 1500, (x, y) => y > zm + 40, (x, y) => { s.push(`<rect x="${f(x - 28)}" y="${f(y - 20)}" width="56" height="40" fill="#A08A62" opacity=".6"/>`); for (let k = 0; k < 8; k++) s.push(`<rect x="${f(x - 22 + (k % 4) * 14)}" y="${f(y - 12 + Math.floor(k / 4) * 20)}" width="4" height="4" fill="#5A4030"/>`); });
    // clins d'œil : 4 capes aux couleurs des pilotes qui sèchent sur un fil, table de guerre avec la carte et ses figurines, échiquier
    K.semis(1, 20, 1500, (x, y) => y > zm + 40, (x, y) => { s.push(`<path d="M${f(x - 22)} ${f(y)}h44" stroke="#5A4030" stroke-width="1.2"/>`); COULEURS_J.forEach((c2, k) => s.push(`<path d="M${f(x - 18 + k * 11)} ${f(y)}l-3 12h9z" fill="${c2}"/>`)); });
    K.semis(1, 18, 1500, (x, y) => y > zm + 40, (x, y) => { s.push(`<rect x="${f(x - 18)}" y="${f(y - 12)}" width="36" height="24" fill="#6B4A30"/><rect x="${f(x - 15)}" y="${f(y - 9)}" width="30" height="18" fill="#D9C79A"/><path d="M${f(x - 12)} ${f(y - 4)}q8 -4 14 2t12 0" stroke="#8A6A48" fill="none"/>`); COULEURS_J.forEach((c2, k) => s.push(`<circle cx="${f(x - 9 + k * 6)}" cy="${f(y + 3)}" r="1.8" fill="${c2}"/>`)); });
    K.semis(1, 10, 1500, (x, y) => y > zm + 40, (x, y) => { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) s.push(`<rect x="${f(x - 9 + i * 3)}" y="${f(y - 9 + j * 3)}" width="3" height="3" fill="${(i + j) % 2 ? "#2B2B30" : "#D9D2C2"}"/>`); });
    K.semis(70, () => 8 + r() * 8, 3000, (x, y) => y > zm + 30, (x, y, R) => K.arbre(x, y, R, "#8DB25A", "#4F7A3A", "#2A4A22"));
    K.route([["#000", 36, ` opacity=".4" filter="url(#ti-flou)"`], ["#7A6448", 28], ["#9A8058", 20], ["#7A6448", 6, ` stroke-dasharray="2 8" opacity=".6"`]]);
    for (const sd of [1, -1]) { const d = "M" + K.P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 17) + " " + f(p[1] + ny * sd * 17); }).join("L") + "Z"; s.push(`<path d="${d}" fill="none" stroke="#5A4030" stroke-width="2" stroke-dasharray="10 4"/>`); }
    K.depart(); K.particules(60, "#FFB070", 2.2, "monte");
    return K.fin(`<rect width="${W}" height="${H}" fill="#7A8058"/>`, "#3A2A20", .22);
  }
  /* ---------- Décembre · Sommet des dieux (mythologie, finale) ---------- */
  function peindreOlympe(T, Z, def) {
    const K = kit(T, def, 121, "ol-"), { s, r, f, W, H } = K, [X, Y] = K.rep({ t: "temple" }); let i1 = 0;
    // la montagne : courbes de niveau autour du sommet
    for (let k = 9; k >= 0; k--) { const R = 40 + k * 46, c2 = mixHex("#8A8070", "#E9E2D2", 1 - k / 9); s.push(`<ellipse cx="${f(X)}" cy="${f(Y)}" rx="${f(R * 1.25)}" ry="${f(R)}" fill="${c2}" stroke="#7A7062" stroke-opacity=".35"/>`); }
    // le temple de marbre : colonnes, fronton doré, escalier, braseros
    i1 = s.length; K.ombre(X + 8, Y + 10, 48, 30, .5); s.push(`<rect x="${f(X - 46)}" y="${f(Y - 28)}" width="92" height="56" fill="#F1EBDD" stroke="#C9BFA8" stroke-width="2"/><rect x="${f(X - 38)}" y="${f(Y - 20)}" width="76" height="40" fill="#E2D8C2"/>`);
    for (let k = 0; k < 8; k++) [Y - 24, Y + 24].forEach(y => s.push(`<circle cx="${f(X - 38 + k * 10.8)}" cy="${f(y)}" r="3.4" fill="#FFFFFF" stroke="#B9AE96"/>`));
    s.push(`<path d="M${f(X - 40)} ${f(Y)}h80" stroke="#F2B33A" stroke-width="3"/><rect x="${f(X - 12)}" y="${f(Y + 28)}" width="24" height="30" fill="#F7CF55" opacity=".85"/>`); for (let k = 0; k < 6; k++) s.push(`<path d="M${f(X - 12)} ${f(Y + 32 + k * 5)}h24" stroke="#C9A24A"/>`);
    [[-54, -30], [54, -30]].forEach(([a2, b]) => { K.halo(X + a2, Y + b, 26, "#FF9A3D", .9, K.a); s.push(`<circle cx="${f(X + a2)}" cy="${f(Y + b)}" r="4" fill="#5A4A3A"/>`); });
    // clin d'œil : 4 trônes aux couleurs des pilotes autour d'un plateau de jeu sur l'autel
    s.push(`<rect x="${f(X - 9)}" y="${f(Y - 7)}" width="18" height="14" fill="#2E5E8C" stroke="#F2B33A"/>`); COULEURS_J.forEach((c2, k) => { const t = k * 1.57 + .78; s.push(`<rect x="${f(X + Math.cos(t) * 20 - 4)}" y="${f(Y + Math.sin(t) * 14 - 4)}" width="8" height="8" rx="1.5" fill="${c2}" stroke="#F2B33A" stroke-width="1"/>`); });
    const gt = s.splice(i1).filter(x => !x.startsWith("<radialGradient")); s.push(`<g transform="translate(${f(X)} ${f(Y)}) scale(1.5) translate(${f(-X)} ${f(-Y)})">` + gt.join("") + "</g>");
    K.halo(X, Y, 120, "#FFE6A0", .35); K.prendre(X, Y, 120);
    // statues, oliviers, couronnes de laurier, nuages qui passent, éclairs
    K.semis(10, 6, 2000, null, (x, y) => { K.ombre(x + 3, y + 3, 6, 6, .4); s.push(`<rect x="${f(x - 5)}" y="${f(y - 5)}" width="10" height="10" fill="#D9D0BC"/><circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="#F4F0E6"/>`); });
    K.semis(90, () => 7 + r() * 7, 3000, null, (x, y, R) => K.arbre(x, y, R, "#A7B27A", "#6E7A4A", "#3E4A2A"));
    K.semis(3, 8, 1000, null, (x, y, R, k) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="none" stroke="#6E8A3A" stroke-width="2.5" stroke-dasharray="2 1.5"/>`); });
    for (let k = 0; k < 7; k++) { const x = r() * W, y = r() * H, d = (25 + r() * 25).toFixed(0); K.a.push(`<g opacity=".75">${[0, 1, 2, 3].map(j => `<circle cx="${f(x + (j - 1.5) * 18)}" cy="${f(y + (j % 2) * 6)}" r="${f(16 + r() * 8)}" fill="#FFFFFF"/>`).join("")}${K.anime ? `<animateTransform attributeName="transform" type="translate" values="-60 0;${W + 60 - x} 0" dur="${d}s" begin="-${(r() * +d).toFixed(0)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    K.a.push(`<path d="M${f(X + 120)} ${f(Y - 140)}l-16 40l14 0l-20 50" fill="none" stroke="#FFF6B0" stroke-width="3" opacity="0">${K.anime ? '<animate attributeName="opacity" values="0;0;0;1;0;1;0" dur="6s" repeatCount="indefinite"/>' : ""}</path>`);
    // la route de marbre à bordures dorées (en relief : ombre portée plus marquée)
    K.route([["#000", 44, ` opacity=".45" filter="url(#ol-flou)"`], ["#C9A24A", 30], ["#F4F0E6", 24], ["#E6DFCF", 14]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#F2B33A" stroke-width="27" stroke-dasharray="3 9" opacity=".8"/>`);
    K.depart(); K.particules(40, "#FFE6A0", 2.5, "scintille");
    return K.fin(`<rect width="${W}" height="${H}" fill="#8A8070"/>`, "#FFE9B0", .1);
  }
  /* ---------- Juin · La Cité des toits (ville de la Renaissance, confrérie encapuchonnée) ---------- */
  function peindreCite(T, Z, def) {
    const K = kit(T, def, 61, "ac-"), { s, r, f, W, H } = K;
    s.push(`<pattern id="ac-tuile" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="4" fill="#C4683A"/><path d="M0 3.5h6" stroke="#9A4A28" stroke-width=".8"/><path d="M3 0v3.5" stroke="#B05A32" stroke-width=".5"/></pattern>`);
    s.push(`<pattern id="ac-tuile2" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="4" fill="#B5563A"/><path d="M0 3.5h6" stroke="#8A3E26" stroke-width=".8"/></pattern>`);
    s.push(`<pattern id="ac-pave" width="7" height="5" patternUnits="userSpaceOnUse"><rect width="7" height="5" fill="#8E8270"/><rect x=".5" y=".5" width="6" height="4" rx="1" fill="#A89A84"/></pattern>`);
 s.push(`<pattern id="ac-pave2" width="9" height="6" patternUnits="userSpaceOnUse"><rect width="9" height="6" fill="#5E5244"/><rect x=".6" y=".6" width="7.8" height="4.8" rx="1.2" fill="#6E604E"/></pattern>`);
    s.push(`<linearGradient id="ac-fleuve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E6E7A"/><stop offset="1" stop-color="#4A8E8A"/></linearGradient>`);
    // le fleuve au nord, ses quais et les galions
    s.push(`<rect x="0" y="0" width="${W}" height="62" fill="url(#ac-fleuve)"/><rect x="0" y="58" width="${W}" height="8" fill="#9A8A70"/>`);
    for (let k = 0; k < 12; k++) s.push(`<path d="M${f(r() * W)} ${f(10 + r() * 40)}q10 -3 20 0" stroke="#BFE4E8" stroke-width="1" fill="none" opacity=".6"/>`);
    [[150, 26], [470, 32], [820, 22]].forEach(([x, y], k) => { K.a.push(`<g><g transform="rotate(${k % 2 ? 4 : -3} ${x} ${y})"><path d="M${x - 34} ${y}q4 -11 34 -12q30 1 34 12q-4 11 -34 12q-30 -1 -34 -12z" fill="#5A3A22" stroke="#2E1E12" stroke-width="1.5"/><path d="M${x - 26} ${y}h52" stroke="#3A2414" stroke-width="2"/>${[-16, 0, 16].map(d => `<rect x="${x + d - 1.5}" y="${y - 12}" width="3" height="24" fill="#E9DFC6" opacity=".9"/>`).join("")}</g>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${k % 2 ? -30 : 30} 0;0 0" dur="${24 + k * 6}s" repeatCount="indefinite"/>` : ""}</g>`); });
    for (let x = 30; x < W; x += 140) s.push(`<rect x="${x}" y="40" width="40" height="22" fill="#7A6A52"/>`);
    // les îlots de la ville : toits de tuiles serrés, cours intérieures, cheminées, cordes à linge
    const blocs = [];
    for (let bx = -20; bx < W + 20; bx += 50 + Math.floor(r() * 3) * 6) for (let by = 72; by < H + 20; by += 44 + Math.floor(r() * 3) * 6) {
      const w = 34 + r() * 22, h = 28 + r() * 20, x = bx + 26 + (r() - .5) * 10, y = by + 24 + (r() - .5) * 10;
      if (K.dT(x, y) < Math.max(w, h) * .55 + 16) continue;
      blocs.push([x, y, w, h]);
    }
    const marches = [];
    blocs.forEach(([x, y, w, h], i) => {
      if (r() < .08 && marches.length < 5) { marches.push([x, y, w, h]); return; }   // places
      const rot = (r() - .5) * 10; s.push(`<g transform="rotate(${f(rot)} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2 + 3)}" y="${f(y - h / 2 + 5)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".45"/>`);
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) { const ww = w / n, xx = x - w / 2 + k * ww, tu = r() < .5 ? "ac-tuile" : "ac-tuile2";
        s.push(`<rect x="${f(xx)}" y="${f(y - h / 2)}" width="${f(ww - .6)}" height="${f(h)}" fill="url(#${tu})"/><rect x="${f(xx)}" y="${f(y - h / 2)}" width="${f(ww - .6)}" height="${f(h / 2)}" fill="#FFE2B0" opacity=".12"/><path d="M${f(xx)} ${f(y)}h${f(ww - .6)}" stroke="#6A2A16" stroke-width="1.2"/>`);
        if (r() < .5) s.push(`<rect x="${f(xx + ww * .3)}" y="${f(y - h * .35)}" width="4" height="4" fill="#7A5A48"/>`); }
      if (r() < .3) s.push(`<rect x="${f(x + w / 2 - w * .35)}" y="${f(y + h / 2 - h * .4)}" width="${f(w * .35)}" height="${f(h * .4)}" fill="url(#ac-tuile2)" stroke="#6A2A16" stroke-width=".6"/>`);
      if (r() < .12) { s.push(`<rect x="${f(x - w * .18)}" y="${f(y - h * .18)}" width="${f(w * .36)}" height="${f(h * .36)}" fill="#C9BA9A"/>`); K.arbre(x, y, 5, "#8DB25A", "#4F7A3A", "#2A4A22"); }
      s.push("</g>");
      if (r() < .3 && i + 1 < blocs.length) { const b2 = blocs[i + 1]; if (Math.abs(b2[0] - x) < 70 && Math.abs(b2[1] - y) < 70) { s.push(`<path d="M${f(x)} ${f(y + h / 2 - 3)}L${f(b2[0])} ${f(b2[1] - b2[3] / 2 + 3)}" stroke="#4A3A2A" stroke-width=".8"/>`); for (let q = 1; q < 5; q++) { const t = q / 5; s.push(`<rect x="${f(x + (b2[0] - x) * t - 2)}" y="${f(y + h / 2 - 3 + (b2[1] - b2[3] / 2 + 3 - y - h / 2 + 3) * t)}" width="4" height="5" fill="${["#E9DFC6", "#C8283A", "#4C8DFF", "#F2B33A"][q % 4]}"/>`); } } }
      if (r() < .25) for (let q = 0; q < 3; q++) s.push(`<circle cx="${f(x - w / 3 + r() * w * .6)}" cy="${f(y - h / 3 + r() * h * .6)}" r="1.2" fill="#E9E6E0"/>`);   // pigeons
    });
    // les places : pavés, fontaine, étals aux auvents colorés, foule, gardes
    marches.forEach(([x, y, w, h], k) => { s.push(`<rect x="${f(x - w / 2 - 4)}" y="${f(y - h / 2 - 4)}" width="${f(w + 8)}" height="${f(h + 8)}" fill="url(#ac-pave)"/>`);
      if (k % 2) { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="#C9C0AA" stroke="#8E8270" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#5AA8B8"/>`); K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#E8F8FF">${K.anime ? '<animate attributeName="r" values="1.5;4;1.5" dur="1.4s" repeatCount="indefinite"/>' : ""}</circle>`); }
      else for (let q = 0; q < 4; q++) { const sx = x - w / 2 + 6 + (q % 2) * (w - 20), sy = y - h / 2 + 6 + Math.floor(q / 2) * (h - 18); s.push(`<rect x="${f(sx)}" y="${f(sy)}" width="14" height="10" fill="${["#C8283A", "#2E6E9A", "#E8B43A", "#3E8E5A"][q]}"/>${[0, 1, 2].map(z => `<path d="M${f(sx + z * 5)} ${f(sy)}v10" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`).join("")}`); }
      for (let q = 0; q < 14; q++) s.push(`<circle cx="${f(x - w / 2 + r() * w)}" cy="${f(y - h / 2 + r() * h)}" r="1.6" fill="${["#7A3A2A", "#3A4A6A", "#5A5A3A", "#8A6A4A", "#E9DFC6"][q % 5]}"/>`);
      [[x - w / 2 - 2, y], [x + w / 2 + 2, y]].forEach(([gx, gy]) => s.push(`<circle cx="${f(gx)}" cy="${f(gy)}" r="2.4" fill="#C8283A" stroke="#E2B93B" stroke-width=".8"/><path d="M${f(gx)} ${f(gy)}l6 -8" stroke="#9AA3AE" stroke-width="1"/>`)); });
    // la cathédrale au grand dôme et son campanile de marbre
    const placeLibre = (R) => { let best = null; for (let e = 0; e < 3000; e++) { const x = 80 + r() * (W - 160), y = 110 + r() * (H - 190); if (K.libre(x, y, R, 10) && (!best || K.dT(x, y) > K.dT(best[0], best[1]))) best = [x, y]; } return best || [W / 2, H / 2]; };
    const [dx, dy] = placeLibre(80); s.push(`<g transform="translate(${f(dx)} ${f(dy)}) scale(1.35) translate(${f(-dx)} ${f(-dy)})">`);
    s.push(`<rect x="${f(dx - 70)}" y="${f(dy - 34)}" width="140" height="68" fill="url(#ac-pave)"/><rect x="${f(dx - 58)}" y="${f(dy - 20)}" width="80" height="40" fill="#E9E1D0" stroke="#9A8A70"/>`);
    for (let k = 0; k < 7; k++) s.push(`<path d="M${f(dx - 58 + k * 13)} ${f(dy - 20)}v40" stroke="#3E7A5A" stroke-width="2" opacity=".6"/>`);
    K.ombre(dx + 34, dy + 6, 34, 34, .55); s.push(`<circle cx="${f(dx + 30)}" cy="${f(dy)}" r="30" fill="url(#ac-dome)"/>`); for (let k = 0; k < 8; k++) { const t = k / 8 * TAU; s.push(`<path d="M${f(dx + 30)} ${f(dy)}L${f(dx + 30 + Math.cos(t) * 30)} ${f(dy + Math.sin(t) * 30)}" stroke="#F4ECD8" stroke-width="2"/>`); }
    s.push(`<circle cx="${f(dx + 30)}" cy="${f(dy)}" r="7" fill="#F4ECD8" stroke="#9A8A70"/><circle cx="${f(dx + 30)}" cy="${f(dy)}" r="3" fill="#E2B93B"/>`);
    s.unshift(`<radialGradient id="ac-dome" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#F2A060"/><stop offset=".6" stop-color="#C4683A"/><stop offset="1" stop-color="#7A3218"/></radialGradient>`);
    const cx2 = dx - 64, cy2 = dy - 28; K.ombre(cx2 + 6, cy2 + 10, 12, 12, .5); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.push(`<rect x="${f(cx2 - 9 + i * 6)}" y="${f(cy2 - 9 + j * 6)}" width="6" height="6" fill="${(i + j) % 2 ? "#E9E1D0" : "#5A8A6A"}"/>`);
    // la salle secrète sous l'église : artefact doré qui pulse, vue par une ouverture
    s.push(`<rect x="${f(dx - 50)}" y="${f(dy + 6)}" width="22" height="12" rx="2" fill="#1A1410" stroke="#9A8A70"/>`); K.halo(dx - 39, dy + 12, 26, "#F7CF55", .7, K.a); K.a.push(`<circle cx="${f(dx - 39)}" cy="${f(dy + 12)}" r="3" fill="#FFF6C8">${K.anime ? '<animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite"/>' : ""}</circle>`);
    s.push("</g>"); K.prendre(dx, dy, 100);
    // obélisque sur une place, pont sur le fleuve
    s.push(`<rect x="${f(W * .55 - 70)}" y="40" width="140" height="22" fill="#9A8A70" stroke="#6A5A44"/>`); for (let k = 0; k < 5; k++) s.push(`<path d="M${f(W * .55 - 60 + k * 30)} 62q15 -12 30 0" fill="none" stroke="#6A5A44" stroke-width="2"/>`);
    // la grande tour de guet : aigle qui tournoie, charrette de foin au pied
    const [tx, ty] = placeLibre(36); s.push(`<g transform="translate(${f(tx)} ${f(ty)}) scale(1.5) translate(${f(-tx)} ${f(-ty)})">`); K.ombre(tx + 12, ty + 16, 18, 18, .6); s.push(`<rect x="${f(tx - 14)}" y="${f(ty - 14)}" width="28" height="28" fill="#B9A888" stroke="#6A5A44" stroke-width="2"/><rect x="${f(tx - 10)}" y="${f(ty - 10)}" width="20" height="20" fill="url(#ac-tuile2)"/><rect x="${f(tx - 2)}" y="${f(ty - 2)}" width="4" height="4" fill="#5A4030"/>`);
    s.push(`<rect x="${f(tx + 18)}" y="${f(ty + 10)}" width="16" height="11" rx="2" fill="#E8C44A" stroke="#9A7A2A"/>`); for (let k = 0; k < 6; k++) s.push(`<path d="M${f(tx + 19 + k * 2.6)} ${f(ty + 11)}l1.5 9" stroke="#C9A02A" stroke-width=".8"/>`); s.push("</g>");
    K.a.push(`<g><path d="M${f(tx + 40)} ${f(ty)}l-6 -3l-6 3l6 -1z" fill="#3A2A1E"/>${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="0 ${f(tx)} ${f(ty)}" to="360 ${f(tx)} ${f(ty)}" dur="9s" repeatCount="indefinite"/>` : ""}</g>`); K.prendre(tx, ty, 40);
    // silhouettes encapuchonnées qui sautent de toit en toit ; 4 capuches aux couleurs des pilotes ; écusson de confrérie (inventé)
    const capuche = (x, y, c2, ang) => `<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})"><path d="M${f(x)} ${f(y - 5)}q4 2 3.5 6q-3.5 3 -7 0q-.5 -4 3.5 -6z" fill="${c2}" stroke="#222" stroke-width=".5"/><path d="M${f(x - 4)} ${f(y + 2)}q4 5 8 0" fill="${mixHex(c2, "#000000", .3)}"/></g>`;
    for (let k = 0; k < 5; k++) { const b1 = blocs[Math.floor(r() * blocs.length)], b2 = blocs[Math.floor(r() * blocs.length)]; if (!b1 || !b2 || Math.hypot(b1[0] - b2[0], b1[1] - b2[1]) > 160) continue; const dur = (4 + r() * 4).toFixed(1);
      K.a.push(`<g>${capuche(b1[0], b1[1], "#F4F1EA", r() * 360)}${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(b2[0] - b1[0])} ${f(b2[1] - b1[1])};0 0" keyTimes="0;.5;1" dur="${dur}s" repeatCount="indefinite"/>` : ""}</g>`); }
    const bb = blocs[Math.floor(blocs.length / 2)]; if (bb) COULEURS_J.forEach((c2, k) => s.push(capuche(bb[0] - 12 + k * 8, bb[1], c2, k * 20)));
    const eb = blocs[Math.floor(blocs.length / 3)]; if (eb) s.push(`<g transform="translate(${f(eb[0])} ${f(eb[1])})"><path d="M-8 -9h16v7q0 8 -8 11q-8 -3 -8 -11z" fill="#E9DFC6" stroke="#5A2A16" stroke-width="1.2"/><path d="M-4 -4l4 7l4 -7M0 3v3" stroke="#8A1A1A" stroke-width="1.6" fill="none"/></g>`);
    // la piste : rue pavée, bordures de pierre, flambeaux, ligne d'arrivée gardée par un aigle
    K.route([["#2E241C", 36, ` opacity=".55" filter="url(#ac-flou)"`], ["#6A5A44", 30], ["url(#ac-pave)", 24]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#5A4A36" stroke-width="26" stroke-dasharray="1.5 6" opacity=".55"/>`);
    for (let i = 0; i < K.N; i += 18) { const [nx, ny] = K.nrm(i), sd = (i / 18) % 2 ? 1 : -1; K.halo(K.P[i][0] + nx * sd * 17, K.P[i][1] + ny * sd * 17, 14, "#FFB347", .8); s.push(`<circle cx="${f(K.P[i][0] + nx * sd * 17)}" cy="${f(K.P[i][1] + ny * sd * 17)}" r="1.6" fill="#FFF0BC"/>`); }
    K.depart(); { const p0 = K.P[0], [nx, ny] = K.nrm(0); s.push(`<path d="M${f(p0[0] + nx * 20)} ${f(p0[1] + ny * 20)}l-6 -3l-6 3l6 -1z" fill="#3A2A1E"/>`); }
    for (let k = 0; k < 8; k++) K.halo(r() * W, 70 + r() * (H - 70), 100, "#FFD08A", .18);
    K.particules(25, "#FFE6A0", 2, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#ac-pave2)"/>`, "#FFB060", .14);
  }
  /* ---------- Mars · De l'autre côté du terrier (Alice) ---------- */
  function peindreTerrier(T, Z, def) {
    const K = kit(T, def, 33, "al-"), { s, r, f, W, H } = K;
    s.push(`<pattern id="al-dam" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><rect width="44" height="44" fill="#7FBF6A"/><rect width="22" height="22" fill="#5FA052"/><rect x="22" y="22" width="22" height="22" fill="#5FA052"/></pattern>`);
    s.push(`<pattern id="al-piste" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#F4F1EA"/><rect width="6" height="6" fill="#1A1A22"/><rect x="6" y="6" width="6" height="6" fill="#1A1A22"/></pattern>`);
    // la mare de larmes (le lac du tracé), une bouteille « Bois-moi » qui flotte, la course des oiseaux autour
    K.eaux("#7FC8E8", "#E8F8FF");
    (def.eau || []).forEach(poly => { const P0 = poly.map(q => [q[0] * ECH * KU, q[1] * ECH * KU]), cx = P0.reduce((t, p) => t + p[0], 0) / P0.length, cy = P0.reduce((t, p) => t + p[1], 0) / P0.length;
      K.a.push(`<g><rect x="${f(cx - 4)}" y="${f(cy - 9)}" width="8" height="14" rx="3" fill="#8AD8C8" stroke="#2E6A5A"/><rect x="${f(cx - 4)}" y="${f(cy - 4)}" width="8" height="5" fill="#F4ECD8"/>${K.anime ? `<animateTransform attributeName="transform" type="rotate" values="-12 ${f(cx)} ${f(cy)};12 ${f(cx)} ${f(cy)};-12 ${f(cx)} ${f(cy)}" dur="4s" repeatCount="indefinite"/>` : ""}</g>`);
      const ry = Math.max(...P0.map(p => Math.abs(p[1] - cy))) + 20, rx = Math.max(...P0.map(p => Math.abs(p[0] - cx))) + 20;
      for (let k = 0; k < 7; k++) K.a.push(`<g><ellipse cx="${f(cx + rx)}" cy="${f(cy)}" rx="5" ry="3.4" fill="${["#E5484D", "#F2B33A", "#4C8DFF", "#9D6AD8", "#2BB673", "#8A6A48", "#E9E6E0"][k]}"/><circle cx="${f(cx + rx + 4)}" cy="${f(cy - 1)}" r="1.8" fill="#333"/>${K.anime ? `<animateMotion dur="14s" begin="-${(k * 2).toFixed(1)}s" repeatCount="indefinite" path="M0 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0"/>` : ""}</g>`);
      K.prendre(cx, cy, Math.min(rx, ry) + 10);
      for (let k = 0; k < 8; k++) { const t = r() * TAU; s.push(`<circle cx="${f(cx + Math.cos(t) * rx * .55)}" cy="${f(cy + Math.sin(t) * ry * .55)}" r="5" fill="#4F9A5A"/><circle cx="${f(cx + Math.cos(t) * rx * .55 + 1)}" cy="${f(cy + Math.sin(t) * ry * .55)}" r="1.6" fill="#FFB3D0"/>`); }
      for (let k = 0; k < 4; k++) K.a.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="10" ry="6" fill="none" stroke="#E8F8FF" stroke-width="1" opacity="0">${K.anime ? `<animate attributeName="rx" values="10;${f(rx * .7)}" dur="5s" begin="${k * 1.25}s" repeatCount="indefinite"/><animate attributeName="ry" values="6;${f(ry * .7)}" dur="5s" begin="${k * 1.25}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="5s" begin="${k * 1.25}s" repeatCount="indefinite"/>` : ""}</ellipse>`); });
    const dedans = (x, y) => K.inside(x, y);
    // le goûter sans fin : longue table, tasses dépareillées, théières, gâteau « Mange-moi », chapeau haut-de-forme
    K.semis(1, 60, 6000, dedans, (x, y) => { K.ombre(x + 4, y + 6, 70, 12, .45); s.push(`<rect x="${f(x - 64)}" y="${f(y - 10)}" width="128" height="20" rx="3" fill="#F4F1EA" stroke="#C9B8A0"/>`);
      for (let k = 0; k < 12; k++) { const c2 = ["#E5484D", "#4C8DFF", "#F2B33A", "#9D6AD8", "#2BB673", "#FF8FB8"][k % 6]; s.push(`<circle cx="${f(x - 58 + k * 10.5)}" cy="${f(y + (k % 2 ? 5 : -5))}" r="3" fill="${c2}" stroke="#fff" stroke-width=".8"/>`); }
      [[-30, 0], [20, 0]].forEach(([a2]) => s.push(`<ellipse cx="${f(x + a2)}" cy="${f(y)}" rx="6" ry="4.5" fill="#E9E1D0" stroke="#8A7A5A"/><path d="M${f(x + a2 + 6)} ${f(y)}l5 -2" stroke="#8A7A5A" stroke-width="1.5"/>`));
      s.push(`<circle cx="${f(x - 5)}" cy="${f(y)}" r="5" fill="#F7D0E0" stroke="#C86A8A"/><circle cx="${f(x - 5)}" cy="${f(y)}" r="1.5" fill="#E5484D"/><circle cx="${f(x + 46)}" cy="${f(y)}" r="5" fill="#2B2E33"/><circle cx="${f(x + 46)}" cy="${f(y)}" r="3" fill="#3A3E46"/><rect x="${f(x + 44)}" y="${f(y - 5)}" width="4" height="3" fill="#F4ECD8"/>`);
      for (let k = 0; k < 10; k++) s.push(`<rect x="${f(x - 60 + k * 13)}" y="${f(y + (k % 2 ? 14 : -20))}" width="7" height="6" rx="1" fill="${["#8A5A3A", "#5A3A6A", "#3A5A6A"][k % 3]}"/>`);
      K.prendre(x, y, 72); });
    // champignons géants et la chenille qui fume (ronds de fumée)
    K.semis(1, 34, 6000, dedans, (x, y) => { [[0, 0, 22, "#D9632B"], [-30, 18, 14, "#9D6AD8"], [26, 20, 12, "#E5484D"], [-8, -30, 10, "#4C8DFF"]].forEach(([a2, b, R, c2]) => { K.ombre(x + a2 + R * .3, y + b + R * .4, R, R, .45); s.push(`<circle cx="${f(x + a2)}" cy="${f(y + b)}" r="${R}" fill="${c2}" stroke="#3A1A2A" stroke-width="1"/>`); for (let q = 0; q < 5; q++) s.push(`<circle cx="${f(x + a2 + Math.cos(q * 1.3) * R * .55)}" cy="${f(y + b + Math.sin(q * 1.3) * R * .55)}" r="${f(R * .14)}" fill="#FFF6E0"/>`); });
      for (let q = 0; q < 5; q++) s.push(`<circle cx="${f(x - 8 + q * 4)}" cy="${f(y - 2 + (q % 2) * 2)}" r="3" fill="#6EC6D8" stroke="#2E7A8A" stroke-width=".6"/>`);
      for (let q = 0; q < 3; q++) K.a.push(`<circle cx="${f(x + 10)}" cy="${f(y - 4)}" r="3" fill="none" stroke="#E8F0FF" stroke-width="1.2" opacity="0">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;16 -30" dur="3s" begin="${q}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="3s" begin="${q}s" repeatCount="indefinite"/><animate attributeName="r" values="2;7" dur="3s" begin="${q}s" repeatCount="indefinite"/>` : ""}</circle>`); });
    // le terrain de croquet de la reine : haie en cœur, soldats-cartes, flamants-maillets, roses blanches qu'on peint en rouge ; 4 maillets aux couleurs des pilotes
    K.semis(1, 62, 8000, dedans, (x, y) => { s.push(`<g transform="translate(${f(x)} ${f(y)}) scale(.8) translate(${f(-x)} ${f(-y)})">`); s.push(`<path d="M${f(x)} ${f(y + 50)}C${f(x - 90)} ${f(y - 10)} ${f(x - 50)} ${f(y - 70)} ${f(x)} ${f(y - 30)}C${f(x + 50)} ${f(y - 70)} ${f(x + 90)} ${f(y - 10)} ${f(x)} ${f(y + 50)}z" fill="#3E7A3A" stroke="#1F4A1F" stroke-width="6"/><path d="M${f(x)} ${f(y + 40)}C${f(x - 72)} ${f(y - 8)} ${f(x - 42)} ${f(y - 56)} ${f(x)} ${f(y - 22)}C${f(x + 42)} ${f(y - 56)} ${f(x + 72)} ${f(y - 8)} ${f(x)} ${f(y + 40)}z" fill="#9AD27A"/>`);
      [[-30, -10], [0, 0], [26, -14], [10, 22]].forEach(([a2, b]) => s.push(`<path d="M${f(x + a2 - 5)} ${f(y + b)}q5 -8 10 0" fill="none" stroke="#E9E1D0" stroke-width="1.6"/>`));
      COULEURS_J.forEach((c2, k) => s.push(`<path d="M${f(x - 20 + k * 12)} ${f(y + 8)}l3 9" stroke="${c2}" stroke-width="2.4"/><circle cx="${f(x - 20 + k * 12)}" cy="${f(y + 8)}" r="2" fill="${c2}"/>`));
      for (let k = 0; k < 8; k++) { const t = k / 8 * TAU, cx = x + Math.cos(t) * 76, cy = y + Math.sin(t) * 60; s.push(`<rect x="${f(cx - 4)}" y="${f(cy - 6)}" width="8" height="11" rx="1" fill="#F4F1EA" stroke="#333" stroke-width=".6" transform="rotate(${f(t * 57.3 + 90)} ${f(cx)} ${f(cy)})"/><text x="${f(cx)}" y="${f(cy + 2.5)}" text-anchor="middle" font-size="6" fill="${k % 2 ? "#C8283A" : "#1A1A22"}">${k % 2 ? "♥" : "♠"}</text>`); }
      for (let k = 0; k < 10; k++) { const t = k / 10 * TAU, cx = x + Math.cos(t) * 96, cy = y + Math.sin(t) * 78; s.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="5" fill="#2E6A2A"/><circle cx="${f(cx)}" cy="${f(cy)}" r="2.6" fill="${k % 3 ? "#E5484D" : "#F4F1EA"}"/>`); }
      s.push(`<rect x="${f(x + 60)}" y="${f(y + 30)}" width="6" height="7" fill="#9AA3AE"/><path d="M${f(x + 63)} ${f(y + 30)}q6 -10 10 -2" stroke="#E5484D" stroke-width="2" fill="none"/>`); s.push("</g>"); K.prendre(x, y, 80); });
    // le labyrinthe de haies
    K.semis(1, 60, 3000, (x, y) => !K.inside(x, y), (x, y) => { s.push(`<rect x="${f(x - 56)}" y="${f(y - 40)}" width="112" height="80" fill="#2E5A2A"/>`); for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) if (r() < .55) s.push(`<rect x="${f(x - 52 + i * 16)}" y="${f(y - 36 + j * 16)}" width="${r() < .5 ? 14 : 4}" height="${r() < .5 ? 4 : 14}" fill="#9AD27A"/>`); });
    // portes de toutes les tailles, clé dorée ; grande montre de gousset qui tourne à l'envers ; sourire de chat qui apparaît
    K.semis(8, () => 4 + r() * 10, 2000, null, (x, y, R) => s.push(`<rect x="${f(x - R / 2)}" y="${f(y - R)}" width="${f(R)}" height="${f(R * 1.6)}" rx="${f(R / 2)}" fill="${["#8A3A6A", "#3A6A8A", "#C8962A"][Math.floor(r() * 3)]}" stroke="#2E1E12"/><circle cx="${f(x + R * .25)}" cy="${f(y)}" r="${f(Math.max(.8, R * .08))}" fill="#F7CF55"/>`));
    K.semis(1, 22, 4000, dedans, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="20" fill="#E2B93B" stroke="#8A6A1A" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="16" fill="#FFF8E6"/>`); for (let k = 0; k < 12; k++) s.push(`<path d="M${f(x + Math.cos(k * .52) * 13)} ${f(y + Math.sin(k * .52) * 13)}L${f(x + Math.cos(k * .52) * 15)} ${f(y + Math.sin(k * .52) * 15)}" stroke="#333"/>`);
      K.a.push(`<path d="M${f(x)} ${f(y)}V${f(y - 12)}" stroke="#1A1A22" stroke-width="1.6">${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="360 ${f(x)} ${f(y)}" to="0 ${f(x)} ${f(y)}" dur="6s" repeatCount="indefinite"/>` : ""}</path>`); });
    K.semis(1, 10, 2000, null, (x, y) => K.a.push(`<g opacity="0"><path d="M${f(x - 10)} ${f(y)}q10 8 20 0" fill="none" stroke="#F4F1EA" stroke-width="2.4"/><circle cx="${f(x - 6)}" cy="${f(y - 7)}" r="2" fill="#F7CF55"/><circle cx="${f(x + 6)}" cy="${f(y - 7)}" r="2" fill="#F7CF55"/>${K.anime ? '<animate attributeName="opacity" values="0;0;1;1;0" dur="9s" repeatCount="indefinite"/>' : ""}</g>`));
    // le lapin blanc pressé qui court le long de la piste
    K.a.push(`<g><ellipse cx="0" cy="0" rx="4" ry="3" fill="#F4F1EA"/><path d="M2 -2l3 -6M0 -2l1 -6" stroke="#F4F1EA" stroke-width="1.4"/>${K.anime ? `<animateMotion dur="30s" repeatCount="indefinite" path="${K.piste.replace(/(\d+\.\d) (\d+\.\d)/g, (m0, a2, b) => (+a2 + 20).toFixed(1) + " " + b)}"/>` : ""}</g>`);
    K.semis(140, () => 7 + r() * 8, 4000, null, (x, y, R) => K.arbre(x, y, R, ["#9AD27A", "#E89AC8", "#9AC8E8"][Math.floor(r() * 3)], "#4F8A4A", "#2A4A2A"));
    K.route([["#2E4A2A", 36, ` opacity=".4" filter="url(#al-flou)"`], ["#C86A8A", 30], ["url(#al-piste)", 24]]);
    K.depart(); K.particules(40, "#FFC6E8", 2.4, "scintille");
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#al-dam)"/>`, "#F4D0FF", .1);
  }
  /* ---------- Avril · La Fabrique de chocolat (Charlie) ---------- */
  function peindreChocolat(T, Z, def) {
    const K = kit(T, def, 44, "cc-"), { s, r, f, W, H } = K;
    s.push(`<pattern id="cc-sucre" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#9FE0B8"/><rect x="3" y="5" width="3" height="1.2" rx=".6" fill="#FF6FA8" transform="rotate(30 4 5)"/><rect x="14" y="14" width="3" height="1.2" rx=".6" fill="#F7D84A" transform="rotate(-40 15 14)"/><rect x="16" y="3" width="3" height="1.2" rx=".6" fill="#6EC6FF"/><rect x="6" y="16" width="3" height="1.2" rx=".6" fill="#FFFFFF" transform="rotate(70 7 16)"/></pattern>`);
    s.push(`<pattern id="cc-biscuit" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#D9A866"/><circle cx="3" cy="3" r=".9" fill="#B9874A"/><circle cx="8" cy="7" r=".9" fill="#B9874A"/></pattern>`);
    s.push(`<pattern id="cc-sucredorge" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#FFFFFF"/><rect width="5" height="10" fill="#E5484D"/></pattern>`);
    // la rivière de chocolat qui serpente (coule), sa cascade et la barque-cygne rose
    const ry0 = H * .5, riv = `M-30 ${f(ry0 + 60)}C${f(W * .2)} ${f(ry0 - 40)} ${f(W * .35)} ${f(ry0 + 120)} ${f(W * .55)} ${f(ry0 + 20)}S${f(W * .85)} ${f(ry0 - 110)} ${W + 30} ${f(ry0 - 40)}`;
    s.push(`<path d="${riv}" fill="none" stroke="#3A1E10" stroke-width="58"/><path d="${riv}" fill="none" stroke="#6B3A1E" stroke-width="48"/><path d="${riv}" fill="none" stroke="#8A4E2A" stroke-width="22" opacity=".6"/>`);
    K.a.push(`<path d="${riv}" fill="none" stroke="#B5754A" stroke-width="3" stroke-dasharray="14 26" opacity=".8">${K.anime ? '<animate attributeName="stroke-dashoffset" from="0" to="-80" dur="3s" repeatCount="indefinite"/>' : ""}</path>`);
    const cxs = W * .12, cys = ry0 + 20; s.push(`<rect x="${f(cxs - 30)}" y="${f(cys - 46)}" width="60" height="40" rx="6" fill="#5A3020"/>`); K.a.push(`<path d="M${f(cxs - 24)} ${f(cys - 10)}h48" stroke="#9A5A30" stroke-width="10" stroke-dasharray="4 4">${K.anime ? '<animate attributeName="stroke-dashoffset" from="0" to="-16" dur=".6s" repeatCount="indefinite"/>' : ""}</path>`); K.halo(cxs, cys, 34, "#F4E0C0", .5);
    K.a.push(`<g><path d="M-8 0q8 7 16 0l-2 -4h-12z" fill="#FF8FB8" stroke="#C84A7A"/><path d="M6 -4q4 -8 0 -10" stroke="#FF8FB8" stroke-width="2.4" fill="none"/>${K.anime ? `<animateMotion dur="40s" repeatCount="indefinite" path="${riv}"/>` : ""}</g>`);
    for (let k = 0; k < 6; k++) { const x = W * (.2 + k * .13), y = ry0 + (r() - .5) * 60; if (K.dT(x, y) > 30) s.push(`<path d="M${f(x)} ${f(y - 40)}v80" stroke="#BFE8F8" stroke-width="7" opacity=".55"/><path d="M${f(x)} ${f(y - 40)}v80" stroke="#FFFFFF" stroke-width="2" opacity=".6"/>`); }   // tuyaux de verre qui aspirent le chocolat
    // la fabrique : grand bâtiment, cheminées pastel qui crachent des fumées colorées, portail en sucre d'orge
    K.semis(1, 90, 8000, (x, y) => x > 110 && x < W - 110 && y > 70 && y < H - 80, (x, y) => { K.ombre(x + 10, y + 14, 90, 50, .5); s.push(`<rect x="${f(x - 86)}" y="${f(y - 46)}" width="172" height="92" rx="6" fill="#B8A0C8" stroke="#5A4A6A" stroke-width="3"/><rect x="${f(x - 78)}" y="${f(y - 38)}" width="156" height="76" fill="#CFB8DA"/>`);
      for (let k = 0; k < 6; k++) { const cx = x - 66 + k * 26, cy = y - 22, c2 = ["#FF8FB8", "#F7D84A", "#6EC6FF", "#9FE0B8", "#FFB070", "#C9A0FF"][k]; s.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="8" fill="${c2}" stroke="#5A4A6A" stroke-width="1.5"/><circle cx="${f(cx)}" cy="${f(cy)}" r="3.5" fill="#3A2A3A"/>`);
        for (let q = 0; q < 2; q++) K.a.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="6" fill="${c2}" opacity="0">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(10 + r() * 10)} -40" dur="4s" begin="${(q * 2 + k * .3).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="4s" begin="${(q * 2 + k * .3).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="r" values="6;14" dur="4s" begin="${(q * 2 + k * .3).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</circle>`); }
      for (let k = 0; k < 10; k++) s.push(`<rect x="${f(x - 70 + k * 15)}" y="${f(y + 18)}" width="8" height="10" rx="4" fill="#FFE9B0"/>`);
      s.push(`<rect x="${f(x - 14)}" y="${f(y + 44)}" width="28" height="10" fill="url(#cc-sucredorge)"/>`); K.prendre(x, y, 100); });
    // l'ascenseur de verre, les arbres-sucettes, buissons de boules de gomme, champignons-guimauves, barbe à papa
    K.semis(1, 16, 2000, null, (x, y) => { s.push(`<rect x="${f(x - 12)}" y="${f(y - 12)}" width="24" height="24" fill="#DFF6FF" fill-opacity=".5" stroke="#FFFFFF" stroke-width="2"/><path d="M${f(x - 12)} ${f(y)}h24M${f(x)} ${f(y - 12)}v24" stroke="#FFFFFF"/>`); K.halo(x, y, 30, "#BFF0FF", .5); });
    K.semis(46, () => 9 + r() * 6, 3000, null, (x, y, R) => { const c2 = ["#FF6FA8", "#F7D84A", "#6EC6FF", "#9D6AD8", "#2BB673"][Math.floor(r() * 5)]; K.ombre(x + 4, y + 5, R, R, .35); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#FFFFFF"/>`); let d = ""; for (let t = 0; t < 14; t += .3) { const rr = R * t / 14; d += (d ? "L" : "M") + f(x + Math.cos(t) * rr) + " " + f(y + Math.sin(t) * rr); } s.push(`<path d="${d}" fill="none" stroke="${c2}" stroke-width="${f(R * .22)}"/>`); });
    K.semis(60, () => 4 + r() * 4, 3000, null, (x, y, R) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${["#FF6FA8", "#F7D84A", "#6EC6FF", "#FF8A3D", "#2BB673", "#E5484D"][Math.floor(r() * 6)]}"/><circle cx="${f(x - R * .3)}" cy="${f(y - R * .3)}" r="${f(R * .3)}" fill="#fff" opacity=".6"/>`));
    K.semis(16, () => 7 + r() * 4, 2000, null, (x, y, R) => { K.ombre(x + 3, y + 4, R, R, .3); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#FFF4F8" stroke="#F0C8D8"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .5)}" fill="#FFE0EC"/>`); });
    K.semis(20, () => 12 + r() * 8, 2000, null, (x, y, R) => K.arbre(x, y, R, "#FFD0E8", "#FF9AC8", "#D86AA0"));
    // clins d'œil : 4 tickets dorés aux initiales des pilotes, qui brillent
    ["T", "K", "C", "D"].forEach((l, k) => { let x = 0, y = 0; for (let e = 0; e < 500; e++) { x = 60 + r() * (W - 120); y = 60 + r() * (H - 120); if (K.libre(x, y, 12)) break; } K.prendre(x, y, 12);
      s.push(`<g transform="rotate(${f((r() - .5) * 40)} ${f(x)} ${f(y)})"><rect x="${f(x - 12)}" y="${f(y - 6)}" width="24" height="12" rx="1.5" fill="#F7CF55" stroke="#9A6716" stroke-width="1"/><text x="${f(x)}" y="${f(y + 3.5)}" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="9" fill="${COULEURS_J[k]}">${l}</text></g>`);
      K.a.push(`<circle cx="${f(x + 8)}" cy="${f(y - 4)}" r="2" fill="#FFFFFF">${K.anime ? `<animate attributeName="opacity" values="0;1;0" dur="2s" begin="${k * .5}s" repeatCount="indefinite"/>` : ""}</circle>`); });
    // la piste en biscuit, bordures en sucre d'orge, pont en gaufrette au croisement du huit
    K.route([["#5A3A20", 38, ` opacity=".4" filter="url(#cc-flou)"`], ["url(#cc-sucredorge)", 32], ["url(#cc-biscuit)", 24]]);
    const haut = []; for (let i = 0; i < K.N; i++) if (T.Y[i] > 4) haut.push(K.P[i]); if (haut.length > 4) { const d = "M" + haut.map(p => f(p[0]) + " " + f(p[1])).join("L"); s.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="40" opacity=".3" filter="url(#cc-flou)"/><path d="${d}" fill="none" stroke="#E8C48A" stroke-width="32"/><path d="${d}" fill="none" stroke="#C9A06A" stroke-width="30" stroke-dasharray="1 5"/><path d="${d}" fill="none" stroke="url(#cc-biscuit)" stroke-width="24"/>`); }
    K.depart(); K.particules(40, "#FFFFFF", 2.4, "scintille");
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#cc-sucre)"/>`, "#FFE0F0", .08);
  }
  /* ---------- Septembre · Le Chasseur de monstres (marais, village, contrats) ---------- */
  function peindreChasseur(T, Z, def) {
    const K = kit(T, def, 92, "wh-"), { s, r, f, W, H } = K;
    s.push(`<radialGradient id="wh-marais" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#3A4A3A"/><stop offset="1" stop-color="#1E2A22"/></radialGradient>`);
    // les marais brumeux : flaques, roseaux, arbres tordus, brume qui passe, une créature qui sort de l'eau
    for (let k = 0; k < 26; k++) { const x = r() * W, y = r() * H; if (!K.libre(x, y, 30, 4)) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(20 + r() * 40)}" ry="${f(12 + r() * 24)}" fill="#2A3E3A" stroke="#4A5A3A" stroke-width="2"/>`); for (let q = 0; q < 8; q++) s.push(`<path d="M${f(x - 20 + r() * 40)} ${f(y - 10 + r() * 20)}l${f((r() - .5) * 4)} -8" stroke="#7A8A4A" stroke-width="1.2"/>`); }
    K.semis(1, 30, 3000, null, (x, y) => { s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="40" ry="26" fill="#1E3230"/>`); K.a.push(`<g opacity="0"><ellipse cx="${f(x)}" cy="${f(y)}" rx="9" ry="6" fill="#2A2420"/><circle cx="${f(x - 3)}" cy="${f(y - 2)}" r="1.4" fill="#FF6B3D"/><circle cx="${f(x + 3)}" cy="${f(y - 2)}" r="1.4" fill="#FF6B3D"/>${[-1, 1].map(sd => `<path d="M${f(x + sd * 8)} ${f(y)}q${f(sd * 10)} -6 ${f(sd * 16)} 2" stroke="#2A2420" stroke-width="2.2" fill="none"/>`).join("")}${K.anime ? '<animate attributeName="opacity" values="0;0;.95;.95;0" dur="11s" repeatCount="indefinite"/>' : ""}</g>`); K.prendre(x, y, 44); });
    // le village : maisons à colombages et toits de chaume, auberge, tableau des contrats, forge, puits, moulin
    const vx = W * (.3 + r() * .4), vy = H * (.3 + r() * .4);
    K.semis(28, () => 10 + r() * 6, 5000, (x, y) => Math.hypot(x - vx, y - vy) < 200, (x, y, R) => { K.toit(x, y, R * 2, R * 1.4, r() < .6 ? "#A08A5A" : "#7A6A4A", Math.round(r()) * 90 + (r() - .5) * 16, true, r() < .5); s.push(`<path d="M${f(x - R)} ${f(y - R * .7)}l${f(R * 2)} ${f(R * 1.4)}" stroke="#4A3A2A" stroke-width=".8" opacity=".5"/>`); if (r() < .5) K.halo(x, y + R, R, "#FFB347", .45); });
    K.semis(1, 34, 3000, (x, y) => Math.hypot(x - vx, y - vy) < 240, (x, y) => { K.toit(x, y, 64, 40, "#6A4A2E", 0, true, true); s.push(`<rect x="${f(x - 6)}" y="${f(y + 20)}" width="12" height="8" fill="#3A2414"/>`); K.halo(x, y + 26, 30, "#FFB347", .7); s.push(`<path d="M${f(x + 30)} ${f(y + 20)}v12" stroke="#3A2414" stroke-width="2"/><rect x="${f(x + 27)}" y="${f(y + 26)}" width="14" height="8" fill="#8A6A3A" stroke="#3A2414"/>`);
      // clin d'œil : partie de cartes à la taverne, 4 paquets aux couleurs des pilotes
      s.push(`<circle cx="${f(x - 46)}" cy="${f(y + 10)}" r="12" fill="#6B4A30" stroke="#3A2414" stroke-width="2"/>`); COULEURS_J.forEach((c2, k) => { const t = k * 1.57; s.push(`<rect x="${f(x - 46 + Math.cos(t) * 6 - 2.5)}" y="${f(y + 10 + Math.sin(t) * 6 - 3.5)}" width="5" height="7" rx=".8" fill="${c2}" stroke="#F4ECD8" stroke-width=".6"/>`); });
      // tableau des contrats sur les monstres
      s.push(`<rect x="${f(x + 44)}" y="${f(y - 14)}" width="24" height="18" fill="#7A5A3A" stroke="#3A2414" stroke-width="1.5"/>`); for (let k = 0; k < 4; k++) s.push(`<rect x="${f(x + 46 + (k % 2) * 11)}" y="${f(y - 12 + Math.floor(k / 2) * 8)}" width="9" height="6" fill="#E9DFC6" transform="rotate(${f((r() - .5) * 14)} ${f(x + 50 + (k % 2) * 11)} ${f(y - 9 + Math.floor(k / 2) * 8)})"/>`); K.prendre(x, y, 60); });
    K.semis(1, 12, 2000, (x, y) => Math.hypot(x - vx, y - vy) < 240, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="#6E6A62" stroke="#3A3630" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="#1A2A30"/>`); });
    K.semis(1, 16, 2000, (x, y) => Math.hypot(x - vx, y - vy) < 260, (x, y) => { K.toit(x, y, 26, 20, "#4A4A4E", 0, false); K.halo(x, y, 24, "#FF6B2A", .8); K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#FFB060">${K.anime ? '<animate attributeName="opacity" values="1;.4;1" dur=".9s" repeatCount="indefinite"/>' : ""}</circle>`); });
    // tour de mage en ruine (lueur bleue), cercle de pierres levées, feux de camp, loups
    K.semis(1, 30, 3000, (x, y) => Math.hypot(x - vx, y - vy) > 200, (x, y) => { K.ombre(x + 8, y + 10, 26, 26, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="24" fill="#5A5F68" stroke="#2E3138" stroke-width="3"/><path d="M${f(x - 24)} ${f(y)}a24 24 0 0 1 30 -22l-6 14l8 6z" fill="#3A3E46"/><circle cx="${f(x)}" cy="${f(y)}" r="10" fill="#1A1E2A"/>`); K.halo(x, y, 70, "#6EC6FF", .45, K.a); for (let k = 0; k < 6; k++) { const t = r() * TAU; s.push(`<rect x="${f(x + Math.cos(t) * 34)}" y="${f(y + Math.sin(t) * 34)}" width="6" height="4" fill="#6E6A62" transform="rotate(${f(r() * 90)} ${f(x + Math.cos(t) * 34)} ${f(y + Math.sin(t) * 34)})"/>`); } K.prendre(x, y, 50); });
    K.semis(1, 26, 3000, (x, y) => Math.hypot(x - vx, y - vy) > 160, (x, y) => { for (let k = 0; k < 9; k++) { const t = k / 9 * TAU; s.push(`<rect x="${f(x + Math.cos(t) * 22 - 3)}" y="${f(y + Math.sin(t) * 22 - 4)}" width="6" height="8" rx="2" fill="#8A867E" stroke="#4A4640"/>`); } K.a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="none" stroke="#B8F2FF" stroke-width="1" opacity=".0">${K.anime ? '<animate attributeName="opacity" values="0;.8;0" dur="6s" repeatCount="indefinite"/>' : ""}</circle>`); });
    K.semis(3, 8, 2000, null, (x, y) => { K.halo(x, y, 26, "#FF8A2B", .8); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#5A3F2A"/>`); });
    for (let k = 0; k < 5; k++) { const x = r() * W, y = r() * H; if (!K.libre(x, y, 8)) continue; K.a.push(`<g><ellipse cx="${f(x)}" cy="${f(y)}" rx="6" ry="2.6" fill="#4A4A50"/><circle cx="${f(x + 6)}" cy="${f(y - 1)}" r="2" fill="#4A4A50"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(40 + r() * 60)} ${f((r() - .5) * 40)};0 0" dur="${(16 + r() * 8).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    // forêt sombre de pins et d'arbres tordus
    K.semis(260, () => 8 + r() * 10, 6000, null, (x, y, R) => r() < .6 ? K.sapin(x, y, R, "#2A3E2E") : K.arbre(x, y, R, "#5A6A3A", "#3A4A2A", "#1E2A1A"));
    K.route([["#000", 36, ` opacity=".5" filter="url(#wh-flou)"`], ["#4A3E2E", 28], ["#6A5A40", 20], ["#4A3E2E", 4, ` stroke-dasharray="2 9" opacity=".7"`]]);
    for (const sd of [1, -1]) { const d = "M" + K.P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 15) + " " + f(p[1] + ny * sd * 15); }).join("L") + "Z"; s.push(`<path d="${d}" fill="none" stroke="#3A2E20" stroke-width="2" stroke-dasharray="8 6"/>`); }
    K.depart();
    for (let k = 0; k < 6; k++) { const y = r() * H, d = (30 + r() * 20).toFixed(0); K.a.push(`<ellipse cx="0" cy="${f(y)}" rx="${f(120 + r() * 120)}" ry="${f(20 + r() * 20)}" fill="#C9D2C8" opacity=".12">${K.anime ? `<animateTransform attributeName="transform" type="translate" values="-200 0;${W + 200} 0" dur="${d}s" begin="-${(r() * +d).toFixed(0)}s" repeatCount="indefinite"/>` : ""}</ellipse>`); }
    K.particules(30, "#FFB060", 2, "monte");
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#wh-marais)"/>`, "#1A2030", .12);
  }
  /* ---------- Octobre · La Nuit des masques (horreur, Halloween) ---------- */
  function peindreMasques(T, Z, def) {
    const K = kit(T, def, 102, "ms-"), { s, r, f, W, H } = K;
    // petite ville américaine la nuit : rues, pelouses, maisons, une seule fenêtre allumée où le téléphone sonne
    for (let k = 0; k < 7; k++) s.push(`<path d="M0 ${f(60 + k * 100)}H${W}" stroke="#2A2A30" stroke-width="14"/><path d="M${f(80 + k * 160)} 0V${H}" stroke="#2A2A30" stroke-width="14"/>`);
    K.semis(60, () => 11 + r() * 5, 6000, null, (x, y, R) => { K.toit(x, y, R * 2, R * 1.5, ["#3A3A44", "#4A3A3A", "#3A4A44"][Math.floor(r() * 3)], Math.round(r()) * 90, true, true); s.push(`<rect x="${f(x - R * 1.2)}" y="${f(y + R)}" width="${f(R * 2.4)}" height="${f(R * .8)}" fill="#26321F" opacity=".8"/>`); if (r() < .2) K.halo(x, y + R, R * .8, "#FFB347", .35); if (r() < .4) s.push(`<circle cx="${f(x + R * 1.1)}" cy="${f(y + R * 1.2)}" r="3" fill="#E8762A"/><path d="M${f(x + R * 1.1 - 1)} ${f(y + R * 1.2)}h2" stroke="#3A1A0A" stroke-width=".8"/>`); });
    K.semis(1, 24, 3000, null, (x, y) => { K.toit(x, y, 46, 34, "#3A3440", 0, true, true); K.halo(x + 10, y + 18, 30, "#FFE6A8", .8); K.a.push(`<g opacity="0"><circle cx="${f(x + 10)}" cy="${f(y + 18)}" r="9" fill="none" stroke="#FFE6A8" stroke-width="1.2"/><circle cx="${f(x + 10)}" cy="${f(y + 18)}" r="14" fill="none" stroke="#FFE6A8" stroke-width="1"/>${K.anime ? '<animate attributeName="opacity" values="0;.9;0;.9;0;0;0;0" dur="6s" repeatCount="indefinite"/>' : ""}</g>`); s.push(`<text x="${f(x + 10)}" y="${f(y - 22)}" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="7" fill="#FFE6A8" opacity=".7">dring…</text>`); K.prendre(x, y, 40); });
    // le cimetière (tombes, croix, brume), le champ de maïs et son épouvantail, le cinéma en plein air
    K.semis(1, 60, 3000, null, (x, y) => { s.push(`<rect x="${f(x - 56)}" y="${f(y - 40)}" width="112" height="80" fill="#1E2A1E" stroke="#5A5A5A" stroke-width="2" stroke-dasharray="2 3"/>`); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const tx = x - 46 + i * 18 + (r() - .5) * 4, ty = y - 30 + j * 20; s.push(r() < .3 ? `<path d="M${f(tx)} ${f(ty - 5)}v10M${f(tx - 3)} ${f(ty - 2)}h6" stroke="#9A9A9A" stroke-width="1.6"/>` : `<rect x="${f(tx - 3.5)}" y="${f(ty - 5)}" width="7" height="9" rx="3" fill="#8A8A8E" stroke="#4A4A4E"/>`); } K.halo(x, y, 70, "#C9D2C8", .25, K.a); K.prendre(x, y, 70); });
    K.semis(1, 60, 3000, null, (x, y) => { s.push(`<g transform="rotate(${f((r() - .5) * 20)} ${f(x)} ${f(y)})">${Array.from({ length: 12 }, (_, j) => `<rect x="${f(x - 60)}" y="${f(y - 40 + j * 7)}" width="120" height="4" fill="${j % 2 ? "#8A7A3A" : "#6A5A2A"}"/>`).join("")}</g><path d="M${f(x)} ${f(y - 8)}v16M${f(x - 8)} ${f(y - 2)}h16" stroke="#4A3626" stroke-width="2.4"/><circle cx="${f(x)}" cy="${f(y - 10)}" r="3.4" fill="#E8762A"/>`); K.prendre(x, y, 66); });
    K.semis(1, 50, 3000, null, (x, y) => { s.push(`<rect x="${f(x - 46)}" y="${f(y - 36)}" width="92" height="72" fill="#2E2E34"/>`); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s.push(`<rect x="${f(x - 36 + i * 22)}" y="${f(y - 6 + j * 14)}" width="12" height="7" rx="2" fill="${["#7A2A2A", "#2A4A7A", "#3A5A3A", "#6A6A3A"][(i + j) % 4]}"/>`); s.push(`<rect x="${f(x - 30)}" y="${f(y - 34)}" width="60" height="14" fill="#F4F1EA"/>`); K.a.push(`<rect x="${f(x - 30)}" y="${f(y - 34)}" width="60" height="14" fill="#9FD0FF" opacity=".5">${K.anime ? '<animate attributeName="opacity" values=".2;.7;.3;.6;.2" dur="1.3s" repeatCount="indefinite"/>' : ""}</rect>`); K.prendre(x, y, 56); });
    // clin d'œil : 4 citrouilles sculptées aux initiales des pilotes
    ["T", "K", "C", "D"].forEach((l, k) => { let x = 0, y = 0; for (let e = 0; e < 600; e++) { x = 60 + r() * (W - 120); y = 60 + r() * (H - 120); if (K.libre(x, y, 10) && K.dT(x, y) < 50) break; } K.prendre(x, y, 10); K.halo(x, y, 18, "#FF8A2B", .8); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="7.5" fill="#E8762A" stroke="#8A3A10"/><text x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" font-family="Georgia" font-weight="900" font-size="8" fill="#FFE27A">${l}</text>`); });
    K.semis(160, () => 7 + r() * 9, 5000, null, (x, y, R) => K.arbre(x, y, R, "#4A4A3A", "#2E2E24", "#14140E"));
    // le masque blanc qui apparaît entre les arbres ; le « screamer » : une silhouette qui surgit d'un coup
    for (let k = 0; k < 3; k++) { const x = 80 + r() * (W - 160), y = 80 + r() * (H - 160); K.a.push(`<g opacity="0"><ellipse cx="${f(x)}" cy="${f(y)}" rx="6" ry="8.5" fill="#F4F1EA"/><ellipse cx="${f(x - 2.2)}" cy="${f(y - 1.5)}" rx="1.4" ry="2.4" fill="#111"/><ellipse cx="${f(x + 2.2)}" cy="${f(y - 1.5)}" rx="1.4" ry="2.4" fill="#111"/><ellipse cx="${f(x)}" cy="${f(y + 3.6)}" rx="1.6" ry="2.6" fill="#111"/>${K.anime ? `<animate attributeName="opacity" values="0;0;.95;.95;0;0" dur="${(9 + k * 4).toFixed(0)}s" begin="${k * 3}s" repeatCount="indefinite"/>` : ""}</g>`); }
    { const x = W / 2, y = H / 2; K.a.push(`<g opacity="0"><ellipse cx="${f(x)}" cy="${f(y)}" rx="70" ry="100" fill="#0A0A0C"/><ellipse cx="${f(x)}" cy="${f(y - 10)}" rx="44" ry="62" fill="#F4F1EA"/><ellipse cx="${f(x - 15)}" cy="${f(y - 20)}" rx="9" ry="16" fill="#111"/><ellipse cx="${f(x + 15)}" cy="${f(y - 20)}" rx="9" ry="16" fill="#111"/><ellipse cx="${f(x)}" cy="${f(y + 22)}" rx="10" ry="18" fill="#111"/>${K.anime ? '<animate attributeName="opacity" values="0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;1;0" dur="22s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;.6;1.1;1" additive="sum" dur="22s" repeatCount="indefinite"/>' : ""}</g>`); }
    K.route([["#000", 36, ` opacity=".6" filter="url(#ms-flou)"`], ["#3A3A3E", 28], ["#26262A", 22], ["#C9B85A", 1.2, ` stroke-dasharray="8 10" opacity=".5"`]]);
    for (let i = 0; i < K.N; i += 22) { const [nx, ny] = K.nrm(i), sd = (i / 22) % 2 ? 1 : -1; K.halo(K.P[i][0] + nx * sd * 18, K.P[i][1] + ny * sd * 18, 16, "#FFB347", .6); }
    K.depart(); for (let k = 0; k < 8; k++) K.halo(r() * W, r() * H, 150, "#3A4A3A", .3);
    K.particules(30, "#C9D2C8", 2, "derive");
    for (let k = 0; k < 4; k++) { const y0 = 40 + r() * 200, d = (10 + r() * 8).toFixed(1); K.a.push(`<g><path d="M0 ${f(y0)}q4 -4 8 0q4 -4 8 0" fill="none" stroke="#1A1A1E" stroke-width="2"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="-20 0;${W + 20} ${f((r() - .5) * 100)}" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }   // chauves-souris
    return K.fin(`<rect width="${W}" height="${H}" fill="#222C22"/>`, "#0A0E1E", .2);
  }
  /* ---------- Juin · La Confrérie (assassins, nuit d'infiltration) — v2 ---------- */
  function peindreConfrerie(T, Z, def) {
    const K = kit(T, def, 63, "cf-"), { s, r, f, W, H } = K;
    s.push(`<pattern id="cf-pave" width="9" height="6" patternUnits="userSpaceOnUse"><rect width="9" height="6" fill="#2A2C34"/><rect x=".6" y=".6" width="7.8" height="4.8" rx="1.2" fill="#353843"/></pattern>`);
 s.push(`<pattern id="cf-pave3" width="9" height="6" patternUnits="userSpaceOnUse"><rect width="9" height="6" fill="#5A5E6A"/><rect x=".6" y=".6" width="7.8" height="4.8" rx="1.2" fill="#6E7280"/></pattern>`);
    s.push(`<pattern id="cf-tuile" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="4" fill="#4A3A36"/><path d="M0 3.5h6" stroke="#2E2422" stroke-width=".8"/></pattern>`);
    s.push(`<pattern id="cf-hex" width="24" height="21" patternUnits="userSpaceOnUse"><path d="M6 0h12l6 10.5l-6 10.5h-12l-6 -10.5z" fill="none" stroke="#7CF2FF" stroke-width=".8"/></pattern>`);
    // la forteresse de l'Ordre : remparts, tours, bannières blanches à croix rouge, cour, donjon où se trouve la cible
    let fx = 0, fy = 0, best = -1; for (let e = 0; e < 3000; e++) { const x = 140 + r() * (W - 280), y = 120 + r() * (H - 240), d = K.dT(x, y); if (d > best && K.libre(x, y, 60, 0)) { best = d; fx = x; fy = y; } }
    const c = Math.min(95, best * .7); K.ombre(fx + 12, fy + 16, c + 10, c + 10, .6);
    s.push(`<rect x="${f(fx - c)}" y="${f(fy - c)}" width="${f(2 * c)}" height="${f(2 * c)}" fill="#3A3C44" stroke="#15161A" stroke-width="4"/><rect x="${f(fx - c + 10)}" y="${f(fy - c + 10)}" width="${f(2 * c - 20)}" height="${f(2 * c - 20)}" fill="url(#cf-pave)"/>`);
    for (let k = 0; k < 30; k++) { const t = k / 30; [[fx - c + t * 2 * c, fy - c], [fx - c + t * 2 * c, fy + c - 5], [fx - c, fy - c + t * 2 * c], [fx + c - 5, fy - c + t * 2 * c]].forEach(([x, y]) => s.push(`<rect x="${f(x)}" y="${f(y)}" width="4" height="5" fill="#55585F"/>`)); }
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a2, b]) => { const x = fx + a2 * c, y = fy + b * c; K.ombre(x + 5, y + 7, 15, 15, .5); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="14" fill="#4A4C54" stroke="#15161A" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="9" fill="#2E3038"/>`); s.push(`<rect x="${f(x + 10)}" y="${f(y - 18)}" width="12" height="16" fill="#F4F1EA"/><path d="M${f(x + 16)} ${f(y - 16)}v12M${f(x + 12)} ${f(y - 10)}h8" stroke="#B0122E" stroke-width="2.4"/>`); K.halo(x, y, 22, "#FF9A3D", .7); });
    s.push(`<rect x="${f(fx - 26)}" y="${f(fy - 20)}" width="52" height="40" fill="#2A2C34" stroke="#15161A" stroke-width="2"/>`);
    // la cible dans le donjon, vue en « vision d'aigle » : halo doré qui pulse ; les gardes en rouge, les alliés en bleu
    K.a.push(`<g><circle cx="${f(fx)}" cy="${f(fy)}" r="5" fill="#F7CF55"/><circle cx="${f(fx)}" cy="${f(fy)}" r="12" fill="none" stroke="#F7CF55" stroke-width="2">${K.anime ? '<animate attributeName="r" values="8;22;8" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/>' : ""}</circle></g>`); K.halo(fx, fy, 40, "#F7CF55", .6);
    for (let k = 0; k < 8; k++) { const t = k / 8 * TAU, gx = fx + Math.cos(t) * c * .7, gy = fy + Math.sin(t) * c * .7, d = (6 + r() * 4).toFixed(1); K.a.push(`<g><circle cx="${f(gx)}" cy="${f(gy)}" r="3" fill="#C8283A" stroke="#FF6B6B" stroke-width="1"/><path d="M${f(gx)} ${f(gy)}l18 -6l2 10z" fill="#FFE6A8" opacity=".25"/>${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(Math.cos(t + 1.6) * 30)} ${f(Math.sin(t + 1.6) * 30)};0 0" dur="${d}s" repeatCount="indefinite"/>` : ""}</g>`); }
    K.prendre(fx, fy, c + 30);
    // les assassins tapis : silhouettes encapuchonnées blanches à ceinture rouge, sur les toits et les remparts ; 4 aux couleurs des pilotes
    const ass = (x, y, c2, ang) => `<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})"><path d="M${f(x)} ${f(y - 6)}q5 2 4.5 7q-4.5 4 -9 0q-.5 -5 4.5 -7z" fill="${c2}" stroke="#111" stroke-width=".6"/><path d="M${f(x)} ${f(y - 6)}l0 -3" stroke="${c2}" stroke-width="1.6"/><path d="M${f(x - 4)} ${f(y + 1)}h8" stroke="#B0122E" stroke-width="1.6"/><path d="M${f(x + 5)} ${f(y + 2)}l5 2" stroke="#E8F0FF" stroke-width="1.2"/></g>`;
    [[fx - c - 2, fy - c * .3, 90], [fx + c + 2, fy + c * .2, -90], [fx - c * .4, fy - c - 3, 0], [fx + c * .5, fy + c + 3, 180]].forEach(([x, y, a2], k) => { s.push(ass(x, y, COULEURS_J[k], a2)); K.halo(x, y, 12, "#6EC6FF", .45); });
    for (let k = 0; k < 6; k++) { const x = 60 + r() * (W - 120), y = 60 + r() * (H - 120); if (!K.libre(x, y, 8, 4)) continue; K.a.push(`<g>${ass(x, y, "#F4F1EA", r() * 360)}${K.anime ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 120)} ${f((r() - .5) * 80)};0 0" keyTimes="0;.5;1" dur="${(5 + r() * 4).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</g>`); }
    // bottes de foin au pied des murs, bancs pour se fondre dans la foule, aigle qui tournoie au-dessus de la forteresse
    [[fx - c - 18, fy + c * .5], [fx + c + 18, fy - c * .4], [fx + c * .2, fy - c - 18]].forEach(([x, y]) => { s.push(`<rect x="${f(x - 9)}" y="${f(y - 6)}" width="18" height="12" rx="2" fill="#D9B44A" stroke="#8A6A1A"/>`); for (let q = 0; q < 5; q++) s.push(`<path d="M${f(x - 8 + q * 3.6)} ${f(y - 5)}l1.4 10" stroke="#B8902A" stroke-width=".8"/>`); });
    K.a.push(`<g><path d="M${f(fx + 60)} ${f(fy)}l-9 -4l-9 4l9 -1.5z" fill="#2A1E14" stroke="#C9A35A" stroke-width=".4"/>${K.anime ? `<animateTransform attributeName="transform" type="rotate" from="0 ${f(fx)} ${f(fy)}" to="360 ${f(fx)} ${f(fy)}" dur="10s" repeatCount="indefinite"/>` : ""}</g>`);
    // l'emblème de la confrérie (inventé), peint en grand sur une place
    K.semis(1, 34, 3000, null, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="30" fill="url(#cf-pave)" stroke="#55585F"/><path d="M${f(x)} ${f(y - 22)}l14 30l-14 -8l-14 8z" fill="#B0122E" opacity=".85"/><path d="M${f(x)} ${f(y - 12)}l6 14l-6 -4l-6 4z" fill="#F4F1EA"/>`); });
    // la ville endormie : toits sombres, ruelles, places éclairées à la torche
    K.semis(140, () => 14 + r() * 12, 7000, null, (x, y, R) => { const w = R * 2, h = R * 1.4; s.push(`<g transform="rotate(${f((r() - .5) * 8)} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2 + 4)}" y="${f(y - h / 2 + 6)}" width="${f(w)}" height="${f(h)}" fill="#000" opacity=".5"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="url(#cf-tuile)"/><path d="M${f(x - w / 2)} ${f(y)}h${f(w)}" stroke="#1A1412" stroke-width="1.4"/></g>`); if (r() < .15) K.halo(x, y + h * .6, 14, "#FFB347", .5); });
    // la piste : ruelles pavées sombres, torches ; la lame cachée qui brille sur la ligne d'arrivée
    K.route([["#000", 38, ` opacity=".7" filter="url(#cf-flou)"`], ["#B0122E", 30], ["#14161C", 27], ["url(#cf-pave3)", 22]]);
    for (let i = 0; i < K.N; i += 24) { const [nx, ny] = K.nrm(i), sd = (i / 24) % 2 ? 1 : -1; K.halo(K.P[i][0] + nx * sd * 17, K.P[i][1] + ny * sd * 17, 18, "#FF9A3D", .75); }
    K.depart(); { const p0 = K.P[0], [nx, ny] = K.nrm(0); K.a.push(`<path d="M${f(p0[0] + nx * 22)} ${f(p0[1] + ny * 22)}l16 -3" stroke="#E8F0FF" stroke-width="2.2" stroke-linecap="round">${K.anime ? '<animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite"/>' : ""}</path>`); }
    // la simulation qui grésille sur les bords (souvenirs génétiques…)
    s.push(`<rect width="${W}" height="${H}" fill="url(#cf-hex)" opacity=".18"/><rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#7CF2FF" stroke-width="18" opacity=".12"/>`);
    for (let k = 0; k < 6; k++) { const y = r() * H; K.a.push(`<rect x="0" y="${f(y)}" width="${W}" height="${f(2 + r() * 4)}" fill="#7CF2FF" opacity="0">${K.anime ? `<animate attributeName="opacity" values="0;0;.35;0;0" dur="${(4 + r() * 4).toFixed(1)}s" begin="${(r() * 4).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</rect>`); }
    K.particules(20, "#FFB347", 2, "monte");
    return K.fin(`<rect width="${W}" height="${H}" fill="#191B21"/>`, "#0A1028", .2);
  }
  /* ---------- Octobre · La Route de l'Anneau (terres du milieu fantastiques) ---------- */
  function peindreAnneau(T, Z, def) {
    const K = kit(T, def, 103, "sa-"), { s, r, f, W, H } = K;
    // à l'ouest, le pays vert aux collines et aux maisons creusées ; à l'est, les terres de cendre, le volcan et la tour sombre
    s.push(`<linearGradient id="sa-sol" x1="0" x2="1"><stop offset="0" stop-color="#6FA552"/><stop offset=".45" stop-color="#7A9A55"/><stop offset=".62" stop-color="#5A4A3A"/><stop offset="1" stop-color="#2A1E1A"/></linearGradient>`);
    s.push(`<radialGradient id="sa-lave" r="50%"><stop offset="0" stop-color="#FFD27A"/><stop offset=".4" stop-color="#FF6A1A"/><stop offset="1" stop-color="#5A0E06" stop-opacity="0"/></radialGradient>`);
    // collines rondes et maisons creusées dans la colline (portes rondes) ; 4 portes aux couleurs des pilotes
    K.semis(14, () => 22 + r() * 10, 3000, (x, y) => x < W * .42, (x, y, R) => { s.push(`<ellipse cx="${f(x + 4)}" cy="${f(y + 6)}" rx="${f(R * 1.3)}" ry="${f(R)}" fill="#3E6A30" opacity=".6"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(R * 1.3)}" ry="${f(R)}" fill="#86BE60"/><ellipse cx="${f(x - R * .3)}" cy="${f(y - R * .3)}" rx="${f(R * .6)}" ry="${f(R * .4)}" fill="#A6D67A" opacity=".6"/>`); });
    const portes = []; K.semis(9, 7, 3000, (x, y) => x < W * .42, (x, y, R, k) => { const c2 = k < 4 ? COULEURS_J[k] : ["#2E6A3A", "#F2B33A", "#8A3A2A", "#3A5A8A", "#6A3A8A"][k - 4]; s.push(`<path d="M${f(x - 16)} ${f(y + 6)}q16 -26 32 0z" fill="#86BE60" stroke="#5A8A42"/><circle cx="${f(x)}" cy="${f(y + 1)}" r="6" fill="${c2}" stroke="#4A3626" stroke-width="1.5"/><circle cx="${f(x)}" cy="${f(y + 1)}" r="1" fill="#F7CF55"/><circle cx="${f(x - 10)}" cy="${f(y + 2)}" r="2.4" fill="#FFE6A8"/>`); K.halo(x - 10, y + 2, 8, "#FFD58A", .6); for (let q = 0; q < 4; q++) s.push(`<circle cx="${f(x - 12 + r() * 24)}" cy="${f(y + 10 + r() * 6)}" r="1.6" fill="${["#FF6FA8", "#F7D84A", "#FFFFFF"][q % 3]}"/>`); portes.push([x, y]); });
    K.semis(1, 30, 2000, (x, y) => x < W * .42, (x, y) => { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="28" fill="#5A8A42"/>`); K.arbre(x, y, 26, "#9ED36A", "#4F9A45", "#2A5A2A"); s.push(`<path d="M${f(x - 30)} ${f(y + 30)}h60" stroke="#C9A35A" stroke-width="3" stroke-dasharray="2 4"/>`); });   // le grand arbre de la fête
    // la forêt des elfes : arbres argentés lumineux
    K.semis(1, 60, 3000, (x, y) => x > W * .3 && x < W * .62, (x, y) => { for (let k = 0; k < 12; k++) { const t = r() * TAU, d = r() * 50; K.arbre(x + Math.cos(t) * d, y + Math.sin(t) * d, 12 + r() * 6, "#E8F4D8", "#B8D8A8", "#6A9A6A"); } K.halo(x, y, 70, "#F4FFD8", .35); K.prendre(x, y, 60); });
    // la porte de la mine des nains dans la montagne
    K.semis(1, 40, 3000, (x, y) => x > W * .35 && x < W * .65, (x, y) => { for (let k = 4; k >= 0; k--) s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(26 + k * 10)}" ry="${f(18 + k * 8)}" fill="${mixHex("#5A5A62", "#8A8A92", k / 4)}"/>`); s.push(`<path d="M${f(x - 10)} ${f(y + 12)}v-12a10 10 0 0 1 20 0v12z" fill="#1A1A22" stroke="#9AD8FF" stroke-width="1.4"/>`); K.halo(x, y + 4, 22, "#9AD8FF", .5, K.a); });
    // les terres de cendre : volcan en éruption, coulées de lave, tour sombre surmontée d'un brasier
    const vx = W * .84, vy = H * .3; for (let k = 5; k >= 0; k--) s.push(`<ellipse cx="${f(vx)}" cy="${f(vy)}" rx="${f(30 + k * 18)}" ry="${f(24 + k * 14)}" fill="${mixHex("#1A1210", "#4A3A32", k / 5)}"/>`);
    s.push(`<circle cx="${f(vx)}" cy="${f(vy)}" r="20" fill="url(#sa-lave)"/>`); for (let k = 0; k < 5; k++) { const t = .4 + k * .5; s.push(`<path d="M${f(vx)} ${f(vy)}q${f(Math.cos(t) * 40)} ${f(Math.sin(t) * 30)} ${f(Math.cos(t) * 90)} ${f(Math.sin(t) * 80)}" stroke="#FF6A1A" stroke-width="3" fill="none" opacity=".8"/>`); }
    K.a.push(`<circle cx="${f(vx)}" cy="${f(vy)}" r="14" fill="#FFB050">${K.anime ? '<animate attributeName="r" values="12;18;12" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.6;1" dur="1.6s" repeatCount="indefinite"/>' : ""}</circle>`); K.prendre(vx, vy, 100);
    const tx = W * .8, ty = H * .74; K.ombre(tx + 10, ty + 14, 22, 22, .6); s.push(`<polygon points="${f(tx - 18)},${f(ty)} ${f(tx - 10)},${f(ty - 18)} ${f(tx + 10)},${f(ty - 18)} ${f(tx + 18)},${f(ty)} ${f(tx + 10)},${f(ty + 18)} ${f(tx - 10)},${f(ty + 18)}" fill="#14100E" stroke="#3A2A24" stroke-width="2"/><path d="M${f(tx - 6)} ${f(ty)}l6 -10l6 10l-6 10z" fill="#2A1E1A"/>`);
    K.halo(tx, ty, 50, "#FF6A1A", .7, K.a); K.a.push(`<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="7" ry="3" fill="#FFD27A">${K.anime ? '<animate attributeName="rx" values="7;3;7" dur="4s" repeatCount="indefinite"/>' : ""}</ellipse>`); K.prendre(tx, ty, 60);
    K.semis(60, () => 6 + r() * 8, 3000, (x, y) => x > W * .65, (x, y, R) => { s.push(`<path d="M${f(x)} ${f(y)}l${f(R * .6)} ${f(-R)}l${f(R * .5)} ${f(R)}z" fill="#2A221E" stroke="#3E302A" stroke-width=".8"/>`); });
    // la compagnie des neuf qui marche sur la route ; l'anneau d'or qui brille au bord du chemin (clin d'œil)
    { const i0 = Math.floor(K.N * .3); K.a.push(`<g>${Array.from({ length: 9 }, (_, k) => `<circle cx="${f(k * -6)}" cy="0" r="2.4" fill="${["#7A6A4A", "#5A6A4A", "#4A4A5A", "#C9C9D0", "#7A5A3A", "#6A4A3A", "#5A5A3A", "#8A7A5A", "#3A3A3A"][k]}"/>`).join("")}${K.anime ? `<animateMotion dur="80s" repeatCount="indefinite" path="${K.piste}"/>` : ""}</g>`);
      const p = K.P[i0], [nx, ny] = K.nrm(i0); s.push(`<circle cx="${f(p[0] + nx * 22)}" cy="${f(p[1] + ny * 22)}" r="3.4" fill="none" stroke="#F7CF55" stroke-width="1.6"/>`); K.halo(p[0] + nx * 22, p[1] + ny * 22, 12, "#F7CF55", .8, K.a); }
    K.semis(160, () => 7 + r() * 8, 5000, (x, y) => x < W * .6, (x, y, R) => K.arbre(x, y, R, "#8DC25A", "#4F8A3A", "#2A4A22"));
    K.route([["#000", 36, ` opacity=".4" filter="url(#sa-flou)"`], ["#6A5236", 28], ["#8A7050", 20], ["#6A5236", 4, ` stroke-dasharray="2 10" opacity=".7"`]]);
    K.depart(); K.particules(50, "#C9B8A0", 2, "derive");
    return K.fin(`<rect width="${W}" height="${H}" fill="url(#sa-sol)"/>`, "#2A1A10", .12);
  }
  const PEINTS_NUIT = { confrerie: peindreConfrerie, anneau: peindreAnneau, chasseur: peindreChasseur, masques: peindreMasques, chocolat: peindreChocolat, terrier: peindreTerrier, cite: peindreCite, chateau: peindreChateau, armoire: peindreArmoire, basfonds: peindreBasfonds, megapole: peindreMegapole, plateau: peindrePlateau, solstice: peindreSolstice, envers: peindreEnvers, survivants: peindreSurvivants, dunes: peindreDunes, titans: peindreTitans, olympe: peindreOlympe };
  const PEINTS = { foret: { peindre: peindreForet, deco: decorForet }, garage: { peindre: peindreGarage, deco: decorGarage } };
  Object.keys(PEINTS_NUIT).forEach(k => { PEINTS[k] = { peindre: PEINTS_NUIT[k] }; });

  /* ---------- Construction de la scène statique ---------- */
  function construire(def, T, A, Z) {
    const sol = new Geo(), piste = new Geo(), eau = new Geo(), lum = [];
    const teinte = teinteur(A), r = alea(hashTxt(def.decor + def.pts.length)), D = DECORS[def.decor] || DECORS.parc, N = T.N, rue = !!def.rue;
    const tint = c => teinte ? teinte(c) : c;
    // sol : un grand plan, puis des taches de couleur pour la matière
    const ext = Math.max(T.rx, T.rz) * 3.2 + 600, cx = T.cx, cz = T.cz;
    sol.quad([cx - ext, 0, cz - ext], [cx + ext, 0, cz - ext], [cx + ext, 0, cz + ext], [cx - ext, 0, cz + ext], A.sol, 0, [0, 1, 0]);
    const so = sol.ov();
    for (let i = 0; i < 110; i++) { const x = cx + (r() - .5) * (T.rx * 2 + 500), z = cz + (r() - .5) * (T.rz * 2 + 500), s = 8 + r() * 26, a = r() * TAU, c = mel(A.sol, r() > .5 ? [1, 1, .9] : [0, 0, 0], .05 + r() * .06);
      if (T.dist(x, z) < DEMI + s) continue;
      const P = [0, 1, 2, 3, 4].map(k => [x + Math.cos(a + k * 1.26) * s * (.6 + r() * .4), .02, z + Math.sin(a + k * 1.26) * s * (.6 + r() * .4)]);
      for (let k = 1; k < 4; k++) so.tri(P[0], P[k], P[k + 1], c, 0, [0, 1, 0]); }
    if (A.synth) for (let i = -40; i <= 40; i++) { const o = i * 30; so.quad([cx + o - .3, .05, cz - ext], [cx + o + .3, .05, cz - ext], [cx + o + .3, .05, cz + ext], [cx + o - .3, .05, cz + ext], hex("#B03AFF"), 1, [0, 1, 0]); so.quad([cx - ext, .05, cz + o - .3], [cx + ext, .05, cz + o - .3], [cx + ext, .05, cz + o + .3], [cx - ext, .05, cz + o + .3], hex("#B03AFF"), 1, [0, 1, 0]); }
    // eau
    (def.eau || []).forEach(poly => { const P = poly.map(p => [p[0] * ECH, .25, p[1] * ECH]); for (let k = 1; k < P.length - 1; k++) eau.tri(P[0], P[k], P[k + 1], A.eau || hex("#2F6E9A"), A.nuit ? .1 : .05, [0, 1, 0]); });
    const surEau = (x, z) => (def.eau || []).some(poly => dansPoly(x / ECH, z / ECH, poly));
    // la piste, ses bords, ses vibreurs, ses murs
    const E = [], hauteur = i => T.Y[i] + .1;
    for (let i = 0; i < N; i++) E.push({ x: T.X[i], z: T.Z[i], nx: -T.TZ[i], nz: T.TX[i], y: hauteur(i), k: T.K[i] });
    const pt = (e, o, dy) => [e.x + e.nx * o, e.y + (dy || 0), e.z + e.nz * o];
    // à l'intérieur d'un virage serré, on rabote le décalage pour éviter les plis
    const off = (e, o) => { const rayon = Math.abs(e.k) > 1e-5 ? 1 / Math.abs(e.k) : 1e9, dedans = Math.sign(o) === Math.sign(e.k); return dedans ? Math.sign(o) * Math.min(Math.abs(o), rayon * .85) : o; };
    const P = (e, o, dy) => pt(e, off(e, o), dy), mk = piste.ov();
    const asph = A.piste, asph2 = mel(asph, [0, 0, 0], .08), blanc = tint(hex("#F2F4F7")), rouge = hex("#D62D2D"), nuitPiste = A.nuit ? .32 : 0;
    const vib = i => Math.abs(E[i].k) > .016;
    for (let i = 0; i < N; i++) {
      const a = E[i], b = E[(i + 1) % N], up = [0, 1, 0];
      piste.quad(P(a, DEMI), P(b, DEMI), P(b, -DEMI), P(a, -DEMI), Math.floor(i / 6) % 2 ? asph : asph2, nuitPiste, up);
      // lignes blanches de bord
      if (D.terre) { const orn = mel(asph, [0, 0, 0], .28); [-2.6, 2.6].forEach(o => mk.quad(P(a, o - .45, .02), P(b, o - .45, .02), P(b, o + .45, .02), P(a, o + .45, .02), orn, 0, up)); }
      else {
      mk.quad(P(a, DEMI - .35, .02), P(b, DEMI - .35, .02), P(b, DEMI - .9, .02), P(a, DEMI - .9, .02), A.synth ? hex("#22D3EE") : blanc, A.synth ? 1 : nuitPiste, up);
      mk.quad(P(a, -DEMI + .35, .02), P(b, -DEMI + .35, .02), P(b, -DEMI + .9, .02), P(a, -DEMI + .9, .02), A.synth ? hex("#FF4FD8") : blanc, A.synth ? 1 : nuitPiste, up); }
      // vibreurs dans les virages, sinon bas-côtés
      const kerb = vib(i) || vib((i + 2) % N) || vib((i - 2 + N) % N);
      [1, -1].forEach(sd => {
        const c1 = D.terre ? (Math.floor(i / 2) % 2 ? hex("#6E675E") : hex("#57514A")) : D.kerb && kerb ? hex(D.kerb[Math.floor(i / 2) % 2]) : kerb ? (Math.floor(i / 2) % 2 ? rouge : blanc) : A.bord;
        if (D.terre) { piste.quad(P(a, sd * DEMI), P(b, sd * DEMI), P(b, sd * (DEMI + 1.4), .25), P(a, sd * (DEMI + 1.4), .25), c1, 0, up); piste.quad(P(a, sd * (DEMI + 1.4), .25), P(b, sd * (DEMI + 1.4), .25), P(b, sd * (DEMI + 6)), P(a, sd * (DEMI + 6)), mel(A.bord, [0, 0, 0], .05 * (i % 3)), 0, up); }
        else piste.quad(P(a, sd * DEMI), P(b, sd * DEMI), P(b, sd * (DEMI + (kerb ? 2 : 0) + (rue ? 1.2 : 6))), P(a, sd * (DEMI + (kerb ? 2 : 0) + (rue ? 1.2 : 6))), kerb ? c1 : mel(A.bord, [0, 0, 0], .04 * (i % 3)), kerb ? nuitPiste : 0, up);
        // murs (rue) ou rails : un panneau sur deux de la couleur du circuit
        const ow = sd * (DEMI + (rue ? 3.4 : D.terre ? 9 : 11)), hw = rue ? 1.3 : D.terre ? .6 : .9, cw = Math.floor(i / 4) % 2 ? A.murs[0] : A.murs[1], emw = A.synth ? .9 : A.nuit ? .3 : 0;
        if (!(def.pitlane && sd < 0 && i < 12)) {
          const a1 = P(a, ow), b1 = P(b, ow), a2 = P(a, ow, hw), b2 = P(b, ow, hw);
          piste.quad(a1, b1, b2, a2, cw, emw, [-a.nx * sd, 0, -a.nz * sd]);
        }
      });
      // relief : talus sous la piste (ou piliers quand une autre portion passe dessous)
      if (a.y > 1.2) {
        const dessous = T.dist(a.x, a.z, a.y - 4) < DEMI + 10;
        if (dessous) { if (i % 6 === 0) [1, -1].forEach(sd => { const c = P(a, sd * (DEMI + 1)); piste.boite(c[0], 0, c[2], 1.6, a.y, 1.6, hex("#B9C1CB")); }); piste.quad(P(a, DEMI + 1), P(b, DEMI + 1), P(b, -DEMI - 1), P(a, -DEMI - 1), hex("#8E96A1"), 0, [0, -1, 0]); }
        else [1, -1].forEach(sd => { const o = sd * (DEMI + (rue ? 4 : 6)), g = sd * (DEMI + (rue ? 4 : 6) + a.y * 1.6); piste.quad(P(a, o), P(b, o), [b.x + b.nx * g, 0, b.z + b.nz * g], [a.x + a.nx * g, 0, a.z + a.nz * g], mel(A.bord, [0, 0, 0], .12), 0, [a.nx * sd, .6, a.nz * sd]); });
      }
    }
    // ligne d'arrivée en damier, cases de grille
    const e0 = E[0];
    for (let r2 = 0; r2 < 2; r2++) for (let c = 0; c < 10; c++) { const o0 = -DEMI + c * 1.5, s0 = r2 * 1.2 - 1.2, d = [T.TX[0], T.TZ[0]];
      const q = (o, s) => [e0.x + e0.nx * o + d[0] * s, e0.y + .03, e0.z + e0.nz * o + d[1] * s];
      mk.quad(q(o0, s0), q(o0 + 1.5, s0), q(o0 + 1.5, s0 + 1.2), q(o0, s0 + 1.2), (r2 + c) % 2 ? hex("#111318") : blanc, nuitPiste, [0, 1, 0]); }
    for (let g = 0; g < 6; g++) { const s = -10 - g * 9, o = g % 2 ? -3 : 3, p = T.a(s, o), d = [p.tx, p.tz], n = [-p.tz, p.tx];
      const q = (u, w) => [p.x + n[0] * u + d[0] * w, p.y + .13, p.z + n[1] * u + d[1] * w];
      mk.quad(q(-2, 0), q(2, 0), q(2, .4), q(-2, .4), blanc, nuitPiste, [0, 1, 0]); }
    // zones d'atout et de piège peintes sur la piste
    [[Z.atout, Z.atoutCol], [Z.piege, Z.piegeCol]].forEach(([zz, col]) => {
      if (!zz || !col) return; const c = hex(col);
      for (let s = zz.s0; s < zz.s1; s += 3) { const p = T.a(s, 0), q = T.a(s + 1.6, 0), n = [-p.tz, p.tx], m = [-q.tz, q.tx];
        mk.quad([p.x + n[0] * (DEMI - 1), p.y + .14, p.z + n[1] * (DEMI - 1)], [q.x + m[0] * (DEMI - 1), q.y + .14, q.z + m[1] * (DEMI - 1)], [q.x + m[0] * (DEMI - 2.2), q.y + .14, q.z + m[1] * (DEMI - 2.2)], [p.x + n[0] * (DEMI - 2.2), p.y + .14, p.z + n[1] * (DEMI - 2.2)], c, .9, [0, 1, 0]);
        mk.quad([p.x - n[0] * (DEMI - 1), p.y + .14, p.z - n[1] * (DEMI - 1)], [q.x - m[0] * (DEMI - 1), q.y + .14, q.z - m[1] * (DEMI - 1)], [q.x - m[0] * (DEMI - 2.2), q.y + .14, q.z - m[1] * (DEMI - 2.2)], [p.x - n[0] * (DEMI - 2.2), p.y + .14, p.z - n[1] * (DEMI - 2.2)], c, .9, [0, 1, 0]); }
    });
    // portique de départ, stands et tribune le long de la ligne droite
    const p0 = T.a(0, 0), cap0 = Math.atan2(-p0.tz, p0.tx), n0 = [-p0.tz, p0.tx];
    [1, -1].forEach(sd => piste.boite(p0.x + n0[0] * sd * (DEMI + 2), p0.y, p0.z + n0[1] * sd * (DEMI + 2), 1, 9, 1, hex("#3A414C")));
    piste.boite(p0.x, p0.y + 9, p0.z, 1.6, 1.6, (DEMI + 3) * 2, hex("#2A2F38"), 0, cap0);
    const stands = new Geo(), lgS = 110;
    stands.boite(0, 0, 0, lgS, 7, 12, tint(hex("#E3E7EC"))); stands.boite(0, 7, 0, lgS + 2, .8, 14, tint(hex("#3A414C")));
    for (let k = 0; k < 10; k++) stands.quad([-lgS / 2 + 4 + k * 10.6, .2, 6.05], [-lgS / 2 + 12 + k * 10.6, .2, 6.05], [-lgS / 2 + 12 + k * 10.6, 5, 6.05], [-lgS / 2 + 4 + k * 10.6, 5, 6.05], hex(["#FF5A5F", "#4C9AFF", "#F7CF55", "#3DDC97", "#9B87FF"][k % 5]), A.nuit ? .8 : .2, [0, 0, 1]);
    const ps = T.a(-30, -(DEMI + (rue ? 12 : 22)));
    sol.poser(stands, ps.x, ps.y, ps.z, Math.atan2(-ps.tz, ps.tx) + PI);
    const trib = new Geo(), lgT = 120, rt = alea(77), foule = ["#FF5A5F", "#4C9AFF", "#F7CF55", "#3DDC97", "#FFFFFF", "#FF8A3D", "#B57BFF"];
    for (let k = 0; k < 7; k++) { trib.boite(0, 0, -k * 2.4, lgT, 1.2 + k * 1.5, 2.4, tint(hex("#AEB7C2"))); for (let f = 0; f < 40; f++) { const x = -lgT / 2 + 1.5 + f * (lgT - 3) / 40; trib.boite(x + (rt() - .5), 1.2 + k * 1.5, -k * 2.4 + .3, 1.1, .9, .9, hex(foule[Math.floor(rt() * foule.length)]), A.nuit ? .4 : 0); } }
    trib.boite(0, 13, -8, lgT + 2, .6, 20, tint(hex("#E3E7EC"))); for (let x = -lgT / 2; x <= lgT / 2; x += 20) trib.boite(x, 0, -17, .8, 13, .8, hex("#7D8590"));
    const pt2 = T.a(-20, DEMI + (rue ? 8 : 18));
    sol.poser(trib, pt2.x, pt2.y, pt2.z, Math.atan2(-pt2.tz, pt2.tx) + PI);
    // décors posés au hasard, loin de la piste
    const loin = (x, z, m) => T.dist(x, z) > m;
    // les monuments d'abord : les autres décors s'écartent de la place qu'ils occupent
    const occupe = []; (def.reperes || []).forEach(R => { const o = repere(sol, R, T, A, teinte, [[ps.x, ps.z, 70], [pt2.x, pt2.z, 75]], lum); if (o) occupe.push(...o); });
    const rotors = [];
    if (def.peint && PEINTS[def.peint] && PEINTS[def.peint].deco) occupe.push(...PEINTS[def.peint].deco({ T, A, sol, eau, lum, rotors, pistePose: (g, x, z, cap) => sol.poser(g, x, 0, z, cap, 1) }));
    const pris = (x, z) => occupe.some(o => Math.hypot(x - o[0], z - o[1]) < o[2]);
    // plateau de jeu : de grandes cases sur tout le sol
    if (def.damier) for (let a = -40; a <= 40; a++) for (let b = -40; b <= 40; b++) { if ((a + b) % 2) continue; const x = cx + a * 26, z = cz + b * 26; if (Math.abs(x - cx) > ext * .7 || Math.abs(z - cz) > ext * .7 || T.dist(x + 13, z + 13) < DEMI + 26) continue;
      so.quad([x, .04, z], [x + 26, .04, z], [x + 26, .04, z + 26], [x, .04, z + 26], hex((a * 7 + b * 3) % 5 === 0 ? "#C8283A" : "#3A2F4A"), A.nuit ? .05 : 0, [0, 1, 0]); }
    (D.obj || []).forEach(([type, nb, ou]) => {
      if (type === "lampadaire") return;
      let posees = 0, essais = 0; nb = Math.round(nb * 1.1);
      while (posees < nb && essais++ < nb * 30) {
        const x = cx + (r() - .5) * (T.rx * 2 + (ou === "pres" ? 120 : 360)), z = cz + (r() - .5) * (T.rz * 2 + (ou === "pres" ? 120 : 360));
        const d = T.dist(x, z), mini = type === "champ" ? 50 : type === "colline" ? 90 : type === "montagne" ? 130 : type === "gratteciel" || type === "neon" || type === "tourholo" || type === "usine" ? 34 : rue ? 18 : 22;
        if (d < mini || pris(x, z)) continue;
        if (ou === "eau" ? !surEau(x, z) : surEau(x, z)) continue;
        if (ou === "pres" && d > 70) continue;
        if (Math.hypot(x - ps.x, z - ps.z) < 70 || Math.hypot(x - pt2.x, z - pt2.z) < 75) continue;
        const g = objet(type, r, A); sol.poser(g, x, 0, z, r() * TAU, 1, SANS_TEINTE.has(type) ? null : teinte); posees++;
        if (type === "projecteur") lum.push([x, 23, z, 1, .95, .8, 26]);
        if (type === "lanterne") lum.push([x, 4.8, z, 1, .85, .55, 10]);
      }
    });
    // circuits urbains : des façades serrées derrière les murs ; ailleurs, des bosquets le long de la piste
    const typeRue = { monaco: "villa", nuitville: "gratteciel", vegas: "neon", corniche: "immeuble", basfonds: "usine", androides: "tourholo", plateau: "pion" }[def.decor], typeBord = { parc: "arbre", japon: "cerisier", ile: "arbre", foret: "pin", monza: "arbre", campagne: "arbre", collines: "maison", miami: "palmier", marina: "palmier", desert: "rocher",
      lucioles: "pin", chateau: "pin", armoire: "pin", arene: "cube", solstice: "arbre", envers: "arbremort", survivants: "champignon", dunes: "rocher", titans: "rocher", olympe: "colonne" }[def.decor];
    for (let i = 0; i < N; i += Math.max(1, Math.round((typeRue ? 19 : 15) / T.ds))) [1, -1].forEach(sd => {
      if (r() < (typeRue ? .2 : .5)) return;
      const e = E[i], o = sd * (DEMI + (typeRue ? 15 + r() * 8 : 18 + r() * 30)), x = e.x + e.nx * o, z = e.z + e.nz * o;
      if (T.dist(x, z) < (typeRue ? DEMI + 10 : DEMI + 14) || surEau(x, z)) return;
      if (Math.hypot(x - ps.x, z - ps.z) < 70 || Math.hypot(x - pt2.x, z - pt2.z) < 75 || pris(x, z)) return;
      const ty = typeRue || typeBord; if (!ty) return;
      const g = objet(ty, r, A); sol.poser(g, x, typeRue ? 0 : 0, z, Math.atan2(-e.nz, e.nx) * 0 + (typeRue ? Math.atan2(-T.TZ[i], T.TX[i]) : r() * TAU), typeRue === "gratteciel" ? .8 : 1, SANS_TEINTE.has(ty) ? null : teinte);
    });
    // lampadaires le long des circuits de nuit (et de ville)
    if (!(def.peint && PEINTS[def.peint] && PEINTS[def.peint].deco) && (A.nuit || (D.obj || []).some(o => o[0] === "lampadaire"))) for (let i = 0; i < N; i += Math.round(64 / T.ds)) {
      const sd = Math.floor(i / Math.round(64 / T.ds)) % 2 ? 1 : -1, e = E[i], o = sd * (DEMI + (rue ? 5 : 13));
      const pp = P(e, o), g = objet("lampadaire", r, A); sol.poser(g, pp[0], pp[1] - .1, pp[2], Math.atan2(e.nz * -sd, e.nx * -sd) * -1 + 0, 1);
      if (A.nuit) lum.push([pp[0] - e.nx * sd * 1.2, pp[1] + 8.8, pp[2] - e.nz * sd * 1.2, 1, .9, .7, 13]);
    }
    return { sol, piste, eau, lum, stands: ps, portique: p0, rotors };
  }

  /* ---------- Voiture : une F1 low-poly aux couleurs du pilote ---------- */
  function voiture(v) {
    const g = new Geo(), c = hex(v.couleur || "#4C9AFF"), lv = v.livree || "couleur";
    const metal = { chrome: "#C9D2DC", or: "#E8C15A", oranime: "#F2C94C", platine: "#E5E8EC", orrose: "#F2B8A6", rubis: "#B0122E", galaxie: "#2B1B5A" }[lv];
    const neon = lv === "neon", corps = neon ? hex("#0B0D12") : metal ? hex(metal) : c, deux = neon ? c : metal ? c : mel(c, [1, 1, 1], .75), em = neon ? 1 : 0;
    const carbone = hex("#15181E"), sombre = hex("#22262E");
    // fond plat
    g.boite(-.2, .18, 0, 7.4, .16, 3.0, carbone);
    // coque : de l'arrière au museau, en tronçons qui s'affinent
    const tr = [[-3.5, .5, 1.05, .55], [-2.4, .45, 1.15, .62], [-1.0, .4, 1.25, .72], [.6, .4, 1.0, .68], [2.0, .42, .7, .5], [3.4, .38, .42, .38], [4.3, .33, .22, .26]];
    for (let i = 0; i < tr.length - 1; i++) {
      const a = tr[i], b = tr[i + 1], A1 = (s, h) => [a[0], a[1] + h * a[3] * 2, s * a[2] / 2], B1 = (s, h) => [b[0], b[1] + h * b[3] * 2, s * b[2] / 2];
      g.bloc([A1(-1, 0), B1(-1, 0), B1(1, 0), A1(1, 0), A1(-1, 1), B1(-1, 1), B1(1, 1), A1(1, 1)], corps, 0, { 1: i >= 3 && !neon && !metal ? deux : corps, em: neon ? [0, .0, 1, 0, 1, 0] : null });
    }
    // pontons
    [1, -1].forEach(s => { g.boite(-.6, .3, s * 1.05, 3.2, .62, .95, corps); g.boite(.95, .3, s * 1.05, .2, .55, .9, carbone); if (neon) g.boite(-.6, .93, s * 1.05, 3.2, .06, .1, c, 1); });
    // capot moteur avec aileron de requin, prise d'air
    g.boite(-1.8, .95, 0, 2.8, .45, .7, corps); g.boite(-2.2, 1.35, 0, 2.0, .5, .08, neon ? c : deux, em); g.boite(-.55, 1.15, 0, .5, .4, .45, carbone);
    // cockpit, casque, halo
    g.boite(.1, .95, 0, 1.3, .18, .8, carbone);
    g.boule(-.05, 1.25, 0, .3, hex(v.casque || v.couleur || "#ffffff"), v.casqueEm ? 1 : 0, 1, true);
    g.boite(.65, 1.0, 0, .12, .5, .12, hex("#30353D")); [1, -1].forEach(s => g.bloc([[-.35, 1.45, s * .38], [.65, 1.45, s * .14], [.65, 1.52, s * .14], [-.35, 1.52, s * .38], [-.35, 1.5, s * .44], [.65, 1.5, s * .2], [.65, 1.57, s * .2], [-.35, 1.57, s * .44]], hex("#30353D")));
    // aileron avant
    g.boite(4.0, .14, 0, .75, .1, 3.6, neon ? c : deux, em); g.boite(3.85, .24, 0, .45, .08, 3.4, corps); [1, -1].forEach(s => g.boite(4.0, .14, s * 1.78, .9, .45, .08, sombre));
    // aileron arrière
    g.boite(-3.75, 1.3, 0, .6, .12, 2.5, corps); g.boite(-3.65, 1.48, 0, .4, .08, 2.5, neon ? c : deux, em); [1, -1].forEach(s => g.boite(-3.7, .35, s * 1.25, .9, 1.25, .08, corps)); g.boite(-3.5, .4, 0, .3, .9, .25, carbone);
    // feu arrière
    g.boite(-3.95, .55, 0, .1, .22, .3, hex("#FF2A2A"), 1);
    return g;
  }
  function roue(r, l) { const g = new Geo(), n = 12, noir = hex("#101216"), jante = hex("#C9CED6");
    for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU, P = (t, z, rr) => [Math.cos(t) * rr, Math.sin(t) * rr, z];
      g.quad(P(a, -l / 2, r), P(b, -l / 2, r), P(b, l / 2, r), P(a, l / 2, r), i % 2 ? noir : hex("#191C21"), 0, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0]);
      [1, -1].forEach(s => { g.tri([0, 0, s * l / 2], P(a, s * l / 2, r), P(b, s * l / 2, r), noir, 0, [0, 0, s]); g.tri([0, 0, s * (l / 2 + .01)], P(a, s * (l / 2 + .01), r * .55), P(b, s * (l / 2 + .01), r * .55), i % 3 ? jante : hex("#F7CF55"), 0, [0, 0, s]); }); }
    return g; }

  /* ---------- WebGL ---------- */
  const VS = "attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;uniform mat4 uPV;uniform mat4 uM;varying vec3 vN;varying vec4 vC;varying vec3 vW;void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=(uM*vec4(aN,0.)).xyz;vC=aC;gl_Position=uPV*w;}";
  const FS = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec3 vN;varying vec4 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uSunC;uniform vec3 uSky;uniform vec3 uGnd;uniform float uAmb;uniform vec3 uFog;uniform float uDens;uniform vec3 uCam;uniform float uSpec;uniform float uFlash;uniform vec4 uTint;uniform float uT;uniform float uEau;" +
    "void main(){vec3 n=normalize(vN);if(uEau>0.){n=normalize(n+vec3(sin(vW.x*.15+uT*1.3)*.06,0.,cos(vW.z*.13+uT*1.1)*.06));}" +
    "float d=dot(n,uSun);float dif=max(d,0.)*.85+abs(d)*.15;vec3 hemi=mix(uGnd,uSky,n.y*.5+.5);vec3 base=vC.rgb*uTint.rgb;" +
    "vec3 col=base*(hemi*uAmb+uSunC*dif);vec3 v=normalize(uCam-vW);vec3 h=normalize(uSun+v);col+=pow(max(dot(n,h),0.),48.)*uSpec*uSunC*.9;" +
    "if(uSpec>0.){float f=pow(1.-max(dot(n,v),0.),3.);col=mix(col,uSky*.9,f*uSpec*.5);}" +
    "float e=max(vC.a,uTint.a);col=mix(col,base*1.25,e);col+=uFlash*base*.5;" +
    "float dist=length(vW-uCam);float fo=1.-exp(-dist*uDens);gl_FragColor=vec4(mix(col,uFog,clamp(fo,0.,1.)),1.);}";
  const VS_CIEL = "attribute vec3 aP;uniform mat4 uPV;uniform vec3 uCam;varying vec3 vD;void main(){vD=aP;gl_Position=uPV*vec4(uCam+aP*1500.,1.);gl_Position.z=gl_Position.w*.9999;}";
  const FS_CIEL = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec3 vD;uniform vec3 uHaut;uniform vec3 uHor;uniform vec3 uFog;uniform vec3 uSun;uniform vec3 uSunC;uniform float uNuit;uniform float uSynth;uniform float uFlash;" +
    "float hs(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}" +
    "void main(){vec3 d=normalize(vD);float t=d.y;vec3 c=mix(uHor,uHaut,smoothstep(0.,mix(.55,.16,uSynth),t));if(t<0.)c=mix(uHor,uFog,smoothstep(0.,-.08,t));" +
    "float s=max(dot(d,uSun),0.);c+=uSunC*(pow(s,800.)*3.+pow(s,12.)*.25)*(1.-uSynth);" +
    "if(uSynth>0.){float r=acos(clamp(s,-1.,1.));if(r<.32&&t>-.01){float bande=step(.5,fract(t*38.));vec3 sc=mix(vec3(1.,.85,.3),vec3(1.,.2,.6),clamp(1.-(t+.02)/.3,0.,1.));c=mix(c,sc,t>.12||bande>.5?1.:0.);}}" +
    "if(uNuit>0.&&t>0.){vec3 q=floor(d*420.);float st=step(.9975,hs(q));c+=vec3(st)*uNuit*smoothstep(0.,.3,t)*.9;}" +
    "c+=uFlash*.6;gl_FragColor=vec4(c,1.);}";
  const VS_FX = "attribute vec3 aP;attribute vec4 aC;uniform mat4 uPV;varying vec4 vC;void main(){vC=aC;gl_Position=uPV*vec4(aP,1.);}";
  const FS_FX = "precision mediump float;varying vec4 vC;void main(){gl_FragColor=vC;}";
  const VS_PT = "attribute vec3 aP;attribute vec4 aC;attribute float aS;uniform mat4 uPV;uniform float uH;varying vec4 vC;void main(){vC=aC;vec4 p=uPV*vec4(aP,1.);gl_Position=p;gl_PointSize=clamp(aS*uH/max(p.w,1.),1.,96.);}";
  const FS_PT = "precision mediump float;varying vec4 vC;void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;float a=smoothstep(1.,0.,r);gl_FragColor=vec4(vC.rgb,vC.a*a*a);}";
  const VS_PLUIE = "attribute vec4 aS;uniform mat4 uPV;uniform vec3 uCam;uniform float uT;uniform float uV;uniform float uLong;uniform float uNeige;varying float vA;" +
    "void main(){float B=90.;vec3 p=vec3(aS.x*B-B*.5,mod(aS.y*80.-uT*uV,80.)-25.,aS.z*B-B*.5);p.x+=sin(uT*.8+aS.y*30.)*uNeige*1.5;p+=uCam;p.x=uCam.x+mod(p.x-uCam.x+B*.5,B)-B*.5;p.y+=aS.w*uLong;p.x+=aS.w*uLong*.12;vA=1.-aS.w*.6;gl_Position=uPV*vec4(p,1.);gl_PointSize=uNeige>0.?3.:1.;}";
  const FS_PLUIE = "precision mediump float;varying float vA;uniform vec4 uC;void main(){gl_FragColor=vec4(uC.rgb,uC.a*vA);}";

  function programme(gl, vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {}, nb = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nb; i++) { const u = gl.getActiveUniform(p, i); U[u.name] = gl.getUniformLocation(p, u.name); }
    const At = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); At[a.name] = gl.getAttribLocation(p, a.name); }
    return { p, U, A: At };
  }
  function tampon(gl, g) { const f = g.f || new Float32Array(g.d), b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, f, gl.STATIC_DRAW); return { b, n: f.length / 10 }; }
  /* Un seul contexte WebGL, réutilisé d'un circuit à l'autre (en créer un à chaque fois est lent et iOS en limite le nombre) */
  const RESERVE = [];
  function contexte() {
    while (RESERVE.length) { const c = RESERVE.pop(); if (!c.gl.isContextLost()) return c; }
    const cv = document.createElement("canvas"); cv.className = "p3-cv";
    const gl = cv.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" }) || cv.getContext("experimental-webgl");
    if (!gl) throw new Error("webgl");
    const ciel = new Geo(); ciel.boule(0, 0, 0, 1, [1, 1, 1], 0, 1, true);
    const feu = new Geo(); feu.boule(0, 0, 0, .7, [1, 1, 1]);
    return { cv, gl, PL: programme(gl, VS, FS), PC: programme(gl, VS_CIEL, FS_CIEL), PF: programme(gl, VS_FX, FS_FX), PP: programme(gl, VS_PT, FS_PT), PR: programme(gl, VS_PLUIE, FS_PLUIE),
      BC: tampon(gl, ciel), FEU: tampon(gl, feu), roueAv: tampon(gl, roue(.55, .5)), roueAr: tampon(gl, roue(.62, .7)) };
  }
  /* Scènes déjà construites, gardées en mémoire : revenir sur un mois ne recalcule rien */
  const SCENES = new Map();
  function sceneDe(cle, fab) {
    if (SCENES.has(cle)) { const v = SCENES.get(cle); SCENES.delete(cle); SCENES.set(cle, v); return v; }
    const S = fab(), fige = g => ({ f: new Float32Array(g.d) });
    const v = { sol: fige(S.sol), solOv: fige(S.sol.ov()), piste: fige(S.piste), pisteOv: fige(S.piste.ov()), eau: S.eau.n ? fige(S.eau) : null, lum: S.lum, portique: S.portique, rotors: (S.rotors || []).map(o => ({ f: new Float32Array(o.g.d), x: o.x, y: o.y, z: o.z, cap: o.cap, v: o.v })) };
    SCENES.set(cle, v); while (SCENES.size > 4) SCENES.delete(SCENES.keys().next().value);
    return v;
  }
  function lier(gl, P, t) { gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.vertexAttribPointer(P.A.aP, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(P.A.aN, 3, gl.FLOAT, false, 40, 12); gl.vertexAttribPointer(P.A.aC, 4, gl.FLOAT, false, 40, 24); }

  function supporte() { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }

  /* ---------- Placement des voitures sur la piste, à partir des points ---------- */
  /** V16.3 · position de chaque voiture : la distance suit les points sans jamais sauter ;
      chacun a son couloir (ordre de départ) : seul, il se rapproche de la trajectoire idéale, près d'un rival il s'écarte en douceur.
      Plus de téléportation de 11 m ni de changement de voie brutal quand quelqu'un double. */
  function cibles(pts, tour, L, ordreDepart, grille) {
    const noms = Object.keys(pts).sort((a, b) => pts[b] - pts[a] || (ordreDepart ? ordreDepart.indexOf(a) - ordreDepart.indexOf(b) : 0));
    const ordre = ordreDepart && ordreDepart.length ? ordreDepart : noms, nb = Math.max(ordre.length, noms.length), pas = Math.min(3.6, 13 / Math.max(1, nb - 1));
    const out = {};
    noms.forEach((n, j) => { const k = Math.max(0, ordre.indexOf(n)); out[n] = { s: (pts[n] / tour) * L - 4 - (grille && grille.indexOf(n) >= 0 ? grille.indexOf(n) * 9 : 0), base: (k - (nb - 1) / 2) * pas, rang: j + 1 }; });
    noms.forEach(n => { const a = out[n]; let p = 0;
      noms.forEach(m => { if (m === n) return; let d = Math.abs(out[m].s - a.s) % L; d = Math.min(d, L - d); p = Math.max(p, clamp(1 - (d - 6) / 22, 0, 1)); });
      a.voie = a.base * (.3 + .7 * p * p * (3 - 2 * p)); });
    return out;
  }

  /* ============================================================
     Instance 3D
     ============================================================ */
  function monter3D(boite, o) {
    const C = contexte(), cv = C.cv, gl = C.gl, PL = C.PL, PC = C.PC, PF = C.PF, PP = C.PP, PR = C.PR, BC = C.BC, roueAv = C.roueAv, roueAr = C.roueAr;
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", o.titre || "Circuit"); cv.width = 2; cv.height = 2;
    boite.appendChild(cv);
    const def = TRACES[o.circuit] || TRACES.melbourne, T = echantillonner(def), A = ambiance(def, o.meteo, o.ambiance), Z = zones(T);
    Z.atoutCol = o.atoutCol || null; Z.piegeCol = o.piegeCol || null;
    const t0c = performance.now();
    const S = sceneDe([o.circuit, o.ambiance || "", A.nuit, Z.atoutCol, Z.piegeCol].join("|"), () => construire(def, T, A, Z));
    const B = { sol: tampon(gl, S.sol), solOv: tampon(gl, S.solOv), piste: tampon(gl, S.piste), pisteOv: tampon(gl, S.pisteOv), eau: S.eau ? tampon(gl, S.eau) : null };
    const RO = (S.rotors || []).map(x => Object.assign({ b: tampon(gl, x) }, x));
    const V = (o.voitures || []).map(v => ({ v, b: tampon(gl, voiture(v)), s: 0, voie: 0, rang: 0, rot: 0, hist: [], x: 0, y: 0, z: 0, cap: 0, vit: 0 }));
    // lumières (lampadaires, projecteurs) en sprites additifs
    const LUM = S.lum, bL = gl.createBuffer(); { const d = []; LUM.forEach(l => d.push(l[0], l[1], l[2], l[3], l[4], l[5], A.nuit ? .55 : 0, l[6] * 1.6)); gl.bindBuffer(gl.ARRAY_BUFFER, bL); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); }
    // pluie / neige
    const nbP = A.pluie ? Math.round(1600 * A.pluie) : A.neige ? 1400 : 0, bP = gl.createBuffer();
    if (nbP) { const d = [], r = alea(42); for (let i = 0; i < nbP; i++) { const x = r(), y = r(), z = r(); d.push(x, y, z, 0); if (!A.neige) d.push(x, y, z, 1); } gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); }
    const bFX = gl.createBuffer(), bPT = gl.createBuffer();
    const DPR = Math.min(1.5, window.devicePixelRatio || 1);
    const I = { q: DPR, ft: 16, lents: 0, cssW: 1, cssH: 1, tConstr: Math.round(performance.now() - t0c), cv, gl, T, A, Z, V, mode: o.camera || "tv", focus: o.focus || (V[0] && V[0].v.nom), pts: Object.assign({}, o.pts || {}), anim: null, t0: performance.now(), cam: null, cible: null,
      orbite: 0, zoom: 1, tir: null, actif: true, dernier: 0, inactif: 0, feux: 0, flash: 0, prochainEclair: 3, artifice: [], ordreDepart: (o.voitures || []).map(v => v.nom), feuxDepart: -1 };
    const placer = (instant) => {
      const c = cibles(I.pts, o.tour || 25, T.L, I.ordreDepart, o.grille);
      V.forEach(x => { const t = c[x.v.nom]; if (!t) return; x.rang = t.rang; if (instant) { x.s = t.s; x.voie = t.voie; } else { x.s = t.s; x.voie = lisse(x.voie, t.voie, .06); } });
    };
    placer(true);
    // ----- caméra -----
    function voitureDe(n) { return V.find(x => x.v.nom === n) || V[0]; }
    function poseVoiture(x) {
      const p = T.a(x.s, x.voie); x.x = p.x; x.y = p.y; x.z = p.z; x.cap = Math.atan2(-p.tz, p.tx); x.tang = Math.atan(p.pente || 0); x.tx = p.tx; x.tz = p.tz;
    }
    function camVoulue(dt) {
      const asp = cv.width / Math.max(1, cv.height);
      if (I.mode === "helico") {
        if (!I.tir && ANIM()) I.orbite += dt * .05;
        const fov = .9, rv = Math.max(T.rx, T.rz / Math.min(1, asp * .9) * (asp < 1 ? 1.25 : 1)), dist = rv / Math.tan(fov / 2) * .92 * I.zoom;
        const a = I.orbite + .6, h = dist * .72;
        return { e: [T.cx + Math.cos(a) * dist * .62, h, T.cz + Math.sin(a) * dist * .62], c: [T.cx, 0, T.cz], fov };
      }
      const x = voitureDe(I.focus); if (!x) return null;
      if (I.mode === "bord") {
        return { e: [x.x - x.tx * 1.6, x.y + 3.1, x.z - x.tz * 1.6], c: [x.x + x.tx * 40, x.y + .6, x.z + x.tz * 40], fov: 1.05 };
      }
      // la caméra suit la PISTE derrière la voiture (et pas une ligne droite) : dans les virages, elle ne traverse plus les décors
      const rue = !!def.rue;
      if (!I.tir && !I.anim && ANIM()) I.orbite += dt * .12;
      const d = (rue ? 18 : 24) * I.zoom, h = (rue ? 13 : 9) * I.zoom + 3;
      const arr = T.a(x.s - d, x.voie * .4), sway = I.anim ? 0 : Math.sin(I.orbite) * (I.tir ? 1.2 : .5);
      const ox = arr.x - x.x, oz = arr.z - x.z, c = Math.cos(sway), sn = Math.sin(sway);
      return { e: [x.x + ox * c - oz * sn, Math.max(arr.y, x.y) + h, x.z + ox * sn + oz * c], c: [x.x + x.tx * 9, x.y + 1.2, x.z + x.tz * 9], fov: .95 };
    }
    // ----- dessin -----
    let PV = null, VP = null, H = 1;
    function dessiner(t, dt) {
      const W = cv.width, Hh = cv.height; H = Hh; gl.viewport(0, 0, W, Hh);
      V.forEach(poseVoiture);
      const cible = camVoulue(dt); if (!cible) return;
      if (!I.cam || I.saut) { I.cam = { e: cible.e.slice(), c: cible.c.slice(), fov: cible.fov }; I.saut = false; }
      const k = 1 - Math.exp(-dt * (I.mode === "bord" ? 12 : I.anim && I.mode === "tv" ? 8 : 3.2));
      let ecart = 0; for (let i = 0; i < 3; i++) { I.cam.e[i] = lisse(I.cam.e[i], cible.e[i], k); I.cam.c[i] = lisse(I.cam.c[i], cible.c[i], k); ecart += Math.abs(I.cam.e[i] - cible.e[i]) + Math.abs(I.cam.c[i] - cible.c[i]); } I.cam.fov = lisse(I.cam.fov, cible.fov, k); I.enRoute = ecart > .3;
      // la caméra ne passe jamais sous le sol
      I.cam.e[1] = Math.max(I.cam.e[1], 1.5);
      const dc = Math.hypot(I.cam.e[0] - I.cam.c[0], I.cam.e[1] - I.cam.c[1], I.cam.e[2] - I.cam.c[2]), pres = clamp(dc * .035, .5, 14);
      const proj = persp(I.cam.fov, W / Math.max(1, Hh), pres, 3600), vue = regard(I.cam.e, I.cam.c); PV = mul(proj, vue); VP = { proj, vue };
      // éclairs
      if (A.eclairs) { I.prochainEclair -= dt; if (I.prochainEclair < 0) { I.flash = 1; I.prochainEclair = 3 + Math.random() * 6; } }
      I.flash = Math.max(0, I.flash - dt * 3); const fl = I.flash > .5 ? I.flash : I.flash * .4;
      gl.clearColor(A.brouillard[0], A.brouillard[1], A.brouillard[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      // ciel
      gl.useProgram(PC.p); gl.depthMask(false);
      gl.uniformMatrix4fv(PC.U.uPV, false, PV); gl.uniform3fv(PC.U.uCam, I.cam.e); gl.uniform3fv(PC.U.uHaut, A.haut); gl.uniform3fv(PC.U.uHor, A.horizon); gl.uniform3fv(PC.U.uFog, A.brouillard);
      gl.uniform3fv(PC.U.uSun, A.soleil); gl.uniform3fv(PC.U.uSunC, A.sCol); gl.uniform1f(PC.U.uNuit, A.nuit); gl.uniform1f(PC.U.uSynth, A.synth); gl.uniform1f(PC.U.uFlash, fl);
      gl.bindBuffer(gl.ARRAY_BUFFER, BC.b); gl.enableVertexAttribArray(PC.A.aP); gl.vertexAttribPointer(PC.A.aP, 3, gl.FLOAT, false, 40, 0); gl.drawArrays(gl.TRIANGLES, 0, BC.n);
      gl.depthMask(true);
      // scène éclairée
      gl.useProgram(PL.p); [PL.A.aP, PL.A.aN, PL.A.aC].forEach(a => gl.enableVertexAttribArray(a));
      const U = PL.U; gl.uniformMatrix4fv(U.uPV, false, PV); gl.uniform3fv(U.uSun, A.soleil); gl.uniform3fv(U.uSunC, A.sCol); gl.uniform3fv(U.uSky, mel(A.haut, A.horizon, .5)); gl.uniform3fv(U.uGnd, mel(A.sol, [0, 0, 0], .4));
      gl.uniform1f(U.uAmb, A.amb + fl * .4); gl.uniform3fv(U.uFog, A.brouillard); gl.uniform1f(U.uDens, A.brume); gl.uniform3fv(U.uCam, I.cam.e); gl.uniform1f(U.uFlash, fl); gl.uniform1f(U.uT, t); gl.uniform4f(U.uTint, 1, 1, 1, 0);
      const ident = modele(0, 0, 0, 0, 0, 1);
      gl.uniformMatrix4fv(U.uM, false, ident); gl.uniform1f(U.uEau, 0);
      gl.uniform1f(U.uSpec, 0); lier(gl, PL, B.sol); gl.drawArrays(gl.TRIANGLES, 0, B.sol.n);
      gl.uniform1f(U.uSpec, A.mouille * .9); lier(gl, PL, B.piste); gl.drawArrays(gl.TRIANGLES, 0, B.piste.n);
      // surcouches (marquages, fenêtres, champs) : poussées vers la caméra, elles ne scintillent plus
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
      if (B.solOv.n) { gl.uniform1f(U.uSpec, 0); lier(gl, PL, B.solOv); gl.drawArrays(gl.TRIANGLES, 0, B.solOv.n); }
      if (B.pisteOv.n) { gl.uniform1f(U.uSpec, A.mouille * .6); lier(gl, PL, B.pisteOv); gl.drawArrays(gl.TRIANGLES, 0, B.pisteOv.n); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (B.eau) { gl.uniform3fv(U.uSky, mel(A.horizon, [1, 1, 1], A.nuit ? .05 : .25)); gl.uniform1f(U.uSpec, .9); gl.uniform1f(U.uEau, 1); lier(gl, PL, B.eau); gl.drawArrays(gl.TRIANGLES, 0, B.eau.n); gl.uniform1f(U.uEau, 0); }
      // feux du portique de départ
      if (I.feuxDepart >= 0) { const p0 = S.portique, n0 = [-p0.tz, p0.tx]; for (let i = 0; i < 5; i++) { const on = I.feuxDepart > i && I.feuxDepart < 6;
        gl.uniform4f(U.uTint, on ? 1 : .25, on ? .15 : .25, on ? .12 : .28, on ? 1 : 0); gl.uniformMatrix4fv(U.uM, false, modele(p0.x + n0[0] * (i - 2) * 2.2, p0.y + 7.4, p0.z + n0[1] * (i - 2) * 2.2, 0, 0, 1)); lier(gl, PL, C.FEU); gl.drawArrays(gl.TRIANGLES, 0, C.FEU.n); }
        gl.uniform4f(U.uTint, 1, 1, 1, 0); }
      // voitures
      gl.uniform1f(U.uSpec, .55);
      V.forEach(x => {
        gl.uniform4f(U.uTint, 1, 1, 1, A.nuit ? .32 : 0);
        const M = modele(x.x, x.y + .05, x.z, x.cap, x.tang, 1); gl.uniformMatrix4fv(U.uM, false, M); lier(gl, PL, x.b); gl.drawArrays(gl.TRIANGLES, 0, x.b.n);
        gl.uniform4f(U.uTint, 1, 1, 1, 0);
        [[3.25, 1.5, roueAv, .55], [-2.95, 1.45, roueAr, .62]].forEach(([wx, wz, rb, rr]) => [1, -1].forEach(sd => {
          const Mw = mul(M, mul(modele(wx, rr, sd * wz, 0, 0, 1), rotZ(-x.rot)));
          gl.uniformMatrix4fv(U.uM, false, Mw); lier(gl, PL, rb); gl.drawArrays(gl.TRIANGLES, 0, rb.n); }));
      });
      // décors qui tournent (ailes du moulin…)
      RO.forEach(x => { gl.uniform4f(U.uTint, 1, 1, 1, 0); gl.uniformMatrix4fv(U.uM, false, mul(modele(x.x, x.y, x.z, x.cap, 0, 1), rotZ(t * x.v))); lier(gl, PL, x.b); gl.drawArrays(gl.TRIANGLES, 0, x.b.n); });
      gl.uniform1f(U.uSpec, 0);
      [PL.A.aN].forEach(a => gl.disableVertexAttribArray(a));
      // effets transparents : ombres, traînées
      gl.enable(gl.BLEND); gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-3, -6);
      const fx = [], add = [];
      V.forEach(x => {   // ombre douce sous la voiture
        const c = Math.cos(x.cap), s = Math.sin(x.cap), q = (a, b) => [x.x + a * c + b * s, x.y + .16, x.z - a * s + b * c];
        const A1 = q(-4.6, -2.1), B1 = q(4.8, -2.1), C1 = q(4.8, 2.1), D1 = q(-4.6, 2.1); [A1, B1, C1, A1, C1, D1].forEach(p => fx.push(p[0], p[1], p[2], 0, 0, 0, .32));
        rubanTrainee(x, add);
      });
      gl.useProgram(PF.p); gl.uniformMatrix4fv(PF.U.uPV, false, PV); gl.enableVertexAttribArray(PF.A.aP); gl.enableVertexAttribArray(PF.A.aC);
      gl.bindBuffer(gl.ARRAY_BUFFER, bFX);
      if (fx.length) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fx), gl.DYNAMIC_DRAW); gl.vertexAttribPointer(PF.A.aP, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(PF.A.aC, 4, gl.FLOAT, false, 28, 12); gl.drawArrays(gl.TRIANGLES, 0, fx.length / 7); }
      if (add.length) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(add), gl.DYNAMIC_DRAW); gl.vertexAttribPointer(PF.A.aP, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(PF.A.aC, 4, gl.FLOAT, false, 28, 12); gl.drawArrays(gl.TRIANGLES, 0, add.length / 7); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      // halos de lumière, feux arrière sous la pluie, feu d'artifice
      const pts = [];
      if (A.nuit || A.pluie) V.forEach(x => pts.push(x.x - x.tx * 4.1, x.y + .7, x.z - x.tz * 4.1, 1, .15, .1, A.pluie ? .9 : .5, 7));
      I.artifice.forEach(p => pts.push(p.x, p.y, p.z, p.c[0], p.c[1], p.c[2], Math.max(0, p.v), 9));
      gl.useProgram(PP.p); gl.uniformMatrix4fv(PP.U.uPV, false, PV); gl.uniform1f(PP.U.uH, Hh * .9); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      [PP.A.aP, PP.A.aC, PP.A.aS].forEach(a => gl.enableVertexAttribArray(a));
      if (A.nuit && LUM.length) { gl.bindBuffer(gl.ARRAY_BUFFER, bL); gl.vertexAttribPointer(PP.A.aP, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(PP.A.aC, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(PP.A.aS, 1, gl.FLOAT, false, 32, 28); gl.drawArrays(gl.POINTS, 0, LUM.length); }
      if (pts.length) { gl.bindBuffer(gl.ARRAY_BUFFER, bPT); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW); gl.vertexAttribPointer(PP.A.aP, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(PP.A.aC, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(PP.A.aS, 1, gl.FLOAT, false, 32, 28); gl.drawArrays(gl.POINTS, 0, pts.length / 8); }
      gl.disableVertexAttribArray(PP.A.aS);
      // pluie ou neige
      if (nbP) { gl.useProgram(PR.p); gl.uniformMatrix4fv(PR.U.uPV, false, PV); gl.uniform3fv(PR.U.uCam, I.cam.e); gl.uniform1f(PR.U.uT, t); gl.uniform1f(PR.U.uV, A.neige ? (A.flocV || 7) : 60);
        gl.uniform1f(PR.U.uLong, A.neige ? 0 : 1.6); gl.uniform1f(PR.U.uNeige, A.neige ? 1 : 0); if (A.floc) gl.uniform4f(PR.U.uC, A.floc[0], A.floc[1], A.floc[2], A.floc[3]); else gl.uniform4f(PR.U.uC, .82, .88, .95, A.neige ? .85 : .32); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.enableVertexAttribArray(PR.A.aS); gl.vertexAttribPointer(PR.A.aS, 4, gl.FLOAT, false, 16, 0); gl.drawArrays(A.neige ? gl.POINTS : gl.LINES, 0, A.neige ? nbP : nbP * 2); gl.disableVertexAttribArray(PR.A.aS); }
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // ----- boucle -----
    let raf = 0;
    function image(now) {
      raf = 0; if (!cv.isConnected) { I.endormi = true; return; }   // détachée : on attend d'être rattachée (redim / reveiller)
      // au repos (rien ne bouge vraiment), 30 images par seconde suffisent : la batterie dit merci
      const calme = !I.anim && !I.tir && !I.enRoute && !I.artifice.length;
      if (calme && I.dernier && now - I.dernier < 31) { if (I.actif) raf = requestAnimationFrame(image); return; }
      const t = (now - I.t0) / 1000, dt = Math.min(.05, I.dernier ? (now - I.dernier) / 1000 : .016);
      if (!calme && I.dernier) { I.ft = I.ft * .92 + (now - I.dernier) * .08; if (I.ft > 26 && I.q > 1) { if (++I.lents > 40) { I.q = Math.max(1, I.q - .25); I.lents = 0; I.ft = 16; redim(); } } else I.lents = 0; }
      I.dernier = now;
      // animation des points
      if (I.anim) {
        const a = I.anim, e = clamp((now - a.t0) / a.duree, 0, 1), k = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
        if (a.feux) { const f = (now - a.t00) / 1000; I.feuxDepart = f < 3.2 ? Math.floor(f / .6) + 1 : f < 4 ? 6 : -1; }
        Object.keys(a.a).forEach(n => { I.pts[n] = (a.de[n] || 0) + ((a.a[n] || 0) - (a.de[n] || 0)) * k; });
        const avant = V.map(x => x.s); placer(false);
        V.forEach((x, i) => { const d = x.s - avant[i]; x.vit = lisse(x.vit, Math.abs(d) / Math.max(dt, .001), .2); x.rot += d / .6; });
        if (e >= 1 && (!a.feux || I.feuxDepart < 0)) { I.anim = null; I.vitFin = performance.now(); V.forEach(x => x.vit = 0); placer(true); if (a.fin) a.fin(); if (o.artifice !== false && ANIM()) feuArtifice(); }
      } else V.forEach(x => { x.vit = lisse(x.vit, 0, .1); });
      // feu d'artifice
      I.artifice.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 18 * dt; p.v -= dt * .7; }); I.artifice = I.artifice.filter(p => p.v > 0);
      dessiner(t, dt);
      if (o.image) o.image(api);
      // cadence : 60 i/s en mouvement, 30 au repos, rien quand tout est calme
      const bouge = I.anim || I.tir || I.enRoute || I.artifice.length || (I.inactif < 40 && (nbP || A.eclairs || (ANIM() && I.mode !== "bord")));
      I.inactif += dt; if (I.anim || I.tir) I.inactif = 0;
      if (I.actif && bouge && document.visibilityState !== "hidden") raf = requestAnimationFrame(image); else I.endormi = true;
    }
    function reveiller() { I.inactif = 0; if (!raf && I.actif) { I.endormi = false; I.dernier = 0; raf = requestAnimationFrame(image); } }
    function feuArtifice() {
      const p0 = S.portique, cols = [[1, .35, .35], [1, .85, .3], [.35, .7, 1], [.6, 1, .6], [1, .5, 1]];
      for (let b = 0; b < 4; b++) { const cx = p0.x + (Math.random() - .5) * 120, cz = p0.z + (Math.random() - .5) * 120, cy = 45 + Math.random() * 25, c = cols[b % cols.length], dl = b * .35;
        for (let i = 0; i < 70; i++) { const a = Math.random() * TAU, e = Math.acos(2 * Math.random() - 1), v = 14 + Math.random() * 6;
          I.artifice.push({ x: cx, y: cy, z: cz, vx: Math.sin(e) * Math.cos(a) * v, vy: Math.cos(e) * v, vz: Math.sin(e) * Math.sin(a) * v, v: 1.2 - dl, c }); } }
      reveiller();
    }
    // ----- interactions : glisser pour tourner, pincer / molette pour zoomer, toucher une voiture pour la suivre -----
    const pointeurs = new Map(), ecoutes = [], ecoute = (type, f, opt) => { cv.addEventListener(type, f, opt); ecoutes.push([type, f, opt]); };
    ecoute("pointerdown", ev => { pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); I.tir = { x: ev.clientX, o: I.orbite, z: I.zoom, d0: null, t: performance.now(), x0: ev.clientX, y0: ev.clientY }; try { cv.setPointerCapture(ev.pointerId); } catch (e) { } reveiller(); });
    ecoute("pointermove", ev => {
      if (!I.tir || !pointeurs.has(ev.pointerId)) return; pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointeurs.size >= 2) { const [a, b] = [...pointeurs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (!I.tir.d0) { I.tir.d0 = d; I.tir.z = I.zoom; } I.zoom = clamp(I.tir.z * I.tir.d0 / d, .45, 2.4); }
      else if (I.mode !== "bord") I.orbite = I.tir.o - (ev.clientX - I.tir.x) * .008;
    });
    const fin = ev => {
      const t = I.tir; pointeurs.delete(ev.pointerId); if (pointeurs.size) return; I.tir = null;
      if (t && performance.now() - t.t < 300 && Math.hypot(ev.clientX - t.x0, ev.clientY - t.y0) < 8) { const n = toucher(ev.clientX, ev.clientY); if (n && o.toucher) o.toucher(n); }
    };
    ecoute("pointerup", fin); ecoute("pointercancel", fin);
    ecoute("wheel", ev => { ev.preventDefault(); I.zoom = clamp(I.zoom * (ev.deltaY > 0 ? 1.1 : .9), .45, 2.4); reveiller(); }, { passive: false });
    cv.style.touchAction = "pan-y";
    function ecran(n) {
      const x = voitureDe(n); if (!x || !PV) return null; if (I.mode === "bord" && n === I.focus) return { vis: false }; const p = appliquer(PV, [x.x, x.y + 3.2, x.z, 1]); if (p[3] <= .5) return { vis: false };
      return { x: (p[0] / p[3] * .5 + .5) * I.cssW, y: (1 - (p[1] / p[3] * .5 + .5)) * I.cssH, vis: Math.abs(p[0] / p[3]) < 1.15 && Math.abs(p[1] / p[3]) < 1.2, d: p[3] };
    }
    function ecranMonde(s, lat, h) { if (!PV) return null; const q = T.a(s, lat || 0), p = appliquer(PV, [q.x, q.y + (h || 0), q.z, 1]); if (p[3] <= .5) return { vis: false }; return { x: (p[0] / p[3] * .5 + .5) * I.cssW, y: (1 - (p[1] / p[3] * .5 + .5)) * I.cssH, vis: Math.abs(p[0] / p[3]) < 1.1 && Math.abs(p[1] / p[3]) < 1.1 }; }
    function toucher(cx, cy) { const r = cv.getBoundingClientRect(); let best = null, bd = 44; V.forEach(x => { const e = ecran(x.v.nom); if (!e || !e.vis) return; const d = Math.hypot(e.x + r.left - cx, e.y + r.top - cy); if (d < bd) { bd = d; best = x.v.nom; } }); return best; }
    function redim() {
      const r = boite.getBoundingClientRect(); I.cssW = Math.max(1, r.width); I.cssH = Math.max(1, r.height);
      const q = Math.min(I.q, Math.sqrt(1.5e6 / (I.cssW * I.cssH)));   // jamais plus de 1,5 million de pixels à calculer
      const w = Math.max(2, Math.round(I.cssW * q)), h = Math.max(2, Math.round(I.cssH * q));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      reveiller();
    }
    const ro = window.ResizeObserver ? new ResizeObserver(redim) : null; if (ro) ro.observe(boite); redim();
    const vis = () => { if (document.visibilityState === "visible") reveiller(); }; document.addEventListener("visibilitychange", vis);
    ecoute("webglcontextlost", e => { e.preventDefault(); if (I.detruit) return; I.actif = false; if (o.perdu) o.perdu(); });
    const api = {
      type: "3d", T, zones: Z, stats: () => ({ sol: B.sol.n, piste: B.piste.n, ov: B.solOv.n + B.pisteOv.n, eau: B.eau ? B.eau.n : 0, lum: LUM.length, tConstr: I.tConstr }),
      placer(pts) { I.anim = null; I.pts = Object.assign({}, pts); placer(true); I.feuxDepart = -1; reveiller(); },
      regler(x) { Object.assign(o, x); },
      jouer(de, a, duree, fin, depart) {
        I.pts = Object.assign({}, de); placer(true); V.forEach(x => x.hist = []);
        const now = performance.now(), dl = depart ? 3200 : 0;
        I.anim = { de: Object.assign({}, de), a: Object.assign({}, a), t0: now + dl, t00: now, duree: duree || 5200, fin, feux: !!depart };
        if (depart) I.feuxDepart = 0; I.saut = I.mode !== "helico"; reveiller();
      },
      camera(m) { I.mode = m; I.saut = false; I.zoom = 1; reveiller(); },
      focus(n) { I.focus = n; reveiller(); },
      ecran, ecranMonde, courant: () => Object.assign({}, I.pts), enCours: () => !!I.anim, redim, reveiller, taille: () => ({ w: I.cssW, h: I.cssH }),
      detruire() {
        I.detruit = true; I.actif = false; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); document.removeEventListener("visibilitychange", vis);
        ecoutes.forEach(([t, f, op]) => cv.removeEventListener(t, f, op));
        [B.sol, B.solOv, B.piste, B.pisteOv, B.eau].concat(V.map(x => x.b)).forEach(t => { if (t) gl.deleteBuffer(t.b); }); [bL, bP, bFX, bPT].forEach(b => gl.deleteBuffer(b));
        cv.remove(); if (!gl.isContextLost()) RESERVE.push(C);   // le contexte servira au prochain circuit
      }
    };
    reveiller();
    return api;
  }
  function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  const ANIM = () => !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  /** traînée : un ruban derrière la voiture, à la couleur de la cosmétique */
  function rubanTrainee(x, out) {
    const pos = [x.x - x.tx * 4.1, x.y + .75, x.z - x.tz * 4.1];
    if (x.vit > 4) { const h = x.hist; if (!h.length || Math.hypot(h[0][0] - pos[0], h[0][2] - pos[2]) > 1.2) { h.unshift([pos[0], pos[1], pos[2], x.tz, -x.tx]); if (h.length > 10) h.pop(); } }
    else if (x.hist.length) x.hist.pop();
    const h = x.hist; if (h.length < 2) return;
    const t = x.v.trainee || "simple", c = hex(x.v.couleur || "#ffffff");
    const pal = { flammes: [[1, .45, .1], [1, .85, .25]], turbo: [[.35, .72, 1], [.8, .95, 1]], arcenciel: null, comete: [c, mel(c, [1, 1, 1], .6)], supernova: [[.62, .52, 1], [1, 1, 1]], etincelles: [[1, .85, .3], [1, 1, .7]], halo: [c, c], simple: [[1, 1, 1], [1, 1, 1]] }[t] || [c, c];
    const larg = t === "simple" ? .25 : t === "comete" || t === "supernova" ? 1 : .7, alpha = t === "simple" ? .15 : .38;
    const arc = [[1, .35, .37], [1, .71, .28], [.24, .86, .59], [.3, .6, 1], [.71, .48, 1]];
    for (let i = 0; i < h.length - 1; i++) {
      const a = h[i], b = h[i + 1], fa = 1 - i / h.length, fb = 1 - (i + 1) / h.length, wa = larg * (.3 + fa * .7), wb = larg * (.3 + fb * .7);
      const col = t === "arcenciel" ? arc[i % 5] : mel(pal[0], pal[1], i % 2 ? .3 : 0);
      const P = (p, w, s) => [p[0] + p[3] * w * s, p[1], p[2] + p[4] * w * s];
      const A1 = P(a, wa, 1), A2 = P(a, wa, -1), B1 = P(b, wb, 1), B2 = P(b, wb, -1);
      [[A1, fa], [A2, fa], [B1, fb], [A2, fa], [B2, fb], [B1, fb]].forEach(([p, f]) => out.push(p[0], p[1], p[2], col[0], col[1], col[2], alpha * f));
    }
  }

  /* ============================================================
     Instance 2D : la carte du circuit, sobre et lisible
     ============================================================ */
  const CARTES_P = {};   // cartes peintes, calculées une fois par circuit
  function monter2D(boite, o) {
    const def = TRACES[o.circuit] || TRACES.melbourne, T = echantillonner(def), Z = zones(T), NS = "http://www.w3.org/2000/svg";
    const m = 34, minx = T.cx - T.rx - m, minz = T.cz - T.rz - m, w = T.rx * 2 + 2 * m, h = T.rz * 2 + 2 * m;
    const pts = []; for (let i = 0; i <= T.N; i++) { const k = i % T.N; pts.push(T.X[k].toFixed(1) + " " + T.Z[k].toFixed(1)); }
    const d = "M" + pts.join("L");
    const seg = (s0, s1) => { const l = []; for (let s = s0; s <= s1; s += 3) { const p = T.a(s, 0); l.push(p.x.toFixed(1) + " " + p.z.toFixed(1)); } return "M" + l.join("L"); };
    const haut = []; for (let i = 0; i < T.N; i++) if (T.Y[i] > 4 && T.dist(T.X[i], T.Z[i], T.Y[i] - 4) < DEMI + 10) haut.push(i);
    const pont = haut.length ? seg(haut[0] * T.ds - 10, haut[haut.length - 1] * T.ds + 10) : "";
    const eau = (def.eau || []).map(p => '<path d="M' + p.map(q => (q[0] * ECH).toFixed(1) + " " + (q[1] * ECH).toFixed(1)).join("L") + 'Z" fill="rgba(76,154,255,.12)"/>').join("");
    const p0 = T.a(0, 0), ang = Math.atan2(p0.tz, p0.tx) * 180 / PI;
    const kf = (T.rx * 2 + 68) / 340, fleches = [.2, .45, .7].map(f => { const p = T.a(f * T.L, 0); return '<path d="M-3 -2.6L2.4 0-3 2.6" transform="translate(' + p.x.toFixed(1) + " " + p.z.toFixed(1) + ") rotate(" + (Math.atan2(p.tz, p.tx) * 180 / PI).toFixed(1) + ") scale(" + kf.toFixed(2) + ')" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'; }).join("");
    const zoneTrait = (z, col) => z && col ? '<path d="' + seg(z.s0, z.s1) + '" fill="none" stroke="' + col + '" stroke-width="' + (3.4 * kf).toFixed(1) + '" stroke-linecap="round" opacity=".95"/>' : "";
    const acc = o.accent || "#9B87FF", k = w / 340, K = v => (v * k).toFixed(1);
    const PE = def.peint && PEINTS[def.peint] ? PEINTS[def.peint] : null, CP = PE ? (CARTES_P[def.peint] || (CARTES_P[def.peint] = PE.peindre(T, Z, def))) : null;
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "p2-svg"); svg.setAttribute("viewBox", minx.toFixed(1) + " " + minz.toFixed(1) + " " + w.toFixed(1) + " " + h.toFixed(1)); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", o.titre || "Circuit");
    if (CP) svg.innerHTML = '<rect x="' + (minx - 400) + '" y="' + (minz - 400) + '" width="' + (w + 800) + '" height="' + (h + 800) + '" fill="' + CP.couleur + '"/>' +
      '<g transform="scale(' + (1 / KU) + ')"><image href="' + (CP.url || (CP.url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(CP.fond))) + '" x="0" y="0" width="' + CP.W + '" height="' + CP.H + '"/>' + CP.anim + "</g>" +
      zoneTrait(Z.atout, o.atoutCol) + zoneTrait(Z.piege, o.piegeCol) + fleches +
      '<g transform="translate(' + p0.x.toFixed(1) + " " + p0.z.toFixed(1) + ") rotate(" + ang.toFixed(1) + ") scale(" + (k * .9).toFixed(2) + ')"><rect x="-1.6" y="-6" width="3.2" height="12" fill="#fff"/><rect x="-1.6" y="-6" width="1.6" height="2" fill="#111"/><rect x="0" y="-4" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="-2" width="1.6" height="2" fill="#111"/><rect x="0" y="0" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="2" width="1.6" height="2" fill="#111"/><rect x="0" y="4" width="1.6" height="2" fill="#111"/></g>' +
      '<g class="p2-v"></g>';
    else svg.innerHTML = '<defs><pattern id="p2g" width="' + K(24) + '" height="' + K(24) + '" patternUnits="userSpaceOnUse"><path d="M' + K(24) + ' 0H0V' + K(24) + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="' + K(1) + '"/></pattern></defs>' +
      '<rect x="' + (minx - 400) + '" y="' + (minz - 400) + '" width="' + (w + 800) + '" height="' + (h + 800) + '" fill="url(#p2g)"/>' + eau +
      '<path d="' + d + '" fill="none" stroke="' + acc + '" stroke-width="' + K(17) + '" stroke-linejoin="round" opacity=".16"/>' +
      '<path d="' + d + '" fill="none" stroke="#07090D" stroke-width="' + K(11) + '" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#2C323E" stroke-width="' + K(8) + '" stroke-linejoin="round"/>' +
      (pont ? '<path d="' + pont + '" fill="none" stroke="#07090D" stroke-width="' + K(12) + '"/><path d="' + pont + '" fill="none" stroke="#3A4250" stroke-width="' + K(8) + '"/>' : "") +
      zoneTrait(Z.atout, o.atoutCol) + zoneTrait(Z.piege, o.piegeCol) +
      '<path d="' + d + '" fill="none" stroke="' + acc + '" stroke-width="' + K(1.1) + '" stroke-linejoin="round" opacity=".9"/>' + fleches +
      '<g transform="translate(' + p0.x.toFixed(1) + " " + p0.z.toFixed(1) + ") rotate(" + ang.toFixed(1) + ") scale(" + (k * .9).toFixed(2) + ')"><rect x="-1.6" y="-6" width="3.2" height="12" fill="#fff"/><rect x="-1.6" y="-6" width="1.6" height="2" fill="#111"/><rect x="0" y="-4" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="-2" width="1.6" height="2" fill="#111"/><rect x="0" y="0" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="2" width="1.6" height="2" fill="#111"/><rect x="0" y="4" width="1.6" height="2" fill="#111"/></g>' +
      '<g class="p2-v"></g>';
    boite.appendChild(svg);
    const gV = svg.querySelector(".p2-v"), V = {};
    (o.voitures || []).forEach(v => { const g = document.createElementNS(NS, "g"); g.setAttribute("class", "p2-car" + (v.moi ? " ici" : "")); g.innerHTML = '<g transform="scale(' + k.toFixed(2) + ')">' + (v.moi ? '<circle r="10.5" fill="none" stroke="' + v.couleur + '" stroke-width="1.6" opacity=".55"/>' : "") + '<circle r="7" fill="' + v.couleur + '" stroke="#fff" stroke-width="1.8"/><text y="3" text-anchor="middle"></text></g>'; gV.appendChild(g); V[v.nom] = { g, t: g.querySelector("text"), x: 0, y: 0 }; });
    const I = { pts: Object.assign({}, o.pts || {}), anim: null, ordre: (o.voitures || []).map(v => v.nom) };
    let raf = 0;
    function poser() {
      const c = cibles(I.pts, o.tour || 25, T.L, I.ordre, o.grille);
      Object.entries(c).forEach(([n, t]) => { const v = V[n]; if (!v) return; const p = T.a(t.s, t.voie * .8); v.x = p.x; v.y = p.z; v.g.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.z.toFixed(1) + ")"); v.t.textContent = t.rang; });
      // l'ordre d'affichage : le premier dessus
      Object.entries(c).sort((a, b) => b[1].rang - a[1].rang).forEach(([n]) => V[n] && gV.appendChild(V[n].g));
      if (o.image) o.image(api);
    }
    function boucle(now) {
      raf = 0; if (!svg.isConnected) return; const a = I.anim; if (!a) return;
      const e = clamp((now - a.t0) / a.duree, 0, 1), k = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
      Object.keys(a.a).forEach(n => I.pts[n] = (a.de[n] || 0) + ((a.a[n] || 0) - (a.de[n] || 0)) * k); poser();
      if (e < 1) raf = requestAnimationFrame(boucle); else { I.anim = null; if (a.fin) a.fin(); }
    }
    function ecran(n) { const v = V[n]; if (!v) return null; const ctm = svg.getScreenCTM(), r = boite.getBoundingClientRect(); if (!ctm) return null; const p = svg.createSVGPoint(); p.x = v.x; p.y = v.y - 9 * k; const q = p.matrixTransform(ctm); return { x: q.x - r.left, y: q.y - r.top, vis: true }; }
    function ecranMonde(s, lat) { const ctm = svg.getScreenCTM(), r = boite.getBoundingClientRect(); if (!ctm) return null; const t = T.a(s, lat || 0), p = svg.createSVGPoint(); p.x = t.x; p.y = t.z; const q = p.matrixTransform(ctm); return { x: q.x - r.left, y: q.y - r.top, vis: true }; }
    svg.addEventListener("click", ev => { const r = boite.getBoundingClientRect(); let best = null, bd = 30; Object.keys(V).forEach(n => { const e = ecran(n); if (!e) return; const dd = Math.hypot(e.x + r.left - ev.clientX, e.y + 10 + r.top - ev.clientY); if (dd < bd) { bd = dd; best = n; } }); if (best && o.toucher) o.toucher(best); });
    let taille = { w: 1, h: 1 };
    const ro = window.ResizeObserver ? new ResizeObserver(() => { const r = boite.getBoundingClientRect(); taille = { w: r.width, h: r.height }; if (o.image) o.image(api); }) : null; if (ro) ro.observe(boite);
    const api = {
      type: "2d", T, zones: Z,
      placer(pts) { I.anim = null; I.pts = Object.assign({}, pts); poser(); },
      regler(x) { Object.assign(o, x); },
      jouer(de, a, duree, fin) { if (!ANIM()) { api.placer(a); if (fin) fin(); return; } I.pts = Object.assign({}, de); poser(); I.anim = { de: Object.assign({}, de), a: Object.assign({}, a), t0: performance.now(), duree: Math.min(duree || 2600, 3200), fin }; if (!raf) raf = requestAnimationFrame(boucle); },
      camera() { }, focus() { }, ecran, ecranMonde, taille: () => taille, courant: () => Object.assign({}, I.pts), enCours: () => !!I.anim, redim() { if (o.image) o.image(api); }, reveiller() { },
      detruire() { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); svg.remove(); }
    };
    poser();
    return api;
  }

  window.Piste = {
    TRACES, supporte,
    monter(boite, o) {
      if (o.mode !== "2d" && supporte()) { try { return monter3D(boite, o); } catch (e) { if (window.console) console.warn("Piste 3D indisponible :", e && e.message); } }
      return monter2D(boite, Object.assign({}, o, { mode: "2d" }));
    },
    /** vignette SVG du tracé (calendrier, Stand) */
    vignette(id, coul) {
      const def = TRACES[id]; if (!def) return "";
      const T = echantillonner(def), m = 20, l = []; for (let i = 0; i <= T.N; i += 3) { const k = i % T.N; l.push(T.X[k].toFixed(0) + " " + T.Z[k].toFixed(0)); }
      return '<svg class="p2-vign" viewBox="' + (T.cx - T.rx - m).toFixed(0) + " " + (T.cz - T.rz - m).toFixed(0) + " " + (T.rx * 2 + 2 * m).toFixed(0) + " " + (T.rz * 2 + 2 * m).toFixed(0) + '" aria-hidden="true"><path d="M' + l.join("L") + 'Z" fill="none" stroke="' + (coul || "currentColor") + '" stroke-width="14" stroke-linejoin="round"/></svg>';
    }
  };
})();
