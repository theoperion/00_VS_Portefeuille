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
const SAISON = { premiere: 2027, depart: new Date(2027, 0, 1), chauffe: new Date(Date.UTC(2026, 10, 21, 8, 0)), noel: new Date(2026, 10, 20) };
const CHAUFFE_K = 202612;
function saisonOuverte() { return Date.now() >= SAISON.depart.getTime(); }
function chauffeOuverte() { return Date.now() >= SAISON.chauffe.getTime(); }
function apercuSaison() { return !window.APERCUS_FINIS && !saisonOuverte() && estAdmin() && apercuAutorise() && stock.get("versus.apercuSaison") === "1"; }
function saisonVisible() { return saisonOuverte() || apercuSaison() || chauffeOuverte(); }
/** La « saison » 2026 hors aperçu admin, c'est le tour de chauffe : décembre seul, sans défis, badges ni exclusifs */
function estChauffe(y) { return y === SAISON.premiere - 1 && !apercuSaison(); }
/** v17.5 · la saison 2027 est-elle jouée pour de vrai (ou en aperçu admin) ? Fondé sur la DATE, pas sur l'onglet choisi : avant le 1/1/2027, ni écurie, ni badges, ni trophées, ni univers 2027 */
function saisonJouee() { return saisonOuverte() || apercuSaison(); }
/** v17.5 · à partir du 20 décembre 2026 : l'onglet « Saison 1 » s'ouvre, mais seulement le Stand (carte de janvier, pronostic, rival) ; seul l'univers de janvier est dévoilé */
function janvierAnnonce() { return Date.now() >= new Date(SAISON.premiere - 1, 11, 20).getTime(); }
/** V16.22 · pendant le tour de chauffe : seulement les bases (course + cartes) ; écurie, badges, trophées et objets attendent janvier (demande de Théo) */
function basesSeules() { try { return !apercuSaison() && (!saisonOuverte() || estChauffe(saisonCourante())); } catch (e) { return false; } }
/** v20.61 (Théo, 25/11) · l'Écurie ouvre le 1er décembre 2026, pendant le tour de chauffe (avant : en janvier, règle v20.44).
 *  En décembre : seulement les objets de DÉPART (rien de 2027 : ni monde, ni succès, ni univers) ; l'onglet Trophées reste caché jusqu'au 1er janvier. */
const ECURIE_OUVRE = new Date(SAISON.premiere - 1, 11, 1);
function ecurieOuverte() { return saisonJouee() || Date.now() >= ECURIE_OUVRE.getTime(); }
/** décembre 2026 : l'écurie est ouverte, mais seulement avec les objets de départ */
function ecurieDepart() { return ecurieOuverte() && basesSeules(); }
/** v17.5 · onglet « Saison 1 » ouvert avant le 1er janvier (du 20 au 31 décembre) : seulement le Stand */
function standSeul(y) { return !saisonJouee() && y >= SAISON.premiere; }
/** Saisons qu'on peut ouvrir dans le Podium : le tour de chauffe (dès le 21 novembre), puis la Saison 1 (à partir du 20 décembre, Stand seul jusqu'au 1er janvier) */
function anneesPodium() {
  if (apercuSaison()) return anneesSaison();
  if (!chauffeOuverte()) return [];
  const l = Date.now() < new Date(SAISON.premiere, 1, 1).getTime() ? [SAISON.premiere - 1] : [];   // la chauffe reste consultable jusqu'à fin janvier
  if (!saisonOuverte() && !janvierAnnonce()) return l;   // v17.5 : pas de Saison 1 avant le 20 décembre
  for (let y = SAISON.premiere; y <= Math.max(SAISON.premiere, new Date(Date.now()).getFullYear()); y++) l.push(y); return l;
}
/** Jour limite (exclu) pour poser une carte ou lancer un duel : le 2 (chauffe comprise depuis v17.61) */
function jourLimite(k) { return 2; }   // v17.61 (Théo) : la chauffe suit la règle de la saison (cartes jusqu'au 1er inclus, révélation le 2)
/** Saisons jouées (2027, 2028…) ; en aperçu, une répétition sur 2026 */
function anneesSaison() {
  if (!saisonOuverte()) return apercuSaison() ? [SAISON.premiere - 1] : [];
  const l = []; for (let y = SAISON.premiere; y <= Math.max(SAISON.premiere, new Date(Date.now()).getFullYear()); y++) l.push(y); return l;
}
function numeroSaison(y) { return Math.max(1, y - SAISON.premiere + 1); }

/* ---------- Championnat : 6 / 4 / 2 / 0 point (V15 : le dernier ne marque plus, prendre trop de risque se paie), +1 si le mois bat le S&P 500 ---------- */
const BAREME = [6, 4, 2, 0], BAREME5 = [6, 4, 2, 1, 0];   // V16.20 : à 5 pilotes (Nicolas), le 4e garde 1 point (validé par Théo le 19/11)
/** v20.83 · barème montré dans les règles : celui de la saison (tous les pilotes inscrits), même avant le 1er relevé du 5e ; le calcul des points garde baremeJ() */
function baremeAffiche() { try { return baremeJ(D && D.personnes ? D.personnes.length : undefined); } catch (e) { return BAREME5; } }
function baremeJ(n) { return (n !== undefined ? n : nbPilotesEnJeu()) >= 5 ? BAREME5 : BAREME; }
/** v20.25 · pilotes déjà en jeu (au moins un relevé avec une valeur) : un nouveau venu ne change le barème affiché qu'une fois lancé */
function nbPilotesEnJeu() { try { return D.personnes.filter(p => serie(p, 0).some(z => z.val > 0)).length || D.personnes.length; } catch (e) { return 4; } }
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
/** v16.84 · résultats inventés (admin, saison simulée) : rendements fixes entre −4 % et +5 % selon le nom et le mois */
function fauxVerdict(k) {
  const h = t => { let x = 2166136261; for (const c of t) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 10000) / 10000; };
  const du = D.personnes.map(p => ({ nom: p.nom, r: -0.04 + 0.09 * h(p.nom + ":" + k) })).sort((a, b) => b.r - a.r);
  return { k, env: 0, du, manquent: [], complet: true, simule: true };
}
/** v17.53 : les premiers du tour de chauffe (ex æquo compris) */
function premiersChauffe(c) { const m = c.mois.find(x => x.k === CHAUFFE_K), p = m ? m.l.filter(x => x.rg === 1).map(x => x.nom) : []; return p.length ? p : [c.classement[0]]; }
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
  /* v16.84 · « Tout afficher » (admin) : la saison simulée va jusqu'à décembre ; les mois sans vrais résultats reçoivent des résultats INVENTÉS (fixes, marqués simule) */
  const simu = !ch && y === SAISON.premiere - 1 && apercuSaison(), listeK = moisVerdict(0).filter(k => k > deb && k <= f);
  if (simu) for (let k = y * 100 + 1; k <= f; k++) if (!listeK.includes(k) && k > Math.min(...listeK.concat([f]))) listeK.push(k);
  if (D.attenteMois && D.attenteMois.k > deb && Math.floor(D.attenteMois.k / 100) === y && !listeK.includes(D.attenteMois.k)) listeK.push(D.attenteMois.k);   // v20.30 : le mois voilé reste « en attente »
  listeK.sort((a, b) => a - b).forEach(k => {
    let v = verdictMois(0, k);
    if (simu && (!v || !v.complet)) v = fauxVerdict(k);
    if (!v || !v.complet) { if (v) attente = v; return; }
    const PG = ch ? null : piegeMois(y, k), iR = indiceMois(k);   // V15.5 : piège du circuit
    // v20.52 (Théo, 25/11) : « Un aller et retour » (places sur deux mois cumulés) retiré ; les places se jouent toujours sur le mois seul
    const du = v.du.map(x => Object.assign({}, x, { rc: x.r })).sort((a, b) => b.rc - a.rc), n = du.length;
    // places : ex æquo à 1e-9 près ; « Murs proches » : à moins de 0,2 point du pilote juste devant, on partage sa place
    const RG = []; du.forEach((x, i) => { RG[i] = i && du[i - 1].rc - x.rc < (PG && PG.id === "murs" ? 0.002 : 0) + 1e-9 ? RG[i - 1] : i + 1; });
    const rgMax = n ? Math.max(...RG) : 0;
    const avant = mois.length ? mois[mois.length - 1].places : null, cumAvant = mois.length ? mois[mois.length - 1].cumul : null, spec = moisSpecial(y, k);
    const derniers = avant && Object.keys(avant).length >= 2 ? (mx => Object.keys(avant).filter(nm => avant[nm] === mx))(Math.max(...Object.values(avant))) : [];
    const seuil = PG && PG.id === "mirage" ? 0.005 : 0;   // « Mirage » : le 🎯 demande 0,5 point d'avance sur l'indice
    const l = du.map((x, i) => {
      // 🎯 : +1 ; +2 au Rassemblement des héros et sous « L'œil de l'archer elfe » (avril, v20.52) ; le Turbo y ajoute toujours +2 (donc +3, ou +4 ces mois-là)
      const rg = RG[i], bonus = iR !== null && x.r > iR + seuil + (seuil ? -1e-12 : 0) ? (spec && (spec.id === "monza" || spec.heros) || PG && PG.id === "mille" ? 2 : 1) : 0;
      const dernier = n >= 3 && rg > 1 && rg === rgMax;
      // 🌑 Côté obscur (v20.52, Théo 25/11, option A) : le dernier du championnat avant juin marque ses points de place ×2, et au moins 2 (dernier du mois : 2 au lieu de 0)
      const cote = !!(spec && spec.id === "monaco" && derniers.includes(x.nom));
      const mult = spec && (spec.id === "finale" || cote) ? 2 : 1, base = PG && PG.id === "nuit" && dernier ? 2 : ptsRang(rg, n), vainq = spec && spec.id === "silverstone" && rg === 1 ? 2 : 0;
      const plancher = cote && base * mult < 2 ? 2 - base * mult : 0;
      const o = { nom: x.nom, r: x.r, rg, base, mult, vainq, p: base * mult + plancher + bonus + vainq, bonus, dernier, ecart: rg === 1 && n > 1 ? x.rc - du[1].rc : null, niv: J[x.nom] ? J[x.nom].niv : 1, piege: PG ? PG.id : undefined };
      if (plancher) o.plancher = plancher;
      return o;
    });
    // cartes révélées (main de base et pioche bonus), plafonnées à +4
    const atM = ch ? null : atoutsDe(k);
    l.forEach(x => {
      const c = carteDe(y, x.nom, k); if (!c || !c.c) return;
      const def = carteDef(c.c), j = J[x.nom]; if (!def || !j) return;
      if (def.bonus && (!regleActive("pioche", k) || !j.pioche.some(z => z.c === c.c && z.k < k))) { x.carte = { id: c.c, gain: 0, cible: c.cible || null, invalide: true }; return; }
      if (PG && PG.id === "chaleur" && c.c === "turbo") { x.carte = { id: c.c, gain: 0, cible: null, invalide: true, piege: true }; return; }   // « La forêt endormie » (ex-« Chaleur ») : Turbo interdit
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
    Object.keys(SERIE).forEach(n => { if (!l.some(x => x.nom === n)) SERIE[n] = 0; });   // v20.33 (Théo, 24/11) : absent ce mois-là → la série repart de zéro
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

/* ---------- Anciens défis (4 familles × 4 niveaux) et anciens secrets : RETIRÉS à la refonte des badges (Théo, 24/11), ni affichés ni comptés.
   Leurs objets d'écurie sont redistribués aux trophées des mondes, au Gant et aux secrets dorés. Gardés ici pour mémoire (et pour 2028). ---------- */
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
const SECRETS_ANCIENS = [
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
  const r = {}; DEFIS.concat(SECRETS_ANCIENS).forEach(d => r[d.id] = { ok: false, prog: 0, cible: 1 });
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
  casque: { uni: "Uni", carbone: "Carbone", eclair: "Éclair", damier: "Damier", tortue: "Tortue", chrome: "Chrome", etoile: "Étoile", holo: "Holo", couronne: "Couronne", foudre: "Foudre", phenix: "Phénix", glace: "Glace", galaxie: "Galaxie", empereur: "Empereur", eclaireur: "Éclaireur", toque: "Toque de chef", anneau: "Anneau gravé", rebelle: "Pilote rebelle", hoplite: "Casque d'Ulysse", fracture: "Éclats du multivers", raye: "Rayé", bicolore: "Bicolore", pois: "Pois" },
  circuit: { classique: "Jour de course", monaco: "Nocturne", desert: "Heure dorée", neige: "Hiver", neon: "Synthwave" },
  fond: { couleur: "Couleur", carbone: "Carbone", aurore: "Aurore", flammes: "Flammes", neon: "Néon", damier: "Damier", or: "Or", galaxie: "Galaxie", chat: "Chat qui sourit", pandora: "Forêt luminescente", ampoules: "Guirlande d'ampoules", portails: "Portails", degrade: "Dégradé", rayures: "Rayures", etoile: "Étoilé" },
  finition: { aucune: "Aucune", argent: "Liseré argent", or: "Liseré or", neon: "Liseré néon", diamant: "Diamant", lauriers: "Lauriers", etoilee: "Étoilée", soleil: "Soleil", ailee: "Balle ailée", elfique: "Cape elfique", biolum: "Bioluminescence", feuilledor: "Feuille d'or", lisblanc: "Liseré blanc", lisnoir: "Liseré noir", mat: "Mat", brillant: "Brillant" },
  livree: { couleur: "Couleur", chrome: "Chrome", or: "Or", neon: "Néon", arcenciel: "Prisme", oranime: "Or vivant", platine: "Platine", rubis: "Rubis", galaxie: "Galaxie", orrose: "Or rose", chocolat: "Chocolat fondant", carte: "Carte à jouer", ver: "Peau des sables", rayures: "Rayures", damier: "Damier", bicolore: "Bicolore", flammes: "Flammes" },
  trainee: { simple: "Simple", halo: "Halo", flammes: "Flammes", etincelles: "Étincelles", comete: "Comète", supernova: "Supernova", turbo: "Turbo", arcenciel: "Arc-en-ciel", cables: "Câbles d'acier", flocons: "Flocons", sabre: "Sabre lumineux", glitch: "Faille", pointilles: "Pointillés", double: "Double", ruban: "Ruban", fumee: "Fumée" },
  klaxon: { confettis: "Confettis", damier: "Damier", feu: "Feu d'artifice", parade: "Parade", billets: "Pluie de billets", fanfare: "Fanfare royale", cibles: "Dans le mille", fusees: "Décollage", trophees: "Pluie de trophées", ouvriers: "Fanfare des petits ouvriers", pouet: "Pouet", trompette: "Trompette", sifflet: "Sifflet" },
  plaque: { aucune: "Aucune", metronome: "Le Métronome", bouclier: "Bouclier", contre: "Contre-attaque", remontada: "Roi de la remontée", premiersang: "Premier sang", fidele: "Fidèle au poste", vingt: "Pointeur", coupsaison: "Coup de la saison", ratatouille: "Ratatouille", ticketor: "Ticket d'or", carredas: "Carré d'as", epice: "Yeux de l'Épice", voliere: "La Volière", cheshire: "Sourire du Chat", precieux: "Mon précieux", eywa: "Eywa", kyber: "Kyber", toquedor: "Toque d'or", joyce: "Joyce", ithaque: "Ithaque", bataillon: "Bataillon", cheval: "Cheval de bois", hiver26: "Hiver 2026", hiverdore: "Hiver 2026 doré", chercheur: "Chercheur de Noël", chercheuror: "Chercheur de Noël d'or", recrue: "Recrue 2026" }
};
const BASE_ECURIE = { casque: "uni", circuit: "classique", fond: "couleur", finition: "aucune", livree: "couleur", trainee: "simple", klaxon: "confettis", plaque: "aucune" };
/* v20.61 (Théo, 25/11) · objets de DÉPART en plus de la série : à tout le monde, dès l'ouverture de l'écurie (1/12/2026). Les objets génériques
   retirés des mondes (redessinés à l'image de leur univers) vont ici (le Versus = la course : damier, carbone) ou dans la réserve 2028 (OBJETS_RESERVE). */
/* v20.68 (Théo, 25/11) · l'écurie de décembre était trop vide : 3 à 4 objets de départ NEUTRES de plus par emplacement (rien à voir avec 2027),
   à tout le monde dès le 1/12/2026 et pour toujours. Pas de plaque (une plaque se gagne) ni de filtre de course (à revoir plus tard). */
const DEPART_ECURIE = [["casque", "carbone"], ["casque", "damier"], ["fond", "carbone"], ["fond", "damier"],
  ["casque", "raye"], ["casque", "bicolore"], ["casque", "pois"], ["finition", "lisblanc"], ["finition", "lisnoir"], ["finition", "mat"], ["finition", "brillant"],
  ["fond", "degrade"], ["fond", "rayures"], ["fond", "etoile"], ["livree", "rayures"], ["livree", "damier"], ["livree", "bicolore"], ["livree", "flammes"],
  ["trainee", "pointilles"], ["trainee", "double"], ["trainee", "ruban"], ["trainee", "fumee"], ["klaxon", "pouet"], ["klaxon", "trompette"], ["klaxon", "sifflet"]];
function estDepart(slot, id) { return BASE_ECURIE[slot] === id || DEPART_ECURIE.some(g => g[0] === slot && g[1] === id); }
const OBJETS_RESERVE = [["livree", "or"], ["casque", "chrome"], ["casque", "holo"], ["casque", "etoile"], ["finition", "argent"], ["finition", "or"], ["finition", "neon"], ["fond", "aurore"], ["trainee", "comete"], ["plaque", "metronome"], ["circuit", "neige"]];
const SLOTS = [["casque", "Casque"], ["finition", "Finition"], ["fond", "Avatar"], ["livree", "Livrée"], ["trainee", "Traînée"], ["klaxon", "Klaxon"], ["plaque", "Plaque"], ["circuit", "Filtre de course"]];
const GAINS_MILLION = [["casque", "couronne"], ["livree", "oranime"], ["klaxon", "billets"]];
/* 🎫 Ticket d'or (Chocolaterie, octobre 2027) : la plaque exclusive du gagnant (un seul ticket dans l'année, tirage du serveur, TicketsOr.js) */
const GAIN_TICKET = ["plaque", "ticketor"];
/* 🎫 + la finition « Feuille d'or » (Théo, 25/11) : exclusive, Légende, portée en course (casque, halo, flancs) */
const GAIN_TICKET_FIN = ["finition", "feuilledor"];
const GAINS_TICKET = [GAIN_TICKET, GAIN_TICKET_FIN];
function estGainTicket(slot, id) { return GAINS_TICKET.some(g => g[0] === slot && g[1] === id); }
/** État des tickets d'or reçu du serveur (action « tickets », js/4-grandprix.js) : { empreinte, gagnants: [{ nom, j, n }], … } ou null */
let TICKETS = null;
function gagnantsTicket() { return TICKETS && Array.isArray(TICKETS.gagnants) ? TICKETS.gagnants : []; }
/** Le mois des tablettes : octobre 2027 (circuit de la Chocolaterie, « singapour » dans CAL_GP) */
const TICKET_MOIS = { debut: new Date(2027, 9, 1), fin: new Date(2027, 10, 1), regles: new Date(2027, 0, 1) };
/* 🎄 Souvenir du tour de chauffe (calendrier de l'Avent, case du 24 décembre 2026, js/10-avent.js) : offert à CHAQUE pilote, à porter dès le 24/12/2026 */
const GAINS_SOUVENIR = [["plaque", "hiver26"], ["trainee", "flocons"]], SOUVENIR_DES = new Date(2026, 11, 24);
/* 🏅 (Théo, 25/11) plaque « Hiver 2026 » DORÉE : en plus du souvenir, pour chaque pilote qui a ouvert les 24 cases du calendrier, chacune le jour même.
   Compté par le SERVEUR (Avent.js : liste dores, dès le 24/12/2026, publique comme celle des chercheurs) : changer la date du téléphone n'y fait rien. */
const GAIN_DORE = ["plaque", "hiverdore"];
function estGainDore(slot, id) { return slot === GAIN_DORE[0] && id === GAIN_DORE[1]; }
function aventDore(nom) { try { return !!nom && typeof aventDores === "function" && aventDores().includes(nom); } catch (e) { return false; } }
/* v20.62 (Théo, 25/11) · 🎁 plaque « Chercheur de Noël » : pour chaque pilote qui trouve le trésor de décembre 2026 (l'Atelier du Père Noël, tour de chauffe) ;
   le PLUS RAPIDE (v20.74 : chrono, serveur V92 ; avant : le premier) a la version dorée (exclusive), qui peut changer de main jusqu'au 31/12. Aucun point, gardée pour toujours. Déduite de la liste PUBLIQUE des chercheurs du trésor
   (TRESORS.l[].chercheurs : nom et jour, dans l'ordre ; jamais où), comme la pastille des éclats : aucun changement serveur. L'aperçu admin ne donne rien. */
const GAIN_CHERCHEUR = ["plaque", "chercheur"], GAIN_CHERCHEUR_OR = ["plaque", "chercheuror"], TRESOR_NOEL = "abudhabi";
function chercheursNoel() {
  try { if (typeof TRESOR_APERCU !== "undefined" && TRESOR_APERCU) return [];
    const T = typeof TRESORS !== "undefined" && TRESORS && TRESORS.l, t = T && T.find(x => x.circuit === TRESOR_NOEL && (!x.saison || x.saison === SAISON.premiere - 1));
    return t && Array.isArray(t.chercheurs) ? t.chercheurs.filter(x => x && x.nom) : []; } catch (e) { return []; }
}
/** v20.74 · la plaque DORÉE est-elle attribuée ? Trésor chronométré (serveur V92) : seulement le 1/1/2027 à 0 h (final) ; avant le chrono : tout de suite */
function noelFinal() {
  try { const T = typeof TRESORS !== "undefined" && TRESORS && TRESORS.l, t = T && T.find(x => x.circuit === TRESOR_NOEL && (!x.saison || x.saison === SAISON.premiere - 1));
    return !t || !t.chrono || !!t.final; } catch (e) { return true; }
}
function estGainChercheur(slot, id) { return slot === "plaque" && (id === GAIN_CHERCHEUR[1] || id === GAIN_CHERCHEUR_OR[1]); }
/* v20.70 (Théo, 25/11) · 🔰 plaque « Recrue 2026 » : à chaque pilote qui a JOUÉ le tour de chauffe, à partir du 1/1/2027 et pour toujours (rien à faire, aucun point).
   « A joué » = son mois de décembre 2026 compte au tour de chauffe : un relevé de décembre 2026 avec un rendement, et déjà une valeur à un relevé d'avant
   (exactement la règle d'entrée au classement de la chauffe, rJeu). Lu sur la copie brute (D_BRUT) : pas besoin d'attendre que tout le monde ait saisi. */
const GAIN_RECRUE = ["plaque", "recrue"], RECRUE_DES = new Date(SAISON.premiere, 0, 1);
function estGainRecrue(slot, id) { return slot === GAIN_RECRUE[0] && id === GAIN_RECRUE[1]; }
function recrueChauffe(nom) {
  if (Date.now() < RECRUE_DES.getTime() || !nom) return false;
  try { const B = typeof D_BRUT !== "undefined" && D_BRUT && D_BRUT.personnes && D_BRUT.personnes.some(x => x.nom === nom) ? D_BRUT : D, p = B.personnes.find(x => x.nom === nom); if (!p) return false;
    const s = serie(p, 0); return s.some(z => z.k === CHAUFFE_K && typeof z.r === "number") && s.some(z => z.k < CHAUFFE_K && z.val > 0); } catch (e) { return false; }
}
/* v20.70 (Théo, 25/11) · 🎨 couleur au choix des objets à motif neutres : Rayures (livrée), Rayé et Bicolore (casque), Liseré blanc / noir (finition).
   Le serveur (V91) n'accepte qu'un identifiant de 2 à 16 lettres par emplacement : la couleur s'écrit DANS l'identifiant (« rayuresor », « lisblancpilote ») ;
   l'appli la relit (lireTeinte) et range la couleur à part dans e.teintes[emplacement]. La couleur par défaut ne s'écrit pas (« rayures » = rayures blanches).
   Liseré : pas d'or (le Liseré or se gagne, et c'est le maillot jaune du leader) ; « blanc » et « noir » sont les objets Liseré blanc / noir eux-mêmes. */
const TEINTES = { blanc: ["Blanc", "#FFFFFF"], noir: ["Noir", "#11151B"], or: ["Or", "#E9B949"], pilote: ["Ta couleur", null] };
const TEINTABLES = { "livree.rayures": ["blanc", "noir", "or"], "casque.raye": ["blanc", "noir", "or"], "casque.bicolore": ["blanc", "noir", "or"], "finition.lisblanc": ["blanc", "noir", "pilote"], "finition.lisnoir": ["blanc", "noir", "pilote"] };
function teintesDe(slot, id) { return TEINTABLES[slot + "." + id] || null; }
function teinteDefaut(slot, id) { return slot === "finition" && id === "lisnoir" ? "noir" : "blanc"; }
/** « rayuresor » → ["rayures", "or"] ; un identifiant connu → [id, null] */
function lireTeinte(slot, v) {
  v = String(v || ""); if (!v || (ITEMS[slot] && ITEMS[slot][v])) return [v, null];
  for (const k of Object.keys(TEINTABLES)) { const [s, id] = k.split("."), t = v.slice(id.length);
    if (s === slot && v.indexOf(id) === 0 && TEINTABLES[k].includes(t) && t !== teinteDefaut(s, id)) return [id, t]; }
  return [v, null];
}
function ecrireTeinte(slot, id, t) { const l = teintesDe(slot, id); return t && l && l.includes(t) && t !== teinteDefaut(slot, id) ? id + t : id; }
/** la teinte choisie pour l'objet porté à cet emplacement (null = sa couleur d'origine) */
function teinteDe(slot, e) { const t = e && e.teintes && e.teintes[slot], l = e && teintesDe(slot, e[slot]); return t && l && l.includes(t) && t !== teinteDefaut(slot, e[slot]) ? t : null; }
function hexTeinte(nom, slot, e) { const t = teinteDe(slot, e); if (!t) return null; try { return t === "pilote" ? couleurReelle(couleur(nom)) : TEINTES[t][1]; } catch (er) { return null; } }
function teintesHex(nom, e) { const o = {}; ["livree", "casque", "finition"].forEach(s => { const h = hexTeinte(nom, s, e); if (h) o[s] = h; }); return o; }
function souvenirOuvert() { return Date.now() >= SOUVENIR_DES.getTime() || saisonJouee(); }
function ticketVisible() { return Date.now() >= TICKET_MOIS.debut.getTime() || gagnantsTicket().some(g => g.nom === moiPilote()); }
function debloques(nom) {
  const o = new Set(Object.entries(BASE_ECURIE).map(([s, v]) => s + "." + v).concat(DEPART_ECURIE.map(g => g.join("."))));
  // Trophées v2 (Théo, 25/11) : les objets viennent des 🗺️ Mondes (mini-jeu réussi), des 🏅 Succès (commun pour chacun, exclusif pour le 1er), du 🧤 Gant complet et des 💎 Légendes
  if (saisonJouee()) {
    const TM = etatTropheesMondes();
    TROPHEES_MONDES.forEach(t => { if (TM[t.id] && TM[t.id][nom] && TM[t.id][nom].ok) t.gain.forEach(g => o.add(g.join("."))); });
    if (anneesSaison().some(y => (etatGant(y)[nom] || { n: 0 }).n === 6)) GANT.gain.forEach(g => o.add(g.join(".")));
  }
  if (souvenirOuvert()) GAINS_SOUVENIR.forEach(g => o.add(g.join(".")));
  { const ch = chercheursNoel(), i = ch.findIndex(x => x.nom === nom); if (i >= 0) { o.add(GAIN_CHERCHEUR.join(".")); if (i === 0 && noelFinal()) o.add(GAIN_CHERCHEUR_OR.join(".")); } }   // 🎁 Chercheur de Noël   // 🎄 souvenir du tour de chauffe, pour tous (dès le 24/12/2026)
  if (aventDore(nom)) o.add(GAIN_DORE.join("."));   // 🏅 Hiver 2026 doré : 24 cases sur 24, le jour même (liste du serveur)
  if (recrueChauffe(nom)) o.add(GAIN_RECRUE.join("."));   // 🔰 Recrue 2026 : a joué le tour de chauffe (dès le 1/1/2027)
  if (D.premierMillion && D.premierMillion.nom === nom) GAINS_MILLION.forEach(g => o.add(g.join(".")));
  succesDe(nom).forEach(x => o.add(x.gain.join(".")));                      // 🏅 l'objet commun : pour chacun qui réussit
  exclusifsDe(nom).forEach(x => gainsSecret(x).forEach(g => o.add(g.join("."))));   // 🥇 + l'exclusif : pour le premier
  if (possede(CHAMPION_EX.id, nom)) gainsSecret(CHAMPION_EX).forEach(g => o.add(g.join(".")));   // 💎 Légende : le premier champion
  if (Object.values(D.votes || {}).some(v => (v.gagnants || []).includes(nom))) o.add("plaque.coupsaison");
  if (gagnantsTicket().some(g => g.nom === nom)) GAINS_TICKET.forEach(g => o.add(g.join(".")));
  if (typeof mjDebloques === "function") mjDebloques(nom).forEach(k => o.add(k));   // 🎲 mini-jeux du mois   // 🎫 Ticket d'or   // V13.9 : gagnant d'un vote de fin de saison
  return o;
}
/** Objets du PREMIER à réussir un succès : l'objet commun + l'exclusif (bonus) */
function gainsSecret(x) { return [x.gain].concat(x.bonus ? [x.bonus] : []); }
/** « Casque « Foudre » + Avatar « Néon » » */
function libGains(l) { return l.map(([s, id]) => (SLOTS.find(z => z[0] === s) || [, "Objet"])[1] + " « " + ITEMS[s][id] + " »").join(" + "); }
/** Un univers (circuit de la saison) : { cle, drap, nom } ; nom court tiré du Grand Prix (« Mer de dunes », « Château »…) */
function univers(cle) { const g = typeof GPS !== "undefined" && GPS[cle]; return g ? { cle, drap: g.drap, nom: g.gp.replace(/^Grand Prix (de la |de l'|du |des |de )/, "").replace(/^./, c => c.toUpperCase()) } : null; }
/** L'univers se montre une fois la saison lancée (avant le 1er janvier, les 12 univers restent secrets) */
function universVisible() { return saisonJouee(); }
function htmlUnivers(cle, court) { const u = univers(cle); if (!u) return ""; return universVisible() ? '<span class="univ">' + u.drap + (court ? "" : " " + esc(u.nom)) + "</span>" : '<span class="univ cache">🔒' + (court ? "" : " univers secret") + "</span>"; }
/** D'où vient un objet (Trophées v2) : { monde (🗺️ trophée du mini-jeu), succes + exclusif (🏅 commun pour chacun / 🥇 exclusif du 1er), gant,
 *  million / champion / vote / ticket (💎 Légendes), reserve (2028) } */
function origineItem(slot, id) {
  if (slot === "plaque" && id === "coupsaison") return { vote: true, legende: true };
  if (estGainTicket(slot, id)) return { ticket: true, legende: true };
  if (estDepart(slot, id)) return { depart: true };
  if (estGainRecrue(slot, id)) return { souvenir: true, recrue: true };
  if (estGainDore(slot, id)) return { souvenir: true, dore: true };
  if (GAINS_SOUVENIR.some(g => g[0] === slot && g[1] === id)) return { souvenir: true };
  if (estGainChercheur(slot, id)) return { souvenir: true, chercheur: true, exclusif: id === GAIN_CHERCHEUR_OR[1] ? { id: "chercheuror", nom: "chercheur de Noël le plus rapide", ico: "🥇" } : null };
  { const m = typeof mjOrigine === "function" && mjOrigine(slot, id); if (m) return m; }   // 🎲 plaque du meilleur d'un mini-jeu (js/9-minijeux.js) : exclusif doré
  const a = (g => !!g && g[0] === slot && g[1] === id);
  const sc = SUCCES.find(x => a(x.gain) || a(x.bonus)); if (sc) return { succes: sc, exclusif: a(sc.bonus) ? sc : null };
  const t = TROPHEES_MONDES.find(z => z.gain.some(a)); if (t) return { monde: t };
  if (GANT.gain.some(a)) return { gant: true };
  if (GAINS_MILLION.some(a)) return { million: true, legende: true };
  if (gainsSecret(CHAMPION_EX).some(a)) return { champion: true, legende: true };
  const r = RESERVE_2028.find(x => a(x.gain)); if (r) return { reserve: r };
  if (OBJETS_RESERVE.some(a)) return { reserve: true };
  return {};
}
function numeroParDefaut(nom) { const i = D.personnes.findIndex(p => p.nom === nom); return ((i < 0 ? 0 : i) + 1) * 11 % 100 || 7; }
/** Équipement affiché : un objet qui n'est pas (ou plus) débloqué retombe sur l'objet de base */
function equipDe(nom) {
  const brut = ((D.ecurie || {})[nom] || {}).equip || {}, ouverts = debloques(nom), e = {};
  SLOTS.forEach(([s]) => { const [b, t] = lireTeinte(s, brut[s]); e[s] = b && ouverts.has(s + "." + b) ? b : BASE_ECURIE[s]; if (t && e[s] === b) (e.teintes = e.teintes || {})[s] = t; });   // v20.70 : 🎨 « rayuresor » → rayures + or
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
  const o = origineItem("plaque", p), quoi = o.dore ? "calendrier de l'Avent ouvert 24 jours sur 24" : o.chercheur ? "trésor de l'Atelier du Père Noël" + (p === GAIN_CHERCHEUR_OR[1] ? " (le plus rapide)" : "") : o.exclusif ? "succès doré « " + o.exclusif.nom + " » (le premier)" : o.succes ? "succès « " + o.succes.nom + " »" : o.monde ? "trophée du monde « " + nomMonde(o.monde) + " »" : o.gant ? "Gant de l'infini complet" : "";
  return '<span class="plaque' + classePlaque(p) + '" data-bdg="' + esc("Plaque « " + ITEMS.plaque[p] + " » de " + nom + (quoi ? ", gagnée avec le " + quoi : o.ticket ? ", gagnée avec le 🎫 ticket d'or de la Chocolaterie" : o.mj ? ", gagnée comme 🥇 meilleur du mini-jeu de " + MOIS_L[o.mj % 100 - 1] : o.souvenir ? ", souvenir du tour de chauffe (décembre 2026)" : "") + ".") + '">' + iconePlaque(p) + esc(ITEMS.plaque[p]) + "</span> ";
}
/** v20.46 · plaques émaillées à part : Ratatouille (plaque de rue parisienne, bleue), Ticket d'or (feuille d'or), Carré d'as, et les plaques des mini-jeux ; les autres restent en métal */
function classePlaque(id) { return ["ratatouille", "ticketor", "carredas", "epice", "voliere", "cheshire", "precieux", "eywa", "kyber", "toquedor", "joyce", "ithaque", "bataillon", "cheval", "hiver26", "hiverdore", "chercheur", "chercheuror", "recrue"].includes(id) ? " pl-" + id : ""; }
/** leur petit dessin, à nous : un tian de légumes en rosace (Ratatouille), un ticket doré (Ticket d'or) */
function iconePlaque(id) {
  if (id === "ratatouille") return '<svg class="pl-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#F4EBD6" stroke="#8A5A2B" stroke-width="1"/>' +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4, x = (10 + 5 * Math.cos(a)).toFixed(1), y = (10 + 5 * Math.sin(a)).toFixed(1); return '<circle cx="' + x + '" cy="' + y + '" r="3.1" fill="' + ["#D62839", "#F2B705", "#3F8F3A"][i % 3] + '" stroke="#fff" stroke-width=".5"/>'; }).join("") +
    '<circle cx="10" cy="10" r="2.6" fill="#3F8F3A" stroke="#fff" stroke-width=".5"/></svg>';
  if (id === "epice") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M0 12Q6 8 12 11T24 10V16H0Z" fill="#C97A34"/><path d="M2 7Q6 3 10 7Q6 10 2 7Z" fill="#fff" stroke="#5B3418" stroke-width=".7"/><circle cx="6" cy="7" r="1.9" fill="#2F7BFF"/><circle cx="6" cy="7" r=".8" fill="#0B2A66"/><path d="M14 7Q18 3 22 7Q18 10 14 7Z" fill="#fff" stroke="#5B3418" stroke-width=".7"/><circle cx="18" cy="7" r="1.9" fill="#2F7BFF"/><circle cx="18" cy="7" r=".8" fill="#0B2A66"/></svg>';   // 🎲 plaque du mini-jeu de janvier (deux yeux bleus sur le sable)
  if (id === "voliere") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="9" cy="9" rx="5" ry="6" fill="#C9B79C" stroke="#4A3A24" stroke-width=".7"/><circle cx="7.3" cy="7" r="1.6" fill="#FFF7DA"/><circle cx="10.7" cy="7" r="1.6" fill="#FFF7DA"/><circle cx="7.3" cy="7" r=".6"/><circle cx="10.7" cy="7" r=".6"/><rect x="15" y="5" width="8" height="6" rx="1" fill="#F7EFD8" stroke="#8A6A3A" stroke-width=".6"/><path d="M15 5L19 8.5 23 5" fill="none" stroke="#8A6A3A" stroke-width=".6"/></svg>';   // 🎲 plaque du mini-jeu de février
  if (id === "cheshire") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 5Q12 17 22 5Q12 11 2 5Z" fill="#F3E9FF" stroke="#7B3FB8" stroke-width=".9"/><circle cx="7" cy="2.6" r="1.4" fill="#C9F24E"/><circle cx="17" cy="2.6" r="1.4" fill="#C9F24E"/></svg>';   // 🎲 plaque du mini-jeu de mars
  if (id === "precieux") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><ellipse cx="12" cy="8" rx="8" ry="5.5" fill="none" stroke="#F7CF55" stroke-width="2.4"/><ellipse cx="12" cy="8" rx="8" ry="5.5" fill="none" stroke="#FF7A2B" stroke-width=".6" stroke-dasharray="1.5 1.5"/></svg>';   // 🎲 plaque du mini-jeu d'avril
  if (id === "eywa") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M12 15V6M12 8Q6 2 3 5M12 8Q18 2 21 5" fill="none" stroke="#B7FFF2" stroke-width="1.2"/><circle cx="12" cy="5" r="3.2" fill="#7CF7FF" opacity=".7"/><circle cx="5" cy="6" r="1.4" fill="#7CF7FF"/><circle cx="19" cy="6" r="1.4" fill="#7CF7FF"/></svg>';   // 🎲 plaque du mini-jeu de mai
  if (id === "kyber") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M12 1L17 8 12 15 7 8Z" fill="#7FD3FF" stroke="#1A5A8A" stroke-width=".8"/><path d="M12 1V15M7 8H17" stroke="#FFFFFF" stroke-width=".5" opacity=".8"/></svg>';   // 🎲 plaque du mini-jeu de juin
  if (id === "toquedor") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M7 14V9Q3 8 4 5 5 2 8 3 9 0 12 1 15 0 16 3 19 2 20 5 21 8 17 9V14Z" fill="#FFF6CC" stroke="#9A6716" stroke-width=".8"/><path d="M7 12H17" stroke="#C98E22" stroke-width="1.2"/></svg>';   // 🎲 plaque du mini-jeu de juillet
  if (id === "joyce") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 4Q12 10 23 4" fill="none" stroke="#222" stroke-width=".7"/>' + [[4, "#FF3B3B"], [9, "#3BD16F"], [15, "#3B8BFF"], [20, "#F7CF55"]].map(([x, c]) => '<circle cx="' + x + '" cy="' + (6 + Math.sin(x / 23 * Math.PI) * 2) + '" r="2.2" fill="' + c + '"/>').join("") + '</svg>';   // 🎲 plaque du mini-jeu d'août
  if (id === "ithaque") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M3 11H21L18 15H6Z" fill="#7A4A22"/><path d="M12 11V1" stroke="#5A3A1A"/><path d="M13 2Q21 6 13 10Z" fill="#F4EBD6"/></svg>';   // 🎲 plaque du mini-jeu de septembre
  if (id === "bataillon") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M12 8Q6 1 1 4 4 8 12 9Z" fill="#FFFFFF" stroke="#2A4A8A" stroke-width=".6"/><path d="M12 8Q18 1 23 4 20 8 12 9Z" fill="#2A4A8A" stroke="#FFFFFF" stroke-width=".6"/></svg>';   // 🎲 plaque du mini-jeu de novembre
  if (id === "chercheur" || id === "chercheuror") { const o = id === "chercheuror";   // 🎁 un cadeau sous une loupe (rien de la cachette)
    return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><rect x="2" y="6" width="10" height="8" rx="1" fill="' + (o ? "#FFF6CC" : "#D62839") + '" stroke="' + (o ? "#7A4A0C" : "#7A0E1C") + '" stroke-width=".7"/><path d="M7 6V14M2 9.5H12" stroke="' + (o ? "#C98E22" : "#F7CF55") + '" stroke-width="1.3"/>' +
      '<path d="M7 6C5 3 3.4 4.2 4.6 5.6M7 6C9 3 10.6 4.2 9.4 5.6" fill="none" stroke="' + (o ? "#C98E22" : "#F7CF55") + '" stroke-width="1"/><circle cx="16.5" cy="7" r="4.2" fill="rgba(200,235,255,.45)" stroke="' + (o ? "#7A4A0C" : "#2B3A4A") + '" stroke-width="1.4"/><path d="M19.4 10L22.6 13.4" stroke="' + (o ? "#7A4A0C" : "#2B3A4A") + '" stroke-width="2" stroke-linecap="round"/><circle cx="15.4" cy="5.8" r="1" fill="#fff" opacity=".8"/></svg>'; }
  if (id === "cheval") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M5 12V7L7 4H9L10 2 11.5 4 13 5H18L20 7V12" fill="#B9813F" stroke="#5A3412" stroke-width=".8" stroke-linejoin="round"/><path d="M9.5 4C8 3 7 3.6 6.6 4.6" stroke="#5A3412" stroke-width=".6" fill="none"/><circle cx="8.4" cy="5.2" r=".5" fill="#2A1A08"/><path d="M5 9H20M9 7V12M13 7V12M17 7V12" stroke="#5A3412" stroke-width=".5"/><rect x="3" y="12" width="19" height="1.6" rx=".6" fill="#7A4A1A"/><circle cx="6" cy="14.4" r="1.4" fill="#4A2C10"/><circle cx="19" cy="14.4" r="1.4" fill="#4A2C10"/></svg>';   // v20.61 · ⛵ Odyssée : le cheval de bois sur ses roues
  if (id === "carredas") return '<svg class="pl-ico" viewBox="0 0 20 20" aria-hidden="true"><rect x="1" y="1" width="18" height="18" rx="3" fill="#FBF8F0" stroke="#C9A227" stroke-width="1"/>' +   // v2 · 🧠 Stratège : les 4 couleurs
    '<path d="M6 3.6L8.2 6.4 6 9.2 3.8 6.4Z" fill="#D62839"/><path d="M14 8.6C11.6 6.8 10.6 6 10.6 4.9 10.6 4 11.3 3.4 12.1 3.4 12.8 3.4 13.5 3.8 14 4.4 14.5 3.8 15.2 3.4 15.9 3.4 16.7 3.4 17.4 4 17.4 4.9 17.4 6 16.4 6.8 14 8.6Z" fill="#D62839"/>' +
    '<path d="M6 11C3.8 12.8 2.8 13.6 2.8 14.7 2.8 15.6 3.5 16.2 4.3 16.2 4.8 16.2 5.3 15.9 5.6 15.5L5.2 17H6.8L6.4 15.5C6.7 15.9 7.2 16.2 7.7 16.2 8.5 16.2 9.2 15.6 9.2 14.7 9.2 13.6 8.2 12.8 6 11Z" fill="#15171B"/>' +
    '<circle cx="14" cy="12.6" r="1.5" fill="#15171B"/><circle cx="12.4" cy="14.6" r="1.5" fill="#15171B"/><circle cx="15.6" cy="14.6" r="1.5" fill="#15171B"/><path d="M14 14.4L13.4 17H14.6Z" fill="#15171B"/></svg>';
  if (id === "hiver26") return '<svg class="pl-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#1E4E8C" stroke="#CFEFFF" stroke-width="1"/><g stroke="#fff" stroke-width="1.3" stroke-linecap="round">' +
    [0, 60, 120].map(a => '<path d="M10 3.6V16.4M10 5.6 8.4 4.2M10 5.6 11.6 4.2M10 14.4 8.4 15.8M10 14.4 11.6 15.8" transform="rotate(' + a + ' 10 10)"/>').join("") + '</g><circle cx="10" cy="10" r="1.6" fill="#CFEFFF"/></svg>';
  if (id === "hiverdore") return '<svg class="pl-ico" viewBox="0 0 20 20" aria-hidden="true"><defs><radialGradient id="pl-hd" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFF6CC"/><stop offset=".55" stop-color="#F7CF55"/><stop offset="1" stop-color="#B7791F"/></radialGradient></defs>' +   // 🏅 le flocon d'Hiver 2026, en or, sur médaille
    '<circle cx="10" cy="10" r="9" fill="url(#pl-hd)" stroke="#7A4A0C" stroke-width="1"/><circle cx="10" cy="10" r="7.2" fill="none" stroke="#FFF6CC" stroke-width=".5" opacity=".8"/><g stroke="#1E4E8C" stroke-width="1.3" stroke-linecap="round">' +
    [0, 60, 120].map(a => '<path d="M10 4.2V15.8M10 6 8.6 4.8M10 6 11.4 4.8M10 14 8.6 15.2M10 14 11.4 15.2" transform="rotate(' + a + ' 10 10)"/>').join("") + '</g><circle cx="10" cy="10" r="1.6" fill="#FFF6CC" stroke="#1E4E8C" stroke-width=".6"/><path d="M15.6 2.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="#fff"/></svg>';
  if (id === "recrue") return '<svg class="pl-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.4 17 4V9.6C17 13.8 14 16.9 10 18.6 6 16.9 3 13.8 3 9.6V4Z" fill="#26313C" stroke="#9FE3C4" stroke-width="1"/>' +   // v20.70 · 🔰 Recrue 2026 : un écusson, deux chevrons de recrue
    '<path d="M6 9.4 10 6.6 14 9.4M6 12.8 10 10 14 12.8" fill="none" stroke="#9FE3C4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="15.2" r=".9" fill="#E9EEF3"/></svg>';
  if (id === "ticketor") return '<svg class="pl-ico" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 2H23V6A2 2 0 0 0 23 10V14H1V10A2 2 0 0 0 1 6Z" fill="#F7CF55" stroke="#7A4A0C" stroke-width="1"/><path d="M6 2.5V13.5" stroke="#7A4A0C" stroke-width=".7" stroke-dasharray="1.2 1"/><path d="M14 4.6L15 7 17.6 7.2 15.6 8.8 16.2 11.4 14 10 11.8 11.4 12.4 8.8 10.4 7.2 13 7Z" fill="#FFF6CC" stroke="#9A6716" stroke-width=".5"/></svg>';
  return "";
}

/* ---------- Course aux exclusifs : un seul exemplaire, pour le premier qui y arrive ----------
   Calculé à partir des relevés publics (mêmes règles pour tous), puis figé dans le Versus (propriété EXCLUSIFS)
   dès qu'il est décroché : même si un relevé change ensuite, l'objet reste à son premier propriétaire.
   À égalité dans le même mois : la meilleure valeur du critère l'emporte. */
const NIV_EX = ["", "Facile", "Intermédiaire", "Difficile", "Légendaire"], MED_EX = ["", "🥉", "🥈", "🥇", "💎"];
/* Trophées v2 (Théo, 25/11) : 12 de ces exploits deviennent les SUCCÈS de la saison, VISIBLES (objectif écrit, plus de secret muet) et sans lien avec les univers.
   Chacun qui réussit gagne le badge + l'objet commun (gain) ; le PREMIER gagne en plus l'objet exclusif (bonus), la version dorée et la cérémonie.
   palier = difficulté réelle (1 bronze, 2 argent, 3 or, 4 légendaire) : le dessin de la case monte avec (matière, cadre, ornement, éclat).
   « Premier champion » (legende: true) passe dans les Légendes. Les 11 autres (saison: 2028) restent dans le code pour 2028 : ni affichés ni comptés
   (le serveur continue de les calculer et de les figer, sans effet). niv = l'ancien niveau, gardé pour les cartes de collection. */
const EXCLUSIFS = [
  { id: "premiersang", niv: 1, palier: 1, ico: "⚔️", nom: "Premier sang", def: "gagner un mois de championnat", gain: ["plaque", "premiersang"], bonus: ["klaxon", "damier"] },
  { id: "cible", niv: 1, ico: "🎯", nom: "Dans le mille", def: "battre l'indice sur un mois (premier bonus 🎯)", gain: ["klaxon", "cibles"], saison: 2028 },
  { id: "decollage", niv: 1, palier: 2, ico: "🚀", nom: "Décollage", def: "faire +5 % sur un seul mois", gain: ["klaxon", "fusees"], bonus: ["trainee", "halo"] },
  { id: "fidele", niv: 1, ico: "🤝", nom: "Fidèle au poste", def: "verser 3 mois d'affilée", gain: ["plaque", "fidele"], saison: 2028 },
  { id: "vingt", niv: 1, ico: "🔢", nom: "Pointeur", def: "atteindre 12 points de championnat", gain: ["plaque", "vingt"], saison: 2028 },
  { id: "remontee", niv: 1, palier: 1, ico: "⏩", nom: "Coup de turbo", def: "gagner 2 places au championnat d'un mois à l'autre", gain: ["trainee", "turbo"], bonus: ["casque", "tortue"] },
  { id: "hattrick", niv: 2, palier: 3, ico: "⚡", nom: "Hat-trick", def: "gagner 3 mois d'affilée", gain: ["casque", "foudre"], bonus: ["fond", "neon"] },
  { id: "massue", niv: 2, palier: 3, ico: "💥", nom: "Coup de massue", def: "faire au moins 5 % de mieux que l'indice sur un mois", gain: ["trainee", "supernova"], bonus: ["livree", "arcenciel"] },
  // v2 : l'exclusif de « Cinq étoiles » = le klaxon « Dans le mille » (🎯, pris à la réserve 2028) ; la plaque Ratatouille rejoint le monde du Petit Chef
  { id: "cinqetoiles", niv: 2, palier: 2, ico: "🌟", nom: "Cinq étoiles", def: "cumuler 5 bonus 🎯", gain: ["finition", "etoilee"], bonus: ["klaxon", "cibles"] },
  { id: "mur10", niv: 2, palier: 2, ico: "💠", nom: "Le mur des 10 %", def: "atteindre +10 % cumulés depuis le départ de la saison 1", gain: ["livree", "platine"], bonus: ["plaque", "contre"] },
  // v2 (Théo, 25/11) : 🧠 Stratège, calculé ici ET au serveur (PodiumCommun.js, extrait de ce fichier) ; commun = plaque « Carré d'as » (nouvelle), exclusif = finition « Diamant » (prise à la réserve 2028)
  { id: "stratege", niv: 2, palier: 2, ico: "🧠", nom: "Stratège", def: "marquer des points avec chacune des 4 cartes de base (Aspiration, Turbo, Pneus pluie, Pari) dans la même saison", gain: ["plaque", "carredas"], bonus: ["finition", "diamant"] },
  { id: "cinquante", niv: 2, ico: "🏆", nom: "Trentenaire", def: "atteindre 30 points de championnat, toutes saisons confondues", gain: ["klaxon", "trophees"], saison: 2028 },
  { id: "inarretable", niv: 2, ico: "💎", nom: "Inarrêtable", def: "verser 12 mois d'affilée (relevés du Versus)", gain: ["finition", "diamant"], saison: 2028 },
  { id: "fusee", niv: 3, palier: 4, ico: "❤️‍🔥", nom: "Mois de feu", def: "faire +10 % sur un seul mois", gain: ["livree", "rubis"], bonus: ["trainee", "flammes"] },
  { id: "semestre", niv: 3, ico: "🧊", nom: "Sang-glacé", def: "battre l'indice 6 mois d'affilée", gain: ["casque", "glace"], saison: 2028 },
  { id: "phenix", niv: 3, palier: 4, ico: "🔥", nom: "Phénix", def: "repasser au-dessus de son meilleur niveau après une chute de 10 %", gain: ["casque", "phenix"], bonus: ["fond", "flammes"] },
  { id: "grandchelem", niv: 4, palier: 3, ico: "🌌", nom: "Grand chelem", def: "gagner 5 mois dans une même saison", gain: ["casque", "galaxie"], bonus: ["fond", "galaxie"] },
  { id: "maillot", niv: 3, palier: 3, ico: "☀️", nom: "Maillot jaune", def: "passer 6 mois en tête du championnat, au total", gain: ["finition", "soleil"], bonus: ["fond", "or"] },
  { id: "centurion", niv: 3, ico: "🎺", nom: "Soixante", def: "atteindre 60 points de championnat, toutes saisons confondues", gain: ["klaxon", "fanfare"], saison: 2028 },
  // Légende : le premier champion (le serveur le fige comme avant)
  { id: "champion", niv: 4, legende: true, ico: "🌿", nom: "Premier champion", def: "remporter une saison complète", gain: ["finition", "lauriers"], bonus: ["klaxon", "parade"] },
  { id: "mur25", niv: 4, ico: "🪐", nom: "Le mur des 25 %", def: "atteindre +25 % cumulés depuis le départ de la saison 1", gain: ["livree", "galaxie"], saison: 2028 },
  { id: "marathon", niv: 4, ico: "🌈", nom: "Marathonien", def: "verser 24 mois d'affilée", gain: ["trainee", "arcenciel"], saison: 2028 },
  { id: "mur50", niv: 4, ico: "🌹", nom: "Le mur des 50 %", def: "atteindre +50 % cumulés depuis le départ de la saison 1", gain: ["livree", "orrose"], saison: 2028 },
  { id: "doublechampion", niv: 4, ico: "🦅", nom: "Empereur", def: "remporter 2 saisons", gain: ["casque", "empereur"], saison: 2028 }
];
/** Les paliers de difficulté des succès (Théo, 25/11 : un succès simple ne doit pas ressembler à un difficile) */
const PALIERS = [null,
  { id: "bronze", nom: "Bronze", ico: "🥉", txt: "à la portée de tous" },
  { id: "argent", nom: "Argent", ico: "🥈", txt: "demande de la régularité" },
  { id: "or", nom: "Or", ico: "🥇", txt: "difficile" },
  { id: "legende", nom: "Légendaire", ico: "💎", txt: "très rare" }];
/** Les 12 succès de la saison (du plus simple au légendaire), le Premier champion (Légendes) et la réserve pour 2028 */
const SUCCES = EXCLUSIFS.filter(x => !x.saison && !x.legende).sort((a, b) => a.palier - b.palier);
const CHAMPION_EX = EXCLUSIFS.find(x => x.id === "champion");
const RESERVE_2028 = EXCLUSIFS.filter(x => x.saison === 2028);
/** Objets d'écurie gardés pour 2028 (plus gagnables cette saison : retirés de l'écurie), sauf ceux repris par un succès 2027 */
function objetReserve(slot, id) { const a = g => g && g[0] === slot && g[1] === id; return (RESERVE_2028.some(x => a(x.gain)) || OBJETS_RESERVE.some(a)) && !SUCCES.some(x => a(x.gain) || a(x.bonus)) && !TROPHEES_MONDES.some(t => t.gain.some(a)) && !GANT.gain.some(a) && !GAINS_MILLION.some(a); }
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
    const BASE4 = CARTES.map(z => z.id);   // v2 · 🧠 Stratège : les 4 cartes de base (Aspiration, Turbo, Pneus pluie, Pari)
    ys.forEach(y => {
      const c = championnat(y), wins = {}, jeu = {};   // jeu : cartes de base qui ont marqué dans CETTE saison
      let precPlaces = null;
      c.mois.forEach(m => {
        Object.keys(st).forEach(n => { if (!m.l.some(z => z.nom === n)) { st[n].run = 0; st[n].bat = 0; } });   // v20.44 (arbitre) : un mois d'absence casse les séries (REGLES_PODIUM)
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
          if (x.carte && x.carte.gain > 0 && BASE4.includes(x.carte.id)) { const j = jeu[x.nom] = jeu[x.nom] || []; if (!j.includes(x.carte.id)) j.push(x.carte.id); if (j.length === BASE4.length) note("stratege", x.nom, m.k, x.r); }
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
    // refonte des badges : on garde aussi l'ordre de tous les candidats (versions argentées du 2e au 5e, et leur histoire)
    v[x.id] = l.length ? Object.assign({}, l[0], { noms: l.filter(o => o.k === l[0].k).map(o => o.nom), tous: l }) : null;
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
/** Les succès DORÉS d'un pilote (le premier à les réussir) ; la réserve 2028 et le Premier champion (Légende) n'en font pas partie */
function exclusifsDe(nom) { return SUCCES.filter(x => possede(x.id, nom)); }
/** Trophées v2 · un succès : { or: le premier (figé par le serveur ou calculé), autres: [{ nom, k, score }] ceux qui l'ont réussi ensuite, tous: candidats dans l'ordre }.
 *  Même calcul que premiersExclusifs (rien ne change côté serveur) ; tout le monde peut le réussir, sans limite de places. */
function rangsSucces(id) {
  const or = detenteur(id), p = premiersExclusifs()[id], tous = (p && p.tous) || [];
  if (!or) return { or: null, autres: [], tous };
  return { or, autres: tous.filter(o => !or.noms.includes(o.nom)), tous };
}
/** A-t-il réussi ce succès (premier ou non) ? */
function reussi(id, nom) { return possede(id, nom) || rangsSucces(id).autres.some(o => o.nom === nom); }
/** Les succès réussis par un pilote (premier ou non) */
function succesDe(nom) { return SUCCES.filter(x => reussi(x.id, nom)); }
/** … et ceux qu'il a réussis APRÈS le premier (badge du palier, objet commun) */
function succesSuivantDe(nom) { return SUCCES.filter(x => !possede(x.id, nom) && reussi(x.id, nom)); }
/** Ce qui s'est passé (en % ou en points, jamais un montant) : « +11,2 % sur le mois » */
function histoireSecret(id, o) {
  if (!o || o.score === undefined || o.score === null || !isFinite(o.score)) return "";
  const s = o.score, p = v => pct(v, 1), idx = D.marche.indices[iRef()];
  return ({
    premiersang: () => "première victoire, " + p(s) + " sur le mois", decollage: () => p(s) + " sur le mois", fusee: () => p(s) + " sur le mois",
    remontee: () => "+" + s + " places au championnat en un mois", hattrick: () => "3e victoire d'affilée, " + p(s) + " sur le mois",
    massue: () => pts(s) + " devant le " + idx + " sur le mois", cinqetoiles: () => s + "e mois devant le " + idx, stratege: () => "4e carte de base qui marque, " + p(s) + " sur le mois",
    mur10: () => p(s - 1) + " cumulés depuis le départ", phenix: () => "record de cumul battu après la chute : " + p(s - 1) + " cumulés",
    maillot: () => "6e mois en tête du championnat (" + Math.round(s) + " points)", grandchelem: () => "5e victoire de la saison, " + p(s) + " sur le mois",
    champion: () => "champion de la saison avec " + Math.round(s) + " points"
  }[id] || (() => ""))();
}
/** La ligne racontée d'un secret pour un pilote : « Mois de feu · mars 2027 · +11,2 % sur le mois » */
function ligneHistoire(x, o) { const h = histoireSecret(x.id, o); return x.nom + " · " + moisLong(o.k) + (h ? " · " + h : ""); }
/* Figer un exclusif dans le Versus : la personne concernée (ou l'admin) le revendique ; le premier enregistré gagne. */
let EXCL_ENVOI = false;
/** V22 : annonce une fois les exclusifs que le serveur vient de t'attribuer */
function annoncerExclusifs() {
  if (!D || !D.exclusifs || simulation() || apercuSaison() || basesSeules()) return;
  const moi = moiVrai(); if (!moi) return;
  let vus = []; try { vus = JSON.parse(stock.get("versus.exclVus") || "[]"); } catch (e) { vus = []; }
  const nouveaux = SUCCES.filter(x => { const f = D.exclusifs[x.id]; return f && (f.noms || [f.nom]).includes(moi) && !vus.includes(x.id); });   // v2 : seulement les 12 succès de la saison (la réserve 2028 ne se fête pas)
  if (!vus.length && !stock.get("versus.exclVus")) { stock.set("versus.exclVus", JSON.stringify(SUCCES.filter(x => possede(x.id, moi)).map(x => x.id))); return; }   // premier passage : rien à fêter
  if (!nouveaux.length) return;
  stock.set("versus.exclVus", JSON.stringify(vus.concat(nouveaux.map(x => x.id))));
  // V15.9 : une vraie annonce (et plus un simple message de 4 s) : c'est un objet unique, gagné en premier
  const o = document.createElement("div"); o.className = "revel excl-an"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  // Trophées v2 : la cérémonie du succès DORÉ (le premier) : la médaille de son palier, couronnée, avec son histoire
  o.innerHTML = '<div class="rv-c"><span class="tuto-k">🥇 Succès doré · le premier</span>' + nouveaux.map((x, i) => { const r = rangsSucces(x.id), moiO = r.tous.find(z => z.nom === moi), P = PALIERS[x.palier];
    return '<div class="ea-l" style="--i:' + i + '"><div class="sc-grand ea-med p-' + P.id + '">' + svgMedaille(x.palier, true) + '<span class="cc-emo">' + x.ico + '</span></div><b>' + esc(x.ico + " " + x.nom) + '</b><small class="ea-mo">' + esc(P.ico + " " + P.nom + " · gravé à ton nom : " + moi) + "</small>" +
      (moiO ? '<small class="ea-hist">' + esc(ligneHistoire(x, moiO)) + "</small>" : "") + "<small>Tu es le premier : " + esc(libGains([x.gain])) + (x.bonus ? " + l'exclusif " + esc(libGains([x.bonus])) + ", que personne d'autre n'aura" : "") + ". Les suivants gagnent le badge et " + esc(libGains([x.gain])) + ".</small></div>"; }).join("") +
    '<div class="btn-row">' + (btnEquiper(...(nouveaux[0].bonus || nouveaux[0].gain)) || '<button class="btn acc" type="button" data-ea="ecurie">🏎️ Mon écurie</button>') + '<button class="btn ghost" type="button" data-ea="ok">Génial !</button></div></div>';   // v20.70 : « Équiper maintenant » l'exclusif
  document.body.appendChild(o); confettis("damier");
  const t0 = Date.now(), fermer = () => o.remove();
  o.addEventListener("click", e => { if (e.target === o && Date.now() - t0 > 2000) fermer(); });
  o.querySelector('[data-ea="ok"]').addEventListener("click", fermer);
  brancherEquiper(o, fermer);
  const ee = o.querySelector('[data-ea="ecurie"]'); if (ee) ee.addEventListener("click", () => { fermer(); ETAT.podium = "ecurie"; garder(); if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees"); });
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
  if (!saisonJouee()) return l;   // refonte : secrets, Gant et titres seulement en saison (pas pendant le tour de chauffe)
  const idx = D.marche.indices[iRef()];
  // les titres qu'il détient en ce moment (on se les vole chaque mois)
  const C = etatTitres(anneesSaison().slice(-1)[0]);
  TITRES.forEach(c => { const o = C[c.id]; if (o && o.nom === nom) l.push({ id: "t-" + c.id, ico: c.ico, nom: c.nom, niv: 4, html: '<span class="bdg ex titre t-' + c.id + '" data-bdg="' + esc(c.ico + " " + c.nom + " : titre détenu par " + nom + " depuis " + moisLong(o.depuis) + " (" + c.court + "). Il se vole chaque mois.") + '">' + c.ico + "</span>" }); });
  { const tk = gagnantsTicket().find(g => g.nom === nom); if (tk) l.push({ id: "ticket", ico: "🎫", nom: "Ticket d'or", niv: 4, html: '<span class="bdg ex n4 ticket" data-bdg="' + esc("🎫 Ticket d'or : " + nom + " l'a trouvé dans sa tablette de la Chocolaterie (un seul dans toute l'année).") + '">🎫</span>' }); }
  if (anneesSaison().some(y => (etatGant(y)[nom] || { n: 0 }).n === 6)) l.push({ id: "gant", ico: "🧤", nom: "Gant de l'infini", niv: 4, html: '<span class="bdg ex n4" data-bdg="' + esc("🧤 Gant de l'infini : " + nom + " a allumé les 6 pierres dans une saison.") + '">🧤</span>' });
  if (possede(CHAMPION_EX.id, nom)) l.push({ id: CHAMPION_EX.id, ico: CHAMPION_EX.ico, nom: CHAMPION_EX.nom, niv: 4, html: '<span class="bdg ex n4 or" data-bdg="' + esc("💎 🌿 Premier champion · Légende : " + nom + " a remporté la première saison. Il garde " + libGains(gainsSecret(CHAMPION_EX)) + ", en un seul exemplaire.") + '">' + CHAMPION_EX.ico + "</span>" });
  // Trophées v2 : succès DORÉS (le premier) puis succès réussis ensuite (badge à la couleur du palier)
  exclusifsDe(nom).sort((a, b) => b.palier - a.palier).forEach(x => l.push({ id: x.id, ico: x.ico, nom: x.nom, niv: x.palier, html: '<span class="bdg ex n' + x.palier + ' or" data-bdg="' + esc("🥇 " + x.ico + " " + x.nom + " · succès doré : " + nom + " a été le premier à " + x.def.replace("l'indice", "le " + idx) + ". Il garde l'exclusif " + libGains([x.bonus]) + ", en un seul exemplaire.") + '">' + x.ico + "</span>" }));
  succesSuivantDe(nom).sort((a, b) => b.palier - a.palier).forEach(x => l.push({ id: "a-" + x.id, ico: x.ico, nom: x.nom, niv: 0, html: '<span class="bdg ex sc-b p-' + PALIERS[x.palier].id + '" data-bdg="' + esc(PALIERS[x.palier].ico + " " + x.ico + " " + x.nom + " · succès " + PALIERS[x.palier].nom.toLowerCase() + " : " + nom + " l'a réussi (" + x.def.replace("l'indice", "le " + idx) + ").") + '">' + x.ico + "</span>" }));
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
/** lot47 · badges de la « ligne vivante » du Classement (saison seulement) : les 3 épinglés au plus, puis « +N ».
 *  Plus de 🟡 ici : le leader du championnat se voit à sa tête cerclée d'or (et c'est expliqué dans le détail de sa ligne). */
function badgesLigne(nom, e) {
  if (basesSeules() || !saisonJouee()) return "";
  const tous = badgesPossedes(nom); if (!tous.length) return "";
  const vus = badgesAffiches(nom, e), autres = tous.filter(b => !vus.some(x => x.id === b.id));
  return '<span class="bdgs">' + vus.map(b => b.html).join("") + (autres.length ? '<span class="bdg bdg-plus" data-bdg="' + esc(nom + " a aussi : " + autres.map(b => b.ico + " " + b.nom).join(", ") + ". Tout est dans sa vitrine (touche sa ligne, puis sa fiche). Chacun choisit ses 3 badges dans Podium › Écurie › Badges.") + '">+' + autres.length + "</span>" : "") + "</span>";
}
/** lot47 · la vitrine de la fiche commence par un palmarès en 3 chiffres (saison seulement, comme toute la vitrine) */
function palmaresVitrine(nom) {
  const ys = anneesSaison(), y = ys[ys.length - 1]; let titres = 0, manches = 0, tete = 0;
  try { titres = ys.filter(a => { const c = championnat(a); return c.complete && c.classement[0] === nom; }).length; } catch (e) { /* rien */ }
  try { const c = championnat(y); manches = c.mois.filter(m => (m.l || []).some(x => x.nom === nom && x.rg === 1)).length; tete = moisEnTete(nom, y); } catch (e) { /* rien */ }
  const tous = badgesPossedes(nom);
  const case_ = (n, l) => '<div><b>' + n + "</b><small>" + l + "</small></div>";
  return '<div class="vt-palm">' + case_(titres, titres > 1 ? "titres" : "titre") + case_(manches, manches > 1 ? "manches gagnées" : "manche gagnée") + case_(tete, "mois en tête") + "</div>" +
    (tous.length ? '<div class="vt-etagere" aria-label="Badges de ' + esc(nom) + '">' + tous.slice(0, 8).map(b => '<span class="vt-niche">' + b.html.replace('class="bdg', 'class="bdg vt-b') + "</span>").join("") + (tous.length > 8 ? '<span class="vt-niche plus">+' + (tous.length - 8) + "</span>" : "") + "</div>" : "");
}
/** Le « ? » d'un objet de l'écurie : d'où il vient (Trophées v2 : 🗺️ Mondes, 🏅 Succès commun, 🥇 Succès exclusif, 🧤 Gant, 💎 Légendes, 2028), qui l'a, ce qu'il reste à faire */
function texteOrigineItem(qui, slot, id) {
  const ouvert = debloques(qui).has(slot + "." + id), org = origineItem(slot, id), idx = D.marche.indices[iRef()];
  if (estDepart(slot, id)) return { t: "🏁 " + (BASE_ECURIE[slot] === id ? "De série" : "Objet de départ"), p: "Fourni à tout le monde dès le départ." };
  if (org.succes) {
    const x = org.succes, r = rangsSucces(x.id), d = r.or, P = PALIERS[x.palier], obj = x.def.replace("l'indice", "le " + idx), moiOk = reussi(x.id, qui);
    if (!org.exclusif) return { t: "🏅 Succès · " + x.ico + " " + x.nom + " (" + P.ico + " " + P.nom + ")", p: (moiOk ? "À toi : tu as réussi à " : "Pour l'avoir : ") + obj + ". Chacun qui réussit le gagne." + (d ? " Déjà réussi par " + d.noms.concat(r.autres.map(o => o.nom)).join(", ") + "." : "") };
    if (!d) return { t: "🥇 Exclusif du succès · " + x.ico + " " + x.nom, p: "Seul le PREMIER à " + obj + " gagnera cet objet, en un seul exemplaire. Personne ne l'a encore réussi." };
    if (d.noms.includes(qui)) return { t: "🥇 Exclusif du succès · " + x.ico + " " + x.nom, p: (d.noms.length > 1 ? "À toi, avec " + d.noms.filter(n => n !== qui).join(" et ") + " (le même mois)" : "À toi seul") + " : tu as été le premier à " + obj + " (" + moisLong(d.k) + ")." };
    return { t: "🥇 Exclusif du succès · " + x.ico + " " + x.nom, p: d.nom + " l'" + (d.noms.length > 1 ? "ont" : "a") + " décroché en premier en " + moisLong(d.k) + " : plus personne ne pourra avoir cet objet" + (moiOk ? " (toi, tu as le badge et l'objet commun du succès)." : " ; les suivants gagnent le badge et l'objet commun du succès.") };
  }
  if (org.monde) {
    const t = org.monde, o = (etatTropheesMondes()[t.id] || {})[qui] || { ok: false, p: 0, c: 1 }, mois = MOIS_L[t.mois - 1];
    return ouvert ? { t: "🗺️ Monde · " + icoMonde(t) + " " + nomMonde(t), p: "Gagné avec le trophée du monde : l'objectif commun du mini-jeu de " + mois + " a été réussi." }
      : { t: "🗺️ Monde · " + icoMonde(t) + " " + nomMonde(t), p: "Réussissez ensemble l'objectif commun du mini-jeu de " + mois + " : chacun gagne alors le trophée et cet objet.", prog: o.c ? o.p / o.c : 0, pt: o.txt || "" };
  }
  if (org.gant) { const y = anneesSaison().slice(-1)[0], n = y ? (etatGant(y)[qui] || { n: 0 }).n : 0;
    return ouvert ? { t: "🧤 Gant de l'infini", p: "Gagné en allumant les 6 pierres du Gant dans une saison." } : { t: "🧤 Gant de l'infini", p: "Allume les 6 pierres du Gant dans la saison (Trophées › 🧤 Gant).", prog: n / 6, pt: n + " / 6 pierres" }; }
  if (org.ticket) { const g = gagnantsTicket(); return { t: "💎 Légende · 🎫 Ticket d'or", p: g.some(x => x.nom === qui) ? "À toi : tu as trouvé LE ticket d'or dans ta tablette." : "Un seul ticket d'or pour toute la saison, caché dans une tablette de la 🍫 Chocolaterie." + (g.length ? " Trouvé par " + g[0].nom + "." : "") }; }
  if (org.mj) { const g = typeof gagnantsMJ === "function" ? gagnantsMJ(org.mj) : [], mois = MOIS_L[org.mj % 100 - 1];
    return { t: "🥇 Exclusif · 🗺️ mini-jeu de " + mois, p: g.includes(qui) ? "À toi : tu as été le meilleur du mini-jeu de " + mois + " (surnom du mois et plaque dorée)." : g.length ? "Gagné par " + g.join(" et ") + ", meilleur" + (g.length > 1 ? "s" : "") + " du mini-jeu de " + mois + "." : "Réservé au meilleur du mini-jeu de " + mois + " (page Course), avec son surnom du mois. Aucun point au championnat." }; }
  if (org.chercheur) { const ch = chercheursNoel(), i = ch.findIndex(x => x.nom === qui), j = i >= 0 ? ch[i].j : 0, jour = j ? (j % 100) + "/12" : "", or = id === GAIN_CHERCHEUR_OR[1], fin = noelFinal();
    const tps = x => x && typeof x.s === "number" && typeof dureeChrono === "function" ? " (" + dureeChrono(x.s) + ")" : "";   // v20.74 : la dorée va au plus rapide, attribuée le 31/12 à minuit
    return { t: "🎁 Souvenir · trésor de l'Atelier du Père Noël" + (or ? " · 🥇" : ""), p: or ? (i === 0 && fin ? "À toi : trouvé le trésor de l'Atelier du Père Noël" + (jour ? " le " + jour : "") + ", 🥇 le plus rapide" + tps(ch[0]) + "." : ch.length ? (fin ? "Attribuée au plus rapide à trouver le trésor de l'Atelier du Père Noël : " : "Pour le plus petit temps du mois, attribuée le 31 décembre à minuit · le plus rapide pour l'instant : ") + ch[0].nom + tps(ch[0]) + "." : "Pour le plus rapide qui trouvera le trésor de l'Atelier du Père Noël (décembre 2026, chrono lancé avec 🔍), attribuée le 31 décembre à minuit.")
      : i >= 0 ? "Trouvé le trésor de l'Atelier du Père Noël" + (jour ? " le " + jour : "") + tps(ch[i]) + (i === 0 ? (fin ? " · 🥇 le plus rapide" : " · 🥇 le plus rapide pour l'instant") : "") + "." : "Pour chaque pilote qui trouve le trésor de l'Atelier du Père Noël (décembre 2026)." }; }
  if (org.dore) return { t: "🏅 Souvenir · calendrier de l'Avent, 24 sur 24", p: ouvert ? "À toi : tu as ouvert les 24 cases du calendrier de l'Avent, chacune le jour même. Elle est à toi pour toujours, aucun point." : "Pour chaque pilote qui ouvre les 24 cases du calendrier de l'Avent (décembre 2026), chacune le jour même." };
  if (org.recrue) return { t: "🔰 Souvenir · Recrue 2026", p: ouvert ? "À toi : tu as joué le tour de chauffe de décembre 2026. Elle est à toi pour toujours, aucun point." : "Offerte à chaque pilote qui a joué le tour de chauffe de décembre 2026." };
  if (org.souvenir) return { t: "🎄 Souvenir du tour de chauffe", p: "Offert à chaque pilote du tour de chauffe : le cadeau de la case du 24 décembre 2026, dans le calendrier de l'Avent." };
  if (org.vote) return { t: "💎 Légende · 🗳️ Coup de la saison", p: "Gagné au vote de fin de saison : les autres pilotes t'élisent pour le coup de la saison." };
  if (org.champion) { const d = detenteur(CHAMPION_EX.id); return { t: "💎 Légende · 🌿 Premier champion", p: d ? (d.noms.includes(qui) ? "À toi : tu as remporté la première saison." : "Réservé à " + d.nom + ", premier champion.") : "Réservé au vainqueur de la première saison complète." }; }
  if (org.million) return { t: "💎 Légende · 👑 Premier millionnaire", p: D.premierMillion ? (D.premierMillion.nom === qui ? "À toi : premier millionnaire du groupe." : "Réservé à " + D.premierMillion.nom + ", premier millionnaire du groupe.") : "Réservé au premier du groupe qui atteindra 1 000 000 €." };
  if (org.reserve) return { t: "🔒 Saison 2028", p: "Cet objet se gagnera à partir de la saison 2." };
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
  // v20.46 · objets des univers : Éclaireur (Mur des titans), Toque (Petit Chef), Chocolat fondant (Chocolaterie), Carte à jouer (Merveilles)
  if (motif === "eclaireur") return lg([[0, "#5E9C63"], [.3, "#2F6B3B"], [.62, "#1F4A2A"], [1, "#12301B"]]) + "</linearGradient>";
  if (motif === "toque") return lg([[0, "#FFFFFF"], [.35, "#F3F1EA"], [.7, "#DAD6CB"], [1, "#B9B4A8"]]) + "</linearGradient>";
  if (motif === "chocolat") return lg([[0, "#B9733F"], [.16, "#7A3F1D"], [.4, "#4A230F"], [.55, "#9A5A2F"], [.78, "#5B2C13"], [1, "#2E1407"]]) + "</linearGradient>";
  if (motif === "carte") return '<pattern id="' + u + 'm" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#FBF8F0"/>' +
    '<path d="M6 9.6C3.2 7.4 2 6.3 2 4.9 2 3.8 2.9 3 3.9 3 4.8 3 5.5 3.5 6 4.2 6.5 3.5 7.2 3 8.1 3 9.1 3 10 3.8 10 4.9 10 6.3 8.8 7.4 6 9.6Z" fill="#D62839"/>' +
    '<path d="M18 14.6C20.6 16.6 21.8 17.6 21.8 19 21.8 20.1 21 20.8 20 20.8 19.4 20.8 18.8 20.5 18.5 20L19 22H17L17.5 20C17.2 20.5 16.6 20.8 16 20.8 15 20.8 14.2 20.1 14.2 19 14.2 17.6 15.4 16.6 18 14.6Z" fill="#15171B"/></pattern>';
  // v20.61 · objets redessinés à l'image de leur monde : Peau des sables (Dune), Pilote rebelle (Étoiles), Casque d'Ulysse (Odyssée), Éclats du multivers
  if (motif === "ver") return '<pattern id="' + u + 'm" width="26" height="40" patternUnits="userSpaceOnUse"><rect width="26" height="40" fill="#D9A35A"/><rect width="26" height="40" fill="#F2C98A" opacity=".35" y="-20" transform="skewX(-8)"/>' +
    '<path d="M2 -2C6 12 6 28 2 42" stroke="#8A5524" stroke-width="5" fill="none" opacity=".7"/><path d="M7.5 -2C11 12 11 28 7.5 42" stroke="#F6DCAA" stroke-width="1.3" fill="none" opacity=".8"/>' +
    '<circle cx="17" cy="9" r=".9" fill="#7FB8FF" opacity=".75"/><circle cx="21" cy="27" r=".6" fill="#B8DAFF" opacity=".8"/><circle cx="14" cy="33" r=".5" fill="#7FB8FF" opacity=".6"/></pattern>';
  if (motif === "anneau") return lg([[0, "#5A4E44"], [.3, "#2E2722"], [.7, "#1A1512"], [1, "#0B0907"]]) + "</linearGradient>";
  if (motif === "rebelle") return lg([[0, "#FFB27A"], [.3, "#F57A2E"], [.65, "#E0601C"], [1, "#9A3A0A"]]) + "</linearGradient>";
  if (motif === "hoplite") return lg([[0, "#F8DA98"], [.22, "#D39A48"], [.5, "#8A5320"], [.66, "#E6B064"], [1, "#5A3412"]]) + "</linearGradient>";
  if (motif === "fracture") return lg([[0, "#3A2F5C"], [.45, "#171230"], [1, "#07060F"]]) + "</linearGradient>";
  if (motif === "holo" || motif === "arcenciel") return '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2=".35" spreadMethod="reflect">' +
    [["#FF6B9A", 0], ["#FFC15E", .2], ["#E9F27A", .38], ["#5CF0B5", .55], ["#5AB8FF", .72], ["#B98CFF", .88], ["#FF6B9A", 1]].map(([col, o]) => '<stop offset="' + o + '" stop-color="' + col + '"/>').join("") +
    (ANIM ? '<animateTransform attributeName="gradientTransform" type="translate" values="0 0;1 0" dur="5s" repeatCount="indefinite"/>' : "") + "</linearGradient>";
  return "";
}
const MOTIFS_PLEINS = ["carbone", "damier", "tortue", "chrome", "or", "couronne", "oranime", "holo", "arcenciel", "foudre", "phenix", "platine", "glace", "rubis", "orrose", "empereur", "galaxie", "eclaireur", "toque", "chocolat", "carte", "ver", "anneau", "rebelle", "hoplite", "fracture"];
/** livrées claires : numéro et inscriptions en noir */
const LIVREES_CLAIRES = ["chrome", "or", "oranime", "platine", "orrose", "carte"];
function remplissage(u, motif, c) { return MOTIFS_PLEINS.includes(motif) ? "fill:url(#" + u + "m)" : "fill:" + c; }

/* ---------- Casque : coque brillante, visière fumée (irisée pour les plus rares), décor selon le modèle ---------- */
/* v20.48 (Théo : « le casque est mal foutu ») · un vrai casque de pilote, de profil vers la droite : coque ovale qui descend sur la nuque,
   mentonnière avancée, grande visière avec son joint et son pivot, prises d'air sur le dessus, petit aileron arrière, bourrelet de nuque. */
const COQUE = "M-14 9.4C-17.2 3.8-17.6-4.4-13.6-10.6C-9.6-16.8-2.6-19.8 4.8-19.4C13-18.9 19.4-13.6 21.2-5.8C21.9-2.8 22 .8 21.2 3.8L20.2 7.6C19.6 10 17.8 11.4 15.4 11.6L-10.6 11.8C-12.2 11.8-13.3 11-14 9.4Z";
const VISIERE = "M3.4-8.8C9.8-11.6 16.9-11 21.4-6.3C21.9-3.9 21.9-1.4 21.5.7C15.2 2.1 8.8 1.9 4.3.3C2.5-2.6 2.3-6.3 3.4-8.8Z";
function casqueForme(u, m, c, fin, lead, tn) {   // tn (v20.70) = { casque, finition } : couleurs choisies (🎨), sinon celles d'origine
  const iri = ["holo", "couronne", "chrome", "etoile", "foudre", "glace", "galaxie", "fracture"].includes(m), orv = m === "couronne" || m === "phenix" || m === "empereur" || m === "anneau" || m === "hoplite";
  const defs = '<defs>' + defsMotif(u, m, c) + '<clipPath id="' + u + 'k"><path d="' + COQUE + '"/></clipPath>' +
    '<radialGradient id="' + u + 'h" cx=".32" cy=".16" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".28" stop-color="#fff" stop-opacity=".16"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
    '<linearGradient id="' + u + 'v" x1="0" y1="0" x2="1" y2="1">' + (orv ? '<stop offset="0" stop-color="#FFE596"/><stop offset=".5" stop-color="#7A4A0C"/><stop offset="1" stop-color="#F7CF55"/>'
      : iri ? '<stop offset="0" stop-color="#7FE8FF"/><stop offset=".45" stop-color="#6A4BFF"/><stop offset=".75" stop-color="#FF6BB5"/><stop offset="1" stop-color="#FFC15E"/>'
      : '<stop offset="0" stop-color="#4a5466"/><stop offset=".45" stop-color="#090b0f"/><stop offset="1" stop-color="#232a38"/>') + "</linearGradient></defs>";
  let deco = {
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
    // v20.46 · l'Éclaireur : capuche de cape verte (plis), sangle de cuir, insigne aux deux ailes (blanche et bleue) dessiné par nous
    eclaireur: '<path d="M-15 8C-12-4-4-12 6-14M-11 11C-8 0-1-7 8-9" stroke="#0E2414" stroke-width="1.1" fill="none" opacity=".55"/><path d="M-17 4.5C-6-1.5 7-5.5 23-6.5" stroke="#6B4423" stroke-width="2.4" fill="none"/><path d="M-17 4.5C-6-1.5 7-5.5 23-6.5" stroke="#C99A5B" stroke-width=".6" fill="none" stroke-dasharray="1.5 1.5"/>' +
      '<g transform="translate(-5.5 -6)"><path d="M0 -5.2L4.8 -3.2V1.4C4.8 4.2 2.6 6 0 7 -2.6 6-4.8 4.2-4.8 1.4V-3.2Z" fill="#F4EBD6" stroke="#5A3A1C" stroke-width=".6"/>' +
      '<path d="M-.3 4.6C-1.4 2.6-3.8 1.2-4 -2.2-2.8-.8-1.6-.6-1.2-1.6-2.2-2-2.6-3-2.6-3.8-1.4-2.4-.6-2.2-.3-1.6Z" fill="#FFFFFF" stroke="#7D8794" stroke-width=".35"/>' +
      '<path d="M.3 4.6C1.4 2.6 3.8 1.2 4 -2.2 2.8-.8 1.6-.6 1.2-1.6 2.2-2 2.6-3 2.6-3.8 1.4-2.4.6-2.2.3-1.6Z" fill="#2F6FD6" stroke="#173B78" stroke-width=".35"/></g>',
    // v20.46 · la Toque : coque blanche, foulard tricolore (Paris), la toque plissée est posée au-dessus (après la visière)
    toque: '<path d="M-17 3.6C-6-2.4 7-6.4 23-7.4" stroke="#1F4FA8" stroke-width="1.5" fill="none"/><path d="M-17 5.4C-6-.6 7-4.6 23-5.6" stroke="#FFFFFF" stroke-width="1.5" fill="none"/><path d="M-17 7.2C-6 1.2 7-2.8 23-3.8" stroke="#D62839" stroke-width="1.5" fill="none"/>',
    // v20.61 · 💍 l'Anneau gravé : un anneau d'or qui fait le tour de la coque, et son inscription de feu (des signes à nous, qui rougeoient)
    anneau: '<path d="M-17 2C-6-4 7-8 23-9" stroke="#5A3606" stroke-width="5.2" fill="none"/><path d="M-17 2C-6-4 7-8 23-9" stroke="#F7CF55" stroke-width="3.8" fill="none"/><path d="M-17 1C-6-5 7-9 23-10" stroke="#FFF3B8" stroke-width=".6" fill="none" opacity=".8"/>' +
      '<path class="cq-runes" d="M-16 2.4C-5-3.6 8-7.6 23-8.6" stroke="#FF5A1A" stroke-width="1.1" fill="none" stroke-dasharray="1.8 .6 .5 .7 1.2 .9 .4 .6" style="filter:drop-shadow(0 0 1.2px #FF9A3A)"/>',
    // 🌌 Pilote rebelle : coque orange, deux bandes blanches, l'écusson rond (oiseau stylisé, dessiné par nous)
    rebelle: '<path d="M-17-1.6C-6-7.6 7-11.6 23-12.6" stroke="#FFFFFF" stroke-width="2.4" fill="none"/><path d="M-17 4.4C-6-1.6 7-5.6 23-6.6" stroke="#FFFFFF" stroke-width="2.4" fill="none"/><path d="M-17 1.4C-6-4.6 7-8.6 23-9.6" stroke="#B8321A" stroke-width="1.2" fill="none"/>' +
      '<path d="M-15 8.5H6M-15 10H4" stroke="#FFFFFF" stroke-width=".7" stroke-dasharray="1.4 1" opacity=".8"/>' +
      '<g transform="translate(-7.5 -8.4)"><circle r="3.9" fill="#FFFFFF" stroke="#7A260C" stroke-width=".6"/><path d="M-3-1.4C-2-.2-1 .6 0 2.2 1 .6 2-.2 3-1.4 1.6-.9.8-.9 0 .2-.8-.9-1.6-.9-3-1.4Z" fill="#C8321E"/><path d="M0-.4-.7-2.2 0-2.9.7-2.2Z" fill="#C8321E"/></g>',
    // ⛵ Casque d'Ulysse : bronze martelé, nasal et couvre-joue gravés, frise grecque ; la crête de crin rouge est posée au-dessus (après la visière)
    hoplite: '<path d="M2.6-12.4C.4-6.4.4-.4 3.6 6.4M5.6 6.6C7.6 8.2 10.6 9 14 8.8" stroke="#4A2A0C" stroke-width="1.1" fill="none" opacity=".75"/>',
    // 🌀 Éclats du multivers : la coque se fend, chaque éclat garde un autre univers (magenta, cyan) ; des fragments s'en détachent
    fracture: '<path d="M-6-4 0-12 6-10 3-2Z" fill="#3BE8FF" opacity=".28"/><path d="M-8 3 0 6-2 11-11 9Z" fill="#FF3BD4" opacity=".3"/><path d="M-15-6-6-4-8 3-15 2Z" fill="#F7F24A" opacity=".14"/>' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path class="cq-faille" d="M-15-8-6-4-8 3 0 6 6 2 13 7M-6-4 0-12 6-10M0 6-2 11M-8 3-15 2" stroke="#FF3BD4" stroke-width="1.2" style="filter:drop-shadow(0 0 1.3px #FF3BD4)"/>' +
      '<path d="M-14.3-8.7-5.3-4.7-7.3 2.3.7 5.3 6.7 1.3 13.7 6.3" stroke="#3BE8FF" stroke-width=".7" opacity=".95"/></g>',
    // v20.68 · casques de départ (neutres) : Rayé (deux bandes de course sur le dessus), Bicolore (bas blanc, filet sombre), Pois (pois blancs)
    raye: '<path d="M-17.4-7.6C-11.4-15.4-2.6-19.2 5-19C12.2-18.6 17.8-15 20.6-9.4" stroke="#FFFFFF" stroke-width="3.4" fill="none"/><path d="M-16.2-3.4C-10.2-10.6-2.2-14.2 5-14C11.4-13.7 16.2-10.8 19.2-6.4" stroke="#FFFFFF" stroke-width="1.5" fill="none"/>' +
      '<path d="M-17.4-5.6C-11.4-13.2-2.6-16.8 5-16.6C12-16.2 17.4-12.8 20.2-7.6" stroke="#11151B" stroke-width=".6" fill="none" opacity=".35"/>',
    bicolore: '<path d="M-21 2.6C-8-4.2 6-7.4 25-8.2V14H-21Z" fill="#F4F6F8"/><path d="M-21 2.6C-8-4.2 6-7.4 25-8.2" stroke="#11151B" stroke-width="1.3" fill="none"/><path d="M-21 4.4C-8-2.4 6-5.6 25-6.4" stroke="#11151B" stroke-width=".5" fill="none" opacity=".35"/>',
    pois: [[-11.5, -8.5, 2.3], [-4.6, -13.6, 1.9], [-13.4, 1.6, 2], [-5.4, -3.2, 2.5], [1.2, 6.4, 1.8], [-7.8, 7.4, 1.6], [9.4, 7.6, 1.5], [1.6, -15.8, 1.3], [-15.6, -4.2, 1.2]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#FFFFFF" stroke="#11151B" stroke-width=".35" stroke-opacity=".35"/>').join(""),
    empereur: '<path d="M-17 1C-6-5 7-9 23-10" stroke="#F7CF55" stroke-width="3" fill="none"/><path d="M-17 4.4C-6-1.6 7-5.6 23-6.6" stroke="#F7CF55" stroke-width=".9" fill="none" opacity=".8"/><path d="M-6-14-4.6-10.6-1-10.4-3.8-8.2-2.8-4.8-6-6.8-9.2-4.8-8.2-8.2-11-10.4-7.4-10.6Z" fill="#FFE596" stroke="#7A5300" stroke-width=".5"/>'
  }[m] || "";
  if (tn && tn.casque && (m === "raye" || m === "bicolore")) { deco = deco.replace(m === "raye" ? /#FFFFFF/g : /#F4F6F8/g, tn.casque); if (m === "bicolore" && tn.casque === TEINTES.noir[1]) deco = deco.replace(/stroke="#11151B"/g, 'stroke="#9AA3AE"'); }   // v20.70 · 🎨
  const brille = ["chrome", "couronne", "empereur", "glace", "holo", "etoile", "foudre", "galaxie", "phenix", "anneau", "rebelle", "hoplite"].includes(m) ? '<path class="cq-brille" d="M-34-30H-28L-40 16H-46Z" fill="#fff" opacity=".55"/>' : "";
  return defs + '<path d="' + COQUE + '" style="' + remplissage(u, m, c) + '"/>' +
    '<g clip-path="url(#' + u + 'k)">' + deco + '<path d="' + COQUE + '" fill="url(#' + u + 'h)"/>' + brille + "</g>" +
    // aileron arrière (gurney), prises d'air du dessus, mentonnière et ses ouïes
    '<path d="M-15.2-7-18.6-8.4-18-11.2-14.4-10.4Z" style="' + remplissage(u, m, c) + '"/><path d="M-15.2-7-18.6-8.4-18-11.2-14.4-10.4Z" fill="#000" opacity=".35"/><path d="M-18.6-8.4-18-11.2" stroke="#0b0d11" stroke-width=".9" stroke-linecap="round"/>' +
    '<path d="M-7.4-15.6l3.8-1.8M-.8-18.2l4-.6" stroke="#0b0d11" stroke-width="1.7" stroke-linecap="round" opacity=".75"/><path d="M-7-14.9l3.2-1.5M-.6-17.5l3.4-.5" stroke="#fff" stroke-width=".5" stroke-linecap="round" opacity=".35"/>' +
    '<path d="M13.4 6.2l.4-2.2M16 5.8l.4-2.2M18.6 5.2l.4-2" stroke="#0b0d11" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>' +
    // visière : joint sombre, verre (fumé, irisé ou doré), reflet, pivot
    '<path d="' + VISIERE + '" fill="#0b0d11" stroke="#0b0d11" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="' + VISIERE + '" fill="url(#' + u + 'v)"/>' +
    '<path d="M6-7.4C11-9.2 16.4-8.6 19.6-5.4" stroke="#fff" stroke-opacity=".75" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M8.6-1.4C12.4-.6 16.4-.6 20-1.4" stroke="#fff" stroke-opacity=".22" stroke-width=".8" fill="none" stroke-linecap="round"/>' +
    '<circle cx="2.2" cy="-3.6" r="2" fill="#0b0d11"/><circle cx="2.2" cy="-3.6" r=".9" fill="#9AA3AE"/>' +
    // bourrelet de nuque et contour
    '<path d="M-12.6 10.4H17" stroke="#0b0d11" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M-9-13.6C-5.4-16.8-.4-18.2 4.2-18" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".45"/>' +
    '<path d="' + COQUE + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width=".8"/>' +
    (m === "toque" ? '<g class="cq-toque" transform="translate(0 -1.6)"><path d="M-9.5-15.5V-19.5C-13-20.2-13.6-24.6-10.2-25.4-9.6-28.6-5.6-29.4-3.6-27.4-2-29.8 2.6-29.8 3.8-27.2 7.4-28.6 10.8-25.2 8.8-21.6 11-20.6 10.6-17.4 8.6-16.8V-15Z" fill="#FFFFFF" stroke="#B9B4A8" stroke-width=".8"/>' +
      '<path d="M-4.2-26.4C-4.6-23.6-4.4-21-3.8-18.6M1-27.6C.9-24.6 1-21.6 1.4-18.4M5.8-25.6C5.6-23.2 5.8-20.8 6.4-18.6" stroke="#C9C4B8" stroke-width=".7" fill="none"/><path d="M-9.5-17.6C-3-19.2 3-19.2 9-17.6V-15.2C3-16.6-3-16.6-9.5-15Z" fill="#EDEAE2" stroke="#B9B4A8" stroke-width=".6"/></g>' : "") +
    (m === "hoplite" ? '<g class="cq-crete"><path d="M-16.5-6.5C-18.5-19-7.5-30.5 5-30C12.5-29.6 17.6-26.4 19.2-20.6C14.4-23.6 8.6-24.6 2.6-23.8C-5.4-22.8-11.6-17-13-7.6Z" fill="#C8281E" stroke="#5E0B08" stroke-width=".8"/>' +
      '<path d="M-14-10C-14-18-8-24-2-26M-10-11C-9-17-4-21 2-22.6M-6-21.8C-1-25.6 6-27 12-25.4M0-28.6C6-29 12-27.6 16-24" stroke="#7A120E" stroke-width=".7" fill="none" opacity=".8"/><path d="M-12-14C-10-21-3-27 5-28" stroke="#FF7A5A" stroke-width=".8" fill="none" opacity=".7"/>' +
      '<path d="M-13.6-7.8C-11.6-15-6-20 1-21.4" stroke="#8A5320" stroke-width="1.6" fill="none"/></g>' : "") +
    (m === "fracture" ? '<g class="cq-eclats"><path d="M-19.6-12.4-16.4-16.2-15.6-11Z" fill="#3BE8FF" stroke="#E6FBFF" stroke-width=".3"/><path d="M-20.2-5-17.4-7.4-17.6-2.8Z" fill="#FF3BD4" stroke="#FFE6FA" stroke-width=".3"/><path d="M-20.4 3.6-17.6 2.2-18.8 6Z" fill="#F7F24A" opacity=".9"/></g>' : "") +
    (m === "couronne" ? '<g transform="translate(0 -1.8)"><path d="M-10-16.5-8.5-24-4-19.5 1-26 6-19.5 10.5-24 12-16.5Z" fill="url(#' + u + 'm)" stroke="#6B430C" stroke-width=".8"/><circle cx="1" cy="-26" r="1.6" fill="#FF4D6D"/><circle cx="-8.5" cy="-24" r="1.2" fill="#5AB8FF"/><circle cx="10.5" cy="-24" r="1.2" fill="#5AB8FF"/></g>' : "") +
    finitionCasque(u, fin, c, lead, tn && tn.finition);
}
/* Finitions (liserés autour de la coque) et liseré or du leader, porté en plus de sa finition */
function finitionCasque(u, fin, c, lead, tf) {
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
  // v20.61 · finitions des mondes : Balle ailée (Château), Cape elfique (Anneau), Bioluminescence (Pandora), Feuille d'or (🎫 Ticket d'or)
  else if (fin === "ailee") h += lis("#7A5300", 2) + lis("#F7CF55", 1) +
    '<g transform="translate(-9 -21.6)"><g class="fin-ailee"><path d="M-1-.2C-4.4-4.6-8.6-4-10-1-7.4-2-4.6-1.4-1 .8Z" fill="#FFFDF2" stroke="#B9A06A" stroke-width=".4"/><path d="M-2.2-1.4C-4.6-3.2-6.6-3-7.6-2" stroke="#D9C9A0" stroke-width=".3" fill="none"/>' +
    '<path d="M1-.2C4.4-4.6 8.6-4 10-1 7.4-2 4.6-1.4 1 .8Z" fill="#FFFDF2" stroke="#B9A06A" stroke-width=".4"/><circle r="2.3" fill="#F7CF55" stroke="#7A5300" stroke-width=".45"/><path d="M-1.6-.4C-.6.6.6.6 1.6-.4" stroke="#9A6716" stroke-width=".35" fill="none"/><circle cx="-.7" cy="-.8" r=".7" fill="#fff"/></g></g>';
  else if (fin === "elfique") h += '<path d="M-12.6 8.2C-16.6 9.6-19.2 11.6-20.4 13.8-15.6 13.4-11.4 12.8-7.6 11.8Z" fill="#3E7D4A" stroke="#1E3A26" stroke-width=".45"/><path d="M-13 10.4C-15.4 11.4-17.2 12.4-18.4 13.4" stroke="#8FC79A" stroke-width=".4" fill="none"/>' +
    lis("#1E3A26", 2.6) + lis("#CFE8D2", 1.1) +
    '<g transform="translate(-10.6 6.4) rotate(-28)"><path d="M0-4.4C2.8-2.2 2.8 2.2 0 4.4-2.8 2.2-2.8-2.2 0-4.4Z" fill="#4E9A5C" stroke="#EEF4F6" stroke-width=".7"/><path d="M0-3.6V3.8M0-1.4 1.3-2.4M0 .6 1.3-.4M0-1.4-1.3-2.4M0 .6-1.3-.4" stroke="#EEF4F6" stroke-width=".35"/></g>';
  else if (fin === "biolum") h += '<path class="fin-bio" d="' + COQUE + '" fill="none" stroke="#5CF2E6" stroke-width="1.7" stroke-dasharray=".1 2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 1.6px #5CF2E6)"/>' +
    '<path class="fin-bio b2" d="' + COQUE + '" fill="none" stroke="#FF8AE0" stroke-width="1.2" stroke-dasharray=".1 5" stroke-dashoffset="1.2" stroke-linecap="round" style="filter:drop-shadow(0 0 1.2px #FF8AE0)"/>' +
    [[-11, -9, .9], [-4, -14, .7], [-13, 0, .8], [-6, 6, .7], [9, 6.5, .8], [-1, -4, .6]].map(([x, y, r]) => '<circle class="fin-bio" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#9AFFF6" style="filter:drop-shadow(0 0 1px #5CF2E6)"/>').join("");
  else if (fin === "feuilledor") h += '<defs><linearGradient id="' + u + 'fo" x1="-20" y1="-10" x2="22" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8A5A0C"/><stop offset=".4" stop-color="#F7CF55"/><stop offset=".5" stop-color="#FFFBE0"/><stop offset=".6" stop-color="#F7CF55"/><stop offset="1" stop-color="#8A5A0C"/>' +
      (ANIM ? '<animateTransform attributeName="gradientTransform" type="translate" values="-34 0;34 0;34 0" keyTimes="0;.6;1" dur="3.6s" repeatCount="indefinite"/>' : "") + "</linearGradient></defs>" +
    lis("#4A2C05", 3) + '<path d="' + COQUE + '" fill="none" stroke="url(#' + u + 'fo)" stroke-width="1.8"/>' +
    [[-12, -11, 2.2, 10], [-5, -15.6, 1.8, 40], [0, -17.4, 1.3, 75], [-14, -2, 2, 120], [-7.4, 3.6, 2.4, 160], [-1, 7.6, 1.6, 205], [8.4, 7.4, 1.9, 250], [-9.6, -5.6, 1.2, 300]].map(([x, y, r, a]) =>
      '<path class="fin-feuille" d="M' + (x - r) + " " + (y - r * .4) + "L" + (x - r * .1) + " " + (y - r) + "L" + (x + r * .9) + " " + (y - r * .5) + "L" + (x + r * .7) + " " + (y + r * .6) + "L" + (x - r * .3) + " " + (y + r * .8) + 'Z" fill="#F7CF55" stroke="#FFF6CC" stroke-width=".35" transform="rotate(' + a + " " + x + " " + y + ')"/>').join("");
  // v20.68 · finitions de départ (neutres) : Liseré blanc, Liseré noir, Mat (coque adoucie, sans reflet), Brillant (vernis : grands reflets et une étincelle)
  else if (fin === "lisblanc") h += lis("#2A2F38", 2.7) + lis(tf || "#FFFFFF", 1.4);   // v20.70 · 🎨 tf : la couleur choisie
  else if (fin === "lisnoir") h += lis("#FFFFFF", 2.7, ' opacity=".55"') + lis(tf || "#0B0D11", 1.6);
  else if (fin === "mat") h += '<path d="' + COQUE + VISIERE + '" fill-rule="evenodd" fill="#3A3F48" opacity=".34"/><path d="M-9-13.6C-5.4-16.8-.4-18.2 4.2-18" stroke="#3A3F48" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".55"/>' + lis("#3A3F48", 1.1);
  else if (fin === "brillant") h += '<g clip-path="url(#' + u + 'k)"><path d="M-15.4-2.4C-14.6-10.4-8.6-16.4-.6-17.6" stroke="#FFFFFF" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/><path d="M-13.4 3.6C-13.4.6-12.6-2-11.2-4.2" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>' +
    '<path class="cq-brille" d="M-30-26H-24L-36 18H-42Z" fill="#fff" opacity=".42"/></g>' + lis("#FFFFFF", .7, ' opacity=".7"') +
    '<path class="fin-eclat" d="M-6.5-20.2L-5.8-18.2-3.8-17.5-5.8-16.8-6.5-14.8-7.2-16.8-9.2-17.5-7.2-18.2Z" fill="#FFFFFF"/>';
  else if (fin === "lauriers") {
    const feuilles = (sens) => [0, 1, 2, 3, 4].map(i => { const t = i / 4, x = sens < 0 ? -13 - 3 * Math.sin(t * 2.4) : 18 + 3 * Math.sin(t * 2.4), y = 12 - t * 20, a = sens < 0 ? -30 - t * 40 : 30 + t * 40;
      return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="1.5" ry="3.3" transform="rotate(' + a.toFixed(0) + " " + x.toFixed(1) + " " + y.toFixed(1) + ')" fill="#E9C25A" stroke="#6B4B0C" stroke-width=".45"/>'; }).join("");
    h += '<path d="M-12 13C-18 6-18-3-15-9M17 13C23 6 23-3 21-9" stroke="#8A6414" stroke-width=".9" fill="none"/>' + feuilles(-1) + feuilles(1);
  }
  return h;
}
/** Avatar public : le casque (avec sa finition) dans une pastille dont le fond se débloque en course */
/* V16.26 : « Mon casque » était masqué en attendant d'être redessiné (demande de Théo). v20.48 : il est redessiné ; il revient avec l'Écurie,
   donc pas avant la saison (tour de chauffe : tout le monde garde sa tête), sauf en aperçu admin. */
function casqueCache() { try { return !ecurieOuverte(); } catch (e) { return true; } }   // v20.61 : le casque en avatar dès l'ouverture de l'écurie (1/12)
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
  const tete = casqueCache() || (eq.pilote || "tete") === "tete";
  const lead = tete && !eq.vignette && saisonVisible() && leaderSaison() === nom;
  return '<span class="av av-' + (eq.fond || "couleur") + (tete ? " av-tete" : "") + (lead ? " av-lead" : "") + ((ereDorActive() || {}).nom === nom ? " av-or" : "") + '" style="--c:' + couleur(nom) + '">' + (tete ? svgTete(nom, eq, eq.vignette) : svgCasque(nom, eq)) + "</span>";
}
/** v20.61 (règle de Théo, 25/11) · EN COURSE (portraits et pastilles 2D/3D, grille, liste de la page Course, verdict de la course) chacun garde TOUJOURS son visage
 *  (portrait importé ou tête dessinée, avec l'accessoire du mois s'il en a un), sur le fond par défaut, pour qu'on sache qui est qui ; jamais le casque ni l'avatar
 *  choisis dans l'écurie (ceux-là s'affichent partout ailleurs). La voiture, elle, reste personnalisée. extra = réglages en plus (skin, vignette…). */
function avatarCourse(nom, extra) {
  let sk = null; try { sk = accessoireMerite(nom); } catch (er) { sk = null; }
  return avatar(nom, Object.assign({}, equipDe(nom), sk ? { skin: sk } : {}, extra || {}, { pilote: "tete", fond: "couleur" }));
}
function svgCasque(nom, e) {
  const eq = e || equipDe(nom), u = "sv" + (++NSVG), c = couleur(nom), lead = !eq.vignette && saisonVisible() && leaderSaison() === nom;
  return '<svg class="casque c-' + eq.casque + (lead ? " leader" : "") + '" viewBox="' + (eq.casque === "toque" || eq.casque === "couronne" || eq.casque === "hoplite" ? "-20.5 -33 44 46" : "-20.5 -26 44 40") + '" aria-hidden="true">' + casqueForme(u, eq.casque, c, eq.finition, lead, teintesHex(nom, eq)) + "</svg>";
}

/* v20.46 · habillages dessinés par-dessus la peinture (dans la découpe de la caisse) */
/** Chocolat fondant : une nappe plus sombre coule du haut de la caisse en gouttes rondes, avec ses reflets caramel */
function habillageChocolat() {
  const g = [[96, 14], [128, 26], [154, 12], [180, 30], [216, 16], [246, 34], [272, 18], [302, 28], [336, 15], [372, 22], [404, 10]];
  const haut = x => (84 + (x - 60) * .045).toFixed(1);
  return '<path d="M40 40H470V' + haut(470) + g.slice().reverse().map(([x, h]) => "L" + (x + 7) + " " + haut(x + 7) + "C" + (x + 6) + " " + (+haut(x) + h * .6).toFixed(1) + " " + (x + 5) + " " + (+haut(x) + h).toFixed(1) + " " + x + " " + (+haut(x) + h).toFixed(1) + "S" + (x - 6) + " " + (+haut(x) + h * .6).toFixed(1) + " " + (x - 7) + " " + haut(x - 7)).join("") + 'L40 ' + haut(40) + 'Z" fill="#2A1205" opacity=".62"/>' +
    g.map(([x, h]) => '<ellipse cx="' + (x - 2) + '" cy="' + (+haut(x) + h - 3).toFixed(1) + '" rx="1.2" ry="1.8" fill="#F3C99B" opacity=".6"/>').join("") +
    '<path d="M130 62C190 52 260 56 330 68" stroke="#F3C99B" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>';
}
/** v20.61 · Peau des sables (Dune) : les anneaux du ver géant sur la caisse, une bouche en rosace de dents sur le museau, la poussière d'épice bleue qui scintille */
function habillageVer() {
  return '<g opacity=".9">' + [[372, 9], [398, 7.5], [420, 6]].map(([x, r]) => '<circle cx="' + x + '" cy="108" r="' + r + '" fill="none" stroke="#5A3412" stroke-width="1.4" opacity=".55"/>').join("") + "</g>" +
    '<g fill="#F6DCAA" opacity=".85">' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4, x = 446 + 5.2 * Math.cos(a), y = 113 + 5.2 * Math.sin(a); return '<path d="M' + (446 + 2 * Math.cos(a)).toFixed(1) + " " + (113 + 2 * Math.sin(a)).toFixed(1) + "L" + x.toFixed(1) + " " + y.toFixed(1) + '" stroke="#F6DCAA" stroke-width="1.3"/>'; }).join("") + "</g>" +
    '<g class="vt-epice" fill="#8FC8FF">' + [[150, 66], [196, 92], [240, 58], [288, 104], [330, 76], [120, 100], [262, 88]].map(([x, y], i) => '<circle cx="' + x + '" cy="' + y + '" r="' + (1.1 + (i % 3) * .35) + '"/>').join("") + "</g>";
}
/** v20.68 · livrées de départ (neutres), par-dessus la couleur du pilote : Rayures (deux bandes de course), Damier (bande à damier le long du flanc),
 *  Bicolore (arrière anthracite, coupe en biais), Flammes (langues de feu qui partent du museau) */
function habillageDepart(lv, u, t) {   // t (v20.70) : couleur choisie des Rayures (🎨)
  if (lv === "rayures") return '<path d="M0 93.6H480" stroke="' + (t || "#FFFFFF") + '" stroke-width="6"/><path d="M0 100.4H480" stroke="' + (t || "#FFFFFF") + '" stroke-width="2.2"/><path d="M0 90.4H480M0 96.8H480" stroke="#11151B" stroke-width=".7" opacity=".3"/>';
  if (lv === "damier") return '<defs><pattern id="' + u + 'dq" width="10" height="10" patternUnits="userSpaceOnUse" y="89"><rect width="10" height="10" fill="#F5F5F2"/><rect width="5" height="5" fill="#101215"/><rect x="5" y="5" width="5" height="5" fill="#101215"/></pattern></defs>' +
    '<rect x="0" y="89" width="480" height="10" fill="url(#' + u + 'dq)"/><path d="M0 88.5H480M0 99.5H480" stroke="#101215" stroke-width="1"/>';
  if (lv === "bicolore") return '<path d="M0 30H232L206 140H0Z" fill="#1E232B"/><path d="M232 30L206 140" stroke="#FFFFFF" stroke-width="2.2"/><path d="M226 30L200 140" stroke="#FFFFFF" stroke-width=".8" opacity=".55"/>';
  if (lv === "flammes") return '<g transform="translate(470 110) scale(1.9 1.5) translate(-470 -110)">' + '<path d="M470 97C432 97 402 99 372 102.6C392 103.6 404 105.4 410 106.6C378 107.8 348 110 316 113C348 114 372 115 388 116.2C368 117.4 352 119.4 334 122.4L470 124Z" fill="#FF6A1A" stroke="#8A1A05" stroke-width=".5" stroke-linejoin="round"/>' +
    '<path d="M470 103.6C442 103.6 420 104.6 402 106.8C413 107.8 419 108.8 423 110C404 111 388 112.2 370 114C390 115 403 116 411 117.2L470 120Z" fill="#FFD23F"/><path d="M470 107.6C452 107.6 438 108.4 428 109.8C440 110.8 448 111.8 452 113L470 114.6Z" fill="#FFF6CC" opacity=".85"/></g>';
  return "";
}
/** Carte à jouer : un grand as de cœur sur le ponton, et l'index « A♥ » dans le coin */
function habillageCarte() {
  return '<path d="M226 118C210 106 202 99 202 91 202 85 206.5 81 212 81 216 81 219.5 83.5 222 87 224.5 83.5 228 81 232 81 237.5 81 242 85 242 91 242 99 234 106 218 118Z" fill="#D62839" opacity=".92"/>' +
    '<text x="150" y="104" style="font:800 13px Georgia,serif;fill:#D62839">A</text><path d="M155.5 114C151.2 110.6 149.6 109.2 149.6 107.6 149.6 106.4 150.5 105.6 151.6 105.6 152.4 105.6 153 106 153.4 106.6 153.8 106 154.4 105.6 155.2 105.6 156.3 105.6 157.2 106.4 157.2 107.6 157.2 109.2 155.6 110.6 155.5 114Z" fill="#D62839"/>';
}
/* ---------- Voiture : F1 de profil, ombrée, avec reflet au sol ---------- */
/** o = { nom, e (équipement), drapeau (texte ou null), roule, reflet, label } */
/** v20.80 (Théo) · vue de la voiture dans l'écurie : 3D par défaut, 2D (dessin d'origine) au choix, gardé sur l'appareil */
function ecuVue2D() { try { return stock.get("versus.ecuVue") === "2d"; } catch (e) { return false; } }
function btnVueEcu() { return window.Piste && Piste.supporte && Piste.supporte() ? '<button class="sr-klaxon sr-vue" type="button" data-ecu-vue aria-label="' + (ecuVue2D() ? "Voir la voiture en 3D" : "Voir la voiture en 2D") + '">' + (ecuVue2D() ? "🧊 3D" : "✏️ 2D") + "</button>" : ""; }
function svgVoiture(o) {
  const u = "sv" + (++NSVG), c = couleur(o.nom), e = o.e, lv = e.livree, avecDrapeau = o.drapeau !== undefined && o.drapeau !== null;
  const haut = avecDrapeau ? 92 : 10, sol = haut + 150, H = sol + (o.reflet ? 46 : 10);
  const neon = lv === "neon";
  const peinture = neon ? "fill:#0a0c11" : remplissage(u, lv === "couleur" || lv === "damier" ? "" : lv, c);   // v20.68 : la livrée Damier = une bande, pas toute la caisse
  const filet = neon ? c : lv === "or" || lv === "oranime" ? "#3B2405" : lv === "chrome" || lv === "platine" || lv === "orrose" ? "#11151B" : lv === "rubis" ? "#FFD1DC" : lv === "galaxie" ? "#FFB8F0" : lv === "chocolat" ? "#E8B07A" : lv === "carte" ? "#D62839" : lv === "ver" ? "#F6DCAA" : "#ffffff";
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
    // v20.46 · Câbles d'acier (Mur des titans) : deux filins tendus vers leurs grappins, et les bouffées de gaz de l'équipement
    cables: '<g class="vt-cables">' + [["M118 96C96 60 64 26 22 0", 22, 0], ["M250 90C262 56 290 24 336 -2", 336, -2]].map(([d, x, y]) =>
      '<path d="' + d + '" fill="none" stroke="#3B424B" stroke-width="3.4" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#E3E8EE" stroke-width="1.5" stroke-dasharray="2.4 1.6" stroke-linecap="round"/>' +
      '<g transform="translate(' + x + " " + y + ')" fill="#AEB7C2" stroke="#3B424B" stroke-width=".9"><path d="M0 0L-7-2-3 2-6 8 0 4 6 8 3 2 7-2Z"/></g>').join("") +
      '<g class="vt-gaz" fill="#E6EAEF" stroke="#7D8794" stroke-width=".8" opacity=".9"><circle cx="112" cy="80" r="8"/><circle cx="96" cy="74" r="6.5"/><circle cx="82" cy="80" r="5"/><circle cx="70" cy="74" r="3.6"/><circle cx="60" cy="78" r="2.4"/></g></g>',
    // v20.61 · 🌌 Sabre lumineux (rouge, côté obscur) : la lame court le long de l'aileron arrière, sa poignée au bout ; une traînée rouge derrière
    sabre: '<g class="vt-sabre"><path d="M30 60C0 64-30 70-60 80M30 74C0 78-24 86-50 96" stroke="#FF3A48" stroke-width="2.4" fill="none" opacity=".45" stroke-linecap="round"/></g>',
    // 🌀 Faille : la voiture laisse derrière elle des copies décalées d'autres univers (magenta, cyan, jaune), en blocs qui sautent
    glitch: '<g class="vt-glitch">' + [[-14, 62, 50, 6, "#FF3BD4"], [6, 74, 40, 4, "#3BE8FF"], [-30, 86, 70, 7, "#FF3BD4"], [14, 97, 34, 4, "#F7F24A"], [-10, 106, 60, 6, "#3BE8FF"], [26, 68, 16, 3, "#FFFFFF"], [-40, 116, 56, 4, "#FF3BD4"], [40, 52, 14, 3, "#3BE8FF"]].map(([x, y, w, h, c], i) =>
      '<rect class="gl' + (i % 3) + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '" opacity=".8"/>').join("") + "</g>",
    // v20.61 · Flocons (souvenir du tour de chauffe) : une poudreuse de flocons dessinés derrière la voiture
    flocons: '<g class="vt-flocons" stroke="#DDF2FF" stroke-width="1.6" stroke-linecap="round">' + [[28, 86, 7], [6, 102, 9], [-18, 84, 6], [14, 118, 5], [-34, 108, 7], [-50, 90, 4], [40, 108, 4]].map(([x, y, r]) =>
      '<g transform="translate(' + x + " " + y + ')">' + [0, 60, 120].map(a => '<path d="M0 ' + -r + "V" + r + '" transform="rotate(' + a + ')"/>').join("") + "</g>").join("") + '<path d="M120 100C70 98 20 92 -60 100" stroke="#BFE6FF" stroke-width="10" opacity=".25"/></g>',
    // v20.68 · traînées de départ (neutres) : Pointillés, Double (deux filets parallèles), Ruban (bande qui ondule), Fumée (bouffées de pneus)
    pointilles: '<g class="vt-lignes" style="fill:' + c + '">' + [[30, 90, 3.6], [12, 90, 3.1], [-6, 90, 2.6], [-24, 90, 2.1], [-42, 90, 1.6], [26, 110, 3.6], [8, 110, 3.1], [-10, 110, 2.6], [-28, 110, 2.1], [-46, 110, 1.6]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join("") + "</g>",
    double: '<g class="vt-lignes" style="stroke:' + c + '" stroke-width="3.2" stroke-linecap="round" opacity=".8"><path d="M34 92H-58M34 108H-58"/></g><path d="M34 92H-30M34 108H-30" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/>',
    ruban: '<path d="M40 100C14 86-8 114-34 100S-62 88-74 96" style="stroke:' + c + '" stroke-width="10" fill="none" stroke-linecap="round" opacity=".6"/><path d="M40 100C14 86-8 114-34 100S-62 88-74 96" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>',
    fumee: '<g class="vt-gaz" fill="#C4CAD2" stroke="#8A939E" stroke-width=".8">' + [[22, 112, 9, .75], [2, 106, 12, .6], [-24, 112, 14, .45], [-52, 102, 13, .32], [-74, 110, 10, .2]].map(([x, y, r, o]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" opacity="' + o + '"/>').join("") + "</g>",
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
    '<text x="33" y="38.5" text-anchor="middle" style="font:italic 800 6.5px var(--f-display);letter-spacing:.12em;fill:' + (LIVREES_CLAIRES.includes(lv) ? "#11151B" : "#fff") + '" opacity=".9">VERSUS</text>' +
    // fond plat et diffuseur
    '<path d="M28 122L420 122 422 129 70 132 30 128Z" fill="url(#' + u + 'cb)"/>' +
    // caisse et ponton
    '<path d="' + CORPS + '" style="' + peinture + '"/><path d="' + PONTON + '" style="' + peinture + '"/>' +
    '<g clip-path="url(#' + u + 'cl)">' +
      (neon ? '<path d="M120 112H308M150 100H290" style="stroke:' + c + ';filter:drop-shadow(0 0 3px ' + c + ')" stroke-width="1.6"/>' : "") +
      '<rect x="0" y="113" width="480" height="20" fill="url(#' + u + 'cb)" opacity=".92"/>' +
      '<path d="M0 113H480" stroke="' + filet + '" stroke-width="1.6" opacity=".9"/>' +
      '<rect x="0" y="40" width="480" height="92" fill="url(#' + u + 'sh)"/>' +
      (lv === "chocolat" ? habillageChocolat() : lv === "carte" ? habillageCarte() : lv === "ver" ? habillageVer() : habillageDepart(lv, u, hexTeinte(o.nom, "livree", e))) +
      (e.finition === "mat" ? '<rect x="0" y="40" width="480" height="92" fill="#2A2E35" opacity=".22"/>' : "") +   // v20.68 · finition Mat : la caisse adoucie
      (["oranime", "chrome", "or", "platine", "rubis", "orrose", "chocolat"].includes(lv) || e.finition === "brillant" ? '<rect class="vt-brille" x="-90" y="40" width="70" height="92" fill="url(#' + u + 'br)" transform="skewX(-20)" opacity="' + (lv === "oranime" ? ".9" : e.finition === "brillant" ? ".6" : ".35") + '"/>' : "") +
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
    '<text x="250" y="117" text-anchor="middle" style="font:italic 800 21px var(--f-display);fill:' + (LIVREES_CLAIRES.includes(lv) ? "#11151B" : "#fff") + ';stroke:rgba(0,0,0,.35);stroke-width:.6;paint-order:stroke">' + e.numero + "</text>" +
    '<text x="160" y="108" text-anchor="middle" style="font:italic 800 8px var(--f-display);letter-spacing:.2em;fill:' + (LIVREES_CLAIRES.includes(lv) ? "#11151B" : "#fff") + '" opacity=".75">VERSUS</text>' +
    // pilote, rebord du cockpit, halo
    '<g transform="translate(236 75) scale(1.08)">' + casqueForme(u + "c", e.casque, c, e.finition, false, teintesHex(o.nom, e)) + "</g>" +
    '<path d="M214 87C230 83 250 83 264 87" stroke="#0b0d11" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M212 74C224 57 252 56 268 86" fill="none" stroke="url(#' + u + 'ti)" stroke-width="4.6" stroke-linecap="round"/>' +
    (e.trainee === "sabre" ? '<g class="vt-sabre"><path d="M178 44L14 34" stroke="#FF2A3A" stroke-width="13" stroke-linecap="round" opacity=".25" style="filter:blur(3px)"/><path d="M178 44L16 34" stroke="#FF3A48" stroke-width="4.6" stroke-linecap="round"/><path d="M178 44L18 34.2" stroke="#FFF1F1" stroke-width="1.7" stroke-linecap="round"/>' +
      '<g transform="rotate(3.5 190 45)"><rect x="176" y="41" width="22" height="8" rx="2" fill="#2B2F36" stroke="#AEB7C2" stroke-width="1"/><path d="M181 41v8M186 41v8M191 41v8" stroke="#AEB7C2" stroke-width=".9"/><rect x="196" y="42.5" width="3" height="5" fill="#C8321E"/></g></g>' : "") +
    (e.finition === "feuilledor" ? '<g class="vt-feuilles">' + [[120, 104, 20], [150, 90, 70], [176, 100, 130], [214, 96, 200], [256, 104, 250], [300, 100, 300], [340, 108, 40], [380, 110, 160], [96, 108, 110], [60, 46, 80]].map(([x, y, a]) =>
      '<path d="M' + (x - 3) + " " + y + "L" + (x - .4) + " " + (y - 2.6) + "L" + (x + 3) + " " + (y - .8) + "L" + (x + 1.2) + " " + (y + 2.4) + 'Z" fill="#F7CF55" stroke="#FFF6CC" stroke-width=".5" transform="rotate(' + a + " " + x + " " + y + ')"/>').join("") + "</g>" : "") +
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
  const now = new Date(), noel = false;   // v17.14 (Théo) : la page d'attente reste comme avant le 20/11 (rien sur ce qui arrive)
  const qui = D.personnes.some(p => p.nom === ETAT.moi) ? ETAT.moi : (D.personnes[0] || {}).nom;
  const e = Object.assign({}, BASE_ECURIE, { numero: numeroParDefaut(qui) });
  return '<section class="teaser">' + svgVoiture({ nom: qui, e, drapeau: compteRebours(now), roule: true, reflet: true, label: "Tour de chauffe le samedi 21 novembre à 9 h, saison 1 le 1er janvier 2027" }) +
    '<div class="t-txt"><div class="t-saison">Saison 1</div><div class="t-date">🔥 Tour de chauffe le samedi 21 novembre à 9 h · 🏁 départ le 1<sup>er</sup> janvier 2027</div>' +
    '<p class="t-phrase">Tout le monde sur la ligne de départ.<br>Même point de départ, mêmes chances.</p>' +
    (noel ? '<div class="t-concept">' +
      '<div><b>🔥 Tour de chauffe</b><span>Décembre pour découvrir les règles, sans que rien ne compte. Vos cartes de janvier se posent pendant les fêtes.</span></div>' +
      '<div><b>🏁 Championnat</b><span>Chaque mois : ' + baremeAffiche().join(", ") + ' points, et +1 🎯 si tu bats le ' + esc(D.marche.indices[iRef()]) + '.</span></div>' +
      '<div><b>🏎️ Grand Prix</b><span>Un circuit à thème par mois : 12 univers gardés secrets jusqu\'à fin décembre. Vos voitures en 3D, 25 points le tour.</span></div>' +
      '<div><b>🃏 Cartes de course</b><span>4 cartes de stratégie, les mêmes pour tous. Une par mois, face cachée.</span></div>' +
      (estAdmin() ? '<div><b>🎁 Nouveautés en cours de saison</b><span>' + etapesJeu().map(e => e.ico + " " + esc(e.nom) + " (" + esc(moisEtape(e).replace(/ \d{4}$/, "")) + ")").join(" · ") + ". Chaque règle est expliquée le 20 du mois d'avant, quand sa fenêtre s'ouvre.</span></div>" : '<div><b>🎁 Et plus tard…</b><span>D\'autres surprises arrivent en décembre.</span></div>') +   // v17.8 : liste cachée aux joueurs
      '<div><b>🙂 Ta tête au volant</b><span>Ton portrait animé, à côté de ton nom.</span></div></div>' +
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
  const tres = '<button type="button" class="ba-dec" data-batres="1"' + (TRESOR_APERCU ? ' aria-pressed="true">🗝️ Aperçu du trésor en cours · ✕ Quitter' : ">🗝️ Aperçu du trésor · sur la page Course, en 📺 Visite, avec un exemple inventé (rien n’est envoyé)") + "</button>";   // v17.26 ; v17.35 : directement sur la page Course
  const fete = '<button type="button" class="ba-dec" data-bafete="1">🎅 Aperçu · le vainqueur de la chauffe (la mini-cérémonie que tout le monde verra une fois, 48 h après le dernier relevé de décembre ; exemple inventé tant que la manche n’est pas finie)</button>';   // v17.49
  const coupe = '<button type="button" class="ba-dec" data-bacoupe="1">🏆 Aperçu · La Coupe brisée (exemple inventé : le vrai contenu reste secret, même pour toi)</button>';   // v20.42
  const avent = '<button type="button" class="ba-dec" data-baavent="1">🎄 Aperçu · le calendrier de l’Avent (toutes les cases s’ouvrent, jeux compris ; rien n’est gardé ni envoyé)</button>';   // v20.61
  const ticket = '<button type="button" class="ba-dec" data-baticket="1">🎫 Aperçu · le ticket d’or (une tablette d’exemple : chocolat, puis ticket et cérémonie ; rien n’est envoyé, le vrai tirage reste secret, même pour toi)</button>';   // v20.47
  const acc = '<button type="button" class="ba-dec" data-baacc="1">🎭 Aperçu · les accessoires du mois (les 12 univers et le bonnet de Noël, sur vos têtes)</button>';   // v20.59
  return '<div class="barre-admin"><div class="ba-h"><b>🛠️ Admin</b><div class="ba-seg">' + b("tout", "Tout afficher") + b("joueur", "Vue joueur") + b("reel", "Le réel") + "</div></div>" + plus + dec + fete + avent + circ + tres + coupe + ticket + acc + '<button type="button" class="ba-dec" data-bamj="1">🎲 Aperçu · les mini-jeux du mois (joués sur un faux tirage et des pilotes inventés : rien n’est enregistré, le vrai tirage reste secret, même pour toi)</button>' + "<small>" + desc + "</small></div>";
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
  v.querySelectorAll("[data-bafete]").forEach(x => x.addEventListener("click", () => apercuFeteChauffe()));
  v.querySelectorAll("[data-batres]").forEach(x => x.addEventListener("click", () => ouvrirApercuTresor()));
  v.querySelectorAll("[data-bacoupe]").forEach(x => x.addEventListener("click", () => apercuCoupe()));
  v.querySelectorAll("[data-baticket]").forEach(x => x.addEventListener("click", () => apercuTicket()));
  v.querySelectorAll("[data-baavent]").forEach(x => x.addEventListener("click", () => { if (typeof apercuAvent === "function") apercuAvent(); }));
  v.querySelectorAll("[data-bamj]").forEach(x => x.addEventListener("click", () => apercuMJ(202701)));   // 🎲 mini-jeux (js/9-minijeux.js)
  if (v.querySelector("[data-bamj]") && typeof prechargerApercuMJAdmin === "function") prechargerApercuMJAdmin();   // vitesse (26/11) : l'aperçu de janvier est prêt avant d'être ouvert
  v.querySelectorAll("[data-baacc]").forEach(x => x.addEventListener("click", () => apercuAccessoires()));
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
    (ch ? '<div class="chauffe-b">🔥 <span><b>Tour de chauffe</b> : les règles de base, et rien ne compte. Le championnat démarre le 1<sup>er</sup> janvier. <a href="#" class="lien-regles" data-regles="essentiel">En savoir plus</a></span></div>' : "") +
    (standSeul(y) ? '<div class="chauffe-b">🏁 <span><b>Saison 1</b> : le championnat démarre le 1<sup>er</sup> janvier. D\'ici le 1<sup>er</sup> janvier, dans le Stand : pose ta carte, fais ton pronostic (avec ta pole) et choisis ton rival.</span></div>' : "") +
    '<div class="pod-tabs" role="group" aria-label="Saison">' + (standSeul(y) ? "" : b("gp", "<span>" + icoOu("course", "🏁") + "</span>Course")) + b("stand", "<span>" + icoOu("stand", "🃏") + "</span>Stand" + compteCartesTab(y) + (rappelCartes() ? '<i class="pastille" aria-label="à faire"></i>' : "")) + (ecurieOuverte() ? b("ecurie", "<span>" + icoOu("ecurie", "🏎️") + "</span>Écurie" + (o !== "ecurie" && nouveauxEcurie(quiEcurie()).length ? '<i class="pastille ecu-nb" aria-label="' + nouveauxEcurie(quiEcurie()).length + ' nouvel objet">' + nouveauxEcurie(quiEcurie()).length + "</i>" : "")) : "") + (basesSeules() ? "" : b("defis", "<span>" + icoOu("trophees", "🏆") + "</span>Trophées")) + "</div>" +
    '<div class="s-corps">' + (o === "ecurie" ? htmlEcurie() : o === "defis" ? htmlVitrines() : o === "stand" ? htmlStand(y) : htmlGrandPrix(y)) + "</div>" +
    (false && adminActif() && !window.APERCUS_FINIS ? '<button class="reserve-b" type="button" id="reserve-ouvrir">🧪 <span><b>Règles et idées en réserve</b><small>admin · ce qui est en jeu, ce qui dort, les réglages</small></span> ›</button>' : "") + "</section>";
}
/** Onglet du Podium : l'ancien « Championnat » est maintenant dans le Grand Prix */
function ongletPodium() {   // v20.44 (règle de Théo) : pendant la chauffe et le Stand de fin décembre, PAS d'onglet Trophées pour les joueurs (révélations du 20/12 et du 1/1) ; l'admin voit tout en « Tout afficher »
  if (standSeul(saisonCourante())) return ETAT.podium === "ecurie" && ecurieOuverte() ? "ecurie" : "stand"; return (basesSeules() ? (ecurieOuverte() ? ["gp", "stand", "ecurie"] : ["gp", "stand"]) : ["gp", "stand", "ecurie", "defis"]).includes(ETAT.podium) ? ETAT.podium : "gp";   // v20.61 : l'Écurie dès le 1/12
}
/** Détail des points (l'ancien onglet Championnat), replié sous la course */
function htmlDetailPoints(y) {
  const c = championnat(y); if (!c.mois.length) return "";
  const noms = c.classement;
  const tab = '<div class="scroll-x"><table class="tab ch-t"><thead><tr><th>Mois</th>' + noms.map(n => '<th><i style="background:' + couleur(n) + '"></i>' + esc(n) + "</th>").join("") + "</tr></thead><tbody>" +
    c.mois.slice().reverse().map(m => "<tr><td>" + GPS[circuitDe(m.k)].drap + " " + esc(moisCourt(m.k)) + (m.spec ? " " + m.spec.ico : "") + "</td>" + noms.map(n => { const x = m.l.find(z => z.nom === n); return x ? '<td class="' + (x.rg === 1 ? "r1" : "") + '">' + x.p + (x.bonus ? "<sup>🎯</sup>" : "") + "</td>" : '<td class="muted">·</td>'; }).join("") + "</tr>").join("") +
    "</tbody></table></div>";
  const bilan = noms.map(n => { const t = c.tot[n]; return '<li><b class="pts-nom" data-gp-fiche="' + esc(n) + '" role="button" tabindex="0" aria-label="Fiche de ' + esc(n) + '">' + esc(n) + ' <i class="gp-vers-fiche" aria-hidden="true">›</i></b> : ' + t.pts + " pts · " + t.v + " victoire" + (t.v > 1 ? "s" : "") + " · " + t.pod + " podium" + (t.pod > 1 ? "s" : "") + " · " + t.bonus + " 🎯</li>"; }).join("");
  return (c.complete ? '<div class="bref">🏆 <b>' + (c.chauffe ? premiersChauffe(c).map(esc).join("</b> & <b>") : esc(c.classement[0])) + "</b> " + (c.chauffe ? (premiersChauffe(c).length > 1 ? "remportent ex æquo le tour de chauffe." : "remporte le tour de chauffe.") : "est champion de la saison " + numeroSaison(y) + ".") + "</div>" : "") +
    (c.mois.length ? '<div class="pts-courbe">' + boiteGraphe("g-champ", noms.map(n => ({ nom: n, c: couleur(n) }))) + "</div>" : "") +   // v17.66 (Théo) : la courbe du championnat reste toujours visible
    '<details class="pts-det" id="pts-det"' + (ETAT.ptsOuvert === "1" ? " open" : "") + '><summary>📊 Détail des points <small>bilan, mois par mois, barème</small></summary>' +
    '<ul class="pts-bilan">' + bilan + "</ul>" + tab +
    '<p class="info">Chaque mois : ' + baremeAffiche().join(" · ") + ' points, <b>+1</b> 🎯 si ton mois bat le ' + esc(D.marche.indices[iRef()]) + ", plus les cartes" + (regleVisible("duels") ? " et les duels" : "") + ". Ex æquo : même place, mêmes points. À égalité au total : le plus de victoires, puis la meilleure performance.</p></details>";
}
function dessinerChampionnat(y) {
  const box = $("#g-champ"); if (!box) return;
  const c = championnat(y), ks = [c.deb].concat(c.mois.map(m => m.k));
  tracer(box, { x: ks, series: c.classement.map(n => ({ nom: n, v: [0].concat(c.mois.map(m => m.cumul[n] !== undefined ? m.cumul[n] : null)), c: couleur(n), w: n === c.classement[0] && c.mois.length ? 3.6 : n === ETAT.moi ? 2.8 : 2, lead: n === c.classement[0] && c.mois.length > 0, fx: equipDe(n).trainee })),
    finEtiq: true, h: 190, fmt: x => x + " pts", fmtAxe: t => Number.isInteger(t) ? String(t) : "", titreX: k => k === c.deb ? "Départ" : "Fin " + moisCourt(k), noteX: k => noteTete(c, k), rangX: (k, n) => rangMois(c, k, n) });
}
/* v20.23 (idée de Théo du 20/11, avis de l'agent jeu-avocat-du-diable) · la courbe raconte : le mois où le leader change, la bulle le dit.
   Leader = 1re place officielle du mois (même départage que le Classement : points, victoires, performance cumulée) ; le dernier mois d'une
   saison complète suit le classement final (bonus de fin de saison compris). Rien les autres mois. */
/** place officielle d'un pilote à la fin du mois k (dernier mois d'une saison complète : classement final, bonus compris) ; sert à ranger les ex æquo dans la bulle */
function rangMois(c, k, n) {
  const i = c.mois.findIndex(m => m.k === k); if (i < 0) return 99;
  if (i === c.mois.length - 1 && c.complete && !c.chauffe) { const r = c.classement.indexOf(n); return r < 0 ? 99 : r + 1; }
  return c.mois[i].places[n] || 99;
}
function noteTete(c, k) {
  const i = c.mois.findIndex(m => m.k === k); if (i < 0) return "";
  if (c.chauffe) { const p = premiersChauffe(c); if (i !== 0 || !p.length) return "";   // tour de chauffe : pas de départage (relecture jeu-arbitre)
    return "🥇 " + p.join(" & ") + (p.length > 1 ? " prennent la tête ex æquo" : " prend la tête"); }
  const tete = j => { if (j < 0) return null; const m = c.mois[j]; if (j === c.mois.length - 1 && c.complete) return c.classement[0];
    return Object.keys(m.places).find(n => m.places[n] === 1) || null; };
  const t = tete(i), avant = tete(i - 1); if (!t || t === avant) return "";
  const m = c.mois[i], egal = Object.keys(m.cumul).filter(n => n !== t && m.cumul[n] === m.cumul[t]).length > 0;
  return "🥇 " + t + (i === 0 ? " prend la tête" : " passe en tête") + (egal ? " (à égalité de points, au départage)" : "");
}
function quiEcurie() { return moiVrai(); }
/* V16.24 · « Mon portrait » : la tête de chacun se règle hors de l'Écurie (Réglages, ou toucher sa tête dans le Classement), dès le tour de chauffe */
/** V16.56 · « Mon portrait » s'ouvre à tous le samedi 21 novembre 2026 à 11 h (heure de Paris) ; l'admin le voit avant */
const PORTRAIT_OUVRE = Date.UTC(2026, 10, 21, 8, 0);   // samedi 21/11 9 h (Paris ; Théo 21/11), comme le tour de chauffe
function portraitDispo() { return (adminActif() && !vueJoueur()) || Date.now() >= PORTRAIT_OUVRE; }   // v16.71 : avant le 21/11, seulement en mode admin actif (avant : visible avec la clé admin même en mode non admin)
function ouvrirPortrait() {
  if (!portraitDispo()) { toast("👤 Mon portrait arrive samedi 21 novembre à 9 h."); return; }
  const qui = quiEcurie(); if (!qui || !D) { toast("Choisis d'abord qui tu es dans les Réglages."); return; }
  const rg = document.getElementById("reglages"); if (rg && !rg.hidden) rg.hidden = true;
  ECU = { nom: qui, e: equipDe(qui) };
  const o = document.createElement("div"); o.className = "regles portrait"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Mon portrait");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>👤 Mon portrait</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div><div class="rg-corps">' +
    '<div class="showroom pt-apercu"><div class="sr-id">' + avatar(qui, Object.assign({}, ECU.e, { vignette: true })) + "<b>" + esc(qui) + '</b></div></div>' + htmlPilote(qui, ECU.e) +
    '<div class="btn-row"><button class="btn acc" type="button" id="pt-garder">Enregistrer</button></div><p class="info">Ton portrait s\'affiche dans le Classement, la Course et partout ailleurs. Tout le monde le voit. Pour le changer plus tard : ⚙️ Réglages › Mon portrait.</p></div></div>';
  document.body.appendChild(o);
  const fermer = () => { o.remove(); ECU = null; };
  o.addEventListener("click", ev => { if (ev.target === o) fermer(); }); o.querySelector(".rg-x").addEventListener("click", fermer);
  o.querySelector("#pt-garder").addEventListener("click", () => { o.remove(); garderEcurie(); try { rendreVue(vueActive()); } catch (e) { }
    try { if (!stock.get("versus.portraitOu")) { stock.set("versus.portraitOu", "1"); setTimeout(() => toast("👤 Portrait enregistré ! Pour le changer plus tard : ⚙️ Réglages › Mon portrait, ou touche ta tête dans le Classement."), 600); } } catch (e) { } });   // v19.9 (Théo) : dire une fois où il se trouve
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
    b.innerHTML = '<div class="bp-av">' + avatar(qui) + '</div><div class="bp-t"><b>👤 Fais ton portrait !</b><small>Choisis ta tête : elle s\'affichera partout à côté de ton nom. Tu pourras la changer quand tu veux dans ⚙️ Réglages › Mon portrait.</small></div><div class="bp-b"><button class="btn acc" type="button" data-bp="go">C\'est parti</button><button class="btn ghost" type="button" data-bp="non">Plus tard</button></div>';
    document.body.appendChild(b);
    b.querySelector('[data-bp="go"]').addEventListener("click", () => { b.remove(); ouvrirPortrait(); });
    b.querySelector('[data-bp="non"]').addEventListener("click", () => { b.remove(); toast("Ton portrait t'attend dans Réglages, ou touche ta tête dans le Classement."); });
  } catch (e) { }
}
let ECU_SLOT = "pilote";
/* v20.68 · klaxons de départ (neutres), dessinés par nous : Pouet (trompe à poire), Trompette, Sifflet */
const KLAXONS_DESSINES = (() => {
  const svg = (x, nom) => '<svg class="kl-svg" viewBox="0 0 32 32" width="1.25em" height="1.25em" role="img" aria-label="' + nom + '">' + x + "</svg>";
  const laiton = (k) => '<defs><linearGradient id="kl' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1B0"/><stop offset=".45" stop-color="#E8B640"/><stop offset="1" stop-color="#8A5A0C"/></linearGradient></defs>';
  return {
    pouet: svg(laiton("p") + '<path d="M12.6 14.6H19L29.2 8.6V23.4L19 17.4H12.6Z" fill="url(#klp)" stroke="#6B430C" stroke-width=".9" stroke-linejoin="round"/><ellipse cx="29" cy="16" rx="1.3" ry="7.2" fill="#6B430C" opacity=".55"/>' +
      '<ellipse cx="7.4" cy="16" rx="6.2" ry="7" fill="#D62839" stroke="#6E0D12" stroke-width=".9"/><ellipse cx="5.6" cy="12.8" rx="2" ry="1.3" fill="#fff" opacity=".55"/><rect x="12" y="13.8" width="2.4" height="4.4" rx=".6" fill="#2A2E35"/>', "Pouet"),
    trompette: svg(laiton("t") + '<path d="M4 14.4H20.4L29.4 8.4V23.6L20.4 17.6H4Z" fill="url(#klt)" stroke="#6B430C" stroke-width=".9" stroke-linejoin="round"/><ellipse cx="29.2" cy="16" rx="1.2" ry="7.4" fill="#6B430C" opacity=".55"/>' +
      '<path d="M6 17.6C6 22.4 18 22.4 18 17.6" fill="none" stroke="#C98E22" stroke-width="1.8"/>' + [9, 12, 15].map(x => '<rect x="' + (x - 1) + '" y="9" width="2" height="5.4" rx=".5" fill="#C98E22" stroke="#6B430C" stroke-width=".5"/><rect x="' + (x - 1.4) + '" y="8" width="2.8" height="1.4" rx=".6" fill="#FFF1B0" stroke="#6B430C" stroke-width=".4"/>').join("") +
      '<rect x="1.4" y="14.8" width="3" height="2.4" rx=".8" fill="#AEB7C2" stroke="#4B525C" stroke-width=".5"/>', "Trompette"),
    sifflet: svg('<defs><linearGradient id="kls" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9D1DA"/><stop offset="1" stop-color="#5E6874"/></linearGradient></defs>' +
      '<path d="M3 11.6H17.6C23 11.6 27.4 15.4 27.4 20.4S23.4 28.6 18.4 28.6 10.2 25.2 10.2 20.6V16.6H3Z" fill="url(#kls)" stroke="#3E4752" stroke-width=".9" stroke-linejoin="round"/>' +
      '<rect x="12.6" y="11.6" width="4.4" height="2.4" fill="#2A2E35"/><circle cx="18.6" cy="20.6" r="3.2" fill="#E5484D" stroke="#7A0E1C" stroke-width=".6"/><path d="M5 13.4H13" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
      '<circle cx="26.4" cy="8.4" r="3" fill="none" stroke="#3E4752" stroke-width="1.4"/><path d="M14 6.6C15.6 5 17.6 5 19 6.4M12.6 4.2C15.2 1.6 18.4 1.6 20.8 4" stroke="#4C9AFF" stroke-width="1.2" fill="none" stroke-linecap="round"/>', "Sifflet")
  };
})();
const ICONES_KLAXON = { confettis: "🎊", damier: "🏁", feu: "🎆", parade: "🎺", billets: "💸", fanfare: "📯", cibles: "🎯", fusees: "🚀", trophees: "🏆", ouvriers: "🍬", pouet: "📯", trompette: "🎺", sifflet: "📣" };
/** Rareté d'un objet (Trophées v2) : série, monde, succès (pour chacun), exclusif du 1er, Gant, Légende (un seul au monde) */
function rareteItem(slot, id) {
  if (estDepart(slot, id)) return { cls: "r-serie", lib: BASE_ECURIE[slot] === id ? "Série" : "Départ" };
  const o = origineItem(slot, id);
  if (o.legende) return { cls: "r-unique" + (o.ticket ? " r-excl" : ""), lib: "Légende" };
  if (o.recrue) return { cls: "r-argent", lib: "Souvenir" };
  if (o.chercheur) return o.exclusif ? { cls: "r-unique r-excl", lib: "Exclusif" } : { cls: "r-argent", lib: "Souvenir" };
  if (o.exclusif || o.mj) return { cls: "r-unique r-excl", lib: "Exclusif" };
  if (o.gant) return { cls: "r-legende", lib: "Gant" };
  if (o.succes) return { cls: "r-argent", lib: "Succès" };
  if (o.monde) return { cls: "r-argent", lib: "Monde" };
  return { cls: "r-serie", lib: "" };
}
function vignetteItem(slot, id, nom, e) {
  if (slot === "casque") return svgCasque(nom, { casque: id, finition: e.finition, teintes: e.teintes, vignette: true });   // v20.70 : avec les couleurs choisies 🎨
  if (slot === "finition") return svgCasque(nom, { casque: e.casque, finition: id, teintes: e.teintes, vignette: true });
  if (slot === "fond") return avatar(nom, Object.assign({}, e, { fond: id, vignette: true }));
  if (slot === "circuit") return vignetteAmbiance(id);
  if (slot === "livree") {   // v20.48 : la photo de LA voiture (celle de la course) avec cette livrée ; sans WebGL, le dessin 2D
    const ph = window.Piste && Piste.photo && typeof voitureEcurie === "function" ? Piste.photo(voitureEcurie(nom, Object.assign({}, e, { livree: id }))) : null;
    return ph ? '<img class="vg-3d" alt="" src="' + ph + '">' : svgVoiture({ nom, e: Object.assign({}, e, { livree: id, trainee: "" }) });
  }
  if (slot === "trainee") return '<svg class="vg-trainee" viewBox="0 0 200 80" aria-hidden="true"><path class="fx fx-' + id + '" d="M8 66C50 62 70 30 110 36S170 18 192 12" fill="none" style="stroke:' + couleur(nom) + '" stroke-linecap="round"/>' +
    '<path d="M8 66C50 62 70 30 110 36S170 18 192 12" fill="none" style="stroke:' + couleur(nom) + '" stroke-width="3.5" stroke-linecap="round"/><circle cx="192" cy="12" r="5" style="fill:' + couleur(nom) + '"/>' +
    (id === "flocons" ? '<g class="vg-flocons" stroke="#CFEFFF" stroke-width="1.6" stroke-linecap="round" style="filter:drop-shadow(0 0 1.5px #3A8FD0)">' + [[30, 52, 6], [62, 40, 4.5], [92, 54, 7], [124, 26, 5], [150, 44, 4], [172, 16, 5.5], [48, 70, 3.5]].map(([x, y, r]) =>
      '<g transform="translate(' + x + " " + y + ')">' + [0, 60, 120].map(a => '<path d="M0 ' + -r + "V" + r + '" transform="rotate(' + a + ')"/>').join("") + "</g>").join("") + "</g>" : "") + "</svg>";
  if (slot === "klaxon") return '<span class="it-emo">' + (KLAXONS_DESSINES[id] || ICONES_KLAXON[id]) + "</span>";
  return id === "aucune" ? '<span class="it-emo vide">—</span>' : '<span class="plaque grande' + classePlaque(id) + '">' + iconePlaque(id) + esc(ITEMS.plaque[id]) + "</span>";
}
let ECU_Q = null;   // objet dont on lit le « ? »
function htmlDetailItem(qui) {
  if (!ECU_Q) return '<p class="info" style="margin:0">Touche un objet pour l\'essayer, ou « ? » pour savoir d\'où il vient.</p>';
  const [slot, id] = ECU_Q.split("."); if (!ITEMS[slot] || !ITEMS[slot][id]) return "";
  const o = texteOrigineItem(qui, slot, id), ouvert = debloques(qui).has(ECU_Q), cache = !ouvert && objetCache(slot, id);
  return '<div class="itd-l">' + (ouvert ? "" : '<span class="itd-k">🔒 Comment l\'obtenir</span>') + "<b>" + esc(cache ? "???" : ITEMS[slot][id]) + " <small>" + esc(SLOTS.find(x => x[0] === slot)[1]) + "</small></b><span class=\"itd-t\">" + esc(o.t) + "</span><p>" + esc(o.p) + "</p>" +
    (o.prog !== undefined && !ouvert ? '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, o.prog)) * 100) + '%"></i></span>' + (o.pt ? "<small>" + esc(o.pt) + "</small>" : "") : "") + "</div>";
}
/** Objet encore mystérieux : celui d'un secret que personne n'a trouvé, ou du premier millionnaire */
function objetCache(slot, id) { const o = origineItem(slot, id); return !!o.million || (!!o.ticket && !gagnantsTicket().length); }   // v2 : les succès sont visibles, leurs objets aussi
/** Objets visibles dans l'écurie : tout sauf la réserve 2028 */
/** (la plaque Ticket d'or n'apparaît qu'à partir d'octobre 2027, ou chez son gagnant) */
function idsSlot(slot) { const dec = ecurieDepart(), a = dec ? debloques(moiPilote() || "") : null;   // v20.61 : en décembre, seulement les objets de départ (et ce qu'on a déjà)
  const moi = moiPilote() || "", ch = slot === "plaque" ? debloques(moi) : null;   // 🎁 Chercheur de Noël, 🔰 Recrue 2026 : seulement si gagnées
  return Object.keys(ITEMS[slot]).filter(id => (!dec || estDepart(slot, id) || a.has(slot + "." + id)) && (!ch || !(estGainChercheur(slot, id) || estGainRecrue(slot, id) || estGainDore(slot, id)) || ch.has(slot + "." + id)) && !objetReserve(slot, id) && (!estGainTicket(slot, id) || ticketVisible()) && (typeof mjObjetVisible !== "function" || mjObjetVisible(slot, id, moi))
    && !prisParAutre(slot, id, moi)); }
/** v20.70 (Théo, 25/11) · un objet EXCLUSIF (1er seulement, Légende) déjà pris par un autre pilote disparaît des objets bloqués : on ne pourra plus jamais l'avoir */
function prisParAutre(slot, id, moi) {
  try { const k = slot + "." + id; if (!moi || debloques(moi).has(k)) return false;
    const o = origineItem(slot, id), autres = D.personnes.map(p => p.nom).filter(n => n !== moi);
    if (!(o.exclusif || o.legende || o.mj)) return false;
    if (o.vote) return false;   // le Coup de la saison se rejoue à chaque fin de saison
    return autres.some(n => debloques(n).has(k)); } catch (e) { return false; }
}
/* ---------- v20.70 (Théo, 25/11) · ✨ objets gagnés mis en avant ----------
   Dans chaque emplacement : nouveaux gagnés pas encore vus (pastille « ✨ Nouveau ») → gagnés (Légendes et exclusifs d'abord) → départ → bloqués 🔒.
   « Vu » = l'emplacement a été ouvert dans l'écurie (mémoire de l'appareil, versus.ecuVus, par pilote ; en simulation, en mémoire seulement). */
function gagnesDe(nom) { return [...debloques(nom)].filter(k => { const [s, id] = k.split("."); return ITEMS[s] && ITEMS[s][id] && !estDepart(s, id); }); }
function vusEcurieTout() { try { const o = JSON.parse(stock.get("versus.ecuVus") || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
function marquerVus(nom, l) { if (!nom || !l.length || apercuSaison()) return; const o = vusEcurieTout(), v = new Set(Array.isArray(o[nom]) ? o[nom] : []); l.forEach(k => v.add(k)); o[nom] = [...v]; stock.set("versus.ecuVus", JSON.stringify(o)); }
/** objets gagnés pas encore vus (d'un emplacement, ou de toute l'écurie) */
function nouveauxEcurie(nom, slot) {
  try { if (!nom || !ecurieOuverte() || apercuSaison() || !D.personnes.some(p => p.nom === nom)) return [];
    const vus = new Set((vusEcurieTout()[nom]) || []), vis = {};
    return gagnesDe(nom).filter(k => { const [s, id] = k.split("."); if (vus.has(k) || (slot && s !== slot) || !SLOTS.some(z => z[0] === s)) return false; vis[s] = vis[s] || idsSlot(s); return vis[s].includes(id); }); } catch (e) { return []; }
}
let ECU_NOUV = null;   // { nom, slot, l } : les « ✨ Nouveau » de l'emplacement ouvert (restent affichés tant qu'on y reste)
function rangGagne(slot, id) { const o = origineItem(slot, id); return o.legende ? 0 : o.exclusif || o.mj ? 1 : o.gant ? 2 : 3; }
function ordreItems(qui, slot, ids) {
  const ouv = debloques(qui), nv = ECU_NOUV && ECU_NOUV.nom === qui && ECU_NOUV.slot === slot ? ECU_NOUV.l : [];
  const rang = id => { const k = slot + "." + id; if (!ouv.has(k)) return 90; if (nv.includes(k)) return rangGagne(slot, id) / 10; if (estDepart(slot, id)) return BASE_ECURIE[slot] === id ? 50 : 51; return 10 + rangGagne(slot, id); };
  return ids.map((id, i) => [id, rang(id), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
}
/* ---------- v20.70 · 🏎️ « Équiper maintenant » : depuis une cérémonie, l'écurie s'ouvre sur l'emplacement, l'objet déjà essayé (Enregistrer pour le garder) ---------- */
function btnEquiper(slot, id, cls) {
  try { const qui = quiEcurie(); if (!qui || !ecurieOuverte() || !ITEMS[slot] || !ITEMS[slot][id] || !D.personnes.some(p => p.nom === qui)) return ""; } catch (e) { return ""; }
  return '<button class="btn ' + (cls || "acc") + '" type="button" data-equiper="' + slot + "." + id + '">🏎️ Équiper maintenant</button>';
}
function equiperMaintenant(slot, id) {
  const qui = quiEcurie(); if (!qui || !ITEMS[slot] || !ITEMS[slot][id]) return;
  try { document.querySelectorAll(".av-ov").forEach(x => x.remove()); if (typeof AVENT_APERCU !== "undefined") AVENT_APERCU = false; } catch (e) { }
  ECU = { nom: qui, e: equipDe(qui) }; ECU.e[slot] = id; if (ECU.e.teintes) delete ECU.e.teintes[slot];
  ECU_SLOT = slot; ECU_Q = slot + "." + id; ECU_VOIR = null; ETAT.podium = "ecurie"; garder();
  try { if (vueActive() !== "trophees") allerA("trophees"); } catch (e) { }
  rendreTrophees();
  setTimeout(() => { const b = document.querySelector('.it[data-slot="' + slot + '"][data-item="' + id + '"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" }); }, 250);
  toast("🏎️ Essayé sur ta voiture : « Enregistrer mon écurie » pour le garder.");
}
/** branche le bouton d'une cérémonie : on ferme (avec ce que la cérémonie fait en fermant), puis on équipe */
function brancherEquiper(o, fermer) {
  o.querySelectorAll("[data-equiper]").forEach(b => { b.dataset.branche = "1"; b.addEventListener("click", ev => { ev.stopPropagation(); const [s, id] = b.dataset.equiper.split("."); try { if (fermer) fermer(); } catch (e) { } equiperMaintenant(s, id); }); });
}
// les autres boutons (vitrines : Gant, monde, succès) : ferment leur fenêtre s'il y en a une, puis équipent
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-equiper]"); if (!b || b.dataset.branche) return;
  const ov = b.closest(".revel, .av-case"); if (ov) ov.remove(); const [s, id] = b.dataset.equiper.split("."); equiperMaintenant(s, id); });
/* ---------- v20.70 · 🎲 « Au hasard » : une tenue complète tirée parmi les objets du pilote (aperçu seulement ; Enregistrer valide, « Ma tenue » revient en arrière) ---------- */
const SLOTS_HASARD = ["casque", "finition", "fond", "livree", "trainee", "klaxon"];
function tenueAuHasard(qui, e, alea) {
  const r = alea || Math.random, ouv = debloques(qui), n = Object.assign({}, e, { teintes: {} });
  SLOTS_HASARD.forEach(s => { const l = idsSlot(s).filter(id => ouv.has(s + "." + id)); if (l.length) n[s] = l[Math.floor(r() * l.length) % l.length];
    const t = teintesDe(s, n[s]); if (t) { const c = t[Math.floor(r() * t.length) % t.length]; if (s === "finition" && (c === "blanc" || c === "noir")) n.finition = "lis" + c; else if (c !== teinteDefaut(s, n[s])) n.teintes[s] = c; } });
  if (!Object.keys(n.teintes).length) delete n.teintes;
  return n;
}
/* ---------- v20.61 · 🏎️ « Ton écurie ouvre ses portes » : une seule fois, au premier passage à partir du 1er décembre 2026 ----------
   La porte du garage se lève sur la voiture du pilote ; un toucher ferme. Rien de 2027 : seulement ce qu'on peut faire en décembre. */
function teaserEcurie(essai) {
  try {
    if (SOURCE !== "api" || !ecurieOuverte() || saisonJouee() || stock.get("versus.ecurieTeaser") || document.querySelector(".ecu-rev")) return;
    if (typeof podiumCache === "function" && podiumCache()) return;
    const qui = quiEcurie(); if (!qui || !D || !D.personnes.some(p => p.nom === qui)) return;
    if (document.querySelector(".tuto, .regles, .ba, .revel, .voile:not([hidden]), .av-case, .av-ov")) { if ((essai || 0) < 8) setTimeout(() => teaserEcurie((essai || 0) + 1), 4000); return; }
    stock.set("versus.ecurieTeaser", "1");
    const e = Object.assign({}, equipDe(qui));
    const o = document.createElement("div"); o.className = "revel ecu-rev" + (reduit ? " reduit" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Ton écurie ouvre ses portes");
    o.innerHTML = '<div class="rv-c er-c"><span class="tuto-k">🔥 Tour de chauffe · décembre</span>' +
      '<div class="er-garage" aria-hidden="true"><span class="er-lum"></span><div class="er-voit">' + svgVoiture({ nom: qui, e, reflet: true, idle: true, label: "" }) + '</div><span class="er-porte"><i></i></span><span class="er-sol"></span></div>' +
      "<h3>🏎️ Ton écurie ouvre ses portes</h3><small class=\"er-ou\">(Podium › 🏎️ Écurie)</small>" +
      '<ul class="er-l"><li>🪖 Personnalise ton <b>casque</b>, ta <b>livrée</b>, ta <b>traînée</b> et ton <b>numéro</b>.</li><li>🏁 Ta voiture les porte en course, sous les yeux de tous.</li><li>🎁 Pour l\'instant, les objets de départ. <b>De nouveaux objets se gagneront tout au long de 2027.</b></li></ul>' +
      '<div class="btn-row"><button class="btn acc" type="button" data-er-go>Ouvrir mon écurie</button></div><small class="er-x">Touche n\'importe où pour fermer</small></div>';
    document.body.appendChild(o);
    const fermer = () => { o.remove(); };
    o.addEventListener("click", ev => { if (ev.target.closest("[data-er-go]")) { fermer(); ETAT.podium = "ecurie"; ECU_SLOT = "casque"; garder(); try { allerA("trophees"); rendreTrophees(); } catch (er) { } return; } fermer(); });
  } catch (e) { }
}
/* v20.80 (Théo, 26/11) · l'affichette « 🎨 Nouveau : choisis l'affichage des décors 3D » (réglage de piste.js, bloc QUALITÉ 3D ; Réglages › Affichage › Décors 3D).
   Une seule fois par appareil (versus.q3dAffichette), APRÈS les autres annonces d'ouverture et jamais par-dessus une autre fenêtre : elle attend que
   l'écran soit libre deux fois de suite (la suivante peut s'ouvrir juste après la fermeture de la précédente). Seulement tant qu'on est resté sur l'écran
   d'ouverture (sinon : à la prochaine ouverture de l'appli). Rien si le choix est déjà fait à la main ou sans 3D. */
function affichette3D(essai, libre) {
  try {
    essai = essai || 0;
    if (SOURCE !== "api" || stock.get("versus.q3dAffichette") || !window.Piste || !Piste.qualite || document.querySelector(".af3d")) return;
    if (Piste.qualite.choix() !== "auto") { stock.set("versus.q3dAffichette", "1"); return; }   // déjà choisi dans les Réglages : rien à annoncer
    if (typeof Piste.supporteVite === "function" && !Piste.supporteVite()) return;
    { const v = typeof vueActive === "function" ? vueActive() : ""; if (!essai) affichette3D.vue = v; else if (v !== affichette3D.vue) return; }   // déjà parti ailleurs dans l'appli : pas d'interruption, ce sera à la prochaine ouverture
    const occupe = () => (typeof ereEnCours === "function" && ereEnCours()) || [...document.querySelectorAll(".tuto, .revel, .regles, .ba, .bulle-portrait, .av-ov, .av-case, .voile:not([hidden]), [aria-modal=true]")].some(x => x.getClientRects().length) ||
      (() => { try { const a = typeof GP_INST !== "undefined" && GP_INST && GP_INST.api; if (a && ((a.enCours && a.enCours()) || (a.survolEnCours && a.survolEnCours()))) return true; } catch (e) { }   // une course ou un survol roule
        try { return typeof TRESOR_EL !== "undefined" && !!TRESOR_EL && !!TRESOR_EL.t && !!TRESOR_EL.t.actif && !TRESOR_EL.pris; } catch (e) { return false; } })();   // une chasse au trésor est en cours
    if (occupe()) { if (essai < 80) setTimeout(() => affichette3D(essai + 1), 3000); return; }   // une autre fenêtre : on attend sa fermeture (4 min au plus, sinon à la prochaine ouverture)
    if (!libre) { setTimeout(() => affichette3D(essai + 1, true), 2500); return; }   // libre : on revérifie 2,5 s plus tard (une annonce peut s'enchaîner)
    let niv = "complet", raison = ""; try { niv = Piste.qualite.niveau(); raison = Piste.qualite.raison() || ""; } catch (e) { /* inconnu : complet */ }
    stock.set("versus.q3dAffichette", "1");
    const o = document.createElement("div"); o.className = "tuto af3d"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Nouveau : choisis tes décors 3D");
    o.innerHTML = '<div class="tuto-c af3d-c"><span class="tuto-k">🎨 Nouveau</span><h3>Choisis tes décors 3D</h3>' +   // les mots des Réglages, dans le même ordre (Auto, Complet, Léger)
      '<ul class="af3d-l"><li><b>Auto</b> l\'appli choisit pour ton téléphone</li><li><b>Complet</b> tout le décor et les effets de lumière</li><li><b>Léger</b> décor allégé, plus fluide</li></ul>' +
      '<p class="af3d-auto">🤖 Pour ce téléphone, l\'auto a choisi : <b>' + (niv === "leger" ? "Léger" : "Complet") + "</b>" + (raison ? "<small>(" + esc(raison) + ")</small>" : "") + "</p>" +
      '<div class="btn-row"><button class="btn ghost" type="button" data-af3d="tard">Plus tard</button><button class="btn acc" type="button" data-af3d="go">Choisir maintenant</button></div></div>';
    document.body.appendChild(o);
    const fermer = () => o.remove();
    o.addEventListener("click", ev => { if (ev.target === o) fermer(); });
    o.querySelector('[data-af3d="tard"]').addEventListener("click", fermer);
    o.querySelector('[data-af3d="go"]').addEventListener("click", () => { fermer();
      try { const rg = document.getElementById("btn-reglages"); if (rg) rg.click(); else ouvrirReglages();
        const ch = document.querySelector("[data-q3d]"), bloc = ch && ch.closest(".champ"), sec = bloc && bloc.closest("section.regl");
        if (sec && sec.classList.contains("ferme") && typeof plierRegl === "function") plierRegl(sec, false);   // la rubrique Affichage repliée : on la déplie d'abord
        if (bloc) { bloc.scrollIntoView({ block: "center" }); bloc.classList.add("af3d-cible"); setTimeout(() => bloc.classList.remove("af3d-cible"), 2600); } } catch (e) { } });
  } catch (e) { /* jamais bloquant */ }
}
function totalObjets() { return SLOTS.reduce((a, [s]) => a + idsSlot(s).length, 0) - Object.keys(BASE_ECURIE).length; }
function htmlEcurie() {
  const qui = quiEcurie();
  if (!D.personnes.some(p => p.nom === qui)) return '<div class="vide">Choisis ton nom dans les réglages pour monter ton écurie.</div>';
  if (!ECU || ECU.nom !== qui) ECU = { nom: qui, e: equipDe(qui) };
  const ouverts = debloques(qui), e = ECU.e;
  const slot = ECU_SLOT === "numero" || ECU_SLOT === "pilote" || (ECU_SLOT === "badges" && !ecurieDepart()) || SLOTS.some(s => s[0] === ECU_SLOT) ? ECU_SLOT : "pilote";
  // v20.70 · ✨ les nouveaux de l'emplacement ouvert : montrés (en tête, pastille) puis notés comme vus ; ils gardent leur pastille tant qu'on reste sur l'emplacement
  if (!ECU_NOUV || ECU_NOUV.nom !== qui || ECU_NOUV.slot !== slot) { ECU_NOUV = { nom: qui, slot, l: SLOTS.some(z => z[0] === slot) ? nouveauxEcurie(qui, slot) : [] }; marquerVus(qui, ECU_NOUV.l); }
  const total = totalObjets(), nb = ouverts.size - Object.keys(BASE_ECURIE).length;
  const showroom = '<div class="showroom"><div class="sr-num" aria-hidden="true">' + e.numero + '</div>' +
    '<div class="sr-h"><span class="sr-k">Mon écurie · ' + (estChauffe(saisonCourante()) ? "Tour de chauffe" : "Saison " + numeroSaison(saisonCourante())) + '</span><span class="sr-id">' + avatar(qui, Object.assign({}, e, { vignette: true })) + "<b" + attrLivree(qui, e) + ">" + esc(qui) + "</b></span>" +
    '<span class="sr-p"><span class="sr-barre"><i style="width:' + (total ? nb / total * 100 : 0).toFixed(0) + '%"></i></span>' + nb + " / " + total + " objets</span></div>" +
    '<div class="sr-3d" id="sr-3d">' + svgVoiture({ nom: qui, e, reflet: true, idle: true }) + "</div>" +
    '<span class="sr-aide">' + (window.Piste && Piste.supporte() && !ecuVue2D() ? "↔ Tourne-la du doigt" : "") + '</span>' + btnVueEcu() + '<button class="sr-klaxon" type="button" id="ecu-klaxon">📯 Klaxonner</button></div>';   // v20.48 : la voiture de la course, en 3D (plus de bascule 2D / 360°)
  const onglets = '<div class="slot-tabs">' + [["pilote", "Pilote"]].concat(SLOTS, [["numero", "Numéro"]], ecurieDepart() ? [] : [["badges", "Badges"]]).map(([s, lib]) => '<button type="button" data-ecu-slot="' + s + '" aria-pressed="' + (s === slot) + '">' + lib +
    (s !== slot && SLOTS.some(z => z[0] === s) && nouveauxEcurie(qui, s).length ? '<i class="ecu-pt" aria-label="' + nouveauxEcurie(qui, s).length + ' nouveau(x)">' + nouveauxEcurie(qui, s).length + "</i>" : "") +
    "<small>" + (s === "badges" ? (Array.isArray(e.badges) ? e.badges.length + " / 3" : "auto") : s === "numero" ? "#" + e.numero : s === "pilote" ? (e.pilote === "casque" ? "Casque" : "Tête") : esc(ITEMS[s][e[s]])) + "</small></button>").join("") + "</div>";
  let corps;
  if (slot === "pilote") corps = htmlPilote(qui, e);
  else if (slot === "badges") corps = htmlChoixBadges(qui, e);
  else if (slot === "numero") corps = '<div class="num-bloc"><input id="ecu-num" class="champ-num" inputmode="numeric" maxlength="2" value="' + e.numero + '" aria-label="Numéro de course (1 à 99)"><p class="info">Ton numéro de course, de 1 à 99 : sur le ponton de ta voiture et dans la grille.</p></div>';
  else corps = '<div class="items">' + ordreItems(qui, slot, idsSlot(slot)).map(id => {
    const nouv = ECU_NOUV.l.includes(slot + "." + id), ouvert = ouverts.has(slot + "." + id), org = origineItem(slot, id), r = rareteItem(slot, id), cache = !ouvert && objetCache(slot, id), porte = e[slot] === id;
    const sous = ouvert ? r.lib : org.million ? "👑 Premier millionnaire" : org.champion ? "🌿 Premier champion" : org.monde ? icoMonde(org.monde) + " " + nomMonde(org.monde) : org.succes ? "🏅 " + org.succes.nom : org.gant ? "🧤 Gant de l'infini" : "";
    const ex = org.exclusif ? detenteur(org.exclusif.id) : null;
    const sous2 = !ouvert && org.exclusif ? (ex ? "🔒 À " + ex.nom : "🥇 1er · " + org.exclusif.nom) : sous;
    return '<div class="it-w' + (ECU_Q === slot + "." + id ? " q-on" : "") + (ouvert ? "" : " it-bloque") + '"><button type="button" class="it ' + r.cls + (porte ? " on" : "") + (ouvert ? "" : " verrou") + '" data-slot="' + slot + '" data-item="' + id + '">' +
      '<span class="it-v">' + (cache ? '<span class="it-emo">?</span>' : vignetteItem(slot, id, qui, e)) + (ouvert ? "" : '<span class="it-lock">' + (org.million ? "👑" : org.exclusif ? (ex ? org.exclusif.ico : "🥇") : "🔒") + "</span>") + (porte ? '<span class="it-on">Équipé</span>' : "") + "</span>" + (nouv ? '<span class="it-nv">✨ Nouveau</span>' : "") +
      '<span class="it-n">' + (cache ? "???" : esc(ITEMS[slot][id])) + '</span><span class="it-r">' + esc(sous2) + "</span></button>" +
      '<button type="button" class="it-q" data-itq="' + slot + "." + id + '" aria-label="D\'où vient ' + esc(cache ? "cet objet" : ITEMS[slot][id]) + ' ?">?</button></div>' +
      (porte ? htmlTeintes(qui, slot, e) : "");
  }).join("") + '</div><div class="it-d" id="it-d" aria-live="polite">' + htmlDetailItem(qui) + "</div>";
  const grille = D.personnes.map(p => { const eq = p.nom === qui ? e : equipDe(p.nom); return '<div class="gr-w' + (ECU_VOIR === p.nom ? " on" : "") + '"><button type="button" class="gr-l' + (ECU_VOIR === p.nom ? " on" : "") + '" data-voir="' + esc(p.nom) + '" aria-label="Voir l\'écurie de ' + esc(p.nom) + '">' + avatar(p.nom, eq) + "<b" + attrLivree(p.nom, eq) + ">" + esc(p.nom) + "</b>" + (eq.plaque !== "aucune" ? '<span class="plaque">' + esc(ITEMS.plaque[eq.plaque]) + "</span>" : "") + '<span class="num">#' + eq.numero + " ›</span></button>" +
    '<button type="button" class="gr-f" data-gp-fiche="' + esc(p.nom) + '" aria-label="Fiche de ' + esc(p.nom) + '"><span aria-hidden="true">📂</span><small>Fiche</small></button></div>'; }).join("");   // v20.71 (Théo) : la ligne = son écurie, 📂 = sa fiche
  const modifie = JSON.stringify(normTenue(e)) !== JSON.stringify(normTenue(equipDe(qui)));
  return showroom + '<div class="ecu-hasard"><button class="btn ghost" type="button" id="ecu-hasard">🎲 Au hasard</button>' + (modifie ? '<button class="btn ghost" type="button" id="ecu-retour">↩️ Ma tenue enregistrée</button>' : "") + "</div>" + onglets + corps +
    '<button class="btn acc plein" type="button" id="ecu-garder">Enregistrer mon écurie</button>' +
    '<p class="info">Ta voiture de course porte ta livrée, ton casque, ta finition, ton numéro et ta traînée. En course, on garde ton visage pour qu\'on te reconnaisse.' + (ecurieDepart() ? " En décembre, les objets de départ ; de nouveaux objets se gagneront tout au long de 2027." : "") + "</p>" +
    '<div><h3 class="s-h3">La grille <small>touche une écurie pour la voir, 📂 pour la fiche</small></h3></div><div class="grille-dep">' + grille + "</div>" + htmlGarage(qui);
}
/** v20.70 · 🎨 sous l'objet porté (s'il a un motif neutre) : 3 couleurs au choix */
function htmlTeintes(qui, slot, e) {
  const l = teintesDe(slot, e[slot]); if (!l) return "";
  const cur = slot === "finition" && !teinteDe(slot, e) ? teinteDefaut(slot, e[slot]) : teinteDe(slot, e) || teinteDefaut(slot, e[slot]);
  return '<div class="teintes" role="group" aria-label="Couleur de « ' + esc(ITEMS[slot][e[slot]]) + ' »"><span>🎨 Couleur</span>' + l.map(t => '<button type="button" data-teinte="' + t + '" aria-pressed="' + (t === cur) + '" title="' + esc(TEINTES[t][0]) + '">' +
    '<i style="background:' + (t === "pilote" ? couleur(qui) : TEINTES[t][1]) + '"></i>' + esc(TEINTES[t][0]) + "</button>").join("") + "</div>";
}
/** la tenue comparable (pour savoir si l'aperçu diffère de ce qui est enregistré) */
function normTenue(e) { const o = {}; SLOTS.forEach(([s]) => o[s] = ecrireTeinte(s, e[s], (e.teintes || {})[s])); return o; }
/** V16.3 · Écurie › Badges : jusqu'à 3 badges épinglés sur la ligne du Classement (ou choix automatique) */
function htmlChoixBadges(qui, e) {
  const tous = badgesPossedes(qui), auto = !Array.isArray(e.badges), vus = badgesAffiches(qui, e).map(b => b.id);
  if (!tous.length) return '<div class="bdg-choix"><p class="info">Pas encore de badge : découvre un secret (doré si tu es le premier, argenté ensuite), complète le Gant, prends un titre (🚩 🔥 🔍) ou deviens champion, puis choisis ici les 3 qui s\'affichent à côté de ton nom.</p></div>';
  return '<div class="bdg-choix"><p class="info">Touche un badge pour l\'épingler ou le retirer : <b>3 au plus</b> s\'affichent à côté de ton nom dans le Classement, les autres se résument en « +N ». ' +
    (auto ? "Pour l'instant, l'appli choisit tes 3 plus prestigieux." : "") + "</p>" +
    '<div class="bdg-grille">' + tous.map(b => { const on = vus.includes(b.id), rang = on ? vus.indexOf(b.id) + 1 : 0;
      return '<button type="button" class="bdg-c' + (on ? " on" : "") + (b.niv ? " n" + b.niv : "") + '" data-ecu-bdg="' + b.id + '" aria-pressed="' + on + '"><span class="ico">' + b.ico + "</span><span>" + esc(b.nom) + "</span>" + (on ? '<i class="rg">' + (auto ? "auto" : rang) + "</i>" : "") + "</button>"; }).join("") + "</div>" +
    '<div class="bdg-apercu"><small>Aperçu de ta ligne</small><b>' + esc(qui) + "</b>" + badgesLigne(qui, e) + "</div>" +
    (auto ? "" : '<button class="lien" type="button" id="ecu-bdg-auto">Laisser l\'appli choisir</button>') + "</div>";
}
let ECU_VOIR = null;
/** Garage d'un autre pilote : sa voiture et tout son équipement, en lecture seule */
function htmlGarage(qui) {
  const n = ECU_VOIR; if (!n || !D.personnes.some(p => p.nom === n)) return "";
  const eq = n === qui && ECU ? ECU.e : equipDe(n), ouverts = debloques(n);
  const total = totalObjets(), nb = ouverts.size - Object.keys(BASE_ECURIE).length;
  const ex = exclusifsDe(n);
  return '<div class="garage" id="garage"><div class="showroom">' + '<div class="sr-num" aria-hidden="true">' + eq.numero + '</div><div class="sr-h"><span class="sr-k">Écurie de ' + esc(n) + '</span><span class="sr-id">' + avatar(n, Object.assign({}, eq, { vignette: true })) + "<b" + attrLivree(n, eq) + ">" + esc(n) + "</b></span>" +
    '<span class="sr-p"><span class="sr-barre"><i style="width:' + (total ? nb / total * 100 : 0).toFixed(0) + '%"></i></span>' + nb + " / " + total + " objets</span></div>" + '<div class="sr-3d" id="gar-3d">' + svgVoiture({ nom: n, e: eq, reflet: true, idle: true }) + "</div>" +
    btnVueEcu() + '<button class="sr-klaxon" type="button" id="garage-klaxon">📯 Son klaxon</button></div>' +
    '<div class="gar-eq">' + SLOTS.map(([s, lib]) => '<span><small>' + lib + "</small>" + esc(ITEMS[s][eq[s]]) + "</span>").join("") + "</div>" +
    (ex.length ? '<div class="gar-ex">' + ex.sort((a, b) => b.palier - a.palier).map(x => '<span title="' + esc(x.nom) + '">' + x.ico + " " + esc(x.nom) + "</span>").join("") + "</div>" : "") +
    '<button class="btn acc gar-fiche" type="button" data-gp-fiche="' + esc(n) + '">📂 Fiche de ' + esc(n) + " <small>" + (saisonJouee() ? "vitrine, portefeuille, historique" : "portefeuille, historique mois par mois") + "</small> ›</button>" +   // v20.71
    '<button class="lien" type="button" id="garage-fermer">Fermer</button></div>';
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
/* 🗺️ Les 12 MONDES (Trophées v2, Théo 25/11) : un trophée par univers = le mini-jeu du mois (moteur : js/9-minijeux.js, construit à part).
   Tout le monde peut l'avoir ; le meilleur du mois a la feuille d'or (sans objet en plus). gain = objets d'écurie de l'univers (carte de référence du 25/11).
   Aucune règle de mini-jeu ici (dépôt public) : l'état de chaque monde ne se lit que par etatMondeMiniJeu(). */
const TROPHEES_MONDES = [
  { id: "m-silverstone", univers: "silverstone", mois: 1, gain: [["livree", "ver"], ["circuit", "desert"]] },
  { id: "m-djeddah", univers: "djeddah", mois: 2, gain: [["casque", "eclair"], ["trainee", "etincelles"], ["finition", "ailee"]] },
  { id: "m-melbourne", univers: "melbourne", mois: 3, gain: [["livree", "carte"], ["fond", "chat"]] },
  { id: "m-suzuka", univers: "suzuka", mois: 4, gain: [["casque", "anneau"], ["finition", "elfique"], ["klaxon", "feu"]] },
  { id: "m-miami", univers: "miami", mois: 5, gain: [["fond", "pandora"], ["finition", "biolum"]] },
  { id: "m-montreal", univers: "montreal", mois: 6, gain: [["casque", "rebelle"], ["trainee", "sabre"]] },
  { id: "m-bahrein", univers: "bahrein", mois: 7, gain: [["casque", "toque"], ["plaque", "ratatouille"], ["circuit", "monaco"]] },
  { id: "m-spa", univers: "spa", mois: 8, gain: [["fond", "ampoules"], ["livree", "neon"], ["circuit", "neon"]] },
  { id: "m-lasvegas", univers: "lasvegas", mois: 9, gain: [["casque", "hoplite"], ["plaque", "cheval"], ["plaque", "bouclier"]] },
  { id: "m-singapour", univers: "singapour", mois: 10, gain: [["livree", "chocolat"], ["klaxon", "ouvriers"]] },
  { id: "m-interlagos", univers: "interlagos", mois: 11, gain: [["casque", "eclaireur"], ["trainee", "cables"]] },
  { id: "m-monza", univers: "monza", mois: 12, gain: [["casque", "fracture"], ["trainee", "glitch"], ["fond", "portails"]] }
];
/** Nom court du monde (« Mer de dunes », « Petit Chef »…) et son drapeau */
function nomMonde(t) { const u = univers(t.univers); return u ? u.nom : t.univers; }
function icoMonde(t) { const u = univers(t.univers); return u ? u.drap : "🗺️"; }
/** ÉTAT D'UN MONDE, lu par UNE seule fonction d'adaptation : le pont vers le moteur des mini-jeux (js/9-minijeux.js, etatMiniJeu).
 *  etatMiniJeu(univers, nom) renvoie (ou null tant que rien n'est chargé) :
 *    { gagne: bool (l'OBJECTIF COMMUN est réussi : CE pilote a le trophée du monde et ses objets d'univers),
 *      pourTous: [noms] (les pilotes qui ont le trophée du monde : tout le groupe quand l'objectif commun est réussi),
 *      meilleur: { nom, txt } | null (le ou les meilleurs du mois : titre + objet exclusif doré ; jamais un montant),
 *      progression: { p, c, txt } | null (l'objectif commun : p sur c, texte court),
 *      etat: "a-venir" | "en-cours" | "fini", trophee: { ico, nom } | null, titre, objet: [emplacement, id] | null }
 *  Ici on ajoute aVenir (mini-jeu pas encore dévoilé) et meilleurs (la liste des noms). Rien n'est inventé : sans moteur, personne n'a rien. */
function etatMondeMiniJeu(univers, nom) {
  const vide = { aVenir: true, etat: "a-venir", gagne: false, pourTous: [], meilleur: null, meilleurs: [], progression: null, trophee: null, titre: null, objet: null };
  if (typeof etatMiniJeu !== "function") return vide;
  try {
    const e = etatMiniJeu(univers, nom); if (!e) return vide;
    const best = e.meilleur && e.meilleur.nom ? e.meilleur : null, etat = e.etat || "en-cours";
    return { aVenir: etat === "a-venir", etat, gagne: !!e.gagne, pourTous: Array.isArray(e.pourTous) ? e.pourTous.slice() : [], meilleur: best,
      meilleurs: best ? (Array.isArray(e.meilleurs) && e.meilleurs.length ? e.meilleurs.slice() : best.nom.split(" et ")) : [],
      progression: e.progression || null, trophee: e.trophee || null, titre: e.titre || null, objet: Array.isArray(e.objet) ? e.objet : null };
  } catch (er) { return vide; }
}
let MEMO_TM = { d: null, rev: null, v: null };
/** { id: { nom: { ok, p, c, txt, aVenir, meilleur, pourTous } } } pour tous les pilotes (lu par l'Écurie, la fiche et les cases).
 *  Le moteur des mini-jeux peut changer window.MINIJEUX_REV pour forcer un nouveau calcul. */
function etatTropheesMondes() {
  const rev = window.MINIJEUX_REV || 0;
  if (MEMO_TM.d === D && MEMO_TM.rev === rev && MEMO_TM.v) return MEMO_TM.v;
  const noms = D.personnes.map(p => p.nom), out = {};
  TROPHEES_MONDES.forEach(t => { out[t.id] = {}; noms.forEach(n => {
    const e = saisonJouee() ? etatMondeMiniJeu(t.univers, n) : etatMondeMiniJeu("", ""), pr = e.progression;
    out[t.id][n] = { ok: !!e.gagne, p: pr && pr.c ? pr.p : 0, c: pr && pr.c ? pr.c : 1, txt: pr ? pr.txt || "" : "", aVenir: e.aVenir || !saisonJouee(), etat: e.etat, meilleur: e.meilleur, meilleurs: e.meilleurs, pourTous: e.pourTous, trophee: e.trophee, titre: e.titre, objet: e.objet }; }); });
  MEMO_TM = { d: D, rev, v: out };
  return out;
}
let MEMO_GANT = { d: null, m: {} };
/** Le Gant de chaque pilote pour la saison y : { nom: { p: [mois où chaque pierre s'est allumée, 0 sinon], n } } */
function etatGant(y) {
  if (!y || !D) return {};
  const cle = y + (apercuSaison() ? "a" : "");
  if (MEMO_GANT.d !== D) MEMO_GANT = { d: D, m: {} };
  if (MEMO_GANT.m[cle]) return MEMO_GANT.m[cle];
  const c = championnat(y), out = {}, R = {};
  D.personnes.forEach(p => { out[p.nom] = { p: [0, 0, 0, 0, 0, 0], n: 0 }; R[p.nom] = { bat: 0, run: 0, dernier: false }; });
  let avant = null;
  if (!c.chauffe) c.mois.forEach(m => {
    const leads = avant ? Object.keys(avant).filter(n => avant[n] === 1) : [];   // leader(s) du championnat au départ du mois (la grille), ex æquo compris
    m.l.forEach(x => {
      const o = out[x.nom], r = R[x.nom]; if (!o) return;
      const allume = i => { if (!o.p[i]) { o.p[i] = m.k; o.n++; } };
      if (x.rg === 1) allume(0);
      if (m.iR !== null && x.r > m.iR) { r.bat++; if (r.bat >= 3) allume(1); }
      if (x.carte && x.carte.gain > 0) allume(2);
      if (x.carte && x.carte.id === "pari" && x.carte.gain > 0 && leads.includes(x.carte.cible)) allume(3);
      r.run = x.dernier ? 0 : r.run + 1; if (r.run >= 3) allume(4);
      if (x.rg === 1 && r.dernier) allume(5);
      if (x.dernier) r.dernier = true;
    });
    Object.keys(R).forEach(n => { if (!m.l.some(x => x.nom === n)) R[n].run = 0; });   // absent : la série repart de zéro (comme la règle de la série)
    avant = m.places;
  });
  MEMO_GANT.m[cle] = out;
  return out;
}
/* ⚔️ Les titres : 3 badges qu'on se vole, recalculés à chaque mois joué, aucun point (v20.45, Théo : rien qui ressemble au 👑 du Premier millionnaire).
   c = couleur du titre (jamais l'or du millionnaire) ; embleme() = son dessin à nous (fanion, flamme, loupe) */
const TITRES = [
  { id: "drapeau", ico: "🚩", c: "#E5484D", nom: "Le Drapeau de tête", court: "en tête du championnat", def: "Au pilote en tête du championnat de la saison." },
  { id: "flamme", ico: "🔥", c: "#FF7A1A", nom: "La Flamme", court: "la plus longue série sans finir dernier", def: "À la plus longue série en cours de mois sans finir dernier. À égalité, celui qui la tient la garde." },
  { id: "flair", ico: "🔍", c: "#2EC4B6", nom: "Le Flair", court: "meilleur chercheur de trésors", def: "Au meilleur chercheur de trésors de la saison : 3, 2 et 1 points aux trois plus rapides de chaque trésor (chrono lancé avec 🔍 Je lance ma recherche), comptés à la fin du mois du trésor. À égalité, celui qui la tient la garde." }
];
/** L'emblème d'un titre, dessiné par nous (même rendu sur tous les téléphones) */
function emblemeTitre(id) {
  const svg = b => '<svg class="titre-svg" viewBox="0 0 40 40" aria-hidden="true">' + b + "</svg>";
  if (id === "drapeau") return svg('<path d="M10 5V36" stroke="#9AA3AE" stroke-width="2.6" stroke-linecap="round"/><circle cx="10" cy="5" r="2.4" fill="#C9D0D8"/>' +
    '<path class="ti-flotte" d="M11.5 7C17 4.5 22 9.5 28 7S34 6 35 7V21C33 20 31 20 28 21S17 18.5 11.5 21Z" fill="#E5484D" stroke="#8E1B22" stroke-width="1"/>' +
    '<path d="M11.5 7C17 4.5 22 9.5 28 7S34 6 35 7V12C33 11 31 11 28 12S17 9.5 11.5 12Z" fill="#fff" opacity=".18"/><path d="M19 10.5L20.6 13.6 24 14 21.5 16.3 22.2 19.6 19 18 15.8 19.6 16.5 16.3 14 14 17.4 13.6Z" fill="#fff"/>');
  if (id === "flamme") return svg('<path class="ti-flamme" d="M20 36C11 36 7 30 8 23 9 17 14 14 14 8 18 11 19 15 18 19 21 17 23 12 22 5 30 10 33 19 32 25 31 31 27 36 20 36Z" fill="#FF5A1F" stroke="#9A2A06" stroke-width="1"/>' +
    '<path d="M20 35C15 35 13 31 14 27 15 24 18 22 18 19 21 21 22 24 21.5 27 23 26 24 24 24 22 27 25 27 29 26 31 25 34 22.5 35 20 35Z" fill="#FFC23D"/><path d="M20 34C18 34 17 32 17.6 30 18.2 28.6 19.6 27.8 20 26.6 21.6 28 22.6 30 22 32 21.6 33.4 20.8 34 20 34Z" fill="#FFF6D6"/>');
  return svg('<circle cx="17" cy="17" r="10" fill="#2EC4B6" fill-opacity=".18" stroke="#2EC4B6" stroke-width="3.4"/><path d="M11.5 13.5C12.5 10.5 15 9.5 17 9.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M24.5 24.5L34 34" stroke="#155E57" stroke-width="5.4" stroke-linecap="round"/><path d="M24.5 24.5L34 34" stroke="#2EC4B6" stroke-width="2.6" stroke-linecap="round"/>');
}
let MEMO_TITRES = { d: null, m: {} };
/** Qui détient chaque titre (saison y) : { drapeau|flamme|flair: { nom, depuis (mois), val, txt } | null } */
function etatTitres(y) {
  if (!y || !D) return {};
  const cle = y + (apercuSaison() ? "a" : "");
  if (MEMO_TITRES.d !== D) MEMO_TITRES = { d: D, m: {} };
  let base = MEMO_TITRES.m[cle];
  if (!base) {
    const c = championnat(y); let co = null, fl = null; const run = {};
    if (!c.chauffe) c.mois.forEach(m => {
      // le Drapeau de tête : 1re place du championnat après ce mois (classement final, bonus compris, pour le dernier mois d'une saison complète)
      const der = m === c.mois[c.mois.length - 1] && c.complete, leads = der ? [c.classement[0]] : Object.keys(m.places).filter(n => m.places[n] === 1);
      // v20.44 (arbitre) : à égalité parfaite, le détenteur garde le Drapeau ; sans détenteur parmi les ex æquo, personne ne la prend
      if (co && leads.includes(co.nom)) { /* il la garde */ } else co = leads.length === 1 ? { nom: leads[0], depuis: m.k } : null; if (co) co.val = m.cumul[co.nom];
      // la Flamme : série en cours de mois sans finir dernier (absent = série remise à zéro)
      D.personnes.forEach(p => { const x = m.l.find(z => z.nom === p.nom); run[p.nom] = x ? (x.dernier ? 0 : (run[p.nom] || 0) + 1) : 0; });
      const mx = Math.max(0, ...Object.values(run));
      if (!mx) { fl = null; return; }
      const cands = Object.keys(run).filter(n => run[n] === mx);
      if (fl && cands.includes(fl.nom)) { fl.val = mx; return; }   // à égalité, le détenteur la garde
      const tri = cands.sort((a, b) => (m.places[a] || 99) - (m.places[b] || 99));   // séries égales (commencées le même mois) : le mieux classé
      fl = tri.length > 1 && (m.places[tri[0]] || 99) === (m.places[tri[1]] || 99) ? null : { nom: tri[0], depuis: m.k, val: mx };   // v20.44 : égalité parfaite, personne
    });
    base = MEMO_TITRES.m[cle] = {
      drapeau: co ? Object.assign(co, { txt: co.val + " points" }) : null,
      flamme: fl ? Object.assign(fl, { txt: fl.val + " mois sans finir dernier" }) : null
    };
  }
  return Object.assign({}, base, { flair: flairSaison(y) });
}
/** Le Flair : 3 / 2 / 1 points aux trois premiers du classement de chaque trésor de la saison (TRESORS.l[].chercheurs ; v20.74 : classés par temps par le serveur V92) ; null sans trésors chargés */
function flairSaison(y) {
  const T = typeof TRESORS !== "undefined" && TRESORS && TRESORS.l; if (!T || !T.length) return null;
  const dansMois = t => !t.chrono || !t.saison || !t.mois ? t.chercheurs : t.chercheurs.filter(x => !x.j || Math.floor(x.j / 100) <= t.saison * 100 + t.mois);   // v20.74 : trouvé après le mois = pas de points
  const tr = T.filter(t => CAL_GP.includes(t.circuit) && (!t.saison || t.saison === y) && (t.chercheurs || []).length && (!t.chrono || t.final)).map(t => ({ k: y * 100 + CAL_GP.indexOf(t.circuit) + 1, ch: dansMois(t) })).sort((a, b) => a.k - b.k);   // v20.74 : un trésor chronométré compte le 1er du mois suivant (classement définitif, par temps)
  const pts = {}; let f = null;
  tr.forEach(t => {
    t.ch.slice(0, 3).forEach((x, i) => { pts[x.nom] = (pts[x.nom] || 0) + [3, 2, 1][i]; });
    const mx = Math.max(...Object.values(pts)), cands = Object.keys(pts).filter(n => pts[n] === mx);
    if (f && cands.includes(f.nom)) { f.val = mx; return; }   // à égalité, il reste au détenteur
    const rang = n => { const i = t.ch.findIndex(x => x.nom === n); return i < 0 ? 99 : i; };
    f = { nom: cands.sort((a, b) => rang(a) - rang(b))[0], depuis: t.k, val: mx };
  });
  return f ? Object.assign(f, { txt: f.val + " points de chercheur" }) : null;
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
/* Petits dessins des objets à gagner, pour les cases des Trophées (dessins du directeur artistique, v2) : svgObjet(slot, id, taille) */
let OBJ_UID = 0;
const OBJ_TEINTES = {
  or: ["#FFF1B0", "#E8B640", "#8A5A0C"], argent: ["#FFFFFF", "#C9D1DA", "#5E6874"], chrome: ["#FFFFFF", "#AEB8C4", "#3E4752"],
  neon: ["#C8FFF9", "#2EF2E0", "#0B6F8A"], carbone: ["#6A707A", "#2A2E35", "#0D0F12"], damier: ["#FFFFFF", "#9AA3AE", "#111418"],
  eclair: ["#FFF6A8", "#FFD23D", "#A66A00"], etoile: ["#E2D6FF", "#8C6BFF", "#2B1A6E"], eclaireur: ["#FFE3BF", "#FF8A2B", "#7A3300"],
  holo: ["#FFD6F5", "#8FE3FF", "#7A5CFF"], toque: ["#FFFFFF", "#ECEFF3", "#9AA3AE"], chocolat: ["#C88A5A", "#6B3A1E", "#2C1408"],
  carte: ["#FFFFFF", "#F2F2F2", "#C21F3A"], feu: ["#FFE08A", "#FF6A2B", "#A01A0A"], ouvriers: ["#FFE08A", "#FFB020", "#3A3A3A"],
  etincelles: ["#FFFFFF", "#FFE27A", "#FF8A2B"], cables: ["#C8D2DC", "#6E7C8A", "#22303C"], comete: ["#E6F4FF", "#7FC4FF", "#3A3AA8"],
  aurore: ["#B8FFE0", "#2FD1A0", "#3A2A8F"], chat: ["#FFE0B8", "#F2A65A", "#5A3010"], neige: ["#FFFFFF", "#DDEBF7", "#7A9CC0"],
  desert: ["#FFE2A8", "#E3A456", "#8A4A18"], monaco: ["#FFFFFF", "#E8384F", "#7A0E1C"], bouclier: ["#E1ECFF", "#4C8DFF", "#173E8A"],
  metronome: ["#FFF1B0", "#C99A3A", "#5A3A0C"], remontada: ["#FFE3BF", "#FF7A2B", "#7A2A00"],
  // Trophées v2 : objets des succès et des légendes
  premiersang: ["#FFD0D0", "#D62839", "#6E0D12"], fusees: ["#E6F4FF", "#5AB8FF", "#1A3A8A"], halo: ["#FFFFFF", "#CFE3FF", "#6E8FB5"], turbo: ["#E6F6FF", "#5AB8FF", "#1A4A8A"],
  tortue: ["#BDF5C8", "#3FAE5A", "#1B5528"], foudre: ["#FFF6A8", "#3A4A7A", "#0B1020"], supernova: ["#FFFFFF", "#9B87FF", "#3A1A8A"], arcenciel: ["#FFD6F5", "#8FE3FF", "#7A5CFF"],
  etoilee: ["#FFF6CC", "#FFE596", "#9A6716"], cibles: ["#FFFFFF", "#E5484D", "#7A0E1C"], platine: ["#FFFFFF", "#DDE5EF", "#7D8898"], contre: ["#FFE3BF", "#E8833A", "#6B2A00"],
  carredas: ["#E8FFF0", "#1F7A4A", "#0B3A22"], diamant: ["#FFFFFF", "#C9F6FF", "#3A9AC0"], rubis: ["#FF9BB0", "#E0115F", "#43000F"], flammes: ["#FFE08A", "#FF6A1F", "#8A1A06"],
  phenix: ["#FFE08A", "#FF8A1F", "#6E0D12"], galaxie: ["#C9B6FF", "#5B2A9E", "#170A36"], soleil: ["#FFF3B0", "#FFB21E", "#9A4A00"], lauriers: ["#F3F9C8", "#8FB33A", "#3A5A10"],
  parade: ["#FFF1B0", "#E8B640", "#7A4A0C"], couronne: ["#FFF6CC", "#F7CF55", "#6B430C"], oranime: ["#FFF6CC", "#F7CF55", "#6B430C"], billets: ["#E8FFE0", "#4FAE5A", "#1B5528"],
  chercheur: ["#FFD0D0", "#D62839", "#6E0D12"], chercheuror: ["#FFF6CC", "#F7CF55", "#7A4A0C"], hiverdore: ["#FFF6CC", "#F7CF55", "#7A4A0C"], ticketor: ["#FFF6CC", "#F7CF55", "#7A4A0C"], feuilledor: ["#FFFBE0", "#F7CF55", "#7A4A0C"],
  // v20.61 · objets redessinés à l'image de leur monde
  ver: ["#F6DCAA", "#D9A35A", "#6B3A12"], ailee: ["#FFFDF2", "#F7CF55", "#7A5300"], anneau: ["#FFF3B8", "#F7CF55", "#3A2A1A"], elfique: ["#DFF2E2", "#4E9A5C", "#1E3A26"],
  pandora: ["#9AFFF6", "#1C6E8A", "#071A3A"], biolum: ["#E6FFFC", "#5CF2E6", "#0B5A6E"], rebelle: ["#FFD2B0", "#F57A2E", "#7A2A06"], sabre: ["#FFF1F1", "#FF3A48", "#6E0A12"],
  ampoules: ["#F4EBD6", "#B9A57A", "#4A3A24"], hoplite: ["#F8DA98", "#C98E3E", "#5A3412"], cheval: ["#E8C08A", "#B9813F", "#5A3412"],
  fracture: ["#FFC6F4", "#3A2F5C", "#07060F"], glitch: ["#FFFFFF", "#FF3BD4", "#3BE8FF"], portails: ["#FFE08A", "#FF8A1F", "#2A0E06"], coupsaison: ["#E1ECFF", "#7A5CFF", "#2B1A6E"], ratatouille: ["#DCE8FF", "#2A5DB0", "#12305A"]
};
function svgObjet(slot, id, px) {
  const k = "ob" + (++OBJ_UID), T = OBJ_TEINTES[id] || OBJ_TEINTES.or, [hi, md, dk] = T, sz = px || 64;
  const g = `<linearGradient id="${k}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${md}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
    `<radialGradient id="${k}r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${md}"/><stop offset="1" stop-color="${dk}"/></radialGradient>`;
  const motif = id === "damier" ? `<pattern id="${k}p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#F4F6F8"/><rect width="3" height="3" fill="#111418"/><rect x="3" y="3" width="3" height="3" fill="#111418"/></pattern>`
    : id === "carbone" ? `<pattern id="${k}p" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#1C1F24"/><path d="M0 0L4 4" stroke="#3A3F48" stroke-width="1.4"/></pattern>`
    : id === "holo" || id === "arcenciel" ? `<linearGradient id="${k}p" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#FF9BE6"/><stop offset=".33" stop-color="#8FE3FF"/><stop offset=".66" stop-color="#B6FF9B"/><stop offset="1" stop-color="#B49BFF"/></linearGradient>` : "";
  const F = motif ? `url(#${k}p)` : `url(#${k}l)`;
  let b = "";
  const reflet = (d, o = .55) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="${o}"/>`;
  if (slot === "casque" && id === "toque") {
    b = `<path d="M18 40C10 38 9 26 18 24C18 14 30 12 33 18C37 11 49 14 47 24C56 25 55 38 46 40Z" fill="url(#${k}r)" stroke="#9AA3AE" stroke-width="1.4"/><rect x="18" y="38" width="28" height="12" rx="2" fill="#F4F6F8" stroke="#9AA3AE" stroke-width="1.4"/><path d="M24 40V48M32 40V48M40 40V48" stroke="#C9D1DA" stroke-width="1.2"/>` + reflet("M20 26C22 22 26 20 29 21");
  } else if (slot === "casque") {
    b = `<path d="M10 40C10 22 22 12 36 12C50 12 56 24 56 36L56 44C56 48 53 50 49 50H18C13 50 10 46 10 40Z" fill="${F}" stroke="${dk}" stroke-width="1.6"/>` +
      `<path d="M30 26H54C56 26 56 36 54 38H34C30 38 28 34 28 31C28 28 28 26 30 26Z" fill="#141821" stroke="${dk}" stroke-width="1.2"/><path d="M34 29H51" stroke="#8FB7FF" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      (id === "anneau" ? `<path d="M10 36C24 30 40 28 56 28" stroke="#5A3606" stroke-width="6" fill="none"/><path d="M10 36C24 30 40 28 56 28" stroke="#F7CF55" stroke-width="4.2" fill="none"/><path d="M12 36C24 31 40 29 54 29" stroke="#FF5A1A" stroke-width="1.2" fill="none" stroke-dasharray="2.4 .8 .7 1 1.6 1"/>`
       : id === "rebelle" ? `<path d="M10 32C24 26 40 22 56 22M10 40C24 34 40 30 56 30" stroke="#fff" stroke-width="2.6" fill="none"/><circle cx="20" cy="22" r="5" fill="#fff" stroke="#7A260C"/><path d="M16.2 20.4C17.4 22 18.6 23 20 25.2 21.4 23 22.6 22 23.8 20.4 22 21 21 21 20 22.4 19 21 18 21 16.2 20.4Z" fill="#C8321E"/>`
       : id === "hoplite" ? `<path d="M12 22C12 6 30 0 44 6C50 9 52 12 52 16C44 10 34 10 26 14C20 17 16 21 15 26Z" fill="#C8281E" stroke="#5E0B08" stroke-width="1"/><path d="M18 18C22 10 32 6 42 7" stroke="#FF7A5A" stroke-width="1.2" fill="none"/><path d="M32 26C30 34 31 42 34 48" stroke="${dk}" stroke-width="1.4" fill="none"/>`
       : id === "fracture" ? `<path d="M14 30 24 34 22 42 32 44 40 38M24 34 30 24 38 26" stroke="#FF3BD4" stroke-width="1.6" fill="none" style="filter:drop-shadow(0 0 1.5px #FF3BD4)"/><path d="M15 31 25 35 23 43 33 45" stroke="#3BE8FF" stroke-width="1" fill="none"/><path d="M6 22 10 18 11 24Z" fill="#3BE8FF"/><path d="M4 32 8 29 8 35Z" fill="#FF3BD4"/>`
       : id === "eclair" ? `<path d="M18 22L24 32L19 33L25 44L15 31L20 30Z" fill="#fff" opacity=".9"/>` : id === "etoile" ? `<path d="M20 30l2 5 5 .4-4 3 1.4 5-4.4-3-4.4 3 1.4-5-4-3 5-.4z" fill="#fff" opacity=".9"/>` : id === "eclaireur" ? `<circle cx="22" cy="20" r="4" fill="#FFF6C8" stroke="${dk}"/>` : "") +
      reflet("M16 30C17 22 23 16 31 15") + `<path d="M12 46H54" stroke="${dk}" stroke-width="1" opacity=".5"/>`;
  } else if (slot === "livree") {
    b = `<path d="M4 40L10 34H22L28 28H40L46 34H58L60 40L58 44H6Z" fill="${F}" stroke="${dk}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M30 30H38L42 34H27Z" fill="#141821"/><rect x="2" y="30" width="6" height="12" rx="1" fill="${dk}"/><rect x="56" y="36" width="7" height="6" rx="1" fill="${dk}"/>` +
      (id === "carte" ? `<path d="M15 39c0-2 2-3 3-1.5 1-1.5 3-.5 3 1.5 0 2-3 3.5-3 3.5s-3-1.5-3-3.5z" fill="#C21F3A"/>` : id === "ver" ? `<path d="M16 34C17 37 17 40 16 43M24 33C25 36 25 40 24 43M44 34C45 37 45 40 44 43M52 36C53 38 53 40 52 43" stroke="${dk}" stroke-width="1.8" fill="none" opacity=".7"/><circle cx="34" cy="38" r="1" fill="#7FB8FF"/><circle cx="40" cy="36" r=".8" fill="#7FB8FF"/>` : "") +
      `<circle cx="16" cy="44" r="6.5" fill="#15181E" stroke="#444B57" stroke-width="2"/><circle cx="48" cy="44" r="6.5" fill="#15181E" stroke="#444B57" stroke-width="2"/><circle cx="16" cy="44" r="2" fill="#8A94A2"/><circle cx="48" cy="44" r="2" fill="#8A94A2"/>` + reflet("M12 36H24L29 31H38", .5);
  } else if (slot === "plaque") {
    b = `<path d="M32 8L52 16V30C52 44 43 52 32 57C21 52 12 44 12 30V16Z" fill="url(#${k}l)" stroke="${dk}" stroke-width="1.6"/><path d="M32 13L47 19V30C47 41 40 47 32 51C24 47 17 41 17 30V19Z" fill="none" stroke="${hi}" stroke-width="1.2" opacity=".8"/>` +
      (id === "hiverdore" ? `<circle cx="32" cy="33" r="13" fill="#1E4E8C" opacity=".9"/><g stroke="#FFF6CC" stroke-width="2.2" stroke-linecap="round">${[0, 60, 120].map(a => `<path d="M32 21V45M32 24.5 29.4 22.2M32 24.5 34.6 22.2M32 41.5 29.4 43.8M32 41.5 34.6 43.8" transform="rotate(${a} 32 33)"/>`).join("")}</g><circle cx="32" cy="33" r="2.6" fill="#F7CF55"/><path d="M45 14l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill="#fff"/>` : id === "cheval" ? `<path d="M22 40V30L26 25H29L31 21 33 25 35 27H42L44 31V40" fill="#B9813F" stroke="#5A3412" stroke-width="1.2" stroke-linejoin="round"/><path d="M22 34H44M28 30V40M34 30V40M40 30V40" stroke="#5A3412" stroke-width=".8"/><rect x="20" y="40" width="26" height="2.4" rx="1" fill="#7A4A1A"/><circle cx="24" cy="44" r="2" fill="#4A2C10"/><circle cx="42" cy="44" r="2" fill="#4A2C10"/>` :
       id === "metronome" ? `<path d="M26 44L32 20L38 44Z" fill="${dk}" opacity=".7"/><path d="M32 40L38 24" stroke="#fff" stroke-width="2"/>` : id === "remontada" ? `<path d="M22 42L30 32L35 37L43 24M37 24H43V30" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M32 20L42 25V32C42 39 37 43 32 45C27 43 22 39 22 32V25Z" fill="${hi}" opacity=".75"/>`) + reflet("M18 20L30 14", .6);
  } else if (slot === "fond") {
    b = `<rect x="8" y="10" width="48" height="44" rx="8" fill="${motif ? F : `url(#${k}l)`}" stroke="${dk}" stroke-width="1.4"/>` +
      (id === "aurore" ? `<path d="M8 34C20 22 30 40 56 26V46C40 52 24 40 8 50Z" fill="#B8FFE0" opacity=".45"/><path d="M8 28C22 16 34 34 56 20" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/><circle cx="44" cy="18" r="1.2" fill="#fff"/><circle cx="20" cy="16" r="1" fill="#fff"/>`
       : id === "chat" ? `<path d="M22 46V34L26 28L29 34H35L38 28L42 34V46Z" fill="#3A220C"/><circle cx="28.5" cy="38" r="1.4" fill="#FFD23D"/><circle cx="35.5" cy="38" r="1.4" fill="#FFD23D"/>`
       : id === "pandora" ? `<path d="M14 54C16 40 12 30 18 20M22 54C22 44 26 36 24 26M44 54C42 42 48 34 46 22M50 54C52 46 50 38 54 30" stroke="#1A9A9A" stroke-width="1.6" fill="none" opacity=".8"/>` + [[18, 20, 2.2, "#7CF7FF"], [24, 26, 1.6, "#FF8AE0"], [46, 22, 2, "#7CF7FF"], [54, 30, 1.5, "#B7FF6A"], [32, 36, 1.2, "#7CF7FF"], [38, 46, 1.4, "#FF8AE0"], [28, 48, 1, "#B7FF6A"]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" style="filter:drop-shadow(0 0 2px ${c})"/>`).join("")
       : id === "ampoules" ? `<g fill="#C9B98E" opacity=".7"><circle cx="18" cy="20" r="2"/><circle cx="40" cy="24" r="2"/><circle cx="28" cy="42" r="2"/><circle cx="50" cy="44" r="2"/></g><path d="M8 22C20 32 32 18 44 28S54 26 56 24" stroke="#2A2A2A" stroke-width="1" fill="none"/>` + [[14, 26, "#FF3B3B"], [22, 28, "#3BD16F"], [30, 25, "#3B8BFF"], [38, 26, "#F7CF55"], [46, 28, "#FF3B3B"], [53, 25, "#3BD16F"]].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y + 3}" rx="2.2" ry="3" fill="${c}" style="filter:drop-shadow(0 0 2px ${c})"/>`).join("")
       : id === "portails" ? `<circle cx="32" cy="32" r="15" fill="#120A20"/><circle cx="32" cy="32" r="15" fill="none" stroke="#FF8A1F" stroke-width="3.4" stroke-dasharray="2 1.4" style="filter:drop-shadow(0 0 2.5px #FFB347)"/><circle cx="32" cy="32" r="11" fill="none" stroke="#FFD27A" stroke-width="1" stroke-dasharray="1 2.4"/>` : "");
  } else if (slot === "finition") {
    b = `<circle cx="32" cy="34" r="20" fill="url(#${k}r)" stroke="${dk}" stroke-width="1.4"/><ellipse cx="25" cy="25" rx="7" ry="4" fill="#fff" opacity=".75" transform="rotate(-30 25 25)"/><path d="M48 12l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="${hi}"/><path d="M14 46l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="${hi}"/>` +
      (id === "feuilledor" ? [[22, 36, 4, 20], [36, 42, 3.4, 70], [40, 28, 3, 130], [28, 46, 2.6, 200]].map(([x, y, r, a]) => `<path d="M${x - r} ${y}L${x} ${y - r}L${x + r} ${y - r * .3}L${x + r * .4} ${y + r * .8}Z" fill="#FFF3B8" stroke="#9A6716" stroke-width=".6" transform="rotate(${a} ${x} ${y})"/>`).join("")
       : id === "ailee" ? `<path d="M30 30C22 20 12 22 8 28C16 26 22 28 28 34Z" fill="#fff" stroke="#B9A06A"/><path d="M34 30C42 20 52 22 56 28C48 26 42 28 36 34Z" fill="#fff" stroke="#B9A06A"/>`
       : id === "elfique" ? `<path d="M32 22C40 28 40 40 32 46C24 40 24 28 32 22Z" fill="#4E9A5C" stroke="#EEF4F6" stroke-width="1.4"/><path d="M32 25V44" stroke="#EEF4F6"/>`
       : id === "biolum" ? `<g fill="#E6FFFC">${[[22, 30], [40, 26], [44, 42], [26, 44], [34, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" style="filter:drop-shadow(0 0 2px #5CF2E6)"/>`).join("")}</g>` : "");
  } else if (slot === "trainee") {
    b = `<path d="M6 44C20 40 34 30 46 22" stroke="${md}" stroke-width="10" stroke-linecap="round" opacity=".3" fill="none"/><path d="M10 42C22 38 34 30 46 22" stroke="url(#${k}l)" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="48" cy="21" r="7" fill="url(#${k}r)"/>` +
      (id === "cables" ? `<path d="M8 50C20 46 30 36 44 28M12 34C22 32 32 26 42 18" stroke="${dk}" stroke-width="1.6" fill="none"/>` :
       id === "sabre" ? `<path d="M10 46L46 22" stroke="#FFF1F1" stroke-width="2" stroke-linecap="round"/><rect x="44" y="14" width="6" height="14" rx="1.5" fill="#2B2F36" stroke="#AEB7C2" transform="rotate(56 47 21)"/>` :
       id === "glitch" ? `<g><rect x="8" y="40" width="20" height="4" fill="#3BE8FF"/><rect x="14" y="32" width="18" height="3" fill="#F7F24A"/><rect x="20" y="46" width="14" height="3" fill="#FF3BD4"/></g>` : `<g fill="${hi}"><circle cx="18" cy="48" r="1.6"/><circle cx="28" cy="44" r="1.2"/><circle cx="24" cy="32" r="1.4"/><circle cx="36" cy="40" r="1"/></g>`);
  } else if (slot === "klaxon") {
    b = `<path d="M12 28H20L40 16V48L20 36H12Z" fill="url(#${k}l)" stroke="${dk}" stroke-width="1.5" stroke-linejoin="round"/><rect x="8" y="27" width="6" height="10" rx="2" fill="${dk}"/>` +
      `<path d="M46 24C50 28 50 36 46 40M50 18C57 25 57 39 50 46" stroke="${md}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + reflet("M22 30L37 21", .6);
  } else if (slot === "circuit") {
    b = `<path d="M14 40C8 30 14 16 26 18C34 19 34 28 42 26C52 23 58 32 52 42C47 50 22 52 14 40Z" fill="none" stroke="${dk}" stroke-width="8" stroke-linejoin="round"/><path d="M14 40C8 30 14 16 26 18C34 19 34 28 42 26C52 23 58 32 52 42C47 50 22 52 14 40Z" fill="none" stroke="${md}" stroke-width="5"/>` +
      `<path d="M14 40C8 30 14 16 26 18C34 19 34 28 42 26C52 23 58 32 52 42C47 50 22 52 14 40Z" fill="none" stroke="${hi}" stroke-width="1" stroke-dasharray="3 3"/><path d="M30 46V54" stroke="#111" stroke-width="3"/><path d="M30 46V54" stroke="#fff" stroke-width="3" stroke-dasharray="1.5 1.5"/>`;
  }
  return `<svg class="obj" viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true"><defs>${g}${motif}</defs><ellipse cx="32" cy="58" rx="18" ry="2.6" fill="#000" opacity=".18"/>${b}</svg>`;
}
/* ================= Trophées v2 (Théo, 25/11) : l'onglet Trophées en 4 sous-onglets =================
   🗺️ Mondes (12 cartes à collectionner, une par mini-jeu du mois) · 🏅 Succès (12 objectifs VISIBLES, dessin selon la difficulté)
   · 🧤 Gant (cristal cosmique, 6 pierres) · 💎 Légendes (un seul gagnant au monde). À part, sans objet : ⚔️ Titres et 🏆 Coupe brisée.
   Avant le 1er janvier 2027 l'onglet n'existe pas pour les joueurs (ongletPodium) ; l'aperçu admin le montre sans détenteurs. Aucun montant. */
let VIT_ONGLET = "mondes";
const VIT_ONGLETS = [["mondes", "🗺️", "Mondes"], ["succes", "🏅", "Succès"], ["gant", "🧤", "Gant"], ["legendes", "💎", "Légendes"]];
/** Couleurs et petit décor de chaque univers (fond des cartes des Mondes) : dessinés par nous, aucune image officielle */
const PAL_UNIV = {
  silverstone: ["#7A3A12", "#E8B86A", "#FFE2A8"], djeddah: ["#141B33", "#4E5C9A", "#C9D4FF"], melbourne: ["#3B1A5A", "#E77FB8", "#FFD6F5"],
  suzuka: ["#2A1407", "#B5531A", "#FFC08A"], miami: ["#06302E", "#22B58C", "#B8FFE0"], montreal: ["#05060F", "#262A66", "#B9C6FF"],
  bahrein: ["#16213D", "#D9913C", "#FFE2B8"], spa: ["#0B0F14", "#7A1C1C", "#FF8A8A"], lasvegas: ["#082640", "#3A8AC0", "#CDEBFF"],
  singapour: ["#2E1407", "#9A5A2F", "#F3C99B"], interlagos: ["#22201E", "#857463", "#EDE2D4"], monza: ["#180838", "#7A3AFF", "#E0CCFF"]
};
function decorUnivers(cle) {
  const R = n => Array.from({ length: n }, (_, i) => i);
  switch (cle) {
    case "silverstone": return '<circle cx="74" cy="22" r="9" fill="#FFF1C8" opacity=".75"/><circle cx="86" cy="30" r="5" fill="#FFE2A8" opacity=".6"/><path d="M0 72Q22 58 46 68T100 62V100H0Z" fill="#C98A45" opacity=".7"/><path d="M0 84Q30 72 62 82T100 78V100H0Z" fill="#8A4A18" opacity=".8"/><path d="M8 90Q30 84 52 92" stroke="#5A2A08" stroke-width="1.4" fill="none" opacity=".6"/>';
    case "djeddah": return '<circle cx="78" cy="20" r="8" fill="#F4F1DC" opacity=".8"/><circle cx="82" cy="18" r="7" fill="#141B33" opacity=".9"/><path d="M0 100V70H8V58L12 52 16 58V70H26V48L31 40 36 48V70H46V62H54V70H66V44L72 34 78 44V70H88V60L92 55 96 60V70H100V100Z" fill="#0B1022" opacity=".85"/><g fill="#FFD27A">' + [[33, 56], [74, 52], [14, 62], [92, 64]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="2" height="3"/>').join("") + "</g>";
    case "melbourne": return '<g opacity=".5">' + R(6).map(i => '<path d="M' + (i * 20 - 10) + ' 100L50 62L' + (i * 20 + 10) + ' 100Z" fill="' + (i % 2 ? "#fff" : "#2A1040") + '"/>').join("") + '</g><g fill="#FFD6F5" opacity=".55"><path d="M16 22c-3-2.4-4.4-3.6-4.4-5.2 0-1.2 1-2.1 2.1-2.1 1 0 1.7.6 2.3 1.3.5-.7 1.3-1.3 2.3-1.3 1.2 0 2.1.9 2.1 2.1 0 1.6-1.4 2.8-4.4 5.2z"/><path d="M84 34l3.4 4.2-3.4 4.2-3.4-4.2z"/></g>';
    case "suzuka": return '<path d="M0 100V78L30 56 44 64 62 30 70 38 78 34 100 70V100Z" fill="#1E0E05" opacity=".85"/><path d="M62 30L66 18 70 30Z" fill="#FF6A1F" opacity=".8"/><circle cx="66" cy="16" r="9" fill="#FF8A2B" opacity=".25"/><circle cx="22" cy="26" r="10" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".55"/>';
    case "miami": return '<path d="M10 40Q22 30 34 40Q28 52 22 52Q16 52 10 40Z" fill="#0B4A40" opacity=".8"/><path d="M60 26Q76 18 90 28Q82 42 74 42Q66 42 60 26Z" fill="#0B4A40" opacity=".8"/><path d="M22 52V80M74 42V76" stroke="#0B4A40" stroke-width="1.2" opacity=".6"/><path d="M0 86Q30 74 60 84T100 80V100H0Z" fill="#04211F"/><g fill="#7CFFE0">' + [[18, 70], [40, 78], [64, 66], [86, 72], [50, 58], [30, 88]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1"/>').join("") + "</g>";
    case "montreal": return '<g fill="#fff">' + [[8, 12], [22, 30], [40, 8], [58, 20], [76, 10], [90, 36], [14, 50], [84, 60], [48, 44], [30, 66]].map(([x, y], i) => '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 3 ? .6 : 1) + '" opacity=".8"/>').join("") + '</g><circle cx="80" cy="82" r="22" fill="#3A3F8A" opacity=".6"/><path d="M58 80Q80 72 102 80" stroke="#B9C6FF" stroke-width=".8" fill="none" opacity=".5"/>';
    case "bahrein": return '<path d="M0 100V74L10 70V62H18L22 58 26 62H34V72L44 68 52 72V60H60V72H70L76 66 82 72H92V64H100V100Z" fill="#0A1226" opacity=".9"/><path d="M78 72L84 24 90 72Z M80 48H88" stroke="#0A1226" stroke-width="2" fill="none" opacity=".9"/><g fill="#FFD27A">' + [[14, 76], [30, 78], [56, 74], [94, 76]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="2" height="2.6"/>').join("") + '</g><circle cx="22" cy="20" r="6" fill="#FFF1C8" opacity=".6"/>';
    case "spa": return '<path d="M0 0H100V34Q70 24 50 34T0 30Z" fill="#3A0A0A" opacity=".7"/><g fill="#050709" opacity=".9">' + [10, 30, 52, 74, 92].map(x => '<path d="M' + x + ' 0V22L' + (x - 6) + ' 32H' + (x + 6) + 'L' + x + ' 22"/>').join("") + '</g><g fill="#FFB0B0" opacity=".5">' + [[20, 50], [44, 60], [70, 46], [84, 70], [34, 80]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r=".9"/>').join("") + "</g>";
    case "lasvegas": return '<path d="M0 74Q12 68 24 74T48 74T72 74T100 72V100H0Z" fill="#0A3A6A" opacity=".85"/><path d="M0 84Q14 78 28 84T56 84T84 84T100 82V100H0Z" fill="#06223F"/><path d="M60 70V40L76 66Z" fill="#F4F1DC" opacity=".75"/><path d="M58 70H80L76 76H62Z" fill="#5A3A1A"/><circle cx="20" cy="22" r="7" fill="#FFF1C8" opacity=".55"/>';
    case "singapour": return '<path d="M0 78Q20 70 40 78T80 76T100 74V100H0Z" fill="#4A230F"/><path d="M0 86Q24 80 50 88T100 84" stroke="#B9733F" stroke-width="1.4" fill="none" opacity=".6"/><g><path d="M18 74V40" stroke="#F4EEE6" stroke-width="1.4"/><circle cx="18" cy="36" r="7" fill="#E5484D"/><path d="M14 33Q18 30 22 34" stroke="#fff" stroke-width="1.2" fill="none"/><path d="M82 72V46" stroke="#F4EEE6" stroke-width="1.4"/><circle cx="82" cy="42" r="6" fill="#4C9AFF"/></g>';
    case "interlagos": return '<path d="M0 100V34H6V28H14V34H24V28H32V34H42V28H50V34H60V28H68V34H78V28H86V34H94V28H100V100Z" fill="#3A3530" opacity=".9"/><g stroke="#1E1B18" stroke-width=".8" opacity=".7">' + [44, 56, 68, 80, 92].map(y => '<path d="M0 ' + y + 'H100"/>').join("") + R(9).map(i => '<path d="M' + (i * 12 + (i % 2) * 6) + ' 34V100"/>').join("") + "</g>";
    case "monza": return R(4).map(i => '<circle cx="50" cy="46" r="' + (12 + i * 10) + '" fill="none" stroke="' + ["#E0CCFF", "#FF6BD5", "#5AB8FF", "#FFD23D"][i] + '" stroke-width="1" opacity="' + (.6 - i * .1) + '"/>').join("") + '<circle cx="50" cy="46" r="10" fill="#E0CCFF" opacity=".25"/>';
    default: return "";
  }
}
/** Une médaille de succès, dessinée selon son PALIER (matière, cadre, ornement et éclat qui montent) ; premier = feuille d'or et lauriers */
let MED_UID = 0;
function svgMedaille(palier, premier) {
  const k = "md" + (++MED_UID), P = (PALIERS[palier] || PALIERS[1]).id;
  const T = { bronze: ["#F3C49A", "#B8733D", "#5E3214"], argent: ["#FFFFFF", "#C9D1DA", "#5E6874"], or: ["#FFF6C8", "#E8B640", "#7A4A0C"], legende: ["#F4E8FF", "#9B6BFF", "#24104F"] }[P];
  const rubanC = { bronze: ["#7A4A2A", "#A86A3A"], argent: ["#2F4A7A", "#5A7AB5"], or: ["#B0182E", "#E5484D"], legende: ["#3A1A8A", "#7A4AFF"] }[P];
  let s = '<svg class="sc-med" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="' + k + 'd" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="' + T[0] + '"/><stop offset=".55" stop-color="' + T[1] + '"/><stop offset="1" stop-color="' + T[2] + '"/></radialGradient>' +
    '<linearGradient id="' + k + 'r" x1="0" x2="1"><stop offset="0" stop-color="' + rubanC[0] + '"/><stop offset=".5" stop-color="' + rubanC[1] + '"/><stop offset="1" stop-color="' + rubanC[0] + '"/></linearGradient>' +
    (P === "legende" ? '<linearGradient id="' + k + 'p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9BE6"/><stop offset=".3" stop-color="#8FE3FF"/><stop offset=".6" stop-color="#B6FF9B"/><stop offset="1" stop-color="#FFE27A"/></linearGradient>' : "") + "</defs>";
  // éclat derrière la médaille : rien (bronze), halo (argent), rayons (or), rayons + nébuleuse (légendaire)
  if (P === "argent") s += '<circle cx="50" cy="56" r="40" fill="#fff" opacity=".14"/>';
  if (P === "or" || P === "legende") s += '<g class="sc-rayons" opacity="' + (P === "or" ? .35 : .5) + '">' + Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return '<path d="M50 56L' + (50 + Math.cos(a - .09) * 52).toFixed(1) + " " + (56 + Math.sin(a - .09) * 52).toFixed(1) + "L" + (50 + Math.cos(a + .09) * 52).toFixed(1) + " " + (56 + Math.sin(a + .09) * 52).toFixed(1) + 'Z" fill="' + (P === "or" ? "#FFE596" : i % 2 ? "#8FE3FF" : "#FF9BE6") + '"/>'; }).join("") + "</g>";
  // ruban
  s += P === "bronze" ? '<path d="M38 4H50L56 34H44Z" fill="url(#' + k + 'r)"/><path d="M62 4H50L44 34H56Z" fill="' + rubanC[0] + '"/>'
    : '<path d="M34 2H50L58 36H42Z" fill="url(#' + k + 'r)"/><path d="M66 2H50L42 36H58Z" fill="' + rubanC[0] + '"/>' + (P !== "argent" ? '<path d="M47 2H53L52 30H48Z" fill="' + (P === "or" ? "#FFE596" : "url(#" + k + "p)") + '" opacity=".9"/>' : '<path d="M48 2H52V30H48Z" fill="#fff" opacity=".6"/>');
  // lauriers (or, légendaire, et le PREMIER de tout palier)
  if (P === "or" || P === "legende" || premier) s += '<g fill="' + (premier || P === "or" ? "#E2B13C" : "#B49BFF") + '" stroke="' + (premier || P === "or" ? "#7A4A0C" : "#3A1A8A") + '" stroke-width=".6">' +
    [0, 1, 2, 3, 4].map(i => { const y = 84 - i * 8, x1 = 22 - i * 1.6 + (i > 2 ? (i - 2) * 2 : 0), x2 = 100 - x1; return '<ellipse cx="' + x1.toFixed(1) + '" cy="' + y + '" rx="6" ry="2.6" transform="rotate(' + (-50 - i * 10) + " " + x1.toFixed(1) + " " + y + ')"/><ellipse cx="' + x2.toFixed(1) + '" cy="' + y + '" rx="6" ry="2.6" transform="rotate(' + (50 + i * 10) + " " + x2.toFixed(1) + " " + y + ')"/>'; }).join("") + "</g>";
  // le disque, selon la matière
  if (P === "legende") {
    const hx = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return (50 + Math.cos(a) * 31).toFixed(1) + "," + (58 + Math.sin(a) * 31).toFixed(1); }).join(" ");
    const hx2 = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return (50 + Math.cos(a) * 25).toFixed(1) + "," + (58 + Math.sin(a) * 25).toFixed(1); }).join(" ");
    s += '<polygon points="' + hx + '" fill="url(#' + k + 'p)" stroke="#fff" stroke-width="1.2"/><polygon points="' + hx2 + '" fill="url(#' + k + 'd)"/>' +
      Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return '<path d="M50 58L' + (50 + Math.cos(a) * 25).toFixed(1) + " " + (58 + Math.sin(a) * 25).toFixed(1) + '" stroke="#fff" stroke-width=".5" opacity=".35"/>'; }).join("") +
      '<g class="sc-etin" fill="#fff"><path d="M84 22l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z"/><path d="M14 30l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/><path d="M86 84l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></g>';
  } else {
    const rr = P === "bronze" ? 26 : 29;
    if (P === "or") s += '<polygon points="' + Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? 30 : 35; return (50 + Math.cos(a) * r).toFixed(1) + "," + (58 + Math.sin(a) * r).toFixed(1); }).join(" ") + '" fill="url(#' + k + 'd)" stroke="#7A4A0C" stroke-width=".8"/>';
    s += '<circle cx="50" cy="58" r="' + rr + '" fill="url(#' + k + 'd)" stroke="' + T[2] + '" stroke-width="' + (P === "bronze" ? 1.4 : 1) + '"/>' +
      '<circle cx="50" cy="58" r="' + (rr - 5) + '" fill="none" stroke="' + T[0] + '" stroke-width="' + (P === "bronze" ? .8 : 1.2) + '" opacity=".7"/>';
    if (P === "argent") s += Array.from({ length: 20 }, (_, i) => { const a = i * Math.PI / 10; return '<circle cx="' + (50 + Math.cos(a) * (rr - 2.5)).toFixed(1) + '" cy="' + (58 + Math.sin(a) * (rr - 2.5)).toFixed(1) + '" r=".9" fill="#fff" opacity=".85"/>'; }).join("") +
      '<path d="M14 54l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z M86 54l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#E6EBF0"/>';
    s += '<path d="M' + (50 - rr * .62).toFixed(1) + " " + (58 - rr * .5).toFixed(1) + "A" + rr + " " + rr + " 0 0 1 " + (50 + rr * .2).toFixed(1) + " " + (58 - rr * .96).toFixed(1) + '" stroke="#fff" stroke-width="2.2" fill="none" opacity="' + (P === "bronze" ? .25 : .55) + '" stroke-linecap="round"/>';
  }
  if (premier) s += '<path class="sc-couronne" d="M36 26L33 13 42 19 50 9 58 19 67 13 64 26Z" fill="#F5C542" stroke="#8C5A10" stroke-width="1" stroke-linejoin="round"/><circle cx="50" cy="20" r="1.8" fill="#E5484D"/>';
  return s + "</svg>";
}
/** Gant de l'infini · direction C du directeur artistique : gant de cristal cosmique serti d'or.
 *  svgGant(n, pierres) : n pierres allumées (0 à 6) ; pierres = 6 valeurs dans l'ordre de PIERRES (victoire = cœur du dos, indice, carte, audace, ténacité = base des 4 doigts, retour = pouce).
 *  0 pierre : cristal givré, gris ; chaque pierre éclaircit le cristal, le remplit d'étoiles et allume sa veine ; complet : nébuleuse, six lumières en orbite, cœur en étoile. */
const GANT_COULEURS = ["#9B5CFF", "#3D8BFF", "#FF3B4E", "#FFD23D", "#2FD16A", "#FF8A2B"];
let GANT_UID = 0;
function svgGant(n, allumees) {
  const on = (allumees || []).map(Boolean), k = "gC" + (++GANT_UID), N = Math.max(0, Math.min(6, n | 0));
  const hx = h => (h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h).match(/\w\w/g).map(v => parseInt(v, 16));
  const mix = (a, b, t) => "#" + hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const t = Math.sqrt(N / 6), f = v => +v.toFixed(1);
  const X = { hi: mix("#9599A8", "#A493FF", t), md: mix("#575C6B", "#3A2A92", t), dk: mix("#262932", "#110A36", t), ed: mix("#262932", "#07041A", t) };
  const G = { hi: mix("#BDB59E", "#FFF3BE", t), md: mix("#8A8068", "#E2AE3A", t), dk: mix("#4E4738", "#7A4C0B", t) };
  const lum = (ax, ay, bx, by) => { const a = Math.atan2(by - ay, bx - ax) - Math.PI / 2; return .5 + .5 * Math.cos(a - (-2.4)); };
  const facette = (pts, l) => `<polygon points="${pts.map(p => f(p[0]) + "," + f(p[1])).join(" ")}" fill="${mix(X.dk, X.hi, Math.max(0, Math.min(1, l)) * .85)}"/>`;
  const DF = [];
  DF.push(`<linearGradient id="${k}o" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${G.hi}"/><stop offset=".5" stop-color="${G.md}"/><stop offset="1" stop-color="${G.dk}"/></linearGradient>`);
  DF.push(`<radialGradient id="${k}b" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${G.hi}"/><stop offset=".5" stop-color="${G.md}"/><stop offset="1" stop-color="${G.dk}"/></radialGradient>`);
  DF.push(`<linearGradient id="${k}s" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  DF.push(`<radialGradient id="${k}e" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#4A4E5A"/><stop offset=".6" stop-color="#22252D"/><stop offset="1" stop-color="#0E0F13"/></radialGradient>`);
  GANT_COULEURS.forEach((c, i) => DF.push(`<radialGradient id="${k}h${i}"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset=".4" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`));
  const clip = [];
  const pierre = (cx, cy, r, i) => {   // pierre taillée en losange, griffes d'or
    const c = GANT_COULEURS[i]; let s = "";
    if (on[i]) s += `<circle class="gC-pulse" cx="${cx}" cy="${cy}" r="${f(r * 3.2)}" fill="url(#${k}h${i})"/>`;
    const P = [[cx, cy - r * 1.35], [cx + r, cy], [cx, cy + r * 1.35], [cx - r, cy]], Q = P.map(p => [cx + (p[0] - cx) * 1.28, cy + (p[1] - cy) * 1.22]);
    s += `<polygon points="${Q.map(p => f(p[0]) + "," + f(p[1])).join(" ")}" fill="url(#${k}o)" stroke="${G.dk}" stroke-width=".7"/>`;
    if (!on[i]) s += `<polygon points="${P.map(p => f(p[0]) + "," + f(p[1])).join(" ")}" fill="url(#${k}e)"/><polygon points="${P.map(p => f(p[0]) + "," + f(p[1])).join(" ")}" fill="${c}" opacity=".16"/>`;
    else {
      const tri = (a, b, cl) => `<polygon points="${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${cx},${cy}" fill="${cl}"/>`;
      s += tri(P[0], P[1], mix(c, "#fff", .35)) + tri(P[1], P[2], c) + tri(P[2], P[3], mix(c, "#000", i === 3 ? .25 : .45)) + tri(P[3], P[0], mix(c, "#fff", .6));
      s += `<polygon points="${f(cx)},${f(cy - r * .5)} ${f(cx + r * .38)},${f(cy)} ${f(cx)},${f(cy + r * .5)} ${f(cx - r * .38)},${f(cy)}" fill="${mix(c, "#fff", .7)}" opacity=".7"/>`;
    }
    s += `<path d="M${f(P[3][0] + r * .25)} ${f(cy - r * .35)}L${f(cx - r * .05)} ${f(P[0][1] + r * .35)}" stroke="#fff" stroke-width="${f(r * .18)}" stroke-linecap="round" opacity="${on[i] ? .9 : .3}"/>`;
    return s;
  };
  const doigts = [{ x: 65, y: 104, a: -8, L: 80, w: 22, p: 1 }, { x: 90.5, y: 99, a: -2, L: 92, w: 23, p: 2 }, { x: 116, y: 100, a: 4.5, L: 84, w: 22, p: 3 }, { x: 140, y: 108, a: 12, L: 64, w: 19, p: 4 }, { x: 60, y: 166, a: -56, L: 66, w: 24, p: 5 }];
  const doigt = d => {   // doigts facettés : deux pans, arête et capuchon d'or
    const L = d.L, h = d.w / 2, tr = `translate(${d.x} ${d.y}) rotate(${d.a})`;
    const out = `M${-h} 10L${f(-h * .9)} ${f(-L * .7)}L${f(-h * .45)} ${f(-L)}L${f(h * .45)} ${f(-L)}L${f(h * .9)} ${f(-L * .7)}L${h} 10Z`;
    clip.push(`<path transform="${tr}" d="${out}"/>`);
    let s = `<g transform="${tr}">`;
    s += `<polygon points="${-h},10 ${f(-h * .9)},${f(-L * .7)} ${f(-h * .1)},${f(-L * .72)} 0,10" fill="${mix(X.dk, X.hi, .7)}"/>`;
    s += `<polygon points="0,10 ${f(-h * .1)},${f(-L * .72)} ${f(h * .9)},${f(-L * .7)} ${h},10" fill="${mix(X.dk, X.hi, .3)}"/>`;
    s += `<polygon points="${f(-h * .9)},${f(-L * .7)} ${f(-h * .45)},${f(-L)} ${f(h * .45)},${f(-L)} ${f(-h * .1)},${f(-L * .72)}" fill="${mix(X.dk, X.hi, .95)}"/>`;
    s += `<polygon points="${f(-h * .1)},${f(-L * .72)} ${f(h * .45)},${f(-L)} ${f(h * .9)},${f(-L * .7)}" fill="${mix(X.dk, X.hi, .5)}"/>`;
    [-.36, -.62].forEach(q => s += `<path d="M${f(-h * .97)} ${f(L * q)}L${f(-h * .1)} ${f(L * q - 2)}L${f(h * .97)} ${f(L * q)}" stroke="url(#${k}o)" stroke-width="1.6" fill="none"/>`);
    s += `<path d="${out}" fill="url(#${k}s)"/><path d="${out}" fill="none" stroke="${G.md}" stroke-width="1"/>`;
    s += `<path d="M${f(-h * .45)} ${f(-L)}L${f(h * .45)} ${f(-L)}L${f(h * .9)} ${f(-L * .7)}L${f(-h * .1)} ${f(-L * .72)}L${f(-h * .9)} ${f(-L * .7)}Z" fill="none" stroke="${G.hi}" stroke-width=".7" opacity=".9"/></g>`;
    const A = d.a * Math.PI / 180, yl = d.p === 5 ? -L * .34 : -L * .14; d.px = f(d.x - Math.sin(A) * yl); d.py = f(d.y + Math.cos(A) * yl);
    return s;
  };
  const O = [100, 150];
  const bord = [[46, 112], [56, 98], [78, 95], [100, 93], [122, 93], [144, 96], [155, 108], [152, 140], [149, 172], [136, 196], [100, 200], [64, 196], [52, 172], [48, 140]];
  clip.push(`<polygon points="${bord.map(p => p.join(",")).join(" ")}"/>`);
  let corps = "";
  bord.forEach((p, i) => { const q = bord[(i + 1) % bord.length]; corps += facette([p, q, O], lum(p[0], p[1], q[0], q[1]) * .9 + .05); });
  const anneau = bord.map(p => [O[0] + (p[0] - O[0]) * .55, O[1] + (p[1] - O[1]) * .55]);
  anneau.forEach((p, i) => { const q = anneau[(i + 1) % anneau.length]; corps += facette([p, q, O], lum(q[0], q[1], p[0], p[1]) * .7 + .15); });
  corps += `<path d="${bord.map(p => `M${p[0]} ${p[1]}L${O[0]} ${O[1]}`).join("") + "M" + anneau.map(p => f(p[0]) + " " + f(p[1])).join("L") + "Z"}" stroke="${X.hi}" stroke-width=".5" fill="none" opacity=".45"/>`;
  const man = "M60 192L140 192L156 246L44 246Z";   // manchette : bague de cristal, rebords d'or, petite gemme
  clip.push(`<path d="${man}"/>`);
  let mc = "";
  const cols = [44, 58, 76, 100, 124, 142, 156], colsH = [60, 68, 82, 100, 118, 132, 140];
  for (let i = 0; i < 6; i++) mc += facette([[colsH[i], 196], [colsH[i + 1], 196], [cols[i + 1], 244], [cols[i], 244]], .9 - Math.abs(i - 1.6) * .17);
  mc += `<path d="${cols.map((x, i) => `M${colsH[i]} 196L${x} 244`).join("")}" stroke="${X.hi}" stroke-width=".5" opacity=".5"/><path d="${man}" fill="url(#${k}s)"/>`;
  mc += `<path d="M54 186H146L144 197H56Z" fill="url(#${k}o)" stroke="${G.dk}" stroke-width=".8"/><path d="M40 243H160L163 252H37Z" fill="url(#${k}o)" stroke="${G.dk}" stroke-width=".8"/>`;
  mc += `<path d="M56 191.5H144M39 247.5H161" stroke="${G.dk}" stroke-width=".6" stroke-dasharray="1 2.4" opacity=".7"/>`;
  mc += `<path d="M100 204L108 218L100 232L92 218Z" fill="url(#${k}o)" stroke="${G.dk}" stroke-width=".7"/><path d="M100 209L104 218L100 227L96 218Z" fill="${X.ed}"/><path d="M100 209L104 218L100 227L96 218Z" fill="none" stroke="${G.hi}" stroke-width=".5"/>`;
  const D2 = doigts.map(doigt);
  let s = `<svg class="gant-svg gant-C" viewBox="-22 -24 244 296" aria-hidden="true"><defs>${DF.join("")}<clipPath id="${k}k">${clip.join("")}</clipPath></defs>`;
  if (N > 0) { const pos = [[100, 60], [40, 110], [160, 110], [40, 200], [160, 200], [100, 250]];   // nébuleuse : un nuage par pierre allumée
    GANT_COULEURS.forEach((c, i) => { if (on[i]) s += `<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="${f(44 + N * 3)}" fill="url(#${k}h${i})" opacity="${f(.25 + .25 * N / 6)}"/>`; }); }
  s += `<ellipse cx="100" cy="262" rx="64" ry="5" fill="#000" opacity=".22"/>`;
  s += D2[4] + D2.slice(0, 4).join("") + corps + mc;
  { let z = 424242, st = ""; const rnd = () => (z = (z * 16807) % 2147483647) / 2147483647, nb = 10 + N * 12;   // ciel intérieur : étoiles dans le cristal
    for (let i = 0; i < 82; i++) { const x = f(42 + rnd() * 116), y = f(10 + rnd() * 240), r = f(.35 + rnd() * .8); if (i < nb) st += `<circle cx="${x}" cy="${y}" r="${r}"${i % 7 === 0 && N === 6 ? ` class="gC-tw" style="animation-delay:${(i % 5) * .5}s"` : ""}/>`; }
    s += `<g clip-path="url(#${k}k)"><g fill="#fff" opacity="${f(.25 + .6 * t)}">${st}</g>` + (N < 3 ? `<rect x="20" y="-10" width="160" height="280" fill="#D9DCE4" opacity="${[.12, .07, .03][N]}"/>` : "") + "</g>"; }
  doigts.forEach(d => {   // veines : de chaque pierre vers le cœur
    const i = d.p, x = d.px, y = d.py, mx = f((x + O[0]) / 2 + (O[1] - y) * .12), my = f((y + O[1]) / 2 + (x - O[0]) * .05), v = `M${x} ${y}Q${mx} ${my} ${O[0]} ${O[1]}`;
    s += on[i] ? `<path d="${v}" stroke="${GANT_COULEURS[i]}" stroke-width="4.5" opacity=".35" fill="none" stroke-linecap="round"/><path d="${v}" stroke="${mix(GANT_COULEURS[i], "#fff", .45)}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path class="gC-flux" d="${v}" stroke="#fff" stroke-width="1.3" stroke-dasharray="2 6" fill="none" stroke-linecap="round"/>`
      : `<path d="${v}" stroke="${X.ed}" stroke-width="1.3" fill="none" opacity=".7"/><path d="${v}" stroke="${X.hi}" stroke-width=".5" fill="none" opacity=".5" transform="translate(.6 .6)"/>`;
  });
  let ros = "";   // cœur : rosace d'or à 8 pointes + pierre de la victoire
  for (let i = 0; i < 8; i++) { const A = i * Math.PI / 4, B = A + Math.PI / 8, C2 = A - Math.PI / 8;
    ros += `<polygon points="${f(O[0] + Math.cos(A) * 24)},${f(O[1] + Math.sin(A) * 24)} ${f(O[0] + Math.cos(B) * 12)},${f(O[1] + Math.sin(B) * 12)} ${f(O[0] + Math.cos(C2) * 12)},${f(O[1] + Math.sin(C2) * 12)}" fill="url(#${k}o)" stroke="${G.dk}" stroke-width=".6"/>`; }
  if (N === 6) s += `<path class="gC-pulse" d="M100 108L104.5 145.5L142 150L104.5 154.5L100 192L95.5 154.5L58 150L95.5 145.5Z" fill="#FFF6D0"/><circle class="gC-pulse" cx="100" cy="150" r="30" fill="url(#${k}h0)"/>`;
  s += ros + `<circle cx="${O[0]}" cy="${O[1]}" r="13" fill="url(#${k}b)" stroke="${G.dk}" stroke-width=".8"/>` + pierre(O[0], O[1], 8.5, 0);
  doigts.forEach(d => s += pierre(d.px, d.py, d.p === 5 ? 5.6 : 5.4, d.p));
  if (N === 6) { let o = ""; GANT_COULEURS.forEach((c, i) => { const A = (i * 60 - 90) * Math.PI / 180, x = f(O[0] + Math.cos(A) * 112), y = f(O[1] + Math.sin(A) * 112);
      o += `<circle cx="${x}" cy="${y}" r="7" fill="url(#${k}h${i})"/><circle cx="${x}" cy="${y}" r="2.4" fill="${mix(c, "#fff", .6)}"/>`; });
    s = s.replace(`<ellipse cx="100" cy="262"`, `<g class="gC-orbite"><circle cx="${O[0]}" cy="${O[1]}" r="112" fill="none" stroke="#fff" stroke-width=".5" opacity=".3" stroke-dasharray="1 4"/>${o}</g><ellipse cx="100" cy="262"`); }
  return s + "</svg>";
}
/** Vignette d'un pilote : pastille de sa couleur + nom */
function nomPilote(n) { return '<span class="nmp" style="--c:' + couleur(n) + '"><i></i>' + esc(n) + "</span>"; }
const pastillesPilotes = noms => '<span class="cc-pts">' + noms.map(n => '<i style="--c:' + couleur(n) + '" title="' + esc(n) + '"></i>').join("") + "</span>";
function anneauProg(p, c) { const r = 10, L = 2 * Math.PI * r; return '<svg class="cc-anneau" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="' + r + '" fill="none" stroke="var(--rule)" stroke-width="3.2"/><circle cx="13" cy="13" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="' + (L * Math.max(0, Math.min(1, p))).toFixed(1) + " " + L.toFixed(1) + '" transform="rotate(-90 13 13)"/></svg>'; }
/** Les lauriers d'or (meilleur du mois, premier à réussir) */
const LAURIERS = '<svg class="cc-laurier" viewBox="0 0 96 40" aria-hidden="true"><g fill="#E2B13C" stroke="#8C5A10" stroke-width=".6">' + [0, 1, 2, 3, 4].map(i => '<ellipse cx="' + (18 - i * 2) + '" cy="' + (34 - i * 6) + '" rx="5" ry="2.4" transform="rotate(' + (-40 - i * 10) + " " + (18 - i * 2) + " " + (34 - i * 6) + ')"/><ellipse cx="' + (78 + i * 2) + '" cy="' + (34 - i * 6) + '" rx="5" ry="2.4" transform="rotate(' + (40 + i * 10) + " " + (78 + i * 2) + " " + (34 - i * 6) + ')"/>').join("") + "</g></svg>";
const COURONNE_CC = '<svg class="cc-couronne" viewBox="0 0 34 20" aria-hidden="true"><path d="M3 18L1 5L10 11L17 1L24 11L33 5L31 18Z" fill="#F5C542" stroke="#8C5A10" stroke-width="1.2" stroke-linejoin="round"/><circle cx="17" cy="12" r="2.2" fill="#FF3B4E"/><circle cx="9" cy="14" r="1.5" fill="#3D8BFF"/><circle cx="25" cy="14" r="1.5" fill="#2FD16A"/></svg>';

/* ---------- 🗺️ Les Mondes : cartes à collectionner (direction B du DA) ; le meilleur du mois = feuille d'or, lauriers et projecteur sur socle (idée des cases A) ---------- */
function htmlCaseMonde(t, apercu, noms, moi) {
  const TM = apercu ? null : etatTropheesMondes(), o = TM && moi ? TM[t.id][moi] : null, qui = TM ? noms.filter(n => TM[t.id][n] && TM[t.id][n].ok) : [];
  const best = o && o.meilleur ? o.meilleur : (TM ? (noms.map(n => TM[t.id][n].meilleur).find(Boolean) || null) : null), aVenir = !o || o.aVenir;
  const bests = o && o.meilleurs && o.meilleurs.length ? o.meilleurs : (TM ? (noms.map(n => TM[t.id][n].meilleurs).find(l => l && l.length) || []) : []), titre = o && o.titre;
  const st = bests.includes(moi) ? "exclusif" : o && o.ok ? "moi" : qui.length ? "autres" : "a-gagner";
  const P = PAL_UNIV[t.univers] || ["#333", "#777", "#ddd"], [s0, i0] = t.gain[0], mois = MOIS_L[t.mois - 1];
  // relecture jeu-joueur (25/11) : un mois fini raté le dit (« ✗ Manqué (80 / 120) »), le mois en cours aussi (« ⏳ En cours · 37 / 120 »)
  const pc = o && o.c > 1 ? o.p + " / " + o.c : o && o.txt ? o.txt : "";
  const pied = st === "a-gagner" ? (aVenir ? "<span>🎁 " + t.gain.length + " objets à gagner</span>" + '<span class="cc-lock" aria-label="pas encore ouvert">🔒</span>'
      : o && o.etat === "fini" ? '<span class="cc-rate">✗ Manqué' + (pc ? " (" + esc(pc) + ")" : "") + "</span>"
      : anneauProg(o && o.c ? o.p / o.c : 0, P[2]) + "<span>⏳ En cours" + (pc ? " · " + esc(pc) : "") + "</span>")
    : st === "exclusif" ? "<span>🌟 <b>" + esc(titre || "Meilleur du mois") + "</b></span>" + pastillesPilotes(qui)
    : st === "moi" ? "<span><b>✓ Gagné</b>" + (best ? " · 🌟 " + esc(best.nom) : "") + "</span>" + pastillesPilotes(qui)
    : (o && o.c > 1 && o.p ? anneauProg(o.p / o.c, P[2]) + "<span>" + esc(o.txt || o.p + " / " + o.c) + "</span>" : "<span>Déjà à " + esc(qui.join(", ")) + "</span>") + pastillesPilotes(qui);
  return '<button type="button" class="cc cc-m ' + st + (aVenir ? " a-venir" : "") + '" data-monde="' + t.id + '" style="--ma:' + P[0] + ";--mb:" + P[1] + ";--macc:" + P[2] + ";--ma-r:" + P[0] + ";--mb-r:" + P[1] + '">' +
    '<span class="cc-in"><span class="cc-art"><svg class="cc-deco" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + decorUnivers(t.univers) + "</svg>" +
    (st === "exclusif" ? '<span class="cc-projo" aria-hidden="true"></span><span class="cc-socle" aria-hidden="true"></span>' : '<span class="cc-halo" aria-hidden="true"></span>') +
    '<span class="cc-ecu">' + icoMonde(t) + '</span><span class="cc-mois">' + esc(MOIS[t.mois - 1]) + '</span><span class="cc-petits">' + t.gain.slice(1).map(([s, i]) => svgObjet(s, i, 20)).join("") + "</span>" + svgObjet(s0, i0, 70) +
    (st === "exclusif" ? LAURIERS : "") + "</span>" +
    '<span class="cc-ruban">' + esc(nomMonde(t)) + '</span><span class="cc-txt"><small>' + (o && o.trophee && !aVenir ? esc(o.trophee.ico + " " + o.trophee.nom) + " · objectif commun" : "Objectif commun du mini-jeu de " + esc(mois)) + '</small><span class="cc-pied">' + pied + "</span></span></span>" +
    (st === "moi" ? '<span class="cc-coche">✓</span>' : "") + (st === "exclusif" ? COURONNE_CC : "") + "</button>";
}
function htmlMondes(apercu, noms, moi) {
  const TM = apercu ? null : etatTropheesMondes(), mes = TM && moi ? TROPHEES_MONDES.filter(t => TM[t.id][moi] && TM[t.id][moi].ok).length : 0;
  return '<section class="vit" id="vit-mondes"><h3 class="vit-h">🗺️ Les 12 mondes <small>un trophée par mini-jeu du mois · tout le monde peut tout avoir' + (TM && moi ? " · " + mes + " / 12 à toi" : "") + "</small></h3>" +
    '<p class="info">Chaque mois, réussissez <b>ensemble</b> l\'objectif commun du mini-jeu de l\'univers : chacun gagne son trophée et ses objets d\'écurie. Le <b>meilleur du mois</b> gagne en plus son <b>surnom du mois</b> et un <b>objet exclusif doré</b> 🌟.</p>' +
    '<div class="cc-grille">' + TROPHEES_MONDES.map(t => htmlCaseMonde(t, apercu, noms, moi)).join("") + "</div></section>";
}

/* ---------- 🏅 Les Succès : 12 objectifs visibles ; le dessin monte avec la difficulté (bronze, argent, or, légendaire) ---------- */
function htmlCaseSucces(x, r, moi) {
  const P = PALIERS[x.palier], premier = r.or && r.or.noms.includes(moi), aMoi = premier || r.autres.some(o => o.nom === moi), qui = r.or ? r.or.noms.concat(r.autres.map(o => o.nom)) : [];
  const st = premier ? "premier" : aMoi ? "moi" : qui.length ? "autres" : "a-faire";
  const pied = st === "a-faire" ? "<span>Personne pour l'instant</span>"
    : "<span>🥇 <b>" + esc(r.or.nom) + "</b>" + (st === "premier" ? " · toi !" : st === "moi" ? " · ✓ toi aussi" : "") + "</span>" + pastillesPilotes(qui);
  return '<button type="button" class="cc cc-s p-' + P.id + " " + st + '" data-succes="' + x.id + '">' +
    '<span class="cc-in"><span class="cc-art"><span class="cc-palier">' + P.ico + " " + esc(P.nom) + "</span>" +
    '<span class="cc-petits">' + svgObjet(x.gain[0], x.gain[1], 20) + (x.bonus ? '<span class="cc-excl" title="exclusif du premier">' + svgObjet(x.bonus[0], x.bonus[1], 20) + "</span>" : "") + "</span>" +
    '<span class="cc-medw">' + svgMedaille(x.palier, st === "premier") + '<span class="cc-emo" aria-hidden="true">' + x.ico + "</span></span></span>" +
    '<span class="cc-ruban">' + esc(x.nom) + '</span><span class="cc-txt"><small>' + esc(x.def.replace("l'indice", "le " + D.marche.indices[iRef()]).replace(/^./, c => c.toUpperCase())) + '</small><span class="cc-pied">' + pied + "</span></span></span>" +
    (st === "moi" ? '<span class="cc-coche">✓</span>' : "") + (st === "premier" ? COURONNE_CC : "") + "</button>";
}
function htmlSucces(apercu, noms, moi) {
  const R = {}; SUCCES.forEach(x => { R[x.id] = apercu ? { or: null, autres: [], tous: [] } : rangsSucces(x.id); });
  const nb = n => ({ or: SUCCES.filter(x => R[x.id].or && R[x.id].or.noms.includes(n)).length, tous: SUCCES.filter(x => (R[x.id].or && R[x.id].or.noms.includes(n)) || R[x.id].autres.some(o => o.nom === n)).length });
  const tab = apercu ? "" : '<div class="ex-tab">' + noms.slice().sort((a, b) => nb(b).tous - nb(a).tous || nb(b).or - nb(a).or).map(n => { const c = nb(n); return '<span style="--c:' + couleur(n) + '">' + esc(n) + " <b>" + c.tous + "</b> réussi" + (c.tous > 1 ? "s" : "") + " · <b>" + c.or + "</b> en premier</span>"; }).join("") + "</div>";
  let h = "";
  [1, 2, 3, 4].forEach(p => { const l = SUCCES.filter(x => x.palier === p); if (!l.length) return;
    h += '<h4 class="vit-h4 pal-h p-' + PALIERS[p].id + '">' + PALIERS[p].ico + " " + esc(PALIERS[p].nom) + " <small>" + esc(PALIERS[p].txt) + '</small></h4><div class="cc-grille">' + l.map(x => htmlCaseSucces(x, R[x.id], moi)).join("") + "</div>"; });
  return '<section class="vit" id="vit-succes"><h3 class="vit-h">🏅 Les succès <small>12 objectifs de course et de bourse · ' + (apercu ? "à réussir dès janvier" : (moi ? nb(moi).tous + " / 12 à toi" : "")) + "</small></h3>" +
    '<p class="info">Chacun qui réussit gagne le <b>badge</b> et l\'<b>objet</b> du succès. Le <b>premier</b> gagne en plus la version <b>dorée</b>, son nom gravé et un <b>objet exclusif</b> que personne d\'autre n\'aura.</p>' + tab + h +
    '<div class="cc-grille"><div class="cc cc-2028" aria-label="Succès 2028"><span class="cc-in"><span class="cc-art"><span class="cc-emo">❔</span></span><span class="cc-ruban">??? 2028</span><span class="cc-txt"><small>De nouveaux succès arrivent avec la saison 2.</small></span></span></div></div></section>';
}

/* ---------- 🧤 Le Gant de l'infini (direction C : cristal cosmique) ---------- */
const GANT = { gain: [["livree", "chrome"], ["plaque", "remontada"]] };
const PIERRES = [
  { id: "victoire", c: "#9B5CFF", nom: "Pierre de la victoire", def: "gagner un mois" },
  { id: "indice", c: "#3D8BFF", nom: "Pierre de l'indice", def: "3 mois devant l'indice dans la saison" },
  { id: "carte", c: "#FF3B4E", nom: "Pierre de la carte", def: "marquer des points avec une carte" },
  { id: "pari", c: "#FFD23D", nom: "Pierre de l'audace", def: "gagner un 🎲 Pari contre le leader du championnat (celui en tête au départ du mois, donc dès février)" },
  { id: "tenace", c: "#2FD16A", nom: "Pierre de la ténacité", def: "3 mois d'affilée sans finir dernier" },
  { id: "retour", c: "#FF8A2B", nom: "Pierre du retour", def: "finir dernier un mois, puis gagner un mois plus tard" }
];
function htmlGant(apercu, noms, moi, y) {
  const G = apercu ? {} : etatGant(y), g = (moi && G[moi]) || { p: [0, 0, 0, 0, 0, 0], n: 0 }, idx = D.marche.indices[iRef()];
  return '<section class="vit" id="vit-gant"><h3 class="vit-h">🧤 Le Gant de l\'infini <small>le grand objectif de la saison · tout le monde peut le compléter</small></h3>' +
    '<div class="gant' + (g.n === 6 ? " complet" : "") + '"><div class="gant-h">' + svgGant(g.n, g.p) + '<div class="gant-t"><span class="gant-n"><b>' + g.n + "</b> / 6 pierres" + (g.n === 6 ? " · complet !" : "") + "</span>" +
    "<small>Allume ses 6 pierres d'ici la fin de la saison (décembre compris). Chaque pierre allumée brille aussi sur ta voiture en course.</small></div></div>" +
    '<ol class="pierres">' + PIERRES.map((pi, i) => '<li class="' + (g.p[i] ? "on" : "") + '" style="--pc:' + pi.c + '"><i aria-hidden="true"></i><span><b>' + esc(pi.nom) + "</b><small>" + esc(pi.def.replace("l'indice", "le " + idx)) + (g.p[i] ? " · ✓ " + esc(moisLong(g.p[i])) : "") + "</small></span></li>").join("") + "</ol>" +
    (apercu ? "" : '<div class="gant-autres"><small>Les autres pilotes (combien de pierres) :</small>' + noms.filter(n => n !== moi).map(n => '<span class="nmp" style="--c:' + couleur(n) + '"><i></i>' + esc(n) + " <b>" + ((G[n] || { n: 0 }).n) + "</b>/6</span>").join("") + "</div>") +
    '<p class="gant-r">🎁 Gant complet : ' + esc(libGains(GANT.gain)) + ".</p>" + (!apercu && g.n === 6 ? '<div class="btn-row">' + btnEquiper(...GANT.gain[0]) + "</div>" : "") + "</div></section>";
}

/* ---------- 💎 Les Légendes : un seul gagnant au monde ---------- */
function htmlLegendes(apercu, noms, moi) {
  const pm = apercu ? null : D.premierMillion, ch = apercu ? null : detenteur(CHAMPION_EX.id), tk = apercu ? [] : gagnantsTicket().slice(0, 1);
  const votes = apercu ? [] : [...new Set(Object.values(D.votes || {}).flatMap(v => v.gagnants || []))];
  const champions = apercu ? [] : anneesSaison().map(y => { const c = championnat(y); return c.complete && c.classement[0] ? { y, nom: c.classement[0] } : null; }).filter(Boolean);
  const carte = (id, ico, nom, cond, gains, qui, quand, extra) => '<div class="lg lg-' + id + (qui ? " prise" : "") + (qui && qui === moi ? " a-moi" : "") + '"' + (id === "ticket" ? ' id="vit-tickets"' : "") + ">" +
    '<span class="lg-i" aria-hidden="true">' + ico + '</span><div class="lg-t"><b>' + esc(nom) + "</b><small>" + esc(cond) + '</small><span class="lg-o">🎁 ' + esc(libGains(gains)) + "</span>" + (extra || "") + "</div>" +
    '<div class="lg-q">' + (qui ? '<span class="lg-nom" style="--c:' + couleur(qui) + '">' + esc(qui) + "</span><small>" + esc(quand || "pour toujours") + "</small>" : "<small>Un seul gagnant</small>") + "</div></div>";
  return '<section class="vit" id="vit-legendes"><h3 class="vit-h">💎 Les Légendes <small>un seul gagnant au monde, pour toujours</small></h3>' +
    '<p class="info">Des objets uniques : une fois gagnés, plus personne ne pourra les avoir.</p><div class="lg-l">' +
    carte("million", "👑", "Premier millionnaire", "le premier du groupe à atteindre 1\u00a0000\u00a0000\u00a0€ de patrimoine financier", GAINS_MILLION, pm ? pm.nom : null, pm ? "pour toujours" : "") +
    carte("champion", "🌿", "Premier champion", "remporter la première saison complète", gainsSecret(CHAMPION_EX), ch ? ch.nom : null, ch ? moisLong(ch.k) : "",
      champions.length ? '<span class="lg-x">🏆 ' + champions.map(c => "Saison " + numeroSaison(c.y) + " : " + esc(c.nom)).join(" · ") + "</span>" : "") +
    carte("vote", "🗳️", "Coup de la saison", "élu par les autres pilotes au vote de décembre", [["plaque", "coupsaison"]], votes.length ? votes.join(" et ") : null, "") +
    carte("ticket", "🎫", "Ticket d'or", "un seul ticket d'or caché dans les tablettes de la 🍫 Chocolaterie (octobre)", GAINS_TICKET, tk.length ? tk[0].nom : null, tk.length && tk[0].j ? "trouvé dans sa tablette" : "") +
    "</div></section>";
}
function htmlTitres(apercu, y) {
  const C = apercu ? {} : etatTitres(y), moi = moiPilote();
  return '<section class="vit" id="vit-titres"><h3 class="vit-h">⚔️ Les titres <small>à part · sans objet · ils se volent</small></h3>' +
    '<p class="info">Recalculés à chaque mois joué. Ils ne rapportent aucun point ni objet : seulement l\'honneur de les tenir, jusqu\'à ce qu\'un autre te les prenne.</p><div class="cour-l">' +
    TITRES.map(c => {
      const o = C[c.id], vide = apercu ? "À prendre dès janvier" : c.id === "flair" && !o ? (typeof TRESORS !== "undefined" && TRESORS && TRESORS.l && TRESORS.l.length ? "Personne pour l'instant" : "Non attribuée : pas encore de trésor") : "Personne pour l'instant";
      return '<div class="cour' + (o && o.nom === moi ? " a-moi" : "") + (o ? "" : " libre") + '" data-cour="' + c.id + '" style="--c:' + (o ? couleur(o.nom) : "var(--rule)") + ";--tc:" + c.c + '"><span class="cour-i" aria-hidden="true">' + emblemeTitre(c.id) + '</span><div class="cour-t"><b>' + esc(c.nom) + "</b><small>" + esc(c.def) + "</small></div>" +
        '<div class="cour-q">' + (o ? '<b>' + esc(o.nom) + "</b><small>depuis " + esc(moisLong(o.depuis)) + "</small><small>" + esc(o.txt) + "</small>" : "<small>" + esc(vide) + "</small>") + "</div></div>";
    }).join("") + "</div></section>";
}
/** L'onglet Trophées : 4 sous-onglets + « à part » (titres, Coupe brisée) */
function htmlVitrines() {
  const apercu = !saisonJouee(), noms = D.personnes.map(p => p.nom), moi = moiPilote(), y = anneesSaison().slice(-1)[0];
  const o = VIT_ONGLETS.some(z => z[0] === VIT_ONGLET) || VIT_ONGLET === "titres" ? VIT_ONGLET : "mondes";
  const corps = o === "succes" ? htmlSucces(apercu, noms, moi) : o === "gant" ? htmlGant(apercu, noms, moi, y) : o === "legendes" ? htmlLegendes(apercu, noms, moi) : o === "titres" ? htmlTitres(apercu, y) : htmlMondes(apercu, noms, moi);
  return (apercu ? '<div class="chauffe-b">🔥 <span>Aperçu : les trophées démarrent le 1<sup>er</sup> janvier 2027. Voici ce qui t\'attend.</span></div>' : "") +
    (D.premierMillion ? bandeauMillion() : "") +   /* v17.31 (Théo) : le bandeau « Premier millionnaire » n'apparaît qu'une fois le badge gagné, puis pour toujours */
    '<nav class="vit-tabs" role="tablist" aria-label="Trophées">' + VIT_ONGLETS.map(([id, ico, lib]) => '<button type="button" role="tab" data-vit="' + id + '" aria-selected="' + (o === id) + '"><span aria-hidden="true">' + ico + "</span>" + lib + "</button>").join("") + "</nav>" +
    '<div class="vit-apart"><small>À part, sans objet :</small><button type="button" data-vit="titres" aria-pressed="' + (o === "titres") + '">⚔️ Titres</button><button type="button" data-vit-coupe>🏆 Coupe brisée</button></div>' + corps;
}
/** Ouvrir un succès : sa médaille (selon son palier), l'objectif, les objets, qui l'a réussi (le premier doré, puis les autres) */
function ouvrirSucces(id) {
  if (id === "million") return ouvrirCarteMillion();
  const x = SUCCES.find(z => z.id === id); if (!x) return;
  const apercu = !saisonJouee(), r = apercu ? { or: null, autres: [], tous: [] } : rangsSucces(id), moi = moiPilote(), P = PALIERS[x.palier], cc = CARTES_COLL[id] || {}, idx = D.marche.indices[iRef()];
  const premier = !!(r.or && r.or.noms.includes(moi));
  const ov = document.createElement("div"); ov.className = "revel cc-ov sec-ov sc-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  const hist = (o, med) => '<li class="h-' + med + '" style="--c:' + couleur(o.nom) + '"><span>' + (med === "or" ? "🥇" : "🏅") + "</span><div><b>" + esc(o.nom) + (med === "or" ? ' <em class="h-1er">1<sup>er</sup></em>' : "") + "</b><small>" + esc(moisLong(o.k) + (histoireSecret(id, o) ? " · " + histoireSecret(id, o) : "")) + "</small></div></li>";
  const ors = r.or ? r.or.noms.map(n => r.tous.find(o => o.nom === n) || { nom: n, k: r.or.k }) : [];
  ov.innerHTML = '<div class="rv-c cc-c sc-c p-' + P.id + '"><span class="tuto-k">🏅 Succès · ' + P.ico + " " + esc(P.nom) + "</span>" +
    '<div class="sc-grand p-' + P.id + '">' + svgMedaille(x.palier, premier) + '<span class="cc-emo">' + x.ico + "</span></div>" +
    "<h3>" + esc(x.nom) + '</h3><p class="cc-cond"><b>Objectif :</b> ' + esc(x.def.replace("l'indice", "le " + idx)) + ".</p>" +
    '<ul class="sc-gains"><li>🎁 <b>Pour chacun qui réussit :</b> ' + esc(libGains([x.gain])) + "</li>" + (x.bonus ? "<li>🥇 <b>En plus, au premier seulement :</b> " + esc(libGains([x.bonus])) + " (exclusif), la version dorée et son nom gravé</li>" : "") + "</ul>" +
    (r.or ? '<p class="sec-histoire">📜 ' + esc(ligneHistoire(x, ors[0])) + '</p><ol class="sec-rangs">' + ors.map(o => hist(o, "or")).join("") + r.autres.map(o => hist(o, "arg")).join("") + "</ol>"
      : '<p class="cc-cond">' + (apercu ? "Il se joue dès janvier." : "Personne ne l'a encore réussi : le premier gagnera la version dorée et l'objet exclusif.") + "</p>") +
    (premier && cc.s ? '<p class="cc-s">📜 <i>' + esc(cc.s) + "</i></p>" : "") +
    '<div class="btn-row">' + (!apercu && reussi(id, moi) ? btnEquiper(...(premier && x.bonus ? x.bonus : x.gain)) : "") + '<button class="btn ' + (!apercu && reussi(id, moi) && btnEquiper(...x.gain) ? "ghost" : "acc") + '" type="button" data-cc="ok">Fermer</button></div></div>';
  document.body.appendChild(ov);
  const t0 = Date.now(), fermer = () => ov.remove();
  ov.addEventListener("click", e => { if (e.target === ov && Date.now() - t0 > 600) fermer(); });
  ov.querySelector('[data-cc="ok"]').addEventListener("click", fermer);
}
/** (ancien nom) */
function ouvrirSecret(id) { return ouvrirSucces(id); }
function ouvrirCarteColl(id) { ouvrirSucces(id); }
function ouvrirCarteMillion() {
  const pm = D.premierMillion, cc = CARTES_COLL.million, mo = mondeDeNiv(4), o = pm ? [pm.nom] : [];
  const ov = document.createElement("div"); ov.className = "revel cc-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = '<div class="rv-c cc-c" style="--mc:' + mo.c + '"><span class="tuto-k">👑 Premier millionnaire</span><div class="cc-flip"><div class="cc-in"><div class="cc-dos"><span>' + mo.ico + '</span></div><div class="cc-face">' + htmlCarteColl("million", "g", o) + "</div></div></div>" +
    '<p class="cc-a">« ' + esc(cc.a) + " »</p>" + (o.length ? '<p class="pl-pris" style="--c:' + couleur(o[0]) + '">🏁 À <b>' + esc(o[0]) + "</b>, pour toujours.</p>" : "") +
    (o.includes(moiPilote()) ? '<p class="cc-s">📜 <i>' + esc(cc.s) + "</i></p>" : "") + '<div class="btn-row"><button class="btn acc" type="button" data-cc="ok">Fermer</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('[data-cc="ok"]').addEventListener("click", () => ov.remove());
}
/** Un monde : sa carte en grand, le mini-jeu du mois, ses objets, qui l'a */
function ouvrirMonde(id) {
  const t = TROPHEES_MONDES.find(x => x.id === id); if (!t) return;
  const noms = D.personnes.map(p => p.nom), apercu = !saisonJouee(), moi = moiPilote(), T = apercu ? null : etatTropheesMondes(), u = univers(t.univers);
  const qui = T ? noms.filter(n => T[t.id][n].ok) : [], best = T ? noms.map(n => T[t.id][n].meilleur).find(Boolean) : null, aVenir = !T || T[t.id][noms[0]].aVenir;
  const e0 = T ? T[t.id][moi] || T[t.id][noms[0]] : {}, ex = e0.objet && ITEMS[e0.objet[0]] && ITEMS[e0.objet[0]][e0.objet[1]] ? e0.objet : null;
  const jouer = !aVenir && e0.etat === "en-cours" && typeof allerCarteMJ === "function";   // 🎲 le monde du mois : on va jouer (page Course, sur la carte)
  const ov = document.createElement("div"); ov.className = "revel cc-ov mo-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = '<div class="rv-c cc-c mo-c"><span class="tuto-k">🗺️ Monde de ' + esc(MOIS_L[t.mois - 1]) + (u ? " · " + u.drap + " " + esc(u.nom) : "") + "</span>" +
    '<div class="mo-carte">' + htmlCaseMonde(t, apercu, noms, moi) + "</div>" +
    '<p class="cc-cond">' + (e0.trophee && !aVenir ? "Trophée " + esc(e0.trophee.ico + " « " + e0.trophee.nom + " »") + " : r" : "R") + "éussissez <b>ensemble</b> l'objectif commun du <b>mini-jeu</b> de " + esc(MOIS_L[t.mois - 1]) + " : le trophée est alors à chacun.</p>" +
    '<ul class="sc-gains"><li>🎁 <b>Objets du monde, pour chacun :</b> ' + esc(libGains(t.gain)) + "</li><li>🌟 <b>Le meilleur du mois</b> : " + (e0.titre && !aVenir ? "le surnom du mois « " + esc(e0.titre) + " »" : "son surnom du mois") + (ex ? " et l'exclusif doré " + esc(libGains([ex])) : " et la feuille d'or sur sa carte") + ".</li></ul>" +
    (!aVenir && e0.etat === "en-cours" ? '<p class="cc-cond mo-encours">🤝 <b>Objectif commun : ' + esc(e0.c > 1 ? e0.p + " / " + e0.c : e0.txt || "en cours") + "</b>, jusqu'au " + new Date(new Date().getFullYear(), t.mois, 0).getDate() + " " + esc(MOIS_L[t.mois - 1]) + ".</p>" : "") +
    (aVenir ? '<p class="cc-cond">🔒 Le mini-jeu se dévoile en ' + esc(MOIS_L[t.mois - 1]) + ".</p>"
      : '<p class="cc-cond">' + (qui.length ? "✓ Déjà réussi par " + esc(qui.join(", ")) : "Personne ne l'a encore réussi") + (best ? " · 🌟 meilleur du mois : " + esc(best.nom) + (best.txt ? " (« " + esc(best.txt) + " »)" : "") : "") + ".</p>") +
    '<div class="btn-row">' + (jouer ? '<button class="btn acc" type="button" data-mo-jouer>🎲 Jouer aujourd\'hui</button>' : "") + (!aVenir && qui.includes(moi) ? btnEquiper(...t.gain[0], jouer ? "ghost" : "acc") : "") + '<button class="btn ' + (jouer ? "ghost" : "acc") + '" type="button" data-cc="ok">Fermer</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('[data-cc="ok"]').addEventListener("click", () => ov.remove());
  const j = ov.querySelector("[data-mo-jouer]"); if (j) j.addEventListener("click", () => { ov.remove(); allerCarteMJ(); });
}
function ouvrirBadge(id) { return ouvrirMonde(id); }
function brancherVitrines(v) {
  v.querySelectorAll("[data-vit]").forEach(b => b.addEventListener("click", () => { VIT_ONGLET = b.dataset.vit; rendreTrophees(); const n = document.querySelector(".vit-tabs"); if (n && n.getBoundingClientRect().top < 0) n.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); }));
  v.querySelectorAll("[data-vit-coupe]").forEach(b => b.addEventListener("click", () => {
    if (typeof ouvrirCoupe !== "function") return;
    if (typeof coupeDonnees === "function" && coupeDonnees()) return ouvrirCoupe();
    if (typeof chargerTresors === "function") chargerTresors().then(() => { if (typeof coupeDonnees === "function" && coupeDonnees()) ouvrirCoupe(); else toast("🏆 La Coupe brisée se reconstitue avec les trésors des circuits : rien à montrer pour l'instant."); }).catch(() => toast("Coupe indisponible pour l'instant."));
  }));
  v.querySelectorAll("[data-succes]").forEach(b => b.addEventListener("click", () => ouvrirSucces(b.dataset.succes)));
  v.querySelectorAll("[data-monde]").forEach(b => b.addEventListener("click", () => ouvrirMonde(b.dataset.monde)));
  // le Flair a besoin des trésors (qui a trouvé quoi) : on les charge, puis on redessine une fois
  if (saisonJouee() && VIT_ONGLET === "titres" && typeof chargerTresors === "function" && typeof TRESORS !== "undefined" && !TRESORS) chargerTresors().then(() => { if (TRESORS && vueActive() === "trophees" && ongletPodium() === "defis") rendreTrophees(); }).catch(() => {});
  // v20.47 · 🎫 le ticket d'or (badges, Légendes, plaque) : chargé à partir d'octobre 2027, puis on redessine une fois
  if (saisonJouee() && typeof chargerTickets === "function" && !TICKETS && Date.now() >= TICKET_MOIS.debut.getTime()) chargerTickets().then(() => { if (TICKETS && vueActive() === "trophees" && ongletPodium() !== "gp") rendreTrophees(); }).catch(() => {});
}
/** v20.61 · 🏆 nombre d'éclats de la Coupe brisée trouvés par un pilote : un éclat = le trésor d'un circuit de la saison trouvé par lui
 *  (classement public des chercheurs, TRESORS.l[].chercheurs : qui et quand, jamais où ni quoi). null tant que les trésors ne sont pas chargés. */
function eclatsDe(nom) {
  const T = typeof TRESORS !== "undefined" && TRESORS && TRESORS.l; if (!T || (typeof TRESOR_APERCU !== "undefined" && TRESOR_APERCU)) return null;
  return T.filter(t => CAL_GP.includes(t.circuit) && (!t.saison || t.saison >= SAISON.premiere) && (t.chercheurs || []).some(x => x.nom === nom)).length;
}
/* La vitrine d'un pilote (fiche du Classement) : ses succès (dorés en premier), ses mondes, son Gant, ses titres */
function vitrineFiche(nom) {
  if (typeof saisonJouee !== "function" || !saisonJouee()) return "";   // v17.5 : pas de vitrine pendant le tour de chauffe (date, pas onglet)
  const pm = D.premierMillion, ors = exclusifsDe(nom), suiv = succesSuivantDe(nom);
  const TM = etatTropheesMondes(), nT = TROPHEES_MONDES.filter(t => TM[t.id][nom] && TM[t.id][nom].ok).length, y = anneesSaison().slice(-1)[0], g = (etatGant(y)[nom] || { n: 0 }).n, C = etatTitres(y);
  const ne = eclatsDe(nom);   // v20.61 · 🏆 combien d'éclats de la Coupe brisée ce pilote a trouvés (un nombre, jamais leur contenu)
  if (ne === null && typeof chargerTresors === "function") chargerTresors().then(() => { if (eclatsDe(nom) !== null && vueActive() === "fiche") rendreVue("fiche"); }).catch(() => {});
  const puces = ['<span style="--mc:#B9C3CE">🗺️ ' + nT + " / 12 mondes</span>", '<span style="--mc:#9B6BFF">🧤 ' + g + " / 6 pierres</span>"]
    .concat(ne === null ? [] : ['<span class="vt-eclats" style="--mc:#E8B640" title="Éclats de la Coupe brisée trouvés par ' + esc(nom) + '">🏆 ' + ne + " / 12 éclats</span>"])
    .concat(TITRES.filter(c => C[c.id] && C[c.id].nom === nom).map(c => '<span style="--mc:' + c.c + '">' + c.ico + " " + esc(c.nom) + "</span>"));
  const med = (x, premier) => '<button type="button" class="vt-med p-' + PALIERS[x.palier].id + '" data-carte-coll="' + x.id + '" title="' + esc(x.nom) + '">' + svgMedaille(x.palier, premier) + '<span class="cc-emo">' + x.ico + "</span></button>";
  return '<div class="vitrine">' + (plaqueDe(nom) ? '<div class="vt-plaque">' + plaqueDe(nom).replace('class="plaque', 'class="plaque grande') + "</div>" : "") + '<div class="vt-h"><b>🗄️ La vitrine de ' + esc(nom) + "</b><small>" + (ors.length + suiv.length) + " succès sur 12 · " + ors.length + " en premier 🥇</small></div>" + palmaresVitrine(nom) +
    (ors.length + suiv.length || pm && pm.nom === nom ? '<div class="vt-meds">' + (pm && pm.nom === nom ? '<button type="button" class="vt-med p-legende" data-carte-coll="million" title="Premier millionnaire"><span class="cc-emo">👑</span></button>' : "") + ors.map(x => med(x, true)).join("") + suiv.map(x => med(x, false)).join("") + "</div>" : '<p class="info">Pas encore de succès : le premier qui en réussit un grave son nom dessus.</p>') +
    '<div class="vt-badges">' + puces.join("") + "</div></div>";
}
/* Animations du showroom : la voiture démarre au klaxon, rebondit quand on change un objet */
function demarrer(v) {
  if (v && v.id === "garage" && V3D.gar && v.querySelector("canvas.v3d")) { V3D.gar.boost(); return; }
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
  if (equip.teintes) { Object.keys(equip.teintes).forEach(s => { if (equip[s]) equip[s] = ecrireTeinte(s, equip[s], equip.teintes[s]); }); delete equip.teintes; }   // v20.70 · 🎨 « rayures » + or → « rayuresor » (serveur V91 : 2 à 16 lettres)
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
  v.querySelectorAll("[data-pod]").forEach(b => b.addEventListener("click", () => { ETAT.podium = b.dataset.pod; ECU_NOUV = null; if (b.dataset.pod === "stand") { const r = rappelCartes(); if (r && !kOuvertPour(saisonCourante())) choisirSaison(r.y); } garder(); rendreTrophees(); }));
  v.querySelectorAll("[data-saison]").forEach(b => b.addEventListener("click", () => { choisirSaison(+b.dataset.saison); rendreTrophees(); }));
  const y = saisonCourante();
  const o = ongletPodium();
  if (typeof majPastilleMJ === "function") majPastilleMJ();   // 🎲 pastille du mini-jeu du jour (js/9-minijeux.js)
  if (o === "defis") brancherVitrines(v);
  if (o === "gp") { brancherGP(v, y); const dp = v.querySelector("#pts-det"); dessinerChampionnat(y); if (dp) dp.addEventListener("toggle", () => { ETAT.ptsOuvert = dp.open ? "1" : "0"; garder(); }); }
  if (o === "stand") brancherStand(v, y);
  v.querySelectorAll("[data-aller-stand]").forEach(b => b.addEventListener("click", () => { const r = rappelCartes(); if (r) choisirSaison(r.y); ETAT.podium = "stand"; garder(); rendreTrophees(); const t = document.querySelector(".pod-tabs"); if (t) t.scrollIntoView({ block: "start", behavior: "smooth" }); }));
  if (!stock.get("versus.tuto1")) { stock.set("versus.tuto1", "1"); etapesJeu().filter(e => aujNum() >= annonceEtape(e)).forEach(e => stock.set("versus.nouveaute." + e.id, "1")); }   // v17.17 (Théo) : plus de « Podium en bref » à la première ouverture
  else setTimeout(verifierRevelation, 500);
  bandesDefilantes(v); expliquerBadges(v);
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
  // v20.48 · la même F1 3D que la course (piste.js) ; sans WebGL, le dessin 2D reste affiché
  // v20.80 (Théo) · bouton « Voir en 2D » : retour au dessin d'origine, choix gardé sur l'appareil (3D par défaut)
  if (ecuVue2D()) { try { if (V3D.inst) { V3D.yaw = V3D.inst.yaw(); V3D.inst.stop(); V3D.inst = null; } if (V3D.gar) { V3D.gar.stop(); V3D.gar = null; } } catch (e) { /* rien */ } }
  else {
  const s3 = v.querySelector("#sr-3d"); if (s3 && ECU) { try { monter3D(s3, ECU.nom, ECU.e); } catch (e) { /* le dessin 2D reste affiché */ } }
  const g3 = v.querySelector("#gar-3d"); if (g3 && ECU_VOIR) { try { if (V3D.gar) V3D.gar.stop(); V3D.gar = monter3D(g3, ECU_VOIR, ECU_VOIR === ECU.nom ? ECU.e : equipDe(ECU_VOIR), true); } catch (e) { /* idem */ } }
  }
  v.querySelectorAll("[data-ecu-vue]").forEach(b => b.addEventListener("click", () => { try { stock.set("versus.ecuVue", ecuVue2D() ? "3d" : "2d"); } catch (e) { /* rien */ } rendreTrophees(); }));
  const kl = v.querySelector("#ecu-klaxon"); if (kl) kl.addEventListener("click", () => { confettis(ECU.e.klaxon); demarrer(v); });
  const g = v.querySelector("#ecu-garder"); if (g) g.addEventListener("click", garderEcurie);
  v.querySelectorAll("[data-teinte]").forEach(b => b.addEventListener("click", () => {   // v20.70 · 🎨
    const s = ECU_SLOT, t = b.dataset.teinte; if (!ECU || !teintesDe(s, ECU.e[s])) return;
    const T = Object.assign({}, ECU.e.teintes || {});
    if (s === "finition" && (t === "blanc" || t === "noir")) { ECU.e.finition = "lis" + t; delete T.finition; }
    else if (t === teinteDefaut(s, ECU.e[s])) delete T[s]; else T[s] = t;
    ECU.e.teintes = T; rendreTrophees(); popVoiture(); }));
  const hz = v.querySelector("#ecu-hasard"); if (hz) hz.addEventListener("click", () => { if (!ECU) return; ECU.e = tenueAuHasard(ECU.nom, ECU.e); ECU_Q = null; rendreTrophees(); popVoiture(); demarrer(v); });
  const rt = v.querySelector("#ecu-retour"); if (rt) rt.addEventListener("click", () => { ECU = null; ECU_Q = null; rendreTrophees(); toast("↩️ Ta tenue enregistrée est revenue."); });
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

