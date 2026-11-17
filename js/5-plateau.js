/* Versus · jeu de plateau : pioche, étapes, règles, tutoriel, saisie (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   JEU DE PLATEAU · pioche, niveaux d'écurie, duels, mois spéciaux
   Tout se calcule à partir des relevés publics du Versus, de façon déterministe :
   chacun voit le même résultat sur son téléphone.
   ============================================================ */
const CARTES_BONUS = [
  { id: "undercut", ico: "✂️", nom: "Undercut", def: "Si ton mois est positif : +1 ; s'il dépasse +2 % : +2.", court: "+1 / +2 si ton mois monte", bonus: true },
  { id: "jaune", ico: "🟨", nom: "Drapeau jaune", def: "Si tu finis dernier du mois : +2 pour limiter la casse.", court: "+2 si tu finis dernier", bonus: true },
  { id: "safety", ico: "🚨", nom: "Safety car", def: "Si tu es à 6 points ou plus du leader avant ce mois : +2. Inactive en janvier (pas encore de classement).", court: "+2 si tu es loin du leader", bonus: true },
  { id: "arret", ico: "⏱️", nom: "Arrêt éclair", def: "Si tu finis mieux classé ce mois-ci que le mois d'avant : +2. Inactive en janvier (pas de mois d'avant).", court: "+2 si tu progresses", bonus: true }
];
/* ---------- Nouveautés au goutte-à-goutte : chaque règle s'ouvre à sa date ----------
   ouvre = premier mois où la règle compte. Elle est annoncée (et expliquée) le 20 du mois d'avant, à l'ouverture de sa fenêtre.
   Avant ça, on ne montre que son nom et son mois. Pour avancer ou repousser une étape : changer « ouvre ». */
const ETAPES = [
  { id: "circuits", ico: "🗺️", nom: "L'atout des circuits", ouvre: 202701, regle: "circuits", resume: "Chaque Grand Prix favorise une carte : +1 quand elle marque. Secret jusqu'au 2 (un indice avant), et bouchon si plusieurs la jouent." },
  { id: "pioche", ico: "🎴", nom: "Le rattrapage", ouvre: 202701, regle: "pioche", resume: "Tu finis dernier d'un mois ? Tu pioches une carte bonus (une fois par saison chacune), à jouer à partir du mois suivant. Tes cartes piochées t'attendent dans le Stand." },
  { id: "monaco", ico: "🎲", nom: "Le Plateau maudit", ouvre: 202701, regle: "speciaux", resume: "Un mois de la saison, le dernier du championnat marque ses points de place en double. La date est dans le calendrier du Grand Prix." },
  { id: "pieges", ico: "🪤", nom: "Les pièges des circuits", ouvre: 202701, regle: "circuits", resume: "Chaque circuit sans mois spécial a son piège, une petite règle qui ne vaut que ce mois-là (Feux follets dans la Forêt aux lucioles, Couloirs mouvants au Château, Surchauffe chez les Androïdes…). Il s\'affiche dès le 20 du mois d\'avant, avec la carte." },
  { id: "gpspeciaux", ico: "🏁", nom: "Le Solstice et les Survivants", ouvre: 202701, regle: "speciaux", resume: "Juillet au Village du solstice : le vainqueur du mois marque +2 de plus (le Sacre). Septembre à la Ville des survivants : le 🎯 vaut +2 au lieu de +1 (Instinct de survie)." },
  { id: "prono", ico: "🔮", nom: "Le pronostic du mois", ouvre: 202701, regle: "championnat", resume: "Dans la fenêtre de ta carte : qui gagne le mois (+1 si juste) et le S&P 500 fera-t-il plus de +1 % (+1 si juste). Secret jusqu'au 2." },
  { id: "pole", ico: "🅿️", nom: "La pole position", ouvre: 202701, regle: "championnat", resume: "Avec ton pronostic, donne ton chiffre pour le S&P 500 du mois (ex. +1,8 %). Le plus proche marque +1 (partagé en cas d'égalité)." },
  { id: "defi", ico: "🏁", nom: "Le défi du mois", ouvre: 202701, regle: "championnat", resume: "Chaque mois a son défi (battre le Nasdaq, faire mieux que l'or, finir positif…), annoncé le 20 du mois d'avant : +1 à chaque pilote qui le réussit." },
  { id: "rival", ico: "😈", nom: "Le rival de la saison", ouvre: 202701, regle: "championnat", resume: "Entre le 20 décembre et le 1er janvier, choisis un rival secret. Fin décembre, si tu finis devant lui au championnat : +3. Révélé à la Finale." },
  { id: "regularite", ico: "🛡️", nom: "Le trophée de la régularité", ouvre: 202712, regle: "speciaux", resume: "Fin de saison : +3 au pilote qui a fini le moins souvent dernier (départage : le plus de mois positifs)." },
  { id: "vote", ico: "🗳️", nom: "Le vote de fin de saison", ouvre: 202712, regle: "speciaux", resume: "Du 2 au 31 décembre, vote pour « le coup de la saison » (pas pour toi). Résultat le 1er janvier : le gagnant reçoit la plaque « Coup de la saison »." },
  { id: "equipe", ico: "🤝", nom: "Le bonus d'équipe", ouvre: 202701, regle: "championnat", resume: "Si tous les pilotes battent le S&P 500 le même mois : +1 pour chacun." },
  { id: "serie", ico: "🔥", nom: "La série", ouvre: 202701, regle: "championnat", resume: "+1 à chaque 3e mois d'affilée sans finir dernier (3 mois, 6 mois…). La série repart de zéro dès que tu finis dernier." },
  { id: "finale", ico: "🏆", nom: "La Finale", ouvre: 202712, regle: "speciaux", resume: "Décembre, dernier mois de la saison : les points de place comptent double pour tout le monde." },
  { id: "duels", ico: "⚔️", nom: "Les duels", reserve: true, regle: "duels", resume: "Chaque mois, tu peux défier un rival, dans la même fenêtre que ta carte. Le meilleur du mois lui prend 1 point." },
  /* Réserve : des idées codées et prêtes, mais éteintes. Rien ne s'en voit, rien ne compte, tant que l'admin ne leur donne pas une date
     (Podium › tout en bas › « Règles et idées en réserve »). */
  { id: "niveaux", ico: "⭐", nom: "Les niveaux d'écurie", reserve: true, regle: "niveaux", resume: "Tes points de place et tes 🎯 donnent de l'XP. Chaque niveau gagné te fait piocher une carte bonus de plus." },
  { id: "atelier", ico: "🔧", nom: "L'atelier", reserve: true, regle: "niveaux", resume: "Chaque niveau te donne un point à placer en Moteur, Aéro ou Pneus, pour renforcer Turbo, Aspiration et Pneus pluie." }
];
function etape(id) { return ETAPES.find(e => e.id === id) || null; }
/** Mois d'ouverture : celui réglé par l'admin dans l'API s'il y en a un, sinon celui du calendrier */
function programmee(e) { const o = typeof D !== "undefined" && D && D.etapes && +D.etapes[e.id]; return o >= 202601 ? o : 0; }
function ouvreEtape(e) { return programmee(e) || e.ouvre || 999912; }
/** Règle en réserve : codée mais éteinte, tant que l'admin ne lui a pas donné de date */
function enReserve(e) { return !!(e && e.reserve && !programmee(e)); }
function etapesJeu() { return ETAPES.filter(e => !enReserve(e)); }
function annonceEtape(e) { return cleMoins(ouvreEtape(e), 1) * 100 + 20; }
/** La règle compte-t-elle pour le mois k ? (l'aperçu admin montre tout) */
function regleActive(id, k) { const e = etape(id); if (enReserve(e)) return false; if (apercuSaison()) return true; return !e || (!!k && k >= ouvreEtape(e)); }
/** La règle est-elle déjà annoncée (expliquée) ? */
function regleVisible(id) { const e = etape(id); if (enReserve(e)) return false; if (apercuSaison()) return true; return !e || aujNum() >= annonceEtape(e); }
function moisEtape(e) { return moisLong(ouvreEtape(e)); }
/** Les nouveautés pas encore annoncées : leur nom et leur mois, rien de plus */
function htmlProchainement(compact) {
  const l = etapesJeu().filter(e => !regleVisible(e.id)); if (!l.length) return "";
  const adm = estAdmin(), tag = adm ? "button" : "span";
  return '<div class="bientot' + (compact ? " compact" : "") + '"><span class="bt-k">🎁 Prochainement' + (adm ? " · admin : touche une règle pour la voir et régler sa date" : "") + "</span>" +
    l.map(e => "<" + tag + ' class="bt-e"' + (adm ? ' type="button" data-etape="' + e.id + '"' : "") + "><i>" + (adm ? "🔒" : e.ico) + "</i><b>" + esc(e.nom) + "</b><em>" + esc(moisEtape(e).replace(/ \d{4}$/, "")) + "</em></" + tag + ">").join("") + "</div>";
}
/* Admin : voir une règle à venir et régler sa date (enregistrée dans l'API, pour tout le monde) */
function ouvrirEtapeAdmin(id) {
  const e = etape(id); if (!e || !estAdmin()) return;
  const o = document.createElement("div"); o.className = "tuto"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  const base = new Date(), mois = []; for (let i = 0; i < 18; i++) { const d = new Date(base.getFullYear(), base.getMonth() + i, 1); mois.push(d.getFullYear() * 100 + d.getMonth() + 1); }
  const res = enReserve(e), cur = res ? (moisCarteOuvert() || prochaineFenetre().k) : ouvreEtape(e), visible = regleVisible(e.id), mo = moisCarteOuvert() || prochaineFenetre().k;
  o.innerHTML = '<div class="tuto-c etape-adm"><span class="tuto-k">Admin · ' + (res ? "🧪 en réserve, éteinte" : visible ? "déjà annoncée" : "🔒 pas encore visible") + '</span><div class="tuto-i">' + e.ico + "</div><h3>" + esc(e.nom) + "</h3><p>" + esc(e.resume) + "</p>" +
    (res ? '<p class="ea-date">En réserve : personne ne la voit, elle ne compte pas. Donne-lui une date pour la mettre en jeu ; elle sera annoncée le 20 du mois d\'avant.</p>'
      : '<p class="ea-date">S\'ouvre pour <b>' + esc(moisLong(cur)) + "</b>" + (visible ? "" : " · annoncée aux autres le " + esc(String(annonceEtape(e) % 100)) + " " + esc(moisLong(cleMoins(cur, 1)))) + ".</p>") +
    '<label class="ea-l">Nouvelle date <select id="ea-mois">' + mois.map(k => '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(moisLong(k)) + "</option>").join("") + "</select></label>" +
    '<div class="btn-row"><button class="btn acc" type="button" data-ea="date">Enregistrer la date</button><button class="btn ghost" type="button" data-ea="maintenant">Ouvrir pour ' + esc(moisLong(mo).replace(/ \d{4}$/, "")) + "</button></div>" +
    '<div class="btn-row"><button class="btn ghost" type="button" data-ea="regle">Voir la règle complète</button><button class="btn ghost" type="button" data-ea="origine"' + (res ? " disabled" : "") + ">" + (e.reserve ? "Remettre en réserve" : "Date d'origine") + "</button></div>" +
    '<button class="lien" type="button" data-ea="fermer">Fermer</button></div>';
  document.body.appendChild(o);
  const fermer = () => o.remove();
  o.addEventListener("click", ev => { if (ev.target === o) fermer(); });
  const regler = async k => {
    fermer();
    if (SOURCE !== "api") { D.etapes = Object.assign({}, D.etapes || {}); if (k) D.etapes[e.id] = k; else delete D.etapes[e.id]; MEMO_SAISON = { d: null, m: {} }; toast("Aperçu : date réglée sur cet appareil seulement."); rendreVue(vueActive()); majRappels(); return; }
    const rep = await posterAdmin({ action: "etapes", id: e.id, ouvre: k || null });
    toast(rep.message || (rep.ok ? "Enregistré." : "Impossible d'enregistrer."));
    if (rep.ok) { D.etapes = rep.etapes || {}; stock.set(CLES.cache, JSON.stringify(D)); MEMO_SAISON = { d: null, m: {} }; rendreVue(vueActive()); majRappels(); }
  };
  o.querySelector('[data-ea="date"]').addEventListener("click", () => regler(+o.querySelector("#ea-mois").value));
  o.querySelector('[data-ea="maintenant"]').addEventListener("click", () => regler(mo));
  o.querySelector('[data-ea="origine"]').addEventListener("click", () => regler(null));
  o.querySelector('[data-ea="regle"]').addEventListener("click", () => { fermer(); if (e.reserve) ouvrirReserve(); else ouvrirRegles(e.regle, true); });
  o.querySelector('[data-ea="fermer"]').addEventListener("click", fermer);
}
document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("[data-etape]"); if (b) { ev.preventDefault(); const r = document.querySelector(".regles"); if (r) { r.remove(); document.documentElement.classList.remove("fige"); } ouvrirEtapeAdmin(b.dataset.etape); } });
/* ---------- Admin : règles et idées en réserve ----------
   Tout ce qui a été imaginé reste dans le code. Ici : ce qui est en jeu (et quand), ce qui dort (et comment le réveiller),
   les réglages chiffrés, et les idées pas encore codées. Les autres joueurs ne voient jamais cette page. */
const IDEES_FUTURES = [
  ["🗺️", "Circuit bonus", "Le mois où quelqu'un décroche un exclusif, un Grand Prix spécial remplace la ville du mois."],
  ["🔁", "Saison 2 : nouveaux tracés", "D'autres villes ou les mêmes villes à l'envers, pour renouveler la course chaque saison."],
  ["🎴", "Nouvelles cartes", "Ajouter une carte à la main de base ou à la pioche (une seule à la fois, pour garder le jeu lisible)."]
];
function ouvrirReserve() {
  if (!adminActif()) return;
  const o = document.createElement("div"); o.className = "regles"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Règles et idées en réserve");
  const auj = aujNum();
  const etat = e => enReserve(e) ? "🧪 en réserve" : regleActive(e.id, Math.floor(auj / 100)) ? "✅ en jeu depuis " + moisLong(ouvreEtape(e)) : regleVisible(e.id) ? "📣 annoncée · compte dès " + moisLong(ouvreEtape(e)) : "🔒 " + moisLong(ouvreEtape(e)) + " (annoncée le 20 du mois d'avant)";
  const ligne = e => '<li><button type="button" class="lien" data-etape="' + e.id + '">' + e.ico + " " + esc(e.nom) + "</button> · <small>" + esc(etat(e)) + "</small><br><small>" + esc(e.resume) + "</small></li>";
  const tmp = document.createElement("div"); tmp.innerHTML = htmlRegles(true, true);
  const sect = id => { const x = tmp.querySelector("#rg-" + id); return x ? x.outerHTML.replace('id="rg-', 'id="rs-') : ""; };
  const reserve = ETAPES.filter(e => e.reserve);
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>🧪 Règles et idées en réserve</b><button class="icon-btn rg-x" type="button" id="rg-x" aria-label="Fermer">✕</button></div><div class="rg-corps">' +
    '<p class="rg-admin">👀 Admin seulement. On commence simple ; tout le reste est codé et attend ici. Touche une règle pour lui donner une date (elle sera annoncée le 20 du mois d\'avant) ou la remettre en réserve.</p>' +
    '<section class="rg-s"><h4>✅ En jeu</h4><ul><li>🏁 Championnat : ' + BAREME.join(" · ") + ' points, +1 🎯 si tu bats l\'indice.</li><li>🏎️ Grand Prix : un circuit à thème par mois, ' + TOUR_GP + " points le tour.</li><li>🃏 Main de base : " + CARTES.map(c => c.ico + " " + esc(c.nom)).join(", ") + " (une par mois, rejouables mais pas deux mois de suite ; le Pari prévient sa cible).</li><li>⚔️ Duels, 🎴 rattrapage et 🗺️ atout des circuits : dès janvier 2027.</li><li>🏆 Trophées : défis, exclusifs, secrets, Premier millionnaire → objets d'écurie.</li><li>🏎️ Écurie : cosmétiques seulement.</li></ul>" +
      "<p><b>Calendrier des nouveautés</b></p><ul>" + etapesJeu().map(ligne).join("") + "</ul></section>" +
    '<section class="rg-s"><h4>🧪 En réserve <small>codé, éteint</small></h4><ul>' + reserve.map(ligne).join("") + "</ul>" +
      "<p><b>Ce qu'elles font, en détail</b> (le texte que les joueurs liront si tu les mets en jeu) :</p>" + sect("niveaux") + "</section>" +
    '<section class="rg-s"><h4>⚙️ Réglages actuels</h4><ul><li>Points de place : ' + BAREME.join(" · ") + ' ; 🎯 : +1 (Turbo : +3).</li><li>Un tour de circuit : ' + TOUR_GP + " points.</li><li>Gain maximum d'une carte : +" + PLAFOND_CARTE + ".</li><li>Atout du circuit : +1 si la carte marque ; bouchon (pas de +1) si au moins deux pilotes marquent avec.</li><li>Duels : +1 / −1, un seul par paire et par mois ; égalité = 0 (Pari aussi).</li><li>Plateau maudit : le dernier du championnat ×2 (mois tiré entre avril et octobre) ; Finale : tout le monde ×2 en décembre.</li><li>Rattrapage : 1 carte bonus quand tu finis dernier (4 cartes bonus, mélangées par pilote et par saison).</li><li>Niveaux (en réserve) : " + XP_NIVEAU + " XP par niveau, niveau " + NIV_MAX + " au plus ; atelier : +1 par niveau sur une carte, 2 au plus.</li></ul><p class=\"rg-admin\">Pour changer un chiffre : une session de modification (constantes en haut des règles dans le code).</p></section>" +
    '<section class="rg-s"><h4>💡 Idées à creuser <small>pas encore codées</small></h4><ul>' + IDEES_FUTURES.map(([i, t, d]) => "<li><b>" + i + " " + esc(t) + "</b> : " + esc(d) + "</li>").join("") + "</ul></section>" +
    "</div></div>";
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  const fermer = () => { o.remove(); document.documentElement.classList.remove("fige"); };
  o.addEventListener("click", e => { if (e.target === o) fermer(); });
  o.querySelector("#rg-x").addEventListener("click", fermer);
}
/* Annonce d'une nouvelle règle, une fois, le jour où elle s'ouvre */
function nouveautesAVoir() {
  if (typeof D === "undefined" || !D || apercuSaison() || !saisonVisible()) return [];
  return etapesJeu().filter(e => regleVisible(e.id) && !stock.get("versus.nouveaute." + e.id));
}
function ouvrirNouveautes(l) {
  l.forEach(e => stock.set("versus.nouveaute." + e.id, "1"));
  const o = document.createElement("div"); o.className = "tuto"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div class="tuto-c' + (l.length > 2 ? " multi" : "") + '"><span class="tuto-k">' + (l.length > 1 ? "Nouvelles règles" : "Nouvelle règle") + "</span>" + l.map(e => '<div class="tuto-i">' + e.ico + "</div><h3>" + esc(e.nom) + "</h3><p>" + esc(e.resume) + "</p>").join("") +
    '<div class="btn-row"><button class="btn ghost" type="button" data-nv="regles">Lire la règle</button><button class="btn acc" type="button" data-nv="ok">Compris 🏁</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener("click", ev => { if (ev.target === o) o.remove(); });
  o.querySelector('[data-nv="ok"]').addEventListener("click", () => o.remove());
  o.querySelector('[data-nv="regles"]').addEventListener("click", () => { o.remove(); ouvrirRegles(l[0].regle); });
}
function carteDef(id) { return CARTES.find(z => z.id === id) || CARTES_BONUS.find(z => z.id === id) || null; }
const AMELIOS = {
  m: { ico: "🔧", nom: "Moteur", carte: "turbo", txt: "Turbo : +1 par niveau" },
  a: { ico: "🪽", nom: "Aéro", carte: "aspiration", txt: "Aspiration : +1 par niveau" },
  p: { ico: "🛞", nom: "Pneus", carte: "pluie", txt: "Pneus pluie : +1 par niveau" }
};
const XP_NIVEAU = 15, NIV_MAX = 7, PLAFOND_CARTE = 4;
function niveauXP(xp) { return Math.min(NIV_MAX, 1 + Math.floor(xp / XP_NIVEAU)); }
function hashTxt(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function alea(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Ordre de la pioche bonus d'un pilote pour une saison : mélangé une fois pour toutes */
function deckBonus(y, nom) {
  const r = alea(hashTxt(y + "|" + nom)), l = CARTES_BONUS.map(c => c.id);
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}
/* ---------- Mois spéciaux ---------- */
function monacoMois(y) { return y * 100 + 4 + hashTxt("monaco" + y) % 7; }   // d'avril à octobre, tiré une fois par saison
function moisSpecial(y, k) {
  if (!k) return null;
  if (k % 100 === 12 && regleActive("finale", k)) return { id: "finale", ico: "🏆", nom: "Finale", txt: "Points de place doublés pour tout le monde." };
  if (k === monacoMois(y) && regleActive("monaco", k)) return { id: "monaco", ico: "🎲", nom: "Le Plateau maudit", txt: "Le dernier du championnat avant ce mois marque ses points de place en double." };
  if (k % 100 === 7 && regleActive("gpspeciaux", k)) return { id: "silverstone", ico: "🌼", nom: "Le Sacre du solstice", txt: "Le vainqueur du mois marque +2 de plus." };
  if (k % 100 === 9 && regleActive("gpspeciaux", k)) return { id: "monza", ico: "🍄", nom: "Instinct de survie", txt: "Le 🎯 vaut +2 au lieu de +1." };
  return null;
}
/* ---------- V15.5 · Pièges des circuits : une petite règle propre à chaque circuit qui n'a pas de mois spécial ---------- */
const PIEGES = {
  bahrein: { id: "mirage", ico: "✨", nom: "Feux follets", txt: "Le 🎯 ne compte que si tu bats le S&P 500 d'au moins 0,5 point." },
  djeddah: { id: "murs", ico: "🚪", nom: "Couloirs mouvants", txt: "À moins de 0,2 point du pilote juste devant toi, tu partages sa place (et ses points)." },
  melbourne: { id: "chaos", ico: "🌨️", nom: "Tempête de neige", txt: "Pronostic « qui gagne le mois » : +2 si juste, mais −1 si faux." },
  suzuka: { id: "huit", ico: "🎭", nom: "Double vie", txt: "Les places du mois se jouent sur deux mois cumulés : ce mois-ci et le précédent." },
  miami: { id: "chaleur", ico: "🌡️", nom: "Surchauffe", txt: "🚀 Turbo interdit ce mois-ci." },
  spa: { id: "ardennes", ico: "🌫️", nom: "Brume", txt: "Si le S&P 500 baisse, 🌧️ Pneus pluie vaut +3 au lieu de +2." },
  singapour: { id: "nuit", ico: "🌪️", nom: "Tempête de sable", txt: "Le dernier du mois marque 2 points de place au lieu de 0." },
  interlagos: { id: "averse", ico: "💥", nom: "Assaut", txt: "🎲 Pari : +3 si tu finis devant ton rival, −2 derrière (au lieu de +2 / −1)." }
};
/** Piège du mois k (null : chauffe, mois spécial, Plateau maudit, ou règle pas encore ouverte) */
function piegeMois(y, k) {
  if (!k || k === CHAUFFE_K || estChauffe(y) || !regleActive("pieges", k) || moisSpecial(y, k)) return null;
  return PIEGES[circuitDe(k)] || null;
}
/** V15.5 · « Ce mois-ci à … » : le circuit, son piège ou son mois spécial, et le défi, mis en avant au début de chaque mois */
function reglesDuMois(y, k) {
  if (!k || k === CHAUFFE_K || estChauffe(y)) return null;
  const g = GPS[circuitDe(k)], spe = moisSpecial(y, k), pg = regleVisible("pieges") ? piegeMois(y, k) : null, df = regleVisible("defi") && regleActive("defi", k) ? defiDuMois(k) : null;
  if (!g || !(spe || pg || df)) return null;
  return { k, g, spe, pg, df };
}
function htmlReglesMois(y, k, compact) {
  const r = reglesDuMois(y, k); if (!r) return "";
  const l = [];
  if (r.spe) l.push('<li class="rm-spe"><i>' + r.spe.ico + "</i><span><b>" + esc(r.spe.nom) + "</b> " + esc(r.spe.txt) + "</span></li>");
  if (r.pg) l.push('<li class="rm-pg"><i>' + r.pg.ico + "</i><span><b>Piège · " + esc(r.pg.nom) + "</b> " + esc(r.pg.txt) + "</span></li>");
  if (r.df) l.push('<li><i>' + r.df.ico + "</i><span><b>Défi du mois</b> " + esc(r.df.txt) + " : +1.</span></li>");
  return '<div class="regles-mois' + (compact ? " compact" : "") + '"' + (compact ? ' role="button" tabindex="0" data-aller-stand' : "") + '><div class="rm-h"><span class="rm-drap">' + r.g.drap + '</span><div><small>' + esc(moisLong(k)) + " · " + esc(r.g.gp) + "</small><b>Ce mois-ci à " + esc(r.g.ville) + "</b></div>" + (compact ? '<span class="rm-go">›</span>' : "") + "</div><ul>" + l.join("") + "</ul></div>";
}
/** Mois à mettre en avant : la fenêtre des cartes (du 20 au 1er), sinon le mois en cours jusqu'au 7 */
function moisAMettreEnAvant() { const k = moisCarteOuvert(); if (k) return k; const d = new Date(); return d.getDate() <= 7 ? d.getFullYear() * 100 + d.getMonth() + 1 : null; }
/* ---------- Améliorations : choix datés, valables pour les cartes posées après ---------- */
/** Saison des améliorations : celle du mois dont la fenêtre est ouverte, sinon celle de la prochaine fenêtre
    (le 1er décembre on améliore encore pour la Finale ; dès le 2, on prépare la saison suivante) */
function anneeAmelio() { const k = moisCarteOuvert() || prochaineFenetre().k; return Math.floor(k / 100); }
function amelioApercu() { return stock.get("versus.amelioApercu") || ""; }
/** Améliorations enregistrées pour une saison : { s: "mmap", t: [dates] } */
function amelioDe(nom, y) {
  if (apercuSaison()) return { s: nom === moiPilote() ? amelioApercu() : "", t: [] };
  const b = ((D.ecurie || {})[nom] || {}).equip || {}, parAn = (b.amelios || {})[y];
  if (parAn && /^[map]{0,8}$/.test(parAn.s || "")) return { s: parAn.s || "", t: parAn.t || [] };
  return Number(b.amelioY) === y && /^[map]{0,8}$/.test(b.amelio || "") ? { s: b.amelio || "", t: b.amelioT || [] } : { s: "", t: [] };   // ancien format (V9)
}
/** Niveaux d'amélioration actifs pour les cartes du mois k (n = niveau au départ du mois) */
function amelioAu(y, nom, k, n) {
  const a = amelioDe(nom, y), up = { m: 0, a: 0, p: 0 }; if (!regleActive("atelier", k)) return up;
  for (let i = 0; i < a.s.length && i < n - 1; i++) { const d = a.t[i]; if (apercuSaison() || (d && d < k * 100 + jourLimite(k))) up[a.s[i]] = Math.min(2, up[a.s[i]] + 1); }
  return up;
}
/* ---------- Duels annoncés ---------- */
/* ---------- Pronostic du mois et rival de la saison (V21) ---------- */
function pronosApercu() { try { return JSON.parse(stock.get("versus.pronosApercu") || "{}"); } catch (e) { return {}; } }
function pronoDe(y, nom, k) {
  if (apercuSaison()) return ((pronosApercu()[y] || {})[nom] || {})[k] || null;
  if (nom === moiPilote()) { const m = ((D.mesPronos || {})[y] || {})[k]; if (m) return m; }
  return (((D.pronos || {})[y] || {})[nom] || {})[k] || null;
}
function rivalDe(y, nom) {
  if (apercuSaison()) return (JSON.parse(stock.get("versus.rivalApercu") || "{}"))[y] || null;
  if (nom === moiPilote()) { const m = (D.monRival || {})[y]; if (m) return m; }
  return ((D.rivaux || {})[y] || {})[nom] || null;
}
async function envoyerProno(y, k, v, i, p) {
  p = typeof p === "number" && isFinite(p) ? Math.round(p * 10) / 10 : null;
  const qui = moiPilote();
  if (apercuSaison()) { const a = pronosApercu(); a[y] = a[y] || {}; a[y][qui] = a[y][qui] || {}; if (v || i || p !== null) a[y][qui][k] = { v, i, p }; else delete a[y][qui][k]; stock.set("versus.pronosApercu", JSON.stringify(a)); MEMO_SAISON = { d: null, m: {} }; toast("Aperçu : pronostic enregistré sur cet appareil."); rendreTrophees(); return; }
  if (SOURCE !== "api") { toast("Pronostic indisponible hors connexion."); return; }
  if (simulation()) { toast(MSG_SIMULATION); return; }
  const rep = await posterAdmin({ action: "prono", personne: qui, mois: k, vainqueur: v || null, indice: i || null, pole: p });
  if (rep.ok) { D.mesPronos = D.mesPronos || {}; D.mesPronos[y] = rep.mesPronos || {}; if (rep.pronos) D.pronos = rep.pronos; MEMO_SAISON = { d: null, m: {} }; toast(rep.message || "Pronostic enregistré."); }
  else toast(rep.message || "Pronostic impossible.");
  rendreTrophees();
}
async function choisirRival(y, r) {
  const qui = moiPilote();
  if (apercuSaison()) { const a = JSON.parse(stock.get("versus.rivalApercu") || "{}"); if (r) a[y] = { r }; else delete a[y]; stock.set("versus.rivalApercu", JSON.stringify(a)); MEMO_SAISON = { d: null, m: {} }; toast("Aperçu : rival choisi sur cet appareil."); rendreTrophees(); return; }
  if (SOURCE !== "api") { toast("Choix du rival indisponible hors connexion."); return; }
  if (simulation()) { toast(MSG_SIMULATION); return; }
  const rep = await posterAdmin({ action: "rival", personne: qui, saison: y, rival: r || null });
  if (rep.ok) { D.monRival = D.monRival || {}; if (rep.monRival) D.monRival[y] = rep.monRival; else delete D.monRival[y]; if (rep.rivaux) D.rivaux = rep.rivaux; MEMO_SAISON = { d: null, m: {} }; toast(rep.message || "Rival enregistré."); }
  else toast(rep.message || "Choix impossible.");
  rendreTrophees();
}
let PRONO_V = null, PRONO_I = null, PRONO_P = null, RIVAL_CHOIX = null, VOTE_CHOIX = null;
/* ---------- 🗳️ Vote de fin de saison (V13.9) ---------- */
function voteOuvert(y) { const a = aujNum(); return a >= y * 10000 + 1202 && a <= y * 10000 + 1231; }
function htmlVote(y) {
  const qui = moiPilote(); if (!qui || estChauffe(y) || !regleVisible("vote") || !regleActive("vote", y * 100 + 12)) return "";
  const res = (D.votes || {})[y] || {}, mon = apercuSaison() ? (JSON.parse(stock.get("versus.voteApercu") || "{}"))[y] : ((D.monVote || {})[y]);
  if (res.gagnants && res.gagnants.length) return '<p class="info">🗳️ <b>Coup de la saison ' + y + "</b> : " + res.gagnants.map(n => "<b>" + esc(n) + "</b> (" + res.voix[n] + " voix)").join(" et ") + ". Plaque « Coup de la saison » débloquée.</p>";
  if (!voteOuvert(y)) return "";
  const c = VOTE_CHOIX || (mon && mon.c) || null, autres = D.personnes.map(p => p.nom).filter(n => n !== qui);
  return '<div><h3 class="s-h3">🗳️ Le coup de la saison <small>' + y + "</small></h3></div>" +
    '<div class="c-action duel"><p>Qui a fait <b>le plus beau coup</b> de la saison (la plus belle remontée, le Pari le plus osé…) ? Vote pour un autre pilote, jusqu\'au 31 décembre. Secret jusqu\'au 1<sup>er</sup> janvier ; le gagnant reçoit la plaque <b>« Coup de la saison »</b>.' + (res.participants ? " " + res.participants + " vote" + (res.participants > 1 ? "s" : "") + " déjà." : "") + "</p>" +
    '<div class="chips" role="group" aria-label="Coup de la saison">' + autres.map(n => '<button class="chip" type="button" data-vote="' + esc(n) + '" aria-pressed="' + (c === n) + '">' + esc(n) + "</button>").join("") + "</div>" +
    (mon && mon.c && !VOTE_CHOIX ? "<p>✓ Tu as voté pour <b>" + esc(mon.c) + "</b>.</p>" : '<button class="btn acc" type="button" id="vote-ok"' + (c ? "" : " disabled") + ">Voter" + (c ? " pour " + esc(c) : "") + "</button>") + "</div>";
}
async function envoyerVote(y, c) {
  const qui = moiPilote();
  if (apercuSaison()) { const a = JSON.parse(stock.get("versus.voteApercu") || "{}"); a[y] = { c }; stock.set("versus.voteApercu", JSON.stringify(a)); toast("Aperçu : vote enregistré sur cet appareil."); rendreTrophees(); return; }
  if (SOURCE !== "api") { toast("Vote indisponible hors connexion."); return; }
  if (simulation()) { toast(MSG_SIMULATION); return; }
  const rep = await posterAdmin({ action: "vote", personne: qui, saison: y, cible: c });
  if (rep.ok) { D.monVote = D.monVote || {}; D.monVote[y] = rep.monVote; if (rep.votes) D.votes = rep.votes; toast(rep.message || "Vote enregistré."); }
  else toast(rep.message || "Vote impossible.");
  rendreTrophees();
}
/** 🏁 Défi du mois (V15) : affiché dès l'ouverture de la fenêtre (le 20 du mois d'avant) */
function htmlDefi(y, kOuvert) {
  if (!kOuvert || estChauffe(y) || !regleVisible("defi") || !regleActive("defi", kOuvert)) return "";
  const d = defiDuMois(kOuvert); if (!d) return "";
  return '<div><h3 class="s-h3">🏁 Défi du mois <small>' + esc(moisLong(kOuvert)) + "</small></h3></div>" +
    '<div class="c-action duel"><p style="font-size:1.05em">' + d.ico + " <b>" + esc(d.txt) + "</b></p><p class=\"info\">Rien à faire : à la fin du mois, chaque pilote qui l'a réussi marque <b>+1</b>.</p></div>";
}
function htmlProno(y, kOuvert) {
  const qui = moiPilote(); if (!qui || !kOuvert || estChauffe(y) || !regleVisible("prono") || !regleActive("prono", kOuvert)) return "";
  const p = pronoDe(y, qui, kOuvert), v = PRONO_V || (p && p.v) || null, i = PRONO_I || (p && p.i) || null, change = PRONO_V || PRONO_I || PRONO_P !== null;
  const avecPole = regleActive("pole", kOuvert), pv = PRONO_P !== null ? PRONO_P : (p && typeof p.p === "number" ? p.p : null);
  return '<div><h3 class="s-h3">🔮 Pronostic <small>' + esc(moisLong(kOuvert)) + "</small></h3></div>" +
    '<div class="c-action duel"><p>' + (avecPole ? "Trois questions" : "Deux questions") + ', secrètes jusqu\'au ' + jourLimite(kOuvert) + " : <b>+1</b> par bonne réponse" + (avecPole ? " (la pole : au plus proche)" : "") + ".</p>" +
    "<p><b>Qui gagne le mois ?</b></p>" + '<div class="chips" role="group" aria-label="Vainqueur du mois">' + D.personnes.map(x => '<button class="chip" type="button" data-pv="' + esc(x.nom) + '" aria-pressed="' + (v === x.nom) + '">' + esc(x.nom) + "</button>").join("") + "</div>" +
    "<p><b>Le " + esc(D.marche.indices[iRef()]) + " fera-t-il plus de +1 % ce mois ?</b></p>" + '<div class="chips" role="group" aria-label="Sens de l\'indice"><button class="chip" type="button" data-pi="h" aria-pressed="' + (i === "h") + '">📈 oui, plus de +1 %</button><button class="chip" type="button" data-pi="b" aria-pressed="' + (i === "b") + '">📉 non</button></div>' +
    (avecPole ? "<p><b>🅿️ Pole position : ton chiffre pour le " + esc(D.marche.indices[iRef()]) + " du mois</b></p>" + '<div class="ligne-champ"><input id="prono-pole" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. +1,8" value="' + (pv !== null ? String(pv).replace(".", ",") : "") + '" style="max-width:120px"> <span>%</span></div>' : "") +
    (p && !change ? '<p>✓ Pronostic enregistré' + (p.v ? " : <b>" + esc(p.v) + "</b>" : "") + (p.i ? ", " + (p.i === "h" ? "📈 plus de +1 %" : "📉 pas plus de +1 %") : "") + (typeof p.p === "number" ? ", pole " + (p.p > 0 ? "+" : "") + String(p.p).replace(".", ",") + " %" : "") + '.</p>' : '<button class="btn acc" type="button" id="prono-ok"' + (v || i || pv !== null || avecPole ? "" : " disabled") + ">Valider mon pronostic</button>") + "</div>";
}
function htmlRival(y, kOuvert) {
  const qui = moiPilote(); if (!qui || estChauffe(y) || !regleVisible("rival") || !regleActive("rival", y * 100 + 1)) return "";
  const r = rivalDe(y, qui), fenetre = kOuvert === y * 100 + 1, autres = D.personnes.map(p => p.nom).filter(n => n !== qui);
  if (!fenetre) return r && r.r ? '<p class="info">😈 Ton rival secret de ' + y + " : <b>" + esc(r.r) + "</b>. +3 si tu finis devant lui au championnat.</p>" : "";
  const c = RIVAL_CHOIX || (r && r.r) || null;
  return '<div><h3 class="s-h3">😈 Rival de la saison <small>' + y + "</small></h3></div>" +
    '<div class="c-action duel"><p>Choisis un rival <b>secret</b> pour toute la saison : si tu finis devant lui au championnat en décembre, <b>+3</b>. Modifiable jusqu\'au 1<sup>er</sup> janvier, révélé à la Finale.</p>' +
    '<div class="chips" role="group" aria-label="Rival de la saison">' + autres.map(n => '<button class="chip" type="button" data-rs="' + esc(n) + '" aria-pressed="' + (c === n) + '">' + esc(n) + "</button>").join("") + "</div>" +
    (r && r.r && !RIVAL_CHOIX ? "<p>✓ Rival choisi : <b>" + esc(r.r) + "</b>.</p>" : '<button class="btn acc" type="button" id="rival-ok"' + (c ? "" : " disabled") + ">Choisir " + (c ? esc(c) : "mon rival") + "</button>") + "</div>";
}
function duelsApercu() { try { return JSON.parse(stock.get("versus.duelsApercu") || "{}"); } catch (e) { return {}; } }
function mesDuels() {
  let loc = {}; try { loc = JSON.parse(stock.get(cleMesDuels()) || "{}"); } catch (e) { loc = {}; }
  const srv = (typeof D !== "undefined" && D && D.mesDuels) || {};
  Object.keys(srv).forEach(y => { loc[y] = Object.assign({}, loc[y] || {}, srv[y]); });
  return loc;
}
function duelDe(y, nom, k) {
  if (apercuSaison()) { const d = (((duelsApercu()[y] || {})[nom]) || {})[k]; return d && d.cible ? d : null; }
  const d = ((((D.duels || {})[y] || {})[nom]) || {})[k];
  if (d && d.cible && vraiAdmin() && !adminActif() && nom !== moiPilote() && !circuitRevele(k)) return { cache: true };
  if (d && d.cible) return d;
  if (nom === moiPilote()) { const m = (mesDuels()[y] || {})[k]; if (m && m.cible) return Object.assign({ cache: true }, m); }
  return d && d.cache ? { cache: true } : null;
}
async function lancerDuel(y, k, cible) {
  const qui = moiPilote();
  if (apercuSaison()) {
    const a = duelsApercu(); a[y] = a[y] || {}; a[y][qui] = a[y][qui] || {};
    if (cible) a[y][qui][k] = { cible }; else delete a[y][qui][k];
    stock.set("versus.duelsApercu", JSON.stringify(a)); MEMO_SAISON = { d: null, m: {} };
    toast(cible ? "Aperçu : duel lancé contre " + cible + " sur " + moisLong(k) + "." : "Duel retiré."); rendreTrophees(); return;
  }
  if (SOURCE !== "api") { toast("Duels indisponibles hors connexion."); return; }
  // tout de suite à l'écran ; l'envoi suit, et on revient en arrière s'il échoue
  const m = mesDuels(), avant = JSON.stringify(m); m[y] = m[y] || {};
  if (cible) m[y][k] = { cible }; else delete m[y][k];
  const avantD = D.mesDuels ? JSON.stringify(D.mesDuels) : null;
  if (D.mesDuels) { D.mesDuels[y] = D.mesDuels[y] || {}; if (cible) D.mesDuels[y][k] = { cible }; else delete D.mesDuels[y][k]; }
  stock.set(cleMesDuels(), JSON.stringify(m)); MEMO_SAISON = { d: null, m: {} };
  if (simulation()) { toast(cible ? "👁️ Simulation : duel lancé pour voir, rien n'est envoyé." : "Duel retiré (simulation)."); rendreTrophees(); return; }
  toast(cible ? "⚔️ Duel lancé contre " + cible + " sur " + moisLong(k) + "." : "Duel retiré."); rendreTrophees();
  const rep = await posterAdmin({ action: "duel", personne: qui, mois: k, cible: cible || null });
  if (rep.ok) { if (rep.mesDuels) { const n = mesDuels(); n[y] = rep.mesDuels; stock.set(cleMesDuels(), JSON.stringify(n)); if (D.mesDuels) D.mesDuels[y] = rep.mesDuels; } if (rep.duels) D.duels = rep.duels; MEMO_SAISON = { d: null, m: {} }; }
  else { stock.set(cleMesDuels(), avant); if (avantD) D.mesDuels = JSON.parse(avantD); MEMO_SAISON = { d: null, m: {} }; toast(rep.message || "Duel impossible."); rendreTrophees(); }
}

/* ---------- Avatars « tête » : un portrait animé par pilote ---------- */
const TETE = {
  peau: ["#F6D5B8", "#EBC29F", "#D8A47C", "#B47A50", "#7F5034"],
  cheveux: ["#2A1C13", "#4A2F1E", "#7A5230", "#C9A063", "#141414", "#8E939B", "#9C4A22", "#C26A35"],
  tenues: ["#D63333", "#17181B", "#5E6B3C", "#2F5FD0", "#EDEDED", "#7A3FB8", "#F08DB5", "#F2A33A"],
  coupes: ["Chauve", "Court", "Mèche", "Bouclés longs", "Rasé", "En pétard", "Bouclés courts", "Attachés"],
  barbes: ["Rasé de près", "3 jours", "Barbe courte", "Bouc", "Moustache", "Moustache + bouc"],
  lunettes: ["Sans", "Fines", "Rondes", "Soleil"],
  styles: ["T-shirt", "Polo", "Chemise ouverte", "Pull", "Capuche", "Combi de course", "Veste de ski"],
  expr: ["Sourire", "Grand sourire", "En coin"],
  formes: ["Ovale", "Fin", "Rond"]
};
const CHAMPS_TETE = ["peau", "coupe", "cheveux", "barbe", "lunettes", "style", "couleur", "expr", "dessous", "barbeC", "forme"];
const BORNES_TETE = [5, 8, 8, 6, 4, 7, 8, 3, 8, 8, 3];
/* Portraits de départ, d'après les photos (plusieurs pour ceux qui changent souvent de tête) : chacun peut ensuite retoucher le sien */
const PRESETS_TETE = {
  theo: [["Portrait", "01011110000"]],
  clement: [["Portrait", "12110001010"]],
  kevin: [["Portrait", "10422210640"]],
  devlin: [["Bouclés", "03050601261"], ["Attachés", "07020012021"], ["Coupé court", "06050601261"]]
};
function normNom(n) { return String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function portraitsDe(nom) { return PRESETS_TETE[normNom(nom)] || null; }
function presetTete(nom) {
  const p = portraitsDe(nom); if (p) return p[0][1];
  const h = hashTxt(nom), v = BORNES_TETE.map((b, i) => Math.floor(h / (i * 7 + 1)) % b); v[9] = v[2]; v[10] = 0; return v.join("");
}
/** Ancien format (9 chiffres) accepté : couleur de barbe = cheveux, visage ovale */
function teteValide(s) { return typeof s === "string" && (s.length === 9 || s.length === 11) && /^\d+$/.test(s) && s.split("").every((c, i) => +c < BORNES_TETE[i]); }
function decodeTete(s) {
  const v = teteValide(s) ? s : "01011110000", o = {}; CHAMPS_TETE.forEach((c, i) => o[c] = i < v.length ? +v[i] : 0);
  if (v.length === 9) { o.barbeC = o.cheveux; o.forme = 0; } return o;
}
function encodeTete(o) { return CHAMPS_TETE.map((c, i) => String(Math.max(0, Math.min(BORNES_TETE[i] - 1, o[c] | 0)))).join(""); }
function svgTete(nom, eq, statique) {
  const t = decodeTete(eq.tete || presetTete(nom)), u = "tt" + (++NSVG);
  const peau = TETE.peau[t.peau], ch = TETE.cheveux[t.cheveux], bc = TETE.cheveux[t.barbeC], ten = t.style === 5 ? couleur(nom) : TETE.tenues[t.couleur], des = TETE.tenues[t.dessous];
  const lead = !statique && saisonVisible() && leaderSaison() === nom, expr = lead ? 1 : t.expr, retard = -((hashTxt(nom) % 37) / 10).toFixed(1);
  const sombre = "rgba(0,0,0,.22)", T = "M3 41C4 32 11 28.5 20 28.5S36 32 37 41Z";
  // visage : ovale, fin (plus long, menton plus bas) ou rond
  const VIS = [
    "M20 7.2C25.4 7.2 28.4 11 28.4 16.4C28.4 22.4 24.6 26.4 20 26.4S11.6 22.4 11.6 16.4C11.6 11 14.6 7.2 20 7.2Z",
    "M20 7C24.8 7 27.6 10.8 27.6 16.2C27.6 22.6 24.2 27.4 20 27.4S12.4 22.6 12.4 16.2C12.4 10.8 15.2 7 20 7Z",
    "M20 7.4C25.8 7.4 29 11 29 16.6C29 22 25 26 20 26S11 22 11 16.6C11 11 14.2 7.4 20 7.4Z"][t.forme];
  const menton = [26.4, 27.4, 26][t.forme], oreX = [11.9, 12.6, 11.3][t.forme];
  let corps = "";
  if (t.style === 0) corps = '<path d="' + T + '" fill="' + ten + '"/><path d="M15.8 28.8C17 31.2 23 31.2 24.2 28.8" fill="none" stroke="' + sombre + '" stroke-width="1.2"/>';
  else if (t.style === 1) corps = '<path d="' + T + '" fill="' + ten + '"/><path d="M15.4 28.6L20 31.6 17.4 33.6 13.8 30.2Z M24.6 28.6L20 31.6 22.6 33.6 26.2 30.2Z" fill="' + ten + '" stroke="rgba(255,255,255,.28)" stroke-width=".6"/><path d="M20 31.6V37" stroke="rgba(255,255,255,.25)" stroke-width=".7"/><circle cx="20" cy="33.6" r=".45" fill="rgba(255,255,255,.5)"/><circle cx="20" cy="35.4" r=".45" fill="rgba(255,255,255,.5)"/>';
  else if (t.style === 2) corps = '<path d="' + T + '" fill="' + des + '"/><path d="M3 41C4 32 11 28.5 16.4 28.6L18.6 41Z" fill="' + ten + '"/><path d="M37 41C36 32 29 28.5 23.6 28.6L21.4 41Z" fill="' + ten + '"/>' +
    '<path d="M16.4 28.6L18.4 34 15.6 32.6Z M23.6 28.6L21.6 34 24.4 32.6Z" fill="' + ten + '" stroke="rgba(255,255,255,.22)" stroke-width=".5"/>';
  else if (t.style === 3) corps = '<path d="' + T + '" fill="' + ten + '"/><path d="M15.4 28.7C17 32 23 32 24.6 28.7" fill="none" stroke="' + sombre + '" stroke-width="1.8"/>' +
    '<path d="M9 34.5V41M12.5 33V41M27.5 33V41M31 34.5V41" stroke="rgba(0,0,0,.12)" stroke-width=".7"/>';
  else if (t.style === 4) corps = '<ellipse cx="20" cy="29.4" rx="9.6" ry="3.6" fill="' + ten + '"/><ellipse cx="20" cy="29.4" rx="9.6" ry="3.6" fill="' + sombre + '"/><path d="' + T + '" fill="' + ten + '"/>' +
    '<path d="M17.6 31V36.4M22.4 31V36.4" stroke="#fff" stroke-width=".7" stroke-linecap="round"/><path d="M14 38.5H26" stroke="' + sombre + '" stroke-width=".8"/>';
  else if (t.style === 5) corps = '<path d="' + T + '" fill="' + ten + '"/><path d="M8 33L13 41M32 33L27 41" stroke="#fff" stroke-width="1.6" opacity=".85"/>' +
    '<path d="M15 28.5C17 30.6 23 30.6 25 28.5L25.2 30.4C23 32.6 17 32.6 14.8 30.4Z" fill="#14161b"/><rect x="25.4" y="34" width="5" height="2.6" rx=".6" fill="#fff" opacity=".9"/>';
  else corps = // veste de ski ouverte (couleur) sur un col zippé (dessous)
    '<path d="' + T + '" fill="' + des + '"/><path d="M15.2 28.2C17.2 30.4 22.8 30.4 24.8 28.2L25 30.8C22.8 32.8 17.2 32.8 15 30.8Z" fill="' + des + '"/><path d="M15.2 28.2C17.2 30.4 22.8 30.4 24.8 28.2L25 30.8C22.8 32.8 17.2 32.8 15 30.8Z" fill="rgba(0,0,0,.18)"/>' +
    '<path d="M20 31.2V41" stroke="#C9CDD3" stroke-width=".7" stroke-dasharray=".6 .5"/><rect x="19.4" y="31.6" width="1.2" height="2.6" rx=".4" fill="#D9DCE1"/>' +
    '<path d="M3 41C4 32 9.4 29.2 14.6 28.6L17.4 41Z" fill="' + ten + '"/><path d="M37 41C36 32 30.6 29.2 25.4 28.6L22.6 41Z" fill="' + ten + '"/>' +
    '<path d="M12.4 29.6L15.6 41M27.6 29.6L24.4 41" stroke="#F4F5F7" stroke-width="2.4"/>' +
    '<path d="M14.6 28.6C12.6 29.2 11 30.8 10.2 33L13.2 33.8C13.6 31.8 14.6 30.4 16 29.6Z M25.4 28.6C27.4 29.2 29 30.8 29.8 33L26.8 33.8C26.4 31.8 25.4 30.4 24 29.6Z" fill="#1B1D22"/>';
  // cheveux derrière la tête (longs, attachés)
  let derriere = "";
  if (t.coupe === 3) derriere = '<path d="M20 3.6C13.4 3.6 9.6 7.4 9 12.6C7.2 14.8 7.8 17.6 8.4 19.6C7.4 22 8 25 9.6 27.4C10.6 29 12.6 29.6 14 28.6L13.2 23C12.6 19 12.4 15 13.6 12.4L26.4 12.4C27.6 15 27.4 19 26.8 23L26 28.6C27.4 29.6 29.4 29 30.4 27.4C32 25 32.6 22 31.6 19.6C32.2 17.6 32.8 14.8 31 12.6C30.4 7.4 26.6 3.6 20 3.6Z" fill="' + ch + '"/>' +
    [[10.4, 13.6], [9.6, 19.2], [10.6, 24.6], [29.6, 13.6], [30.4, 19.2], [29.4, 24.6], [14, 6.4], [26, 6.4], [20, 4.8]].map(([x, y]) => '<path d="M' + (x - 1.4) + " " + y + "a1.5 1.5 0 1 1 1.4 1.5" + '" stroke="#fff" stroke-width=".45" opacity=".16" fill="none"/>').join("");
  else if (t.coupe === 7) derriere = '<circle cx="20" cy="4.2" r="3.4" fill="' + ch + '"/><path d="M17.8 3.6A2.2 2.2 0 1 1 21.6 5.4" stroke="#000" stroke-width=".5" opacity=".3" fill="none"/>';
  const barbe = [
    "",
    '<path d="M12 17.5C12.4 23 16 ' + menton + " 20 " + menton + "S27.6 23 28 17.5C27 21 25 22.6 23.6 22.2C22 21.7 18 21.7 16.4 22.2C15 22.6 13 21 12 17.5Z\" fill=\"" + bc + '" opacity=".3"/><path d="M17 21.1C18.5 20.3 21.5 20.3 23 21.1" stroke="' + bc + '" stroke-width="1.2" opacity=".32" fill="none"/>',
    '<path d="M11.9 17.4C12 23.8 15.6 ' + (menton + 1) + " 20 " + (menton + 1) + "S28 23.8 28.1 17.4C27.4 20 26.2 21.4 24.6 21.6C23 20.6 17 20.6 15.4 21.6C13.8 21.4 12.6 20 11.9 17.4Z\" fill=\"" + bc + '" opacity=".88"/><path d="M16 21.7C17.4 19.9 22.6 19.9 24 21.7C22.6 21.2 21 21.4 20 21.9 19 21.4 17.4 21.2 16 21.7Z" fill="' + bc + '"/>',
    '<path d="M17.4 22.6C17.6 ' + (menton - .2) + " 22.4 " + (menton - .2) + ' 22.6 22.6C21.4 23.6 18.6 23.6 17.4 22.6Z" fill="' + bc + '"/><path d="M17.2 21.5C18.6 20.5 21.4 20.5 22.8 21.5" stroke="' + bc + '" stroke-width="1.1" fill="none"/>',
    '<path d="M16 21.9C17.4 19.8 22.6 19.8 24 21.9C22.6 21.3 21 21.5 20 22.1 19 21.5 17.4 21.3 16 21.9Z" fill="' + bc + '"/>',
    // moustache fournie qui descend aux coins, et bouc sous la lèvre jusqu'au menton (Devlin)
    '<path d="M12.4 18C12.8 23.4 16.2 ' + menton + " 20 " + menton + "S27.2 23.4 27.6 18C26.6 21.4 24.8 22.8 23.6 22.4C22 21.8 18 21.8 16.4 22.4C15.2 22.8 13.4 21.4 12.4 18Z\" fill=\"" + bc + '" opacity=".22"/>' +
      '<path d="M15.8 22.6C16.2 20.6 18.2 20 20 20.6 21.8 20 23.8 20.6 24.2 22.6C23.4 21.9 22.4 21.6 21.4 21.7 20.8 21.8 19.2 21.8 18.6 21.7 17.6 21.6 16.6 21.9 15.8 22.6Z" fill="' + bc + '"/>' +
      '<path d="M18 24.8C18.2 ' + (menton - .6) + " 19 " + (menton + .3) + " 20 " + (menton + .3) + "S21.8 " + (menton - .6) + ' 22 24.8C21 25.3 19 25.3 18 24.8Z" fill="' + bc + '" opacity=".9"/>'
  ][t.barbe] || "";
  const bouche = [
    '<path d="M17.4 22.6C18.8 23.8 21.2 23.8 22.6 22.6" fill="none" stroke="#6B2E25" stroke-width=".9" stroke-linecap="round"/>',
    '<path d="M16.6 22.1C17.4 25.4 22.6 25.4 23.4 22.1Z" fill="#5A1F1A"/><path d="M17 22.2H23C22.8 23.2 17.2 23.2 17 22.2Z" fill="#fff"/><path d="M18 22.3V23M20 22.3V23.1M22 22.3V23" stroke="rgba(0,0,0,.12)" stroke-width=".2"/>',
    '<path d="M17.4 22.9C19.2 23.5 21.4 23.2 23.2 21.8" fill="none" stroke="#6B2E25" stroke-width=".95" stroke-linecap="round"/><path d="M22.9 21.6C23.3 21.9 23.5 22.3 23.4 22.7" stroke="rgba(0,0,0,.2)" stroke-width=".5" fill="none"/>'
  ][expr];
  const lun = [
    "",
    '<g fill="rgba(255,255,255,.1)" stroke="#16171a" stroke-width=".75"><rect x="13.9" y="15.3" width="5" height="3.2" rx=".8"/><rect x="21.1" y="15.3" width="5" height="3.2" rx=".8"/></g><path d="M18.9 16.4H21.1M13.9 16.3H12M26.1 16.3H28" stroke="#16171a" stroke-width=".7"/>',
    '<g fill="rgba(30,30,34,.35)" stroke="#232428" stroke-width=".9"><circle cx="16.5" cy="16.9" r="2.5"/><circle cx="23.5" cy="16.9" r="2.5"/></g><path d="M19 16.6C19.6 16.1 20.4 16.1 21 16.6M14 16.4H12M26 16.4H28" stroke="#232428" stroke-width=".8" fill="none"/>',
    '<g fill="#101114"><rect x="13.6" y="15.1" width="5.6" height="3.6" rx="1.4"/><rect x="20.8" y="15.1" width="5.6" height="3.6" rx="1.4"/></g><path d="M19.2 16.2H20.8" stroke="#101114" stroke-width=".9"/><path d="M14.4 15.8L16 15.8M21.6 15.8L23.2 15.8" stroke="#fff" stroke-width=".5" opacity=".6"/>'
  ][t.lunettes] || "";
  const boucle = (x, y, r, o) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + ch + '"/><path d="M' + (x - r * .5) + " " + (y + r * .15) + "A" + (r * .5) + " " + (r * .5) + " 0 1 1 " + (x + r * .35) + " " + (y + r * .4) + '" stroke="' + (o ? "#fff" : "#000") + '" stroke-width=".45" opacity="' + (o ? .2 : .28) + '" fill="none"/>';
  const devant = [
    '<ellipse cx="17" cy="9.6" rx="3" ry="1.3" fill="#fff" opacity=".22"/>',
    '<path d="M11.6 15.6C11 9.4 14.2 6.4 20 6.4S29 9.4 28.4 15.6C27.6 12.6 26.6 11.4 25.6 11C22.6 11.8 17.6 11.6 14.4 11C13 11.6 12.2 13.2 11.6 15.6Z" fill="' + ch + '"/>',
    '<path d="M11.4 16C10.4 8.6 14.4 5.2 20.4 5.2C26.6 5.2 30.2 8.8 28.6 16C28 12.6 27 11 25.8 10.4C23 11.6 18.4 12.6 13.6 12.2C12.6 13.2 11.9 14.4 11.4 16Z" fill="' + ch + '"/><path d="M13.6 12.2C17 9 22.6 8.2 27 9.6C24 7.4 17.4 7.6 13.6 12.2Z" fill="#fff" opacity=".13"/>',
    // bouclés longs : raie au milieu, deux rideaux de boucles, mèches sur les oreilles jusqu'à la mâchoire, quelques anglaises sur le front
    '<path d="M11.4 16C10.8 8.8 14.6 5.2 20 5.2S29.2 8.8 28.6 16C27.8 12.6 26.2 10.6 23.6 10.2C22.2 10.8 20.8 11.8 20 13C19.2 11.8 17.8 10.8 16.4 10.2C13.8 10.6 12.2 12.6 11.4 16Z" fill="' + ch + '"/>' +
      '<path d="M12.6 11.2C10 13.4 11 16.4 10.1 18.8C9.3 21 10.6 22.8 9.8 25.4C12.2 24.6 13.2 22.4 12.8 20.4C13.4 18.6 12.4 16.6 13.2 14.6C13.6 13.4 13.6 12.2 12.6 11.2Z" fill="' + ch + '"/>' +
      '<path d="M27.4 11.2C30 13.4 29 16.4 29.9 18.8C30.7 21 29.4 22.8 30.2 25.4C27.8 24.6 26.8 22.4 27.2 20.4C26.6 18.6 27.6 16.6 26.8 14.6C26.4 13.4 26.4 12.2 27.4 11.2Z" fill="' + ch + '"/>' +
      '<path d="M16.8 10.4C16 11.6 16.2 12.8 17.2 13.2C17.9 13.5 18.4 12.8 17.9 12.3M23.2 10.4C24 11.6 23.8 12.8 22.8 13.2C22.1 13.5 21.6 12.8 22.1 12.3M14.2 11.4C13.6 12.8 14.2 14 15 14" stroke="' + ch + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
      '<path d="M13.4 8.6a1.4 1.4 0 1 1 1.6 1.2M18 6.6a1.3 1.3 0 1 1 1.5 1.1M22.6 6.8a1.3 1.3 0 1 1 1.5 1.1M26 9a1.3 1.3 0 1 1 1.4 1.2M11.4 18a1.2 1.2 0 1 1 1.2 1.2M27.6 18.6a1.2 1.2 0 1 1 1.2 1.2" stroke="#fff" stroke-width=".4" opacity=".2" fill="none"/>',
    '<path d="M11.6 15.6C11 9.4 14.2 6.4 20 6.4S29 9.4 28.4 15.6C27.6 12.6 26.6 11.4 25.6 11C22.6 11.8 17.6 11.6 14.4 11C13 11.6 12.2 13.2 11.6 15.6Z" fill="' + ch + '" opacity=".5"/>',
    '<path d="M11.6 15C11 10 12 8 13 7.4L13.6 4.6 15.8 6.6 17.4 3.6 19.4 6 21.4 3.4 23 6.2 25.4 4.4 25.8 7.2 28.6 7 28.4 15C27.6 12 26.4 11 25.4 10.8C21 11.8 18 11.6 14.6 10.8C13.2 11.4 12.2 12.8 11.6 15Z" fill="' + ch + '"/>',
    // bouclés courts : boucles serrées sur le dessus
    '<path d="M11.8 14.6C11.4 9 14.6 6.4 20 6.4S28.6 9 28.2 14.6C27.4 12 25.6 10.8 20 10.8S12.6 12 11.8 14.6Z" fill="' + ch + '"/>' +
      [[13.4, 10, 2], [16.4, 8.2, 2.1], [19.8, 7.6, 2.2], [23.2, 8.2, 2.1], [26.4, 10, 2], [15, 11.4, 1.5], [24.8, 11.4, 1.5], [12.4, 13.4, 1.5], [27.6, 13.4, 1.5]].map(([x, y, r], i) => boucle(x, y, r, i % 2 === 0)).join(""),
    // attachés : cheveux tirés en arrière, front dégagé
    '<path d="M12 14.2C11.6 8.4 15 6 20 6S28.4 8.4 28 14.2C27.4 11.2 25.6 9.6 20 9.4S12.6 11.2 12 14.2Z" fill="' + ch + '"/><path d="M14.6 8.6C17 7.4 23 7.4 25.4 8.6M15.4 7.4C17.6 6.6 22.4 6.6 24.6 7.4" stroke="#fff" stroke-width=".4" opacity=".18" fill="none"/>' +
      '<circle cx="' + (oreX + .1) + '" cy="19.2" r=".45" fill="#E8EBEF"/>'
  ][t.coupe] || "";
  return '<svg class="tete' + (statique ? " fixe" : "") + (lead ? " lead" : "") + '" viewBox="0 0 40 40" style="--d:' + retard + 's" aria-hidden="true"><defs><clipPath id="' + u + 'c"><circle cx="20" cy="20" r="20"/></clipPath></defs><g clip-path="url(#' + u + 'c)">' +
    '<g class="t-tete">' + derriere + corps +
    '<path d="M16.6 22.5H23.4V29C22 30.6 18 30.6 16.6 29Z" fill="' + peau + '"/><path d="M16.6 24.6C18.6 26 21.4 26 23.4 24.6V26.4C21.4 27.6 18.6 27.6 16.6 26.4Z" fill="rgba(0,0,0,.12)"/>' +
    '<ellipse cx="' + oreX + '" cy="17.6" rx="1.6" ry="2.3" fill="' + peau + '"/><ellipse cx="' + (40 - oreX) + '" cy="17.6" rx="1.6" ry="2.3" fill="' + peau + '"/>' +
    '<path d="' + VIS + '" fill="' + peau + '"/>' +
    '<circle cx="15" cy="20.4" r="1.5" fill="#ff7f7f" opacity=".16"/><circle cx="25" cy="20.4" r="1.5" fill="#ff7f7f" opacity=".16"/>' +
    barbe + bouche +
    '<path d="M20 17.6C19.4 19.4 19.2 20 20.4 20.2" stroke="rgba(0,0,0,.28)" stroke-width=".7" fill="none" stroke-linecap="round"/>' +
    '<g class="t-yeux"><circle cx="16.6" cy="16.9" r="1" fill="#1d1d1f"/><circle cx="23.4" cy="16.9" r="1" fill="#1d1d1f"/><circle cx="16.9" cy="16.6" r=".32" fill="#fff"/><circle cx="23.7" cy="16.6" r=".32" fill="#fff"/></g>' +
    '<path d="M14.9 14.5C15.9 13.8 17.4 13.8 18.3 14.3M21.7 14.3C22.6 13.8 24.1 13.8 25.1 14.5" stroke="' + ch + '" stroke-width=".95" fill="none" stroke-linecap="round"/>' +
    lun + devant + "</g></g></svg>";
}

/* ---------- Atelier : niveau d'écurie et améliorations ---------- */
function choisirSaison(y) { ETAT.saisonY = y; ETAT.saisonYAn = new Date().getFullYear(); garder(); }
function saisonCourante() {
  const ys = anneesPodium(); if (ys.includes(ETAT.saisonY) && ETAT.saisonYAn === new Date().getFullYear()) return ETAT.saisonY;
  return !saisonOuverte() && !apercuSaison() && ys.length ? ys[0] : ys[ys.length - 1];   // en décembre 2026 : la chauffe
}
function jeuDe(nom, y) { const c = championnat(y || saisonCourante()); return (c.jeu || {})[nom] || { xp: 0, niv: 1, pioche: [], deck: deckBonus(y, nom), i: 0 }; }
function htmlAtelier(qui) {
  if (!ECU || ECU.nom !== qui) ECU = { nom: qui, e: equipDe(qui) };
  const ch = estChauffe(saisonCourante()), yA = anneeAmelioPour(), j = jeuDe(qui, ch ? saisonCourante() : yA), brouillon = ECU.e.amelio || "", sauve = amelioDe(qui, yA).s;
  const at = regleVisible("atelier"), dispo = ch || !at ? 0 : Math.max(0, j.niv - 1 - brouillon.length), plein = j.niv >= NIV_MAX, dans = j.xp - (j.niv - 1) * XP_NIVEAU;
  const lignes = Object.entries(AMELIOS).map(([t, a]) => {
    const n = brouillon.split(t).length - 1, neuf = n - (sauve.split(t).length - 1);
    return '<div class="at-l"><span class="at-ico">' + a.ico + '</span><span class="at-n"><b>' + a.nom + "</b><small>" + a.txt + '</small></span><span class="at-pips">' +
      [0, 1].map(i => '<i class="' + (i < n ? (i >= n - neuf ? "on neuf" : "on") : "") + '"></i>').join("") + "</span>" +
      '<button type="button" class="at-plus" data-amelio="' + t + '"' + (dispo && n < 2 ? "" : " disabled") + ' aria-label="Améliorer ' + a.nom + '">+</button></div>';
  }).join("");
  return '<div class="atelier"><div class="at-h"><span class="at-niv">Niv. <b>' + j.niv + "</b></span><div class=\"at-xp\"><span class=\"jauge\"><i style=\"width:" + (plein ? 100 : Math.round(dans / XP_NIVEAU * 100)) + '%"></i></span><small>' +
    (plein ? "Niveau max · " + j.xp + " XP" : j.xp + " XP · niveau " + (j.niv + 1) + " à " + j.niv * XP_NIVEAU + " XP") + "</small></div>" +
    (at ? '<span class="at-dispo' + (dispo ? " vif" : "") + '">' + (ch ? "🔥 démo" : dispo + " point" + (dispo > 1 ? "s" : "") + " à placer") + "</span>" : "") + "</div>" + (at ? lignes : "") +
    (ch ? '<p class="info" style="margin:0">🔥 Tour de chauffe : tu vois ton niveau grimper, mais les points d\'amélioration se placent à partir du 1<sup>er</sup> janvier.</p>' : "") +
    (brouillon.length > sauve.length ? '<div class="at-brouillon"><span>Choix pas encore enregistré. Une fois enregistré, il ne se reprend pas.</span><div class="btn-row"><button class="btn acc" type="button" id="at-garder">Enregistrer</button><button class="lien" type="button" id="at-annuler">Annuler</button></div></div>' : "") +
    (at ? '<p class="info" style="margin:0">Chaque niveau donne 1 point d\'amélioration et 1 carte bonus. XP = tes points de place et 🎯 chaque mois, +3 les mois où tu finis dernier. Une amélioration compte pour les cartes posées après son enregistrement. <a href="#" class="lien-regles" data-regles="niveaux">Règles</a></p>' : '<p class="info" style="margin:0">Chaque niveau gagné te donne une carte bonus. XP = tes points de place et 🎯 chaque mois, +3 les mois où tu finis dernier. <a href="#" class="lien-regles" data-regles="pioche">Règles</a></p>') + "</div>";
}
/* ---------- Éditeur de pilote : casque ou tête ---------- */
function htmlPilote(qui, e) {
  const t = decodeTete(e.tete), mode = e.pilote === "casque" ? "casque" : "tete";
  const ligne = (cle, lib, opts, swatch, note) => '<div class="tp-l"><span class="tp-k">' + lib + '</span><div class="tp-o">' + opts.map((o, i) =>
    '<button type="button" class="tp-b' + (swatch ? " sw" : "") + '" data-tp="' + cle + '" data-v="' + i + '" aria-pressed="' + (t[cle] === i) + '"' + (swatch ? ' style="--sw:' + o + '" aria-label="' + lib + " " + (i + 1) + '"' : "") + ">" + (swatch ? "" : esc(o)) + "</button>").join("") + "</div>" + (note ? '<small class="tp-note">' + note + "</small>" : "") + "</div>";
  return '<div class="tp" id="tp"><div class="seg tp-mode" role="group" aria-label="Pilote"><button type="button" data-pmode="tete" aria-pressed="' + (mode === "tete") + '">🙂 Ma tête</button><button type="button" data-pmode="casque" aria-pressed="' + (mode === "casque") + '">🪖 Mon casque</button></div>' +
    '<div class="tp-apercu"><span class="tp-grand">' + avatar(qui, Object.assign({}, e, { pilote: "tete" })) + '<em>Tête</em></span><span class="tp-grand">' + avatar(qui, Object.assign({}, e, { pilote: "casque" })) + "<em>Casque</em></span></div>" +
    '<p class="info" style="margin:0">' + (mode === "tete" ? "Ta tête s'affiche partout à côté de ton nom. Au volant, tu gardes ton casque." : "Ton casque s'affiche partout à côté de ton nom. Tu peux repasser à ta tête quand tu veux.") + "</p>" +
    (portraitsDe(qui) && portraitsDe(qui).length > 1 ? '<div class="tp-l"><span class="tp-k">Mes portraits</span><div class="tp-o">' + portraitsDe(qui).map(([lib, v]) => '<button type="button" class="tp-b tp-por" data-portrait="' + v + '" aria-pressed="' + (e.tete === v) + '">' + avatar(qui, Object.assign({}, e, { pilote: "tete", tete: v, vignette: true })) + esc(lib) + "</button>").join("") + "</div></div>" : "") +
    ligne("peau", "Peau", TETE.peau, true) + ligne("forme", "Visage", TETE.formes) + ligne("coupe", "Coupe", TETE.coupes) + ligne("cheveux", "Cheveux", TETE.cheveux, true) + ligne("barbe", "Barbe", TETE.barbes) +
    (t.barbe ? ligne("barbeC", "Couleur de barbe", TETE.cheveux, true) : "") +
    ligne("lunettes", "Lunettes", TETE.lunettes) + ligne("style", "Tenue", TETE.styles) +
    ligne("couleur", "Couleur", TETE.tenues, true, t.style === 5 ? "La combi prend la couleur de ton écurie." : "") +
    (t.style === 2 || t.style === 6 ? ligne("dessous", t.style === 6 ? "Dessous (col zippé)" : "T-shirt", TETE.tenues, true) : "") + ligne("expr", "Expression", TETE.expr) +
    '<button class="lien" type="button" id="tp-reset">↺ Revenir à mon portrait de départ</button></div>';
}

/* ---------- Règles : toujours accessibles (bouton 📖 du Podium et réglages) · V15 : réécrites, courtes, avec schémas ---------- */
function htmlRegles(tout, modeReserve) {
  const idx = esc(D.marche.indices[iRef()]), y = Math.max(saisonCourante() || 0, SAISON.premiere), mo = monacoMois(y);
  const s = (id, ico, t, corps) => '<section class="rg-s" id="rg-' + id + '"><h4>' + ico + " " + t + "</h4>" + corps + "</section>";
  const vu = id => modeReserve || (tout && !enReserve(etape(id))) || regleVisible(id);
  const vP = vu("pioche"), vN = vu("niveaux"), vA = vu("atelier"), vM = vu("monaco"), vF = vu("finale"), vC = vu("circuits"), vS = vu("gpspeciaux");
  const vB = ["prono", "pole", "defi", "rival", "equipe", "serie", "regularite"].some(vu), bientot = tout || modeReserve ? [] : etapesJeu().filter(e => !regleVisible(e.id));
  const sommaire = [["essentiel", "L'essentiel"], ["champ", "Points"], ["cartes", "Cartes"]].concat(vB ? [["bonus", "Bonus"]] : [], [["speciaux", "Mois spéciaux"]], vu("pieges") ? [["pieges", "Pièges"]] : [], vP ? [["pioche", "Rattrapage"]] : [], vN ? [["niveaux", "Niveaux"]] : [], [["gp", "Course et trophées"]], bientot.length ? [["bientot", "🎁 Bientôt"]] : []);
  // schémas (HTML/CSS, lisibles en clair comme en sombre)
  const etapeSch = (ico, quand, quoi) => '<div class="rg-et"><i>' + ico + "</i><b>" + quand + "</b><small>" + quoi + "</small></div>";
  const schemaMois = '<div class="rg-sch rg-flux" aria-label="Un mois en trois temps">' + etapeSch("🃏", "du 20 au 1<sup>er</sup>", "je pose ma carte" + (vu("prono") ? " et mon pronostic" : "")) + '<span class="rg-fl">→</span>' +
    etapeSch("👀", "le 2", "tout est révélé") + '<span class="rg-fl">→</span>' + etapeSch("📊", "fin du mois", "relevé → points") + "</div>";
  const schemaBareme = '<div class="rg-sch rg-bar" aria-label="Barème">' + BAREME.map((p, i) => '<div class="rg-b"><span style="height:' + (8 + p * 9) + 'px"></span><b>' + p + "</b><small>" + (i + 1) + (i ? "<sup>e</sup>" : "<sup>er</sup>") + "</small></div>").join("") +
    '<div class="rg-b plus"><span style="height:17px"></span><b>+1</b><small>🎯 bats le ' + idx + "</small></div></div>";
  const chip = (t, c) => '<span class="rg-ch' + (c ? " " + c : "") + '">' + t + "</span>";
  const schemaCalcul = '<div class="rg-sch rg-calc" aria-label="Calcul d\'un mois">' + chip("Place") + "+" + chip("🎯") + "+" + chip("🃏 carte ≤ +" + PLAFOND_CARTE) + "+" + chip("✨ bonus") + "=" + chip("points du mois", "tot") + "</div>";
  const schemaCartes = '<div class="rg-sch rg-cartes">' + CARTES.map(c => '<div class="rg-ca"><i>' + c.ico + "</i><b>" + esc(c.nom) + "</b><small>" + esc(c.court) + "</small></div>").join("") + "</div>";
  return (modeReserve ? "" : '<div class="rg-sommaire">' + sommaire.map(([id, l]) => '<button type="button" data-rg="' + id + '">' + l + "</button>").join("") + "</div>") +
    (modeReserve ? "" : s("essentiel", "⚡", "L'essentiel",
      "<p>Chaque mois, les pilotes sont classés sur la <b>performance de leur portefeuille</b> (versements neutralisés : seul le % compte). La saison va de janvier à décembre ; le plus de points gagne.</p>" + schemaMois +
      '<p class="rg-note">🔥 Décembre 2026 = tour de chauffe : tout marche, rien ne compte (cartes jusqu\'au 5).</p>')) +
    s("champ", "🏁", "Les points du mois", schemaBareme + schemaCalcul +
      "<ul><li>Ex æquo : mêmes points. Un mois ne descend jamais sous 0.</li><li>Le mois compte quand tout le monde a saisi son relevé.</li><li>Égalité au championnat : le plus de victoires, puis la meilleure performance cumulée.</li></ul>") +
    s("cartes", "🃏", "Les cartes", schemaCartes +
      "<ul><li><b>Une par mois</b>, face cachée dans le Stand (modifiable jusqu'au 1<sup>er</sup>), révélée le 2.</li><li>Rejouable, mais <b>pas deux mois de suite</b>. Au plus <b>+" + PLAFOND_CARTE + "</b> par mois.</li>" +
      (vC ? "<li>🗺️ <b>Atout du circuit</b> : chaque circuit préfère une carte ; si tu la joues <b>et qu'elle marque</b> : <b>+1</b> (secret jusqu'au 2, un indice 🔍 avant ; si 2 pilotes ou plus marquent avec : personne n'a le +1).</li>" : "") + "</ul>") +
    (vB ? s("bonus", "✨", "Les bonus", '<div class="rg-tab">' +
      (vu("defi") ? "<div><b>🏁 Défi du mois</b><span>un objectif différent chaque mois (battre le Nasdaq, faire mieux que l'or, finir positif…), annoncé le 20</span><em>+1</em></div>" : "") +
      (vu("prono") ? "<div><b>🔮 Pronostic</b><span>qui gagne le mois ? · le " + idx + " fera-t-il plus de +1 % ?</span><em>+1 / +1</em></div>" : "") +
      (vu("pole") ? "<div><b>🅿️ Pole position</b><span>ton chiffre pour le " + idx + " du mois : le plus proche</span><em>+1</em></div>" : "") +
      (vu("equipe") ? "<div><b>🤝 Équipe</b><span>tout le monde bat le " + idx + " le même mois</span><em>+1 chacun</em></div>" : "") +
      (vu("serie") ? "<div><b>🔥 Série</b><span>chaque 3<sup>e</sup> mois d'affilée sans finir dernier</span><em>+1</em></div>" : "") +
      (vu("rival") ? "<div><b>😈 Rival</b><span>choisi en secret (20 déc. → 1<sup>er</sup> janv.) ; devant lui en fin de saison</span><em>+3</em></div>" : "") +
      (vu("regularite") ? "<div><b>🛡️ Régularité</b><span>fin de saison : le moins souvent dernier (puis le plus de mois positifs)</span><em>+3</em></div>" : "") + "</div>") : "") +
    s("speciaux", "📅", "Les mois spéciaux", '<div class="rg-tab">' +
      (vM ? "<div><b>🎲 Le Plateau maudit</b><span>" + (regleActive("monaco", mo) ? esc(moisLong(mo)) : "un mois tiré") + " : le dernier du championnat</span><em>place ×2</em></div>" : "") +
      (vS ? "<div><b>🌼 Le Sacre du solstice</b><span>juillet : le vainqueur du mois</span><em>+2</em></div><div><b>🍄 Instinct de survie</b><span>septembre : le 🎯</span><em>vaut +2</em></div>" : "") +
      (vF ? "<div><b>🏆 Finale</b><span>décembre : tout le monde</span><em>place ×2</em></div>" : "") +
      (vu("vote") ? "<div><b>🗳️ Vote</b><span>2 → 31 décembre : « le coup de la saison » (pas pour soi)</span><em>plaque</em></div>" : "") + "</div>") +
    (vu("pieges") ? s("pieges", "🪤", "Les pièges des circuits", "<p>Les autres mois, le circuit a son <b>piège</b> : une petite règle qui ne vaut que ce mois-là. Il s'affiche dès le 20 du mois d'avant (Stand et Classement).</p>" +
      '<div class="rg-tab">' + CAL_GP.filter(id => PIEGES[id]).map(id => "<div><b>" + GPS[id].drap + " " + esc(GPS[id].ville) + "</b><span>" + PIEGES[id].ico + " <b>" + esc(PIEGES[id].nom) + "</b> : " + esc(PIEGES[id].txt) + "</span><em>" + esc(moisCourt(y * 100 + CAL_GP.indexOf(id) + 1).replace(/ \d+$/, "")) + "</em></div>").join("") + "</div>" +
      '<p class="rg-note">Le mois du Plateau maudit (tiré au sort) remplace le circuit prévu : pas de piège ce mois-là.</p>') : "") +
    (vP ? s("pioche", "🎴", "Le rattrapage",
      "<p>Dernier d'un mois ? Tu pioches <b>1 carte bonus</b>, jouable dès le mois suivant, une fois par saison :</p><ul>" + CARTES_BONUS.map(c => "<li>" + c.ico + " <b>" + esc(c.nom) + "</b> : " + esc(c.court || c.def) + "</li>").join("") + "</ul>") : "") +
    (vN ? s("niveaux", "🔧", vA ? "Niveaux et atelier" : "Niveaux d'écurie",
      "<ul><li>XP = tes points de place + ton 🎯 (+3 les mois où tu finis dernier). Un niveau tous les " + XP_NIVEAU + " XP (max " + NIV_MAX + "), remis à 1 chaque saison.</li><li>Chaque niveau : 1 carte bonus" + (vA ? " et 1 point d'amélioration" : "") + ".</li></ul>") : "") +
    s("gp", "🏎️", "Course, écurie et trophées",
      "<ul><li><b>Course</b> : " + TOUR_GP + " points = un tour ; un circuit à thème par mois ; la météo suit le " + idx + ".</li>" +
      '<li id="rg-ecurie"><b>Écurie</b> : casque, livrée, klaxon… purement cosmétique, débloqué par les défis.</li>' +
      '<li id="rg-defis"><b>Trophées</b> : défis 🥉🥈🥇💎 (acquis pour toujours), <b>exclusifs</b> 💎 pour le premier qui réussit (à égalité le même mois : chacun), <b>👑 premier millionnaire</b> (patrimoine financier, montant jamais montré). Le serveur vérifie tout.</li></ul>') +
    (bientot.length ? s("bientot", "🎁", "Bientôt", "<ul>" + bientot.map(e => "<li>" + (estAdmin() ? '<button type="button" class="lien" data-etape="' + e.id + '">🔒 ' + esc(e.nom) + "</button>" : e.ico + " <b>" + esc(e.nom) + "</b>") + " · " + esc(moisEtape(e)) + "</li>").join("") + "</ul>") : "");
}
function ouvrirRegles(section, tout) {
  const o = document.createElement("div"); o.className = "regles"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Règles du Versus");
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><b>📖 Les règles</b><button class="btn ghost rg-tuto" type="button" id="rg-tuto">▶ Tuto</button><button class="icon-btn rg-x" type="button" id="rg-x" aria-label="Fermer">✕</button></div><div class="rg-corps">' + (tout ? '<p class="rg-admin">👀 Vue admin : toutes les règles, y compris celles que les autres ne voient pas encore.</p>' : "") + htmlRegles(tout) + "</div></div>";
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  const fermer = () => { o.remove(); document.documentElement.classList.remove("fige"); };
  o.addEventListener("click", e => { if (e.target === o) fermer(); });
  o.querySelector("#rg-x").addEventListener("click", fermer);
  o.querySelector("#rg-tuto").addEventListener("click", () => { fermer(); ouvrirTuto(); });
  const corps = o.querySelector(".rg-corps");
  const aller = id => { const el = o.querySelector("#rg-" + id); if (el) corps.scrollTop += el.getBoundingClientRect().top - corps.getBoundingClientRect().top - corps.querySelector(".rg-sommaire").offsetHeight - 4; };
  o.querySelectorAll("[data-rg]").forEach(b => b.addEventListener("click", () => aller(b.dataset.rg)));
  if (section) setTimeout(() => aller(section), 0);
}

/* ---------- Tuto : à la première ouverture du championnat, et depuis les règles ---------- */
const TUTO = [
  { ico: "🏁", t: "Le Podium en bref", html: true, p:
    "• <b>Chaque mois</b> : 6 · 4 · 2 · 0 points selon ta performance, <b>+1 🎯</b> si tu bats le S&P 500.<br>" +
    "• <b>Ta carte</b> : une par mois, posée du 20 au 1er dans le <b>Stand</b>, révélée le 2 (jusqu'à +4).<br>" +
    "• <b>Chaque mois aussi</b> : 🏁 un défi, 🔮 un pronostic et 🅿️ la pole position (+1 chacun).<br>" +
    "• <b>Sur la saison</b> : 🔥 série, 😈 rival, 🛡️ régularité ; le Plateau maudit, le Sacre du solstice, l'Instinct de survie et la Finale ×2.<br>" +
    "Décembre 2026 = tour de chauffe : rien ne compte. Tout le détail, avec schémas : 📖 Règles." }
];
function ouvrirTuto() { ouvrirGuide("Comment ça marche", TUTO, "C'est parti 🏁"); }
/** Petit guide en diapos (tuto du jeu, saisie d'un ordre, relevé du Versus) ; les textes acceptent <b> */
function ouvrirGuide(titre, diapos, finLib) {
  const o = document.createElement("div"); o.className = "tuto"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", titre); let i = 0;
  const peindre = () => {
    const s = diapos[i];
    const un = diapos.length === 1;   // un seul écran : texte à gauche, sans compteur ni « Précédent »
    o.innerHTML = '<div class="tuto-c"><span class="tuto-k">' + esc(titre) + (un ? "" : " · " + (i + 1) + " / " + diapos.length) + '</span><div class="tuto-i">' + s.ico + "</div><h3>" + esc(s.t) + "</h3><p" + (un ? ' style="text-align:left"' : "") + ">" + (s.html ? s.p : esc(s.p)) + "</p>" +
      (un ? "" : '<div class="tuto-pts">' + diapos.map((x, j) => "<i" + (j === i ? ' class="on"' : "") + "></i>").join("") + "</div>") +
      '<div class="btn-row">' + (un ? "" : '<button class="btn ghost" type="button" data-t="-1"' + (i ? "" : " disabled") + ">Précédent</button>") + '<button class="btn acc" type="button" data-t="1">' + (i === diapos.length - 1 ? esc(finLib || "Compris") : "Suivant") + "</button></div></div>";
    o.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => { const n = i + +b.dataset.t; if (n >= diapos.length) { o.remove(); return; } i = Math.max(0, n); peindre(); }));
  };
  peindre(); document.body.appendChild(o);
  o.addEventListener("click", e => { if (e.target === o) o.remove(); });
}
/* Guide du relevé mensuel du Versus (ouvert tout seul la première fois, puis depuis « ❓ ») */
const TUTO_RELEVE = [
  { ico: "📅", t: "Une fois par mois", html: true, p: "Le <b>dernier jour ouvré du mois</b>, après la clôture de 18 h, la ligne du mois s'ouvre. Saisis ton relevé ce soir-là ou dans les jours qui suivent : la course avance quand tout le monde l'a fait." },
  { ico: "💶", t: "Versé ce mois", html: true, p: "Pour chaque enveloppe (PEA, assurance vie, CTO, crypto) : l'argent que tu as <b>viré dessus</b> pendant le mois. Négatif si tu en as retiré, 0 si rien. Pas tes achats d'actions : seulement ce qui entre ou sort de l'enveloppe." },
  { ico: "📈", t: "Valeur fin de mois", html: true, p: "La <b>valeur totale</b> de l'enveloppe affichée par ta banque le dernier jour : titres et espèces compris. 0 si l'enveloppe est vidée. C'est elle qui fait ta performance du mois." },
  { ico: "✏️", t: "7 jours pour corriger", html: true, p: "Après l'envoi, ton relevé reste <b>modifiable et annulable 7 jours</b> (onglet Journal), puis il est figé. Pareil pour les relevés remplis automatiquement : 7 jours pour les corriger. L'app te prévient si un chiffre a l'air bizarre." }
];
function guideReleve() { ouvrirGuide("Ton relevé du mois", TUTO_RELEVE, "C'est compris"); }

