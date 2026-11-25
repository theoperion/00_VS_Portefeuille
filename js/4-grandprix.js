/* Versus · Grand Prix : circuits, course, stand, pronostic, rival, vote (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   GRAND PRIX · le championnat en vraie course
   Les voitures de chacun (livrée, casque, traînée) tournent sur un circuit : 25 points = un tour.
   Chaque mois se rejoue en animation, sous la météo du marché (l'indice du mois).
   Les cartes de course (une main identique pour tous, chaque saison) ajoutent de la stratégie :
   posées face cachée du 20 du mois précédent au 1er inclus, révélées le 2, elles donnent ou retirent quelques points.
   ============================================================ */
const TOUR_GP = 25;
const CARTES = [
  { id: "aspiration", ico: "🌀", nom: "Aspiration", def: "Si tu bats ce mois-ci le pilote juste devant toi au championnat : +2 pts. Inactive en janvier (pas encore de classement).", court: "+2 si tu bats celui de devant" },
  { id: "turbo", ico: "🚀", nom: "Turbo", def: "Si tu bats l'indice ce mois-ci, ton bonus 🎯 vaut +3 au lieu de +1 (+4 les mois où le 🎯 vaut 2).", court: "+2 au bonus 🎯" },
  { id: "pluie", ico: "🌧️", nom: "Pneus pluie", def: "Un mois où l'indice baisse, si tu fais mieux que lui : +2 pts. La carte du portefeuille bien protégé.", court: "+2 si tu résistes à la baisse" },
  { id: "pari", ico: "🎲", nom: "Pari", def: "Désigne un rival : si tu finis devant lui ce mois-ci, +2 pts ; derrière lui, −1 ; égalité parfaite, 0. Il découvre ton défi à la révélation.", court: "+2 / −1 contre un rival", cible: true }
];
/* Cartes : celles du Versus (révélées après la date limite), les tiennes gardées sur l'appareil, ou celles de l'aperçu admin */
function cartesApercu() { try { return JSON.parse(stock.get("versus.cartesApercu") || "{}"); } catch (e) { return {}; } }
function cleMesCartes() { return "versus.mesCartes." + (moiPilote() || "moi"); }
function cleMesDuels() { return "versus.mesDuels." + (moiPilote() || "moi"); }
function mesCartes() {
  let loc = {}; try { loc = JSON.parse(stock.get(cleMesCartes()) || "{}"); } catch (e) { loc = {}; }
  const srv = (typeof D !== "undefined" && D && D.mesCartes) || {};   // envoyées par l'API à leur seul propriétaire
  Object.keys(srv).forEach(y => { loc[y] = Object.assign({}, loc[y] || {}, srv[y]); });
  return loc;
}
function carteDe(y, nom, k) {
  if (apercuSaison()) { const c = (((cartesApercu()[y] || {})[nom]) || {})[k]; return c && c.c ? c : null; }
  const c = ((((D.cartes || {})[y] || {})[nom]) || {})[k];
  if (c && c.c && vraiAdmin() && !adminActif() && nom !== moiPilote() && !circuitRevele(k)) return { cache: true };
  if (c && c.c) return c;
  // ma propre carte, gardée sur l'appareil, même avant que le Versus la renvoie (face cachée)
  const m = nom === moiPilote() ? ((mesCartes()[Math.floor(k / 100)] || {})[k] || (mesCartes()[y] || {})[k]) : null;
  if (m && m.c) return Object.assign({ cache: true }, m);
  return c && c.cache ? { cache: true } : null;
}
function moiPilote() { return moiVrai(); }
/** Effet d'une carte sur un mois : x = ligne du pilote, l = tout le mois, avant = places au championnat avant ce mois */
function effetCarte(c, x, l, avant, iR, ctx) {
  if (!c || !c.c || c.cache && !c.revele) return 0;
  const up = (ctx && ctx.up) || { m: 0, a: 0, p: 0 };
  if (c.c === "aspiration" && avant) {   // v20.31 : le premier pilote PRÉSENT ce mois-ci juste devant soi (un absent est sauté)
    const pl = avant[x.nom], devant = Object.keys(avant).filter(n => avant[n] < pl && l.some(z => z.nom === n)).sort((a, b) => avant[b] - avant[a]);
    const xd = devant.length ? l.find(z => z.nom === devant[0]) : null; return xd && x.r > xd.r + 1e-12 ? 2 + up.a : 0; }
  if (c.c === "turbo") return x.bonus ? 2 + up.m : 0;
  const pg = (ctx && ctx.piege) || null;   // V15.5 : piège du circuit
  if (c.c === "pluie") return iR !== null && iR < 0 && x.r > iR + 1e-12 ? 2 + up.p + (pg && pg.id === "ardennes" ? 1 : 0) : 0;   // V15 : il faut aussi faire mieux que l'indice
  if (c.c === "pari" && c.cible) { const xc = l.find(z => z.nom === c.cible); const av = pg && pg.id === "averse"; return xc ? (x.r > xc.r + 1e-12 ? (av ? 3 : 2) : xc.r > x.r + 1e-12 ? (av ? -2 : -1) : 0) : 0; }   // égalité parfaite : 0, comme un duel
  if (c.c === "undercut") return x.r > 0.02 ? 2 : x.r > 0 ? 1 : 0;
  if (c.c === "jaune") return x.dernier ? 2 : 0;
  if (c.c === "safety") { const cu = ctx && ctx.cumAvant; if (!cu || cu[x.nom] === undefined) return 0; return Math.max(...Object.values(cu)) - cu[x.nom] >= 6 ? 2 : 0; }
  if (c.c === "arret") { const px = ctx && ctx.prev && ctx.prev.find(z => z.nom === x.nom); return px && x.rg < px.rg ? 2 : 0; }
  return 0;
}
/** Mois où l'on peut encore poser une carte : le mois en cours jusqu'au 1er inclus, sinon le suivant */
/* Fenêtre des cartes et des duels pour le mois K : du 20 du mois d'avant au 1er de K inclus (chauffe : du 21/11 à 9 h au 1er décembre, v17.61) */
const CHAUFFE_OUVRE = Date.UTC(2026, 10, 21, 8, 0);   // 10 h (Théo, 20/11 soir ; 9 h → 15 h → 10 h)   // v17.1 (Théo) : tour de chauffe ouvert le samedi 21/11 à 9 h (heure de Paris), pas avant
function moisCarteOuvert() {
  const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1;
  if (d.getTime() < CHAUFFE_OUVRE && k <= CHAUFFE_K) return null;
  if (d.getDate() < jourLimite(k)) return k;
  return d.getDate() >= 20 ? cleMoins(k, -1) : null;
}
/** Prochaine fenêtre quand tout est fermé : { k, du } */
function prochaineFenetre() { if (Date.now() < CHAUFFE_OUVRE) return { k: CHAUFFE_K, du: "21 novembre à 9 h" }; const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1; return { k: cleMoins(k, -1), du: "20 " + moisLong(k).replace(/ \d{4}$/, "") }; }
/** Mois sur lequel on peut poser une carte (ou lancer un duel) depuis l'onglet de la saison y, ou null */
function kOuvertPour(y) {
  const k = moisCarteOuvert(); if (!k) return null;
  if (estChauffe(y)) return k === CHAUFFE_K ? k : null;
  return Math.floor(k / 100) === y && k !== CHAUFFE_K ? k : null;
}
async function poserCarte(y, k, carte, cible) {
  const qui = moiPilote();
  if (apercuSaison()) {
    const a = cartesApercu(); a[y] = a[y] || {}; a[y][qui] = a[y][qui] || {};
    if (carte) a[y][qui][k] = { c: carte, cible: cible || null }; else delete a[y][qui][k];   // y : saison de l'aperçu
    stock.set("versus.cartesApercu", JSON.stringify(a)); MEMO_SAISON = { d: null, m: {} }; MEMO_EXCL = { d: null, cle: "", v: null };
    toast(carte ? "Aperçu : carte posée sur " + moisLong(k) + " (sur cet appareil seulement)." : "Carte reprise."); rendreTrophees(); return;
  }
  if (SOURCE !== "api") { toast("Cartes indisponibles hors connexion."); return; }
  const yk = Math.floor(k / 100), m = mesCartes(), avant = JSON.stringify(m);
  m[yk] = m[yk] || {}; if (carte) m[yk][k] = { c: carte, cible: cible || null }; else delete m[yk][k];
  const avantD = D.mesCartes ? JSON.stringify(D.mesCartes) : null;
  if (D.mesCartes) { D.mesCartes[yk] = D.mesCartes[yk] || {}; if (carte) D.mesCartes[yk][k] = { c: carte, cible: cible || null }; else delete D.mesCartes[yk][k]; }
  stock.set(cleMesCartes(), JSON.stringify(m)); MEMO_SAISON = { d: null, m: {} }; MEMO_EXCL = { d: null, cle: "", v: null };
  if (simulation()) { toast(carte ? "👁️ Simulation : carte posée pour voir, rien n'est envoyé." : "Carte reprise (simulation)."); rendreTrophees(); return; }
  toast(carte ? "🂠 Carte posée face cachée sur " + moisLong(k) + "." : "Carte reprise."); rendreTrophees();
  const rep = await posterAdmin({ action: "carte", personne: qui, mois: k, carte: carte || null, cible: cible || null });
  if (rep.ok) {
    const n = mesCartes(); n[yk] = rep.mesCartes || n[yk] || {}; stock.set(cleMesCartes(), JSON.stringify(n));
    if (D.mesCartes && rep.mesCartes) D.mesCartes[yk] = rep.mesCartes;
    if (rep.cartes) D.cartes = rep.cartes; MEMO_SAISON = { d: null, m: {} }; MEMO_EXCL = { d: null, cle: "", v: null };
  } else {
    stock.set(cleMesCartes(), avant); if (avantD) D.mesCartes = JSON.parse(avantD); MEMO_SAISON = { d: null, m: {} }; MEMO_EXCL = { d: null, cle: "", v: null };
    toast(rep.message || "Impossible de poser la carte."); rendreTrophees();
  }
}

/* ---------- Météo : tirée de l'indice du mois ---------- */
function meteoMois(k) {
  const dv = k ? directGP(k) : null; if (dv && dv.j >= 1 && !dv.fini) return meteoDirect(dv.r);   // v20.47 : mois en cours = le S&P depuis le 1er
  const r = k ? indiceMois(k) : null;
  if (r === null) return { id: "beau", ico: "🌤️", nom: "Beau temps", txt: "Départ sous un ciel dégagé." };
  const t = texteIndice(r, "sur le mois");
  if (r >= 0.03) return { id: "soleil", ico: "☀️", nom: "Grand soleil", txt: t + " : piste sèche, ça roule fort." };
  if (r >= 0) return { id: "nuages", ico: "⛅", nom: "Nuageux", txt: t + " : temps couvert, course tactique." };
  if (r > -0.03) return { id: "pluie", ico: "🌧️", nom: "Pluie", txt: t + " : piste glissante, les pneus pluie paient pour qui résiste." };
  return { id: "orage", ico: "⛈️", nom: "Orage", txt: t + " : déluge sur le circuit, accrochez-vous." };
}

/* ---------- v20.47 (Théo) · LA COURSE EN DIRECT pendant le mois (avant les résultats) : seulement le tour 1.
   Le peloton part dans l'ordre de la grille (classement d'avant le mois ; janvier 2027 : le tour de chauffe), à écart FIXE (aucune info sur les %).
   Avancement du peloton (en tours, 0 = ligne de départ, 1 = ligne d'arrivée) au jour d du mois (N jours) :
     brut(d) = d/N + DIRECT_AMPL × m(d) × sin(π·d/N), m(d) = S&P 500 depuis le 1er au soir du jour d / DIRECT_SP, borné à [−1, 1] ;
     brut plafonné à 0,97 avant le dernier jour ; le dernier jour = 1 (ligne d'arrivée).
     avance(j) = max(brut(1), …, brut(j)) : JAMAIS de recul d'un jour à l'autre.
   Source du S&P : les clôtures quotidiennes envoyées à tous (D.marchesMoi.quot, série « S&P 500 ») + la séance du jour (D.marchesMoi.jour) ;
   sans clôtures : D.marche (mois en cours) ; sans rien : le peloton avance avec les jours seulement. Aucun point n'en dépend. ---------- */
const DIRECT_AMPL = .12, DIRECT_SP = .04, DIRECT_ECART = .04;
function closSP() {
  const m = typeof D !== "undefined" && D && D.marchesMoi, q = m && m.quot; if (!q || !q.d || !q.s) return null;
  const s = q.s.find(x => /S&P\s*500/i.test(x.nom)); if (!s) return null; const l = [];
  q.d.forEach((d, i) => { const v = s.v[i]; if (v > 0) l.push([+d, v]); });
  const j = (m.jour || []).find(x => /S&P\s*500/i.test(x.nom)), mh = j && typeof j.pct === "number" && /^(\d{2})\/(\d{2})/.exec(j.heure || "");   // la séance du jour (en direct)
  if (mh && l.length) { const a = new Date(), y = +mh[2] > a.getMonth() + 1 ? a.getFullYear() - 1 : a.getFullYear(), dj = y * 10000 + +mh[2] * 100 + +mh[1], av = l.filter(x => x[0] < dj).pop();
    if (av && !l.some(x => x[0] === dj)) { l.push([dj, av[1] * (1 + j.pct)]); l.sort((a, b) => a[0] - b[0]); } }
  return l.length ? l : null;
}
/** S&P 500 depuis le 1er du mois k, au soir du jour d (null = inconnu) */
function spAuJour(k, d, L) {
  if (L) { const d0 = k * 100, ref = L.filter(x => x[0] <= d0).pop(), cur = L.filter(x => x[0] <= d0 + d).pop(); if (ref) return cur && cur[0] > d0 ? cur[1] / ref[1] - 1 : 0; }
  const a = new Date(), kAuj = a.getFullYear() * 100 + a.getMonth() + 1, r = k === kAuj ? indiceMois(k) : null; return ok(r) ? r : null;   // repli : D.marche (mois en cours)
}
let MEMO_DIRECT = { d: null, cle: "", v: null };
/** { j (jour, 0 = mois pas commencé, N+1 = mois fini), N, f (avance du peloton en tours), r (S&P depuis le 1er), fini } */
function directGP(k) {
  if (!k) return null; const a = new Date(), kAuj = a.getFullYear() * 100 + a.getMonth() + 1, N = new Date(Math.floor(k / 100), k % 100, 0).getDate();
  const j = kAuj < k ? 0 : kAuj > k ? N + 1 : a.getDate(), cle = k + "|" + j + "|" + (typeof D !== "undefined" && D ? D.genere : "");
  if (MEMO_DIRECT.d === D && MEMO_DIRECT.cle === cle) return MEMO_DIRECT.v;
  const L = closSP(); let f = 0, r = null;
  for (let d = 1; d <= Math.min(j, N); d++) { r = spAuJour(k, d, L); const m = r === null ? 0 : clampN(r / DIRECT_SP, -1, 1);
    f = Math.max(f, d >= N ? 1 : clampN(d / N + DIRECT_AMPL * m * Math.sin(Math.PI * d / N), 0, .97)); }
  const v = { j, N, f, r, fini: j > N }; MEMO_DIRECT = { d: D, cle, v }; return v;
}
/** v20.62 (Théo) · « S&P 500 : +0,4 % depuis le 1er » : les deux-points séparent le nom de l'indice et le chiffre (avant, « S&P 500 0,0 % » se confondait) ;
 *  html = le % en gras, vert / rouge selon le signe (bandeau du direct). */
function texteIndice(r, suite, html) {
  const idx = D.marche.indices[iRef()] || "S&P 500", p = pct(r);
  if (!html) return idx + "\u00a0: " + p + (suite ? " " + suite : "");
  return esc(idx) + '\u00a0: <b class="ix-' + (r > 0.0005 ? "up" : r < -0.0005 ? "down" : "nul") + '">' + esc(p) + "</b>" + (suite ? " " + esc(suite) : "");
}
function meteoDirect(r) {
  const t = texteIndice(r, "depuis le 1er");
  if (r === null) return { id: "beau", ico: "🌤️", nom: "Beau temps", txt: "Le peloton avance avec les jours du mois." };
  if (r >= 0.015) return { id: "soleil", ico: "☀️", nom: "Grand soleil", txt: t + " : le peloton prend de l'avance." };
  if (r >= 0) return { id: "beau", ico: "🌤️", nom: "Beau temps", txt: t + " : le peloton roule un peu devant." };
  if (r > -0.03) return { id: "pluie", ico: "🌧️", nom: "Pluie", txt: t + " : piste glissante, le peloton ralentit." };
  return { id: "orage", ico: "⛈️", nom: "Orage", txt: t + " : déluge, le peloton prend du retard." };
}
/** v20.52 · le pictogramme suit ce qu'on voit sur la piste : à Noël la pluie devient neige, à Dune une tempête de sable */
function meteoVue(met, ci) {
  const th = ((window.Piste && Piste.TRACES[ci]) || {}).amb, p = met.id === "pluie", o = met.id === "orage";
  if (th === "noel" && (p || o)) return Object.assign({}, met, { ico: o ? "❄️" : "🌨️", nom: o ? "Tempête de neige" : "Neige" });
  if (th === "desert" && (p || o)) return Object.assign({}, met, { ico: "🌪️", nom: o ? "Grosse tempête de sable" : "Tempête de sable" });
  return met;
}
/* ---------- v20.52 (Théo) · 🎬 COURSE DE DÉMONSTRATION, avant le 1er décembre 2026 (rien à rejouer : la chauffe n'a pas commencé).
   Une course SIMULÉE : performances et météo tirées au hasard à chaque fois, 2 tours, dépassements, arrivée, en 2D comme en 3D et en plein écran.
   Rien n'est lu (aucun %, aucun résultat : seule la grille déjà affichée sert de départ), rien n'est écrit (ni serveur ni « manche vue »), aucun point.
   Le bouton disparaît le 1er décembre (la course en direct prend le relais). ---------- */
const DEMO_FIN = new Date(2026, 11, 1).getTime();
const METEOS_DEMO = [{ id: "soleil", ico: "☀️", nom: "Grand soleil" }, { id: "pluie", ico: "🌧️", nom: "Pluie" }, { id: "orage", ico: "⛈️", nom: "Orage" }, { id: "beau", ico: "🌤️", nom: "Beau temps" }];
let GP_DEMO = null, GP_GRILLE = null;   // GP_DEMO = { meteo, lance, enCours, fini, scen, finir } ; GP_GRILLE = l'ordre de la grille affichée (rang des pastilles avant le départ)
function demoPossible(et, dir) { return Date.now() < DEMO_FIN && !!et && !et.m && !dir && !apercuSaison(); }
function lancerDemo() {
  const prec = GP_DEMO && GP_DEMO.meteo, l = METEOS_DEMO.filter(m => m !== prec);
  if (GP_INST && GP_INST.api.enCours()) { try { GP_INST.api.suspendre(false); } catch (e) { } }
  GP_COM.forEach(clearTimeout); GP_COM = []; GP_HORLOGE = null;
  GP_DEMO = { meteo: Object.assign({}, l[Math.floor(Math.random() * l.length)], { txt: "météo de démo, tirée au hasard." }), lance: true };
  rendreTrophees();   // la piste se remonte avec la météo de la démo, puis la course part (brancherGP)
}
/** les points « du mois » de la démo : le barème mélangé au hasard, avec au moins deux places qui changent (des dépassements) */
function gainsDemo(noms) {
  const b = baremeJ(noms.length).slice(0, noms.length); while (b.length < noms.length) b.push(0);
  for (let essai = 0; essai < 30; essai++) { const m = b.slice().sort(() => Math.random() - .5), G = {}; noms.forEach((n, k) => G[n] = m[k]);
    const arr = noms.slice().sort((a, c) => G[c] - G[a] || noms.indexOf(a) - noms.indexOf(c)); if (noms.length < 3 || arr.filter((n, k) => n !== noms[k]).length >= 2) return G; }
  const G = {}; noms.forEach((n, k) => G[n] = b[noms.length - 1 - k]); return G;
}
function jouerDemo(y, api, mc, ci) {
  const D0 = GP_DEMO; if (!D0 || !GP_INST || GP_INST.api !== api) return;
  if (vueGP(ci) === "visite" && api.type === "3d") choisirVueGP("poursuite", y);
  const noms = mc.grille.slice(), G = gainsDemo(noms), SC = scenarioCourse({ grille: noms, avant: {}, arrivee: G });
  // départ exactement depuis la grille affichée, puis le peloton s'étire (jamais de marche arrière)
  const L = api.T && api.T.L || 1000, g = (api.pasGrille ? api.pasGrille() : 9) / L, base = SC.scen, p0 = noms[0], lis = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  const scen = w => { const o = base(w), B = o[p0], q = lis(B / .35); if (q >= 1) return o; const r = {}; noms.forEach((n, k) => { r[n] = o[n] + (B - o[n] - k * g) * (1 - q); }); return r; };   // au tour 1, o[n] = B − écart : on passe de l'écart de la grille (k × g) à celui de la course
  const arr = noms.slice().sort((a, c) => G[c] - G[a] || noms.indexOf(a) - noms.indexOf(c)), v1 = arr[0];
  const remonte = noms.map(n => ({ n, g: noms.indexOf(n) - arr.indexOf(n) })).sort((a, c) => c.g - a.g)[0], chute = noms.map(n => ({ n, g: arr.indexOf(n) - noms.indexOf(n) })).sort((a, c) => c.g - a.g)[0];
  const lignes = [[0, "🎬 Démo · 🚦 " + noms[0] + " part en pole, " + noms[noms.length - 1] + " ferme la marche."],
    [.24, remonte && remonte.g > 0 ? "🚀 " + remonte.n + " attaque : " + remonte.g + " place" + (remonte.g > 1 ? "s" : "") + " de gagnée" + (remonte.g > 1 ? "s" : "") + " !" : "💨 Le peloton se tient en quelques mètres !"],
    [SC.wTour2, "🏁 Dernier tour !" + (chute && chute.g > 0 ? " · " + chute.n + " cale…" : "")]];
  api.regler({ tour: 1, grille: null }); GP_GRILLE = null; GP_SCEN = Object.assign({}, SC, { scen });
  const f = api.type === "3d", d = f ? 17000 : 12000, cleS = (Piste.TRACES[ci] || {}).peint, feux = f ? 3200 : 0;
  GP_HORLOGE = { t0: performance.now(), pauses: 0, pause: 0, total: d + feux, feux, cle: cleS, son: true };
  if (window.SONS) SONS.course(d, feux, cleS);
  const dire = t => { const b = document.querySelector("#gp-piste .gp-com"); if (b) b.innerHTML = t ? '<span class="gp-com-t">' + esc(t) + "</span>" : ""; };
  const info = t => { const b = document.querySelector("#gp-piste .gp-st-info"); if (b) b.textContent = t; };
  GP_COM.forEach(clearTimeout); GP_COM = []; const H = GP_HORLOGE; let k0 = -1;
  const iv = setInterval(() => { if (GP_HORLOGE !== H) { clearInterval(iv); return; } const t = tempsCourse(H); let k = -1; lignes.forEach((x, j) => { if (feux + x[0] * d + 150 <= t) k = j; }); if (k > k0) { k0 = k; dire(lignes[k][1]); } if (t > d + feux + 400) clearInterval(iv); }, 120);
  GP_COM.push(iv);
  const finir = () => { if (!D0.enCours) return; D0.enCours = false; D0.fini = true; GP_HORLOGE = null; setTimeout(majPauseGP, 0);
    if (window.SONS) SONS.arrivee("fanfare", v1 === moiPilote(), cleS);
    dire("🏁 " + v1 + " gagne la course de démo !"); info("🎬 Démo terminée · rien ne compte. Le vrai départ : le 1er décembre."); };
  Object.assign(D0, { enCours: true, fini: false, scen, finir });
  api.jouerScenario(scen, d, finir, f); majPauseGP();
}
/** la manche i se court-elle en direct (mois en cours, résultats pas connus) ? → { dv, grille, pts } ou null */
function courseDirect(etapes, i, kGP) {
  const et = etapes[i]; if (!et || et.m || i !== etapes.length - 1 || apercuSaison()) return null;
  const dv = directGP(kGP); if (!dv || dv.j < 1) return null;
  const grille = mancheGP(etapes, i, kGP).grille, pts = {}; grille.forEach((n, r) => { pts[n] = dv.f - r * DIRECT_ECART; });
  const dep = {}; grille.forEach((n, r) => { dep[n] = -r * DIRECT_ECART; });
  return { dv, grille, pts, dep };
}
/** v20.47 · le bandeau de sous-titres SOUS le dessin : à gauche le tour (ou « Direct »), à droite une ligne de commentaire, les bulles de points, ou l'état de la manche */
function bandeauST(y, et, i, kGP, dir, met, mc0, demo) {
  let tour = "", info = "";
  if (demo) { tour = "🎬 Démo"; info = "🎬 Démo · rien ne compte : performances tirées au hasard, météo aussi (" + met.ico + " " + met.nom + ")."; }
  else if (dir && dir.dv.fini) { tour = "🏁 Tour <b>1</b> fini"; info = "🏁 Mois fini : tour 2 dès que tous les relevés sont là."; }   // mois fini, pas encore clos : plus de « direct »
  else if (dir) { tour = '<i class="gp-live" aria-hidden="true"></i>Direct · Tour <b>1</b>/' + TOURS_GP;
    info = met.ico + " Jour " + dir.dv.j + "/" + dir.dv.N + " · " + (dir.dv.r === null ? "le peloton avance avec les jours" : texteIndice(dir.dv.r, "depuis le 1er", true)); }   // court (2 lignes au plus à 390 px), sans répéter la phrase du titre
  else if (!et.m) { tour = "Sur la grille"; info = "🚦 Départ le 1<sup>er</sup> " + esc(moisLong(kGP).replace(/ \d{4}$/, "")) + " : on avance avec les jours et le S&P 500."; }
  else info = "🏁 Course courue · ↻ Revoir pour la regarder encore.";
  return '<div class="gp-st"><span class="gp-tour">' + tour + '</span><div class="gp-st-l"><div class="gp-com" aria-live="polite"></div><div class="gp-pops"></div><div class="gp-st-info">' + (/<sup>|<b /.test(info) ? info : esc(info)) + "</div></div></div>";
}
/** 📐 le schéma de la course (sous la piste et dans les règles) : 4 étapes dessinées, une phrase courte chacune */
function svgSchemaCourse() {
  const voit = (x, y, c, n) => '<g transform="translate(' + x + " " + y + ')"><circle r="7" fill="' + c + '" stroke="#fff" stroke-width="1.5"/><text y="3" text-anchor="middle" class="sc-n">' + n + "</text></g>";
  const C = ["#E5484D", "#3E8BFF", "#F2B33D", "#3DDC97", "#B4E33D"], route = '<path d="M8 46H112" class="sc-route"/>', ligne = x => '<g class="sc-ligne"><rect x="' + x + '" y="34" width="4" height="24"/></g>';
  const e = [
    ['<svg viewBox="0 0 120 64" aria-hidden="true">' + route + ligne(96) + voit(84, 40, C[0], 1) + voit(70, 52, C[1], 2) + voit(56, 40, C[2], 3) + voit(42, 52, C[3], 4) + voit(28, 40, C[4], 5) + '<text x="60" y="18" text-anchor="middle" class="sc-t">🚦</text></svg>', "La grille : l'ordre du classement d'avant le mois."],
    ['<svg viewBox="0 0 120 64" aria-hidden="true">' + route + '<rect x="30" y="4" width="28" height="22" rx="4" class="sc-cal"/><text x="44" y="20" text-anchor="middle" class="sc-tc">10</text><path d="M64 15H88" class="sc-fl" marker-end="url(#scf)"/>' + voit(98, 46, C[0], 1) + voit(84, 46, C[1], 2) + voit(70, 46, C[2], 3) + voit(56, 46, C[3], 4) + voit(42, 46, C[4], 5) + "</svg>", "Chaque jour du mois, le peloton avance ; le dernier jour, il passe la ligne d'arrivée."],
    ['<svg viewBox="0 0 120 64" aria-hidden="true"><text x="27" y="22" text-anchor="middle" class="sc-t">☀️</text><text x="27" y="40" text-anchor="middle" class="sc-up">S&amp;P ↑</text><text x="27" y="56" text-anchor="middle" class="sc-p">en avance</text><text x="90" y="22" text-anchor="middle" class="sc-t">🌧️</text><text x="90" y="40" text-anchor="middle" class="sc-down">S&amp;P ↓</text><text x="90" y="56" text-anchor="middle" class="sc-p">en retard</text><path d="M56 8V58" class="sc-sep"/></svg>', "Le S&P 500 du mois : il pousse ou freine tout le monde (jamais de recul)."],
    ['<svg viewBox="0 0 120 64" aria-hidden="true">' + route + ligne(96) + '<text x="98" y="26" text-anchor="middle" class="sc-t">🏁</text>' + voit(108, 46, C[2], 1) + voit(86, 40, C[0], 2) + voit(72, 52, C[3], 3) + voit(56, 46, C[1], 4) + voit(40, 52, C[4], 5) + "</svg>", "Mois fini : tour 2, dans l'ordre des points du mois."]
  ];
  return '<ol class="gp-schema-l"><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><marker id="scf" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" class="sc-fm"/></marker></defs></svg>' +
    e.map((x, k) => '<li><span class="sc-k">' + (k + 1) + "</span>" + x[0] + "<p>" + esc(x[1]) + "</p></li>").join("") + "</ol>" +
    '<p class="gp-schema-p">Ta place ne bouge pas avant la fin du mois : aucun point ne dépend du direct.</p>';
}
/* ---------- Grands Prix : un circuit à thème par mois (le dessin 3D / 2D est dans piste.js) ---------- */
const GPS = {
  abudhabi: { gp: "L'Atelier du Père Noël", ville: "Atelier du Père Noël", drap: "🎅", fx: "garage", txt: "Là où les lutins montent les voitures de 2027, sous la neige et les guirlandes : le tour de chauffe." },
  bahrein: { gp: "Grand Prix du Petit Chef", ville: "Paris, la nuit", drap: "🐀", fx: "lucioles", atout: "turbo", piege: "pluie", txt: "Des toits de Paris aux fourneaux du grand restaurant : tout le monde peut cuisiner, mais un seul gagne." },
  djeddah: { gp: "Grand Prix du Château", ville: "Château aux sortilèges", drap: "🏰", fx: "sortileges", atout: "aspiration", piege: "pari", txt: "Les escaliers changent de place et les couloirs se referment derrière toi." },
  melbourne: { gp: "Grand Prix des Merveilles", ville: "Pays des merveilles", drap: "🎩", fx: "petales", atout: "pluie", piege: "turbo", txt: "On tombe dans un terrier, on boit une fiole, on rétrécit… et le Chapelier sert le thé à toute heure." },
  suzuka: { gp: "Grand Prix de l'Anneau", ville: "Terre de l'Anneau", drap: "💍", fx: "lucioles", atout: "pari", piege: "aspiration", txt: "De la Comté à la montagne de feu : un seul anneau, une seule ligne d'arrivée." },
  miami: { gp: "Grand Prix de Pandora", ville: "Pandora", drap: "🌿", fx: "lucioles", atout: "turbo", piege: "pluie", txt: "Une jungle géante en plein jour, l'Arbre des Âmes au centre et des oiseaux-dragons dans le ciel bleu : on court au cœur de Pandora." },
  montreal: { gp: "Grand Prix des Étoiles", ville: "Bataille spatiale", drap: "🌌", fx: "neige", atout: "pari", piege: "turbo", txt: "Il y a bien longtemps, dans une galaxie lointaine… cinq pilotes ont rejoint l'escadrille." },
  silverstone: { gp: "Grand Prix de la Mer de dunes", ville: "Mer de dunes", drap: "🏜️", fx: "sable", atout: "aspiration", piege: "pari", txt: "Deux soleils, du sable à l'infini et, sous la piste, quelque chose d'immense qui bouge." },
  spa: { gp: "Grand Prix du Monde à l'envers", ville: "Monde à l'envers", drap: "🔦", fx: "brume", atout: "pluie", piege: "turbo", txt: "Les lumières clignotent, la forêt se retourne : quelque chose rôde de l'autre côté." },
  monza: { gp: "Grand Prix du Multivers", ville: "Le Multivers", drap: "🌀", fx: "eclairs", atout: "aspiration", piege: "pluie", txt: "Des mondes cousus entre eux, des portails qui s'ouvrent, des héros… et un gant qui n'attend que six pierres." },
  singapour: { gp: "Grand Prix de la Chocolaterie", ville: "La Chocolaterie", drap: "🍫", fx: "sortileges", atout: "pari", piege: "aspiration", txt: "Une rivière de chocolat, des sucettes géantes, un ascenseur de verre… et peut-être le dernier ticket d'or." },
  interlagos: { gp: "Grand Prix du Mur des titans", ville: "Mur des titans", drap: "🧱", fx: "cendres", atout: "pluie", piege: "aspiration", txt: "Une piste au pied d'un mur de cinquante mètres. De l'autre côté, des géants." },
  lasvegas: { gp: "Grand Prix de l'Odyssée", ville: "L'Odyssée", drap: "🌊", fx: "eclairs", atout: "turbo", piege: "pari", txt: "Dix ans pour rentrer chez soi : Cyclope, Sirènes et tempêtes entre Troie et Ithaque. La dernière course de l'année." },
  monaco: { gp: "Grand Prix du Plateau maudit", ville: "Plateau maudit", drap: "🎲", fx: "des", atout: "pari", piege: "turbo", txt: "Un jeu de société géant : chaque case peut te faire avancer… ou reculer. Les dés sont pipés." }
};
const CAL_GP = ["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza"];   // V16.55 (Théo) : Dune en janvier (sortie du film), Ratatouille en juillet, l'Odyssée en septembre, Secret Wars en finale (décembre, sortie du film)
/** Circuit d'un mois : le Garage des rêves pour la chauffe, sinon le calendrier (V16.14 : le mois du Côté obscur garde son circuit, la règle s'y ajoute) */
function circuitDe(k) {
  if (!k || (k === CHAUFFE_K && !apercuSaison())) return "abudhabi";   // v16.84 : en saison simulée (admin), décembre = la Finale du Multivers
  return CAL_GP[((k % 100) - 1 + 12) % 12];
}
/** Atout du circuit d'un mois, quand la règle compte pour ce mois (sinon null) ; plus de piège depuis la V12 */
function atoutsDe(k) {
  if (!k || k === CHAUFFE_K || !regleActive("circuits", k)) return null;
  const cote = k === monacoMois(Math.floor(k / 100)) && regleVisible("monaco") && regleActive("monaco", k);   // le Côté obscur garde l'atout de l'ancien Plateau maudit (calcul inchangé)
  const g = GPS[cote ? "monaco" : circuitDe(k)]; if (!g || !g.atout) return null;
  return { atout: carteDef(g.atout), piege: null, g };
}
/** Atout d'un circuit : secret jusqu'à la révélation des cartes (le 2 du mois, chauffe comprise) */
function circuitRevele(k) {
  if (!k || apercuSaison()) return true;
  const d = new Date(), kAuj = d.getFullYear() * 100 + d.getMonth() + 1;
  return kAuj > k || (kAuj === k && d.getDate() >= jourLimite(k));
}
/** … et ce qu'on a le droit d'en montrer aujourd'hui */
function atoutsVus(k) { return regleVisible("circuits") && circuitRevele(k) ? atoutsDe(k) : null; }
/** Avant la révélation : un indice. L'atout est caché parmi deux cartes (l'autre est un leurre). */
function indiceCircuit(k) {
  if (!regleVisible("circuits") || circuitRevele(k)) return null;
  const a = atoutsDe(k); if (!a) return null;
  const autres = CARTES.filter(c => c.id !== a.atout.id); if (!autres.length) return null;
  const h = Math.imul(k ^ 0x5bd1e995, 2654435761) >>> 0;
  const leurre = autres[h % autres.length], duo = (h >>> 8) % 2 ? [a.atout, leurre] : [leurre, a.atout];
  return { duo, ids: duo.map(c => c.id), g: a.g };
}
/** L'indice en une pastille (même style que l'atout) */
function htmlIndice(ind, petit) {
  const t = "Indice de " + ind.g.ville + " : l'atout est " + ind.duo[0].ico + " " + ind.duo[0].nom + " ou " + ind.duo[1].ico + " " + ind.duo[1].nom + ". Réponse le 2, avec les cartes.";
  return '<' + (petit ? "small" : "div") + ' class="gp-atouts"' + (petit ? ' style="margin-top:6px"' : "") + '><span class="at" data-bdg="' + esc(t) + '" title="' + esc(t) + '">🔍 ' + ind.duo[0].ico + " ou " + ind.duo[1].ico + " +1 ?</span>" + '</' + (petit ? "small" : "div") + ">";
}
function couleurCasque(nom, e) {
  const c = couleur(nom);
  return { uni: c, carbone: "#2d333d", eclair: c, damier: "#f5f5f2", tortue: "#2F8A45", chrome: "#d4dae1", etoile: "#F7CF55", holo: "#B98CFF", couronne: "#F7CF55", foudre: "#0B1020", phenix: "#FF8A1F", glace: "#BFEFFC", galaxie: "#5B2A9E", empereur: "#6B2FB3", eclaireur: "#2F6B3B", toque: "#FAFAF6", anneau: "#2A2420", rebelle: "#F57A2E", hoplite: "#C08A3E", fracture: "#1A1530" }[e && e.casque] || c;
}
const CAMS = { tv: "🎥 TV", helico: "🚁 Hélico", bord: "👁️ Embarquée" };
function camGP() { return "helico"; }   // V16.58 (Théo) : la course se regarde en 2D ou en hélico ; la vue TV et l'embarquée sont retirées
function piste3D() { return !!(window.Piste && (Piste.supporteVite || Piste.supporte)()); }   // v20.53 : sans ouvrir de contexte 3D (le vrai test se fait en montant la 3D, qui retombe sur la 2D au besoin)
/* v17.6 · NOUVELLES VUES (Théo) : 🗺️ Carte 2D · 📺 Visite (la carte 3D seule, caméra libre, pour chercher le trésor) · 🚁 Hélico (poursuite d'une voiture)
   + gros bouton « ⛶ Plein écran » (vrai plein écran, paysage). D'abord sur le circuit de Noël seulement : on ajoute les autres ici quand ils sont prêts. */
const VUES_V2 = ["abudhabi"];
const VUES_TXT = { "2d": ["🗺️", "Carte"], visite: ["📺", "Visite"], poursuite: ["🚁", "Hélico"] };
function vuesV2(ci) { return true; }   // v17.33 (Théo) : les nouvelles vues et le plein écran partout (aperçu « Tout afficher » compris), comme au tour de chauffe
/** la vue choisie sur un circuit « V2 » : "2d", "visite" ou "poursuite" (null sur les autres circuits) */
function vueGP(ci) { if (!vuesV2(ci)) return null; return ETAT.gp2d !== "0" || !piste3D() ? "2d" : ETAT.gpVue3 === "poursuite" ? "poursuite" : "visite"; }
/** la voiture suivie en 🚁 Hélico : la sienne par défaut, sinon la 1re */
function suiviGP() { const ok = n => n && D.personnes.some(p => p.nom === n); return ok(ETAT.gpSuivi) ? ETAT.gpSuivi : ok(moiPilote()) ? moiPilote() : D.personnes[0].nom; }
function selVuesGP(vue, cls) {
  return '<div class="gp-sel ' + cls + '" role="group" aria-label="Choisir la vue">' + Object.entries(VUES_TXT).filter(([k]) => k === "2d" || piste3D()).map(([k, [ico, t]]) =>
    '<button type="button" data-gpv="' + k + '" aria-pressed="' + (k === vue) + '"><span aria-hidden="true">' + ico + "</span> " + t + "</button>").join("") +
    "</div>";   // v20.62 : le segment « 🛸 Survol » est remplacé par le bouton 🎥 Tour de présentation
}
/** applique la vue 3D à la piste déjà montée (sans la reconstruire ni couper la course) */
function appliquerVue3(api, vue) {
  if (!api || api.type !== "3d") return; const m = vue === "poursuite" ? "poursuite" : "helico";
  if (api.mode() !== m) api.camera(m); if (api.voitures) api.voitures(vue !== "visite"); if (vue === "poursuite") api.focus(suiviGP());
}
function majVueDOM(vue) {
  const pi = document.getElementById("gp-piste"); if (pi) ["visite", "poursuite", "2d"].forEach(v => pi.classList.toggle("vue-" + v, v === vue));
  document.querySelectorAll("[data-gpv]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.gpv === vue)));
  const s = suiviGP(); document.querySelectorAll("[data-suivre]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.suivre === s)));
}
const PRECHARGE_CARTES = {};   // v17.32
/** v20.53 (Théo : écran noir en arrivant sur le Podium) · les cartes que CE joueur peut voir aujourd'hui (jamais un univers pas encore révélé) :
    avant le 1er janvier 2027, la seule carte du tour de chauffe ; ensuite le mois commencé et le précédent. Aperçu admin : rien d'avance (à la demande). */
function cartesVisiblesGP() {
  try { if (!D || !window.Piste || !self.CARTES_CUITES || !saisonVisible() || apercuSaison()) return [];
    const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1, l = k < SAISON.premiere * 100 + 1 ? [CHAUFFE_K] : [k, k % 100 === 1 ? CHAUFFE_K : k - 1];
    return [...new Set(l.map(m => { const c = (Piste.TRACES[circuitDe(m)] || {}).peint, v = c && self.CARTES_CUITES[c]; return v ? circuitDe(m) + "|img/cartes/" + c + ".webp?v=" + v : null; }).filter(Boolean))].map(x => x.split("|"));
  } catch (e) { return []; }
}
const ECONOMIE_DONNEES = () => { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } };
/** dès que les données sont là, quand le téléphone ne fait rien : ces cartes sont téléchargées et décodées (le Podium les affiche ensuite instantanément),
    leur décor animé est préparé, et le hors connexion les garde. Mode « économie de données » du téléphone : rien d'avance (elles se gardent au 1er affichage). */
function prechargerCartesGP() {
  try { if (ECONOMIE_DONNEES()) return; const l = cartesVisiblesGP(); if (!l.length) return;
    l.forEach(([, u]) => { if (PRECHARGE_CARTES[u]) return; const im = new Image(); im.decoding = "async"; im.src = u; try { im.decode().catch(() => { }); } catch (e) { } PRECHARGE_CARTES[u] = im; });
    const ric = window.requestIdleCallback || (fn => setTimeout(fn, 400));
    l.forEach(([ci], j) => setTimeout(() => ric(() => { if (Piste.prechauffer) Piste.prechauffer(ci); }, { timeout: 4000 }), 1500 + j * 1500));
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ cartes: l.map(([, u]) => u) });
  } catch (e) { /* rien à précharger */ }
}
function choisirVueGP(v, y) {
  const pi = document.getElementById("gp-piste"), de3d = pi && !pi.classList.contains("en2d") && GP_INST && GP_INST.api.type === "3d";
  ETAT.gp2d = v === "2d" ? "1" : "0"; if (v !== "2d") ETAT.gpVue3 = v; garder();
  if (v !== "2d" && de3d) { appliquerVue3(GP_INST.api, v); majVueDOM(v); GP_ETQ = null; etiquettesGP(GP_INST.api); }   // 3D → 3D : même piste, la caméra change en douceur
  else rendreTrophees();
  if (v === "2d" || TRESOR_APERCU) return;   // v17.35 : pendant l'aperçu du trésor, rien de gardé
  const cle = "versus.aideVue." + v; if (stock.get(cle)) return; stock.set(cle, "1");
  setTimeout(() => toast(v === "visite" ? "📺 Visite : glisse pour tourner, pince pour zoomer. De près, glisse pour te déplacer, ou utilise le joystick en bas. Les voitures sont au garage : à toi le décor !" : "🚁 Hélico : la caméra suit ta voiture. Touche une pastille pour suivre un autre pilote."), 600);
}
function suivreGP(n) { ETAT.gpSuivi = n; garder(); if (GP_INST && GP_INST.api.type === "3d") GP_INST.api.focus(n); const pi = document.getElementById("gp-piste"); majVueDOM(pi ? vueGP(pi.dataset.circuit) : null); }
function couleurAccent() { try { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#9B87FF"; } catch (e) { return "#9B87FF"; } }
/** Vignette du filtre de course (cosmétique « Filtre de course » de l'écurie, ex-« Ambiance ») */
const AMBIANCES = {
  classique: { h: "#3D86DD", o: "#BFE3F8", s: "#5E9E52", astre: "soleil" },
  monaco: { h: "#03060F", o: "#1C2850", s: "#1E2A22", astre: "lune" },
  desert: { h: "#5C86C9", o: "#FFC98A", s: "#8A7A4A", astre: "couchant" },
  neige: { h: "#9FB5CC", o: "#EEF3F8", s: "#E8EEF4", astre: "neige" },
  neon: { h: "#0B0220", o: "#FF2E97", s: "#12062A", astre: "synth" }
};
function vignetteAmbiance(id) {
  const a = AMBIANCES[id] || AMBIANCES.classique, u = "va" + (++NSVG);
  const astre = { soleil: '<circle cx="290" cy="46" r="20" fill="#FFF3C4"/>', lune: '<circle cx="290" cy="46" r="16" fill="#E8EEFF"/><circle cx="298" cy="40" r="14" fill="' + a.h + '"/>' + [[40, 30], [90, 60], [150, 22], [210, 70], [250, 28], [330, 90], [120, 96]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.6" fill="#fff"/>').join(""),
    couchant: '<circle cx="180" cy="128" r="34" fill="#FFE0A3" opacity=".9"/>', neige: [[30, 40], [80, 90], [140, 30], [200, 100], [260, 50], [320, 80], [110, 150], [300, 170], [60, 190]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#fff"/>').join(""),
    synth: '<circle cx="180" cy="126" r="40" fill="#FFB347"/>' + [0, 1, 2, 3].map(i => '<rect x="130" y="' + (104 + i * 7) + '" width="100" height="' + (1.5 + i) + '" fill="' + a.o + '"/>').join("") }[a.astre];
  const sol = id === "neon" ? Array.from({ length: 9 }, (_, i) => '<path d="M180 130L' + (i * 60 - 60) + ' 240" stroke="#B03AFF" stroke-width="1.2"/>').join("") + [150, 175, 210].map(y => '<path d="M0 ' + y + 'H360" stroke="#B03AFF" stroke-width="1.2"/>').join("") : "";
  const lum = id === "neon" ? ["#22D3EE", "#FF4FD8"] : id === "monaco" ? ["#FFE7A8", "#FFE7A8"] : ["#ffffff", "#ffffff"];
  return '<svg class="vg-piste" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a.h + '"/><stop offset="1" stop-color="' + a.o + '"/></linearGradient></defs>' +
    '<rect width="360" height="132" fill="url(#' + u + ')"/>' + astre + '<rect y="130" width="360" height="110" fill="' + a.s + '"/>' + sol +
    '<path d="M150 130H210L330 240H30Z" fill="' + (id === "neige" ? "#5A6472" : id === "neon" ? "#120B2A" : "#3A3E46") + '"/><path d="M155 130 46 240M205 130 314 240" stroke="' + lum[0] + '" stroke-width="3"/><path d="M180 136V146M180 160V176M180 192V216" stroke="' + lum[1] + '" stroke-width="3" opacity=".8"/></svg>';
}
/** Position au championnat : cumul de points de chacun, mois par mois (avec le départ) */
/** V16.10 · la manche du mois i : grille (classement avant le mois), points gagnés dans le mois, longueur du tour = meilleur score du mois */
/** v17.10 (Théo) · grille d'une manche SANS classement d'avant :
    tour de chauffe (décembre 2026) = la performance de NOVEMBRE (% du mois, places au barème d'un mois normal ; sans relevé de novembre : derrière) ;
    janvier de la saison 1 = l'ordre du tour de chauffe de décembre (tant que son résultat n'est pas connu : sa grille, novembre), puis les absents de la chauffe par ordre alphabétique ;
    repli (pas de tour de chauffe) : grille tirée au sort, la même pour tous et à chaque ouverture (graine = clé du mois + noms triés), écart fixe.
    Renvoie { avant: valeurs (plus grand = devant), ordre?: tirage, de: "novembre" | "chauffe" | "chauffe-grille" | "tirage" } ou null. Aucun point n'en dépend. */
function grilleSansClassement(k, noms) {
  if (k === CHAUFFE_K) {
    const du = rendementsDuMois(0, CHAUFFE_K - 1).filter(x => noms.includes(x.nom)).sort((a, b) => b.r - a.r), n = du.length, avant = {};
    if (!n) return null;
    const RG = []; du.forEach((x, j) => { RG[j] = j && du[j - 1].r - x.r < 1e-9 ? RG[j - 1] : j + 1; });
    noms.forEach(nm => avant[nm] = -1); du.forEach((x, j) => avant[x.nom] = ptsRang(RG[j], n));
    return { avant, de: "novembre" };
  }
  if (k === SAISON.premiere * 100 + 1) {
    // v20.47 (Théo) : janvier 2027 part dans l'ordre du tour de chauffe de décembre (tant qu'il n'est pas connu : sa grille, novembre) ; absents derrière, par ordre alphabétique
    const zero = Object.fromEntries(noms.map(n => [n, 0])), alpha = (a, b) => a.localeCompare(b, "fr");
    if (estChauffe(SAISON.premiere - 1)) {
      const ch = championnat(SAISON.premiere - 1); let tete = ch.complete ? ch.classement.filter(n => noms.includes(n)) : [], de = "chauffe";
      if (!tete.length) { const g = grilleSansClassement(CHAUFFE_K, noms); if (g) { tete = noms.filter(n => g.avant[n] >= 0).sort((a, b) => g.avant[b] - g.avant[a] || noms.indexOf(a) - noms.indexOf(b)); de = "chauffe-grille"; } }
      if (tete.length) return { avant: zero, ordre: tete.concat(noms.filter(n => !tete.includes(n)).sort(alpha)), de };
    }
    const l = noms.slice().sort(); let h = 2166136261; for (const ch of k + "|" + l.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const alea = () => { h = h + 0x6D2B79F5 >>> 0; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };   // mulberry32
    for (let j = l.length - 1; j > 0; j--) { const r = Math.floor(alea() * (j + 1)); [l[j], l[r]] = [l[r], l[j]]; }
    return { avant: Object.fromEntries(noms.map(n => [n, 0])), ordre: l, de: "tirage" };
  }
  return null;
}
function mancheGP(etapes, i, kDef) {
  const noms = D.personnes.map(p => p.nom), et = etapes[i], prec = et.avenir ? et.pts : i > 0 ? etapes[i - 1].pts : Object.fromEntries(noms.map(n => [n, 0]));
  const k = et.k || kDef, sans = (i <= 1 && noms.every(n => !(prec[n] || 0))) ? grilleSansClassement(k, noms) : null, ref = sans ? sans.avant : prec;
  const rang0 = sans && sans.ordre ? sans.ordre : noms;
  const grille = noms.slice().sort((a, b) => (ref[b] || 0) - (ref[a] || 0) || rang0.indexOf(a) - rang0.indexOf(b));
  const gains = {}; noms.forEach(n => gains[n] = i > 0 && !et.avenir ? Math.max(0, (et.pts[n] || 0) - (prec[n] || 0)) : 0);
  const max = Math.max(0, ...Object.values(gains));
  return { grille, avant: ref, grilleDe: sans ? sans.de : null, depart: Object.fromEntries(noms.map(n => [n, 0])), arrivee: gains, tour: max > 0 ? max : TOUR_GP };
}
function etapesGP(y) {
  const c = championnat(y), noms = D.personnes.map(p => p.nom);
  const etapes = [{ k: null, pts: Object.fromEntries(noms.map(n => [n, 0])) }];
  c.mois.forEach(m => { const prec = etapes[etapes.length - 1].pts, pts = {}; noms.forEach(n => pts[n] = m.cumul[n] !== undefined ? m.cumul[n] : prec[n]); etapes.push({ k: m.k, pts, m }); });
  // V16.10 · le mois en cours se montre dès le 1er : son circuit, les voitures sur la grille dans l'ordre du classement
  if (!c.chauffe) { const d = new Date(), kAuj = apercuSaison() ? y * 100 + 12 : d.getFullYear() * 100 + d.getMonth() + 1, der = etapes[etapes.length - 1];
    const kn = der.k ? (der.k % 100 === 12 ? 0 : der.k + 1) : y * 100 + 1;
    if (kn && Math.floor(kn / 100) === y && kn <= kAuj) { if (!der.k) Object.assign(der, { k: kn, avenir: true }); else etapes.push({ k: kn, pts: Object.assign({}, der.pts), avenir: true }); } }
  return etapes;
}
/** l'étape montrée par défaut : la course qui vient d'être courue si on ne l'a pas encore vue, sinon le mois en cours */
function etapeParDefaut(etapes, y) {
  const vu = +(stock.get("versus.gpVu." + y) || 0); let j = etapes.length - 1; while (j > 0 && etapes[j].avenir) j--;
  return etapes[j].k && !etapes[j].avenir && etapes[j].k > vu ? j : etapes.length - 1;
}
let GP_ETAPE = null, GP_ANIM = null;
const GP_OUVERTS = new Set();   // lot53 : lignes du mois dépliées pendant la visite seulement (tout revient replié à la réouverture, règle de Théo)
/** v20.16 (Théo) : PLUS AFFICHÉ (doublon avec l'onglet Classement ; le Podium = les points). lot47 · tour de chauffe (jusqu'au 31/12/2026) : un classement d'EXEMPLE sous la grille = la performance 2026 (PEA + assurance-vie,
 *  depuis le 1er janvier 2026), comme l'onglet Classement. Il ne compte pas et ne dévoile rien de la saison 2027. */
function classementExemple() {
  try {
    const fin = Math.min(finGlobale(D, 0), 202612), deb = 202512, qui = quiEcurie();
    const l = D.personnes.map(p => stats(D, p, 0, deb, fin, null, null)).filter(s => s.n > 0 && ok(s.twr)).sort((a, b) => b.twr - a.twr);
    if (!l.length) return "";
    return '<div class="ex26"><div class="ex26-h"><b>Classement 2026</b><small>pour l\'exemple · ne compte pas</small></div>' +
      l.map((s, i) => '<div class="ex26-l' + (s.nom === qui ? " ici" : "") + '"><span class="rk">' + (i + 1) + "</span>" + avatar(s.nom) + '<span class="nm">' + esc(s.nom) + '</span><span class="t ' + sens(s.twr) + '">' + pct(s.twr) + "</span></div>").join("") +
      '<p class="ex26-p">Performance depuis le 1<sup>er</sup> janvier 2026 (PEA + assurance-vie), jusqu\'à fin ' + esc(MOIS_L[fin % 100 - 1]) + ". Le championnat, lui, démarre de zéro le 1<sup>er</sup> janvier.</p></div>";
  } catch (e) { return ""; }
}
function htmlGrandPrix(y) {
  if (GP_DEMO && GP_DEMO.fini && !GP_DEMO.lance) GP_DEMO = null;   // v20.52 : une démo finie s'efface au prochain affichage (retour à la vraie météo, voitures sur la grille)
  const etapes = etapesGP(y), c = championnat(y);
  const i = GP_ETAPE !== null && GP_ETAPE < etapes.length ? GP_ETAPE : etapeParDefaut(etapes, y), et = etapes[i];
  const nM = et.k ? et.k % 100 : i;   // le n° de manche affiché = le mois (en janvier, la manche 1 est la 1re étape : pas d'étape « Départ » avant elle)
  const qui = quiEcurie(), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), G = GPS[ci], at = atoutsVus(kGP);
  const met0 = meteoMois(et.k || (!et.m ? kGP : null)), spe = et.k ? moisSpecial(y, et.k) : null, pgm = et.m && et.m.piege ? et.m.piege : null;
  const mc0 = !et.m ? mancheGP(etapes, i, kGP) : null, ordre = mc0 && mc0.grilleDe ? mc0.grille : Object.keys(et.pts).sort((a, b) => et.pts[b] - et.pts[a] || (c.tot[b] ? c.tot[b].v : 0) - (c.tot[a] ? c.tot[a].v : 0));   // v17.10 : sur la grille, l'ordre de départ (novembre pour la chauffe, tirage en janvier)
  const tete = ordre[0], tourTete = Math.floor((et.pts[tete] || 0) / TOUR_GP) + 1;
  const deux = ETAT.gp2d !== "0" || !piste3D(), cam = camGP();   // V16.58 : la 2D par défaut
  const v2 = vuesV2(ci), vue = vueGP(ci), suivi = v2 ? suiviGP() : null;   // v17.6
  const dir = courseDirect(etapes, i, kGP), demoOk = demoPossible(et, dir), demo = demoOk && GP_DEMO ? GP_DEMO : null, met = meteoVue(demo ? demo.meteo : met0, ci);   // v20.52 : 🎬 démo avant le 1er décembre ; pictogramme adapté au circuit
  const stH = v2 ? bandeauST(y, et, i, kGP, dir, met, mc0, demo) : "";   // v20.47 : course en direct + sous-titres sous le dessin
  // v17.6 · la piste « V2 » ne garde AUCUN bouton sur l'image : vue, plein écran et « ⋯ » (bande-annonce, arrivée, tour de présentation) passent juste en dessous
  const menuV2 = '<div class="gp-outils"><button class="gp-son-b" type="button" data-son aria-label="Couper le son">🔊</button>' + '<details class="gp-plus"><summary aria-label="Plus d\'options">⋯</summary><div class="gp-plus-m">' + '<button type="button" class="gp-tourp-b" id="gp-tourp">🎥 Tour de présentation</button>' +   // v20.62 : remplace « 🛸 Survol guidé » (2D comme 3D)
    '<button type="button" id="gp-ba">🎬 Bande-annonce</button><button type="button" id="gp-fin">⏭ Aller à l\'arrivée</button><button type="button" id="gp-photo">📷 Mode photo</button></div></details></div>';   // v17.48 : le petit 🔊/🔇 à côté de « ⋯ »
  const suiviH = v2 && !deux ? '<div class="gp-suivi" role="group" aria-label="Voiture suivie">' + ordre.map(n => '<button type="button" data-suivre="' + esc(n) + '" style="--c:' + couleur(n) + '" aria-pressed="' + (n === suivi) + '" aria-label="Suivre ' + esc(n) + '">' + avatarCourse(n) + "</button>").join("") + "</div>" : "";
  const fondCuit = (() => { try { const k = (Piste.TRACES[ci] || {}).peint, c = self.CARTES_CUITES; if (!k || !c || !c[k]) return ""; const u = "img/cartes/" + k + ".webp?v=" + c[k];
    if (!(PRECHARGE_CARTES[u])) { const im = new Image(); im.src = u; try { im.decode().catch(() => { }); } catch (e) { } PRECHARGE_CARTES[u] = im; }   // v17.32 : image gardée décodée en mémoire
    return u; } catch (e) { return ""; } })();
  const piste = '<div class="gp-piste' + (deux ? " en2d" : "") + (v2 ? " v2 vue-" + vue : "") + '" id="gp-piste" data-circuit="' + ci + '"><div class="gp-scene" id="gp-scene"' + (deux && fondCuit ? ' style="background:#0B0D12 url(\'' + fondCuit + '\') center/cover no-repeat"' : "") + '></div>' +   // v17.32 (Théo) : plus de flash noir en revenant à la carte 2D
    (v2 ? "" : '<div class="gp-zones">' + (at ? '<span class="gp-zone at" data-zone="atout">' + at.atout.ico + ' <b>+1</b></span>' : "") + "</div>") +   // v20.47 : plus d'étiquette d'atout posée sur le dessin (l'atout est écrit sous le titre)
    '<div class="gp-tags3">' + ordre.map(n => '<span class="gp-t3' + (n === qui ? " ici" : "") + '" data-gpt3="' + esc(n) + '" style="--c:' + couleur(n) + '" title="' + esc(n) + '">' + avatarCourse(n) + '<i class="gp-rg"></i></span>').join("") + "</div>" +
    (v2 ? "" : '<div class="gp-pops"></div><div class="gp-com" aria-live="polite"></div>') + fxCircuit(G.fx) +
    (v2 ? stH :   // v20.47 (Théo) : aucun texte posé sur le dessin : tour, commentaires et bulles passent en sous-titres, dans un bandeau sous la course   // v17.6 : « Sur la grille » et la météo sont déjà dans le titre ; il ne reste que « Tour 1/2 » pendant la course
    '<div class="gp-hud"><span class="gp-tour">' + (et.k && !et.avenir ? "Manche <b>" + nM + "</b>" : "Sur la grille") + "</span><span>" + met.ico + " " + esc(met.nom) + "</span></div>") +
    (v2 ? "" : '<div class="gp-btns">' +
    '<button class="gp-vue" type="button" id="gp-vue" aria-label="' + (deux ? "Passer en vue hélico 3D" : "Revenir à la carte 2D") + '">' + (deux ? "🚁 Hélico 3D" : "🗺️ Carte 2D") + '</button><button class="gp-vue gp-son" type="button" data-son aria-label="Son">🔇</button>' + '<button class="gp-vue" type="button" id="gp-tourp" aria-label="Tour de présentation">🎥</button>' + '<button class="gp-vue" type="button" id="gp-ba" aria-label="Bande-annonce">' + icoOu("bandeannonce", "🎬") + '</button><button class="gp-vue" type="button" id="gp-fin" aria-label="Aller directement à la fin de la course">' + icoOu("arrivee", "⏭") + '</button><button class="gp-vue gp-pl" type="button" id="gp-plein" aria-label="Plein écran">' + icoOu("pleinecran", "⛶") + '</button>' + "</div>") + suiviH +
    (v2 ? "" : spe ? '<div class="gp-spe">' + spe.ico + " " + esc(spe.nom) + "</div>" : pgm ? '<div class="gp-spe piege" data-bdg="' + esc("Piège du circuit · " + pgm.nom + " : " + pgm.txt) + '">' + pgm.ico + " " + esc(pgm.nom) + "</div>" : "") + "</div>";
  const chips = '<div class="gp-mois">' + etapes.map((x, j) => '<button type="button" data-gpe="' + j + '" aria-pressed="' + (j === i) + '">' + (x.k ? GPS[circuitDe(x.k)].drap + " " + esc(moisCourt(x.k)) + (x.avenir ? " ⏳" : "") : "Départ") + "</button>").join("") + "</div>";
  const lignes = ordre.map((n, r) => {
    const devant = r ? ordre[r - 1] : null, ecart = devant ? et.pts[devant] - et.pts[n] : 0, x = et.m ? et.m.l.find(z => z.nom === n) : null;
    const ca = et.k ? carteDe(y, n, et.k) : null, cdef = ca && ca.c ? carteDef(ca.c) : null;
    const res = x && x.carte ? (x.carte.invalide ? (x.carte.piege ? " Interdite ce mois-ci (piège " + (et.m && et.m.piege ? et.m.piege.ico + " " + et.m.piege.nom : "du circuit") + ") : sans effet." : " Pas encore piochée à ce moment-là : sans effet.") : " Résultat : " + (x.carte.gain > 0 ? "+" : "") + x.carte.gain + " pt" + (Math.abs(x.carte.gain) > 1 ? "s" : "") + (x.carte.circ ? ", dont +1 d'atout du circuit" : "") + (x.carte.bouchon ? ", sans le +1 d'atout : bouchon, plusieurs pilotes l'ont jouée" : "") + (x.carte.sab ? " · " + x.carte.cible + " " + x.carte.sab : "") + ".") : "";
    // lot53 (Conseil, règle « une ligne = 3 zones ») : place · tête + NOM › + 2 pastilles au plus · total ; le calcul du mois ne s'ouvre qu'en touchant la ligne
    const P = [], I = [], pas = (w, pr, h) => P.push({ w, pr, h });   // P = bonus qui comptent (triés), I = infos sans point (seulement dans le détail)
    if (ca && !x) { if (ca.cache && !cdef) P.push({ w: 0, pr: 0, h: '<span class="gp-x gp-xc cache" data-bdg="Carte posée face cachée : révélée le ' + jourLimite(et.k) + ' du mois.">🂠</span>' }); else if (cdef) P.push({ w: 0, pr: 0, h: '<span class="gp-x gp-xc" data-bdg="' + esc(cdef.ico + " " + cdef.nom + " : " + cdef.def) + '">' + cdef.ico + "</span>" }); }
    if (x) {
      if (x.carte && cdef) { const g = x.carte.gain, h = '<span class="gp-x gp-xc' + (g < 0 ? " mal" : "") + '" data-bdg="' + esc(cdef.ico + " " + cdef.nom + " : " + cdef.def + res) + '">' + cdef.ico + (g ? (g > 0 ? "+" : "−") + Math.abs(g) : "") + "</span>"; if (g) pas(Math.abs(g), g > 0 ? 2 : 0, h); else I.push(h); }
      if (x.vainq) pas(x.vainq, 3, '<span class="gp-x or" data-bdg="🪱 Le Chevaucheur des sables : vainqueur du mois, +2.">🪱+2</span>');
      if (x.piege === "nuit" && x.dernier) pas(2, 3, '<span class="gp-x" data-bdg="🌃 Safety car de nuit : le dernier du mois marque 2 points de place.">🌃+2</span>');
      if (x.equipe) pas(1, 1, '<span class="gp-x" data-bdg="🤝 Bonus d\'équipe : tout le monde a battu le S&P 500 ce mois-ci, +1.">🤝+1</span>');
      if (x.serie) pas(1, 1, '<span class="gp-x" data-bdg="🔥 Série : ' + x.serie + ' mois d\'affilée sans finir dernier, +1.">🔥+1</span>');
      if (x.defi) pas(1, 1, '<span class="gp-x" data-bdg="' + esc((defiDuMois(et.k) || {}).ico + " Défi du mois réussi : " + (defiDuMois(et.k) || {}).txt + ", +1.") + '">🏁+1</span>');
      if (x.prono) { const h = '<span class="gp-x' + (x.prono.pts < 0 ? " mal" : "") + '" data-bdg="🔮 Pronostic : ' + esc((x.prono.v || "—") + (x.prono.i ? ", S&P " + (x.prono.i === "h" ? "plus de +1 %" : "pas plus de +1 %") : "") + (x.prono.p !== null && x.prono.p !== undefined ? ", pole " + String(x.prono.p).replace(".", ",") + " %" + (x.prono.pole ? " (la plus proche)" : "") : "")) + " → " + (x.prono.pts < 0 ? "−" + -x.prono.pts : "+" + x.prono.pts) + '.">🔮' + (x.prono.pts < 0 ? "−" + -x.prono.pts : "+" + x.prono.pts) + "</span>"; if (x.prono.pts) pas(Math.abs(x.prono.pts), x.prono.pts > 0 ? 1.5 : 0, h); else I.push(h); }
      if (x.rival) pas(3, 4, '<span class="gp-x or" data-bdg="😈 Rival de la saison : devant ' + esc(x.rival) + ' au championnat, +3.">😈+3</span>');
      if (x.regul !== undefined) pas(3, 4, '<span class="gp-x or" data-bdg="🛡️ Trophée de la régularité : le moins souvent dernier de la saison, +3.">🛡️+3</span>');
      if (x.mult > 1) { const h = '<span class="gp-x or" data-bdg="' + esc((et.m.spec ? et.m.spec.ico + " " + et.m.spec.nom + " : points de place doublés" : "Points doublés") + (x.plancher ? ", 2 au moins." : ".")) + '">×2</span>'; if (x.base || x.plancher) pas(x.base * (x.mult - 1) + (x.plancher || 0), 3, h); else I.push(h); }   // v20.52 : plancher du Côté obscur
      (x.vise || []).forEach(z => I.push('<span class="gp-x" data-bdg="🎲 Pari de ' + esc(z.par) + " contre " + esc(n) + " : " + (z.gain > 0 ? esc(z.par) + " a fini devant, +2 pour lui." : z.gain < 0 ? esc(n) + " a tenu bon, " + esc(z.par) + " perd 1 point." : "égalité parfaite, 0.") + '">🎲' + (z.gain > 0 ? "" : "✓") + "</span>"));
      if (x.pioche && x.pioche.length && regleVisible("pioche") && !estChauffe(y)) I.push('<span class="gp-x" data-bdg="🎴 Carte' + (x.pioche.length > 1 ? "s" : "") + " piochée" + (x.pioche.length > 1 ? "s" : "") + " ce mois-ci" + (n === qui ? " : " + esc(x.pioche.map(c => carteDef(c).nom).join(", ")) : "") + '.">🎴</span>');
    }
    P.sort((u, v) => v.w - u.w || v.pr - u.pr);
    const reste = P.length > 2, extra = P.slice(0, 2).map(z => z.h).join("") + (reste ? '<span class="gp-x plus" aria-hidden="true">…</span>' : "");
    const det = x ? '<div class="gp-det"><small class="gp-dec">' + esc(decompte(x, et.m.spec)) + "</small>" + (P.length > 2 || I.length ? '<span class="gp-det-x">' + P.slice(2).map(z => z.h).join("") + I.join("") + "</span>" : "") + "</div>" : "";
    const jn = (c.jeu || {})[n], niv = x ? x.niv + (x.monte || 0) : jn && !et.m ? 1 : (jn ? jn.niv : 1), cle = n + "|" + et.k, ouv = x && GP_OUVERTS.has(cle), top = x && x.rg === 1;
    return '<div class="gp-l' + (n === qui ? " ici" : "") + (x ? " dep" : "") + (ouv ? " ouvert" : "") + '"' + (x ? ' data-gp-det="' + esc(cle) + '" tabindex="0" aria-expanded="' + !!ouv + '" aria-label="' + esc(n + " : " + (x.p > 0 ? "+" : "") + x.p + " pt" + (Math.abs(x.p) > 1 ? "s" : "") + " ce mois-ci" + (top ? ", meilleur du mois" : "") + ". Toucher pour le détail.") + '"' : "") + '><span class="rk">' + (r + 1) + "</span>" + avatarCourse(n) + '<div class="nm"><b><span' + (attrLivree(n) ? attrLivree(n).replace(' class="', ' class="gp-nom ') : ' class="gp-nom"') + (saisonJouee() ? ' data-gp-fiche="' + esc(n) + '" role="button" tabindex="0" aria-label="Fiche et vitrine de ' + esc(n) + '"' : "") + ">" + esc(n) + (saisonJouee() ? '<i class="gp-vers-fiche" aria-hidden="true">›</i>' : "") + "</span>" + (regleVisible("niveaux") ? '<span class="gp-niv" data-bdg="Niveau d\'écurie ' + niv + ' : chaque niveau gagné donne une carte bonus.">N' + niv + "</span>" : "") + extra + "</b>" +
      det + "</div>" + '<span class="pt"><b>' + et.pts[n] + "</b><small" + (top ? ' class="top"' : "") + ">" + (x ? (x.p > 0 ? "+" : "") + x.p : "pts") + "</small></span></div>";
  }).join("");
  const cal = htmlCalendrierGP(y, kGP);
  const rap = rappelCartes(), versStand = rap ? '<button class="gp-stand" type="button" data-aller-stand>🃏 <span><b>Fenêtre ouverte</b> : pose ta carte de ' + esc(moisLong(rap.k)) + "</span> ›</button>" : "";
  const att = (c.attente ? '<div class="bref">⏳ ' + esc(moisLong(c.attente.k)) + " : le tour 2 se court dès que tout le monde a saisi son relevé, au plus tard 7 jours après la date (il manque " + c.attente.manquent.map(n => "<b>" + esc(n) + "</b>").join(" et ") + ").</div>" : "") +
    (c.chauffe && !et.m && Date.now() < SAISON.depart.getTime() ? '<p class="info gp-depart">🏁 Grille de départ : la performance de novembre. La course se joue avec le relevé de fin décembre.</p>' :
      !et.m && kGP === SAISON.premiere * 100 + 1 ? '<p class="info gp-depart">' + (mc0 && /^chauffe/.test(mc0.grilleDe || "") ? "🏁 Grille de départ : l'ordre du tour de chauffe de décembre" + (mc0.grilleDe === "chauffe-grille" ? " (sa grille, tant que son résultat n'est pas connu)" : "") + ", les absents de la chauffe derrière (par ordre alphabétique). Tout le monde part à 0 point." : '<span class="gp-de' + (stock.get("versus.deJanvier") ? "" : (stock.set("versus.deJanvier", "1"), " roule")) + '" aria-hidden="true">🎲</span> Grille tirée au sort : tout le monde part à 0 point.') + "</p>" : "");   // v17.5 (Théo) : sur la grille de la chauffe, du 21/11 au 31/12
  const titreAt = at ? '<div class="gp-atouts"><span class="at" data-bdg="' + esc("Atout de " + G.ville + " : " + at.atout.ico + " " + at.atout.nom + " y gagne +1 quand elle marque (sauf bouchon).") + '">' + at.atout.ico + " " + esc(at.atout.nom) + " +1</span></div>" : (indiceCircuit(kGP) ? htmlIndice(indiceCircuit(kGP)) : "");
  return versStand + att + '<div class="gp-h"><div><span class="s-k">' + (demo ? "🎬 Démo · rien ne compte" : c.chauffe ? "Tour de chauffe" + (dir ? (dir.dv.fini ? " · tour 1 terminé" : " · en direct") : "") : et.avenir ? "Manche " + nM + (dir ? (dir.dv.fini ? " · tour 1 terminé" : " · en direct") : " · sur la grille") : et.k ? "Manche " + nM : "Départ") + " · " + esc(moisLong(kGP)) + '</span><h3 class="gp-titre">' + G.drap + " " + esc(G.gp) + '</h3><p class="gp-met">' + esc(G.ville) + " · " + met.ico + " " + esc(met.txt) + (spe ? " " + spe.ico + " <b>" + esc(spe.nom) + "</b> : " + esc(spe.txt) : vuesV2(ci) && pgm ? ' <span data-bdg="' + esc("Piège du circuit · " + pgm.nom + " : " + pgm.txt) + '">' + pgm.ico + " <b>" + esc(pgm.nom) + "</b></span>" : "") + '</p></div><div class="gp-hb"><button class="btn ghost gp-pause" type="button" id="gp-pause" aria-label="Mettre la course en pause" hidden>⏸\uFE0F Pause</button>' + (demoOk ? '<button class="btn ghost gp-rejouer gp-demo" type="button" id="gp-demo" aria-label="Course de démonstration : une course pour de faux, rien ne compte">🎬 Course de<br>démonstration</button>' : '<button class="btn ghost gp-rejouer" type="button" id="gp-rejouer">↻ Revoir</button>') + "</div></div>" +
    titreAt + piste + (v2 ? '<div class="gp-vues2">' + selVuesGP(vue, "") + menuV2 + '<button class="gp-plein-gros" type="button" id="gp-plein-gros"><span aria-hidden="true">⛶</span> Plein écran</button></div>' : "") + (v2 ? '<details class="gp-schema"><summary>📐 Comment avance la course ?</summary>' + svgSchemaCourse() + "</details>" : "") + chips + '<div class="gp-liste">' + lignes + "</div>" + (et.m ? '<button class="btn ghost gp-carte" type="button" id="gp-carte">📸 Carte postale · ' + esc(moisLong(et.k)) + "</button>" : "") + cal +
    '<p class="info">Chaque mois, une manche sur un nouveau circuit : départ dans l\'ordre du championnat, et le meilleur du mois boucle le tour.' + " Touche une icône pour le détail, une voiture pour la suivre." + (c.chauffe ? " 🔥 Rien ne compte pendant la chauffe." : "") + ' <a href="#" class="lien-regles" data-regles="gp">Règles</a></p>' +
    htmlDetailPoints(y);
}
/** V16 · ambiance animée du circuit à thème : un calque de particules (lucioles, neige, pluie néon, pétales, brume…) */
function fxCircuit(fx) {
  if (!fx) return "";
  const n = { lucioles: 18, neige: 26, pluieneon: 30, neon: 6, pixels: 16, petales: 16, brume: 5, spores: 18, sable: 14, cendres: 22, eclairs: 10, des: 7, sortileges: 16, garage: 8 }[fx] || 12;
  let h = 0; const r = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
  return '<div class="gp-fx fx-' + fx + '" aria-hidden="true">' + Array.from({ length: n }, (_, i) => '<i style="--x:' + (r() * 100).toFixed(1) + ";--y:" + (r() * 100).toFixed(1) + ";--d:" + (r() * 6).toFixed(2) + "s;--t:" + (3 + r() * 5).toFixed(2) + "s;--s:" + (.6 + r() * .9).toFixed(2) + '"></i>').join("") + "</div>";
}
/** Le calendrier des Grands Prix de la saison (atouts une fois révélés) */
function htmlCalendrierGP(y, kIci) {
  const ch = estChauffe(y), ks = ch ? [CHAUFFE_K] : Array.from({ length: 12 }, (_, i) => y * 100 + i + 1), auj = new Date(), kAuj = auj.getFullYear() * 100 + auj.getMonth() + 1;
  const lignes = ks.map(k => {
    const ci = circuitDe(k), g = GPS[ci], a = atoutsVus(k), ind = a ? null : indiceCircuit(k), spe = moisSpecial(y, k), pg = regleVisible("pieges") ? piegeMois(y, k) : null;
    return '<div class="gp-cal-l' + (k === kIci ? " ici" : "") + (k < kAuj && !apercuSaison() ? " passe" : "") + '"><span class="mo">' + esc(moisCourt(k).replace(/\.$/, "")) + "</span>" + (window.Piste ? Piste.vignette(ci) : "") +
      "<span><b>" + g.drap + " " + esc(g.ville) + (spe && spe.ico !== g.drap ? " " + spe.ico : "") + "</b><small>" + esc(g.gp) + (spe ? " · " + esc(spe.nom) : pg ? " · " + pg.ico + " " + esc(pg.nom) : "") + "</small></span>" +
      '<span class="ap">' + (a ? '<i class="p">' + a.atout.ico + "+1</i>" : ind ? '<i class="p" title="L\'atout est l\'une des deux">' + ind.duo[0].ico + "/" + ind.duo[1].ico + "?</i>" : "") + "</span></div>";
  }).join("");
  return '<details class="gp-calend" id="gp-calend"' + (ETAT.calOuvert === "1" ? " open" : "") + '><summary>📅 ' + (ch ? "Le circuit du tour de chauffe" : "Calendrier de la saison") + " <small>" + (ch ? "1 Grand Prix" : "12 Grands Prix, un circuit à thème par mois") + "</small></summary>" + lignes +
    (regleVisible("circuits") || ch || !saisonJouee() ? "" : '<p class="info" style="padding:8px 12px;margin:0">🎁 Bientôt : chaque circuit aura son atout.</p>') + "</details>";
}
/* ---------- Mes cartes ---------- */
let CARTE_CHOIX = null;
function kCartes(y) {
  if (!apercuSaison()) return kOuvertPour(y);
  const et = etapesGP(y); return GP_CIBLE || (et.slice(-1)[0].k ? cleMoins(et.slice(-1)[0].k, -1) : y * 100 + 1);
}
/** Texte d'une carte, avec l'indice et les améliorations du pilote */
function texteCarte(cd, up) {
  let t = cd.def.replace("l'indice", "le " + D.marche.indices[iRef()]);
  const a = Object.entries(AMELIOS).find(([, x]) => x.carte === cd.id);
  if (a && up && up[a[0]]) t += " " + a[1].ico + " " + a[1].nom + " niv. " + up[a[0]] + " : +" + up[a[0]] + ".";
  return t;
}
function htmlCartes(y) {
  const qui = moiPilote(); if (!qui || !D.personnes.some(p => p.nom === qui)) return "";
  const ap = apercuSaison(), src = ap ? ((cartesApercu()[y] || {})[qui] || {}) : Object.assign({}, (((D.cartes || {})[y] || {})[qui]) || {}, (mesCartes()[y] || {}));
  const joues = {}; Object.entries(src).forEach(([k, c]) => { if (c && c.c) (joues[c.c] = joues[c.c] || []).push(+k); });
  const utilisees = {}; Object.entries(joues).forEach(([id, ks]) => { utilisees[id] = Math.max(...ks); });
  const kOuvert = kCartes(y), j = jeuDe(qui, y), up = kOuvert ? amelioAu(y, qui, kOuvert, j.niv) : { m: 0, a: 0, p: 0 };
  const dejaMois = kOuvert && src[kOuvert] && src[kOuvert].c ? src[kOuvert].c : null;
  const pioche = regleVisible("pioche") ? j.pioche.map(z => Object.assign({ tire: z.k }, carteDef(z.c))) : [];
  const main = CARTES.concat(pioche);
  const atk = kOuvert ? atoutsVus(kOuvert) : null, indk = kOuvert && !atk ? indiceCircuit(kOuvert) : null;
  const tuile = cd => {
    // base : rejouable, sauf le mois qui suit ; bonus : une seule fois
    const ks = joues[cd.id] || [], ici = !!kOuvert && ks.includes(kOuvert), kPrec = kOuvert ? cleMoins(kOuvert, 1) : null;
    const k = cd.bonus ? utilisees[cd.id] : (ici ? kOuvert : kPrec && ks.includes(kPrec) ? kPrec : undefined), jouee = k !== undefined, aug = Object.entries(AMELIOS).find(([, x]) => x.carte === cd.id), n = aug ? up[aug[0]] : 0;
    const gp = atk && !jouee ? (atk.atout.id === cd.id ? '<span class="c-gp at" title="Atout du circuit">+1</span>' : "") : indk && !jouee && indk.ids.includes(cd.id) ? '<span class="c-gp at" title="Atout possible du circuit (1 chance sur 2)">?</span>' : "";
    const pgO = kOuvert ? piegeMois(y, kOuvert) || {} : {}, interdite = !!kOuvert && regleVisible("pieges") && (cd.id === "turbo" && pgO.id === "chaleur" || cd.id === "pari" && pgO.id === "sirenes");   // V16.55 : Pari interdit sous le chant des Sirènes
    if (interdite) return '<button type="button" class="carte jouee" disabled data-carte="' + cd.id + '"><span class="c-ico">' + icoOu(cd.id, cd.ico) + "</span><b>" + esc(cd.nom) + "</b><small>" + esc(cd.court) + "</small><em>" + (cd.id === "pari" ? "🧜 interdite (Sirènes)" : "🌡️ interdite (Surchauffe)") + "</em></button>";
    // v16.95 : Aspiration grisée quand il n'y a pas encore de classement (tour de chauffe, janvier)
    if (cd.id === "aspiration" && kOuvert && (kOuvert === CHAUFFE_K || kOuvert % 100 === 1)) return '<button type="button" class="carte jouee" disabled data-carte="aspiration"><span class="c-ico">' + icoOu(cd.id, cd.ico) + "</span><b>" + esc(cd.nom) + "</b><small>" + esc(cd.court) + "</small><em>⏳ s'active en février</em></button>";
    return '<button type="button" class="carte' + (cd.bonus ? " bonus" : "") + (jouee && !ici ? " jouee" : "") + (ici ? " posee" : "") + (CARTE_CHOIX === cd.id ? " choix" : "") + '" data-carte="' + cd.id + '"' + (jouee && !ici || !kOuvert ? " disabled" : "") + ">" +
      '<span class="c-ico">' + icoOu(cd.id, cd.ico) + "</span><b>" + esc(cd.nom) + "</b><small>" + esc(cd.court) + "</small>" + (n ? '<span class="c-up">+' + n + "</span>" : "") + gp +
      (jouee ? "<em>" + (ici ? "posée" : cd.bonus ? "jouée · " + esc(moisCourt(k)) : "repos · jouée en " + esc(moisCourt(k))) + "</em>" : cd.tire ? "<em>🎴 " + esc(moisCourt(cd.tire)) + "</em>" : "") + "</button>";
  };
  let action = "";
  const cd = CARTE_CHOIX ? carteDef(CARTE_CHOIX) : null;
  if (cd && kOuvert) {
    const rivaux = D.personnes.map(p => p.nom).filter(n => n !== qui);
    const noteGP = atk && atk.atout.id === cd.id ? " 🗺️ Atout de " + atk.g.ville + " : +1 si elle marque, sauf si un autre pilote la joue aussi (bouchon)." : indk && indk.ids.includes(cd.id) ? " 🔍 Peut-être l'atout de " + indk.g.ville + " (1 chance sur 2) : +1 si elle marque, sauf bouchon." : "";
    action = '<div class="c-action"><p><b>' + cd.ico + " " + esc(cd.nom) + "</b> · " + esc(texteCarte(cd, up) + noteGP) + "</p>" +
      (cd.cible ? '<div class="chips" role="group" aria-label="Rival">' + rivaux.map(n => '<button class="chip" type="button" data-rival="' + esc(n) + '" aria-pressed="' + (GP_RIVAL === n) + '">' + esc(n) + "</button>").join("") + "</div>" : "") +
      '<div class="btn-row"><button class="btn acc" type="button" id="c-poser"' + (cd.cible && !GP_RIVAL ? " disabled" : "") + ">Poser face cachée sur " + esc(moisLong(kOuvert)) + '</button><button class="lien" type="button" id="c-annuler">Annuler</button></div></div>';
  } else if (dejaMois) {
    const dc = carteDef(dejaMois);
    action = '<div class="c-action"><p>' + dc.ico + " <b>" + esc(dc.nom) + "</b> posée face cachée sur " + esc(moisLong(kOuvert)) + (src[kOuvert].cible ? " contre " + esc(src[kOuvert].cible) : "") + ". Révélée le " + jourLimite(kOuvert) + ".</p>" +
      '<button class="lien" type="button" id="c-reprendre">Reprendre ma carte</button></div>';
  }
  const kPr = kOuvert ? cleMoins(kOuvert, 1) : null;
  const reste = CARTES.filter(c => !(kPr && (joues[c.id] || []).includes(kPr))).length + pioche.filter(c => !joues[c.id]).length, aVenir = j.deck.length - j.i;
  const pf = prochaineFenetre();
  const fermeture = !kOuvert ? '<p class="c-ferme">🔒 ' + (estChauffe(y) && Date.now() < CHAUFFE_OUVRE ? "Les cartes du tour de chauffe s'ouvrent samedi 21 novembre à 9 h." : estChauffe(y) ? "Les cartes du tour de chauffe se posaient jusqu'au 1er décembre. Celles de janvier se posent dans l'onglet Saison 1, du 20 décembre au 1er janvier." + (moisCarteOuvert() === (SAISON.premiere * 100 + 1) ? ' <button class="lien" type="button" data-saison="' + SAISON.premiere + '">Poser ma carte de janvier ›</button>' : "") : moisCarteOuvert() ? "La fenêtre ouverte concerne une autre saison : change d'onglet en haut." : "Fenêtre fermée. Prochaine ouverture le " + esc(pf.du) + ", pour " + esc(moisLong(pf.k)) + ".") + "</p>" : "";
  return '<div><h3 class="s-h3">Mes cartes <small>' + reste + " en main" + (regleVisible("pioche") && !basesSeules() ? " · " + aVenir + " dans la pioche" : "") + "</small></h3></div>" +
    '<p class="info">Touche une carte pour la poser. Une par mois ; une carte de base se rejoue, mais pas deux mois de suite.' + (basesSeules() ? "" : " Une carte bonus ne sert qu\'une fois.") + (regleVisible("pioche") && !basesSeules() ? (regleVisible("niveaux") ? " Tu en pioches une nouvelle à chaque niveau gagné et quand tu finis dernier d\'un mois." : " Tu en pioches une nouvelle quand tu finis dernier d\'un mois.") : "") + (ap ? " Aperçu : choisis le mois avec les puces ci-dessous ; rien n'est envoyé." : "") + "</p>" +
    (ap ? '<div class="gp-mois">' + etapesGP(y).slice(1).map(x => '<button type="button" data-gpcible="' + x.k + '" aria-pressed="' + (x.k === kOuvert) + '">' + esc(moisCourt(x.k)) + "</button>").join("") + "</div>" : "") +
    '<div class="main-cartes">' + main.map(tuile).join("") + "</div>" + action + htmlProno(y, kOuvert) + htmlRival(y, kOuvert) + htmlVote(y);
}
/* ---------- Rappels : tant que ta carte du mois n'est pas posée, on te le dit partout ---------- */
function aujNum() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
/** Fenêtre ouverte et pas encore de carte posée : { k, y, j } ; sinon null */
function rappelCartes() {
  if (typeof D === "undefined" || !D || !D.personnes || apercuSaison() || !saisonVisible()) return null;
  const qui = moiPilote(); if (!qui || !D.personnes.some(p => p.nom === qui)) return null;
  const k = moisCarteOuvert(); if (!k) return null;
  const y = k === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(k / 100);
  if (kOuvertPour(y) !== k) return null;
  const c = carteDe(y, qui, k), sansCarte = !(c && c.c);
  // V15.1 : le rappel reste tant que la carte ET le pronostic (quand il compte) ne sont pas faits
  const pr = k !== CHAUFFE_K && regleVisible("prono") && regleActive("prono", k) ? pronoDe(y, qui, k) : true, sansProno = !pr;
  if (!sansCarte && !sansProno) return null;
  return { k, y, j: joursRestants(k), carte: sansCarte, prono: sansProno };
}
const VUES_RAPPEL = ["v-classement", "v-mois", "v-moi"];
function allerAuStand() {
  const r = rappelCartes(); if (r) choisirSaison(r.y);
  ETAT.podium = "stand"; garder();
  if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees");
}
/* v20.2 (Théo) : petite ligne « Fais ton portrait » sous le rappel de carte, dans tous les onglets, tant que le joueur n'a pas de portrait */
function assurerRappelPortrait(vue) {
  try {
    const ici = vue.querySelector(":scope > .rappel-portrait");
    const qui = typeof quiEcurie === "function" ? quiEcurie() : null, eq = qui && D && D.ecurie && D.ecurie[qui] && D.ecurie[qui].equip || {};
    const voir = qui && !podiumCache() && typeof portraitDispo === "function" && portraitDispo() && !eq.tete && SOURCE === "api";
    if (!voir) { if (ici) ici.remove(); return; }
    if (ici) return;
    const apres = vue.querySelector(":scope > .rappel");
    const html = '<button type="button" class="rappel rp-court rappel-portrait"><span class="rp-i">👤</span><span class="rp-t"><b>Fais ton portrait</b> · choisis ta tête (Réglages › Mon portrait)</span><span class="rp-f" aria-hidden="true">›</span></button>';
    if (apres) apres.insertAdjacentHTML("afterend", html); else vue.insertAdjacentHTML("afterbegin", html);
    vue.querySelector(":scope > .rappel-portrait").addEventListener("click", () => { if (typeof ouvrirPortrait === "function") ouvrirPortrait(); });
  } catch (e) { }
}
function assurerRappel(vue) {
  if (!vue || !VUES_RAPPEL.includes(vue.id)) return;
  setTimeout(() => assurerRappelPortrait(vue), 0);
  if (podiumCache()) { const ici0 = vue.querySelector(":scope > .rappel:not(.rappel-portrait)"); if (ici0) ici0.remove(); return; }
  const r = rappelCartes(), masque = false;   // V15.1 : plus de « rappelle-moi demain » : le rappel reste tant que ce n'est pas fait
  const ici = vue.querySelector(":scope > .rappel:not(.rappel-portrait)");
  if (!r || masque) { if (ici) ici.remove(); return; }
  const cle = r.k + "-" + r.j; if (ici && ici.dataset.cle === cle) return;
  if (ici) ici.remove();
  // v19.9 (Théo) : rappel réduit à une seule ligne compacte, toute la ligne mène au Stand
  vue.insertAdjacentHTML("afterbegin", '<button type="button" class="rappel rp-court' + (r.j <= 1 ? " urgent" : "") + '" data-cle="' + cle + '" role="status"><span class="rp-i">🃏</span><span class="rp-t"><b>' + (r.carte && r.prono ? "Carte et pronostic" : r.carte ? "Ta carte" : "Ton pronostic") + " de " + esc(moisLong(r.k)) + "</b> · " +
    (r.j <= 1 ? "dernier jour" : r.j + " j restants") + '</span><span class="rp-f" aria-hidden="true">›</span></button>');
  const el = vue.querySelector(":scope > .rappel:not(.rappel-portrait)");
  el.addEventListener("click", allerAuStand);
  const x = el.querySelector(".rp-x"); if (x) x.addEventListener("click", () => { stock.set("versus.rappelMasque", String(aujNum())); majRappels(); toast("D'accord, je te le rappelle demain."); });
}
/** V15.1 : avant l'annonce du 21 novembre 2026, rien du Podium dans les onglets Classement, Mois et Moi (pas de spoil) ; l'onglet Podium garde son teaser */
function podiumCache() { return Date.now() < CHAUFFE_OUVRE && !apercuSaison(); }   // v17.90 : à l'heure d'ouverture (9 h), plus seulement au jour   // l'admin en « Tout afficher » voit tout
/** Bandeaux de toutes les vues + pastille sur l'onglet Podium */
function majRappels() {
  VUES_RAPPEL.forEach(id => assurerRappel(document.getElementById(id)));
  { const vt = document.getElementById("v-trophees"); if (vt) setTimeout(() => assurerRappelPortrait(vt), 0); }   // v20.2 : aussi dans le Podium
  const t = document.querySelector('.onglet[data-vue="trophees"]'); if (!t) return;
  let p = t.querySelector(".pastille-nav"); const r = rappelCartes();
  if (r && !p) t.insertAdjacentHTML("beforeend", '<i class="pastille-nav" aria-label="Carte à poser"></i>'); else if (!r && p) p.remove();
}
/* ---------- Révélation : le jour où les cartes se retournent, une fois ---------- */
function revelationAVoir() {
  if (typeof D === "undefined" || !D || apercuSaison() || !saisonVisible()) return null;
  const d = new Date(), kc = d.getFullYear() * 100 + d.getMonth() + 1;
  if (d.getDate() < jourLimite(kc) || +(stock.get("versus.revele") || 0) >= kc) return null;
  const y = kc === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(kc / 100);
  const l = D.personnes.map(p => ({ nom: p.nom, c: carteDe(y, p.nom, kc), d: regleActive("duels", kc) ? duelDe(y, p.nom, kc) : null })).filter(x => x.c && x.c.c && !x.c.cache || x.d && x.d.cible && !x.d.cache);
  return l.length ? { k: kc, y, l } : null;
}
function ouvrirRevelation(r) {
  stock.set("versus.revele", String(r.k));
  const o = document.createElement("div"); o.className = "revel"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div class="rv-c"><span class="tuto-k">Révélation · ' + esc(moisLong(r.k)) + "</span><h3>Les cartes sont retournées</h3>" +
    '<div class="rv-l">' + r.l.map((x, i) => { const cd = x.c && x.c.c ? carteDef(x.c.c) : null;
      return '<div class="rv-p" style="--i:' + i + '">' + avatar(x.nom) + '<div class="rv-n"><b>' + esc(x.nom) + "</b>" + (x.d && x.d.cible ? "<small>⚔️ défie " + esc(x.d.cible) + "</small>" : "") + "</div>" +
        '<div class="rv-carte' + (cd && cd.bonus ? " bonus" : "") + '"><div class="rv-in"><div class="rv-dos">🂠</div><div class="rv-face">' + (cd ? "<span>" + cd.ico + "</span><b>" + esc(cd.nom) + "</b>" + (x.c.cible ? "<small>→ " + esc(x.c.cible) + "</small>" : "") : "<b>Pas de carte</b>") + "</div></div></div></div>"; }).join("") + "</div>" +
    (() => { const moi = moiPilote(), p = r.l.filter(x => x.c && x.c.c === "pari" && x.c.cible === moi).map(x => x.nom); return p.length ? '<p class="duel-recu">🎲 ' + p.map(esc).join(" et ") + " te défi" + (p.length > 1 ? "ent" : "e") + " avec un Pari : finis devant !</p>" : ""; })() +
    "<p>Les effets se calculent à la fin du mois, quand tous les relevés sont saisis.</p>" +
    '<div class="btn-row"><button class="btn ghost" type="button" data-rv="fermer">Fermer</button><button class="btn acc" type="button" data-rv="course">Voir la course 🏁</button></div></div>';
  document.body.appendChild(o);
  // V15.5 : quand la dernière carte est retournée, une gerbe d'étoiles
  const finFlip = (r.l.length - 1) * 700 + 450 + 700; let fini = false;
  setTimeout(() => { if (!fini && o.isConnected && typeof confettis === "function") confettis("etoiles"); }, finFlip);
  const fermer = () => { fini = true; o.remove(); };
  // V15.9 : un tapotement à côté ne coupe plus la révélation ; il ne ferme qu'une fois toutes les cartes retournées (« Fermer » marche toujours)
  const t0 = Date.now(); o.addEventListener("click", e => { if (e.target === o && Date.now() - t0 > finFlip + 600) fermer(); });
  o.querySelector('[data-rv="fermer"]').addEventListener("click", fermer);
  o.querySelector('[data-rv="course"]').addEventListener("click", () => { fermer(); choisirSaison(r.y); ETAT.podium = "gp"; garder(); if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees"); });
}
function verifierRevelation() {
  if (document.querySelector(".tuto, .revel, .regles")) return;
  const r = revelationAVoir(); if (r) { ouvrirRevelation(r); return; }
  const n = nouveautesAVoir(); if (n.length && stock.get("versus.tuto1")) { ouvrirNouveautes(n); return; }
  const c = typeof piegeDuMoisAVoir === "function" ? piegeDuMoisAVoir() : null; if (c) ouvrirPiegeDuMois(c);   // v20.62 : l'affichette du mois, puis le mini-jeu
}
/* ---------- Stand : tout ce qu'on joue (cartes, duel, atelier) ---------- */
function joursRestants(k) {
  const fin = new Date(Math.floor(k / 100), k % 100 - 1, jourLimite(k) - 1, 23, 59, 59);
  return Math.max(0, Math.ceil((fin - new Date()) / 864e5));
}
/** Le Grand Prix sur lequel on pose sa carte : ville, tracé et atout */
function htmlGPStand(k) {
  const ci = circuitDe(k), g = GPS[ci], a = atoutsVus(k);
  return '<div class="st-gp">' + (window.Piste ? Piste.vignette(ci) : "") + "<div><b>" + g.drap + " " + esc(g.gp) + "</b><small>" + esc(g.ville) + " · " + esc(g.txt) + "</small>" +
    (a ? '<small class="gp-atouts" style="margin-top:6px"><span class="at">' + a.atout.ico + " " + esc(a.atout.nom) + ' +1</span></small>' : indiceCircuit(k) ? htmlIndice(indiceCircuit(k), true) : "") + "</div></div>";
}
/* lot68 (Théo, 21/11) : pendant la fenêtre, qui a déjà posé sa carte du mois k — jamais laquelle (dos de carte ou « en attente ») ;
   disparaît avec la fenêtre (révélation le jourLimite). On ne lit que « posée ou pas » : ni l'id ni la cible ne sortent d'ici. */
/** v20.12 (Théo) : « 2/4 » sur l'onglet Stand pendant la fenêtre des cartes (combien ont posé, jamais laquelle) */
function compteCartesTab(y) {
  try { const k = kCartes(y); if (!k || apercuSaison() || !D || !D.personnes || D.personnes.length < 2) return "";
    const n = D.personnes.filter(p => { const c = carteDe(y, p.nom, k); return !!(c && (c.c || c.cache)); }).length;
    return ' <small class="pod-cc" aria-label="' + n + " carte" + (n > 1 ? "s" : "") + " posée" + (n > 1 ? "s" : "") + " sur " + D.personnes.length + '">' + n + "/" + D.personnes.length + "</small>"; } catch (e) { return ""; }
}
function htmlPeloton(y, k, qui) {
  if (!k || !D || !D.personnes || D.personnes.length < 2) return "";
  const l = D.personnes.map(p => { const c = carteDe(y, p.nom, k); return { nom: p.nom, ok: !!(c && (c.c || c.cache)) }; }), n = l.filter(x => x.ok).length;
  return '<div class="st-pel"><span class="st-pel-t">' + (n === l.length ? "Tout le monde a posé sa carte" : "Cartes posées") + " <b>" + n + "/" + l.length + "</b></span>" +
    '<div class="st-pel-l">' + l.map(x => '<span class="st-pel-p' + (x.ok ? " ok" : "") + (x.nom === qui ? " ici" : "") + '" data-bdg="' + esc(x.nom + (x.ok ? " : carte posée, face cachée jusqu'au " + jourLimite(k) + " " + moisLong(k).replace(/ \d{4}$/, "") + "." : " : pas encore de carte.")) + '">' +
      avatar(x.nom) + '<i class="st-pel-c" aria-hidden="true">' + (x.ok ? "✓" : "…") + "</i><small>" + esc(x.nom) + "</small></span>").join("") + "</div></div>";
}
function htmlStand(y) {
  const qui = moiPilote();
  if (!qui || !D.personnes.some(p => p.nom === qui)) return '<div class="vide">Choisis ton nom dans les réglages pour jouer.</div>';
  const k = kCartes(y), ap = apercuSaison(), pf = prochaineFenetre();
  let etat;
  if (k) {
    const c = carteDe(y, qui, k), d = duelDe(y, qui, k), j = ap ? null : joursRestants(k);
    etat = '<div class="st-etat ouvert"><div class="st-h"><span class="st-feu"></span><b>Fenêtre ouverte<small>pour ' + esc(moisLong(k)) + "</small></b>" + (j !== null ? "<em>" + (j <= 1 ? "dernier jour" : "il reste " + j + " jours") + "</em>" : "<em>aperçu</em>") + "</div>" +
      '<div class="st-check"><span class="' + (c && c.c ? "ok" : "") + '">' + (c && c.c ? "✓ Carte posée" : "🃏 Carte à poser") + "</span>" + (regleVisible("duels") && regleActive("duels", k) ? '<span class="' + (d && d.cible ? "ok" : "") + '">' + (d && d.cible ? "✓ Duel lancé" : "⚔️ Duel (facultatif)") + "</span>" : "") + "</div>" +
      (ap ? "" : htmlPeloton(y, k, qui)) + "<small>Jusqu'au " + "1<sup>er</sup>" + " " + esc(moisLong(k).replace(/ \d{4}$/, "")) + " inclus. Tout reste caché jusqu'à la révélation, le " + jourLimite(k) + ".</small>" + (k === CHAUFFE_K ? "" : htmlGPStand(k)) + "</div>";   // v17.46 (Théo) : au tour de chauffe, pas de rappel du circuit (ni atout ni piège)
  } else {
    const autre = moisCarteOuvert();
    const d = new Date(), kc = d.getFullYear() * 100 + d.getMonth() + 1, revele = d.getDate() >= jourLimite(kc) && Math.floor(kc / 100) === y && regleActive("duels", kc);
    const recus = revele ? D.personnes.map(p => p.nom).filter(n => n !== qui && ((duelDe(y, n, kc) || {}).cible === qui)) : [];
    const paris = d.getDate() >= jourLimite(kc) && Math.floor(kc / 100) === y ? D.personnes.map(p => p.nom).filter(n => { const c = n !== qui && carteDe(y, n, kc); return c && c.c === "pari" && c.cible === qui && !c.cache; }) : [];
    etat = '<div class="st-etat"><div class="st-h"><span class="st-feu ferme"></span><b>Fenêtre fermée</b></div>' +
      (recus.length ? '<p class="duel-recu">⚔️ ' + recus.map(esc).join(" et ") + " t'" + (recus.length > 1 ? "ont" : "a") + " défié pour " + esc(moisLong(kc)) + " : le meilleur du mois prend 1 point à l'autre.</p>" : "") +
      (paris.length ? '<p class="duel-recu">🎲 ' + paris.map(esc).join(" et ") + " t'" + (paris.length > 1 ? "ont" : "a") + " lancé un Pari pour " + esc(moisLong(kc)) + " : finis devant et " + (paris.length > 1 ? "ils perdent" : "il perd") + " 1 point ; sinon, +2 pour " + (paris.length > 1 ? "eux" : "lui") + ".</p>" : "") + "<small>" +
      (estChauffe(y) && Date.now() < CHAUFFE_OUVRE ? "Les cartes du tour de chauffe s'ouvrent samedi 21 novembre à 9 h." : estChauffe(y) ? "Les cartes du tour de chauffe se posaient jusqu'au 1er décembre." + (autre ? ' <button class="lien" type="button" data-saison="' + SAISON.premiere + '">Poser ma carte de janvier ›</button>' : " Celles de janvier se poseront du 20 décembre au 1<sup>er</sup> janvier.")
        : autre ? 'La fenêtre ouverte concerne une autre saison : <button class="lien" type="button" data-saison="' + (autre === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(autre / 100)) + '">y aller ›</button>'
        : "Prochaine ouverture le <b>" + esc(pf.du) + "</b>, pour " + esc(moisLong(pf.k)) + ". En attendant, prépare ta stratégie : ta main est ci-dessous.") + "</small></div>";
  }
  const kRm = k || (m => m && Math.floor(m / 100) === y ? m : null)(moisAMettreEnAvant());
  return etat + htmlReglesMois(y, kRm) + htmlCartes(y) + (regleVisible("niveaux") ? '<div><h3 class="s-h3">' + (regleVisible("atelier") ? "Atelier <small>niveau d\'écurie et améliorations</small>" : "Niveau d\'écurie") + "</h3></div>" + htmlAtelier(qui) : "") + htmlProchainement() +
    '<p class="info">Le Stand regroupe tout ce qui se joue.' + (basesSeules() ? "" : " La Course montre la course, l\'Écurie ton look.") + ' <a href="#" class="lien-regles" data-regles="cartes">Règles des cartes</a></p>';
}
function brancherStand(v, y) {
  const kOuvert = () => kCartes(y);
  v.querySelectorAll("[data-carte]").forEach(b => b.addEventListener("click", () => { CARTE_CHOIX = CARTE_CHOIX === b.dataset.carte ? null : b.dataset.carte; GP_RIVAL = null; rendreTrophees(); }));
  v.querySelectorAll("[data-rival]").forEach(b => b.addEventListener("click", () => { GP_RIVAL = b.dataset.rival; rendreTrophees(); }));
  v.querySelectorAll("[data-gpcible]").forEach(b => b.addEventListener("click", () => { GP_CIBLE = +b.dataset.gpcible; rendreTrophees(); }));
  const po = v.querySelector("#c-poser"); if (po) po.addEventListener("click", () => { const c = CARTE_CHOIX, r = GP_RIVAL; CARTE_CHOIX = null; GP_RIVAL = null; poserCarte(y, kOuvert(), c, r); });
  v.querySelectorAll("[data-duel]").forEach(b => b.addEventListener("click", () => { DUEL_RIVAL = DUEL_RIVAL === b.dataset.duel ? null : b.dataset.duel; rendreTrophees(); }));
  const dl = v.querySelector("#duel-lancer"); if (dl) dl.addEventListener("click", () => { const r = DUEL_RIVAL; DUEL_RIVAL = null; if (r) lancerDuel(y, kOuvert(), r); });
  const dr = v.querySelector("#duel-retirer"); if (dr) dr.addEventListener("click", () => lancerDuel(y, kOuvert(), null));
  v.querySelectorAll("[data-pv]").forEach(b => b.addEventListener("click", () => { PRONO_V = b.dataset.pv; rendreTrophees(); }));
  v.querySelectorAll("[data-pi]").forEach(b => b.addEventListener("click", () => { PRONO_I = b.dataset.pi; rendreTrophees(); }));
  const pp = v.querySelector("#prono-pole"); if (pp) pp.addEventListener("change", () => { const t = pp.value.trim().replace(",", ".").replace("%", ""); PRONO_P = t === "" ? null : (isFinite(+t) ? +t : null); });
  const pk = v.querySelector("#prono-ok"); if (pk) pk.addEventListener("click", () => {
    const p = pronoDe(y, moiPilote(), kOuvert()) || {}, vv = PRONO_V || p.v || null, ii = PRONO_I || p.i || null;
    const champ = v.querySelector("#prono-pole"), t = champ ? champ.value.trim().replace(",", ".").replace("%", "") : "", pole = t !== "" && isFinite(+t) && Math.abs(+t) <= 50 ? +t : (champ && t !== "" ? NaN : (typeof p.p === "number" ? p.p : null));
    if (Number.isNaN(pole)) { toast("Pole position : saisis un nombre entre −50 et +50 (ex. 1,8)."); return; }
    PRONO_V = null; PRONO_I = null; PRONO_P = null; envoyerProno(y, kOuvert(), vv, ii, pole); });
  v.querySelectorAll("[data-rs]").forEach(b => b.addEventListener("click", () => { RIVAL_CHOIX = b.dataset.rs; rendreTrophees(); }));
  v.querySelectorAll("[data-vote]").forEach(b => b.addEventListener("click", () => { VOTE_CHOIX = b.dataset.vote; rendreTrophees(); }));
  const vk = v.querySelector("#vote-ok"); if (vk) vk.addEventListener("click", () => { const c = VOTE_CHOIX || ((D.monVote || {})[y] || {}).c; VOTE_CHOIX = null; if (c) envoyerVote(y, c); });
  const rk = v.querySelector("#rival-ok"); if (rk) rk.addEventListener("click", () => { const r = RIVAL_CHOIX; RIVAL_CHOIX = null; if (r) choisirRival(y, r); });
  const an = v.querySelector("#c-annuler"); if (an) an.addEventListener("click", () => { CARTE_CHOIX = null; GP_RIVAL = null; rendreTrophees(); });
  const re = v.querySelector("#c-reprendre"); if (re) re.addEventListener("click", () => poserCarte(y, kOuvert(), null, null));
  v.querySelectorAll("[data-amelio]").forEach(b => b.addEventListener("click", () => {
    if (estChauffe(saisonCourante())) { toast("🔥 Tour de chauffe : les améliorations s'ouvrent le 1er janvier."); return; }
    if (!ECU || ECU.nom !== quiEcurie()) ECU = { nom: quiEcurie(), e: equipDe(quiEcurie()) };
    ECU.e.amelio = (ECU.e.amelio || "") + b.dataset.amelio; rendreTrophees();
  }));
  const aa = v.querySelector("#at-annuler"); if (aa) aa.addEventListener("click", () => { ECU.e.amelio = amelioDe(ECU.nom, anneeAmelioPour()).s; rendreTrophees(); });
  const ag = v.querySelector("#at-garder"); if (ag) ag.addEventListener("click", garderEcurie);
}
/* ---------- Duel du mois ---------- */
let DUEL_RIVAL = null;
function htmlDuel(y, kOuvert) {
  const qui = moiPilote(); if (!qui || !kOuvert || !regleVisible("duels") || !regleActive("duels", kOuvert)) return "";
  const d = duelDe(y, qui, kOuvert), rivaux = D.personnes.map(p => p.nom).filter(n => n !== qui);

  return '<div><h3 class="s-h3">Duel du mois <small>' + esc(moisLong(kOuvert)) + "</small></h3></div>" +
    '<div class="c-action duel"><p>⚔️ Défie un rival : le meilleur du mois lui prend <b>1 point</b>. Même fenêtre que les cartes, face cachée, gratuit, un défi par mois.</p>' +
    (d && d.cible ? '<p><b>⚔️ Duel lancé contre ' + esc(d.cible) + "</b>" + (d.cache ? " · révélé le " + jourLimite(kOuvert) : "") + '.</p><button class="lien" type="button" id="duel-retirer">Retirer mon duel</button>'
      : '<div class="chips" role="group" aria-label="Rival à défier">' + rivaux.map(n => '<button class="chip" type="button" data-duel="' + esc(n) + '" aria-pressed="' + (DUEL_RIVAL === n) + '">' + esc(n) + "</button>").join("") + "</div>" +
        '<button class="btn acc" type="button" id="duel-lancer"' + (DUEL_RIVAL ? "" : " disabled") + ">Lancer le duel" + (DUEL_RIVAL ? " contre " + esc(DUEL_RIVAL) : "") + "</button>") +
"</div>";
}
let GP_RIVAL = null, GP_CIBLE = null;
/* ---------- Le circuit du mois : instance 3D (ou 2D) de piste.js, gardée d'un rendu à l'autre ---------- */
let GP_INST = null, GP_PLEIN = null, GP_REJOUER = false;
function voituresGP() {
  const qui = quiEcurie();
  return D.personnes.map(p => { const e = equipDe(p.nom); return { nom: p.nom, couleur: couleurReelle(couleur(p.nom)), casque: couleurReelle(couleurCasque(p.nom, e)), livree: e.livree, trainee: e.trainee, moi: p.nom === qui }; });
}
/** À chaque image : étiquettes au-dessus des voitures, badges d'atout, compteur de tours, tableau du plein écran */
/* Étiquettes : les éléments sont repérés une fois (pas à chaque image), et on n'écrit dans la page que ce qui change.
   Aucune lecture de mise en page pendant l'animation : c'est ce qui faisait saccader l'iPhone. */
let GP_ETQ = null;
function cacheEtq(pi) {
  if (GP_ETQ && GP_ETQ.pi === pi && !GP_ETQ.sale) return GP_ETQ;
  const el = (l, f) => [...pi.querySelectorAll(l)].map(e => Object.assign({ e, tr: null, op: null }, f ? f(e) : {}));
  GP_ETQ = { pi, plein: pi.classList.contains("plein"), tags: el("[data-gpt3]", e => ({ n: e.dataset.gpt3, rg: e.querySelector(".gp-rg"), rgv: null })),
    pops: el(":scope > .gp-pops [data-pop]", e => ({ n: e.dataset.pop })), zones: el("[data-zone]", e => ({ z: e.dataset.zone })), tour: pi.querySelector("#gp-tour"), tourv: null };
  return GP_ETQ;
}
function poser1(o, op, tr) { if (o.op !== op) { o.e.style.opacity = op; o.op = op; } if (tr !== null && o.tr !== tr) { o.e.style.transform = tr; o.tr = tr; } }
function etiquettesGP(api) {
  const pi = document.getElementById("gp-piste"); if (!pi) return;
  const C = cacheEtq(pi), cur = api.courant(), ordre = Object.keys(cur).sort((a, b) => cur[b] - cur[a]), pos = [], egaux = !api.enCours() && ordre.every(m => Math.abs(cur[m] - cur[ordre[0]]) < 1e-9);
  const H = api.taille ? api.taille().h : 400;
  C.tags.forEach(o => {
    const gr = egaux && GP_GRILLE ? GP_GRILLE.indexOf(o.n) : -1, r = gr >= 0 ? gr + 1 : 1 + ordre.filter(m => cur[m] > (cur[o.n] || 0) + 1e-9).length; if (o.rg && o.rgv !== r) { o.rg.textContent = r; o.rgv = r; }   // V16.18 : ex æquo = même rang ; v20.52 : sur la grille, la place de départ
    const e = api.ecran(o.n); if (!e || e.vis === false) { poser1(o, "0", null); return; }
    const cen = !!e.centre; if (o.cen !== cen) { o.e.classList.toggle("grille", cen); o.cen = cen; }   // v20.52 : grille 2D en quinconce, pastille posée à côté de sa voiture
    pos.push({ o, n: o.n, x: e.x, y: e.y, x0: e.x, y0: e.y, cen });
  });
  // v17.8 · deux étiquettes qui se chevauchent : la seconde s'écarte sur le côté (au plus 30 px), puis monte d'un seul cran au plus.
  // Avant : chacune montait au-dessus de la précédente sans limite → une colonne de têtes qui ne suivait plus les voitures.
  const D0 = 30, recouvre = (p, l) => l.find(q => Math.abs(q.x - p.x) < D0 && Math.abs(q.y - p.y) < D0);
  pos.sort((a, b) => b.y - a.y).forEach((p, i) => { const l = pos.slice(0, i), x0 = p.x, y0 = p.y, q = recouvre(p, l); if (!q) return;
    const c = (p.x >= q.x ? [1, -1] : [-1, 1]).flatMap(sx => [[sx, 0]]).concat([[p.x >= q.x ? 1 : -1, -1], [p.x >= q.x ? -1 : 1, -1], [0, -1]]).map(([dx, dy]) => ({ x: x0 + dx * D0, y: y0 + dy * D0 }));
    const ok = c.find(z => !recouvre(z, l)) || c[2]; p.x = ok.x; p.y = ok.y; });
  // le décalage glisse en douceur (pas de saut de 30 px d'une image à l'autre) et reste borné : la tête ne quitte jamais sa voiture
  pos.forEach(p => { const o = p.o, ex = p.x - p.x0, ey = p.y - p.y0, k = api.enCours() ? .22 : 1; o.dx = (o.dx || 0) + (ex - (o.dx || 0)) * k; o.dy = (o.dy || 0) + (ey - (o.dy || 0)) * k; p.x = p.x0 + o.dx; p.y = p.y0 + o.dy; });
  pos.forEach(p => { if (p.cen) { poser1(p.o, "", "translate3d(" + p.x.toFixed(0) + "px," + Math.min(p.y, H - 17).toFixed(0) + "px,0) translate(-50%,-50%)"); return; }
    if (p.y < 44 && !C.plein) { poser1(p.o, "0", null); p.y = -99; return; } poser1(p.o, "", "translate3d(" + p.x.toFixed(0) + "px," + Math.min(p.y, H - 4).toFixed(0) + "px,0) translate(-50%,-100%)"); });
  C.pops.forEach(o => { const p = pos.find(q => q.n === o.n); if (!p || p.y < 0) { poser1(o, "0", null); return; } poser1(o, "", "translate3d(" + p.x.toFixed(0) + "px," + (p.y - 36).toFixed(0) + "px,0) translate(-50%,-100%)"); });
  C.zones.forEach(o => { const zz = api.zones && api.zones[o.z], e = zz && api.ecranMonde((zz.s0 + zz.s1) / 2, 0, 5);
    if (!e || e.vis === false) { poser1(o, "0", null); return; } poser1(o, "", "translate3d(" + e.x.toFixed(0) + "px," + e.y.toFixed(0) + "px,0) translate(-50%,-50%)"); });
  { const h = pi.querySelector(".gp-tour"); if (h) { if (GP_SCEN && api.enCours()) { const tr = Math.min(TOURS_GP, Math.floor(Math.max(0, ...Object.values(cur))) + 1); if (h.dataset.tr !== String(tr)) { if (!h.dataset.tr) h.dataset.orig = h.innerHTML; h.innerHTML = (GP_DEMO && GP_DEMO.enCours ? "🎬 Démo · " : "") + "Tour <b>" + tr + "</b>/" + TOURS_GP; h.dataset.tr = tr; } } else if (h.dataset.tr) { h.innerHTML = h.dataset.orig || ""; delete h.dataset.orig; delete h.dataset.tr; } } }   // v16.28
  if (api.enCours() && C.tour) { const v = Math.floor(Math.max(0, ...Object.values(cur)) / TOUR_GP) + 1; if (v !== C.tourv) { C.tour.textContent = v; C.tourv = v; } }
  if (GP_PLEIN) majTourPlein(cur);
  majPauseGP();
  // v17.8 · 🚁 Hélico : la rangée de têtes « voiture suivie » se range dans l'ordre de la course, avec la place de chacun
  if (C.suivi === undefined) C.suivi = [...document.querySelectorAll("[data-suivre]")].map(e => ({ e, n: e.dataset.suivre, v: "" }));
  C.suivi.forEach(o => { const r = 1 + ordre.filter(m => cur[m] > (cur[o.n] || 0) + 1e-9).length, v = String(r); if (o.v !== v) { o.v = v; o.e.style.order = r; o.e.dataset.rg = v; } });
  majTresor(api, pi);
}
/* ---------- 🗝️ V16.61 · Chasse au trésor : un objet caché par circuit dans la Visite 3D (vue hélico).
   Les emplacements ne sont pas dans l'appli : le serveur ne les donne qu'à partir du 1er du mois du circuit (saison 2027),
   à tout le monde, admin compris. L'objet n'apparaît que de très près (zoom faible), superposé au décor ; un toucher le ramasse. ---------- */
const TRESOR_DEBUT = 20261201, TRESOR_D = 60;   // distance (mètres du décor) en dessous de laquelle l'objet se montre (v16.64 : plus difficile, il faut zoomer au maximum et regarder au ras du sol ; v20.62 (Théo : « un pixel, le bon angle ») : 92 → 60 m)
let TRESORS = null, TRESORS_T = 0, TRESOR_EL = null, TRESOR_APERCU = null;   // v17.35 : TRESOR_APERCU = aperçu admin en cours sur la page Course (exemple inventé, rien n'est envoyé)
function tresorsOuverts() { return aujNum() >= TRESOR_DEBUT && SOURCE === "api" && !simulation(); }
async function chargerTresors() {
  if (TRESOR_APERCU || TRESORS || !tresorsOuverts() || Date.now() - TRESORS_T < 60000) return; TRESORS_T = Date.now();
  const rep = await posterAdmin({ action: "tresors" });
  if (!rep || !rep.ok) return;
  if (TRESOR_APERCU) { TRESOR_APERCU.sauve.T = { l: rep.tresors || [], trouves: rep.trouves || [], total: rep.total || 0, coupe: rep.coupe || null }; return; }   // réponse arrivée pendant l'aperçu : remise à la fermeture
  TRESORS = { l: rep.tresors || [], trouves: rep.trouves || [], total: rep.total || 0, coupe: rep.coupe || null }; poserTresorDOM(document);
}
function tresorDuCircuit(ci) { if (!TRESORS) return null; const t = TRESORS.l.find(x => x.circuit === ci); return t && TRESORS.trouves.indexOf(ci) < 0 ? t : null; }
/** v16.66 · classement des chercheurs du circuit (qui et quel jour, jamais où) */
function chercheursTxt(t) {
  const l = (t && t.chercheurs) || []; if (!l.length) return "Personne ne l'a encore trouvé.";
  const j = x => x.j ? " (" + (x.j % 100) + " " + MOIS[Math.floor(x.j / 100) % 100 - 1] + ")" : "";
  return "Trouvé par : " + l.map((x, k) => (k ? "" : "🥇 ") + (k ? (k + 1) + ". " : "") + esc(x.nom) + j(x)).join(" · ");
}
const TRESOR_SVG = {
  talkie: '<svg viewBox="-12 -16 24 32"><rect x="2.6" y="-15" width="2" height="11" rx="1" fill="#2A2A2E" stroke="#111" stroke-width=".6"/><rect x="-6.5" y="-6" width="13" height="20" rx="2.4" fill="#26262C" stroke="#0A0A0C" stroke-width="1"/><rect x="-4.5" y="-3.6" width="9" height="5" rx="1" fill="#9AD8A8" stroke="#0A0A0C" stroke-width=".6"/><circle cx="-3.2" cy="-4.8" r="1" fill="#FF3030"/>' + [4, 6.4, 8.8, 11.2].map(y => '<path d="M-4 ' + y + 'H4" stroke="#55555C" stroke-width="1.2" stroke-linecap="round"/>').join("") + '</svg>',
  chouette: '<svg viewBox="-12 -14 24 28"><path d="M-7 -8L-5 -13L-2 -9H2L5 -13L7 -8C9 -3 9 6 6 10C3 13 -3 13 -6 10C-9 6 -9 -3 -7 -8Z" fill="#E9B53A" stroke="#7A5410" stroke-width="1"/><path d="M-5 2Q0 6 5 2M-4 6Q0 9 4 6" stroke="#9A6A10" stroke-width=".8" fill="none"/><circle cx="-3.2" cy="-5" r="2.8" fill="#FFF3C8" stroke="#7A5410" stroke-width=".7"/><circle cx="3.2" cy="-5" r="2.8" fill="#FFF3C8" stroke="#7A5410" stroke-width=".7"/><circle cx="-3.2" cy="-5" r="1.2" fill="#2A1A08"/><circle cx="3.2" cy="-5" r="1.2" fill="#2A1A08"/><path d="M-1 -2.4L0 -.4L1 -2.4Z" fill="#B07A1E"/><path d="M-3 11.5V13M0 11.8V13.4M3 11.5V13" stroke="#7A5410" stroke-width="1"/></svg>',
  vif: '<svg viewBox="-20 -12 40 24"><path d="M-4 -1C-10 -9 -18 -9 -19 -6C-15 -5 -12 -2 -5 2Z" fill="#FFFDF2" stroke="#C9B98A" stroke-width=".8"/><path d="M4 -1C10 -9 18 -9 19 -6C15 -5 12 -2 5 2Z" fill="#FFFDF2" stroke="#C9B98A" stroke-width=".8"/><circle r="6" fill="#F2C230" stroke="#9A6A10" stroke-width="1"/><path d="M-4 -2Q0 1 4 -2" stroke="#9A6A10" fill="none" stroke-width=".8"/><circle cx="-2" cy="-2.5" r="1.6" fill="#FFF3B8"/></svg>',
  gemme: '<svg viewBox="-12 -12 24 24"><path d="M-7 -4L-3 -9H3L7 -4L0 10Z" fill="#FF8A1F" stroke="#8A3A05" stroke-width="1"/><path d="M-7 -4H7M-3 -9L-2 -4L0 10M3 -9L2 -4L0 10" stroke="#FFD08A" stroke-width=".7" fill="none"/><path d="M-3 -8L-5 -4.5" stroke="#FFF2D6" stroke-width="1.2"/></svg>',
  fiole: '<svg viewBox="-12 -14 24 28"><rect x="-2.4" y="-13" width="4.8" height="3.4" rx="1" fill="#C8A070"/><path d="M-2 -10V-5C-6 -3 -7 1 -7 5C-7 10 -4 12 0 12C4 12 7 10 7 5C7 1 6 -3 2 -5V-10Z" fill="#7FC6FF" stroke="#1F4E86" stroke-width="1"/><path d="M-6.4 4C-4 6 4 6 6.4 4C6.4 9 4 11 0 11C-4 11 -6.4 9 -6.4 4Z" fill="#3A8AE0"/><rect x="-4.6" y="-1.6" width="9.2" height="4.4" rx=".6" fill="#FFFDF2" stroke="#B8203A" stroke-width=".6"/><path d="M-3 .6H3" stroke="#B8203A" stroke-width=".9"/></svg>',
  molette: '<svg viewBox="-14 -14 28 28"><g transform="rotate(-35)"><path d="M-2 -6H2V9A2 2 0 0 1 -2 9Z" fill="#E9B53A" stroke="#7A5410" stroke-width="1"/><path d="M-6 -12A6.5 6.5 0 0 0 6 -12L3.4 -12V-8.6H-3.4V-12Z" transform="translate(0 4)" fill="#F2C94C" stroke="#7A5410" stroke-width="1"/><path d="M-1 -4V8" stroke="#FFF1B8" stroke-width=".9"/></g></svg>',
  krys: '<svg viewBox="-14 -14 28 28"><path d="M-6 7C-5 -4 3 -10 11 -12C6 -7 1 -1 -2 8Z" fill="#F7F1E2" stroke="#8A7A5A" stroke-width="1"/><path d="M-4 5C-2 -3 3 -8 8 -10" stroke="#FFFFFF" stroke-width=".9" fill="none"/><path d="M-7.5 6.5L-1 9" stroke="#C8A050" stroke-width="2" stroke-linecap="round"/><path d="M-5.6 8.2L-8.4 13L-5.8 13.8L-3.4 9" fill="#5A3420" stroke="#2A1408" stroke-width=".7"/></svg>',
  droide: '<svg viewBox="-12 -14 24 28"><path d="M-6 -2A6 6 0 0 1 6 -2Z" fill="#D4DAE2" stroke="#3A4250" stroke-width=".9"/><rect x="-6" y="-2" width="12" height="11" rx="1.4" fill="#F4F6F8" stroke="#3A4250" stroke-width=".9"/><rect x="-3.6" y="1" width="7.2" height="2.4" fill="#2A5AD8"/><rect x="-3.6" y="5" width="3" height="2" fill="#2A5AD8"/><circle cx="1.4" cy="-4.4" r="1.2" fill="#1A1E28"/><circle cx="1.4" cy="-4.4" r=".5" fill="#FF4A4A"/><rect x="-9" y="0" width="2.6" height="11" rx=".8" fill="#E8ECEF" stroke="#3A4250" stroke-width=".8"/><rect x="6.4" y="0" width="2.6" height="11" rx=".8" fill="#E8ECEF" stroke="#3A4250" stroke-width=".8"/></svg>',
  graine: '<svg viewBox="-12 -12 24 26"><circle r="11" fill="#E8C8FF" opacity=".35"/><path d="M-7 1A7 7 0 0 1 7 1Q3.5 3 0 2Q-3.5 3 -7 1Z" fill="#FFFFFF" stroke="#B88AE8" stroke-width=".9"/><path d="M-4.5 2.4Q-6 7 -4 12M-1.5 2.6Q-2 8 -.5 13M1.5 2.6Q2 8 .5 13M4.5 2.4Q6 7 4 12" stroke="#F8DCFF" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M-3.6 -2.4Q-1 -5 2.4 -4" stroke="#FFFFFF" stroke-width="1.2" fill="none" opacity=".9"/></svg>',
  anneau: '<svg viewBox="-12 -12 24 24"><ellipse rx="8.6" ry="6" fill="none" stroke="#7A4A0E" stroke-width="4.6"/><ellipse rx="8.6" ry="6" fill="none" stroke="#F6C84A" stroke-width="3"/><path d="M-6.4 -3.6Q0 -6.8 6.4 -3.6" stroke="#FFF4C0" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>',
  toque: '<svg viewBox="-12 -13 24 26"><path d="M-6.5 9V2C-11 1.4 -11.6 -5.2 -7 -5.8C-6.6 -10.6 -1.4 -11.4 0 -8.2C1.4 -11.4 6.6 -10.6 7 -5.8C11.6 -5.2 11 1.4 6.5 2V9Z" fill="#FFFFFF" stroke="#4A4A42" stroke-width="1"/><path d="M-6.5 5H6.5" stroke="#C9C9C0" stroke-width="1"/><path d="M-3 2V-3M0 2V-4M3 2V-3" stroke="#DADAD2" stroke-width=".8" stroke-linecap="round"/><rect x="-6.5" y="5" width="13" height="4" fill="#F2EFE6" stroke="#4A4A42" stroke-width="1"/></svg>',
  bonbon: '<svg viewBox="-12 -12 24 24"><circle r="11.5" fill="#FFE07A" opacity=".35"/><circle r="9" fill="#FF7EB6" stroke="#7A2A4A" stroke-width="1"/><path d="M-8.6 -2.6Q0 -6 8.6 -2.6" stroke="#FFD04A" stroke-width="2.6" fill="none"/><path d="M-9 1.4Q0 -1.6 9 1.4" stroke="#7EC8F0" stroke-width="2.6" fill="none"/><path d="M-7.6 5Q0 2.6 7.6 5" stroke="#B6E36A" stroke-width="2.4" fill="none"/><path d="M-6.8 -6Q0 -8.6 6.8 -6" stroke="#FF9A2A" stroke-width="2" fill="none"/><path d="M-4.6 -4.6A6 6 0 0 1 0 -6.8" stroke="#FFFFFF" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  cle: '<svg viewBox="-14 -14 28 28"><path d="M-12.5 -13Q-13 -3 -6.2 -5.6" fill="none" stroke="#4A2E18" stroke-width="1.4"/><g transform="rotate(45)"><circle cx="-6" r="4.4" fill="#C8A868" stroke="#4A3418" stroke-width="1"/><circle cx="-6" r="1.9" fill="#2A1E12"/><path d="M-7.8 -3.2A4 4 0 0 1 -3 -2.4" fill="none" stroke="#FFF0C0" stroke-width=".8"/><rect x="-1.8" y="-1.2" width="13" height="2.4" rx=".9" fill="#C8A868" stroke="#4A3418" stroke-width=".9"/><path d="M6.6 1.2V5.4H8.6V3.6H10.4V1.2Z" fill="#C8A868" stroke="#4A3418" stroke-width=".9"/></g></svg>'
};
/** pose (ou retire) le compteur, l'énigme du mois et l'objet dans la page Course ; sans rien recalculer d'autre */
function poserTresorDOM(v) {
  const pi = (v || document).querySelector ? (v || document).querySelector("#gp-piste") : null; if (!pi) return;
  if (TRESOR_APERCU && pi.dataset.circuit !== TRESOR_APERCU.ci) quitterApercuTresor(false);   // v17.35 : autre circuit affiché → l'aperçu s'arrête, l'état réel revient
  const AP = TRESOR_APERCU;
  pi.querySelectorAll(".gp-tresor, .gp-enigme, .gp-tresor-appel, .gp-jauge, .tap-band").forEach(e => e.remove()); TRESOR_EL = null; sonChaleur(-1);
  if (AP) { apBandeau(pi); apCachette(); }
  const met = document.querySelector(".gp-h .gp-met"), cpt = met && met.querySelector(".gp-tresors"), ga = GP_INST && GP_INST.api;
  if (!TRESORS || !(AP || tresorsOuverts())) { if (cpt) cpt.remove(); return; }
  const n = TRESORS.total || 0, txt = "🗝️ " + n + " trésor" + (n > 1 ? "s" : "") + " trouvé" + (n > 1 ? "s" : "");
  const cp = coupeDonnees(), txt2 = txt + (cp ? " · 🏆 Coupe " + cp.n + "/12" : "");   // v20.42 : la Coupe brisée (saison 2027), un toucher l'ouvre
  if (met) { if (cpt) cpt.textContent = txt2; else met.insertAdjacentHTML("beforeend", ' <span class="gp-tresors"' + (cp ? ' role="button" tabindex="0" title="Ouvrir la Coupe brisée"' : "") + ">" + txt2 + "</span>");
    const c2 = met.querySelector(".gp-tresors"); if (c2 && cp && !c2.dataset.coupe) { c2.dataset.coupe = "1"; c2.classList.add("lien-coupe"); c2.addEventListener("click", ev => { ev.stopPropagation(); ouvrirCoupe(); }); c2.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrirCoupe(); } }); } }
  const tc = TRESORS.l.find(x => x.circuit === pi.dataset.circuit); if (!tc) return;
  const t = tresorDuCircuit(pi.dataset.circuit), ind = tc.indice2 ? '<b class="gp-indice">💡 ' + esc(tc.indice2) + "</b>" : "", cf = !!(t && tc.chaudFroid);   // v17.35 : jauge chaud-froid (serveur V62 : à partir du 21, tant que personne n'a trouvé)
  if (!t) {   // déjà trouvé : plus d'objet, mais l'énigme résolue et le classement des chercheurs restent consultables
    pi.insertAdjacentHTML("beforeend", '<div class="gp-enigme trouvee">✅ <i>Trésor trouvé !</i><span class="gp-chercheurs">' + chercheursTxt(tc) + "</span></div>");
    const en0 = pi.querySelector(".gp-enigme"); TRESOR_EL = { pi, b: null, en: en0, t: tc, vu: false, pris: true };
    en0.addEventListener("click", () => en0.classList.toggle("ouverte")); if (ga) majTresor(ga, pi); return;
  }
  /* v16.67 · rappel en carte 2D (vue par défaut) : un trésor attend sur ce circuit → un toucher ouvre la Visite 3D (validé par le Conseil) */
  const premiere = !stock.get("versus.tresorAide");
  pi.insertAdjacentHTML("beforeend", '<button class="gp-tresor-appel" type="button">' + (cf ? "🌡️ Jauge chaud-froid allumée · " : ind ? "💡 2e indice tombé · " : "🗝️ Un trésor se cache ici · ") + "<b>Chercher en 3D</b>" + (premiere ? "<small>Zoome au maximum, au ras du sol.</small>" : "") + "</button>");
  pi.querySelector(".gp-tresor-appel").addEventListener("click", ev => { ev.stopPropagation(); if (!AP) stock.set("versus.tresorAide", "1"); /* aperçu : rien de gardé */ if (pi.classList.contains("v2")) { choisirVueGP("visite"); return; } const bv = document.getElementById("gp-vue"); if (bv && pi.classList.contains("en2d")) bv.click(); });
  pi.insertAdjacentHTML("beforeend", '<div class="gp-enigme" title="Énigme du mois : un objet est caché dans le décor de ce circuit. Approche-toi en Visite 3D. Touche pour lire la suite.">' + (ind ? "💡" : "🗝️") + ' <i>' + esc(t.enigme) + "</i>" + ind + (cf ? '<b class="gp-indice gp-chaud-l">🌡️ Personne n\'a trouvé : la jauge chaud-froid est allumée.</b>' : "") + '<span class="gp-chercheurs">' + chercheursTxt(t) + "</span></div>" +
    (cf ? '<div class="gp-jauge cache" role="status" aria-live="polite"></div>' : "") +
    '<button class="gp-tresor t-' + esc(t.type) + '" type="button" aria-label="Un objet du film : touche-le !" tabindex="-1">' + (TRESOR_SVG[t.type] || TRESOR_SVG.gemme) + "</button>");
  const b = pi.querySelector(".gp-tresor"), en = pi.querySelector(".gp-enigme");
  TRESOR_EL = { pi, b, en, t, vu: false, j: pi.querySelector(".gp-jauge") };
  en.addEventListener("click", () => en.classList.toggle("ouverte"));
  b.addEventListener("click", ev => { ev.stopPropagation(); trouverTresor(t, b); });
  if (ga) majTresor(ga, pi);
}
/** à chaque image : l'objet suit le décor, seulement en Visite 3D (hélico, hors course et hors tour de présentation), de très près et à l'écran */
function majTresor(api, pi) {
  const T = TRESOR_EL; if (!T || T.pi !== pi) return;
  const libre = api.type === "3d" && api.projeter && api.mode() === "helico" && !api.enCours() && !(api.presentationEnCours && api.presentationEnCours()) && !pi.classList.contains("en2d");
  T.en.classList.toggle("cache", (!libre && !(GP_PLEIN && pi.closest(".gp-plein"))) || (!!T.pris && !!T.b));   // v17.55 (Théo) : en plein écran, l'énigme et les indices restent affichés dans toutes les vues
  /* v17.35 : en hauteur (portrait), la caméra recule toute seule pour montrer le circuit ; on ramène la distance à celle d'un écran en largeur → même difficulté dans toutes les orientations */
  const e = libre && !T.pris && T.t.p && api.zoom() <= .2 ? api.projeter(T.t.p) : null, d = e && e.vis ? e.d / (api.recul ? api.recul() : 1) : 1e9;
  /* v20.62 (Théo : « il faut le bon angle ») : si le décor est entre la caméra et l'objet, il reste invisible (avant, il se montrait à travers les murs) */
  const al = d < TRESOR_D && !(api.masque && api.masque(T.t.p)) ? Math.min(.92, (TRESOR_D - d) / 12) : 0;
  if (T.j) { const c = libre && !T.pris && T.t.p && api.cible ? api.cible() : null; T.j.classList.toggle("cache", !c);
    if (c) { const n = palierChaud(Math.hypot(c.x - T.t.p[0], c.z - T.t.p[2]), c.r, al > 0); if (n !== T.jn) { T.jn = n; T.j.dataset.n = n; T.j.innerHTML = '<span class="gj-segs">' + [0, 1, 2, 3].map(k => "<i" + (k <= n ? ' class="on"' : "") + "></i>").join("") + "</span><b>" + JAUGE_TXT[n] + "</b>"; } }
    sonChaleur(c ? T.jn : -1); }   // v17.59 : les grelots de l'ambiance suivent le palier AFFICHÉ (rien de plus, rien avant)
  if (!T.b) return;
  if (!al) { if (T.vu) { T.b.style.opacity = "0"; T.b.style.pointerEvents = "none"; T.vu = false; } return; }
  const s = Math.max(9, Math.min(16, 640 / d));   // v20.62 : plus petit (9 à 16 px, avant 15 à 26) ; la zone de toucher reste large (::before)
  T.b.style.transform = "translate3d(" + e.x.toFixed(1) + "px," + e.y.toFixed(1) + "px,0) translate(-50%,-50%)";
  T.b.style.width = T.b.style.height = s.toFixed(0) + "px"; T.b.style.opacity = al.toFixed(2); T.b.style.pointerEvents = al > .5 ? "auto" : "none"; T.vu = true;
}
/** v17.35 · jauge chaud-froid : 4 paliers vagues selon la distance au sol entre le point visé et l'objet (relative à la taille du circuit), AUCUNE direction ;
    « Brûlant » quand l'objet devient visible (ou presque dessus) */
/** v17.59 · bonus validé par le Conseil : en Visite, les grelots de l'ambiance (plein écran d'un circuit à thème) suivent la jauge chaud-froid,
    exactement le même palier, au même moment, seulement quand la jauge est à l'écran (-1 = pas de jauge : volume normal) */
function sonChaleur(n) { if (window.SONS && SONS.chaleur) SONS.chaleur(n); }
const JAUGE_TXT = ["❄️ Froid", "🌡️ Tiède", "🔥 Chaud", "🔥🔥 Brûlant !"];
function palierChaud(dh, r, vu) { const R = Math.max(150, r || 0); return vu || dh < R * .07 ? 3 : dh < R * .22 ? 2 : dh < R * .5 ? 1 : 0; }
async function trouverTresor(t, b) {
  const T = TRESOR_EL; if (!T || T.pris) return; T.pris = true;
  const r = b.getBoundingClientRect(), pr = T.pi.getBoundingClientRect(), x = r.left - pr.left + r.width / 2, y = r.top - pr.top + r.height / 2;
  b.style.pointerEvents = "none"; b.classList.add("pris");
  if (!reduit) { const fx = document.createElement("div"); fx.className = "gp-tresor-fx"; fx.style.left = x + "px"; fx.style.top = y + "px";
    fx.innerHTML = Array.from({ length: 14 }, (_, k) => '<i style="--a:' + (k / 14 * 360).toFixed(0) + "deg;--d:" + (26 + (k % 3) * 12) + 'px"></i>').join(""); T.pi.appendChild(fx); setTimeout(() => fx.remove(), 1300); }
  if (window.SONS) { SONS.succes(); setTimeout(() => SONS.klaxon("billets"), 250); SONS.vibrer([40, 50, 120]); }
  const rep = TRESOR_APERCU ? TRESOR_APERCU.trouver(t) : await posterAdmin({ action: "tresorTrouve", circuit: t.circuit });   // aperçu : réponse inventée, rien ne part au serveur
  if (rep && rep.ok) { TRESORS.trouves = rep.trouves || TRESORS.trouves.concat([t.circuit]); TRESORS.total = rep.total || TRESORS.trouves.length;
    if (!rep.deja) { const l = TRESORS.l.find(x => x.circuit === t.circuit), n = moiVrai(); if (l && !(l.chercheurs || []).some(x => x.nom === n)) { const d = new Date(); (l.chercheurs = l.chercheurs || []).push({ nom: n, j: d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() }); } }
    toast(rep.deja ? "🗝️ Déjà trouvé !" : "🗝️ Trouvé" + (rep.rang === 1 ? " en premier ! 🥇" : rep.rang ? " (" + rep.rang + "e)" : " !") + " " + TRESORS.total + " trésor" + (TRESORS.total > 1 ? "s" : "") + " dans ta besace.");
    if (rep.eclat && !rep.deja) { noterEclat(rep.eclat, moiVrai(), rep.rang); setTimeout(() => revelerEclat(rep.eclat, rep.rang), reduit ? 300 : 1300); }   // refonte des badges : 1er trouveur = cérémonie dorée   // v20.42 : l'éclat de la Coupe rendu par ce trésor
    if (!rep.deja && !TRESOR_APERCU && typeof TRESOR_NOEL !== "undefined" && t.circuit === TRESOR_NOEL) setTimeout(() => ceremonieChercheurNoel(rep.rang), reduit ? 300 : 1300);   // v20.62 : 🎁 plaque Chercheur de Noël
    setTimeout(() => poserTresorDOM(document), reduit ? 0 : 900); }
  else { T.pris = false; b.classList.remove("pris"); toast((rep && rep.message) || "Trouvaille non enregistrée : réessaie."); }
}
/* ---------- 🏆 v20.41 · « La Coupe brisée » (fil rouge de la saison 2027) ----------
   Le CONTENU (prologue, matières, textes, signes) n'est jamais dans l'appli ni dans ce dépôt public : il vient du serveur (Eclats.js, privé).
   v20.43 (Théo) : la Coupe est PERSONNELLE. Chacun ne reçoit que les éclats qu'il a trouvés lui-même ; un mois fini sans trouvaille = éclat
   « manque » (un de moins pour l'énigme, tant pis). Des autres : seulement combien l'ont trouvé, jamais le contenu. Exemples INVENTÉS pour l'aperçu admin. */
const MOIS_COUPE = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ECLAT_EX = { matiere: "verre d'exemple", couleur: "#7FB8FF", symbole: "★", texte: "Texte d'exemple : ici, deux phrases racontent ce que l'éclat a vécu dans ce monde. La seconde glisse une pièce du mystère." };
const COUPE_EX = { exemple: true, prologue: "Prologue d'exemple : la vraie histoire s'affichera ici le 1er janvier.", n: 4,
  eclats: ["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza"].map((c, i) =>
    i < 5 && i !== 3 ? { circuit: c, mois: i + 1, etat: "trouve", rang: [1, 3, 2, 0, 1][i], nb: [2, 4, 3, 0, 1][i], premier: "Pilote A", matiere: "matière d'exemple " + (i + 1), couleur: ["#E8B04A", "#9DB4E8", "#E7A1C4", "", "#3BD5E0"][i], symbole: ["★", "◆", "★", "", "◆"][i], texte: ECLAT_EX.texte }
      : i === 3 ? { circuit: c, mois: 4, etat: "manque", nb: 2, premier: "Pilote B" } : { circuit: c, mois: i + 1, etat: "avenir", nb: i === 5 ? 1 : 0, premier: i === 5 ? "Pilote C" : null }) };
function coupeDonnees() { return TRESOR_APERCU && TRESOR_APERCU.coupeEx ? COUPE_EX : TRESORS && TRESORS.coupe || null; }
/** une trouvaille rend son éclat tout de suite (sans attendre le prochain chargement) */
function noterEclat(e, nom, rang) { const c = TRESORS && TRESORS.coupe; if (!c || !c.eclats) return; const x = c.eclats.find(z => z.circuit === e.circuit); if (!x || x.etat === "trouve") return;
  Object.assign(x, { etat: "trouve", rang: rang || (x.nb || 0) + 1, nb: (x.nb || 0) + 1, premier: x.premier || nom, matiere: e.matiere, couleur: e.couleur, texte: e.texte, symbole: e.symbole }); c.n = c.eclats.filter(z => z.etat === "trouve").length; }
/** v20.47 (Théo : « pas fan de plein de couleurs ») · la Coupe en OR MASSIF : 12 éclats de la même matière, sertis dans une coupe à anses.
 *  Trouvé (par moi) = or poli (un seul reflet continu sur toute la coupe, avec son signe gravé) ; à venir = alvéole vide en creux, liseré pointillé et numéro du mois ;
 *  manqué = verre fumé hachuré. La couleur propre de chaque éclat (donnée du serveur) n'est plus affichée. 12/12 : reflet qui passe sur la coupe. */
let CB_N = 0;
function svgCoupe(c, actif) {
  const k = "cb" + (++CB_N), E = c.eclats || [], n = E.filter(e => e.etat === "trouve").length, f = v => Math.round(v * 10) / 10;
  const Y = [-50, -27, -5, 16], hw = y => 58 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 50) / 76, 2)));
  const JX = [[0, 0, 0, 0, 0], [0, 3, -2, 2, 0], [0, -2, 3, -1, 0], [0, 2, -1, 3, 0]], JY = [[0, 0, 0, 0, 0], [0, 2, -2, 1, 0], [0, -2, 2, -2, 0], [0, 1, -1, 2, 0]];
  const MX = [[0, -2, 2, -1, 0], [0, 2, -2, 2, 0], [0, -1, 2, -2, 0]], MY = [[0, 0, 0, 0], [-1.5, 1.5, -1, 1.5], [1.5, -1.5, 1.5, -1], [-1, 1.5, -1.5, 1]];
  const P = (r, q) => [f(hw(Y[r]) * (q - 2) / 2 + JX[r][q]), Y[r] + JY[r][q]], A = (p) => "A58 76 0 0 1 " + p.join(" "), L = p => "L" + p.join(" "), m = (a, b, dx, dy) => [f((a[0] + b[0]) / 2 + dx), f((a[1] + b[1]) / 2 + dy)];
  let g = "", t = "";
  for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) { const i = r * 4 + q, e = E[i] || { etat: "avenir" }, TL = P(r, q), TR = P(r, q + 1), BR = P(r + 1, q + 1), BL = P(r + 1, q);
    const d = "M" + TL.join(" ") + (r ? L(m(TL, TR, 0, MY[r][q])) : "") + L(TR) + (q === 3 ? A(BR) : L(m(TR, BR, MX[r][q + 1], 0)) + L(BR)) + L(m(BR, BL, 0, MY[r + 1][q])) + L(BL) + (q === 0 ? A(TL) : L(m(BL, TL, MX[r][q], 0)) + "Z");
    const fill = e.etat === "trouve" ? "url(#" + k + "o)" : e.etat === "manque" ? "url(#" + k + "h)" : "url(#" + k + "c)", cx = f((TL[0] + TR[0] + BR[0] + BL[0]) / 4), cy = f((TL[1] + TR[1] + BR[1] + BL[1]) / 4 + 3.7);
    g += '<path class="cb-ec e-' + e.etat + (i === actif ? " actif" : "") + '" data-ec="' + i + '" d="' + d + '" fill="' + fill + '"/>';
    if (e.etat === "avenir") t += '<text class="cb-num" x="' + cx + '" y="' + cy + '">' + (i + 1) + "</text>";
    else if (e.etat === "trouve" && e.symbole) t += '<text class="cb-grav' + (i === actif ? " actif" : "") + '" x="' + cx + '" y="' + cy + '">' + esc(e.symbole) + "</text>"; }
  const or = (id, a) => '<linearGradient id="' + k + id + '" gradientUnits="userSpaceOnUse" ' + a + '><stop offset="0" style="stop-color:var(--cb-or0)"/><stop offset=".32" style="stop-color:var(--cb-or1)"/><stop offset=".46" style="stop-color:var(--cb-or2)"/><stop offset=".62" style="stop-color:var(--cb-or1)"/><stop offset="1" style="stop-color:var(--cb-or0)"/></linearGradient>';
  const bol = "M-58 -50A58 76 0 0 0 58 -50Z", reflet = n === 12 || actif >= 0;
  return '<svg class="cb-svg' + (n === 12 ? " complet" : "") + '" viewBox="-80 -60 160 126" aria-hidden="true"><defs>' + or("o", 'x1="-62" y1="0" x2="62" y2="0"') +
    '<linearGradient id="' + k + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--cb-creux2)"/><stop offset=".5" style="stop-color:var(--cb-creux)"/></linearGradient>' +
    '<pattern id="' + k + 'h" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.2" height="3.2" style="fill:var(--cb-fume)"/><path d="M0 0V3.2" style="stroke:var(--cb-hach)" stroke-width=".7"/></pattern>' +
    '<linearGradient id="' + k + 'v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>' +
    '<linearGradient id="' + k + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<clipPath id="' + k + 'b"><path d="' + bol + '"/></clipPath></defs>' +
    '<g class="cb-metal" style="stroke:url(#' + k + 'o)"><path class="cb-anse" d="M-54 -41C-77 -45 -80 -5 -42 4"/><path class="cb-anse" d="M54 -41C77 -45 80 -5 42 4"/></g>' +
    '<g fill="url(#' + k + 'o)"><path d="' + bol + '"/><path d="M-4.5 25H4.5L3 43H-3Z"/><ellipse cx="0" cy="31" rx="7.5" ry="3.4"/><path d="M-15 43H15Q20 43 22 50H-22Q-20 43 -15 43Z"/><rect x="-29" y="50" width="58" height="9" rx="1.6"/></g>' +
    '<rect class="cb-plaque" x="-15" y="52.4" width="30" height="4.2" rx=".8"/>' + g + t +
    '<path d="' + bol + '" fill="url(#' + k + 'v)" pointer-events="none"/>' + (reflet ? '<g clip-path="url(#' + k + 'b)" class="cb-reflets"><rect class="cb-reflet" x="-30" y="-60" width="22" height="100" fill="url(#' + k + 's)"/></g>' : "") +
    '<rect x="-61.5" y="-53.5" width="123" height="4.6" rx="2.3" fill="url(#' + k + 'o)" class="cb-bord"/></svg>';
}
function ouvrirCoupe(c0) {
  const c = c0 || coupeDonnees(); if (!c) return;
  document.querySelectorAll(".coupe-b").forEach(x => x.remove());
  const nomGP = ci => (GPS[ci] ? GPS[ci].drap + " " + GPS[ci].gp : ci), signes = (c.eclats || []).filter(e => e.etat === "trouve" && e.symbole).map(e => e.symbole);
  const autres = e => e.nb ? (e.nb === 1 ? "1 pilote l'a trouvé" : e.nb + " pilotes l'ont trouvé") + (e.premier ? " (le 1er : " + esc(e.premier) + ")" : "") : "personne ne l'a encore trouvé";
  const ligne = (e, i) => '<li class="cb-l e-' + e.etat + '" data-ec="' + i + '"><span class="cb-m">' + MOIS_COUPE[i] + "</span><div><b>" + esc(nomGP(e.circuit)) + "</b>" +
    (e.etat === "avenir" ? "<small>À trouver en " + ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][i] + " : trouve le trésor du mois pour gagner cet éclat" + (e.nb ? " · " + autres(e) : "") + ".</small>"
      : e.etat === "manque" ? "<small>Tu n'as pas trouvé le trésor de ce mois : cet éclat te manquera pour l'énigme. " + autres(e) + ".</small>"
      : "<small>Éclat de " + esc(e.matiere || "") + " · trouvé " + (e.rang === 1 ? "en premier 🥇" : e.rang ? "en " + e.rang + "e" : "") + (e.nb > 1 ? " · " + e.nb + " pilotes l'ont" : "") + "</small><p>" + esc(e.texte || "") + "</p>") +
    "</div>" + (e.etat === "trouve" && e.symbole ? '<span class="cb-s" title="Le signe gravé sur cet éclat">' + esc(e.symbole) + "</span>" : "") + "</li>";
  const o = document.createElement("div"); o.className = "regles coupe-b"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "La Coupe brisée");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>🏆 La Coupe brisée' + (c.exemple ? " · aperçu (exemple inventé)" : "") + '</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div><div class="rg-corps">' +
    '<div class="cb-haut">' + svgCoupe(c) + '<div><p class="cb-n"><b>' + (c.n || 0) + "</b> éclat" + ((c.n || 0) > 1 ? "s" : "") + " sur 12</p>" +
    '<p class="cb-leg"><span><i class="l-t"></i>trouvé</span><span><i class="l-v"></i>à venir</span><span><i class="l-m"></i>manqué</span></p><p class="cb-pro">' + esc(c.prologue || "") + "</p></div></div>" +
    (signes.length ? '<div class="cb-signes"><span>Les signes gravés</span><b>' + signes.map(esc).join(" ") + "</b><small>Chaque éclat porte un signe. Réunis, ils désignent un endroit…</small></div>" : "") +
    '<ol class="cb-liste">' + (c.eclats || []).map(ligne).join("") + "</ol></div></div>";
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  const fermer = () => { o.remove(); if (!document.querySelector(".regles")) document.documentElement.classList.remove("fige"); };
  o.querySelector(".rg-x").addEventListener("click", fermer); o.addEventListener("click", ev => { if (ev.target === o) fermer(); });
  o.addEventListener("keydown", ev => { if (ev.key === "Escape") fermer(); });
  o.querySelectorAll(".cb-svg [data-ec]").forEach(p => p.addEventListener("click", () => { const l = o.querySelector('.cb-l[data-ec="' + p.dataset.ec + '"]'); if (l) { l.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" }); l.classList.remove("flash"); void l.offsetWidth; l.classList.add("flash"); } }));
  o.querySelector(".rg-x").focus();
}
/** la révélation d'un éclat, juste après une trouvaille ; rang 1 (le premier à trouver le trésor) : cérémonie dorée plein écran */
function revelerEclat(e, rang) {
  const c = coupeDonnees(), i = c && c.eclats ? c.eclats.findIndex(z => z.circuit === e.circuit) : -1;
  if (rang === 1) { ceremonieEclat(e, c, i); return; }
  const o = document.createElement("div"); o.className = "regles coupe-b cb-rev"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Un éclat de la Coupe");
  o.innerHTML = '<div class="rg-c"><span class="tuto-k">🏆 Un éclat de la Coupe</span>' + (c ? svgCoupe(c, i) : "") +
    "<h3>Éclat de " + esc(e.matiere || "") + "</h3><p>" + esc(e.texte || "") + "</p>" + (e.symbole ? '<p class="cb-s1">Un signe y est gravé : <b>' + esc(e.symbole) + "</b></p>" : "") +
    '<div class="btn-row">' + (c ? '<button class="btn" type="button" data-cb-voir>Voir la Coupe</button>' : "") + '<button class="btn ghost" type="button" data-cb-ok>Fermer</button></div></div>';
  document.body.appendChild(o);
  const fermer = () => o.remove();
  o.querySelector("[data-cb-ok]").addEventListener("click", fermer);
  const v = o.querySelector("[data-cb-voir]"); if (v) v.addEventListener("click", () => { fermer(); ouvrirCoupe(); });
  if (window.SONS && SONS.jingle) try { SONS.jingle("garage", "motif"); } catch (er) { /* sans son */ }
}
/** Refonte des badges (Théo, 24/11) · le PREMIER à trouver le trésor du mois : grande révélation dorée (comme un secret doré), son nom gravé ;
 *  la trouvaille compte aussi pour le titre du Flair (3 points au 1er). Animations réduites : tout s'affiche d'un coup, sans mouvement. */
/** v20.62 (Théo) · trésor de décembre 2026 trouvé : la plaque « Chercheur de Noël » (dorée pour le premier). Une ligne, une plaque, rien sur la cachette. */
function ceremonieChercheurNoel(rang) {
  const moi = moiVrai() || "", or = rang === 1, id = or ? "chercheuror" : "chercheur";
  const o = document.createElement("div"); o.className = "revel cb-or cn-rev" + (reduit ? " reduit" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Chercheur de Noël");
  o.innerHTML = '<div class="rv-c cbo-c"><span class="cbo-rayons" aria-hidden="true"></span><span class="tuto-k">🎅 Trésor de l\'Atelier du Père Noël</span><h3>Trouvé' + (or ? " en premier ! 🥇" : " !") + "</h3>" +
    '<p class="cn-gain">🎁 Tu gagnes la plaque <b>Chercheur de Noël</b>' + (or ? ", dans sa version dorée : tu es le premier !" : ".") + "</p>" +
    '<div class="tk-obj">' + (typeof vignetteItem === "function" ? vignetteItem("plaque", id, moi, {}) : "") + "</div>" +
    '<p class="cbo-flair">Elle est à toi pour toujours, dans ton écurie · aucun point</p><div class="btn-row"><button class="btn ghost" type="button" data-cb-ok>Génial !</button></div></div>';
  document.body.appendChild(o);
  const t0 = Date.now(), fermer = () => { o.remove(); try { rendreVue(vueActive()); } catch (er) { } };
  o.addEventListener("click", ev => { if (ev.target === o && Date.now() - t0 > 1500) fermer(); });
  o.querySelector("[data-cb-ok]").addEventListener("click", fermer);
  try { confettis("trophees"); } catch (er) { /* sans fête */ }
}
function ceremonieEclat(e, c, i) {
  const moi = moiVrai() || "toi", G = GPS[e.circuit];
  const o = document.createElement("div"); o.className = "revel cb-or" + (reduit ? " reduit" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Premier à trouver le trésor");
  o.innerHTML = '<div class="rv-c cbo-c"><span class="cbo-rayons" aria-hidden="true"></span><span class="tuto-k">🥇 Premier à trouver le trésor</span>' +
    (c ? '<div class="cbo-coupe">' + svgCoupe(c, i) + "</div>" : "") +
    "<h3>Éclat de " + esc(e.matiere || "") + "</h3>" + (G ? '<small class="cbo-u">' + G.drap + " " + esc(G.gp) + "</small>" : "") +
    '<p class="cbo-grave">Gravé à ton nom : <b>' + esc(moi) + "</b></p><p>" + esc(e.texte || "") + "</p>" + (e.symbole ? '<p class="cb-s1">Un signe y est gravé : <b>' + esc(e.symbole) + "</b></p>" : "") +
    (typeof saisonJouee === "function" && saisonJouee() ? '<p class="cbo-flair">🔍 +3 au score de chercheur (titre du Flair) · aucun point au championnat</p>' : "") +
    '<div class="btn-row">' + (c ? '<button class="btn acc" type="button" data-cb-voir>Voir la Coupe</button>' : "") + '<button class="btn ghost" type="button" data-cb-ok>Génial !</button></div></div>';
  document.body.appendChild(o);
  const t0 = Date.now(), fermer = () => o.remove();
  o.addEventListener("click", ev => { if (ev.target === o && Date.now() - t0 > 1500) fermer(); });
  o.querySelector("[data-cb-ok]").addEventListener("click", fermer);
  const v = o.querySelector("[data-cb-voir]"); if (v) v.addEventListener("click", () => { fermer(); ouvrirCoupe(); });
  try { confettis("trophees"); } catch (er) { /* sans fête */ }
  if (window.SONS && SONS.jingle) setTimeout(() => { try { SONS.jingle("defaut", "accord"); } catch (er) { /* sans son */ } }, 700);
}
/** aperçu admin : l'écran de la Coupe avec un exemple inventé (rien du vrai contenu) */
function apercuCoupe() { if (!apercuAutorise()) return; ouvrirCoupe(COUPE_EX); }
/** v17.35 · 🗝️ Aperçu admin de la chasse au trésor, DIRECTEMENT sur la page Course (Théo : pas de fenêtre à part) :
    le circuit affiché reçoit une énigme, un 2e indice, des chercheurs et une cachette D'EXEMPLE, inventés (sans rapport avec les vrais trésors),
    et passe en 📺 Visite ; tout le parcours des joueurs marche (carte 2D, Visite, plein écran, trouvaille). Rien n'est envoyé au serveur,
    rien n'est gardé : « ✕ Quitter » (ou changer d'onglet ou de circuit) remet l'état réel. */
/* v20.45 (Théo) : l'exemple dit vrai sur SA cachette (posée au hasard au ras du sol, près du milieu de l'écran) ; les vraies énigmes, elles, décrivent le décor exact autour de chaque trésor */
const TAP_EX = { type: "gemme", enigme: "Énigme d'exemple : une petite gemme orange a roulé hors de la piste. Elle attend au ras du sol, pas loin du centre de la carte, là où personne ne regarde.",
  ind: "Indice d'exemple : descends tout près du sol et zoome au maximum : elle n'apparaît que de très près.", ch: [{ nom: "Pilote A", j: 20271104 }, { nom: "Pilote B", j: 20271109 }] };
function ouvrirApercuTresor() {
  if (!apercuAutorise()) return;   // v20.40 : double sécurité
  if (TRESOR_APERCU) { quitterApercuTresor(true); return; }
  if (typeof vueActive === "function" && vueActive() !== "trophees") allerA("trophees");
  if (saisonVisible() && ongletPodium() !== "gp") { ETAT.podium = "gp"; garder(); rendreTrophees(); }
  const pi = document.getElementById("gp-piste");
  if (!pi) { toast("🗝️ L'aperçu se fait sur la page Course : elle n'est pas encore ouverte (passe en « Tout afficher »)."); return; }
  const ci = pi.dataset.circuit;
  TRESOR_APERCU = { ci, F: { circuit: ci, type: TAP_EX.type, p: null, enigme: TAP_EX.enigme }, etape: 0, avecCh: false, trouves: [],
    sauve: { T: TRESORS, Tt: TRESORS_T, gp2d: ETAT.gp2d, gpVue3: ETAT.gpVue3 },
    trouver(t) { const deja = this.trouves.indexOf(t.circuit) >= 0; if (!deja) this.trouves.push(t.circuit); return { ok: true, deja, trouves: this.trouves.slice(), total: this.trouves.length, rang: (this.avecCh ? TAP_EX.ch.length : 0) + 1, eclat: deja ? null : Object.assign({ circuit: t.circuit }, ECLAT_EX) }; } };
  apDonnees();
  if (vuesV2(ci)) choisirVueGP("visite"); else if (piste3D()) { ETAT.gp2d = "0"; garder(); rendreTrophees(); }   // autres circuits : la vue 3D libre (hélico) tient lieu de Visite
  poserTresorDOM(document);
  toast("👁️ Aperçu du trésor : exemple inventé, rien n'est envoyé. Zoome au maximum, au ras du sol (ou 🎯 dans le bandeau).");
}
/** les données d'exemple, telles que le serveur les donnerait */
function apDonnees() {
  const AP = TRESOR_APERCU; if (!AP) return; const F = AP.F;
  F.indice2 = AP.etape >= 1 ? TAP_EX.ind : undefined; F.chaudFroid = AP.etape === 2 && !AP.avecCh && !AP.trouves.length; F.jChaud = F.chaudFroid ? 20271121 : undefined; F.chercheurs = AP.avecCh ? TAP_EX.ch.map(x => Object.assign({}, x)) : [];
  TRESORS = { l: [F], trouves: AP.trouves.slice(), total: AP.trouves.length };
}
/** remet l'état réel ; vue = true : on revient aussi à la vue d'avant et on redessine la page (bouton « Quitter ») */
function quitterApercuTresor(vue) {
  const AP = TRESOR_APERCU; if (!AP) return;
  TRESOR_APERCU = null; TRESOR_EL = null; TRESORS = AP.sauve.T; TRESORS_T = AP.sauve.Tt;
  document.querySelectorAll(".tap-band, .gp-piste .gp-tresor, .gp-piste .gp-enigme, .gp-piste .gp-tresor-appel, .gp-piste .gp-jauge").forEach(e => e.remove());
  if (!vue) return;
  ETAT.gp2d = AP.sauve.gp2d; ETAT.gpVue3 = AP.sauve.gpVue3; garder();
  if (GP_PLEIN) fermerPleinGP();
  if (vueActive() === "trophees") rendreTrophees();
}
/** le petit bandeau de l'aperçu, posé dans la piste (il la suit en plein écran) */
function apBandeau(pi) {
  const AP = TRESOR_APERCU, pr = (k, v) => ' aria-pressed="' + v + '"';
  pi.insertAdjacentHTML("beforeend", '<div class="tap-band" role="group" aria-label="Aperçu admin du trésor"><b>👁️ Aperçu · exemple inventé · rien n\'est envoyé</b><button type="button" class="tap-x" data-tapx>✕ Quitter</button><i class="tap-br"></i>' +
    '<span class="tap-seg"><button type="button" data-tapi="0"' + pr(0, AP.etape === 0) + '>Avant 11</button><button type="button" data-tapi="1"' + pr(0, AP.etape === 1) + ' title="2e indice tombé">Après 11</button><button type="button" data-tapi="2"' + pr(0, AP.etape === 2) + ' title="Jauge chaud-froid (tant que personne n\'a trouvé)">Après 21 🌡️</button></span>' +
    '<button type="button" data-tapc' + pr(0, AP.avecCh) + ' title="Chercheurs d\'exemple">👥</button><button type="button" data-tapa="pres" title="Me placer près de la cachette">🎯</button><button type="button" data-tapa="rejouer" title="Remettre l\'objet">↺</button></div>');
  const b = pi.querySelector(".tap-band"), redo = () => { apDonnees(); poserTresorDOM(document); };
  b.addEventListener("pointerdown", ev => ev.stopPropagation());
  b.querySelectorAll("[data-tapi]").forEach(x => x.addEventListener("click", ev => { ev.stopPropagation(); AP.etape = +x.dataset.tapi; redo(); }));
  b.querySelector("[data-tapc]").addEventListener("click", ev => { ev.stopPropagation(); AP.avecCh = !AP.avecCh; redo(); });
  b.querySelector('[data-tapa="pres"]').addEventListener("click", ev => { ev.stopPropagation(); apPres(); });
  b.querySelector('[data-tapa="rejouer"]').addEventListener("click", ev => { ev.stopPropagation(); AP.trouves = []; redo(); apPres(); toast("↺ Objet remis en place (aperçu)."); });
  b.querySelector("[data-tapx]").addEventListener("click", ev => { ev.stopPropagation(); quitterApercuTresor(true); });
}
function apPres() {
  const AP = TRESOR_APERCU, a = GP_INST && GP_INST.api, pi = document.getElementById("gp-piste");
  if (!AP || !a || a.type !== "3d" || !pi || pi.classList.contains("en2d") || a.mode() !== "helico") { toast("🎯 Passe d'abord en 📺 Visite."); return; }
  if (!AP.F.p) { toast("🎯 La cachette d'exemple se pose… réessaie dans une seconde."); return; }
  a.viser([AP.F.p[0], AP.F.p[2]], .07, .55); a.reveiller();
}
/** cachette d'exemple : un point quelconque du sol, choisi une fois pour tomber à l'écran en vue rapprochée, puis on reprend de la hauteur (à l'admin de la retrouver, ou 🎯) */
function apCachette() {
  const AP = TRESOR_APERCU; if (!AP || AP.F.p || AP.cherche) return; AP.cherche = true;
  const essai = () => {
    if (TRESOR_APERCU !== AP || AP.F.p) { AP.cherche = false; return; }
    const a = GP_INST && GP_INST.api, pi = document.getElementById("gp-piste");
    if (!a || a.type !== "3d" || !a.projeter || !pi || pi.classList.contains("en2d") || a.mode() !== "helico" || a.enCours() || (a.presentationEnCours && a.presentationEnCours())) { setTimeout(essai, 600); return; }
    a.viser(null, .07, .55);   // v20.62 (trésors) : assez près pour tomber sous les 60 m
    setTimeout(() => {
      if (TRESOR_APERCU !== AP || AP.F.p) { AP.cherche = false; return; }
      if (!GP_INST || GP_INST.api !== a || a.mode() !== "helico") { setTimeout(essai, 400); return; }
      const { w, h } = a.taille(), cand = [];
      for (let x = -600; x <= 600; x += 8) for (let z = -600; z <= 600; z += 8) { const e = a.projeter([x, 1, z]); if (!e || !e.vis || e.d / (a.recul ? a.recul() : 1) > TRESOR_D - 12) continue; cand.push({ s: Math.hypot(e.x - w / 2, e.y - h * .55), p: [x, 1, z] }); }
      cand.sort((u, v) => u.s - v.s); const best = cand.slice(0, 40).find(c => !(a.masque && a.masque(c.p))) || cand[0] || null;   // v20.62 : une cachette d'exemple que le décor ne cache pas
      if (!best) { setTimeout(essai, 400); return; }
      AP.F.p = best.p; AP.cherche = false; poserTresorDOM(document); a.viser(null, .3, .38);
    }, 700);
  };
  setTimeout(essai, 300);
}
/** Ce que chacun a marqué ce mois-ci, en bulles au-dessus des voitures, à l'arrivée */
function bullesGP(y, i) {
  const pi = document.getElementById("gp-piste"), et = etapesGP(y)[i]; if (!pi || !et || !et.m) return;
  const box = pi.querySelector(".gp-pops"); if (!box) return; box.innerHTML = "";
  et.m.l.slice().sort((a, b) => a.rg - b.rg).forEach(x => {
    const extra = [];
    if (x.carte && !x.carte.invalide && x.carte.gain) { const cd = carteDef(x.carte.id); extra.push((cd ? cd.ico : "🃏") + (x.carte.gain > 0 ? "+" : "") + x.carte.gain); }
    if (x.bonus) extra.push("🎯+" + x.bonus); if (x.mult > 1) extra.push("×2"); if (x.vainq) extra.push("🇬🇧+2"); if (x.equipe) extra.push("🤝+1"); if (x.serie) extra.push("🔥+1"); if (x.defi) extra.push("🏁+1"); if (x.prono && x.prono.pts) extra.push("🔮+" + x.prono.pts); if (x.rival) extra.push("😈+3"); if (x.regul !== undefined) extra.push("🛡️+3");
    box.insertAdjacentHTML("beforeend", '<span class="gp-pop" data-pop="' + esc(x.nom) + '" style="--c:' + couleur(x.nom) + '" title="' + esc(x.nom) + '" aria-label="' + esc(x.nom + " " + (x.p >= 0 ? "+" : "") + x.p + " points") + '">' + avatarCourse(x.nom) + "<b>" + (x.p >= 0 ? "+" : "") + x.p + '<i class="gp-pop-u"> pt' + (Math.abs(x.p) > 1 ? "s" : "") + "</i></b>" + (extra.length ? "<small>" + esc(extra.join(" ")) + "</small>" : "") + "</span>");
  });
  if (GP_ETQ) GP_ETQ.sale = true;
  if (GP_INST) { GP_INST.api.reveiller(); etiquettesGP(GP_INST.api); }
  setTimeout(() => { if (box.isConnected) { box.innerHTML = ""; if (GP_ETQ) GP_ETQ.sale = true; } }, 5200);
}
/* ---------- 📸 Carte postale du mois (V13.8) : une image prête à partager (WhatsApp…) ---------- */
async function cartePostale(y, et) {
  const m = et && et.m; if (!m) return;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), css = getComputedStyle(document.documentElement), col = v => css.getPropertyValue(v).trim() || "#9B87FF";
  const ci = circuitDe(m.k), G = GPS[ci], met = meteoMois(m.k), spe = m.spec, fond = g.createLinearGradient(0, 0, 0, H);
  fond.addColorStop(0, "#151A2E"); fond.addColorStop(1, "#0B0E14"); g.fillStyle = fond; g.fillRect(0, 0, W, H);
  const reel = c => { const t = document.createElement("i"); t.style.color = c; document.body.appendChild(t); const r = getComputedStyle(t).color; t.remove(); return r; };
  g.fillStyle = reel(col("--accent")); g.fillRect(0, 0, W, 14);
  const txt = (t, x, yy, taille, poids, coul, align, police) => { g.font = (poids || 700) + " " + taille + "px " + (police || "Saira, sans-serif"); g.fillStyle = coul || "#EDF0F4"; g.textAlign = align || "left"; g.fillText(t, x, yy); };
  txt("VERSUS · PODIUM", 70, 110, 34, 800, "#A9B1BD", "left", "'Saira Condensed', sans-serif");
  txt(G.drap + " " + G.gp, 70, 190, 64, 800, "#FFFFFF", "left", "'Saira Condensed', sans-serif");
  txt(moisLong(m.k) + " · " + met.ico + " " + met.nom + (spe ? " · " + spe.ico + " " + spe.nom : ""), 70, 250, 34, 500, "#A9B1BD");
  const l = m.l.slice().sort((a, b) => b.p - a.p || a.rg - b.rg), med = ["🥇", "🥈", "🥉", "4", "5"];
  const hL = l.length >= 5 ? 142 : 170, pas = hL + (l.length >= 5 ? 22 : 30), q = v => Math.round(v * hL / 170);   // v16.27 : à 5 pilotes, les lignes se resserrent
  l.forEach((x, i) => {
    const y0 = 330 + i * pas;
    g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); g.roundRect ? g.roundRect(60, y0, W - 120, hL, 28) : g.rect(60, y0, W - 120, hL); g.fill();
    g.fillStyle = reel(couleur(x.nom)); g.fillRect(60, y0, 14, hL);
    txt(i < 3 ? med[i] : String(i + 1), 125, y0 + q(105), 64, 800, "#FFFFFF", "center");
    txt(x.nom.toUpperCase(), 190, y0 + q(80), 58, 800, "#FFFFFF", "left", "'Saira Condensed', sans-serif");
    const d = []; if (x.carte && !x.carte.invalide) { const cd = carteDef(x.carte.id); d.push((cd ? cd.ico : "🃏") + (x.carte.gain > 0 ? "+" : "") + x.carte.gain); }
    if (x.bonus) d.push("🎯+" + x.bonus); if (x.prono && x.prono.pts) d.push("🔮+" + x.prono.pts); if (x.equipe) d.push("🤝+1"); if (x.serie) d.push("🔥+1"); if (x.defi) d.push("🏁+1"); if (x.vainq) d.push("🇬🇧+2"); if (x.mult > 1) d.push("×2"); if (x.rival) d.push("😈+3"); if (x.regul !== undefined) d.push("🛡️+3");
    txt((x.r >= 0 ? "+" : "") + (x.r * 100).toFixed(1).replace(".", ",") + " % ce mois" + (d.length ? "   " + d.join("  ") : ""), 190, y0 + q(135), 32, 500, "#A9B1BD");
    txt("+" + x.p, W - 110, y0 + q(100), 76, 800, reel(col("--accent-ink")), "right", "'JetBrains Mono', monospace");
    txt("pts", W - 110, y0 + q(140), 26, 600, "#7A8391", "right", "'JetBrains Mono', monospace");
  });
  const cl = Object.keys(m.cumul).sort((a, b) => m.cumul[b] - m.cumul[a]);
  { const t = "Championnat : " + cl.map((n, i) => (i + 1) + ". " + n + " " + m.cumul[n]).join("   "); g.font = "600 32px Saira, sans-serif"; const lw = g.measureText(t).width, tz = lw > W - 90 ? Math.floor(32 * (W - 90) / lw) : 32;   // v16.27 : rétrécit si trop long (5 pilotes)
    txt(t, W / 2, 1200, tz, 600, "#EDF0F4", "center"); }
  txt("theoperion.github.io/00_VS_Portefeuille", W / 2, 1290, 26, 500, "#7A8391", "center");
  const blob = await new Promise(res => cv.toBlob(res, "image/png")); if (!blob) { toast("Image impossible à créer."); return; }
  const nomF = "versus-" + m.k + ".png", fichier = window.File ? new File([blob], nomF, { type: "image/png" }) : null;
  try { if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], title: "Versus · " + moisLong(m.k) }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), o = document.createElement("div"); o.className = "regles"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>📸 Carte postale</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div><div class="rg-corps"><img src="' + url + '" alt="Carte postale du mois" style="width:100%;border-radius:12px"><p class="info">Appui long sur l\'image pour l\'enregistrer ou la partager, ou :</p><a class="btn acc" download="' + nomF + '" href="' + url + '">Télécharger l\'image</a></div></div>';
  document.body.appendChild(o); const fermer = () => { o.remove(); URL.revokeObjectURL(url); };
  o.addEventListener("click", e => { if (e.target === o) fermer(); }); o.querySelector(".rg-x").addEventListener("click", fermer);
}
/* ---------- V16.28 · La course en 3 tours : un scénario calculé d'avance (même résultat que les points)
   Tours 1 et 2 : la meute dans l'ordre de la grille (aucun faux dépassement). Tour 3 : les vrais changements du mois, ralenti au moment clé,
   le vainqueur franchit la ligne. Distances en tours (0 → 3). ---------- */
const TOURS_GP = 2, E_TOUR = [0, .525], W_TOUR = E_TOUR.map(e => e / .8 * .74);   // v16.29 : 2 tours (Théo : le 1er de 3 faisait doublon) — tour 1 le départ et le spectacle, tour 2 le sprint   // W_TOUR : début de chaque tour en temps réel (avant le ralenti)
let GP_SCEN = null;
/* v17.8 (Théo) · le déroulé en 2 tours, distances en tours (la base B avance pour tout le monde, chacun a un retard « off » sur B) :
   Tour 1 : départ lancé, voitures ÉCARTÉES selon le classement d'avant le mois (écart ∝ écart de points, au moins ECART_MIN pour que
   les têtes ne se chevauchent pas, au plus ETAL_1 en tout) ; personne ne double. Sans mois d'avant : file à écart fixe.
   Tour 2 : chacun glisse de son écart du tour 1 à son écart d'arrivée (∝ points du mois, au moins ECART_ARR) ; une seule interpolation
   commune ⇒ chaque paire se double au plus une fois (aucun faux dépassement). Le vainqueur passe la ligne en premier, les autres un par
   un (ex æquo côte à côte = même rang), puis tout le monde freine ensemble, la ligne franchie. */
const ECART_MIN = .045, ECART_ARR = .06, ETAL_1 = .32, ETAL_2 = .3;
function ecartsGP(noms, v, pas, mini, etal, egauxColles) {   // noms dans l'ordre (premier d'abord), v = valeurs (plus grand = devant)
  const g = noms.map((n, k) => k ? (egauxColles && v[noms[k - 1]] === v[n] ? 0 : Math.max(mini, (v[noms[k - 1]] - v[n]) * pas)) : 0);
  const base = g.reduce((s, x) => s + (x ? mini : 0), 0), plus = g.reduce((s, x) => s + (x ? x - mini : 0), 0);
  const f = plus > 0 && base + plus > etal ? Math.max(0, etal - base) / plus : 1, out = {}; let o = 0;
  noms.forEach((n, k) => { if (k && g[k]) o += mini + (g[k] - mini) * f; out[n] = o; }); return out;
}
function scenarioCourse(mc) {
  const noms = mc.grille.slice(), G = mc.arrivee, P = mc.avant || {};
  const o1 = ecartsGP(noms, Object.fromEntries(noms.map(n => [n, P[n] || 0])), .012, ECART_MIN, ETAL_1, false);
  const arr = noms.slice().sort((a, b) => (G[b] || 0) - (G[a] || 0) || noms.indexOf(a) - noms.indexOf(b));
  const o2 = ecartsGP(arr, G, .03, ECART_ARR, ETAL_2, true);
  const lisse = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const o2max = Math.max(0, ...noms.map(n => o2[n])), BF = TOURS_GP + o2max + .03, BL = TOURS_GP - .1;
  // vitesse de la base : élan au départ, tour 2 un peu plus posé (les dépassements), arrivées au ralenti, puis on freine jusqu'à l'arrêt
  const vit = B => (B < .1 ? .45 + .55 * lisse(B / .1) : 1) * (B > 1 ? .9 : 1) * (B > BL ? .6 : 1) * (B > BF - .06 ? .3 + .7 * (BF - B) / .06 : 1), N = 800, tab = [0];
  for (let k = 1; k <= N; k++) { const B = BF * (k - .5) / N; tab.push(tab[k - 1] + BF / N / vit(B)); }
  const tot = tab[N], Bde = w => { const t = clampN(w, 0, 1) * tot; let a = 0, b = N; while (b - a > 1) { const m = (a + b) >> 1; if (tab[m] <= t) a = m; else b = m; } return BF * (a + (t - tab[a]) / Math.max(1e-9, tab[b] - tab[a])) / N; };
  const wDe = B => { const k = clampN(B / BF * N, 0, N), a = Math.floor(k), b = Math.min(N, a + 1); return (tab[a] + (tab[b] - tab[a]) * (k - a)) / tot; };
  const scen = w => { const B = w >= 1 ? BF : Bde(w), m = lisse((B - 1.03) / .77), out = {};
    noms.forEach(n => { out[n] = B - (o1[n] + (o2[n] - o1[n]) * m); }); return out; };
  return { scen, gains: G, noms, wTour2: wDe(1), wLigne: wDe(TOURS_GP) };
}
function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }
/** lot53 · toucher une ligne du mois déplie / replie le calcul (le nom › ouvre la fiche, une pastille explique son bonus) */
function basculerLigneGP(l) { const k = l.dataset.gpDet, o = !l.classList.contains("ouvert"); l.classList.toggle("ouvert", o); l.setAttribute("aria-expanded", String(o)); if (o) GP_OUVERTS.add(k); else GP_OUVERTS.delete(k); }
document.addEventListener("click", ev => { const l = ev.target.closest && ev.target.closest(".gp-l[data-gp-det]"); if (!l || ev.target.closest("[data-bdg], [data-gp-fiche], a, button")) return; basculerLigneGP(l); });
document.addEventListener("keydown", ev => { if (ev.key !== "Enter" && ev.key !== " ") return; const l = ev.target.classList && ev.target.classList.contains("gp-l") && ev.target.dataset.gpDet ? ev.target : null; if (!l) return; ev.preventDefault(); basculerLigneGP(l); });
/* ---------- V16.18 · Le décompte des points d'un pilote : « 4 place + 1 🎯 + 2 🎲 = 7 » ---------- */
function decompte(x, spec) {
  const l = [(x.plancher ? x.base + "×2 → " + (x.base * x.mult + x.plancher) : x.mult > 1 ? x.base + "×2" : String(x.base)) + " de place"], add = (v, t) => { if (v) l.push((v > 0 ? "+ " : "− ") + Math.abs(v) + " " + t); };
  add(x.bonus, "🎯"); add(x.vainq, spec ? spec.ico : "★");
  if (x.carte && !x.carte.invalide && x.carte.gain) { const cd = carteDef(x.carte.id); add(x.carte.gain, cd ? cd.ico : "🃏"); }
  add(x.equipe, "🤝"); add(x.serie ? 1 : 0, "🔥"); add(x.prono && x.prono.pts, "🔮"); add(x.defi, "🏁"); add(x.rival ? 3 : 0, "😈"); add(x.regul !== undefined ? 3 : 0, "🛡️");
  return l.join(" ") + " = " + x.p + " pt" + (Math.abs(x.p) > 1 ? "s" : "");
}
/* ---------- V16.18 · Le commentateur : 3 à 4 phrases vraies pendant la course, la dernière à l'arrivée ---------- */
let GP_COM = [];
function phrasesCourse(y, i) {
  const etapes = etapesGP(y), et = etapes[i], m = et && et.m; if (!m) return null;
  const mc = mancheGP(etapes, i), av = mc.grille, ap = Object.keys(et.pts).sort((a, b) => et.pts[b] - et.pts[a] || av.indexOf(a) - av.indexOf(b));
  const l = m.l.slice().sort((a, b) => a.rg - b.rg), v = l[0], dern = av[av.length - 1], debut = [], milieu = [];
  debut.push(av.length > 1 ? "🚦 " + av[0] + " part en pole, " + dern + " ferme la marche." : "🚦 Départ !");
  l.forEach(x => { if (x.carte && !x.carte.invalide && x.carte.gain) { const cd = carteDef(x.carte.id); if (cd) milieu.push({ p: Math.abs(x.carte.gain) + 1, t: x.carte.gain > 0 ? cd.ico + " " + x.nom + " sort son " + cd.nom + " : +" + x.carte.gain + " !" : cd.ico + " Raté pour " + x.nom + " : son " + cd.nom + " coûte " + Math.abs(x.carte.gain) + " point" + (Math.abs(x.carte.gain) > 1 ? "s" : "") + "." }); } });
  l.forEach(x => { const g = av.indexOf(x.nom) - ap.indexOf(x.nom); if (g >= 2) milieu.push({ p: g + 1, t: "🚀 " + x.nom + " gagne " + g + " places au championnat !" }); });
  l.forEach(x => { if (x.serie) milieu.push({ p: 2, t: "🔥 " + x.nom + " enchaîne " + x.serie + " mois sans finir dernier." }); });
  if (m.piege) milieu.push({ p: 1.5, t: m.piege.ico + " Piège du circuit : " + m.piege.nom + "." });
  if (m.spec) milieu.push({ p: 1.5, t: m.spec.ico + " " + m.spec.nom + " : " + m.spec.txt.replace(/\.$/, "") + "." });
  milieu.sort((a, b) => b.p - a.p);
  const chg = av[0] !== ap[0] ? "🥇 " + ap[0] + " prend la tête du championnat !" : null;
  const fin = (v ? "🏁 " + v.nom + " remporte la manche (+" + v.p + " pts)" + (v.bonus ? ", et bat l'indice 🎯" : "") + "." : "🏁 Arrivée !") + (chg ? " " + chg : "");
  return { debut, milieu: milieu.slice(0, 2).map(z => z.t), fin };
}
function commenter(y, i, duree, delai) {
  GP_COM.forEach(clearTimeout); GP_COM = [];
  const box = document.querySelector("#gp-piste .gp-com"); if (!box) return; const P = phrasesCourse(y, i); if (!P) { box.innerHTML = ""; return; }
  const dire = (t, dur) => { const b = document.querySelector("#gp-piste .gp-com"); if (!b) return; b.innerHTML = '<span class="gp-com-t">' + esc(t) + "</span>"; if (dur) GP_COM.push(setTimeout(() => { const bb = document.querySelector("#gp-piste .gp-com"); if (bb) bb.innerHTML = ""; }, dur)); };
  if (duree < 0) { dire(P.fin, 7000); return; }
  const d0 = delai || 0, n = duree - d0, q = P.debut.concat(P.milieu);
  const l = (GP_SCEN ? [[0, P.debut[0]], [.24, P.milieu[0]], [GP_SCEN.wTour2 || W_TOUR[1], "🏁 Dernier tour !" + (P.milieu[1] ? " · " + P.milieu[1] : "")]].filter(x => x[1]) : q.map((t, k) => [k / Math.max(1, q.length), t])).map(([w, t]) => [d0 + w * n + 150, t]);
  // v20.47 : les phrases suivent l'horloge de la course (⏸ pause = le commentaire attend aussi)
  const H = GP_HORLOGE; let k0 = -1; const iv = setInterval(() => { if (GP_HORLOGE !== H || !H) { clearInterval(iv); return; } const t = tempsCourse(H); let k = -1; l.forEach((x, j) => { if (x[0] <= t) k = j; }); if (k > k0) { k0 = k; dire(l[k][1], 0); } if (t > duree + 400) clearInterval(iv); }, 120);
  GP_COM.push(iv);
}
/* ---------- v20.47 (Théo) · ⏸ Pause / ▶ Reprendre : l'animation, le commentaire et le son s'arrêtent, puis repartent là où ils en étaient ---------- */
let GP_HORLOGE = null;   // { t0, pauses, pause, total (ms, feux compris), feux, cle }
function tempsCourse(H) { return (H.pause || performance.now()) - H.t0 - H.pauses; }
function enPauseGP() { const a = GP_INST && GP_INST.api; return !!(a && a.suspendu && a.suspendu()); }
function basculerPauseGP(forcer) {
  const api = GP_INST && GP_INST.api; if (!api || !api.suspendre || !api.enCours()) { majPauseGP(); return; }
  const p = forcer !== undefined ? forcer : !api.suspendu(); if (p === api.suspendu()) return; api.suspendre(p); const H = GP_HORLOGE, now = performance.now();
  if (H) { if (p) H.pause = now; else if (H.pause) { H.pauses += now - H.pause; H.pause = 0; } }
  if (window.SONS) { const son = !!(H && H.son);   // la course en direct (sans son) ne bloque jamais l'ambiance
    if (p) { if (son && SONS.pauseCourse) SONS.pauseCourse(); }
    else if (son) { const t = tempsCourse(H), avant = Math.max(0, H.feux - t), reste = H.total - Math.max(t, H.feux); if (reste > 300) SONS.course(reste, avant, H.cle); else if (SONS.repriseCourse) SONS.repriseCourse(); }
    else if (SONS.repriseCourse) SONS.repriseCourse(); }
  majPauseGP();
}
/** v20.62 (Théo, 25/11) · plein écran : toujours un ▶ utile, avec son nom écrit. Avant le 1/12/2026 « ▶ Course de démo » (la 🎬 démo, rien ne compte),
 *  ensuite « ↻ Revoir » (la vraie course du mois choisi ; un seul mot partout, relecture du 25/11). ⏭ (aller à l'arrivée) ne se montre que pendant une course. */
function majPlayPlein() {
  const b = document.querySelector(".gpp-play"); if (!b) return;
  const demo = !!document.getElementById("gp-demo"), lib = demo ? "▶ Course de démo" : "↻ Revoir";
  if (b.dataset.lib === lib) return; b.dataset.lib = lib;
  b.textContent = lib; b.title = demo ? "Course de démonstration (rien ne compte)" : "Revoir la course";
  b.setAttribute("aria-label", demo ? "Lancer la course de démonstration (rien ne compte)" : "Revoir la course");
}
function majPauseGP() {
  const api = GP_INST && GP_INST.api, en = !!(api && api.enCours && api.enCours()), p = en && enPauseGP(), v = en + "|" + p;
  document.querySelectorAll("#gp-pause, .gpp-pause").forEach(b => { if (b.dataset.v === v) return; b.hidden = !en; b.dataset.v = v; b.setAttribute("aria-pressed", String(p));
    b.setAttribute("aria-label", p ? "Reprendre la course" : "Mettre la course en pause"); b.textContent = p ? "▶ Reprendre" : "⏸\uFE0F Pause"; });
  document.querySelectorAll(".gpp-fin").forEach(b => { b.hidden = !en; });   // v20.62 : ⏭ seulement pendant une course (sinon inutile)
  document.querySelectorAll(".gpp-play").forEach(b => { b.hidden = en; });   // pendant la course : ⏸ / ⏭ ; à l'arrêt : ▶
}
/* ---------- v20.47 (Théo) · 📷 Mode photo : toute l'interface disparaît (boutons, sous-titres, bandeaux, têtes) pour admirer le décor ; un toucher (ou Échap, ou le retour) la ramène ---------- */
function modePhotoGP(on, y) {
  if (on && !GP_PLEIN) { ouvrirPleinGP(y); setTimeout(() => modePhotoGP(true, y), 350); return; }
  const P = GP_PLEIN; if (!P) return; if (!!P.photo === !!on) return; P.photo = !!on;
  P.o.classList.toggle("photo", P.photo);
  if (P.photo) { const h = document.createElement("div"); h.className = "gpp-photo-aide"; h.textContent = "📷 Mode photo · touche l'écran pour revenir"; P.o.appendChild(h); setTimeout(() => h.remove(), 2600);
    let d = null; P.photoDown = ev => { d = { x: ev.clientX, y: ev.clientY, t: performance.now() }; };
    P.photoUp = ev => { if (!d) return; const tap = Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 8 && performance.now() - d.t < 350; d = null; if (tap && performance.now() - P.photoT > 400) { ev.stopPropagation(); ev.preventDefault(); modePhotoGP(false); } };
    P.photoT = performance.now(); P.o.addEventListener("pointerdown", P.photoDown, true); P.o.addEventListener("pointerup", P.photoUp, true); }
  else { P.o.removeEventListener("pointerdown", P.photoDown, true); P.o.removeEventListener("pointerup", P.photoUp, true); const h = P.o.querySelector(".gpp-photo-aide"); if (h) h.remove(); }
  GP_ETQ = null; if (GP_INST) { GP_INST.api.redim(); requestAnimationFrame(() => GP_INST && GP_INST.api.redim()); }
}
/* ---------- 🎬 V16.12 · Bande-annonce avant la course · V16.70 : « le circuit, la règle, le trésor » (affiche de cinéma) ---------- */
const BA_STYLE = {   // couleurs et police de chaque circuit (la bande-annonce prend le ton de l'univers)
  abudhabi: ["#FF9A3D", "#FFE2B0", "sans"], bahrein: ["#FFB547", "#FFE9C2", "serif"], djeddah: ["#E2B93B", "#F3E6C4", "serif"], melbourne: ["#FF6FA8", "#FFFFFF", "serif"],
  suzuka: ["#E2B93B", "#F4EAD2", "serif"], miami: ["#5CF2FF", "#E6D2FF", "sans"], montreal: ["#FFE81F", "#FFFFFF", "sans"], silverstone: ["#FF8A3D", "#F6D29A", "large"],
  spa: ["#FF2A2A", "#FFFFFF", "serif"], monza: ["#E5484D", "#F7CF55", "sans"], singapour: ["#FF8FB8", "#F7CF55", "serif"], interlagos: ["#C8102E", "#F4F1EA", "sans"], lasvegas: ["#3ED6E0", "#FFFFFF", "serif"] };
let BA_OUVERTE = null;
/* V16.70 · Trois plans, un seul message par plan (avis de Théo : « mettre en avant le nouveau circuit, la règle du mois, l'objet à trouver »).
   0-1,8 s LE CIRCUIT (la carte peinte en plein cadre, travelling + lueur qui balaie, le nom de l'univers en titre d'affiche) · 1,8-3,7 LA RÈGLE DU MOIS (carton de film muet)
   · 3,7-6,95 LE TRÉSOR (silhouette noire bordée de lumière, l'énigme ; l'objet ne s'éclaire qu'à moitié en fin de plan) · 6,95 les 5 feux · 8,2 « C'est parti ! » jusqu'à 9,0.
   Un seul des deux (règle ou trésor) : le plan 1 dure 2,2 s. Sans les deux (chauffe sans trésor) : 3,95 s avec deux balayages de lumière (6 s en tout).
   Le trésor n'apparaît que pour la manche du mois (ou la dernière course) : jamais sur la rediffusion d'une vieille manche.
   Jamais affiché : points, classement, pilotes, résultat du mois, emplacement du trésor, chercheurs. Animations réduites : une affiche fixe, 7 s, un toucher ferme. */
function brefRegle(r) { return (r.bref || String(r.txt || "").split(/(?<=[.!?])\s/)[0].replace(/\.$/, "")).replace(/ ([:;!?])/g, "\u00a0$1"); }   // espace insécable : jamais « : » seul en début de ligne
const sansArticle = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(le |la |les |l')/, "").replace(/[^a-z0-9]/g, "");
function bandeAnnonce(y, i, ensuite) {
  if (BA_OUVERTE) BA_OUVERTE.fermer(false);
  const etapes = etapesGP(y), et = etapes[i], c = championnat(y), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), G = GPS[ci];
  const st = BA_STYLE[ci] || ["#9B87FF", "#FFFFFF", "sans"], img = window.Piste && Piste.carte ? Piste.carte(ci) : null;
  const spe = et.k ? moisSpecial(y, et.k) : null, pg = !spe && et.k && typeof piegeMois === "function" ? piegeMois(y, et.k) : null, regle = spe || pg;
  // le trésor : seulement pour la manche du mois, ou la dernière course jouée (pas sur la rediffusion d'une vieille manche) ; pas chargé, absent ou déjà trouvé : plan sauté
  const iDer = etapes.reduce((a, e, q) => e.avenir ? a : q, -1), duMois = !!et.avenir || i === iDer;
  const tr = duMois && typeof tresorsOuverts === "function" && tresorsOuverts() ? tresorDuCircuit(ci) : null;
  // l'horloge du film : chaque plan commence où le précédent s'arrête
  const d1 = regle && tr ? 1.8 : regle || tr ? 2.2 : 3.95, t2 = d1, t3 = t2 + (regle ? 1.9 : 0), dT = 3.25, tFeux = t3 + (tr ? dT : 0), tOut = tFeux + 1.25, total = reduit ? 7000 : Math.round((tOut + .8) * 1000);
  const zFin = tFeux - .22;   // le dernier plan s'efface juste avant que les feux descendent (pas de chevauchement)
  const T = v => v.toFixed(2) + "s", plan = (cl, a, z, h) => '<section class="ba-plan ' + cl + '" style="--a:' + T(a) + ";--z:" + T(z) + '">' + h + "</section>";
  // PLAN 1 · le circuit
  const sous = c.chauffe ? "Tour de chauffe · " + MOIS_L[kGP % 100 - 1] : "Manche " + (et.k ? et.k % 100 : 1) + "/12 · " + MOIS_L[kGP % 100 - 1];
  const p1 = plan("ba-p1", 0, regle || tr ? t2 : zFin, '<h2 class="ba-titre">' + esc(G.ville) + '</h2><i class="ba-barre"></i>' +
    (sansArticle(G.gp) === sansArticle(G.ville) ? "" : '<p class="ba-gp"><span>' + G.drap + "</span> " + esc(G.gp) + "</p>") + '<p class="ba-leg">' + esc(sous) + "</p>");   // chauffe : « Le Garage des rêves » ne répète pas le titre
  // PLAN 2 · la règle du mois, en mots simples
  const p2 = regle ? plan("ba-p2", t2, tr ? t3 : zFin, '<i class="ba-ico">' + regle.ico + '</i><p class="ba-etiq">' + (spe ? "Mois spécial" : "Piège du circuit") + "</p>" +
    '<h3 class="ba-regle">' + esc(regle.nom) + '</h3><p class="ba-bref">' + esc(brefRegle(regle)) + "</p>") : "";
  // PLAN 3 · le trésor du mois : l'objet en silhouette qui s'allume, l'énigme mot à mot (jamais l'emplacement)
  let p3 = "";
  if (tr) {
    // l'énigme arrive vite (0,6 s) puis reste ~2,3 s à lire ; jamais coupée : la police rétrécit avec la longueur
    const brut = String(tr.enigme || ""), mots = brut.split(/\s+/).filter(Boolean), pas = Math.min(.05, .6 / Math.max(1, mots.length)), lg = brut.length > 130 ? " l3" : brut.length > 90 ? " l2" : "";
    const enig = mots.map((m, q) => '<span style="--m:' + T(t3 + .35 + q * pas) + '">' + esc(m) + "</span>").join(" ");
    const parts = [0, 1, 2, 3, 4, 5, 6].map(q => '<b style="--k:' + (q * 51 + 12) + "deg;--q:" + (q % 3) + '"></b>').join("");
    p3 = plan("ba-p3", t3, zFin, '<div class="ba-relique" style="--r:' + T(t3 + .45) + ";--rd:" + T(dT - .45) + '"><i class="ba-rai"></i><i class="ba-rayons"></i><span class="ba-objet">' + (TRESOR_SVG[tr.type] || TRESOR_SVG.gemme) + '</span><span class="ba-parts">' + parts + "</span></div>" +
      '<div class="ba-cart"><p class="ba-etiq">🗝️ ' + (et.avenir || !et.k || c.chauffe ? "Le trésor du mois" : "Le trésor du circuit") + '</p><p class="ba-enig' + lg + '">' + enig + '</p><p class="ba-ou" style="--m:' + T(t3 + 1) + '">À chercher dans la Visite 3D</p>' +
      (tr.indice2 ? '<p class="ba-ind" style="--m:' + T(t3 + 1.15) + '">💡 ' + esc(tr.indice2) + "</p>" : "") + "</div>");   // indice 2 : le serveur ne l'envoie qu'une fois tombé (le 11, si personne n'a trouvé)
  }
  // les feux sous le rappel du circuit, puis le départ (plus de têtes de pilotes : avis des critiques, elles servaient peu)
  const feux = [0, 1, 2, 3, 4].map(q => { const t = tFeux + q * .25; return '<i style="--d:' + t.toFixed(2) + "s;--l:" + (tOut - t).toFixed(2) + 's"></i>'; }).join("");
  const rappel = '<p class="ba-rappel"><span>' + G.drap + "</span> " + esc(G.ville) + "</p>";
  const go = ensuite ? "C'est parti !" : et.avenir ? "Verdict à la fin du mois" : "Rendez-vous au premier départ";
  const o = document.createElement("div"); o.className = "ba ba-" + st[2] + (reduit ? " reduit" : "") + (tr ? " a-tresor" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Bande-annonce : " + G.gp);
  [["--b1", st[0]], ["--b2", st[1]], ["--t", (total / 1000) + "s"], ["--t2", T(t2)], ["--t3", T(t3)], ["--tf", T(tFeux)], ["--tx", T(tOut)], ["--fz", T(regle || tr ? t2 : tFeux)]].forEach(([k, v]) => o.style.setProperty(k, v));
  o.innerHTML = '<div class="ba-fond' + (regle ? " f2" : "") + (tr ? " f3" : "") + '"' + (img ? ' style="background-image:url(&quot;' + img.replace(/"/g, "%22") + '&quot;)"' : "") + '></div><i class="ba-lueur' + (!regle && !tr ? " x2" : "") + '"></i><div class="ba-voile"></div>' +
    '<div class="ba-plans">' + p1 + p2 + p3 + "</div>" +
    '<div class="ba-s5">' + rappel + '<div class="ba-feux">' + feux + '</div></div><div class="ba-flash"></div><b class="ba-go' + (go.length > 14 ? " long" : "") + '">' + esc(go) + "</b>" +
    '<div class="ba-bande h"></div><div class="ba-bande b"></div><span class="ba-pause-i" aria-hidden="true">❚❚</span>' + (reduit ? '<span class="ba-aide">Touche l\'écran pour fermer</span>' : "") + '<button class="ba-passer" type="button">Passer ›</button>';
  document.body.appendChild(o);
  // V16.16 : seul « Passer » (ou Échap / retour) ferme ; en arrière-plan ou sur appui long (> 350 ms), arrêt sur image
  const pause3d = b => { try { if (GP_INST && GP_INST.api.pause) GP_INST.api.pause(b); } catch (e) { } }; pause3d(true);   // V16.17 : la 3D ne tourne pas sous la bande-annonce
  let fini = false, joue = 0, t0 = performance.now(), t = setTimeout(() => fermer(true), total), raf = 0, feu = 0, appui = 0;
  const raisons = new Set(), ecoule = () => joue + (raisons.size ? 0 : performance.now() - t0);
  // V16.75 · la musique de l'univers (sons.js), posée sur les vrais temps des plans ; figée avec l'image, coupée en fondu à la fermeture
  const S = typeof SONS !== "undefined" ? SONS : null, cleU = (window.Piste && Piste.TRACES && Piste.TRACES[ci] || {}).peint || "";
  const optM = { plans: [0].concat(regle ? [t2 * 1000] : [], tr ? [t3 * 1000] : []), tFeux: tFeux * 1000, tOut: tOut * 1000, reduit };
  let mus = S && S.musiqueBA ? S.musiqueBA(cleU, optM) : null;
  const pauser = r => { if (fini) return; if (!raisons.size) { joue += performance.now() - t0; clearTimeout(t); o.classList.add("pause"); if (mus) mus.pause(); } raisons.add(r); };
  const reprendre = r => { if (fini || !raisons.delete(r) || raisons.size) return; t0 = performance.now(); o.classList.remove("pause"); if (mus) mus.reprendre(); t = setTimeout(() => fermer(true), Math.max(300, total - joue)); };
  /* V16.75 · une petite astuce en haut (jamais sur le titre), qui part seule après 3 s, d'un toucher ailleurs, ou pour de bon avec ✕ :
     son coupé dans l'appli → bouton pour l'activer ; son bloqué par le navigateur → un toucher le réveille ; sinon, une seule fois : monter le volume */
  const memo = k => { try { return localStorage.getItem(k) === "1"; } catch (e) { return false; } }, retenir = k => { try { localStorage.setItem(k, "1"); } catch (e) { /* rien */ } };
  let astuce = null, tAst = 0;
  const oterAstuce = () => { clearTimeout(tAst); if (!astuce) return; const a = astuce; astuce = null; a.style.opacity = "0"; setTimeout(() => a.remove(), 260); };
  const reveiller = () => { if (S && S.bloque && S.bloque()) S.debloquer(ecoule()); };
  function montrerAstuce() {
    if (fini || !S) return;
    const cas = !S.actif() ? ["versus.astuceSon.coupe", "🔇 Son coupé", "Activer pour la musique"] : S.bloque && S.bloque() ? ["versus.astuceSon.bloque", "🔊 Touche pour la musique", ""] : ["versus.astuceVolume", "🎵 Monte le volume pour la musique", ""];
    if (memo(cas[0])) return; if (cas[0] === "versus.astuceVolume") retenir(cas[0]);   // celle-ci : une seule fois par appareil (le mode silencieux du téléphone ne se voit pas depuis le web)
    const a = astuce = document.createElement("div"); a.className = "ba-astuce"; a.setAttribute("role", "status");
    a.style.cssText = "position:absolute;z-index:9;top:max(6px,calc(3.5vh - 15px));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;max-width:calc(100% - 32px);padding:4px 4px 4px 12px;border-radius:999px;background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.28);font:600 12px/1.2 Saira,sans-serif;color:#fff;white-space:nowrap;transition:opacity .25s;cursor:pointer";
    const bt = "border:0;border-radius:999px;font:700 12px/1 Saira,sans-serif;cursor:pointer;padding:6px 9px;";
    a.innerHTML = "<span>" + cas[1] + "</span>" + (cas[2] ? '<button type="button" class="ba-astuce-ok" style="' + bt + 'background:' + st[0] + ';color:#000">' + cas[2] + "</button>" : "") +
      '<button type="button" class="ba-astuce-x" aria-label="Ne plus afficher" style="' + bt + 'background:transparent;color:rgba(255,255,255,.75)">✕</button>';
    ["pointerdown", "pointerup"].forEach(ev => a.addEventListener(ev, e => e.stopPropagation()));   // ni pause (appui long) ni fermeture (mode réduit)
    a.addEventListener("click", e => { e.stopPropagation();
      if (e.target.closest(".ba-astuce-x")) retenir(cas[0]);
      else if (e.target.closest(".ba-astuce-ok")) { S.basculer(true); if (!fini) mus = S.musiqueBA(cleU, Object.assign({}, optM, { depuis: ecoule() })); }
      else reveiller();
      oterAstuce(); });
    o.appendChild(a); tAst = setTimeout(oterAstuce, 3000);
  }
  setTimeout(montrerAstuce, 300);   // le temps que le navigateur dise si le son est bloqué
  o.addEventListener("pointerup", () => { reveiller(); oterAstuce(); });   // toucher ailleurs : l'astuce part, et le son se réveille s'il était bloqué
  // CHAQUE bip des feux suit l'horloge de l'image : figé avec elle (appui long, arrière-plan)
  const tic = () => { if (fini) return; const e = ecoule() / 1000;
    if (!reduit && feu < 6 && e >= (feu < 5 ? tFeux + feu * .25 : tOut)) { if (typeof SONS !== "undefined" && SONS.feuBA) SONS.feuBA(feu); feu++; }   // un bip par feu, puis le départ
    raf = requestAnimationFrame(tic); };
  raf = requestAnimationFrame(tic);
  const visib = () => { if (document.visibilityState === "hidden") pauser("cache"); else reprendre("cache"); };
  const clavier = e => { if (e.key === "Escape") fermer(true); };
  const bas = e => { if (e.target.closest(".ba-passer")) return; if (reduit) { fermer(true); return; } clearTimeout(appui); appui = setTimeout(() => pauser("appui"), 350); };
  const haut = () => { clearTimeout(appui); reprendre("appui"); };
  o.addEventListener("pointerdown", bas); ["pointerup", "pointercancel", "pointerleave"].forEach(ev => o.addEventListener(ev, haut)); o.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("visibilitychange", visib); document.addEventListener("keydown", clavier);
  function fermer(lancer) { if (fini) return; fini = true; clearTimeout(t); clearTimeout(appui); cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visib); document.removeEventListener("keydown", clavier);
    clearTimeout(tAst); if (mus) mus.arreter(.3);   // V16.75 : fondu de 0,3 s sur la musique
    if (feu > 0 && feu < 6 && typeof SONS !== "undefined" && SONS.arreter) SONS.arreter();   // « Passer » en plein milieu des feux : on coupe le son
    BA_OUVERTE = null; pause3d(false); o.classList.add("fin"); setTimeout(() => o.remove(), 450); if (lancer && ensuite) setTimeout(ensuite, 250); }
  o.querySelector(".ba-passer").addEventListener("click", e => { e.stopPropagation(); fermer(true); });
  BA_OUVERTE = { fermer };
}
/* ---------- v20.62 (Théo) · 🎥 TOUR DE PRÉSENTATION : avant les feux, la caméra prend ~15-20 s pour savourer le décor (Piste.presentation),
   puis descend sur la grille. Joué au 1er départ de chaque circuit dans une ouverture de l'appli ; jamais quand on rejoue (↻) ensuite, ni en
   « réduire les animations », ni si le téléphone a déjà peiné. Un toucher ou « Passer › » saute aux feux. Le bouton 🎥 le rejoue à la demande
   (il remplace l'ancien « Survol guidé ») et rend la main à la vue d'avant. ---------- */
const GP_PRES_VUS = new Set();
let GP_PRES = null, GP_PRES_RAME = false;   // GP_PRES = { api, ov, ensuite } ; GP_PRES_RAME : le tour a ramé une fois → plus de tour automatique
function tourPresentation(api, ci, ensuite, force) {
  const suite = () => { if (ensuite) ensuite(); };
  if (!api || !api.presentation || (!force && (GP_PRES_VUS.has(ci) || reduit || GP_PRES_RAME))) { suite(); return false; }
  if (GP_PRES) annulerPresentation();
  const G = GPS[ci] || {}, ov = document.createElement("div"); ov.className = "gp-pres"; ov.setAttribute("role", "region"); ov.setAttribute("aria-label", "Tour de présentation");
  ov.innerHTML = '<p class="gp-pres-t"><span aria-hidden="true">🎥</span> Tour de présentation<small>' + esc(G.ville || "") + '</small></p><button type="button" class="gp-pres-x" aria-label="Passer le tour de présentation">Passer ›</button>';
  const P = GP_PRES = { api, ov, ensuite, fini: false };
  const fin = info => { if (P.fini) return; P.fini = true; if (GP_PRES === P) GP_PRES = null; ov.classList.add("fin"); document.querySelectorAll("#gp-piste.en-pres").forEach(x => x.classList.remove("en-pres")); setTimeout(() => ov.remove(), 300); if (info && info.rame) GP_PRES_RAME = true; suite(); };
  let d = 0; try { d = api.presentation({ fin, mode: force ? "vue" : "grille" }); } catch (e) { d = 0; }
  if (!d) { GP_PRES = null; suite(); return false; }
  P.duree = d; GP_PRES_VUS.add(ci);
  ov.addEventListener("pointerdown", ev => { ev.stopPropagation(); }); ov.addEventListener("click", ev => { ev.stopPropagation(); passerPresentation(); });
  placerOverlayPres(document);
  return true;
}
/** le voile du tour se pose sur le dessin seulement (pas sur les sous-titres) ; têtes des pilotes cachées pendant le tour */
function placerOverlayPres(racine) { const P = GP_PRES; if (!P) return; const sc = racine.querySelector("#gp-scene"), pi = racine.querySelector("#gp-piste");
  (sc || pi || document.body).appendChild(P.ov); if (pi) pi.classList.add("en-pres"); }
function passerPresentation() { const P = GP_PRES; if (P && P.api.passerPresentation) P.api.passerPresentation(); }
/** la piste a été démontée (autre vue, autre mois) : le tour s'arrête sans lancer la course */
function annulerPresentation() { const P = GP_PRES; if (!P) return; GP_PRES = null; P.fini = true; P.ov.remove(); document.querySelectorAll("#gp-piste.en-pres").forEach(x => x.classList.remove("en-pres")); }
/** 🎥 le bouton : rejoue le tour à la demande (pas pendant une course) */
function boutonPresentation() {
  const api = GP_INST && GP_INST.api, pi = document.getElementById("gp-piste"); if (!api || !pi) return;
  if (api.enCours()) { toast("Attends la fin de la course pour le tour de présentation."); return; }
  if (GP_PRES) { passerPresentation(); return; }
  document.querySelectorAll("details.gp-plus[open]").forEach(d => d.open = false);
  if (!tourPresentation(api, pi.dataset.circuit, null, true)) toast("Pas de tour de présentation pour ce circuit.");
}
let GP_RELANCES = 0, GP_DIRECT_VU = "";   // audit B6 : relances automatiques du circuit 3D après une coupure du navigateur
/* v20.53 (Théo : écran noir puis lag en arrivant sur le Podium) · en passant d'un onglet à l'autre, la page s'affiche D'ABORD avec la carte cuite
   déjà décodée posée au bon endroit, puis, à l'image suivante, le dessin animé (ou la 3D) est monté ou raccroché par-dessus, à l'identique */
let GP_DIFFERER = false;
function fondImmediatGP(v) {
  try { const pi = v.querySelector("#gp-piste"), sc = v.querySelector("#gp-scene"); if (!pi || !sc || !pi.classList.contains("en2d") || !window.Piste || !Piste.fond2D) return;
    const f = Piste.fond2D(pi.dataset.circuit, sc.clientWidth, sc.clientHeight); if (!f) return;
    sc.style.backgroundColor = f.couleur; sc.style.backgroundImage = f.image; sc.style.backgroundSize = f.taille; sc.style.backgroundPosition = f.position; sc.style.backgroundRepeat = "no-repeat"; } catch (e) { /* le fond « cover » reste */ }
}
function brancherGP(v, y) {
  fondImmediatGP(v);
  if (GP_DIFFERER) { GP_DIFFERER = false; const pi = v.querySelector("#gp-piste");
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!(pi && pi.isConnected && v.querySelector("#gp-piste") === pi)) return;
      if (VUE_AFFICHEE !== "trophees") { delete VUES_FAITES.trophees; return; }   // Podium déjà quitté : rien ne démarre en coulisses ; il sera redessiné au retour
      brancherGP0(v, y); reveillerGP(); })); return; }   // à l'image d'après : la 1re est déjà peinte
  brancherGP0(v, y);
}
function brancherGP0(v, y) {
  const etapes = etapesGP(y), i = GP_ETAPE !== null && GP_ETAPE < etapes.length ? GP_ETAPE : etapeParDefaut(etapes, y), et = etapes[i];
  const pi = v.querySelector("#gp-piste"), scene = v.querySelector("#gp-scene"); if (!pi || !scene) return;
  if (!window.Piste) { scene.innerHTML = '<p class="gp-nopiste">Circuit indisponible : recharge l\'appli.</p>'; return; }
  const c = championnat(y), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), deux = pi.classList.contains("en2d"), qui = quiEcurie();
  const DM = GP_DEMO && demoPossible(et, courseDirect(etapes, i, kGP)) ? GP_DEMO : null;   // v20.52 : 🎬 course de démonstration (météo tirée au hasard)
  const amb = (equipDe(qui) || {}).circuit || "classique", met = DM ? DM.meteo.id : meteoMois(et.k || (!et.m ? kGP : null)).id, at = atoutsVus(kGP), vs = voituresGP(), vue = vueGP(ci);
  if (window.SONS && SONS.meteo) SONS.meteo(met);   // v20.53 : la pluie et l'orage s'entendent (musique un peu plus sourde)
  const cle = [ci, met, amb, deux ? "2d" : "3d", JSON.stringify(vs), at ? at.atout.id : "", couleurAccent()].join("|");
  if (GP_INST && GP_INST.cle === cle) { scene.appendChild(GP_INST.boite); GP_INST.api.redim(); }
  else {
    annulerPresentation();   // v20.62 : la piste change : le tour en cours s'arrête (la course ne part pas en coulisses)
    if (GP_INST) { try { GP_INST.api.detruire(); } catch (e) { } GP_INST.boite.remove(); GP_INST = null; }
    const boite = document.createElement("div"); boite.className = "gp-rendu"; scene.appendChild(boite);
    const focus = vue === "poursuite" ? suiviGP() : ETAT.gpFocus && D.personnes.some(p => p.nom === ETAT.gpFocus) ? ETAT.gpFocus : (qui && D.personnes.some(p => p.nom === qui) ? qui : D.personnes[0].nom);
    const api = Piste.monter(boite, { circuit: ci, meteo: met, effets: true, ambiance: amb, mode: deux ? "2d" : "3d", camera: vue === "poursuite" ? "poursuite" : camGP(), sansVoitures: vue === "visite", tour: TOUR_GP, voitures: vs, pts: et.pts, focus,
      atoutCol: at ? "#3DDC97" : null, piegeCol: null, accent: couleurAccent(), titre: GPS[ci].gp + ", " + GPS[ci].ville, portrait: n => avatarCourse(n),   // v20.59 (relecture jeu-joueur) + v20.61 (Théo : en course, toujours le visage, jamais le casque de l'écurie) : la même tête que partout (accessoire du mois en cours, ou accessoire mérité), plus un 2e costume du même univers
      image: etiquettesGP, toucher: n => { if (vueGP(ci) === "poursuite") { suivreGP(n); return; } ETAT.gpFocus = n; garder(); if (GP_INST) GP_INST.api.focus(n); toast("👀 " + n + " est mis en avant."); },
      perdu: () => { if (GP_INST && GP_INST.boite === boite) GP_INST = null;   // audit B6 : circuit coupé par le navigateur → on le relance (2 fois au plus)
        if (GP_RELANCES < 2 && typeof rendreTrophees === "function") { GP_RELANCES++; setTimeout(() => { if (boite.isConnected && !document.hidden) rendreTrophees(); }, 400); } } });
    GP_INST = { cle, api, boite };
    if (api.type === "2d" && !deux) { pi.classList.add("en2d"); const cb = pi.querySelector("#gp-cam-b"); if (cb) cb.remove(); }
  }
  // V16.10 · une manche par mois : grille de départ dans l'ordre du classement d'avant le mois ; le meilleur du mois boucle exactement un tour
  if (vue && vue !== "2d") appliquerVue3(GP_INST.api, vue);
  const api = GP_INST.api, mc = mancheGP(etapes, i, kGP), SC = i > 0 && !et.avenir && et.m && api.jouerScenario ? scenarioCourse(mc) : null;
  const DR = SC ? null : courseDirect(etapes, i, kGP);   // v20.47 : la course en direct (tour 1, le peloton avance avec le mois et le S&P)
  const demoVive = !!(DM && DM.enCours && !DM.lance && api.enCours());   // v20.52 : page redessinée sur la même piste pendant la démo : elle continue
  if (DM && DM.enCours && !DM.lance && !demoVive) { DM.enCours = false; GP_HORLOGE = null; GP_COM.forEach(clearTimeout); GP_COM = []; }   // autre piste (vue changée) : la démo s'arrête, retour sur la grille
  if (!demoVive) { GP_SCEN = SC; GP_GRILLE = SC || DR ? null : mc.grille; if (api.regler) api.regler({ tour: SC || DR ? 1 : mc.tour, grille: SC || DR ? null : mc.grille }); }   // v17.8 : en course scénarisée, les écarts viennent tous du scénario   // v16.28 : en course scénarisée, les distances sont en tours
  const pDep = SC ? SC.scen(0) : DR ? DR.dep : mc.depart, pArr = SC ? SC.scen(1) : DR ? DR.pts : mc.arrivee;
  const cleVu = "versus.gpVu." + y, vu = +(stock.get(cleVu) || 0);
  // V16.16 : la manche n'est marquée « vue » qu'à l'arrivée (quitter pendant la bande-annonce ou la course ne la fait plus perdre)
  // V16.17 : un seul départ — après la bande-annonce (qui finit sur les 5 feux), la course part sans refaire les feux
  const finCourse = () => { setTimeout(majPauseGP, 0); if (window.SONS && et.m) { const v1 = et.m.l.slice().sort((a, b) => a.rg - b.rg)[0]; if (v1) SONS.arrivee(saisonVisible() && !estChauffe(y) ? equipDe(v1.nom).klaxon : "fanfare", v1.nom === ETAT.moi, (Piste.TRACES[ci] || {}).peint); }   // V16.43 : la foule et le klaxon du vainqueur
    if (et.k && !et.avenir && et.k > +(stock.get(cleVu) || 0)) stock.set(cleVu, String(et.k)); bullesGP(y, i); commenter(y, i, -1);
    if (et.k === CHAUFFE_K && estChauffe(y)) setTimeout(() => ereApres(() => verifierFeteChauffe(true), "chauffeFete"), 3200); };   // v17.49 : course de chauffe regardée + manche définitive → le vainqueur à l'honneur
  const jouer = (feux, sansTour) => { if (vueGP(ci) === "visite" && api.type === "3d") choisirVueGP("poursuite", y);   // v17.6 : la Visite n'a pas de voitures : la course se regarde en 🚁 Hélico
    if (!DR && !sansTour) { tourPresentation(api, ci, () => { if (GP_INST && GP_INST.api === api && !api.enCours()) jouer(feux, true); }); return; }   // v20.62 : 🎥 d'abord le tour de présentation (1re fois)
    if (DR) { const d = api.type === "3d" ? 4200 : 3000; GP_HORLOGE = { t0: performance.now(), pauses: 0, pause: 0, total: d, feux: 0, cle: null, son: false }; api.jouer(DR.dep, DR.pts, d, () => { majPauseGP(); if (window.SONS && SONS.repriseCourse) SONS.repriseCourse(); }, false); majPauseGP(); return; }   // v20.47 : le mois jusqu'à aujourd'hui, en accéléré, sans feux ni moteurs
    const f = feux !== false && i >= 1 && api.type === "3d", d = SC ? (api.type === "3d" ? 17000 : 12000) : api.type === "3d" ? 6400 : 3000, cleS = (Piste.TRACES[ci] || {}).peint;
    GP_HORLOGE = { t0: performance.now(), pauses: 0, pause: 0, total: d + (f ? 3200 : 0), feux: f ? 3200 : 0, cle: cleS, son: true };
    commenter(y, i, d + (f ? 3200 : 0), f ? 3200 : 0); if (window.SONS) SONS.course(d, f ? 3200 : 0, cleS);   // V16.43 : feux, moteurs ; v17.48 : + le thème du circuit (v20.53 : chaque circuit)
    if (SC) api.jouerScenario(SC.scen, d, finCourse, f); else api.jouer(mc.depart, mc.arrivee, d, finCourse, f); majPauseGP(); };
  const apresBA = () => { if (GP_INST && GP_INST.api === api && document.body.contains(GP_INST.boite)) jouer(false, true); };   // v20.62 : la bande-annonce finit sur les feux : la course part tout de suite (le tour de présentation passe AVANT la bande-annonce)   // v16.27 : piste reconstruite entre-temps : on ne lance rien
  const presVive = !!(GP_PRES && GP_PRES.api === api);   // v20.62 : page redessinée pendant le tour de présentation : il continue (rien ne se relance)
  if (presVive) placerOverlayPres(v);
  else if (GP_REJOUER && i > 0 && !et.avenir) { GP_REJOUER = false; setTimeout(jouer, 150); }
  else if (!et.avenir && et.k && et.k > vu && i > 0) { api.placer(pDep); if (!BA_OUVERTE) setTimeout(() => ereApres(() => { if (!BA_OUVERTE && !GP_PRES) tourPresentation(api, ci, () => { if (!BA_OUVERTE && GP_INST && GP_INST.api === api) bandeAnnonce(y, i, apresBA); }); }, "ba"), 300); }   // v20.62 : 🎥 tour de présentation, puis la bande-annonce (qui finit sur les feux)   // v16.93 : ereApres = après la scène du premier million
  else { const kBA = et.k || 0, cleBA = "versus.baVu." + y, baDue = et.avenir && kBA && kBA > +(stock.get(cleBA) || 0), cleDir = DR ? kGP + "|" + DR.dv.j : "";
    if (DR && GP_DIRECT_VU !== cleDir && !api.enCours() && !(vueGP(ci) === "visite" && api.type === "3d")) { GP_DIRECT_VU = cleDir; api.placer(DR.dep);   // v20.47 : en arrivant, le peloton refait le mois jusqu'à aujourd'hui (une fois par jour et par visite)
      if (baDue) { stock.set(cleBA, String(kBA)); setTimeout(() => ereApres(() => bandeAnnonce(y, i, apresBA), "ba"), 400); } else setTimeout(() => { if (GP_INST && GP_INST.api === api && !api.enCours()) jouer(false); }, 450); }
    else { if (!api.enCours()) api.placer(pArr); if (baDue) { stock.set(cleBA, String(kBA)); setTimeout(() => ereApres(() => bandeAnnonce(y, i, null), "ba"), 400); } } }
  GP_REJOUER = false;
  if (DM && DM.lance) { DM.lance = false; setTimeout(() => { if (vueGP(ci) === "visite" && api.type === "3d") choisirVueGP("poursuite", y);
    tourPresentation(api, ci, () => { if (GP_INST && GP_INST.api === api && GP_DEMO === DM) jouerDemo(y, api, mc, ci); }); }, 250); }   // v20.52 : 🎬 la démo part une fois la piste montée avec sa météo (v20.62 : après le tour de présentation, la 1re fois)   // v20.52 : 🎬 la démo part une fois la piste montée avec sa météo
  const dm = v.querySelector("#gp-demo"); if (dm) dm.addEventListener("click", lancerDemo);
  const vu3 = v.querySelector("#gp-vue"); if (vu3) vu3.addEventListener("click", () => { const vers3d = pi.classList.contains("en2d"); ETAT.gp2d = vers3d ? "0" : "1"; garder(); rendreTrophees(); if (vers3d && !TRESOR_APERCU && !stock.get("versus.aideVisite")) { stock.set("versus.aideVisite", "1"); setTimeout(() => { toast("🧭 Visite 3D : glisse pour tourner, vers le haut ou le bas pour incliner, pince pour zoomer, deux doigts pour te déplacer. 🎥 Tour de présentation (menu ⋯) : la visite guidée du décor."); try { if (GP_INST && GP_INST.api.type === "3d" && !GP_INST.api.enCours() && !reduit) tourPresentation(GP_INST.api, ci, null, true); } catch (e) { } }, 900); } });
  v.querySelectorAll("#gp-tourp").forEach(b => b.addEventListener("click", boutonPresentation));   // v20.62 : 🎥 tour de présentation (remplace « Survol guidé »)
  const cb = v.querySelector("#gp-cam-b"); if (cb) cb.addEventListener("click", () => { const l = ["tv", "helico", "bord"], n = l[(l.indexOf(camGP()) + 1) % l.length]; ETAT.gpCam = n; garder(); if (GP_INST) GP_INST.api.camera(n); majBoutonsGP(); });
  const rj = v.querySelector("#gp-rejouer"); if (rj) rj.addEventListener("click", () => { if (GP_PRES) { passerPresentation(); return; } if (i > 0 && !et.avenir || DR) jouer(); else toast(et.avenir ? "Cette manche se court ce mois-ci : la course se joue dès que tout le monde a saisi son relevé." : "Le départ n'a pas encore eu lieu : choisis un mois."); });
  const fb = v.querySelector("#gp-fin"); if (fb) fb.addEventListener("click", () => { if (GP_PRES) { passerPresentation(); return; } if (GP_DEMO && GP_DEMO.enCours && GP_INST && GP_INST.api === api && api.enCours()) { api.placer(GP_DEMO.scen(1)); if (window.SONS && SONS.repriseCourse) SONS.repriseCourse(); GP_DEMO.finir(); return; }   // v20.52 : ⏭ pendant la démo   // v20.62 : pendant le tour de présentation, ⏭ le saute
    if (api.enCours()) { api.placer(pArr); GP_HORLOGE = null; if (window.SONS && SONS.repriseCourse) SONS.repriseCourse(); if (DR) majPauseGP(); else finCourse(); } else toast(i > 0 && !et.avenir ? "La course est déjà arrivée : ↻ Rejouer pour la revoir." : "Pas encore de course pour ce mois-ci."); });
  const pl = v.querySelector("#gp-plein"); if (pl) pl.addEventListener("click", () => ouvrirPleinGP(y));
  const pz = v.querySelector("#gp-pause"); if (pz) pz.addEventListener("click", () => basculerPauseGP());   // v20.47
  const ph = v.querySelector("#gp-photo"); if (ph) ph.addEventListener("click", () => { const d = ph.closest("details"); if (d) d.open = false; modePhotoGP(true, y); });
  const plg = v.querySelector("#gp-plein-gros"); if (plg) plg.addEventListener("click", () => ouvrirPleinGP(y));   // v17.6
  v.querySelectorAll(".gp-vues2 [data-gpv]").forEach(b => b.addEventListener("click", () => choisirVueGP(b.dataset.gpv, y)));
  v.querySelectorAll("[data-suivre]").forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); suivreGP(b.dataset.suivre); }));
  const bb = v.querySelector("#gp-ba"); if (bb) bb.addEventListener("click", () => { const j = i > 0 && !et.avenir; if (j) api.placer(pDep); bandeAnnonce(y, i, j ? apresBA : null); });
  const cp = v.querySelector("#gp-carte"); if (cp) cp.addEventListener("click", () => cartePostale(y, et));
  v.querySelectorAll(".gp-mois [data-gpe]").forEach(b => b.addEventListener("click", () => { GP_ETAPE = +b.dataset.gpe; GP_REJOUER = true; rendreTrophees(); }));
  const cal = v.querySelector("#gp-calend"); if (cal) cal.addEventListener("toggle", () => { ETAT.calOuvert = cal.open ? "1" : "0"; garder(); });
  GP_ETQ = null; majPauseGP();
  if (GP_PLEIN) placerPlein(y);
  chargerTickets(); poserTabletteDOM(document);   // v20.47 : 🎫 la tablette du jour (Chocolaterie, octobre 2027)
  if (typeof poserMJDOM === "function") { chargerMJ(); poserMJDOM(); majPastilleMJ(); }   // 🎲 la carte du mini-jeu du mois (js/9-minijeux.js)
  chargerTresors(); poserTresorDOM(GP_PLEIN ? document : v);   // v17.55 : en plein écran la piste a été déplacée dans la fenêtre (énigme absente en Carte plein écran)
  etiquettesGP(api);
}
/** V15.5 · Nouvelle manche courue mais pas encore regardée : un bandeau dans le Classement */
function bandeauNouvelleManche() {
  if (typeof D === "undefined" || !D || !saisonVisible()) return "";
  const y = saisonCourante(); if (!y) return "";
  const c = championnat(y), m = c.mois[c.mois.length - 1]; if (!m || +(stock.get("versus.gpVu." + y) || 0) >= m.k) return "";
  const g = GPS[circuitDe(m.k)], x = m.l.slice().sort((a, b) => a.rg - b.rg)[0], moi = m.l.find(z => z.nom === moiPilote());
  return '<button class="nv-manche" type="button" data-nv-manche="' + y + '"><span class="nm-drap">' + g.drap + '</span><span class="nm-t"><b>Nouvelle manche : ' + esc(g.ville) + "</b><small>" + esc(moisLong(m.k)) + " · vainqueur " + esc(x ? x.nom : "—") + (moi ? " · toi : " + (moi.p >= 0 ? "+" : "") + moi.p + " pt" + (Math.abs(moi.p) > 1 ? "s" : "") : "") + '</small></span><span class="nm-go">🏁 Course</span></button>';
}
function majBoutonsGP() { document.querySelectorAll("#gp-cam-b").forEach(b => b.textContent = CAMS[camGP()]); }
/* ---------- Plein écran : la même piste, déplacée dans une couche qui couvre tout l'écran ---------- */
function ouvrirPleinGP(y) {
  if (GP_PLEIN) return;
  const o = document.createElement("div"); o.className = "gp-plein"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Circuit en plein écran");
  o.innerHTML = '<div class="gpp-corps"></div><div class="gpp-h"><div class="gpp-t"></div><button class="gpp-x gpp-rj" type="button" aria-label="Revoir la course">↻ Revoir</button><button class="gpp-x" type="button" aria-label="Fermer le plein écran">✕</button></div><div class="gpp-tour"></div><div class="gpp-mois"></div>';
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  GP_PLEIN = { o, y, ancre: null, maj: 0 };
  o.querySelector('.gpp-x:not(.gpp-rj)').addEventListener("click", fermerPleinGP);
  // V15.6 : rejouer la course sans quitter le plein écran (même action que « Rejouer » sous la piste)
  o.querySelector(".gpp-rj").addEventListener("click", () => { const rj = document.getElementById("gp-rejouer") || document.getElementById("gp-demo"); if (rj) rj.click(); else toast("Choisis d'abord un mois couru."); });
  GP_PLEIN.esc = e => { if (e.key === "Escape") { if (GP_PLEIN && GP_PLEIN.photo) modePhotoGP(false); else fermerPleinGP(); } }; document.addEventListener("keydown", GP_PLEIN.esc);
  const pi0 = document.getElementById("gp-piste"); if (pi0 && pi0.classList.contains("v2")) pleinV2(o, y);
  placerPlein(y);
}
/* v17.6 · plein écran « V2 » : rien que la piste, un petit sélecteur de vue, ▶ et ✕ ; vrai plein écran + paysage quand le téléphone le permet */
function pleinV2(o, y) {
  const P = GP_PLEIN; P.v2 = true; o.classList.add("v2");
  /* Théo, 19/11 : [Carte | Visite | Hélico] puis ▶ ⏭ ✕, ronds et en icônes seules ; v20.62 : 🎥 tour de présentation à la place du segment « Survol » */
  o.insertAdjacentHTML("beforeend", '<div class="gpp-bar">' + selVuesGP(vueGP(document.getElementById("gp-piste").dataset.circuit), "mini") +
    '<button class="gpp-b gpp-son" type="button" data-son aria-label="Couper le son">🔊</button><button class="gpp-b gpp-tourp" type="button" aria-label="Tour de présentation" title="Tour de présentation">🎥</button><button class="gpp-b gpp-pause" type="button" aria-label="Mettre la course en pause" hidden>⏸\uFE0F Pause</button><button class="gpp-b gpp-play gpp-texte" type="button" aria-label="Revoir la course" title="Revoir">↻ Revoir</button><button class="gpp-b gpp-fin" type="button" aria-label="Aller à l\'arrivée" title="Aller à l\'arrivée" hidden>⏭</button><button class="gpp-b gpp-photo" type="button" aria-label="Mode photo : cacher toute l\'interface" title="Mode photo">📷</button><button class="gpp-b gpp-fermer" type="button" aria-label="Fermer le plein écran">✕</button></div>' +
    '<div class="gpp-tourne" hidden><b>📱↻</b> Tourne ton téléphone<br><small>pour voir le circuit en grand</small></div>');
  o.querySelectorAll(".gpp-bar [data-gpv]").forEach(b => b.addEventListener("click", () => { if (GP_PRES) passerPresentation(); choisirVueGP(b.dataset.gpv, y); }));
  o.querySelector(".gpp-tourp").addEventListener("click", boutonPresentation);   // v20.62
  o.querySelector(".gpp-play").addEventListener("click", () => { const rj = document.getElementById("gp-rejouer") || document.getElementById("gp-demo"); if (rj) rj.click(); });   // v20.52 : avant le 1er décembre, ↻ lance la 🎬 démo
  majPlayPlein();
  o.querySelector(".gpp-pause").addEventListener("click", () => basculerPauseGP());   // v20.47
  o.querySelector(".gpp-photo").addEventListener("click", () => modePhotoGP(true, y));
  [["gpp-fin", "gp-fin"]].forEach(([c, id]) => { const b = o.querySelector("." + c); if (b) b.addEventListener("click", () => { const x = document.getElementById(id); if (x) x.click(); }); });   // v17.12 (Théo) : arrivée et survol aussi en plein écran
  o.querySelector(".gpp-fermer").addEventListener("click", fermerPleinGP);
  const rq = o.requestFullscreen || o.webkitRequestFullscreen;
  const paysage = () => { try { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock("landscape").then(() => true, () => false); } catch (e) { } return Promise.resolve(false); };
  const conseil = ok => { if (ok || GP_PLEIN !== P) return; const portrait = matchMedia("(orientation: portrait)").matches, t = o.querySelector(".gpp-tourne"); if (!portrait || !t) return;
    t.hidden = false; const cacher = () => { t.classList.add("fin"); setTimeout(() => { t.hidden = true; }, 400); }; setTimeout(cacher, 3500); P.mq = matchMedia("(orientation: portrait)"); P.mqf = () => { if (!P.mq.matches) cacher(); }; try { P.mq.addEventListener("change", P.mqf); } catch (e) { } };
  // on sort du vrai plein écran (bouton retour, geste, Échap) : on referme aussi la couche ; petit délai pour laisser passer un éventuel « retour » (popstate) qui la fermerait déjà
  P.fsc = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) setTimeout(() => { if (GP_PLEIN === P) fermerPleinGP(); }, 250); };
  if (rq) { try { const r = rq.call(o, { navigationUI: "hide" }); P.natif = true; document.addEventListener("fullscreenchange", P.fsc); document.addEventListener("webkitfullscreenchange", P.fsc);
    Promise.resolve(r).then(() => paysage(), () => { P.natif = false; return false; }).then(conseil); } catch (e) { P.natif = false; conseil(false); } }
  else conseil(false);   // iPhone : pas de plein écran natif → la couche fixe couvre l'écran, et on propose de tourner le téléphone
}
function placerPlein(y) {
  const P = GP_PLEIN; if (!P) return;
  const pi = document.querySelector(".saison #gp-piste") || document.getElementById("gp-piste"); if (!pi) { fermerPleinGP(); return; }
  const corps = P.o.querySelector(".gpp-corps");
  if (GP_INST && GP_INST.api.zoom2D) GP_INST.api.zoom2D(true);   // v17.10 : la carte 2D se zoome et se déplace en plein écran
  if (pi.parentNode !== corps) {
    corps.querySelectorAll(".gp-piste").forEach(x => x.remove());
    P.ancre = document.createElement("div"); P.ancre.className = "gp-ancre"; pi.parentNode.insertBefore(P.ancre, pi); corps.appendChild(pi);
  }
  const h = document.querySelector(".saison .gp-h"), t = h ? h.querySelector(".gp-titre") : null, k = h ? h.querySelector(".s-k") : null;
  P.o.querySelector(".gpp-t").innerHTML = "<b>" + (t ? t.innerHTML : "") + "</b><small>" + (k ? k.innerHTML : "") + "</small>"; majPlayPlein();
  const ch = document.querySelector(".saison .gp-mois"); P.o.querySelector(".gpp-mois").innerHTML = ch ? ch.outerHTML : "";
  P.o.querySelectorAll(".gpp-mois [data-gpe]").forEach(b => b.addEventListener("click", () => { GP_ETAPE = +b.dataset.gpe; GP_REJOUER = true; rendreTrophees(); }));
  const sel = P.o.querySelector('.gpp-mois [aria-pressed="true"]'); if (sel && !P.v2) sel.scrollIntoView({ inline: "center", block: "nearest" });
  if (P.v2) { majVueDOM(vueGP(pi.dataset.circuit));
    if (window.SONS && SONS.ambiance) SONS.ambiance((Piste.TRACES[pi.dataset.circuit] || {}).peint); }   // v17.59 : l'ambiance douce du circuit (v20.53 : chaque circuit a la sienne)
  GP_ETQ = null;
  if (GP_INST) { GP_INST.api.redim(); majTourPlein(GP_INST.api.courant(), true); }
}
function majTourPlein(cur, force) {
  const P = GP_PLEIN; if (!P) return; const now = performance.now(); if (!force && now - P.maj < 150) return; P.maj = now;
  const qui = quiEcurie(), ordre = Object.keys(cur).sort((a, b) => cur[b] - cur[a]), t = cur[ordre[0]] || 0, box = P.o.querySelector(".gpp-tour");
  if (force || !P.lignes || P.lignes.cle !== ordre.slice().sort().join("|")) {
    box.innerHTML = Object.keys(cur).map(n => '<div class="r' + (n === qui ? " ici" : "") + '" data-tr="' + esc(n) + '" style="--c:' + couleur(n) + '"><span class="rk"></span>' + avatarCourse(n) + '<span class="n">' + esc(n) + '</span><span class="p"><b></b><small></small></span></div>').join("");
    P.lignes = { cle: ordre.slice().sort().join("|"), m: {} }; box.querySelectorAll("[data-tr]").forEach(e => P.lignes.m[e.dataset.tr] = { e, rk: e.querySelector(".rk"), b: e.querySelector(".p b"), s: e.querySelector(".p small"), v: "" });
  }
  const pt = n => GP_SCEN ? Math.round((GP_SCEN.gains[n] || 0) * clampN(cur[n] / TOURS_GP, 0, 1)) : Math.round(cur[n]), pT = GP_SCEN ? Math.max(...ordre.map(pt)) : Math.round(t);   // v16.28
  ordre.forEach((n, r) => { const l = P.lignes.m[n]; if (!l) return; const v = r + "|" + pt(n) + "|" + (pT - pt(n)); if (v === l.v) return; l.v = v;
    l.e.style.order = r; l.rk.textContent = r + 1; l.b.textContent = pt(n); l.s.textContent = r ? "−" + (pT - pt(n)) : "en tête du mois"; });
}
function fermerPleinGP() {
  const P = GP_PLEIN; if (!P) return; if (P.photo) modePhotoGP(false); GP_PLEIN = null;
  if (window.SONS && SONS.ambiance) SONS.ambiance(null);   // v17.59 : l'ambiance s'efface en fondu
  const pi = P.o.querySelector(".gp-piste");
  if (pi && P.ancre && P.ancre.isConnected) P.ancre.replaceWith(pi); else if (P.ancre) P.ancre.remove();
  document.removeEventListener("keydown", P.esc);
  if (P.v2) { document.removeEventListener("fullscreenchange", P.fsc); document.removeEventListener("webkitfullscreenchange", P.fsc); if (P.mq && P.mqf) try { P.mq.removeEventListener("change", P.mqf); } catch (e) { }
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { }
    try { const fe = document.fullscreenElement || document.webkitFullscreenElement; if (fe) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => { }); } catch (e) { } }
  P.o.remove(); document.documentElement.classList.remove("fige"); GP_ETQ = null;
  if (GP_INST && GP_INST.api.zoom2D) GP_INST.api.zoom2D(false);
  if (GP_INST) GP_INST.api.redim();
}

/* ---------- v16.81 · ADMIN : visite des circuits 2027 (2D, hélico 3D, Visite rapprochée), sans attendre le mois ni la saison ---------- */
function ouvrirCircuits2027(ci0) {
  if (!apercuAutorise()) return;   // v20.40 : double sécurité (en plus du bouton réservé à l'admin)
  const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const liste = [["abudhabi", "Chauffe · déc. 26"]].concat(CAL_GP.map((c, i) => [c, MOIS_C[i] + " 27"]));
  let ci = ci0 || liste[0][0], vue = "2d", api = null;
  const o = document.createElement("div"); o.className = "regles circ-gal"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Circuits 2027");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>🗺️ Circuits 2027 · aperçu admin</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div>' +
    '<div class="cg-chips">' + liste.map(([c, m]) => '<button type="button" class="chip" data-cg="' + c + '">' + (GPS[c] ? GPS[c].drap + " " : "") + esc(m) + "</button>").join("") + "</div>" +
    '<div class="cg-t"></div><div class="cg-vues"><button type="button" class="chip" data-cgv="2d">🗺️ Carte 2D</button><button type="button" class="chip" data-cgv="3d">🚁 Hélico 3D</button><button type="button" class="chip" data-cgv="visite">🔎 Visite rapprochée</button></div>' +
    '<div class="cg-scene"></div><p class="info">Aperçu seulement : rien n\'est enregistré. En 3D, fais glisser pour tourner, pince pour zoomer.</p></div>';
  document.body.appendChild(o);
  const scene = o.querySelector(".cg-scene");
  const monter = () => {
    if (api) { try { api.detruire(); } catch (e) { } api = null; } scene.innerHTML = "";
    o.querySelectorAll("[data-cg]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cg === ci)));
    o.querySelectorAll("[data-cgv]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cgv === vue)));
    const G = GPS[ci] || {}; o.querySelector(".cg-t").innerHTML = "<b>" + esc(G.gp || ci) + "</b> · " + esc(G.ville || "");
    if (!window.Piste) return;
    const boite = document.createElement("div"); boite.className = "cg-rendu"; scene.appendChild(boite);
    const vs = voituresGP(), pts = Object.fromEntries(D.personnes.map(p => [p.nom, 0]));
    api = Piste.monter(boite, { circuit: ci, meteo: "soleil", mode: vue === "2d" ? "2d" : "3d", camera: "helico", tour: 0, voitures: vs, pts, focus: vs[0] && vs[0].nom, accent: couleurAccent(),
      titre: (G.gp || ci), portrait: n => { const pk = (Piste.TRACES[ci] || {}).peint, k = ci === "abudhabi" ? "noel" : ACCESSOIRES_TETE[pk] ? pk : undefined; return avatar(n, Object.assign({}, equipDe(n), k ? { acc: k } : {}, { pilote: "tete", fond: "couleur" })); } });   // v20.59 : aperçu admin (v20.61 : le visage, jamais le casque) = l'accessoire du mois de ce circuit
    if (vue === "visite" && api && api.viser) setTimeout(() => { try { api.viser(null, .3, .38); } catch (e) { } }, 300);
  };
  o.querySelectorAll("[data-cg]").forEach(b => b.addEventListener("click", () => { ci = b.dataset.cg; monter(); }));
  o.querySelectorAll("[data-cgv]").forEach(b => b.addEventListener("click", () => { vue = b.dataset.cgv; monter(); }));
  const fermer = () => { if (api) { try { api.detruire(); } catch (e) { } } o.remove(); };
  o.querySelector(".rg-x").addEventListener("click", fermer); o.addEventListener("click", ev => { if (ev.target === o) fermer(); });
  monter();
}
/* ---------- v17.49 · 🎅 Le vainqueur du tour de chauffe : une mini-cérémonie, une fois par appareil ----------
   Quand : la manche de décembre 2026 (l'Atelier du Père Noël) est DÉFINITIVE = tous les relevés de décembre saisis, puis 48 h après le dernier
   (heure lue dans le journal ; jamais avant le dernier jour ouvré de décembre + 48 h). Avant : provisoire, pas de cérémonie.
   Le résultat reste caché jusqu'à la course : si la course n'a pas encore été regardée sur cet appareil, la cérémonie attend son arrivée.
   Ce qu'on voit (≤ 5 s, un toucher ferme) : neige, la tête du vainqueur avec un bonnet, son nom, le podium des 3 premiers ; grelots si le son est activé.
   Rien d'autre : pas de points, pas de chiffres, rien sur la suite. Calculé avec les données déjà reçues (aucun appel serveur). */
const FETE_CH = { cle: "versus.chauffeFete", fin: new Date(SAISON.premiere, 1, 1).getTime(), ouverte: null };
/** la manche de chauffe est-elle définitive ? → { podium: [noms dans l'ordre] } ou null */
function chauffeDefinitive() {
  if (typeof D === "undefined" || !D || !D.personnes || apercuSaison()) return null;
  const y = SAISON.premiere - 1; if (!estChauffe(y)) return null;
  const c = championnat(y), m = c.complete ? c.mois.find(x => x.k === CHAUFFE_K) : null; if (!m || c.classement.length < 2) return null;
  let t = jourReleve(Math.floor(CHAUFFE_K / 100), CHAUFFE_K % 100).getTime();
  m.l.forEach(x => { const j = typeof derniereSaisie === "function" ? derniereSaisie(x.nom, CHAUFFE_K) : null, tj = j ? new Date(j.t).getTime() : NaN; if (tj > t) t = tj; });
  const rang = {}; m.l.forEach(x => { rang[x.nom] = x.rg; });   // v17.53 : ex æquo en tête → tous à l'honneur
  return Date.now() >= t + 48 * 3600e3 ? { podium: c.classement.slice(0, 3), rang } : null;
}
/** à l'ouverture (ou à l'arrivée de la course de chauffe) : la cérémonie, si elle est due et pas encore vue ici */
function verifierFeteChauffe(apresCourse) {
  if (FETE_CH.ouverte || Date.now() >= FETE_CH.fin || stock.get(FETE_CH.cle) === String(CHAUFFE_K)) return;
  if (+(stock.get("versus.gpVu." + (SAISON.premiere - 1)) || 0) < CHAUFFE_K) return;   // course pas encore vue : on ne gâche pas le résultat
  if (document.querySelector(".tuto, .revel, .regles, .ba, .ere-voile" + (apresCourse ? "" : ", .gp-plein"))) return;   // une cérémonie à la fois : ce sera pour la prochaine ouverture
  const def = chauffeDefinitive(); if (!def) return;
  stock.set(FETE_CH.cle, String(CHAUFFE_K)); feteChauffe(def.podium, false, def.rang);
}
/** aperçu admin : la vraie si la manche est définitive, sinon un exemple inventé (ordre fixe tiré des prénoms, aucun chiffre) ; rien n'est gardé */
function apercuFeteChauffe() {
  if (!apercuAutorise()) return;   // v20.40 : double sécurité
  const def = chauffeDefinitive(); feteChauffe(def ? def.podium : fauxVerdict(CHAUFFE_K).du.map(x => x.nom).slice(0, 3), !def, def ? def.rang : null);
}
const BONNET_SVG = '<svg class="fc-bonnet" viewBox="0 0 64 48" aria-hidden="true"><path d="M8 38C10 20 22 7 38 6C47 6 54 12 57 22C52 18 47 17 44 20C45 27 46 33 46 38Z" fill="#D62839"/><path d="M38 6C47 6 54 12 57 22C52 18 47 17 44 20" fill="#A51C2B"/><rect x="4" y="34" width="46" height="10" rx="5" fill="#F7F4EE"/><circle cx="57" cy="23" r="6" fill="#F7F4EE"/></svg>';
function feteChauffe(podium, apercu, rang) {
  if (FETE_CH.ouverte || !podium || !podium.length) return;
  const rg = n => rang && rang[n] ? rang[n] : podium.indexOf(n) + 1;   // v17.53 (Théo) : ex æquo en tête = tous à l'honneur
  const vs = podium.filter(n => rg(n) === 1); if (!vs.length) vs.push(podium[0]);
  const v = vs.map(n => n).join(" & "), moi = moiPilote(), bravo = vs.includes(moi), duo = vs.length > 1, G = GPS.abudhabi || {}, tete = n => avatarCourse(n, { vignette: true });
  const o = document.createElement("div"); o.className = "fc-voile" + (ANIM ? "" : " fixe"); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.setAttribute("aria-label", bravo ? (duo ? "Bravo, tu partages la victoire du tour de chauffe" : "Bravo, tu remportes le tour de chauffe") : v + (duo ? " remportent ex æquo le tour de chauffe" : " remporte le tour de chauffe"));
  const marche = (n, r) => n ? (r = Math.min(3, rg(n)), '<div class="fc-m fc-m' + r + (n === moi ? " moi" : "") + '" style="--c:' + couleur(n) + '">' + tete(n) + "<b>" + esc(n) + "</b>" + (n === moi && !bravo ? "<small>toi</small>" : "") + '<i class="fc-socle">' + r + "</i></div>") : "";
  o.innerHTML = '<canvas class="fc-neige" aria-hidden="true"></canvas><div class="fc-c">' + (apercu ? '<span class="fc-apercu">Aperçu admin · exemple inventé</span>' : "") +
    '<span class="fc-k">' + esc((G.drap || "🎅") + " " + (G.gp || "L'Atelier du Père Noël")) + "</span>" +
    '<div class="fc-herosx' + (duo ? " duo" : "") + '">' + vs.map(n => '<div class="fc-heros" style="--c:' + couleur(n) + '"><i class="fc-halo"></i>' + avatarCourse(n, { vignette: true, skin: "noel" }) + "</div>") /* v18.3 : bonnet dessiné sur la tête */.join("") + "</div>" +
    (bravo ? '<h3 class="fc-t">Bravo&nbsp;!</h3><p class="fc-s">' + (duo ? "Tu partages la victoire du tour de chauffe" : "Tu remportes le tour de chauffe") + "</p>"
      : '<h3 class="fc-t">' + esc(v) + '</h3><p class="fc-s">' + (duo ? "Vainqueurs ex æquo du tour de chauffe" : "Vainqueur du tour de chauffe") + "</p>") +
    '<div class="fc-podium">' + marche(podium[1], 2) + marche(podium[0], 1) + marche(podium[2], 3) + "</div>" +
    '<small class="fc-passer">Touche pour continuer</small></div>';
  document.body.appendChild(o); FETE_CH.ouverte = o;
  let raf = 0, fini = false;
  const fermer = () => { if (fini) return; fini = true; clearTimeout(tAuto); o.classList.add("sort"); document.removeEventListener("keydown", clavier); setTimeout(() => { cancelAnimationFrame(raf); o.remove(); if (FETE_CH.ouverte === o) FETE_CH.ouverte = null; }, 260); };
  const clavier = e => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") fermer(); };
  o.addEventListener("click", fermer); document.addEventListener("keydown", clavier);
  const tAuto = 0;   // v17.53 (Théo) : plus de fermeture automatique, on touche l'écran pour passer
  requestAnimationFrame(() => o.classList.add("on"));
  if (window.SONS) { setTimeout(() => { if (!fini) { SONS.jingle("garage", "motif"); SONS.vibrer(bravo ? [60, 50, 60, 50, 180] : 40); } }, 450); setTimeout(() => { if (!fini) SONS.jingle("garage", "accord"); }, 1650); }
  if (!ANIM) return;
  const cv = o.querySelector(".fc-neige"), cx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cx.scale(dpr, dpr);
  const fl = Array.from({ length: Math.round(Math.min(90, W * H / 6000)) }, () => ({ x: Math.random() * W, y: Math.random() * H - H, r: 1 + Math.random() * 2.6, v: .5 + Math.random() * 1.3, p: Math.random() * 6.28 }));
  const pas = () => { cx.clearRect(0, 0, W, H); cx.fillStyle = "rgba(255,255,255,.85)"; cx.beginPath();
    fl.forEach(f => { f.y += f.v; f.p += .02; f.x += Math.sin(f.p) * .4; if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; } cx.moveTo(f.x + f.r, f.y); cx.arc(f.x, f.y, f.r, 0, 6.283); });
    cx.fill(); if (!fini) raf = requestAnimationFrame(pas); };
  raf = requestAnimationFrame(pas);
}

/* ---------- 🎫 v20.47 · Le ticket d'or (mécanique du circuit de la Chocolaterie, octobre 2027) ----------
   Du 1er au 31 octobre 2027, sur la page Course de la Chocolaterie, chaque pilote déballe UNE tablette par jour.
   V88 (Théo, 25/11) : UN SEUL ticket d'or dans l'année, tiré à l'avance par le serveur (app_scripts/versus/TicketsOr.js) : l'appli n'en sait rien.
   Les autres tablettes : un mot drôle, parfois un carré doré (objectif commun du groupe). Aucun point.
   L'appli ne connaît JAMAIS le tirage : elle reçoit l'empreinte (dès le 1/1/2027, affichée dans les règles), les gagnants,
   et la graine seulement après le 31 octobre. Aperçu admin : exemple INVENTÉ, rien n'est envoyé (double sécurité apercuAutorise). */
const TICKET_CI = "singapour";
let TICKETS_T = 0, TICKET_APERCU = null, NTAB = 0;
const MOTS_TABLETTE = ["Juste du chocolat… délicieux quand même.", "Pas de ticket. Mais 100 % cacao, 0 % regret.", "Rien de doré là-dedans, à part ton sourire plein de chocolat.",
  "Le ticket se cache ailleurs. Celle-ci, tu peux la manger.", "Une tablette, zéro ticket, des miettes partout.", "Le chocolatier te fait un clin d'œil : reviens demain.",
  "Toujours pas d'or… mais c'est praliné !", "Le papier brille, pas le ticket. Demain, peut-être ?", "Les petits ouvriers chantent quand même. Pour le chocolat."];
/** les tickets se chargent à partir du 1/1/2027 (empreinte dans les règles), pour de vrai seulement (pas en simulation) */
function ticketsOuverts() { return Date.now() >= TICKET_MOIS.regles.getTime() && SOURCE === "api" && !simulation(); }
function moisTablettes() { const n = aujNum(); return n >= 20271001 && n <= 20271031; }
async function chargerTickets(force) {
  if (!ticketsOuverts() || (!force && (TICKETS || Date.now() - TICKETS_T < 60000))) return;
  TICKETS_T = Date.now();
  const rep = await posterAdmin({ action: "tickets" });
  if (!rep || !rep.ok || !rep.ouvert) return;
  TICKETS = rep; if (typeof mjChange === "function") mjChange(); poserTabletteDOM(document);
}
/** la tablette, dessinée par nous : papier violet et or (déchiré en deux), papier d'argent, carrés de chocolat ; un ticket doré glissé dessous si gagné */
function svgTablette(u) {
  const G = "M0 0H113L106 12 115 24 104 37 114 49 105 61 115 73 106 86 113 98 108 110H0Z", Dd = "M113 0H220V110H108L113 98 106 86 115 73 105 61 114 49 104 37 115 24 106 12Z";
  const carres = []; for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) carres.push('<rect x="' + (17 + i * 32) + '" y="' + (13 + k * 30) + '" width="28" height="26" rx="3" fill="url(#' + u + 'c)" stroke="#2A1205" stroke-width="1"/><path d="M' + (20 + i * 32) + " " + (16 + k * 30) + "h22" + '" stroke="#C98A55" stroke-width="1.4" opacity=".5"/>');
  const papier = '<rect width="220" height="110" rx="6" fill="url(#' + u + 'p)"/><path d="M0 34H220M0 76H220" stroke="#F7CF55" stroke-width="3"/><path d="M0 37H220M0 73H220" stroke="#9A6716" stroke-width="1"/>' +
    '<rect x="62" y="40" width="96" height="30" rx="15" fill="#F7CF55" stroke="#7A4A0C" stroke-width="1.2"/><text x="110" y="60" text-anchor="middle" style="font:italic 800 15px var(--f-display);letter-spacing:.14em;fill:#4A1236">CHOCOLAT</text>' +
    '<text x="110" y="24" text-anchor="middle" style="font:800 9px var(--f-display);letter-spacing:.4em;fill:#FFE596">VERSUS</text><text x="110" y="96" text-anchor="middle" style="font:700 8px var(--f-text);letter-spacing:.2em;fill:#FFE596;opacity:.85">FONDANT · OCTOBRE</text>';
  return '<svg class="tb-svg" viewBox="-6 -6 232 122" aria-hidden="true"><defs>' +
    '<linearGradient id="' + u + 'p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B2C7A"/><stop offset=".5" stop-color="#5E1248"/><stop offset="1" stop-color="#3A0A2C"/></linearGradient>' +
    '<linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A4A22"/><stop offset="1" stop-color="#4A230F"/></linearGradient>' +
    '<linearGradient id="' + u + 'f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6F8"/><stop offset=".5" stop-color="#AEB7C2"/><stop offset="1" stop-color="#E3E8EE"/></linearGradient>' +
    '<clipPath id="' + u + 'g"><path d="' + G + '"/></clipPath><clipPath id="' + u + 'd"><path d="' + Dd + '"/></clipPath>' +
    '<g id="' + u + 'w">' + papier + "</g></defs>" +
    '<rect x="-3" y="-3" width="226" height="116" rx="7" fill="url(#' + u + 'f)"/>' +
    '<g class="tb-choco"><rect x="8" y="6" width="204" height="98" rx="5" fill="#3A1A08"/>' + carres.join("") + "</g>" +
    '<g class="tb-ticket"><path d="M40 30H180V48A7 7 0 0 0 180 62V80H40V62A7 7 0 0 0 40 48Z" fill="#F7CF55" stroke="#7A4A0C" stroke-width="2"/><path d="M62 32V78" stroke="#7A4A0C" stroke-dasharray="3 3"/>' +
    '<text x="120" y="61" text-anchor="middle" style="font:italic 800 17px var(--f-display);letter-spacing:.08em;fill:#5A3405">TICKET D\'OR</text></g>' +
    '<g class="tb-papier tb-g"><use href="#' + u + 'w" clip-path="url(#' + u + 'g)"/><path d="M113 0L106 12 115 24 104 37 114 49 105 61 115 73 106 86 113 98 108 110" fill="none" stroke="#FFE7F6" stroke-width="1.2" opacity=".6"/></g>' +
    '<g class="tb-papier tb-d"><use href="#' + u + 'w" clip-path="url(#' + u + 'd)"/></g></svg>';
}
/** la carte « tablette du jour » : l'état (déjà déballée ou non) et le bouton ; o = { apercu } */
function htmlTablette(T, apercu) {
  const fait = !!(T && T.dejaAujourdhui), g = (T && T.gagnants) || [], mien = T && T.monTicket, k = T && T.carres;
  return '<div class="gp-tablette' + (fait ? " ouverte" : "") + (fait && T.dernier && T.dernier.ticket ? " gagne" : "") + '" data-ci="' + TICKET_CI + '">' +
    '<div class="tb-h"><b>🍫 La tablette du jour' + (apercu ? " · aperçu (exemple inventé)" : "") + "</b><small>" + esc(texteTicketEtat(T)) + "</small></div>" +
    '<div class="tb-boite">' + svgTablette("tb" + (++NTAB)) + "</div>" +
    '<p class="tb-mot" aria-live="polite">' + (fait ? esc((T.dernier && T.dernier.mot) || "Tablette déballée aujourd'hui. Reviens demain !") : "Une tablette par jour, du 1er au 31 octobre. Déballe la tienne : le seul ticket d'or de l'année est peut-être dedans aujourd'hui.") + "</p>" +
    (fait ? '<p class="tb-fait">✅ Déballée aujourd\'hui · la prochaine demain</p>' : '<button class="btn acc tb-b" type="button" data-deballer>🍫 Déballer ma tablette</button>') +
    (mien ? '<p class="tb-mien">🎫 Tu as LE ticket d\'or : la plaque « Ticket d\'or » et la finition « Feuille d\'or » t\'attendent dans l\'Écurie.</p>' : "") +
    (k ? '<p class="tb-g-l tb-dores">✨ Carrés dorés du groupe : <b>' + k.total + " / " + k.objectif + "</b>" + (k.reussi ? " · objectif commun réussi !" : "") + (k.moi ? " (dont " + k.moi + " à toi)" : "") + "</p>" : "") + "</div>";
}
/** l'état du ticket en une ligne (V88 : un seul) */
function texteTicketEtat(T) {
  const g = (T && T.gagnants) || [];
  return g.length ? "🎫 Le ticket d'or a été trouvé par " + g[0].nom : "🎫 Le seul ticket d'or de l'année est encore caché";
}
/** pose la carte sous la piste de la Chocolaterie (octobre 2027 seulement, ou l'aperçu admin) */
function poserTabletteDOM(v) {
  document.querySelectorAll(".gp-tablette:not(.tk-ap)").forEach(e => e.remove());
  const pi = document.querySelector("#gp-piste"); if (!pi || pi.dataset.circuit !== TICKET_CI) return;
  if (!TICKETS || !TICKETS.enCours || !moisTablettes()) return;
  const ancre = document.querySelector(".gp-vues2") || document.querySelector(".gp-ancre") || pi;   // sous la barre d'outils de la piste, comme la carte du mini-jeu
  ancre.insertAdjacentHTML("afterend", htmlTablette(TICKETS, false));
  brancherTablette(ancre.nextElementSibling, false);
}
function brancherTablette(el, apercu) {
  const b = el && el.querySelector("[data-deballer]"); if (!b) return;
  b.addEventListener("click", () => deballer(el, apercu));
}
/** déballer : le papier se déchire (sauf animations réduites), puis chocolat… ou ticket d'or */
async function deballer(el, apercu) {
  const b = el.querySelector("[data-deballer]"); if (!b || b.disabled) return; b.disabled = true; b.textContent = "Ça se déchire…";
  if (window.SONS && SONS.actif && SONS.actif()) try { SONS.vibrer([20, 30, 20]); } catch (e) { /* sans vibreur */ }
  const rep = apercu ? apercu.deballer() : await posterAdmin({ action: "deballer" });
  if (!rep || !rep.ok) { b.disabled = false; b.textContent = "🍫 Déballer ma tablette"; toast(rep && rep.message ? rep.message : "Le serveur ne répond pas : réessaie."); if (rep && rep.erreur === "deja" && !apercu) { if (TICKETS) TICKETS.dejaAujourdhui = true; poserTabletteDOM(document); } return; }
  const mot = rep.ticket ? "🎫 Un ticket d'or brille sous le papier !" : (rep.dore ? "✨ Un carré doré ! " : "") + MOTS_TABLETTE[(aujNum() + Math.floor(Math.random() * 97)) % MOTS_TABLETTE.length];
  el.classList.add("ouverte"); if (rep.ticket) el.classList.add("gagne");
  const m = el.querySelector(".tb-mot"); if (m) m.textContent = mot;
  b.remove();
  const T = apercu ? apercu.T : TICKETS;
  if (T) { T.dejaAujourdhui = true; T.dernier = { ticket: rep.ticket, mot }; if (rep.gagnants) T.gagnants = rep.gagnants; if (rep.monTicket) T.monTicket = rep.monTicket;
    if (rep.carres) T.carres = rep.carres; if (!apercu && typeof mjChange === "function") mjChange();
    const sm = el.querySelector(".tb-h small"); if (sm) sm.textContent = texteTicketEtat(T);
    const kd = el.querySelector(".tb-dores b"); if (kd && T.carres) kd.textContent = T.carres.total + " / " + T.carres.objectif; }
  if (window.SONS) try { rep.ticket ? SONS.succes() : SONS.klaxon("confettis"); } catch (e) { /* sans son */ }
  if (rep.ticket) setTimeout(() => ceremonieTicket(rep.ticket, !!apercu), reduit ? 200 : 1300);
  else if (!apercu) setTimeout(() => poserTabletteDOM(document), reduit ? 0 : 2600);
}
/** la cérémonie plein écran : l'ascenseur de verre monte, les portes s'ouvrent sur le ticket d'or ; le nom, la plaque gagnée, aucun point */
function ceremonieTicket(n, exemple) {
  const moi = exemple ? "Pilote d'exemple" : (moiVrai() || "toi");
  const o = document.createElement("div"); o.className = "revel tk-or" + (reduit ? " reduit" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Ticket d'or");
  const e = typeof equipDe === "function" && D && D.personnes.some(p => p.nom === moiVrai()) ? equipDe(moiVrai()) : {};
  o.innerHTML = '<div class="rv-c tk-c"><span class="cbo-rayons" aria-hidden="true"></span><span class="tuto-k">🎫 Le ticket d\'or 2027' + (exemple ? " · exemple inventé" : "") + "</span>" +
    '<div class="tk-scene" aria-hidden="true"><div class="tk-cage"><span class="tk-cable"></span><div class="tk-verre"><span class="tk-p tk-pg"></span><span class="tk-p tk-pd"></span>' +
    '<svg class="tk-ticket" viewBox="0 0 220 110"><defs><linearGradient id="tkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6CC"/><stop offset=".3" stop-color="#F7CF55"/><stop offset=".55" stop-color="#C98E22"/><stop offset=".8" stop-color="#FFE596"/><stop offset="1" stop-color="#9A6716"/></linearGradient></defs>' +
    '<path d="M4 4H216V44A11 11 0 0 0 216 66V106H4V66A11 11 0 0 0 4 44Z" fill="url(#tkg)" stroke="#6B430C" stroke-width="3"/><path d="M40 8V102" stroke="#6B430C" stroke-width="1.5" stroke-dasharray="4 4"/>' +
    '<text x="128" y="50" text-anchor="middle" style="font:italic 800 22px var(--f-display);letter-spacing:.1em;fill:#4A2C05">TICKET D\'OR</text><text x="128" y="74" text-anchor="middle" style="font:700 11px var(--f-text);letter-spacing:.3em;fill:#6B430C">UNIQUE · 2027</text>' +
    '<path d="M22 46L25 53 32 54 27 59 28 66 22 62 16 66 17 59 12 54 19 53Z" fill="#FFF6CC" stroke="#6B430C" stroke-width="1"/></svg></div></div></div>' +
    "<h3>Un ticket d'or !</h3><p class=\"cbo-grave\">Trouvé dans la tablette de <b>" + esc(moi) + "</b></p>" +
    "<p>Un seul ticket dans toute l'année, et il était dans ta tablette : il est à toi pour toujours. Il brille dans tes Trophées, parmi les 💎 Légendes.</p>" +
    '<div class="tk-obj"><span>Objets d\'écurie exclusifs</span><div class="tk-objs">' + (typeof vignetteItem === "function" ? vignetteItem("plaque", "ticketor", moiVrai() || "", e) + '<span class="tk-fin">' + vignetteItem("finition", "feuilledor", moiVrai() || "", e) + "<small>Finition « Feuille d'or »</small></span>" : "") + "</div></div>" +
    '<p class="cbo-flair">Aucun point au championnat : seulement la gloire (la plaque, et ta voiture à la feuille d\'or en course).</p>' +
    '<div class="btn-row">' + (exemple ? "" : '<button class="btn acc" type="button" data-tk-vit>Voir ma Légende</button>') + '<button class="btn ghost" type="button" data-tk-ok>Génial !</button></div></div>';
  document.body.appendChild(o);
  const t0 = Date.now(), fermer = () => o.remove();
  o.addEventListener("click", ev => { if (ev.target === o && Date.now() - t0 > 1500) fermer(); });
  o.querySelector("[data-tk-ok]").addEventListener("click", fermer);
  const vt = o.querySelector("[data-tk-vit]"); if (vt) vt.addEventListener("click", () => { fermer(); ETAT.podium = "defis"; if (typeof VIT_ONGLET !== "undefined") VIT_ONGLET = "legendes"; garder(); if (typeof allerA === "function") allerA("trophees"); rendreTrophees(); setTimeout(() => { const s = document.querySelector("#vit-tickets"); if (s) s.scrollIntoView({ block: "center" }); }, 300); });
  setTimeout(() => { try { confettis("ouvriers"); } catch (er) { /* sans fête */ } }, reduit ? 0 : 1600);
  if (window.SONS && SONS.jingle) setTimeout(() => { try { SONS.jingle("defaut", "accord"); } catch (er) { /* sans son */ } }, reduit ? 100 : 1500);
}
/** 🎫 aperçu admin (double sécurité) : une tablette d'exemple dans une fenêtre ; 1re tablette = chocolat, 2e = ticket d'or. Rien n'est envoyé. */
function apercuTicket() {
  if (!apercuAutorise()) return;
  const T = { n: 1, gagnants: [], dejaAujourdhui: false, monTicket: null, carres: { moi: 0, total: 7, objectif: 16, reussi: false } };
  let essais = 0;
  const AP = { T, deballer: () => { essais++; return essais === 1 ? { ok: true, ticket: null, dore: true, carres: { moi: 1, total: 8, objectif: 16, reussi: false } } : { ok: true, ticket: 1, gagnants: [{ nom: "Pilote d'exemple", n: 1 }], monTicket: 1 }; } };
  const o = document.createElement("div"); o.className = "regles tk-apercu"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Aperçu du ticket d'or");
  const corps = () => '<div class="rg-c"><div class="rg-h"><b>🎫 Aperçu · le ticket d\'or</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div>' +
    '<p class="info">Exemple inventé : rien n\'est envoyé au serveur, le vrai tirage reste secret, même pour toi. 1re tablette : du chocolat et un carré doré ; 2e : le ticket d\'or.</p>' +
    htmlTablette(T, true).replace('class="gp-tablette', 'class="gp-tablette tk-ap') + (essais === 1 ? '<button class="btn ghost" type="button" data-tk-encore>🔄 Une autre tablette (exemple)</button>' : "") + "</div>";
  const rendre = () => { o.innerHTML = corps(); o.querySelector(".rg-x").addEventListener("click", () => o.remove()); brancherTablette(o.querySelector(".gp-tablette"), AP);
    const en = o.querySelector("[data-tk-encore]"); if (en) en.addEventListener("click", () => { T.dejaAujourdhui = false; T.dernier = null; rendre(); }); };
  const b0 = AP.deballer; AP.deballer = () => { const r = b0(); setTimeout(rendre, r.ticket ? 2200 : 1600); return r; };
  rendre(); document.body.appendChild(o);
}
/** règles : l'empreinte du tirage (dès le 1/1/2027), le tirage dévoilé après le 31 octobre */
function regleTicket() {
  if (Date.now() < TICKET_MOIS.regles.getTime()) return "";
  const T = TICKETS, emp = T && T.empreinte ? '<code class="tk-emp">' + esc(T.empreinte) + "</code>" : '<span class="tk-emp attente">(empreinte en chargement…)</span>';
  const rev = T && T.revele ? " Tirage dévoilé : le ticket est apparu le " + (T.revele.jour % 100) + " octobre chez " + esc((T.revele.porteurs || []).join(", puis ")) + " (graine <code class=\"tk-emp\">" + esc(T.revele.graine) + "</code>)." : " Le tirage sera dévoilé le 1<sup>er</sup> novembre 2027 : chacun pourra vérifier que personne n'y a touché.";
  return '<li id="rg-ticket"><b>🎫 Ticket d\'or</b> (🍫 Chocolaterie, octobre 2027) : chaque jour du mois, déballe ta tablette sur la page Course. Un seul ticket d\'or dans toute l\'année : un jour secret, il est dans la tablette d\'un pilote tiré au sort ; s\'il ne déballe pas ce jour-là, le ticket passe le lendemain chez un autre (tirage tenu secret : personne ne le connaît, l\'heure ne compte pas). Ensemble, trouvez assez de carrés dorés pour le trophée de la Chocolaterie. Aucun point : une cérémonie, le badge 🎫, la plaque « Ticket d\'or » et la finition « Feuille d\'or » (ta voiture dorée à la feuille, en course). ' +
    "Empreinte du tirage : " + emp + (T && T.depuis ? " (publiée le " + (T.depuis % 100) + "/" + (Math.floor(T.depuis / 100) % 100) + "/" + Math.floor(T.depuis / 10000) + ")" : "") + "." + rev + "</li>";
}
