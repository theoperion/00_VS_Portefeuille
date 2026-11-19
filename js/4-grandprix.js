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
  { id: "turbo", ico: "🚀", nom: "Turbo", def: "Si tu bats l'indice ce mois-ci, ton bonus 🎯 vaut +3 au lieu de +1.", court: "bonus 🎯 à +3" },
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
  if (c.c === "aspiration" && avant) { const pl = avant[x.nom], dev = pl > 1 ? Object.keys(avant).find(n => avant[n] === pl - 1) : null, xd = dev && l.find(z => z.nom === dev); return xd && x.r > xd.r + 1e-12 ? 2 + up.a : 0; }
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
/* Fenêtre des cartes et des duels pour le mois K : du 20 du mois d'avant au 1er de K inclus (au 5 pour la chauffe) */
function moisCarteOuvert() {
  const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1;
  if (d.getDate() < jourLimite(k)) return k;
  return d.getDate() >= 20 ? cleMoins(k, -1) : null;
}
/** Prochaine fenêtre quand tout est fermé : { k, du } */
function prochaineFenetre() { const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1; return { k: cleMoins(k, -1), du: "20 " + moisLong(k).replace(/ \d{4}$/, "") }; }
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
  const r = k ? indiceMois(k) : null;
  if (r === null) return { id: "beau", ico: "🌤️", nom: "Beau temps", txt: "Départ sous un ciel dégagé." };
  const idx = D.marche.indices[iRef()], t = idx + " " + pct(r);
  if (r >= 0.03) return { id: "soleil", ico: "☀️", nom: "Grand soleil", txt: t + " : piste sèche, ça roule fort." };
  if (r >= 0) return { id: "nuages", ico: "⛅", nom: "Nuageux", txt: t + " : temps couvert, course tactique." };
  if (r > -0.03) return { id: "pluie", ico: "🌧️", nom: "Pluie", txt: t + " : piste glissante, les pneus pluie paient pour qui résiste." };
  return { id: "orage", ico: "⛈️", nom: "Orage", txt: t + " : déluge sur le circuit, accrochez-vous." };
}

/* ---------- Grands Prix : un circuit à thème par mois (le dessin 3D / 2D est dans piste.js) ---------- */
const GPS = {
  abudhabi: { gp: "Le Garage des rêves", ville: "Garage des rêves", drap: "🛠️", fx: "garage", txt: "Là où toutes les voitures naissent, entre établis, projecteurs et odeur d'essence : le tour de chauffe." },
  bahrein: { gp: "Grand Prix des Lucioles", ville: "Forêt aux lucioles", drap: "🌲", fx: "lucioles", atout: "turbo", piege: "pluie", txt: "Des milliers de lucioles éclairent la piste au crépuscule, entre des arbres qui murmurent." },
  djeddah: { gp: "Grand Prix du Château", ville: "Château aux sortilèges", drap: "🏰", fx: "sortileges", atout: "aspiration", piege: "pari", txt: "Les escaliers changent de place et les couloirs se referment derrière toi." },
  melbourne: { gp: "Grand Prix des Merveilles", ville: "Pays des merveilles", drap: "🎩", fx: "petales", atout: "pluie", piege: "turbo", txt: "On tombe dans un terrier, on boit une fiole, on rétrécit… et le Chapelier sert le thé à toute heure." },
  suzuka: { gp: "Grand Prix de l'Anneau", ville: "Terre de l'Anneau", drap: "💍", fx: "lucioles", atout: "pari", piege: "aspiration", txt: "De la Comté à la montagne de feu : un seul anneau, une seule ligne d'arrivée." },
  miami: { gp: "Grand Prix des Tributs", ville: "L'Arène", drap: "🏹", fx: "cendres", atout: "turbo", piege: "pluie", txt: "Une arène en pleine forêt, découpée comme une horloge : chaque heure, un nouveau piège. Puisse le sort vous être favorable." },
  montreal: { gp: "Grand Prix des Étoiles", ville: "Bataille spatiale", drap: "🌌", fx: "neige", atout: "pari", piege: "turbo", txt: "Il y a bien longtemps, dans une galaxie lointaine… quatre pilotes ont rejoint l'escadrille." },
  silverstone: { gp: "Grand Prix de la Mer de dunes", ville: "Mer de dunes", drap: "🏜️", fx: "sable", atout: "aspiration", piege: "pari", txt: "Deux soleils, du sable à l'infini et, sous la piste, quelque chose d'immense qui bouge." },
  spa: { gp: "Grand Prix du Monde à l'envers", ville: "Monde à l'envers", drap: "🔦", fx: "brume", atout: "pluie", piege: "turbo", txt: "Les lumières clignotent, la forêt se retourne : quelque chose rôde de l'autre côté." },
  monza: { gp: "Grand Prix du Multivers", ville: "Le Multivers", drap: "🌀", fx: "eclairs", atout: "aspiration", piege: "pluie", txt: "Des mondes cousus entre eux, des portails qui s'ouvrent, des héros… et un gant qui n'attend que six pierres." },
  singapour: { gp: "Grand Prix de la Chocolaterie", ville: "La Chocolaterie", drap: "🍫", fx: "sortileges", atout: "pari", piege: "aspiration", txt: "Une rivière de chocolat, des sucettes géantes, un ascenseur de verre… des citrouilles en sucre pour Halloween… et peut-être le dernier ticket d'or." },
  interlagos: { gp: "Grand Prix du Mur des titans", ville: "Mur des titans", drap: "🧱", fx: "cendres", atout: "pluie", piege: "aspiration", txt: "Une piste au pied d'un mur de cinquante mètres. De l'autre côté, des géants." },
  lasvegas: { gp: "Grand Prix de l'Odyssée", ville: "L'Odyssée", drap: "🌊", fx: "eclairs", atout: "turbo", piege: "pari", txt: "Dix ans pour rentrer chez soi : Cyclope, Sirènes et tempêtes entre Troie et Ithaque. La dernière course de l'année." },
  monaco: { gp: "Grand Prix du Plateau maudit", ville: "Plateau maudit", drap: "🎲", fx: "des", atout: "pari", piege: "turbo", txt: "Un jeu de société géant : chaque case peut te faire avancer… ou reculer. Les dés sont pipés." }
};
const CAL_GP = ["bahrein", "djeddah", "melbourne", "suzuka", "miami", "montreal", "silverstone", "spa", "monza", "singapour", "interlagos", "lasvegas"];
/** Circuit d'un mois : le Garage des rêves pour la chauffe, sinon le calendrier (V16.14 : le mois du Côté obscur garde son circuit, la règle s'y ajoute) */
function circuitDe(k) {
  if (!k || k === CHAUFFE_K) return "abudhabi";
  return CAL_GP[((k % 100) - 1 + 12) % 12];
}
/** Atout du circuit d'un mois, quand la règle compte pour ce mois (sinon null) ; plus de piège depuis la V12 */
function atoutsDe(k) {
  if (!k || k === CHAUFFE_K || !regleActive("circuits", k)) return null;
  const cote = k === monacoMois(Math.floor(k / 100)) && regleVisible("monaco") && regleActive("monaco", k);   // le Côté obscur garde l'atout de l'ancien Plateau maudit (calcul inchangé)
  const g = GPS[cote ? "monaco" : circuitDe(k)]; if (!g || !g.atout) return null;
  return { atout: carteDef(g.atout), piege: null, g };
}
/** Atout d'un circuit : secret jusqu'à la révélation des cartes (le 2 du mois, le 6 pour la chauffe) */
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
  return { uni: c, carbone: "#2d333d", eclair: c, damier: "#f5f5f2", tortue: "#2F8A45", chrome: "#d4dae1", etoile: "#F7CF55", holo: "#B98CFF", couronne: "#F7CF55", foudre: "#0B1020", phenix: "#FF8A1F", glace: "#BFEFFC", galaxie: "#5B2A9E", empereur: "#6B2FB3" }[e && e.casque] || c;
}
const CAMS = { tv: "🎥 TV", helico: "🚁 Hélico", bord: "👁️ Embarquée" };
function camGP() { return ETAT.gpCam === "helico" || ETAT.gpCam === "bord" ? ETAT.gpCam : ETAT.gpCam === "0" ? "helico" : "tv"; }
function piste3D() { return !!(window.Piste && Piste.supporte()); }
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
function mancheGP(etapes, i) {
  const noms = D.personnes.map(p => p.nom), et = etapes[i], prec = et.avenir ? et.pts : i > 0 ? etapes[i - 1].pts : Object.fromEntries(noms.map(n => [n, 0]));
  const grille = noms.slice().sort((a, b) => (prec[b] || 0) - (prec[a] || 0) || noms.indexOf(a) - noms.indexOf(b));
  const gains = {}; noms.forEach(n => gains[n] = i > 0 && !et.avenir ? Math.max(0, (et.pts[n] || 0) - (prec[n] || 0)) : 0);
  const max = Math.max(0, ...Object.values(gains));
  return { grille, depart: Object.fromEntries(noms.map(n => [n, 0])), arrivee: gains, tour: max > 0 ? max : TOUR_GP };
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
function htmlGrandPrix(y) {
  const etapes = etapesGP(y), c = championnat(y);
  const i = GP_ETAPE !== null && GP_ETAPE < etapes.length ? GP_ETAPE : etapeParDefaut(etapes, y), et = etapes[i];
  const qui = quiEcurie(), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), G = GPS[ci], at = atoutsVus(kGP);
  const met = meteoMois(et.k), spe = et.k ? moisSpecial(y, et.k) : null, pgm = et.m && et.m.piege ? et.m.piege : null;
  const ordre = Object.keys(et.pts).sort((a, b) => et.pts[b] - et.pts[a] || (c.tot[b] ? c.tot[b].v : 0) - (c.tot[a] ? c.tot[a].v : 0));
  const tete = ordre[0], tourTete = Math.floor((et.pts[tete] || 0) / TOUR_GP) + 1;
  const deux = ETAT.gp2d === "1" || !piste3D(), cam = camGP();
  const piste = '<div class="gp-piste' + (deux ? " en2d" : "") + '" id="gp-piste" data-circuit="' + ci + '"><div class="gp-scene" id="gp-scene"></div>' +
    '<div class="gp-zones">' + (at ? '<span class="gp-zone at" data-zone="atout">' + at.atout.ico + ' <b>+1</b></span>' : "") + "</div>" +
    '<div class="gp-tags3">' + ordre.map(n => '<span class="gp-t3' + (n === qui ? " ici" : "") + '" data-gpt3="' + esc(n) + '" style="--c:' + couleur(n) + '" title="' + esc(n) + '">' + avatar(n) + '<i class="gp-rg"></i></span>').join("") + "</div>" +
    '<div class="gp-pops"></div><div class="gp-com" aria-live="polite"></div>' + fxCircuit(G.fx) +
    '<div class="gp-hud"><span class="gp-tour">' + (et.k && !et.avenir ? "Manche <b>" + i + "</b>" : "Sur la grille") + "</span><span>" + met.ico + " " + esc(met.nom) + "</span></div>" +
    '<div class="gp-btns">' + (deux ? "" : '<button class="gp-vue" type="button" id="gp-cam-b" aria-label="Changer de caméra">' + CAMS[cam] + "</button>") +
    '<button class="gp-vue" type="button" id="gp-vue" aria-label="' + (deux ? "Passer en 3D" : "Passer en carte 2D") + '">' + (deux ? icoOu("vue2d", "🗺️") + " 2D" : icoOu("vue3d", "🧊") + " 3D") + '</button><button class="gp-vue gp-son" type="button" data-son aria-label="Son">🔇</button><button class="gp-vue" type="button" id="gp-ba" aria-label="Bande-annonce">' + icoOu("bandeannonce", "🎬") + '</button><button class="gp-vue" type="button" id="gp-fin" aria-label="Aller directement à la fin de la course">' + icoOu("arrivee", "⏭") + '</button><button class="gp-vue gp-pl" type="button" id="gp-plein" aria-label="Plein écran">' + icoOu("pleinecran", "⛶") + '</button></div>' +
    (spe ? '<div class="gp-spe">' + spe.ico + " " + esc(spe.nom) + "</div>" : pgm ? '<div class="gp-spe piege" data-bdg="' + esc("Piège du circuit · " + pgm.nom + " : " + pgm.txt) + '">' + pgm.ico + " " + esc(pgm.nom) + "</div>" : "") + "</div>";
  const chips = '<div class="gp-mois">' + etapes.map((x, j) => '<button type="button" data-gpe="' + j + '" aria-pressed="' + (j === i) + '">' + (x.k ? GPS[circuitDe(x.k)].drap + " " + esc(moisCourt(x.k)) + (x.avenir ? " ⏳" : "") : "Départ") + "</button>").join("") + "</div>";
  const lignes = ordre.map((n, r) => {
    const devant = r ? ordre[r - 1] : null, ecart = devant ? et.pts[devant] - et.pts[n] : 0, x = et.m ? et.m.l.find(z => z.nom === n) : null;
    const ca = et.k ? carteDe(y, n, et.k) : null, cdef = ca && ca.c ? carteDef(ca.c) : null;
    const res = x && x.carte ? (x.carte.invalide ? (x.carte.piege ? " Interdite ce mois-ci (piège 🥵 Chaleur) : sans effet." : " Pas encore piochée à ce moment-là : sans effet.") : " Résultat : " + (x.carte.gain > 0 ? "+" : "") + x.carte.gain + " pt" + (Math.abs(x.carte.gain) > 1 ? "s" : "") + (x.carte.circ ? ", dont +1 d'atout du circuit" : "") + (x.carte.bouchon ? ", sans le +1 d'atout : bouchon, plusieurs pilotes l'ont jouée" : "") + (x.carte.sab ? " · " + x.carte.cible + " " + x.carte.sab : "") + ".") : "";
    const carte = ca ? (ca.cache && !cdef ? '<span class="gp-c cache" data-bdg="Carte posée face cachée : révélée le ' + jourLimite(et.k) + ' du mois.">🂠</span>' : cdef ? '<span class="gp-c" data-bdg="' + esc(cdef.ico + " " + cdef.nom + " : " + cdef.def + res) + '">' + cdef.ico + (x && x.carte ? "<small>" + (x.carte.gain > 0 ? "+" : "") + x.carte.gain + "</small>" : "") + "</span>" : '<span class="gp-c vide"></span>') : '<span class="gp-c vide"></span>';
    const extra = x ? (x.vainq ? '<span class="gp-x or" data-bdg="🪱 Le Chevaucheur des sables : vainqueur du mois, +2.">🪱+2</span>' : "") +
      (x.piege === "nuit" && x.dernier ? '<span class="gp-x" data-bdg="🌃 Safety car de nuit : le dernier du mois marque 2 points de place.">🌃+2</span>' : "") +
      (x.equipe ? '<span class="gp-x" data-bdg="🤝 Bonus d\'équipe : tout le monde a battu le S&P 500 ce mois-ci, +1.">🤝+1</span>' : "") +
      (x.serie ? '<span class="gp-x" data-bdg="🔥 Série : ' + x.serie + ' mois d\'affilée sans finir dernier, +1.">🔥+1</span>' : "") +
      (x.defi ? '<span class="gp-x" data-bdg="' + esc((defiDuMois(et.k) || {}).ico + " Défi du mois réussi : " + (defiDuMois(et.k) || {}).txt + ", +1.") + '">🏁+1</span>' : "") +
      (x.prono ? '<span class="gp-x" data-bdg="🔮 Pronostic : ' + esc((x.prono.v || "—") + (x.prono.i ? ", S&P " + (x.prono.i === "h" ? "plus de +1 %" : "pas plus de +1 %") : "") + (x.prono.p !== null && x.prono.p !== undefined ? ", pole " + String(x.prono.p).replace(".", ",") + " %" + (x.prono.pole ? " (la plus proche)" : "") : "")) + " → +" + x.prono.pts + '.">🔮+' + x.prono.pts + "</span>" : "") +
      (x.rival ? '<span class="gp-x or" data-bdg="😈 Rival de la saison : devant ' + esc(x.rival) + ' au championnat, +3.">😈+3</span>' : "") +
      (x.regul !== undefined ? '<span class="gp-x or" data-bdg="🛡️ Trophée de la régularité : le moins souvent dernier de la saison, +3.">🛡️+3</span>' : "") +
      (x.vise || []).map(z => '<span class="gp-x" data-bdg="🎲 Pari de ' + esc(z.par) + " contre " + esc(n) + " : " + (z.gain > 0 ? esc(z.par) + " a fini devant, +2 pour lui." : z.gain < 0 ? esc(n) + " a tenu bon, " + esc(z.par) + " perd 1 point." : "égalité parfaite, 0.") + '">🎲' + (z.gain > 0 ? "" : "✓") + "</span>").join("") +
      (x.mult > 1 ? '<span class="gp-x or" data-bdg="' + esc(et.m.spec ? et.m.spec.ico + " " + et.m.spec.nom + " : points de place doublés." : "Points doublés.") + '">×2</span>' : "") +
      (x.pioche && x.pioche.length && regleVisible("pioche") ? '<span class="gp-x" data-bdg="🎴 Carte' + (x.pioche.length > 1 ? "s" : "") + " piochée" + (x.pioche.length > 1 ? "s" : "") + " ce mois-ci" + (n === qui ? " : " + esc(x.pioche.map(c => carteDef(c).nom).join(", ")) : "") + '.">🎴</span>' : "") : "";
    const jn = (c.jeu || {})[n], niv = x ? x.niv + (x.monte || 0) : jn && !et.m ? 1 : (jn ? jn.niv : 1);
    return '<div class="gp-l' + (n === qui ? " ici" : "") + '"><span class="rk">' + (r + 1) + "</span>" + avatar(n) + '<div class="nm"><b><span' + (attrLivree(n) ? attrLivree(n).replace(' class="', ' class="gp-nom ') : ' class="gp-nom"') + ">" + esc(n) + "</span>" + (regleVisible("niveaux") ? '<span class="gp-niv" data-bdg="Niveau d\'écurie ' + niv + ' : chaque niveau gagné donne une carte bonus.">N' + niv + "</span>" : "") + extra + "</b>" +   // V16.21 : plus de « à X pts de … » (alourdissait, demande de Théo) : seul le décompte du mois reste
      (x ? '<small class="gp-dec">' + esc(decompte(x, et.m.spec)) + "</small>" : "") + "</div>" + carte + '<span class="pt"><b>' + et.pts[n] + "</b><small>pts</small></span></div>";
  }).join("");
  const cal = htmlCalendrierGP(y, kGP);
  const rap = rappelCartes(), versStand = rap ? '<button class="gp-stand" type="button" data-aller-stand>🃏 <span><b>Fenêtre ouverte</b> : pose ta carte de ' + esc(moisLong(rap.k)) + "</span> ›</button>" : "";
  const att = c.attente ? '<div class="bref">⏳ ' + esc(moisLong(c.attente.k)) + " : la course avance dès que tout le monde a saisi son relevé (il manque " + c.attente.manquent.map(n => "<b>" + esc(n) + "</b>").join(" et ") + ").</div>" : "";
  const titreAt = at ? '<div class="gp-atouts"><span class="at" data-bdg="' + esc("Atout de " + G.ville + " : " + at.atout.ico + " " + at.atout.nom + " y gagne +1 quand elle marque (sauf bouchon).") + '">' + at.atout.ico + " " + esc(at.atout.nom) + " +1</span></div>" : (indiceCircuit(kGP) ? htmlIndice(indiceCircuit(kGP)) : "");
  return versStand + att + '<div class="gp-h"><div><span class="s-k">' + (c.chauffe ? "Tour de chauffe" : et.avenir ? "Manche " + i + " · sur la grille" : et.k ? "Manche " + i : "Départ") + " · " + esc(moisLong(kGP)) + '</span><h3 class="gp-titre">' + G.drap + " " + esc(G.gp) + '</h3><p class="gp-met">' + esc(G.ville) + " · " + met.ico + " " + esc(met.txt) + (spe ? " " + spe.ico + " <b>" + esc(spe.nom) + "</b> : " + esc(spe.txt) : "") + '</p></div><button class="btn ghost gp-rejouer" type="button" id="gp-rejouer">▶ Rejouer</button></div>' +
    titreAt + piste + chips + '<div class="gp-liste">' + lignes + "</div>" + (et.m ? '<button class="btn ghost gp-carte" type="button" id="gp-carte">📸 Carte postale · ' + esc(moisLong(et.k)) + "</button>" : "") + cal +
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
    (regleVisible("circuits") || ch ? "" : '<p class="info" style="padding:8px 12px;margin:0">🎁 Bientôt : chaque circuit aura son atout.</p>') + "</details>";
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
    const interdite = !!kOuvert && cd.id === "turbo" && (piegeMois(y, kOuvert) || {}).id === "chaleur" && regleVisible("pieges");
    if (interdite) return '<button type="button" class="carte jouee" disabled data-carte="turbo"><span class="c-ico">' + icoOu(cd.id, cd.ico) + "</span><b>" + esc(cd.nom) + "</b><small>" + esc(cd.court) + "</small><em>🌡️ interdite (Surchauffe)</em></button>";
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
  const fermeture = !kOuvert ? '<p class="c-ferme">🔒 ' + (estChauffe(y) ? "Les cartes du tour de chauffe se posaient jusqu'au 5 décembre. Celles de janvier se posent dans l'onglet Saison 1, du 20 décembre au 1er janvier." + (moisCarteOuvert() === (SAISON.premiere * 100 + 1) ? ' <button class="lien" type="button" data-saison="' + SAISON.premiere + '">Poser ma carte de janvier ›</button>' : "") : moisCarteOuvert() ? "La fenêtre ouverte concerne une autre saison : change d'onglet en haut." : "Fenêtre fermée. Prochaine ouverture le " + esc(pf.du) + ", pour " + esc(moisLong(pf.k)) + ".") + "</p>" : "";
  return '<div><h3 class="s-h3">Mes cartes <small>' + reste + " en main" + (regleVisible("pioche") ? " · " + aVenir + " dans la pioche" : "") + "</small></h3></div>" +
    '<p class="info">Touche une carte pour la poser. Une par mois ; une carte de base se rejoue, mais pas deux mois de suite. Une carte bonus ne sert qu\'une fois.' + (regleVisible("pioche") ? (regleVisible("niveaux") ? " Tu en pioches une nouvelle à chaque niveau gagné et quand tu finis dernier d\'un mois." : " Tu en pioches une nouvelle quand tu finis dernier d\'un mois.") : "") + (ap ? " Aperçu : choisis le mois avec les puces ci-dessous ; rien n'est envoyé." : "") + "</p>" +
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
function assurerRappel(vue) {
  if (!vue || !VUES_RAPPEL.includes(vue.id)) return;
  if (podiumCache()) { const ici0 = vue.querySelector(":scope > .rappel"); if (ici0) ici0.remove(); return; }
  const r = rappelCartes(), masque = false;   // V15.1 : plus de « rappelle-moi demain » : le rappel reste tant que ce n'est pas fait
  const ici = vue.querySelector(":scope > .rappel");
  if (!r || masque) { if (ici) ici.remove(); return; }
  const cle = r.k + "-" + r.j; if (ici && ici.dataset.cle === cle) return;
  if (ici) ici.remove();
  vue.insertAdjacentHTML("afterbegin", '<div class="rappel' + (r.j <= 1 ? " urgent" : "") + '" data-cle="' + cle + '" role="status"><span class="rp-i">🃏</span><div class="rp-t"><b>' + (r.carte && r.prono ? "Ta carte et ton pronostic" : r.carte ? "Ta carte" : "Ton pronostic") + " de " + esc(moisLong(r.k).replace(/ \d{4}$/, "")) + "</b><small>" +
    (r.j <= 1 ? "Dernier jour : la fenêtre se ferme ce soir." : "Fenêtre ouverte · il te reste " + r.j + " jours.") + (regleVisible("duels") && regleActive("duels", r.k) ? " Un duel aussi, si tu veux." : "") + '</small></div><button class="btn acc rp-go" type="button">Y aller</button>' +
    "</div>");
  const el = vue.querySelector(":scope > .rappel");
  el.querySelector(".rp-go").addEventListener("click", allerAuStand);
  const x = el.querySelector(".rp-x"); if (x) x.addEventListener("click", () => { stock.set("versus.rappelMasque", String(aujNum())); majRappels(); toast("D'accord, je te le rappelle demain."); });
}
/** V15.1 : avant l'annonce du 21 novembre 2026, rien du Podium dans les onglets Classement, Mois et Moi (pas de spoil) ; l'onglet Podium garde son teaser */
function podiumCache() { return aujNum() < 20261121 && !apercuSaison(); }   // l'admin en « Tout afficher » voit tout
/** Bandeaux de toutes les vues + pastille sur l'onglet Podium */
function majRappels() {
  VUES_RAPPEL.forEach(id => assurerRappel(document.getElementById(id)));
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
  const n = nouveautesAVoir(); if (n.length && stock.get("versus.tuto1")) ouvrirNouveautes(n);
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
function htmlStand(y) {
  const qui = moiPilote();
  if (!qui || !D.personnes.some(p => p.nom === qui)) return '<div class="vide">Choisis ton nom dans les réglages pour jouer.</div>';
  const k = kCartes(y), ap = apercuSaison(), pf = prochaineFenetre();
  let etat;
  if (k) {
    const c = carteDe(y, qui, k), d = duelDe(y, qui, k), j = ap ? null : joursRestants(k);
    etat = '<div class="st-etat ouvert"><div class="st-h"><span class="st-feu"></span><b>Fenêtre ouverte<small>pour ' + esc(moisLong(k)) + "</small></b>" + (j !== null ? "<em>" + (j <= 1 ? "dernier jour" : "il reste " + j + " jours") + "</em>" : "<em>aperçu</em>") + "</div>" +
      '<div class="st-check"><span class="' + (c && c.c ? "ok" : "") + '">' + (c && c.c ? "✓ Carte posée" : "🃏 Carte à poser") + "</span>" + (regleVisible("duels") && regleActive("duels", k) ? '<span class="' + (d && d.cible ? "ok" : "") + '">' + (d && d.cible ? "✓ Duel lancé" : "⚔️ Duel (facultatif)") + "</span>" : "") + "</div>" +
      "<small>Jusqu'au " + (k === CHAUFFE_K ? "5" : "1<sup>er</sup>") + " " + esc(moisLong(k).replace(/ \d{4}$/, "")) + " inclus. Tout reste caché jusqu'à la révélation, le " + jourLimite(k) + ".</small>" + htmlGPStand(k) + "</div>";
  } else {
    const autre = moisCarteOuvert();
    const d = new Date(), kc = d.getFullYear() * 100 + d.getMonth() + 1, revele = d.getDate() >= jourLimite(kc) && Math.floor(kc / 100) === y && regleActive("duels", kc);
    const recus = revele ? D.personnes.map(p => p.nom).filter(n => n !== qui && ((duelDe(y, n, kc) || {}).cible === qui)) : [];
    const paris = d.getDate() >= jourLimite(kc) && Math.floor(kc / 100) === y ? D.personnes.map(p => p.nom).filter(n => { const c = n !== qui && carteDe(y, n, kc); return c && c.c === "pari" && c.cible === qui && !c.cache; }) : [];
    etat = '<div class="st-etat"><div class="st-h"><span class="st-feu ferme"></span><b>Fenêtre fermée</b></div>' +
      (recus.length ? '<p class="duel-recu">⚔️ ' + recus.map(esc).join(" et ") + " t'" + (recus.length > 1 ? "ont" : "a") + " défié pour " + esc(moisLong(kc)) + " : le meilleur du mois prend 1 point à l'autre.</p>" : "") +
      (paris.length ? '<p class="duel-recu">🎲 ' + paris.map(esc).join(" et ") + " t'" + (paris.length > 1 ? "ont" : "a") + " lancé un Pari pour " + esc(moisLong(kc)) + " : finis devant et " + (paris.length > 1 ? "ils perdent" : "il perd") + " 1 point ; sinon, +3 pour " + (paris.length > 1 ? "eux" : "lui") + ".</p>" : "") + "<small>" +
      (estChauffe(y) ? "Les cartes du tour de chauffe se posaient jusqu'au 5 décembre." + (autre ? ' <button class="lien" type="button" data-saison="' + SAISON.premiere + '">Poser ma carte de janvier ›</button>' : " Celles de janvier se poseront du 20 décembre au 1<sup>er</sup> janvier.")
        : autre ? 'La fenêtre ouverte concerne une autre saison : <button class="lien" type="button" data-saison="' + (autre === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(autre / 100)) + '">y aller ›</button>'
        : "Prochaine ouverture le <b>" + esc(pf.du) + "</b>, pour " + esc(moisLong(pf.k)) + ". En attendant, prépare ta stratégie : ta main est ci-dessous.") + "</small></div>";
  }
  const kRm = k || (m => m && Math.floor(m / 100) === y ? m : null)(moisAMettreEnAvant());
  return etat + htmlReglesMois(y, kRm) + htmlCartes(y) + (regleVisible("niveaux") ? '<div><h3 class="s-h3">' + (regleVisible("atelier") ? "Atelier <small>niveau d\'écurie et améliorations</small>" : "Niveau d\'écurie") + "</h3></div>" + htmlAtelier(qui) : "") + htmlProchainement() +
    '<p class="info">Le Stand regroupe tout ce qui se joue. La Course montre la course, l\'Écurie ton look. <a href="#" class="lien-regles" data-regles="cartes">Règles des cartes</a></p>';
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
    pops: el("[data-pop]", e => ({ n: e.dataset.pop })), zones: el("[data-zone]", e => ({ z: e.dataset.zone })), tour: pi.querySelector("#gp-tour"), tourv: null };
  return GP_ETQ;
}
function poser1(o, op, tr) { if (o.op !== op) { o.e.style.opacity = op; o.op = op; } if (tr !== null && o.tr !== tr) { o.e.style.transform = tr; o.tr = tr; } }
function etiquettesGP(api) {
  const pi = document.getElementById("gp-piste"); if (!pi) return;
  const C = cacheEtq(pi), cur = api.courant(), ordre = Object.keys(cur).sort((a, b) => cur[b] - cur[a]), pos = [];
  const H = api.taille ? api.taille().h : 400;
  C.tags.forEach(o => {
    const r = 1 + ordre.filter(m => cur[m] > (cur[o.n] || 0) + 1e-9).length; if (o.rg && o.rgv !== r) { o.rg.textContent = r; o.rgv = r; }   // V16.18 : ex æquo = même rang
    const e = api.ecran(o.n); if (!e || e.vis === false) { poser1(o, "0", null); return; }
    pos.push({ o, n: o.n, x: e.x, y: e.y });
  });
  // deux étiquettes qui se chevauchent : la seconde monte d'un cran
  pos.sort((a, b) => b.y - a.y).forEach((p, i) => { for (let j = 0; j < i; j++) { const q = pos[j]; if (Math.abs(q.x - p.x) < 30 && Math.abs(q.y - p.y) < 32) p.y = Math.min(p.y, q.y - 32); } });
  pos.forEach(p => { if (p.y < 44 && !C.plein) { poser1(p.o, "0", null); p.y = -99; return; } poser1(p.o, "", "translate3d(" + p.x.toFixed(0) + "px," + Math.min(p.y, H - 4).toFixed(0) + "px,0) translate(-50%,-100%)"); });
  C.pops.forEach(o => { const p = pos.find(q => q.n === o.n); if (!p || p.y < 0) { poser1(o, "0", null); return; } poser1(o, "", "translate3d(" + p.x.toFixed(0) + "px," + (p.y - 36).toFixed(0) + "px,0) translate(-50%,-100%)"); });
  C.zones.forEach(o => { const zz = api.zones && api.zones[o.z], e = zz && api.ecranMonde((zz.s0 + zz.s1) / 2, 0, 5);
    if (!e || e.vis === false) { poser1(o, "0", null); return; } poser1(o, "", "translate3d(" + e.x.toFixed(0) + "px," + e.y.toFixed(0) + "px,0) translate(-50%,-50%)"); });
  { const h = pi.querySelector(".gp-tour"); if (h) { if (GP_SCEN && api.enCours()) { const tr = Math.min(TOURS_GP, Math.floor(Math.max(0, ...Object.values(cur))) + 1); if (h.dataset.tr !== String(tr)) { if (!h.dataset.orig) h.dataset.orig = h.innerHTML; h.innerHTML = "Tour <b>" + tr + "</b>/" + TOURS_GP; h.dataset.tr = tr; } } else if (h.dataset.orig) { h.innerHTML = h.dataset.orig; delete h.dataset.orig; delete h.dataset.tr; } } }   // v16.28
  if (api.enCours() && C.tour) { const v = Math.floor(Math.max(0, ...Object.values(cur)) / TOUR_GP) + 1; if (v !== C.tourv) { C.tour.textContent = v; C.tourv = v; } }
  if (GP_PLEIN) majTourPlein(cur);
}
/** Ce que chacun a marqué ce mois-ci, en bulles au-dessus des voitures, à l'arrivée */
function bullesGP(y, i) {
  const pi = document.getElementById("gp-piste"), et = etapesGP(y)[i]; if (!pi || !et || !et.m) return;
  const box = pi.querySelector(".gp-pops"); if (!box) return; box.innerHTML = "";
  et.m.l.forEach(x => {
    const extra = [];
    if (x.carte && !x.carte.invalide && x.carte.gain) { const cd = carteDef(x.carte.id); extra.push((cd ? cd.ico : "🃏") + (x.carte.gain > 0 ? "+" : "") + x.carte.gain); }
    if (x.bonus) extra.push("🎯+" + x.bonus); if (x.mult > 1) extra.push("×2"); if (x.vainq) extra.push("🇬🇧+2"); if (x.equipe) extra.push("🤝+1"); if (x.serie) extra.push("🔥+1"); if (x.defi) extra.push("🏁+1"); if (x.prono && x.prono.pts) extra.push("🔮+" + x.prono.pts); if (x.rival) extra.push("😈+3"); if (x.regul !== undefined) extra.push("🛡️+3");
    box.insertAdjacentHTML("beforeend", '<span class="gp-pop" data-pop="' + esc(x.nom) + '" style="--c:' + couleur(x.nom) + '"><b>' + (x.p >= 0 ? "+" : "") + x.p + " pt" + (Math.abs(x.p) > 1 ? "s" : "") + "</b>" + (extra.length ? "<small>" + esc(extra.join(" ")) + "</small>" : "") + "</span>");
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
function scenarioCourse(mc) {
  const noms = mc.grille.slice(), G = mc.arrivee, maxG = Math.max(0, ...noms.map(n => G[n] || 0)), gap = .006;
  const fin = {}; noms.forEach((n, g) => fin[n] = maxG > 0 ? (maxG - (G[n] || 0)) / maxG * .3 : g * gap);
  const lisse = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const course = e => (e < .1 ? e * e / .2 : e - .05) / .95 * TOURS_GP;   // départ qui accélère, puis pleine vitesse
  const temps = w => w < .74 ? w / .74 * .8 : w < .88 ? .8 + (w - .74) / .14 * .08 : .88 + (w - .88) / .12 * .12;   // ralenti au cœur du dernier tour
  const scen = w => { const e = temps(clampN(w, 0, 1)), D = course(e), m = lisse((e - E_TOUR[TOURS_GP - 1]) / (.92 - E_TOUR[TOURS_GP - 1])), out = {};
    noms.forEach((n, g) => { out[n] = D - (g * gap * (1 - m) + fin[n] * m) + Math.sin(e * 22 + g * 1.7) * .0016 * (1 - m); }); return out; };
  return { scen, gains: G, noms };
}
function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }
/* ---------- V16.18 · Le décompte des points d'un pilote : « 4 place + 1 🎯 + 2 🎲 = 7 » ---------- */
function decompte(x, spec) {
  const l = [(x.mult > 1 ? x.base + "×2" : String(x.base)) + " de place"], add = (v, t) => { if (v) l.push((v > 0 ? "+ " : "− ") + Math.abs(v) + " " + t); };
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
  const chg = av[0] !== ap[0] ? "👑 " + ap[0] + " prend la tête du championnat !" : null;
  const fin = (v ? "🏁 " + v.nom + " remporte la manche (+" + v.p + " pts)" + (v.bonus ? ", et bat l'indice 🎯" : "") + "." : "🏁 Arrivée !") + (chg ? " " + chg : "");
  return { debut, milieu: milieu.slice(0, 2).map(z => z.t), fin };
}
function commenter(y, i, duree, delai) {
  GP_COM.forEach(clearTimeout); GP_COM = [];
  const box = document.querySelector("#gp-piste .gp-com"); if (!box) return; const P = phrasesCourse(y, i); if (!P) { box.innerHTML = ""; return; }
  const dire = (t, dur) => { const b = document.querySelector("#gp-piste .gp-com"); if (!b) return; b.innerHTML = '<span class="gp-com-t">' + esc(t) + "</span>"; if (dur) GP_COM.push(setTimeout(() => { const bb = document.querySelector("#gp-piste .gp-com"); if (bb) bb.innerHTML = ""; }, dur)); };
  if (duree < 0) { dire(P.fin, 7000); return; }
  const d0 = delai || 0, n = duree - d0;
  if (GP_SCEN) { const l = [[0, P.debut[0]], [.24, P.milieu[0]], [W_TOUR[1], "🏁 Dernier tour !" + (P.milieu[1] ? " · " + P.milieu[1] : "")]].filter(x => x[1]);
    l.forEach(([w, t]) => GP_COM.push(setTimeout(() => dire(t, 0), d0 + w * n + 150))); return; }
  const l = P.debut.concat(P.milieu);
  l.forEach((t, k) => GP_COM.push(setTimeout(() => dire(t, 0), d0 + k * n / Math.max(1, l.length) + 150)));
}
/* ---------- 🎬 V16.12 · Bande-annonce avant la course : « Précédemment… », le circuit en grand, la grille, les feux ---------- */
const BA_STYLE = {   // couleurs et police de chaque circuit (la bande-annonce prend le ton de l'univers)
  abudhabi: ["#FF9A3D", "#FFE2B0", "sans"], bahrein: ["#B8FF8A", "#FFF2B0", "serif"], djeddah: ["#E2B93B", "#F3E6C4", "serif"], melbourne: ["#FF6FA8", "#FFFFFF", "serif"],
  suzuka: ["#E2B93B", "#F4EAD2", "serif"], miami: ["#FF8A2A", "#F7CF55", "sans"], montreal: ["#FFE81F", "#FFFFFF", "sans"], silverstone: ["#FF8A3D", "#F6D29A", "large"],
  spa: ["#FF2A2A", "#FFFFFF", "serif"], monza: ["#E5484D", "#F7CF55", "sans"], singapour: ["#FF8FB8", "#F7CF55", "serif"], interlagos: ["#C8102E", "#F4F1EA", "sans"], lasvegas: ["#3ED6E0", "#FFFFFF", "serif"] };
let BA_OUVERTE = null;
function bandeAnnonce(y, i, ensuite) {
  if (BA_OUVERTE) BA_OUVERTE.fermer(false);
  const etapes = etapesGP(y), et = etapes[i], c = championnat(y), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), G = GPS[ci];
  const st = BA_STYLE[ci] || ["#9B87FF", "#FFFFFF", "sans"], img = window.Piste && Piste.carte ? Piste.carte(ci) : null, mc = mancheGP(etapes, i);
  // « Précédemment… » : les vainqueurs des 3 derniers mois (jamais le résultat du mois qu'on va voir)
  const prec = []; for (let j = i - 1; j >= 1 && prec.length < 3; j--) { const m = etapes[j].m; if (!m) continue; const x = m.l.slice().sort((a, b) => a.rg - b.rg)[0]; if (x) prec.unshift({ k: m.k, g: GPS[circuitDe(m.k)], n: x.nom, p: x.p }); }
  const resume = prec.length ? prec.map((r, q) => '<div class="ba-r" style="--d:' + (1.7 + q * .7).toFixed(1) + 's"><span>' + r.g.drap + " " + esc(moisLong(r.k).replace(/ \d{4}$/, "")) + "</span><b style=\"color:" + couleur(r.n) + '">' + esc(r.n) + "</b> s'impose <i>+" + r.p + " pts</i></div>").join("")
    : '<div class="ba-r" style="--d:1.7s"><span>' + (c.chauffe ? "Tour de chauffe" : "Manche 1") + "</span><b>Une nouvelle saison commence.</b></div>";
  const grille = mc.grille.map((n, q) => '<span class="ba-g" style="--d:' + (8.1 + q * .18).toFixed(2) + 's;--c:' + couleur(n) + '">' + avatar(n) + "<small>" + (q + 1) + "</small></span>").join("");
  // le mois spécial ou le piège du circuit, annoncé sous le titre (ex. 🌑 Le Côté obscur, 🍫 Double tablette)
  const spe = et.k ? moisSpecial(y, et.k) : null, pg = !spe && et.k && typeof piegeMois === "function" ? piegeMois(y, et.k) : null, regle = spe || pg;
  const ligneRegle = regle ? '<div class="ba-regle"><b>' + regle.ico + " " + esc(regle.nom) + "</b><small>" + esc(regle.txt) + "</small></div>" : "";
  const o = document.createElement("div"); o.className = "ba ba-" + st[2]; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Bande-annonce : " + G.gp);
  o.style.setProperty("--b1", st[0]); o.style.setProperty("--b2", st[1]);
  o.innerHTML = '<div class="ba-fond"' + (img ? ' style="background-image:url(&quot;' + img.replace(/"/g, "%22") + '&quot;)"' : "") + '></div><div class="ba-voile"></div>' +
    '<div class="ba-sc ba-s1"><small>VERSUS</small><b>présente</b></div>' +
    '<div class="ba-sc ba-s2"><em>Précédemment…</em>' + resume + "</div>" +
    '<div class="ba-sc ba-s3"><span class="ba-k">' + esc(et.avenir ? "Ce mois-ci" : moisLong(kGP)) + '</span><h2><span class="ba-drap">' + G.drap + "</span>" + esc(G.gp) + "</h2><p>" + esc(G.ville) + '</p><q>' + esc(G.txt) + "</q>" + ligneRegle + "</div>" +
    '<div class="ba-sc ba-s4"><em>Sur la grille</em><div class="ba-gr">' + grille + '</div><p>En pole : <b style="color:' + couleur(mc.grille[0]) + '">' + esc(mc.grille[0]) + "</b></p></div>" +
    '<div class="ba-sc ba-s5"><div class="ba-feux">' + [0, 1, 2, 3, 4].map(q => '<i style="--d:' + (10.4 + q * .32).toFixed(2) + 's"></i>').join("") + "</div><b>" + (ensuite ? "C'est parti !" : et.avenir ? "Rendez-vous à la fin du mois" : "Rendez-vous au premier départ") + "</b></div>" +
    '<div class="ba-bande h"></div><div class="ba-bande b"></div><button class="ba-passer" type="button">Passer ›</button>';
  document.body.appendChild(o);
  // V16.16 : seul « Passer » (ou Échap / retour) ferme ; si l'appli passe en arrière-plan, la bande-annonce se met en pause
  const pause3d = b => { try { if (GP_INST && GP_INST.api.pause) GP_INST.api.pause(b); } catch (e) { } }; pause3d(true);   // V16.17 : la 3D ne tourne pas sous la bande-annonce
  if (window.SONS && !reduit) SONS.feuxBA(10400, 320);   // V16.43 : les 5 feux sonnent avec l'image
  let fini = false, restant = reduit ? 2500 : 12800, debut = performance.now(), t = setTimeout(() => fermer(true), restant);
  const visib = () => { if (fini) return; if (document.visibilityState === "hidden") { clearTimeout(t); restant -= performance.now() - debut; o.classList.add("pause"); } else if (o.classList.contains("pause")) { debut = performance.now(); o.classList.remove("pause"); t = setTimeout(() => fermer(true), Math.max(300, restant)); } };
  const clavier = e => { if (e.key === "Escape") fermer(true); };
  document.addEventListener("visibilitychange", visib); document.addEventListener("keydown", clavier);
  function fermer(lancer) { if (fini) return; fini = true; clearTimeout(t); document.removeEventListener("visibilitychange", visib); document.removeEventListener("keydown", clavier); BA_OUVERTE = null; pause3d(false); o.classList.add("fin"); setTimeout(() => o.remove(), 450); if (lancer && ensuite) setTimeout(ensuite, 250); }
  o.querySelector(".ba-passer").addEventListener("click", e => { e.stopPropagation(); fermer(true); });
  BA_OUVERTE = { fermer };
}
function brancherGP(v, y) {
  const etapes = etapesGP(y), i = GP_ETAPE !== null && GP_ETAPE < etapes.length ? GP_ETAPE : etapeParDefaut(etapes, y), et = etapes[i];
  const pi = v.querySelector("#gp-piste"), scene = v.querySelector("#gp-scene"); if (!pi || !scene) return;
  if (!window.Piste) { scene.innerHTML = '<p class="gp-nopiste">Circuit indisponible : recharge l\'appli.</p>'; return; }
  const c = championnat(y), kGP = et.k || (c.chauffe ? CHAUFFE_K : y * 100 + 1), ci = circuitDe(kGP), deux = pi.classList.contains("en2d"), qui = quiEcurie();
  const amb = (equipDe(qui) || {}).circuit || "classique", met = meteoMois(et.k).id, at = atoutsVus(kGP), vs = voituresGP();
  const cle = [ci, met, amb, deux ? "2d" : "3d", JSON.stringify(vs), at ? at.atout.id : "", couleurAccent()].join("|");
  if (GP_INST && GP_INST.cle === cle) { scene.appendChild(GP_INST.boite); GP_INST.api.redim(); }
  else {
    if (GP_INST) { try { GP_INST.api.detruire(); } catch (e) { } GP_INST.boite.remove(); GP_INST = null; }
    const boite = document.createElement("div"); boite.className = "gp-rendu"; scene.appendChild(boite);
    const focus = ETAT.gpFocus && D.personnes.some(p => p.nom === ETAT.gpFocus) ? ETAT.gpFocus : (qui && D.personnes.some(p => p.nom === qui) ? qui : D.personnes[0].nom);
    const api = Piste.monter(boite, { circuit: ci, meteo: met, ambiance: amb, mode: deux ? "2d" : "3d", camera: camGP(), tour: TOUR_GP, voitures: vs, pts: et.pts, focus,
      atoutCol: at ? "#3DDC97" : null, piegeCol: null, accent: couleurAccent(), titre: GPS[ci].gp + ", " + GPS[ci].ville, portrait: n => avatar(n, Object.assign({}, equipDe(n), { skin: (Piste.TRACES[ci] || {}).peint })),   // V16.35 : sa tête + l'accessoire du thème
      image: etiquettesGP, toucher: n => { ETAT.gpFocus = n; garder(); if (GP_INST) GP_INST.api.focus(n); if (camGP() === "helico" && GP_INST && GP_INST.api.type === "3d") { ETAT.gpCam = "tv"; garder(); GP_INST.api.camera("tv"); majBoutonsGP(); } toast("🎥 La caméra suit " + n + "."); },
      perdu: () => { if (GP_INST && GP_INST.boite === boite) GP_INST = null; } });
    GP_INST = { cle, api, boite };
    if (api.type === "2d" && !deux) { pi.classList.add("en2d"); const cb = pi.querySelector("#gp-cam-b"); if (cb) cb.remove(); }
  }
  // V16.10 · une manche par mois : grille de départ dans l'ordre du classement d'avant le mois ; le meilleur du mois boucle exactement un tour
  const api = GP_INST.api, mc = mancheGP(etapes, i), SC = i > 0 && !et.avenir && et.m && api.jouerScenario ? scenarioCourse(mc) : null; GP_SCEN = SC;
  if (api.regler) api.regler({ tour: SC ? 1 : mc.tour, grille: mc.grille });   // v16.28 : en course scénarisée, les distances sont en tours
  const pDep = SC ? SC.scen(0) : mc.depart, pArr = SC ? SC.scen(1) : mc.arrivee;
  const cleVu = "versus.gpVu." + y, vu = +(stock.get(cleVu) || 0);
  // V16.16 : la manche n'est marquée « vue » qu'à l'arrivée (quitter pendant la bande-annonce ou la course ne la fait plus perdre)
  // V16.17 : un seul départ — après la bande-annonce (qui finit sur les 5 feux), la course part sans refaire les feux
  const finCourse = () => { if (window.SONS && et.m) { const v1 = et.m.l.slice().sort((a, b) => a.rg - b.rg)[0]; if (v1) SONS.arrivee(saisonVisible() && !estChauffe(y) ? equipDe(v1.nom).klaxon : "fanfare", v1.nom === ETAT.moi); }   // V16.43 : la foule et le klaxon du vainqueur
    if (et.k && !et.avenir && et.k > +(stock.get(cleVu) || 0)) stock.set(cleVu, String(et.k)); bullesGP(y, i); commenter(y, i, -1); };
  const jouer = feux => { const f = feux !== false && i >= 1 && api.type === "3d", d = SC ? (api.type === "3d" ? 16000 : 11000) : api.type === "3d" ? 6400 : 3000; commenter(y, i, d + (f ? 3200 : 0), f ? 3200 : 0); if (window.SONS) SONS.course(d, f ? 3200 : 0);   // V16.43 : feux, moteurs
    if (SC) api.jouerScenario(SC.scen, d, finCourse, f); else api.jouer(mc.depart, mc.arrivee, d, finCourse, f); };
  const apresBA = () => { if (GP_INST && GP_INST.api === api && document.body.contains(GP_INST.boite)) jouer(false); };   // v16.27 : piste reconstruite entre-temps : on ne lance rien
  if (GP_REJOUER && i > 0 && !et.avenir) { GP_REJOUER = false; setTimeout(jouer, 150); }
  else if (!et.avenir && et.k && et.k > vu && i > 0) { api.placer(pDep); if (!BA_OUVERTE) setTimeout(() => { if (!BA_OUVERTE) bandeAnnonce(y, i, apresBA); }, 300); }
  else { if (!api.enCours()) api.placer(pArr); const kBA = et.k || 0, cleBA = "versus.baVu." + y; if (et.avenir && kBA && kBA > +(stock.get(cleBA) || 0)) { stock.set(cleBA, String(kBA)); setTimeout(() => bandeAnnonce(y, i, null), 400); } }
  GP_REJOUER = false;
  const vu3 = v.querySelector("#gp-vue"); if (vu3) vu3.addEventListener("click", () => { ETAT.gp2d = pi.classList.contains("en2d") ? "0" : "1"; garder(); rendreTrophees(); });
  const cb = v.querySelector("#gp-cam-b"); if (cb) cb.addEventListener("click", () => { const l = ["tv", "helico", "bord"], n = l[(l.indexOf(camGP()) + 1) % l.length]; ETAT.gpCam = n; garder(); if (GP_INST) GP_INST.api.camera(n); majBoutonsGP(); });
  const rj = v.querySelector("#gp-rejouer"); if (rj) rj.addEventListener("click", () => { if (i > 0 && !et.avenir) jouer(); else toast(et.avenir ? "Cette manche se court ce mois-ci : la course se joue dès que tout le monde a saisi son relevé." : "Le départ n'a pas encore eu lieu : choisis un mois."); });
  const fb = v.querySelector("#gp-fin"); if (fb) fb.addEventListener("click", () => { if (api.enCours()) { api.placer(pArr); finCourse(); } else toast(i > 0 && !et.avenir ? "La course est déjà arrivée : ↻ Rejouer pour la revoir." : "Pas encore de course pour ce mois-ci."); });
  const pl = v.querySelector("#gp-plein"); if (pl) pl.addEventListener("click", () => ouvrirPleinGP(y));
  const bb = v.querySelector("#gp-ba"); if (bb) bb.addEventListener("click", () => { const j = i > 0 && !et.avenir; if (j) api.placer(pDep); bandeAnnonce(y, i, j ? apresBA : null); });
  const cp = v.querySelector("#gp-carte"); if (cp) cp.addEventListener("click", () => cartePostale(y, et));
  v.querySelectorAll(".gp-mois [data-gpe]").forEach(b => b.addEventListener("click", () => { GP_ETAPE = +b.dataset.gpe; GP_REJOUER = true; rendreTrophees(); }));
  const cal = v.querySelector("#gp-calend"); if (cal) cal.addEventListener("toggle", () => { ETAT.calOuvert = cal.open ? "1" : "0"; garder(); });
  GP_ETQ = null;
  if (GP_PLEIN) placerPlein(y);
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
  o.innerHTML = '<div class="gpp-corps"></div><div class="gpp-h"><div class="gpp-t"></div><button class="gpp-x gpp-rj" type="button" aria-label="Rejouer la course">↻ Rejouer</button><button class="gpp-x" type="button" aria-label="Fermer le plein écran">✕</button></div><div class="gpp-tour"></div><div class="gpp-mois"></div>';
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  GP_PLEIN = { o, y, ancre: null, maj: 0 };
  o.querySelector('.gpp-x:not(.gpp-rj)').addEventListener("click", fermerPleinGP);
  // V15.6 : rejouer la course sans quitter le plein écran (même action que « Rejouer » sous la piste)
  o.querySelector(".gpp-rj").addEventListener("click", () => { const rj = document.getElementById("gp-rejouer"); if (rj) rj.click(); else toast("Choisis d'abord un mois couru."); });
  GP_PLEIN.esc = e => { if (e.key === "Escape") fermerPleinGP(); }; document.addEventListener("keydown", GP_PLEIN.esc);
  placerPlein(y);
}
function placerPlein(y) {
  const P = GP_PLEIN; if (!P) return;
  const pi = document.querySelector(".saison #gp-piste") || document.getElementById("gp-piste"); if (!pi) { fermerPleinGP(); return; }
  const corps = P.o.querySelector(".gpp-corps");
  if (pi.parentNode !== corps) {
    corps.querySelectorAll(".gp-piste").forEach(x => x.remove());
    P.ancre = document.createElement("div"); P.ancre.className = "gp-ancre"; pi.parentNode.insertBefore(P.ancre, pi); corps.appendChild(pi);
  }
  const h = document.querySelector(".saison .gp-h"), t = h ? h.querySelector(".gp-titre") : null, k = h ? h.querySelector(".s-k") : null;
  P.o.querySelector(".gpp-t").innerHTML = "<b>" + (t ? t.innerHTML : "") + "</b><small>" + (k ? k.innerHTML : "") + "</small>";
  const ch = document.querySelector(".saison .gp-mois"); P.o.querySelector(".gpp-mois").innerHTML = ch ? ch.outerHTML : "";
  P.o.querySelectorAll(".gpp-mois [data-gpe]").forEach(b => b.addEventListener("click", () => { GP_ETAPE = +b.dataset.gpe; GP_REJOUER = true; rendreTrophees(); }));
  const sel = P.o.querySelector('.gpp-mois [aria-pressed="true"]'); if (sel) sel.scrollIntoView({ inline: "center", block: "nearest" });
  GP_ETQ = null;
  if (GP_INST) { GP_INST.api.redim(); majTourPlein(GP_INST.api.courant(), true); }
}
function majTourPlein(cur, force) {
  const P = GP_PLEIN; if (!P) return; const now = performance.now(); if (!force && now - P.maj < 150) return; P.maj = now;
  const qui = quiEcurie(), ordre = Object.keys(cur).sort((a, b) => cur[b] - cur[a]), t = cur[ordre[0]] || 0, box = P.o.querySelector(".gpp-tour");
  if (force || !P.lignes || P.lignes.cle !== ordre.slice().sort().join("|")) {
    box.innerHTML = Object.keys(cur).map(n => '<div class="r' + (n === qui ? " ici" : "") + '" data-tr="' + esc(n) + '" style="--c:' + couleur(n) + '"><span class="rk"></span>' + avatar(n) + '<span class="n">' + esc(n) + '</span><span class="p"><b></b><small></small></span></div>').join("");
    P.lignes = { cle: ordre.slice().sort().join("|"), m: {} }; box.querySelectorAll("[data-tr]").forEach(e => P.lignes.m[e.dataset.tr] = { e, rk: e.querySelector(".rk"), b: e.querySelector(".p b"), s: e.querySelector(".p small"), v: "" });
  }
  const pt = n => GP_SCEN ? Math.round((GP_SCEN.gains[n] || 0) * clampN(cur[n] / TOURS_GP, 0, 1)) : Math.round(cur[n]), pT = GP_SCEN ? Math.max(...ordre.map(pt)) : Math.round(t);   // v16.28
  ordre.forEach((n, r) => { const l = P.lignes.m[n]; if (!l) return; const v = r + "|" + pt(n) + "|" + (pT - pt(n)); if (v === l.v) return; l.v = v;
    l.e.style.order = r; l.rk.textContent = r + 1; l.b.textContent = pt(n); l.s.textContent = r ? "−" + (pT - pt(n)) : "en tête du mois"; });
}
function fermerPleinGP() {
  const P = GP_PLEIN; if (!P) return; GP_PLEIN = null;
  const pi = P.o.querySelector(".gp-piste");
  if (pi && P.ancre && P.ancre.isConnected) P.ancre.replaceWith(pi); else if (P.ancre) P.ancre.remove();
  document.removeEventListener("keydown", P.esc); P.o.remove(); document.documentElement.classList.remove("fige"); GP_ETQ = null;
  if (GP_INST) GP_INST.api.redim();
}

