/* Versus · le jeu : verdict du mois, positions, confettis (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   LE JEU : verdict du mois, positions, duel, confettis
   Tout est calculé à partir des relevés existants, rien n'est stocké.
   ============================================================ */
/** Référence fixe de la saison (bonus, défis) : portefeuille total contre le S&P 500, quels que soient les filtres */
function iRef() { const i = D.marche.indices.findIndex(n => /S&P\s*500/i.test(n)); return i < 0 ? 0 : i; }
function rangTxt(n) { return n === 1 ? "1er" : n + "e"; }
function aRendement(p, env, k) { return serie(p, env).some(z => z.k === k && typeof z.r === "number"); }
function rendementsDuMois(env, k) {
  return D.personnes.map(p => { const x = serie(p, env).find(z => z.k === k && typeof z.r === "number"); return x ? { nom: p.nom, r: x.r } : null; }).filter(Boolean);
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
  return [...new Set(D.personnes.flatMap(p => serie(p, env).filter(z => typeof z.r === "number" && z.k <= fin).map(z => z.k)))]
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
  const c = (titre, nom, ligne) => '<div class="v-c"><span>' + titre + "</span><b" + (nom && D.personnes.some(p => p.nom === nom) ? ' style="color:' + couleur(nom) + '"' : "") + ">" + esc(nom || "—") + "</b><em>" + ligne + "</em></div>";
  return '<div class="verdict"><div class="v-h"><span>' + navVerdict(v) + "Verdict · " + esc(moisLong(v.k)) + (v.env ? " · " + esc(ENVELOPPES[v.env]) : "") + '</span></div><div class="v-g">' +
    (() => {
      const n = v.du.length, idxOk = v.iR !== null, impair = (n + (idxOk ? 1 : 0)) % 2 === 1;
      const rangDe = x => v.du.findIndex(y => Math.abs(y.r - x.r) < 1e-9) + 1;        // ex aequo : même place
      const rangDernier = rangDe(v.du[n - 1]);
      const tuiles = v.du.map(x => {
        const rg = rangDe(x), ico = rg === 1 ? "🥇" : rg === 2 ? "🥈" : rg === 3 ? "🥉" : "";
        const tortue = n >= 3 && rg === rangDernier && rg > 1, bat = idxOk && x.r > v.iR;
        const cls = "v-c" + (rg === 1 ? " champ" : "") + (rg === 1 && impair && x === v.du[0] ? " large" : "");
        return '<div class="' + cls + '"><span>' + (ico ? ico + " " : "") + rangTxt(rg) + (rg === 1 ? " · champion" : tortue ? " · lanterne rouge 🐢" : "") + "</span>" +
          '<b style="color:' + couleur(x.nom) + '">' + esc(x.nom) + '</b><em class="' + sens(x.r) + '">' + pct(x.r) + (bat ? ' <i title="Bat ' + esc(D.marche.indices[ETAT.i1]) + '">🎯</i>' : "") + "</em></div>";
      }).join("");
      const tIdx = idxOk ? '<div class="v-c idx"><span>🎯 ' + esc(D.marche.indices[ETAT.i1]) + "</span><b>" + pct(v.iR) + "</b><em>" +
        (v.battent.length ? v.battent.length + " sur " + n + " l'" + (v.battent.length > 1 ? "ont" : "a") + " battu" : "personne ne l'a battu") + "</em></div>" : "";
      return tuiles + tIdx;
    })() +
    '</div><p class="v-n">Uniquement le mois de ' + esc(moisLong(v.k)) + ". Sur un seul mois, la chance pèse plus que le talent.</p></div>";
}
function brancherVerdict(v) {
  const boite = $("#boite-verdict"); if (!boite) return;
  boite.querySelectorAll("[data-vk]").forEach(b => b.addEventListener("click", () => {
    const k = +b.dataset.vk, l = moisVerdict(ETAT.env);
    VK = k === l[l.length - 1] ? null : k;
    const nv = verdictMois(ETAT.env, k);
    boite.innerHTML = carteVerdict(nv); brancherVerdict(nv);
  }));
}

