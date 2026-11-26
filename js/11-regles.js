/* Versus · 📖 Règles en tuiles et « ? » d'aide (validé par Théo le 26/11/2026)
   Pourquoi : les règles étaient une longue liste ; Théo aime le détail, les autres veulent du « clé en main ».
   - 📖 Règles s'ouvre sur un SOMMAIRE de grosses tuiles (seulement ce qui est visible à la date), 🗓️ « Ce mois-ci » en premier ;
   - une tuile ouvre une FICHE COURTE (quelques lignes + le schéma existant) ; « Tout le détail ▾ » déplie le texte complet ;
   - bouton retour du téléphone : fiche → sommaire → fermé (fermerFenetreOuverte touche le premier « .rg-x » : en fiche, c'est « ‹ ») ;
   - petits « ? » ronds à côté des endroits où une règle compte : ils ouvrent directement la bonne fiche (Réglages › Affichage pour les masquer).
   LE CONTENU NE CHANGE PAS : tout le texte vient de htmlRegles() (js/5-plateau.js), découpé ici par sections (#rg-…) ;
   les fiches courtes reprennent les mêmes règles en moins de mots, et seulement si la section existe (donc visible à la date :
   regleVisible, saisonJouee, rien de 2027 avant l'heure). Le trésor : la règle de regleTresor() / htmlRegleTresor() (js/4-grandprix.js).
   Aucun secret (énigmes, mini-jeux : rien n'est dévoilé ici), aucun montant. */
"use strict";

/* ---------- les tuiles : ordre du sommaire ; « court » = la fiche courte, construite à partir de la section détaillée ---------- */
const RG_TUILES = [
  { id: "essentiel", ico: "⚡", t: "L'essentiel", sous: "le jeu en 30 secondes" },
  { id: "champ", ico: "🏁", t: "Les points", sous: "ta place du mois" },
  { id: "cartes", ico: "🃏", t: "Les cartes", sous: "une par mois" },
  { id: "bonus", ico: "✨", t: "Les bonus", sous: "des points en plus" },
  { id: "speciaux", ico: "📅", t: "Les mois spéciaux", sous: "une règle à part" },
  { id: "pieges", ico: "🪤", t: "Les pièges", sous: "une règle par circuit" },
  { id: "pioche", ico: "🎴", t: "Le rattrapage", sous: "si tu finis dernier" },
  { id: "niveaux", ico: "🔧", t: "Les niveaux", sous: "ton écurie progresse" },
  { id: "gp", ico: "🏎️", t: "La course", sous: "une manche par mois" },
  { id: "tresor", ico: "🗝️", t: "Le trésor", sous: "une chasse par mois" },
  { id: "mj", ico: "🎲", t: "Le mini-jeu", sous: "la surprise du mois" },
  { id: "trophees", ico: "🏆", t: "Trophées et titres", sous: "pour toujours" },
  { id: "bientot", ico: "🎁", t: "Bientôt", sous: "ce qui arrive" }
];
/* les anciens noms de sections (liens « Règles » de l'appli, étapes du calendrier) → la tuile qui les contient */
const RG_ALIAS = { championnat: "bonus", circuits: "pieges", duels: "bonus", ecurie: "gp", defis: "trophees", ticket: "trophees", titres: "trophees", actuel: "mois" };
/* « voir aussi » en bas d'une fiche (seulement si la tuile existe à la date) */
const RG_VOIR = { essentiel: ["champ", "mois"], champ: ["bonus", "cartes"], cartes: ["pioche", "bonus"], bonus: ["champ", "mois"], speciaux: ["pieges", "mois"], pieges: ["speciaux", "mois"],
  pioche: ["cartes", "niveaux"], niveaux: ["pioche"], gp: ["tresor", "mj"], tresor: ["mois", "gp"], mj: ["trophees", "gp"], trophees: ["mj", "tresor"], mois: [], bientot: [] };

const rgEl = h => { const d = document.createElement("div"); d.innerHTML = h; return d; };
/** déplace (ou copie) un morceau de la section détaillée vers la fiche courte ; "" s'il n'existe pas */
function rgPrendre(sec, sel, copie) { const e = sec && sec.querySelector(sel); if (!e) return ""; const h = e.outerHTML; if (!copie) e.remove(); return h; }
/** une ligne d'une liste courte : icône + texte */
const rgL = (ico, h, qa, ancre) => '<li' + (qa ? ' data-qa="' + qa + '"' : "") + (ancre ? ' data-ancre="' + ancre + '"' : "") + '><i aria-hidden="true">' + ico + "</i><span>" + h + "</span></li>";
/** les lignes du tableau (bonus, mois spéciaux) en pastilles : nom + points, et l'explication en petit dessous */
const RG_QA = { "🏁": "defi", "🔮": "prono", "🅿️": "pole", "🤝": "equipe", "🔥": "serie", "😈": "rival", "🛡️": "regularite", "🗳️": "vote" };
function rgPastilles(sec) {
  const l = sec ? [...sec.querySelectorAll(".rg-tab > div")] : [];
  l.forEach(d => { const b = d.querySelector("b"), k = b && Object.keys(RG_QA).find(e => b.textContent.trim().startsWith(e)); if (k) d.dataset.qa = RG_QA[k]; });
  return l.length ? '<ul class="rgt-pas expl">' + l.map(d => { const b = d.querySelector("b"), em = d.querySelector("em"), sp = d.querySelector("span");
    return "<li" + (d.dataset.qa ? ' data-qa="' + d.dataset.qa + '"' : "") + "><b>" + (b ? b.innerHTML : "") + "</b>" + (em ? "<em>" + em.innerHTML + "</em>" : "") + (sp ? "<small>" + sp.innerHTML + "</small>" : "") + "</li>"; }).join("") + "</ul>" : "";
}

/* ---------- 🗓️ Ce mois-ci : seulement ce qui compte ce mois-là, calculé à la date (et seulement ce qui est déjà visible) ---------- */
function rgBonusEnMain(y) {
  try {
    const qui = moiPilote(); if (!qui || !regleVisible("pioche") || basesSeules()) return 0;
    const j = jeuDe(qui, y), src = Object.assign({}, (((D.cartes || {})[y] || {})[qui]) || {}, (mesCartes()[y] || {}));
    const joues = new Set(); Object.values(src).forEach(c => { if (c && c.c) joues.add(c.c); if (c && c.b) joues.add(c.b); });   // v20.90 : la carte bonus (b) se joue en plus de la carte du mois (c)
    return (j.pioche || []).filter(z => !joues.has(z.c)).length;
  } catch (e) { return 0; }
}
function rgLignesMois(dispo) {
  const d = new Date(), j = d.getDate(), k = d.getFullYear() * 100 + d.getMonth() + 1, kN = cleMoins(k, -1), y = Math.floor(k / 100);
  const mN = esc(moisLong(kN).replace(/ \d{4}$/, "")), mC = esc(moisLong(k).replace(/ \d{4}$/, "")), a = id => dispo.includes(id) ? id : "";
  const L = [], rv = kk => { const n = jourLimite(kk); return n === 1 ? "1<sup>er</sup>" : String(n); };   // jour de la révélation : celui du jeu (jourLimite), jamais recopié
  if (k < SAISON.premiere * 100 + 1) {   // décembre 2026 : le tour de chauffe (rien de 2027)
    L.push(rgL("🔥", "<b>Tour de chauffe</b> : tout marche, rien ne compte. Le championnat démarre le 1<sup>er</sup> janvier.", a("essentiel")));
    if (typeof aventPeriode === "function" && aventPeriode() && j <= AVENT.derniere) L.push(rgL("🎄", "<b>Calendrier de l'Avent</b> : une case par jour jusqu'au 24, à ouvrir le jour même (en haut du Classement). Aucun point.", ""));
    if (dispo.includes("tresor")) L.push(rgL("🗝️", "<b>Trésor d'entraînement</b> : une énigme et un objet caché dans la Visite 3D. Le 1<sup>er</sup> du classement gagne la plaque dorée Chercheur de Noël (résultat au plus tard le 31 décembre à minuit).", "tresor"));
    if (typeof ecurieOuverte === "function" && ecurieOuverte()) L.push(rgL("🏎️", "<b>Écurie ouverte</b> depuis le 1<sup>er</sup> décembre : casque, livrée, numéro… purement cosmétique.", a("gp")));
    L.push(rgL("🃏", j < 20 ? "Les cartes de janvier se poseront à partir du <b>20 décembre</b> (Stand, onglet Saison 1)." : "<b>Fenêtre ouverte</b> : pose ta carte de janvier (Stand, onglet Saison 1) ; révélation le " + rv(kN) + " janvier.", a("cartes")));
    if (janvierAnnonce()) L.push(rgL("📣", "<b>Janvier est annoncé</b> : ses règles sont dans ce sommaire.", ""));
    L.push(rgL("📅", "<b>Fin du mois</b> : ton relevé de décembre, puis le résultat du tour de chauffe.", ""));
    return L;
  }
  const r = reglesDuMois(y, k), g = GPS[circuitDe(k)];
  if (g) L.push(rgL(g.drap, "<b>" + esc(g.gp) + "</b>" + (g.gp.includes(g.ville) ? "" : " · " + esc(g.ville)), a("gp")));
  if (r && r.spe) L.push(rgL(r.spe.ico, "<b>Mois spécial · " + esc(r.spe.nom) + "</b> : " + esc(r.spe.txt), a("speciaux")));
  if (r && r.pg) L.push(rgL(r.pg.ico, "<b>Piège · " + esc(r.pg.nom) + "</b> : " + esc(r.pg.txt), a("pieges")));
  if (r && r.df) L.push(rgL(r.df.ico, "<b>Défi du mois</b> : " + esc(r.df.txt) + " → +1.", dispo.includes("bonus") ? "bonus#defi" : ""));
  const avecProno = regleVisible("prono") && regleActive("prono", kN), avecPole = avecProno && regleVisible("pole") && regleActive("pole", kN);
  const kO = moisCarteOuvert();
  L.push(rgL("🃏", kO === k ? "<b>Fenêtre ouverte</b> : ta carte de " + mC + " se pose encore (Stand) ; révélation le " + rv(k) + "."
    : kO === kN ? "<b>Fenêtre ouverte</b> : pose ta carte de " + mN + (avecProno ? (avecPole ? ", ton pronostic et ta pole" : " et ton pronostic") : "") + " (Stand) ; révélation le " + rv(kN) + " " + mN + "."
    : "Cartes révélées le " + rv(k) + ". Prochaine fenêtre le <b>20 " + mC + "</b>, pour " + mN + ".", a("cartes")));
  const nb = rgBonusEnMain(y);
  if (nb) L.push(rgL("🎴", "Tu as <b>" + nb + " carte" + (nb > 1 ? "s" : "") + " bonus</b> en main : une par mois au plus, à jouer <b>en plus</b> de ta carte du mois (Stand).", a("pioche")));
  if (dispo.includes("tresor")) L.push(rgL("🗝️", "<b>Trésor</b> : " + (j < 11 ? "la chasse du mois est sur la page Course. 2<sup>e</sup> indice le 11, jauge chaud-froid le 21."
    : j < 21 ? "2<sup>e</sup> indice depuis le 11 ; jauge chaud-froid le 21 (si personne n'a trouvé)." : "jauge chaud-froid depuis le 21 (si personne n'a trouvé). Résultat au plus tard le dernier soir du mois, à minuit."), "tresor"));
  if (dispo.includes("mj")) L.push(rgL("🎲", "<b>Mini-jeu du mois</b> : il t'attend sur la page Course (un geste par jour au plus).", "mj"));
  if (j >= 20) { const yN = Math.floor(kN / 100), rN = reglesDuMois(yN, kN), gN = GPS[circuitDe(kN)];
    if (gN && (yN > y || rN)) L.push(rgL("🔭", "<b>Le mois prochain</b> : " + gN.drap + " " + esc(gN.ville) + (rN && (rN.spe || rN.pg) ? " · " + (rN.spe ? "mois spécial" : "piège") + " : " + esc((rN.spe || rN.pg).nom) : "") + (rN && rN.df ? " · défi : " + esc(rN.df.txt) : "") + ".", rN && rN.spe ? a("speciaux") : rN && rN.pg ? a("pieges") : "", "prochain")); }
  L.push(rgL("📅", (j < 20 ? "<b>Le 20</b> : fenêtre des cartes de " + mN + (regleVisible("defi") ? " et son défi" : "") + ". " : "") + "<b>Fin du mois</b> : ton relevé, puis le résultat du mois.", ""));
  return L;
}

/* ---------- découpe de htmlRegles() en fiches ---------- */
function rgFiches(tout) {
  const src = rgEl(htmlRegles(tout)), F = {};
  const actuel = src.querySelector(".rg-actuel"); if (actuel) actuel.remove();
  src.querySelectorAll(".rg-sommaire").forEach(e => e.remove());
  const sec = id => src.querySelector("#rg-" + id);
  // la section Course contient aussi le trésor, le mini-jeu, les trophées et le ticket d'or : chacun dans sa tuile
  const gp = sec("gp"), li = id => { const e = gp && gp.querySelector("#rg-" + id); if (e) e.remove(); return e; };
  const tresor = li("tresor"), mj = li("mj"), defis = li("defis"), ticket = li("ticket");
  const enSection = (id, ico, t, l) => l.filter(Boolean).length ? rgEl('<section class="rg-s" id="rg-' + id + '"><h4>' + ico + " " + t + "</h4><ul>" + l.filter(Boolean).map(e => e.outerHTML).join("") + "</ul></section>").firstChild : null;
  const S = { essentiel: sec("essentiel"), champ: sec("champ"), cartes: sec("cartes"), bonus: sec("bonus"), speciaux: sec("speciaux"), pieges: sec("pieges"), pioche: sec("pioche"), niveaux: sec("niveaux"), gp,
    tresor: enSection("t-tresor", "🗝️", "Chasse au trésor", [tresor]), mj: enSection("t-mj", "🎲", "Mini-jeux du mois", [mj]), trophees: enSection("t-trophees", "🏆", "Trophées et titres", [defis, ticket]), bientot: sec("bientot") };
  const idx = esc(D.marche.indices[iRef()]), saison = saisonJouee(), chauffe = new Date().getFullYear() * 100 + new Date().getMonth() + 1 < SAISON.premiere * 100 + 1 && !saison;
  const court = {
    essentiel: s => "<p>Chaque mois, les pilotes sont classés sur la <b>performance en %</b> de leur PEA et de leur assurance-vie (versements neutralisés).</p>" + rgPrendre(s, ".rg-flux") +
      "<p>Saison de janvier à décembre : <b>le plus de points gagne</b>.</p>" + (chauffe ? '<p class="rg-note">🔥 Décembre 2026 = tour de chauffe : tout marche, rien ne compte.</p>' : ""),
    champ: s => rgPrendre(s, ".rg-bar") + "<p>Ta <b>place du mois</b> donne tes points, <b>+1 🎯</b> si tu bats le " + idx + ". Ta carte et les bonus s'ajoutent.</p>" + rgPrendre(s, ".rg-calc") + "<p>Un mois ne descend jamais sous 0.</p>",
    cartes: s => rgPrendre(s, ".rg-cartes") + rgPrendre(s, ":scope > ul"),   // les règles de htmlRegles telles quelles (dates, carte bonus en plus)
    bonus: s => "<p>Des points en plus de ta place :</p>" + rgPastilles(s),
    speciaux: s => "<p>Certains mois, un <b>mois spécial</b> remplace le piège :</p>" + rgPastilles(s),
    pieges: s => rgPrendre(s, ":scope > p") + rgPrendre(s, ".rg-tab > div.actuel", true).replace(/^<div/, '<div class="rgt-actu"><div').replace(/<\/div>$/, "</div></div>"),
    pioche: s => rgPrendre(s, ":scope > p") + '<ul class="rgt-pas">' + [...s.querySelectorAll("li")].map(l => { const b = l.querySelector("b"); return "<li><b>" + (l.firstChild && l.firstChild.nodeType === 3 ? esc(l.firstChild.textContent.trim()) + " " : "") + (b ? b.innerHTML : "") + "</b></li>"; }).join("") + "</ul>",
    niveaux: s => rgPrendre(s, ":scope > ul"),
    gp: s => { const c = gp && gp.querySelector("ul > li"); const p = c && !c.id && !c.classList.contains("rg-schema") ? "<p>" + c.innerHTML + "</p>" : ""; if (p) c.remove();
      const ec = s.querySelector("#rg-ecurie"), pe = ec ? "<p>" + ec.innerHTML + "</p>" : ""; if (ec) ec.remove();
      return p + rgPrendre(s, ".rg-schema").replace(/^<li/, "<div").replace(/<\/li>$/, "</div>") + pe; },
    tresor: s => { const sch = rgPrendre(s, ".tr-etapes", true);   // la règle en images (htmlRegleTresor, js/4-grandprix.js) : ses étapes font la fiche courte, sans rien réécrire
      if (sch) return sch + '<p class="rg-note">Ce que tu gagnes, le classement et les indices : dans le détail ci-dessous.</p>';
      return "<p>Chaque mois, une <b>énigme</b> (dès le 1<sup>er</sup>) et un <b>objet caché</b> dans le décor de la Visite 3D. Touche <b>🔍 Je lance ma recherche</b> quand tu es prêt : le chrono part.</p>" + sch +
        "<p>" + (saison ? "<b>Le plus rapide gagne.</b>" : "En décembre, c'est l'<b>entraînement</b> : le plus rapide gagne la plaque dorée Chercheur de Noël.") + " 💡 2<sup>e</sup> indice le 11 · 🌡️ jauge chaud-froid le 21.</p>"; },
    mj: () => "<p>Chaque univers a sa <b>surprise</b>, dévoilée le 1<sup>er</sup> du mois sur la page Course.</p><p>Un geste par jour au plus, <b>aucun point</b> : des trophées, des surnoms du mois et des objets d'écurie.</p><p>Les tirages sont faits d'avance (chaque mois a son empreinte, dans le détail).</p>",
    trophees: s => '<ul class="rgt-l">' + rgL("🗺️", "<b>Mondes</b>, 🏅 <b>Succès</b>, 🧤 <b>Gant de l'infini</b>, 💎 <b>Légendes</b> : des trophées et des objets d'écurie, acquis pour toujours.") +
      rgL("⚔️", "<b>Titres</b> : on se les vole chaque mois (aucun point).", "titres") + (s.querySelector("#rg-ticket") ? rgL("🎫", "<b>Ticket d'or</b> : en octobre 2027, à la Chocolaterie.") : "") + "</ul>",
    bientot: s => rgPrendre(s, ":scope > ul")
  };
  RG_TUILES.forEach(T => {
    const s = S[T.id]; if (!s) return;
    let titre = T.t, sous = T.sous;
    if (T.id === "gp") { const h = s.querySelector("h4"); if (h && /écurie/i.test(h.textContent)) sous = "et l'écurie"; }
    const c = court[T.id](s);
    s.querySelectorAll(":scope > ul").forEach(u => { if (!u.children.length) u.remove(); });
    const reste = [...s.children].some(e => e.tagName !== "H4");
    F[T.id] = { ico: T.ico, t: titre, sous, court: c, detail: reste ? s.outerHTML : "" };
  });
  return { F, actuel: actuel ? actuel.outerHTML : "" };
}

/* ---------- la fenêtre ---------- */
function ouvrirRegles(section, tout, ancre) {
  document.querySelectorAll(".regles").forEach(x => x.remove());   // une fenêtre à la fois
  let id = section ? String(section) : "";
  if (id.includes("#")) { ancre = id.split("#")[1]; id = id.split("#")[0]; }
  id = RG_ALIAS[id] || id; if (section === "titres") ancre = ancre || "titres";
  const R = rgFiches(tout), F = R.F, dispo = Object.keys(F).concat(["mois"]), L = rgLignesMois(dispo);
  const ordre = ["mois"].concat(RG_TUILES.map(t => t.id).filter(t => F[t]));
  F.mois = { ico: "🗓️", t: "Ce mois-ci", sous: esc(moisLong(new Date().getFullYear() * 100 + new Date().getMonth() + 1)), court: '<ul class="rgt-l rgt-mois">' + L.join("") + "</ul>", detail: "" };
  const o = document.createElement("div"); o.className = "regles rgt"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Règles du Versus");
  const tuile = t => { const f = F[t]; return '<button type="button" class="rgt-t" data-rgt="' + t + '"><i aria-hidden="true">' + f.ico + "</i><b>" + f.t + "</b><small>" + f.sous + "</small></button>"; };
  // la tuile « Ce mois-ci » : en grand, avec le piège ou la règle du mois (le bloc d'origine), sinon les 3 premières lignes
  const hero = '<button type="button" class="rgt-t rgt-hero" data-rgt="mois"><span class="rgt-hh"><i aria-hidden="true">🗓️</i><b>Ce mois-ci</b><small>' + F.mois.sous + "</small></span>" +
    (R.actuel ? R.actuel.replace(/<small>[\s\S]*?<\/small>/, "").replace(/^<div/, "<span").replace(/<\/div>$/, "</span>") : '<ul class="rgt-l">' + L.slice(0, 3).join("").replace(/ data-qa="[^"]*"/g, "") + "</ul>") + '<span class="rgt-go">Tout ce qui compte ce mois-ci ›</span></button>';
  const fiche = t => { const f = F[t], i = ordre.indexOf(t), sv = ordre[i + 1], voir = (RG_VOIR[t] || []).filter(v => F[v] && v !== sv);
    return '<article class="rgt-f" data-fiche="' + t + '" id="rgt-' + t + '" hidden><h3><i aria-hidden="true">' + f.ico + "</i>" + f.t + "</h3>" + '<div class="rgt-court">' + f.court + "</div>" +
      (f.detail ? '<details class="rgt-det"><summary>Tout le détail <span aria-hidden="true">▾</span></summary>' + f.detail + "</details>" : "") +
      (voir.length ? '<p class="rgt-voir">Voir aussi : ' + voir.map(v => '<button type="button" class="lien" data-rgt="' + v + '">' + F[v].ico + " " + F[v].t + "</button>").join(" · ") + "</p>" : "") +
      '<div class="rgt-nav"><button type="button" class="btn ghost" data-rgt="">‹ Sommaire</button>' + (sv ? '<button type="button" class="btn ghost" data-rgt="' + sv + '">' + F[sv].ico + " " + F[sv].t + " ›</button>" : "") + "</div></article>"; };
  o.innerHTML = '<div class="rg-c"><div class="rg-h"><button class="icon-btn rg-x rg-retour" type="button" aria-label="Retour au sommaire" hidden>‹</button><b>📖 Les règles</b><button class="icon-btn rg-x" type="button" id="rg-x" aria-label="Fermer">✕</button></div><div class="rg-corps">' +
    (tout ? '<p class="rg-admin">👀 Vue admin : toutes les règles, y compris celles que les autres ne voient pas encore.</p>' : "") +
    '<div class="rgt-som"><p class="rgt-k">Touche une tuile : l\'essentiel en quelques lignes, et tout le détail si tu veux.</p><div class="rgt-g">' + hero + ordre.slice(1).map(tuile).join("") + "</div></div>" +
    ordre.map(fiche).join("") + "</div></div>";
  document.body.appendChild(o); document.documentElement.classList.add("fige");
  const corps = o.querySelector(".rg-corps"), som = o.querySelector(".rgt-som"), retour = o.querySelector(".rg-retour");
  let courant = "", ySom = 0, direct = !!(id && F[id]);   // ouverte directement sur une fiche (un « ? », un lien) : le retour du téléphone ferme tout de suite
  const majRetour = () => retour.classList.toggle("rg-x", !direct);   // fermerFenetreOuverte touche le premier « .rg-x » : « ‹ » en navigation, « ✕ » en accès direct
  const fermer = () => { o.remove(); document.documentElement.classList.remove("fige"); };
  const montrer = (t, a) => {
    if (!t || !F[t]) { courant = ""; direct = false; majRetour(); o.querySelectorAll(".rgt-f").forEach(f => { f.hidden = true; }); som.hidden = false; retour.hidden = true; corps.scrollTop = ySom; return; }
    if (!courant) ySom = corps.scrollTop;
    courant = t; som.hidden = true; retour.hidden = false;
    o.querySelectorAll(".rgt-f").forEach(f => { f.hidden = f.dataset.fiche !== t; });
    corps.scrollTop = 0;
    o.querySelectorAll(".rgt-vise").forEach(e => e.classList.remove("rgt-vise"));
    if (a) { const fi = o.querySelector("#rgt-" + t), cible = fi && (fi.querySelector('.rgt-court [data-qa="' + a + '"]') || fi.querySelector('[data-qa="' + a + '"]') || fi.querySelector('[data-ancre="' + a + '"]'));
      if (cible) { const det = cible.closest("details"); if (det) det.open = true; cible.classList.add("rgt-vise"); setTimeout(() => { corps.scrollTop += cible.getBoundingClientRect().top - corps.getBoundingClientRect().top - 60; }, 0); } }
  };
  o.addEventListener("click", e => { if (e.target === o) { fermer(); return; }
    const b = e.target.closest("[data-rgt]"); if (b && o.contains(b)) { e.preventDefault(); direct = false; majRetour(); montrer(b.dataset.rgt); return; }
    const q = e.target.closest(".rgt-mois li[data-qa]"); if (q) { direct = false; majRetour(); const [t, a] = q.dataset.qa.split("#"); montrer(t, a); } });   // « Ce mois-ci » : chaque ligne ouvre sa fiche
  o.querySelector("#rg-x").addEventListener("click", fermer);
  retour.addEventListener("click", () => { if (courant) montrer(""); else fermer(); });   // bouton retour du téléphone : fiche → sommaire → fermé
  majRetour(); if (id && F[id]) montrer(id, ancre);
  // v20.47 · 🎫 l'empreinte du tirage du ticket d'or et 🎲 celles des mini-jeux (dès le 1/1/2027) : chargées à l'ouverture si besoin
  if (o.querySelector("#rg-mj .attente") && typeof chargerMJ === "function") chargerMJ(true).then(() => { const l = o.querySelector("#rg-mj"); if (l && MJ) l.outerHTML = regleMJ(); }).catch(() => {});
  if (o.querySelector("#rg-ticket .attente") && typeof chargerTickets === "function") chargerTickets(true).then(() => { const l = o.querySelector("#rg-ticket"); if (l && TICKETS && TICKETS.empreinte) l.outerHTML = regleTicket(); }).catch(() => {});
}

/* ---------- « ? » contextuels : posés à côté des endroits où une règle compte (sans toucher au code de ces écrans) ---------- */
/* [sélecteur, fiche(#ancre), où poser le « ? » (beforeend / afterend / beforebegin), filtre sur le texte] */
const RG_AIDES = [
  ['#v-trophees h3.s-h3', "cartes", "beforeend", /^Mes cartes/],
  ['#v-trophees h3.s-h3', "bonus#prono", "beforeend", /Pronostic/],
  ['#v-trophees h3.s-h3', "bonus#defi", "beforeend", /Défi du mois/],
  ['#v-trophees h3.s-h3', "bonus#rival", "beforeend", /Rival/],
  ['#v-trophees h3.s-h3', "speciaux#vote", "beforeend", /coup de la saison/],
  ['#v-trophees h3.s-h3', "niveaux", "beforeend", /^(Atelier|Niveau d)/],
  ['#v-trophees .ligne-champ > #prono-pole', "bonus#pole", "parent"],
  ['#v-trophees .st-etat .st-h > b', "mois", "titre"],
  ['.regles-mois .rm-h > div > b', () => moisCarteOuvert() === cleMoins(new Date().getFullYear() * 100 + new Date().getMonth() + 1, -1) ? "mois#prochain" : "mois", "titre"],   // à partir du 20, la carte montre le mois suivant
  ['.regles-mois li.rm-pg > span > b', "pieges", "beforeend"],
  ['.regles-mois li.rm-spe > span > b', "speciaux", "beforeend"],
  ['.regles-mois li > span > b', "bonus#defi", "beforeend", /^Défi du mois/],
  ['#pts-det > summary', "champ", "beforeend"],
  ['#v-trophees .gp-h h3.gp-titre', "gp", "beforeend"],
  ['#v-trophees .gp-met .gp-tresors', "tresor", "afterend"],
  ['#vit-titres > h3.vit-h', "trophees#titres", "titre"],
  ['#vit-mondes > h3.vit-h, #vit-succes > h3.vit-h, #vit-gant > h3.vit-h, #vit-legendes > h3.vit-h', "trophees", "titre"],
  ['#v-classement h2.sec > .h-boutons', "essentiel", "beforebegin"],
  ['#v-classement .verdict .v-h > span', "champ", "beforeend"]
];
const RG_DISPO = { cle: "", l: [] };
/** les fiches qui existent aujourd'hui (pour ne jamais poser un « ? » vers une règle pas encore visible) */
function rgDispo() {
  const cle = aujNum() + "|" + saisonJouee() + "|" + estAdmin() + "|" + (typeof apercuSaison === "function" && apercuSaison());
  if (RG_DISPO.cle !== cle) { try { RG_DISPO.l = Object.keys(rgFiches(false).F).concat(["mois"]); RG_DISPO.cle = cle; } catch (e) { return []; } }
  return RG_DISPO.l;
}
/** « ? » d'un titre : avant le petit sous-titre s'il y en a un, collé au dernier mot (jamais seul sur sa ligne) */
function rgPoserTitre(el, b) {
  const ref = el.querySelector(":scope > small"), avant = ref ? ref.previousSibling : el.lastChild, sp = document.createElement("span"); sp.className = "qr-nw";
  if (avant && avant.nodeType === 3) { const m = avant.data.match(/(\S+)(\s*)$/); if (m) { avant.data = avant.data.slice(0, m.index); sp.textContent = m[1]; } }
  sp.insertAdjacentHTML("beforeend", b); el.insertBefore(sp, ref);
}
function poserAides() {
  if (typeof D === "undefined" || !D || !D.marche) return;
  const dispo = rgDispo(); if (!dispo.length) return;
  RG_AIDES.forEach(([sel, c0, ou, filtre]) => {
    const cible = typeof c0 === "function" ? c0() : c0;
    if (!dispo.includes(cible.split("#")[0])) return;
    document.querySelectorAll(sel).forEach(el => {
      if (el.closest(".regles")) return;
      if (filtre && !filtre.test(el.textContent.trim())) return;
      const nom = (RG_TUILES.find(t => t.id === cible.split("#")[0]) || { t: "Ce mois-ci" }).t;
      const b = '<button type="button" class="qr" data-qr="' + cible + '" aria-label="Aide : ' + esc(nom) + '">?</button>';
      if (ou === "afterend") { if (!(el.nextElementSibling && el.nextElementSibling.classList.contains("qr"))) el.insertAdjacentHTML("afterend", b); }
      else if (ou === "beforebegin") { if (!(el.previousElementSibling && el.previousElementSibling.classList.contains("qr"))) el.insertAdjacentHTML("beforebegin", b); }
      else if (ou === "parent") { const p = el.parentElement; if (!p.querySelector(":scope > .qr")) p.insertAdjacentHTML("beforeend", b); }
      else if (ou === "titre") { if (!el.querySelector(".qr")) rgPoserTitre(el, b); }
      else if (!el.querySelector(":scope > .qr")) el.insertAdjacentHTML("beforeend", b);
    });
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-qr]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();   // le « ? » posé dans un résumé repliable, une carte cliquable… n'ouvre que l'aide
  ouvrirRegles(b.dataset.qr);
}, true);
(() => {   // posés après chaque dessin d'écran (au plus 4 fois par seconde, pour rester fluide)
  let attente = 0;
  const passe = () => { attente = 0; try { poserAides(); } catch (e) { /* une aide en moins, jamais une erreur */ } };
  const obs = new MutationObserver(() => { if (!attente) attente = requestAnimationFrame(passe); });   // avant l'affichage de l'image : le « ? » apparaît avec l'écran, sans clignoter
  const go = () => { const m = document.querySelector("main") || document.body; obs.observe(m, { childList: true, subtree: true }); passe(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();

/* ---------- Réglages › Affichage : « Afficher les ? d'aide » (oui par défaut, gardé sur l'appareil) ---------- */
(function () {
  const lire = () => { try { return localStorage.getItem("versus.aidesJeu") !== "0"; } catch (e) { return true; } };
  const maj = () => { const on = lire(); document.documentElement.classList.toggle("sans-qr", !on);
    document.querySelectorAll("[data-qr-choix]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.qrChoix === "1") === on))); };
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-qr-choix]"); if (!b) return;
    try { localStorage.setItem("versus.aidesJeu", b.dataset.qrChoix === "1" ? "1" : "0"); } catch (er) { /* rien */ }
    maj();
  });
  maj();
})();

/* ---------- styles (ici plutôt que dans css/versus.css : tout le chantier des règles au même endroit) ---------- */
(function () {
  const s = document.createElement("style"); s.id = "css-regles-tuiles";
  s.textContent = `
.rgt .rg-h .rg-retour { font-size: 22px; line-height: 1; }
.rgt .rg-h b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rgt-som { padding: 10px 0 4px; }
.rgt-k { margin: 2px 0 10px; font-size: 13px; color: var(--ink-2); }
.rgt-g { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.rgt-t { all: unset; box-sizing: border-box; cursor: pointer; -webkit-tap-highlight-color: transparent; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 9px; align-items: center;
  min-height: 68px; padding: 10px 11px; border-radius: 14px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); }
.rgt-t:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rgt-t:active { transform: scale(.98); }
.rgt-t > i { grid-row: 1 / 3; font-style: normal; font-size: 26px; line-height: 1; }
.rgt-t > b { font: 700 14px/1.2 var(--f-text); }
.rgt-t > small { font-size: 11.5px; line-height: 1.25; color: var(--ink-2); }
.rgt-hero { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 13px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, var(--panel)), var(--panel) 75%); border-color: color-mix(in srgb, var(--accent) 45%, var(--rule)); }
.rgt-hh { display: flex; align-items: baseline; gap: 8px; }
.rgt-hh i { font-style: normal; font-size: 24px; align-self: center; }
.rgt-hh b { font: italic 800 18px/1.1 var(--f-display); letter-spacing: .04em; text-transform: uppercase; }
.rgt-hh small { margin-left: auto; font-size: 12px; color: var(--ink-2); white-space: nowrap; }
.rgt-hero .rg-actuel { margin: 0; }
.rgt-go { font: 700 12.5px/1.2 var(--f-text); color: var(--accent-ink, var(--accent)); }
.rgt-f { padding: 12px 0 8px; }
.rgt-f > h3 { display: flex; align-items: center; gap: 10px; margin: 2px 0 10px; font: italic 800 20px/1.15 var(--f-display); letter-spacing: .04em; text-transform: uppercase; }
.rgt-f > h3 i { font-style: normal; font-size: 30px; }
.rgt-court p { margin: 0 0 8px; font-size: 14.5px; line-height: 1.5; color: var(--ink-2); }
.rgt-court b { color: var(--ink); }
.rgt-l { list-style: none; margin: 4px 0 10px; padding: 0; display: grid; gap: 7px; }
.rgt-l li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: start; font-size: 14px; line-height: 1.42; color: var(--ink-2); }
.rgt-l li > i { font-style: normal; font-size: 18px; line-height: 1.2; text-align: center; }
.rgt-l li b { color: var(--ink); }
.rgt-mois li { padding: 8px 10px; border-radius: 12px; background: var(--panel); border: 1px solid var(--rule-2); }
.rgt-mois li[data-qa] { cursor: pointer; grid-template-columns: 24px minmax(0, 1fr) auto; }
.rgt-mois li[data-qa]::after { content: "›"; align-self: center; font-weight: 800; color: var(--ink-3); }
.rgt-hero .rgt-l { margin: 0; gap: 5px; text-align: left; }
.rgt-hero .rgt-l li { font-size: 13px; }
.rgt-pas { list-style: none; margin: 6px 0 10px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.rgt-pas li { display: inline-flex; align-items: baseline; gap: 6px; padding: 7px 11px; border-radius: 999px; border: 1px solid var(--rule); background: var(--panel); font-size: 13px; }
.rgt-pas.expl li { flex: 1 1 100%; flex-wrap: wrap; border-radius: 12px; }
.rgt-pas li small { flex-basis: 100%; font-size: 12.5px; line-height: 1.35; color: var(--ink-2); }
.qr-nw { white-space: nowrap; }
.aides-l { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 4px 0; }
.aides-l > span { font-size: 14px; } .aides-l small { color: var(--ink-3); font-size: 12px; }
.rgt-pas em { font-style: normal; font-weight: 800; color: var(--accent-ink, var(--accent)); white-space: nowrap; }
.rgt-actu .rg-tab, .rgt-actu > div { margin: 6px 0 10px; }
.rgt-actu > div { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: baseline; padding: 7px 9px; border-radius: 10px; background: var(--panel); border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--rule)); font-size: 13px; }
.rgt-actu span { color: var(--ink-2); }
.rgt-vise { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 10px; animation: rgt-vise 1.2s ease 2; }
@keyframes rgt-vise { 50% { outline-color: transparent; } }
@media (prefers-reduced-motion: reduce) { .rgt-vise { animation: none; } }
.rgt-det { margin: 12px 0 4px; border: 1px solid var(--rule); border-radius: 12px; background: var(--bg); }
.rgt-det > summary { list-style: none; cursor: pointer; padding: 11px 13px; font: 700 13.5px/1.2 var(--f-text); color: var(--accent-ink, var(--accent)); }
.rgt-det > summary::-webkit-details-marker { display: none; }
.rgt-det[open] > summary span { display: inline-block; transform: rotate(180deg); }
.rgt-det > .rg-s { border-top: 1px solid var(--rule-2); margin: 0 12px; padding-top: 8px; }
.rgt-det > .rg-s > h4 { display: none; }
.rgt-voir { margin: 12px 0 0; font-size: 13px; color: var(--ink-2); }
.rgt-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.rgt-nav .btn { padding: 9px 12px; font-size: 13px; }
.rgt-nav .btn:only-child { margin-right: auto; }
.qr { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 18px; height: 18px; margin: 0 0 0 6px; border-radius: 50%; border: 1px solid var(--rule);
  font: 700 11px/1 var(--f-num, var(--f-text)); color: var(--ink-3); background: var(--panel); vertical-align: 2px; letter-spacing: 0; text-transform: none; font-style: normal; flex: none; position: relative; }
.qr::after { content: ""; position: absolute; inset: -11px; }
.qr:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.qr:active { background: var(--accent); color: #fff; border-color: var(--accent); }
html.sans-qr .qr { display: none !important; }
h2.sec > .qr { margin-right: auto; margin-left: -4px; align-self: center; }
.verdict .v-h > span > .qr { margin-left: 0; }
`;
  document.head.appendChild(s);
})();
