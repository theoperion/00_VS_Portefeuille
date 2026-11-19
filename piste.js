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
    melbourne: { pts: F_LAC, decor: "solstice", heure: "jour", eau: [resserrer(F_LAC, .3)], peint: "terrier", reperes: [] },
    suzuka: { pts: etoile([[5, .17, .6]], 45), decor: "solstice", heure: "jour", peint: "anneau", reperes: [{ t: "mai" }] },   // avril · Seigneur des Anneaux
    miami: { pts: polyg([[40, 210], [320, 210], [320, 60], [270, 60], [270, 104], [220, 104], [220, 30], [160, 30], [160, 92], [110, 92], [110, 50], [40, 50]], 12), decor: "solstice", heure: "crepuscule", peint: "arene", reperes: [{ t: "tourcentrale", y: 160 }] },
    montreal: { pts: polyg([[60, 30], [300, 30], [300, 210], [212, 210], [212, 120], [148, 120], [148, 210], [60, 210]], 18),   // juin · Star Wars (tracé de la maquette validée)
       decor: "arene", heure: "nuit", amb: "neon", peint: "etoiles", reperes: [{ t: "holodome" }] },
    silverstone: { pts: F_DUNES, decor: "dunes", heure: "crepuscule", amb: "desert", peint: "dunes", reperes: [{ t: "ver", y: 122 }] },   // juillet · Dune (tracé échangé avec singapour le 19/11, atouts et pièges inchangés)
    spa: { pts: etoile([[1, .16, .5], [2, .17, 2.2], [4, .06, .8]], 36, t => 5 + 5 * Math.sin(2 * t + 1)), decor: "envers", heure: "nuit", amb: "envers", peint: "envers", reperes: [{ t: "faille" }] },
    monza: { pts: F_CHAMPI, decor: "survivants", heure: "crepuscule", amb: "spores", peint: "multivers", reperes: [{ t: "champignons", y: 95 }] },
    singapour: { pts: huit(), decor: "solstice", heure: "jour", peint: "chocolat", reperes: [] },   // octobre · la Chocolaterie (avec Halloween)
    interlagos: { pts: polyg([[40, 40], [320, 40], [334, 96], [292, 132], [304, 184], [250, 212], [200, 170], [150, 206], [90, 202], [56, 156], [30, 100]], 22, (x, y) => Math.max(0, 9 - (y - 40) / 18)), decor: "titans", heure: "crepuscule", amb: "cendres", peint: "titans", reperes: [{ t: "mur" }] },
    lasvegas: { pts: etoile([[3, .2, .5], [6, .03]], 39, t => 9 + 7 * Math.sin(t + .4)), decor: "olympe", heure: "jour", amb: "olympe", peint: "odyssee", reperes: [{ t: "temple" }] },
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
      /** un objet qui fait le tour de la piste (posé à la fraction fr si les animations sont coupées) */
      surPiste(fr, dedans, dur, debut, fixe) { if (anime) return `<g><animateMotion dur="${dur}s" begin="-${(+(debut || 0)).toFixed(1)}s" repeatCount="indefinite"${fixe ? "" : ` rotate="auto"`} path="${K.piste.replace(/(-?\d+\.\d) (-?\d+\.\d)/g, "$1,$2")}"/>${dedans}</g>`;
        const i = ((Math.floor(fr * N) % N) + N) % N, [, , tx, ty] = K.nrm(i); return `<g transform="translate(${f(P[i][0])} ${f(P[i][1])})${fixe ? "" : ` rotate(${f(Math.atan2(ty, tx) * 57.3)})`}">${dedans}</g>`; },
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
  /* ---------- Août · Monde à l'envers (petite ville des années 80) — v16.12, enrichi ---------- */

  /* ---------- Septembre · Ville des survivants (monde post-apocalyptique) ---------- */

  /* ---------- Juin · La Course des étoiles (bataille spatiale) ---------- */

  /* ---------- Octobre · La Route de l'Anneau (terres du milieu fantastiques) ---------- */

  /* ---------- Mai · Mégapole sous la pluie (v2, peaufinée) ---------- */

  /* ---------- Juillet · Mer de dunes (v2, peaufinée) ---------- */

  /* ---------- Novembre · Derrière les remparts (v2, peaufinée) ---------- */

  /* ---------- Décembre · Sommet des dieux (v2, peaufinée) ---------- */

  /* ---------- Mars · Le Pays des merveilles (v3 : les personnages du livre de 1865, libre de droits, dans notre style) ---------- */

  /* ---------- Février · Le château, pièce par pièce (v3 : la carte magique sur parchemin, on vole en balai) ---------- */

  /* ---------- Avril · La chocolaterie (v2 : la grande salle comestible, piste en chocolat fondu) ---------- */

  /* ---------- Mai · L'Arène-horloge (les jeux de l'arène) — maquette ----------
     Une arène en pleine forêt découpée en 12 secteurs comme une horloge ; chaque heure, un piège se déclenche dans son secteur
     (l'aiguille lumineuse fait le tour en 36 s et réveille le piège qu'elle survole). Au centre : la Corne d'abondance sur son île,
     les 24 plateaux de départ et les 12 rayons de sable ; au bord : le champ de force en hexagones ; dans le ciel : les 4 pilotes ;
     au loin : le Capitole. Parachutes argentés des sponsors, geai moqueur qui siffle les 4 notes. */
  function peindreArene2(T, Z, def) {
    const K = kit(T, def, 74, "hg-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#1A1410" stroke-width="1.2"`, PEAU = "#F2CDB0", OR = "#E2B93B";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const DUR = 36, PAS = DUR / 12, RO = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"], NOM = ["la foudre", "baies mortelles", "guêpes tueuses", "singes", "oiseaux imitateurs", "raz-de-marée", "brouillard", "pluie de sang", "mur de feu", "loups", "tornade", "blizzard"];
    // ---- géométrie : l'horloge (centre = la Corne), le dôme (ellipse du champ de force)
    const cx = 540, cy = 455, RL = Math.max(62, Math.min(96, K.dT(cx, cy) - 36));
    const EX = 540, EY = 360, ERX = 600, ERY = 420, dome = (x, y) => Math.sqrt(((x - EX) / ERX) ** 2 + ((y - EY) / ERY) ** 2);
    const ang = k => (-90 + 30 * k) * PI / 180, sect = (x, y) => Math.floor(((((Math.atan2(y - cy, x - cx) * 180 / PI + 105) % 360) + 360) % 360) / 30);
    const coin = (k, R) => { const a0 = ang(k) - PI / 12, a1 = ang(k) + PI / 12, am = ang(k); return `M${cx} ${cy}L${f(cx + Math.cos(a0) * R)} ${f(cy + Math.sin(a0) * R)}L${f(cx + Math.cos(am) * R * 1.04)} ${f(cy + Math.sin(am) * R * 1.04)}L${f(cx + Math.cos(a1) * R)} ${f(cy + Math.sin(a1) * R)}Z`; };
    const ell = `<ellipse cx="${EX}" cy="${EY}" rx="${ERX}" ry="${ERY}"/>`;
    // le piège du secteur k se réveille quand l'aiguille passe (fondu bas → haut → bas)
    const act = (k, lo, hi) => an(`<animate attributeName="opacity" values="${lo};${hi};${hi};${lo};${lo}" keyTimes="0;.03;.085;.14;1" dur="${DUR}s" begin="${(PAS * k - DUR).toFixed(1)}s" repeatCount="indefinite"/>`);
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.9 - 6)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 12)}" height="17" rx="8" fill="#FFFDF6" stroke="#1A1410" stroke-width="1"/><path d="M${f(x - 4)} ${f(y + 6)}l2 7l6 -7" fill="#FFFDF6" stroke="#1A1410" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#1A1410">${txt}</text></g>`);
    // placement d'une scène dans son secteur (loin de la piste et des autres scènes)
    const place = (k, Ro, dmin, dmax, Rt) => { let best = null, bs = 1e9; Rt = Rt === undefined ? Ro * .8 + 18 : Rt;
      for (let e = 0; e < 7000; e++) { const t = ang(k) + (r() - .5) * PI / 6 * .9, d = dmin + r() * (dmax - dmin), x = cx + Math.cos(t) * d, y = cy + Math.sin(t) * d;
        if (x < Ro * .8 || x > W - Ro * .8 || y < Ro * .8 || y > H - Ro * .95 || K.dT(x, y) < Rt || K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + Ro)) continue;
        const sc = Math.abs(t - ang(k)) * 120 + Math.abs(d - (dmin + dmax) / 2) * .15; if (sc < bs) { bs = sc; best = [x, y]; } }
      if (best) K.prendre(best[0], best[1], Ro); return best; };
    // chaque scène est dessinée autour de (0,0) puis agrandie (SC) : ouvre/ferme encadrent ses deux couches
    const SC = 1.3, ouvre = (x, y) => { const g = `<g transform="translate(${f(x)} ${f(y)}) scale(${SC}) translate(${f(-x)} ${f(-y)})">`; s.push(g); a.push(g); }, ferme = () => { s.push("</g>"); a.push("</g>"); };
    // ---- dégradés et motifs
    s.push(`<radialGradient id="hg-sol" cx="50%" cy="62%" r="75%"><stop offset="0" stop-color="#4E7A3A"/><stop offset=".6" stop-color="#2E5226"/><stop offset="1" stop-color="#16301A"/></radialGradient>`);
    s.push(`<radialGradient id="hg-lac" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#5CC6D8"/><stop offset=".55" stop-color="#2A8AA8"/><stop offset="1" stop-color="#14506E"/></radialGradient>`);
    s.push(`<linearGradient id="hg-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".35" stop-color="#F2C64A"/><stop offset=".75" stop-color="#B07A1E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
    s.push(`<linearGradient id="hg-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1430"/><stop offset="1" stop-color="#1E3A6A"/></linearGradient>`);
    s.push(`<linearGradient id="hg-cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F1EA"/><stop offset="1" stop-color="#B9B2C8"/></linearGradient>`);
    s.push(`<linearGradient id="hg-arg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A94A6"/><stop offset=".45" stop-color="#F4F8FF"/><stop offset="1" stop-color="#9AA4B6"/></linearGradient>`);
    s.push(`<pattern id="hg-terre" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#6A5238"/><circle cx="3" cy="4" r="1.2" fill="#7E6444"/><circle cx="10" cy="10" r="1.5" fill="#5A4430"/><circle cx="11" cy="3" r=".8" fill="#8A7050"/></pattern>`);
    s.push(`<clipPath id="hg-dome">${ell}</clipPath>`);
    // ---- 1. le sol : 12 secteurs teintés (un biome par heure)
    const TEINTE = ["#3E7A2E", "#3A2A4A", "#7A8A2A", "#2E6A34", "#2E6A5A", "#2A6A8A", "#9AB89A", "#8A2A24", "#A04A14", "#1A2E22", "#C9A45A", "#DCE8F2"];
    s.push(`<g clip-path="url(#hg-dome)">${TEINTE.map((c, k) => `<path d="${coin(k, 1400)}" fill="${c}" opacity="${k === 11 ? .55 : .38}"/>`).join("")}</g>`);
    for (let k = 0; k < 90; k++) { const x = r() * W, y = r() * H; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(20 + r() * 50)}" ry="${f(10 + r() * 22)}" fill="${r() < .5 ? "#0E2410" : "#9ACB6A"}" opacity=".12"/>`); }
    // ---- 2. le lac de la Corne : 12 rayons de sable (les aiguilles), les 24 plateaux de départ, l'île
    K.prendre(cx, cy, RL + 22);
    s.push(`<circle cx="${cx}" cy="${cy}" r="${f(RL + 10)}" fill="#D9C08A" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="${f(RL + 3)}" fill="url(#hg-lac)"/>`);
    for (let k = 0; k < 12; k++) { const t = ang(k) - PI / 12; s.push(`<path d="M${f(cx + Math.cos(t) * 34)} ${f(cy + Math.sin(t) * 34)}L${f(cx + Math.cos(t) * (RL + 6))} ${f(cy + Math.sin(t) * (RL + 6))}" stroke="#E8D29A" stroke-width="9" stroke-linecap="round"/><path d="M${f(cx + Math.cos(t) * 34)} ${f(cy + Math.sin(t) * 34)}L${f(cx + Math.cos(t) * (RL + 6))} ${f(cy + Math.sin(t) * (RL + 6))}" stroke="#C9AE70" stroke-width="2" stroke-dasharray="3 5"/>`); }
    s.push(`<circle cx="${cx}" cy="${cy}" r="38" fill="#E8D29A" stroke="#C9AE70" stroke-width="2"/>`);
    for (let k = 0; k < 24; k++) { const t = ang(Math.floor(k / 2)) + (k % 2 ? 1 : -1) * PI / 26, d = RL * .74, x = cx + Math.cos(t) * d, y = cy + Math.sin(t) * d, pj = [3, 9, 14, 20].indexOf(k);
      s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5.2" fill="url(#hg-arg)" stroke="#4A5466" stroke-width=".8"/>`);
      if (pj >= 0) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="none" stroke="${COULEURS_J[pj]}" stroke-width="1.6"/><circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="${COULEURS_J[pj]}" ${INK}/>`); }
    // reflets et ondes sur le lac
    for (let k = 0; k < 6; k++) { const t = r() * TAU, d = 36 + r() * (RL - 46); if (k === 0) a.push(`<ellipse cx="${f(cx + Math.cos(t) * d)}" cy="${f(cy + Math.sin(t) * d)}" rx="4" ry="2" fill="none" stroke="#E8F8FF" stroke-width=".9" opacity="0">${an(`<animate attributeName="rx" values="2;12" dur="4s" begin="${k * .7}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="4s" begin="${k * .7}s" repeatCount="indefinite"/>`)}</ellipse>`); }
    // la Corne d'abondance : grande corne dorée en spirale, la gueule ouverte qui déverse armes et sacs
    s.push(`${G(cx, cy, 1.25)}<ellipse cx="4" cy="14" rx="34" ry="9" fill="#000" opacity=".3"/>
      <path d="M-30 -14Q-38 -30 -24 -34Q-12 -36 -14 -24Q-16 -16 -8 -14L14 -18Q30 -20 32 -2Q34 14 18 16L-6 10Q-22 6 -30 -14Z" fill="url(#hg-or)" ${INK}/>
      <path d="M-24 -28q6 -4 8 2M-18 -19Q-4 -6 14 -12M-12 -14Q2 0 20 -4M-6 -3Q8 8 24 4" stroke="#8A5A14" stroke-width="1" fill="none"/>
      <ellipse cx="26" cy="-1" rx="7" ry="16" fill="#2A1A08" stroke="#8A5A14" stroke-width="1.5" transform="rotate(-12 26 -1)"/>
      <path d="M-26 -30q3 -2 5 1" stroke="#FFF6D0" stroke-width="1.4" fill="none"/><path d="M-6 -12Q8 -18 22 -14" stroke="#FFF6D0" stroke-width="1.6" fill="none" opacity=".8"/></g>`);
    // le butin : arc et carquois, haches, lance, épée, pain, gourde, sacs aux couleurs des 4
    s.push(`${G(cx + 40, cy + 2, 1.15)}<path d="M2 -16Q14 -4 2 10" stroke="#7A4A1E" stroke-width="2.2" fill="none"/><path d="M2 -16L2 10" stroke="#F4F1EA" stroke-width=".6"/>
      <rect x="8" y="-12" width="5" height="16" rx="1.5" fill="#6A3A1A" ${INK} transform="rotate(20 10 -4)"/><path d="M10 -14l-1 -5M12 -13l1 -5M14 -12l2 -4" stroke="#F4F1EA" stroke-width="1"/>
      <path d="M-4 16L30 8" stroke="#8A6A48" stroke-width="1.8"/><path d="M30 8l7 -3l-5 6z" fill="#C8D0DA" ${INK}/>
      <path d="M16 18l10 6" stroke="#5A3A1A" stroke-width="2"/><path d="M24 20q6 -2 5 6q-4 0 -5 -6z" fill="#C8D0DA" ${INK}/>
      <path d="M-2 22l16 -4" stroke="#DCE2EA" stroke-width="2.4"/><path d="M-2 22l-4 1M0 20l1 4" stroke="#C9962A" stroke-width="2"/>
      <ellipse cx="22" cy="-16" rx="5" ry="3" fill="#C98A3A" ${INK}/><rect x="-6" y="-22" width="5" height="8" rx="2" fill="#5A7A8A" ${INK}/></g>`);
    COULEURS_J.forEach((c, k) => { const t = -.6 + k * .42, x = cx + 40 + Math.cos(t) * 30, y = cy + 4 + Math.sin(t) * 26; s.push(`${G(x, y, 1, k * 25 - 20)}<rect x="-5" y="-6" width="10" height="12" rx="3" fill="${c}" ${INK}/><rect x="-3.5" y="-2" width="7" height="4" rx="1" fill="#000" opacity=".2"/><path d="M-3 -6q3 -4 6 0" stroke="#1A1410" fill="none"/></g>`); });
    a.push(`<circle cx="${cx + 24}" cy="${cy - 2}" r="10" fill="#FFF2B8" opacity="${K.anime ? 0 : .22}">${an(`<animate attributeName="opacity" values="0;.5;0" dur="3s" repeatCount="indefinite"/>`)}</circle>`);   // reflet doré de la Corne (animé, demandé par Théo)
    // ---- 3. les scènes de pièges (une par heure)
    const scenes = {}, inter = (A, B) => A[0] < B[2] && A[2] > B[0] && A[1] < B[3] && A[3] > B[1]; let FEU = null, ECL = null;
    s.push(`<radialGradient id="hg-feu"><stop offset="0" stop-color="#FFF6C0" stop-opacity=".95"/><stop offset=".35" stop-color="#FFB02A" stop-opacity=".75"/><stop offset="1" stop-color="#FF4A1E" stop-opacity="0"/></radialGradient>`);
    // XII · l'arbre frappé par la foudre
    scenes[0] = place(0, 46 * SC, 150, 330);
    if (scenes[0]) { const [x, y] = scenes[0]; ECL = [x - 42, y - 212, x + 38, y - 14]; ouvre(x, y); s.push(`${G(x, y, 1)}<ellipse cx="6" cy="36" rx="40" ry="8" fill="#000" opacity=".3"/><path d="M-8 36Q-6 4 -4 -14L-12 -40M-4 -14L8 -44M-2 4Q10 -6 22 -18M-6 -2Q-16 -10 -26 -22" stroke="#3A2414" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M-6 36Q-3 6 -2 -14L6 -40" stroke="#1A0E06" stroke-width="2.5" fill="none"/>
      ${[[-24, -34, 15], [6, -48, 17], [22, -26, 14], [-10, -54, 12], [-30, -14, 11]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#2E4A24" ${INK}/><circle cx="${u - 3}" cy="${v - 4}" r="${R * .55}" fill="#4E7A3A"/>`).join("")}
      ${[0, 1, 2, 3, 4, 5].map(q => `<path d="M-11 ${30 - q * 5}q5 3 10 0" stroke="#D87A3A" stroke-width="1.3" fill="none"/>`).join("")}<path d="M-1 30Q20 30 30 40" stroke="#D87A3A" stroke-width="1.2" fill="none"/><path d="M-2 -14l-3 -8l4 5l1 -9l3 10" stroke="#FFB347" stroke-width="1" fill="none"/></g>`);
      a.push(`<g opacity="${K.anime ? ".0" : "1"}">${act(0, 0, 1)}${G(x, y, 1)}<path d="M-30 -160L-8 -110L-22 -104L4 -40L-2 -86L12 -92Z" fill="#F4FAFF" stroke="#9AD8FF" stroke-width="2"/><circle cx="0" cy="-40" r="26" fill="#BFE8FF" opacity=".35"/></g></g>`);
      a.push(`<g opacity=".0">${an(`<animate attributeName="opacity" values="0;.9;0;.7;0;0" keyTimes="0;.01;.02;.03;.05;1" dur="${DUR}s" begin="${-DUR + .3}s" repeatCount="indefinite"/>`)}<rect x="${f(x - 120)}" y="${f(y - 120)}" width="240" height="200" fill="#EAF6FF" opacity=".25"/></g>`); ferme(); }
    // II · le nid de guêpes tueuses et leur essaim
    scenes[2] = place(2, 36 * SC, 200, 520);
    if (scenes[2]) { const [x, y] = scenes[2]; ouvre(x, y); s.push(`${G(x, y, 1)}<ellipse cx="4" cy="30" rx="30" ry="7" fill="#000" opacity=".3"/><path d="M-30 -30Q0 -38 30 -26" stroke="#4A3018" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-6 -32q-2 4 0 6" stroke="#4A3018" stroke-width="2"/>
      <path d="M-4 -26Q-18 -20 -16 2Q-12 24 0 26Q12 24 14 2Q14 -20 -4 -26Z" fill="#C9B07A" ${INK}/>${[-14, -6, 2, 10, 18].map(v => `<path d="M-14 ${v}Q0 ${v + 5} 13 ${v}" stroke="#8A7040" stroke-width="1.2" fill="none"/>`).join("")}<ellipse cx="0" cy="18" rx="4" ry="3" fill="#2A1A08"/></g>`);
      { const ess = [[], []], mv = []; for (let q = 0; q < 22; q++) { const u = x + (r() - .5) * 70, v = y + (r() - .5) * 60, d = (1 + r() * 1.5).toFixed(1), m = `0 0;${f((r() - .5) * 26)} ${f((r() - .5) * 20)};${f((r() - .5) * 26)} ${f((r() - .5) * 20)};0 0`; if (q < 2) mv.push([m, d]);
         ess[q % 2].push(`<ellipse cx="${f(u)}" cy="${f(v)}" rx="2.2" ry="1.4" fill="#F2C230" stroke="#1A1410" stroke-width=".6"/><ellipse cx="${f(u)}" cy="${f(v - 1.4)}" rx="1.6" ry="1" fill="#E8F4FF" opacity=".8"/>`); }
         a.push(`<g opacity="${K.anime ? ".55" : "1"}">${act(2, .55, 1)}${ess.map((e, q) => `<g>${an(`<animateTransform attributeName="transform" type="translate" values="${mv[q][0]}" dur="${mv[q][1]}s" repeatCount="indefinite"/>`)}${e.join("")}</g>`).join("")}</g>`); }
      ferme(); bulle(x, y - 48 * SC, "Bzzz… des guêpes tueuses !", 9, 0); }
    // III · les singes mutants qui sautent d'arbre en arbre
    scenes[3] = place(3, 44 * SC, 150, 420);
    if (scenes[3]) { const [x, y] = scenes[3]; ouvre(x, y); s.push(`${G(x, y, 1)}<ellipse cx="4" cy="34" rx="44" ry="8" fill="#000" opacity=".3"/>${[[-26, 34, -10], [22, 34, 14]].map(([u, v, h]) => `<path d="M${u} ${v}Q${u - 2} 0 ${u + 2} -28" stroke="#4A3018" stroke-width="6" fill="none"/><circle cx="${u}" cy="-34" r="18" fill="#1E5A2A" ${INK}/><circle cx="${u - 4}" cy="-38" r="10" fill="#3E8A3A"/>`).join("")}<path d="M-24 -10Q0 0 20 -14" stroke="#4A6A2A" stroke-width="2" fill="none"/></g>`);
      const singe = (u, v, sc) => `${G(u, v, sc)}<ellipse cx="0" cy="0" rx="7" ry="9" fill="#C8601E" ${INK}/><circle cx="0" cy="-11" r="6" fill="#C8601E" ${INK}/><ellipse cx="0" cy="-9.5" rx="4" ry="3" fill="#F2B888"/><circle cx="-2" cy="-12" r="1.1" fill="#FF2A2A"/><circle cx="2" cy="-12" r="1.1" fill="#FF2A2A"/><path d="M-1.5 -8.5h3" stroke="#1A1410" stroke-width=".8"/><path d="M-6 -4q-8 -4 -10 -12M6 -4q8 -4 10 -12M5 6q10 6 6 14" stroke="#C8601E" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M-4 -18l2 2M4 -18l-2 2" stroke="#1A1410" stroke-width=".8"/></g>`;
      s.push(singe(x - 26, y - 46, .9)); s.push(singe(x + 26, y - 40, .8));
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;24 -26;52 0;52 0;24 -26;0 0;0 0" keyTimes="0;.12;.25;.5;.62;.75;1" dur="5s" repeatCount="indefinite"/>`)}${singe(x - 26, y + 6, 1)}</g>`);
      a.push(`<g opacity="${K.anime ? ".4" : "1"}">${act(3, .4, 1)}${[-1, 1].map(sd => `<path d="M${f(x + sd * 30)} ${f(y - 64)}l${sd * 4} -6l${sd * -2} 6l${sd * 6} -4" stroke="#FF5A2A" stroke-width="1.6" fill="none"/>`).join("")}</g>`); ferme(); }
    // IV · les geais bavards qui imitent les voix
    scenes[4] = place(4, 40 * SC, 140, 420);
    if (scenes[4]) { const [x, y] = scenes[4]; ouvre(x, y); const geai = (u, v, sc, fl) => `${G(u, v, sc)}<g transform="scale(${fl ? -1 : 1} 1)"><ellipse cx="0" cy="0" rx="8" ry="5" fill="#2A3A5A" ${INK}/><circle cx="7" cy="-4" r="4" fill="#2A3A5A" ${INK}/><path d="M10 -4l5 1l-5 1z" fill="#1A1410"/><circle cx="8" cy="-5" r=".9" fill="#FFF"/><path d="M-6 0l-8 3l7 1" fill="#1E2A44" ${INK}/><path d="M-3 -2q4 -6 8 0" fill="#4A6A9A" stroke="none"/><path d="M-2 4v4M2 4v4" stroke="#1A1410" stroke-width=".8"/></g></g>`;
      s.push(`${G(x, y, 1)}<ellipse cx="4" cy="30" rx="40" ry="8" fill="#000" opacity=".3"/><path d="M-6 30Q-8 0 -2 -20" stroke="#4A3018" stroke-width="7" fill="none"/><path d="M-40 -8Q-4 -2 40 -12" stroke="#4A3018" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="-2" cy="-30" r="20" fill="#24503A" ${INK}/><circle cx="-6" cy="-34" r="11" fill="#3E7A54"/></g>`);
      [[-30, -16, 1, 0], [-14, -14, .9, 1], [14, -18, 1, 0], [30, -20, .9, 1]].forEach(([u, v, sc, fl]) => s.push(geai(x + u, y + v, sc, fl)));
      a.push(`<g>${an(`<animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path="M${f(x + 46)} ${f(y - 30)}a46 22 0 1 1 -92 0a46 22 0 1 1 92 0"/>`)}${K.anime ? "" : `<g transform="translate(${f(x + 44)} ${f(y - 50)})">`}<g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .4;1 1" dur=".35s" repeatCount="indefinite"/>`)}<path d="M-8 0q8 -10 16 0q-8 4 -16 0z" fill="#2A3A5A" ${INK}/></g>${K.anime ? "" : "</g>"}</g>`);
      a.push(`<g opacity="${K.anime ? ".0" : "1"}">${act(4, 0, 1)}${[0, 1, 2].map(q => `<path d="M${f(x + 34 + q * 8)} ${f(y - 34 - q * 4)}q6 -2 6 -8" stroke="#FFF" stroke-width="1.4" fill="none"/>`).join("")}</g>`);
      ferme(); bulle(x, y - 56 * SC, "« Au secours ! »… ce n'était qu'un oiseau.", 8, 4); }
    // I · les baies mortelles
    scenes[1] = place(1, 36 * SC, 120, 420);
    if (scenes[1]) { const [x, y] = scenes[1]; ouvre(x, y); s.push(`${G(x, y, 1)}<ellipse cx="2" cy="22" rx="38" ry="8" fill="#000" opacity=".3"/>${[[-20, 4, 16], [0, -6, 20], [20, 6, 15], [-6, 12, 14], [12, 14, 13]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#1E3A26" ${INK}/><circle cx="${u - 3}" cy="${v - 4}" r="${R * .5}" fill="#2E5A36"/>`).join("")}
      ${Array.from({ length: 26 }, () => `<circle cx="${f((r() - .5) * 52)}" cy="${f((r() - .5) * 34)}" r="${f(1.8 + r() * 1.4)}" fill="#2A1638" stroke="#0A0610" stroke-width=".5"/>`).join("")}${[-14, 6, 18].map(u => `<circle cx="${u - .6}" cy="-1" r=".7" fill="#C9A8FF"/>`).join("")}
      <g transform="translate(38 4)">${[-7, -3, 1, 5].map((u, q) => `<rect x="${u - 1.6}" y="${-14 + Math.abs(q - 1.5) * 1.5}" width="3.4" height="9" rx="1.7" fill="${PEAU}" ${INK}/>`).join("")}<rect x="8" y="-6" width="3.4" height="7" rx="1.7" fill="${PEAU}" ${INK} transform="rotate(-40 9 -2)"/><path d="M-9 -6Q-9 6 0 7Q9 6 9 -6Z" fill="${PEAU}" ${INK}/>${[0, 1, 2, 3, 4].map(q => `<circle cx="${f(-1 + q * 2.2)}" cy="${f(-5 + (q % 2))}" r="1.8" fill="#2A1638"/>`).join("")}</g></g>`);
      a.push(`<g opacity="${K.anime ? ".3" : "1"}">${act(1, .3, 1)}<circle cx="${f(x)}" cy="${f(y)}" r="40" fill="none" stroke="#B57BFF" stroke-width="2" stroke-dasharray="4 6"/></g>`);
      ferme(); bulle(x - 6, y - 40 * SC, "Un… deux… trois !", 8, -4); }
    // VIII · le mur de feu et les boules de feu
    scenes[8] = place(8, 46 * SC, 120, 420);
    if (scenes[8]) { const [x, y] = scenes[8]; FEU = [x - 74, y - 84, x + 74, y + 24]; ouvre(x, y);
      [[-36, -44, 1, 30], [6, -58, 1.15, -10], [42, -38, .9, 40]].forEach(([u, v, sc, rot]) => s.push(`${G(x + u, y + v, sc, rot)}<path d="M-4 3Q-14 14 -22 26Q-10 20 2 6Z" fill="#FF7A1E" opacity=".55"/><path d="M-2 4Q-8 12 -12 18Q-4 14 2 6Z" fill="#FFD27A" opacity=".7"/><circle r="15" fill="url(#hg-feu)"/><circle r="5.5" fill="#FF8A1E" stroke="#FFF2B0" stroke-width="1.3"/><circle cx="-1.2" cy="-1.4" r="2.2" fill="#FFF8DA"/></g>`)); s.push(`${G(x, y, 1)}<ellipse cx="0" cy="14" rx="56" ry="12" fill="#1A0A04" opacity=".55"/>${Array.from({ length: 7 }, (_, q) => `<path d="M${-44 + q * 14} 14L${-40 + q * 14} -6L${-36 + q * 14} 14" stroke="#2A1408" stroke-width="2.4" fill="none"/>`).join("")}</g>`);
      const flamme = (u, v, h, q) => (r(), `<g transform="translate(${f(u)} ${f(v)})"><g transform="scale(${q % 2 ? "1 1.08" : ".95 .96"})"><path d="M-7 0Q-9 ${f(-h * .5)} 0 ${f(-h)}Q9 ${f(-h * .5)} 7 0Z" fill="#E8471E"/><path d="M-4 0Q-5 ${f(-h * .4)} 0 ${f(-h * .7)}Q5 ${f(-h * .4)} 4 0Z" fill="#FFB12A"/><path d="M-2 0Q-2 ${f(-h * .2)} 0 ${f(-h * .4)}Q2 ${f(-h * .2)} 2 0Z" fill="#FFF2B0"/></g></g>`);
      a.push(`<g opacity="${K.anime ? ".7" : "1"}">${act(8, .7, 1)}<g transform="translate(0 ${f(y + 12)})"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1.03 1.16;.98 .9;1 1" dur=".9s" repeatCount="indefinite"/>`)}<g transform="translate(0 ${f(-y - 12)})">${Array.from({ length: 9 }, (_, q) => flamme(x - 48 + q * 12, y + 12 + Math.sin(q) * 3, 22 + r() * 18, q)).join("")}</g></g></g></g>`);
      for (let q = 0; q < 1; q++) a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="${f(-60 + q * 20)} 40;${f(20 + q * 10)} -40;${f(80 + q * 10)} 30" dur="${(2.4 + q * .5).toFixed(1)}s" begin="${q * .8}s" repeatCount="indefinite"/>`)}<circle cx="${f(x)}" cy="${f(y - 10)}" r="9" fill="#FF6A1E" opacity=".3"/><circle cx="${f(x)}" cy="${f(y - 10)}" r="5" fill="#FF8A1E" stroke="#FFF2B0" stroke-width="1.2"/><circle cx="${f(x - 1)}" cy="${f(y - 11)}" r="2" fill="#FFF6D0"/></g>`); ferme(); }
    // IX · les loups mutants aux yeux qui brillent
    scenes[9] = place(9, 44 * SC, 130, 420);
    if (scenes[9]) { const [x, y] = scenes[9]; ouvre(x, y); const loup = (u, v, sc, hurle) => { const LP = `fill="#3A3E4A" stroke="#14161C" stroke-width="1.1" stroke-linejoin="round"`; return `${G(u, v, sc)}<ellipse cx="0" cy="7" rx="18" ry="3" fill="#000" opacity=".3"/>${[[-11, -4, -13], [-5, -3, -4], [6, -4, 8], [11, -5, 12]].map(([p, q, w]) => `<path d="M${p} ${q}L${w} 6" stroke="#2A2E38" stroke-width="3.2" stroke-linecap="round"/>`).join("")}<path d="M-14 -11Q-26 -10 -29 1Q-22 -3 -14 -5Z" ${LP}/><ellipse cx="-1" cy="-9" rx="15" ry="7" ${LP}/><path d="M-10 -14Q0 -18 10 -15" stroke="#6A7080" stroke-width="2" fill="none"/><path d="M7 -14Q13 -19 15 -23L21 -19Q18 -9 12 -4Z" ${LP}/><g transform="rotate(${hurle ? -50 : 0} 17 -20)"><path d="M14 -25Q20 -28 24 -24L32 -22Q32 -18 27 -18L19 -15Q14 -17 14 -25Z" ${LP}/><path d="M15 -25l1 -7l4 5z" ${LP}/>${hurle ? `<path d="M27 -18l4 2" stroke="#14161C" stroke-width="1"/>` : ""}<circle cx="21" cy="-22.5" r="1.3" fill="#FF3A1E"/></g></g>`; };
      s.push(`${G(x, y, 1)}<ellipse cx="4" cy="20" rx="46" ry="9" fill="#000" opacity=".35"/><path d="M-10 18Q-14 -2 4 -10Q22 -12 26 8L28 18Z" fill="#5A5A62" ${INK}/><path d="M-4 0q10 -6 22 -2" stroke="#7A7A84" stroke-width="2" fill="none"/></g>`);
      s.push(loup(x + 8, y - 8, 1, true)); s.push(loup(x - 30, y + 16, .9, false)); s.push(loup(x + 30, y + 22, .85, false));
      a.push(`<g opacity="${K.anime ? ".3" : "1"}">${act(9, .3, 1)}${[[-6, -14], [10, 0], [-22, 4], [24, -10], [-36, -6]].map(([u, v]) => `<g><circle cx="${f(x + u - 2.4)}" cy="${f(y + v - 40)}" r="1.3" fill="#FF5A2A"/><circle cx="${f(x + u + 2.4)}" cy="${f(y + v - 40)}" r="1.3" fill="#FF5A2A"/></g>`).join("")}</g>`);
      a.push(`<g opacity="${K.anime ? "0" : "1"}">${act(9, 0, 1)}${[0, 1, 2].map(q => `<path d="M${f(x + 24 + q * 6)} ${f(y - 44 - q * 6)}q8 -2 10 -10" stroke="#DDE4F0" stroke-width="1.2" fill="none"/>`).join("")}</g>`); ferme(); }
    // X · la tornade
    scenes[10] = place(10, 36 * SC, 150, 440);
    if (scenes[10]) { const [x, y] = scenes[10]; ouvre(x, y); s.push(`<ellipse cx="${f(x + 4)}" cy="${f(y + 26)}" rx="30" ry="8" fill="#000" opacity=".3"/>`);
      a.push(`<g opacity="${K.anime ? ".75" : "1"}">${act(10, .75, 1)}<g stroke-dashoffset="0">${an(`<animate attributeName="stroke-dashoffset" from="0" to="28" dur=".8s" repeatCount="indefinite"/>`)}${Array.from({ length: 8 }, (_, q) => { const w = 6 + q * 4.2, v = y + 22 - q * 9; return `<ellipse cx="${f(x + Math.sin(q * .8) * 4 + (q % 2 ? 1.5 : -1.5) * (q / 4))}" cy="${f(v)}" rx="${f(w)}" ry="${f(w * .3)}" fill="none" stroke="${q % 2 ? "#D8C8A0" : "#A89070"}" stroke-width="${f(3 - q * .2)}" stroke-dasharray="${q < 3 ? "8 6" : "10 4"}"/>`; }).join("")}</g>
        <g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${f(x)} ${f(y - 20)}" to="360 ${f(x)} ${f(y - 20)}" dur="1.4s" repeatCount="indefinite"/>`)}${[0, 1, 2, 3].map(q => `<rect x="${f(x + 18 + q * 3)}" y="${f(y - 22 - q * 6)}" width="4" height="2" fill="#5A3A1A" transform="rotate(${q * 90} ${f(x)} ${f(y - 20)})"/>`).join("")}</g></g>`); ferme(); }
    // ---- 4. effets de zone : I pluie de sang, V vague géante, VI brouillard, XI blizzard (dans tout le secteur)
    const zone = (k, R, n, test) => { const out = []; for (let e = 0; e < n * 40 && out.length < n; e++) { const x = r() * W, y = r() * H; if (sect(x, y) === k && dome(x, y) < 1 && Math.hypot(x - cx, y - cy) > R && (!test || test(x, y))) out.push([x, y]); } return out; };
    [0, 1, 2, 3].forEach(q => a.push(`<clipPath id="hg-z${[7, 5, 6, 11][q]}"><path d="${coin([7, 5, 6, 11][q], 1400)}"/></clipPath>`));
    // VII · pluie de sang : flaques rouges au sol, gouttes qui tombent
    zone(7, RL + 30, 12, (x, y) => K.dT(x, y) > 26).forEach(([x, y]) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(6 + r() * 10)}" ry="${f(3 + r() * 4)}" fill="#7A0A12" opacity=".7"/>`));
    a.push(`<g clip-path="url(#hg-z7)"><g opacity="${K.anime ? ".45" : "1"}">${act(7, .45, 1)}${(() => { const g = [[], []]; zone(7, RL + 20, 70).forEach(([x, y], q) => { r(); r(); g[q % 2].push(`M${f(x)} ${f(y - (q % 2 ? 0 : 30))}l-2 9`); }); return g.map((d, q) => `<path d="${d.join("")}" stroke="#C8102E" stroke-width="1.5" stroke-linecap="round">${an(`<animateTransform attributeName="transform" type="translate" values="0 -30;-6 30" dur="${q ? ".8" : "1.1"}s" begin="-${q * .4}s" repeatCount="indefinite"/>`)}</path>`).join(""); })()}</g></g>`);
    // V · la vague géante qui déferle depuis le lac
    a.push(`<g clip-path="url(#hg-z5)"><g opacity="${K.anime ? ".35" : "1"}">${act(5, .35, 1)}${[0].map(q => `<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f(Math.cos(ang(5)) * 240)} ${f(Math.sin(ang(5)) * 240)}" dur="6s" begin="${q * 3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" dur="6s" begin="${q * 3}s" repeatCount="indefinite"/>`)}<path d="M${f(cx + Math.cos(ang(5) - .5) * (RL + 4))} ${f(cy + Math.sin(ang(5) - .5) * (RL + 4))}A${f(RL + 4)} ${f(RL + 4)} 0 0 1 ${f(cx + Math.cos(ang(5) + .5) * (RL + 4))} ${f(cy + Math.sin(ang(5) + .5) * (RL + 4))}" fill="none" stroke="#BFF0FF" stroke-width="7" stroke-linecap="round"/><path d="M${f(cx + Math.cos(ang(5) - .45) * (RL - 4))} ${f(cy + Math.sin(ang(5) - .45) * (RL - 4))}A${f(RL - 4)} ${f(RL - 4)} 0 0 1 ${f(cx + Math.cos(ang(5) + .45) * (RL - 4))} ${f(cy + Math.sin(ang(5) + .45) * (RL - 4))}" fill="none" stroke="#2A8AA8" stroke-width="10" opacity=".7"/></g>`).join("")}</g></g>`);
    // VI · le brouillard toxique (et ses cloques)
    a.push(`<radialGradient id="hg-brume" r="50%"><stop offset="0" stop-color="#E8FFD8" stop-opacity=".85"/><stop offset=".6" stop-color="#B8E8A0" stop-opacity=".4"/><stop offset="1" stop-color="#B8E8A0" stop-opacity="0"/></radialGradient>`);
    a.push(`<g clip-path="url(#hg-z6)"><g opacity="${K.anime ? ".5" : ".75"}">${act(6, .5, .75)}${(() => { const g = [[], []]; zone(6, RL - 10, 16).forEach(([x, y], q) => { g[q % 2].push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(40 + r() * 40)}" ry="${f(18 + r() * 14)}" fill="url(#hg-brume)"/>`); r(); r(); r(); }); return g.map((e, q) => `<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${q ? 34 : -26} ${q ? 4 : -3};0 0" dur="${q ? 9 : 11}s" repeatCount="indefinite"/>`)}${e.join("")}</g>`).join(""); })()}</g></g>`);
    // XI · le blizzard : sol givré, flocons
    a.push(`<g clip-path="url(#hg-z11)"><g opacity="${K.anime ? ".5" : "1"}">${act(11, .5, 1)}${(() => { const g = [[], []]; zone(11, RL + 20, 60).forEach(([x, y], q) => { g[q % 2].push(`<circle cx="${f(x)}" cy="${f(y - (q % 2 ? 0 : 22))}" r="${f(1 + r() * 1.6)}" fill="#FFFFFF"/>`); r(); r(); r(); }); return g.map((e, q) => `<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 -20;${q ? 18 : 12} 24" dur="${q ? 2.6 : 3.4}s" begin="-${q * 1.3}s" repeatCount="indefinite"/>`)}${e.join("")}</g>`).join(""); })()}</g></g>`);
    // ---- 5. la forêt : couleur selon l'heure (jungle, sapins enneigés, arbres calcinés, pins noirs des loups…)
    const PAL = [["#6ABB4A", "#2E7A2A", "#16401A"], ["#7A5A9A", "#3A2A5A", "#1A102A"], ["#B8C84A", "#5A7A1E", "#2A3A10"], ["#5ACB6A", "#1E7A3A", "#0E3A1E"], ["#6AC8A0", "#2A7A5A", "#103A2A"], ["#6AC8C8", "#2A6A7A", "#10303A"],
      ["#B8D8B0", "#5A8A5A", "#2A4A2A"], ["#C86A5A", "#6A2A22", "#3A1210"], null, null, ["#C8B87A", "#7A6A3A", "#3A3018"], null];
    K.semis(260, () => 7 + r() * 11, 9000, (x, y) => dome(x, y) < .97, (x, y, R) => { const k = sect(x, y);
      if (k === 11) K.sapin(x, y, R, "#2E5A4A", true); else if (k === 9) K.sapin(x, y, R, "#1A3A2A"); else if (k === 8) { if (r() < .5) K.arbre(x, y, R * .8, "#5A4A2A", "#3A2A14", "#1A0E06"); else { K.ombre(x + 3, y + 3, 5, 5, .4); s.push(`<path d="M${f(x)} ${f(y)}l${f(-R * .6)} ${f(-R * .3)}M${f(x)} ${f(y)}l${f(R * .5)} ${f(-R * .5)}M${f(x)} ${f(y)}l${f(R * .2)} ${f(R * .6)}" stroke="#2A1408" stroke-width="2.2"/><circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="#FF6A1E" opacity=".7"/>`); } }
      else if (k === 10 && r() < .5) { s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .5)}" fill="#8A7A4A" opacity=".8"/>`); } else { const p = PAL[k] || PAL[0]; K.arbre(x, y, R, p[0], p[1], p[2]); } });
    // ---- 6. les lignes de l'horloge et l'extérieur du dôme
    s.push(`<g clip-path="url(#hg-dome)">${Array.from({ length: 12 }, (_, k) => { const t = ang(k) - PI / 12; return `<path d="M${f(cx + Math.cos(t) * (RL + 14))} ${f(cy + Math.sin(t) * (RL + 14))}L${f(cx + Math.cos(t) * 1300)} ${f(cy + Math.sin(t) * 1300)}" stroke="#F7E3A0" stroke-width="1.6" stroke-dasharray="2 9" opacity=".55"/>`; }).join("")}</g>`);
    s.push(`<path d="M0 0H${W}V${H}H0Z M${EX - ERX} ${EY}a${ERX} ${ERY} 0 1 0 ${ERX * 2} 0a${ERX} ${ERY} 0 1 0 ${-ERX * 2} 0Z" fill="#06101E" fill-rule="evenodd" opacity=".72"/>`);
    // ---- le Capitole au loin (coin haut droit, derrière le champ de force) : palais à colonnade et dôme d'or, tours pastel, feux d'artifice
    { const by = 122; let c = ""; 
      [[806, 16, 58, "#E8B8D8"], [828, 12, 84, "#B8D8E8"], [846, 20, 50, "#E8D8B0"], [872, 10, 100, "#D8E8F0"], [1028, 12, 108, "#F0E0C0"], [1046, 14, 90, "#C8B8E8"], [1064, 16, 66, "#E8B8C8"]].forEach(([x, w, h, col]) => { c += `<rect x="${x}" y="${by - h}" width="${w}" height="${h}" fill="${col}" stroke="#5A5470" stroke-width=".6"/><path d="M${x} ${by - h}l${w / 2} ${-(8 + w * .8)}l${w / 2} ${8 + w * .8}z" fill="${col}" stroke="#5A5470" stroke-width=".6"/>`; for (let q = 0; q < h / 8 - 1; q++) c += `<rect x="${x + 2}" y="${by - h + 5 + q * 8}" width="${w - 4}" height="1.6" fill="#FFE08A" opacity="${(.3 + r() * .7).toFixed(2)}"/>`; });
      c += `<rect x="868" y="${by - 30}" width="34" height="30" fill="url(#hg-cap)" stroke="#5A5470" stroke-width=".8"/><rect x="1018" y="${by - 30}" width="34" height="30" fill="url(#hg-cap)" stroke="#5A5470" stroke-width=".8"/>`;
      c += `<rect x="900" y="${by - 44}" width="120" height="44" fill="url(#hg-cap)" stroke="#5A5470" stroke-width=".8"/>${Array.from({ length: 11 }, (_, q) => `<rect x="${904 + q * 10.6}" y="${by - 40}" width="4" height="34" fill="#FFFFFF" stroke="#B9B2C8" stroke-width=".5"/>`).join("")}`;
      c += `<path d="M894 ${by - 44}L960 ${by - 66}L1026 ${by - 44}Z" fill="url(#hg-cap)" stroke="#5A5470" stroke-width=".8"/><circle cx="960" cy="${by - 52}" r="5" fill="url(#hg-or)" ${INK}/>`;
      c += `<rect x="940" y="${by - 80}" width="40" height="14" fill="#E8E2F0" stroke="#5A5470" stroke-width=".8"/><path d="M936 ${by - 80}a24 24 0 0 1 48 0z" fill="url(#hg-or)" ${INK}/><path d="M960 ${by - 104}V${by - 130}" stroke="#E2B93B" stroke-width="2"/><circle cx="960" cy="${by - 131}" r="2.6" fill="#FFF2B8"/>`;
      c += [[912, "#8A1A2A"], [1000, "#8A1A2A"], [878, "#4A2A6A"], [1034, "#4A2A6A"]].map(([x, col]) => `<rect x="${x}" y="${by - 40}" width="8" height="26" fill="${col}"/><circle cx="${x + 4}" cy="${by - 30}" r="2.4" fill="none" stroke="#E2B93B" stroke-width="1"/>`).join("");
      c += `<path d="M890 ${by}h140l8 6h-156z" fill="#D8D2E2" stroke="#5A5470" stroke-width=".6"/>`;
      s.push(`<linearGradient id="hg-brumeC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06101E" stop-opacity="0"/><stop offset="1" stop-color="#06101E" stop-opacity=".95"/></linearGradient>`);
      const hors = `M700 -2H${W + 2}V260H700Z M${EX - ERX * .94} ${EY}a${ERX * .94} ${ERY * .94} 0 1 0 ${ERX * 1.88} 0a${ERX * .94} ${ERY * .94} 0 1 0 ${-ERX * 1.88} 0Z`;
      s.push(`<clipPath id="hg-hors"><path d="${hors}" clip-rule="evenodd"/></clipPath><g clip-path="url(#hg-hors)"><rect x="700" y="0" width="${W - 700}" height="260" fill="url(#hg-ciel)"/>${Array.from({ length: 30 }, () => `<circle cx="${f(720 + r() * 360)}" cy="${f(r() * 200)}" r="${f(.4 + r() * .8)}" fill="#FFF" opacity="${(.3 + r() * .6).toFixed(2)}"/>`).join("")}<g transform="translate(${W} 0) scale(.84) translate(${-W} 0)"><g opacity=".95">${c}</g><rect x="780" y="${by - 26}" width="300" height="40" fill="url(#hg-brumeC)"/></g></g>`);
      [[981, 34, 0], [917, 38, 1], [1043, 31, 2]].forEach(([u, v, q]) => q === 0 && a.push(`<path d="M${u} ${v}l-26 -150l22 0z" fill="#FFF6D0" opacity=".14">${an(`<animateTransform attributeName="transform" type="rotate" values="-28 ${u} ${v};28 ${u} ${v};-28 ${u} ${v}" dur="${6 + q * 2}s" repeatCount="indefinite"/>`)}</path>`));
      [[905, 26, "#FFD27A", 0], [1012, 16, "#FF8FC8", 1.2], [1058, 40, "#9AF4FF", 2.3]].forEach(([u, v, col, b]) => b === 1.2 && a.push(`<g transform="translate(${u} ${v})"><g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="1;0;0" keyTimes="0;.4;1" dur="3.6s" begin="${b}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values=".1;1;1" keyTimes="0;.4;1" dur="3.6s" begin="${b}s" repeatCount="indefinite"/>`)}${Array.from({ length: 12 }, (_, q) => `<path d="M${f(Math.cos(q * PI / 6) * 5)} ${f(Math.sin(q * PI / 6) * 5)}L${f(Math.cos(q * PI / 6) * 16)} ${f(Math.sin(q * PI / 6) * 16)}" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>`).join("")}</g></g>`));
      // l'aéroglisseur du Capitole qui passe
      a.push(`<g${K.anime ? "" : ` transform="translate(-140 0)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="40 0;-300 40" dur="18s" repeatCount="indefinite"/>`)}<path d="M1050 18l26 -6l14 6l-14 5z" fill="#3A3E52" stroke="#9AA4C6" stroke-width=".8"/><circle cx="1062" cy="18" r="1.2" fill="#FF5A5A"/></g>`); }
    // le champ de force : bande d'hexagones le long du dôme
    const HX = 13, hexa = (x, y) => "M" + [0, 1, 2, 3, 4, 5].map(q => f(x + Math.cos(q * PI / 3 + PI / 6) * HX * .96) + " " + f(y + Math.sin(q * PI / 3 + PI / 6) * HX * .96)).join("L") + "Z", hx = [[], [], []];
    for (let j = -1; j < H / (HX * 1.5) + 1; j++) for (let i = -1; i < W / (HX * 1.732) + 1; i++) { const x = i * HX * 1.732 + (j % 2 ? HX * .866 : 0), y = j * HX * 1.5, q = dome(x, y); if (q > .93 && q < 1.03 && !(x < 280 && y < 136)) hx[(i * 7 + j * 3) % 3].push(hexa(x, y)); }
    s.push(`<path d="${hx.flat().join("")}" fill="#7CF2FF" fill-opacity=".05" stroke="#9AF4FF" stroke-width="1" opacity=".55"/>`);
    hx.forEach((g, q) => q < 2 && a.push(`<path d="${g.join("")}" fill="#BFF8FF" fill-opacity=".14" stroke="#DFFCFF" stroke-width="1.4" opacity="0">${an(`<animate attributeName="opacity" values="0;.9;0;0" keyTimes="0;.15;.4;1" dur="4.5s" begin="${q * 2.25}s" repeatCount="indefinite"/>`)}</path>`));
    // ---- 7. la piste : chemin de terre bordé d'or
    K.route([["#05080A", 40, ` opacity=".5" filter="url(#hg-flou)"`], ["#C9A33A", 30], ["#3A2A18", 27], ["url(#hg-terre)", 24]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#F7E3A0" stroke-width="1" stroke-dasharray="1 11" opacity=".7"/>`);
    K.depart();
    // ---- 8. le cadran : chiffres romains au bord, chacun s'allume quand son piège se déclenche
    const MED = [], LAB = [], LW = []; for (let k = 0; k < 12; k++) { let p = null; for (let d = 900; d > RL + 40; d -= 4) { const x = cx + Math.cos(ang(k)) * d, y = cy + Math.sin(ang(k)) * d; if (x > 36 && x < W - 36 && y > 20 && y < H - 38 && !(x < 290 && y < 142) && dome(x, y) < .9 && K.dT(x, y) > 26 && !K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] * .6 + 10)) { p = [x, y]; break; } }
      if (!p) continue; const [x, y] = p; MED[k] = p; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="14" fill="#1A1410" opacity=".55"/><circle cx="${f(x)}" cy="${f(y)}" r="12" fill="url(#hg-or)" ${INK}/><circle cx="${f(x)}" cy="${f(y)}" r="9.5" fill="#2A1E10"/><text x="${f(x)}" y="${f(y + 3.4)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="${RO[k].length > 2 ? 7 : 9}" fill="#F7E3A0">${RO[k]}</text>`);
      const lw = NOM[k].length * 2.45 + 6, note = (u, v) => { if (u < lw + 6 || u > W - lw - 6 || v < 16 || v > H - 24) return -99; const B = [u - lw, v - 9, u + lw, v + 3];
        return Math.min(K.dT(u, v - 3), 50) - (K.occ.some(o => o[2] > 25 && o[2] < 80 && Math.hypot(o[0] - u, o[1] - v) < o[2]) ? 30 : 0) - (FEU && inter(B, FEU) ? 70 : 0) - (ECL && inter(B, ECL) ? 70 : 0) - (Math.max(dome(B[0], v), dome(B[2], v)) > .9 ? 45 : 0); };
      const [tx, ty] = [[0, 24], [0, -18], [-lw - 18, 4], [lw + 18, 4], [-lw - 18, -14], [lw + 18, -14]].map(([u, v]) => [x + u, y + v]).sort((p, q) => note(q[0], q[1]) - note(p[0], p[1]))[0]; LAB[k] = [tx, ty]; LW[k] = lw;
      if (k === 6) a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="url(#hg-or)" ${INK}/><circle cx="${f(x)}" cy="${f(y)}" r="9.5" fill="#2A1E10"/><text x="${f(x)}" y="${f(y + 3.4)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="9" fill="#F7E3A0">${RO[k]}</text>`);   // VI reste net par-dessus le brouillard
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="none" stroke="#FFF2B8" stroke-width="2.5" opacity="0">${act(k, 0, 1)}</circle>`); }
    // l'aiguille : un faisceau doré qui fait le tour du cadran
    a.push(`<clipPath id="hg-domeA">${ell}</clipPath><g clip-path="url(#hg-domeA)"><g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${DUR}s" repeatCount="indefinite"/>`)}<path d="${coin(0, 1300)}" fill="#FFF2B8" opacity=".09"/><path d="M${f(cx + Math.cos(ang(0) + PI / 12) * 30)} ${f(cy + Math.sin(ang(0) + PI / 12) * 30)}L${f(cx + Math.cos(ang(0) + PI / 12) * 1300)} ${f(cy + Math.sin(ang(0) + PI / 12) * 1300)}" stroke="#FFE08A" stroke-width="2" opacity=".5"/></g></g>`);
    // l'heure qui sonne : un anneau doré pulse sur le médaillon actif (suit l'aiguille) ; pas de grand cartouche (Théo)
    { const MP = Array.from({ length: 12 }, (_, k) => MED[k] || [cx + Math.cos(ang(k)) * (RL + 120), cy + Math.sin(ang(k)) * (RL + 120)]);
      const LG = NOM.map((n, k) => (RO[k] + " · " + n).length * 13.6 + 40), CW = Math.max(...LG), CH = 48, PASY = 64;
      const dCerc = (B, X, Y, R) => Math.hypot(X - Math.max(B[0], Math.min(B[2], X)), Y - Math.max(B[1], Math.min(B[3], Y))) < R;
      const CP = MP.map(([x, y], k) => { let best = [x, y + 40], bs = 1e9;
        for (let u = x - 240; u <= x + 240; u += 6) for (let v = y - 150; v <= y + 150; v += 6) { const B = [u - LG[k] / 2, v - CH / 2, u + LG[k] / 2, v + CH / 2];
          if (B[0] < 6 || B[2] > W - 6 || B[1] < 4 || B[3] > H - 6 || inter(B, [0, 0, 276, 132]) || dCerc(B, x, y, 27) || dCerc(B, cx, cy, RL + 12)) continue;
          let sc = Math.hypot(u - x, v - y) * .6;
          MED.forEach((m, j) => { if (m && j !== k && dCerc(B, m[0], m[1], 18)) sc += 400; });
          LAB.forEach((l, j) => { if (l && j !== k && inter(B, [l[0] - LW[j] - 2, l[1] - 11, l[0] + LW[j] + 2, l[1] + 5])) sc += 260; });
          if (FEU && inter(B, FEU)) sc += 300; if (ECL && inter(B, ECL)) sc += 300; if (inter(B, [760, 0, W, 128])) sc += 120;
          K.occ.forEach(o => { if (o[2] > 25 && o[2] < 80 && dCerc(B, o[0], o[1], o[2] * .75)) sc += 90; });
          if (sc < bs) { bs = sc; best = [u, v]; } }
        return best; });
      const saut = (L, fig) => K.anime ? `<animateTransform attributeName="transform" type="translate" values="${L.map(p => f(p[0]) + " " + f(p[1])).join(";")}" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite"/>` : "";
      const LP = Array.from({ length: 12 }, (_, k) => LAB[k] || [-999, -999]), HW = Math.max(...LW.filter(Boolean)) + 3;
      a.push(`<g opacity=".78">${LAB.map((l, k) => l ? `<rect x="${f(l[0] - LW[k])}" y="${f(l[1] - 9)}" width="${f(LW[k] * 2)}" height="12" rx="6" fill="#F6E9C4" opacity=".6"/><text x="${f(l[0])}" y="${f(l[1] + .5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="9" fill="#2A1A0A">${NOM[k]}</text>` : "").join("")}</g>`);
      a.push(`<g transform="translate(${f(MP[0][0])} ${f(MP[0][1])})">${saut(MP)}<circle r="16" fill="none" stroke="#FFE08A" stroke-width="3">${an(`<animate attributeName="r" values="15;24;15" dur="1.5s" repeatCount="indefinite"/>`)}</circle><circle r="16" fill="none" stroke="#FFF6D0" stroke-width="1.2" opacity=".9"/></g>`); }
    // ---- 10. le ciel de l'arène (coin haut gauche) : les visages des 4 pilotes projetés, la devise
    const PORTR = [];
    { const px = 10, py = 8, pw = 252, ph = 112; s.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="url(#hg-ciel)" stroke="#9AF4FF" stroke-width="1.5" opacity=".95"/>`);
      for (let k = 0; k < 24; k++) s.push(`<circle cx="${f(px + 6 + r() * (pw - 12))}" cy="${f(py + 6 + r() * (ph - 12))}" r="${f(.4 + r() * .8)}" fill="#FFF" opacity="${(.3 + r() * .6).toFixed(2)}"/>`);
      s.push(`<text x="${px + pw / 2}" y="${py + 16}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10.5" fill="#F7E3A0">Puisse le sort vous être favorable</text>`);
      const NOMS = ["Théo", "Kévin", "Clément", "Devlin"], CHEV = [`<path d="M-11 -8Q-10 -20 0 -20Q10 -20 11 -8Q6 -14 0 -13Q-6 -14 -11 -8Z" fill="#4A2E1A"/>`, `<path d="M-12 -7Q-12 -21 0 -21Q12 -21 12 -7L15 -6L12 -10Q2 -16 -12 -7Z" fill="#2A2A34"/><path d="M-12 -8h27" stroke="#1A1A22" stroke-width="2"/>`,
        `${[-9, -4, 1, 6, 10].map((u, q) => `<circle cx="${u}" cy="${-14 - (q % 2) * 3}" r="4.6" fill="#6A4022"/>`).join("")}`, `<path d="M-11 -6Q-12 -20 0 -20Q12 -20 11 -6Q8 -12 0 -12Q-8 -12 -11 -6Z" fill="#8A5A2A"/><path d="M-9 4Q0 14 9 4Q6 10 0 11Q-6 10 -9 4Z" fill="#8A5A2A"/>`];
      COULEURS_J.forEach((c, k) => { const x = px + 34 + k * 61, y = py + 58; PORTR.push({ k, x, y, r: 20 }); s.push(`${G(x, y, 1)}<circle r="24" fill="${c}" opacity=".25"/><circle r="21" fill="#0A1430" stroke="${c}" stroke-width="2"/></g>`);   // v16.31 : les vrais portraits sont posés par l'appli
        s.push(`<text x="${x}" y="${py + 98}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10" fill="${c}">${NOMS[k]}</text>`);
      });
      if (K.anime) a.push(`<g>${`<animateTransform attributeName="transform" type="translate" values="${PORTR.map(p => p.x + " " + p.y).join(";")}" calcMode="discrete" dur="8s" repeatCount="indefinite"/>`}<circle r="25" fill="none" stroke="#FFF2B8" stroke-width="2" opacity="0"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.2;.8;1" dur="2s" repeatCount="indefinite"/></circle></g>`);
    }
    // ---- 11. les parachutes argentés des sponsors (cadeaux aux rubans des 4)
    for (let k = 0; k < 3; k++) { let p = null; for (let e = 0; e < 3000 && !p; e++) { const x = 60 + r() * (W - 120), y = 170 + r() * (H - 250); if (dome(x, y) < .85 && [3, 4, 9, 10][k] === sect(x, y) && K.libre(x, y, 14, 4) && !LAB.some(l => l && Math.hypot(l[0] - x, l[1] - y + 20) < 60)) p = [x, y]; } if (!p) continue;
      const [x, y] = p, du = (11 + k * 2.3).toFixed(1), de = (-k * 3.1).toFixed(1);
      s.push(`<ellipse cx="${f(x)}" cy="${f(y + 4)}" rx="7" ry="2.4" fill="#000" opacity=".25"/>`);
      a.push(`<g${K.anime ? "" : ` transform="translate(0 -${30 + k * 14})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 -150;8 -80;-4 -20;0 0;0 0" keyTimes="0;.4;.65;.75;1" dur="${du}s" begin="${de}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;.75;.88;1" dur="${du}s" begin="${de}s" repeatCount="indefinite"/>`)}<path d="M${f(x - 13)} ${f(y - 20)}Q${f(x)} ${f(y - 38)} ${f(x + 13)} ${f(y - 20)}Q${f(x + 6)} ${f(y - 24)} ${f(x)} ${f(y - 20)}Q${f(x - 6)} ${f(y - 24)} ${f(x - 13)} ${f(y - 20)}Z" fill="url(#hg-arg)" stroke="#5A6476" stroke-width=".8"/><path d="M${f(x - 13)} ${f(y - 20)}L${f(x - 3)} ${f(y - 3)}M${f(x + 13)} ${f(y - 20)}L${f(x + 3)} ${f(y - 3)}M${f(x)} ${f(y - 20)}V${f(y - 3)}" stroke="#C8D0DA" stroke-width=".6"/><rect x="${f(x - 4.5)}" y="${f(y - 4)}" width="9" height="8" rx="1.2" fill="#D8DEE8" stroke="#5A6476" stroke-width=".8"/><path d="M${f(x)} ${f(y - 4)}v8M${f(x - 4.5)} ${f(y)}h9" stroke="${COULEURS_J[k]}" stroke-width="1.6"/></g>`); }
    // ---- 12. le geai moqueur : il fait le tour du lac en sifflant les 4 notes (une par pilote)
    { const R1 = RL + 46, R2 = RL + 30; a.push(`<g${K.anime ? "" : ` transform="translate(${f(cx + R1 * .7)} ${f(cy - R2 * .7)}) rotate(-40)"`}>${an(`<animateMotion dur="16s" repeatCount="indefinite" rotate="auto" path="M${f(cx + R1)} ${f(cy)}A${f(R1)} ${f(R2)} 0 1 0 ${f(cx - R1)} ${f(cy)}A${f(R1)} ${f(R2)} 0 1 0 ${f(cx + R1)} ${f(cy)}"/>`)}<g transform="scale(1.7)"><ellipse rx="8" ry="3.6" fill="#2A2E3A" ${INK}/><circle cx="7" cy="0" r="3.2" fill="#2A2E3A" ${INK}/><path d="M10 0l4 .6l-4 .8z" fill="#1A1410"/><path d="M-7 0l-8 -3l2 3l-2 3z" fill="#1A1E28" ${INK}/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 -1;1 1" dur=".5s" repeatCount="indefinite"/>`)}<path d="M-3 0Q-2 -14 4 -15Q4 -6 3 0z" fill="#2A2E3A" ${INK}/><path d="M-1 -6Q0 -12 3 -13" stroke="#FFFFFF" stroke-width="1.6" fill="none"/></g></g></g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 6;0 -6" dur="8s" repeatCount="indefinite"/>`)}${COULEURS_J.map((c, k) => `<g transform="translate(${f(cx - 40 + k * 22)} ${f(cy - RL - 22 - (k % 2) * 6)}) rotate(${k % 2 ? 8 : -8})" opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${(.08 + k * .08).toFixed(2)};${(.12 + k * .08).toFixed(2)};.6;.7;1" dur="8s" repeatCount="indefinite"/>`)}<path d="M3.6 -1V-15Q9 -12 9 -6" stroke="#FFFDF6" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse rx="5" ry="3.6" transform="rotate(-22)" fill="${c}" stroke="#FFFDF6" stroke-width="2.2"/><path d="M3.6 -1V-15Q9 -12 9 -6" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse rx="5" ry="3.6" transform="rotate(-22)" fill="${c}" stroke="#1A1410" stroke-width=".8"/></g>`).join("")}</g>`); }
    // la broche au geai (clin d'œil) près du départ
    { const p0 = K.P[0], [nx, ny] = K.nrm(0), x = p0[0] - nx * 34, y = p0[1] - ny * 34; s.push(`${G(x, y, 1)}<circle r="13" fill="url(#hg-or)" ${INK}/><circle r="10" fill="none" stroke="#8A5A14" stroke-width="1"/><path d="M-8 3Q-2 -2 4 -2L9 -6L7 -1Q4 4 -2 4Z" fill="#8A5A14"/><path d="M-4 -1Q0 -9 6 -9Q2 -4 2 -2Z" fill="#B07A1E"/><path d="M-10 6L10 -8" stroke="#6A440E" stroke-width="1.2"/></g>`); }
    // les 4 pilotes sur la piste (petits chars de parade aux couleurs des 4)
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.05 + k * .03, `<g><rect x="-6" y="-4" width="12" height="8" rx="3" fill="${c}" ${INK}/><path d="M-6 -4l-4 -2M-6 4l-4 2" stroke="#FFB12A" stroke-width="1.6"/><circle cx="2" cy="0" r="2.2" fill="#F4F1EA"/></g>`, 40, k * 1.2)));
    { const n0 = a.length; K.particules(26, "#FFE08A", 1.8, "scintille"); K.particules(20, "#BFF8FF", 1.6, "derive"); const gr = a.splice(0, 2), pts = a.splice(n0); s.unshift(...gr); pts.forEach(x => s.push(x.replace(/<animate[^>]*\/>/g, ""))); }
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#hg-sol)"/>`, "#2A1A3A", .12); RES.portraits = PORTR; return RES;
  }
  /* ---------- Août · Deux mondes (Hawkins 1985 à droite, le monde à l'envers à gauche) — v16.x ----------
     La carte est coupée en deux par une couture rouge qui passe par trois failles : deux sur la piste (on bascule
     d'un monde à l'autre) et la grande faille du labo au centre (le monument 3D). Le monde à l'envers est la même
     ville retournée (symétrie centrale : tout y est littéralement « tête en bas »). Les fractions de piste où l'on
     traverse les failles sont rendues dans RES.failles (utiles à l'événement « la course bascule »). */
  function peindreEnvers2(T, Z, def) {
    const K = kit(T, def, 85, "e2-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#140C10" stroke-width="1.2"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const [X, Y] = K.rep({ t: "faille" });
    // ---- la couture entre les deux mondes : ligne déchirée qui passe exactement par la grande faille (monument)
    const BY = []; for (let y = -20; y <= H + 20; y += 18) BY.push([540 + 14 * Math.sin(y / 70 + 1) + (r() - .5) * 12, y]);
    const bxBrut = y => { for (let k = 1; k < BY.length; k++) if (BY[k][1] >= y) { const [x0, y0] = BY[k - 1], [x1, y1] = BY[k]; return x0 + (x1 - x0) * (y - y0) / (y1 - y0); } return BY[BY.length - 1][0]; };
    const dX = X - bxBrut(Y); BY.forEach(p => { p[0] += dX * Math.max(0, 1 - Math.abs(p[1] - Y) / 260); });
    const bx = bxBrut, envers = (x, y) => x < bx(y), cou = BY.map(p => f(p[0]) + " " + f(p[1])).join("L");
    s.push(`<clipPath id="e2-ud"><path d="M-30 -20L${cou}L-30 ${H + 20}Z"/></clipPath><clipPath id="e2-nm"><path d="M${W + 30} -20L${cou}L${W + 30} ${H + 20}Z"/></clipPath>`);
    a.push(`<clipPath id="e2-udA"><path d="M-30 -20L${cou}L-30 ${H + 20}Z"/></clipPath>`);
    // les passages de la piste d'un monde à l'autre (fraction de tour)
    const FAILLES = []; for (let i = 0; i < K.N; i++) { const j = (i + 1) % K.N; if (envers(K.P[i][0], K.P[i][1]) !== envers(K.P[j][0], K.P[j][1])) FAILLES.push({ fr: +(j / K.N).toFixed(3), x: K.P[j][0], y: K.P[j][1], vers: envers(K.P[j][0], K.P[j][1]) ? "envers" : "normal" }); }
    // ---- dégradés
    s.push(`<linearGradient id="e2-herbe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F5A44"/><stop offset=".6" stop-color="#22443A"/><stop offset="1" stop-color="#16302E"/></linearGradient>`);
    s.push(`<radialGradient id="e2-cendre" cx="30%" cy="25%" r="85%"><stop offset="0" stop-color="#4A1424"/><stop offset=".45" stop-color="#2A1024"/><stop offset="1" stop-color="#0E0A1E"/></radialGradient>`);
    s.push(`<radialGradient id="e2-faille" r="50%"><stop offset="0" stop-color="#FFE0E4" stop-opacity="1"/><stop offset=".18" stop-color="#FF3B4E" stop-opacity=".85"/><stop offset=".55" stop-color="#C8102E" stop-opacity=".35"/><stop offset="1" stop-color="#8A0A1E" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="e2-orage" r="50%"><stop offset="0" stop-color="#FF2B3D" stop-opacity=".55"/><stop offset=".5" stop-color="#8A0A2A" stop-opacity=".25"/><stop offset="1" stop-color="#2A0A20" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="e2-bois" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A160E"/><stop offset=".5" stop-color="#6A2E1A"/><stop offset="1" stop-color="#2E120A"/></linearGradient>`);
    s.push(`<linearGradient id="e2-mur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4D3A6"/><stop offset="1" stop-color="#C9B184"/></linearGradient>`);
    s.push(`<linearGradient id="e2-murE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3A48"/><stop offset="1" stop-color="#2E1E28"/></linearGradient>`);
    s.push(`<linearGradient id="e2-peau" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A4A4C"/><stop offset=".45" stop-color="#9A8A84"/><stop offset="1" stop-color="#4A3A3E"/></linearGradient>`);
    s.push(`<linearGradient id="e2-mall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4E8F2"/><stop offset="1" stop-color="#C8B4D2"/></linearGradient>`);
    s.push(`<pattern id="e2-grill" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0L7 7M7 0L0 7" stroke="#B8C0CA" stroke-width=".7"/></pattern>`);
    s.push(`<radialGradient id="e2-phare" cx="0" cy="50%" r="100%"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".9"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<radialGradient id="e2-pA" cx="0" cy="50%" r="100%"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".85"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<radialGradient id="e2-fA" r="50%"><stop offset="0" stop-color="#FF8A96" stop-opacity=".9"/><stop offset=".4" stop-color="#FF2B3D" stop-opacity=".45"/><stop offset="1" stop-color="#C8102E" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<radialGradient id="e2-spA" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#E8D8DC" stop-opacity=".7"/><stop offset="1" stop-color="#E8D8DC" stop-opacity="0"/></radialGradient>`);

    // ---- les scènes : on réserve leur place d'abord (les arbres et réverbères les évitent)
    const SC = { mall: [705, 200, 1], maison: [812, 332, 1], labo: [646, 472, 1], jdr: [935, 640, 1], talkie: [868, 44, 1], gaufres: [962, 78, 1],
      horloge: [432, 236, 1], demo: [432, 560, 1], jumelle: [1080 - 812, 720 - 332, .78], talkieE: [1080 - 868, 720 - 44, 1], affiche: [586, 566, 1] };
    [["mall", 95], ["maison", 105], ["labo", 72], ["jdr", 95], ["talkie", 34], ["gaufres", 34], ["horloge", 60], ["demo", 70], ["jumelle", 84], ["talkieE", 34], ["affiche", 26]].forEach(([k, R]) => K.prendre(SC[k][0], SC[k][1], R));
    K.prendre(X, Y, 70); FAILLES.forEach(F => K.prendre(F.x, F.y, 46));

    // ---- 1. les sols : pelouses de Hawkins (à droite) / cendre rouge et bleu nuit (à gauche)
    s.push(`<g clip-path="url(#e2-nm)"><rect width="${W}" height="${H}" fill="url(#e2-herbe)"/>`);
    for (let k = 0; k < 70; k++) s.push(`<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(20 + r() * 50)}" ry="${f(8 + r() * 20)}" fill="${r() < .5 ? "#0E2420" : "#5A8A5A"}" opacity=".12"/>`);
    s.push(`</g><g clip-path="url(#e2-ud)"><rect width="${W}" height="${H}" fill="url(#e2-cendre)"/>`);
    for (let k = 0; k < 70; k++) s.push(`<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(20 + r() * 50)}" ry="${f(8 + r() * 20)}" fill="${r() < .5 ? "#06040E" : "#6A1A34"}" opacity=".18"/>`);
    s.push(`</g>`);
    // la ville et son reflet : allées, réverbères (le reflet = la même chose tournée de 180° autour du centre)
    const allees = [`M560 266Q700 252 790 268T985 250`, `M562 404Q610 392 700 404T792 430`, `M${W - 32} ${H + 10}V-10`, `M760 40Q820 20 900 22`];
    const ville = (ud) => allees.map((d, k) => `<path d="${d}" fill="none" stroke="${ud ? "#140A14" : k === 2 ? "#2E2E34" : "#B8AE8E"}" stroke-width="${k === 2 ? 26 : 10}" stroke-linecap="round" opacity="${ud ? .8 : k === 2 ? 1 : .5}"/>` + (k === 2 ? `<path d="${d}" fill="none" stroke="${ud ? "#5A1020" : "#D8C46A"}" stroke-width="1.2" stroke-dasharray="8 9" opacity=".7"/>` : "")).join("");
    s.push(`<g clip-path="url(#e2-nm)">${ville(false)}</g><g clip-path="url(#e2-ud)" transform="rotate(180 540 360)">${ville(true)}</g>`);
    // ---- 2. le ciel d'orage du monde à l'envers et l'ombre géante (araignée de fumée) au-dessus de la ville retournée
    s.push(`<g clip-path="url(#e2-ud)"><circle cx="150" cy="110" r="300" fill="url(#e2-orage)"/>`);
    for (let k = 0; k < 16; k++) { const x = r() * 420 - 40, y = r() * 200 - 30; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(50 + r() * 70)}" ry="${f(18 + r() * 22)}" fill="${r() < .5 ? "#1A0A1A" : "#3A0E22"}" opacity=".55" filter="url(#e2-flou8)"/>`); }
    // l'ombre : un corps de fumée et de longues pattes qui descendent sur toute la moitié gauche
    const pattes = [[-150, 330, -40], [-70, 430, -10], [30, 480, 20], [140, 440, 50], [250, 360, 70], [-170, 150, -70], [300, 190, 95]];
    const patte = ([u, v, c], ep, col) => `<path d="M0 0Q${f(u * .35 + c)} ${f(v * .25 - 50)} ${f(u * .6)} ${f(v * .45)}" fill="none" stroke="${col}" stroke-width="${ep}" stroke-linecap="round"/><path d="M${f(u * .6)} ${f(v * .45)}Q${f(u * .8 + c * .3)} ${f(v * .62)} ${f(u)} ${f(v)}" fill="none" stroke="${col}" stroke-width="${f(ep * .45)}" stroke-linecap="round"/>`;
    s.push(`${G(190, 78, 1)}<g opacity=".55" filter="url(#e2-flou)">${pattes.map(p => patte(p, 26, "#FF2B3D")).join("")}<ellipse cx="0" cy="-8" rx="92" ry="50" fill="#FF2B3D"/></g>
      <g opacity=".92">${pattes.map(p => patte(p, 18, "#0A0408")).join("")}<ellipse cx="0" cy="-8" rx="84" ry="44" fill="#0A0408"/><ellipse cx="-24" cy="-30" rx="48" ry="28" fill="#140812"/><ellipse cx="34" cy="-32" rx="42" ry="24" fill="#120610"/>${[0, 1, 2, 3, 4].map(q => `<path d="M${-60 + q * 30} -30q${f((r() - .5) * 30)} -34 ${f((r() - .5) * 40)} -64" stroke="#0A0408" stroke-width="10" fill="none" stroke-linecap="round"/>`).join("")}</g></g>`);
    s.push(`<text x="120" y="210" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9.5" fill="#FFD6DA" stroke="#140C10" stroke-width="2.6" paint-order="stroke">l'ombre géante</text>`);
    s.push(`</g>`);
    // ---- 3. veines rouges et lianes (le monde à l'envers gagne la ville)
    const veine = (x, y, t0, n, pas, c, l) => { let d = "M" + f(x) + " " + f(y); for (let j = 0; j < n; j++) { const t = t0 + (r() - .5) * 1.2; x += Math.cos(t) * pas; y += Math.sin(t) * pas; d += "L" + f(x) + " " + f(y); } return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(l)}" stroke-linecap="round" stroke-linejoin="round"/>`; };
    s.push(`<g clip-path="url(#e2-ud)" opacity=".9">`);
    for (let k = 0; k < 34; k++) s.push(veine(r() * 540, r() * H, r() * TAU, 8, 22, r() < .55 ? "#8A1024" : "#3A1C2C", 1 + r() * 3.5));
    for (let k = 0; k < 12; k++) s.push(veine(X + (r() - .5) * 20, Y + (r() - .5) * 60, PI + (r() - .5) * 2.4, 10, 20, "#B0142C", 1.5 + r() * 2.5));   // la faille irrigue le monde à l'envers
    s.push(`</g><g clip-path="url(#e2-nm)" opacity=".75">`);
    for (let k = 0; k < 9; k++) s.push(veine(X + 4, Y + (r() - .5) * 80, (r() - .5) * 1.6, 6, 18, "#8A1024", 1 + r() * 2));   // les premières veines passent la frontière
    s.push(`</g>`);
    const liane = (x, y, t0, n) => { let d = "M" + f(x) + " " + f(y), ep = []; for (let j = 0; j < n; j++) { const t = t0 + Math.sin(j * .9 + x) * .7, px = x, py = y; x += Math.cos(t) * 26; y += Math.sin(t) * 26; d += `Q${f(px + Math.cos(t + .8) * 16)} ${f(py + Math.sin(t + .8) * 16)} ${f(x)} ${f(y)}`; if (j % 2) ep.push(`<path d="M${f(x)} ${f(y)}l${f(Math.cos(t + 1.6) * 6)} ${f(Math.sin(t + 1.6) * 6)}" stroke="#2A1420" stroke-width="2"/>`); } return `<path d="${d}" fill="none" stroke="#1C0E16" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#4A2232" stroke-width="2.2" stroke-linecap="round"/>` + ep.join(""); };
    s.push(`<g clip-path="url(#e2-ud)">`); for (let k = 0; k < 7; k++) { const b = k % 4, x = b === 0 ? -10 : b === 1 ? r() * 520 : b === 2 ? r() * 520 : r() * 300, y = b === 0 ? r() * H : b === 1 ? -10 : b === 2 ? H + 10 : r() * H; s.push(liane(x, y, b === 0 ? 0 : b === 1 ? PI / 2 : b === 2 ? -PI / 2 : r() * TAU, 7 + Math.floor(r() * 6))); } s.push(`</g>`);
    // ---- 4. arbres (ronds et verts à Hawkins, morts et tordus de l'autre côté) et réverbères
    K.semis(46, () => 9 + r() * 7, 5000, (x, y) => x > bx(y) + 22 && Math.abs(x - (W - 32)) > 30, (x, y, R) => { s.push(`<ellipse cx="${f(x + 3)}" cy="${f(y + R * .9)}" rx="${f(R * .9)}" ry="${f(R * .3)}" fill="#000" opacity=".35"/><rect x="${f(x - 1.6)}" y="${f(y)}" width="3.2" height="${f(R * .9)}" fill="#3A2416"/>`); [[-.45, .05, .7], [.45, .05, .7], [0, -.4, .8]].forEach(([u, v, q]) => s.push(`<circle cx="${f(x + u * R)}" cy="${f(y + v * R)}" r="${f(R * q)}" fill="#2E5E3A" ${INK}/>`)); s.push(`<circle cx="${f(x - R * .25)}" cy="${f(y - R * .55)}" r="${f(R * .35)}" fill="#4E8A52"/>`); });
    K.semis(34, () => 9 + r() * 7, 5000, (x, y) => x < bx(y) - 22 && !(x < 420 && y < 230), (x, y, R) => { s.push(`<ellipse cx="${f(x + 3)}" cy="${f(y + R * .9)}" rx="${f(R * .8)}" ry="${f(R * .25)}" fill="#000" opacity=".4"/><path d="M${f(x)} ${f(y + R * .9)}L${f(x)} ${f(y - R * .2)}M${f(x)} ${f(y + R * .2)}L${f(x - R * .6)} ${f(y - R * .6)}L${f(x - R * .8)} ${f(y - R)}M${f(x)} ${f(y - R * .1)}L${f(x + R * .5)} ${f(y - R * .8)}M${f(x - R * .3)} ${f(y - R * .3)}L${f(x - R * .1)} ${f(y - R)}" stroke="#0E060C" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${f(x + R * .5)} ${f(y - R * .8)}l${f(R * .3)} ${f(-R * .1)}" stroke="#4A1A2A" stroke-width="1.4"/>`); });
    const lampes = []; K.semis(9, 8, 3000, (x, y) => x > bx(y) + 30 && y > 60 && x < W - 64 && K.dT(x, y) < 70, (x, y) => { lampes.push([x, y]); s.push(`<path d="M${f(x)} ${f(y + 10)}V${f(y - 12)}q0 -4 5 -4" stroke="#2A2A30" stroke-width="2" fill="none"/><ellipse cx="${f(x + 7)}" cy="${f(y - 15)}" rx="3.4" ry="1.8" fill="#FFE6A0"/>`); K.halo(x + 7, y - 6, 24, "#FFD58A", .55); });
    lampes.forEach(([x, y], k) => { const u = 1080 - x, v = 720 - y; if (!K.libre(u, v, 6, 8)) return; s.push(`<path d="M${f(u)} ${f(v - 10)}V${f(v + 12)}q0 4 -5 4" stroke="#1A0E16" stroke-width="2" fill="none"/><ellipse cx="${f(u - 7)}" cy="${f(v + 15)}" rx="3.4" ry="1.8" fill="#3A1020"/>`); if (k % 3 === 0) a.push(`<circle cx="${f(u - 7)}" cy="${f(v + 12)}" r="16" fill="url(#e2-fA)" opacity="0">${an(`<animate attributeName="opacity" values="0;.9;0;0;.7;0;0" keyTimes="0;.04;.08;.5;.53;.57;1" dur="${(5 + k).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); });

    // ---- 5. la piste : route d'été à Hawkins, route fendue de veines rouges dans le monde à l'envers
    K.route([["#000", 40, ` opacity=".55" filter="url(#e2-flou)"`]]);
    s.push(`<g clip-path="url(#e2-nm)"><path d="${K.piste}" fill="none" stroke="#B8B0A0" stroke-width="31" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#34343C" stroke-width="27" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#F4F1EA" stroke-width="23" stroke-linejoin="round" opacity=".55"/><path d="${K.piste}" fill="none" stroke="#34343C" stroke-width="21" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#E8C84A" stroke-width="1.4" stroke-dasharray="9 9"/></g>`);
    s.push(`<g clip-path="url(#e2-ud)"><path d="${K.piste}" fill="none" stroke="#120A12" stroke-width="31" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#2E1E28" stroke-width="27" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#6A1428" stroke-width="1.2" stroke-dasharray="9 9" opacity=".7"/>`);
    for (let k = 0; k < 90; k++) { const i = Math.floor(r() * K.N); if (!envers(K.P[i][0], K.P[i][1])) continue; const [nx, ny] = K.nrm(i), o = (r() - .5) * 22; s.push(`<path d="M${f(K.P[i][0] + nx * o)} ${f(K.P[i][1] + ny * o)}l${f((r() - .5) * 12)} ${f((r() - .5) * 12)}l${f((r() - .5) * 9)} ${f((r() - .5) * 9)}" stroke="${r() < .7 ? "#D0182E" : "#0A0408"}" stroke-width="1.3" opacity=".9"/>`); }
    for (let k = 0; k < 10; k++) { const i = Math.floor(r() * K.N); if (!envers(K.P[i][0], K.P[i][1])) continue; const [nx, ny, tx, ty] = K.nrm(i), sd = r() < .5 ? 1 : -1, x = K.P[i][0] + nx * sd * 18, y = K.P[i][1] + ny * sd * 18; s.push(`<path d="M${f(x)} ${f(y)}q${f(-nx * sd * 10 + tx * 8)} ${f(-ny * sd * 10 + ty * 8)} ${f(-nx * sd * 16 + tx * 20)} ${f(-ny * sd * 16 + ty * 20)}" stroke="#1C0E16" stroke-width="4" fill="none" stroke-linecap="round"/>`); }   // lianes qui mordent la route
    s.push(`</g>`);
    s.push(`<path d="M${cou}" fill="none" stroke="#FF3B4E" stroke-width="9" opacity=".22" filter="url(#e2-flou)"/><path d="M${cou}" fill="none" stroke="#FF6B7A" stroke-width="1.4" stroke-dasharray="14 6 3 6" opacity=".7"/>`);   // la couture entre les deux mondes
    K.depart();
    // ---- 6. les failles : déchirures rouges qui palpitent, en travers de la piste et au centre (le labo a ouvert la porte)
    const dechirure = (x, y, L, ang, l) => { const c = Math.cos(ang), sn = Math.sin(ang), n = 9, g = [], d2 = []; for (let k = 0; k <= n; k++) { const t = k / n - .5, w = l * Math.sin((k / n) * PI) * (.6 + r() * .6), px = x + c * t * L, py = y + sn * t * L, j = (r() - .5) * l * .5; g.push([px - sn * (w + j), py + c * (w + j)]); d2.unshift([px + sn * (w - j), py - c * (w - j)]); }
      const contour = "M" + g.concat(d2).map(p => f(p[0]) + " " + f(p[1])).join("L") + "Z", coeur = "M" + g.map((p, k) => f((p[0] + d2[n - k][0]) / 2) + " " + f((p[1] + d2[n - k][1]) / 2)).join("L");
      return { contour, coeur }; };
    const failleDessin = (x, y, L, ang, l, gros) => { const D = dechirure(x, y, L, ang, l); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(L * .95)}" fill="url(#e2-faille)" opacity=".75"/><path d="${D.contour}" fill="#6A0A1A" stroke="#2A0208" stroke-width="${gros ? 6 : 4}" stroke-linejoin="round"/><path d="${D.contour}" fill="#FF3B4E" transform="translate(${f(x)} ${f(y)}) scale(.72) translate(${f(-x)} ${f(-y)})"/><path d="${D.coeur}" fill="none" stroke="#FFE4E8" stroke-width="${gros ? 3.5 : 2.2}" stroke-linejoin="round"/>`);
      for (let k = 0; k < (gros ? 10 : 6); k++) { const t = r() * TAU; s.push(`<path d="M${f(x + Math.cos(t) * L * .25)} ${f(y + Math.sin(t) * L * .4)}q${f(Math.cos(t + 1) * 10)} ${f(Math.sin(t + 1) * 10)} ${f(Math.cos(t) * L * .35)} ${f(Math.sin(t) * L * .35)}" stroke="#8A0A1E" stroke-width="2" fill="none" stroke-linecap="round"/>`); }
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(L * .5)}" fill="url(#e2-fA)" opacity=".6">${an(`<animate attributeName="r" values="${f(L * .42)};${f(L * .7)};${f(L * .42)}" dur="${gros ? 2.6 : 1.9}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".45;.95;.45" dur="${gros ? 2.6 : 1.9}s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<path d="${D.coeur}" fill="none" stroke="#FFFFFF" stroke-width="${gros ? 2.4 : 1.6}" stroke-linejoin="round" opacity=".9">${an(`<animate attributeName="opacity" values=".9;.2;1;.4;.9" keyTimes="0;.2;.45;.7;1" dur="1.3s" repeatCount="indefinite"/>`)}</path>`); };
    failleDessin(X, Y, 150, PI / 2 + .08, 20, true);
    FAILLES.forEach((F, k) => { const i = Math.round(F.fr * K.N) % K.N, [nx, ny] = K.nrm(i); failleDessin(F.x, F.y, 92, Math.atan2(ny, nx), 11, false);
      s.push(`<path d="M${f(F.x - nx * 18)} ${f(F.y - ny * 18)}L${f(F.x + nx * 18)} ${f(F.y + ny * 18)}" stroke="#FFD0D6" stroke-width="3" opacity=".8"/>`); });
    // ---- 7. Hawkins 1985 : le centre commercial aux néons
    { const [x, y] = SC.mall; s.push(`${G(x, y, 1)}<rect x="-104" y="14" width="208" height="38" rx="4" fill="#2A2A30" opacity=".9"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(q => `<path d="M${-96 + q * 26} 18v30" stroke="#E8E2C8" stroke-width="1" opacity=".5"/>`).join("")}
      ${[[-80, 32, "#C8283A"], [-30, 26, "#4C9AFF"], [24, 36, "#F2E6CC"], [70, 28, "#2BB673"]].map(([u, v, c]) => `<rect x="${u - 9}" y="${v - 5}" width="18" height="10" rx="4" fill="${c}" ${INK}/><rect x="${u - 5}" y="${v - 4}" width="10" height="4" rx="1" fill="#BFE0FF" opacity=".7"/>`).join("")}
      <rect x="-96" y="-44" width="192" height="58" rx="3" fill="url(#e2-mall)" ${INK}/><rect x="-96" y="-44" width="192" height="8" fill="#5A3A7A"/>${[0, 1, 2, 3, 4, 5].map(q => `<rect x="${-88 + q * 30 + (q > 2 ? 12 : 0)}" y="-28" width="20" height="30" rx="2" fill="${["#FF6FA8", "#22D3EE", "#F7D84A", "#22D3EE", "#FF6FA8", "#B48CFF"][q]}" opacity=".85" ${INK}/>`).join("")}
      <path d="M-18 14V-14Q0 -30 18 -14V14Z" fill="#1A2A4A" ${INK}/><path d="M0 -24V14M-18 -4H18" stroke="#9ADFFF" stroke-width="1"/><rect x="-74" y="-66" width="148" height="22" rx="4" fill="#1A1028" stroke="#FF6FA8" stroke-width="1.5"/>
      <path d="M-66 -55l3 -7l3 7l-7 -4h8z" fill="#F7D84A"/></g>`);
      K.halo(x, y - 55, 90, "#FF4FD8", .35); K.halo(x, y - 10, 70, "#22D3EE", .2);
      a.push(`${G(x, y, 1)}<text x="6" y="-50" text-anchor="middle" font-family="'Brush Script MT', 'Segoe Script', cursive" font-style="italic" font-weight="700" font-size="17" fill="#FFD6F0" stroke="#FF2BA8" stroke-width=".8">Starcourt${an(`<animate attributeName="opacity" values="1;1;.25;1;.4;1;1" keyTimes="0;.6;.63;.66;.69;.72;1" dur="5s" repeatCount="indefinite"/>`)}</text>
        <path d="M-92 -2h184" stroke="#22D3EE" stroke-width="2" opacity=".9">${an(`<animate attributeName="stroke-dasharray" values="0 200;184 0;0 200" dur="4s" repeatCount="indefinite"/>`)}</path></g>`); }
    // ---- 8. la maison aux guirlandes : le mur de l'alphabet, les ampoules qui épellent C-O-U-R-S
    const RANGS = ["ABCDEFGH", "IJKLMNOPQ", "RSTUVWXYZ"], AMP = ["#FF3B3B", "#2BD46A", "#4C9AFF", "#F7D84A", "#FF8A3D", "#FF6FA8"];
    const posL = (rg, k) => { const n = RANGS[rg].length, pas = 196 / n; return [-98 + pas * (k + .5), -22 + rg * 27]; };
    const mur = (ud) => { let h = `<rect x="-112" y="-56" width="224" height="104" rx="2" fill="url(#${ud ? "e2-murE" : "e2-mur"})" ${INK}/>`;
      for (let q = 0; q < 15; q++) h += `<path d="M${-104 + q * 15} -52v96" stroke="${ud ? "#1A0E16" : "#B89A6A"}" stroke-width="3" opacity=".35"/>`;
      h += `<rect x="-112" y="40" width="224" height="8" fill="${ud ? "#140A10" : "#6A4A2A"}"/><rect x="-112" y="-56" width="224" height="5" fill="${ud ? "#140A10" : "#8A6A44"}"/>`;
      RANGS.forEach((rg, i) => { let fil = ""; [...rg].forEach((L, k) => { const [u, v] = posL(i, k); fil += (k ? "Q" + f(u - 98 / rg.length) + " " + f(v - 9) + " " : "M" + f(u - 12) + " " + f(v - 14) + "Q" + f(u - 6) + " " + f(v - 9) + " ") + f(u) + " " + f(v - 12);
        h += `<text x="${f(u)}" y="${f(v + 9)}" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-weight="900" font-size="15" fill="${ud ? "#0A0408" : "#1A1410"}" transform="rotate(${f((r() - .5) * 12)} ${f(u)} ${f(v)})">${L}</text>`; });
        h += `<path d="${fil}" fill="none" stroke="${ud ? "#0A0408" : "#2A3A22"}" stroke-width="1.1"/>`;
        [...rg].forEach((L, k) => { const [u, v] = posL(i, k), c = AMP[(i * 3 + k) % 6]; h += `<ellipse cx="${f(u)}" cy="${f(v - 9)}" rx="2.6" ry="3.4" fill="${ud ? "#2A1A1E" : c}" stroke="#140C10" stroke-width=".6"/>`; }); });
      return h; };
    { const [x, y] = SC.maison; s.push(`${G(x, y, 1)}<ellipse cx="4" cy="54" rx="120" ry="10" fill="#000" opacity=".35"/>${mur(false)}<rect x="122" y="10" width="4" height="40" fill="#3A2A1A"/><path d="M114 10h20l-4 -13h-12z" fill="#F2E6CC" ${INK}/></g>`);
      RANGS.forEach((rg, i) => [...rg].forEach((L, k) => { const [u, v] = posL(i, k); K.halo(x + u, y + v - 9, 7, AMP[(i * 3 + k) % 6], .55); }));
      K.halo(x + 124, y + 4, 34, "#FFD58A", .6);
      // l'ensemble des ampoules clignote doucement ; puis C, O, U, R, S s'allument l'une après l'autre
      a.push(`${G(x, y, 1)}<g opacity="0">${an(`<animate attributeName="opacity" values="0;.8;0;0;.6;0;0" keyTimes="0;.05;.1;.4;.45;.5;1" dur="3.4s" repeatCount="indefinite"/>`)}${RANGS.map((rg, i) => [...rg].map((L, k) => { const [u, v] = posL(i, k); return (i + k) % 2 ? `<circle cx="${f(u)}" cy="${f(v - 9)}" r="4" fill="#FFFFFF" opacity=".8"/>` : ""; }).join("")).join("")}</g>`);
      [..."COURS"].forEach((L, q) => { const i = RANGS.findIndex(rg => rg.includes(L)), k = RANGS[i].indexOf(L), [u, v] = posL(i, k), c = AMP[(i * 3 + k) % 6], t0 = .08 + q * .1;
        a.push(`<g opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${f2(t0)};${f2(t0 + .02)};${f2(t0 + .08)};${f2(t0 + .1)};1" dur="7s" repeatCount="indefinite"/>`)}<circle cx="${f(u)}" cy="${f(v - 9)}" r="11" fill="${c}" opacity=".55"/><circle cx="${f(u)}" cy="${f(v - 9)}" r="4.2" fill="#FFFFFF"/><rect x="${f(u - 9)}" y="${f(v - 3)}" width="18" height="16" rx="3" fill="${c}" opacity=".25"/></g>`); });
      a.push(`</g>`); }
    function f2(v) { return (+v).toFixed(2); }
    // ---- 9. le labo grillagé (d'où tout est parti) : grillage, barbelés, projecteur
    { const [x, y] = SC.labo; s.push(`${G(x, y, 1)}<ellipse cx="0" cy="40" rx="80" ry="10" fill="#000" opacity=".35"/><rect x="-62" y="-44" width="124" height="86" fill="url(#e2-grill)" stroke="#8A929C" stroke-width="1.4"/>${[-62, -31, 0, 31, 62].map(u => `<path d="M${u} -50V42" stroke="#5A626C" stroke-width="2"/>`).join("")}<path d="M-62 -48${[...Array(31)].map((_, q) => `L${-62 + q * 4} ${q % 2 ? -52 : -46}`).join("")}" fill="none" stroke="#C8D0DA" stroke-width=".8"/>
      <rect x="-42" y="-30" width="84" height="52" fill="#8A94A0" ${INK}/><rect x="-42" y="-34" width="84" height="8" fill="#5A626C" ${INK}/>${[0, 1, 2, 3, 4, 5].map(q => `<rect x="${-36 + q * 13}" y="-20" width="8" height="10" fill="${q === 2 ? "#FFE6A0" : "#2A3A4A"}"/>`).join("")}<rect x="-10" y="4" width="20" height="18" fill="#3A3A40" ${INK}/>
      <rect x="-46" y="31" width="62" height="12" fill="#F2E6CC" stroke="#C8102E" stroke-width="1.4"/><text x="-15" y="39.5" text-anchor="middle" font-family="Helvetica, Arial" font-weight="800" font-size="6.4" fill="#C8102E">ACCÈS INTERDIT</text>
      <path d="M48 42V-14h10V42" fill="#4A525C" ${INK}/><rect x="44" y="-22" width="18" height="10" fill="#3A4048" ${INK}/></g>`);
      s.push(`<text x="${x}" y="${y - 50}" text-anchor="middle" font-family="Helvetica, Arial" font-weight="800" font-size="8" letter-spacing="1" fill="#E8ECF2" stroke="#140C10" stroke-width="2.2" paint-order="stroke">LABO NATIONAL · HAWKINS</text>`);
      a.push(`<path d="M${f(x + 53)} ${f(y - 17)}l-150 -46l6 -26z" fill="#FFF6D0" opacity=".14">${an(`<animateTransform attributeName="transform" type="rotate" values="-25 ${f(x + 53)} ${f(y - 17)};30 ${f(x + 53)} ${f(y - 17)};-25 ${f(x + 53)} ${f(y - 17)}" dur="8s" repeatCount="indefinite"/>`)}</path>`); }
    // ---- 10. la table de jeu de rôle au sous-sol (les 4 pilotes ; l'appli y pose leurs vrais portraits)
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    { const [x, y] = SC.jdr; K.halo(x, y, 120, "#FFD58A", .45); s.push(`${G(x, y, 1)}<rect x="-66" y="-34" width="132" height="68" rx="8" fill="#000" opacity=".4" transform="translate(4 6)"/><rect x="-66" y="-34" width="132" height="68" rx="8" fill="#8A5A32" ${INK}/>${[-22, 0, 22].map(v => `<path d="M-62 ${v}h124" stroke="#6A4224" stroke-width="1"/>`).join("")}
      <rect x="-40" y="-22" width="62" height="40" rx="2" fill="#E8DCB8" ${INK} transform="rotate(-4)"/><path d="M-34 -12q10 -6 20 2t22 0M-30 4q14 8 30 0" stroke="#7A6A4A" stroke-width="1" fill="none" transform="rotate(-4)"/><path d="M-6 -6l4 -4l4 4l-4 4z" fill="#C8102E" transform="rotate(-4)"/>
      <path d="M30 -26l26 -4l2 26l-26 4z" fill="#3A2A6A" ${INK}/><text x="44" y="-10" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="7" fill="#F7D84A" transform="rotate(-8 44 -12)">MJ</text>
      <polygon points="36,8 45,3 54,8 54,18 45,23 36,18" fill="#C8283A" ${INK}/><path d="M36 8L45 13L54 8M45 13V23M36 18L45 13L54 18" stroke="#FFFFFF" stroke-width=".7" fill="none"/><text x="45" y="16.5" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="5.5" fill="#FFFFFF">20</text>
      ${COULEURS_J.map((c, k) => `<g transform="translate(${-30 + k * 13} 24)"><circle r="3.4" fill="${c}" ${INK}/><circle cy="-3" r="1.8" fill="${c}" ${INK}/></g>`).join("")}<rect x="-58" y="-28" width="10" height="13" rx="2" fill="#C8102E" ${INK}/><rect x="-58" y="12" width="10" height="13" rx="2" fill="#2E6AE0" ${INK}/><ellipse cx="18" cy="-26" rx="8" ry="4" fill="#E8B04A" ${INK}/></g>`);
      [[-44, -56], [44, -56], [-44, 56], [44, 56]].forEach(([u, v], k) => { const px = x + u, py = y + v, c = COULEURS_J[k]; PORTR.push({ k, x: px, y: py, r: 16 }); s.push(`<circle cx="${f(px)}" cy="${f(py)}" r="21" fill="${c}" opacity=".3"/><circle cx="${f(px)}" cy="${f(py)}" r="17.5" fill="#1A1028" stroke="${c}" stroke-width="2.2"/><text x="${f(px + (u < 0 ? -22 : 22))}" y="${f(py + 4)}" text-anchor="${u < 0 ? "end" : "start"}" font-family="Georgia, serif" font-weight="bold" font-size="10" fill="${c}" stroke="#140C10" stroke-width="2.4" paint-order="stroke">${NOMS[k]}</text>`); });
      bulleFixe(x - 6, y - 84, "Les amis ne mentent pas"); }
    function bulleFixe(x, y, txt) { s.push(`<rect x="${f(x - txt.length * 2.9 - 7)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 14)}" height="18" rx="9" fill="#FFFDF6" stroke="#140C10" stroke-width="1"/><path d="M${f(x + 6)} ${f(y + 7)}l3 8l5 -8" fill="#FFFDF6" stroke="#140C10" stroke-width="1"/><path d="M${f(x + 6.5)} ${f(y + 6.6)}h7" stroke="#FFFDF6" stroke-width="1.6"/><text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10.5" fill="#140C10">${txt}</text>`); }
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.1;.16;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.9 - 6)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 12)}" height="17" rx="8" fill="#FFFDF6" stroke="#140C10" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#140C10">${txt}</text></g>`);
    // ---- 11. le talkie-walkie et les gaufres (et leurs reflets de l'autre côté)
    const talkie = (ud) => `<ellipse cx="2" cy="22" rx="14" ry="4" fill="#000" opacity=".35"/><path d="M6 -22V-46" stroke="#140C10" stroke-width="2.4" stroke-linecap="round"/><circle cx="6" cy="-47" r="2.2" fill="#140C10"/><rect x="-11" y="-24" width="24" height="46" rx="5" fill="${ud ? "#3A2630" : "#2A2C34"}" stroke="${ud ? "#FF3B4E" : "#140C10"}" stroke-width="1.2"/>${[0, 1, 2, 3, 4].map(q => `<path d="M-6 ${-16 + q * 4}h14" stroke="${ud ? "#3A1A22" : "#6A6E7A"}" stroke-width="1.6"/>`).join("")}<rect x="-6" y="6" width="14" height="9" rx="1.5" fill="${ud ? "#FF3B4E" : "#9ADF6A"}" ${INK}/><rect x="-14" y="-8" width="4" height="12" rx="1" fill="#C8102E"/>`;
    { const [x, y] = SC.talkie; s.push(`${G(x, y, 1, -14)}${talkie(false)}</g>`); bulle(x - 46, y - 12, "À vous !", 6); }
    { const [x, y] = SC.talkieE; s.push(`${G(x, y, 1, 166)}${talkie(true)}</g>`); a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="22" fill="url(#e2-fA)" opacity="0">${an(`<animate attributeName="opacity" values="0;0;.9;.3;.9;0" keyTimes="0;.5;.56;.62;.68;1" dur="6s" repeatCount="indefinite"/>`)}</circle>`); bulle(x + 66, y - 4, "Tu m'entends ?", 6, 3); }
    { const [x, y] = SC.gaufres; s.push(`${G(x, y, 1)}<ellipse cx="2" cy="10" rx="30" ry="10" fill="#000" opacity=".3"/><ellipse cx="0" cy="6" rx="28" ry="10" fill="#F4F1EA" ${INK}/><ellipse cx="0" cy="5" rx="20" ry="6.5" fill="#E2DCCF"/>${[0, 1, 2].map(q => `<g transform="translate(${q * 2 - 2} ${-q * 6})"><ellipse rx="17" ry="6.5" fill="#D89A3A" ${INK}/>${[-9, -3, 3, 9].map(u => `<path d="M${u} -5.5v11" stroke="#A8661E" stroke-width="1"/>`).join("")}<path d="M-15 -2h30M-15 2h30" stroke="#A8661E" stroke-width="1"/></g>`).join("")}<rect x="-3" y="-18" width="8" height="5" rx="1" fill="#FFF0A0" ${INK}/><path d="M8 -12q4 6 2 12q-2 4 -3 8" stroke="#8A4A12" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/></g>`);
      a.push(`<path d="M${f(x - 4)} ${f(y - 22)}q-4 -8 0 -14q4 -6 0 -12" stroke="#FFFFFF" stroke-width="1.6" fill="none" opacity="0">${an(`<animate attributeName="opacity" values="0;.55;0" dur="3s" repeatCount="indefinite"/>`)}</path>`); }
    // ---- 12. les vélos à phares : la bande de Hawkins file sur la route du bord (et un vélo abandonné de l'autre côté)
    const velo = (c) => `<path d="M-9 0h18" stroke="#1A1A1E" stroke-width="2"/><circle cx="-9" cy="0" r="3.4" fill="none" stroke="#1A1A1E" stroke-width="1.6"/><circle cx="9" cy="0" r="3.4" fill="none" stroke="#1A1A1E" stroke-width="1.6"/><path d="M7 -4v8" stroke="#C8C8D0" stroke-width="1.6"/><ellipse cx="-1" cy="0" rx="5" ry="4.2" fill="${c}" ${INK}/><circle cx="2" cy="0" r="2.6" fill="#E8C4A4" ${INK}/><circle cx="12" cy="0" r="1.6" fill="#FFF6C8"/>`;
    const route = `M${W - 32} ${H + 30}V-30`;
    COULEURS_J.forEach((c, k) => { const corps = `<path d="M12 0L80 -16L80 16Z" fill="url(#e2-pA)"/>${velo(c)}`;
      a.push(K.anime ? `<g>${`<animateMotion dur="11s" begin="-${(k * 1.1).toFixed(1)}s" repeatCount="indefinite" rotate="auto" path="${route}"/>`}<g transform="translate(0 ${k % 2 ? 6 : -6})">${corps}</g></g>` : `<g transform="translate(${W - 32 + (k % 2 ? 6 : -6)} ${H - 180 - k * 30}) rotate(-90)">${corps}</g>`); });
    { const x = 32, y = 260; s.push(`${G(x, y, 1.1, 74)}<path d="M12 0L70 -16L70 16Z" fill="url(#e2-phare)" opacity=".5"/>${velo("#4C9AFF")}</g>`); }
    // ---- 13. le monde à l'envers : la maison jumelle retournée (le mur de l'alphabet tête en bas, éteint)
    { const [x, y, sc] = SC.jumelle; s.push(`${G(x, y, sc, 180)}${mur(true)}</g>`); s.push(`<g clip-path="url(#e2-ud)">${liane(x - 90, y - 50, .3, 7)}${liane(x + 80, y + 40, PI + .4, 6)}</g>`);
      a.push(`${G(x, y, sc, 180)}${[["R", 2, 0], ["S", 2, 1]].map(([L, i, k], q) => { const [u, v] = posL(i, k); return `<circle cx="${f(u)}" cy="${f(v - 9)}" r="5" fill="#FF2B3D" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0;1;0" keyTimes="0;.06;.12;.6;.66;1" dur="${(4.2 + q).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`; }).join("")}</g>`); }
    // ---- 14. l'horloge du grand-père (son balancier, son tic-tac lugubre) envahie de lianes
    { const [x, y] = SC.horloge; K.halo(x, y - 60, 90, "#FF2B3D", .45); s.push(`${G(x, y + 50, 1)}<ellipse cx="4" cy="2" rx="34" ry="7" fill="#000" opacity=".5"/><rect x="-24" y="-30" width="48" height="30" rx="2" fill="url(#e2-bois)" ${INK}/><rect x="-17" y="-104" width="34" height="76" fill="url(#e2-bois)" ${INK}/><rect x="-10" y="-96" width="20" height="58" rx="9" fill="#1A0A0A" stroke="#C9A24A" stroke-width="1.2"/>
      <path d="M-26 -104h52l-4 -44q-22 -20 -44 0z" fill="url(#e2-bois)" ${INK}/><circle cx="0" cy="-130" r="16" fill="#E8DCC0" stroke="#C9A24A" stroke-width="2"/>${[...Array(12)].map((_, q) => { const t = q / 12 * TAU; return `<path d="M${f(Math.sin(t) * 12)} ${f(-130 - Math.cos(t) * 12)}L${f(Math.sin(t) * 14.5)} ${f(-130 - Math.cos(t) * 14.5)}" stroke="#2A1A14" stroke-width="${q % 3 ? 1 : 2}"/>`; }).join("")}<path d="M0 -130L-4 -140M0 -130L7 -128" stroke="#140C10" stroke-width="1.8" stroke-linecap="round"/><circle cx="0" cy="-130" r="1.6" fill="#140C10"/><path d="M-8 -150l8 -8l8 8" fill="none" stroke="#C9A24A" stroke-width="2"/>
      ${liane(-30, 0, -1.2, 6)}${liane(28, -40, -2, 5)}</g>`);
      a.push(`${G(x, y + 50, 1)}<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-16 0 -94;16 0 -94;-16 0 -94" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="2.4s" repeatCount="indefinite"/>`)}<path d="M0 -94V-52" stroke="#C9A24A" stroke-width="1.6"/><circle cx="0" cy="-48" r="6" fill="#E2B93B" ${INK}/></g><circle cx="0" cy="-130" r="20" fill="url(#e2-fA)" opacity="0">${an(`<animate attributeName="opacity" values="0;0;.9;0" keyTimes="0;.8;.86;1" dur="4.8s" repeatCount="indefinite"/>`)}</circle></g>`);
      s.push(`<text x="${x + 2}" y="${y + 70}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9.5" fill="#FFD6DA" stroke="#140C10" stroke-width="2.6" paint-order="stroke">l'horloge du grand-père</text>`); }
    // ---- 15. le Démogorgon : longue silhouette, la tête ouverte en pétales
    { const [x, y] = SC.demo; s.push(`${G(x, y + 56, 1)}<ellipse cx="4" cy="2" rx="40" ry="7" fill="#000" opacity=".5"/>
      <path d="M-8 -62Q-14 -36 -20 -18Q-24 -6 -28 0h10Q-10 -20 -2 -48ZM8 -62Q14 -36 18 -18Q22 -6 26 0h-10Q8 -20 2 -48Z" fill="url(#e2-peau)" ${INK}/>
      <path d="M-15 -112Q-22 -86 -12 -60Q0 -54 12 -60Q22 -86 15 -112Q0 -118 -15 -112Z" fill="url(#e2-peau)" ${INK}/><path d="M-8 -104q8 4 16 0M-9 -94q9 4 18 0M-9 -84q9 4 18 0" stroke="#3A2A2E" stroke-width="1" fill="none"/>
      <path d="M-14 -110Q-34 -90 -36 -60Q-38 -40 -34 -24" fill="none" stroke="#5A4A4C" stroke-width="7" stroke-linecap="round"/><path d="M14 -110Q34 -92 38 -64Q40 -44 36 -28" fill="none" stroke="#5A4A4C" stroke-width="7" stroke-linecap="round"/>
      <path d="M-34 -24l-6 10M-34 -24l-1 12M-34 -24l4 10M36 -28l6 10M36 -28l1 12M36 -28l-4 10" stroke="#2A1C20" stroke-width="2" stroke-linecap="round"/><path d="M0 -114V-122" stroke="#5A4A4C" stroke-width="7"/></g>`);
      const petales = [...Array(5)].map((_, q) => { const t = -90 + (q - 2) * 50; return `<g transform="rotate(${t})"><path d="M2 -3Q18 -14 30 0Q18 14 2 3Z" fill="#8A7A74" ${INK}/><path d="M5 -2Q17 -9 25 0Q17 9 5 2Z" fill="#C8283A"/>${[8, 13, 18, 22].map(u => `<path d="M${u} -${f(5 - u * .12)}l1.5 2.4l1.5 -2.4M${u} ${f(5 - u * .12)}l1.5 -2.4l1.5 2.4" fill="#F4EAD8"/>`).join("")}</g>`; }).join("");
      a.push(`${G(x, y + 56 - 126, 1)}<g>${an(`<animateTransform attributeName="transform" type="scale" values=".55;1.12;1.12;.55;.55" keyTimes="0;.18;.6;.75;1" dur="5s" repeatCount="indefinite"/>`)}${petales}<circle r="6" fill="#2A0508"/></g></g>`);
      s.push(`<text x="${x}" y="${y + 74}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9.5" fill="#FFD6DA" stroke="#140C10" stroke-width="2.6" paint-order="stroke">le Démogorgon</text>`); }
    // ---- l'affiche « DISPARU » sur un poteau téléphonique (silhouette dessinée, pas de visage)
    { const [x, y] = SC.affiche; s.push(`${G(x, y, 1)}<ellipse cx="3" cy="30" rx="12" ry="3" fill="#000" opacity=".4"/><rect x="-2" y="-40" width="4" height="70" fill="#5A3A22" ${INK}/><path d="M-12 -36h24" stroke="#5A3A22" stroke-width="3"/><rect x="-17" y="-24" width="34" height="36" fill="#F4F1EA" ${INK} transform="rotate(-4)"/><text x="0" y="-15.5" text-anchor="middle" font-family="Helvetica, Arial" font-weight="900" font-size="6" fill="#140C10" transform="rotate(-4)">DISPARU</text><g transform="rotate(-4)"><rect x="-8" y="-11" width="16" height="16" fill="#C8C2B4"/><circle cx="0" cy="-5" r="4" fill="#6A6458"/><path d="M-7 5q7 -9 14 0z" fill="#6A6458"/><path d="M-9 8h18M-9 10.5h12" stroke="#6A6458" stroke-width=".8"/></g></g>`); }
    // ---- 16. étiquettes et titres : Hawkins à l'endroit, le monde à l'envers… à l'envers
    s.push(`<text x="700" y="30" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="15" letter-spacing="2" fill="none" stroke="#E5484D" stroke-width="1.1">HAWKINS · 1985</text>`);
    s.push(`<g transform="rotate(180 360 692)"><text x="360" y="700" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="21" letter-spacing="2" fill="#1A0408" stroke="#FF3B4E" stroke-width="1.2">LE MONDE À L'ENVERS</text><path d="M246 680h228M246 704h228" stroke="#FF3B4E" stroke-width="1.2"/></g>`);
    [["le centre commercial", SC.mall[0], SC.mall[1] + 64], ["la maison aux guirlandes", SC.maison[0], SC.maison[1] + 66] ].forEach(([t, x, y]) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9.5" fill="#FFF6D8" stroke="#140C10" stroke-width="2.6" paint-order="stroke">${t}</text>`));
    // ---- 17. animations : éclairs dans le ciel d'orage, spores qui flottent, les 4 pilotes
    a.push(`<g clip-path="url(#e2-udA)"><rect width="560" height="${H}" fill="#FF2B3D" opacity="0">${an(`<animate attributeName="opacity" values="0;0;.22;0;.14;0;0" keyTimes="0;.7;.72;.75;.78;.82;1" dur="9s" repeatCount="indefinite"/>`)}</rect>
      <path d="M300 -5l-18 46l14 4l-22 52l10 3l-26 50" fill="none" stroke="#FFD0D6" stroke-width="2.4" opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;0;.8;0;0" keyTimes="0;.7;.72;.75;.78;.82;1" dur="9s" repeatCount="indefinite"/>`)}</path>
      <path d="M60 -5l12 40l-12 6l16 44" fill="none" stroke="#FFD0D6" stroke-width="1.8" opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.3;.32;.36;1" dur="6.5s" repeatCount="indefinite"/>`)}</path></g>`);
    for (let g = 0; g < 6; g++) { let h = ""; for (let k = 0; k < 14; k++) { let x, y, e = 0; do { x = r() * 560; y = r() * H; e++; } while (!envers(x, y) && e < 20); h += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r() * 1.8)}" fill="url(#e2-spA)" opacity="${(.5 + r() * .5).toFixed(2)}"/>`; }
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 30)} -34;${f((r() - .5) * 20)} -62;0 0" keyTimes="0;.45;.9;1" dur="${(10 + g * 1.7).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.85;.95;1" dur="${(10 + g * 1.7).toFixed(1)}s" repeatCount="indefinite"/>`)}${h}</g>`); }
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.02 + k * .03, `<g><rect x="-7" y="-4" width="14" height="8" rx="3" fill="${c}" ${INK}/><rect x="1" y="-3" width="4" height="6" rx="1" fill="#BFE0FF"/><circle cx="8" cy="0" r="1.4" fill="#FFF6C8"/></g>`, 44, k * 1.3)));
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#1A2420"/>`, "#1A0A28", .12); RES.portraits = PORTR; RES.failles = FAILLES.map(F => ({ fr: F.fr, vers: F.vers })); return RES;
  }
  /* ---------- Avril · Le Voyage (Terre du Milieu façon carte ancienne : de la Comté à la Montagne du Destin) ---------- */
  function peindreAnneau3(T, Z, def) {
    const K = kit(T, def, 41, "an-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#2A1A0E" stroke-width="1.2"`, PEAU = "#F2CDB0", OR = "#E2B93B";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.9 - 6)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 12)}" height="17" rx="8" fill="#FFFDF6" stroke="#2A1A0E" stroke-width="1"/><path d="M${f(x - 4)} ${f(y + 6)}l2 7l6 -7" fill="#FFFDF6" stroke="#2A1A0E" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#2A1A0E">${txt}</text></g>`);
    // titres de carte : capitales espacées à l'encre, contour parchemin
    const titre = (x, y, txt, taille, coul, rot, cont) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="${taille}" letter-spacing="${f(taille * .28)}" fill="${coul || "#5A2A14"}" stroke="${cont || "#F1E2BC"}" stroke-width="${f(taille * .28)}" paint-order="stroke" stroke-linejoin="round"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ""}>${txt}</text>`);
    const legende = (x, y, txt, coul, taille) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${taille || 10}" fill="${coul || "#3A2414"}" stroke="#F1E2BC" stroke-width="2.6" paint-order="stroke">${txt}</text>`);
    // place libre la plus proche d'une cible (loin de la piste et des autres scènes)
    const pres = (tx, ty, Rt, Ro, ech) => { ech = ech || 1; let best = [tx, ty], bd = 1e9; for (let e = 0; e < 5000; e++) { const x = tx + (r() - .5) * 260 * ech, y = ty + (r() - .5) * 200 * ech; if (K.dT(x, y) < Rt || K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + Ro * .8) || x < 8 || x > W - 8 || y < 8 || y > H - 8) continue; const d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = [x, y]; } } K.prendre(best[0], best[1], Ro); return best; };
    // montagne dessinée à la plume (flanc gauche clair, flanc droit hachuré)
    const mont = (x, y, w, h, c1, c2, neige, dest) => { const sx = x - w * .06, d = `M${f(x - w / 2)} ${f(y)}Q${f(x - w * .28)} ${f(y - h * .45)} ${f(sx)} ${f(y - h)}Q${f(x + w * .2)} ${f(y - h * .5)} ${f(x + w / 2)} ${f(y)}Z`;
      let o = `<path d="${d}" fill="${c1}" ${INK}/><path d="M${f(sx)} ${f(y - h)}Q${f(x + w * .2)} ${f(y - h * .5)} ${f(x + w / 2)} ${f(y)}L${f(x + w * .02)} ${f(y)}Q${f(x + w * .02)} ${f(y - h * .5)} ${f(sx)} ${f(y - h)}Z" fill="${c2}"/>`;
      for (let k = 1; k < 5; k++) { const t = k / 5; o += `<path d="M${f(sx + (x + w / 2 - sx) * t * .7)} ${f(y - h + h * t * .8)}l${f(-w * .08)} ${f(h * .14)}" stroke="#2A1A0E" stroke-width=".7" opacity=".7"/>`; }
      if (neige) o += `<path d="M${f(sx)} ${f(y - h)}Q${f(x - w * .16)} ${f(y - h * .78)} ${f(x - w * .2)} ${f(y - h * .66)}l${f(w * .07)} ${f(-h * .05)}l${f(w * .06)} ${f(h * .06)}l${f(w * .07)} ${f(-h * .08)}Q${f(x + w * .02)} ${f(y - h * .85)} ${f(sx)} ${f(y - h)}Z" fill="#F7F3EA" stroke="#2A1A0E" stroke-width=".7"/>`;
      (dest || s).push(o); };
    // arbre de carte (petite boule à l'encre)
    const arbre = (x, y, R, c, dest) => (dest || s).push(`<path d="M${f(x)} ${f(y)}v${f(R * .9)}" stroke="#4A2E18" stroke-width="${f(R * .25)}"/><circle cx="${f(x)}" cy="${f(y - R * .2)}" r="${f(R)}" fill="${c}" ${INK}/><circle cx="${f(x - R * .35)}" cy="${f(y - R * .5)}" r="${f(R * .4)}" fill="#fff" opacity=".18"/>`);
    // ---- dégradés, motifs, filtres
    s.push(`<radialGradient id="an-par" cx="48%" cy="45%" r="75%"><stop offset="0" stop-color="#F3E4BE"/><stop offset=".65" stop-color="#E4CC98"/><stop offset="1" stop-color="#B8925A"/></radialGradient>`);
    s.push(`<radialGradient id="an-lave" r="50%"><stop offset="0" stop-color="#FFF2A0"/><stop offset=".3" stop-color="#FF9A2A"/><stop offset=".7" stop-color="#C8321A"/><stop offset="1" stop-color="#5A0A06" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="an-oeil" r="50%"><stop offset="0" stop-color="#FFF4B0"/><stop offset=".35" stop-color="#FFB02A"/><stop offset=".75" stop-color="#E2380E"/><stop offset="1" stop-color="#6A0A04"/></radialGradient>`);
    s.push(`<linearGradient id="an-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".35" stop-color="#F2C64A"/><stop offset=".75" stop-color="#B07A1E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
    s.push(`<linearGradient id="an-blanc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#E8E4DA"/><stop offset="1" stop-color="#A8A294"/></linearGradient>`);
    s.push(`<linearGradient id="an-colline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ACB62"/><stop offset="1" stop-color="#4E8A34"/></linearGradient>`);
    s.push(`<linearGradient id="an-tour" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A3034"/><stop offset=".4" stop-color="#1A1418"/><stop offset="1" stop-color="#050304"/></linearGradient>`);
    s.push(`<linearGradient id="an-cave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A1614"/><stop offset=".7" stop-color="#2A1A12"/><stop offset="1" stop-color="#C8461A"/></linearGradient>`);
    s.push(`<linearGradient id="an-cascade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8F0FF"/><stop offset="1" stop-color="#7AB8E0"/></linearGradient>`);
    s.push(`<filter id="an-lavis" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>`);
    s.push(`<filter id="an-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .5 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    s.push(`<filter id="an-taches" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .12  0 0 0 1.4 -.55"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    // ---- 1. le parchemin : grain, taches, lavis des contrées (vert à l'ouest, or au nord-est, cendre au sud-est)
    s.push(`<rect width="${W}" height="${H}" fill="#fff" filter="url(#an-taches)" opacity=".55"/>`);
    const MORDOR = `M${W + 10} 330L1000 402L900 452L828 438L760 440L700 452L620 470L560 540L520 610L500 ${H + 10}L${W + 10} ${H + 10}Z`;
    s.push(`<g filter="url(#an-lavis)" opacity=".75"><ellipse cx="170" cy="520" rx="260" ry="220" fill="#8DBA5A"/><ellipse cx="90" cy="70" rx="200" ry="110" fill="#6FA88A"/><ellipse cx="870" cy="110" rx="260" ry="130" fill="#D8C05A"/><ellipse cx="470" cy="330" rx="200" ry="130" fill="#C8BFA4"/><ellipse cx="350" cy="80" rx="150" ry="80" fill="#8A8478"/></g>`);
    s.push(`<path d="${MORDOR}" fill="#2A1A16" opacity=".9" filter="url(#an-lavis)"/><path d="${MORDOR}" fill="#3A2420" opacity=".75"/>`);
    s.push(`<rect width="${W}" height="${H}" fill="#fff" filter="url(#an-grain)" opacity=".35"/>`);
    // ---- 2. les monts Brumeux (au nord-ouest) et les montagnes de l'Ombre (frontière du Mordor)
    const chaine = (pts, wMin, wMax, hMin, hMax, c1, c2, neige, marge) => pts.forEach(([x, y]) => { const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin); if (K.dT(x, y - h * .4) < (marge || 18) || K.dT(x, y) < (marge || 18)) return; mont(x, y, w, h, c1, c2, neige); });
    { const p = []; for (let x = 200; x < 500; x += 20) p.push([x + r() * 10, 50 + (x - 200) * .12 + r() * 30]); for (let x = 210; x < 470; x += 26) p.push([x + r() * 10, 22 + r() * 18]); p.sort((u, v) => u[1] - v[1]); chaine(p, 30, 46, 30, 50, "#BDB5A4", "#7E7466", true, 22); }
    { const p = []; for (let k = 0; k < 40; k++) { const t = k / 39; p.push([W + 6 - t * 440 + (r() - .5) * 14, 360 + t * 70 + Math.sin(t * 9) * 16 + (r() - .5) * 10]); } for (let k = 0; k < 18; k++) { const t = k / 17; p.push([590 - t * 70 + (r() - .5) * 10, 470 + t * 150 + (r() - .5) * 10]); } p.sort((u, v) => u[1] - v[1]); chaine(p, 26, 38, 22, 40, "#4A3A36", "#1E1416", false, 16); }
    // ================= LA COMTÉ (départ, à l'ouest) =================
    const trou = (x, y, sc, porte, dest) => { const o = `${G(x, y, sc)}<ellipse cx="2" cy="12" rx="44" ry="7" fill="#000" opacity=".18"/><path d="M-44 12Q-36 -26 0 -28Q36 -26 44 12Z" fill="url(#an-colline)" ${INK}/>${[-30, -16, 14, 28].map(u => `<path d="M${u} ${-10 - Math.abs(u) * .1}q2 -4 4 0" stroke="#3E7A2A" stroke-width="1" fill="none"/>`).join("")}
      <circle cx="0" cy="0" r="12" fill="#6A4422" ${INK}/><circle cx="0" cy="0" r="9.5" fill="${porte}" stroke="#2A1A0E" stroke-width=".8"/>${[-6, -3, 0, 3, 6].map(u => `<path d="M${u} -9V9" stroke="#000" stroke-opacity=".18" stroke-width=".6"/>`).join("")}<circle cx="0" cy="0" r="1.8" fill="${OR}" stroke="#6A440E" stroke-width=".5"/>
      <circle cx="-23" cy="-1" r="5" fill="#FFE08A" ${INK}/><path d="M-28 -1h10M-23 -6v10" stroke="#6A4422" stroke-width="1"/><circle cx="23" cy="-1" r="5" fill="#FFE08A" ${INK}/><path d="M18 -1h10M23 -6v10" stroke="#6A4422" stroke-width="1"/>
      <rect x="18" y="-34" width="5" height="10" fill="#8A6A4A" ${INK}/><path d="M-4 12q4 10 -2 18" stroke="#C9A870" stroke-width="5" fill="none"/>${[-36, -30, 30, 36].map(u => `<circle cx="${u}" cy="9" r="2" fill="${["#E5484D", "#F2C230", "#F27AB0", "#FFFFFF"][Math.abs(u) % 4]}"/>`).join("")}</g>`; (dest || s).push(o); };
    // Cul-de-Sac et la fête : dans la boucle ouest
    const [cX, cY] = pres(250, 300, 70, 70);
    trou(cX - 18, cY + 30, 1.35, "#2E7A3A");
    s.push(`<text x="${f(cX - 18)}" y="${f(cY + 66)}" text-anchor="middle" font-family="Georgia, serif" font-size="7" fill="#3A2414">Cul-de-Sac</text>`);
    // l'arbre de la fête, ses lanternes, la tente rayée
    { const x = cX + 52, y = cY - 20; s.push(`${G(x, y, 1)}<ellipse cx="2" cy="34" rx="30" ry="6" fill="#000" opacity=".2"/><path d="M-3 34Q-2 10 -6 -4M1 34Q2 10 8 -6" stroke="#5A3A1E" stroke-width="5" fill="none"/>${[[-16, -14, 16], [12, -18, 18], [0, -32, 17], [-22, -30, 12], [22, -34, 12]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#4E8A34" ${INK}/><circle cx="${u - 4}" cy="${v - 4}" r="${R * .5}" fill="#7EBA52"/>`).join("")}</g>`);
      [[-20, -8], [-6, -2], [10, -4], [24, -10], [-26, -24], [6, -20], [18, -28], [-10, -40]].forEach(([u, v], k) => { s.push(`<circle cx="${f(x + u)}" cy="${f(y + v)}" r="2.6" fill="${["#E5484D", "#F2C230", "#4C9AFF", "#F27AB0"][k % 4]}" stroke="#2A1A0E" stroke-width=".5"/>`); K.halo(x + u, y + v, 7, "#FFE08A", .55); });
      s.push(`${G(x - 2, y + 48, 1)}<path d="M-26 10L-20 -10L0 -18L20 -10L26 10Z" fill="#F7F1E2" ${INK}/>${[-18, -8, 2, 12].map(u => `<path d="M${u} -13L${u + 4} 10" stroke="#C8283A" stroke-width="3"/>`).join("")}<path d="M0 -18v-6" stroke="#2A1A0E"/><path d="M0 -24l7 2l-7 2z" fill="#C8283A"/></g>`); }
    // le feu d'artifice en forme de dragon (il traverse le ciel de la Comté) + bouquets
    { const x0 = cX - 40, y0 = cY - 30, dragon = `<g stroke-linecap="round" fill="none"><path d="M-30 6Q-18 -10 -2 0Q12 10 24 -4" stroke="#FF6A2A" stroke-width="3"/><path d="M-30 6Q-18 -10 -2 0Q12 10 24 -4" stroke="#FFE08A" stroke-width="1.2"/><path d="M24 -4l8 -6l-2 6l6 2l-8 2z" fill="#FF8A2A" stroke="#FFE08A" stroke-width=".8"/><path d="M-6 -2Q-4 -22 10 -26Q4 -14 6 -4M2 2Q8 -16 22 -16Q14 -8 12 2" stroke="#FFB347" stroke-width="1.4"/><path d="M-30 6l-10 4l4 -6" stroke="#FF6A2A" stroke-width="2"/><circle cx="31" cy="-7" r="1" fill="#fff"/></g>`;
      a.push(`<g${K.anime ? "" : ` transform="translate(232 128) scale(1.1)"`}>${an(`<animateMotion dur="11s" repeatCount="indefinite" rotate="auto" path="M${f(x0 - 110)} ${f(y0 + 60)}Q${f(x0)} ${f(y0 - 160)} ${f(x0 + 160)} ${f(y0 - 20)}"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.1;.6;.75;1" dur="11s" repeatCount="indefinite"/>`)}<g transform="scale(1.3)">${dragon}</g></g>`);
      [[x0 + 150, y0 - 50, "#FF6FA8", 0], [x0 + 60, y0 - 110, "#4C9AFF", 3.7], [x0 - 60, y0 - 70, "#F2C230", 7.3]].forEach(([u, v, c, b]) => a.push(`<g transform="translate(${f(u)} ${f(v)})" opacity="${K.anime ? 0 : (b === 0 ? .9 : 0)}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.05;.25;1" dur="11s" begin="${b}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" additive="sum" values=".2;1.1;1.2;1.2" keyTimes="0;.12;.25;1" dur="11s" begin="${b}s" repeatCount="indefinite"/>`)}${Array.from({ length: 12 }, (_, q) => { const t = q / 12 * TAU; return `<path d="M${f(Math.cos(t) * 5)} ${f(Math.sin(t) * 5)}L${f(Math.cos(t) * 18)} ${f(Math.sin(t) * 18)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${f(Math.cos(t) * 20)}" cy="${f(Math.sin(t) * 20)}" r="1.4" fill="#FFF6D0"/>`; }).join("")}</g>`));
      bulle(cX - 40, cY - 30, "Cent onze ans !", 12, 1); }
    titre(cX - 10, cY - 58, "LA COMTÉ", 20, "#2E5A1E");
    // les trous de hobbit sur les collines, à l'ouest et au sud (hors de la boucle)
    [[60, 440, "#E5484D"], [62, 560, "#F2C230"], [330, 680, "#4C7ACF"], [420, 690, "#8A3A8A"], [70, 330, "#2E7A3A"]].forEach(([x, y, c]) => { const p = pres(x, y, 46, 40, .5); trou(p[0], p[1], .9, c); });
    // les champs bordés de haies et la charrette du magicien chargée de fusées (dans la boucle, au sud de Cul-de-Sac)
    { const ch = ["#D8C070", "#A8C468", "#C8A060", "#8CB458", "#E0CC80"]; for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const x = 190 + i * 38 + (j % 2) * 12, y = 400 + j * 30; if (K.dT(x, y) < 34 || K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + 18)) continue;
        s.push(`<rect x="${f(x - 18)}" y="${f(y - 13)}" width="36" height="26" fill="${ch[(i * 3 + j * 2) % 5]}" stroke="#4E7A2E" stroke-width="2.2" stroke-dasharray="3 1.5" transform="rotate(${f((r() - .5) * 10)} ${f(x)} ${f(y)})" opacity=".9"/>`); if ((i + j) % 3 === 0) for (let q = 0; q < 4; q++) s.push(`<path d="M${f(x - 14)} ${f(y - 8 + q * 5)}h28" stroke="#8A6A2A" stroke-width=".6" opacity=".6"/>`); if ((i * j) % 5 === 2) for (let q = 0; q < 3; q++) s.push(`<circle cx="${f(x - 9 + q * 9)}" cy="${f(y + 3)}" r="3.4" fill="#F28A2A" stroke="#8A4A0E" stroke-width=".6"/>`); } }
    { const [x, y] = pres(330, 470, 30, 34, .3); s.push(`${G(x, y, 1.3)}<ellipse cx="0" cy="12" rx="30" ry="5" fill="#000" opacity=".2"/><path d="M-30 4Q-26 -6 -18 -6L-12 -4L-14 6M-28 6l-2 6M-20 6l1 6" fill="#9A8A7A" stroke="#2A1A0E" stroke-width="1"/><circle cx="-31" cy="-3" r="3" fill="#9A8A7A" stroke="#2A1A0E" stroke-width=".8"/>
      <rect x="-10" y="-8" width="30" height="12" rx="2" fill="#8A5A2A" stroke="#2A1A0E" stroke-width="1"/><circle cx="-4" cy="6" r="5" fill="none" stroke="#2A1A0E" stroke-width="1.4"/><circle cx="14" cy="6" r="5" fill="none" stroke="#2A1A0E" stroke-width="1.4"/>
      ${[0, 1, 2, 3, 4].map(q => `<path d="M${-4 + q * 5} -8l${q % 2 ? 2 : -2} -14" stroke="${["#E5484D", "#4C9AFF", "#F2C230", "#2BB6A3", "#FF6FA8"][q]}" stroke-width="2.6"/><path d="M${-4 + q * 5 + (q % 2 ? 2 : -2)} -22l${q % 2 ? 1 : -1} -4" stroke="#2A1A0E" stroke-width="1"/>`).join("")}
      <path d="M-14 -6L-10 -20L-6 -6Z" fill="#9A9AA2" stroke="#2A1A0E" stroke-width=".8"/><path d="M-15 -19L-10 -36L-5 -19Z" fill="#8A8A92" stroke="#2A1A0E" stroke-width=".8"/><path d="M-16 -19h12" stroke="#2A1A0E" stroke-width="1.4"/><path d="M-11 -17q1 6 0 8" stroke="#F4F4F4" stroke-width="2"/></g>`); }
    for (let k = 0; k < 40; k++) { const x = r() * 470, y = 380 + r() * 340; if (K.libre(x, y, 10, 6) && !K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + 8)) arbre(x, y, 5 + r() * 4, r() < .5 ? "#5E9A3E" : "#3E7A2E"); }
    // ================= FONDCOMBE (nord-ouest) : vallée secrète, cascades, demeures elfiques =================
    const [fX, fY] = pres(95, 95, 70, 80, .4);
    { const x = fX, y = fY; s.push(`${G(x, y, 1.15)}<path d="M-90 50Q-80 -20 -50 -50L-30 -60L-20 10L20 10L34 -64L60 -50Q86 -10 90 50Z" fill="#8A9A7A" ${INK}/><path d="M-20 10L-30 -60L-14 -66L-8 10ZM20 10L34 -64L22 -66L10 10Z" fill="#6A7A5A"/>
      <path d="M-24 50Q0 30 24 50Z" fill="#7AB8E0" ${INK}/>
      ${[[-56, 18, 1], [40, 14, .9], [-6, 30, .8]].map(([u, v, k]) => `<g transform="translate(${u} ${v}) scale(${k})"><rect x="-14" y="-16" width="28" height="18" fill="#EFE6D2" ${INK}/>${[-8, 0, 8].map(w => `<path d="M${w - 3} 2v-9q3 -5 6 0v9" fill="#B8C8D8" stroke="#2A1A0E" stroke-width=".6"/>`).join("")}<path d="M-18 -16Q0 -34 18 -16Z" fill="#6A9A8A" ${INK}/><path d="M0 -30v-8" stroke="#2A1A0E" stroke-width=".8"/><circle cx="0" cy="-39" r="1.5" fill="${OR}"/></g>`).join("")}
      <path d="M-72 -10Q-60 -14 -50 -8" stroke="#EFE6D2" stroke-width="3" fill="none"/>${[[-70, 30], [70, 30], [-40, 46], [56, -20], [-74, -26]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="7" fill="${["#E2A23A", "#C8642A", "#F2C230"][Math.abs(u) % 3]}" ${INK}/>`).join("")}</g>`);
      [[-10, -60], [26, -62], [-34, -50]].forEach(([u, v], k) => a.push(`<path d="M${f(x + u * 1.15)} ${f(y + v * 1.15)}Q${f(x + u * 1.15 + 3)} ${f(y + 10)} ${f(x + u * .6)} ${f(y + 52)}" fill="none" stroke="url(#an-cascade)" stroke-width="${4 - k}" stroke-dasharray="6 4">${an(`<animate attributeName="stroke-dashoffset" values="20;0" dur="${(.8 + k * .3).toFixed(1)}s" repeatCount="indefinite"/>`)}</path>`)); }
    titre(fX + 6, fY + 84, "FONDCOMBE", 14, "#2A5A5A");
    // ================= LA MORIA : la porte aux lettres qui brillent, le guetteur de l'eau =================
    const [mX, mY] = pres(330, 105, 52, 50, .3);
    { const x = mX, y = mY; s.push(`${G(x, y, 1)}<path d="M-56 30L-50 -40Q0 -70 50 -40L56 30Z" fill="#6E6A66" ${INK}/><path d="M-50 30L-46 -36Q0 -60 46 -36L50 30Z" fill="#5A5654"/><ellipse cx="0" cy="36" rx="60" ry="10" fill="#1A2630" ${INK}/></g>`);
      a.push(`<g transform="translate(${f(x)} ${f(y)})" fill="none" stroke="#DDEBFF" stroke-width="1.3">${an(`<animate attributeName="opacity" values=".35;1;.35" dur="5s" repeatCount="indefinite"/>`)}<path d="M-22 28V-14Q0 -40 22 -14V28"/><path d="M-22 -14Q0 -30 22 -14" stroke-dasharray="2 1.5"/><path d="M-26 28V-12M26 28V-12"/><path d="M0 26V2M0 10l-8 -8M0 10l8 -8M0 4l-5 -6M0 4l5 -6"/><path d="M0 -10l1.5 3.5h3.5l-3 2.2l1.2 3.6l-3.2 -2.2l-3.2 2.2l1.2 -3.6l-3 -2.2h3.5z" fill="#F4FAFF"/><circle cx="-12" cy="-4" r="2"/><circle cx="12" cy="-4" r="2"/><circle cx="0" cy="-4" r="22" opacity=".12" fill="#BFE0FF"/></g>`);
      [[-44, 1], [40, -1]].forEach(([u, sg], k) => a.push(`<path d="M${f(x + u)} ${f(y + 38)}q${f(sg * -4)} -14 ${f(sg * 2)} -24q${f(sg * 4)} -6 ${f(sg * 8)} -2" fill="none" stroke="#6A9A6A" stroke-width="4" stroke-linecap="round">${an(`<animateTransform attributeName="transform" type="rotate" values="${sg * -8} ${f(x + u)} ${f(y + 38)};${sg * 10} ${f(x + u)} ${f(y + 38)};${sg * -8} ${f(x + u)} ${f(y + 38)}" dur="${3 + k}s" repeatCount="indefinite"/>`)}</path>`));
      legende(x, y - 50, "Parlez, ami, et entrez", "#2A2A3A", 9); }
    titre(mX, mY + 56, "MORIA", 13, "#3A3A4A");
    // le pont de Khazad-dûm, au cœur de la montagne (boucle nord) : « Vous ne passerez pas ! »
    const [bX, bY] = pres(585, 165, 66, 74, .4);
    { const x = bX, y = bY; s.push(`${G(x, y, 1.15)}<path d="M-80 40Q-84 -30 -40 -48Q0 -60 40 -48Q84 -30 80 40Q0 56 -80 40Z" fill="url(#an-cave)" ${INK}/>${[-60, -40, -18, 10, 34, 56].map((u, q) => `<path d="M${u - 4} ${-44 + Math.abs(u) * .1}l4 ${10 + q % 3 * 5}l4 ${-10 - q % 3 * 5}" fill="#3A2E28"/>`).join("")}
      <path d="M-80 40L-70 10L-56 20L-56 40Z" fill="#2A221E"/><path d="M80 40L72 6L58 18L58 40Z" fill="#2A221E"/><path d="M-60 14Q0 -2 60 12" stroke="#5A4A40" stroke-width="4" fill="none"/><path d="M-60 14Q0 -2 60 12" stroke="#1A1410" stroke-width="1" fill="none"/>
      <g transform="translate(-14 0)"><path d="M-6 6L0 -16L6 6Z" fill="#9A9AA2" ${INK}/><circle cx="0" cy="-18" r="4" fill="${PEAU}" ${INK}/><path d="M-5 -20L0 -32L5 -20Z" fill="#8A8A92" ${INK}/><path d="M-6 -21h12" stroke="#2A1A0E" stroke-width="1.5"/><path d="M-2 -15q2 8 2 10q1 -3 2 -10" fill="#F4F4F4"/><path d="M8 8L5 -30" stroke="#6A4A2A" stroke-width="1.6"/></g></g>`);
      a.push(`<circle cx="${f(x - 4 * 1.15 - 14 * 1.15 + 23)}" cy="${f(y - 34)}" r="5" fill="#FFFFFF">${an(`<animate attributeName="r" values="4;9;4" dur="2s" repeatCount="indefinite"/>`)}</circle>`); K.halo(x - 10, y - 34, 26, "#E8F4FF", .8, a);
      // le démon de feu : ailes d'ombre, cornes, fouet de flammes
      a.push(`${G(x + 32, y - 6, 1.15)}<g>${an(`<animateTransform attributeName="transform" type="scale" values="1;1.05;1" dur="1.4s" repeatCount="indefinite"/>`)}<path d="M0 -20Q-36 -60 -30 -10Q-20 -24 -8 -10ZM6 -20Q44 -64 40 -6Q28 -22 14 -10Z" fill="#1A0A06" stroke="#C8321A" stroke-width="1.2"/>
        <path d="M-12 18Q-14 -10 0 -24Q14 -10 12 18Z" fill="#2A0E08" stroke="#FF6A2A" stroke-width="1.4"/><path d="M-6 -22l-6 -10l8 6M6 -22l6 -10l-8 6" fill="#3A1A10" stroke="#FF6A2A" stroke-width=".8"/><circle cx="-3" cy="-16" r="1.4" fill="#FFE08A"/><circle cx="3" cy="-16" r="1.4" fill="#FFE08A"/>
        ${[-10, -4, 2, 8].map((u, q) => `<path d="M${u} ${-24 + q % 2 * 4}q-3 -10 2 -18q0 8 4 12" fill="#FF8A2A" opacity=".85"/>`).join("")}</g><path d="M-10 4Q-40 20 -50 0Q-58 -14 -70 -4" fill="none" stroke="#FFB347" stroke-width="2.2" stroke-linecap="round">${an(`<animate attributeName="d" values="M-10 4Q-40 20 -50 0Q-58 -14 -70 -4;M-10 4Q-36 -6 -48 10Q-60 20 -68 8;M-10 4Q-40 20 -50 0Q-58 -14 -70 -4" dur="1.8s" repeatCount="indefinite"/>`)}</path></g>`);
      bulle(x - 16, y - 62, "Vous ne passerez pas !", 9, 2);
      legende(x, y + 74, "le pont de Khazad-dûm", "#3A2414", 9); }
    // ================= LE ROHAN (nord-est) : Edoras, le Gouffre de Helm, les feux d'alarme, les cavaliers =================
    const [eX, eY] = pres(800, 60, 52, 60, .3);
    { const x = eX, y = eY; s.push(`${G(x, y, 1.1)}<path d="M-56 26Q-30 -14 0 -16Q30 -14 56 26Z" fill="#B8B04A" ${INK}/><path d="M-50 22Q-30 -6 0 -8Q30 -6 50 22" fill="none" stroke="#6A4A2A" stroke-width="1.4" stroke-dasharray="3 2"/>
      <rect x="-24" y="-30" width="48" height="16" fill="#8A5A2A" ${INK}/><path d="M-28 -30L-18 -44H18L28 -30Z" fill="url(#an-or)" ${INK}/>${[-18, 18].map(u => `<path d="M${u} -44l${u > 0 ? 3 : -3} -6l${u > 0 ? 3 : -3} 2" stroke="#6A440E" stroke-width="1.4" fill="none"/>`).join("")}${[-14, -4, 6, 16].map(u => `<path d="M${u} -14v-10" stroke="#5A3A1A" stroke-width="1.5"/>`).join("")}
      ${[-36, -26, 26, 36].map(u => `<path d="M${u} ${4 - Math.abs(u) * .1}l-2 8h4z" fill="#8A6A3A"/>`).join("")}</g>`);
      a.push(`<g transform="translate(${f(x + 4)} ${f(y - 62)})"><path d="M0 14V-6" stroke="#2A1A0E"/><path d="M0 -6h16l-3 5l3 5h-16z" fill="#2E7A3A" ${INK}>${an(`<animateTransform attributeName="transform" type="skewY" values="0;-8;0" dur="2s" repeatCount="indefinite"/>`)}</path><path d="M4 -3l3 -2l2 2l1 4" stroke="#F4F1EA" stroke-width="1" fill="none"/></g>`); }
    legende(eX, eY + 44, "Edoras", "#5A3A14", 10);
    const [hX, hY] = pres(975, 140, 60, 70, .4);
    { const x = hX, y = hY; s.push(`${G(x, y, 1.2)}`); mont(-44, 20, 70, 74, "#A8A090", "#6A6458", true); mont(48, 22, 74, 84, "#A8A090", "#6A6458", true);
      s.push(`<path d="M-30 26Q0 12 34 26L34 34Q0 22 -30 34Z" fill="#9A9284" ${INK}/>${[-24, -14, -4, 6, 16, 26].map(u => `<rect x="${u}" y="${20 - (u + 30) * .02}" width="4" height="4" fill="#9A9284" ${INK}/>`).join("")}
        <path d="M14 22L20 -6L40 -6L44 22Z" fill="#B8B0A0" ${INK}/><rect x="24" y="-24" width="12" height="20" fill="#C8C0B0" ${INK}/><path d="M22 -24h16l-8 -10z" fill="#6A6458" ${INK}/><path d="M30 -34v-8" stroke="#2A1A0E"/><path d="M30 -42h8l-2 3l2 3h-8" fill="#2E7A3A"/></g>`); }
    legende(hX - 6, hY + 66, "le Gouffre de Helm", "#3A2414", 10);
    titre((eX + hX) / 2 + 6, 26, "ROHAN", 22, "#6A4A0E");
    // les feux d'alarme : de colline en colline, ils s'allument l'un après l'autre (le Gondor appelle à l'aide)
    { const pts = []; for (let k = 0; k < 5; k++) { const t = k / 4; let x = 1050 - t * 10, y = 250 + t * 0; x = 690 + t * 360; y = 228 + Math.sin(t * PI) * -30 - t * 20; const p = pres(x, y - 10, 26, 14, .15); pts.push(p); }
      pts.forEach(([x, y], k) => { mont(x, y + 10, 28, 20, "#B8A880", "#7A6A4A", false); s.push(`<path d="M${f(x - 4)} ${f(y - 10)}l8 0l-4 -6z" fill="#5A3A1A"/>`); a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(.06 + k * .1).toFixed(2)};${(.1 + k * .1).toFixed(2)};.85;1" dur="14s" repeatCount="indefinite"/>`)}<path d="M${f(x - 4)} ${f(y - 12)}q-2 -10 4 -16q0 6 4 8q2 -4 0 -8q6 6 0 16z" fill="#FF8A2A" stroke="#C8321A" stroke-width=".6"/><circle cx="${f(x)}" cy="${f(y - 16)}" r="12" fill="#FFB347" opacity=".35"/></g>`); }); }
    // les cavaliers du Rohan galopent dans la plaine
    const cavalier = (c, banniere) => `<g><path d="M-12 0Q-10 -6 0 -6Q10 -6 12 -2L16 -8L18 -6L14 2Q10 4 8 4L10 12M-8 4L-12 12M-4 4L-2 12M6 4L4 12" fill="${c}" stroke="#2A1A0E" stroke-width="1"/><path d="M-12 -2l-6 4" stroke="#2A1A0E" stroke-width="1.5"/><path d="M-2 -6L0 -16L4 -6" fill="#7A6A4A" stroke="#2A1A0E" stroke-width=".8"/><circle cx="1" cy="-18" r="2.6" fill="#B8B0A0" stroke="#2A1A0E" stroke-width=".6"/><path d="M4 -16L10 -30" stroke="#5A3A1A" stroke-width="1"/>${banniere ? `<path d="M10 -30l10 1l-2 3l2 3l-9 0z" fill="#2E7A3A" stroke="#2A1A0E" stroke-width=".5"/>` : ""}</g>`;
    { const [x, y] = pres(860, 190, 30, 30, .3); a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="-50 -10;60 14;-50 -10" keyTimes="0;.9;1" dur="10s" repeatCount="indefinite"/>`)}${[[0, 0, "#8A5A3A", 1], [-22, -6, "#F4F1EA", 0], [-18, 10, "#4A3A2A", 1], [-40, 4, "#7A4A2A", 0]].map(([u, v, c, b]) => `<g transform="translate(${f(x + u)} ${f(y + v)}) scale(.9)">${cavalier(c, b)}</g>`).join("")}</g>`); }
    // ================= MINAS TIRITH, la cité blanche aux 7 niveaux (au cœur de la carte) =================
    const [gX, gY] = pres(420, 275, 64, 82, .5);
    { const x = gX, y = gY; s.push(`${G(x, y, 1.25)}`); mont(14, 34, 150, 110, "#C8C0B0", "#8A8270", true);
      for (let k = 0; k < 7; k++) { const R = 58 - k * 7.4, yy = 34 - k * 9; s.push(`<path d="M${f(-R)} ${f(yy)}A${f(R)} ${f(R * .32)} 0 0 1 ${f(R)} ${f(yy)}V${f(yy - 8)}A${f(R)} ${f(R * .32)} 0 0 0 ${f(-R)} ${f(yy - 8)}Z" fill="url(#an-blanc)" ${INK}/><path d="M${f(-R)} ${f(yy - 8)}A${f(R)} ${f(R * .32)} 0 0 1 ${f(R)} ${f(yy - 8)}" fill="none" stroke="#2A1A0E" stroke-width=".5" stroke-dasharray="1.5 1.5"/>`);
        for (let q = 0; q < 6 - k * .6; q++) { const u = -R * .8 + q * (R * 1.6 / Math.max(1, 5 - k * .6)); s.push(`<rect x="${f(u - 2)}" y="${f(yy - 14 - (q % 2) * 2)}" width="4" height="${6 + (q % 2) * 2}" fill="#F4F0E6" stroke="#2A1A0E" stroke-width=".5"/>`); } }
      s.push(`<path d="M0 36L-4 -30L0 -40L4 -30Z" fill="#E8E2D2" ${INK}/><rect x="-3" y="-64" width="6" height="34" fill="url(#an-blanc)" ${INK}/><path d="M-4 -64L0 -72L4 -64Z" fill="#C8C0B0" ${INK}/><path d="M0 -72v-8" stroke="#2A1A0E" stroke-width=".8"/>
        <path d="M14 -30q-2 -6 2 -10M14 -30q4 -4 2 -12M14 -30v6" stroke="#F4F4F4" stroke-width="1.2" fill="none"/></g>`);
      a.push(`<path d="M${f(x)} ${f(y - 100)}h14l-3 4l3 4h-14z" fill="#1A1A22" stroke="#F4F4F4" stroke-width=".6">${an(`<animateTransform attributeName="transform" type="skewY" values="0;-6;0" dur="2.4s" repeatCount="indefinite"/>`)}</path>`); }
    titre(gX, gY + 84, "MINAS TIRITH", 13, "#3A3A4A"); legende(gX, gY + 98, "Gondor", "#3A3A4A", 9);
    // ================= LA GRANDE BATAILLE des champs du Pelennor =================
    const [vX, vY] = pres(590, 380, 80, 96, .5);
    { const x = vX, y = vY; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="128" ry="80" fill="#8A6A44" opacity=".35" filter="url(#an-lavis)"/>`);
      for (let k = 0; k < 60; k++) { const u = x - 110 + r() * 220, v = y - 70 + r() * 140; if (K.dT(u, v) > 14) s.push(`<path d="M${f(u)} ${f(v)}l${f(3 + r() * 5)} ${f((r() - .5) * 3)}" stroke="#5A3A1E" stroke-width=".8" opacity=".5"/>`); }
      // l'armée de l'Ombre (à droite, vient du Mordor) : rangs de lances noires et yeux rouges
      const orque = (u, v) => `<path d="M${f(u - 3.4)} ${f(v + 5)}L${f(u)} ${f(v - 4)}L${f(u + 3.4)} ${f(v + 5)}Z" fill="#2A2420" stroke="#120E0C" stroke-width=".5"/><circle cx="${f(u)}" cy="${f(v - 5)}" r="2.4" fill="#4A4A3A" stroke="#120E0C" stroke-width=".5"/><circle cx="${f(u - .9)}" cy="${f(v - 5.2)}" r=".6" fill="#FF3A1A"/><circle cx="${f(u + .9)}" cy="${f(v - 5.2)}" r=".6" fill="#FF3A1A"/><path d="M${f(u + 2.6)} ${f(v + 3)}L${f(u + 4)} ${f(v - 13)}" stroke="#5A4A40" stroke-width=".9"/><path d="M${f(u + 4)} ${f(v - 13)}l-1 3h2z" fill="#C8C0B0"/>`;
      let ar = ""; for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) { const u = x + 16 + i * 11 + (j % 2) * 5.5, v = y - 36 + j * 12 + i * 1.5; if (K.dT(u, v) > 12) ar += orque(u, v); }
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-10 -2;0 0" dur="6s" repeatCount="indefinite"/>`)}${ar}<path d="M${f(x + 100)} ${f(y - 40)}v-16" stroke="#2A2420" stroke-width="1"/><path d="M${f(x + 100)} ${f(y - 56)}h12v9h-12z" fill="#3A1414"/><circle cx="${f(x + 106)}" cy="${f(y - 51.5)}" r="3" fill="#E2380E"/></g>`);
      // les gens de l'Ouest (à gauche) : boucliers blancs, l'arbre blanc sur bannière noire
      let ou = ""; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const u = x - 22 - i * 11 - (j % 2) * 5.5, v = y - 30 + j * 12 - i * 1.2; if (K.dT(u, v) > 12) ou += `<path d="M${f(u - 3.4)} ${f(v + 5)}L${f(u)} ${f(v - 4)}L${f(u + 3.4)} ${f(v + 5)}Z" fill="#2A3A5A" stroke="#120E0C" stroke-width=".5"/><circle cx="${f(u)}" cy="${f(v - 5)}" r="2.4" fill="url(#an-blanc)" stroke="#2A1A0E" stroke-width=".5"/><path d="M${f(u - 3)} ${f(v + 3)}L${f(u - 2)} ${f(v - 13)}" stroke="#E8ECF4" stroke-width=".9"/><ellipse cx="${f(u + 2.6)}" cy="${f(v + 1)}" rx="2" ry="3" fill="#F4F4F4" stroke="#2A1A0E" stroke-width=".4"/>`; }
      s.push(ou + `<path d="M${f(x - 86)} ${f(y - 30)}v-20" stroke="#2A1A0E"/><path d="M${f(x - 86)} ${f(y - 50)}h14v12h-14z" fill="#1A1A22"/><path d="M${f(x - 79)} ${f(y - 40)}v-7M${f(x - 79)} ${f(y - 44)}l-3 -2M${f(x - 79)} ${f(y - 44)}l3 -2" stroke="#F4F4F4" stroke-width=".8"/>`);
      // le choc : étincelles au contact des deux armées
      for (let k = 0; k < 3; k++) a.push(`<g transform="translate(${f(x - 6 + k * 10)} ${f(y - 16 + k * 16)})" opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.2;1" dur="${(1.6 + k * .5).toFixed(1)}s" begin="${k * .4}s" repeatCount="indefinite"/>`)}<path d="M-6 0h12M0 -6v12M-4 -4l8 8M4 -4l-8 8" stroke="#FFE08A" stroke-width="1.4"/><circle r="3" fill="#FFF6D0"/></g>`);
      // les éléphants géants (deux), avec leurs tours de guerre
      const olifant = (u, v, sc, sg) => `${G(u, v, sc)}<g transform="scale(${sg} 1)"><ellipse cx="0" cy="26" rx="34" ry="5" fill="#000" opacity=".25"/><path d="M-26 -4Q-28 -26 -4 -28Q22 -30 28 -10Q34 -4 32 8L30 24H24L22 10L-14 10L-16 24H-22L-24 8Q-30 4 -26 -4Z" fill="#7A6E66" ${INK}/><path d="M26 -14Q42 -12 40 6Q38 18 44 22" stroke="#7A6E66" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M26 -14Q42 -12 40 6Q38 18 44 22" stroke="#2A1A0E" stroke-width="1" fill="none" opacity=".6"/><path d="M32 2Q44 6 50 -4M30 6Q40 12 48 4" stroke="#F4ECD8" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="30" cy="-8" r="1.4" fill="#1A0A06"/><path d="M18 -16Q24 -24 22 -6" fill="#6A5E56" stroke="#2A1A0E" stroke-width=".8"/>
        <rect x="-18" y="-46" width="28" height="18" fill="#6A3A1A" ${INK}/><path d="M-20 -46h32l-4 -6h-24z" fill="#8A2A1A" ${INK}/>${[-12, -4, 4].map(w => `<path d="M${w} -52v-8" stroke="#2A1A0E" stroke-width=".8"/>`).join("")}<path d="M-4 -60h8l-2 3l2 3h-8" fill="#C8321A"/></g></g>`;
      [[x + 112, y + 48, 1, -1, 0], [x + 128, y - 22, .85, -1, 1.2]].forEach(([u, v, sc, sg, b]) => a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-6 -1.5;0 0" dur="${(3 + b).toFixed(1)}s" repeatCount="indefinite"/>`)}${olifant(u, v, sc, sg)}</g>`));
      // la charge des cavaliers (du nord, ils fondent sur l'Ombre)
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="-46 -30;6 10;6 10;-46 -30" keyTimes="0;.45;.9;1" dur="9s" repeatCount="indefinite"/>`)}${[[0, 0, "#8A5A3A", 1], [14, -10, "#F4F1EA", 0], [-14, -8, "#4A3A2A", 1], [4, -22, "#7A4A2A", 0], [26, -24, "#9A6A4A", 0]].map(([u, v, c, b]) => `<g transform="translate(${f(x - 10 + u)} ${f(y - 52 + v)}) rotate(24) scale(.85)">${cavalier(c, b)}</g>`).join("")}</g>`);
      // volées de flèches et pierres de catapulte
      for (let k = 0; k < 2; k++) a.push(`<g opacity="0">${an(`<animateMotion dur="3.4s" begin="${k * 1.7}s" repeatCount="indefinite" path="M${f(x - 60)} ${f(y + 10 + k * 14)}Q${f(x)} ${f(y - 60)} ${f(x + 60)} ${f(y + 4 + k * 10)}" rotate="auto"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="3.4s" begin="${k * 1.7}s" repeatCount="indefinite"/>`)}${[0, 1, 2, 3].map(q => `<path d="M${-q * 3} ${q * 4 - 6}h8" stroke="#2A1A0E" stroke-width=".8"/><path d="M${8 - q * 3} ${q * 4 - 6}l-2 -1.4v2.8z" fill="#2A1A0E"/>`).join("")}</g>`);
      a.push(`<g opacity="0">${an(`<animateMotion dur="4.6s" repeatCount="indefinite" path="M${f(x + 110)} ${f(y + 30)}Q${f(x + 20)} ${f(y - 140)} ${f(gX + 30)} ${f(gY + 10)}"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.92;1" dur="4.6s" repeatCount="indefinite"/>`)}<circle r="4.5" fill="#FF8A2A" stroke="#C8321A"/><circle r="9" fill="#FFB347" opacity=".35"/></g>`);
      legende(x - 64, y + 80, "les champs du Pelennor", "#3A2414", 10); }
    // les cavaliers ailés de l'Ombre tournent au-dessus de la bataille ; les aigles arrivent
    for (let k = 0; k < 2; k++) { const R1 = 90 + k * 26, R2 = 40 + k * 12, ox = vX - 40 - k * 20, oy = vY - 70; a.push(`<g${K.anime ? "" : ` transform="translate(${f(ox + R1 * .5)} ${f(oy - R2 * .8)})"`}>${an(`<animateMotion dur="${13 + k * 4}s" begin="-${k * 5}s" repeatCount="indefinite" rotate="auto" path="M${f(ox + R1)} ${f(oy)}A${f(R1)} ${f(R2)} 0 1 ${k} ${f(ox - R1)} ${f(oy)}A${f(R1)} ${f(R2)} 0 1 ${k} ${f(ox + R1)} ${f(oy)}"/>`)}<g transform="scale(1.3)"><path d="M-10 0Q-4 -2 6 -1L10 -3L9 0L10 3L6 1Q-4 2 -10 0Z" fill="#141014"/><path d="M-2 0Q-6 -18 -16 -20Q-8 -10 -12 -4ZM-2 0Q-6 18 -16 20Q-8 10 -12 4Z" fill="#1E1418" stroke="#4A3A40" stroke-width=".5"/><path d="M4 -1l2 -3l1 3" fill="#2A1A22"/></g></g>`); }
    a.push(`<g${K.anime ? "" : ` transform="translate(${f(vX + 230)} ${f(vY - 60)}) rotate(-20)"`}>${an(`<animateMotion dur="15s" repeatCount="indefinite" rotate="auto" path="M-60 120Q${f(vX - 200)} ${f(vY - 260)} ${f(vX + 40)} ${f(vY - 90)}T${f(W + 80)} 300"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.05;.6;.7;1" dur="15s" repeatCount="indefinite"/>`)}${[[0, 0, 1.7], [-18, 14, 1.2], [-20, -16, 1.2]].map(([u, v, k]) => `<g transform="translate(${u} ${v}) scale(${k})"><path d="M-8 0Q0 -2 7 0L10 0L7 1.5Q0 2 -8 0Z" fill="#6A4A2A"/><path d="M0 0Q-6 -16 -20 -18Q-10 -10 -14 -2ZM0 0Q-6 16 -20 18Q-10 10 -14 2Z" fill="#8A5A2A" stroke="#4A2E18" stroke-width=".5"/><circle cx="7" cy="0" r="1.6" fill="#E8D8B0"/></g>`).join("")}</g>`);
    // ================= LE MORDOR : la Montagne du Destin et sa lave (fin du voyage) =================
    const [dX, dY] = pres(670, 540, 64, 78, .4);
    { const x = dX, y = dY; s.push(`<circle cx="${f(x)}" cy="${f(y - 20)}" r="110" fill="url(#an-lave)" opacity=".45"/>${G(x, y, 1.2)}<ellipse cx="0" cy="34" rx="70" ry="10" fill="#000" opacity=".35"/><path d="M-70 34Q-40 0 -20 -36L-12 -44L12 -44L20 -36Q40 0 70 34Z" fill="#3A2622" ${INK}/><path d="M12 -44L20 -36Q40 0 70 34L20 34Q24 0 8 -40Z" fill="#1E1210"/><path d="M-8 -16L-4 -20L4 -20L8 -16" fill="#2A1A16"/><rect x="-10" y="-22" width="20" height="8" fill="#14100E"/><path d="M-10 -18L-34 -4" stroke="#5A4A40" stroke-width="1.5"/></g>`);
      [`M${f(x - 6)} ${f(y - 50)}Q${f(x - 20)} ${f(y - 20)} ${f(x - 40)} ${f(y + 10)}T${f(x - 70)} ${f(y + 40)}`, `M${f(x + 6)} ${f(y - 50)}Q${f(x + 16)} ${f(y - 10)} ${f(x + 34)} ${f(y + 18)}T${f(x + 60)} ${f(y + 42)}`].forEach((d, k) => { s.push(`<path d="${d}" fill="none" stroke="#C8321A" stroke-width="5" stroke-linecap="round"/>`); a.push(`<path d="${d}" fill="none" stroke="#FFB347" stroke-width="2.4" stroke-dasharray="8 10" stroke-linecap="round">${an(`<animate attributeName="stroke-dashoffset" values="36;0" dur="${2 + k * .6}s" repeatCount="indefinite"/>`)}</path>`); });
      s.push(`<ellipse cx="${f(x)}" cy="${f(y - 52)}" rx="15" ry="5" fill="#FFB347" stroke="#C8321A"/>`);
      a.push(`<ellipse cx="${f(x)}" cy="${f(y - 52)}" rx="22" ry="12" fill="#FFE08A" opacity=".3">${an(`<animate attributeName="opacity" values=".15;.6;.15" dur="2.6s" repeatCount="indefinite"/>`)}</ellipse>`);
      for (let k = 0; k < 2; k++) a.push(`<ellipse cx="${f(x + k * 8)}" cy="${f(y - 60)}" rx="12" ry="8" fill="#3A302C" opacity="0">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${-20 - k * 16} -70" dur="${6 + k * 2}s" begin="${k * 3}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.6;0" dur="${6 + k * 2}s" begin="${k * 3}s" repeatCount="indefinite"/>`)}</ellipse>`);
      // l'anneau, au-dessus du gouffre, avec ses lettres de feu
      a.push(`<g transform="translate(${f(x + 30)} ${f(y - 74)})">${an(`<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -5;0 0" dur="3s" repeatCount="indefinite"/>`)}<circle r="13" fill="#FFE08A" opacity=".3"/><ellipse rx="8" ry="6" fill="none" stroke="url(#an-or)" stroke-width="3.4"/><ellipse rx="8" ry="6" fill="none" stroke="#FF6A2A" stroke-width=".6" stroke-dasharray="1.5 1 .5 1"/></g>`);
      bulle(x + 30, y - 98, "Mon précieux…", 10, 5);
      titre(x, y + 66, "LA MONTAGNE DU DESTIN", 9.5, "#FFD8A8", 0, "#1A0A06"); }
    // ================= BARAD-DÛR, la tour noire et son œil de flammes qui suit la course =================
    const [tX, tY] = pres(985, 610, 46, 60, .3);
    const oeilX = tX, oeilY = tY - 150;
    { const x = tX, y = tY; s.push(`${G(x, y, 1)}<ellipse cx="0" cy="40" rx="60" ry="10" fill="#000" opacity=".5"/><path d="M-50 40L-30 10L-20 -40L-14 -110L-22 -120L-10 -140H10L22 -120L14 -110L20 -40L30 10L50 40Z" fill="url(#an-tour)" ${INK}/>${[-90, -60, -30, 0].map(v => `<path d="M${f(-16 - (v + 120) * .04)} ${v}h${f(32 + (v + 120) * .08)}" stroke="#4A3A40" stroke-width="1"/>`).join("")}<path d="M-30 10l-14 -16l10 4zM30 10l14 -16l-10 4z" fill="#1A1418"/>
      <path d="M-10 -140L-22 -168L-4 -144ZM10 -140L22 -168L4 -144Z" fill="#14100E" ${INK}/>${[-70, -40].map(v => `<rect x="-3" y="${v}" width="6" height="8" fill="#C8321A" opacity=".8"/>`).join("")}</g>`);
      K.halo(oeilX, oeilY, 70, "#FF6A2A", .7); s.push(`<ellipse cx="${f(oeilX)}" cy="${f(oeilY)}" rx="22" ry="11" fill="url(#an-oeil)" stroke="#5A0A04" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map(q => { const t = q / 6 * TAU; return `<path d="M${f(oeilX + Math.cos(t) * 20)} ${f(oeilY + Math.sin(t) * 9)}q${f(Math.cos(t) * 8)} ${f(Math.sin(t) * 6 - 4)} ${f(Math.cos(t) * 14)} ${f(Math.sin(t) * 2)}" stroke="#FF8A2A" stroke-width="1.6" fill="none"/>`; }).join("")}`);
      s.push(`<text x="${f(x - 40)}" y="${f(y + 20)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10.5" fill="#F4C4A0" stroke="#1A0A06" stroke-width="2.6" paint-order="stroke">Barad-dûr</text>`); }
    // le regard suit la voiture de tête (même boucle que les pilotes)
    const DUR = 48, DEB = [4.2, 2.8, 1.4, 0];
    { const n = 32, pts = []; for (let q = 0; q <= n; q++) { const i = Math.floor(((q / n + DEB[0] / DUR) % 1) * K.N) % K.N; pts.push(K.P[i]); }
      const angs = []; pts.forEach(p => { let t = Math.atan2(p[1] - oeilY, p[0] - oeilX) * 180 / PI; if (angs.length) { const pr = angs[angs.length - 1]; while (t - pr > 180) t -= 360; while (t - pr < -180) t += 360; } angs.push(t); });
      const kt = pts.map((_, q) => q === n ? "1" : q === 0 ? "0" : (q / n).toFixed(4)).join(";"), pupille = pts.map(p => { const d = Math.hypot(p[0] - oeilX, p[1] - oeilY) || 1; return f((p[0] - oeilX) / d * 9) + " " + f((p[1] - oeilY) / d * 3); }).join(";");
      a.unshift(`<radialGradient id="an-faisceau" gradientUnits="userSpaceOnUse" cx="${f(oeilX)}" cy="${f(oeilY)}" r="700"><stop offset="0" stop-color="#FFD890" stop-opacity=".8"/><stop offset=".55" stop-color="#FF9A3A" stop-opacity=".28"/><stop offset="1" stop-color="#FF7A2A" stop-opacity="0"/></radialGradient>`);
      a.push(`<path class="an-suit" d="M${f(oeilX)} ${f(oeilY - 3)}L${f(oeilX + 900)} ${f(oeilY - 46)}L${f(oeilX + 900)} ${f(oeilY + 46)}L${f(oeilX)} ${f(oeilY + 3)}Z" fill="url(#an-faisceau)"${K.anime ? "" : ` transform="rotate(${f(angs[0])} ${f(oeilX)} ${f(oeilY)})"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="${angs.map(t => f(t) + " " + f(oeilX) + " " + f(oeilY)).join(";")}" keyTimes="${kt}" dur="${DUR}s" begin="0s" repeatCount="indefinite"/>`)}</path>`);
      a.push(`<g class="an-suit"${K.anime ? "" : ` transform="translate(${pupille.split(";")[0]})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="${pupille}" keyTimes="${kt}" dur="${DUR}s" repeatCount="indefinite"/>`)}<ellipse cx="${f(oeilX)}" cy="${f(oeilY)}" rx="2.6" ry="9" fill="#120404"/></g>`);
      bulle(oeilX - 70, oeilY - 30, "Un anneau pour les gouverner…", 13, 7); }
    // les marais des Morts : flaques et feux follets entre la route et le bord de la carte
    { const [x, y] = pres(600, 690, 30, 40, .3); for (let k = 0; k < 9; k++) s.push(`<ellipse cx="${f(x - 60 + r() * 120)}" cy="${f(y - 14 + r() * 26)}" rx="${f(8 + r() * 12)}" ry="${f(3 + r() * 3)}" fill="#2A3A34" stroke="#5A7A6A" stroke-width=".6"/>`); for (let k = 0; k < 12; k++) { const u = x - 64 + r() * 128, v = y - 16 + r() * 30; s.push(`<path d="M${f(u)} ${f(v)}l-2 -6M${f(u)} ${f(v)}l1 -7M${f(u)} ${f(v)}l3 -5" stroke="#6A7A5A" stroke-width=".8"/>`); }
      for (let k = 0; k < 4; k++) { const u = x - 50 + k * 32 + r() * 10, v = y - 8 + r() * 14; a.push(`<circle cx="${f(u)}" cy="${f(v)}" r="2.4" fill="#CFF8E0" opacity=".2">${an(`<animate attributeName="opacity" values=".1;.9;.1" dur="${(2.4 + k * .7).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); K.halo(u, v, 9, "#9AF4C8", .4); }
      s.push(`<text x="${f(x)}" y="${f(y + 22)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9" fill="#BFE8D0" stroke="#1A0A06" stroke-width="2.4" paint-order="stroke">les marais des Morts</text>`); }
    titre(840, 700, "MORDOR", 22, "#E2380E", 0, "#1A0A06");
    // la cendre qui tombe sur le Mordor
    for (let k = 0; k < 8; k++) { const x = 560 + r() * 520, y = 420 + r() * 300, d = (5 + r() * 5).toFixed(1); a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 1.4)}" fill="${r() < .4 ? "#FF8A2A" : "#B8A8A0"}" opacity=".7">${an(`<animateTransform attributeName="transform" type="translate" values="0 -30;${f((r() - .5) * 30)} 40" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); }
    // ================= LA COMMUNAUTÉ : le cartouche des 4 pilotes (vrais portraits posés par l'appli) =================
    const PORTR = [];
    { const px = 8, py = H - 112, pw = 258, ph = 104; s.push(`<path d="M${px + 10} ${py}h${pw - 20}q10 0 10 10v${ph - 20}q0 10 -10 10h-${pw - 20}q-10 0 -10 -10v-${ph - 20}q0 -10 10 -10z" fill="#F4E6C4" stroke="#6A440E" stroke-width="2"/><rect x="${px + 4}" y="${py + 4}" width="${pw - 8}" height="${ph - 8}" rx="8" fill="none" stroke="#B07A1E" stroke-width=".8" stroke-dasharray="4 2"/>`);
      s.push(`<text x="${px + pw / 2}" y="${py + 17}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10" letter-spacing="2.5" fill="#5A2A14">LA COMMUNAUTÉ</text>`);
      const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
      COULEURS_J.forEach((c, k) => { const x = px + 36 + k * 62, y = py + 52; PORTR.push({ k, x, y, r: 20 }); s.push(`${G(x, y, 1)}<circle r="25" fill="${c}" opacity=".3"/><circle r="22" fill="#3A2414" stroke="url(#an-or)" stroke-width="3"/><path d="M-14 22Q0 30 14 22L12 30H-12Z" fill="${c}" ${INK}/></g>`);
        s.push(`<text x="${x}" y="${py + 94}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10" fill="${mixHex(c, "#000000", .3)}">${NOMS[k]}</text>`);
        a.push(`<circle cx="${x}" cy="${y}" r="24" fill="none" stroke="${c}" stroke-width="2" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.25;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/>`)}</circle>`); }); }
    // ---- le titre sur un ruban de parchemin (en haut, entre les monts Brumeux et Edoras)
    { const x = 612, y = 24; s.push(`<path d="M${x - 128} ${y - 6}l-14 12l14 12h10v-24zM${x + 128} ${y - 6}l14 12l-14 12h-10v-24z" fill="#C8A86A" stroke="#6A440E" stroke-width="1.2"/><path d="M${x - 118} ${y - 13}Q${x} ${y - 21} ${x + 118} ${y - 13}V${y + 13}Q${x} ${y + 5} ${x - 118} ${y + 13}Z" fill="#F4E6C4" stroke="#6A440E" stroke-width="1.5"/>
      <text x="${x}" y="${y + 1}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="13" letter-spacing="3" fill="#7A1E14">LA TERRE DU MILIEU</text><text x="${x}" y="${y + 12}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="8" fill="#5A3A1A">de la Comté à la Montagne du Destin</text>`); }
    // ---- la rose des vents, cerclée de l'anneau (lettres de feu)
    { const [x, y] = pres(1045, 255, 30, 30, .2); s.push(`${G(x, y, 1)}<circle r="24" fill="none" stroke="url(#an-or)" stroke-width="4"/><circle r="24" fill="none" stroke="#FF6A2A" stroke-width=".8" stroke-dasharray="2 1.2 .6 1.2"/>${[0, 90, 180, 270].map(t => `<path d="M0 0L-4 -4L0 -20L4 -4Z" fill="#6A440E" transform="rotate(${t})"/>`).join("")}${[45, 135, 225, 315].map(t => `<path d="M0 0L-2.5 -2.5L0 -13L2.5 -2.5Z" fill="#B07A1E" transform="rotate(${t})"/>`).join("")}<text y="-27" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="9" fill="#F4C4A0">N</text></g>`); }
    // ---- la piste : la route du voyage (chemin de terre à l'encre, trait rouge du périple)
    K.route([["#000", 30, ` opacity=".35" filter="url(#an-flou)"`], ["#3A2414", 24], ["#E8D3A0", 19], ["#D4BC86", 19, ` stroke-dasharray="2 5" opacity=".7"`], ["#A8281E", 2.2, ` stroke-dasharray="9 7"`]]);
    // bornes du voyage sur le bord de la route
    [["Hobbitebourg", .02], ["Bree", .2], ["Caradhras", .45], ["la Porte Noire", .74]].forEach(([txt, fr]) => { const i = Math.floor(fr * K.N), [nx, ny] = K.nrm(i); let best = null; for (const sg of [1, -1]) { const u = K.P[i][0] + nx * 26 * sg, v = K.P[i][1] + ny * 26 * sg; if (!best && K.dT(u, v) > 18 && !K.occ.some(o => Math.hypot(o[0] - u, o[1] - v) < o[2] * .7)) best = [u, v]; } if (best) { s.push(`<circle cx="${f(K.P[i][0])}" cy="${f(K.P[i][1])}" r="3.2" fill="#A8281E" stroke="#F1E2BC"/>`); legende(best[0], best[1] + 3, txt, "#5A2A14", 8.5); } });
    K.depart();
    // les 4 pilotes : 4 voyageurs encapuchonnés aux couleurs des 4 (la communauté sur la route)
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.05 + DEB[k] / DUR, `<g transform="scale(1.15)"><ellipse cx="-1" cy="1" rx="7" ry="5" fill="#000" opacity=".3"/><path d="M-7 -5Q-9 0 -7 5L4 3Q6 0 4 -3Z" fill="${c}" stroke="#1A1410" stroke-width=".9"/><circle cx="3" cy="0" r="3.4" fill="${mixHex(c, "#000000", .35)}" stroke="#1A1410" stroke-width=".7"/><circle cx="4.6" cy="0" r="1.5" fill="${PEAU}"/><path d="M-1 -4l-3 -3M-1 4l-3 3" stroke="#1A1410" stroke-width="1"/></g>`, DUR, DEB[k])));
        const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#an-par)"/>`, "#5A3A1A", .1); RES.portraits = PORTR; RES.lieux = { destin: [dX, dY - 44], oeil: [oeilX, oeilY] }; return RES;
  }
  /* ---------- Décembre · Le Garage des rêves (tour de chauffe) : l'immense atelier vu du dessus — v3 ---------- */
  /* ---------- Décembre · Le Garage des rêves (v4 : grande scène illustrée, vue plongeante, au niveau de l'Arène) ----------
     Le hall du garage, la nuit de Noël, vu un peu de haut : au fond, la verrière sur la ville enneigée et l'enseigne au néon ;
     la grande porte ouverte (dans l'encoche du tracé) sur le sapin de Noël et la neige. En haut à gauche, les 4 box des pilotes
     en perspective (murs à leur couleur, monoplace de face, cadre-portrait au mur : l'appli y pose les vrais portraits).
     En bas, sous les projecteurs : la voiture à remonter le temps (portes papillon ouvertes, éclairs, 88 mph), la voiture
     mystère sous sa bâche « 2027 ? » au centre et le chef d'équipe, la voiture noire au scanner rouge (de face).
     À droite : la coccinelle n°53 et la voiture rouge n°95 qui sourit. Mécaniciens au travail, sol ciré qui reflète tout. */
  function peindreGarage4(T, Z, def) {
    const K = kit(T, def, 1226, "g4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#0C0D11" stroke-width="1.6" stroke-linejoin="round"`, IN1 = `stroke="#0C0D11" stroke-width="1" stroke-linejoin="round"`;
    const G = (x, y, sc, rot, sy) => `<g transform="translate(${f(x)} ${f(y)})${sc && (sc !== 1 || sy) ? ` scale(${sc}${sy ? " " + sy : ""})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const O0 = v => K.anime ? 0 : (v === undefined ? 1 : v);
    const NOMS = ["Théo", "Kévin", "Clément", "Devlin"], CJ = COULEURS_J, PEAU = "#C98E68";
    const txt = (x, y, t, sz, c, o) => { o = o || {}; return `<text x="${f(x)}" y="${f(y)}" text-anchor="${o.ancre || "middle"}" font-family="${o.police || "Helvetica, Arial, sans-serif"}" font-weight="${o.gras || 900}"${o.ital ? ` font-style="italic"` : ""} font-size="${sz}" letter-spacing="${o.esp || 0}" fill="${c}"${o.tour ? ` stroke="${o.tour}" stroke-width="${o.tw || 3}" paint-order="stroke"` : ""}${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(y)})"` : ""}>${t}</text>`; };
    const bulle = (x, y, t, du, deb) => { const w = t.length * 7.4 + 22; a.push(`<g opacity="${O0()}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.1;.15;.8;.86;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - w / 2)}" y="${f(y - 15)}" width="${f(w)}" height="24" rx="12" fill="#FFFBEF" stroke="#0C0D11" stroke-width="1.6"/><path d="M${f(x - 6)} ${f(y + 8.5)}l4 9l7 -9" fill="#FFFBEF" stroke="#0C0D11" stroke-width="1.6" stroke-linejoin="round"/><path d="M${f(x - 5)} ${f(y + 7.5)}h10" stroke="#FFFBEF" stroke-width="3"/>${txt(x, y + 2, t, 13, "#14161C", { police: "Georgia, serif", gras: 700, ital: 1 })}</g>`); };
    // ---- dégradés
    const lin = (id, st, x2, y2) => s.push(`<linearGradient id="g4-${id}" x1="0" y1="0" x2="${x2 === undefined ? 0 : x2}" y2="${y2 === undefined ? 1 : y2}">${st.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ""}/>`).join("")}</linearGradient>`);
    const rad = (id, st, ex) => s.push(`<radialGradient id="g4-${id}" ${ex || 'r="50%"'}>${st.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ""}/>`).join("")}</radialGradient>`);
    lin("ciel", [[0, "#0B1430"], [.6, "#1E2E58"], [1, "#3A4E7E"]]);
    lin("inox", [[0, "#F4F7FA"], [.38, "#B9C1CC"], [.55, "#8A93A0"], [.75, "#C9D0D9"], [1, "#6E7784"]]);
    lin("rouge", [[0, "#FF6A4A"], [.45, "#E0242C"], [1, "#7A0C14"]]);
    lin("blanc", [[0, "#FFFFFF"], [.6, "#E4E8EE"], [1, "#9AA4B2"]]);
    lin("noir", [[0, "#4A505A"], [.3, "#1C1F25"], [1, "#050608"]]);
    lin("bache", [[0, "#9AA6BC"], [.45, "#66728A"], [1, "#2E3648"]]);
    lin("vitre", [[0, "#6A8AB8"], [.5, "#1A2840"], [1, "#0C1422"]]);
    lin("mur", [[0, "#2A2730"], [1, "#16141A"]]);
    lin("bois", [[0, "#8A5A30"], [1, "#4A2E18"]]);
    lin("sapin", [[0, "#3E8A4E"], [1, "#163A22"]], 1, 0);
    lin("neige", [[0, "#F6FAFF"], [1, "#B8C8E0"]]);
    lin("podium", [[0, "#3A3640"], [1, "#121016"]]);
    lin("or", [[0, "#FFF2B8"], [.4, "#F2C64A"], [1, "#8A5A12"]], 1, 1);
    rad("chaud", [[0, "#FFD89A", .7], [.45, "#FFA850", .26], [1, "#FFA850", 0]]);
    rad("froid", [[0, "#9FD0FF", .4], [1, "#9FD0FF", 0]]);
    rad("sol", [[0, "#2E282E"], [.55, "#1C1A22"], [1, "#0E0D12"]], 'cx="50%" cy="58%" r="70%"');
    rad("lune", [[0, "#FFFBE8"], [.6, "#F2E6B8"], [1, "#F2E6B8", 0]]);
    s.push(`<pattern id="g4-hach" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#F2C230"/><rect width="6" height="12" fill="#121418"/></pattern>`);
    // flaque de lumière chaude au sol, cône de projecteur
    const flaque = (x, y, rx, ry, op, id) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#g4-${id || "chaud"})" opacity="${op === undefined ? 1 : op}" style="mix-blend-mode:screen"/>`);
    let nCone = 0;
    const cone = (x0, y0, x1, y1, w, c, op, dest) => { const id = "g4-cn" + nCone++, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
      s.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset="1" stop-color="${c}" stop-opacity=".06"/></linearGradient>`);
      (dest || s).push(`<path d="M${f(x0 - nx * .08)} ${f(y0 - ny * .08)}L${f(x1 - nx)} ${f(y1 - ny)}Q${f(x1 + dx / l * w * .25)} ${f(y1 + dy / l * w * .25)} ${f(x1 + nx)} ${f(y1 + ny)}L${f(x0 + nx * .08)} ${f(y0 + ny * .08)}Z" fill="url(#${id})" opacity="${op}" style="mix-blend-mode:screen"/>`); };
    // reflet d'un objet dans le sol ciré (copie retournée, écrasée, pâle)
    const reflet = (x, y, sc, corps, op) => s.push(`<g transform="translate(${f(x)} ${f(y)}) scale(${sc} ${f(-Math.abs(sc) * .42)})" opacity="${op || .16}">${corps}</g>`);
    const ombreSol = (x, y, rx, ry, op) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#000" opacity="${op || .55}" filter="url(#g4-flou)"/>`);

    // ---- roue vue de côté (jante chromée)
    const roueC = (x, y, R, jante, rayons) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#111215" ${IN1}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .86)}" fill="none" stroke="#2A2C32" stroke-width="${f(R * .1)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .6)}" fill="${jante || "url(#g4-inox)"}" ${IN1}/>${Array.from({ length: rayons || 5 }, (_, q) => { const t = q / (rayons || 5) * TAU; return `<path d="M${f(x)} ${f(y)}l${f(Math.cos(t) * R * .55)} ${f(Math.sin(t) * R * .55)}" stroke="#5A626E" stroke-width="${f(R * .1)}"/>`; }).join("")}<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * .16)}" fill="#3A3F48"/><path d="M${f(x - R * .7)} ${f(y - R * .45)}a${f(R * .8)} ${f(R * .8)} 0 0 1 ${f(R * .9)} ${f(-R * .38)}" stroke="#FFF" stroke-opacity=".35" stroke-width="1.4" fill="none"/>`;
    const passage = (x, R) => `<path d="M${f(x - R * 1.25)} 0A${f(R * 1.25)} ${f(R * 1.25)} 0 0 1 ${f(x + R * 1.25)} 0Z" fill="#08090B"/>`;

    // ---- les voitures de légende (dessinées par nous, vues de côté, sol à y = 0, avant vers +x)
    /** la voiture à remonter le temps : inox, en coin, portes papillon ouvertes */
    const deloreane = () => { const B = "M-100 -14L-101 -40L-62 -47L-42 -63L8 -63L42 -45L100 -36L104 -24L101 -11L-96 -9Z";
      return `${passage(-62, 17)}${passage(62, 17)}
      <path d="M-36 -63L4 -63L22 -98L-18 -112Z" fill="#9AA3AE" opacity=".55" ${IN1}/><path d="M-40 -63L4 -63L-10 -104Q-30 -126 -58 -112L-62 -96Z" fill="url(#g4-inox)" ${INK}/><path d="M-36 -68L-2 -68L-12 -98Q-28 -114 -48 -104L-52 -94Z" fill="#2E323A"/><path d="M-30 -96Q-22 -100 -16 -94L-20 -82L-36 -84Z" fill="url(#g4-vitre)" ${IN1}/><path d="M-40 -74L-6 -72" stroke="#5A3A2A" stroke-width="3"/><path d="M-56 -110Q-30 -124 -10 -104" stroke="#FFF" stroke-opacity=".6" stroke-width="1.6" fill="none"/>
      <path d="${B}" fill="url(#g4-inox)" ${INK}/>
      ${Array.from({ length: 9 }, (_, q) => `<path d="M-96 ${-38 + q * 3.2}H98" stroke="#FFF" stroke-opacity="${q % 2 ? .1 : .22}" stroke-width=".8"/>`).join("")}
      <path d="M-100 -24L101 -22L101 -11L-96 -9Z" fill="#23262C"/><path d="M-98 -19H100" stroke="#3E434C" stroke-width="1.2"/>
      <path d="M-38 -60L4 -60L34 -46L-38 -46Z" fill="#0A0C10"/><path d="M-30 -46Q-30 -58 -20 -58Q-14 -58 -14 -46Z" fill="#3A3E46"/><path d="M-8 -50l14 2" stroke="#6A7280" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M-62 -48L-44 -61M-66 -47L-48 -60M-70 -46L-52 -59M-74 -45L-56 -58M-78 -44L-60 -57" stroke="#2A2E36" stroke-width="1.6"/>
      <rect x="-92" y="-56" width="20" height="9" rx="2" fill="#3A3F48" ${IN1}/><rect x="-88" y="-66" width="10" height="11" rx="3" fill="#C9D0D9" ${IN1}/><circle cx="-83" cy="-60" r="2.2" fill="#FF8A2A"/>
      <path d="M-101 -36q-8 0 -8 6q0 6 8 6" stroke="#5A6270" stroke-width="3" fill="none"/>${[0, 1, 2].map(q => `<rect x="${-99 + q * 9}" y="-30" width="4" height="8" rx="1" fill="#2A6AC8" stroke="#9FDCFF" stroke-width=".8"/>`).join("")}
      <rect x="94" y="-33" width="9" height="6" rx="1" fill="#FFF6C8" ${IN1}/><rect x="-102" y="-38" width="4" height="7" fill="#E5262E"/>
      ${roueC(-62, -2, 16)}${roueC(62, -2, 16)}`; };
    /** la voiture rouge n°95 qui sourit (un œil dans le pare-brise, éclair sur le flanc) */
    const rouge95 = mi => `${passage(-56, 16)}${passage(56, 16)}
      <path d="M-92 -12Q-98 -30 -86 -36L-52 -41Q-36 -66 -4 -66Q22 -66 34 -46L76 -40Q96 -35 95 -20L92 -10Z" fill="url(#g4-rouge)" ${INK}/>
      <path d="M-84 -34L-52 -39Q-36 -62 -4 -62Q18 -62 28 -48" stroke="#FFF" stroke-opacity=".45" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <rect x="-100" y="-50" width="20" height="5" rx="1.5" fill="#B0141C" ${IN1}/><path d="M-90 -45v7" stroke="#0C0D11" stroke-width="2.4"/>
      <path d="M-38 -58Q-24 -61 -6 -61L-6 -44L-44 -44Z" fill="url(#g4-vitre)" ${IN1}/>
      <path d="M0 -61Q20 -61 32 -46L0 -44Z" fill="#FFFFFF" ${IN1}/><ellipse cx="20" cy="-51.5" rx="6.5" ry="7" fill="#3A84D8"/><circle cx="22" cy="-51.5" r="3.4" fill="#0C0D11"/><circle cx="20.5" cy="-54" r="1.6" fill="#FFF"/><path d="M-1 -62Q16 -66 33 -50" stroke="#B0141C" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M-74 -18L-34 -34L-38 -24L18 -38L-6 -18L-2 -26L-60 -14Z" fill="#FFC21E" stroke="#8A4A0A" stroke-width="1"/>
      <circle cx="-26" cy="-26" r="9.5" fill="#FFF" ${IN1}/><g transform="translate(-26 0) scale(${mi ? -1 : 1} 1)">${txt(0, -22, "95", 10, "#C8141C")}</g>
      <path d="M74 -22Q86 -14 96 -24" stroke="#0C0D11" stroke-width="2.6" fill="#FFF" stroke-linecap="round"/><path d="M80 -21Q87 -17 93 -22" stroke="#B0141C" stroke-width="1.2" fill="none"/>
      <ellipse cx="90" cy="-31" rx="4" ry="2.6" fill="#FFF6C8" ${IN1}/>
      ${roueC(-56, -1, 15, "#C8141C", 6)}${roueC(56, -1, 15, "#C8141C", 6)}`;
    /** la coccinelle blanche n°53 (bande rouge et bleue sur le dôme) */
    const coccinelle = mi => `${passage(-52, 15)}${passage(52, 15)}
      <path d="M-84 -14Q-90 -34 -70 -40Q-52 -74 -4 -76Q38 -76 58 -46Q80 -42 84 -22L82 -12Z" fill="url(#g4-blanc)" ${INK}/>
      <path d="M-80 -38Q-52 -82 -4 -81Q42 -80 62 -48" stroke="#D8232A" stroke-width="7" fill="none"/><path d="M-80 -38Q-52 -82 -4 -81Q42 -80 62 -48" stroke="#FFF" stroke-width="2" fill="none"/><path d="M-76 -32Q-50 -72 -4 -72Q36 -72 56 -46" stroke="#1E4AA8" stroke-width="3.5" fill="none"/>
      <path d="M-46 -46Q-30 -68 -4 -68Q20 -68 36 -46Z" fill="url(#g4-vitre)" ${IN1}/><path d="M-6 -68V-46" stroke="#E4E8EE" stroke-width="3"/>
      <path d="M26 -12Q28 -40 52 -40Q76 -40 80 -12Z" fill="#F2F4F8" ${INK}/><path d="M-80 -12Q-78 -40 -52 -40Q-28 -40 -26 -12Z" fill="#F2F4F8" ${INK}/>
      <rect x="-28" y="-16" width="56" height="5" rx="2" fill="#3A3F48"/><circle cx="72" cy="-33" r="4.5" fill="#FFF6C8" ${IN1}/><rect x="-86" y="-30" width="4" height="7" rx="1" fill="#E5262E"/>
      <circle cx="-6" cy="-28" r="11" fill="#FFF" ${IN1}/><g transform="translate(-6 0) scale(${mi ? -1 : 1} 1)">${txt(0, -23.5, "53", 12, "#0C0D11")}</g>
      ${roueC(-52, -1, 14, "url(#g4-inox)", 8)}${roueC(52, -1, 14, "url(#g4-inox)", 8)}`;
    /** la voiture noire au scanner rouge, vue de face (le scanner est animé à part) */
    const noire = () => `<rect x="-86" y="-27" width="20" height="27" rx="5" fill="#0E0F12"/><rect x="66" y="-27" width="20" height="27" rx="5" fill="#0E0F12"/>
      <path d="M-90 -12L-90 -36Q-88 -46 -72 -48L72 -48Q88 -46 90 -36L90 -12Q0 -6 -90 -12Z" fill="url(#g4-noir)" ${INK}/>
      <path d="M-72 -48L-52 -62L52 -62L72 -48Z" fill="#23262E" ${INK}/><path d="M-30 -60L30 -60L36 -50L-36 -50Z" fill="#2E323B"/>
      <path d="M-48 -62L-38 -90L38 -90L48 -62Z" fill="url(#g4-vitre)" ${INK}/><path d="M-30 -86L-12 -86L-28 -64L-42 -64Z" fill="#FFF" opacity=".16"/><path d="M-38 -90H38" stroke="#3A3F48" stroke-width="3"/>
      <path d="M-66 -30L66 -30L62 -21L-62 -21Z" fill="#050506" ${IN1}/><path d="M-84 -42h22M62 -42h22" stroke="#4A505A" stroke-width="3" stroke-linecap="round"/>
      <rect x="-14" y="-17" width="28" height="9" rx="1.5" fill="#E8ECF2" ${IN1}/>${txt(0, -10, "K·2000", 6.5, "#0C0D11")}
      <path d="M-88 -38Q0 -44 88 -38" stroke="#FFF" stroke-opacity=".25" stroke-width="1.5" fill="none"/>`;
    /** monoplace vue de face (sol à y = 0) */
    const f1Face = (c, c2, num) => `<rect x="-27" y="-46" width="54" height="7" rx="1.5" fill="${c2}" ${IN1}/><path d="M-27 -46v14M27 -46v14" stroke="${c2}" stroke-width="4"/>
      <rect x="-42" y="-27" width="15" height="27" rx="5" fill="#111215"/><rect x="27" y="-27" width="15" height="27" rx="5" fill="#111215"/><path d="M-40 -20h11M-40 -12h11M29 -20h11M29 -12h11" stroke="#2C2E34" stroke-width="1.5"/>
      <path d="M-27 -16L-12 -20M27 -16L12 -20M-27 -8L-10 -12M27 -8L10 -12" stroke="#2A2C30" stroke-width="2"/>
      <path d="M-24 -10L-22 -28Q-14 -32 0 -32Q14 -32 22 -28L24 -10Z" fill="${c}" ${INK}/><path d="M-9 -30L0 -46L9 -30Z" fill="${c}" ${INK}/><ellipse cx="0" cy="-38" rx="3" ry="4" fill="#0C0D11"/>
      <path d="M-12 -30Q0 -42 12 -30" stroke="#1A1C20" stroke-width="3" fill="none"/><path d="M0 -40v8" stroke="#1A1C20" stroke-width="2.4"/>
      <path d="M-6 -24L6 -24L4 -8L-4 -8Z" fill="${mixHex(c, "#FFFFFF", .25)}" ${IN1}/>
      <rect x="-44" y="-9" width="88" height="6" rx="2" fill="${c2}" ${IN1}/><rect x="-46" y="-13" width="4" height="12" fill="${c2}" ${IN1}/><rect x="42" y="-13" width="4" height="12" fill="${c2}" ${IN1}/>
      ${num ? `<circle cx="0" cy="-18" r="3.6" fill="#FFF"/>${txt(0, -16, num, 5, "#0C0D11")}` : ""}<path d="M-20 -27Q0 -30 20 -27" stroke="#FFF" stroke-opacity=".35" stroke-width="1.4" fill="none"/>`;
    /** monoplace vue de dessus (pour le tour de chauffe) */
    const f1Dessus = c => { const c2 = mixHex(c, "#000000", .45); return `<ellipse cx="2" cy="4" rx="56" ry="27" fill="#000" opacity=".38"/>${[[-30, -24, 18, 11], [-30, 24, 18, 11], [30, -21, 15, 9], [30, 21, 15, 9]].map(([x, y, l, w]) => `<rect x="${x - l / 2}" y="${y - w / 2}" width="${l}" height="${w}" rx="3" fill="#141518"/>`).join("")}<path d="M-40 -11L-6 -15Q8 -15 14 -8L46 -4Q50 0 46 4L14 8Q8 15 -6 15L-40 11Z" fill="${c}" ${INK}/><rect x="42" y="-25" width="8" height="50" rx="2" fill="${c2}"/><rect x="-50" y="-23" width="11" height="46" rx="2" fill="${c2}"/><circle cx="-2" cy="0" r="5" fill="${c2}"/>`; };
    /** un mécanicien (silhouette, combinaison c) : pose 'debout', 'bras' (bras levé), 'accroupi', 'porte' (porte un pneu), 'soude' */
    const meca = (c, pose, casq) => { const d = mixHex(c, "#000000", .35), k = casq || "#1A1C22";
      const tete = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="${PEAU}" ${IN1}/><path d="M${f(x - 7.5)} ${f(y - 1)}Q${f(x)} ${f(y - 13)} ${f(x + 7.5)} ${f(y - 1)}Z" fill="${k}" ${IN1}/><path d="M${f(x + 5)} ${f(y - 2)}l8 1.5" stroke="${k}" stroke-width="2.6" stroke-linecap="round"/>`;
      if (pose === "accroupi") return `<ellipse cx="0" cy="0" rx="20" ry="4" fill="#000" opacity=".45"/><path d="M-10 0V-10L4 -18M4 0L10 -12L0 -20" stroke="${d}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="-14" y="-3" width="10" height="4" rx="1.5" fill="#0C0D11"/><rect x="6" y="-3" width="10" height="4" rx="1.5" fill="#0C0D11"/><path d="M-8 -16L-6 -40Q0 -44 8 -40L12 -18Z" fill="${c}" ${INK}/><path d="M8 -36L22 -28" stroke="${c}" stroke-width="6" stroke-linecap="round"/>${tete(4, -48)}`;
      const jambes = `<ellipse cx="0" cy="0" rx="17" ry="4" fill="#000" opacity=".45"/><rect x="-9" y="-31" width="7" height="28" rx="2" fill="${d}" ${IN1}/><rect x="2" y="-31" width="7" height="28" rx="2" fill="${d}" ${IN1}/><rect x="-11" y="-4" width="10" height="4" rx="1.5" fill="#0C0D11"/><rect x="1" y="-4" width="11" height="4" rx="1.5" fill="#0C0D11"/>`;
      const corps = `<path d="M-11 -29L-12 -54Q-12 -61 -5 -61L5 -61Q12 -61 12 -54L11 -29Z" fill="${c}" ${INK}/><path d="M-11 -33H11" stroke="#0C0D11" stroke-opacity=".5" stroke-width="2"/><path d="M-3 -58V-36" stroke="#0C0D11" stroke-opacity=".3" stroke-width="1.2"/>`;
      if (pose === "soude") return jambes + corps + `<path d="M8 -55L20 -46L30 -48" stroke="${c}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M-8 -55L6 -42L24 -44" stroke="${d}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M28 -48l10 2" stroke="#9AA2AE" stroke-width="3"/><circle cx="0" cy="-68" r="7" fill="${PEAU}" ${IN1}/><rect x="1" y="-77" width="10" height="16" rx="2" fill="#2A2E36" ${IN1}/><rect x="6" y="-72" width="5" height="4" fill="#7FE0FF"/>`;
      if (pose === "porte") return jambes + corps + `<path d="M-10 -55L-2 -42M10 -55L16 -42" stroke="${c}" stroke-width="6" stroke-linecap="round"/><circle cx="6" cy="-40" r="14" fill="#141518" ${IN1}/><circle cx="6" cy="-40" r="7.5" fill="url(#g4-inox)"/><circle cx="6" cy="-40" r="2.4" fill="#3A3F48"/>` + tete(0, -68);
      if (pose === "bras") return jambes + corps + `<path d="M-10 -55L-15 -33" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` + tete(0, -68);
      return jambes + corps + `<path d="M-10 -55L-15 -33M10 -55L15 -33" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` + tete(0, -68); };
    /** pile de pneus vue de face (n pneus), liseré de couleur */
    const pilePneus = (x, y, n, c) => { let o = `<ellipse cx="${f(x)}" cy="${f(y)}" rx="26" ry="6" fill="#000" opacity=".5"/>`; for (let k = 0; k < n; k++) { const v = y - k * 13; o += `<path d="M${f(x - 22)} ${f(v)}V${f(v - 11)}Q${f(x)} ${f(v - 17)} ${f(x + 22)} ${f(v - 11)}V${f(v)}Q${f(x)} ${f(v + 6)} ${f(x - 22)} ${f(v)}Z" fill="#17181C" ${IN1}/><path d="M${f(x - 22)} ${f(v - 6)}Q${f(x)} ${f(v)} ${f(x + 22)} ${f(v - 6)}" stroke="${c || "#2C2E34"}" stroke-width="2" fill="none"/>`; }
      const v = y - n * 13; return o + `<ellipse cx="${f(x)}" cy="${f(v + 2)}" rx="22" ry="6" fill="#26282E" ${IN1}/><ellipse cx="${f(x)}" cy="${f(v + 2)}" rx="10" ry="2.8" fill="#08090B"/>`; };

    // =============== 1. le sol ciré du hall, avec ses dalles et ses taches
    s.push(`<rect width="${W}" height="${H}" fill="url(#g4-sol)"/>`);
    for (let k = 1; k < 14; k++) s.push(`<path d="M${f(k * 80 - 20)} 96L${f(540 + (k * 80 - 20 - 540) * 1.25)} ${H}" stroke="#0E0D12" stroke-opacity=".35" stroke-width="1.2"/>`);
    [140, 200, 270, 350, 440, 540, 650].forEach(y => s.push(`<path d="M0 ${y}H${W}" stroke="#0E0D12" stroke-opacity=".3" stroke-width="1.2"/>`));
    for (let k = 0; k < 22; k++) { const x = r() * W, y = 120 + r() * 580; if (K.dT(x, y) < 26) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(5 + r() * 14)}" ry="${f(2 + r() * 4)}" fill="#08070A" opacity="${(.3 + r() * .3).toFixed(2)}"/>`); }

    // =============== 2. au fond : la verrière sur la ville enneigée (bande du haut) et la grande porte ouverte (encoche)
    const DX0 = 577, DX1 = 685, DY1 = 352;   // l'encoche : la porte du hangar ouverte sur la nuit
    s.push(`<rect x="0" y="0" width="${W}" height="100" fill="url(#g4-mur)"/>`);
    s.push(`<rect x="10" y="7" width="${DX0 - 22}" height="84" fill="url(#g4-ciel)"/><rect x="${DX1 + 12}" y="7" width="${W - DX1 - 22}" height="84" fill="url(#g4-ciel)"/>`);
    s.push(`<path d="M${DX0} 0H${DX1}V${DY1 - 30}Q${(DX0 + DX1) / 2} ${DY1 + 10} ${DX0} ${DY1 - 30}Z" fill="url(#g4-ciel)"/>`);
    // la lune et les étoiles
    s.push(`<circle cx="905" cy="34" r="30" fill="url(#g4-lune)" opacity=".5"/><circle cx="905" cy="34" r="13" fill="#FFF8DC"/><circle cx="910" cy="30" r="11" fill="#2A3A66" opacity=".22"/>`);
    for (let k = 0; k < 60; k++) { const x = 12 + r() * (W - 24), y = 9 + r() * 46; if (x > DX0 - 14 && x < DX1 + 14) continue; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.5 + r() * .9)}" fill="#FFF" opacity="${(.3 + r() * .6).toFixed(2)}"/>`); }
    // les toits enneigés de la ville, fenêtres allumées
    { let d = "M10 92", x = 10; const toits = []; while (x < W - 10) { const w = 30 + r() * 46, h = 18 + r() * 30; toits.push([x, w, h]); x += w; }
      toits.forEach(([x, w, h], k) => { if (x + w > DX0 - 12 && x < DX1 + 12) return; const y = 92 - h, pointu = k % 3 === 1;
        s.push(`<path d="M${f(x)} 92V${f(y + (pointu ? 10 : 0))}${pointu ? `L${f(x + w / 2)} ${f(y - 6)}L${f(x + w)} ${f(y + 10)}` : `H${f(x + w)}`}V92Z" fill="${k % 2 ? "#141C34" : "#0F1628"}"/>`);
        s.push(pointu ? `<path d="M${f(x - 1)} ${f(y + 11)}L${f(x + w / 2)} ${f(y - 7)}L${f(x + w + 1)} ${f(y + 11)}L${f(x + w - 4)} ${f(y + 12)}L${f(x + w / 2)} ${f(y - 2)}L${f(x + 4)} ${f(y + 12)}Z" fill="#E8F0FC"/>` : `<rect x="${f(x - 1)}" y="${f(y - 3)}" width="${f(w + 2)}" height="5" rx="2.5" fill="#E8F0FC"/>`);
        for (let q = 0; q < 3; q++) if (r() < .6) s.push(`<rect x="${f(x + 5 + r() * (w - 14))}" y="${f(y + 14 + r() * Math.max(2, h - 24))}" width="5" height="6" fill="${r() < .5 ? "#FFD27A" : "#FFB45A"}" opacity=".9"/>`); }); }
    // montants de la verrière (acier), appui
    for (let x = 10; x <= DX0 - 12; x += 54) s.push(`<rect x="${f(Math.min(x, DX0 - 16))}" y="5" width="5" height="88" fill="#3A3F48"/>`);
    for (let x = DX1 + 12; x <= W - 10; x += 54) s.push(`<rect x="${f(x - 2)}" y="5" width="5" height="88" fill="#3A3F48"/>`);
    s.push(`<rect x="8" y="46" width="${DX0 - 18}" height="3" fill="#3A3F48"/><rect x="${DX1 + 10}" y="46" width="${W - DX1 - 18}" height="3" fill="#3A3F48"/>`);
    s.push(`<rect x="0" y="0" width="${W}" height="7" fill="#2A2E36"/><rect x="0" y="91" width="${W}" height="9" fill="#2C2930"/><rect x="0" y="91" width="${W}" height="2" fill="#4A4550"/>`);
    // la porte : le sol enneigé dehors, les traces de pneus, le rideau métallique roulé en haut, les montants rayés
    s.push(`<path d="M${DX0} 232Q610 214 640 222Q665 228 ${DX1} 212V${DY1 - 30}Q${(DX0 + DX1) / 2} ${DY1 + 10} ${DX0} ${DY1 - 30}Z" fill="url(#g4-neige)"/><path d="M${DX0} 262Q620 250 ${DX1} 258" stroke="#C8D6EA" stroke-width="2" fill="none"/>`);
    s.push(`<path d="M${DX0 + 6} 120L${DX0 + 20} 140L${DX0 + 34} 128L${DX0 + 48} 150L${DX0 + 60} 136L${DX0 + 76} 158L${DX0 + 92} 132L${DX1} 150V232Q665 228 640 222Q610 214 ${DX0} 232Z" fill="#1C2A4E" opacity=".9"/><path d="M${DX0 + 6} 120L${DX0 + 20} 140L${DX0 + 34} 128L${DX0 + 48} 150L${DX0 + 60} 136L${DX0 + 76} 158L${DX0 + 92} 132L${DX1} 150" stroke="#E8F0FC" stroke-width="2.4" fill="none"/>`);
    s.push(`<rect x="${DX0 - 4}" y="0" width="${DX1 - DX0 + 8}" height="20" fill="#5A606A" ${IN1}/>${[4, 9, 14].map(v => `<path d="M${DX0 - 4} ${v}H${DX1 + 4}" stroke="#3A3F48" stroke-width="1.4"/>`).join("")}<rect x="${DX0 - 4}" y="18" width="${DX1 - DX0 + 8}" height="5" fill="url(#g4-hach)"/>`);
    s.push(`<rect x="${DX0 - 8}" y="0" width="8" height="100" fill="url(#g4-hach)" ${IN1}/><rect x="${DX1}" y="0" width="8" height="100" fill="url(#g4-hach)" ${IN1}/>`);
    // =============== 3. le sapin de Noël dehors, dans l'encadrement de la porte (guirlande aux couleurs des pilotes)
    const SX = 631, SY0 = 40, SY1 = 300;
    flaque(SX, 300, 90, 30, .8);
    s.push(`<rect x="${SX - 7}" y="${SY1 - 8}" width="14" height="22" fill="#5A3A1E" ${IN1}/>`);
    const etages = [[SY0 + 22, 18, SY0 + 72], [SY0 + 60, 28, SY0 + 122], [SY0 + 108, 37, SY0 + 176], [SY0 + 160, 46, SY0 + 230], [SY0 + 212, 54, SY1]];
    etages.forEach(([y0, demi, y1], k) => { const pts = []; for (let q = 0; q <= 8; q++) { const u = -demi + q * demi / 4; pts.push(`${f(SX + u)} ${f(y1 + (q % 2 ? -5 : 2))}`); }
      s.push(`<path d="M${SX} ${y0 - 8}L${f(SX + demi)} ${f(y1)}L${pts.reverse().join("L")}Z" fill="url(#g4-sapin)" ${INK}/><path d="M${SX} ${y0 - 6}L${f(SX - demi * .8)} ${f(y1 - 4)}" stroke="#5AB46A" stroke-width="2" opacity=".5"/>`);
      s.push(`<path d="M${f(SX - demi * .9)} ${f(y1 - 3)}Q${SX} ${f(y1 + 4)} ${f(SX + demi * .9)} ${f(y1 - 3)}" stroke="#F4F8FC" stroke-width="3" fill="none" opacity=".9"/>`); });
    // guirlande en spirale (4 couleurs) et boules
    const BOULES = [];
    etages.forEach(([y0, demi, y1], k) => { const ya = y0 + (y1 - y0) * .55, w = demi * .62; s.push(`<path d="M${f(SX - w)} ${f(ya - 6)}Q${SX} ${f(ya + 10)} ${f(SX + w)} ${f(ya - 2)}" stroke="#E2B93B" stroke-width="1.4" fill="none"/>`);
      for (let q = 0; q < 3 + k; q++) { const t = (q + .5) / (3 + k), x = SX - w + 2 * w * t, y = ya - 6 + (t * 4) + Math.sin(t * PI) * 7; BOULES.push([x, y, CJ[(q + k) % 4]]); } });
    BOULES.forEach(([x, y, c]) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="${c}" ${IN1}/><circle cx="${f(x - 1)}" cy="${f(y - 1.2)}" r="1.1" fill="#FFF" opacity=".8"/>`));
    // les cadeaux au pied du sapin, aux couleurs des pilotes
    [[SX - 40, 316, 22, 18], [SX - 14, 322, 18, 15], [SX + 10, 318, 24, 20], [SX + 36, 322, 16, 14]].forEach(([x, y, w, h], k) => s.push(`<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${w}" height="${h}" rx="1.5" fill="${CJ[k]}" ${IN1}/><path d="M${f(x)} ${f(y - h)}V${f(y)}M${f(x - w / 2)} ${f(y - h * .55)}H${f(x + w / 2)}" stroke="#FFF6D0" stroke-width="2.2"/><path d="M${f(x)} ${f(y - h)}q-6 -6 -8 -1q4 3 8 1q6 -6 8 -1q-4 3 -8 1" stroke="#FFF6D0" stroke-width="1.6" fill="none"/>`));
    // l'étoile au sommet + guirlandes qui scintillent + neige qui tombe derrière la verrière (couche animée)
    a.push(`<g transform="translate(${SX} ${SY0 - 10})"><circle r="22" fill="#FFE7A0" opacity=".35"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1;1.18;1" dur="2.4s" repeatCount="indefinite"/>`)}<path d="M0 -14L4 -4L15 -4L6 3L9 14L0 7L-9 14L-6 3L-15 -4L-4 -4Z" fill="url(#g4-or)" ${IN1}/></g></g>`);
    [0, 1, 2].forEach(q => { const pts = BOULES.filter((_, i) => i % 3 === q); a.push(`<g opacity="${O0(.9)}">${an(`<animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="${(q * .6).toFixed(1)}s" repeatCount="indefinite"/>`)}${pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#FFF3B0" opacity=".55"/><circle cx="${f(x)}" cy="${f(y)}" r="1.8" fill="#FFF"/>`).join("")}</g>`); });
    { const flocons = n => { let o = ""; for (let k = 0; k < n; k++) { const x = r() * W, y = r() * 360; if (y > 96 && (x < DX0 || x > DX1)) continue; o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8 + r() * 1.6)}" fill="#FFF" opacity="${(.5 + r() * .5).toFixed(2)}"/>`; } return o; };
      a.push(`<clipPath id="g4-cv"><rect x="10" y="7" width="${DX0 - 22}" height="84"/><rect x="${DX1 + 12}" y="7" width="${W - DX1 - 22}" height="84"/><rect x="${DX0}" y="20" width="${DX1 - DX0}" height="${DY1 - 40}"/></clipPath>`);
      [[11, 0], [17, 1]].forEach(([du, q]) => { const fl = flocons(150); a.push(`<g clip-path="url(#g4-cv)"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 -360;${q ? -18 : 14} 0" dur="${du}s" repeatCount="indefinite"/>`)}${fl}${K.anime ? `<g transform="translate(0 360)">${fl}</g>` : ""}</g></g>`); }); }

    // =============== 4. l'enseigne au néon « GARAGE DES RÊVES » devant la verrière (et « TOUR DE CHAUFFE » à droite)
    { const x = 292, y = 63; s.push(`<rect x="${x - 186}" y="${y - 40}" width="372" height="56" rx="8" fill="#0A0A10" opacity=".72" ${IN1}/><path d="M${x - 150} 7V${y - 40}M${x + 150} 7V${y - 40}" stroke="#5A606A" stroke-width="1.6"/>`);
      s.push(txt(x, y, "GARAGE DES RÊVES", 36, "none", { esp: 2, tour: "#FF4FA0", tw: 9 }).replace("<text", `<text opacity=".55" filter="url(#g4-flou)"`));
      s.push(txt(x, y, "GARAGE DES RÊVES", 36, "#FFE3F1", { esp: 2, tour: "#FF4FA0", tw: 2.6 }));
      s.push(txt(x, y + 12, "★  ATELIER DE LÉGENDE · DEPUIS 2026  ★", 8.5, "#7FE8FF", { esp: 2.2, gras: 700 }));
      a.push(`<g opacity="${K.anime ? 1 : 0}">${an(`<animate attributeName="opacity" values="0;0;.85;0;.85;0;0" keyTimes="0;.8;.82;.84;.86;.88;1" dur="7s" repeatCount="indefinite"/>`)}<rect x="${x - 184}" y="${y - 38}" width="368" height="52" rx="7" fill="#0A0A10"/>${txt(x, y, "GARAGE DES RÊVES", 36, "#3A2030", { esp: 2, tour: "#5A2040", tw: 2.6 })}</g>`); }
    { const x = 885, y = 73; s.push(`<rect x="${x - 112}" y="${y - 20}" width="224" height="28" rx="6" fill="#0A0A10" opacity=".72"/>`); s.push(txt(x, y, "TOUR DE CHAUFFE · DÉC. 2026", 14, "none", { esp: 1.5, tour: "#5FE0FF", tw: 7 }).replace("<text", `<text opacity=".5" filter="url(#g4-flou)"`)); s.push(txt(x, y, "TOUR DE CHAUFFE · DÉC. 2026", 14, "#E6FBFF", { esp: 1.5, tour: "#29C8F0", tw: 1.6 })); }
    // la guirlande sous la verrière (ampoules qui clignotent en alternance)
    { const amp = []; for (let x = 18; x < W - 10; x += 22) { if (x > DX0 - 14 && x < DX1 + 14) continue; amp.push([x, 98 + Math.sin(x / 22 * PI) * 3]); }
      s.push(`<path d="M10 97${amp.map(([x, y]) => `L${x} ${f(y)}`).join("")}" stroke="#1A3A22" stroke-width="1.6" fill="none"/>`);
      amp.forEach(([x, y], k) => s.push(`<circle cx="${x}" cy="${f(y + 3)}" r="2.6" fill="${["#E5262E", "#F2C230", "#2BB673", "#4C9AFF"][k % 4]}" opacity=".7"/>`));
      [0, 1].forEach(q => a.push(`<g opacity="${O0()}">${an(`<animate attributeName="opacity" values="1;0;1" dur="1.4s" begin="${q * .7}s" repeatCount="indefinite"/>`)}${amp.filter((_, k) => k % 2 === q).map(([x, y], k) => `<circle cx="${x}" cy="${f(y + 3)}" r="5" fill="${["#FF6A6A", "#FFE08A", "#7AF0A0", "#9AC8FF"][(k * 2 + q) % 4]}" opacity=".5"/><circle cx="${x}" cy="${f(y + 3)}" r="2" fill="#FFF"/>`).join("")}</g>`)); }

    // =============== 5. les 4 box des pilotes, en perspective (haut gauche)
    const PORTR = [], VX = 338, VY = -150, FY = 388, BYb = 232, SC = (BYb - VY) / (FY - VY), HF = 112, HB = HF * SC;
    const xb = x => VX + (x - VX) * SC, XS = [150, 244, 338, 432, 526];
    // halo chaud au-dessus des box
    flaque(338, 300, 230, 110, .55);
    CJ.forEach((c, k) => { const x0 = XS[k], x1 = XS[k + 1], b0 = xb(x0), b1 = xb(x1), bm = (b0 + b1) / 2, d = mixHex(c, "#0A0A10", .78);
      // sol du box, mur du fond, bandeau néon à la couleur du pilote
      s.push(`<path d="M${x0} ${FY}L${x1} ${FY}L${f(b1)} ${BYb}L${f(b0)} ${BYb}Z" fill="${mixHex(c, "#1A1820", .82)}"/><path d="M${f((x0 + x1) / 2)} ${FY}L${f(bm)} ${BYb}" stroke="${c}" stroke-opacity=".25" stroke-width="10"/>`);
      s.push(`<rect x="${f(b0)}" y="${f(BYb - HB)}" width="${f(b1 - b0)}" height="${f(HB)}" fill="${d}"/><rect x="${f(b0)}" y="${f(BYb - 8)}" width="${f(b1 - b0)}" height="8" fill="#0A0A0E" opacity=".5"/>`);
      s.push(`<rect x="${f(b0 + 4)}" y="${f(BYb - HB + 5)}" width="${f(b1 - b0 - 8)}" height="4" rx="2" fill="${c}"/><rect x="${f(b0 + 4)}" y="${f(BYb - HB + 3)}" width="${f(b1 - b0 - 8)}" height="8" rx="4" fill="${c}" opacity=".4" filter="url(#g4-flou)"/>`);
      // le cadre-portrait au mur du fond (l'appli y pose le portrait), le nom dessous
      const px = bm, py = BYb - HB / 2 - 4; PORTR.push({ k, x: +px.toFixed(1), y: +py.toFixed(1), r: 20 });
      s.push(`<circle cx="${f(px)}" cy="${f(py)}" r="30" fill="${c}" opacity=".22"/><circle cx="${f(px)}" cy="${f(py)}" r="23.5" fill="url(#g4-or)" ${IN1}/><circle cx="${f(px)}" cy="${f(py)}" r="20.5" fill="#0C0E14" stroke="${c}" stroke-width="1.6"/>`);
      s.push(`<rect x="${f(px - 26)}" y="${f(BYb - 19)}" width="52" height="13" rx="3" fill="#0A0A0E" stroke="${c}" stroke-width="1.2"/>` + txt(px, BYb - 9.5, NOMS[k].toUpperCase(), 8.5, c, { esp: 1 }));
      // outils au mur : une clé et un pneu accroché
      s.push(`<path d="M${f(b0 + 7)} ${f(BYb - 50)}l0 18M${f(b1 - 9)} ${f(BYb - 52)}l0 16" stroke="#9AA2AE" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`);
      // la monoplace du pilote, de face, au milieu du box (sur un tapis à sa couleur)
      const yc = 352, sc = .78 + (yc - BYb) / (FY - BYb) * .22 * 0, xm = VX + ((x0 + x1) / 2 - VX) * (1 - (FY - yc) / (FY - BYb) * (1 - SC));
      flaque(xm, yc - 10, 60, 34, .7);
      ombreSol(xm, yc, 46, 7, .6);
      reflet(xm, yc + 2, .9, f1Face(c, mixHex(c, "#000000", .5), String(k + 1)), .14);
      if (k !== 3) s.push(`${G(xm, yc, 1)}${f1Face(c, mixHex(c, "#000000", .5), String(k + 1))}</g>`);
      else { s.push(`${G(xm, yc, .9)}<rect x="-30" y="-8" width="60" height="8" fill="url(#g4-hach)" ${IN1}/></g>`);
        a.push(`${G(xm, yc, 1)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -12;0 -12;0 0" keyTimes="0;.2;.35;.8;1" dur="8s" repeatCount="indefinite"/>`)}${f1Face(c, mixHex(c, "#000000", .5), "4")}</g></g>`); }
      s.push(txt((x0 + x1) / 2, FY + 24, NOMS[k], 16, c, { tour: "#0A0A0E", tw: 3.5, esp: .5 })); });
    // les cloisons entre les box (volume) : face éclairée tournée vers le centre, liseré néon à l'avant
    XS.forEach((x, k) => { const b = xb(x), c = CJ[x < VX ? k : k - 1] || CJ[0], top = FY - HF;
      if (Math.abs(x - VX) < 1) { s.push(`<path d="M${x - 2} ${FY}L${x - 2} ${top}L${x + 2} ${top}L${x + 2} ${FY}Z" fill="#3A3742" ${IN1}/>`); return; }
      s.push(`<path d="M${x} ${FY}L${f(b)} ${BYb}L${f(b)} ${f(BYb - HB)}L${x} ${top}Z" fill="${mixHex(c, "#2A2730", .7)}" ${INK}/><path d="M${x} ${f(top + 14)}L${f(b)} ${f(BYb - HB + 10)}" stroke="#0A0A0E" stroke-opacity=".35" stroke-width="5"/>`);
      s.push(`<rect x="${x - 3}" y="${top}" width="6" height="${HF}" fill="#45414E" ${IN1}/><path d="M${x} ${top + 4}V${FY - 4}" stroke="${c}" stroke-width="2" opacity=".85"/>`); });
    s.push(`<path d="M${XS[0] - 3} ${FY - HF}L${f(xb(XS[0]))} ${f(BYb - HB)}H${f(xb(XS[4]))}L${XS[4] + 3} ${FY - HF}" stroke="#0A0A0E" stroke-width="3" fill="none"/>`);
    // les mécaniciens des box : Théo (porte un pneu), Kévin (accroupi au pistolet), Clément (tablette), Devlin (cric)
    s.push(`${G(166, 384, .78)}${meca("#2A5A9A", "porte", "#4C9AFF")}</g>`);
    s.push(`${G(262, 376, .8)}${meca("#1E6A60", "accroupi", "#2BB6A3")}</g>`);
    a.push(`<g transform="translate(280 354)"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="0;-40;0;-40;0;0" keyTimes="0;.1;.2;.3;.4;1" dur="3s" repeatCount="indefinite"/>`)}<path d="M0 0l12 3" stroke="#3A3F48" stroke-width="5" stroke-linecap="round"/><path d="M12 3l2 6" stroke="#F2C230" stroke-width="3"/></g></g>`);
    s.push(`${G(422, 384, -.78, 0, .78)}${meca("#8A2A5A", "bras", "#FF6FA8")}</g><rect x="428" y="352" width="12" height="16" rx="2" fill="#1A1C22" ${IN1} transform="rotate(-20 434 360)"/><rect x="430" y="354" width="8" height="12" fill="#7FE0FF" opacity=".8" transform="rotate(-20 434 360)"/>`);
    a.push(`${G(512, 386, -.74, 0, .74)}${meca("#8A4A1A", "bras", "#F2994A")}</g>`);
    // les cadres-portraits s'allument tour à tour
    PORTR.forEach(({ x, y }, k) => a.push(`<circle cx="${x}" cy="${y}" r="24" fill="none" stroke="#FFF6D0" stroke-width="3" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.22;1" dur="10s" begin="${k * 2.5}s" repeatCount="indefinite"/>`)}</circle>`));
    s.push(`<rect x="150" y="${FY + 1}" width="376" height="5" fill="url(#g4-hach)" opacity=".85"/>`);

    // =============== 6. la voiture à remonter le temps (bas gauche) : portes papillon ouvertes, éclairs, compteur 88
    { const x = 268, y = 562, sc = .92;
      flaque(x, y - 30, 150, 70, .8); flaque(x, y - 4, 120, 22, .5, "froid");
      // traînées de feu au sol, derrière les roues
      s.push(`<path d="M${x - 118} ${y + 2}L${x - 92} ${y - 3}L${x - 92} ${y + 7}Z" fill="#FF6A1E" opacity=".8"/><path d="M${x - 128} ${y + 12}L${x - 30} ${y + 9}L${x - 30} ${y + 15}Z" fill="#FF8A2E" opacity=".85"/><path d="M${x - 128} ${y + 12}L${x - 30} ${y + 11}L${x - 30} ${y + 13}Z" fill="#FFE08A"/>`);
      ombreSol(x, y, 104, 9, .7); reflet(x, y + 3, sc, deloreane(), .17);
      s.push(`${G(x, y, sc)}${deloreane()}</g>`);
      a.push(`<g opacity="${K.anime ? 0 : .9}">${an(`<animate attributeName="opacity" values="0;0;1;.2;1;0;0" keyTimes="0;.5;.53;.56;.6;.66;1" dur="5s" repeatCount="indefinite"/>`)}${G(x, y, sc)}<path d="M-108 -60l12 10l-6 4l14 14l-4 2l10 12M108 -50l-10 8l6 4l-12 12l4 2l-8 14M-30 -126l6 12l-6 2l8 14M-60 -90l-14 6l2 6l-14 4M30 -80l16 -6l-2 6l14 -4" stroke="#9AE6FF" stroke-width="2.4" fill="none" stroke-linejoin="round"/><path d="M-108 -60l12 10l-6 4l14 14l-4 2l10 12M108 -50l-10 8l6 4l-12 12l4 2l-8 14" stroke="#FFF" stroke-width="1" fill="none"/><ellipse cx="0" cy="-40" rx="120" ry="60" fill="#9AE6FF" opacity=".12"/></g></g>`);
      // le compteur « 88 » sur pied
      s.push(`<path d="M${x + 112} ${y}V${y - 48}" stroke="#3A3F48" stroke-width="3"/><ellipse cx="${x + 112}" cy="${y}" rx="10" ry="3" fill="#000" opacity=".5"/><rect x="${x + 92}" y="${y - 70}" width="44" height="24" rx="3" fill="#0A0B0E" stroke="#5A606A" stroke-width="1.6"/>`);
      a.push(`<g>${txt(x + 109, y - 52, "88", 16, "#FF4A2A", { police: "Courier New, monospace", gras: 700 })}<text x="${x + 121}" y="${y - 52}" font-family="Helvetica" font-weight="700" font-size="6" fill="#FF8A6A">MPH</text><circle cx="${x + 132}" cy="${y - 66}" r="1.6" fill="#FF4A2A">${an(`<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>`)}</circle></g>`);
      bulle(x - 70, y - 124, "88 miles à l'heure !", 10, .5); }

    // =============== 7. la voiture mystère sous sa bâche « 2027 ? » (au centre), sur son podium, sous les projecteurs
    const MX = 575, MY = 548;
    { // podium tournant
      s.push(`<ellipse cx="${MX}" cy="${MY + 14}" rx="128" ry="30" fill="#000" opacity=".6" filter="url(#g4-flou)"/><path d="M${MX - 120} ${MY}V${MY + 12}A120 26 0 0 0 ${MX + 120} ${MY + 12}V${MY}Z" fill="#14121A" ${INK}/><ellipse cx="${MX}" cy="${MY}" rx="120" ry="26" fill="url(#g4-podium)" ${INK}/><ellipse cx="${MX}" cy="${MY}" rx="104" ry="20" fill="none" stroke="#E2B93B" stroke-width="1.4" stroke-dasharray="3 6"/>`);
      for (let q = 0; q < 14; q++) { const t = PI * (q + .5) / 14, x = MX - Math.cos(t) * 116, y = MY + 6 + Math.sin(t) * 26; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="#FFE08A"/>`); }
      // les deux projecteurs sur pied, et leurs faisceaux qui se croisent sur la bâche
      [[MX - 158, 440, 1], [MX + 160, 432, -1]].forEach(([x, y, sd]) => { cone(x + sd * 10, y - 6, MX + sd * 12, MY - 38, 200, "#FFE7B0", .5);
        s.push(`<path d="M${x - 12} ${y + 64}L${x} ${y + 4}L${x + 12} ${y + 64}M${x} ${y + 4}V${y + 64}" stroke="#2A2E36" stroke-width="2.4"/><g transform="translate(${x} ${y}) rotate(${sd * 28})"><rect x="-13" y="-11" width="26" height="20" rx="4" fill="#2A2E36" ${INK}/><ellipse cx="${sd * 13}" cy="-1" rx="3.5" ry="9" fill="#FFF6D0" ${IN1}/></g><circle cx="${x + sd * 12}" cy="${y - 6}" r="14" fill="#FFF6D0" opacity=".5" filter="url(#g4-flou)"/>`); });
      flaque(MX, MY - 10, 150, 60, .9);
      // la bâche (on devine les roues et la ligne d'une voiture basse)
      const BA = "M-114 2Q-118 -22 -108 -32L-104 -46L-92 -46L-90 -36L-62 -40Q-40 -68 0 -70Q34 -70 52 -46L96 -38Q118 -32 116 -12L114 2Q96 8 84 2Q78 -26 60 -26Q44 -26 40 2Q0 8 -40 2Q-44 -26 -62 -26Q-80 -26 -84 2Q-100 8 -114 2Z";
      s.push(`${G(MX, MY - 4, 1.05)}<path d="${BA}" fill="url(#g4-bache)" ${INK}/><path d="M-100 -30Q-96 -12 -102 0M-60 -40Q-50 -20 -52 -26M-24 -66Q-18 -30 -26 0M14 -68Q18 -30 14 0M48 -46Q56 -30 50 -26M92 -36Q98 -18 104 2" stroke="#2E3648" stroke-width="2" fill="none" opacity=".7"/><path d="M-88 -38L-62 -42Q-40 -66 0 -66Q30 -66 46 -48" stroke="#E4EAF4" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/><path d="M-80 2Q-78 -22 -62 -22Q-46 -22 -44 2Z" fill="#141A26"/><path d="M44 2Q46 -22 60 -22Q76 -22 80 2Z" fill="#141A26"/><path d="M-76 2Q-74 -12 -62 -12Q-50 -12 -48 2M48 2Q50 -12 62 -12Q74 -12 76 2" stroke="#2A3244" stroke-width="3" fill="none"/></g>`);
      // la plaque dorée sur le devant du podium, et un reflet de lumière qui glisse sur la bâche
      s.push(`<rect x="${MX - 62}" y="${MY + 24}" width="124" height="15" rx="3" fill="url(#g4-or)" ${IN1}/>` + txt(MX, MY + 35, "VOITURE DE L'ANNÉE", 8.5, "#3A2408", { esp: 1.2 }));
      a.push(`<g clip-path="url(#g4-cb)"><clipPath id="g4-cb"><path d="${BA}" transform="translate(${MX} ${MY - 4}) scale(1.05)"/></clipPath><rect x="${MX - 150}" y="${MY - 90}" width="26" height="100" fill="#FFF" opacity="${K.anime ? .22 : 0}" transform="skewX(-25)">${an(`<animate attributeName="x" values="${MX - 150};${MX - 150};${MX + 170}" keyTimes="0;.55;1" dur="6s" repeatCount="indefinite"/>`)}</rect></g>`);
      // les cordes et les sacs de lest
      s.push(`<path d="M${MX - 96} ${MY - 22}L${MX - 112} ${MY + 6}M${MX + 104} ${MY - 20}L${MX + 116} ${MY + 6}" stroke="#C9A24A" stroke-width="1.6"/><rect x="${MX - 120}" y="${MY + 2}" width="14" height="10" rx="3" fill="#6A5A3A" ${IN1}/><rect x="${MX + 110}" y="${MY + 2}" width="14" height="10" rx="3" fill="#6A5A3A" ${IN1}/>`);
      // l'étiquette « 2027 ? » qui se balance, et le grand point d'interrogation qui flotte
      a.push(`<g transform="translate(${MX + 22} ${MY - 76})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="3.2s" repeatCount="indefinite"/>`)}<path d="M0 0L6 26" stroke="#E2B93B" stroke-width="1.4"/><g transform="translate(6 40) rotate(-6)"><rect x="-30" y="-15" width="60" height="28" rx="4" fill="#FFF4D6" ${INK}/><circle cx="-23" cy="-8" r="2.2" fill="#0C0D11"/>${txt(2, 6, "2027 ?", 16, "#C8141C", { police: "Georgia, serif", gras: 700 })}</g></g></g>`);
      a.push(`<g opacity="${K.anime ? 1 : .9}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="3s" repeatCount="indefinite"/>`)}${txt(MX - 40, MY - 104, "?", 44, "#FFE08A", { police: "Georgia, serif", tour: "#0C0D11", tw: 3 })}${txt(MX + 66, MY - 92, "?", 26, "#FFE08A", { police: "Georgia, serif", tour: "#0C0D11", tw: 2.4, rot: 14 })}</g>`);
      // un coin de bâche qui frémit
      a.push(`<path d="M${MX + 100} ${MY - 6}Q${MX + 112} ${MY - 10} ${MX + 114} ${MY}" fill="#66728A" ${IN1}>${an(`<animate attributeName="d" values="M${MX + 100} ${MY - 6}Q${MX + 112} ${MY - 10} ${MX + 114} ${MY};M${MX + 100} ${MY - 6}Q${MX + 116} ${MY - 2} ${MX + 112} ${MY + 6};M${MX + 100} ${MY - 6}Q${MX + 112} ${MY - 10} ${MX + 114} ${MY}" dur="1.6s" repeatCount="indefinite"/>`)}</path>`);
      // le chef d'équipe (casque-micro, planchette) montre la bâche
      const cx = MX - 128, cy = MY + 34;
      ombreSol(cx, cy, 18, 4, .6);
      s.push(`${G(cx, cy, 1.05)}${meca("#22252C", "bras", "#E2B93B")}<path d="M-11 -56L11 -56" stroke="#E2B93B" stroke-width="2.4"/><path d="M-7 -72Q0 -80 7 -72" stroke="#0C0D11" stroke-width="2" fill="none"/><path d="M-7 -70v6l4 2" stroke="#0C0D11" stroke-width="1.6" fill="none"/><rect x="-24" y="-46" width="11" height="15" rx="1.5" fill="#C9A24A" ${IN1}/><rect x="-22" y="-43" width="7" height="10" fill="#FFF8E8"/>${txt(-1, -40, "CHEF", 4.5, "#E2B93B")}</g>`);
      a.push(`<g transform="translate(${f(cx + 10.5)} ${f(cy - 57.5)})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="-20;-40;-20" dur="2.4s" repeatCount="indefinite"/>`)}<path d="M0 0L20 -4L24 -6" stroke="#22252C" stroke-width="6.3" stroke-linecap="round" fill="none"/><circle cx="25" cy="-6.5" r="3" fill="${PEAU}"/></g></g>`);
      bulle(cx + 2, cy - 98, "Patience… janvier !", 12, 6.5);
      K.prendre(MX, MY - 30, 110); }

    // =============== 8. la voiture noire au scanner rouge, de face (bas droite) + le soudeur
    { const x = 846, y = 570, sc = .92;
      flaque(x, y - 30, 120, 60, .7);
      ombreSol(x, y, 92, 8, .7); reflet(x, y + 2, sc, noire(), .2);
      s.push(`${G(x, y, sc)}${noire()}</g>`);
      // le scanner : la lumière rouge va et vient
      a.push(`${G(x, y - 23.5 * sc, sc)}<g${K.anime ? "" : ` transform="translate(20 0)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="-52 0;52 0;-52 0" dur="1.8s" repeatCount="indefinite"/>`)}<ellipse cx="0" cy="0" rx="18" ry="5" fill="#FF2A1E" opacity=".45"/><rect x="-22" y="-2.5" width="12" height="5" fill="#FF2A1E" opacity=".25"/><rect x="10" y="-2.5" width="12" height="5" fill="#FF2A1E" opacity=".25"/><rect x="-8" y="-3" width="16" height="6" rx="1.5" fill="#FF3A2A"/><rect x="-4" y="-1.6" width="8" height="3.2" rx="1.2" fill="#FFE0D8"/></g></g>`);
      s.push(`<path d="M${x - 52} ${y + 6}L${x + 52} ${y + 6}" stroke="#FF2A1E" stroke-width="3" opacity=".2" filter="url(#g4-flou)"/>`);
      bulle(x + 8, y - 102, "Bonsoir, Michael.", 11, 3); }

    // =============== 9. la coccinelle n°53 (haut droite) qui sautille, et la voiture rouge n°95 qui sourit (milieu droite)
    { const x = 834, y = 262, sc = .98;
      flaque(x, y - 26, 120, 56, .75); ombreSol(x, y, 88, 8, .65); reflet(x, y + 2, -sc, coccinelle(1), .16);
      s.push(`<rect x="${x - 98}" y="${y - 2}" width="196" height="6" rx="3" fill="#3A3540" ${IN1}/>`);
      a.push(`${G(x, y, -sc, 0, sc)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -9;0 0;0 -5;0 0;0 0" keyTimes="0;.6;.66;.72;.76;.8;1" dur="5s" repeatCount="indefinite"/>`)}${coccinelle(1)}</g></g>`);
      s.push(`<g transform="translate(${x + 66} ${y - 80})"><rect x="-26" y="-10" width="52" height="16" rx="3" fill="#0A0A0E" stroke="#FFF" stroke-width="1.2"/>${txt(0, 2, "CHOUPETTE", 8, "#FFF", { esp: 1 })}</g>`); }
    { const x = 836, y = 420, sc = .92;
      flaque(x, y - 26, 120, 50, .75); ombreSol(x, y, 92, 8, .65); reflet(x, y + 2, -sc, rouge95(1), .18);
      s.push(`${G(x, y, -sc, 0, sc)}${rouge95(1)}</g>`);
      // le clin d'œil : la paupière se ferme de temps en temps
      a.push(`${G(x, y, -sc, 0, sc)}<path d="M0 -61Q20 -61 32 -46L0 -44Z" fill="#D8232A" opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.9;.93;.96;1" dur="4s" repeatCount="indefinite"/>`)}</path></g>`);
      // le mécano allongé sous la voiture (seules ses jambes dépassent… et gigotent)
      s.push(`<rect x="${x + 30}" y="${y - 6}" width="34" height="6" rx="2" fill="#C8202A" ${IN1}/><circle cx="${x + 34}" cy="${y + 1}" r="2.2" fill="#0C0D11"/><circle cx="${x + 60}" cy="${y + 1}" r="2.2" fill="#0C0D11"/>`);
      a.push(`<g transform="translate(${x + 54} ${y - 8})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="0;-14;0;0" keyTimes="0;.15;.3;1" dur="3.4s" repeatCount="indefinite"/>`)}<path d="M0 0L26 -2L28 -10" stroke="#2A4A7A" stroke-width="6" stroke-linecap="round" fill="none"/><rect x="24" y="-14" width="7" height="10" rx="1.5" fill="#0C0D11"/></g></g><path d="M${x + 54} ${y - 3}L${x + 82} ${y - 2}L${x + 84} ${y - 10}" stroke="#2A4A7A" stroke-width="6" stroke-linecap="round" fill="none"/><rect x="${x + 80}" y="${y - 14}" width="7" height="10" rx="1.5" fill="#0C0D11"/>`);
      bulle(x - 20, y - 86, "Ka-chow !", 9, 1.5); }
    // le soudeur entre les deux (gerbe d'étincelles)
    { const x = 742, y = 590; ombreSol(x, y, 16, 4); s.push(`${G(x, y, .85)}${meca("#3A3E46", "soude", "#1A1C22")}</g>`);
      K.halo(x + 30, y - 41, 30, "#BFEFFF", .8);
      a.push(`<g opacity="${K.anime ? .3 : 1}">${an(`<animate attributeName="opacity" values="1;.2;1;.6;1" dur=".45s" repeatCount="indefinite"/>`)}<circle cx="${x + 30}" cy="${y - 41}" r="7" fill="#E8FCFF" opacity=".8"/>${Array.from({ length: 10 }, (_, q) => `<path d="M${x + 30} ${y - 41}l${f(Math.cos(q * .62 - .3) * (8 + q % 3 * 5))} ${f(Math.sin(q * .62 - .3) * (8 + q % 3 * 5))}" stroke="${q % 2 ? "#FFF6B0" : "#FFB347"}" stroke-width="1.5" stroke-linecap="round"/>`).join("")}</g>`); }

    // =============== 10. les bords : piles de pneus, armoire à outils, fûts (gauche) ; casques des 4 pilotes, extincteur (droite)
    s.push(pilePneus(46, 236, 6, "#E5262E") + pilePneus(46, 340, 5, "#F2C230") + pilePneus(46, 440, 4, "#E9ECEF"));
    { const x = 14, y = 470; s.push(`<rect x="${x}" y="${y}" width="64" height="104" rx="3" fill="#C8202A" ${INK}/>${[0, 1, 2, 3, 4, 5].map(q => `<rect x="${x + 4}" y="${y + 6 + q * 16}" width="56" height="13" rx="1.5" fill="#B0141C" ${IN1}/><rect x="${x + 24}" y="${y + 11 + q * 16}" width="16" height="2.4" rx="1" fill="#E9ECEF"/>`).join("")}<rect x="${x - 2}" y="${y - 6}" width="68" height="8" rx="2" fill="#9AA2AE" ${IN1}/><path d="M${x + 8} ${y - 6}l6 -16M${x + 24} ${y - 6}l2 -20M${x + 44} ${y - 6}l8 -12" stroke="#C8D0DA" stroke-width="3" stroke-linecap="round"/>`); }
    [[26, 628, "#2A6AC8"], [62, 634, "#2E8A4A"]].forEach(([x, y, c]) => s.push(`<path d="M${x - 15} ${y}V${y - 40}Q${x} ${y - 46} ${x + 15} ${y - 40}V${y}Q${x} ${y + 5} ${x - 15} ${y}Z" fill="${c}" ${INK}/><ellipse cx="${x}" cy="${y - 40}" rx="15" ry="4" fill="${mixHex(c, "#FFFFFF", .3)}" ${IN1}/><path d="M${x - 15} ${y - 14}Q${x} ${y - 9} ${x + 15} ${y - 14}M${x - 15} ${y - 28}Q${x} ${y - 23} ${x + 15} ${y - 28}" stroke="#0C0D11" stroke-opacity=".4" stroke-width="2" fill="none"/>`));
    // étagère des casques (un par pilote) à droite
    { const x = 1000, y0 = 160; [0, 1].forEach(e => s.push(`<rect x="${x - 6}" y="${y0 + e * 74}" width="84" height="6" rx="2" fill="url(#g4-bois)" ${IN1}/>`));
      CJ.forEach((c, k) => { const u = x + 18 + (k % 2) * 40, v = y0 - 1 + Math.floor(k / 2) * 74; s.push(`<path d="M${u - 17} ${v}Q${u - 20} ${v - 34} ${u} ${v - 36}Q${u + 19} ${v - 36} ${u + 19} ${v - 14}Q${u + 19} ${v - 4} ${u + 12} ${v}Z" fill="${c}" ${INK}/><path d="M${u - 2} ${v - 26}Q${u + 14} ${v - 28} ${u + 19} ${v - 20}L${u + 19} ${v - 12}Q${u + 6} ${v - 10} ${u - 2} ${v - 14}Z" fill="#14161C" ${IN1}/><path d="M${u + 2} ${v - 24}L${u + 12} ${v - 25}" stroke="#9FD8FF" stroke-width="1.6" opacity=".7"/><path d="M${u - 16} ${v - 8}H${u + 12}" stroke="#0C0D11" stroke-opacity=".4" stroke-width="2"/><path d="M${u - 14} ${v - 16}Q${u - 12} ${v - 30} ${u + 2} ${v - 32}" stroke="#FFF" stroke-opacity=".45" stroke-width="2" fill="none"/>` + txt(u, v + 16, NOMS[k][0], 8, c)); }); }
    s.push(pilePneus(1036, 420, 5, "#4C9AFF") + pilePneus(1036, 540, 4, "#FF6FA8"));
    s.push(`<rect x="1022" y="570" width="18" height="44" rx="8" fill="#D8232A" ${INK}/><rect x="1026" y="562" width="10" height="8" fill="#2A2E36"/><path d="M1036 566q12 0 12 14" stroke="#2A2E36" stroke-width="3" fill="none"/><rect x="1024" y="584" width="14" height="10" fill="#FFF" opacity=".85"/>`);
    // le portrait de groupe (photo des 4) à gauche de la porte, dans la bande du haut : remplacé par des chaussettes de Noël
    if (0) [0, 1, 2, 3].forEach(k => { const x = 1004 + k * 18, y = 112; s.push(`<path d="M${x} ${y}v14q0 5 6 5h6v-5h-6v-14z" fill="${CJ[k]}" ${IN1}/><rect x="${x - 1}" y="${y - 3}" width="8" height="4" fill="#F4F8FC"/>`); });

    // =============== 11. en bas : le muret des stands, bannière, feux de départ, drapeau à damier
    s.push(`<rect x="0" y="646" width="${W}" height="74" fill="#1A181E"/><rect x="0" y="646" width="${W}" height="6" fill="#4A4550"/><rect x="0" y="652" width="${W}" height="4" fill="url(#g4-hach)" opacity=".8"/>`);
    for (let x = 0; x < W; x += 120) s.push(`<rect x="${x + 4}" y="662" width="112" height="50" rx="3" fill="#24212A" stroke="#0C0D11" stroke-width="1"/>`);
    s.push(`<rect x="130" y="668" width="330" height="36" rx="4" fill="#0A0A0E" stroke="#E2B93B" stroke-width="1.6"/>` + txt(295, 692, "TOUR DE CHAUFFE · 1ʳᵉ COURSE", 15, "#F2C230", { esp: 2 }));
    s.push(`<rect x="750" y="668" width="250" height="36" rx="4" fill="#0A0A0E" stroke="#FF4FA0" stroke-width="1.6"/>` + txt(875, 692, "LE VERSUS · SAISON 2027", 14, "#FFD0E6", { esp: 1.6 }));
    // les feux de départ (5 rouges qui s'allument puis s'éteignent : c'est parti)
    { const x = 615, y = 684; s.push(`<rect x="${x - 58}" y="${y - 16}" width="116" height="32" rx="5" fill="#0A0A0E" ${INK}/>`); for (let q = 0; q < 5; q++) s.push(`<circle cx="${x - 44 + q * 22}" cy="${y}" r="8" fill="#2A0A0A" stroke="#3A3F48" stroke-width="1.4"/>`);
      for (let q = 0; q < 5; q++) a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${(.1 + q * .1).toFixed(2)};${(.11 + q * .1).toFixed(2)};.7;.71;1" dur="6s" repeatCount="indefinite"/>`)}<circle cx="${x - 44 + q * 22}" cy="${y}" r="13" fill="#FF2A1E" opacity=".35"/><circle cx="${x - 44 + q * 22}" cy="${y}" r="7" fill="#FF3A2A"/><circle cx="${x - 46 + q * 22}" cy="${y - 2}" r="2.4" fill="#FFD0C8"/></g>`); }
    // le commissaire au drapeau à damier (il l'agite)
    { const x = 520, y = 714; s.push(`${G(x, y, .8)}${meca("#E9ECEF", "bras", "#F2C230")}</g>`);
      let dam = ""; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) dam += `<rect x="${i * 6}" y="${j * 6 - 18}" width="6" height="6" fill="${(i + j) % 2 ? "#0C0D11" : "#FFF"}"/>`;
      a.push(`<g transform="translate(${x + 8} ${y - 44})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="-30;20;-30" dur="1.2s" repeatCount="indefinite"/>`)}<path d="M0 0L2 -26" stroke="#E9ECEF" stroke-width="5" stroke-linecap="round"/><path d="M2 -22V-46" stroke="#5A3A1E" stroke-width="2"/><g transform="translate(2 -28)">${dam}<rect x="0" y="-18" width="24" height="18" fill="none" stroke="#0C0D11" stroke-width="1"/></g></g></g>`); }

    // =============== 12. la piste : asphalte sombre, bordures rouges et blanches, liseré lumineux
    K.route([["#000", 46, ` opacity=".6" filter="url(#g4-flou)"`], ["#0C0D11", 38], ["#E9ECEF", 35, ` stroke-dasharray="12 12"`], ["#D8232A", 35, ` stroke-dasharray="12 12" stroke-dashoffset="12"`], ["#2C2C33", 29], ["#36363E", 23]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#F2C230" stroke-width="1.6" stroke-dasharray="16 14" stroke-linejoin="round" opacity=".55"/>`);
    K.depart();
    // =============== 13. lumière d'ambiance : le froid bleu qui tombe de la verrière, chaleur générale, poussières dans les faisceaux
    s.push(`<rect x="0" y="100" width="${W}" height="70" fill="url(#g4-ciel)" opacity=".18" style="mix-blend-mode:screen"/>`);
    flaque(SX, 380, 140, 60, .6, "froid");
    lin("rayon", [[0, "#9FC8FF", .32], [1, "#9FC8FF", 0]]);
    [[120, 70, 60], [330, 90, 70], [800, 80, 60], [960, 60, 50]].forEach(([x, w, d]) => s.push(`<path d="M${x} 96L${x + w} 96L${x + w + d * 2.2} 470L${x + d * 1.4} 470Z" fill="url(#g4-rayon)" opacity=".5" style="mix-blend-mode:screen"/>`));
    // les 4 monoplaces font le tour de chauffe
    CJ.forEach((c, k) => a.push(K.surPiste(.03 + k * .03, `<g transform="scale(.27)">${f1Dessus(c)}</g>`, 34, k * 1.0)));
    K.particules(8, "#FFE08A", 1.4, "scintille");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#1A1820"/>`, "#1A1030", .08); RES.portraits = PORTR; RES.lieux = { bache: [MX, MY - 40] }; return RES;
  }

  /* ---------- Janvier · La Forêt aux lucioles (v3 : grandes scènes illustrées, même niveau que l'Arène de mai) ----------
     Le moulin à eau, le bassin, la rivière, l'arbre centenaire (la piste passe dans son tronc), la souche et le coffre
     restent aux places du décor 3D (planForet). Autour : l'esprit-cerf sur le bassin, le gardien de la forêt à l'arrêt
     du bus des esprits (les 4 lanternes-portraits), le chat-bus qui bondit sur les cimes, les petits esprits blancs,
     la partie de cartes sur la souche, les champignons lumineux, la procession des lanternes, des milliers de lucioles. */
  function peindreForet3(T, Z, def) {
    const K = kit(T, def, 1701, "fo-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#0C1A16" stroke-width="1.2"`;
    const L = planForet(T), { MX, MY, bassin: BS, TT, B, riv } = L;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const lisse = l => { let d = "M" + f(l[0][0]) + " " + f(l[0][1]); for (let i = 1; i < l.length - 1; i++) { const m = [(l[i][0] + l[i + 1][0]) / 2, (l[i][1] + l[i + 1][1]) / 2]; d += "Q" + f(l[i][0]) + " " + f(l[i][1]) + " " + f(m[0]) + " " + f(m[1]); } const z = l[l.length - 1]; return d + "L" + f(z[0]) + " " + f(z[1]); };
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.9 - 6)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 12)}" height="17" rx="8" fill="#FFFDF2" stroke="#0C1A16" stroke-width="1"/><path d="M${f(x - 4)} ${f(y + 6)}l2 7l6 -7" fill="#FFFDF2" stroke="#0C1A16" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#0C1A16">${txt}</text></g>`);
    // place une scène au plus près de (x0, y0), loin de la piste (Rt) et des autres scènes
    const place = (x0, y0, Ro, Rt, rmax) => { let best = null, bs = 1e9; Rt = Rt === undefined ? Ro * .8 + 16 : Rt;
      for (let e = 0; e < 6000; e++) { const t = r() * TAU, d = Math.sqrt(r()) * (rmax || 160), x = x0 + Math.cos(t) * d, y = y0 + Math.sin(t) * d;
        if (x < Ro * .6 || x > W - Ro * .6 || y < Ro * .6 || y > H - Ro * .6 || K.dT(x, y) < Rt || K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + Ro * .8)) continue;
        if (d < bs) { bs = d; best = [x, y]; } }
      if (best) K.prendre(best[0], best[1], Ro); return best; };
    // ---- dégradés, motifs
    s.push(`<radialGradient id="fo-sol" cx="48%" cy="50%" r="75%"><stop offset="0" stop-color="#3C7656"/><stop offset=".55" stop-color="#1F4E40"/><stop offset="1" stop-color="#0B231E"/></radialGradient>`);
    s.push(`<radialGradient id="fo-clair" r="50%"><stop offset="0" stop-color="#86C070" stop-opacity=".8"/><stop offset=".6" stop-color="#3E7A4E" stop-opacity=".45"/><stop offset="1" stop-color="#2E6A46" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="fo-eau" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8AE8F0"/><stop offset=".5" stop-color="#2E9AB8"/><stop offset="1" stop-color="#12506A"/></radialGradient>`);
    s.push(`<linearGradient id="fo-riv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CCCE0"/><stop offset="1" stop-color="#1E6A8E"/></linearGradient>`);
    s.push(`<radialGradient id="fo-luc" r="50%"><stop offset="0" stop-color="#FBFFD0"/><stop offset=".3" stop-color="#D8FF6A" stop-opacity=".75"/><stop offset="1" stop-color="#A8F03A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="fo-lant" r="50%"><stop offset="0" stop-color="#FFF0B8" stop-opacity=".95"/><stop offset=".35" stop-color="#FFB24A" stop-opacity=".5"/><stop offset="1" stop-color="#FF8A2A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="fo-cyan" r="50%"><stop offset="0" stop-color="#E8FFFF" stop-opacity=".95"/><stop offset=".35" stop-color="#7CF2E8" stop-opacity=".45"/><stop offset="1" stop-color="#3AC8D8" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="fo-rose" r="50%"><stop offset="0" stop-color="#FFE8F8" stop-opacity=".95"/><stop offset=".35" stop-color="#F28AD8" stop-opacity=".45"/><stop offset="1" stop-color="#C85AC8" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="fo-cime" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#7FCB8A"/><stop offset=".45" stop-color="#2F7A5C"/><stop offset="1" stop-color="#0E3A30"/></radialGradient>`);
    s.push(`<radialGradient id="fo-cerf" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".7" stop-color="#CFF8F4" stop-opacity=".85"/><stop offset="1" stop-color="#8AE8E0" stop-opacity=".6"/></radialGradient>`);
    s.push(`<linearGradient id="fo-bois" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A06A3A"/><stop offset="1" stop-color="#5A3A1E"/></linearGradient>`);
    s.push(`<linearGradient id="fo-toit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9A8A4A"/><stop offset="1" stop-color="#4A3E1E"/></linearGradient>`);
    s.push(`<linearGradient id="fo-gris" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AA2AE"/><stop offset=".6" stop-color="#6A7280"/><stop offset="1" stop-color="#454B56"/></linearGradient>`);
    s.push(`<linearGradient id="fo-chat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B860"/><stop offset=".6" stop-color="#D88A36"/><stop offset="1" stop-color="#9A5A1E"/></linearGradient>`);
    s.push(`<pattern id="fo-terre" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#6A5034"/><circle cx="3" cy="4" r="1.3" fill="#7E6444"/><circle cx="11" cy="11" r="1.6" fill="#56402A"/><circle cx="12" cy="3" r=".8" fill="#8E7454"/><path d="M5 12l3 -1" stroke="#4E3A24" stroke-width=".8"/></pattern>`);
    s.push(`<filter id="fo-mousse"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .45  0 0 0 0 .32  0 0 0 .45 0"/></filter>`);
    s.push(`<rect width="${W}" height="${H}" filter="url(#fo-mousse)" opacity=".8"/>`);
    // ---- 1. la clairière : herbe, fleurs qui luisent, sentiers
    s.push(`<ellipse cx="${f(K.cx)}" cy="${f(K.cy)}" rx="360" ry="240" fill="url(#fo-clair)"/>`);
    for (let k = 0; k < 700; k++) { const x = r() * W, y = r() * H; if (!K.inside(x, y) || K.dT(x, y) < 22) continue; s.push(`<path d="M${f(x)} ${f(y)}l-2 -5M${f(x)} ${f(y)}l0 -6M${f(x)} ${f(y)}l2 -5" stroke="${r() < .5 ? "#5A9A5E" : "#3E7E52"}" stroke-width="1.2" opacity=".75"/>`); }
    for (let k = 0; k < 160; k++) { const x = r() * W, y = r() * H; if (!K.inside(x, y) || K.dT(x, y) < 22) continue; const c = ["#B8F4FF", "#F7C6FF", "#FFF1A8", "#C8FFB0"][k % 4]; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="${c}" opacity=".16"/><circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${c}"/>`); }
    // ---- 2. réservation des grandes scènes (aux places du décor 3D quand il y en a une)
    K.prendre(MX + 6, MY - 6, 78); K.prendre(BS[0], BS[1] - 8, 76);
    const SOU = place(L.souche[0] - 20, L.souche[1] + 6, 52, 42, 90);
    const CHA = [place(K.cx - 250, K.cy - 90, 34, 34, 120), place(K.cx + 60, K.cy + 175, 34, 34, 120), place(K.cx + 260, K.cy - 110, 30, 32, 120)];
    const ORA = place(K.cx - 130, K.cy - 150, 36, 34, 90);   // l'autel des offrandes (deck des esprits)
    s.push("<!--arbres-->");
    // ---- 3. la rivière (du bassin jusqu'au bord droit, sous le pont) et le bief du moulin
    const rivD = lisse(riv);
    s.push(`<path d="${rivD}" fill="none" stroke="#08222A" stroke-width="32" stroke-linecap="round" opacity=".8"/><path d="${rivD}" fill="none" stroke="url(#fo-riv)" stroke-width="21" stroke-linecap="round"/><path d="${rivD}" fill="none" stroke="#C8F4FF" stroke-width="5" stroke-linecap="round" opacity=".25"/>`);
    for (let k = 0; k < 18; k++) { const i = Math.floor(r() * (riv.length - 1)), t = r(), p = riv[i], q = riv[i + 1], x = p[0] + (q[0] - p[0]) * t + (r() - .5) * 40, y = p[1] + (q[1] - p[1]) * t + (r() < .5 ? -18 : 18); if (K.dT(x, y) < 26) continue; s.push(`<path d="M${f(x)} ${f(y)}q-3 -10 -1 -16M${f(x + 2)} ${f(y)}q2 -9 6 -13" stroke="#4E8A4A" stroke-width="1.6" fill="none"/><ellipse cx="${f(x + 1)}" cy="${f(y - 15)}" rx="1.4" ry="3.5" fill="#6A4A2A"/>`); }
    a.push(`<path d="${rivD}" fill="none" stroke="#E2FAFF" stroke-width="2" stroke-linecap="round" stroke-dasharray="7 19" opacity=".75">${an(`<animate attributeName="stroke-dashoffset" from="0" to="-52" dur="2.6s" repeatCount="indefinite"/>`)}</path>`);
    // les petites lanternes qui descendent la rivière
    for (let q = 0; q < 3; q++) { const du = 22, de = -q * 7.3; a.push(`<g${K.anime ? "" : ` transform="translate(${f(riv[q + 1][0])} ${f(riv[q + 1][1])})"`}>${an(`<animateMotion dur="${du}s" begin="${de}s" repeatCount="indefinite" path="${rivD.replace(/(-?\d+\.\d) (-?\d+\.\d)/g, "$1,$2")}"/>`)}<circle r="12" fill="url(#fo-lant)"/><path d="M-6 2h12l-2 3h-8z" fill="#7A4A22" ${INK}/><rect x="-3.2" y="-6" width="6.4" height="8" rx="2" fill="#FFD27A" stroke="#8A3A1A" stroke-width=".8"/><path d="M-3.2 -2h6.4" stroke="#C8501E" stroke-width=".7"/></g>`); }
    // ---- 4. le bassin et sa cascade, l'esprit-cerf qui marche sur l'eau
    { const [x, y] = BS; s.push(`<ellipse cx="${f(x + 6)}" cy="${f(y + 8)}" rx="70" ry="50" fill="#000" opacity=".35" filter="url(#fo-flou)"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="64" ry="46" fill="#0A2830"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="57" ry="40" fill="url(#fo-eau)"/>`);
      for (let k = 0; k < 13; k++) { const t = PI * (.95 + k * .085), u = x + Math.cos(t) * 66, v = y + Math.sin(t) * 47; s.push(`<ellipse cx="${f(u)}" cy="${f(v)}" rx="${f(9 + r() * 7)}" ry="${f(7 + r() * 5)}" fill="#4E5A5C" ${INK}/><ellipse cx="${f(u - 2)}" cy="${f(v - 3)}" rx="4" ry="2.5" fill="#9AA8AC" opacity=".6"/><path d="M${f(u - 6)} ${f(v - 4)}q4 -4 9 -1" stroke="#5A9A4A" stroke-width="2.4" fill="none" opacity=".8"/>`); }
      // la falaise et la cascade (au nord du bassin)
      s.push(`<path d="M${f(x - 30)} ${f(y - 40)}q4 -26 30 -30q26 4 30 30z" fill="#3A4446" ${INK}/><path d="M${f(x - 12)} ${f(y - 64)}q12 -5 24 0l-3 30q-9 3 -18 0z" fill="#BDEFFF" opacity=".9"/><ellipse cx="${f(x)}" cy="${f(y - 30)}" rx="22" ry="8" fill="#FFFFFF" opacity=".55" filter="url(#fo-flou)"/>`);
      a.push(`<path d="M${f(x - 8)} ${f(y - 62)}l1 28M${f(x)} ${f(y - 64)}l0 30M${f(x + 8)} ${f(y - 62)}l-1 28" stroke="#FFFFFF" stroke-width="1.7" stroke-dasharray="5 4" opacity=".9">${an(`<animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".7s" repeatCount="indefinite"/>`)}</path>`);
      // nénuphars et lotus lumineux
      for (let k = 0; k < 7; k++) { const t = r() * TAU, d = 18 + r() * 26, u = x + Math.cos(t) * d * 1.3, v = y + 8 + Math.sin(t) * d * .7; s.push(`<path d="M${f(u)} ${f(v)}m-6 0a6 4.5 0 1 0 12 0l-6 0z" fill="#3E8E5A" ${INK}/>`); if (k % 2 === 0) s.push(`<circle cx="${f(u)}" cy="${f(v - 1)}" r="9" fill="url(#fo-rose)" opacity=".7"/><path d="M${f(u - 4)} ${f(v)}q4 -8 8 0q-4 -3 -8 0z" fill="#FFD8F2" ${INK}/>`); }
      // l'esprit-cerf : grand cerf translucide, bois en branches feuillues, des fleurs naissent sous ses pas
      const cx0 = x + 10, cy0 = y - 2;
      s.push(`${G(cx0, cy0, 1.4)}<ellipse cx="0" cy="22" rx="30" ry="5" fill="#E8FFFF" opacity=".25"/>
        <path d="M-18 20L-17 2M-10 21L-11 3M12 21L11 2M19 20L17 1" stroke="#DFFCF8" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M-22 -2Q-24 -14 -10 -16L12 -16Q22 -15 22 -4Q22 6 12 6L-14 6Q-22 6 -22 -2Z" fill="url(#fo-cerf)" ${INK}/>
        <path d="M-23 -6q-5 -2 -4 -7" stroke="#DFFCF8" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <path d="M14 -14Q18 -26 24 -32L30 -28Q28 -20 22 -10Z" fill="url(#fo-cerf)" ${INK}/>
        <path d="M22 -34Q30 -38 36 -33L38 -28Q33 -26 28 -27Z" fill="url(#fo-cerf)" ${INK}/>
        <circle cx="31" cy="-33" r="1.6" fill="#0C1A16"/><path d="M30 -31l2 4" stroke="#E8506A" stroke-width="1"/><path d="M27 -36l-2 -3" stroke="#0C1A16" stroke-width=".8"/>
        <path d="M24 -36Q18 -48 10 -52M18 -46Q22 -54 20 -60M14 -50Q6 -52 2 -58M28 -37Q32 -50 42 -56M34 -48Q40 -50 46 -48M38 -53Q38 -60 34 -64" stroke="#3E2A16" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${[[10, -52], [20, -60], [2, -58], [42, -56], [46, -48], [34, -64], [16, -47]].map(([u, v]) => `<ellipse cx="${u}" cy="${v}" rx="3.2" ry="2" fill="#6ACB6A" ${INK} transform="rotate(${f(r() * 180)} ${u} ${v})"/>`).join("")}
        ${[[-8, -10], [2, -12], [12, -8], [-14, -4], [6, -2]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="1.4" fill="#7CF2E8" opacity=".8"/>`).join("")}</g>`);
      a.push(`${G(cx0, cy0, 1.4)}<circle cx="6" cy="-14" r="44" fill="url(#fo-cyan)" opacity="${K.anime ? .25 : .35}">${an(`<animate attributeName="opacity" values=".15;.45;.15" dur="5s" repeatCount="indefinite"/>`)}</circle>${[[-17, 21], [12, 21]].map(([u, v], q) => `<ellipse cx="${u}" cy="${v}" rx="4" ry="1.6" fill="none" stroke="#E8FFFF" stroke-width="1" opacity="${K.anime ? 0 : .6}">${an(`<animate attributeName="rx" values="3;16" dur="3s" begin="${q * 1.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="3s" begin="${q * 1.5}s" repeatCount="indefinite"/>`)}</ellipse>`).join("")}</g>`);
      [[-36, 26], [-26, 30], [30, 28], [40, 24]].forEach(([u, v], q) => s.push(`${G(cx0 + u, cy0 + v, 1)}${[0, 1, 2, 3, 4].map(p => `<ellipse cx="${f(Math.cos(p * 1.256) * 2.6)}" cy="${f(Math.sin(p * 1.256) * 2.6)}" rx="2.2" ry="1.4" fill="${["#FFE8F8", "#FFF4B8", "#D8FFF4", "#FFE8F8"][q]}" transform="rotate(${f(p * 72)} ${f(Math.cos(p * 1.256) * 2.6)} ${f(Math.sin(p * 1.256) * 2.6)})"/>`).join("")}<circle r="1.3" fill="#F2C230"/></g>`)); }
    // ---- 5. le moulin à eau (au centre, comme en 3D) : maison à colombages, toit de chaume moussu, grande roue qui tourne, bief depuis le bassin
    { const x = MX, y = MY, sc = 1.3, xb = (BS[0] - 52 - x) / sc;
      s.push(`${G(x, y, sc)}<ellipse cx="6" cy="34" rx="64" ry="11" fill="#000" opacity=".4" filter="url(#fo-flou)"/>
        <path d="M30 30Q44 40 60 36Q${f(xb)} 30 ${f(xb + 6)} 18" stroke="#0A2830" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M30 30Q44 40 60 36Q${f(xb)} 30 ${f(xb + 6)} 18" stroke="url(#fo-riv)" stroke-width="8" fill="none" stroke-linecap="round"/>
        <rect x="-46" y="8" width="74" height="24" rx="3" fill="#6A7074" ${INK}/>${[[-44, 12, 14], [-28, 12, 16], [-10, 12, 14], [6, 12, 18], [-38, 22, 16], [-20, 22, 14], [-4, 22, 18], [14, 22, 12]].map(([u, v, w]) => `<rect x="${u}" y="${v}" width="${w}" height="8" rx="2" fill="#7E868A" stroke="#4A5054" stroke-width=".7"/>`).join("")}
        <rect x="-42" y="-30" width="66" height="40" fill="#E8D8B8" ${INK}/>
        <path d="M-42 -30h66M-42 -10h66M-42 10h66M-30 -30v40M-6 -30v40M12 -30v40M-42 -30L-30 -10M-6 -30L12 -10M12 -10L24 10M-42 -10L-30 10" stroke="#5A3A1E" stroke-width="2.4" fill="none"/>
        <rect x="-38" y="-26" width="12" height="12" rx="1.5" fill="#FFD27A" stroke="#5A3A1E" stroke-width="1.4"/><path d="M-32 -26v12M-38 -20h12" stroke="#5A3A1E" stroke-width="1"/>
        <rect x="-2" y="-27" width="10" height="12" rx="1.5" fill="#FFC45C" stroke="#5A3A1E" stroke-width="1.4"/><path d="M3 -27v12" stroke="#5A3A1E" stroke-width="1"/>
        <path d="M-24 10v-12a6 6 0 0 1 12 0v12z" fill="#3A2412" ${INK}/><circle cx="-14" cy="3" r=".9" fill="#E2B93B"/>
        <path d="M-54 -26L-9 -70L36 -26Q32 -22 26 -24Q20 -20 14 -24Q6 -20 -2 -24Q-10 -20 -18 -24Q-26 -20 -34 -24Q-42 -20 -48 -24Q-52 -22 -54 -26Z" fill="url(#fo-toit)" ${INK}/>
        ${Array.from({ length: 9 }, (_, q) => `<path d="M${-46 + q * 9} -28Q${-30 + q * 5} -46 -9 -66" stroke="#3A2E14" stroke-width=".8" fill="none" opacity=".7"/>`).join("")}
        <path d="M-40 -34q8 -6 16 -2q-6 6 -16 2zM8 -40q10 -6 18 2q-10 4 -18 -2zM-18 -56q6 -4 12 0q-6 4 -12 0z" fill="#4E8A3A" opacity=".9"/>
        <rect x="10" y="-62" width="9" height="18" fill="#7A6A5E" ${INK}/><rect x="9" y="-64" width="11" height="4" fill="#5A4E44" ${INK}/>
        <circle cx="-30" cy="-20" r="14" fill="url(#fo-lant)" opacity=".7"/></g>`);
      // le coffre du Versus au pied du moulin (clin d'œil), et ses pièces
      s.push(`${G(x - 6, y + 60, 1.2)}<circle r="22" fill="url(#fo-lant)" opacity=".8"/><ellipse cx="2" cy="8" rx="14" ry="3" fill="#000" opacity=".35"/><rect x="-11" y="-4" width="22" height="12" rx="2" fill="#7A4A22" ${INK}/><path d="M-11 -4q11 -10 22 0z" fill="#9A5A2A" ${INK}/><path d="M-11 1h22M0 -9v17" stroke="#E2B93B" stroke-width="1.8"/><rect x="-2" y="-1" width="4" height="4" fill="#E2B93B" ${INK}/>
        ${[[-14, 7], [13, 6], [16, 2]].map(([u, v]) => `<ellipse cx="${u}" cy="${v}" rx="2.6" ry="1.6" fill="#F2C64A" stroke="#8A5A14" stroke-width=".6"/>`).join("")}<text x="0" y="22" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="6.5" fill="#F7E3A0" stroke="#0C1A16" stroke-width="1.8" paint-order="stroke">VERSUS</text></g>`);
      // les noiraudes (boules de suie) qui apportent 4 bonbons-étoiles aux couleurs des 4 pilotes
      const suie = (u, v, c) => `${G(u, v, 1)}<circle r="4.6" fill="#141414"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(q => `<path d="M${f(Math.cos(q * .785) * 4)} ${f(Math.sin(q * .785) * 4)}l${f(Math.cos(q * .785) * 2.2)} ${f(Math.sin(q * .785) * 2.2)}" stroke="#141414" stroke-width="1"/>`).join("")}<circle cx="-1.6" cy="-.6" r="1.4" fill="#FFF"/><circle cx="1.6" cy="-.6" r="1.4" fill="#FFF"/><circle cx="-1.4" cy="-.4" r=".6" fill="#000"/><circle cx="1.8" cy="-.4" r=".6" fill="#000"/><path d="M-3 -5l-1 -3M3 -5l1 -3" stroke="#141414" stroke-width=".8"/>${c ? `<path d="M0 -12l1.4 2.6l2.8 .2l-2.1 1.9l.7 2.8l-2.8 -1.4l-2.8 1.4l.7 -2.8l-2.1 -1.9l2.8 -.2z" fill="${c}" stroke="#0C1A16" stroke-width=".6"/>` : ""}</g>`;
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0;0 0" keyTimes="0;.2;.4;1" dur="1.3s" repeatCount="indefinite"/>`)}${COULEURS_J.map((c, k) => suie(x - 56 + k * 13, y + 66 + (k % 2) * 5, c)).join("")}</g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -4;0 0" keyTimes="0;.4;.6;1" dur="1.1s" repeatCount="indefinite"/>`)}${[[24, 62], [36, 70], [50, 64]].map(([u, v]) => suie(x + u, y + v, null)).join("")}</g>`);
      // la grande roue à aubes qui tourne
      const wx = x + 34 * sc, wy = y + 2 * sc, RW = 26 * sc;
      a.push(`<g transform="translate(${f(wx)} ${f(wy)})"><g>${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/>`)}<circle r="${f(RW)}" fill="none" stroke="#4A2E16" stroke-width="5"/><circle r="${f(RW - 8)}" fill="none" stroke="#6A4422" stroke-width="2.4"/>${Array.from({ length: 8 }, (_, q) => `<path d="M0 0L${f(Math.cos(q * PI / 4) * RW)} ${f(Math.sin(q * PI / 4) * RW)}" stroke="#5A3A1E" stroke-width="2.6"/>`).join("")}${Array.from({ length: 14 }, (_, q) => { const t = q / 14 * TAU; return `<rect x="-3" y="-6" width="6" height="12" fill="#8A5A2E" stroke="#2A1A0A" stroke-width=".8" transform="translate(${f(Math.cos(t) * (RW + 3))} ${f(Math.sin(t) * (RW + 3))}) rotate(${f(t * 57.3)})"/>`; }).join("")}<circle r="5" fill="#3A2412" ${INK}/></g></g>`);
      a.push(`<path d="M${f(wx + RW - 4)} ${f(wy - RW + 2)}q8 8 4 ${f(RW * 1.6)}M${f(wx + RW - 10)} ${f(wy - RW + 4)}q6 10 0 ${f(RW * 1.6)}" stroke="#E2FAFF" stroke-width="1.8" fill="none" stroke-dasharray="4 5" opacity=".85">${an(`<animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".6s" repeatCount="indefinite"/>`)}</path>`);
      // fumée de la cheminée
      a.push(`<g opacity=".55">${[0, 1].map(q => `<circle cx="${f(x + 14.5 * sc)}" cy="${f(y - 66 * sc)}" r="5" fill="#B8C8C4"${K.anime ? "" : ` transform="translate(${q * 6} ${-12 - q * 12})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;14 -46" dur="5s" begin="${q * 2.5}s" repeatCount="indefinite"/><animate attributeName="r" values="4;12" dur="5s" begin="${q * 2.5}s" repeatCount="indefinite"/>`)}</circle>`).join("")}</g>`); }
    // ---- 6. la souche : partie de cartes des esprits (deck-building : pioche, défausse, 4 pions aux couleurs des pilotes)
    const kodama = (u, v, sc, tete) => `${G(u, v, sc)}<ellipse cx="0" cy="7" rx="5" ry="1.6" fill="#000" opacity=".3"/><path d="M-4 7Q-5 -2 0 -3Q5 -2 4 7Z" fill="#F4FAF6" ${INK}/><path d="M-3.5 7l-.8 2M3.5 7l.8 2" stroke="#F4FAF6" stroke-width="1.4"/><g transform="rotate(${tete || 0} 0 -4)"><path d="M-6 -9Q-7 -17 0 -17Q7 -16 6 -9Q5 -3 0 -3Q-6 -3 -6 -9Z" fill="#FFFFFF" ${INK}/><circle cx="-2.4" cy="-10.5" r="1.2" fill="#0C1A16"/><circle cx="2.4" cy="-10.5" r="1.2" fill="#0C1A16"/><ellipse cx="0" cy="-6.8" rx="1" ry="1.3" fill="#0C1A16"/></g></g>`;
    if (SOU) { const [x, y] = SOU, sc = 1.25;
      s.push(`${G(x, y, sc)}<ellipse cx="4" cy="20" rx="46" ry="10" fill="#000" opacity=".4" filter="url(#fo-flou)"/>
        <path d="M-36 4Q-38 18 -26 22L26 22Q38 18 36 4" fill="#5A3A1E" ${INK}/>${[-28, -16, -4, 8, 20, 30].map(u => `<path d="M${u} 8l1 13" stroke="#3A2412" stroke-width="1.2"/>`).join("")}
        <path d="M-36 6l-10 8l8 -1M36 6l12 6l-10 0M-18 20l-6 8M18 20l8 7" stroke="#5A3A1E" stroke-width="3.4" stroke-linecap="round" fill="none"/>
        <ellipse cx="0" cy="4" rx="36" ry="15" fill="#C8A06A" ${INK}/>${[30, 23, 16, 9].map(q => `<ellipse cx="0" cy="4" rx="${q}" ry="${f(q * .42)}" fill="none" stroke="#A07848" stroke-width=".9"/>`).join("")}
        ${[-20, -13, -6].map((u, q) => `<rect x="${u}" y="${-4 - q * .4}" width="9" height="12" rx="1.2" fill="#2E5E8C" stroke="#F4ECD8" stroke-width=".8" transform="rotate(${-8 + q * 2} ${u} 0)"/>`).join("")}
        <rect x="-18" y="-5" width="9" height="12" rx="1.2" fill="#2E5E8C" stroke="#F4ECD8" stroke-width=".8"/><text x="-13.5" y="2.5" text-anchor="middle" font-family="Georgia, serif" font-size="4" fill="#F4ECD8">✦</text>
        ${[["#F4ECD8", "#7CF2E8"], ["#F4ECD8", "#FFD27A"], ["#F4ECD8", "#F28AD8"]].map(([c, d], q) => `<g transform="translate(${2 + q * 8} ${-2 + (q % 2) * 2}) rotate(${-10 + q * 10})"><rect x="-3.6" y="-5" width="7.2" height="10" rx="1" fill="${c}" ${INK}/><circle cy="-1" r="2" fill="${d}"/><path d="M-2 3h4" stroke="#0C1A16" stroke-width=".6"/></g>`).join("")}
        ${COULEURS_J.map((c, k) => `<g transform="translate(${-24 + k * 16} ${12 - (k % 2) * 3})"><path d="M-2.4 2.6Q-3 -1 -1.2 -1.6A1.8 1.8 0 1 1 1.2 -1.6Q3 -1 2.4 2.6Z" fill="${c}" ${INK}/></g>`).join("")}
        <g transform="translate(26 -2) rotate(14)"><rect x="-3.2" y="-3.2" width="6.4" height="6.4" rx="1.2" fill="#F4F1EA" ${INK}/><circle cx="-1.2" cy="-1.2" r=".7" fill="#0C1A16"/><circle cx="1.2" cy="1.2" r=".7" fill="#0C1A16"/></g>
        <g transform="translate(-30 -6)"><ellipse rx="3" ry="3.6" fill="#B07A3A" ${INK}/><path d="M-3.2 -1.4Q0 -6 3.2 -1.4Z" fill="#6A4A2A" ${INK}/></g></g>`);
      // les petits esprits joueurs (têtes qui cliquettent)
      a.push(`<g>${[[-44, -6, -10], [44, -8, 12], [-6, -22, 0]].map(([u, v, t], q) => kodama(x + u * sc, y + v * sc, 1.35, t)).join("")}${an("")}</g>`);
      a.push(`<g transform="translate(${f(x + 44 * sc)} ${f(y - 34 * sc)})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="0;-8;8;0;0" keyTimes="0;.1;.2;.3;1" dur="2.6s" repeatCount="indefinite"/>`)}<rect x="-4" y="-5" width="7" height="10" rx="1" fill="#2E5E8C" stroke="#F4ECD8" stroke-width=".8"/><rect x="0" y="-4" width="7" height="10" rx="1" fill="#2E5E8C" stroke="#F4ECD8" stroke-width=".8"/></g></g>`);
      bulle(x, y - 46 * sc, "Je pioche deux !", 9, 1); }
    // ---- 7. les champignons géants lumineux (trois bosquets : bleu, rose, ambre)
    const PALC = [["#4AD8E8", "#1E7A9A", "fo-cyan"], ["#F28AD8", "#9A3A8A", "fo-rose"], ["#FFC45C", "#B0601E", "fo-lant"]];
    CHA.forEach((p, k) => { if (!p) return; const [x, y] = p, [c1, c2, gl] = PALC[k], sc = 1.3;
      s.push(`${G(x, y, sc)}<circle cx="0" cy="-8" r="40" fill="url(#${gl})" opacity=".55"/><ellipse cx="0" cy="16" rx="30" ry="6" fill="#000" opacity=".35"/>
        ${[[-14, 14, 22, 15], [10, 16, 30, 19], [24, 15, 14, 10], [-26, 16, 12, 9], [0, 18, 10, 7]].map(([u, v, h, R]) => `<path d="M${u - R * .22} ${v}Q${u - R * .3} ${v - h * .5} ${u - R * .14} ${v - h}L${u + R * .14} ${v - h}Q${u + R * .3} ${v - h * .5} ${u + R * .22} ${v}Z" fill="#EDE4D0" ${INK}/><path d="M${u - R} ${v - h + 2}Q${u - R} ${v - h - R * .9} ${u} ${v - h - R * .9}Q${u + R} ${v - h - R * .9} ${u + R} ${v - h + 2}Q${u} ${v - h - 3} ${u - R} ${v - h + 2}Z" fill="${c1}" ${INK}/><path d="M${u - R * .7} ${v - h - R * .2}Q${u - R * .4} ${v - h - R * .75} ${u + R * .1} ${v - h - R * .8}" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity=".6"/>${[[-.5, -.4], [.2, -.6], [.55, -.25], [-.1, -.25]].map(([i, j]) => `<circle cx="${f(u + i * R)}" cy="${f(v - h + j * R)}" r="${f(R * .1)}" fill="#FFFFFF" opacity=".85"/>`).join("")}<path d="M${u - R + 2} ${v - h + 1}Q${u} ${v - h - 2} ${u + R - 2} ${v - h + 1}" stroke="${c2}" stroke-width="1.4" fill="none"/>`).join("")}</g>`);
      a.push(`<circle cx="${f(x)}" cy="${f(y - 14)}" r="${f(36 * sc)}" fill="url(#${gl})" opacity="${K.anime ? .2 : .35}">${an(`<animate attributeName="opacity" values=".1;.6;.1" dur="${(3.4 + k * .9).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); });
    // ---- 8. l'autel des offrandes : la pioche des esprits (3 cartes retournées face lumineuse)
    if (ORA) { const [x, y] = ORA; s.push(`${G(x, y, 1.5)}<ellipse cx="2" cy="12" rx="22" ry="5" fill="#000" opacity=".35"/><rect x="-16" y="0" width="32" height="12" rx="2" fill="#6A7074" ${INK}/><rect x="-18" y="-3" width="36" height="5" rx="1.5" fill="#8A9094" ${INK}/>
        ${[0, 1, 2, 3, 4].map(q => `<rect x="${-12 + q * .6}" y="${-14 - q * 1.2}" width="10" height="13" rx="1.2" fill="#2E5E8C" stroke="#F4ECD8" stroke-width=".8"/>`).join("")}<rect x="2" y="-15" width="10" height="13" rx="1.2" fill="#F4ECD8" ${INK}/><circle cx="7" cy="-9.5" r="3" fill="#D8FF6A"/><circle cx="7" cy="-9.5" r="6" fill="url(#fo-luc)"/>
        <path d="M-22 -2v-26M22 -2v-26M-26 -26h52M-24 -21h48" stroke="#C8283A" stroke-width="3.2" stroke-linecap="round"/><path d="M-26 -26q26 -6 52 0" stroke="#C8283A" stroke-width="3.2" fill="none"/>
        ${[-14, -4, 6, 16].map(u => `<path d="M${u} -21l2 4l-3 1l2 4" stroke="#FFFFFF" stroke-width="1.2" fill="none"/>`).join("")}</g>`);
      s.push(`<text x="${f(x)}" y="${f(y + 36)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9.5" fill="#FFF6D8" stroke="#0C1A16" stroke-width="2.4" paint-order="stroke">pioche des esprits</text>`); }
    // ---- 9. le gardien de la forêt à l'arrêt du bus des esprits, avec les 4 lanternes-portraits des pilotes (coin bas droit)
    const PORTR = [];
    { let x = 1010, y = 585; if (K.dT(x, y) < 90) { const p = place(W - 100, H - 140, 70, 80, 200); if (p) [x, y] = p; } K.prendre(x, y, 72);
      const sc = 1.45, ry = Math.min(y + 81, H - 54), lx0 = x - 210;
      s.push(`${G(x, y, sc)}<ellipse cx="0" cy="40" rx="46" ry="10" fill="#000" opacity=".45" filter="url(#fo-flou)"/>
        <path d="M-6 38Q-30 38 -32 12Q-34 -18 -18 -30Q-22 -44 -18 -52Q-12 -46 -10 -36Q0 -40 10 -36Q12 -46 18 -52Q22 -44 18 -30Q34 -18 32 12Q30 38 6 38Z" fill="url(#fo-gris)" ${INK}/>
        <path d="M-20 -2Q-22 30 0 34Q22 30 20 -2Q12 -10 0 -10Q-12 -10 -20 -2Z" fill="#E8E0CC" ${INK}/>${[[-8, 4], [4, 4], [-14, 12], [-2, 12], [10, 12], [-8, 20], [4, 20]].map(([u, v]) => `<path d="M${u} ${v}l3 -3l3 3" stroke="#6A7280" stroke-width="1.4" fill="none"/>`).join("")}
        <circle cx="-9" cy="-22" r="5.6" fill="#FFFFFF" ${INK}/><circle cx="9" cy="-22" r="5.6" fill="#FFFFFF" ${INK}/><circle cx="-8.4" cy="-22" r="2.4" fill="#0C1A16"/><circle cx="8.4" cy="-22" r="2.4" fill="#0C1A16"/><circle cx="-9.2" cy="-23" r=".8" fill="#FFF"/><circle cx="7.6" cy="-23" r=".8" fill="#FFF"/>
        <path d="M-3 -16q3 -2 6 0q-3 2 -6 0z" fill="#0C1A16"/><path d="M-6 -12q6 3 12 0" stroke="#0C1A16" stroke-width="1" fill="none"/><path d="M-14 -16h-12M-14 -13l-11 2M14 -16h12M14 -13l11 2" stroke="#2A2E36" stroke-width=".8"/>
        <path d="M-14 38l-3 3M-8 38l0 4M8 38l0 4M14 38l3 3" stroke="#2A2E36" stroke-width="1.2"/><path d="M-30 4Q-38 14 -32 22" stroke="#6A7280" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M28 4Q36 -10 6 -60" stroke="#6A7280" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M6 -60L4 -66" stroke="#2A5A24" stroke-width="2"/>
        <path d="M4 -66Q-24 -96 -50 -62Q-30 -70 -20 -60Q-8 -72 4 -66Z" fill="#3E8A3A" ${INK}/><path d="M4 -66Q30 -98 50 -60Q32 -68 24 -58Q12 -70 4 -66Z" fill="#4E9A44" ${INK}/><path d="M4 -66Q-20 -86 -44 -64M4 -66Q26 -88 46 -62M4 -66V-90" stroke="#2A5A24" stroke-width="1.1" fill="none"/>
        <g transform="translate(-40 32)"><path d="M-5 8Q-7 -2 0 -4Q7 -2 5 8Z" fill="#F4F8FC" ${INK}/><path d="M-3 -4l-1 -4M3 -4l1 -4" stroke="#F4F8FC" stroke-width="1.4"/><circle cx="-1.6" cy="0" r="1" fill="#0C1A16"/><circle cx="1.6" cy="0" r="1" fill="#0C1A16"/></g></g>`);
      a.push(`${G(x, y, sc)}${[-9, 9].map(u => `<ellipse cx="${u}" cy="-22" rx="5.8" ry="5.8" fill="#7A828E" opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.9;.93;.96;1" dur="5s" repeatCount="indefinite"/>`)}</ellipse>`).join("")}</g>`);
      // le panneau de l'arrêt et la corde aux 4 lanternes, chacune avec le portrait d'un pilote
      const NOMS = ["Théo", "Kévin", "Clément", "Devlin"], px = lx0 - 34, py = ry - 26;
      s.push(`<ellipse cx="${f(px + 3)}" cy="${f(ry + 22)}" rx="10" ry="3" fill="#000" opacity=".4"/><path d="M${f(px)} ${f(ry + 22)}V${f(py - 14)}" stroke="#5A3A1E" stroke-width="3.6"/><circle cx="${f(px)}" cy="${f(py - 26)}" r="17" fill="#F4ECD8" stroke="#8A2A1E" stroke-width="3"/><text x="${f(px)}" y="${f(py - 28)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="7.5" fill="#8A2A1E">ARRÊT</text><text x="${f(px)}" y="${f(py - 19)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="5.6" fill="#0C1A16">Lucioles</text>
        <path d="M${f(px)} ${f(py - 8)}Q${f(lx0 + 66)} ${f(py + 8)} ${f(x - 30)} ${f(py - 6)}" stroke="#3A2A1A" stroke-width="1.6" fill="none"/>`);
      COULEURS_J.forEach((c, k) => { const lx = lx0 + k * 44, ly = ry + (k === 1 || k === 2 ? 2 : 0); PORTR.push({ k, x: lx, y: ly, r: 15 });
        s.push(`<circle cx="${f(lx)}" cy="${f(ly)}" r="30" fill="url(#fo-lant)" opacity=".75"/><path d="M${f(lx)} ${f(ly - 24)}v-4" stroke="#3A2A1A" stroke-width="1.2"/><rect x="${f(lx - 8)}" y="${f(ly - 25)}" width="16" height="5" rx="1.5" fill="#2A1A0E"/><ellipse cx="${f(lx)}" cy="${f(ly)}" rx="20" ry="21" fill="#FFE2A8" stroke="${c}" stroke-width="2.4"/>${[-12, -6, 6, 12].map(v => `<path d="M${f(lx - Math.sqrt(400 - v * v))} ${f(ly + v)}h${f(2 * Math.sqrt(400 - v * v))}" stroke="#E8A85A" stroke-width=".8" opacity=".7"/>`).join("")}<circle cx="${f(lx)}" cy="${f(ly)}" r="16.5" fill="#0C1A16" stroke="${c}" stroke-width="2"/><rect x="${f(lx - 7)}" y="${f(ly + 19)}" width="14" height="5" rx="1.5" fill="#2A1A0E"/><text x="${f(lx)}" y="${f(ly + 37)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10" fill="${c}" stroke="#0C1A16" stroke-width="2.6" paint-order="stroke">${NOMS[k]}</text>`);
        a.push(`<circle cx="${f(lx)}" cy="${f(ly)}" r="19" fill="none" stroke="${c}" stroke-width="2.4" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.25;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/><animate attributeName="r" values="18;26;26;18" keyTimes="0;.25;.26;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/>`)}</circle>`); });
      K.prendre(lx0 + 66, ry, 90); bulle(x - 20, y - 100 * sc, "Le bus des esprits arrive…", 10, 5); }
    // ---- 10. la forêt : grands arbres bleu-vert (les scènes et la clairière restent dégagées)
    const PAL = [["#5FC09A", "#22705E", "#0C3430"], ["#7ACC90", "#2E7A56", "#10402C"], ["#4FA0B0", "#1E5A6A", "#0A2834"], ["#94CC78", "#3A7A40", "#14361C"]];
    const clair = (x, y) => K.inside(x, y) && Math.hypot((x - K.cx) / 330, (y - K.cy) / 215) < 1;
    const arbres = []; K.semis(240, () => 13 + r() * 16, 9000, (x, y) => !clair(x, y) || r() < .008, (x, y, R) => arbres.push([x, y, R]));
    s.push("<!--fin-->"); arbres.sort((p, q) => p[1] - q[1]).forEach(([x, y, R]) => { const p = PAL[Math.floor(r() * PAL.length)]; K.arbre(x, y, R, p[0], p[1], p[2]); });
    { const i1 = s.indexOf("<!--fin-->"), dess = s.splice(i1).slice(1), i0 = s.indexOf("<!--arbres-->"); s.splice(i0, 1, ...dess); }
    // quelques bouquets de lucioles accrochés aux cimes
    // ---- 11. la piste : chemin de terre bordé de mousse, cailloux pâles
    K.route([["#020A08", 40, ` opacity=".55" filter="url(#fo-flou)"`], ["#3E6A3A", 31], ["#4A3420", 27], ["url(#fo-terre)", 23]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#E8D8B0" stroke-width="1.1" stroke-dasharray="1 13" opacity=".55"/>`);
    K.depart();
    // le pont de bois sur la rivière
    { let ib = L.iB, bm = 1e9; for (let i = 0; i < K.N; i++) { const d = L.dRiv(K.P[i][0], K.P[i][1]); if (d < bm) { bm = d; ib = i; } }
      const [px, py] = K.P[ib], [nx, ny, tx, ty] = K.nrm(ib), ang = Math.atan2(ty, tx) * 57.3;
      s.push(`<g transform="translate(${f(px)} ${f(py)}) rotate(${f(ang)})"><rect x="-22" y="-19" width="44" height="38" fill="#000" opacity=".4" transform="translate(3 4)"/>${Array.from({ length: 11 }, (_, q) => `<rect x="${-22 + q * 4}" y="-17" width="3.6" height="34" fill="${q % 2 ? "#8A5A2E" : "#7A4E26"}"/>`).join("")}<path d="M-24 -18h48M-24 18h48" stroke="#4A2E16" stroke-width="3.4" stroke-linecap="round"/>${[-24, 24].map(u => `<circle cx="${u}" cy="-18" r="2.6" fill="#C8283A" ${INK}/><circle cx="${u}" cy="18" r="2.6" fill="#C8283A" ${INK}/>`).join("")}</g>`);
      [[-24, -18], [24, 18]].forEach(([u, v]) => { const x = px + tx * u + nx * v * 1.3, y = py + ty * u + ny * v * 1.3; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="url(#fo-lant)"/>`); }); }
    // ---- 12. l'arbre centenaire : la piste passe dans son tronc creux (comme en 3D) ; cime immense, racines lumineuses, corde sacrée
    { const [ex, ey] = TT, RX = 92, RY = 46, dans = (x, y) => ((x - ex) / RX) ** 2 + ((y - ey) / RY) ** 2 < 1, cx2 = ex, cy2 = ey - 66;
      // les racines qui plongent dans la clairière (veinées de lumière)
      for (let k = 0; k < 8; k++) { const t = PI * (.1 + k * .114 + (r() - .5) * .05), x0 = ex + Math.cos(t) * RX * .85, y0 = ey + Math.sin(t) * RY * .85, L1 = 40 + r() * 55, x1 = ex + Math.cos(t) * (RX + L1), y1 = ey + Math.sin(t) * (RY + L1 * .9); if (K.dT((x0 + x1) / 2, (y0 + y1) / 2) < 16 || K.dT(x1, y1) < 12) continue;
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, b = (r() - .5) * 26, w = 13 + r() * 6, mx = (x0 + x1) / 2 + nx * b, my = (y0 + y1) / 2 + ny * b;
        const rac = `M${f(x0 + nx * w)} ${f(y0 + ny * w)}Q${f(mx + nx * w * .75)} ${f(my + ny * w * .75)} ${f(x1)} ${f(y1)}Q${f(mx - nx * w * .75)} ${f(my - ny * w * .75)} ${f(x0 - nx * w)} ${f(y0 - ny * w)}Z`;
        s.push(`<path d="${rac}" fill="#1A0E06" opacity=".55" transform="translate(3 4)"/><path d="${rac}" fill="#5A3C22" ${INK}/><path d="M${f(x0)} ${f(y0)}Q${f(mx)} ${f(my)} ${f(x1)} ${f(y1)}" stroke="#7CF2E8" stroke-width="1.6" fill="none" opacity=".8"/><path d="M${f(x0 + nx * w * .5)} ${f(y0 + ny * w * .5)}Q${f(mx + nx * w * .45)} ${f(my + ny * w * .45)} ${f(x1)} ${f(y1)}" stroke="#8A6440" stroke-width="2" fill="none"/><circle cx="${f(x1)}" cy="${f(y1)}" r="7" fill="url(#fo-cyan)" opacity=".8"/>`);
        if (r() < .7) { const u = x0 + dx * .6 + nx * b * .5, v = y0 + dy * .6 + ny * b * .5, q = (r() < .5 ? 1 : -1) * 18; s.push(`<path d="M${f(u)} ${f(v)}q${f(nx * q * .5 + dx * .1)} ${f(ny * q * .5 + dy * .1)} ${f(nx * q + dx * .2)} ${f(ny * q + dy * .2)}" stroke="#5A3C22" stroke-width="3" stroke-linecap="round" fill="none"/>`); } }
      // la cime immense (au nord, coupée par le bord) : touffes en couches, du sombre au clair
      s.push(`<ellipse cx="${f(cx2 + 12)}" cy="${f(cy2 + 24)}" rx="220" ry="96" fill="#000" opacity=".5" filter="url(#fo-flou8)"/>`);
      [[1, "#0E3A30"], [.84, "#1E5A44"], [.66, "#2F7A5C"], [.44, "#5AA874"], [.24, "#8ACB8A"]].forEach(([k, c], e) => { for (let q = 0; q < 18; q++) { const t = q / 18 * TAU + e * .4, d = .66 + r() * .16; s.push(`<circle cx="${f(cx2 + Math.cos(t) * 205 * k * d - e * 7)}" cy="${f(cy2 + Math.sin(t) * 80 * k * d - e * 7)}" r="${f(80 * k * .42)}" fill="${c}"/>`); } s.push(`<ellipse cx="${f(cx2 - e * 7)}" cy="${f(cy2 - e * 7)}" rx="${f(205 * k * .72)}" ry="${f(80 * k * .72)}" fill="${c}"/>`); });
      for (let q = 0; q < 50; q++) { const t = r() * TAU, d = Math.sqrt(r()), x = cx2 + Math.cos(t) * 190 * d, y = cy2 + Math.sin(t) * 82 * d; if (y < 2) continue; s.push(`<path d="M${f(x - 5)} ${f(y)}q5 -5 10 0" stroke="#B8EA9A" stroke-width="1.4" fill="none" opacity=".5"/>`); }
      // le tronc vu d'en haut : grand anneau d'écorce, creux sombre, mousse
      s.push(`<ellipse cx="${f(ex + 5)}" cy="${f(ey + 8)}" rx="${RX + 6}" ry="${RY + 6}" fill="#000" opacity=".55" filter="url(#fo-flou)"/><ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${RX}" ry="${RY}" fill="#5A3C22" ${INK}/><ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${RX * .68}" ry="${RY * .62}" fill="#1E120A"/>`);
      for (let q = 0; q < 40; q++) { const t = q / 40 * TAU, a0 = .7 + r() * .05, a1 = .96; s.push(`<path d="M${f(ex + Math.cos(t) * RX * a0)} ${f(ey + Math.sin(t) * RY * a0)}L${f(ex + Math.cos(t + .03) * RX * a1)} ${f(ey + Math.sin(t + .03) * RY * a1)}" stroke="${q % 2 ? "#3A2412" : "#7A5434"}" stroke-width="1.6"/>`); }
      for (let q = 0; q < 7; q++) { const t = r() * TAU; s.push(`<ellipse cx="${f(ex + Math.cos(t) * RX * .86)}" cy="${f(ey + Math.sin(t) * RY * .84)}" rx="${f(6 + r() * 6)}" ry="3.4" fill="#4E8A3A" opacity=".9"/>`); }
      // le tunnel : la piste traverse le tronc, plancher de bois, racines lumineuses de chaque côté
      const inT = []; for (let i = 0; i < K.N; i++) if (dans(K.P[i][0], K.P[i][1])) inT.push(i);
      if (inT.length) { let i0 = inT[0], i1 = inT[inT.length - 1]; for (let q = 1; q < inT.length; q++) if (inT[q] !== inT[q - 1] + 1) { i0 = inT[q]; i1 = inT[q - 1]; }
        const seg = []; for (let i = i0; ; i = (i + 1) % K.N) { seg.push(K.P[i]); if (i === i1 || seg.length > K.N) break; }
        const d = "M" + seg.map(p => f(p[0]) + " " + f(p[1])).join("L");
        s.push(`<path d="${d}" fill="none" stroke="#0A0604" stroke-width="34"/><path d="${d}" fill="none" stroke="#6A4628" stroke-width="23"/><path d="${d}" fill="none" stroke="#8A6038" stroke-width="23" stroke-dasharray="1.5 5" opacity=".7"/>`);
        for (let q = 2; q < seg.length - 1; q += 5) { const i = (i0 + q) % K.N, [nx, ny] = K.nrm(i), p = K.P[i]; [-1, 1].forEach(sd => s.push(`<circle cx="${f(p[0] + nx * sd * 15)}" cy="${f(p[1] + ny * sd * 15)}" r="7" fill="url(#fo-cyan)"/><circle cx="${f(p[0] + nx * sd * 15)}" cy="${f(p[1] + ny * sd * 15)}" r="1.8" fill="#E8FFFF"/>`)); }
        [i0, i1].forEach(i => { const [nx, ny] = K.nrm(i), p = K.P[i], ang = Math.atan2(ny, nx) * 57.3; s.push(`<g transform="translate(${f(p[0])} ${f(p[1])}) rotate(${f(ang)})"><path d="M-21 -4Q0 -12 21 -4L21 3L-21 3Z" fill="#3A2412" ${INK}/><path d="M-19 -2Q0 -9 19 -2" stroke="#9A7448" stroke-width="1.4" fill="none"/></g>`); });
        a.push(`<path d="${d}" fill="none" stroke="#7CF2E8" stroke-width="22" opacity="${K.anime ? .05 : .1}">${an(`<animate attributeName="opacity" values=".02;.16;.02" dur="4s" repeatCount="indefinite"/>`)}</path>`); }
      // la corde sacrée tressée autour du tronc et ses papiers en zigzag
      const corde = `M${f(ex - RX * 1.02)} ${f(ey + 4)}A${f(RX * 1.02)} ${f(RY * 1.05)} 0 0 0 ${f(ex + RX * 1.02)} ${f(ey + 4)}`;
      s.push(`<path d="${corde}" stroke="#2A1A0A" stroke-width="7.5" fill="none" opacity=".6"/><path d="${corde}" stroke="#E8D8A0" stroke-width="5" fill="none"/><path d="${corde}" stroke="#A08A50" stroke-width="1.4" stroke-dasharray="3 3" fill="none"/>`);
      [.18, .34, .66, .82].forEach(t => { const th = t * PI, x = ex + Math.cos(PI - th) * RX * 1.02, y = ey + 4 + Math.sin(th) * RY * 1.05; s.push(`<path d="M${f(x)} ${f(y)}l4 4l-4 3l4 4l-4 3" stroke="#FFFFFF" stroke-width="2.4" fill="none"/>`); });
      // la hulotte dans la cime et les petits esprits assis sur les racines
      s.push(`${G(cx2 + 120, cy2 + 70, 1.3)}<ellipse rx="9" ry="11" fill="#1A0E06"/><ellipse cy="1" rx="6" ry="7.5" fill="#8A6A48" ${INK}/><circle cx="-2.4" cy="-1" r="2.2" fill="#FFE08A"/><circle cx="2.4" cy="-1" r="2.2" fill="#FFE08A"/><circle cx="-2.4" cy="-1" r=".9" fill="#0C1A16"/><circle cx="2.4" cy="-1" r=".9" fill="#0C1A16"/><path d="M-1 1.6l1 1.6l1 -1.6z" fill="#E2B93B"/></g>`);
      const kc = []; for (let e = 0; e < 400 && kc.length < 3; e++) { const t = PI * (.15 + r() * .7), d = 1.05 + r() * .5, x = ex + Math.cos(t) * RX * d, y = ey + Math.sin(t) * RY * d + 8; if (K.dT(x, y) > 18 && !kc.some(p => Math.hypot(p[0] - x, p[1] - y) < 22)) kc.push([x, y, (r() - .5) * 28]); }
      [[cx2 - 150, cy2 + 70], [cx2 - 60, cy2 + 84]].forEach(([x, y]) => { if (y > 14 && K.dT(x, y) > 16) kc.push([x, y, 0]); });
      a.push(`<g>${kc.map(([x, y, t], q) => `<g transform="translate(${f(x)} ${f(y)})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="0;${q % 2 ? 14 : -14};0;0" keyTimes="0;.06;.12;1" dur="${(3 + q * .7).toFixed(1)}s" begin="${(q * .4).toFixed(1)}s" repeatCount="indefinite"/>`)}${kodama(0, 0, 1.4, t)}</g></g>`).join("")}</g>`); }
    // ---- 13. les petits esprits blancs dans les bois (têtes qui cliquettent)
    for (let g = 0; g < 4; g++) { const p = place([140, W - 60, 60, K.cx + 250][g], [380, 420, 690, K.cy - 200][g], 18, 20, 160); if (!p) continue; const [x, y] = p, n = 3 + (g % 2);
      a.push(`<g>${Array.from({ length: n }, (_, q) => { const u = x + (q - n / 2) * 13 + (r() - .5) * 4, v = y + (q % 2) * 7; return `<g transform="translate(${f(u)} ${f(v)})"><g>${an(q === 0 ? `<animateTransform attributeName="transform" type="rotate" values="0;-16;12;0;0" keyTimes="0;.05;.1;.15;1" dur="${(4 + g).toFixed(1)}s" begin="${g * .9}s" repeatCount="indefinite"/>` : "")}${kodama(0, 0, 1.3, (r() - .5) * 30)}</g></g>`; }).join("")}</g>`); }
    // ---- 14. lanternes de papier au bord du chemin (rouges et ambre)
    { const lan = []; for (let i = 8; i < K.N; i += 34) { const [nx, ny] = K.nrm(i), sd = (i / 34) % 2 < 1 ? 1 : -1, x = K.P[i][0] + nx * sd * 22, y = K.P[i][1] + ny * sd * 22; if (K.occ.some(o => o[2] > 25 && Math.hypot(o[0] - x, o[1] - y) < o[2] * .75) || x < 8 || y < 8 || x > W - 8 || y > H - 8) continue; lan.push([x, y]); }
      lan.forEach(([x, y], q) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="17" fill="url(#fo-lant)" opacity=".85"/><path d="M${f(x)} ${f(y + 5)}v6" stroke="#2A1A0E" stroke-width="1.4"/><rect x="${f(x - 3.4)}" y="${f(y - 6)}" width="6.8" height="10" rx="3" fill="${q % 3 ? "#E8502A" : "#FFC45C"}" stroke="#5A1A0A" stroke-width=".8"/><path d="M${f(x - 3.4)} ${f(y - 1)}h6.8" stroke="#FFE2A8" stroke-width=".6" opacity=".8"/>`));
      a.push(`<g opacity="${K.anime ? .5 : .6}">${an(`<animate attributeName="opacity" values=".3;.75;.45;.8;.3" dur="2.3s" repeatCount="indefinite"/>`)}${lan.filter((_, q) => q % 2).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="url(#fo-lant)"/>`).join("")}</g>`); }
    // ---- 15. la procession des esprits à lanternes, à travers la clairière
    { const pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, base = [K.cx - 230 + t * 420, K.cy + 150 - Math.sin(t * PI) * 40]; let best = base, bd = -1; for (let e = 0; e < 40; e++) { const x = base[0] + (r() - .5) * 30, y = base[1] + (r() - .5) * 30, d = Math.min(K.dT(x, y), ...K.occ.filter(o => o[2] > 25).map(o => Math.hypot(o[0] - x, o[1] - y) - o[2] * .8)); if (d > bd) { bd = d; best = [x, y]; } } pts.push(best); }
      const PD = lisse(pts); s.push(`<path d="${PD}" fill="none" stroke="#B8A070" stroke-width="5" stroke-linecap="round" opacity=".35" stroke-dasharray="2 7"/>`);
      const marcheur = c => `<g><circle cy="-14" r="11" fill="url(#fo-lant)"/>${kodama(0, 0, 1.15, 0)}<path d="M4 -4l5 -6" stroke="#5A3A1E" stroke-width="1"/><rect x="7" y="-14" width="5" height="6" rx="2" fill="${c}" stroke="#5A1A0A" stroke-width=".6"/></g>`;
      for (let q = 0; q < 5; q++) { const c = q < 4 ? COULEURS_J[q] : "#FFC45C"; if (K.anime) a.push(`<g>${`<animateMotion dur="40s" begin="${-q * 2.4}s" repeatCount="indefinite" path="${PD.replace(/(-?\d+\.\d) (-?\d+\.\d)/g, "$1,$2")}"/>`}${marcheur(c)}</g>`); else { const p = pts[2 + q]; a.push(`<g transform="translate(${f(p[0])} ${f(p[1])})">${marcheur(c)}</g>`); } } }
    // ---- 16. le chat-bus qui bondit sur les cimes (coin haut droit), yeux-phares allumés
    { const chat = `<g transform="scale(1.1)"><path d="M-62 -14l-90 -18v40l90 -6z" fill="#FFE08A" opacity=".08"/>
        <path d="M58 -10Q76 -24 70 -42" stroke="#C8782E" stroke-width="6" stroke-linecap="round" fill="none"/>
        ${[-40, -12, 16, 44].map((u, q) => `<path d="M${u} 14l${q % 2 ? -6 : 6} 14M${u + 8} 14l${q % 2 ? 6 : -6} 14" stroke="#B06A26" stroke-width="5" stroke-linecap="round"/>`).join("")}
        <path d="M-50 -10Q-52 -28 -30 -30L44 -30Q62 -28 62 -8Q62 16 42 18L-40 18Q-56 16 -50 -10Z" fill="url(#fo-chat)" ${INK}/>
        ${[-30, -8, 14, 36].map(u => `<rect x="${u - 7}" y="-22" width="15" height="12" rx="3" fill="#FFE08A" stroke="#7A4A1E" stroke-width="1.2"/>`).join("")}
        ${[-36, -18, 2, 22, 42].map(u => `<path d="M${u} 6l3 8M${u + 4} 4l2 9" stroke="#9A5A1E" stroke-width="1.6"/>`).join("")}
        <path d="M-52 -34L-46 -50L-36 -32Z M-30 -32L-22 -48L-16 -30Z" fill="#D88A36" ${INK}/>
        <path d="M-64 -14Q-68 -36 -46 -36Q-28 -36 -28 -14Q-30 6 -48 6Q-64 6 -64 -14Z" fill="url(#fo-chat)" ${INK}/>
        <circle cx="-54" cy="-22" r="6" fill="#FFF6A0" stroke="#7A4A1E" stroke-width="1"/><circle cx="-38" cy="-22" r="6" fill="#FFF6A0" stroke="#7A4A1E" stroke-width="1"/><ellipse cx="-55" cy="-22" rx="1.2" ry="3.6" fill="#0C1A16"/><ellipse cx="-39" cy="-22" rx="1.2" ry="3.6" fill="#0C1A16"/>
        <path d="M-62 -8Q-46 6 -30 -8Q-46 0 -62 -8Z" fill="#FFFFFF" ${INK}/>${[-58, -54, -50, -46, -42, -38, -34].map(u => `<path d="M${u} -6v3" stroke="#0C1A16" stroke-width=".6"/>`).join("")}
        <path d="M-64 -12h-12M-64 -9l-11 3M-28 -12h12" stroke="#5A3A1E" stroke-width=".8"/>
        <rect x="-8" y="-42" width="40" height="10" rx="2" fill="#2A1A0E" stroke="#E2B93B" stroke-width="1"/><text x="12" y="-34.5" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="7" fill="#FFE08A">LUCIOLES</text>
        <circle cx="-62" cy="-2" r="34" fill="url(#fo-lant)" opacity=".35"/></g>`;
      a.push(`<g${K.anime ? "" : ` transform="translate(910 82)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="1260 70;1060 40;900 84;760 36;620 74;470 30;300 66;-160 50" keyTimes="0;.125;.25;.375;.5;.625;.75;1" dur="26s" begin="-6s" repeatCount="indefinite"/>`)}<g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1.03 .94;1 1" dur=".5s" repeatCount="indefinite"/>`)}${chat}</g></g>`); }
    // ---- 17. le panneau-titre accroché à une branche (coin haut gauche)
    { const x = 16, y = 18, w = 168; if (K.dT(x + w, y + 40) > 30 && K.dT(x + w / 2, y + 48) > 30) {
      s.push(`<path d="M0 6Q90 -4 ${x + w + 20} 4" stroke="#3A2A1A" stroke-width="7" stroke-linecap="round" fill="none"/>${[[60, 0], [140, 2]].map(([u, v]) => `<ellipse cx="${u}" cy="${v}" rx="8" ry="4" fill="#4E8A3A" ${INK} transform="rotate(-20 ${u} ${v})"/>`).join("")}
        <path d="M${x + 12} 6v${y - 2}M${x + w - 12} 6v${y - 2}" stroke="#C8B080" stroke-width="1.2"/><rect x="${x}" y="${y}" width="${w}" height="40" rx="6" fill="url(#fo-bois)" ${INK}/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="32" rx="4" fill="none" stroke="#E2B93B" stroke-width="1" opacity=".7"/>
        <text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="14" fill="#FFF0C0" stroke="#2A1A0A" stroke-width="2.4" paint-order="stroke">La Forêt aux lucioles</text>
        <text x="${x + w / 2}" y="${y + 31}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="8.5" fill="#F7E3A0">« Chut… les esprits dorment. »</text>`); } }
    // ---- 17 bis. rayons de lune obliques sur la clairière
    s.push(`<linearGradient id="fo-rayon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8F4FF" stop-opacity=".13"/><stop offset="1" stop-color="#D8F4FF" stop-opacity="0"/></linearGradient>`);
    [[620, 70, 90], [760, 40, 60], [420, 120, 70]].forEach(([u, w, lg]) => s.push(`<path d="M${u} -10h${w}l${-260 - lg} ${H * .75}h${-w * 1.6}z" fill="url(#fo-rayon)" filter="url(#fo-flou8)"/>`));
    // ---- 18. les lucioles par milliers : des centaines figées dans le fond, 8 essaims qui clignotent ensemble, 3 qui dérivent
    for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H, c = r() < .8 ? "#EFFF9A" : "#BFFFE8"; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.6 + r() * 1)}" fill="${c}" opacity="${(.35 + r() * .6).toFixed(2)}"/>`); if (k % 5 === 0) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(4 + r() * 4)}" fill="url(#fo-luc)" opacity=".45"/>`); }
    for (let g = 0; g < 8; g++) { const gx = r() * W, gy = r() * H, o = (.6 + r() * .4).toFixed(2); a.push(`<g opacity="${K.anime ? o : .8}">${an(`<animate attributeName="opacity" values="${o};.05;${o}" dur="${(2.6 + r() * 2.4).toFixed(2)}s" begin="${(g * .55).toFixed(2)}s" repeatCount="indefinite"/>`)}${Array.from({ length: 34 }, () => { const x = (gx + (r() - .5) * 420 + W) % W, y = (gy + (r() - .5) * 300 + H) % H, t = 2 + r() * 3; return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(t)}" fill="url(#fo-luc)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(t * .25)}" fill="#FBFFD0"/>`; }).join("")}</g>`); }
    for (let g = 0; g < 3; g++) { const gx = [K.cx - 120, K.cx + 120, K.cx][g], gy = [K.cy - 40, K.cy + 40, K.cy - 140][g]; a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f(30 + r() * 30)} ${f(-20 - r() * 20)};${f(-20 - r() * 20)} ${f(-10)};0 0" dur="${(9 + g * 3)}s" repeatCount="indefinite"/>`)}${Array.from({ length: 24 }, () => { const x = gx + (r() - .5) * 160, y = gy + (r() - .5) * 110, t = 2.4 + r() * 3; return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(t)}" fill="url(#fo-luc)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(t * .25)}" fill="#FBFFD0"/>`; }).join("")}</g>`); }
    // ---- 19. trois lanternes célestes qui s'envolent de la clairière
    for (let q = 0; q < 3; q++) { const x = K.cx - 160 + q * 150 + (r() - .5) * 40, y = K.cy + 60 + (r() - .5) * 40, du = (14 + q * 3).toFixed(0);
      a.push(`<g${K.anime ? "" : ` transform="translate(${q * 10} ${-90 - q * 30})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 60)} -${f(y + 40)}" dur="${du}s" begin="${-q * 4.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" dur="${du}s" begin="${-q * 4.5}s" repeatCount="indefinite"/>`)}<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="url(#fo-lant)"/><path d="M${f(x - 5)} ${f(y - 7)}h10l-1.6 13h-6.8z" fill="#FFB24A" stroke="#8A3A1A" stroke-width=".8"/><circle cx="${f(x)}" cy="${f(y + 4)}" r="1.8" fill="#FFF6C8"/></g>`); }
    // ---- 20. les 4 pilotes sur le chemin : petites lucioles-bolides aux couleurs des 4
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .025, `<g><circle cx="-7" r="7" fill="url(#fo-luc)"/><ellipse rx="6.5" ry="4.2" fill="${c}" ${INK}/><ellipse cx="2" cy="0" rx="2.6" ry="2.4" fill="#0C1A16"/><path d="M-3 -3.6q-3 -5 -7 -3M-3 3.6q-3 5 -7 3" fill="#E8FFFF" stroke="#0C1A16" stroke-width=".6" opacity=".85"/><circle cx="-7" r="2.4" fill="#FBFFD0"/></g>`, 44, k * 1.3)));
    return Object.assign(K.fin(`<rect width="${W}" height="${H}" fill="url(#fo-sol)"/>`, "#0A2030", .07), { portraits: PORTR });
  }

  /* ---------- Février · Le château, pièce par pièce (v4 : la carte du maraudeur, grandes scènes) ----------
     La carte-parchemin magique : la piste traverse le château pièce par pièce (Grande Salle, escaliers qui bougent, couloir des
     tableaux, cachots, serres, banque et son dragon, terrain de Quidditch, pont couvert). Chaque pièce est une grande scène
     illustrée à l'encre et à l'aquarelle ; les prénoms des 4 pilotes se promènent sur la carte avec leurs traces de pas ;
     les 4 sabliers des points ; « Je jure solennellement… » s'écrit tout seul en haut. */
  /* ---------- Février · L'école des sorciers, la nuit (v5 : grande scène illustrée, course de balais) ----------
     Une seule lumière : la lune (en haut à gauche, dans la boucle du tracé) et les fenêtres dorées. Le château en grand, en légère
     perspective, sur sa falaise au-dessus du lac noir ; ses deux plus hautes tours se dressent dans les créneaux du tracé (le tracé
     de Djeddah a la forme d'un rempart). La Grande Salle est vue en coupe à travers sa verrière : plafond étoilé, bougies qui flottent,
     4 tables aux couleurs des pilotes. Autour : le terrain de Quidditch et ses tours de gradins, le saule cogneur qui fouette, la forêt
     interdite et ses yeux, la cabane du garde-chasse, le pont couvert, la volière d'où partent les hiboux du courrier, le dragon qui
     survole, le calmar géant qui sort une tentacule, les barques des premières années, et un cerf argenté qui chasse les détraqueurs.
     La piste est une voie aérienne balisée d'anneaux d'or ; les 4 pilotes la courent sur leurs balais, écharpes à leurs couleurs.
     Les 4 tableaux (à droite) reçoivent les vrais portraits posés par l'appli (RES.portraits). Tout est dessiné ici. */
  function peindreChateau5(T, Z, def) {
    const K = kit(T, def, 52, "c5-"), { s, a, r, f, W, H, P, N } = K, an = x => K.anime ? x : "", CJ = COULEURS_J, NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    const OR = "#F2C64A", NUIT = "#0A0F24", INK = `stroke="#0A0D1C" stroke-width="1"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const nom = (x, y, txt, t, op) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${t || 12}" fill="#F3E4B4" stroke="#070A18" stroke-width="3.2" paint-order="stroke" opacity="${op || .92}" letter-spacing=".4">${txt}</text>`);
    const LUM = [];   // fenêtres allumées (halo posé après coup)
    const fen = (x, y, w, h, lit, c) => { if (lit) LUM.push([x, y + h / 2, w * 2.6]); return `<path d="M${f(x - w / 2)} ${f(y + h)}V${f(y + w / 2)}a${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(w)} 0V${f(y + h)}Z" fill="${lit ? (c || (r() < .3 ? "#FFE6A0" : "#FFC85A")) : "#10152C"}"/>`; };
    // ---- 0. dégradés
    s.push(`<linearGradient id="c5-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050818"/><stop offset=".25" stop-color="#0C1434"/><stop offset=".48" stop-color="#1B2A5E"/><stop offset=".56" stop-color="#2A3F78"/><stop offset=".6" stop-color="#16213F"/><stop offset="1" stop-color="#0B1222"/></linearGradient>`);
    s.push(`<linearGradient id="c5-pi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A8CB8"/><stop offset=".3" stop-color="#4E5D88"/><stop offset=".7" stop-color="#2C365C"/><stop offset="1" stop-color="#161C36"/></linearGradient>`);
    s.push(`<linearGradient id="c5-pi2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E6E9A"/><stop offset=".6" stop-color="#36416A"/><stop offset="1" stop-color="#1C2342"/></linearGradient>`);
    s.push(`<linearGradient id="c5-to" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A5A92"/><stop offset=".45" stop-color="#2A3462"/><stop offset="1" stop-color="#10142C"/></linearGradient>`);
    s.push(`<linearGradient id="c5-ro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E4868"/><stop offset=".4" stop-color="#1E2540"/><stop offset="1" stop-color="#090C18"/></linearGradient>`);
    s.push(`<linearGradient id="c5-lac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2C58"/><stop offset=".35" stop-color="#0D1836"/><stop offset="1" stop-color="#050A18"/></linearGradient>`);
    s.push(`<linearGradient id="c5-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E3238"/><stop offset="1" stop-color="#0C171C"/></linearGradient>`);
    s.push(`<linearGradient id="c5-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".4" stop-color="#E8B83A"/><stop offset=".8" stop-color="#A8741E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
    s.push(`<linearGradient id="c5-salle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101A48"/><stop offset=".55" stop-color="#2A2A5A"/><stop offset="1" stop-color="#6A4A2A"/></linearGradient>`);
    s.push(`<radialGradient id="c5-lune" r="50%"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".7" stop-color="#F2EBCB"/><stop offset="1" stop-color="#D8CFAA"/></radialGradient>`);
    s.push(`<radialGradient id="c5-brume" r="50%"><stop offset="0" stop-color="#8FA8E0" stop-opacity=".35"/><stop offset="1" stop-color="#8FA8E0" stop-opacity="0"/></radialGradient>`);

    // ---- 1. le ciel : étoiles, voie lactée, lune (cadrée par la boucle haut-gauche du tracé)
    s.push(`<path d="M0 30Q300 140 560 60T1080 120" stroke="#9FB4FF" stroke-width="70" opacity=".05" fill="none" filter="url(#c5-flou8)"/>`);
    for (let k = 0; k < 240; k++) { const x = r() * W, y = r() * 380, t = r(); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(t < .9 ? .5 + r() * .7 : 1.3 + r())}" fill="${t < .8 ? "#E8EEFF" : "#FFF2C8"}" opacity="${f(.3 + r() * .6)}"/>`); }
    const LX = 255, LY = 152;
    K.halo(LX, LY, 210, "#9FB8F0", .35); K.halo(LX, LY, 80, "#FFF6D8", .5);
    s.push(`<circle cx="${LX}" cy="${LY}" r="31" fill="url(#c5-lune)"/><circle cx="${LX - 9}" cy="${LY - 6}" r="6" fill="#D8CFAA" opacity=".5"/><circle cx="${LX + 10}" cy="${LY + 8}" r="8" fill="#D8CFAA" opacity=".4"/><circle cx="${LX + 4}" cy="${LY - 14}" r="3.5" fill="#D8CFAA" opacity=".45"/>`);
    // nuages fins devant la lune
    s.push(`<path d="M190 176q30 -10 60 -2q30 -10 70 2q-40 8 -130 0z" fill="#3A4C80" opacity=".55"/><path d="M640 250q50 -14 110 -3q40 -8 90 4q-90 10 -200 -1z" fill="#2A3A6A" opacity=".5"/>`);

    // ---- 2. les montagnes au loin et la brume de l'horizon
    s.push(`<path d="M0 330L60 296L120 318L190 270L250 300L300 286L360 318L420 300L470 330L560 310L640 322L720 288L790 300L850 262L920 296L990 274L1080 300V420H0Z" fill="#1A2652"/><path d="M0 330L60 296L120 318L190 270L250 300L300 286L360 318M720 288L790 300L850 262L920 296L990 274L1080 300" fill="none" stroke="#5A72B4" stroke-width="1.4" opacity=".5"/>`);
    s.push(`<path d="M0 360L80 336L150 352L230 330L330 356L460 344L600 352L760 330L880 344L1000 326L1080 340V430H0Z" fill="#14203F"/>`);
    s.push(`<ellipse cx="540" cy="360" rx="620" ry="34" fill="url(#c5-brume)"/>`);

    // ---- 3. le sol : plateau du Quidditch à gauche, colline de la forêt à droite
    s.push(`<path d="M0 410C90 392 260 386 360 420L380 520L340 610L0 615Z" fill="url(#c5-sol)"/><path d="M0 410C90 392 260 386 360 420" stroke="#4E6A88" stroke-width="1.5" opacity=".6" fill="none"/>`);
    s.push(`<path d="M760 330C820 300 930 286 1080 296V620L780 610Z" fill="url(#c5-sol)"/>`);

    // ---- 4. la forêt interdite (colline de droite), sombre, quelques cimes touchées par la lune
    const sapin = (x, y, h, c, lu) => { const w = h * .42; let d = `M${f(x)} ${f(y - h)}`; for (let e = 0; e < 4; e++) { const yy = y - h + (e + 1) * h / 4, ww = w * (e + 1) / 4; d += `L${f(x + ww)} ${f(yy)}L${f(x + ww * .45)} ${f(yy - 2)}`; } for (let e = 3; e >= 0; e--) { const yy = y - h + (e + 1) * h / 4, ww = w * (e + 1) / 4; d += `L${f(x - ww * .45)} ${f(yy - 2)}L${f(x - ww)} ${f(yy)}`; } return `<path d="${d}Z" fill="${c}"/>` + (lu ? `<path d="M${f(x)} ${f(y - h)}L${f(x - w * .25)} ${f(y - h * .75)}" stroke="#6A86C0" stroke-width="1.2" opacity=".6"/>` : ""); };
    for (let rang = 0; rang < 4; rang++) for (let k = 0; k < 16; k++) { const x = 778 + k * 11.5 + r() * 8 + rang * 4, y = 330 + rang * 34 + r() * 14 - (x - 780) * .08 + (k % 2) * 6; if (x > 948) continue; s.push(sapin(x, y, 46 + r() * 30 - rang * 2, ["#0F2230", "#0C1C28", "#0A1822", "#08131C"][rang], rang === 0 && r() < .5)); }
    nom(868, 296, "La forêt interdite", 11.5);

    // ---- 5. le terrain de Quidditch (plateau de gauche) : pelouse, tours de gradins aux couleurs des pilotes, 2 × 3 anneaux
    { const cx = 232, cy = 462;
      s.push(`<ellipse cx="${cx}" cy="${cy + 4}" rx="104" ry="32" fill="#000" opacity=".35" filter="url(#c5-flou)"/><ellipse cx="${cx}" cy="${cy}" rx="98" ry="28" fill="#1F4A3A"/><ellipse cx="${cx}" cy="${cy}" rx="98" ry="28" fill="none" stroke="#9FD0B0" stroke-width="1.2" opacity=".5"/><ellipse cx="${cx}" cy="${cy}" rx="14" ry="5" fill="none" stroke="#CFEAD8" stroke-width="1" opacity=".6"/><path d="M${cx} ${cy - 28}V${cy + 28}" stroke="#CFEAD8" stroke-width="1" opacity=".4"/>`);
      const gradin = (x, yb, h, w, c) => { const yt = yb - h; return `<path d="M${f(x - w / 2)} ${f(yb)}V${f(yt + 10)}L${f(x)} ${f(yt)}L${f(x + w / 2)} ${f(yt + 10)}V${f(yb)}Z" fill="#2A2238"/>` +
        `<path d="M${f(x - w / 2)} ${f(yt + 10)}L${f(x)} ${f(yt)}L${f(x + w / 2)} ${f(yt + 10)}L${f(x + w / 2)} ${f(yt + 4)}L${f(x)} ${f(yt - 8)}L${f(x - w / 2)} ${f(yt + 4)}Z" fill="${mixHex(c, "#000000", .35)}"/>` +
        `<rect x="${f(x - w / 2 + 2)}" y="${f(yt + 12)}" width="${f(w - 4)}" height="${f(h * .5)}" fill="${c}"/>` + [0, 1, 2].map(q => `<rect x="${f(x - w / 2 + 2 + q * (w - 4) / 3)}" y="${f(yt + 12)}" width="${f((w - 4) / 6)}" height="${f(h * .5)}" fill="#000" opacity=".22"/>`).join("") +
        `<path d="M${f(x - w / 2 + 2)} ${f(yt + 12 + h * .5)}l${f((w - 4) / 4)} 6l${f((w - 4) / 4)} -6l${f((w - 4) / 4)} 6l${f((w - 4) / 4)} -6" fill="${c}"/><path d="M${f(x - w / 2)} ${f(yt + 12)}V${f(yb)}" stroke="#7A8CB8" opacity=".5"/>` +
        `<path d="M${f(x - w / 2 - 2)} ${f(yt + 10)}h${f(w + 4)}" stroke="#E8C25A" stroke-width="1.2"/>`; };
      // tours du fond (petites), puis anneaux, puis tours de devant (grandes)
      [[150, 446, 70, 18, 0], [186, 438, 84, 19, 1], [232, 436, 92, 20, 2], [278, 438, 84, 19, 3], [314, 446, 70, 18, 0]].forEach(([x, yb, h, w, k]) => s.push(gradin(x, yb, h, w, CJ[k])));
      const anneaux = (x, sens) => [[-10, 70, 8], [0, 92, 10], [10, 62, 7]].map(([dx, h, R]) => { const xx = x + dx * sens; return `<path d="M${f(xx)} ${f(cy)}V${f(cy - h + R)}" stroke="#C9A24A" stroke-width="1.6"/><ellipse cx="${f(xx)}" cy="${f(cy - h)}" rx="${f(R * .6)}" ry="${f(R)}" fill="none" stroke="url(#c5-or)" stroke-width="2.4"/>`; }).join("");
      s.push(anneaux(146, 1) + anneaux(318, -1));
      [[132, 492, 64, 22, 1], [198, 500, 56, 22, 3], [266, 500, 56, 22, 2], [332, 492, 64, 22, 0]].forEach(([x, yb, h, w, k]) => s.push(gradin(x, yb, h, w, CJ[k])));
      [[132, 432], [332, 432], [232, 348]].forEach(([x, y]) => K.halo(x, y, 30, "#FFB347", .5));
      nom(cx, 524, "Le terrain de Quidditch", 12); }

    // ---- 6. le saule cogneur (devant le terrain, au-dessus de la ligne droite du bas)
    const SX = 236, SY = 606;
    s.push(`<ellipse cx="${SX}" cy="${SY + 2}" rx="46" ry="7" fill="#000" opacity=".4"/><path d="M${SX - 14} ${SY}C${SX - 8} ${SY - 20} ${SX - 18} ${SY - 34} ${SX - 6} ${SY - 50}C${SX + 2} ${SY - 40} ${SX + 4} ${SY - 46} ${SX + 10} ${SY - 52}C${SX + 8} ${SY - 30} ${SX + 4} ${SY - 18} ${SX + 16} ${SY}Z" fill="#3A2A22" stroke="#120C0A" stroke-width="1.2"/><path d="M${SX - 8} ${SY - 8}c4 -10 0 -20 4 -30" stroke="#6A5440" stroke-width="1.6" fill="none"/><path d="M${SX - 24} ${SY}q10 -6 14 -2M${SX + 14} ${SY}q12 -4 22 2" stroke="#3A2A22" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    // petite voiture turquoise coincée dans les branches (clin d'œil)
    s.push(`${G(SX + 34, SY - 66, 1, -18)}<path d="M-12 2h24l-2 -6h-4l-3 -5h-7l-4 5h-4z" fill="#2BB6A3" stroke="#0A1A20" stroke-width="1"/><rect x="-5" y="-8" width="4" height="4" fill="#BFE4F2"/><rect x="1" y="-8" width="4" height="4" fill="#FFE6A0"/><circle cx="-7" cy="3" r="2.4" fill="#111"/><circle cx="7" cy="3" r="2.4" fill="#111"/></g>`);
    nom(SX - 2, SY + 16, "le saule cogneur", 10.5);

    // ---- 7. le château : couches du fond (plus bleues, plus petites), puis le corps, puis les tours avant
    const tour = (x, yb, w, yt, rh, o) => { o = o || {}; let g = `<rect x="${f(x - w / 2)}" y="${f(yt)}" width="${f(w)}" height="${f(yb - yt)}" fill="url(#c5-pi)"/>`;
      g += `<rect x="${f(x - w / 2 - 3)}" y="${f(yt - 5)}" width="${f(w + 6)}" height="7" fill="url(#c5-pi)"/>`;
      if (rh > 0) g += `<path d="M${f(x - w / 2 - 5)} ${f(yt - 4)}L${f(x)} ${f(yt - 4 - rh)}L${f(x + w / 2 + 5)} ${f(yt - 4)}Z" fill="url(#c5-to)"/><path d="M${f(x - w / 2 - 5)} ${f(yt - 4)}L${f(x)} ${f(yt - 4 - rh)}" stroke="#9FB6E8" stroke-width="1.1" opacity=".55"/>`;
      else for (let q = 0; q < 4; q++) g += `<rect x="${f(x - w / 2 - 3 + q * (w + 6) / 4 + 1)}" y="${f(yt - 11)}" width="${f((w + 6) / 8)}" height="7" fill="url(#c5-pi)"/>`;
      if (o.dr) g += `<path d="M${f(x)} ${f(yt - 4 - rh)}v-12" stroke="#0A0D1C" stroke-width="1"/><path d="M${f(x)} ${f(yt - 16 - rh)}l12 2.5l-12 4z" fill="${o.dr}"/>`;
      const n = w > 30 ? 2 : 1; for (let y = yt + 12; y < yb - 14; y += o.pas || 24) for (let j = 0; j < n; j++) g += fen(n === 1 ? x : x + (j ? w * .2 : -w * .2), y, 4.6, 9, r() < (o.lum === undefined ? .55 : o.lum));
      return g + `<path d="M${f(x - w / 2 + .8)} ${f(yt)}V${f(yb)}" stroke="#B8CCF2" stroke-width="1.2" opacity=".35"/>`; };
    const bloc = (x0, x1, yb, yt, rh, o) => { o = o || {}; const w = x1 - x0; let g = `<rect x="${f(x0)}" y="${f(yt)}" width="${f(w)}" height="${f(yb - yt)}" fill="url(#c5-pi2)"/>`;
      g += rh > 0 ? `<path d="M${f(x0 - 3)} ${f(yt)}L${f(x0 + w * .06)} ${f(yt - rh)}L${f(x1 - w * .06)} ${f(yt - rh)}L${f(x1 + 3)} ${f(yt)}Z" fill="url(#c5-to)"/><path d="M${f(x0 + w * .06)} ${f(yt - rh)}H${f(x1 - w * .06)}" stroke="#9FB6E8" stroke-width="1" opacity=".45"/>` : Array.from({ length: Math.floor(w / 9) }, (_, q) => `<rect x="${f(x0 + q * 9 + 1)}" y="${f(yt - 5)}" width="5" height="5" fill="#4E5D88"/>`).join("");
      for (let y = yt + 12; y < yb - 14; y += o.pas || 26) for (let x = x0 + 9; x < x1 - 5; x += o.ec || 15) g += fen(x, y, 4.6, 9, r() < (o.lum === undefined ? .55 : o.lum));
      return g + `<path d="M${f(x0 + .8)} ${f(yt)}V${f(yb)}" stroke="#B8CCF2" stroke-width="1.2" opacity=".3"/>`; };
    // fond (brumeux)
    { const n0 = LUM.length; s.push(`<g opacity=".6">` + bloc(430, 720, 505, 300, 18, { lum: .35, pas: 28, ec: 18 }) + tour(425, 505, 24, 262, 44, { lum: .4 }) + tour(512, 505, 26, 236, 50, { lum: .4 }) + tour(612, 505, 22, 254, 46, { lum: .4 }) + tour(735, 505, 26, 268, 44, { lum: .4 }) + `</g>`); LUM.splice(n0); }
    // la falaise
    s.push(`<path d="M320 612L338 560L352 520L372 498L800 498L822 524L842 570L858 612Q590 640 320 612Z" fill="url(#c5-ro)"/><path d="M338 560L352 520L372 498M360 600L368 556L380 528M420 606l6 -40l14 -30M470 612l4 -50l10 -40" stroke="#7A8CB8" stroke-width="1.3" opacity=".45" fill="none"/>${[[540, 604, 520, 560], [600, 610, 614, 548], [690, 608, 700, 556], [760, 604, 776, 540], [810, 596, 820, 548]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#05070F" stroke-width="2" opacity=".55"/>`).join("")}`);
    // le corps du château
    s.push(tour(392, 505, 30, 176, 74, { dr: CJ[0], lum: .6 }));                   // tour ouest (dans le créneau gauche du tracé)
    s.push(tour(545, 505, 62, 240, 86, { dr: CJ[2], lum: .5, pas: 26 }));          // donjon (dans la boucle du milieu)
    s.push(tour(664, 505, 34, 160, 84, { dr: CJ[1], lum: .65 }));                  // tour d'astronomie (dans le créneau droit)
    s.push(tour(482, 505, 13, 262, 64, { lum: .5, pas: 30 }) + tour(604, 505, 14, 286, 58, { lum: .5, pas: 30 }) + tour(700, 505, 12, 250, 62, { dr: "#E8C25A", lum: .5, pas: 30 }));
    s.push(`<path d="M406 330H515V346H406Z" fill="#3E4A74"/><path d="M404 330L415 320H506L517 330Z" fill="url(#c5-to)"/>${[0, 1, 2, 3, 4].map(q => fen(420 + q * 20, 333, 5, 9, r() < .7)).join("")}<path d="M410 346q12 14 24 0q12 14 24 0q12 14 24 0q12 14 24 0" stroke="#2A3458" stroke-width="3" fill="none"/>`);
    s.push(bloc(372, 470, 505, 392, 22, { lum: .65 }) + bloc(640, 778, 505, 378, 24, { lum: .65 }));
    s.push(tour(455, 505, 24, 316, 46, { lum: .6 }) + tour(724, 505, 28, 304, 54, { dr: CJ[3], lum: .6 }));
    // la Grande Salle : façade, pignon, et la verrière qui montre l'intérieur en coupe
    { const x0 = 466, x1 = 644, yt = 332, gx0 = 494, gx1 = 616, gy = 494;
      s.push(`<path d="M${x0} 505V${yt}L${(x0 + x1) / 2} ${yt - 52}L${x1} ${yt}V505Z" fill="url(#c5-pi2)"/><path d="M${x0 - 6} ${yt + 2}L${(x0 + x1) / 2} ${yt - 56}L${x1 + 6} ${yt + 2}" stroke="url(#c5-to)" stroke-width="9" fill="none" stroke-linejoin="round"/><path d="M${x0 - 6} ${yt + 2}L${(x0 + x1) / 2} ${yt - 56}" stroke="#9FB6E8" stroke-width="1.2" opacity=".55" fill="none"/>`);
      [x0 + 4, x1 - 4].forEach(x => s.push(`<path d="M${x - 6} 505V${yt - 4}l6 -14l6 14V505Z" fill="#3E4A74"/>`));
      // rosace du pignon
      s.push(`<circle cx="${(x0 + x1) / 2}" cy="${yt - 16}" r="12" fill="#FFD27A"/><circle cx="${(x0 + x1) / 2}" cy="${yt - 16}" r="12" fill="none" stroke="#2A3458" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map(q => `<path d="M${(x0 + x1) / 2} ${yt - 16}l${f(Math.cos(q * PI / 3) * 12)} ${f(Math.sin(q * PI / 3) * 12)}" stroke="#2A3458" stroke-width="1.4"/>`).join("")}`); LUM.push([(x0 + x1) / 2, yt - 16, 40]);
      const arc = `M${gx0} ${gy}V${yt + 46}Q${gx0} ${yt + 6} ${(gx0 + gx1) / 2} ${yt - 2}Q${gx1} ${yt + 6} ${gx1} ${yt + 46}V${gy}Z`;
      s.push(`<clipPath id="c5-verr"><path d="${arc}"/></clipPath><path d="${arc}" fill="url(#c5-salle)"/><g clip-path="url(#c5-verr)">`);
      for (let k = 0; k < 40; k++) s.push(`<circle cx="${f(gx0 + r() * (gx1 - gx0))}" cy="${f(yt + r() * 70)}" r="${f(.5 + r() * .8)}" fill="#F4F0FF" opacity="${f(.4 + r() * .6)}"/>`);
      // fond de salle : la table des professeurs et le grand vitrail
      s.push(`<rect x="${gx0}" y="${gy - 44}" width="${gx1 - gx0}" height="44" fill="#4A3020"/><path d="M${gx0} ${gy - 44}H${gx1}" stroke="#E8C25A" stroke-width="1"/><rect x="${gx0 + 22}" y="${gy - 50}" width="${gx1 - gx0 - 44}" height="7" fill="#7A4A26"/><path d="M${(gx0 + gx1) / 2 - 8} ${gy - 50}v-14h16v14" fill="#E2B93B" opacity=".9"/>`);
      // 4 bannières de maisons (couleurs des pilotes, initiales, pas de blason)
      ["T", "K", "C", "D"].forEach((l, k) => { const bx = gx0 + 16 + k * 30; s.push(`<path d="M${bx - 8} ${yt + 70}h16v24l-8 -5l-8 5z" fill="${CJ[k]}"/><text x="${bx}" y="${yt + 85}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="9" fill="#FFF6D8">${l}</text>`); });
      // 4 longues tables en perspective, avec leurs couverts d'or
      [0, 1, 2, 3].forEach(k => { const xa = gx0 + 22 + k * 26, xb = gx0 + 6 + k * 37; s.push(`<path d="M${xa} ${gy - 40}L${xa + 6} ${gy - 40}L${xb + 12} ${gy}L${xb} ${gy}Z" fill="#6A4022"/><path d="M${xa + 3} ${gy - 40}L${xb + 6} ${gy}" stroke="#F7CF55" stroke-width="1.6" stroke-dasharray="1.5 4"/><path d="M${xa - 1} ${gy - 40}L${xb - 5} ${gy}" stroke="${CJ[k]}" stroke-width="1.6" opacity=".9"/>`); });
      s.push(`</g>`);
      // les meneaux de la verrière (par-dessus) et le reflet du verre
      s.push(`<path d="${arc}" fill="none" stroke="#2A3458" stroke-width="5"/>${[1, 2, 3].map(q => `<path d="M${f(gx0 + q * (gx1 - gx0) / 4)} ${gy}V${yt + 30 - (q === 2 ? 26 : 10)}" stroke="#2A3458" stroke-width="2.4"/>`).join("")}<path d="M${gx0} ${yt + 46}H${gx1}M${gx0} ${yt + 92}H${gx1}" stroke="#2A3458" stroke-width="2"/><path d="M${gx0 + 8} ${gy - 6}L${gx0 + 40} ${yt + 30}" stroke="#DDE8FF" stroke-width="8" opacity=".08"/>`);
      K.halo((gx0 + gx1) / 2, gy - 50, 130, "#FFB347", .45); s.push(`<path d="M${gx0 - 8} 506L${gx1 + 8} 506L${gx1 + 60} 530H${gx0 - 60}Z" fill="#FFC85A" opacity=".12"/>`); s.push(`<path d="M${gx0 + 10} ${gy}L${gx0 - 70} 600H${gx1 + 70}L${gx1 - 10} ${gy}Z" fill="#FFC85A" opacity=".05" filter="url(#c5-flou8)"/>`);
    }
    // tours avant
    s.push(tour(366, 520, 28, 372, 50, { lum: .6 }) + tour(784, 518, 32, 352, 58, { lum: .6 }));
    // pied du château : rempart et escalier vers le lac
    s.push(`<path d="M352 520H800V530H352Z" fill="#2A3458"/>${Array.from({ length: 49 }, (_, q) => `<rect x="${352 + q * 9.2}" y="514" width="5" height="6" fill="#3E4A74"/>`).join("")}<path d="M590 530l-6 20l-10 16l-12 14l-10 14" stroke="#5A6A92" stroke-width="3" stroke-dasharray="3 2" fill="none"/>`);

    // la falaise habitée : rochers éclairés par la lune, lanternes le long de l'escalier, le hangar à bateaux au bord de l'eau
    for (let k = 0; k < 9; k++) { const y = 544 + k * 8 + r() * 4, x0 = 350 + k * 3 + r() * 20, x1 = 830 - k * 2 - r() * 20; let d = `M${f(x0)} ${f(y)}`; for (let x = x0 + 30; x < x1; x += 30) d += `l30 ${f((r() - .5) * 6)}`; s.push(`<path d="${d}" stroke="${k % 2 ? "#05070F" : "#5A6A92"}" stroke-width="${k % 2 ? 2 : 1}" opacity="${k % 2 ? .45 : .3}" fill="none"/>`); }
    for (let k = 0; k < 18; k++) { const x = 330 + k * 30 + r() * 14; if (Math.abs(x - 520) < 34) continue; s.push(sapin(x, 612 + r() * 4, 16 + r() * 16, "#0A161E", r() < .3)); }
    [[586, 548], [576, 566], [564, 580], [552, 594]].forEach(([x, y]) => { s.push(`<path d="M${x} ${y}v-8" stroke="#2A2014" stroke-width="1.2"/><circle cx="${x}" cy="${y - 9}" r="2" fill="#FFD27A"/>`); K.halo(x, y - 9, 14, "#FFB347", .6); });
    { const x = 520, y = 612; s.push(`<path d="M${x - 26} ${y}V${y - 14}L${x} ${y - 30}L${x + 26} ${y - 14}V${y}Z" fill="#4A3424"/><path d="M${x - 30} ${y - 12}L${x} ${y - 32}L${x + 30} ${y - 12}" stroke="url(#c5-to)" stroke-width="5" fill="none"/><path d="M${x - 10} ${y}v-12a10 10 0 0 1 20 0v12z" fill="#FFC85A" opacity=".85"/>`); K.halo(x, y - 6, 34, "#FFB347", .5); }
    // ---- 8. le pont couvert (du château vers la colline de la forêt)
    { const x0 = 798, y0 = 470, x1 = 936, y1 = 446;
      [826, 862, 898].forEach(x => { const y = y0 + (y1 - y0) * (x - x0) / (x1 - x0); s.push(`<path d="M${x - 7} ${f(y + 14)}L${x - 9} 600H${x + 9}L${x + 7} ${f(y + 14)}Z" fill="url(#c5-ro)"/>`); });
      s.push(`<path d="M${x0} ${y0 + 16}Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + 34} ${x1} ${y1 + 16}" stroke="#3E4A74" stroke-width="4" fill="none"/>`);
      s.push(`<path d="M${x0} ${y0 - 12}L${x1} ${y1 - 12}L${x1} ${y1 + 14}L${x0} ${y0 + 14}Z" fill="#4A3424"/><path d="M${x0 - 4} ${y0 - 10}L${x0 + 6} ${y0 - 22}L${x1 + 6} ${y1 - 22}L${x1 + 4} ${y1 - 10}Z" fill="url(#c5-to)"/>`);
      for (let k = 0; k < 7; k++) { const x = x0 + 12 + k * 18, y = y0 + (y1 - y0) * (x - x0) / (x1 - x0); s.push(fen(x, y - 6, 7, 11, r() < .7, "#FFC85A")); }
      s.push(`<path d="M${x1} ${y1 + 14}l14 4l2 20h-20z" fill="url(#c5-ro)"/>`);
      nom(868, 500, "le pont couvert", 10.5); }

    // ---- 9. la cabane du garde-chasse (pierre, toit de chaume, fenêtre chaude, citrouilles géantes)
    { const x = 880, y = 566;
      s.push(`<ellipse cx="${x + 4}" cy="${y + 3}" rx="40" ry="7" fill="#000" opacity=".4"/><path d="M${x - 24} ${y}V${y - 26}H${x + 24}V${y}Z" fill="#5A5E70"/>${[0, 1, 2].map(q => `<path d="M${x - 24} ${y - 7 - q * 8}H${x + 24}" stroke="#2E3242" stroke-width="1"/>`).join("")}<path d="M${x - 32} ${y - 24}L${x} ${y - 58}L${x + 32} ${y - 24}Z" fill="#6A5430"/><path d="M${x - 32} ${y - 24}L${x} ${y - 58}" stroke="#A88A54" stroke-width="1.3"/><rect x="${x + 10}" y="${y - 66}" width="7" height="16" fill="#4A3A2E"/>`);
      s.push(`<rect x="${x - 6}" y="${y - 18}" width="12" height="18" fill="#3A2414"/>` + fen(x - 15, y - 20, 7, 9, true, "#FFB347") + fen(x + 15, y - 20, 7, 9, true, "#FFB347"));
      [[x - 42, y - 2, 9], [x - 30, y + 4, 6], [x + 36, y + 2, 8]].forEach(([u, v, R]) => s.push(`<ellipse cx="${u}" cy="${v}" rx="${R}" ry="${R * .78}" fill="#E07A1E"/><path d="M${u - R * .4} ${v - R * .7}q${R * .1} ${R * .7} 0 ${R * 1.4}M${u + R * .4} ${v - R * .7}q${-R * .1} ${R * .7} 0 ${R * 1.4}" stroke="#A8500E" stroke-width="1" fill="none"/><path d="M${u} ${v - R * .78}v-3" stroke="#3A6A2A" stroke-width="2"/>`));
      LUM.push([x, y - 16, 40]); nom(x - 14, y + 22, "la cabane du garde-chasse", 10); }

    // ---- 10. la volière (premier plan à gauche) d'où partent les hiboux
    { const x = 52, yb = 640, yt = 300;
      s.push(`<path d="M${x - 30} ${yb}L${x - 22} ${yt}H${x + 22}L${x + 30} ${yb}Z" fill="url(#c5-pi)"/><path d="M${x - 30} ${yt + 4}L${x} ${yt - 64}L${x + 30} ${yt + 4}Z" fill="url(#c5-to)"/><path d="M${x - 30} ${yt + 4}L${x} ${yt - 64}" stroke="#9FB6E8" stroke-width="1.2" opacity=".55"/>`);
      for (let q = 0; q < 14; q++) { const u = x - 14 + (q % 3) * 14 + (Math.floor(q / 3) % 2) * 6, v = yt + 26 + Math.floor(q / 3) * 52; if (v > yb - 30) continue; s.push(`<path d="M${u - 4} ${v + 8}V${v + 2}a4 4 0 0 1 8 0V${v + 8}Z" fill="#0A0D1C"/><circle cx="${u - 1.4}" cy="${v + 3.5}" r=".9" fill="#FFD27A"/><circle cx="${u + 1.4}" cy="${v + 3.5}" r=".9" fill="#FFD27A"/>`); }
      s.push(`<path d="M${x - 34} ${yt + 6}h68" stroke="#3E4A74" stroke-width="4"/>`);
      nom(x, yt - 72, "la volière", 10.5); }

    // ---- 11. le lac noir : reflets de la lune et des fenêtres
    s.push(`<path d="M0 612Q160 600 320 612Q590 640 858 612Q960 602 1080 610V720H0Z" fill="url(#c5-lac)"/><path d="M0 612Q160 600 320 612Q590 640 858 612Q960 602 1080 610" stroke="#5A72B4" stroke-width="1.2" opacity=".5" fill="none"/>`);
    for (let k = 0; k < 16; k++) { const y = 622 + k * 6.2, w = 26 - k * .8 + r() * 10; s.push(`<path d="M${f(LX - w / 2 + (r() - .5) * 10)} ${f(y)}h${f(w)}" stroke="#F6EED2" stroke-width="2" opacity="${f(.5 - k * .025)}" stroke-linecap="round"/>`); }
    for (let k = 0; k < 34; k++) { const x = 380 + r() * 420, y = 628 + r() * 80; s.push(`<path d="M${f(x)} ${f(y)}h${f(4 + r() * 10)}" stroke="#FFC85A" stroke-width="1.6" opacity="${f(.15 + r() * .35)}" stroke-linecap="round"/>`); }

    // halos des fenêtres (après le château)
    LUM.forEach(([x, y, R]) => K.halo(x, y, R * .8, "#FFB347", .26));

    // le froid des détraqueurs sur le lac (bas gauche) et trois détraqueurs au loin dans le ciel
    s.push(`<ellipse cx="160" cy="692" rx="130" ry="22" fill="#9FB4E0" opacity=".12" filter="url(#c5-flou8)"/>`);
    for (let k = 0; k < 20; k++) { const x = 70 + r() * 190, y = 676 + r() * 36; s.push(`<path d="M${f(x)} ${f(y)}l3 -3l3 3l-3 3z" fill="#DDE8FF" opacity="${f(.2 + r() * .4)}"/>`); }
    [[118, 72, .45], [150, 96, .35], [86, 110, .3]].forEach(([x, y, sc]) => s.push(`${G(x, y, sc)}<path d="M-8 -22C-14 -22 -16 -12 -14 -2C-16 8 -20 16 -24 22L-18 18L-16 26L-10 18L-6 26L-2 18L2 26L4 16C8 6 6 -6 4 -12C2 -20 -2 -22 -8 -22Z" fill="#05060C" stroke="#4A5A88" stroke-width="1.4"/></g>`));
    // ---- 12. la piste : une voie aérienne d'or, balisée d'anneaux
    K.route([["#000", 44, ` opacity=".45" filter="url(#c5-flou8)"`], ["#FFD27A", 34, ` opacity=".12"`], ["url(#c5-or)", 27, ` opacity=".95"`], ["#121A3C", 22, ` opacity=".9"`], ["#2A3A78", 10, ` opacity=".35"`]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#FFE6A8" stroke-width="2.2" stroke-dasharray="2 13" stroke-linecap="round" opacity=".85"/>`);
    K.depart();
    const idx = fr => ((Math.floor(fr * N) % N) + N) % N;
    [.075, .2, .32, .405, .5, .59, .7, .78, .885].forEach(fr => { const i = idx(fr), [, , tx, ty] = K.nrm(i), an2 = Math.atan2(ty, tx) * 57.3, [x, y] = P[i];
      s.push(`${G(x, y, 1, an2)}<path d="M0 -20V-30" stroke="#C9A24A" stroke-width="1.6"/><ellipse rx="5" ry="20" fill="none" stroke="#000" stroke-width="4.5" opacity=".4"/><ellipse rx="5" ry="20" fill="none" stroke="url(#c5-or)" stroke-width="3"/><ellipse rx="5" ry="20" fill="none" stroke="#FFF6D8" stroke-width=".8" opacity=".7"/></g>`); K.halo(x, y, 26, "#FFD27A", .3); });

    // ---- 13. le titre (petit) : « Je jure solennellement… »
    s.push(`<path d="M352 16H728L716 34L728 52H352L364 34Z" fill="#E9D8A8" stroke="#6A4A1E" stroke-width="1.4" opacity=".95"/><text x="540" y="31" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="13" fill="#3A2614">Je jure solennellement que mes intentions sont mauvaises</text><text x="540" y="45" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9" fill="#5A3A1E">Février · la grande course de balais</text>`);

    // ---- 14. les tableaux des 4 pilotes (bord droit) : cadres d'or, les vrais portraits sont posés par l'appli
    const PORTR = [];
    { const px = 990, pw = 84, py = 236, ph = 412;
      s.push(`<rect x="${px + 4}" y="${py + 5}" width="${pw}" height="${ph}" rx="6" fill="#000" opacity=".4" filter="url(#c5-flou)"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="#4A1E2A" stroke="#1A0A10" stroke-width="2"/>${Array.from({ length: 6 }, (_, q) => `<path d="M${px + 8 + q * 14} ${py + 4}v${ph - 8}" stroke="#6A2A3A" stroke-width="5" opacity=".6"/>`).join("")}<path d="M${px} ${py + 2}h${pw}" stroke="url(#c5-or)" stroke-width="4"/>`);
      s.push(`<text x="${px + pw / 2}" y="${py + 18}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10.5" fill="#F7E3A0">Les tableaux</text>`);
      CJ.forEach((c, k) => { const x = px + pw / 2, y = py + 66 + k * 96; PORTR.push({ k, x, y, r: 20 });
        s.push(`<ellipse cx="${x + 2}" cy="${y + 3}" rx="29" ry="34" fill="#000" opacity=".4"/><ellipse cx="${x}" cy="${y}" rx="28" ry="33" fill="url(#c5-or)" stroke="#3A2614" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="23.5" ry="28.5" fill="none" stroke="#8A5A14" stroke-width="1.2" stroke-dasharray="2 2"/><ellipse cx="${x}" cy="${y}" rx="21.5" ry="26.5" fill="${mixHex(c, "#1A1020", .5)}"/>${[[0, -34], [0, 34], [-29, 0], [29, 0]].map(([u, v]) => `<circle cx="${x + u}" cy="${y + v}" r="3" fill="url(#c5-or)" stroke="#3A2614" stroke-width=".8"/>`).join("")}<rect x="${x - 24}" y="${y + 37}" width="48" height="12" rx="2" fill="url(#c5-or)" stroke="#3A2614" stroke-width=".8"/><text x="${x}" y="${y + 46}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="9" fill="#3A2614">${NOMS[k]}</text>`); }); }

    // ---- 15. étiquettes
    nom(690, 706, "Le lac noir", 13);

    // ================= COUCHE ANIMÉE =================
    // reflet qui passe sur les tableaux
    a.push(`<rect x="996" y="250" width="16" height="390" fill="#FFF6D0" opacity="${K.anime ? 0 : 0}" transform="skewX(-12)">${an(`<animate attributeName="opacity" values="0;.25;0;0" keyTimes="0;.1;.2;1" dur="9s" repeatCount="indefinite"/><animate attributeName="x" values="1040;1140;1140;1140" keyTimes="0;.2;.21;1" dur="9s" repeatCount="indefinite"/>`)}</rect>`);
    // les bougies flottantes de la Grande Salle (deux groupes qui ondulent)
    a.push(`<radialGradient id="c5-flamme" r="50%"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".35" stop-color="#FFC85A" stop-opacity=".8"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>`);
    [0, 1].forEach(g => { let c = ""; for (let k = 0; k < 9; k++) { const x = 500 + r() * 110, y = 360 + r() * 56; c += `<circle cx="${f(x)}" cy="${f(y - 4)}" r="5" fill="url(#c5-flamme)"/><rect x="${f(x - 1.2)}" y="${f(y - 1)}" width="2.4" height="7" fill="#F4F0E2"/><ellipse cx="${f(x)}" cy="${f(y - 3)}" rx="1.2" ry="2.2" fill="#FFE6A0"/>`; }
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${3 + g * 1.3}s" repeatCount="indefinite"/>`)}${c}</g>`); });
    // fenêtres qui s'allument et s'éteignent
    [[664, 196], [545, 290], [392, 220], [724, 330]].forEach(([x, y], k) => a.push(`<rect x="${x - 2.5}" y="${y}" width="5" height="9" fill="#FFF0B8" opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;.9;.9;0;0" keyTimes="0;.1;.5;.6;1" dur="${5 + k * 1.7}s" begin="${k * 1.3}s" repeatCount="indefinite"/>`)}</rect>`));
    // fumée de la cabane
    a.push(`<g opacity=".5">${[0, 1, 2].map(q => `<circle cx="${893 + q * 4}" cy="${494 - q * 12}" r="${4 + q * 2}" fill="#8A96B8" opacity="${.5 - q * .12}"/>`).join("")}${an(`<animateTransform attributeName="transform" type="translate" values="0 0;4 -8;0 0" dur="5s" repeatCount="indefinite"/>`)}</g>`);
    // yeux dans la forêt interdite
    [[820, 400], [905, 372], [860, 430]].forEach(([x, y], k) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.05;.3;.35;1" dur="${6 + k * 2.3}s" begin="${k * 1.7}s" repeatCount="indefinite"/>`)}${[[-3, 0], [3, 0], [-2, -4], [2, -4]].map(([u, v]) => `<circle cx="${x + u}" cy="${y + v}" r="1.2" fill="#E8FF6A"/>`).join("")}</g>`));
    // le saule cogneur : trois branches qui fouettent
    [[-6, -48, -40, -72, -70, -54, "-18;14;-8;-18", 2.2], [4, -50, 26, -86, 64, -78, "16;-10;20;16", 1.8], [0, -44, 40, -50, 58, -24, "-10;22;-4;-10", 2.6]].forEach(([x0, y0, cx1, cy1, x1, y1, vals, du]) => {
      const fixe = vals.split(";")[0]; a.push(`<g transform="translate(${SX + x0} ${SY + y0})"><g${K.anime ? "" : ` transform="rotate(${fixe})"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="${vals}" dur="${du}s" repeatCount="indefinite"/>`)}<path d="M0 0Q${cx1 - x0} ${cy1 - y0} ${x1 - x0} ${y1 - y0}" stroke="#3A2A22" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M${(x1 - x0) * .6} ${(y1 - y0) * .7}q6 -8 14 -6M${(x1 - x0) * .85} ${(y1 - y0) * .95}q-8 -6 -6 -14" stroke="#3A2A22" stroke-width="2" fill="none"/>${[.4, .7, 1].map(t => `<circle cx="${f((x1 - x0) * t)}" cy="${f((y1 - y0) * t)}" r="${4 - t * 1.6}" fill="#2A4A3A" opacity=".85"/>`).join("")}</g></g>`); });
    // le vif d'or autour du terrain
    { const ch = "M232 400C300 380 320 430 250 420S160 380 200 410S280 440 232 400"; a.push(`<g${K.anime ? "" : ` transform="translate(262 404)"`}>${an(`<animateMotion dur="7s" repeatCount="indefinite" path="${ch}"/>`)}<circle r="6" fill="url(#c5-flamme)"/><circle r="2.4" fill="${OR}"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .2;1 1" dur=".25s" repeatCount="indefinite"/>`)}<path d="M-2 -1q-6 -6 -9 -2q4 1 9 3M2 -1q6 -6 9 -2q-4 1 -9 3" fill="#F4F0FF" opacity=".9"/></g></g>`); }
    // les hiboux du courrier (enveloppe au bec)
    const hibou = c => `<g><path d="M-6 -2l-8 -6l3 7z" fill="${c}"/><ellipse rx="6" ry="4.5" fill="${c}"/><circle cx="5" cy="-3" r="3.4" fill="${c}"/><circle cx="6" cy="-3.6" r=".9" fill="#FFD27A"/><rect x="7" y="-1.5" width="7" height="5" fill="#F4ECD8" stroke="#6A4A1E" stroke-width=".5"/><circle cx="10.5" cy="1" r="1" fill="#C8302A"/>` +
      `<g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 -.7;1 1" dur=".5s" repeatCount="indefinite"/>`)}<path d="M-3 -2q2 -12 10 -10q-4 4 -6 10z" fill="${mixHex(c, "#FFFFFF", .25)}"/></g></g>`;
    [["M60 250C160 200 300 230 420 200S560 270 545 290", 12, 0, "#C8B8A0", [300, 226]], ["M70 260C200 120 520 140 760 140S950 220 905 300", 16, 5, "#E8E4DA", [560, 145]], ["M40 270C150 300 320 280 520 330S760 440 885 510", 14, 9, "#8A6A4A", [720, 420]]].forEach(([ch, du, deb, c, fx]) =>
      a.push(`<g${K.anime ? "" : ` transform="translate(${fx[0]} ${fx[1]})"`}>${an(`<animateMotion dur="${du}s" begin="-${deb}s" repeatCount="indefinite" path="${ch}"/>`)}<g transform="scale(1.3)">${hibou(c)}</g></g>`));
    // le dragon qui survole (en haut à droite)
    { const dx = 978, dy = 104, aile = (sx) => `<path d="M0 0C${-10 * sx} -30 ${-34 * sx} -54 ${-70 * sx} -58C${-60 * sx} -44 ${-62 * sx} -36 ${-56 * sx} -26C${-48 * sx} -34 ${-44 * sx} -30 ${-40 * sx} -18C${-32 * sx} -26 ${-26 * sx} -20 ${-22 * sx} -8Z" fill="#3A1E2A" stroke="#120A10" stroke-width="1"/><path d="M0 0L${-70 * sx} -58M0 0L${-56 * sx} -26M0 0L${-40 * sx} -18" stroke="#6A3A4A" stroke-width="1" opacity=".7"/>`;
      a.push(`<g transform="translate(${dx} ${dy})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-6 6;0 0" dur="4s" repeatCount="indefinite"/>`)}`);
      a.push(`<g transform="translate(10 -6) scale(-1 1)"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .35;1 1" dur="1.6s" repeatCount="indefinite"/>`)}${aile(1.1)}</g></g>`);
      a.push(`<path d="M-62 30C-90 34 -96 14 -84 6C-92 18 -78 24 -60 18Z" fill="#4A2432"/><path d="M-58 22C-30 26 -4 14 20 -2C30 -8 40 -10 48 -6L54 -12L52 -2C46 2 40 4 30 4C14 22 -20 34 -58 30Z" fill="#5A2A38" stroke="#120A10" stroke-width="1"/><path d="M-50 26C-24 26 0 16 20 4" stroke="#C8784A" stroke-width="2.4" stroke-dasharray="2 3" fill="none"/><path d="M44 -10l4 -10l2 9M38 -8l0 -10l4 8" fill="#C8B89A"/><circle cx="46" cy="-6" r="1.4" fill="#FFD27A"/>`);
      a.push(`<g opacity="${K.anime ? 0 : .9}">${an(`<animate attributeName="opacity" values="0;0;.95;.95;0" keyTimes="0;.55;.62;.85;1" dur="5s" repeatCount="indefinite"/>`)}<path d="M54 -4C70 0 80 10 96 6C84 16 70 14 58 4Z" fill="#FFB347"/><path d="M54 -4C66 0 74 6 86 5C76 10 66 8 58 1Z" fill="#FFF0A0"/><circle cx="84" cy="6" r="16" fill="url(#c5-flamme)"/></g>`);
      a.push(`<g transform="translate(0 2)"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .3;1 1" dur="1.6s" begin=".1s" repeatCount="indefinite"/>`)}${aile(1)}</g></g></g></g>`); }
    // le calmar géant : une grande tentacule qui sort du lac (et une petite), ronds dans l'eau
    { const tx = 812, ty = 712;
      a.push(`<g transform="translate(${tx} ${ty}) scale(.82)"><g${K.anime ? "" : ` transform="rotate(-6)"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="-8;6;-8" dur="6s" repeatCount="indefinite"/>`)}<path d="M-10 0C-14 -30 4 -50 -8 -66C-16 -78 -2 -86 6 -78C0 -76 -4 -70 2 -64C14 -48 6 -24 10 0Z" fill="#5A3A6A" stroke="#1A0A20" stroke-width="1.2"/>${[0, 1, 2, 3, 4].map(q => `<circle cx="${f(3 - q * .4)}" cy="${f(-12 - q * 12)}" r="${f(2.6 - q * .3)}" fill="#C8A0D8" opacity=".8"/>`).join("")}</g></g>`);
      a.push(`<g transform="translate(${tx + 60} ${ty})"><g${K.anime ? "" : ` transform="rotate(10)"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="12;-6;12" dur="4.5s" repeatCount="indefinite"/>`)}<path d="M-5 0C-6 -14 6 -22 0 -32C8 -26 8 -12 5 0Z" fill="#5A3A6A" stroke="#1A0A20" stroke-width="1"/></g></g>`);
      a.push(`<ellipse cx="${tx}" cy="${ty - 2}" rx="18" ry="3.4" fill="none" stroke="#9FB4E8" stroke-width="1.2" opacity=".6">${an(`<animate attributeName="rx" values="12;30;12" dur="3s" repeatCount="indefinite"/>`)}</ellipse>`); }
    // les barques des premières années, lanternes allumées
    [[470, 690, 0], [522, 702, 1], [578, 688, 2]].forEach(([x, y, k]) => a.push(`<g transform="translate(${x} ${y})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="${2.6 + k * .5}s" repeatCount="indefinite"/>`)}<path d="M-14 0Q0 8 14 0L12 -3H-12Z" fill="#5A3A22" stroke="#120A08" stroke-width=".8"/><circle cx="-4" cy="-6" r="2.6" fill="#2A2238"/><circle cx="4" cy="-6" r="2.6" fill="#2A2238"/><path d="M10 -3v-10" stroke="#3A2414" stroke-width="1"/><circle cx="10" cy="-13" r="5" fill="url(#c5-flamme)"/><circle cx="10" cy="-13" r="1.6" fill="#FFE6A0"/></g></g>`));
    // le cerf argenté qui charge, les détraqueurs qui reculent (bas gauche, au-dessus du lac)
    a.push(`<radialGradient id="c5-patro" r="50%"><stop offset="0" stop-color="#F4FAFF" stop-opacity=".9"/><stop offset=".4" stop-color="#BFD8FF" stop-opacity=".45"/><stop offset="1" stop-color="#BFD8FF" stop-opacity="0"/></radialGradient>`);
    { const x = 356, y = 684, cerf = `<path d="M-22 4C-20 -6 -8 -10 8 -8L16 -16L22 -14L18 -6C20 0 18 6 14 8L18 22L14 22L10 10L-10 10L-14 22L-18 22L-16 8C-20 8 -24 6 -22 4Z" fill="#E8F2FF" opacity=".92"/><path d="M17 -15C14 -24 8 -28 4 -34M15 -20L8 -22M12 -26L6 -32M20 -15C22 -26 28 -30 32 -36M22 -22L28 -22M26 -28L30 -34" stroke="#E8F2FF" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="19" cy="-11" r=".9" fill="#5A7AB4"/>`;
      a.push(`<circle cx="${x}" cy="${y - 4}" r="48" fill="url(#c5-patro)" opacity=".85">${an(`<animate attributeName="r" values="44;54;44" dur="2.4s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<g transform="translate(${x} ${y}) scale(-1.15 1.15)"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;3 -3;0 0" dur=".9s" repeatCount="indefinite"/>`)}${cerf}</g></g>`);
      [[150, 668, 1], [208, 690, .85], [96, 692, .75]].forEach(([u, v, sc], k) => a.push(`<g transform="translate(${u} ${v}) scale(${sc})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-6 -5;0 0" dur="${3.2 + k * .7}s" repeatCount="indefinite"/>`)}<path d="M-8 -22C-14 -22 -16 -12 -14 -2C-16 8 -20 16 -24 22L-18 18L-16 26L-10 18L-6 26L-2 18L2 26L4 16C8 6 6 -6 4 -12C2 -20 -2 -22 -8 -22Z" fill="#0A0C14" stroke="#6E80B0" stroke-width="1" opacity=".95"/><ellipse cx="-6" cy="-14" rx="3" ry="4" fill="#000"/><path d="M-12 0q-10 4 -16 -2" stroke="#0A0C14" stroke-width="2.4" fill="none"/><path d="M-14 -2q-10 4 -16 -2" stroke="#9AAAD0" stroke-width=".8" fill="none" opacity=".6"/></g></g>`)); }
    // ---- les 4 pilotes sur leurs balais, écharpes à leurs couleurs (ils restent toujours la tête en haut)
    const PEAU = ["#F2CDB0", "#D9A27A", "#F5D4BC", "#C98E66"], CHEV = ["#5A3A1E", "#1A1410", "#C88A3A", "#8A3A1A"];
    const pilote = (k) => { const c = CJ[k], c2 = mixHex(c, "#101020", .55), v1 = "M3 -16Q-8 -21 -18 -16T-34 -18", v2 = "M3 -16Q-8 -12 -18 -17T-34 -13";
      return `<ellipse cx="-4" cy="-8" rx="30" ry="22" fill="url(#c5-pj${k})"/><path d="M-46 1H-120" stroke="${c}" stroke-width="7" stroke-linecap="round" opacity=".18"/><path d="M-46 1H-86" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".5"/>` +
        `<path d="M-26 2L22 -1" stroke="#8A5A2A" stroke-width="2.8" stroke-linecap="round"/><path d="M-24 2L-46 -7Q-51 2 -46 11Z" fill="#A8823E" stroke="#3A2414" stroke-width="1"/><path d="M-30 1L-46 -3M-30 3L-46 7" stroke="#8A6A2A" stroke-width=".8"/>` +
        `<path d="M-5 -2L3 6L-1 11" stroke="#14121E" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-1 11h4" stroke="#3A2414" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M2 -17Q-14 -16 -26 -6Q-14 -8 -8 -1Z" fill="#1E1A30"/><path d="M-9 -1Q-7 -15 3 -19L8 -15Q2 -9 2 -1Z" fill="#26203A" stroke="#0A0814" stroke-width=".8"/><path d="M4 -15L13 -3" stroke="#26203A" stroke-width="3.4" stroke-linecap="round"/><circle cx="14" cy="-2" r="1.8" fill="${PEAU[k]}"/>` +
        `<circle cx="6" cy="-22" r="4.8" fill="${PEAU[k]}" stroke="#0A0814" stroke-width=".7"/><path d="M1.6 -22.5C1 -28 8 -30 10.6 -25C8 -26.5 5 -26 3.6 -23.5Z" fill="${CHEV[k]}"/>` +
        `<path d="${v1}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round">${an(`<animate attributeName="d" values="${v1};${v2};${v1}" dur=".7s" repeatCount="indefinite"/>`)}</path><path d="${v1}" stroke="${c2}" stroke-width="4" fill="none" stroke-dasharray="2.5 4">${an(`<animate attributeName="d" values="${v1};${v2};${v1}" dur=".7s" repeatCount="indefinite"/>`)}</path><path d="M0 -17.5h6" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`; };
    CJ.forEach((c, k) => a.unshift(`<radialGradient id="c5-pj${k}" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`));
    // quand la piste va vers la gauche, le pilote est retourné (scale 1,-1 dans le repère de la piste) : il reste la tête en haut
    const gauche = []; { let g = false; for (let i = 0; i < N; i++) { const tx = K.nrm(i)[2]; if (tx < -.25) g = true; else if (tx > .25) g = false; gauche.push(g); } }
    const flip = (() => { const kt = [0], vals = [gauche[0] ? "1 -1" : "1 1"]; for (let i = 1; i < N; i++) if (gauche[i] !== gauche[i - 1]) { kt.push((i / N).toFixed(4)); vals.push(gauche[i] ? "1 -1" : "1 1"); } kt.push(1); vals.push(vals[vals.length - 1]); return { kt: kt.join(";"), vals: vals.join(";") }; })();
    CJ.forEach((c, k) => { const fr = [.035, .005, .972, .94][k], du = 34 + k * 1.6, deb = (fr * du).toFixed(2);
      if (K.anime) a.push(`<g><animateMotion dur="${du}s" begin="-${deb}s" repeatCount="indefinite" rotate="auto" path="${K.piste.replace(/(-?\d+\.\d) (-?\d+\.\d)/g, "$1,$2")}"/><g><animateTransform attributeName="transform" type="scale" calcMode="discrete" values="${flip.vals}" keyTimes="${flip.kt}" dur="${du}s" begin="-${deb}s" repeatCount="indefinite"/><g transform="scale(1.3)">${pilote(k)}</g></g></g>`);
      else { const i = idx(fr), [, , tx, ty] = K.nrm(i); a.push(`<g transform="translate(${f(P[i][0])} ${f(P[i][1])}) rotate(${f(Math.atan2(ty, tx) * 57.3)})${gauche[i] ? " scale(1 -1)" : ""}"><g transform="scale(1.3)">${pilote(k)}</g></g>`); } });
    a.push(`<g opacity="${K.anime ? 0 : 0}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.03;.08;1" dur="11s" begin="3s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;-160 60;-160 60" keyTimes="0;.08;1" dur="11s" begin="3s" repeatCount="indefinite"/>`)}<path d="M860 30l60 -22" stroke="#FFF6D8" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><circle cx="860" cy="30" r="2" fill="#FFF"/></g>`);
    K.particules(12, "#FFF2C8", 1.6, "scintille");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#c5-ciel)"/>`, "#1A1440", .1); RES.portraits = PORTR; return RES;
  }

  /* ---------- Mars · Le pays des merveilles (v3 : grandes scènes en gravures colorées, d'après le livre de 1865) ----------
     Au centre la mare de larmes (Alice y nage, la course au caucus tourne autour, une larme géante y tombe) ; au-dessus, le terrier
     vertigineux où tout tombe en spirale ; en bas le grand goûter du Chapelier avec 4 chaises réservées aux pilotes (cadres PORTR) ;
     à droite la Reine de cœur et son croquet aux flamants ; la Chenille sur son champignon ; la maison du Lapin où Alice a trop grandi ;
     dehors : le château de cœur, la petite porte et « BOIS-MOI », le jardin des fleurs qui parlent, le quadrille des homards au bord de mer.
     Le Chat apparaît et disparaît d'un coin à l'autre, il ne laisse que son sourire. */
  function peindreTerrier3(T, Z, def) {
    const K = kit(T, def, 1865, "w3-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", ENC = "#2A1E1E", INK = `stroke="${ENC}" stroke-width="1.2" stroke-linejoin="round"`, PEAU = "#F6D7BE", BLOND = "#F2CF6A";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const vu = (v0) => K.anime ? v0 : 1;   // opacité de départ d'un élément qui apparaît (tout visible si les animations sont coupées)
    const bulle = (x, y, txt, du, deb, pt, haut) => { const qy = haut ? y - 10.6 : y + 6.6, sg = haut ? -1 : 1; a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.1;.16;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.8 - 7)}" y="${f(y - 11)}" width="${f(txt.length * 5.6 + 14)}" height="18" rx="9" fill="#FFFDF6" stroke="${ENC}" stroke-width="1.1"/><path d="M${f(x + (pt || 0) - 4)} ${f(qy)}l${pt < 0 ? -3 : 3} ${8 * sg}l6 ${-8 * sg}" fill="#FFFDF6" stroke="${ENC}" stroke-width="1.1"/><path d="M${f(x + (pt || 0) - 3.4)} ${f(qy - .6 * sg)}h6.8" stroke="#FFFDF6" stroke-width="1.6"/><text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10.5" fill="${ENC}">${txt}</text></g>`); };
    // ruban de légende (comme une gravure de livre)
    const RUB = [], ruban = (x, y, txt) => { const w = txt.length * 5 + 22; RUB.push(`<path d="M${f(x - w / 2 - 10)} ${f(y - 3)}l8 -3v14l-8 -3l4 -4z" fill="#C8A86A" ${INK}/><path d="M${f(x + w / 2 + 10)} ${f(y - 3)}l-8 -3v14l8 -3l-4 -4z" fill="#C8A86A" ${INK}/><path d="M${f(x - w / 2)} ${f(y - 8)}Q${f(x)} ${f(y - 12)} ${f(x + w / 2)} ${f(y - 8)}V${f(y + 7)}Q${f(x)} ${f(y + 3)} ${f(x - w / 2)} ${f(y + 7)}Z" fill="#F7ECD0" ${INK}/><text x="${f(x)}" y="${f(y + 1.6)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="9.5" fill="#5A2A1A">${txt}</text>`); };
    // symboles des cartes, dessinés (pas de police) ; R = demi-hauteur
    const SYM = { c: "M0 .9C-.1 .7 -1 .2 -1 -.3C-1 -.8 -.4 -1 0 -.55C.4 -1 1 -.8 1 -.3C1 .2 .1 .7 0 .9Z", k: "M0 -1L.72 0L0 1L-.72 0Z",
      p: "M0 -1C-.1 -.8 -1 -.3 -1 .22C-1 .68 -.45 .8 -.12 .45L-.32 1H.32L.12 .45C.45 .8 1 .68 1 .22C1 -.3 .1 -.8 0 -1Z", t: "M0 -1A.36 .36 0 0 1 .3 -.38A.36 .36 0 1 1 .14 .3L.32 1H-.32L-.14 .3A.36 .36 0 1 1 -.3 -.38A.36 .36 0 0 1 0 -1Z" };
    const sym = (k, x, y, R, c, ex) => `<path d="${SYM[k]}" transform="translate(${f(x)} ${f(y)}) scale(${f(R)})" fill="${c}"${ex || ""}/>`;
    const ROUGE = "#C8102E", NOIR = "#1A1A22";
    // ---- dégradés et motifs
    s.push(`<pattern id="w3-pre" width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><rect width="96" height="96" fill="#90CC72"/><rect width="48" height="48" fill="#7DBE62"/><rect x="48" y="48" width="48" height="48" fill="#7DBE62"/><path d="M6 10l2 -4l2 4M60 30l2 -4l2 4M30 70l2 -4l2 4M80 84l2 -4l2 4" stroke="#6FAE58" stroke-width="1" fill="none"/></pattern>`);
    s.push(`<pattern id="w3-hach" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="5" height="5" fill="none"/><path d="M0 0V5" stroke="${ENC}" stroke-width="1"/></pattern>`);
    s.push(`<pattern id="w3-dam" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#F6F1E4"/><rect width="6" height="6" fill="${NOIR}"/><rect x="6" y="6" width="6" height="6" fill="${NOIR}"/></pattern>`);
    s.push(`<radialGradient id="w3-puits" r="50%"><stop offset="0" stop-color="#05030A"/><stop offset=".45" stop-color="#2A1838"/><stop offset=".8" stop-color="#5A3A2A"/><stop offset="1" stop-color="#8A6A44"/></radialGradient>`);
    s.push(`<radialGradient id="w3-larmes" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#BFEFFF"/><stop offset=".6" stop-color="#7CC8E8"/><stop offset="1" stop-color="#4A9CC8"/></radialGradient>`);
    s.push(`<linearGradient id="w3-mer" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7CCDE0"/><stop offset="1" stop-color="#2A6E9A"/></linearGradient>`);
    s.push(`<linearGradient id="w3-champi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F06A7A"/><stop offset="1" stop-color="#A42A4A"/></linearGradient>`);
    s.push(`<linearGradient id="w3-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".4" stop-color="#E8BE48"/><stop offset="1" stop-color="#8A5E14"/></linearGradient>`);
    s.push(`<linearGradient id="w3-nappe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EDE4D4"/></linearGradient>`);
    s.push(`<linearGradient id="w3-chat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B07AD0"/><stop offset="1" stop-color="#E890C8"/></linearGradient>`);
    // ---- placement d'une scène rectangulaire (boîte [g, h, d, b] autour du point) près d'une cible, loin de la piste, de la mare et des autres
    const lac = (x, y) => (def.eau || []).some(poly => dansPoly(x / KU / ECH, y / KU / ECH, poly)), boites = [];
    const caser = (tx, ty, B, marge, rayon, eauOK) => { let best = null, bd = 1e9;
      for (let e = 0; e < 2500; e++) { const x = e ? tx + (r() - .5) * 2 * rayon : tx, y = e ? ty + (r() - .5) * 2 * rayon : ty, b = [x + B[0], y + B[1], x + B[2], y + B[3]], d = Math.hypot(x - tx, y - ty); if (d >= bd) continue;
        if (b[0] < -4 || b[1] < -4 || b[2] > W + 4 || b[3] > H + 4 || boites.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
        let ok = true; for (let u = b[0]; u <= b[2] + .1 && ok; u += Math.max(6, (b[2] - b[0]) / 14)) for (let v = b[1]; v <= b[3] + .1 && ok; v += Math.max(6, (b[3] - b[1]) / 10)) if (K.dT(u, v) < marge || (!eauOK && lac(u, v))) ok = false;
        if (ok) { bd = d; best = [x, y]; } }
      const p = best || [tx, ty]; boites.push([p[0] + B[0], p[1] + B[1], p[0] + B[2], p[1] + B[3]]); K.prendre((p[0] * 2 + B[0] + B[2]) / 2, (p[1] * 2 + B[1] + B[3]) / 2, Math.max(B[2] - B[0], B[3] - B[1]) * .5); return p; };
    const ombre = (x, y, rx, ry, op) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#1E3A1A" opacity="${op || .28}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx * .9)}" ry="${f(ry * .8)}" fill="url(#w3-hach)" opacity=".18"/>`;
    // ---- les personnages (dessinés autour de (0,0) = les pieds)
    const alice = (bras) => `<path d="M-4 -2v-9M4 -2v-9" stroke="#FFFFFF" stroke-width="3.2"/><path d="M-4 -2v-9M4 -2v-9" stroke="${ENC}" stroke-width=".5" opacity=".5"/><ellipse cx="-4.6" cy="-1" rx="3.2" ry="1.7" fill="${NOIR}"/><ellipse cx="4.6" cy="-1" rx="3.2" ry="1.7" fill="${NOIR}"/>
      <path d="M-7 -44Q-11 -34 -9 -27L-4 -29Q-5 -36 -5 -40ZM7 -44Q11 -34 9 -27L4 -29Q5 -36 5 -40Z" fill="${BLOND}" ${INK}/>
      <path d="M-14 -10Q-12 -26 -6 -30H6Q12 -26 14 -10Q0 -5 -14 -10Z" fill="#6AA6E8" ${INK}/><path d="M-12 -12Q0 -8 12 -12" stroke="#4A86C8" stroke-width="1" fill="none"/>
      <path d="M-7 -11Q-6 -24 -4 -30H4Q6 -24 7 -11Q0 -9 -7 -11Z" fill="#FFFDF6" ${INK}/><path d="M-4 -30Q-6 -37 0 -38Q6 -37 4 -30Z" fill="#FFFDF6" ${INK}/>
      <circle cx="-6" cy="-34" r="3.2" fill="#6AA6E8" ${INK}/><circle cx="6" cy="-34" r="3.2" fill="#6AA6E8" ${INK}/>
      ${bras || `<path d="M-8 -32Q-13 -26 -12 -19M8 -32Q13 -26 12 -19" stroke="${PEAU}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`}
      <circle cx="0" cy="-43" r="6.4" fill="${PEAU}" ${INK}/><path d="M-6.8 -43Q-7.4 -51 0 -50.6Q7.4 -51 6.8 -43Q4 -48 0 -47.4Q-4 -48 -6.8 -43Z" fill="${BLOND}" ${INK}/><path d="M-6.2 -46Q0 -50.6 6.2 -46" stroke="${NOIR}" stroke-width="1.6" fill="none"/>
      <circle cx="-2.3" cy="-42.6" r=".85" fill="${ENC}"/><circle cx="2.3" cy="-42.6" r=".85" fill="${ENC}"/><path d="M-1.4 -39.6q1.4 1 2.8 0" stroke="${ENC}" stroke-width=".7" fill="none"/><circle cx="-4" cy="-40.6" r="1.2" fill="#F2A0A0" opacity=".6"/><circle cx="4" cy="-40.6" r="1.2" fill="#F2A0A0" opacity=".6"/>`;
    const soldat = (k, sc, lance) => { const c = k % 2 ? NOIR : ROUGE, sy = ["c", "p", "k", "t"][k % 4]; return `<path d="M-4 0v-8M4 0v-8" stroke="${ENC}" stroke-width="1.6"/><path d="M-7 -10v-12M7 -10v-12" stroke="${ENC}" stroke-width="1.4"/><rect x="-8" y="-30" width="16" height="22" rx="1.5" fill="#FFFDF6" ${INK}/>${sym(sy, 0, -19, 4.4, c)}${sym(sy, -5, -26.5, 1.6, c)}${sym(sy, 5, -11.5, 1.6, c)}<circle cy="-34" r="4.6" fill="${PEAU}" ${INK}/><path d="M-4.6 -35q4.6 -6 9.2 0" fill="${c}"/><circle cx="-1.6" cy="-33.6" r=".6" fill="${ENC}"/><circle cx="1.6" cy="-33.6" r=".6" fill="${ENC}"/>${lance ? `<path d="M10 2V-46" stroke="#7A5A3A" stroke-width="1.6"/><path d="M10 -52l-3 6h6z" fill="#C8CDD6" ${INK}/>` : ""}`; };
    const lapin = () => `<path d="M-3 -2v-10M3 -2v-10" stroke="#FFFFFF" stroke-width="4"/><ellipse cx="-4" cy="-1" rx="4" ry="1.8" fill="#FFF" ${INK}/><ellipse cx="4" cy="-1" rx="4" ry="1.8" fill="#FFF" ${INK}/>
      <path d="M-9 -12Q-11 -30 0 -32Q11 -30 9 -12Q0 -9 -9 -12Z" fill="#B8352A" ${INK}/><path d="M-9 -12L-12 -4L-4 -10ZM9 -12L12 -4L4 -10Z" fill="#B8352A" ${INK}/><path d="M-3 -31L0 -14L3 -31Z" fill="#F2CF6A" ${INK}/><circle cx="0" cy="-24" r=".8" fill="${ENC}"/><circle cx="0" cy="-19" r=".8" fill="${ENC}"/>
      <path d="M0 -26Q8 -24 9 -18" stroke="#E2B93B" stroke-width=".8" fill="none"/><circle cx="10" cy="-16" r="4.2" fill="url(#w3-or)" ${INK}/><circle cx="10" cy="-16" r="2.8" fill="#FFF8E6"/><path d="M10 -16v-2M10 -16h1.6" stroke="${ENC}" stroke-width=".6"/><path d="M-9 -26Q-14 -20 -10 -16" stroke="#FFF" stroke-width="3" stroke-linecap="round" fill="none"/>
      <ellipse cx="0" cy="-38" rx="6" ry="6.4" fill="#FFFFFF" ${INK}/><path d="M3 -38l3 1" stroke="#F2A0B0" stroke-width="1.6"/><circle cx="2.4" cy="-40" r="1.1" fill="#E5484D"/><path d="M5 -36.5l4 -1M5 -35.5l4 .6" stroke="${ENC}" stroke-width=".4"/>
      <ellipse cx="-3" cy="-54" rx="2.6" ry="11" fill="#FFF" ${INK} transform="rotate(-12 -3 -44)"/><ellipse cx="3" cy="-53" rx="2.6" ry="11" fill="#FFF" ${INK} transform="rotate(14 3 -43)"/><ellipse cx="3" cy="-53" rx="1.1" ry="8" fill="#F2B8C8" transform="rotate(14 3 -43)"/><path d="M-4 -33l8 0" stroke="#E2E2F0" stroke-width="2"/>`;
    // ================= 1. le sol : pré en damier, allées de sable, ombres gravées
    for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(30 + r() * 60)}" ry="${f(14 + r() * 26)}" fill="${r() < .5 ? "#5A9A48" : "#C8E89A"}" opacity=".16"/>`); }
    // la mer, coin bas droit (le quadrille des homards)
    { let d = `M${W + 4} ${H - 230}`; for (let x = W; x >= 700; x -= 30) d += `Q${f(x - 15)} ${f(H - 230 + (W - x) * .55 + 16 + r() * 10)} ${f(x - 30)} ${f(H - 230 + (W - x + 30) * .55 + r() * 8)}`; d += `L${700 - 30} ${H + 4}L${W + 4} ${H + 4}Z`;
      s.push(`<path d="${d}" fill="#EAD9A8" transform="translate(-18 -16)"/><path d="${d}" fill="url(#w3-mer)"/><path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".7"/>`);
      for (let k = 0; k < 14; k++) { const x = 820 + r() * 260, y = H - 120 + r() * 120; s.push(`<path d="M${f(x)} ${f(y)}q6 -4 12 0t12 0" stroke="#E8F8FF" stroke-width="1.2" fill="none" opacity=".6"/>`); } }
    // ================= 2. la mare de larmes (le lac du tracé)
    K.eaux("url(#w3-larmes)", "#FFFFFF");
    const L = (def.eau || [])[0] ? (() => { const P0 = def.eau[0].map(q => [q[0] * ECH * KU, q[1] * ECH * KU]); const cx = P0.reduce((t, p) => t + p[0], 0) / P0.length, cy = P0.reduce((t, p) => t + p[1], 0) / P0.length; return { cx, cy, rx: Math.max(...P0.map(p => Math.abs(p[0] - cx))), ry: Math.max(...P0.map(p => Math.abs(p[1] - cy))), P0 }; })() : null;
    if (L) { const { cx, cy, rx, ry, P0 } = L;
      s.push(`<path d="M${P0.map(p => f(cx + (p[0] - cx) * 1.06) + " " + f(cy + (p[1] - cy) * 1.08)).join("L")}Z" fill="none" stroke="#E8D9A8" stroke-width="7" opacity=".9"/><path d="M${P0.map(p => f(p[0]) + " " + f(p[1])).join("L")}Z" fill="url(#w3-larmes)" stroke="#FFFFFF" stroke-width="2.5"/>`);
      for (let k = 0; k < 10; k++) { const t = r() * TAU, d = .2 + r() * .55; s.push(`<path d="M${f(cx + Math.cos(t) * rx * d)} ${f(cy + Math.sin(t) * ry * d)}q7 -3 14 0" stroke="#FFFFFF" stroke-width="1.2" fill="none" opacity=".55"/>`); }
      // nénuphars en forme de cœur
      for (let k = 0; k < 5; k++) { const t = k * 1.3 + .4, x = cx + Math.cos(t) * rx * .72, y = cy + Math.sin(t) * ry * .7; s.push(sym("c", x, y, 7, "#4E9A4A", ` stroke="${ENC}" stroke-width=".15"`) + `<circle cx="${f(x + 2)}" cy="${f(y - 2)}" r="2.4" fill="#F7A8C8"/>`); }
      // les ondes, la larme géante qui tombe du ciel et éclabousse
      for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * rx * .38, y = cy + (k % 2 ? -1 : 1) * ry * .3; a.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="6" ry="3" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="${vu(0)}">${an(`<animate attributeName="rx" values="4;30" dur="5s" begin="${k * 1.6}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="5s" begin="${k * 1.6}s" repeatCount="indefinite"/>`)}</ellipse>`); }
      a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.05;.3;.36;1" dur="9s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 -140;0 -140;0 0;0 0" keyTimes="0;.05;.32;1" dur="9s" repeatCount="indefinite"/>`)}<path d="M${f(cx + rx * .32)} ${f(cy - 30)}q-9 14 0 18q9 -4 0 -18z" fill="#DFF6FF" stroke="#4A9CC8" stroke-width="1.2"/><path d="M${f(cx + rx * .32 - 2)} ${f(cy - 18)}q-1 -4 2 -6" stroke="#FFF" stroke-width="1.2" fill="none"/></g>`);
      // Alice qui nage (et la souris à côté), la bouteille qui flotte
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;46 -8;0 0" dur="16s" repeatCount="indefinite"/>`)}${G(cx - rx * .12, cy + ry * .34, 1.15)}<path d="M-18 4q18 9 36 0" stroke="#FFFFFF" stroke-width="1.6" fill="none"/><path d="M-12 0Q-13 -9 -6 -10H6Q13 -9 12 0Z" fill="#6AA6E8" ${INK}/><path d="M-12 -2q-8 -2 -12 -8M12 -2q8 -2 12 -8" stroke="${PEAU}" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M-7 -14Q-10 -6 -12 -2M7 -14Q10 -6 12 -2" stroke="${BLOND}" stroke-width="3" fill="none"/><circle cy="-14" r="6.4" fill="${PEAU}" ${INK}/><path d="M-6.8 -14Q-7.4 -22 0 -21.6Q7.4 -22 6.8 -14Q4 -19 0 -18.4Q-4 -19 -6.8 -14Z" fill="${BLOND}" ${INK}/><path d="M-6.2 -17Q0 -21.6 6.2 -17" stroke="${NOIR}" stroke-width="1.6" fill="none"/><circle cx="-2.3" cy="-13.6" r=".85" fill="${ENC}"/><circle cx="2.3" cy="-13.6" r=".85" fill="${ENC}"/><path d="M-1.6 -10.4q1.6 -1 3.2 0" stroke="${ENC}" stroke-width=".7" fill="none"/>
        <g transform="translate(26 2)"><path d="M-8 3q8 5 16 0" stroke="#FFF" stroke-width="1.2" fill="none"/><ellipse cx="0" cy="-1" rx="6" ry="4" fill="#9A8E90" ${INK}/><circle cx="5" cy="-4" r="3" fill="#9A8E90" ${INK}/><circle cx="4" cy="-7" r="1.8" fill="#C8B0B8" ${INK}/><circle cx="6.4" cy="-4.4" r=".6" fill="${ENC}"/><path d="M-6 0q-6 2 -8 -3" stroke="#9A8E90" stroke-width="1" fill="none"/></g></g></g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-14 ${f(cx + rx * .42)} ${f(cy + ry * .3)};14 ${f(cx + rx * .42)} ${f(cy + ry * .3)};-14 ${f(cx + rx * .42)} ${f(cy + ry * .3)}" dur="5s" repeatCount="indefinite"/>`)}${G(cx + rx * .42, cy + ry * .3, 1.2)}<path d="M-12 4q12 6 24 0" stroke="#FFF" stroke-width="1.2" fill="none"/><rect x="-4.5" y="-14" width="9" height="16" rx="3" fill="#8AD8C8" fill-opacity=".85" ${INK}/><rect x="-2" y="-19" width="4" height="6" fill="#8AD8C8" ${INK}/><rect x="-2.6" y="-21" width="5.2" height="3" rx="1" fill="#B07A3A" ${INK}/><rect x="-4.5" y="-9" width="9" height="6" fill="#F4ECD8" stroke="${ENC}" stroke-width=".5"/><text x="0" y="-4.8" text-anchor="middle" font-family="Georgia, serif" font-size="2.8" font-weight="bold" fill="${ROUGE}">BOIS-MOI</text></g></g>`);
      // le Dodo sur la berge, avec sa canne, qui préside la course au caucus
      { const x = cx - rx * .5, y = cy - ry * .32; s.push(`<ellipse cx="${f(x + 2)}" cy="${f(y + 4)}" rx="34" ry="12" fill="#2A6E9A" opacity=".35"/><ellipse cx="${f(x)}" cy="${f(y + 1)}" rx="30" ry="10" fill="#A89E8E" ${INK}/><ellipse cx="${f(x - 4)}" cy="${f(y - 2)}" rx="22" ry="6" fill="#C8BEAE"/><path d="M${f(x - 30)} ${f(y + 6)}q30 10 60 0" stroke="#FFF" stroke-width="1.4" fill="none"/>${G(x, y, 1.3)}<path d="M-4 0v-8M4 0v-8" stroke="#E8A040" stroke-width="2"/><path d="M-14 -6Q-18 -30 0 -32Q18 -30 14 -6Q0 -2 -14 -6Z" fill="#8A7E9A" ${INK}/><path d="M-12 -14q-6 2 -8 -4q4 -4 8 -2" fill="#F4F1EA" ${INK}/><path d="M6 -26q6 -8 4 -18" stroke="#8A7E9A" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M6 -26q6 -8 4 -18" stroke="${ENC}" stroke-width="10.6" stroke-linecap="round" fill="none" opacity=".25"/><circle cx="10" cy="-46" r="8" fill="#9A8EAA" ${INK}/><path d="M16 -48q16 0 16 10q-2 4 -6 2q-2 -6 -10 -6z" fill="#E8B848" ${INK}/><circle cx="12" cy="-48" r="1.4" fill="${ENC}"/><path d="M-14 -4L-20 4" stroke="#6A4A2A" stroke-width="1.8"/><circle cx="-20" cy="5" r="1.6" fill="#E2B93B"/></g>`); }
      // la course au caucus : les animaux trempés tournent autour de la mare
      const tour = `M${f(cx + rx + 26)} ${f(cy)}A${f(rx + 26)} ${f(ry + 22)} 0 1 1 ${f(cx - rx - 26)} ${f(cy)}A${f(rx + 26)} ${f(ry + 22)} 0 1 1 ${f(cx + rx + 26)} ${f(cy)}`;
      const betes = [`<ellipse rx="6" ry="4" fill="#7AA0C8" ${INK}/><circle cx="5" cy="-3" r="3" fill="#7AA0C8" ${INK}/><path d="M7.6 -3l3 1l-3 1z" fill="#E8A040"/>`, `<ellipse rx="5" ry="3.4" fill="#C87A4A" ${INK}/><circle cx="4" cy="-3" r="2.6" fill="#C87A4A" ${INK}/><path d="M6.4 -3l5 .6l-5 1z" fill="#E8C848"/>`, `<ellipse rx="7" ry="4" fill="#8AA85A" ${INK}/><circle cx="6" cy="-1" r="2.6" fill="#8AA85A" ${INK}/><path d="M-6 0l-5 2" stroke="#8AA85A" stroke-width="1.6"/>`, `<ellipse rx="5" ry="3" fill="#E8D8C8" ${INK}/><circle cx="4" cy="-2.6" r="2.4" fill="#E8D8C8" ${INK}/><path d="M6 -2.6l3 .8l-3 .8z" fill="#E8A040"/>`];
      betes.forEach((b, k) => a.push(`<g${K.anime ? "" : ` transform="translate(${f(cx + Math.cos(k * 1.6 + 2) * (rx + 26))} ${f(cy + Math.sin(k * 1.6 + 2) * (ry + 22))})"`}>${an(`<animateMotion dur="22s" begin="-${(k * 5.5).toFixed(1)}s" repeatCount="indefinite" rotate="auto" path="${tour}"/>`)}<g transform="scale(1.3)">${b}</g></g>`));
      K.prendre(cx, cy, Math.min(rx, ry) + 20); boites.push([cx - rx, cy - ry, cx + rx, cy + ry]); }
    // ================= 3. le terrier : un puits vertigineux vu d'en haut (étagères, pots, cartes), où tout tombe en spirale
    { const [x, y] = caser(545, 172, [-78, -78, 78, 78], 20, 40), R = 72;
      s.push(`<circle cx="${f(x + 6)}" cy="${f(y + 8)}" r="${R + 8}" fill="#1E3A1A" opacity=".3"/>`);
      for (let k = 0; k < 18; k++) { const t = k / 18 * TAU, u = x + Math.cos(t) * (R + 2), v = y + Math.sin(t) * (R + 2); s.push(`<path d="M${f(u)} ${f(v)}q${f(Math.cos(t + 1.2) * 14)} ${f(Math.sin(t + 1.2) * 14)} ${f(Math.cos(t) * 16)} ${f(Math.sin(t) * 16)}" stroke="#6A4A2A" stroke-width="3" fill="none" stroke-linecap="round"/>`); }
      s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="#6A4A2E" ${INK}/>`);
      // les anneaux du puits qui s'enfoncent (chacun décalé vers le bas : effet de vertige)
      const NA = 7; for (let k = 0; k < NA; k++) { const t = k / NA, rr = R * (1 - t * .86), ox = x + Math.sin(t * 3) * 6 * t, oy = y + t * 14, c = mixHex("#B08A5A", "#1A0E1E", t * 1.05);
        s.push(`<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(rr)}" fill="${c}" stroke="${ENC}" stroke-width="${f(1.2 - t * .8)}"/>`);
        if (k < 5) { const n = 10 - k; for (let q = 0; q < n; q++) { const th = q / n * TAU + k * .5, px = ox + Math.cos(th) * rr * .93, py = oy + Math.sin(th) * rr * .93, cl = ["#E5484D", "#4C9AFF", "#F2B33A", "#9D6AD8", "#2BB673", "#F4F1EA"][(q + k) % 6];
          s.push(q % 3 === 0 ? `<rect x="${f(px - 2.6 * (1 - t))}" y="${f(py - 3.4 * (1 - t))}" width="${f(5.2 * (1 - t))}" height="${f(6.8 * (1 - t))}" rx="1" fill="${cl}" stroke="${ENC}" stroke-width=".5" transform="rotate(${f(th * 57.3 + 90)} ${f(px)} ${f(py)})"/>` : q % 3 === 1 ? `<circle cx="${f(px)}" cy="${f(py)}" r="${f(2.6 * (1 - t))}" fill="${cl}" stroke="${ENC}" stroke-width=".5"/>` : `<path d="M${f(px)} ${f(py)}L${f(ox + Math.cos(th + .2) * rr * .99)} ${f(oy + Math.sin(th + .2) * rr * .99)}" stroke="#3A2414" stroke-width="${f(1.6 * (1 - t))}"/>`); } } }
      s.push(`<circle cx="${f(x + 3)}" cy="${f(y + 13)}" r="${f(R * .16)}" fill="url(#w3-puits)"/>`);
      // ce qui tombe : horloges, tasses, cartes, pot de marmelade, clé (spirale qui tourne), et Alice dont la robe fait parachute
      const OBJ = [`<circle r="6" fill="url(#w3-or)" ${INK}/><circle r="4.2" fill="#FFF8E6"/><path d="M0 0v-3M0 0h2.4" stroke="${ENC}" stroke-width=".8"/>`, `<path d="M-5 -3h10l-2 7h-6z" fill="#F4F1EA" ${INK}/><path d="M5 -1q4 1 0 4" stroke="${ENC}" fill="none"/>`, `<rect x="-4.5" y="-6" width="9" height="12" rx="1" fill="#FFF" ${INK}/>${sym("c", 0, 0, 3, ROUGE)}`, `<rect x="-4" y="-5" width="8" height="10" rx="2" fill="#F2A03A" ${INK}/><rect x="-4" y="-5" width="8" height="3" fill="#F4ECD8"/><text y="3" text-anchor="middle" font-size="2.6" font-family="Georgia" fill="${ENC}">ORANGE</text>`, `<path d="M-6 0h8M2 0l2 -2l2 2l-2 2zM-4 0v3M-2 0v2" stroke="#E2B93B" stroke-width="1.8" fill="none"/>`, `<rect x="-4.5" y="-6" width="9" height="12" rx="1" fill="#FFF" ${INK}/>${sym("p", 0, 0, 3, NOIR)}`];
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${f(x)} ${f(y)}" to="360 ${f(x)} ${f(y)}" dur="14s" repeatCount="indefinite"/>`)}${OBJ.map((o, k) => { const th = k / OBJ.length * TAU, d = R * (.82 - k * .1), sc = 1.4 - k * .14; return `<g transform="translate(${f(x + Math.cos(th) * d)} ${f(y + 6 * k / OBJ.length + Math.sin(th) * d)}) rotate(${f(th * 57.3)}) scale(${f(sc)})">${o}</g>`; }).join("")}</g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="0 ${f(x)} ${f(y + 4)};-360 ${f(x)} ${f(y + 4)}" dur="20s" repeatCount="indefinite"/>`)}${G(x + 4, y - 26, 1.1, 20)}<path d="M-16 -8Q0 -24 16 -8L12 -2Q0 -10 -12 -2Z" fill="#6AA6E8" ${INK}/><path d="M-9 -4Q0 -10 9 -4L6 0H-6Z" fill="#FFFDF6" ${INK}/><path d="M-12 -2q-6 4 -10 0M12 -2q6 4 10 0" stroke="${PEAU}" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="0" cy="2" r="6" fill="${PEAU}" ${INK}/><path d="M-6 2Q-12 8 -8 16M6 2Q12 8 8 16M-6 0Q0 -4 6 0" stroke="${BLOND}" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="-2.2" cy="3.4" r=".8" fill="${ENC}"/><circle cx="2.2" cy="3.4" r=".8" fill="${ENC}"/><ellipse cx="0" cy="6" rx="1.4" ry="1.8" fill="${ENC}"/></g></g>`);
      s.push(`<path d="M${f(x - R - 8)} ${f(y + R + 2)}q-6 8 4 10" stroke="#5A3A22" stroke-width="2" fill="none"/>`);
      bulle(x - 2, y - R - 18, "Tomber… tomber… tomber…", 10, 1); ruban(x + 4, y + R + 10, "Le terrier"); }
    // ================= 4. le grand goûter du Chapelier (4 chaises réservées aux pilotes : les cadres PORTR)
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    { const SC = 1.08, B = [-200 * SC, -128 * SC, 200 * SC, 52 * SC], [x, y] = caser(530, 520, B, 18, 70); const loc = (u, v) => [x + u * SC, y + v * SC];
      s.push(`${G(x, y, SC)}${ombre(4, 44, 205, 16, .3)}`);
      // les guirlandes de lanternes au-dessus de la table
      s.push(`<path d="M-200 -112Q-100 -86 0 -110Q100 -86 200 -112" stroke="#6A4A2A" stroke-width="1.2" fill="none"/>${Array.from({ length: 13 }, (_, q) => { const u = -186 + q * 31, v = -105 + Math.abs(Math.sin((q / 12) * PI * 2)) * 16; return `<path d="M${u} ${f(v)}v4" stroke="#6A4A2A"/><ellipse cx="${u}" cy="${f(v + 10)}" rx="5.4" ry="7" fill="${["#E5484D", "#F2B33A", "#4C9AFF", "#9D6AD8", "#2BB6A3", "#FF6FA8"][q % 6]}" ${INK}/><path d="M${u - 5} ${f(v + 10)}h10" stroke="${ENC}" stroke-width=".5"/>`; }).join("")}`);
      // le Chapelier (bout gauche), son grand chapeau « 10/6 » en couche animée
      s.push(`<g transform="translate(-164 -6)"><path d="M-22 0Q-26 -42 -10 -50H10Q26 -42 22 0Z" fill="#3E7A4A" ${INK}/><path d="M-8 -48L0 -10L8 -48Z" fill="#E8C34A" ${INK}/>${[-38, -30, -22].map(v => `<circle cx="0" cy="${v}" r="1" fill="${ENC}"/>`).join("")}<path d="M0 -48L-12 -54V-41ZM0 -48L12 -54V-41Z" fill="${ROUGE}" ${INK}/><circle cx="-7" cy="-50" r=".9" fill="#FFF"/><circle cx="7" cy="-46" r=".9" fill="#FFF"/><path d="M-9 -50l-4 -6l6 2M9 -50l4 -6l-6 2" fill="#FFF" ${INK}/>
        <ellipse cx="0" cy="-62" rx="10" ry="11" fill="${PEAU}" ${INK}/><path d="M2 -64q9 4 1 7" fill="${PEAU}" ${INK}/><path d="M-10 -66q-8 2 -7 12M10 -66q8 2 7 12" stroke="#D2692A" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="-3.6" cy="-65" r="1.2" fill="${ENC}"/><circle cx="4.6" cy="-65" r="1.2" fill="${ENC}"/><path d="M-6 -56q6 4 12 0" stroke="${ENC}" stroke-width="1" fill="#FFF"/><path d="M-7 -68l4 -1M3 -69l4 1" stroke="${ENC}" stroke-width=".8"/>
        <path d="M18 -36Q30 -40 32 -54" stroke="#3E7A4A" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M27 -58h10l-1.6 7h-6.8z" fill="#FFF" ${INK}/><path d="M37 -56q4 1 0 4" stroke="${ENC}" fill="none"/></g>`);
      a.push(`<g transform="translate(${f(loc(-164, -76)[0])} ${f(loc(-164, -76)[1])}) scale(${SC})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="-8 0 0;6 0 0;-8 0 0" dur="3.4s" repeatCount="indefinite"/>`)}<path d="M-14 0L-20 -46Q0 -52 20 -46L14 0Z" fill="#4A3A5A" ${INK}/><path d="M-19 -42Q0 -47 19 -42" stroke="#6A5A7A" stroke-width="1.5" fill="none"/><rect x="-16" y="-12" width="32" height="7" fill="${ROUGE}"/><g transform="rotate(14 13 -14)"><rect x="8" y="-22" width="12" height="9" fill="#FFFDF6" ${INK}/><text x="14" y="-15.4" text-anchor="middle" font-family="Georgia" font-size="5.4" fill="${ENC}">10/6</text></g><ellipse cx="0" cy="0" rx="25" ry="5" fill="#3A2A4A" ${INK}/></g></g>`);
      // le Lièvre de Mars (paille dans les oreilles) qui trempe la montre dans le thé
      s.push(`<g transform="translate(-112 -6)"><path d="M-18 0Q-20 -38 0 -44Q20 -38 18 0Z" fill="#B88A58" ${INK}/><path d="M-9 -42l9 6l9 -6l-9 -4z" fill="#2E5AA8" ${INK}/><path d="M-6 -36h12v24h-12z" fill="#F4ECD8" stroke="${ENC}" stroke-width=".6"/>
        <ellipse cx="-6" cy="-84" rx="4.6" ry="20" fill="#C89A68" ${INK} transform="rotate(-16 -6 -66)"/><ellipse cx="-6" cy="-84" rx="2" ry="14" fill="#F2B8C0" transform="rotate(-16 -6 -66)"/><ellipse cx="7" cy="-82" rx="4.6" ry="19" fill="#C89A68" ${INK} transform="rotate(22 7 -64)"/><path d="M-12 -98l6 6M-8 -100l2 8M10 -96l-4 7M14 -94l-6 4" stroke="#E8C848" stroke-width="1.4"/>
        <ellipse cx="0" cy="-56" rx="11" ry="10" fill="#C89A68" ${INK}/><ellipse cx="4" cy="-52" rx="6" ry="4.4" fill="#F4E4D0"/><circle cx="-4" cy="-59" r="2.6" fill="#FFF" ${INK}/><circle cx="5" cy="-59" r="2.6" fill="#FFF" ${INK}/><circle cx="-3.6" cy="-58.6" r="1.2" fill="${ENC}"/><circle cx="5.4" cy="-58.2" r="1.2" fill="${ENC}"/><circle cx="6" cy="-53.4" r="1.2" fill="#E57A8A"/><path d="M6 -51l7 -1M6 -50l7 2" stroke="${ENC}" stroke-width=".5"/></g>`);
      a.push(`<g transform="translate(${f(loc(-90, -30)[0])} ${f(loc(-90, -30)[1])}) scale(${SC})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 -6;0 -6;0 4;0 4;0 -6" keyTimes="0;.4;.5;.85;1" dur="5s" repeatCount="indefinite"/>`)}<path d="M-14 0Q-6 -2 0 -4" stroke="#B88A58" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M0 -4v6" stroke="#E2B93B" stroke-width=".8"/><circle cx="0" cy="6" r="5" fill="url(#w3-or)" ${INK}/><circle cx="0" cy="6" r="3.4" fill="#FFF8E6"/><path d="M0 6v-2.4M0 6h1.8" stroke="${ENC}" stroke-width=".6"/></g></g>`);
      // les 4 chaises des pilotes : dossier haut, cadre ovale (portrait posé par l'appli), coussin à leur couleur
      COULEURS_J.forEach((c, k) => { const u = -52 + k * 50, mv = -66;
        s.push(`<g transform="translate(${u} 0)"><path d="M-17 -6V${mv + 14}Q-17 ${mv - 26} 0 ${mv - 28}Q17 ${mv - 26} 17 ${mv + 14}V-6" fill="#7A4A2A" ${INK}/><path d="M-12 -8V${mv + 18}M12 -8V${mv + 18}" stroke="#5A3418" stroke-width="2.4"/><circle cx="0" cy="${mv}" r="20.5" fill="url(#w3-or)" ${INK}/><circle cx="0" cy="${mv}" r="17.6" fill="${mixHex(c, "#FFFFFF", .55)}" stroke="${c}" stroke-width="2"/>
          <path d="M-9 ${mv + 15}Q-9 ${mv + 4} 0 ${mv + 4}Q9 ${mv + 4} 9 ${mv + 15}Z" fill="${c}" opacity=".55"/><circle cx="0" cy="${mv - 3}" r="6" fill="${c}" opacity=".55"/>${sym(["c", "p", "k", "t"][k], 0, mv - 28, 4.4, k % 2 ? NOIR : ROUGE)}<path d="M-16 -10H16" stroke="${c}" stroke-width="7" stroke-linecap="round"/></g>`);
        const [px, py] = loc(u, mv); PORTR.push({ k, x: +px.toFixed(1), y: +py.toFixed(1), r: +(16 * SC).toFixed(1) }); });
      // Alice dans son grand fauteuil (bout droit)
      s.push(`<g transform="translate(160 0)"><path d="M-28 -4Q-32 -84 0 -88Q32 -84 28 -4Z" fill="#8A2A3A" ${INK}/><path d="M-20 -78Q0 -84 20 -78" stroke="#B84A5A" stroke-width="2" fill="none"/>${[-60, -40, -20].map(v => `<circle cx="0" cy="${v}" r="1.6" fill="#E2B93B"/>`).join("")}<path d="M-26 -42q-10 0 -10 14v24M26 -42q10 0 10 14v24" stroke="#6A1A2A" stroke-width="9" fill="none" stroke-linecap="round"/><g transform="translate(0 8)">${alice()}</g></g>`);
      // la table : nappe, vaisselle dépareillée, le Loir dans la théière, gâteaux, tartines, confiture
      s.push(`<path d="M-196 -10H196L206 26H-206Z" fill="url(#w3-nappe)" ${INK}/><path d="M-206 26H206V40H-206Z" fill="#F2A8C8" ${INK}/>${Array.from({ length: 28 }, (_, q) => `<path d="M${-206 + q * 14.7} 40q7.3 9 14.7 0" fill="#F2A8C8" stroke="${ENC}" stroke-width=".8"/>`).join("")}<path d="M-206 30H206" stroke="#FFF" stroke-width="1.4" opacity=".7"/>`);
      for (let q = 0; q < 14; q++) { const u = -186 + q * 27 + (q % 2) * 5, v = -2 + (q % 3) * 8, cl = ["#E5484D", "#4C8DFF", "#F2B33A", "#9D6AD8", "#2BB673", "#FF8FB8"][q % 6]; if (q >= 5 && q <= 8) continue; s.push(`<ellipse cx="${u}" cy="${v + 3}" rx="8" ry="2.8" fill="#FFF" stroke="#B8A890"/><path d="M${u - 5} ${v - 5}h10l-1.6 8h-6.8z" fill="${cl}" ${INK}/><path d="M${u + 5} ${v - 3}q4 1 0 4" stroke="${ENC}" fill="none"/>`); }
      COULEURS_J.forEach((c, k) => { const u = -52 + k * 50; s.push(`<ellipse cx="${u - 9}" cy="12" rx="9" ry="3" fill="#FFF" stroke="#B8A890"/><path d="M${u - 15} 3h12l-2 9h-8z" fill="${c}" ${INK}/><path d="M${u - 3} 5q5 1 0 5" stroke="${ENC}" fill="none"/><path d="M${u + 1} 6h18l-2 10h-14z" fill="#FFFDF6" ${INK}/><text x="${u + 10}" y="13.6" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="6.4" fill="${mixHex(c, "#000000", .25)}">${NOMS[k]}</text>`); });
      s.push(`<g transform="translate(-122 6)"><ellipse cx="0" cy="6" rx="18" ry="4" fill="#000" opacity=".15"/><ellipse rx="16" ry="12" fill="#FFF8EE" ${INK}/><path d="M-12 -2q12 8 24 0M-12 4q12 8 24 0" stroke="#4C7AC8" stroke-width="1.6" fill="none"/><path d="M15 -2q11 -6 13 -16" stroke="#FFF8EE" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M15 -2q11 -6 13 -16" stroke="${ENC}" stroke-width="6.6" stroke-linecap="round" fill="none" opacity=".2"/><path d="M-15 -4q-10 2 -8 10" stroke="${ENC}" stroke-width="2.4" fill="none"/></g>`);
      s.push(`<g transform="translate(118 4)"><ellipse rx="14" ry="10" fill="#E8F0FF" ${INK}/><path d="M-10 -1q10 6 20 0" stroke="${ROUGE}" stroke-width="1.6" fill="none"/>${sym("c", 0, 2, 3, ROUGE)}<path d="M13 -2q9 -4 11 -12" stroke="#E8F0FF" stroke-width="4" stroke-linecap="round" fill="none"/><ellipse cy="-9" rx="7" ry="2.5" fill="#D8E0F0" ${INK}/><circle cy="-12" r="2" fill="#E2B93B" ${INK}/></g>`);
      s.push(`<g transform="translate(70 18)"><ellipse rx="14" ry="4" fill="#FFF" stroke="#B8A890"/><path d="M-10 -1v-8q10 -4 20 0v8q-10 4 -20 0z" fill="#F7E0A8" ${INK}/><path d="M-10 -9q10 4 20 0" fill="none" stroke="#FFF" stroke-width="2.2"/>${[-6, 0, 6].map(u => `<circle cx="${u}" cy="-12" r="2" fill="${ROUGE}"/>`).join("")}</g><g transform="translate(-74 18)"><ellipse rx="12" ry="3.4" fill="#FFF" stroke="#B8A890"/><rect x="-9" y="-6" width="8" height="5" rx="1" fill="#F2D49A" ${INK}/><rect x="1" y="-6" width="8" height="5" rx="1" fill="#F2D49A" ${INK}/></g>`);
      s.push("</g>");
      // le Loir qui sort (et retombe) de la théière ; vapeur
      const [tx, ty] = loc(-122, 0);
      a.push(`<g transform="translate(${f(tx)} ${f(ty)}) scale(${SC})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 12;0 12;0 -4;0 -4;0 12" keyTimes="0;.55;.62;.88;1" dur="7s" repeatCount="indefinite"/>`)}<ellipse cy="-8" rx="7" ry="6" fill="#A8A0A8" ${INK}/><circle cx="-5" cy="-13" r="2.6" fill="#C8B8C0" ${INK}/><circle cx="5" cy="-13" r="2.6" fill="#C8B8C0" ${INK}/><path d="M-3 -8q1.4 1 2.6 0M.6 -8q1.4 1 2.6 0" stroke="${ENC}" stroke-width=".7" fill="none"/><circle cx="0" cy="-5.4" r="1" fill="#E57A8A"/></g><ellipse rx="16" ry="5" cy="-8" fill="#FFF8EE" ${INK}/><ellipse cx="0" cy="-8" rx="9" ry="2.6" fill="#3A2A1A"/></g>`);
      a.push(`<g opacity="${vu(.0)}">${an(`<animate attributeName="opacity" values="0;.8;0" dur="4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -14" dur="4s" repeatCount="indefinite"/>`)}${[[118, -14], [-94, -28]].map(([u, v]) => { const [px, py] = loc(u, v); return `<path d="M${f(px)} ${f(py)}q-5 -6 0 -12t0 -12" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>`; }).join("")}</g>`);
      const [bx, by] = loc(-60, -112); bulle(bx, by, "Pas de place ! Pas de place !", 9, 0, -30);
      const [cx2, cy2] = loc(110, -112); bulle(cx2, cy2, "Changement de place !", 9, 4.5, 30); const [rx2, ry2] = loc(0, 62); ruban(rx2, ry2, "Le goûter des fous"); }
    // ================= 5. la Reine de cœur : roseraie, croquet aux flamants et aux hérissons, soldats-cartes en arceaux
    { const SC = 1.1, [x, y] = caser(812, 222, [-108 * SC, -86 * SC, 108 * SC, 58 * SC], 18, 70);
      s.push(`${G(x, y, SC)}${ombre(4, 30, 104, 30, .22)}<rect x="-104" y="-36" width="208" height="88" rx="16" fill="#5FB052" ${INK}/><path d="M-96 -20H96M-96 0H96M-96 20H96M-96 40H96" stroke="#72C462" stroke-width="9" opacity=".7"/><rect x="-96" y="-28" width="192" height="72" rx="10" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-dasharray="5 4" opacity=".7"/>`);
      // le rosier blanc qu'on repeint en rouge (deux jardiniers-cartes, pot de peinture)
      s.push(`<g transform="translate(-74 -50)"><circle r="20" fill="#2E7A3A" ${INK}/><circle cx="-4" cy="-4" r="12" fill="#3E8A4A"/>${[[-9, -8], [6, -10], [-2, 4], [10, 4], [-12, 6], [2, -2]].map(([u, v], q) => `<circle cx="${u}" cy="${v}" r="4" fill="${q < 3 ? "#E5484D" : "#FAF6EE"}" stroke="#8A2A2A" stroke-width=".6"/><path d="M${u - 2} ${v}q2 -2 4 0" stroke="#8A2A2A" stroke-width=".5" fill="none"/>`).join("")}</g><g transform="translate(-40 -24) scale(.9)">${soldat(0)}<path d="M8 -20l10 -14" stroke="#7A5A3A" stroke-width="1.6"/><path d="M18 -34l2 -4l2 3z" fill="${ROUGE}"/></g><g transform="translate(-50 -2) scale(.6)"><path d="M-6 0h12l-1 -10h-10z" fill="#8A8A9A" ${INK}/><ellipse cy="-10" rx="5" ry="1.6" fill="${ROUGE}"/></g>`);
      // les arceaux : soldats courbés
      [[-6, 18], [40, -10], [78, 26]].forEach(([u, v], q) => s.push(`<g transform="translate(${u} ${v})"><path d="M-10 6Q-10 -14 0 -16Q10 -14 10 6" fill="none" stroke="${ENC}" stroke-width="7.4"/><path d="M-10 6Q-10 -14 0 -16Q10 -14 10 6" fill="none" stroke="#FFFDF6" stroke-width="5.6"/>${sym(["c", "p", "k"][q], 0, -14.6, 2.6, q === 1 ? NOIR : ROUGE)}<circle cx="-10" cy="8" r="3" fill="${PEAU}" ${INK}/></g>`));
      // la Reine qui hurle, le Roi qui gracie en douce
      s.push(`<g transform="translate(68 -8) scale(1.25)">${ombre(0, 0, 20, 4)}<path d="M-20 0L-12 -30Q0 -36 12 -30L20 0Z" fill="${ROUGE}" ${INK}/><path d="M-17 -10H17M-15 -18H15" stroke="#F7CF55" stroke-width="1.2"/>${[-10, 0, 10].map(u => sym("c", u, -5, 2.4, "#FFF")).join("")}${sym("c", -6, -24, 2.2, "#FFF")}${sym("c", 6, -24, 2.2, "#FFF")}<path d="M-12 -30q-12 -2 -14 -8q8 2 12 -2zM12 -30q12 -2 14 -8q-8 2 -12 -2z" fill="#F4F1EA" ${INK}/><path d="M-10 -31L-12 -38H12L10 -31Z" fill="${NOIR}" ${INK}/>
        <circle cy="-44" r="9" fill="${PEAU}" ${INK}/><path d="M-7 -50l2 -9l3 5l2 -6l2 6l3 -5l2 9z" fill="url(#w3-or)" ${INK}/><path d="M-5 -46l3 1.4M5 -46l-3 1.4" stroke="${ENC}" stroke-width="1.2"/><circle cx="-3" cy="-43.6" r="1" fill="${ENC}"/><circle cx="3" cy="-43.6" r="1" fill="${ENC}"/><ellipse cy="-39" rx="2.6" ry="2.2" fill="#6A1A1A"/><path d="M-9 -40q-2 6 2 10M9 -40q2 6 -2 10" stroke="#3A2A1A" stroke-width="2" fill="none"/></g>
        <g transform="translate(96 4) scale(.95)">${ombre(0, 0, 12, 3)}<path d="M-12 0L-8 -22Q0 -26 8 -22L12 0Z" fill="#7A1A3A" ${INK}/><path d="M-8 -22Q0 -18 8 -22L6 -2Q0 2 -6 -2Z" fill="#F4F1EA" opacity=".9"/><circle cy="-30" r="6.6" fill="${PEAU}" ${INK}/><path d="M-6 -28q6 12 12 0q-2 6 -6 7q-4 -1 -6 -7z" fill="#F4F4F4" ${INK}/><path d="M-5 -35l1.6 -6l2.2 3l1.2 -4l1.2 4l2.2 -3l1.6 6z" fill="url(#w3-or)" ${INK}/><circle cx="-2.4" cy="-31" r=".8" fill="${ENC}"/><circle cx="2.4" cy="-31" r=".8" fill="${ENC}"/></g>`);
      // Alice qui tient son flamant (couche animée : le flamant frappe le hérisson)
      s.push(`<g transform="translate(-22 44) scale(1.05)">${ombre(0, 0, 12, 3)}${alice(`<path d="M-8 -32Q-14 -26 -10 -20M8 -32Q14 -28 16 -24" stroke="${PEAU}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`)}</g>`);
      s.push("</g>");
      a.push(`${G(x, y, SC)}<g transform="translate(-6 18)"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="20 0 0;20 0 0;-30 0 0;20 0 0" keyTimes="0;.5;.58;1" dur="4s" repeatCount="indefinite"/>`)}<path d="M0 0Q-2 14 -10 22" stroke="#F28AB0" stroke-width="2.4" fill="none"/><ellipse cx="0" cy="-4" rx="5" ry="8" fill="#F28AB0" ${INK} transform="rotate(-20)"/><path d="M-10 22q-3 4 1 6" stroke="#F28AB0" stroke-width="2.4" fill="none"/><circle cx="-8" cy="29" r="3" fill="#F28AB0" ${INK}/><path d="M-6 30l4 3l-5 0z" fill="${ENC}"/><path d="M2 -8l6 -10M-2 -8l2 -12" stroke="#E87AA0" stroke-width="1.4"/></g></g>
        <g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;46 -26;46 -26;0 0" keyTimes="0;.56;.75;.95;1" dur="4s" repeatCount="indefinite"/>`)}<g transform="translate(-14 52)"><ellipse rx="6" ry="4.4" fill="#8A6A48" ${INK}/>${[0, 1, 2, 3, 4, 5, 6].map(q => `<path d="M${f(Math.cos(q * .9 - 2.6) * 4.6)} ${f(Math.sin(q * .9 - 2.6) * 3.4)}l${f(Math.cos(q * .9 - 2.6) * 3.4)} ${f(Math.sin(q * .9 - 2.6) * 3.4)}" stroke="#4A3018" stroke-width="1"/>`).join("")}<circle cx="5" cy="1" r="1.6" fill="#D8B898"/></g></g></g>`);
      bulle(x + 72 * SC, y - 84 * SC, "Qu'on lui coupe la tête !", 8, 2, 4); ruban(x - 40 * SC, y + 62 * SC, "Le croquet de la Reine");
    }
    // ================= 6. la Chenille bleue sur son champignon, qui souffle des ronds : « Qui es-tu ? »
    { const SC = 1.15, [x, y] = caser(820, 420, [-70 * SC, -88 * SC, 70 * SC, 62 * SC], 18, 60);
      s.push(`${G(x, y, SC)}${ombre(6, 40, 62, 10)}<path d="M-12 40Q-15 0 -8 -10H8Q15 0 12 40Z" fill="#F4ECD8" ${INK}/><path d="M-6 36Q-8 4 -4 -8" stroke="#D8C8A8" stroke-width="2" fill="none"/><path d="M-62 -8Q-54 -50 0 -52Q54 -50 62 -8Q30 2 0 0Q-30 2 -62 -8Z" fill="url(#w3-champi)" ${INK}/><path d="M-56 -8Q-28 -2 0 -2Q28 -2 56 -8" stroke="#F8D0D8" stroke-width="1.6" fill="none"/>${[[-38, -22, 7], [-14, -38, 6], [12, -28, 8], [36, -34, 5.6], [48, -16, 4.4], [-24, -12, 4.6], [24, -12, 4]].map(([u, v, R]) => `<ellipse cx="${u}" cy="${v}" rx="${R}" ry="${R * .7}" fill="#FFF8F0" stroke="${ENC}" stroke-width=".6"/>`).join("")}
        <g transform="translate(-30 -44)"><path d="M-6 0Q-6 -12 0 -14Q6 -12 6 0Z" fill="#7AD0C0" ${INK}/><path d="M0 -14V-22" stroke="#7AD0C0" stroke-width="2"/><path d="M0 -6Q16 -4 22 -14" stroke="#4A6A8A" stroke-width="1.6" fill="none"/></g>
        ${[[-6, -46, 7], [4, -50, 7.4], [14, -52, 7.6], [24, -54, 7.2], [32, -60, 6.6]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#4A8AE0" ${INK}/><path d="M${u - R + 2} ${v + 2}q${R - 2} 4 ${2 * R - 4} 0" stroke="#2A5AA8" stroke-width="1.2" fill="none"/><path d="M${u - 3} ${v + R - 1}v3M${u + 3} ${v + R - 1}v3" stroke="${ENC}" stroke-width="1.2"/>`).join("")}
        <circle cx="34" cy="-74" r="9" fill="#5A9AF0" ${INK}/><circle cx="31" cy="-76" r="1.2" fill="${ENC}"/><circle cx="37" cy="-76" r="1.2" fill="${ENC}"/><path d="M28 -82q-3 -6 -6 -6M40 -82q3 -6 6 -6" stroke="${ENC}" stroke-width="1.2" fill="none"/><path d="M27 -70q2 -2 4 0" stroke="${ENC}" stroke-width=".8" fill="none"/><path d="M22 -14Q24 -40 26 -68" stroke="#4A6A8A" stroke-width="1.4" fill="none"/></g>`);
      ["Qui", "es-", "tu ?"].forEach((w, k) => { const u = x + (40 + k * 24) * SC, v = y - (98 + k * 11) * SC; a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(.08 + k * .14).toFixed(2)};${(.16 + k * .14).toFixed(2)};.82;1" dur="8s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -10" dur="8s" repeatCount="indefinite"/>`)}<ellipse cx="${f(u)}" cy="${f(v)}" rx="${f(16 + k * 2)}" ry="11" fill="#EEF4FF" opacity=".92" stroke="#B8C8E0"/><text x="${f(u)}" y="${f(v + 4)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#2A4A8A">${w}</text></g>`); });
      // la petite Alice au pied du champignon (elle a rapetissé)
      s.push(`${G(x - 52 * SC, y + 40 * SC, .7)}${ombre(0, 0, 12, 3)}${alice()}</g>`); ruban(x - 30 * SC, y + 56 * SC, "La Chenille"); }
    // ================= 7. la maison du Lapin blanc : Alice a trop grandi (bras par la fenêtre, pied par la cheminée), Bill s'envole
    { const SC = 1.12, [x, y] = caser(250, 330, [-92 * SC, -110 * SC, 74 * SC, 48 * SC], 18, 60);
      s.push(`${G(x, y, SC)}${ombre(6, 46, 76, 10)}<rect x="-48" y="-36" width="96" height="80" fill="#F2E2C4" ${INK}/>${Array.from({ length: 7 }, (_, q) => `<path d="M-48 ${-28 + q * 11}H48" stroke="#D8C4A0" stroke-width="1"/>`).join("")}<path d="M-58 -34L0 -84L58 -34Z" fill="#B5523A" ${INK}/>${Array.from({ length: 5 }, (_, q) => `<path d="M${-46 + q * 6} ${-44 - q * 8}H${46 - q * 6}" stroke="#8A3A2A" stroke-width="1"/>`).join("")}
        <rect x="18" y="-92" width="14" height="34" fill="#8A5A4A" ${INK}/><rect x="15" y="-96" width="20" height="6" fill="#6A4A3A" ${INK}/>
        <rect x="-12" y="4" width="24" height="40" rx="12" fill="#6A8AC8" ${INK}/><circle cx="6" cy="26" r="1.6" fill="#E2B93B"/><rect x="-10" y="-12" width="20" height="8" fill="#FFFDF6" ${INK}/><text x="0" y="-6" text-anchor="middle" font-family="Georgia" font-size="5" fill="${ENC}">W. LAPIN</text>
        <rect x="-42" y="-22" width="22" height="22" fill="#5A4A3A" ${INK}/><circle cx="-31" cy="-11" r="9" fill="#F2CF6A" opacity=".9"/><circle cx="-33" cy="-12" r="2.4" fill="#FFF" ${INK}/><circle cx="-33" cy="-12" r="1.2" fill="#2A5AA8"/>
        <rect x="22" y="-22" width="20" height="22" fill="#5A4A3A" ${INK}/><path d="M30 -10Q60 -14 76 2Q82 10 74 14Q66 16 58 8Q46 0 32 0Z" fill="#6AA6E8" ${INK}/><path d="M64 4Q78 8 86 22" stroke="${PEAU}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M64 4Q78 8 86 22" stroke="${ENC}" stroke-width="10.6" stroke-linecap="round" fill="none" opacity=".2"/><circle cx="88" cy="26" r="6" fill="${PEAU}" ${INK}/>
        <path d="M-60 44h120" stroke="#6A8A4A" stroke-width="3"/>${[-52, -40, 40, 52].map(u => `<circle cx="${u}" cy="40" r="6" fill="#4E9A4A" ${INK}/><circle cx="${u}" cy="38" r="2" fill="#F7A8C8"/>`).join("")}</g>`);
      // le pied qui dépasse de la cheminée et donne le coup (couche animée), le lézard Bill éjecté
      a.push(`${G(x, y, SC)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -10;0 0;0 0" keyTimes="0;.46;.5;.56;1" dur="7s" repeatCount="indefinite"/>`)}<ellipse cx="25" cy="-98" rx="9" ry="5" fill="${NOIR}" ${INK}/><path d="M18 -98h14" stroke="#FFF" stroke-width="2"/></g>
        <g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;-30 -60;-80 -40;-80 -40;0 0" keyTimes="0;.5;.62;.78;.95;1" dur="7s" repeatCount="indefinite"/>`)}<g transform="translate(25 -100)"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="0;0;520;720;720;0" keyTimes="0;.5;.62;.78;.95;1" dur="7s" repeatCount="indefinite"/>`)}<ellipse rx="7" ry="3" fill="#6AA84A" ${INK}/><circle cx="7" cy="-1" r="2.6" fill="#6AA84A" ${INK}/><path d="M-7 0q-6 -1 -8 3" stroke="#6AA84A" stroke-width="1.6" fill="none"/><path d="M-3 2l-2 4M3 2l2 4M-3 -2l-2 -4M3 -2l2 -4" stroke="#6AA84A" stroke-width="1.2"/><circle cx="8" cy="-2" r=".6" fill="${ENC}"/></g></g></g></g>`);
      bulle(x + 30 * SC, y - 124 * SC, "Le pauvre petit Bill !", 8, 3, -10); ruban(x, y + 58 * SC, "La maison du Lapin"); }
    // ================= 8. le Chat sur sa branche (dedans, haut gauche) : il disparaît… il ne reste que le sourire, qui réapparaît ailleurs
    const sourire = (x, y, sc) => `${G(x, y, sc)}<path d="M-14 -2Q0 14 14 -2Q0 6 -14 -2Z" fill="#FFFFFF" ${INK}/>${[-9, -5, -1, 3, 7, 11].map(u => `<path d="M${u} ${f(1 + Math.abs(u) * -.18 + 2)}v${f(2.6 - Math.abs(u) * .1)}" stroke="${ENC}" stroke-width=".6"/>`).join("")}<path d="M-14 -2q-2 -1 -3 -3M14 -2q2 -1 3 -3" stroke="${ENC}" stroke-width="1"/></g>`;
    const chatCorps = `<path d="M-30 6Q-34 -16 -14 -22Q14 -26 30 -10Q34 4 20 8Z" fill="url(#w3-chat)" ${INK}/>${[-20, -10, 0, 10, 20].map(u => `<path d="M${u} -21q3 12 0 26" stroke="#7A4A9A" stroke-width="2.6" fill="none"/>`).join("")}<path d="M-30 4Q-50 10 -46 34Q-44 40 -40 34Q-42 18 -28 12" fill="url(#w3-chat)" ${INK}/>${[18, 26].map(v => `<path d="M-48 ${v}h7" stroke="#7A4A9A" stroke-width="2.6"/>`).join("")}
      <circle cx="14" cy="-24" r="16" fill="url(#w3-chat)" ${INK}/><path d="M2 -34L0 -50L12 -38ZM26 -34L30 -50L18 -38Z" fill="#C88AD8" ${INK}/><path d="M4 -24q-6 0 -10 2M4 -20q-6 2 -10 4M24 -24q6 0 10 2M24 -20q6 2 10 4" stroke="${ENC}" stroke-width=".6"/><ellipse cx="8" cy="-29" rx="3.4" ry="4.4" fill="#F7E04A" ${INK}/><ellipse cx="20" cy="-29" rx="3.4" ry="4.4" fill="#F7E04A" ${INK}/><ellipse cx="8" cy="-29" rx="1" ry="3.4" fill="${ENC}"/><ellipse cx="20" cy="-29" rx="1" ry="3.4" fill="${ENC}"/><path d="M12 -24l2 2l2 -2z" fill="#E57A9A"/>`;
    { const SC = 1.2, [x, y] = caser(300, 168, [-86 * SC, -76 * SC, 92 * SC, 52 * SC], 18, 60);
      s.push(`${G(x, y, SC)}${ombre(10, 46, 70, 12)}<path d="M-6 48Q-14 10 0 -14Q8 -30 -6 -44" stroke="#6A4A2A" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M-6 48Q-14 10 0 -14Q8 -30 -6 -44" stroke="${ENC}" stroke-width="16.4" fill="none" stroke-linecap="round" opacity=".25"/><path d="M0 -14Q40 -16 82 -28" stroke="#6A4A2A" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-2 -10Q-30 -14 -60 -30" stroke="#6A4A2A" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${[[-40, -52, 24], [-6, -66, 26], [30, -52, 22], [62, -46, 18], [-64, -36, 16], [8, -40, 18]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#3E8A4A" ${INK}/><circle cx="${u - 5}" cy="${v - 6}" r="${R * .55}" fill="#62B058"/>`).join("")}${[[-30, -60], [14, -74], [40, -50], [-58, -34], [60, -40]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="3" fill="#F7A8C8" ${INK}/>`).join("")}
        <g transform="translate(-48 32)"><path d="M0 18V-10" stroke="#7A5A3A" stroke-width="3"/><path d="M-2 -10h-26l-5 5l5 5h26z" fill="#F4ECD8" ${INK}/><text x="-16" y="-3" text-anchor="middle" font-family="Georgia" font-size="6" fill="${ENC}">PAR ICI</text><path d="M2 2h26l5 5l-5 5h-26z" fill="#F4ECD8" ${INK}/><text x="15" y="9" text-anchor="middle" font-family="Georgia" font-size="6" fill="${ENC}">PAR LÀ</text></g></g>`);
      a.push(`${G(x, y, SC)}<g transform="translate(38 -26)"><g opacity="1">${an(`<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.3;.45;.85;1" dur="12s" repeatCount="indefinite"/>`)}${chatCorps}</g>${sourire(14, -16, 1)}</g></g>`);
      bulle(x + 96 * SC, y + 48 * SC, "Ici, tout le monde est fou.", 12, 1, -40, true); ruban(x - 84 * SC, y + 52 * SC, "Le Chat");
      // le sourire voyage : il réapparaît ailleurs pendant que le chat a disparu
      const ailleurs = [[L ? L.cx + L.rx * .2 : 600, L ? L.cy + 10 : 300], [380, 30]]; ailleurs.forEach(([u, v], q) => { a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${(.45 + q * .2).toFixed(2)};${(.5 + q * .2).toFixed(2)};${(.6 + q * .2).toFixed(2)};${(.65 + q * .2).toFixed(2)};1" dur="12s" repeatCount="indefinite"/>`)}${sourire(u, v, 1.4)}<ellipse cx="${f(u - 7)}" cy="${f(v - 14)}" rx="3" ry="4" fill="#F7E04A" opacity=".8"/><ellipse cx="${f(u + 7)}" cy="${f(v - 14)}" rx="3" ry="4" fill="#F7E04A" opacity=".8"/></g>`); }); }
    // ================= 9. dehors : le château de cœur (haut droit)
    { const SC = 1, [x, y] = caser(1010, 92, [-70, -90, 70, 40], 18, 50);
      s.push(`${G(x, y, SC)}${ombre(4, 40, 70, 10)}<path d="M-62 40V-10H62V40Z" fill="#F4C8D0" ${INK}/>${Array.from({ length: 6 }, (_, q) => `<path d="M-62 ${-2 + q * 8}H62" stroke="#E0A8B4" stroke-width=".8"/>`).join("")}
        ${[[-62, 16, 60], [62, 16, 60], [0, 24, 90]].map(([u, w, h]) => `<rect x="${u - w / 2}" y="${40 - h}" width="${w}" height="${h}" fill="#F7D0D8" ${INK}/><path d="M${u - w / 2 - 3} ${40 - h}L${u} ${40 - h - w * 1.1}L${u + w / 2 + 3} ${40 - h}Z" fill="${ROUGE}" ${INK}/>${sym("c", u, 40 - h - w * 1.1 - 4, 4, ROUGE, ` stroke="${ENC}" stroke-width=".3"`)}<rect x="${u - 3}" y="${48 - h}" width="6" height="9" rx="3" fill="${NOIR}"/>`).join("")}
        ${[-40, -24, 24, 40].map(u => sym("c", u, -14, 5, ROUGE, ` stroke="${ENC}" stroke-width=".25"`)).join("")}<path d="M-12 40V20Q0 8 12 20V40Z" fill="#5A2A2A" ${INK}/><path d="M-16 40h32v4h-32z" fill="#C8B8A0"/>${sym("c", 0, -36, 7, "#FFF", ` stroke="${ROUGE}" stroke-width=".3"`)}${[-48, 48].map(u => `<g transform="translate(${u} 50) scale(.8)">${soldat(u > 0 ? 0 : 1, 1, true)}</g>`).join("")}</g>`); ruban(x, y + 64, "Le château de Cœur");
      a.push(`${G(x, y - 76 * SC, 1)}<path d="M0 0V-14" stroke="${ENC}" stroke-width="1"/><path d="M0 -14h12l-3 3l3 3h-12z" fill="${ROUGE}">${an(`<animateTransform attributeName="transform" type="skewY" values="0;-12;0" dur="1.6s" repeatCount="indefinite"/>`)}</path></g>`); }
    // ================= 10. dehors : la petite porte, la table de verre, la clé d'or, « BOIS-MOI » et « MANGE-MOI » (haut gauche)
    { const [x, y] = caser(70, 70, [-56, -50, 56, 40], 18, 50);
      s.push(`${G(x, y, 1)}${ombre(2, 38, 56, 8)}<path d="M-50 38V-30Q-50 -44 -36 -44H-6Q8 -44 8 -30V38Z" fill="#7A5A4A" ${INK}/>${[-40, -28, -16, -4].map(u => `<path d="M${u} -40V36" stroke="#5A3A2A" stroke-width="1"/>`).join("")}<rect x="-30" y="6" width="18" height="32" rx="9" fill="#C86A3A" ${INK}/><circle cx="-16" cy="22" r="1.6" fill="#F7CF55"/><path d="M-28 -18h22v12h-22z" fill="#2E5A3A" opacity=".5"/><path d="M-30 -2Q-20 -8 -8 -2" stroke="#62B058" stroke-width="2" fill="none"/>
        <path d="M14 0h36l-4 6h-28z" fill="#DCEFF8" fill-opacity=".8" ${INK}/><path d="M18 6l-4 30M46 6l4 30M24 6v26M40 6v26" stroke="#B8D8E8" stroke-width="2"/><path d="M18 -2h10M24 -2l2 -2l2 2l-2 2z" stroke="#E2B93B" stroke-width="1.6" fill="none"/>
        <g transform="translate(36 -8)"><rect x="-4" y="-12" width="8" height="14" rx="2.6" fill="#8AD8C8" ${INK}/><rect x="-1.6" y="-17" width="3.2" height="5" fill="#8AD8C8" ${INK}/><rect x="-4" y="-7" width="8" height="5" fill="#F4ECD8"/></g>
        <g transform="translate(30 30)"><rect x="-9" y="-6" width="18" height="10" rx="2" fill="#F7E0A8" ${INK}/><path d="M-9 -6q9 -5 18 0" fill="#FFF" ${INK}/><circle cy="-8" r="2" fill="${ROUGE}"/><text y="1.6" text-anchor="middle" font-family="Georgia" font-size="3.6" fill="${ROUGE}">MANGE-MOI</text></g></g>`);
      a.push(`<circle cx="${f(x + 24)}" cy="${f(y - 2)}" r="9" fill="#FFF2B8" opacity="${vu(.0)}">${an(`<animate attributeName="opacity" values="0;.7;0" dur="3s" repeatCount="indefinite"/>`)}</circle>`); }
    // ================= 11. dehors : le jardin des fleurs qui parlent (bas gauche)
    { const [x, y] = caser(118, 640, [-116, -70, 116, 60], 18, 60);
      s.push(`${G(x, y, 1)}${ombre(0, 44, 112, 14, .22)}`);
      const fleur = (u, v, sc, c, c2, bouche) => `<g transform="translate(${u} ${v}) scale(${sc})"><path d="M0 40Q-2 14 0 0" stroke="#3E7A3A" stroke-width="2.6" fill="none"/><path d="M0 26q-12 -2 -16 -12q10 0 16 8M0 20q12 -4 14 -14q-10 2 -14 10" fill="#5AA84A" ${INK}/>${[0, 1, 2, 3, 4, 5, 6, 7].map(q => `<ellipse cx="${f(Math.cos(q * PI / 4) * 9)}" cy="${f(Math.sin(q * PI / 4) * 9)}" rx="7" ry="4.4" fill="${c}" ${INK} transform="rotate(${q * 45} ${f(Math.cos(q * PI / 4) * 9)} ${f(Math.sin(q * PI / 4) * 9)})"/>`).join("")}<circle r="7.4" fill="${c2}" ${INK}/><circle cx="-2.6" cy="-1.6" r="1" fill="${ENC}"/><circle cx="2.6" cy="-1.6" r="1" fill="${ENC}"/>${bouche ? `<ellipse cx="0" cy="2.6" rx="2" ry="1.8" fill="#6A1A1A"/>` : `<path d="M-2.4 2q2.4 2 4.8 0" stroke="${ENC}" stroke-width=".8" fill="none"/>`}</g>`;
      s.push(fleur(-86, -10, 1.1, "#F2B33A", "#F7E08A") + fleur(-50, -26, 1.3, "#E5484D", "#F7C08A", true) + fleur(-14, -8, 1, "#F4F1EA", "#F2D04A") + fleur(26, -24, 1.25, "#FF8FB8", "#F7E0A8") + fleur(60, -6, 1.05, "#9D6AD8", "#F2D04A", true) + fleur(92, -20, .95, "#F4F1EA", "#F2B33A"));
      s.push(`<g transform="translate(-6 -58)"><path d="M0 60V0" stroke="#3E7A3A" stroke-width="3"/>${[0, 1, 2, 3, 4, 5].map(q => `<path d="M0 0Q${f(Math.cos(q * 1.05) * 10)} ${f(Math.sin(q * 1.05) * 10 - 4)} ${f(Math.cos(q * 1.05) * 18)} ${f(Math.sin(q * 1.05) * 18)}Q${f(Math.cos(q * 1.05 + .3) * 8)} ${f(Math.sin(q * 1.05 + .3) * 8)} 0 0" fill="#F27A2A" ${INK}/>`).join("")}${[[-6, -4], [5, 6], [8, -8], [-8, 8]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="1" fill="${ENC}"/>`).join("")}<circle r="5" fill="#F7C04A" ${INK}/><circle cx="-1.6" cy="-1" r=".8" fill="${ENC}"/><circle cx="1.6" cy="-1" r=".8" fill="${ENC}"/><path d="M-1.6 2h3.2" stroke="${ENC}" stroke-width=".8"/></g>`);
      s.push("</g>");
      bulle(x - 10, y - 92, "Et toi, tu es quelle fleur ?", 10, 6, 0); ruban(x, y + 50, "Le jardin qui parle"); }
    // ================= 12. dehors : le quadrille des homards au bord de la mer (bas droit) — 4 homards aux nœuds des pilotes
    { const [x, y] = caser(930, 628, [-140, -66, 120, 70], 14, 70, true);
      s.push(`${G(x - 30, y + 6, 1.4)}<ellipse cx="-70" cy="4" rx="44" ry="18" fill="#9A9488" ${INK}/><ellipse cx="-74" cy="-2" rx="34" ry="12" fill="#B8B2A4"/>
        <g transform="translate(-92 -6)"><ellipse rx="16" ry="11" fill="#6A8A5A" ${INK}/>${[[-7, -4], [0, -6], [7, -4], [-4, 3], [4, 3]].map(([u, v]) => `<path d="M${u - 3} ${v}l3 -3l3 3l-3 3z" fill="#4E6A44"/>`).join("")}<path d="M12 -6Q22 -18 26 -14Q28 -6 18 0" fill="#C8B8A0" ${INK}/><circle cx="23" cy="-13" r="1" fill="${ENC}"/><path d="M24 -10q2 4 0 8" stroke="#8AC8F0" stroke-width="1.2" fill="none"/><path d="M18 -18q2 -4 6 -4" stroke="#C8B8A0" stroke-width="2" fill="none"/><path d="M-14 8l-6 6M14 8l6 6" stroke="#6A8A5A" stroke-width="3"/></g>
        <g transform="translate(-50 -16)"><path d="M-10 6Q-14 -10 0 -14Q12 -12 10 4Z" fill="#C8A048" ${INK}/><path d="M-6 -10Q-26 -26 -20 -36Q-8 -28 -2 -14ZM4 -12Q14 -32 26 -30Q20 -18 8 -8" fill="#9A7A3A" ${INK}/><circle cx="6" cy="-18" r="6" fill="#D8B058" ${INK}/><path d="M11 -19l7 2l-6 3z" fill="#E8C848" ${INK}/><circle cx="7" cy="-20" r="1" fill="${ENC}"/><path d="M10 4q8 6 4 12" stroke="#C8A048" stroke-width="2" fill="none"/></g></g>`);
      a.push(`${G(x + 46, y + 10, 1)}<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite"/>`)}${COULEURS_J.map((c, k) => { const t = k / 4 * TAU; return `<g transform="translate(${f(Math.cos(t) * 26)} ${f(Math.sin(t) * 18)}) rotate(${f(t * 57.3 + 90)})"><ellipse rx="5" ry="9" fill="#E0482A" ${INK}/><path d="M-4 -8Q-12 -16 -8 -22M4 -8Q12 -16 8 -22" stroke="#E0482A" stroke-width="2" fill="none"/><ellipse cx="-8" cy="-23" rx="3" ry="4" fill="#E0482A" ${INK}/><ellipse cx="8" cy="-23" rx="3" ry="4" fill="#E0482A" ${INK}/><path d="M0 9l-4 6h8z" fill="#C8382A" ${INK}/><path d="M0 -6l-4 -2v4zM0 -6l4 -2v4z" fill="${c}" ${INK}/><circle cx="-2" cy="-9" r=".8" fill="${ENC}"/><circle cx="2" cy="-9" r=".8" fill="${ENC}"/></g>`; }).join("")}</g></g>`); ruban(x - 30, y + 62, "Le quadrille des homards"); }
    // ================= 13. le Lapin blanc qui court vers le terrier, montre en main ; la grande montre de gousset dehors, au-dessus du départ
    { const [x, y] = caser(662, 196, [-22, -80, 24, 6], 16, 50);
      a.push(`${G(x, y, 1.3)}${ombre(0, 0, 13, 3)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".5s" repeatCount="indefinite"/>`)}${lapin()}</g></g>`); bulle(x + 4, y - 96, "En retard ! En retard !", 7, 0, -10);
      // la montre : ses aiguilles tournent… à l'envers
      const [mx, my] = [K.P[0][0] + 110, 32]; if (K.libre(mx, my, 24, 0)) { s.push(`<circle cx="${f(mx + 2)}" cy="${f(my + 3)}" r="22" fill="#1E3A1A" opacity=".25"/><circle cx="${f(mx)}" cy="${f(my)}" r="21" fill="url(#w3-or)" ${INK}/><circle cx="${f(mx)}" cy="${f(my)}" r="16.6" fill="#FFF8E6" ${INK}/><rect x="${f(mx - 3)}" y="${f(my - 27)}" width="6" height="6" rx="2" fill="url(#w3-or)" ${INK}/>${Array.from({ length: 12 }, (_, q) => `<path d="M${f(mx + Math.cos(q * PI / 6) * 13.6)} ${f(my + Math.sin(q * PI / 6) * 13.6)}L${f(mx + Math.cos(q * PI / 6) * 15.6)} ${f(my + Math.sin(q * PI / 6) * 15.6)}" stroke="${ENC}" stroke-width="1"/>`).join("")}`);
        a.push(`<path d="M${f(mx)} ${f(my)}V${f(my - 12)}" stroke="${ENC}" stroke-width="1.4" stroke-linecap="round">${an(`<animateTransform attributeName="transform" type="rotate" from="360 ${f(mx)} ${f(my)}" to="0 ${f(mx)} ${f(my)}" dur="6s" repeatCount="indefinite"/>`)}</path><path d="M${f(mx)} ${f(my)}H${f(mx + 8)}" stroke="${ROUGE}" stroke-width="2" stroke-linecap="round"/><circle cx="${f(mx)}" cy="${f(my)}" r="1.4" fill="${ENC}"/>`); } }
    // ================= 14. le décor qui remplit : haies taillées en ♥ ♠ ♦ ♣, rosiers rouges et blancs, arbres aux couleurs sucrées
    K.semis(22, 15, 3000, null, (x, y) => { const k = ["c", "p", "k", "t"][Math.floor(r() * 4)]; s.push(ombre(x + 4, y + 13, 13, 4) + sym(k, x, y, 15, "#2E7A3A", ` stroke="${ENC}" stroke-width=".09"`) + sym(k, x - 2, y - 3, 9, "#4E9A4A")); });
    K.semis(30, () => 8 + r() * 4, 3000, null, (x, y, R) => { s.push(ombre(x + 3, y + 4, R, R * .7) + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#2E6A34" ${INK}/>`); const rouge = r() < .5; for (let q = 0; q < 5; q++) { const t = r() * TAU, d = r() * R * .6; s.push(`<circle cx="${f(x + Math.cos(t) * d)}" cy="${f(y + Math.sin(t) * d)}" r="2.6" fill="${rouge ? "#E5484D" : "#FAF6EE"}" stroke="${rouge ? "#8A1A1A" : "#B8A890"}" stroke-width=".5"/>`); } });
    const FEUIL = [["#7CC25A", "#4E9A3E", "#F7A8C8"], ["#9AD06A", "#5E9A44", "#FFFFFF"], ["#E89AC0", "#B8608A", "#FFFFFF"], ["#6AB8A0", "#3E7A6A", "#F7E04A"], ["#B8A0E0", "#7A60B0", "#FFFFFF"]];
    K.semis(70, () => 10 + r() * 9, 6000, null, (x, y, R) => { const [c1, c2, c3] = FEUIL[Math.floor(r() * FEUIL.length)], h = R * .9;
      s.push(ombre(x + R * .2, y + R * .55, R * .9, R * .32) + `<path d="M${f(x - R * .12)} ${f(y + R * .55)}Q${f(x - R * .05)} ${f(y)} ${f(x)} ${f(y - h * .4)}M${f(x + R * .12)} ${f(y + R * .55)}Q${f(x + R * .05)} ${f(y)} ${f(x)} ${f(y - h * .4)}" stroke="#6A4A2A" stroke-width="${f(R * .22)}" fill="none" stroke-linecap="round"/>`);
      const bl = [[0, -h * .75, R * .62], [-R * .42, -h * .5, R * .45], [R * .42, -h * .48, R * .47], [0, -h * .35, R * .5]]; s.push(bl.map(([u, v, q]) => `<circle cx="${f(x + u)}" cy="${f(y + v)}" r="${f(q)}" fill="${c2}" ${INK}/>`).join("") + bl.map(([u, v, q]) => `<circle cx="${f(x + u - q * .2)}" cy="${f(y + v - q * .25)}" r="${f(q * .62)}" fill="${c1}"/>`).join(""));
      for (let q = 0; q < 4; q++) s.push(`<circle cx="${f(x + (r() - .5) * R)}" cy="${f(y - h * .55 + (r() - .5) * R * .7)}" r="${f(R * .08 + .6)}" fill="${c3}" opacity=".9"/>`); });
    // champignons et petites fleurs semées
    K.semis(26, 6, 3000, null, (x, y) => s.push(`<path d="M${f(x - 1.6)} ${f(y + 4)}v-4h3.2v4z" fill="#F4ECD8" ${INK}/><path d="M${f(x - 6)} ${f(y)}q6 -9 12 0z" fill="${r() < .5 ? "#E5484D" : "#F2A03A"}" ${INK}/><circle cx="${f(x - 2)}" cy="${f(y - 3)}" r="1" fill="#FFF"/>`));
    if (L) ruban(L.cx + L.rx * .42, L.cy - L.ry * .52, "La mare de larmes");
    s.push(...RUB);
    // ================= 15. la piste : damier noir et blanc, bordée de rouge, symboles des cartes au bord
    K.route([["#1E3A1A", 40, ` opacity=".35" filter="url(#w3-flou)"`], [ROUGE, 32], ["#F6F1E4", 28.5], ["url(#w3-dam)", 25]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="${ENC}" stroke-width="32.8" stroke-opacity=".0"/>`);
    for (let i = 0; i < K.N; i += 18) { const [nx, ny] = K.nrm(i), sd = (i / 18) % 2 ? 1 : -1, k = ["c", "p", "k", "t"][(i / 18) % 4]; s.push(sym(k, K.P[i][0] + nx * sd * 22, K.P[i][1] + ny * sd * 22, 4.2, k === "c" || k === "k" ? ROUGE : NOIR, ` stroke="#FFF" stroke-width=".25"`)); }
    K.depart();
    // sur la piste : le Lapin blanc pressé, et les 4 pilotes en tasses de thé à roulettes
    a.push(K.surPiste(.04, `<g transform="rotate(90) scale(.8)">${lapin().replace(/<ellipse cx="-3" cy="-54"[^>]*>|<ellipse cx="3" cy="-53"[^>]*>/g, "")}</g>`, 30, 0, false));
    for (let k = 0; k < 3; k++) a.push(K.surPiste(.025 - k * .012, `<g transform="rotate(90) scale(.6)">${soldat(k, 1, true)}</g>`, 30, -(k + 1) * .36));
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.93 - k * .025, `<g transform="rotate(90)"><ellipse cx="0" cy="3" rx="8" ry="3" fill="#000" opacity=".25"/><path d="M-7 -5h14l-2.4 9h-9.2z" fill="${c}" ${INK}/><ellipse cx="0" cy="-5" rx="7" ry="2.2" fill="#6A3A1A" ${INK}/><path d="M7 -3q5 1 0 5" stroke="${ENC}" stroke-width="1.4" fill="none"/></g>`, 30, 3 + k * .9)));
    // ================= 16. le ciel : un jeu de cartes s'envole (« Vous n'êtes qu'un jeu de cartes ! »), quelques étincelles
    const FIXE = [[300, 600], [960, 470], [40, 420], [700, 20]];
    for (let k = 0; k < 4; k++) { const x0 = 120 + k * 230 + r() * 60, du = (9 + k * 1.7).toFixed(1); a.push(`<g${K.anime ? "" : ` transform="translate(${f(FIXE[k][0] - x0)} ${FIXE[k][1]})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 -30;${f(80 + r() * 60)} ${H + 40}" dur="${du}s" begin="-${(k * 2.3).toFixed(1)}s" repeatCount="indefinite"/>`)}<g transform="translate(${f(x0)} 0)"><g>${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="${k % 2 ? 360 : -360}" dur="${(3 + k).toFixed(1)}s" repeatCount="indefinite"/>`)}<rect x="-7" y="-10" width="14" height="20" rx="1.6" fill="#FFFDF6" ${INK} opacity=".9"/>${sym(["c", "p", "k", "t"][k], 0, 0, 4.6, k % 2 ? NOIR : ROUGE)}</g></g></g>`); }
    K.particules(8, "#FFE8F4", 2.2, "scintille");
    // la gravure : hachures légères sur tout le tableau
    s.push(`<rect width="${W}" height="${H}" fill="url(#w3-hach)" opacity=".035"/>`);
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#w3-pre)"/>`, "#F8E0C8", .1); RES.portraits = PORTR; return RES;
  }

  /* ---------- Juin · La Bataille des étoiles (v16.x, refonte au niveau de l'Arène) ----------
     Grandes scènes illustrées autour de la piste-hyperespace : la station de combat qui tire, deux destroyers, le duel au sabre
     au-dessus du puits du réacteur, l'empereur et ses éclairs devant la verrière, le petit maître vert qui soulève un chasseur du marais,
     les deux droïdes à la table d'holo-échecs (le monument 3D « holodome »), le cargo rond à quai, le chasseur de primes,
     la planète aux deux soleils, et l'Escadron Versus (les 4 pilotes, leurs vrais portraits posés par l'appli). Tout est dessiné ici. */
  function peindreEtoiles3(T, Z, def) {
    const K = kit(T, def, 66, "s3-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", VIS = K.anime ? 0 : 1, INK = `stroke="#05070F" stroke-width="1.2"`;
    // halo de la couche animée : son dégradé doit vivre dans la couche animée (le fond est cuit en image)
    const hA = [], haloA = (x, y, R, c, op) => { const id = "s3-a" + c.replace("#", ""); if (!hA.includes(id)) { hA.push(id); a.unshift(`<radialGradient id="${id}" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset=".35" stop-color="${c}" stop-opacity=".4"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`); } a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#${id})" opacity="${op}"/>`); };
    a.unshift(`<radialGradient id="s3-aor" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".45" stop-color="#E8B83A"/><stop offset="1" stop-color="#8A5A12"/></radialGradient>`);
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const bulle = (x, y, txt, du, deb, coul) => a.push(`<g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.75 - 7)}" y="${f(y - 11)}" width="${f(txt.length * 5.5 + 14)}" height="18" rx="9" fill="#0B1020" fill-opacity=".92" stroke="${coul || "#7CC8FF"}" stroke-width="1.2"/><path d="M${f(x - 4)} ${f(y + 7)}l3 7l5 -7" fill="#0B1020" stroke="${coul || "#7CC8FF"}" stroke-width="1"/><text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" font-family="system-ui, sans-serif" font-style="italic" font-size="10" fill="#E8F4FF">${txt}</text></g>`);
    const sabre = (x1, y1, x2, y2, c, l) => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${l * 3.2}" stroke-linecap="round" opacity=".35"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${l * 1.7}" stroke-linecap="round" opacity=".8"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="#FFFFFF" stroke-width="${l * .8}" stroke-linecap="round"/>`;
    const eclair = (x1, y1, x2, y2, n, amp) => { let d = `M${f(x1)} ${f(y1)}`; for (let k = 1; k < n; k++) { const t = k / n; d += `L${f(x1 + (x2 - x1) * t + (r() - .5) * amp)} ${f(y1 + (y2 - y1) * t + (r() - .5) * amp)}`; } return d + `L${f(x2)} ${f(y2)}`; };
    // ---- les vaisseaux (dessinés autour de (0,0), nez vers +x)
    const xwing = (c, coc) => `<path d="M-12 -24L2 -24L6 -5L-6 -5ZM-12 24L2 24L6 5L-6 5Z" fill="#D8DCE0" ${INK}/><path d="M-8 -22h9M-8 22h9" stroke="${c}" stroke-width="2.6"/><path d="M0 -25h22M0 25h22M-4 -21h18M-4 21h18" stroke="#9AA3AE" stroke-width="1.6"/><path d="M-16 -4.5L22 -2L30 0L22 2L-16 4.5Z" fill="#ECEFF2" ${INK}/><path d="M6 -2.4h14v4.8h-14z" fill="${c}"/><rect x="-18" y="-7" width="8" height="14" rx="2" fill="#B8BEC6" ${INK}/>${coc ? "" : `<ellipse cx="2" cy="0" rx="5" ry="3" fill="#1A2A40" stroke="#7CC8FF" stroke-width=".6"/>`}<path d="M-18 -5h-3M-18 5h-3M-12 -24h-3M-12 24h-3" stroke="#FFB86A" stroke-width="2.4" stroke-linecap="round"/>`;
    const tie = () => `<path d="M-3 -18v36M3 -18v36" stroke="#2A2E36" stroke-width="2.2"/><path d="M-5 -18h10M-5 18h10" stroke="#5A606A" stroke-width="3"/><path d="M-6 0h12" stroke="#5A606A" stroke-width="3"/><circle r="6" fill="#8A929C" ${INK}/><circle r="3.2" fill="#1A1E26" stroke="#5A606A" stroke-width=".8"/>`;
    const tieFace = () => `<polygon points="-24,-20 -18,-26 -18,26 -24,20" fill="#3A3F48" ${INK}/><path d="M-21 -22v44M-23 0h-0" stroke="#5A606A"/><polygon points="24,-20 18,-26 18,26 24,20" fill="#3A3F48" ${INK}/><path d="M-18 0h36" stroke="#5A606A" stroke-width="4"/><circle r="8.5" fill="#8A929C" ${INK}/><circle r="5" fill="#141820"/><path d="M0 -5v10M-5 0h10M-3.5 -3.5l7 7M3.5 -3.5l-7 7" stroke="#5A606A" stroke-width=".8"/>`;
    const xwingFace = c => `<path d="M0 0L-30 -18M0 0L30 -18M0 0L-30 18M0 0L30 18" stroke="#C9CDD2" stroke-width="5" stroke-linecap="round"/><path d="M-12 -7L-26 -15.6M12 -7L26 -15.6M-12 7L-26 15.6M12 7L26 15.6" stroke="${c}" stroke-width="2.6"/><path d="M-30 -18l-4 -2.4M30 -18l4 -2.4M-30 18l-4 2.4M30 18l4 2.4" stroke="#7E8792" stroke-width="2.4"/><circle cx="-8" cy="-4.6" r="3" fill="#FFB86A"/><circle cx="8" cy="-4.6" r="3" fill="#FFB86A"/><circle cx="-8" cy="4.6" r="3" fill="#FFB86A"/><circle cx="8" cy="4.6" r="3" fill="#FFB86A"/><circle r="7" fill="#E8ECEF" ${INK}/><circle r="3" fill="#1A2A40"/>`;
    const destroyer = L => { const t = L * .55, b = -L * .45, w = L * .33; let d = `<polygon points="${f(t)},0 ${f(b)},${f(-w)} ${f(b)},${f(w)}" fill="#AEB6C0" ${INK}/><polygon points="${f(t)},0 ${f(b)},${f(-w)} ${f(b)},0" fill="#C8CFD7"/><polygon points="${f(t * .92)},0 ${f(b)},${f(-w * .34)} ${f(b)},${f(w * .34)}" fill="#BCC4CD" stroke="#6E7680" stroke-width="1"/>`;
      for (let k = 1; k < 7; k++) { const u = b + (t - b) * k / 7, hw = w * (1 - k / 7); d += `<path d="M${f(u)} ${f(-hw)}L${f(u)} ${f(hw)}" stroke="#7E8792" stroke-width=".8" opacity=".7"/>`; }
      for (let k = 0; k < 46; k++) { const u = b + r() * (t - b) * .85, hw = w * (1 - (u - b) / (t - b)) * .9, v = (r() * 2 - 1) * hw; d += `<rect x="${f(u)}" y="${f(v)}" width="${f(3 + r() * L * .03)}" height="${f(2 + r() * L * .015)}" fill="${r() < .5 ? "#7E8792" : "#DDE2E8"}" opacity=".8"/>`; }
      d += `<rect x="${f(b + L * .02)}" y="${f(-w * .2)}" width="${f(L * .26)}" height="${f(w * .4)}" fill="#9AA3AE" ${INK}/><rect x="${f(b + L * .06)}" y="${f(-w * .13)}" width="${f(L * .16)}" height="${f(w * .26)}" fill="#C0C7CF" ${INK}/><rect x="${f(b + L * .07)}" y="${f(-w * .42)}" width="${f(L * .05)}" height="${f(w * .84)}" rx="2" fill="#8A929C" ${INK}/><circle cx="${f(b + L * .095)}" cy="${f(-w * .36)}" r="${f(L * .022)}" fill="#D8DEE6" ${INK}/><circle cx="${f(b + L * .095)}" cy="${f(w * .36)}" r="${f(L * .022)}" fill="#D8DEE6" ${INK}/>`;
      [-.2, 0, .2].forEach(v => d += `<circle cx="${f(b - 2)}" cy="${f(w * v)}" r="${f(L * (v ? .028 : .04))}" fill="#9FE0FF" stroke="#2A6AA8" stroke-width="1.5"/>`); return d; };
    // ---- ciel : dégradé, voie lactée, nébuleuses, étoiles
    s.push(`<radialGradient id="s3-ciel" cx="55%" cy="45%" r="80%"><stop offset="0" stop-color="#141A3A"/><stop offset=".55" stop-color="#0A0E22"/><stop offset="1" stop-color="#03040C"/></radialGradient>`);
    [["n1", "#7A3AFF", .5], ["n2", "#22C8FF", .38], ["n3", "#FF4F8A", .32], ["n4", "#3A6AFF", .35]].forEach(([id, c, o]) => s.push(`<radialGradient id="s3-${id}" r="50%"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".5" stop-color="${c}" stop-opacity="${o * .35}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`));
    s.push(`<radialGradient id="s3-sph" cx="34%" cy="30%" r="78%"><stop offset="0" stop-color="#E2E7EE"/><stop offset=".45" stop-color="#A4ADB8"/><stop offset=".8" stop-color="#525A66"/><stop offset="1" stop-color="#1C2128"/></radialGradient>`);
    s.push(`<radialGradient id="s3-des" cx="62%" cy="22%" r="80%"><stop offset="0" stop-color="#FBE3AE"/><stop offset=".35" stop-color="#E2AE68"/><stop offset=".7" stop-color="#9A6232"/><stop offset="1" stop-color="#2A1608"/></radialGradient>`);
    s.push(`<radialGradient id="s3-mar" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#4A6A3A"/><stop offset=".7" stop-color="#2A4426"/><stop offset="1" stop-color="#14261A"/></radialGradient>`);
    s.push(`<radialGradient id="s3-puits" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9FE0FF" stop-opacity=".9"/><stop offset=".25" stop-color="#2A7AC8" stop-opacity=".7"/><stop offset=".7" stop-color="#0A1A3A"/><stop offset="1" stop-color="#05070F"/></radialGradient>`);
    s.push(`<radialGradient id="s3-holo" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#7CE8FF" stop-opacity=".55"/><stop offset="1" stop-color="#7CE8FF" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="s3-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".45" stop-color="#E8B83A"/><stop offset="1" stop-color="#8A5A12"/></linearGradient>`);
    s.push(`<linearGradient id="s3-vitre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A1440"/><stop offset="1" stop-color="#3A1A3A"/></linearGradient>`);
    s.push(`<path d="M-40 760Q420 420 1120 -20" stroke="#B8C8FF" stroke-width="170" opacity=".07" filter="url(#s3-flou8)" fill="none"/><path d="M-40 760Q420 420 1120 -20" stroke="#E0E8FF" stroke-width="60" opacity=".06" filter="url(#s3-flou8)" fill="none"/>`);
    [[.24, .3, "n1", 360], [.78, .62, "n2", 320], [.58, .12, "n3", 280], [.06, .7, "n4", 240], [.95, .95, "n1", 220], [.42, .78, "n3", 200]].forEach(([u, v, id, R]) => s.push(`<circle cx="${f(W * u)}" cy="${f(H * v)}" r="${R}" fill="url(#s3-${id})"/>`));
    for (let k = 0; k < 520; k++) { const x = r() * W, y = r() * H, br = r(); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.3 + br * br * 1.4)}" fill="${br > .9 ? "#FFE8C8" : br > .8 ? "#C8E0FF" : "#FFFFFF"}" opacity="${(.3 + r() * .7).toFixed(2)}"/>`); }
    for (let k = 0; k < 16; k++) { const x = r() * W, y = r() * H, l = 3 + r() * 5; s.push(`<path d="M${f(x - l)} ${f(y)}h${f(2 * l)}M${f(x)} ${f(y - l)}v${f(2 * l)}" stroke="#FFFFFF" stroke-width=".7" opacity=".7"/><circle cx="${f(x)}" cy="${f(y)}" r="1.3" fill="#FFFFFF"/>`); }
    // ---- la planète du désert aux deux soleils (coin bas gauche, sous la piste)
    { const px = 60, py = 830, R = 290; K.halo(78, 500, 120, "#FFE6A8", .55); K.halo(132, 540, 80, "#FF9A4A", .5);
      s.push(`<circle cx="78" cy="500" r="17" fill="#FFF6D8"/><circle cx="78" cy="500" r="13" fill="#FFFFFF"/><circle cx="132" cy="540" r="11" fill="#FFC27A"/><circle cx="132" cy="540" r="8" fill="#FFE2B0"/>`);
      s.push(`<clipPath id="s3-cdes"><circle cx="${px}" cy="${py}" r="${R}"/></clipPath><circle cx="${px}" cy="${py}" r="${R + 8}" fill="#FFD9A0" opacity=".25" filter="url(#s3-flou8)"/><circle cx="${px}" cy="${py}" r="${R}" fill="url(#s3-des)"/><g clip-path="url(#s3-cdes)">`);
      for (let k = 0; k < 14; k++) { const y0 = py - R + 30 + k * 26; s.push(`<path d="M${px - R} ${f(y0)}q${f(R * .5)} ${f(-16 - r() * 14)} ${f(R)} 0t${f(R)} 0" stroke="${k % 2 ? "#C9884A" : "#F2C987"}" stroke-width="${f(3 + r() * 5)}" fill="none" opacity=".45"/>`); }
      s.push(`<path d="M150 590q30 30 20 70t40 60" stroke="#6A3A1A" stroke-width="5" fill="none" opacity=".5"/><g opacity=".9"><ellipse cx="100" cy="618" rx="12" ry="5" fill="#000" opacity=".25"/><path d="M90 616a10 9 0 0 1 20 0z" fill="#F4EAD8" stroke="#9A6232" stroke-width="1.2"/><path d="M112 616h14v-12h3v12" stroke="#C8B8A0" stroke-width="2" fill="none"/><circle cx="127.5" cy="602" r="2.4" fill="#C8B8A0"/></g><circle cx="${px}" cy="${py}" r="${R}" fill="none" stroke="#FFE6B8" stroke-width="3" opacity=".7"/></g>`); }
    // ---- les deux destroyers (en partie hors cadre, la piste passe dessus)
    s.push(`${G(128, 84, 1, 30)}${destroyer(330)}</g>`); s.push(`${G(1030, 698, 1, 196)}${destroyer(300)}</g>`);
    [[214, 236, .7], [236, 262, .6], [200, 268, .55], [150, 252, .5], [118, 226, .45]].forEach(([x, y, sc]) => { s.push(`${G(x, y, sc, 30)}${tie()}</g>`); });
    { const x = 372, y = 692; s.push(`${G(x, y, 1)}<path d="M-78 0C-78 -12 -40 -16 0 -15C40 -14 72 -8 80 0C72 8 40 14 0 15C-40 16 -78 12 -78 0Z" fill="#B8A898" ${INK}/><path d="M-60 -6C-20 -12 30 -10 66 -3M-60 6C-20 12 30 10 66 3" stroke="#8A7A6A" stroke-width="1.2" fill="none"/>${[-50, -30, -10, 10, 30, 50].map(u => `<ellipse cx="${u}" cy="${u % 20 ? -6 : 6}" rx="6" ry="3" fill="#D8C8B8" stroke="#8A7A6A" stroke-width=".6"/>`).join("")}<path d="M-79 -5h-5M-79 5h-5M-80 0h-6" stroke="#9FE0FF" stroke-width="3" stroke-linecap="round"/></g>`); }
    // ---- la station de combat (intérieur, en haut à droite) et la petite planète visée (coin haut droit)
    const SX = 790, SY = 206, SR = 96, DX = SX + SR * .4, DY = SY - SR * .36, PX = 1018, PY = 34;
    { s.push(`<clipPath id="s3-csta"><circle cx="${SX}" cy="${SY}" r="${SR}"/></clipPath><circle cx="${SX}" cy="${SY}" r="${SR + 10}" fill="#7CC8FF" opacity=".12" filter="url(#s3-flou8)"/><circle cx="${SX}" cy="${SY}" r="${SR}" fill="url(#s3-sph)"/><g clip-path="url(#s3-csta)">`);
      for (let k = -4; k <= 4; k++) if (k) s.push(`<ellipse cx="${SX}" cy="${f(SY + k * SR * .2)}" rx="${f(SR * Math.sqrt(1 - (k * .2) ** 2))}" ry="${f(SR * .09)}" fill="none" stroke="#3A414C" stroke-width=".7" opacity=".55"/>`);
      for (let k = 0; k < 90; k++) { const u = (r() * 2 - 1) * SR, v = (r() * 2 - 1) * SR; if (u * u + v * v > SR * SR * .92) continue; s.push(`<rect x="${f(SX + u)}" y="${f(SY + v)}" width="${f(2 + r() * 9)}" height="${f(1.5 + r() * 3)}" fill="${r() < .6 ? "#4A525E" : "#E8EDF2"}" opacity="${(.35 + r() * .4).toFixed(2)}"/>`); }
      s.push(`<path d="M${SX - SR} ${SY + 2}Q${SX} ${f(SY + SR * .2)} ${SX + SR} ${SY + 2}" stroke="#1C2128" stroke-width="5" fill="none"/><path d="M${SX - SR} ${SY + 6}Q${SX} ${f(SY + SR * .24)} ${SX + SR} ${SY + 6}" stroke="#D8DEE6" stroke-width="1" fill="none" opacity=".7"/>`);
      s.push(`<circle cx="${f(SX - SR * .5)}" cy="${f(SY + SR * .55)}" r="${f(SR * 1.05)}" fill="#05070F" opacity=".0"/><path d="M${f(SX - SR)} ${f(SY - SR * .2)}A${SR} ${SR} 0 0 0 ${f(SX + SR * .3)} ${f(SY + SR)}A${f(SR * 1.3)} ${f(SR * 1.3)} 0 0 1 ${f(SX - SR)} ${f(SY - SR * .2)}Z" fill="#05070F" opacity=".45"/>`);
      for (let k = 0; k < 24; k++) { const t = PI * (.55 + r() * .7), d2 = SR * (.6 + r() * .35); s.push(`<circle cx="${f(SX + Math.cos(t) * d2)}" cy="${f(SY + Math.sin(t) * d2)}" r=".9" fill="#FFE27A" opacity=".85"/>`); }
      s.push(`<circle cx="${f(DX)}" cy="${f(DY)}" r="${f(SR * .27)}" fill="#7E8792" ${INK}/><circle cx="${f(DX)}" cy="${f(DY)}" r="${f(SR * .2)}" fill="none" stroke="#4A525E" stroke-width="1.5"/><circle cx="${f(DX)}" cy="${f(DY)}" r="${f(SR * .12)}" fill="none" stroke="#4A525E" stroke-width="1.2"/><circle cx="${f(DX + 2)}" cy="${f(DY + 2)}" r="${f(SR * .27)}" fill="none" stroke="#C8CFD7" stroke-width="1" opacity=".6"/><circle cx="${f(DX)}" cy="${f(DY)}" r="3.5" fill="#2A3038"/></g>`);
      s.push(`<circle cx="${SX}" cy="${SY}" r="${SR}" fill="none" stroke="#C8D4E0" stroke-width="1.2" opacity=".5"/>`); K.prendre(SX, SY, SR + 10);
      // un petit chasseur file dans la tranchée (clin d'œil), poursuivi par un chasseur noir
      const tr = `M${SX - SR + 6},${f(SY + 6)} Q${SX},${f(SY + SR * .2 + 6)} ${SX + SR - 6},${f(SY + 6)}`;
      a.push(`<g${K.anime ? "" : ` transform="translate(${SX} ${f(SY + SR * .1 + 4)})"`}>${an(`<animateMotion dur="4s" repeatCount="indefinite" rotate="auto" path="${tr}"/>`)}${G(0, 0, .42)}${xwing("#FFE27A", true)}</g><path d="M12 0h10" stroke="#FF3B3B" stroke-width="1.6" opacity=".9"/></g>`);
      // la petite planète bleue (coin haut droit)
      s.push(`<radialGradient id="s3-bleue" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#BFE8FF"/><stop offset=".5" stop-color="#3A8AC8"/><stop offset="1" stop-color="#0E2A4A"/></radialGradient>`);
      s.push(`<circle cx="${PX}" cy="${PY}" r="24" fill="url(#s3-bleue)"/><path d="M${PX - 16} ${PY - 6}q8 -6 14 0t12 2M${PX - 10} ${PY + 10}q6 -4 14 2" stroke="#6ABF7A" stroke-width="3" fill="none" opacity=".7"/>`);
      // le tir : 8 rayons convergent puis le grand rayon vert ; la planète s'illumine
      const bx = DX + (PX - DX) * .12, by = DY + (PY - DY) * .12; let rays = ""; for (let k = 0; k < 8; k++) { const t = k / 8 * TAU; rays += `<path d="M${f(DX + Math.cos(t) * SR * .22)} ${f(DY + Math.sin(t) * SR * .22)}L${f(bx)} ${f(by)}" stroke="#9CFF8A" stroke-width="1.3"/>`; }
      a.push(`<circle cx="${f(DX)}" cy="${f(DY)}" r="${f(SR * .22)}" fill="#7CFF8A" opacity="${K.anime ? .1 : .5}">${an(`<animate attributeName="opacity" values=".1;.1;.8;.9;.1;.1" keyTimes="0;.3;.55;.62;.7;1" dur="10s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.5;.56;.68;.72;1" dur="10s" repeatCount="indefinite"/>`)}${rays}<path d="M${f(bx)} ${f(by)}L${PX} ${PY}" stroke="#4AFF6A" stroke-width="9" opacity=".35" stroke-linecap="round"/><path d="M${f(bx)} ${f(by)}L${PX} ${PY}" stroke="#CFFFC8" stroke-width="3" stroke-linecap="round"/><circle cx="${PX}" cy="${PY}" r="30" fill="#E8FFD8" opacity=".55"/></g>`);
      haloA(-999, -999, 1, "#FFFFFF", 0); a.push(`<circle cx="${PX}" cy="${PY}" r="48" fill="url(#s3-aFFFFFF)" opacity="${K.anime ? 0 : .5}">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.66;.7;.82;1" dur="10s" repeatCount="indefinite"/>`)}</circle>`); }
    // ---- 1. le duel au-dessus du puits du réacteur (intérieur, en haut à gauche)
    { const x = 420, y = 286, sc = 1.75; K.prendre(x, y - 50, 110);
      s.push(`<ellipse cx="${x}" cy="${y - 12}" rx="170" ry="70" fill="url(#s3-puits)" opacity=".95"/>`); for (let k = 1; k < 6; k++) s.push(`<ellipse cx="${x}" cy="${f(y - 12 + k * 3)}" rx="${f(170 - k * 26)}" ry="${f(70 - k * 11)}" fill="none" stroke="#7CC8FF" stroke-width="${f(2 - k * .25)}" opacity="${(.7 - k * .1).toFixed(2)}"/>`);
      for (let k = 0; k < 12; k++) { const t = k / 12 * TAU; s.push(`<path d="M${f(x + Math.cos(t) * 168)} ${f(y - 12 + Math.sin(t) * 68)}L${f(x + Math.cos(t) * 140)} ${f(y - 12 + Math.sin(t) * 56)}" stroke="#3A4250" stroke-width="3"/>`); }
      s.push(`${G(x, y, sc)}<path d="M-92 0h184l-10 9h-164z" fill="#3A4250" ${INK}/><path d="M-92 0h184" stroke="#9FE0FF" stroke-width="1.2"/>${[-70, -40, -10, 20, 50, 80].map(u => `<rect x="${u - 2}" y="3" width="4" height="3" fill="#FF4B4B"/>`).join("")}
        <g transform="translate(-34 0)"><path d="M-30 0Q-26 -30 -16 -44L16 -44Q24 -26 30 0Z" fill="#0A0A0E" ${INK}/><path d="M-9 0v-30h18v30" fill="#16161C"/><path d="M-12 -42h24l2 16h-28z" fill="#16161C" ${INK}/><rect x="-7" y="-36" width="14" height="9" rx="1" fill="#2A2A32" stroke="#555" stroke-width=".5"/><circle cx="-4" cy="-33" r="1" fill="#FF4B4B"/><circle cx="-1" cy="-33" r="1" fill="#4BFF6A"/><circle cx="2" cy="-33" r="1" fill="#4BB0FF"/><rect x="-12" y="-27" width="24" height="3" fill="#3A3A44"/><rect x="-3" y="-27.5" width="6" height="4" fill="#9AA3AE"/>
          <path d="M-12 -46Q-13 -68 0 -68Q13 -68 12 -46L17 -38H-17Z" fill="#0A0A0E" ${INK}/><path d="M-10 -55h8l-2 -4.5zM10 -55h-8l2 -4.5z" fill="#4A4A54"/><path d="M-4 -49l4 8l4 -8z" fill="#2A2A32" stroke="#666" stroke-width=".6"/><path d="M-10 -63q10 -6 20 0" stroke="#6A6A74" stroke-width="1" fill="none"/><path d="M-6 -42l3 -4M6 -42l-3 -4" stroke="#555" stroke-width=".8"/></g>
        <g transform="translate(36 0)"><path d="M-7 0l-1 -18h16l-1 18z" fill="#2A1E16"/><path d="M-11 -16L-9 -38Q0 -42 9 -38L11 -16Z" fill="#1E1E24" ${INK}/><path d="M-9 -38l9 10l9 -10" stroke="#3A3A44" stroke-width="1.5" fill="none"/><path d="M-11 -24h22" stroke="#4A3A2A" stroke-width="2.6"/><circle cy="-48" r="8.5" fill="#E8C8A8" ${INK}/><path d="M-9 -51q9 -11 18 0l1 4q-3 -5 -7 -6q-6 2 -12 1z" fill="#B88A4A"/></g></g>`);
      // sabres animés : rouge (seigneur noir) et bleu (le jeune chevalier), étincelles au choc
      a.push(`${G(x, y, sc)}<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-6 -28 -30;16 -28 -30;-6 -28 -30" dur="1.6s" repeatCount="indefinite"/>`)}${sabre(-28, -30, 8, -66, "#FF2A2A", 1.6)}<rect x="-31" y="-33" width="7" height="4" rx="1" fill="#9AA3AE" transform="rotate(-45 -28 -30)"/></g><g>${an(`<animateTransform attributeName="transform" type="rotate" values="10 30 -30;-14 30 -30;10 30 -30" dur="1.6s" repeatCount="indefinite"/>`)}${sabre(30, -30, -6, -66, "#2A9BFF", 1.6)}<rect x="27" y="-33" width="7" height="4" rx="1" fill="#C8CDD4" transform="rotate(45 30 -30)"/></g><g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;1;0;0;1;0" keyTimes="0;.06;.2;.5;.56;1" dur="1.6s" repeatCount="indefinite"/>`)}<circle cx="1" cy="-60" r="7" fill="#FFF6C8" opacity=".7"/><path d="M1 -60l-8 -6M1 -60l9 -5M1 -60l-3 10M1 -60l7 7M1 -60l-9 4" stroke="#FFF2A8" stroke-width="1.2"/></g></g>`);
      haloA(x - 26, y - 100, 70, "#FF3B3B", .35); haloA(x + 40, y - 100, 70, "#2A9BFF", .35);
      bulle(x - 50, y - 152, "Je suis ton père.", 7, 0, "#FF6B6B"); }
    // ---- 2. l'empereur devant la grande verrière (jambe droite de l'intérieur)
    { const x = 772, y = 470; K.prendre(x, y, 105);
      s.push(`<circle cx="${x}" cy="${y - 20}" r="92" fill="url(#s3-vitre)"/>`); for (let k = 0; k < 60; k++) { const t = r() * TAU, d2 = Math.sqrt(r()) * 86; s.push(`<circle cx="${f(x + Math.cos(t) * d2)}" cy="${f(y - 20 + Math.sin(t) * d2)}" r="${f(.4 + r() * .9)}" fill="#FFFFFF" opacity=".8"/>`); }
      // au loin, à travers la vitre : la flotte et la bataille
      [[-40, -60, .5, 20], [30, -70, .4, 160], [-10, -10, .35, 200]].forEach(([u, v, sc2, rot]) => s.push(`${G(x + u, y - 20 + v, sc2 * .45, rot)}${destroyer(160)}</g>`));
      for (let k = 0; k < 8; k++) { const t = r() * TAU, d2 = 30 + r() * 50; s.push(`${G(x + Math.cos(t) * d2, y - 20 + Math.sin(t) * d2, .25, r() * 360)}${r() < .5 ? tie() : xwing(COULEURS_J[k % 4])}</g>`); }
      s.push(`<circle cx="${x}" cy="${y - 20}" r="92" fill="none" stroke="#1A1E26" stroke-width="12"/><circle cx="${x}" cy="${y - 20}" r="92" fill="none" stroke="#4A525E" stroke-width="2"/>`); for (let k = 0; k < 8; k++) { const t = k / 8 * TAU + PI / 8; s.push(`<path d="M${f(x + Math.cos(t) * 20)} ${f(y - 20 + Math.sin(t) * 20)}L${f(x + Math.cos(t) * 90)} ${f(y - 20 + Math.sin(t) * 90)}" stroke="#1A1E26" stroke-width="4"/>`); }
      s.push(`<circle cx="${x}" cy="${y - 20}" r="20" fill="none" stroke="#1A1E26" stroke-width="4"/><path d="M${x - 100} ${y + 72}h200v14h-200z" fill="#1A1E26"/><path d="M${x - 100} ${y + 72}h200" stroke="#4A525E" stroke-width="1.5"/>`);
      // le trône et l'empereur en capuche ; à droite, le chevalier à terre
      s.push(`${G(x - 20, y + 34, 1.55)}<path d="M-24 26V-18Q-24 -34 0 -36Q24 -34 24 -18V26Z" fill="#2A2E36" ${INK}/><path d="M-30 26h60v6h-60z" fill="#1A1E26"/><path d="M-26 -6h-6v32h6M26 -6h6v32h-6" fill="#3A3F48" ${INK}/>
        <path d="M-15 26L-12 -6Q0 -22 12 -6L15 26Z" fill="#0A0A0E" ${INK}/><path d="M-11 -6Q-12 -30 0 -32Q12 -30 11 -6Q0 -12 -11 -6Z" fill="#0A0A0E" ${INK}/><path d="M-6 -12Q0 -26 6 -12Q0 -8 -6 -12Z" fill="#B8B4A0"/><path d="M-3.6 -16.5h2M1.6 -16.5h2" stroke="#F2C832" stroke-width="1.4"/><path d="M-3 -11.5q3 1.6 6 0" stroke="#5A4A3A" fill="none" stroke-width=".8"/>
        <path d="M10 -2q8 -4 16 -10" stroke="#0A0A0E" stroke-width="5" stroke-linecap="round"/><path d="M-10 -2q-6 -4 -8 -12" stroke="#0A0A0E" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="-12" r="2.6" fill="#B8B4A0"/></g>`);
      s.push(`${G(x + 64, y + 66, 1.3)}<path d="M-14 0q4 -10 14 -8l12 2q4 4 0 6z" fill="#1E1E24" ${INK}/><circle cx="-14" cy="-4" r="5" fill="#E8C8A8" ${INK}/><path d="M-18 -6q4 -5 8 -1" stroke="#B88A4A" stroke-width="2.4" fill="none"/></g>`);
      const ex = x - 20 + 26 * 1.55, ey = y + 34 - 12 * 1.55; let arcs = ""; for (let k = 0; k < 3; k++) arcs += `<path d="${eclair(ex, ey, x + 52 + k * 4, y + 58 + k * 3, 6, 12)}" stroke="#D8B8FF" stroke-width="${k ? 1.4 : 2.4}" fill="none"/>`;
      a.push(`<g>${an(`<animate attributeName="opacity" values="1;.2;1;.6;1;0;0" keyTimes="0;.1;.2;.3;.45;.5;1" dur="2.2s" repeatCount="indefinite"/>`)}<g stroke="#9B5AFF" stroke-width="6" opacity=".35" fill="none">${arcs.replace(/stroke="#D8B8FF" stroke-width="[\d.]+"/g, "")}</g>${arcs}</g>`);
      let arcs2 = ""; for (let k = 0; k < 3; k++) arcs2 += `<path d="${eclair(ex, ey, x + 56 + k * 3, y + 52 + k * 5, 7, 14)}" stroke="#F0E0FF" stroke-width="${k ? 1.2 : 2}" fill="none"/>`;
      a.push(`<g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;0;1;.3;1;0" keyTimes="0;.5;.6;.7;.85;1" dur="2.2s" repeatCount="indefinite"/>`)}${arcs2}</g>`);
      haloA(ex + 20, ey + 14, 50, "#9B5AFF", .45);
      bulle(x - 6, y - 128, "Puissance illimitée !", 9, 3, "#C9A0FF"); }
    // ---- 3. le petit maître vert soulève le chasseur du marais (jambe gauche de l'intérieur)
    { const x = 306, y = 482; K.prendre(x, y, 105);
      s.push(`<circle cx="${x}" cy="${y + 10}" r="124" fill="#2A4426" opacity=".6" filter="url(#s3-flou8)"/><path d="M${x - 112} ${y + 10}C${x - 120} ${y - 70} ${x - 50} ${y - 112} ${x + 10} ${y - 108}S${x + 118} ${y - 60} ${x + 114} ${y + 12}S${x + 70} ${y + 128} ${x} ${y + 124}S${x - 106} ${y + 80} ${x - 112} ${y + 10}Z" fill="url(#s3-mar)"/>`);
      for (let k = 0; k < 9; k++) { const u = (r() - .5) * 180, v = (r() - .5) * 170; if (u * u + v * v > 100 * 100) continue; K.arbre(x + u, y + 10 + v, 12 + r() * 10, "#6A8A4A", "#3A5A2E", "#1A2E1A"); }
      s.push(`<ellipse cx="${x + 24}" cy="${y + 40}" rx="62" ry="24" fill="#24402E" stroke="#5A7A4A" stroke-width="2"/><ellipse cx="${x + 24}" cy="${y + 40}" rx="48" ry="16" fill="#1A3326"/>${[0, 1, 2].map(q => `<ellipse cx="${x + 24}" cy="${y + 40}" rx="${20 + q * 14}" ry="${7 + q * 5}" fill="none" stroke="#8ABFA0" stroke-width="1" opacity="${.5 - q * .12}"/>`).join("")}`);
      // l'arbre noueux et sa cabane ronde à la fenêtre chaude
      s.push(`<path d="M${x - 66} ${y + 62}q10 -40 4 -80q-6 -30 14 -46M${x - 66} ${y + 62}q-20 0 -30 14M${x - 62} ${y + 60}q20 4 26 18M${x - 58} ${y - 10}q-26 -6 -36 -24M${x - 54} ${y - 30}q24 -8 30 -26" stroke="#3A2A1E" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M${x - 92} ${y - 34}v22M${x - 80} ${y - 40}v28M${x - 26} ${y - 56}v20" stroke="#6A8A5A" stroke-width="2" opacity=".8"/>`);
      s.push(`${G(x + 72, y + 80, 1)}<ellipse cx="2" cy="10" rx="28" ry="8" fill="#000" opacity=".4"/><path d="M-24 10Q-26 -22 0 -24Q26 -22 24 10Z" fill="#7A6A4A" ${INK}/><path d="M-18 -8q18 -10 36 0M-22 2q22 -8 44 0" stroke="#5A4A32" stroke-width="1.5" fill="none"/><path d="M-6 10v-12q6 -6 12 0v12z" fill="#2A1E12"/><circle cx="-14" cy="-6" r="4" fill="#FFC86A"/><circle cx="14" cy="-4" r="3" fill="#FFC86A"/></g>`); K.halo(x + 70, y + 76, 34, "#FFB050", .5);
      s.push(`${G(x - 52, y + 46, 2.3)}<path d="M-9 14L-7 -4Q0 -8 7 -4L9 14Z" fill="#8A6A48" ${INK}/><path d="M-7 -2l-6 -2l1 6" fill="#8A6A48"/><path d="M6 -2q8 -6 12 -14" stroke="#8ABF6A" stroke-width="2.6" stroke-linecap="round"/><circle cx="18.5" cy="-16.5" r="1.8" fill="#8ABF6A"/><ellipse cy="-10" rx="7.5" ry="6.2" fill="#8ABF6A" ${INK}/><path d="M-6 -11L-21 -16L-7.5 -6.5ZM6 -11L21 -16L7.5 -6.5Z" fill="#8ABF6A" ${INK}/><path d="M-17 -14.5L-8 -10.5M17 -14.5L8 -10.5" stroke="#C88A7A" stroke-width="1" opacity=".7"/><circle cx="-2.8" cy="-11" r="1.6" fill="#2A1E12"/><circle cx="2.8" cy="-11" r="1.6" fill="#2A1E12"/><path d="M-3 -6.5q3 1.4 6 0" stroke="#4A6A3A" fill="none" stroke-width=".7"/><path d="M-5 -15q5 -3 10 0" stroke="#D8E8C8" stroke-width="1" fill="none"/><path d="M-12 14l-3 -18" stroke="#6A4A2A" stroke-width="1.8"/></g>`);
      // le chasseur qui sort de l'eau (vue de face), gouttes et poussière de Force
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 16;0 -10;0 -10;0 16" keyTimes="0;.45;.7;1" dur="6s" repeatCount="indefinite"/>`)}${G(x + 34, y - 12, 1.25, -14)}${xwingFace("#E5484D")}<path d="M-24 18v6M-6 8v8M14 12v7M28 18v5" stroke="#8ABFA0" stroke-width="1.2" stroke-dasharray="2 2"/></g></g>`);
      for (let k = 0; k < 7; k++) { const u = x + 34 + (r() - .5) * 90, v = y - 12 + (r() - .5) * 60; a.push(`<circle cx="${f(u)}" cy="${f(v)}" r="${f(1.2 + r() * 1.2)}" fill="#CFF0FF">${an(`<animate attributeName="opacity" values="0;1;0" dur="${(1.2 + r() * 1.4).toFixed(1)}s" begin="${(r() * 2).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); }
      haloA(x + 34, y - 12, 60, "#9FE0FF", .3);
      for (let k = 0; k < 6; k++) s.push(`<ellipse cx="${f(x + (r() - .5) * 180)}" cy="${f(y + 20 + (r() - .5) * 150)}" rx="${f(40 + r() * 40)}" ry="${f(8 + r() * 6)}" fill="#D8E8D8" opacity=".12" filter="url(#s3-flou)"/>`);
      bulle(x - 20, y - 98, "Fais-le, ou ne le fais pas.", 9, 5, "#9AE88A"); }
    // ---- 4. la table d'holo-échecs des droïdes (le monument 3D « holodome », dans l'encoche du bas)
    { const [hx, hy] = K.rep({ t: "holodome" }); K.prendre(hx, hy, 52);
      s.push(`<ellipse cx="${f(hx)}" cy="${f(hy + 8)}" rx="50" ry="30" fill="#000" opacity=".5" filter="url(#s3-flou)"/><ellipse cx="${f(hx)}" cy="${f(hy + 4)}" rx="44" ry="26" fill="#3A4250" ${INK}/><ellipse cx="${f(hx)}" cy="${f(hy)}" rx="44" ry="26" fill="#1E2A38" stroke="#7CC8FF" stroke-width="1.4"/>`);
      for (let k = 0; k < 12; k++) { const t0 = k / 12 * TAU, t1 = (k + 1) / 12 * TAU, R1 = 40, R2 = 22; s.push(`<path d="M${f(hx + Math.cos(t0) * R2)} ${f(hy + Math.sin(t0) * R2 * .6)}L${f(hx + Math.cos(t0) * R1)} ${f(hy + Math.sin(t0) * R1 * .6)}L${f(hx + Math.cos(t1) * R1)} ${f(hy + Math.sin(t1) * R1 * .6)}L${f(hx + Math.cos(t1) * R2)} ${f(hy + Math.sin(t1) * R2 * .6)}Z" fill="${k % 2 ? "#2A6A8A" : "#E8D088"}" opacity=".75"/>`); }
      s.push(`<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="16" ry="9.6" fill="#2A6A8A" stroke="#7CC8FF" stroke-width="1"/><ellipse cx="${f(hx)}" cy="${f(hy - 24)}" rx="48" ry="40" fill="url(#s3-holo)"/>`);
      // 4 petites créatures holographiques aux couleurs des pilotes
      a.push(`<g opacity=".95">${an(`<animate attributeName="opacity" values=".95;.55;.95;.8;.95" dur="1.3s" repeatCount="indefinite"/>`)}${COULEURS_J.map((c, k) => { const t = k / 4 * TAU + .4, u = hx + Math.cos(t) * 30, v = hy + Math.sin(t) * 18; return `${G(u, v, 1.45)}<path d="M-5 0q0 -10 5 -14q5 4 5 14z" fill="${c}" opacity=".75" stroke="#DFFBFF" stroke-width=".7"/><circle cy="-15" r="3.2" fill="${c}" opacity=".85" stroke="#DFFBFF" stroke-width=".7"/><path d="M-2 -18l-2 -4M2 -18l2 -4" stroke="#DFFBFF" stroke-width=".8"/></g>`; }).join("")}</g>`);
      // les deux droïdes : le petit bleu qui bipe et le grand doré qui s'affole
      const dy = hy + 74; K.prendre(hx, dy, 40);
      s.push(`${G(hx - 30, dy, 1.6)}<ellipse cy="14" rx="14" ry="3" fill="#000" opacity=".4"/><path d="M-12 -4h-4l-2 18h7zM12 -4h4l2 18h-7z" fill="#E8ECEF" ${INK}/><rect x="-10" y="-8" width="20" height="20" rx="2" fill="#F2F4F6" ${INK}/><path d="M-10 -8a10 10 0 0 1 20 0z" fill="#C8CED6" ${INK}/><rect x="-7" y="-2" width="5" height="9" fill="#2A5AB8"/><rect x="2" y="-2" width="5" height="4" fill="#2A5AB8"/><rect x="2" y="4" width="5" height="3" fill="#9AA3AE"/><rect x="-6" y="-14" width="6" height="3" fill="#2A5AB8"/><circle cx="-3" cy="-12.5" r="1.4" fill="#1A1E26"/></g>`);
      a.push(`<circle cx="${f(hx - 30 + 4.8)}" cy="${f(dy - 21)}" r="2" fill="#FF4B4B">${an(`<animate attributeName="fill" values="#FF4B4B;#4BB0FF;#FF4B4B" dur=".9s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-4 ${f(hx + 30)} ${f(dy + 18)};4 ${f(hx + 30)} ${f(dy + 18)};-4 ${f(hx + 30)} ${f(dy + 18)}" dur="1.1s" repeatCount="indefinite"/>`)}${G(hx + 30, dy, 1.6)}<path d="M-6 12l1 -16h10l1 16z" fill="url(#s3-aor)" ${INK}/><rect x="-7" y="-20" width="14" height="17" rx="4" fill="url(#s3-aor)" ${INK}/><path d="M-4 -14h8M-3 -10h6" stroke="#8A5A12" stroke-width=".8"/><circle cy="-26" r="6.4" fill="url(#s3-aor)" ${INK}/><circle cx="-2.4" cy="-27" r="1.6" fill="#FFF2A0" stroke="#8A5A12" stroke-width=".5"/><circle cx="2.4" cy="-27" r="1.6" fill="#FFF2A0" stroke="#8A5A12" stroke-width=".5"/><path d="M-2 -23h4" stroke="#8A5A12" stroke-width=".8"/><path d="M-7 -16l-7 -10M7 -16l7 -10" stroke="#E8B83A" stroke-width="2.6" stroke-linecap="round"/></g></g>`);
      bulle(hx + 4, dy + 40, "Laisse gagner le Wookie !", 8, 1.5, "#E8B83A");
      // le cargo rond à quai (vue de dessus), sous la table
      const cx2 = hx + 2, cy2 = 655; K.prendre(cx2, cy2, 50);
      s.push(`<circle cx="${f(cx2)}" cy="${f(cy2)}" r="58" fill="none" stroke="#2A6AA8" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>${G(cx2, cy2, 1.1, -90)}<g transform="scale(1 -1)"><ellipse cx="4" cy="4" rx="42" ry="40" fill="#000" opacity=".5" filter="url(#s3-flou)"/><path d="M-38 -8A40 40 0 1 1 -38 8L-40 8L-40 -8Z" fill="#C9CDD2" ${INK}/><path d="M30 -24L62 -18L62 -6L36 -8ZM30 24L62 18L62 6L36 8Z" fill="#BCC1C7" ${INK}/><path d="M36 -12h22M36 12h22" stroke="#8A9098" stroke-width="1"/>
        <path d="M-6 -36L4 -50L26 -44L22 -32Z" fill="#B8BCC2" ${INK}/><circle cx="22" cy="-44" r="6" fill="#B8BCC2" ${INK}/><path d="M20 -47l6 3" stroke="#1A2A40" stroke-width="3"/><circle r="12" fill="#A8AEB6" ${INK}/><circle r="6" fill="#8A9098" ${INK}/><path d="M-4 -2h-14M-4 2h-14" stroke="#5A606A" stroke-width="1.6"/>
        ${[-30, -15, 15, 30].map(v => `<path d="M-14 ${v * .9}L-34 ${v}" stroke="#8A9098" stroke-width="1"/>`).join("")}<circle cx="-14" cy="24" r="7" fill="#B8BCC2" ${INK}/><path d="M-18 21l8 6" stroke="#6E747C" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map(q => `<rect x="${f(-26 + q * 3.5)}" y="${f(-30 + q * 2)}" width="3" height="3" fill="#C8783A" opacity=".75"/>`).join("")}</g></g>`);
      a.push(`<path d="M${f(cx2 - 40)} ${f(cy2 + 43)}A44 44 0 0 0 ${f(cx2 + 40)} ${f(cy2 + 43)}" stroke="#7CC8FF" stroke-width="5" fill="none" opacity=".8">${an(`<animate attributeName="opacity" values=".4;.95;.4" dur="1.8s" repeatCount="indefinite"/>`)}</path>`); }
    // ---- 5. le chasseur de primes au réacteur dorsal (marge gauche)
    { const x = 82, y = 318; K.prendre(x, y, 50);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 8;0 -8;0 8" dur="2.6s" repeatCount="indefinite"/>`)}${G(x, y, 2)}<path d="M-12 -16l-3 -2l-4 6" stroke="#8A6A3A" stroke-width="2" fill="none"/><rect x="7" y="-16" width="8" height="18" rx="3" fill="#7A8A6A" ${INK}/><path d="M9 -18l2 -4l2 4" fill="#C83A2A"/><path d="M8 2l3 14l3 -14z" fill="#FF8A2A" opacity=".95">${an(`<animate attributeName="d" values="M8 2l3 12l3 -12z;M8 2l3 19l3 -19z;M8 2l3 12l3 -12z" dur=".25s" repeatCount="indefinite"/>`)}</path><path d="M9.5 2l1.5 7l1.5 -7z" fill="#FFF0A0"/>
        <path d="M-6 16l-1 -10h5l1 10zM2 16l-1 -10h5l1 10z" fill="#5A6A4A" ${INK}/><path d="M-9 6l-1 -24h18l-1 24z" fill="#6E7A5A" ${INK}/><path d="M-9 -12h18" stroke="#8A3A2A" stroke-width="2.4"/><path d="M-5 -16h10v6h-10z" fill="#9AA3AE" opacity=".7"/><path d="M-8 -4h16" stroke="#3A2A1E" stroke-width="2"/><path d="M-9 -16l-5 14M9 -16l4 10" stroke="#6E7A5A" stroke-width="3.4" stroke-linecap="round"/><path d="M-14 -2l-3 8" stroke="#3A3A44" stroke-width="2.2"/>
        <path d="M-8 -20v-14q8 -7 16 0v14z" fill="#6E8A6A" ${INK}/><path d="M-6 -28h12M0 -28v7" stroke="#0A0A0E" stroke-width="2.6"/><path d="M-8 -30q-2 4 0 8" stroke="#C83A2A" stroke-width="1.4" fill="none"/><path d="M8 -30l5 -8" stroke="#9AA3AE" stroke-width="1.2"/><circle cx="13" cy="-38" r="1" fill="#FF4B4B"/></g></g>`); }
    // ---- l'Escadron Versus : les 4 pilotes en formation (marge droite) ; l'appli pose leurs vrais portraits dans les hublots
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    { s.push(`<text x="1008" y="112" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="12" letter-spacing="1.5" fill="#FFE27A" stroke="#05070F" stroke-width="3" paint-order="stroke">ESCADRON</text><text x="1008" y="127" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="12" letter-spacing="1.5" fill="#FFE27A" stroke="#05070F" stroke-width="3" paint-order="stroke">VERSUS</text>`);
      COULEURS_J.forEach((c, k) => { const fy = 186 + k * 118, fx = 972 + (k % 2) * 6, qx = 1040, qy = fy - 4; K.prendre(1005, fy, 50);
        s.push(`<path d="M${f(fx - 2)} ${f(fy + 34)}L${f(fx - 2)} ${f(fy + 70)}" stroke="${c}" stroke-width="6" opacity=".18" filter="url(#s3-flou)"/>${G(fx, fy, 1.45, -90)}${xwing(c)}</g>`);
        s.push(`<circle cx="${qx}" cy="${qy}" r="26" fill="${c}" opacity=".22"/><circle cx="${qx}" cy="${qy}" r="22" fill="#0A1430" stroke="${c}" stroke-width="2.4"/><path d="M${qx - 22} ${qy}h-6M${qx + 22} ${qy}h4M${qx} ${qy - 22}v-4" stroke="${c}" stroke-width="1.6"/><text x="${qx}" y="${qy + 38}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="10.5" fill="${c}" stroke="#05070F" stroke-width="2.6" paint-order="stroke">${NOMS[k]}</text>`);
        PORTR.push({ k, x: qx, y: qy, r: 20 });
        a.push(`<path d="M${f(fx - 2)} ${f(fy + 26)}l-3 10h6z" fill="#FFD08A">${an(`<animate attributeName="opacity" values="1;.4;1" dur="${(.4 + k * .07).toFixed(2)}s" repeatCount="indefinite"/>`)}</path>`); });
      ["Théo, en position !", "Kévin, en position !", "Clément, en position !", "Devlin, en position !"].forEach((t, k) => bulle(992, 186 + k * 118 + 60, t, 16, k * 4, COULEURS_J[k])); }
    // ---- combats de chasseurs (en haut, entre le duel et la station, en bas) et tirs
    const poursuite = (chemin, dur, deb, fx, fy, rot) => { const L = an(`<animateMotion dur="${dur}s" begin="-${deb}s" repeatCount="indefinite" rotate="auto" path="${chemin}"/>`);
      a.push(`<g${K.anime ? "" : ` transform="translate(${f(fx)} ${f(fy)}) rotate(${rot})"`}>${L}${G(0, 0, 1)}${tie()}</g><path d="M14 0h18" stroke="#4BFF6A" stroke-width="2" stroke-linecap="round" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.25;1" dur=".7s" repeatCount="indefinite"/>`)}</path></g>`);
      a.push(`<g${K.anime ? "" : ` transform="translate(${f(fx - 52)} ${f(fy)}) rotate(${rot})"`}>${an(`<animateMotion dur="${dur}s" begin="-${(deb - dur * .06).toFixed(2)}s" repeatCount="indefinite" rotate="auto" path="${chemin}"/>`)}${G(0, 0, .85)}${xwing("#E5484D")}</g><path d="M30 -24h22M30 24h22" stroke="#FF3B3B" stroke-width="2" stroke-linecap="round" opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.3;1" dur=".5s" repeatCount="indefinite"/>`)}</path></g>`); };
    poursuite("M-80,40C200,10 400,64 620,30S900,10 1160,46", 12, 3, 330, 34, 0);
    poursuite("M630,250C560,170 600,120 660,130S720,250 630,250", 8, 2, 650, 200, -70);
    poursuite("M1160,700C900,680 760,712 620,690S300,676 -80,700", 14, 6, 760, 700, 180);
    for (let k = 0; k < 10; k++) { const x = r() * W, y = r() * H; if (!K.libre(x, y, 6, 6)) continue; s.push(`<path d="M${f(x)} ${f(y)}l${f(14 * (k % 2 ? 1 : -1))} ${f((r() - .5) * 6)}" stroke="${k % 2 ? "#FF3B3B" : "#4BFF6A"}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`); }
    // explosions dans la bataille
    [[600, 54, 0], [700, 330, 2.4], [250, 690, 4.1], [880, 24, 5.6]].forEach(([x, y, b]) => a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;1;.6;0;0" keyTimes="0;.04;.12;.26;1" dur="7s" begin="${b}s" repeatCount="indefinite"/>`)}<circle cx="${x}" cy="${y}" r="14" fill="#FFB04A" opacity=".55"/><circle cx="${x}" cy="${y}" r="7" fill="#FFF2C0"/>${[0, 1, 2, 3, 4, 5].map(q => `<path d="M${x} ${y}l${f(Math.cos(q * 1.05) * 18)} ${f(Math.sin(q * 1.05) * 18)}" stroke="#FFD08A" stroke-width="1.2"/>`).join("")}</g>`));
    // quelques astéroïdes en bordure
    K.semis(16, () => 6 + r() * 12, 3000, (x, y) => y > 650 || y < 60 || x < 150 || x > 930, (x, y, R) => { const pts = []; for (let q = 0; q < 9; q++) { const t = q / 9 * TAU, d2 = R * (.7 + r() * .4); pts.push(f(x + Math.cos(t) * d2) + "," + f(y + Math.sin(t) * d2)); } s.push(`<polygon points="${pts.join(" ")}" fill="#5A524A" stroke="#2E2A26" stroke-width="1.2"/><circle cx="${f(x - R * .2)}" cy="${f(y - R * .25)}" r="${f(R * .28)}" fill="#3A3430"/><path d="M${f(x - R * .6)} ${f(y - R * .5)}q${f(R * .5)} ${f(-R * .3)} ${f(R)} 0" stroke="#8A8278" stroke-width="1" fill="none"/>`); });
    // ---- la piste : voie d'hyperespace lumineuse
    K.route([["#000", 42, ` opacity=".7" filter="url(#s3-flou)"`], ["#2AC8FF", 34, ` opacity=".22"`], ["#0E1424", 27], ["#16203A", 21]]);
    for (const sd of [1, -1]) { const d = "M" + K.P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 12.5) + " " + f(p[1] + ny * sd * 12.5); }).join("L") + "Z"; s.push(`<path d="${d}" fill="none" stroke="${sd > 0 ? "#7CC8FF" : "#FFFFFF"}" stroke-width="1.6" stroke-dasharray="10 6" opacity=".9"/>`); }
    s.push(`<path d="${K.piste}" fill="none" stroke="#2A4A7A" stroke-width="1" stroke-dasharray="2 14"/>`);
    a.push(`<path d="${K.piste}" fill="none" stroke="#9FE0FF" stroke-width="2.2" stroke-dasharray="4 40" opacity=".9">${an('<animate attributeName="stroke-dashoffset" from="0" to="-88" dur="1.2s" repeatCount="indefinite"/>')}</path>`);
    K.depart();
    { const p0 = K.P[0], [nx, ny] = K.nrm(0), x = p0[0] + nx * 34, y = p0[1] + ny * 34; s.push(`<text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-family="system-ui, sans-serif" font-style="italic" font-weight="700" font-size="11" fill="#FFE27A" stroke="#05070F" stroke-width="2.6" paint-order="stroke">Que la Force soit avec vous</text>`); }
    // les 4 pilotes sur la piste, chacun dans son chasseur
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.06 + k * .025, `${G(0, 0, .55)}${xwing(c, true)}</g>`, 34, k * .9)));
    K.particules(14, "#FFFFFF", 1.8, "scintille");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#s3-ciel)"/>`, "", 0); RES.portraits = PORTR; return RES;
  }

  /* ---------- Juillet · La Mer de dunes (v3, grandiose) : le Grand Ver qui surgit, le sietch, la forteresse noire, la moissonneuse, le long-courrier ---------- */
  /* ---------- Juillet · La Mer de dunes (v4, grand écran) : le ver des sables jaillit en arc par-dessus la piste, son cavalier debout
     sur le dos ; il vient d'avaler la moissonneuse (en bas) ; le palais des sables (à gauche) face à la citadelle noire (à droite) ;
     le mur de tempête monte à l'est ; le grand vaisseau-cargo et les deux lunes dans le ciel ; épice bleue qui scintille. Tout est dessiné ici. ---------- */
  function peindreDunes4(T, Z, def) {
    const K = kit(T, def, 47, "d4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#2A1408" stroke-width="1.2"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const lab = (x, y, txt, t, c) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="${t || 12}" fill="${c || "#FFF2D6"}" stroke="#2A1408" stroke-width="3" paint-order="stroke" stroke-linejoin="round" letter-spacing=".4">${txt}</text>`);
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.9 - 6)}" y="${f(y - 11)}" width="${f(txt.length * 5.8 + 12)}" height="17" rx="8" fill="#FFF8EA" stroke="#2A1408" stroke-width="1"/><path d="M${f(x - 4)} ${f(y + 6)}l2 7l6 -7" fill="#FFF8EA" stroke="#2A1408" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#2A1408">${txt}</text></g>`);
    const lisse = (pts, ferme) => { const mi = (p, q) => f((p[0] + q[0]) / 2) + " " + f((p[1] + q[1]) / 2); if (!ferme) { let d = `M${f(pts[0][0])} ${f(pts[0][1])}`; for (let i = 1; i < pts.length - 1; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mi(pts[i], pts[i + 1])}`; return d + `L${f(pts[pts.length - 1][0])} ${f(pts[pts.length - 1][1])}`; }
      const n = pts.length; let d = "M" + mi(pts[n - 1], pts[0]); for (let i = 0; i < n; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mi(pts[i], pts[(i + 1) % n])}`; return d + "Z"; };
    // l'horizon : juste au-dessus de la piste (plus haut au centre où la piste monte)
    const hzP = []; for (let x = -20; x <= W + 20; x += 10) { let m = 210; for (let i = 0; i < K.N; i += 2) { const p = K.P[i]; if (Math.abs(p[0] - x) < 44 && p[1] - 40 < m) m = p[1] - 40; } hzP.push([x, Math.max(44, Math.min(165, m))]); }
    for (let k = 0; k < 4; k++) for (let i = 1; i < hzP.length - 1; i++) hzP[i][1] = Math.min(hzP[i][1], (hzP[i - 1][1] + hzP[i][1] * 2 + hzP[i + 1][1]) / 4);
    const hz = x => hzP[Math.max(0, Math.min(hzP.length - 1, Math.round((x + 20) / 10)))][1];
    // ---- dégradés
    s.push(`<linearGradient id="d4-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1236"/><stop offset=".35" stop-color="#4A2450"/><stop offset=".7" stop-color="#B8504A"/><stop offset="1" stop-color="#FFB45E"/></linearGradient>`);
    s.push(`<radialGradient id="d4-soleil" r="50%"><stop offset="0" stop-color="#FFF8E0"/><stop offset=".25" stop-color="#FFD88A" stop-opacity=".95"/><stop offset=".6" stop-color="#FF9A4A" stop-opacity=".35"/><stop offset="1" stop-color="#FF7A3A" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="d4-gueule" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A0606"/><stop offset=".5" stop-color="#6A1414"/><stop offset="1" stop-color="#C0503A"/></linearGradient>`);
    s.push(`<radialGradient id="d4-gorge" r="50%"><stop offset="0" stop-color="#000000"/><stop offset=".35" stop-color="#1A0404"/><stop offset=".75" stop-color="#5A1210"/><stop offset="1" stop-color="#A83A2A"/></radialGradient>`);
    s.push(`<linearGradient id="d4-noir" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A5464"/><stop offset=".35" stop-color="#26242E"/><stop offset="1" stop-color="#08080C"/></linearGradient>`);
    s.push(`<linearGradient id="d4-pierre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE0A8"/><stop offset=".45" stop-color="#D8A066"/><stop offset="1" stop-color="#8A5530"/></linearGradient>`);
    s.push(`<linearGradient id="d4-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8CCB4"/><stop offset=".5" stop-color="#8A8070"/><stop offset="1" stop-color="#3A342C"/></linearGradient>`);
    s.push(`<linearGradient id="d4-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE6B0"/><stop offset=".4" stop-color="#E8A84A"/><stop offset="1" stop-color="#7A4A16"/></linearGradient>`);
    s.push(`<linearGradient id="d4-nef" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A7E92"/><stop offset=".45" stop-color="#3E3848"/><stop offset="1" stop-color="#16121C"/></linearGradient>`);
    s.push(`<linearGradient id="d4-orage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A4A3A" stop-opacity="0"/><stop offset=".3" stop-color="#7A3A3E" stop-opacity=".75"/><stop offset="1" stop-color="#3A1A2A" stop-opacity=".97"/></linearGradient>`);
    s.push(`<radialGradient id="d4-epice" r="50%"><stop offset="0" stop-color="#FF9A3A" stop-opacity=".9"/><stop offset=".5" stop-color="#FF6A1E" stop-opacity=".35"/><stop offset="1" stop-color="#FF6A1E" stop-opacity="0"/></radialGradient>`);
    // ================= 1. LA MER DE DUNES : grands aplats chauds, crêtes vives, flancs d'ombre violets =================
    { const BAND = [["#F6C88A", "#9A5A6A"], ["#F0B474", "#8A4A62"], ["#EBA462", "#7E4060"], ["#E6965A", "#74385A"], ["#DE8A4E", "#6A3256"], ["#D67E46", "#622C50"], ["#CC7240", "#5A284C"], ["#C2683A", "#522448"], ["#B85E36", "#4A2042"], ["#AE5432", "#421C3C"]];
      BAND.forEach(([c, o], j) => { const y0 = 120 + j * 66, A1 = 14 + r() * 14, A2 = 6 + r() * 8, p1 = r() * TAU, p2 = r() * TAU, l1 = 150 + r() * 120, l2 = 50 + r() * 30, p3 = r() * TAU;
        const crete = x => y0 + A1 * Math.sin(x / l1 + p1) + A2 * Math.sin(x / l2 + p2), pts = []; for (let x = -20; x <= W + 20; x += 12) pts.push([x, crete(x)]);
        s.push(`<path d="${lisse(pts)}L${W + 20} ${H + 20}L-20 ${H + 20}Z" fill="${c}"/>`);
        // le flanc d'ombre : croissants sous la crête (côté opposé au couchant)
        let ombre = ""; for (let x = -20; x <= W + 20; x += 12) { const e = Math.max(0, Math.sin(x / (l1 * .55) + p3)) ** 1.4 * (26 + j * 2.4); ombre += (ombre ? "L" : "M") + f(x) + " " + f(crete(x) + e); }
        for (let x = W + 20; x >= -20; x -= 12) ombre += `L${f(x)} ${f(crete(x))}`;
        s.push(`<path d="${ombre}Z" fill="${o}" opacity=".5"/>`);
        s.push(`<path d="${lisse(pts)}" fill="none" stroke="#FFE8C0" stroke-width="${f(1.4 + j * .15)}" opacity=".55"/>`);
        // ridules du vent sur le flanc éclairé
        for (let q = 0; q < 7; q++) { const x = r() * W, y = crete(x) + 22 + r() * 30; s.push(`<path d="M${f(x - 40)} ${f(y)}q20 -5 40 0t40 0" fill="none" stroke="${o}" stroke-width="1" opacity=".22"/>`); } }); }
    // veines d'épice orange dans le sable
    for (let k = 0; k < 10; k++) { const x = r() * W, y = 200 + r() * (H - 200); let d = `M${f(x)} ${f(y)}`; for (let q = 0; q < 5; q++) d += `q${f(20 + r() * 30)} ${f((r() - .5) * 26)} ${f(40 + r() * 40)} ${f((r() - .5) * 18)}`; s.push(`<path d="${d}" fill="none" stroke="#FF7A2A" stroke-width="${f(5 + r() * 7)}" opacity=".25" filter="url(#d4-flou)"/>`); }
    // ================= 2. LE CIEL DU COUCHANT : soleil, deux lunes, mur de montagnes =================
    const hzD = "M-20 -10" + hzP.map(p => `L${f(p[0])} ${f(p[1])}`).join("") + `L${W + 20} -10Z`;
    s.push(`<path d="${hzD}" fill="url(#d4-ciel)"/>`);
    for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * 70; if (y < hz(x) - 40) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.4 + r() * .9)}" fill="#FFF" opacity="${(.3 + r() * .5).toFixed(2)}"/>`); }
    const SX = 300, SY = hz(300) - 6;
    s.push(`<circle cx="${SX}" cy="${f(SY)}" r="120" fill="url(#d4-soleil)"/><circle cx="${SX}" cy="${f(SY)}" r="26" fill="#FFF2CC"/>`);
    // les deux lunes (la grande pâle, la petite rousse)
    { const mx = 420, my = 40; s.push(`<circle cx="${mx}" cy="${my}" r="22" fill="#F4E8D4"/><circle cx="${mx + 7}" cy="${my - 4}" r="20" fill="#2A1A3E" opacity=".3"/><circle cx="${mx - 7}" cy="${my + 5}" r="4" fill="#D8C8B0"/><circle cx="${mx - 2}" cy="${my - 9}" r="2.6" fill="#D8C8B0"/><circle cx="${mx + 6}" cy="${my + 8}" r="2" fill="#D8C8B0"/>`);
      s.push(`<circle cx="${mx + 52}" cy="${my - 14}" r="11" fill="#F0C8A0"/><circle cx="${mx + 55}" cy="${my - 16}" r="10" fill="#2A1A3E" opacity=".28"/><circle cx="${mx + 49}" cy="${my - 12}" r="2" fill="#C8A080"/>`); }
    // le mur de montagnes, liseré de feu côté soleil
    [[38, "#5A2E40", .85], [22, "#3A1E2E", 1]].forEach(([Hm, c, op], q) => { let d = `M-20 ${f(hz(-20) + 4)}`; for (let x = -20; x <= W + 20; x += 16) d += `L${f(x)} ${f(hz(x) - Hm * (.3 + .7 * Math.abs(Math.sin(x * .021 + q * 2.1) * Math.cos(x * .007 + q))))}`; d += `L${W + 20} ${f(hz(W + 20) + 4)}Z`;
      s.push(`<path d="${d}" fill="${c}" opacity="${op}"/><path d="${d}" fill="none" stroke="#FFB070" stroke-width="1" opacity=".45"/>`); });
    s.push(`<path d="M-20 ${f(hz(-20))}${hzP.map(p => `L${f(p[0])} ${f(p[1])}`).join("")}" fill="none" stroke="#FFD49A" stroke-width="8" opacity=".5" filter="url(#d4-flou)"/>`);
    s.push(`<g opacity=".08" style="mix-blend-mode:screen">${[[-200, 600], [-60, 700], [80, 680], [220, 620]].map(([u, v]) => `<path d="M${SX} ${f(SY)}L${f(SX + u - 46)} ${f(SY + v)}L${f(SX + u + 46)} ${f(SY + v)}Z" fill="#FFE8B0"/>`).join("")}</g>`);
    // un second ver, au loin, qui fend les dunes sous l'horizon (profondeur)
    { const x0 = 770, y0 = 196; s.push(`<path d="M${x0 - 90} ${y0 + 6}q40 -6 70 -2" stroke="#8A4A2A" stroke-width="6" opacity=".35" fill="none" filter="url(#d4-flou)"/>${[[0, 22, 9], [34, 16, 7], [60, 10, 5]].map(([u, R2, e]) => `<path d="M${x0 + u - R2} ${y0}a${R2} ${R2 * .9} 0 0 1 ${R2 * 2} 0" fill="none" stroke="#7A4A30" stroke-width="${e}" stroke-linecap="round"/><path d="M${x0 + u - R2 + 2} ${y0 - 2}a${R2 - 2} ${R2 * .9 - 2} 0 0 1 ${R2} -${f(R2 * .8)}" fill="none" stroke="#E8B884" stroke-width="1.6" opacity=".7"/>`).join("")}<ellipse cx="${x0 - 22}" cy="${y0 + 1}" rx="8" ry="3" fill="#F2CC92"/><ellipse cx="${x0 + 70}" cy="${y0 + 1}" rx="7" ry="2.4" fill="#F2CC92"/>`); }
    // ================= 3. LE GRAND VAISSEAU-CARGO (immense, dans le ciel à gauche) =================
    { const vx = 160, vy = 50, L = 300, h = 40;
      s.push(`<ellipse cx="${vx + 40}" cy="${vy + 70}" rx="200" ry="10" fill="#1A0A1A" opacity=".18" filter="url(#d4-flou8)"/>`);
      s.push(`${G(vx, vy, 1, -3)}<path d="M${-L / 2} 0Q${-L / 2 + 10} ${-h / 2} ${-L / 2 + 40} ${-h / 2}H${L / 2 - 30}Q${L / 2 + 14} ${-h / 2} ${L / 2 + 16} 0Q${L / 2 + 14} ${h / 2} ${L / 2 - 30} ${h / 2}H${-L / 2 + 40}Q${-L / 2 + 10} ${h / 2} ${-L / 2} 0Z" fill="url(#d4-nef)" stroke="#0A0810" stroke-width="1.6"/>
        ${Array.from({ length: 13 }, (_, q) => `<path d="M${-L / 2 + 40 + q * 20} ${-h / 2 + 1}v${h - 2}" stroke="#0A0810" stroke-width="1.2" opacity=".55"/>`).join("")}
        <path d="M${-L / 2 + 30} ${-h / 2 + 5}H${L / 2 - 30}" stroke="#C8BCD8" stroke-width="2" opacity=".5"/><path d="M${-L / 2 + 26} ${h / 2 - 5}H${L / 2 - 30}" stroke="#000" stroke-width="3" opacity=".4"/>
        <rect x="${L / 2 - 26}" y="-9" width="34" height="18" rx="9" fill="#1A1620" stroke="#8A7E92"/><path d="M${-L / 2 - 2} -6l-14 -4v20l14 -4z" fill="#2A2632" stroke="#0A0810"/>
        <rect x="-60" y="${h / 2 - 2}" width="120" height="7" rx="3" fill="#1A1620"/></g>`);
      a.push(`<g>${an(`<animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/>`)}${Array.from({ length: 9 }, (_, q) => `<circle cx="${f(vx - L / 2 + 50 + q * 30)}" cy="${f(vy - 1 + (q - 4) * 1.6)}" r="1.8" fill="#FFD27A"/>`).join("")}<circle cx="${f(vx + L / 2 - 6)}" cy="${f(vy - 9)}" r="4" fill="#9AE0FF"/></g>`);
      s.push(`<g transform="translate(${vx - 40} ${vy + 60})"><ellipse rx="18" ry="5" fill="#3E3848" stroke="#0A0810"/><circle cx="12" r="2" fill="#FFD27A"/></g>`);
      lab(vx, vy + 44, "le vaisseau-cargo", 10, "#E8DCF8"); }
    // ================= 4. LE MUR DE TEMPÊTE qui monte à l'est (sur le bord droit, derrière le cartouche) =================
    { const bordX = y => (y < 520 ? W - 46 - 20 * Math.sin(y / 90) : W - 46 - (y - 520) * .95 - 10 * Math.sin(y / 70)), pts = [];
      for (let y = -10; y <= H + 30; y += 34) pts.push([bordX(y), y]);
      // le front : une suite de gros bourrelets, face éclairée au couchant, cœur sombre
      let front = `M${W + 20} -10`; pts.forEach(([x, y], k) => { front += k ? `Q${f(x - 34 - r() * 20)} ${f(y - 17)} ${f(x)} ${f(y)}` : `L${f(x)} ${f(y)}`; }); front += `L${W + 20} ${H + 30}Z`;
      s.push(`<path d="${front}" fill="#C27A5A" opacity=".55" transform="translate(-14 0)" filter="url(#d4-flou)"/><path d="${front}" fill="url(#d4-orage)"/><path d="${front}" fill="#3A1A2A" opacity=".55"/>`);
      let bou = ""; pts.forEach(([x, y], k) => { if (k % 1) return; const R = 22 + r() * 14; bou += `<path d="M${f(x - R * .2)} ${f(y + R * .9)}A${f(R)} ${f(R)} 0 0 1 ${f(x + R * .2)} ${f(y - R * .9)}" fill="none" stroke="#E8A07A" stroke-width="3" opacity=".55"/><path d="M${f(x + 12)} ${f(y + R * .6)}A${f(R * .8)} ${f(R * .8)} 0 0 1 ${f(x + 16)} ${f(y - R * .6)}" fill="none" stroke="#2A0E1E" stroke-width="5" opacity=".35"/>`; });
      s.push(bou);
      for (let k = 0; k < 10; k++) { const y = 40 + k * 70 + r() * 20, x = bordX(y) + 30 + r() * 20; s.push(`<path d="M${f(x)} ${f(y)}q${f(20 + r() * 20)} -14 ${f(50 + r() * 20)} -2q-20 8 -10 22" fill="none" stroke="#B87060" stroke-width="2.4" opacity=".4" stroke-linecap="round"/>`); }
      s.push(`<text transform="translate(${W - 22} 420) rotate(-90)" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="12" fill="#FFD8C0" stroke="#2A0E1E" stroke-width="3" paint-order="stroke" letter-spacing="1">le mur de tempête</text>`); }
    // ================= 5. LA PISTE : sable damé, bordée d'ocre, balises à fanion =================
    K.route([["#3A1A0A", 40, ` opacity=".45" filter="url(#d4-flou)"`], ["#6A3418", 31], ["#F4CE94", 27], ["#DDA868", 2, ` stroke-dasharray="3 9" opacity=".9"`]]);
    for (let i = 0; i < K.N; i += 18) { const [nx, ny] = K.nrm(i), sd = (i / 18) % 2 ? 1 : -1, x = K.P[i][0] + nx * sd * 19, y = K.P[i][1] + ny * sd * 19; s.push(`<path d="M${f(x)} ${f(y)}v-9" stroke="#2A1408" stroke-width="1.4"/><path d="M${f(x)} ${f(y - 9)}l7 2.2l-7 2.2z" fill="${COULEURS_J[(i / 18) % 4]}"/>`); }
    K.depart();
    // ================= 6. LE PALAIS DES SABLES (lobe gauche) =================
    { const px = 268, py = 528; K.prendre(px, py - 70, 165);
      s.push(`<ellipse cx="${px + 30}" cy="${py + 8}" rx="170" ry="30" fill="#3A1408" opacity=".45" filter="url(#d4-flou8)"/>`);
      s.push(`${G(px, py, .9)}
        <path d="M-150 6L-140 -40H140L150 6Z" fill="#B87A48" ${INK}/><path d="M-140 -40H140" stroke="#FFE0A8" stroke-width="2" opacity=".7"/>
        ${Array.from({ length: 15 }, (_, q) => `<rect x="${-138 + q * 19}" y="-48" width="10" height="9" fill="#C88A54" ${INK}/>`).join("")}
        <path d="M-100 -40V-110H100V-40Z" fill="url(#d4-pierre)" ${INK}/>${Array.from({ length: 9 }, (_, q) => `<path d="M${-88 + q * 22} -40v-34a9 9 0 0 1 18 0v34" fill="#3A1A0A" stroke="#2A1408"/><path d="M${-85 + q * 22} -40v-30a6 6 0 0 1 12 0v30" fill="#FFB347" opacity="${q % 3 ? .55 : .85}"/>`).join("")}
        <path d="M-70 -110V-150H70V-110Z" fill="#E2AE72" ${INK}/><path d="M-70 -150H70" stroke="#FFF0C8" stroke-width="2"/>
        <path d="M-56 -150Q-56 -206 0 -214Q56 -206 56 -150Z" fill="url(#d4-or)" ${INK}/><path d="M-30 -160Q-28 -196 0 -204" stroke="#FFF6D8" stroke-width="3" fill="none" opacity=".6"/><path d="M0 -214V-236" stroke="#2A1408" stroke-width="2"/><circle cy="-238" r="4" fill="#FFE6A8" ${INK}/>
        ${[-120, 120].map(u => `<path d="M${u - 13} -40V-176L${u} -196L${u + 13} -176V-40Z" fill="#D49A62" ${INK}/><path d="M${u - 13} -176H${u + 13}" stroke="#FFE0A8" stroke-width="1.6"/><rect x="${u - 4}" y="-160" width="8" height="12" rx="4" fill="#FFB347"/><rect x="${u - 4}" y="-120" width="8" height="12" rx="4" fill="#FFB347" opacity=".7"/>`).join("")}
        <path d="M-22 6V-30a22 22 0 0 1 44 0V6Z" fill="#2A1408"/><path d="M-16 6V-28a16 16 0 0 1 32 0V6Z" fill="#FFC86A" opacity=".8"/>
        <path d="M-150 -6H150" stroke="#8A5530" stroke-width="2" opacity=".6"/>
        ${[-150, -128, 128, 150].map((u, q) => `<path d="M${u} 6q${q < 2 ? -2 : 2} -26 ${q < 2 ? 4 : -4} -46" stroke="#6A4A2A" stroke-width="3" fill="none"/>${[0, 1, 2, 3, 4, 5].map(z => `<path d="M${u + (q < 2 ? 4 : -4)} -40q${(z - 2.5) * 7} -8 ${(z - 2.5) * 12} ${2 + Math.abs(z - 2.5) * 3}" stroke="#3E8A3E" stroke-width="3" fill="none" stroke-linecap="round"/>`).join("")}`).join("")}
        <path d="M-60 12h120l10 14h-140z" fill="#E8C690" ${INK}/><path d="M-50 16h100" stroke="#3AA6C8" stroke-width="4"/></g>`);
      [[-108, -139], [108, -139], [0, -54]].forEach(([u, v]) => K.halo(px + u, py + v, 20, "#FFB347", .6)); K.halo(px, py - 135, 66, "#FFD88A", .35);
      a.push(`<g opacity=".9">${an(`<animate attributeName="opacity" values=".9;.45;.85;.55;.9" dur="3.6s" repeatCount="indefinite"/>`)}${[-66, -22, 22, 66].map(u => `<circle cx="${f(px + u * .9)}" cy="${f(py - 50)}" r="3.6" fill="#FFE8B0"/>`).join("")}</g>`);
      // l'étendard à l'épervier (dessin maison) qui claque au vent
      a.push(`<g transform="translate(${f(px)} ${f(py - 213)})"><path d="M0 0v-2" stroke="#2A1408"/><path d="M1 -2h26l-4 7l4 7h-26z" fill="#2E7A4A" stroke="#2A1408" stroke-width=".8">${an(`<animateTransform attributeName="transform" type="skewY" values="0;8;-4;0" dur="1.6s" repeatCount="indefinite"/>`)}</path></g>`);
      lab(px, py + 40, "le palais des sables", 13); }
    // ================= 7. LA CITADELLE NOIRE (lobe droit) : un bloc géométrique sans fenêtre, des feux rouges, la garde en vol =================
    { const cx = 822, cy = 548; K.prendre(cx, cy - 70, 130);
      s.push(`<ellipse cx="${cx + 40}" cy="${cy + 6}" rx="180" ry="36" fill="#120806" opacity=".6" filter="url(#d4-flou8)"/><ellipse cx="${cx}" cy="${cy}" rx="130" ry="20" fill="#241812" opacity=".85"/>`);
      s.push(`${G(cx, cy, 1)}
        <path d="M-118 0L-90 -150L-40 -196H40L90 -150L118 0Z" fill="url(#d4-noir)" stroke="#000" stroke-width="2"/>
        <path d="M-40 -196L-50 0M40 -196L50 0M-90 -150L-96 0M90 -150L96 0" stroke="#3E3C48" stroke-width="1.6"/><path d="M-118 0L-90 -150L-40 -196H40" stroke="#8A8498" stroke-width="2" fill="none" opacity=".7"/>
        <path d="M-12 -196L0 -250L12 -196Z" fill="#14141A" stroke="#000"/><path d="M-62 -176L-70 -214L-52 -180Z" fill="#14141A" stroke="#000"/><path d="M62 -176L70 -214L52 -180Z" fill="#14141A" stroke="#000"/>
        ${Array.from({ length: 7 }, (_, q) => `<rect x="${-84 + q * 26}" y="${-46 - (q % 2) * 40}" width="12" height="3" fill="#FF3A2A"/>`).join("")}${Array.from({ length: 5 }, (_, q) => `<rect x="${-48 + q * 22}" y="-128" width="9" height="2.6" fill="#FF3A2A" opacity=".85"/>`).join("")}
        <path d="M-134 2h268l-14 14h-240z" fill="#18161A" stroke="#000"/><rect x="-30" y="-40" width="60" height="40" fill="#0A0606"/><rect x="-25" y="-35" width="50" height="35" fill="#FF6A1E" opacity=".75"/><path d="M-25 -22h50M-25 -10h50" stroke="#1A0A06" stroke-width="2.4"/>
        <path d="M-96 -70h-40v8h40z M-136 -70l-18 -8v24l18 -8z" fill="#22222A" stroke="#000"/><circle cx="-146" cy="-66" r="2.4" fill="#FF3A2A"/></g>`);
      K.halo(cx, cy - 18, 70, "#FF6A1E", .55); K.halo(cx, cy - 250, 30, "#FF3A2A", .55);
      a.push(`<g>${an(`<animate attributeName="opacity" values="1;.2;1;1" keyTimes="0;.1;.2;1" dur="2.6s" repeatCount="indefinite"/>`)}<circle cx="${cx}" cy="${cy - 248}" r="3.4" fill="#FF2A2A"/><circle cx="${cx - 69}" cy="${cy - 212}" r="2.4" fill="#FF2A2A"/><circle cx="${cx + 69}" cy="${cy - 212}" r="2.4" fill="#FF2A2A"/></g>`);
      for (let q = 0; q < 2; q++) { const d = (5.5 + q).toFixed(1); let g = ""; for (let k = 0; k < 4; k++) g += `<circle cx="${f(cx - 40 + q * 70 + (r() - .5) * 16)}" cy="${f(cy - 150 - k * 15)}" r="${f(10 + k * 5)}" fill="#1A1416" opacity="${(.55 - k * .1).toFixed(2)}"/>`;
        a.push(`<g opacity="${K.anime ? 0 : .7}">${an(`<animateTransform attributeName="transform" type="translate" values="0 10;${30 + q * 10} -80" dur="${d}s" begin="${(q * 2).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" dur="${d}s" begin="${(q * 2).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
      lab(cx, cy + 40, "la citadelle noire", 13, "#FFD0C0"); }
    // ================= 8. LE VER DES SABLES : il jaillit derrière la piste du bas, passe en arc par-dessus, se dresse au centre =================
    const CL = [[652, 716], [632, 632], [585, 550], [515, 474], [458, 404], [444, 342], [470, 296], [516, 268]];
    const crs = t => { const n = CL.length - 1, u = Math.max(0, Math.min(n - 1e-6, t * n)), i = Math.floor(u), q = u - i, p0 = CL[Math.max(0, i - 1)], p1 = CL[i], p2 = CL[i + 1], p3 = CL[Math.min(n, i + 2)];
      const c = (a0, b, c2, d) => .5 * (2 * b + (-a0 + c2) * q + (2 * a0 - 5 * b + 4 * c2 - d) * q * q + (-a0 + 3 * b - 3 * c2 + d) * q * q * q); return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]; };
    const tg = t => { const p = crs(Math.max(0, t - .01)), q = crs(Math.min(1, t + .01)), l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
    const wd = t => 108 + 30 * t;
    const bord = (t, k) => { const [x, y] = crs(t), [tx, ty] = tg(t), w = wd(t) / 2 * k; return [x - ty * w, y + tx * w]; };   // k = +1 : flanc gauche (au soleil), −1 : flanc droit
    const bande = (t0, t1, k0, k1) => { let d = ""; for (let i = 0; i <= 30; i++) { const t = t0 + (t1 - t0) * i / 30, p = bord(t, k0); d += (i ? "L" : "M") + f(p[0]) + " " + f(p[1]); } for (let i = 30; i >= 0; i--) { const t = t0 + (t1 - t0) * i / 30, p = bord(t, k1); d += `L${f(p[0])} ${f(p[1])}`; } return d + "Z"; };
    const corps = (t0, t1) => { let g = `<path d="${bande(t0, t1, 1, -1)}" fill="#B88458" stroke="#2A1408" stroke-width="2"/><path d="${bande(t0, t1, -1, -.3)}" fill="#E8C08A"/><path d="${bande(t0, t1, -.95, -.7)}" fill="#FFE2B0" opacity=".55"/><path d="${bande(t0, t1, .25, 1)}" fill="#6A4028"/><path d="${bande(t0, t1, .7, 1)}" fill="#3E2416" opacity=".7"/>`;
      // les anneaux : arcs bombés vers la queue, un sur trois plus marqué ; plaques alternées
      const n = 34; for (let i = 0; i <= n; i++) { const t = i / n; if (t < t0 - 1e-6 || t > t1 + 1e-6) continue; const p = bord(t, -1), q = bord(t, 1), [x, y] = crs(t), [tx, ty] = tg(t), w = wd(t);
        g += `<path d="M${f(p[0])} ${f(p[1])}Q${f(x - tx * w * .3)} ${f(y - ty * w * .3)} ${f(q[0])} ${f(q[1])}" fill="none" stroke="#2A1408" stroke-width="${i % 3 ? 1.2 : 2.6}" opacity=".75"/><path d="M${f(p[0] + tx * 3)} ${f(p[1] + ty * 3)}Q${f(x - tx * w * .3 + tx * 3)} ${f(y - ty * w * .3 + ty * 3)} ${f((p[0] + q[0]) / 2 + tx * 3)} ${f((p[1] + q[1]) / 2 + ty * 3)}" fill="none" stroke="#FFF0D0" stroke-width="1.2" opacity=".5"/>`; }
      return g; };
    // l'ombre du ver couchée sur le sable (vers la droite, loin du soleil) et le sillon d'approche
    s.push(`<path d="M${f(CL[0][0] - 50)} ${H}Q${f(CL[2][0] + 120)} ${f(CL[2][1] + 30)} ${f(CL[4][0] + 150)} ${f(CL[4][1] + 40)}L${f(CL[4][0] + 200)} ${f(CL[4][1] + 70)}Q${f(CL[2][0] + 180)} ${f(CL[2][1] + 70)} ${f(CL[0][0] + 80)} ${H}Z" fill="#2A0A14" opacity=".35" filter="url(#d4-flou8)"/>`);
    s.push(`<path d="M${W - 200} ${H + 10}Q${W - 280} ${H - 30} ${f(CL[0][0] + 40)} ${H - 20}" fill="none" stroke="#7A3A22" stroke-width="40" opacity=".3" filter="url(#d4-flou8)"/>`);
    // le tourbillon de sable à la base, où la moissonneuse est en train de sombrer
    const BX = CL[0][0] - 6, BY = 694, VX = 560, VY = 668;
    s.push(`<ellipse cx="${VX}" cy="${VY + 6}" rx="178" ry="50" fill="#8A4A26" opacity=".9"/><ellipse cx="${VX}" cy="${VY + 4}" rx="150" ry="38" fill="#5A2A14"/><ellipse cx="${VX + 10}" cy="${VY + 8}" rx="70" ry="16" fill="#1A0804"/>`);
    a.push(`<g transform="translate(${VX} ${VY + 4}) scale(1 .26)"><g>${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="9s" repeatCount="indefinite"/>`)}${Array.from({ length: 6 }, (_, q) => `<path d="M${130 - q * 6} 0A${130 - q * 6} ${130 - q * 6} 0 0 0 ${f(-(60 - q * 6))} ${f(100 - q * 10)}" fill="none" stroke="${q % 2 ? "#E8B678" : "#B8743E"}" stroke-width="${10 - q}" opacity=".85" transform="rotate(${q * 60})"/>`).join("")}</g></g>`);
    // la moissonneuse d'épice, basculée au bord du tourbillon (chenilles en l'air), l'épice qui fuse
    { const hx = VX - 92, hy = VY - 8;
      K.prendre(hx, hy - 20, 95); K.prendre(VX + 40, VY, 120); s.push(`<ellipse cx="${hx - 30}" cy="${hy - 10}" rx="110" ry="50" fill="url(#d4-epice)"/>`);
      s.push(`${G(hx, hy, 1.05, 22)}<ellipse cx="4" cy="22" rx="70" ry="10" fill="#2A0A06" opacity=".4"/><path d="M-60 14h120l8 -10v-12h-136v12z" fill="#3A342C" ${INK}/>${Array.from({ length: 11 }, (_, q) => `<rect x="${-56 + q * 11}" y="6" width="7" height="8" rx="1.5" fill="#1A1814"/>`).join("")}
        <path d="M-56 -8V-46L-30 -60H40L58 -40V-8Z" fill="url(#d4-metal)" ${INK}/><path d="M-50 -30h100M-50 -18h100" stroke="#3A342C" stroke-width="1.4"/><rect x="-20" y="-54" width="40" height="14" rx="2" fill="#1A2A3A" ${INK}/><rect x="-16" y="-51" width="32" height="7" fill="#7AC8F0" opacity=".7"/>
        <path d="M58 -40L92 -60L98 -50L62 -26Z" fill="#8A8070" ${INK}/><path d="M-56 -36l-24 -14v26l24 6z" fill="#6A6458" ${INK}/>${[-40, -10, 20].map(u => `<path d="M${u} -60v-16h8v16" fill="#4A443C" stroke="#2A1408"/>`).join("")}</g>`);
      for (let q = 0; q < 2; q++) { const d = (2.6 + q * .6).toFixed(1); let g = ""; for (let k = 0; k < 6; k++) g += `<circle cx="${f(hx - 30 + (r() - .5) * 30)}" cy="${f(hy - 50 - k * 12)}" r="${f(6 + k * 3)}" fill="${k % 2 ? "#FF8A3A" : "#E8B678"}" opacity="${(.7 - k * .08).toFixed(2)}"/>`;
        a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animateTransform attributeName="transform" type="translate" values="0 10;${-10 - q * 10} -60" dur="${d}s" begin="${(q * 1.3).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="${d}s" begin="${(q * 1.3).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
      s.push(`<path d="M${VX - 178} ${VY + 6}A178 50 0 0 0 ${VX + 178} ${VY + 6}A160 30 0 0 1 ${VX - 178} ${VY + 6}Z" fill="#E8B678"/><path d="M${VX - 170} ${VY + 14}A170 44 0 0 0 ${VX + 170} ${VY + 14}" fill="none" stroke="#FFE2B0" stroke-width="2" opacity=".6"/>`);
      lab(VX - 70, VY + 46, "la moissonneuse avalée", 11); }
    // gerbe de sable à la base (dôme soulevé, rideaux qui retombent)
    { s.push(`<ellipse cx="${BX + 6}" cy="${BY - 8}" rx="${f(wd(0) * .85)}" ry="22" fill="#C88A4E"/><ellipse cx="${BX}" cy="${BY - 12}" rx="${f(wd(0) * .7)}" ry="16" fill="#F2CC92"/>`); }
    // le corps entier, sa peau rugueuse et le liseré du couchant
    s.push(corps(0, 1));
    { let g = ""; for (let k = 0; k < 46; k++) { const t = .04 + r() * .92, [x, y] = crs(t), [tx, ty] = tg(t), u = (r() - .5) * 1.5, w = wd(t) / 2 * u; g += `<ellipse cx="${f(x - ty * w)}" cy="${f(y + tx * w)}" rx="${f(2 + r() * 4)}" ry="${f(1.2 + r() * 2)}" fill="${u < 0 ? "#B8845A" : "#2A1408"}" opacity="${u < 0 ? .5 : .35}" transform="rotate(${f(Math.atan2(ty, tx) * 57.3 + 90)} ${f(x - ty * w)} ${f(y + tx * w)})"/>`; }
      let d = ""; for (let i = 0; i <= 40; i++) { const p = bord(i / 40, -.93); d += (i ? "L" : "M") + f(p[0]) + " " + f(p[1]); } s.push(g + `<path d="${d}" fill="none" stroke="#FFEFC8" stroke-width="3.4" opacity=".7" stroke-linecap="round"/>`); }
    // le sable qui ruisselle du ventre sur la piste (rideaux fixes) et des flancs
    for (let k = 0; k < 10; k++) { const t = .18 + k * .045, p = bord(t, 1), L = 30 + r() * 40; s.push(`<path d="M${f(p[0])} ${f(p[1])}q${f(6 + r() * 6)} ${f(L * .4)} ${f(4 + r() * 6)} ${f(L)}" stroke="#F2CC92" stroke-width="${f(3 + r() * 4)}" fill="none" opacity=".75" stroke-linecap="round"/>`); }
    for (let k = 0; k < 18; k++) { const sd = k % 2 ? 1 : -1, u = 30 + r() * 60, x = BX + sd * u, y = BY - 14 - r() * (70 - u * .5), R = 10 + r() * 14; s.push(`<circle cx="${f(x + 4)}" cy="${f(y + 4)}" r="${f(R)}" fill="#A8643A" opacity=".4"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${r() < .5 ? "#F2CC92" : "#E8B678"}" opacity=".85"/>`); }
    // ================= la gueule : collerette charnue en pétales, couronnes de dents, gorge sans fond =================
    const [hx0, hy0] = crs(1), [utx, uty] = tg(1), MX = hx0 + utx * 6, MY = hy0 + uty * 6, RX = 86, RY = 70, ROT = -12;
    K.prendre(MX, MY, 110);
    s.push(`<ellipse cx="${f(MX + 8)}" cy="${f(MY + 12)}" rx="${RX + 22}" ry="${RY + 18}" fill="#2A0A06" opacity=".35" filter="url(#d4-flou8)" transform="rotate(${ROT} ${f(MX)} ${f(MY)})"/>`);
    { let d = ""; const n = 16; for (let k = 0; k <= n; k++) { const t0 = k / n * TAU, t1 = (k + .5) / n * TAU; const p = [Math.cos(t0) * (RX + 14), Math.sin(t0) * (RY + 12)], q = [Math.cos(t1) * (RX + 26), Math.sin(t1) * (RY + 22)]; d += (k ? "Q" + f(q[0]) + " " + f(q[1]) + " " : "M") + f(p[0]) + " " + f(p[1]); }
      s.push(`${G(MX, MY, 1, ROT)}<path d="${d}Z" fill="#C89466" stroke="#2A1408" stroke-width="2"/>${Array.from({ length: 16 }, (_, k) => { const t = (k + .5) / 16 * TAU; return `<path d="M${f(Math.cos(t) * (RX + 2))} ${f(Math.sin(t) * (RY + 2))}L${f(Math.cos(t) * (RX + 22))} ${f(Math.sin(t) * (RY + 18))}" stroke="#7A4A2A" stroke-width="1.4" opacity=".7"/>`; }).join("")}
        <ellipse rx="${RX + 6}" ry="${RY + 5}" fill="#9A3A2A" stroke="#2A1408" stroke-width="1.6"/><ellipse rx="${RX}" ry="${RY}" fill="url(#d4-gorge)"/>
        ${[.86, .66, .46].map(k => `<ellipse rx="${f(RX * k)}" ry="${f(RY * k)}" fill="none" stroke="#2A0404" stroke-width="3" opacity=".55"/>`).join("")}
        <path d="M${-RX - 10} ${-RY * .2}Q${-RX * .6} ${-RY - 18} 0 ${-RY - 14}" stroke="#FFF0D0" stroke-width="5" fill="none" opacity=".45" stroke-linecap="round"/></g>`); K.halo(MX, MY, 70, "#FF5A2A", .3); }
    a.push(`${G(MX, MY, 1, ROT)}` + [[.97, 30, 13, 80], [.74, 24, 11, -60], [.52, 18, 9, 44], [.32, 12, 7, -30]].map(([k, n, L, du]) => { let d = ""; for (let q = 0; q < n; q++) { const t = q / n * TAU, x = Math.cos(t) * RX * k, y = Math.sin(t) * RY * k, ix = -Math.cos(t), iy = -Math.sin(t) * RY / RX, px = -iy * L * .3, py = ix * L * .3;
        d += `M${f(x + px)} ${f(y + py)}L${f(x + ix * L)} ${f(y + iy * L)}L${f(x - px)} ${f(y - py)}Z`; }
      return `<g transform="scale(1 ${f(RY / RX * 1.0)})"><path d="${d}" transform="scale(1 ${f(RX / RY)})" fill="#F6EEDC" stroke="#8A7A6A" stroke-width=".5">${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="${du > 0 ? 360 : -360}" dur="${Math.abs(du)}s" additive="sum" repeatCount="indefinite"/>`)}</path></g>`; }).join("") + `<ellipse rx="${f(RX * .16)}" ry="${f(RY * .16)}" fill="#000"/></g>`);
    // reflets bleus de cristal dans les dents
    a.push(`<g opacity=".8">${an(`<animate attributeName="opacity" values=".2;.9;.2" dur="3s" repeatCount="indefinite"/>`)}${Array.from({ length: 8 }, (_, q) => { const t = q / 8 * TAU + .3; return `<circle cx="${f(MX + Math.cos(t) * RX * .8)}" cy="${f(MY + Math.sin(t) * RY * .8)}" r="2" fill="#BFF0FF"/>`; }).join("")}</g>`);
    // le sable qui ruisselle de la collerette (coulées) et retombe en nuées
    for (let k = 0; k < 12; k++) { const t = .15 * PI + k / 12 * .7 * PI, x = MX + Math.cos(t) * (RX + 14), y = MY + Math.sin(t) * (RY + 10); s.push(`<path d="M${f(x)} ${f(y)}q${f((r() - .5) * 8)} ${f(20 + r() * 10)} ${f((r() - .5) * 10)} ${f(40 + r() * 50)}" stroke="#F2CC92" stroke-width="${f(2.5 + r() * 3.5)}" fill="none" opacity=".75" stroke-linecap="round"/>`); }
    for (let q = 0; q < 4; q++) { const d = (2 + q * .35).toFixed(2); let g = ""; for (let k = 0; k < 16; k++) { const t = q < 2 ? r() * PI : .2 + r() * .4, x = q < 2 ? MX + Math.cos(t) * (RX + 10 + r() * 16) : bord(t, 1)[0] + r() * 10, y = q < 2 ? MY + Math.sin(t) * (RY + 8) : bord(t, 1)[1]; g += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r() * 2)}" fill="#F8DCA8"/>`; }
      a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animateTransform attributeName="transform" type="translate" values="0 -4;${q * 3 - 4} 80" dur="${d}s" begin="${(q * .6).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.95;0" dur="${d}s" begin="${(q * .6).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ================= le cavalier des sables, debout sur le dos, ses deux crochets plantés =================
    const RID = (() => { const t = .3, p = bord(t, .05); return [p[0], p[1] - 6]; })();
    const cav = (x, y) => `${G(x, y, 2.2)}<path d="M-14 -2L-20 -30M14 -2L22 -32" stroke="#4A3020" stroke-width="2"/><path d="M-20 -30q-6 -2 -6 4M22 -32q6 -2 6 4" stroke="#C8C0B0" stroke-width="1.6" fill="none"/><path d="M-14 -2l2 -4M14 -2l-2 -4" stroke="#C8C0B0" stroke-width="1.6"/>
      <path d="M-5 0L-3 -12M5 0L3 -12" stroke="#3A2E26" stroke-width="3" stroke-linecap="round"/><path d="M-6 -11L-5 -28Q0 -32 5 -28L6 -11Z" fill="#5A4A3C" ${INK}/><path d="M-5 -24L-18 -29M5 -24L20 -31" stroke="#5A4A3C" stroke-width="3" stroke-linecap="round"/>
      <circle cx="0" cy="-32" r="4.4" fill="#4A3A2E" ${INK}/><path d="M-2.4 -32.5h1.6M.8 -32.5h1.6" stroke="#7CD0FF" stroke-width="1.2"/></g>`;
    s.push(`<ellipse cx="${f(RID[0] + 4)}" cy="${f(RID[1] + 1)}" rx="16" ry="4" fill="#2A1408" opacity=".4"/>`);
    s.push(cav(RID[0], RID[1]));
    const CAPE = `${G(RID[0], RID[1], 2.2)}<path d="M-5 -26Q-16 -22 -26 -14Q-20 -18 -12 -14Q-18 -10 -22 -4Q-12 -10 -6 -12Z" fill="#8A6A4A" stroke="#2A1408" stroke-width=".6">${an(`<animateTransform attributeName="transform" type="skewY" values="0;6;-3;0" dur="1s" repeatCount="indefinite"/>`)}</path></g>`; a.push(CAPE);
    lab(MX + RX + 70, MY + 18, "le ver des sables", 16);
    bulle(RID[0] - 70, RID[1] - 96, "Accroche-toi !", 9, 1);
    // ================= 9. le marteleur et les 4 marcheurs (aux couleurs des pilotes) dans le coin bas gauche =================
    { const tx = 120, ty = 672; K.prendre(tx + 70, ty - 10, 100);
      s.push(`<ellipse cx="${tx}" cy="${ty + 6}" rx="14" ry="4" fill="#000" opacity=".3"/><path d="M${tx} ${ty + 4}v-22" stroke="#3A2E26" stroke-width="3"/><rect x="${tx - 5}" y="${ty - 30}" width="10" height="10" rx="2" fill="#6A5A4A" ${INK}/>`);
      a.push(`<g transform="translate(${tx} ${ty + 4})"><ellipse rx="10" ry="3" fill="none" stroke="#FFF2D6" stroke-width="1.6" opacity="${K.anime ? 0 : .6}">${an(`<animate attributeName="rx" values="8;80" dur="2s" repeatCount="indefinite"/><animate attributeName="ry" values="2.4;24" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="2s" repeatCount="indefinite"/>`)}</ellipse></g>`);
      COULEURS_J.forEach((c, k) => { const u = tx + 50 + k * 30, v = ty + (k % 2) * 6; s.push(`${G(u, v, 1.7)}<ellipse cx="2" cy="1" rx="5" ry="1.6" fill="#000" opacity=".3"/><path d="M-3.4 0L-3 -12Q0 -16 3 -12L3.4 0Z" fill="#6A5442" ${INK}/><circle cx="0" cy="-14" r="3" fill="#5A4636" ${INK}/><path d="M-3 -11q-7 1 -10 5q5 -1 7 1z" fill="${c}" stroke="#2A1408" stroke-width=".5"/><path d="M-1.4 -14.4h1M.6 -14.4h1" stroke="#7CD0FF" stroke-width=".9"/><path d="M4 -6l2 6" stroke="#2A1408" stroke-width="1"/></g>`); });
      lab(tx + 90, ty + 34, "les marcheurs", 10); }
    // ================= 10. le cartouche des 4 pilotes (en haut à droite) : vrais portraits posés par l'appli =================
    const PORTR = [];
    { const pw = 252, ph = 118, px = W - pw - 10, py = 8, NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
      s.push(`<rect x="${px + 3}" y="${py + 4}" width="${pw}" height="${ph}" rx="12" fill="#000" opacity=".4"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="#2A1620" stroke="url(#d4-or)" stroke-width="2.6" opacity=".97"/><rect x="${px + 5}" y="${py + 5}" width="${pw - 10}" height="${ph - 10}" rx="9" fill="none" stroke="#E8A84A" stroke-width=".8" opacity=".6"/>`);
      s.push(`<text x="${px + pw / 2}" y="${py + 19}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#F8D49A">« Le sable n'oublie personne. »</text>`);
      COULEURS_J.forEach((c, k) => { const x = px + 36 + k * 60, y = py + 60; PORTR.push({ k, x, y, r: 20 });
        s.push(`${G(x, y, 1)}<path d="M-26 14Q-28 -26 0 -28Q28 -26 26 14Q20 26 0 26Q-20 26 -26 14Z" fill="#6A5442" stroke="#2A1408" stroke-width="1.2"/><path d="M-24 10Q-26 -22 0 -24" stroke="#9A8068" stroke-width="1.4" fill="none"/><circle r="21" fill="#1A0E14" stroke="${c}" stroke-width="2.2"/><path d="M-20 18Q0 30 20 18L22 26H-22Z" fill="${c}" stroke="#2A1408" stroke-width=".8"/></g>`);
        s.push(`<text x="${x}" y="${py + 106}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10.5" fill="${c}">${NOMS[k]}</text>`);
        a.push(`<circle cx="${x}" cy="${y}" r="23" fill="none" stroke="#7CD0FF" stroke-width="2" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.25;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/>`)}</circle>`); }); }
    for (let i = 0; i <= 20; i++) { const [x, y] = crs(i / 20); K.prendre(x, y, wd(i / 20) * .6); }
    // ---- rochers épars, épice orange fixe, épice bleue qui scintille
    K.semis(22, () => 5 + r() * 9, 2000, (x, y) => y > hz(x) + 14 && x < W - 140, (x, y, Rr) => { K.ombre(x + Rr * .5, y + Rr * .4, Rr * 1.1, Rr * .6, .4); s.push(`<path d="M${f(x - Rr)} ${f(y + Rr * .3)}Q${f(x - Rr * .8)} ${f(y - Rr * .8)} ${f(x)} ${f(y - Rr * .7)}Q${f(x + Rr)} ${f(y - Rr * .5)} ${f(x + Rr)} ${f(y + Rr * .3)}Z" fill="url(#d4-pierre)" stroke="#2A1408" stroke-width=".8"/>`); });
    for (let k = 0; k < 80; k++) { const x = r() * W, y = r() * H; if (y > hz(x) + 6) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8 + r() * 1.2)}" fill="#FF8A3A" opacity="${(.4 + r() * .4).toFixed(2)}"/>`); }
    a.push(`<defs><radialGradient id="d4-pb" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#5AC8FF" stop-opacity=".9"/><stop offset="1" stop-color="#2A7AFF" stop-opacity="0"/></radialGradient></defs>`);
    for (let q = 0; q < 3; q++) { let g = ""; for (let k = 0; k < 18; k++) { const x = r() * W, y = r() * H; if (y > hz(x) + 6) g += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 3)}" fill="url(#d4-pb)"/>`; } a.push(`<g opacity="${K.anime ? 0 : .45}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.2;.45;1" dur="4.5s" begin="${(q * 1.5).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ---- l'orage : voiles qui roulent, éclair
    for (let q = 0; q < 2; q++) { let g = ""; for (let k = 0; k < 6; k++) { const y = 60 + r() * (H - 80); g += `<ellipse cx="${f(W - 30 - r() * 40 - Math.max(0, y - 520) * .9)}" cy="${f(y)}" rx="${f(60 + r() * 50)}" ry="${f(14 + r() * 10)}" fill="#A86A5A" opacity=".3"/>`; } a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-40 ${q ? 20 : -20};0 0" dur="${8 + q * 3}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    a.push(`<g opacity="${K.anime ? 0 : .9}">${an(`<animate attributeName="opacity" values="0;0;1;0;.8;0;0" keyTimes="0;.6;.62;.64;.66;.7;1" dur="5.5s" repeatCount="indefinite"/>`)}<path d="M${W - 18} 236l-14 26l10 -3l-16 30l22 -34l-10 3l10 -22z" fill="#F0E0FF"/><circle cx="${W - 24}" cy="266" r="40" fill="#C8B0FF" opacity=".25"/><path d="M${W - 70} 610l-10 20l8 -2l-12 24l17 -27l-8 2l7 -17z" fill="#F0E0FF"/></g>`);
    // ---- voiles de sable qui dérivent (vent)
    for (let q = 0; q < 2; q++) { let g = ""; for (let k = 0; k < 5; k++) { const x = r() * W, y = 200 + r() * (H - 220); g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(70 + r() * 70)}" ry="${f(5 + r() * 5)}" fill="#FFE8C0" opacity=".16" transform="rotate(-8 ${f(x)} ${f(y)})"/>`; } a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="-30 0;50 ${q ? -8 : 8};-30 0" dur="${14 + q * 5}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ================= l'escadrille : 4 ornithoptères aux couleurs des pilotes, autour du ver =================
    { const p = `M${f(K.cx - 330)} ${f(K.cy + 20)}C${f(K.cx - 330)} ${f(K.cy - 150)} ${f(K.cx + 330)} ${f(K.cy - 150)} ${f(K.cx + 330)} ${f(K.cy + 20)}C${f(K.cx + 330)} ${f(K.cy + 160)} ${f(K.cx - 330)} ${f(K.cy + 160)} ${f(K.cx - 330)} ${f(K.cy + 20)}`;
      a.push(`<g${K.anime ? "" : ` transform="translate(${f(K.cx + 220)} ${f(K.cy - 60)}) rotate(14)"`}>${an(`<animateMotion dur="24s" repeatCount="indefinite" rotate="auto" path="${p}"/>`)}` + COULEURS_J.map((c, k) => `<g transform="translate(${[0, -34, -34, -68][k]} ${[0, -24, 24, 0][k]}) scale(1.7)"><ellipse cx="1" cy="3" rx="12" ry="3" fill="#000" opacity=".2"/><ellipse cx="0" cy="0" rx="12" ry="3.8" fill="#9A9284" stroke="#2A2420" stroke-width=".8"/><path d="M-12 0l-7 -2.4v4.8z" fill="#5A544A"/><circle cx="9" cy="0" r="3" fill="#BFE8FF" stroke="#2A2420" stroke-width=".5"/><circle cx="-5" cy="0" r="2.4" fill="${c}"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .15;1 1" dur="${(.18 + k * .02).toFixed(2)}s" repeatCount="indefinite"/>`)}<path d="M-2 0l-8 -19h7l6 19zM-2 0l-8 19h7l6 -19zM6 0l-4 -15h6l3 15zM6 0l-4 15h6l3 -15z" fill="#EEE6D2" opacity=".85" stroke="#8A8270" stroke-width=".4"/></g></g>`).join("") + `</g>`); }
    // la garde noire de la citadelle : deux ornithoptères sombres en ronde
    { const cx = 822, cy = 548; a.push(`<g${K.anime ? "" : ` transform="translate(${cx + 90} ${cy - 210})"`}>${an(`<animateMotion dur="10s" repeatCount="indefinite" rotate="auto" path="M${cx + 100} ${cy - 170}a100 40 0 1 1 -200 0a100 40 0 1 1 200 0"/>`)}${[0, 30].map(o => `<g transform="translate(${-o} ${o * .4}) scale(1.4)"><ellipse rx="10" ry="3.2" fill="#18181E" stroke="#000"/><circle cx="7" r="2" fill="#FF3A2A"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .2;1 1" dur=".2s" repeatCount="indefinite"/>`)}<path d="M-2 0l-7 -15h6l5 15zM-2 0l-7 15h6l5 -15z" fill="#4A4652" opacity=".85"/></g></g>`).join("")}</g>`); }
    // ---- les 4 pilotes sur la piste : glisseurs des sables aux couleurs des 4
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `<g><ellipse cx="-9" cy="0" rx="7" ry="3" fill="#F2CC92" opacity=".6"/><path d="M-6 -4h9l4 4l-4 4h-9z" fill="${c}" stroke="#2A1408" stroke-width=".8"/><circle cx="2" cy="0" r="2" fill="#FFF2D6"/></g>`, 40, k * 1.2)));
    // le ver passe PAR-DESSUS la piste : on redessine le pont de son corps au-dessus des glisseurs
    { let t0 = 1, t1 = 0; for (let i = 0; i <= 100; i++) { const t = i / 100, [x, y] = crs(t); if (K.dT(x, y) < wd(t) / 2 + 22) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); } }
      if (t1 > t0) a.push(`<g>${corps(Math.max(0, t0 - .02), Math.min(.7, t1 + .02))}</g>`); a.push(cav(RID[0], RID[1])); a.push(CAPE); }
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#E8A060"/>`, "#FF7A2A", .08); RES.portraits = PORTR; RES.lieux = { ver: [Math.round(MX), Math.round(MY)], base: [BX, BY], citadelle: [822, 360], palais: [268, 400] }; return RES;
  }

  /* ---------- Septembre · Multivers (une planète patchwork de mondes cousus entre eux) ----------
     Six mondes cousus autour de la citadelle du roi au masque de fer (le repère 3D, au centre du chapeau) :
     l'Espace (le titan violet et son gant aux 6 pierres), Asgard (cité d'or, pont arc-en-ciel, marteau, dieu farceur),
     le Wakanda (montagne de vibranium, chutes, panthère, train), le Sanctuaire (portail du sorcier), le monde quantique,
     Nouvelle-York (la tour, la toile, le géant vert). Les coutures orange croisent la piste par des portails. */
  function peindreMultivers(T, Z, def) {
  const K = kit(T, def, 909, "mv-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#140E1E" stroke-width="1.2"`;
  const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
  const [cx, cy] = K.rep((def.reperes && def.reperes[0]) || { t: "champignons" }), D2R = PI / 180;
  const FONTE = `font-family="'Arial Black', Impact, 'Helvetica Neue', sans-serif" font-weight="900"`;
  // bulle de bande dessinée (visible et figée si les animations sont coupées)
  const bulle = (x, y, txt, du, deb, fs, haut, dq) => { fs = fs || 14; const w = txt.length * fs * .64 + 16, xq = x + (dq || 0) * (w / 2 - 16), qy = haut ? y - fs - 2 : y + 7, sg = haut ? -1 : 1;
    a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.03;.05;.74;.77;1" dur="${du}s" begin="${-(deb || 0)}s" repeatCount="indefinite"/>`)}<rect x="${f(x - w / 2)}" y="${f(y - fs - 2)}" width="${f(w)}" height="${f(fs + 9)}" rx="10" fill="#FFFDF4" stroke="#140E1E" stroke-width="2"/><path d="M${f(xq - 5)} ${f(qy - sg * .6)}l1 ${8 * sg}l8 ${-8 * sg}" fill="#FFFDF4" stroke="#140E1E" stroke-width="1.4"/><path d="M${f(xq - 4.4)} ${f(qy - sg * 1.4)}h8" stroke="#FFFDF4" stroke-width="2.4"/><text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" ${FONTE} font-style="italic" font-size="${fs}" fill="#000">${txt}</text></g>`); };
  // étiquette d'un monde (ruban)
  const nomMonde = (x, y, txt, c, fz) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" ${FONTE} font-size="${fz || 17}" letter-spacing="${fz ? .4 : 1.2}" fill="${c}" stroke="#0A0614" stroke-width="${fz ? 6.5 : 5.5}" stroke-linejoin="round" paint-order="stroke">${txt.toUpperCase()}</text>`);
  // ---- dégradés
  s.push(`<radialGradient id="mv-g0" gradientUnits="userSpaceOnUse" cx="120" cy="90" r="640"><stop offset="0" stop-color="#3A1E6A"/><stop offset=".4" stop-color="#160E3A"/><stop offset="1" stop-color="#05040F"/></radialGradient>`);
  s.push(`<radialGradient id="mv-g1" gradientUnits="userSpaceOnUse" cx="990" cy="110" r="560"><stop offset="0" stop-color="#E8A84A"/><stop offset=".3" stop-color="#8A4A6A"/><stop offset=".65" stop-color="#2E1A50"/><stop offset="1" stop-color="#120C2A"/></radialGradient>`);
  s.push(`<radialGradient id="mv-g2" gradientUnits="userSpaceOnUse" cx="930" cy="560" r="520"><stop offset="0" stop-color="#E89A48"/><stop offset=".45" stop-color="#B0602A"/><stop offset="1" stop-color="#4A2414"/></radialGradient>`);
  s.push(`<radialGradient id="mv-g3" gradientUnits="userSpaceOnUse" cx="541" cy="560" r="260"><stop offset="0" stop-color="#9A2A3E"/><stop offset=".55" stop-color="#4A1226"/><stop offset="1" stop-color="#1E0810"/></radialGradient>`);
  s.push(`<radialGradient id="mv-g4" gradientUnits="userSpaceOnUse" cx="320" cy="545" r="420"><stop offset="0" stop-color="#4A1E8A"/><stop offset=".45" stop-color="#22105A"/><stop offset="1" stop-color="#0A0620"/></radialGradient>`);
  s.push(`<linearGradient id="mv-g5" gradientUnits="userSpaceOnUse" x1="0" y1="120" x2="0" y2="520"><stop offset="0" stop-color="#0E1638"/><stop offset=".6" stop-color="#22305A"/><stop offset="1" stop-color="#3A3A6A"/></linearGradient>`);
  s.push(`<linearGradient id="mv-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".35" stop-color="#F2C64A"/><stop offset=".75" stop-color="#B07A1E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
  s.push(`<linearGradient id="mv-acier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A6270"/><stop offset=".45" stop-color="#C8D0DA"/><stop offset="1" stop-color="#4A525E"/></linearGradient>`);
  s.push(`<linearGradient id="mv-pierre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A5462"/><stop offset=".45" stop-color="#8A96A4"/><stop offset="1" stop-color="#3A424E"/></linearGradient>`);
  s.push(`<linearGradient id="mv-verre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2A4A7A"/><stop offset=".4" stop-color="#8AC8F2"/><stop offset=".6" stop-color="#4A8AC8"/><stop offset="1" stop-color="#1A2E5A"/></linearGradient>`);
  s.push(`<linearGradient id="mv-fac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1A2444"/><stop offset=".5" stop-color="#34446E"/><stop offset="1" stop-color="#141C36"/></linearGradient>`);
  s.push(`<linearGradient id="mv-mont" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A4A8A"/><stop offset=".5" stop-color="#3A2456"/><stop offset="1" stop-color="#1E1230"/></linearGradient>`);
  s.push(`<linearGradient id="mv-wk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1E1A2E"/><stop offset=".45" stop-color="#4A3E66"/><stop offset="1" stop-color="#16121F"/></linearGradient>`);
  s.push(`<radialGradient id="mv-pl" r="50%"><stop offset="0" stop-color="#3E6A4A"/><stop offset=".7" stop-color="#1E3424"/><stop offset="1" stop-color="#0E1A12"/></radialGradient>`);
  s.push(`<radialGradient id="mv-porte" r="50%"><stop offset="0" stop-color="#2A4A9A"/><stop offset=".7" stop-color="#101A4A"/><stop offset="1" stop-color="#05081E"/></radialGradient>`);
  s.push(`<pattern id="mv-fen" width="7" height="9" patternUnits="userSpaceOnUse"><rect width="7" height="9" fill="none"/><rect x="1.5" y="2" width="3" height="4" fill="#FFD98A" opacity=".75"/></pattern>`);
  s.push(`<pattern id="mv-fen2" width="7" height="9" patternUnits="userSpaceOnUse" x="3" y="4"><rect x="1.5" y="2" width="3" height="4" fill="#0A1024" opacity=".7"/></pattern>`);
  // ---- 1. les six mondes : secteurs autour de la citadelle, séparés par des coutures
  const BORD = [-165, -62, -8, 62, 112, 150];
  const couture = i => { const pts = [], t = BORD[i] * D2R, ux = Math.cos(t), uy = Math.sin(t); for (let d = 90; d <= 1000; d += 14) { const o = (12 * Math.sin(d / 40 + i * 2.1) + 5 * Math.sin(d / 11 + i * 1.3)) * Math.min(1, (d - 90) / 60) - (i === 0 ? 110 * Math.min(1, Math.max(0, (d - 380) / 150)) ** 1.5 : 0); pts.push([cx + ux * d - uy * o, cy + uy * d + ux * o]); } return pts; };
  const COUT = BORD.map((_, i) => couture(i));
  const secteur = k => { const A = COUT[k], B = COUT[(k + 1) % 6], a0 = BORD[k], a1 = k === 5 ? BORD[0] + 360 : BORD[k + 1]; let d = `M${f(cx)} ${f(cy)}` + A.map(p => `L${f(p[0])} ${f(p[1])}`).join("");
    for (let t = a0; t < a1; t += 8) d += `L${f(cx + Math.cos(t * D2R) * 1000)} ${f(cy + Math.sin(t * D2R) * 1000)}`; return d + B.slice().reverse().map(p => `L${f(p[0])} ${f(p[1])}`).join("") + "Z"; };
  const SECT = [0, 1, 2, 3, 4, 5].map(secteur), FONDS = ["url(#mv-g0)", "url(#mv-g1)", "url(#mv-g2)", "url(#mv-g3)", "url(#mv-g4)", "url(#mv-g5)"];
  SECT.forEach((d, k) => { s.push(`<clipPath id="mv-k${k}"><path d="${d}"/></clipPath><path d="${d}" fill="${FONDS[k]}"/>`); });
  const dans = (k, dessin) => s.push(`<g clip-path="url(#mv-k${k})">${dessin}</g>`);
  const etoiles = (n, op) => Array.from({ length: n }, () => `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(.4 + r() * 1.1)}" fill="#FFF" opacity="${(op * (.3 + r() * .7)).toFixed(2)}"/>`).join("");
  // Espace : nébuleuses et étoiles
  dans(0, `<ellipse cx="300" cy="60" rx="160" ry="60" fill="#C04AB8" opacity=".22" filter="url(#mv-flou8)"/><ellipse cx="80" cy="260" rx="110" ry="70" fill="#2AA8C8" opacity=".16" filter="url(#mv-flou8)"/><ellipse cx="520" cy="150" rx="90" ry="40" fill="#6A4AE8" opacity=".2" filter="url(#mv-flou8)"/>` + etoiles(150, 1));
  // Asgard : aurores dorées
  dans(1, etoiles(70, .8) + [0, 1, 2, 3].map(q => `<path d="M${560 + q * 40} ${260 - q * 30}Q${700 + q * 30} ${120 - q * 40} ${900 + q * 20} ${170 - q * 50}T1100 ${60 - q * 20}" fill="none" stroke="${q % 2 ? "#5AE8C8" : "#FFD27A"}" stroke-width="22" opacity=".12" filter="url(#mv-flou8)"/>`).join(""));
  // Wakanda : savane, herbes, collines
  { let g = ""; for (let k = 0; k < 9; k++) g += `<ellipse cx="${f(680 + r() * 420)}" cy="${f(280 + r() * 440)}" rx="${f(50 + r() * 80)}" ry="${f(18 + r() * 26)}" fill="${r() < .5 ? "#C8783A" : "#7A3E1E"}" opacity=".3"/>`;
    for (let k = 0; k < 260; k++) { const x = 640 + r() * 440, y = 230 + r() * 490; if (K.dT(x, y) < 22) continue; g += `<path d="M${f(x - 3)} ${f(y)}l3 -6l1 6l3 -5l0 5" fill="none" stroke="${["#E8B060", "#8A5A22", "#6A8A3A"][k % 3]}" stroke-width="1" opacity=".7"/>`; } dans(2, g); }
  // Sanctuaire : mandala géant
  dans(3, [60, 90, 120, 160, 200, 250].map((R, q) => `<circle cx="541" cy="560" r="${R}" fill="none" stroke="#FFA040" stroke-width="${q % 2 ? 1 : 2}" opacity=".18" stroke-dasharray="${q % 2 ? "3 6" : "none"}"/>`).join("") + Array.from({ length: 16 }, (_, q) => `<path d="M541 560L${f(541 + Math.cos(q * PI / 8) * 260)} ${f(560 + Math.sin(q * PI / 8) * 260)}" stroke="#FFA040" stroke-width="1" opacity=".12"/>`).join(""));
  // monde quantique : bulles fractales
  { let g = ""; for (let k = 0; k < 70; k++) { const x = r() * 520, y = 300 + r() * 420, R = 4 + r() * 22, c = ["#4AF2FF", "#FF4AD8", "#FFE84A", "#8A6AFF"][k % 4]; g += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${c}" fill-opacity=".06" stroke="${c}" stroke-width="1.2" opacity=".55"/>${R > 12 ? `<circle cx="${f(x + R * .2)}" cy="${f(y - R * .2)}" r="${f(R * .45)}" fill="none" stroke="${c}" stroke-width=".8" opacity=".5"/>` : ""}`; } dans(4, g + etoiles(40, .6)); }
  // Nouvelle-York : plan des avenues (en biais), phares des voitures
  { let g = ""; for (let k = -10; k < 20; k++) g += `<path d="M${k * 38} 120L${k * 38 - 160} 720" stroke="#3E4E82" stroke-width="3" opacity=".45"/><path d="M-50 ${120 + k * 30}L520 ${200 + k * 30}" stroke="#3E4E82" stroke-width="2" opacity=".35"/>`;
    for (let k = 0; k < 40; k++) g += `<circle cx="${f(r() * 480)}" cy="${f(150 + r() * 400)}" r="1.1" fill="${r() < .5 ? "#FFE8A0" : "#FF5A4A"}" opacity=".7"/>`; dans(5, g + etoiles(30, .5)); }
  // ---- 2. les coutures (fil d'énergie orange, points de croix)
  { let c1 = "", c2 = "", st = ""; COUT.forEach(pts => { const d = "M" + pts.map(p => f(p[0]) + " " + f(p[1])).join("L"); c1 += d; for (let j = 1; j < pts.length - 1; j++) { const [x, y] = pts[j], dx = pts[j + 1][0] - pts[j - 1][0], dy = pts[j + 1][1] - pts[j - 1][1], l = Math.hypot(dx, dy) || 1; if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue; st += `M${f(x - dy / l * 6 - dx / l * 3)} ${f(y + dx / l * 6 - dy / l * 3)}l${f(dy / l * 12 + dx / l * 6)} ${f(-dx / l * 12 + dy / l * 6)}`; } });
    s.push(`<path d="${c1}" fill="none" stroke="#000" stroke-width="10" opacity=".45" filter="url(#mv-flou)"/><path d="${c1}" fill="none" stroke="#FF8A1E" stroke-width="3"/><path d="${st}" stroke="#FFD27A" stroke-width="1.6" stroke-linecap="round"/><path d="${c1}" fill="none" stroke="#FFF2C8" stroke-width="1" stroke-dasharray="2 7"/>`);
    a.push(`<path d="${c1}" fill="none" stroke="#FFB040" stroke-width="8" opacity="${K.anime ? .1 : .3}" filter="url(#mv-flou)">${an(`<animate attributeName="opacity" values=".08;.5;.08" dur="3.2s" repeatCount="indefinite"/>`)}</path>`); }
  // ---- 3. la piste : asphalte sombre, bordures argent
  K.route([["#000", 42, ` opacity=".55" filter="url(#mv-flou)"`], ["#C8BEF0", 31], ["#1A1628", 28], ["#2C2840", 24]]);
  s.push(`<path d="${K.piste}" fill="none" stroke="#F7E3A0" stroke-width="1.2" stroke-dasharray="7 11" opacity=".55"/>`);
  K.depart();
  { const p = K.P[0], [nx, ny, tx, ty] = K.nrm(0); let d = ""; for (let i = -3; i < 3; i++) for (let j = -1; j < 3; j++) { const ox = nx * i * 4.5 + tx * j * 4.5, oy = ny * i * 4.5 + ty * j * 4.5; d += `<path d="M${f(p[0] + ox)} ${f(p[1] + oy)}l${f(nx * 4.5)} ${f(ny * 4.5)}l${f(tx * 4.5)} ${f(ty * 4.5)}l${f(-nx * 4.5)} ${f(-ny * 4.5)}z" fill="${(i + j) % 2 ? "#111" : "#EEE"}"/>`; } s.push(d);
    [-1, 1].forEach(sg => { const x = p[0] + nx * sg * 18 + tx * 2, y = p[1] + ny * sg * 18 + ty * 2, x2 = x + nx * sg * 11, y2 = y + ny * sg * 11, ang = Math.atan2(ty, tx) * 57.3;
      s.push(`<path d="M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}" stroke="#140E1E" stroke-width="4.6" stroke-linecap="round"/><path d="M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}" stroke="url(#mv-or)" stroke-width="2.8" stroke-linecap="round"/><circle cx="${f(x2)}" cy="${f(y2)}" r="2.4" fill="#7CF29A" ${INK}/>` +
        `<g transform="translate(${f(x2 - nx * sg * 2)} ${f(y2 - ny * sg * 2)}) rotate(${f(ang)}) scale(.7 ${sg > 0 ? -.7 : .7})"><path d="M0 0h18l-3 6.5l3 6.5h-18z" fill="#EEE" ${INK}/>${[0, 1, 2, 3].map(i => [0, 1].map(j => (i + j) % 2 ? `<rect x="${i * 4.2}" y="${j * 6.5}" width="4.2" height="6.5" fill="#111"/>` : "").join("")).join("")}</g>`); }); }
  // portails du sorcier là où les coutures croisent la piste
  COUT.forEach((pts, i) => { const dd = pts.map(q => q[0] > 0 && q[0] < W && q[1] > 0 && q[1] < H ? K.dT(q[0], q[1]) : 1e9), j = dd.findIndex((d, j) => d < 12 && d <= (dd[j + 1] === undefined ? 1e9 : dd[j + 1])); if (j < 0) return; const [x, y] = pts[j];
    K.halo(x, y, 46, "#FF8A1E", .7); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="20" fill="none" stroke="#FF8A1E" stroke-width="4" opacity=".9"/><circle cx="${f(x)}" cy="${f(y)}" r="20" fill="none" stroke="#FFF2C8" stroke-width="1"/>`);
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${f(x)} ${f(y)}" to="${i % 2 ? -360 : 360} ${f(x)} ${f(y)}" dur="${(5 + i * .7).toFixed(1)}s" repeatCount="indefinite"/>`)}<circle cx="${f(x)}" cy="${f(y)}" r="24" fill="none" stroke="#FFD27A" stroke-width="3" stroke-dasharray="1.5 5" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(y)}" r="16" fill="none" stroke="#FFB040" stroke-width="1.5" stroke-dasharray="6 4"/></g>`); K.prendre(x, y, 26); });
  // ---- 4. la citadelle du roi au masque de fer (centre, repère 3D)
  K.prendre(cx, cy - 30, 120);
  s.push(`<circle cx="${f(cx)}" cy="${f(cy + 4)}" r="102" fill="#000" opacity=".55" filter="url(#mv-flou)"/><circle cx="${f(cx)}" cy="${f(cy)}" r="96" fill="url(#mv-pl)" stroke="#7CF29A" stroke-width="2.5"/><circle cx="${f(cx)}" cy="${f(cy)}" r="86" fill="none" stroke="#3E8A54" stroke-width="1.5" stroke-dasharray="4 5"/>` +
    Array.from({ length: 24 }, (_, q) => `<path d="M${f(cx + Math.cos(q * PI / 12) * 44)} ${f(cy + Math.sin(q * PI / 12) * 44)}L${f(cx + Math.cos(q * PI / 12) * 86)} ${f(cy + Math.sin(q * PI / 12) * 86)}" stroke="#0E1A12" stroke-width="1.2"/>`).join("") + `<circle cx="${f(cx)}" cy="${f(cy)}" r="44" fill="none" stroke="#0E1A12" stroke-width="1.5"/>`);
  { let c = `${G(cx, cy, 1)}`, base = 22;
    c += `<rect x="-90" y="-22" width="180" height="${base + 22}" fill="url(#mv-pierre)" ${INK}/>` + Array.from({ length: 23 }, (_, q) => `<rect x="${-90 + q * 8}" y="-28" width="5" height="7" fill="#7A8694" ${INK}/>`).join("");
    [[-76, 22, 74], [-46, 18, 96], [46, 18, 96], [76, 22, 74], [0, 48, 116]].forEach(([x, w, h]) => { const y0 = base - h;
      c += `<rect x="${x - w / 2}" y="${y0}" width="${w}" height="${h}" fill="url(#mv-pierre)" ${INK}/><path d="M${x - w / 2 - 4} ${y0}L${x} ${y0 - w * 1.4}L${x + w / 2 + 4} ${y0}Z" fill="#1E5A34" ${INK}/><path d="M${x} ${y0 - w * 1.4}L${x + w / 2 + 4} ${y0}H${x}Z" fill="#0E3A20"/><path d="M${x} ${y0 - w * 1.4}v-8" stroke="#7CF29A" stroke-width="1.5"/>`;
      for (let q = 0; q < 3; q++) c += `<rect x="${x - 2}" y="${y0 + 10 + q * 18}" width="4" height="9" rx="2" fill="#7CF29A" opacity=".85"/>`; });
    // les 4 bannières aux couleurs des pilotes
    [-76, -46, 46, 76].forEach((x, k) => { const y0 = base - [74, 96, 96, 74][k] + 14; c += `<path d="M${x - 8} ${y0}h16v30l-8 -6l-8 6z" fill="${COULEURS_J[k]}" ${INK}/><circle cx="${x}" cy="${y0 + 11}" r="4" fill="none" stroke="#FFF" stroke-width="1.2"/>`; });
    c += `<path d="M-16 ${base}v-26a16 16 0 0 1 32 0v26z" fill="#081008" ${INK}/>`;
    // le trône
    c += `<path d="M-26 34V-34L-14 -52L0 -40L14 -52L26 -34V34Z" fill="#14201A" stroke="#7CF29A" stroke-width="1.6"/><path d="M-18 30V-28L0 -32L18 -28V30Z" fill="#1E6A3A" opacity=".8"/>`;
    // le roi : cape verte, armure, masque de fer
    c += `${G(0, 26, 1.5)}<path d="M-12 -24Q-26 6 -32 34L32 34Q26 6 12 -24Z" fill="#1E6A3A" ${INK}/><path d="M-6 -20Q-14 8 -16 32L16 32Q14 8 6 -20Z" fill="#124A28"/>
      <rect x="-9" y="4" width="7" height="27" fill="url(#mv-acier)" ${INK}/><rect x="2" y="4" width="7" height="27" fill="url(#mv-acier)" ${INK}/><rect x="-10" y="28" width="9" height="5" rx="1.5" fill="#3A3E46"/><rect x="1" y="28" width="9" height="5" rx="1.5" fill="#3A3E46"/>
      <path d="M-12 -24h24l-3 28h-18z" fill="url(#mv-acier)" ${INK}/><path d="M-12 4h24l4 14h-32z" fill="#2A8A4A" ${INK}/><rect x="-11" y="1" width="22" height="4" fill="#5A3A1A"/><rect x="-3" y="0" width="6" height="6" rx="1" fill="url(#mv-or)" ${INK}/>
      <path d="M-12 -21Q-20 -8 -22 4" stroke="url(#mv-acier)" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M12 -21Q22 -14 26 -4" stroke="url(#mv-acier)" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M-10 -26Q-13 -47 0 -49Q13 -47 10 -26Q0 -21 -10 -26Z" fill="#1E6A3A" ${INK}/><rect x="-6.5" y="-43" width="13" height="16" rx="3" fill="url(#mv-acier)" ${INK}/>
      <path d="M-6.5 -39.5h13" stroke="#3A3E46" stroke-width=".8"/><rect x="-4.8" y="-38.6" width="3.6" height="1.8" fill="#0A0A0A"/><rect x="1.2" y="-38.6" width="3.6" height="1.8" fill="#0A0A0A"/><circle cx="-3" cy="-37.7" r=".7" fill="#7CF29A"/><circle cx="3" cy="-37.7" r=".7" fill="#7CF29A"/><path d="M-3 -32.5v4M-1 -32.5v4.6M1 -32.5v4.6M3 -32.5v4" stroke="#2A2E36" stroke-width=".7"/>
      <circle cx="-22" cy="6" r="3.2" fill="#3A3E46"/><circle cx="27" cy="-3" r="3.2" fill="#3A3E46"/></g></g>`;
    s.push(c); K.halo(cx - 33, cy + 35, 18, "#7CF29A", .8); K.halo(cx + 40, cy + 21, 22, "#7CF29A", .9);
    a.push(`<g>${an(`<animate attributeName="opacity" values=".4;1;.4" dur="1.6s" repeatCount="indefinite"/>`)}<circle cx="${f(cx + 40)}" cy="${f(cy + 21)}" r="6" fill="#C8FFD8"/><path d="M${f(cx + 40)} ${f(cy + 21)}l10 -14l-4 9l12 -6l-10 12l6 -1" fill="none" stroke="#B8FFC8" stroke-width="1.6"/><circle cx="${f(cx - 33)}" cy="${f(cy + 35)}" r="4.5" fill="#C8FFD8"/></g>`);
    bulle(cx + 112, cy + 82, "Le roi, c'est moi !", 11, 4, 15, true);
    nomMonde(cx + 6, cy + 116, "La citadelle du roi de fer", "#9AF2B0", 18.5); }
  // ---- 5. Espace : le titan violet assis sur son astéroïde, le gant aux 6 pierres levé
  { const tx = 72, ty = 176, sc = 1.2, PIERRES = [["#3A8CFF", -7.5, -11], ["#FFD23A", -2.5, -12], ["#FF3A3A", 2.5, -12], ["#A04CFF", 7.5, -11], ["#3AE07A", 11.5, -1], ["#FF8A2A", 0, -1]];
    K.prendre(tx + 20, ty - 50, 90);
    let c = `${G(tx, ty, sc)}<ellipse cx="4" cy="24" rx="50" ry="17" fill="#000" opacity=".4" filter="url(#mv-flou)"/><path d="M-46 18Q-40 4 -10 6Q30 2 48 14Q50 30 20 38Q-20 42 -44 30Z" fill="#4A3E5A" ${INK}/><path d="M-40 14Q-20 6 10 8Q34 8 44 16" fill="none" stroke="#7A6A8A" stroke-width="3"/><circle cx="-20" cy="24" r="5" fill="#2E2638"/><circle cx="18" cy="28" r="3.5" fill="#2E2638"/><circle cx="34" cy="20" r="2.5" fill="#2E2638"/>
      <path d="M-6 -4L28 -8L30 4L-4 8Z" fill="#2E3A7A" ${INK}/><path d="M22 -6L34 22L24 25L16 -2Z" fill="#2E3A7A" ${INK}/><circle cx="27" cy="-4" r="5" fill="url(#mv-or)" ${INK}/><path d="M23 20h13l2 6h-16z" fill="url(#mv-or)" ${INK}/>
      <path d="M-20 -58L18 -58L14 -4L-14 -4Z" fill="#2E3A7A" ${INK}/><path d="M-18 -56L16 -56L12 -28Q0 -22 -14 -28Z" fill="url(#mv-or)" ${INK}/><path d="M-8 -48h14M-10 -40h18" stroke="#8A5A14" stroke-width="1"/>
      <path d="M-20 -50Q-28 -30 -14 -12" stroke="#8A5AA8" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M-20 -50Q-28 -30 -14 -12" stroke="#140E1E" stroke-width="10.5" stroke-linecap="round" fill="none" opacity=".25"/><circle cx="-13" cy="-11" r="5" fill="#8A5AA8" ${INK}/>
      <path d="M16 -52Q34 -56 38 -76" stroke="#140E1E" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M16 -52Q34 -56 38 -76" stroke="#8A5AA8" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="-20" cy="-54" r="9" fill="url(#mv-or)" ${INK}/><circle cx="18" cy="-54" r="9" fill="url(#mv-or)" ${INK}/>
      <path d="M-9 -78Q-10 -62 0 -59Q10 -62 9 -78Q0 -86 -9 -78Z" fill="#8A5AA8" ${INK}/><path d="M-5 -64v4M0 -62v4M5 -64v4" stroke="#5A3A7A" stroke-width="1.1"/><path d="M-5.5 -71h3.5M2 -71h3.5" stroke="#1A0E2A" stroke-width="1.6"/>
      <path d="M-11 -74Q-13 -91 0 -94Q13 -91 11 -74L8 -79Q0 -84 -8 -79Z" fill="url(#mv-or)" ${INK}/><path d="M-11 -80l-6 -10l4 12M11 -80l6 -10l-4 12" fill="url(#mv-or)" ${INK}/>
      ${G(42, -104, 1.7, 8)}<path d="M-9 8h18v9h-18z" fill="url(#mv-or)" ${INK}/><path d="M-10 -10Q-11 -15 -6 -15h12Q11 -15 10 -10L12 6Q4 10 -8 8Z" fill="url(#mv-or)" ${INK}/><path d="M-10 -9h20M-5 -15v6M0 -15v6M5 -15v6" stroke="#8A5A14" stroke-width=".7"/><path d="M10 -4q6 0 5 6l-4 3" fill="url(#mv-or)" ${INK}/>
      ${PIERRES.map(([col, u, v], q) => `<circle cx="${u}" cy="${v}" r="${q === 5 ? 3.4 : 2.1}" fill="${col}" stroke="#4A2A08" stroke-width=".6"/><circle cx="${u - .6}" cy="${v - .7}" r="${q === 5 ? 1.1 : .7}" fill="#FFF" opacity=".8"/>`).join("")}</g></g>`;
    s.push(c);
    // les pierres s'allument une à une, puis claquement de doigts
    const gx = tx + 42 * sc, gy = ty - 104 * sc, Pg = (u, v) => { const t = 8 * D2R, ux = u * 1.7 * sc, uy = v * 1.7 * sc; return [gx + ux * Math.cos(t) - uy * Math.sin(t), gy + ux * Math.sin(t) + uy * Math.cos(t)]; }, DS = 14;
    PIERRES.forEach(([col, u, v], q) => { const [x, y] = Pg(u, v), t1 = (.08 + q * .1).toFixed(2), t2 = (.1 + q * .1).toFixed(2); a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${t1};${t2};.86;.9;1" dur="${DS}s" repeatCount="indefinite"/>`)}<circle cx="${f(x)}" cy="${f(y)}" r="${q === 5 ? 15 : 10}" fill="${col}" opacity=".45" filter="url(#mv-flou)"/><circle cx="${f(x)}" cy="${f(y)}" r="${q === 5 ? 5 : 3.4}" fill="#FFF" opacity=".85"/></g>`); });
    const etoile = (x, y, R1, R2, n) => "M" + Array.from({ length: n * 2 }, (_, q) => { const t = q * PI / n - PI / 2, R = q % 2 ? R2 : R1; return f(x + Math.cos(t) * R) + " " + f(y + Math.sin(t) * R); }).join("L") + "Z";
    a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.7;.72;.84;.88;1" dur="${DS}s" repeatCount="indefinite"/>`)}<path d="${etoile(gx + 40, gy + 46, 36, 20, 10)}" fill="#FFE84A" stroke="#140E1E" stroke-width="1.6"/><text x="${f(gx + 40)}" y="${f(gy + 50)}" text-anchor="middle" ${FONTE} font-size="12" fill="#C8202A" transform="rotate(-8 ${f(gx + 40)} ${f(gy + 50)})">CLAC !</text></g>`);
    a.push(`<circle cx="${f(gx)}" cy="${f(gy)}" r="20" fill="#FFF" opacity="0">${an(`<animate attributeName="opacity" values="0;0;.9;0;0" keyTimes="0;.7;.71;.8;1" dur="${DS}s" repeatCount="indefinite"/><animate attributeName="r" values="20;20;140;140" keyTimes="0;.7;.8;1" dur="${DS}s" repeatCount="indefinite"/>`)}</circle>`);
    bulle(tx + 172, ty - 80, "Inévitable.", DS, 1.4, 15, true, -1);
    // la planète violette coupée par le bord, l'anneau ; un vaisseau qui passe
    s.push(`<g transform="translate(436 32) scale(.62) translate(-420 6)"><circle cx="420" cy="-6" r="36" fill="#6A3A9A" ${INK}/><path d="M386 4Q420 26 456 6" fill="none" stroke="#3A1E5A" stroke-width="5" opacity=".6"/><circle cx="406" cy="8" r="5" fill="#4A2A7A"/><circle cx="436" cy="14" r="3" fill="#4A2A7A"/><circle cx="410" cy="-22" r="7" fill="#8A5ABA" opacity=".6"/><ellipse cx="420" cy="2" rx="62" ry="9" fill="none" stroke="#E8C8FF" stroke-width="3" opacity=".8" transform="rotate(-10 420 2)"/></g>`);
    a.push(`<g${K.anime ? "" : ` transform="translate(160 0)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="-120 6;520 -14" dur="16s" repeatCount="indefinite"/>`)}<path d="M200 30l-30 -3l30 -3" fill="#FFB040" opacity=".6"/><path d="M196 24h20l10 6l-10 6h-20l4 -6z" fill="#B8C0D0" ${INK}/><path d="M204 24l4 -6h6l-2 6M204 36l4 6h6l-2 -6" fill="#E85A2A" ${INK}/><circle cx="218" cy="30" r="2" fill="#5AE8FF"/></g>`);
    // le cube cosmique qui flotte dans le vide (la première pierre, avant le gant)
    { const ux = 430, uy = 156, L = 13; K.halo(ux, uy, 46, "#3A8CFF", .9); K.prendre(ux, uy, 30);
      const iso = (u, v, w) => [ux + (u - v) * L * .87, uy + (u + v) * L * .5 - w * L];
      const face = (pts, col) => `<path d="M${pts.map(q => f(q[0]) + " " + f(q[1])).join("L")}Z" fill="${col}" fill-opacity=".85" stroke="#DFF4FF" stroke-width="1"/>`;
      s.push(face([iso(0, 0, 1), iso(1, 0, 1), iso(1, 1, 1), iso(0, 1, 1)], "#8AD0FF") + face([iso(0, 1, 1), iso(1, 1, 1), iso(1, 1, 0), iso(0, 1, 0)], "#2A6ACF") + face([iso(1, 0, 1), iso(1, 1, 1), iso(1, 1, 0), iso(1, 0, 0)], "#3A8CFF"));
      a.push(`<circle cx="${ux}" cy="${f(uy - 2)}" r="9" fill="#E8F8FF" opacity="${K.anime ? .3 : .6}" filter="url(#mv-flou)">${an(`<animate attributeName="opacity" values=".2;.9;.2" dur="2.2s" repeatCount="indefinite"/>`)}</circle>`); }
    nomMonde(290, 66, "Espace", "#C8B8FF"); }
  // ---- 6. Nouvelle-York : la ligne des toits, la tour, la toile, le géant vert
  { const y0 = 392; let c = `<rect x="200" y="${y0}" width="218" height="9" fill="#14182A"/>`;
    c += [[209, 22, 74], [232, 20, 118], [254, 26, 152], [316, 24, 124], [342, 28, 92], [372, 22, 146], [396, 22, 84]].map(([x, w, h], q) => `<rect x="${x}" y="${y0 - h}" width="${w}" height="${h}" fill="url(#mv-fac)" ${INK}/><rect x="${x + 1}" y="${y0 - h + 4}" width="${w - 2}" height="${h - 6}" fill="url(#mv-fen)"/><rect x="${x + 1}" y="${y0 - h + 4}" width="${w - 2}" height="${h - 6}" fill="url(#mv-fen2)"/>` +
      (q === 1 || q === 4 ? `<rect x="${x + w / 2 - 4}" y="${y0 - h - 9}" width="8" height="7" rx="2" fill="#6A4A2E" ${INK}/><path d="M${x + w / 2 - 3} ${y0 - h - 2}v2M${x + w / 2 + 3} ${y0 - h - 2}v2" stroke="#3A2A1A"/>` : "")).join("");
    // la flèche argentée (gratte-ciel à arches) et la tour des héros
    c += `<path d="M372 ${y0 - 146}L383 ${y0 - 176}L394 ${y0 - 146}Z" fill="#C8D0DA" ${INK}/>${[0, 1, 2].map(q => `<path d="M${374 + q * 2} ${y0 - 146 - q * 8}a${9 - q * 2} ${9 - q * 2} 0 0 1 ${18 - q * 4} 0" fill="none" stroke="#2A3448" stroke-width="1"/>`).join("")}<path d="M383 ${y0 - 176}v-14" stroke="#C8D0DA" stroke-width="1.4"/>`;
    c += `<path d="M282 ${y0}V${y0 - 150}L286 ${y0 - 186}H306L312 ${y0 - 150}V${y0}Z" fill="url(#mv-verre)" ${INK}/><path d="M276 ${y0 - 158}h40l-4 8h-32z" fill="#C8D0DA" ${INK}/><path d="M286 ${y0 - 186}L296 ${y0 - 212}L306 ${y0 - 186}Z" fill="url(#mv-verre)" ${INK}/><path d="M296 ${y0 - 212}v-16" stroke="#C8D0DA" stroke-width="1.6"/>` +
      Array.from({ length: 13 }, (_, q) => `<path d="M284 ${y0 - 12 - q * 11}h26" stroke="#BFE8FF" stroke-width=".8" opacity=".5"/>`).join("") + `<path d="M291 ${y0}V${y0 - 150}" stroke="#E8F6FF" stroke-width="2" opacity=".5"/>`;
    c += Array.from({ length: 5 }, (_, q) => `<rect x="${212 + q * 42}" y="${y0 + 2}" width="9" height="4.5" rx="1.5" fill="#F2C230" ${INK}/>`).join("");
    // la toile tendue entre la tour et les toits
    c += `<path d="M312 ${y0 - 140}L342 ${y0 - 92}M312 ${y0 - 140}L372 ${y0 - 120}M312 ${y0 - 112}L342 ${y0 - 92}" stroke="#E8ECF4" stroke-width=".8" opacity=".85"/><path d="M318 ${y0 - 131}q8 4 14 2M324 ${y0 - 120}q6 3 12 0M330 ${y0 - 108}q4 2 9 0" fill="none" stroke="#E8ECF4" stroke-width=".7" opacity=".8"/>`;
    s.push(c); K.halo(296, y0 - 214, 16, "#5AE8FF", .9); K.prendre(310, y0 - 90, 105);
    a.push(`<circle cx="296" cy="${y0 - 228}" r="2.4" fill="#BFF8FF">${an(`<animate attributeName="opacity" values="1;.1;1" dur="1.4s" repeatCount="indefinite"/>`)}</circle>`);
    // l'araignée qui se balance au bout de son fil
    const ax = 352, ay = y0 - 196, araignee = `<g transform="translate(${ax} ${ay + 58})"><path d="M-6 -2l-6 -6M6 -2l6 -6M-5 4l-7 6M5 4l7 6" stroke="#C8202A" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="0" cy="1" rx="4.5" ry="6" fill="#2A4AC8" ${INK}/><path d="M-3.5 -2h7l-1 6h-5z" fill="#C8202A"/><circle cx="0" cy="-7" r="4.8" fill="#C8202A" ${INK}/><path d="M-3.6 -7.6l2.6 1.4l-2.4 1.2zM3.6 -7.6l-2.6 1.4l2.4 1.2z" fill="#FFF" stroke="#140E1E" stroke-width=".5"/></g>`;
    a.push(`<g${K.anime ? "" : ` transform="rotate(18 ${ax} ${ay})"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="-28 ${ax} ${ay};28 ${ax} ${ay};-28 ${ax} ${ay}" dur="3.4s" repeatCount="indefinite"/>`)}<path d="M${ax} ${ay}V${ay + 52}" stroke="#E8ECF4" stroke-width="1"/>${araignee}</g>`);
    
    // le géant vert qui retombe dans un cratère
    const hx = 84, hy = 516; K.prendre(hx, hy + 20, 62);
    s.push(`<ellipse cx="${hx}" cy="${hy + 52}" rx="46" ry="13" fill="#0A0E1A" opacity=".8"/><ellipse cx="${hx}" cy="${hy + 50}" rx="40" ry="10" fill="#1A2238" ${INK}/>` + Array.from({ length: 9 }, (_, q) => { const t = q * TAU / 9 + .3; return `<path d="M${f(hx + Math.cos(t) * 30)} ${f(hy + 50 + Math.sin(t) * 8)}l${f(Math.cos(t) * 18)} ${f(Math.sin(t) * 7)}l${f(Math.cos(t + .4) * 10)} ${f(Math.sin(t + .4) * 4)}" fill="none" stroke="#0A0E1A" stroke-width="2"/>`; }).join("") +
      [[-34, 40, 5], [30, 38, 4], [40, 50, 3.5], [-40, 52, 4]].map(([u, v, R]) => `<circle cx="${hx + u}" cy="${hy + v}" r="${R}" fill="#4A5068" ${INK}/>`).join(""));
    const geant = `${G(hx, hy, 1.35)}<path d="M-9 14l-6 18h8l3 -14M9 14l6 18h-8l-3 -14" fill="#3E9A30" ${INK}/><path d="M-11 6h22l3 12h-28z" fill="#6A3A9A" ${INK}/><path d="M-8 18l-3 4l4 -1l2 3l2 -4l3 3" fill="none" stroke="#140E1E" stroke-width=".8"/>
      <path d="M-16 -18Q-18 -2 -11 7H11Q18 -2 16 -18Q8 -24 0 -24Q-8 -24 -16 -18Z" fill="#4CB03A" ${INK}/><path d="M-8 -16Q0 -10 8 -16M-6 -6h12M0 -16v12" stroke="#2E7A22" stroke-width="1.2" fill="none"/>
      <path d="M-15 -16Q-28 -30 -20 -44" stroke="#140E1E" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M-15 -16Q-28 -30 -20 -44" stroke="#4CB03A" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M15 -16Q28 -30 20 -44" stroke="#140E1E" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M15 -16Q28 -30 20 -44" stroke="#4CB03A" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="-19" cy="-47" r="6.5" fill="#4CB03A" ${INK}/><circle cx="19" cy="-47" r="6.5" fill="#4CB03A" ${INK}/>
      <path d="M-7 -24Q-8 -38 0 -38Q8 -38 7 -24Q0 -21 -7 -24Z" fill="#4CB03A" ${INK}/><path d="M-8 -30Q-9 -42 0 -41Q9 -42 8 -30Q6 -36 0 -35Q-6 -36 -8 -30Z" fill="#1A1A22"/><path d="M-5 -31.5l3.5 1.5M5 -31.5l-3.5 1.5" stroke="#140E1E" stroke-width="1.4"/><path d="M-3 -26.5h6" stroke="#140E1E" stroke-width="1.6"/></g>`;
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -34;0 0;0 0" keyTimes="0;.32;.55;1" dur="3s" repeatCount="indefinite"/>`)}${geant}</g>`);
    a.push(`<ellipse cx="${hx}" cy="${hy + 50}" rx="${K.anime ? 40 : 52}" ry="${K.anime ? 10 : 14}" fill="none" stroke="#C8F2A0" stroke-width="2.5" opacity="${K.anime ? 0 : .6}">${an(`<animate attributeName="opacity" values="0;0;.9;0;0" keyTimes="0;.54;.56;.85;1" dur="3s" repeatCount="indefinite"/><animate attributeName="rx" values="40;40;70;70" keyTimes="0;.55;.85;1" dur="3s" repeatCount="indefinite"/>`)}</ellipse>`);
    bulle(hx + 70, hy - 36, "ÉCRASE !", 6, 1, 15);
    nomMonde(286, y0 + 26, "Nouvelle-York", "#9AC8FF"); }
  // ---- 7. Asgard : cité d'or sur son île flottante, le pont arc-en-ciel, le marteau, le dieu farceur
  { let c = `<path d="M918 122Q990 136 1084 118L1084 140Q1060 176 1020 196Q996 212 984 206Q960 180 936 150Z" fill="#5A4A3A" ${INK}/><path d="M930 140Q990 160 1080 138" fill="none" stroke="#3A2E22" stroke-width="2"/><path d="M960 172q10 20 4 34M1000 190q4 14 -4 20M1040 166q6 12 0 22" fill="none" stroke="#2A2014" stroke-width="2"/>`;
    c += `<path d="M916 122Q992 112 1084 116V124Q992 130 916 126Z" fill="#7A9A4A"/>`;
    [[932, 8, 34], [946, 10, 58], [960, 8, 44], [1000, 10, 70], [1016, 12, 52], [1032, 8, 82], [1048, 10, 48], [1064, 9, 64], [1078, 8, 40]].forEach(([x, w, h]) => { c += `<rect x="${x - w / 2}" y="${122 - h}" width="${w}" height="${h}" fill="url(#mv-or)" ${INK}/><path d="M${x - w / 2 - 1} ${122 - h}L${x} ${122 - h - w * 2.2}L${x + w / 2 + 1} ${122 - h}Z" fill="url(#mv-or)" ${INK}/><rect x="${x - 1}" y="${122 - h + 6}" width="2" height="${h * .5}" fill="#FFF6D0" opacity=".7"/>`; });
    c += `<path d="M966 122V82Q984 58 1002 82V122Z" fill="url(#mv-or)" ${INK}/><path d="M972 122V88Q984 70 996 88V122Z" fill="#8A5A14" opacity=".5"/><path d="M984 66V30" stroke="url(#mv-or)" stroke-width="4"/><path d="M978 70L984 22L990 70Z" fill="url(#mv-or)" ${INK}/><circle cx="984" cy="24" r="2.4" fill="#FFF6D0"/>`;
    s.push(c); K.halo(984, 70, 70, "#FFD27A", .45); K.prendre(1000, 130, 90);
    // la cascade qui tombe du bord de l'île dans le vide
    a.push(`<path d="M940 126q-4 30 2 60M952 128q-3 26 0 48M1070 130q4 30 -2 56" fill="none" stroke="#BFE8FF" stroke-width="3" stroke-dasharray="6 5" opacity=".75">${an(`<animate attributeName="stroke-dashoffset" values="22;0" dur="1s" repeatCount="indefinite"/>`)}</path>`);
    // le pont arc-en-ciel jusqu'à l'observatoire
    const pont = "M926 118Q850 36 770 34";
    s.push(`<path d="${pont}" fill="none" stroke="#000" stroke-width="18" opacity=".4" filter="url(#mv-flou)"/>` + [["#8A4AFF", 15], ["#3A8CFF", 12.5], ["#3AE07A", 10], ["#FFE84A", 7.5], ["#FF8A2A", 5], ["#FF3A4A", 2.5]].map(([col, w]) => `<path d="${pont}" fill="none" stroke="${col}" stroke-width="${w}"/>`).join(""));
    a.push(`<path d="${pont}" fill="none" stroke="#FFF" stroke-width="5" stroke-dasharray="10 40" opacity=".7">${an(`<animate attributeName="stroke-dashoffset" values="0;-100" dur="1.6s" repeatCount="indefinite"/>`)}</path>`);
    s.push(`<path d="M752 40a18 18 0 0 1 36 0z" fill="url(#mv-or)" ${INK}/><rect x="750" y="39" width="40" height="5" fill="#8A5A14" ${INK}/><path d="M770 22v-6" stroke="#E2B93B" stroke-width="2"/>`);
    a.push(`<path d="M766 24L700 -10H740Z" fill="#FFF6D0" opacity="${K.anime ? .2 : .35}">${an(`<animate attributeName="opacity" values=".1;.5;.1" dur="2.6s" repeatCount="indefinite"/>`)}</path>`);
    nomMonde(1012, 236, "Asgard", "#FFD27A");
    // le marteau planté dans la roche
    const mx = 690, my = 214; K.prendre(mx, my, 34);
    s.push(`${G(mx, my, 1.25)}<ellipse cx="2" cy="14" rx="28" ry="8" fill="#000" opacity=".4"/><path d="M-26 12Q-20 0 -6 2Q10 -2 24 8Q20 18 0 18Q-18 18 -26 12Z" fill="#6A6A78" ${INK}/><path d="M-6 4l-4 8M8 2l6 9M-16 8l-3 5" stroke="#2A2A34" stroke-width="1.2"/>
      <rect x="-15" y="-10" width="30" height="16" rx="2" fill="url(#mv-acier)" ${INK}/><path d="M-15 -6h30M-15 2h30" stroke="#5A6270" stroke-width=".8"/><circle cx="-8" cy="-2" r="2.6" fill="none" stroke="#3A3E46" stroke-width=".9"/><circle cx="8" cy="-2" r="2.6" fill="none" stroke="#3A3E46" stroke-width=".9"/>
      <rect x="-3" y="-36" width="6" height="26" fill="#6A4022" ${INK}/>${[0, 1, 2, 3, 4].map(q => `<path d="M-3 ${-33 + q * 5}l6 2.5" stroke="#3A2010" stroke-width="1"/>`).join("")}<rect x="-3.6" y="-39" width="7.2" height="4" rx="1" fill="url(#mv-acier)" ${INK}/><path d="M0 -39q-8 -8 -2 -12" fill="none" stroke="#6A4022" stroke-width="1.6"/></g>`);
    a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;1;0;0;.8;0;0" keyTimes="0;.04;.08;.5;.54;.6;1" dur="3.2s" repeatCount="indefinite"/>`)}<path d="M${mx - 10} ${my - 52}l6 12l-6 3l8 14M${mx + 12} ${my - 50}l-4 12l6 2l-8 13M${mx - 30} ${my - 8}l12 2l-2 6l12 1M${mx + 30} ${my - 14}l-12 4l2 6l-12 0" fill="none" stroke="#BFE8FF" stroke-width="2" stroke-linejoin="bevel"/><circle cx="${mx}" cy="${my - 12}" r="26" fill="#BFE8FF" opacity=".2"/></g>`);
    
    // le dieu farceur au casque à cornes, et ses deux illusions
    const farceur = (x, y, sc) => `${G(x, y, sc)}<path d="M-8 -14Q-18 8 -20 26H20Q18 8 8 -14Z" fill="#1E7A3A" ${INK}/><path d="M-18 24H18" stroke="url(#mv-or)" stroke-width="2"/><path d="M-7 -14h14l2 22h-18z" fill="#1A2A1E" ${INK}/><path d="M-6 -12l6 8l6 -8" fill="none" stroke="url(#mv-or)" stroke-width="1.6"/><rect x="-6" y="8" width="5" height="18" fill="#1A2A1E" ${INK}/><rect x="1" y="8" width="5" height="18" fill="#1A2A1E" ${INK}/>
      <path d="M10 -10l8 -2" stroke="#1A2A1E" stroke-width="4" stroke-linecap="round"/><path d="M18 -26V20" stroke="url(#mv-or)" stroke-width="2"/><path d="M18 -26l-4 -6h8z" fill="url(#mv-or)" ${INK}/><circle cx="18" cy="-24" r="2.4" fill="#5AD8FF"/>
      <ellipse cx="0" cy="-20" rx="5" ry="6" fill="#F2E2D0" ${INK}/><path d="M-2.6 -21h1.6M1 -21h1.6" stroke="#140E1E" stroke-width="1"/><path d="M-2 -17q2 1.4 4 -.4" fill="none" stroke="#140E1E" stroke-width=".8"/><path d="M-5 -16Q-7 -10 -5 -6M5 -16Q7 -10 5 -6" stroke="#140E1E" stroke-width="2.4" fill="none"/>
      <path d="M-6 -22Q-7 -29 0 -30Q7 -29 6 -22L4 -25Q0 -27 -4 -25Z" fill="url(#mv-or)" ${INK}/><path d="M-5 -27Q-14 -32 -12 -48Q-9 -36 -2 -29Z" fill="url(#mv-or)" ${INK}/><path d="M5 -27Q14 -32 12 -48Q9 -36 2 -29Z" fill="url(#mv-or)" ${INK}/></g>`;
    const lx = 806, ly = 246; K.prendre(lx, ly - 10, 40);
    [[-34, -14, 0], [34, -16, 1.8]].forEach(([u, v, b]) => a.push(`<g opacity="${K.anime ? 0 : .45}">${an(`<animate attributeName="opacity" values="0;.55;.55;0;0" keyTimes="0;.15;.45;.6;1" dur="5s" begin="${b}s" repeatCount="indefinite"/>`)}${farceur(lx + u, ly + v, 1.1)}</g>`));
    s.push(`<ellipse cx="${lx}" cy="${ly + 34}" rx="20" ry="5" fill="#000" opacity=".4"/>` + farceur(lx, ly, 1.3)); K.halo(lx + 23, ly - 31, 12, "#5AD8FF", .9);
     }
  // ---- 8. Wakanda : montagne de vibranium, chutes, cité, panthère, train
  { let c = `<path d="M836 704L872 600L912 540L952 480L986 512L1012 498L1084 566V720H836Z" fill="url(#mv-mont)" ${INK}/><path d="M952 480L966 520L944 560L960 610" fill="none" stroke="#2A1A44" stroke-width="2"/><path d="M912 540l20 20l-10 40" fill="none" stroke="#2A1A44" stroke-width="1.5"/><path d="M944 488L952 480L962 492L956 490L950 498Z" fill="#E8E0F4" opacity=".7"/>`;
    s.push(c); K.prendre(960, 600, 120);
    const veines = "M952 484l-6 30l14 24l-10 30l12 26M986 514l-10 30l16 20l-8 34M920 560l12 26l-6 30M1012 502l20 34l-6 30";
    s.push(`<path d="${veines}" fill="none" stroke="#8A4AFF" stroke-width="5" opacity=".35" filter="url(#mv-flou)"/>`);
    a.push(`<path d="${veines}" fill="none" stroke="#C8A8FF" stroke-width="2" opacity="${K.anime ? .4 : .9}">${an(`<animate attributeName="opacity" values=".25;1;.25" dur="2.8s" repeatCount="indefinite"/>`)}</path>`);
    // les chutes sur le flanc de la montagne
    s.push(`<path d="M868 606h30l-4 70h-24z" fill="#3A6A9A" opacity=".85"/><ellipse cx="882" cy="680" rx="26" ry="8" fill="#5AA8D8" ${INK}/><path d="M862 604h40" stroke="#3A2A44" stroke-width="5" stroke-linecap="round"/>`);
    a.push(`<path d="M872 608v66M878 608v68M884 608v68M890 608v66M895 608v64" fill="none" stroke="#E8F6FF" stroke-width="1.6" stroke-dasharray="8 6" opacity=".8">${an(`<animate attributeName="stroke-dashoffset" values="28;0" dur=".8s" repeatCount="indefinite"/>`)}</path>`);
    // la cité : tours arrondies, anneaux d'or, fenêtres vertes et violettes
    const BW = 686; let v = `<path d="M908 ${BW + 2}H1084V${BW + 12}H914Z" fill="url(#mv-or)" ${INK}/><path d="M914 ${BW + 12}H1084" stroke="#6A440E" stroke-width="2"/>`; [[924, 16, 60], [946, 22, 100], [972, 16, 68], [998, 28, 132], [1028, 18, 82], [1052, 22, 110], [1074, 14, 64]].forEach(([x, w, h], q) => { const y0 = BW - h;
      v += `<path d="M${x - w / 2} ${BW + 2}V${y0 + w / 2}Q${x - w / 2} ${y0} ${x} ${y0}Q${x + w / 2} ${y0} ${x + w / 2} ${y0 + w / 2}V${BW + 2}Z" fill="url(#mv-wk)" ${INK}/><ellipse cx="${x}" cy="${y0 + h * .3}" rx="${w / 2 + 5}" ry="3.2" fill="url(#mv-or)" ${INK}/>`;
      for (let j = 0; j < h / 12 - 1; j++) v += `<rect x="${x - w / 4}" y="${y0 + 12 + j * 12}" width="${w / 2}" height="2.4" fill="${(j + q) % 3 ? "#7CF29A" : "#C8A8FF"}" opacity=".75"/>`; if (q === 3) v += `<path d="M${x} ${y0}v-16" stroke="#E2B93B" stroke-width="2"/><circle cx="${x}" cy="${y0 - 17}" r="3" fill="#C8A8FF"/>`; });
    s.push(v); K.halo(998, 548, 40, "#C8A8FF", .6);
    // le train suspendu qui traverse
    // la panthère sur son rocher
    const px = 784, py = 654; K.prendre(px, py, 34);
    s.push(`<path d="M${px - 30} ${py + 22}Q${px - 26} ${py + 4} ${px - 4} ${py + 6}Q${px + 22} ${py + 2} ${px + 30} ${py + 22}Z" fill="#5A4A3A" ${INK}/>${G(px, py, 1.4)}<path d="M-18 4Q-20 -6 -10 -8Q2 -10 10 -6L16 -10Q22 -10 22 -4Q22 2 16 2L12 4Q4 8 -10 8Q-16 8 -18 4Z" fill="#15121C" ${INK}/><path d="M-18 4Q-28 0 -26 -10Q-24 -14 -22 -10" fill="none" stroke="#15121C" stroke-width="2.4" stroke-linecap="round"/><path d="M15 -10l1 -4l3 4M19 -10l2 -3l1 4" fill="#15121C"/><path d="M6 -6Q10 -2 14 -6" fill="none" stroke="#C8A8FF" stroke-width="1"/><path d="M-12 8v6M-6 8v6M6 7v7M11 5v8" stroke="#15121C" stroke-width="2.6" stroke-linecap="round"/></g>`);
    a.push(`<g>${an(`<animate attributeName="opacity" values="1;1;0;1;1" keyTimes="0;.9;.93;.96;1" dur="4s" repeatCount="indefinite"/>`)}<circle cx="${f(px + 24.6)}" cy="${f(py - 8.6)}" r="1.1" fill="#BFF8FF"/><circle cx="${f(px + 28.6)}" cy="${f(py - 8.6)}" r="1.1" fill="#BFF8FF"/></g>`);
    // le vaisseau royal en forme de serre, qui survole la savane
    { const vx = 716, vy = 528; s.push(`<ellipse cx="${vx + 6}" cy="${vy + 26}" rx="22" ry="5" fill="#000" opacity=".3"/>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-14 -8;6 -4;0 0" dur="6s" repeatCount="indefinite"/>`)}${G(vx, vy, 1.4, -14)}<path d="M-22 0L-4 -7L16 -3L24 0L16 3L-4 7Z" fill="#1E1A2A" ${INK}/><path d="M-4 -7L-14 -16L-8 -6M-4 7L-14 16L-8 6" fill="#2A2438" ${INK}/><path d="M-18 0H18" stroke="#8A4AFF" stroke-width="1.2"/><path d="M10 -1.6h6v3.2h-6z" fill="#BFF8FF"/><path d="M-22 0l-10 -2v4z" fill="#C8A8FF" opacity=".7"/></g></g>`); }
    nomMonde(1004, 470, "Wakanda", "#E8C8FF");
    // côté chapeau : acacias et le jardin de l'herbe-cœur
    [[720, 336, 1], [884, 318, .9], [944, 404, .7], [1052, 336, .7], [1046, 430, .6]].forEach(([x, y, sc]) => s.push(`${G(x, y, sc)}<ellipse cx="2" cy="16" rx="18" ry="4" fill="#000" opacity=".3"/><path d="M0 16V-2M0 2l-8 -8M0 0l9 -9" stroke="#3A2414" stroke-width="2.4" fill="none"/><path d="M-24 -8Q-10 -20 6 -18Q22 -18 26 -8Q10 -4 -24 -8Z" fill="#3A5A22" ${INK}/><path d="M-18 -10Q0 -16 20 -10" fill="none" stroke="#5A8A32" stroke-width="2"/></g>`));
    { const rx0 = 790, ry0 = 380, PAS = `<path d="M-14 8v9M-6 9v8M10 9v8M17 7v9" stroke="#3A3A44" stroke-width="4.4" stroke-linecap="round"/>`;
      const rhino = `${G(0, 0, 1.55)}<ellipse cx="2" cy="18" rx="26" ry="4" fill="#000" opacity=".3"/>${PAS}<path d="M-24 2Q-26 -12 -10 -14Q8 -16 18 -10Q24 -8 28 -4L36 -2Q38 2 34 5L28 6Q22 12 8 12H-14Q-24 12 -24 2Z" fill="#7A7A86" ${INK}/>
        <path d="M-14 -14Q-2 -18 12 -12L14 2Q0 6 -16 2Z" fill="url(#mv-wk)" ${INK}/><path d="M-12 -10h24M-13 -4h26" stroke="#C8A8FF" stroke-width="1.2" opacity=".9"/><path d="M-4 -16h8l-1 18h-6z" fill="url(#mv-or)" ${INK}/>
        <path d="M34 -2L44 -16L38 -1Z" fill="#F4ECD8" ${INK}/><path d="M27 -6L31 -14L31 -5Z" fill="#F4ECD8" ${INK}/><circle cx="26" cy="-3" r="1.2" fill="#140E1E"/><path d="M18 -10l2 -6l3 5" fill="#7A7A86" ${INK}/><path d="M-24 0q-6 2 -6 8" fill="none" stroke="#7A7A86" stroke-width="2"/>
        <path d="M-2 -16Q-4 -26 0 -30Q4 -26 2 -16Z" fill="#1E1A2A" ${INK}/><circle cx="0" cy="-32" r="3.4" fill="#5A3A2A" ${INK}/><path d="M3 -24L22 -40" stroke="#C8D0DA" stroke-width="1.4"/><path d="M22 -40l-1 4l4 -2z" fill="#C8D0DA"/></g>`;
      K.prendre(rx0 + 30, ry0 - 10, 50);
      s.push(`<path d="M${rx0 - 90} ${ry0 + 26}Q${rx0} ${ry0 + 20} ${rx0 + 110} ${ry0 + 28}" fill="none" stroke="#6A3A18" stroke-width="2" stroke-dasharray="3 6" opacity=".55"/>`);
      a.push(`<g opacity="${K.anime ? 0 : 1}"${K.anime ? "" : ` transform="translate(${rx0 + 30} ${ry0})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="${rx0 - 70} ${ry0};${rx0 + 110} ${ry0 + 4}" dur="9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.86;1" dur="9s" repeatCount="indefinite"/>`)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -2.5;0 0" dur=".45s" repeatCount="indefinite"/>`)}${rhino}</g>${[0, 1, 2].map(q => `<circle cx="${-46 - q * 10}" cy="${22 - q * 3}" r="${6 - q * 1.4}" fill="#E8C08A" opacity="${.5 - q * .12}"/>`).join("")}</g>`); } }
  // ---- 9. le Sanctuaire : le portail du sorcier au cœur du pied du champignon
  { const sx = 541, sy = 548; K.prendre(sx, sy + 20, 60);
    K.halo(sx, sy, 70, "#FF8A1E", .8);
    s.push(`<circle cx="${sx}" cy="${sy}" r="34" fill="url(#mv-porte)"/>${etoiles(0, 0)}` + Array.from({ length: 14 }, () => { const t = r() * TAU, d = r() * 28; return `<circle cx="${f(sx + Math.cos(t) * d)}" cy="${f(sy + Math.sin(t) * d)}" r="${f(.5 + r())}" fill="#FFF" opacity=".8"/>`; }).join("") +
      [0, 1, 2].map(q => `<path d="${Array.from({ length: 28 }, (_, j) => { const t = q * TAU / 3 + j * .2, d = 2 + j * 1.05; return (j ? "L" : "M") + f(sx + Math.cos(t) * d) + " " + f(sy + Math.sin(t) * d); }).join("")}" fill="none" stroke="${["#9AC8FF", "#FFD27A", "#E8C8FF"][q]}" stroke-width="${2.2 - q * .4}" stroke-linecap="round" opacity=".85"/>`).join("") + `<circle cx="${sx}" cy="${sy}" r="4" fill="#FFF"/><circle cx="${sx}" cy="${sy}" r="9" fill="#BFE8FF" opacity=".35"/>` +
      `<circle cx="${sx}" cy="${sy}" r="35" fill="none" stroke="#FF8A1E" stroke-width="5"/><circle cx="${sx}" cy="${sy}" r="35" fill="none" stroke="#FFF2C8" stroke-width="1.2"/>`);
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${sx} ${sy}" to="360 ${sx} ${sy}" dur="4s" repeatCount="indefinite"/>`)}<circle cx="${sx}" cy="${sy}" r="40" fill="none" stroke="#FFD27A" stroke-width="3.5" stroke-dasharray="1.5 6" stroke-linecap="round"/>${[0, 1, 2, 3, 4, 5].map(q => `<path d="M${f(sx + Math.cos(q * PI / 3) * 40)} ${f(sy + Math.sin(q * PI / 3) * 40)}l${f(Math.cos(q * PI / 3 + 1.2) * 9)} ${f(Math.sin(q * PI / 3 + 1.2) * 9)}" stroke="#FFF2C8" stroke-width="1.6" stroke-linecap="round"/>`).join("")}</g>`);
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="360 ${sx} ${sy}" to="0 ${sx} ${sy}" dur="7s" repeatCount="indefinite"/>`)}<circle cx="${sx}" cy="${sy}" r="30" fill="none" stroke="#FFB040" stroke-width="1.5" stroke-dasharray="8 4 2 4"/></g>`);
    // le sorcier : tunique bleue, cape rouge, mandalas orange aux mains
    const sorcier = `${G(sx, sy + 58, 1.25)}<path d="M-6 -12Q-22 -4 -26 14Q-14 8 -8 12Q-2 4 0 8Q2 4 8 12Q14 8 26 14Q22 -4 6 -12Z" fill="#C8202A" ${INK}/><path d="M-6 -12h12l2 22h-16z" fill="#2A3A8A" ${INK}/><path d="M-6 -2h12" stroke="#E2B93B" stroke-width="2"/><circle cx="0" cy="-10" r="2.2" fill="#E2B93B" ${INK}/><path d="M-5 -10Q-10 -24 -15 -22M5 -10Q10 -24 15 -22" stroke="#2A3A8A" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <ellipse cx="0" cy="-18" rx="4.4" ry="5.2" fill="#F2D2B0" ${INK}/><path d="M-4.4 -20Q-4 -25 0 -25Q4 -25 4.4 -20Q2 -22 0 -21.6Q-2 -22 -4.4 -20Z" fill="#2A1E1A"/><path d="M-1.6 -14.6q1.6 1.6 3.2 0" fill="none" stroke="#2A1E1A" stroke-width="1"/>
      ${[-16, 16].map(u => `<circle cx="${u}" cy="-23" r="7" fill="#FF8A1E" fill-opacity=".2" stroke="#FFB040" stroke-width="1.2"/><circle cx="${u}" cy="-23" r="4" fill="none" stroke="#FFD27A" stroke-width=".8"/>`).join("")}</g>`;
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="3s" repeatCount="indefinite"/>`)}${sorcier}</g>`);
    // les grimoires qui flottent autour du portail
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${sx} ${sy}" to="-360 ${sx} ${sy}" dur="18s" repeatCount="indefinite"/>`)}${[0, 1, 2].map(q => { const t = q * TAU / 3 + .5, x = sx + Math.cos(t) * 54, y = sy + Math.sin(t) * 50; return `<g transform="translate(${f(x)} ${f(y)}) rotate(${q * 40 - 20})"><path d="M-7 -5Q0 -3 0 -4Q0 -3 7 -5V5Q0 7 0 6Q0 7 -7 5Z" fill="${["#8A2A1A", "#2A4A8A", "#4A6A2A"][q]}" ${INK}/><path d="M-6 -3.6Q-2 -2.6 -.6 -3M.6 -3Q2 -2.6 6 -3.6" stroke="#F4E8C8" stroke-width="1.4" fill="none"/></g>`; }).join("")}</g>`);
    // la cape rouge qui vole toute seule (figée : en vol au-dessus de la piste)
    const CAPE = [619, 538];
    const capeP = `<path d="M-8 -12Q0 -16 8 -12L10 -10Q18 4 22 16Q12 12 8 18Q2 10 0 16Q-2 10 -8 18Q-12 12 -22 16Q-18 4 -10 -10Z" fill="#C8202A" ${INK}/><path d="M-8 -12Q0 -6 8 -12" fill="#E2B93B" stroke="#8A5A14" stroke-width=".8"/><path d="M-4 -4Q-6 8 -8 16M4 -4Q6 8 8 16" fill="none" stroke="#8A1A1E" stroke-width="1"/>`;
    a.push(K.anime ? `<g><animateTransform attributeName="transform" type="translate" values="0 0;-6 -14;-78 -26;-78 -26;-6 -14;0 0" keyTimes="0;.2;.42;.58;.8;1" dur="7s" repeatCount="indefinite"/>${G(sx + 140, sy + 80, 1.3, -18)}<g><animateTransform attributeName="transform" type="skewX" values="-9;9;-9" dur="1.3s" repeatCount="indefinite"/>${capeP}</g></g></g>`
      : `<ellipse cx="${CAPE[0] + 4}" cy="${CAPE[1] + 24}" rx="11" ry="3" fill="#000" opacity=".35"/>${G(CAPE[0], CAPE[1], .78, -34)}<g transform="skewX(-8)">${capeP}</g></g>`);   // figée : en vol au-dessus de la piste
     }
  // ---- 10. le monde quantique : tunnel en spirale, l'homme-fourmi sur sa fourmi volante
  { const qx = 322, qy = 548; K.prendre(qx, qy, 70);
    let c = ""; for (let k = 9; k >= 1; k--) { const R = k * 7.2, n = 6, pts = Array.from({ length: n }, (_, q) => { const t = q * TAU / n + k * .35; return f(qx + Math.cos(t) * R) + "," + f(qy + Math.sin(t) * R); }).join(" "); c += `<polygon points="${pts}" fill="${["#0A0620", "#4AF2FF", "#2A0E5A", "#FF4AD8", "#1A0A3A", "#FFE84A", "#2A0E5A", "#8A6AFF", "#0A0620"][k - 1]}" fill-opacity="${k % 2 ? .9 : .5}" stroke="#E8DCFF" stroke-width=".6"/>`; }
    K.halo(qx, qy, 90, "#8A6AFF", .6);
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${qx} ${qy}" to="360 ${qx} ${qy}" dur="14s" repeatCount="indefinite"/>`)}${c}</g>`);
    s.push(`<circle cx="${qx}" cy="${qy}" r="68" fill="none" stroke="#4AF2FF" stroke-width="1.5" stroke-dasharray="3 5" opacity=".7"/>`);
    const fourmi = `<g transform="scale(1.5)"><ellipse cx="-7" cy="0" rx="6" ry="3.6" fill="#6A2A1A" ${INK}/><ellipse cx="1" cy="0" rx="3.2" ry="2.6" fill="#6A2A1A" ${INK}/><circle cx="6" cy="0" r="2.8" fill="#6A2A1A" ${INK}/><path d="M7 -2l4 -4M7 2l4 4" stroke="#140E1E" stroke-width=".7"/><path d="M-2 -2Q-8 -12 -14 -8Q-8 -4 -2 -2ZM-2 2Q-8 12 -14 8Q-8 4 -2 2Z" fill="#BFE8FF" fill-opacity=".6" stroke="#E8F6FF" stroke-width=".5"/>
      <circle cx="0" cy="-3.6" r="2.6" fill="#C8202A" ${INK}/><path d="M-1.6 -4.6h3.2" stroke="#5AE8FF" stroke-width=".9"/><path d="M-1 -6l-2 -3M1 -6l2 -3" stroke="#C8D0DA" stroke-width=".6"/></g>`;
    a.push(`<g${K.anime ? "" : ` transform="translate(${qx + 52} ${qy - 52}) rotate(130)"`}>${an(`<animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path="M${qx + 78} ${qy}A78 64 0 1 1 ${qx - 78} ${qy}A78 64 0 1 1 ${qx + 78} ${qy}"/>`)}${fourmi}</g>`);
    // les 4 pilotes rétrécis, en orbite dans le tunnel (clin d'œil)
    a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="360 ${qx} ${qy}" to="0 ${qx} ${qy}" dur="6s" repeatCount="indefinite"/>`)}${COULEURS_J.map((col, k) => `<circle cx="${f(qx + Math.cos(k * PI / 2) * 22)}" cy="${f(qy + Math.sin(k * PI / 2) * 22)}" r="3" fill="${col}" stroke="#FFF" stroke-width=".8"/>`).join("")}</g>`);
    nomMonde(qx, qy + 92, "Monde", "#9AF4FF"); nomMonde(qx, qy + 111, "quantique", "#9AF4FF"); }
  // ---- 11. au-dessus de tout : l'armure rouge et or qui patrouille, le bouclier étoilé qui ricoche
  { const armure = `<g transform="scale(1.4)"><path d="M-6 -2.5L-22 -5L-30 0L-22 5L-6 2.5Z" fill="#FFD27A" opacity=".55"/><path d="M-10 -2L-28 -3l0 1.6l18 1.4zM-10 2L-28 3l0 -1.6l18 -1.4z" fill="#FFF2C8" opacity=".8"/>
      <path d="M-10 -3.5h6v7h-6z" fill="url(#mv-or)" ${INK}/><path d="M-4 -5Q4 -6 6 0Q4 6 -4 5Z" fill="#C8202A" ${INK}/><circle cx="0" cy="0" r="1.8" fill="#BFF8FF"/><path d="M-2 -5l6 -5h3l-3 4M-2 5l6 5h3l-3 -4" fill="#C8202A" ${INK}/><circle cx="8.6" cy="0" r="3.2" fill="#C8202A" ${INK}/><path d="M9.6 -2v4h2" fill="url(#mv-or)"/></g>`;
    a.push(`<g${K.anime ? "" : ` transform="translate(430 180) rotate(-30)"`}>${an(`<animateMotion dur="20s" repeatCount="indefinite" rotate="auto" path="M${cx + 250} ${cy - 24}A250 108 0 1 0 ${cx - 250} ${cy - 24}A250 108 0 1 0 ${cx + 250} ${cy - 24}"/>`)}${armure}</g>`);
    const bouclier = `<g><circle r="10" fill="#C8202A" ${INK}/><circle r="7.6" fill="#F4F1EA"/><circle r="5.4" fill="#C8202A"/><circle r="3.6" fill="#2A4AC8"/><path d="M0 -3.2L.9 -1L3.1 -1L1.4 .4L2 2.7L0 1.3L-2 2.7L-1.4 .4L-3.1 -1L-.9 -1Z" fill="#FFF"/></g>`;
    a.push(`<g${K.anime ? "" : ` transform="translate(440 228)"`}>${an(`<animateMotion dur="7s" repeatCount="indefinite" path="M420 330L470 214L640 236L600 360Z"/>`)}<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".8s" repeatCount="indefinite"/>`)}${bouclier}</g></g>`); }
  // ---- 12. le panneau des 4 variants (portraits posés par l'appli dans des portails)
  const PORTR = [];
  { const px = 10, py = 600, pw = 252, ph = 110; s.push(`<rect x="${px + 3}" y="${py + 4}" width="${pw}" height="${ph}" rx="6" fill="#000" opacity=".5"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="#120A2E" stroke="#FFF2C8" stroke-width="2.5"/><rect x="${px + 4}" y="${py + 4}" width="${pw - 8}" height="${ph - 8}" rx="4" fill="none" stroke="#FF8A1E" stroke-width="1"/>`);
    s.push(`<text x="${px + pw / 2}" y="${py + 19}" text-anchor="middle" ${FONTE} font-size="12" letter-spacing="1" fill="#FFE84A" stroke="#C8202A" stroke-width="2.6" paint-order="stroke">LES 4 VARIANTS</text>`);
    const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    COULEURS_J.forEach((col, k) => { const x = px + 34 + k * 61, y = py + 56; PORTR.push({ k, x, y, r: 20 });
      s.push(`<circle cx="${x}" cy="${y}" r="27" fill="#FF8A1E" opacity=".25"/><circle cx="${x}" cy="${y}" r="24" fill="none" stroke="#FF8A1E" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="21" fill="#0A0820" stroke="${col}" stroke-width="2"/><text x="${x}" y="${py + 98}" text-anchor="middle" ${FONTE} font-size="12" fill="${col}" stroke="#0A0614" stroke-width="2.4" paint-order="stroke">${NOMS[k]}</text>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="${k % 2 ? 360 : 0} ${x} ${y}" to="${k % 2 ? 0 : 360} ${x} ${y}" dur="${5 + k}s" repeatCount="indefinite"/>`)}<circle cx="${x}" cy="${y}" r="26.5" fill="none" stroke="#FFD27A" stroke-width="2.4" stroke-dasharray="1.4 5" stroke-linecap="round"/></g>`); }); }
  // les 4 pilotes sur la piste
  COULEURS_J.forEach((col, k) => a.push(K.surPiste(.05 + k * .03, `<g><path d="M-8 -3.6h12l4 2v3.2l-4 2h-12z" fill="${col}" ${INK}/><rect x="-9" y="-5.4" width="3" height="10.8" rx="1" fill="#140E1E"/><rect x="7" y="-4.6" width="2.4" height="9.2" rx="1" fill="#140E1E"/><circle cx="0" cy="0" r="2" fill="#F4F1EA"/></g>`, 40, k * 1.2)));
  // étoiles qui scintillent (deux nappes, deux animations)
  [0, 1].forEach(q => { let g = ""; for (let k = 0; k < 26; k++) { let x, y, e = 0; do { x = r() * W; y = r() * 260; e++; } while (e < 50 && (K.dT(x, y) < 24 || (x > 250 && x < 860 && y > 110))); g += `<path d="M${f(x)} ${f(y - 3)}l.8 2.2l2.2 .8l-2.2 .8l-.8 2.2l-.8 -2.2l-2.2 -.8l2.2 -.8z" fill="#FFF"/>`; }
    a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;1;0" dur="${(2.6 + q * 1.3).toFixed(1)}s" begin="${q}s" repeatCount="indefinite"/>`)}${g}</g>`); });
  const RES = K.fin(`<rect width="${W}" height="${H}" fill="#0C0A22"/>`, "#1A0A2E", .1); RES.portraits = PORTR; return RES;
}

  /* ---------- Octobre · La Chocolaterie un soir d'Halloween (v16.x, refonte « grandes scènes ») ----------
     Le huit traverse la grande salle de la chocolaterie à la tombée de la nuit : dans la boucle droite, la cascade et la rivière
     de chocolat (bateau-bonbon, tuyaux de verre, citrouilles en sucre sur les berges) ; dans la boucle gauche, le potager
     d'Halloween (chaudron de chocolat, citrouilles lanternes, fantômes en guimauve, la myrtille géante qu'on fait rouler) ;
     en haut, les grilles de l'usine sous la lune orange et les 4 tickets d'or (portraits des pilotes) ; en bas, la salle des
     inventions ; aux coins, les boissons qui font voler, la salle des noix et ses écureuils, l'ascenseur de verre dans le ciel.
     Le pont du huit est un sucre d'orge torsadé. */
  function peindreChocolat3(T, Z, def) {
    const K = kit(T, def, 1031, "k3-"), { s, a, r, f, W, H, P, N } = K, an = x => K.anime ? x : "", INK = `stroke="#2A140A" stroke-width="1.2"`, PEAU = "#F4C8A0";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const vu = v => K.anime ? v : 1;   // opacité de départ d'un élément qui apparaît (visible et figé si les animations sont coupées)
    // place une scène au plus près de (tx, ty), loin de la piste (Rt) et des autres scènes (Ro)
    const place = (tx, ty, Ro, Rt, ex, ey) => { let best = null, bd = 1e9; ex = ex || 220; ey = ey || 160;
      for (let e = 0; e < 6000; e++) { const x = tx + (r() - .5) * ex, y = ty + (r() - .5) * ey; if (K.dT(x, y) < Rt || K.occ.some(o => Math.hypot(o[0] - x, o[1] - y) < o[2] + Ro) || x < Ro * .6 || x > W - Ro * .6 || y < Ro * .5 || y > H - Ro * .5) continue; const d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = [x, y]; } }
      if (!best) best = [tx, ty]; K.prendre(best[0], best[1], Ro); return best; };
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.1;.16;.7;.78;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 2.75 - 7)}" y="${f(y - 11)}" width="${f(txt.length * 5.5 + 14)}" height="17" rx="8" fill="#FFF8EE" stroke="#2A140A" stroke-width="1"/><path d="M${f(x - 4)} ${f(y + 6)}l2 7l6 -7" fill="#FFF8EE" stroke="#2A140A" stroke-width="1"/><text x="${f(x)}" y="${f(y + 1.5)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#3A1A0A">${txt}</text></g>`);
    // personnages et objets réutilisés
    const ouvrier = (u, v, sc, bras) => `${G(u, v, sc)}<ellipse cx="0" cy="9" rx="5" ry="1.6" fill="#000" opacity=".25"/><rect x="-4" y="-1" width="8" height="9" rx="2.5" fill="#FFFDF6" ${INK}/><path d="M-4 2h8" stroke="#C8854A" stroke-width="1.4"/><circle cx="0" cy="-5" r="4" fill="${PEAU}" ${INK}/><path d="M-4.2 -6a4.2 4.2 0 0 1 8.4 0z" fill="#6A3A1A"/><circle cx="-1.4" cy="-4.6" r=".6" fill="#2A140A"/><circle cx="1.4" cy="-4.6" r=".6" fill="#2A140A"/>${bras || ""}</g>`;
    const citrouille = (u, v, R, allume) => `${G(u, v, R / 20)}<ellipse cx="3" cy="17" rx="24" ry="5" fill="#000" opacity=".3"/><ellipse cx="-11" cy="0" rx="12" ry="17" fill="#D86A14" ${INK}/><ellipse cx="11" cy="0" rx="12" ry="17" fill="#D86A14" ${INK}/><ellipse cx="0" cy="0" rx="12" ry="18" fill="#F08A24" ${INK}/><path d="M-1 -17q1 -8 6 -9" stroke="#3E7A2A" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M5 -24q6 0 7 4" stroke="#5AA03A" stroke-width="1.4" fill="none"/>${allume ? `<path d="M-10 -5l4 -6l4 6zM2 -5l4 -6l4 6z" fill="#FFE27A"/><path d="M-11 4q11 10 22 0l-3 2l-2 -2l-3 3l-3 -3l-3 3l-3 -3l-2 2z" fill="#FFE27A"/>` : `<path d="M-6 -10q2 8 0 20M6 -10q-2 8 0 20" stroke="#B85A10" stroke-width="1" fill="none"/>`}<ellipse cx="-4" cy="-9" rx="3" ry="5" fill="#FFF" opacity=".25"/></g>`;
    const sucette = (u, v, R, c) => { K.ombre(u + R * .3, v + R * .4, R, R * .8, .3); let t = `<circle cx="${f(u)}" cy="${f(v)}" r="${f(R)}" fill="#FFF8EE" ${INK}/>`; for (let q = 0; q < 6; q++) t += `<path d="M${f(u)} ${f(v)}Q${f(u + Math.cos(q * 1.05) * R * .9)} ${f(v + Math.sin(q * 1.05) * R * .2)} ${f(u + Math.cos(q * 1.05 + .9) * R)} ${f(v + Math.sin(q * 1.05 + .9) * R)}" stroke="${c}" stroke-width="${f(R * .32)}" fill="none" stroke-linecap="round"/>`; return t + `<circle cx="${f(u)}" cy="${f(v)}" r="${f(R)}" fill="none" ${INK}/><ellipse cx="${f(u - R * .35)}" cy="${f(v - R * .4)}" rx="${f(R * .28)}" ry="${f(R * .16)}" fill="#FFF" opacity=".7"/>`; };
    // ---- dégradés et motifs
    s.push(`<radialGradient id="k3-sol" cx="50%" cy="52%" r="72%"><stop offset="0" stop-color="#8FD9AE"/><stop offset=".5" stop-color="#4FA884"/><stop offset=".85" stop-color="#3A4E6A"/><stop offset="1" stop-color="#2A2048"/></radialGradient>`);
    s.push(`<pattern id="k3-sucre" width="46" height="46" patternUnits="userSpaceOnUse">${[[6, 8, "#FF6FA8", 30], [26, 14, "#FFE27A", -20], [14, 30, "#7CC8FF", 60], [36, 36, "#FFFFFF", 10], [38, 4, "#FF9A3A", 45], [4, 40, "#C9A0FF", -50]].map(([x, y, c, g]) => `<rect x="${x}" y="${y}" width="5" height="1.8" rx=".9" fill="${c}" transform="rotate(${g} ${x} ${y})"/>`).join("")}</pattern>`);
    s.push(`<linearGradient id="k3-choc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A4A22"/><stop offset=".5" stop-color="#5E2C12"/><stop offset="1" stop-color="#3A1A0A"/></linearGradient>`);
    s.push(`<linearGradient id="k3-casc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A220C"/><stop offset=".3" stop-color="#8A4A22"/><stop offset=".55" stop-color="#A8683A"/><stop offset=".8" stop-color="#7A3E1C"/><stop offset="1" stop-color="#4A220C"/></linearGradient>`);
    s.push(`<linearGradient id="k3-verre" x1="0" x2="1"><stop offset="0" stop-color="#E8F8FF" stop-opacity=".75"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".25"/><stop offset="1" stop-color="#BFE6F6" stop-opacity=".75"/></linearGradient>`);
    s.push(`<linearGradient id="k3-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".35" stop-color="#F2C64A"/><stop offset=".75" stop-color="#C08A22"/><stop offset="1" stop-color="#7A5010"/></linearGradient>`);
    s.push(`<radialGradient id="k3-lune" r="50%"><stop offset="0" stop-color="#FFE9B0"/><stop offset=".7" stop-color="#FFB85A"/><stop offset="1" stop-color="#F08A2A"/></radialGradient>`);
    s.push(`<radialGradient id="k3-nuit" r="50%"><stop offset="0" stop-color="#1E1238"/><stop offset=".55" stop-color="#3A2252" stop-opacity=".95"/><stop offset=".8" stop-color="#4A2A5A" stop-opacity=".55"/><stop offset="1" stop-color="#4A2A5A" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="k3-pot" x1="0" x2="1"><stop offset="0" stop-color="#3A3440"/><stop offset=".35" stop-color="#5A5462"/><stop offset="1" stop-color="#1A161E"/></linearGradient>`);
    // ---- 1. le sol : prairie de sucre (mêlée de crépuscule sur les bords), touffes d'herbe à la menthe
    s.push(`<rect width="${W}" height="${H}" fill="url(#k3-sucre)" opacity=".8"/>`);
    for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * H; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(20 + r() * 50)}" ry="${f(10 + r() * 20)}" fill="${r() < .5 ? "#1E3A3A" : "#BFF2D0"}" opacity=".1"/>`); }
    // ---- 2. en haut : le ciel d'Halloween, la grande lune orange, l'usine et ses cheminées violettes
    const LX = 540, LY = 62;
    s.push(`<ellipse cx="${LX}" cy="20" rx="330" ry="170" fill="url(#k3-nuit)"/>`);
    K.halo(LX, LY, 150, "#FFB85A", .55); s.push(`<circle cx="${LX}" cy="${LY}" r="62" fill="url(#k3-lune)"/><circle cx="${LX - 18}" cy="${LY - 10}" r="9" fill="#F0A048" opacity=".45"/><circle cx="${LX + 20}" cy="${LY + 16}" r="13" fill="#F0A048" opacity=".35"/><circle cx="${LX + 26}" cy="${LY - 22}" r="5" fill="#F0A048" opacity=".4"/>`);
    for (let k = 0; k < 26; k++) { const x = 260 + r() * 560, y = 4 + r() * 90; if (Math.hypot(x - LX, y - LY) < 80) continue; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.5 + r() * .9)}" fill="#FFF6D8" opacity="${(.4 + r() * .6).toFixed(2)}"/>`); }
    { const x = 540, y = 128; s.push(`${G(x, y, 1)}
      <path d="M-210 22Q-190 -6 -150 -10H150Q190 -6 210 22Z" fill="#2A1A3A" opacity=".6"/>
      ${[[-150, -34, 22, 64], [-118, -22, 18, 52], [118, -22, 18, 52], [150, -34, 22, 64]].map(([u, v, w, h], q) => `<rect x="${u - w / 2}" y="${v - h + 22}" width="${w}" height="${h}" fill="${q % 2 ? "#6A3A9A" : "#7A4AB0"}" ${INK}/><rect x="${u - w / 2 - 3}" y="${v - h + 18}" width="${w + 6}" height="7" fill="#4A2A6A" ${INK}/>${[0, 1, 2].map(z => `<path d="M${u - w / 2} ${v - h + 34 + z * 12}h${w}" stroke="#4A2A6A" stroke-width="1.2"/>`).join("")}`).join("")}
      <rect x="-130" y="-30" width="260" height="52" fill="#8A3A4A" ${INK}/><path d="M-130 -30h260" stroke="#5A2030" stroke-width="5"/>
      ${Array.from({ length: 12 }, (_, q) => `<rect x="${-122 + q * 21}" y="-20" width="9" height="12" rx="4.5" fill="${[1, 4, 7, 10].includes(q) ? "#FFD27A" : "#3A1A2A"}" ${INK}/>`).join("")}
      <path d="M-50 -30Q-50 -66 0 -72Q50 -66 50 -30Z" fill="#9A4A5A" ${INK}/><circle cx="0" cy="-48" r="14" fill="url(#k3-or)" ${INK}/><path d="M0 -58v20M-10 -48h20" stroke="#7A5010" stroke-width="1.4"/>
      <path d="M-34 22V-10Q0 -32 34 -10V22" fill="#1A0E14" stroke="url(#k3-or)" stroke-width="3.5"/>${[-24, -12, 0, 12, 24].map(u => `<path d="M${u} 22V${-10 - (12 - Math.abs(u) / 2.4)}" stroke="#E2B93B" stroke-width="1.8"/>`).join("")}<path d="M-30 4h60" stroke="#E2B93B" stroke-width="1.5"/>
      <text x="0" y="-80" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="17" fill="#FFE9B0" stroke="#3A1A0A" stroke-width="3" paint-order="stroke">La Chocolaterie</text>
      ${[[-96, 10], [96, 10]].map(([u, v]) => `${citrouille(u, v, 11, true)}`).join("")}</g>`);
      K.halo(x - 96, y + 10, 26, "#FFB85A", .7); K.halo(x + 96, y + 10, 26, "#FFB85A", .7); K.prendre(x, y - 20, 150); K.prendre(x - 150, y - 30, 40); K.prendre(x + 150, y - 30, 40);
      // fumée des cheminées (bulles de sucre colorées) et chauves-souris qui tournent autour de la lune
      [[-150, -98, "#FFB3D9", 0], [-118, -74, "#B3E6FF", 1.2], [118, -74, "#FFF2A8", .6], [150, -98, "#C9F2C0", 1.8]].forEach(([u, v, c, b]) => a.push(`<circle cx="${f(x + u)}" cy="${f(y + v)}" r="7" fill="${c}" opacity="${K.anime ? .8 : .6}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 26)} -46" dur="3.4s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="3.4s" begin="${b}s" repeatCount="indefinite"/>`)}</circle>`));
      const chauve = (sc) => `<g transform="scale(${sc})"><ellipse rx="2.6" ry="3.6" fill="#1A0E1E"/><path d="M-2 -2l-1 -3l2 2M2 -2l1 -3l-2 2" fill="#1A0E1E"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .25;1 1" dur=".4s" repeatCount="indefinite"/>`)}<path d="M-2 -1Q-8 -8 -15 -3Q-12 -1 -11 2Q-8 0 -6 3Q-4 1 -2 2ZM2 -1Q8 -8 15 -3Q12 -1 11 2Q8 0 6 3Q4 1 2 2Z" fill="#1A0E1E"/></g><circle cx="-1" cy="-1" r=".5" fill="#FFB85A"/><circle cx="1" cy="-1" r=".5" fill="#FFB85A"/></g>`;
      [[0, 82, 30, 9, 1.3], [1, 64, 24, 7, 1], [2, 104, 40, 12, .9]].forEach(([q, R1, R2, du, sc]) => a.push(`<g${K.anime ? "" : ` transform="translate(${f(LX + Math.cos(q * 2.1) * R1)} ${f(LY + Math.sin(q * 2.1) * R2)})"`}>${an(`<animateMotion dur="${du}s" begin="-${q * 2}s" repeatCount="indefinite" path="M${LX + R1} ${LY}A${R1} ${R2} 0 1 ${q % 2} ${LX - R1} ${LY}A${R1} ${R2} 0 1 ${q % 2} ${LX + R1} ${LY}"/>`)}${chauve(sc)}</g>`)); }
    // ---- 3. les 4 tickets d'or sous l'usine (portraits des pilotes posés par l'appli)
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    { const w = 74, y0 = 182, y1 = 226;
      COULEURS_J.forEach((c, k) => { const x = 540 + (k % 2 ? 1 : -1) * (w / 2 + 3) + (k < 2 ? 0 : 0), y = k < 2 ? y0 : y1, rot = (k % 2 ? 2.5 : -2.5);
        s.push(`${G(x, y, 1, rot)}<rect x="${f(-w / 2 + 3)}" y="-17" width="${f(w)}" height="40" rx="3" fill="#000" opacity=".35"/><rect x="${f(-w / 2)}" y="-20" width="${f(w)}" height="40" rx="3" fill="url(#k3-or)" stroke="#7A5010" stroke-width="1.2"/><rect x="${f(-w / 2 + 3)}" y="-17" width="${f(w - 6)}" height="34" rx="2" fill="none" stroke="#7A5010" stroke-width=".6" stroke-dasharray="2 1.4"/>
          <circle cx="${f(-w / 2 + 18)}" cy="-1" r="15" fill="${c}" opacity=".35"/><circle cx="${f(-w / 2 + 18)}" cy="-1" r="13.5" fill="#2A1A0E" stroke="${c}" stroke-width="2"/>
          <text x="${f(-w / 2 + 33)}" y="-8" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="5.6" fill="#7A5010">TICKET D'OR</text><path d="M${f(-w / 2 + 33)} -5h${f(w - 37)}" stroke="#7A5010" stroke-width=".5"/>
          <text x="${f(-w / 2 + 33)}" y="6" font-family="Georgia, serif" font-weight="bold" font-size="10" fill="${mixHex(c, "#000000", .45)}">${NOMS[k]}</text><text x="${f(w / 2 - 6)}" y="15" text-anchor="end" font-size="6" fill="#7A5010">✦ ✦ ✦</text></g>`);
        const ang = rot * PI / 180, px = x + Math.cos(ang) * (-w / 2 + 18) - Math.sin(ang) * -1, py = y + Math.sin(ang) * (-w / 2 + 18) + Math.cos(ang) * -1; PORTR.push({ k, x: +px.toFixed(1), y: +py.toFixed(1), r: 12.5 });
        a.push(`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><rect x="${f(-w / 2 - 2)}" y="-22" width="${f(w + 4)}" height="44" rx="4" fill="none" stroke="#FFF6C8" stroke-width="2" opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.06;.2;1" dur="10s" begin="${k * 2.5}s" repeatCount="indefinite"/>`)}</rect></g>`); });
      K.prendre(540, y0 + 20, 90); bulle(540, y1 + 34, "4 tickets d'or !", 11, 2); }
    // ---- 4. la boucle droite : cascade, rivière et lac de chocolat
    const xs = P.map(p => p[0]), XMIN = Math.min(...xs), XMAX = Math.max(...xs), CROIX = (XMIN + XMAX) / 2, LOBE_G = [(XMIN + CROIX) / 2 + 10, H / 2], LOBE_D = [(XMAX + CROIX) / 2 - 10, H / 2];
    { const RX = LOBE_D[0] + 65;
      const cascX = RX + 25, cascY = 238, lacX = RX + 30, lacY = 505;
      const rv = `M${f(cascX)} ${f(cascY + 34)}C${f(cascX - 20)} ${f(cascY + 90)} ${f(RX - 130)} ${f(cascY + 120)} ${f(RX - 110)} ${f(cascY + 175)}S${f(RX + 60)} ${f(cascY + 210)} ${f(lacX - 10)} ${f(lacY - 20)}`;
      // le lac au pied de la rivière, berges de chantilly
      s.push(`<ellipse cx="${f(lacX)}" cy="${f(lacY + 4)}" rx="84" ry="48" fill="#F4E2C8"/><ellipse cx="${f(lacX)}" cy="${f(lacY)}" rx="78" ry="42" fill="#FFF8EE"/><ellipse cx="${f(lacX)}" cy="${f(lacY)}" rx="68" ry="34" fill="url(#k3-choc)"/>`);
      s.push(`<path d="${rv}" fill="none" stroke="#F4E2C8" stroke-width="62" stroke-linecap="round"/><path d="${rv}" fill="none" stroke="#FFF8EE" stroke-width="54" stroke-linecap="round"/><path d="${rv}" fill="none" stroke="url(#k3-choc)" stroke-width="40" stroke-linecap="round"/><path d="${rv}" fill="none" stroke="#3A1A0A" stroke-width="40" stroke-linecap="round" opacity=".25" stroke-dasharray="2 14"/>`);
      s.push(`<ellipse cx="${f(lacX - 20)}" cy="${f(lacY - 12)}" rx="22" ry="5" fill="#C88A58" opacity=".5"/>`);
      a.push(`<path d="${rv}" fill="none" stroke="#C88A58" stroke-width="3" stroke-dasharray="10 30" stroke-linecap="round" opacity=".75">${an(`<animate attributeName="stroke-dashoffset" from="0" to="-80" dur="2.2s" repeatCount="indefinite"/>`)}</path>`);
      s.push(`<path d="M${f(lacX + 10)} ${f(lacY + 4)}m-16 0a16 9 0 1 0 16 -9M${f(lacX + 10)} ${f(lacY + 4)}m-7 0a7 4 0 1 0 7 -4" fill="none" stroke="#C88A58" stroke-width="1.6"/>`);
      // la cascade : falaise de chocolat noir, rideau qui tombe, écume de crème
      s.push(`${G(cascX, cascY, .95)}<ellipse cx="6" cy="40" rx="84" ry="12" fill="#000" opacity=".3"/>
        <path d="M-90 8Q-96 -26 -74 -46Q-40 -54 0 -52Q40 -54 74 -46Q96 -26 90 8Q66 18 44 6L34 -32Q0 -40 -34 -32L-44 6Q-66 18 -90 8Z" fill="#3A1A0A" ${INK}/>
        <path d="M-80 -8Q-66 -18 -50 -14M-74 -30Q-58 -38 -42 -34M50 -16Q66 -20 80 -8M44 -36Q60 -40 74 -30M-70 4Q-58 -2 -48 2M52 2Q62 -4 76 4" stroke="#7A3E1C" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M-76 -44Q-40 -60 0 -56Q40 -60 76 -44Q60 -40 36 -38Q0 -44 -36 -38Q-60 -40 -76 -44Z" fill="#7FD3A6"/>${[-60, -44, -26, 26, 44, 62].map(u => `<path d="M${u} -44l-2 -7M${u + 3} -45l2 -8" stroke="#3E8A5A" stroke-width="1.4"/>`).join("")}
        ${[[-56, -58, "#FF6FA8"], [-18, -62, "#7CC8FF"], [20, -62, "#F7CF55"], [56, -56, "#C9A0FF"]].map(([u, v, c]) => `<path d="M${u} ${v + 10}v-8" stroke="#3E8A5A" stroke-width="1.6"/>${[0, 1, 2, 3, 4].map(q => `<circle cx="${f(u + Math.cos(q * 1.26) * 3.4)}" cy="${f(v + Math.sin(q * 1.26) * 3.4)}" r="2.6" fill="${c}"/>`).join("")}<circle cx="${u}" cy="${v}" r="1.8" fill="#FFF8D0"/>`).join("")}
        <path d="M-34 -32Q0 -42 34 -32Q40 0 48 30Q0 42 -48 30Q-40 0 -34 -32Z" fill="url(#k3-casc)" ${INK}/>
        <path d="M-34 -32Q0 -42 34 -32" stroke="#5E2C12" stroke-width="2" fill="none"/>
        ${[[-24, -36, -32, 28], [-8, -38, -10, 30], [10, -38, 12, 30], [26, -35, 34, 28]].map(([a1, b1, a2, b2], q) => `<path d="M${a1} ${b1}Q${(a1 + a2) / 2 + (q % 2 ? 3 : -3)} 0 ${a2} ${b2}" stroke="#F4D2B0" stroke-width="${q % 2 ? 1.2 : 2}" fill="none" opacity=".7"/>`).join("")}
        ${[[-70, 22, 13], [-56, 30, 10], [62, 22, 13], [74, 30, 9]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#4A220C" ${INK}/><path d="M${u - R * .6} ${v - R * .2}Q${u - R * .4} ${v - R * .7} ${u + R * .1} ${v - R * .75}" stroke="#8A4A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join("")}
        <ellipse cx="0" cy="34" rx="54" ry="10" fill="#FFF8EE"/>${[-44, -30, -16, 0, 16, 30, 44].map((u, q) => `<circle cx="${u}" cy="${32 - (q % 2) * 3}" r="${5 + q % 3}" fill="#FFF8EE"/>`).join("")}
        ${[[-84, -16], [84, -18]].map(([u, v]) => citrouille(u, v, 10, true)).join("")}</g>`);
      K.halo(cascX - 80, cascY - 15, 22, "#FFB85A", .7); K.halo(cascX + 80, cascY - 17, 22, "#FFB85A", .7);
      a.push(`<path d="M${f(cascX - 26)} ${f(cascY - 38)}L${f(cascX - 36)} ${f(cascY + 30)}M${f(cascX - 9)} ${f(cascY - 43)}L${f(cascX - 12)} ${f(cascY + 33)}M${f(cascX + 9)} ${f(cascY - 43)}L${f(cascX + 12)} ${f(cascY + 33)}M${f(cascX + 26)} ${f(cascY - 38)}L${f(cascX + 36)} ${f(cascY + 30)}" stroke="#F0C8A0" stroke-width="2.4" stroke-dasharray="7 11" opacity=".75">${an(`<animate attributeName="stroke-dashoffset" from="15" to="0" dur=".5s" repeatCount="indefinite"/>`)}</path>`);
      a.push(`<g opacity="${K.anime ? .9 : 1}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur=".7s" repeatCount="indefinite"/>`)}${[-30, -10, 10, 30].map(u => `<circle cx="${f(cascX + u)}" cy="${f(cascY + 36)}" r="4.5" fill="#FFFFFF" opacity=".8"/>`).join("")}</g>`);
      K.prendre(cascX, cascY, 80); K.prendre(lacX, lacY, 80); K.prendre(RX - 110, cascY + 170, 30);
      // deux tuyaux de verre qui aspirent le chocolat ; un petit gourmand coincé dans l'un (la bosse remonte)
      [[lacX + 52, lacY - 18, 1, 90], [RX - 116, cascY + 160, -1, 110]].forEach(([x, y, sd, L], k) => { const d = `M${f(x)} ${f(y)}C${f(x + sd * 30)} ${f(y - L * .4)} ${f(x + sd * 4)} ${f(y - L * .7)} ${f(x + sd * 28)} ${f(y - L)}`;
        s.push(`<path d="${d}" fill="none" stroke="#2A140A" stroke-width="18" stroke-linecap="round" opacity=".25" transform="translate(5 6)"/><path d="${d}" fill="none" stroke="#5E2C12" stroke-width="12" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#k3-verre)" stroke-width="16" stroke-linecap="round"/><circle cx="${f(x + sd * 28)}" cy="${f(y - L)}" r="9" fill="#9AA4B6" ${INK}/><circle cx="${f(x + sd * 28)}" cy="${f(y - L)}" r="4" fill="#5A6476"/>`);
        a.push(`<path d="${d}" fill="none" stroke="#9A5A30" stroke-width="5" stroke-dasharray="6 10">${an(`<animate attributeName="stroke-dashoffset" from="0" to="-32" dur=".8s" repeatCount="indefinite"/>`)}</path>`);
        if (k === 0) a.push(K.anime ? `<g><animateMotion dur="5s" repeatCount="indefinite" path="${d}"/><circle r="7" fill="${PEAU}" ${INK}/><circle cx="-2" cy="-1" r=".9" fill="#2A140A"/><circle cx="2" cy="-1" r=".9" fill="#2A140A"/><path d="M-2 3q2 -2 4 0" stroke="#2A140A" fill="none"/></g>` : `<g transform="translate(${f(x + sd * 14)} ${f(y - L * .5)})"><circle r="7" fill="${PEAU}" ${INK}/><circle cx="-2" cy="-1" r=".9" fill="#2A140A"/><circle cx="2" cy="-1" r=".9" fill="#2A140A"/></g>`); });
      bulle(lacX + 10, lacY - 128, "Augustus ! Pas le tuyau !", 9, 5);
      // le bateau-bonbon (proue en dragon de sucre) avec les 4 pilotes à bord, des petits ouvriers qui rament
      const bateau = `<g transform="scale(1.35)"><ellipse cx="2" cy="5" rx="24" ry="5" fill="#000" opacity=".25"/><path d="M-20 -7Q0 -12 20 -6L26 -12Q30 -2 22 4Q0 10 -20 7Q-26 0 -20 -7Z" fill="#FF6FA8" ${INK}/><path d="M26 -12q6 -6 4 -12q-4 4 -8 4z" fill="#FF6FA8" ${INK}/><circle cx="27" cy="-17" r="1" fill="#2A140A"/><path d="M-16 -4h32M-16 2h32" stroke="#FFFFFF" stroke-width="1.6" opacity=".7"/>${[-10, -2, 6, 14].map((u, k) => `<circle cx="${u}" cy="0" r="3" fill="${COULEURS_J[k]}" ${INK}/>`).join("")}<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-20;20;-20" dur="1s" repeatCount="indefinite"/>`)}<path d="M-14 -6l-4 -10M-14 6l-4 10M4 -6l-4 -10M4 6l-4 10" stroke="#8A5A3A" stroke-width="1.6"/></g></g>`;
      a.push(K.anime ? `<g><animateMotion dur="18s" repeatCount="indefinite" rotate="auto" path="${rv}"/>${bateau}</g>` : `<g transform="translate(${f(RX - 104)} ${f(cascY + 168)}) rotate(70)">${bateau}</g>`);
      // les citrouilles en sucre sur les berges, et les ouvriers qui pêchent le chocolat
      [[lacX - 92, lacY - 30, 15], [lacX + 86, lacY + 18, 13], [RX - 52, cascY + 96, 12]].forEach(([u, v, R]) => { if (K.dT(u, v) < R + 18) return; s.push(citrouille(u, v, R, true)); K.halo(u, v, R * 2.4, "#FFB85A", .6); });
      { const u = lacX - 40, v = lacY + 46; if (K.dT(u, v) > 22) s.push(ouvrier(u, v, 1.3, `<path d="M3 1l14 -12" stroke="#8A5A3A" stroke-width="1.4"/><path d="M17 -11q2 8 -2 14" stroke="#FFF" stroke-width=".5" fill="none"/>`) + ouvrier(u + 20, v + 4, 1.3)); } }
    // ---- 5. la boucle gauche : le potager d'Halloween
    { const [cX, cY] = LOBE_G;
      // le chaudron de chocolat chaud qui bouillonne, deux ouvriers tournent la grande louche
      const [x, y] = place(cX + 10, cY - 70, 60, 60, 120, 100); K.halo(x, y + 30, 70, "#FF8A2A", .55);
      s.push(`${G(x, y, 1.25)}<ellipse cx="4" cy="34" rx="46" ry="9" fill="#000" opacity=".35"/>${[-16, 0, 16].map(u => `<path d="M${u - 8} 34Q${u} 14 ${u + 8} 34Z" fill="#FF8A2A"/><path d="M${u - 4} 34Q${u} 22 ${u + 4} 34Z" fill="#FFE27A"/>`).join("")}
        <path d="M-40 -8Q-44 30 -18 34H18Q44 30 40 -8Z" fill="url(#k3-pot)" ${INK}/><ellipse cx="0" cy="-8" rx="42" ry="12" fill="#2A262E" ${INK}/><ellipse cx="0" cy="-7" rx="36" ry="9" fill="url(#k3-choc)"/><path d="M-30 -6q10 -4 20 0q10 4 22 -2" stroke="#A8683A" stroke-width="1.6" fill="none"/>
        <path d="M-40 4q-8 -2 -8 6M40 4q8 -2 8 6" stroke="#2A262E" stroke-width="4" fill="none"/><path d="M-28 6q4 10 0 20" stroke="#8A8494" stroke-width="2" fill="none" opacity=".6"/>
        <path d="M14 -8L36 -48" stroke="#C8854A" stroke-width="4" stroke-linecap="round"/><ellipse cx="12" cy="-6" rx="7" ry="3" fill="#C8854A"/></g>`);
      s.push(ouvrier(x + 54, y - 52, 1.4, `<path d="M-3 0l-8 -6" stroke="${PEAU}" stroke-width="2"/>`) + ouvrier(x - 50, y + 14, 1.3, `<path d="M3 1l8 -6" stroke="${PEAU}" stroke-width="2"/>`));
      for (let k = 0; k < 4; k++) a.push(`<circle cx="${f(x - 26 + k * 16)}" cy="${f(y - 12)}" r="4" fill="#8A4A22" stroke="#C88A58" stroke-width="1">${an(`<animate attributeName="r" values="1;6;1" dur="${(1.1 + k * .3).toFixed(1)}s" begin="${(k * .3).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<g opacity="${K.anime ? .7 : .5}">${an(`<animateTransform attributeName="transform" type="translate" values="0 6;4 -24" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="3s" repeatCount="indefinite"/>`)}<path d="M${f(x - 20)} ${f(y - 24)}q-6 -10 2 -18q8 -8 2 -16M${f(x + 6)} ${f(y - 26)}q-6 -10 2 -18q8 -8 2 -16" stroke="#FFF8EE" stroke-width="3" fill="none" stroke-linecap="round"/></g>`);
      // le carré de citrouilles lanternes (grosses, en sucre), leurs lueurs vacillent ensemble
      const lueurs = [];
      [[cX - 70, cY + 70, 26], [cX + 20, cY + 100, 20], [cX - 120, cY + 10, 18], [cX + 70, cY + 50, 16], [cX - 20, cY + 150, 15]].forEach(([u, v, R]) => { const [px, py] = place(u, v, R + 6, R + 22, 80, 70); s.push(`<path d="M${f(px - R)} ${f(py + R * .6)}q${f(-R * .6)} ${f(-R * .4)} ${f(-R * .9)} ${f(R * .1)}" stroke="#3E7A2A" stroke-width="2" fill="none"/>` + citrouille(px, py, R, true)); K.halo(px, py, R * 2.6, "#FFB85A", .55); lueurs.push([px, py, R]); });
      a.push(`<g opacity="${K.anime ? .5 : .35}">${an(`<animate attributeName="opacity" values=".5;.15;.6;.3;.55;.5" keyTimes="0;.15;.35;.6;.8;1" dur="2.6s" repeatCount="indefinite"/>`)}${lueurs.map(([u, v, R]) => `<circle cx="${f(u)}" cy="${f(v - R * .1)}" r="${f(R * .9)}" fill="#FFE27A"/>`).join("")}</g>`);
      // les fantômes en guimauve qui flottent au-dessus du potager
      const fant = (u, v, sc) => `${G(u, v, sc)}<ellipse cx="2" cy="22" rx="10" ry="3" fill="#000" opacity=".18"/><path d="M-10 10V-4Q-10 -16 0 -16Q10 -16 10 -4V10l-3 -3l-3 3l-4 -3l-4 3l-3 -3Z" fill="#FFFDF6" ${INK}/><ellipse cx="-3.5" cy="-5" rx="1.6" ry="2.4" fill="#2A140A"/><ellipse cx="3.5" cy="-5" rx="1.6" ry="2.4" fill="#2A140A"/><ellipse cx="0" cy="1" rx="2" ry="2.6" fill="#2A140A"/><ellipse cx="-6" cy="-1" rx="2" ry="1.2" fill="#FFB3D9" opacity=".7"/><ellipse cx="6" cy="-1" rx="2" ry="1.2" fill="#FFB3D9" opacity=".7"/></g>`;
      { const [u, v] = place(cX + 80, cY - 30, 24, 30, 90, 90); a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;8 -10;0 0" dur="3.2s" repeatCount="indefinite"/>`)}${fant(u, v, 1.5)}</g>`); bulle(u, v - 34, "Des bonbons ou un sort !", 9, 1); }
      { const [u, v] = place(cX - 110, cY - 110, 20, 26, 80, 80); a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-6 -8;0 0" dur="2.6s" repeatCount="indefinite"/>`)}${fant(u, v, 1.2)}</g>`); }
      // la myrtille géante (la fille au chewing-gum interdit) que deux ouvriers font rouler vers l'atelier de pressage
      { const [u, v] = place(cX + 90, cY + 10, 52, 52, 60, 100); const myr = `<circle cx="${f(u)}" cy="${f(v)}" r="22" fill="#5A3AC0" ${INK}/><ellipse cx="${f(u - 8)}" cy="${f(v - 9)}" rx="7" ry="4" fill="#A890FF" opacity=".7"/><circle cx="${f(u - 3)}" cy="${f(v - 2)}" r="1.6" fill="#1A1A1A"/><circle cx="${f(u + 5)}" cy="${f(v - 2)}" r="1.6" fill="#1A1A1A"/><path d="M${f(u - 3)} ${f(v + 6)}q4 3 8 0" stroke="#1A1A1A" fill="none"/><path d="M${f(u - 7)} ${f(v - 20)}q7 -9 14 0" stroke="#3A2A1A" stroke-width="3" fill="none"/>`;
        a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="-14 0;14 0;-14 0" dur="6s" repeatCount="indefinite"/>`)}${myr}${ouvrier(u - 30, v + 8, 1.2, `<path d="M3 0l6 -4" stroke="${PEAU}" stroke-width="2"/>`)}${ouvrier(u + 30, v + 8, 1.2, `<path d="M-3 0l-6 -4" stroke="${PEAU}" stroke-width="2"/>`)}</g>`); }
      // un petit ouvrier déguisé en sorcière fait le tour du potager sur un balai en réglisse
      { const R1 = 120, R2 = 150, bx = cX + 10, by = cY + 10, bal = `<g transform="scale(1.3)"><path d="M-16 2L12 -2" stroke="#2A140A" stroke-width="2.4" stroke-linecap="round"/><path d="M-16 2l-10 -5l2 5l-3 4z" fill="#E5484D" ${INK}/><circle cx="2" cy="-6" r="3.6" fill="${PEAU}" ${INK}/><path d="M-4 -8L2 -22L8 -8Z" fill="#2A140A"/><path d="M-6 -8h16" stroke="#2A140A" stroke-width="2"/><path d="M-1 -3l-3 6l8 0z" fill="#6A3A9A"/></g>`;
        a.push(K.anime ? `<g><animateMotion dur="14s" repeatCount="indefinite" path="M${f(bx + R1)} ${f(by)}A${R1} ${R2} 0 1 0 ${f(bx - R1)} ${f(by)}A${R1} ${R2} 0 1 0 ${f(bx + R1)} ${f(by)}"/>${bal}</g>` : `<g transform="translate(${f(bx - R1 * .7)} ${f(by - R2 * .7)})">${bal}</g>`); }
      // arbres à barbe à papa et sucettes géantes dans le potager
      K.semis(5, () => 16 + r() * 8, 3000, (x, y) => Math.hypot(x - cX, y - cY) < 200, (x, y, R) => { const c = ["#FFB3D9", "#B3E6FF", "#E0C8FF"][Math.floor(r() * 3)]; K.ombre(x + 5, y + 7, R, R * .8, .3); s.push(`<path d="M${f(x)} ${f(y + R)}v${f(R * .6)}" stroke="#F4E2C8" stroke-width="3"/>`); for (let q = 0; q < 6; q++) s.push(`<circle cx="${f(x + Math.cos(q * 1.05) * R * .45)}" cy="${f(y + Math.sin(q * 1.05) * R * .45)}" r="${f(R * .6)}" fill="${c}"/>`); s.push(`<circle cx="${f(x - R * .2)}" cy="${f(y - R * .25)}" r="${f(R * .45)}" fill="#FFFFFF" opacity=".55"/>`); }); }
    // ---- 6. en bas : la salle des inventions (la machine aux bonbons éternels, engrenages, vapeur, le téléviseur qui rétrécit)
    { const [x, y] = place(540, 640, 96, 70, 120, 60);
      s.push(`${G(x, y, 1.15)}<ellipse cx="6" cy="42" rx="96" ry="12" fill="#000" opacity=".3"/>
        <rect x="-84" y="-30" width="168" height="66" rx="8" fill="#C8C2D8" ${INK}/><rect x="-84" y="-30" width="168" height="10" rx="5" fill="#E8E2F4"/>
        <rect x="-74" y="-18" width="44" height="46" rx="4" fill="#9A8AB8" ${INK}/><rect x="28" y="-18" width="46" height="46" rx="4" fill="#B8A86A" ${INK}/>
        ${[0, 1, 2].map(q => `<path d="M${-64 + q * 12} -30v-22" stroke="#5A4A7A" stroke-width="4"/><circle cx="${-64 + q * 12}" cy="-54" r="4" fill="#7A6A9A" ${INK}/>`).join("")}
        <path d="M-20 -30Q-20 -58 0 -60Q20 -58 20 -30Z" fill="url(#k3-verre)" stroke="#9AC8DA" stroke-width="1.5"/>
        <path d="M84 6h18v24h-10" fill="none" stroke="#5A4A7A" stroke-width="4"/><path d="M-84 20h-12v14" stroke="#5A4A7A" stroke-width="4" fill="none"/>
        <rect x="-8" y="22" width="16" height="10" fill="#3A3A42"/>${["#FF6FA8", "#7CC8FF", "#F7CF55", "#7CF29A"].map((c, q) => `<circle cx="${-24 + q * 16}" cy="40" r="4.4" fill="${c}" ${INK}/>`).join("")}
        <rect x="-46" y="-28" width="92" height="12" rx="6" fill="#3A2A5A"/><text x="0" y="-19" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="8.5" fill="#FFE9B0">Salle des inventions</text></g>`);
      [[x - 60, y - 2, 15, 6], [x - 40, y + 18, 10, -4], [x + 58, y - 2, 13, 5]].forEach(([u, v, R, du]) => a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${f(u)} ${f(v)}" to="${du > 0 ? 360 : -360} ${f(u)} ${f(v)}" dur="${Math.abs(du)}s" repeatCount="indefinite"/>`)}<circle cx="${f(u)}" cy="${f(v)}" r="${R}" fill="#8A8A92" ${INK}/>${Array.from({ length: 8 }, (_, q) => `<rect x="${f(u - 2.5)}" y="${f(v - R - 3.5)}" width="5" height="5" fill="#8A8A92" transform="rotate(${q * 45} ${f(u)} ${f(v)})"/>`).join("")}<circle cx="${f(u)}" cy="${f(v)}" r="3.4" fill="#3A3A42"/></g>`));
      a.push(`<circle cx="${f(x)}" cy="${f(y - 46)}" r="11" fill="#FF6FA8" ${INK}>${an(`<animate attributeName="fill" values="#FF6FA8;#7CC8FF;#F7CF55;#7CF29A;#C9A0FF;#FF6FA8" dur="3s" repeatCount="indefinite"/>`)}</circle><ellipse cx="${f(x - 4)}" cy="${f(y - 50)}" rx="3.5" ry="2" fill="#FFF" opacity=".7"/>`);
      [0, 1, 2].forEach(q => a.push(`<circle cx="${f(x - 74 + q * 14)}" cy="${f(y - 66)}" r="6" fill="#FFFFFF" opacity="${K.anime ? .7 : .5}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 20)} -34" dur="2.4s" begin="${(q * .8).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".85;0" dur="2.4s" begin="${(q * .8).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`));
      bulle(x + 30, y - 84, "Ne touchez à rien !", 10, 6);
      // le téléviseur géant et le garçon tout petit qui en sort
      const [tx, ty] = place(x + 175, y + 10, 34, 34, 70, 60); s.push(`${G(tx, ty, 1.2)}<ellipse cx="3" cy="22" rx="28" ry="5" fill="#000" opacity=".3"/><rect x="-26" y="-20" width="52" height="40" rx="6" fill="#8A5A3A" ${INK}/><rect x="-20" y="-15" width="34" height="28" rx="4" fill="#BFE6F6" ${INK}/><circle cx="20" cy="-8" r="2.5" fill="#3A1A0A"/><circle cx="20" cy="2" r="2.5" fill="#3A1A0A"/><path d="M-8 -20l-8 -12M4 -20l8 -12" stroke="#3A1A0A" stroke-width="1.4"/><path d="M-20 -6h34M-20 4h34" stroke="#FFF" stroke-width=".8" opacity=".6"/></g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;14 10;14 10;0 0" keyTimes="0;.3;.5;.8;1" dur="6s" repeatCount="indefinite"/>`)}${ouvrier(tx - 4, ty - 2, .6)}</g>`); }
    // ---- les petits ouvriers chantants en file sous le pont (la leçon du jour en chanson)
    { const [x, y] = place(540, 505, 50, 26, 60, 60); s.push(`<ellipse cx="${f(x)}" cy="${f(y + 10)}" rx="50" ry="6" fill="#000" opacity=".15"/>`);
      [0, 1].forEach(q => a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur=".6s" begin="${q * .3}s" repeatCount="indefinite"/>`)}${[0, 1, 2].map(z => { const k = z * 2 + q; return ouvrier(x - 40 + k * 16, y, 1.25, `<path d="M-4 0l-4 ${k % 2 ? -6 : -3}M4 0l4 ${k % 2 ? -3 : -6}" stroke="${PEAU}" stroke-width="1.6"/>`); }).join("")}</g>`));
      [0, 1].forEach(q => a.push(`<text x="${f(x - 20 + q * 36)}" y="${f(y - 18)}" font-size="13" fill="#3A1A0A" opacity="${vu(0)}">${q ? "♫" : "♪"}${an(`<animate attributeName="opacity" values="0;1;0" dur="2s" begin="${q}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;5 -18" dur="2s" begin="${q}s" repeatCount="indefinite"/>`)}</text>`)); }
    // ---- 7. coin bas gauche : les boissons qui font voler (un ouvrier s'envole, attention au ventilateur)
    { const [x, y] = place(90, 650, 44, 40, 120, 90); s.push(`${G(x, y, 1.15)}<ellipse cx="4" cy="26" rx="36" ry="6" fill="#000" opacity=".3"/><rect x="-32" y="-22" width="64" height="46" rx="8" fill="#BFE6F6" ${INK}/>${[["#7CF29A", -22], ["#FF8FB8", -6], ["#F7CF55", 10]].map(([c, u]) => `<rect x="${u}" y="-14" width="11" height="30" rx="4" fill="${c}" ${INK}/><rect x="${u + 2}" y="-18" width="7" height="5" fill="#E8E2F4" ${INK}/>`).join("")}</g>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;12 -80;-6 -40;0 0" keyTimes="0;.45;.75;1" dur="7s" repeatCount="indefinite"/>`)}${ouvrier(x + 30, y - 30, 1.4)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".6s" repeatCount="indefinite"/>`)}${[0, 1, 2].map(q => `<circle cx="${f(x + 24 + q * 6)}" cy="${f(y - 46 - q * 4)}" r="${2 + q}" fill="none" stroke="#7CC8FF" stroke-width="1"/>`).join("")}</g></g>`);
      bulle(x + 6, y - 46, "Un rot pour redescendre !", 9, 3); }
    // ---- 8. coin bas droit : la salle des noix, les écureuils trient (la mauvaise noix part au vide-ordures)
    { const [x, y] = place(1000, 640, 62, 40, 80, 60); s.push(`${G(x, y, 1.1)}<ellipse cx="4" cy="30" rx="50" ry="7" fill="#000" opacity=".3"/><rect x="-46" y="-26" width="92" height="52" rx="6" fill="#F4E2C8" ${INK}/>`);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const u = -32 + i * 20, v = -10 + j * 22; s.push(`<ellipse cx="${u}" cy="${v}" rx="6.5" ry="5" fill="#B8733A" ${INK}/><path d="M${u - 6} ${v}q-7 -11 2 -13" stroke="#C8854A" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="${u + 5}" cy="${v - 3}" r="2.8" fill="#C8854A"/><circle cx="${u + 7}" cy="${v + 4}" r="2" fill="#8A5A2A"/>`); }
      s.push(`<ellipse cx="-30" cy="30" rx="12" ry="5" fill="#1A1A22" ${INK}/></g>`);
      a.push(`<circle cx="${f(x + 20)}" cy="${f(y + 6)}" r="2.6" fill="#5A3A1A">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;-56 26;-56 26" keyTimes="0;.55;.75;1" dur="4s" repeatCount="indefinite"/>`)}</circle>`);
      bulle(x - 20, y - 50, "Mauvaise noix !", 8, 0); }
    // ---- 9. bords : forêt de cannes en sucre et sucettes géantes (grands objets, pas de semis serré)
    K.semis(9, () => 15 + r() * 9, 4000, null, (x, y, R) => s.push(sucette(x, y, R, ["#FF6FA8", "#7CC8FF", "#F08A24", "#9A6AD0", "#2BB6A3"][Math.floor(r() * 5)])));
    K.semis(14, 10, 3000, null, (x, y) => { const ang = r() * 360; s.push(`<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})"><path d="M${f(x + 3)} ${f(y + 15)}V${f(y - 5)}a7 7 0 0 1 14 0" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" opacity=".2"/><path d="M${f(x)} ${f(y + 14)}V${f(y - 6)}a7 7 0 0 1 14 0" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round"/><path d="M${f(x)} ${f(y + 14)}V${f(y - 6)}a7 7 0 0 1 14 0" fill="none" stroke="#E5484D" stroke-width="5.5" stroke-dasharray="3.5 3.5" stroke-linecap="round"/></g>`); });
    K.semis(16, () => 6 + r() * 3, 3000, null, (x, y, R) => { const ang = r() * 360; s.push(`<g transform="rotate(${f(ang)} ${f(x)} ${f(y)})"><path d="M${f(x - R)} ${f(y - R * .8)}L${f(x + R)} ${f(y - R * .8)}L${f(x)} ${f(y + R * 1.2)}Z" fill="#FFFDF6" ${INK}/><path d="M${f(x - R * .66)} ${f(y - R * .1)}L${f(x + R * .66)} ${f(y - R * .1)}L${f(x)} ${f(y + R * 1.2)}Z" fill="#F08A24"/><path d="M${f(x - R * .3)} ${f(y + R * .55)}L${f(x + R * .3)} ${f(y + R * .55)}L${f(x)} ${f(y + R * 1.2)}Z" fill="#FFE27A"/></g>`); });   // bonbons d'Halloween (grains de maïs)
    // toiles d'araignée en sucre filé dans les deux coins du haut
    [[0, 0, 1], [W, 0, -1]].forEach(([x, y, sd]) => { let t = ""; for (let q = 0; q < 6; q++) { const g = q / 5 * PI / 2; t += `M${x} ${y}L${f(x + sd * Math.cos(g) * 120)} ${f(y + Math.sin(g) * 120)}`; } for (let j = 1; j < 5; j++) { const R = j * 26; t += "M" + [0, 1, 2, 3, 4, 5].map(q => { const g = q / 5 * PI / 2; return f(x + sd * Math.cos(g) * R) + " " + f(y + Math.sin(g) * R); }).join("L"); } s.push(`<path d="${t}" fill="none" stroke="#FFF8EE" stroke-width="1.2" opacity=".6"/>`); });
    a.push(`<g${K.anime ? "" : ` transform="translate(0 30)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 46;0 30;0 0" keyTimes="0;.4;.7;1" dur="8s" repeatCount="indefinite"/>`)}<path d="M62 0V40" stroke="#FFF8EE" stroke-width=".8"/><ellipse cx="62" cy="44" rx="5" ry="6" fill="#2A140A"/><circle cx="62" cy="38" r="3.4" fill="#2A140A"/>${[-1, 1].map(sd => `<path d="M62 42l${sd * 8} -5l${sd * 3} -4M62 45l${sd * 9} 0l${sd * 3} 4M62 47l${sd * 7} 5" stroke="#2A140A" stroke-width="1.2" fill="none"/>`).join("")}<circle cx="60.6" cy="37.4" r=".8" fill="#FF9A3A"/><circle cx="63.4" cy="37.4" r=".8" fill="#FF9A3A"/></g>`);
    // ---- 10. la piste : chocolat fondu brillant, coulures sur les bords, filet de chocolat blanc
    K.route([["#1A0A04", 42, ` opacity=".4" filter="url(#k3-flou)"`], ["#3A1A0A", 33], ["#5E2C12", 29], ["#7A3E1C", 23], ["#B07444", 4, ` transform="translate(-3 -4)" opacity=".55"`], ["#F4E8D8", 1.5, ` stroke-dasharray="14 12"`]]);
    for (let i = 0; i < N; i += 9) { if (T.Y[i] > 2.5) continue; const [nx, ny] = K.nrm(i), sd = r() < .5 ? 1 : -1, L = 2 + r() * 5; s.push(`<path d="M${f(P[i][0] + nx * sd * 14)} ${f(P[i][1] + ny * sd * 14)}l${f(nx * sd * L)} ${f(ny * sd * L)}" stroke="#3A1A0A" stroke-width="3.6" stroke-linecap="round"/><circle cx="${f(P[i][0] + nx * sd * (14 + L))}" cy="${f(P[i][1] + ny * sd * (14 + L))}" r="3.4" fill="#3A1A0A"/>`); }
    // le pont en sucre d'orge torsadé (ombre portée au sol, rambardes en cannes)
    { const haut = []; for (let i = 0; i < N; i++) if (T.Y[i] > 3) haut.push(P[i]); if (haut.length > 4) { const d = "M" + haut.map(p => f(p[0]) + " " + f(p[1])).join("L");
      s.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="46" opacity=".35" filter="url(#k3-flou8)" transform="translate(12 14)"/><path d="${d}" fill="none" stroke="#B85A10" stroke-width="44"/><path d="${d}" fill="none" stroke="#F2A93B" stroke-width="40"/><path d="${d}" fill="none" stroke="#FFF3D6" stroke-width="40" stroke-dasharray="5 9"/><path d="${d}" fill="none" stroke="#E5484D" stroke-width="40" stroke-dasharray="2 12" stroke-dashoffset="-6" opacity=".85"/>`);
      s.push(`<path d="${d}" fill="none" stroke="#3A1A0A" stroke-width="31"/><path d="${d}" fill="none" stroke="#5E2C12" stroke-width="27"/><path d="${d}" fill="none" stroke="#7A3E1C" stroke-width="21"/><path d="${d}" fill="none" stroke="#B07444" stroke-width="3.5" transform="translate(-3 -4)" opacity=".55"/><path d="${d}" fill="none" stroke="#F4E8D8" stroke-width="1.5" stroke-dasharray="14 12"/>`);
      } }
    K.depart();
    // ---- 11. l'ascenseur de verre qui traverse le ciel (le grand-père agite le bras, 4 pilotes à bord)
    a.push(`<g${K.anime ? "" : ` transform="translate(${W * .2} ${H * .06})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="-80 ${f(H * .32)};${f(W * .4)} 10;${W + 80} ${f(H * .12)}" dur="24s" repeatCount="indefinite"/>`)}<ellipse cx="8" cy="34" rx="22" ry="6" fill="#000" opacity=".15"/><rect x="-18" y="-20" width="36" height="38" rx="3" fill="url(#k3-verre)" stroke="#9AC8DA" stroke-width="1.8"/><path d="M-18 -2h36M0 -20v38" stroke="#9AC8DA" stroke-width=".9"/>${COULEURS_J.map((c, k) => `<circle cx="${-11 + k * 7.4}" cy="9" r="3.2" fill="${c}" ${INK}/>`).join("")}<rect x="-8" y="-25" width="16" height="5" fill="#C9A33A" ${INK}/><path d="M-4 -25l-6 -6M4 -25l6 -6" stroke="#9AC8DA" stroke-width="1"/></g>`);
    // ---- 12. les 4 pilotes sur la piste (petites barres de chocolat emballées à leurs couleurs)
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .025, `<g transform="scale(1.35)"><rect x="-9" y="-6" width="18" height="12" rx="3" fill="#FFF8EE"/><rect x="-8" y="-5" width="16" height="10" rx="2" fill="#3A1A0A" ${INK}/><rect x="-3" y="-5.5" width="11" height="11" rx="1.5" fill="${c}" ${INK}/><rect x="-2" y="-1.5" width="9" height="3" fill="url(#k3-or)"/></g>`, 36, k * 1.1)));
    // ---- 13. tickets d'or qui tombent du ciel, paillettes de sucre
    for (let k = 0; k < 6; k++) { const x = 40 + r() * (W - 80), y = r() * H, d = (7 + r() * 5).toFixed(1); a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 -50;${f((r() - .5) * 70)} 90" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>`)}<rect x="${f(x)}" y="${f(y)}" width="11" height="6" rx=".8" fill="url(#k3-or)" stroke="#7A5010" stroke-width=".5" transform="rotate(${f(r() * 360)} ${f(x + 5)} ${f(y + 3)})"/></g>`); }
    for (let q = 0; q < 2; q++) { let t = ""; for (let k = 0; k < 20; k++) t += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(.9 + r() * 1.3)}" fill="${q ? "#FFF6C8" : "#FFFFFF"}"/>`; a.push(`<g opacity="${K.anime ? .2 : .7}">${an(`<animate attributeName="opacity" values=".1;.9;.1" dur="${3 + q}s" begin="${q * 1.5}s" repeatCount="indefinite"/>`)}${t}</g>`); }
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#k3-sol)"/>`, "#3A1A4A", .1); RES.portraits = PORTR; return RES;
  }

  /* ---------- Novembre · L'île aux trois murs (v3 : toute l'île vue de haut, grandes scènes) ---------- */
  /* ---------- Novembre · Derrière les remparts (v4 : le gigantisme) ----------
     On est DANS les murs et on regarde vers le nord : la mer à l'horizon, les terres des titans, puis les trois grands
     remparts (Maria, Rose, Sina) en arcs de cercle, vus de face, en relief. La course sort par une porte de Maria, boucle
     chez les titans et rentre par l'autre porte. Le titan colossal (un quart de la carte) se dresse derrière Maria, la tête
     dans la vapeur, les mains agrippées au rempart juste au-dessus de la porte de droite ; un titan enjambe le mur à gauche,
     une brèche crache ses gravats, des titans de trois tailles marchent vers les murs, et quatre soldats minuscules
     (capes aux couleurs des pilotes) volent au bout de leurs câbles pour donner l'échelle. */
  function peindreTitans4(T, Z, def) {
    const K = kit(T, def, 87, "t4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    const INK = `stroke="#2A1810" stroke-width="1.3" stroke-linejoin="round"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${f(sc)})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    // ---- géométrie : trois remparts = arcs d'un même cercle dont le centre est loin sous la carte
    const CX = 540, CY = 1150, dC = (x, y) => Math.hypot(x - CX, y - CY);
    const MUR = [{ n: "MARIA", R: 790, h: 32, e: 11 }, { n: "ROSE", R: 680, h: 24, e: 9 }, { n: "SINA", R: 500, h: 18, e: 7 }];
    const yA = (R, x) => CY - Math.sqrt(Math.max(0, R * R - (x - CX) * (x - CX)));
    MUR.forEach(m => { m.portes = []; for (let i = 0; i < K.N; i++) { const p = K.P[i], q = K.P[(i + 1) % K.N], u = dC(p[0], p[1]) - m.R, v = dC(q[0], q[1]) - m.R; if (u * v > 0 || u === v) continue;
      const t = u / (u - v), x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1, sn = Math.abs((tx * (x - CX) + ty * (y - CY)) / l / m.R);
      if (!m.portes.some(g => Math.abs(g.x - x) < 40)) m.portes.push({ x, y, d: 19 / Math.max(.45, sn) }); } });
    const MA = MUR[0], RO = MUR[1], SI = MUR[2];
    const BRE = [446, 494];   // la brèche dans Maria
    const dHaut = m => { const q = []; for (let x = -12; x <= W + 12; x += 8) q.push(f(x) + " " + f(yA(m.R, x) + 1)); return `M-12 -12L${q.join("L")}L${W + 12} -12Z`; };
    // ---- dégradés et motifs
    s.push(`<linearGradient id="t4-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A5A62"/><stop offset=".6" stop-color="#E0905A"/><stop offset="1" stop-color="#F8CC80"/></linearGradient>`);
    s.push(`<linearGradient id="t4-mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7A867"/><stop offset=".25" stop-color="#5E8EA0"/><stop offset="1" stop-color="#2E5E76"/></linearGradient>`);
    s.push(`<linearGradient id="t4-terre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A88A5A"/><stop offset=".5" stop-color="#8E7C50"/><stop offset="1" stop-color="#6E6A44"/></linearGradient>`);
    s.push(`<radialGradient id="t4-pre" cx="50%" cy="100%" r="100%"><stop offset=".55" stop-color="#7C9A4C"/><stop offset="1" stop-color="#5E7E3A"/></radialGradient>`);
    s.push(`<radialGradient id="t4-champ" cx="50%" cy="100%" r="100%"><stop offset=".6" stop-color="#A9A659"/><stop offset="1" stop-color="#8E9446"/></radialGradient>`);
    s.push(`<pattern id="t4-face" width="16" height="9" patternUnits="userSpaceOnUse"><rect width="16" height="9" fill="#A69C88"/><rect x=".7" y=".7" width="14.6" height="7.6" fill="#BDB39E"/><rect x=".7" y=".7" width="14.6" height="2" fill="#CFC6B2"/><path d="M8 0v4.5" stroke="#8C8270" stroke-width=".9"/></pattern>`);
    s.push(`<radialGradient id="t4-muscle" cx="42%" cy="34%" r="70%"><stop offset="0" stop-color="#F06A56"/><stop offset=".45" stop-color="#C23A2C"/><stop offset=".8" stop-color="#7E1C16"/><stop offset="1" stop-color="#4A0E0A"/></radialGradient>`);
    s.push(`<linearGradient id="t4-bras" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E1C16"/><stop offset=".4" stop-color="#D2483A"/><stop offset="1" stop-color="#6A1612"/></linearGradient>`);
    s.push(`<radialGradient id="t4-vap" r="50%"><stop offset="0" stop-color="#FFF8EE" stop-opacity=".95"/><stop offset=".55" stop-color="#F4EADC" stop-opacity=".55"/><stop offset="1" stop-color="#F4EADC" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="t4-parch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E6C8"/><stop offset="1" stop-color="#D9C79C"/></linearGradient>`);
    const PEAUX = ["#E8B898", "#D9A07E", "#F0C8A8", "#C98E6E", "#E2AE8C"];
    // ---- un titan debout, vu de face (pieds en x,y ; hauteur 100 * sc) ; types : 0 maigre, 1 gros, 2 barbu, 3 souriant, 4 long
    const titan = (x, y, sc, o) => {
      o = o || {}; const p = o.peau || PEAUX[Math.floor(r() * PEAUX.length)], ty = o.type === undefined ? Math.floor(r() * 5) : o.type, ombreP = mixHex(p, "#5A2A1A", .35), L = `stroke="#3A2016" stroke-width="${f(1.6 / Math.max(.4, sc))}" stroke-linejoin="round"`;
      const lg = ty === 4 ? 1.25 : 1, bw = ty === 1 ? 1.45 : ty === 0 ? .85 : 1;
      let g = `<g transform="translate(${f(x)} ${f(y)}) scale(${f(o.flip ? -sc : sc)} ${f(sc)})"><ellipse cx="4" cy="1" rx="${f(24 * bw)}" ry="6" fill="#1A1008" opacity=".35"/>`;
      const hy = -44 * lg;   // hanches
      g += `<path d="M-6 ${f(hy)}L-10 -3M6 ${f(hy)}L10 -3" stroke="#3A2016" stroke-width="11.5" stroke-linecap="round"/><path d="M-6 ${f(hy)}L-10 -3M6 ${f(hy)}L10 -3" stroke="${p}" stroke-width="9" stroke-linecap="round"/><path d="M8 ${f(hy)}L11 -3" stroke="${ombreP}" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>`;
      const sh = hy - 32 * (ty === 4 ? 1.15 : 1), tw = 15 * bw;   // épaules
      const brasL = o.leve ? `M${f(-tw + 1)} ${f(sh + 3)}Q${f(-tw - 14)} ${f(sh - 12)} ${f(-tw - 10)} ${f(sh - 30)}` : `M${f(-tw + 1)} ${f(sh + 3)}Q${f(-tw - 9)} ${f(sh + 18)} ${f(-tw - 8)} ${f(sh + 34 * lg)}`;
      const brasR = `M${f(tw - 1)} ${f(sh + 3)}Q${f(tw + 9)} ${f(sh + 18)} ${f(tw + 8)} ${f(sh + 34 * lg)}`;
      g += `<path d="${brasL}${brasR}" stroke="#3A2016" stroke-width="9" stroke-linecap="round" fill="none"/><path d="${brasL}${brasR}" stroke="${p}" stroke-width="6.6" stroke-linecap="round" fill="none"/>`;
      g += `<path d="M${f(-tw)} ${f(sh)}Q${f(-tw - 3)} ${f((sh + hy) / 2)} ${f(-tw * .8)} ${f(hy + 2)}Q0 ${f(hy + 6)} ${f(tw * .8)} ${f(hy + 2)}Q${f(tw + 3)} ${f((sh + hy) / 2)} ${f(tw)} ${f(sh)}Q0 ${f(sh - 4)} ${f(-tw)} ${f(sh)}Z" fill="${p}" ${L}/>`;
      g += `<path d="M${f(tw * .25)} ${f(sh + 2)}Q${f(tw + 2)} ${f((sh + hy) / 2)} ${f(tw * .7)} ${f(hy + 3)}Q${f(tw * .9)} ${f((sh + hy) / 2)} ${f(tw * .25)} ${f(sh + 2)}Z" fill="${ombreP}" opacity=".45"/>`;
      if (ty === 1) g += `<ellipse cx="0" cy="${f(hy - 8)}" rx="${f(tw * .85)}" ry="12" fill="${p}" ${L}/><path d="M-3 ${f(hy - 7)}q3 2 6 0" stroke="#7A4A36" fill="none"/>`;
      else g += `<path d="M-6 ${f(sh + 9)}q6 3 12 0M-6 ${f(sh + 15)}q6 3 12 0" stroke="${ombreP}" stroke-width="1.2" fill="none"/><circle cx="0" cy="${f(hy - 6)}" r="1.2" fill="${ombreP}"/>`;
      const hc = sh - 12 - (ty === 1 ? 0 : 1), hr = ty === 1 ? 13 : ty === 4 ? 9.5 : 11;
      g += `<path d="M-5 ${f(sh + 1)}V${f(hc + 6)}H5V${f(sh + 1)}Z" fill="${p}"/>`;
      if (ty === 2) g += `<path d="M${f(-hr - 2)} ${f(hc - 4)}Q${f(-hr - 6)} ${f(hc + 14)} 0 ${f(hc + 22)}Q${f(hr + 6)} ${f(hc + 14)} ${f(hr + 2)} ${f(hc - 4)}Z" fill="#5A3A22" ${L}/>`;
      g += `<ellipse cx="0" cy="${f(hc)}" rx="${f(hr)}" ry="${f(hr * 1.1)}" fill="${p}" ${L}/>`;
      if (ty === 0 || ty === 4) g += `<path d="M${f(-hr - 1)} ${f(hc)}Q${f(-hr)} ${f(hc - hr * 1.3)} 0 ${f(hc - hr * 1.15)}Q${f(hr)} ${f(hc - hr * 1.3)} ${f(hr + 1)} ${f(hc)}Q${f(hr * .4)} ${f(hc - hr * .6)} ${f(-hr * .2)} ${f(hc - hr * .5)}Q${f(-hr * .7)} ${f(hc - hr * .4)} ${f(-hr - 1)} ${f(hc)}Z" fill="${["#3A2A1A", "#8A6A3A", "#2A1A12"][Math.floor(r() * 3)]}"/>`;
      if (ty === 3) g += `<path d="M${f(-hr)} ${f(hc - 3)}Q0 ${f(hc - hr * 1.6)} ${f(hr)} ${f(hc - 3)}Q0 ${f(hc - hr * .8)} ${f(-hr)} ${f(hc - 3)}Z" fill="#C8A060"/>`;
      g += `<circle cx="${f(-hr * .38)}" cy="${f(hc - 1)}" r="${f(hr * .26)}" fill="#FFF" stroke="#3A2016" stroke-width=".8"/><circle cx="${f(hr * .38)}" cy="${f(hc - 1)}" r="${f(hr * .26)}" fill="#FFF" stroke="#3A2016" stroke-width=".8"/><circle cx="${f(-hr * .38)}" cy="${f(hc - .5)}" r="${f(hr * .11)}" fill="#111"/><circle cx="${f(hr * .38)}" cy="${f(hc - .5)}" r="${f(hr * .11)}" fill="#111"/>`;
      g += ty === 3 || ty === 1 ? `<path d="M${f(-hr * .7)} ${f(hc + hr * .4)}Q0 ${f(hc + hr * .95)} ${f(hr * .7)} ${f(hc + hr * .4)}Z" fill="#5A1A14" stroke="#3A2016" stroke-width=".8"/><path d="M${f(-hr * .6)} ${f(hc + hr * .45)}H${f(hr * .6)}" stroke="#F4F1EA" stroke-width="${f(hr * .16)}" stroke-dasharray="${f(hr * .14)} ${f(hr * .06)}"/>` : `<path d="M${f(-hr * .45)} ${f(hc + hr * .5)}q${f(hr * .45)} ${f(hr * .25)} ${f(hr * .9)} 0" stroke="#5A1A14" stroke-width="1.6" fill="none"/>`;
      return g + (o.extra || "") + "</g>";
    };
    // ---- 1. le ciel du soir et la mer à l'horizon (en haut), puis les terres des titans
    s.push(`<rect width="${W}" height="${H}" fill="url(#t4-terre)"/>`);
    const rive = []; for (let x = -10; x <= W + 10; x += 20) rive.push([x, 44 + 7 * Math.sin(x / 61) + 5 * Math.sin(x / 23 + 1) + (x < 140 ? (140 - x) * .18 : 0) + (x > 960 ? (x - 960) * .1 : 0)]);
    const dRive = "M-10 -10L" + rive.map(p => f(p[0]) + " " + f(p[1])).join("L") + `L${W + 10} -10Z`;
    s.push(`<path d="${dRive}" fill="url(#t4-mer)"/><rect width="${W}" height="16" fill="url(#t4-ciel)"/><path d="M0 16C80 10 140 12 200 8C260 4 330 12 400 16Z" fill="#7A6A7A" opacity=".55"/><path d="M880 16C930 6 990 4 1080 10V16Z" fill="#7A6A7A" opacity=".5"/>`);
    s.push(`<path d="M0 16.5H${W}" stroke="#FFE6B0" stroke-width="1.5" opacity=".8"/><ellipse cx="760" cy="17" rx="160" ry="9" fill="#FFE2A0" opacity=".6" filter="url(#t4-flou8)"/><circle cx="760" cy="16" r="9" fill="#FFF0C0" opacity=".9"/>`);
    for (let k = 0; k < 40; k++) { const x = r() * W, y = 14 + r() * 26; s.push(`<path d="M${f(x)} ${f(y)}h${f(6 + r() * 14)}" stroke="${y < 22 ? "#FFE0A8" : "#A8D0DE"}" stroke-width="1" opacity=".55"/>`); }
    s.push(`<path d="M${rive.map(p => f(p[0]) + " " + f(p[1])).join("L")}" fill="none" stroke="#F4ECD0" stroke-width="5" opacity=".85"/><path d="M${rive.map(p => f(p[0]) + " " + f(p[1] + 5)).join("L")}" fill="none" stroke="#D8C48E" stroke-width="7"/>`);
    s.push(`<text x="700" y="30" font-family="Georgia, serif" font-style="italic" font-size="13" fill="#F4ECD8" opacity=".9" letter-spacing="2">la mer, enfin…</text>`);
    // terres sauvages : taches, collines, arbres morts, et des empreintes géantes qui mènent aux murs
    for (let k = 0; k < 70; k++) { const x = r() * W, y = 40 + r() * 540; if (dC(x, y) < MA.R + 10) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(16 + r() * 36)}" ry="${f(6 + r() * 12)}" fill="${r() < .5 ? "#5E5A3C" : "#C4A878"}" opacity=".22"/>`); }
    // ---- 2. dans les murs : prairie (Maria→Rose), champs (Rose→Sina), ville (Sina)
    s.push(`<circle cx="${CX}" cy="${CY}" r="${MA.R}" fill="url(#t4-pre)"/>`);
    for (let k = 0; k < 50; k++) { const x = r() * W, y = 360 + r() * 360; if (dC(x, y) > MA.R - 30 || dC(x, y) < RO.R + 10) continue; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(16 + r() * 30)}" ry="${f(5 + r() * 9)}" fill="${r() < .5 ? "#3E6A2E" : "#B4C878"}" opacity=".22"/>`); }
    s.push(`<circle cx="${CX}" cy="${CY}" r="${RO.R}" fill="url(#t4-champ)"/>`);
    { let o = ""; for (let k = 0; k < 90; k++) { const x = r() * W, y = 470 + r() * 250, d = dC(x, y); if (d > RO.R - 30 || d < SI.R + 8 || K.dT(x, y) < 26) continue; const w = 26 + r() * 40, hh = 8 + r() * 10, ang = Math.atan2(y - CY, x - CX) * 57.3 + 90;
      o += `<rect x="${f(x - w / 2)}" y="${f(y - hh / 2)}" width="${f(w)}" height="${f(hh)}" fill="${["#B8A24A", "#7E9A44", "#9AA85A", "#C9B46A", "#8C9A3E"][Math.floor(r() * 5)]}" stroke="#6E7A3A" stroke-width=".7" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`; } s.push(o); }
    s.push(`<circle cx="${CX}" cy="${CY}" r="${SI.R}" fill="#C9BEA4"/>`);
    // ---- 3. la piste : route de terre battue (sort par une porte de Maria, rentre par l'autre)
    K.route([["#1E1408", 40, ` opacity=".35" filter="url(#t4-flou)"`], ["#4E3A24", 31], ["#9A7A52", 26], ["#B8966A", 18, ` opacity=".5"`], ["#6E5236", 1.6, ` stroke-dasharray="7 9" transform="translate(-4 -1)"`], ["#6E5236", 1.6, ` stroke-dasharray="7 9" transform="translate(4 1)"`]]);
    K.depart();
    // ---- 4. les titans au loin (bande du haut, entre la mer et la piste) : plus loin = plus petits
    const loin = [[60, 66, .42, 2], [205, 90, .62, 1], [300, 70, .44, 0], [380, 92, .7, 3], [520, 74, .5, 4], [600, 92, .66, 2], [760, 72, .46, 1], [845, 91, .74, 0], [935, 84, .58, 3], [1030, 62, .4, 4], [140, 60, .36, 3]];
    loin.forEach(([x, y, sc, ty], k) => { if (K.dT(x, y) < 18) return; s.push(titan(x, y, sc, { type: ty, flip: k % 2 })); });
    // empreintes géantes dans la poussière
    const pas = (x, y, ang, sc) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)}) scale(${f(sc)})" opacity=".35"><ellipse rx="5" ry="9" fill="#4A3A22"/>${[-4, -1.5, 1, 3.5].map(u => `<circle cx="${f(u)}" cy="-11" r="1.6" fill="#4A3A22"/>`).join("")}</g>`;
    [[290, 160], [312, 186], [296, 214], [330, 196]].forEach(([x, y], k) => s.push(pas(x, y, 160 + k * 4, 1.3)));
    // ---- 5. coin haut-gauche : le titan aux longs bras qui rampe vers la piste ; à gauche : deux titans moyens
    s.push(titan(44, 300, .95, { type: 4, peau: "#D9A07E" }));
    s.push(titan(52, 470, 1.05, { type: 1, peau: "#E8B898", flip: true }));
    { const x = 62, y = 150; s.push(`${G(x, y, 1)}<ellipse cx="0" cy="6" rx="42" ry="9" fill="#1A1008" opacity=".35"/><path d="M-30 4Q-36 -16 -20 -26Q0 -34 22 -24Q36 -14 32 4Z" fill="#C98E6E" stroke="#3A2016" stroke-width="1.6"/><path d="M-28 0Q-44 -6 -50 -18M28 0Q44 -4 54 -16" stroke="#3A2016" stroke-width="8" stroke-linecap="round"/><path d="M-28 0Q-44 -6 -50 -18M28 0Q44 -4 54 -16" stroke="#C98E6E" stroke-width="5.6" stroke-linecap="round"/><ellipse cx="0" cy="-30" rx="13" ry="12" fill="#C98E6E" stroke="#3A2016" stroke-width="1.6"/><path d="M-13 -34Q0 -48 13 -34Q4 -40 -13 -34Z" fill="#2A1A12"/><circle cx="-5" cy="-30" r="3.4" fill="#FFF" stroke="#3A2016" stroke-width=".8"/><circle cx="5" cy="-30" r="3.4" fill="#FFF" stroke="#3A2016" stroke-width=".8"/><circle cx="-4.4" cy="-29.4" r="1.5" fill="#111"/><circle cx="5.6" cy="-29.4" r="1.5" fill="#111"/><path d="M-7 -23Q0 -18 7 -23Z" fill="#5A1A14"/></g>`); }
    s.push(titan(186, 262, .6, { type: 3, peau: "#F0C8A8" }));
    [[160, 300], [176, 330], [150, 350]].forEach(([x, y], k) => s.push(pas(x, y, 170 + k * 6, 1.1)));
    // ---- 6. coin haut-droit : le titan bestial, couvert de poils, qui lance des rochers sur les murs
    const BX = 1036, BY = 196;
    s.push(`${G(BX, BY, 1)}<ellipse cx="0" cy="2" rx="40" ry="8" fill="#1A1008" opacity=".4"/><path d="M-12 -70L-15 -4M12 -70L14 -4" stroke="#2A1A10" stroke-width="15" stroke-linecap="round"/><path d="M-12 -70L-15 -4M12 -70L14 -4" stroke="#7A5A3A" stroke-width="12" stroke-linecap="round"/>
      <path d="M-24 -126Q-30 -96 -18 -66Q0 -60 18 -66Q30 -96 24 -126Q0 -136 -24 -126Z" fill="#7A5A3A" stroke="#2A1A10" stroke-width="1.6"/>${Array.from({ length: 18 }, (_, k) => `<path d="M${f(-20 + (k % 6) * 8)} ${f(-124 + Math.floor(k / 6) * 18)}l-3 8l5 -2" stroke="#4A3220" stroke-width="1.4" fill="none"/>`).join("")}
      <path d="M-22 -122Q-40 -100 -44 -60" stroke="#2A1A10" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M-22 -122Q-40 -100 -44 -60" stroke="#7A5A3A" stroke-width="8.4" stroke-linecap="round" fill="none"/>
      <path d="M22 -122Q40 -140 30 -166" stroke="#2A1A10" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M22 -122Q40 -140 30 -166" stroke="#7A5A3A" stroke-width="8.4" stroke-linecap="round" fill="none"/>
      <ellipse cx="0" cy="-142" rx="15" ry="16" fill="#8A6A48" stroke="#2A1A10" stroke-width="1.6"/><path d="M-17 -146Q-20 -166 0 -164Q20 -166 17 -146Q14 -156 0 -156Q-14 -156 -17 -146Z" fill="#4A3220"/><path d="M-15 -138Q-18 -120 0 -118Q18 -120 15 -138Q8 -128 0 -128Q-8 -128 -15 -138Z" fill="#5A3E26"/><circle cx="-5.5" cy="-144" r="2.4" fill="#F4E8C0"/><circle cx="5.5" cy="-144" r="2.4" fill="#F4E8C0"/><circle cx="-5.5" cy="-144" r="1" fill="#111"/><circle cx="5.5" cy="-144" r="1" fill="#111"/></g>`);
    s.push(`<text x="${BX}" y="${BY + 16}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#F4ECD8" stroke="#3A2414" stroke-width="2.4" paint-order="stroke">le lanceur</text>`);
    // ---- 7. le titan cuirassé (à droite) qui charge la porte de Maria
    const CRX = 1012, CRY = 492;
    s.push(`${G(CRX, CRY, 1.08)}<ellipse cx="2" cy="2" rx="34" ry="8" fill="#1A1008" opacity=".4"/><path d="M-9 -50L-12 -4M9 -50L12 -4" stroke="#2A1810" stroke-width="15" stroke-linecap="round"/><path d="M-9 -50L-12 -4M9 -50L12 -4" stroke="#D8C8A8" stroke-width="12" stroke-linecap="round"/><path d="M-9 -40l-2 10M9 -40l2 10M-11 -24l-1 9M11 -24l1 9" stroke="#8A7A5A" stroke-width="1.6"/>
      <path d="M-20 -92Q-24 -70 -16 -48H16Q24 -70 20 -92Q0 -98 -20 -92Z" fill="#E4D6B8" stroke="#2A1810" stroke-width="1.6"/><path d="M-18 -88H18M-17 -78H17M-16 -68H16M-15 -58H15M0 -94V-48" stroke="#9A8A6A" stroke-width="1.4"/>
      <path d="M-19 -88Q-36 -74 -36 -52M19 -88Q36 -74 36 -52" stroke="#2A1810" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M-19 -88Q-36 -74 -36 -52M19 -88Q36 -74 36 -52" stroke="#D8C8A8" stroke-width="9.4" stroke-linecap="round" fill="none"/>
      <path d="M-12 -96Q-14 -118 0 -120Q14 -118 12 -96Q0 -92 -12 -96Z" fill="#E4D6B8" stroke="#2A1810" stroke-width="1.6"/><path d="M-10 -108H10M0 -120V-96" stroke="#9A8A6A" stroke-width="1.3"/><path d="M-8 -110l4 2M8 -110l-4 2" stroke="#2A1810" stroke-width="2.2"/><circle cx="-4.5" cy="-106" r="1.5" fill="#FFE070"/><circle cx="4.5" cy="-106" r="1.5" fill="#FFE070"/><path d="M-6 -100h12" stroke="#2A1810" stroke-width="1.4"/></g>`);
    // ---- 8. derrière Maria : la file de titans vers la brèche (perspective : plus loin = plus petits)
    [[520, 300, .46, 1], [430, 252, .38, 3], [560, 220, .3, 0], [398, 196, .3, 2], [610, 168, .24, 4]].forEach(([x, y, sc, ty], k) => s.push(titan(x, y, sc, { type: ty, flip: k % 2 })));
    // ---- 9. LE TITAN COLOSSAL : tête et épaules derrière Maria (la vapeur derrière lui)
    const CO = { x: 712, y: 248, k: 1.14 };
    K.halo(CO.x, CO.y + 20, 300, "#FFB070", .45);
    [[-120, 40, 70], [118, 30, 66], [-60, -70, 60], [70, -86, 58], [0, -120, 56], [-150, 90, 60], [150, 96, 56], [-108, -20, 48], [112, -40, 46]].forEach(([u, v, R]) => s.push(`<circle cx="${f(CO.x + u * CO.k)}" cy="${f(CO.y + v * CO.k)}" r="${f(R * CO.k)}" fill="url(#t4-vap)"/>`));
    s.push(`<clipPath id="t4-hautM"><path d="${dHaut(MA)}"/></clipPath>`);
    { let o = `<g clip-path="url(#t4-hautM)">` + G(CO.x, CO.y, CO.k);
      // trapèzes et cou (le bas est caché par Maria)
      o += `<path d="M-60 52Q-74 104 -170 128L-176 190H176L170 128Q74 104 60 52Z" fill="url(#t4-muscle)" stroke="#3A0C08" stroke-width="2.2"/>`;
      for (let k = -4; k <= 4; k++) o += `<path d="M${k * 13} 60Q${k * 16} 100 ${k * 30} 150" stroke="${k % 2 ? "#5A1210" : "#F08A72"}" stroke-width="${k % 2 ? 2 : 1.4}" fill="none" opacity=".6"/>`;
      o += `<path d="M-160 132Q-100 112 -62 120M160 132Q100 112 62 120" stroke="#F4DCCB" stroke-width="5" fill="none" opacity=".75"/><path d="M-44 60Q-36 100 -14 126M44 60Q36 100 14 126" stroke="#4A0E0A" stroke-width="5" fill="none" opacity=".7"/>`;
      // crâne écorché
      o += `<path d="M0 -98C58 -98 86 -62 84 -12C82 30 70 62 50 80C32 94 -32 94 -50 80C-70 62 -82 30 -84 -12C-86 -62 -58 -98 0 -98Z" fill="url(#t4-muscle)" stroke="#3A0C08" stroke-width="2.6"/>`;
      for (let k = -6; k <= 6; k++) o += `<path d="M${f(k * 9)} -94Q${f(k * 11.5)} -66 ${f(k * 8)} -40" stroke="${k % 2 ? "#6A1410" : "#F28C74"}" stroke-width="${k % 2 ? 2.2 : 1.6}" fill="none" opacity=".7"/>`;
      [-1, 1].forEach(sg => { for (let k = 0; k < 6; k++) o += `<path d="M${f(sg * (80 - k * 3))} ${f(-30 + k * 9)}Q${f(sg * (64 - k * 2))} ${f(10 + k * 9)} ${f(sg * (50 - k * 2))} ${f(40 + k * 7)}" stroke="${k % 2 ? "#5A1210" : "#F08A72"}" stroke-width="1.8" fill="none" opacity=".65"/>`; });
      // pommettes (os), arcade, orbites
      o += `<path d="M-74 0Q-56 -12 -30 4Q-48 2 -72 12ZM74 0Q56 -12 30 4Q48 2 72 12Z" fill="#F4DCCB" opacity=".85"/>`;
      o += `<path d="M-70 -40Q-36 -58 -6 -36Q0 -32 6 -36Q36 -58 70 -40L68 -26Q36 -42 6 -22H-6Q-36 -42 -68 -26Z" fill="#6A1410" stroke="#3A0C08" stroke-width="1.6"/>`;
      o += `<ellipse cx="-33" cy="-16" rx="22" ry="13" fill="#1A0402"/><ellipse cx="33" cy="-16" rx="22" ry="13" fill="#1A0402"/>`;
      // nez : deux fentes ; bouche sans lèvres : deux rangées de dents
      o += `<path d="M-9 4Q-12 16 -5 20Q-4 12 -9 4ZM9 4Q12 16 5 20Q4 12 9 4Z" fill="#1A0402"/>`;
      o += `<path d="M-60 26Q0 18 60 26L58 70Q0 80 -58 70Z" fill="#5A0E0A" stroke="#3A0C08" stroke-width="1.6"/>`;
      for (let k = -6; k <= 5; k++) o += `<rect x="${f(k * 9.4 + .4)}" y="28" width="8.8" height="19" rx="2.2" fill="#F2E8D4" stroke="#4A2A1A" stroke-width=".9"/><rect x="${f(k * 9.4 + .4)}" y="49" width="8.8" height="18" rx="2.2" fill="#E8DCC4" stroke="#4A2A1A" stroke-width=".9"/>`;
      o += `<path d="M-74 22Q-64 58 -52 78L-56 30ZM74 22Q64 58 52 78L56 30Z" fill="#8A1E18" opacity=".9"/>`;
      s.push(o + "</g></g>"); }
    // un peu de vapeur devant les épaules (elle passe devant le rempart)
    // ---- 10. l'enjambeur : jambe arrière (derrière Maria)
    const EJ = { x: 318, k: 1 }, yEJ = yA(MA.R, EJ.x);
    s.push(`<path d="M${f(EJ.x - 8)} ${f(yEJ - 78)}Q${f(EJ.x - 28)} ${f(yEJ - 46)} ${f(EJ.x - 22)} ${f(yEJ - 6)}" stroke="#3A2016" stroke-width="22" stroke-linecap="round" fill="none"/><path d="M${f(EJ.x - 8)} ${f(yEJ - 78)}Q${f(EJ.x - 28)} ${f(yEJ - 46)} ${f(EJ.x - 22)} ${f(yEJ - 6)}" stroke="#D49C7C" stroke-width="18" stroke-linecap="round" fill="none"/>`);
    // ---- 11. les remparts : chemin de ronde, créneaux, face en pierre, tours ; trous pour les portes et la brèche
    const mur = (m, trous) => {
      const seg = []; let cur = []; for (let x = -12; x <= W + 12; x += 4) { const dans = trous.some(([a0, a1]) => x > a0 && x < a1); if (dans) { if (cur.length > 1) seg.push(cur); cur = []; } else cur.push(x); } if (cur.length > 1) seg.push(cur);
      let o = "", cren = "";
      seg.forEach(xs => { const top = xs.map(x => [x, yA(m.R, x) - m.e]), mid = xs.map(x => [x, yA(m.R, x)]), bot = xs.map(x => [x, yA(m.R, x) + m.h]), L = q => q.map(p => f(p[0]) + " " + f(p[1])).join("L");
        o += `<path d="M${L(bot.map(p => [p[0], p[1] + 5]))}" stroke="#1A1008" stroke-width="12" fill="none" opacity=".35" filter="url(#t4-flou)"/>`;
        o += `<path d="M${L(mid)}L${L(bot.slice().reverse())}Z" fill="url(#t4-face)"/><path d="M${L(bot)}" stroke="#4A3E30" stroke-width="2.2" fill="none"/><path d="M${L(mid.map(p => [p[0], p[1] + m.h * .55]))}" stroke="#1A1008" stroke-width="${f(m.h * .9)}" fill="none" opacity=".12"/>`;
        for (let i = 0; i < xs.length; i += 9) { const x = xs[i]; if (i === 0) continue; o += `<path d="M${f(x)} ${f(yA(m.R, x) + 1)}v${f(m.h - 2)}" stroke="#7A705E" stroke-width="3.5"/><path d="M${f(x - 1.5)} ${f(yA(m.R, x) + 1)}v${f(m.h - 2)}" stroke="#D8D0BC" stroke-width="1"/>`; }
        o += `<path d="M${L(top)}L${L(mid.slice().reverse())}Z" fill="#DAD0BA" stroke="#5A4E3E" stroke-width="1.2"/>`;
        for (let i = 1; i < xs.length - 1; i += 3) { const x = xs[i], y = yA(m.R, x) - m.e; cren += `M${f(x - 2.4)} ${f(y + .5)}v${f(-m.e * .55)}h4.8v${f(m.e * .55)}Z`; } });
      return o + `<path d="${cren}" fill="#CEC4AE" stroke="#5A4E3E" stroke-width=".8"/>`;
    };
    const tour = (m, x, carre) => { const y = yA(m.R, x), w = m.h * (carre ? 1.1 : .95), hh = m.h + m.e + 10, c = "#C4BAA4";
      return `<rect x="${f(x - w / 2)}" y="${f(y - m.e - 10)}" width="${f(w)}" height="${f(hh + 4)}" fill="${c}" stroke="#4A3E30" stroke-width="1.3"/><rect x="${f(x + w * .1)}" y="${f(y - m.e - 10)}" width="${f(w * .4)}" height="${f(hh + 4)}" fill="#000" opacity=".14"/>` + (carre ? `<path d="M${f(x - w / 2 - 2)} ${f(y - m.e - 10)}h${f(w + 4)}v-5h-5v3h-4v-3h-5v3h-4v-3h-5v3h-4v-3h-${f(Math.max(0, w + 4 - 31))}Z" fill="${c}" stroke="#4A3E30" stroke-width="1"/>` : `<ellipse cx="${f(x)}" cy="${f(y - m.e - 10)}" rx="${f(w / 2 + 2)}" ry="${f(w * .22)}" fill="#D8CEB8" stroke="#4A3E30" stroke-width="1.2"/>`) + `<rect x="${f(x - 2)}" y="${f(y - 2)}" width="4" height="7" rx="2" fill="#2A2018"/>`; };
    const trousMA = MA.portes.map(g => [g.x - g.d, g.x + g.d]).concat([BRE]);
    s.push(mur(MA, trousMA));
    MA.portes.forEach(g => { s.push(tour(MA, g.x - g.d - 7, true) + tour(MA, g.x + g.d + 7, true)); });
    [70, 250, 650, 960].forEach(x => { if (!trousMA.some(([a0, a1]) => x > a0 - 20 && x < a1 + 20)) s.push(tour(MA, x)); });
    // la brèche : bords cassés, gravats qui se déversent dans la prairie
    { const yb = yA(MA.R, (BRE[0] + BRE[1]) / 2); let o = "";
      [[BRE[0], -1], [BRE[1], 1]].forEach(([x, sg]) => { const y = yA(MA.R, x); o += `<path d="M${f(x)} ${f(y - MA.e)}l${f(-sg * 5)} 8l${f(sg * 7)} 6l${f(-sg * 4)} 9l${f(sg * 5)} 10l${f(-sg * 3)} ${f(MA.h + MA.e - 33)}h${f(-sg * 2)}V${f(y - MA.e)}Z" fill="#9A907C" stroke="#4A3E30" stroke-width="1.2"/>`; });
      for (let k = 0; k < 70; k++) { const t = r(), sp = 14 + t * 70, x = (BRE[0] + BRE[1]) / 2 + (r() - .5) * 2 * sp, y = yb + 4 + t * 78 + r() * 8, R = 2.5 + r() * 6 * (1 - t * .5);
        o += `<path d="M${f(x - R)} ${f(y)}l${f(R * .6)} ${f(-R * .8)}l${f(R * .9)} ${f(-R * .1)}l${f(R * .5)} ${f(R * .7)}l${f(-R * .4)} ${f(R * .5)}Z" fill="${["#B8AE98", "#9A907C", "#CFC6B2", "#857B68"][Math.floor(r() * 4)]}" stroke="#4A3E30" stroke-width=".6"/>`; }
      s.push(o); K.halo((BRE[0] + BRE[1]) / 2, yb + 30, 70, "#E8DCC4", .5);
      s.push(titan((BRE[0] + BRE[1]) / 2 + 4, yb + 34, .62, { type: 3, peau: "#F0C8A8", leve: true }));
      }
    // ---- 12. LES MAINS DU COLOSSE agrippées à Maria (la droite juste au-dessus de la porte)
    const main = (x, sg) => { const y = yA(MA.R, x) - MA.e + 2, k = .98; let o = `<g transform="translate(${f(x)} ${f(y)}) skewY(${f(Math.asin((x - CX) / MA.R) * 57.3)}) scale(${f(sg * k)} ${f(k)})">`;
      // avant-bras qui remonte vers le coude (vers l'extérieur), ombré d'un côté
      o += `<path d="M-30 -10Q-12 -50 18 -78Q44 -92 70 -74Q56 -40 40 -10Z" fill="url(#t4-bras)" stroke="#3A0C08" stroke-width="2"/><path d="M-12 -16Q4 -48 30 -76M10 -14Q24 -46 50 -80M28 -12Q40 -40 60 -72" stroke="#F4DCCB" stroke-width="1.8" fill="none" opacity=".5"/><path d="M40 -10Q56 -40 70 -74Q60 -40 48 -10Z" fill="#3A0C08" opacity=".35"/>`;
      // dos de la main, jointures
      o += `<path d="M-46 6Q-50 -22 -26 -30Q8 -36 42 -26Q54 -10 50 6Z" fill="url(#t4-muscle)" stroke="#3A0C08" stroke-width="2"/>`;
      // 4 doigts écartés qui s'enfoncent dans la pierre (deux phalanges, griffe pâle), fissures autour
      [[-36, 34, -5], [-14, 42, -2], [9, 44, 2], [32, 36, 6]].forEach(([u, l, sk]) => { const ux = u + sk; o += `<path d="M${u - 8} 0Q${u - 9} ${f(l * .5)} ${ux - 7} ${l - 6}Q${ux} ${l + 4} ${ux + 7} ${l - 6}Q${u + 9} ${f(l * .5)} ${u + 8} 0Z" fill="url(#t4-bras)" stroke="#3A0C08" stroke-width="1.8"/><path d="M${ux - 4.5} ${l - 6}Q${ux} ${l + 1} ${ux + 4.5} ${l - 6}L${ux} ${l - 10}Z" fill="#F4E4D4" stroke="#3A0C08" stroke-width=".8"/><path d="M${u - 7} ${f(l * .3)}q7 3 14 0M${u - 7} ${f(l * .62)}q7 3 14 0" stroke="#4A0E0A" stroke-width="1.5" fill="none"/><path d="M${u - 6} -6Q${u - 2} -16 ${u + 2} -26" stroke="#F4DCCB" stroke-width="1.6" fill="none" opacity=".6"/><path d="M${ux - 9} ${l - 2}l-6 7M${ux + 9} ${l - 2}l5 8l4 -2" stroke="#3A3024" stroke-width="1" fill="none"/>`; });
      // pouce qui passe derrière, sur le chemin de ronde
      o += `<path d="M-44 -6Q-62 -14 -66 -2Q-64 8 -50 6Z" fill="url(#t4-bras)" stroke="#3A0C08" stroke-width="1.8"/>`;
      return o + "</g>"; };
    const MD = 830, MG = 566;
    s.push(main(MG, -1), main(MD, 1));
    // vapeur devant (là où le corps touche le mur)
    [[600, 350, 26], [790, 372, 30], [700, 368, 34]].forEach(([x, y, R]) => s.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="url(#t4-vap)" opacity=".8"/>`));
    // ---- 13. l'enjambeur : le corps au-dessus du mur, la jambe avant posée dans la prairie
    { const x = EJ.x, y0 = yEJ, p = "#D49C7C", L = `stroke="#3A2016" stroke-width="2"`;
      let o = `<path d="M${f(x + 8)} ${f(y0 - 78)}Q${f(x + 30)} ${f(y0 - 10)} ${f(x + 40)} ${f(y0 + 52)}" stroke="#3A2016" stroke-width="23" stroke-linecap="round" fill="none"/><path d="M${f(x + 8)} ${f(y0 - 78)}Q${f(x + 30)} ${f(y0 - 10)} ${f(x + 40)} ${f(y0 + 52)}" stroke="${p}" stroke-width="19" stroke-linecap="round" fill="none"/><path d="M${f(x + 14)} ${f(y0 - 64)}Q${f(x + 34)} ${f(y0 - 10)} ${f(x + 44)} ${f(y0 + 46)}" stroke="#9A5E44" stroke-width="5" stroke-linecap="round" fill="none" opacity=".45"/><ellipse cx="${f(x + 44)}" cy="${f(y0 + 60)}" rx="16" ry="6" fill="#1A1008" opacity=".4"/><ellipse cx="${f(x + 44)}" cy="${f(y0 + 56)}" rx="13" ry="6" fill="${p}" ${L}/>`;
      o += `<path d="M${f(x - 26)} ${f(y0 - 160)}Q${f(x - 30)} ${f(y0 - 110)} ${f(x - 18)} ${f(y0 - 76)}Q${f(x)} ${f(y0 - 66)} ${f(x + 18)} ${f(y0 - 76)}Q${f(x + 30)} ${f(y0 - 110)} ${f(x + 26)} ${f(y0 - 160)}Q${f(x)} ${f(y0 - 166)} ${f(x - 26)} ${f(y0 - 160)}Z" fill="${p}" ${L}/><path d="M${f(x + 6)} ${f(y0 - 158)}Q${f(x + 30)} ${f(y0 - 112)} ${f(x + 16)} ${f(y0 - 78)}Q${f(x + 22)} ${f(y0 - 120)} ${f(x + 6)} ${f(y0 - 158)}Z" fill="#9A5E44" opacity=".4"/><path d="M${f(x - 10)} ${f(y0 - 140)}q10 4 20 0M${f(x - 10)} ${f(y0 - 128)}q10 4 20 0M${f(x - 9)} ${f(y0 - 116)}q9 4 18 0" stroke="#9A5E44" stroke-width="1.6" fill="none"/><circle cx="${f(x)}" cy="${f(y0 - 96)}" r="1.8" fill="#9A5E44"/>`;
      o += `<path d="M${f(x - 24)} ${f(y0 - 156)}Q${f(x - 52)} ${f(y0 - 130)} ${f(x - 60)} ${f(y0 - 92)}M${f(x + 24)} ${f(y0 - 156)}Q${f(x + 60)} ${f(y0 - 168)} ${f(x + 82)} ${f(y0 - 196)}" stroke="#3A2016" stroke-width="16" stroke-linecap="round" fill="none"/><path d="M${f(x - 24)} ${f(y0 - 156)}Q${f(x - 52)} ${f(y0 - 130)} ${f(x - 60)} ${f(y0 - 92)}M${f(x + 24)} ${f(y0 - 156)}Q${f(x + 60)} ${f(y0 - 168)} ${f(x + 82)} ${f(y0 - 196)}" stroke="${p}" stroke-width="12.5" stroke-linecap="round" fill="none"/>`;
      o += `<path d="M${f(x - 8)} ${f(y0 - 162)}V${f(y0 - 178)}H${f(x + 8)}V${f(y0 - 162)}Z" fill="${p}"/><ellipse cx="${f(x)}" cy="${f(y0 - 194)}" rx="19" ry="21" fill="${p}" ${L}/><path d="M${f(x - 21)} ${f(y0 - 192)}Q${f(x - 24)} ${f(y0 - 222)} ${f(x)} ${f(y0 - 220)}Q${f(x + 26)} ${f(y0 - 222)} ${f(x + 22)} ${f(y0 - 186)}Q${f(x + 30)} ${f(y0 - 160)} ${f(x + 18)} ${f(y0 - 150)}Q${f(x + 16)} ${f(y0 - 190)} ${f(x)} ${f(y0 - 204)}Q${f(x - 12)} ${f(y0 - 200)} ${f(x - 21)} ${f(y0 - 192)}Z" fill="#E8D49A" stroke="#3A2016" stroke-width="1.4"/>`;
      o += `<circle cx="${f(x - 7)}" cy="${f(y0 - 194)}" r="4.6" fill="#FFF" stroke="#3A2016"/><circle cx="${f(x + 7)}" cy="${f(y0 - 194)}" r="4.6" fill="#FFF" stroke="#3A2016"/><circle cx="${f(x - 6)}" cy="${f(y0 - 193)}" r="2" fill="#111"/><circle cx="${f(x + 8)}" cy="${f(y0 - 193)}" r="2" fill="#111"/><path d="M${f(x - 12)} ${f(y0 - 182)}Q${f(x)} ${f(y0 - 172)} ${f(x + 12)} ${f(y0 - 182)}Z" fill="#5A1A14" stroke="#3A2016"/><path d="M${f(x - 10)} ${f(y0 - 181)}H${f(x + 10)}" stroke="#F4F1EA" stroke-width="2.4" stroke-dasharray="2 .8"/>`;
      s.push(o); }
    // ---- 14. Rose et Sina
    s.push(mur(RO, RO.portes.map(g => [g.x - g.d, g.x + g.d])));
    RO.portes.forEach(g => s.push(tour(RO, g.x - g.d - 6, true) + tour(RO, g.x + g.d + 6, true)));
    [400, 690].forEach(x => s.push(tour(RO, x)));
    s.push(mur(SI, []));
    [330, 760].forEach(x => s.push(tour(SI, x))); s.push(tour(SI, 528, true) + tour(SI, 552, true));
    // noms gravés sur la face des remparts
    const grav = (m, x0, x1, dy, fs) => { const id = "t4-l" + m.n, d = []; for (let x = x0; x <= x1; x += 10) d.push(f(x) + " " + f(yA(m.R, x) + m.h * dy)); s.push(`<path id="${id}" d="M${d.join("L")}" fill="none"/><text font-family="Georgia, serif" font-weight="bold" font-size="${fs}" letter-spacing="5" fill="#3E3428" opacity=".85"><textPath href="#${id}" startOffset="50%" text-anchor="middle">MUR ${m.n}</textPath></text>`); };
    grav(MA, 170, 300, .72, 15); grav(RO, 440, 660, .78, 13); grav(SI, 350, 470, .86, 11);
    { const xb = (BRE[0] + BRE[1]) / 2, yb = yA(MA.R, xb); s.push(`<text x="${f(xb - 4)}" y="${f(yb + 92)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="13" fill="#3A2414" stroke="#F4ECD8" stroke-width="3.2" paint-order="stroke">« Le mur est percé ! »</text>`); }
    // ---- 15. entre Maria et Rose : soldats en rang, canons sur le chemin de ronde, arbres ; la ville derrière Sina
    for (let k = 0; k < 16; k++) { const x = 600 + k * 9, y = yA(MA.R, x) + MA.h + 16 + (k % 2) * 4; if (x > MD - 50) break; s.push(`<path d="M${f(x)} ${f(y)}l-2 -6h4z" fill="#3A6A3A"/><circle cx="${f(x)}" cy="${f(y - 7)}" r="1.4" fill="#E8C4A0"/>`); }
    const canons = [380, 540, 760, 930].filter(x => !trousMA.some(([a0, a1]) => x > a0 - 10 && x < a1 + 10));
    canons.forEach(x => { const y = yA(MA.R, x) - MA.e / 2; s.push(`<rect x="${f(x - 6)}" y="${f(y - 3)}" width="12" height="5" rx="2" fill="#2A2A2E"/><circle cx="${f(x - 3)}" cy="${f(y + 2)}" r="2" fill="#5A3A22"/><circle cx="${f(x + 3)}" cy="${f(y + 2)}" r="2" fill="#5A3A22"/>`); });
    K.semis(16, 9, 2500, (x, y) => dC(x, y) < MA.R - 46 && dC(x, y) > RO.R + 14 && !(x > 280 && x < 520 && y < 480), (x, y, R) => K.arbre(x, y, R, "#8EBA6A", "#4E7E3A", "#2A4A22"));
    K.semis(18, 7, 2500, (x, y) => dC(x, y) < RO.R - 34 && dC(x, y) > SI.R + 14, (x, y, R) => K.arbre(x, y, R, "#9EC27A", "#5A8A44", "#2E5A2A"));
    // soldats minuscules sur le chemin de ronde, face au colosse (pour l'échelle)
    for (let k = 0; k < 9; k++) { const x = 662 + k * 12, y = yA(MA.R, x) - MA.e * .45; s.push(`<path d="M${f(x)} ${f(y + 1)}l-2.2 -6h4.4z" fill="#3A6A3A"/><circle cx="${f(x)}" cy="${f(y - 6)}" r="1.5" fill="#E8C4A0"/>`); }
    // l'enclos des chevaux (selles aux couleurs des 4)
    { const x = 1000, y = 662; let o = `<ellipse cx="${x}" cy="${y}" rx="62" ry="30" fill="#B4C878" opacity=".5" stroke="#6A4A2A" stroke-width="2.2" stroke-dasharray="6 3"/>`;
      COULEURS_J.forEach((c, k) => { const hx = x - 36 + k * 24, hy = y - 8 + (k % 2) * 14; o += `${G(hx, hy, 1.2, k % 2 ? 0 : 0)}<ellipse cx="1" cy="5" rx="9" ry="2.4" fill="#000" opacity=".3"/><path d="M-7 4v-4M6 4v-4" stroke="#3A2414" stroke-width="2"/><ellipse cx="0" cy="-2" rx="8.5" ry="4" fill="${["#6A4A2A", "#3A2A1E", "#8A6A48", "#4A3424"][k]}" stroke="#1E1610" stroke-width=".7"/><path d="M6 -4l5 -6l3 1l-3 6z" fill="${["#6A4A2A", "#3A2A1E", "#8A6A48", "#4A3424"][k]}" stroke="#1E1610" stroke-width=".7"/><rect x="-3" y="-6" width="6" height="4" rx="1" fill="${c}"/></g>`; });
      s.push(o + `<text x="${x}" y="${y + 42}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="10" fill="#F4ECD8" stroke="#3A2414" stroke-width="2.4" paint-order="stroke">les écuries</text>`); }
    // la capitale au-delà de Sina (en bas, coupée par le bord) : le palais aux 4 fanions
    { const x = 540, y = yA(SI.R, 540) + SI.h + 2; let o = "";
      [[-60, 30, 40], [-22, 22, 58], [22, 22, 58], [60, 30, 40]].forEach(([u, w, hh], k) => { o += `<rect x="${f(x + u - w / 2)}" y="${f(y + 70 - hh)}" width="${w}" height="${hh + 10}" fill="#D8CCB0" stroke="#4A3E30" stroke-width="1.3"/><path d="M${f(x + u - w / 2 - 3)} ${f(y + 70 - hh)}L${f(x + u)} ${f(y + 70 - hh - w * .9)}L${f(x + u + w / 2 + 3)} ${f(y + 70 - hh)}Z" fill="#3E5A7A" stroke="#22324A" stroke-width="1.2"/><path d="M${f(x + u)} ${f(y + 70 - hh - w * .9)}v-12" stroke="#3A2414" stroke-width="1.2"/><path d="M${f(x + u)} ${f(y + 58 - hh - w * .9)}l11 3l-11 3z" fill="${COULEURS_J[k]}"/><rect x="${f(x + u - 3)}" y="${f(y + 80 - hh)}" width="6" height="9" rx="3" fill="#3A3024"/>`; });
      s.push(o); }
    // ---- 16. l'affiche du Bataillon d'exploration (4 cadres portraits)
    const PORTR = [];
    { const px = 14, py = 624, pw = 246, ph = 88; let o = `<g><rect x="${px + 4}" y="${py + 5}" width="${pw}" height="${ph}" rx="4" fill="#000" opacity=".4"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="4" fill="url(#t4-parch)" stroke="#6A4A2A" stroke-width="2"/>`;
      o += `<text x="${px + pw / 2}" y="${py + 16}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10.5" letter-spacing="1.5" fill="#3A2414">BATAILLON D'EXPLORATION</text>`;
      COULEURS_J.forEach((c, k) => { const x = px + 34 + k * 59, y = py + 46; PORTR.push({ k, x, y, r: 18 }); o += `${G(x, y, 1)}<path d="M-24 -10Q-30 -24 -14 -22L0 -16L14 -22Q30 -24 24 -10L18 8L0 0L-18 8Z" fill="${c}" opacity=".4"/><circle r="20" fill="#2A2018" stroke="${c}" stroke-width="2.4"/></g><text x="${f(x)}" y="${f(y + 31)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="8.5" fill="${mixHex(c, "#000000", .3)}">${NOMS[k]}</text>`; });
      o += `<text x="${px + pw / 2}" y="${py + ph - 3}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="8.5" fill="#6A2414">« Offrez vos cœurs ! »</text></g>`;
      s.push(o); for (let q = 0; q < 5; q++) K.prendre(px + 26 + q * 50, py + ph / 2, 50); }
    // ================= COUCHE ANIMÉE =================
    // vapeur qui monte du colosse
    for (let k = 0; k < 7; k++) { const x = CO.x + (k - 3) * 44 + (r() - .5) * 20, y = CO.y + 40 - (k % 3) * 30, R = 22 + r() * 14, d = (5 + r() * 3).toFixed(1), b = (-r() * 6).toFixed(1);
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#t4-vap)" opacity="${K.anime ? 0 : .55}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 40)} -90" dur="${d}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" keyTimes="0;.3;1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`)}</circle>`); }
    // ses yeux qui s'allument
    { const ex = (u) => [CO.x + u * CO.k, CO.y - 16 * CO.k]; a.push(`<g opacity="${K.anime ? .3 : 1}">${an(`<animate attributeName="opacity" values=".3;.3;1;1;.3" keyTimes="0;.55;.62;.9;1" dur="7s" repeatCount="indefinite"/>`)}${[-33, 33].map(u => { const [x, y] = ex(u); return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="#FFB060" opacity=".35"/><circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#FFF2C0"/><circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="#2A0A04"/>`; }).join("")}</g>`); }
    // 4 soldats minuscules au bout de leurs câbles (capes aux couleurs des pilotes) : ils se balancent autour des géants
    const soldat = c => `<g><path d="M-1 -2L-9 6L-3 5L-6 12L1 4Z" fill="${c}" stroke="#1A1008" stroke-width=".6"/><rect x="-2" y="-5" width="4" height="7" rx="1.5" fill="#4A3A2A"/><circle cx="0" cy="-6.5" r="2" fill="#E8C4A0"/><path d="M-4 1l-4 3M4 1l4 3" stroke="#BFC6CC" stroke-width="1.2"/><path d="M5 -3l7 -6" stroke="#E8F0F4" stroke-width="1.2"/></g>`;
    [[CO.x - 70, CO.y - 60, 92, -40, 30, 0], [CO.x + 92, CO.y - 40, 80, -30, 40, 1], [EJ.x + 20, yEJ - 196, 70, -20, 50, 2], [MD + 40, yA(MA.R, MD + 40) - MA.e - 20, 60, -50, 10, 3]].forEach(([x, y, l, a0, a1, k]) => {
      const d = (3.2 + k * .5).toFixed(1); a.push(`<g transform="translate(${f(x)} ${f(y)}) rotate(${(a0 + a1) / 2})">${an(`<animateTransform attributeName="transform" type="rotate" values="${a0};${a1};${a0}" dur="${d}s" additive="sum" repeatCount="indefinite"/>`)}<path d="M0 0L${f(-3)} ${f(l)}M0 0L3 ${f(l)}" stroke="#E8F0F4" stroke-width="1" opacity=".9"/><g transform="translate(0 ${f(l)}) scale(1.25)">${soldat(COULEURS_J[k])}</g></g>`); });
    // titans qui marchent vers la brèche ; gravats qui tombent ; poussière
    for (let k = 0; k < 4; k++) { const x = BRE[0] + 6 + r() * (BRE[1] - BRE[0] - 12), y = yA(MA.R, x) - MA.e, d = (1.4 + r()).toFixed(1), b = (-r() * 2).toFixed(1);
      a.push(`<path d="M${f(x - 3)} ${f(y)}l3 -4l4 1l1 4l-3 3z" fill="#9A907C" stroke="#4A3E30" stroke-width=".6">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 30)} ${f(40 + r() * 30)}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;.8;1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`)}</path>`); }
    { const x = (BRE[0] + BRE[1]) / 2, y = yA(MA.R, x) + 10; a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="40" fill="url(#t4-vap)" opacity=".45">${an(`<animate attributeName="r" values="30;56;30" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;.2;.55" dur="4s" repeatCount="indefinite"/>`)}</circle>`); }
    // canons qui tirent sur les géants (flash + fumée)
    canons.forEach((x, k) => { const y = yA(MA.R, x) - MA.e / 2 - 4, d = (3 + k * .7).toFixed(1); a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;1;.6;0;0" keyTimes="0;.04;.2;.45;1" dur="${d}s" begin="${k * .9}s" repeatCount="indefinite"/>`)}<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="#FFE080"/><circle cx="${f(x + 2)}" cy="${f(y - 8)}" r="9" fill="#F4F1EA" opacity=".8"/><circle cx="${f(x - 5)}" cy="${f(y - 14)}" r="7" fill="#F4F1EA" opacity=".6"/></g>`); });
    // fusées éclairantes vertes au-dessus des portes
    MA.portes.forEach((g, k) => { const x = g.x + (k ? 26 : -26), y = yA(MA.R, g.x) - 30, d = (4 + k).toFixed(1); a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 30;0 -60" dur="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.7;1" dur="${d}s" repeatCount="indefinite"/>`)}<path d="M${f(x)} ${f(y)}v40" stroke="#7CE08A" stroke-width="5" opacity=".35" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#C8FFB0"/></g>`); });
    // le lanceur : le rocher qui vole vers Maria
    { const x0 = BX + 30, y0 = BY - 166, x1 = 930, y1 = yA(MA.R, 930) - 10; a.push(`<g>${an(`<animateMotion dur="3.6s" repeatCount="indefinite" path="M0,0 Q${f((x1 - x0) / 2)},-60 ${f(x1 - x0)},${f(y1 - y0)}"/>`)}<circle cx="${f(x0)}" cy="${f(y0)}" r="9" fill="#7A7060" stroke="#2A2018" stroke-width="1.2"/><circle cx="${f(x0 - 3)}" cy="${f(y0 - 3)}" r="3" fill="#A49A88"/></g>`); }
    // vagues, mouettes
    a.push(`<g opacity=".7">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-18 1;0 0" dur="6s" repeatCount="indefinite"/>`)}${rive.filter((_, i) => i % 3 === 0).map(p => `<path d="M${f(p[0])} ${f(p[1] - 6)}q6 -3 12 0t12 0" stroke="#F4ECD8" stroke-width="1.4" fill="none"/>`).join("")}</g>`);
    [[180, 26], [620, 18]].forEach(([x, y], k) => a.push(`<path d="M${x} ${y}q4 -4 8 0q4 -4 8 0" stroke="#3A2A1A" stroke-width="1.3" fill="none">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${k ? -80 : 90} 6;0 0" dur="${14 + k * 4}s" repeatCount="indefinite"/>`)}</path>`));
    // les 4 pilotes à cheval sur la piste, capes aux couleurs des 4
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `<g transform="scale(1.5)"><ellipse rx="8" ry="3.4" fill="#6A4A2A" stroke="#1E1610" stroke-width=".7"/><ellipse cx="8" cy="0" rx="3.4" ry="2" fill="#5A3E22" stroke="#1E1610" stroke-width=".6"/><path d="M-8 0l-4 -1.5l1 1.5l-1 1.5z" fill="#2A1A0A"/><path d="M-5 -4.2L2 -2.8L2 2.8L-5 4.2Z" fill="${c}" stroke="#1E1610" stroke-width=".6"/><circle cx="1.5" cy="0" r="2.2" fill="#E8C4A0" stroke="#1E1610" stroke-width=".5"/></g>`, 44, k * 1.1)));
    K.particules(8, "#F4E8D8", 2.4, "monte");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#6E6A44"/>`, "#C87A4A", .1); RES.portraits = PORTR; return RES;
  }

  /* ---------- Décembre · L'Odyssée (finale) : de Troie en flammes à Ithaque, sur une mer turquoise ----------
     La piste est la route d'Ulysse (une chaussée de sable bordée d'écume) ; chaque grande escale est une scène
     illustrée posée le long du voyage, dans l'ordre du récit : Troie → Cyclope → Éole → Circé → Sirènes →
     Charybde et Scylla → Poséidon (au centre, colossal) → Ithaque (juste avant l'arrivée). */
  /* ---------- Décembre · L'Odyssée v2 (finale) : une seule grande mer au coucher du soleil ----------
     Une seule scène unifiée, lue d'un coup d'œil dans le sens de la course : Troie en flammes et le cheval de bois
     (départ, en bas) → la galère d'Ulysse et son sillage s'enfoncent dans la tempête → au cœur de la carte, Poséidon
     géant surgit des vagues, trident levé → en haut à droite, le détroit de Charybde et de Scylla aux six têtes →
     en bas à droite, Ithaque baignée d'or (le palais aux 4 boucliers-portraits, l'arc et les 12 haches).
     Polyphème guette depuis le coin bas gauche. Une seule lumière : le soleil couchant derrière Ithaque. */
  function peindreOdyssee2(T, Z, def) {
    const K = kit(T, def, 27, "o2-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#1A1020" stroke-width="1.3"`, PEAU = "#E8B48A";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const nom = (x, y, txt, t) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="${t || 15}" fill="#FFF3D0" stroke="#1A1238" stroke-width="3.4" paint-order="stroke" letter-spacing=".6">${txt}</text>`);
    const bulle = (x, y, txt, du, deb) => a.push(`<g opacity="${K.anime ? 0 : 1}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 3.2 - 7)}" y="${f(y - 12)}" width="${f(txt.length * 6.4 + 14)}" height="19" rx="9" fill="#FFFDF6" stroke="#1A1020" stroke-width="1.1"/><path d="M${f(x - 4)} ${f(y + 7)}l2 7l6 -7" fill="#FFFDF6" stroke="#1A1020" stroke-width="1.1"/><text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#1A1020">${txt}</text></g>`);
    // la galère vue de côté (coque, œil peint, rames, voile carrée) ; mat = ce qu'on attache au mât
    const galere = (x, y, sc, voile, fl, mat, rot) => `${G(x, y, sc, rot)}<g transform="scale(${fl ? -1 : 1} 1)">${[-22, -14, -6, 2, 10, 18].map(u => `<path d="M${u} 0l-6 9" stroke="#4A2E16" stroke-width="1.3"/>`).join("")}<path d="M-36 -10Q-30 4 0 4Q26 4 34 -8L40 -16Q36 -8 30 -9Z" fill="#6A3E1E" ${INK}/><path d="M-36 -10Q-40 -16 -44 -14Q-40 -10 -34 -8" fill="#6A3E1E" ${INK}/><path d="M-32 -6H30" stroke="#E2B93B" stroke-width="1.6"/><circle cx="26" cy="-6" r="2" fill="#F4F1EA" stroke="#1A1020" stroke-width=".6"/><circle cx="26.6" cy="-6" r=".9" fill="#1A1020"/>
      <path d="M-2 -8V-46" stroke="#4A2E16" stroke-width="2.2"/><path d="M-18 -42H14" stroke="#4A2E16" stroke-width="1.6"/><path d="M-17 -42Q-20 -26 -16 -14H12Q16 -26 13 -42Z" fill="${voile}" ${INK}/><path d="M-17 -34Q-2 -30 13 -34M-18 -24Q-2 -20 14 -24" stroke="#000" stroke-opacity=".2" stroke-width="2" fill="none"/>${mat || ""}</g></g>`;
    // une crête de vague « à la japonaise » (rouleau d'écume griffu), dessinée vers la droite
    const crete = (x, y, sc, fl, c1, c2) => `${G(x, y, sc)}<g transform="scale(${fl ? -1 : 1} 1)"><path d="M-40 10Q-30 -20 0 -30Q26 -36 34 -16Q36 -4 26 -2Q30 -14 18 -18Q4 -20 0 -6Q-4 6 -14 10Z" fill="${c1 || "#1E6A8E"}" ${INK}/><path d="M-30 4Q-20 -18 2 -24Q22 -28 28 -16" stroke="#BFF4EE" stroke-width="2.4" fill="none" opacity=".8"/><path d="M34 -16Q38 -24 32 -30M28 -26q6 -8 2 -14M20 -30q4 -8 -2 -12" stroke="${c2 || "#F4FFFC"}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M26 -2Q30 -14 18 -18Q8 -18 6 -10Q14 -12 18 -6Z" fill="${c2 || "#F4FFFC"}"/></g></g>`;
    // ---- 0. dégradés : la mer éclairée par le soleil couchant (en bas à droite), assombrie par la tempête (au centre gauche)
    s.push(`<radialGradient id="o2-mer" cx="96%" cy="92%" r="118%" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#FFE6A8"/><stop offset=".1" stop-color="#F7B866"/><stop offset=".22" stop-color="#5FCFC0"/><stop offset=".42" stop-color="#2394A8"/><stop offset=".64" stop-color="#1D5C8C"/><stop offset=".84" stop-color="#34357A"/><stop offset="1" stop-color="#2C2260"/></radialGradient>`);
    s.push(`<radialGradient id="o2-orage" r="50%"><stop offset="0" stop-color="#0E0A2A" stop-opacity=".75"/><stop offset=".55" stop-color="#1C1446" stop-opacity=".5"/><stop offset="1" stop-color="#2A1E5A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="o2-soleil" r="50%"><stop offset="0" stop-color="#FFF4C8" stop-opacity=".95"/><stop offset=".25" stop-color="#FFC870" stop-opacity=".6"/><stop offset=".6" stop-color="#FF8A5A" stop-opacity=".18"/><stop offset="1" stop-color="#FF7A5A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="o2-feu" r="50%"><stop offset="0" stop-color="#FFD27A" stop-opacity=".9"/><stop offset=".35" stop-color="#FF7A1E" stop-opacity=".5"/><stop offset="1" stop-color="#C8281E" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="o2-dieu" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#1E5E66"/><stop offset=".45" stop-color="#3E9A94"/><stop offset=".8" stop-color="#8ADCC6"/><stop offset="1" stop-color="#E8D4A0"/></linearGradient>`);
    s.push(`<linearGradient id="o2-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".35" stop-color="#F2C64A"/><stop offset=".75" stop-color="#B07A1E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
    s.push(`<linearGradient id="o2-marbre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6E4"/><stop offset="1" stop-color="#E8C8A0"/></linearGradient>`);
    s.push(`<radialGradient id="o2-tourb" r="50%"><stop offset="0" stop-color="#02060E"/><stop offset=".3" stop-color="#0B2A4A"/><stop offset=".7" stop-color="#1A5A8A"/><stop offset="1" stop-color="#2A6A9A" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="o2-terre" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E8C878"/><stop offset=".5" stop-color="#9AAA5A"/><stop offset="1" stop-color="#5A7A4A"/></linearGradient>`);
    s.push(`<linearGradient id="o2-roc" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9A8A9A"/><stop offset=".5" stop-color="#5A4E6A"/><stop offset="1" stop-color="#2E2844"/></linearGradient>`);
    // ---- 1. la mer : grandes nappes de lumière, vaguelettes, reflets dorés du soleil
    const POSE = [612, 432], ITH = [930, 610], TRO = [330, 522];
    s.push(`<ellipse cx="${POSE[0] - 40}" cy="${POSE[1] - 120}" rx="420" ry="280" fill="url(#o2-orage)"/>`);
    K.halo(1050, 690, 470, "#FFC870", .45);
    for (let k = 0; k < 220; k++) { const x = r() * W, y = r() * H; if (K.dT(x, y) < 24) continue; const l = 5 + r() * 8, chaud = Math.hypot(x - 1060, y - 700) < 420;
      s.push(`<path d="M${f(x)} ${f(y)}q${f(l / 2)} ${f(-l / 2)} ${f(l)} 0q${f(l / 2)} ${f(-l / 2)} ${f(l)} 0" stroke="${chaud ? "#FFF0C0" : "#D8F4FF"}" stroke-width="1.2" fill="none" opacity="${(.15 + r() * .3).toFixed(2)}"/>`); }
    for (let k = 0; k < 160; k++) { const d = 60 + r() * 520, t = PI + .25 + r() * 1.1, x = 1060 + Math.cos(t) * d, y = 700 + Math.sin(t) * d * .8; if (K.dT(x, y) < 22 || x > 1080 || y > 720) continue; const l = 4 + r() * 10 * (1 - d / 700); s.push(`<path d="M${f(x)} ${f(y)}h${f(l)}" stroke="#FFE7A0" stroke-width="2" stroke-linecap="round" opacity="${Math.max(.3, .45 + (1 - d / 580) * .5).toFixed(2)}"/>`); }
    // ---- 2. le ciel d'orage autour de Poséidon : nuages en spirale, pluie, éclairs
    { const ox = POSE[0] - 60, oy = POSE[1] - 170;
      [[250, 150, 200, 330, 46, .3], [210, 125, 170, 300, 36, .35], [300, 190, 215, 300, 40, .25], [165, 100, 160, 260, 26, .4], [330, 215, 250, 320, 30, .22]].forEach(([rx, ry, a0, a1, w, op], q) => {
        const P = []; for (let k = 0; k <= 24; k++) { const t = (a0 + (a1 - a0) * k / 24) * PI / 180, sp = 1 + k / 24 * .12; P.push([ox + Math.cos(t) * rx * sp, oy + Math.sin(t) * ry * sp]); }
        const d = "M" + P.map(p => f(p[0]) + " " + f(p[1])).join("L");
        s.push(`<path d="${d}" fill="none" stroke="#120E30" stroke-width="${w + 10}" stroke-linecap="round" opacity="${op * .8}" transform="translate(-5 -6)"/><path d="${d}" fill="none" stroke="#4A4486" stroke-width="${w}" stroke-linecap="round" opacity="${op + .2}"/><path d="${d}" fill="none" stroke="#B8B0E8" stroke-width="2" stroke-linecap="round" opacity="${op}" transform="translate(${w * .3} ${w * .3})"/>`); }); }
    for (let k = 0; k < 70; k++) { const x = 200 + r() * 600, y = 150 + r() * 330; if (K.dT(x, y) < 20) continue; s.push(`<path d="M${f(x)} ${f(y)}l-6 14" stroke="#C8D4FF" stroke-width="1" opacity=".3"/>`); }
    // ---- 3. TROIE EN FLAMMES (le départ) : la ville sur sa colline, les remparts, le cheval de bois sur la plage
    { const [x, y] = TRO; K.prendre(x, y, 120); K.prendre(x + 120, y + 30, 70);
      const cote = `M${x - 130} ${y + 40}Q${x - 150} ${y - 10} ${x - 110} ${y - 50}Q${x - 60} ${y - 90} ${x + 10} ${y - 80}Q${x + 90} ${y - 74} ${x + 150} ${y - 20}Q${x + 190} ${y + 20} ${x + 170} ${y + 70}Q${x + 100} ${y + 96} ${x} ${y + 88}Q${x - 100} ${y + 84} ${x - 130} ${y + 40}Z`;
      s.push(`<path d="${cote}" fill="#7FE0D4" opacity=".4" transform="translate(${x} ${y}) scale(1.12) translate(${-x} ${-y})"/><path d="${cote}" fill="none" stroke="#F4FFFC" stroke-width="2.6" stroke-dasharray="12 6" opacity=".75" transform="translate(${x} ${y}) scale(1.06) translate(${-x} ${-y})"/><path d="${cote}" fill="#E6CF94"/><path d="${cote}" fill="#B89A62" transform="translate(${x} ${y - 6}) scale(.9) translate(${-x} ${-y})"/>`);
      K.halo(x - 20, y - 50, 170, "#FF7A1E", .6);
      s.push(`${G(x - 14, y - 2, 1.12)}
        ${[[-70, -58, 18], [-46, -66, 22], [-20, -60, 16], [22, -62, 20], [44, -54, 16]].map(([u, v, w]) => `<rect x="${u - w / 2}" y="${v}" width="${w}" height="${-v - 40}" fill="#C9A47A" ${INK}/><path d="M${u - w / 2 - 3} ${v}l${w / 2 + 3} -10l${w / 2 + 3} 10z" fill="#7A2A1A" ${INK}/><rect x="${u - 3}" y="${v + 6}" width="6" height="7" fill="#FFB347"/>`).join("")}
        <path d="M-14 -78h28l-14 -10z" fill="url(#o2-marbre)" ${INK}/>${[-12, -6, 0, 6, 12].map(u => `<rect x="${u - 1.4}" y="-78" width="2.8" height="16" fill="#F4F1EA" stroke="#8A8270" stroke-width=".5"/>`).join("")}<rect x="-15" y="-63" width="30" height="3" fill="#D8D0BC" ${INK}/>
        <rect x="-92" y="-44" width="146" height="44" fill="#D9BE8E" ${INK}/>${[-36, -26, -16, -8].map(v => `<path d="M-92 ${v}H54" stroke="#A88A5A" stroke-width=".8"/>`).join("")}${Array.from({ length: 18 }, (_, q) => `<rect x="${-92 + q * 8.2}" y="-49" width="5" height="5" fill="#D9BE8E" ${INK}/>`).join("")}
        ${[-92, -30, 42].map(u => `<rect x="${u - 4}" y="-68" width="26" height="68" fill="#E2C898" ${INK}/>${[0, 1, 2].map(q => `<rect x="${u - 4 + q * 9.5}" y="-74" width="6" height="6" fill="#E2C898" ${INK}/>`).join("")}<path d="M${u + 6} -52v-6a3 3 0 0 1 6 0v6z" fill="#FFB347" ${INK}/><path d="M${u + 3} -62q6 -10 12 0" stroke="#2A1A10" stroke-width="3" opacity=".5" fill="none"/>`).join("")}
        <path d="M-2 0v-24a10 10 0 0 1 20 0v24z" fill="#2A1A10" ${INK}/><path d="M-2 0l-8 4v-26l8 -2zM18 0l8 4v-26l-8 -2z" fill="#7A4A26" ${INK}/></g>`);
      // le cheval de bois sur la plage (trappe ouverte, un Grec descend à l'échelle de corde)
      s.push(`${G(x + 136, y + 48, 1.3)}<ellipse cx="-6" cy="2" rx="40" ry="6" fill="#000" opacity=".3"/><rect x="-30" y="-8" width="60" height="7" rx="2" fill="#6A4422" ${INK}/>${[-22, -4, 14].map(u => `<circle cx="${u}" cy="0" r="5" fill="#8A5A2E" ${INK}/><circle cx="${u}" cy="0" r="1.6" fill="#3A2414"/>`).join("")}
        ${[-20, -10, 10, 20].map(u => `<rect x="${u - 3}" y="-30" width="6" height="23" fill="#A8703A" ${INK}/>`).join("")}<path d="M-30 -44Q-32 -28 -18 -26H22Q34 -28 30 -44Q26 -54 0 -54Q-26 -54 -30 -44Z" fill="#B97E44" ${INK}/>${[-18, -8, 2, 12, 22].map(u => `<path d="M${u} -53V-27" stroke="#7A4A26" stroke-width=".9"/>`).join("")}<path d="M-30 -44Q-26 -50 0 -52Q24 -52 30 -44" stroke="#F2C27A" stroke-width="2" fill="none" opacity=".6"/>
        <path d="M-24 -46L-36 -78L-24 -82L-12 -50Z" fill="#B97E44" ${INK}/><path d="M-38 -76Q-52 -78 -54 -68L-50 -64Q-42 -66 -34 -66Z" fill="#B97E44" ${INK}/><path d="M-36 -82l-2 -8l5 6zM-30 -84l1 -8l3 7z" fill="#B97E44" ${INK}/><circle cx="-40" cy="-74" r="1.6" fill="#1A1020"/>
        <path d="M-24 -84l6 4l-4 2l7 4l-4 2l7 5l-4 3l6 4" stroke="#5A3418" stroke-width="2" fill="none"/><path d="M30 -46Q42 -42 40 -26" stroke="#5A3418" stroke-width="3" fill="none"/>
        <rect x="-6" y="-27" width="12" height="6" fill="#2A1A0E" ${INK}/><path d="M-4 -21V-6M3 -21V-6M-4 -17h7M-4 -13h7M-4 -9h7" stroke="#C9A06A" stroke-width=".9"/>
        <g transform="translate(-1 -8)"><circle cx="0" cy="-4" r="2.6" fill="${PEAU}" ${INK}/><path d="M-3 -5q3 -6 6 0" fill="#C9962A" ${INK}/><path d="M-3 -8q3 -4 7 -2" stroke="#C8283A" stroke-width="1.6" fill="none"/><rect x="-2.2" y="-1.6" width="4.4" height="6" fill="#8A2A1E" ${INK}/></g></g>`);
      // flammes (animées) et grande fumée qui file vers la tempête
      const flamme = (u, v, h, q) => `<g transform="translate(${f(u)} ${f(v)})"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;.85 1.25;1.1 .9;1 1" dur="${(.7 + q * .13).toFixed(2)}s" repeatCount="indefinite"/>`)}<path d="M-9 0Q-11 ${f(-h * .5)} 0 ${f(-h)}Q11 ${f(-h * .5)} 9 0Z" fill="#E8471E"/><path d="M-5 0Q-6 ${f(-h * .4)} 0 ${f(-h * .7)}Q6 ${f(-h * .4)} 5 0Z" fill="#FFB12A"/><path d="M-2 0Q-2 ${f(-h * .2)} 0 ${f(-h * .4)}Q2 ${f(-h * .2)} 2 0Z" fill="#FFF2B0"/></g></g>`;
      const B = (u, v) => [x - 14 + u * 1.12, y - 2 + v * 1.12];
      a.push([[-79, -74, 30], [-46, -66, 38], [-17, -76, 26], [22, -62, 34], [55, -74, 26], [-60, -40, 22]].map(([u, v, h], q) => { const [px, py] = B(u, v); return flamme(px, py, h, q); }).join(""));
      for (let q = 0; q < 6; q++) s.push(`<circle cx="${f(x - 40 - q * 26)}" cy="${f(y - 120 - q * 22)}" r="${f(18 + q * 5)}" fill="#3A2E3E" opacity="${(.5 - q * .06).toFixed(2)}"/>`);
      [0, 1, 2].forEach(q => a.push(`<g opacity="${K.anime ? 0 : .45}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${-40 - q * 10} -60" dur="${6 + q}s" begin="-${q * 2}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.55;0" dur="${6 + q}s" begin="-${q * 2}s" repeatCount="indefinite"/>`)}<circle cx="${f(x - 60 + q * 40)}" cy="${f(y - 110)}" r="${16 + q * 3}" fill="#5A4A52"/><circle cx="${f(x - 52 + q * 40)}" cy="${f(y - 118)}" r="10" fill="#7A6A72"/></g>`));
      nom(x - 30, y + 60, "Troie", 17); bulle(x - 40, y - 124, "Un cadeau des Grecs ?", 10, 0); }
    // ---- 4. la galère d'Ulysse, voile rouge, dans la tempête ; son long sillage depuis la plage de Troie
    const GAL = [282, 262];
    { const [x, y] = GAL; K.prendre(x, y - 10, 60);
      const sill = `M${TRO[0] + 70} ${TRO[1] - 70}Q${TRO[0] + 40} ${TRO[1] - 140} ${x - 30} ${y + 30}`;
      s.push(`<path d="${sill}" fill="none" stroke="#F4FFFC" stroke-width="16" stroke-linecap="round" opacity=".18"/><path d="${sill}" fill="none" stroke="#F4FFFC" stroke-width="3" stroke-dasharray="10 9" stroke-linecap="round" opacity=".7"/>`);
      a.push(`<path d="${sill}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="2 18" stroke-linecap="round" opacity=".9">${an(`<animate attributeName="stroke-dashoffset" values="40;0" dur="1.6s" repeatCount="indefinite"/>`)}</path>`);
      const ulysse = `<g transform="translate(-2 -30)"><circle cx="0" cy="-12" r="3.4" fill="${PEAU}" ${INK}/><path d="M-3.4 -13q3 -6 7 0" fill="#5A3A1E"/><rect x="-3" y="-9" width="6" height="12" fill="#C8283A" ${INK}/><path d="M-5 -5h10M-5 -1h10M-5 3h10" stroke="#C9A06A" stroke-width="1.2"/></g>`;
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-6 ${x} ${y};5 ${x} ${y};-6 ${x} ${y}" dur="3s" repeatCount="indefinite"/>`)}${galere(x, y, 1.35, "#C8283A", 0, ulysse)}${crete(x - 34, y + 14, .7, 1)}</g>`);
      bulle(x - 66, y + 74, "Ramez, compagnons !", 9, 3); }
    // ---- 5. POSÉIDON, géant, surgit des vagues au cœur de la carte (trident levé, barbe d'écume, couronne d'or)
    { const [x, y] = POSE, S = .95; K.prendre(x, y - 130, 150); K.halo(x, y - 170, 190, "#9FF4E8", .35);
      const bras = (d, w) => `<path d="${d}" stroke="#12303A" stroke-width="${w + 3}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="url(#o2-dieu)" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
      s.push(`${G(x, y, S)}
        <g transform="translate(-122 -214) rotate(-74)"><path d="M0 36V-170" stroke="#1A1020" stroke-width="7"/><path d="M0 36V-170" stroke="url(#o2-or)" stroke-width="5"/><path d="M-24 -158Q-24 -176 -26 -196M0 -170V-208M24 -158Q24 -176 26 -196" stroke="#1A1020" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="M-24 -158Q-24 -176 -26 -196M0 -170V-208M24 -158Q24 -176 26 -196" stroke="#F2C64A" stroke-width="4.2" fill="none" stroke-linecap="round"/><path d="M-26 -160Q0 -148 26 -160" stroke="#1A1020" stroke-width="7" fill="none"/><path d="M-26 -160Q0 -148 26 -160" stroke="#F2C64A" stroke-width="4.6" fill="none"/>${[[-26, -196], [0, -208], [26, -196]].map(([u, v]) => `<path d="M${u - 5} ${v + 5}L${u} ${v - 10}L${u + 5} ${v + 5}Z" fill="#FFF2B8" ${INK}/>`).join("")}</g>
        <path d="M-58 0C-64 -50 -78 -100 -72 -140Q-50 -158 -18 -160H18Q50 -158 72 -140C78 -100 64 -50 58 0Z" fill="url(#o2-dieu)" ${INK}/>
        <path d="M-44 -118Q-22 -100 0 -112Q22 -100 44 -118M0 -108V-30M-20 -82h40M-17 -58h34M-38 -138Q-50 -100 -44 -70M38 -138Q50 -100 44 -70" stroke="#14404A" stroke-width="1.8" fill="none"/><path d="M30 -150Q56 -148 64 -130" stroke="#C8FFF0" stroke-width="3" fill="none" opacity=".6"/>
        ${bras("M-62 -140Q-100 -150 -112 -180Q-118 -196 -122 -212", 26)}<circle cx="-122" cy="-214" r="15" fill="url(#o2-dieu)" ${INK}/><path d="M-130 -224v22M-122 -226v24M-114 -224v22" stroke="#14404A" stroke-width="1.4"/>
        ${bras("M62 -140Q110 -128 134 -150Q150 -164 164 -168", 24)}<path d="M156 -176q8 -14 16 -6q6 -10 12 -2q6 -6 8 4l-8 12q-16 6 -26 0z" fill="url(#o2-dieu)" ${INK}/></g>${crete(x + 168 * S, y - 196 * S, .95, 0, "#2A8AA8")}${G(x, y, S)}
        <rect x="-13" y="-176" width="26" height="18" fill="#2E7A70" ${INK}/>
        <path d="M-30 -200Q-50 -180 -44 -150Q-52 -138 -40 -130M30 -200Q50 -180 44 -150Q52 -138 40 -130" stroke="#DCF4F0" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="0" cy="-202" rx="27" ry="32" fill="url(#o2-dieu)" ${INK}/>
        <path d="M-27 -194Q-34 -160 -18 -138Q-8 -120 0 -106Q8 -120 18 -138Q34 -160 27 -194Q14 -176 0 -178Q-14 -176 -27 -194Z" fill="#F0FAF8" ${INK}/>${[-16, -8, 0, 8, 16].map(u => `<path d="M${u} -172Q${u * 1.3} -148 ${u * .5} -126" stroke="#9ACAC8" stroke-width="1.3" fill="none"/>`).join("")}<path d="M-6 -112q6 8 12 0q-2 10 -6 14q-4 -4 -6 -14z" fill="#F0FAF8" ${INK}/>
        <path d="M-15 -180Q-8 -188 0 -183Q8 -188 15 -180Q8 -175 0 -177Q-8 -175 -15 -180Z" fill="#DCF4F0" ${INK}/><path d="M-9 -170Q0 -162 9 -170Q4 -165 0 -165Q-4 -165 -9 -170Z" fill="#1A1020"/>
        <path d="M-3 -200L-5 -186H4Z" fill="#2E7A70" stroke="#14404A" stroke-width=".9"/>
        <path d="M-19 -210l11 4M19 -210l-11 4" stroke="#0E2A30" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="-11" cy="-201" rx="4.4" ry="2.4" fill="#0E2A26"/><ellipse cx="11" cy="-201" rx="4.4" ry="2.4" fill="#0E2A26"/>
        <path d="M-27 -218Q-34 -240 -40 -250M27 -218Q34 -240 42 -248M-20 -228Q-28 -250 -22 -262M20 -228Q28 -250 24 -262" stroke="#DCF4F0" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M-27 -222L-30 -250L-17 -232L-10 -260L0 -236L10 -260L17 -232L30 -250L27 -222Q0 -232 -27 -222Z" fill="url(#o2-or)" ${INK}/><path d="M-27 -222Q0 -232 27 -222" stroke="#6A440E" stroke-width="2.2" fill="none"/><circle cx="0" cy="-230" r="3.4" fill="#2BB6A3" ${INK}/>
        <path d="M-160 4Q-140 -26 -110 -8Q-90 -34 -60 -10Q-36 -36 0 -12Q36 -36 60 -10Q90 -34 110 -8Q140 -26 160 4Q80 30 0 26Q-80 30 -160 4Z" fill="#1E7A92" ${INK}/><path d="M-160 4Q-140 -26 -110 -8Q-90 -34 -60 -10Q-36 -36 0 -12Q36 -36 60 -10Q90 -34 110 -8Q140 -26 160 4" stroke="#F4FFFC" stroke-width="4" fill="none" stroke-linecap="round"/>${[-130, -84, -36, 12, 58, 104, 140].map(u => `<path d="M${u - 7} 4q7 -7 14 0" stroke="#F4FFFC" stroke-width="2.2" fill="none"/><circle cx="${u + 9}" cy="-6" r="2.4" fill="#F4FFFC"/>`).join("")}</g>`);
            // les yeux et le trident qui s'allument, l'éclair qui part du trident, les ondes autour du dieu
      a.push(`<g opacity="${K.anime ? .15 : 1}">${an(`<animate attributeName="opacity" values=".1;.1;1;1;.1" keyTimes="0;.55;.6;.85;1" dur="7s" repeatCount="indefinite"/>`)}${G(x, y, S)}<ellipse cx="-11" cy="-201" rx="4" ry="2" fill="#E8FFFA"/><ellipse cx="11" cy="-201" rx="4" ry="2" fill="#E8FFFA"/><circle cx="-322" cy="-268" r="30" fill="#E8FFFA" opacity=".35"/></g></g>`);
      { const [tx, ty] = [x - 322 * S, y - 268 * S], [gx, gy] = [GAL[0] + 30, GAL[1] - 30]; a.push(`<path d="M${f(tx)} ${f(ty)}L${f(tx - 14)} ${f(ty - 22)}L${f(tx - 26)} ${f(ty - 10)}L${f(gx + 22)} ${f(gy - 30)}L${f(gx + 8)} ${f(gy - 18)}L${f(gx)} ${f(gy - 34)}" stroke="#FFF6C8" stroke-width="3" fill="none" stroke-linejoin="round" opacity="${K.anime ? 0 : .9}">${an(`<animate attributeName="opacity" values="0;0;1;.2;1;0;0" keyTimes="0;.58;.6;.63;.66;.72;1" dur="7s" repeatCount="indefinite"/>`)}</path>`); }
      [[425, 330, 0], [805, 292, 2.3]].forEach(([u, v, b]) => { if (K.dT(u, v) < 30) return; a.push(`<path d="M${u} ${v - 40}l-12 26l10 -2l-14 30l26 -36l-10 2l12 -20z" fill="#FFF6C8" stroke="#FFFFFF" stroke-width="1" opacity="${K.anime ? 0 : .9}">${an(`<animate attributeName="opacity" values="0;0;1;0;1;0;0" keyTimes="0;.7;.72;.75;.77;.8;1" dur="5s" begin="${b}s" repeatCount="indefinite"/>`)}</path>`); });
      [0, 1].forEach(q => a.push(`<ellipse cx="${x}" cy="${y + 14}" rx="170" ry="36" fill="none" stroke="#E8FFFA" stroke-width="2" opacity="${K.anime ? 0 : .4}">${an(`<animate attributeName="rx" values="170;250" dur="5s" begin="${q * 2.5}s" repeatCount="indefinite"/><animate attributeName="ry" values="36;60" dur="5s" begin="${q * 2.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="5s" begin="${q * 2.5}s" repeatCount="indefinite"/>`)}</ellipse>`));
      nom(x, y + 58, "Poséidon", 19); bulle(x - 150, y - 278, "Tu ne rentreras pas, Ulysse !", 12, 6); }
    // ---- 6. LE DÉTROIT : Charybde (le tourbillon) et Scylla aux six têtes dans sa falaise (en haut à droite)
    { const cx = 790, cy = 72; K.prendre(cx, cy, 70); s.push(`<circle cx="${cx}" cy="${cy}" r="86" fill="url(#o2-tourb)"/>`);
      const spir = (R0, dt, c, w) => { let d = ""; for (let q = 0; q < 56; q++) { const t = q / 56 * TAU * 2.4 + dt, R = R0 * (1 - q / 62); d += (q ? "L" : "M") + f(cx + Math.cos(t) * R) + " " + f(cy + Math.sin(t) * R * .78); } return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity=".85"/>`; };
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="7s" repeatCount="indefinite"/>`)}${spir(80, 0, "#E8FFFA", 2.8)}${spir(72, 2.1, "#8EEBDD", 2.2)}${spir(76, 4.2, "#E8FFFA", 1.6)}<path d="M${cx + 46} ${cy - 10}l12 5" stroke="#7A4A26" stroke-width="3.4"/><rect x="${cx - 40}" y="${cy + 18}" width="14" height="3.4" fill="#7A4A26"/></g>`);
      s.push(`<ellipse cx="${cx}" cy="${cy}" rx="14" ry="10" fill="#010408"/>`); nom(cx - 128, cy - 34, "Charybde", 14);
      const sx = 1010, sy = 110; K.prendre(sx, sy, 80);
      s.push(`<path d="M940 0Q930 40 950 80Q940 130 980 170Q1010 210 1050 200Q1080 190 1080 160V0Z" fill="#7FE0D4" opacity=".35"/><path d="M952 0Q944 40 962 78Q954 124 990 160Q1016 192 1050 186Q1080 178 1080 150V0Z" fill="url(#o2-roc)" ${INK}/><path d="M968 30Q980 60 972 90M990 120Q1010 150 1040 160" stroke="#8A7EA0" stroke-width="3" fill="none"/><path d="M984 64Q990 100 1010 112Q1030 104 1028 72Q1014 56 984 64Z" fill="#0A0614"/>`);
      const tete = (u, v, ang) => `<path d="M1006 88Q${f((1006 + u) / 2)} ${f(v - 30)} ${f(u)} ${f(v)}" stroke="#1A1020" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M1006 88Q${f((1006 + u) / 2)} ${f(v - 30)} ${f(u)} ${f(v)}" stroke="#4A8A6A" stroke-width="6" fill="none" stroke-linecap="round"/>${G(u, v, 1.4, ang)}<path d="M0 -5Q10 -6 14 -2L8 0L14 2Q10 6 0 5Q-4 0 0 -5Z" fill="#5AA07A" ${INK}/><path d="M9 -1.4l1.4 1.4l1 -1.4" stroke="#FFF" stroke-width=".8" fill="none"/><circle cx="4" cy="-2.2" r="1.5" fill="#FFE04A"/><path d="M-1 -5l-3 -4M1 -5l1 -5" stroke="#2A5A3A" stroke-width="1.6"/></g>`;
      [[0, [[920, 40, 170], [905, 92, 160], [940, 150, 140]]], [1, [[955, 196, 110], [890, 128, 190], [930, 10, -170]]]].forEach(([q, L]) => a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="${q ? 5 : -5} 1006 88;${q ? -6 : 6} 1006 88;${q ? 5 : -5} 1006 88" dur="${3 + q}s" repeatCount="indefinite"/>`)}${L.map(([u, v, an2]) => tete(u, v, an2)).join("")}</g>`));
      nom(1018, 228, "Scylla", 14); }
    // ---- 7. ITHAQUE baignée d'or (l'arrivée) : le palais aux 4 boucliers-portraits, l'arc et les 12 haches, l'olivier, Argos
    const PORTR = [];
    { const [x, y] = ITH; K.prendre(x, y, 150);
      const cote = `M690 720Q700 660 750 612Q810 560 880 532Q950 500 1010 470Q1050 452 1080 446V720Z`;
      s.push(`<path d="${cote}" fill="#BFF4E0" opacity=".45" transform="translate(-14 -14)"/><path d="${cote}" fill="none" stroke="#FFF8E0" stroke-width="3" stroke-dasharray="12 6" opacity=".8" transform="translate(-7 -7)"/><path d="${cote}" fill="#F4DCA0"/><path d="${cote}" fill="url(#o2-terre)" transform="translate(10 14)"/>`);
      K.halo(1040, 660, 300, "#FFE08A", .7);
      // l'olivier (le lit d'Ulysse y est taillé)
      s.push(`${G(1032, 530, 1.4)}<ellipse cx="-10" cy="20" rx="30" ry="6" fill="#000" opacity=".25"/><path d="M-2 22Q-6 4 2 -6Q-6 -14 -2 -20M2 -6Q10 -12 14 -20" stroke="#6A5034" stroke-width="5" fill="none" stroke-linecap="round"/>${[[-16, -22, 13], [2, -32, 15], [18, -22, 12], [-4, -16, 11], [12, -10, 10]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#7A9A6A" ${INK}/><circle cx="${u + 3}" cy="${v + 3}" r="${R * .5}" fill="#C8D896"/>`).join("")}${[[-10, -26], [8, -36], [16, -18], [-2, -12]].map(([u, v]) => `<ellipse cx="${u}" cy="${v}" rx="1.6" ry="2.2" fill="#3A2A4A"/>`).join("")}</g>`);
      // le palais : colonnade, fronton, et les 4 grands boucliers ronds (portraits des pilotes)
      const PX = 905, PY = 612, L = 112;
      s.push(`<ellipse cx="${PX - 10}" cy="${PY + 26}" rx="${L + 16}" ry="14" fill="#000" opacity=".25"/><rect x="${PX - L}" y="${PY + 10}" width="${L * 2}" height="16" fill="url(#o2-marbre)" ${INK}/><rect x="${PX - L + 6}" y="${PY + 1}" width="${L * 2 - 12}" height="10" fill="url(#o2-marbre)" ${INK}/>
        ${Array.from({ length: 11 }, (_, q) => `<rect x="${PX - L + 14 + q * ((L * 2 - 28) / 10) - 3.5}" y="${PY - 62}" width="7" height="64" fill="#FFF8EC" stroke="#B89A7A" stroke-width=".7"/>`).join("")}<rect x="${PX - L - 2}" y="${PY - 70}" width="${L * 2 + 4}" height="9" fill="url(#o2-marbre)" ${INK}/><rect x="${PX - L - 2}" y="${PY - 65}" width="${L * 2 + 4}" height="4" fill="url(#o2-grecque)"/>
        <path d="M${PX - L - 10} ${PY - 70}L${PX} ${PY - 124}L${PX + L + 10} ${PY - 70}Z" fill="#B5482E" ${INK}/><path d="M${PX - L + 6} ${PY - 74}L${PX} ${PY - 114}L${PX + L - 6} ${PY - 74}Z" fill="url(#o2-marbre)" ${INK}/>`);
      s.push(`<pattern id="o2-grecque" width="12" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill="#F2E6C8"/><path d="M1 5V1h4v3H3V3M7 5V1h4v3H9V3" stroke="#B5482E" stroke-width=".9" fill="none"/></pattern>`);
      COULEURS_J.forEach((c, k) => { const u = PX - 75 + k * 50, v = PY - 30; PORTR.push({ k, x: u, y: v, r: 18 }); s.push(`<circle cx="${u - 2}" cy="${v - 2}" r="24" fill="#000" opacity=".25"/><circle cx="${u}" cy="${v}" r="23" fill="url(#o2-or)" ${INK}/><circle cx="${u}" cy="${v}" r="20.5" fill="${c}"/><circle cx="${u}" cy="${v}" r="18" fill="#1A2238" stroke="#FFF2B8" stroke-width="1"/>`); });
      s.push(`<text x="${PX}" y="${PY - 82}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="12" letter-spacing="2" fill="#6A2A1A">ITHAQUE</text>`);
      a.push(`<g>${COULEURS_J.map((c, k) => `<circle cx="${PX - 75 + k * 50}" cy="${PY - 30}" r="24" fill="none" stroke="#FFF6C8" stroke-width="2.4" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.2;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/>`)}</circle>`).join("")}</g>`);
      // l'arc et les 12 haches alignées, la flèche passe dans les 12 anneaux
      { const g = `<g transform="translate(818 682) scale(1.7)">`;
        s.push(`${g}${Array.from({ length: 12 }, (_, q) => `<path d="M${q * 9} 7V-7" stroke="#6A4422" stroke-width="1.5"/><path d="M${q * 9} -7q5 -2 5 4q-5 2 -5 -1z" fill="#DCE2EA" stroke="#1A1020" stroke-width=".6"/><circle cx="${q * 9 + 2.6}" cy="-5" r="1.3" fill="#2A3A3A"/>`).join("")}<path d="M-22 -19Q-8 -5 -22 9" stroke="#7A4A1E" stroke-width="2.6" fill="none"/><path d="M-22 -19V9" stroke="#F4F1EA" stroke-width=".7"/></g>`);
        a.push(`${g}<g${K.anime ? "" : ` transform="translate(52 0)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;118 0;118 0" keyTimes="0;.45;.75;1" dur="5s" repeatCount="indefinite"/>`)}<path d="M-20 -5h18" stroke="#5A3A1E" stroke-width="1.3"/><path d="M-2 -5l-4 -2v4z" fill="#DCE2EA"/><path d="M-20 -5l-3 -2.4M-20 -5l-3 2.4" stroke="${COULEURS_J[0]}" stroke-width="1.4"/></g></g>`); }
      // le chien Argos qui reconnaît son maître, et le métier à tisser de Pénélope
      s.push(`${G(1040, 690, 1.3)}<ellipse cx="0" cy="4" rx="14" ry="3" fill="#000" opacity=".25"/><path d="M-12 2Q-12 -6 0 -6Q10 -6 10 2Z" fill="#9A6A3A" ${INK}/><circle cx="12" cy="-3" r="4.4" fill="#9A6A3A" ${INK}/><path d="M10 -6l-2 -4l4 2z" fill="#6A4422"/><ellipse cx="16" cy="-2" rx="2.4" ry="1.8" fill="#9A6A3A" ${INK}/><circle cx="18" cy="-2.6" r=".8" fill="#1A1020"/></g>`);
      a.push(`${G(1040 - 12 * 1.3, 690, 1.3)}<path d="M0 0q-4 -4 -2 -8" stroke="#9A6A3A" stroke-width="2" fill="none" stroke-linecap="round">${an(`<animateTransform attributeName="transform" type="rotate" values="-25;25;-25" dur=".5s" repeatCount="indefinite"/>`)}</path></g>`);
      s.push(`${G(1052, 600, 1.2)}<path d="M-12 14V-18M12 14V-18M-14 -18H14" stroke="#7A4A26" stroke-width="2.4"/><rect x="-10" y="-14" width="20" height="18" fill="#E8D8B0" stroke="#7A4A26" stroke-width=".8"/>${COULEURS_J.map((c, k) => `<path d="M-10 ${-10 + k * 4}h20" stroke="${c}" stroke-width="2"/>`).join("")}</g>`);
      // le feu de bienvenue au port
      s.push(`${G(762, 640, 1.3)}<path d="M-4 16L-3 -10H3L4 16Z" fill="#E8DCC0" ${INK}/><rect x="-5" y="-14" width="10" height="5" fill="#8A6A48" ${INK}/></g>`); K.halo(762, 616, 34, "#FFB347", .9);
      a.push(`${G(762, 620, 1.3)}<g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;.8 1.3;1.1 .9;1 1" dur=".9s" repeatCount="indefinite"/>`)}<path d="M-5 0Q-6 -8 0 -14Q6 -8 5 0Z" fill="#E8471E"/><path d="M-3 0Q-3 -5 0 -9Q3 -5 3 0Z" fill="#FFE08A"/></g></g>`);
      nom(PX - 10, 712, "Ithaque", 17); bulle(PX - 30, PY - 140, "Enfin… à la maison !", 9, 4); }
    // ---- 8. POLYPHÈME, le Cyclope, surgit derrière sa falaise (coin bas gauche) et lance un rocher
    { K.prendre(60, 640, 80);
      s.push(`<path d="M0 520Q40 540 80 568Q120 600 140 650Q156 690 170 720H0Z" fill="#7FE0D4" opacity=".35" transform="translate(8 -8)"/>`);
      s.push(`${G(64, 616, 1.5)}<path d="M-26 0Q-30 -36 -10 -50H16Q34 -40 32 0Z" fill="#D9C79A" ${INK}/>${[-20, -11, -2, 7, 16, 24].map((u, q) => `<circle cx="${u}" cy="${-46 + (q % 2) * 3}" r="5" fill="#EFE2C0" ${INK}/>`).join("")}<path d="M18 -40Q34 -32 34 -14" stroke="#1A1020" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M18 -40Q34 -32 34 -14" stroke="#C88A5E" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M26 -14q2 6 6 4q2 6 6 2q4 4 6 -2l-4 -8z" fill="#C88A5E" ${INK}/>
        <path d="M-16 -40Q-34 -62 -24 -94" stroke="#1A1020" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M-16 -40Q-34 -62 -24 -94" stroke="#C88A5E" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="-24" cy="-104" r="15" fill="#7A7266" ${INK}/><circle cx="-28" cy="-108" r="4" fill="#9A9284"/>
        <circle cx="3" cy="-66" r="21" fill="#D89A6A" ${INK}/><path d="M-16 -76Q-8 -94 4 -92Q18 -94 22 -76Q12 -86 4 -84Q-6 -86 -16 -76Z" fill="#3A2414"/>
        <path d="M-10 -76Q3 -82 16 -76" stroke="#2A1A10" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="3" cy="-67" rx="10" ry="8" fill="#FFFDF6" ${INK}/><path d="M-8 -52Q3 -46 14 -52" stroke="#1A1020" stroke-width="1.6" fill="none"/><path d="M-12 -54Q3 -38 18 -54Q16 -44 3 -42Q-10 -44 -12 -54Z" fill="#5A3A22" opacity=".7"/></g>`);
      s.push(`<path d="M0 548Q34 560 66 586Q104 610 122 650Q138 690 150 720H0Z" fill="url(#o2-roc)" ${INK}/><path d="M10 600Q50 610 80 650M20 660Q60 670 90 710" stroke="#8A7EA0" stroke-width="3" fill="none"/>`);
      a.push(`${G(64 + 3 * 1.5, 616 - 67 * 1.5, 1.5)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 0;4 -1;4 -1;-3 0;-3 0;0 0" keyTimes="0;.3;.38;.55;.62;.85;1" dur="6s" repeatCount="indefinite"/>`)}<circle r="4.4" fill="#5A8A3A" ${INK}/><circle r="2.2" fill="#0A0A0A"/><circle cx="-1.2" cy="-1.2" r=".8" fill="#FFF"/></g></g>`);
      if (K.anime) a.push(`<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.5;.52;.78;.8;1" dur="7s" repeatCount="indefinite"/><animateMotion dur="7s" repeatCount="indefinite" keyPoints="0;0;0;1;1" keyTimes="0;.5;.52;.8;1" calcMode="linear" path="M${f(64 - 24 * 1.5)} ${f(616 - 104 * 1.5)}Q140 300 238 392"/><circle r="12" fill="#7A7266" ${INK}/><circle cx="-3" cy="-3" r="3.4" fill="#9A9284"/></g>`);
      // la gerbe d'écume où tombe le rocher
      a.push(`<g opacity="0">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.8;.82;.95;1" dur="7s" repeatCount="indefinite"/>`)}<path d="M226 396q-6 -16 2 -26M238 392q0 -20 6 -30M250 396q8 -14 4 -26" stroke="#F4FFFC" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="238" cy="398" rx="20" ry="5" fill="none" stroke="#F4FFFC" stroke-width="2"/></g>`);
      nom(70, 708, "Polyphème", 13); bulle(96, 448, "Personne ? Où ça ?!", 9, 7); }
    s.push(crete(860, 372, .9, 0, "#2A8AA8"));
    // ---- 9. la vie de la mer (peu) : dauphins qui sautent dans la lumière dorée, mouettes, amphores
    [[880, 300, 0], [700, 600, 1.6]].forEach(([u, v, b]) => { if (K.dT(u, v) < 26) return; a.push(`<g${K.anime ? "" : ` transform="translate(${u} ${v - 12})"`}>${an(`<animateMotion dur="3.2s" begin="${b}s" repeatCount="indefinite" rotate="auto" path="M${u - 30} ${v}Q${u} ${v - 34} ${u + 30} ${v}"/>`)}<g transform="scale(1.4)"><path d="M-10 0Q-2 -6 8 -2L12 0L8 2Q-2 4 -10 0Z" fill="#5A7A9A" ${INK}/><path d="M0 -4l-3 -4l5 3z" fill="#5A7A9A"/><path d="M-10 0l-4 -3v6z" fill="#5A7A9A" ${INK}/></g></g>`); });
    [[0, 560, 11], [1, 470, 14]].forEach(([q, v, du]) => a.push(`<g${K.anime ? "" : ` transform="translate(${760 + q * 140} 0)"`}>${an(`<animateTransform attributeName="transform" type="translate" values="${W + 40} 0;600 ${q ? -60 : -30}" dur="${du}s" begin="-${q * 5}s" repeatCount="indefinite"/>`)}<path d="M-9 ${v}q4.5 -5 9 0q4.5 -5 9 0" stroke="#FFFFFF" stroke-width="2" fill="none"/></g>`));
    // ---- 10. le cartouche du titre (coin haut gauche)
    s.push(`<g transform="translate(10 10)"><path d="M6 0H140Q148 0 148 8V34Q148 42 140 42H6Q-2 42 -2 34V8Q-2 0 6 0Z" fill="#F4E6C0" stroke="#8A6A3A" stroke-width="1.6"/><rect x="3" y="4" width="140" height="34" rx="5" fill="none" stroke="#B5482E" stroke-width=".8" stroke-dasharray="3 2"/><text x="73" y="21" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="14.5" letter-spacing="1.5" fill="#6A2A1A">L'ODYSSÉE</text><text x="73" y="33" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="9" fill="#6A4A2A">dix ans pour rentrer</text></g>`);
    // ---- 11. la piste : le sillage d'Ulysse, voie d'écume claire sur la mer, pointillés rouges du voyage
    K.route([["#0A1030", 46, ` opacity=".45" filter="url(#o2-flou)"`], ["#F4FFFC", 36], ["#9AE8DC", 32], ["#F6E8C4", 26]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#B5482E" stroke-width="1.8" stroke-dasharray="7 8" opacity=".55"/>`);
    a.push(`<path d="${K.piste}" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-dasharray="3 26" opacity=".75">${an(`<animate attributeName="stroke-dashoffset" values="0;-58" dur="2.4s" repeatCount="indefinite"/>`)}</path>`);
    K.depart();
    // ---- 12. les 4 pilotes : 4 petites galères vues du dessus, voiles à leurs couleurs
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `<g transform="scale(1.2)"><path d="M-9 0Q-6 -4 6 -3L11 0L6 3Q-6 4 -9 0Z" fill="#6A3E1E" ${INK}/><path d="M-5 -3l-3 -4M-1 -3l-3 -4M3 -3l-3 -4M-5 3l-3 4M-1 3l-3 4M3 3l-3 4" stroke="#4A2E16" stroke-width=".9"/><rect x="-2" y="-5.5" width="4" height="11" rx="1" fill="${c}" ${INK}/></g>`, 44, k * 1.3)));
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#o2-mer)"/>`, "#3A1A5A", .1); RES.portraits = PORTR; return RES;
  }

  const PEINTS_NUIT = { arene: peindreArene2, etoiles: peindreEtoiles3, anneau: peindreAnneau3, chocolat: peindreChocolat3, terrier: peindreTerrier3, chateau: peindreChateau5, plateau: peindrePlateau, envers: peindreEnvers2, multivers: peindreMultivers, dunes: peindreDunes4, titans: peindreTitans4, odyssee: peindreOdyssee2 };   // v16.34 : 10 cartes refaites au niveau de l'Arène
  const PEINTS = { foret: { peindre: peindreForet3, deco: decorForet }, garage: { peindre: peindreGarage4, deco: decorGarage } };
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
    // V16.18 : le décalage de la grille s'efface en course (le vainqueur franchit vraiment la ligne) ; ex æquo = même rang
    noms.forEach(n => { const k = Math.max(0, ordre.indexOf(n)), f = clamp(pts[n] / tour, 0, 1), dec = 4 + (grille && grille.indexOf(n) >= 0 ? grille.indexOf(n) * 9 : 0);
      out[n] = { s: (pts[n] / tour) * L - dec * (1 - f), base: (k - (nb - 1) / 2) * pas, rang: 1 + noms.filter(m => pts[m] > pts[n] + 1e-9).length }; });
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
      raf = 0; if (!cv.isConnected || I.pause) { I.endormi = true; return; }   // détachée ou en pause (bande-annonce) : on attend redim / reveiller
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
        if (a.scen) I.pts = a.scen(e); else Object.keys(a.a).forEach(n => { I.pts[n] = (a.de[n] || 0) + ((a.a[n] || 0) - (a.de[n] || 0)) * k; });   // v16.28 : scénario de course (3 tours)
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
      pause(b) { I.pause = !!b; if (!b) reveiller(); },
      /** v16.28 · course scénarisée : scen(e) → distances (en tours) de chaque voiture, e de 0 à 1 */
      jouerScenario(scen, duree, fin, depart) {
        if (!ANIM()) { api.placer(scen(1)); if (fin) fin(); return; }
        I.pts = scen(0); placer(true); V.forEach(x => x.hist = []);
        const now = performance.now(), dl = depart ? 3200 : 0;
        I.anim = { scen, de: scen(0), a: scen(1), t0: now + dl, t00: now, duree, fin, feux: !!depart };
        if (depart) I.feuxDepart = 0; I.saut = I.mode !== "helico"; reveiller();
      },   // V16.17 : la 3D se met en pause sous la bande-annonce
      jouer(de, a, duree, fin, depart) {
        if (!ANIM()) { api.placer(a); if (fin) fin(); return; }   // V16.17 : « animations réduites » respecté en 3D comme en 2D
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
        [B.sol, B.solOv, B.piste, B.pisteOv, B.eau].concat(V.map(x => x.b), RO.map(x => x.b)).forEach(t => { if (t) gl.deleteBuffer(t.b); });   // v16.27 : les objets qui tournent (moulin…) sont aussi libérés [bL, bP, bFX, bPT].forEach(b => gl.deleteBuffer(b));
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
  /** V16.17 · fond peint « cuit » en WebP (outils-tests/cuire-cartes.js) : image fixe, bien plus légère à afficher que le SVG */
  const carteCuite = k => { const c = self.CARTES_CUITES; return c && c[k] ? "img/cartes/" + k + ".webp?v=" + c[k] : null; };
  /* ---------- V16.35 · Événements en pleine course (carte 2D) ----------
     Chaque thème peut faire vivre la carte pendant la course, sans jamais toucher au résultat :
     maj(e, c, enCourse) est appelé à chaque image (e = avancement 0→1, c = { nom: { s, rang } }) ;
     permuter(e, pts) peut échanger un instant deux voitures (retour à la normale bien avant l'arrivée). Repère : coordonnées de la carte peinte (u). */
  function outilsEv(x) {
    const f = v => (+v).toFixed(1), NS = "http://www.w3.org/2000/svg";
    const el = (html, parent) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; (parent || x.g).appendChild(g); return g; };
    const anim = (dur, fn, fin) => { const t0 = performance.now(); const pas = now => { if (!x.svg.isConnected) return; const p = Math.min(1, (now - t0) / dur); fn(p); if (p < 1) requestAnimationFrame(pas); else if (fin) fin(); }; requestAnimationFrame(pas); };
    const voiture = n => { const v = x.V[n]; return v ? [v.x * x.KU, v.y * x.KU] : null; }, dedans = p => p && [Math.max(160, Math.min(920, p[0])), Math.max(260, Math.min(640, p[1]))];
    const bulle = (u, v, txt, t) => { t = t || 26; const w = txt.length * t * .54 + t * 1.4, h = t * 1.7; u = Math.max(w / 2 + 8, Math.min(1072 - w / 2, u)); v = Math.max(h / 2 + 8, Math.min(712 - h / 2, v));
      return el('<g transform="translate(' + f(u) + " " + f(v) + ')"><rect x="' + f(-w / 2) + '" y="' + f(-h / 2) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(h / 2) + '" fill="#14161C" fill-opacity=".86" stroke="#FFD86B" stroke-width="2.5"/><text y="' + f(t * .36) + '" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="' + t + '" fill="#FFF3C8">' + txt + "</text></g>"); };
    const premier = c => Object.keys(c).sort((a, b) => c[a].rang - c[b].rang)[0], dernier = c => Object.keys(c).sort((a, b) => c[b].rang - c[a].rang || c[a].s - c[b].s)[0];
    return { f, el, anim, voiture, dedans, bulle, premier, dernier };
  }
  const EVENEMENTS = {
    /* avril · l'Œil suit la voiture du DERNIER ; quand le vainqueur passe la ligne, l'anneau s'envole et tombe dans la lave */
    anneau(x) {
      const O = outilsEv(x), L = x.lieux, oe = L.oeil, de = L.destin; if (!oe) return null;
      x.svg.querySelectorAll(".an-suit").forEach(n => n.style.display = "none");
      const fx = O.el('<defs><linearGradient id="ev-fx"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".95"/><stop offset=".6" stop-color="#FF9A3A" stop-opacity=".5"/><stop offset="1" stop-color="#FF7A2A" stop-opacity=".08"/></linearGradient></defs><path d="M0 -4L900 -70L900 70L0 4Z" fill="url(#ev-fx)" style="mix-blend-mode:screen"/>'), pu = O.el('<ellipse rx="2.6" ry="9" fill="#120302"/>');
      let fait = false, eteint = false;
      const viser = n => { const p = O.voiture(n); if (!p) return; const a = Math.atan2(p[1] - oe[1], p[0] - oe[0]), d = Math.hypot(p[0] - oe[0], p[1] - oe[1]) || 1;
        fx.setAttribute("transform", "translate(" + O.f(oe[0]) + " " + O.f(oe[1]) + ") rotate(" + O.f(a * 180 / Math.PI) + ") scale(" + O.f(Math.max(.2, d / 900 * 1.15)) + " 1)");
        pu.setAttribute("transform", "translate(" + O.f(oe[0] + (p[0] - oe[0]) / d * 9) + " " + O.f(oe[1] + (p[1] - oe[1]) / d * 3) + ")"); };
      const anneau = vainq => { const p = O.voiture(vainq); if (!p || !de) return; fait = true;
        const g = O.el('<g><circle r="30" fill="#FFD86B" opacity=".35"/><circle r="15" fill="none" stroke="#F7C948" stroke-width="6"/><circle r="15" fill="none" stroke="#FFF6C8" stroke-width="1.6" stroke-dasharray="5 7"/></g>');
        const b = O.bulle(p[0], p[1] - 70, "Le Précieux…", 24);
        O.anim(2200, q => { const k = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2, u = p[0] + (de[0] - p[0]) * k, v = p[1] + (de[1] - p[1]) * k - Math.sin(q * Math.PI) * 180;
          g.setAttribute("transform", "translate(" + O.f(u) + " " + O.f(v) + ") rotate(" + O.f(q * 720) + ") scale(" + O.f(1 - q * .55) + ")"); if (q > .3) b.setAttribute("opacity", O.f(Math.max(0, 1 - (q - .3) * 3))); },
        () => { g.remove(); b.remove(); const sp = O.el('<g transform="translate(' + O.f(de[0]) + " " + O.f(de[1]) + ')"><circle r="10" fill="url(#an-lave)"/><circle r="10" fill="none" stroke="#FFB02A" stroke-width="5"/></g>'), c = sp.firstChild.children;
          const t = O.bulle(de[0], de[1] - 90, "L’anneau est détruit !", 26);
          O.anim(1600, q => { c[0].setAttribute("r", O.f(10 + q * 150)); c[0].setAttribute("opacity", O.f(1 - q)); c[1].setAttribute("r", O.f(10 + q * 110)); c[1].setAttribute("opacity", O.f(1 - q)); if (q > .2) { fx.setAttribute("opacity", O.f(Math.max(0, 1 - (q - .2) * 2))); pu.setAttribute("opacity", O.f(Math.max(0, 1 - (q - .2) * 2))); } },
            () => { sp.remove(); eteint = true; setTimeout(() => t.remove(), 1800); }); }); };
      return {
        raz() { fait = false; eteint = false; fx.removeAttribute("opacity"); pu.removeAttribute("opacity"); },
        maj(e, c, enCourse) { if (!eteint) viser(O.dernier(c)); if (enCourse && !fait && e >= .985 && x.anime) anneau(O.premier(c)); }
      };
    },
    /* décembre · la bâche « 2027 ? » s'envole et retombe sur la voiture du vainqueur, puis se lève : révélation */
    garage(x) {
      const O = outilsEv(x); let fait = false;
      const bache = n => { const p = O.voiture(n); if (!p) return; fait = true;
        const g = O.el('<g><path d="M-46 -30C-30 -44 30 -44 46 -30L52 26C20 34 -20 34 -52 26Z" fill="#8E96A3" stroke="#3B4048" stroke-width="2.5"/><path d="M-30 -32C-20 0 -24 20 -30 30M0 -38V32M30 -32C20 0 24 20 30 30" stroke="#6C737E" stroke-width="2" fill="none"/><text y="8" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="22" fill="#F4F6F8">2027 ?</text></g>');
        O.anim(900, q => { const k = 1 - Math.pow(1 - q, 3); g.setAttribute("transform", "translate(" + O.f(p[0] + (1 - k) * 140) + " " + O.f(p[1] - (1 - k) * 260) + ") rotate(" + O.f((1 - k) * -40) + ")"); }, () => {
          const t = O.bulle(p[0], p[1] - 70, "Et la voiture de l’année est…", 22);
          setTimeout(() => { const eclat = O.el('<g transform="translate(' + O.f(p[0]) + " " + O.f(p[1]) + ')">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => '<path d="M0 0L' + O.f(Math.cos(i * Math.PI / 6) * 90) + " " + O.f(Math.sin(i * Math.PI / 6) * 90) + '" stroke="' + ["#FFD86B", "#4C9AFF", "#FF6FA8", "#2BB6A3"][i % 4] + '" stroke-width="5" stroke-linecap="round"/>').join("") + "</g>");
            O.anim(1100, q => { g.setAttribute("transform", "translate(" + O.f(p[0] - q * 60) + " " + O.f(p[1] - q * 320) + ") rotate(" + O.f(q * -70) + ") scale(" + O.f(1 + q * .4) + ")"); g.setAttribute("opacity", O.f(1 - q)); eclat.setAttribute("opacity", O.f(1 - q)); eclat.setAttribute("transform", "translate(" + O.f(p[0]) + " " + O.f(p[1]) + ") scale(" + O.f(.3 + q) + ")"); },
              () => { g.remove(); eclat.remove(); t.remove(); }); }, 900); }); };
      return { raz() { fait = false; }, maj(e, c, enCourse) { if (enCourse && !fait && e >= .985 && x.anime) bache(O.premier(c)); } };
    },
    /* février · au 2e tour, un escalier pivote en travers de la piste… et s'écarte de justesse devant le leader */
    chateau(x) {
      const O = outilsEv(x), T = x.T, L = T.L; let s0 = null, g = null, passe = 0, b = null;
      const raz = () => { s0 = null; passe = 0; if (g) g.remove(); g = null; if (b) b.remove(); b = null; };
      return { raz,
        maj(e, c, enCourse) {
          if (!enCourse || !x.anime) return; const lead = O.premier(c);
          if (s0 === null && e >= .5) { s0 = ((c[lead].s + .3 * L) % L + L) % L; const p = T.a(s0, 0), a = Math.atan2(p.tz, p.tx) * 180 / Math.PI;
            g = O.el('<g transform="translate(' + O.f(p.x * x.KU) + " " + O.f(p.z * x.KU) + ") rotate(" + O.f(a) + ')"><g class="esc">' + '<rect x="-66" y="-30" width="132" height="60" rx="4" fill="#000" opacity=".35" transform="translate(5 6)"/>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => '<rect x="' + (-66 + i * 12) + '" y="-26" width="12" height="52" fill="' + (i % 2 ? "#8C7A5C" : "#B49E74") + '" stroke="#3A2E1E" stroke-width="1.5"/>').join("") + '<path d="M-68 -28H68M-68 28H68" stroke="#4A3A24" stroke-width="5" stroke-linecap="round"/><circle cx="-68" cy="-28" r="5" fill="#C9A23A"/><circle cx="68" cy="-28" r="5" fill="#C9A23A"/><circle cx="-68" cy="28" r="5" fill="#C9A23A"/><circle cx="68" cy="28" r="5" fill="#C9A23A"/></g></g>');
            b = O.bulle(p.x * x.KU, p.z * x.KU - 80, "Les escaliers changent de place !", 22); }
          if (!g) return; const ds = ((s0 - (c[lead].s % L) + L) % L), esc = g.firstChild.firstChild;
          let ang = 90; if (e < .54) ang = 90 * Math.min(1, (e - .5) / .04);
          if (ds < .07 * L || passe) { ang = Math.min(ang, 90 * Math.max(0, (ds - .02 * L) / (.05 * L))); if (ds > .5 * L || ds < .02 * L) passe = Math.max(passe, 1); }
          if (passe) { ang = 0; passe++; g.setAttribute("opacity", O.f(Math.max(0, 1 - passe / 40))); if (b) b.setAttribute("opacity", O.f(Math.max(0, 1 - passe / 25))); }
          esc.setAttribute("transform", "rotate(" + O.f(ang) + ")");
        } };
    },
    /* mars · « Changement de place ! » : le premier et le dernier échangent leurs places un instant (pour rire, rien ne change à l'arrivée) */
    terrier(x) {
      const O = outilsEv(x); let duo = null, b = null;
      const m = e => e < .3 || e > .44 ? 0 : e < .33 ? (e - .3) / .03 : e > .41 ? (.44 - e) / .03 : 1;
      return {
        raz() { duo = null; if (b) b.remove(); b = null; },
        permuter(e, pts) { if (!x.anime) return; if (!duo && e >= .3 && e < .44) { const n = Object.keys(pts).sort((a, c) => pts[c] - pts[a]); if (n.length > 1) { duo = [n[0], n[n.length - 1]]; b = O.bulle(540, 70, "Changement de place ! ☕", 28); } }
          if (!duo) return; const k = m(e), a = pts[duo[0]], c = pts[duo[1]]; if (k > 0) { pts[duo[0]] = a + (c - a) * k; pts[duo[1]] = c + (a - c) * k; }
          if (b && e > .45) { b.remove(); b = null; } },
        maj() { }
      };
    },
    /* ---------- V16.38 · un événement pour chaque mois (attachés aux voitures : ils survivent aux nouvelles cartes) ---------- */
    /* janvier · des ballons s'envolent de la voiture du vainqueur à l'arrivée */
    foret(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; const p = O.dedans(O.voiture(O.premier(c))); if (!p) return;
        const g = O.el([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(i => { const a = (i / 14 - .5) * 1.6, col = ["#FF6FA8", "#4C9AFF", "#F2C230", "#2BB6A3", "#F2994A", "#B57BFF", "#FF5A5F"][i % 7];
          return '<g transform="translate(' + O.f(Math.sin(a) * 60) + " " + O.f(-90 - Math.cos(a) * 50 - (i % 3) * 14) + ')"><path d="M0 14Q' + O.f(-Math.sin(a) * 30) + ' 50 ' + O.f(-Math.sin(a) * 60) + ' 90" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/><ellipse rx="13" ry="16" fill="' + col + '"/><ellipse cx="-4" cy="-6" rx="3.5" ry="5" fill="#fff" opacity=".45"/></g>'; }).join(""));
        const b = O.bulle(p[0], p[1] - 210, "Et c’est parti pour l’aventure !", 22);
        O.anim(3200, q => { g.setAttribute("transform", "translate(" + O.f(p[0] + Math.sin(q * 6) * 8) + " " + O.f(p[1] - q * 300) + ") scale(" + O.f(.4 + Math.min(1, q * 3) * .6) + ")"); g.setAttribute("opacity", O.f(q < .75 ? 1 : (1 - q) * 4)); b.setAttribute("opacity", O.f(q < .6 ? 1 : Math.max(0, 1 - (q - .6) * 3))); }, () => { g.remove(); b.remove(); }); } }; },
    /* mai · un parachute argenté (cadeau des sponsors) descend sur la voiture du dernier */
    arene(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .45 || !x.anime) return; fait = true; const n = O.dernier(c);
        const g = O.el('<g><path d="M-34 0Q0 -40 34 0Q24 -6 17 0Q8 -8 0 0Q-8 -8 -17 0Q-24 -6 -34 0Z" fill="#E8ECF2" stroke="#9AA3B0" stroke-width="1.5"/><path d="M-34 0L-6 42M34 0L6 42M0 0V42" stroke="#C9CFD8" stroke-width="1"/><rect x="-9" y="40" width="18" height="15" rx="2" fill="#C0C6CF" stroke="#7D8590" stroke-width="1.5"/><circle cx="0" cy="47.5" r="3" fill="#E2B23C"/></g>');
        const b = O.bulle(540, 60, "🪂 Un cadeau des sponsors pour " + n + " !", 24);
        O.anim(2600, q => { const p = O.voiture(n) || [0, 0]; g.setAttribute("transform", "translate(" + O.f(p[0] + Math.sin(q * 9) * 12 * (1 - q)) + " " + O.f(p[1] - 60 - (1 - q) * 360) + ")"); if (q > .8) g.setAttribute("opacity", O.f((1 - q) * 5)); }, () => { g.remove(); setTimeout(() => b.remove(), 600); }); } }; },
    /* juin · le chasseur du vainqueur fait un looping au-dessus de la ligne */
    etoiles(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; const n = O.premier(c), p = O.dedans(O.voiture(n)); if (!p) return; const col = (x.V[n] && x.V[n].couleur) || "#4C9AFF";
        const g = O.el('<g><path d="M-22 0L-4 -4 18 0-4 4Z" fill="#E8ECF2" stroke="#3B4048" stroke-width="1.2"/><path d="M-14 -4L-20 -16M-14 4L-20 16M-2 -4L-8 -16M-2 4L-8 16" stroke="' + col + '" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="0" r="3" fill="#1B1D22"/><path d="M-22 0H-46" stroke="' + col + '" stroke-width="5" opacity=".6" stroke-linecap="round"/></g>');
        const b = O.bulle(p[0], p[1] - 150, "Bien joué, petit ! Ne te laisse pas griser.", 20);
        O.anim(2400, q => { const a = q * Math.PI * 2 - Math.PI / 2, r = 90, u = p[0] - 200 + q * 400 + Math.cos(a) * r * Math.sin(q * Math.PI), v = p[1] - 90 + Math.sin(a) * r * Math.sin(q * Math.PI);
          const d = q * 360 + Math.cos(q * Math.PI) * 0; g.setAttribute("transform", "translate(" + O.f(u) + " " + O.f(v) + ") rotate(" + O.f(d) + ")"); g.setAttribute("opacity", O.f(q > .85 ? (1 - q) * 6.6 : 1)); }, () => { g.remove(); b.remove(); }); } }; },
    /* juillet · le ver surgit juste derrière la voiture du dernier */
    dunes(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .4 || !x.anime) return; fait = true; const n = O.dernier(c), p0 = O.voiture(n); if (!p0) return; const p = [p0[0], p0[1]];
        const g = O.el('<g><ellipse rx="70" ry="22" fill="#C9874A" opacity=".55"/><g class="ver"><path d="M-40 0C-40 -90 40 -90 40 0" stroke="#8C6A4E" stroke-width="34" fill="none"/><path d="M-40 0C-40 -90 40 -90 40 0" stroke="#6E5440" stroke-width="34" fill="none" stroke-dasharray="3 9"/><circle cx="40" cy="-4" r="22" fill="#3A2418"/><circle cx="40" cy="-4" r="15" fill="none" stroke="#F4E3C1" stroke-width="4" stroke-dasharray="2 3"/></g>' + [0, 1, 2, 3, 4, 5, 6].map(i => '<circle cx="' + (-60 + i * 20) + '" cy="' + (-4 - (i % 2) * 10) + '" r="' + (6 + i % 3 * 3) + '" fill="#E3B57A" opacity=".8"/>').join("") + "</g>");
        const b = O.bulle(p[0], p[1] - 130, "Le ver ! Derrière " + n + " !", 24);
        O.anim(2200, q => { const k = Math.sin(q * Math.PI); g.setAttribute("transform", "translate(" + O.f(p[0] - 90) + " " + O.f(p[1] + 14) + ")"); g.querySelector(".ver").setAttribute("transform", "translate(0 " + O.f((1 - k) * 60) + ") scale(1.9 " + O.f(Math.max(.05, k) * 1.9) + ")"); g.setAttribute("opacity", O.f(Math.min(1, k * 3))); }, () => { g.remove(); b.remove(); }); } }; },
    /* août · le monde bascule à l'envers un instant */
    envers(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; x.svg.style.transform = ""; x.svg.style.filter = ""; }, maj(e, c, en) { if (!en || fait || e < .5 || !x.anime) return; fait = true; const sv = x.svg;
        sv.style.transition = "transform .5s ease-in-out, filter .5s"; sv.style.transform = "scaleY(-1)"; sv.style.filter = "hue-rotate(160deg) saturate(1.6) brightness(.8)";
        setTimeout(() => { sv.style.transform = ""; sv.style.filter = ""; setTimeout(() => { sv.style.transition = ""; const b = O.bulle(540, 360, "On revient de loin…", 26); setTimeout(() => b.remove(), 1600); }, 550); }, 1700); } }; },
    /* septembre · un portail orange s'ouvre devant le leader */
    multivers(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .55 || !x.anime) return; fait = true; const n = O.premier(c);
        const g = O.el('<g>' + Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return '<path d="M' + O.f(Math.cos(a) * 34) + " " + O.f(Math.sin(a) * 34) + "l" + O.f(Math.cos(a + 1.4) * 10) + " " + O.f(Math.sin(a + 1.4) * 10) + '" stroke="' + (i % 3 ? "#FF9A2A" : "#FFE07A") + '" stroke-width="3" stroke-linecap="round"/>'; }).join("") + '<circle r="32" fill="none" stroke="#FFB02A" stroke-width="4"/><circle r="30" fill="#2A1450" opacity=".35"/></g>');
        const b = O.bulle(540, 60, "Un portail s’ouvre devant " + n + " !", 24);
        O.anim(2000, q => { const p = O.voiture(n) || [0, 0]; g.setAttribute("transform", "translate(" + O.f(p[0]) + " " + O.f(p[1]) + ") rotate(" + O.f(q * 540) + ") scale(" + O.f(Math.sin(q * Math.PI) * 1.4) + ")"); }, () => { g.remove(); b.remove(); }); } }; },
    /* octobre · pluie de tickets d'or sur le vainqueur */
    chocolat(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; const n = O.premier(c), p = O.dedans(O.voiture(n)); if (!p) return;
        const T = Array.from({ length: 16 }, (_, i) => ({ dx: (Math.random() - .5) * 220, d: Math.random() * .35, r: Math.random() * 360, el: O.el('<g><rect x="-16" y="-9" width="32" height="18" rx="2" fill="#F2C230" stroke="#A8761A" stroke-width="1.5"/><rect x="-12" y="-5" width="24" height="10" fill="none" stroke="#A8761A" stroke-width=".8"/></g>') }));
        const b = O.bulle(p[0], p[1] - 160, "Un ticket d’or pour " + n + " !", 24);
        O.anim(2600, q => T.forEach(t => { const k = Math.max(0, Math.min(1, (q - t.d) / .6)); t.el.setAttribute("transform", "translate(" + O.f(p[0] + t.dx * (1 - k * .7)) + " " + O.f(p[1] - 230 + k * 220) + ") rotate(" + O.f(t.r + k * 400) + ") scale(" + O.f(.6 + Math.sin(k * 6) * .15) + ")"); t.el.setAttribute("opacity", O.f(q > .85 ? (1 - q) * 6.6 : k > 0 ? 1 : 0)); }), () => { T.forEach(t => t.el.remove()); b.remove(); }); } }; },
    /* novembre · la main d'un titan balaie la piste juste derrière le dernier */
    titans(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .48 || !x.anime) return; fait = true; const n = O.dernier(c), p0 = O.voiture(n); if (!p0) return;
        const g = O.el('<g><ellipse cx="6" cy="10" rx="40" ry="34" fill="#000" opacity=".25"/>' + [[-24, -12, -28], [-9, -22, -8], [7, -24, 6], [22, -18, 22]].map(([u, v, a]) => '<rect x="-7" y="-40" width="14" height="44" rx="7" fill="#E0A27A" stroke="#4A2414" stroke-width="3" transform="translate(' + u + " " + v + ") rotate(" + a + ')"/>').join("") + '<rect x="-7" y="-30" width="14" height="36" rx="7" fill="#E0A27A" stroke="#4A2414" stroke-width="3" transform="translate(-30 14) rotate(-75)"/><ellipse cx="0" cy="4" rx="30" ry="26" fill="#E0A27A" stroke="#4A2414" stroke-width="3"/><path d="M-14 0C-6 6 6 6 14 0M-10 12C-2 16 8 16 14 10" stroke="#B5704A" stroke-width="2" fill="none"/></g>');
        const b = O.bulle(540, 60, "Un titan ! " + n + " l’a échappé belle !", 24);
        O.anim(1800, q => { const k = Math.sin(q * Math.PI), p = O.voiture(n) || p0; g.setAttribute("transform", "translate(" + O.f(p[0] - 150 + q * 120) + " " + O.f(p[1] + 50 - k * 50) + ") rotate(" + O.f(-30 + q * 60) + ") scale(2.6)"); g.setAttribute("opacity", O.f(Math.min(1, k * 2.5))); }, () => { g.remove(); setTimeout(() => b.remove(), 500); }); } }; },
    /* décembre 2027 · Poséidon foudroie la mer juste devant le leader */
    odyssee(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .6 || !x.anime) return; fait = true; const n = O.premier(c), p = O.voiture(n); if (!p) return;
        const g = O.el('<g><rect x="-2000" y="-2000" width="4000" height="4000" fill="#fff" class="fl"/><path d="M' + O.f(p[0] + 30) + ' -20L' + O.f(p[0] + 4) + " " + O.f(p[1] * .4) + "L" + O.f(p[0] + 34) + " " + O.f(p[1] * .45) + "L" + O.f(p[0] + 12) + " " + O.f(p[1] - 8) + '" stroke="#FFF7C0" stroke-width="7" fill="none" stroke-linejoin="bevel"/><circle cx="' + O.f(p[0] + 12) + '" cy="' + O.f(p[1] - 8) + '" r="30" fill="none" stroke="#9BE8FF" stroke-width="5" class="on"/></g>');
        const b = O.bulle(540, 60, "Poséidon gronde sur " + n + " !", 24);
        O.anim(1400, q => { g.querySelector(".fl").setAttribute("opacity", O.f(q < .15 ? q * 4 : Math.max(0, .6 - q))); g.querySelector(".on").setAttribute("r", O.f(30 + q * 90)); g.setAttribute("opacity", O.f(1 - q * q)); }, () => { g.remove(); setTimeout(() => b.remove(), 700); }); } }; }
  };

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
      '<g transform="scale(' + (1 / KU) + ')"><image href="' + (carteCuite(def.peint) || CP.url || (CP.url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(CP.fond))) + '" x="0" y="0" width="' + CP.W + '" height="' + CP.H + '"/>' + CP.anim +
      (CP.portraits && o.portrait ? CP.portraits.map(p => { const v = (o.voitures || [])[p.k]; const h = v ? o.portrait(v.nom) : ""; return h ? '<foreignObject x="' + (p.x - p.r) + '" y="' + (p.y - p.r) + '" width="' + 2 * p.r + '" height="' + 2 * p.r + '"><div xmlns="http://www.w3.org/1999/xhtml" class="p2-portrait">' + h + "</div></foreignObject>" : ""; }).join("") : "") + "</g>" +   // v16.31 : les vrais portraits (Mon portrait) dans les cartes qui en prévoient
      zoneTrait(Z.atout, o.atoutCol) + zoneTrait(Z.piege, o.piegeCol) + fleches +
      '<g transform="translate(' + p0.x.toFixed(1) + " " + p0.z.toFixed(1) + ") rotate(" + ang.toFixed(1) + ") scale(" + (k * .9).toFixed(2) + ')"><rect x="-1.6" y="-6" width="3.2" height="12" fill="#fff"/><rect x="-1.6" y="-6" width="1.6" height="2" fill="#111"/><rect x="0" y="-4" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="-2" width="1.6" height="2" fill="#111"/><rect x="0" y="0" width="1.6" height="2" fill="#111"/><rect x="-1.6" y="2" width="1.6" height="2" fill="#111"/><rect x="0" y="4" width="1.6" height="2" fill="#111"/></g>' +
      '<g class="p2-v"></g><g class="p2-ev" transform="scale(' + (1 / KU) + ')"></g>';
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
    (o.voitures || []).forEach(v => { const g = document.createElementNS(NS, "g"); g.setAttribute("class", "p2-car" + (v.moi ? " ici" : "")); g.innerHTML = '<g transform="scale(' + k.toFixed(2) + ')">' + (v.moi ? '<circle r="10.5" fill="none" stroke="' + v.couleur + '" stroke-width="1.6" opacity=".55"/>' : "") + '<circle r="7" fill="' + v.couleur + '" stroke="#fff" stroke-width="1.8"/><text y="3" text-anchor="middle"></text></g>'; gV.appendChild(g); V[v.nom] = { g, t: g.querySelector("text"), x: 0, y: 0, couleur: v.couleur }; });
    const I = { pts: Object.assign({}, o.pts || {}), anim: null, ordre: (o.voitures || []).map(v => v.nom), e: 1 };
    const gEv = svg.querySelector(".p2-ev"), EVf = gEv && EVENEMENTS[def.peint];   // V16.35 : événements en course
    let EV = null; try { EV = EVf ? EVf({ svg, g: gEv, T, KU, V, lieux: (CP && CP.lieux) || {}, anime: ANIM() }) : null; } catch (e) { EV = null; }
    let raf = 0;
    function poser() {
      const c = cibles(I.pts, o.tour || 25, T.L, I.ordre, o.grille);
      Object.entries(c).forEach(([n, t]) => { const v = V[n]; if (!v) return; const p = T.a(t.s, t.voie * .8); v.x = p.x; v.y = p.z; v.g.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.z.toFixed(1) + ")"); v.t.textContent = t.rang; });
      // l'ordre d'affichage : le premier dessus
      Object.entries(c).sort((a, b) => b[1].rang - a[1].rang).forEach(([n]) => V[n] && gV.appendChild(V[n].g));
      if (EV) try { EV.maj(I.anim ? I.e : 1, c, !!(I.anim && I.anim.scen)); } catch (e) { }
      if (o.image) o.image(api);
    }
    function boucle(now) {
      raf = 0; if (!svg.isConnected) return; const a = I.anim; if (!a) return;
      const e = clamp((now - a.t0) / a.duree, 0, 1), k = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
      I.e = e; if (a.scen) { I.pts = a.scen(e); if (EV && EV.permuter) try { EV.permuter(e, I.pts); } catch (er) { } } else Object.keys(a.a).forEach(n => I.pts[n] = (a.de[n] || 0) + ((a.a[n] || 0) - (a.de[n] || 0)) * k); poser();
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
      jouerScenario(scen, duree, fin) { if (EV && EV.raz) EV.raz(); if (!ANIM()) { api.placer(scen(1)); if (fin) fin(); return; } I.e = 0; I.pts = scen(0); poser(); I.anim = { scen, de: scen(0), a: scen(1), t0: performance.now(), duree, fin }; if (!raf) raf = requestAnimationFrame(boucle); },
      camera() { }, focus() { }, ecran, ecranMonde, taille: () => taille, courant: () => Object.assign({}, I.pts), enCours: () => !!I.anim, redim() { if (I.anim && !raf) raf = requestAnimationFrame(boucle); if (o.image) o.image(api); }, reveiller() { if (I.anim && !raf) raf = requestAnimationFrame(boucle); },   // V16.16 : la course reprend si la piste a été détachée
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
    /** V16.12 · la carte peinte du circuit en image (fond de la bande-annonce), ou null */
    carte(id) {
      const def = TRACES[id], PE = def && def.peint ? PEINTS[def.peint] : null; if (!PE) return null;
      const cu = carteCuite(def.peint); if (cu) return cu;   // V16.17 : l'image cuite, sans recalculer le dessin (plus de blocage d'une seconde)
      try { const T = echantillonner(def), CP = CARTES_P[def.peint] || (CARTES_P[def.peint] = PE.peindre(T, zones(T), def)); return CP.url || (CP.url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(CP.fond)); } catch (e) { return null; }
    },
    /** vignette SVG du tracé (calendrier, Stand) */
    vignette(id, coul) {
      const def = TRACES[id]; if (!def) return "";
      const T = echantillonner(def), m = 20, l = []; for (let i = 0; i <= T.N; i += 3) { const k = i % T.N; l.push(T.X[k].toFixed(0) + " " + T.Z[k].toFixed(0)); }
      return '<svg class="p2-vign" viewBox="' + (T.cx - T.rx - m).toFixed(0) + " " + (T.cz - T.rz - m).toFixed(0) + " " + (T.rx * 2 + 2 * m).toFixed(0) + " " + (T.rz * 2 + 2 * m).toFixed(0) + '" aria-hidden="true"><path d="M' + l.join("L") + 'Z" fill="none" stroke="' + (coul || "currentColor") + '" stroke-width="14" stroke-linejoin="round"/></svg>';
    }
  };
})();
