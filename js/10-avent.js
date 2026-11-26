/* Versus · 🎄 Calendrier de l'Avent du tour de chauffe (v20.61, validé par Théo le 25/11/2026)
   Du 1er au 24 décembre 2026, une case par jour (Théo, 25/11 : crash test de participation avant les mini-jeux 2027) : une case ne s'ouvre QUE
   le jour même (heure de Paris) ; pas ouverte ce jour-là = « ❄️ Manquée » pour toujours (une case déjà ouverte reste rejouable). C'est le SERVEUR qui
   tranche (Avent.js, action aventCase) : l'appli lui envoie « case n ouverte » (en file sans réseau), il n'accepte que la case de son jour de Paris,
   et l'appli se cale sur sa réponse (son heure, ses cases ouvertes). Sans réseau : la date de l'appareil, corrigée à la reconnexion.
   🏅 Les 24 cases ouvertes, chacune le jour même (compté par le serveur) : la plaque « Hiver 2026 » dorée, le 24 (liste dores du serveur, js/3-podium.js). Dix-sept petits jeux de Noël (v20.62 : + « Les biscuits du Père Noël » en case 16) (10 à 30 s, rejouables, score pour soi seul)
   et sept surprises. AUCUN point. Les cases ouvertes et les records vivent sur l'appareil (versus.avent*) ; chaque nouveau record part aussi au serveur (ci-dessous).
   Le 24 : un souvenir pour chaque pilote (plaque « Hiver 2026 » + traînée « Flocons »), à porter dès le 24/12/2026 (js/3-podium.js, souvenirOuvert).
   Règle du secret : aucune case ne parle de ce qui arrive (règles, circuits, nouveautés) ; le 20 dit seulement « l'annonce est arrivée ».
   Entrée : une carte en haut du Classement, en décembre 2026 seulement (pastille tant que la case du jour n'est pas ouverte).
   Aperçu admin (double sécurité apercuAutorise) : toutes les cases ouvrables, rien n'est gardé ni envoyé.
   Records de Noël partagés (serveur, app_scripts/versus/Avent.js, validé par Théo) : chaque meilleur score part au serveur (scores de jeu
   seulement), en file sur l'appareil si le réseau manque (réessai silencieux).
   🏆 Avent 26/11 (Théo, 26/11) · une case ouverte le jour même se rejoue À L'INFINI jusqu'au 24/12 à 23 h 59 (heure de Paris, celle du serveur) et chaque
   nouveau record compte jusque-là (le serveur en écrit au plus un par jeu et par minute : l'appli renvoie toute seule la minute d'après).
   CLASSEMENT EN DIRECT de chaque jeu, visible par tous dès le 1er (classements du serveur : un nom et un score de jeu, rien d'autre), dans la carte
   de la case, sous le jeu ; « ton rang » en avant. Le 25 à 0 h, tout est figé : le ROI DES JEUX DE NOËL (le plus de 1res places, puis de 2es, puis le
   premier à avoir atteint son dernier record) gagne pour toujours la plaque « Roi de Noël 2026 », la couronne de houx et la livrée « Roi de Noël »
   (js/3-podium.js, GAINS_ROI) ; chaque 1re place finale = une ⭐ étoile de Noël (vitrine). Attribués par le serveur (gagnants, dès le 25/12). */
"use strict";
const AVENT = { debut: 20261201, fin: 20261231, derniere: 24, annonce: 20 };
let AVENT_APERCU = false;
/** écart entre l'horloge du serveur et celle de l'appareil (ms), appris à chaque réponse du serveur ; 0 tant qu'il n'a pas répondu (hors réseau : la date de l'appareil) */
let AVENT_DECAL = (() => { try { const v = Number(stock.get("versus.aventDecal")); return isFinite(v) && Math.abs(v) < 4e10 ? v : 0; } catch (e) { return 0; } })();   // v20.74 : le dernier écart connu, dès le démarrage
const AV_PARIS = (() => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }); } catch (e) { return null; } })();
/** aujourd'hui à Paris (aaaammjj), à l'heure du serveur s'il a répondu */
function aventNum() {
  const t = new Date(Date.now() + AVENT_DECAL);
  try { const p = {}; AV_PARIS.formatToParts(t).forEach(x => { p[x.type] = x.value; }); return +p.year * 10000 + +p.month * 100 + +p.day; }
  catch (e) { return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate(); }
}
function aventPeriode() { const n = aventNum(); return n >= AVENT.debut && n <= AVENT.fin; }
/** le jour de décembre 2026 (1..31) ; 0 hors décembre 2026 */
function aventJourDec() { return aventPeriode() ? aventNum() % 100 : 0; }
/** la case du jour (1..24) ; 0 du 25 au 31 (le 24 reste la dernière) et hors décembre */
function aventJour() { const j = aventJourDec(); return j >= 1 && j <= AVENT.derniere ? j : 0; }
function aventApercu() { return AVENT_APERCU && !window.APERCUS_FINIS && apercuAutorise(); }
/** ouvrable : la case du jour, ou une case déjà ouverte (rejouable) ; tout en aperçu admin */
function caseOuvrable(n) { return n >= 1 && n <= 24 && (aventApercu() || (aventPeriode() && (n === aventJour() || aventOuvertes().includes(n)))); }
/** ❄️ manquée : un jour passé dont la case n'a pas été ouverte ce jour-là (fermée pour toujours) */
function caseManquee(n) { return !aventApercu() && n >= 1 && n <= 24 && n < aventJourDec() && !aventOuvertes().includes(n); }
function aventOuvertes() { try { const l = JSON.parse(stock.get("versus.avent") || "[]"); return Array.isArray(l) ? l.filter(n => Number.isInteger(n) && n >= 1 && n <= 24) : []; } catch (e) { return []; } }
function marquerOuverte(n) {
  if (aventApercu() || !caseOuvrable(n)) return; const l = aventOuvertes();
  if (!l.includes(n)) { l.push(n); stock.set("versus.avent", JSON.stringify(l)); majPastillesAvent(); }
  if (n === aventJour() && aventFile() && !(AVENT_SRV && Array.isArray(AVENT_SRV.cases) && AVENT_SRV.cases.includes(n))) mettreEnFileCase(n);   // le serveur tranche
}
/** 🏅 le compte des cases ouvertes le jour même : { n (ouvertes), jd (jours écoulés, 24 au plus), perdue (1re case manquée, 0 si aucune), toutes } */
function aventCompte() {
  const l = aventOuvertes(), jd = Math.min(24, aventJourDec()), att = fileCases().filter(k => l.includes(k) && k <= jd), n = l.filter(k => k <= jd && !att.includes(k)).length;
  let perdue = 0; for (let k = 1; k <= jd && !perdue; k++) if (caseManquee(k)) perdue = k;
  return { n, jd, perdue, attente: att, toutes: n === 24 };   // une case qui attend le serveur n'est pas encore comptée
}
const AV_REGLE = "Une case par jour : à ouvrir le jour même, sinon elle est perdue ❄️";
const AV_DOREE = "🏅 Ouvre les 24 cases, chacune le jour même : la plaque Hiver 2026 dorée t'attend le 24";
const AV_ROI = "🎅 Le roi des jeux de Noël gagne : plaque Roi de Noël 2026, couronne de houx, la livrée « Roi de Noël »";
/** 🔒 le 25/12 à 0 h (heure de Paris, celle du serveur dès qu'il a répondu) : records et classements figés */
function aventFige() { return aventNum() > 20261224; }
/** le message (toast) passe au-dessus du calendrier tant qu'il est ouvert (secours des navigateurs sans :has) */
function avToastDessus() { try { const ouvert = !!document.querySelector(".av-ov, .av-case"), t = document.getElementById("toast"); if (t) t.classList.toggle("av-dessus", ouvert);
  document.body.classList.toggle("av-page-cachee", ouvert); } catch (e) { } }   // Avent 26/11 : sous le calendrier (plein écran), la page n'est plus dessinée : défilement fluide même sur le Podium
try { const go = () => new MutationObserver(avToastDessus).observe(document.body, { childList: true }); if (document.body) go(); else document.addEventListener("DOMContentLoaded", go); } catch (e) { }   // une fenêtre retirée par n'importe quel chemin : la page réapparaît
/** le message d'une case manquée (la 24 : le souvenir reste à chacun) */
function msgManquee(n) { return "❄️ Case manquée : elle ne s'ouvrait que le " + n + " décembre." + (n === 24 ? " Ton souvenir (plaque Hiver 2026 et traînée Flocons) t'attend quand même dans l'écurie." : ""); }
/** « 🏅 4/24 · encore possible », « ❄️ 4/24 · plaque dorée perdue (case du 3 manquée) », « 24/24 · plaque dorée gagnée » */
function texteCompteAvent() {
  const c = aventCompte(); if (!c.jd) return "";
  const at = c.attente.length ? " · ⏳ case du " + c.attente.join(", ") + " pas encore comptée (pas de réseau)" : "";
  if (c.perdue) return "❄️ " + c.n + "/24 · plaque dorée perdue (case du " + c.perdue + " manquée)" + at;
  if (c.toutes) return "🏅 24/24 · plaque Hiver 2026 dorée gagnée !";
  return "🏅 " + c.n + "/24 · encore possible" + at;
}
function recordsAvent() { try { const o = JSON.parse(stock.get("versus.aventRecords") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function sonAvent(k, i) { try { if (window.SONS && SONS.noel) SONS.noel(k, i); } catch (e) { /* rien */ } }

/* ---------- Dessins (canvas, tout à nous) ---------- */
const AV_COUL = ["#E63946", "#2A9D8F", "#F4B400", "#4C9AFF", "#B57BFF", "#FF8A3D"];
function avRond(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function avFond(G, c, sol) {
  if (!G.s.fond) { const g = c.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, "#0A1030"); g.addColorStop(.6, "#1B2C5C"); g.addColorStop(1, "#33508A"); G.s.fond = g;
    G.s.astres = Array.from({ length: 26 }, () => [Math.random() * G.W, Math.random() * G.H * .55, .5 + Math.random() * 1.1]); }
  c.fillStyle = G.s.fond; c.fillRect(0, 0, G.W, G.H);
  c.fillStyle = "rgba(255,255,255,.75)"; G.s.astres.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
  if (sol !== false) { c.fillStyle = "#EAF4FF"; c.beginPath(); c.moveTo(0, G.H - 34); c.quadraticCurveTo(G.W * .3, G.H - 52, G.W * .55, G.H - 36); c.quadraticCurveTo(G.W * .8, G.H - 22, G.W, G.H - 40); c.lineTo(G.W, G.H); c.lineTo(0, G.H); c.fill(); }
}
function avNeige(G, c) {
  if (!G.s.flk) G.s.flk = Array.from({ length: 28 }, () => [Math.random() * G.W, Math.random() * G.H, .8 + Math.random() * 1.8, Math.random() * 6]);
  c.fillStyle = "rgba(255,255,255,.8)";
  G.s.flk.forEach(f => { if (!reduit) { f[1] += f[2] * .5; f[0] += Math.sin(G.horloge * 1.5 + f[3]) * .3; if (f[1] > G.H) { f[1] = -4; f[0] = Math.random() * G.W; } } c.beginPath(); c.arc(f[0], f[1], f[2], 0, 7); c.fill(); });
}
function avCadeau(c, x, y, w, h, col, ruban) {
  c.fillStyle = col; avRond(c, x - w / 2, y - h / 2, w, h, 3); c.fill();
  c.fillStyle = "rgba(0,0,0,.15)"; c.fillRect(x - w / 2, y + h / 2 - 4, w, 4);
  c.fillStyle = ruban || "#FFE596"; c.fillRect(x - w * .09, y - h / 2, w * .18, h); c.fillRect(x - w / 2, y - h * .09, w, h * .18);
  c.beginPath(); c.ellipse(x - w * .17, y - h / 2 - 3, w * .17, h * .13, -.5, 0, 7); c.ellipse(x + w * .17, y - h / 2 - 3, w * .17, h * .13, .5, 0, 7); c.fill();
}
function avCharbon(c, x, y, r) { c.fillStyle = "#2B2D33"; c.beginPath(); c.moveTo(x - r, y); c.lineTo(x - r * .4, y - r * .9); c.lineTo(x + r * .6, y - r * .8); c.lineTo(x + r, y + r * .1); c.lineTo(x + r * .3, y + r * .9); c.lineTo(x - r * .7, y + r * .7); c.fill(); c.fillStyle = "#555A66"; c.fillRect(x - r * .3, y - r * .4, r * .4, r * .3); }
function avTraineau(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = "#F7CF55"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(-30, 16); c.lineTo(26, 16); c.quadraticCurveTo(36, 16, 34, 6); c.stroke();
  c.beginPath(); c.moveTo(-18, 16); c.lineTo(-18, 9); c.moveTo(14, 16); c.lineTo(14, 9); c.stroke();
  c.fillStyle = "#C1121F"; c.beginPath(); c.moveTo(-30, -6); c.lineTo(22, -2); c.quadraticCurveTo(30, 0, 28, 10); c.lineTo(-26, 10); c.quadraticCurveTo(-34, 2, -30, -6); c.fill();
  c.fillStyle = "#F7CF55"; c.fillRect(-26, 2, 50, 2.5);
  c.fillStyle = "#8C5A2B"; c.beginPath(); c.ellipse(-14, -10, 13, 11, 0, 0, 7); c.fill();
  c.fillStyle = "#2A9D8F"; c.fillRect(2, -14, 12, 12); c.fillStyle = "#FFE596"; c.fillRect(7, -14, 2.5, 12);
  c.restore();
}
function avRenne(c, x, y, s, o) {
  o = o || {}; c.save(); c.translate(x, y); c.scale(o.sens ? -s : s, s);
  const corps = o.clair ? "#C99A6B" : "#8B5A33";
  c.strokeStyle = corps; c.lineWidth = 3; c.lineCap = "round";
  const ph = o.pas || 0; [[-9, 0], [-4, 1], [6, 0], [11, 1]].forEach(([lx, k]) => { c.beginPath(); c.moveTo(lx, 6); c.lineTo(lx + Math.sin(ph + k * 3) * 3, 17); c.stroke(); });
  c.fillStyle = corps; c.beginPath(); c.ellipse(0, 2, 15, 8, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(15, -9, 6, 5, .3, 0, 7); c.fill(); c.fillRect(10, -8, 5, 9);
  c.fillStyle = "#F4E2C8"; c.beginPath(); c.ellipse(-14, -1, 3, 2.5, 0, 0, 7); c.fill();
  if (!o.sansBois) { c.strokeStyle = "#D9B27C"; c.lineWidth = 1.8; c.beginPath(); c.moveTo(13, -13); c.lineTo(10, -22); c.lineTo(6, -25); c.moveTo(10, -22); c.lineTo(13, -27); c.moveTo(17, -13); c.lineTo(19, -22); c.lineTo(23, -25); c.moveTo(19, -22); c.lineTo(17, -27); c.stroke(); }
  c.fillStyle = "#111"; c.beginPath(); c.arc(16, -10, 1.2, 0, 7); c.fill();
  c.fillStyle = o.nezBrun ? "#4A2C17" : "#FF2E3B"; c.beginPath(); c.arc(21, -7, 2.6, 0, 7); c.fill();
  if (!o.nezBrun) { c.fillStyle = "rgba(255,80,90,.35)"; c.beginPath(); c.arc(21, -7, 4.5, 0, 7); c.fill(); }
  c.restore();
}
function avLutin(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "#2E8B57"; c.beginPath(); c.ellipse(0, 16, 13, 10, 0, 0, 7); c.fill();
  c.fillStyle = "#F6D3B3"; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
  c.beginPath(); c.moveTo(-10, -1); c.lineTo(-16, -6); c.lineTo(-9, 3); c.moveTo(10, -1); c.lineTo(16, -6); c.lineTo(9, 3); c.fill();
  c.fillStyle = "#C1121F"; c.beginPath(); c.moveTo(-12, -5); c.quadraticCurveTo(0, -12, 12, -5); c.lineTo(4, -26); c.lineTo(-12, -5); c.fill();
  c.fillStyle = "#fff"; c.beginPath(); c.arc(4, -26, 3, 0, 7); c.fill(); c.fillRect(-12, -7, 24, 3.5);
  c.fillStyle = "#222"; c.beginPath(); c.arc(-4, 0, 1.4, 0, 7); c.arc(4, 0, 1.4, 0, 7); c.fill();
  c.strokeStyle = "#B5523B"; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 3, 3.5, .3, 2.8); c.stroke();
  c.restore();
}
function avBonhomme(c, x, y, s, echarpe) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "#F8FBFF"; c.strokeStyle = "#AFC6E0"; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 10, 13, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -8, 9, 0, 7); c.fill(); c.stroke();
  c.fillStyle = echarpe || "#E63946"; c.fillRect(-9, -1, 18, 4); c.fillRect(4, -1, 4, 10);
  c.fillStyle = "#222"; c.fillRect(-8, -20, 16, 3); c.fillRect(-5, -30, 10, 10);
  c.beginPath(); c.arc(-3, -9, 1.2, 0, 7); c.arc(3, -9, 1.2, 0, 7); c.fill();
  c.fillStyle = "#FF8A3D"; c.beginPath(); c.moveTo(0, -7); c.lineTo(8, -5.5); c.lineTo(0, -5); c.fill();
  c.restore();
}
function avBoule(c, x, y, r, col, motif) {
  c.strokeStyle = "#C9A227"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - r - 6); c.lineTo(x, y - r); c.stroke();
  c.fillStyle = "#C9A227"; c.fillRect(x - 4, y - r - 3, 8, 4);
  const g = c.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); g.addColorStop(0, "#fff"); g.addColorStop(.25, col); g.addColorStop(1, "rgba(0,0,0,.55)");
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = g; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1;
  c.strokeStyle = "rgba(255,255,255,.85)"; c.fillStyle = "rgba(255,255,255,.85)"; c.lineWidth = 2;
  if (motif === 1) { c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.stroke(); }
  else if (motif === 2) for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x + Math.cos(i * 1.26) * r * .55, y + Math.sin(i * 1.26) * r * .55, 1.8, 0, 7); c.fill(); }
  else if (motif === 3) { c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(x - r + i * r / 3, y - r * .3); c.lineTo(x - r + i * r / 3 + r / 6, y + r * .3); } c.stroke(); }
  else if (motif === 4) avFlocon(c, x, y, r * .5, "rgba(255,255,255,.9)");
}
function avFlocon(c, x, y, r, col) {
  c.save(); c.translate(x, y); c.strokeStyle = col || "#fff"; c.lineWidth = Math.max(1, r / 6); c.lineCap = "round";
  for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r); c.moveTo(0, -r * .55); c.lineTo(-r * .25, -r * .8); c.moveTo(0, -r * .55); c.lineTo(r * .25, -r * .8); c.stroke(); }
  c.restore();
}
function avChaussette(c, x, y, s, col, motif) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = "#7A5A2B"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -24); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-9, -22); c.lineTo(9, -22); c.lineTo(9, 10); c.quadraticCurveTo(9, 22, -4, 22); c.lineTo(-16, 22); c.quadraticCurveTo(-22, 14, -12, 10); c.lineTo(-9, 8); c.closePath(); c.fill();
  c.save(); c.clip(); c.fillStyle = "rgba(255,255,255,.85)";
  if (motif === 1) for (let i = 0; i < 4; i++) c.fillRect(-25, -12 + i * 9, 40, 3.5);
  else if (motif === 2) for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(-14 + (i % 3) * 9 + (i > 5 ? -4 : 0), -10 + Math.floor(i / 3) * 10, 1.8, 0, 7); c.fill(); }
  else if (motif === 3) avFlocon(c, 0, 2, 6, "rgba(255,255,255,.9)");
  else if (motif === 4) { c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-9 + i * 6, -14); c.lineTo(-6 + i * 6, -8); c.lineTo(-9 + i * 6, -2); } c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 1.6; c.stroke(); }
  else if (motif === 5) { c.fillRect(-25, 0, 40, 6); }
  c.restore();
  c.fillStyle = "#F8FBFF"; avRond(c, -11, -28, 22, 8, 3); c.fill();
  c.restore();
}
function avSapin(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "#6B4423"; c.fillRect(-3, 6, 6, 8);
  c.fillStyle = "#1F7A4C"; [[-18, 8, 0, -8], [-14, -2, 0, -18], [-10, -12, 0, -28]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.lineTo(-a, b); c.fill(); });
  c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.moveTo(-6, -20); c.lineTo(0, -28); c.lineTo(6, -20); c.fill();
  c.restore();
}
function avCheminee(c, x, haut, w, H) {
  c.fillStyle = "#9E3B2C"; c.fillRect(x - w / 2, haut, w, H - haut);
  c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 1;
  for (let yy = haut + 10; yy < H; yy += 10) { c.beginPath(); c.moveTo(x - w / 2, yy); c.lineTo(x + w / 2, yy); c.stroke(); }
  c.fillStyle = "#7A2A1F"; c.fillRect(x - w / 2 - 4, haut, w + 8, 10); c.fillStyle = "#F4FAFF"; c.fillRect(x - w / 2 - 4, haut - 4, w + 8, 5);
}
function avBonnet(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col || "#C1121F"; c.beginPath(); c.moveTo(-30, 10); c.quadraticCurveTo(-26, -34, 6, -40); c.quadraticCurveTo(26, -38, 34, -22); c.quadraticCurveTo(18, -26, 22, 10); c.closePath(); c.fill();
  c.fillStyle = "#fff"; avRond(c, -34, 4, 60, 14, 7); c.fill(); c.beginPath(); c.arc(35, -22, 7, 0, 7); c.fill();
  c.restore();
}
/** un biscuit de pain d'épice glacé : k = 0 bonhomme, 1 sapin ; s = échelle ; a = angle */
function avBiscuit(c, x, y, s, k, a) {
  c.save(); c.translate(x, y); c.rotate(a || 0); c.scale(s, s); c.lineJoin = "round";
  c.beginPath();
  if (k) { c.moveTo(0, -24); c.lineTo(12, -8); c.lineTo(6, -8); c.lineTo(17, 8); c.lineTo(9, 8); c.lineTo(20, 22); c.lineTo(-20, 22); c.lineTo(-9, 8); c.lineTo(-17, 8); c.lineTo(-6, -8); c.lineTo(-12, -8); c.closePath(); }
  else { c.arc(0, -14, 9, 0, Math.PI * 2); c.moveTo(-8, -6); c.lineTo(8, -6); c.lineTo(20, 0); c.lineTo(17, 6); c.lineTo(9, 3); c.lineTo(12, 22); c.lineTo(3, 22); c.lineTo(0, 13); c.lineTo(-3, 22); c.lineTo(-12, 22); c.lineTo(-9, 3); c.lineTo(-17, 6); c.lineTo(-20, 0); c.closePath(); }
  c.fillStyle = k ? "#B8783A" : "#C98A4B"; c.fill(); c.strokeStyle = "#7A4A1E"; c.lineWidth = 2; c.stroke();
  c.strokeStyle = "#FFFFFF"; c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath();
  if (k) { c.moveTo(-8, -2); c.lineTo(6, -6); c.moveTo(-11, 13); c.lineTo(10, 9); }
  else { c.moveTo(-14, 2); c.lineTo(-10, 0); c.moveTo(14, 2); c.lineTo(10, 0); c.moveTo(-6, 18); c.lineTo(-3, 16); c.moveTo(6, 18); c.lineTo(3, 16); }
  c.stroke();
  if (k) { c.fillStyle = "#E63946"; [[-4, 4], [7, 15], [-9, 17]].forEach(([u, v]) => { c.beginPath(); c.arc(u, v, 2.2, 0, Math.PI * 2); c.fill(); }); c.fillStyle = "#F4B400"; c.beginPath(); c.arc(0, -22, 3, 0, Math.PI * 2); c.fill(); }
  else { c.fillStyle = "#2B1A0E"; c.beginPath(); c.arc(-3, -16, 1.4, 0, Math.PI * 2); c.arc(3, -16, 1.4, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.4; c.beginPath(); c.arc(0, -13, 3.5, .2, Math.PI - .2); c.stroke();
    c.fillStyle = "#E63946"; c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2); c.arc(0, 7, 2, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
/** v20.62 · bornes des scores, les MÊMES que le serveur (app_scripts/versus/Avent.js, VS_AVENT_JEUX) : un score hors bornes n'est ni gardé ni envoyé */
const AV_BORNES = { cadeaux: [0, 120], renne: [0, 120], pile: [0, 400], boules: [0, 90], memory: [4, 900], cheminees: [0, 600], flocons: [0, 250], chaussettes: [0, 60],
  bonshommes: [1.25, 30], guirlande: [0, 200], livraison: [0, 60], biscuits: [0, 60], rennes: [0, 5], luge: [0, 200000], gobelets: [0, 200], feux: [100, 5000] };
/** Avent 26/11 · les décimales gardées par le serveur (Avent.js, dec ; les autres jeux : entiers) : le score est arrondi PAREIL avant d'être comparé, gardé et envoyé */
const AV_DEC = { memory: 1, bonshommes: 1, feux: 0 };
function avArrondi(id, v) { if (typeof v !== "number" || !isFinite(v)) return v; const d = AV_DEC[id]; if (d === undefined) return Math.round(v); const p = Math.pow(10, d); return Math.round(v * p) / p; }
function scoreValide(id, v) { const b = AV_BORNES[id]; return typeof v === "number" && isFinite(v) && (!b || (v >= b[0] && v <= b[1])); }
/** « 1 cadeau », « 3 cadeaux » : l'unité s'accorde (rien à faire pour s, ms, m, « sur 5 ») */
function avFmt(J, v) { if (J.fmt) return J.fmt(v); const n = Math.round(v), u = J.unite;
  return n + " " + (Math.abs(n) < 2 && /\p{L}{3,}s$|aux$/u.test(u) && !/ /.test(u) ? u.replace(/aux$/, "au").replace(/s$/, "") : u); }
let AV_MUET = false;   // v20.62 : avant le début de la partie (consigne affichée), les textes du jeu ne se dessinent pas sous la consigne
function avTexte(c, t, x, y, taille, col, align) { if (AV_MUET) return; c.font = "800 " + taille + "px Saira, system-ui, sans-serif"; c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillStyle = col || "#fff"; c.fillText(t, x, y); }
function avEclats(G, x, y, col) { if (reduit) return; (G.s.ecl = G.s.ecl || []).push(...Array.from({ length: 10 }, (_, i) => ({ x, y, vx: Math.cos(i * .63) * (40 + Math.random() * 60), vy: Math.sin(i * .63) * (40 + Math.random() * 60) - 30, v: .6, col }))); }
function avMajEclats(G, c, dt) { const l = G.s.ecl; if (!l) return; for (let i = l.length - 1; i >= 0; i--) { const p = l[i]; p.v -= dt; if (p.v <= 0) { l.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; c.globalAlpha = Math.min(1, p.v * 2); c.fillStyle = p.col || "#FFE596"; c.beginPath(); c.arc(p.x, p.y, 2.4, 0, 7); c.fill(); } c.globalAlpha = 1; }
const avMelange = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const avBorne = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Les jeux : { nom, ico, aide, duree (s, sinon jusqu'à l'erreur), unite, bas (plus petit = mieux), fmt, init, maj, dessin, toucher } ---------- */
const JEUX_AVENT = {
  cadeaux: { nom: "Les cadeaux du traîneau", ico: "🎁", duree: 25, unite: "cadeaux", aide: "Glisse le doigt pour déplacer la hotte et attrape les cadeaux qui tombent du traîneau. Évite le charbon (−2) !",
    init(G) { G.s.hx = 160; G.s.l = []; G.s.p = .4; },
    maj(G, dt) { const S = G.s; S.tx = 160 + 115 * Math.sin(G.t * 1.3); S.p -= dt;
      if (S.p <= 0) { S.l.push({ x: S.tx, y: 70, v: 110 + G.t * 6, ch: Math.random() < .22, col: AV_COUL[Math.floor(Math.random() * 6)] }); S.p = .55 - Math.min(.25, G.t * .012); }
      for (let i = S.l.length - 1; i >= 0; i--) { const o = S.l[i]; o.y += o.v * dt;
        if (o.y >= 336 && o.y <= 372 && Math.abs(o.x - S.hx) < 38) { S.l.splice(i, 1); if (o.ch) { G.score = Math.max(0, G.score - 2); G.son("rate"); } else { G.score++; G.son("pop"); avEclats(G, o.x, 350); } }
        else if (o.y > G.H + 20) S.l.splice(i, 1); } },
    dessin(G, c, dt) { const S = G.s; avFond(G, c); avNeige(G, c); avTraineau(c, S.tx || 160, 52, 1);
      S.l.forEach(o => o.ch ? avCharbon(c, o.x, o.y, 10) : avCadeau(c, o.x, o.y, 22, 20, o.col));
      c.fillStyle = "#8C5A2B"; c.beginPath(); c.moveTo(S.hx - 36, 344); c.lineTo(S.hx + 36, 344); c.lineTo(S.hx + 28, 378); c.lineTo(S.hx - 28, 378); c.fill();
      c.strokeStyle = "#5E3A1A"; c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(S.hx + i * 13, 346); c.lineTo(S.hx + i * 11, 376); c.stroke(); }
      avMajEclats(G, c, dt); },
    toucher(G, x) { G.s.hx = avBorne(x, 36, 284); } },

  cheminees: { nom: "Le traîneau entre les cheminées", ico: "🛷", unite: "cheminées", aide: "Touche l'écran pour faire monter le traîneau. Passe entre les cheminées et les nuages, sans rien toucher.",
    init(G) { G.s.y = 170; G.s.vy = -150; G.s.o = []; G.s.p = .6; },
    maj(G, dt) { const S = G.s; S.vy += 720 * dt; S.y += S.vy * dt; S.p -= dt;
      if (S.p <= 0) { const gap = Math.max(118, 165 - G.t * 2); S.o.push({ x: G.W + 30, gap, cy: 110 + Math.random() * 170 }); S.p = 1.55; }
      S.o.forEach(o => { o.x -= 130 * dt; if (!o.ok && o.x + 28 < 62) { o.ok = true; G.score++; G.son("pop"); }
        if (o.x - 28 < 98 && o.x + 28 > 62 && (S.y + 11 > o.cy + o.gap / 2 || S.y - 11 < o.cy - o.gap / 2)) G.finir(); });
      S.o = S.o.filter(o => o.x > -50); if (S.y > G.H - 30 || S.y < -10) G.finir(); },
    dessin(G, c) { const S = G.s; avFond(G, c); avNeige(G, c);
      S.o.forEach(o => { avCheminee(c, o.x, o.cy + o.gap / 2, 48, G.H);
        c.fillStyle = "#C9D6EA"; c.beginPath(); c.ellipse(o.x, o.cy - o.gap / 2 - 30, 40, 34, 0, 0, 7); c.fill(); c.fillRect(o.x - 40, 0, 80, Math.max(0, o.cy - o.gap / 2 - 30));
        c.fillStyle = "#EAF4FF"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(o.x + i * 12 - 4, o.cy - o.gap / 2 + 2); c.lineTo(o.x + i * 12, o.cy - o.gap / 2 + 12); c.lineTo(o.x + i * 12 + 4, o.cy - o.gap / 2 + 2); c.fill(); } });
      c.save(); c.translate(80, S.y); c.rotate(avBorne(S.vy / 900, -.4, .5)); avTraineau(c, 0, 0, .8); c.restore(); },
    toucher(G, x, y, t) { if (t === "down") { G.s.vy = -255; G.son("pop"); } } },

  renne: { nom: "Le renne pas comme les autres", ico: "🦌", duree: 25, unite: "trouvés", aide: "Un renne n'est pas comme les autres (nez, bois, couleur ou sens). Touche-le ! Une erreur coûte 1,5 s.",
    init(G) { G.s.n = 3; avNouvelleGrille(G); },
    maj(G, dt) { if (G.s.flash > 0) G.s.flash -= dt; },
    dessin(G, c) { const S = G.s; avFond(G, c, false); avNeige(G, c); const n = S.n, z = 300 / n;
      for (let i = 0; i < n * n; i++) { const cx = 10 + (i % n + .5) * z, cy = 58 + (Math.floor(i / n) + .5) * z;
        c.fillStyle = "rgba(255,255,255,.07)"; avRond(c, cx - z / 2 + 3, cy - z / 2 + 3, z - 6, z - 6, 8); c.fill();
        avRenne(c, cx - z * .05, cy + z * .08, z / 62, i === S.d ? S.v : {}); }
      if (S.flash > 0) { c.fillStyle = "rgba(230,57,70," + (S.flash * .5) + ")"; c.fillRect(0, 0, G.W, G.H); } },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s, z = 300 / S.n, i = Math.floor((x - 10) / z), j = Math.floor((y - 58) / z);
      if (i < 0 || j < 0 || i >= S.n || j >= S.n) return;
      if (j * S.n + i === S.d) { G.score++; G.son("ok"); S.n = G.score >= 7 ? 5 : G.score >= 3 ? 4 : 3; avNouvelleGrille(G); }
      else { G.t += 1.5; S.flash = .5; G.son("rate"); } } },

  pile: { nom: "La pile de cadeaux", ico: "📦", unite: "cadeaux", aide: "Touche l'écran pour lâcher le cadeau qui glisse. Ce qui dépasse tombe : empile le plus haut possible !",
    init(G) { G.s.p = [{ x: 160, w: 130, col: AV_COUL[0] }]; G.s.c = { x: 40, w: 130, d: 1 }; G.s.v = 120; G.s.cam = 0; G.s.ch = []; },
    maj(G, dt) { const S = G.s, c0 = S.c; c0.x += c0.d * S.v * dt; if (c0.x + c0.w / 2 > 312) { c0.x = 312 - c0.w / 2; c0.d = -1; } if (c0.x - c0.w / 2 < 8) { c0.x = 8 + c0.w / 2; c0.d = 1; }
      const cible = Math.max(0, (S.p.length - 7) * 26); S.cam += (cible - S.cam) * Math.min(1, dt * 4);
      S.ch.forEach(o => { o.vy += 600 * dt; o.y += o.vy * dt; }); S.ch = S.ch.filter(o => o.y < G.H + 400); },
    dessin(G, c) { const S = G.s, base = G.H - 44 + S.cam; avFond(G, c); avNeige(G, c);
      S.p.forEach((b, i) => avCadeau(c, b.x, base - i * 26, b.w, 24, b.col));
      if (!G.fin) avCadeau(c, S.c.x, base - S.p.length * 26 - 34, S.c.w, 24, AV_COUL[S.p.length % 6]);
      S.ch.forEach(o => avCadeau(c, o.x, o.y, o.w, 24, o.col)); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s, h = S.p[S.p.length - 1], c0 = S.c, col = AV_COUL[S.p.length % 6], base = G.H - 44 + S.cam;
      const g = Math.max(c0.x - c0.w / 2, h.x - h.w / 2), d = Math.min(c0.x + c0.w / 2, h.x + h.w / 2);
      if (d - g < 4) { S.ch.push({ x: c0.x, y: base - S.p.length * 26, w: c0.w, vy: 0, col }); G.son("rate"); G.finir(); return; }
      if (Math.abs(c0.x - h.x) < 5) { S.p.push({ x: h.x, w: h.w, col }); G.son("ok"); avEclats(G, h.x, base - S.p.length * 26); }
      else { S.p.push({ x: (g + d) / 2, w: d - g, col }); const cote = c0.x > h.x ? 1 : -1; S.ch.push({ x: cote > 0 ? (d + c0.x + c0.w / 2) / 2 : (g + c0.x - c0.w / 2) / 2, y: base - (S.p.length - 1) * 26, w: c0.w - (d - g), vy: 0, col }); G.son("pop"); }
      G.score++; S.v = Math.min(260, S.v + 9); const n = S.p[S.p.length - 1]; S.c = { x: G.score % 2 ? 300 - n.w / 2 : 20 + n.w / 2, w: n.w, d: G.score % 2 ? -1 : 1 }; } },

  boules: { nom: "Bataille de boules de neige", ico: "☃️", duree: 25, unite: "lutins", aide: "Les lutins sortent de leurs abris de neige : touche-les pour leur lancer une boule ! Laisse tranquilles les rennes (−2).",
    init(G) { G.s.tr = [[60, 200], [160, 200], [260, 200], [60, 320], [160, 320], [260, 320]].map(([x, y]) => ({ x, y, h: 0, v: 0, type: "", vie: 0 })); G.s.p = .5; G.s.spl = []; },
    maj(G, dt) { const S = G.s; S.p -= dt;
      if (S.p <= 0) { const libres = S.tr.filter(t => !t.type); if (libres.length) { const t = libres[Math.floor(Math.random() * libres.length)]; t.type = Math.random() < .2 ? "renne" : "lutin"; t.vie = Math.max(.55, 1.1 - G.t * .02); t.h = 0; } S.p = Math.max(.35, .75 - G.t * .015); }
      S.tr.forEach(t => { if (!t.type) return; t.vie -= dt; t.h = avBorne(t.vie > .15 ? t.h + dt * 6 : t.h - dt * 6, 0, 1); if (t.vie <= 0) t.type = ""; });
      S.spl.forEach(s => s.v -= dt); S.spl = S.spl.filter(s => s.v > 0); },
    dessin(G, c) { const S = G.s; avFond(G, c, false); c.fillStyle = "#EAF4FF"; c.fillRect(0, 140, G.W, G.H - 140); avNeige(G, c);
      S.tr.forEach(t => { c.save(); c.beginPath(); c.rect(t.x - 50, t.y - 90, 100, 90); c.clip();
        if (t.type === "lutin") avLutin(c, t.x, t.y + 20 - t.h * 48, 1.3); else if (t.type === "renne") avRenne(c, t.x - 4, t.y + 30 - t.h * 46, 1.2, {});
        c.restore(); c.fillStyle = "#F8FBFF"; c.strokeStyle = "#B9D0EA"; c.lineWidth = 2; c.beginPath(); c.ellipse(t.x, t.y + 4, 48, 20, 0, Math.PI, 0); c.fill(); c.stroke(); });
      S.spl.forEach(s => { c.globalAlpha = Math.min(1, s.v * 2); c.fillStyle = "#fff"; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(s.x + Math.cos(i) * 12, s.y + Math.sin(i * 2) * 10, 5, 0, 7); c.fill(); } c.globalAlpha = 1; }); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s;
      const v = S.tr.find(o => o.type && o.h > .3 && Math.abs(x - o.x) < 40 && y < o.y + 10 && y > o.y - 80); S.spl.push({ x, y, v: .4 });
      if (!v) return; if (v.type === "lutin") { G.score++; G.son("pop"); } else { G.score = Math.max(0, G.score - 2); G.son("rate"); } v.vie = Math.min(v.vie, .15); } },

  memory: { nom: "Le memory des boules de Noël", ico: "🔮", unite: "s", bas: true, chrono: true, fmt: s => s.toFixed(1).replace(".", ",") + " s", aide: "Retourne deux boules à la fois et retrouve les 6 paires, le plus vite possible.",
    init(G) { G.s.k = avMelange([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]).map(id => ({ id, vu: false, ok: false })); G.s.sel = []; G.s.att = 0; },
    maj(G, dt) { const S = G.s; G.score = G.t; if (S.att > 0) { S.att -= dt; if (S.att <= 0) { S.sel.forEach(i => S.k[i].vu = false); S.sel = []; } } },
    dessin(G, c) { const S = G.s; avFond(G, c, false); avNeige(G, c);
      S.k.forEach((k, i) => { const x = 22 + (i % 3) * 96, y = 64 + Math.floor(i / 3) * 80;
        c.fillStyle = k.ok ? "rgba(255,255,255,.1)" : k.vu ? "#F4FAFF" : "#C1121F"; avRond(c, x, y, 84, 70, 10); c.fill();
        if (k.vu || k.ok) avBoule(c, x + 42, y + 38, 20, AV_COUL[k.id], k.id % 5);
        else { c.strokeStyle = "#F7CF55"; c.lineWidth = 2; avRond(c, x + 6, y + 6, 72, 58, 7); c.stroke(); avFlocon(c, x + 42, y + 35, 12, "rgba(255,255,255,.7)"); } }); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s; if (S.att > 0 || S.sel.length >= 2) return;
      const i = Math.floor((x - 22) / 96), j = Math.floor((y - 64) / 80); if (i < 0 || i > 2 || j < 0 || j > 3) return;
      const n = j * 3 + i, k = S.k[n]; if (!k || k.vu || k.ok) return; k.vu = true; S.sel.push(n); G.son("pop");
      if (S.sel.length === 2) { const [a, b] = S.sel.map(z => S.k[z]);
        if (a.id === b.id) { a.ok = b.ok = true; S.sel = []; G.son("ok"); if (S.k.every(z => z.ok)) { G.score = G.t; G.finir(); } } else S.att = .7; } } },

  flocons: { nom: "Attrape les flocons", ico: "❄️", duree: 20, unite: "flocons", aide: "Touche les flocons avant qu'ils ne fondent au sol. Les flocons dorés valent 3 !",
    init(G) { G.s.f = []; G.s.p = 0; },
    maj(G, dt) { const S = G.s; S.p -= dt; if (S.p <= 0) { S.f.push({ x: 30 + Math.random() * 260, y: -20, v: 45 + Math.random() * 40 + G.t * 3, w: Math.random() * 6, or: Math.random() < .12, r: 13 + Math.random() * 6 }); S.p = Math.max(.25, .5 - G.t * .01); }
      S.f.forEach(f => { f.y += f.v * dt; f.x += Math.sin(G.t * 2 + f.w) * 22 * dt; }); S.f = S.f.filter(f => f.y < G.H - 26); },
    dessin(G, c, dt) { avFond(G, c); G.s.f.forEach(f => avFlocon(c, f.x, f.y, f.r, f.or ? "#F7CF55" : "#fff")); avMajEclats(G, c, dt); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s; let m = -1, dm = 30;
      S.f.forEach((f, i) => { const d = Math.hypot(f.x - x, f.y - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return; const f = S.f[m]; S.f.splice(m, 1); G.score += f.or ? 3 : 1; G.son(f.or ? "ok" : "pop"); avEclats(G, f.x, f.y, f.or ? "#F7CF55" : "#fff"); } },

  chaussettes: { nom: "Les chaussettes par paires", ico: "🧦", duree: 25, unite: "paires", aide: "Touche deux chaussettes identiques pour faire une paire. Une erreur coûte 1 s.",
    init(G) { avNouvellesChaussettes(G); },
    maj(G, dt) { const S = G.s; if (S.sh > 0) S.sh -= dt; if (S.l.every(z => z.ok) && !S.nv) { S.nv = .4; } if (S.nv) { S.nv -= dt; if (S.nv <= 0) avNouvellesChaussettes(G); } },
    dessin(G, c) { const S = G.s; avFond(G, c); avNeige(G, c);
      [150, 290].forEach(y => { c.strokeStyle = "#D9B27C"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y - 34); c.quadraticCurveTo(160, y - 18, 320, y - 34); c.stroke(); });
      S.l.forEach((z, i) => { if (z.ok) return; const x = 35 + (i % 6) * 50 + (S.sh > 0 && S.err && S.err.includes(i) ? Math.sin(G.horloge * 60) * 3 : 0), y = i < 6 ? 150 : 290;
        if (S.sel === i) { c.fillStyle = "rgba(247,207,85,.35)"; avRond(c, x - 22, y - 34, 44, 62, 8); c.fill(); }
        avChaussette(c, x + 3, y, 1.15, AV_COUL[z.c], z.m); }); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s, r = y > 105 && y < 185 ? 0 : y > 245 && y < 325 ? 1 : -1; if (r < 0) return;
      const i = r * 6 + Math.round((x - 35) / 50); if (i < r * 6 || i > r * 6 + 5 || S.l[i].ok) return;
      if (S.sel === null || S.sel === i) { S.sel = i; G.son("pop"); return; }
      const a = S.l[S.sel], b = S.l[i];
      if (a.c === b.c && a.m === b.m) { a.ok = b.ok = true; G.score++; G.son("ok"); } else { G.t += 1; S.sh = .35; S.err = [S.sel, i]; G.son("rate"); }
      S.sel = null; } },

  bonshommes: { nom: "La course des bonshommes de neige", ico: "⛄", unite: "s", bas: true, chrono: true, fmt: s => s.toFixed(1).replace(".", ",") + " s", aide: "Tape l'écran le plus vite possible pour faire avancer ton bonhomme (en bas, à ta couleur) jusqu'au drapeau, devant les lutins.",
    init(G) { G.s.b = [0, 1, 2].map(() => ({ d: 0, v: 44 + Math.random() * 14 })); G.s.d = 0; G.s.arr = 0; },
    maj(G, dt) { const S = G.s; S.b.forEach(b => { if (b.d < 250) { b.d += b.v * dt * (.8 + Math.random() * .4); if (b.d >= 250) S.arr++; } }); if (G.t > 30) { G.score = 30; G.msg = "Les lutins t'attendent encore à l'arrivée !"; G.finir(); } },
    dessin(G, c) { const S = G.s; avFond(G, c, false); c.fillStyle = "#EAF4FF"; c.fillRect(0, 100, G.W, G.H - 100); avNeige(G, c);
      for (let i = 0; i < 4; i++) { c.strokeStyle = "rgba(80,120,170,.35)"; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(0, 152 + i * 62); c.lineTo(G.W, 152 + i * 62); c.stroke(); c.setLineDash([]); }
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#111" : "#fff"; c.fillRect(290, 100 + i * 31, 10, 31); }
      S.b.forEach((b, i) => avLutin(c, 30 + b.d, 128 + i * 62, .95));
      avBonhomme(c, 30 + S.d, 318, 1, G.couleur); },
    toucher(G, x, y, t) { if (t !== "down") return; const S = G.s; S.d = Math.min(250, S.d + 8.5); if (S.d >= 250) { const place = S.arr + 1; G.score = G.t; G.msg = place === 1 ? "🥇 Premier devant les lutins !" : place + "e sur 4 : les lutins sont rapides !"; G.son("ok"); G.finir(); } } },

  guirlande: { nom: "La guirlande magique", ico: "💡", unite: "lumières", aide: "Regarde l'ordre dans lequel les ampoules s'allument, puis touche-les dans le même ordre. Une de plus à chaque tour !",
    init(G) { G.s.seq = [Math.floor(Math.random() * 4)]; G.s.i = 0; G.s.ph = "montre"; G.s.tm = .7; G.s.on = -1; G.s.k = 0; },
    maj(G, dt) { const S = G.s; S.tm -= dt;
      if (S.ph === "montre" && S.tm <= 0) { const pas = Math.max(.28, .5 - S.seq.length * .02);
        if (S.on >= 0) { S.on = -1; S.tm = .15; if (S.k >= S.seq.length) { S.ph = "joue"; S.i = 0; } }
        else { S.on = S.seq[S.k++]; G.son("ton", S.on); S.tm = pas; } }
      else if (S.ph === "joue" && S.on >= 0 && S.tm <= 0) S.on = -1;
      else if (S.ph === "pause" && S.tm <= 0) { S.ph = "montre"; S.k = 0; S.tm = .3; } },
    dessin(G, c) { const S = G.s, P = [[56, 220], [128, 250], [192, 250], [264, 220]], C = ["#E63946", "#2EC46B", "#F4B400", "#4C9AFF"]; avFond(G, c); avNeige(G, c);
      c.strokeStyle = "#1F7A4C"; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 170); c.bezierCurveTo(100, 230, 220, 230, 320, 170); c.stroke();
      P.forEach(([x, y], i) => { const on = S.on === i; c.fillStyle = "#555"; c.fillRect(x - 7, y - 40, 14, 12);
        if (on) { c.fillStyle = C[i]; c.globalAlpha = .35; c.beginPath(); c.arc(x, y, 46, 0, 7); c.fill(); c.globalAlpha = 1; }
        c.fillStyle = on ? C[i] : "rgba(255,255,255,.15)"; c.strokeStyle = C[i]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 24, 30, 0, 0, 7); c.fill(); c.stroke(); });
      avTexte(c, S.ph === "joue" ? "À toi ! (" + S.i + " / " + S.seq.length + ")" : "Regarde bien…", 160, 330, 17, "#fff"); },
    toucher(G, x, y, t) { const S = G.s; if (t !== "down" || S.ph !== "joue") return; const P = [[56, 220], [128, 250], [192, 250], [264, 220]];
      const k = P.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 38); if (k < 0) return;
      S.on = k; S.tm = .25; G.son("ton", k);
      if (k !== S.seq[S.i]) { G.son("rate"); G.finir(); return; }
      S.i++; if (S.i >= S.seq.length) { G.score = S.seq.length; S.seq.push(Math.floor(Math.random() * 4)); S.ph = "pause"; S.tm = .8; } } },

  livraison: { nom: "Livraison par la cheminée", ico: "🏠", duree: 25, unite: "livrés", aide: "Le traîneau survole les toits : touche l'écran pour lâcher un cadeau pile dans une cheminée.",
    init(G) { G.s.m = []; G.s.c = []; let x = 140; while (x < 520) { G.s.m.push(avMaison(x)); x += 130 + Math.random() * 50; } },
    maj(G, dt) { const S = G.s, v = 85 + G.t * 2; S.m.forEach(m => m.x -= v * dt); S.m = S.m.filter(m => m.x > -80); const der = S.m[S.m.length - 1]; if (!der || der.x < 400) S.m.push(avMaison((der ? der.x : 300) + 130 + Math.random() * 50));
      S.c.forEach(o => { o.vy += 520 * dt; o.y += o.vy * dt;
        S.m.forEach(m => { const cx = m.x + m.cx, top = G.H - 40 - m.h - 26; if (!o.fin && o.y >= top && o.y - o.vy * dt < top && Math.abs(o.x - cx) < 13) { o.fin = 1; G.score++; G.son("ok"); avEclats(G, cx, top); } });
        if (!o.fin) { const m = S.m.find(z => o.x > z.x - 2 && o.x < z.x + 72); const sol = m ? G.H - 40 - m.h - 6 : G.H - 40; if (o.y >= sol) { o.fin = 2; G.son("rate"); } } });
      S.c = S.c.filter(o => !o.fin); },
    dessin(G, c, dt) { const S = G.s; avFond(G, c); avNeige(G, c);
      S.m.forEach(m => { const y = G.H - 40 - m.h; avCheminee(c, m.x + m.cx, y - 26, 22, y + 10);
        c.fillStyle = m.col; c.fillRect(m.x, y, 70, m.h + 10); c.fillStyle = "#5A2E1F"; c.beginPath(); c.moveTo(m.x - 6, y + 2); c.lineTo(m.x + 35, y - 20); c.lineTo(m.x + 76, y + 2); c.fill();
        c.fillStyle = "#F4FAFF"; c.beginPath(); c.moveTo(m.x - 6, y + 2); c.lineTo(m.x + 35, y - 20); c.lineTo(m.x + 76, y + 2); c.lineTo(m.x + 70, y + 2); c.lineTo(m.x + 35, y - 15); c.lineTo(m.x, y + 2); c.fill();
        c.fillStyle = "#FFD36E"; c.fillRect(m.x + 12, y + 18, 14, 14); c.fillRect(m.x + 44, y + 18, 14, 14); });
      S.c.forEach(o => avCadeau(c, o.x, o.y, 16, 14, o.col));
      avTraineau(c, 80, 70 + Math.sin(G.horloge * 3) * 4, .9); avMajEclats(G, c, dt); },
    toucher(G, x, y, t) { if (t !== "down" || G.s.c.length >= 2) return; G.s.c.push({ x: 80, y: 84, vy: 0, col: AV_COUL[Math.floor(Math.random() * 6)] }); G.son("pop"); } },

  rennes: { nom: "Compte les rennes", ico: "🔢", unite: "sur 5", aide: "Un troupeau passe à toute vitesse, avec quelques lutins pour te piéger. Compte seulement les rennes, puis choisis le bon nombre. 5 manches.",
    init(G) { G.s.m = 0; avNouvelleManche(G); },
    maj(G, dt) { const S = G.s; S.tm += dt;
      if (S.ph === "defile") { if (S.tm > S.dur) { S.ph = "choix"; } }
      else if (S.ph === "rep" && S.tm > 1.1) { if (S.m >= 5) G.finir(); else avNouvelleManche(G); } },
    dessin(G, c) { const S = G.s; avFond(G, c); avNeige(G, c);
      if (S.ph === "defile") S.l.forEach(o => { const x = -40 + (S.tm - o.d) * o.v; if (x > -40 && x < G.W + 40) { if (o.lutin) avLutin(c, x, o.y, .9); else avRenne(c, x, o.y, 1.05, { pas: S.tm * 14 }); } });
      else { avTexte(c, S.ph === "rep" ? (S.bon ? "Bravo ! " : "Raté : ") + S.n + " renne" + (S.n > 1 ? "s" : "") : "Combien de rennes ?", 160, 120, 20);
        S.ch.forEach((v, i) => { const x = 60 + i * 100, y = 230, on = S.ph === "rep" && v === S.n;
          c.fillStyle = on ? "#2EC46B" : "rgba(255,255,255,.14)"; c.beginPath(); c.arc(x, y, 38, 0, 7); c.fill(); c.strokeStyle = "#F7CF55"; c.lineWidth = 2; c.stroke(); avTexte(c, String(v), x, y + 1, 30); }); }
      avTexte(c, "Manche " + Math.min(5, S.m) + " / 5", 160, 56, 13, "rgba(255,255,255,.85)"); },
    toucher(G, x, y, t) { const S = G.s; if (t !== "down" || S.ph !== "choix") return; const i = S.ch.findIndex((v, k) => Math.hypot(60 + k * 100 - x, 230 - y) < 44); if (i < 0) return;
      S.bon = S.ch[i] === S.n; if (S.bon) { G.score++; G.son("ok"); } else G.son("rate"); S.ph = "rep"; S.tm = 0; } },

  aurore: { nom: "Dessine ton aurore boréale", ico: "🌌", libre: true, aide: "Glisse le doigt dans le ciel : tu peins une aurore boréale qui ondule au-dessus des sapins. Pas de score, juste pour le plaisir.",
    init(G) { G.s.tr = []; G.s.h = 120; },
    maj() { },
    dessin(G, c) { const S = G.s; avFond(G, c); c.globalCompositeOperation = "lighter";
      S.tr.forEach(tr => { for (let i = 1; i < tr.length; i++) { const a = tr[i - 1], b = tr[i], o = reduit ? 0 : Math.sin(G.horloge * 1.6 + i * .25) * 3;
        c.strokeStyle = "hsla(" + b[2] + ",90%,60%,.16)"; c.lineWidth = 30; c.lineCap = "round"; c.beginPath(); c.moveTo(a[0], a[1] + o); c.lineTo(b[0], b[1] + o); c.stroke();
        c.strokeStyle = "hsla(" + b[2] + ",95%,70%,.5)"; c.lineWidth = 7; c.beginPath(); c.moveTo(a[0], a[1] + o); c.lineTo(b[0], b[1] + o); c.stroke(); } });
      c.globalCompositeOperation = "source-over";
      [[40, 352, 1.4], [92, 360, 1.1], [236, 356, 1.3], [290, 362, 1]].forEach(([x, y, s]) => avSapin(c, x, y, s)); avNeige(G, c); },
    toucher(G, x, y, t) { const S = G.s; if (t === "down") { S.tr.push([]); }
      if (t === "up" || !S.tr.length) return; S.h = (S.h + 2.2) % 360; S.tr[S.tr.length - 1].push([x, y, S.h]);
      let n = S.tr.reduce((a, z) => a + z.length, 0); while (n > 1400 && S.tr.length) { n -= S.tr[0].length; S.tr.shift(); } } },

  luge: { nom: "La descente en luge", ico: "🛝", unite: "m", aide: "Glisse le doigt à gauche et à droite pour éviter les sapins et les rochers. Va le plus loin possible !",
    init(G) { G.s.x = 160; G.s.c = 160; G.s.o = []; G.s.p = .6; G.s.d = 0; G.s.tr = []; },
    maj(G, dt) { const S = G.s, v = 150 + G.t * 9; S.d += v * dt; G.score = Math.floor(S.d / 10); S.x += (S.c - S.x) * Math.min(1, dt * 9); S.p -= dt;
      if (S.p <= 0) { S.o.push({ x: 20 + Math.random() * 280, y: G.H + 30, r: 16 + Math.random() * 6, roc: Math.random() < .3 }); S.p = Math.max(.32, .8 - G.t * .02); }
      S.o.forEach(o => o.y -= v * dt); S.o = S.o.filter(o => o.y > -40);
      S.tr.unshift([S.x, 100]); S.tr.forEach(p => p[1] -= v * dt); S.tr = S.tr.slice(0, 40);
      if (S.o.some(o => Math.hypot(o.x - S.x, o.y - 104) < o.r + 10)) { G.son("rate"); G.finir(); } },
    dessin(G, c) { const S = G.s; c.fillStyle = "#EEF6FF"; c.fillRect(0, 0, G.W, G.H);
      c.strokeStyle = "rgba(120,160,210,.45)"; c.lineWidth = 2; [-6, 6].forEach(dx => { c.beginPath(); S.tr.forEach((p, i) => i ? c.lineTo(p[0] + dx, p[1]) : c.moveTo(p[0] + dx, p[1])); c.stroke(); });
      S.o.forEach(o => { if (o.roc) { c.fillStyle = "#7D8794"; c.beginPath(); c.ellipse(o.x, o.y, o.r, o.r * .75, 0, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.ellipse(o.x - 3, o.y - o.r * .5, o.r * .7, o.r * .3, 0, 0, 7); c.fill(); } else avSapin(c, o.x, o.y + 10, o.r / 16); });
      c.save(); c.translate(S.x, 104); c.rotate(avBorne((S.c - S.x) / 120, -.5, .5));
      c.fillStyle = "#C1121F"; avRond(c, -12, -16, 24, 34, 6); c.fill(); c.strokeStyle = "#F7CF55"; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 20); c.lineTo(-10, -18); c.moveTo(10, 20); c.lineTo(10, -18); c.stroke();
      c.fillStyle = G.couleur || "#4C9AFF"; c.beginPath(); c.arc(0, 2, 8, 0, 7); c.fill(); c.restore(); avNeige(G, c); },
    toucher(G, x) { G.s.c = avBorne(x, 16, 304); } },

  gobelets: { nom: "Où est le cadeau ?", ico: "🎅", unite: "manches", aide: "Le cadeau se cache sous un bonnet, puis les bonnets se mélangent. Suis-le des yeux et touche le bon bonnet !",
    init(G) { G.s.r = 0; avNouveauMelange(G); },
    maj(G, dt) { const S = G.s; S.tm += dt;
      if (S.ph === "montre" && S.tm > 1.1) { S.ph = "melange"; S.tm = 0; S.k = 0; }
      else if (S.ph === "melange") { if (S.tm >= S.dur) { S.tm = 0; const [a, b] = S.sw[S.k]; [S.pos[a], S.pos[b]] = [S.pos[b], S.pos[a]]; S.k++; if (S.k >= S.sw.length) S.ph = "choix"; } }
      else if (S.ph === "rep" && S.tm > 1.1) { if (S.bon) { S.r++; avNouveauMelange(G); } else G.finir(); } },
    dessin(G, c) { const S = G.s, X = [70, 160, 250]; avFond(G, c); avNeige(G, c);
      c.fillStyle = "#6B4423"; c.fillRect(20, 268, 280, 12);
      [0, 1, 2].forEach(i => { let x = X[S.pos[i]], y = 250, lev = 0;
        if (S.ph === "melange" && S.k < S.sw.length && S.sw[S.k].includes(i)) { const [a, b] = S.sw[S.k], f = avBorne(S.tm / S.dur, 0, 1), de = X[S.pos[i]], vers = X[S.pos[i === a ? b : a]]; x = de + (vers - de) * f; y = 250 + Math.sin(f * Math.PI) * (i === a ? -28 : 28); }
        if ((S.ph === "montre") || (S.ph === "rep" && (i === S.cad || i === S.choix))) lev = 46;
        if (i === S.cad && lev) avCadeau(c, x, 254, 30, 26, "#2A9D8F");
        avBonnet(c, x, y - lev, .9, ["#C1121F", "#1F7A4C", "#3557A8"][i]); });
      avTexte(c, S.ph === "choix" ? "Où est le cadeau ?" : S.ph === "rep" ? (S.bon ? "Trouvé !" : "Raté…") : S.ph === "montre" ? "Regarde bien…" : "", 160, 120, 20);
      avTexte(c, "Manche " + (S.r + 1), 160, 56, 13, "rgba(255,255,255,.85)"); },
    toucher(G, x, y, t) { const S = G.s; if (t !== "down" || S.ph !== "choix") return; const X = [70, 160, 250], slot = X.findIndex(px => Math.abs(px - x) < 44); if (slot < 0 || y < 170 || y > 300) return;
      S.choix = S.pos.indexOf(slot); S.bon = S.choix === S.cad; if (S.bon) { G.score = S.r + 1; G.son("ok"); } else G.son("rate"); S.ph = "rep"; S.tm = 0; } },

  // v20.62 (Théo, 25/11) · 17e jeu, à la place de « Devine qui… » : trier les biscuits qui sortent du four (bonshommes à gauche, sapins à droite)
  biscuits: { nom: "Les biscuits du Père Noël", ico: "🍪", duree: 25, unite: "biscuits", aide: "Un biscuit sort du four : touche à gauche pour un bonhomme, à droite pour un sapin. Vite, ils tombent de plus en plus vite ! Une erreur coûte 1 biscuit.",
    init(G) { G.s.b = null; G.s.p = .4; G.s.flash = 0; G.s.ok = [0, 0]; },
    maj(G, dt) { const S = G.s; S.flash = Math.max(0, S.flash - dt);
      if (!S.b) { S.p -= dt; if (S.p <= 0) S.b = { x: 160, y: 92, k: Math.random() < .5 ? 0 : 1, c: null, a: (Math.random() - .5) * .5 }; return; }
      const b = S.b;
      if (b.c !== null) { b.x += ((b.c ? 250 : 70) - b.x) * Math.min(1, dt * 9); b.y += 420 * dt; b.a += dt * (b.c ? 4 : -4);
        if (b.y >= 318) { if (b.k === b.c) { G.score++; S.ok[b.c]++; G.son("pop"); avEclats(G, b.x, 322, b.k ? "#2E8B57" : "#D9A066"); } else { G.score = Math.max(0, G.score - 1); S.flash = .35; G.son("rate"); } S.b = null; S.p = .12; } }
      else { b.y += (95 + G.t * 7.5) * dt; b.a += dt * .6; if (b.y >= 318) { G.score = Math.max(0, G.score - 1); S.flash = .35; G.son("rate"); S.b = null; S.p = .2; } } },
    dessin(G, c, dt) { const S = G.s; avFond(G, c);
      // le four : briques, porte vitrée qui rougeoie
      c.fillStyle = "#7A3B2A"; avRond(c, 100, 40, 120, 62, 10); c.fill(); c.fillStyle = "#5A2A1C"; for (let i = 0; i < 4; i++) c.fillRect(104, 48 + i * 13, 112, 2);
      c.fillStyle = "#FF9A3A"; avRond(c, 124, 60, 72, 34, 6); c.fill(); c.fillStyle = "rgba(255,230,160,.6)"; avRond(c, 130, 64, 60, 12, 5); c.fill();
      // les deux assiettes, et ce qu'on y pose
      [[70, 0], [250, 1]].forEach(([x, k]) => { c.fillStyle = "rgba(255,255,255,.92)"; c.beginPath(); c.ellipse(x, 340, 58, 16, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#C9D6E6"; c.lineWidth = 2; c.beginPath(); c.ellipse(x, 340, 46, 11, 0, 0, Math.PI * 2); c.stroke();
        avBiscuit(c, x - (k ? 26 : 40), 378, .5, k, 0); avTexte(c, k ? "sapins" : "bonshommes", x - (k ? 14 : 28), 380, 12, "#7A3B2A", "left"); for (let i = 0; i < Math.min(5, S.ok[k]); i++) avBiscuit(c, x - 24 + i * 12, 334 - i * 2, .45, k, (i - 2) * .2); });
      c.setLineDash([5, 7]); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 2; c.beginPath(); c.moveTo(160, 120); c.lineTo(160, 390); c.stroke(); c.setLineDash([]);
      if (S.b) avBiscuit(c, S.b.x, S.b.y, 1, S.b.k, S.b.a);
      if (S.flash > 0) { c.fillStyle = "rgba(230,57,70," + (S.flash * .9).toFixed(2) + ")"; c.fillRect(0, 0, G.W, G.H); }
      avMajEclats(G, c, dt); },
    toucher(G, x, y, t) { if (t !== "down") return; const b = G.s.b; if (!b || b.c !== null) return; b.c = x < 160 ? 0 : 1; } },
  feux: { nom: "Le départ du traîneau", ico: "🚦", unite: "ms", bas: true, fmt: s => Math.round(s) + " ms", aide: "Cinq boules s'allument une à une. Dès qu'elles s'éteignent : touche ! Trois essais, ton meilleur temps compte. Pas de faux départ !",
    init(G) { G.s.es = []; avNouveauDepart(G); },
    maj(G, dt) { const S = G.s; S.tm += dt;
      if (S.ph === "feux") { const n = Math.min(5, Math.floor(S.tm / .7)); if (n > S.n) { S.n = n; G.son("feu"); } if (S.tm >= 3.5 + S.att) { S.ph = "go"; S.t0 = performance.now(); } }
      else if (S.ph === "pause" && S.tm > 1.2) { if (S.es.length >= 3) { G.score = Math.min(...S.es); G.finir(); } else avNouveauDepart(G); } },
    dessin(G, c) { const S = G.s; avFond(G, c); avNeige(G, c); c.fillStyle = "#1B1E25"; avRond(c, 20, 120, 280, 70, 14); c.fill();
      for (let i = 0; i < 5; i++) avBoule(c, 48 + i * 56, 158, 20, S.ph === "feux" && i < S.n ? "#FF2E3B" : "#3A3F4A", 0);
      avTexte(c, S.txt || "", 160, 250, 20); avTexte(c, "Essai " + Math.min(3, S.es.length + (S.ph === "pause" ? 0 : 1)) + " / 3", 160, 290, 14, "rgba(255,255,255,.8)");
      if (S.es.length) avTexte(c, S.es.map(v => Math.round(v) + " ms").join(" · "), 160, 320, 14, "#FFE596"); },
    toucher(G, x, y, t) { const S = G.s; if (t !== "down") return;
      if (S.ph === "feux") { S.txt = "Faux départ ! On recommence."; G.son("rate"); S.ph = "pause"; S.tm = 0; }
      else if (S.ph === "go") { const rt = performance.now() - S.t0;
        if (rt < 100) { S.txt = "Faux départ ! (trop tôt pour être humain)"; G.son("rate"); S.ph = "pause"; S.tm = 0; return; }   // v20.62 : sous 100 ms = faux départ, comme au serveur
        S.es.push(rt); S.txt = Math.round(rt) + " ms !"; G.son("go"); S.ph = "pause"; S.tm = 0; } } }
};
function avNouvelleGrille(G) { const S = G.s, n = S.n; S.d = Math.floor(Math.random() * n * n); S.v = [{ nezBrun: true }, { sansBois: true }, { clair: true }, { sens: true }][Math.floor(Math.random() * 4)]; }
function avNouvellesChaussettes(G) { const S = G.s, d = avMelange([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [0, 2], [2, 4], [1, 5], [3, 3]]).slice(0, 6);
  S.l = avMelange(d.concat(d).map(([c, m]) => ({ c, m, ok: false }))); S.sel = null; S.nv = 0; S.sh = 0; }
function avMaison(x) { return { x, h: 50 + Math.random() * 60, cx: 14 + Math.random() * 40, col: ["#3557A8", "#2A9D8F", "#8C5A2B", "#B5523B"][Math.floor(Math.random() * 4)] }; }
function avNouvelleManche(G) { const S = G.s; S.m++; const n = 3 + Math.floor(Math.random() * (4 + S.m)), lut = Math.floor(Math.random() * 3), v = 150 + S.m * 25;
  S.l = Array.from({ length: n }, () => ({ lutin: false })).concat(Array.from({ length: lut }, () => ({ lutin: true }))).map(o => Object.assign(o, { d: Math.random() * 1.8, v: v * (.85 + Math.random() * .3), y: 120 + Math.random() * 200 }));
  S.dur = 1.8 + (G.W + 80) / (v * .85); S.n = n; S.ph = "defile"; S.tm = 0;
  const f = new Set([n]); while (f.size < 3) { const z = n + Math.floor(Math.random() * 5) - 2; if (z > 0) f.add(z); } S.ch = avMelange([...f]); }
function avNouveauMelange(G) { const S = G.s; S.pos = [0, 1, 2]; S.cad = Math.floor(Math.random() * 3); S.ph = "montre"; S.tm = 0; S.dur = Math.max(.2, .5 - S.r * .05);
  S.sw = Array.from({ length: 4 + S.r * 2 }, () => { const a = Math.floor(Math.random() * 3); return [a, (a + 1 + Math.floor(Math.random() * 2)) % 3]; }); }
function avNouveauDepart(G) { const S = G.s; S.ph = "feux"; S.tm = 0; S.n = 0; S.att = .4 + Math.random() * 2.2; S.txt = "Attention…"; }

/* ---------- Le moteur : un canvas, une boucle, un score pour soi seul ---------- */
function jeuAvent(zone, id) {
  const J = JEUX_AVENT[id], W = 320, H = 400, dpr = Math.min(2, window.devicePixelRatio || 1);
  zone.innerHTML = '<div class="avj"><canvas class="avj-c" width="' + W * dpr + '" height="' + H * dpr + '" aria-label="' + esc(J.nom) + '"></canvas>' +
    '<div class="avj-voile"><span class="avj-ico" aria-hidden="true">' + J.ico + "</span><p>" + esc(J.aide) + '</p><p class="avj-rec"></p><button class="btn acc" type="button" data-avj="go">▶ ' + (J.libre ? "Dessiner" : "Jouer") + "</button></div></div>" +
    (J.libre ? '<button class="btn ghost avj-eff" type="button" data-avj="eff">🧽 Tout effacer</button>' : "");
  const cv = zone.querySelector("canvas"), ctx = cv.getContext("2d"), voile = zone.querySelector(".avj-voile");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let G = null, raf = 0, last = 0, vivant = true, appui = false;
  const fmt = v => avFmt(J, v);
  const majRecord = () => { const r = recordsAvent()[id]; voile.querySelector(".avj-rec").textContent = !J.libre && r !== undefined ? "🏅 Ton record : " + fmt(r) : ""; };
  function nouveau(enJeu) {
    G = { W, H, t: 0, horloge: G ? G.horloge : 0, score: 0, fin: false, enJeu, s: {}, msg: "", couleur: (() => { try { return couleur(moiVrai()); } catch (e) { return "#4C9AFF"; } })(),
      son: (k, i) => { if (G && G.enJeu) sonAvent(k, i); }, finir: () => terminer() };
    J.init(G);
  }
  function terminer() {
    if (!G || G.fin) return; G.fin = true; G.enJeu = false;
    const R = recordsAvent(), av = R[id], sc = J.libre ? G.score : avArrondi(id, G.score), valide = J.libre || scoreValide(id, sc), fige = aventFige() && !aventApercu();   // Avent 26/11 : arrondi comme le serveur
    const mieux = !fige && valide && (av === undefined || (J.bas ? sc < av : sc > av));
    if (!valide) G.msg = "Score hors des limites du jeu : il ne compte pas.";
    if (mieux && !aventApercu()) { R[id] = sc; stock.set("versus.aventRecords", JSON.stringify(R)); mettreEnFileAvent(id, R[id]); majClassementsAvent(); }
    sonAvent("fin");
    voile.innerHTML = '<span class="avj-ico" aria-hidden="true">' + (mieux ? "🏅" : J.ico) + "</span><b>" + esc(fmt(G.score)) + "</b>" + (G.msg ? "<p>" + esc(G.msg) + "</p>" : "") +
      '<p class="avj-rec">' + (fige ? "🔒 Classement figé le 24 décembre à 23 h 59 : ce score est pour le plaisir." + (av !== undefined ? " Ton record : " + esc(fmt(av)) : "") : mieux ? (av === undefined ? "Premier score : c'est ton record !" : "Nouveau record ! Il compte au classement.") : av !== undefined ? "🏅 Ton record : " + esc(fmt(av)) : "") + '</p><button class="btn acc" type="button" data-avj="go">🔁 Rejouer</button>';
    voile.hidden = false; brancherGo();
  }
  function brancherGo() { const b = voile.querySelector('[data-avj="go"]'); if (b) b.addEventListener("click", ev => { ev.stopPropagation(); nouveau(true); voile.hidden = true; last = 0; }); }
  function boucle(ts) {
    if (!vivant || !cv.isConnected) { vivant = false; return; }   // Avent 26/11 : la case a été retirée, la boucle s'arrête (jamais de jeu fantôme)
    raf = requestAnimationFrame(boucle);
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts;
    try {
      G.horloge += dt;
      if (G.enJeu && !G.fin) { G.t += dt; if (J.duree && G.t >= J.duree) { G.t = J.duree; terminer(); } else J.maj(G, dt); }
      ctx.clearRect(0, 0, W, H); AV_MUET = !G.enJeu; try { J.dessin(G, ctx, dt); } finally { AV_MUET = false; }
      if (G.enJeu && !J.libre) {   // le tableau de bord : score (ou chrono) à gauche, temps restant en barre
        ctx.fillStyle = "rgba(0,0,0,.45)"; avRond(ctx, 8, 8, 128, 28, 14); ctx.fill();
        avTexte(ctx, J.chrono ? fmt(G.t) : fmt(G.score), 20, 22, 15, "#fff", "left");
        if (J.duree) { ctx.fillStyle = "rgba(255,255,255,.25)"; avRond(ctx, 150, 17, 160, 10, 5); ctx.fill(); ctx.fillStyle = G.t > J.duree - 5 ? "#FF5C6C" : "#F7CF55"; avRond(ctx, 150, 17, Math.max(10, 160 * (1 - G.t / J.duree)), 10, 5); ctx.fill(); }
      }
    } catch (e) { vivant = false; console.error(e); }
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  const envoyer = (e, t) => { if (!G || !G.enJeu || G.fin || !J.toucher) return; const p = pos(e); try { J.toucher(G, p.x, p.y, t); } catch (er) { console.error(er); } };
  cv.addEventListener("pointerdown", e => { e.preventDefault(); appui = true; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* rien */ } envoyer(e, "down"); });
  cv.addEventListener("pointermove", e => { if (appui || (e.pointerType === "mouse" && !J.libre)) envoyer(e, "move"); });
  const lacher = e => { if (!appui) return; appui = false; envoyer(e, "up"); };
  cv.addEventListener("pointerup", lacher); cv.addEventListener("pointercancel", lacher);
  const eff = zone.querySelector('[data-avj="eff"]'); if (eff) eff.addEventListener("click", () => { if (G) { G.s.tr = []; } });
  nouveau(false); majRecord(); brancherGo(); raf = requestAnimationFrame(boucle);
  return { stop() { vivant = false; cancelAnimationFrame(raf); }, demarrer() { nouveau(true); voile.hidden = true; }, etat: () => G };
}

/* ---------- Les 24 cases ---------- */
/* surprises : texte seul, ou une petite scène animée (traîneau). Aucun mot sur ce qui arrive, aucun chiffre sur les joueurs. */
const CASES_AVENT = {
  1: { type: "scene", ico: "🛷", titre: "Bienvenue dans le calendrier !", texte: "Le traîneau vient de décoller de l'Atelier du Père Noël. Chaque jour jusqu'au 24, une case s'ouvre : des petits jeux de Noël, des surprises… et un cadeau le 24 pour chaque pilote.\n\nUne case par jour : à ouvrir le jour même, sinon elle est perdue ❄️\n\n🏅 Ouvre les 24 cases, chacune le jour même : la plaque Hiver 2026 dorée t'attend le 24. Rien ne compte au championnat, tout est pour le plaisir.\n\n🏆 Chaque jeu a son classement en direct : une fois sa case ouverte (le jour même), rejoue autant que tu veux jusqu'au 24 décembre à 23 h 59. 🎅 Le roi des jeux de Noël (le plus de 1res places) gagne pour toujours : la plaque Roi de Noël 2026, la couronne de houx et la livrée « Roi de Noël »." },
  2: { type: "jeu", jeu: "cadeaux" }, 3: { type: "jeu", jeu: "renne" }, 4: { type: "jeu", jeu: "pile" },
  5: { type: "texte", ico: "😄", titre: "La blague du paddock", texte: "Pourquoi le traîneau du Père Noël ne prend-il jamais de pénalité ?\n\n… Parce qu'il ne dépasse personne : il survole tout le monde !" },
  6: { type: "jeu", jeu: "boules" }, 7: { type: "jeu", jeu: "memory" }, 8: { type: "jeu", jeu: "cheminees" },
  9: { type: "texte", ico: "🔧", titre: "Les potins de l'Atelier", texte: "À l'Atelier du Père Noël, les lutins mécaniciens ont un secret de fabrication : ils changent les quatre roues d'un traîneau en moins de temps qu'il n'en faut pour emballer une chaussette.\n\nOn raconte même qu'un renne a déjà tenté de doubler par l'intérieur dans le dernier virage. Il a fini dans un tas de rubans." },
  10: { type: "jeu", jeu: "flocons" }, 11: { type: "jeu", jeu: "chaussettes" }, 12: { type: "jeu", jeu: "bonshommes" },
  13: { type: "compte", ico: "⏳", titre: "Le compte à rebours", texte: "Le 20 décembre, une annonce t'attend dans l'appli. Les lutins gardent l'enveloppe sous clé d'ici là : pas la peine de les chatouiller." },
  14: { type: "jeu", jeu: "guirlande" }, 15: { type: "jeu", jeu: "livraison" },
  16: { type: "jeu", jeu: "biscuits" },   // v20.62 (Théo) : un 17e vrai jeu à la place de « Devine qui… »
  17: { type: "jeu", jeu: "rennes" }, 18: { type: "jeu", jeu: "aurore" }, 19: { type: "jeu", jeu: "luge" },
  20: { type: "annonce", ico: "📣", titre: "L'annonce est arrivée !", texte: "Aujourd'hui, c'est le grand jour : l'annonce t'attend dans l'onglet Podium. Va la voir !" },
  21: { type: "jeu", jeu: "gobelets" },
  22: { type: "texte", ico: "🦌", titre: "La blague des rennes", texte: "Que dit un renne qui a fini dernier de la course de Noël ?\n\n… « L'an prochain, je mets le nez rouge devant ! »" },
  23: { type: "jeu", jeu: "feux" },
  24: { type: "cadeau", ico: "🎁", titre: "Joyeux Noël !", texte: "Un souvenir pour chaque pilote du tour de chauffe : la plaque « Hiver 2026 » et la traînée « Flocons ». Ils sont à toi dès aujourd'hui, à poser sur ta voiture. Merci d'avoir roulé ce premier mois ensemble !" }
};
/* l'ordre des portes sur le calendrier (mélangé, comme un vrai calendrier) */
const ORDRE_AVENT = [7, 15, 1, 20, 11, 4, 18, 23, 9, 2, 13, 22, 5, 17, 10, 24, 3, 14, 8, 19, 12, 6, 21, 16];
function icoCase(n) { const c = CASES_AVENT[n]; return c.type === "jeu" ? JEUX_AVENT[c.jeu].ico : c.ico; }
function titreCase(n) { const c = CASES_AVENT[n]; return c.type === "jeu" ? JEUX_AVENT[c.jeu].nom : c.titre; }

/* ---------- v20.80 · Habillage (maquette du directeur artistique validée par Théo le 26/11) : des CSS et des SVG fixes, aucune image à charger ----------
   Chaque case est un vrai paquet cadeau (papier à motif, ruban doré, nœud, étiquette) ; la carte d'une case a un en-tête illustré et un sceau doré. */
const AV_PAPIERS = ["rouge", "vert", "bleu", "rouge", "violet", "vert", "bleu", "rouge", "vert", "violet", "bleu", "rouge"];
const AV_NOEUD = '<svg class="av-noeud" viewBox="0 0 38 22" aria-hidden="true"><path d="M19 12 C8 -2 0 6 6 12 C10 16 16 13 19 12Z M19 12 C30 -2 38 6 32 12 C28 16 22 13 19 12Z" fill="#FFD86B" stroke="#A87818"/><path d="M17 13 l-6 9 M21 13 l6 9" stroke="#D9A93A" stroke-width="3"/><circle cx="19" cy="12" r="4" fill="#E9B43C" stroke="#A87818"/></svg>';
const AV_GUIRLANDE = '<svg class="av-guirlande" viewBox="0 0 340 34" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6 Q42 30 85 8 T170 8 T255 8 T340 6" fill="none" stroke="#1E5A36" stroke-width="3"/>' +
  [[20, 16, "#FF5A6E"], [48, 22, "#FFE596"], [76, 12, "#5BC8FF"], [106, 16, "#3DDC97"], [134, 22, "#FF5A6E"], [160, 11, "#FFE596"], [190, 16, "#5BC8FF"], [218, 22, "#3DDC97"], [246, 11, "#FF5A6E"], [276, 16, "#FFE596"], [304, 22, "#5BC8FF"], [330, 11, "#3DDC97"]]
    .map(([x, y, c]) => '<circle cx="' + x + '" cy="' + y + '" r="8" fill="' + c + '" opacity=".22"/><circle cx="' + x + '" cy="' + y + '" r="4.5" fill="' + c + '"/>').join("") + "</svg>";
const AV_PAYSAGE = '<svg class="av-paysage" viewBox="0 0 390 190" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 Q90 80 190 115 T390 100 V190 H0Z" fill="#14244D" opacity=".9"/>' +
  '<g fill="#0C1836"><path d="M30 118 l12 -34 l12 34z"/><path d="M60 122 l9 -26 l9 26z"/><path d="M318 108 l13 -38 l13 38z"/><path d="M350 112 l9 -24 l9 24z"/></g>' +
  '<path d="M0 150 Q110 118 220 148 T390 140 V190 H0Z" fill="#DCE8FF"/><path d="M0 150 Q110 118 220 148 T390 140" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>' +
  '<circle cx="267" cy="136" r="18" fill="#FFC85A" opacity=".16"/><rect x="250" y="128" width="34" height="22" fill="#3A2416"/><path d="M246 130 l21 -16 l21 16z" fill="#F2F6FF"/><rect x="258" y="134" width="8" height="8" fill="#FFC85A"/><rect x="270" y="134" width="8" height="8" fill="#FFC85A"/></svg>';
const AV_LEGENDE = '<div class="av-legende" aria-hidden="true"><span><i class="lg-jour"></i>aujourd\'hui</span><span><i class="lg-vue"></i>ouverte</span><span><i class="lg-man"></i>manquée</span><span><i class="lg-ferme"></i>pas encore</span></div>';
/** l'intérieur d'une case : paquet fermé (ruban, nœud, étiquette), ou boîte ouverte (couvercle de travers, icône qui brille) */
function htmlPaquet(n, cls) {
  const tag = '<span class="av-tag">' + n + "</span>";
  if (cls === "vue") return '<i class="av-couv"></i><i class="av-lueur"></i><span class="av-ico" aria-hidden="true">' + icoCase(n) + "</span>" + tag;
  return '<i class="av-rv"></i><i class="av-rh"></i>' + AV_NOEUD + tag + (cls === "jour" ? '<span class="av-lum" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i></span><span class="av-auj">Aujourd\'hui</span>' : "") +
    (cls === "manquee" ? '<span class="av-man">❄️ Manquée</span>' : "");
}
/** l'icône de l'entrée du Classement : un paquet rouge et or, le jour sur l'étiquette, le nœud qui frétille tant que la case du jour attend */
function svgPaquetEntree(jd) {
  return '<svg viewBox="0 0 36 36"><rect x="4" y="12" width="28" height="21" rx="4" fill="#C1121F"/><rect x="4" y="12" width="28" height="21" rx="4" fill="url(#av-ent-r)" opacity=".5"/><rect x="16" y="12" width="4.5" height="21" fill="#F7CF55"/><rect x="4" y="19" width="28" height="4" fill="#F7CF55"/>' +
    '<defs><pattern id="av-ent-r" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="#FF6B7A"/></pattern></defs>' +
    '<g class="av-ent-noeud"><path d="M18.2 12 C10 2 3 7 8 11.5 C11 14 16 12.6 18.2 12Z M18.2 12 C26 2 33 7 28.4 11.5 C25.4 14 20.4 12.6 18.2 12Z" fill="#FFD86B" stroke="#A87818" stroke-width=".8"/><circle cx="18.2" cy="12" r="2.8" fill="#E9B43C" stroke="#A87818" stroke-width=".8"/></g>' +
    '<g transform="rotate(-8 10 28)"><rect x="5" y="24" width="12" height="8.5" rx="2" fill="#FFFDF5"/><text x="11" y="30.7" text-anchor="middle" font-size="7.4" font-weight="800" fill="#6B1420">' + jd + "</text></g></svg>";
}
/** la petite ligne au-dessus du titre de la carte */
function kickerCase(c) { return c.type === "jeu" ? "🎮 Jeu de Noël" : c.type === "cadeau" ? "🎄 Le cadeau de Noël" : c.type === "annonce" ? "📣 Grand jour" : c.type === "scene" ? "🛷 Premier jour" : "🎁 Surprise"; }
/** l'en-tête illustré de la carte (ciel, aurore, lune, traîneau, sapins, guirlande) et son sceau doré « 5 DÉC. » ; le 24 : grand sceau et rayons dorés */
function htmlEnteteCase(n) {
  return '<div class="av-entete"><svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="av-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1640"/><stop offset="1" stop-color="#2B4A8F"/></linearGradient>' +
    '<radialGradient id="av-lune"><stop offset="0" stop-color="#FFF8DC"/><stop offset="1" stop-color="#FFF8DC" stop-opacity="0"/></radialGradient></defs><rect width="360" height="150" fill="url(#av-ciel)"/>' +
    '<path d="M0 40 Q120 10 240 50 T360 30 V70 Q240 40 120 70 T0 60Z" fill="#3DDC97" opacity=".14"/><circle cx="296" cy="40" r="30" fill="url(#av-lune)" opacity=".5"/><circle cx="296" cy="40" r="13" fill="#FFF3C4"/>' +
    '<g fill="#fff"><circle cx="30" cy="26" r="1.2"/><circle cx="80" cy="44" r="1"/><circle cx="140" cy="22" r="1.4"/><circle cx="200" cy="34" r="1"/><circle cx="250" cy="20" r="1.2"/><circle cx="340" cy="64" r="1"/></g>' +
    '<g transform="translate(70 58) rotate(-8)"><path d="M0 10 h34 q8 0 8 -8" fill="none" stroke="#F7CF55" stroke-width="2"/><path d="M4 0 h24 l-4 9 h-18z" fill="#E23A4E"/><path d="M-60 6 q20 -4 56 0" stroke="#FFE596" stroke-width="1.5" stroke-dasharray="1 5" stroke-linecap="round" fill="none"/></g>' +
    '<path d="M0 110 Q90 86 180 108 T360 100 V150 H0Z" fill="#1B3570"/><g fill="#10224D"><path d="M24 112 l14 -40 l14 40z"/><path d="M56 116 l10 -28 l10 28z"/><path d="M300 106 l15 -44 l15 44z"/><path d="M332 110 l10 -26 l10 26z"/></g>' +
    '<path d="M0 130 Q100 112 200 130 T360 124 V150 H0Z" fill="#E6EFFF"/><path d="M0 4 Q45 22 90 6 T180 6 T270 6 T360 4" fill="none" stroke="#1E5A36" stroke-width="2.5"/>' +
    [[22, "#FF5A6E"], [66, "#FFE596"], [112, "#5BC8FF"], [156, "#3DDC97"], [204, "#FF5A6E"], [246, "#FFE596"], [292, "#5BC8FF"], [336, "#3DDC97"]].map(([x, c]) => '<circle cx="' + x + '" cy="12.5" r="3.5" fill="' + c + '"/>').join("") +
    "</svg>" + (n === 24 ? '<span class="av-r24" aria-hidden="true"><span class="cbo-rayons"></span></span>' : "") + '<button class="av-x" type="button" aria-label="Fermer">✕</button>' +
    '<span class="av-sceau" aria-hidden="true"><b>' + n + "</b><small>DÉC.</small></span></div>";
}
/** 24 points : les cases ouvertes (or), manquées (givre), celle-ci (entourée) */
function htmlSerieAvent(n) {
  if (aventApercu()) return "";
  const l = aventOuvertes();
  const t = l.length + (l.length > 1 ? " cases ouvertes" : " case ouverte") + " sur 24";
  return '<div class="av-serie" aria-hidden="true">' + Array.from({ length: 24 }, (_, i) => '<i class="' + [l.includes(i + 1) ? "v" : caseManquee(i + 1) ? "m" : "", i + 1 === n ? "c" : ""].join(" ").trim() + '"></i>').join("") + '</div><small class="av-serie-t">' + t + "</small>";
}

/* ---------- L'entrée (haut du Classement, décembre 2026 seulement) ---------- */
/** Avent 26/11 (Théo, 26/11) · l'entrée du calendrier et la course au roi vivent dans l'onglet PODIUM ; le Classement garde une petite ligne de rappel qui y renvoie */
function poserAventEntree() {
  poserRappelAvent();
  try {
    const v = document.querySelector("#v-trophees"); if (!v) return;
    let el = v.querySelector(":scope > .av-entree");
    chargerDoresAvent();   // 🏅 la plaque dorée, pour toujours : la liste du serveur (dès le 24/12/2026)
    if (!aventPeriode() || typeof D === "undefined" || !D) { if (el) el.remove(); v.querySelectorAll(":scope > .av-roicarte").forEach(x => x.remove()); return; }
    const j = aventJour(), jd = aventJourDec(), fait = !j || aventOuvertes().includes(j), noel = !j || (j === 24 && fait), cpt = texteCompteAvent();
    const html = '<span class="av-cal" aria-hidden="true">' + svgPaquetEntree(jd) + (fait ? "" : '<i class="av-pas"></i>') + "</span>" +
      '<span class="rp-t"><span class="av-l1"><b>🎄 Calendrier de l\'Avent</b>' + (noel ? (aventOuvertes().includes(24) ? "joyeux Noël !" : "joyeux Noël ! ton souvenir t'attend dans l'écurie") : fait ? "case du jour ouverte, reviens demain" : "la case du " + j + " t'attend, aujourd'hui seulement") + "</span>" +
      (j && !noel ? "<small>" + esc(AV_REGLE) + "</small>" : "") + (j && !noel && !aventCompte().perdue && !aventCompte().toutes ? "<small>" + esc(AV_DOREE) + "</small>" : "") + (cpt ? '<small class="av-cpt' + (aventCompte().perdue ? " perdue" : "") + '">' + esc(cpt) + "</small>" : "") + '</span><span class="rp-f" aria-hidden="true">›</span>';
    if (!el) { v.insertAdjacentHTML("afterbegin", '<button type="button" class="av-entree"></button>'); el = v.querySelector(":scope > .av-entree"); el.addEventListener("click", () => ouvrirAvent()); }
    if (!AVENT_SRV_T && SOURCE === "api") setTimeout(() => chargerAvent(), 2500);   // au démarrage : la file d'attente des records repart, en silence
    else if (SOURCE === "api") chargerAvent(30000);   // Avent 26/11 : à chaque retour sur le Podium, la course au roi se relit (au plus toutes les 30 s)
    majPastillesAvent(); poserCourseRoi(v, el);   // 🎄 Avent 26/11 : la course au roi de Noël, juste sous l'entrée
    el.innerHTML = html; el.classList.toggle("a-ouvrir", !fait); el.setAttribute("aria-label", "Calendrier de l'Avent" + (fait ? "" : " : la case du " + j + " décembre t'attend, à ouvrir aujourd'hui sinon elle est perdue") + (cpt ? ". " + cpt : ""));
  } catch (e) { /* jamais bloquant */ }
}
/** la ligne de rappel du Classement (une seule ligne) : ce qui attend, et où */
function poserRappelAvent() {
  try { const v = document.querySelector("#v-classement"); if (!v) return; let r = v.querySelector(":scope > .av-rappel");
    if (!aventPeriode() || typeof D === "undefined" || !D) { if (r) r.remove(); return; }
    const j = aventJour(), t = aventCaseAttend() ? "🎁 La case du " + j + " t'attend dans Podium" : "🎄 Calendrier de l'Avent et course au roi : dans Podium";
    if (!r) { v.insertAdjacentHTML("afterbegin", '<button type="button" class="av-rappel"></button>'); r = v.querySelector(":scope > .av-rappel"); r.addEventListener("click", () => { try { allerA("trophees"); } catch (e) { } }); }
    const h = esc(t) + ' <span aria-hidden="true">›</span>'; if (r.innerHTML !== h) r.innerHTML = h; r.setAttribute("aria-label", t + " : aller au Podium");
  } catch (e) { /* jamais bloquant */ }
}
/* ---------- Avent 26/11 (Théo, 26/11) · du 1er au 24/12 : le calendrier s'ouvre tout seul une fois par jour, et une pastille 🎁 tant que la case du jour attend ---------- */
/** la case du jour attend-elle (période, pas d'aperçu admin, pas de date simulée) ? */
function aventCaseAttend() { try { const j = aventJour(); return !!j && aventPeriode() && !aventApercu() && !simulation() && !aventOuvertes().includes(j); } catch (e) { return false; } }
/** la pastille 🎁 sur l'onglet Podium (où vit le calendrier) tant que la case du jour attend */
function majPastillesAvent() {
  try { const a = aventCaseAttend();
    ["trophees"].forEach(v => { const b = document.querySelector('.tabbar .onglet[data-vue="' + v + '"]'); if (!b) return; const p = b.querySelector(".pastille-av");
      if (a && !p) b.insertAdjacentHTML("beforeend", '<i class="pastille-av" aria-hidden="true">🎁</i>'); else if (!a && p) p.remove(); });
  } catch (e) { /* jamais bloquant */ }
}
/** une fois par jour (date de Paris, celle du serveur dès qu'il a répondu), à la première vue de l'appli, quel que soit l'onglet : le calendrier sur le paquet du jour.
 *  Rien hors connexion, en aperçu admin ou en date simulée ; rien avant le 1/12 ni après le 24/12. Les robots de test (navigator.webdriver) ne l'ont que s'ils le demandent
 *  (versus.aventAutoTest), pour ne pas gêner les autres tests. */
let AV_AUTO = false;
function aventAutoOuvrir() {
  try {
    if (typeof D === "undefined" || !D || SOURCE !== "api" || !aventCaseAttend() || document.querySelector(".av-ov, .av-case")) return;
    if (navigator.webdriver && stock.get("versus.aventAutoTest") !== "1") return;
    const auj = String(aventNum()); if (stock.get("versus.aventAuto") === auj) return;
    stock.set("versus.aventAuto", auj); AV_AUTO = true;
    ouvrirAvent();   // si une annonce est ouverte, le calendrier attend sa fermeture (ouvrirAvent), puis se place sur le paquet du jour
  } catch (e) { /* jamais bloquant */ }
}
if (typeof window.rendreTrophees === "function") { const f0 = window.rendreTrophees; window.rendreTrophees = function () { const r = f0.apply(this, arguments); poserAventEntree(); return r; }; }
if (typeof window.rendreVue === "function") { const f0 = window.rendreVue; window.rendreVue = function () { const r = f0.apply(this, arguments); majPastillesAvent(); setTimeout(aventAutoOuvrir, 0); return r; }; }
if (typeof window.rendreClassement === "function") { const f0 = window.rendreClassement; window.rendreClassement = function () { const r = f0.apply(this, arguments); poserAventEntree(); return r; }; }

/* ---------- 🎄 Avent 26/11 (Théo, 26/11) · la COURSE AU ROI DE NOËL : le classement général des jeux, en direct, en haut du Classement en décembre 2026 ----------
   Les pilotes classés par 1res places (⭐), puis 2es places, puis l'ordre du serveur (le premier à avoir atteint son dernier record). Seulement des places
   et des nombres de jeux, jamais un score d'argent. Un toucher : qui mène chaque jeu. Le 25 : le résultat final et le roi. */
const AV_JEUX_CLASSES = Object.keys(AV_BORNES);   // les 16 jeux à score (le dessin de l'aurore n'a pas de classement)
/** ce que gagne tout le monde ; avant le 24, le cadeau du 24 reste une surprise (relecture jeu-joueur) */
function avPourTous() { return "Pour tous : " + (aventNum() < 20261224 ? "un cadeau le 24" : "le souvenir du 24 (plaque Hiver 2026 + traînée Flocons)") + ", la plaque dorée si 24/24, une ⭐ par jeu gagné"; }
function courseRoiAvent() {
  let noms = []; try { noms = D.personnes.map(p => p.nom); } catch (e) { }
  const S = AVENT_SRV, ordre = S && Array.isArray(S.roi) ? S.roi.map(x => x && x.nom) : [], t = {};
  const ligne = n => t[n] = t[n] || { nom: n, or: 0, argent: 0, bronze: 0, jeux: 0 };
  noms.forEach(ligne);
  AV_JEUX_CLASSES.forEach(jeu => classementJeuAvent(jeu).forEach((x, k) => { const o = ligne(x.nom); o.jeux++; if (k === 0) o.or++; else if (k === 1) o.argent++; else if (k === 2) o.bronze++; }));
  const rg = n => { const i = ordre.indexOf(n); return i < 0 ? 99 : i; };
  return Object.values(t).sort((a, b) => b.or - a.or || b.argent - a.argent || (b.jeux ? 1 : 0) - (a.jeux ? 1 : 0) || rg(a.nom) - rg(b.nom) || noms.indexOf(a.nom) - noms.indexOf(b.nom));
}
const REGLE_ROI = '<small class="avr-regle">Le roi : le plus de ⭐ (1res places), à égalité le plus de 2es places · seuls les jeux des cases ouvertes le jour même comptent</small>';
function htmlCourseRoi() {
  const l = courseRoiAvent(), fige = aventFige(), MED = ["🥇", "🥈", "🥉"]; let moi = ""; try { moi = moiVrai() || ""; } catch (e) { }
  const roi = fige ? aventRoiNoel() || (l[0] && l[0].or ? l[0].nom : null) : null, i = l.findIndex(x => x.nom === moi), n = AV_JEUX_CLASSES.length;
  const tete = fige ? '<span class="avr-h"><b>🎅 Roi des jeux de Noël 2026' + (roi ? " : " + esc(roi) : "") + "</b><small>résultat final · figé le 24 décembre à 23 h 59</small></span>" + REGLE_ROI
    : '<span class="avr-h"><b>🎄 Course au roi de Noël</b><small>en direct · ' + n + " jeux classés · tout se fige le 24 décembre à 23 h 59</small></span>" + REGLE_ROI;
  const L = '<ol class="avr-l">' + l.map((x, k) => '<li class="' + (x.nom === moi ? "moi" : "") + (x.jeux ? "" : " zero") + '"><span class="avr-p">' + (x.jeux ? MED[k] || k + 1 + "e" : "–") + '</span><span class="avr-n">' + esc(x.nom) + (x.nom === moi ? " <small>(toi)</small>" : "") + (fige && x.nom === roi ? " 👑" : "") + '</span><span class="avr-s"><b>⭐ ' + x.or + "</b> · 2es : " + x.argent + '</span><small class="avr-j">' + x.jeux + "/" + n + " jeux</small></li>").join("") + "</ol>";
  const rang = i >= 0 && l[i].jeux ? '<span class="avr-rang">' + (fige ? "Ton rang final" : "Ton rang") + " : <b>" + (i ? i + 1 + "e" : "1er") + "</b> sur " + l.length + " · " + l[i].jeux + " jeu" + (l[i].jeux > 1 ? "x" : "") + " sur " + n + " joué" + (l[i].jeux > 1 ? "s" : "") + "</span>"
    : i >= 0 && !fige ? '<span class="avr-rang">Joue à un jeu d\'une case que tu as ouverte pour entrer dans la course</span>' : "";
  const gain = '<small class="avr-gain">' + esc(fige ? (roi ? "🎅 " + roi + " gagne pour toujours : plaque Roi de Noël 2026, couronne de houx, la livrée « Roi de Noël ». " : "") + avPourTous() : AV_ROI + " · " + avPourTous()) + "</small>";
  return tete + L + rang + gain + '<span class="avr-voir">Qui mène chaque jeu ›</span>';
}
function poserCourseRoi(v, entree) {
  try { let c = v.querySelector(":scope > .av-roicarte");
    if (!c) { entree.insertAdjacentHTML("afterend", '<button type="button" class="av-roicarte" aria-label="Course au roi de Noël : le détail jeu par jeu"></button>'); c = v.querySelector(":scope > .av-roicarte"); c.addEventListener("click", () => ouvrirDetailRoi()); }
    const h = htmlCourseRoi(); if (c.innerHTML !== h) c.innerHTML = h; c.classList.toggle("fige", aventFige());
  } catch (e) { /* jamais bloquant */ }
}
/** le détail : pour chaque jeu, qui mène (et ta place) */
function ouvrirDetailRoi() {
  document.querySelectorAll(".av-roid").forEach(x => x.remove());
  let moi = ""; try { moi = moiVrai() || ""; } catch (e) { }
  const o = document.createElement("div"); o.className = "av-case av-roid"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Course au roi de Noël, jeu par jeu");
  const jd = aventFige() ? 24 : aventJourDec(), caseDe = jeu => +Object.keys(CASES_AVENT).find(n => CASES_AVENT[n].jeu === jeu);
  const vus = AV_JEUX_CLASSES.filter(jeu => caseDe(jeu) <= jd), caches = AV_JEUX_CLASSES.length - vus.length;   // secret : un jeu dont la case n'est pas encore arrivée reste caché
  const L = vus.map(jeu => { const J = JEUX_AVENT[jeu], c = classementJeuAvent(jeu), k = c.findIndex(x => x.nom === moi), cj = caseDe(jeu);
    return '<li><span class="avd-j">' + J.ico + " " + esc(J.nom) + "<small>case du " + cj + (caseManquee(cj) ? " · ❄️ case manquée" : "") + "</small></span><b>" + (c.length ? "🥇 " + esc(c[0].nom) + " · " + esc(avFmt(J, c[0].score)) : "personne") + "</b>" + (k > 0 ? "<small>toi : " + (k + 1) + "e</small>" : "") + "</li>"; }).join("") +
    (caches ? '<li class="avd-cache"><span class="avd-j">🎁 ' + caches + " jeu" + (caches > 1 ? "x" : "") + " encore caché" + (caches > 1 ? "s" : "") + "<small>ils arrivent dans les prochaines cases</small></span><b></b></li>" : "");
  o.innerHTML = neigeAvent(18) + '<div class="av-carte"><div class="av-corps avd"><button class="av-x" type="button" aria-label="Fermer">✕</button><span class="av-k">' + (aventFige() ? "🎅 Résultat final" : "🎄 En direct") + "</span><h3>Qui mène chaque jeu</h3>" +
    '<ul class="avd-l">' + L + '</ul><p class="av-roi-r">' + esc(AV_ROI) + "</p>" + '<div class="btn-row"><button class="btn ghost" type="button" data-av-fermer>Fermer</button></div></div></div>';
  document.body.appendChild(o); avToastDessus();
  const fermer = () => { o.remove(); avToastDessus(); };
  o.addEventListener("click", e => { if (e.target === o) fermer(); }); o.querySelector(".av-x").addEventListener("click", fermer); o.querySelector("[data-av-fermer]").addEventListener("click", fermer);
  chargerAvent(15000);
}

/* ---------- Le calendrier ---------- */
function neigeAvent(n) { if (reduit) return ""; let h = 7; const r = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
  return '<div class="av-neige" aria-hidden="true">' + Array.from({ length: n }, () => '<i style="--x:' + (r() * 100).toFixed(1) + "%;--d:" + (r() * 8).toFixed(2) + "s;--t:" + (6 + r() * 6).toFixed(2) + "s;--s:" + (2 + r() * 4).toFixed(1) + 'px"></i>').join("") + "</div>"; }
let AV_PAUSE_GP = false;   // Avent 26/11 : la course du Podium mise en pause par le calendrier (et par lui seul)
function ouvrirAvent() {
  if (!aventPeriode() && !aventApercu()) return;
  { const autre = () => document.querySelector(".tuto");   // une seule fenêtre à la fois : une annonce déjà ouverte passe d'abord, le calendrier s'ouvre à sa fermeture
    if (autre()) { const mo = new MutationObserver(() => { if (!autre()) { mo.disconnect(); ouvrirAvent(); } }); mo.observe(document.body, { childList: true }); return; } }
  document.querySelectorAll(".av-ov").forEach(x => x.remove());
  const o = document.createElement("div"); o.className = "av-ov"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Calendrier de l'Avent");
  const dessiner = () => {
    const vues = aventOuvertes(), j = aventJour(), cpt = texteCompteAvent();
    const aOuvrir = !aventApercu() && j && caseOuvrable(j) && !vues.includes(j) ? j : 0;
    o.innerHTML = neigeAvent(36) + '<div class="av-boite"><button class="av-x" type="button" aria-label="Fermer">✕</button><div class="av-h"><b>🎄 Le calendrier de l\'Avent</b>' +
      (aOuvrir ? '<button type="button" class="av-jour" data-av-jour="' + aOuvrir + '">✨ Case du ' + aOuvrir + " à ouvrir</button>" : "") + "<small>" +
      (aventApercu() ? "Aperçu admin : toutes les cases s'ouvrent, rien n'est gardé." : esc(AV_REGLE) + "</small>" + (!aventCompte().perdue && !aventCompte().toutes ? "<small>" + esc(AV_DOREE) + "</small>" : "") + (cpt ? '<small class="av-cpt' + (aventCompte().perdue ? " perdue" : "") + '">' + esc(cpt) + "</small>" : "") + htmlRoiEntete() + "<small>Tour de chauffe · rien ne compte au championnat, tout pour le plaisir") + '</small></div><div class="av-grille">' + AV_GUIRLANDE +
      ORDRE_AVENT.map((n, i) => { const ok = caseOuvrable(n), vu = vues.includes(n), man = !ok && caseManquee(n), cls = man ? "manquee" : !ok ? "ferme" : vu ? "vue" : n === j ? "jour" : "libre";
        return '<button type="button" class="av-c ' + cls + " pap-" + AV_PAPIERS[(i * 5 + n) % AV_PAPIERS.length] + '" data-av="' + n + '" aria-label="' + (man ? "Case du " + n + " décembre, manquée : elle ne s'ouvrait que ce jour-là" : ok ? "Case du " + n + " décembre" + (vu ? ", déjà ouverte : " + esc(titreCase(n)) : ", à ouvrir aujourd'hui") : "Case du " + n + " décembre, fermée jusqu'au " + n) + '">' +
          htmlPaquet(n, cls) + "</button>"; }).join("") + "</div>" + AV_LEGENDE + "</div>" + AV_PAYSAGE;
    if (o.auto) { const c = o.querySelector(".av-c.jour"); if (c) c.classList.add("av-auto"); }   // redessiné (réponse du serveur) : le paquet du jour reste mis en avant
    o.querySelector(".av-x").addEventListener("click", fermer);
    o.querySelectorAll("[data-av]").forEach(b => b.addEventListener("click", () => toucherCase(b, +b.dataset.av)));
    const pj = o.querySelector("[data-av-jour]"); if (pj) pj.addEventListener("click", () => { const b = o.querySelector('.av-c[data-av="' + pj.dataset.avJour + '"]'); if (!b) return;
      try { b.scrollIntoView({ block: "center" }); } catch (e) { } toucherCase(b, +pj.dataset.avJour); });   // la pastille ouvre la case du jour (même animation)
  };
  // Avent 26/11 : le calendrier vit dans le Podium : la course qui s'y joue se met en pause sous lui (fluide au téléphone), et reprend à sa fermeture
  try { if (!AV_PAUSE_GP && typeof basculerPauseGP === "function" && GP_INST && GP_INST.api && GP_INST.api.enCours() && !enPauseGP()) { basculerPauseGP(true); AV_PAUSE_GP = enPauseGP(); } } catch (e) { }
  const fermer = () => { o.remove(); AVENT_APERCU = false; poserAventEntree(); avToastDessus(); if (AV_PAUSE_GP && !document.querySelector(".av-ov")) { AV_PAUSE_GP = false; try { if (enPauseGP()) basculerPauseGP(false); } catch (e) { } } };
  o.redessiner = dessiner; o.fermer = fermer;   // le serveur a répondu (cases ouvertes, heure) : on redessine
  const toucherCase = (b, n) => {
    if (!caseOuvrable(n)) { try { toast(caseManquee(n) ? msgManquee(n) : "Patience : cette case s'ouvre le " + n + " décembre."); } catch (e) { } return; }
    if (o.querySelector(".av-c.ouvre")) return;   // une case est déjà en train de s'ouvrir (double toucher, ou deux paquets coup sur coup) : Avent 26/11
    const deja = b.classList.contains("vue"); marquerOuverte(n);
    if (deja || reduit) return ouvrirCaseAvent(n, dessiner);
    // v20.80 · l'ouverture en 4 temps (~0,9 s, transform et opacity seulement) : le paquet s'écrase, le nœud saute, le couvercle s'envole (rayons dorés), la carte grandit depuis la case
    b.insertAdjacentHTML("beforeend", '<i class="av-int"></i><i class="av-ray"></i><i class="av-couv av-vole"></i><i class="av-lueur"></i><span class="av-ico">' + icoCase(n) + "</span>");
    b.classList.add("ouvre"); sonAvent("porte");
    setTimeout(() => { if (!o.isConnected) return; const r = b.getBoundingClientRect(); ouvrirCaseAvent(n, dessiner, r); setTimeout(() => { const ry = b.querySelector(".av-ray"); if (ry) ry.remove(); }, 320); }, 650);   // les rayons s'éteignent sous la carte (la grille est redessinée à sa fermeture)
  };
  o.addEventListener("click", e => { if (e.target === o) fermer(); });
  dessiner(); document.body.appendChild(o); avToastDessus(); poserAventEntree(); chargerAvent(15000);
  if (AV_AUTO) { AV_AUTO = false; o.auto = true; const c = o.querySelector(".av-c.jour"); if (c) { c.classList.add("av-auto"); try { c.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" }); } catch (e) { } } }   // Avent 26/11 : ouverture automatique, sur le paquet du jour   // Avent 26/11 : au retour sur le calendrier, les classements se relisent (au plus toutes les 15 s)
}
/** une case ouverte : jeu ou surprise, dans sa fenêtre (un toucher en dehors, ✕ ou Fermer pour revenir au calendrier) */
function ouvrirCaseAvent(n, apres, depuis) {
  if (!caseOuvrable(n)) return;
  document.querySelectorAll(".av-case").forEach(x => { if (x.jeu) x.jeu.stop(); x.remove(); });   // Avent 26/11 : l'ancienne partie s'arrête avec sa case
  const c = CASES_AVENT[n], o = document.createElement("div"); o.className = "av-case"; o.dataset.n = n; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  let corps = "", inst = null;
  if (c.type === "jeu") corps = '<div class="av-jeu"></div>' + (aventApercu() ? "" : '<div class="av-clas" data-jeu="' + c.jeu + '">' + htmlClassementAvent(c.jeu) + "</div>");   // 🏆 Avent 26/11 : le classement en direct, sous le jeu
  else if (c.type === "scene") corps = '<div class="av-jeu av-scene"></div><p class="av-t">' + esc(c.texte) + "</p>";
  else if (c.type === "compte") { const r = joursAvantAnnonce(); corps = '<div class="av-rebours"><span>' + (r > 0 ? "J-" + r : "🎉") + "</span><small>" + (r > 1 ? "avant l'annonce du 20 décembre" : r === 1 ? "demain, l'annonce !" : "l'annonce est arrivée") + '</small></div><p class="av-t">' + esc(c.texte) + "</p>"; }
  else if (c.type === "cadeau") corps = htmlCadeauAvent() + '<p class="av-t">' + esc(c.texte) + '</p><div class="av-records">' + htmlRecordsAvent() + "</div>";
  else corps = '<p class="av-t">' + esc(c.texte) + "</p>";
  const bouton = c.type === "cadeau" ? '<button class="btn acc" type="button" data-av-ecurie>🏎️ Équiper maintenant</button>' : c.type === "annonce" ? '<button class="btn acc" type="button" data-av-podium>📣 Revoir l\'annonce</button>' : "";   // v20.80 : dans la rangée du bas, sous les 24 points
  o.setAttribute("aria-label", "Case du " + n + " décembre");
  const demain = n === aventJour() && n < 24 && !aventApercu() && c.type !== "jeu" && c.type !== "annonce";   // la surprise du jour : « À demain ! » ferme aussi
  o.innerHTML = neigeAvent(24) + '<div class="av-carte' + (n === 24 ? " av-24" : "") + '">' + htmlEnteteCase(n) + '<div class="av-corps"><span class="av-k">' + kickerCase(c) + "</span><h3>" + (c.type === "jeu" ? "" : '<span aria-hidden="true">' + c.ico + "</span> ") + esc(titreCase(n)) + "</h3>" + corps +
    htmlSerieAvent(n) + '<div class="btn-row"><button class="btn ' + (demain ? "acc" : "ghost") + '" type="button" data-av-fermer>' + (demain ? "🎄 À demain !" : "Fermer") + "</button>" + bouton + "</div></div></div>";
  document.body.appendChild(o); avToastDessus();
  if (depuis && !reduit) { try { const k = o.querySelector(".av-carte"), r = k.getBoundingClientRect();   // la carte grandit depuis la case touchée
    k.style.transformOrigin = Math.round(depuis.left + depuis.width / 2 - r.left) + "px " + Math.round(depuis.top + depuis.height / 2 - r.top) + "px"; k.classList.add("nait"); } catch (e) { } }
  if (c.type === "jeu") { inst = jeuAvent(o.querySelector(".av-jeu"), c.jeu); chargerAvent(8000); }
  else if (c.type === "scene") inst = sceneTraineau(o.querySelector(".av-scene"));
  else if (c.type === "cadeau") { chargerAvent(true); try { if (typeof confettis === "function") confettis("confettis"); else sonAvent("fin"); } catch (e) { } }
  else sonAvent("grelots");
  o.jeu = inst;   // v20.62 : l'état de la partie, lisible par les tests
  const fermer = () => { if (inst) inst.stop(); o.remove(); if (apres) apres(); poserAventEntree(); avToastDessus(); };
  o.addEventListener("click", e => { if (e.target === o) fermer(); });
  o.querySelector(".av-x").addEventListener("click", fermer); o.querySelector("[data-av-fermer]").addEventListener("click", fermer);
  const pd = o.querySelector("[data-av-podium]"); if (pd) pd.addEventListener("click", () => { fermer(); document.querySelectorAll(".av-ov").forEach(x => x.fermer ? x.fermer() : x.remove()); AVENT_APERCU = false;   // v20.62 : rouvre l'annonce du 20 elle-même
    try { const l = etapesJeu().filter(e => annonceEtape(e) === 20261220 && regleVisible(e.id)); if (l.length) ouvrirNouveautes(l); else allerA("trophees"); } catch (e) { } });
  const ec = o.querySelector("[data-av-ecurie]"); if (ec) ec.addEventListener("click", () => { fermer(); document.querySelectorAll(".av-ov").forEach(x => x.fermer ? x.fermer() : x.remove()); AVENT_APERCU = false;
    try { if (typeof equiperMaintenant === "function") equiperMaintenant("plaque", typeof aventDore === "function" && aventDore(moiVrai()) ? "hiverdore" : "hiver26"); else { ETAT.podium = "ecurie"; ECU_SLOT = "plaque"; garder(); allerA("trophees"); rendreTrophees(); } } catch (e) { } });   // v20.70 · la plaque Hiver 2026 déjà essayée
  return o;
}
function joursAvantAnnonce() { if (!aventPeriode()) return aventApercu() ? AVENT.annonce - 13 : 0; return Math.max(0, AVENT.annonce - aventJourDec()); }
/** la scène du 1er : le traîneau et ses rennes traversent le ciel, en boucle (immobile si « réduire les animations ») */
function sceneTraineau(zone) {
  const W = 320, H = 200, dpr = Math.min(2, window.devicePixelRatio || 1);
  zone.innerHTML = '<canvas class="avj-c" width="' + W * dpr + '" height="' + H * dpr + '" aria-hidden="true"></canvas>';
  const ctx = zone.querySelector("canvas").getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const G = { W, H, s: {}, horloge: 0 }; let raf = 0, vivant = true, last = 0; sonAvent("grelots");
  const img = ts => { if (!vivant) return; const dt = last ? Math.min(.05, (ts - last) / 1000) : 0; last = ts; G.horloge += dt;
    try { avFond(G, ctx); const x = reduit ? 170 : ((G.horloge * 70) % (W + 260)) - 130, y = 80 + Math.sin(G.horloge * 2) * 10;
      if (!reduit) for (let i = 0; i < 14; i++) { ctx.fillStyle = "rgba(255,229,150," + (.6 - i * .04) + ")"; ctx.beginPath(); ctx.arc(x - 40 - i * 9, y + 16 + Math.sin(G.horloge * 3 + i) * 3, 2.4 - i * .12, 0, 7); ctx.fill(); }
      avTraineau(ctx, x, y, .9); ctx.strokeStyle = "#D9B27C"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 28, y); ctx.lineTo(x + 112, y - 4); ctx.stroke();
      [0, 1, 2].forEach(i => avRenne(ctx, x + 52 + i * 30, y - 4 + Math.sin(G.horloge * 6 + i) * 2, .75, { pas: G.horloge * 12 + i, nezBrun: i < 2 }));
      [[30, 182, 1.2], [80, 188, 1], [250, 184, 1.3], [298, 190, .9]].forEach(([a, b, s]) => avSapin(ctx, a, b, s)); avNeige(G, ctx); } catch (e) { vivant = false; }
    if (!reduit) raf = requestAnimationFrame(img); };
  raf = requestAnimationFrame(img);
  return { stop() { vivant = false; cancelAnimationFrame(raf); } };
}
/** la case 24 : la plaque et la traînée, dessinées comme dans l'écurie */
function htmlCadeauAvent() {
  let nom = "Théo"; try { nom = moiVrai() || (D.personnes[0] || {}).nom || nom; } catch (e) { }
  let plaque = "", trainee = "";
  try { plaque = '<span class="plaque grande pl-hiver26">' + iconePlaque("hiver26") + esc(ITEMS.plaque.hiver26) + "</span>"; } catch (e) { }
  try { trainee = vignetteItem("trainee", "flocons", nom, {}); } catch (e) { }
  let doree = ""; try { if (!aventApercu() && aventDores().includes(nom)) doree = '<div class="av-obj av-doree"><small>🏅 24 cases sur 24, chacune le jour même : la plaque dorée</small><span class="plaque grande pl-hiverdore">' + iconePlaque("hiverdore") + esc(ITEMS.plaque.hiverdore) + "</span></div>"; } catch (e) { }
  return '<div class="av-cadeau">' + doree + '<div class="av-obj"><small>Plaque</small>' + plaque + '</div><div class="av-obj"><small>Traînée « Flocons »</small>' + trainee + "</div></div>";
}
/* ---------- Records de Noël partagés (serveur Versus · Avent.js) : jamais bloquant, jamais en simulation ni en aperçu ---------- */
let AVENT_SRV = null, AVENT_SRV_T = 0, AVENT_ENVOI = false;
/** v20.62 · un record se met en file pendant le calendrier, sauf en simulation de date ou en aperçu admin (même hors connexion) */
function aventFile() { try { return !simulation() && !aventApercu() && aventPeriode(); } catch (e) { return false; } }
function aventEnLigne() { try { return SOURCE === "api" && !simulation() && !aventApercu() && aventPeriode(); } catch (e) { return false; } }
function fileAvent() { try { const o = JSON.parse(stock.get("versus.aventFile") || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
function jourAvNum() { return aventNum(); }
/** les cases ouvertes pas encore confirmées par le serveur (en file sur l'appareil si le réseau manque) */
function fileCases() { try { const l = JSON.parse(stock.get("versus.aventCases") || "[]"); return Array.isArray(l) ? l.filter(n => Number.isInteger(n) && n >= 1 && n <= 24) : []; } catch (e) { return []; } }
function mettreEnFileCase(n) { const l = fileCases(); if (!l.includes(n)) { l.push(n); stock.set("versus.aventCases", JSON.stringify(l)); } envoyerFileAvent(); }
/** « case n ouverte » part au serveur ; il accepte (case du jour) ou refuse (manquée : on l'enlève de l'appareil) ; sans réseau : on garde pour plus tard */
async function envoyerCasesAvent() {
  let n;
  while ((n = fileCases()[0]) !== undefined) {   // la file est relue à chaque tour : une case ouverte pendant l'envoi part aussi
    const rep = await posterAdmin({ action: "aventCase", jour: n });
    if (!rep || !rep.ok || typeof rep.accepte !== "boolean") return false;   // pas de réseau, serveur occupé ou pas encore à jour : plus tard
    stock.set("versus.aventCases", JSON.stringify(fileCases().filter(k => k !== n)));
    if (!rep.accepte) { stock.set("versus.avent", JSON.stringify(aventOuvertes().filter(k => k !== n)));
      const c = document.querySelector('.av-case[data-n="' + n + '"]'); if (c) { if (c.jeu) c.jeu.stop(); c.remove(); }
      try { toast(rep.raison === "manquee" || !rep.message ? msgManquee(n) : rep.message); } catch (e) { } }
    recevoirAvent(rep);
  }
  return true;
}
/** un record à envoyer : gardé en file (le meilleur seulement), puis envoyé dès que possible */
function mettreEnFileAvent(id, score) {
  const J = JEUX_AVENT[id]; if (!J || J.libre || !scoreValide(id, score) || !aventFile() || aventFige()) return;   // Avent 26/11 : plus rien ne part après le 24/12 à 23 h 59   // v20.62 : en file même hors connexion ; la connexion se teste à l'envoi
  const f = fileAvent(), d = f[id]; if (d && !(J.bas ? score < d.s : score > d.s)) return;
  f[id] = { s: score, apres: d ? d.apres || 0 : 0 }; stock.set("versus.aventFile", JSON.stringify(f)); envoyerFileAvent();
}
/** la file part au serveur ; « deja » (un record vient d'être écrit pour ce jeu, moins d'une minute avant) = on réessaie la minute d'après ; sans réseau = plus tard, en silence */
let AVENT_RELANCE = false, AVENT_MINUTE = 0;
function relancerAventDans(ms) { if (AVENT_MINUTE) return; AVENT_MINUTE = setTimeout(() => { AVENT_MINUTE = 0; envoyerFileAvent(); }, ms); }
async function envoyerFileAvent() {
  if (!aventEnLigne()) return;
  if (AVENT_ENVOI) { AVENT_RELANCE = true; return; }   // un envoi tourne déjà : on repartira juste après lui (rien ne se perd)
  AVENT_ENVOI = true; AVENT_RELANCE = false;
  try {
    await envoyerCasesAvent();
    const attente = fileCases();
    for (const jeu of Object.keys(fileAvent())) {
      const x = fileAvent()[jeu]; if (!x) continue;
      if (x.apres && Date.now() < x.apres) { relancerAventDans(x.apres - Date.now() + 200); continue; }   // le serveur a demandé d'attendre la minute d'après
      { const cj = Object.keys(CASES_AVENT).find(k => CASES_AVENT[k].jeu === jeu); if (cj && attente.includes(+cj)) continue; }   // sa case attend encore le serveur
      const rep = await posterAdmin({ action: "avent", op: "score", jeu, score: x.s });
      const f = fileAvent(), y = f[jeu];
      if (rep && rep.ok) { if (y && y.s === x.s) delete f[jeu]; recevoirAvent(rep); }
      else if (rep && ["saisie", "fini", "tot", "refus", "manquee"].includes(rep.erreur)) { if (y && y.s === x.s) delete f[jeu];
        if (rep.erreur === "saisie" || rep.erreur === "manquee") {   // Avent 26/11 : un record d'une case que le serveur n'a pas comptée ne reste pas affiché chez soi
        const R = recordsAvent(); if (R[jeu] === x.s) { delete R[jeu]; stock.set("versus.aventRecords", JSON.stringify(R)); }
        if (rep.erreur === "manquee") { const cj = +Object.keys(CASES_AVENT).find(k => CASES_AVENT[k].jeu === jeu); if (cj && aventOuvertes().includes(cj)) { stock.set("versus.avent", JSON.stringify(aventOuvertes().filter(k => k !== cj))); majVuesAvent(); } } } }   // Avent 26/11 : le serveur n'a pas compté sa case : elle se referme aussitôt   // v20.62 : un score refusé ne reste pas comme record (il bloquerait les suivants)
      else if (rep && rep.erreur === "deja") { if (y) y.apres = Date.now() + 61000; relancerAventDans(61500); }
      else break;   // pas de réseau ou serveur occupé : on garde tout pour plus tard
      stock.set("versus.aventFile", JSON.stringify(f));
    }
    majClassementsAvent();
  } catch (e) { /* jamais bloquant */ } finally { AVENT_ENVOI = false; if (AVENT_RELANCE) { AVENT_RELANCE = false; setTimeout(envoyerFileAvent, 0); } }
}
/* à la reprise de l'appli (retour au premier plan, réseau revenu) : la file repart, l'état du serveur est relu */
try { document.addEventListener("visibilitychange", () => { if (!document.hidden) { chargerAvent(); envoyerFileAvent(); } });
  window.addEventListener("online", () => { chargerAvent(true); envoyerFileAvent(); }); } catch (e) { /* rien */ }
/** l'état du serveur : mes records (fusionnés avec ceux de l'appareil) et, dès le 24/12, ceux de la bande */
function recevoirAvent(rep) {
  if (!rep || !rep.ok) return;
  try { if (typeof rep.maintenant === "number" && isFinite(rep.maintenant) && !simulation()) { AVENT_DECAL = rep.maintenant - Date.now(); stock.set("versus.aventDecal", String(Math.round(AVENT_DECAL))); } } catch (e) { }   // l'heure du serveur fait foi
  if (Array.isArray(rep.dores)) garderDoresAvent(rep.dores, rep.doresFinal);
  if (rep.gagnants && typeof rep.gagnants === "object") garderRoiAvent(rep.gagnants);   // 🎅 le roi des jeux de Noël et les ⭐, attribués par le serveur le 25/12 à 0 h
  if (!rep.ouvert) { majVuesAvent(); return; }
  AVENT_SRV = rep; AVENT_SRV_T = Date.now();
  if (Array.isArray(rep.cases)) {   // les cases ouvertes : celles du serveur (+ celles qui attendent de lui être envoyées), jamais deux vérités
    const l = [...new Set(rep.cases.filter(n => Number.isInteger(n) && n >= 1 && n <= 24).concat(fileCases()))].sort((a, b) => a - b);
    if (l.join() !== aventOuvertes().slice().sort((a, b) => a - b).join()) stock.set("versus.avent", JSON.stringify(l));
  }
  try { const R = recordsAvent(); let ch = false;
    Object.keys(rep.mes || {}).forEach(jeu => { const J = JEUX_AVENT[jeu], v = Number(rep.mes[jeu]); if (!J || !isFinite(v)) return; if (R[jeu] === undefined || (J.bas ? v < R[jeu] : v > R[jeu])) { R[jeu] = v; ch = true; } });
    if (ch) stock.set("versus.aventRecords", JSON.stringify(R)); } catch (e) { }
  const z = document.querySelector(".av-case .av-records"); if (z) z.innerHTML = htmlRecordsAvent();
  majClassementsAvent();
  const cd = document.querySelector(".av-case .av-cadeau"); if (cd) cd.outerHTML = htmlCadeauAvent();   // 🏅 la plaque dorée dès que le serveur a compté la 24e case
  majVuesAvent();
}
/** après une réponse du serveur : le calendrier (s'il est ouvert) et l'entrée du Classement se redessinent ; une case devenue interdite se ferme */
function majVuesAvent() {
  try { document.querySelectorAll(".av-case[data-n]").forEach(c => { if (!caseOuvrable(+c.dataset.n)) { if (c.jeu) c.jeu.stop(); c.remove(); } });
    const o = document.querySelector(".av-ov"); if (o && o.redessiner && !o.querySelector(".av-c.ouvre")) o.redessiner(); poserAventEntree(); } catch (e) { }
}
/* ---------- 🏅 plaque « Hiver 2026 » dorée : la liste du serveur (les pilotes à 24/24), gardée sur l'appareil pour toujours une fois définitive ---------- */
let AVENT_DORES_T = 0;
function aventDores() {
  if (aventNum() < 20261224) return [];   // rien avant le 24/12 (heure du serveur dès qu'il a répondu)
  const S = AVENT_SRV && Array.isArray(AVENT_SRV.dores) ? AVENT_SRV.dores : null; if (S) return S.filter(x => typeof x === "string");
  try { const o = JSON.parse(stock.get("versus.aventDores") || "null"); return o && Array.isArray(o.l) ? o.l.filter(x => typeof x === "string") : []; } catch (e) { return []; }
}
function garderDoresAvent(l, fin) {
  if (simulation() || aventApercu()) return; const a = stock.get("versus.aventDores"), n = JSON.stringify({ l: l.filter(x => typeof x === "string"), fin: !!fin });
  if (a !== n) { stock.set("versus.aventDores", n); try { if (typeof MEMO_SAISON !== "undefined") MEMO_SAISON = { d: null, m: {} }; } catch (e) { } }
}
/** une fois par ouverture de l'appli, à partir du 24/12/2026 et tant que la liste n'est pas définitive */
async function chargerDoresAvent() {
  try { if (AVENT_DORES_T || SOURCE !== "api" || simulation() || aventApercu() || aventPeriode() || aventNum() < 20261224) return;
    const o = JSON.parse(stock.get("versus.aventDores") || "null"), g = JSON.parse(stock.get("versus.aventRoi") || "null"); if (o && o.fin && g) return;   // Avent 26/11 : et le roi de Noël
    AVENT_DORES_T = Date.now(); recevoirAvent(await posterAdmin({ action: "avent", op: "etat" })); } catch (e) { }
}
async function chargerAvent(force) {   // force : true = tout de suite ; un nombre = pas plus souvent que ce délai (ms) ; rien = une fois par minute
  const min = force === true ? 0 : typeof force === "number" ? force : 60000;
  if (!aventEnLigne() || Date.now() - AVENT_SRV_T < min) return;
  AVENT_SRV_T = Date.now();
  try { recevoirAvent(await posterAdmin({ action: "avent", op: "etat" })); } catch (e) { /* hors ligne : les jeux marchent quand même */ }
  envoyerFileAvent();
}
/** case 24 : « 🎁 Les cadeaux du traîneau : Clément 42 » pour chaque jeu, et le roi des jeux de Noël (pour rire, aucun point) */
function htmlRecordsAvent() {
  const S = AVENT_SRV; if (!S || !Array.isArray(S.records) || !S.records.length) return "";
  const L = S.records.filter(r => JEUX_AVENT[r.jeu]).map(r => { const J = JEUX_AVENT[r.jeu], f = avFmt(J, Number(r.score));
    return "<li><span>" + J.ico + " " + esc(J.nom) + "</span><b>" + esc([r.nom].concat(r.ex || []).join(" et ")) + " · " + esc(f) + "</b></li>"; }).join("");
  const fige = aventFige() || S.fige === true, R = Array.isArray(S.roi) ? S.roi.filter(x => x && typeof x.nom === "string") : [], or = x => Number(x.or) > 0 ? " · ⭐ " + Number(x.or) : "";
  const roi = R.length ? '<p class="av-roi">🎅 ' + (fige ? "Le roi des jeux de Noël 2026" : "Le roi des jeux de Noël, pour l'instant") + " : <b>" + esc(R[0].nom) + "</b>" + esc(or(R[0])) +
    (R.length > 1 ? "<small>puis " + R.slice(1, 5).map(x => esc(x.nom) + esc(or(x))).join(", ") + "</small>" : "") +
    '<small class="av-roi-g">' + (fige ? "Il gagne pour toujours : la plaque Roi de Noël 2026, la couronne de houx et la livrée « Roi de Noël »." : "Tout se fige ce soir à 23 h 59 : rejoue tes jeux pour grimper ! " + esc(AV_ROI.replace(/^🎅 /, ""))) + "</small>" +
    '<small class="av-roi-r">Le roi des jeux de Noël, c\'est celui qui a le plus de 1res places, tous jeux confondus (à égalité : le plus de 2es places, puis le premier à avoir atteint son record). Chaque 1re place = une ⭐. Aucun point au championnat.</small></p>' : "";
  return '<h4>🏆 Les records de Noël de la bande</h4><ul>' + L + "</ul>" + roi;
}
/* ---------- 🏆 Avent 26/11 · le classement en direct d'un jeu (dans la carte de la case, sous le jeu) ---------- */
/** la liste du serveur [{ nom, score }] (meilleur d'abord), avec MON record de l'appareil tout de suite (avant même la réponse du serveur) */
function classementJeuAvent(jeu) {
  const S = AVENT_SRV, J = JEUX_AVENT[jeu]; if (!J) return [];
  const l = (S && S.classements && Array.isArray(S.classements[jeu]) ? S.classements[jeu] : []).filter(x => x && typeof x.nom === "string" && isFinite(Number(x.score))).map(x => ({ nom: x.nom, score: Number(x.score) }));
  let moi = ""; try { moi = moiVrai() || ""; } catch (e) { }
  const r = recordsAvent()[jeu], mieux = (a, b) => J.bas ? a < b : a > b;
  if (moi && typeof r === "number" && !aventFige()) {
    const i = l.findIndex(x => x.nom === moi);
    if (i < 0 || mieux(r, l[i].score)) { if (i >= 0) l.splice(i, 1); const f = fileAvent()[jeu], k = l.findIndex(x => mieux(r, x.score)), x = { nom: moi, score: r, attente: !!(f && f.s === r) };
      if (k < 0) l.push(x); else l.splice(k, 0, x); }
  }
  return l;
}
function htmlClassementAvent(jeu) {
  const J = JEUX_AVENT[jeu]; if (!J) return "";
  const l = classementJeuAvent(jeu), fige = aventFige(); let moi = ""; try { moi = moiVrai() || ""; } catch (e) { }
  const i = l.findIndex(x => x.nom === moi), MED = ["🥇", "🥈", "🥉"];
  const rang = i >= 0 ? '<p class="av-rang">' + (fige ? "Ton rang final" : "Ton rang") + " : <b>" + (i ? i + 1 + "e" : "1er") + "</b> sur " + l.length + (i === 0 ? " 👑" : "") + "</p>"
    : '<p class="av-rang">' + (fige ? "Tu n'as pas de score sur ce jeu." : "Pas encore classé : joue une partie pour entrer au classement !") + "</p>";
  const L = l.length ? '<ol class="av-clas-l">' + l.map((x, k) => '<li class="' + (x.nom === moi ? "moi" : "") + (k < 3 ? " m" + (k + 1) : "") + '"><span class="av-pl">' + (MED[k] || k + 1 + "e") + '</span><span class="av-nm">' + esc(x.nom) + (x.nom === moi ? " <small>(toi)</small>" : "") + '</span><b class="av-sc">' + esc(avFmt(J, x.score)) + (x.attente ? ' <small title="en route vers le serveur">⏳</small>' : "") + "</b></li>").join("") + "</ol>"
    : '<p class="av-vide">Personne n\'a encore de score : sois le premier !</p>';
  return '<div class="av-clas-h"><b>🏆 Classement ' + (fige ? "final" : "en direct") + "</b><small>" + (fige ? "figé le 24 décembre à 23 h 59" : "rejoue autant que tu veux jusqu'au 24 décembre, 23 h 59") + "</small></div>" + rang + L;
}
/** après une réponse du serveur ou un nouveau record : les classements ouverts se redessinent (rien d'autre ne bouge, la partie continue) */
function majClassementsAvent() { try { document.querySelectorAll(".av-case .av-clas[data-jeu]").forEach(z => { const h = htmlClassementAvent(z.dataset.jeu); if (z.innerHTML !== h) z.innerHTML = h; }); } catch (e) { } }
/* ---------- 🎅 le roi des jeux de Noël et les ⭐ étoiles de Noël : attribués par le serveur le 25/12 à 0 h, gardés sur l'appareil pour toujours ---------- */
function garderRoiAvent(g) {
  if (simulation() || aventApercu()) return;
  const et = {}; if (g.etoiles && typeof g.etoiles === "object") Object.keys(g.etoiles).forEach(n => { const v = Number(g.etoiles[n]); if (Number.isInteger(v) && v > 0 && v <= 24) et[n] = v; });
  const n = JSON.stringify({ roi: typeof g.roi === "string" ? g.roi : null, etoiles: et });
  if (stock.get("versus.aventRoi") !== n) { stock.set("versus.aventRoi", n); try { if (typeof MEMO_SAISON !== "undefined") MEMO_SAISON = { d: null, m: {} }; } catch (e) { } }
}
function aventGagnants() {
  if (aventNum() < 20261225) return null;   // rien avant le 25/12 à 0 h (heure du serveur dès qu'il a répondu)
  try { const o = JSON.parse(stock.get("versus.aventRoi") || "null"); return o && typeof o === "object" ? o : null; } catch (e) { return null; }
}
/** le nom du roi des jeux de Noël 2026 (null avant le 25/12, ou si personne n'a joué) */
function aventRoiNoel() { const g = aventGagnants(); return g && typeof g.roi === "string" ? g.roi : null; }
/** ⭐ le nombre de 1res places finales d'un pilote */
function aventEtoiles(nom) { const g = aventGagnants(); return g && g.etoiles && Number.isInteger(g.etoiles[nom]) ? g.etoiles[nom] : 0; }
/** l'en-tête du calendrier : ce que gagne le roi (avant le 25), puis qui l'est */
function htmlRoiEntete() {
  if (aventApercu()) return '<small class="av-roi-gain">' + esc(AV_ROI) + "</small>";
  const r = aventRoiNoel();
  return aventFige() ? (r ? '<small class="av-roi-gain">🎅 Roi des jeux de Noël 2026 : <b>' + esc(r) + "</b>, pour toujours : plaque, couronne de houx et la livrée « Roi de Noël »</small>" : "") : '<small class="av-roi-gain">' + esc(AV_ROI) + "</small>";
}
/** 🎄 aperçu admin (double sécurité) : toutes les cases ouvrables, rien n'est gardé */
function apercuAvent() { if (!apercuAutorise() || window.APERCUS_FINIS) return; AVENT_APERCU = true; ouvrirAvent(); }
