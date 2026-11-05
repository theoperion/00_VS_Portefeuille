/* Versus · Ère d'or et démarrage de l'appli (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   L'ÈRE D'OR · récompense du premier millionnaire (V12.1)
   Volontairement non décrite ailleurs : à ne pas lire si tu veux garder la surprise.
   ============================================================ */
let ERE_RAF = null;
function ereDorActive() {
  const pm = typeof D !== "undefined" && D && D.premierMillion; if (!pm || !pm.nom) return null;
  const eq = ((D.ecurie || {})[pm.nom] || {}).equip || {};
  return eq.aura === "off" ? null : pm;
}
function ereStyle() {
  if (document.getElementById("ere-style")) return;
  const st = document.createElement("style"); st.id = "ere-style";
  st.textContent = `
@property --ere-a { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes ereGlisse { to { background-position: -250% 0; } }
@keyframes ereTour { to { --ere-a: 360deg; } }
@keyframes erePouls { 0%,100% { box-shadow: 0 0 0 2px #E8B931, 0 0 10px 1px rgba(232,185,49,.45); } 50% { box-shadow: 0 0 0 2px #FFE58A, 0 0 18px 4px rgba(255,214,102,.7); } }
@keyframes ereFil { from { background-position: 0 0; } to { background-position: 400px 0; } }
@keyframes ereMonte { from { opacity: 0; transform: translateY(18px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes ereLueur { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
body.ere-or .logo b { color: transparent; background: linear-gradient(100deg, #F7E7B4 0%, #E8B931 22%, #FFF8DE 38%, #C98E1E 55%, #F7E7B4 72%, #E8B931 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; animation: ereGlisse 8s linear infinite; filter: drop-shadow(0 0 6px rgba(232,185,49,.35)); }
body.ere-or .logo i.ere-i { background: conic-gradient(from var(--ere-a), #FFF6D5, #E8B931, #9C6B12, #FFE9A0, #E8B931, #FFF6D5) !important; animation: ereTour 5s linear infinite; box-shadow: 0 0 8px rgba(232,185,49,.6); }
body.ere-or .av.av-or { animation: erePouls 3.2s ease-in-out infinite; border-radius: 50%; }
.ere-fil { position: fixed; left: 0; right: 0; top: 0; height: 2px; z-index: 9998; pointer-events: none; background: linear-gradient(90deg, transparent 0, #9C6B12 80px, #FFE58A 160px, #FFF8DE 200px, #E8B931 240px, transparent 400px); background-size: 400px 2px; animation: ereFil 3.5s linear infinite; opacity: .9; }
.ere-poussiere { position: fixed; inset: 0; z-index: 9997; pointer-events: none; }
.ere-voile { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: radial-gradient(120% 90% at 50% 40%, #2A1E06 0%, #0B0905 60%, #000 100%); color: #FFF4D2; text-align: center; padding: 24px; }
.ere-voile canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.ere-c { position: relative; max-width: 440px; }
.ere-c > * { opacity: 0; animation: ereMonte .9s cubic-bezier(.2,.8,.2,1) forwards; }
.ere-k { font: 700 12px/1 var(--f-text); letter-spacing: .35em; text-transform: uppercase; color: #E8B931; animation-delay: .3s !important; }
.ere-n { margin: 18px 0 6px; font: italic 800 clamp(40px, 13vw, 64px)/1 var(--f-display); letter-spacing: .02em; color: transparent; background: linear-gradient(100deg, #F7E7B4, #E8B931 30%, #FFF8DE 45%, #C98E1E 62%, #F7E7B4); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; animation: ereMonte .9s cubic-bezier(.2,.8,.2,1) .9s forwards, ereGlisse 6s linear 1.8s infinite !important; }
.ere-m { font: 800 clamp(30px, 10vw, 46px)/1.1 var(--f-num, var(--f-display)); color: #FFE58A; text-shadow: 0 0 24px rgba(255,214,102,.55); animation-delay: .5s !important; }
.ere-p { margin: 18px auto 0; font: 400 15px/1.55 var(--f-text); color: #E9DDBA; max-width: 340px; animation-delay: 2.6s !important; }
.ere-b { margin-top: 26px; padding: 13px 24px; border-radius: 999px; border: 1px solid #E8B931; background: linear-gradient(180deg, #F2CF63, #C58F1C); color: #1D1404; font: 800 14px/1 var(--f-text); letter-spacing: .06em; text-transform: uppercase; cursor: pointer; animation-delay: 3.2s !important; box-shadow: 0 0 24px rgba(232,185,49,.45); }
.ere-cour { font-size: 58px; line-height: 1; filter: drop-shadow(0 0 18px rgba(255,214,102,.8)); animation-delay: 0s !important; }
@media (prefers-reduced-motion: reduce) { body.ere-or .logo b, body.ere-or .logo i.ere-i, body.ere-or .av.av-or, .ere-fil { animation: none !important; } .ere-poussiere { display: none; } }`;
  document.head.appendChild(st);
}
/** Poussière d'or : quelques paillettes qui dérivent lentement sur toute l'appli */
function ereCanvasPoussiere() {
  if (document.querySelector(".ere-poussiere") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "ere-poussiere"; document.body.appendChild(cv);
  const cx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const taille = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  taille(); addEventListener("resize", taille);
  const P = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), v: .00004 + Math.random() * .00008, r: .6 + Math.random() * 1.6, p: Math.random() * 6.28, d: (Math.random() - .5) * .00003 }));
  let t0 = 0;
  const image = t => {
    if (!document.body.classList.contains("ere-or")) { cv.remove(); ERE_RAF = null; return; }
    const dt = t0 ? Math.min(64, t - t0) : 16; t0 = t;
    cx.clearRect(0, 0, cv.width, cv.height);
    P.forEach(q => {
      q.y -= q.v * dt; q.x += q.d * dt; q.p += .002 * dt;
      if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); }
      const a = .18 + .22 * (1 + Math.sin(q.p)) / 2, x = q.x * cv.width, y = q.y * cv.height, r = q.r * dpr;
      const g = cx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, "rgba(255,236,170," + a + ")"); g.addColorStop(1, "rgba(232,185,49,0)");
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 4, 0, 6.283); cx.fill();
    });
    ERE_RAF = requestAnimationFrame(image);
  };
  if (!ERE_RAF) ERE_RAF = requestAnimationFrame(image);
}
/** Le grand moment : une seule fois par appareil, le jour où l'on découvre le premier millionnaire */
function ereRevelation(pm) {
  const cle = "versus.ereVue", deja = stock.get(cle);
  if (deja === (pm.nom + "|" + pm.date) || document.querySelector(".ere-voile")) return;
  const moi = SESSION && SESSION.nom === pm.nom;
  const o = document.createElement("div"); o.className = "ere-voile"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Premier millionnaire");
  o.innerHTML = '<canvas></canvas><div class="ere-c"><div class="ere-cour">👑</div><div class="ere-k">Premier millionnaire du Versus</div><div class="ere-m">0 €</div><div class="ere-n">' + esc(pm.nom) + '</div>' +
    '<p class="ere-p">' + (moi ? "C'est toi. Le cap du million est franchi, le premier du groupe, et pour toujours." : esc(pm.nom) + " a franchi le million en premier. C'est gravé, pour toujours.") + " À partir d'aujourd'hui, l'appli vit à l'heure de l'ère d'or.</p>" +
    '<button class="ere-b" type="button">Entrer dans l\'ère d\'or</button></div>';
  document.body.appendChild(o);
  const cv = o.querySelector("canvas"), cx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const W = cv.width, H = cv.height, P = [];
  const salve = n => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (2 + Math.random() * 7) * dpr; P.push({ x: W / 2, y: H * .42, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3 * dpr, r: (2 + Math.random() * 4) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, vie: 1, piece: Math.random() < .35 }); } };
  const pluie = () => { for (let i = 0; i < 3; i++) P.push({ x: Math.random() * W, y: -10, vx: (Math.random() - .5) * dpr, vy: (1 + Math.random() * 2) * dpr, r: (1.5 + Math.random() * 3) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, vie: 1, piece: Math.random() < .3 }); };
  const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t0 = performance.now(), salves = [700, 1700, 2600], raf = null;
  const m = o.querySelector(".ere-m"), cible = 1000000, debut = performance.now() + 500;
  const image = t => {
    const e = t - t0;
    while (salves.length && e > salves[0]) { salves.shift(); salve(calme ? 0 : 140); }
    if (!calme && e > 900) pluie();
    const k = Math.min(1, Math.max(0, (t - debut) / 2200)), val = Math.round(cible * (1 - Math.pow(1 - k, 4)));
    m.textContent = val.toLocaleString("fr-FR") + " €";
    cx.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.x += q.vx; q.y += q.vy; q.vy += .12 * dpr; q.vx *= .99; q.rot += q.vr; q.vie -= q.y > H ? 1 : .004;
      if (q.vie <= 0) { P.splice(i, 1); continue; }
      cx.save(); cx.translate(q.x, q.y); cx.rotate(q.rot); cx.globalAlpha = Math.max(0, Math.min(1, q.vie));
      if (q.piece) { const g = cx.createLinearGradient(-q.r * 2, 0, q.r * 2, 0); g.addColorStop(0, "#9C6B12"); g.addColorStop(.5, "#FFE58A"); g.addColorStop(1, "#C98E1E"); cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, 0, q.r * 2, q.r * 2 * Math.abs(Math.cos(q.rot * 2)) + .5, 0, 0, 6.283); cx.fill(); }
      else { cx.fillStyle = Math.random() < .5 ? "#FFE58A" : "#E8B931"; cx.fillRect(-q.r, -q.r / 3, q.r * 2, q.r * .7); }
      cx.restore();
    }
    raf = requestAnimationFrame(image);
  };
  raf = requestAnimationFrame(image);
  if (navigator.vibrate) try { navigator.vibrate([40, 60, 40, 60, 120]); } catch (er) { /* rien */ }
  const fermer = () => { cancelAnimationFrame(raf); stock.set(cle, pm.nom + "|" + pm.date); o.style.transition = "opacity .6s"; o.style.opacity = "0"; setTimeout(() => o.remove(), 650); };
  o.querySelector(".ere-b").addEventListener("click", fermer);
}
/** Applique (ou retire) l'ère d'or sur toute l'appli */
function ereDor() {
  const pm = ereDorActive(), on = !!pm;
  document.body.classList.toggle("ere-or", on);
  document.body.dataset.ereNom = on ? pm.nom : "";
  document.querySelectorAll(".logo").forEach(l => { const i = l.querySelector("i.ere-i"); if (on && !i) { const n = document.createElement("i"); n.className = "ere-i"; l.insertBefore(n, l.querySelector("b")); } else if (!on && i) i.remove(); });
  let fil = document.querySelector(".ere-fil");
  if (on && !fil) { fil = document.createElement("div"); fil.className = "ere-fil"; document.body.appendChild(fil); } else if (!on && fil) fil.remove();
  if (on) { ereStyle(); ereCanvasPoussiere(); if (!simulation()) ereRevelation(pm); }
  majReglageOr();
}
/** Réglage réservé au premier millionnaire : afficher ou masquer l'ère d'or pour tout le monde */
function majReglageOr() {
  const sec = document.getElementById("regl-or"); if (!sec) return;
  const pm = typeof D !== "undefined" && D && D.premierMillion, moi = moiPilote();
  sec.hidden = !(pm && moi && pm.nom === moi); if (sec.hidden) return;
  const brut = ((D.ecurie || {})[moi] || {}).equip || {}, etat = brut.aura === "off" ? "off" : "";
  sec.querySelectorAll("[data-or]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.or === etat)); b.onclick = async () => {
    if (b.dataset.or === etat) return;
    const avant = D.ecurie, equip = Object.assign({}, brut, { aura: b.dataset.or });
    delete equip.amelios; delete equip.amelioY; delete equip.amelioT;
    D.ecurie = Object.assign({}, avant, { [moi]: Object.assign({}, (avant || {})[moi], { equip: Object.assign({}, brut, { aura: b.dataset.or }) }) });
    ereDor();
    if (SOURCE !== "api" || simulation()) { toast("Aperçu seulement : rien n'est envoyé."); return; }
    const rep = await posterAdmin({ action: "ecurie", personne: moi, equip: equip });
    if (rep.ok) { if (rep.ecurie) D.ecurie = rep.ecurie; toast(b.dataset.or === "off" ? "Masquée pour tout le monde." : "Visible par tout le monde 👑"); }
    else { D.ecurie = avant; ereDor(); toast(rep.message || "Impossible d'enregistrer."); }
  }; });
}

/* ---------- Mode admin : désactivé par défaut, activable dans les Réglages ---------- */
function majModeAdmin() {
  const sec = $("#regl-admin"); if (!sec) return;
  sec.hidden = !vraiAdmin() || !D || !D.personnes; if (sec.hidden) return;
  const on = adminActif();
  sec.querySelectorAll("[data-admin-on]").forEach(b => { b.setAttribute("aria-pressed", String((b.dataset.adminOn === "1") === on)); b.onclick = () => {
    if ((b.dataset.adminOn === "1") === on) return;
    try { if (b.dataset.adminOn === "1") sessionStorage.setItem("versus.adminOn", "1"); else sessionStorage.removeItem("versus.adminOn"); } catch (e) { /* indisponible */ }
    ["versus.vueJoueur", "versus.dateSim", "versus.apercuSaison"].forEach(k => stock.del(k));
    location.reload();
  }; });
  $("#bloc-admin-joueur").hidden = true;   // plus de « Je joue en tant que »

}
/* ---------- Vue joueur et date simulée (admin) ---------- */
const DATES_SIM = [["", "Aujourd'hui"], ["2026-11-20", "20 nov. · teaser"], ["2026-12-03", "3 déc. · chauffe"], ["2026-12-22", "22 déc. · cartes de janvier"],
  ["2027-01-21", "21 janv. · nouvelles règles"], ["2027-02-21", "21 févr. · tout en jeu"], ["2027-11-21", "21 nov. 2027 · Finale"]];
function majVueJoueur() {
  const sec = $("#regl-vue"); if (!sec) return;
  sec.hidden = !adminActif() || !D || !D.personnes;
  if (sec.hidden) return;
  const vj = stock.get("versus.vueJoueur") || "", ds = stock.get("versus.dateSim") || "";
  $("#choix-vue").innerHTML = '<button class="chip" type="button" data-vuej="" aria-pressed="' + !vj + '">👑 Admin</button><button class="chip" type="button" data-vuej="' + esc(joueurAdmin()) + '" aria-pressed="' + !!vj + '">👁️ Joueur (toi, sans admin)</button>';
  $("#choix-date").innerHTML = DATES_SIM.map(([d, l]) => '<button class="chip" type="button" data-dsim="' + d + '" aria-pressed="' + (ds === d) + '">' + esc(l) + "</button>").join("");
  document.querySelectorAll("[data-vuej]").forEach(b => b.addEventListener("click", () => { if (b.dataset.vuej) { stock.set("versus.vueJoueur", b.dataset.vuej); stock.set("versus.apercuSaison", "0"); } else { stock.del("versus.vueJoueur"); stock.del("versus.dateSim"); } location.reload(); }));
  document.querySelectorAll("[data-dsim]").forEach(b => b.addEventListener("click", () => { if (b.dataset.dsim) stock.set("versus.dateSim", b.dataset.dsim); else stock.del("versus.dateSim"); location.reload(); }));
  const band = $("#simu-band"), parts = [];
  if (vj) parts.push("👁️ Vue joueur (toi, sans admin)");
  if (window.DATE_SIM) parts.push("📅 Simulé au " + esc(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })) + " · rien n'est envoyé");
  band.hidden = !parts.length;
  band.innerHTML = parts.length ? "<span>" + parts.join(" · ") + '</span><button class="lien" type="button" id="simu-quitter">Revenir à l\'admin, aujourd\'hui</button>' : "";
  const q = $("#simu-quitter"); if (q) q.addEventListener("click", () => { stock.del("versus.vueJoueur"); stock.del("versus.dateSim"); location.reload(); });
}
/* Lien direct vers le Stand (bouton des e-mails de rappel) : …/#stand */
if (location.hash === "#stand") { ETAT.podium = "stand"; const ko = moisCarteOuvert(); if (ko) choisirSaison(ko === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(ko / 100)); garder(); history.replaceState(null, "", location.pathname + location.search + "#trophees"); }
montrerVue(vueActive());
(function () {   // la dernière copie s'affiche tout de suite ; la mise à jour arrive par-dessus
  const c = stock.get(CLES.cache); if (!c || !apiUrl() || !stock.get(CLES.cle)) return;
  try { D = JSON.parse(c); SOURCE = "cache"; EN_CHARGEMENT = true; afficherTout(); } catch (e) { D = null; }
})();
charger(false);
window.addEventListener("online", () => { if (SOURCE === "cache") charger(false); });
setTimeout(verifierMiseAJour, 3000);
window.addEventListener("offline", () => { if (D && SOURCE === "api") { SOURCE = "cache"; afficherTout(); } });
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
setTimeout(prechaufferMoi, 600);
