/* Versus · le jeu : verdict du mois, positions, confettis (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   LE JEU : verdict du mois, positions, duel, confettis
   Tout est calculé à partir des relevés existants, rien n'est stocké.
   ============================================================ */
/** Référence fixe de la saison (bonus, défis) : portefeuille total contre le S&P 500, quels que soient les filtres */
function iRef() { const i = D.marche.indices.findIndex(n => /S&P\s*500/i.test(n)); return i < 0 ? 0 : i; }
function rangTxt(n) { return n === 1 ? "1er" : n + "e"; }
/** v20.25 (Théo, 24/11) · un pilote entre au jeu au PREMIER MOIS COMPLET : à partir du tour de chauffe, le mois ne compte pour lui
    que s'il avait déjà une valeur positive à un relevé antérieur (un compte ouvert ou alimenté en cours de mois attend le mois suivant ;
    un relevé oublié ne fait pas perdre le mois d'après).
    Les mois d'avant décembre 2026 (historique, hors jeu) ne changent pas. */
const DEBUT_MOIS_COMPLET = 202612;
function rJeu(p, env, k) {
  const s = serie(p, env), x = s.find(z => z.k === k && typeof z.r === "number"); if (!x) return null;
  if (k >= DEBUT_MOIS_COMPLET && !s.some(z => z.k < k && z.val > 0)) return null;
  return x.r;
}
/** La série d'un pilote telle que le jeu la voit : le mois d'ouverture n'a pas de rendement (victoires, duels, palmarès) */
function serieJeu(p, env) { return serie(p, env).map(z => typeof z.r === "number" && rJeu(p, env, z.k) === null ? Object.assign({}, z, { r: null }) : z); }
function aRendement(p, env, k) { return rJeu(p, env, k) !== null; }
function rendementsDuMois(env, k) {
  return D.personnes.map(p => { const r = rJeu(p, env, k); return r !== null ? { nom: p.nom, r } : null; }).filter(Boolean);
}
/** Places au classement cumulé ]deb, k] (seulement les personnes qui ont un relevé ce mois-là) */
function rangs(env, deb, k) {
  const l = D.personnes.filter(p => aRendement(p, env, k)).map(p => ({ nom: p.nom, t: stats(D, p, env, deb, k, null, null).twr })).filter(x => ok(x.t)).sort((a, b) => b.t - a.t);
  const o = {}; l.forEach((x, i) => o[x.nom] = i + 1); return o;
}
function debAnnee(k) { return (Math.floor(k / 100) - 1) * 100 + 12; }

/* ---------- Verdict du mois ---------- */
function verdictMois(env, k) {
  const fin = k || finGlobale(D, env); if (!fin) return null;
  const du = rendementsDuMois(env, fin).sort((a, b) => b.r - a.r);
  const prev = cleMoins(fin, 1);
  const attendus = D.personnes.filter(p => aRendement(p, env, prev) || aRendement(p, env, fin)).map(p => p.nom);
  const manquent = attendus.filter(n => !du.some(x => x.nom === n));
  if (du.length < 2) return manquent.length && du.length ? { k: fin, env, du, manquent, complet: false } : null;
  let remontee = null;
  if (fin % 100 > 1) {
    const avant = rangs(env, debAnnee(fin), prev), apres = rangs(env, debAnnee(fin), fin);
    Object.keys(apres).forEach(n => { const g = (avant[n] || 0) - apres[n]; if (avant[n] && g > 0 && (!remontee || g > remontee.gain)) remontee = { nom: n, de: avant[n], a: apres[n], gain: g }; });
  }
  const tete = Object.entries(rangs(env, debAnnee(fin), fin)).find(([, r]) => r === 1);
  const leader = tete ? { nom: tete[0], t: stats(D, D.personnes.find(p => p.nom === tete[0]), env, debAnnee(fin), fin, null, null).twr } : null;
  const iR = (D.marche.mois.find(l => l[0] === fin) || [])[ETAT.i1 + 1];
  const exaequo = (r) => du.filter(x => Math.abs(x.r - r) < 1e-9).map(x => x.nom).join(" et ");
  return { k: fin, env, du, champion: { nom: exaequo(du[0].r), r: du[0].r, seul: du[0].r - du[1].r > 1e-9 }, lanterne: { nom: exaequo(du[du.length - 1].r), r: du[du.length - 1].r }, remontee, leader, iR: ok(iR) ? iR : null,
    battent: ok(iR) ? du.filter(x => x.r > iR).map(x => x.nom) : null, manquent, complet: !manquent.length };
}
/** Mois qui ont un verdict possible (au moins deux relevés) */
function moisVerdict(env) {
  const fin = finGlobale(D, env);
  return [...new Set(D.personnes.flatMap(p => serie(p, env).filter(z => z.k <= fin && rJeu(p, env, z.k) !== null).map(z => z.k)))]
    .filter(k => rendementsDuMois(env, k).length >= 2).sort((a, b) => a - b);
}
let VK = null;   // mois du verdict affiché (null = le dernier)
function navVerdict(v) {
  const l = moisVerdict(v.env), i = l.indexOf(v.k);
  const b = (sens, cible, lib) => '<button class="nav-v" type="button" aria-label="' + lib + '"' + (cible ? ' data-vk="' + cible + '"' : " disabled") + ">" + sens + "</button>";
  return '<span class="navs">' + b("‹", i > 0 ? l[i - 1] : null, "Mois précédent") + b("›", i >= 0 && i < l.length - 1 ? l[i + 1] : null, "Mois suivant") + "</span>";
}
function carteVerdict(v) {
  if (!v) return "";
  if (!v.complet) return '<div class="bref">⏳ Verdict de <b>' + esc(moisLong(v.k)) + "</b> dès que tout le monde a saisi son relevé : il manque " + v.manquent.map(n => "<b>" + esc(n) + "</b>").join(" et ") + "." +
    (moisVerdict(v.env).some(k => k < v.k) ? ' <button class="lien" type="button" data-vk="' + moisVerdict(v.env).filter(k => k < v.k).pop() + '">Voir le verdict précédent</button>' : "") + "</div>";
  // V15.8 · le verdict en podium : marches 2-1-3, pilotes qui tombent sur leur marche, couronne pour le vainqueur ; puis les suivants et l'indice
  const n = v.du.length, idxOk = v.iR !== null, nomI = esc(D.marche.indices[ETAT.i1]);
  const rangDe = x => v.du.findIndex(y => Math.abs(y.r - x.r) < 1e-9) + 1, rangDernier = rangDe(v.du[n - 1]);
  const tete = nom => (typeof avatar === "function" && saisonVisible() ? avatar(nom) : '<span class="vp-ini" style="--c:' + couleur(nom) + '">' + esc(nom.slice(0, 1)) + "</span>");
  const marche = (x, place) => {
    if (!x) return '<div class="vp-m vp-' + place + ' vide"></div>';
    const rg = rangDe(x), bat = idxOk && x.r > v.iR;
    return '<div class="vp-m vp-' + place + (rg === 1 ? " champ" : "") + '" style="--c:' + couleur(x.nom) + '" data-fiche="' + esc(x.nom) + '" role="button" tabindex="0" aria-label="Fiche de ' + esc(x.nom) + '">' +
      '<div class="vp-p">' + (rg === 1 ? '<span class="vp-cour" aria-hidden="true">🥇</span>' : "") + tete(x.nom) + '<b style="color:' + couleur(x.nom) + '">' + esc(x.nom) + "</b>" + (typeof plaqueDe === "function" && plaqueDe(x.nom) ? '<span class="vp-plq">' + plaqueDe(x.nom) + "</span>" : "") +
      '<em class="' + sens(x.r) + '" data-cv="' + x.r + '" data-cf="pct">' + pct(x.r) + "</em>" + (bat ? '<i class="vp-bat" title="Bat ' + nomI + '">🎯</i>' : "") + "</div>" +
      '<div class="vp-s"><span class="vp-rg">' + rg + "</span>" + (rg === 1 ? "<small>champion</small>" : "") + "</div></div>";
  };
  const top = v.du.slice(0, 3), suite = v.du.slice(3);
  const autres = suite.map(x => { const rg = rangDe(x), tortue = n >= 3 && rg === rangDernier && rg > 1, bat = idxOk && x.r > v.iR;
    return '<div class="vp-l' + (tortue ? " lanterne" : "") + '" data-fiche="' + esc(x.nom) + '" role="button" tabindex="0" aria-label="Fiche de ' + esc(x.nom) + '"><span class="vp-lrg">' + rangTxt(rg) + "</span>" + tete(x.nom) + '<b style="color:' + couleur(x.nom) + '">' + esc(x.nom) + "</b>" + (tortue ? '<span class="vp-tag">🐢 lanterne rouge</span>' : "") +
      '<em class="' + sens(x.r) + '">' + pct(x.r) + (bat ? " 🎯" : "") + "</em></div>"; }).join("");
  const barreIdx = idxOk ? '<div class="vp-idx"><span>🎯 ' + nomI + " <b>" + pct(v.iR) + "</b></span><span>" + (v.battent.length ? v.battent.length + " sur " + n + " l'" + (v.battent.length > 1 ? "ont" : "a") + " battu" : "personne ne l'a battu") +
    '</span><span class="vp-jauge" aria-hidden="true">' + v.du.map(x => '<i style="background:' + (x.r > v.iR ? "var(--up)" : "var(--rule)") + '"></i>').join("") + "</span></div>" : "";
  return '<div class="verdict vp"><div class="v-h"><span>' + navVerdict(v) + "Verdict · " + esc(moisLong(v.k)) + (v.env ? " · " + esc(ENVELOPPES[v.env]) : "") + "</span></div>" +
    '<div class="vp-podium">' + marche(top[1], 2) + marche(top[0], 1) + marche(top[2], 3) + "</div>" +
    (autres ? '<div class="vp-suite">' + autres + "</div>" : "") + barreIdx +
    '<p class="v-n">Uniquement le mois de ' + esc(moisLong(v.k)) + ". Sur un seul mois, la chance pèse plus que le talent. Touche un pilote pour sa fiche.</p></div>";
}
function brancherVerdict(v) {
  const boite = $("#boite-verdict"); if (!boite) return;
  boite.querySelectorAll("[data-fiche]").forEach(b => { const go = () => { ETAT.fiche = b.dataset.fiche; garder(); allerA("fiche"); };
    b.addEventListener("click", go); b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); });
  boite.querySelectorAll("[data-vk]").forEach(b => b.addEventListener("click", () => {
    const k = +b.dataset.vk, l = moisVerdict(ETAT.env);
    VK = k === l[l.length - 1] ? null : k;
    const nv = verdictMois(ETAT.env, k);
    boite.classList.remove("calme"); boite.innerHTML = carteVerdict(nv); brancherVerdict(nv); compterChiffres(boite);
  }));
}

