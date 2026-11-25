/* Versus · voiture 3D (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   VOITURE 3D (sans bibliothèque) : petit moteur maison sur <canvas>
   Modèle « low poly » construit en code (monocoque, pontons, ailerons, roues, halo, casque),
   ombrage plat avec reflet pour les livrées métal, rotation automatique et au doigt,
   démarrage au klaxon. Retombe sur le dessin 2D si le canvas n'est pas disponible.
   ============================================================ */
const V3D = { inst: null };
/* v20.48 (Théo) · UNE SEULE VOITURE : le showroom de l'Écurie montre la F1 3D de la course (piste.js, voiture()), plus l'ancien modèle dessiné à part.
   Même livrée, finition, casque et numéro que sur la piste ; sans WebGL, le dessin 2D du showroom reste affiché. */
/** ce que la voiture du pilote porte (showroom et course) */
function voitureEcurie(nom, e) {
  return { nom, couleur: couleurReelle(couleur(nom)), casque: couleurReelle(couleurCasque(nom, e)), casqueModele: e.casque, livree: e.livree, finition: e.finition, trainee: e.trainee, numero: e.numero };
}
/** Monte la voiture 3D dans un conteneur (remplace le dessin 2D) ; l'angle de vue est gardé d'un rendu à l'autre */
function monter3D(box, nom, e, garage) {
  if (!box || !window.Piste || !Piste.supporte() || !Piste.vitrine) return null;
  if (!garage && V3D.inst) { V3D.yaw = V3D.inst.yaw(); V3D.inst.stop(); }
  const inst = Piste.vitrine(box, voitureEcurie(nom, e), { yaw: garage ? 1.0 : V3D.yaw !== undefined ? V3D.yaw : 1.0, ratio: .56, label: "Voiture de " + nom + " en 3D : fais-la tourner du doigt" });
  if (!garage) V3D.inst = inst;
  return inst;
}
/* v20.48 · en course, chaque voiture porte l'écurie de son pilote (piste.js lit Piste.ecurie).
   Rien avant que la saison soit visible (le tour de chauffe garde les voitures d'avant), ni pour qui n'a encore rien enregistré dans son écurie. */
if (window.Piste) Piste.ecurie = nom => {
  if (typeof D === "undefined" || !D || !D.personnes || !saisonVisible() || !ecurieOuverte() || !D.personnes.some(p => p.nom === nom)) return null;   // v20.61 : dès l'ouverture de l'écurie (1/12)
  const brut = ((D.ecurie || {})[nom] || {}).equip; if (!brut || !Object.keys(brut).length) return null;
  const e = equipDe(nom), r = voitureEcurie(nom, e);
  r.casqueSvg = casqueForme("pc" + (++NSVG), e.casque, couleur(nom), e.finition);
  return r;
};

/* Trophées v2 · les pierres allumées du Gant de l'infini se voient sur la voiture en course (2D : petites gemmes sous la pastille ; 3D : serties sur les pontons).
   Rien pendant le tour de chauffe ni avant janvier (basesSeules), rien pour qui n'en a allumé aucune. */
if (window.Piste) Piste.pierres = nom => {
  if (typeof D === "undefined" || !D || !D.personnes || basesSeules() || !saisonJouee() || !D.personnes.some(p => p.nom === nom)) return null;
  const y = anneesSaison().slice(-1)[0], g = y ? etatGant(y)[nom] : null;
  return g && g.n ? g.p.map(Boolean) : null;
};

/* ---------- Vue Podium ---------- */
function rendreTrophees() {
  const v = $("#v-trophees");
  clearInterval(MINUTEUR_TEASER);
  // admin : la première fois, le Podium s'ouvre sur « tout afficher »
  // (l'ancienne ouverture automatique sur « tout afficher » est supprimée : l'admin choisit dans Réglages › Mode admin)
  const vis = saisonVisible();
  if (typeof TRESOR_APERCU !== "undefined" && TRESOR_APERCU && (!vis || ongletPodium() !== "gp")) quitterApercuTresor(false);   // v17.35 : on quitte la page Course → fin de l'aperçu du trésor
  v.innerHTML = (D && adminActif() && apercuAutorise() && !window.APERCUS_FINIS ? barreAdmin() : "") + (vis ? blocSaison() : teaser());   // v17.5 : plus de bandeau « Premier millionnaire » dans le teaser (les badges attendent janvier)
  brancherBarreAdmin(v);
  const im = $("#info-million-t"); if (im) im.addEventListener("click", () => toast(texteMillion()));
  if (vis) brancherSaison(v);
  else {
    animerCompte();
    const tr = v.querySelector("#teaser-regles"); if (tr) tr.addEventListener("click", () => ouvrirRegles());
  }
  if (saisonOuverte() && !stock.get("versus.saison1")) { stock.set("versus.saison1", "1"); toast("🏁 Saison 1 : c'est parti !"); confettis("damier"); }
  majRappels();
  // v20.47 · 🎫 tickets d'or (badges, plaque de l'Écurie) : chargés une fois à partir d'octobre 2027, puis on redessine
  if (typeof chargerTickets === "function" && !TICKETS && Date.now() >= TICKET_MOIS.debut.getTime()) chargerTickets().then(() => { if (TICKETS && vueActive() === "trophees" && ongletPodium() !== "gp") rendreTrophees(); }).catch(() => {});
  if (!saisonOuverte() && chauffeOuverte() && !janvierAnnonce() && !apercuSaison() && !stock.get("versus.chauffe1")) { stock.set("versus.chauffe1", "1"); toast("🔥 Tour de chauffe : essaie tout, rien ne compte !"); confettis("damier"); }
}

/* ---------- Duel ---------- */
function duel(env, a, b, deb, fin) {
  const pa = D.personnes.find(p => p.nom === a), pb = D.personnes.find(p => p.nom === b);
  if (!pa || !pb) return null;
  const sb = {}; serieJeu(pb, env).forEach(z => { if (typeof z.r === "number") sb[z.k] = z.r; });   // v20.25 : sans le mois d'ouverture
  const mois = serieJeu(pa, env).filter(z => typeof z.r === "number" && sb[z.k] !== undefined && (!deb || z.k > deb) && (!fin || z.k <= fin)).map(z => ({ k: z.k, ra: z.r, rb: sb[z.k] }));
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
  if (typeof ereEnCours === "function" && ereEnCours()) { ereApres(() => feterChampion(v), "champion"); return; }   // v16.93 : après la scène du premier million
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
  if (window.SONS) { SONS.klaxon(style); SONS.vibrer([40, 50, 90]); }   // V16.43 : le klaxon sonne pour de vrai
  if (!ANIM) return;
  const c = document.createElement("canvas"), x = c.getContext("2d"), dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99";
  document.body.appendChild(c); x.scale(dpr, dpr);
  const pal = ["--p0", "--p1", "--p2", "--p3", "--gold"].map(css);
  const emo = { parade: ["🏁", "🎺", "🎉", "🏆", "🥁"], billets: ["💶", "💸", "💶", "💰"], lingots: ["🪙", "💰", "🥇", "🪙"], fanfare: ["📯", "🎺", "✨", "🏆", "🎺"], cibles: ["🎯", "🏹", "🎯", "✨"], trophees: ["🏆", "🥇", "🏆", "🎖️"], etoiles: ["⭐", "✨", "🌟", "💫"], fusees: ["🚀", "🌙", "⭐", "🪐"], pouet: ["🎵", "💨", "🎶", "🎵"], trompette: ["🎺", "🎵", "🎶", "✨"], sifflet: ["🎵", "💨", "✨", "🎶"] }[style] || (Array.isArray(style) ? style : null);   // V15.4 : une liste d'emoji = pluie de ces emoji
  const hasard = l => l[Math.floor(Math.random() * l.length)];
  let ps;
  if (emo) ps = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 3, r: (Math.random() - .5) * .8, vr: (Math.random() - .5) * .06, e: hasard(emo), g: .04 }));
  else if (style === "ouvriers") ps = Array.from({ length: 54 }, (_, i) => ({ x: Math.random() * W, y: -30 - Math.random() * H * .7, vx: (Math.random() - .5) * 1.4, vy: 2.2 + Math.random() * 2.8, r: Math.random() * 6.28, vr: (Math.random() - .5) * .12, bonbon: i % 3 ? hasard(["#E8475F", "#F2B705", "#3DB4E8", "#7ED957", "#B46CF0", "#FF8FB8"]) : null, choco: !(i % 3), g: .03 }));   // v20.46 · Fanfare des petits ouvriers
  else if (style === "meteores") ps = Array.from({ length: 26 }, (_, i) => { const v = 7 + Math.random() * 5; return { x: Math.random() * W * 1.2, y: -40 - Math.random() * H * .5, vx: -v * .55, vy: v, meteore: true, w: 2 + Math.random() * 1.8, c: Math.random() < .35 ? css("--gold") : "#FFFFFF", g: 0, retard: Math.floor(i * 3.2) }; });   // lot 55 : traînées lumineuses (fête « Météores » de Moi)
  else if (style === "feu") ps = [[.25, .32], [.5, .2], [.75, .3], [.4, .45], [.62, .42]].flatMap(([fx, fy], j) => { const col = hasard(pal); return Array.from({ length: 34 }, (_, i) => { const a = i / 34 * 6.283, v = 3 + Math.random() * 2.5; return { x: W * fx, y: H * fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rond: true, w: 3.2, c: Math.random() < .3 ? css("--gold") : col, g: .06, retard: j * 9 }; }); });
  else ps = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .3, vx: (Math.random() - .5) * 10, vy: -Math.random() * 10 - 4,
    r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, w: style === "damier" ? 8 : 6 + Math.random() * 5, h: style === "damier" ? 8 : 3 + Math.random() * 4, c: style === "damier" ? (Math.random() < .5 ? "#111" : "#f4f4f4") : hasard(pal), g: .3 }));
  const t0 = performance.now(), duree = emo || style === "ouvriers" ? 3400 : 2600;
  let f = 0;
  const pas = t => {
    const e = t - t0; x.clearRect(0, 0, W, H); f++;
    ps.forEach(p => {
      if (p.retard && f < p.retard) return;
      p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r = (p.r || 0) + (p.vr || 0);
      x.save(); x.translate(p.x, p.y); x.rotate(p.r || 0); x.globalAlpha = Math.max(0, 1 - e / duree);
      if (p.meteore) { x.rotate(Math.atan2(p.vy, p.vx)); const q = x.createLinearGradient(-90, 0, 0, 0); q.addColorStop(0, "rgba(255,255,255,0)"); q.addColorStop(1, p.c); x.strokeStyle = q; x.lineWidth = p.w; x.lineCap = "round"; x.beginPath(); x.moveTo(-90, 0); x.lineTo(0, 0); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(0, 0, p.w * 1.3, 0, 6.283); x.fill(); }
      else if (p.bonbon) { x.fillStyle = p.bonbon; x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 1;
        [-1, 1].forEach(s => { x.beginPath(); x.moveTo(s * 7, 0); x.lineTo(s * 13, -5); x.lineTo(s * 12, 0); x.lineTo(s * 13, 5); x.closePath(); x.fill(); x.stroke(); });
        x.beginPath(); x.ellipse(0, 0, 8, 6, 0, 0, 6.2832); x.fill(); x.stroke(); x.strokeStyle = "rgba(255,255,255,.75)"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-4, -4); x.lineTo(1, 4); x.moveTo(1, -5); x.lineTo(5, 3); x.stroke(); }
      else if (p.choco) { x.fillStyle = "#5A2D14"; x.fillRect(-9, -7, 18, 14); x.fillStyle = "#7A3F1D"; [[-8, -6], [0.5, -6], [-8, 0.5], [0.5, 0.5]].forEach(([a, b]) => x.fillRect(a, b, 7.5, 5.5)); x.fillStyle = "rgba(243,201,155,.5)"; x.fillRect(-8, -6, 7.5, 1.4); }
      else if (p.e) { x.font = "24px serif"; x.textAlign = "center"; x.fillText(p.e, 0, 0); }
      else if (p.rond) { x.fillStyle = p.c; x.beginPath(); x.arc(0, 0, p.w, 0, 6.283); x.fill(); }
      else { x.fillStyle = p.c; if (style === "damier") { x.strokeStyle = "rgba(0,0,0,.25)"; x.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); } x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      x.restore();
    });
    if (e < duree) requestAnimationFrame(pas); else c.remove();
  };
  requestAnimationFrame(pas);
}


