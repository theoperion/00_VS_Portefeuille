/* Versus · socle : configuration, stockage, chargement, classement, mois, fiches (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* Version de l'appli : elle se change dans version.js, nulle part ailleurs */
const APP_VERSION = (self.VERSUS_VERSION || {}).app || "?", APP_DATE = (self.VERSUS_VERSION || {}).date || "";
/* Admin : « voir l'appli à une autre date » (Réglages › Voir comme un joueur). L'horloge de l'appli est décalée ; rien n'est envoyé. */
(function () {
  /* Le mode admin ne dure que jusqu'à la fermeture de l'appli (sessionStorage) : à l'ouverture suivante, plus d'admin ni de simulation */
  try { if (sessionStorage.getItem("versus.adminOn") !== "1") ["versus.adminOn", "versus.vueJoueur", "versus.dateSim", "versus.apercuSaison"].forEach(k => localStorage.removeItem(k)); } catch (e) { /* stockage indisponible */ }
  let s = null; try { s = localStorage.getItem("versus.dateSim"); } catch (e) { return; }
  const cible = s ? new Date(s + "T10:00:00").getTime() : NaN; if (!cible) return;
  const D0 = Date, decal = cible - D0.now();
  function DateSim(...a) { return a.length ? new D0(...a) : new D0(D0.now() + decal); }
  DateSim.prototype = D0.prototype; DateSim.now = () => D0.now() + decal; DateSim.UTC = D0.UTC; DateSim.parse = D0.parse;
  window.Date = DateSim; window.DATE_SIM = s;
})();
/* ============================================================
   CONFIGURATION : colle ici l'adresse de la web app (se termine par /exec),
   ou saisis-la dans Réglages. Vide = chiffres de démonstration.
   ============================================================ */
const API_URL = "https://script.google.com/macros/s/AKfycbxVNsHSYTTqolDYjZX18ECAFcNhSJH5Wv4pxZweTpTHbVsm538hE9UI5QSI8ZlofUTf/exec";

const CLES = { api: "versus.api", cle: "versus.cle", theme: "versus.theme", cache: "versus.cache", vue: "versus.vue", etat: "versus.etat" };
/* En simulation (date simulée ou vue joueur de l'admin), ce qui est « vu » (révélation, annonces, paliers, clôture…), l'état des onglets
   et les choix privés de Moi vivent dans une mémoire de session : le vrai stockage reste intact, et on retrouve tout en revenant à l'admin. */
const SIMULATION = (() => { try { return !!window.DATE_SIM || !!localStorage.getItem("versus.vueJoueur"); } catch (e) { return !!window.DATE_SIM; } })();
const CLES_SIM = /^versus\.(etat|tuto1|revele|nouveaute\.|gpVu\.|chauffe1|saison1|recapVu|rappelMasque|mesCartes|mesDuels|moi\.(paliers|secrets|objets|jours|nuit|cloture|pref|afficheurs|lignesEnvoyees|million|partage))/;
const MEM_SIM = {};
const stock = {
  get(k) { if (SIMULATION && k in MEM_SIM) return MEM_SIM[k]; try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { if (SIMULATION && CLES_SIM.test(k)) { MEM_SIM[k] = String(v); return; } try { localStorage.setItem(k, v); } catch (e) { /* indisponible */ } },
  del(k) { if (SIMULATION && CLES_SIM.test(k)) { MEM_SIM[k] = null; return; } try { localStorage.removeItem(k); } catch (e) { /* indisponible */ } }
};
const $ = s => document.querySelector(s);
const reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
let D = null, SOURCE = "demo";
const ETAT = Object.assign({ env: 0, per: "ytd", i1: 0, i2: 1, moi: "Théo", fiche: null, bandeau: "fige", discret: "non", ouverture: "dernier" }, (() => { try { return JSON.parse(stock.get(CLES.etat) || "{}"); } catch (e) { return {}; } })());
function garder() { stock.set(CLES.etat, JSON.stringify(ETAT)); }

/* ---------- Format ---------- */
const MOINS = "−", NB = " ";
const nf = (a, b) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: a, maximumFractionDigits: b });
const F0 = nf(0, 0), F1 = nf(1, 1), F2 = nf(2, 2);
const ok = v => v !== null && v !== undefined && isFinite(v);
function sg(v) { return v > 0 ? "+" : v < 0 ? MOINS : ""; }
function eur(v, dec = 0, signe = false) {
  if (!ok(v)) return "—";
  if (ETAT.discret === "oui") return (signe ? sg(v) : "") + "•••" + NB + "€";
  const r = Math.round(v * 10 ** dec);
  return (signe ? sg(r) : (r < 0 ? MOINS : "")) + nf(dec, dec).format(Math.abs(v)) + NB + "€";
}
function pct(v, dec = 1, signe = true) {
  if (!ok(v)) return "—";
  const r = Math.round(v * 100 * 10 ** dec);
  return (signe ? sg(r) : (r < 0 ? MOINS : "")) + nf(dec, dec).format(Math.abs(v * 100)) + NB + "%";
}
const RECUL = 6;
function volTxt(s) { return s.n < RECUL ? "peu de recul" : pct(s.vol, 1, false); }
function sharpeTxt(s) { return s.n < RECUL || !ok(s.sharpe) ? "—" : F2.format(s.sharpe); }
function pts(v) { if (!ok(v)) return "—"; const r = Math.round(v * 1000); return sg(r) + F1.format(Math.abs(v * 100)) + NB + "pt" + (Math.abs(v * 100) >= 2 ? "s" : ""); }
function sens(v) { return !ok(v) || Math.abs(v) < 1e-9 ? "flat" : v > 0 ? "up" : "down"; }
function esc(t) { return String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function moisCourt(k) { return MOIS[k % 100 - 1] + " " + String(Math.floor(k / 100)).slice(2); }
function moisLong(k) { return MOIS_L[k % 100 - 1] + " " + Math.floor(k / 100); }
function jourReleve(y, m) { const d = new Date(y, m, 0, 12); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d; }
function finMois(k) {
  const r = D && D.personnes && D.personnes[0] && D.personnes[0].rows.find(x => x[0] === k);
  const d = r && r[1] ? new Date(r[1] + "T12:00:00") : jourReleve(Math.floor(k / 100), k % 100); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); }
function isoFr(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }
function isoMois(iso) { return iso ? MOIS[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4) : "—"; }

/* ---------- Couleurs des personnes ---------- */
function couleur(nom) { const i = D.personnes.findIndex(p => p.nom === nom); return "var(--p" + (i < 0 ? 0 : i % 4) + ")"; }
function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function couleurReelle(c) { const m = /var\((--[\w-]+)\)/.exec(c); return m ? css(m[1]) : c; }

const PERIODES = [["mois", "Mois en cours (dernier relevé)"], ["3m", "3 derniers mois"], ["6m", "6 derniers mois"], ["ytd", "Année en cours"], ["12m", "12 derniers mois"], ["comp", "Depuis la date de comparaison"], ["tout", "Depuis le début"]];

function axeEur(t) { return ETAT.discret === "oui" ? "" : Math.abs(t) >= 1000 ? (t < 0 ? "−" : "") + F0.format(Math.abs(t) / 1000) + "k" : F0.format(t); }

/* ---------- Thème ---------- */
function appliquerTheme(c) {
  if (c === "light" || c === "dark") document.documentElement.setAttribute("data-theme", c); else document.documentElement.removeAttribute("data-theme");
  document.querySelectorAll("[data-theme-choix]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeChoix === (c || "auto"))));
  if (D) rendreVue(vueActive());
}

/** Couleur d'accent : violet par défaut, ou une autre teinte, ou la couleur de son écurie */
function appliquerAccent(a) {
  const r = document.documentElement;
  if (!a || a === "violet") r.removeAttribute("data-accent"); else r.setAttribute("data-accent", a);
  if (a === "ecurie") r.style.setProperty("--accent-perso", D && D.personnes ? couleur(ETAT.moi) : "var(--p0)"); else r.style.removeProperty("--accent-perso");
  document.querySelectorAll("[data-accent-choix]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.accentChoix === (a || "violet"))));
}

/* ---------- Données ---------- */
/** Envoi (POST) avec un délai maximal : plus jamais d'« Enregistrement… » sans fin */
async function envoyerApi(url, corps, ms) {
  const ab = window.AbortController ? new AbortController() : null, minu = ab ? setTimeout(() => ab.abort(), ms || 30000) : null;
  try { return await (await fetch(url, { method: "POST", body: JSON.stringify(corps), signal: ab ? ab.signal : undefined })).json(); }
  catch (e) { throw new Error(e && e.name === "AbortError" ? "Le fichier met trop de temps à répondre : réessaie dans un instant." : "Impossible de joindre le fichier : vérifie la connexion puis réessaie."); }
  finally { clearTimeout(minu); }
}
/** Lecture d'une API Apps Script sans mettre la clé dans l'adresse (POST).
    Repli en GET pour un ancien script qui ne connaît pas encore la lecture en POST (fichiers Moi pas encore mis à jour). */
async function lireApi(url, cle, action, extra, signal) {
  const corps = Object.assign({ cle: cle, action: action }, extra || {});
  const j = await (await fetch(url, { method: "POST", body: JSON.stringify(corps), signal: signal })).json();
  if (j && !j.ok && (j.erreur === "format" || /inconnu/i.test(j.message || ""))) {
    const q = Object.keys(corps).filter(k => corps[k] !== undefined && corps[k] !== null && corps[k] !== "" && corps[k] !== false)
      .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(corps[k] === true ? "1" : corps[k])).join("&");
    return (await fetch(url + (url.includes("?") ? "&" : "?") + q, { cache: "no-store", signal: signal })).json();
  }
  return j;
}
function apiUrl() { return (stock.get(CLES.api) || API_URL || "").trim(); }
async function charger(frais) {
  const url = apiUrl();
  if (!url) { if (!window.DEMO_DATA) { toast("Ajoute l'adresse de l'API dans Réglages."); return; } D = window.DEMO_DATA; SOURCE = "demo"; afficherTout(); return; }
  const cle = stock.get(CLES.cle);
  if (!cle) { await verifierConfiguration(url); return; }
  const btn = $("#btn-maj"); btn.classList.add("spin"); EN_CHARGEMENT = true;
  try {
    if (navigator.onLine === false && !DEMARRAGE) throw new Error("Hors connexion");   // au démarrage, l'iPhone dit parfois « hors ligne » une fraction de seconde : on essaie quand même
    const ab = window.AbortController ? new AbortController() : null, minu = ab ? setTimeout(() => ab.abort(), 20000) : null;
    const json = await lireApi(url, cle, "data", { frais: !!frais, moi: moiVrai() || undefined }, ab ? ab.signal : undefined);
    clearTimeout(minu);
    if (!json.ok) {
      if (json.erreur === "cle" || json.erreur === "bloque") { stock.del(CLES.cle); ouvrirCle(json.message); return; }
      if (json.erreur === "config") { stock.del(CLES.cle); ouvrirCle("", true); return; }
      const er = new Error(json.message || "Réponse inattendue du fichier"); er.serveur = true; throw er;
    }
    ERREUR_SERVEUR = ""; DEMARRAGE = false; D = json; SOURCE = "api"; EN_CHARGEMENT = false; stock.set(CLES.cache, JSON.stringify(json)); afficherTout();
    setTimeout(() => { try { annoncerExclusifs(); } catch (e) { /* rien */ } }, 1200);
    setTimeout(() => revendiquerExclusifs().then(() => { if (vueActive() === "trophees" || vueActive() === "classement") rendreVue(vueActive()); }).catch(() => {}), 0);
  } catch (e) {
    if (DEMARRAGE && !(e && e.serveur)) { DEMARRAGE = false; setTimeout(() => charger(frais), 1500); return; }   // un seul nouvel essai avant d'afficher « Hors connexion »
    EN_CHARGEMENT = false;
    ERREUR_SERVEUR = e && e.serveur ? String(e.message || e) : "";   // le fichier a répondu, mais avec une erreur : on la montre
    const c = stock.get(CLES.cache);
    if (c) { try { D = JSON.parse(c); SOURCE = "cache"; afficherTout(); return; } catch (er) { /* cache illisible */ } }
    $("#v-classement").innerHTML = '<div class="vide">Impossible de joindre le fichier.<br><small>' + esc(e.message || e) + '</small><br><br><button class="btn" type="button" id="reessayer">Réessayer</button></div>';
    $("#reessayer").addEventListener("click", () => charger(true));
  } finally { btn.classList.remove("spin"); EN_CHARGEMENT = false; }
}
let EN_CHARGEMENT = false;
let ERREUR_SERVEUR = "";
let DEMARRAGE = true;   // premier chargement de l'appli
let CREATION = false;
async function verifierConfiguration(url) {
  try {
    const j = await (await fetch(url + (url.includes("?") ? "&" : "?") + "action=etat", { cache: "no-store" })).json();
    ouvrirCle("", j.ok && !j.configure);
  } catch (e) { ouvrirCle("Impossible de joindre l'API : vérifie l'adresse dans Réglages et que le déploiement est en accès « Tout le monde »."); }
}
function ouvrirCle(msg, creation) {
  CREATION = !!creation;
  $("#ecran-cle").hidden = false;
  $("#texte-cle").textContent = CREATION ? "Première ouverture : choisis la clé d'accès de l'application (6 caractères minimum). Elle sera demandée sur chaque nouvel appareil et reste enregistrée sur celui-ci."
    : "Entre la clé d'accès pour ouvrir le classement. Elle reste enregistrée sur cet appareil.";
  $("#champ-cle2").hidden = !CREATION;
  $("#valider-cle").textContent = CREATION ? "Créer la clé" : "Ouvrir";
  $("#champ-cle").setAttribute("autocomplete", CREATION ? "new-password" : "current-password");
  $("#err-cle").textContent = msg || "";
  setTimeout(() => $("#champ-cle").focus(), 50);
}
$("#form-cle").addEventListener("submit", async e => {
  e.preventDefault();
  const v = $("#champ-cle").value.trim();
  if (!v) { $("#err-cle").textContent = "Saisis la clé d'accès."; return; }
  if (CREATION) {
    if (v.length < 12) { $("#err-cle").textContent = "La clé doit faire au moins 12 caractères."; return; }
    if (v !== $("#champ-cle2").value.trim()) { $("#err-cle").textContent = "Les deux saisies ne correspondent pas."; return; }
    $("#valider-cle").disabled = true;
    let rep;
    try { rep = await envoyerApi(apiUrl(), { action: "initialiser", nouvelleCle: v }); }
    catch (er) { rep = { ok: false, message: "Impossible de joindre l'API : vérifie ta connexion." }; }
    $("#valider-cle").disabled = false;
    if (!rep.ok && rep.erreur === "deja") { ouvrirCle(rep.message, false); return; }
    if (!rep.ok) { $("#err-cle").textContent = rep.message || "Création impossible."; return; }
  }
  stock.set(CLES.cle, v); $("#champ-cle").value = ""; $("#champ-cle2").value = ""; $("#ecran-cle").hidden = true; charger(true);
});

let SESSION = { role: "admin" };
function estAdmin() { return SESSION.role === "admin"; }
/** Gestion (codes des joueurs, clé admin, relevés automatiques, réglages communs) : toujours accessible avec la clé admin,
    même mode admin désactivé — le mode admin ne sert qu'aux aperçus des nouveautés (et à la saisie de secours) */
function gestionAdmin() { return vraiAdmin() && !vueJoueur() && !window.DATE_SIM; }
/** Le vrai rôle (même quand l'admin regarde l'appli comme un joueur) */
function vraiAdmin() { return typeof D === "undefined" || !D || !D.session || D.session.role === "admin"; }
/** Mode admin : la clé d'administration reste, mais par défaut l'appli se comporte comme pour un joueur (réglage « Mode admin ») */
function adminActif() { try { return vraiAdmin() && sessionStorage.getItem("versus.adminOn") === "1"; } catch (e) { return false; } }
/** Le joueur que l'admin incarne quand le mode admin est coupé */
function joueurAdmin() { const l = (typeof D !== "undefined" && D && D.personnes) || []; return (l.find(p => /^th[ée]o$/i.test(p.nom)) || l[0] || {}).nom; }   // la clé admin est Théo, point
/** Qui je suis vraiment : mon joueur, jamais celui que je regarde (l'admin reste son propre joueur, Théo) */
function moiVrai() { return estAdmin() ? (joueurAdmin() || "Théo") : SESSION && SESSION.nom; }
function vueJoueur() { return adminActif() && !!stock.get("versus.vueJoueur"); }
/** Simulation : date simulée ou vue joueur. Rien ne part vers l'API, rien de « vu » n'est gardé. */
function simulation() { return !!window.DATE_SIM || vueJoueur(); }
const MSG_SIMULATION = "👁️ Simulation : rien n'est envoyé. Repasse en admin, aujourd'hui, pour agir pour de vrai.";
function afficherTout() {
  if (stock.get("versus.accent") === "ecurie") appliquerAccent("ecurie");
  // indice mémorisé hors liste (changement du nombre d'indices) : retour au S&P 500
  const nbIdx = (D.marche.indices || []).length;
  if (!(ETAT.i1 >= 0 && ETAT.i1 < nbIdx)) ETAT.i1 = iRef();
  if (!(ETAT.i2 >= 0 && ETAT.i2 < nbIdx)) ETAT.i2 = Math.min(1, nbIdx - 1);
  if (ETAT.i2c === undefined || ETAT.i2c === null) ETAT.i2c = ok(ETAT.i2) ? ETAT.i2 : -1;
  if (ETAT.i2c >= nbIdx) ETAT.i2c = -1;
  SESSION = D.session || { role: "admin" };
  if (vueJoueur()) SESSION = { role: "perso", nom: joueurAdmin(), simule: true };   // vue joueur = toi, sans tes droits d'admin (jamais un autre joueur)
  else if (vraiAdmin() && !adminActif()) SESSION = { role: "perso", nom: joueurAdmin(), adminCoupe: true };
  if (D.personnes.find(p => p.nom === moiVrai())) { if (ETAT.moi !== moiVrai()) { ETAT.moi = moiVrai(); ETAT.fiche = moiVrai(); garder(); } } else if (!estAdmin() && D.personnes.find(p => p.nom === SESSION.nom)) { if (ETAT.moi !== SESSION.nom) { ETAT.moi = SESSION.nom; ETAT.fiche = SESSION.nom; garder(); } }
  if (!D.personnes.find(p => p.nom === ETAT.moi)) ETAT.moi = D.personnes[0].nom;
  if (!ETAT.fiche || !D.personnes.find(p => p.nom === ETAT.fiche)) ETAT.fiche = ETAT.moi;
  const b = $("#bandeau");
  b.hidden = SOURCE === "api" || (SOURCE === "cache" && EN_CHARGEMENT);   // copie affichée au démarrage pendant la mise à jour : pas d'alerte
  b.textContent = SOURCE === "demo" ? "Aperçu · chiffres du fichier au 29/10/2026. Ajoute l'adresse de l'API dans Réglages pour passer en direct."
    : ERREUR_SERVEUR ? "⚠️ Le fichier a répondu par une erreur : « " + ERREUR_SERVEUR + " ». Chiffres affichés : " + (D.majTexte || "dernière copie") + "."
    : "📴 Hors connexion · " + (D.majTexte || "dernières données reçues") + ". Tout se consulte ; les saisies se font quand le réseau revient.";
  $("#sous-titre").textContent = D.majTexte || "";
  rendreTicker();
  rendreVue(vueActive());
  majRappels();
  if (SOURCE === "api") setTimeout(verifierRevelation, 900);
  $("#etat-source").textContent = SOURCE === "demo" ? "Source : démonstration (aucune adresse d'API)." : SOURCE === "cache" ? "Source : copie locale, l'API n'a pas répondu." : "Source : le fichier « Versus Portefeuille ».";
  $("#choix-moi").innerHTML = D.personnes.map(p => '<button class="chip" type="button" data-moi="' + esc(p.nom) + '" aria-pressed="' + (p.nom === ETAT.moi) + '"><i style="background:' + couleur(p.nom) + '"></i>' + esc(p.nom) + "</button>").join("");
  document.querySelectorAll("[data-moi]").forEach(x => x.addEventListener("click", () => { ETAT.moi = x.dataset.moi; ETAT.fiche = x.dataset.moi; garder(); afficherTout(); }));
  $("#bloc-moi").hidden = true;   // plus de « Je suis » : chacun est lui-même
  majVueJoueur();
  majVersion();
  const admin = gestionAdmin() && SOURCE === "api";
  $("#regl-params").hidden = !admin;
  $("#regl-liaison").hidden = !admin;
  majChipsAffichage();
  if (admin) {
    $("#p-taux").value = ok(D.marche.tauxSansRisque) ? String(+(D.marche.tauxSansRisque * 100).toFixed(2)).replace(".", ",") : "";
    $("#p-comp").value = (D.marche.dateComparaison || "").slice(0, 7);
    majLiaison();
  }
  $("#bloc-nouvelle-cle").hidden = !gestionAdmin();
  $("#bloc-codes").hidden = !gestionAdmin() || SOURCE !== "api";
  $("#ligne-session").textContent = estAdmin() ? (SOURCE === "api" ? "Connecté avec la clé d'administration : tu vois et modifies tout, et tu gères les réglages communs." : "")
    : "Connecté en tant que " + SESSION.nom + " : tu vois tout le classement, et tu modifies ton relevé." + (SESSION.adminCoupe ? " Mode admin désactivé (aperçus des nouveautés masqués) ; la gestion (codes, relevés automatiques, réglages communs) reste plus bas." : "");
  majModeAdmin();
  ereDor();
}

/* ---------- Codes personnels (administrateur) ---------- */
let CODES = [], aRevoquer = null;
async function posterAdmin(corps) {
  if (simulation()) return { ok: false, erreur: "simulation", message: MSG_SIMULATION };
  if (navigator.onLine === false) return { ok: false, erreur: "reseau", message: "📴 Hors connexion : réessaie quand le réseau revient." };
  try { return await envoyerApi(apiUrl(), Object.assign({ cle: stock.get(CLES.cle) }, corps)); }
  catch (e) { return { ok: false, message: e.message }; }
}
async function chargerCodes() {
  if (!gestionAdmin() || SOURCE !== "api") return;
  $("#liste-codes").innerHTML = '<p class="info">Chargement des codes…</p>';
  const rep = await posterAdmin({ action: "codes" });
  if (!rep.ok) { $("#liste-codes").innerHTML = '<p class="info">' + esc(rep.message || "Lecture impossible.") + "</p>"; return; }
  CODES = rep.codes || []; rendreCodes();
}
function adresseApp() { return location.origin + location.pathname.replace(/index\.html$/, ""); }
function messageCode(c) { return "Voici l'app Versus pour suivre le classement : " + adresseApp() + "\nTon code d'accès : " + c.code + "\nPour l'installer : menu du navigateur › Ajouter à l'écran d'accueil."; }
async function copier(texte, btn) {
  const lib = btn.textContent;
  try { await navigator.clipboard.writeText(texte); btn.textContent = "Copié"; }
  catch (e) { btn.textContent = "Sélectionne le code pour le copier"; }
  setTimeout(() => { btn.textContent = lib; }, 1800);
}
function rendreCodes() {
  const autres = CODES.filter(c => c.personne !== ETAT.moi);
  $("#liste-codes").innerHTML = autres.map((c, i) => '<div class="code-l"><span class="n"><i style="background:' + couleur(c.personne) + '"></i>' + esc(c.personne) + "</span>" +
    '<span class="c' + (c.code ? "" : " aucun") + '">' + (c.code ? esc(c.code) : "pas de code") + "</span>" +
    '<div class="a">' + (c.code ? '<button class="lien" type="button" data-cc="' + i + '">Copier le message à envoyer</button>' : "") +
    '<button class="lien" type="button" data-cg="' + i + '">' + (c.code ? "Nouveau code" : "Créer un code") + "</button>" +
    (c.code ? '<button class="lien danger" type="button" data-cr="' + i + '">' + (aRevoquer === c.personne ? "Confirmer la révocation" : "Révoquer") + "</button>" : "") + "</div></div>").join("");
  document.querySelectorAll("[data-cc]").forEach(b => b.addEventListener("click", () => copier(messageCode(autres[+b.dataset.cc]), b)));
  document.querySelectorAll("[data-cg]").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true; b.textContent = "Création…";
    const rep = await posterAdmin({ action: "genererCode", personne: autres[+b.dataset.cg].personne });
    if (rep.ok) { CODES.find(x => x.personne === rep.personne).code = rep.code; toast(rep.message); } else toast(rep.message || "Création impossible.");
    aRevoquer = null; rendreCodes();
  }));
  document.querySelectorAll("[data-cr]").forEach(b => b.addEventListener("click", async () => {
    const c = autres[+b.dataset.cr];
    if (aRevoquer !== c.personne) { aRevoquer = c.personne; rendreCodes(); return; }
    const rep = await posterAdmin({ action: "revoquerCode", personne: c.personne });
    if (rep.ok) c.code = null;
    aRevoquer = null; toast(rep.message || "Révocation impossible."); rendreCodes();
  }));
}

function rendreTicker() {
  const t = document.querySelector(".ticker");
  t.hidden = ETAT.bandeau === "masque";
  t.classList.toggle("fige", ETAT.bandeau !== "defile");
  const r = (D.marche.resume || []).map(i => '<div class="tk"><span class="n">' + esc(i.nom) + '</span><span class="l">mois</span><span class="' + sens(i.mois) + '">' + pct(i.mois) + '</span><span class="l">depuis janv.</span><span class="' + sens(i.ytd) + '">' + pct(i.ytd) + "</span></div>").join("");
  $("#ticker").innerHTML = r + (reduit || ETAT.bandeau !== "defile" ? "" : r);
}

/* ---------- Filtres partagés ---------- */
/* Sélecteurs communs : enveloppe, période, indice de référence et second indice côte à côte */
function i2Actif() { return ok(ETAT.i2c) && ETAT.i2c >= 0 && ETAT.i2c !== ETAT.i1 && ETAT.i2c < D.marche.indices.length ? ETAT.i2c : -1; }
function filtres(avecIndices, avecPeriode = true, avecSecond = true) {
  const opt = (v, l, cur) => '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + esc(l) + "</option>";
  const env = '<label class="sel"><span>Enveloppe</span><select id="f-env">' + ENVELOPPES.map((e, i) => opt(i, e, ETAT.env)).join("") + "</select></label>";
  const per = avecPeriode ? '<label class="sel"><span>Période</span><select id="f-per">' + PERIODES.map(([k, l]) => opt(k, l, ETAT.per)).join("") + "</select></label>" : "";
  const idx = avecIndices ? '<label class="sel"><span>Indice</span><select id="f-i1">' + D.marche.indices.map((n, i) => opt(i, n, ETAT.i1)).join("") + "</select></label>" : "";
  const idx2 = avecIndices && avecSecond ? '<label class="sel"><span>2e indice</span><select id="f-i2c">' + opt(-1, "Aucun", i2Actif()) + D.marche.indices.map((n, i) => i === ETAT.i1 ? "" : opt(i, n, i2Actif())).join("") + "</select></label>" : "";
  const n = [env, per, idx, idx2].filter(Boolean).length;
  return '<div class="filtres' + (n === 3 ? " trois" : "") + '">' + env + per + idx + idx2 + "</div>";
}
function brancherFiltres(vue) {
  [["#f-env", "env", Number], ["#f-per", "per", String], ["#f-i1", "i1", Number], ["#f-i2c", "i2c", Number]].forEach(([s, k, f]) => {
    const el = document.querySelector("#v-" + vue + " " + s);
    if (el) el.addEventListener("change", () => { ETAT[k] = f(el.value); if (k === "i1" && ETAT.i2 === ETAT.i1) ETAT.i2 = ETAT.i1 === 1 ? 0 : 1; garder(); rendreVue(vue); });
  });
}
function cadre() {
  const fin = finGlobale(D, ETAT.env);
  const deb = debutPeriode(D, ETAT.per, fin);
  return { fin, deb };
}
function textePeriode(deb, fin, n) {
  return (deb ? "Du " + finMois(deb) : "Depuis le premier relevé") + " au " + finMois(fin) + " · " + n + " mois";
}

/* ---------- Animations (coupées si « réduire les animations ») ---------- */
const ANIM = !reduit;
const adoucir = t => 1 - Math.pow(1 - t, 3);
function devoiler(rect, de, a) {
  if (!rect) return;
  const t0 = performance.now(), duree = 950;
  const pas = t => { const x = Math.min(1, Math.max(0, t - t0) / duree); rect.setAttribute("width", de + (a - de) * adoucir(x)); if (x < 1) requestAnimationFrame(pas); };
  requestAnimationFrame(pas);
}
/* Chiffres qui défilent : éléments marqués data-cv (valeur) et data-cf (« pct » ou « eur ») */
function compterChiffres(racine) {
  if (!ANIM || !racine) return;
  racine.querySelectorAll("[data-cv]").forEach(el => {
    const fin = Number(el.dataset.cv), f = el.dataset.cf === "eur" ? (v => eur(v)) : (v => pct(v));
    if (!isFinite(fin) || (el.dataset.cf === "eur" && ETAT.discret === "oui")) return;
    const t0 = performance.now(), duree = 750;
    const pas = t => { const x = Math.min(1, Math.max(0, t - t0) / duree); el.textContent = f(fin * adoucir(x)); if (x < 1) requestAnimationFrame(pas); else el.textContent = f(fin); };
    requestAnimationFrame(pas);
  });
}
/* Tour de classement : les lignes glissent vers leur nouvelle position */
function positionsTour(v) { const p = {}; v.querySelectorAll(".pos[data-key]").forEach(el => p[el.dataset.key] = el.offsetTop); return p; }
function glisserTour(v, avant) {
  if (!ANIM || !avant || !Object.keys(avant).length) return;
  v.querySelectorAll(".pos[data-key]").forEach(el => {
    const ancien = avant[el.dataset.key]; if (ancien === undefined) return;
    const dy = ancien - el.offsetTop; if (Math.abs(dy) < 2) return;
    el.style.transition = "none"; el.style.transform = "translateY(" + dy + "px)"; el.style.zIndex = dy > 0 ? 2 : 1;
    el.getBoundingClientRect();
    el.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1)"; el.style.transform = "";
    el.addEventListener("transitionend", () => { el.style.zIndex = ""; el.style.transition = ""; }, { once: true });
  });
}

/* ---------- Graphique générique ---------- */
function tracer(box, conf) {
  const svg = box.querySelector("svg"), tip = box.querySelector(".tip");
  const xs = conf.x, n = xs.length;
  if (n < 2) { svg.innerHTML = ""; svg.setAttribute("height", 0); return; }
  const W = Math.max(280, box.clientWidth - 20), H = conf.h || (W < 420 ? 220 : 250);
  const m = { l: 46, r: conf.finEtiq ? 56 : 12, t: 10, b: 24 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", H);
  const vals = conf.series.flatMap(s => s.v).filter(ok);
  if (conf.ligneH !== undefined) vals.push(conf.ligneH);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const pad = (mx - mn) * .08 || Math.abs(mx) * .05 || 1;
  mn -= pad; mx += pad;
  if (conf.zeroMin && mn < 0 && Math.min(...vals) >= 0) mn = 0;
  const brut = (mx - mn) / 4, p10 = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 2.5, 5, 10].map(x => x * p10).find(x => x >= brut);
  const ticks = []; for (let v = Math.ceil(mn / pas) * pas; v <= mx; v += pas) ticks.push(+v.toFixed(8));
  const X = i => m.l + i / (n - 1) * iw, Y = v => m.t + ih - (v - mn) / (mx - mn) * ih;
  const C = n2 => couleurReelle(n2);
  let o = "";
  ticks.forEach(t => {
    o += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="' + C(conf.base && Math.abs(t) < 1e-9 ? "var(--ink-3)" : "var(--rule)") + '" stroke-width="1"/>';
    o += '<text x="' + (m.l - 6) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(conf.fmtAxe(t)) + "</text>";
  });
  let dx = -99;
  // étiquettes de l'axe : par défaut des clés de mois (AAAAMM) ; conf.etiqX(k, kPrécédent) pour d'autres pas (jours du module Moi)
  const etiq = conf.etiqX || (k => (n <= 14 || (n <= 36 ? k % 100 % 3 === 1 : k % 100 === 1)) ? (k % 100 === 1 ? String(Math.floor(k / 100)) : MOIS[k % 100 - 1]) : "");
  xs.forEach((k, i) => {
    const lab = etiq(k, i ? xs[i - 1] : null);
    if (!lab) return;
    const x = X(i); if (x - dx < 40) return; dx = x;
    o += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lab) + "</text>";
  });
  if (conf.ligneH !== undefined) o += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(conf.ligneH).toFixed(1) + '" y2="' + Y(conf.ligneH).toFixed(1) + '" stroke="' + C("var(--gold)") + '" stroke-width="1.5" stroke-dasharray="6 4"/>';
  const cid = "clip-" + (box.id || "g");
  o += '<defs><clipPath id="' + cid + '"><rect class="revele" x="0" y="0" width="' + (ANIM ? m.l : W) + '" height="' + H + '"/></clipPath></defs><g clip-path="url(#' + cid + ')">';
  const fins = [];
  conf.series.forEach(s => {
    let d = "", ouvert = false, dernier = null;
    s.v.forEach((v, i) => {
      if (!ok(v)) { ouvert = false; return; }
      const x = X(i).toFixed(1), y = Y(v).toFixed(1);
      d += (ouvert ? (s.marche ? "H" + x + "V" + y : "L" + x + " " + y) : "M" + x + " " + y);
      ouvert = true; dernier = i;
    });
    if (s.aire && d) {
      const premier = s.v.findIndex(ok);
      o += '<path d="' + d + "L" + X(dernier).toFixed(1) + " " + (m.t + ih) + "L" + X(premier).toFixed(1) + " " + (m.t + ih) + 'Z" fill="' + C(s.c) + '" fill-opacity=".14" stroke="none"/>';
    }
    if (s.fx && s.fx !== "simple" && d) o += '<path class="fx fx-' + s.fx + '" d="' + d + '" fill="none" stroke="' + C(s.c) + '" stroke-linejoin="round" stroke-linecap="round"/>';
    o += '<path d="' + d + '" fill="none" stroke="' + C(s.c) + '" stroke-width="' + (s.w || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="' + (s.dash === true ? "5 4" : s.dash) + '"' : "") + "/>";
    if (dernier !== null) {
      o += '<circle cx="' + X(dernier).toFixed(1) + '" cy="' + Y(s.v[dernier]).toFixed(1) + '" r="3.5" fill="' + C(s.c) + '" stroke="' + C("var(--panel)") + '" stroke-width="2"/>';
      if (conf.finEtiq) fins.push({ y: Y(s.v[dernier]), t: conf.fmt(s.v[dernier]), c: s.c });
    }
  });
  fins.sort((a, b) => a.y - b.y);
  for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 13) fins[i].y = fins[i - 1].y + 13;
  fins.forEach(f => { o += '<text x="' + (W - m.r + 6) + '" y="' + (f.y + 4).toFixed(1) + '" fill="' + C(f.c) + '" style="fill:' + C(f.c) + ';font-weight:600">' + esc(f.t) + "</text>"; });
  o += "</g>";
  o += '<line class="cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="' + C("var(--ink-3)") + '" visibility="hidden"/><g class="dots"></g>';
  o += '<rect class="hit" x="' + m.l + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/>';
  svg.innerHTML = o;
  if (ANIM) devoiler(svg.querySelector(".revele"), m.l, W);
  const cross = svg.querySelector(".cross"), dots = svg.querySelector(".dots"), hit = svg.querySelector(".hit");
  const montrer = ev => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) * W / r.width - m.l) / iw * (n - 1))));
    const x = X(i);
    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
    dots.innerHTML = conf.series.filter(s => ok(s.v[i])).map(s => '<circle cx="' + x.toFixed(1) + '" cy="' + Y(s.v[i]).toFixed(1) + '" r="4" fill="' + C(s.c) + '" stroke="' + C("var(--panel)") + '" stroke-width="2"/>').join("");
    const lignes = conf.series.filter(s => ok(s.v[i])).sort((a, b) => b.v[i] - a.v[i]);
    tip.hidden = false;
    tip.innerHTML = "<b>" + esc(conf.titreX(xs[i])) + "</b>" + lignes.map(s => '<div class="row" style="--c:' + C(s.c) + '"><span>' + esc(s.nom) + "</span><span>" + conf.fmt(s.v[i]) + "</span></div>").join("");
    const bx = box.getBoundingClientRect(), px = x / W * r.width + (r.left - bx.left), tw = tip.offsetWidth;
    let left = px + 14; if (left + tw > bx.width - 6) left = px - tw - 14;
    tip.style.left = Math.max(6, left) + "px"; tip.style.top = "38px";
  };
  hit.addEventListener("pointermove", montrer); hit.addEventListener("pointerdown", montrer);
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dots.innerHTML = ""; tip.hidden = true; });
}
function boiteGraphe(id, legende) {
  return '<div class="chart-box" id="' + id + '"><div class="legend">' + legende.map(l => '<span><i class="' + (l.dash ? (l.dash === true ? "dash" : "dash dot") : "") + '" style="border-color:' + l.c + '"></i>' + esc(l.nom) + "</span>").join("") +
    '</div><svg class="chart" role="img" aria-label="Graphique"></svg><div class="tip" hidden></div></div>';
}

/* ---------- Vue Classement ---------- */
/* Bande du nom (titres, badges) : défile au pouce quand elle déborde, les chiffres restent fixes à droite */
function bandesDefilantes(root) {
  root.querySelectorAll(".pos .who > div, .ch-l .nm small").forEach(d => {
    const maj = () => { const deb = d.scrollWidth > d.clientWidth + 2; d.classList.toggle("deborde", deb); d.classList.toggle("fin", deb && d.scrollLeft + d.clientWidth >= d.scrollWidth - 2); };
    maj(); d.addEventListener("scroll", maj, { passive: true });
  });
}
/* Toucher un badge ou une plaque : ce qu'il veut dire (sans ouvrir la ligne) */
function expliquerBadges(root) {
  root.querySelectorAll("[data-bdg]").forEach(b => { b.style.cursor = "help"; b.addEventListener("click", ev => { ev.stopPropagation(); toast(b.dataset.bdg); }); });
}
function rendreClassement() {
  const { fin, deb } = cadre();
  const v = $("#v-classement");
  const avantTour = positionsTour(v);
  if (!fin) { v.innerHTML = filtres(true) + '<div class="vide">Aucun relevé pour cette enveloppe.</div>'; brancherFiltres("classement"); return; }
  const env = ETAT.env, i1 = ETAT.i1;
  const st = D.personnes.map(p => stats(D, p, env, deb, fin, i1, null)).filter(s => s.n > 0);
  const idx = statsIndice(D, i1, deb, fin);
  const finPf = finGlobale(D, 0);
  const manque = new Set(D.personnes.filter(p => { const s = serie(p, 0).filter(x => x.val); return s.length && s[s.length - 1].k < finPf; }).map(p => p.nom));
  const tri = st.slice().sort((a, b) => b.twr - a.twr);
  const leader = tri[0];
  const lignes = tri.slice();
  if (idx && leader) lignes.push(Object.assign({ fantome: true }, idx));
  lignes.sort((a, b) => b.twr - a.twr);
  let rang = 0;
  const nMois = Math.max(...st.map(s => s.n), idx ? idx.n : 0);

  // En bref : dernier mois
  const der = fin;
  const duMois = D.personnes.map(p => { const x = serie(p, env).find(s => s.k === der && typeof s.r === "number"); return x ? { nom: p.nom, r: x.r } : null; }).filter(Boolean).sort((a, b) => b.r - a.r);
  const iDer = (D.marche.mois.find(l => l[0] === der) || [])[i1 + 1];
  const battent = st.filter(s => s.i1 && s.twr > s.i1.twr).map(s => s.nom);
  const anomalies = anomaliesDonnees(env);
  const pal = victoires(env);
  const dernierVerdict = verdictMois(env);
  if (VK && !moisVerdict(env).includes(VK)) VK = null;
  const verdict = VK ? verdictMois(env, VK) : dernierVerdict;
  const enSerie = Object.entries(pal).filter(([, x]) => x.serie >= 2).sort((a, b) => b[1].serie - a[1].serie)[0];
  let bref = "";
  if (duMois.length && !(verdict && verdict.complet)) bref += "<b>" + esc(moisLong(der)) + "</b> : meilleur mois pour <b>" + esc(duMois[0].nom) + "</b> (" + pct(duMois[0].r) + ")" + (duMois.length > 1 ? ", plus dur pour <b>" + esc(duMois[duMois.length - 1].nom) + "</b> (" + pct(duMois[duMois.length - 1].r) + ")" : "") + (ok(iDer) ? ", " + esc(D.marche.indices[i1]) + " " + pct(iDer) : "") + ". ";
  if (enSerie) bref += "<b>" + esc(enSerie[0]) + "</b> enchaîne " + enSerie[1].serie + " victoires mensuelles d'affilée. ";
  if (leader) bref += "Sur la période, <b>" + esc(leader.nom) + "</b> mène avec " + pct(leader.twr) + (battent.length ? ", " + battent.map(esc).join(" et ") + (battent.length > 1 ? " battent " : " bat ") + esc(D.marche.indices[i1]) + " à mois égaux." : " ; personne ne bat " + esc(D.marche.indices[i1]) + " à mois égaux.");

  const tour = lignes.map(s => {
    if (s.fantome) {
      return '<div class="pos ghost" data-key="idx"><span class="rk">IDX</span><div class="who"><i></i><div><b>' + esc(s.nom) + "</b><small>indice · " + s.n + ' mois</small></div></div><span class="t ' + sens(s.twr) + '" data-cv="' + s.twr + '" data-cf="pct">' + pct(s.twr) + '</span><span class="g">' + pts(s.twr - leader.twr) + "</span></div>";
    }
    rang++;
    const ecart = s.i1 ? s.twr - s.i1.twr : null;
    return '<div class="pos" tabindex="0" role="button" aria-expanded="false" data-key="' + esc(s.nom) + '" data-nom="' + esc(s.nom) + '"><span class="rk">' + rang + '</span><div class="who">' + (saisonVisible() ? avatar(s.nom) : '<i style="background:' + couleur(s.nom) + '"></i>') + '<div><b' + attrLivree(s.nom) + '>' + esc(s.nom) + couronne(s.nom) +
      (s.nom === ETAT.moi ? '<span class="tag ici">moi</span>' : "") + badgesNom(s.nom) + (manque.has(s.nom) ? '<span class="tag manque">relevé à saisir</span>' : "") +
      "</b><small>" + plaqueDe(s.nom) + pts(ecart) + " vs " + esc(D.marche.indices[i1]) + (s.n < nMois ? " · " + s.n + " mois" : "") + '</small></div></div><span class="t ' + sens(s.twr) + '" data-cv="' + s.twr + '" data-cf="pct">' + pct(s.twr) + "</span>" +
      (s === leader ? '<span class="g lead">LEADER</span>' : '<span class="g">' + pts(s.twr - leader.twr) + "</span>") + "</div>";
  }).join("");

  // Courbes base 100
  const i2c = i2Actif();
  const idx2 = i2c >= 0 ? statsIndice(D, i2c, deb, fin) : null;
  const ks = [deb || null].concat([...new Set(st.flatMap(s => s.mois.map(x => x.k)).concat(idx ? idx.chemin.slice(1).map(c => c.k) : []).concat(idx2 ? idx2.chemin.slice(1).map(c => c.k) : []))].sort((a, b) => a - b));
  if (!ks[0]) ks[0] = cleMoins(ks[1], 1);
  const aligne = chemin => {
    const out = ks.map(() => null);
    const debutK = cleMoins(chemin[1].k, 1);
    chemin.forEach((c, j) => { const k = j === 0 ? debutK : c.k; const i = ks.indexOf(k); if (i >= 0) out[i] = c.v / 100 - 1; });
    return out;
  };
  const series = st.map(s => ({ nom: s.nom, v: aligne(s.chemin), c: couleur(s.nom), w: s.nom === ETAT.moi ? 2.8 : 2, fx: saisonVisible() ? equipDe(s.nom).trainee : null }));
  if (idx) series.push({ nom: idx.nom, v: aligne(idx.chemin), c: "var(--idx)", dash: true, w: 1.6 });
  if (idx2) series.push({ nom: idx2.nom, v: aligne(idx2.chemin), c: "var(--ink-2)", dash: "1.5 4", w: 1.8 });

  // Plus-value réelle depuis l'ouverture
  const pv = D.personnes.map(p => stats(D, p, env, 0, fin, null, null)).filter(s => ok(s.valeur)).sort((a, b) => (b.pvLatentePct ?? -Infinity) - (a.pvLatentePct ?? -Infinity));
  const maxPv = Math.max(...pv.map(s => Math.abs(s.pvLatentePct || 0)), .01);

  v.innerHTML = banniereBilan() +
    '<div id="boite-verdict">' + carteVerdict(verdict) + "</div>" +
    (bref ? '<div class="bref">' + bref + "</div>" : "") +
    (anomalies.length ? '<div style="display:grid;gap:6px">' + anomalies.map(t => '<div class="alerte warn">' + t + "</div>").join("") + "</div>" : "") +
    '<div><h2 class="sec">Classement <span class="h-boutons"><button class="million-b' + (D.premierMillion ? " pris" : "") + '" type="button" id="info-million" aria-label="Premier millionnaire">👑</button><button class="vers-fiches" type="button" id="vers-fiches" aria-label="Ouvrir les fiches de chacun"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c1-3.2 3-4.8 5.5-4.8s4.5 1.6 5.5 4.8"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.4c2.3.1 3.9 1.6 4.8 4.6"/></svg>Fiches</button></span></h2></div>' +
    filtres(true) +
    '<div class="periode">' + esc(textePeriode(deb, fin, nMois)) + (deb && st.some(s => s.n < nMois) ? " · chaque courbe démarre au premier relevé de la personne" : "") + " · performance (TWR), versements neutralisés</div>" +
    '<div class="tour"><div class="tour-h"><span>Pos.</span><span>Portefeuille</span><span>TWR · écart</span></div>' + tour + "</div>" +
    (saisonVisible() ? '<p class="leg-bdg"><b>Badges</b> 🟡 en tête du championnat · 🏆 champion de saison · ⚡💥… exclusifs gagnés (un seul exemplaire) · plaque gagnée en défi. <span>Touche un badge pour savoir ce qu\'il veut dire.</span></p>' : "") +
    "<div>" + '<h2 class="sec">La course <small>performance cumulée</small></h2></div>' +
    boiteGraphe("g-course", series.map(s => ({ nom: s.nom, c: s.c, dash: s.dash }))) +
    (ks.length > 2 && st.length > 1 ? '<div><h2 class="sec">Les positions <small>place au classement à chaque fin de mois</small></h2></div>' + boiteGraphe("g-places", st.map(s => ({ nom: s.nom, c: couleur(s.nom) }))) : "") +
    '<div><h2 class="sec">Gain réel <small>depuis l\'ouverture · ' + esc(ENVELOPPES[env]) + "</small></h2>" +
    pv.map(s => '<div class="barre"><span class="a"><i style="width:9px;height:9px;border-radius:2px;transform:skewX(-12deg);background:' + couleur(s.nom) + '"></i>' + esc(s.nom) + '</span><span class="b ' + sens(s.pvLatente) + '">' + eur(s.pvLatente, 0, true) + "</span>" +
      '<span class="c"><span class="jauge"><i style="width:' + (Math.abs(s.pvLatentePct || 0) / maxPv * 100).toFixed(1) + "%;background:" + (s.pvLatente >= 0 ? "var(--up)" : "var(--down)") + '"></i></span><span>' + pct(s.pvLatentePct) + " · " + eur(s.valeur) + " pour " + eur(s.verse) + " versés</span></span></div>").join("") + "</div>" +
    '<div><h2 class="sec">Régularité <small>sur la période</small></h2><div class="scroll-x"><table class="tab"><thead><tr><th>Personne</th><th>Mois positifs</th><th>Bat ' + esc(D.marche.indices[i1]) + "</th><th>Versé</th><th>Plus-value</th></tr></thead><tbody>" +
    tri.map(s => '<tr><td><span class="pastille" style="background:' + couleur(s.nom) + '"></span>' + esc(s.nom) + "</td><td>" + pct(s.positifs, 0, false) + "</td><td>" + pct(s.i1 && s.i1.battus, 0, false) + "</td><td>" + eur(s.versePeriode) + '</td><td class="' + sens(s.pvPeriode) + '">' + eur(s.pvPeriode, 0, true) + "</td></tr>").join("") +
    "</tbody></table></div></div>";

  brancherFiltres("classement");
  tracer($("#g-course"), { x: ks, series: series, base: true, finEtiq: true, fmt: x => pct(x), fmtAxe: t => pct(t, 0), titreX: k => "Fin " + moisCourt(k) });
  if ($("#g-places")) {
    const kp = ks.slice(1), parMois = kp.map(k => rangs(env, deb, k));
    tracer($("#g-places"), { x: kp, series: st.map(s => ({ nom: s.nom, v: parMois.map(r => r[s.nom] ? -r[s.nom] : null), c: couleur(s.nom), w: s.nom === ETAT.moi ? 2.8 : 2 })),
      finEtiq: true, h: 170, fmt: x => rangTxt(-x), fmtAxe: t => Number.isInteger(t) && t < 0 ? rangTxt(-t) : "", titreX: k => "Fin " + moisCourt(k) });
  }
  brancherVerdict(verdict);
  $("#info-million").addEventListener("click", () => toast(texteMillion()));
  $("#vers-fiches").addEventListener("click", () => { if (!ETAT.fiche) ETAT.fiche = ETAT.moi; garder(); allerA("fiche"); });
  v.querySelectorAll("[data-bilan]").forEach(b => b.addEventListener("click", () => ouvrirBilan(+b.dataset.bilan)));
  v.querySelectorAll("[data-aller-recap]").forEach(b => b.addEventListener("click", () => { ETAT.bilans = "mensuel"; garder(); allerA("mois"); ouvrirRecap(+b.dataset.allerRecap); }));
  feterChampion(dernierVerdict);
  glisserTour(v, avantTour);
  bandesDefilantes(v);
  expliquerBadges(v);
  if (!Object.keys(avantTour).length) compterChiffres(v.querySelector(".tour"));
  v.querySelectorAll(".pos[data-nom]").forEach(el => {
    const ouvrir = () => {
      const s = st.find(x => x.nom === el.dataset.nom);
      const suiv = el.nextElementSibling;
      if (suiv && suiv.classList.contains("detail")) { suiv.remove(); el.setAttribute("aria-expanded", "false"); return; }
      const c = (l, val, cls) => "<div><span>" + l + '</span><b class="' + (cls || "") + '">' + val + "</b></div>";
      const d = document.createElement("div"); d.className = "detail";
      d.innerHTML = '<div class="mini">' + c("Volatilité", volTxt(s)) + c("Sharpe", sharpeTxt(s)) + c("Pire baisse", pct(s.baisseMax), sens(s.baisseMax)) +
        c("Meilleur (" + moisCourt(s.meilleur.k) + ")", pct(s.meilleur.r), sens(s.meilleur.r)) + c("Pire (" + moisCourt(s.pire.k) + ")", pct(s.pire.r), sens(s.pire.r)) + c("MWR", pct(s.mwr), sens(s.mwr)) +
        c(esc(D.marche.indices[i1]) + " même période", pct(s.i1 && s.i1.twr)) + c("Mois battant l'indice", pct(s.i1 && s.i1.battus, 0, false)) + c("Plus-value période", eur(s.pvPeriode, 0, true), sens(s.pvPeriode)) +
        '</div><button class="lien" type="button" style="margin-top:8px">Ouvrir la fiche de ' + esc(s.nom) + " →</button>";
      d.querySelector(".lien").addEventListener("click", () => { ETAT.fiche = s.nom; garder(); allerA("fiche"); });
      el.after(d); el.setAttribute("aria-expanded", "true");
    };
    el.addEventListener("click", ouvrir);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } });
  });
}

/* ---------- Anomalies dans les relevés déjà saisis ---------- */
function anomaliesDonnees(env) {
  const out = [];
  D.personnes.forEach(p => {
    const rows = p.rows.filter(r => aUnReleveBrut(r[2]));
    if (rows.length < 2) return;
    const r = rows[rows.length - 1], pr = rows[rows.length - 2];
    ["PEA", "Assurance vie", "CTO", "Crypto"].forEach((nom, e) => {
      const v = r[2][2 * e + 1], pv = pr[2][2 * e + 1], ve = r[2][2 * e] || 0;
      if (!ok(v) && ok(pv) && pv > 0) out.push("<b>" + esc(p.nom) + "</b>, " + esc(moisLong(r[0])) + " : valeur " + nom + " manquante (" + eur(pv) + " le mois d'avant). Le total du portefeuille est faussé.");
      else if (ok(v) && ok(pv) && pv > 0 && pv + ve / 2 > 0) {
        const x = (v - pv - ve) / (pv + ve / 2);
        if (Math.abs(x) > .25) out.push("<b>" + esc(p.nom) + "</b>, " + esc(moisLong(r[0])) + " : " + nom + " " + pct(x, 0) + " sur le mois, à vérifier.");
      }
    });
  });
  return out;
}
function aUnReleveBrut(b) { return [1, 3, 5, 7].some(i => ok(b[i])); }

/* ---------- Victoires mensuelles, séries et mois en tête ---------- */
function victoires(env, jusqua, depuis) {
  const fin = jusqua || finGlobale(D, env), deb = depuis || 0;
  const ks = [...new Set(D.personnes.flatMap(p => serie(p, env).filter(x => typeof x.r === "number" && x.k <= fin && x.k > deb).map(x => x.k)))].sort((a, b) => a - b);
  const res = {};
  D.personnes.forEach(p => res[p.nom] = { victoires: 0, serie: 0, record: 0, enTete: 0, battu: 0, mois: 0 });
  const series = D.personnes.map(p => ({ nom: p.nom, s: serie(p, env) }));
  const iMois = {}; D.marche.mois.forEach(l => iMois[l[0]] = l[ETAT.i1 + 1]);
  const courant = {};
  ks.forEach(k => {
    const du = series.map(x => { const y = x.s.find(z => z.k === k); return { nom: x.nom, r: y && typeof y.r === "number" ? y.r : null }; }).filter(x => x.r !== null);
    du.forEach(x => { res[x.nom].mois++; if (ok(iMois[k]) && x.r > iMois[k]) res[x.nom].battu++; });
    const tri = du.slice().sort((a, b) => b.r - a.r);
    const bests = tri.length > 1 ? tri.filter(z => tri[0].r - z.r < 1e-9).map(z => z.nom) : [];   // égalité en tête : victoire pour chacun (comme au Podium)
    D.personnes.forEach(p => {
      if (bests.includes(p.nom)) { res[p.nom].victoires++; courant[p.nom] = (courant[p.nom] || 0) + 1; res[p.nom].record = Math.max(res[p.nom].record, courant[p.nom]); }
      else if (du.some(x => x.nom === p.nom)) courant[p.nom] = 0;
    });
    // en tête du classement de l'année à la fin de ce mois
    const y = Math.floor(k / 100), deb = (y - 1) * 100 + 12;
    let lead = null, lt = -Infinity;
    D.personnes.forEach(p => { const st = stats(D, p, env, deb, k, null, null); if (st.n && st.twr > lt && serie(p, env).some(z => z.k === k && typeof z.r === "number")) { lt = st.twr; lead = p.nom; } });
    if (lead) res[lead].enTete++;
  });
  D.personnes.forEach(p => res[p.nom].serie = courant[p.nom] || 0);
  return res;
}


