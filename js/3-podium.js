/* Versus · Podium : saison, cartes, écurie, défis, exclusifs (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   PODIUM · SAISON 1
   Le 1er janvier 2027, tout le monde repart de zéro : championnat à points,
   écurie à personnaliser, défis à débloquer. Ce qui s'est passé avant ne compte pas.
   Jusque-là, les autres voient un teaser ; l'administrateur peut ouvrir un aperçu
   (la saison rejouée sur 2026) pour faire ses retours.
   Tout est recalculé à partir des relevés ; seule l'écurie choisie est stockée (propriété ECURIE).
   Référence fixe : portefeuille total contre le S&P 500, quels que soient les filtres.
   ============================================================ */
// noel : dévoilement détaillé dans le teaser ; chauffe : tour de chauffe de décembre 2026 (tout marche, rien ne compte)
const SAISON = { premiere: 2027, depart: new Date(2027, 0, 1), chauffe: new Date(2026, 11, 1), noel: new Date(2026, 10, 20) };
const CHAUFFE_K = 202612;
function saisonOuverte() { return Date.now() >= SAISON.depart.getTime(); }
function chauffeOuverte() { return Date.now() >= SAISON.chauffe.getTime(); }
function apercuSaison() { return !window.APERCUS_FINIS && !saisonOuverte() && estAdmin() && stock.get("versus.apercuSaison") === "1"; }
function saisonVisible() { return saisonOuverte() || apercuSaison() || chauffeOuverte(); }
/** La « saison » 2026 hors aperçu admin, c'est le tour de chauffe : décembre seul, sans défis, badges ni exclusifs */
function estChauffe(y) { return y === SAISON.premiere - 1 && !apercuSaison(); }
/** V16.22 · pendant le tour de chauffe : seulement les bases (course + cartes) ; écurie, badges, trophées et objets attendent janvier (demande de Théo) */
function basesSeules() { try { return !apercuSaison() && estChauffe(saisonCourante()); } catch (e) { return false; } }
/** Saisons qu'on peut ouvrir dans le Podium : le tour de chauffe (dès le 1er décembre), puis les vraies */
function anneesPodium() {
  if (apercuSaison()) return anneesSaison();
  if (!chauffeOuverte()) return [];
  const l = Date.now() < new Date(SAISON.premiere, 1, 1).getTime() ? [SAISON.premiere - 1] : [];   // la chauffe reste consultable jusqu'à fin janvier
  for (let y = SAISON.premiere; y <= Math.max(SAISON.premiere, new Date(Date.now()).getFullYear()); y++) l.push(y); return l;
}
/** Jour limite (exclu) pour poser une carte ou lancer un duel : le 2, ou le 6 pour le tour de chauffe */
function jourLimite(k) { return k === CHAUFFE_K ? 6 : 2; }
/** Saisons jouées (2027, 2028…) ; en aperçu, une répétition sur 2026 */
function anneesSaison() {
  if (!saisonOuverte()) return apercuSaison() ? [SAISON.premiere - 1] : [];
  const l = []; for (let y = SAISON.premiere; y <= Math.max(SAISON.premiere, new Date(Date.now()).getFullYear()); y++) l.push(y); return l;
}
function numeroSaison(y) { return Math.max(1, y - SAISON.premiere + 1); }

/* ---------- Championnat : 6 / 4 / 2 / 0 point (V15 : le dernier ne marque plus, prendre trop de risque se paie), +1 si le mois bat le S&P 500 ---------- */
const BAREME = [6, 4, 2, 0], BAREME5 = [6, 4, 2, 1, 0];   // V16.20 : à 5 pilotes (Nicolas), le 4e garde 1 point (validé par Théo le 19/11)
function baremeJ(n) { return (n !== undefined ? n : (typeof D !== "undefined" && D && D.personnes ? D.personnes.length : 4)) >= 5 ? BAREME5 : BAREME; }
function ptsRang(r, n) { const b = baremeJ(n); return b[r - 1] !== undefined ? b[r - 1] : 0; }
/* ---------- V15 · Défi du mois : un par mois de l'année, annoncé le 20 du mois d'avant ; +1 à chaque pilote qui le réussit ---------- */
const DEFIS_MOIS = {
  1: { ico: "💻", txt: "Bats le Nasdaq-100", idx: "Nasdaq-100" },
  2: { ico: "📈", txt: "Finis le mois en positif", test: "positif" },
  3: { ico: "🥇", txt: "Fais mieux que l'or", idx: "Or (non couvert)" },
  4: { ico: "🌍", txt: "Bats le MSCI Monde", idx: "MSCI Monde" },
  5: { ico: "🎯", txt: "Bats le S&P 500 d'au moins 1 point", test: "sp1" },
  6: { ico: "🇪🇺", txt: "Fais mieux que l'Euro Stoxx 50", idx: "Euro Stoxx 50" },
  7: { ico: "⏫", txt: "Fais mieux que ton mois de juin", test: "progres" },
  8: { ico: "🌏", txt: "Fais mieux que les marchés émergents", idx: "Marchés émergents" },
  9: { ico: "🛡️", txt: "Ne perds pas plus de 1 %", test: "limite" },
  10: { ico: "⚖️", txt: "Fais mieux que la moyenne des pilotes", test: "moyenne" },
  11: { ico: "🔌", txt: "Fais mieux que les semi-conducteurs", idx: "Semi-conducteurs" },
  12: { ico: "🏆", txt: "Monte sur le podium du mois (top 3)", test: "podium" }
};
function defiDuMois(k) { return k && k !== CHAUFFE_K ? DEFIS_MOIS[k % 100] || null : null; }
function indiceNomMois(nom, k) { const i = D.marche.indices.indexOf(nom), l = i >= 0 ? D.marche.mois.find(x => x[0] === k) : null, v = l ? l[i + 1] : null; return ok(v) ? v : null; }
/** Le pilote x réussit-il le défi du mois k ? (l = tout le mois, prev = mois d'avant, iR = S&P 500 du mois) */
function defiReussi(d, k, x, l, prev, iR) {
  if (!d) return false;
  if (d.idx) { const v = indiceNomMois(d.idx, k); return v !== null && x.r > v + 1e-12; }
  if (d.test === "positif") return x.r > 0;
  if (d.test === "sp1") return iR !== null && x.r > iR + 0.01;
  if (d.test === "progres") { const p = prev && prev.find(z => z.nom === x.nom); return !!p && x.r > p.r + 1e-12; }
  if (d.test === "limite") return x.r >= -0.01;
  if (d.test === "moyenne") return x.r > l.reduce((s, z) => s + z.r, 0) / l.length + 1e-12;
  if (d.test === "podium") return x.rg <= 3;
  return false;
}
function indiceMois(k) { const l = D.marche.mois.find(x => x[0] === k), v = l ? l[iRef() + 1] : null; return ok(v) ? v : null; }
let MEMO_SAISON = { d: null, m: {} };
function championnat(y) {
  if (MEMO_SAISON.d !== D) MEMO_SAISON = { d: D, m: {} };
  if (MEMO_SAISON.m[y]) return MEMO_SAISON.m[y];
  const ch = estChauffe(y), deb = ch ? CHAUFFE_K - 1 : (y - 1) * 100 + 12, f = ch ? CHAUFFE_K : y * 100 + 12;
  const tot = {}; D.personnes.forEach(p => tot[p.nom] = { pts: 0, v: 0, pod: 0, bonus: 0, n: 0, cum: 1 });
  const J = {}; D.personnes.forEach(p => J[p.nom] = { xp: 0, niv: 1, pioche: [], deck: deckBonus(y, p.nom), i: 0 });
  const SERIE = {};
  let prevL = null;
  const ordre = (a, b) => tot[b].pts - tot[a].pts || tot[b].v - tot[a].v || tot[b].cum - tot[a].cum;
  const mois = []; let attente = null;
  moisVerdict(0).filter(k => k > deb && k <= f).forEach(k => {
    const v = verdictMois(0, k);
    if (!v || !v.complet) { if (v) attente = v; return; }
    const PG = ch ? null : piegeMois(y, k), iR = indiceMois(k);   // V15.5 : piège du circuit
    // « Le huit » : les places se jouent sur ce mois et le précédent cumulés ; sinon sur le mois seul
    const rc = x => { if (PG && PG.id === "huit" && prevL) { const p = prevL.find(z => z.nom === x.nom); if (p) return (1 + x.r) * (1 + p.r) - 1; } return x.r; };
    const du = v.du.map(x => Object.assign({}, x, { rc: rc(x) })).sort((a, b) => b.rc - a.rc), n = du.length;
    // places : ex æquo à 1e-9 près ; « Murs proches » : à moins de 0,2 point du pilote juste devant, on partage sa place
    const RG = []; du.forEach((x, i) => { RG[i] = i && du[i - 1].rc - x.rc < (PG && PG.id === "murs" ? 0.002 : 0) + 1e-9 ? RG[i - 1] : i + 1; });
    const rgMax = n ? Math.max(...RG) : 0;
    const avant = mois.length ? mois[mois.length - 1].places : null, cumAvant = mois.length ? mois[mois.length - 1].cumul : null, spec = moisSpecial(y, k);
    const derniers = avant && Object.keys(avant).length >= 2 ? (mx => Object.keys(avant).filter(nm => avant[nm] === mx))(Math.max(...Object.values(avant))) : [];
    const seuil = PG && PG.id === "mirage" ? 0.005 : 0;   // « Mirage » : le 🎯 demande 0,5 point d'avance sur l'indice
    const l = du.map((x, i) => {
      const rg = RG[i], bonus = iR !== null && x.r > iR + seuil + (seuil ? -1e-12 : 0) ? (spec && (spec.id === "monza" || spec.heros) ? 2 : 1) : 0;
      const dernier = n >= 3 && rg > 1 && rg === rgMax;
      const mult = spec && (spec.id === "finale" || spec.id === "monaco" && derniers.includes(x.nom)) ? 2 : 1, base = PG && PG.id === "nuit" && dernier ? 2 : ptsRang(rg, n), vainq = spec && spec.id === "silverstone" && rg === 1 ? 2 : 0;
      return { nom: x.nom, r: x.r, rg, base, mult, vainq, p: base * mult + bonus + vainq, bonus, dernier, ecart: rg === 1 && n > 1 ? x.rc - du[1].rc : null, niv: J[x.nom] ? J[x.nom].niv : 1, piege: PG ? PG.id : undefined };
    });
    // cartes révélées (main de base et pioche bonus), plafonnées à +4
    const atM = ch ? null : atoutsDe(k);
    l.forEach(x => {
      const c = carteDe(y, x.nom, k); if (!c || !c.c) return;
      const def = carteDef(c.c), j = J[x.nom]; if (!def || !j) return;
      if (def.bonus && (!regleActive("pioche", k) || !j.pioche.some(z => z.c === c.c && z.k < k))) { x.carte = { id: c.c, gain: 0, cible: c.cible || null, invalide: true }; return; }
      if (PG && PG.id === "chaleur" && c.c === "turbo") { x.carte = { id: c.c, gain: 0, cible: null, invalide: true, piege: true }; return; }   // « Chaleur » : Turbo interdit
      if (PG && PG.id === "sirenes" && c.c === "pari") { x.carte = { id: c.c, gain: 0, cible: null, invalide: true, piege: true }; return; }   // V16.55 « Chant des Sirènes » : Pari interdit   // « Chaleur » : Turbo interdit
      x._c = c; x._g = effetCarte(Object.assign({}, c, { revele: true }), x, l, avant, iR, { up: amelioAu(y, x.nom, k, j.niv), prev: prevL, cumAvant, piege: PG });
    });
    // circuit du mois : +1 pour la carte atout qui a marqué ; bouchon (personne n'a le +1) seulement si au moins deux pilotes l'ont jouée ET ont marqué avec
    const nbAtout = atM ? l.filter(z => z._c && z._c.c === atM.atout.id && z._g > 0).length : 0;
    l.forEach(x => {
      if (!x._c) return;
      const c = x._c, at = atM, marque = !!(at && x._g > 0 && at.atout.id === c.c), bouchon = marque && nbAtout >= 2, circ = marque && !bouchon ? 1 : 0;
      const g = Math.min(PLAFOND_CARTE, x._g + circ);
      x.carte = { id: c.c, gain: g, cible: c.cible || null, circ, bouchon }; x.p += g;
      if (c.c === "pari" && c.cible) { const xc = l.find(z => z.nom === c.cible); if (xc) (xc.vise = xc.vise || []).push({ par: x.nom, gain: g }); }
      delete x._c; delete x._g;
    });
    // bonus d'équipe : tous les pilotes du mois battent le S&P 500 → +1 chacun
    if (!ch && regleActive("equipe", k) && iR !== null && l.length >= 2 && l.every(x => x.r > iR)) l.forEach(x => { x.equipe = 1; x.p += 1; });
    // série (V15) : +1 à chaque 3e mois d'affilée SANS FINIR DERNIER (remise à zéro à chaque saison)
    l.forEach(x => {
      const ok3 = !x.dernier; SERIE[x.nom] = ok3 ? (SERIE[x.nom] || 0) + 1 : 0;
      if (!ch && ok3 && regleActive("serie", k) && SERIE[x.nom] % 3 === 0) { x.serie = SERIE[x.nom]; x.p += 1; }
    });
    // pronostic du mois : +1 vainqueur juste (victoire partagée comprise), +1 si juste sur « le S&P 500 fait-il plus de +1 % ? » (V15)
    // ⏱️ pole position (V15) : le chiffre le plus proche du S&P 500 du mois gagne +1 (partagé en cas d'égalité)
    if (!ch && regleActive("prono", k)) {
      const P = {}; l.forEach(x => { const pr = pronoDe(y, x.nom, k); if (pr && !pr.cache) P[x.nom] = pr; });
      const poles = regleActive("pole", k) && iR !== null ? Object.keys(P).filter(nm => typeof P[nm].p === "number" && isFinite(P[nm].p)) : [];
      const dMin = poles.length ? Math.min(...poles.map(nm => Math.abs(P[nm].p / 100 - iR))) : null;
      l.forEach(x => {
        const pr = P[x.nom]; if (!pr) return;
        const okV = pr.v ? (l.some(z => z.nom === pr.v && z.rg === 1) ? (PG && PG.id === "chaos" ? 2 : 1) : (PG && PG.id === "chaos" ? -1 : 0)) : 0, okI = pr.i && iR !== null && (pr.i === "h") === (iR > 0.01) ? 1 : 0;
        const okP = dMin !== null && poles.includes(x.nom) && Math.abs(Math.abs(pr.p / 100 - iR) - dMin) < 1e-9 ? 1 : 0;
        x.prono = { v: pr.v || null, i: pr.i || null, p: typeof pr.p === "number" ? pr.p : null, pole: okP, pts: okV + okI + okP }; x.p += okV + okI + okP;
      });
    }
    // 🏁 défi du mois (V15) : +1 à chaque pilote qui le réussit
    const dfM = !ch && regleActive("defi", k) ? defiDuMois(k) : null;
    if (dfM) l.forEach(x => { if (defiReussi(dfM, k, x, l, prevL, iR)) { x.defi = 1; x.p += 1; } });
    l.forEach(x => { x.p = Math.max(0, x.p); });
    // XP, niveaux et pioche (dans l'ordre de la pioche de chacun)
    l.forEach(x => {
      const j = J[x.nom]; if (!j) return;
      j.xp += x.base + x.bonus + (x.dernier ? 3 : 0);
      const nv = niveauXP(j.xp), avecNiv = regleActive("niveaux", k); let tir = (avecNiv ? Math.max(0, nv - j.niv) : 0) + (x.dernier ? 1 : 0); x.monte = avecNiv ? nv - j.niv : 0; j.niv = nv;
      x.pioche = []; while (tir-- > 0 && j.i < j.deck.length) { const c = j.deck[j.i++]; j.pioche.push({ c, k }); x.pioche.push(c); }
    });
    prevL = l;
    l.forEach(x => { const t = tot[x.nom]; t.pts += x.p; t.n++; t.cum *= 1 + x.r; t.bonus += x.bonus; if (x.rg === 1) t.v++; if (x.rg <= 3) t.pod++; });
    const presents = Object.keys(tot).filter(nm => tot[nm].n).sort(ordre), places = {}, cumul = {};
    presents.forEach((nm, i) => { places[nm] = i + 1; cumul[nm] = tot[nm].pts; });
    mois.push({ k, iR, l, places, cumul, spec, piege: PG });
  });
  // rival de la saison : +3 (V15, au lieu de +5) en fin de saison si tu finis devant ton rival (classement avant ce bonus)
  if (!ch && mois.length && mois[mois.length - 1].k === f && regleActive("rival", f)) {
    const avantR = Object.keys(tot).filter(nm => tot[nm].n).sort(ordre), der = mois[mois.length - 1];
    avantR.forEach(nm => { const r = rivalDe(y, nm); if (!r || r.cache || !r.r) return; const ir = avantR.indexOf(r.r);
      if (ir >= 0 && avantR.indexOf(nm) < ir) { tot[nm].pts += 3; const x = der.l.find(z => z.nom === nm); if (x) { x.rival = r.r; x.p += 3; } der.cumul[nm] = tot[nm].pts; } });
  }
  // 🛡️ trophée de la régularité (V15) : +3 en fin de saison à qui a fini le moins souvent dernier (départage : le plus de mois positifs)
  if (!ch && mois.length && mois[mois.length - 1].k === f && regleActive("regularite", f)) {
    const der = mois[mois.length - 1], R = {};
    Object.keys(tot).filter(nm => tot[nm].n).forEach(nm => { R[nm] = { d: mois.filter(m => m.l.some(z => z.nom === nm && z.dernier)).length, pos: mois.filter(m => m.l.some(z => z.nom === nm && z.r > 0)).length }; });
    const noms = Object.keys(R), dMin = Math.min(...noms.map(nm => R[nm].d)), pMax = Math.max(...noms.filter(nm => R[nm].d === dMin).map(nm => R[nm].pos));
    if (noms.length >= 2) noms.filter(nm => R[nm].d === dMin && R[nm].pos === pMax).forEach(nm => { tot[nm].pts += 3; const x = der.l.find(z => z.nom === nm); if (x) { x.regul = R[nm].d; x.p += 3; } der.cumul[nm] = tot[nm].pts; });
  }
  const classement = Object.keys(tot).filter(nm => tot[nm].n).sort(ordre);
  const val = { y, deb, f, jeu: J, chauffe: ch, mois, attente: attente && (!mois.length || attente.k > mois[mois.length - 1].k) ? attente : null, tot, classement, complete: mois.length > 0 && mois[mois.length - 1].k === f };
  MEMO_SAISON.m[y] = val;
  return val;
}

/* ---------- Défis : quatre familles, quatre niveaux, et des secrets ---------- */
const NIVEAUX = ["", "Bronze", "Argent", "Or", "Légendaire"], MEDAILLES = ["", "🥉", "🥈", "🥇", "💎"];
const DEFIS = [
  { id: "perf1", fam: "Performance", niv: 1, nom: "Chasseur d'indice", def: "battre le S&P 500 sur 3 mois de la saison", gain: [["trainee", "halo"]] },
  { id: "perf2", fam: "Performance", niv: 2, nom: "Six de rang", def: "devant le S&P 500 sur 6 mois consécutifs, cumulés", gain: [["casque", "eclair"], ["fond", "aurore"]] },
  { id: "perf3", fam: "Performance", niv: 3, nom: "Grand cru", def: "atteindre +20 % cumulés dans la saison", gain: [["livree", "chrome"], ["finition", "or"], ["circuit", "desert"]], unite: " %" },
  { id: "perf4", fam: "Performance", niv: 4, nom: "Dynastie", def: "finir 3 saisons devant le S&P 500", gain: [["livree", "arcenciel"], ["fond", "galaxie"]] },
  { id: "comp1", fam: "Compétition", niv: 1, nom: "Triplé", def: "3 victoires mensuelles dans la saison", gain: [["klaxon", "damier"], ["finition", "argent"]] },
  { id: "comp2", fam: "Compétition", niv: 2, nom: "Série noire", def: "3 victoires mensuelles d'affilée", gain: [["trainee", "flammes"], ["fond", "flammes"]] },
  { id: "comp3", fam: "Compétition", niv: 3, nom: "Champion", def: "remporter le championnat de la saison", gain: [["livree", "or"], ["casque", "etoile"], ["fond", "or"], ["circuit", "monaco"]] },
  { id: "comp4", fam: "Compétition", niv: 4, nom: "Légende", def: "remporter 2 championnats", gain: [["casque", "holo"]] },
  { id: "reg1", fam: "Régularité", niv: 1, nom: "Métronome", def: "verser 6 mois d'affilée", gain: [["plaque", "metronome"]] },
  { id: "reg2", fam: "Régularité", niv: 2, nom: "Fourmi", def: "verser 9 mois d'affilée", gain: [["klaxon", "feu"], ["fond", "neon"]] },
  { id: "reg3", fam: "Régularité", niv: 3, nom: "Douze sur douze", def: "verser chaque mois de la saison", gain: [["livree", "neon"], ["finition", "neon"], ["circuit", "neon"]] },
  { id: "reg4", fam: "Régularité", niv: 4, nom: "Marathon", def: "verser 36 mois d'affilée", gain: [["klaxon", "parade"]] },
  { id: "mai1", fam: "Maîtrise", niv: 1, nom: "Sang-froid", def: "6 mois d'affilée sans mois sous −3 %", gain: [["casque", "carbone"], ["fond", "carbone"], ["circuit", "neige"]] },
  { id: "mai2", fam: "Maîtrise", niv: 2, nom: "Bouclier", def: "perdre moins que le S&P 500 sur 3 de ses mois de baisse", gain: [["plaque", "bouclier"]] },
  { id: "mai3", fam: "Maîtrise", niv: 3, nom: "Main de fer", def: "une saison complète sans mois sous −3 %", gain: [["casque", "chrome"]] },
  { id: "mai4", fam: "Maîtrise", niv: 4, nom: "Roc", def: "3 saisons complètes sans mois sous −3 %", gain: [["trainee", "comete"]] }
];
const SECRETS = [
  { id: "photo", nom: "Photo finish", def: "gagner un mois avec moins de 0,1 point d'avance", gain: [["casque", "damier"], ["fond", "damier"]] },
  { id: "contre", nom: "Contre-attaque", def: "gagner le mois juste après avoir été dernier", gain: [["plaque", "contre"]] },
  { id: "casse", nom: "Le casse", def: "+10 % en un seul mois", gain: [["trainee", "etincelles"]] },
  { id: "tortue", nom: "Tortue", def: "3 lanternes rouges dans la même saison", gain: [["casque", "tortue"]] },
  { id: "remontada", nom: "Remontada", def: "passer de dernier à premier du championnat dans la même saison", gain: [["plaque", "remontada"]] }
];
const FAMILLES_DEFIS = ["Performance", "Compétition", "Régularité", "Maîtrise"];
let MEMO_DEFIS = { d: null, cle: "", m: {} };
function etatDefis(nom) {
  const ys = anneesSaison(), cle = ys.join(",");
  if (MEMO_DEFIS.d !== D || MEMO_DEFIS.cle !== cle) MEMO_DEFIS = { d: D, cle, m: {} };
  if (MEMO_DEFIS.m[nom]) return MEMO_DEFIS.m[nom];
  const r = {}; DEFIS.concat(SECRETS).forEach(d => r[d.id] = { ok: false, prog: 0, cible: 1 });
  const monte = (id, v, cible) => { const o = r[id]; o.cible = cible; o.prog = Math.max(o.prog, Math.min(v, cible)); if (v >= cible) o.ok = true; };
  if (!ys.length) { MEMO_DEFIS.m[nom] = r; return r; }
  // Régularité : mois d'affilée avec un versement (relevés publics du Versus), depuis le début de la première saison
  const p = D.personnes.find(x => x.nom === nom), finPf = finGlobale(D, 0), debut = (ys[0] - 1) * 100 + 12;
  const sp = p ? serie(p, 0).filter(z => z.k > debut && z.k <= finPf) : [];
  let run = 0, prec = null;
  sp.forEach(z => {
    run = z.val && (z.verse || 0) > 0 && (prec === null || cleMoins(z.k, 1) === prec) ? run + 1 : z.val && (z.verse || 0) > 0 ? 1 : 0;
    prec = z.k;
    monte("reg1", run, 6); monte("reg2", run, 9); monte("reg4", run, 36);
  });
  let saisonsBat = 0, titres = 0, saisonsRoc = 0;
  ys.forEach(y => {
    const c = championnat(y);
    const verses = sp.filter(z => z.k > c.deb && z.k <= c.f && z.val && (z.verse || 0) > 0).length;
    monte("reg3", verses, 12);
    let bat = 0, win = 0, winRun = 0, lant = 0, calme = 0, boucl = 0, vu = 0, prod = 1, prodI = 1, sansIdx = 0, sansChute = true, etaitDernier = false, avantDernier = false;
    const fen = [];
    c.mois.forEach(m => {
      const x = m.l.find(z => z.nom === nom);
      if (!x) { winRun = 0; calme = 0; fen.length = 0; avantDernier = false; return; }
      vu++;
      if (m.iR !== null && x.r > m.iR) bat++;
      monte("perf1", bat, 3);
      fen.push({ r: x.r, i: m.iR }); if (fen.length > 6) fen.shift();
      if (fen.length === 6 && fen.every(z => z.i !== null) && fen.reduce((a, z) => a * (1 + z.r), 1) > fen.reduce((a, z) => a * (1 + z.i), 1)) monte("perf2", 1, 1);
      prod *= 1 + x.r; if (m.iR !== null) prodI *= 1 + m.iR; else sansIdx++;
      monte("perf3", Math.floor((prod - 1) * 100), 20);
      if (x.rg === 1) { win++; winRun++; } else winRun = 0;
      monte("comp1", win, 3); monte("comp2", winRun, 3);
      if (x.dernier) lant++;
      monte("tortue", lant, 3);
      calme = x.r >= -0.03 ? calme + 1 : 0; monte("mai1", calme, 6);
      if (x.r < -0.03) sansChute = false;
      if (m.iR !== null && m.iR < 0 && x.r > m.iR) boucl++;
      monte("mai2", boucl, 3);
      if (x.rg === 1 && x.ecart !== null && x.ecart > 1e-9 && x.ecart < 0.001) monte("photo", 1, 1);
      if (x.rg === 1 && avantDernier) monte("contre", 1, 1);
      avantDernier = x.dernier;
      if (x.r >= 0.10) monte("casse", 1, 1);
      const nb = Object.keys(m.places).length, place = m.places[nom];
      if (nb >= 3 && place === nb) etaitDernier = true;
      if (etaitDernier && place === 1) monte("remontada", 1, 1);
    });
    if (c.complete && vu === 12) {
      if (!sansIdx && prod > prodI) saisonsBat++;
      if (sansChute) { saisonsRoc++; monte("mai3", 1, 1); }
    }
    if (c.complete && c.classement[0] === nom) titres++;
  });
  monte("perf4", saisonsBat, 3); monte("comp3", titres, 1); monte("comp4", titres, 2); monte("mai4", saisonsRoc, 3);
  MEMO_DEFIS.m[nom] = r;
  return r;
}

/* ---------- Écurie : ce qui se débloque, ce qui est équipé ---------- */
const ITEMS = {
  casque: { uni: "Uni", carbone: "Carbone", eclair: "Éclair", damier: "Damier", tortue: "Tortue", chrome: "Chrome", etoile: "Étoile", holo: "Holo", couronne: "Couronne", foudre: "Foudre", phenix: "Phénix", glace: "Glace", galaxie: "Galaxie", empereur: "Empereur" },
  circuit: { classique: "Jour de course", monaco: "Nocturne", desert: "Golden hour", neige: "Hiver", neon: "Synthwave" },
  fond: { couleur: "Couleur", carbone: "Carbone", aurore: "Aurore", flammes: "Flammes", neon: "Néon", damier: "Damier", or: "Or", galaxie: "Galaxie" },
  finition: { aucune: "Aucune", argent: "Liseré argent", or: "Liseré or", neon: "Liseré néon", diamant: "Diamant", lauriers: "Lauriers", etoilee: "Étoilée", soleil: "Soleil" },
  livree: { couleur: "Couleur", chrome: "Chrome", or: "Or", neon: "Néon", arcenciel: "Prisme", oranime: "Or vivant", platine: "Platine", rubis: "Rubis", galaxie: "Galaxie", orrose: "Or rose" },
  trainee: { simple: "Simple", halo: "Halo", flammes: "Flammes", etincelles: "Étincelles", comete: "Comète", supernova: "Supernova", turbo: "Turbo", arcenciel: "Arc-en-ciel" },
  klaxon: { confettis: "Confettis", damier: "Damier", feu: "Feu d'artifice", parade: "Parade", billets: "Pluie de billets", fanfare: "Fanfare royale", cibles: "Dans le mille", fusees: "Décollage", trophees: "Pluie de trophées" },
  plaque: { aucune: "Aucune", metronome: "Le Métronome", bouclier: "Bouclier", contre: "Contre-attaque", remontada: "Roi de la remontée", premiersang: "Premier sang", fidele: "Fidèle au poste", vingt: "Pointeur", coupsaison: "Coup de la saison" }
};
const BASE_ECURIE = { casque: "uni", circuit: "classique", fond: "couleur", finition: "aucune", livree: "couleur", trainee: "simple", klaxon: "confettis", plaque: "aucune" };
const SLOTS = [["casque", "Casque"], ["finition", "Finition"], ["fond", "Avatar"], ["livree", "Livrée"], ["trainee", "Traînée"], ["klaxon", "Klaxon"], ["plaque", "Plaque"], ["circuit", "Filtre de course"]];
const GAINS_MILLION = [["casque", "couronne"], ["livree", "oranime"], ["klaxon", "billets"]];
function debloques(nom) {
  const o = new Set(Object.entries(BASE_ECURIE).map(([s, v]) => s + "." + v));
  const e = etatDefis(nom);
  DEFIS.concat(SECRETS).forEach(d => { if (e[d.id].ok) d.gain.forEach(g => o.add(g.join("."))); });
  if (D.premierMillion && D.premierMillion.nom === nom) GAINS_MILLION.forEach(g => o.add(g.join(".")));
  exclusifsDe(nom).forEach(x => o.add(x.gain.join(".")));
  if (Object.values(D.votes || {}).some(v => (v.gagnants || []).includes(nom))) o.add("plaque.coupsaison");   // V13.9 : gagnant d'un vote de fin de saison
  return o;
}
/** D'où vient un objet : { defi, secret, million } */
function origineItem(slot, id) {
  if (slot === "plaque" && id === "coupsaison") return { vote: true };
  const ex = EXCLUSIFS.find(x => x.gain[0] === slot && x.gain[1] === id); if (ex) return { exclusif: ex };
  const de = l => l.find(d => d.gain.some(g => g[0] === slot && g[1] === id));
  const d = de(DEFIS); if (d) return { defi: d };
  const s = de(SECRETS); if (s) return { secret: s };
  if (GAINS_MILLION.some(g => g[0] === slot && g[1] === id)) return { million: true };
  return {};
}
function numeroParDefaut(nom) { const i = D.personnes.findIndex(p => p.nom === nom); return ((i < 0 ? 0 : i) + 1) * 11 % 100 || 7; }
/** Équipement affiché : un objet qui n'est pas (ou plus) débloqué retombe sur l'objet de base */
function equipDe(nom) {
  const brut = ((D.ecurie || {})[nom] || {}).equip || {}, ouverts = debloques(nom), e = {};
  SLOTS.forEach(([s]) => e[s] = brut[s] && ouverts.has(s + "." + brut[s]) ? brut[s] : BASE_ECURIE[s]);
  const n = parseInt(brut.numero, 10); e.numero = n >= 1 && n <= 99 ? n : numeroParDefaut(nom);
  e.pilote = brut.pilote === "casque" ? "casque" : "tete";
  e.tete = teteValide(brut.tete) ? brut.tete : presetTete(nom);
  e.tetes = Array.isArray(brut.tetes) ? brut.tetes.slice(0, 4).map(x => teteValide(x) ? x : "") : [];   // V16.26 : jusqu'à 4 têtes enregistrées
  e.amelio = amelioDe(nom, anneeAmelioPour()).s;
  e.badges = Array.isArray(brut.badges) ? brut.badges.filter(x => typeof x === "string").slice(0, 3) : null;   // null = l'appli choisit
  return e;
}
/** Saison des améliorations : celle de l'aperçu, sinon celle qui se joue (décembre prépare la suivante) */
function anneeAmelioPour() { return apercuSaison() ? SAISON.premiere - 1 : anneeAmelio(); }
function attrLivree(nom, e) {
  if (!saisonVisible()) return "";
  const l = (e || equipDe(nom)).livree;
  return l === "couleur" ? "" : ' class="lv lv-' + l + '" style="--c:' + couleur(nom) + '"';
}
function plaqueDe(nom) {
  if (!saisonVisible()) return "";
  const p = equipDe(nom).plaque;
  if (p === "aucune") return "";
  const o = origineItem("plaque", p), quoi = o.exclusif ? "exclusif « " + o.exclusif.nom + " »" : o.secret ? "défi secret « " + o.secret.nom + " » : " + o.secret.def : o.defi ? "défi « " + o.defi.nom + " » : " + o.defi.def : "";
  return '<span class="plaque" data-bdg="' + esc("Plaque « " + ITEMS.plaque[p] + " » de " + nom + (quoi ? ", gagnée avec le " + quoi : "") + ".") + '">' + esc(ITEMS.plaque[p]) + "</span> ";
}

/* ---------- Course aux exclusifs : un seul exemplaire, pour le premier qui y arrive ----------
   Calculé à partir des relevés publics (mêmes règles pour tous), puis figé dans le Versus (propriété EXCLUSIFS)
   dès qu'il est décroché : même si un relevé change ensuite, l'objet reste à son premier propriétaire.
   À égalité dans le même mois : la meilleure valeur du critère l'emporte. */
const NIV_EX = ["", "Facile", "Intermédiaire", "Difficile", "Légendaire"], MED_EX = ["", "🥉", "🥈", "🥇", "💎"];
const EXCLUSIFS = [
  // Facile : de quoi lancer la course dès les premiers mois
  { id: "premiersang", niv: 1, ico: "⚔️", nom: "Premier sang", def: "gagner un mois de championnat", gain: ["plaque", "premiersang"] },
  { id: "cible", niv: 1, ico: "🎯", nom: "Dans le mille", def: "battre l'indice sur un mois (premier bonus 🎯)", gain: ["klaxon", "cibles"] },
  { id: "decollage", niv: 1, ico: "🚀", nom: "Décollage", def: "faire +5 % sur un seul mois", gain: ["klaxon", "fusees"] },
  { id: "fidele", niv: 1, ico: "🤝", nom: "Fidèle au poste", def: "verser 3 mois d'affilée", gain: ["plaque", "fidele"] },
  { id: "vingt", niv: 1, ico: "🔢", nom: "Pointeur", def: "atteindre 12 points de championnat", gain: ["plaque", "vingt"] },
  { id: "remontee", niv: 1, ico: "⏩", nom: "Coup de turbo", def: "gagner 2 places au championnat d'un mois à l'autre", gain: ["trainee", "turbo"] },
  // Intermédiaire
  { id: "hattrick", niv: 2, ico: "⚡", nom: "Hat-trick", def: "gagner 3 mois d'affilée", gain: ["casque", "foudre"] },
  { id: "massue", niv: 2, ico: "💥", nom: "Coup de massue", def: "battre l'indice de 5 points ou plus sur un seul mois", gain: ["trainee", "supernova"] },
  { id: "cinqetoiles", niv: 2, ico: "🌟", nom: "Cinq étoiles", def: "cumuler 5 bonus 🎯", gain: ["finition", "etoilee"] },
  { id: "mur10", niv: 2, ico: "💠", nom: "Le mur des 10 %", def: "atteindre +10 % cumulés depuis le départ de la saison 1", gain: ["livree", "platine"] },
  { id: "cinquante", niv: 2, ico: "🏆", nom: "Trentenaire", def: "atteindre 30 points de championnat, toutes saisons confondues", gain: ["klaxon", "trophees"] },
  { id: "inarretable", niv: 2, ico: "💎", nom: "Inarrêtable", def: "verser 12 mois d'affilée (relevés du Versus)", gain: ["finition", "diamant"] },
  // Difficile
  { id: "fusee", niv: 3, ico: "❤️‍🔥", nom: "Mois de feu", def: "faire +10 % sur un seul mois", gain: ["livree", "rubis"] },
  { id: "semestre", niv: 3, ico: "🧊", nom: "Sang-glacé", def: "battre l'indice 6 mois d'affilée", gain: ["casque", "glace"] },
  { id: "phenix", niv: 3, ico: "🔥", nom: "Phénix", def: "battre son record de cumul après une chute de 10 %", gain: ["casque", "phenix"] },
  { id: "grandchelem", niv: 3, ico: "🌌", nom: "Grand chelem", def: "gagner 5 mois dans une même saison", gain: ["casque", "galaxie"] },
  { id: "maillot", niv: 3, ico: "☀️", nom: "Maillot jaune", def: "passer 6 mois en tête du championnat, au total", gain: ["finition", "soleil"] },
  { id: "centurion", niv: 3, ico: "🎺", nom: "Soixante", def: "atteindre 60 points de championnat, toutes saisons confondues", gain: ["klaxon", "fanfare"] },
  // Légendaire
  { id: "champion", niv: 4, ico: "🌿", nom: "Premier champion", def: "remporter une saison complète", gain: ["finition", "lauriers"] },
  { id: "mur25", niv: 4, ico: "🪐", nom: "Le mur des 25 %", def: "atteindre +25 % cumulés depuis le départ de la saison 1", gain: ["livree", "galaxie"] },
  { id: "marathon", niv: 4, ico: "🌈", nom: "Marathonien", def: "verser 24 mois d'affilée", gain: ["trainee", "arcenciel"] },
  { id: "mur50", niv: 4, ico: "🌹", nom: "Le mur des 50 %", def: "atteindre +50 % cumulés depuis le départ de la saison 1", gain: ["livree", "orrose"] },
  { id: "doublechampion", niv: 4, ico: "🦅", nom: "Empereur", def: "remporter 2 saisons", gain: ["casque", "empereur"] }
];
let MEMO_EXCL = { d: null, cle: "", v: null };
/** Pour chaque exclusif : { nom, k, score } du premier (calcul), ou null */
function premiersExclusifs() {
  const ys = anneesSaison(), cle = ys.join(",");
  if (MEMO_EXCL.d === D && MEMO_EXCL.cle === cle) return MEMO_EXCL.v;
  const cand = {}; EXCLUSIFS.forEach(x => cand[x.id] = {});
  const note = (id, nom, k, score) => { if (!cand[id][nom]) cand[id][nom] = { nom, k, score }; };
  const rMois = {}, cumMois = {};   // départages : performance du mois, puis cumul de la saison à ce mois
  if (ys.length) {
    const st = {}, titres = {};
    ys.forEach(y => { const cu = {}; championnat(y).mois.forEach(m => m.l.forEach(x => { cu[x.nom] = (cu[x.nom] || 1) * (1 + x.r); (rMois[x.nom] = rMois[x.nom] || {})[m.k] = x.r; (cumMois[x.nom] = cumMois[x.nom] || {})[m.k] = cu[x.nom]; })); });
    ys.forEach(y => {
      const c = championnat(y), wins = {};
      let precPlaces = null;
      c.mois.forEach(m => {
        m.l.forEach(x => {
          const s = st[x.nom] = st[x.nom] || { run: 0, prod: 1, pic: 1, creux: false, pts: 0, bonus: 0, bat: 0, tete: 0 };
          if (x.rg === 1) note("premiersang", x.nom, m.k, x.r);
          if (x.bonus) { note("cible", x.nom, m.k, x.r - m.iR); s.bonus++; if (s.bonus >= 5) note("cinqetoiles", x.nom, m.k, s.bonus); }
          if (x.r >= 0.05) note("decollage", x.nom, m.k, x.r);
          if (x.r >= 0.10) note("fusee", x.nom, m.k, x.r);
          s.run = x.rg === 1 ? s.run + 1 : 0; if (s.run >= 3) note("hattrick", x.nom, m.k, x.r);
          if (x.rg === 1) { wins[x.nom] = (wins[x.nom] || 0) + 1; if (wins[x.nom] >= 5) note("grandchelem", x.nom, m.k, x.r); }
          s.bat = m.iR !== null && x.r > m.iR ? s.bat + 1 : 0; if (s.bat >= 6) note("semestre", x.nom, m.k, x.r - m.iR);
          s.prod *= 1 + x.r;
          [["mur10", .10], ["mur25", .25], ["mur50", .50]].forEach(([id, seuil]) => { if (s.prod - 1 >= seuil) note(id, x.nom, m.k, s.prod); });
          if (m.iR !== null && x.r - m.iR >= 0.05) note("massue", x.nom, m.k, x.r - m.iR);
          s.pts += x.p;
          [["vingt", 12], ["cinquante", 30], ["centurion", 60]].forEach(([id, seuil]) => { if (s.pts >= seuil) note(id, x.nom, m.k, s.pts); });
          if (s.prod > s.pic + 1e-12) { if (s.creux) note("phenix", x.nom, m.k, s.prod); s.pic = s.prod; s.creux = false; } else if (s.prod <= s.pic * 0.9) s.creux = true;
          if (m.places[x.nom] === 1) { s.tete++; if (s.tete >= 6) note("maillot", x.nom, m.k, s.pts); }
          if (precPlaces && precPlaces[x.nom] && precPlaces[x.nom] - m.places[x.nom] >= 2) note("remontee", x.nom, m.k, precPlaces[x.nom] - m.places[x.nom]);
        });
        precPlaces = m.places;
      });
      if (c.complete && c.classement[0]) {
        const n = c.classement[0]; titres[n] = (titres[n] || 0) + 1;
        note("champion", n, c.f, c.tot[n].pts);
        if (titres[n] >= 2) note("doublechampion", n, c.f, c.tot[n].pts);
      }
    });
    const debut = (ys[0] - 1) * 100 + 12, finPf = finGlobale(D, 0);
    D.personnes.forEach(p => {
      let run = 0, prec = null;
      serie(p, 0).filter(z => z.k > debut && z.k <= finPf).forEach(z => {
        const v = z.val && (z.verse || 0) > 0;
        run = v ? (prec !== null && cleMoins(z.k, 1) === prec ? run + 1 : 1) : 0; prec = z.k;
        [["fidele", 3], ["inarretable", 12], ["marathon", 24]].forEach(([id, seuil]) => { if (run >= seuil) note(id, p.nom, z.k, run); });
      });
    });
  }
  const v = {};
  EXCLUSIFS.forEach(x => {
    const val = (o, m) => { const v = (m[o.nom] || {})[o.k]; return v === undefined ? -Infinity : v; };
    const l = Object.values(cand[x.id]).sort((a, b) => a.k - b.k || b.score - a.score || val(b, rMois) - val(a, rMois) || val(b, cumMois) - val(a, cumMois) || a.nom.localeCompare(b.nom));
    // décision du 05/11/2026 : plusieurs le réussissent le même mois → chacun l'obtient
    v[x.id] = l.length ? Object.assign({}, l[0], { noms: l.filter(o => o.k === l[0].k).map(o => o.nom) }) : null;
  });
  MEMO_EXCL = { d: D, cle, v };
  return v;
}
/** Détenteur d'un exclusif : figé dans le Versus s'il a été décroché, sinon le premier selon les relevés */
/** Détenteur(s) d'un exclusif : { noms, nom (« A et B »), k, fige }. Figé = décidé par le serveur (V22) */
function detenteur(id) {
  const fige = !apercuSaison() && D.exclusifs && D.exclusifs[id];
  if (fige) { const noms = fige.noms || [fige.nom]; return { noms, nom: noms.join(" et "), k: fige.mois, fige: true }; }
  const p = premiersExclusifs()[id];
  return p ? { noms: p.noms || [p.nom], nom: (p.noms || [p.nom]).join(" et "), k: p.k, fige: false } : null;
}
function possede(id, nom) { const d = detenteur(id); return !!(d && d.noms.includes(nom)); }
function exclusifsDe(nom) { return EXCLUSIFS.filter(x => possede(x.id, nom)); }
/* Figer un exclusif dans le Versus : la personne concernée (ou l'admin) le revendique ; le premier enregistré gagne. */
let EXCL_ENVOI = false;
/** V22 : annonce une fois les exclusifs que le serveur vient de t'attribuer */
function annoncerExclusifs() {
  if (!D || !D.exclusifs || simulation() || apercuSaison() || basesSeules()) return;
  const moi = moiVrai(); if (!moi) return;
  let vus = []; try { vus = JSON.parse(stock.get("versus.exclVus") || "[]"); } catch (e) { vus = []; }
  const nouveaux = EXCLUSIFS.filter(x => { const f = D.exclusifs[x.id]; return f && (f.noms || [f.nom]).includes(moi) && !vus.includes(x.id); });
  if (!vus.length && !stock.get("versus.exclVus")) { stock.set("versus.exclVus", JSON.stringify(EXCLUSIFS.filter(x => possede(x.id, moi)).map(x => x.id))); return; }   // premier passage : rien à fêter
  if (!nouveaux.length) return;
  stock.set("versus.exclVus", JSON.stringify(vus.concat(nouveaux.map(x => x.id))));
  // V15.9 : une vraie annonce (et plus un simple message de 4 s) : c'est un objet unique, gagné en premier
  const o = document.createElement("div"); o.className = "revel excl-an"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div class="rv-c"><span class="tuto-k">💎 Exclusif décroché</span>' + nouveaux.map((x, i) => '<div class="ea-l" style="--i:' + i + '"><div class="cc-flip ea-carte"><div class="cc-in"><div class="cc-dos"><span>' + mondeDeNiv(x.niv).ico + '</span></div><div class="cc-face">' + htmlCarteColl(x.id, "g", [moi]) + '</div></div></div><b>' + esc(CARTES_COLL[x.id].t) + '</b><small class="ea-mo">' + esc(mondeDeNiv(x.niv).nom) + " · " + esc(x.nom) + "</small><b style=\"display:none\">" + esc(x.nom) + "</b><small>Tu es le premier : " + esc((SLOTS.find(z => z[0] === x.gain[0]) || [, "objet"])[1]) + " « " + esc(ITEMS[x.gain[0]][x.gain[1]]) + " », un objet d'écurie que personne d'autre n'aura.</small></div>").join("") +
    '<div class="btn-row"><button class="btn acc" type="button" data-ea="ecurie">🏎️ Mon écurie</button><button class="btn ghost" type="button" data-ea="ok">Génial !</button></div></div>';
  document.body.appendChild(o); confettis("damier");
  const t0 = Date.now(), fermer = () => o.remove();
  o.addEventListener("click", e => { if (e.target === o && Date.now() - t0 > 2000) fermer(); });
  o.querySelector('[data-ea="ok"]').addEventListener("click", fermer);
  o.querySelector('[data-ea="ecurie"]').addEventListener("click", () => { fermer(); ETAT.podium = "ecurie"; garder(); if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees"); });
}
async function revendiquerExclusifs() {
  return;   // V22 : c'est le serveur qui calcule et fige les exclusifs (anti-triche) ; l'appli ne revendique plus rien
  if (EXCL_ENVOI || !saisonOuverte() || SOURCE !== "api" || !D) return;
  const moi = estAdmin() ? null : SESSION && SESSION.nom;
  const aFiger = EXCLUSIFS.filter(x => { const p = premiersExclusifs()[x.id]; return p && !(D.exclusifs && D.exclusifs[x.id]) && (estAdmin() || p.nom === moi); });
  if (!aFiger.length) return;
  EXCL_ENVOI = true;
  try {
    for (const x of aFiger) {
      const p = premiersExclusifs()[x.id];
      const rep = await posterAdmin({ action: "exclusif", id: x.id, personne: p.nom, mois: p.k });
      if (!rep.ok) break;
      D.exclusifs = rep.exclusifs || D.exclusifs;
      const d = D.exclusifs && D.exclusifs[x.id];
      if (d && d.nom === (moi || ETAT.moi) && d.nouveau !== false) { toast(x.ico + " Exclusif décroché : " + ITEMS[x.gain[0]][x.gain[1]] + " (" + x.nom + ")"); confettis("damier"); }
    }
    stock.set(CLES.cache, JSON.stringify(D));
  } finally { EXCL_ENVOI = false; }
}

/* ---------- « Maillot jaune » : le leader du championnat en cours porte le liseré or, qui change de casque quand il perd la tête ---------- */
function leaderSaison() {
  const ys = anneesSaison(); if (!ys.length) return null;
  const c = championnat(ys[ys.length - 1]);
  return c.mois.length ? c.classement[0] : null;
}
function moisEnTete(nom, y) { return championnat(y).mois.filter(m => m.places[nom] === 1).length; }
/** Petits badges à côté du nom (classement) : leader, titres de champion, exclusifs */
/** V16.3 · badges possédés (titres de saison puis exclusifs, du plus prestigieux au moins) : [{ id, ico, nom, html }] */
function badgesPossedes(nom) {
  if (!saisonVisible()) return [];
  const l = [], titres = anneesSaison().filter(y => { const c = championnat(y); return c.complete && c.classement[0] === nom; }).length;
  if (titres) l.push({ id: "titre", ico: "🏆", nom: titres > 1 ? titres + " titres de champion" : "Champion de saison", html: '<span class="bdg" data-bdg="🏆 ' + esc(nom) + " a remporté " + titres + (titres > 1 ? " saisons" : " saison") + ' du championnat.">🏆' + (titres > 1 ? "×" + titres : "") + "</span>" });
  exclusifsDe(nom).sort((a, b) => b.niv - a.niv).forEach(x => l.push({ id: x.id, ico: x.ico, nom: x.nom, niv: x.niv, html: '<span class="bdg ex n' + x.niv + '" data-bdg="' + esc(x.ico + " " + x.nom + " · exclusif " + NIV_EX[x.niv].toLowerCase() + " : " + nom + " a été le premier à " + x.def.replace("l'indice", "le " + D.marche.indices[iRef()]) + ". Il garde " + ITEMS[x.gain[0]][x.gain[1]] + " (" + SLOTS.find(z => z[0] === x.gain[0])[1].toLowerCase() + "), en un seul exemplaire.") + '">' + x.ico + "</span>" }));
  return l;
}
/** Les badges affichés : ceux épinglés dans l'Écurie (3 au plus), sinon les 3 plus prestigieux */
function badgesAffiches(nom, e) {
  if (basesSeules()) return [];
  const tous = badgesPossedes(nom), choix = (e || equipDe(nom)).badges;
  if (!Array.isArray(choix)) return tous.slice(0, 3);
  return choix.map(id => tous.find(b => b.id === id)).filter(Boolean).slice(0, 3);
}
/** Sur la ligne du Classement : 🟡 en tête (automatique, hors quota), puis 3 badges au plus, puis « +N » */
function badgesNom(nom, e) {
  if (!saisonVisible()) return "";
  let h = "";
  if (leaderSaison() === nom) h += '<span class="bdg jaune" data-bdg="🟡 ' + esc(nom) + ' est en tête du championnat de la saison : il porte le liseré or sur son casque, jusqu\'à ce qu\'un autre le dépasse.">🟡</span>';
  const tous = badgesPossedes(nom), vus = badgesAffiches(nom, e), autres = tous.filter(b => !vus.some(x => x.id === b.id));
  h += vus.map(b => b.html).join("");
  if (autres.length) h += '<span class="bdg bdg-plus" data-bdg="' + esc(nom + " a aussi : " + autres.map(b => b.ico + " " + b.nom).join(", ") + ". Chacun choisit les 3 badges affichés sur sa ligne dans Podium › Écurie › Badges.") + '">+' + autres.length + "</span>";
  return h;
}
const EX_OUVERTS = new Set();
function htmlCourseExclusifs() {
  const pm = D.premierMillion, idx = D.marche.indices[iRef()];
  const ligne = x => {
    const d = detenteur(x.id), item = ITEMS[x.gain[0]][x.gain[1]], slot = SLOTS.find(z => z[0] === x.gain[0])[1].toLowerCase();
    return '<div class="ex-l' + (d ? " pris" : "") + '"><span class="ex-i">' + x.ico + "</span><div><b>" + esc(x.nom) + "</b><small>Le premier à " + esc(x.def.replace("l'indice", "le " + idx)) + " · " + esc(item) + " (" + slot + ")</small></div>" +
      (d ? '<span class="ex-q" style="--c:' + couleur(d.noms[0]) + '"><b>' + esc(d.nom) + "</b><small>" + esc(moisCourt(d.k)) + "</small></span>" : '<span class="ex-q libre"><b>Libre</b><small>à prendre</small></span>') + "</div>";
  };
  const niveaux = [1, 2, 3, 4].map(n => {
    const l = EXCLUSIFS.filter(x => x.niv === n), pris = l.filter(x => detenteur(x.id)).length + (n === 4 && pm ? 1 : 0), tot = l.length + (n === 4 ? 1 : 0);
    const mil = n === 4 ? '<div class="ex-l' + (pm ? " pris" : "") + '"><span class="ex-i">👑</span><div><b>Premier millionnaire</b><small>Le premier à 1 000 000 € · récompense secrète, pour toute l\'appli</small></div>' +
      (pm ? '<span class="ex-q" style="--c:' + couleur(pm.nom) + '"><b>' + esc(pm.nom) + "</b><small>pour toujours</small></span>" : '<span class="ex-q libre"><b>Libre</b><small>à prendre</small></span>') + "</div>" : "";
    const icones = l.map(x => { const d = detenteur(x.id); return '<i' + (d ? ' style="--c:' + couleur(d.noms[0]) + '" class="pris"' : "") + ">" + x.ico + "</i>"; }).join("") + (n === 4 ? "<i" + (pm ? ' style="--c:' + couleur(pm.nom) + '" class="pris"' : "") + ">👑</i>" : "");
    return '<details class="ex-bloc n' + n + '" data-exn="' + n + '"' + (EX_OUVERTS.has(n) ? " open" : "") + '><summary><span class="ex-niv"><span>' + MED_EX[n] + " " + NIV_EX[n] + "</span><small>" + pris + " / " + tot + "</small></span>" +
      '<span class="ex-ics">' + icones + "</span></summary>" + l.map(ligne).join("") + mil + "</details>";
  }).join("");
  const parNom = {}; EXCLUSIFS.forEach(x => { const d = detenteur(x.id); if (d) d.noms.forEach(n => { parNom[n] = (parNom[n] || 0) + 1; }); }); if (pm) parNom[pm.nom] = (parNom[pm.nom] || 0) + 1;
  const tab = D.personnes.map(p => p.nom).sort((a, b) => (parNom[b] || 0) - (parNom[a] || 0)).map(n => '<span style="--c:' + couleur(n) + '"><b>' + (parNom[n] || 0) + "</b>" + esc(n) + "</span>").join("");
  return '<div><h3 class="s-h3">La course aux exclusifs <small>' + (EXCLUSIFS.length + 1) + " objets, un seul exemplaire chacun</small></h3></div>" +
    '<p class="info">Le premier qui y arrive décroche l\'objet et son badge, et personne d\'autre ne pourra jamais les avoir. Calculé sur les relevés publics, avec les mêmes règles pour tous. Si deux pilotes y arrivent le même mois : la meilleure valeur du critère l\'emporte, puis la meilleure performance du mois, puis le meilleur cumul de la saison.' + (apercuSaison() ? " En aperçu, rien n'est figé." : "") + "</p>" +
    '<div class="ex-tab">' + tab + '</div><div class="ex-liste">' + niveaux + "</div>";
}
/** Le « ? » d'un objet de l'écurie : d'où il vient, qui l'a, ce qu'il reste à faire */
function texteOrigineItem(qui, slot, id) {
  const ouvert = debloques(qui).has(slot + "." + id), org = origineItem(slot, id), E = etatDefis(qui);
  if (BASE_ECURIE[slot] === id) return { t: "De série", p: "Fourni à tout le monde dès le départ." };
  if (org.exclusif) {
    const x = org.exclusif, d = detenteur(x.id), quoi = "le premier à " + x.def.replace("l'indice", "le " + D.marche.indices[iRef()]);
    if (d && d.noms.includes(qui)) return { t: MED_EX[x.niv] + " Exclusif " + NIV_EX[x.niv].toLowerCase() + " · " + x.nom, p: (d.noms.length > 1 ? "À toi, avec " + d.noms.filter(n => n !== qui).join(" et ") + " (le même mois)" : "À toi seul") + " : tu as été " + quoi + " (" + moisLong(d.k) + ")." };
    if (d) return { t: MED_EX[x.niv] + " Exclusif " + NIV_EX[x.niv].toLowerCase() + " · " + x.nom, p: d.nom + " l'" + (d.noms.length > 1 ? "ont" : "a") + " décroché en " + moisLong(d.k) + " : " + quoi + ". Plus personne ne pourra l'avoir." };
    return { t: MED_EX[x.niv] + " Exclusif " + NIV_EX[x.niv].toLowerCase() + " · " + x.nom, p: "Encore libre : sois " + quoi + ", et il sera à toi seul." };
  }
  if (org.vote) return { t: "Unique · Coup de la saison", p: "Gagné au 🗳️ vote de fin de saison : les autres pilotes t'ont élu pour le coup de la saison." };
  if (org.million) return { t: "Unique · Premier millionnaire", p: D.premierMillion ? (D.premierMillion.nom === qui ? "À toi : premier millionnaire du groupe." : "Réservé à " + D.premierMillion.nom + ", premier millionnaire du groupe.") : "Réservé au premier du groupe qui atteindra 1 000 000 €." };
  if (org.secret) return ouvert ? { t: "Défi secret · " + org.secret.nom, p: "Gagné en réussissant : " + org.secret.def + "." } : { t: "Défi secret", p: "Un défi caché le débloque. Personne ne sait lequel… pour l'instant." };
  if (org.defi) {
    const d = org.defi, o = E[d.id];
    return ouvert ? { t: MEDAILLES[d.niv] + " Défi « " + d.nom + " »", p: "Gagné en réussissant : " + d.def + "." }
      : { t: MEDAILLES[d.niv] + " Défi « " + d.nom + " » · " + NIVEAUX[d.niv].toLowerCase(), p: "Pour l'ouvrir : " + d.def + ".", prog: o && o.cible ? o.prog / o.cible : 0, pt: o && o.prog ? o.prog + " / " + o.cible + (d.unite || "") : "" };
  }
  return { t: ITEMS[slot][id], p: ouvert ? "Déjà à toi." : "Pas encore débloqué." };
}

/* ---------- Dessins : casque (avatar) et voiture ---------- */
let NSVG = 0;
/** Motifs et matières (casques, livrées). u = préfixe d'identifiants unique par dessin */
function defsMotif(u, motif, c) {
  const lg = (stops, att) => '<linearGradient id="' + u + 'm" ' + (att || 'x1="0" y1="0" x2="0" y2="1"') + ">" + stops.map(([o, col]) => '<stop offset="' + o + '" stop-color="' + col + '"/>').join("");
  if (motif === "carbone") return '<pattern id="' + u + 'm" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#16191f"/><rect width="2.5" height="2.5" fill="#2d333d"/><rect x="2.5" y="2.5" width="2.5" height="2.5" fill="#2d333d"/></pattern>';
  if (motif === "damier") return '<pattern id="' + u + 'm" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#f5f5f2"/><rect width="4.5" height="4.5" fill="#101215"/><rect x="4.5" y="4.5" width="4.5" height="4.5" fill="#101215"/></pattern>';
  if (motif === "tortue") return '<pattern id="' + u + 'm" width="11" height="10" patternUnits="userSpaceOnUse"><rect width="11" height="10" fill="#2F8A45"/><path d="M0 5 2.75 0h5.5L11 5 8.25 10h-5.5z" fill="#3FAE5A" stroke="#1B5528" stroke-width="1.3"/></pattern>';
  if (motif === "chrome") return lg([[0, "#ffffff"], [.16, "#d4dae1"], [.3, "#59626d"], [.42, "#eef1f4"], [.58, "#8b95a1"], [.76, "#f6f8fa"], [1, "#454c56"]]) + "</linearGradient>";
  if (motif === "or" || motif === "couronne") return lg([[0, "#FFF6CC"], [.18, "#F7CF55"], [.38, "#9A6716"], [.52, "#FFE596"], [.72, "#C98E22"], [1, "#6B430C"]]) + "</linearGradient>";
  if (motif === "oranime") return lg([[0, "#FFF6CC"], [.18, "#F7CF55"], [.38, "#9A6716"], [.52, "#FFE596"], [.72, "#C98E22"], [1, "#6B430C"]]) + "</linearGradient>";
  if (motif === "foudre") return lg([[0, "#2A3450"], [.45, "#0B1020"], [1, "#05070D"]]) + "</linearGradient>";
  if (motif === "phenix") return lg([[0, "#FFE08A"], [.3, "#FF8A1F"], [.62, "#E0301E"], [1, "#6E0D12"]]) + "</linearGradient>";
  if (motif === "glace") return lg([[0, "#F4FDFF"], [.25, "#BFEFFC"], [.5, "#72C6E8"], [.7, "#E2F8FF"], [1, "#3C8AB5"]]) + "</linearGradient>";
  if (motif === "rubis") return lg([[0, "#FF9BB0"], [.22, "#E0115F"], [.45, "#72001E"], [.6, "#FF4D6D"], [1, "#43000F"]]) + "</linearGradient>";
  if (motif === "orrose") return lg([[0, "#FFE9E1"], [.22, "#E8A598"], [.42, "#9C5562"], [.56, "#F9D1C7"], [.76, "#C47F86"], [1, "#6E3640"]]) + "</linearGradient>";
  if (motif === "empereur") return lg([[0, "#8E5BE0"], [.4, "#4A1A8C"], [1, "#1C0638"]]) + "</linearGradient>";
  if (motif === "galaxie") return '<pattern id="' + u + 'm" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#170A36"/><rect width="14" height="14" fill="#5B2A9E" opacity=".35"/>' +
    '<circle cx="2" cy="3" r=".7" fill="#fff"/><circle cx="9" cy="2" r=".45" fill="#FFC6F2"/><circle cx="6" cy="9" r=".55" fill="#fff"/><circle cx="12" cy="11" r=".7" fill="#B9E6FF"/><circle cx="3" cy="12" r=".35" fill="#fff"/></pattern>';
  if (motif === "platine") return lg([[0, "#FFFFFF"], [.2, "#E3EAF2"], [.38, "#9AA6B6"], [.5, "#F6F9FF"], [.64, "#C9D6EA"], [.8, "#EEF2F8"], [1, "#7D8898"]]) + "</linearGradient>";
  if (motif === "holo" || motif === "arcenciel") return '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2=".35" spreadMethod="reflect">' +
    [["#FF6B9A", 0], ["#FFC15E", .2], ["#E9F27A", .38], ["#5CF0B5", .55], ["#5AB8FF", .72], ["#B98CFF", .88], ["#FF6B9A", 1]].map(([col, o]) => '<stop offset="' + o + '" stop-color="' + col + '"/>').join("") +
    (ANIM ? '<animateTransform attributeName="gradientTransform" type="translate" values="0 0;1 0" dur="5s" repeatCount="indefinite"/>' : "") + "</linearGradient>";
  return "";
}
const MOTIFS_PLEINS = ["carbone", "damier", "tortue", "chrome", "or", "couronne", "oranime", "holo", "arcenciel", "foudre", "phenix", "platine", "glace", "rubis", "orrose", "empereur", "galaxie"];
function remplissage(u, motif, c) { return MOTIFS_PLEINS.includes(motif) ? "fill:url(#" + u + "m)" : "fill:" + c; }

/* ---------- Casque : coque brillante, visière fumée (irisée pour les plus rares), décor selon le modèle ---------- */
const COQUE = "M-15 5C-16-9-7-18 4-18C14-18 20-10 20 0V6C20 10 18 12 14 12H-9C-13 12-15 9-15 5Z";
function casqueForme(u, m, c, fin, lead) {
  const iri = ["holo", "couronne", "chrome", "etoile", "foudre", "glace", "galaxie"].includes(m), orv = m === "couronne" || m === "phenix" || m === "empereur";
  const defs = '<defs>' + defsMotif(u, m, c) + '<clipPath id="' + u + 'k"><path d="' + COQUE + '"/></clipPath>' +
    '<radialGradient id="' + u + 'h" cx=".32" cy=".16" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".28" stop-color="#fff" stop-opacity=".16"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
    '<linearGradient id="' + u + 'v" x1="0" y1="0" x2="1" y2="1">' + (orv ? '<stop offset="0" stop-color="#FFE596"/><stop offset=".5" stop-color="#7A4A0C"/><stop offset="1" stop-color="#F7CF55"/>'
      : iri ? '<stop offset="0" stop-color="#7FE8FF"/><stop offset=".45" stop-color="#6A4BFF"/><stop offset=".75" stop-color="#FF6BB5"/><stop offset="1" stop-color="#FFC15E"/>'
      : '<stop offset="0" stop-color="#4a5466"/><stop offset=".45" stop-color="#090b0f"/><stop offset="1" stop-color="#232a38"/>') + "</linearGradient></defs>";
  const deco = {
    uni: '<path d="M-17 1C-6-5 7-9 23-10" stroke="#fff" stroke-width="3.4" fill="none"/><path d="M-17 5C-6-1 7-5 23-6" stroke="#11151B" stroke-width="1.2" fill="none" opacity=".55"/>',
    carbone: '<path d="M-17 2C-6-4 7-8 23-9" style="stroke:' + c + '" stroke-width="2.6" fill="none"/>',
    eclair: '<path d="M-10-17-15 0-7-2-12 12 4-6-4-5 2-17Z" fill="#FFD84A" stroke="#7A5300" stroke-width=".9"/>',
    damier: '<path d="M-17 3C-6-3 7-7 23-8" style="stroke:' + c + '" stroke-width="3.2" fill="none"/>',
    tortue: "",
    chrome: '<path d="M-17 2C-6-4 7-8 23-9" stroke="#11151B" stroke-width="1.4" fill="none" opacity=".5"/>',
    etoile: '<path d="M-17 4C-6-2 7-6 23-7" stroke="#F7CF55" stroke-width="2.4" fill="none"/><path d="M-5-15-3-9.6 2.6-9.4-1.8-6 0-.6-5-3.8-10-.6-8.2-6-12.6-9.4-7-9.6Z" fill="#FFD84A" stroke="#8A5A10" stroke-width=".7"/>',
    holo: '<path d="M-17 2C-6-4 7-8 23-9" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/>',
    couronne: '<path d="M-17 3C-6-3 7-7 23-8" stroke="#11151B" stroke-width="1.6" fill="none" opacity=".45"/>',
    foudre: '<g fill="#5CE1FF" stroke="#E6FBFF" stroke-width=".5"><path d="M-12-16-16-3-10-4.5-14 9-3-6.5-9-5.5-5-16Z"/><path d="M0 2-3 9 1 8.4-1 13 5 6.8 1.5 7.2 4 2Z" opacity=".85"/></g><path d="M-17 4C-6-2 7-6 23-7" stroke="#5CE1FF" stroke-width="1" fill="none" opacity=".7"/>',
    phenix: '<path d="M-15 6C-9-2-2-9 8-13C2-8-1-3 0 2C3-4 7-7 13-9C8-4 6 1 7 6Z" fill="#FFF1B0" opacity=".85"/><path d="M-15 6C-9 0-3-5 4-8" stroke="#7A0B10" stroke-width="1" fill="none" opacity=".6"/>',
    glace: '<g stroke="#fff" stroke-width=".7" fill="none" opacity=".9"><path d="M-12-12-7-6-9 0M-7-6-1-8M-9 0-4 4 2 2M-4 4-6 10"/><path d="M8 4 12 8 16 6M12 8 11 12" opacity=".7"/></g>',
    galaxie: '<path d="M-14 2C-8-8 6-12 14-6C6-8-4-5-8 2C-4-2 4-3 8 1" stroke="#FFB8F0" stroke-width="1.2" fill="none" opacity=".75"/><circle cx="-4" cy="-6" r="1.2" fill="#fff"/><circle cx="10" cy="5" r=".9" fill="#B9E6FF"/>',
    empereur: '<path d="M-17 1C-6-5 7-9 23-10" stroke="#F7CF55" stroke-width="3" fill="none"/><path d="M-17 4.4C-6-1.6 7-5.6 23-6.6" stroke="#F7CF55" stroke-width=".9" fill="none" opacity=".8"/><path d="M-6-14-4.6-10.6-1-10.4-3.8-8.2-2.8-4.8-6-6.8-9.2-4.8-8.2-8.2-11-10.4-7.4-10.6Z" fill="#FFE596" stroke="#7A5300" stroke-width=".5"/>'
  }[m] || "";
  const brille = ["chrome", "couronne", "empereur", "glace", "holo", "etoile", "foudre", "galaxie", "phenix"].includes(m) ? '<path class="cq-brille" d="M-34-30H-28L-40 16H-46Z" fill="#fff" opacity=".55"/>' : "";
  return defs + '<path d="' + COQUE + '" style="' + remplissage(u, m, c) + '"/>' +
    '<g clip-path="url(#' + u + 'k)">' + deco + '<path d="' + COQUE + '" fill="url(#' + u + 'h)"/>' + brille + "</g>" +
    '<path d="M3-10C10-11.5 16.5-9 20.5-4.5" stroke="#0b0d11" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M4-8C10-9 17-7 20-3V3C15 5 9 5 5 3 2.5 1 2.6-6 4-8Z" fill="url(#' + u + 'v)"/>' +
    '<path d="M6-6.6C11-7.2 16-5.6 19-3" stroke="#fff" stroke-opacity=".7" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
    '<path d="M-6-15.4l3.2-.7M-.6-16.6l3.2-.2" stroke="#0b0d11" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>' +
    '<path d="M-13.5 9.6H16.5" stroke="#0b0d11" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="' + COQUE + '" fill="none" stroke="rgba(0,0,0,.5)" stroke-width=".8"/>' +
    (m === "couronne" ? '<path d="M-10-16.5-8.5-24-4-19.5 1-26 6-19.5 10.5-24 12-16.5Z" fill="url(#' + u + 'm)" stroke="#6B430C" stroke-width=".8"/><circle cx="1" cy="-26" r="1.6" fill="#FF4D6D"/><circle cx="-8.5" cy="-24" r="1.2" fill="#5AB8FF"/><circle cx="10.5" cy="-24" r="1.2" fill="#5AB8FF"/>' : "") +
    finitionCasque(u, fin, c, lead);
}
/* Finitions (liserés autour de la coque) et liseré or du leader, porté en plus de sa finition */
function finitionCasque(u, fin, c, lead) {
  let h = "";
  if (lead) h += '<defs><linearGradient id="' + u + 'lg" x1="-20" y1="0" x2="20" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9A6716"/><stop offset=".42" stop-color="#F7CF55"/><stop offset=".5" stop-color="#FFFBE6"/><stop offset=".58" stop-color="#F7CF55"/><stop offset="1" stop-color="#9A6716"/>' +
    '<animateTransform attributeName="gradientTransform" type="translate" values="-30 0;30 0;30 0" keyTimes="0;.55;1" dur="2.8s" repeatCount="indefinite"/></linearGradient></defs>' +
    '<path d="' + COQUE + '" fill="none" stroke="#2A1A03" stroke-width="4.2"/><path class="lead-or" d="' + COQUE + '" fill="none" stroke="url(#' + u + 'lg)" stroke-width="2.6"/>' +
    '<path class="lead-etoile" d="M15 -24.5L16 -21.6 19 -20.8 16 -19.9 15 -17 14 -19.9 11 -20.8 14 -21.6Z" fill="#FFF6CC" stroke="#9A6716" stroke-width=".4"/>';
  const lis = (col, w, extra) => '<path d="' + COQUE + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (extra || "") + "/>";
  if (fin === "argent") h += lis("#5A626D", 2.6) + lis("#F2F5F8", 1.3);
  else if (fin === "or") h += lis("#6B430C", 2.6) + lis("#F7CF55", 1.4);
  else if (fin === "neon") h += '<path class="fin-neon" d="' + COQUE + '" fill="none" style="stroke:' + c + ';filter:drop-shadow(0 0 2px ' + c + ') drop-shadow(0 0 4px ' + c + ')" stroke-width="1.6"/>';
  else if (fin === "diamant") h += lis("#2B5F72", 2.4) + lis("#C9F6FF", 1.3) +
    [[-13, -12, 2.6], [17, -9, 2.1], [8, 10, 1.8]].map(([x, y, r]) => '<path class="fin-eclat" d="M' + x + " " + (y - r) + "L" + (x + r * .3) + " " + (y - r * .3) + "L" + (x + r) + " " + y + "L" + (x + r * .3) + " " + (y + r * .3) + "L" + x + " " + (y + r) + "L" + (x - r * .3) + " " + (y + r * .3) + "L" + (x - r) + " " + y + "L" + (x - r * .3) + " " + (y - r * .3) + 'Z" fill="#fff"/>').join("");
  else if (fin === "etoilee") h += lis("#6B430C", 2.4) + lis("#F7CF55", 1.2) +
    [[-14, -6], [-6, -17], [6, -17], [16, -9], [19, 5]].map(([x, y]) => '<path d="M' + x + " " + (y - 2.6) + "L" + (x + .8) + " " + (y - .8) + "L" + (x + 2.6) + " " + (y - .6) + "L" + (x + 1.2) + " " + (y + .7) + "L" + (x + 1.6) + " " + (y + 2.6) + "L" + x + " " + (y + 1.5) + "L" + (x - 1.6) + " " + (y + 2.6) + "L" + (x - 1.2) + " " + (y + .7) + "L" + (x - 2.6) + " " + (y - .6) + "L" + (x - .8) + " " + (y - .8) + 'Z" fill="#FFE596" stroke="#7A5300" stroke-width=".35"/>').join("");
  else if (fin === "soleil") h += '<g class="fin-soleil">' + [-150, -125, -100, -75, -50, -25, 0].map(a => { const r = a * Math.PI / 180, cx = 2.5, cy = -2; return '<path d="M' + (cx + 19 * Math.cos(r)).toFixed(1) + " " + (cy + 19 * Math.sin(r)).toFixed(1) + "L" + (cx + 24 * Math.cos(r)).toFixed(1) + " " + (cy + 24 * Math.sin(r)).toFixed(1) + '" stroke="#FFB21E" stroke-width="1.6" stroke-linecap="round"/>'; }).join("") + "</g>" +
    '<path d="' + COQUE + '" fill="none" stroke="#FF8A1F" stroke-width="2.4" style="filter:drop-shadow(0 0 2px #FFB21E)"/>' + lis("#FFE596", 1);
  else if (fin === "lauriers") {
    const feuilles = (sens) => [0, 1, 2, 3, 4].map(i => { const t = i / 4, x = sens < 0 ? -13 - 3 * Math.sin(t * 2.4) : 18 + 3 * Math.sin(t * 2.4), y = 12 - t * 20, a = sens < 0 ? -30 - t * 40 : 30 + t * 40;
      return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="1.5" ry="3.3" transform="rotate(' + a.toFixed(0) + " " + x.toFixed(1) + " " + y.toFixed(1) + ')" fill="#E9C25A" stroke="#6B4B0C" stroke-width=".45"/>'; }).join("");
    h += '<path d="M-12 13C-18 6-18-3-15-9M17 13C23 6 23-3 21-9" stroke="#8A6414" stroke-width=".9" fill="none"/>' + feuilles(-1) + feuilles(1);
  }
  return h;
}
/** Avatar public : le casque (avec sa finition) dans une pastille dont le fond se débloque en course */
const CASQUE_CACHE = true;   // V16.26 : « Mon casque » masqué en attendant d'être redessiné (demande de Théo) : tout le monde affiche sa tête
/** V16.37 · l'accessoire mérité : le vainqueur de la dernière manche garde l'accessoire du circuit sur sa tête jusqu'à la manche suivante.
 *  Dès janvier (pas pendant la chauffe), et seulement quand on a déjà regardé la course (le résultat reste caché jusque-là). */
let MERITE = null;
function accessoireMerite(nom) {
  try {
    const y = saisonCourante(), vu = +(stock.get("versus.gpVu." + y) || 0);
    if (!MERITE || MERITE.d !== D || MERITE.vu !== vu || MERITE.y !== y) {
      MERITE = { d: D, vu, y, n: {} };
      if (!estChauffe(y) && window.Piste) { const et = etapesGP(y).filter(x => x.m && !x.avenir), der = et[et.length - 1];
        if (der && der.k && vu >= der.k) { const cle = (Piste.TRACES[circuitDe(der.k)] || {}).peint; if (cle) (der.m.l || []).filter(x => x.rg === 1).forEach(x => MERITE.n[x.nom] = cle); } }
    }
    return MERITE.n[nom] || null;
  } catch (er) { return null; }
}
function avatar(nom, e) {
  let eq = e || equipDe(nom); if (!e) { const sk = accessoireMerite(nom); if (sk) eq = Object.assign({}, eq, { skin: sk }); }
  const tete = CASQUE_CACHE || (eq.pilote || "tete") === "tete";
  const lead = tete && !eq.vignette && saisonVisible() && leaderSaison() === nom;
  return '<span class="av av-' + (eq.fond || "couleur") + (tete ? " av-tete" : "") + (lead ? " av-lead" : "") + ((ereDorActive() || {}).nom === nom ? " av-or" : "") + '" style="--c:' + couleur(nom) + '">' + (tete ? svgTete(nom, eq, eq.vignette) : svgCasque(nom, eq)) + "</span>";
}
function svgCasque(nom, e) {
  const eq = e || equipDe(nom), u = "sv" + (++NSVG), c = couleur(nom), lead = !eq.vignette && saisonVisible() && leaderSaison() === nom;
  return '<svg class="casque c-' + eq.casque + (lead ? " leader" : "") + '" viewBox="-17 -27 39 40" aria-hidden="true">' + casqueForme(u, eq.casque, c, eq.finition, lead) + "</svg>";
}

/* ---------- Voiture : F1 de profil, ombrée, avec reflet au sol ---------- */
/** o = { nom, e (équipement), drapeau (texte ou null), roule, reflet, label } */
function svgVoiture(o) {
  const u = "sv" + (++NSVG), c = couleur(o.nom), e = o.e, lv = e.livree, avecDrapeau = o.drapeau !== undefined && o.drapeau !== null;
  const haut = avecDrapeau ? 92 : 10, sol = haut + 150, H = sol + (o.reflet ? 46 : 10);
  const neon = lv === "neon";
  const peinture = neon ? "fill:#0a0c11" : remplissage(u, lv === "couleur" ? "" : lv, c);
  const filet = neon ? c : lv === "or" || lv === "oranime" ? "#3B2405" : lv === "chrome" || lv === "platine" || lv === "orrose" ? "#11151B" : lv === "rubis" ? "#FFD1DC" : lv === "galaxie" ? "#FFB8F0" : "#ffffff";
  const CORPS = "M36 112L40 98C70 94 110 88 140 82C156 76 178 56 196 48L210 48C213 58 215 72 216 86L262 86C276 88 300 92 330 96L420 104C440 106 452 110 458 114L456 119C420 121 380 121 330 122L120 124L40 124Z";
  const PONTON = "M118 123C124 106 148 97 184 95L298 94C305 94 309 98 309 104V122Z";
  const traineeFx = {
    simple: '<g class="vt-lignes" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".35"><path d="M-20 74h42M-34 96h56M-16 116h36"/></g>',
    halo: '<path d="M-30 102C10 100 50 98 170 98" style="stroke:' + c + ';filter:blur(8px)" stroke-width="40" stroke-linecap="round" opacity=".42"/>',
    flammes: '<g class="vt-flamme"><path d="M36 92C10 78-12 98-40 84-20 100-36 108-60 108-30 118-4 108 36 112Z" fill="#FF6A1A" opacity=".9"/><path d="M36 98C18 90 2 102-16 96-2 108 14 108 36 108Z" fill="#FFD23F"/><path d="M36 101C26 98 18 104 8 101 16 106 26 106 36 105Z" fill="#fff" opacity=".8"/></g>',
    etincelles: '<g class="vt-etin" fill="#FFD84A">' + [[24, 88], [12, 100], [2, 84], [16, 112], [-6, 104], [6, 72], [-14, 92]].map(([x, y], i) => '<circle cx="' + x + '" cy="' + y + '" r="' + (2.8 - i * .25) + '"/>').join("") + "</g>",
    supernova: '<defs><radialGradient id="' + u + 'sn"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#D9C9FF"/><stop offset="1" stop-color="#7A5CFF" stop-opacity="0"/></radialGradient></defs>' +
      '<g class="vt-nova"><path d="M140 82L-50 102 140 120Z" fill="#9D86FF" opacity=".35"/><circle cx="-6" cy="100" r="22" fill="url(#' + u + 'sn)"/>' +
      [[-6, 100, 9], [30, 86, 5], [20, 116, 4], [-34, 92, 4], [-30, 112, 3]].map(([x, y, r]) => '<path d="M' + x + " " + (y - r * 2) + "L" + (x + r * .4) + " " + (y - r * .4) + "L" + (x + r * 2) + " " + y + "L" + (x + r * .4) + " " + (y + r * .4) + "L" + x + " " + (y + r * 2) + "L" + (x - r * .4) + " " + (y + r * .4) + "L" + (x - r * 2) + " " + y + "L" + (x - r * .4) + " " + (y - r * .4) + 'Z" fill="#fff"/>').join("") + "</g>",
    turbo: '<g class="vt-lignes" stroke="#5AB8FF" stroke-linecap="round"><path d="M-40 80h70M-60 94h96M-30 106h64M-52 118h80" stroke-width="3.4" opacity=".8"/><path d="M-20 87h40M-36 112h50" stroke="#fff" stroke-width="1.6" opacity=".9"/></g>',
    arcenciel: '<g class="vt-arc" opacity=".85">' + ["#FF5A5F", "#FFB547", "#E9F27A", "#3DDC97", "#4C9AFF", "#B57BFF"].map((col, i) => '<path d="M140 ' + (84 + i * 6) + 'C80 ' + (82 + i * 6) + " 10 " + (78 + i * 7) + " -70 " + (70 + i * 9) + '" stroke="' + col + '" stroke-width="6" fill="none" stroke-linecap="round"/>').join("") + "</g>",
    comete: '<defs><linearGradient id="' + u + 'q" x1="1" x2="0"><stop offset="0" style="stop-color:' + c + '"/><stop offset="1" style="stop-color:' + c + '" stop-opacity="0"/></linearGradient></defs><path d="M140 78L-60 100 140 122Z" fill="url(#' + u + 'q)" opacity=".8"/>'
  }[e.trainee] || "";
  const roue = (x, y, r) => '<g transform="translate(' + x + " " + y + ')"><circle r="' + r + '" fill="url(#' + u + 'pn)"/><circle r="' + (r - 1.5) + '" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1"/>' +
    '<circle r="' + (r * .8).toFixed(1) + '" fill="none" stroke="#F7CF55" stroke-width="1.6" opacity=".85"/><path d="M' + (-r * .7).toFixed(1) + " " + (-r * .7).toFixed(1) + "A" + r + " " + r + " 0 0 1 " + (r * .7).toFixed(1) + " " + (-r * .7).toFixed(1) + '" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/>' +
    '<circle r="' + (r * .64).toFixed(1) + '" fill="url(#' + u + 'jd)"/><circle r="' + (r * .64).toFixed(1) + '" fill="none" stroke="url(#' + u + 'ja)" stroke-width="1.6"/><g class="vt-jante">' +
    [0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map(a => '<path d="M0 ' + (-r * .17).toFixed(1) + "L0 " + (-r * .56).toFixed(1) + '" stroke="url(#' + u + 'ja)" stroke-width="1.8" opacity=".85" transform="rotate(' + a + ')"/>').join("") +
    '</g><circle r="' + (r * .16).toFixed(1) + '" style="fill:' + c + '"/><circle r="' + (r * .07).toFixed(1) + '" fill="#fff" opacity=".7"/></g>';
  let drap = "", bras = "";
  if (avecDrapeau) {
    const t = String(o.drapeau), fs = t.length <= 4 ? 50 : t.length <= 5 ? 44 : 36;
    drap = '<path d="M276 ' + (haut + 60) + 'L276 6" stroke="#C9CFD6" stroke-width="4" stroke-linecap="round"/>' +
      '<g class="vt-drapeau"><clipPath id="' + u + 'f"><path d="M278 8C312 0 350 16 386 8S446 0 470 8V94C446 86 418 100 386 94S312 86 278 94Z"/></clipPath>' +
      '<g clip-path="url(#' + u + 'f)"><rect x="276" y="0" width="196" height="104" fill="#FBFBF8"/><rect x="446" y="0" width="26" height="104" fill="url(#' + u + 'd)"/><rect x="276" y="0" width="196" height="104" fill="url(#' + u + 'o)"/></g>' +
      '<text id="t-compte" x="362" y="' + (51 + fs * .36).toFixed(0) + '" text-anchor="middle" style="font:italic 800 ' + fs + 'px var(--f-display);letter-spacing:.02em;fill:#11151B">' + esc(t) + "</text></g>" +
      '<defs><pattern id="' + u + 'd" width="13" height="13" patternUnits="userSpaceOnUse"><rect width="13" height="13" fill="#fff"/><rect width="6.5" height="6.5" fill="#111"/><rect x="6.5" y="6.5" width="6.5" height="6.5" fill="#111"/></pattern>' +
      '<linearGradient id="' + u + 'o" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".3" stop-color="#000" stop-opacity=".1"/><stop offset=".55" stop-color="#fff" stop-opacity=".2"/><stop offset=".8" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>';
    bras = '<path d="M268 ' + (haut + 88) + 'L276 ' + (haut + 50) + '" style="stroke:' + c + '" stroke-width="7.5" stroke-linecap="round"/><path d="M268 ' + (haut + 88) + 'L276 ' + (haut + 50) + '" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="270.5" y="' + (haut + 43) + '" width="11" height="10" rx="4" fill="#1b1f26"/><rect x="270.5" y="' + (haut + 49) + '" width="11" height="3" style="fill:' + c + '"/>';
  }
  const defs = '<defs>' + defsMotif(u, lv === "couleur" || neon ? "" : lv, c) +
    '<linearGradient id="' + u + 'sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".22" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>' +
    '<linearGradient id="' + u + 'cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f38"/><stop offset="1" stop-color="#0a0c0f"/></linearGradient>' +
    '<radialGradient id="' + u + 'pn" cx=".42" cy=".36" r=".7"><stop offset="0" stop-color="#3a3f48"/><stop offset=".75" stop-color="#121418"/><stop offset="1" stop-color="#050607"/></radialGradient>' +
    '<radialGradient id="' + u + 'ja" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#aeb6c1"/><stop offset="1" stop-color="#4b525c"/></radialGradient>' +
    '<radialGradient id="' + u + 'jd" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#4a515b"/><stop offset=".7" stop-color="#1b1f25"/><stop offset="1" stop-color="#0d0f12"/></radialGradient>' +
    '<linearGradient id="' + u + 'ti" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6570"/><stop offset=".5" stop-color="#f2f4f6"/><stop offset="1" stop-color="#7b838e"/></linearGradient>' +
    '<linearGradient id="' + u + 'br" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<clipPath id="' + u + 'cl"><path d="' + CORPS + '"/><path d="' + PONTON + '"/></clipPath>' +
    '<filter id="' + u + 'fl" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>' +
    (o.reflet ? '<linearGradient id="' + u + 'rm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="' + u + 'mk" maskUnits="userSpaceOnUse" x="0" y="' + sol + '" width="480" height="60"><rect x="0" y="' + sol + '" width="480" height="60" fill="url(#' + u + 'rm)"/></mask>' : "") + "</defs>";
  const voiture = '<g id="' + u + 'car"><g class="vt-caisse">' +
    // aileron arrière
    '<path d="M8 30L32 26 36 110 14 112Z" fill="url(#' + u + 'cb)"/><path d="M8 30L32 26 32.5 32 8.5 36Z" style="fill:' + (neon ? c : c) + '"/>' +
    '<path d="M44 56L52 56 58 100 48 102Z" fill="url(#' + u + 'cb)"/>' +
    '<path d="M2 50C18 44 40 44 62 48L62 55C40 53 18 53 2 59Z" fill="url(#' + u + 'cb)"/>' +
    '<path d="M4 34C20 28 42 28 62 32L62 39C42 37 20 37 4 43Z" style="' + peinture + '"/><path d="M4 34C20 28 42 28 62 32L62 39C42 37 20 37 4 43Z" fill="url(#' + u + 'sh)"/>' +
    '<text x="33" y="38.5" text-anchor="middle" style="font:italic 800 6.5px var(--f-display);letter-spacing:.12em;fill:' + (["chrome", "or", "oranime", "platine", "orrose"].includes(lv) ? "#11151B" : "#fff") + '" opacity=".9">VERSUS</text>' +
    // fond plat et diffuseur
    '<path d="M28 122L420 122 422 129 70 132 30 128Z" fill="url(#' + u + 'cb)"/>' +
    // caisse et ponton
    '<path d="' + CORPS + '" style="' + peinture + '"/><path d="' + PONTON + '" style="' + peinture + '"/>' +
    '<g clip-path="url(#' + u + 'cl)">' +
      (neon ? '<path d="M120 112H308M150 100H290" style="stroke:' + c + ';filter:drop-shadow(0 0 3px ' + c + ')" stroke-width="1.6"/>' : "") +
      '<rect x="0" y="113" width="480" height="20" fill="url(#' + u + 'cb)" opacity=".92"/>' +
      '<path d="M0 113H480" stroke="' + filet + '" stroke-width="1.6" opacity=".9"/>' +
      '<rect x="0" y="40" width="480" height="92" fill="url(#' + u + 'sh)"/>' +
      (["oranime", "chrome", "or", "platine", "rubis", "orrose"].includes(lv) ? '<rect class="vt-brille" x="-90" y="40" width="70" height="92" fill="url(#' + u + 'br)" transform="skewX(-20)" opacity="' + (lv === "oranime" ? ".9" : ".35") + '"/>' : "") +
    "</g>" +
    (neon ? '<path d="' + CORPS + '" fill="none" style="stroke:' + c + ';filter:drop-shadow(0 0 4px ' + c + ') drop-shadow(0 0 9px ' + c + ')" stroke-width="2"/>' : "") +
    // entrée d'air du ponton, reflets
    '<path d="M298 96C304 96 307 99 307 104V112H300Z" fill="#07080b"/>' +
    '<path d="M142 83C160 76 178 58 196 50" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M278 90C320 95 380 101 444 108" stroke="#fff" stroke-opacity=".5" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
    '<path d="M190 96L296 95" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" fill="none"/>' +
    // caméra, rétroviseur, numéro
    '<rect x="197" y="43" width="12" height="5" rx="1.5" fill="#0b0d11"/><rect x="199" y="44" width="8" height="1.6" style="fill:' + c + '"/>' +
    '<path d="M284 92L286 84" stroke="#0b0d11" stroke-width="2"/><rect x="278" y="78" width="15" height="7" rx="3" style="' + peinture + '"/><rect x="278" y="78" width="15" height="7" rx="3" fill="url(#' + u + 'sh)"/>' +
    '<text x="250" y="117" text-anchor="middle" style="font:italic 800 21px var(--f-display);fill:' + (["chrome", "or", "oranime", "platine", "orrose"].includes(lv) ? "#11151B" : "#fff") + ';stroke:rgba(0,0,0,.35);stroke-width:.6;paint-order:stroke">' + e.numero + "</text>" +
    '<text x="160" y="108" text-anchor="middle" style="font:italic 800 8px var(--f-display);letter-spacing:.2em;fill:' + (["chrome", "or", "oranime", "platine", "orrose"].includes(lv) ? "#11151B" : "#fff") + '" opacity=".75">VERSUS</text>' +
    // pilote, rebord du cockpit, halo
    '<g transform="translate(236 75) scale(1.08)">' + casqueForme(u + "c", e.casque, c, e.finition) + "</g>" +
    '<path d="M214 87C230 83 250 83 264 87" stroke="#0b0d11" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M212 74C224 57 252 56 268 86" fill="none" stroke="url(#' + u + 'ti)" stroke-width="4.6" stroke-linecap="round"/>' +
    // aileron avant
    '<path d="M420 104L420 128" stroke="#0b0d11" stroke-width="2.4"/>' +
    '<path d="M376 132C400 128 430 128 466 132L466 136C430 134 400 134 376 138Z" fill="url(#' + u + 'cb)"/>' +
    '<path d="M386 126C408 122 436 123 462 126L462 129.5C436 127 408 127 386 131Z" style="' + peinture + '"/><path d="M386 126C408 122 436 123 462 126L462 129.5C436 127 408 127 386 131Z" fill="url(#' + u + 'sh)"/>' +
    '<path d="M458 116L466 116 468 142 456 142Z" fill="url(#' + u + 'cb)"/>' +
    "</g>" + roue(98, 116, 34) + roue(372, 119, 31) + "</g>";
  return '<svg class="voiture' + (o.roule ? " roule" : "") + (o.idle ? " idle" : "") + '" viewBox="0 0 480 ' + H + '" role="img" aria-label="' + esc(o.label || "Voiture de " + o.nom) + '">' + defs +
    '<g class="vt-sol"><path d="M0 ' + sol + 'H480" stroke="currentColor" stroke-width="1.5" opacity=".22" stroke-dasharray="26 18"/></g>' + drap +
    '<ellipse cx="240" cy="' + (sol - 2) + '" rx="215" ry="7" fill="#000" opacity=".55" filter="url(#' + u + 'fl)"/>' +
    '<g transform="translate(6 ' + haut + ')"><g class="vt-trainee">' + traineeFx + "</g>" + voiture + "</g>" + bras +
    (o.reflet ? '<g mask="url(#' + u + 'mk)"><use href="#' + u + 'car" transform="translate(6 ' + (2 * sol - haut) + ') scale(1 -1)"/></g>' : "") +
    "</svg>";
}

/* ---------- Teaser : la voiture, le drapeau, le compte à rebours ---------- */
function compteRebours(maintenant) {
  const ms = SAISON.chauffe - maintenant;
  if (ms <= 0) return "GO";
  if (ms <= 3600e3) return Math.ceil(ms / 60e3) + " min";
  if (ms <= 96 * 3600e3) return Math.ceil(ms / 3600e3) + " h";
  return "J-" + Math.round((SAISON.chauffe - new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())) / 864e5);
}
function teaser() {
  const now = new Date(), noel = now >= SAISON.noel;
  const qui = D.personnes.some(p => p.nom === ETAT.moi) ? ETAT.moi : (D.personnes[0] || {}).nom;
  const e = Object.assign({}, BASE_ECURIE, { numero: numeroParDefaut(qui) });
  return '<section class="teaser">' + svgVoiture({ nom: qui, e, drapeau: compteRebours(now), roule: true, reflet: true, label: "Tour de chauffe le 1er décembre, saison 1 le 1er janvier 2027" }) +
    '<div class="t-txt"><div class="t-saison">Saison 1</div><div class="t-date">🔥 Tour de chauffe le 1<sup>er</sup> décembre · 🏁 départ le 1<sup>er</sup> janvier 2027</div>' +
    '<p class="t-phrase">Tout le monde sur la ligne de départ.<br>Même point de départ, mêmes chances.</p>' +
    (noel ? '<div class="t-concept">' +
      '<div><b>🔥 Tour de chauffe</b><span>Décembre pour découvrir les règles, sans que rien ne compte. Vos cartes de janvier se posent pendant les fêtes.</span></div>' +
      '<div><b>🏁 Championnat</b><span>Chaque mois : ' + baremeJ().join(", ") + ' points, et +1 🎯 si tu bats le ' + esc(D.marche.indices[iRef()]) + '.</span></div>' +
      '<div><b>🏎️ Grand Prix</b><span>Un circuit à thème par mois, de la Mer de dunes au Multivers. Vos voitures en 3D, 25 points le tour, la météo du marché.</span></div>' +
      '<div><b>🃏 Cartes de course</b><span>4 cartes de stratégie, les mêmes pour tous. Une par mois, face cachée.</span></div>' +
      '<div><b>🎁 Nouveautés en cours de saison</b><span>' + etapesJeu().map(e => e.ico + " " + esc(e.nom) + " (" + esc(moisEtape(e).replace(/ \d{4}$/, "")) + ")").join(" · ") + ". Chaque règle est expliquée le 20 du mois d'avant, quand sa fenêtre s'ouvre.</span></div>" +
      '<div><b>🙂 Ta tête au volant</b><span>Ton portrait animé, ou ton casque, à côté de ton nom. Et 24 objets uniques à rafler les premiers.</span></div></div>' +
      '<button class="btn acc" type="button" id="teaser-regles">📖 Lire toutes les règles</button>' +
      '<p class="t-note">Tout repart de zéro le 1<sup>er</sup> janvier : ce qui s\'est passé avant ne compte pas.</p>'
      : '<p class="t-note">On en dit plus le samedi 21 novembre.</p>') + "</div>" +

    "</section>";
}
let MINUTEUR_TEASER = null;
function animerCompte() {
  clearInterval(MINUTEUR_TEASER);
  MINUTEUR_TEASER = setInterval(() => {
    const t = document.getElementById("t-compte");
    if (!t || vueActive() !== "trophees") { clearInterval(MINUTEUR_TEASER); return; }
    if (chauffeOuverte()) { clearInterval(MINUTEUR_TEASER); rendreTrophees(); return; }
    const txt = compteRebours(new Date());
    if (t.textContent !== txt) { t.textContent = txt; const fs = txt.length <= 4 ? 50 : txt.length <= 5 ? 44 : 36; t.style.fontSize = fs + "px"; t.setAttribute("y", (51 + fs * .36).toFixed(0)); }
  }, 20000);
}

/* ---------- Bloc saison : Course · Stand · Écurie · Défis ---------- */
let ECU = null;   // brouillon de l'écurie en cours de réglage
/* ---------- Barre admin du Podium : tout afficher, voir comme un joueur, ou le réel d'aujourd'hui ---------- */
function modeAdmin() { return vueJoueur() ? "joueur" : apercuSaison() ? "tout" : "reel"; }
function barreAdmin() {
  const m = modeAdmin(), b = (id, lib) => '<button type="button" data-madm="' + id + '" aria-pressed="' + (m === id) + '">' + lib + "</button>";
  const desc = m === "tout" ? "La saison 2027 simulée : les circuits et les règles de 2027, joués avec nos vrais résultats de 2026. Rien de ce que tu fais ici n'est vu par les autres."
    : m === "joueur" ? "Ce que tu vois en simple joueur, sans tes droits d'admin" + (window.DATE_SIM ? ", au " + esc(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })) : ", aujourd'hui") + ". Rien n'est envoyé."
    : "Ce que tout le monde voit aujourd'hui, pour de vrai. Ici, tes actions comptent.";
  let plus = "";
  if (m === "joueur") {
    const vj = stock.get("versus.vueJoueur") || "", ds = stock.get("versus.dateSim") || "";
    plus = '<div class="ba-l"><span>Date</span><div class="ba-o">' + DATES_SIM.map(([d, l]) => '<button type="button" data-badate="' + d + '" aria-pressed="' + (ds === d) + '">' + esc(l) + "</button>").join("") + "</div></div>";
  }
  /* V16.63 · avant le 1er décembre : un raccourci vers le tour de chauffe tel que les joueurs le verront (admin seulement, simulation : rien n'est envoyé) */
  const dec = !chauffeOuverte() && !(m === "joueur" && (stock.get("versus.dateSim") || "").startsWith("2026-12")) ? '<button type="button" class="ba-dec" data-badec="1">🔥 Voir décembre · l’Atelier du Père Noël, comme les joueurs le 3 décembre</button>' : "";
  const circ = '<button type="button" class="ba-dec" data-bacirc="1">🗺️ Circuits 2027 · les 13 circuits en 2D et en 3D (aperçu)</button>';   // v16.81
  return '<div class="barre-admin"><div class="ba-h"><b>👑 Admin</b><div class="ba-seg">' + b("tout", "Tout afficher") + b("joueur", "Vue joueur") + b("reel", "Le réel") + "</div></div>" + plus + dec + circ + "<small>" + desc + "</small></div>";
}
function brancherBarreAdmin(v) {
  const reglerMode = m => {
    if (m === "tout") { stock.set("versus.apercuSaison", "1"); stock.del("versus.vueJoueur"); }
    else if (m === "reel") { stock.set("versus.apercuSaison", "0"); stock.del("versus.vueJoueur"); }
    else { stock.set("versus.apercuSaison", "0"); stock.set("versus.vueJoueur", joueurAdmin()); if (!stock.get("versus.dateSim") && !chauffeOuverte()) stock.set("versus.dateSim", "2026-12-03"); }
    if (m !== "joueur" && window.DATE_SIM) stock.del("versus.dateSim");
    location.reload();   // l'horloge simulée et la mémoire de session se règlent au chargement
  };
  v.querySelectorAll("[data-madm]").forEach(x => x.addEventListener("click", () => reglerMode(x.dataset.madm)));
  v.querySelectorAll("[data-bacirc]").forEach(x => x.addEventListener("click", () => ouvrirCircuits2027()));
  v.querySelectorAll("[data-badec]").forEach(x => x.addEventListener("click", () => { stock.set("versus.apercuSaison", "0"); stock.set("versus.vueJoueur", joueurAdmin()); stock.set("versus.dateSim", "2026-12-03"); ETAT.podium = "gp"; GP_ETAPE = null; garder(); location.reload(); }));
  v.querySelectorAll("[data-badate]").forEach(x => x.addEventListener("click", () => { if (x.dataset.badate) stock.set("versus.dateSim", x.dataset.badate); else stock.del("versus.dateSim"); location.reload(); }));
}
function blocSaison() {
  const ys = anneesPodium(), y = saisonCourante(), ch = estChauffe(y);
  const o = ongletPodium();
  const b = (id, lib) => '<button type="button" data-pod="' + id + '" aria-pressed="' + (o === id) + '">' + lib + "</button>";
  return '<section class="saison"><div class="saison-h"><div><span class="s-k">' + (ch ? "Tour de chauffe · décembre 2026" : "Saison " + numeroSaison(y) + " · " + y + (apercuSaison() ? " (répétition)" : "")) + "</span><h2>" + (ch ? "La chauffe" : "Le championnat") + '</h2></div><div class="s-droite">' +
    '<button class="regles-b" type="button" id="regles-ouvrir" aria-label="Règles du jeu">' + icoOu("regles", "📖") + ' Règles</button></div></div>' +
    (ys.length > 1 ? '<div class="s-ys">' + ys.map(a => '<button type="button" class="chip-s' + (a === y ? " on" : "") + '" data-saison="' + a + '">' + (estChauffe(a) ? "🔥 Chauffe" : "Saison " + numeroSaison(a)) + "</button>").join("") + "</div>" : "") +
    (ch ? '<div class="chauffe-b">🔥 <span><b>Tour de chauffe</b> : les règles de base, et rien ne compte. Le championnat démarre le 1<sup>er</sup> janvier. <a href="#" class="lien-regles" data-regles="speciaux">En savoir plus</a></span></div>' : "") +
    '<div class="pod-tabs" role="group" aria-label="Saison">' + b("gp", "<span>" + icoOu("course", "🏁") + "</span>Course") + b("stand", "<span>" + icoOu("stand", "🃏") + "</span>Stand" + (rappelCartes() ? '<i class="pastille" aria-label="à faire"></i>' : "")) + (basesSeules() ? "" : b("ecurie", "<span>" + icoOu("ecurie", "🏎️") + "</span>Écurie") + b("defis", "<span>" + icoOu("trophees", "🏆") + "</span>Trophées")) + "</div>" +
    '<div class="s-corps">' + (o === "ecurie" ? htmlEcurie() : o === "defis" ? htmlDefis() : o === "stand" ? htmlStand(y) : htmlGrandPrix(y)) + "</div>" +
    (adminActif() && !window.APERCUS_FINIS ? '<button class="reserve-b" type="button" id="reserve-ouvrir">🧪 <span><b>Règles et idées en réserve</b><small>admin · ce qui est en jeu, ce qui dort, les réglages</small></span> ›</button>' : "") + "</section>";
}
/** Onglet du Podium : l'ancien « Championnat » est maintenant dans le Grand Prix */
function ongletPodium() { return (basesSeules() ? ["gp", "stand"] : ["gp", "stand", "ecurie", "defis"]).includes(ETAT.podium) ? ETAT.podium : "gp";
}
/** Détail des points (l'ancien onglet Championnat), replié sous la course */
function htmlDetailPoints(y) {
  const c = championnat(y); if (!c.mois.length) return "";
  const noms = c.classement;
  const tab = '<div class="scroll-x"><table class="tab ch-t"><thead><tr><th>Mois</th>' + noms.map(n => '<th><i style="background:' + couleur(n) + '"></i>' + esc(n) + "</th>").join("") + "</tr></thead><tbody>" +
    c.mois.slice().reverse().map(m => "<tr><td>" + GPS[circuitDe(m.k)].drap + " " + esc(moisCourt(m.k)) + (m.spec ? " " + m.spec.ico : "") + "</td>" + noms.map(n => { const x = m.l.find(z => z.nom === n); return x ? '<td class="' + (x.rg === 1 ? "r1" : "") + '">' + x.p + (x.bonus ? "<sup>🎯</sup>" : "") + "</td>" : '<td class="muted">·</td>'; }).join("") + "</tr>").join("") +
    "</tbody></table></div>";
  const bilan = noms.map(n => { const t = c.tot[n]; return "<li><b>" + esc(n) + "</b> : " + t.pts + " pts · " + t.v + " victoire" + (t.v > 1 ? "s" : "") + " · " + t.pod + " podium" + (t.pod > 1 ? "s" : "") + " · " + t.bonus + " 🎯</li>"; }).join("");
  return (c.complete ? '<div class="bref">🏆 <b>' + esc(c.classement[0]) + "</b> " + (c.chauffe ? "remporte le tour de chauffe." : "est champion de la saison " + numeroSaison(y) + ".") + "</div>" : "") +
    '<details class="pts-det" id="pts-det"' + (ETAT.ptsOuvert === "1" ? " open" : "") + '><summary>📊 Détail des points <small>courbe, mois par mois, barème</small></summary>' +
    '<ul class="pts-bilan">' + bilan + "</ul>" + boiteGraphe("g-champ", noms.map(n => ({ nom: n, c: couleur(n) }))) + tab +
    '<p class="info">Chaque mois : ' + baremeJ().join(" · ") + ' points, <b>+1</b> 🎯 si ton mois bat le ' + esc(D.marche.indices[iRef()]) + ", plus les cartes" + (regleVisible("duels") ? " et les duels" : "") + ". Ex æquo : même place, mêmes points. À égalité au total : le plus de victoires, puis la meilleure performance.</p></details>";
}
function dessinerChampionnat(y) {
  const box = $("#g-champ"); if (!box) return;
  const c = championnat(y), ks = [c.deb].concat(c.mois.map(m => m.k));
  tracer(box, { x: ks, series: c.classement.map(n => ({ nom: n, v: [0].concat(c.mois.map(m => m.cumul[n] !== undefined ? m.cumul[n] : null)), c: couleur(n), w: n === ETAT.moi ? 2.8 : 2, fx: equipDe(n).trainee })),
    finEtiq: true, h: 190, fmt: x => x + " pts", fmtAxe: t => Number.isInteger(t) ? String(t) : "", titreX: k => k === c.deb ? "Départ" : "Fin " + moisCourt(k) });
}
function quiEcurie() { return moiVrai(); }
/* V16.24 · « Mon portrait » : la tête de chacun se règle hors de l'Écurie (Réglages, ou toucher sa tête dans le Classement), dès le tour de chauffe */
/** V16.56 · « Mon portrait » s'ouvre à tous le samedi 21 novembre 2026 à 11 h (heure de Paris) ; l'admin le voit avant */
const PORTRAIT_OUVRE = Date.UTC(2026, 10, 21, 10, 0);
function portraitDispo() { return (adminActif() && !vueJoueur()) || Date.now() >= PORTRAIT_OUVRE; }   // v16.71 : avant le 21/11, seulement en mode admin actif (avant : visible avec la clé admin même en mode non admin)
function ouvrirPortrait() {
  if (!portraitDispo()) { toast("👤 Mon portrait arrive samedi 21 novembre à 11 h."); return; }
  const qui = quiEcurie(); if (!qui || !D) { toast("Choisis d'abord qui tu es dans les Réglages."); return; }
  const rg = document.getElementById("reglages"); if (rg && !rg.hidden) rg.hidden = true;
  ECU = { nom: qui, e: equipDe(qui) };
  const o = document.createElement("div"); o.className = "regles portrait"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Mon portrait");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>👤 Mon portrait</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div><div class="rg-corps">' +
    '<div class="showroom pt-apercu"><div class="sr-id">' + avatar(qui, Object.assign({}, ECU.e, { vignette: true })) + "<b>" + esc(qui) + '</b></div></div>' + htmlPilote(qui, ECU.e) +
    '<div class="btn-row"><button class="btn acc" type="button" id="pt-garder">Enregistrer</button></div><p class="info">Ton portrait s\'affiche dans le Classement, la Course et partout ailleurs. Tout le monde le voit.</p></div></div>';
  document.body.appendChild(o);
  const fermer = () => { o.remove(); ECU = null; };
  o.addEventListener("click", ev => { if (ev.target === o) fermer(); }); o.querySelector(".rg-x").addEventListener("click", fermer);
  o.querySelector("#pt-garder").addEventListener("click", () => { o.remove(); garderEcurie(); try { rendreVue(vueActive()); } catch (e) { } });
  brancherPilote(o);
}
/* V16.26 · la bulle « Fais ton portrait ! » : une seule fois, pour qui n'a jamais réglé sa tête, à partir du lancement */
function bullePortrait(essai) {
  try {
    if (SOURCE !== "api" || !portraitDispo() || podiumCache() || stock.get("versus.bullePortrait") || document.querySelector(".bulle-portrait")) return;
    const qui = quiEcurie(); if (!qui || !D) return;
    const brut = ((D.ecurie || {})[qui] || {}).equip || {}; if (brut.tete) { stock.set("versus.bullePortrait", "1"); return; }
    if (document.querySelector(".tuto, .regles, .ba, .revel, .voile:not([hidden])")) { if ((essai || 0) < 8) setTimeout(() => bullePortrait((essai || 0) + 1), 4000); return; }
    stock.set("versus.bullePortrait", "1");
    const b = document.createElement("div"); b.className = "bulle-portrait"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Fais ton portrait");
    b.innerHTML = '<div class="bp-av">' + avatar(qui) + '</div><div class="bp-t"><b>👤 Fais ton portrait !</b><small>Choisis ta tête : elle s\'affichera partout à côté de ton nom.</small></div><div class="bp-b"><button class="btn acc" type="button" data-bp="go">C\'est parti</button><button class="btn ghost" type="button" data-bp="non">Plus tard</button></div>';
    document.body.appendChild(b);
    b.querySelector('[data-bp="go"]').addEventListener("click", () => { b.remove(); ouvrirPortrait(); });
    b.querySelector('[data-bp="non"]').addEventListener("click", () => { b.remove(); toast("Ton portrait t'attend dans Réglages, ou touche ta tête dans le Classement."); });
  } catch (e) { }
}
let ECU_SLOT = "pilote";
const ICONES_KLAXON = { confettis: "🎊", damier: "🏁", feu: "🎆", parade: "🎺", billets: "💸", fanfare: "👑", cibles: "🎯", fusees: "🚀", trophees: "🏆" };
/** Rareté d'un objet : série (de base), bronze, argent, or, légendaire, secret, unique (premier millionnaire) */
function rareteItem(slot, id) {
  if (BASE_ECURIE[slot] === id) return { cls: "r-serie", lib: "Série" };
  const o = origineItem(slot, id);
  if (o.million) return { cls: "r-unique", lib: "Unique" };
  if (o.exclusif) return { cls: "r-unique r-excl", lib: "Exclusif" };
  if (o.secret) return { cls: "r-secret", lib: "Secret" };
  if (o.defi) return { cls: ["", "r-bronze", "r-argent", "r-or", "r-legende"][o.defi.niv], lib: NIVEAUX[o.defi.niv] };
  return { cls: "r-serie", lib: "" };
}
function vignetteItem(slot, id, nom, e) {
  if (slot === "casque") return svgCasque(nom, { casque: id, finition: e.finition, vignette: true });
  if (slot === "finition") return svgCasque(nom, { casque: e.casque, finition: id, vignette: true });
  if (slot === "fond") return avatar(nom, Object.assign({}, e, { fond: id, vignette: true }));
  if (slot === "circuit") return vignetteAmbiance(id);
  if (slot === "livree") return svgVoiture({ nom, e: Object.assign({}, e, { livree: id, trainee: "" }) });
  if (slot === "trainee") return '<svg class="vg-trainee" viewBox="0 0 200 80" aria-hidden="true"><path class="fx fx-' + id + '" d="M8 66C50 62 70 30 110 36S170 18 192 12" fill="none" style="stroke:' + couleur(nom) + '" stroke-linecap="round"/>' +
    '<path d="M8 66C50 62 70 30 110 36S170 18 192 12" fill="none" style="stroke:' + couleur(nom) + '" stroke-width="3.5" stroke-linecap="round"/><circle cx="192" cy="12" r="5" style="fill:' + couleur(nom) + '"/></svg>';
  if (slot === "klaxon") return '<span class="it-emo">' + ICONES_KLAXON[id] + "</span>";
  return id === "aucune" ? '<span class="it-emo vide">—</span>' : '<span class="plaque grande">' + esc(ITEMS.plaque[id]) + "</span>";
}
let ECU_Q = null;   // objet dont on lit le « ? »
function htmlDetailItem(qui) {
  if (!ECU_Q) return '<p class="info" style="margin:0">Touche un objet pour l\'essayer, ou « ? » pour savoir d\'où il vient.</p>';
  const [slot, id] = ECU_Q.split("."); if (!ITEMS[slot] || !ITEMS[slot][id]) return "";
  const o = texteOrigineItem(qui, slot, id), ouvert = debloques(qui).has(ECU_Q), cache = !ouvert && origineItem(slot, id).secret;
  return '<div class="itd-l"><b>' + esc(cache ? "???" : ITEMS[slot][id]) + " <small>" + esc(SLOTS.find(x => x[0] === slot)[1]) + "</small></b><span class=\"itd-t\">" + esc(o.t) + "</span><p>" + esc(o.p) + "</p>" +
    (o.prog !== undefined && !ouvert ? '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, o.prog)) * 100) + '%"></i></span>' + (o.pt ? "<small>" + esc(o.pt) + "</small>" : "") : "") + "</div>";
}
function htmlEcurie() {
  const qui = quiEcurie();
  if (!D.personnes.some(p => p.nom === qui)) return '<div class="vide">Choisis ton nom dans les réglages pour monter ton écurie.</div>';
  if (!ECU || ECU.nom !== qui) ECU = { nom: qui, e: equipDe(qui) };
  const ouverts = debloques(qui), e = ECU.e;
  const slot = ECU_SLOT === "numero" || ECU_SLOT === "pilote" || ECU_SLOT === "badges" || SLOTS.some(s => s[0] === ECU_SLOT) ? ECU_SLOT : "pilote";
  const total = SLOTS.reduce((a, [s]) => a + Object.keys(ITEMS[s]).length, 0) - Object.keys(BASE_ECURIE).length, nb = ouverts.size - Object.keys(BASE_ECURIE).length;
  const showroom = '<div class="showroom"><div class="sr-num" aria-hidden="true">' + e.numero + '</div>' +
    '<div class="sr-h"><span class="sr-k">Mon écurie · ' + (estChauffe(saisonCourante()) ? "Tour de chauffe" : "Saison " + numeroSaison(saisonCourante())) + '</span><span class="sr-id">' + avatar(qui, Object.assign({}, e, { vignette: true })) + "<b" + attrLivree(qui, e) + ">" + esc(qui) + "</b></span>" +
    '<span class="sr-p"><span class="sr-barre"><i style="width:' + (total ? nb / total * 100 : 0).toFixed(0) + '%"></i></span>' + nb + " / " + total + " objets</span></div>" +
    '<div class="sr-3d" id="sr-3d">' + svgVoiture({ nom: qui, e, reflet: true, idle: true }) + "</div>" +
    '<span class="sr-aide"></span><button class="sr-vue" type="button" id="sr-vue">' + (ETAT.sr3d === "1" ? "↔ 360° · Vue détaillée" : "🔄 Vue 360°") + '</button><button class="sr-klaxon" type="button" id="ecu-klaxon">📯 Klaxonner</button></div>';
  const onglets = '<div class="slot-tabs">' + [["pilote", "Pilote"]].concat(SLOTS, [["numero", "Numéro"], ["badges", "Badges"]]).map(([s, lib]) => '<button type="button" data-ecu-slot="' + s + '" aria-pressed="' + (s === slot) + '">' + lib +
    "<small>" + (s === "badges" ? (Array.isArray(e.badges) ? e.badges.length + " / 3" : "auto") : s === "numero" ? "#" + e.numero : s === "pilote" ? (e.pilote === "casque" ? "Casque" : "Tête") : esc(ITEMS[s][e[s]])) + "</small></button>").join("") + "</div>";
  let corps;
  if (slot === "pilote") corps = htmlPilote(qui, e);
  else if (slot === "badges") corps = htmlChoixBadges(qui, e);
  else if (slot === "numero") corps = '<div class="num-bloc"><input id="ecu-num" class="champ-num" inputmode="numeric" maxlength="2" value="' + e.numero + '" aria-label="Numéro de course (1 à 99)"><p class="info">Ton numéro de course, de 1 à 99 : sur le ponton de ta voiture et dans la grille.</p></div>';
  else corps = '<div class="items">' + Object.keys(ITEMS[slot]).map(id => {
    const ouvert = ouverts.has(slot + "." + id), org = origineItem(slot, id), r = rareteItem(slot, id), cache = !ouvert && (!!org.secret || !!org.million), porte = e[slot] === id;
    const sous = ouvert ? r.lib : org.million ? "👑 Premier millionnaire" : org.secret ? "Défi secret" : org.defi ? MEDAILLES[org.defi.niv] + " " + org.defi.nom : "";
    const ex = org.exclusif ? detenteur(org.exclusif.id) : null;
    const sous2 = !ouvert && org.exclusif ? (ex ? "🔒 À " + ex.nom : "Exclusif · libre") : sous;
    return '<div class="it-w' + (ECU_Q === slot + "." + id ? " q-on" : "") + '"><button type="button" class="it ' + r.cls + (porte ? " on" : "") + (ouvert ? "" : " verrou") + '" data-slot="' + slot + '" data-item="' + id + '">' +
      '<span class="it-v">' + (cache ? '<span class="it-emo">?</span>' : vignetteItem(slot, id, qui, e)) + (ouvert ? "" : '<span class="it-lock">' + (org.million ? "👑" : org.exclusif ? org.exclusif.ico : "🔒") + "</span>") + (porte ? '<span class="it-on">Équipé</span>' : "") + "</span>" +
      '<span class="it-n">' + (cache ? "???" : esc(ITEMS[slot][id])) + '</span><span class="it-r">' + esc(sous2) + "</span></button>" +
      '<button type="button" class="it-q" data-itq="' + slot + "." + id + '" aria-label="D\'où vient ' + esc(cache ? "cet objet" : ITEMS[slot][id]) + ' ?">?</button></div>';
  }).join("") + '</div><div class="it-d" id="it-d" aria-live="polite">' + htmlDetailItem(qui) + "</div>";
  const grille = D.personnes.map(p => { const eq = p.nom === qui ? e : equipDe(p.nom); return '<button type="button" class="gr-l' + (ECU_VOIR === p.nom ? " on" : "") + '" data-voir="' + esc(p.nom) + '">' + avatar(p.nom, eq) + "<b" + attrLivree(p.nom, eq) + ">" + esc(p.nom) + "</b>" + (eq.plaque !== "aucune" ? '<span class="plaque">' + esc(ITEMS.plaque[eq.plaque]) + "</span>" : "") + '<span class="num">#' + eq.numero + " ›</span></button>"; }).join("");
  return showroom + onglets + corps +
    '<button class="btn acc plein" type="button" id="ecu-garder">Enregistrer mon écurie</button>' +
    '<p class="info">Touche un objet pour l\'essayer, « ? » pour savoir d\'où il vient. Ta voiture roule dans la Course avec ta livrée et ta traînée ; ta tête ou ton casque s\'affichent partout à côté de ton nom.</p>' +
    '<div><h3 class="s-h3">La grille <small>touche une écurie pour la voir</small></h3></div><div class="grille-dep">' + grille + "</div>" + htmlGarage(qui);
}
/** V16.3 · Écurie › Badges : jusqu'à 3 badges épinglés sur la ligne du Classement (ou choix automatique) */
function htmlChoixBadges(qui, e) {
  const tous = badgesPossedes(qui), auto = !Array.isArray(e.badges), vus = badgesAffiches(qui, e).map(b => b.id);
  if (!tous.length) return '<div class="bdg-choix"><p class="info">Pas encore de badge : gagne un exclusif (le premier à réussir un exploit) ou un titre de champion, puis choisis ici les 3 qui s\'affichent à côté de ton nom.</p></div>';
  return '<div class="bdg-choix"><p class="info">Touche un badge pour l\'épingler ou le retirer : <b>3 au plus</b> s\'affichent à côté de ton nom dans le Classement, les autres se résument en « +N ». ' +
    (auto ? "Pour l'instant, l'appli choisit tes 3 plus prestigieux." : "") + "</p>" +
    '<div class="bdg-grille">' + tous.map(b => { const on = vus.includes(b.id), rang = on ? vus.indexOf(b.id) + 1 : 0;
      return '<button type="button" class="bdg-c' + (on ? " on" : "") + (b.niv ? " n" + b.niv : "") + '" data-ecu-bdg="' + b.id + '" aria-pressed="' + on + '"><span class="ico">' + b.ico + "</span><span>" + esc(b.nom) + "</span>" + (on ? '<i class="rg">' + (auto ? "auto" : rang) + "</i>" : "") + "</button>"; }).join("") + "</div>" +
    '<div class="bdg-apercu"><small>Aperçu de ta ligne</small><b>' + esc(qui) + "</b>" + badgesNom(qui, e) + "</div>" +
    (auto ? "" : '<button class="lien" type="button" id="ecu-bdg-auto">Laisser l\'appli choisir</button>') + "</div>";
}
let ECU_VOIR = null;
/** Garage d'un autre pilote : sa voiture et tout son équipement, en lecture seule */
function htmlGarage(qui) {
  const n = ECU_VOIR; if (!n || !D.personnes.some(p => p.nom === n)) return "";
  const eq = n === qui && ECU ? ECU.e : equipDe(n), ouverts = debloques(n);
  const total = SLOTS.reduce((a, [s]) => a + Object.keys(ITEMS[s]).length, 0) - Object.keys(BASE_ECURIE).length, nb = ouverts.size - Object.keys(BASE_ECURIE).length;
  const ex = exclusifsDe(n);
  return '<div class="garage" id="garage"><div class="showroom">' + '<div class="sr-num" aria-hidden="true">' + eq.numero + '</div><div class="sr-h"><span class="sr-k">Écurie de ' + esc(n) + '</span><span class="sr-id">' + avatar(n, Object.assign({}, eq, { vignette: true })) + "<b" + attrLivree(n, eq) + ">" + esc(n) + "</b></span>" +
    '<span class="sr-p"><span class="sr-barre"><i style="width:' + (total ? nb / total * 100 : 0).toFixed(0) + '%"></i></span>' + nb + " / " + total + " objets</span></div>" + svgVoiture({ nom: n, e: eq, reflet: true, idle: true }) +
    '<button class="sr-klaxon" type="button" id="garage-klaxon">📯 Son klaxon</button></div>' +
    '<div class="gar-eq">' + SLOTS.map(([s, lib]) => '<span><small>' + lib + "</small>" + esc(ITEMS[s][eq[s]]) + "</span>").join("") + "</div>" +
    (ex.length ? '<div class="gar-ex">' + ex.sort((a, b) => b.niv - a.niv).map(x => '<span title="' + esc(x.nom) + '">' + x.ico + " " + esc(x.nom) + "</span>").join("") + "</div>" : "") +
    '<button class="lien" type="button" id="garage-fermer">Fermer</button></div>';
}
/* Trophées : un seul écran, par rareté (🥉 → 💎). Dans chaque rareté, les défis (tout le monde peut les réussir)
   et les exclusifs (un seul exemplaire). Puis les secrets. Chaque trophée débloque un objet de l'écurie. */
/* ================= V15.24 · Le plateau des trophées : le circuit des exclusifs + la piste façon « Mario Party » =================
   Circuit : une case par exclusif (+ 👑), par secteur de difficulté ; case prise = couleur de son détenteur ; case libre = le pilote le plus proche.
   Piste : chaque trophée fait avancer ton pion (défi ou secret : 1 case, exclusif : 3 cases), étoiles tous les 5. Tout se calcule sur les relevés. */
const COUL_NIV = ["", "#2BB673", "#5B8DEF", "#E5484D", "#F2A33A"];
/** Avancement de chaque pilote vers chaque exclusif : { id: { nom: { f: 0..1, t: "texte" } } } */
function avancementExclusifs() {
  const noms = D.personnes.map(p => p.nom), out = {}; EXCLUSIFS.forEach(x => { out[x.id] = {}; });
  const ys = anneesSaison(), S = {}; noms.forEach(n => S[n] = { wins: 0, bestRg: 9, bonus: 0, bestR: -1, bestEcart: -1, winRun: 0, bestWinRun: 0, batRun: 0, bestBatRun: 0, prod: 1, pic: 1, creux: false, pts: 0, tete: 0, gain: 0, saisonWins: 0, titres: 0, place: null, n: 0 });
  ys.forEach(y => {
    const c = championnat(y), w = {}; let prec = null;
    c.mois.forEach(m => {
      m.l.forEach(x => {
        const s = S[x.nom]; if (!s) return; s.n++;
        if (x.rg === 1) { s.wins++; w[x.nom] = (w[x.nom] || 0) + 1; s.saisonWins = Math.max(s.saisonWins, w[x.nom]); }
        s.bestRg = Math.min(s.bestRg, x.rg); if (x.bonus) s.bonus++;
        s.bestR = Math.max(s.bestR, x.r); if (m.iR !== null) s.bestEcart = Math.max(s.bestEcart, x.r - m.iR);
        s.winRun = x.rg === 1 ? s.winRun + 1 : 0; s.bestWinRun = Math.max(s.bestWinRun, s.winRun);
        s.batRun = m.iR !== null && x.r > m.iR ? s.batRun + 1 : 0; s.bestBatRun = Math.max(s.bestBatRun, s.batRun);
        s.prod *= 1 + x.r; if (s.prod > s.pic) { s.pic = s.prod; s.creux = false; } else if (s.prod <= s.pic * .9) s.creux = true;
        s.pts += x.p; if (m.places[x.nom] === 1) s.tete++;
        if (prec && prec[x.nom] && m.places[x.nom]) s.gain = Math.max(s.gain, prec[x.nom] - m.places[x.nom]);
        s.place = m.places[x.nom] || s.place;
      });
      prec = m.places;
    });
    if (c.complete && c.classement[0] && S[c.classement[0]]) S[c.classement[0]].titres++;
  });
  // versements d'affilée (relevés du Versus)
  const debut = ys.length ? (ys[0] - 1) * 100 + 12 : 999999, finPf = finGlobale(D, 0), run = {};
  D.personnes.forEach(p => { let r = 0, best = 0, prec = null;
    serie(p, 0).filter(z => z.k > debut && z.k <= finPf).forEach(z => { const v = z.val && (z.verse || 0) > 0; r = v ? (prec !== null && cleMoins(z.k, 1) === prec ? r + 1 : 1) : 0; prec = z.k; best = Math.max(best, r); });
    run[p.nom] = { r, best }; });
  const pc = v => (v >= 0 ? "+" : "") + (v * 100).toFixed(1).replace(".", ",") + " %", cl = v => Math.max(0, Math.min(1, v));
  noms.forEach(n => {
    const s = S[n], vr = run[n] || { r: 0, best: 0 }, mis = (id, f, t) => { out[id][n] = { f: cl(f), t }; };
    mis("premiersang", s.wins ? 1 : s.bestRg < 9 ? (4 - s.bestRg) / 4 : 0, s.wins ? "fait" : s.bestRg < 9 ? "meilleure place : " + s.bestRg + "e" : "pas encore classé");
    mis("cible", s.bonus ? 1 : s.bestEcart > -1 ? cl(1 + s.bestEcart / .03) : 0, s.bonus ? "fait" : s.bestEcart > -1 ? "meilleur écart : " + pc(s.bestEcart) : "—");
    mis("decollage", s.bestR / .05, "meilleur mois : " + (s.bestR > -1 ? pc(s.bestR) : "—") + " / +5 %");
    mis("fusee", s.bestR / .10, "meilleur mois : " + (s.bestR > -1 ? pc(s.bestR) : "—") + " / +10 %");
    mis("massue", s.bestEcart / .05, "meilleur écart : " + (s.bestEcart > -1 ? pc(s.bestEcart) : "—") + " / +5 pts");
    [["fidele", 3], ["inarretable", 12], ["marathon", 24]].forEach(([id, c]) => mis(id, vr.r / c, vr.r + " / " + c + " mois de versement d'affilée"));
    [["vingt", 12], ["cinquante", 30], ["centurion", 60]].forEach(([id, c]) => mis(id, s.pts / c, Math.round(s.pts) + " / " + c + " points"));
    mis("remontee", s.gain / 2, s.gain > 0 ? "meilleure remontée : " + s.gain + " place" : "pas encore de remontée");
    mis("hattrick", s.winRun / 3, s.winRun + " / 3 victoires d'affilée");
    mis("cinqetoiles", s.bonus / 5, s.bonus + " / 5 bonus 🎯");
    [["mur10", .10], ["mur25", .25], ["mur50", .50]].forEach(([id, c]) => mis(id, (s.prod - 1) / c, "cumul " + pc(s.prod - 1) + " / " + pc(c)));
    mis("semestre", s.batRun / 6, s.batRun + " / 6 mois d'affilée devant l'indice");
    mis("phenix", s.creux ? .5 : 0, s.creux ? "dans le creux : il faut repasser son record" : "pas de chute de 10 % pour l'instant");
    mis("grandchelem", s.saisonWins / 5, s.saisonWins + " / 5 victoires dans une saison");
    mis("maillot", s.tete / 6, s.tete + " / 6 mois en tête");
    mis("champion", s.titres ? 1 : s.place ? (D.personnes.length - s.place + 1) / (D.personnes.length + 1) : 0, s.titres ? "fait" : s.place ? s.place + "e du championnat" : "—");
    mis("doublechampion", s.titres / 2, s.titres + " / 2 titres");
  });
  return out;
}
function scoreTrophees(n, E) {
  const pm = D.premierMillion;
  return DEFIS.filter(d => E[n][d.id].ok).length + SECRETS.filter(d => E[n][d.id].ok).length + 3 * EXCLUSIFS.filter(x => possede(x.id, n)).length + (pm && pm.nom === n ? 3 : 0);
}
/* ================= V16 · La route des 4 mondes : cartes de collection, badges, vitrine =================
   Mondes ORIGINAUX inspirés de nos univers préférés (aucun nom, personnage, logo ni visuel officiel).
   Chaque exclusif = une carte unique illustrée (texte d'ambiance + fragment d'histoire réservé à son détenteur) ;
   les défis et 12 nouveaux trophées = des badges que tout le monde peut gagner. Les règles et les points ne changent pas. */
const MONDES = [
  { id: "royaume", niv: 1, nom: "Le Royaume enchanté", ico: "🌲", c: "#2BB673", c2: "#0E4D2E", txt: "Armoires qui mènent ailleurs, écoles de sorciers, forêts qui murmurent : là où tout commence." },
  { id: "neon", niv: 2, nom: "La Ville néon", ico: "🌃", c: "#4C8DFF", c2: "#12204A", txt: "Pluie sans fin, enseignes qui grésillent, androïdes qui rêvent et gangs en casquette : la ville ne dort jamais." },
  { id: "sombres", niv: 3, nom: "Les Terres sombres", ico: "🕯️", c: "#E5484D", c2: "#3A0D12", txt: "Fêtes du solstice qui tournent mal, monde à l'envers, chasseurs de monstres : rien n'est ce qu'il paraît." },
  { id: "dieux", niv: 4, nom: "Les Dieux et l'Épice", ico: "🏜️", c: "#F2B33A", c2: "#4A2C05", txt: "Mers de dunes, titans derrière les murs, dieux qui jouent aux dés avec les mortels : la fin du voyage." }
];
const mondeDeNiv = n => MONDES[Math.max(0, Math.min(3, n - 1))];
/* Les cartes : une par exclusif (+ la couronne du premier millionnaire). motif = dessin original (voir MOTIFS) */
const CARTES_COLL = {
  premiersang: { t: "L'Épée du premier matin", m: "epee", a: "Forgée à l'aube, elle ne sort du fourreau qu'une fois : pour la toute première victoire.", s: "Sur la lame, une inscription minuscule : « Le premier pas est le seul qu'on n'oublie jamais. »" },
  cible: { t: "La Flèche de l'archer des bois", m: "cible", a: "Tirée depuis la plus haute branche, elle a devancé le vent lui-même.", s: "L'archer n'a jamais visé la cible. Il a visé le marché, et le marché a reculé." },
  decollage: { t: "La Plume des nuages", m: "plume", a: "Arrachée à un oiseau qui volait plus haut que les montagnes.", s: "Tiens-la contre le vent : elle indique toujours où le cours va monter. Ou presque." },
  fidele: { t: "La Clé de l'armoire", m: "cle", a: "Trois tours de clé, trois mois de fidélité : la porte s'ouvre sur l'hiver éternel.", s: "Derrière les manteaux, une lanterne brûle depuis cent ans. Elle attendait quelqu'un de patient." },
  vingt: { t: "Le Grimoire aux douze sceaux", m: "livre", a: "Douze sceaux, douze points : chaque page tournée en libère un nouveau.", s: "Le dernier sceau cache une formule : « Intérêts composés ». Les sorciers la croyaient interdite." },
  remontee: { t: "La Lanterne du raccourci", m: "lanterne", a: "Sa lumière révèle les passages secrets entre deux places du classement.", s: "Elle s'allume toute seule quand quelqu'un te dépasse. Pour que tu le dépasses à ton tour." },
  hattrick: { t: "Les Trois Néons", m: "neons", a: "Trois enseignes qui s'allument d'un coup, trois mois de suite au sommet.", s: "Dans le reflet des flaques, on lit un nom qui n'est pas le tien. Pas encore." },
  massue: { t: "Le Marteau à impulsion", m: "marteau", a: "Un seul coup, et l'indice recule de cinq rues.", s: "Fabriqué dans un atelier de la ville basse, par une inventrice qui ne dort jamais." },
  cinqetoiles: { t: "Le Ticket aux cinq hologrammes", m: "ticket", a: "Cinq hologrammes, cinq fois devant l'indice : l'entrée VIP du monde virtuel.", s: "Au dos, une énigme : « Trois clés, trois portes, un seul gagnant. »" },
  mur10: { t: "La Puce d'accès niveau 10", m: "puce", a: "Implantée derrière l'oreille, elle ouvre les dix premiers étages de la tour.", s: "Un androïde l'a perdue en se demandant s'il était vivant. Tu as trouvé sa réponse." },
  cinquante: { t: "La Tour des trente étages", m: "tour", a: "Trente points, trente étages : la vue d'en haut donne le vertige.", s: "Au dernier étage, une vieille photo : la ville avant la pluie. Personne ne se souvient du soleil." },
  inarretable: { t: "Le Cœur de l'androïde", m: "coeur", a: "Douze battements par an, un par versement : il ne s'est jamais arrêté.", s: "Son fabricant avait écrit dans le code : « La régularité est une forme de liberté. »" },
  fusee: { t: "La Fusée de détresse", m: "flamme", a: "Allumée dans la nuit la plus noire : +10 % en un mois, tout le monde l'a vue.", s: "Ceux qui l'ont aperçue du village du solstice jurent qu'elle a souri." },
  semestre: { t: "Le Masque de glace", m: "masque", a: "Six mois sans trembler : le masque ne fond pas, même devant les monstres.", s: "Retourne-le : à l'intérieur, une seule larme gelée. Il a eu peur, une fois." },
  phenix: { t: "La Plume de cendre", m: "ailes", a: "Tombé de dix pour cent, revenu plus haut qu'avant : seuls les phénix font ça.", s: "La cendre est encore tiède. Elle le restera tant que tu n'abandonnes pas." },
  grandchelem: { t: "Les Cinq Lames d'argent", m: "lames", a: "Cinq victoires dans la saison : une lame par monstre vaincu.", s: "La sixième lame manque. Le chasseur dit qu'il la gardait pour lui-même." },
  maillot: { t: "Le Soleil noir", m: "eclipse", a: "Six mois en tête : même les éclipses s'inclinent.", s: "Pendant l'éclipse, les ombres comptent les points. Elles t'ont compté en premier." },
  centurion: { t: "Le Cor des survivants", m: "cor", a: "Soixante points : un son qui rallie tous ceux qui ont tenu bon.", s: "On dit qu'au bout du monde à l'envers, quelqu'un répond toujours au cor." },
  champion: { t: "Le Trône de sable", m: "trone", a: "Une saison entière, et le désert te reconnaît pour souverain.", s: "Les grains du trône s'écoulent comme dans un sablier : une saison, pas plus. À défendre." },
  mur25: { t: "L'Œil du ver des dunes", m: "ver", a: "Vingt-cinq pour cent de cumul : la bête géante s'est levée pour te saluer.", s: "Il ne dort jamais vraiment. Il attend le prochain qui osera traverser la mer de sable." },
  marathon: { t: "Le Mur des titans", m: "mur", a: "Vingt-quatre mois de suite : un mur que rien ne fait tomber.", s: "Derrière le mur, des géants patients. Ils ont appris la patience en te regardant." },
  mur50: { t: "L'Éclair du roi des dieux", m: "eclair", a: "Cinquante pour cent : l'éclair qu'on ne lance qu'une fois par éternité.", s: "Le roi des dieux l'a perdu aux dés. Contre un mortel. Il n'en parle jamais." },
  doublechampion: { t: "La Hache du dieu-loup", m: "hache", a: "Deux saisons gagnées : la hache passe d'un dieu à un mortel, pour la première fois.", s: "Gravé sur le manche : « Celui qui gagne deux fois n'a plus rien à prouver. Sauf à lui-même. »" },
  million: { t: "La Couronne d'épice", m: "couronne", a: "Un million : l'épice coule à flots, et toute la galaxie le sait.", s: "Le montant ne sera jamais dit. Seule la couronne parle." }
};
/* Dessins originaux (viewBox 0 0 100 100), tracés au trait doré */
const MOTIFS = {
  epee: '<path d="M50 10 L56 22 L54 66 L46 66 L44 22 Z"/><path d="M34 66 H66 V71 H34 Z"/><path d="M47 71 H53 V86 H47 Z"/><circle cx="50" cy="90" r="4"/>',
  cible: '<circle cx="50" cy="50" r="30" fill="none" stroke-width="5"/><circle cx="50" cy="50" r="17" fill="none" stroke-width="5"/><circle cx="50" cy="50" r="5"/><path d="M50 50 L86 16 M86 16 L76 16 M86 16 L86 26" fill="none" stroke-width="5"/>',
  plume: '<path d="M70 12 C40 22 28 50 30 82 L36 82 C44 60 58 42 76 30 C72 26 70 20 70 12 Z"/><path d="M33 82 L52 40" fill="none" stroke="#0006" stroke-width="2"/>',
  cle: '<circle cx="34" cy="34" r="16" fill="none" stroke-width="7"/><path d="M45 45 L82 82 M70 70 L78 62 M77 77 L85 69" fill="none" stroke-width="7"/>',
  livre: '<path d="M18 24 Q34 18 50 26 Q66 18 82 24 V80 Q66 74 50 82 Q34 74 18 80 Z"/><path d="M50 26 V82" stroke="#0007" stroke-width="2.5"/><circle cx="34" cy="50" r="6" fill="#0005"/><circle cx="66" cy="50" r="6" fill="#0005"/>',
  lanterne: '<path d="M38 22 H62 L66 30 H34 Z"/><path d="M36 32 H64 V72 H36 Z" fill-opacity=".85"/><circle cx="50" cy="52" r="9" fill="#fff8"/><path d="M42 74 H58 V80 H42 Z"/><path d="M44 22 Q50 10 56 22" fill="none" stroke-width="4"/>',
  neons: '<rect x="20" y="20" width="12" height="60" rx="6"/><rect x="44" y="12" width="12" height="76" rx="6"/><rect x="68" y="20" width="12" height="60" rx="6"/>',
  marteau: '<rect x="24" y="18" width="52" height="24" rx="5"/><rect x="45" y="42" width="10" height="44" rx="4"/><path d="M28 30 H72" stroke="#0006" stroke-width="3"/>',
  ticket: '<path d="M14 30 H86 V44 Q80 50 86 56 V70 H14 V56 Q20 50 14 44 Z"/><path d="M30 50 l3 -7 3 7 -6 -4 h6 z M44 50 l3 -7 3 7 -6 -4 h6 z M58 50 l3 -7 3 7 -6 -4 h6 z" fill="#0007"/>',
  puce: '<rect x="28" y="28" width="44" height="44" rx="6"/><path d="M36 20 V28 M50 20 V28 M64 20 V28 M36 72 V80 M50 72 V80 M64 72 V80 M20 36 H28 M20 50 H28 M20 64 H28 M72 36 H80 M72 50 H80 M72 64 H80" stroke-width="4" fill="none"/><text x="50" y="57" text-anchor="middle" font-size="18" font-weight="800" fill="#0008">10</text>',
  tour: '<path d="M38 88 V30 L50 12 L62 30 V88 Z"/><path d="M20 88 V52 H34 V88 Z M66 88 V44 H80 V88 Z" fill-opacity=".7"/><path d="M44 36 H56 M44 46 H56 M44 56 H56 M44 66 H56 M44 76 H56" stroke="#0007" stroke-width="3"/>',
  coeur: '<path d="M50 84 C20 62 14 44 24 30 C34 18 46 24 50 34 C54 24 66 18 76 30 C86 44 80 62 50 84 Z"/><path d="M30 50 H42 L46 40 L52 60 L56 50 H70" fill="none" stroke="#0008" stroke-width="3.5"/>',
  flamme: '<path d="M50 10 C64 30 76 40 72 62 C68 80 56 88 50 88 C40 88 28 80 28 62 C28 50 36 42 40 32 C44 42 48 44 50 46 C52 34 50 22 50 10 Z"/><path d="M50 88 C44 88 40 82 42 72 C44 64 50 62 50 54 C56 64 58 70 56 78 C55 84 52 88 50 88 Z" fill="#fff8"/>',
  masque: '<path d="M16 34 Q50 20 84 34 Q84 66 62 78 Q50 72 38 78 Q16 66 16 34 Z"/><ellipse cx="36" cy="46" rx="9" ry="6" fill="#0009"/><ellipse cx="64" cy="46" rx="9" ry="6" fill="#0009"/><path d="M60 54 L58 64" stroke="#fff9" stroke-width="2.5"/>',
  ailes: '<path d="M50 40 C38 20 18 18 8 26 C18 30 22 36 24 44 C14 46 10 52 10 58 C22 54 32 56 40 62 Z"/><path d="M50 40 C62 20 82 18 92 26 C82 30 78 36 76 44 C86 46 90 52 90 58 C78 54 68 56 60 62 Z"/><path d="M50 36 C56 50 56 66 50 86 C44 66 44 50 50 36 Z"/>',
  lames: '<path d="M50 8 L54 60 H46 Z"/><path d="M30 14 L40 62 L33 64 Z"/><path d="M70 14 L60 62 L67 64 Z"/><path d="M14 26 L30 66 L24 69 Z"/><path d="M86 26 L70 66 L76 69 Z"/><path d="M26 70 H74 V78 H26 Z"/>',
  eclipse: '<circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="22" fill="#000c"/><path d="M50 10 V18 M50 82 V90 M10 50 H18 M82 50 H90 M22 22 L28 28 M72 72 L78 78 M78 22 L72 28 M22 78 L28 72" stroke-width="4"/>',
  cor: '<path d="M16 66 C30 66 58 56 74 30 L86 36 C74 66 44 82 18 80 Z"/><path d="M74 30 L86 36 L90 24 L80 20 Z"/><path d="M30 70 L32 78 M44 66 L47 75" stroke="#0007" stroke-width="3"/>',
  trone: '<path d="M30 18 H70 V56 H30 Z"/><path d="M22 50 H78 V62 H22 Z"/><path d="M28 62 V86 H36 V62 Z M64 62 V86 H72 V62 Z"/><path d="M38 26 H62 M38 36 H62 M38 46 H62" stroke="#0007" stroke-width="2.5"/><path d="M30 18 L36 8 L44 18 L50 6 L56 18 L64 8 L70 18 Z"/>',
  ver: '<circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="20" fill="#000c"/><path d="M50 30 L53 38 L50 36 L47 38 Z M70 50 L62 53 L64 50 L62 47 Z M50 70 L47 62 L50 64 L53 62 Z M30 50 L38 47 L36 50 L38 53 Z M64 36 L58 42 M36 36 L42 42 M36 64 L42 58 M64 64 L58 58" fill="#fff9" stroke="#fff9" stroke-width="2"/>',
  mur: '<path d="M10 30 H90 V84 H10 Z"/><path d="M10 48 H90 M10 66 H90 M30 30 V48 M60 30 V48 M45 48 V66 M75 48 V66 M25 66 V84 M58 66 V84" stroke="#0007" stroke-width="2.5"/><path d="M10 30 V22 H20 V30 M30 30 V22 H40 V30 M50 30 V22 H60 V30 M70 30 V22 H80 V30"/>',
  eclair: '<path d="M58 6 L24 54 H46 L36 94 L78 40 H54 L66 6 Z"/>',
  hache: '<rect x="46" y="14" width="8" height="76" rx="3"/><path d="M54 18 C80 18 88 36 86 52 C76 46 66 44 54 46 Z"/><path d="M46 18 C24 22 16 34 18 46 C26 42 36 42 46 44 Z" fill-opacity=".8"/>',
  couronne: '<path d="M14 72 L20 30 L36 50 L50 22 L64 50 L80 30 L86 72 Z"/><rect x="14" y="74" width="72" height="10" rx="3"/><circle cx="50" cy="20" r="5"/><circle cx="20" cy="28" r="4"/><circle cx="80" cy="28" r="4"/>'
};
/* Décor de fond de chaque monde (silhouettes) */
const DECORS = {
  royaume: '<path d="M0 100 V70 L10 56 L18 70 L26 50 L36 72 L44 58 L54 74 L64 52 L74 70 L84 56 L100 72 V100 Z" fill="#0004"/><circle cx="78" cy="22" r="7" fill="#fff3"/>',
  neon: '<path d="M0 100 V62 H12 V48 H22 V66 H30 V38 H42 V60 H52 V44 H62 V70 H72 V34 H82 V58 H92 V50 H100 V100 Z" fill="#0005"/><path d="M8 20 V34 M20 16 V30 M90 18 V32" stroke="#fff3" stroke-width="1"/>',
  sombres: '<path d="M0 100 V74 Q20 66 34 76 Q48 64 62 74 Q80 62 100 72 V100 Z" fill="#0005"/><path d="M14 74 V54 M14 58 L8 52 M14 62 L20 56 M86 72 V50 M86 56 L80 50 M86 60 L92 54" stroke="#0006" stroke-width="2"/><circle cx="24" cy="22" r="8" fill="#ffffff22"/>',
  dieux: '<path d="M0 100 V76 Q24 64 48 76 Q70 86 100 70 V100 Z" fill="#0004"/><path d="M0 100 V86 Q30 76 60 88 Q80 94 100 84 V100 Z" fill="#0005"/><circle cx="72" cy="26" r="11" fill="#fff4"/>'
};
/* Nouveaux trophées (3 par monde), sur ce qui existe déjà : tout le monde peut les gagner, ils ne rapportent pas de points */
const TROPHEES_MONDES = [
  { id: "m-pousse", monde: "royaume", ico: "🌱", nom: "La Première pousse", def: "verser au moins une fois dans la saison" },
  { id: "m-voeu", monde: "royaume", ico: "🔮", nom: "Le Vœu exaucé", def: "trouver le vainqueur du mois dans ton pronostic" },
  { id: "m-carte", monde: "royaume", ico: "🃏", nom: "La Carte enchantée", def: "marquer des points avec une carte" },
  { id: "m-horsreseau", monde: "neon", ico: "📡", nom: "Hors réseau", def: "3 mois positifs d'affilée" },
  { id: "m-hacker", monde: "neon", ico: "🅿️", nom: "Le Hacker", def: "gagner une pole position" },
  { id: "m-neonvert", monde: "neon", ico: "💚", nom: "Néon vert", def: "6 mois positifs dans la saison" },
  { id: "m-survivant", monde: "sombres", ico: "🌧️", nom: "Survivant", def: "finir positif un mois où l'indice baisse" },
  { id: "m-twist", monde: "sombres", ico: "🌀", nom: "Le Twist final", def: "monter sur le podium du mois juste après avoir été dernier" },
  { id: "m-nuitblanche", monde: "sombres", ico: "🏁", nom: "Nuit blanche", def: "réussir 3 défis du mois" },
  { id: "m-faveur", monde: "dieux", ico: "⚡", nom: "La Faveur des dieux", def: "marquer 12 points en un seul mois" },
  { id: "m-epice", monde: "dieux", ico: "🏜️", nom: "Le Maître de l'épice", def: "atteindre +15 % cumulés dans la saison" },
  { id: "m-pantheon", monde: "dieux", ico: "🏛️", nom: "Le Panthéon", def: "les 3 pronostics justes le même mois (vainqueur, +1 %, pole)" }
];
let MEMO_TM = { d: null, v: null };
function etatTropheesMondes() {
  if (MEMO_TM.d === D && MEMO_TM.v) return MEMO_TM.v;
  const noms = D.personnes.map(p => p.nom), out = {}; TROPHEES_MONDES.forEach(t => { out[t.id] = {}; noms.forEach(n => out[t.id][n] = { ok: false, p: 0, c: 1 }); });
  const monte = (id, n, v, c) => { const o = out[id][n]; if (!o) return; o.c = c; o.p = Math.max(o.p, Math.min(v, c)); if (v >= c) o.ok = true; };
  anneesSaison().forEach(y => {
    const ch = championnat(y), R = {}; noms.forEach(n => R[n] = { pos: 0, posRun: 0, defis: 0, cum: 1, dern: false });
    ch.mois.forEach(m => {
      const gag = (m.l.find(z => z.rg === 1) || {}).nom;
      m.l.forEach(x => {
        const r = R[x.nom]; if (!r) return;
        if (x.carte && x.carte.gain > 0) monte("m-carte", x.nom, 1, 1);
        if (x.prono && x.prono.v && x.prono.v === gag) monte("m-voeu", x.nom, 1, 1);
        if (x.prono && x.prono.pole) monte("m-hacker", x.nom, 1, 1);
        if (x.prono && x.prono.v === gag && x.prono.pole && x.prono.i && m.iR !== null && (x.prono.i === "h") === (m.iR > 0.01)) monte("m-pantheon", x.nom, 1, 1);
        r.posRun = x.r > 0 ? r.posRun + 1 : 0; monte("m-horsreseau", x.nom, r.posRun, 3);
        if (x.r > 0) r.pos++; monte("m-neonvert", x.nom, r.pos, 6);
        if (m.iR !== null && m.iR < 0 && x.r > 0) monte("m-survivant", x.nom, 1, 1);
        if (r.dern && x.rg <= 3) monte("m-twist", x.nom, 1, 1); r.dern = !!x.dernier;
        if (x.defi) r.defis++; monte("m-nuitblanche", x.nom, r.defis, 3);
        monte("m-faveur", x.nom, x.p, 12);
        r.cum *= 1 + x.r; monte("m-epice", x.nom, Math.max(0, Math.round((r.cum - 1) * 100)), 15);
      });
    });
    D.personnes.forEach(p => { if (serie(p, 0).some(z => z.k > ch.deb && z.k <= ch.f && z.val && (z.verse || 0) > 0)) monte("m-pousse", p.nom, 1, 1); });
  });
  MEMO_TM = { d: D, v: out };
  return out;
}
/* Une carte de collection (HTML + SVG) ; taille « m » (route), « g » (grande, ouverte) */
function htmlCarteColl(id, taille, detenteurs) {
  const ex = id === "million" ? { niv: 4, nom: "Premier millionnaire" } : EXCLUSIFS.find(x => x.id === id), cc = CARTES_COLL[id], mo = mondeDeNiv(ex.niv);
  const prise = detenteurs && detenteurs.length;
  return '<div class="carte-coll t-' + taille + (prise ? " prise" : " libre") + '" style="--mc:' + mo.c + ";--mc2:" + mo.c2 + '">' +
    '<svg viewBox="0 0 100 140" aria-hidden="true"><defs><linearGradient id="cg-' + id + taille + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + mo.c + '"/><stop offset="1" stop-color="' + mo.c2 + '"/></linearGradient></defs>' +
      '<rect x="2" y="2" width="96" height="136" rx="9" fill="url(#cg-' + id + taille + ')" stroke="#F7CF55" stroke-width="2.5"/>' +
      '<g transform="translate(6 8) scale(.88 .7)">' + DECORS[mo.id] + "</g>" +
      '<g transform="translate(18 16) scale(.64)" fill="#F7CF55" stroke="#F7CF55">' + MOTIFS[cc.m] + "</g>" +
      '<rect x="8" y="94" width="84" height="38" rx="5" fill="#0008"/>' +
      [1, 2, 3, 4].slice(0, ex.niv).map((_, i) => '<circle cx="' + (50 - (ex.niv - 1) * 4 + i * 8) + '" cy="10" r="2.6" fill="#F7CF55"/>').join("") + "</svg>" +
    '<div class="cc-t"><b>' + esc(cc.t) + "</b>" + (taille === "g" ? "<small>" + esc(ex.nom) + "</small>" : "") + "</div>" +
    (prise ? '<span class="cc-qui" style="--c:' + couleur(detenteurs[0]) + '">' + esc(detenteurs[0].slice(0, 1)) + "</span>" : "") + "</div>";
}
/* La route : un monde par section (repliable), étapes alternées badge / carte le long d'une route */
let MONDE_OUVERT = null;
function htmlPlateau() {
  const noms = D.personnes.map(p => p.nom), A = avancementExclusifs(), pm = D.premierMillion, E = {}; noms.forEach(n => E[n] = etatDefis(n));
  const TM = etatTropheesMondes(), moi = moiPilote();
  const owners = id => { if (id === "million") return pm ? [pm.nom] : []; const d = detenteur(id); return d ? d.noms : []; };
  const proche = id => { if (id === "million") return null; const l = noms.map(n => ({ n, f: (A[id] && A[id][n] || { f: 0 }).f })).sort((a, b) => b.f - a.f); return l[0] && l[0].f > 0 ? l[0] : null; };
  const pastilles = l => '<span class="rt-dots">' + noms.map(n => '<i title="' + esc(n) + '" style="' + (l.includes(n) ? "background:" + couleur(n) : "") + '" class="' + (l.includes(n) ? "on" : "") + '"></i>').join("") + "</span>";
  const sections = MONDES.map(mo => {
    const ex = EXCLUSIFS.filter(x => x.niv === mo.niv).map(x => x.id).concat(mo.niv === 4 ? ["million"] : []);
    const badges = DEFIS.filter(d => d.niv === mo.niv).map(d => ({ id: d.id, ico: MEDAILLES[d.niv], nom: d.nom, def: d.def, l: noms.filter(n => E[n][d.id].ok), type: "defi" }))
      .concat(TROPHEES_MONDES.filter(t => t.monde === mo.id).map(t => ({ id: t.id, ico: t.ico, nom: t.nom, def: t.def, l: noms.filter(n => TM[t.id][n].ok), type: "monde" })));
    const etapes = []; for (let i = 0; i < Math.max(ex.length, badges.length); i++) { if (badges[i]) etapes.push({ b: badges[i] }); if (ex[i]) etapes.push({ c: ex[i] }); }
    const nbC = ex.filter(id => owners(id).length).length, mesB = moi ? badges.filter(b => b.l.includes(moi)).length : 0;
    const route = etapes.map((e, i) => {
      const cote = i % 2 ? "d" : "g";
      if (e.c) { const o = owners(e.c), p = !o.length ? proche(e.c) : null;
        return '<button type="button" class="rt-e rt-c ' + cote + '" data-carte-coll="' + e.c + '">' + htmlCarteColl(e.c, "m", o) +
          '<span class="rt-l">' + (o.length ? '<b style="color:' + couleur(o[0]) + '">' + esc(o.join(" et ")) + "</b>" : p ? '<i style="background:' + couleur(p.n) + '"></i>' + esc(p.n) + " · " + Math.round(p.f * 100) + " %" : "libre") + "</span></button>"; }
      const b = e.b;
      return '<button type="button" class="rt-e rt-b ' + cote + (b.l.includes(moi) ? " a-moi" : "") + '" data-badge="' + b.id + '" data-bt="' + b.type + '"><span class="rt-med" style="--mc:' + mo.c + '">' + b.ico + "</span><span class=\"rt-l\"><b>" + esc(b.nom) + "</b>" + pastilles(b.l) + "</span></button>";
    }).join("");
    const ouvert = MONDE_OUVERT ? MONDE_OUVERT === mo.id : mo.niv === 1;
    return '<details class="monde" data-monde="' + mo.id + '"' + (ouvert ? " open" : "") + ' style="--mc:' + mo.c + ";--mc2:" + mo.c2 + '"><summary class="mo-h"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + DECORS[mo.id] + "</svg>" +
      '<span class="mo-t"><small>Monde ' + mo.niv + " · " + esc(NIV_EX[mo.niv]) + "</small><b>" + mo.ico + " " + esc(mo.nom) + "</b><em>" + nbC + " / " + ex.length + " cartes prises" + (moi ? " · tes badges " + mesB + " / " + badges.length : "") + "</em></span></summary>" +
      '<p class="mo-txt">' + esc(mo.txt) + '</p><div class="route">' + route + "</div></details>";
  }).join("");
  const nbEx = n => EXCLUSIFS.filter(x => possede(x.id, n)).length + (pm && pm.nom === n ? 1 : 0);
  const tete = '<div class="rt-tab">' + noms.slice().sort((a, b) => nbEx(b) - nbEx(a)).map(n => '<span style="--c:' + couleur(n) + '"><i></i>' + esc(n) + " <b>" + nbEx(n) + "</b> 🃏</span>").join("") + "</div>";
  return '<div><h3 class="s-h3">🗺️ La route des 4 mondes <small>cartes uniques · badges pour tous</small></h3></div>' +
    '<p class="info">Les <b>cartes</b> (grandes étapes) sont uniques : la première personne qui réussit l\'exploit la garde pour toujours. Les <b>badges</b> (petites étapes) sont pour tout le monde. Touche une étape pour la découvrir.</p>' + tete + sections;
}
function ouvrirCarteColl(id) {
  const noms = D.personnes.map(p => p.nom), A = avancementExclusifs(), pm = D.premierMillion, moi = moiPilote();
  const ex = id === "million" ? { niv: 4, nom: "Premier millionnaire", def: "atteindre 1 000 000 €" } : EXCLUSIFS.find(x => x.id === id), cc = CARTES_COLL[id], mo = mondeDeNiv(ex.niv);
  const o = id === "million" ? (pm ? [pm.nom] : []) : (detenteur(id) || { noms: [] }).noms, d = id === "million" ? null : detenteur(id);
  const gain = ex.gain ? ITEMS[ex.gain[0]][ex.gain[1]] + " (" + SLOTS.find(z => z[0] === ex.gain[0])[1].toLowerCase() + ")" : "";
  const prog = !o.length && id !== "million" ? noms.map(n => ({ n, a: A[id][n] || { f: 0, t: "—" } })).sort((a, b) => b.a.f - a.a.f).map(x => '<div class="pl-bar"><span style="color:' + couleur(x.n) + '">' + esc(x.n) + '</span><span class="pl-j"><i style="width:' + Math.round(x.a.f * 100) + "%;background:" + couleur(x.n) + '"></i></span><small>' + esc(x.a.t) + "</small></div>").join("") : "";
  const ov = document.createElement("div"); ov.className = "revel cc-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = '<div class="rv-c cc-c" style="--mc:' + mo.c + '"><span class="tuto-k">' + mo.ico + " " + esc(mo.nom) + " · " + MED_EX[ex.niv] + " " + esc(NIV_EX[ex.niv]) + "</span>" +
    '<div class="cc-flip"><div class="cc-in"><div class="cc-dos"><span>' + mo.ico + "</span></div><div class=\"cc-face\">" + htmlCarteColl(id, "g", o) + "</div></div></div>" +
    '<p class="cc-a">« ' + esc(cc.a) + " »</p>" +
    '<p class="cc-cond"><b>Pour la gagner :</b> être le premier à ' + esc(String(ex.def).replace("l'indice", "le " + D.marche.indices[iRef()])) + "." + (gain ? " Elle apporte aussi " + esc(gain) + " à ton écurie." : "") + "</p>" +
    (o.length ? '<p class="pl-pris" style="--c:' + couleur(o[0]) + '">🏁 À <b>' + esc(o.join(" et ")) + "</b>" + (d && d.k ? ", depuis " + esc(moisLong(d.k)) : "") + ".</p>" : prog) +
    (o.includes(moi) ? '<p class="cc-s">📜 <i>' + esc(cc.s) + "</i></p>" : '<p class="cc-s verrou">🔒 Un fragment d\'histoire est caché au dos : seul son détenteur peut le lire.</p>') +
    '<div class="btn-row"><button class="btn acc" type="button" data-cc="ok">Fermer</button></div></div>';
  document.body.appendChild(ov);
  const t0 = Date.now(), fermer = () => ov.remove();
  ov.addEventListener("click", e => { if (e.target === ov && Date.now() - t0 > 900) fermer(); });
  ov.querySelector('[data-cc="ok"]').addEventListener("click", fermer);
}
function ouvrirBadge(id, type) {
  const noms = D.personnes.map(p => p.nom);
  let b, mo, l, prog;
  if (type === "monde") { const t = TROPHEES_MONDES.find(x => x.id === id), T = etatTropheesMondes(); b = { nom: t.nom, def: t.def, ico: t.ico }; mo = MONDES.find(m => m.id === t.monde); l = noms.map(n => ({ n, o: T[id][n] })); }
  else { const d = DEFIS.find(x => x.id === id); b = { nom: d.nom, def: d.def, ico: MEDAILLES[d.niv], gain: d.gain }; mo = mondeDeNiv(d.niv); l = noms.map(n => ({ n, o: etatDefis(n)[id] })); }
  prog = l.map(x => '<div class="pl-bar"><span style="color:' + couleur(x.n) + '">' + esc(x.n) + '</span><span class="pl-j"><i style="width:' + Math.round((x.o.ok ? 1 : (x.o.prog || x.o.p || 0) / (x.o.cible || x.o.c || 1)) * 100) + "%;background:" + couleur(x.n) + '"></i></span><small>' + (x.o.ok ? "✓ obtenu" : (x.o.prog || x.o.p || 0) + " / " + (x.o.cible || x.o.c || 1)) + "</small></div>").join("");
  const ov = document.createElement("div"); ov.className = "revel cc-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = '<div class="rv-c cc-c" style="--mc:' + mo.c + '"><span class="tuto-k">' + mo.ico + " " + esc(mo.nom) + " · badge</span>" +
    '<div class="bd-med" style="--mc:' + mo.c + '">' + b.ico + "</div><h3>" + esc(b.nom) + '</h3><p class="cc-cond">' + esc(b.def.charAt(0).toUpperCase() + b.def.slice(1)) + "." +
    (b.gain && b.gain.length ? " Débloque " + esc(b.gain.map(([s, i]) => ITEMS[s][i]).join(" + ")) + " pour ton écurie." : " Badge de collection, pour la vitrine.") + "</p>" + prog +
    '<div class="btn-row"><button class="btn acc" type="button" data-cc="ok">Fermer</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('[data-cc="ok"]').addEventListener("click", () => ov.remove());
}
function brancherPlateau(v) {
  v.querySelectorAll("[data-carte-coll]").forEach(b => b.addEventListener("click", () => ouvrirCarteColl(b.dataset.carteColl)));
  v.querySelectorAll("[data-badge]").forEach(b => b.addEventListener("click", () => ouvrirBadge(b.dataset.badge, b.dataset.bt)));
  v.querySelectorAll("details.monde").forEach(d => d.addEventListener("toggle", () => { if (d.open) MONDE_OUVERT = d.dataset.monde; }));
}
/* La vitrine d'un pilote (fiche du Classement) : ses cartes, et ses badges par monde */
function vitrineFiche(nom) {
  if (typeof saisonVisible !== "function" || !saisonVisible()) return "";
  const pm = D.premierMillion, cartes = EXCLUSIFS.filter(x => possede(x.id, nom)).map(x => x.id).concat(pm && pm.nom === nom ? ["million"] : []);
  const E = etatDefis(nom), TM = etatTropheesMondes();
  const parMonde = MONDES.map(mo => { const tot = DEFIS.filter(d => d.niv === mo.niv).length + TROPHEES_MONDES.filter(t => t.monde === mo.id).length;
    const ok = DEFIS.filter(d => d.niv === mo.niv && E[d.id].ok).length + TROPHEES_MONDES.filter(t => t.monde === mo.id && TM[t.id][nom] && TM[t.id][nom].ok).length;
    return '<span style="--mc:' + mo.c + '">' + mo.ico + " " + ok + "/" + tot + "</span>"; }).join("");
  return '<div class="vitrine">' + (plaqueDe(nom) ? '<div class="vt-plaque">' + plaqueDe(nom).replace('class="plaque"', 'class="plaque grande"') + "</div>" : "") + '<div class="vt-h"><b>🗄️ La vitrine de ' + esc(nom) + "</b><small>" + cartes.length + " carte" + (cartes.length > 1 ? "s" : "") + " · badges par monde</small></div>" +
    (cartes.length ? '<div class="vt-cartes">' + cartes.map(id => '<button type="button" data-carte-coll="' + id + '">' + htmlCarteColl(id, "m", [nom]) + "</button>").join("") + "</div>" : '<p class="info">Pas encore de carte : la course aux exclusifs ne fait que commencer.</p>') +
    '<div class="vt-badges">' + parMonde + "</div></div>";
}

function htmlDefis() {
  const noms = D.personnes.map(p => p.nom), E = {}; noms.forEach(n => E[n] = etatDefis(n));
  const pm = D.premierMillion, idx = D.marche.indices[iRef()];
  const lib = g => g.map(([s, id]) => ITEMS[s][id] + " (" + SLOTS.find(x => x[0] === s)[1].toLowerCase() + ")").join(" + ");
  const court = n => n.length > 5 ? n.slice(0, 4) + "." : n;
  const tete = '<thead><tr><th>Défi</th>' + noms.map(n => '<th title="' + esc(n) + '"><i style="background:' + couleur(n) + '"></i>' + esc(court(n)) + "</th>").join("") + "</tr></thead>";
  const ligneDefi = d => '<tr><td class="n"><i>' + MEDAILLES[d.niv] + "</i>" + esc(d.nom) + "<small>" + esc(d.fam) + " · " + esc(d.def) + "</small><em>→ " + esc(lib(d.gain)) + "</em></td>" + noms.map(n => {
    const o = E[n][d.id]; return o.ok ? '<td class="ok">✓</td>' : '<td class="pr">' + (o.prog ? o.prog + "/" + o.cible + (d.unite || "") : "·") + "</td>"; }).join("") + "</tr>";
  const ligneEx = x => {
    const d = detenteur(x.id), item = ITEMS[x.gain[0]][x.gain[1]], slot = SLOTS.find(z => z[0] === x.gain[0])[1].toLowerCase();
    return '<div class="ex-l' + (d ? " pris" : "") + '"><span class="ex-i">' + x.ico + "</span><div><b>" + esc(x.nom) + "</b><small>Le premier à " + esc(x.def.replace("l'indice", "le " + idx)) + " · " + esc(item) + " (" + slot + ")</small></div>" +
      (d ? '<span class="ex-q" style="--c:' + couleur(d.noms[0]) + '"><b>' + esc(d.nom) + "</b><small>" + esc(moisCourt(d.k)) + "</small></span>" : '<span class="ex-q libre"><b>Libre</b><small>à prendre</small></span>') + "</div>";
  };
  const ligneMillion = () => '<div class="ex-l' + (pm ? " pris" : "") + '"><span class="ex-i">👑</span><div><b>Premier millionnaire</b><small>Le premier à 1 000 000 € · récompense secrète, pour toute l\'appli</small></div>' +
    (pm ? '<span class="ex-q" style="--c:' + couleur(pm.nom) + '"><b>' + esc(pm.nom) + "</b><small>pour toujours</small></span>" : '<span class="ex-q libre"><b>Libre</b><small>à prendre</small></span>') + "</div>";
  // score de trophées par pilote
  const nbDe = n => DEFIS.filter(d => E[n][d.id].ok).length + SECRETS.filter(d => E[n][d.id].ok).length + EXCLUSIFS.filter(x => possede(x.id, n)).length + (pm && pm.nom === n ? 1 : 0);
  const total = DEFIS.length + SECRETS.length + EXCLUSIFS.length + 1;
  const resume = '<div class="ex-tab">' + noms.slice().sort((a, b) => nbDe(b) - nbDe(a)).map(n => '<span style="--c:' + couleur(n) + '"><b>' + nbDe(n) + "</b>" + esc(n) + "</span>").join("") + "</div>";
  const raretes = [1, 2, 3, 4].map(n => {
    const dl = DEFIS.filter(d => d.niv === n), xl = EXCLUSIFS.filter(x => x.niv === n), nx = xl.length + (n === 4 ? 1 : 0);
    const pris = xl.filter(x => detenteur(x.id)).length + (n === 4 && pm ? 1 : 0), moi = moiPilote(), faits = moi && E[moi] ? dl.filter(d => E[moi][d.id].ok).length : null;
    return '<details class="ex-bloc tr-bloc n' + n + '" data-exn="' + n + '"' + (EX_OUVERTS.has(n) ? " open" : "") + '><summary><span class="ex-niv"><span>' + MEDAILLES[n] + " " + NIVEAUX[n] + "</span><small>" +
      dl.length + " défis" + (faits !== null ? " (" + faits + " ✓)" : "") + " · " + nx + " exclusifs (" + pris + " pris)</small></span></summary>" +
      '<h4 class="tr-h">Défis <small>chacun peut les réussir</small></h4><div class="scroll-x"><table class="tab succes-m defis-m">' + tete + "<tbody>" + dl.map(ligneDefi).join("") + "</tbody></table></div>" +
      '<h4 class="tr-h">Exclusifs <small>un seul exemplaire, pour le premier</small></h4><div class="ex-liste">' + xl.map(ligneEx).join("") + (n === 4 ? ligneMillion() : "") + "</div></details>";
  }).join("");
  const secrets = '<div><h3 class="s-h3">🤫 Secrets <small>à découvrir</small></h3></div><div class="secrets">' + SECRETS.map(s => {
    const qui = noms.filter(n => E[n][s.id].ok);
    return qui.length ? '<div class="sec-l ouvert"><b>🤫 ' + esc(s.nom) + "</b><small>" + esc(s.def) + " → " + esc(lib(s.gain)) + "</small><span>" + qui.map(n => '<span style="color:' + couleur(n) + '">' + esc(n) + "</span>").join(" · ") + "</span></div>"
      : '<div class="sec-l"><b>??? </b><small>Trophée secret : personne ne l\'a encore trouvé.</small></div>';
  }).join("") + "</div>";
  return (estChauffe(saisonCourante()) ? '<div class="chauffe-b">🔥 <span>Tour de chauffe : les trophées démarrent le 1<sup>er</sup> janvier 2027. Voici ce qui t\'attend.</span></div>' : "") +
    bandeauMillion() + htmlPlateau() +
    '<div><h3 class="s-h3">Les trophées <small>' + total + " au total</small></h3></div>" + resume +
    '<p class="info">Chaque trophée débloque un objet pour ton écurie, et reste acquis pour toujours. <b>Défis</b> : chacun peut les réussir. <b>Exclusifs</b> : un seul exemplaire, pour le premier qui y arrive (à égalité le même mois : la meilleure valeur du critère, puis la performance du mois, puis le cumul). Calculé sur les relevés publics du Versus, ' + esc(idx) + " comme référence.</p>" +
    '<div class="ex-liste">' + raretes + "</div>" + secrets;
}
/* Animations du showroom : la voiture démarre au klaxon, rebondit quand on change un objet */
function demarrer(v) {
  if (V3D.inst && (v || document).querySelector(".showroom canvas.v3d")) { V3D.inst.boost(); return; }
  const car = (v || document).querySelector(".showroom .voiture"); if (!car || !ANIM) return;
  car.classList.remove("boost"); void car.getBoundingClientRect(); car.classList.add("boost", "roule");
  setTimeout(() => car.classList.remove("boost", "roule"), 1500);
}
function popVoiture() {
  const car = document.querySelector(".showroom .voiture"); if (!car || !ANIM) return;
  car.classList.add("pop"); setTimeout(() => car.classList.remove("pop"), 500);
}
/* Enregistrement instantané : l'écurie change tout de suite à l'écran, l'envoi part en arrière-plan,
   et tout revient comme avant (avec un message) si l'API refuse ou ne répond pas */
async function garderEcurie() {
  const qui = ECU.nom, equip = Object.assign({}, ECU.e), avant = D.ecurie, brut = ((avant || {})[qui] || {}).equip || {};
  delete equip.vignette;
  let envoi = Object.assign({}, equip);
  if (brut.aura && envoi.aura === undefined) envoi.aura = brut.aura;
  // en aperçu admin, les améliorations restent sur l'appareil : on renvoie au serveur ses vraies valeurs, intactes
  if (apercuSaison()) { stock.set("versus.amelioApercu", equip.amelio || ""); envoi.amelio = Number(brut.amelioY) === anneeAmelio() ? brut.amelio || "" : ""; delete equip.amelio; }
  const local = Object.assign({}, brut, equip);
  if (!apercuSaison()) {
    const y = anneeAmelio(), deja = amelioDe(qui, y), auj = aujNum();
    local.amelios = Object.assign({}, brut.amelios || {}, { [y]: { s: equip.amelio || "", t: deja.t.slice(0, deja.s.length).concat(Array(Math.max(0, (equip.amelio || "").length - deja.s.length)).fill(auj)) } });
    delete local.amelio; delete local.amelioY; delete local.amelioT;
  }
  D.ecurie = Object.assign({}, avant, { [qui]: Object.assign({}, (avant || {})[qui], { equip: local }) });
  MEMO_SAISON = { d: null, m: {} }; ECU = null;
  toast(SOURCE !== "api" ? "Aperçu : écurie gardée sur cet appareil seulement." : simulation() ? "👁️ Simulation : écurie gardée pour voir, rien n'est envoyé." : "Écurie enregistrée 🏎️"); rendreTrophees();
  if (SOURCE !== "api" || simulation()) return;
  const rep = await posterAdmin({ action: "ecurie", personne: qui, equip: envoi });
  if (rep.ok) { if (rep.ecurie) { D.ecurie = rep.ecurie; MEMO_SAISON = { d: null, m: {} }; } }
  else { D.ecurie = avant; MEMO_SAISON = { d: null, m: {} }; ECU = null; toast((rep.message || "Enregistrement impossible.") + " Ton écurie est revenue comme avant."); rendreTrophees(); }
}
function brancherSaison(v) {
  const rs = v.querySelector("#reserve-ouvrir"); if (rs) rs.addEventListener("click", ouvrirReserve);
  v.querySelectorAll("[data-pod]").forEach(b => b.addEventListener("click", () => { ETAT.podium = b.dataset.pod; if (b.dataset.pod === "stand") { const r = rappelCartes(); if (r && !kOuvertPour(saisonCourante())) choisirSaison(r.y); } garder(); rendreTrophees(); }));
  v.querySelectorAll("[data-saison]").forEach(b => b.addEventListener("click", () => { choisirSaison(+b.dataset.saison); rendreTrophees(); }));
  const y = saisonCourante();
  const o = ongletPodium();
  if (o === "defis") brancherPlateau(v);
  if (o === "gp") { brancherGP(v, y); const dp = v.querySelector("#pts-det"); if (dp) { if (dp.open) dessinerChampionnat(y); dp.addEventListener("toggle", () => { ETAT.ptsOuvert = dp.open ? "1" : "0"; garder(); if (dp.open) dessinerChampionnat(y); }); } }
  if (o === "stand") brancherStand(v, y);
  v.querySelectorAll("[data-aller-stand]").forEach(b => b.addEventListener("click", () => { const r = rappelCartes(); if (r) choisirSaison(r.y); ETAT.podium = "stand"; garder(); rendreTrophees(); const t = document.querySelector(".pod-tabs"); if (t) t.scrollIntoView({ block: "start", behavior: "smooth" }); }));
  if (!stock.get("versus.tuto1")) { stock.set("versus.tuto1", "1"); etapesJeu().filter(e => aujNum() >= annonceEtape(e)).forEach(e => stock.set("versus.nouveaute." + e.id, "1")); setTimeout(ouvrirTuto, 400); }
  else setTimeout(verifierRevelation, 500);
  bandesDefilantes(v); expliquerBadges(v);
  v.querySelectorAll("details.ex-bloc").forEach(d => d.addEventListener("toggle", () => { const n = +d.dataset.exn; if (d.open) EX_OUVERTS.add(n); else EX_OUVERTS.delete(n); }));
  v.querySelectorAll("[data-ecu-slot]").forEach(b => b.addEventListener("click", () => { ECU_SLOT = b.dataset.ecuSlot; ECU_Q = null; rendreTrophees(); }));
  v.querySelectorAll("[data-ecu-bdg]").forEach(b => b.addEventListener("click", () => {
    if (!ECU) return; const id = b.dataset.ecuBdg, l = Array.isArray(ECU.e.badges) ? ECU.e.badges.slice() : badgesAffiches(ECU.nom, ECU.e).map(x => x.id), i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1); else { if (l.length >= 3) { toast("3 badges au plus : retires-en un d'abord."); return; } l.push(id); }
    ECU.e.badges = l; rendreTrophees(); }));
  const bAuto = v.querySelector("#ecu-bdg-auto"); if (bAuto) bAuto.addEventListener("click", () => { if (ECU) { ECU.e.badges = null; rendreTrophees(); } });
  const majQ = () => { const z = v.querySelector("#it-d"); if (z) z.innerHTML = htmlDetailItem(ECU.nom); v.querySelectorAll(".it-w").forEach(w => w.classList.toggle("q-on", w.querySelector("[data-itq]").dataset.itq === ECU_Q)); };
  v.querySelectorAll("[data-itq]").forEach(b => b.addEventListener("click", () => { ECU_Q = ECU_Q === b.dataset.itq ? null : b.dataset.itq; majQ(); }));
  v.querySelectorAll(".it").forEach(b => b.addEventListener("click", () => {
    const s = b.dataset.slot, id = b.dataset.item;
    if (b.classList.contains("verrou")) { ECU_Q = s + "." + id; majQ(); return; }
    ECU_Q = s + "." + id;
    ECU.e[s] = id; if (s === "casque" || s === "finition") ECU.e.pilote = ECU.e.pilote || "tete"; rendreTrophees(); popVoiture();
    if (s === "klaxon") confettis(id);
  }));
  const num = v.querySelector("#ecu-num");
  if (num) num.addEventListener("change", () => { const n = parseInt(num.value, 10); if (n >= 1 && n <= 99) { ECU.e.numero = n; rendreTrophees(); } else { num.value = ECU.e.numero; toast("Un numéro entre 1 et 99."); } });
  v.querySelectorAll("[data-voir]").forEach(b => b.addEventListener("click", () => { ECU_VOIR = ECU_VOIR === b.dataset.voir ? null : b.dataset.voir; rendreTrophees(); const g = document.getElementById("garage"); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  const gf = v.querySelector("#garage-fermer"); if (gf) gf.addEventListener("click", () => { ECU_VOIR = null; rendreTrophees(); });
  const gk = v.querySelector("#garage-klaxon"); if (gk) gk.addEventListener("click", () => { const g = v.querySelector("#garage"); confettis(equipDe(ECU_VOIR).klaxon); demarrer(g); });
  const s3 = v.querySelector("#sr-3d"); if (s3 && ECU && ETAT.sr3d === "1") { try { monter3D(s3, ECU.nom, ECU.e); } catch (e) { /* le dessin 2D reste affiché */ } }
  const sv = v.querySelector("#sr-vue"); if (sv) sv.addEventListener("click", () => { ETAT.sr3d = ETAT.sr3d === "1" ? "0" : "1"; garder(); rendreTrophees(); });
  const kl = v.querySelector("#ecu-klaxon"); if (kl) kl.addEventListener("click", () => { confettis(ECU.e.klaxon); demarrer(v); });
  const g = v.querySelector("#ecu-garder"); if (g) g.addEventListener("click", garderEcurie);
  brancherPilote(v);
  v.querySelectorAll("[data-regles]").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); ouvrirRegles(a.dataset.regles); }));
  const rb = v.querySelector("#regles-ouvrir"); if (rb) rb.addEventListener("click", () => ouvrirRegles());
}
/* Éditeur de tête : on ne redessine que l'éditeur et l'avatar du showroom (pas la voiture), pour rester fluide */
function brancherPilote(v) {
  const tp = v.querySelector("#tp"); if (!tp) return;
  const maj = () => {
    tp.outerHTML = htmlPilote(ECU.nom, ECU.e);
    const id = v.querySelector(".showroom .sr-id .av"); if (id) id.outerHTML = avatar(ECU.nom, Object.assign({}, ECU.e, { vignette: true }));
    const st = v.querySelector('[data-ecu-slot="pilote"] small'); if (st) st.textContent = ECU.e.pilote === "casque" ? "Casque" : "Tête";
    brancherPilote(v);
  };
  tp.querySelectorAll("[data-pmode]").forEach(b => b.addEventListener("click", () => { ECU.e.pilote = b.dataset.pmode; maj(); }));
  tp.querySelectorAll("[data-portrait]").forEach(b => b.addEventListener("click", () => { ECU.e.tete = b.dataset.portrait; ECU.e.pilote = "tete"; maj(); }));
  tp.querySelectorAll("[data-tp]").forEach(b => b.addEventListener("click", () => { const t = decodeTete(ECU.e.tete); if (b.dataset.tp === "cheveux" && t.barbeC === t.cheveux) t.barbeC = +b.dataset.v; t[b.dataset.tp] = +b.dataset.v; ECU.e.tete = encodeTete(t); if (ECU.e.pilote !== "tete") ECU.e.pilote = "tete"; maj(); }));
  const r = tp.querySelector("#tp-reset"); if (r) r.addEventListener("click", () => { ECU.e.tete = presetTete(ECU.nom); ECU.e.pilote = "tete"; maj(); });
  tp.querySelectorAll("[data-slot-mettre]").forEach(b => b.addEventListener("click", () => { const t = (ECU.e.tetes || [])[+b.dataset.slotMettre]; if (t) { ECU.e.tete = t; ECU.e.pilote = "tete"; maj(); } }));
  tp.querySelectorAll("[data-slot-garder]").forEach(b => b.addEventListener("click", () => { const l = (ECU.e.tetes || []).slice(); while (l.length < 4) l.push(""); l[+b.dataset.slotGarder] = ECU.e.tete; ECU.e.tetes = l; maj(); toast("Tête gardée dans l'emplacement " + (+b.dataset.slotGarder + 1) + " (pense à Enregistrer)."); }));
}

