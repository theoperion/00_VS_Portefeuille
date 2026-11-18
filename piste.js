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
    abudhabi: { pts: polyg([[40, 204], [320, 204], [320, 40], [234, 40], [234, 126], [186, 126], [186, 40], [40, 40]], 16), decor: "garage", heure: "crepuscule", reperes: [{ t: "garage" }] },
    bahrein: { pts: etoile([[3, .14, .3], [5, .09, 1], [7, .05, 2.2]], 42), decor: "lucioles", heure: "crepuscule", amb: "lucioles", reperes: [{ t: "feu" }] },
    djeddah: { pts: polyg([[40, 210], [320, 210], [320, 70], [290, 70], [290, 32], [240, 32], [240, 70], [200, 70], [200, 32], [150, 32], [150, 70], [110, 70], [110, 32], [60, 32], [60, 70], [40, 70]], 12), decor: "chateau", heure: "nuit", reperes: [{ t: "chateau", y: 145 }] },
    melbourne: { pts: F_LAC, decor: "armoire", heure: "jour", amb: "neige", eau: [resserrer(F_LAC, .5)], reperes: [{ t: "armoire" }] },
    suzuka: { pts: huit(), decor: "basfonds", heure: "nuit", amb: "pluie", reperes: [{ t: "cheminees" }] },
    miami: { pts: polyg([[40, 210], [320, 210], [320, 60], [270, 60], [270, 104], [220, 104], [220, 30], [160, 30], [160, 92], [110, 92], [110, 50], [40, 50]], 12), decor: "androides", heure: "nuit", amb: "neon", reperes: [{ t: "tourcentrale", y: 160 }] },
    montreal: { pts: polyg([[110, 30], [250, 30], [324, 120], [250, 210], [110, 210], [156, 120]], 18), decor: "arene", heure: "nuit", amb: "neon", reperes: [{ t: "holodome" }] },
    silverstone: { pts: etoile([[5, .17, .6]], 45), decor: "solstice", heure: "jour", reperes: [{ t: "mai" }] },
    spa: { pts: etoile([[1, .16, .5], [2, .17, 2.2], [4, .06, .8]], 36, t => 5 + 5 * Math.sin(2 * t + 1)), decor: "envers", heure: "nuit", amb: "envers", reperes: [{ t: "faille" }] },
    monza: { pts: F_CHAMPI, decor: "survivants", heure: "crepuscule", amb: "spores", reperes: [{ t: "champignons", y: 95 }] },
    singapour: { pts: F_DUNES, decor: "dunes", heure: "crepuscule", amb: "desert", reperes: [{ t: "ver", y: 122 }] },
    interlagos: { pts: polyg([[40, 40], [320, 40], [334, 96], [292, 132], [304, 184], [250, 212], [200, 170], [150, 206], [90, 202], [56, 156], [30, 100]], 22, (x, y) => Math.max(0, 9 - (y - 40) / 18)), decor: "titans", heure: "crepuscule", amb: "cendres", reperes: [{ t: "mur" }] },
    lasvegas: { pts: etoile([[3, .2, .5], [6, .03]], 39, t => 9 + 7 * Math.sin(t + .4)), decor: "olympe", heure: "jour", amb: "olympe", reperes: [{ t: "temple" }] },
    monaco: { pts: polyg([[60, 30], [300, 30], [300, 210], [212, 210], [212, 120], [148, 120], [148, 210], [60, 210]], 18), decor: "plateau", heure: "nuit", rue: true, damier: true, reperes: [{ t: "plateau" }] }
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
    garage: { sol: "#7E8288", bord: "#9AA0A8", piste: "#2F3238", murs: ["#F2F4F7", "#F28C28"], obj: [["conteneur", 44], ["pneus", 40, "pres"], ["projecteur", 12, "pres"]] },
    lucioles: { sol: "#2F5236", bord: "#3F6A48", piste: "#33373D", murs: ["#E9ECEF", "#B8E04A"], obj: [["pin", 200], ["arbre", 60], ["luciole", 70], ["champignon", 30]] },
    chateau: { sol: "#4F6B45", bord: "#62805A", piste: "#34373D", murs: ["#E9ECEF", "#7B4BD6"], obj: [["tour", 16], ["pin", 150], ["rocher", 20]] },
    armoire: { sol: "#4E7E44", bord: "#6C9A5C", piste: "#3A3E45", murs: ["#E9ECEF", "#2F6FD0"], eau: "#BFD9EC", obj: [["pin", 240], ["lanterne", 12, "pres"]] },
    basfonds: { sol: "#2B2A2C", bord: "#3A3634", piste: "#2A2C30", murs: ["#E9ECEF", "#B33A2E"], obj: [["usine", 46], ["lampadaire", 0]] },
    androides: { sol: "#14121F", bord: "#1E1A2E", piste: "#24262E", murs: ["#E9ECEF", "#22D3EE"], obj: [["tourholo", 44], ["gratteciel", 30], ["lampadaire", 0]] },
    arene: { sol: "#0D0820", bord: "#1C0B3A", piste: "#1A1C24", murs: ["#22D3EE", "#FF4FD8"], obj: [["cube", 110]] },
    solstice: { sol: "#79A858", bord: "#93C070", piste: "#3B3F47", murs: ["#FFFFFF", "#F2B33A"], obj: [["fleurs", 70], ["maison", 50], ["arbre", 60], ["foin", 20]] },
    envers: { sol: "#2B2A2E", bord: "#3B3438", piste: "#2C2E33", murs: ["#E9ECEF", "#C8102E"], obj: [["arbremort", 170], ["pin", 50]] },
    survivants: { sol: "#5D6B44", bord: "#6E7A52", piste: "#36383D", murs: ["#E9ECEF", "#9BC53D"], obj: [["ruine", 40], ["champignon", 90], ["arbre", 40]] },
    dunes: { sol: "#D3A867", bord: "#C08F50", piste: "#3B3B40", murs: ["#E9ECEF", "#D9822B"], obj: [["dune", 90], ["rocher", 30], ["projecteur", 10, "pres"]] },
    titans: { sol: "#6E7458", bord: "#82886A", piste: "#3A3C40", murs: ["#E9ECEF", "#8C2F2F"], obj: [["maison", 50], ["rocher", 50], ["arbre", 40]] },
    olympe: { sol: "#B8B19E", bord: "#A49D8A", piste: "#3A3C42", murs: ["#FFFFFF", "#F2B33A"], obj: [["colonne", 50], ["montagne", 9], ["nuage", 26], ["rocher", 30], ["pin", 30]] },
    plateau: { sol: "#E9DFC8", bord: "#C9B98F", piste: "#2E3038", murs: ["#F2F4F7", "#E5484D"], obj: [["de", 22], ["pion", 40], ["lampadaire", 0]] }
  };
  /** objets qui gardent leurs couleurs propres (lumineux ou peints), même sous la neige ou le néon */
  const SANS_TEINTE = new Set(["yacht", "neon", "luciole", "cube", "tourholo", "lanterne", "fleurs", "de", "pion", "nuage"]);
  /** ambiance finale : heure de la ville, puis météo du marché, puis cosmétique du spectateur */
  function ambiance(def, meteo, cosm) {
    const D = DECORS[def.decor] || DECORS.parc;
    if (!cosm && def.amb) cosm = def.amb;   // V16 : ambiance propre au circuit à thème (neige, néon, désert)
    let h = Object.assign({}, HEURES[def.heure] || HEURES.jour);
    if (cosm === "monaco") h = Object.assign({}, HEURES.nuit);
    if (cosm === "desert") h = Object.assign({}, HEURES.crepuscule, { horizon: "#FFC98A", haut: "#5C86C9", sCol: "#FFD9A0", sForce: 1, amb: .58, brume: .00035, nuit: 0 });
    const A = { haut: hex(h.haut), horizon: hex(h.horizon), soleil: norme(h.soleil), sCol: fois(hex(h.sCol), h.sForce), amb: h.amb, nuit: h.nuit, brume: h.brume,
      sol: hex(D.sol), bord: hex(D.bord), piste: hex(D.piste), murs: D.murs.map(hex), eau: D.eau ? hex(D.eau) : null, pluie: 0, neige: 0, eclairs: 0, mouille: 0, synth: 0, hiver: 0 };
    const gris = hex("#7D8794");
    if (meteo === "nuages") { A.haut = mel(A.haut, gris, .45); A.horizon = mel(A.horizon, hex("#C9D0D8"), .45); A.sCol = fois(A.sCol, .7); A.brume *= 1.3; }
    if (meteo === "pluie" || meteo === "orage") {
      const k = meteo === "orage" ? .85 : .65;
      A.haut = mel(A.haut, hex(meteo === "orage" ? "#1C222D" : "#59636F"), k); A.horizon = mel(A.horizon, hex(meteo === "orage" ? "#3A4352" : "#8F99A5"), k);
      A.sCol = fois(A.sCol, meteo === "orage" ? .3 : .45); A.amb *= .9; A.pluie = meteo === "orage" ? 1.6 : 1; A.mouille = 1; A.brume *= 1.35; A.eclairs = meteo === "orage" ? 1 : 0;
    }
    if (cosm === "neige") { A.hiver = 1; A.sol = hex("#E8EEF4"); A.bord = hex("#D5DFEA"); A.neige = A.pluie ? 0 : 1; A.horizon = mel(A.horizon, hex("#E6EDF5"), .5); A.haut = mel(A.haut, hex("#9FB5CC"), .4); }
    // V16.2 : ambiances propres aux mondes (particules : lucioles, spores, cendres, sable)
    if (cosm === "lucioles") { A.haut = hex("#0E1A3A"); A.horizon = hex("#3E6B6A"); A.nuit = .8; A.amb = .48; A.sCol = fois(A.sCol, .6); if (!A.pluie) { A.neige = 1; A.floc = [.85, 1, .35, .9]; A.flocV = 1.5; } }
    if (cosm === "envers") { A.haut = hex("#0B0610"); A.horizon = hex("#5A1424"); A.nuit = 1; A.eclairs = 1; A.sCol = hex("#9AA6C8"); A.sol = hex("#2A2730"); A.bord = hex("#35303A"); A.envers = 1; if (!A.pluie) { A.neige = 1; A.floc = [.75, .68, .7, .6]; A.flocV = 2.5; } }
    if (cosm === "spores") { A.horizon = mel(A.horizon, hex("#B7C27A"), .6); A.haut = mel(A.haut, hex("#33402C"), .4); if (!A.pluie) { A.neige = 1; A.floc = [.85, .92, .6, .6]; A.flocV = 2; } }
    if (cosm === "cendres") { A.horizon = mel(A.horizon, hex("#C98A5A"), .5); A.haut = mel(A.haut, hex("#4A4250"), .5); A.brume *= 1.4; if (!A.pluie) { A.neige = 1; A.floc = [.62, .6, .58, .7]; A.flocV = 3; } }
    if (cosm === "desert" && !A.pluie) { A.neige = 1; A.floc = [.95, .8, .55, .5]; A.flocV = 9; }
    if (cosm === "olympe") { A.haut = hex("#3E7BE0"); A.horizon = hex("#FFE2A0"); A.sCol = hex("#FFF1D0"); A.eclairs = 1; }
    if (cosm === "pluie" && !A.pluie) { A.pluie = 1; A.mouille = 1; A.haut = mel(A.haut, hex("#1C222D"), .5); A.brume *= 1.3; }
    if (cosm === "neon") { A.synth = 1; A.nuit = 1; A.haut = hex("#0B0220"); A.horizon = hex("#FF2E97"); A.sol = hex("#12062A"); A.bord = hex("#1C0B3A"); A.sCol = hex("#FF77C8"); A.soleil = norme([0, .12, -1]); A.amb = .45; A.murs = [hex("#22D3EE"), hex("#FF4FD8")]; }
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
      mk.quad(P(a, DEMI - .35, .02), P(b, DEMI - .35, .02), P(b, DEMI - .9, .02), P(a, DEMI - .9, .02), A.synth ? hex("#22D3EE") : blanc, A.synth ? 1 : nuitPiste, up);
      mk.quad(P(a, -DEMI + .35, .02), P(b, -DEMI + .35, .02), P(b, -DEMI + .9, .02), P(a, -DEMI + .9, .02), A.synth ? hex("#FF4FD8") : blanc, A.synth ? 1 : nuitPiste, up);
      // vibreurs dans les virages, sinon bas-côtés
      const kerb = vib(i) || vib((i + 2) % N) || vib((i - 2 + N) % N);
      [1, -1].forEach(sd => {
        const c1 = kerb ? (Math.floor(i / 2) % 2 ? rouge : blanc) : A.bord;
        piste.quad(P(a, sd * DEMI), P(b, sd * DEMI), P(b, sd * (DEMI + (kerb ? 2 : 0) + (rue ? 1.2 : 6))), P(a, sd * (DEMI + (kerb ? 2 : 0) + (rue ? 1.2 : 6))), kerb ? c1 : mel(A.bord, [0, 0, 0], .04 * (i % 3)), kerb ? nuitPiste : 0, up);
        // murs (rue) ou rails : un panneau sur deux de la couleur du circuit
        const ow = sd * (DEMI + (rue ? 3.4 : 11)), hw = rue ? 1.3 : .9, cw = Math.floor(i / 4) % 2 ? A.murs[0] : A.murs[1], emw = A.synth ? .9 : A.nuit ? .3 : 0;
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
      garage: "conteneur", lucioles: "pin", chateau: "pin", armoire: "pin", arene: "cube", solstice: "arbre", envers: "arbremort", survivants: "champignon", dunes: "rocher", titans: "rocher", olympe: "colonne" }[def.decor];
    for (let i = 0; i < N; i += Math.max(1, Math.round((typeRue ? 19 : 15) / T.ds))) [1, -1].forEach(sd => {
      if (r() < (typeRue ? .2 : .5)) return;
      const e = E[i], o = sd * (DEMI + (typeRue ? 15 + r() * 8 : 18 + r() * 30)), x = e.x + e.nx * o, z = e.z + e.nz * o;
      if (T.dist(x, z) < (typeRue ? DEMI + 10 : DEMI + 14) || surEau(x, z)) return;
      if (Math.hypot(x - ps.x, z - ps.z) < 70 || Math.hypot(x - pt2.x, z - pt2.z) < 75 || pris(x, z)) return;
      const ty = typeRue || typeBord; if (!ty) return;
      const g = objet(ty, r, A); sol.poser(g, x, typeRue ? 0 : 0, z, Math.atan2(-e.nz, e.nx) * 0 + (typeRue ? Math.atan2(-T.TZ[i], T.TX[i]) : r() * TAU), typeRue === "gratteciel" ? .8 : 1, SANS_TEINTE.has(ty) ? null : teinte);
    });
    // lampadaires le long des circuits de nuit (et de ville)
    if (A.nuit || (D.obj || []).some(o => o[0] === "lampadaire")) for (let i = 0; i < N; i += Math.round(64 / T.ds)) {
      const sd = Math.floor(i / Math.round(64 / T.ds)) % 2 ? 1 : -1, e = E[i], o = sd * (DEMI + (rue ? 5 : 13));
      const pp = P(e, o), g = objet("lampadaire", r, A); sol.poser(g, pp[0], pp[1] - .1, pp[2], Math.atan2(e.nz * -sd, e.nx * -sd) * -1 + 0, 1);
      if (A.nuit) lum.push([pp[0] - e.nx * sd * 1.2, pp[1] + 8.8, pp[2] - e.nz * sd * 1.2, 1, .9, .7, 13]);
    }
    return { sol, piste, eau, lum, stands: ps, portique: p0 };
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
    const v = { sol: fige(S.sol), solOv: fige(S.sol.ov()), piste: fige(S.piste), pisteOv: fige(S.piste.ov()), eau: S.eau.n ? fige(S.eau) : null, lum: S.lum, portique: S.portique };
    SCENES.set(cle, v); while (SCENES.size > 4) SCENES.delete(SCENES.keys().next().value);
    return v;
  }
  function lier(gl, P, t) { gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.vertexAttribPointer(P.A.aP, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(P.A.aN, 3, gl.FLOAT, false, 40, 12); gl.vertexAttribPointer(P.A.aC, 4, gl.FLOAT, false, 40, 24); }

  function supporte() { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }

  /* ---------- Placement des voitures sur la piste, à partir des points ---------- */
  /** V16.3 · position de chaque voiture : la distance suit les points sans jamais sauter ;
      chacun a son couloir (ordre de départ) : seul, il se rapproche de la trajectoire idéale, près d'un rival il s'écarte en douceur.
      Plus de téléportation de 11 m ni de changement de voie brutal quand quelqu'un double. */
  function cibles(pts, tour, L, ordreDepart) {
    const noms = Object.keys(pts).sort((a, b) => pts[b] - pts[a] || (ordreDepart ? ordreDepart.indexOf(a) - ordreDepart.indexOf(b) : 0));
    const ordre = ordreDepart && ordreDepart.length ? ordreDepart : noms, nb = Math.max(ordre.length, noms.length), pas = Math.min(3.6, 13 / Math.max(1, nb - 1));
    const out = {};
    noms.forEach((n, j) => { const k = Math.max(0, ordre.indexOf(n)); out[n] = { s: (pts[n] / tour) * L - 4, base: (k - (nb - 1) / 2) * pas, rang: j + 1 }; });
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
      const c = cibles(I.pts, o.tour || 25, T.L, I.ordreDepart);
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
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "p2-svg"); svg.setAttribute("viewBox", minx.toFixed(1) + " " + minz.toFixed(1) + " " + w.toFixed(1) + " " + h.toFixed(1)); svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", o.titre || "Circuit");
    svg.innerHTML = '<defs><pattern id="p2g" width="' + K(24) + '" height="' + K(24) + '" patternUnits="userSpaceOnUse"><path d="M' + K(24) + ' 0H0V' + K(24) + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="' + K(1) + '"/></pattern></defs>' +
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
      const c = cibles(I.pts, o.tour || 25, T.L, I.ordre);
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
