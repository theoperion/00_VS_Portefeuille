/* ---------- 🎲 Les mini-jeux d'univers (saison 2027) : moteur générique de l'appli ----------
   Un mini-jeu par mois, un geste par jour, AUCUN point au championnat, jamais un montant.
   SECRET : ce dépôt est public. Ici, aucun texte de règle : titres, règles, options du jour, messages et résultats
   viennent du serveur (action « mj »), qui ne les envoie qu'à partir du 1er du mois concerné (ou en aperçu à l'admin).
   L'appli ne garde que : le moteur (chargement, carte du jour, pastille, révélation, cérémonie ; l'onglet Trophées › Mondes lit etatMiniJeu),
   des « peintres » d'écran par type de jeu (MJ_PEINTRES) et des décors dessinés par univers (MJ_DECORS), sans mots.
   Le ticket d'or d'octobre (js/4-grandprix.js) reste à part : etatMiniJeu("singapour") lit seulement ses gagnants et ses carrés dorés. */
let MJ = null, MJ_T = 0, MJ_N = 0, MJ_EN_COURS = null, MJ_GESTE_T = 0, MJ_CARTE = null;   // MJ_GESTE_T : heure du dernier geste réussi ; MJ_CARTE : la carte posée (même détachée par un redessin)
const MJ_DEBUT = new Date(2027, 0, 1);
const MJ_MOIS_NOMS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** objets d'écurie gagnés par un mini-jeu : « emplacement.id » → mois (aaaamm) ; l'objet reste caché tant que son mois n'a pas commencé */
const MJ_OBJETS = { "plaque.epice": 202701, "plaque.voliere": 202702, "plaque.cheshire": 202703, "plaque.precieux": 202704, "plaque.eywa": 202705, "plaque.kyber": 202706, "plaque.toquedor": 202707, "plaque.joyce": 202708, "plaque.ithaque": 202709, "plaque.bataillon": 202711 };

/* vitesse (26/11) : la demande part dès l'ouverture de l'appli (copie du classement à l'écran), en même temps que le classement, sans attendre sa réponse */
function mjOuvert() { return Date.now() >= MJ_DEBUT.getTime() && typeof SOURCE !== "undefined" && (SOURCE === "api" || SOURCE === "cache") && typeof D !== "undefined" && !!D && !simulation(); }
function mjMoisNum() { const d = new Date(); return d.getFullYear() * 100 + d.getMonth() + 1; }
/* vitesse (26/11) : le dernier état reçu AUJOURD'HUI est gardé sur ce téléphone (le sien seulement, jamais en simulation) et s'affiche tout de suite ;
   la réponse du serveur arrive par-dessus. Un état d'un autre jour ou d'un autre pilote n'est jamais montré. */
const MJ_MEMOIRE = "versus.mjEtat";
function mjAujJ() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function lireMemoireMJ() {
  try { const c = JSON.parse(stock.get(MJ_MEMOIRE) || "null"), moi = moiVrai();
    return c && c.rep && c.rep.ouvert && moi && c.nom === moi && c.rep.aujourdhui === mjAujJ() ? c.rep : null; } catch (e) { return null; }
}
function garderMemoireMJ() { try { if (MJ && !simulation() && moiVrai()) stock.set(MJ_MEMOIRE, JSON.stringify({ nom: moiVrai(), rep: MJ })); } catch (e) { /* stockage plein ou indisponible */ } }
async function chargerMJ(force) {
  if (!mjOuvert()) return;
  if (!MJ) { const m = lireMemoireMJ(); if (m) appliquerMJ(m, false); }
  if (MJ_EN_COURS) return MJ_EN_COURS;   // une seule demande à la fois
  if (!force && Date.now() - MJ_T < 60000) return;
  MJ_T = Date.now();
  MJ_EN_COURS = (async () => {
    const parti = Date.now(), rep = await posterAdmin({ action: "mj", op: "etat" });
    if (!rep || !rep.ok) { MJ_T = Date.now() - 50000; return; }   // pas de réponse : on réessaie dans 10 s au plus tôt
    if (!rep.ouvert) return;
    if (parti <= MJ_GESTE_T) return;   // relecture jeu-code-donnees : réponse partie AVANT le dernier geste réussi, elle ne sait pas qu'il a eu lieu
    appliquerMJ(rep, true);
  })();
  try { await MJ_EN_COURS; } finally { MJ_EN_COURS = null; }
}
/** pose un état (frais = venu du serveur) ; ne redessine que ce qui a changé, et jamais une carte en train d'être jouée */
function mjOccupee(el) { return !!(el && (el.dataset.envoi === "1" || el.querySelector('[aria-pressed="true"]'))); }   // un geste part, ou un formulaire est à moitié rempli
function appliquerMJ(rep, frais) {
  const ancien = MJ, a = ancien && ancien.courant, n = rep.courant, el = document.querySelector(".mj-carte:not(.mj-ap)");
  // jamais de retour en arrière le même jour : un geste déjà fait ne redevient pas « à jouer » (réponse en retard, mémoire d'un autre onglet…)
  if (a && n && a.mois === n.mois && a.etat && n.etat && a.etat.jour === n.etat.jour && a.etat.fait && !n.etat.fait) rep.courant = a;
  const change = !ancien || JSON.stringify(ancien) !== JSON.stringify(rep);
  const occupe = mjOccupee(el);
  const nn = rep.courant, memeJour = !!(a && nn && a.mois === nn.mois && a.etat && nn.etat && a.etat.jour === nn.etat.jour && !!a.etat.fait === !!nn.etat.fait);   // déjà joué ailleurs, ou un autre jour : on redessine toujours
  const garde = memeJour && (occupe || JSON.stringify(a) === JSON.stringify(nn));
  if (garde) rep.courant = a;   // la carte à l'écran garde son état (et ses boutons branchés)
  MJ = rep;
  if (frais) garderMemoireMJ();
  if (change) {
    mjChange();
    if (!(garde && el)) poserMJDOM();
    majPastilleMJ();
    if (vueActive() === "trophees" && ongletPodium() === "defis" && typeof rendreTrophees === "function") rendreTrophees();
  }
  if (frais) setTimeout(annoncesMJ, 1200);
}

/* ---------- la pastille : le geste du jour n'est pas fait ---------- */
function mjAFaire() { return !!(MJ && MJ.courant && MJ.courant.etat && !MJ.courant.etat.fait); }
function majPastilleMJ() {
  const a = mjAFaire();
  document.querySelectorAll(".onglet[data-vue='trophees'], .pod-tabs [data-pod='gp']").forEach(b => {
    let p = b.querySelector(".mj-pas");
    if (a && !p) { p = document.createElement("span"); p.className = b.classList.contains("onglet") ? "pastille-nav mj-pas" : "pastille mj-pas"; p.setAttribute("aria-label", "Mini-jeu du jour à jouer"); b.style.position = b.style.position || "relative"; b.appendChild(p); }
    if (!a && p) p.remove();
  });
  // page Course : « 🎲 Mini-jeu du jour à jouer ↓ » en haut, à côté de l'atout du circuit (relecture jeu-joueur, 25/11), qui descend jusqu'à la carte
  const carte = document.querySelector(".mj-carte:not(.mj-ap)"), pi = document.querySelector("#gp-piste");
  let b = document.querySelector(".mj-aller");
  if (!(a && carte && pi)) { if (b) { const z = b.parentNode; b.remove(); if (z && z.classList.contains("mj-aller-z") && !z.children.length) z.remove(); } return; }
  if (b) return;
  b = document.createElement("button"); b.type = "button"; b.className = "mj-aller"; b.textContent = "🎲 Mini-jeu du jour à jouer ↓";
  b.addEventListener("click", () => allerCarteMJ());
  const ancre = document.querySelector(".gp-ancre") || pi, av = ancre.previousElementSibling;
  if (av && av.classList.contains("gp-atouts")) av.appendChild(b);
  else { const z = document.createElement("div"); z.className = "gp-atouts mj-aller-z"; z.appendChild(b); ancre.parentNode.insertBefore(z, ancre); }
}
/** ouvre la page Course et descend jusqu'à la carte du mini-jeu (pastille, révélation « C'est parti ! », fiche d'un monde en cours) */
function allerCarteMJ() {
  const vise = () => { const c = document.querySelector(".mj-carte:not(.mj-ap), .gp-tablette:not(.tk-ap)"); if (c) c.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); };
  if (document.querySelector(".mj-carte:not(.mj-ap)") && vueActive() === "trophees" && ongletPodium() === "gp" && GP_ETAPE === null) return vise();
  ETAT.podium = "gp"; GP_ETAPE = null; garder(); if (vueActive() === "trophees") rendreTrophees(); else allerA("trophees");
  setTimeout(vise, 500);
}

/* ---------- la carte « mini-jeu du mois » (page Course, sous la piste du circuit du mois) ---------- */
function poserMJDOM() {
  const pi = document.querySelector("#gp-piste"), C = MJ && MJ.courant, vieux = MJ_CARTE;
  // relecture jeu-code-donnees : la page Course se redessine (classement arrivé…) pendant qu'on coche ou qu'un geste part : la même carte est
  // simplement replacée, jamais refaite (sinon la saisie à moitié faite serait perdue)
  const garder = !!(vieux && C && mjOccupee(vieux) && vieux.__mj && vieux.__mj.C === C && vieux.__mj.mois === C.mois && vieux.__mj.jour === (C.etat || {}).jour && vieux.__mj.fait === !!(C.etat || {}).fait);
  document.querySelectorAll(".mj-carte:not(.mj-ap)").forEach(e => { if (!(garder && e === vieux)) e.remove(); });
  if (!pi || !C || pi.dataset.circuit !== C.univers || mjMoisNum() !== C.mois) { if (garder) vieux.remove(); return; }
  const P = MJ_PEINTRES[C.type]; if (!P) return;
  // sous la barre d'outils de la piste (Carte / Visite / Hélico / son / ⋯ / Plein écran), jamais entre la piste et ses boutons (relecture jeu-joueur, 25/11)
  const ancre = document.querySelector(".gp-vues2") || document.querySelector(".gp-ancre") || pi;
  if (garder) { if (ancre.nextElementSibling !== vieux) ancre.after(vieux); return; }
  ancre.insertAdjacentHTML("afterend", P.carte(C, C.etat, {}));
  brancherCarteMJ(ancre.nextElementSibling, C, null);
}
/** branche les boutons d'une carte ; ap = aperçu admin (null pour le vrai jeu) */
function brancherCarteMJ(el, C, ap) {
  if (!el) return;
  if (!ap) { el.__mj = { C, mois: C.mois, jour: (C.etat || {}).jour, fait: !!(C.etat || {}).fait }; MJ_CARTE = el; }
  const P = MJ_PEINTRES[C.type]; if (P && P.brancher) P.brancher(el, C, ap);
  const r = el.querySelector("[data-mj-regle]"); if (r) r.addEventListener("click", () => revelationMJ(C, true));
}
/** envoie LE geste du jour (g = ce que le peintre a rassemblé) ; un seul envoi même en cas de double clic */
async function jouerMJ(el, C, g, ap, bouton) {
  const bs = el.querySelectorAll("[data-mj-opt], [data-mj-env], [data-mj-v], [data-mj-ap]"); if (el.dataset.envoi === "1") return;
  el.dataset.envoi = "1"; bs.forEach(b => { b.disabled = true; }); if (bouton) bouton.classList.add("choisi");
  if (window.SONS && SONS.actif && SONS.actif()) try { SONS.vibrer([15, 25, 15]); } catch (e) { /* sans vibreur */ }
  const rep = ap ? await ap.geste(g) : await posterAdmin({ action: "mj", op: "geste", mois: C.mois, geste: g });
  if (!rep || !rep.ok) {
    el.dataset.envoi = ""; bs.forEach(x => { x.disabled = !!x.dataset.off; }); if (bouton) bouton.classList.remove("choisi");
    const P = MJ_PEINTRES[C.type]; if (P && P.verifier) P.verifier(el);
    toast(rep && rep.message ? rep.message : "Le serveur ne répond pas : réessaie.");
    if (rep && rep.erreur === "deja" && !ap) chargerMJ(true);
    return rep;
  }
  if (!ap) MJ_GESTE_T = Date.now();
  C.etat = rep.etat; if (!ap) mjChange(); repeindreCarteMJ(el, C, ap, rep.message);
  if (window.SONS) try { SONS.klaxon("confettis"); } catch (e) { /* sans son */ }
  if (!ap) { majPastilleMJ(); poserCacheMJ(); garderMemoireMJ(); }
  return rep;
}
function repeindreCarteMJ(el, C, ap, message) {
  if (!el || !el.isConnected) return;
  const neuf = document.createElement("div"); neuf.innerHTML = MJ_PEINTRES[C.type].carte(C, C.etat, { message, ap: !!ap });
  const c = neuf.firstElementChild; if (ap) c.classList.add("mj-ap");
  el.replaceWith(c); brancherCarteMJ(c, C, ap);
}
/* ---------- les peintres : un par type de jeu (aucun texte de règle ici, tout vient du serveur) ---------- */
/** la coque commune : titre, décor, mot de la nuit, ligne du jour, [le milieu du peintre], compteurs, objectif commun, [les actions], tableau, règle */
function coqueMJ(C, E, o, milieu, actions) {
  const K = C.contenu || {}, d = MJ_DECORS[C.univers], k = E.commun;
  return '<div class="mj-carte mj-t-' + esc(C.type) + " mj-u-" + esc(C.univers) + (E.fait ? " fait" : "") + (o.ap ? " mj-ap" : "") + '" data-mois="' + C.mois + '">' +
    '<div class="mj-h"><b>' + esc(K.ico || "🎲") + " " + esc(K.titre || "Mini-jeu du mois") + (o.ap ? " · aperçu" : "") + "</b><small>🎲 Mini-jeu du mois · jour " + (E.jour || "") + " · aucun point au championnat</small></div>" +
    (K.but ? '<p class="mj-but">🎯 ' + esc(K.but.replace(/^Ton but : /, "")) + "</p>" : "") +   // « ton but » en une ligne, envoyé par le serveur
    (d ? '<div class="mj-scene" aria-hidden="true">' + d(E.scene || {}, o, "mj" + (++MJ_N)) + "</div>" : "") +
    (E.nuit ? '<p class="mj-nuit">' + esc(E.nuit) + "</p>" : "") +
    (E.ligne && E.ligne.length ? '<ul class="mj-ligne">' + E.ligne.map(l => "<li>" + esc(l) + "</li>").join("") + "</ul>" : "") +
    (milieu || "") +
    (E.compteurs && E.compteurs.length ? '<div class="mj-cpt">' + E.compteurs.map(c => '<span><i aria-hidden="true">' + esc(c.ico) + "</i><b>" + esc(String(c.val)) + "</b><small>" + esc(c.lib) + "</small></span>").join("") + "</div>" : "") +
    (k ? '<div class="mj-commun' + (k.reussi ? " ok" : "") + '"><div class="mj-cm-t"><b>🤝 ' + esc(k.lib || "Objectif commun") + "</b><small>" + (k.reussi ? "✅ réussi : trophée pour tous !" : esc(k.val + " / " + k.objectif)) + "</small></div>" +
      '<span class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="' + (+k.objectif || 1) + '" aria-valuenow="' + (+k.val || 0) + '"><i style="width:' + Math.round(Math.max(0, Math.min(1, (+k.val || 0) / (+k.objectif || 1))) * 100) + '%"></i></span></div>' : "") +
    (E.fait ? '<p class="mj-fait" aria-live="polite">✅ ' + esc(o.message || E.message || "Fait pour aujourd'hui. Reviens demain !") + "</p>" : (actions || "")) +
    (E.tableau && E.tableau.length ? '<details class="mj-tab"><summary>📊 Le tableau</summary><ol>' + E.tableau.map(t => '<li class="' + (t.nom === (o.ap ? "Toi (aperçu)" : moiVrai()) ? "moi" : "") + '"><span class="nmp" style="--c:' + (o.ap ? "var(--accent)" : couleur(t.nom)) + '"><i></i>' + esc(t.nom) + "</span><small>" + esc(t.txt || String(t.val)) + "</small></li>").join("") + "</ol></details>" : "") +
    '<button type="button" class="lien mj-regle" data-mj-regle>📖 La règle du mini-jeu</button></div>';
}
const MJ_PEINTRES = {
  /** « choix du jour » : 2 ou 3 gros boutons, un seul toucher */
  choix: {
    carte: (C, E, o) => coqueMJ(C, E, o, "", '<div class="mj-opts">' + (E.options || []).map(x => '<button type="button" class="mj-o" data-mj-opt="' + esc(x.id) + '"' + (x.off ? ' disabled data-off="1"' : "") + '><span class="mj-oi" aria-hidden="true">' + esc(x.ico) + "</span><b>" + esc(x.lib) + "</b><small>" + esc(x.sous || "") + "</small></button>").join("") + "</div>"),
    brancher(el, C, ap) { el.querySelectorAll("[data-mj-opt]").forEach(b => b.addEventListener("click", () => jouerMJ(el, C, { choix: b.dataset.mjOpt }, ap, b))); }
  },
  /** « formulaire » : plusieurs petites questions (groupes de boutons) puis UN bouton qui envoie le tout (un seul geste) */
  formulaire: {
    carte: (C, E, o) => coqueMJ(C, E, o, "", '<div class="mj-form">' + (E.groupes || []).map(g => '<fieldset class="mj-g' + (g.requis ? " requis" : "") + '" data-mj-g="' + esc(g.id) + '"><legend>' + esc(g.titre) + "</legend>" +
        (g.texte ? '<p class="mj-g-txt">' + esc(g.texte) + "</p>" : "") + (g.question ? "<small>" + esc(g.question) + "</small>" : "") +
        '<div class="mj-g-o">' + g.options.map(x => '<button type="button" class="mj-v" data-mj-v="' + esc(x.id) + '" aria-pressed="false">' + esc(x.lib) + "</button>").join("") + "</div></fieldset>").join("") +
      '<button type="button" class="btn acc mj-env" data-mj-env disabled>' + esc(E.bouton || "Valider") + "</button></div>"),
    verifier(el) { const b = el.querySelector("[data-mj-env]"); if (b) b.disabled = [...el.querySelectorAll(".mj-g.requis")].some(g => !g.querySelector('[aria-pressed="true"]')) || !el.querySelector('.mj-g [aria-pressed="true"]'); },
    brancher(el, C, ap) {
      const P = MJ_PEINTRES.formulaire;
      el.querySelectorAll("[data-mj-v]").forEach(b => b.addEventListener("click", () => { if (b.disabled) return; const g = b.closest(".mj-g"), dejaLa = b.getAttribute("aria-pressed") === "true";
        g.querySelectorAll("[data-mj-v]").forEach(x => x.setAttribute("aria-pressed", "false")); if (!dejaLa || g.classList.contains("requis")) b.setAttribute("aria-pressed", "true"); P.verifier(el); }));
      const env = el.querySelector("[data-mj-env]"); if (env) env.addEventListener("click", () => { const R = {};
        el.querySelectorAll(".mj-g").forEach(g => { const v = g.querySelector('[aria-pressed="true"]'); if (v) R[g.dataset.mjG] = v.dataset.mjV; });
        jouerMJ(el, C, { reponses: R }, ap, env); });
      P.verifier(el);
    }
  },
  /** « chasse » : le geste se fait ailleurs dans l'appli (le serveur dit où et envoie le dessin) ; la carte montre la collection */
  chasse: {
    carte(C, E, o) {
      const grille = E.cartes ? '<div class="mj-coll">' + E.cartes.map(c => '<span class="mj-cc' + (c.n ? " a" : "") + (c.rare ? " rare" : "") + '" title="' + esc(c.n ? c.nom : "???") + '"><i aria-hidden="true">' + (c.n ? esc(c.ico) : "?") + "</i><small>" + esc(c.n ? c.nom : c.rare ? "très rare" : "à trouver") + (c.n > 1 ? " ×" + c.n : "") + "</small></span>").join("") + "</div>" : "";
      const act = o.ap && E.chasse ? '<button type="button" class="btn ghost mj-apchasse" data-mj-ap>👀 Aperçu : aujourd\'hui dans l\'onglet « ' + esc(MJ_ONGLETS[E.chasse.onglet] || E.chasse.onglet) + " » : l'attraper</button>" : E.indice ? '<p class="mj-indice">' + esc(E.indice) + "</p>" : "";
      return coqueMJ(C, E, o, grille, act);
    },
    brancher(el, C, ap) { const b = el.querySelector("[data-mj-ap]"); if (b && C.etat.chasse) b.addEventListener("click", () => jouerMJ(el, C, { attraper: 1, onglet: C.etat.chasse.onglet }, ap, b)); }
  }
};
const MJ_ONGLETS = { classement: "Classement", mois: "Mois", fiche: "Fiche", trophees: "Podium" };
/* ---------- la chasse : l'objet caché (dessin et texte envoyés par le serveur) posé dans l'onglet tiré pour moi, tant qu'il n'est pas attrapé ---------- */
function poserCacheMJ() {
  const C = MJ && MJ.courant, ch = C && C.type === "chasse" && C.etat && !C.etat.fait && C.etat.chasse, ici = ch && !!document.querySelector('section.view[data-vue="' + ch.onglet + '"]:not([hidden])') && !document.querySelector(".revel, .regles, .tuto");
  let s = document.querySelector(".mj-cache");
  if (!ici) { if (s) s.remove(); return; }
  if (s) return;
  s = document.createElement("button"); s.type = "button"; s.className = "mj-cache"; s.setAttribute("aria-label", ch.aide || "Touche-moi");
  s.style.left = ch.x + "%"; s.style.top = ch.y + "%";
  s.innerHTML = ch.svg || '<span aria-hidden="true">✨</span>';
  document.body.appendChild(s);
  s.addEventListener("click", async () => { if (s.disabled) return; s.disabled = true; s.classList.add("pris");
    const rep = await posterAdmin({ action: "mj", op: "geste", mois: C.mois, geste: { attraper: 1, onglet: ch.onglet } });
    setTimeout(() => s.remove(), reduit ? 0 : 900);
    if (!rep || !rep.ok) { toast(rep && rep.message ? rep.message : "Le serveur ne répond pas : réessaie."); if (rep && rep.erreur !== "reseau") chargerMJ(true); return; }
    MJ_GESTE_T = Date.now(); C.etat = rep.etat; mjChange(); garderMemoireMJ(); toast(rep.message); majPastilleMJ(); poserMJDOM();
    if (window.SONS) try { SONS.klaxon("confettis"); } catch (e) { /* sans son */ } });
}
// toutes les 1,2 s : l'objet caché de la chasse, et la pastille (que d'autres parties de l'appli peuvent redessiner)
setInterval(() => { try { poserCacheMJ(); if (MJ) majPastilleMJ(); } catch (e) { /* jamais bloquant */ } }, 1200);
/* ---------- les décors dessinés (par univers) : seulement des formes ; leurs réglages (a, b, c…) viennent du serveur (« scene ») ---------- */
const MJ_DECORS = {
    silverstone(s, o, u) {
    const m = Math.min(12, s.a || 0), abri = Math.min(15, s.b || 0), w = 8 + m * 2.2, h = 3 + m * 1.5;
    const tas = m ? '<path d="M' + (100 - w) + " 98Q100 " + (98 - h * 2) + " " + (100 + w) + ' 98Z" fill="#E8742A" stroke="#9A3B0C" stroke-width="1"/><path d="M' + (100 - w * .5) + " " + (98 - h * .5) + "Q100 " + (98 - h * 1.4) + " " + (100 + w * .4) + " " + (98 - h * .6) + '" fill="none" stroke="#FFB067" stroke-width="1.4" opacity=".8"/>' +
      '<g class="p1" fill="#FFD08A">' + [0, 1, 2, 3].map(i => '<circle cx="' + (94 + i * 5) + '" cy="' + (82 - h - (i % 2) * 6) + '" r="1.3"/>').join("") + "</g>" : "";
    const lum = []; for (let i = 0; i < abri; i++) lum.push('<circle cx="' + (229 + (i % 5) * 6) + '" cy="' + (70 - Math.floor(i / 5) * 5) + '" r="1.8" fill="#FFB347"/>');
    const dents = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, c = Math.cos(a), si = Math.sin(a); dents.push('<path d="M' + (150 + 12 * c).toFixed(1) + " " + (40 + 7 * si).toFixed(1) + "L" + (150 + 7 * Math.cos(a + .22)).toFixed(1) + " " + (40 + 4 * Math.sin(a + .22)).toFixed(1) + "L" + (150 + 12 * Math.cos(a + .45)).toFixed(1) + " " + (40 + 7 * Math.sin(a + .45)).toFixed(1) + 'Z" fill="#F3E6CF"/>'); }
    const forme3 = '<g class="p3"><path d="M118 124C118 84 128 58 150 46" fill="none" stroke="#6E4B2E" stroke-width="22" stroke-linecap="round"/>' +
      [0, 1, 2, 3, 4].map(i => '<path d="M' + (108 + i * 3) + " " + (114 - i * 15) + "q12 " + (-4 + i) + " 22 " + (-2 - i) + '" fill="none" stroke="#4B3019" stroke-width="2" opacity=".7"/>').join("") +
      '<ellipse cx="150" cy="40" rx="17" ry="10" fill="#7B5A3A" stroke="#4B3019" stroke-width="2"/><ellipse cx="150" cy="40" rx="12" ry="7" fill="#2A160A"/>' + dents.join("") +
      '<path d="M110 106q-14 -8 -30 0M128 104q16 -10 34 -2" fill="none" stroke="#F2C887" stroke-width="2" opacity=".8"/>' +
      (s.e ? '<g class="p4"><path d="M126 66l4 -12 4 12z" fill="#2B2340"/><circle cx="130" cy="51" r="3.2" fill="#2B2340"/><path d="M130 56l10 -10M140 46v16" stroke="#2B2340" stroke-width="1.6"/><path d="M122 60q-10 -4 -18 4" fill="none" stroke="#C9773A" stroke-width="2"/><circle cx="128.6" cy="50.6" r=".7" fill="#4FA3FF"/><circle cx="131.4" cy="50.6" r=".7" fill="#4FA3FF"/></g>' : "") + '</g>';
    return '<svg class="mj-deco mj-d1' + (s.c ? " e1" : "") + (s.e ? " e2" : "") + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120">' +
      '<defs><linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6B76B"/><stop offset="1" stop-color="#F9DDA4"/></linearGradient>' +
      '<linearGradient id="' + u + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9A85A"/><stop offset="1" stop-color="#B86A2C"/></linearGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="url(#' + u + 'c)"/><circle cx="58" cy="34" r="16" fill="#FFF1C9" opacity=".9"/><circle cx="84" cy="24" r="7" fill="#FFF1C9" opacity=".6"/>' +
      '<path d="M0 74Q50 52 110 70T220 62T320 70V120H0Z" fill="#E2A15B"/>' + (s.d ? forme3 : "") +
      '<g class="p5"><path d="M0 92Q60 76 130 92T260 86T320 92V120H0Z" fill="url(#' + u + 's)"/>' + tas + "</g>" +
      '<path d="M206 100L214 56 238 44 262 52 272 100Z" fill="#8A5530" stroke="#5B3418" stroke-width="1.5"/><path d="M231 100V80Q239 71 247 80V100Z" fill="#2E1A0C"/><g class="p2">' + lum.join("") + "</g>" +
      (s.c ? '<g class="p6" fill="none" stroke="#7A4A1E" stroke-width="1.4" opacity=".6"><path d="M30 106q8 -4 16 0t16 0"/><path d="M150 112q8 -4 16 0t16 0"/><path d="M280 110q8 -4 16 0t16 0"/></g>' : "") + "</svg>";
  },
    djeddah(s, o, u) {
    const n = Math.min(6, s.a || 0), lettres = [];
    for (let i = 0; i < n; i++) lettres.push('<g transform="translate(' + (150 + i * 22) + " " + (30 + (i % 2) * 14) + ") rotate(" + (i % 2 ? 8 : -8) + ')"><rect width="16" height="11" rx="1.5" fill="#F7EFD8" stroke="#8A6A3A" stroke-width=".8"/><path d="M0 0L8 6 16 0" fill="none" stroke="#8A6A3A" stroke-width=".8"/></g>');
    const oiseau = (x, y, k) => '<g transform="translate(' + x + " " + y + ") scale(" + k + ')"><ellipse cx="0" cy="0" rx="7" ry="9" fill="#C9B79C" stroke="#5B4A33" stroke-width="1"/><circle cx="-2.6" cy="-3" r="2.4" fill="#FFF7DA"/><circle cx="2.6" cy="-3" r="2.4" fill="#FFF7DA"/><circle cx="-2.6" cy="-3" r="1" fill="#1A1208"/><circle cx="2.6" cy="-3" r="1" fill="#1A1208"/><path d="M-1 0L0 2 1 0Z" fill="#E8A23A"/><path d="M-7 -1Q-13 4 -9 9M7 -1Q13 4 9 9" fill="none" stroke="#5B4A33" stroke-width="1.2"/></g>';
    return '<svg class="mj-deco mj-d2' + (s.b ? " e1" : "") + '" viewBox="0 0 320 120"><defs><linearGradient id="' + u + 'n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2347"/><stop offset="1" stop-color="#3E3F73"/></linearGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="url(#' + u + 'n)"/>' + [[30, 20], [80, 12], [260, 18], [300, 40], [120, 30], [210, 10]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.2" fill="#FFF6D0"/>').join("") +
      '<circle cx="272" cy="28" r="11" fill="#F6EBC4"/><circle cx="277" cy="25" r="10" fill="url(#' + u + 'n)"/>' +
      '<path d="M0 120V96Q80 84 160 92T320 90V120Z" fill="#20283F"/>' +
      '<g fill="#2B2F4E" stroke="#151A33" stroke-width="1"><path d="M30 96V54H44V46H50V54H62V40L69 26 76 40V96Z"/><path d="M76 96V62H112V96Z"/><path d="M112 96V48L120 34 128 48V96Z"/></g>' +
      '<g fill="#FFD27A">' + [[38, 62], [52, 66], [66, 50], [88, 72], [100, 72], [117, 58]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="4" height="6" rx="1"/>').join("") + "</g>" +
      oiseau(132, 60, 1.1) + '<g class="p1">' + oiseau(214, 56, .8) + "</g>" + '<g class="p2">' + lettres.join("") + "</g>" +
      (s.b ? '<circle class="p3" cx="300" cy="96" r="9" fill="#E8B04A" stroke="#7A4A0C" stroke-width="1.5"/>' : "") + "</svg>";
  },
    melbourne(s, o, u) {
    const k = Math.min(10, s.a || 0), op = s.b ? 1 : 0.15 + k * 0.06;
    return '<svg class="mj-deco mj-d3' + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><defs><linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE6F5"/><stop offset="1" stop-color="#EAF7E8"/></linearGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="url(#' + u + 'c)"/><path d="M0 120V92Q100 82 200 90T320 88V120Z" fill="#8CCB6E"/>' +
      '<path d="M236 96V52" stroke="#7A5232" stroke-width="10" stroke-linecap="round"/><circle cx="236" cy="40" r="30" fill="#5FAE58"/><circle cx="214" cy="52" r="18" fill="#6DBB5E"/><circle cx="258" cy="50" r="18" fill="#6DBB5E"/>' +
      '<g class="p1" opacity="' + op.toFixed(2) + '"><path d="M218 40Q236 56 254 40Q236 48 218 40Z" fill="#F3E9FF" stroke="#7B3FB8" stroke-width="1.6"/><circle cx="226" cy="30" r="3" fill="#C9F24E"/><circle cx="246" cy="30" r="3" fill="#C9F24E"/>' +
      (s.b ? '<path d="M212 22L218 10 224 22M248 22L254 10 260 22" fill="#B58AD6" stroke="#7B3FB8" stroke-width="1"/>' : "") + "</g>" +
      '<rect x="30" y="80" width="130" height="8" rx="3" fill="#FFFFFF" stroke="#C9A2C9"/><path d="M40 88V100M150 88V100" stroke="#8A6A3A" stroke-width="3"/>' +
      '<g transform="translate(60 66)"><path d="M0 14H22L19 0H3Z" fill="#E86A92" stroke="#A33D63"/><path d="M22 4Q30 6 22 11" fill="none" stroke="#A33D63" stroke-width="2"/></g>' +
      '<g transform="translate(104 70)"><path d="M0 10H14L12 0H2Z" fill="#7FB7E8" stroke="#3D6E9B"/></g>' +
      '<g transform="translate(126 54)"><rect x="0" y="12" width="20" height="14" rx="2" fill="#3B2A4A"/><rect x="-4" y="24" width="28" height="3" rx="1.5" fill="#3B2A4A"/><rect x="0" y="16" width="20" height="3" fill="#E86A92"/></g>' + "</svg>";
  }
,
    suzuka(s, o, u) {
    const nuit = !!s.a;
    return '<svg class="mj-deco mj-d4' + (s.b ? " e1" : "") + '" viewBox="0 0 320 120"><defs><linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (nuit ? "#1A1220" : "#5B2A2A") + '"/><stop offset="1" stop-color="' + (nuit ? "#3A2230" : "#D9774A") + '"/></linearGradient>' +
      '<radialGradient id="' + u + 'a"><stop offset="0" stop-color="#FFE38A"/><stop offset=".6" stop-color="#F2A93B"/><stop offset="1" stop-color="#F2A93B" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="url(#' + u + 'c)"/><path d="M150 120L210 30 222 34 236 26 300 120Z" fill="#2B1A18"/><path d="M208 34Q222 18 238 28" fill="none" stroke="#FF6A2B" stroke-width="3" opacity=".8"/>' +
      '<path d="M0 120V96Q60 86 120 100T320 98V120Z" fill="#1E1412"/>' +
      '<g class="p1"><path d="M60 100V44L66 30 72 44V100Z" fill="#141010"/>' + (s.c || s.d >= 2 ? '<ellipse class="p2" cx="66" cy="24" rx="9" ry="4" fill="#FF5A1F"/><ellipse cx="66" cy="24" rx="1.6" ry="3.6" fill="#1A0A05"/>' : "") + "</g>" +
      (nuit ? [0, 1, 2].map(i => '<path class="p3" d="M' + (110 + i * 34) + " " + (30 + (i % 2) * 10) + 'l10 -6 10 6 -10 2z" fill="#0A0608"/>').join("") :
        '<g class="p4"><circle cx="128" cy="72" r="22" fill="url(#' + u + 'a)" opacity="' + (s.b ? 0.9 : 0.4) + '"/><ellipse cx="128" cy="72" rx="13" ry="10" fill="none" stroke="#F7CF55" stroke-width="4"/><ellipse cx="128" cy="72" rx="13" ry="10" fill="none" stroke="#FFF3B8" stroke-width="1" stroke-dasharray="2 3"/></g>') + "</svg>";
  },
    miami(s, o, u) {
    const br = s.a || [0, 0, 0], zones = [[160, 98, 34, 10], [160, 62, 14, 30], [160, 30, 52, 22]];
    return '<svg class="mj-deco mj-d5' + (s.b ? " e1" : "") + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><defs><radialGradient id="' + u + 'g"><stop offset="0" stop-color="#7CF7FF"/><stop offset="1" stop-color="#7CF7FF" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="#0B1630"/>' + [[30, 20], [70, 40], [260, 16], [290, 52], [230, 34]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.2" fill="#BFF6FF"/>').join("") +
      '<path d="M0 120V102Q80 92 160 100T320 100V120Z" fill="#12263F"/><path d="M152 110V40M168 110V40" stroke="#3A2A4A" stroke-width="10"/><path d="M160 46Q120 20 96 34M160 46Q200 20 224 34M160 60Q126 50 110 62M160 60Q194 50 210 62" fill="none" stroke="#3A2A4A" stroke-width="5"/>' +
      zones.map(([x, y, rx, ry], i) => '<ellipse class="p1' + (s.c === i ? " on" : "") + '" cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + u + 'g)" opacity="' + (0.15 + 0.85 * Math.max(0, Math.min(1, br[i] || 0))).toFixed(2) + '"/>').join("") +
      '<g fill="#B7FFF2">' + Array.from({ length: 14 }, (_, k) => '<path d="M' + (96 + (k * 37) % 128) + " " + (24 + (k * 23) % 60) + 'v6" stroke="#B7FFF2" stroke-width="1" opacity=".7"/>').join("") + "</g>" +
      (s.c >= 0 ? '<path class="p2" d="M' + [254, 182, 270][s.c] + " " + [104, 64, 34][s.c] + 'q-8 -10 0 -20q8 10 0 20z" fill="#FF7A2B"/>' : "") + "</svg>";
  },
    montreal(s, o, u) {
    const c = s.a === 2 ? "#FF3B3B" : s.a === 1 ? "#3BA8FF" : "#C9D2DE";
    return '<svg class="mj-deco mj-d6' + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#090C14"/>' +
      [[40, 30], [90, 14], [250, 22], [290, 60], [200, 12], [130, 40]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1" fill="#DDE6FF"/>').join("") +
      '<rect x="0" y="96" width="320" height="6" fill="#2A3040"/><g fill="#FF3B3B">' + [30, 90, 230, 290].map(x => '<circle cx="' + x + '" cy="99" r="1.6"/>').join("") + "</g>" +
      '<g class="p1"><path d="M100 96L196 22" stroke="' + c + '" stroke-width="5" stroke-linecap="round" filter="drop-shadow(0 0 4px ' + c + ')"/><path d="M100 96L196 22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><rect x="88" y="94" width="18" height="6" rx="2" fill="#9AA4B2" transform="rotate(-38 97 97)"/></g>' +
      '<g class="p2"><path d="M220 96L124 22" stroke="#FF3B3B" stroke-width="5" stroke-linecap="round" opacity=".85"/><path d="M220 96L124 22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><rect x="214" y="94" width="18" height="6" rx="2" fill="#5A6270" transform="rotate(38 223 97)"/></g>' +
      '<circle cx="160" cy="50" r="6" fill="#FFFFFF" opacity=".85"/></svg>';
  },
    bahrein(s, o, u) {
    return '<svg class="mj-deco mj-d7' + (s.a ? " e1" : "") + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#F6E9D2"/>' +
      '<path d="M0 0H320V18H0Z" fill="#2A5DB0"/><path d="M0 18H320" stroke="#fff" stroke-width="2" stroke-dasharray="10 10"/><rect x="0" y="86" width="320" height="34" fill="#8A5A2B"/>' +
      [70, 160, 250].map((x, i) => '<g class="p1' + (s.b === i ? " on" : "") + '"><ellipse cx="' + x + '" cy="80" rx="30" ry="8" fill="#FFFFFF" stroke="#BFA27A"/><path d="M' + (x - 18) + " 78Q" + x + " " + (52 - i * 4) + " " + (x + 18) + ' 78Z" fill="' + ["#D62839", "#F2B705", "#3F8F3A"][i] + '"/>' + (s.b === i ? '<path d="M' + (x - 6) + ' 40l6 -8 6 8z" fill="#2A5DB0"/>' : "") + "</g>").join("") +
      '<g class="p2"><path d="M290 60v-14q-8 -2 -6 -10 2 -8 10 -6 4 -8 12 -4 8 -2 8 8 6 4 0 12v14z" fill="#FFFFFF" stroke="#8A8A8A"/><ellipse cx="296" cy="66" rx="9" ry="7" fill="#9AA3AE"/></g>' +
      (s.a ? '<g class="p3"><rect x="16" y="34" width="22" height="46" rx="4" fill="#1A1A2A"/><circle cx="27" cy="28" r="8" fill="#E8D9C4"/><path d="M19 22h16" stroke="#1A1A2A" stroke-width="3"/></g>' : "") + "</svg>";
  },
    spa(s, o, u) {
    const c = ["#FF3B3B", "#3BD16F", "#3B8BFF"];
    return '<svg class="mj-deco mj-d8' + (s.a ? " e1" : "") + '" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#2A1E1A"/><rect x="0" y="0" width="320" height="60" fill="#4A3426"/>' +
      '<path d="M10 22Q160 46 310 22" fill="none" stroke="#1A1A1A" stroke-width="1.6"/>' + Array.from({ length: 12 }, (_, i) => { const x = 22 + i * 25, y = 22 + Math.sin((i + .5) / 12 * Math.PI) * 13;
        return '<circle class="p1' + (i % 3 === s.b ? " on" : "") + '" cx="' + x + '" cy="' + (y + 4) + '" r="4.5" fill="' + c[i % 3] + '" opacity="' + (i % 3 === s.b ? 1 : .35) + '"/>'; }).join("") +
      '<path d="M0 120V90Q80 80 160 92T320 88V120Z" fill="#170F14"/><path class="p2" d="M150 120Q160 98 156 86Q170 96 168 120Z" fill="#B8203A" opacity=".8"/>' +
      (s.a ? '<g class="p3" stroke="#4A6B3A" stroke-width="2" fill="none"><path d="M120 120q10 -20 30 -18"/><path d="M200 120q-12 -16 -36 -14"/></g>' : "") + "</svg>";
  },
    lasvegas(s, o, u) {
    const x = 30 + Math.min(1, (s.a || 0) / (s.b || 26)) * 236;
    return '<svg class="mj-deco mj-d9' + (s.c ? " e1" : "") + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><defs><linearGradient id="' + u + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FC8F0"/><stop offset=".55" stop-color="#2E7DB8"/><stop offset="1" stop-color="#14466E"/></linearGradient></defs>' +
      '<rect width="320" height="120" rx="12" fill="url(#' + u + 'm)"/><path d="M276 70Q290 44 314 52V120H276Z" fill="#C9A86A"/><path d="M286 58h8v-8h4v8h6" stroke="#F4EBD6" stroke-width="2" fill="none"/>' +
      '<path d="M10 80q10 -4 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="#BFE6F8" stroke-width="1.4" opacity=".7"/>' +
      '<path d="M20 86H266" stroke="#F4EBD6" stroke-width="1" stroke-dasharray="2 6" opacity=".7"/>' +
      '<g class="p1" transform="translate(' + x.toFixed(1) + ' 66)"><path d="M-14 12H14L9 20H-9Z" fill="#7A4A22"/><path d="M0 12V-12" stroke="#5A3A1A" stroke-width="2"/><path d="M1 -10Q14 -2 1 8Z" fill="#F4EBD6"/><path d="M-1 -8Q-10 -2 -1 6Z" fill="#E8DCC8"/></g>' +
      (s.c ? '<g fill="#F7CF55" opacity=".8">' + [100, 140, 180].map(x2 => '<path d="M' + x2 + ' 50q4 -8 8 0t8 0"/>').join("") + "</g>" : "") + "</svg>";
  },
    interlagos(s, o, u) {
    const f = Math.min(12, s.a || 0), fis = [];
    for (let i = 0; i < f; i++) fis.push('<path d="M' + (40 + (i * 53) % 240) + " " + (40 + (i * 17) % 30) + "l6 8 -4 6 7 10" + '" stroke="#2A1A14" stroke-width="1.6" fill="none"/>');
    return '<svg class="mj-deco mj-d11' + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#C9B8A2"/>' +
      '<rect x="10" y="30" width="300" height="80" fill="#9A8A74" stroke="#5A4A3A"/>' + Array.from({ length: 5 }, (_, r) => '<path d="M10 ' + (46 + r * 16) + 'H310" stroke="#7A6A54" stroke-width="1"/>').join("") +
      [70, 160, 250].map((x, i) => '<g><path d="M' + (x - 16) + " 110V78Q" + x + " 62 " + (x + 16) + ' 78V110Z" fill="#3A2E26"/><circle cx="' + x + '" cy="95" r="' + (2 + i) + '" fill="#E8DCC8"/></g>').join("") +
      fis.join("") + '<path class="p1" d="M290 30q-6 -24 6 -26q12 2 6 26z" fill="#C98A6A" opacity=".8"/><path d="M14 22l8 -10 8 10" stroke="#2A5A3A" stroke-width="3" fill="none"/></svg>';
  },
    monza(s, o, u) {
    const R = s.a || [], ico = ["🏜️", "🏰", "🎩", "💍", "🌿", "🌌", "🐀", "🔦", "🌊", "🍫", "🧱"];
    return '<svg class="mj-deco mj-d12' + (o.message && s.anim ? " a-" + esc(s.anim) : "") + '" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#120A24"/>' +
      ico.map((e, i) => { const a = i / 11 * Math.PI * 2 - Math.PI / 2, x = 160 + Math.cos(a) * 118, y = 60 + Math.sin(a) * 44, on = R.includes(i);
        return '<g class="p1' + (on ? " on" : "") + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11" fill="' + (on ? "#F7A83B" : "#2A1E4A") + '" stroke="#F7A83B" stroke-width="' + (on ? 2 : .8) + '" opacity="' + (on ? 1 : .6) + '"/><text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" style="font-size:10px" opacity="' + (on ? 1 : .45) + '">' + e + "</text></g>"; }).join("") +
      '<circle class="p2" cx="160" cy="60" r="22" fill="none" stroke="#F7A83B" stroke-width="3" stroke-dasharray="6 4"/><circle cx="160" cy="60" r="14" fill="#3A1E6A"/></svg>';
  }
};

/* ---------- révélation animée du 1er du mois (une fois), puis cérémonie de fin (une fois) ---------- */
let MJ_ATTENTE = 0;
function annoncesMJ() {
  if (!MJ) return;
  // une autre fenêtre est ouverte (révélation de la saison, règles, tuto…) : on attend qu'elle se ferme (au plus 10 min)
  if (document.querySelector(".revel, .regles, .tuto, .ba")) { if (++MJ_ATTENTE < 200) setTimeout(annoncesMJ, 3000); return; }
  MJ_ATTENTE = 0;
  const ecart = (a, b) => (Math.floor(a / 100) * 12 + a % 100) - (Math.floor(b / 100) * 12 + b % 100);   // en mois (décembre 2027 → janvier 2028 = 1)
  const r = (MJ.finis || []).slice().reverse().find(x => !stock.get("versus.mjFin." + x.mois) && ecart(mjMoisNum(), x.mois) <= 2);
  if (r) return ceremonieMJ(r, false, () => setTimeout(annoncesMJ, 400));
  const C = MJ.courant;
  if (C && !stock.get("versus.mjRev." + C.mois)) revelationMJ(C, false);
}
function revelationMJ(C, relire, exemple) {
  const K = C.contenu || {}, m = (typeof MOIS_L !== "undefined" ? MOIS_L : MJ_MOIS_NOMS)[C.mois % 100 - 1] || "";   // le mois en entier (« janvier »)
  const o = document.createElement("div"); o.className = "revel mj-rev" + (reduit ? " reduit" : "") + (relire ? " relire" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Le mini-jeu du mois");
  const R = C.recompense || {};
  o.innerHTML = '<div class="rv-c mj-rv-c"><span class="cbo-rayons" aria-hidden="true"></span><span class="tuto-k">🎲 Le mini-jeu de ' + esc(m) + (exemple ? " · aperçu" : "") + "</span>" +
    '<div class="mj-rv-ico" aria-hidden="true">' + esc(K.ico || "🎲") + "</div><h3>" + esc(K.titre || "") + '</h3><p class="cbo-grave">' + esc(K.accroche || "") + "</p>" +
    // en haut, les deux buts en une ligne chacun (relecture jeu-joueur, 25/11) : le sien (le meilleur du mois) et celui du groupe (l'objectif commun)
    (K.but || K.ensemble ? '<div class="mj-rv-buts">' + (K.but ? '<p><b>🎯 Ton but :</b> ' + esc(K.but.replace(/^Ton but : /, "")) + "</p>" : "") +
      (K.ensemble ? '<p><b>🤝 Ensemble :</b> ' + esc(K.ensemble.replace(/^Ensemble : /, "")) + "</p>" : "") + "</div>" : "") +
    '<ol class="mj-rv-regle">' + (K.regle || []).map(l => "<li>" + esc(l) + "</li>").join("") + "</ol>" +
    (K.recompense ? '<p class="mj-rv-gain">🏆 ' + esc(K.recompense) + "</p>" : "") +
    (R.objet && typeof vignetteItem === "function" && ITEMS[R.objet[0]] && ITEMS[R.objet[0]][R.objet[1]] ? '<div class="tk-obj"><span>À gagner</span>' + vignetteItem(R.objet[0], R.objet[1], moiVrai() || "", typeof equipDe === "function" && D && D.personnes.some(p => p.nom === moiVrai()) ? equipDe(moiVrai()) : {}) + "</div>" : "") +
    '<p class="cbo-flair">Un geste par jour, sur la page Course. Aucun point au championnat.</p>' +
    '<div class="btn-row">' + (relire || exemple ? "" : '<button class="btn acc" type="button" data-mj-go>C\'est parti !</button>') + '<button class="btn ghost" type="button" data-mj-ok>' + (relire || exemple ? "Fermer" : "Plus tard") + "</button></div></div>";
  document.body.appendChild(o);
  const vu = () => { if (!relire && !exemple) stock.set("versus.mjRev." + C.mois, "1"); }, fermer = () => { vu(); o.remove(); };
  o.querySelector("[data-mj-ok]").addEventListener("click", fermer);
  const go = o.querySelector("[data-mj-go]"); if (go) go.addEventListener("click", () => { fermer(); allerCarteMJ(); });
  if (!relire && window.SONS && SONS.jingle) setTimeout(() => { try { SONS.jingle("defaut", "accord"); } catch (e) { /* sans son */ } }, reduit ? 0 : 700);
}
/** la cérémonie de fin du mois : le décor du monde, les gagnants, le titre, l'objet ; aucun point */
function ceremonieMJ(r, exemple, apres) {
  const K = r.contenu || {}, R = r.recompense || {}, moi = exemple ? "Toi (aperçu)" : moiVrai(), d = MJ_DECORS[r.univers], g = r.gagnants || [];
  const o = document.createElement("div"); o.className = "revel mj-cer" + (reduit ? " reduit" : ""); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Fin du mini-jeu");
  const e = !exemple && typeof equipDe === "function" && g[0] && D.personnes.some(p => p.nom === g[0]) ? equipDe(g[0]) : {};
  o.innerHTML = '<div class="rv-c mj-cer-c"><span class="cbo-rayons" aria-hidden="true"></span><span class="tuto-k">🎲 Fin du mini-jeu · ' + esc((K.ico || "") + " " + (K.titre || "")) + (exemple ? " · exemple inventé" : "") + "</span>" +
    (d ? '<div class="mj-scene mj-cer-scene" aria-hidden="true">' + d(r.scene || {}, { fin: true }, "mjc" + (++MJ_N)) + "</div>" : "") +
    "<h3>" + (g.length ? "🥇 " + g.map(n => "<b>" + esc(n) + "</b>").join(" et ") : "Personne en tête cette fois") + "</h3>" +
    (R.titre && g.length ? '<p class="cbo-grave">Surnom du mois « ' + esc(R.titre) + " »" + (g.includes(moi) ? " : c'est toi !" : "") + "</p>" : "") +
    (r.commun ? '<p class="mj-cer-commun' + (r.commun.reussi ? " ok" : "") + '">' + (r.commun.reussi ? "🤝 " + esc(R.trophee ? R.trophee.ico + " Trophée « " + R.trophee.nom + " » pour tout le monde ! " : "") : "🤝 ") + esc(r.commun.texte || "") + "</p>" : "") +
    (r.texte ? "<p>" + esc(r.texte) + "</p>" : "") +
    (r.tableau && r.tableau.length ? '<ol class="mj-cer-tab">' + r.tableau.slice(0, 5).map(t => '<li class="' + (g.includes(t.nom) ? "or" : "") + '"><b>' + esc(t.nom) + "</b><small>" + esc(t.txt || String(t.val)) + "</small></li>").join("") + "</ol>" : "") +
    (R.objet && g.length && typeof vignetteItem === "function" && ITEMS[R.objet[0]] && ITEMS[R.objet[0]][R.objet[1]] ? '<div class="tk-obj"><span>Objet d\'écurie gagné</span>' + vignetteItem(R.objet[0], R.objet[1], exemple ? "" : g[0], e) + "</div>" : "") +
    '<p class="cbo-flair">Aucun point au championnat : seulement la gloire.</p>' +
    '<div class="btn-row">' + (exemple ? "" : '<button class="btn acc" type="button" data-mj-vit>Voir le trophée</button>') + '<button class="btn ghost" type="button" data-mj-ok>Génial !</button></div></div>';
  document.body.appendChild(o);
  const fermer = () => { if (!exemple) stock.set("versus.mjFin." + r.mois, "1"); o.remove(); if (apres) apres(); };
  o.querySelector("[data-mj-ok]").addEventListener("click", fermer);
  const v = o.querySelector("[data-mj-vit]"); if (v) v.addEventListener("click", () => { fermer(); ETAT.podium = "defis"; if (typeof VIT_ONGLET !== "undefined") VIT_ONGLET = "mondes"; garder(); if (vueActive() !== "trophees") allerA("trophees"); rendreTrophees(); setTimeout(() => { const s = document.querySelector('#vit-mondes [data-monde="m-' + r.univers + '"]') || document.querySelector("#vit-mondes"); if (s) s.scrollIntoView({ block: "center" }); }, 300); });
  if (g.includes(moi) || (r.commun && r.commun.reussi)) setTimeout(() => { try { confettis("confettis"); } catch (er) { /* sans fête */ } }, reduit ? 0 : 900);
}

/* ---------- les meilleurs du mois (titre + objet exclusif doré) ; la vitrine, c'est l'onglet Trophées › 🗺️ Mondes (js/3-podium.js) ---------- */
function gagnantsMJ(mois) {
  if (mois === 202710) return typeof gagnantsTicket === "function" ? gagnantsTicket().map(g => g.nom) : [];
  const r = MJ && (MJ.finis || []).find(x => x.mois === mois); return r ? r.gagnants || [] : [];
}
/* ---------- pour l'onglet Trophées (sous-onglet « Mondes » : etatMondeMiniJeu dans js/3-podium.js appelle celle-ci) ----------
   etatMiniJeu(univers, nom) → { gagne (le trophée du monde est à lui), pourTous: [noms des pilotes qui ont le trophée du monde],
   meilleur: { nom, txt } | null (le ou les meilleurs du mois et leur titre), progression: { p, c, txt } | null (l'objectif commun),
   etat: "a-venir" | "en-cours" | "fini", trophee { ico, nom }, titre, objet [emplacement, id] } ; null tant que rien n'est chargé.
   Le trophée du monde va à TOUS les pilotes quand l'objectif commun est réussi (le dispensé compris). Jamais un texte de règle avant le 1er.
   window.MINIJEUX_REV augmente à chaque changement d'état (chargement, geste) : l'onglet Trophées sait qu'il faut recalculer. */
window.MINIJEUX_REV = window.MINIJEUX_REV || 0;
function mjChange() { window.MINIJEUX_REV = (window.MINIJEUX_REV || 0) + 1; }
function etatMiniJeu(univers, nom) {
  nom = nom || (typeof moiVrai === "function" ? moiVrai() : "");
  const tous = typeof D !== "undefined" && D && D.personnes ? D.personnes.map(p => p.nom) : [];
  const forme = (etat, ok, g, titre, k, R) => { const pourTous = ok ? tous.slice() : [];
    return { etat, gagne: pourTous.includes(nom), pourTous, meilleur: g && g.length ? { nom: g.join(" et "), txt: titre || "" } : null, meilleurs: g && g.length ? g.slice() : [],
      progression: k && k.objectif ? { p: +k.val || 0, c: +k.objectif, txt: k.txt || (k.val + " / " + k.objectif) } : null, trophee: (R && R.trophee) || null, titre: titre || null, objet: (R && R.objet) || null }; };
  if (univers === "singapour") {   // octobre : le ticket d'or (TicketsOr.js) et ses carrés dorés
    const T = typeof TICKETS !== "undefined" ? TICKETS : null; if (!T) return null;
    const k = T.carres;
    return forme(T.fini ? "fini" : T.enCours ? "en-cours" : "a-venir", !!(k && k.reussi), (T.gagnants || []).map(x => x.nom), "Ticket d'or",
      k ? { val: k.total, objectif: k.objectif, txt: k.total + " / " + k.objectif + " carrés dorés" } : null, { trophee: { ico: "🍫", nom: "La Chocolaterie" }, objet: ["plaque", "ticketor"] });
  }
  if (!MJ) return null;
  const r = (MJ.finis || []).find(x => x.univers === univers);
  if (r) { const R = r.recompense || {}; return forme("fini", !!(r.commun && r.commun.reussi), r.gagnants || [], R.titre, r.commun, R); }
  const C = MJ.courant;
  if (C && C.univers === univers) { const R = C.recompense || {}, k = (C.etat || {}).commun || null; return forme("en-cours", !!(k && k.reussi), [], R.titre, k, R); }
  return forme("a-venir", false, [], null, null, null);
}
/* ---------- l'écurie : l'objet d'un mini-jeu n'est à personne avant la fin de son mois ---------- */
function mjOrigine(slot, id) { const m = MJ_OBJETS[slot + "." + id]; return m ? { mj: m } : null; }
function mjDebloques(nom) { return Object.keys(MJ_OBJETS).filter(k => gagnantsMJ(MJ_OBJETS[k]).includes(nom)); }
function mjObjetVisible(slot, id, nom) { const m = MJ_OBJETS[slot + "." + id]; return !m || mjMoisNum() >= m || mjDebloques(nom || "").includes(slot + "." + id); }

/* ---------- les règles : les 12 empreintes dès le 1/1/2027 (le tirage de chaque mois est vérifiable après coup) ---------- */
function regleMJ() {
  if (Date.now() < MJ_DEBUT.getTime()) return "";
  const C = MJ && MJ.courant;
  const emp = MJ && MJ.calendrier ? '<ol class="mj-emp">' + MJ.calendrier.filter(c => c.empreinte).map(c => { const r = (MJ.finis || []).find(x => x.mois === c.mois), dp = String(c.depuis || "");
    return "<li>" + MJ_MOIS_NOMS[c.mois % 100 - 1] + ' <code class="tk-emp">' + esc(c.empreinte) + "</code>" + (dp.length === 8 ? " (publiée le " + (+dp.slice(6)) + "/" + (+dp.slice(4, 6)) + "/" + dp.slice(0, 4) + ")" : "") + (r && r.revele && r.revele.graine ? ' · graine dévoilée <code class="tk-emp">' + esc(r.revele.graine) + "</code>" : "") + "</li>"; }).join("") + "</ol>" : '<span class="tk-emp attente">(empreintes en chargement…)</span>';
  return '<li id="rg-mj"><b>🎲 Mini-jeux du mois</b> : chaque univers a sa surprise, dévoilée le 1<sup>er</sup> du mois sur la page Course. Un geste par jour au plus, aucun point au championnat : des trophées, des surnoms du mois et des objets d\'écurie. Les tirages sont faits à l\'avance par le serveur. Chaque mois a son <b>empreinte</b> (ci-dessous) : un code qui prouve que le tirage était fait d\'avance, donc que personne n\'y touche en cours de route. La « graine » du tirage est dévoilée à la fin du mois : on peut alors vérifier qu\'elle donne bien la même empreinte.' +
    (C && C.contenu ? '<div class="mj-rg-c"><b>' + esc(C.contenu.ico + " Ce mois-ci : " + C.contenu.titre) + "</b><ul>" + (C.contenu.regle || []).map(l => "<li>" + esc(l) + "</li>").join("") + "</ul></div>" : "") + emp + "</li>";
}

/* ---------- 🎲 aperçu admin (double sécurité apercuAutorise) : le mini-jeu joué sur des données INVENTÉES par le serveur ----------
   Le serveur rejoue la vraie logique avec une graine d'aperçu (jamais la vraie) et des pilotes inventés ; rien n'est écrit.
   Vitesse (26/11) : une même demande (mois, jour, faux tirage, mes gestes) donne toujours la même réponse : elle est gardée pendant la visite,
   et la suite probable (jour suivant, les autres mois) est demandée d'avance, deux à la fois au plus. */
const MJ_AP = { sel: Math.floor(Math.random() * 1e9), memo: new Map(), file: [], actif: 0 };
function demanderApercuMJ(q) {
  const corps = { action: "mj", op: "apercu", mois: q.mois, jour: q.jour, sel: MJ_AP.sel, gestes: (q.gestes || []).slice() }, k = JSON.stringify(corps);
  if (!MJ_AP.memo.has(k)) MJ_AP.memo.set(k, posterAdmin(corps).then(r => { if (!r || !r.ok) MJ_AP.memo.delete(k); return r; }));
  return MJ_AP.memo.get(k);
}
/** demandes d'avance, deux au plus en même temps ; les plus urgentes passent devant */
function prechargerApercuMJ(liste, devant) {
  if (!apercuAutorise()) return;
  const cles = liste.map(q => JSON.stringify(q)), reste = MJ_AP.file.filter(x => !cles.includes(JSON.stringify(x)));
  MJ_AP.file = devant ? liste.concat(reste) : reste.concat(liste);
  const suivant = () => { const q = MJ_AP.file.shift(); if (!q) { MJ_AP.actif--; return; } demanderApercuMJ(q).then(suivant, suivant); };
  while (MJ_AP.actif < 2 && MJ_AP.file.length) { MJ_AP.actif++; suivant(); }   // deux demandes d'avance au plus en même temps
}
/** appelée quand la barre admin s'affiche : l'aperçu de janvier est prêt avant même d'être ouvert */
function prechargerApercuMJAdmin() { if (MJ_AP.pre || !apercuAutorise()) return; MJ_AP.pre = 1; setTimeout(() => prechargerApercuMJ([{ mois: 202701, jour: 1 }]), 2500); }
async function apercuMJ(mois) {
  if (!apercuAutorise()) return;
  mois = mois || 202701;
  const A = { mois, jour: 1, gestes: [] };
  let tour = 0;
  const o = document.createElement("div"); o.className = "regles mj-apercu"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Aperçu des mini-jeux");
  document.body.appendChild(o);
  const demander = extra => extra ? posterAdmin(Object.assign({ action: "mj", op: "apercu", mois: A.mois, jour: A.jour, sel: MJ_AP.sel, gestes: A.gestes }, extra)) : demanderApercuMJ(A);
  const tete = attente => '<div class="rg-h"><b>🎲 Aperçu · mini-jeux' + (attente ? ' <small class="mj-ap-attente" aria-live="polite">⏳ chargement…</small>' : "") + '</b><button class="icon-btn rg-x" type="button" aria-label="Fermer">✕</button></div>';
  const rendre = async () => {
    const t = ++tour, deja = o.querySelector(".mj-ap-carte");
    // le contenu déjà là reste affiché pendant le chargement (seul un petit « chargement… » s'ajoute) : plus d'écran vide à chaque jour
    if (deja) { const h = o.querySelector(".rg-h"); if (h && !h.querySelector(".mj-ap-attente")) h.querySelector("b").insertAdjacentHTML("beforeend", ' <small class="mj-ap-attente" aria-live="polite">⏳ chargement…</small>');
      o.querySelectorAll(".mj-ap-carte button, .mj-ap-b button").forEach(b => { b.disabled = true; }); }   // l'ancienne carte ne se joue plus pendant ce temps
    else { o.innerHTML = '<div class="rg-c">' + tete(true) + '<p class="info">Chargement…</p></div>'; o.querySelector(".rg-x").addEventListener("click", () => o.remove()); }
    const rep = await demander();
    if (t !== tour || !o.isConnected) return;   // un autre jour ou un autre mois a été demandé entre-temps
    const mois12 = '<div class="mj-ap-m">' + MJ_MOIS_NOMS.map((n, i) => '<button type="button" data-mj-m="' + (202701 + i) + '" aria-pressed="' + (A.mois === 202701 + i) + '">' + n + "</button>").join("") + "</div>";
    const corps = !rep || !rep.ok ? '<p class="info">' + esc(rep && rep.message ? rep.message : "Le serveur ne répond pas.") + "</p>"
      : '<p class="info">Exemple inventé : le serveur rejoue la vraie règle avec un faux tirage et 3 pilotes inventés. Rien n\'est enregistré, le vrai tirage reste secret, même pour toi.</p>' +
        '<div class="mj-ap-carte"></div><div class="btn-row mj-ap-b"><button class="btn ghost" type="button" data-mj-rev>✨ La révélation</button>' + (A.jour < rep.fin ? '<button class="btn ghost" type="button" data-mj-j>☀️ Jour suivant (' + (A.jour + 1) + ")</button>" : "") + '<button class="btn ghost" type="button" data-mj-fin>🏁 La cérémonie de fin</button></div>';
    o.innerHTML = '<div class="rg-c">' + tete(false) + mois12 + corps + "</div>";
    o.querySelector(".rg-x").addEventListener("click", () => o.remove());
    o.querySelectorAll("[data-mj-m]").forEach(b => b.addEventListener("click", () => { A.mois = +b.dataset.mjM; A.jour = 1; A.gestes = []; rendre(); }));
    if (!rep || !rep.ok) return;
    const C = { mois: rep.mois, univers: rep.univers, type: rep.type, contenu: rep.contenu, recompense: rep.recompense, etat: rep.etat };
    const P = MJ_PEINTRES[C.type], zone = o.querySelector(".mj-ap-carte");
    if (P) { zone.innerHTML = P.carte(C, C.etat, { ap: true }); }
    const lendemain = () => A.jour < rep.fin ? [{ mois: A.mois, jour: A.jour + 1, gestes: A.gestes.slice() }] : [];
    const ap = { geste: async g => { const r = await demander({ geste: g }); if (r && r.ok) { A.gestes.push({ jour: A.jour, g: r.g || g }); prechargerApercuMJ(lendemain(), true); } return r; } };
    brancherCarteMJ(zone.firstElementChild, C, ap);
    o.querySelector("[data-mj-rev]").addEventListener("click", () => revelationMJ(C, false, true));
    const j = o.querySelector("[data-mj-j]"); if (j) j.addEventListener("click", () => { A.jour++; rendre(); });
    o.querySelector("[data-mj-fin]").addEventListener("click", async () => { const r = await demanderApercuMJ({ mois: A.mois, jour: 99, gestes: A.gestes.slice() });
      if (r && r.ok && r.resultat) ceremonieMJ(Object.assign({ mois: r.mois, univers: r.univers, contenu: r.contenu, recompense: r.recompense }, r.resultat), true); else toast(r && r.message ? r.message : "Le serveur ne répond pas."); });
    // d'avance : le jour suivant d'abord, puis le 1er jour des autres mois construits (une demande à la fois)
    prechargerApercuMJ(lendemain(), true);
    prechargerApercuMJ(MJ_MOIS_NOMS.map((n, i) => 202701 + i).filter(m => m !== 202710 && m !== A.mois).map(m => ({ mois: m, jour: 1, gestes: [] })), false);
  };
  rendre();
}

/* au démarrage (en fin de fichier : les peintres et les décors doivent déjà exister) : tout de suite si une copie du classement est là, sinon dès que le classement arrive ; et au retour dans l'appli (un autre jour, peut-être) */
(function demarrerMJ() {
  const go = () => { if (typeof D !== "undefined" && D && D.personnes && mjOuvert()) { chargerMJ(); return true; } return false; };
  if (!go()) { let n = 0; const t = setInterval(() => { if (go() || ++n > 400) clearInterval(t); }, 300); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && MJ && Date.now() - MJ_T > 10 * 60000) chargerMJ(true); });
})();
