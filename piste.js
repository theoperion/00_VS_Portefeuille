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
    bahrein: { pts: etoile([[3, .14, .3], [5, .09, 1], [7, .05, 2.2]], 42), decor: "lucioles", heure: "crepuscule", amb: "lucioles", peint: "ratatouille", reperes: [] },   // V16.47 : janvier = Ratatouille (la Forêt garde son peintre pour plus tard)
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
  function peindreEnvers3(T, Z, def) {
    const K = kit(T, def, 1985, "e3-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#140C10" stroke-width="1.6"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const o0 = K.anime ? 0 : 1, f2 = v => (+v).toFixed(2), YF = 360;
    const [X] = K.rep({ t: "faille" });
    // ---- la faille : une couture déchirée, presque horizontale, d'un bord à l'autre (la seule source de lumière de la carte)
    const BY = []; for (let x = -30; x <= W + 30; x += 16) BY.push([x, YF + 5 * Math.sin(x / 47 + 1) + 3 * Math.sin(x / 13) + (r() - .5) * 4]);
    const by = x => { for (let k = 1; k < BY.length; k++) if (BY[k][0] >= x) { const [x0, y0] = BY[k - 1], [x1, y1] = BY[k]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return YF; };
    const envers = (x, y) => y > by(x), cou = BY.map(p => f(p[0]) + " " + f(p[1])).join("L");
    s.push(`<clipPath id="e3-haut"><path d="M-30 -30L${cou}L${W + 30} -30Z"/></clipPath><clipPath id="e3-bas"><path d="M-30 ${H + 30}L${cou}L${W + 30} ${H + 30}Z"/></clipPath>`);
    a.push(`<clipPath id="e3-basA"><path d="M-30 ${H + 30}L${cou}L${W + 30} ${H + 30}Z"/></clipPath>`);
    const FAILLES = []; for (let i = 0; i < K.N; i++) { const j = (i + 1) % K.N; if (envers(K.P[i][0], K.P[i][1]) !== envers(K.P[j][0], K.P[j][1])) FAILLES.push({ fr: +(j / K.N).toFixed(3), x: K.P[j][0], y: K.P[j][1], vers: envers(K.P[j][0], K.P[j][1]) ? "envers" : "normal" }); }
    // un membre organique (bras, liane) : polygone autour d'une courbe de Bézier, épaisseur variable le long du membre
    const membre = (p0, c, p1, L) => { const g = [], d = []; for (let j = 0; j <= 20; j++) { const t = j / 20, u = 1 - t, x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
        const dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]), l = Math.hypot(dx, dy) || 1; let k = 1; while (k < L.length - 1 && L[k][0] < t) k++;
        const w = (L[k - 1][1] + (L[k][1] - L[k - 1][1]) * Math.min(1, Math.max(0, (t - L[k - 1][0]) / ((L[k][0] - L[k - 1][0]) || 1)))) / 2; g.push(f(x - dy / l * w) + " " + f(y + dx / l * w)); d.unshift(f(x + dy / l * w) + " " + f(y - dx / l * w)); }
      return "M" + g.join("L") + "L" + d.join("L") + "Z"; };
    const BASE = 322, DX = Math.round(X), YT = by(X), HY = YT - 182, HS = 2.3;   // HY : la tête-fleur du monstre

    // ---- dégradés (couche fixe)
    s.push(`<linearGradient id="e3-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06041A"/><stop offset=".45" stop-color="#241034"/><stop offset=".8" stop-color="#5A1434"/><stop offset="1" stop-color="#8A1E3A"/></linearGradient>`);
    s.push(`<linearGradient id="e3-cendre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E04858"/><stop offset=".06" stop-color="#8A2E4A"/><stop offset=".22" stop-color="#4E3A5A"/><stop offset=".45" stop-color="#363C5C"/><stop offset=".75" stop-color="#1C2034"/><stop offset="1" stop-color="#0E0C18"/></linearGradient>`);
    s.push(`<linearGradient id="e3-lumH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF3B4E" stop-opacity="0"/><stop offset=".45" stop-color="#FF3B4E" stop-opacity=".12"/><stop offset="1" stop-color="#FF5A6A" stop-opacity=".75"/></linearGradient>`);
    s.push(`<linearGradient id="e3-nuitH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05020A" stop-opacity=".82"/><stop offset=".55" stop-color="#05020A" stop-opacity=".35"/><stop offset="1" stop-color="#05020A" stop-opacity="0"/></linearGradient>`);
    s.push(`<linearGradient id="e3-lumB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A86" stop-opacity=".7"/><stop offset=".25" stop-color="#FF2B3D" stop-opacity=".28"/><stop offset="1" stop-color="#FF2B3D" stop-opacity="0"/></linearGradient>`);
    s.push(`<radialGradient id="e3-bords" gradientUnits="userSpaceOnUse" cx="${f(X)}" cy="${YF}" r="720"><stop offset="0" stop-color="#05020A" stop-opacity="0"/><stop offset=".55" stop-color="#05020A" stop-opacity="0"/><stop offset="1" stop-color="#05020A" stop-opacity=".7"/></radialGradient>`);
    s.push(`<radialGradient id="e3-rouge" r="50%"><stop offset="0" stop-color="#FFE0E4"/><stop offset=".15" stop-color="#FF3B4E" stop-opacity=".9"/><stop offset=".5" stop-color="#C8102E" stop-opacity=".35"/><stop offset="1" stop-color="#8A0A1E" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="e3-lueur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2B3D" stop-opacity="0"/><stop offset=".5" stop-color="#FF2B3D" stop-opacity=".6"/><stop offset="1" stop-color="#FF2B3D" stop-opacity="0"/></linearGradient>`);
    s.push(`<linearGradient id="e3-peau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1A22"/><stop offset=".55" stop-color="#22141A"/><stop offset=".85" stop-color="#4A1C26"/><stop offset="1" stop-color="#8A2A36"/></linearGradient>`);
    a.unshift(`<radialGradient id="e3-fA" r="50%"><stop offset="0" stop-color="#FFB0B8" stop-opacity=".95"/><stop offset=".4" stop-color="#FF2B3D" stop-opacity=".5"/><stop offset="1" stop-color="#C8102E" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<radialGradient id="e3-spA" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#F0DCE0" stop-opacity=".7"/><stop offset="1" stop-color="#F0DCE0" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<linearGradient id="e3-phA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF6C8" stop-opacity=".95"/><stop offset=".6" stop-color="#FFF6C8" stop-opacity=".35"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></linearGradient>`);

    // ---- 1. le ciel qui s'embrase vers la faille, zébré d'éclairs rouges ; la forêt de Hawkins en silhouettes de plus en plus noires
    s.push(`<g clip-path="url(#e3-haut)"><rect width="${W}" height="204" fill="url(#e3-ciel)"/><rect y="200" width="${W}" height="${YF - 194}" fill="#0A0510"/>`);
    for (let k = 0; k < 22; k++) s.push(`<circle cx="${f(r() * W)}" cy="${f(6 + r() * 60)}" r="${f(.6 + r() * .9)}" fill="#FFE8F0" opacity="${f2(.25 + r() * .45)}"/>`);
    const eclair = (x, y, t0, n, pas) => { let d = "M" + f(x) + " " + f(y); for (let j = 0; j < n; j++) { const t = t0 + (r() - .5) * 1.3; x += Math.cos(t) * pas; y += Math.sin(t) * pas; d += "L" + f(x) + " " + f(y); } return d; };
    const ECL = [eclair(20, 30, .45, 9, 22), eclair(1070, 20, PI - .5, 8, 22), eclair(150, 0, 1.2, 5, 20), eclair(940, 0, PI - 1.2, 5, 20)];
    ECL.forEach(d => s.push(`<path d="${d}" fill="none" stroke="#FF2B3D" stroke-width="9" opacity=".45" filter="url(#e3-flou8)"/><path d="${d}" fill="none" stroke="#FF5A6A" stroke-width="3" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#FFE0E4" stroke-width="1.1" stroke-linejoin="round"/>`));
    const pin = (x, y, h, c) => `<path d="M${f(x)} ${f(y - h)}L${f(x + h * .2)} ${f(y - h * .62)}L${f(x + h * .12)} ${f(y - h * .62)}L${f(x + h * .32)} ${f(y - h * .28)}L${f(x + h * .2)} ${f(y - h * .28)}L${f(x + h * .42)} ${f(y)}L${f(x - h * .42)} ${f(y)}L${f(x - h * .2)} ${f(y - h * .28)}L${f(x - h * .32)} ${f(y - h * .28)}L${f(x - h * .12)} ${f(y - h * .62)}L${f(x - h * .2)} ${f(y - h * .62)}Z" fill="${c}"/>`;
    [[156, 34, 40, 13, "#3A1434"], [184, 46, 56, 18, "#1C0A22"], [236, 74, 76, 24, "#0A0510"]].forEach(([y0, h0, dh, pas, c]) => {
      for (let x = -20; x < W + 30; x += pas * (.75 + r() * .5)) s.push(pin(x, y0 + r() * 8, h0 + r() * dh, c));
      s.push(`<rect y="${y0 - 2}" width="${W}" height="${YF - y0 + 4}" fill="${c}"/>`); });
    s.push(`</g>`);

    // ---- 2. la grand-rue de Hawkins : 3 façades en grand, éclairées par en dessous (le haut retombe dans le noir)
    const MX = 371, AMP = ["#FF3B3B", "#2BD46A", "#4C9AFF", "#F7D84A", "#FF8A3D", "#FF6FA8"];
    const BAT = `<rect x="150" y="${BASE}" width="840" height="${YF - BASE + 6}"/><path d="M274 202L${MX} 136L468 202Z"/><rect x="408" y="146" width="15" height="34"/><rect x="288" y="198" width="166" height="${BASE - 198}"/><path d="M498 152L520 130H590L612 152Z"/><rect x="452" y="150" width="206" height="${BASE - 150}"/><rect x="652" y="186" width="226" height="${BASE - 186}"/>`;
    s.push(`<clipPath id="e3-bat">${BAT}</clipPath>`);
    let h = `<rect x="150" y="${BASE}" width="840" height="9" fill="#8A7A84" ${INK}/><rect x="150" y="${BASE + 9}" width="840" height="${YF - BASE}" fill="#2A2632"/><path d="M160 ${BASE + 22}H980" stroke="#E8C84A" stroke-width="1.6" stroke-dasharray="12 10"/>`;
    // 1) la maison au mur de l'alphabet (le clin d'œil passe par la guirlande : grosses ampoules)
    h += `<rect x="408" y="146" width="15" height="34" fill="#4A2A3A" ${INK}/><path d="M274 202L${MX} 136L468 202Z" fill="#4A2A3A" ${INK}/><rect x="288" y="198" width="166" height="${BASE - 198}" fill="#D8C8A0" ${INK}/>`;
    for (let q = 0; q < 4; q++) h += `<path d="M288 ${284 + q * 9}h166" stroke="#B09870" stroke-width="1" opacity=".6"/>`;
    h += `<rect x="296" y="204" width="150" height="76" fill="#F2E8CC" ${INK}/>`;
    h += `<rect x="300" y="288" width="34" height="22" fill="#C88A40" ${INK}/><rect x="408" y="288" width="34" height="22" fill="#B87A38" ${INK}/><rect x="358" y="286" width="26" height="${BASE - 286}" fill="#6A4A3A" ${INK}/>`;
    // 2) le cinéma (derrière le monstre : sa marquise sans texte fait une auréole de lumière chaude)
    h += `<path d="M498 152L520 130H590L612 152Z" fill="#4A1220" ${INK}/><rect x="458" y="158" width="194" height="${BASE - 158}" fill="#7A1E2E" ${INK}/><rect x="452" y="150" width="206" height="12" fill="#4A1220" ${INK}/>`;
    h += `<path d="M446 228H664L654 258H456Z" fill="#FFE6A8" ${INK}/><rect x="462" y="235" width="186" height="16" fill="#FFF4D8"/>`;
    for (let q = 0; q < 24; q++) h += `<circle cx="${f(450 + q * 9.1)}" cy="230.5" r="2" fill="#FFB84A"/>`; for (let q = 0; q < 22; q++) h += `<circle cx="${f(459 + q * 9)}" cy="256" r="2" fill="#FFB84A"/>`;
    h += `<rect x="470" y="268" width="34" height="${BASE - 268}" fill="#E8DCC0" ${INK}/><rect x="514" y="264" width="80" height="${BASE - 264}" fill="#FFD98A" ${INK}/><path d="M554 264V${BASE}" stroke="#140C10" stroke-width="1.6"/><rect x="606" y="268" width="36" height="${BASE - 268}" fill="#C83A4A" ${INK}/>`;
    // 3) la salle d'arcade (néon rose : le rouge de la faille reste maître)
    h += `<rect x="658" y="188" width="214" height="${BASE - 188}" fill="#26244A" ${INK}/><path d="M652 188H878" stroke="#140C10" stroke-width="6"/>`;
    h += `<rect x="670" y="198" width="190" height="40" rx="7" fill="#120E26" stroke="#E0479A" stroke-width="2.8"/><text x="765" y="228" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="26" letter-spacing="3" fill="#FF6FD8">ARCADE</text>`;
    h += `<rect x="668" y="248" width="136" height="68" fill="#1A1640" ${INK}/>`;
    [0, 1, 2, 3, 4].forEach(q => { const x = 675 + q * 25.5; h += `<path d="M${x} 314V266l4 -9h14l2 9V314Z" fill="${["#C8283A", "#2E6AE0", "#E2B93B", "#2BB673", "#9A4AE0"][q]}" ${INK}/><rect x="${x + 3}" y="267" width="14" height="11" fill="${["#7CF0FF", "#FFE07A", "#FF9AE0", "#9AFF8A", "#FFD0A0"][q]}"/>`; });
    h += `<rect x="816" y="252" width="44" height="${BASE - 252}" fill="#2A2A3A" ${INK}/><circle cx="852" cy="290" r="2" fill="#E2B93B"/>`;
    s.push(`<g clip-path="url(#e3-haut)">${h}</g>`);
    // la guirlande : 3 fils qui pendent, grosses ampoules de couleur
    const AMPS = []; [214, 238, 262].forEach((y, i) => { let d = ""; for (let k = 0; k <= 7; k++) { const u = 302 + k * 20, v = y + (k % 2 ? 7 : 0); d += (k ? "L" : "M") + u + " " + v; if (k > 0 || i !== 1) AMPS.push([u - (k ? 10 : 0), y + (k % 2 ? 7 : 0) - (k ? 3.5 : 0), AMP[(i * 2 + k) % 6]]); }
      s.push(`<path d="${d}" fill="none" stroke="#2A3A22" stroke-width="1.6"/>`); });
    AMPS.forEach(([u, v, c]) => s.push(`<rect x="${f(u - 2)}" y="${f(v - 3)}" width="4" height="3" fill="#2A2A22"/><ellipse cx="${f(u)}" cy="${f(v + 4)}" rx="4.4" ry="5.6" fill="${c}" stroke="#140C10" stroke-width=".8"/><ellipse cx="${f(u - 1.2)}" cy="${f(v + 2.6)}" rx="1.4" ry="2" fill="#FFFFFF" opacity=".7"/>`));
    // UNE lumière : façades rouges en bas, noires en haut (seulement sur les bâtiments, pas de voile rose sur la forêt)
    s.push(`<g clip-path="url(#e3-haut)"><g clip-path="url(#e3-bat)"><rect y="128" width="${W}" height="150" fill="url(#e3-nuitH)"/><rect y="200" width="${W}" height="${YF - 196}" fill="url(#e3-lumH)" style="mix-blend-mode:screen"/></g></g>`);
    AMPS.forEach(([u, v, c]) => K.halo(u, v + 4, 13, c, .5));
    K.halo(765, 218, 90, "#FF4FA8", .22);

    // ---- 3. le monde à l'envers : un vrai lieu. Ciel de cendre gris-bleu, éclairé en rouge par la faille au-dessus,
    //      sol organique noir, grosses lianes qui grimpent vers la faille, spores qui montent
    s.push(`<g clip-path="url(#e3-bas)"><rect y="${YF - 10}" width="${W}" height="${H - YF + 10}" fill="url(#e3-cendre)"/>`);
    for (let k = 0; k < 6; k++) { const x = r() * W, y = YF + 60 + r() * 200; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(120 + r() * 120)}" ry="${f(16 + r() * 14)}" fill="#8A90B0" opacity=".1" filter="url(#e3-flou8)"/>`); }
    // le sol : deux masses organiques (loin, puis près)
    const sol = (y0, amp, c) => { let d = `M-20 ${H + 20}L-20 ${y0}`; for (let x = -20; x <= W + 40; x += 40) d += `Q${f(x + 20)} ${f(y0 - amp * r())} ${f(x + 40)} ${f(y0 + (x < 260 || x > 760 ? -40 : 30) + (r() - .5) * 20)}`; return `<path d="${d}L${W + 40} ${H + 20}Z" fill="${c}"/>`; };
    s.push(sol(640, 50, "#2A2238"), sol(675, 40, "#120C18"));
    // les lianes : tronc sombre, liseré rouge sur le dessus (la lumière vient d'en haut)
    const liane = (x0, y0, x1, w) => { const y1 = by(x1) + 4, c = [(x0 + x1) / 2 + (r() - .5) * 140, (y0 + y1) / 2], d = membre([x0, y0], c, [x1, y1], [[0, w], [.6, w * .6], [1, w * .25]]);
      return `<path d="${d}" fill="#0E0810" stroke="#FF5A6A" stroke-width="1.6" stroke-opacity=".5"/>`; };
    [[-10, 600, 40, 30], [70, 730, 170, 26], [230, 740, 280, 18], [860, 740, 820, 20], [1010, 730, 940, 30], [1100, 540, 1050, 26]].forEach(([x0, y0, x1, w]) => s.push(liane(x0, y0, x1, w)));
    // la forêt morte du monde d'en bas : 4 grands arbres nus, noirs, liserés de rouge par en haut
    const arbreMort = (x, y, hh, pen) => { let o = ""; const br = (x0, y0, t, l, w, n) => { const x1 = x0 + Math.cos(t) * l, y1 = y0 + Math.sin(t) * l, c = [(x0 + x1) / 2 + Math.sin(t) * l * .15, (y0 + y1) / 2 - Math.cos(t) * l * .15];
        o += `<path d="${membre([x0, y0], c, [x1, y1], [[0, w], [1, w * (n ? .5 : .15)]])}" fill="#0C0810" stroke="#FF5A6A" stroke-width="1.4" stroke-opacity=".55"/>`; if (n) { br(x1, y1, t - .55 - r() * .3, l * .6, w * .55, n - 1); br(x1, y1, t + .5 + r() * .3, l * .65, w * .55, n - 1); } };
      br(x, y, -PI / 2 + pen, hh * .55, hh * .17, 2); return o; };
    s.push(arbreMort(40, 735, 330, .12), arbreMort(150, 745, 220, -.1), arbreMort(930, 745, 250, .12), arbreMort(1050, 735, 340, -.14));
    // la base du monstre : vrilles de fumée noire qui pendent de la faille et plongent dans le monde d'en bas
    [[-50, 70, 18], [-24, 100, 24], [0, 84, 28], [26, 104, 24], [52, 68, 18], [-80, 48, 12], [82, 52, 12]].forEach(([u, l, w]) => { const x = DX + u, y = by(x) - 4, d = membre([x, y], [x + u * .5 + (r() - .5) * 40, y + l * .55], [x + u * .3 + (r() - .5) * 16, y + l], [[0, w], [.5, w * .6], [1, 1.5]]);
      s.push(`<path d="${d}" fill="#FF2B3D" opacity=".4" filter="url(#e3-flou)"/><path d="${d}" fill="#1A0E14" stroke="#FF7A86" stroke-width="1.4" stroke-opacity=".6"/>`); });
    for (let k = 0; k < 70; k++) { const x = r() * W, y = YF + 20 + r() * (H - YF - 20); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 2.2)}" fill="#F0E0E8" opacity="${f2(.25 + r() * .45)}"/>`); }
    s.push(`<rect y="${YF - 4}" width="${W}" height="260" fill="url(#e3-lumB)" style="mix-blend-mode:screen"/>`);
    // R U N : en grand, rouge vif, dans l'espace dégagé sous le monstre
    const RUNY = 590, RUNX = [DX - 122, DX, DX + 122];
    "RUN".split("").forEach((L, q) => s.push(`<text x="${RUNX[q]}" y="${RUNY}" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="100" fill="#FF2B3D" stroke="#FF2B3D" stroke-width="14" opacity=".55" filter="url(#e3-flou8)">${L}</text>`));
    "RUN".split("").forEach((L, q) => s.push(`<text x="${RUNX[q]}" y="${RUNY}" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="100" fill="#FF1F3A" stroke="#2A0208" stroke-width="3">${L}</text><text x="${RUNX[q]}" y="${RUNY}" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="100" fill="none" stroke="#FFC8CE" stroke-width="1.4" opacity=".8">${L}</text>`));
    s.push(`</g>`);
    s.push(`<rect width="${W}" height="${H}" fill="url(#e3-bords)"/>`);

    // ---- 4. la piste : route d'été bordée de clair à Hawkins, route rouge vif bordée de rose dans le monde à l'envers ; chevrons du sens de course
    K.route([["#000", 42, ` opacity=".5" filter="url(#e3-flou)"`]]);
    s.push(`<g clip-path="url(#e3-haut)"><path d="${K.piste}" fill="none" stroke="#E8DCC4" stroke-width="33" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#3A3A44" stroke-width="27" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#E8C84A" stroke-width="1.5" stroke-dasharray="10 9"/></g>`);
    s.push(`<g clip-path="url(#e3-bas)"><path d="${K.piste}" fill="none" stroke="#FF2B3D" stroke-width="66" stroke-linejoin="round" opacity=".5" filter="url(#e3-flou8)"/><path d="${K.piste}" fill="none" stroke="#FF9AAA" stroke-width="37" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#1E1222" stroke-width="28" stroke-linejoin="round"/></g>`);
    for (let i = 8; i < K.N; i += 23) { const [, , tx, ty] = K.nrm(i), [x, y] = K.P[i]; if (Math.abs(y - by(x)) < 30) continue; const bas = envers(x, y);
      s.push(`<path d="M-4 -6L3 0L-4 6" fill="none" stroke="${bas ? "#FF9AAA" : "#F4E6B0"}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="${bas ? .95 : .7}" transform="translate(${f(x)} ${f(y)}) rotate(${f(Math.atan2(ty, tx) * 57.3)})"/>`); }
    K.depart();

    // ---- 5. LA FAILLE : déchirure rouge lumineuse d'un bord à l'autre ; s'ouvre en grand sous le monstre et en portail là où la piste bascule
    s.push(`<rect y="${YF - 50}" width="${W}" height="100" fill="url(#e3-lueur)"/>`);
    const bord = (sg, ep) => BY.map((p, k) => f(p[0]) + " " + f(p[1] + sg * (ep(p[0]) + (k % 2 ? 1.5 : -1) * (r() * 2.5)))).join("L");
    const ouv = x => 3 + 28 * Math.exp(-Math.pow((x - X) / 90, 2)) + FAILLES.reduce((t, F) => t + 22 * Math.exp(-Math.pow((x - F.x) / 34, 2)), 0);
    const haut = bord(-1, ouv), bas = bord(1, ouv);
    [[X, YF, 200], ...FAILLES.map(F => [F.x, F.y, 150])].forEach(([x, y, R]) => s.push(`<circle cx="${f(x)}" cy="${f(by(x))}" r="${R}" fill="url(#e3-rouge)" opacity=".8"/>`));
    s.push(`<path d="M${haut}L${bas.split("L").reverse().join("L")}Z" fill="#5A0A16" stroke="#2A0208" stroke-width="4" stroke-linejoin="round" filter="url(#e3-flou)" opacity=".9"/>`);
    s.push(`<path d="M${haut}L${bas.split("L").reverse().join("L")}Z" fill="#E0182E" stroke="#3A0410" stroke-width="3" stroke-linejoin="round"/>`);
    const ouv2 = x => ouv(x) * .5, haut2 = bord(-1, ouv2), bas2 = bord(1, ouv2);
    s.push(`<path d="M${haut2}L${bas2.split("L").reverse().join("L")}Z" fill="#FF8A96"/>`);
    s.push(`<path d="M${cou}" fill="none" stroke="#FFF4F6" stroke-width="2.6" stroke-linejoin="round"/>`);
    // les 2 portails de bascule : un éclair vertical qui traverse la piste + gerbe d'étincelles
    const PORT = FAILLES.map(F => { const x = F.x, y = by(x); let d = `M${f(x - 6)} ${f(y - 74)}`; for (let j = 1; j <= 6; j++) d += `L${f(x + (j % 2 ? 12 : -12) * (1 - j / 8))} ${f(y - 74 + j * 24.6)}`; return [x, y, d]; });
    PORT.forEach(([x, y, d]) => s.push(`<path d="${d}" fill="none" stroke="#FF2B3D" stroke-width="12" opacity=".6" filter="url(#e3-flou8)"/><path d="${d}" fill="none" stroke="#FF6A78" stroke-width="4.5" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${f(x)}" cy="${f(y)}" r="9" fill="#FFFFFF"/>`));
    FAILLES.forEach(F => K.prendre(F.x, F.y, 40));
    const etinc = (x, y) => [...Array(12)].map((_, j) => { const t = j / 12 * TAU + .2, l1 = 16 + (j % 3) * 6, l2 = l1 + 12 + (j % 2) * 10; return `<path d="M${f(x + Math.cos(t) * l1)} ${f(y + Math.sin(t) * l1 * .8)}L${f(x + Math.cos(t) * l2)} ${f(y + Math.sin(t) * l2 * .8)}" stroke="${j % 2 ? "#FFE0E4" : "#FF5A6A"}" stroke-width="2.4" stroke-linecap="round"/>`; }).join("");
    PORT.forEach(([x, y, d], q) => { a.push(`<g opacity="${K.anime ? .9 : 1}">${an(`<animate attributeName="opacity" values="1;.2;.9;0;1" keyTimes="0;.15;.3;.6;1" dur="${q ? 1.3 : 1.7}s" repeatCount="indefinite"/>`)}${etinc(x, y)}</g>`);
      a.push(`<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="${o0}">${an(`<animate attributeName="opacity" values="0;0;1;.3;1;0;0" keyTimes="0;.5;.53;.57;.6;.66;1" dur="${q ? 2.3 : 3.1}s" repeatCount="indefinite"/>`)}</path>`); });

    // ---- 6. LE HÉROS : le Démogorgon jaillit de la faille, en contre-jour rouge ; ses mains à 5 griffes s'enfoncent dans la grand-rue
    K.halo(DX, YT - 130, 270, "#FF2B3D", .6); K.halo(DX, HY, 130, "#FF8A96", .35);
    const tronc = `M-46 4Q-50 -34 -60 -64Q-80 -96 -70 -114Q-38 -132 0 -130Q38 -132 70 -114Q80 -96 60 -64Q50 -34 46 4Z`, cou2 = `M-20 -120Q-16 -146 -14 -${f(YT - HY - 18)}H14Q16 -146 20 -120Z`;
    const BRAS = [membre([-58, -110], [-196, -168], [-150, -62], [[0, 36], [.28, 34], [.5, 21], [.68, 25], [1, 17]]), membre([58, -110], [184, -172], [140, -62], [[0, 36], [.28, 34], [.5, 21], [.68, 25], [1, 17]])];
    const MAINS = [[-150, -64, -1], [140, -64, 1]], MS = 1.35;
    // doigts : de la paume vers la chaussée, écartés en éventail ; la griffe (os clair) s'enfonce dans le bitume
    const doigts = (sg) => [[-34, 2, -26, 22], [-20, 12, -14, 34], [-4, 16, 2, 40], [12, 12, 18, 36], [26, 2, 34, 22]].map(([cx, cy, tx, ty]) => [`M0 0Q${f(cx * sg)} ${cy - 14} ${f(tx * sg)} ${ty}`, tx * sg, ty]);
    const cou3 = G(DX, YT, 1);
    // passe 1 : la lueur rouge derrière toute la silhouette
    s.push(`${cou3}<g opacity=".7" filter="url(#e3-flou8)"><path d="${tronc}" fill="#FF2B3D" stroke="#FF2B3D" stroke-width="18"/><path d="${cou2}" fill="#FF2B3D" stroke="#FF2B3D" stroke-width="16"/>${BRAS.map(d => `<path d="${d}" fill="#FF2B3D" stroke="#FF2B3D" stroke-width="18"/>`).join("")}</g></g>`);
    // passe 2 : le liseré de contre-jour (rose vif tout autour)
    const rim = `${BRAS.map(d => `<path d="${d}" fill="#FF7A86" stroke="#FF7A86" stroke-width="4.5" stroke-linejoin="round"/>`).join("")}<path d="${tronc}" fill="#FF7A86" stroke="#FF7A86" stroke-width="4.5"/><path d="${cou2}" fill="#FF7A86" stroke="#FF7A86" stroke-width="4.5"/>`;
    const mainRim = MAINS.map(([x, y, sg]) => `${G(x, y, MS)}<ellipse rx="22" ry="15" fill="#FF7A86" stroke="#FF7A86" stroke-width="4.5"/>${doigts(sg).map(([d]) => `<path d="${d}" fill="none" stroke="#FF7A86" stroke-width="13.5" stroke-linecap="round"/>`).join("")}</g>`).join("");
    s.push(`${cou3}${rim}${mainRim}`);
    // passe 3 : le corps sombre (détaché du fond par le liseré), muscles soulignés de rouge par en dessous
    s.push(`${BRAS.map(d => `<path d="${d}" fill="#24161C"/>`).join("")}<path d="${tronc}" fill="url(#e3-peau)"/><path d="${cou2}" fill="#24161C"/>`);
    // reflets rouges sous les biceps et les avant-bras (la lumière monte de la faille)
    [-1, 1].forEach(sg => s.push(`<path d="M${sg * 70} -96Q${sg * 120} -112 ${sg * 150} -104M${sg * 160} -96Q${sg * 162} -66 ${sg * 150} -48" stroke="#C8384A" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".75"/>`));
    s.push(`<path d="M0 -118V-6M-42 -92q20 12 38 4M42 -92q-20 12 -38 4M-38 -66q18 9 34 3M38 -66q-18 9 -34 3M-30 -42q14 7 26 2M30 -42q-14 7 -26 2M-26 -20q12 6 22 1M26 -20q-12 6 -22 1" stroke="#9A2A3A" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/>`);
    MAINS.forEach(([x, y, sg]) => s.push(`${G(x, y, MS)}<ellipse rx="22" ry="15" fill="#2A1A20"/>${doigts(sg).map(([d, tx, ty]) => `<path d="${d}" fill="none" stroke="#2A1A20" stroke-width="9" stroke-linecap="round"/><path d="M${f(tx)} ${ty - 2}l${f(-3 + (tx > 0 ? 1 : 0))} 10l6 -9z" fill="#F4EAD8" stroke="#140C10" stroke-width="1"/>`).join("")}<path d="M${-14 * sg} -6q${12 * sg} -8 ${26 * sg} -2" stroke="#B83444" stroke-width="2.4" fill="none" opacity=".7"/></g>`));
    s.push(`</g>`);
    // la chaussée se fend sous les griffes (fissures rouges qui rougeoient)
    MAINS.forEach(([x, y, sg]) => doigts(sg).forEach(([, tx, ty], q) => { if (q % 2) return; const x0 = DX + x + tx * MS, y0 = YT + y + ty * MS + 6, d = `M${f(x0)} ${f(y0)}l${f(sg * (8 + q * 3))} 5l${f(sg * 6)} -4l${f(sg * 10)} 6`;
      s.push(`<path d="${d}" fill="none" stroke="#FF2B3D" stroke-width="5" opacity=".6" filter="url(#e3-flou)"/><path d="${d}" fill="none" stroke="#FF8A96" stroke-width="1.6"/>`); }));
    // la taille sort de la faille : lèvre lumineuse devant, vrilles de fumée
    const lip = BY.filter(p => Math.abs(p[0] - DX) < 80).map(p => f(p[0]) + " " + f(p[1] + 2)).join("L");
    [[-56, -30], [-30, -46], [34, -40], [58, -26], [-8, -24]].forEach(([u, l]) => { const x = DX + u, y = by(x), d = `M${f(x - 14)} ${f(y)}Q${f(x + u * .3)} ${f(y + l * .7)} ${f(x + u * .15 + 6)} ${f(y + l)}`;
      s.push(`<path d="${d}" fill="none" stroke="#FF7A86" stroke-width="14" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#1A0E14" stroke-width="9" stroke-linecap="round"/>`); });
    s.push(`<path d="M${lip}" fill="none" stroke="#FF2B3D" stroke-width="14" opacity=".75" filter="url(#e3-flou)"/><path d="M${lip}" fill="none" stroke="#FF8A96" stroke-width="6" stroke-linecap="round"/><path d="M${lip}" fill="none" stroke="#FFF4F6" stroke-width="2.4" stroke-linecap="round"/>`);
    // la tête-fleur : pétales sombres liserés de rouge, gueule rouge, dents claires (respire en animé)
    const petales = n => [...Array(n)].map((_, q) => { const t = q / n * 360 - 90; return `<g transform="rotate(${f(t)})"><path d="M4 -5Q22 -19 36 0Q22 19 4 5Z" fill="#3A242C" stroke="#FF7A86" stroke-width="1.5"/><path d="M7 -3.4Q20 -11.5 31 0Q20 11.5 7 3.4Z" fill="#E0283A"/>${[11, 16, 21, 26].map(u => `<path d="M${u} -${f(6.4 - u * .13)}l1.7 2.8l1.7 -2.8M${u} ${f(6.4 - u * .13)}l1.7 -2.8l1.7 2.8" fill="#FFF4E4"/>`).join("")}</g>`; }).join("");
    s.push(`${G(DX, HY, HS)}<circle r="13" fill="#2A0508" stroke="#FF7A86" stroke-width="1.2"/></g>`);
    a.push(`${G(DX, HY, HS)}<g>${an(`<animateTransform attributeName="transform" type="scale" values="1;1.08;1;.88;1" keyTimes="0;.3;.55;.8;1" dur="4.5s" repeatCount="indefinite"/>`)}${petales(5)}<circle r="8" fill="#2A0508"/><circle r="4.5" fill="#FF3B4E" opacity=".85"/></g></g>`);

    // ---- 7. les 4 copains à vélo, aux couleurs des pilotes, en file sur la chaussée : ils filent dans le sens de la course,
    //      phares en faisceaux (l'appli pose les vrais portraits des pilotes sur leurs têtes)
    const PORTR = [], SK = 1.15, PEAU = ["#F2CDB0", "#D9A27A", "#F5D4BC", "#C98E66"], CHEV = ["#3A2416", "#C89A4A", "#1A1410", "#7A3A1A"];
    const gamin = (c, k) => `<ellipse cx="0" cy="1" rx="30" ry="4" fill="#000" opacity=".5"/>
      <circle cx="-17" cy="-12" r="11.5" fill="none" stroke="#140C10" stroke-width="4"/><circle cx="17" cy="-12" r="11.5" fill="none" stroke="#140C10" stroke-width="4"/><circle cx="-17" cy="-12" r="11.5" fill="none" stroke="#FF8A96" stroke-width="1.2" opacity=".7"/><circle cx="17" cy="-12" r="11.5" fill="none" stroke="#FF8A96" stroke-width="1.2" opacity=".7"/>
      <path d="M-17 -12L-5 -30H13L17 -12M-5 -30L0 -12L13 -30M13 -30L11 -39h8M-9 -33h9" stroke="${c}" stroke-width="3.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="-36" r="3.4" fill="#FFF6C8" stroke="#140C10"/>
      <path d="M-3 -36L1 -22L-1 -12" stroke="#2A3A5A" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M-10 -36L-5 -60H8L11 -38Z" fill="${c}" ${INK}/><path d="M5 -56L17 -40" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="3" cy="-74" r="13" fill="${PEAU[k]}" ${INK}/><path d="M-10 -75Q-10 -90 3 -89Q16 -88 16 -75Q8 -82 -10 -75Z" fill="${CHEV[k]}" ${INK}/><circle cx="7" cy="-74" r="1.5" fill="#140C10"/><circle cx="12" cy="-74" r="1.5" fill="#140C10"/><path d="M6 -68q3 2 6 0" stroke="#140C10" stroke-width="1.2" fill="none"/>`;
    const KIDS = [0, 1, 2, 3].map(k => [722 + k * 68, 354 - 7 * Math.sin(PI * k / 3)]);
    KIDS.forEach(([x0, y0], k) => { a.push(`${G(x0, y0, SK)}<path d="M21 -36L122 -70L122 0Z" fill="url(#e3-phA)" opacity="${K.anime ? .8 : .85}">${an(`<animate attributeName="opacity" values=".85;.55;.9;.85" keyTimes="0;.4;.7;1" dur="${(1.8 + k * .3).toFixed(1)}s" repeatCount="indefinite"/>`)}</path></g>`);
      s.push(`${G(x0, y0, SK)}${gamin(COULEURS_J[k], k)}</g>`); PORTR.push({ k, x: Math.round(x0 + 3 * SK), y: Math.round(y0 - 74 * SK), r: 14 }); });

    // ---- 8. ce qui vit : marquise et guirlande qui clignotent, ARCADE qui grésille, R U N qui s'allume, spores qui montent vers la faille
    for (let q = 0; q < 3; q++) a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;.9;.9;0;0" keyTimes="0;.1;.4;.5;1" dur="2.4s" begin="${(q * .8).toFixed(1)}s" repeatCount="indefinite"/>`)}${AMPS.filter((p, j) => j % 3 === q && p[0] < 372).map(([u, v, c]) => `<circle cx="${f(u)}" cy="${f(v + 4)}" r="9" fill="${c}" opacity=".45"/><circle cx="${f(u)}" cy="${f(v + 4)}" r="2.6" fill="#FFFFFF"/>`).join("")}</g>`);
    a.push(`<text x="765" y="228" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="26" letter-spacing="3" fill="#FFE0F6" opacity="${K.anime ? 0 : .35}">ARCADE${an(`<animate attributeName="opacity" values="0;0;.8;.2;.8;0;0" keyTimes="0;.6;.62;.65;.68;.72;1" dur="4.5s" repeatCount="indefinite"/>`)}</text>`);
    "RUN".split("").forEach((L, q) => { const t0 = .1 + q * .12;
      a.push(`<text x="${RUNX[q]}" y="${RUNY}" text-anchor="middle" font-family="'Arial Black', Impact, sans-serif" font-size="100" fill="none" stroke="#FFE8EC" stroke-width="2.6" opacity="${K.anime ? 0 : .6}">${L}${an(`<animate attributeName="opacity" values="0;0;.9;.2;.9;.9;0;0" keyTimes="0;${f2(t0)};${f2(t0 + .02)};${f2(t0 + .04)};${f2(t0 + .06)};${f2(t0 + .5)};${f2(t0 + .54)};1" dur="6s" repeatCount="indefinite"/>`)}</text>`); });
    for (let g = 0; g < 6; g++) { let hs = ""; for (let k = 0; k < 11; k++) { const x = r() * W, y = YF + 30 + r() * (H - YF - 30); hs += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + r() * 2.2)}" fill="url(#e3-spA)" opacity="${f2(.5 + r() * .5)}"/>`; }
      a.push(`<g clip-path="url(#e3-basA)"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 30)} -40;${f((r() - .5) * 20)} -70;0 0" keyTimes="0;.45;.9;1" dur="${(10 + g * 1.7).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.85;.95;1" dur="${(10 + g * 1.7).toFixed(1)}s" repeatCount="indefinite"/>`)}${hs}</g></g>`); }
    // la faille palpite
    a.push(`<path d="M${cou}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".8">${an(`<animate attributeName="opacity" values=".9;.25;1;.45;.9" keyTimes="0;.2;.45;.7;1" dur="1.6s" repeatCount="indefinite"/>`)}</path>`);
    [[X, 200, 2.6], ...FAILLES.map(F => [F.x, 110, 1.9])].forEach(([x, R, d]) => a.push(`<ellipse cx="${f(x)}" cy="${f(by(x))}" rx="${f(R * .6)}" ry="${f(R * .3)}" fill="url(#e3-fA)" opacity=".6">${an(`<animate attributeName="rx" values="${f(R * .45)};${f(R * .75)};${f(R * .45)}" dur="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".45;.95;.45" dur="${d}s" repeatCount="indefinite"/>`)}</ellipse>`));

    // ---- 9. les 4 pilotes sur la piste (plus gros, contour blanc épais pour rester lisibles)
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.02 + k * .03, `<g><rect x="-14" y="-8.5" width="28" height="17" rx="4.5" fill="${c}" stroke="#FFFFFF" stroke-width="2.6"/><rect x="2" y="-5.5" width="7.5" height="11" rx="1.6" fill="#BFE0FF"/><circle cx="15" cy="0" r="2.4" fill="#FFF6C8"/></g>`, 44, k * 1.3)));
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#1A1A2A"/>`, "#1A0A28", .06); RES.portraits = PORTR; RES.failles = FAILLES.map(F => ({ fr: F.fr, vers: F.vers }));
    RES.lieux = { faille: [DX, Math.round(YT)], demo: [DX, Math.round(HY)], ombre: [DX, Math.round(YT - 60)], cinema: [555, 246], alphabet: [MX, 240], run: [DX, RUNY - 36] }; return RES;
  }
  /* ---------- Avril · Le Voyage (Terre du Milieu façon carte ancienne : de la Comté à la Montagne du Destin) ---------- */
  function peindreAnneau4(T, Z, def) {
    // Avril · Terre du Milieu, « le voyage en perspective » : UNE scène qui s'enfonce de la Comté (près, en bas, dorée) jusqu'au Mordor (loin, en haut, rouge).
    // Héros : la Montagne du Destin et la tour de l'Œil, géantes au fond ; la route y monte en s'amincissant et en passant du doré à la cendre.
    const K = kit(T, def, 44, "a4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", CJ = COULEURS_J, INK = `stroke="#1E120C" stroke-width="1.2"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const titre = (x, y, txt, t, c, cont, esp) => s.push(`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="${t}" letter-spacing="${f(t * (esp || .2))}" fill="${c}" stroke="${cont}" stroke-width="${f(t * .2)}" paint-order="stroke" stroke-linejoin="round">${txt}</text>`);
    // ---- dégradés (couche fixe)
    s.push(`<linearGradient id="a4-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140304"/><stop offset=".07" stop-color="#3E0805"/><stop offset=".17" stop-color="#8A1E0C"/><stop offset=".27" stop-color="#CC4E1C"/><stop offset=".36" stop-color="#EE8A3E"/><stop offset=".45" stop-color="#F0B460"/><stop offset=".55" stop-color="#DCB65A"/><stop offset=".66" stop-color="#B4B04C"/><stop offset=".78" stop-color="#7EA840"/><stop offset="1" stop-color="#3C7428"/></linearGradient>`);
    s.push(`<radialGradient id="a4-lave" r="50%"><stop offset="0" stop-color="#FFF4A8"/><stop offset=".3" stop-color="#FF9A2A"/><stop offset=".7" stop-color="#C8321A"/><stop offset="1" stop-color="#5A0A06" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="a4-oeil" r="50%"><stop offset="0" stop-color="#FFFBD0"/><stop offset=".28" stop-color="#FFC03A"/><stop offset=".7" stop-color="#E8400E"/><stop offset="1" stop-color="#6A0A04"/></radialGradient>`);
    s.push(`<linearGradient id="a4-doom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A2014"/><stop offset=".25" stop-color="#3A1610"/><stop offset=".7" stop-color="#22100E"/><stop offset="1" stop-color="#2E1612"/></linearGradient>`);
    s.push(`<linearGradient id="a4-tour" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A2A26"/><stop offset=".3" stop-color="#22141A"/><stop offset="1" stop-color="#07040A"/></linearGradient>`);
    s.push(`<linearGradient id="a4-crete" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A1416"/><stop offset=".6" stop-color="#5A2A24"/><stop offset="1" stop-color="#B8603A" stop-opacity="0"/></linearGradient>`);
    s.push(`<linearGradient id="a4-brumeux" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A6A74"/><stop offset=".6" stop-color="#C08A72"/><stop offset="1" stop-color="#E8B068" stop-opacity="0"/></linearGradient>`);
    s.push(`<linearGradient id="a4-colline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8D85A"/><stop offset=".45" stop-color="#78B23E"/><stop offset="1" stop-color="#3E7A26"/></linearGradient>`);
    s.push(`<linearGradient id="a4-pres" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8AB83E"/><stop offset=".5" stop-color="#4E8A2C"/><stop offset="1" stop-color="#2A5A1C"/></linearGradient>`);
    s.push(`<linearGradient id="a4-blanc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFBF0"/><stop offset=".6" stop-color="#EADCCC"/><stop offset="1" stop-color="#B49A92"/></linearGradient>`);
    s.push(`<linearGradient id="a4-cape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C8BCB4"/><stop offset=".35" stop-color="#8E8A90"/><stop offset="1" stop-color="#4A4652"/></linearGradient>`);
    s.push(`<linearGradient id="a4-lum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2A0A" stop-opacity=".22"/><stop offset=".35" stop-color="#FF7A2A" stop-opacity="0"/><stop offset=".75" stop-color="#FFD070" stop-opacity="0"/><stop offset="1" stop-color="#FFC24A" stop-opacity=".16"/></linearGradient>`);
    s.push(`<linearGradient id="a4-brume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC878" stop-opacity="0"/><stop offset=".5" stop-color="#FFC878" stop-opacity=".55"/><stop offset="1" stop-color="#FFC878" stop-opacity="0"/></linearGradient>`);
    s.push(`<linearGradient id="a4-brumeR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A3A" stop-opacity="0"/><stop offset=".5" stop-color="#FF8A44" stop-opacity=".5"/><stop offset="1" stop-color="#FFB060" stop-opacity="0"/></linearGradient>`);
    s.push(`<filter id="a4-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .12  0 0 0 0 .05  0 0 0 .3 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
    // ---- dégradés de la couche animée (« an-lave » sert aussi à l'événement de course)
    a.unshift(`<radialGradient id="an-lave" r="50%"><stop offset="0" stop-color="#FFF4A8"/><stop offset=".3" stop-color="#FF9A2A"/><stop offset=".7" stop-color="#C8321A"/><stop offset="1" stop-color="#5A0A06" stop-opacity="0"/></radialGradient>`);
    a.unshift(`<radialGradient id="a4-feu" r="50%"><stop offset="0" stop-color="#FFF6C0"/><stop offset=".35" stop-color="#FFB030"/><stop offset=".75" stop-color="#FF5A1A" stop-opacity=".6"/><stop offset="1" stop-color="#FF3A0A" stop-opacity="0"/></radialGradient>`);

    // ================= 1. LE FOND : ciel rouge, la Montagne du Destin et la tour de l'Œil (le héros) =================
    const dX = 430, dY = 54, tX = 862, oeilX = tX, oeilY = 50;
    K.halo(dX + 40, 150, 520, "#FF7A2A", .55);   // la lueur unique du Mordor, derrière tout
    // nuages de cendre éclairés par en dessous
    for (let k = 0; k < 7; k++) { const x = r() * W, y = 14 + r() * 80, rx = 160 + r() * 160; s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(14 + r() * 14)}" fill="#24060A" opacity=".55" filter="url(#a4-flou8)"/><path d="M${f(x - rx * .7)} ${f(y + 12)}Q${f(x)} ${f(y + 22)} ${f(x + rx * .7)} ${f(y + 12)}" stroke="#FF6A2A" stroke-width="3" fill="none" opacity=".35" filter="url(#a4-flou)"/>`); }
    // le panache de l'éruption, qui file vers la tour
    { let o = ""; for (let k = 0; k < 12; k++) { const t = k / 11, x = dX + 6 + t * 250 + Math.sin(k * 1.7) * 8, y = dY - 16 - Math.sin(t * PI * .7) * 26 + t * 4, R = 15 + t * 24 + (k % 3) * 4; o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${k % 2 ? "#6A2618" : "#56201A"}"/><path d="M${f(x - R * .7)} ${f(y + R * .7)}A${f(R)} ${f(R)} 0 0 0 ${f(x + R * .7)} ${f(y + R * .7)}" stroke="#FF7A30" stroke-width="5" fill="none" opacity=".5"/>`; } s.push(`<g opacity=".75" filter="url(#a4-flou)">${o}</g>`); }
    // la Montagne du Destin : un cône immense, contre-jour rouge sur les arêtes
    const DOOM = `M-20 330C120 300 300 200 ${dX - 34} ${dY + 8}L${dX - 22} ${dY - 2}Q${dX} ${dY + 6} ${dX + 24} ${dY - 3}L${dX + 36} ${dY + 6}C${dX + 70} ${dY + 120} ${dX + 150} ${dY + 150} ${dX + 210} ${dY + 170}C${dX + 260} ${dY + 186} ${dX + 330} ${dY + 230} ${dX + 420} 320Z`;
    s.push(`<path d="${DOOM}" fill="url(#a4-doom)" stroke="#120606" stroke-width="1.5"/>`);
    s.push(`<path d="M${dX - 34} ${dY + 8}C300 200 120 300 -20 330" fill="none" stroke="#FF6A2A" stroke-width="3" opacity=".75"/><path d="M${dX + 36} ${dY + 6}C${dX + 70} ${dY + 120} ${dX + 150} ${dY + 150} ${dX + 210} ${dY + 170}" fill="none" stroke="#FF8A3A" stroke-width="2.4" opacity=".6"/>`);
    // ravines sombres + face éclairée par la lave
    [[-14, 40, -120, 230], [6, 44, 30, 250], [22, 40, 150, 240], [-30, 30, -210, 260]].forEach(([u, v, du, dv]) => s.push(`<path d="M${dX + u} ${dY + v}Q${dX + u + du * .3} ${dY + v + dv * .5} ${dX + u + du} ${dY + v + dv}" stroke="#120606" stroke-width="5" fill="none" opacity=".45"/>`));
    K.halo(dX, dY + 4, 70, "#FFB040", .9);
    s.push(`<ellipse cx="${dX + 1}" cy="${dY + 1}" rx="23" ry="6" fill="url(#a4-lave)" stroke="#5A0A04"/>`);
    const COULEES = [`M${dX - 8} ${dY + 6}Q${dX - 20} ${dY + 50} ${dX - 52} ${dY + 90}T${dX - 120} ${dY + 200}`, `M${dX + 10} ${dY + 6}Q${dX + 24} ${dY + 60} ${dX + 60} ${dY + 110}T${dX + 110} ${dY + 210}`, `M${dX - 52} ${dY + 90}Q${dX - 30} ${dY + 130} ${dX - 40} ${dY + 190}`];
    COULEES.forEach((d, k) => s.push(`<path d="${d}" fill="none" stroke="#A8200E" stroke-width="${9 - k * 2}" stroke-linecap="round" opacity=".9"/><path d="${d}" fill="none" stroke="#FF8A2A" stroke-width="${4 - k}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FFE08A" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`));
    // Barad-dûr : la tour noire, très haute et hérissée, l'Œil entre ses deux cornes
    { const B = 300, sp = (x, y, sg, l) => `<path d="M${f(x)} ${f(y)}l${f(sg * l)} ${f(-l * 1.3)}l${f(-sg * l * .45)} ${f(l * 1.2)}Z" fill="#0C060A" stroke="#FF5A2A" stroke-width=".7" stroke-opacity=".6"/>`;
      let o = `<path d="M${tX - 70} ${B}L${tX - 52} 230L${tX - 40} 228L${tX - 34} 170L${tX - 26} 168L${tX - 22} 112L${tX - 17} 96H${tX + 17}L${tX + 22} 112L${tX + 26} 168L${tX + 34} 170L${tX + 40} 228L${tX + 52} 230L${tX + 70} ${B}Z" fill="url(#a4-tour)" stroke="#0A0406" stroke-width="1.4"/>`;
      o += `<path d="M${tX - 70} ${B}L${tX - 52} 230L${tX - 40} 228L${tX - 34} 170L${tX - 26} 168L${tX - 22} 112L${tX - 17} 96" fill="none" stroke="#FF6A2A" stroke-width="2.2" opacity=".8"/>`;
      o += [[228, 52], [168, 34], [112, 22]].map(([y, w]) => `<path d="M${tX - w} ${y}h${w * 2}" stroke="#3A2228" stroke-width="2"/>`).join("");
      o += sp(tX - 52, 232, -1, 22) + sp(tX + 52, 232, 1, 22) + sp(tX - 34, 172, -1, 18) + sp(tX + 34, 172, 1, 18) + sp(tX - 22, 114, -1, 14) + sp(tX + 22, 114, 1, 14) + sp(tX - 66, 290, -1, 16) + sp(tX + 66, 290, 1, 16);
      o += `<path d="M${tX - 17} 96C${tX - 30} 80 ${tX - 40} 60 ${tX - 46} 22C${tX - 34} 44 ${tX - 22} 66 ${tX - 6} 86ZM${tX + 17} 96C${tX + 30} 80 ${tX + 40} 60 ${tX + 46} 22C${tX + 34} 44 ${tX + 22} 66 ${tX + 6} 86Z" fill="#0C060A" stroke="#FF6A2A" stroke-width="1" stroke-opacity=".7"/>`;
      o += [200, 150, 132].map((y, k) => `<rect x="${tX - 3 + (k - 1) * 6}" y="${y}" width="4" height="6" fill="#FF7A2A" opacity=".85"/>`).join("");
      s.push(o);
      K.halo(oeilX, oeilY, 120, "#FF5A1A", .9);
      s.push(`<ellipse cx="${oeilX}" cy="${oeilY}" rx="42" ry="17" fill="url(#a4-oeil)" stroke="#5A0A04" stroke-width="1.4"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(q => { const t = q / 10 * TAU; return `<path d="M${f(oeilX + Math.cos(t) * 40)} ${f(oeilY + Math.sin(t) * 15)}q${f(Math.cos(t) * 10)} ${f(Math.sin(t) * 8 - 6)} ${f(Math.cos(t) * 20)} ${f(Math.sin(t) * 3 - 3)}" stroke="#FF8A2A" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; }).join("")}`); }
    // la crête des montagnes de l'Ombre (devant le héros), contre-jour rouge
    { const pts = []; for (let x = -20; x <= W + 20; x += 22) { const base = x > 760 ? 238 : x > 560 ? 262 : 268; pts.push([x, base + (r() - .5) * 22 + ((x / 22) % 2 ? 9 : -9)]); }
      const ligne = pts.map((p, k) => (k ? "L" : "M") + f(p[0]) + " " + f(p[1])).join("");
      s.push(`<path d="${ligne}L${W + 20} 360L-20 360Z" fill="url(#a4-crete)"/><path d="${ligne}" fill="none" stroke="#FF5A2A" stroke-width="2.2" opacity=".7"/>`); }
    s.push(`<rect x="0" y="228" width="${W}" height="120" fill="url(#a4-brumeR)"/>`);

    // ================= 2. LE MILIEU : monts Brumeux (gauche), montagnes Blanches et la cité (droite), voilés de brume =================
    const pic = (px, py, hw, by, c1, c2, neige) => { const h = by - py, ny = py + h * .3;
      let o = `<path d="M${f(px - hw)} ${f(by)}L${f(px - hw * .4)} ${f(py + h * .45)}L${f(px)} ${f(py)}L${f(px + hw * .5)} ${f(py + h * .5)}L${f(px + hw)} ${f(by)}Z" fill="${c1}"/><path d="M${f(px - hw)} ${f(by)}L${f(px - hw * .4)} ${f(py + h * .45)}L${f(px)} ${f(py)}L${f(px + hw * .08)} ${f(by)}Z" fill="${c2}"/>`;
      o += `<path d="M${f(px)} ${f(py)}L${f(px - hw * .3)} ${f(ny)}L${f(px - hw * .14)} ${f(ny - h * .05)}L${f(px)} ${f(ny + h * .04)}L${f(px + hw * .14)} ${f(ny - h * .04)}L${f(px + hw * .32)} ${f(ny + h * .02)}Z" fill="${neige}"/>`;
      o += `<path d="M${f(px - hw * .4)} ${f(py + h * .45)}L${f(px)} ${f(py)}L${f(px + hw * .5)} ${f(py + h * .5)}" fill="none" stroke="#FF7A44" stroke-width="1.8" opacity=".75"/>`;
      s.push(o); };
    // monts Brumeux
    [[214, 262, 74, 380], [298, 236, 88, 384], [384, 260, 72, 380], [452, 290, 58, 382]].forEach(p => pic(...p, "#8C6676", "#B48A86", "#F6D6C6"));
    // la porte de la Moria : un simple tracé d'argent qui luit au pied du mont
    K.halo(300, 352, 26, "#CFE8FF", .7);
    s.push(`<g fill="none" stroke="#EAF6FF" stroke-width="1.6" opacity=".95"><path d="M290 362V344Q300 328 310 344V362"/><path d="M300 360V346M300 350l-4 -4M300 350l4 -4"/><circle cx="300" cy="338" r="1.4" fill="#EAF6FF"/></g>`);
    // montagnes Blanches
    [[640, 312, 52, 396], [712, 294, 62, 398], [956, 286, 64, 400]].forEach(p => pic(...p, "#9A7480", "#C49C92", "#FFE6D6"));
    pic(776, 300, 44, 400, "#9A7480", "#C49C92", "#FFE6D6");     pic(850, 250, 92, 404, "#A07A84", "#CCA69A", "#FFEEDC");
    // Minas Tirith : 7 murailles en anneaux adossées au mont, l'éperon de rocher, la tour blanche qui capte la lumière
    // les feux d'alarme : 3 grands feux sur la même ligne de crête
    s.push(`<path d="M100 372Q260 352 420 370T760 366T1000 372L1000 470L100 470Z" fill="#E2B460" opacity=".9" filter="url(#a4-flou8)"/>`);
    s.push(`<rect x="0" y="330" width="${W}" height="110" fill="url(#a4-brume)"/>`);
    const CX = 850, CY = 394;
    { s.push(`<path d="M${CX - 26} ${CY + 8}L${CX - 6} ${CY - 92}L${CX + 4} ${CY - 98}L${CX + 30} ${CY + 8}Z" fill="#A07A84"/>`);
      for (let t = 0; t < 7; t++) { const cy = CY - t * 12, rx = 70 - t * 8.2, ry = 11 - t * .9, h = 7;
        s.push(`<path d="M${f(CX - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(CX + rx)} ${f(cy)}V${f(cy - h)}A${f(rx)} ${f(ry)} 0 0 1 ${f(CX - rx)} ${f(cy - h)}Z" fill="url(#a4-blanc)" stroke="#6A4A4A" stroke-width=".7"/><path d="M${f(CX - rx * .96)} ${f(cy - h - 1)}A${f(rx)} ${f(ry)} 0 0 0 ${f(CX + rx * .96)} ${f(cy - h - 1)}" fill="none" stroke="#C49C92" stroke-width="3" opacity=".7"/><path d="M${f(CX - rx)} ${f(cy - h)}A${f(rx)} ${f(ry)} 0 0 0 ${f(CX + rx)} ${f(cy - h)}" fill="none" stroke="#FFF8EA" stroke-width="1.3"/>`); }
      // l'éperon de rocher, comme une proue, qui fend les anneaux
      s.push(`<path d="M${CX - 12} ${CY + 10}L${CX - 3} ${CY - 80}L${CX + 3} ${CY - 84}L${CX + 16} ${CY + 10}Z" fill="#C8B4AA" stroke="#5A3A3A" stroke-width=".8"/><path d="M${CX + 3} ${CY - 84}L${CX + 16} ${CY + 10}L${CX + 4} ${CY + 10}Z" fill="#8A6A6A"/>`);
      K.halo(CX, CY - 104, 40, "#FFF6E0", .95);
      s.push(`<path d="M${CX - 3} ${CY - 82}V${CY - 118}L${CX} ${CY - 128}L${CX + 3} ${CY - 118}V${CY - 82}Z" fill="#FFFDF6" stroke="#5A3A3A" stroke-width=".7"/>`); }
    const FEUX = [[640, 312], [712, 294], [776, 300]];
    FEUX.forEach(([x, y]) => s.push(`<path d="M${x - 6} ${y + 2}l6 -8l6 8z" fill="#3A2016"/>`));

    // ================= 3. LA PLAINE DORÉE (le Rohan) et les cavaliers =================
    s.push(`<path d="M150 470Q300 410 470 430T820 420L840 520H150Z" fill="#D4AE52" opacity=".55"/><path d="M150 470Q300 410 470 430T820 420" fill="none" stroke="#F8DC88" stroke-width="2" opacity=".6"/>`);
    // Cul-de-Sac (la colline des 4 portes, dans la boucle)
    s.push(`<path d="M206 610C240 520 360 462 492 458C620 455 730 500 800 610Z" fill="url(#a4-colline)" stroke="#2A4A14" stroke-width="1.4"/><path d="M262 520C330 478 410 462 492 460C590 458 680 486 740 530" fill="none" stroke="#F4E890" stroke-width="3" opacity=".7"/>`);

    // ================= 4. LA COMTÉ (premier plan, collines qui débordent du cadre) =================
    s.push(`<path d="M-20 640C80 600 220 610 330 640C440 610 560 640 660 660C760 640 840 640 900 660L900 740H-20Z" fill="url(#a4-pres)" stroke="#1E3A10" stroke-width="1.4"/><path d="M-20 640C80 600 220 610 330 640C440 610 560 640 660 660C760 640 840 640 900 660" fill="none" stroke="#E8E070" stroke-width="2.5" opacity=".6"/>`);
    // le grand arbre de la fête (bas gauche), massif
    { const x = 52, y = 470; s.push(`<path d="M${x - 16} 720C${x - 8} 640 ${x - 22} 580 ${x - 6} ${y + 30}L${x + 10} ${y + 30}C${x + 18} 590 ${x + 6} 650 ${x + 24} 720Z" fill="#4A2E18" stroke="#1E120C" stroke-width="1.4"/><path d="M${x - 2} ${y + 60}L${x + 40} ${y + 20}M${x - 6} ${y + 80}L${x - 50} ${y + 40}" stroke="#4A2E18" stroke-width="9" stroke-linecap="round"/>`);
      [[-58, 10, 46], [40, 8, 50], [-20, -36, 54], [30, -50, 48], [-4, 22, 50], [76, -14, 34], [-80, -30, 36]].forEach(([u, v, R]) => s.push(`<circle cx="${x + u}" cy="${y + v}" r="${R}" fill="#3E8A2C" stroke="#1A3A10" stroke-width="1.2"/><circle cx="${f(x + u + R * .15)}" cy="${f(y + v - R * .3)}" r="${f(R * .6)}" fill="#7EC24A" opacity=".75"/><path d="M${f(x + u - R * .3)} ${f(y + v - R * .82)}A${R} ${R} 0 0 1 ${f(x + u + R * .7)} ${f(y + v - R * .6)}" stroke="#F4E870" stroke-width="2.4" fill="none" opacity=".75"/>`));
      [[-40, 50], [-6, 64], [30, 54], [62, 40], [-70, 30]].forEach(([u, v]) => { K.halo(x + u, y + v, 12, "#FFD060", .9); s.push(`<circle cx="${x + u}" cy="${y + v}" r="3.4" fill="#FFF0A0" stroke="#5A3A10" stroke-width=".6"/>`); }); }
    // le magicien gris, de dos, bâton levé, qui regarde vers le Mordor — et un hobbit à ses côtés
    const MG = [962, 720];
    { const [x, y] = MG;
      s.push(`<ellipse cx="${x - 30}" cy="${y - 2}" rx="110" ry="14" fill="#000" opacity=".25"/>`);
      // cape
      s.push(`<path d="M${x - 66} ${y + 10}C${x - 60} ${y - 60} ${x - 44} ${y - 120} ${x - 34} ${y - 150}C${x - 20} ${y - 168} ${x + 22} ${y - 168} ${x + 34} ${y - 150}C${x + 46} ${y - 118} ${x + 62} ${y - 60} ${x + 72} ${y + 10}Z" fill="url(#a4-cape)" stroke="#1E1A20" stroke-width="1.6"/>`);
      s.push(`<path d="M${x - 10} ${y - 150}C${x - 16} ${y - 100} ${x - 22} ${y - 40} ${x - 26} ${y + 10}M${x + 14} ${y - 140}C${x + 20} ${y - 90} ${x + 26} ${y - 40} ${x + 30} ${y + 10}" stroke="#3A3640" stroke-width="2" fill="none" opacity=".5"/>`);
      s.push(`<path d="M${x - 66} ${y + 10}C${x - 60} ${y - 60} ${x - 44} ${y - 120} ${x - 34} ${y - 150}C${x - 20} ${y - 168} ${x} ${y - 170} ${x + 10} ${y - 166}" fill="none" stroke="#FFB070" stroke-width="2.6" opacity=".85"/>`);
      // bras levé et bâton
      s.push(`<path d="M${x + 28} ${y - 146}C${x + 46} ${y - 160} ${x + 58} ${y - 180} ${x + 62} ${y - 200}L${x + 74} ${y - 196}C${x + 70} ${y - 172} ${x + 58} ${y - 150} ${x + 38} ${y - 128}Z" fill="#8A8690" stroke="#1E1A20" stroke-width="1.4"/>`);
      s.push(`<path d="M${x + 58} ${y - 110}L${x + 76} ${y - 290}" stroke="#3A2414" stroke-width="5.5" stroke-linecap="round"/><path d="M${x + 76} ${y - 290}c-8 -6 -6 -16 2 -18c6 -1 10 6 6 12" stroke="#3A2414" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="${x + 66}" cy="${y - 198}" r="7" fill="#D8C0A8" stroke="#1E1A20" stroke-width="1"/>`);
      // chapeau pointu à large bord, cheveux gris
      s.push(`<path d="M${x - 22} ${y - 158}Q${x} ${y - 140} ${x + 22} ${y - 158}L${x + 14} ${y - 176}H${x - 14}Z" fill="#D8D4D0" stroke="#1E1A20" stroke-width="1.2"/>`);
      s.push(`<ellipse cx="${x}" cy="${y - 176}" rx="46" ry="10" fill="#6E6A74" stroke="#1E1A20" stroke-width="1.4"/><path d="M${x - 46} ${y - 176}Q${x} ${y - 160} ${x + 46} ${y - 176}" fill="none" stroke="#4A4652" stroke-width="2"/>`);
      s.push(`<path d="M${x - 22} ${y - 180}C${x - 18} ${y - 210} ${x - 14} ${y - 236} ${x - 30} ${y - 262}C${x - 2} ${y - 244} ${x + 14} ${y - 214} ${x + 22} ${y - 180}Z" fill="#7A7680" stroke="#1E1A20" stroke-width="1.4"/><path d="M${x - 22} ${y - 180}C${x - 18} ${y - 210} ${x - 14} ${y - 236} ${x - 30} ${y - 262}" fill="none" stroke="#FFB070" stroke-width="2.2" opacity=".85"/>`);
      // le hobbit (cape verte, cheveux bouclés), de dos
      const hx = 0, hy = 0; s.push(`<g transform="translate(${x - 118} ${y + 2}) scale(1.35)">`); 
      s.push(`<path d="M${hx - 24} ${hy}C${hx - 22} ${hy - 30} ${hx - 18} ${hy - 50} ${hx - 14} ${hy - 62}C${hx - 6} ${hy - 70} ${hx + 6} ${hy - 70} ${hx + 14} ${hy - 62}C${hx + 18} ${hy - 50} ${hx + 22} ${hy - 30} ${hx + 24} ${hy}Z" fill="#3E6A30" stroke="#142A0E" stroke-width="1.4"/><path d="M${hx - 24} ${hy}C${hx - 22} ${hy - 30} ${hx - 18} ${hy - 50} ${hx - 14} ${hy - 62}" fill="none" stroke="#FFB070" stroke-width="2" opacity=".8"/>`);
      s.push(`<path d="M${hx - 16} ${hy - 58}C${hx - 20} ${hy - 76} ${hx - 12} ${hy - 90} ${hx + 2} ${hy - 92}C${hx + 14} ${hy - 90} ${hx + 20} ${hy - 76} ${hx + 16} ${hy - 58}Q${hx} ${hy - 52} ${hx - 16} ${hy - 58}Z" fill="#4A7A38" stroke="#142A0E" stroke-width="1.3"/><path d="M${hx - 16} ${hy - 60}C${hx - 20} ${hy - 76} ${hx - 12} ${hy - 90} ${hx + 2} ${hy - 92}" fill="none" stroke="#FFB070" stroke-width="1.8" opacity=".85"/><path d="M${hx + 2} ${hy - 90}Q${hx + 4} ${hy - 72} ${hx} ${hy - 56}" stroke="#2A4A1E" stroke-width="1.2" fill="none" opacity=".6"/><rect x="${hx - 13}" y="${hy - 50}" width="26" height="30" rx="8" fill="#7A5230" stroke="#2A160A" stroke-width="1.2"/><path d="M${hx - 13} ${hy - 38}h26" stroke="#4A2E18" stroke-width="1.4"/><rect x="${hx - 16}" y="${hy - 56}" width="32" height="9" rx="4.5" fill="#B89A6A" stroke="#2A160A" stroke-width="1"/><path d="M${hx - 11} ${hy - 26}h22" stroke="#FFB070" stroke-width="1" opacity=".5"/><path d="M${hx - 6} ${hy - 58}l6 5l6 -5" fill="#E2B93B" stroke="#5A3A10" stroke-width=".8"/>`);
      s.push(`<path d="M${hx + 12} ${hy - 48}Q${hx + 26} ${hy - 40} ${hx + 30} ${hy - 26}" stroke="#3E6A30" stroke-width="6" stroke-linecap="round" fill="none"/>`); } s.push(`</g>`);

    // ================= 5. CUL-DE-SAC : les 4 portes rondes (cadres-portraits), alignées dans la colline =================
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"], PORTES = [[366, 510], [456, 500], [546, 500], [636, 510]];
    PORTES.forEach(([x, y], k) => { const c = CJ[k]; PORTR.push({ k, x, y, r: 20 });
      s.push(`<path d="M${x - 40} ${y + 8}C${x - 38} ${y - 40} ${x + 38} ${y - 40} ${x + 40} ${y + 8}" fill="#5E9A34" stroke="#2A4A14" stroke-width="1.2"/><path d="M${x - 34} ${y - 14}C${x - 26} ${y - 36} ${x + 26} ${y - 36} ${x + 34} ${y - 14}" stroke="#D4E870" stroke-width="2" fill="none" opacity=".7"/><path d="M${x} ${y + 30}Q${x + (k < 2 ? -10 : 10)} ${y + 50} ${x + (k < 2 ? -4 : 4)} ${y + 72}" stroke="#E6CC92" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>`);
      s.push(`<circle cx="${x}" cy="${y + 2}" r="33" fill="#2A4A14" opacity=".35"/><circle cx="${x}" cy="${y}" r="30" fill="#9A6A3A" stroke="#1E120C" stroke-width="1.4"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(q => { const t = q / 12 * TAU; return `<path d="M${f(x + Math.cos(t) * 25)} ${f(y + Math.sin(t) * 25)}L${f(x + Math.cos(t) * 30)} ${f(y + Math.sin(t) * 30)}" stroke="#5A3A1E" stroke-width="1.2"/>`; }).join("")}<circle cx="${x}" cy="${y}" r="24.5" fill="${c}" stroke="#1E120C" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="20.5" fill="#2A1A10" stroke="${mixHex(c, "#000000", .35)}" stroke-width="1.4"/><path d="M${x - 30} ${y - 6}A30 30 0 0 1 ${x + 6} ${y - 30}" stroke="#FFE7A0" stroke-width="2" fill="none" opacity=".7"/>`);
      s.push(`<text x="${x}" y="${y + 52}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="19" fill="${mixHex(c, "#FFFFFF", .45)}" stroke="#1E120C" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${NOMS[k]}</text>`);
      a.push(`<circle cx="${x}" cy="${y}" r="28" fill="none" stroke="#FFF4C0" stroke-width="2.4" opacity="${K.anime ? 0 : .6}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.22;1" dur="10s" begin="${k * 2.5}s" repeatCount="indefinite"/>`)}</circle>`); });
    // cheminées sur la colline
    [[411, 468], [591, 468]].forEach(([x, y]) => s.push(`<path d="M${x - 6} ${y}v-18h12v18z" fill="#A87A52" stroke="#1E120C"/><path d="M${x - 8} ${y - 18}h16v-4h-16z" fill="#6A4A2E" stroke="#1E120C"/>`));

    // touffes d'herbe au premier plan (donnent l'échelle du plan le plus proche)
    [[230, 716, 1.3], [330, 706, 1], [640, 712, 1.2], [760, 700, .9], [150, 690, .8]].forEach(([x, y, sc]) => { let o = ""; for (let q = -3; q <= 3; q++) o += `<path d="M${f(q * 4)} 0Q${f(q * 6)} ${f(-14 - Math.abs(3 - Math.abs(q)) * 5)} ${f(q * 9 + 3)} ${f(-22 - (3 - Math.abs(q)) * 5)}" stroke="${q % 2 ? "#2E6A1E" : "#9ACB4A"}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`; s.push(`${G(x, y, sc)}${o}</g>`); });
    // ================= 6. LA ROUTE : s'amincit et passe du doré à la cendre en montant vers le Mordor =================
    { const lw = y => 9 + 17 * Math.max(0, Math.min(1, (y - 60) / 560)), col = (y, c1, c2) => mixHex(c2, c1, Math.max(0, Math.min(1, (y - 80) / 520))), pas = 4, segs = [];
      for (let i = 0; i < K.N; i += pas) { const p = K.P[i], q = K.P[(i + pas) % K.N], ym = (p[1] + q[1]) / 2; segs.push([`M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`, ym]); }
      s.push(`<path d="${K.piste}" fill="none" stroke="#000" stroke-width="16" opacity=".25" filter="url(#a4-flou)"/>`);
      let o1 = "", o2 = "", o3 = "";
      segs.forEach(([d, y]) => { o1 += `<path d="${d}" stroke="${col(y, "#3A2410", "#1A0C0A")}" stroke-width="${f(lw(y) + 5)}"/>`; o2 += `<path d="${d}" stroke="${col(y, "#ECD498", "#8A7A76")}" stroke-width="${f(lw(y))}"/>`; });
      s.push(`<g fill="none" stroke-linecap="round">${o1}${o2}</g>`);
      s.push(`<path d="${K.piste}" fill="none" stroke="#A8281E" stroke-width="1.6" stroke-dasharray="8 9" opacity=".55"/>`); }
    K.depart();
    titre(470, 700, "LA COMTÉ", 28, "#FFF0A0", "#203410");
    titre(676, 30, "MORDOR", 27, "#FF6A2A", "#1A0404", .3);
    // ---- la lumière unique + grain
    s.push(`<rect width="${W}" height="${H}" fill="url(#a4-lum)"/><rect width="${W}" height="${H}" fill="#fff" filter="url(#a4-grain)" opacity=".3"/>`);

    // ================= COUCHE ANIMÉE =================
    // la Montagne du Destin vit : lueur du cratère, coulées, panaches, braises
    a.push(`<circle cx="${dX}" cy="${dY - 2}" r="40" fill="url(#an-lave)" opacity=".85">${an(`<animate attributeName="opacity" values=".55;1;.55" dur="2.4s" repeatCount="indefinite"/>`)}</circle>`);
    COULEES.slice(0, 2).forEach((d, k) => a.push(`<path d="${d}" fill="none" stroke="#FFF0B0" stroke-width="1.8" stroke-dasharray="6 14" stroke-linecap="round">${an(`<animate attributeName="stroke-dashoffset" values="40;0" dur="${2 + k * .7}s" repeatCount="indefinite"/>`)}</path>`));
    for (let k = 0; k < 3; k++) a.push(`<ellipse cx="${dX + k * 8}" cy="${dY - 16}" rx="${16 + k * 5}" ry="${10 + k * 3}" fill="#5A2018" opacity="${K.anime ? 0 : .45}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${50 + k * 30} -50" dur="${6 + k * 2}s" begin="${k * 2.4}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.75;0" dur="${6 + k * 2}s" begin="${k * 2.4}s" repeatCount="indefinite"/>`)}</ellipse>`);
    for (let k = 0; k < 10; k++) { const x = dX - 160 + r() * 420, y = 40 + r() * 200, d = (5 + r() * 5).toFixed(1); a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r() * 1.4)}" fill="#FF9A3A" opacity=".8">${an(`<animateTransform attributeName="transform" type="translate" values="0 30;${f((r() - .5) * 40)} -60" dur="${d}s" begin="-${(r() * +d).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); }
    // le Nazgûl sur sa bête ailée, dans le ciel libre à gauche (loin de l'Œil)
    { const naz = `<g transform="scale(1.6)"><path d="M0 0C-10 -16 -30 -24 -50 -16C-40 -12 -34 -6 -32 2C-22 -4 -10 -2 0 4C10 -2 22 -4 32 2C34 -6 40 -12 50 -16C30 -24 10 -16 0 0Z" fill="#14080C" stroke="#FF5A2A" stroke-width=".7"/><path d="M-2 0Q4 -6 12 -10L16 -8L8 -2Z" fill="#14080C"/><path d="M-3 -2L-1 -12L3 -12L4 -2Z" fill="#14080C"/><path d="M-1 4Q-4 12 -10 16" stroke="#14080C" stroke-width="2" fill="none"/></g>`;
      if (K.anime) a.push(`<g><animateMotion dur="20s" repeatCount="indefinite" path="M110,124 C150,70 250,70 290,110 S230,166 170,154 S80,160 110,124"/>${naz}</g>`);
      else a.push(`<g transform="translate(170 108)">${naz}</g>`); }
    // les 3 feux d'alarme : s'allument l'un après l'autre (vers la cité)
    FEUX.forEach(([x, y], k) => a.push(`<g opacity="${K.anime ? .3 : 1}">${an(`<animate attributeName="opacity" values=".3;.3;1;1;.3" keyTimes="0;${(.1 + k * .12).toFixed(2)};${(.16 + k * .12).toFixed(2)};.9;1" dur="12s" repeatCount="indefinite"/>`)}<circle cx="${x}" cy="${y - 10}" r="24" fill="url(#a4-feu)"/><path d="M${x - 6} ${y - 4}Q${x - 7} ${y - 18} ${x} ${y - 28}Q${x + 7} ${y - 17} ${x + 6} ${y - 4}Z" fill="#FFB030"/><path d="M${x - 3} ${y - 4}Q${x} ${y - 15} ${x + 3} ${y - 4}Z" fill="#FFF2A0"/></g>`));
    // la colonne des cavaliers, au galop sur la plaine dorée vers la cité blanche, traînée de poussière
    const cheval = (x, y, cR, ban) => `${G(x, y, 1)}<ellipse cx="0" cy="4" rx="16" ry="3" fill="#000" opacity=".3"/><path d="M-12 -2L-17 3M-8 -2L-3 4M7 -2L3 4M10 -2L16 2" stroke="${mixHex(cR, "#000000", .3)}" stroke-width="2.4" stroke-linecap="round"/><path d="M-13 -9Q-14 -2 -8 -1H8Q13 -2 12 -8L16 -16L20 -14L19 -10L22 -9L18 -18Q14 -22 10 -14Q0 -12 -13 -9Z" fill="${cR}" ${INK}/><path d="M-13 -8Q-20 -8 -23 -1" stroke="${mixHex(cR, "#000000", .4)}" stroke-width="2.2" fill="none"/>
      <path d="M-4 -12Q-6 -20 -1 -24L4 -23Q6 -18 3 -12Z" fill="#6A6A60" ${INK}/><circle cx="1" cy="-27" r="3.6" fill="#B8B0A0" ${INK}/><path d="M-2 -30q3 -5 7 -1" stroke="#E8D090" stroke-width="1.4" fill="none"/><path d="M-3 -20Q-15 -16 -19 -7L-6 -12Z" fill="#2E6B3A" ${INK}/><path d="M6 -30L18 -50" stroke="#5A4A3A" stroke-width="1.5"/>${ban ? `<path d="M17 -49l14 3l-13 5z" fill="#2E7A3A" stroke="#1E120C" stroke-width=".7"/><path d="M21 -46l3 -1l2 1l-1 2l-3 0z" fill="#F4F4F0"/>` : ""}</g>`;
    let colonne = `<ellipse cx="-110" cy="2" rx="120" ry="12" fill="#FFE8A8" opacity=".55" filter="url(#a4-flou8)"/>`; [[0, 0, "#EDE6D6", 1], [-40, 8, "#7A4A2A", 0], [-78, -2, "#3A2A20", 1], [-116, 9, "#9A6A3A", 0], [-154, 1, "#5A3A26", 0]].forEach(([u, v, c, b]) => colonne += cheval(u, v, c, b));
    a.push(`<g transform="translate(640 436)">${an(`<animateTransform attributeName="transform" type="translate" values="560 438;680 430;560 438" dur="16s" repeatCount="indefinite"/>`)}<g transform="scale(1.45)">${colonne}</g></g>`);
    // fumée des cheminées de Cul-de-Sac
    [[411, 444], [591, 444]].forEach(([x, y], k) => { for (let q = 0; q < 2; q++) a.push(`<circle cx="${x}" cy="${y}" r="${5 + q * 2}" fill="#F4F0E8" opacity="${K.anime ? 0 : .5}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${18 + q * 8} -30" dur="${5 + q}s" begin="${k * 1.3 + q * 2.4}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.7;0" dur="${5 + q}s" begin="${k * 1.3 + q * 2.4}s" repeatCount="indefinite"/>`)}</circle>`); });
    // la petite lumière du bâton
    { const [x, y] = MG; a.push(`<circle cx="${x + 77}" cy="${y - 300}" r="18" fill="#E8F4FF" opacity=".35">${an(`<animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite"/>`)}</circle><circle cx="${x + 77}" cy="${y - 300}" r="5.5" fill="#FFFFFF"/>`); }
    // l'Œil : battement, faisceau et pupille qui suivent la voiture de tête (classe an-suit : l'événement les remplace)
    a.push(`<ellipse cx="${oeilX}" cy="${oeilY}" rx="50" ry="22" fill="url(#a4-feu)" opacity=".7">${an(`<animate attributeName="rx" values="46;56;46" dur="1.6s" repeatCount="indefinite"/>`)}</ellipse>`);
    const DUR = 48, DEB = [4.2, 2.8, 1.4, 0];
    { const n = 32, pts = []; for (let q = 0; q <= n; q++) { const i = Math.floor(((q / n + DEB[0] / DUR) % 1) * K.N) % K.N; pts.push(K.P[i]); }
      const angs = []; pts.forEach(p => { let t = Math.atan2(p[1] - oeilY, p[0] - oeilX) * 180 / PI; if (angs.length) { const pr = angs[angs.length - 1]; while (t - pr > 180) t -= 360; while (t - pr < -180) t += 360; } angs.push(t); });
      const kt = pts.map((_, q) => q === n ? "1" : q === 0 ? "0" : (q / n).toFixed(4)).join(";"), pupille = pts.map(p => { const d = Math.hypot(p[0] - oeilX, p[1] - oeilY) || 1; return f((p[0] - oeilX) / d * 12) + " " + f((p[1] - oeilY) / d * 3); }).join(";");
      a.unshift(`<radialGradient id="a4-faisceau" gradientUnits="userSpaceOnUse" cx="${f(oeilX)}" cy="${f(oeilY)}" r="820"><stop offset="0" stop-color="#FFE0A0" stop-opacity=".75"/><stop offset=".5" stop-color="#FF9A3A" stop-opacity=".22"/><stop offset="1" stop-color="#FF7A2A" stop-opacity="0"/></radialGradient>`);
      a.push(`<path class="an-suit" d="M${f(oeilX)} ${f(oeilY - 3)}L${f(oeilX + 960)} ${f(oeilY - 56)}L${f(oeilX + 960)} ${f(oeilY + 56)}L${f(oeilX)} ${f(oeilY + 3)}Z" fill="url(#a4-faisceau)" style="mix-blend-mode:screen"${K.anime ? "" : ` transform="rotate(${f(angs[0])} ${f(oeilX)} ${f(oeilY)})"`}>${an(`<animateTransform attributeName="transform" type="rotate" values="${angs.map(t => f(t) + " " + f(oeilX) + " " + f(oeilY)).join(";")}" keyTimes="${kt}" dur="${DUR}s" begin="0s" repeatCount="indefinite"/>`)}</path>`);
      a.push(`<g class="an-suit"${K.anime ? "" : ` transform="translate(${pupille.split(";")[0]})"`}>${an(`<animateTransform attributeName="transform" type="translate" values="${pupille}" keyTimes="${kt}" dur="${DUR}s" repeatCount="indefinite"/>`)}<ellipse cx="${f(oeilX)}" cy="${f(oeilY)}" rx="3.6" ry="14" fill="#120404"/></g>`); }
    // les 4 pilotes : 4 voyageurs encapuchonnés aux couleurs des 4
    CJ.forEach((c, k) => a.push(K.surPiste(.05 + DEB[k] / DUR, `<g transform="scale(1.2)"><ellipse cx="-1" cy="1" rx="7" ry="5" fill="#000" opacity=".3"/><path d="M-7 -5Q-9 0 -7 5L4 3Q6 0 4 -3Z" fill="${c}" stroke="#1A1410" stroke-width=".9"/><circle cx="3" cy="0" r="3.4" fill="${mixHex(c, "#000000", .35)}" stroke="#1A1410" stroke-width=".7"/><circle cx="4.6" cy="0" r="1.5" fill="#F2CDB0"/><path d="M-1 -4l-3 -3M-1 4l-3 3" stroke="#1A1410" stroke-width="1"/></g>`, DUR, DEB[k])));
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#a4-sol)"/>`, "", 0); RES.portraits = PORTR; RES.lieux = { destin: [dX, dY], oeil: [oeilX, oeilY] }; return RES;
  }
  /* ---------- Décembre · Le Garage des rêves (tour de chauffe) : l'immense atelier vu du dessus — v3 ---------- */
  /* ---------- Décembre · Le Garage des rêves (v4 : grande scène illustrée, vue plongeante, au niveau de l'Arène) ----------
     Le hall du garage, la nuit de Noël, vu un peu de haut : au fond, la verrière sur la ville enneigée et l'enseigne au néon ;
     la grande porte ouverte (dans l'encoche du tracé) sur le sapin de Noël et la neige. En haut à gauche, les 4 box des pilotes
     en perspective (murs à leur couleur, monoplace de face, cadre-portrait au mur : l'appli y pose les vrais portraits).
     En bas, sous les projecteurs : la voiture à remonter le temps (portes papillon ouvertes, éclairs, 88 mph), la voiture
     mystère sous sa bâche « 2027 ? » au centre et le chef d'équipe, la voiture noire au scanner rouge (de face).
     À droite : la coccinelle n°53 et la voiture rouge n°95 qui sourit. Mécaniciens au travail, sol ciré qui reflète tout. */
  function peindreGarage5(T, Z, def) {
    const K = kit(T, def, 1227, "g5-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#07080B" stroke-width="1.6" stroke-linejoin="round"`, IN1 = `stroke="#07080B" stroke-width="1" stroke-linejoin="round"`;
    const G = (x, y, sc, rot, sy) => `<g transform="translate(${f(x)} ${f(y)})${sc && (sc !== 1 || sy) ? ` scale(${sc}${sy ? " " + sy : ""})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const O0 = v => K.anime ? 0 : (v === undefined ? 1 : v);
    const CJ = COULEURS_J;
    const txt = (x, y, t, sz, c, o) => { o = o || {}; return `<text x="${f(x)}" y="${f(y)}" text-anchor="${o.ancre || "middle"}" font-family="${o.police || "Helvetica, Arial, sans-serif"}" font-weight="${o.gras || 900}"${o.ital ? ` font-style="italic"` : ""} font-size="${sz}" letter-spacing="${o.esp || 0}" fill="${c}"${o.tour ? ` stroke="${o.tour}" stroke-width="${o.tw || 3}" paint-order="stroke"` : ""}${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(y)})"` : ""}>${t}</text>`; };
    const lin = (id, st, x2, y2) => s.push(`<linearGradient id="g5-${id}" x1="0" y1="0" x2="${x2 === undefined ? 0 : x2}" y2="${y2 === undefined ? 1 : y2}">${st.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ""}/>`).join("")}</linearGradient>`);
    const rad = (id, st, ex) => s.push(`<radialGradient id="g5-${id}" ${ex || 'r="50%"'}>${st.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ""}/>`).join("")}</radialGradient>`);
    lin("ciel", [[0, "#1A2650"], [.7, "#2E4274"], [1, "#4C6090"]]);
    lin("inox", [[0, "#F4F7FA"], [.38, "#B9C1CC"], [.55, "#8A93A0"], [.75, "#C9D0D9"], [1, "#6E7784"]]);
    lin("rouge", [[0, "#FF6A4A"], [.45, "#E0242C"], [1, "#7A0C14"]]);
    lin("bache", [[0, "#FFFFFF"], [.3, "#F6F0E4"], [.62, "#C4BEB8"], [1, "#6A6A78"]]);
    lin("vitre", [[0, "#6A8AB8"], [.5, "#1A2840"], [1, "#0C1422"]]);
    lin("sapin", [[0, "#2E6A3C"], [1, "#10301A"]], 1, 0);
    lin("neige", [[0, "#C8D4E8"], [1, "#6A7C9A"]]);
    lin("podium", [[0, "#4A4250"], [1, "#141218"]]);
    lin("or", [[0, "#FFF2B8"], [.4, "#F2C64A"], [1, "#8A5A12"]], 1, 1);
    lin("mur", [[0, "#1C2444"], [1, "#2C3352"]]);
    lin("porte", [[0, "#262A3E"], [1, "#1A1C2C"]]);
    lin("basB", [[0, "#2A2C3C", 0], [1, "#2A2C3C", .45]]);
    lin("rabat", [[0, "#9A96A2"], [.55, "#D8CCB8"], [1, "#FFE2A0"]], 0, 1);
    lin("poutre", [[0, "#3A3640"], [1, "#16141A"]]);
    rad("chaud", [[0, "#FFE6B8", .9], [.45, "#FFB868", .35], [1, "#FFB060", 0]]);
    rad("froid", [[0, "#9FD0FF", .3], [1, "#9FD0FF", 0]]);
    rad("sol", [[0, "#7A6252"], [.35, "#4E4246"], [.75, "#2C2836"], [1, "#1C1A26"]], 'cx="45%" cy="76%" r="72%"');
    rad("pli", [[0, "#FFFFFF", .4], [.6, "#FFFFFF", .08], [1, "#FFFFFF", 0]], 'cx="40%" cy="30%" r="60%"');
    rad("lueurOr", [[0, "#FFF0A8", .95], [.4, "#FFC23A", .55], [1, "#FF9A1A", 0]]);
    const flaque = (x, y, rx, ry, op, id) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#g5-${id || "chaud"})" opacity="${op === undefined ? 1 : op}" style="mix-blend-mode:screen"/>`);
    let nCone = 0;
    const cone = (x0, y0, x1, y1, w, c, op) => { const id = "g5-cn" + nCone++, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
      s.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"><stop offset="0" stop-color="${c}" stop-opacity=".7"/><stop offset="1" stop-color="${c}" stop-opacity=".18"/></linearGradient>`);
      s.push(`<path d="M${f(x0 - nx * .08)} ${f(y0 - ny * .08)}L${f(x1 - nx)} ${f(y1 - ny)}Q${f(x1 + dx / l * w * .25)} ${f(y1 + dy / l * w * .25)} ${f(x1 + nx)} ${f(y1 + ny)}L${f(x0 + nx * .08)} ${f(y0 + ny * .08)}Z" fill="url(#${id})" opacity="${op}" style="mix-blend-mode:screen"/>`); };
    const ombreSol = (x, y, rx, ry, op) => s.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#000" opacity="${op || .6}" filter="url(#g5-flou)"/>`);
    // =============== 1. un seul atelier : le mur du fond (haut), bleu de nuit lisible, et le sol de béton qui reçoit la lumière (bas)
    const HZ = 392;
    s.push(`<rect width="${W}" height="${H}" fill="url(#g5-sol)"/>`);
    s.push(`<rect width="${W}" height="${HZ}" fill="url(#g5-mur)"/>`);
    for (let x = 45; x < W; x += 90) s.push(`<path d="M${x} 100V${HZ}" stroke="#0A0C18" stroke-opacity=".3" stroke-width="2"/>`);
    // la lumière chaude des spots remonte sur le bas du mur, derrière la voiture
    s.push(`<ellipse cx="520" cy="${HZ}" rx="430" ry="170" fill="url(#g5-chaud)" opacity=".55" style="mix-blend-mode:screen"/>`);
    s.push(`<rect x="0" y="${HZ - 6}" width="${W}" height="6" fill="#0E0D14"/>`);
    // les joints du sol fuient vers la bâche : la profondeur de l'atelier
    for (let k = -8; k <= 8; k++) { const xb = 520 + k * 150; s.push(`<path d="M${f(520 + k * 52)} ${HZ}L${f(xb)} ${H}" stroke="#000" stroke-opacity=".18" stroke-width="1.4"/>`); }
    [450, 530, 660].forEach(y => s.push(`<path d="M0 ${y}H${W}" stroke="#000" stroke-opacity=".16" stroke-width="1.4"/>`));

    // =============== 2. les hautes fenêtres sur la nuit d'hiver, et la grande verrière du sapin (seule touche froide, au second plan)
    const VX0 = 576, VX1 = 686, VY1 = 338, SX = (VX0 + VX1) / 2;
    for (let x = 18; x < W - 40; x += 88) { if (x + 80 > VX0 - 6 && x < VX1 + 6) continue;
      s.push(`<rect x="${x}" y="22" width="80" height="62" fill="url(#g5-ciel)" stroke="#2E3248" stroke-width="5"/><path d="M${x + 40} 22V84M${x} 53H${x + 80}" stroke="#2E3248" stroke-width="2.4"/><path d="M${x + 2} 76Q${x + 40} 70 ${x + 78} 74V82H${x + 2}Z" fill="#C8D4EA" opacity=".55"/>`); }
    s.push(`<rect x="${VX0}" y="0" width="${VX1 - VX0}" height="${VY1}" fill="url(#g5-ciel)"/>`);
    s.push(`<path d="M${VX0} 262Q${SX} 244 ${VX1} 256V${VY1}H${VX0}Z" fill="url(#g5-neige)"/>`);
    const SY0 = 52, SY1 = 282;
    s.push(`<rect x="${SX - 6}" y="${SY1 - 10}" width="12" height="20" fill="#3A2412" ${IN1}/>`);
    const etages = [[SY0 + 20, 16, SY0 + 66], [SY0 + 54, 25, SY0 + 112], [SY0 + 98, 34, SY0 + 162], [SY0 + 146, 42, SY0 + 214], [SY0 + 196, 50, SY1]];
    etages.forEach(([y0, demi, y1]) => { const pts = []; for (let q = 0; q <= 8; q++) { const u = -demi + q * demi / 4; pts.push(`${f(SX + u)} ${f(y1 + (q % 2 ? -5 : 2))}`); }
      s.push(`<path d="M${SX} ${y0 - 8}L${f(SX + demi)} ${f(y1)}L${pts.reverse().join("L")}Z" fill="url(#g5-sapin)" ${INK}/><path d="M${f(SX - demi * .9)} ${f(y1 - 3)}Q${SX} ${f(y1 + 4)} ${f(SX + demi * .9)} ${f(y1 - 3)}" stroke="#C8D4E8" stroke-width="3" fill="none" opacity=".55"/>`); });
    const BOULES = [];
    etages.forEach(([y0, demi, y1], k) => { const ya = y0 + (y1 - y0) * .55, w = demi * .6; for (let q = 0; q < 2 + k; q++) { const t = (q + .5) / (2 + k); BOULES.push([SX - w + 2 * w * t, ya - 4 + Math.sin(t * PI) * 7]); } });
    BOULES.forEach(([x, y]) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#E8B850" opacity=".75"/>`));
    // la nuit pose un voile bleu sur la verrière : elle reste derrière la bâche
    s.push(`<rect x="${VX0}" y="0" width="${VX1 - VX0}" height="${VY1}" fill="#0A1030" opacity=".4"/>`);
    s.push(`<path d="M${VX0} 0V${VY1}H${VX1}V0" fill="none" stroke="#2A2C38" stroke-width="8"/><path d="M${SX} 0V${VY1}M${VX0} 120H${VX1}M${VX0} 230H${VX1}" stroke="#2A2C38" stroke-width="3" opacity=".9"/>`);
    a.push(`<g transform="translate(${SX} ${SY0 - 10})"><circle r="13" fill="#FFE7A0" opacity=".16"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1;1.15;1" dur="2.4s" repeatCount="indefinite"/>`)}<path d="M0 -10L3 -3L11 -3L4.5 2L7 10L0 5L-7 10L-4.5 2L-11 -3L-3 -3Z" fill="#E2B85A" ${IN1}/></g></g>`);
    [0, 1].forEach(q => a.push(`<g opacity="${O0(.5)}">${an(`<animate attributeName="opacity" values="0;.55;0" dur="2s" begin="${q}s" repeatCount="indefinite"/>`)}${BOULES.filter((_, i) => i % 2 === q).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#FFF3B0" opacity=".35"/>`).join("")}</g>`));
    { a.push(`<clipPath id="g5-cv"><rect x="${VX0}" y="0" width="${VX1 - VX0}" height="${VY1}"/></clipPath>`);
      [[10, 0], [15, 1]].forEach(([du, q]) => { let fl = ""; for (let k = 0; k < 26; k++) fl += `<circle cx="${f(VX0 + r() * (VX1 - VX0))}" cy="${f(r() * VY1)}" r="${f(.9 + r() * 1.4)}" fill="#DDE6F4" opacity="${(.4 + r() * .35).toFixed(2)}"/>`;
        a.push(`<g clip-path="url(#g5-cv)"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 -${VY1};${q ? -8 : 8} 0" dur="${du}s" repeatCount="indefinite"/>`)}${fl}${K.anime ? `<g transform="translate(0 ${VY1})">${fl}</g>` : ""}</g></g>`); }); }

    // =============== 3. au fond à gauche, la rangée de portes de garage fermées (les boxes des pilotes), sans couleur : tout l'éclat va à la bâche
    const PORTR = [], BX0 = 158, BW = 92, PY0 = 214;
    CJ.forEach((c, k) => { const x0 = BX0 + k * BW, xm = x0 + BW / 2;
      s.push(`<rect x="${x0 + 4}" y="${PY0}" width="${BW - 8}" height="${HZ - PY0 - 8}" fill="url(#g5-porte)"/>`);
      for (let y = PY0 + 8; y < HZ - 10; y += 9) s.push(`<path d="M${x0 + 5} ${y}H${x0 + BW - 5}" stroke="#000" stroke-opacity=".3" stroke-width="1.6"/><path d="M${x0 + 5} ${y + 1.6}H${x0 + BW - 5}" stroke="#FFF" stroke-opacity=".05" stroke-width="1"/>`);
      PORTR.push({ k, x: +xm.toFixed(1), y: +(PY0 - 34).toFixed(1), r: 18 });
    });
    for (let k = 0; k <= 4; k++) s.push(`<rect x="${BX0 + k * BW - 4}" y="${PY0 - 6}" width="8" height="${HZ - PY0}" fill="#2A2C3C" ${IN1}/>`);
    s.push(`<rect x="${BX0 - 6}" y="${PY0 - 10}" width="${4 * BW + 12}" height="8" fill="#2E3042" ${IN1}/>`);

    // =============== 4. LE héros : une monoplace sous sa bâche, sous deux projecteurs de plafond
    const MX = 466, MY = 552, S = .95;
    s.push(`<rect x="300" y="146" width="600" height="12" fill="url(#g5-poutre)" ${IN1}/>`);
    for (let x = 310; x < 900; x += 22) s.push(`<path d="M${x} 148l11 8l11 -8" stroke="#0A090D" stroke-width="1.4" fill="none"/>`);
    const SPOTS = [[408, 1, MX - 120, MY - 70, 330], [752, -1, MX + 280, MY - 40, 250]];
    SPOTS.forEach(([x, sd, x1, y1, w]) => cone(x, 184, x1, y1, w, "#FFE6B0", .75));
    flaque(MX - 10, MY - 50, 400, 150, 1);
    flaque(MX + 20, MY + 4, 440, 50, 1);
    SPOTS.forEach(([x, sd]) => s.push(`<path d="M${x} 158V166" stroke="#16141A" stroke-width="4"/><g transform="translate(${x} 174) rotate(${sd * -18})"><rect x="-17" y="-12" width="34" height="26" rx="5" fill="#2A2830" ${INK}/><ellipse cx="0" cy="14" rx="13" ry="4.5" fill="#FFF8DC" ${IN1}/></g><circle cx="${x + sd * 4}" cy="188" r="22" fill="#FFF2CC" opacity=".7" filter="url(#g5-flou)"/>`));
    // la bâche épouse une monoplace (avant vers la droite, sol à y = 0) : aileron arrière fin sur deux dérives, roue arrière qui dépasse,
    // capot moteur qui monte jusqu'à l'arceau pointu, cockpit, museau long et bas ; le coin avant est relevé et montre l'or
    const RR = [-190, -44, 44], RV = [214, -40, 40];
    const BA = "M-262 -10L-266 -42Q-210 -50 -160 -62Q-100 -80 -62 -108L-48 -130L-34 -106Q-26 -92 -6 -88Q24 -100 54 -92Q84 -82 112 -72L160 -62Q150 -38 164 -12Q120 -6 80 -12Q20 -8 -40 -12Q-140 -6 -262 -10Z";
    const AIL = "M-306 -142Q-244 -150 -172 -138L-170 -120Q-240 -128 -304 -122Z";
    const CAP = `M${RR[0] - 48} -36Q${RR[0] - 52} -76 ${RR[0] - 22} -90Q${RR[0]} -97 ${RR[0] + 22} -90Q${RR[0] + 52} -76 ${RR[0] + 48} -36Q${RR[0] + 30} -28 ${RR[0] + 14} -34Q${RR[0]} -26 ${RR[0] - 16} -33Q${RR[0] - 32} -27 ${RR[0] - 48} -36Z`;
    const PLI = (d, w, o) => `<path d="${d}" stroke="#2A2C3C" stroke-opacity="${o || .32}" stroke-width="${w}" fill="none" stroke-linecap="round"/><path d="${d}" transform="translate(3 -1)" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="${f(w * .35)}" fill="none" stroke-linecap="round"/>`;
    // les plis partent des points d'appui (arceau, bosse du casque, arrière) et retombent en éventail
    const PLIS = [["M-48 -126Q-80 -70 -118 -12", 7], ["M-46 -124Q-52 -60 -66 -12", 6], ["M-42 -120Q-10 -64 4 -10", 5],
      ["M54 -90Q40 -50 30 -10", 5], ["M56 -90Q90 -50 112 -10", 5], ["M-262 -40Q-236 -30 -230 -10", 4], ["M-160 -60Q-150 -36 -152 -10", 4]].map(([d, w]) => PLI(d, w)).join("");
    const PLIR = [[-1, -14], [0, 0], [1, 14]].map(([k, dx]) => PLI(`M${RR[0] + k * 4} -92Q${RR[0] + dx * 1.6} -60 ${RR[0] + dx * 2.8} -32`, 4, .25)).join("");
    const pneu = ([x, y, R], jante, rais) => `<circle cx="${x}" cy="${y}" r="${R}" fill="#0B0C10" ${IN1}/><circle cx="${x}" cy="${y}" r="${f(R * .86)}" fill="none" stroke="#2A2C34" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${f(R * .6)}" fill="${jante}" ${IN1}/>${Array.from({ length: 6 }, (_, q) => { const t = q / 6 * TAU; return `<path d="M${x} ${y}l${f(Math.cos(t) * R * .55)} ${f(Math.sin(t) * R * .55)}" stroke="${rais}" stroke-width="${f(R * .1)}"/>`; }).join("")}<circle cx="${x}" cy="${y}" r="${f(R * .15)}" fill="#141215"/>`;
    // sous le coin relevé : un museau long et pointu, et un aileron avant à deux lames, en or
    const NEZ = `<path d="M150 -66Q250 -52 356 -28L358 -20Q250 -22 150 -30Z" fill="url(#g5-or)" ${INK}/><path d="M160 -60Q252 -48 350 -27" stroke="#FFF8D8" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const AV = `<path d="M286 -28V-12M318 -24V-10" stroke="#7A4E12" stroke-width="5"/>
      <path d="M244 -12Q300 -14 364 -8L364 -1Q300 -4 244 -3Z" fill="url(#g5-or)" ${INK}/><path d="M262 -24Q306 -27 354 -20L354 -13Q306 -18 262 -16Z" fill="url(#g5-or)" ${INK}/>
      <path d="M346 -32Q364 -34 368 -26L370 0L344 0Z" fill="url(#g5-or)" ${INK}/><path d="M350 -28V-4" stroke="#FFF8D8" stroke-width="2.2" opacity=".85"/>`;
    s.push(`<ellipse cx="${MX + 40 * S}" cy="${MY + 2}" rx="${340 * S}" ry="15" fill="#000" opacity=".75" filter="url(#g5-flou)"/>`);
    // la lueur de l'or, deuxième point focal, concentrée sur le museau et l'aileron avant
    s.push(`<ellipse cx="${MX + 300 * S}" cy="${MY - 26 * S}" rx="${150 * S}" ry="${78 * S}" fill="url(#g5-lueurOr)" style="mix-blend-mode:screen"/>`);
    s.push(`<ellipse cx="${MX + 300 * S}" cy="${MY + 6}" rx="130" ry="20" fill="url(#g5-lueurOr)" opacity=".7" style="mix-blend-mode:screen"/>`);
    s.push(`<clipPath id="g5-cba"><path d="${BA}"/></clipPath><clipPath id="g5-ccap"><path d="${CAP}"/></clipPath>`);
    s.push(`${G(MX, MY, S)}
      <path d="M-262 -124V-46M-212 -128V-56" stroke="#1A1B22" stroke-width="6.5" stroke-linecap="round"/>
      ${NEZ}
      <path d="${BA}" fill="url(#g5-bache)" ${INK}/><g clip-path="url(#g5-cba)">${PLIS}
        <path d="M-150 -54Q-40 -64 70 -58Q100 -50 118 -28" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M-150 -48Q-40 -58 70 -52Q96 -44 112 -26" stroke="#2A2C3C" stroke-opacity=".35" stroke-width="3" fill="none"/>
        <rect x="-270" y="-34" width="440" height="30" fill="url(#g5-basB)"/>
        <circle cx="${RR[0]}" cy="${RR[1]}" r="${RR[2] + 7}" fill="#141622" opacity=".55"/></g>
      <path d="M-266 -42Q-210 -50 -160 -62Q-100 -80 -62 -108L-48 -130L-34 -106Q-26 -92 -6 -88Q24 -100 54 -92Q84 -82 112 -72L158 -62" stroke="#FFFFFF" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${AIL}" fill="url(#g5-bache)" ${INK}/><path d="M-300 -141Q-244 -148 -176 -137" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M-314 -152Q-306 -156 -300 -150L-298 -98Q-306 -94 -314 -98Z" fill="url(#g5-bache)" ${INK}/><path d="M-310 -150V-100" stroke="#FFFFFF" stroke-width="2" opacity=".8"/>
      ${pneu(RR, "#2A2C34", "#16171C")}
      <path d="${CAP}" fill="url(#g5-bache)" ${INK}/><g clip-path="url(#g5-ccap)">${PLIR}<ellipse cx="${RR[0] - 12}" cy="-74" rx="26" ry="14" fill="url(#g5-pli)"/></g>
      <path d="M${RR[0] - 38} -72Q${RR[0] - 22} -91 ${RR[0]} -93Q${RR[0] + 24} -91 ${RR[0] + 38} -74" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${pneu(RV, "url(#g5-or)", "#8A5A12")}${AV}</g>`);
    // le reflet de l'étoile du sapin sur l'arceau : la bâche et Noël se répondent
    s.push(`${G(MX, MY, S)}<path d="${BA}" fill="url(#g5-lumB)" style="mix-blend-mode:screen"/><circle cx="-47" cy="-127" r="6" fill="#FFF6D8" opacity=".7" filter="url(#g5-flou)"/></g>`);
    rad("lumB", [[0, "#FFF4D8", .7], [.5, "#FFD898", .2], [1, "#FFD898", 0]], 'cx="45%" cy="0%" r="75%"');

    // =============== 5. le mécanicien en contre-jour, penché en arrière, relève à deux mains le coin avant de la bâche : dessous, l'or
    const HL = [364, -198], MECX = 874;
    const RABAT = `M66 -88Q180 -168 ${HL[0]} ${HL[1]}Q306 -150 270 -122Q236 -98 158 -62Z`, RABAT2 = `M66 -88Q182 -172 ${HL[0] + 2} ${HL[1] - 6}Q306 -154 270 -126Q236 -100 158 -62Z`;
    a.push(`${G(MX, MY, S)}<path d="${RABAT}" fill="url(#g5-rabat)" ${INK}>${an(`<animate attributeName="d" values="${RABAT};${RABAT2};${RABAT}" dur="3s" repeatCount="indefinite"/>`)}</path>
      <path d="M${HL[0] - 4} ${HL[1] + 4}Q250 -128 150 -74M${HL[0] - 4} ${HL[1] + 6}Q290 -136 220 -100M${HL[0] - 4} ${HL[1] + 2}Q220 -150 110 -86" stroke="#6A6070" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M70 -90Q180 -166 ${HL[0] - 4} ${HL[1] + 1}" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`);
    { const hx = MX + HL[0] * S - MECX, hy = HL[1] * S;
      const tr = (d, w, c) => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      const corps = c => tr(`M2 -100L-18 -56L-36 -8`, 17, c) + tr(`M10 -100L22 -52L26 -8`, 17, c)
        + `<path d="M-50 0H-24V-10H-44ZM16 0H44L38 -10H18Z" fill="${c}"/>`
        + `<path d="M-12 -98L16 -162Q32 -171 48 -158L26 -94Z" fill="${c}"/><rect x="30" y="-176" width="11" height="10" fill="${c}" transform="rotate(20 35 -171)"/>`
        + `<ellipse cx="44" cy="-186" rx="12" ry="13.5" fill="${c}"/><path d="M32 -190Q34 -204 46 -202Q58 -200 56 -188Z" fill="${c}"/><path d="M34 -192L18 -191" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/>`
        + tr(`M30 -154L${f((30 + hx) / 2)} ${f((-154 + hy) / 2 + 14)}L${f(hx + 6)} ${f(hy + 8)}`, 13, c) + tr(`M40 -160L${f((40 + hx) / 2 + 4)} ${f((-160 + hy) / 2 + 8)}L${f(hx)} ${f(hy)}`, 12, c)
        + `<circle cx="${f(hx + 6)}" cy="${f(hy + 8)}" r="8.5" fill="${c}"/><circle cx="${f(hx)}" cy="${f(hy)}" r="8.5" fill="${c}"/>`;
      ombreSol(MECX + 4, MY, 46, 7, .75);
      a.push(`${G(MECX - 4, MY, 1)}${corps("#FFC46A")}</g>${G(MECX, MY, 1)}${corps("#0A0A0E")}</g>`); }

    // =============== 6. l'étiquette « 2027 ? » pend de la poutre, dans le faisceau du second projecteur, au-dessus de l'or révélé
    { const ex = 842, ey = 158;
      a.push(`<g transform="translate(${ex} ${ey})"><g>${an(`<animateTransform attributeName="transform" type="rotate" values="-3;3;-3" dur="3.6s" repeatCount="indefinite"/>`)}<path d="M-46 0L-42 82M46 0L42 82" stroke="#C9A24A" stroke-width="2.2"/><circle cx="-46" cy="2" r="3.5" fill="#C9A24A"/><circle cx="46" cy="2" r="3.5" fill="#C9A24A"/><g transform="translate(0 112)"><rect x="-76" y="-32" width="152" height="66" rx="8" fill="#FFF4D6" ${INK}/><circle cx="-42" cy="-28" r="3" fill="#07080B"/><circle cx="42" cy="-28" r="3" fill="#07080B"/>${txt(0, 15, "2027 ?", 44, "#C8141C", { police: "Georgia, serif", gras: 700 })}</g></g></g>`); }
    // le reflet de lumière qui glisse sur la bâche
    a.push(`<clipPath id="g5-cb"><path d="${BA}" transform="translate(${MX} ${MY}) scale(${S})"/></clipPath><g clip-path="url(#g5-cb)"><rect x="${MX - 420}" y="${MY - 190}" width="50" height="200" fill="#FFF" opacity="${K.anime ? .25 : 0}" transform="skewX(-25)">${an(`<animate attributeName="x" values="${MX - 420};${MX - 420};${MX + 300}" keyTimes="0;.55;1" dur="6s" repeatCount="indefinite"/>`)}</rect></g>`);
    a.push(`<ellipse cx="${f(MX + 300 * S)}" cy="${f(MY - 24)}" rx="80" ry="34" fill="url(#g5-lueurOr)" opacity="${O0(.6)}" style="mix-blend-mode:screen">${an(`<animate attributeName="opacity" values=".25;.85;.25" dur="2.2s" repeatCount="indefinite"/>`)}</ellipse>`);
    K.prendre(MX, MY - 80, 300);

    // =============== 7. la piste : large ruban d'asphalte, gros vibreurs simples, la ligne face à la bâche, des chevrons qui donnent le sens
    K.route([["#000", 58, ` opacity=".55" filter="url(#g5-flou)"`], ["#07080B", 50], ["#ECEEF1", 46, ` stroke-dasharray="26 26"`], ["#C81E28", 46, ` stroke-dasharray="26 26" stroke-dashoffset="26"`], ["#2C2C34", 36], ["#34343D", 28]]);
    K.depart();
    { const pas = Math.max(2, Math.round(K.N * .014)); for (let q = 1; q <= 3; q++) { const i = 3 + q * pas, [x, y] = K.P[i % K.N], [nx, ny, tx, ty] = K.nrm(i);
      s.push(`<path d="M${f(x - tx * 7 + nx * 12)} ${f(y - ty * 7 + ny * 12)}L${f(x + tx * 7)} ${f(y + ty * 7)}L${f(x - tx * 7 - nx * 12)} ${f(y - ty * 7 - ny * 12)}" stroke="#F2C230" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${(.45 + q * .15).toFixed(2)}"/>`); } }
    // une pénombre légère autour : la bâche reste le point le plus clair
    rad("nuit", [[0, "#000", 0], [.5, "#000", 0], [1, "#000", .32]], `cx="${(MX / W * 100).toFixed(1)}%" cy="${(MY / H * 100 - 10).toFixed(1)}%" r="80%"`);
    s.push(`<rect width="${W}" height="${H}" fill="url(#g5-nuit)"/>`);
    // la poussière qui danse dans les deux faisceaux
    for (let q = 0; q < 12; q++) { const x = MX - 200 + r() * 400, y = 200 + r() * 260, d = (3 + r() * 3).toFixed(1); a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 1)}" fill="#FFF3C8" opacity="${O0(.6)}">${an(`<animate attributeName="opacity" values="0;.8;0" dur="${d}s" begin="${(r() * 3).toFixed(1)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 16)} -14" dur="${d}s" repeatCount="indefinite"/>`)}</circle>`); }
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#1A1826"/>`, "#120A22", .06); RES.portraits = PORTR; RES.lieux = { bache: [MX, MY - 80] }; return RES;
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
    const K = kit(T, def, 52, "c5-"), { s, a, r, f, W, H, P, N } = K, an = x => K.anime ? x : "", CJ = COULEURS_J;
    const OR = "#F2C64A";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const LUM = [], SOMB = [];   // fenêtres allumées (halo posé après coup) / éteintes (certaines s'allument dans la couche animée)
    const fen = (x, y, w, h, lit) => { if (lit) LUM.push([x, y + h / 2, w * 2.2]); else if (r() < .3) SOMB.push([x, y]); return `<path d="M${f(x - w / 2)} ${f(y + h)}V${f(y + w / 2)}a${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(w)} 0V${f(y + h)}Z" fill="${lit ? "#D9A050" : "#0C1024"}"/>`; };
    // ---- 0. dégradés (pierre du château volontairement sourde et froide : la Grande Salle est le seul point chaud)
    s.push(`<linearGradient id="c5-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050818"/><stop offset=".25" stop-color="#0C1434"/><stop offset=".48" stop-color="#1B2A5E"/><stop offset=".56" stop-color="#2A3F78"/><stop offset=".6" stop-color="#16213F"/><stop offset="1" stop-color="#0B1222"/></linearGradient>`);
    s.push(`<linearGradient id="c5-pi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A688E"/><stop offset=".3" stop-color="#3A4566"/><stop offset=".7" stop-color="#232B48"/><stop offset="1" stop-color="#12172C"/></linearGradient>`);
    s.push(`<linearGradient id="c5-pi2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#48557A"/><stop offset=".6" stop-color="#2B3352"/><stop offset="1" stop-color="#161B34"/></linearGradient>`);
    s.push(`<linearGradient id="c5-to" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A4672"/><stop offset=".45" stop-color="#20284C"/><stop offset="1" stop-color="#0C1026"/></linearGradient>`);
    s.push(`<linearGradient id="c5-ro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E4868"/><stop offset=".4" stop-color="#1E2540"/><stop offset="1" stop-color="#090C18"/></linearGradient>`);
    s.push(`<linearGradient id="c5-lac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2C58"/><stop offset=".35" stop-color="#0D1836"/><stop offset="1" stop-color="#050A18"/></linearGradient>`);
    s.push(`<linearGradient id="c5-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E3238"/><stop offset="1" stop-color="#0C171C"/></linearGradient>`);
    s.push(`<linearGradient id="c5-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".4" stop-color="#E8B83A"/><stop offset=".8" stop-color="#A8741E"/><stop offset="1" stop-color="#6A440E"/></linearGradient>`);
    s.push(`<radialGradient id="c5-vitre" cx="50%" cy="62%" r="60%"><stop offset="0" stop-color="#FFF4C8"/><stop offset=".45" stop-color="#FFC45A"/><stop offset=".85" stop-color="#D9782E"/><stop offset="1" stop-color="#8A3A1E"/></radialGradient>`);
    s.push(`<radialGradient id="c5-lune" r="50%"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".7" stop-color="#F2EBCB"/><stop offset="1" stop-color="#D8CFAA"/></radialGradient>`);
    s.push(`<radialGradient id="c5-brume" r="50%"><stop offset="0" stop-color="#8FA8E0" stop-opacity=".35"/><stop offset="1" stop-color="#8FA8E0" stop-opacity="0"/></radialGradient>`);

    // ---- 1. le ciel : étoiles, voie lactée, lune (cadrée par la boucle haut-gauche du tracé)
    s.push(`<path d="M0 30Q300 140 560 60T1080 120" stroke="#9FB4FF" stroke-width="70" opacity=".05" fill="none" filter="url(#c5-flou8)"/>`);
    for (let k = 0; k < 240; k++) { const x = r() * W, y = r() * 380, t = r(); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(t < .9 ? .5 + r() * .7 : 1.3 + r())}" fill="${t < .8 ? "#E8EEFF" : "#FFF2C8"}" opacity="${f(.3 + r() * .6)}"/>`); }
    const LX = 255, LY = 160;
    K.halo(LX, LY, 220, "#9FB8F0", .38); K.halo(LX, LY, 84, "#FFF6D8", .55);
    s.push(`<circle cx="${LX}" cy="${LY}" r="34" fill="url(#c5-lune)"/><circle cx="${LX - 9}" cy="${LY - 6}" r="6.5" fill="#D8CFAA" opacity=".5"/><circle cx="${LX + 11}" cy="${LY + 9}" r="8.5" fill="#D8CFAA" opacity=".4"/><circle cx="${LX + 4}" cy="${LY - 15}" r="3.8" fill="#D8CFAA" opacity=".45"/>`);
    s.push(`<path d="M186 186q30 -10 60 -2q30 -10 70 2q-40 8 -130 0z" fill="#3A4C80" opacity=".55"/>`);

    // ---- 2. les montagnes au loin et la brume de l'horizon
    s.push(`<path d="M0 330L60 296L120 318L190 270L250 300L300 286L360 318L420 300L470 330L560 310L640 322L720 288L790 300L850 262L920 296L990 274L1080 300V420H0Z" fill="#1A2652"/><path d="M0 330L60 296L120 318L190 270L250 300L300 286L360 318M720 288L790 300L850 262L920 296L990 274L1080 300" fill="none" stroke="#5A72B4" stroke-width="1.4" opacity=".5"/>`);
    s.push(`<path d="M0 360L80 336L150 352L230 330L330 356L460 344L600 352L760 330L880 344L1000 326L1080 340V430H0Z" fill="#14203F"/>`);
    s.push(`<ellipse cx="540" cy="360" rx="620" ry="34" fill="url(#c5-brume)"/>`);

    // ---- 3. le sol : plateau à gauche, colline de la forêt à droite
    s.push(`<path d="M0 410C90 392 260 386 360 420L372 552H0Z" fill="url(#c5-sol)"/><path d="M0 410C90 392 260 386 360 420" stroke="#4E6A88" stroke-width="1.5" opacity=".5" fill="none"/>`);
    s.push(`<path d="M760 330C820 300 930 286 1080 296V552H790Z" fill="url(#c5-sol)"/>`);

    // ---- 4. la forêt interdite, dans l'ombre
    const sapin = (x, y, h, c, lu) => { const w = h * .42; let d = `M${f(x)} ${f(y - h)}`; for (let e = 0; e < 4; e++) { const yy = y - h + (e + 1) * h / 4, ww = w * (e + 1) / 4; d += `L${f(x + ww)} ${f(yy)}L${f(x + ww * .45)} ${f(yy - 2)}`; } for (let e = 3; e >= 0; e--) { const yy = y - h + (e + 1) * h / 4, ww = w * (e + 1) / 4; d += `L${f(x - ww * .45)} ${f(yy - 2)}L${f(x - ww)} ${f(yy)}`; } return `<path d="${d}Z" fill="${c}"/>` + (lu ? `<path d="M${f(x)} ${f(y - h)}L${f(x - w * .25)} ${f(y - h * .75)}" stroke="#6A86C0" stroke-width="1.2" opacity=".5"/>` : ""); };
    for (let rang = 0; rang < 4; rang++) for (let k = 0; k < 16; k++) { const x = 790 + k * 11.5 + r() * 8 + rang * 4, y = 340 + rang * 34 + r() * 14 - (x - 780) * .08 + (k % 2) * 6; if (x > 940) continue; s.push(sapin(x, y, 46 + r() * 30 - rang * 2, ["#0F2230", "#0C1C28", "#0A1822", "#08131C"][rang], rang === 0 && r() < .5)); }

    // ---- 5. le château, à l'arrière-plan : sourd, bleu, ses flèches logées DANS les boucles du tracé (jamais par-dessus la route)
    const libre = pts => pts.every(([x, y]) => K.dT(x, y) > 24);
    const tour = (x, yb, w, yt, rh, o) => { o = o || {}; while (!libre([[x, yt - 4 - rh], [x - w / 2 - 5, yt - 4], [x + w / 2 + 5, yt - 4], [x - w / 4, yt - 4 - rh / 2], [x + w / 4, yt - 4 - rh / 2]]) && yt < yb - 40) yt += 4;
      let g = `<rect x="${f(x - w / 2)}" y="${f(yt)}" width="${f(w)}" height="${f(yb - yt)}" fill="url(#c5-pi)"/><rect x="${f(x - w / 2 - 3)}" y="${f(yt - 5)}" width="${f(w + 6)}" height="7" fill="url(#c5-pi)"/>`;
      g += `<path d="M${f(x - w / 2 - 5)} ${f(yt - 4)}L${f(x)} ${f(yt - 4 - rh)}L${f(x + w / 2 + 5)} ${f(yt - 4)}Z" fill="url(#c5-to)"/><path d="M${f(x - w / 2 - 5)} ${f(yt - 4)}L${f(x)} ${f(yt - 4 - rh)}" stroke="#8EA2D4" stroke-width="1.1" opacity=".5"/>`;
      const n = w > 30 ? 2 : 1; for (let y = yt + 12; y < yb - 14; y += o.pas || 26) for (let j = 0; j < n; j++) g += fen(n === 1 ? x : x + (j ? w * .2 : -w * .2), y, 4.4, 8.6, r() < (o.lum === undefined ? .16 : o.lum));
      return g + `<path d="M${f(x - w / 2 + .8)} ${f(yt)}V${f(yb)}" stroke="#A8BCE8" stroke-width="1.2" opacity=".3"/>`; };
    const bloc = (x0, x1, yb, yt, rh, o) => { o = o || {}; const w = x1 - x0; let g = `<rect x="${f(x0)}" y="${f(yt)}" width="${f(w)}" height="${f(yb - yt)}" fill="url(#c5-pi2)"/>`;
      g += `<path d="M${f(x0 - 3)} ${f(yt)}L${f(x0 + w * .06)} ${f(yt - rh)}L${f(x1 - w * .06)} ${f(yt - rh)}L${f(x1 + 3)} ${f(yt)}Z" fill="url(#c5-to)"/><path d="M${f(x0 + w * .06)} ${f(yt - rh)}H${f(x1 - w * .06)}" stroke="#8EA2D4" stroke-width="1" opacity=".4"/>`;
      for (let y = yt + 12; y < yb - 14; y += o.pas || 26) for (let x = x0 + 9; x < x1 - 5; x += o.ec || 15) g += fen(x, y, 4.4, 8.6, r() < (o.lum === undefined ? .16 : o.lum));
      return g + `<path d="M${f(x0 + .8)} ${f(yt)}V${f(yb)}" stroke="#A8BCE8" stroke-width="1.2" opacity=".28"/>`; };
    const CX = 527;   // axe du château = axe de la boucle du milieu
    s.push("<!--C0-->");
    { const n0 = LUM.length, n1 = SOMB.length; s.push(`<g opacity=".55">` + bloc(420, 720, 505, 310, 18, { lum: .1, pas: 28, ec: 18 }) + tour(470, 505, 22, 250, 46, { lum: .1 }) + tour(590, 505, 22, 246, 48, { lum: .1 }) + tour(735, 505, 26, 268, 44, { lum: .1 }) + `</g>`); LUM.splice(n0); SOMB.splice(n1); }
    s.push(tour(CX, 505, 58, 232, 96, { lum: .18 }));                 // le donjon, pointe dans la boucle du milieu
    s.push(tour(796, 505, 30, 196, 80, { lum: .18 }));                // la tour d'astronomie, dans la boucle de droite
    s.push(tour(392, 505, 30, 250, 60, { lum: .18 }) + tour(664, 505, 32, 250, 62, { lum: .18 }));   // tours sous les creux du tracé (abaissées)
    s.push(tour(470, 505, 14, 300, 54, { pas: 30 }) + tour(586, 505, 14, 296, 56, { pas: 30 }) + tour(712, 505, 13, 290, 54, { pas: 30 }));
    s.push(bloc(360, 452, 505, 396, 22) + bloc(602, 770, 505, 382, 24));
    s.push(tour(440, 505, 24, 330, 46) + tour(740, 505, 28, 316, 52));
    // la Grande Salle : façade à pignon et UNE grande verrière gothique allumée de l'intérieur (à l'échelle de la façade)
    { const x0 = CX - 86, x1 = CX + 86, yt = 344, vw = 33, vb = 486, vt = 350;
      s.push(`<path d="M${x0} 505V${yt}L${CX} ${yt - 50}L${x1} ${yt}V505Z" fill="url(#c5-pi2)"/><path d="M${x0 - 6} ${yt + 2}L${CX} ${yt - 54}L${x1 + 6} ${yt + 2}" stroke="url(#c5-to)" stroke-width="9" fill="none" stroke-linejoin="round"/><path d="M${x0 - 6} ${yt + 2}L${CX} ${yt - 54}" stroke="#8EA2D4" stroke-width="1.2" opacity=".5" fill="none"/>`);
      [x0 + 4, x1 - 4].forEach(x => s.push(`<path d="M${x - 6} 505V${yt - 4}l6 -14l6 14V505Z" fill="#323C60"/>`));
      [x0 + 26, x1 - 26].forEach(x => s.push(`<path d="M${x - 7} 470V420a7 7 0 0 1 14 0V470Z" fill="#B87A3A"/><path d="M${x - 7} 470V420a7 7 0 0 1 14 0V470Z" fill="none" stroke="#1A2040" stroke-width="2"/>`));
      const arc = `M${CX - vw} ${vb}V${vt + 40}Q${CX - vw} ${vt} ${CX} ${vt - 14}Q${CX + vw} ${vt} ${CX + vw} ${vt + 40}V${vb}Z`;
      K.halo(CX, 420, 150, "#FFB347", .42);
      s.push(`<path d="${arc}" fill="url(#c5-vitre)"/>`);
      // vitraux : quelques losanges teintés, puis les silhouettes des bougies vues à travers le verre
      for (let k = 0; k < 22; k++) { const x = CX - vw + 6 + r() * (2 * vw - 12), y = vt + 10 + r() * (vb - vt - 20); s.push(`<path d="M${f(x)} ${f(y - 5)}l4 5l-4 5l-4 -5z" fill="${["#E8603A", "#F2C64A", "#C8783A", "#FFE6A0"][k % 4]}" opacity=".35"/>`); }
      for (let k = 0; k < 7; k++) { const x = CX - vw + 8 + k * (2 * vw - 16) / 6, y = vt + 46 + (k % 3) * 16 + r() * 6; s.push(`<rect x="${f(x - 1.6)}" y="${f(y)}" width="3.2" height="9" fill="#5A2A14" opacity=".75"/>`); }
      s.push(`<rect x="${CX - vw}" y="${vb - 18}" width="${2 * vw}" height="18" fill="#6A3A1C" opacity=".8"/>`);
      // remplage gothique : meneaux, traverses, rosace
      s.push(`<path d="${arc}" fill="none" stroke="#1A2040" stroke-width="5"/><path d="M${CX} ${vb}V${vt + 18}M${CX - vw / 2} ${vb}V${vt + 34}M${CX + vw / 2} ${vb}V${vt + 34}M${CX - vw} ${vt + 78}H${CX + vw}M${CX - vw} ${vt + 112}H${CX + vw}" stroke="#1A2040" stroke-width="2.6"/><circle cx="${CX}" cy="${vt + 12}" r="9" fill="none" stroke="#1A2040" stroke-width="2.4"/><path d="M${CX - 9} ${vt + 12}H${CX + 9}M${CX} ${vt + 3}V${vt + 21}" stroke="#1A2040" stroke-width="1.6"/>`);
      s.push(`<path d="M${CX - vw - 4} ${vb + 3}H${CX + vw + 4}" stroke="#7A86B0" stroke-width="5"/>`);
    }
    s.push(tour(358, 520, 28, 380, 50) + tour(800, 518, 32, 362, 58));
    s.push(`<path d="M340 520H820V530H340Z" fill="#232C4C"/>${Array.from({ length: 52 }, (_, q) => `<rect x="${340 + q * 9.2}" y="514" width="5" height="6" fill="#323C60"/>`).join("")}`);
    s.push("<!--C1-->");
    { const i0 = s.indexOf("<!--C0-->"), i1 = s.indexOf("<!--C1-->"); s.splice(i0, i1 - i0 + 1, `<g id="c5-chat">${s.slice(i0 + 1, i1).join("")}</g>`); }
    s.push(`<path d="M314 556L334 536L360 528H812L838 534L862 556Z" fill="url(#c5-ro)"/><path d="M334 536L360 528H812L838 534" stroke="#7A8CB8" stroke-width="1.2" opacity=".4" fill="none"/>`);
    LUM.forEach(([x, y, R]) => K.halo(x, y, R * .7, "#FFB347", .16));
    s.push(`<path d="M${CX - 40} 530L${CX + 40} 530L${CX + 110} 556H${CX - 110}Z" fill="#FFC85A" opacity=".14"/>`);

    // ---- 6. le lac noir, miroir calme : château, lune, Grande Salle (et plus bas, le peloton)
    const WL = 550, MIR = 612;
    s.push(`<linearGradient id="c5-lac2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050A18" stop-opacity=".1"/><stop offset="1" stop-color="#03060F" stop-opacity=".7"/></linearGradient>`);
    s.push(`<rect x="0" y="${WL}" width="${W}" height="${H - WL}" fill="url(#c5-lac)"/><clipPath id="c5-eau"><rect x="0" y="${WL}" width="${W}" height="${H - WL}"/></clipPath><clipPath id="c5-eau2"><rect x="0" y="${MIR + 14}" width="${W}" height="${H - MIR}"/></clipPath>`);
    s.push(`<g clip-path="url(#c5-eau)" opacity=".5" filter="url(#c5-flou)"><use href="#c5-chat" transform="translate(0 ${2 * WL}) scale(1 -1)"/></g>`);
    for (let k = 0; k < 46; k++) { const y = WL + 6 + k * 3.7, x = r() * W; s.push(`<path d="M${f(x)} ${f(y)}h${f(40 + r() * 160)}" stroke="#08102A" stroke-width="${f(1 + k * .03)}" opacity=".5"/>`); }
    s.push(`<rect x="0" y="${WL}" width="${W}" height="${H - WL}" fill="url(#c5-lac2)"/><path d="M0 ${WL}H${W}" stroke="#7A90C8" stroke-width="1.2" opacity=".4"/>`);
    for (let k = 0, y = WL + 6; y < H - 6; k++) { const w = 14 + r() * (34 - k * .8); s.push(`<path d="M${f(LX - w / 2 + (r() - .5) * 18)} ${f(y)}h${f(w)}" stroke="#F6EED2" stroke-width="${f(1 + r() * 1.4)}" opacity="${f(Math.max(.08, .45 - k * .02) * (.5 + r() * .5))}" stroke-linecap="round"/>`); y += 4 + r() * 9; }
    for (let k = 0; k < 26; k++) { const x = CX - 50 + r() * 100, y = WL + 12 + r() * 150; s.push(`<path d="M${f(x)} ${f(y)}h${f(5 + r() * 14)}" stroke="#FFC85A" stroke-width="1.6" opacity="${f(.2 + r() * .3)}" stroke-linecap="round"/>`); }
    // le reflet du peloton (copie retournée, floue, 30 %) : la bande du bas fait partie de la scène
    s.push(`<g clip-path="url(#c5-eau2)" opacity=".3" filter="url(#c5-flou)"><use href="#c5-her" transform="translate(0 ${2 * MIR}) scale(1 -1)"/></g>`);

    // ---- 7. les traînées de lumière du peloton (sous la route : la piste reste continue)
    // pilotes [x, y, échelle, joueur, inclinaison] du plus loin au plus près ; Théo en tête cabre vers le vif d'or
    const HER = [[262, 318, 2.1, 3, 17], [352, 420, 2.75, 2, 12], [396, 540, 3.45, 1, 6], [778, 472, 5.2, 0, -9]];
    const loc = (x, y, S, ro, u, v) => { const c = Math.cos(ro * PI / 180), si = Math.sin(ro * PI / 180); return [x + S * (u * c - v * si), y + S * (u * si + v * c)]; };
    const TR = [], HERS = [];
    HER.forEach(([x, y, S, k, ro]) => { const c = CJ[k], co = Math.cos(ro * PI / 180), si = Math.sin(ro * PI / 180), [tx, ty] = loc(x, y, S, ro, -50, 3), Lg = 120 + 70 * S, ex = tx - co * Lg, ey = ty - si * Lg, w = 5 * S, nx = -si * w, ny = co * w;
      TR.push(`<linearGradient id="c5-tr${k}" gradientUnits="userSpaceOnUse" x1="${f(tx)}" y1="${f(ty)}" x2="${f(ex)}" y2="${f(ey)}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".45" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient><linearGradient id="c5-tw${k}" gradientUnits="userSpaceOnUse" x1="${f(tx)}" y1="${f(ty)}" x2="${f(ex)}" y2="${f(ey)}"><stop offset="0" stop-color="#FFFBEA" stop-opacity=".95"/><stop offset=".6" stop-color="#FFFBEA" stop-opacity="0"/></linearGradient>`);
      let g = `<path d="M${f(tx + nx * 1.6)} ${f(ty + ny * 1.6)}L${f(ex)} ${f(ey)}L${f(tx - nx * 1.6)} ${f(ty - ny * 1.6)}Z" fill="url(#c5-tr${k})" opacity=".5" filter="url(#c5-flou8)"/><path d="M${f(tx + nx)} ${f(ty + ny)}L${f(ex)} ${f(ey)}L${f(tx - nx)} ${f(ty - ny)}Z" fill="url(#c5-tr${k})"/><path d="M${f(tx)} ${f(ty)}L${f(ex)} ${f(ey)}" stroke="url(#c5-tw${k})" stroke-width="${f(S * 1.1)}" stroke-linecap="round"/>`;
      for (let q = 0; q < 7; q++) { const t = .12 + r() * .7, j = (r() - .5) * w * 2.4; g += `<circle cx="${f(tx - co * Lg * t - si * j)}" cy="${f(ty - si * Lg * t + co * j)}" r="${f(.6 + r() * S * .3)}" fill="#FFF6D8" opacity="${f(.35 + r() * .5)}"/>`; }
      HERS.push(g); });
    TR.forEach(t => s.push(t));

    // ---- 8. la piste : une voie aérienne d'or, balisée d'anneaux, avec l'arche de départ
    K.route([["#000", 44, ` opacity=".45" filter="url(#c5-flou8)"`], ["#FFD27A", 34, ` opacity=".12"`], ["url(#c5-or)", 27, ` opacity=".95"`], ["#121A3C", 22, ` opacity=".92"`], ["#2A3A78", 10, ` opacity=".35"`]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#FFE6A8" stroke-width="2.2" stroke-dasharray="2 13" stroke-linecap="round" opacity=".8"/>`);
    K.depart();
    const idx = fr => ((Math.floor(fr * N) % N) + N) % N;
    [.2, .32, .405, .5, .59, .7, .78].forEach(fr => { const i = idx(fr), [, , tx, ty] = K.nrm(i), an2 = Math.atan2(ty, tx) * 57.3, [x, y] = P[i];
      s.push(`${G(x, y, 1, an2)}<ellipse rx="5" ry="20" fill="none" stroke="#000" stroke-width="4.5" opacity=".4"/><ellipse rx="5" ry="20" fill="none" stroke="url(#c5-or)" stroke-width="3"/><ellipse rx="5" ry="20" fill="none" stroke="#FFF6D8" stroke-width=".8" opacity=".7"/></g>`); K.halo(x, y, 26, "#FFD27A", .28); });
    // arche de départ : grand anneau d'or, deux torches, bannière aux 4 couleurs (sans texte)
    const [DX, DY] = P[0];
    s.push(`<ellipse cx="${f(DX)}" cy="${f(DY)}" rx="10" ry="34" fill="none" stroke="#000" stroke-width="7" opacity=".45"/><ellipse cx="${f(DX)}" cy="${f(DY)}" rx="10" ry="34" fill="none" stroke="url(#c5-or)" stroke-width="5"/><ellipse cx="${f(DX)}" cy="${f(DY)}" rx="10" ry="34" fill="none" stroke="#FFF6D8" stroke-width="1" opacity=".7"/>`);
    [-1, 1].forEach(sg => s.push(`<path d="M${f(DX)} ${f(DY + sg * 34)}v${sg * 12}" stroke="#5A3A1A" stroke-width="4" stroke-linecap="round"/><path d="M${f(DX - 5)} ${f(DY + sg * 34 + (sg < 0 ? -2 : 12))}h10l-2 ${sg < 0 ? -4 : 4}h-6z" fill="#8A6A2A"/>`));
    s.push(`<path d="M${f(DX + 2)} ${f(DY - 44)}l44 3l-7 8l7 8l-44 -3z" fill="#1A1630"/>${[0, 1, 2, 3].map(q => `<path d="M${f(DX + 4 + q * 9)} ${f(DY - 43.6 + q * .6)}l8 .6v15l-8 -.6z" fill="${CJ[q]}" opacity=".95"/>`).join("")}<path d="M${f(DX + 2)} ${f(DY - 44)}l44 3" stroke="#FFE6A8" stroke-width=".8" opacity=".7"/>`);
    K.halo(DX, DY - 52, 34, "#FFB347", .6); K.halo(DX, DY + 52, 34, "#FFB347", .5);

    // ---- 9. LES HÉROS : 4 pilotes en grand, en position de jockey, liserés de lune (l'appli pose leurs portraits sur les têtes)
    const PEAU = ["#F2CDB0", "#D9A27A", "#F5D4BC", "#C98E66"], CHEV = ["#5A3A1E", "#1A1410", "#C88A3A", "#8A3A1A"], LU = "#C8D8FF", ROBE = "#3A3264", ROBE2 = "#16122A";
    const HX = 14, HY = -17.5, HR = 5.6, PORTR = [], PIL = [];
    const pilote = (k, c) => {
      const jambe = (h, kn, an, col) => `<path d="M${h}L${kn}L${an}" stroke="${col}" stroke-width="4.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<path d="M-27 3.2L29 -1" stroke="#7A4E22" stroke-width="3" stroke-linecap="round"/><path d="M-27 2.3L29 -1.9" stroke="#D8B070" stroke-width=".8" stroke-linecap="round" opacity=".8"/><circle cx="29" cy="-1" r="1.8" fill="#5A3A1A"/>` +
        `<path d="M-25 3L-50 -8Q-57 3 -50 15Z" fill="#A8823E" stroke="#3A2414" stroke-width="1"/><path d="M-30 2L-50 -4M-30 4L-50 10M-28 3H-53" stroke="#6A4A1A" stroke-width=".9"/><path d="M-26 -1V7" stroke="#C9A24A" stroke-width="2.4"/><path d="M-25 3L-50 -8" stroke="${LU}" stroke-width=".8" opacity=".6"/>` +
        // jambe lointaine, repliée en arrière
        jambe("-8 -1", "-1 6.5", "-16 9", ROBE2) + `<path d="M-16 9l-5 .6" stroke="#3A2010" stroke-width="3.6" stroke-linecap="round"/>` +
        // la cape qui claque au vent : doublure à la couleur du pilote, liseré de lune sur le dessus
        `<path d="M9 -14C0 -21 -16 -22 -30 -18L-38 -19L-31 -14L-40 -12L-29 -9C-20 -6 -14 -4 -8 -3Z" fill="${ROBE2}"/><path d="M-40 -12L-29 -9C-20 -6 -14 -4 -8 -3L-9 -6C-16 -7 -22 -9 -30 -12Z" fill="${c}" opacity=".95"/><path d="M9 -14C0 -21 -16 -22 -30 -18L-38 -19" stroke="${LU}" stroke-width="1.2" fill="none" opacity=".95"/><path d="M-4 -16C-14 -18 -22 -17 -28 -15" stroke="#3E3866" stroke-width="1" fill="none"/>` +
        // le buste couché sur le manche
        `<path d="M-13 1C-13 -8 -2 -15 9 -14.5L12 -9C5 -7 -1 -3 -3 2Z" fill="${ROBE}"/><path d="M-13 0C-12 -8 -2 -14.6 9 -14.5" stroke="${LU}" stroke-width="1.1" fill="none" opacity=".9"/>` +
        // jambe proche, repliée, botte en arrière
        jambe("-8 0.5", "0 8", "-14 10.5", "#2E2850") + `<path d="M-14 10.5l-6 .8" stroke="#6A3A1A" stroke-width="4" stroke-linecap="round"/><path d="M-8 -1.5L0 6" stroke="${LU}" stroke-width=".8" opacity=".55"/>` +
        // bras : les deux mains sur le manche
        `<path d="M8 -12L14 -6L20 -1.5" stroke="#1E1A32" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 -11L12 -5L18 -1" stroke="${ROBE}" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.6" cy="-1" r="1.9" fill="${PEAU[k]}"/><circle cx="21" cy="-1.4" r="1.7" fill="${mixHex(PEAU[k], "#000000", .2)}"/>` +
        // écharpe nouée au cou
        `<path d="M8.5 -14.5l5 -1.2l1 2.6l-5 1.4z" fill="${c}"/>` +
        // la tête de profil (nez, menton, oreille, cheveux), cerclée de la couleur du pilote
        `<circle cx="${HX}" cy="${HY}" r="${HR + .9}" fill="${c}"/><path d="M${HX - HR} ${HY}A${HR} ${HR} 0 1 1 ${HX + HR - .2} ${HY + 1.4}L${HX + HR + 1.9} ${HY + .6}L${HX + HR - .3} ${HY + 2.6}Q${HX + HR - 1} ${HY + 4.6} ${HX + 1.5} ${HY + HR - .2}A${HR} ${HR} 0 0 1 ${HX - HR} ${HY}Z" fill="${PEAU[k]}" stroke="#0A0814" stroke-width=".5"/>` +
        `<path d="M${HX + 4} ${HY - 4}C${HX + 1} ${HY - 7.6} ${HX - 6} ${HY - 6.4} ${HX - 5.9} ${HY + .5}C${HX - 5} ${HY + 3} ${HX - 3.4} ${HY + 4} ${HX - 2.6} ${HY + 4.4}C${HX - 2.6} ${HY + 1} ${HX - .8} ${HY - 1.6} ${HX + .6} ${HY - 2.2}C${HX + 2} ${HY - 3} ${HX + 3.6} ${HY - 2.4} ${HX + 5} ${HY - 2}Z" fill="${CHEV[k]}"/><circle cx="${HX - .8}" cy="${HY + .8}" r="1.1" fill="${mixHex(PEAU[k], "#000000", .25)}"/><circle cx="${HX + 3.4}" cy="${HY - .6}" r=".7" fill="#0A0814"/>` +
        `<path d="M${HX - 5.9} ${HY + .5}C${HX - 5.6} ${HY - 5.4} ${HX - 1} ${HY - 7.4} ${HX + 3} ${HY - 5.6}" stroke="${LU}" stroke-width=".9" fill="none" opacity=".85"/>`;
    };
    HER.forEach(([x, y, S, k, ro], q) => {
      const tmp = []; K.halo(x - 6 * S, y - 8 * S, 18 * S, CJ[k], .22, tmp);
      PIL.push(tmp.join("") + `${G(x, y, S, ro)}${pilote(k, CJ[k])}</g>`);
      const [px, py] = loc(x, y, S, ro, HX, HY); PORTR.push({ k, x: +px.toFixed(1), y: +py.toFixed(1), r: +(HR * S).toFixed(1) }); });
    s.push(`<g id="c5-her">${HERS.join("")}${PIL.join("")}</g>`);

    // ================= COUCHE ANIMÉE =================
    a.push(`<radialGradient id="c5-flamme" r="50%"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".35" stop-color="#FFC85A" stop-opacity=".8"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>`);
    // les bougies flottantes, vues à travers la verrière (deux groupes qui ondulent)
    [0, 1].forEach(g => { let c = ""; for (let k = 0; k < 6; k++) { const x = CX - 24 + r() * 48, y = 372 + r() * 64; c += `<circle cx="${f(x)}" cy="${f(y - 3)}" r="4.4" fill="url(#c5-flamme)"/><ellipse cx="${f(x)}" cy="${f(y - 2.6)}" rx="1.1" ry="2" fill="#FFF8DC"/>`; }
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${3 + g * 1.3}s" repeatCount="indefinite"/>`)}${c}</g>`); });
    // quelques fenêtres qui s'allument doucement
    SOMB.filter((_, i) => i % 3 === 0).slice(0, 4).forEach(([x, y], k) => a.push(`<rect x="${f(x - 2.2)}" y="${f(y)}" width="4.4" height="8.6" fill="#E0A85A" opacity="${K.anime ? 0 : .7}">${an(`<animate attributeName="opacity" values="0;.8;.8;0;0" keyTimes="0;.1;.5;.6;1" dur="${5 + k * 1.7}s" begin="${k * 1.3}s" repeatCount="indefinite"/>`)}</rect>`));
    // les torches de l'arche de départ
    [-1, 1].forEach((sg, q) => { const y = DY + sg * (sg < 0 ? 52 : 52); a.push(`<g transform="translate(${f(DX)} ${f(y)})"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;.85 1.18;1.1 .9;1 1" dur="${.7 + q * .2}s" repeatCount="indefinite"/>`)}<circle r="11" fill="url(#c5-flamme)"/><path d="M0 -10C4 -4 5 0 0 4C-5 0 -4 -4 0 -10Z" fill="#FFB347"/><path d="M0 -5C2 -2 2 1 0 3C-2 1 -2 -2 0 -5Z" fill="#FFF6D0"/></g></g>`); });
    // les écharpes qui claquent au vent, et la lumière qui file le long des traînées
    HER.forEach(([x, y, S, k, ro], q) => { const c = CJ[k], c2 = mixHex(c, "#101020", .55), v1 = "M11 -14Q0 -20 -12 -16T-32 -19", v2 = "M11 -14Q0 -11 -12 -17T-32 -13", d = (.6 + q * .05).toFixed(2);
      a.push(`<g transform="translate(${f(x)} ${f(y)}) scale(${S}) rotate(${ro})"><path d="${v1}" stroke="${c}" stroke-width="3.6" fill="none" stroke-linecap="round">${an(`<animate attributeName="d" values="${v1};${v2};${v1}" dur="${d}s" repeatCount="indefinite"/>`)}</path><path d="${v1}" stroke="${c2}" stroke-width="3.6" fill="none" stroke-dasharray="2.5 4">${an(`<animate attributeName="d" values="${v1};${v2};${v1}" dur="${d}s" repeatCount="indefinite"/>`)}</path></g>`);
      const co = Math.cos(ro * PI / 180), si = Math.sin(ro * PI / 180), [tx, ty] = loc(x, y, S, ro, -50, 3), Lg = (120 + 70 * S) * .75; a.push(`<path d="M${f(tx)} ${f(ty)}l${f(-co * Lg)} ${f(-si * Lg)}" stroke="#FFF6D8" stroke-width="${f(S * .7)}" stroke-linecap="round" stroke-dasharray="${f(S * 4)} ${f(S * 16)}" opacity=".7">${an(`<animate attributeName="stroke-dashoffset" values="0;${f(-S * 20)}" dur=".5s" repeatCount="indefinite"/>`)}</path>`); });
    // le vif d'or, devant Théo, dans l'axe de son regard : il tire le peloton
    { const [vx, vy] = loc(HER[3][0], HER[3][1], HER[3][2], HER[3][4], 36, -24);
      a.push(`<g transform="translate(${f(vx)} ${f(vy)})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;6 -5;-3 4;0 0" dur="1.6s" repeatCount="indefinite"/>`)}<circle r="34" fill="url(#c5-flamme)"/><circle r="10" fill="${OR}" stroke="#8A5A14" stroke-width="1.2"/><path d="M-7 -3Q0 -6 7 -3M-7 3Q0 6 7 3" stroke="#B88A2A" stroke-width="1" fill="none"/><circle cx="-3.2" cy="-3.2" r="3" fill="#FFF6D0"/>` +
        `<g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .15;1 1" dur=".22s" repeatCount="indefinite"/>`)}<path d="M-4 -4C-20 -30 -42 -26 -50 -18C-34 -17 -20 -12 -4 -4ZM4 -4C-2 -30 12 -38 24 -34C16 -24 12 -14 4 -4Z" fill="#F4F0E2" opacity=".92"/></g></g></g>`); }
    // des chevrons d'or qui filent sur la voie, dans le sens de la course
    [[.1, 0], [.35, 6], [.6, 12], [.85, 18]].forEach(([fr, deb]) => a.push(K.surPiste(fr, `<path d="M-14 -7L-6 0L-14 7M-4 -7L4 0L-4 7" stroke="#FFD27A" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/><path d="M-14 -7L-6 0L-14 7M-4 -7L4 0L-4 7" stroke="#FFF2B8" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, 24, deb)));
    K.particules(10, "#FFF2C8", 1.6, "scintille");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#c5-ciel)"/>`, "#1A1440", .1); RES.portraits = PORTR; return RES;
  }

  /* ---------- Mars · Le pays des merveilles (v3 : grandes scènes en gravures colorées, d'après le livre de 1865) ----------
     Au centre la mare de larmes (Alice y nage, la course au caucus tourne autour, une larme géante y tombe) ; au-dessus, le terrier
     vertigineux où tout tombe en spirale ; en bas le grand goûter du Chapelier avec 4 chaises réservées aux pilotes (cadres PORTR) ;
     à droite la Reine de cœur et son croquet aux flamants ; la Chenille sur son champignon ; la maison du Lapin où Alice a trop grandi ;
     dehors : le château de cœur, la petite porte et « BOIS-MOI », le jardin des fleurs qui parlent, le quadrille des homards au bord de mer.
     Le Chat apparaît et disparaît d'un coin à l'autre, il ne laisse que son sourire. */
  function peindreGouter(T, Z, def) {
    /* Mars · « Le Grand Goûter » : une seule scène — le Chapelier fou, immense, verse le thé dans la flaque au milieu de la nappe ;
       soleil doré d'après-midi en haut à gauche, longues ombres vers le bas à droite. Lecture dans le sens de la course (horaire, départ en haut). */
    const K = kit(T, def, 1866, "gt-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", vu = v0 => K.anime ? v0 : 1;
    const ENC = "#3A2420", INK = `stroke="${ENC}" stroke-width="1.3" stroke-linejoin="round"`, PEAU = "#F6D3B8", ROUGE = "#D21E3A", NOIR = "#1E1A24", OR = "#E8B83A";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    // une seule lumière : longues ombres portées vers le bas à droite (h = hauteur de l'objet)
    const ombreL = (x, y, w, h, op) => { const cx = x + h * .3, cy = y + h * .12; return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(h * .38 + w * .3)}" ry="${f(w * .3)}" transform="rotate(26 ${f(cx)} ${f(cy)})" fill="#4A1424" opacity="${op || .3}" filter="url(#gt-flou)"/>`; };
    const SYM = { c: "M0 .9C-.1 .7 -1 .2 -1 -.3C-1 -.8 -.4 -1 0 -.55C.4 -1 1 -.8 1 -.3C1 .2 .1 .7 0 .9Z", k: "M0 -1L.72 0L0 1L-.72 0Z",
      p: "M0 -1C-.1 -.8 -1 -.3 -1 .22C-1 .68 -.45 .8 -.12 .45L-.32 1H.32L.12 .45C.45 .8 1 .68 1 .22C1 -.3 .1 -.8 0 -1Z", t: "M0 -1A.36 .36 0 0 1 .3 -.38A.36 .36 0 1 1 .14 .3L.32 1H-.32L-.14 .3A.36 .36 0 1 1 -.3 -.38A.36 .36 0 0 1 0 -1Z" };
    const sym = (k, x, y, R, c, ex) => `<path d="${SYM[k]}" transform="translate(${f(x)} ${f(y)}) scale(${f(R)})" fill="${c}"${ex || ""}/>`;
    const TXT = `font-family="Georgia, serif" font-style="italic" font-weight="bold"`;
    // bulle de BD : o = { du, deb, pt (décalage de la queue), fs, queue: "bas" | "haut" | "droite", fen: [apparition, disparition], fixe: visible quand tout est figé }
    const bulle = (x, y, txt, o) => { if (!K.anime && o.fixe === false) return; const z = o.fs || 19, li = txt.split("|"), w = Math.max(...li.map(t => t.length)) * z * .56 + 28, h = li.length * z * 1.2 + 14, qx = x + (o.pt || 0), [on, off] = o.fen || [.06, .82];
      const QUEUE = { bas: `M${f(qx - 8)} ${f(y + h / 2 - 1.5)}l8 14l7 -14z`, haut: `M${f(qx - 8)} ${f(y - h / 2 + 1.5)}l8 -14l7 14z`, droite: `M${f(x + w / 2 - 1.5)} ${f(y - 8 + (o.pt || 0))}l16 6l-16 8z` }[o.queue || "bas"];
      a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${on.toFixed(2)};${(on + .05).toFixed(2)};${off.toFixed(2)};${(off + .06).toFixed(2)};1" dur="${o.du}s" begin="${o.deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(h / 2, 18))}" fill="#FFFDF6" stroke="${ENC}" stroke-width="2"/><path d="${QUEUE}" fill="#FFFDF6" stroke="${ENC}" stroke-width="2" stroke-linejoin="round"/><rect x="${f(x - w / 2 + 2)}" y="${f(y - h / 2 + 2)}" width="${f(w - 4)}" height="${f(h - 4)}" rx="${f(Math.min(h / 2, 18) - 2)}" fill="#FFFDF6"/>${li.map((t, k) => `<text x="${f(x)}" y="${f(y - (li.length - 1) * z * .6 + k * z * 1.2 + z * .36)}" text-anchor="middle" ${TXT} font-size="${z}" fill="${ENC}">${t}</text>`).join("")}</g>`); };
    // ---- dégradés et motifs (couche fixe)
    s.push(`<pattern id="gt-vichy" width="210" height="210" patternUnits="userSpaceOnUse" patternTransform="rotate(-6) scale(1 .84)"><rect width="210" height="210" fill="#FBEEE2"/><rect width="105" height="210" fill="#D9506A" opacity=".15"/><rect width="210" height="105" fill="#D9506A" opacity=".15"/></pattern>`);
    s.push(`<radialGradient id="gt-pale" cx="48%" cy="50%" r="72%"><stop offset=".35" stop-color="#EADBD0" stop-opacity="0"/><stop offset="1" stop-color="#E4D4C8" stop-opacity=".7"/></radialGradient>`);
    s.push(`<radialGradient id="gt-the" cx="45%" cy="38%" r="62%"><stop offset="0" stop-color="#EDA850"/><stop offset=".55" stop-color="#B8661E"/><stop offset="1" stop-color="#7A3A10"/></radialGradient>`);
    s.push(`<radialGradient id="gt-sol" cx="0%" cy="0%" r="125%"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".75"/><stop offset=".22" stop-color="#FFDC94" stop-opacity=".3"/><stop offset=".5" stop-color="#FFD890" stop-opacity="0"/><stop offset=".78" stop-color="#5A1A30" stop-opacity=".08"/><stop offset="1" stop-color="#3A0A24" stop-opacity=".5"/></radialGradient>`);
    s.push(`<radialGradient id="gt-pool" r="50%"><stop offset="0" stop-color="#FFF2C8" stop-opacity=".75"/><stop offset=".6" stop-color="#FFE6B0" stop-opacity=".28"/><stop offset="1" stop-color="#FFE6B0" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="gt-porc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F4EEF2"/><stop offset="1" stop-color="#C8BCD0"/></linearGradient>`);
    s.push(`<linearGradient id="gt-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4C0"/><stop offset=".4" stop-color="#E8BC48"/><stop offset="1" stop-color="#8A5C14"/></linearGradient>`);
    s.push(`<linearGradient id="gt-vert" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5AA066"/><stop offset=".55" stop-color="#3E7A4A"/><stop offset="1" stop-color="#2A5434"/></linearGradient>`);
    s.push(`<linearGradient id="gt-hat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A6A9A"/><stop offset=".45" stop-color="#5A3A6A"/><stop offset="1" stop-color="#3A2246"/></linearGradient>`);
    s.push(`<linearGradient id="gt-rouge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2485E"/><stop offset=".6" stop-color="#C81A34"/><stop offset="1" stop-color="#8A1024"/></linearGradient>`);
    // ================= 1. la nappe : grands carreaux doux, quelques plis, qui pâlissent vers les bords
    for (let k = 0; k < 6; k++) { const x = r() * W, y = r() * H, L0 = 200 + r() * 260; s.push(`<path d="M${f(x)} ${f(y)}q${f(L0 * .5)} ${f(-20 + r() * 40)} ${f(L0)} ${f(10 + r() * 30)}" stroke="#FFFFFF" stroke-width="${f(14 + r() * 14)}" fill="none" opacity=".2" stroke-linecap="round" filter="url(#gt-flou8)"/><path d="M${f(x + 6)} ${f(y + 16)}q${f(L0 * .5)} ${f(-20 + r() * 40)} ${f(L0)} ${f(10 + r() * 30)}" stroke="#7A1E2E" stroke-width="9" fill="none" opacity=".07" stroke-linecap="round" filter="url(#gt-flou8)"/>`); }
    s.push(`<rect width="${W}" height="${H}" fill="url(#gt-pale)"/>`);
    // le soleil d'après-midi : grand halo doré en haut à gauche + flaque de lumière sur le héros
    s.push(`<circle cx="0" cy="0" r="420" fill="url(#gt-pool)"/><ellipse cx="330" cy="330" rx="260" ry="250" fill="url(#gt-pool)" opacity=".7"/>`);
    // ================= 2. la grande flaque de thé (le lac du tracé)
    const L = (def.eau || [])[0] ? (() => { const P0 = def.eau[0].map(q => [q[0] * ECH * KU, q[1] * ECH * KU]); const cx = P0.reduce((t, p) => t + p[0], 0) / P0.length, cy = P0.reduce((t, p) => t + p[1], 0) / P0.length;
      return { cx, cy, rx: (Math.max(...P0.map(p => p[0])) - Math.min(...P0.map(p => p[0]))) / 2, ry: (Math.max(...P0.map(p => p[1])) - Math.min(...P0.map(p => p[1]))) / 2, P0 }; })() : { cx: 532, cy: 345, rx: 135, ry: 85, P0: null };
    const lisse = (P0, k) => { const Q = P0.map(p => [L.cx + (p[0] - L.cx) * k, L.cy + (p[1] - L.cy) * k]), n = Q.length; let d = `M${f((Q[0][0] + Q[1][0]) / 2)} ${f((Q[0][1] + Q[1][1]) / 2)}`; for (let i = 1; i <= n; i++) { const p = Q[i % n], q = Q[(i + 1) % n]; d += `Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`; } return d + "Z"; };
    { const { cx, cy, rx, ry, P0 } = L;
      if (P0) s.push(`<path d="${lisse(P0, 1.14)}" fill="#A8602A" opacity=".18" filter="url(#gt-flou8)"/><path d="${lisse(P0, 1.03)}" fill="#5A2010" opacity=".45" transform="translate(7 6)" filter="url(#gt-flou)"/><path d="${lisse(P0, 1)}" fill="url(#gt-the)" stroke="#5A2A0E" stroke-width="2"/><path d="${lisse(P0, .92)}" fill="none" stroke="#F7C478" stroke-width="2.4" opacity=".5"/>`);
      else s.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#gt-the)" stroke="#5A2A0E" stroke-width="2"/>`);
      // le reflet du soleil sur le thé (côté haut-gauche)
      s.push(`<path d="M${f(cx - rx * .62)} ${f(cy - ry * .2)}q${f(rx * .25)} ${f(-ry * .45)} ${f(rx * .7)} ${f(-ry * .5)}" stroke="#FFF4D8" stroke-width="7" fill="none" opacity=".55" stroke-linecap="round"/><path d="M${f(cx - rx * .5)} ${f(cy + ry * .02)}q${f(rx * .14)} ${f(-ry * .2)} ${f(rx * .34)} ${f(-ry * .26)}" stroke="#FFF4D8" stroke-width="4" fill="none" opacity=".4" stroke-linecap="round"/>`);
      // deux sucres-icebergs et une rondelle de citron
      [[.42, .28, 1.5], [.6, -.08, 1.15]].forEach(([u, v, sc]) => { const x = cx + u * rx, y = cy + v * ry; s.push(`${G(x, y, sc)}<ellipse cx="7" cy="7" rx="14" ry="5" fill="#3A1A08" opacity=".35"/><path d="M-10 -4l10 -6l10 6v10l-10 6l-10 -6z" fill="#FFFFFF" ${INK}/><path d="M0 2l10 -6v10l-10 6z" fill="#E4DCE8"/><path d="M-10 -4l10 6v10l-10 -6z" fill="#F7F3F8"/><path d="M-10 -4l10 6l10 -6M0 2v10" stroke="${ENC}" stroke-width=".8" fill="none"/></g>`); });
      s.push(`${G(cx - rx * .36, cy + ry * .42, 1.4, -12)}<ellipse cx="6" cy="5" rx="20" ry="9" fill="#3A1A08" opacity=".3"/><ellipse rx="20" ry="13" fill="#F7E04A" ${INK}/><ellipse rx="16" ry="10" fill="#FFF6B0"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(q => `<path d="M0 0L${f(Math.cos(q * .785) * 15)} ${f(Math.sin(q * .785) * 9.4)}" stroke="#F2D040" stroke-width="1.4"/>`).join("")}</g>`); }
    // ================= 3. la piste : le « chemin de table » en dentelle, liseré sombre, festons, double broderie rose, chevrons dans le sens de la course
    K.route([["#3A0A1A", 52, ` opacity=".35" filter="url(#gt-flou)" transform="translate(7 6)"`], ["#6A2234", 43], ["#FFFFFF", 39], ["#EFC2CE", 24], ["#FFFBF2", 20]]);
    for (let i = 0; i < K.N; i += 3) { const [nx, ny] = K.nrm(i), p = K.P[i]; [1, -1].forEach(sg => s.push(`<circle cx="${f(p[0] + sg * nx * 20.5)}" cy="${f(p[1] + sg * ny * 20.5)}" r="3.2" fill="#FFFFFF" stroke="#6A2234" stroke-width="1"/>`)); }
    for (let i = 10; i < K.N - 6; i += 15) { const [, , tx, ty] = K.nrm(i), p = K.P[i], gros = i < 60; s.push(`<path d="M-4 -5L3 0L-4 5" transform="translate(${f(p[0])} ${f(p[1])}) rotate(${f(Math.atan2(ty, tx) * 57.3)}) scale(${gros ? 1.5 : 1})" fill="none" stroke="${gros ? ROUGE : "#E0708E"}" stroke-width="${gros ? 2.4 : 2}" stroke-linecap="round" stroke-linejoin="round"/>`); }
    K.depart();
    // ================= 4. LE HÉROS : le Chapelier fou, immense, penché sur la table, qui verse le thé dans la flaque (le Loir dort dans la théière)
    const HX = 280, HY = 532, HS = 1.5, HR = 5, TPX = 100, TPY = -192, TPR = 46;
    const rot = (x, y, d) => { const c = Math.cos(d / 57.2958), sn = Math.sin(d / 57.2958); return [x * c - y * sn, x * sn + y * c]; };
    const monde = (x, y) => { const [u, v] = rot(x, y, HR); return [HX + u * HS, HY + v * HS]; };
    const [bx0, by0] = rot(50, -16, TPR), BEC = monde(TPX + bx0, TPY + by0);
    s.push(ombreL(HX + 10, HY, 70, 300, .34));
    const chap = `${G(HX, HY, HS, HR)}
      <ellipse cx="-17" cy="-4" rx="15" ry="5.4" fill="${NOIR}" ${INK}/><path d="M-30 -5q-6 -6 -2 -10" stroke="${NOIR}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="17" cy="-4" rx="16" ry="5.4" fill="${NOIR}" ${INK}/><path d="M31 -5q7 -6 3 -11" stroke="${NOIR}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M-16 -96L-22 -8H-8L-1 -88Z" fill="#E8C34A" ${INK}/><path d="M1 -88L8 -8H22L16 -96Z" fill="#D8B03A" ${INK}/><path d="M-19 -70h14M-20 -46h14M-21 -24h14M4 -70h13M6 -46h13M7 -24h14M-12 -94l-3 84M12 -94l4 84" stroke="#B0701E" stroke-width="1.6" opacity=".7"/>
      <path d="M-24 -100Q-38 -72 -34 -50L-16 -58Q-14 -80 -10 -98Z" fill="#2E5E38" ${INK}/>
      <path d="M-27 -166Q-32 -130 -25 -92L25 -92Q32 -130 27 -166Q0 -174 -27 -166Z" fill="url(#gt-vert)" ${INK}/>
      <path d="M-11 -167L-13 -94H13L11 -167Z" fill="#F2D466" ${INK}/>${[-150, -136, -122, -108].map(v => `<circle cx="0" cy="${v}" r="2.2" fill="#B88A2A" ${INK}/>`).join("")}<path d="M-12 -140h24M-12 -116h24" stroke="#C89A3A" stroke-width="1.2"/>
      <path d="M-27 -165L-11 -168L-4 -124L-16 -116Z" fill="#4E9258" ${INK}/><path d="M27 -165L11 -168L4 -124L16 -116Z" fill="#336A40" ${INK}/>
      <path d="M-25 -96H25" stroke="${ENC}" stroke-width="2"/><path d="M14 -132l7 1l-1 6l-7 -1z" fill="#FFFDF6" ${INK}/>
      <path d="M-24 -160Q-44 -150 -50 -126" stroke="#2E5E38" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M-24 -160Q-44 -150 -50 -126" stroke="url(#gt-vert)" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M-56 -124l12 0" stroke="#FFFDF6" stroke-width="5" stroke-linecap="round"/><circle cx="-50" cy="-118" r="6.4" fill="${PEAU}" ${INK}/>
      <path d="M-66 -128h22l-3 13h-16z" fill="#FFFFFF" ${INK}/><path d="M-44 -125q7 1 1 7" stroke="${ENC}" stroke-width="1.6" fill="none"/><ellipse cx="-55" cy="-114" rx="16" ry="3.6" fill="#FFFFFF" ${INK}/><ellipse cx="-55" cy="-128" rx="11" ry="2.6" fill="#9A4A14"/>${sym("c", -55, -121, 3, ROUGE)}
      <path d="M22 -160Q46 -170 58 -186Q64 -200 62 -214" stroke="#2E5E38" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M22 -160Q46 -170 58 -186Q64 -200 62 -214" stroke="url(#gt-vert)" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M-4 -168l-18 -11v22zM4 -168l18 -11v22z" fill="#D2304A" ${INK}/>${[[-13, -172], [-15, -163], [13, -172], [15, -163]].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="1.8" fill="#FFF"/>`).join("")}<circle cx="0" cy="-168" r="4.6" fill="#B01E36" ${INK}/>
      <path d="M-18 -204q-16 2 -14 18q-10 4 -4 16q8 -6 8 -16q4 -10 10 -14zM20 -204q14 2 13 16q9 6 2 16q-6 -6 -6 -14q-4 -10 -9 -14z" fill="#E0702A" ${INK}/>
      <ellipse cx="2" cy="-194" rx="19" ry="22" fill="${PEAU}" ${INK}/><ellipse cx="-12" cy="-184" rx="5" ry="3.4" fill="#F29A9A" opacity=".7"/><ellipse cx="17" cy="-184" rx="5" ry="3.4" fill="#F29A9A" opacity=".7"/>
      <path d="M-12 -207q6 -6 12 -2M8 -209q7 -5 13 1" stroke="${ENC}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="-5" cy="-199" rx="5.4" ry="6" fill="#FFFFFF" ${INK}/><ellipse cx="11" cy="-200" rx="6.4" ry="7" fill="#FFFFFF" ${INK}/><circle cx="-3.4" cy="-198.6" r="2.6" fill="#2A6A4A"/><circle cx="13" cy="-199.4" r="3" fill="#2A6A4A"/><circle cx="-3" cy="-199" r="1.3" fill="${NOIR}"/><circle cx="13.4" cy="-200" r="1.5" fill="${NOIR}"/><circle cx="-2.2" cy="-200" r=".7" fill="#FFF"/><circle cx="14.2" cy="-201" r=".8" fill="#FFF"/>
      <path d="M3 -197q12 3 9 11q-4 3 -9 0" fill="#F2BC9E" ${INK}/>
      <path d="M-11 -184Q4 -170 20 -185Q5 -178 -11 -184Z" fill="#FFFFFF" stroke="${ENC}" stroke-width="1.6" stroke-linejoin="round"/><path d="M-4 -182v3.4M2 -181v4M8 -181.6v3.6M14 -183v3" stroke="${ENC}" stroke-width=".8"/>
      <g transform="rotate(-9 2 -214)"><ellipse cx="2" cy="-213" rx="33" ry="7.4" fill="#4A2E58" ${INK}/><path d="M-20 -215L-26 -276Q2 -282 32 -276L25 -215Q2 -210 -20 -215Z" fill="url(#gt-hat)" ${INK}/><ellipse cx="3" cy="-276" rx="29" ry="6" fill="#6A4A7A" ${INK}/>
        <path d="M-21 -226Q2 -221 25 -226L26 -240Q2 -235 -22 -240Z" fill="#E05A6A" ${INK}/><path d="M-16 -268Q-14 -246 -12 -222" stroke="#B89AC8" stroke-width="4" opacity=".55" stroke-linecap="round"/>
        <g transform="translate(16 -244) rotate(14)"><rect x="-11" y="-9" width="22" height="17" fill="#FFFDF6" ${INK}/><text y="3.6" text-anchor="middle" font-family="Georgia, serif" font-size="9.4" font-weight="bold" fill="${ENC}">10/6</text></g></g>
      <circle cx="62" cy="-218" r="6.6" fill="${PEAU}" ${INK}/>
      <g transform="translate(${TPX} ${TPY}) rotate(${TPR})"><path d="M-26 -10Q-46 -14 -44 4Q-42 18 -26 10" stroke="${ENC}" stroke-width="9" fill="none"/><path d="M-26 -10Q-46 -14 -44 4Q-42 18 -26 10" stroke="#F4EEF2" stroke-width="6" fill="none"/>
        <path d="M24 2Q40 4 46 -14L52 -17L48 -8Q42 16 24 12Z" fill="url(#gt-porc)" ${INK}/>
        <ellipse cx="0" cy="0" rx="30" ry="23" fill="url(#gt-porc)" ${INK}/><path d="M-29 2Q0 16 29 2" stroke="#4C7AC8" stroke-width="2.6" fill="none"/>${[-15, 0, 15].map((u, q) => `<g transform="translate(${u} ${q % 2 ? -6 : -2})"><circle r="4.4" fill="#7AA6E8"/>${[0, 1, 2, 3, 4].map(p => `<circle cx="${f(Math.cos(p * 1.256) * 3.6)}" cy="${f(Math.sin(p * 1.256) * 3.6)}" r="2" fill="#4C7AC8"/>`).join("")}<circle r="1.8" fill="#F2CF6A"/></g>`).join("")}
        <ellipse cx="-10" cy="-12" rx="11" ry="4" fill="#FFFFFF" opacity=".8"/><ellipse cx="0" cy="-22" rx="16" ry="4.6" fill="#E8E0EA" ${INK}/></g></g>`;
    s.push(chap);
    // le jet de thé, épais et brillant, du bec à la flaque, éclaboussures à l'impact
    { const [sx, sy] = BEC, lx = sx + 14, ly = Math.max(sy + 66, L.cy - L.ry * .1); const jet = `M${f(sx)} ${f(sy)}C${f(sx + 10)} ${f(sy + 6)} ${f(lx)} ${f(ly - 40)} ${f(lx)} ${f(ly)}`;
      s.push(`<path d="${jet}" stroke="#5A2A0E" stroke-width="12" fill="none" stroke-linecap="round"/><path d="${jet}" stroke="#C8762A" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${jet}" stroke="#FFE2A8" stroke-width="2.6" fill="none" stroke-linecap="round" transform="translate(-2.4 -1)" opacity=".9"/>`);
      s.push(`<ellipse cx="${f(lx)}" cy="${f(ly + 3)}" rx="20" ry="7" fill="none" stroke="#FFE8B8" stroke-width="2.4" opacity=".8"/>${[[-16, -12, 3.4], [-8, -20, 2.6], [10, -18, 3], [18, -9, 2.4], [2, -26, 2.2]].map(([u, v, R]) => `<circle cx="${f(lx + u)}" cy="${f(ly + v)}" r="${R}" fill="#D8883A" stroke="#5A2A0E" stroke-width=".8"/><circle cx="${f(lx + u - .8)}" cy="${f(ly + v - .8)}" r="${f(R * .35)}" fill="#FFF0C8"/>`).join("")}`);
      a.push(`<path d="${jet}" stroke="#FFE8B8" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="8 16" opacity=".8">${an(`<animate attributeName="stroke-dashoffset" values="48;0" dur=".8s" repeatCount="indefinite"/>`)}</path>`);
      for (let k = 0; k < 3; k++) a.push(`<ellipse cx="${f(lx)}" cy="${f(ly + 3)}" rx="${K.anime ? 10 : 34 + k * 22}" ry="${K.anime ? 4 : 12 + k * 8}" fill="none" stroke="#FFE8B8" stroke-width="2" opacity="${K.anime ? 0 : .45 - k * .12}">${an(`<animate attributeName="rx" values="10;90" dur="3.6s" begin="${k * 1.2}s" repeatCount="indefinite"/><animate attributeName="ry" values="4;34" dur="3.6s" begin="${k * 1.2}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="3.6s" begin="${k * 1.2}s" repeatCount="indefinite"/>`)}</ellipse>`); }
    // le Loir, endormi dans la théière, qui sort la tête puis replonge (couche animée)
    a.push(`${G(HX, HY, HS, HR)}<g transform="translate(${TPX} ${TPY}) rotate(${TPR})"><g>${an(`<animateTransform attributeName="transform" type="translate" values="0 8;0 8;0 -3;0 -3;0 8" keyTimes="0;.45;.55;.85;1" dur="7s" repeatCount="indefinite"/>`)}<path d="M-12 -22Q-13 -40 0 -41Q13 -40 12 -22Z" fill="#B8987A" ${INK}/><ellipse cx="-10" cy="-38" rx="5" ry="6" fill="#C8A88A" ${INK}/><ellipse cx="10" cy="-38" rx="5" ry="6" fill="#C8A88A" ${INK}/><path d="M-6 -31q3 2 5 0M1 -31q3 2 5 0" stroke="${ENC}" stroke-width="1.2" fill="none"/><path d="M-9 -44Q0 -56 12 -50L8 -42Z" fill="#7AA6E8" ${INK}/><circle cx="13" cy="-50" r="2.6" fill="#FFFFFF" ${INK}/></g><ellipse cx="0" cy="-22" rx="16" ry="4.6" fill="#E8E0EA" ${INK}/></g></g>`);
    bulle(HX - 20, HY - 470, "Pas de place !", { du: 9, pt: 40 });
    // ================= 5. le sourire du Chat, qui flotte au-dessus de la table
    { const x = 492, y = 168;
      s.push(`<ellipse cx="${f(x + 26)}" cy="${f(y + 60)}" rx="60" ry="10" fill="#4A1424" opacity=".12" filter="url(#gt-flou8)"/><ellipse cx="${f(x)}" cy="${f(y - 12)}" rx="96" ry="52" fill="#C890E8" opacity=".25" filter="url(#gt-flou8)"/>`);
      const sourire = `<path d="M-62 -6Q0 50 62 -6Q0 22 -62 -6Z" fill="#FFFFFF" stroke="${ENC}" stroke-width="2.2"/>${[-46, -34, -22, -10, 2, 14, 26, 38, 50].map(u => `<path d="M${u} ${f(-3 + 14 * (1 - (u / 62) ** 2) - 2)}v${f(6 + 18 * (1 - (u / 62) ** 2))}" stroke="${ENC}" stroke-width="1.2"/>`).join("")}<path d="M-62 -6q-6 -2 -8 -8M62 -6q6 -2 8 -8" stroke="${ENC}" stroke-width="2.2" fill="none"/>`;
      const yeux = `<ellipse cx="-30" cy="-34" rx="13" ry="9" fill="#F2E25A" stroke="${ENC}" stroke-width="1.8"/><ellipse cx="30" cy="-34" rx="13" ry="9" fill="#F2E25A" stroke="${ENC}" stroke-width="1.8"/><ellipse cx="-30" cy="-34" rx="2.6" ry="8" fill="${NOIR}"/><ellipse cx="30" cy="-34" rx="2.6" ry="8" fill="${NOIR}"/>`;
      a.push(`${G(x, y, .95)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="5s" repeatCount="indefinite"/>`)}<g>${an(`<animate attributeName="opacity" values="1;1;.15;1" keyTimes="0;.7;.85;1" dur="9s" repeatCount="indefinite"/>`)}${yeux}</g>${sourire}</g></g>`); }
    // ================= 6. le Lièvre de mars, au bord de la flaque, qui trempe sa montre dans le thé
    { const hx = 618, hy = 266, HSl = 1.15;
      s.push(ombreL(hx, hy, 30, 110));
      s.push(`${G(hx, hy, HSl)}<path d="M-8 0v-14M8 0v-14" stroke="#8A6A48" stroke-width="5"/><ellipse cx="-9" cy="-1" rx="7" ry="2.6" fill="#B88A58" ${INK}/><ellipse cx="9" cy="-1" rx="7" ry="2.6" fill="#B88A58" ${INK}/>
        <path d="M-18 -12Q-20 -48 0 -52Q20 -48 18 -12Q0 -6 -18 -12Z" fill="#C89A68" ${INK}/><path d="M-9 -50l9 6l9 -6l-9 -4z" fill="#2E5AA8" ${INK}/><path d="M-6 -44h12v26h-12z" fill="#F4ECD8" stroke="${ENC}" stroke-width=".6"/>
        <ellipse cx="-6" cy="-92" rx="5" ry="22" fill="#C89A68" ${INK} transform="rotate(-18 -6 -72)"/><ellipse cx="-6" cy="-92" rx="2.2" ry="15" fill="#F2B8C0" transform="rotate(-18 -6 -72)"/><ellipse cx="8" cy="-90" rx="5" ry="21" fill="#C89A68" ${INK} transform="rotate(22 8 -70)"/><ellipse cx="8" cy="-90" rx="2.2" ry="14" fill="#F2B8C0" transform="rotate(22 8 -70)"/>
        <path d="M-14 -96l-6 -10M-12 -98l-2 -12M14 -94l8 -8" stroke="#E8C860" stroke-width="1.6"/>
        <ellipse cx="0" cy="-64" rx="12" ry="11" fill="#C89A68" ${INK}/><ellipse cx="-4" cy="-59" rx="7" ry="5" fill="#F4E4D0"/><circle cx="-5" cy="-67" r="3.4" fill="#FFF" ${INK}/><circle cx="4.6" cy="-67" r="3.4" fill="#FFF" ${INK}/><circle cx="-6" cy="-66.4" r="1.5" fill="${ENC}"/><circle cx="3.6" cy="-66.4" r="1.5" fill="${ENC}"/><path d="M-6 -58q2 2 4 0" stroke="${ENC}" stroke-width="1" fill="none"/>
        <path d="M-14 -40Q-26 -34 -30 -22" stroke="#C89A68" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M-30 -22v10" stroke="${OR}" stroke-width="1.4"/><circle cx="-30" cy="-6" r="7" fill="${OR}" ${INK}/><circle cx="-30" cy="-6" r="5" fill="#FFF8E6"/><path d="M-30 -6v-3.4M-30 -6h2.6" stroke="${ENC}" stroke-width=".9"/></g>`); }
    // ================= 7. le Lapin blanc, au départ, qui court dans le sens de la course, montre tendue
    const lapin = `<path d="M-4 -2v-12M4 -2v-12" stroke="#FFFFFF" stroke-width="5"/><ellipse cx="-5" cy="-1" rx="5" ry="2.2" fill="#FFF" ${INK}/><ellipse cx="5" cy="-1" rx="5" ry="2.2" fill="#FFF" ${INK}/>
      <path d="M-11 -14Q-13 -36 0 -38Q13 -36 11 -14Q0 -10 -11 -14Z" fill="#B8352A" ${INK}/><path d="M-11 -14L-17 -6L-5 -12ZM11 -14L15 -4L5 -12Z" fill="#B8352A" ${INK}/><path d="M-4 -37L0 -16L4 -37Z" fill="#F2CF6A" ${INK}/>
      <path d="M8 -32Q20 -30 26 -26" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M0 -30Q10 -27 16 -23" stroke="${OR}" stroke-width="1" fill="none"/><circle cx="30" cy="-25" r="7.4" fill="${OR}" ${INK}/><circle cx="30" cy="-25" r="5.4" fill="#FFF8E6"/><path d="M30 -25v-3.6M30 -25h3" stroke="${ENC}" stroke-width=".9"/>
      <path d="M-8 -32Q-16 -26 -14 -18" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none"/>
      <ellipse cx="0" cy="-45" rx="8" ry="8.4" fill="#FFFFFF" ${INK}/><path d="M4 -45l4 1" stroke="#F2A0B0" stroke-width="2"/><circle cx="3" cy="-47" r="1.4" fill="#E5484D"/><path d="M6 -43l6 -1.4M6 -42l6 1" stroke="${ENC}" stroke-width=".5"/><circle cx="-4" cy="-44" r="2.4" fill="none" stroke="${OR}" stroke-width=".9"/>
      <ellipse cx="-8" cy="-62" rx="3.4" ry="14" fill="#FFF" ${INK} transform="rotate(-40 -4 -52)"/><ellipse cx="-2" cy="-62" rx="3.4" ry="14" fill="#FFF" ${INK} transform="rotate(-24 0 -51)"/><ellipse cx="-2" cy="-62" rx="1.4" ry="10" fill="#F2B8C8" transform="rotate(-24 0 -51)"/>`;
    { const x = 716, y = 198; s.push(ombreL(x, y, 26, 70)); a.push(`${G(x, y, 1.45, 8)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur=".45s" repeatCount="indefinite"/>`)}${lapin}</g></g>`); bulle(x - 2, y + 40, "En retard !", { du: 10, deb: 0, pt: 0, fs: 17, queue: "haut", fen: [.04, .42], fixe: false }); }
    // ================= 8. la Reine de cœur devant son trône, bras pointé vers Alice : « Qu'on lui coupe la tête ! »
    { const x = 868, y = 320, SC = 1.6;
      s.push(ombreL(x + 20, y, 70, 170, .32));
      s.push(`${G(x + 26, y - 4, SC)}<path d="M-26 0V-88Q-26 -114 0 -118Q26 -114 26 -88V0Z" fill="#8A1428" ${INK}/><path d="M-19 -4V-86Q-19 -106 0 -109Q19 -106 19 -86V-4Z" fill="url(#gt-rouge)"/>${sym("c", 0, -88, 10, "#FFD8E0")}${[-21, 21].map(u => `<circle cx="${u}" cy="-108" r="4.4" fill="url(#gt-or)" ${INK}/>`).join("")}</g>`);
      s.push(`${G(x, y, SC)}<path d="M-36 0Q-32 -30 -14 -52L14 -52Q32 -30 36 0Q0 7 -36 0Z" fill="url(#gt-rouge)" ${INK}/><path d="M-11 -52L-15 2H15L11 -52Z" fill="#FFFDF6" ${INK}/>${sym("c", 0, -36, 5, ROUGE)}${sym("c", 0, -17, 5, ROUGE)}<path d="M-15 -2H15" stroke="${NOIR}" stroke-width="3"/>${[[-26, -12], [-21, -32], [24, -12], [20, -32]].map(([u, v]) => sym("c", u, v, 3.6, "#FFE0E6")).join("")}
        <path d="M-13 -52L-14 -72Q0 -76 14 -72L13 -52Z" fill="${NOIR}" ${INK}/><path d="M-13 -60H13" stroke="${OR}" stroke-width="1.6"/>
        <path d="M-26 -70Q-34 -98 -18 -102Q-8 -90 0 -96Q8 -90 18 -102Q34 -98 26 -70Q0 -78 -26 -70Z" fill="#FFFDF6" ${INK}/><path d="M-18 -98L-10 -76M-6 -92L-4 -76M6 -92L4 -76M18 -98L10 -76" stroke="#C8BCD0" stroke-width="1"/>
        <path d="M14 -68Q24 -60 22 -46" stroke="${ROUGE}" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="22" cy="-44" r="3" fill="${PEAU}" ${INK}/><path d="M24 -40L28 -100" stroke="url(#gt-or)" stroke-width="3"/>${sym("c", 28.4, -104, 5, ROUGE, ` stroke="${ENC}" stroke-width=".2"`)}
        <circle cy="-84" r="11.5" fill="${PEAU}" ${INK}/><path d="M-12 -82Q-15 -100 0 -99Q15 -100 12 -82Q10 -92 0 -92Q-10 -92 -12 -82Z" fill="${NOIR}"/>
        <path d="M-8 -90l6 3M8 -90l-6 3" stroke="${ENC}" stroke-width="2" stroke-linecap="round"/><circle cx="-4" cy="-85.4" r="1.4" fill="${ENC}"/><circle cx="4" cy="-85.4" r="1.4" fill="${ENC}"/><ellipse cx="0" cy="-77.4" rx="4.4" ry="3.4" fill="#7A1020" ${INK}/><circle cx="-7.4" cy="-80" r="2.4" fill="#F2647A" opacity=".75"/><circle cx="7.4" cy="-80" r="2.4" fill="#F2647A" opacity=".75"/>
        <path d="M-10 -96l2 -12l4 7l4 -10l4 10l4 -7l2 12z" fill="url(#gt-or)" ${INK}/>${sym("c", 0, -101, 2, ROUGE)}</g>`);
      // le bras qui pointe (couche animée : il s'agite)
      a.push(`${G(x, y, SC)}<g>${an(`<animateTransform attributeName="transform" type="rotate" values="0 -12 -66;-8 -12 -66;0 -12 -66" dur=".7s" repeatCount="indefinite"/>`)}<path d="M-12 -66Q-28 -64 -42 -58" stroke="#8A1024" stroke-width="7.4" stroke-linecap="round" fill="none"/><path d="M-12 -66Q-28 -64 -42 -58" stroke="${ROUGE}" stroke-width="5.4" stroke-linecap="round" fill="none"/><circle cx="-44" cy="-57" r="3.2" fill="${PEAU}" ${INK}/><path d="M-46 -58l-8 2" stroke="${PEAU}" stroke-width="2.4" stroke-linecap="round"/></g></g>`);
      // trois cartes à ses pieds
      [[-46, 6, -20, "c", ROUGE], [-60, -4, 14, "p", NOIR], [44, 10, 26, "k", ROUGE]].forEach(([u, v, ro, k, c]) => s.push(`${G(x + u, y + v, 1.2, ro)}<rect x="-11" y="-15" width="22" height="30" rx="2" fill="#FFFDF6" ${INK}/>${sym(k, 0, 0, 6.4, c)}</g>`));
      bulle(x - 154, y - 84, "Qu'on lui coupe|la tête !", { du: 10, deb: 0, pt: 4, fs: 16, queue: "droite", fen: [.5, .9] }); }
    // la garde de la Reine : soldats-cartes en rang, dehors, dans le coin haut-droit
    const soldat = (k) => { const c = k % 2 ? NOIR : ROUGE, sy = ["c", "p", "k", "t"][k % 4]; return `<path d="M-5 0v-10M5 0v-10" stroke="${ENC}" stroke-width="2.4"/><path d="M-10 -12v-14M10 -12v-14" stroke="${ENC}" stroke-width="2"/><rect x="-12" y="-42" width="24" height="32" rx="2" fill="#FFFDF6" ${INK}/>${sym(sy, 0, -26, 7, c)}<circle cy="-49" r="7" fill="${PEAU}" ${INK}/><path d="M-7 -52q7 -7 14 0" fill="${NOIR}"/><circle cx="-2.4" cy="-49" r="1" fill="${ENC}"/><circle cx="2.4" cy="-49" r="1" fill="${ENC}"/><path d="M14 -2V-66" stroke="#7A5A3A" stroke-width="2"/><path d="M14 -68l-4 8h8z" fill="#B8C0D0" ${INK}/>`; };
    { const RANG = [[986, 106], [1028, 156], [1062, 212]];
      RANG.forEach(([u, v]) => s.push(ombreL(u, v, 22, 60, .26)));
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".9s" repeatCount="indefinite"/>`)}${RANG.map(([u, v], q) => `${G(u, v, 1.5)}${soldat(q)}</g>`).join("")}</g>`); }
    // ================= 9. Alice, grande, assise dans son fauteuil au bout de la table, qui tend sa tasse
    { const x = 762, y = 486, SC = 1.62;
      s.push(ombreL(x, y, 80, 190, .3));
      s.push(`${G(x, y, SC)}<path d="M-38 -2v-10M38 -2v-10" stroke="#8A5C14" stroke-width="5" stroke-linecap="round"/>
        <path d="M-36 -36L-34 -112Q0 -128 34 -112L36 -36Z" fill="url(#gt-or)" ${INK}/><path d="M-29 -40L-28 -106Q0 -119 28 -106L29 -40Z" fill="url(#gt-rouge)" ${INK}/>${sym("c", 0, -104, 4, OR)}
        <path d="M-46 -12Q-48 -30 -40 -42Q-34 -50 -30 -40V-12Z" fill="url(#gt-rouge)" ${INK}/><path d="M46 -12Q48 -30 40 -42Q34 -50 30 -40V-12Z" fill="#9A1428" ${INK}/>
        <path d="M-40 -14Q0 -6 40 -14L38 -26Q0 -34 -38 -26Z" fill="#A81830" ${INK}/>
        <path d="M-12 -24L-14 -4M12 -24L14 -4" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/><path d="M-12 -24L-14 -4M12 -24L14 -4" stroke="${ENC}" stroke-width="7.6" stroke-linecap="round" opacity=".25" transform="translate(.6 0)"/><ellipse cx="-16" cy="-3" rx="6" ry="3.2" fill="${NOIR}"/><ellipse cx="16" cy="-3" rx="6" ry="3.2" fill="${NOIR}"/>
        <path d="M-17 -62Q-34 -44 -36 -24Q0 -16 36 -24Q34 -44 17 -62Z" fill="#6AA6E8" ${INK}/><path d="M-11 -64L-20 -26Q0 -20 20 -26L11 -64Z" fill="#FFFFFF" ${INK}/><path d="M-18 -30Q0 -24 18 -30" stroke="#D8E4F0" stroke-width="1.4" fill="none"/>
        <path d="M-13 -88Q-15 -72 -14 -62H14Q15 -72 13 -88Q0 -92 -13 -88Z" fill="#6AA6E8" ${INK}/><path d="M-9 -88L-7 -64M9 -88L7 -64" stroke="#FFFFFF" stroke-width="4"/><circle cx="-15" cy="-84" r="7.4" fill="#8ABCF0" ${INK}/><circle cx="15" cy="-84" r="7.4" fill="#8ABCF0" ${INK}/>
        <path d="M14 -80Q20 -66 8 -56" stroke="${PEAU}" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M-18 -84Q-32 -76 -44 -80" stroke="${PEAU}" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="-46" cy="-80.6" r="3.4" fill="${PEAU}" ${INK}/>
        <ellipse cx="-50" cy="-82" rx="11" ry="2.6" fill="#FFFFFF" ${INK}/><path d="M-57 -94h14l-2 10h-10z" fill="#FFFFFF" ${INK}/><path d="M-43 -92q5 1 0 6" stroke="${ENC}" fill="none"/><ellipse cx="-50" cy="-94" rx="7" ry="1.8" fill="#9A4A14"/>${sym("c", -50, -89, 2, "#4C7AC8")}
        <path d="M-18 -108Q-21 -130 0 -129Q21 -130 18 -108Q25 -86 21 -70Q14 -76 12 -92H-12Q-14 -76 -21 -70Q-25 -86 -18 -108Z" fill="#F2CF6A" ${INK}/>
        <circle cx="0" cy="-104" r="15" fill="${PEAU}" ${INK}/>
        <path d="M-15 -106Q-12 -124 0 -121Q12 -124 15 -106Q9 -114 2 -112Q-6 -116 -15 -106Z" fill="#F2CF6A" ${INK}/><path d="M-15 -111Q0 -126 15 -111" stroke="${NOIR}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M11 -117l6 -4l1 6z" fill="${NOIR}"/>
        <ellipse cx="-6" cy="-103" rx="2.4" ry="3.2" fill="#2A3A6A"/><ellipse cx="4.4" cy="-103" rx="2.4" ry="3.2" fill="#2A3A6A"/><circle cx="-6.6" cy="-104.2" r=".9" fill="#FFF"/><circle cx="3.8" cy="-104.2" r=".9" fill="#FFF"/><path d="M-9 -108q3 -2 5 0M2 -108q3 -2 5 0" stroke="#B8902A" stroke-width="1" fill="none"/>
        <ellipse cx="-10" cy="-97" rx="3" ry="2" fill="#F29A9A" opacity=".7"/><ellipse cx="8" cy="-97" rx="3" ry="2" fill="#F29A9A" opacity=".7"/><path d="M-4 -96q2.6 2 5 0" stroke="${ENC}" stroke-width="1" fill="none" stroke-linecap="round"/></g>`);
      // la vapeur de sa tasse (couche animée)
      for (let k = 0; k < 2; k++) a.push(`<path d="M${f(x - 50 * SC + k * 8)} ${f(y - 98 * SC)}q-6 -10 0 -20t0 -20" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="${vu(0) ? .55 : 0}">${an(`<animate attributeName="opacity" values="0;.7;0" dur="3.4s" begin="${k * 1.7}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -12" dur="3.4s" begin="${k * 1.7}s" repeatCount="indefinite"/>`)}</path>`); }
    // ================= 10. les 4 places des pilotes : fauteuils-tasses à leur couleur, dossier ovale doré (portrait), prénom peint sur la tasse
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"], PL = [[388, 556], [478, 572], [568, 570], [656, 540]], SS = .95;
    PL.forEach(([x, y0], k) => { const c = COULEURS_J[k];
      s.push(ombreL(x, y0 + 8, 90, 120, .3));
      s.push(`${G(x, y0, SS)}<path d="M-22 -40L-18 -70M22 -40L18 -70" stroke="#8A5C14" stroke-width="6"/>
        <ellipse cx="0" cy="-88" rx="33" ry="37" fill="url(#gt-or)" ${INK}/><ellipse cx="0" cy="-88" rx="27" ry="31" fill="${mixHex(c, "#FFFFFF", .55)}" ${INK}/>${sym(["c", "p", "k", "t"][k], 0, -129, 5, k % 2 ? NOIR : ROUGE)}
        <ellipse cx="0" cy="18" rx="54" ry="10" fill="url(#gt-porc)" ${INK}/>
        <path d="M44 -30q20 0 18 18q-2 14 -24 12" stroke="${ENC}" stroke-width="9.6" fill="none"/><path d="M44 -30q20 0 18 18q-2 14 -24 12" stroke="${c}" stroke-width="7" fill="none"/>
        <path d="M-44 -40Q-46 4 -23 16H23Q46 4 44 -40Z" fill="${c}" ${INK}/><path d="M-37 -30Q-37 0 -21 10" stroke="#FFFFFF" stroke-width="4" fill="none" opacity=".45" stroke-linecap="round"/>
        <ellipse cx="0" cy="-40" rx="44" ry="10" fill="${mixHex(c, "#FFFFFF", .4)}" ${INK}/><ellipse cx="0" cy="-39" rx="37" ry="6.4" fill="#7A3A10"/>
        <text y="-6" text-anchor="middle" ${TXT} font-size="27" fill="#FFFFFF" stroke="${mixHex(c, "#000000", .5)}" stroke-width="3.4" paint-order="stroke" stroke-linejoin="round"${NOMS[k].length > 5 ? ` textLength="78" lengthAdjust="spacingAndGlyphs"` : ""}>${NOMS[k]}</text></g>`);
      PORTR.push({ k, x: +x.toFixed(1), y: +(y0 - 88 * SS).toFixed(1), r: +(27 * SS).toFixed(1) }); });
    // ================= 11. la Chenille sur son champignon, dehors en bas à gauche : « Qui es-tu ? » en ronds de fumée qui montent
    { const x = 74, y = 668, SC = 1.5;
      s.push(ombreL(x, y, 120, 110, .3));
      s.push(`${G(x, y, SC)}<path d="M-16 20L-12 -6H12L16 20Q0 26 -16 20Z" fill="#F7E6C8" ${INK}/>
        <path d="M-50 -4Q-48 -50 0 -52Q48 -50 50 -4Q24 4 0 2Q-24 4 -50 -4Z" fill="url(#gt-rouge)" ${INK}/>${[[-30, -22, 7], [-6, -38, 6], [18, -28, 8], [36, -12, 5], [-38, -8, 4.6], [4, -12, 5]].map(([u, v, R]) => `<ellipse cx="${u}" cy="${v}" rx="${R}" ry="${f(R * .8)}" fill="#FFFDF6" ${INK}/>`).join("")}
        <g transform="translate(-6 -46)"><path d="M-34 6Q-38 -2 -30 -4H-8Q0 -6 2 -16" fill="none" stroke="#3E6AB8" stroke-width="14" stroke-linecap="round"/>${[[-32, 2, 7.4], [-21, 0, 7.8], [-10, -2, 8], [0, -11, 7.6], [4, -24, 7.4]].map(([u, v, R]) => `<circle cx="${u}" cy="${v}" r="${R}" fill="#4A8AE0" ${INK}/>`).join("")}
          <circle cx="6" cy="-39" r="10.4" fill="#5A9AF0" ${INK}/><path d="M0 -47q-4 -8 -8 -8M12 -47q4 -8 8 -8" stroke="${ENC}" stroke-width="1.4" fill="none"/><path d="M1 -41q2 -1.6 4 0M7 -41q2 -1.6 4 0" stroke="${ENC}" stroke-width="1.2" fill="none"/><path d="M3 -34q3 2 6 0" stroke="${ENC}" stroke-width="1" fill="none"/>
          <path d="M14 -34Q28 -30 30 -18" stroke="#B88A3A" stroke-width="2" fill="none"/><path d="M24 -18h12l-2 -14h-8z" fill="#7AD0C0" ${INK}/></g></g>`);
      [["", -4, 0, 9], ["Qui", -30, -50, 22], ["es-tu ?", -38, -108, 34]].forEach(([w, u, v, R], k) => { const cx = x + 8 + u, cy = y - 128 + v;
        a.push(`<g opacity="${vu(0)}">${an(`<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(.06 + k * .14).toFixed(2)};${(.14 + k * .14).toFixed(2)};.84;1" dur="8s" repeatCount="indefinite"/>`)}<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${R}" ry="${f(R * .62)}" fill="#EEF4FF" fill-opacity=".85" stroke="#9AB0D0" stroke-width="2"/>${w ? `<text x="${f(cx)}" y="${f(cy + 6)}" text-anchor="middle" ${TXT} font-size="17" fill="#3E5A8A">${w}</text>` : ""}</g>`); }); }
    // ================= 12. la grande tasse fumante, coupée par le cadre en bas à droite (la seule vaisselle géante)
    s.push(`${G(1050, 706, 1)}<ellipse cx="34" cy="20" rx="150" ry="120" fill="#4A1424" opacity=".3" filter="url(#gt-flou8)"/><circle r="140" fill="url(#gt-porc)" ${INK}/><circle r="130" fill="none" stroke="${ROUGE}" stroke-width="4"/><circle cx="-6" cy="-6" r="90" fill="url(#gt-porc)" ${INK}/><circle cx="-6" cy="-6" r="78" fill="url(#gt-the)" ${INK}/><path d="M-62 -36q30 -24 70 -20" stroke="#FFF2D0" stroke-width="6" fill="none" opacity=".5" stroke-linecap="round"/><path d="M-84 -40Q-124 -60 -128 -20" stroke="#F4EEF2" stroke-width="16" fill="none"/></g>`);
    for (let k = 0; k < 3; k++) a.push(`<path d="M${f(980 + k * 22)} ${f(650)}q-12 -20 0 -40t0 -40" stroke="#FFFFFF" stroke-width="7" fill="none" stroke-linecap="round" opacity="${vu(0) ? .5 : 0}">${an(`<animate attributeName="opacity" values="0;.6;0" dur="4.5s" begin="${(k * 1.5).toFixed(1)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 10;0 -16" dur="4.5s" begin="${(k * 1.5).toFixed(1)}s" repeatCount="indefinite"/>`)}</path>`);
    // ================= 13. la lumière unique de l'après-midi par-dessus tout : rayons obliques + halo / coins bas assombris
    for (let k = 0; k < 5; k++) { const a0 = .14 + k * .2, a1 = a0 + .06 + r() * .05; s.push(`<path d="M-60 -60L${f(-60 + Math.cos(a0) * 1600)} ${f(-60 + Math.sin(a0) * 1600)}L${f(-60 + Math.cos(a1) * 1600)} ${f(-60 + Math.sin(a1) * 1600)}Z" fill="#FFF0C0" opacity=".12" filter="url(#gt-flou8)"/>`); }
    s.push(`<rect width="${W}" height="${H}" fill="url(#gt-sol)"/>`);
    // ================= 14. sur la piste : le Lapin blanc pressé, les 4 pilotes en tasses à roulettes, une traînée de pétales dans le sens de la course
    a.push(K.surPiste(.05, `<g transform="rotate(90) scale(.7)">${lapin.replace(/<ellipse cx="-8" cy="-62"[^>]*>|<ellipse cx="-2" cy="-62"[^>]*>/g, "")}</g>`, 30, 1.5, false));
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.95 - k * .025, `<g transform="rotate(90) scale(1.3)"><ellipse cx="0" cy="4" rx="9" ry="3" fill="#000" opacity=".25"/><path d="M-8 -6h16l-2.6 10h-10.8z" fill="${c}" ${INK}/><ellipse cx="0" cy="-6" rx="8" ry="2.4" fill="#8A4A1A" ${INK}/><path d="M8 -4q5 1 0 5" stroke="${ENC}" fill="none"/><circle cx="-6" cy="5" r="2.4" fill="${NOIR}"/><circle cx="6" cy="5" r="2.4" fill="${NOIR}"/></g>`, 30, (.95 - k * .025) * 30, false)));
    for (let k = 0; k < 6; k++) a.push(K.surPiste(.05 - (k + 1) * .008, `<path d="M0 -4Q5 -3 6 0Q5 3 0 4Q-3 0 0 -4Z" fill="${k % 2 ? "#F28AA8" : "#FFB8CC"}" stroke="#B8405E" stroke-width=".6" transform="scale(1.3)"/>`, 30, 1.5 - (k + 1) * .24, false));
    K.particules(8, "#FFF4D0", 2.4, "derive");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#gt-vichy)"/>`, "#F8D8C8", .08); RES.portraits = PORTR; RES.lieux = { chapelier: [Math.round(HX + 40), Math.round(HY - 240)], flaque: [Math.round(L.cx), Math.round(L.cy)] }; return RES;
  }

  /* ---------- Juin · La Bataille des étoiles (v16.x, refonte au niveau de l'Arène) ----------
     Grandes scènes illustrées autour de la piste-hyperespace : la station de combat qui tire, deux destroyers, le duel au sabre
     au-dessus du puits du réacteur, l'empereur et ses éclairs devant la verrière, le petit maître vert qui soulève un chasseur du marais,
     les deux droïdes à la table d'holo-échecs (le monument 3D « holodome »), le cargo rond à quai, le chasseur de primes,
     la planète aux deux soleils, et l'Escadron Versus (les 4 pilotes, leurs vrais portraits posés par l'appli). Tout est dessiné ici. */
  function peindreEtoiles4(T, Z, def) {
    const K = kit(T, def, 67, "s4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", VIS = K.anime ? 0 : 1, INK = `stroke="#05070F" stroke-width="1.2"`;
    const hA = [], haloA = (x, y, R, c, op) => { const id = "s4-a" + c.replace("#", ""); if (!hA.includes(id)) { hA.push(id); a.unshift(`<radialGradient id="${id}" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset=".35" stop-color="${c}" stop-opacity=".4"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`); } a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#${id})" opacity="${op}"/>`); };
    a.unshift(`<radialGradient id="s4-aor" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".45" stop-color="#E8B83A"/><stop offset="1" stop-color="#8A5A12"/></radialGradient>`);
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const bulle = (x, y, txt, du, deb, coul) => a.push(`<g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.12;.18;.8;.88;1" dur="${du}s" begin="${deb || 0}s" repeatCount="indefinite"/>`)}<rect x="${f(x - txt.length * 3.1 - 8)}" y="${f(y - 12)}" width="${f(txt.length * 6.2 + 16)}" height="21" rx="10" fill="#0B1020" fill-opacity=".94" stroke="${coul || "#7CC8FF"}" stroke-width="1.4"/><path d="M${f(x - 4)} ${f(y + 9)}l3 7l5 -7" fill="#0B1020" stroke="${coul || "#7CC8FF"}" stroke-width="1"/><text x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" font-family="system-ui, sans-serif" font-style="italic" font-weight="600" font-size="11.5" fill="#E8F4FF">${txt}</text></g>`);
    const sabre = (x1, y1, x2, y2, c, l) => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${l * 3.2}" stroke-linecap="round" opacity=".35"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${l * 1.7}" stroke-linecap="round" opacity=".8"/><path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="#FFFFFF" stroke-width="${l * .8}" stroke-linecap="round"/>`;
    const eclair = (x1, y1, x2, y2, n, amp) => { let d = `M${f(x1)} ${f(y1)}`; for (let k = 1; k < n; k++) { const t = k / n; d += `L${f(x1 + (x2 - x1) * t + (r() - .5) * amp)} ${f(y1 + (y2 - y1) * t + (r() - .5) * amp)}`; } return d + `L${f(x2)} ${f(y2)}`; };
    // une seule lumière : le soleil en haut à gauche ; toute ombre portée part vers le bas à droite (OX, OY par unité de hauteur)
    const OX = .8, OY = 1;
    const tieHex = (sombre) => { let d = ""; for (const sd of [-1, 1]) { const pts = []; for (let q = 0; q < 6; q++) { const t = q / 6 * TAU; pts.push(f(Math.cos(t) * 7) + "," + f(sd * 19 + Math.sin(t) * 13)); } d += `<polygon points="${pts.join(" ")}" fill="${sombre ? "#000" : "#2E333C"}" ${sombre ? "" : INK}/>` + (sombre ? "" : `<path d="M0 ${sd * 19}L${f(7)} ${sd * 19}M0 ${sd * 19}L-7 ${sd * 19}M0 ${sd * 19}l3.5 ${-11.3}M0 ${sd * 19}l-3.5 ${-11.3}M0 ${sd * 19}l3.5 11.3M0 ${sd * 19}l-3.5 11.3" stroke="#6A707A" stroke-width=".8"/>`); }
      return `<path d="M0 -7V7" stroke="${sombre ? "#000" : "#5A606A"}" stroke-width="3.4"/>${d}<circle r="6.5" fill="${sombre ? "#000" : "#8A929C"}" ${sombre ? "" : INK}/>${sombre ? "" : `<circle cx="1.5" r="3.4" fill="#141820" stroke="#5A606A" stroke-width=".8"/><path d="M1.5 -3.4v6.8M-1.9 0h6.8" stroke="#5A606A" stroke-width=".6"/>`}`; };
    const xwing = (c, coc) => `<path d="M-12 -24L2 -24L6 -5L-6 -5ZM-12 24L2 24L6 5L-6 5Z" fill="#D8DCE0" ${INK}/><path d="M-8 -22h9M-8 22h9" stroke="${c}" stroke-width="2.6"/><path d="M0 -25h22M0 25h22M-4 -21h18M-4 21h18" stroke="#9AA3AE" stroke-width="1.6"/><path d="M-16 -4.5L22 -2L30 0L22 2L-16 4.5Z" fill="#ECEFF2" ${INK}/><path d="M6 -2.4h14v4.8h-14z" fill="${c}"/><rect x="-18" y="-7" width="8" height="14" rx="2" fill="#B8BEC6" ${INK}/>${coc ? "" : `<ellipse cx="2" cy="0" rx="5" ry="3" fill="#1A2A40" stroke="#7CC8FF" stroke-width=".6"/>`}<path d="M-18 -5h-3M-18 5h-3M-12 -24h-3M-12 24h-3" stroke="#FFB86A" stroke-width="2.4" stroke-linecap="round"/>`;
    const tie = () => `<path d="M-3 -18v36M3 -18v36" stroke="#2A2E36" stroke-width="2.2"/><path d="M-5 -18h10M-5 18h10" stroke="#5A606A" stroke-width="3"/><path d="M-6 0h12" stroke="#5A606A" stroke-width="3"/><circle r="6" fill="#8A929C" ${INK}/><circle r="3.2" fill="#1A1E26" stroke="#5A606A" stroke-width=".8"/>`;
    const destroyer = L => { const t = L * .55, b = -L * .45, w = L * .33; let d = `<polygon points="${f(t)},0 ${f(b)},${f(-w)} ${f(b)},${f(w)}" fill="#AEB6C0" ${INK}/><polygon points="${f(t)},0 ${f(b)},${f(-w)} ${f(b)},0" fill="#C8CFD7"/><polygon points="${f(t * .92)},0 ${f(b)},${f(-w * .34)} ${f(b)},${f(w * .34)}" fill="#BCC4CD" stroke="#6E7680" stroke-width="1"/>`;
      for (let k = 1; k < 7; k++) { const u = b + (t - b) * k / 7, hw = w * (1 - k / 7); d += `<path d="M${f(u)} ${f(-hw)}L${f(u)} ${f(hw)}" stroke="#7E8792" stroke-width=".8" opacity=".7"/>`; }
      for (let k = 0; k < 46; k++) { const u = b + r() * (t - b) * .85, hw = w * (1 - (u - b) / (t - b)) * .9, v = (r() * 2 - 1) * hw; d += `<rect x="${f(u)}" y="${f(v)}" width="${f(3 + r() * L * .03)}" height="${f(2 + r() * L * .015)}" fill="${r() < .5 ? "#7E8792" : "#DDE2E8"}" opacity=".8"/>`; }
      d += `<rect x="${f(b + L * .02)}" y="${f(-w * .2)}" width="${f(L * .26)}" height="${f(w * .4)}" fill="#9AA3AE" ${INK}/><rect x="${f(b + L * .06)}" y="${f(-w * .13)}" width="${f(L * .16)}" height="${f(w * .26)}" fill="#C0C7CF" ${INK}/><rect x="${f(b + L * .07)}" y="${f(-w * .42)}" width="${f(L * .05)}" height="${f(w * .84)}" rx="2" fill="#8A929C" ${INK}/><circle cx="${f(b + L * .095)}" cy="${f(-w * .36)}" r="${f(L * .022)}" fill="#D8DEE6" ${INK}/><circle cx="${f(b + L * .095)}" cy="${f(w * .36)}" r="${f(L * .022)}" fill="#D8DEE6" ${INK}/>`;
      [-.2, 0, .2].forEach(v => d += `<circle cx="${f(b - 2)}" cy="${f(w * v)}" r="${f(L * (v ? .028 : .04))}" fill="#9FE0FF" stroke="#2A6AA8" stroke-width="1.5"/>`); return d; };
    // ---- 0. l'espace (coin haut gauche, au-delà du bord de la station) : étoiles
    s.push(`<radialGradient id="s4-esp" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(30 30) scale(520)"><stop offset="0" stop-color="#3A3A5A"/><stop offset=".4" stop-color="#121633"/><stop offset="1" stop-color="#04050C"/></radialGradient>`);
    for (let k = 0; k < 90; k++) { const x = r() * 380, y = r() * 170, br = r(); s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.3 + br * br * 1.3)}" fill="${br > .85 ? "#FFE8C8" : "#FFFFFF"}" opacity="${(.4 + r() * .6).toFixed(2)}"/>`); }
    // ---- 1. la coque de la station : une sphère immense (centre loin sous la carte)
    const CX0 = 760, CY0 = 1480, RL = 1540;
    s.push(`<radialGradient id="s4-coque" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(90 40) scale(1250)"><stop offset="0" stop-color="#F2F0E8"/><stop offset=".2" stop-color="#B9BEC4"/><stop offset=".45" stop-color="#717A86"/><stop offset=".75" stop-color="#3A404C"/><stop offset="1" stop-color="#1A1E26"/></radialGradient>`);
    s.push(`<clipPath id="s4-ccoque"><circle cx="${CX0}" cy="${CY0}" r="${RL}"/></clipPath><circle cx="${CX0}" cy="${CY0}" r="${RL + 14}" fill="#9FD0FF" opacity=".25" filter="url(#s4-flou8)"/><circle cx="${CX0}" cy="${CY0}" r="${RL}" fill="url(#s4-coque)"/><g clip-path="url(#s4-ccoque)">`);
    { const t0 = -2.42, t1 = -1.12, dt = .046, cell = (q0, q1, a0, a1) => { const p = (q, t) => f(CX0 + Math.cos(t) * q) + " " + f(CY0 + Math.sin(t) * q); return `M${p(q0, a0)}L${p(q1, a0)}L${p(q1, a1)}L${p(q0, a1)}Z`; };
      let clair = "", sombre = "", tres = "";
      for (let q = RL; q > 760; q -= 44) for (let t = t0; t < t1; t += dt) { const v = r(); if (v < .22) clair += cell(q, q - 44, t, t + dt); else if (v < .42) sombre += cell(q, q - 44, t, t + dt); else if (v < .48) tres += cell(q, q - 44, t, t + dt); }
      s.push(`<path d="${clair}" fill="#FFFFFF" opacity=".08"/><path d="${sombre}" fill="#000" opacity=".1"/><path d="${tres}" fill="#000" opacity=".2"/>`);
      let lat = "", mer = ""; for (let q = RL - 44; q > 760; q -= 44) lat += `M${f(CX0 + Math.cos(t0) * q)} ${f(CY0 + Math.sin(t0) * q)}A${q} ${q} 0 0 1 ${f(CX0 + Math.cos(t1) * q)} ${f(CY0 + Math.sin(t1) * q)}`;
      for (let t = t0; t < t1; t += dt) mer += `M${f(CX0 + Math.cos(t) * RL)} ${f(CY0 + Math.sin(t) * RL)}L${f(CX0 + Math.cos(t) * 760)} ${f(CY0 + Math.sin(t) * 760)}`;
      s.push(`<path d="${lat}" fill="none" stroke="#1E232B" stroke-width="1.6" opacity=".5"/><path d="${lat}" fill="none" stroke="#FFFFFF" stroke-width=".8" opacity=".22" transform="translate(-1 -1.4)"/><path d="${mer}" stroke="#1E232B" stroke-width="1" opacity=".35"/>`);
      let gb = "", go = ""; for (let k = 0; k < 380; k++) { const x = r() * W, y = r() * H; if (K.dT(x, y) < 44 || K.inside(x, y)) continue; const w = 3 + r() * 13, h = 2 + r() * 6; go += `M${f(x + 2)} ${f(y + 2.5)}h${f(w)}v${f(h)}h${f(-w)}z`; gb += `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`; }
      s.push(`<path d="${go}" fill="#000" opacity=".25"/><path d="${gb}" fill="#B8C0CA" opacity=".4"/>`);
      let fe = ""; for (let k = 0; k < 300; k++) { const x = r() * W, y = r() * H; if (K.dT(x, y) < 44 || K.inside(x, y) || r() > (x + y) / 1300) continue; const n = 1 + Math.floor(r() * 5); for (let j = 0; j < n; j++) fe += `M${f(x + j * 4)} ${f(y)}h2.2v1.6h-2.2z`; }
      s.push(`<path d="${fe}" fill="#FFE6A8" opacity=".75"/>`); }
    // la lumière unique : un grand halo chaud en haut à gauche, la coque plonge dans l'ombre froide vers le bas à droite
    s.push(`<radialGradient id="s4-chaud" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(26 26) scale(760)"><stop offset="0" stop-color="#FFD48A" stop-opacity=".6"/><stop offset=".45" stop-color="#FFB860" stop-opacity=".2"/><stop offset="1" stop-color="#FFB860" stop-opacity="0"/></radialGradient><radialGradient id="s4-froid" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1080 720) scale(980)"><stop offset="0" stop-color="#050A1C" stop-opacity=".85"/><stop offset=".6" stop-color="#0A1838" stop-opacity=".35"/><stop offset="1" stop-color="#0A1838" stop-opacity="0"/></radialGradient>`);
    s.push(`<rect width="${W}" height="${H}" fill="url(#s4-chaud)"/><rect width="${W}" height="${H}" fill="url(#s4-froid)"/></g>`);
    s.push(`<circle cx="${CX0}" cy="${CY0}" r="${RL}" fill="none" stroke="#FFF4E0" stroke-width="2.4" opacity=".8"/><circle cx="${CX0}" cy="${CY0}" r="${RL - 6}" fill="none" stroke="#FFFFFF" stroke-width="8" opacity=".12"/>`);
    K.halo(26, 26, 420, "#FFE2A8", .55); s.push(`<path d="M26 26L560 420" stroke="#FFF6DC" stroke-width="90" opacity=".05" filter="url(#s4-flou8)"/>`);
    // ---- 2. LE HÉROS : toute la boucle est la grande baie de la salle du trône (vue en coupe, à travers la vitre)
    //      haut : le duel sur la passerelle ; jambe gauche : le puits du réacteur ; jambe droite : le trône et ses marches
    const DX = 430, DY = 318, DS = 2.6, EX = 792, EY = 318, ES = 2.3;
    s.push(`<clipPath id="s4-cvit"><path d="${K.piste}"/></clipPath><linearGradient id="s4-salle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E0A16"/><stop offset=".45" stop-color="#2C0E1E"/><stop offset="1" stop-color="#0A0610"/></linearGradient>`);
    s.push(`<radialGradient id="s4-puits" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#E8FBFF"/><stop offset=".18" stop-color="#7CD8FF"/><stop offset=".5" stop-color="#1E5AA8"/><stop offset="1" stop-color="#0A1028" stop-opacity="0"/></radialGradient><radialGradient id="s4-rond" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#2E2858"/><stop offset="1" stop-color="#0A0818"/></radialGradient>`);
    s.push(`<g clip-path="url(#s4-cvit)"><rect width="${W}" height="${H}" fill="url(#s4-salle)"/>`);
    // le mur du fond : grandes nervures verticales à peine éclairées
    { let d = ""; for (let x = 200; x < 900; x += 54) d += `M${x} 100V720`; s.push(`<path d="${d}" stroke="#000" stroke-width="16" opacity=".28"/><path d="${d}" stroke="#7A2A44" stroke-width="1.4" opacity=".35" transform="translate(9 0)"/>`); }
    // la verrière ronde derrière le trône : étoiles et flotte
    { const vx = 800, vy = 214, vr = 104; s.push(`<circle cx="${vx}" cy="${vy}" r="${vr}" fill="url(#s4-rond)"/>`); for (let k = 0; k < 60; k++) { const t = r() * TAU, d2 = Math.sqrt(r()) * (vr - 6); s.push(`<circle cx="${f(vx + Math.cos(t) * d2)}" cy="${f(vy + Math.sin(t) * d2)}" r="${f(.4 + r() * .9)}" fill="#FFFFFF" opacity=".8"/>`); }
      [[-58, -20, .34, 20], [52, -36, .26, 160], [56, 40, .22, 200]].forEach(([u, v, sc2, rot]) => s.push(`${G(vx + u, vy + v, sc2, rot)}${destroyer(160)}</g>`));
      s.push(`<circle cx="${vx}" cy="${vy}" r="${vr}" fill="none" stroke="#0E1016" stroke-width="12"/>`); for (let k = 0; k < 8; k++) { const t = k / 8 * TAU + PI / 8; s.push(`<path d="M${f(vx + Math.cos(t) * 24)} ${f(vy + Math.sin(t) * 24)}L${f(vx + Math.cos(t) * vr)} ${f(vy + Math.sin(t) * vr)}" stroke="#0E1016" stroke-width="5"/>`); } s.push(`<circle cx="${vx}" cy="${vy}" r="24" fill="none" stroke="#0E1016" stroke-width="5"/>`); }
    // jambe gauche : le puits du réacteur, qui plonge sous la passerelle (lumière bleue qui monte)
    { const px = 312; s.push(`<ellipse cx="${px}" cy="640" rx="150" ry="330" fill="url(#s4-puits)" opacity=".95"/>`);
      for (let k = 0; k < 9; k++) { const y = 352 + k * 30, rx = 98 - k * 7, ry = 15 - k * 1.1; s.push(`<ellipse cx="${px}" cy="${y}" rx="${rx}" ry="${f(ry)}" fill="none" stroke="#0A1430" stroke-width="5" opacity=".7"/><ellipse cx="${px}" cy="${y + 2}" rx="${rx}" ry="${f(ry)}" fill="none" stroke="#9FE6FF" stroke-width="1.6" opacity="${(.25 + k * .08).toFixed(2)}"/>`); }
      s.push(`<path d="M${px - 104} 330L${px - 42} 720M${px + 104} 330L${px + 42} 720" stroke="#05070F" stroke-width="10" opacity=".8"/>`); }
    // jambe droite : les marches du trône (lumière violette des éclairs)
    { for (let k = 0; k < 9; k++) { const y = 392 + k * 26, w = 112 + k * 14; s.push(`<rect x="${f(EX - w / 2)}" y="${y}" width="${w}" height="26" fill="${mixHex("#2A2E3A", "#100C18", k / 9)}"/><path d="M${f(EX - w / 2)} ${y}h${w}" stroke="#B89AFF" stroke-width="1.6" opacity="${(.7 - k * .06).toFixed(2)}"/>`); }
      // les deux gardes rouges sur les marches
      [[718, 506], [842, 506]].forEach(([x, y]) => s.push(`${G(x, y, 2.4)}<ellipse cx="3" cy="1" rx="10" ry="2.5" fill="#000" opacity=".5"/><path d="M-8 0L-6 -26Q0 -30 6 -26L8 0Z" fill="#B0162A" ${INK}/><path d="M-6 -26Q-7 -38 0 -39Q7 -38 6 -26Z" fill="#C81E34" ${INK}/><path d="M-3 -32h6v3h-6z" fill="#1A0A0E"/><path d="M9 2V-42" stroke="#8A8A94" stroke-width="1.4"/><path d="M8 -42l1 -4l1 4z" fill="#C8CDD4"/><path d="M-5 -24q5 -3 10 0M-1 -24v22" stroke="#FF6A7A" stroke-width=".8" fill="none" opacity=".6"/></g>`)); }
    // l'empereur à capuche sur son trône, tourné vers le duel, mains crochues tendues
    s.push(`${G(EX, EY, ES)}<path d="M-30 30h82v10h-82z" fill="#1A1E26" ${INK}/><path d="M-4 30V-56Q-4 -66 16 -68Q36 -66 36 -56V30Z" fill="#262A33" ${INK}/><path d="M-4 30V-56Q-4 -66 16 -68" fill="none" stroke="#B89AFF" stroke-width="1" opacity=".7"/><path d="M4 -52h24v70h-24z" fill="#1A1D24"/><path d="M-20 -2h26v8h-26z" fill="#3A3F48" ${INK}/>
      <path d="M-16 30L-12 -2Q-6 -24 4 -24Q14 -22 16 -2L18 30Z" fill="#0A0A10" ${INK}/><path d="M-14 4Q-28 8 -30 30L-6 30Z" fill="#0C0C12" ${INK}/><path d="M-12 -2Q-20 4 -26 26" stroke="#3A3A4A" stroke-width=".8" fill="none"/>
      <path d="M-12 -18Q-16 -46 2 -48Q18 -46 15 -20Q8 -26 2 -27Q-6 -26 -12 -18Z" fill="#0A0A10" ${INK}/><path d="M-12 -18Q-16 -46 2 -48" fill="none" stroke="#C8A8FF" stroke-width="1" opacity=".8"/>
      <path d="M-9 -24Q-9 -38 -1 -40Q6 -38 6 -28Q0 -18 -9 -24Z" fill="#CFC6AA"/><path d="M-9 -24Q-9 -38 -1 -40Q2 -36 1 -30Q-2 -22 -9 -24Z" fill="#E4DCC2"/>
      <path d="M-7 -34q2 -1 4 0M0 -34q2 -1 4 0M-8 -27q2 1 3 0M-6 -38q3 -1 6 0" stroke="#8A8270" stroke-width=".5" fill="none"/>
      <ellipse cx="-4.6" cy="-31.5" rx="1.7" ry="1.1" fill="#FFD23A"/><ellipse cx="1" cy="-31.5" rx="1.5" ry="1" fill="#FFD23A"/><circle cx="-4.6" cy="-31.5" r=".5" fill="#5A2A00"/><circle cx="1" cy="-31.5" r=".5" fill="#5A2A00"/>
      <path d="M-7.6 -30Q-10.5 -26.5 -7.4 -25.6" stroke="#8A8270" stroke-width=".8" fill="none"/><path d="M-7 -23Q-3.6 -21 0 -23.4" stroke="#4A2A1A" stroke-width=".9" fill="none"/>
      <path d="M-6 -16Q-20 -20 -30 -17L-30 -10Q-18 -8 -4 -8Z" fill="#0C0C12" ${INK}/><path d="M-3 -4Q-16 -3 -27 0L-27 7Q-15 6 -1 4Z" fill="#0C0C12" ${INK}/>
      <circle cx="-33" cy="-13.5" r="2.8" fill="#CFC6AA"/><path d="M-34 -16q-4 -4 -6 -1.5M-35.5 -14q-5 -1.5 -5.5 2M-35 -12q-4 1 -3.5 4M-33 -11q-1 3 1 4" stroke="#CFC6AA" stroke-width="1.3" stroke-linecap="round" fill="none"/>
      <circle cx="-30" cy="3.5" r="2.6" fill="#CFC6AA"/><path d="M-31 1q-4 -3.5 -6 -1M-32.5 3q-5 -1 -5 2.2M-32 5q-3.5 1.5 -2.5 4.5" stroke="#CFC6AA" stroke-width="1.3" stroke-linecap="round" fill="none"/></g>`);
    K.halo(EX - 60, EY - 40, 210, "#9B5AFF", .32);
    // la passerelle du duel, au-dessus du puits
    s.push(`<path d="M196 ${DY}H672v10H196z" fill="#3A4250" ${INK}/><path d="M196 ${DY}H672" stroke="#9FE0FF" stroke-width="1.6"/><path d="M196 ${DY + 10}H672" stroke="#5FC8FF" stroke-width="3" opacity=".5"/>${[230, 290, 350, 410, 470, 530, 590, 650].map(u => `<rect x="${u - 3}" y="${DY + 3}" width="6" height="4" fill="#FF4B4B"/>`).join("")}`);
    s.push(`<g clip-path="url(#s4-cvit)">`); K.halo(DX - 90, DY - 120, 170, "#FF3B3B", .22); K.halo(DX + 100, DY - 110, 150, "#2A9BFF", .2); s.push(`</g>`);
    // le duel : seigneur noir (casque, cape qui flotte, pupitre lumineux) contre le jeune chevalier (visage dessiné)
    s.push(`${G(DX, DY, DS)}<ellipse cx="0" cy="1" rx="62" ry="2" fill="#000" opacity=".5"/>
        <g transform="translate(-34 0)"><path d="M-12 -44Q-30 -42 -40 -24Q-46 -10 -56 0L-22 0Q-12 -12 -9 -30Z" fill="#050508" ${INK}/><path d="M-40 -24Q-46 -10 -56 0" stroke="#3A3A4A" stroke-width=".8" fill="none"/><path d="M-26 -30Q-34 -16 -40 0" stroke="#1A1A22" stroke-width="1" fill="none"/><path d="M12 -44Q22 -30 22 -12L26 0H14Z" fill="#050508" ${INK}/><path d="M14 -40Q21 -28 22 -12L26 0" stroke="#FF4A4A" stroke-width=".9" fill="none" opacity=".75"/>
          <path d="M-11 -16L-2 -16L-3 0L-12 0ZM2 -16L11 -16L12 0L3 0Z" fill="#0A0A0E" ${INK}/><path d="M-12 -4h9M3 -4h9" stroke="#2A2A34" stroke-width="1.4"/>
          <path d="M-14 -44L14 -44L12 -18L-12 -18Z" fill="#101016" ${INK}/><path d="M-12 -21h24v4h-24z" fill="#2A2A32"/><rect x="-3" y="-21.5" width="6" height="5" fill="#A8B0BA" ${INK}/>
          <rect x="-7.5" y="-39" width="15" height="10" rx="1" fill="#24242C" stroke="#6A6A74" stroke-width=".5"/><rect x="-5.5" y="-37" width="4" height="2" fill="#FF4B4B"/><rect x="-.5" y="-37" width="2" height="2" fill="#4BFF6A"/><rect x="2.5" y="-37" width="2" height="2" fill="#4BB0FF"/><path d="M-5.5 -33h10M-5.5 -31h10" stroke="#8A8A94" stroke-width=".6"/>
          <path d="M-12 -41Q-14 -34 4 -31" stroke="#0E0E14" stroke-width="5.5" stroke-linecap="round" fill="none"/><path d="M12 -41Q14 -33 8 -31" stroke="#0E0E14" stroke-width="5.5" stroke-linecap="round" fill="none"/><circle cx="5.5" cy="-31" r="2.6" fill="#1A1A22" ${INK}/>
          <path d="M-10 -52L-16 -42L16 -42L10 -52Z" fill="#0A0A0E" ${INK}/><path d="M-10.5 -51Q-11.5 -67 0 -68Q11.5 -67 10.5 -51Z" fill="#0A0A0E" ${INK}/>
          <path d="M-7 -58.5L7 -58.5L6 -50L3 -46L-3 -46L-6 -50Z" fill="#1C1C26"/><path d="M-6.6 -58L-1 -57.4L-1.8 -54L-6 -55Z M6.6 -58L1 -57.4L1.8 -54L6 -55Z" fill="#33333F"/><path d="M-6 -57.4l2 .2M4 -57.2l2 .2" stroke="#FF6A6A" stroke-width=".7" opacity=".8"/>
          <path d="M-2.6 -51L2.6 -51L0 -46.6Z" fill="#45454F"/><path d="M-1.6 -50v2.4M0 -50v3M1.6 -50v2.4" stroke="#1A1A22" stroke-width=".4"/><path d="M-8.4 -59Q0 -62 8.4 -59" stroke="#45454F" stroke-width="1" fill="none"/>
          <path d="M-7 -64Q-2 -67 4 -66" stroke="#FFFFFF" stroke-width="1.2" opacity=".35" fill="none"/><path d="M8.6 -62Q11 -56 10.4 -51L15 -43" stroke="#FF4A4A" stroke-width="1" fill="none" opacity=".8"/></g>
        <g transform="translate(36 0)"><path d="M-7 0L-6 -18L-1 -18L-1 0ZM1 0L1 -18L6 -18L7 0Z" fill="#16161C" ${INK}/><path d="M-8 -1h7.5M.5 -1h7.5" stroke="#05050A" stroke-width="2.4"/>
          <path d="M-10 -18L-9 -38Q0 -42 9 -38L10 -18Z" fill="#1C1C22" ${INK}/><path d="M-4.5 -40L0 -33L4.5 -40" stroke="#4A4A56" stroke-width="1" fill="none"/><path d="M-10 -21h20" stroke="#2E2A26" stroke-width="2.6"/><path d="M-9 -37Q-9.5 -30 -8 -22" stroke="#4BB0FF" stroke-width=".9" fill="none" opacity=".8"/>
          <path d="M-8.5 -36.5Q-12 -32 -7.5 -30.5" stroke="#1C1C22" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M8.5 -36.5Q7 -30 -4 -30" stroke="#1C1C22" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="-6.5" cy="-30.5" r="2.2" fill="#2A2A30" ${INK}/>
          <path d="M-2.5 -43h5v4h-5z" fill="#E2B896"/><ellipse cx="0" cy="-50" rx="7.4" ry="8.6" fill="#F0CBA8" ${INK}/><ellipse cx="7.2" cy="-49.5" rx="1.3" ry="2.1" fill="#E2B896" ${INK}/>
          <path d="M-7.8 -51Q-9.4 -61.5 -.5 -60.5Q8.8 -61.5 8 -52Q6.6 -56.5 1.5 -56.6Q-4 -56 -7.8 -51Z" fill="#C8984E" ${INK}/><path d="M-5 -58q4 -3 9 -1" stroke="#E8C07A" stroke-width=".8" fill="none"/>
          <path d="M-5.6 -53.4L-1.8 -52.6M1.2 -52.6L4.4 -53.6" stroke="#7A5A30" stroke-width="1" stroke-linecap="round"/><ellipse cx="-3.6" cy="-50.4" rx="1.2" ry="1.4" fill="#FFFFFF"/><ellipse cx="2.4" cy="-50.4" rx="1.2" ry="1.4" fill="#FFFFFF"/><circle cx="-4.1" cy="-50.3" r=".8" fill="#2A4A7A"/><circle cx="1.9" cy="-50.3" r=".8" fill="#2A4A7A"/>
          <path d="M-1 -49.6L-2 -46.4L-.2 -46" stroke="#B07A5A" stroke-width=".6" fill="none"/><path d="M-3 -44.2Q-.6 -43.4 1.8 -44.2" stroke="#9A4A3A" stroke-width=".8" fill="none"/><path d="M-7.2 -48q1 4 3.6 5.6" stroke="#5FB8FF" stroke-width=".8" fill="none" opacity=".7"/></g></g>`);
    // reflets de la vitre (soleil en haut à gauche)
    s.push(`<path d="M300 100l-120 300h40l120 -300zM380 100l-120 300h14l120 -300z" fill="#FFFFFF" opacity=".05"/></g>`);
    // sabres animés, éclat blanc au choc, halos rouge/bleu
    a.push(`${G(DX, DY, DS)}<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-6 -28 -31;14 -28 -31;-6 -28 -31" dur="1.6s" repeatCount="indefinite"/>`)}${sabre(-28, -31, 10, -70, "#FF2A2A", 1.5)}<rect x="-31.5" y="-33" width="7" height="4" rx="1" fill="#9AA3AE" transform="rotate(-45 -28 -31)"/></g><g>${an(`<animateTransform attributeName="transform" type="rotate" values="10 29.5 -30.5;-12 29.5 -30.5;10 29.5 -30.5" dur="1.6s" repeatCount="indefinite"/>`)}${sabre(29.5, -30.5, -8, -70, "#2A9BFF", 1.5)}<rect x="26" y="-32.5" width="7" height="4" rx="1" fill="#C8CDD4" transform="rotate(45 29.5 -30.5)"/></g><g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;1;0;0;1;0" keyTimes="0;.06;.2;.5;.56;1" dur="1.6s" repeatCount="indefinite"/>`)}<path d="M1 -71l1.4 5.4l5.6 1.6l-5.6 1.6l-1.4 5.4l-1.4 -5.4l-5.6 -1.6l5.6 -1.6z" fill="#FFFFFF"/></g></g>`);
    haloA(DX - 40, DY - 150, 150, "#FF3B3B", .45); haloA(DX + 70, DY - 150, 150, "#2A9BFF", .45);
    // éclairs de l'empereur : épais, lumineux, qui baignent la salle de violet
    { const ex = EX - 36 * ES, ey = EY - 14 * ES, ex2 = EX - 33 * ES, ey2 = EY + 3 * ES, cx = DX + 120, cy = DY - 92; let arcs = "";
      for (let k = 0; k < 4; k++) arcs += `<path d="${eclair(k % 2 ? ex2 : ex, k % 2 ? ey2 : ey, cx + k * 4, cy + k * 16, 10, 26)}" stroke="#F4E8FF" stroke-width="${k < 2 ? 3.2 : 2}" fill="none" stroke-linejoin="round"/>`;
      haloA(-999, -999, 1, "#9B5AFF", 0);
      a.push(`<g>${an(`<animate attributeName="opacity" values="1;.25;1;.6;1;.15;1" keyTimes="0;.1;.2;.3;.45;.55;1" dur="2.2s" repeatCount="indefinite"/>`)}<circle cx="${f((ex + cx) / 2)}" cy="${f((ey + cy) / 2 + 20)}" r="230" fill="url(#s4-a9B5AFF)" opacity=".4"/><g stroke="#9B5AFF" stroke-width="14" opacity=".4" fill="none" stroke-linejoin="round">${arcs.replace(/stroke="#F4E8FF" stroke-width="[\d.]+"/g, "")}</g><g stroke="#C8A0FF" stroke-width="6" opacity=".6" fill="none" stroke-linejoin="round">${arcs.replace(/stroke="#F4E8FF" stroke-width="[\d.]+"/g, "")}</g>${arcs}</g>`);
      haloA(ex - 6, ey + 20, 70, "#9B5AFF", .7); }
    // ---- 3. le hangar ouvert dans la coque, entre les deux branches de la tranchée : le cargo rond et les deux droïdes
    { const hx0 = 466, hx1 = 616, hy0 = 386, hx = (hx0 + hx1) / 2, hy = 566;
      s.push(`<linearGradient id="s4-hang" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2620"/><stop offset="1" stop-color="#3E3426"/></linearGradient>`); s.push(`<path d="M${hx0} ${hy0}H${hx1}V720H${hx0}Z" fill="url(#s4-hang)"/>`);
      s.push(`<path d="M${hx0} ${hy0}H${hx1}l-18 18H${hx0 + 18}V720H${hx0}Z" fill="#07090C" opacity=".85"/><path d="M${hx1} ${hy0}V720h-12V${hy0 + 18}Z" fill="#8A939E" opacity=".9"/>`);
      let gr = ""; for (let k = 1; k < 5; k++) gr += `M${hx0 + 18 + k * 26} ${hy0 + 18}V720`; for (let k = 1; k < 12; k++) gr += `M${hx0 + 18} ${hy0 + 18 + k * 28}H${hx1 - 12}`; s.push(`<path d="${gr}" stroke="#FFC86A" stroke-width=".7" opacity=".22"/>`);
      K.halo(hx + 6, hy, 120, "#FFB860", .3);
      s.push(`${G(hx + 10, hy + 12, 1.3, -90)}<g transform="scale(1 -1)"><path d="M-38 -8A40 40 0 1 1 -38 8L-40 8L-40 -8Z" fill="#000" opacity=".55" filter="url(#s4-flou)"/></g></g>`);
      s.push(`${G(hx, hy, 1.3, -90)}<g transform="scale(1 -1)"><path d="M-38 -8A40 40 0 1 1 -38 8L-40 8L-40 -8Z" fill="#D2D6DA" ${INK}/><path d="M30 -24L62 -18L62 -6L36 -8ZM30 24L62 18L62 6L36 8Z" fill="#BCC1C7" ${INK}/><path d="M36 -12h22M36 12h22" stroke="#8A9098" stroke-width="1"/>
        <path d="M-6 -36L4 -50L26 -44L22 -32Z" fill="#B8BCC2" ${INK}/><circle cx="22" cy="-44" r="6" fill="#B8BCC2" ${INK}/><path d="M20 -47l6 3" stroke="#1A2A40" stroke-width="3"/><circle r="12" fill="#A8AEB6" ${INK}/><circle r="6" fill="#8A9098" ${INK}/><path d="M-4 -2h-14M-4 2h-14" stroke="#5A606A" stroke-width="1.6"/>
        ${[-30, -15, 15, 30].map(v => `<path d="M-14 ${v * .9}L-34 ${v}" stroke="#8A9098" stroke-width="1"/>`).join("")}<circle cx="-14" cy="24" r="7" fill="#B8BCC2" ${INK}/><path d="M-18 21l8 6" stroke="#6E747C" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map(q => `<rect x="${f(-26 + q * 3.5)}" y="${f(-30 + q * 2)}" width="3" height="3" fill="#C8783A" opacity=".75"/>`).join("")}<path d="M-30 -20A36 36 0 0 1 20 -32" stroke="#FFFFFF" stroke-width="2" opacity=".5" fill="none"/></g></g>`);
      a.push(`<path d="M${f(hx - 46)} ${f(hy + 38)}A52 30 0 0 0 ${f(hx + 46)} ${f(hy + 38)}" stroke="#7CC8FF" stroke-width="6" fill="none" opacity=".8">${an(`<animate attributeName="opacity" values=".35;.95;.35" dur="1.8s" repeatCount="indefinite"/>`)}</path>`);
      // les deux droïdes au pied du cargo, ombre vers le bas à droite
      const dy = 694; s.push(`<ellipse cx="${hx - 12}" cy="${dy + 6}" rx="22" ry="5" fill="#000" opacity=".45" filter="url(#s4-flou)" transform="translate(6 2)"/><ellipse cx="${hx + 30}" cy="${dy + 6}" rx="14" ry="4" fill="#000" opacity=".45" filter="url(#s4-flou)" transform="translate(6 2)"/>`);
      s.push(`${G(hx - 20, dy - 18, 1.7)}<path d="M-12 -4h-4l-2 18h7zM12 -4h4l2 18h-7z" fill="#E8ECEF" ${INK}/><rect x="-10" y="-8" width="20" height="20" rx="2" fill="#F2F4F6" ${INK}/><path d="M-10 -8a10 10 0 0 1 20 0z" fill="#C8CED6" ${INK}/><rect x="-7" y="-2" width="5" height="9" fill="#2A5AB8"/><rect x="2" y="-2" width="5" height="4" fill="#2A5AB8"/><rect x="2" y="4" width="5" height="3" fill="#9AA3AE"/><rect x="-6" y="-14" width="6" height="3" fill="#2A5AB8"/><circle cx="-3" cy="-12.5" r="1.4" fill="#1A1E26"/></g>`);
      a.push(`<circle cx="${f(hx - 20 + 4.8 * 1.7)}" cy="${f(dy - 18 - 12.5 * 1.7)}" r="2.2" fill="#FF4B4B">${an(`<animate attributeName="fill" values="#FF4B4B;#4BB0FF;#FF4B4B" dur=".9s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="rotate" values="-4 ${f(hx + 28)} ${f(dy)};4 ${f(hx + 28)} ${f(dy)};-4 ${f(hx + 28)} ${f(dy)}" dur="1.1s" repeatCount="indefinite"/>`)}${G(hx + 28, dy - 12, 1.7)}<path d="M-6 12l1 -16h10l1 16z" fill="url(#s4-aor)" ${INK}/><rect x="-7" y="-20" width="14" height="17" rx="4" fill="url(#s4-aor)" ${INK}/><path d="M-4 -14h8M-3 -10h6" stroke="#8A5A12" stroke-width=".8"/><circle cy="-26" r="6.4" fill="url(#s4-aor)" ${INK}/><circle cx="-2.4" cy="-27" r="1.6" fill="#FFF2A0" stroke="#8A5A12" stroke-width=".5"/><circle cx="2.4" cy="-27" r="1.6" fill="#FFF2A0" stroke="#8A5A12" stroke-width=".5"/><path d="M-2 -23h4" stroke="#8A5A12" stroke-width=".8"/><path d="M-7 -16l-7 -10M7 -16l7 -10" stroke="#E8B83A" stroke-width="2.6" stroke-linecap="round"/></g></g>`); }
    // ---- 4. la grande parabole verte du super-laser : énorme, elle déborde de la carte en bas à droite
    const SX = 1022, SY = 826, SR = 262;
    { s.push(`<radialGradient id="s4-para" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${SX + 60} ${SY + 70}) scale(${SR * 1.2})"><stop offset="0" stop-color="#D8E0E6"/><stop offset=".5" stop-color="#7A848F"/><stop offset="1" stop-color="#262B34"/></radialGradient>`);
      s.push(`<circle cx="${SX + 10}" cy="${SY + 12}" r="${SR + 14}" fill="#000" opacity=".4" filter="url(#s4-flou8)"/><circle cx="${SX}" cy="${SY}" r="${SR + 12}" fill="#3A414C"/><circle cx="${SX}" cy="${SY}" r="${SR + 12}" fill="none" stroke="#E8EEF4" stroke-width="2.4" opacity=".7"/><circle cx="${SX}" cy="${SY}" r="${SR}" fill="url(#s4-para)"/>`);
      let rg = ""; for (let k = 1; k < 7; k++) rg += `<circle cx="${SX}" cy="${SY}" r="${f(SR * k / 7)}" fill="none" stroke="#1E232B" stroke-width="1.4" opacity=".55"/>`; s.push(rg);
      let rad = ""; for (let k = 0; k < 24; k++) { const t = k / 24 * TAU; rad += `M${f(SX + Math.cos(t) * SR * .15)} ${f(SY + Math.sin(t) * SR * .15)}L${f(SX + Math.cos(t) * SR)} ${f(SY + Math.sin(t) * SR)}`; } s.push(`<path d="${rad}" stroke="#1E232B" stroke-width="1" opacity=".45"/>`);
      const em = [198, 220, 242, 264, 286].map(dg => [SX + Math.cos(dg * PI / 180) * SR * .8, SY + Math.sin(dg * PI / 180) * SR * .8]);
      em.forEach(([x, y]) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="#2E343E" ${INK}/><circle cx="${f(x)}" cy="${f(y)}" r="6.5" fill="#7CFF8A"/>`)); em.forEach(([x, y]) => K.halo(x, y, 30, "#7CFF8A", .6));
      let rays = ""; em.forEach(([x, y]) => rays += `<path d="M${f(x)} ${f(y)}L${SX} ${SY}" stroke="#B8FFB0" stroke-width="3"/>`);
      s.push(`<g opacity=".25">${rays}</g>`); haloA(-999, -999, 1, "#7CFF8A", 0);
      a.push(`<g opacity="${VIS}">${an(`<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.4;.5;.66;.72;1" dur="10s" repeatCount="indefinite"/>`)}<g stroke="#4AFF6A" stroke-width="12" opacity=".35">${rays.replace(/stroke="#B8FFB0" stroke-width="3"/g, "")}</g>${rays}</g>`);
      a.push(`<circle cx="${SX}" cy="${SY}" r="${SR}" fill="url(#s4-a7CFF8A)" opacity="${K.anime ? 0 : .5}">${an(`<animate attributeName="opacity" values="0;0;1;.2;0;0" keyTimes="0;.62;.67;.74;.8;1" dur="10s" repeatCount="indefinite"/>`)}</circle>`); }
    // ---- 5. l'esprit du petit maître vert (marge gauche, au soleil) : grand, translucide, rien autour
    { const gx = 74, gy = 488; K.halo(gx, gy - 46, 150, "#9FE8FF", .5);
      s.push(`<ellipse cx="${gx + 14}" cy="${gy + 62}" rx="44" ry="8" fill="#000" opacity=".25" filter="url(#s4-flou)"/><g opacity=".9">${G(gx, gy, 4)}<path d="M-10 14Q-11 4 -7 -4Q0 -8 7 -4Q11 4 10 14Q0 16 -10 14Z" fill="#C8B898" stroke="#DFFBFF" stroke-width=".5"/><path d="M-7 -4Q0 2 7 -4L5 -6Q0 -3 -5 -6Z" fill="#A89878"/><path d="M-5 0q-1 7 0 13M2 1q1 6 0 13M6 2q2 6 1 11" stroke="#8A7A5A" stroke-width=".6" fill="none"/><path d="M-7 -2q-6 4 -5 10" stroke="#C8B898" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="-11.6" cy="8.5" r="1.6" fill="#9ACF7A"/><path d="M6 -2q6 -2 8 4" stroke="#9ACF7A" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M14 2l-2 12" stroke="#B89A6A" stroke-width="1.2"/><ellipse cy="-10" rx="7.5" ry="6.2" fill="#9ACF7A" stroke="#DFFBFF" stroke-width=".5"/><path d="M-6 -11L-19 -16L-7.5 -6.5ZM6 -11L19 -16L7.5 -6.5Z" fill="#9ACF7A" stroke="#DFFBFF" stroke-width=".5"/><path d="M-15.5 -14.5L-8 -10.5M15.5 -14.5L8 -10.5" stroke="#C88A7A" stroke-width=".8" opacity=".7"/><ellipse cx="-2.8" cy="-11" rx="1.6" ry="1.4" fill="#1A2A22"/><ellipse cx="2.8" cy="-11" rx="1.6" ry="1.4" fill="#1A2A22"/><circle cx="-2.4" cy="-11.4" r=".45" fill="#FFFFFF"/><circle cx="3.2" cy="-11.4" r=".45" fill="#FFFFFF"/><path d="M-4.6 -13.2q1.8 -1 3.4 0M1.2 -13.2q1.8 -1 3.4 0" stroke="#5A7A4A" stroke-width=".5" fill="none"/><path d="M-3 -6.5q3 1.4 6 0" stroke="#4A6A3A" fill="none" stroke-width=".6"/><path d="M-5 -15q5 -3 10 0" stroke="#F0F8E8" stroke-width=".8" fill="none"/></g></g>`);
      a.push(`<g opacity=".5">${an(`<animate attributeName="opacity" values=".15;.6;.15" dur="3.4s" repeatCount="indefinite"/>`)}${G(gx, gy, 4)}<path d="M-9 14L-7 -4Q0 -8 7 -4L9 14ZM-6 -11L-19 -16L-7.5 -6.5ZM6 -11L19 -16L7.5 -6.5Z" fill="none" stroke="#DFFBFF" stroke-width=".7"/><ellipse cy="-10" rx="7.5" ry="6.2" fill="none" stroke="#DFFBFF" stroke-width=".7"/></g></g>`);
      s.push(`<g font-family="system-ui, sans-serif" font-style="italic" font-weight="800" font-size="18" fill="#E8FFF0" stroke="#05070F" stroke-width="4" paint-order="stroke" text-anchor="middle"><text x="${gx}" y="${gy - 132}">N'essaie pas.</text><text x="${gx}" y="${gy - 108}">Fais-le.</text></g>`); }
    // ---- 6. quelques tourelles, toutes au bord extérieur de la tranchée (ombre vers le bas à droite)
    [[648, 34], [748, 32], [848, 36], [250, 696], [340, 698]].forEach(([x, y]) => { const R = 11; s.push(`<ellipse cx="${f(x + R * .8)}" cy="${f(y + R)}" rx="${f(R * 1.1)}" ry="${f(R)}" fill="#000" opacity=".4" filter="url(#s4-flou)"/><circle cx="${x}" cy="${y}" r="${R}" fill="#5A626E" ${INK}/><circle cx="${f(x - R * .25)}" cy="${f(y - R * .3)}" r="${f(R * .55)}" fill="#C8D0D8"/><circle cx="${x}" cy="${y}" r="${f(R * .55)}" fill="#7E8792" ${INK}/><path d="M${x + 2} ${y - 3}h14M${x + 2} ${y + 3}h14" stroke="#2A2F36" stroke-width="2.4"/>`); });
    // ---- 7. LA TRANCHÉE = la piste : lèvre de coque, deux murs (éclairé / dans l'ombre), fond de métal à panneaux, feux bleus
    K.route([["#000", 88, ` opacity=".5" filter="url(#s4-flou8)" transform="translate(8 10)"`], ["#05070A", 80], ["#8C96A2", 74]]);
    { const N = K.N, P = K.P, niv = ["#05070A", "#0C0F15", "#1C212A", "#5A636E", "#B4BCC6", "#EEF2F6"];
      for (const sd of [1, -1]) { let run = [], lv = -1; const flush = () => { if (run.length > 1) { const A = run.map(i => { const [nx, ny] = K.nrm(i); return f(P[i][0] + nx * sd * 35) + " " + f(P[i][1] + ny * sd * 35); }), B = run.map(i => { const [nx, ny] = K.nrm(i); return f(P[i][0] + nx * sd * 20) + " " + f(P[i][1] + ny * sd * 20); }).reverse(); s.push(`<path d="M${A.join("L")}L${B.join("L")}Z" fill="${niv[lv]}" stroke="${niv[lv]}" stroke-width=".8"/>`); } };
        for (let i = 0; i <= N; i++) { const j = i % N, [nx, ny] = K.nrm(j), d = sd * (nx + ny) / Math.SQRT2, l = Math.max(0, Math.min(5, Math.round((d * 1.5 + 1) * 2.5))); if (l !== lv) { if (run.length) { run.push(j); flush(); } run = [j]; lv = l; } else run.push(j); } flush();
        const dd = "M" + P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 27.5) + " " + f(p[1] + ny * sd * 27.5); }).join("L") + "Z"; s.push(`<path d="${dd}" fill="none" stroke="#000" stroke-width="15" stroke-dasharray="2 30" opacity=".12"/>`);
        const lv2 = "M" + P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 35.5) + " " + f(p[1] + ny * sd * 35.5); }).join("L") + "Z"; s.push(`<path d="${lv2}" fill="none" stroke="#D8DEE6" stroke-width="1.6" opacity=".85"/>`); }
    }
    // le fond : la moitié collée au mur ensoleillé est dans l'ombre portée de l'autre mur
    s.push(`<mask id="s4-fondm"><path d="${K.piste}" fill="none" stroke="#FFFFFF" stroke-width="40" stroke-linejoin="round"/></mask><g mask="url(#s4-fondm)"><path d="${K.piste}" fill="none" stroke="#0A0D13" stroke-width="40" stroke-linejoin="round"/><path d="${K.piste}" fill="none" stroke="#434C59" stroke-width="40" stroke-linejoin="round" transform="translate(11 13)"/><path d="${K.piste}" fill="none" stroke="#000" stroke-width="40" stroke-dasharray="1.6 19" opacity=".25"/></g>`);
    for (const sd of [1, -1]) { const d = "M" + K.P.map((p, i) => { const [nx, ny] = K.nrm(i); return f(p[0] + nx * sd * 16) + " " + f(p[1] + ny * sd * 16); }).join("L") + "Z"; s.push(`<path d="${d}" fill="none" stroke="#6FD0FF" stroke-width="2.2" stroke-dasharray="2 13" opacity=".9"/>`); }
    a.push(`<path d="${K.piste}" fill="none" stroke="#9FE0FF" stroke-width="3" stroke-dasharray="5 46" opacity=".9">${an('<animate attributeName="stroke-dashoffset" from="0" to="-102" dur="1.1s" repeatCount="indefinite"/>')}</path>`);
    // la ligne de départ : portique lumineux + damier en travers de la tranchée
    { const p = K.P[0], [nx, ny, tx, ty] = K.nrm(0), q = 7; let d = "";
      for (let i = -3; i < 3; i++) for (let j = -1; j < 2; j++) { const ox = nx * i * q + tx * j * q, oy = ny * i * q + ty * j * q; d += `<path d="M${f(p[0] + ox)} ${f(p[1] + oy)}l${f(nx * q)} ${f(ny * q)}l${f(tx * q)} ${f(ty * q)}l${f(-nx * q)} ${f(-ny * q)}z" fill="${(i + j + 8) % 2 ? "#111" : "#F4F4F4"}"/>`; }
      s.push(d); [-1, 1].forEach(sg => { const bx = p[0] + tx * sg * 13, by = p[1] + ty * sg * 13; s.push(`<path d="M${f(bx - nx * 40)} ${f(by - ny * 40)}L${f(bx + nx * 40)} ${f(by + ny * 40)}" stroke="#05070A" stroke-width="7" stroke-linecap="round"/><path d="M${f(bx - nx * 40)} ${f(by - ny * 40)}L${f(bx + nx * 40)} ${f(by + ny * 40)}" stroke="#FFE27A" stroke-width="3" stroke-linecap="round"/>`); });
      K.halo(p[0], p[1], 60, "#FFE27A", .45); }
    // la cible : le conduit d'évacuation au fond de la tranchée, au bout de la grande ligne droite
    const ic = 196, [PX, PY] = K.P[ic];
    { s.push(`<rect x="${f(PX - 9)}" y="${f(PY - 9)}" width="18" height="18" fill="#05070A" stroke="#8A939E" stroke-width="1.6"/><rect x="${f(PX - 4)}" y="${f(PY - 4)}" width="8" height="8" fill="#FF8A3A"/>`); K.halo(PX, PY, 30, "#FF8A3A", .7);
      a.push(`<g transform="translate(${f(PX)} ${f(PY)})"><g>${an(`<animateTransform attributeName="transform" type="scale" values="1.8;1;1;1.8" keyTimes="0;.55;.9;1" dur="5s" repeatCount="indefinite"/>`)}<rect x="-20" y="-20" width="40" height="40" fill="none" stroke="#FF5A3A" stroke-width="2.4" stroke-dasharray="10 20" stroke-dashoffset="5"/><path d="M-28 0h10M18 0h10M0 -28v10M0 18v10" stroke="#FF5A3A" stroke-width="2.4"/></g></g>`);
      haloA(-999, -999, 1, "#FFB04A", 0);
      a.push(`<circle cx="${f(PX)}" cy="${f(PY)}" r="46" fill="url(#s4-aFFB04A)" opacity="${K.anime ? 0 : .5}">${an(`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.69;.72;.86;1" dur="5s" repeatCount="indefinite"/>`)}</circle>`); }
    // ---- 8. l'ombre d'un destroyer qui glisse sur toute la station
    { const L = 520, w = L * .33, tri = `M${f(L * .55)} 0L${f(-L * .45)} ${f(-w)}L${f(-L * .45)} ${f(w)}Z`;
      a.push(`<g opacity="${K.anime ? .2 : 0}">${an(`<animateMotion dur="40s" repeatCount="indefinite" path="M-420,980 L1500,-300"/>`)}<g transform="rotate(-34)"><path d="${tri}" fill="#000814"/><path d="M${f(-L * .4)} -24h${f(L * .3)}v48h${f(-L * .3)}z" fill="#000814"/></g></g>`); }
    // ---- 9. l'Escadron Versus (marge droite, sur fond d'ombre) : 4 chasseurs nez dans le sens de la course, hublots-portraits
    const PORTR = [], NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
    const chasseur = c => `<path d="M-30 -6L-8 -6L-20 -52L-36 -52Z" fill="#DDE2E6" ${INK}/><path d="M-30 6L-8 6L-20 52L-36 52Z" fill="#DDE2E6" ${INK}/><path d="M-24 -40L-13 -40M-24 40L-13 40" stroke="${c}" stroke-width="5"/><path d="M-22 -52h46M-22 52h46" stroke="#8A939E" stroke-width="3" stroke-linecap="round"/><path d="M24 -52h8M24 52h8" stroke="#3A414C" stroke-width="2"/>
      <rect x="-44" y="-20" width="26" height="9" rx="4" fill="#9AA3AE" ${INK}/><rect x="-44" y="11" width="26" height="9" rx="4" fill="#9AA3AE" ${INK}/><path d="M-50 -12L0 -16Q20 -26 40 -12L66 0L40 12Q20 26 0 16L-50 12Z" fill="#EEF1F4" ${INK}/><path d="M40 -12L66 0L40 12Z" fill="${c}"/><path d="M-50 -12h22v24h-22z" fill="#C8CED6" ${INK}/><path d="M-40 -12v24" stroke="${c}" stroke-width="4"/><path d="M-48 -9L0 -13" stroke="#FFFFFF" stroke-width="1.6" opacity=".8"/><circle cx="-14" r="27" fill="#EEF1F4" ${INK}/><circle cx="-14" r="27" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="10 6"/>`;
    { s.push(`<linearGradient id="s4-colh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05070F" stop-opacity="0"/><stop offset=".22" stop-color="#05070F" stop-opacity=".88"/><stop offset="1" stop-color="#05070F" stop-opacity=".94"/></linearGradient><linearGradient id="s4-colv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".74" stop-color="#FFFFFF"/><stop offset=".86" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`); s.push(`<mask id="s4-colm"><rect x="930" width="150" height="${H}" fill="url(#s4-colv)"/></mask><rect x="930" width="150" height="${H}" fill="url(#s4-colh)" mask="url(#s4-colm)"/>`);
      COULEURS_J.forEach((c, k) => { const fx = 1010, fy = 84 + k * 128, cy = fy - 11.2; K.prendre(fx, fy, 56);
        s.push(`<g transform="translate(${f(fx + 14 * OX)} ${f(fy + 14 * OY)}) rotate(90) scale(.8)" opacity=".5" filter="url(#s4-flou)"><path d="M-50 -12L0 -16Q20 -26 40 -12L66 0L40 12Q20 26 0 16L-50 12ZM-30 -6L-8 -6L-20 -52L-36 -52ZM-30 6L-8 6L-20 52L-36 52Z" fill="#000"/></g>`);
        s.push(`${G(fx, fy, .8, 90)}${chasseur(c)}</g>`);
        s.push(`<circle cx="${f(fx)}" cy="${f(cy)}" r="25" fill="${c}" opacity=".45"/><circle cx="${f(fx)}" cy="${f(cy)}" r="22.5" fill="#0A1430" stroke="${c}" stroke-width="3"/><path d="M${f(fx - 16)} ${f(cy - 16)}a22 22 0 0 1 14 -6" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".6"/>`);
        PORTR.push({ k, x: +fx.toFixed(1), y: +cy.toFixed(1), r: 20 });
        s.push(`<text x="${f(fx)}" y="${f(fy + 74)}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="18" fill="${mixHex(c, "#FFFFFF", .3)}" stroke="#05070F" stroke-width="4" paint-order="stroke">${NOMS[k]}</text>`);
        a.push(`<g>${an(`<animate attributeName="opacity" values="1;.45;1" dur="${(.3 + k * .06).toFixed(2)}s" repeatCount="indefinite"/>`)}${G(fx, fy, .8)}<path d="M-15.5 -44l4 -${16 + k}l4 ${16 + k}zM11.5 -44l4 -${16 + k}l4 ${16 + k}z" fill="#FF9A5A"/><path d="M-13.5 -44l2 -9l2 9zM13.5 -44l2 -9l2 9z" fill="#FFF0C8"/></g></g>`); }); }
    // ---- 10. dans la tranchée : les 4 pilotes (traînées de réacteurs) poursuivis par trois chasseurs aux ailes hexagonales
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `${G(0, 0, .62)}<path d="M-20 -5H-74M-20 5H-74" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity=".35"/><path d="M-20 -5H-46M-20 5H-46" stroke="#FFF0C8" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>${xwing(c, true)}</g>`, 34, k * 1)));
    a.push(K.surPiste(.985, `${G(0, 0, .8)}<path d="M14 0h34" stroke="#4BFF6A" stroke-width="3" stroke-linecap="round"/>${tieHex()}</g>${G(-34, -12, .62)}${tieHex()}</g>${G(-34, 12, .62)}${tieHex()}</g>`, 34, 33.4));
    // explosions et feux de la coque
    [[300, 40, 0], [722, 692, 3.4]].forEach(([x, y, b]) => a.push(`<g opacity="0">${an(`<animate attributeName="opacity" values="0;1;.6;0;0" keyTimes="0;.04;.12;.26;1" dur="7s" begin="${b}s" repeatCount="indefinite"/>`)}<circle cx="${x}" cy="${y}" r="22" fill="#FF5A1A" opacity=".45"/><circle cx="${x + 3}" cy="${y - 2}" r="14" fill="#FFA03A" opacity=".8"/><circle cx="${x + 1}" cy="${y - 1}" r="7" fill="#FFF6D0"/></g>`));
    for (let k = 0; k < 6; k++) { let x, y, e = 0; do { x = r() * 900; y = 20 + r() * 690; e++; } while ((!K.libre(x, y, 4, 16) || K.inside(x, y) || x < 170 && y > 300) && e < 300); a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="#FF4B4B">${an(`<animate attributeName="opacity" values="1;.1;1" dur="${(1 + r() * 1.5).toFixed(2)}s" repeatCount="indefinite"/>`)}</circle>`); }
    K.particules(8, "#FFFFFF", 1.6, "scintille");
    haloA(30, 30, 190, "#FFE8B8", .75); haloA(30, 30, 70, "#FFFFFF", .9); a.push(`<circle cx="30" cy="30" r="22" fill="#FFFFFF"/>`);
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#s4-esp)"/>`, "#0A1430", .08); RES.portraits = PORTR; RES.lieux = { cible: [PX, PY], laser: [SX, SY], trone: [EX, EY] }; return RES;
  }

  /* ---------- Juillet · La Mer de dunes (v3, grandiose) : le Grand Ver qui surgit, le sietch, la forteresse noire, la moissonneuse, le long-courrier ---------- */
  /* ---------- Juillet · La Mer de dunes (v4, grand écran) : le ver des sables jaillit en arc par-dessus la piste, son cavalier debout
     sur le dos ; il vient d'avaler la moissonneuse (en bas) ; le palais des sables (à gauche) face à la citadelle noire (à droite) ;
     le mur de tempête monte à l'est ; le grand vaisseau-cargo et les deux lunes dans le ciel ; épice bleue qui scintille. Tout est dessiné ici. ---------- */
  function peindreDunes4(T, Z, def) {
    const K = kit(T, def, 47, "d4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const lisse = pts => { const mi = (p, q) => f((p[0] + q[0]) / 2) + " " + f((p[1] + q[1]) / 2); let d = `M${f(pts[0][0])} ${f(pts[0][1])}`; for (let i = 1; i < pts.length - 1; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mi(pts[i], pts[i + 1])}`; return d + `L${f(pts[pts.length - 1][0])} ${f(pts[pts.length - 1][1])}`; };
    const pl = pts => "M" + pts.map(p => f(p[0]) + " " + f(p[1])).join("L");
    // ---- l'horizon : juste au-dessus de la piste
    const hzP = []; for (let x = -20; x <= W + 20; x += 10) { let m = 210; for (let i = 0; i < K.N; i += 2) { const p = K.P[i]; if (Math.abs(p[0] - x) < 44 && p[1] - 40 < m) m = p[1] - 40; } hzP.push([x, Math.max(44, Math.min(165, m))]); }
    for (let k = 0; k < 4; k++) for (let i = 1; i < hzP.length - 1; i++) hzP[i][1] = Math.min(hzP[i][1], (hzP[i - 1][1] + hzP[i][1] * 2 + hzP[i + 1][1]) / 4);
    const hz = x => hzP[Math.max(0, Math.min(hzP.length - 1, Math.round((x + 20) / 10)))][1];
    const SX = 205, SY = hz(205) - 8;   // LA source de lumière : le soleil couchant, bas à gauche
    // ---- dégradés
    s.push(`<linearGradient id="d4-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C1030"/><stop offset=".45" stop-color="#5A2448"/><stop offset=".8" stop-color="#C85A44"/><stop offset="1" stop-color="#FFB45E"/></linearGradient>`);
    s.push(`<radialGradient id="d4-soleil" r="50%"><stop offset="0" stop-color="#FFF8E0"/><stop offset=".2" stop-color="#FFDC90" stop-opacity=".95"/><stop offset=".55" stop-color="#FF9A4A" stop-opacity=".4"/><stop offset="1" stop-color="#FF7A3A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="d4-sol" r="50%"><stop offset="0" stop-color="#FFE6A8" stop-opacity=".75"/><stop offset=".5" stop-color="#FFB060" stop-opacity=".25"/><stop offset="1" stop-color="#FF9040" stop-opacity="0"/></radialGradient>`);
    s.push(`<linearGradient id="d4-ombreT" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#2A0E2A" stop-opacity="0"/><stop offset=".75" stop-color="#2A0E2A" stop-opacity=".32"/><stop offset="1" stop-color="#1E0A22" stop-opacity=".62"/></linearGradient>`);
    s.push(`<linearGradient id="d4-orage" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6A3040"/><stop offset=".5" stop-color="#3E1A30"/><stop offset="1" stop-color="#1E0C1C"/></linearGradient>`);
    s.push(`<radialGradient id="d4-gorge" cx="50%" cy="62%" r="55%"><stop offset="0" stop-color="#050101"/><stop offset=".3" stop-color="#2A0606"/><stop offset=".65" stop-color="#8A1E14"/><stop offset=".9" stop-color="#E0502A"/><stop offset="1" stop-color="#FF8A4A"/></radialGradient>`);
    // ================= 1. LA MER DE DUNES : 5 grandes nappes, versants sous le vent dans l'ombre (à droite, loin du soleil) =================
    { const BAND = [["#F4C48C", 150], ["#ECAC70", 250], ["#E2965A", 370], ["#D6824A", 500], ["#C66E40", 620]];
      BAND.forEach(([c, y0], j) => { const A1 = 22 + r() * 16, l1 = 170 + r() * 110, p1 = r() * TAU, A2 = 7 + r() * 6, l2 = 60 + r() * 30, p2 = r() * TAU;
        const crete = x => y0 + A1 * Math.sin(x / l1 + p1) + A2 * Math.sin(x / l2 + p2), pts = []; for (let x = -20; x <= W + 20; x += 12) pts.push([x, crete(x)]);
        s.push(`<path d="${lisse(pts)}L${W + 20} ${H + 20}L-20 ${H + 20}Z" fill="${c}"/>`);
        let d = "", haut = ""; for (let x = -20; x <= W + 20; x += 8) { const pente = (crete(x + 6) - crete(x - 6)) / 12, e = Math.max(0, Math.min(1, pente * 2.4)) * (40 + j * 14); d += (d ? "L" : "M") + f(x) + " " + f(crete(x) + e); }
        for (let x = W + 20; x >= -20; x -= 8) d += `L${f(x)} ${f(crete(x))}`;
        s.push(`<path d="${d}Z" fill="#7A3A58" opacity=".5"/>`);
        // la crête qui attrape le soleil (plus vive près du soleil)
        s.push(`<path d="${lisse(pts)}" fill="none" stroke="#FFE8BC" stroke-width="${f(2 + j * .4)}" opacity=".5"/>`); }); }
    // les rides du vent sur le sable au soleil (longues, très légères)
    for (let k = 0; k < 9; k++) { const x = 60 + r() * 420, y = 230 + r() * 400; s.push(`<path d="M${f(x)} ${f(y)}q${f(40 + r() * 30)} -8 ${f(90 + r() * 40)} -2t${f(90 + r() * 40)} 2" fill="none" stroke="#FFF0D0" stroke-width="1.6" opacity=".35"/><path d="M${f(x + 4)} ${f(y + 4)}q${f(40 + r() * 30)} -8 ${f(90 + r() * 40)} -2" fill="none" stroke="#9A4E50" stroke-width="1.4" opacity=".22"/>`); }
    // la lumière rasante du couchant sur le sable (côté soleil)
    s.push(`<ellipse cx="${SX + 60}" cy="${f(SY + 160)}" rx="560" ry="300" fill="url(#d4-sol)" style="mix-blend-mode:screen"/>`);
    // ================= 2. LE CIEL : soleil bas, deux lunes ; palais et citadelle réduits à de petites silhouettes sur l'horizon =================
    s.push(`<path d="M-20 -10${hzP.map(p => `L${f(p[0])} ${f(p[1])}`).join("")}L${W + 20} -10Z" fill="url(#d4-ciel)"/>`);
    for (let k = 0; k < 30; k++) { const x = 330 + r() * 360, y = r() * 60; if (y < hz(x) - 40) s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.5 + r() * .8)}" fill="#FFF" opacity="${(.3 + r() * .5).toFixed(2)}"/>`); }
    { const mx = 430, my = 34; s.push(`<circle cx="${mx}" cy="${my}" r="17" fill="#F4E8D4"/><circle cx="${mx + 6}" cy="${my - 3}" r="15" fill="#2A1A3E" opacity=".3"/><circle cx="${mx + 40}" cy="${my - 10}" r="8" fill="#F0C8A0"/><circle cx="${mx + 42}" cy="${my - 11}" r="7" fill="#2A1A3E" opacity=".28"/>`); }
    s.push(`<circle cx="${SX}" cy="${f(SY)}" r="190" fill="url(#d4-soleil)"/><circle cx="${SX}" cy="${f(SY)}" r="30" fill="#FFF4D0"/>`);
    // la crête lointaine, très pâle (brume)
    { let d = `M-20 ${f(hz(-20) + 4)}`; for (let x = -20; x <= W + 20; x += 16) d += `L${f(x)} ${f(hz(x) - 14 * (.4 + .6 * Math.abs(Math.sin(x * .017))))}`; s.push(`<path d="${d}L${W + 20} ${f(hz(W + 20) + 4)}Z" fill="#B85A58" opacity=".55"/>`); }
    // le palais, minuscule, dans la gloire du couchant
    const PAL = [96, hz(96) + 2];
    s.push(`${G(PAL[0], PAL[1], 1)}<path d="M-34 0V-12H-24V-26H24V-12H34V0Z M-12 -26Q-12 -42 0 -44Q12 -42 12 -26Z M-30 -12V-38L-28 -42L-26 -38V-12Z M26 -12V-38L28 -42L30 -38V-12Z" fill="#6A2C3A" opacity=".85"/><path d="M0 -44v-6" stroke="#6A2C3A" stroke-width="1.4"/></g>`);
    // ================= 3. LE MUR DE TEMPÊTE : il monte à l'est, ses bourrelets éclairés côté soleil, et mange la lumière =================
    const CIT = [880, hz(880) + 2];
    { const pied = y => 700 + Math.max(0, hz(700) - y) * .28;   // bord gauche du mur dans le ciel (penché vers l'avant)
      let d = `M${W + 20} -10L${f(pied(-10))} -10`; for (let y = -10; y <= hz(700) + 10; y += 10) d += `L${f(pied(y) + 14 * Math.sin(y / 23))} ${f(y)}`;
      for (let x = 700; x <= W + 20; x += 20) d += `L${f(x)} ${f(hz(x) + 14)}`; d += "Z";
      s.push(`<path d="${d}" fill="url(#d4-orage)"/>`);
      // les bourrelets : grosses volutes, face éclairée au couchant (à gauche), cœur sombre
      for (let k = 0; k < 11; k++) { const y = hz(700) - 6 - k * 15, x = pied(y) + 18 + (k % 2) * 14, R = 26 + r() * 18;
        s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#D88466"/><circle cx="${f(x - R * .12)}" cy="${f(y)}" r="${f(R * .9)}" fill="#E8A07A" opacity=".55"/><circle cx="${f(x + R * .28)}" cy="${f(y + R * .08)}" r="${f(R * .86)}" fill="#4A2236"/>`); }
      // les volutes au pied du mur, qui roulent sur l'horizon
      for (let k = 0; k < 9; k++) { const x = 700 + k * 44 + r() * 14, y = hz(x) + 2 - r() * 8, R = 18 + r() * 12; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#C8785E"/><circle cx="${f(x + R * .3)}" cy="${f(y + R * .1)}" r="${f(R * .85)}" fill="#5A2A3A"/>`); }
      // la citadelle noire : une petite silhouette avalée par l'ombre, au pied du mur
      s.push(`${G(CIT[0], CIT[1], 1)}<path d="M-30 0L-22 -30L-10 -40H10L22 -30L30 0Z M-3 -40L0 -54L3 -40Z" fill="#140A12"/><rect x="-14" y="-16" width="5" height="1.6" fill="#FF3A2A"/><rect x="9" y="-24" width="5" height="1.6" fill="#FF3A2A"/></g>`);
      // le mur descend aussi au premier plan, sur le bord droit (derrière la piste)
      let e = `M${W + 20} ${f(hz(W) - 10)}`; const bx = y => 1036 - Math.max(0, y - 300) * .08 + 10 * Math.sin(y / 40);
      for (let y = hz(W) - 10; y <= H + 20; y += 12) e += `L${f(bx(y))} ${f(y)}`; e += `L${W + 20} ${H + 20}Z`; s.push(`<path d="${e}" fill="#3A1A30" opacity=".9"/>`);
      for (let y = hz(W) + 10; y < H + 20; y += 34) { const R = 26 + r() * 12, x = bx(y) + 14; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#B86A58"/><circle cx="${f(x + R * .3)}" cy="${f(y + R * .1)}" r="${f(R * .86)}" fill="#3A1A30"/>`); } }
    // ================= 4. LA PISTE : sable damé ; la ligne de départ mise en valeur =================
    K.route([["#3A1A0A", 40, ` opacity=".45" filter="url(#d4-flou)"`], ["#6A3418", 31], ["#F4CE94", 27], ["#DDA868", 2, ` stroke-dasharray="3 9" opacity=".9"`]]);
    { const p = K.P[0], [nx, ny, tx, ty] = K.nrm(0); K.halo(p[0], p[1], 46, "#FFE6A8", .6);
      [-1, 1].forEach((sd, q) => { const x = p[0] + nx * sd * 22, y = p[1] + ny * sd * 22; s.push(`<path d="M${f(x)} ${f(y)}v-30" stroke="#2A1408" stroke-width="2.4"/><path d="M${f(x)} ${f(y - 30)}l${f(tx * 18)} ${f(ty * 18 + 4)}l${f(-tx * 2)} 5l${f(-tx * 16)} ${f(-ty * 16 + 1)}z" fill="${COULEURS_J[q * 2]}" stroke="#2A1408" stroke-width=".8"/>`); });
      K.depart();
      // trois chevrons peints dans le sens de la course
      [10, 20, 30].forEach(i => { const q = K.P[i], [mx, my, ux, uy] = K.nrm(i); s.push(`<path d="M${f(q[0] - ux * 5 + mx * 8)} ${f(q[1] - uy * 5 + my * 8)}L${f(q[0] + ux * 4)} ${f(q[1] + uy * 4)}L${f(q[0] - ux * 5 - mx * 8)} ${f(q[1] - uy * 5 - my * 8)}" fill="none" stroke="#B8743E" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`); }); }
    // l'ombre du mur de tempête qui avance sur la moitié droite (sol + piste)
    s.push(`<path d="M-20 ${H + 20}L-20 ${f(hz(-20))}${hzP.map(p => `L${f(p[0])} ${f(p[1])}`).join("")}L${W + 20} ${H + 20}Z" fill="url(#d4-ombreT)"/>`);
    // ================= 5. LE VER DES SABLES : il jaillit du cratère en grande courbe en S et plonge vers la ligne de départ =================
    const CL = [[712, 704], [702, 610], [664, 552], [594, 506], [516, 466], [462, 420], [440, 368], [452, 330], [488, 308], [530, 296]];
    const crs = t => { const n = CL.length - 1, u = Math.max(0, Math.min(n - 1e-6, t * n)), i = Math.floor(u), q = u - i, p0 = CL[Math.max(0, i - 1)], p1 = CL[i], p2 = CL[i + 1], p3 = CL[Math.min(n, i + 2)];
      const c = (a0, b, c2, d) => .5 * (2 * b + (-a0 + c2) * q + (2 * a0 - 5 * b + 4 * c2 - d) * q * q + (-a0 + 3 * b - 3 * c2 + d) * q * q * q); return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]; };
    const tg = t => { const p = crs(Math.max(0, t - .01)), q = crs(Math.min(1, t + .01)), l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
    const wd = t => 182 - 80 * Math.pow(t, .7);
    // k = −1 : flanc gauche/haut (au soleil), +1 : flanc droit (ombre)
    const courb = t => { const a1 = tg(Math.max(0, t - .03)), a2 = tg(Math.min(1, t + .03)), p = crs(Math.max(0, t - .03)), q = crs(Math.min(1, t + .03)), ds = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return (a1[0] * a2[1] - a1[1] * a2[0]) / ds; };
    const bord = (t, k) => { const [x, y] = crs(t), [tx, ty] = tg(t), c = courb(t); let w = wd(t) / 2 * k; if (k * c > 0) w = Math.sign(w) * Math.min(Math.abs(w), .8 / Math.abs(c)); return [x - ty * w, y + tx * w]; };
    const ligne = (t0, t1, k, n) => { const o = []; n = n || 40; for (let i = 0; i <= n; i++) o.push(bord(t0 + (t1 - t0) * i / n, k)); return o; };
    const bande = (t0, t1, k0, k1) => pl(ligne(t0, t1, k0).concat(ligne(t0, t1, k1).reverse())) + "Z";
    const BX = CL[0][0], BY = 678; let BASE = "";
    // l'ombre portée du ver : longue, couchée vers la droite (loin du soleil)
    { const proj = ([x, y]) => [x + (BY - y) * .95, BY - (BY - y) * .34]; const pts = ligne(0, 1, -1).concat(ligne(0, 1, 1).reverse()).map(proj);
      s.push(`<path d="${pl(pts)}Z" fill="#3A0E2A" opacity=".6" filter="url(#d4-flou)"/>`); }
    // le sillon d'approche : il venait de la droite sous le sable, comme les glisseurs
    s.push(`<path d="M${W + 20} ${H - 10}Q${W - 160} ${H - 40} ${BX + 80} ${BY + 4}" fill="none" stroke="#8A4026" stroke-width="34" opacity=".35" filter="url(#d4-flou8)"/><path d="M${W - 30} ${H - 22}Q${W - 170} ${H - 52} ${BX + 90} ${BY - 8}" fill="none" stroke="#FFE2B0" stroke-width="3" opacity=".45"/>`);
    // le cratère (lèvre arrière)
    s.push(`<ellipse cx="${BX - 6}" cy="${BY + 2}" rx="160" ry="44" fill="#9A4E2C"/><ellipse cx="${BX - 4}" cy="${BY - 2}" rx="132" ry="30" fill="#4A1E16"/>`);
    // le corps : volume en 5 tons (ombre propre à droite, liseré du couchant à gauche)
    const corps = (t0, t1, peau, id) => { let g = `<clipPath id="${id}"><path d="${bande(t0, t1, -1, 1)}"/></clipPath><path d="${bande(t0, t1, -1, 1)}" fill="#7A4430"/><g clip-path="url(#${id})"><path d="${bande(t0, t1, .1, 1.4)}" fill="#4E2428" filter="url(#d4-flou8)"/><path d="${bande(t0, t1, .6, 1.4)}" fill="#2A1020" opacity=".9" filter="url(#d4-flou8)"/><path d="${bande(t0, t1, -1.4, -.4)}" fill="#A8603C" filter="url(#d4-flou8)"/><path d="${bande(t0, t1, -1.4, -.78)}" fill="#F09A58" filter="url(#d4-flou)"/></g>`;
      // les anneaux : suivent la courbure, se resserrent vers la tête (perspective)
      let t = t0; while (t <= t1) { const c = courb(t), kin = Math.min(1, .5 / Math.max(.01, Math.abs(c) * wd(t) / 2)), p = bord(t, c < 0 ? -kin : -1), q = bord(t, c > 0 ? kin : 1), [x, y] = crs(t), [tx, ty] = tg(t), w = wd(t);
        g += `<path d="M${f(p[0])} ${f(p[1])}Q${f(x - tx * w * .34)} ${f(y - ty * w * .34)} ${f(q[0])} ${f(q[1])}" fill="none" stroke="#1E0A0C" stroke-width="${f(1.6 + w * .016)}" opacity=".7"/>`;
        const h1 = bord(t, -.98), h2 = bord(t, -.15); g += `<path d="M${f(h1[0] + tx * 4)} ${f(h1[1] + ty * 4)}Q${f(x - tx * w * .3 + tx * 4 - ty * w * .25)} ${f(y - ty * w * .3 + ty * 4 + tx * w * .25)} ${f(h2[0] + tx * 4 - tx * w * .12)} ${f(h2[1] + ty * 4 - ty * w * .12)}" fill="none" stroke="#FFC888" stroke-width="1.6" opacity=".4"/>`;
        t += w * .2 / 560; }
      g += `<path d="${pl(ligne(t0, t1, -1))}" fill="none" stroke="#22100C" stroke-width="2.6"/><path d="${pl(ligne(t0, t1, 1))}" fill="none" stroke="#22100C" stroke-width="2.6"/>`;
      if (peau) { const lg = ligne(t0, t1, -.94); g += `<path d="${pl(lg)}" fill="none" stroke="#FFE2A8" stroke-width="3.2" opacity=".85" stroke-linecap="round"/>`; }
      return g; };
    s.push(corps(0, 1, true, "d4-cv"));
    // le cratère (lèvre avant) : le sable s'écroule autour de la sortie de terre
    { const M1 = `M${BX - 230} ${H + 10}Q${BX - 190} ${BY + 6} ${BX - 104} ${BY - 30}Q${BX - 50} ${BY - 14} ${BX} ${BY - 12}Q${BX + 50} ${BY - 16} ${BX + 98} ${BY - 26}Q${BX + 170} ${BY + 4} ${BX + 230} ${H + 10}Z`;
      const MONT = `<path d="${M1}" fill="#DE9A5E"/><path d="M${BX + 10} ${BY - 12}Q${BX + 50} ${BY - 16} ${BX + 98} ${BY - 26}Q${BX + 170} ${BY + 4} ${BX + 230} ${H + 10}H${BX + 70}Z" fill="#7A3A4A" opacity=".45"/><path d="M${BX - 230} ${H + 10}Q${BX - 190} ${BY + 6} ${BX - 104} ${BY - 30}Q${BX - 50} ${BY - 14} ${BX} ${BY - 12}" fill="none" stroke="#FFE6B8" stroke-width="3.4" opacity=".85"/>`; let MOTTES = "";
      for (let k = 0; k < 18; k++) { const sd = k % 2 ? 1 : -1, u = 50 + r() * 80, x = BX + sd * u, y = BY - 20 - r() * (80 - u * .4), R = 6 + r() * 12;
        MOTTES += `<circle cx="${f(x + R * .3)}" cy="${f(y + R * .25)}" r="${f(R)}" fill="#7A3A2A" opacity=".5"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${sd < 0 ? "#F6CE96" : "#C88250"}"/>`; }
      s.push(MONT + MOTTES); BASE = MONT + MOTTES; }
    // ================= la gueule : trompette ouverte en 3/4, lèvres-pétales, couronnes de dents, gorge sans fond =================
    const [ex, ey] = crs(1), [utx, uty] = tg(1), D = 76, MX = ex + utx * D, MY = ey + uty * D, RX = 94, RY = 54, PHI = Math.atan2(utx, -uty) * 180 / PI, wn = wd(1) / 2;
    const cph = Math.cos(PHI * PI / 180), sph = Math.sin(PHI * PI / 180), lx = -cph, ly = sph;   // direction du soleil dans le repère de la gueule
    s.push(`<linearGradient id="d4-cloche" gradientUnits="userSpaceOnUse" x1="${f(lx * RX)}" y1="${f(ly * RX)}" x2="${f(-lx * RX)}" y2="${f(-ly * RX)}"><stop offset="0" stop-color="#F6A060"/><stop offset=".22" stop-color="#A8603C"/><stop offset=".55" stop-color="#5A2A28"/><stop offset="1" stop-color="#2A1020"/></linearGradient>`);
    s.push(`<linearGradient id="d4-petale" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E86A4A"/><stop offset=".6" stop-color="#9A2A24"/><stop offset="1" stop-color="#5A1418"/></linearGradient>`);
    const E = (th, rho) => [Math.cos(th) * RX * rho, Math.sin(th) * RY * rho];
    const petale = th => { const p0 = E(th - .36, .97), c0 = E(th - .26, 1.34), tp = E(th, 1.5), c1 = E(th + .26, 1.34), p1 = E(th + .36, .97);
      const loin = Math.sin(th) < 0; return `<path d="M${f(p0[0])} ${f(p0[1])}Q${f(c0[0])} ${f(c0[1])} ${f(tp[0])} ${f(tp[1])}Q${f(c1[0])} ${f(c1[1])} ${f(p1[0])} ${f(p1[1])}Z" fill="${loin ? "url(#d4-petale)" : "url(#d4-cloche)"}" stroke="#22100C" stroke-width="2"/><path d="M${f(E(th, 1)[0])} ${f(E(th, 1)[1])}L${f(E(th, 1.45)[0])} ${f(E(th, 1.45)[1])}" stroke="${loin ? "#FFB08A" : "#2A1010"}" stroke-width="1.4" opacity=".55"/>`; };
    const THP = [-PI / 2, -PI / 2 + 1.25, -PI / 2 - 1.25, PI / 2 + .95, PI / 2 - .95];
    s.push(`${G(MX, MY, 1, PHI)}
      <path d="M${f(-wn)} ${f(D + 8)}C${f(-wn)} ${f(D * .45)} ${f(-RX * .7)} ${f(D * .12)} ${-RX} 0A${RX} ${RY} 0 0 0 ${RX} 0C${f(RX * .7)} ${f(D * .12)} ${f(wn)} ${f(D * .45)} ${f(wn)} ${f(D + 8)}Z" fill="url(#d4-cloche)" stroke="#22100C" stroke-width="2.4"/>${[.42, .72].map(q => { const yy = D * q, hw = wn + (RX - wn) * Math.pow(1 - q, 1.6); return `<path d="M${f(-hw)} ${f(yy)}Q0 ${f(yy + RY * (1 - q) * .9 + 10)} ${f(hw)} ${f(yy)}" fill="none" stroke="#1E0A0C" stroke-width="2" opacity=".6"/>`; }).join("")}
      <path d="M${f(-RX * .93)} ${f(RY * .55)}Q0 ${f(RY * 1.45)} ${f(RX * .93)} ${f(RY * .55)}" fill="none" stroke="#1E0A0C" stroke-width="2.4" opacity=".6"/>
      ${THP.map(petale).join("")}
      <ellipse rx="${RX + 5}" ry="${RY + 4}" fill="#5A1A1A" stroke="#22100C" stroke-width="2"/><ellipse rx="${RX}" ry="${RY}" fill="url(#d4-gorge)"/>
      <ellipse cy="${f(RY * .2)}" rx="${f(RX * .3)}" ry="${f(RY * .26)}" fill="#000"/>
      <path d="${pl(Array.from({ length: 13 }, (_, q) => E(Math.atan2(ly * RX / RY, lx) - .7 + q * 1.4 / 12, 1.02)))}" fill="none" stroke="#FFD49A" stroke-width="3.4" opacity=".8" stroke-linecap="round"/></g>`);
    K.halo(MX, MY, 90, "#FF5A2A", .35);
    // les couronnes de dents (elles tournent en sens contraires)
    a.push(`${G(MX, MY, 1, PHI)}` + [[.93, 34, 15, 70, 0], [.7, 26, 12, -50, .12], [.48, 18, 9, 36, .22]].map(([k, n, L, du, dy]) => { let d = ""; const R0 = RX * k;
      for (let q = 0; q < n; q++) { const t = q / n * TAU, x = Math.cos(t) * R0, y = Math.sin(t) * R0, ix = -Math.cos(t), iy = -Math.sin(t), px = -iy * L * .32, py = ix * L * .32; d += `M${f(x + px)} ${f(y + py)}L${f(x + ix * L)} ${f(y + iy * L)}L${f(x - px)} ${f(y - py)}Z`; }
      return `<g transform="translate(0 ${f(RY * dy)}) scale(1 ${f(RY / RX)})"><path d="${d}" fill="#FBF2DE" stroke="#7A5A4A" stroke-width=".6">${an(`<animateTransform attributeName="transform" type="rotate" from="0" to="${du > 0 ? 360 : -360}" dur="${Math.abs(du)}s" repeatCount="indefinite"/>`)}</path></g>`; }).join("") + `</g>`);
    a.push(`<radialGradient id="d4-gl" r="50%"><stop offset="0" stop-color="#FF7A3A" stop-opacity=".9"/><stop offset="1" stop-color="#FF5A2A" stop-opacity="0"/></radialGradient>`);
    a.push(`<circle cx="${f(MX)}" cy="${f(MY)}" r="70" fill="url(#d4-gl)" opacity=".25">${an(`<animate attributeName="opacity" values=".15;.45;.15" dur="2.8s" repeatCount="indefinite"/>`)}</circle>`);
    // le sable qui s'écoule des lèvres : coulées irrégulières puis volutes qui retombent
    const Lw = (u, v) => [MX + u * cph - v * sph, MY + u * sph + v * cph];
    s.push(`<linearGradient id="d4-voile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE0A8" stop-opacity=".95"/><stop offset=".6" stop-color="#F2C890" stop-opacity=".55"/><stop offset="1" stop-color="#F2C890" stop-opacity="0"/></linearGradient>`);
    const COUL = [[-.3, 120], [.05, 160], [.35, 120], [.62, 90]];
    COUL.forEach(([th, L], k) => { const [u, v] = E(th, 1.04), [x, y] = Lw(u, v); let d = `M${f(x)} ${f(y)}`;
      for (let i = 1; i <= 6; i++) d += `Q${f(x + (i % 2 ? 7 : -7) * (1 + i * .3))} ${f(y + L * (i - .5) / 6)} ${f(x + Math.sin(i + k) * 4)} ${f(y + L * i / 6)}`;
      const w0 = 10 + k * 3, gc = [], dr = []; for (let i = 0; i <= 8; i++) { const q = i / 8, ox = Math.sin(q * 4 + k * 1.7) * 7 * q, w = w0 * (1 + q * 1.2); gc.push([x + ox - w * .5, y + q * L]); dr.push([x + ox + w * .5, y + q * L]); }
      s.push(`<path d="${pl(gc.concat(dr.reverse()))}Z" fill="url(#d4-voile)" filter="url(#d4-flou)"/>`);
      let g = ""; for (let q = 0; q < 5; q++) { const R = 8 + q * 4 + r() * 5, cx = x + (r() - .5) * 26 + q * 3, cy = y + L * (.55 + q * .12); g += `<circle cx="${f(cx + 3)}" cy="${f(cy + 3)}" r="${f(R)}" fill="#9A5638" opacity=".35"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="#F4CC94" opacity="${(.75 - q * .1).toFixed(2)}"/>`; }
      s.push(`<g filter="url(#d4-flou)">${g}</g>`); });
    for (let q = 0; q < 3; q++) { const d = (2.2 + q * .4).toFixed(1); let g = ""; for (let k = 0; k < 14; k++) { const [u, v] = E(-.3 + r() * .8, 1.05 + r() * .1), [x, y] = Lw(u, v); g += `<circle cx="${f(x + (r() - .5) * 10)}" cy="${f(y + r() * 40)}" r="${f(1.6 + r() * 2.4)}" fill="#FFE2B0"/>`; }
      a.push(`<g opacity="${K.anime ? 0 : .8}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${q * 4 - 4} 110" dur="${d}s" begin="${(q * .7).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="${d}s" begin="${(q * .7).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ================= le cavalier : grande silhouette à contre-jour, penché vers la gueule, crochets plantés, cape au vent =================
    const tR = .8, RID = (() => { const a1 = bord(tR, -.2), a2 = bord(tR, .2); return a1[1] < a2[1] ? a1 : a2; })();
    const SIL = "#1E0E16", BORD = "#FFB066";
    const cavDessin = c => `<path d="M-30 -2L-4 -62M44 -2L30 -82" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/><path d="M-4 -62q-2 -9 6 -10M30 -82q-1 -9 7 -9" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M-2 0L-8 -22L0 -44L10 -42L12 -24L22 0L16 0L6 -22L2 -6Z" fill="${c}"/><path d="M0 -44L10 -78L20 -76L16 -42Z" fill="${c}"/><circle cx="17" cy="-84" r="8.5" fill="${c}"/><path d="M11 -90Q14 -98 24 -92L22 -82Z" fill="${c}"/>
      <path d="M12 -72L30 -80L32 -76L14 -66Z M8 -66L-2 -58L-6 -62L4 -70Z" fill="${c}"/>`;
    const capeD = c => `<path d="M10 -78Q-18 -80 -46 -70L-34 -64L-58 -54L-40 -50L-56 -36Q-30 -42 -4 -46Z" fill="${c}"/>`;
    const SC = 1.12;
    s.push(`<ellipse cx="${f(RID[0] + 18)}" cy="${f(RID[1] + 3)}" rx="30" ry="6" fill="#1E0A0C" opacity=".45"/>`);
    const cav = () => `${G(RID[0] - 1.6, RID[1], SC)}${cavDessin(BORD)}</g>${G(RID[0], RID[1], SC)}${cavDessin(SIL)}<path d="M16 -85h4" stroke="#7CD0FF" stroke-width="1.6"/></g>`;
    const CAPE = `${G(RID[0], RID[1], SC)}<g>${an(`<animateTransform attributeName="transform" type="skewY" values="0;5;-3;0" dur="1.1s" repeatCount="indefinite"/>`)}<g transform="translate(-1.6 0)">${capeD(BORD)}</g>${capeD("#3A1A22")}</g></g>`;
    s.push(cav()); a.push(CAPE);
    // ================= l'ornithoptère : une seule grande silhouette dans le ciel, qui file dans le sens de la course =================
    { const orn = `<g transform="scale(1.6)"><path d="M-20 0Q-6 -6 16 -2Q22 0 16 3Q-6 6 -20 0Z M-20 0L-32 -5V5Z" fill="#24121C"/><circle cx="13" cy="-.5" r="2.4" fill="#FFB066"/><g>${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 .2;1 1" dur=".22s" repeatCount="indefinite"/>`)}<path d="M-2 -1l-14 -22h8l10 22zM-2 1l-14 22h8l10 -22zM8 -1l-6 -18h7l3 18zM8 1l-6 18h7l3 -18z" fill="#2E1A26" opacity=".9"/></g></g>`;
      a.push(K.anime ? `<g><animateMotion dur="22s" begin="-7s" repeatCount="indefinite" path="M-80 96C140 40 360 70 640 24"/>${orn}</g>` : `<g transform="translate(330 70) rotate(-6)">${orn}</g>`); }
    // ================= la tempête vivante : voiles de sable poussés par le vent (de droite à gauche), éclair =================
    for (let q = 0; q < 2; q++) { let g = ""; for (let k = 0; k < 5; k++) { const x = 640 + r() * 420, y = 180 + r() * (H - 200); g += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(80 + r() * 70)}" ry="${f(6 + r() * 6)}" fill="#E8B08A" opacity=".2" transform="rotate(4 ${f(x)} ${f(y)})"/>`; }
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="40 0;-90 ${q ? 10 : -10};40 0" dur="${12 + q * 5}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    a.push(`<g opacity="${K.anime ? 0 : .85}">${an(`<animate attributeName="opacity" values="0;0;1;0;.8;0;0" keyTimes="0;.6;.62;.64;.66;.7;1" dur="6s" repeatCount="indefinite"/>`)}<path d="M772 22l-12 30l9 -2l-14 34l21 -38l-10 3l9 -27z" fill="#FFE8D8"/><circle cx="766" cy="56" r="36" fill="#FFC8A0" opacity=".2"/></g>`);
    // la poussière d'épice qui monte du cratère
    for (let q = 0; q < 2; q++) { const d = (3.2 + q * .8).toFixed(1); let g = ""; for (let k = 0; k < 5; k++) g += `<circle cx="${f(BX + (q ? 70 : -80) + (r() - .5) * 30)}" cy="${f(BY - 40 - k * 14)}" r="${f(8 + k * 4)}" fill="${k % 2 ? "#FF9A4A" : "#F2C88E"}" opacity="${(.6 - k * .08).toFixed(2)}"/>`;
      a.push(`<g opacity="${K.anime ? 0 : .7}">${an(`<animateTransform attributeName="transform" type="translate" values="0 10;${q ? 30 : -30} -60" dur="${d}s" begin="${(q * 1.4).toFixed(1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.85;0" dur="${d}s" begin="${(q * 1.4).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ================= le cartouche des 4 pilotes (en haut à droite) : vrais portraits posés par l'appli =================
    const PORTR = [];
    { const pw = 252, ph = 118, px = W - pw - 10, py = 8, NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
      s.push(`<linearGradient id="d4-or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE6B0"/><stop offset=".4" stop-color="#E8A84A"/><stop offset="1" stop-color="#7A4A16"/></linearGradient>`);
      s.push(`<rect x="${px + 3}" y="${py + 4}" width="${pw}" height="${ph}" rx="12" fill="#000" opacity=".4"/><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="#2A1620" stroke="url(#d4-or)" stroke-width="2.6" opacity=".97"/><rect x="${px + 5}" y="${py + 5}" width="${pw - 10}" height="${ph - 10}" rx="9" fill="none" stroke="#E8A84A" stroke-width=".8" opacity=".6"/>`);
      s.push(`<text x="${px + pw / 2}" y="${py + 19}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#F8D49A">« Le sable n'oublie personne. »</text>`);
      COULEURS_J.forEach((c, k) => { const x = px + 36 + k * 60, y = py + 60; PORTR.push({ k, x, y, r: 20 });
        s.push(`${G(x, y, 1)}<path d="M-26 14Q-28 -26 0 -28Q28 -26 26 14Q20 26 0 26Q-20 26 -26 14Z" fill="#6A5442" stroke="#2A1408" stroke-width="1.2"/><path d="M-24 10Q-26 -22 0 -24" stroke="#9A8068" stroke-width="1.4" fill="none"/><circle r="21" fill="#1A0E14" stroke="${c}" stroke-width="2.2"/><path d="M-20 18Q0 30 20 18L22 26H-22Z" fill="${c}" stroke="#2A1408" stroke-width=".8"/></g>`);
        s.push(`<text x="${x}" y="${py + 106}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="10.5" fill="${c}">${NOMS[k]}</text>`);
        a.push(`<circle cx="${x}" cy="${y}" r="23" fill="none" stroke="#7CD0FF" stroke-width="2" opacity="0">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.25;1" dur="8s" begin="${k * 2}s" repeatCount="indefinite"/>`)}</circle>`); }); }
    for (let i = 0; i <= 20; i++) { const [x, y] = crs(i / 20); K.prendre(x, y, wd(i / 20) * .6); }
    // ---- l'épice bleue qui scintille dans le sable (discrète)
    a.push(`<defs><radialGradient id="d4-pb" r="50%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#5AC8FF" stop-opacity=".9"/><stop offset="1" stop-color="#2A7AFF" stop-opacity="0"/></radialGradient></defs>`);
    for (let q = 0; q < 2; q++) { let g = ""; for (let k = 0; k < 10; k++) { const x = r() * W, y = r() * H; if (y > hz(x) + 30 && K.dT(x, y) > 24) g += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 2.5)}" fill="url(#d4-pb)"/>`; } a.push(`<g opacity="${K.anime ? 0 : .4}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.2;.45;1" dur="4.5s" begin="${(q * 2).toFixed(1)}s" repeatCount="indefinite"/>`)}${g}</g>`); }
    // ---- les 4 pilotes sur la piste : glisseurs des sables aux couleurs des 4, panache de sable derrière eux
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `<g><ellipse cx="-14" cy="0" rx="12" ry="4" fill="#FFE6B8" opacity=".55"/><path d="M-8 -5h12l6 5l-6 5h-12z" fill="${c}" stroke="#2A1408" stroke-width="1"/><circle cx="3" cy="0" r="2.4" fill="#FFF2D6"/></g>`, 40, k * 1.2)));
    // le ver passe PAR-DESSUS la piste : le pont de son corps redessiné au-dessus des glisseurs
    { let t0 = 1, t1 = 0; for (let i = 0; i <= 100; i++) { const t = i / 100, [x, y] = crs(t); if (K.dT(x, y) < wd(t) / 2 + 22) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); } }
      if (t1 > t0) a.push(`<g>${corps(Math.max(0, t0 - .02), Math.min(.7, t1 + .02), false, "d4-cvp")}</g>`); if (t0 < .2) a.push(BASE); }
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#E8A060"/>`, "#FF7A2A", .06); RES.portraits = PORTR; RES.lieux = { ver: [Math.round(MX), Math.round(MY)], base: [BX, BY], citadelle: [CIT[0], Math.round(CIT[1] - 20)], palais: [PAL[0], Math.round(PAL[1] - 20)] }; return RES;
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
    const K = kit(T, def, 87, "t4-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "";
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${f(sc)})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    // ---- géométrie : trois remparts = arcs d'un même cercle dont le centre est loin sous la carte (Maria épais et proche, Sina mince et lointain)
    const CX = 540, CY = 1150, dC = (x, y) => Math.hypot(x - CX, y - CY);
    const MUR = [{ n: "MARIA", R: 790, h: 40, e: 14 }, { n: "ROSE", R: 680, h: 22, e: 8 }, { n: "SINA", R: 500, h: 11, e: 5 }];
    const yA = (R, x) => CY - Math.sqrt(Math.max(0, R * R - (x - CX) * (x - CX)));
    MUR.forEach(m => { m.portes = []; for (let i = 0; i < K.N; i++) { const p = K.P[i], q = K.P[(i + 1) % K.N], u = dC(p[0], p[1]) - m.R, v = dC(q[0], q[1]) - m.R; if (u * v > 0 || u === v) continue;
      const t = u / (u - v), x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1, sn = Math.abs((tx * (x - CX) + ty * (y - CY)) / l / m.R);
      if (!m.portes.some(g => Math.abs(g.x - x) < 40)) m.portes.push({ x, y, d: 19 / Math.max(.45, sn) }); } });
    const MA = MUR[0], RO = MUR[1], SI = MUR[2];
    // la brèche = là où la piste traverse Maria à droite : la course entre par le trou du Colosse
    const pD = MA.portes.reduce((m, g) => g.x > m.x ? g : m, MA.portes[0]), BRE = [pD.x - 58, pD.x + 44], xG = pD.x - 6;
    const dHaut = m => { const q = []; for (let x = -12; x <= W + 12; x += 8) q.push(f(x) + " " + f(yA(m.R, x) + 1)); return `M-12 -12L${q.join("L")}L${W + 12} -12Z`; };
    const HZ = 80;   // l'horizon
    const GX = 640, HY = 232, HK = 1.02;   // le Colosse : axe, centre de la tête, échelle de la tête
    // ---- dégradés
    s.push(`<linearGradient id="t4-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1A3A"/><stop offset=".45" stop-color="#8A3E50"/><stop offset=".8" stop-color="#E8843E"/><stop offset="1" stop-color="#FFC66A"/></linearGradient>`);
    s.push(`<linearGradient id="t4-plaine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A52"/><stop offset=".1" stop-color="#4E3446"/><stop offset=".45" stop-color="#33243A"/><stop offset="1" stop-color="#22182A"/></linearGradient>`);
    s.push(`<radialGradient id="t4-ble" cx="${f((GX - CX) / (2 * MA.R) * 100 + 50)}%" cy="0%" r="32%"><stop offset="0" stop-color="#F4C860"/><stop offset=".35" stop-color="#D09838"/><stop offset=".7" stop-color="#9A6426"/><stop offset="1" stop-color="#5E3A18"/></radialGradient>`);
    s.push(`<radialGradient id="t4-ville" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#B07A50"/><stop offset="1" stop-color="#5A3A2A"/></radialGradient>`);
    s.push(`<pattern id="t4-face" width="16" height="9" patternUnits="userSpaceOnUse"><rect width="16" height="9" fill="#6A5A50"/><rect x=".7" y=".7" width="14.6" height="7.6" fill="#7E6E60"/><rect x=".7" y=".7" width="14.6" height="2" fill="#90806C"/><path d="M8 0v4.5" stroke="#4E4238" stroke-width=".9"/></pattern>`);
    s.push(`<radialGradient id="t4-muscle" cx="50%" cy="4%" r="85%"><stop offset="0" stop-color="#FF9A60"/><stop offset=".2" stop-color="#C8402C"/><stop offset=".55" stop-color="#7A1A14"/><stop offset="1" stop-color="#3A0806"/></radialGradient>`);
    s.push(`<linearGradient id="t4-torse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A3424"/><stop offset=".3" stop-color="#6A1610"/><stop offset=".75" stop-color="#3E0A08"/><stop offset="1" stop-color="#2A0604"/></linearGradient>`);
    s.push(`<linearGradient id="t4-bras" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8583A"/><stop offset=".5" stop-color="#8A2418"/><stop offset="1" stop-color="#4A0E0A"/></linearGradient>`);
    s.push(`<radialGradient id="t4-vap" r="50%"><stop offset="0" stop-color="#FFF2D6" stop-opacity=".95"/><stop offset=".55" stop-color="#FFD9A0" stop-opacity=".5"/><stop offset="1" stop-color="#FFC890" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="t4-brume" r="50%"><stop offset="0" stop-color="#C8A0A0" stop-opacity=".4"/><stop offset="1" stop-color="#C8A0A0" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="t4-ray" gradientUnits="userSpaceOnUse" cx="${GX}" cy="${HZ}" r="760"><stop offset="0" stop-color="#FFE6A8" stop-opacity=".55"/><stop offset=".45" stop-color="#FFD088" stop-opacity=".22"/><stop offset="1" stop-color="#FFC070" stop-opacity="0"/></radialGradient>`);
    // ---- un titan lointain en silhouette (pieds en x,y ; hauteur ~100*sc) : poses variées, il se fond dans la brume
    const titanLoin = (x, y, sc, o) => { const c = "#3A2434", lu = "#C8784A", p = o.pose;
      const jambes = p === "court" ? "M-5 -44L-16 -14L-22 -2M6 -44L12 -20L22 -10" : p === "penche" ? "M-6 -44L-9 -2M6 -44L9 -2" : "M-6 -44L-8 -2M6 -44L8 -2";
      const bras = p === "court" ? "M-13 -72Q-24 -60 -30 -70M13 -72Q22 -56 16 -40" : p === "penche" ? "M-12 -72Q-18 -52 -10 -30M12 -72Q20 -50 16 -28" : "M-13 -73Q-19 -54 -17 -30M13 -73Q19 -54 17 -30";
      const tete = p === "penche" ? `<ellipse cx="6" cy="-84" rx="9" ry="10.5" fill="${c}"/>` : `<ellipse cx="0" cy="-88" rx="9.5" ry="11" fill="${c}"/>`;
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(o.flip ? -sc : sc)} ${f(sc)})${p === "penche" ? " skewX(-10)" : p === "court" ? " skewX(-6)" : ""}" opacity="${o.op}"><path d="${jambes}" stroke="${c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M-14 -76Q-17 -58 -11 -42Q0 -38 11 -42Q17 -58 14 -76Q0 -80 -14 -76Z" fill="${c}"/><path d="${bras}" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>${tete}<path d="M-8 -96Q0 -101 8 -96" stroke="${lu}" stroke-width="2" fill="none" opacity=".7"/></g>`; };
    // ================= 1. LE CIEL ET LA MER AU COUCHANT =================
    s.push(`<rect width="${W}" height="${H}" fill="url(#t4-plaine)"/>`);
    s.push(`<rect width="${W}" height="${HZ + 2}" fill="url(#t4-ciel)"/>`);
    K.halo(GX, HZ + 20, 620, "#FF9A48", .55); K.halo(GX, HZ + 10, 240, "#FFE6A0", .85);
    // le soleil, énorme, à moitié dans la mer, pile derrière le crâne du Colosse
    s.push(`<circle cx="${GX}" cy="${HZ + 8}" r="84" fill="#FFE4A0" opacity=".9"/><circle cx="${GX}" cy="${HZ + 8}" r="70" fill="#FFF4D0"/>`);
    // nuages étirés, éclairés par en dessous
    [[150, 26, 220], [420, 14, 160], [930, 22, 240]].forEach(([x, y, w]) => s.push(`<path d="M${x - w / 2} ${y}Q${x} ${y - 9} ${x + w / 2} ${y}Q${x} ${y + 4} ${x - w / 2} ${y}Z" fill="#5A2A44" opacity=".65"/><path d="M${x - w * .4} ${y + 2}Q${x} ${y + 5} ${x + w * .4} ${y + 2}" stroke="#FFB070" stroke-width="1.6" fill="none" opacity=".7"/>`));
    // la mer, une bande dorée ; collines en silhouette ouvertes sur le soleil
    s.push(`<rect x="0" y="${HZ - 1}" width="${W}" height="10" fill="#C8784A"/><path d="M${GX - 150} ${HZ + 2}H${GX + 150}M${GX - 90} ${HZ + 5}H${GX + 100}" stroke="#FFF4C8" stroke-width="2" opacity=".9"/>`);
    s.push(`<path d="M-10 ${HZ + 14}L-10 ${HZ - 14}Q60 ${HZ - 30} 150 ${HZ - 14}Q230 ${HZ - 2} 300 ${HZ - 16}Q380 ${HZ - 26} 470 ${HZ - 4}Q520 ${HZ + 6} 550 ${HZ + 10}L550 ${HZ + 14}Z" fill="#4A2A3E"/><path d="M800 ${HZ + 14}Q880 ${HZ - 6} 950 ${HZ - 18}Q1020 ${HZ - 30} 1090 ${HZ - 16}L1090 ${HZ + 14}Z" fill="#4A2A3E"/>`);
    // ================= 2. LA PLAINE DES TITANS : violet-brun, brumeuse, fendue par les rayons du couchant =================
    { let o = ""; [[-86, 7], [-70, 9], [-52, 7], [-36, 10], [-18, 6], [14, 6], [30, 10], [48, 7], [64, 9], [80, 7]].forEach(([ang, l]) => { const t = (90 + ang) / 57.3, n = l / 57.3, R = 1000;
        o += `<path d="M${GX} ${HZ + 8}L${f(GX + Math.cos(t) * R)} ${f(HZ + Math.sin(t) * R)}L${f(GX + Math.cos(t + n) * R)} ${f(HZ + Math.sin(t + n) * R)}Z"/>`; });
      s.push(`<g fill="url(#t4-ray)">${o}</g>`); }
    [[250, 170, 280, 26], [860, 190, 200, 22], [330, 300, 300, 30], [150, 360, 200, 28]].forEach(([x, y, rx, ry]) => s.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#t4-brume)"/>`));
    // ================= 3. DANS LES MURS : une seule nappe de blés dorés =================
    s.push(`<circle cx="${CX}" cy="${CY}" r="${MA.R}" fill="url(#t4-ble)"/>`);
    { let o = ""; for (let k = 0; k < 10; k++) { const R = MA.R - 60 - k * 26 - r() * 8, a0 = -2.25 + r() * .5, a1 = -.9 - r() * .5, pts = []; for (let t = a0; t <= a1; t += .03) pts.push(f(CX + Math.cos(t) * R) + " " + f(CY + Math.sin(t) * R + Math.sin(t * 40) * 3)); o += `<path d="M${pts.join("L")}" stroke="${k % 2 ? "#FFE08A" : "#8A5A1E"}" stroke-width="2.5" fill="none" opacity="${k % 2 ? .25 : .15}"/>`; } s.push(o); }
    s.push(`<circle cx="${CX}" cy="${CY}" r="${SI.R}" fill="url(#t4-ville)"/>`);
    // l'ombre immense du Colosse, couchée vers nous sur les blés (le soleil est derrière lui)
    s.push(`<path d="M${GX - 240} ${f(yA(MA.R, GX - 240) + MA.h)}Q${GX - 230} 470 ${GX - 120} 520Q${GX - 70} 600 ${GX} 610Q${GX + 70} 600 ${GX + 120} 520Q${GX + 230} 470 ${GX + 240} ${f(yA(MA.R, GX + 240) + MA.h)}Z" fill="#2A0C06" opacity=".5" filter="url(#t4-flou8)"/>`);
    // ================= 4. LA PISTE : route de terre claire (elle se détache sur la plaine sombre) =================
    K.route([["#140A10", 40, ` opacity=".45" filter="url(#t4-flou)"`], ["#2E1E16", 31], ["#C8A070", 26], ["#F0D8A8", 16, ` opacity=".55"`], ["#8A6A46", 1.6, ` stroke-dasharray="7 9" transform="translate(-4 -1)"`], ["#8A6A46", 1.6, ` stroke-dasharray="7 9" transform="translate(4 1)"`]]);
    K.depart();
    // ================= 5. TITANS EN MARCHE DANS LA BRUME (une seule échelle géante : le Colosse) =================
    [[196, 392, .62, "court", 0, .78], [300, 350, .5, "penche", 1, .6], [228, 300, .4, "ballant", 0, .42], [140, 268, .34, "penche", 0, .3]].forEach(([x, y, sc, pose, fl, op]) => s.push(titanLoin(x, y, sc, { pose, flip: fl, op })));
    [[240, 330, 190, 20], [190, 280, 140, 16]].forEach(([x, y, rx, ry]) => s.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#t4-brume)"/>`));
    // ================= 6. LE COLOSSE (derrière Maria, penché au-dessus du mur, à contre-jour) =================
    // la vapeur, un grand panache doré couché par le vent vers la gauche
    [[GX + 20, 300, 120], [GX - 40, 220, 110], [GX - 100, 160, 96], [GX - 170, 112, 86], [GX - 250, 76, 76], [GX - 340, 52, 66], [GX + 120, 250, 86], [GX - 140, 260, 84]].forEach(([x, y, R], k) =>
      s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#t4-vap)" opacity="${k < 2 || k > 5 ? .85 : .65}"/>`));
    s.push(`<clipPath id="t4-hautM"><path d="${dHaut(MA)}"/></clipPath>`);
    const X = (sg, v) => f(GX + sg * v);
    // silhouette du buste : trapèzes énormes qui partent derrière les oreilles, épaules rondes, coudes écartés posés sur le mur
    const buste = sg => `M${X(sg, 40)} ${HY + 10}Q${X(sg, 96)} ${HY + 46} ${X(sg, 160)} ${HY + 84}Q${X(sg, 222)} ${HY + 90} ${X(sg, 238)} ${HY + 140}L${X(sg, 206)} ${HY + 260}H${X(sg, 0)}V${HY + 10}Z`;
    const crane = "M0 -98C58 -98 86 -62 84 -12C82 30 70 62 50 80C32 94 -32 94 -50 80C-70 62 -82 30 -84 -12C-86 -62 -58 -98 0 -98Z";
    { let o = `<g clip-path="url(#t4-hautM)">`;
      // contour embrasé (contre-jour)
      o += `<g filter="url(#t4-flou8)" opacity=".95">${[-1, 1].map(sg => `<path d="${buste(sg)}" fill="none" stroke="#FFB050" stroke-width="20"/>`).join("")}${G(GX, HY, HK)}<path d="${crane}" fill="none" stroke="#FFC060" stroke-width="26"/></g></g>`;
      [-1, 1].forEach(sg => {
        o += `<path d="${buste(sg)}" fill="url(#t4-torse)" stroke="#1E0402" stroke-width="2.4"/>`;
        // trapèze : fibres en éventail du cou vers l'épaule
        for (let k = 0; k < 9; k++) { const t = k / 8; o += `<path d="M${X(sg, 44 + t * 6)} ${f(HY + 14 + t * 30)}Q${X(sg, 110 + t * 10)} ${f(HY + 52 + t * 22)} ${X(sg, 170 + t * 20)} ${f(HY + 86 + t * 16)}" stroke="${k % 2 ? "#3A0806" : "#E8704E"}" stroke-width="${k % 2 ? 2 : 1.5}" fill="none" opacity=".6"/>`; }
        // pectoral sous la clavicule (fibres)
        o += `<path d="M${X(sg, 10)} ${HY + 128}Q${X(sg, 90)} ${HY + 112} ${X(sg, 180)} ${HY + 124}Q${X(sg, 176)} ${HY + 200} ${X(sg, 90)} ${HY + 214}Q${X(sg, 20)} ${HY + 210} ${X(sg, 10)} ${HY + 180}Z" fill="#6A1410" stroke="#1E0402" stroke-width="1.6"/>`;
        for (let k = 0; k < 6; k++) o += `<path d="M${X(sg, 16)} ${HY + 134 + k * 12}Q${X(sg, 90)} ${HY + 122 + k * 12} ${X(sg, 172 - k * 6)} ${HY + 132 + k * 9}" stroke="${k % 2 ? "#3A0806" : "#C8503A"}" stroke-width="1.6" fill="none" opacity=".55"/>`;
        // le bras : de l'épaule, il plonge vers la main crispée sur le parapet (le coude est caché derrière le mur)
        const ep = [GX + sg * 196, HY + 116], ma = [GX + sg * 150, yA(MA.R, GX + sg * 150) - MA.e - 16], cc = [GX + sg * 222, HY + 180], A = `M${f(ep[0])} ${f(ep[1])}Q${f(cc[0])} ${f(cc[1])} ${f(ma[0])} ${f(ma[1])}`;
        o += `<path d="${A}" stroke="#1E0402" stroke-width="44" stroke-linecap="round" fill="none"/><path d="${A}" stroke="url(#t4-bras)" stroke-width="39" stroke-linecap="round" fill="none"/>`;
        o += `<path d="M${f(ep[0] + sg * 18)} ${f(ep[1] - 2)}Q${f(cc[0] + sg * 18)} ${f(cc[1])} ${f(ma[0] + sg * 18)} ${f(ma[1] - 4)}" stroke="#FFB070" stroke-width="3" fill="none" opacity=".75"/>`;
        for (let k = 0; k < 4; k++) o += `<path d="M${f(ep[0] + sg * (-12 + k * 8))} ${f(ep[1] + 6)}Q${f(cc[0] + sg * (-14 + k * 7))} ${f(cc[1])} ${f(ma[0] + sg * (-12 + k * 7))} ${f(ma[1])}" stroke="${k % 2 ? "#3E0A08" : "#E06A4A"}" stroke-width="1.4" fill="none" opacity=".5"/>`;
        // deltoïde rond
        o += `<path d="M${X(sg, 158)} ${HY + 84}Q${X(sg, 226)} ${HY + 82} ${X(sg, 244)} ${HY + 146}Q${X(sg, 230)} ${HY + 172} ${X(sg, 200)} ${HY + 164}Q${X(sg, 168)} ${HY + 128} ${X(sg, 158)} ${HY + 84}Z" fill="url(#t4-muscle)" stroke="#1E0402" stroke-width="2"/>`;
        for (let k = 0; k < 6; k++) o += `<path d="M${X(sg, 168 + k * 11)} ${HY + 90 + k * 2}Q${X(sg, 204 + k * 6)} ${HY + 120} ${X(sg, 208 + k * 5)} ${HY + 164}" stroke="${k % 2 ? "#3E0A08" : "#F08058"}" stroke-width="1.5" fill="none" opacity=".55"/>`;
        // clavicule : une arête d'os pâle
        o += `<path d="M${X(sg, 14)} ${HY + 120}Q${X(sg, 80)} ${HY + 104} ${X(sg, 166)} ${HY + 100}" stroke="#1E0402" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M${X(sg, 14)} ${HY + 118}Q${X(sg, 80)} ${HY + 102} ${X(sg, 166)} ${HY + 98}" stroke="#E8C8AC" stroke-width="5" fill="none" stroke-linecap="round"/>`;
        // liseré de lumière sur le haut du trapèze et de l'épaule
        o += `<path d="M${X(sg, 42)} ${HY + 12}Q${X(sg, 96)} ${HY + 48} ${X(sg, 160)} ${HY + 86}Q${X(sg, 222)} ${HY + 92} ${X(sg, 238)} ${HY + 138}" stroke="#FFC078" stroke-width="4" fill="none" opacity=".9" stroke-linecap="round"/>`;
      });
      o += `<path d="M${GX} ${HY + 124}V${HY + 240}" stroke="#1E0402" stroke-width="3" opacity=".8"/>`;
      // le cou, épais, en cordes de muscle
      o += `<path d="M${GX - 52} ${HY + 30}L${GX - 58} ${HY + 116}Q${GX} ${HY + 128} ${GX + 58} ${HY + 116}L${GX + 52} ${HY + 30}Z" fill="#5A100C" stroke="#1E0402" stroke-width="2"/>`;
      for (let k = -4; k <= 4; k++) o += `<path d="M${GX + k * 11} ${HY + 50}Q${GX + k * 13} ${HY + 84} ${GX + k * 14} ${HY + 120}" stroke="${k % 2 ? "#3A0806" : "#D8603E"}" stroke-width="1.8" fill="none" opacity=".6"/>`;
      o += `<path d="M${GX - 46} ${HY + 60}L${GX - 8} ${HY + 122}M${GX + 46} ${HY + 60}L${GX + 8} ${HY + 122}" stroke="#A8301F" stroke-width="7" stroke-linecap="round" opacity=".7"/>`;   // sterno-cléido
      // la tête écorchée
      o += G(GX, HY, HK) + `<path d="${crane}" fill="url(#t4-muscle)" stroke="#1E0402" stroke-width="2.8"/>`;
      for (let k = -6; k <= 6; k++) o += `<path d="M${f(k * 9)} -94Q${f(k * 11.5)} -70 ${f(k * 8.5)} -48" stroke="${k % 2 ? "#4A0E0A" : "#FF9A74"}" stroke-width="${k % 2 ? 2.2 : 1.8}" fill="none" opacity=".7"/>`;
      // joues creusées : muscles des mâchoires à nu, en cordes verticales, pommettes d'os pâle
      [-1, 1].forEach(sg => { o += `<path d="M${sg * 82} -10Q${sg * 80} 40 ${sg * 52} 82L${sg * 40} 30Q${sg * 50} 0 ${sg * 82} -10Z" fill="#4A0C08"/>`;
        for (let k = 0; k < 6; k++) o += `<path d="M${f(sg * (78 - k * 5))} ${f(-6 + k * 2)}Q${f(sg * (70 - k * 4))} ${f(34 + k * 3)} ${f(sg * (56 - k * 3))} ${f(74 + k)}" stroke="${k % 2 ? "#2A0604" : "#D85A40"}" stroke-width="2" fill="none" opacity=".75"/>`;
        o += `<path d="M${sg * 80} -6Q${sg * 58} -10 ${sg * 30} 6Q${sg * 50} 8 ${sg * 76} 4Z" fill="#E8C8AC"/><path d="M${sg * 78} -2Q${sg * 58} -4 ${sg * 34} 6" stroke="#FFF0DC" stroke-width="1.4" fill="none"/>`; });
      // arcade sourcilière lourde, orbites enfoncées dans l'ombre
      o += `<path d="M-74 -46Q-38 -64 -6 -40Q0 -36 6 -40Q38 -64 74 -46L74 -28Q38 -46 6 -26H-6Q-38 -46 -74 -28Z" fill="#3A0806" stroke="#1E0402" stroke-width="1.6"/><path d="M-72 -46Q-38 -64 -6 -40M72 -46Q38 -64 6 -40" stroke="#FFA070" stroke-width="2" fill="none" opacity=".75"/>`;
      o += `<path d="M-58 -30Q-34 -40 -12 -28Q-14 -6 -34 -2Q-54 -6 -58 -30ZM58 -30Q34 -40 12 -28Q14 -6 34 -2Q54 -6 58 -30Z" fill="#0E0200"/>`;
      o += `<circle cx="-34" cy="-18" r="5" fill="#FFB040"/><circle cx="34" cy="-18" r="5" fill="#FFB040"/><circle cx="-34" cy="-18" r="2" fill="#FFF4C0"/><circle cx="34" cy="-18" r="2" fill="#FFF4C0"/>`;
      // le nez : deux fentes
      o += `<path d="M-8 2Q-12 16 -4 20Q-3 10 -8 2ZM8 2Q12 16 4 20Q3 10 8 2Z" fill="#0E0200"/>`;
      // la denture : deux rangées de longues dents serrées, d'une joue à l'autre, sans lèvres
      o += `<path d="M-50 26Q0 18 50 26L48 78Q0 88 -48 78Z" fill="#1A0200"/>`;
      o += `<path d="M-48 28Q0 20 48 28L47 51Q0 47 -47 51Z" fill="#E8D8C0"/><path d="M-47 54Q0 50 47 54L46 76Q0 84 -46 76Z" fill="#D2BEA0"/>`;
      { let d = ""; for (let k = -11; k <= 11; k++) { const x = k * 4.1; d += `M${f(x)} ${f(24 + Math.abs(k) * .3)}V${f(51 - Math.abs(k) * .1)}M${f(x + 2)} ${f(54)}V${f(80 - Math.abs(k) * .35)}`; } o += `<path d="${d}" stroke="#4A2A1A" stroke-width="1.1"/>`; }
      o += `<path d="M-48 52Q0 47 48 52" stroke="#1A0200" stroke-width="2.4" fill="none"/>`;
      o += `<path d="M-78 -40C-70 -84 -40 -98 0 -98C40 -98 70 -84 78 -40" stroke="#FFD080" stroke-width="5" fill="none" opacity=".95"/>`;   // le crâne embrasé par le soleil
      s.push(o + "</g></g>"); }
    // ================= 7. LES REMPARTS (ombres portées vers nous) =================
    const mur = (m, trous, ombre, opO) => {
      const seg = []; let cur = []; for (let x = -12; x <= W + 12; x += 4) { const dans = trous.some(([a0, a1]) => x > a0 && x < a1); if (dans) { if (cur.length > 1) seg.push(cur); cur = []; } else cur.push(x); } if (cur.length > 1) seg.push(cur);
      let o = "", cren = "";
      seg.forEach(xs => { const top = xs.map(x => [x, yA(m.R, x) - m.e]), mid = xs.map(x => [x, yA(m.R, x)]), bot = xs.map(x => [x, yA(m.R, x) + m.h]), L = q => q.map(p => f(p[0]) + " " + f(p[1])).join("L");
        o += `<path d="M${L(bot)}L${L(bot.slice().reverse().map(p => [p[0], p[1] + ombre]))}Z" fill="#2A0C06" opacity="${opO}" filter="url(#t4-flou)"/>`;
        o += `<path d="M${L(mid)}L${L(bot.slice().reverse())}Z" fill="url(#t4-face)"/><path d="M${L(bot)}" stroke="#1E1610" stroke-width="2.2" fill="none"/><path d="M${L(mid.map(p => [p[0], p[1] + m.h * .55]))}" stroke="#1A0C06" stroke-width="${f(m.h * .9)}" fill="none" opacity=".3"/>`;
        for (let i = 0; i < xs.length; i += 9) { const x = xs[i]; if (i === 0) continue; o += `<path d="M${f(x)} ${f(yA(m.R, x) + 1)}v${f(m.h - 2)}" stroke="#4A3E34" stroke-width="${f(m.h / 10)}"/>`; }
        o += `<path d="M${L(top)}L${L(mid.slice().reverse())}Z" fill="#B89676" stroke="#2E241C" stroke-width="1.2"/><path d="M${L(top)}" stroke="#FFC888" stroke-width="1.8" fill="none" opacity=".85"/>`;
        for (let i = 1; i < xs.length - 1; i += 3) { const x = xs[i], y = yA(m.R, x) - m.e; cren += `M${f(x - m.e * .17)} ${f(y + .5)}v${f(-m.e * .5)}h${f(m.e * .34)}v${f(m.e * .5)}Z`; } });
      return o + `<path d="${cren}" fill="#A88A6E" stroke="#2E241C" stroke-width=".8"/>`;
    };
    // tour de rempart : fût ombré côté opposé au soleil, liseré doré côté soleil, toit conique d'ardoise
    const tour = (m, x) => { const y = yA(m.R, x), w = m.h * 1.05, top = y - m.e - m.h * .4, bas = y + m.h + 2, sg = x < GX ? 1 : -1, L = x - w / 2, Rr = x + w / 2;
      return `<path d="M${f(L)} ${f(bas)}h${f(w)}l${f(-sg * w * .5 + w * .1)} ${f(m.h * 1.6)}h${f(-w * 1.1)}Z" fill="#2A1008" opacity=".35" filter="url(#t4-flou)"/>` +
        `<rect x="${f(L)}" y="${f(top)}" width="${f(w)}" height="${f(bas - top)}" fill="#8A6E58" stroke="#1E1610" stroke-width="1.3"/>` +
        `<rect x="${f(sg > 0 ? x : L)}" y="${f(top)}" width="${f(w / 2)}" height="${f(bas - top)}" fill="#1A0C06" opacity=".35"/><path d="M${f(sg > 0 ? L + 1.5 : Rr - 1.5)} ${f(top)}V${f(bas)}" stroke="#FFC078" stroke-width="2" opacity=".85"/>` +
        `<path d="M${f(L - 3)} ${f(top + 1)}L${f(x)} ${f(top - w * 1.2)}L${f(Rr + 3)} ${f(top + 1)}Z" fill="#4A3A44" stroke="#1E1610" stroke-width="1.2"/><path d="M${f(x)} ${f(top - w * 1.2)}L${f(sg > 0 ? L - 3 : Rr + 3)} ${f(top + 1)}L${f(x - sg * w * .2)} ${f(top + 1)}Z" fill="#FFB070" opacity=".55"/>`; };
    const pG = MA.portes.reduce((m, g) => g.x < m.x ? g : m, MA.portes[0]);
    s.push(mur(MA, [[pG.x - pG.d, pG.x + pG.d], BRE], 70, .5));
    // ---- la brèche : un trou net, blocs en éventail vers l'intérieur, nuage de poussière dorée
    { const yb = yA(MA.R, xG); let o = "";
      o += `<ellipse cx="${f(xG)}" cy="${f(yb + 46)}" rx="120" ry="54" fill="url(#t4-vap)" opacity=".85"/><ellipse cx="${f(xG - 10)}" cy="${f(yb + 10)}" rx="54" ry="34" fill="url(#t4-vap)" opacity=".9"/>`;
      [[BRE[0], -1], [BRE[1], 1]].forEach(([x, sg]) => { const y = yA(MA.R, x); o += `<path d="M${f(x)} ${f(y - MA.e)}l${f(-sg * 7)} 9l${f(sg * 9)} 7l${f(-sg * 6)} 10l${f(sg * 7)} 11l${f(-sg * 4)} ${f(MA.h + MA.e - 37)}l${f(-sg * 4)} 0V${f(y - MA.e)}Z" fill="#7E6A58" stroke="#1E1610" stroke-width="1.4"/><path d="M${f(x - sg * 1)} ${f(y - MA.e + 2)}l${f(-sg * 5)} 8" stroke="#FFC888" stroke-width="1.4"/>`; });
      // grands blocs projetés vers l'intérieur (vers nous), en éventail, jamais sur la piste
      for (let k = 0; k < 40; k++) { const t = r(), ang = (r() - .5) * 2.4, sp = 26 + t * 120, x = xG + Math.sin(ang) * sp * 1.2, y = yb + MA.h * .6 + Math.cos(ang) * sp * .7, R = (6 + r() * 10) * (1 - t * .5); if (K.dT(x, y) < 18 + R || y < yb + 4) continue;
        o += `<g transform="rotate(${f(r() * 360)} ${f(x)} ${f(y)})"><path d="M${f(x - R)} ${f(y)}l${f(R * .6)} ${f(-R * .8)}l${f(R * 1.1)} ${f(-R * .1)}l${f(R * .4)} ${f(R * .8)}l${f(-R * .5)} ${f(R * .5)}Z" fill="${["#9A8670", "#7E6A58", "#B09478", "#5E4E42"][Math.floor(r() * 4)]}" stroke="#1E1610" stroke-width=".7"/></g>`; }
      s.push(o); }
    s.push(tour(MA, pG.x + pG.d + 9) + tour(MA, 1030));
    // ---- les deux mains crispées sur le parapet : doigts longs et osseux, phalanges marquées, le bout des doigts passe devant les créneaux
    const main = (x, sg) => { const y = yA(MA.R, x) - MA.e; let o = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(Math.asin((x - CX) / MA.R) * 57.3)}) scale(${f(sg * .82)} .82)">`;
      o += `<ellipse cx="4" cy="${MA.e + MA.h + 14}" rx="60" ry="12" fill="#1A0804" opacity=".4" filter="url(#t4-flou)"/>`;
      // le dos de la main, posé sur le chemin de ronde
      o += `<path d="M-52 -2Q-60 -30 -36 -44Q-4 -54 30 -46Q54 -38 56 -12L50 4Z" fill="url(#t4-bras)" stroke="#1E0402" stroke-width="2.4"/>`;
      for (let k = 0; k < 5; k++) o += `<path d="M${-30 + k * 14} -46Q${-30 + k * 15} -24 ${-36 + k * 18} -4" stroke="${k % 2 ? "#3A0806" : "#E87050"}" stroke-width="2.2" fill="none" opacity=".65"/>`;
      o += `<path d="M-46 -30Q-10 -52 38 -40" stroke="#FFC078" stroke-width="3.2" fill="none" opacity=".85"/>`;
      // 4 doigts longs et osseux, de longueurs différentes, effilés, plis des phalanges, ongles sombres : ils passent par-dessus le parapet
      [[-36, 34, -5, 15], [-12, 42, -2, 16], [12, 39, 2, 15], [34, 28, 5, 13]].forEach(([u, l, dv, w]) => { const t = (v, k) => f(u + dv * k + v), w1 = w * .5;
        o += `<path d="M${t(-w / 2, 0)} -6Q${t(-w / 2 - 1.5, .5)} ${f(l * .5)} ${t(-w1 / 2, 1)} ${f(l - 3)}Q${t(0, 1)} ${f(l + 5)} ${t(w1 / 2, 1)} ${f(l - 3)}Q${t(w / 2 + 1.5, .5)} ${f(l * .5)} ${t(w / 2, 0)} -6Z" fill="url(#t4-bras)" stroke="#1E0402" stroke-width="2.2"/>`;
        o += `<path d="M${t(-w / 2 + 2.5, 0)} -2Q${t(-w / 2 + 1.5, .5)} ${f(l * .5)} ${t(-w1 / 2 + 1.5, 1)} ${f(l - 5)}" stroke="#FF9A70" stroke-width="1.6" fill="none" opacity=".8"/>`;
        [.36, .7].forEach(k => o += `<path d="M${t(-w * .42, k)} ${f(l * k - 1)}Q${t(0, k)} ${f(l * k + 3)} ${t(w * .42, k)} ${f(l * k - 1)}" stroke="#2A0604" stroke-width="1.5" fill="none"/><path d="M${t(-w * .3, k)} ${f(l * k - 4)}Q${t(0, k)} ${f(l * k - 7)} ${t(w * .3, k)} ${f(l * k - 4)}" stroke="#F08060" stroke-width="1.3" fill="none" opacity=".7"/>`);
        o += `<path d="M${t(-w1 / 2 + 1, 1)} ${f(l - 6)}Q${t(0, 1)} ${f(l + 3)} ${t(w1 / 2 - 1, 1)} ${f(l - 6)}Q${t(0, 1)} ${f(l - 9)} ${t(-w1 / 2 + 1, 1)} ${f(l - 6)}Z" fill="#2A120A"/>`; });
      // les jointures saillantes
      [-36, -12, 12, 34].forEach(u => o += `<ellipse cx="${u}" cy="-5" rx="8.5" ry="6" fill="#A8301F" stroke="#1E0402" stroke-width="1.6"/><path d="M${u - 6} -8q6 -3 12 0" stroke="#FFB080" stroke-width="1.6" fill="none"/>`);   // les jointures
      // la pierre qui éclate sous les doigts
      o += `<path d="M-24 ${MA.e + 2}l-5 9M-2 ${MA.e + 4}l2 10M18 ${MA.e + 2}l6 8" stroke="#1E1610" stroke-width="1.6"/>`;
      return o + `</g>`; };
    s.push(main(GX - 150, 1), main(GX + 150, -1));
    // vapeur là où le corps touche le mur
    [[GX - 70, yA(MA.R, GX - 70) - 20, 40], [GX + 70, yA(MA.R, GX + 70) - 20, 40]].forEach(([x, y, R]) => s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="url(#t4-vap)" opacity=".45"/>`));
    // ---- Rose (plus fin) et Sina (mince et lointain), avec leurs ombres
    s.push(mur(RO, RO.portes.map(g => [g.x - g.d, g.x + g.d]), 46, .45));
    { const gR = RO.portes.slice().sort((p, q) => p.x - q.x); if (gR[0]) s.push(tour(RO, gR[0].x + gR[0].d + 8)); if (gR[1]) s.push(tour(RO, gR[1].x - gR[1].d - 8)); }
    s.push(mur(SI, [], 26, .4));
    // ---- le Bataillon lancé au galop vers la brèche (dans le sens de la course), avec sa poussière
    const cheval = (vert) => `<g><ellipse cx="0" cy="6" rx="10" ry="3" fill="#000" opacity=".35"/><path d="M-9 0Q-8 -6 0 -6Q8 -6 10 -2L15 -9L18 -7L14 2Q10 4 6 3L8 9M-6 3L-11 9M-4 3L-1 9M4 3L9 8" stroke="#1E120A" stroke-width="2.4" fill="#2E1E12" stroke-linecap="round"/><path d="M-12 -3L-17 1" stroke="#1E120A" stroke-width="2.4"/><path d="M-4 -6L-2 -15L4 -14L3 -6Z" fill="#3A2A1E"/><path d="M-3 -14Q-12 -12 -16 -6Q-8 -8 -2 -8Z" fill="${vert}"/><circle cx="1" cy="-17" r="2.6" fill="#E8C4A0"/></g>`;
    { const at = i => { i = ((i % K.N) + K.N) % K.N; const p = K.P[i], [, , tx, ty] = K.nrm(i); return [p[0], p[1], Math.atan2(ty, tx) * 57.3]; };
      let o = "";
      for (let j = 0; j < 6; j++) { const [x, y] = at(126 + j * 4); o += `<circle cx="${f(x + (r() - .5) * 10)}" cy="${f(y + (r() - .5) * 10)}" r="${f(12 + j * 3)}" fill="url(#t4-vap)" opacity="${f(.25 + j * .05)}"/>`; }
      [150, 158, 166, 174].forEach((i, k) => { const [x, y, ang] = at(i), droite = Math.cos(ang / 57.3) >= 0; o += `<g transform="translate(${f(x + (k % 2 ? 5 : -5))} ${f(y)}) scale(${droite ? 1.2 : -1.2} 1.2)">${cheval("#3E6A3A")}</g>`; });
      s.push(o); }
    // ---- les 4 soldats (= les 4 pilotes) qui volent vers le Colosse : un câble droit et tendu chacun, planté dans la nuque ou l'épaule
    const SOL = [[462, 178], [826, 172], [392, 266], [884, 256]], ANC = [[GX - 60, HY + 40], [GX + 62, HY + 42], [GX - 188, HY + 96], [GX + 190, HY + 98]];
    const PORTR = [];
    { let o = "";
      SOL.forEach(([x, y], k) => { const c = COULEURS_J[k], [hx, hy] = ANC[k], ang = Math.atan2(hy - y, hx - x) * 57.3, sg = hx > x ? 1 : -1;
        o += `<path d="M${f(x + sg * 4)} ${f(y + 22)}L${hx} ${hy}" stroke="#1A0C08" stroke-width="3.2" opacity=".55"/><path d="M${f(x + sg * 4)} ${f(y + 22)}L${hx} ${hy}" stroke="#F8F0E0" stroke-width="1.6"/><circle cx="${hx}" cy="${hy}" r="3" fill="#E8E8E8" stroke="#1A0C08" stroke-width="1"/>`;
        // le soldat, de profil vers son câble : cape verte qui claque derrière, deux lames qui brillent, tête claire (l'appli y pose le portrait)
        o += `${G(x, y, 1)}<g transform="scale(${-sg} 1)"><path d="M2 12Q22 18 36 40L22 38L28 52Q8 40 -2 24Z" fill="#3E6A3A" stroke="#1A2A14" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 14Q22 22 32 38" stroke="#7AA86A" stroke-width="1.4" fill="none"/>` +
          `<path d="M-6 12Q-8 26 -4 34L6 34Q8 22 6 12Z" fill="#2E2218" stroke="#120A06" stroke-width="1.2"/><path d="M-4 34L-10 48M4 34L8 48" stroke="#2E2218" stroke-width="4.5" stroke-linecap="round"/><rect x="-8" y="24" width="16" height="6" rx="2" fill="#8A8E94" stroke="#120A06" stroke-width=".8"/>` +
          `<path d="M-6 18L-30 8M-6 22L-30 22" stroke="#120A06" stroke-width="4.4" stroke-linecap="round"/><path d="M-6 18L-30 8M-6 22L-30 22" stroke="#F4FAFF" stroke-width="2.4" stroke-linecap="round"/></g>` +
          `<circle r="21" fill="#FFE8B0" opacity=".45"/><circle r="17.5" fill="#F0D4B0" stroke="${c}" stroke-width="3.2"/><path d="M-15 -6Q-12 -18 0 -18Q12 -18 15 -6Q8 -12 0 -11Q-8 -12 -15 -6Z" fill="#4A2E1A"/><circle cx="-5" cy="1" r="1.6" fill="#2A1A10"/><circle cx="5" cy="1" r="1.6" fill="#2A1A10"/></g>`;
        PORTR.push({ k, x, y, r: 16 }); });
      s.push(o); }
    // ================= COUCHE ANIMÉE (tout le mouvement est sur le Colosse) =================
    // la vapeur qui monte de ses épaules et se couche avec le vent
    for (let k = 0; k < 12; k++) { const x = GX + (k % 4 - 1.5) * 100 + (r() - .5) * 30, y = HY + 90 + (r() - .5) * 40, R = 26 + r() * 22, d = (6 + r() * 4).toFixed(1), b = (-r() * 10).toFixed(1);
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#t4-vap)" opacity="${K.anime ? 0 : .5}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f(-160 - r() * 120)} ${f(-170 - r() * 60)}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.85;0" keyTimes="0;.25;1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`)}</circle>`); }
    // la vapeur qui fuit des fibres de la mâchoire
    [-1, 1].forEach(sg => { const x = GX + sg * 62 * HK, y = HY + 40 * HK;
      a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="url(#t4-vap)" opacity="${K.anime ? 0 : .55}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f(sg * 30 - 30)} -60" dur="3.4s" begin="${sg > 0 ? -1.7 : 0}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" keyTimes="0;.3;1" dur="3.4s" begin="${sg > 0 ? -1.7 : 0}s" repeatCount="indefinite"/>`)}</circle>`); });
    // ses yeux qui luisent au fond des orbites
    a.push(`<g opacity="${K.anime ? .4 : 1}">${an(`<animate attributeName="opacity" values=".4;.4;1;1;.4" keyTimes="0;.5;.6;.9;1" dur="6s" repeatCount="indefinite"/>`)}${[-34, 34].map(u => { const x = GX + u * HK, y = HY - 18 * HK; return `<circle cx="${f(x)}" cy="${f(y)}" r="14" fill="#FF6A2A" opacity=".4"/><circle cx="${f(x)}" cy="${f(y)}" r="4.6" fill="#FFE2A0"/>`; }).join("")}</g>`);
    // jets de gaz derrière les soldats et éclat des lames
    SOL.forEach(([x, y], k) => { const sg = ANC[k][0] > x ? 1 : -1, d = (1.6 + k * .3).toFixed(1);
      a.push(`<circle cx="${f(x - sg * 16)}" cy="${f(y + 30)}" r="10" fill="url(#t4-vap)" opacity="${K.anime ? 0 : .6}">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f(-sg * 30)} 10" dur="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="${d}s" repeatCount="indefinite"/>`)}</circle>`);
      a.push(`<circle cx="${f(x + sg * 28)}" cy="${f(y + 12)}" r="3" fill="#FFFFFF" opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.6;.75;1" dur="${(2.4 + k * .5).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); });
    // gravats qui tombent de la brèche, poussière dorée qui roule
    for (let k = 0; k < 4; k++) { const x = BRE[0] - 2 + (k % 2 ? BRE[1] - BRE[0] + 4 : 0) + (r() - .5) * 8, y = yA(MA.R, x) - MA.e, d = (1.4 + r()).toFixed(1), b = (-r() * 2).toFixed(1);
      a.push(`<path d="M${f(x - 3)} ${f(y)}l3 -4l4 1l1 4l-3 3z" fill="#7E6A58" stroke="#1E1610" stroke-width=".6">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${f((r() - .5) * 30)} ${f(40 + r() * 30)}" dur="${d}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;.8;1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/>`)}</path>`); }
    { const x = xG, y = yA(MA.R, x) + 40; a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="44" fill="url(#t4-vap)" opacity=".45">${an(`<animate attributeName="r" values="34;62;34" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;.2;.5" dur="4s" repeatCount="indefinite"/>`)}</circle>`); }
    // la brume qui dérive sur la plaine
    [[300, 220, 200, 24], [820, 230, 160, 20]].forEach(([x, y, rx, ry], k) => a.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#t4-brume)">${an(`<animateTransform attributeName="transform" type="translate" values="0 0;${k ? -40 : 40} 0;0 0" dur="${18 + k * 5}s" repeatCount="indefinite"/>`)}</ellipse>`));
    // le scintillement du soleil sur la mer
    a.push(`<path d="M${GX - 110} ${HZ + 3}H${GX + 110}" stroke="#FFFFFF" stroke-width="1.5" opacity=".6">${an(`<animate attributeName="opacity" values=".2;.8;.2" dur="3s" repeatCount="indefinite"/>`)}</path>`);
    // les 4 pilotes à cheval sur la piste, capes aux couleurs des 4
    COULEURS_J.forEach((c, k) => a.push(K.surPiste(.04 + k * .03, `<g transform="scale(1.5)"><ellipse rx="8" ry="3.4" fill="#4A3220" stroke="#1E1610" stroke-width=".7"/><ellipse cx="8" cy="0" rx="3.4" ry="2" fill="#3E2A18" stroke="#1E1610" stroke-width=".6"/><path d="M-8 0l-4 -1.5l1 1.5l-1 1.5z" fill="#1A1008"/><path d="M-5 -4.2L2 -2.8L2 2.8L-5 4.2Z" fill="${c}" stroke="#1E1610" stroke-width=".6"/><circle cx="1.5" cy="0" r="2.2" fill="#E8C4A0" stroke="#1E1610" stroke-width=".5"/></g>`, 44, k * 1.1)));
    K.particules(8, "#FFD8A0", 2.4, "monte");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="#22182A"/>`, "#C8642A", .1); RES.portraits = PORTR; return RES;
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

  function peindreRatatouille(T, Z, def) {
    // UNE scène, vue en coupe : sous les toits de zinc de Paris, la grande cuisine d'un restaurant, la nuit.
    // Une seule lumière (le fourneau, la cocotte, le petit chef rat) ; tout autour, la nuit bleue.
    // La course part du passe, longe la salle du critique, roule SUR les toits, puis plonge vers la voûte des égouts.
    const K = kit(T, def, 1911, "rt-"), { s, a, r, f, W, H } = K, an = x => K.anime ? x : "", INK = `stroke="#1A1220" stroke-width="2"`, INK1 = `stroke="#1A1220" stroke-width="1.4"`;
    const G = (x, y, sc, rot) => `<g transform="translate(${f(x)} ${f(y)})${sc && sc !== 1 ? ` scale(${sc})` : ""}${rot ? ` rotate(${f(rot)})` : ""}">`;
    const trait = (d, c, l) => `<path d="${d}" fill="none" stroke="#1A1220" stroke-width="${l + 3.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${l}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const LX = 600, LY = 410, SILL = 250, SOL = 462;   // la source de lumière ; le plafond de la cuisine ; la ligne du sol
    // ---- 0. dégradés
    s.push(`<linearGradient id="rt-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060A22"/><stop offset=".55" stop-color="#121B46"/><stop offset="1" stop-color="#25336A"/></linearGradient>`);
    s.push(`<radialGradient id="rt-mur" gradientUnits="userSpaceOnUse" cx="${LX}" cy="370" r="560"><stop offset="0" stop-color="#FFE7B0"/><stop offset=".22" stop-color="#F2C27A"/><stop offset=".48" stop-color="#A86A48"/><stop offset=".75" stop-color="#3E2E4A"/><stop offset="1" stop-color="#161830"/></radialGradient>`);
    s.push(`<radialGradient id="rt-sol" gradientUnits="userSpaceOnUse" cx="${LX}" cy="${SOL}" r="560"><stop offset="0" stop-color="#C08A50"/><stop offset=".35" stop-color="#6A4434"/><stop offset=".7" stop-color="#2A1E2C"/><stop offset="1" stop-color="#10101E"/></radialGradient>`);
    s.push(`<linearGradient id="rt-zinc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A8AB8"/><stop offset=".25" stop-color="#4A5888"/><stop offset="1" stop-color="#262E58"/></linearGradient>`);
    s.push(`<radialGradient id="rt-cave" gradientUnits="userSpaceOnUse" cx="905" cy="640" r="260"><stop offset="0" stop-color="#8A5434"/><stop offset=".5" stop-color="#4A2E2A"/><stop offset="1" stop-color="#160F1C"/></radialGradient>`);
    s.push(`<linearGradient id="rt-cuivre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A3A1A"/><stop offset=".35" stop-color="#E8955A"/><stop offset=".5" stop-color="#FFE0B0"/><stop offset=".7" stop-color="#C46A32"/><stop offset="1" stop-color="#5A2A14"/></linearGradient>`);
    s.push(`<radialGradient id="rt-poele" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#FFE6B8"/><stop offset=".3" stop-color="#F0A060"/><stop offset=".7" stop-color="#B05A28"/><stop offset="1" stop-color="#5A2812"/></radialGradient>`);
    s.push(`<linearGradient id="rt-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE6A8" stop-opacity=".6"/><stop offset="1" stop-color="#FFE6A8" stop-opacity="0"/></linearGradient>`);
    s.push(`<radialGradient id="rt-lune" r="50%"><stop offset="0" stop-color="#FFF8E0"/><stop offset=".6" stop-color="#F4E6B8"/><stop offset="1" stop-color="#D8C890"/></radialGradient>`);
    s.push(`<radialGradient id="rt-route" gradientUnits="userSpaceOnUse" cx="${LX}" cy="${LY + 60}" r="640"><stop offset="0" stop-color="#8A6248"/><stop offset=".38" stop-color="#6A5058"/><stop offset=".62" stop-color="#465478"/><stop offset="1" stop-color="#36426E"/></radialGradient>`);
    s.push(`<radialGradient id="rt-flaque" gradientUnits="userSpaceOnUse" cx="${LX}" cy="${LY}" r="430"><stop offset="0" stop-color="#FFD27A" stop-opacity=".75"/><stop offset=".35" stop-color="#FFAA4A" stop-opacity=".32"/><stop offset=".7" stop-color="#FF8A3A" stop-opacity=".08"/><stop offset="1" stop-color="#FF8A3A" stop-opacity="0"/></radialGradient>`);
    s.push(`<radialGradient id="rt-nuit" gradientUnits="userSpaceOnUse" cx="${LX}" cy="${LY}" r="760"><stop offset=".4" stop-color="#0A1238" stop-opacity="0"/><stop offset=".8" stop-color="#0A1238" stop-opacity=".35"/><stop offset="1" stop-color="#050A24" stop-opacity=".6"/></radialGradient>`);
    s.push(`<pattern id="rt-carreau" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0 .5H32M.5 0V16" stroke="#5A3A24" stroke-width="1.1" opacity=".22"/></pattern>`);
    s.push(`<pattern id="rt-brique" width="30" height="15" patternUnits="userSpaceOnUse"><path d="M0 .5H30M0 7.5H30M7 .5V7.5M22 7.5V15" stroke="#1A0E10" stroke-width="1.3" opacity=".45"/></pattern>`);

    // ---- 1. la nuit : lune, étoiles, et au loin (à droite) la Seine, ses ponts et la tour de fer
    for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * 120; s.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.6 + r() * 1.1)}" fill="#FFF6DA" opacity="${(.3 + r() * .6).toFixed(2)}"/>`); }
    K.halo(56, 44, 90, "#BFD0FF", .3); s.push(`<circle cx="56" cy="44" r="26" fill="url(#rt-lune)"/><circle cx="48" cy="38" r="4.5" fill="#D8C890" opacity=".6"/><circle cx="64" cy="52" r="3" fill="#D8C890" opacity=".5"/>`);
    { // la tour de fer, lointaine et discrète (la lumière principale reste la cuisine)
      const TX = 846, TB = 178, TH = 122;
      s.push(`<path d="M${TX - 34} ${TB}Q${TX - 22} ${TB - 30} ${TX - 12} ${TB - 50}L${TX - 6} ${TB - 88}L${TX - 1.5} ${TB - TH}H${TX + 1.5}L${TX + 6} ${TB - 88}L${TX + 12} ${TB - 50}Q${TX + 22} ${TB - 30} ${TX + 34} ${TB}H${TX + 22}Q${TX + 10} ${TB - 22} ${TX} ${TB - 22}Q${TX - 10} ${TB - 22} ${TX - 22} ${TB}Z" fill="#9A6A48" stroke="#2A1A2A" stroke-width="1"/>`);
      s.push(`<rect x="${TX - 16}" y="${TB - 52}" width="32" height="4" fill="#E8B060" opacity=".8"/><rect x="${TX - 8}" y="${TB - 90}" width="16" height="3" fill="#E8B060" opacity=".8"/><circle cx="${TX}" cy="${TB - TH - 1}" r="2.4" fill="#FFF0C0"/>`);
      K.halo(TX, TB - 60, 70, "#FFB04A", .14);
      for (let k = 0; k < 6; k++) { const t = r(), y = TB - 4 - t * (TH - 8), w = 30 * (1 - t) ** 1.6 + 1.5, x = TX + (r() - .5) * 2 * w; a.push(`<circle cx="${f(x)}" cy="${f(y)}" r="1.4" fill="#FFFFFF" opacity="${K.anime ? 0 : .7}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.2;1" dur="${(1.2 + r() * 1.4).toFixed(2)}s" begin="${(r() * 2).toFixed(2)}s" repeatCount="indefinite"/>`)}</circle>`); }
      // l'autre rive
      let d = "M620 182"; for (let x = 620; x <= W + 20; x += 16 + r() * 20) { const h = 8 + r() * 20; d += `V${f(180 - h)}H${f(x + 14)}`; } d += `V200H620Z`; s.push(`<path d="${d}" fill="#1A2458"/>`);
      for (let k = 0; k < 12; k++) { const x = 630 + r() * (W - 630), y = 164 + r() * 12; s.push(`<rect x="${f(x)}" y="${f(y)}" width="2.4" height="3" fill="#FFD27A" opacity="${(.35 + r() * .5).toFixed(2)}"/>`); }
      // la Seine, qui reflète la lumière
      s.push(`<rect x="620" y="182" width="${W - 620}" height="40" fill="#13204E"/><path d="M620 183H${W}" stroke="#4A60A0" stroke-width="1.5"/>`);
      // un pont à arches franches
      { const x = 960, w = 120, n = 4; let d2 = `M${x - w} 182H${x + w}V196`; const p = 2 * w / n; for (let k = n - 1; k >= 0; k--) d2 += `L${f(x - w + (k + 1) * p - 4)} 196A${f(p / 2 - 4)} 12 0 0 0 ${f(x - w + k * p + 4)} 196`; d2 += `L${x - w} 196Z`;
        s.push(`<path d="${d2}" fill="#3A4478" stroke="#141A3A" stroke-width="1.5"/><path d="M${x - w} 182H${x + w}" stroke="#8A96C8" stroke-width="2"/>`); for (let k = 0; k <= n; k++) s.push(`<circle cx="${f(x - w + k * p)}" cy="179" r="2.2" fill="#FFE2A0"/>`); }
      a.push(`<path d="M${TX - 22} 192h44M${TX - 14} 198h28M720 204h50M680 210h30" stroke="#FFC060" stroke-width="2.2" opacity=".6">${an(`<animate attributeName="opacity" values=".6;.2;.6" dur="2.6s" repeatCount="indefinite"/>`)}</path>`);
    }

    // ---- 2. les toits de zinc : la piste roule sur leur faîtage (on suit le tracé, 16 px plus bas)
    { const pts = []; for (let i = 214; i <= 476; i += 3) { const [x, y] = K.P[i]; pts.push([x, Math.min(SILL - 8, y + 15)]); }
      const ridge = "M" + pts.map(p => f(p[0]) + " " + f(p[1])).join("L");
      s.push(`<path d="${ridge}L${f(pts[pts.length - 1][0] + 60)} ${f(pts[pts.length - 1][1] + 10)}L${W} ${SILL - 4}V${SILL + 6}H0V${SILL - 4}L${f(pts[0][0] - 40)} ${SILL - 4}Z" fill="url(#rt-zinc)" stroke="#121838" stroke-width="2"/>`);
      // les bandes de zinc (joints debout) qui accrochent la lune
      let d = ""; for (let x = 80; x < W; x += 22) { const i = pts.reduce((b, p, k) => Math.abs(p[0] - x) < Math.abs(pts[b][0] - x) ? k : b, 0), y0 = pts[i][1] + 6; if (y0 > SILL - 16 || Math.abs(pts[i][0] - x) > 20) continue; d += `M${x} ${f(y0)}V${SILL - 6}`; }
      s.push(`<path d="${d}" stroke="#9AAAD8" stroke-width="1.4" opacity=".35"/>`);
      // la lumière de la cuisine remonte et dore le zinc au-dessus du fourneau
      s.push(`<path d="${ridge}L${f(pts[pts.length - 1][0] + 60)} ${f(pts[pts.length - 1][1] + 10)}L${W} ${SILL - 4}V${SILL + 6}H0V${SILL - 4}L${f(pts[0][0] - 40)} ${SILL - 4}Z" fill="url(#rt-flaque)" opacity=".7"/>`);
      // lucarnes éclairées
      [[430, 160], [590, 150], [760, 228], [900, 240]].forEach(([x, y]) => { if (y > SILL - 14) return; const lit = Math.abs(x - LX) < 260;
        s.push(`<path d="M${x - 14} ${y + 26}V${y + 6}L${x} ${y - 8}L${x + 14} ${y + 6}V${y + 26}Z" fill="#3A4678" stroke="#121838" stroke-width="1.8"/><rect x="${x - 8}" y="${y + 8}" width="16" height="18" fill="${lit ? "#FFC860" : "#5A6A9A"}" stroke="#121838" stroke-width="1"/><path d="M${x} ${y + 8}V${y + 26}" stroke="#121838" stroke-width="1"/>`); if (lit) K.halo(x, y + 16, 34, "#FFC860", .5); });
      // grandes cheminées en silhouette, plantées le long du faîtage (la piste passe entre leurs pots)
      [[244, 1], [352, 1.15], [676, .95], [800, 1.1], [930, 1]].forEach(([x, sc]) => { const i = pts.reduce((b, p, k) => Math.abs(p[0] - x) < Math.abs(pts[b][0] - x) ? k : b, 0), y = pts[i][1] + 4, w = 34 * sc, h = 58 * sc;
        s.push(`<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" fill="#3A2232" stroke="#120C18" stroke-width="2"/><rect x="${f(x - w / 2 - 4)}" y="${f(y - h - 6)}" width="${f(w + 8)}" height="8" fill="#2A1A26" stroke="#120C18" stroke-width="1.6"/>`
          + [-.28, .02, .3].map(u => `<rect x="${f(x + u * w - 4)}" y="${f(y - h - 18)}" width="8" height="13" rx="1.5" fill="#B8603A" stroke="#120C18" stroke-width="1.4"/>`).join("") + `<path d="M${f(x - w / 2 + 3)} ${f(y - h + 3)}V${f(y - 2)}" stroke="#7A8AC0" stroke-width="2" opacity=".5"/>`); });
      // la poutre coupée : on voit la cuisine en dessous
      s.push(`<rect x="0" y="${SILL - 4}" width="${W}" height="12" fill="#2A1A20" stroke="#120C18" stroke-width="1.5"/><path d="M0 ${SILL + 8}H${W}" stroke="#FFC870" stroke-width="2" opacity=".55"/>`);
    }

    // ---- 3. la cuisine : mur carrelé, soubassement de bois, sol en damier, tous éclairés par le fourneau
    s.push(`<rect x="0" y="${SILL + 8}" width="${W}" height="${SOL - SILL - 8}" fill="url(#rt-mur)"/><rect x="0" y="${SILL + 8}" width="${W}" height="${SOL - SILL - 8}" fill="url(#rt-carreau)"/>`);
    s.push(`<rect x="0" y="392" width="${W}" height="${SOL - 392}" fill="#3A1E18" opacity=".55"/><path d="M0 392H${W}" stroke="#C88A50" stroke-width="3" opacity=".7"/>`);
    { let d = ""; for (let x = 20; x < W; x += 64) d += `M${x} 400h50v54h-50z`; s.push(`<path d="${d}" fill="none" stroke="#1A0E10" stroke-width="1.6" opacity=".35"/>`); }
    s.push(`<rect x="0" y="${SOL}" width="${W}" height="${H - SOL}" fill="url(#rt-sol)"/>`);
    { const VX = LX, VY = 300, rows = [SOL, 500, 556, 640, 760], col = 66; let d = "";
      for (let j = 0; j < rows.length - 1; j++) for (let k = -14; k < 14; k++) { if ((j + k) % 2) continue; const y0 = rows[j], y1 = rows[j + 1], X = (kk, y) => VX + kk * col * (y - VY) / (SOL - VY);
        d += `M${f(X(k, y0))} ${y0}L${f(X(k + 1, y0))} ${y0}L${f(X(k + 1, y1))} ${y1}L${f(X(k, y1))} ${y1}Z`; }
      s.push(`<path d="${d}" fill="#0E0A14" opacity=".42"/><rect x="0" y="${SOL - 3}" width="${W}" height="7" fill="#2A1A20"/>`);
    }

    // ---- 4. sous le plancher, en coupe : la grande bouche d'égout où la colonie fait la fête
    const VC = { x: 905, y: 770, rx: 205, ry: 268 };
    { const { x: cx, y: cy, rx, ry } = VC;
      s.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx + 32}" ry="${ry + 32}" fill="#7A4A3A"/><ellipse cx="${cx}" cy="${cy}" rx="${rx + 32}" ry="${ry + 32}" fill="url(#rt-brique)"/>`);
      let d = ""; for (let k = 0; k <= 16; k++) { const t = PI + k / 16 * PI; d += `M${f(cx + Math.cos(t) * rx)} ${f(cy + Math.sin(t) * ry)}L${f(cx + Math.cos(t) * (rx + 32))} ${f(cy + Math.sin(t) * (ry + 32))}`; }
      s.push(`<path d="${d}" stroke="#2A1A1E" stroke-width="2.4"/><ellipse cx="${cx}" cy="${cy}" rx="${rx + 32}" ry="${ry + 32}" fill="none" stroke="#1A1220" stroke-width="3"/>`);
      s.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#rt-cave)" stroke="#1A1220" stroke-width="3"/>`);
      K.halo(cx + 10, 640, 220, "#FFB060", .5);
      // l'eau qui coule au fond, et le quai où l'on danse
      s.push(`<path d="M${cx - rx} 700H${W}V${H}H${cx - rx}Z" fill="#0E1A30"/><path d="M${cx - rx + 20} 708H${W}" stroke="#FFC070" stroke-width="2" opacity=".45"/><path d="M${cx - rx + 4} 696H${W}" stroke="#4A2A24" stroke-width="7"/>`);
      // deux lanternes suspendues
      [[1004, 530], [878, 556]].forEach(([x, y], k) => { s.push(`<path d="M${x} ${y - 40}V${y - 14}" stroke="#1A1220" stroke-width="2"/><path d="M${x - 10} ${y - 14}H${x + 10}L${x + 7} ${y + 12}H${x - 7}Z" fill="#FFD27A" ${INK1}/><path d="M${x - 12} ${y - 16}H${x + 12}M${x - 9} ${y + 13}H${x + 9}" stroke="#1A1220" stroke-width="3"/>`);
        K.halo(x, y, 70, "#FFC060", .7); a.push(`<circle cx="${x}" cy="${y - 1}" r="6" fill="#FFF6D0" opacity=".9">${an(`<animate attributeName="opacity" values=".8;.5;.9;.8" keyTimes="0;.3;.6;1" dur="${(2.2 + k * .7).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); });
      // la guirlande d'ampoules, plus vive
      const g0 = [742, 600], g1 = [1076, 548], gc = [920, 668]; s.push(`<path d="M${g0[0]} ${g0[1]}Q${gc[0]} ${gc[1]} ${g1[0]} ${g1[1]}" fill="none" stroke="#1A1220" stroke-width="2"/>`);
      for (let k = 1; k <= 9; k++) { const t = k / 10, x = (1 - t) ** 2 * g0[0] + 2 * t * (1 - t) * gc[0] + t * t * g1[0], y = (1 - t) ** 2 * g0[1] + 2 * t * (1 - t) * gc[1] + t * t * g1[1]; if (K.dT(x, y) < 18) continue;
        K.halo(x, y + 5, 26, "#FFC060", .65); a.push(`<circle cx="${f(x)}" cy="${f(y + 5)}" r="5" fill="${["#FFE08A", "#FF8A5A", "#9AE0A0"][k % 3]}" stroke="#1A1220">${an(`<animate attributeName="opacity" values="1;.45;1" dur="${(1 + (k % 3) * .4).toFixed(1)}s" begin="${(k * .2).toFixed(1)}s" repeatCount="indefinite"/>`)}</circle>`); }
      // le festin chapardé : une caisse renversée, la baguette, le raisin, des bouchons, des miettes
      { let g = G(918, 694); g += `<ellipse cx="0" cy="2" rx="70" ry="8" fill="#000" opacity=".4"/><path d="M-50 0V-30H50V0Z" fill="#A8743A" ${INK}/><path d="M-50 -30H50" stroke="#1A1220" stroke-width="2"/><path d="M-50 -16H50M-24 -30V0M24 -30V0" stroke="#6A4420" stroke-width="2"/><path d="M-56 -32H56L50 -38H-50Z" fill="#E8E0D0" ${INK1}/><path d="M-56 -32L-60 -18L-48 -30M56 -32L62 -16L48 -30" fill="#E8E0D0" stroke="#1A1220" stroke-width="1"/>`;
        g += `${G(-14, -46, 1, -12)}<path d="M-40 0Q-40 -10 -28 -10H30Q42 -10 42 0Q42 8 30 8H-28Q-40 8 -40 0Z" fill="#E0A050" ${INK1}/><path d="M-26 -6l8 8M-10 -7l8 8M6 -7l8 8M20 -6l8 8" stroke="#A86A28" stroke-width="2"/></g>`;
        g += [[26, -48], [34, -46], [30, -40], [38, -40], [22, -40], [34, -34], [26, -33], [30, -27]].map(([x, y]) => `<circle cx="${x + 6}" cy="${y + 4}" r="4.6" fill="#8A3A8A" stroke="#1A1220" stroke-width="1"/>`).join("") + `<path d="M36 -48l4 -8" stroke="#3A6A2A" stroke-width="2"/>`;
        g += `<rect x="-46" y="-46" width="8" height="12" rx="2" fill="#D8A868" ${INK1}/><rect x="-36" y="-44" width="8" height="10" rx="2" fill="#C89858" ${INK1}/><circle cx="-60" cy="-2" r="2" fill="#E0A050"/><circle cx="62" cy="-3" r="2.2" fill="#E0A050"/><circle cx="-70" cy="0" r="1.6" fill="#E8B060"/></g>`; s.push(g); }
      // la colonie : 6 rats entiers, plus grands, qui dansent
      const rat = (c, sc, pose, dir) => { const v = dir || 1, bras = pose === "haut" ? "M-8 -26L-18 -46M8 -26L18 -46" : pose === "verre" ? "M-8 -24L-16 -12M8 -26L16 -44" : "M-8 -24L-18 -34M8 -24L18 -14";
        return `<g transform="scale(${v * sc} ${sc})"><path d="M8 -4Q30 0 28 -22" fill="none" stroke="#E8A0A8" stroke-width="2.4" stroke-linecap="round"/><path d="M-6 -2l-3 4h6M6 -2l3 4h-6" stroke="#E8A0A8" stroke-width="2" fill="none"/><path d="M-11 0Q-15 -26 -6 -36Q0 -40 6 -36Q15 -26 11 0Z" fill="${c}" ${INK1}/><ellipse cx="0" cy="-16" rx="6" ry="10" fill="#E8DCD8" opacity=".55"/>`
          + `<circle cx="-9" cy="-50" r="6" fill="${c}" ${INK1}/><circle cx="-9" cy="-50" r="3.4" fill="#F0A8B4"/><circle cx="9" cy="-52" r="6.5" fill="${c}" ${INK1}/><circle cx="9" cy="-52" r="3.8" fill="#F0A8B4"/><path d="M-12 -42Q-12 -54 0 -54Q12 -54 12 -42Q8 -36 0 -34Q-8 -36 -12 -42Z" fill="${c}" ${INK1}/><path d="M-4 -38L-16 -36L-8 -32Z" fill="${c}" ${INK1}/><circle cx="-16" cy="-36" r="2.2" fill="#E87A8A"/><circle cx="-4" cy="-45" r="1.8" fill="#1A1220"/><circle cx="4" cy="-46" r="1.8" fill="#1A1220"/><path d="M-5 -40q3 2 6 0" stroke="#1A1220" stroke-width="1" fill="none"/>`
          + `<path d="${bras}" stroke="#1A1220" stroke-width="5.4" stroke-linecap="round"/><path d="${bras}" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>${pose === "verre" ? `<path d="M13 -54h8l-2 9h-4z" fill="#FFF0C0" opacity=".9" stroke="#1A1220" stroke-width=".8"/>` : ""}</g>`; };
      [[770, 692, 1.55, "haut", 1, "#8A8098"], [836, 694, 1.8, "verre", -1, "#9A8A7A"], [988, 692, 1.85, "haut", -1, "#7A809A"], [1032, 694, 1.22, "danse", 1, "#8A7A8A"], [918, 646, 1.2, "haut", 1, "#A09AAA"], [726, 696, 1.05, "danse", -1, "#A89A90"]].forEach(([x, y, sc, pose, dir, c], k) => {
        a.push(`${G(x, y)}<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" dur="${(.5 + (k % 3) * .12).toFixed(2)}s" begin="${(k * .13).toFixed(2)}s" repeatCount="indefinite"/>`)}${rat(c, sc, pose, dir)}</g></g>`); });
    }

    // ---- 5. les casseroles de cuivre suspendues : elles renvoient la lueur dorée
    { const y0 = 268; s.push(`<path d="M592 ${y0}H884" stroke="#1A1220" stroke-width="7" stroke-linecap="round"/><path d="M592 ${y0}H884" stroke="#C88A50" stroke-width="3.4" stroke-linecap="round"/>`);
      [[618, 22, "p"], [672, 30, "c"], [736, 26, "p"], [800, 33, "c"], [858, 21, "p"]].forEach(([x, R, t]) => { const yc = y0 + 22 + R + (t === "c" ? 18 : 0);
        s.push(`<path d="M${x} ${y0}l-4 8h8z" fill="#1A1220"/>`);
        if (t === "p") s.push(trait(`M${x} ${y0 + 8}V${yc - R}`, "#8A4A22", 5) + `<circle cx="${x}" cy="${yc}" r="${R}" fill="url(#rt-poele)" ${INK}/><circle cx="${x}" cy="${yc}" r="${R * .7}" fill="none" stroke="#5A2812" stroke-width="1.4" opacity=".6"/>`);
        else s.push(trait(`M${x - R * .5} ${y0 + 8}L${x} ${yc - R + 4}L${x + R * .5} ${y0 + 8}`, "#5A2812", 2.4) + `<path d="M${x - R} ${yc - R + 6}H${x + R}V${yc + R * .5}Q${x + R} ${yc + R} ${x} ${yc + R}Q${x - R} ${yc + R} ${x - R} ${yc + R * .5}Z" fill="url(#rt-cuivre)" ${INK}/><path d="M${x - R - 3} ${yc - R + 6}H${x + R + 3}" stroke="#1A1220" stroke-width="5" stroke-linecap="round"/><path d="M${x - R - 3} ${yc - R + 6}H${x + R + 3}" stroke="#F0B070" stroke-width="2.4" stroke-linecap="round"/>`);
        s.push(`<path d="M${f(x - R * .5)} ${f(yc - R * .2)}q${f(R * .2)} ${f(-R * .4)} ${f(R * .6)} ${f(-R * .5)}" stroke="#FFF4D8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>`); });
      a.push(`<path d="M664 330l6 -6M796 342l6 -6M612 306l5 -5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="${K.anime ? 0 : .8}">${an(`<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.2;1" dur="3.4s" repeatCount="indefinite"/>`)}</path>`);
    }

    // ---- 6. le fourneau, ses flammes bleues, la grande cocotte de ratatouille
    const CX = 668, CY = 404;
    { s.push(`<path d="M582 ${SOL - 14}H754L760 ${SOL - 2}H576Z" fill="#4A4048" ${INK}/><rect x="578" y="${SOL - 2}" width="180" height="${532 - SOL + 2}" rx="4" fill="#24202A" ${INK}/><path d="M582 ${SOL + 8}H754" stroke="#E8B060" stroke-width="3"/>`);
      [[594, 652], [676, 742]].forEach(([x0, x1]) => s.push(`<rect x="${x0}" y="${SOL + 18}" width="${x1 - x0}" height="44" rx="5" fill="#16121A" stroke="#7A6A60" stroke-width="1.5"/><rect x="${x0 + 8}" y="${SOL + 24}" width="${x1 - x0 - 16}" height="6" rx="3" fill="#E8B060"/>`));
      K.halo(CX, SOL - 16, 120, "#4AA8FF", .5);
      a.push(`<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur=".35s" repeatCount="indefinite"/>`)}${[-100, -90, -80, 80, 90, 100].map(u => `<path d="M${CX + u - 6} ${SOL - 14}Q${CX + u} ${SOL - 50} ${CX + u + 6} ${SOL - 14}Z" fill="#4AB0FF" stroke="#1A3A8A" stroke-width="1"/><path d="M${CX + u - 2.5} ${SOL - 14}Q${CX + u} ${SOL - 32} ${CX + u + 2.5} ${SOL - 14}Z" fill="#E8F6FF"/>`).join("")}</g>`);
      s.push(`<ellipse cx="${CX}" cy="${CY + 46}" rx="84" ry="8" fill="#000" opacity=".35"/><path d="M${CX - 74} ${CY}V${CY + 26}Q${CX} ${CY + 52} ${CX + 74} ${CY + 26}V${CY}Z" fill="url(#rt-cuivre)" ${INK}/><path d="M${CX - 74} ${CY + 6}h-16M${CX + 74} ${CY + 6}h16" stroke="#3A2214" stroke-width="7" stroke-linecap="round"/>`);
      s.push(`<ellipse cx="${CX}" cy="${CY}" rx="74" ry="15" fill="#C8582A" ${INK}/><ellipse cx="${CX}" cy="${CY + 2}" rx="64" ry="10" fill="#D8442A"/>`);
      [[-44, "#F2C030"], [-22, "#3A8A3A"], [2, "#8A2A6A"], [26, "#F2C030"], [48, "#3A8A3A"]].forEach(([u, c]) => s.push(`<ellipse cx="${CX + u}" cy="${CY + 2}" rx="8" ry="3.6" fill="${c}"/>`));
      for (let q = 0; q < 3; q++) a.push(`<path d="M${CX + [-44, 8, 50][q]} ${CY - 8}q-10 -20 0 -38q10 -18 0 -36" fill="none" stroke="#FFF6DA" stroke-width="6" stroke-linecap="round" opacity="${K.anime ? 0 : .4}">${an(`<animate attributeName="opacity" values="0;.55;0" dur="3s" begin="${q}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -14" dur="3s" begin="${q}s" repeatCount="indefinite"/>`)}</path>`);
    }

    // ---- 7. le critique austère, à sa table, devant LA ratatouille en éventail ; sa bulle-souvenir reste visible
    { const TX = 360, TY = 480;
      s.push(`<ellipse cx="${TX}" cy="540" rx="96" ry="10" fill="#000" opacity=".35"/><path d="M${TX - 90} ${TY}L${TX - 98} 532Q${TX - 74} 540 ${TX - 49} 532Q${TX - 24} 540 ${TX} 532Q${TX + 24} 540 ${TX + 49} 532Q${TX + 74} 540 ${TX + 98} 532L${TX + 90} ${TY}Z" fill="#F4EEE2" ${INK}/><path d="M${TX + 30} ${TY + 8}L${TX + 42} 530M${TX + 62} ${TY + 6}L${TX + 76} 528M${TX - 60} ${TY + 8}L${TX - 70} 530" stroke="#D8CDB8" stroke-width="3"/><ellipse cx="${TX}" cy="${TY}" rx="90" ry="24" fill="#FFFBF2" ${INK}/>`);
      // l'assiette : rondelles rouges, jaunes, vertes et violettes en spirale (vue presque d'en haut)
      { let p = G(TX - 4, TY - 8) + `<ellipse rx="62" ry="30" fill="#FFFFFF" ${INK}/><ellipse rx="48" ry="23" fill="#F2EAD8" stroke="#D8CDB8" stroke-width="1.4"/><ellipse rx="46" ry="21" fill="#B8341E" opacity=".7"/>`;
        const cols = ["#D8341E", "#F2C030", "#3A8A3A", "#7A2A6A"]; let k = 0;
        [[38, 15, 20], [26, 10, 14], [13, 5, 8]].forEach(([rx, ry, n]) => { for (let j = 0; j < n; j++) { const t = j / n * TAU; p += `<ellipse cx="${f(Math.cos(t) * rx)}" cy="${f(Math.sin(t) * ry)}" rx="7.4" ry="5" transform="rotate(${f(t * 57.3 + 90)} ${f(Math.cos(t) * rx)} ${f(Math.sin(t) * ry)})" fill="${cols[k++ % 4]}" stroke="#1A1220" stroke-width=".7"/>`; } });
        p += `<path d="M-6 -2q4 -6 10 -2" stroke="#3A8A3A" stroke-width="2.4" fill="none"/><ellipse cx="-18" cy="-8" rx="10" ry="3" fill="#FFF" opacity=".35"/></g>`; s.push(p); }
      s.push(`<rect x="${TX + 62}" y="${TY - 38}" width="7" height="30" fill="#F8F0D8" ${INK1}/><path d="M${TX + 57} ${TY - 8}h17" stroke="#C8A050" stroke-width="3"/>`); K.halo(TX + 65, TY - 44, 46, "#FFD27A", .8); K.halo(TX - 20, TY - 70, 150, "#FFC870", .35);
      a.push(`<path d="M${TX + 65} ${TY - 39}q-5 -8 0 -16q5 8 0 16Z" fill="#FFC040" stroke="#C86020" stroke-width=".8">${an(`<animateTransform attributeName="transform" type="scale" values="1 1;1 1.12;1 1" dur=".7s" repeatCount="indefinite" additive="sum"/>`)}</path>`);
      // le critique : grand, sec, anguleux, dans une chaise haute à dossier ; la fourchette levée, figé de surprise
      let c = G(250, 536, .95);
      c += `<path d="M-52 0V-214Q-52 -236 -36 -238Q-20 -236 -20 -214V-96H34V-84H-20V0" fill="none" stroke="#1A1220" stroke-width="12" stroke-linejoin="round"/><path d="M-52 0V-214Q-52 -236 -36 -238Q-20 -236 -20 -214V-96H34V-84H-20V0" fill="none" stroke="#5A2E22" stroke-width="8" stroke-linejoin="round"/><path d="M30 -90V0" stroke="#1A1220" stroke-width="9"/><path d="M30 -90V0" stroke="#5A2E22" stroke-width="5"/>`;
      c += `<path d="M-30 -98L-24 -204Q-18 -222 0 -222Q16 -220 18 -204L22 -98Z" fill="#2A2238" ${INK}/><path d="M14 -204Q20 -150 20 -100" stroke="#C88A60" stroke-width="3" opacity=".55" fill="none"/><path d="M-30 -100H52V-84H-30Z" fill="#2A2238" ${INK}/><path d="M42 -86L48 -6H62" fill="none" stroke="#1A1220" stroke-width="14" stroke-linejoin="round"/><path d="M42 -86L48 -6H62" fill="none" stroke="#2A2238" stroke-width="10" stroke-linejoin="round"/>`;
      c += `<path d="M-6 -222L4 -200L12 -222Z" fill="#F4F0E8" ${INK1}/><rect x="-4" y="-236" width="12" height="16" fill="#E0CCB8" ${INK1}/>`;
      c += `<path d="M-16 -232Q-22 -270 0 -282Q20 -284 22 -262L34 -252L22 -246Q22 -232 8 -228Q-6 -226 -16 -232Z" fill="#E6D3C0" ${INK}/><path d="M18 -262Q24 -250 20 -238" stroke="#FFC880" stroke-width="2.4" fill="none" opacity=".8"/>`;
      c += `<path d="M-18 -250Q-24 -286 2 -288Q20 -288 22 -270Q8 -276 -6 -270Q-14 -264 -14 -244Z" fill="#1A1420"/><circle cx="12" cy="-263" r="3.4" fill="#FFF" stroke="#1A1220" stroke-width="1.2"/><circle cx="13" cy="-263" r="1.6" fill="#1A1220"/><path d="M6 -271l12 -3" stroke="#1A1220" stroke-width="1.6"/><ellipse cx="17" cy="-240" rx="3" ry="2.4" fill="#5A2A2A"/>`;
      c += trait("M2 -200L46 -176L40 -226", "#2A2238", 9) + `<circle cx="40" cy="-228" r="5.5" fill="#E6D3C0" ${INK1}/><path d="M42 -232L48 -254M46 -254l-2 -8M48 -254l1 -8M50 -254l3 -7" stroke="#C8C8D0" stroke-width="2.2" stroke-linecap="round"/>`;
      c += `</g>`; s.push(c);
      // la bulle-souvenir (sépia, toujours visible) : la petite cuisine de campagne, la maman, le garçonnet et son bol
      const BX = 336, BY = 180, BR = 62;
      let b = `<circle cx="272" cy="248" r="6" fill="#F4E0B8" stroke="#6A4A2A" stroke-width="2"/><circle cx="286" cy="232" r="9" fill="#F4E0B8" stroke="#6A4A2A" stroke-width="2"/>`;
      b += `<circle cx="${BX}" cy="${BY}" r="${BR + 4}" fill="#FFE6B0" opacity=".35"/><circle cx="${BX}" cy="${BY}" r="${BR}" fill="#F2DDB0" stroke="#6A4A2A" stroke-width="4"/><circle cx="${BX}" cy="${BY}" r="${BR - 7}" fill="none" stroke="#C8A070" stroke-width="1.5"/>`;
      b += `${G(BX, BY, .9)}<rect x="-46" y="-44" width="30" height="28" fill="#CFE0EC" stroke="#6A4A2A" stroke-width="2"/><path d="M-46 -30h30M-31 -44v28" stroke="#6A4A2A" stroke-width="2"/><path d="M-62 30H62V40H-62Z" fill="#9A6A3A"/>`
        + `<path d="M18 30V-4Q18 -18 30 -18Q42 -18 42 -4V30Z" fill="#B86A40" stroke="#4A2A14" stroke-width="2"/><circle cx="30" cy="-26" r="9" fill="#EAC8A2" stroke="#4A2A14" stroke-width="2"/><path d="M22 -32Q30 -42 38 -32" fill="#6A3A1A"/>`
        + `<path d="M-10 30H16V14H-10Z" fill="#7A4A24" stroke="#4A2A14" stroke-width="1.5"/><ellipse cx="2" cy="12" rx="12" ry="3.4" fill="#FFF" stroke="#4A2A14" stroke-width="1.5"/><path d="M-4 8q-3 -8 0 -14M6 8q3 -8 0 -14" stroke="#A88060" stroke-width="2" fill="none"/>`
        + `<path d="M-36 30V8Q-36 0 -28 0Q-20 0 -20 8V30Z" fill="#6A8AB0" stroke="#4A2A14" stroke-width="2"/><circle cx="-28" cy="-8" r="8" fill="#EAC8A2" stroke="#4A2A14" stroke-width="2"/><path d="M-20 8L-10 6" stroke="#4A2A14" stroke-width="3" stroke-linecap="round"/></g>`;
      s.push(b);
      a.push(`<circle cx="${BX}" cy="${BY}" r="${BR + 3}" fill="none" stroke="#FFE6B0" stroke-width="3" opacity="${K.anime ? 0 : .5}">${an(`<animate attributeName="opacity" values="0;.7;0" dur="3.2s" repeatCount="indefinite"/>`)}</circle>`);
    }

    // ---- 8. LE HÉROS : l'apprenti (de dos) mené comme une marionnette par le petit chef rat agrippé à ses cheveux
    { const AX = 512, AY = 620, SC = .88;
      K.halo(AX + 30, 300, 300, "#FFE8B0", .55);
      let h = G(AX, AY, SC);
      // bras droit tendu vers la cocotte, la louche qui remue
      h += `<g>${an(`<animateTransform attributeName="transform" type="rotate" values="0 46 -212;-4 46 -212;0 46 -212" dur="1.6s" repeatCount="indefinite"/>`)}` + trait("M42 -212L100 -196L146 -236", "#F4F1EA", 24) + `<path d="M98 -200L132 -226" stroke="#FFD890" stroke-width="5" opacity=".8" stroke-linecap="round"/><path d="M146 -236L194 -230" stroke="#1A1220" stroke-width="8" stroke-linecap="round"/><path d="M146 -236L194 -230" stroke="#C8904A" stroke-width="4.6" stroke-linecap="round"/><circle cx="148" cy="-238" r="11" fill="#EBC2A0" ${INK}/></g>`;
      // le corps (veste blanche, de dos) : côté fourneau doré, côté nuit bleuté
      h += `<path d="M-46 0L-56 -196Q-54 -228 -18 -234L26 -234Q52 -228 54 -196L46 0Z" fill="#F4F1EA" ${INK}/><path d="M-46 0L-56 -196Q-54 -228 -18 -234L-6 -234Q-20 -200 -14 -120L-12 0Z" fill="#7A80A8" opacity=".55"/><path d="M48 -6L54 -196Q52 -224 30 -232" fill="none" stroke="#FFD27A" stroke-width="7" opacity=".9"/><path d="M20 -226Q36 -160 34 -20" fill="none" stroke="#FFE8B8" stroke-width="10" opacity=".35"/>`;
      // plis de la veste, cordon du tablier, torchon à la ceinture
      h += `<path d="M-30 -200Q-24 -160 -32 -128M28 -200Q22 -168 30 -132M2 -190Q6 -160 0 -130" fill="none" stroke="#C0B8C8" stroke-width="2.4"/><path d="M-52 -122Q0 -112 52 -122" stroke="#D8D2C8" stroke-width="7" fill="none"/><path d="M0 -118Q-22 -136 -24 -114Q-20 -102 0 -118Q22 -136 24 -114Q20 -102 0 -118Z" fill="#ECE6DA" ${INK1}/><path d="M-2 -116L-10 -90M2 -116L12 -92" stroke="#ECE6DA" stroke-width="5"/>`;
      h += `${G(-44, -120, 1, 8)}<path d="M-8 0H12L14 44H-10Z" fill="#DCE8F4" ${INK1}/><path d="M-9 12H13M-9.5 22H13.5M-10 32H14" stroke="#4C7ACC" stroke-width="3"/></g>`;
      h += `<path d="M-22 -234Q2 -224 28 -234L26 -244Q2 -236 -20 -244Z" fill="#FFFFFF" ${INK1}/><rect x="-10" y="-258" width="24" height="18" fill="#E2B896" ${INK1}/>`;
      // la tête (de dos, cheveux roux en bataille)
      h += `<ellipse cx="4" cy="-284" rx="32" ry="36" fill="#8E3A1C" ${INK}/><path d="M22 -306Q36 -290 30 -262" stroke="#E0783A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M26 -262Q38 -270 36 -294L30 -296Q32 -272 20 -262Z" fill="#EBC2A0" ${INK1}/><ellipse cx="33" cy="-282" rx="6" ry="10" fill="#EBC2A0" ${INK1}/>`;
      h += `<path d="M-26 -300L-36 -296L-28 -310L-34 -318L-20 -316M-10 -262L-14 -248L-4 -256L0 -246L8 -258" fill="#8E3A1C" stroke="#1A1220" stroke-width="1.6" stroke-linejoin="round"/>`;
      // bras gauche levé, tiré par la mèche (marionnette) : il suit le geste du rat
      h += `<g>${an(`<animateTransform attributeName="transform" type="rotate" values="0 -46 -212;-16 -46 -212;0 -46 -212" dur="1.6s" repeatCount="indefinite"/>`)}` + trait("M-46 -212L-100 -250L-96 -320", "#F4F1EA", 24) + `<path d="M-50 -222L-96 -254" stroke="#7A80A8" stroke-width="8" opacity=".5"/><circle cx="-96" cy="-326" r="12" fill="#EBC2A0" ${INK}/><path d="M-104 -334l-6 -10M-98 -338l-2 -12M-90 -338l3 -11M-85 -330l9 -6" stroke="#1A1220" stroke-width="7" stroke-linecap="round"/><path d="M-104 -334l-6 -10M-98 -338l-2 -12M-90 -338l3 -11M-85 -330l9 -6" stroke="#EBC2A0" stroke-width="4" stroke-linecap="round"/></g>`;
      // le petit chef rat, de 3/4, agrippé aux cheveux : la patte gauche tire une mèche (=> le bras se lève)
      h += `${G(4, -328, 1.38)}`;
      h += `<path d="M14 -4C46 6 56 40 40 76" fill="none" stroke="#1A1220" stroke-width="8.4" stroke-linecap="round"/><path d="M14 -4C46 6 56 40 40 76" fill="none" stroke="#F0A8B4" stroke-width="5.4" stroke-linecap="round"/>`;
      h += `<ellipse cx="-16" cy="2" rx="12" ry="5" fill="#F0A8B4" ${INK1}/><ellipse cx="16" cy="3" rx="12" ry="5" fill="#F0A8B4" ${INK1}/>`;
      h += `<path d="M-28 -2C-36 -44 -18 -74 2 -76C24 -74 36 -44 28 -2C18 6 -18 6 -28 -2Z" fill="#8592A8" ${INK}/><ellipse cx="-4" cy="-30" rx="15" ry="22" fill="#D3D8E2"/><path d="M24 -60Q34 -36 28 -8" fill="none" stroke="#FFD890" stroke-width="4" opacity=".9" stroke-linecap="round"/><path d="M-26 -50Q-32 -30 -26 -6" fill="none" stroke="#4A5070" stroke-width="4" opacity=".5"/>`;
      h += `<g>${an(`<animateTransform attributeName="transform" type="translate" values="0 0;-2 -9;0 0" dur="1.6s" repeatCount="indefinite"/>`)}` + trait("M-6 14Q-30 0 -38 -26", "#B0502A", 6) + trait("M-14 -54L-36 -30", "#8592A8", 8) + `<circle cx="-38" cy="-28" r="7.5" fill="#F0A8B4" ${INK1}/></g>`;
      h += trait("M10 14Q26 4 28 -18", "#B0502A", 6) + trait("M14 -56L28 -22", "#8592A8", 8) + `<circle cx="28" cy="-20" r="7" fill="#F0A8B4" ${INK1}/>`;
      h += `<circle cx="-26" cy="-112" r="15" fill="#8592A8" ${INK}/><circle cx="-26" cy="-112" r="9" fill="#F0A8B4"/><circle cx="20" cy="-116" r="17" fill="#8592A8" ${INK}/><circle cx="20" cy="-116" r="10.5" fill="#F0A8B4"/>`;
      h += `<path d="M-26 -84C-30 -104 -14 -118 2 -116C22 -114 30 -98 24 -82C18 -70 -4 -68 -14 -72Z" fill="#8592A8" ${INK}/>`;
      h += `<path d="M-14 -72Q-38 -74 -46 -86Q-40 -98 -24 -98Q-10 -96 -6 -84Z" fill="#AAB4C6" ${INK}/><ellipse cx="-44" cy="-89" rx="6.4" ry="5" fill="#F07A92" ${INK1}/><circle cx="-46" cy="-91" r="1.6" fill="#FFF" opacity=".8"/>`;
      h += `<ellipse cx="-4" cy="-82" rx="6" ry="3.6" fill="#F08A9A" opacity=".55"/><path d="M-32 -79Q-24 -70 -16 -77Q-22 -75 -32 -79Z" fill="#7A2A3A" stroke="#1A1220" stroke-width="1.4"/>`;
      h += `<path d="M-30 -78Q-24 -73 -18 -76" fill="none" stroke="#1A1220" stroke-width="1.8" stroke-linecap="round"/><path d="M-36 -84L-58 -90M-36 -82L-58 -80M-30 -84L-50 -96" stroke="#1A1220" stroke-width="1" opacity=".8"/>`;
      h += `<ellipse cx="-14" cy="-98" rx="7.4" ry="9" fill="#FFFFFF" ${INK1}/><ellipse cx="6" cy="-100" rx="8" ry="9.6" fill="#FFFFFF" ${INK1}/><circle cx="-16" cy="-97" r="4.4" fill="#2A1A20"/><circle cx="3" cy="-99" r="4.8" fill="#2A1A20"/><circle cx="-14.5" cy="-99" r="1.7" fill="#FFF"/><circle cx="4.8" cy="-101.5" r="1.9" fill="#FFF"/>`;
      h += `<path d="M-22 -110Q-14 -108 -8 -105M0 -108Q8 -112 14 -110" fill="none" stroke="#1A1220" stroke-width="2" stroke-linecap="round"/>`;
      h += `${G(-2, -122, 1, 14)}<rect x="-20" y="-12" width="40" height="13" rx="3" fill="#FFFFFF" ${INK}/><path d="M-20 -10C-38 -16 -38 -44 -20 -44C-22 -64 6 -70 10 -52C22 -68 46 -52 30 -36C42 -30 36 -12 20 -10Z" fill="#FFFFFF" ${INK}/><path d="M-8 -12Q-10 -30 -4 -44M8 -12Q10 -30 14 -46" fill="none" stroke="#C8C8D8" stroke-width="1.6"/><path d="M22 -14Q36 -24 30 -40" stroke="#FFD890" stroke-width="3" fill="none"/></g>`;
      h += `</g></g>`;
      s.push(h); K.prendre(AX, AY - 220, 160);
    }

    // ---- 9. le passe arrondi (premier plan) : 4 assiettes sous 4 lampes chauffantes = les portraits des 4 pilotes
    const PORTR = [];
    { const xs = [240, 336, 432, 528], yA = x => 598 - Math.sin((x - 170) / 420 * PI) * 10, R = 35;
      s.push(`<path d="M170 560Q380 524 590 560L584 644H176Z" fill="#4A2A1A" ${INK}/><path d="M164 556Q380 516 596 556L596 566Q380 528 164 566Z" fill="#C8C0B8" ${INK}/><path d="M176 572Q380 540 584 572" stroke="#FFC870" stroke-width="2" opacity=".6" fill="none"/>`);
      xs.forEach((x, k) => { const c = COULEURS_J[k], y = yA(x); PORTR.push({ k, x, y: Math.round(y), r: R });
        s.push(`<path d="M${x - 18} 520L${x - 48} ${f(y + 20)}H${x + 48}L${x + 18} 520Z" fill="url(#rt-cone)"/>`);
        K.halo(x, 526, 48, "#FFE6A8", .75); s.push(`<path d="M${x} 500V508" stroke="#2A1A14" stroke-width="3"/><path d="M${x - 20} 522Q${x} 500 ${x + 20} 522Z" fill="#B86A32" ${INK1}/><ellipse cx="${x}" cy="522" rx="14" ry="3.4" fill="#FFF0B8"/>`);
        s.push(`${G(x, y)}<ellipse cx="3" cy="${R + 6}" rx="${R + 6}" ry="6" fill="#000" opacity=".35"/><circle r="${R + 9}" fill="#FFFFFF" ${INK}/><circle r="${R + 9}" fill="none" stroke="#E8DCC8" stroke-width="3" stroke-dasharray="2 5"/><circle r="${R + 2.5}" fill="none" stroke="${c}" stroke-width="6"/><circle r="${R}" fill="#1A1420"/></g>`); });
      s.push(`<path d="M200 500H560" stroke="#2A1A14" stroke-width="4"/>`);
    }

    // ---- 10. la piste : bitume chaud près de la cuisine, pavés bleus de nuit sur les toits
    K.route([["#000", 40, ` opacity=".45" filter="url(#rt-flou)"`], ["#140E1C", 35], ["url(#rt-route)", 30], ["#000", 24, ` opacity=".16" stroke-dasharray="1.6 6"`]]);
    s.push(`<path d="${K.piste}" fill="none" stroke="#FFD27A" stroke-width="1.8" stroke-dasharray="10 12" opacity=".8"/>`);
    K.depart();
    // UNE lumière par-dessus tout : la flaque d'or du fourneau, puis la nuit bleue sur les bords
    s.push(`<rect width="${W}" height="${H}" fill="url(#rt-flaque)" style="mix-blend-mode:screen" opacity=".85"/>`);
    s.push(`<rect width="${W}" height="${H}" fill="url(#rt-nuit)"/>`);
    K.particules(8, "#FFE2A0", 1.6, "scintille");
    const RES = K.fin(`<rect width="${W}" height="${H}" fill="url(#rt-ciel)"/>`, "#1A1440", .05); RES.portraits = PORTR; return RES;
  }

  const PEINTS_NUIT = { ratatouille: peindreRatatouille, arene: peindreArene2, etoiles: peindreEtoiles4, anneau: peindreAnneau4, chocolat: peindreChocolat3, terrier: peindreGouter, chateau: peindreChateau5, plateau: peindrePlateau, envers: peindreEnvers3, multivers: peindreMultivers, dunes: peindreDunes4, titans: peindreTitans4, odyssee: peindreOdyssee2 };   // v16.34 : 10 cartes refaites au niveau de l'Arène
  const PEINTS = { foret: { peindre: peindreForet3, deco: decorForet }, garage: { peindre: peindreGarage5, deco: decorGarage } };
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
    const son = k => { try { if (window.SONS) SONS.ev(k); } catch (e) { } };   // V16.43 : chaque événement a son son
    return { f, el, anim, voiture, dedans, bulle, premier, dernier, son };
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
      const anneau = vainq => { const p = O.voiture(vainq); if (!p || !de) return; fait = true; O.son("anneau");
        const g = O.el('<g><circle r="30" fill="#FFD86B" opacity=".35"/><circle r="15" fill="none" stroke="#F7C948" stroke-width="6"/><circle r="15" fill="none" stroke="#FFF6C8" stroke-width="1.6" stroke-dasharray="5 7"/></g>');
        const b = O.bulle(p[0], p[1] - 70, "Le Précieux…", 24);
        O.anim(2200, q => { const k = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2, u = p[0] + (de[0] - p[0]) * k, v = p[1] + (de[1] - p[1]) * k - Math.sin(q * Math.PI) * 180;
          g.setAttribute("transform", "translate(" + O.f(u) + " " + O.f(v) + ") rotate(" + O.f(q * 720) + ") scale(" + O.f(1 - q * .55) + ")"); if (q > .3) b.setAttribute("opacity", O.f(Math.max(0, 1 - (q - .3) * 3))); },
        () => { g.remove(); b.remove(); O.son("lave"); const sp = O.el('<g transform="translate(' + O.f(de[0]) + " " + O.f(de[1]) + ')"><circle r="10" fill="url(#an-lave)"/><circle r="10" fill="none" stroke="#FFB02A" stroke-width="5"/></g>'), c = sp.firstChild.children;
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
      const bache = n => { const p = O.voiture(n); if (!p) return; fait = true; O.son("bache");
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
            b = O.bulle(p.x * x.KU, p.z * x.KU - 80, "Les escaliers changent de place !", 22); O.son("escalier"); }
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
        permuter(e, pts) { if (!x.anime) return; if (!duo && e >= .3 && e < .44) { const n = Object.keys(pts).sort((a, c) => pts[c] - pts[a]); if (n.length > 1) { duo = [n[0], n[n.length - 1]]; b = O.bulle(540, 70, "Changement de place ! ☕", 28); O.son("changement"); } }
          if (!duo) return; const k = m(e), a = pts[duo[0]], c = pts[duo[1]]; if (k > 0) { pts[duo[0]] = a + (c - a) * k; pts[duo[1]] = c + (a - c) * k; }
          if (b && e > .45) { b.remove(); b = null; } },
        maj() { }
      };
    },
    /* ---------- V16.38 · un événement pour chaque mois (attachés aux voitures : ils survivent aux nouvelles cartes) ---------- */
    /* janvier 2027 · Ratatouille : à l'arrivée, le petit chef rat court jusqu'au vainqueur et lui pose sa toque */
    ratatouille(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; O.son("ratatouille"); const n = O.premier(c), p = O.dedans(O.voiture(n)); if (!p) return;
        const rat = O.el('<g><ellipse cx="0" cy="22" rx="20" ry="5" fill="#000" opacity=".25"/><path d="M18 10C34 8 40 -2 34 -10" stroke="#8E7E86" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="8" rx="20" ry="13" fill="#8C7F8A" stroke="#3A3036" stroke-width="2"/><circle cx="-16" cy="-2" r="10" fill="#8C7F8A" stroke="#3A3036" stroke-width="2"/><circle cx="-10" cy="-12" r="6" fill="#C9A3B3" stroke="#3A3036" stroke-width="1.6"/><circle cx="-22" cy="-4" r="2" fill="#1A1416"/><circle cx="-26" cy="0" r="2.6" fill="#E88AA6"/><path d="M-26 -1L-36 -4M-26 1L-36 2" stroke="#3A3036" stroke-width="1"/>' +
          '<g class="toque" transform="translate(-14 -14)"><path d="M-9 0V-8C-14 -9 -14 -16 -9 -16C-8 -21 -2 -22 0 -19C2 -22 8 -21 9 -16C14 -16 14 -9 9 -8V0Z" fill="#FAFAF6" stroke="#9A9A92" stroke-width="1.4"/></g></g>');
        const b = O.bulle(p[0], p[1] - 90, "Tout le monde peut cuisiner !", 17);
        O.anim(1300, q => { const k = 1 - Math.pow(1 - q, 2); rat.setAttribute("transform", "translate(" + O.f(p[0] - 260 + k * 220) + " " + O.f(p[1] + 20 - Math.abs(Math.sin(q * 18)) * 14) + ") scale(1.7)"); }, () => {
          O.anim(900, q => { const tq = rat.querySelector(".toque"); tq.setAttribute("transform", "translate(" + O.f(-14 + q * 38) + " " + O.f(-14 - Math.sin(q * Math.PI) * 50 - q * 6) + ") rotate(" + O.f(q * 360) + ")"); }, () => {
            setTimeout(() => { O.anim(600, q => { rat.setAttribute("opacity", O.f(1 - q)); b.setAttribute("opacity", O.f(1 - q)); }, () => { rat.remove(); b.remove(); }); }, 1400); }); }); } }; },
    /* janvier · des ballons s'envolent de la voiture du vainqueur à l'arrivée */
    foret(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; O.son("foret"); const p = O.dedans(O.voiture(O.premier(c))); if (!p) return;
        const g = O.el([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(i => { const a = (i / 14 - .5) * 1.6, col = ["#FF6FA8", "#4C9AFF", "#F2C230", "#2BB6A3", "#F2994A", "#B57BFF", "#FF5A5F"][i % 7];
          return '<g transform="translate(' + O.f(Math.sin(a) * 60) + " " + O.f(-90 - Math.cos(a) * 50 - (i % 3) * 14) + ')"><path d="M0 14Q' + O.f(-Math.sin(a) * 30) + ' 50 ' + O.f(-Math.sin(a) * 60) + ' 90" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/><ellipse rx="13" ry="16" fill="' + col + '"/><ellipse cx="-4" cy="-6" rx="3.5" ry="5" fill="#fff" opacity=".45"/></g>'; }).join(""));
        const b = O.bulle(p[0], p[1] - 210, "Et c’est parti pour l’aventure !", 22);
        O.anim(3200, q => { g.setAttribute("transform", "translate(" + O.f(p[0] + Math.sin(q * 6) * 8) + " " + O.f(p[1] - q * 300) + ") scale(" + O.f(.4 + Math.min(1, q * 3) * .6) + ")"); g.setAttribute("opacity", O.f(q < .75 ? 1 : (1 - q) * 4)); b.setAttribute("opacity", O.f(q < .6 ? 1 : Math.max(0, 1 - (q - .6) * 3))); }, () => { g.remove(); b.remove(); }); } }; },
    /* mai · un parachute argenté (cadeau des sponsors) descend sur la voiture du dernier */
    arene(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .45 || !x.anime) return; fait = true; O.son("arene"); const n = O.dernier(c);
        const g = O.el('<g><path d="M-34 0Q0 -40 34 0Q24 -6 17 0Q8 -8 0 0Q-8 -8 -17 0Q-24 -6 -34 0Z" fill="#E8ECF2" stroke="#9AA3B0" stroke-width="1.5"/><path d="M-34 0L-6 42M34 0L6 42M0 0V42" stroke="#C9CFD8" stroke-width="1"/><rect x="-9" y="40" width="18" height="15" rx="2" fill="#C0C6CF" stroke="#7D8590" stroke-width="1.5"/><circle cx="0" cy="47.5" r="3" fill="#E2B23C"/></g>');
        const b = O.bulle(540, 60, "🪂 Un cadeau des sponsors pour " + n + " !", 24);
        O.anim(2600, q => { const p = O.voiture(n) || [0, 0]; g.setAttribute("transform", "translate(" + O.f(p[0] + Math.sin(q * 9) * 12 * (1 - q)) + " " + O.f(p[1] - 60 - (1 - q) * 360) + ")"); if (q > .8) g.setAttribute("opacity", O.f((1 - q) * 5)); }, () => { g.remove(); setTimeout(() => b.remove(), 600); }); } }; },
    /* juin · le chasseur du vainqueur fait un looping au-dessus de la ligne */
    etoiles(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; O.son("etoiles"); const n = O.premier(c), p = O.dedans(O.voiture(n)); if (!p) return; const col = (x.V[n] && x.V[n].couleur) || "#4C9AFF";
        const g = O.el('<g><path d="M-22 0L-4 -4 18 0-4 4Z" fill="#E8ECF2" stroke="#3B4048" stroke-width="1.2"/><path d="M-14 -4L-20 -16M-14 4L-20 16M-2 -4L-8 -16M-2 4L-8 16" stroke="' + col + '" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="0" r="3" fill="#1B1D22"/><path d="M-22 0H-46" stroke="' + col + '" stroke-width="5" opacity=".6" stroke-linecap="round"/></g>');
        const b = O.bulle(p[0], p[1] - 150, "Bien joué, petit ! Ne te laisse pas griser.", 20);
        O.anim(2400, q => { const a = q * Math.PI * 2 - Math.PI / 2, r = 90, u = p[0] - 200 + q * 400 + Math.cos(a) * r * Math.sin(q * Math.PI), v = p[1] - 90 + Math.sin(a) * r * Math.sin(q * Math.PI);
          const d = q * 360 + Math.cos(q * Math.PI) * 0; g.setAttribute("transform", "translate(" + O.f(u) + " " + O.f(v) + ") rotate(" + O.f(d) + ")"); g.setAttribute("opacity", O.f(q > .85 ? (1 - q) * 6.6 : 1)); }, () => { g.remove(); b.remove(); }); } }; },
    /* juillet · le ver surgit juste derrière la voiture du dernier */
    dunes(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .4 || !x.anime) return; fait = true; O.son("dunes"); const n = O.dernier(c), p0 = O.voiture(n); if (!p0) return; const p = [p0[0], p0[1]];
        const g = O.el('<g><ellipse rx="70" ry="22" fill="#C9874A" opacity=".55"/><g class="ver"><path d="M-40 0C-40 -90 40 -90 40 0" stroke="#8C6A4E" stroke-width="34" fill="none"/><path d="M-40 0C-40 -90 40 -90 40 0" stroke="#6E5440" stroke-width="34" fill="none" stroke-dasharray="3 9"/><circle cx="40" cy="-4" r="22" fill="#3A2418"/><circle cx="40" cy="-4" r="15" fill="none" stroke="#F4E3C1" stroke-width="4" stroke-dasharray="2 3"/></g>' + [0, 1, 2, 3, 4, 5, 6].map(i => '<circle cx="' + (-60 + i * 20) + '" cy="' + (-4 - (i % 2) * 10) + '" r="' + (6 + i % 3 * 3) + '" fill="#E3B57A" opacity=".8"/>').join("") + "</g>");
        const b = O.bulle(p[0], p[1] - 130, "Le ver ! Derrière " + n + " !", 24);
        O.anim(2200, q => { const k = Math.sin(q * Math.PI); g.setAttribute("transform", "translate(" + O.f(p[0] - 90) + " " + O.f(p[1] + 14) + ")"); g.querySelector(".ver").setAttribute("transform", "translate(0 " + O.f((1 - k) * 60) + ") scale(1.9 " + O.f(Math.max(.05, k) * 1.9) + ")"); g.setAttribute("opacity", O.f(Math.min(1, k * 3))); }, () => { g.remove(); b.remove(); }); } }; },
    /* août · le monde bascule à l'envers un instant */
    envers(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; x.svg.style.transform = ""; x.svg.style.filter = ""; }, maj(e, c, en) { if (!en || fait || e < .5 || !x.anime) return; fait = true; O.son("envers"); const sv = x.svg;
        sv.style.transition = "transform .5s ease-in-out, filter .5s"; sv.style.transform = "scaleY(-1)"; sv.style.filter = "hue-rotate(160deg) saturate(1.6) brightness(.8)";
        setTimeout(() => { sv.style.transform = ""; sv.style.filter = ""; setTimeout(() => { sv.style.transition = ""; const b = O.bulle(540, 360, "On revient de loin…", 26); setTimeout(() => b.remove(), 1600); }, 550); }, 1700); } }; },
    /* septembre · un portail orange s'ouvre devant le leader */
    multivers(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .55 || !x.anime) return; fait = true; O.son("multivers"); const n = O.premier(c);
        const g = O.el('<g>' + Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return '<path d="M' + O.f(Math.cos(a) * 34) + " " + O.f(Math.sin(a) * 34) + "l" + O.f(Math.cos(a + 1.4) * 10) + " " + O.f(Math.sin(a + 1.4) * 10) + '" stroke="' + (i % 3 ? "#FF9A2A" : "#FFE07A") + '" stroke-width="3" stroke-linecap="round"/>'; }).join("") + '<circle r="32" fill="none" stroke="#FFB02A" stroke-width="4"/><circle r="30" fill="#2A1450" opacity=".35"/></g>');
        const b = O.bulle(540, 60, "Un portail s’ouvre devant " + n + " !", 24);
        O.anim(2000, q => { const p = O.voiture(n) || [0, 0]; g.setAttribute("transform", "translate(" + O.f(p[0]) + " " + O.f(p[1]) + ") rotate(" + O.f(q * 540) + ") scale(" + O.f(Math.sin(q * Math.PI) * 1.4) + ")"); }, () => { g.remove(); b.remove(); }); } }; },
    /* octobre · pluie de tickets d'or sur le vainqueur */
    chocolat(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .985 || !x.anime) return; fait = true; O.son("chocolat"); const n = O.premier(c), p = O.dedans(O.voiture(n)); if (!p) return;
        const T = Array.from({ length: 16 }, (_, i) => ({ dx: (Math.random() - .5) * 220, d: Math.random() * .35, r: Math.random() * 360, el: O.el('<g><rect x="-16" y="-9" width="32" height="18" rx="2" fill="#F2C230" stroke="#A8761A" stroke-width="1.5"/><rect x="-12" y="-5" width="24" height="10" fill="none" stroke="#A8761A" stroke-width=".8"/></g>') }));
        const b = O.bulle(p[0], p[1] - 160, "Un ticket d’or pour " + n + " !", 24);
        O.anim(2600, q => T.forEach(t => { const k = Math.max(0, Math.min(1, (q - t.d) / .6)); t.el.setAttribute("transform", "translate(" + O.f(p[0] + t.dx * (1 - k * .7)) + " " + O.f(p[1] - 230 + k * 220) + ") rotate(" + O.f(t.r + k * 400) + ") scale(" + O.f(.6 + Math.sin(k * 6) * .15) + ")"); t.el.setAttribute("opacity", O.f(q > .85 ? (1 - q) * 6.6 : k > 0 ? 1 : 0)); }), () => { T.forEach(t => t.el.remove()); b.remove(); }); } }; },
    /* novembre · la main d'un titan balaie la piste juste derrière le dernier */
    titans(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .48 || !x.anime) return; fait = true; O.son("titans"); const n = O.dernier(c), p0 = O.voiture(n); if (!p0) return;
        const g = O.el('<g><ellipse cx="6" cy="10" rx="40" ry="34" fill="#000" opacity=".25"/>' + [[-24, -12, -28], [-9, -22, -8], [7, -24, 6], [22, -18, 22]].map(([u, v, a]) => '<rect x="-7" y="-40" width="14" height="44" rx="7" fill="#E0A27A" stroke="#4A2414" stroke-width="3" transform="translate(' + u + " " + v + ") rotate(" + a + ')"/>').join("") + '<rect x="-7" y="-30" width="14" height="36" rx="7" fill="#E0A27A" stroke="#4A2414" stroke-width="3" transform="translate(-30 14) rotate(-75)"/><ellipse cx="0" cy="4" rx="30" ry="26" fill="#E0A27A" stroke="#4A2414" stroke-width="3"/><path d="M-14 0C-6 6 6 6 14 0M-10 12C-2 16 8 16 14 10" stroke="#B5704A" stroke-width="2" fill="none"/></g>');
        const b = O.bulle(540, 60, "Un titan ! " + n + " l’a échappé belle !", 24);
        O.anim(1800, q => { const k = Math.sin(q * Math.PI), p = O.voiture(n) || p0; g.setAttribute("transform", "translate(" + O.f(p[0] - 150 + q * 120) + " " + O.f(p[1] + 50 - k * 50) + ") rotate(" + O.f(-30 + q * 60) + ") scale(2.6)"); g.setAttribute("opacity", O.f(Math.min(1, k * 2.5))); }, () => { g.remove(); setTimeout(() => b.remove(), 500); }); } }; },
    /* décembre 2027 · Poséidon foudroie la mer juste devant le leader */
    odyssee(x) { const O = outilsEv(x); let fait = false;
      return { raz() { fait = false; }, maj(e, c, en) { if (!en || fait || e < .6 || !x.anime) return; fait = true; O.son("odyssee"); const n = O.premier(c), p = O.voiture(n); if (!p) return;
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
