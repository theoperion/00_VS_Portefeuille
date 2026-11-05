/* Versus · voiture 3D (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   VOITURE 3D (sans bibliothèque) : petit moteur maison sur <canvas>
   Modèle « low poly » construit en code (monocoque, pontons, ailerons, roues, halo, casque),
   ombrage plat avec reflet pour les livrées métal, rotation automatique et au doigt,
   démarrage au klaxon. Retombe sur le dessin 2D si le canvas n'est pas disponible.
   ============================================================ */
const V3D = { inst: null };
function rgb3(h) { const x = String(h).replace("#", ""); const n = parseInt(x.length === 3 ? x.split("").map(c => c + c).join("") : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function couleurCss(c) { if (!/^var\(/.test(c)) return c; const v = getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim(); return v || "#4C9AFF"; }
/** Matière de la livrée : couleur de base, métal (0..1), émissif (néon) */
function matiereLivree(lv, c) {
  return ({ chrome: { c: "#DCE3EA", m: 1 }, or: { c: "#E9B949", m: .95 }, oranime: { c: "#F2C452", m: 1, anim: "or" }, platine: { c: "#EEF3FA", m: .85 },
    rubis: { c: "#B0002E", m: .7 }, orrose: { c: "#E3A792", m: .9 }, neon: { c: "#0D1017", m: .2, neon: c }, arcenciel: { c: c, m: .5, anim: "arc" },
    galaxie: { c: "#2A1458", m: .5, etoiles: true } })[lv] || { c: c, m: .45 };
}
function modeleF1(nom, e) {
  const c = couleurCss(couleur(nom)), lv = matiereLivree(e.livree, c);
  const casq = { uni: c, carbone: "#2d333d", eclair: c, damier: "#f0f0ec", tortue: "#2F8A45", chrome: "#d4dae1", etoile: "#F7CF55", holo: "#B98CFF", couronne: "#F7CF55", foudre: "#141c33", phenix: "#FF8A1F", glace: "#BFEFFC", galaxie: "#5B2A9E", empereur: "#6B2FB3" }[e.casque] || c;
  const F = [], CARB = { c: "#1C2027", m: .35 }, NOIR = { c: "#101216", m: .1 }, JANTE = { c: "#AEB6C0", m: 1 }, PEINT = lv;
  const quad = (a, b, cc, d, mat, tag) => F.push({ v: [a, b, cc, d], mat, tag });
  const tri = (a, b, cc, mat, tag) => F.push({ v: [a, b, cc], mat, tag });
  /* hexaèdre : 8 sommets [x,y,z], faces orientées vers l'extérieur */
  const hexa = (P, mat, tag) => { const [a, b, cc, d, e2, f, g, h] = P; quad(a, b, cc, d, mat, tag); quad(h, g, f, e2, mat, tag); quad(a, e2, f, b, mat, tag); quad(b, f, g, cc, mat, tag); quad(cc, g, h, d, mat, tag); quad(d, h, e2, a, mat, tag); };
  /* boîte effilée : section arrière (x0) et avant (x1), chacune [ybas, yhaut, demi-largeur] */
  const fuseau = (x0, s0, x1, s1, mat, tag, dz = 0) => hexa([[x0, s0[0], -s0[2] + dz], [x1, s1[0], -s1[2] + dz], [x1, s1[0], s1[2] + dz], [x0, s0[0], s0[2] + dz], [x0, s0[1], -s0[2] + dz], [x1, s1[1], -s1[2] + dz], [x1, s1[1], s1[2] + dz], [x0, s0[1], s0[2] + dz]], mat, tag);
  const boite = (cx, cy, cz, sx, sy, sz, mat, tag) => fuseau(cx - sx / 2, [cy - sy / 2, cy + sy / 2, sz / 2], cx + sx / 2, [cy - sy / 2, cy + sy / 2, sz / 2], mat, tag, cz);
  /* roue : cylindre d'axe z, avec rayons sur la face extérieure */
  const roue = (cx, cy, cz, r, w, n) => {
    const s = cz > 0 ? 1 : -1, z0 = cz - w / 2 * s, z1 = cz + w / 2 * s, P = a => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, p0 = P(a0), p1 = P(a1);
      const q = [[p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1]]; F.push({ v: s > 0 ? q : q.reverse(), mat: NOIR, tag: "pneu" }); }
    // flancs : extérieur tourné vers ±z selon le côté, intérieur à l'opposé
    const disque = (z, mat, rr, tag, vers) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]); } F.push({ v: vers > 0 ? pts : pts.reverse(), mat, tag }); };
    disque(z1, NOIR, r, "pneu", s); disque(z1 + .002 * s, JANTE, r * .62, "jante", s); disque(z0, NOIR, r, "pneu", -s);
    F.push({ v: [], mat: { c: "#F7CF55", m: 0 }, tag: "lisere", cercle: [cx, cy, z1 + .004 * s, r * .8], s });
    for (let k = 0; k < 5; k++) F.push({ v: [], mat: { c: "#3a4049", m: .6 }, tag: "rayon", rayon: [cx, cy, z1 + .006 * s, r * .58, k / 5 * 6.2832], s });
  };
  // plancher et fond plat
  boite(0, .2, 0, 4.2, .06, 1.25, CARB);
  // nez et monocoque
  fuseau(.55, [.32, .62, .34], 2.45, [.26, .38, .1], PEINT, "nez");
  fuseau(-.55, [.28, .7, .4], .55, [.3, .66, .36], PEINT, "coque");
  // capot moteur jusqu'à l'aileron arrière, avec aileron de requin
  fuseau(-2.1, [.3, .58, .14], -.55, [.3, .98, .34], PEINT, "capot");
  fuseau(-1.9, [.95, 1.12, .02], -.7, [.95, 1.0, .02], PEINT, "aileron");
  // prise d'air au-dessus du pilote
  fuseau(-.62, [.95, 1.08, .12], -.42, [.95, 1.1, .14], CARB);
  // pontons
  [-1, 1].forEach(s => { fuseau(-1.25, [.26, .5, .2], .45, [.28, .66, .26], PEINT, "ponton", s * .52); boite(.47, .5, s * .52, .04, .28, .4, NOIR); });
  // aileron avant (deux plans) et dérives
  boite(2.42, .2, 0, .5, .035, 1.9, PEINT, "aileronAv"); boite(2.32, .28, 0, .34, .03, 1.8, CARB);
  [-1, 1].forEach(s => boite(2.4, .3, s * .96, .55, .22, .03, CARB));
  // aileron arrière, mâts et dérives
  boite(-2.18, 1.02, 0, .46, .05, 1.5, PEINT, "aileronAr"); boite(-2.12, 1.15, 0, .3, .04, 1.48, CARB);
  [-1, 1].forEach(s => boite(-2.15, .86, s * .76, .56, .5, .03, CARB));
  boite(-2.0, .7, 0, .08, .4, .06, CARB);
  // suspensions
  [[1.45, .34], [-1.45, .36]].forEach(([x]) => [-1, 1].forEach(s => { boite(x, .44, s * .5, .06, .03, .72, CARB); boite(x, .3, s * .5, .06, .03, .72, CARB); }));
  // roues
  roue(1.45, .34, .86, .34, .34, 18); roue(1.45, .34, -.86, .34, .34, 18);
  roue(-1.45, .37, .9, .37, .42, 18); roue(-1.45, .37, -.9, .37, .42, 18);
  // casque et visière, halo
  F.push({ v: [], mat: { c: casq, m: .5 }, tag: "casque", sphere: [.2, .82, 0, .19] });
  F.push({ v: [], mat: { c: "#0b0d11", m: .9 }, tag: "visiere", sphere: [.33, .84, 0, .13] });
  F.push({ v: [], mat: { c: "#2b3038", m: .8 }, tag: "halo", arc: [.15, .78, 0, .42] });
  return { F, lv, c };
}
/** Projette et dessine le modèle : yaw autour de y, caméra légèrement plongeante */
function dessiner3D(ctx, W, H, mod, yaw, t, opts) {
  const pitch = .36, cp = Math.cos(pitch), sp = Math.sin(pitch), cy0 = Math.cos(yaw), sy0 = Math.sin(yaw);
  const dist = 7.6, f = Math.min(W, H * 1.75) * .9, ox = W / 2, oy = H * .56, roll = opts.roll || 0, depl = opts.depl || 0;
  const tr = p => { let x = p[0] + depl, y = p[1], z = p[2];
    const x1 = x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; return [x1, y2, z2]; };
  const pr = q => { const k = f / (dist - q[2]); return [ox + q[0] * k, oy - (q[1] - .45) * k, k]; };
  const L = norm3([.45, .85, .55]), V = [0, 0, 1];
  // sol : disque dégradé et ombre douce
  const g0 = pr(tr([0, 0, 0]));
  ctx.save(); ctx.translate(g0[0], g0[1]); ctx.scale(1, .26);
  let gr = ctx.createRadialGradient(0, 0, 0, 0, 0, f * .55); gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, f * .55, 0, 6.2832); ctx.fill();
  gr = ctx.createRadialGradient(0, 0, 0, 0, 0, f * .3); gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, f * .32, f * .26, 0, 0, 6.2832); ctx.fill(); ctx.restore();
  // faces → polygones projetés, triés de loin à près
  const polys = [];
  mod.F.forEach(fc => {
    if (fc.sphere) { const [x, y, z, r] = fc.sphere, q = tr([x, y, z]), p = pr(q); polys.push({ z: q[2], sphere: true, p, r: r * p[2], mat: fc.mat, tag: fc.tag }); return; }
    if (fc.arc) { const [x, y, z, r] = fc.arc, pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; pts.push(pr(tr([x + Math.cos(a) * r * .9, y + Math.sin(a) * r * .55, z]))); } polys.push({ z: tr([x, y + .2, z])[2] + .01, arc: pts, mat: fc.mat }); return; }
    if (fc.cercle || fc.rayon) {
      const [cx, cy, cz, r, a0] = fc.cercle || fc.rayon, rot = -(opts.roues || 0), pts = [];
      if (fc.cercle) for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832; pts.push(tr([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz])); }
      else { const a = a0 + rot; pts.push(tr([cx + Math.cos(a - .14) * r * .2, cy + Math.sin(a - .14) * r * .2, cz]), tr([cx + Math.cos(a - .1) * r, cy + Math.sin(a - .1) * r, cz]), tr([cx + Math.cos(a + .1) * r, cy + Math.sin(a + .1) * r, cz]), tr([cx + Math.cos(a + .14) * r * .2, cy + Math.sin(a + .14) * r * .2, cz])); }
      if (fc.s < 0) pts.reverse();
      const n = normale(pts); if (n[2] <= 0) return;
      polys.push({ z: pts.reduce((a, q) => a + q[2], 0) / pts.length + .003, pts: pts.map(pr), mat: fc.mat, n, ligne: !!fc.cercle }); return;
    }
    const q = fc.v.map(tr), n = normale(q); if (n[2] <= 0.0005) return;
    polys.push({ z: q.reduce((a, v) => a + v[2], 0) / q.length, pts: q.map(pr), mat: fc.mat, n, tag: fc.tag, mx: fc.v.reduce((a, v) => a + v[0], 0) / fc.v.length });
  });
  polys.sort((a, b) => a.z - b.z);
  polys.forEach(P => {
    const m = P.mat;
    if (P.sphere) {
      const g = ctx.createRadialGradient(P.p[0] - P.r * .35, P.p[1] - P.r * .4, P.r * .1, P.p[0], P.p[1], P.r);
      const b = rgb3(m.c); g.addColorStop(0, "rgb(" + b.map(v => Math.min(255, v + 90)).join(",") + ")"); g.addColorStop(.55, m.c); g.addColorStop(1, "rgb(" + b.map(v => v * .35 | 0).join(",") + ")");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.p[0], P.p[1], P.r, 0, 6.2832); ctx.fill(); return;
    }
    if (P.arc) { ctx.strokeStyle = "#5b636e"; ctx.lineWidth = Math.max(2, P.arc[0][2] * .07); ctx.lineCap = "round"; ctx.beginPath(); P.arc.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); return; }
    let base = rgb3(m.c);
    if (m.anim === "arc") { const h = ((P.mx || 0) * 40 + t * 60) % 360; base = rgb3(hsl2hex(h, 85, 58)); }
    if (m.anim === "or") { const k = .85 + .15 * Math.sin(t * 2 + (P.mx || 0) * 1.5); base = base.map(v => Math.min(255, v * k + 20 * (1 - k))); }
    const d = Math.max(0, dot3(P.n, L)), h = norm3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), s = Math.pow(Math.max(0, dot3(P.n, h)), 18 + 40 * m.m);
    const amb = .32 + .12 * P.n[1], kd = (1 - m.m * .55) * d, ks = (m.m > .6 ? 1.1 : .55) * s, env = m.m * (.25 + .35 * Math.max(0, P.n[1]));
    const col = base.map(v => Math.min(255, Math.round(v * (amb + kd + env) + 255 * ks)));
    ctx.fillStyle = "rgb(" + col.join(",") + ")";
    ctx.beginPath(); P.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (P.ligne) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4; ctx.stroke(); return; }
    ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .7; ctx.stroke();
    if (m.etoiles) { ctx.fillStyle = "rgba(255,255,255,.75)"; const c0 = P.pts[0]; for (let i = 0; i < 2; i++) { const p = P.pts[(i + 1) % P.pts.length]; ctx.fillRect((c0[0] + p[0]) / 2, (c0[1] + p[1]) / 2, 1.2, 1.2); } }
    if (m.neon && (P.tag === "ponton" || P.tag === "nez" || P.tag === "aileronAv" || P.tag === "aileronAr" || P.tag === "capot")) {
      ctx.save(); ctx.shadowColor = m.neon; ctx.shadowBlur = 8; ctx.strokeStyle = m.neon; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
    }
  });
  // numéro sur le capot, côté visible
  const zt = tr([0, 0, 1])[2] - tr([0, 0, 0])[2], side = zt > 0 ? 1 : -1, pn = pr(tr([-.35, .5, side * .74])), nv = [0, 0, Math.abs(zt)];
  if (nv[2] > .15) { ctx.save(); ctx.font = "italic 800 " + Math.round(pn[2] * .26) + "px " + getComputedStyle(document.body).getPropertyValue("--f-display"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = ["chrome", "or", "oranime", "platine", "orrose"].includes(opts.livree) ? "#11151B" : "#fff"; ctx.globalAlpha = Math.min(1, nv[2] * 1.6); ctx.fillText(String(opts.numero || ""), pn[0], pn[1]); ctx.restore(); }
}
function normale(q) { const a = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], b = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]]; return norm3([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]); }
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function hsl2hex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join(""); }
/** Monte la voiture 3D dans un conteneur (remplace le dessin 2D) ; une seule animation à la fois */
function monter3D(box, nom, e) {
  if (!box) return;
  const cv = document.createElement("canvas"); if (!cv.getContext) return;
  const ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(260, box.clientWidth || 340), H = Math.round(W * .58);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = "100%"; cv.style.height = H + "px"; cv.className = "v3d"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Voiture de " + nom + " en 3D : fais-la tourner du doigt");
  box.innerHTML = ""; box.appendChild(cv); ctx.scale(dpr, dpr);
  if (V3D.inst) V3D.inst.stop();
  const st = { mod: modeleF1(nom, e), yaw: V3D.yaw !== undefined ? V3D.yaw : 2.4, vit: .35, drag: null, pause: 0, boost: 0, roues: 0, stop: false, e };
  const frame = t => {
    if (st.stop || !cv.isConnected) { st.stop = true; return; }
    const dt = Math.min(.05, (t - (st.t || t)) / 1000); st.t = t;
    if (!st.drag && t > st.pause && ANIM) st.yaw += st.vit * dt;
    let depl = 0; if (st.boost) { const k = (t - st.boost) / 1400; if (k >= 1) st.boost = 0; else { depl = Math.sin(k * Math.PI) * (k < .15 ? -.4 * k / .15 : 1.4); st.roues += dt * 30; } }
    st.roues += dt * (ANIM ? 1.2 : 0);
    V3D.yaw = st.yaw;
    ctx.clearRect(0, 0, W, H);
    dessiner3D(ctx, W, H, st.mod, st.yaw, t / 1000, { roues: st.roues, depl, numero: e.numero, livree: e.livree });
    requestAnimationFrame(frame);
  };
  cv.addEventListener("pointerdown", ev => { st.drag = { x: ev.clientX, yaw: st.yaw }; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener("pointermove", ev => { if (st.drag) st.yaw = st.drag.yaw + (ev.clientX - st.drag.x) * .012; });
  const fin = () => { st.drag = null; st.pause = performance.now() + 2500; };
  cv.addEventListener("pointerup", fin); cv.addEventListener("pointercancel", fin);
  cv.style.touchAction = "pan-y";
  V3D.inst = { stop: () => { st.stop = true; }, boost: () => { st.boost = performance.now(); } };
  requestAnimationFrame(frame);
  if (!ANIM) { ctx.clearRect(0, 0, W, H); dessiner3D(ctx, W, H, st.mod, st.yaw, 0, { numero: e.numero, livree: e.livree }); }
}

/* ---------- Vue Podium ---------- */
function rendreTrophees() {
  const v = $("#v-trophees");
  clearInterval(MINUTEUR_TEASER);
  // admin : la première fois, le Podium s'ouvre sur « tout afficher »
  // (l'ancienne ouverture automatique sur « tout afficher » est supprimée : l'admin choisit dans Réglages › Mode admin)
  const vis = saisonVisible();
  v.innerHTML = (D && adminActif() ? barreAdmin() : "") + (vis ? blocSaison() : bandeauMillion() + teaser());
  brancherBarreAdmin(v);
  const im = $("#info-million-t"); if (im) im.addEventListener("click", () => toast(texteMillion()));
  if (vis) brancherSaison(v);
  else {
    animerCompte();
    const tr = v.querySelector("#teaser-regles"); if (tr) tr.addEventListener("click", () => ouvrirRegles());
  }
  if (saisonOuverte() && !stock.get("versus.saison1")) { stock.set("versus.saison1", "1"); toast("🏁 Saison 1 : c'est parti !"); confettis("damier"); }
  majRappels();
  if (!saisonOuverte() && chauffeOuverte() && !apercuSaison() && !stock.get("versus.chauffe1")) { stock.set("versus.chauffe1", "1"); toast("🔥 Tour de chauffe : essaie tout, rien ne compte !"); confettis("damier"); }
}

/* ---------- Duel ---------- */
function duel(env, a, b, deb, fin) {
  const pa = D.personnes.find(p => p.nom === a), pb = D.personnes.find(p => p.nom === b);
  if (!pa || !pb) return null;
  const sb = {}; serie(pb, env).forEach(z => { if (typeof z.r === "number") sb[z.k] = z.r; });
  const mois = serie(pa, env).filter(z => typeof z.r === "number" && sb[z.k] !== undefined && (!deb || z.k > deb) && (!fin || z.k <= fin)).map(z => ({ k: z.k, ra: z.r, rb: sb[z.k] }));
  const d = { a, b, n: mois.length, wa: 0, wb: 0, nuls: 0, va: 1, vb: 1, gros: null, forme: [], serie: null };
  mois.forEach(m => {
    const e = m.ra - m.rb, g = Math.abs(e) < 1e-9 ? null : e > 0 ? a : b;
    if (g === a) d.wa++; else if (g === b) d.wb++; else d.nuls++;
    d.va *= 1 + m.ra; d.vb *= 1 + m.rb;
    if (g && (!d.gros || Math.abs(e) > Math.abs(d.gros.e))) d.gros = { k: m.k, e, g };
    d.forme.push(g);
  });
  for (let i = d.forme.length - 1, n = 0; i >= 0; i--) { if (d.forme[i] && d.forme[i] === d.forme[d.forme.length - 1]) n++; else break; d.serie = { nom: d.forme[d.forme.length - 1], n }; }
  d.va -= 1; d.vb -= 1;
  return d;
}
function blocDuel(env, deb, fin) {
  const noms = D.personnes.map(p => p.nom);
  if (noms.length < 2) return "";
  let a = noms.includes(ETAT.d1) ? ETAT.d1 : (noms.includes(ETAT.moi) ? ETAT.moi : noms[0]);
  let b = noms.includes(ETAT.d2) && ETAT.d2 !== a ? ETAT.d2 : noms.find(n => n !== a);
  const sel = (id, val, lib) => '<label class="sel"><span>' + lib + '</span><select id="f-' + id + '">' + noms.map(n => '<option value="' + esc(n) + '"' + (n === val ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select></label>";
  const d = duel(env, a, b, deb, fin);
  let corps;
  if (!d || !d.n) corps = '<p class="info">Pas encore de mois en commun entre ' + esc(a) + " et " + esc(b) + ".</p>";
  else {
    const ca = couleur(a), cb = couleur(b), tot = d.wa + d.wb + d.nuls;
    const meneur = d.wa === d.wb ? "Égalité parfaite" : (d.wa > d.wb ? a : b) + " mène";
    corps = '<div class="score"><b style="color:' + ca + '">' + esc(a) + '</b><span class="sc">' + d.wa + " – " + d.wb + "<small>" + esc(meneur) + (d.nuls ? " · " + d.nuls + " nul" + (d.nuls > 1 ? "s" : "") : "") + '</small></span><b style="color:' + cb + '">' + esc(b) + "</b></div>" +
      '<div class="part" aria-hidden="true"><i style="width:' + (d.wa / tot * 100).toFixed(1) + "%;background:" + ca + '"></i><i style="flex:1"></i><i style="width:' + (d.wb / tot * 100).toFixed(1) + "%;background:" + cb + '"></i></div>' +
      '<div class="mini">' +
      "<div><span>Cumul " + esc(a) + '</span><b class="' + sens(d.va) + '">' + pct(d.va) + "</b></div>" +
      "<div><span>Cumul " + esc(b) + '</span><b class="' + sens(d.vb) + '">' + pct(d.vb) + "</b></div>" +
      "<div><span>Écart</span><b>" + pts(d.va - d.vb) + "</b></div>" +
      (d.gros ? '<div style="grid-column:1/-1"><span>Plus gros écart sur un mois</span><b>' + esc(moisLong(d.gros.k)) + " : " + esc(d.gros.g) + " devant de " + pts(Math.abs(d.gros.e)).replace(/^\+/, "") + "</b></div>" : "") +
      "</div>" +
      '<div class="forme">Derniers mois : ' + d.forme.slice(-6).map(g => g ? '<i style="background:' + couleur(g) + '" title="' + esc(g) + '">' + esc(g.charAt(0)) + "</i>" : '<i style="background:var(--idx)">=</i>').join("") +
      (d.serie && d.serie.n >= 2 ? " · " + esc(d.serie.nom) + " gagne depuis " + d.serie.n + " mois" : "") + "</div>";
  }
  return '<div><h2 class="sec">Duel <small>face à face, mois par mois</small></h2><div class="duel"><div class="filtres" style="grid-template-columns:1fr 1fr">' + sel("d1", a, "Joueur 1") + sel("d2", b, "Joueur 2") + "</div>" + corps + "</div></div>";
}

/* ---------- Confettis : une seule fois quand tu es champion du mois ---------- */
function feterChampion(v) {
  if (!v || !v.complet || v.env !== 0 || !v.champion.seul || v.champion.nom !== ETAT.moi) return;
  const cle = "versus.confettis", deja = stock.get(cle);
  if (deja === String(v.k)) return;
  stock.set(cle, String(v.k));
  if (!deja) return;                       // première ouverture : on ne fête pas un mois ancien
  toast("Champion de " + moisLong(v.k) + " 🏆");
  confettis(saisonVisible() ? equipDe(ETAT.moi).klaxon : "confettis");
}
/** Confettis et klaxons de l'écurie : confettis, damier, feu (d'artifice), parade, billets */
function confettis(style) {
  if (!ANIM) return;
  const c = document.createElement("canvas"), x = c.getContext("2d"), dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99";
  document.body.appendChild(c); x.scale(dpr, dpr);
  const pal = ["--p0", "--p1", "--p2", "--p3", "--gold"].map(css);
  const emo = { parade: ["🏁", "🎺", "🎉", "🏆", "🥁"], billets: ["💶", "💸", "💶", "💰"], lingots: ["🪙", "💰", "🥇", "🪙"], fanfare: ["👑", "🎺", "✨", "🏆", "🎺"], cibles: ["🎯", "🏹", "🎯", "✨"], trophees: ["🏆", "🥇", "🏆", "🎖️"], etoiles: ["⭐", "✨", "🌟", "💫"], fusees: ["🚀", "🌙", "⭐", "🪐"] }[style];
  const hasard = l => l[Math.floor(Math.random() * l.length)];
  let ps;
  if (emo) ps = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 3, r: (Math.random() - .5) * .8, vr: (Math.random() - .5) * .06, e: hasard(emo), g: .04 }));
  else if (style === "feu") ps = [[.25, .32], [.5, .2], [.75, .3], [.4, .45], [.62, .42]].flatMap(([fx, fy], j) => { const col = hasard(pal); return Array.from({ length: 34 }, (_, i) => { const a = i / 34 * 6.283, v = 3 + Math.random() * 2.5; return { x: W * fx, y: H * fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rond: true, w: 3.2, c: Math.random() < .3 ? css("--gold") : col, g: .06, retard: j * 9 }; }); });
  else ps = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .3, vx: (Math.random() - .5) * 10, vy: -Math.random() * 10 - 4,
    r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, w: style === "damier" ? 8 : 6 + Math.random() * 5, h: style === "damier" ? 8 : 3 + Math.random() * 4, c: style === "damier" ? (Math.random() < .5 ? "#111" : "#f4f4f4") : hasard(pal), g: .3 }));
  const t0 = performance.now(), duree = emo ? 3400 : 2600;
  let f = 0;
  const pas = t => {
    const e = t - t0; x.clearRect(0, 0, W, H); f++;
    ps.forEach(p => {
      if (p.retard && f < p.retard) return;
      p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r = (p.r || 0) + (p.vr || 0);
      x.save(); x.translate(p.x, p.y); x.rotate(p.r || 0); x.globalAlpha = Math.max(0, 1 - e / duree);
      if (p.e) { x.font = "24px serif"; x.textAlign = "center"; x.fillText(p.e, 0, 0); }
      else if (p.rond) { x.fillStyle = p.c; x.beginPath(); x.arc(0, 0, p.w, 0, 6.283); x.fill(); }
      else { x.fillStyle = p.c; if (style === "damier") { x.strokeStyle = "rgba(0,0,0,.25)"; x.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); } x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      x.restore();
    });
    if (e < duree) requestAnimationFrame(pas); else c.remove();
  };
  requestAnimationFrame(pas);
}


