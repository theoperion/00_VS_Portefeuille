/* Versus · bilan de l'année, réglages, onglet Moi, saisie du relevé (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   BILAN DE L'ANNÉE (façon « Wrapped »)
   Disponible pour chaque année dont le relevé de décembre est complet.
   Calculé sur le portefeuille total, rien n'est stocké.
   ============================================================ */
function anneesBilan() {
  const ks = moisVerdict(0);
  return [...new Set(ks.map(k => Math.floor(k / 100)))].filter(y => ks.includes(y * 100 + 12) && verdictMois(0, y * 100 + 12).complet);
}
function banniereBilan() {
  const fin = finGlobale(D, 0); if (!fin) return "";
  const now = new Date(), y = now.getFullYear() - 1;
  if (now.getMonth() !== 0 || now.getDate() > 15 || !anneesBilan().includes(y)) return banniereRecap();
  return '<div class="bilan-pret"><div><b>🎁 Le bilan ' + y + " est prêt</b><small>Podium, champions, records, duels : l'année en " + "quelques écrans.</small></div>" +
    '<button class="wr-btn" type="button" data-bilan="' + y + '" style="background:var(--accent);color:#fff">Ouvrir</button></div>';
}
/* ---------- Premier millionnaire : badge unique, le goal ultime du groupe ---------- */
function couronne(nom) { return D && D.premierMillion && D.premierMillion.nom === nom ? '<span class="couronne" title="Premier millionnaire">👑</span>' : ""; }
function texteMillion() {
  const pm = D && D.premierMillion;
  return pm ? "👑 " + pm.nom + " est le premier millionnaire du groupe (" + isoFr(pm.date) + "). Ce badge est unique : personne d'autre ne l'aura."
    : "👑 Premier millionnaire : badge secret et unique. Le premier à 1 000 000 € de patrimoine financier le garde pour toujours. Personne ne voit où en sont les autres.";
}
function bandeauMillion() {
  const pm = D && D.premierMillion;
  return '<button class="million-strip' + (pm ? " pris" : "") + '" type="button" id="info-million-t"><span class="mc">👑</span><span><b>Premier millionnaire</b><small>' +
    (pm ? esc(pm.nom) + " · depuis le " + esc(isoFr(pm.date)) + " · badge unique" : "badge secret · à prendre · le premier à 1 000 000 € le garde pour toujours") + "</small></span></button>";
}
/* ---------- Bilans (onglet Mois) : récaps du mois pour tous, bilans de l'année pour tous ---------- */
function moisRecap() { return moisVerdict(0).filter(k => { const v = verdictMois(0, k); return v && v.complet; }).slice().reverse().slice(0, 12); }
function blocBilans() {
  const onglet = ETAT.bilans === "annuel" ? "annuel" : "mensuel";
  const ms = moisRecap(), ys = anneesBilan(), vu = Number(stock.get("versus.recapVu") || 0);
  let corps;
  const plus = (id, ouvert, n) => '<button class="lien voir-plus" type="button" id="' + id + '">' + (ouvert ? "Voir moins" : "Voir plus (" + n + ")") + "</button>";
  if (onglet === "mensuel") {
    const visibles = ETAT.recapsTous ? ms : ms.slice(0, 2);
    corps = ms.length ? '<div class="bilans">' + visibles.map((k, j) => '<button class="bilan-b" type="button" data-recap="' + k + '">' + (j === 0 && k > vu ? '<span class="nouveau">nouveau</span>' : "📅 ") + esc(moisLong(k)) + "</button>").join("") + "</div>" +
      (ms.length > 2 ? plus("recaps-tous", ETAT.recapsTous, ms.length - 2) : "") : '<p class="info">Le premier récap arrive quand tous les relevés d\'un mois sont saisis.</p>';
  } else {
    const annees = ys.slice().sort((a, b) => b - a), vis = ETAT.bilansTous ? annees : annees.slice(0, 2);
    corps = annees.length ? '<div class="bilans">' + vis.map(y => '<button class="bilan-b" type="button" data-bilan="' + y + '">🎁 Bilan ' + y + "</button>").join("") + "</div>" +
      (annees.length > 2 ? plus("bilans-tous", ETAT.bilansTous, annees.length - 2) : "") : '<p class="info">Le premier bilan de l\'année arrive avec le relevé de décembre.</p>';
  }
  return '<section class="bilans-bloc"><div class="bilans-h"><h2 class="sec">Bilans</h2><div class="seg" role="group" aria-label="Bilans"><button type="button" data-bil="mensuel" aria-pressed="' + (onglet === "mensuel") + '">Mensuel</button><button type="button" data-bil="annuel" aria-pressed="' + (onglet === "annuel") + '">Annuel</button></div></div>' + corps + "</section>";
}
function brancherBilans(v0) {
  const v = v0.querySelector(".bilans-bloc") || v0, re = () => rendreVue(vueActive());
  v.querySelectorAll("[data-bil]").forEach(b => b.addEventListener("click", () => { ETAT.bilans = b.dataset.bil; garder(); re(); }));
  v.querySelectorAll("[data-recap]").forEach(b => b.addEventListener("click", () => ouvrirRecap(+b.dataset.recap)));
  const rt = v.querySelector("#recaps-tous"); if (rt) rt.addEventListener("click", () => { ETAT.recapsTous = !ETAT.recapsTous; garder(); re(); });
  const bt = v.querySelector("#bilans-tous"); if (bt) bt.addEventListener("click", () => { ETAT.bilansTous = !ETAT.bilansTous; garder(); re(); });
  v.querySelectorAll("[data-bilan]").forEach(b => b.addEventListener("click", () => ouvrirBilan(+b.dataset.bilan)));
}
/* Performance du mois d'une ligne partagée : cours de fin de mois contre celui du mois précédent, sinon la variation sur 1 mois envoyée avec */
function lignesDe(nom, k) {
  const L = (D.lignes || {})[nom] || {}, cur = L[k], prev = L[cleMoins(k, 1)];
  if (!cur) return null;
  const tot = cur.lignes.reduce((a, l) => a + (l.valeur || 0), 0) || 1;
  return { date: cur.date, lignes: cur.lignes.map(l => {
    const p = prev && prev.lignes.find(x => x.code === l.code && x.env === l.env);
    const r = p && p.cours > 0 && l.cours > 0 ? l.cours / p.cours - 1 : ok(l.m1) ? l.m1 : null;
    return Object.assign({ r, poids: (l.valeur || 0) / tot }, l);
  }).sort((a, b) => b.valeur - a.valeur) };
}
function ouvrirRecap(k) {
  const v = verdictMois(0, k); if (!v) return;
  stock.set("versus.recapVu", String(Math.max(k, Number(stock.get("versus.recapVu") || 0))));
  const nb = v.du.length, iR = v.iR, nomI = D.marche.indices[ETAT.i1];
  const L = [], cls = x => sens(x) === "flat" ? "" : sens(x);
  // 1. ouverture
  L.push({ c: "#9B87FF", h: '<div class="wr-k">Récap du mois · ' + nb + ' joueurs</div><div class="wr-big titre">' + esc(MOIS_L[k % 100 - 1]) + "<br>" + Math.floor(k / 100) + '</div><p class="wr-p">' + (ok(iR) ? esc(nomI) + " a fait <b>" + pct(iR) + "</b> ce mois-ci. " : "") + "Voyons qui a fait mieux.</p>" });
  // 2. podium
  L.push({ c: couleur(v.du[0].nom), h: '<div class="wr-k">Le podium du mois</div><div class="wr-l">' + v.du.map((x, j) => '<div class="wr-r"><span class="rk">' + (j + 1) + '</span><b style="color:' + couleur(x.nom) + '">' + esc(x.nom) + '</b><span class="wr-n ' + cls(x.r) + '">' + pct(x.r) + "</span></div>").join("") +
    (ok(iR) ? '<div class="wr-r fant"><span class="rk">·</span><b>' + esc(nomI) + '</b><span class="wr-n">' + pct(iR) + "</span></div>" : "") + "</div>" });
  // 3. chacun son mois, avec ses lignes
  const toutes = [];
  v.du.forEach((x, j) => {
    const p = D.personnes.find(q => q.nom === x.nom), s = serie(p, 0), cur = s.find(z => z.k === k) || {};
    const rg = rangs(0, debAnnee(k), k)[x.nom];
    const li = lignesDe(x.nom, k);
    if (li) li.lignes.forEach(l => toutes.push(Object.assign({ qui: x.nom }, l)));
    const lignes = li ? '<div class="wr-l">' + li.lignes.slice(0, 8).map(l => '<div class="wr-r"><span class="rk" style="font-size:12px">' + F0.format(l.poids * 100) + ' %</span><b style="font-size:16px">' + esc(l.code) + "<small>" + esc(l.nom || l.env) + '</small></b><span class="wr-n ' + cls(l.r) + '">' + (ok(l.r) ? pct(l.r) : "—") + "</span></div>").join("") + "</div>" +
      (li.lignes.length > 8 ? '<p class="wr-aide">+ ' + (li.lignes.length - 8) + " autres lignes</p>" : "") + '<p class="wr-aide">Lignes au ' + esc(isoFr(li.date)) + " · % = poids dans son portefeuille</p>"
      : '<p class="wr-aide">Lignes non partagées ce mois-ci.</p>';
    L.push({ c: couleur(x.nom), h: '<div class="wr-k">' + (j + 1) + (j ? "e" : "er") + " du mois" + (rg ? " · " + rg + (rg > 1 ? "e" : "er") + " sur l'année" : "") + '</div><div class="wr-mid" style="color:' + couleur(x.nom) + '">' + esc(x.nom) + '</div><div class="wr-big ' + cls(x.r) + '">' + pct(x.r) + "</div>" +
      '<p class="wr-p">Portefeuille : <b>' + eur(cur.val) + "</b>" + (cur.verse ? " · versé ce mois-ci : <b>" + eur(cur.verse) + "</b>" : "") + (ok(iR) ? " · " + (x.r > iR ? "devant" : "derrière") + " " + esc(nomI) : "") + ".</p>" + lignes });
  });
  // 4. lignes stars (seulement si des lignes sont partagées)
  const avecR = toutes.filter(l => ok(l.r));
  if (avecR.length >= 2) {
    const tri = avecR.slice().sort((a, b) => b.r - a.r), top = tri[0], flop = tri[tri.length - 1];
    const parCode = Object.create(null); toutes.forEach(l => { (parCode[l.code] = parCode[l.code] || new Set()).add(l.qui); });   // sans prototype : un code « __proto__ » ne casse rien
    const commune = Object.entries(parCode).sort((a, b) => b[1].size - a[1].size)[0];
    L.push({ c: "#F5C542", h: '<div class="wr-k">Les lignes du mois</div><div class="wr-g">' +
      '<div class="wr-c"><span>⭐ Ligne star</span><b class="up">' + esc(top.code) + '</b><em>' + pct(top.r) + " · chez " + esc(top.qui) + "</em></div>" +
      '<div class="wr-c"><span>🥶 Ligne glacée</span><b class="down">' + esc(flop.code) + '</b><em>' + pct(flop.r) + " · chez " + esc(flop.qui) + "</em></div>" +
      (commune && commune[1].size > 1 ? '<div class="wr-c" style="grid-column:1/-1"><span>🤝 La plus partagée</span><b>' + esc(commune[0]) + "</b><em>détenue par " + [...commune[1]].map(esc).join(", ") + "</em></div>" : "") +
      "</div>" });
  }
  L.push({ c: "#9B87FF", h: '<div class="wr-k">À suivre</div><div class="wr-mid">Rendez-vous fin ' + esc(MOIS_L[cleMoins(k, -1) % 100 - 1]) + '</div><p class="wr-p">Chaque récap reste dans l\'onglet Mois › Bilans.</p><button class="wr-btn" type="button" data-wr-fermer>Fermer</button>' });
  ouvrirDiapos("Récap · " + moisLong(k), L);
}
/* Bandeaux sur le Classement : récap du mois (jusqu'au 5 du mois suivant, tant qu'il n'est pas ouvert) et bilan annuel (1er-15 janvier) */
function banniereRecap() {
  const k = moisRecap()[0]; if (!k) return "";
  const now = new Date(), limite = new Date(Math.floor(cleMoins(k, -1) / 100), cleMoins(k, -1) % 100 - 1, 6);
  if (now >= limite || Number(stock.get("versus.recapVu") || 0) >= k) return "";
  return '<button class="bandeau-bilan" type="button" data-aller-recap="' + k + '"><span>📅 Le récap de ' + esc(MOIS_L[k % 100 - 1]) + " est dispo</span><b>Mois ›</b></button>";
}
function bilanAnnee(y) {
  const env = 0, deb = (y - 1) * 100 + 12, f = y * 100 + 12, i1 = ETAT.i1;
  const st = D.personnes.map(p => stats(D, p, env, deb, f, i1, null)).filter(s => s.n > 0).sort((a, b) => b.twr - a.twr);
  const idx = statsIndice(D, i1, deb, f);
  const mois = moisVerdict(env).filter(k => k > deb && k <= f);
  const champ = {}, enTete = {}, records = {};
  st.forEach(s => { champ[s.nom] = 0; enTete[s.nom] = 0; records[s.nom] = { n: 0, de: null, a: null }; });
  let meilleur = null, pire = null, serre = null, ecart = null, prec = null, courant = 0, debut = null;
  mois.forEach(k => {
    const du = rendementsDuMois(env, k).filter(x => x.nom in champ).sort((a, b) => b.r - a.r);
    if (du.length < 2) return;
    const gagnant = du[0].r - du[1].r > 1e-9 ? du[0].nom : null;
    if (gagnant) champ[gagnant]++;
    if (gagnant && gagnant === prec) courant++; else { courant = gagnant ? 1 : 0; debut = k; }
    if (gagnant && courant > records[gagnant].n) records[gagnant] = { n: courant, de: debut, a: k };
    prec = gagnant;
    du.forEach(x => { if (!meilleur || x.r > meilleur.r) meilleur = Object.assign({ k }, x); if (!pire || x.r < pire.r) pire = Object.assign({ k }, x); });
    const g = du[0].r - du[du.length - 1].r;
    if (!serre || g < serre.g) serre = { k, g };
    if (!ecart || g > ecart.g) ecart = { k, g, haut: du[0], bas: du[du.length - 1] };
    const r = rangs(env, deb, k); const l = Object.keys(r).find(n => r[n] === 1); if (l && l in enTete) enTete[l]++;
  });
  return { y, deb, f, st, idx, mois, champ, enTete, records, meilleur, pire, serre, ecart, i1nom: D.marche.indices[i1] };
}

function diapos(b) {
  const moi = b.st.find(s => s.nom === ETAT.moi);
  const C = n => couleur(n), nb = b.st.length;
  const cls = v => sens(v) === "flat" ? "" : sens(v);
  const L = [];
  // 1. ouverture
  L.push({ c: "#9B87FF", h: '<div class="wr-k">Versus · ' + nb + " joueurs · " + b.mois.length + ' mois</div><div class="wr-big">Le bilan<br>' + b.y + '</div><p class="wr-p">Une année de relevés, de victoires et de vannes. Touche à droite pour avancer, à gauche pour revenir.</p>' });
  // 2. podium
  const v = b.st[0];
  L.push({ c: C(v.nom), h: '<div class="wr-k">Le vainqueur de ' + b.y + '</div><div class="wr-big" style="color:' + C(v.nom) + '">' + esc(v.nom) + '</div><div class="wr-l">' +
    b.st.map((s, i) => '<div class="wr-r"><span class="rk">' + (i + 1) + '</span><b style="color:' + C(s.nom) + '">' + esc(s.nom) + "<small>" + s.n + " mois" + (s.i1 ? " · " + pts(s.twr - s.i1.twr) + " vs " + esc(b.i1nom) : "") + '</small></b><span class="wr-n ' + cls(s.twr) + '">' + pct(s.twr) + "</span></div>").join("") +
    (b.idx ? '<div class="wr-r fant"><span class="rk">·</span><b>' + esc(b.idx.nom) + '<small>indice de référence</small></b><span class="wr-n">' + pct(b.idx.twr) + "</span></div>" : "") + "</div>" });
  // 3. ton année
  if (moi) {
    const rang = b.st.indexOf(moi) + 1;
    L.push({ c: C(moi.nom), h: '<div class="wr-k">Ton année, ' + esc(moi.nom) + '</div><div class="wr-big ' + cls(moi.twr) + '">' + pct(moi.twr) + '</div><p class="wr-p">' + (rang === 1 ? "<b>Tu termines premier.</b> Rien à ajouter." : "Tu termines <b>" + rangTxt(rang) + "</b> sur " + nb + ", à " + pts(moi.twr - b.st[0].twr).replace(/^[−-]/, "") + " de " + esc(b.st[0].nom) + ".") + '</p><div class="wr-g">' +
      '<div class="wr-c"><span>Meilleur mois</span><b class="' + cls(moi.meilleur.r) + '">' + pct(moi.meilleur.r) + "</b><em>" + esc(moisLong(moi.meilleur.k)) + "</em></div>" +
      '<div class="wr-c"><span>Pire mois</span><b class="' + cls(moi.pire.r) + '">' + pct(moi.pire.r) + "</b><em>" + esc(moisLong(moi.pire.k)) + "</em></div>" +
      '<div class="wr-c"><span>Mois positifs</span><b>' + Math.round(moi.positifs * moi.n) + " / " + moi.n + "</b><em>" + (moi.i1 ? esc(b.i1nom) + " battu " + Math.round(moi.i1.battus * moi.i1.n) + " fois" : "") + "</em></div>" +
      '<div class="wr-c"><span>Plus-value de l\'année</span><b class="' + cls(moi.pvPeriode) + '">' + eur(moi.pvPeriode, 0, true) + "</b><em>" + eur(moi.versePeriode) + " versés</em></div>" +
      "</div>" });
  }
  // 4. champions du mois
  const ch = b.st.map(s => s.nom).sort((a, x) => b.champ[x] - b.champ[a] || b.enTete[x] - b.enTete[a]);
  const rec = ch.map(n => Object.assign({ nom: n }, b.records[n])).sort((a, x) => x.n - a.n)[0];
  L.push({ c: "#F5C542", h: '<div class="wr-k">🏆 Champions du mois</div><div class="wr-mid">Qui a raflé le plus de mois ?</div><div class="wr-l">' +
    ch.map(n => '<div class="wr-r"><span class="rk">★</span><b style="color:' + C(n) + '">' + esc(n) + "<small>" + b.enTete[n] + " mois en tête du classement de l'année</small></b><span class=\"wr-n\">" + b.champ[n] + "</span></div>").join("") + "</div>" +
    (rec && rec.n >= 2 ? '<p class="wr-p">Plus longue série : <b style="color:' + C(rec.nom) + '">' + esc(rec.nom) + "</b>, " + rec.n + " mois d'affilée (" + esc(moisCourt(rec.de)) + " → " + esc(moisCourt(rec.a)) + ").</p>" : "") });
  // 5. les moments
  L.push({ c: "#2FD1C0", h: '<div class="wr-k">Les moments de ' + b.y + '</div><div class="wr-g">' +
    (b.meilleur ? '<div class="wr-c"><span>🚀 Plus gros mois</span><b class="up">' + pct(b.meilleur.r) + '</b><em style="color:' + C(b.meilleur.nom) + '">' + esc(b.meilleur.nom) + "</em><em>" + esc(moisLong(b.meilleur.k)) + "</em></div>" : "") +
    (b.pire ? '<div class="wr-c"><span>🥶 Pire chute</span><b class="' + cls(b.pire.r) + '">' + pct(b.pire.r) + '</b><em style="color:' + C(b.pire.nom) + '">' + esc(b.pire.nom) + "</em><em>" + esc(moisLong(b.pire.k)) + "</em></div>" : "") +
    (b.serre ? '<div class="wr-c"><span>🤏 Mois le plus serré</span><b>' + pts(b.serre.g).replace(/^\+/, "") + "</b><em>entre le 1er et le dernier</em><em>" + esc(moisLong(b.serre.k)) + "</em></div>" : "") +
    (b.ecart ? '<div class="wr-c"><span>💥 Plus grand écart</span><b>' + pts(b.ecart.g).replace(/^\+/, "") + "</b><em>" + esc(b.ecart.haut.nom) + " / " + esc(b.ecart.bas.nom) + "</em><em>" + esc(moisLong(b.ecart.k)) + "</em></div>" : "") +
    "</div>" });
  // 7. les duels
  const qui = moi ? moi.nom : b.st[0].nom;
  const duels = b.st.filter(s => s.nom !== qui).map(s => duel(0, qui, s.nom, b.deb, b.f)).filter(d => d && d.n);
  if (duels.length) L.push({ c: C(qui), h: '<div class="wr-k">⚔️ Les duels de ' + esc(qui) + '</div><div class="wr-mid">Mois gagnés en face à face</div><div class="wr-l">' +
    duels.map(d => '<div class="wr-r"><span class="rk">vs</span><b style="color:' + C(d.b) + '">' + esc(d.b) + "<small>" + (d.wa > d.wb ? "gagné" : d.wa < d.wb ? "perdu" : "égalité") + (d.nuls ? " · " + d.nuls + " nul" + (d.nuls > 1 ? "s" : "") : "") + '</small></b><span class="wr-n">' + d.wa + " – " + d.wb + "</span></div>").join("") + "</div>" });
  // 8. face au marché
  if (b.idx) {
    const bat = b.st.filter(s => s.i1 && s.twr > s.i1.twr);
    L.push({ c: "#6B7380", h: '<div class="wr-k">📈 Face au marché</div><div class="wr-mid">' + esc(b.i1nom) + " : " + pct(b.idx.twr) + '</div><p class="wr-p">' +
      (bat.length ? "<b>" + bat.map(s => '<span style="color:' + C(s.nom) + '">' + esc(s.nom) + "</span>").join(", ") + "</b> " + (bat.length > 1 ? "ont" : "a") + " battu l'indice sur l'année, à mois égaux." : "Personne n'a battu l'indice cette année. Le marché gagne la manche.") +
      "</p><p class=\"wr-p\">Un ETF " + esc(b.i1nom) + " acheté en janvier et oublié aurait fait " + pct(b.idx.twr) + ". C'est la barre à franchir.</p>" });
  }
  // 9. fin
  L.push({ c: "#9B87FF", h: '<div class="wr-k">Fin du bilan ' + b.y + ' · rendez-vous en</div><div class="wr-big">' + (b.y + 1) + '</div><p class="wr-p">Une année, c\'est encore court : la chance y pèse lourd. C\'est sur plusieurs années que les classements deviennent parlants.</p>' +
    '<button class="wr-btn" type="button" data-wr-fermer>Fermer</button>' });
  return L;
}


function ouvrirBilan(y) {
  const b = bilanAnnee(y);
  if (!b.st.length) { toast("Pas assez de relevés pour le bilan " + y + "."); return; }
  ouvrirDiapos("Versus · " + y, diapos(b));
}
/* Diaporama plein écran (bilans annuels, récaps du mois, bilan privé) : toucher à droite = suivant, à gauche = précédent */
function ouvrirDiapos(titre, L) {
  if (!L || !L.length) return;
  let i = 0;
  const o = document.createElement("div");
  o.className = "wr"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", titre); o.tabIndex = -1;
  o.innerHTML = '<div class="wr-top"><div class="wr-bars">' + L.map(() => "<i></i>").join("") + '</div><div class="wr-tete"><span>' + esc(titre) + '</span><button class="wr-x" type="button" aria-label="Fermer">✕</button></div></div><div class="wr-s" aria-live="polite"></div>';
  document.body.appendChild(o);
  const scene = o.querySelector(".wr-s"), barres = o.querySelectorAll(".wr-bars i");
  const fermer = () => { o.remove(); document.removeEventListener("keydown", clavier); };
  const montrer = n => {
    i = Math.max(0, Math.min(L.length - 1, n));
    o.style.setProperty("--c", couleurReelle(L[i].c));
    scene.innerHTML = L[i].h; scene.scrollTop = 0;
    barres.forEach((x, j) => x.classList.toggle("fait", j <= i));
    if (ANIM) { scene.classList.remove("entre"); void scene.offsetWidth; scene.classList.add("entre"); }
    compterChiffresWr(scene);
    const fm = scene.querySelector("[data-wr-fermer]"); if (fm) fm.addEventListener("click", e => { e.stopPropagation(); fermer(); });
    if (i === L.length - 1 && ANIM) confettis();
  };
  const clavier = e => { if (e.key === "Escape") fermer(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); montrer(i + 1); } else if (e.key === "ArrowLeft") montrer(i - 1); };
  document.addEventListener("keydown", clavier);
  o.querySelector(".wr-x").addEventListener("click", e => { e.stopPropagation(); fermer(); });
  o.addEventListener("click", e => {
    if (e.target.closest("button")) return;
    const r = o.getBoundingClientRect();
    montrer(e.clientX - r.left < r.width / 3 ? i - 1 : i + 1);
  });
  let x0 = null;
  o.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  o.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { e.preventDefault(); montrer(dx < 0 ? i + 1 : i - 1); } });
  montrer(0); o.focus();
}
/* Grand chiffre qui défile sur la diapo « Ton année » */
function compterChiffresWr(scene) {
  const el = scene.querySelector(".wr-big.up, .wr-big.down");
  if (!ANIM || !el) return;
  const fin = parseFloat(el.textContent.replace(MOINS, "-").replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!isFinite(fin)) return;
  const t0 = performance.now();
  const pas = t => { const x = Math.min(1, Math.max(0, t - t0) / 900); el.textContent = pct(fin / 100 * adoucir(x)); if (x < 1) requestAnimationFrame(pas); };
  requestAnimationFrame(pas);
}


/* ---------- Vue Mois ---------- */
function teinte(r, max) {
  if (!ok(r)) return "";
  const a = Math.min(1, Math.abs(r) / max) * .55 + .08;
  return "background:color-mix(in srgb, var(" + (r >= 0 ? "--up" : "--down") + ") " + Math.round(a * 100) + "%, var(--panel))";
}
function rendreMois() {
  const env = ETAT.env, i1 = ETAT.i1, i2s = i2Actif(), i2 = i2s >= 0 ? i2s : i1;
  const fin = finGlobale(D, env);
  const v = $("#v-mois");
  if (!fin) { v.innerHTML = filtres(true) + '<div class="vide">Aucun relevé pour cette enveloppe.</div>'; brancherFiltres("mois"); return; }
  const deb = debutPeriode(D, ETAT.per, fin) || 0;
  const ks = [...new Set(D.personnes.flatMap(p => serie(p, env).filter(x => typeof x.r === "number" && x.k <= fin && x.k > deb).map(x => x.k)))].sort((a, b) => a - b).reverse();
  const lignes = D.personnes.map(p => { const s = serie(p, env); return { nom: p.nom, r: ks.map(k => { const x = s.find(y => y.k === k); return x && typeof x.r === "number" ? x.r : null; }) }; });
  const ri = n => { const m = {}; D.marche.mois.forEach(l => m[l[0]] = l[n + 1]); return ks.map(k => ok(m[k]) ? m[k] : null); };
  const max = Math.max(.04, ...lignes.flatMap(l => l.r).filter(ok).map(Math.abs));
  const meilleurs = ks.map((k, j) => { let b = null; lignes.forEach(l => { if (ok(l.r[j]) && (b === null || l.r[j] > b.r)) b = { nom: l.nom, r: l.r[j] }; }); const ex = b && lignes.filter(l => ok(l.r[j]) && Math.abs(l.r[j] - b.r) < 1e-9).length > 1;
    return b && !ex && lignes.filter(l => ok(l.r[j])).length > 1 ? b.nom : null; });
  const cell = (r, star) => ok(r) ? '<td class="' + (star ? "star" : "") + '" style="' + teinte(r, max) + '">' + pct(r) + "</td>" : '<td class="vide">·</td>';
  const pal = palmares(D, env, i1, i2);
  const gagnees = {}; D.personnes.forEach(p => gagnees[p.nom] = 0); pal.forEach(l => { if (l.vainqueur) gagnees[l.vainqueur]++; });

  v.innerHTML = blocBilans() + filtres(true) +
    '<div class="periode">' + esc(textePeriode(deb || null, fin, ks.length)) + "</div>" +
    palmaresMois(env, deb, fin, ks) +
    blocDuel(env, deb, fin) +
    '<div><h2 class="sec">Mois par mois <small>' + esc(ENVELOPPES[env]) + " · ★ meilleur du mois · le plus récent à gauche</small></h2></div>" +
    '<div class="scroll-x"><table class="grille"><thead><tr><th></th>' + ks.map(k => "<th>" + esc(moisCourt(k)) + "</th>").join("") + "</tr></thead><tbody>" +
    lignes.map(l => '<tr><td class="nom"><i style="background:' + couleur(l.nom) + '"></i>' + esc(l.nom) + "</td>" + l.r.map((r, j) => cell(r, meilleurs[j] === l.nom)).join("") + "</tr>").join("") +
    (i2s >= 0 ? [i1, i2s] : [i1]).map(n => '<tr class="indice"><td class="nom"><i style="background:var(--idx)"></i>' + esc(D.marche.indices[n]) + "</td>" + ri(n).map(r => cell(r, false)).join("") + "</tr>").join("") +
    "</tbody></table></div>" +
    '<div class="leg-grille"><span><i style="' + teinte(max, max) + '"></i>hausse</span><span><i style="' + teinte(-max, max) + '"></i>baisse</span><span><i style="box-shadow:inset 0 0 0 2px var(--gold)"></i>meilleur du mois entre vous</span></div>' +
    '<div><h2 class="sec">Palmarès annuel <small>années civiles · figé</small></h2><div class="scroll-x"><table class="tab"><thead><tr><th>Année</th>' +
    D.personnes.map(p => "<th>" + esc(p.nom) + "</th>").join("") + "<th>" + esc(D.marche.indices[i1]) + "</th>" + (i2s >= 0 ? "<th>" + esc(D.marche.indices[i2s]) + "</th>" : "") + "<th>Vainqueur</th></tr></thead><tbody>" +
    pal.map(l => "<tr><td>" + l.annee + '<br><small class="muted" style="font-weight:400;font-size:11px">' + l.mois + " mois" + (l.enCours ? " · en cours" : l.mois < 12 ? " · partiel" : "") + "</small></td>" +
      D.personnes.map(p => '<td class="' + sens(l.personnes[p.nom]) + '">' + (p.nom in l.personnes ? pct(l.personnes[p.nom]) : "—") + "</td>").join("") +
      '<td class="muted">' + pct(l.i1) + "</td>" + (i2s >= 0 ? '<td class="muted">' + pct(l.i2) + "</td>" : "") + "<td>" + (l.vainqueur ? '<span class="pastille" style="background:' + couleur(l.vainqueur) + '"></span>' + esc(l.vainqueur) : "—") + "</td></tr>").join("") +
    "<tr><td>Années gagnées</td>" + D.personnes.map(p => "<td>" + gagnees[p.nom] + "</td>").join("") + "<td></td>" + (i2s >= 0 ? "<td></td>" : "") + "<td></td></tr>" +
    "</tbody></table></div></div>";
  brancherFiltres("mois");
  brancherBilans(v);
  v.querySelectorAll("[data-bilan]").forEach(b => { if (!b.closest(".bilans-bloc")) b.addEventListener("click", () => ouvrirBilan(+b.dataset.bilan)); });
  ["d1", "d2"].forEach(c => { const el = $("#f-" + c); if (el) el.addEventListener("change", e => { ETAT[c] = e.target.value; garder(); rendreMois(); }); });
}

/** Victoires : qui gagne le plus de mois sur la période (bande de mois, séries, mois en tête) */
function palmaresMois(env, deb, fin, ksDesc) {
  const v = victoires(env, fin, deb), ks = (ksDesc || []).slice().reverse();
  const gagnant = {};
  ks.forEach(k => { const du = rendementsDuMois(env, k).sort((a, b) => b.r - a.r); if (du.length > 1 && du[0].r - du[1].r > 1e-9) gagnant[k] = du[0].nom; });
  const tri = D.personnes.map(p => Object.assign({ nom: p.nom }, v[p.nom])).filter(x => x.mois).sort((a, b) => b.victoires - a.victoires || b.enTete - a.enTete);
  if (!tri.length) return "";
  const total = tri.reduce((a, x) => a + x.victoires, 0), nuls = ks.filter(k => !gagnant[k] && rendementsDuMois(env, k).length > 1).length;
  const part = total ? '<div class="vic-part" aria-hidden="true">' + tri.filter(x => x.victoires).map(x => '<i style="flex:' + x.victoires + ";background:" + couleur(x.nom) + '"><span>' + esc(x.nom) + " " + x.victoires + "</span></i>").join("") + "</div>" : "";
  const lignes = tri.map((x, i) => {
    const bande = ks.map(k => { const a = aRendement(D.personnes.find(p => p.nom === x.nom), env, k); return '<i class="' + (gagnant[k] === x.nom ? "g" : a ? "j" : "a") + '" title="' + esc(moisLong(k)) + '"' + (gagnant[k] === x.nom ? ' style="background:' + couleur(x.nom) + '"' : "") + "></i>"; }).join("");
    const puces = [x.serie >= 2 ? "🔥 " + x.serie + " d'affilée" : null, x.record >= 2 ? "record " + x.record : null, x.enTete ? "👑 " + x.enTete + " mois en tête" : null, "🎯 bat l'indice " + pct(x.mois ? x.battu / x.mois : null, 0, false)].filter(Boolean);
    return '<div class="vic-l' + (i === 0 && x.victoires ? " tete" : "") + '" style="--c:' + couleur(x.nom) + '"><span class="vic-n">' + x.victoires + "<small>/" + x.mois + "</small></span>" +
      '<div class="vic-c"><b>' + esc(x.nom) + couronne(x.nom) + '</b><div class="vic-b">' + bande + '</div><div class="vic-s">' + puces.map(t => "<span>" + esc(t) + "</span>").join("") + "</div></div></div>";
  }).join("");
  return '<div><h2 class="sec">Victoires <small>meilleur mois entre vous</small></h2></div><div class="vic">' + part + lignes + "</div>" +
    '<p class="info">Chaque case = un mois de la période, en couleur quand tu l\'as gagné' + (nuls ? " (" + nuls + " mois sans vainqueur, ex aequo)" : "") + ". Mois en tête : fins de mois où tu menais le classement de l'année. 🎯 : part de tes mois au-dessus de " + esc(D.marche.indices[ETAT.i1]) + ".</p>";
}

/* ---------- Vue Fiche ---------- */
function rendreFiche() {
  const p = D.personnes.find(x => x.nom === ETAT.fiche) || D.personnes[0];
  const env = ETAT.env, i1 = ETAT.i1;
  const sAll = serie(p, env);
  const finP = (sAll.filter(x => x.val !== null && x.val !== undefined).pop() || {}).k;
  const v = $("#v-fiche");
  const chips = '<div class="chips" role="group" aria-label="Personne">' + D.personnes.map(x => '<button class="chip" type="button" data-fiche="' + esc(x.nom) + '" aria-pressed="' + (x.nom === p.nom) + '"><i style="background:' + couleur(x.nom) + '"></i>' + esc(x.nom) + "</button>").join("") + "</div>";
  if (!finP) {
    v.innerHTML = chips + filtres(true, true, false) + '<div class="vide">Pas encore de relevé pour ' + esc(p.nom) + " dans " + esc(ENVELOPPES[env]) + ".</div>";
  } else {
    const deb = debutPeriode(D, ETAT.per, finP);
    const s = stats(D, p, env, deb, finP, i1, null);
    const tuile = (lab, val, cls, sub) => '<div><span class="lab">' + lab + '</span><span class="val ' + (cls || "") + '">' + val + '</span><span class="sub">' + (sub || "&nbsp;") + "</span></div>";
    // toutes enveloppes, même période
    const envs = ENVELOPPES.map((nom, e) => ({ nom, s: stats(D, p, e, deb, finP, i1, null) })).filter(x => ok(x.s.valeur) && x.s.valeur > 0);
    const totalV = (envs.find(x => x.nom === "Portefeuille") || {}).s;
    // courbe valeur / versé
    const pts2 = sAll.filter(x => x.k >= (deb || 0) && x.k <= finP && ok(x.val));
    const vx = pts2.map(x => x.k);
    // grille annuelle
    const annees = [...new Set(sAll.filter(x => typeof x.r === "number").map(x => Math.floor(x.k / 100)))].sort().reverse();
    const max = Math.max(.04, ...sAll.filter(x => typeof x.r === "number").map(x => Math.abs(x.r)));

    v.innerHTML = chips + filtres(true) +
      '<div class="periode">' + esc(textePeriode(deb, finP, s.n)) + (s.debutK && deb && s.debutK > cleMoins(deb, -1) ? " · l'enveloppe a démarré après le début demandé" : "") + "</div>" +
      '<div class="hero"><span class="eyebrow">' + esc(ENVELOPPES[env]) + " · " + esc(p.nom) + '</span><span class="big" data-cv="' + s.valeur + '" data-cf="eur">' + eur(s.valeur) + '</span><div class="sous"><span class="badge ' + sens(s.pvLatente) + '">' + eur(s.pvLatente, 0, true) + " · " + pct(s.pvLatentePct) + "</span><span>de plus-value pour " + eur(s.verse) + " versés</span></div></div>" +
      (s.n ? '<div class="tuiles">' +
        tuile("Performance (TWR)", pct(s.twr), sens(s.twr), "MWR <b>" + pct(s.mwr) + "</b>" + timingVersements(s)) +
        tuile(esc(D.marche.indices[i1]) + " même période", pct(s.i1 && s.i1.twr), "", s.i1 ? "Écart <b class=\"" + sens(s.twr - s.i1.twr) + "\">" + pts(s.twr - s.i1.twr) + "</b>" : "indice indisponible") +
        tuile("Pire baisse depuis un plus haut", pct(s.baisseMax), sens(s.baisseMax), "Actuelle <b>" + pct(s.baisseActuelle) + "</b>") +
        tuile("Volatilité annualisée", volTxt(s), "", s.n < RECUL ? "moins de " + RECUL + " mois de données" : "Sharpe <b>" + sharpeTxt(s) + "</b>") +
        tuile("Meilleur mois (" + moisCourt(s.meilleur.k) + ")", pct(s.meilleur.r), sens(s.meilleur.r), "Pire (" + moisCourt(s.pire.k) + ") <b>" + pct(s.pire.r) + "</b>") +
        tuile("Plus-value sur la période", eur(s.pvPeriode, 0, true), sens(s.pvPeriode), "Versé <b>" + eur(s.versePeriode) + "</b>") +
        "</div>" : '<div class="vide">Pas de rendement sur cette période.</div>') +
      (vx.length > 1 ? '<div><h2 class="sec">Valeur et versements <small>fin de mois</small></h2></div>' + boiteGraphe("g-fiche", [{ nom: "Valeur", c: couleur(p.nom) }, { nom: "Versé cumulé", c: "var(--idx)", dash: true }]) : "") +
      (env === 0 && envs.length > 1 ? '<div><h2 class="sec">Toutes enveloppes <small>même période</small></h2><div class="scroll-x"><table class="tab"><thead><tr><th>Enveloppe</th><th>TWR</th><th>Volatilité</th><th>Valeur</th><th>Plus-value</th><th>Poids</th></tr></thead><tbody>' +
        envs.map(x => "<tr><td>" + esc(x.nom) + '</td><td class="' + sens(x.s.twr) + '">' + pct(x.s.twr) + "</td><td>" + (x.s.n ? volTxt(x.s) : "—") + "</td><td>" + eur(x.s.valeur) + '</td><td class="' + sens(x.s.pvLatente) + '">' + eur(x.s.pvLatente, 0, true) + "<br><small>" + pct(x.s.pvLatentePct) + "</small></td><td>" + pct(totalV ? x.s.valeur / totalV.valeur : null, 0, false) + "</td></tr>").join("") +
        "</tbody></table></div>" +
        '<div class="stack" style="margin-top:12px" role="img" aria-label="Répartition">' + envs.filter(x => x.nom !== "Portefeuille").map((x, j) => '<i title="' + esc(x.nom) + '" style="flex:' + x.s.valeur + ";background:color-mix(in srgb, " + couleur(p.nom) + " " + (100 - j * 22) + '%, var(--panel))"></i>').join("") + "</div></div>" : "") +
      '<div><h2 class="sec">Mois par mois <small>' + esc(ENVELOPPES[env]) + '</small></h2><div class="scroll-x"><table class="grille"><thead><tr><th></th>' + MOIS.map(m => "<th>" + m + "</th>").join("") + "<th>Année</th></tr></thead><tbody>" +
        annees.map(y => { const st = stats(D, p, env, (y - 1) * 100 + 12, y * 100 + 12, null, null); return '<tr><td class="nom">' + y + "</td>" + MOIS.map((m, j) => { const x = sAll.find(z => z.k === y * 100 + j + 1); return x && typeof x.r === "number" ? '<td style="' + teinte(x.r, max) + '">' + pct(x.r) + "</td>" : '<td class="vide">·</td>'; }).join("") + '<td style="' + teinte(st.twr, max * 3) + '"><b>' + pct(st.twr) + "</b></td></tr>"; }).join("") +
      "</tbody></table></div></div>" +
      "";
    if (vx.length > 1) tracer($("#g-fiche"), { x: vx, zeroMin: true, series: [{ nom: "Valeur", v: pts2.map(x => x.val), c: couleur(p.nom), aire: true, w: 2.2 }, { nom: "Versé cumulé", v: pts2.map(x => x.cum), c: "var(--idx)", marche: true, dash: true, w: 1.6 }], fmt: x => eur(x), fmtAxe: axeEur, titreX: k => "Fin " + moisCourt(k) });
    compterChiffres(v.querySelector(".hero"));
  }
  brancherFiltres("fiche");
  v.querySelectorAll("[data-fiche]").forEach(b => b.addEventListener("click", () => { ETAT.fiche = b.dataset.fiche; garder(); rendreFiche(); }));
}

/* ---------- Saisie du relevé ---------- */
const NOMS_ENV = ["PEA", "Assurance vie", "CTO", "Crypto"];
let R = null;
function lireNb(t) {
  if (t === null || t === undefined) return null;
  let x = String(t).replace(/[\s\u00a0\u202f€]/g, "").replace(/[\u2212\u2013]/g, "-");   // « −500 » copié depuis l'appli
  if (x.includes(",") && x.includes(".")) x = x.replace(/\./g, "");   // « 1.234,56 » : le point sépare les milliers
  x = x.replace(",", ".");
  if (x === "") return null; const n = Number(x); return isFinite(n) ? n : NaN;
}
/** Fiche : « Timing des versements » = écart MWR − TWR, affiché seulement au-delà de 0,5 point */
function timingVersements(s) {
  if (!ok(s.mwr) || !ok(s.twr) || Math.abs(s.mwr - s.twr) < 0.005) return "";
  const bon = s.mwr > s.twr;
  return '<br><button class="lien" type="button" onclick="toast(\'Le TWR mesure tes placements, le MWR ton argent : l\\\'écart montre si tes versements sont arrivés au bon moment.\')">Timing des versements : <b class="' + (bon ? "up" : "down") + '">' + (bon ? "favorable" : "défavorable") + " (" + pts(s.mwr - s.twr) + ")</b></button>";
}
function enSaisie(n) { return ok(n) ? String(n).replace(".", ",") : ""; }
function ouvrirSaisie() {
  if (!D) return;
  const p = D.personnes.find(x => x.nom === moiVrai()) || D.personnes[0];
  R = { nom: p.nom, k: null, forcer: null, erreur: "", envoi: false, tout: false };
  choisirMoisParDefaut();
  $("#saisie").hidden = false;
  // la toute première fois, le guide s'ouvre tout seul (une fois par personne et par appareil)
  const cleG = "versus.guideReleve." + p.nom; if (!stock.get(cleG) && !simulation()) { stock.set(cleG, "1"); setTimeout(guideReleve, 250); }
  JNOM = p.nom;
  ongletReleves("nouveau");
}
function ongletReleves(o) {
  document.querySelectorAll("[data-ong]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ong === o)));
  $("#corps-saisie").hidden = o !== "nouveau"; $("#corps-journal").hidden = o !== "journal";
  if (o === "nouveau") rendreSaisie(); else rendreJournal();
}
document.querySelectorAll("[data-ong]").forEach(b => b.addEventListener("click", () => { aAnnuler = null; ongletReleves(b.dataset.ong); }));

/* Journal : tous les relevés d'une personne, avec leur statut */
let JNOM = null, aAnnuler = null;
function rendreJournal() {
  const p = D.personnes.find(x => x.nom === JNOM) || D.personnes[0];
  const total = r => [1, 3, 5, 7].reduce((a, i) => a + (ok(r[2][i]) ? r[2][i] : 0), 0);
  const verse = r => [0, 2, 4, 6].reduce((a, i) => a + (ok(r[2][i]) ? r[2][i] : 0), 0);
  const lignes = p.rows.slice().reverse().filter((r, i, arr) => aUnReleve(r[2]) || i === 0 || arr.slice(i).some(x => aUnReleve(x[2])));
  $("#corps-journal").innerHTML =
    '<div class="chips" role="group" aria-label="Personne">' + D.personnes.map(x => '<button class="chip" type="button" data-jp="' + esc(x.nom) + '" aria-pressed="' + (x.nom === p.nom) + '"><i style="background:' + couleur(x.nom) + '"></i>' + esc(x.nom) + "</button>").join("") + "</div>" +
    '<p class="info" style="margin-top:10px">Un relevé saisi dans l\'app reste modifiable et annulable ' + JOURS_MODIF() + " jours, puis il est figé. Les relevés tapés directement dans le Sheet sont figés dans l'app.</p>" +
    '<div style="margin-top:6px">' + lignes.map(r => {
      const st = etatReleve(p.nom, r[0]);
      const badge = st.etat === "vide" ? '<span class="statut vide">à saisir</span>' : st.etat === "modif" ? '<span class="statut modif">modifiable</span>' : '<span class="statut fige">figé</span>';
      const src = st.etat === "vide" ? "Pas encore de relevé" : st.j ? (st.j.action === "Import auto" ? "Import automatique le " : "Saisi dans l'app le ") + dateHeure(new Date(st.j.t)) + (st.j.action === "Saisie" ? " par " + esc(st.j.par) : "") + (st.etat === "modif" ? " · jusqu'au " + dateHeure(st.lim) : "") : "Saisi dans le Sheet";
      const actions = !peutModifier(p.nom) || SOURCE !== "api" ? "" : st.etat === "vide" ? '<button class="lien" type="button" data-jsaisir="' + r[0] + '">Saisir</button>'
        : st.etat === "modif" ? '<button class="lien" type="button" data-jsaisir="' + r[0] + '">Modifier</button><button class="lien danger" type="button" data-jannuler="' + st.j.ligne + '">' + (aAnnuler === st.j.ligne ? "Confirmer l'annulation" : "Annuler la saisie") + "</button>" : "";
      return '<div class="jl"><span class="m">' + esc(moisLong(r[0])) + '</span><span class="st">' + badge + '</span><span class="s">' + src + '</span><span class="v">' + (st.etat === "vide" ? "" : eur(total(r)) + '<br><small class="muted" style="font-weight:400">versé ' + eur(verse(r), 0, true) + "</small>") + "</span>" + (actions ? '<div class="a">' + actions + "</div>" : "") + "</div>";
    }).join("") + "</div>";
  document.querySelectorAll("[data-jp]").forEach(b => b.addEventListener("click", () => { JNOM = b.dataset.jp; aAnnuler = null; rendreJournal(); }));
  document.querySelectorAll("[data-jsaisir]").forEach(b => b.addEventListener("click", () => { R = { nom: p.nom, k: +b.dataset.jsaisir, forcer: null, erreur: "", envoi: false, tout: false }; chargerValeurs(); ongletReleves("nouveau"); }));
  document.querySelectorAll("[data-jannuler]").forEach(b => b.addEventListener("click", async () => {
    const l = +b.dataset.jannuler;
    if (aAnnuler !== l) { aAnnuler = l; rendreJournal(); return; }
    b.disabled = true; b.textContent = "Annulation…";
    const rep = await posterAdmin({ action: "annuler", ligne: l });
    aAnnuler = null; toast(rep.message || (rep.ok ? "Saisie annulée." : "Annulation impossible."));
    if (rep.ok) { await charger(true); if (!$("#saisie").hidden) rendreJournal(); } else rendreJournal();
  }));
}
function choisirMoisParDefaut() {
  const p = D.personnes.find(x => x.nom === R.nom);
  const rows = p.rows;
  if (!rows.length) { R.k = null; return; }
  // par défaut : le mois en cours s'il reste à saisir ou modifiable, sinon le plus ancien mois vide
  const dernier = rows[rows.length - 1][0];
  const vide = rows.find((r, i) => i > 0 && !aUnReleve(r[2]) && rows.slice(0, i).some(x => aUnReleve(x[2])));
  R.k = etatReleve(p.nom, dernier).etat !== "fige" || !vide ? dernier : vide[0];
  chargerValeurs();
}
function chargerValeurs() {
  const p = D.personnes.find(x => x.nom === R.nom);
  const r = p.rows.find(x => x[0] === R.k);
  R.v = (r ? r[2] : Array(8).fill(null)).map(enSaisie);
  R.forcer = null; R.erreur = "";
}
const JOURS_MODIF = () => (D && D.joursModif) || 7;
function aUnReleve(brut) { return [1, 3, 5, 7].some(i => ok(brut[i])); }
function derniereSaisie(nom, k) {
  return (D.journal || []).filter(j => j.personne === nom && j.cle === k && j.statut !== "Annulé" && (j.action === "Saisie" || j.action === "Import auto"))
    .sort((a, b) => a.t < b.t ? -1 : 1).pop() || null;
}
function limiteModif(j) { return j ? new Date(new Date(j.t).getTime() + JOURS_MODIF() * 864e5) : null; }
/** Le délai de 7 jours part de la toute PREMIÈRE saisie du mois, même annulée (comme côté serveur) */
function premiereSaisie(nom, k) {
  return (D.journal || []).filter(j => j.personne === nom && j.cle === k && (j.action === "Saisie" || j.action === "Import auto"))
    .sort((a, b) => new Date(a.t) - new Date(b.t))[0] || null;
}
function etatReleve(nom, k) {
  const p = D.personnes.find(x => x.nom === nom), r = p && p.rows.find(x => x[0] === k);
  const j = derniereSaisie(nom, k), lim = limiteModif(premiereSaisie(nom, k));
  if (!r || !aUnReleve(r[2])) return { etat: "vide", j };
  if (lim && lim > new Date()) return { etat: "modif", j, lim };
  return { etat: "fige", j };
}
function dateHeure(d) { return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " à " + String(d.getHours()).padStart(2, "0") + " h " + String(d.getMinutes()).padStart(2, "0"); }
function peutModifier(nom) { return estAdmin() || nom === SESSION.nom; }
function utilisees(p) { return NOMS_ENV.map((_, e) => p.rows.some(r => ok(r[2][2 * e + 1]) || (r[2][2 * e] || 0) !== 0)); }
function rendreSaisie() {
  const p = D.personnes.find(x => x.nom === R.nom);
  if (!p.rows.length || R.k === null) {
    $("#corps-saisie").innerHTML = '<div class="chips" role="group" aria-label="Personne">' + D.personnes.filter(x => estAdmin() || x.nom === SESSION.nom).map(x => '<button class="chip" type="button" data-rp="' + esc(x.nom) + '" aria-pressed="' + (x.nom === R.nom) + '"><i style="background:' + couleur(x.nom) + '"></i>' + esc(x.nom) + "</button>").join("") + "</div>" +
      '<p class="info" style="margin-top:12px">Pas encore de mois daté dans l\'onglet Data ' + esc(p.nom) + " : la première ligne apparaît au prochain jour de relevé.</p>";
    document.querySelectorAll("[data-rp]").forEach(b => b.addEventListener("click", () => { R.nom = b.dataset.rp; choisirMoisParDefaut(); rendreSaisie(); }));
    return;
  }
  const idx = p.rows.findIndex(x => x[0] === R.k);
  const prev = idx > 0 ? p.rows[idx - 1] : null;
  const util = utilisees(p);
  const montrer = NOMS_ENV.map((_, e) => R.tout || util[e] || !util.some(Boolean));
  const opts = p.rows.slice().reverse().map(r => { const e = etatReleve(p.nom, r[0]).etat; return '<option value="' + r[0] + '"' + (r[0] === R.k ? " selected" : "") + ">" + esc(moisLong(r[0])) + (e === "vide" ? " · à saisir" : e === "modif" ? " · modifiable" : " · figé") + "</option>"; }).join("");
  const st = etatReleve(p.nom, R.k);
  const fige = st.etat === "fige";
  const maintenant = new Date(), cleAuj = maintenant.getFullYear() * 100 + maintenant.getMonth() + 1;
  const dernierJour = jourReleve(maintenant.getFullYear(), maintenant.getMonth() + 1).getDate() === maintenant.getDate();
  const avantCloture = R.k === cleAuj && dernierJour && maintenant.getHours() < 18;
  const imp = etatImport();
  const bandeauEtat = fige ? '<div class="alerte">Relevé figé : ' + (st.j ? "saisi il y a plus de " + JOURS_MODIF() + " jours" : "saisi dans le Sheet") + ". Il ne se modifie plus que dans l'onglet Data " + esc(p.nom) + " du Sheet.</div>"
    : st.etat === "modif" ? '<div class="alerte warn">Déjà saisi ' + (st.j.action === "Import auto" ? "par l'import automatique" : "le " + dateHeure(new Date(st.j.t))) + " : modifiable jusqu'au " + dateHeure(st.lim) + ".</div>" : "";
  $("#corps-saisie").innerHTML = '<form class="form" id="form-releve" novalidate style="display:grid;gap:14px">' +
    '<div class="chips" role="group" aria-label="Personne">' + D.personnes.filter(x => estAdmin() || x.nom === SESSION.nom).map(x => '<button class="chip" type="button" data-rp="' + esc(x.nom) + '" aria-pressed="' + (x.nom === R.nom) + '"><i style="background:' + couleur(x.nom) + '"></i>' + esc(x.nom) + "</button>").join("") + "</div>" +
    '<label class="sel"><span>Mois (valeurs au ' + finMois(R.k) + ')</span><select id="r-mois">' + opts + "</select></label>" + bandeauEtat +
    '<button class="lien guide-l" type="button" id="r-guide">❓ Comment remplir mon relevé</button>' +
    (imp.visible && R.nom === imp.nom && R.k === imp.k ? '<div class="import-l"><button class="btn acc" type="button" id="r-importer"' + (imp.actif ? "" : " disabled") + '>Importer depuis Portefeuille & Épargne</button><small>' + esc(imp.texte) + "</small></div>" : "") +
    (avantCloture ? '<div class="alerte warn">Jour du relevé : attends la clôture (18 h) pour saisir les valeurs de fin de mois.</div>' : "") +
    NOMS_ENV.map((nom, e) => !montrer[e] ? "" :
      '<div class="env-saisie"><div class="h"><b>' + nom + '</b><span id="r-info-' + e + '"></span></div><div class="rang">' +
      '<div class="champ"><label for="r-v' + e + '">Versé ce mois (€)</label><input id="r-v' + e + '" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(R.v[2 * e]) + '"' + (fige ? " disabled" : "") + "></div>" +
      '<div class="champ"><label for="r-c' + e + '">Valeur fin de mois (€)</label><input id="r-c' + e + '" type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="' + esc(R.v[2 * e + 1]) + '"' + (fige ? " disabled" : "") + "></div></div></div>").join("") +
    (montrer.every(Boolean) ? "" : '<button class="lien" type="button" id="r-tout">Afficher les autres enveloppes</button>') +
    '<p class="info">Versé : 0 si rien, négatif si retrait. Valeur : le total affiché par la banque en fin de mois, 0 si l\'enveloppe est vidée. Le rendement affiché compte le versement à moitié (arrivé en moyenne en milieu de mois).</p>' +
    '<div class="recap" id="r-recap"></div><div id="r-alertes" style="display:grid;gap:6px"></div>' +
    (fige ? "" : '<button class="btn acc plein" type="submit" id="r-envoyer">' + (st.etat === "modif" ? "Enregistrer la modification" : "Enregistrer le relevé") + "</button>") + "</form>";
  document.querySelectorAll("[data-rp]").forEach(b => b.addEventListener("click", () => { R.nom = b.dataset.rp; R.tout = false; choisirMoisParDefaut(); rendreSaisie(); }));
  $("#r-mois").addEventListener("change", e => { R.k = +e.target.value; chargerValeurs(); rendreSaisie(); });
  if ($("#r-importer")) $("#r-importer").addEventListener("click", async e => { if (await lancerImport(e.currentTarget)) { JNOM = R.nom; ongletReleves("journal"); } });
  if ($("#r-tout")) $("#r-tout").addEventListener("click", () => { R.tout = true; rendreSaisie(); });
  $("#r-guide").addEventListener("click", guideReleve);
  NOMS_ENV.forEach((_, e) => ["v", "c"].forEach((t, j) => { const el = $("#r-" + t + e); if (el) el.addEventListener("input", () => { R.v[2 * e + j] = el.value; R.forcer = null; R.erreur = ""; majSaisie(prev); }); }));
  $("#form-releve").addEventListener("submit", ev => { ev.preventDefault(); if (!fige) envoyerReleve(false); });
  majSaisie(prev);
}
function majSaisie(prev) {
  let total = 0, aTotal = false, bloque = false, gain = 0, base = 0;
  const err = [], avert = [];
  NOMS_ENV.forEach((nom, e) => {
    const vers = lireNb(R.v[2 * e]), val = lireNb(R.v[2 * e + 1]);
    const info = $("#r-info-" + e);
    if (Number.isNaN(vers) || Number.isNaN(val)) { bloque = true; err.push(nom + " : montant illisible."); }
    if (ok(val) && val < 0) { bloque = true; err.push(nom + " : la valeur ne peut pas être négative."); }
    const pv = prev && ok(prev[2][2 * e + 1]) ? prev[2][2 * e + 1] : 0;
    if (!ok(val) && !Number.isNaN(val) && pv > 0) { bloque = true; err.push(nom + " valait " + eur(pv) + " le mois dernier : saisis sa valeur (0 si l'enveloppe est vidée)."); }
    else if (!ok(val) && ok(vers) && vers !== 0) { bloque = true; err.push(nom + " : un versement est saisi mais pas la valeur de fin de mois."); }
    if (ok(val) && pv > 0 && !vers && Math.round(val * 100) === Math.round(pv * 100)) avert.push(nom + " : valeur identique au centime au mois dernier, copier-coller ?");
    if (ok(val)) { total += val; aTotal = true; }
    if (info) {
      if (ok(val) && pv > 0 && pv + (vers || 0) / 2 > 0) {
        const r = (val - pv - (vers || 0)) / (pv + (vers || 0) / 2);
        if (Math.abs(r) > .25) avert.push(nom + " : " + pct(r, 0) + " sur le mois, vérifie le versement et la valeur.");
        gain += val - pv - (vers || 0); base += pv + (vers || 0) / 2;
        info.innerHTML = 'mois <b class="' + sens(r) + '">' + pct(r) + "</b> · avant " + eur(pv);
      } else info.textContent = pv ? "avant " + eur(pv) : "";
    }
  });
  $("#r-recap").innerHTML = "<span>Valeur totale</span><b>" + (aTotal ? eur(total, 2) : "—") + (base ? ' · <span class="' + sens(gain) + '">' + pct(gain / base) + "</span>" : "") + "</b>";
  let al = err.map(t => '<div class="alerte err">' + esc(t) + "</div>").join("") + avert.map(t => '<div class="alerte warn">' + esc(t) + "</div>").join("");
  if (R.erreur) al += '<div class="alerte err">' + esc(R.erreur) + "</div>";
  if (R.forcer) al += '<div class="alerte warn">' + esc(R.forcer) + '<br><button class="btn" type="button" id="r-forcer">Enregistrer quand même</button></div>';
  $("#r-alertes").innerHTML = al;
  if ($("#r-forcer")) $("#r-forcer").addEventListener("click", () => envoyerReleve(true));
  const b = $("#r-envoyer"); if (b) { b.disabled = bloque || R.envoi; if (R.envoi) b.textContent = "Enregistrement…"; }
}
async function envoyerReleve(forcer) {
  if (R.envoi) return;   // déjà en cours : pas de double envoi (ex. double appui sur « Enregistrer quand même »)
  const valeurs = R.v.map(t => { const n = lireNb(t); return ok(n) ? n : null; });
  if (simulation()) { toast(MSG_SIMULATION); return; }
  if (SOURCE === "cache" && EN_CHARGEMENT) { toast("Mise à jour des chiffres en cours : réessaie dans quelques secondes."); return; }
  if (SOURCE !== "api") { toast(SOURCE === "demo" ? "Aperçu : le relevé est contrôlé mais rien n'est écrit sans adresse d'API." : ERREUR_SERVEUR ? "Le fichier a répondu par une erreur : le relevé n'a pas été envoyé." : "Hors connexion : le relevé n'a pas été envoyé."); if (SOURCE === "demo") $("#saisie").hidden = true; return; }
  R.envoi = true; R.erreur = ""; majSaisie(null);
  let rep;
  try { rep = await envoyerApi(apiUrl(), { cle: stock.get(CLES.cle), action: "releve", personne: R.nom, mois: R.k, valeurs, forcer: !!forcer }); }
  catch (e) { rep = { ok: false, message: e.message }; }
  R.envoi = false;
  if (rep.ok) { toast(rep.message || "Relevé enregistré."); await charger(true); JNOM = R.nom; ongletReleves("journal"); return; }
  if (rep.erreur === "cle" || rep.erreur === "bloque") { stock.del(CLES.cle); $("#saisie").hidden = true; ouvrirCle(rep.message); return; }
  if (rep.erreur === "avertissement") R.forcer = rep.message; else R.erreur = rep.message || "Erreur inattendue.";
  if (rep.erreur === "fige") { charger(true); }
  const p = D.personnes.find(x => x.nom === R.nom), i = p.rows.findIndex(x => x[0] === R.k);
  majSaisie(i > 0 ? p.rows[i - 1] : null);
}
let minuteur;
/* Bandes qui défilent vers la droite (onglets, mois, tableaux…) : elles gardent leur position quand la vue se redessine,
   et l'élément choisi reste visible au premier affichage */
const DEFIL = new Map();
function cleDefil(el) {
  const vue = el.closest && el.closest("[data-vue]"), c = el.classList && el.classList[0]; if (!vue || !c) return null;
  return vue.id + "|" + c + "|" + Array.prototype.indexOf.call(vue.getElementsByClassName(c), el);
}
document.addEventListener("scroll", e => {
  const el = e.target; if (!(el instanceof Element) || el.scrollWidth <= el.clientWidth + 1) return;
  const k = cleDefil(el); if (k) DEFIL.set(k, el.scrollLeft);
}, { capture: true, passive: true });
function restaurerDefil(vue) {
  DEFIL.forEach((x, k) => { const [id, c, i] = k.split("|"); if (id !== vue.id) return; const el = vue.getElementsByClassName(c)[+i]; if (el && Math.abs(el.scrollLeft - x) > 1) el.scrollLeft = x; });
  vue.querySelectorAll(".gp-mois, .pod-tabs, .slot-tabs, .s-ys, .tp-o").forEach(el => {
    if (DEFIL.has(cleDefil(el)) || el.scrollWidth <= el.clientWidth + 1) return;
    const a = el.querySelector('[aria-pressed="true"], .on'); if (!a) return;
    const r = el.getBoundingClientRect(), b = a.getBoundingClientRect();
    if (b.right > r.right || b.left < r.left) el.scrollLeft += (b.left - r.left) - (r.width - b.width) / 2;
  });
}
(function () {
  const m = document.querySelector("main"); if (!m || !window.MutationObserver) return;
  new MutationObserver(l => { const vues = new Set(); l.forEach(x => { const v = x.target.closest && x.target.closest("[data-vue]"); if (v) vues.add(v); }); vues.forEach(v => { restaurerDefil(v); if (typeof assurerRappel === "function") assurerRappel(v); }); })
    .observe(m, { childList: true, subtree: true });
})();
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(minuteur); minuteur = setTimeout(() => { el.hidden = true; }, Math.max(4200, String(t).length * 50)); }

/* ---------- Navigation ---------- */
const VUES = ["classement", "mois", "fiche", "trophees", "moi"];
function vueActive() {
  const h = location.hash.replace("#", "");
  if (VUES.includes(h)) return h;
  if (["classement", "mois", "trophees"].includes(ETAT.ouverture)) return ETAT.ouverture;
  if (/^moi/.test(ETAT.ouverture) || ETAT.ouverture === "fiche") return "moi";
  return stock.get(CLES.vue) || "classement";
}
function rendreVue(v) { ({ classement: rendreClassement, mois: rendreMois, fiche: rendreFiche, trophees: rendreTrophees, moi: rendreMoi })[v](); }
/* Onglet Moi : module privé chargé à la demande (moi.js), qui lit le fichier personnel depuis l'appareil */
const MOI_JS = "moi.js";
function chargerModuleMoi(apres, echec) {
  if (window.Moi) { apres(); return; }
  let sc = document.getElementById("script-moi");
  if (!sc) { sc = document.createElement("script"); sc.id = "script-moi"; sc.src = MOI_JS; document.head.appendChild(sc); }
  sc.addEventListener("load", apres);
  sc.addEventListener("error", () => { sc.remove(); if (echec) echec(); });
}
function rendreMoi() {
  if (window.Moi) { window.Moi.rendre(); return; }
  $("#v-moi").innerHTML = '<div class="vide">Chargement de ton espace…</div>';
  chargerModuleMoi(() => { if (vueActive() === "moi") window.Moi.rendre(); }, () => { $("#v-moi").innerHTML = '<div class="vide">Impossible de charger l\'onglet Moi : vérifie ta connexion.</div>'; });
}
/* Cloche : appelée par le module Moi (null = pas de fichier connecté, "" = rien à signaler, "orange" = rappel, "rouge" = anomalie ou alerte) */
function majCloche(niveau) {
  const b = $("#btn-notif"), p = $("#point-notif");
  b.hidden = niveau === null;
  p.hidden = !niveau; p.className = niveau || "";
  b.setAttribute("aria-label", niveau === "rouge" ? "Notifications : anomalie ou alerte à voir" : niveau === "orange" ? "Notifications : rappel à faire" : "Notifications");
  if (!$("#notifs").hidden && window.Moi) $("#corps-notifs").innerHTML = window.Moi.notifications();
}
$("#btn-notif").addEventListener("click", () => { $("#corps-notifs").innerHTML = window.Moi ? window.Moi.notifications() : ""; $("#notifs").hidden = false; });
$("#fermer-notifs").addEventListener("click", () => { $("#notifs").hidden = true; });
$("#notifs").addEventListener("click", e => { if (e.target.id === "notifs") $("#notifs").hidden = true; });
/* au démarrage, si un fichier perso est connecté : on prépare Moi en arrière-plan pour la cloche */
function moiConnecte() { return !!(stock.get("versus.moi.api") && stock.get("versus.moi.cle")); }
function prechaufferMoi() { if (moiConnecte()) chargerModuleMoi(() => window.Moi.prechauffer()); }
function montrerVue(v) {
  if (!VUES.includes(v)) v = "classement";
  document.querySelectorAll(".view").forEach(s => { s.hidden = s.dataset.vue !== v; });
  document.body.classList.toggle("vue-moi", v === "moi");
  document.querySelectorAll(".onglet").forEach(t => t.setAttribute("aria-current", t.dataset.vue === v || (v === "fiche" && t.dataset.vue === "classement") ? "page" : "false"));
  stock.set(CLES.vue, v);
  if (D || v === "moi") rendreVue(v);
  window.scrollTo(0, 0);
}
function allerA(v) { if (location.hash !== "#" + v) location.hash = v; else montrerVue(v); }
document.querySelectorAll(".onglet").forEach(t => t.addEventListener("click", () => allerA(t.dataset.vue)));
window.addEventListener("hashchange", () => montrerVue(vueActive()));

/* ---------- Réglages ---------- */
function ouvrirReglages(section) {
  $("#champ-api").value = stock.get(CLES.api) || API_URL; aRevoquer = null; $("#reglages").hidden = false; chargerCodes(); majMoiReglages();
  if (section) { const s = document.getElementById(section); if (s) setTimeout(() => { s.scrollIntoView({ block: "start" }); const i = s.querySelector("input"); if (i && !i.value) i.focus(); }, 30); }
}
$("#btn-reglages").addEventListener("click", () => ouvrirReglages());
/* Mon fichier (privé) : adresse et clé du fichier personnel, gardées sur l'appareil */
const MOI_CLES = { api: "versus.moi.api", cle: "versus.moi.cle" };
function adresseFichierValide(a) { return /^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(String(a || "").trim()); }
function majMoiReglages(msg) {
  const a = stock.get(MOI_CLES.api) || "", k = stock.get(MOI_CLES.cle);
  $("#moi-api").value = a; $("#moi-cle").value = "";
  $("#moi-cle").placeholder = k ? "Clé enregistrée (laisse vide pour la garder)" : "Clé d'accès";
  $("#moi-oublier").hidden = !a && !k;
  $("#moi-etat").textContent = msg || (a && k ? "Connecté sur cet appareil." : "Aucun fichier connecté sur cet appareil.");
  $("#moi-partage").checked = stock.get("versus.moi.partage") !== "non";
}
$("#moi-enregistrer").addEventListener("click", () => {
  const a = $("#moi-api").value.trim(), k = $("#moi-cle").value.trim();
  if (!adresseFichierValide(a)) { $("#moi-etat").textContent = "L'adresse doit commencer par https://script.google.com/ et finir par /exec."; return; }
  if (!k && !stock.get(MOI_CLES.cle)) { $("#moi-etat").textContent = "Saisis la clé de ton fichier."; return; }
  if (window.Moi) window.Moi.connecter(a, k);
  else { stock.set(MOI_CLES.api, a); if (k) stock.set(MOI_CLES.cle, k); stock.del("versus.moi.cache"); }
  majMoiReglages("Enregistré. Ouvre l'onglet Moi pour voir ton fichier.");
  prechaufferMoi();
  if (vueActive() === "moi") { $("#reglages").hidden = true; rendreMoi(); }
});
$("#moi-partage").addEventListener("change", e => { stock.set("versus.moi.partage", e.target.checked ? "oui" : "non"); });
$("#moi-tester-versus").addEventListener("click", async () => {
  const el = $("#moi-versus-etat");
  if (!window.Moi || !window.Moi.testerVersus) { el.textContent = "Ouvre d'abord l'onglet Moi une fois, puis réessaie."; return; }
  el.textContent = "Test en cours…";
  const r = await window.Moi.testerVersus();
  el.textContent = r && r.ok ? r.message : r && (r.erreur === "format" || /inconnu/i.test(r.message || "")) ? "Ton fichier n'a pas encore cette fonction : normal avant le transfert (elle arrive avec ta nouvelle adresse)." : (r && r.message) || "Test impossible.";
});
$("#moi-tester").addEventListener("click", async () => {
  const a = $("#moi-api").value.trim() || stock.get(MOI_CLES.api) || "", k = $("#moi-cle").value.trim() || stock.get(MOI_CLES.cle) || "";
  if (!adresseFichierValide(a) || !k) { $("#moi-etat").textContent = "Renseigne l'adresse (/exec) et la clé pour tester."; return; }
  $("#moi-etat").textContent = "Test en cours…";
  let rep;
  try { const j = await lireApi(a, k, "ping"); rep = j.ok ? "Ton fichier répond (API version " + (j.version || "?") + ")." : (j.message || "Clé refusée."); }
  catch (e) { rep = "Impossible de joindre cette adresse : vérifie qu'elle finit par /exec et que le déploiement est en accès « Tout le monde »."; }
  $("#moi-etat").textContent = rep;
});
$("#moi-oublier").addEventListener("click", () => {
  if (window.Moi) window.Moi.oublier(); else ["versus.moi.api", "versus.moi.cle", "versus.moi.cache"].forEach(k => stock.del(k));
  majMoiReglages("Fichier déconnecté de cet appareil (adresse, clé et copie locale effacées).");
  majCloche(null);
  if (vueActive() === "moi") rendreMoi();
});
$("#fermer-reglages").addEventListener("click", () => { $("#reglages").hidden = true; });
$("#reglages").addEventListener("click", e => { if (e.target.id === "reglages") $("#reglages").hidden = true; });
$("#saisie").addEventListener("click", e => { if (e.target.id === "saisie") $("#saisie").hidden = true; });
$("#fermer-saisie").addEventListener("click", () => { $("#saisie").hidden = true; });
/* ➕ : avec un fichier perso connecté, la feuille de saisie complète (ordre, journal, mises à jour, relevé Versus) ; sinon le relevé Versus */
$("#btn-saisie").addEventListener("click", () => { if (moiConnecte()) chargerModuleMoi(() => window.Moi.saisir(), ouvrirSaisie); else ouvrirSaisie(); });
document.querySelectorAll("[data-theme-choix]").forEach(b => b.addEventListener("click", () => { stock.set(CLES.theme, b.dataset.themeChoix); appliquerTheme(b.dataset.themeChoix); }));
$("#enregistrer-api").addEventListener("click", () => {
  const v = $("#champ-api").value.trim();
  if (v && !/^https:\/\/script\.google(usercontent)?\.com\//.test(v)) { $("#etat-source").textContent = "L'adresse doit être celle de la web app Apps Script (https://script.google.com/…/exec)."; return; }
  if (v) stock.set(CLES.api, v); else stock.del(CLES.api);
  $("#reglages").hidden = true; charger(true);
});
$("#oublier-cle").addEventListener("click", () => { stock.del(CLES.cle); $("#reglages").hidden = true; if (apiUrl()) ouvrirCle(""); });
$("#changer-cle").addEventListener("click", async () => {
  const n = $("#champ-nouvelle-cle").value.trim();
  if (simulation()) { $("#etat-source").textContent = MSG_SIMULATION; return; }
  if (SOURCE !== "api") { $("#etat-source").textContent = "Configure d'abord l'adresse de l'API."; return; }
  if (n.length < 12) { $("#etat-source").textContent = "La nouvelle clé doit faire au moins 12 caractères."; return; }
  let rep;
  try { rep = await envoyerApi(apiUrl(), { cle: stock.get(CLES.cle), action: "changerCle", nouvelleCle: n }); }
  catch (e) { rep = { ok: false, message: e.message }; }
  if (rep.ok) { stock.set(CLES.cle, n); $("#champ-nouvelle-cle").value = ""; }
  $("#etat-source").textContent = rep.message || (rep.ok ? "Clé changée." : "Changement impossible.");
});
$("#btn-maj").addEventListener("click", () => { charger(true); if (vueActive() === "moi" && window.Moi) window.Moi.rafraichir(true); });
function majChipsAffichage() {
  [["bandeau", "data-bandeau"], ["discret", "data-discret"], ["ouverture", "data-ouverture"]].forEach(([k, a]) =>
    document.querySelectorAll("[" + a + "]").forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute(a) === ETAT[k]))));
}
[["bandeau", "data-bandeau"], ["discret", "data-discret"], ["ouverture", "data-ouverture"]].forEach(([k, a]) =>
  document.querySelectorAll("[" + a + "]").forEach(b => b.addEventListener("click", () => {
    ETAT[k] = b.getAttribute(a); garder(); majChipsAffichage();
    if (D && k !== "ouverture") { rendreTicker(); rendreVue(vueActive()); }
  })));
$("#p-enregistrer").addEventListener("click", async () => {
  const t = lireNb($("#p-taux").value), m = $("#p-comp").value;
  if (!ok(t) || t < 0 || t > 20) { toast("Taux sans risque entre 0 et 20 %."); return; }
  const rep = await posterAdmin({ action: "parametres", tauxSansRisque: t / 100, dateComparaison: m ? m + "-01" : null });
  toast(rep.message || (rep.ok ? "Enregistré." : "Enregistrement impossible.")); if (rep.ok) charger(true);
});
/** Import depuis Portefeuille & Épargne pour le mois en cours :
 *  caché si le relevé du mois est déjà rempli, grisé avant le jour du relevé à l'heure prévue */
function etatImport() {
  const l = D && D.liaison;
  if (!l || !gestionAdmin() || SOURCE !== "api") return { visible: false };
  const now = new Date(), k = now.getFullYear() * 100 + now.getMonth() + 1, h = l.heure || 19;
  const p = D.personnes.find(x => x.nom === (l.personne || "Théo")); if (!p) return { visible: false };
  const r = p.rows.find(x => x[0] === k);
  if (r && aUnReleve(r[2])) return { visible: false, k, nom: p.nom };
  const jour = jourReleve(now.getFullYear(), now.getMonth() + 1); jour.setHours(h, 0, 0, 0);
  const pret = now >= jour && !!r;
  return { visible: true, k, nom: p.nom, actif: pret,
    texte: pret ? "C'est l'heure : importe tes valeurs de fin de mois en un clic." : "Disponible le " + String(jour.getDate()).padStart(2, "0") + "/" + String(jour.getMonth() + 1).padStart(2, "0") + " à partir de " + h + " h (après la clôture)." };
}
async function lancerImport(btn) {
  btn.disabled = true; const lib = btn.textContent; btn.textContent = "Import en cours…";
  const rep = await posterAdmin({ action: "importer" });
  toast(rep.message || (rep.ok ? "Relevé importé." : "Import impossible."));
  if (rep.ok && !rep.ignore) { await charger(true); return true; }
  btn.disabled = false; btn.textContent = lib; return false;
}
function majLiaison() {
  const im = etatImport(), bi = $("#liaison-import");
  bi.hidden = !im.visible; bi.disabled = !im.actif;
  bi.title = im.texte || "";
  const l = D.liaison || {};
  const qui = (l.personnes || [l.personne || "Théo"]).join(", ");
  $("#liaison-etat").textContent = l.active ? "Activée : le dernier jour ouvré de chaque mois, entre " + l.heure + " h et " + (l.heure + 1) + " h, les relevés de " + qui + " sont remplis depuis leurs fichiers « Portefeuille & Épargne ». Une saisie faite à la main n'est jamais écrasée."
    : "Désactivée. Une fois activée, les relevés de " + qui + " se remplissent seuls le dernier jour ouvré du mois après la clôture, depuis leurs fichiers « Portefeuille & Épargne ».";
  $("#liaison-bascule").textContent = l.active ? "Désactiver" : "Activer";
}
async function actionLiaison(action, corps) {
  $("#liaison-res").innerHTML = '<p class="info">En cours…</p>';
  const rep = await posterAdmin(Object.assign({ action }, corps || {}));
  $("#liaison-res").innerHTML = '<p class="info">' + esc(rep.message || (rep.ok ? "OK" : "Échec")) + "</p>" +
    (rep.detail ? rep.detail.map(d => "<div><span>" + esc(d.enveloppe) + "</span><b>" + eur(d.valeur, 2) + " · versé " + eur(d.verse, 2, true) + "</b></div>").join("") : "");
  return rep;
}
$("#liaison-bascule").addEventListener("click", async () => { const rep = await actionLiaison("liaison", { actif: !(D.liaison && D.liaison.active) }); if (rep.ok) { D.liaison = Object.assign({}, D.liaison, { active: !(D.liaison && D.liaison.active) }); majLiaison(); } });
$("#liaison-test").addEventListener("click", () => actionLiaison("testerLiaison"));
$("#liaison-import").addEventListener("click", async () => { const rep = await actionLiaison("importer"); if (rep.ok) { await charger(true); majLiaison(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#saisie").hidden = true; $("#reglages").hidden = true; $("#notifs").hidden = true; } });
let attente, largeur = window.innerWidth;
window.addEventListener("resize", () => { if (window.innerWidth === largeur) return; largeur = window.innerWidth; clearTimeout(attente); attente = setTimeout(() => { if (D) rendreVue(vueActive()); }, 150); });
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (D) rendreVue(vueActive()); });
document.addEventListener("visibilitychange", () => { if (document.hidden) return; if (SOURCE !== "demo") charger(false); if (window.Moi) { if (vueActive() === "moi") window.Moi.rafraichir(false); else window.Moi.prechauffer(); } });

/* ---------- Démarrage ---------- */
appliquerTheme(stock.get(CLES.theme) || "auto");
appliquerAccent(stock.get("versus.accent") || "violet");
document.querySelectorAll("[data-accent-choix]").forEach(b => b.addEventListener("click", () => { stock.set("versus.accent", b.dataset.accentChoix); appliquerAccent(b.dataset.accentChoix); if (D) rendreVue(vueActive()); }));
if (ETAT.ouverture === "fiche" || ETAT.ouverture === "moi") { ETAT.ouverture = "moi-jour"; garder(); }
/* Écran d'ouverture dans Moi : on prépare le sous-onglet avant le chargement du module */
(function () {
  const m = /^moi-(jour|patrimoine|stats|missions)$/.exec(ETAT.ouverture || ""); if (!m || location.hash) return;
  try { const p = JSON.parse(stock.get("versus.moi.pref") || "{}"); p.onglet = m[1]; stock.set("versus.moi.pref", JSON.stringify(p)); } catch (e) { /* préférences illisibles */ }
})();
/* ---------- Nouvelle version en ligne ? (comparée à celle de la page sur GitHub) ---------- */
async function verifierMiseAJour() {
  if (location.protocol !== "https:") return;
  try {
    const t = await (await fetch(location.pathname.replace(/[^/]*$/, "") + "version.js?t=" + Date.now(), { cache: "no-store" })).text();   // jamais gardé par sw.js
    const m = /app:\s*"([^"]+)"/.exec(t); if (!m || m[1] === APP_VERSION) return;
    const b = $("#maj-band"); if (!b) return;
    b.hidden = false;
    b.innerHTML = "<span>🆕 Version " + esc(m[1]) + " disponible (tu as la " + APP_VERSION + ").</span>" + '<button class="lien" type="button" id="maj-go">Mettre à jour</button>';
    $("#maj-go").addEventListener("click", async () => { try { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); } catch (e) { /* rien */ } location.reload(); });
  } catch (e) { /* hors ligne : on réessaiera */ }
}
/* ---------- Version affichée dans les Réglages ---------- */
function majVersion() {
  const el = $("#version-app"); if (!el) return;
  const api = D && D.version ? "API V" + D.version : SOURCE === "demo" ? "API : démo" : "API : —";
  el.innerHTML = "<b>Versus " + esc(APP_VERSION) + "</b> · " + esc(APP_DATE) + "<br>" + esc(api) + (navigator.serviceWorker && navigator.serviceWorker.controller ? " · hors connexion prêt ✓" : "");
}
